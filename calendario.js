// =====================================================================
//  Calendario: eventos del plan, ajustes del usuario, tareas propias,
//  ocurrencias (riegos repetidos), exportación .ics y datos para Google Calendar
// =====================================================================
const Calendario = (() => {
  const DIA_MS = 86400000;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const deIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const r1 = (x) => (Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
  const peso = (g) => (g >= 1000 ? `${r1(g / 1000)} kg` : `${r1(g)} g`);
  const litros = (l) => (l >= 1000 ? `${r1(l / 1000)} m³` : `${r1(l)} L`);
  const tiempo = (min) => (min >= 90 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.max(1, Math.round(min))} min`);

  const TIPOS = {
    etapa:  { nombre: "Etapas",          icono: "🌱" },
    riego:  { nombre: "Riego",           icono: "💧" },
    abono:  { nombre: "Abono",           icono: "🧪" },
    foliar: { nombre: "Foliares",        icono: "🔬" },
    propio: { nombre: "Mis tareas",      icono: "📌" },
  };

  const datos = (cfg) => {
    if (!cfg.calendario) cfg.calendario = {};
    const k = cfg.calendario;
    k.ajustes = k.ajustes || {}; k.propios = k.propios || [];
    return k;
  };

  // Eventos generados por el plan (sin ajustes)
  function base(plan) {
    const { c, cfg } = plan;
    const ev = [];
    const nombre = c.nombre;
    const mult = plan.mult, u = c.perenne ? "planta" : "m²";
    plan.etapas.forEach((e) => {
      const i = e.i;
      const titulo = !c.perenne && i === 0 ? `${c.emoji} Plantar ${nombre}` : `${c.emoji} ${nombre}: ${e.nombre}`;
      ev.push({ key: `etapa-${i}`, tipo: "etapa", titulo, fecha: e.desde,
        nota: `Etapa: ${e.nombre} (hasta el ${e.hasta.getDate()}/${e.hasta.getMonth() + 1}).\n` + e.tareas.map((t) => "• " + t).join("\n") });

      const r = e.riego;
      if (r.hidro) {
        ev.push({ key: `riego-${i}`, tipo: "riego", titulo: `💧 ${nombre}: reponer agua y medir EC/pH`, fecha: e.desde, hasta: mas(e.hasta, -1), cada: r.cada,
          nota: `Reponer ≈ ${litros(r.total)} de agua (${litros(r.totalDia)} al día).\nEC objetivo ${r.ec[0]}–${r.ec[1]} mS/cm · pH ${r.ph[0]}–${r.ph[1]}.\nSi la EC sube, agrega agua sola; si baja, agrega solución.` });
      } else if (r.cada) {
        let como = `${litros(r.porPlanta)} por planta`;
        if (cfg.metodo === "goteo") como += ` (goteo ${tiempo(r.minutosGoteo)})`;
        else if (!c.perenne) como += ` · ${r1(r.brutaMm)} L/m²`;
        ev.push({ key: `riego-${i}`, tipo: "riego", titulo: `💧 Regar ${nombre}`, fecha: e.desde, hasta: mas(e.hasta, -1), cada: r.cada,
          nota: `${como}. Total: ${litros(r.total)} por riego.\nSi llovió o el suelo está húmedo a 5 cm, espera un día.` });
      }

      const n = e.ap.n;
      if (c.hidro) {
        const det = `Solución al ${Math.round(e.nut.conc * 100)}% para ${litros(plan.volumen)}:\n` +
          e.nut.prod.map((x) => `• ${x.nombre}: ${peso(x.gTotal)}`).join("\n") + `\nEC objetivo ${r.ec[0]}–${r.ec[1]} · pH ${r.ph[0]}–${r.ph[1]}.`;
        e.fechasAp.forEach((f, k) => ev.push({ key: `abono-${i}-${k}`, tipo: "abono",
          titulo: `🧪 ${nombre}: ${k === 0 ? "preparar" : "cambiar"} solución nutritiva`, fecha: f, nota: det }));
      } else if (e.nut.prod.length) {
        const det = e.nut.prod.map((x) => `• ${x.nombre}: ${peso(x.g / n)}/${u} → ${peso((x.g / n) * mult)} en total`).join("\n");
        e.fechasAp.forEach((f, k) => ev.push({ key: `abono-${i}-${k}`, tipo: "abono",
          titulo: !c.perenne && i === 0 ? `🧪 Abonado de base ${nombre}` : `🧪 Abonar ${nombre}${n > 1 ? ` (${k + 1}/${n})` : ""}`,
          fecha: f, nota: det }));
      }
      if (e.micro.length) {
        const L = c.perenne ? Math.max(0.5, c.areaPlanta * plan.edadF * 0.3) * cfg.plantas : Math.max(1, cfg.area * 0.1);
        const det = e.micro.map((m) => `• ${m.nombre}: ${m.producto}, ${m.gL} g/L → ${peso(m.gL * L)} en ${r1(L)} L de agua`).join("\n") +
          "\nPulverizar al atardecer, mojando ambos lados de las hojas.";
        const dias = Math.round((e.hasta - e.desde) / DIA_MS);
        const fechas = [mas(e.desde, Math.min(3, dias - 1))];
        if (dias > 25) fechas.push(mas(e.desde, 17));
        fechas.forEach((f, k) => ev.push({ key: `foliar-${i}-${k}`, tipo: "foliar",
          titulo: `🔬 Foliar ${nombre}: ${e.micro.map((m) => m.nombre.split(" (")[0]).join(", ")}`, fecha: f, nota: det }));
      }
    });
    // Variedad de palto: aviso de inicio de cosecha
    if (plan.variedad) {
      const v = plan.variedad, desfase = cfg.lat > 0 ? 6 : 0;
      let f = new Date(plan.inicio.getFullYear(), (v.cosecha[0] - 1 + desfase) % 12, 1);
      if (f < plan.inicio) f = new Date(f.getFullYear() + 1, f.getMonth(), 1);
      ev.push({ key: "cosecha-var", tipo: "etapa", titulo: `${c.emoji} Inicia cosecha de palta ${v.nombre}`, fecha: f,
        nota: `Temporada de cosecha aproximada de ${v.nombre}. Cosecha cuando la fruta alcance su madurez (materia seca); madura fuera del árbol.` });
    }
    return ev;
  }

  // Eventos con los cambios del usuario + tareas propias
  function eventos(plan, incluirOcultos) {
    const cal = datos(plan.cfg);
    const out = base(plan).map((e) => {
      const a = cal.ajustes[e.key] || {};
      return { ...e, original: { titulo: e.titulo, fecha: e.fecha, nota: e.nota, cada: e.cada, hasta: e.hasta },
        titulo: a.titulo ?? e.titulo, nota: a.nota ?? e.nota,
        fecha: a.fecha ? deIso(a.fecha) : e.fecha,
        cada: a.cada ?? e.cada, hasta: a.hasta ? deIso(a.hasta) : e.hasta,
        oculto: !!a.oculto, hecho: !!a.hecho, editado: !!(a.titulo || a.nota || a.fecha || a.cada || a.hasta) };
    });
    for (const p of cal.propios) {
      out.push({ key: `propio-${p.id}`, tipo: "propio", propio: true, id: p.id, titulo: p.titulo, nota: p.nota || "",
        fecha: deIso(p.fecha), cada: p.cada || null, hasta: p.hasta ? deIso(p.hasta) : null, hecho: !!p.hecho, oculto: false });
    }
    out.sort((a, b) => a.fecha - b.fecha);
    return incluirOcultos ? out : out.filter((e) => !e.oculto);
  }

  // Fechas concretas entre dos días (expande los repetidos)
  function ocurrencias(cfg, evs, desde, hasta) {
    const cal = datos(cfg);
    const res = [];
    for (const e of evs) {
      if (e.cada) {
        const fin = e.hasta && e.hasta < hasta ? e.hasta : hasta;
        let f = e.fecha;
        if (f < desde) { const saltos = Math.ceil((desde - f) / DIA_MS / e.cada); f = mas(f, saltos * e.cada); }
        for (; f <= fin; f = mas(f, e.cada)) {
          const k = `${e.key}@${iso(f)}`;
          res.push({ ev: e, fecha: f, okey: k, hecho: !!(cal.ajustes[k] && cal.ajustes[k].hecho) });
        }
      } else if (e.fecha >= desde && e.fecha <= hasta) {
        res.push({ ev: e, fecha: e.fecha, okey: e.key, hecho: e.hecho });
      }
    }
    return res.sort((a, b) => a.fecha - b.fecha);
  }

  // Siguiente fecha (hoy o después) de un evento
  function proxima(e, hoy) {
    if (!e.cada || e.fecha >= hoy) return e.fecha;
    const f = mas(e.fecha, Math.ceil((hoy - e.fecha) / DIA_MS / e.cada) * e.cada);
    return e.hasta && f > e.hasta ? null : f;
  }

  // ----- modificar -----
  function ajustar(cfg, key, cambios) {
    const cal = datos(cfg);
    if (key.startsWith("propio-") && !key.includes("@")) {
      const p = cal.propios.find((x) => `propio-${x.id}` === key);
      if (p) Object.assign(p, cambios);
      return;
    }
    const a = { ...(cal.ajustes[key] || {}), ...cambios };
    for (const k of Object.keys(a)) if (a[k] === undefined || a[k] === null || a[k] === "" || a[k] === false) delete a[k];
    if (Object.keys(a).length) cal.ajustes[key] = a; else delete cal.ajustes[key];
  }
  function restablecer(cfg, key) { delete datos(cfg).ajustes[key]; }
  function agregarPropio(cfg, p) { datos(cfg).propios.push({ id: Date.now().toString(36), ...p }); }
  function borrarPropio(cfg, id) { const cal = datos(cfg); cal.propios = cal.propios.filter((x) => x.id !== id); }

  // ----- exportar -----
  const dosDig = (n) => String(n).padStart(2, "0");
  const icsFecha = (d, hora) => `${d.getFullYear()}${dosDig(d.getMonth() + 1)}${dosDig(d.getDate())}T${hora.replace(":", "")}00`;
  const icsTexto = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const plegar = (l) => { const o = []; while (l.length > 74) { o.push(l.slice(0, 74)); l = " " + l.slice(74); } o.push(l); return o.join("\r\n"); };

  function filtrar(evs, tipos) { return evs.filter((e) => !tipos || tipos.includes(e.tipo)); }

  function ics(planes, opciones) {
    const { hora = "08:00", aviso = 0, tipos } = opciones || {};
    const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mi Huerta//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Mi Huerta"];
    for (const plan of planes) {
      for (const e of filtrar(eventos(plan), tipos)) {
        L.push("BEGIN:VEVENT", `UID:${e.key}-${plan.cfg.id || "x"}@mihuerta`, `DTSTAMP:${ahora}`,
          `DTSTART:${icsFecha(e.fecha, hora)}`, "DURATION:PT30M",
          plegar(`SUMMARY:${icsTexto(e.titulo)}`), plegar(`DESCRIPTION:${icsTexto(e.nota || "")}`));
        if (e.cada) L.push(`RRULE:FREQ=DAILY;INTERVAL=${e.cada}${e.hasta ? `;UNTIL=${icsFecha(e.hasta, "23:59")}` : ""}`);
        L.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${aviso}M`, "DESCRIPTION:Mi Huerta", "END:VALARM", "END:VEVENT");
      }
    }
    L.push("END:VCALENDAR");
    return L.join("\r\n");
  }

  // Eventos para escribir en el calendario del teléfono
  function paraTelefono(plan, opciones) {
    const { hora = "08:00", tipos } = opciones || {};
    const [h, m] = hora.split(":").map(Number);
    const lugar = plan.cfg.lugar ? ` · ${plan.cfg.lugar}` : "";
    return filtrar(eventos(plan), tipos).map((e) => {
      const ini = new Date(e.fecha.getFullYear(), e.fecha.getMonth(), e.fecha.getDate(), h, m);
      let rrule = "";
      if (e.cada) {
        const u = e.hasta ? new Date(e.hasta.getFullYear(), e.hasta.getMonth(), e.hasta.getDate(), 23, 59) : null;
        rrule = `FREQ=DAILY;INTERVAL=${e.cada}` + (u ? `;UNTIL=${u.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z` : "");
      }
      return { key: e.key, titulo: e.titulo, desc: `${e.nota || ""}\n\n— Mi Huerta${lugar}`, inicio: ini.getTime(), durMin: 30, rrule };
    });
  }

  return { TIPOS, eventos, ocurrencias, proxima, ajustar, restablecer, agregarPropio, borrarPropio, ics, paraTelefono, iso, deIso };
})();
