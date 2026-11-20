// =====================================================================
//  Motor de cálculo: etapas, riego (método FAO) y nutrición
// =====================================================================
const DIA = 86400000;
const cultivoPorId = (id) => CULTIVOS.find((c) => c.id === id);
const sumarDias = (d, n) => new Date(d.getTime() + Math.round(n) * DIA);
const sumarMeses = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const hoy0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const parseFecha = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Clima a usar: datos reales de la ubicación (auto) o tabla de la zona (manual)
function climaDe(cfg) {
  if (cfg.modoClima === "auto" && cfg.climaLoc) return { et0: cfg.climaLoc.et0, lluvia: cfg.climaLoc.lluvia, fuente: "auto" };
  const z = ZONAS[cfg.zona] || ZONAS.valle;
  return { et0: z.et0, lluvia: z.lluvia, fuente: "manual" };
}

// Promedio diario de ET0 y lluvia entre dos fechas
function climaEntre(clima, desde, hasta) {
  let et0 = 0, lluvia = 0, n = 0;
  for (let t = desde.getTime(); t < hasta.getTime(); t += 3 * DIA) {
    const m = new Date(t).getMonth();
    et0 += clima.et0[m]; lluvia += clima.lluvia[m] / 30; n++;
  }
  if (!n) { const m = desde.getMonth(); return { et0: clima.et0[m], lluvia: clima.lluvia[m] / 30 }; }
  return { et0: et0 / n, lluvia: lluvia / n };
}

// ---------- Etapas con fechas ----------
function etapasConFechas(cfg, c) {
  const hoy = hoy0();
  if (!c.perenne) {
    const sol = SOL[cfg.sol];
    const f = sol.ciclo * ((cfg.zona === "sur" || cfg.zona === "cordillera") ? 1.1 : 1);
    const inicio = parseFecha(cfg.fecha);
    return c.etapas.map((e, i) => ({ ...e, i,
      desde: sumarDias(inicio, e.dias[0] * f), hasta: sumarDias(inicio, e.dias[1] * f) }));
  }
  // Frutales: ciclo anual por meses (se desplaza 6 meses en el hemisferio norte)
  const desfase = cfg.lat > 0 ? 6 : 0;
  const mes = (m) => ((m - 1 + desfase) % 12);                // 0..11
  const m0 = mes(c.etapas[0].meses[0]);
  let anio = hoy.getFullYear();
  if (hoy < new Date(anio, m0, 1)) anio--;
  const inicioTemporada = new Date(anio, m0, 1);
  return c.etapas.map((e, i) => {
    const a = mes(e.meses[0]), b = mes(e.meses[1]);
    const off = (a - m0 + 12) % 12, len = ((b - a + 12) % 12) || 12;
    return { ...e, i, desde: sumarMeses(inicioTemporada, off), hasta: sumarMeses(inicioTemporada, off + len) };
  });
}

// ---------- Riego ----------
function goterosSugeridos(c, cfg) {
  if (!c.perenne) return 1;
  return Math.max(2, Math.round((c.areaPlanta * EDADES[cfg.edad || "adulta"].factor) / 2.5));
}

function riegoEtapa(cfg, c, e, clima, override) {
  const suelo = SUELOS[cfg.suelo], sol = SOL[cfg.sol], metodo = METODOS[cfg.metodo || "manguera"];
  const cl = override || climaEntre(clima, e.desde, e.hasta);
  const mulch = cfg.mulch ? 0.8 : 1;
  const kc = c.kc[e.i];
  const etc = cl.et0 * kc * sol.factor * mulch;              // mm/día que consume el cultivo
  const lluviaEf = cl.lluviaEf != null ? cl.lluviaEf : cl.lluvia * 0.7;
  const neta = Math.max(0, etc - lluviaEf);                  // mm/día que hay que reponer
  const fz = c.perenne ? 1 : [0.4, 0.7, 1, 1][e.i];
  const raw = c.zr * fz * suelo.au * (c.p || 0.4);           // mm fácilmente disponibles
  // Goteo moja poco volumen: se riega seguido. Recién plantado: raíces chicas.
  let maxInt = cfg.metodo === "goteo" ? (c.perenne ? 4 : 3) : (c.perenne ? 14 : 10);
  if (!c.perenne && e.i === 0) maxInt = Math.min(maxInt, 3);
  const cada = neta < 0.15 ? null : clamp(Math.floor(raw / neta), 1, maxInt);
  const brutaMm = cada ? (neta * cada) / metodo.ef : 0;      // L/m² por riego

  let porPlanta, total, unidad;
  if (c.perenne) {
    const area = c.areaPlanta * EDADES[cfg.edad || "adulta"].factor;
    porPlanta = brutaMm * area; total = porPlanta * cfg.plantas; unidad = "planta";
  } else {
    porPlanta = brutaMm / c.plantasM2; total = brutaMm * cfg.area; unidad = "m²";
  }
  const goteros = cfg.goteros || goterosSugeridos(c, cfg), caudal = cfg.caudal || (c.perenne ? 4 : 2);
  return {
    et0: cl.et0, kc, etc, lluviaEf, neta, cada, brutaMm, porPlanta, total, unidad,
    semanal: cada ? (brutaMm * 7) / cada : 0,
    minutosGoteo: cada ? (porPlanta / (goteros * caudal)) * 60 : 0,
    segManguera: cada ? (porPlanta / 12) * 60 : 0,          // manguera ≈ 12 L/min
  };
}

// ---------- Nutrición ----------
function programaEtapa(c, e, necesidad, perfil, opciones) {
  const k = e.i;
  const parte = (n) => (necesidad[n] || 0) * ((perfil[n] && perfil[n][k]) || 0) / 100;
  let N = parte("N"), P = parte("P"), K = parte("K"), Ca = parte("Ca"), Mg = parte("Mg");
  const prod = [];
  const add = (id, g) => { if (g >= 0.3) prod.push({ id, ...FERT[id], g }); };

  if (!c.perenne && k === 0) {
    // Abonado de base, antes de plantar
    add("sft", P / 0.46); add("sk", K / 0.5); add("urea", N / 0.46); add("mgs", Mg / 0.16);
  } else if (c.amonio) {
    // Arándano: nitrógeno amoniacal, sin nitratos ni cal
    const map = P / 0.61; add("map", map); N -= map * 0.12;
    add("sk", K / 0.5); add("sa", Math.max(0, N) / 0.21); add("mgs", Mg / 0.16);
  } else {
    const nca = Ca / 0.265; add("nca", nca); N -= nca * 0.155;
    const map = P / 0.61; add("map", map); N -= map * 0.12;
    const nk = Math.min(K / 0.46, Math.max(0, N) / 0.13); add("nk", nk); N -= nk * 0.13;
    add("sk", (K - nk * 0.46) / 0.5);
    add("urea", Math.max(0, N) / 0.46);
    add("mgs", Mg / 0.16);
  }
  // Orgánico equivalente
  const org = [];
  const Nr = parte("N"), Pr = parte("P"), Kr = parte("K");
  if (Nr > 0.3) org.push({ nombre: ORGANICOS.N.nombre, g: Nr / (ORGANICOS.N.pct / 100) });
  if (Pr > 0.3) org.push({ nombre: ORGANICOS.P.nombre, g: Pr / (ORGANICOS.P.pct / 100) });
  if (Kr > 0.3) org.push(c.amonio ? { nombre: "Sulfato de potasio (apto orgánico)", g: Kr / 0.5 }
                                  : { nombre: ORGANICOS.K.nombre, g: Kr / (ORGANICOS.K.pct / 100) });
  return { nutr: { N: Nr, P: Pr, K: Kr, Ca: parte("Ca"), Mg: parte("Mg") }, prod, org };
}

function aplicaciones(c, e, cfg) {
  const dias = Math.max(1, Math.round((e.hasta - e.desde) / DIA));
  if (!c.perenne && e.i === 0) return { n: 1, cada: 0 };
  const paso = c.perenne ? (cfg.metodo === "goteo" ? 15 : 30) : (cfg.metodo === "goteo" ? 7 : 15);
  const n = Math.max(1, Math.round(dias / paso));
  return { n, cada: n > 1 ? Math.round(dias / n) : 0 };
}

// ---------- Plan completo ----------
function calcularPlan(cfg) {
  const c = cultivoPorId(cfg.cultivo);
  const clima = climaDe(cfg);
  const etapas = etapasConFechas(cfg, c);
  const hoy = hoy0();
  const perfil = PERFILES[c.perfil];
  const edadF = c.perenne ? EDADES[cfg.edad || "adulta"].factor : 1;
  // necesidad total: g/m² (anuales) o g/planta (frutales)
  const necesidad = {};
  for (const n of ["N", "P", "K", "Ca", "Mg"]) necesidad[n] = c.perenne ? (c.req[n] || 0) * edadF : (c.req[n] || 0) * 0.1;
  const mult = c.perenne ? cfg.plantas : cfg.area;    // para pasar a total

  const out = etapas.map((e) => {
    const riego = riegoEtapa(cfg, c, e, clima);
    const nut = programaEtapa(c, e, necesidad, perfil, cfg);
    const ap = aplicaciones(c, e, cfg);
    const fechasAp = Array.from({ length: ap.n }, (_, k) => sumarDias(e.desde, k * ap.cada));
    const micro = (c.micro || []).filter((m) => MICRO[m].etapas.includes(e.i)).map((m) => MICRO[m]);
    return { ...e, riego, nut, ap, fechasAp, micro, actual: hoy >= e.desde && hoy < e.hasta };
  });

  let ahora;
  const inicio = out[0].desde, fin = out[out.length - 1].hasta;
  if (c.perenne) ahora = { tipo: "etapa", etapa: out.find((e) => e.actual) || out[out.length - 1] };
  else if (hoy < inicio) ahora = { tipo: "antes", dias: Math.round((inicio - hoy) / DIA) };
  else if (hoy >= fin) ahora = { tipo: "fin" };
  else ahora = { tipo: "etapa", etapa: out.find((e) => e.actual), dia: Math.round((hoy - inicio) / DIA) };

  const zona = ZONAS[cfg.zona] || ZONAS.valle;
  const sol = SOL[cfg.sol];
  const riesgoHongos = zona.hongos || sol.hongos || (cfg.climaLoc && cfg.climaLoc.humedad >= 75);

  // Corrección de pH
  let ph = null;
  if (cfg.ph) {
    const suelo = SUELOS[cfg.suelo], meta = (c.ph[0] + c.ph[1]) / 2;
    if (cfg.ph < c.ph[0] - 0.2) ph = { tipo: "subir", producto: "Cal agrícola (carbonato de calcio)", g: (meta - cfg.ph) * suelo.cal, meta };
    else if (cfg.ph > c.ph[1] + 0.2) ph = { tipo: "bajar", producto: "Azufre elemental en polvo", g: (cfg.ph - meta) * suelo.azufre, meta };
    else ph = { tipo: "ok", meta };
  }
  return { c, cfg, clima, etapas: out, ahora, inicio, fin, zona, sol, riesgoHongos, necesidad, mult, ph, edadF };
}

// Riego de esta semana con el pronóstico real
function riegoPronostico(plan, pron) {
  const e = plan.ahora.etapa;
  if (!e || !pron) return null;
  const d = pron.dias.slice(0, 7);
  const et0 = d.reduce((s, x) => s + x.et0, 0) / d.length;
  const lluviaEf = d.reduce((s, x) => s + (x.lluvia > 2 ? x.lluvia * 0.8 : 0), 0) / d.length;
  const r = riegoEtapa(plan.cfg, plan.c, e, plan.clima, { et0, lluviaEf });
  const lluviaPronto = d.slice(0, 2).reduce((s, x) => s + x.lluvia, 0);
  return { ...r, lluviaSemana: d.reduce((s, x) => s + x.lluvia, 0), lluviaPronto };
}
