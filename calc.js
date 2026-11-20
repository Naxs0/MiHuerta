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
// Cuánto se alarga el ciclo con sombra/nubosidad y zonas frías
function factorCiclo(cfg) {
  const sol = SOL[cfg.sol] || SOL.sol;
  return sol.ciclo * ((cfg.zona === "sur" || cfg.zona === "cordillera") ? 1.1 : 1);
}

// Cultivo ya plantado sin fecha conocida: se estima desde la etapa actual o la edad.
// frac = cuánto lleva dentro de la etapa (0 = recién empezó, 0.5 = a la mitad, 0.9 = terminando)
function estimarFechaPlantacion(c, cfg, etapaIdx, frac, semanas) {
  const hoy = hoy0();
  let dias;
  if (semanas > 0) dias = semanas * 7;
  else {
    const e = c.etapas[etapaIdx];
    dias = (e.dias[0] + (e.dias[1] - e.dias[0]) * frac) * factorCiclo(cfg);
  }
  return sumarDias(hoy, -Math.round(dias));
}

// Si se empezó a usar la app con el cultivo ya avanzado: qué hacer para ponerse al día
function puestaAlDia(plan) {
  const { c, cfg } = plan;
  if (c.perenne || !cfg.desde) return null;
  const desde = parseFecha(cfg.desde);
  if (desde <= sumarDias(plan.inicio, 3)) return null;            // empezó a tiempo
  const e = plan.etapas.find((x) => desde >= x.desde && desde < x.hasta) || plan.etapas[plan.etapas.length - 1];
  const dias = Math.round((desde - plan.inicio) / DIA);
  if (plan.hidro) {
    return { hidro: true, etapa: e, dias, fecha: desde, conc: e.nut.conc,
      productos: e.nut.prod.map((x) => ({ nombre: x.nombre, total: x.gTotal })) };
  }
  // Abono de recuperación: 50% del fósforo y potasio del abonado de base, en forma soluble
  const base = plan.etapas[0].nut.nutr;
  const P = base.P * 0.5, K = base.K * 0.5;
  const productos = [];
  if (P > 0.3) productos.push({ nombre: FERT.map.nombre, g: P / 0.61 });
  if (K > 0.3) productos.push({ nombre: FERT.sk.nombre, g: K / 0.5 });
  productos.forEach((x) => { x.total = x.g * plan.mult; });
  return { etapa: e, dias, fecha: desde, productos, compost: c.perenne ? 0 : 1000 };
}

function etapasConFechas(cfg, c) {
  const hoy = hoy0();
  if (!c.perenne) {
    const f = factorCiclo(cfg);
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

  if (c.hidro) return planHidro(cfg, c, clima, etapas, hoy);

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
  const variedad = c.variedades ? c.variedades.find((v) => v.id === cfg.variedad) || null : null;
  const plan = { c, cfg, clima, etapas: out, ahora, inicio, fin, zona, sol, riesgoHongos, necesidad, mult, ph, edadF, variedad };
  plan.puesta = puestaAlDia(plan);
  return plan;
}

// ---------- Hidroponía ----------
function volumenHidro(cfg) {
  const sis = SISTEMAS_HIDRO[cfg.sistema || "nft"];
  return cfg.volumen || Math.max(20, Math.round(cfg.plantas * sis.lPlanta));
}

function planHidro(cfg, c, clima, etapas, hoy) {
  const sol = SOL[cfg.sol] || SOL.sol;
  const vol = volumenHidro(cfg);
  const out = etapas.map((e) => {
    const cl = climaEntre(clima, e.desde, e.hasta);
    // consumo de agua: referencia con ET0 = 5 mm/día, ajustado por clima y sombra (mínimo 40%: bajo techo)
    const factor = Math.max(0.4, (cl.et0 / 5) * sol.factor);
    const porPlantaDia = c.consumo[e.i] * factor;
    const totalDia = porPlantaDia * cfg.plantas;
    const cada = 2;
    const riego = {
      hidro: true, et0: cl.et0, kc: c.kc[e.i], etc: 0, lluviaEf: 0, neta: 0, cada, brutaMm: 0,
      porPlanta: porPlantaDia * cada, total: totalDia * cada, porPlantaDia, totalDia, unidad: "planta",
      semanal: totalDia * 7, minutosGoteo: 0, segManguera: 0,
      ec: c.ec[e.i], ph: c.ph, volumen: vol,
    };
    // Solución: se prepara al empezar la etapa y se cambia cada ~14 días
    const conc = c.conc[e.i];
    const dias = Math.max(1, Math.round((e.hasta - e.desde) / DIA));
    const n = Math.max(1, Math.round(dias / 14));
    const ap = { n, cada: n > 1 ? Math.round(dias / n) : 0 };
    const fechasAp = Array.from({ length: n }, (_, k) => sumarDias(e.desde, k * ap.cada));
    // g por cambio de solución (todo el estanque). Se guarda como g "por planta" para reutilizar la vista.
    const prod = RECETA_HIDRO.map((r) => ({ id: r.nombre, nombre: `${r.nombre} (estanque ${r.tanque})`, tanque: r.tanque,
      g: (r.g * vol / 1000) * conc * n / cfg.plantas, gTotal: (r.g * vol / 1000) * conc }));
    const nut = { nutr: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 }, prod, org: [], conc };
    return { ...e, riego, nut, ap, fechasAp, micro: [], actual: hoy >= e.desde && hoy < e.hasta };
  });
  const inicio = out[0].desde, fin = out[out.length - 1].hasta;
  let ahora;
  if (hoy < inicio) ahora = { tipo: "antes", dias: Math.round((inicio - hoy) / DIA) };
  else if (hoy >= fin) ahora = { tipo: "fin" };
  else ahora = { tipo: "etapa", etapa: out.find((e) => e.actual), dia: Math.round((hoy - inicio) / DIA) };
  const zona = ZONAS[cfg.zona] || ZONAS.valle;
  const plan = { c, cfg, clima, etapas: out, ahora, inicio, fin, zona, sol, riesgoHongos: zona.hongos || sol.hongos,
    necesidad: { N: 0, P: 0, K: 0, Ca: 0, Mg: 0 }, mult: cfg.plantas, ph: null, edadF: 1, hidro: true, volumen: vol };
  plan.puesta = puestaAlDia(plan);
  return plan;
}

// Riego de esta semana con el pronóstico real
function riegoPronostico(plan, pron) {
  const e = plan.ahora.etapa;
  if (!e || !pron || plan.hidro) return null;
  const d = pron.dias.slice(0, 7);
  const et0 = d.reduce((s, x) => s + x.et0, 0) / d.length;
  const lluviaEf = d.reduce((s, x) => s + (x.lluvia > 2 ? x.lluvia * 0.8 : 0), 0) / d.length;
  const r = riegoEtapa(plan.cfg, plan.c, e, plan.clima, { et0, lluviaEf });
  const lluviaPronto = d.slice(0, 2).reduce((s, x) => s + x.lluvia, 0);
  return { ...r, lluviaSemana: d.reduce((s, x) => s + x.lluvia, 0), lluviaPronto };
}
