(() => {
// ---------- utilidades ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const KEY = "mihuerta.cultivos";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmt = (d) => `${d.getDate()} ${MESES[d.getMonth()]}`;
const fmtAnio = (d) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
const r1 = (x) => (Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
const peso = (g) => (g >= 1000 ? `${r1(g / 1000)} kg` : `${r1(g)} g`);
const litros = (l) => (l >= 1000 ? `${r1(l / 1000)} m³` : `${r1(l)} L`);
const tiempo = (min) => (min >= 90 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.max(1, Math.round(min))} min`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function toast(msg, ms = 3000) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}

// ---------- datos guardados ----------
const cargar = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
function guardarTodo(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
  Respaldo.sincronizar(lista);
}
function fusionar(nuevos) {
  const lista = cargar();
  let n = 0;
  for (const c of nuevos) {
    const i = lista.findIndex((x) => x.id === c.id);
    if (i >= 0) lista[i] = c; else { lista.push(c); n++; }
  }
  guardarTodo(lista);
  return n;
}
// Datos de la versión 1 (se recuperan una sola vez)
try {
  if (nativo() && Android.datosMigrados) {
    const viejo = Android.datosMigrados();
    if (viejo) {
      const arr = JSON.parse(viejo).map((c) => ({ modoClima: "manual", metodo: "manguera", ...c }));
      if (arr.length) fusionar(arr);
      Android.limpiarMigracion();
    }
  }
} catch {}

// ---------- navegación ----------
let cfgActual = null, tabActual = "resumen", pron = null, pronKey = "";

function mostrar(v) {
  ["inicio", "form", "plan"].forEach((x) => $(`#v-${x}`).classList.toggle("hidden", x !== v));
  $("#btn-back").classList.toggle("hidden", v === "inicio");
  window.scrollTo(0, 0);
}
function router() {
  const h = location.hash;
  if (h === "#nuevo" || h === "#editar") { $("#titulo").textContent = h === "#nuevo" ? "Nuevo cultivo" : "Editar cultivo"; mostrar("form"); setTimeout(refrescarMapa, 60); }
  else if (h === "#plan" && cfgActual) { $("#titulo").textContent = "Mi plan"; renderPlan(); mostrar("plan"); }
  else { $("#titulo").textContent = "🌱 Mi Huerta"; renderInicio(); mostrar("inicio"); }
}

// =====================================================================
//  INICIO
// =====================================================================
function renderInicio() {
  const lista = cargar();
  $("#lista").innerHTML = !lista.length
    ? `<div class="vacio">Aún no tienes cultivos guardados.<br>Toca <b>＋ Nuevo cultivo</b> para empezar.</div>`
    : lista.map((cfg) => {
      const p = calcularPlan(cfg);
      let estado;
      if (p.ahora.tipo === "antes") estado = `Faltan ${p.ahora.dias} días para plantar`;
      else if (p.ahora.tipo === "fin") estado = "Ciclo terminado";
      else {
        const e = p.ahora.etapa;
        estado = `${e.icono} ${e.nombre} · ${e.riego.cada ? `regar cada ${e.riego.cada} días` : "sin riego (lluvia)"}`;
      }
      const cant = p.c.perenne ? `${cfg.plantas} planta${cfg.plantas > 1 ? "s" : ""}` : `${cfg.area} m²`;
      return `<div class="card item" data-id="${cfg.id}">
        <span class="e">${p.c.emoji}</span>
        <div><div class="t">${esc(p.c.nombre)} · ${esc(cfg.lugar || "Sin lugar")}</div>
        <div class="s">${estado}<br>${cant}</div></div></div>`;
    }).join("");
  $$("#lista .item").forEach((el) => el.onclick = () => {
    cfgActual = cargar().find((x) => x.id === el.dataset.id); tabActual = "resumen"; location.hash = "#plan";
  });
  renderRespaldo();
  $("#version-txt").innerHTML = `Mi Huerta v${Actualizar.version()} · <a href="#" id="buscar-upd">Buscar actualizaciones</a>`;
  $("#buscar-upd").onclick = (ev) => { ev.preventDefault(); revisarVersion(true); };
}

function renderRespaldo() {
  const est = Respaldo.estado();
  const box = $("#respaldo-card");
  if (nativo()) {
    box.innerHTML = est
      ? `<p>✅ <b>Copia automática activa</b><br><span class="nota">Archivo: ${esc(est)}. Se actualiza sola cada vez que guardas o borras un cultivo.</span></p>
         <div class="row2"><button class="btn-sec" id="rs-ahora">🔄 Copiar ahora</button><button class="btn-sec" id="rs-rest">📥 Restaurar</button></div>
         <button class="btn-link" id="rs-off">Desactivar copia automática</button>`
      : `<p>Guarda tus cultivos en <b>Google Drive</b>. Si borras la app o cambias de celular, los recuperas con "Restaurar".</p>
         <button class="btn-big" id="rs-crear">☁️ Activar copia en Google Drive</button>
         <button class="btn-sec full mt" id="rs-rest">📥 Restaurar desde una copia</button>
         <p class="nota mt">Al activar, elige <b>Drive</b> en el menú de la izquierda y toca <b>Guardar</b>.</p>`;
  } else {
    box.innerHTML = `<p>Descarga una copia de tus cultivos y guárdala en Google Drive. Puedes restaurarla en cualquier equipo.</p>
      <div class="row2"><button class="btn-sec" id="rs-crear">⬇️ Descargar copia</button><button class="btn-sec" id="rs-rest">📥 Restaurar</button></div>`;
  }
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on("#rs-crear", () => Respaldo.crear(cargar()));
  on("#rs-ahora", () => { Respaldo.sincronizar(cargar()); toast("Copia actualizada ☁️"); });
  on("#rs-off", () => { if (confirm("¿Desactivar la copia automática? El archivo en Drive no se borra.")) { Respaldo.desactivar(); renderRespaldo(); } });
  on("#rs-rest", () => Respaldo.restaurar((err, cultivos) => {
    if (err) return toast("❌ " + err.message, 4000);
    const n = fusionar(cultivos);
    toast(`✅ Copia restaurada: ${cultivos.length} cultivos (${n} nuevos)`, 4000);
    renderInicio();
  }));
}
// Llamadas desde Android
window.alCopiaCreada = (nombre) => { toast("✅ Copia automática activada en " + nombre, 4000); renderRespaldo(); };
window.alErrorCopia = (msg) => toast("❌ " + msg, 4000);

async function revisarVersion(forzar) {
  const box = $("#aviso-update");
  try {
    const v = await Actualizar.buscar(forzar);
    if (v) {
      box.innerHTML = `<b>🆕 Nueva versión ${esc(v.version)} disponible</b>
        ${v.notas ? `<p class="nota">${esc(v.notas).slice(0, 300).replace(/\n/g, "<br>")}</p>` : ""}
        <button class="btn-big" id="upd-ir">⬇️ Descargar e instalar</button>
        <p class="nota">Al terminar la descarga, abre el archivo y toca "Actualizar". Tus datos se mantienen.</p>`;
      box.classList.remove("hidden");
      $("#upd-ir").onclick = () => Actualizar.abrir(v.url);
    } else {
      box.classList.add("hidden");
      if (forzar) toast("✅ Tienes la última versión");
    }
  } catch (e) { if (forzar) toast("Sin conexión para revisar actualizaciones"); }
}

// =====================================================================
//  FORMULARIO
// =====================================================================
const form = {};
function formVacio() {
  Object.assign(form, { editId: null, cultivo: null, cat: "todas", sol: "sol", suelo: "franco", metodo: "manguera",
    modoClima: "auto", lat: null, lon: null, climaLoc: null });
}

function prepararForm(cfg) {
  formVacio();
  $("#f-buscar").value = ""; $("#f-lugar").value = ""; $("#f-area").value = 10; $("#f-plantas").value = 1;
  $("#f-fecha").value = hoyISO(); $("#f-zona").value = "valle"; $("#f-edad").value = "adulta";
  $("#f-ph").value = ""; $("#f-mulch").checked = false; $("#f-goteros").value = ""; $("#f-caudal").value = "";
  $("#ubic-estado").textContent = ""; $("#mapa-box").classList.add("hidden");
  if (cfg) {
    Object.assign(form, { editId: cfg.id, cultivo: cfg.cultivo, sol: cfg.sol, suelo: cfg.suelo, metodo: cfg.metodo || "manguera",
      modoClima: cfg.modoClima || "manual", lat: cfg.lat ?? null, lon: cfg.lon ?? null, climaLoc: cfg.climaLoc || null });
    $("#f-lugar").value = cfg.lugar || ""; $("#f-zona").value = cfg.zona;
    if (cfg.area) $("#f-area").value = cfg.area;
    if (cfg.fecha) $("#f-fecha").value = cfg.fecha;
    if (cfg.plantas) $("#f-plantas").value = cfg.plantas;
    if (cfg.edad) $("#f-edad").value = cfg.edad;
    if (cfg.ph) $("#f-ph").value = cfg.ph;
    $("#f-mulch").checked = !!cfg.mulch;
    if (cfg.goteros) $("#f-goteros").value = cfg.goteros;
    if (cfg.caudal) $("#f-caudal").value = cfg.caudal;
    if (form.lat != null) $("#ubic-estado").textContent = `📍 ${form.lat.toFixed(4)}, ${form.lon.toFixed(4)}`;
  }
  $("#f-error").classList.add("hidden");
  pintarTodo();
}

function pintarTodo() { pintarCats(); pintarCultivos(); pintarOpciones(); pintarModo(); }

function pintarCats() {
  $("#f-cats").innerHTML = Object.entries(CATEGORIAS).map(([k, v]) =>
    `<button type="button" class="${form.cat === k ? "sel" : ""}" data-k="${k}">${v}</button>`).join("");
  $$("#f-cats button").forEach((b) => b.onclick = () => { form.cat = b.dataset.k; pintarCats(); pintarCultivos(); });
}

function pintarCultivos() {
  const q = norm($("#f-buscar").value.trim());
  const lista = CULTIVOS.filter((c) => (form.cat === "todas" || c.cat === form.cat) && (!q || norm(c.nombre).includes(q)));
  $("#f-cultivos").innerHTML = lista.length
    ? lista.map((c) => `<div class="chip ${form.cultivo === c.id ? "sel" : ""}" data-id="${c.id}"><span class="e">${c.emoji}</span>${c.nombre}</div>`).join("")
    : `<div class="nota" style="grid-column:1/-1">Ese cultivo aún no está en la app.</div>`;
  $$("#f-cultivos .chip").forEach((el) => el.onclick = () => { form.cultivo = el.dataset.id; pintarCultivos(); });
  const c = form.cultivo && cultivoPorId(form.cultivo);
  const per = !!(c && c.perenne);
  $("#anual-box").classList.toggle("hidden", per);
  $("#perenne-box").classList.toggle("hidden", !per);
}

function opciones(sel, dic, actual, alElegir) {
  $(sel).innerHTML = Object.entries(dic).map(([k, v]) =>
    `<button type="button" class="opt ${actual === k ? "sel" : ""}" data-k="${k}"><span class="e">${v.icono}</span>${v.nombre}</button>`).join("");
  $$(`${sel} .opt`).forEach((b) => b.onclick = () => alElegir(b.dataset.k));
}
function pintarOpciones() {
  opciones("#f-sol", SOL, form.sol, (k) => { form.sol = k; pintarOpciones(); });
  opciones("#f-suelo", SUELOS, form.suelo, (k) => { form.suelo = k; pintarOpciones(); });
  opciones("#f-metodo", METODOS, form.metodo, (k) => { form.metodo = k; pintarOpciones(); });
  $("#goteo-box").classList.toggle("hidden", form.metodo !== "goteo");
}

function pintarModo() {
  $("#f-modo").innerHTML = `<button type="button" data-k="auto" class="${form.modoClima === "auto" ? "sel" : ""}">🛰️ Automático</button>
    <button type="button" data-k="manual" class="${form.modoClima === "manual" ? "sel" : ""}">✋ Manual</button>`;
  $$("#f-modo button").forEach((b) => b.onclick = () => { form.modoClima = b.dataset.k; pintarModo(); });
  const auto = form.modoClima === "auto";
  $("#f-zona").disabled = auto && !!form.climaLoc;
  const info = $("#clima-info");
  if (auto && form.climaLoc) {
    const k = form.climaLoc;
    info.innerHTML = `<b>Clima real de tu ubicación (${k.anio}):</b><br>
      🌡️ Media ${k.tMedia} °C · mín ${k.tMin} °C · máx ${k.tMax} °C<br>
      ❄️ ${k.heladas} días con helada · 🌧️ ${k.lluviaAnual} mm/año<br>
      💧 Humedad ${k.humedad}% · ☁️ Nubosidad ${k.nubes}% · ⛰️ ${k.elevacion} m<br>
      ➜ Zona: <b>${ZONAS[k.zona].nombre}</b> · Sol: <b>${SOL[k.sol].nombre}</b>
      <div class="nota">El riego se calcula con la evaporación real de tu lugar. Si tu sector tiene sombra, cambia el sol abajo.</div>`;
    info.classList.remove("hidden");
  } else if (auto) {
    info.innerHTML = `Toca <b>📍 Mi ubicación</b> o <b>🗺️ Elegir en mapa</b> para detectar el clima y la zona. Mientras, puedes elegir la zona:`;
    info.classList.remove("hidden");
  } else {
    info.innerHTML = `Elige tu zona. El riego se calcula con valores típicos de esa zona.`;
    info.classList.remove("hidden");
  }
}

async function setUbicacion(lat, lon) {
  form.lat = lat; form.lon = lon;
  const est = $("#ubic-estado");
  est.textContent = `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)} — buscando nombre y clima…`;
  const [lugar, clima] = await Promise.allSettled([Clima.nombreLugar(lat, lon), Clima.climaUbicacion(lat, lon)]);
  if (form.lat !== lat) return; // el usuario eligió otro punto
  const nom = lugar.status === "fulfilled" ? lugar.value : { corto: "", largo: "" };
  if (nom.corto && !$("#f-lugar").value.trim()) $("#f-lugar").value = nom.corto;
  est.textContent = `📍 ${nom.largo || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}`;
  if (clima.status === "fulfilled") {
    form.climaLoc = clima.value;
    if (form.modoClima === "auto") {
      $("#f-zona").value = clima.value.zona; form.sol = clima.value.sol; pintarOpciones();
    }
    toast("✅ Zona y clima detectados");
  } else {
    form.climaLoc = null; form.modoClima = "manual";
    toast("Sin conexión para el clima: elige la zona a mano", 4000);
  }
  pintarModo();
}

$("#btn-gps").onclick = async () => {
  $("#ubic-estado").textContent = "📍 Buscando tu ubicación…";
  try {
    const p = await Clima.gps();
    Clima.centrar(p.lat, p.lon);
    setUbicacion(p.lat, p.lon);
  } catch (e) { $("#ubic-estado").textContent = "❌ " + e.message + " Usa el mapa o elige la zona a mano."; }
};
$("#btn-mapa").onclick = () => {
  const box = $("#mapa-box");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) refrescarMapa();
};
function refrescarMapa() {
  if ($("#mapa-box").classList.contains("hidden")) return;
  try {
    Clima.abrirMapa($("#mapa"), form.lat != null ? { lat: form.lat, lon: form.lon } : null, (lat, lon) => setUbicacion(lat, lon));
  } catch (e) { $("#mapa").innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
}
async function buscarEnMapa() {
  const q = $("#mapa-q").value.trim(); if (!q) return;
  const res = $("#mapa-res");
  res.innerHTML = `<div class="nota">Buscando…</div>`;
  try {
    const r = await Clima.buscar(q);
    res.innerHTML = r.length ? r.map((x, i) => `<div class="res" data-i="${i}">📍 ${esc(x.nombre)}</div>`).join("") : `<div class="nota">Sin resultados.</div>`;
    $$("#mapa-res .res").forEach((el) => el.onclick = () => {
      const x = r[+el.dataset.i]; res.innerHTML = ""; Clima.centrar(x.lat, x.lon); setUbicacion(x.lat, x.lon);
    });
  } catch { res.innerHTML = `<div class="nota">Sin conexión.</div>`; }
}
$("#mapa-ir").onclick = buscarEnMapa;
$("#mapa-q").onkeydown = (e) => { if (e.key === "Enter") buscarEnMapa(); };

function verPlan() {
  const err = (m) => { $("#f-error").textContent = m; $("#f-error").classList.remove("hidden"); };
  if (!form.cultivo) return err("Elige un cultivo.");
  const c = cultivoPorId(form.cultivo);
  const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) && v > 0 ? v : null; };
  const cfg = {
    id: form.editId, cultivo: form.cultivo, lugar: $("#f-lugar").value.trim(),
    lat: form.lat, lon: form.lon, climaLoc: form.climaLoc,
    modoClima: form.modoClima === "auto" && form.climaLoc ? "auto" : "manual",
    zona: $("#f-zona").value, sol: form.sol, suelo: form.suelo, ph: num("#f-ph"), mulch: $("#f-mulch").checked,
    metodo: form.metodo, goteros: num("#f-goteros"), caudal: num("#f-caudal"),
  };
  if (c.perenne) {
    cfg.plantas = Math.round(num("#f-plantas") || 0); cfg.edad = $("#f-edad").value;
    if (!cfg.plantas) return err("Escribe cuántas plantas tienes.");
  } else {
    cfg.area = num("#f-area"); cfg.fecha = $("#f-fecha").value;
    if (!cfg.area) return err("Escribe la superficie en m².");
    if (!cfg.fecha) return err("Elige la fecha de plantación.");
  }
  if (cfg.ph && (cfg.ph < 3 || cfg.ph > 10)) return err("El pH debe estar entre 3 y 10.");
  cfgActual = cfg; tabActual = "resumen";
  if (cfg.id) guardarCfg(cfg, false);
  location.hash = "#plan";
}

// =====================================================================
//  PLAN
// =====================================================================
function renderPlan() {
  const cfg = cfgActual;
  // Pronóstico (si hay ubicación e internet)
  const k = cfg.lat != null ? `${cfg.lat.toFixed(2)},${cfg.lon.toFixed(2)}` : "";
  if (k !== pronKey) {
    pronKey = k; pron = null;
    if (k) Clima.pronostico(cfg.lat, cfg.lon).then((v) => { if (pronKey === k) { pron = v; if (location.hash === "#plan") renderPlan(); } }).catch(() => {});
  }
  const p = calcularPlan(cfg);
  const cant = p.c.perenne ? `${cfg.plantas} planta(s) · ${EDADES[cfg.edad].nombre.toLowerCase()}` : `${cfg.area} m² · plantado el ${fmtAnio(p.inicio)}`;
  const clima = cfg.modoClima === "auto" ? "🛰️ clima automático" : `✋ ${p.zona.nombre}`;
  $("#p-head").innerHTML = `<span class="e">${p.c.emoji}</span><div>
    <div class="t">${esc(p.c.nombre)}${cfg.lugar ? " · " + esc(cfg.lugar) : ""}</div>
    <div class="s">${p.sol.icono} ${p.sol.nombre} · ${clima}<br>${cant}</div></div>`;
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabActual));
  $("#p-body").innerHTML = { resumen: tabResumen, riego: tabRiego, nutricion: tabNutricion, plagas: tabPlagas }[tabActual](p);
  $("#btn-guardar").classList.toggle("hidden", !!cfg.id);
  $("#btn-editar").classList.toggle("hidden", !cfg.id);
  $("#btn-borrar").classList.toggle("hidden", !cfg.id);
  $$("#p-body [data-ir]").forEach((b) => b.onclick = (ev) => { ev.preventDefault(); tabActual = b.dataset.ir; renderPlan(); window.scrollTo(0, 0); });
}

const unidad = (p) => (p.c.perenne ? "planta" : "m²");

function lineaRiego(p, r) {
  if (!r.cada) return `🌧️ <b>No hace falta regar</b>: la lluvia cubre lo que consume la planta.`;
  const met = p.cfg.metodo;
  let como = "";
  if (met === "goteo") como = ` → abre el goteo <b>${tiempo(r.minutosGoteo)}</b>`;
  else if (met === "manguera") como = ` → ≈ <b>${r.segManguera >= 90 ? tiempo(r.segManguera / 60) : Math.max(1, Math.round(r.segManguera)) + " s"}</b> de manguera por planta`;
  return `💧 Regar cada <b>${r.cada} día${r.cada > 1 ? "s" : ""}</b>: <b>${litros(r.porPlanta)}</b> por planta${p.c.perenne ? "" : ` (${r1(r.brutaMm)} L/m²)`}${como}`;
}

function cardAhora(p) {
  if (p.ahora.tipo === "antes") return `<div class="card ahora"><h3>📅 Faltan ${p.ahora.dias} días para plantar</h3>Prepara el suelo: compost, abono de base${p.ph && p.ph.tipo !== "ok" ? " y corrección de pH" : ""} (ver Nutrición).</div>`;
  if (p.ahora.tipo === "fin") return `<div class="card ahora"><h3>✅ Ciclo terminado</h3>Retira los restos, agrega compost y cambia de cultivo en este lugar (rotación).</div>`;
  const e = p.ahora.etapa;
  const rp = riegoPronostico(p, pron);
  const r = rp || e.riego;
  let lluviaTxt = "";
  if (rp && rp.lluviaPronto >= 5) lluviaTxt = `<li>🌧️ <b>Se esperan ${r1(rp.lluviaPronto)} mm de lluvia en 48 h: no riegues hoy.</b></li>`;
  const fertHoy = e.nut.prod.length ? `<li>🧪 Abonar ${e.ap.n > 1 ? `cada ${e.ap.cada} días` : "1 vez"}: ${e.nut.prod.map((x) => x.nombre.split(" (")[0]).join(", ")} <a href="#" data-ir="nutricion" class="lnk">ver dosis</a></li>` : "";
  const micro = e.micro.length ? `<li>🔬 Foliar: ${e.micro.map((m) => m.nombre).join(", ")}</li>` : "";
  return `<div class="card ahora"><h3>${e.icono} Ahora: ${e.nombre}</h3>
    ${p.ahora.dia != null ? `Día ${p.ahora.dia} desde la plantación` : "Etapa del año"} (hasta el ${fmt(e.hasta)}).
    <ul class="tareas">${lluviaTxt}<li>${lineaRiego(p, r)}${rp ? ' <span class="badge azul">según pronóstico</span>' : ""}</li>
    ${fertHoy}${micro}${e.tareas.map((t) => `<li>${t}</li>`).join("")}</ul></div>`;
}

function cardPronostico(p) {
  if (p.cfg.lat == null) return "";
  if (!pron) return `<div class="card"><h3>🌦️ Pronóstico</h3><span class="nota">Cargando… (necesita internet)</span></div>`;
  const al = [];
  const helada = pron.dias.find((d) => d.min <= 1);
  if (helada) al.push(`❄️ <b>Riesgo de helada</b> el ${diaTxt(helada.fecha)} (${r1(helada.min)} °C): cubre las plantas con manta térmica y riega el día antes.`);
  const calor = pron.dias.find((d) => d.max >= 32);
  if (calor) al.push(`🔥 <b>Calor fuerte</b> el ${diaTxt(calor.fecha)} (${r1(calor.max)} °C): riega temprano y revisa que no se sequen.`);
  const viento = pron.dias.find((d) => d.viento >= 40);
  if (viento) al.push(`💨 <b>Viento fuerte</b> el ${diaTxt(viento.fecha)}: amarra tutores, no apliques productos foliares.`);
  const lluvia = pron.dias.reduce((s, d) => s + d.lluvia, 0);
  if (lluvia >= 10 && p.riesgoHongos) al.push(`🍄 Con ${r1(lluvia)} mm de lluvia esta semana sube el riesgo de hongos: revisa las hojas.`);
  return `<div class="card"><h3>🌦️ Pronóstico 7 días <span class="nota">· ahora ${r1(pron.actual.temp)} °C</span></h3>
    <div class="pron">${pron.dias.map((d) => `<div><div class="dn">${diaTxt(d.fecha, true)}</div><div class="ic">${Clima.icono(d.code)}</div>
      <div><b>${Math.round(d.max)}°</b> ${Math.round(d.min)}°</div><div class="ll">${d.lluvia >= 0.5 ? r1(d.lluvia) + " mm" : "&nbsp;"}</div></div>`).join("")}</div>
    ${al.map((a) => `<div class="alerta mt">${a}</div>`).join("")}</div>`;
}
function diaTxt(iso, corto) {
  const d = parseFecha(iso);
  return corto ? DIAS_SEM[d.getDay()] : `${DIAS_SEM[d.getDay()]} ${d.getDate()}`;
}

function alertas(p) {
  const a = [], c = p.c, n = c.nombre.toLowerCase();
  if (p.sol === SOL.nublado && c.necesitaSol) a.push(`☁️ ${c.nombre} necesita sol. Con mucha sombra o nubosidad producirá menos y tardará más.`);
  if (p.riesgoHongos) a.push(`🍄 Lugar húmedo o nublado: más riesgo de hongos. Deja más espacio, riega al pie y temprano, y revisa las hojas cada semana.`);
  const heladas = p.cfg.climaLoc ? p.cfg.climaLoc.heladas > 0 : p.zona.heladas;
  if (heladas && c.temp[0] > -3) a.push(`❄️ Tu zona tiene heladas: ${n} se daña bajo ${c.temp[0] <= 5 ? 0 : c.temp[0]} °C. Planta después de las heladas o cubre con manta térmica.`);
  if (p.ph && p.ph.tipo !== "ok") a.push(`⚗️ Tu pH (${p.cfg.ph}) no es el ideal (${c.ph[0]}–${c.ph[1]}). Revisa la corrección en <a href="#" data-ir="nutricion" class="lnk">Nutrición</a>.`);
  return a.map((t) => `<div class="alerta">${t}</div>`).join("");
}

function tabResumen(p) {
  const c = p.c;
  const t = c.temp;
  const dens = c.perenne ? `Marco: ${c.distancia}` : `${c.distancia} (≈ ${c.plantasM2} plantas/m² → ${Math.round(c.plantasM2 * p.cfg.area)} plantas)`;
  return cardAhora(p) + cardPronostico(p) + alertas(p) + `
  <div class="card"><h3>🌡️ Condiciones óptimas</h3><div class="kv">
    <span class="k">🌡️</span><div><b>Temperatura ideal: ${t[1]}–${t[2]} °C</b><span class="nota">Sufre bajo ${t[0]} °C y sobre ${t[3]} °C</span></div>
    <span class="k">☀️</span><div><b>Luz</b>${c.luz}</div>
    <span class="k">🟫</span><div><b>Suelo (pH ${c.ph[0]}–${c.ph[1]})</b>${c.suelo}</div>
    <span class="k">📏</span><div><b>Distancia</b>${dens}</div>
    <span class="k">📅</span><div><b>Época</b>${c.epoca}</div>
  </div></div>
  <div class="card"><h3>🗓️ Calendario ${c.perenne ? "del año" : "por etapas"}</h3>
    ${p.etapas.map((e) => `<div class="card etapa ${e.actual ? "actual" : ""}">
      <b>${e.icono} ${e.nombre}</b>${e.actual ? '<span class="badge">AHORA</span>' : ""}
      <div class="fechas">${fmt(e.desde)} → ${fmt(e.hasta)}</div>
      <ul class="tareas">${e.tareas.map((x) => `<li>${x}</li>`).join("")}</ul></div>`).join("")}
    ${c.perenne ? "" : `<div class="nota">Cosecha estimada hasta el ${fmtAnio(p.fin)}.</div>`}
  </div>`;
}

// ---------------- RIEGO ----------------
function tabRiego(p) {
  const c = p.c, cfg = p.cfg, met = METODOS[cfg.metodo || "manguera"];
  const rp = p.ahora.etapa ? riegoPronostico(p, pron) : null;
  const fuente = p.clima.fuente === "auto" ? `datos reales de tu ubicación (${cfg.climaLoc.anio})` : `valores típicos de la zona ${p.zona.nombre.toLowerCase()}`;
  let semana = "";
  if (rp) {
    semana = `<div class="card ahora"><h3>📆 Esta semana (pronóstico real)</h3>
      <div class="riego-box">
        <div><div class="n">${rp.cada || "—"}</div><div class="l">regar cada<br>(días)</div></div>
        <div><div class="n">${litros(rp.porPlanta)}</div><div class="l">por planta<br>cada riego</div></div>
        <div><div class="n">${r1(rp.lluviaSemana)} mm</div><div class="l">lluvia<br>esperada</div></div>
      </div>
      <p class="nota">Evaporación ${r1(rp.et0)} mm/día × Kc ${rp.kc} = la planta consume ${r1(rp.etc)} mm/día${rp.lluviaEf > 0 ? `, la lluvia aporta ${r1(rp.lluviaEf)} mm/día` : ""}.</p>
      <p>${lineaRiego(p, rp)}</p></div>`;
  }
  const tot = c.perenne ? `todas tus plantas (${cfg.plantas})` : `tus ${cfg.area} m²`;
  return semana + `
  <div class="card"><h3>📐 Cómo se calcula</h3>
    <p class="nota">Método FAO: <b>agua que consume la planta = evaporación del día (ET0) × coeficiente del cultivo (Kc)</b>, menos la lluvia útil.
    La frecuencia sale de cuánta agua guarda tu suelo (${SUELOS[cfg.suelo].nombre.toLowerCase()}) en la zona de raíces (${Math.round(c.zr * 100)} cm).
    Se suma la pérdida del sistema (${met.nombre.toLowerCase()}, eficiencia ${Math.round(met.ef * 100)}%).${cfg.mulch ? " El mulch ahorra ~20%." : ""}
    Clima: ${fuente}.</p></div>
  ${p.etapas.map((e) => {
    const r = e.riego;
    return `<div class="card etapa ${e.actual ? "actual" : ""}">
      <b>${e.icono} ${e.nombre}</b>${e.actual ? '<span class="badge">AHORA</span>' : ""}
      <div class="fechas">${fmt(e.desde)} → ${fmt(e.hasta)}</div>
      ${r.cada ? `<div class="riego-box">
        <div><div class="n">${r.cada}</div><div class="l">regar cada<br>(días)</div></div>
        <div><div class="n">${litros(r.porPlanta)}</div><div class="l">por planta<br>cada riego</div></div>
        <div><div class="n">${cfg.metodo === "goteo" ? tiempo(r.minutosGoteo) : r1(r.brutaMm) + " mm"}</div><div class="l">${cfg.metodo === "goteo" ? "tiempo de<br>goteo" : "lámina<br>(L/m²)"}</div></div>
      </div>
      <div class="nota mt">Consumo ${r1(r.etc)} mm/día (ET0 ${r1(r.et0)} × Kc ${r.kc})${r.lluviaEf > 0.05 ? ` − lluvia ${r1(r.lluviaEf)} mm/día` : ""}.
      Total para ${tot}: <b>${litros(r.total)}</b> por riego · ${litros(r.semanal * (c.perenne ? c.areaPlanta * p.edadF * cfg.plantas : cfg.area))} por semana.</div>`
      : `<div class="alerta">🌧️ En esta época la lluvia cubre el consumo (${r1(r.etc)} mm/día). Riega solo si pasan más de 10 días sin llover o el suelo está seco a 5 cm.</div>`}
    </div>`;
  }).join("")}
  ${cfg.metodo === "goteo" ? `<div class="card"><h3>💧 Tu goteo</h3><p class="nota">Calculado con ${cfg.goteros || goterosSugeridos(c, cfg)} gotero(s) por planta de ${cfg.caudal || (c.perenne ? 4 : 2)} L/h. Cámbialo en "Editar" si tu equipo es distinto. Si el tiempo es mayor a 2 h, divídelo en dos riegos (mañana y tarde).</p></div>` : ""}
  <div class="card"><h3>✅ Buenas prácticas</h3><ul class="tareas">
    <li>Riega temprano en la mañana o al atardecer, al pie de la planta.</li>
    <li>Prueba del dedo: si a 3–5 cm la tierra está húmeda, espera un día.</li>
    <li><b>Etapas críticas</b> (no dejar sin agua): ${p.etapas.filter((e) => c.kc[e.i] >= Math.max(...c.kc) - 0.05).map((e) => e.nombre.toLowerCase()).join(", ")}.</li>
    <li><b>Falta de agua:</b> hojas lacias al mediodía que no se recuperan en la tarde, flores que caen, frutos chicos.</li>
    <li><b>Exceso de agua:</b> hojas amarillas abajo, tierra siempre mojada, olor a podrido, hongos en el cuello.</li>
    <li>El mulch (paja, hojas, plástico) ahorra 20–30% de agua y frena malezas.</li>
  </ul></div>`;
}

// ---------------- NUTRICIÓN ----------------
function tabNutricion(p) {
  const c = p.c, cfg = p.cfg, u = unidad(p), mult = p.mult;
  const nec = p.necesidad;
  const NOMS = { N: "Nitrógeno (N)", P: "Fósforo (P₂O₅)", K: "Potasio (K₂O)", Ca: "Calcio (CaO)", Mg: "Magnesio (MgO)" };
  const PARA = { N: "hojas y crecimiento", P: "raíces y floración", K: "frutos, sabor y resistencia", Ca: "firmeza y paredes celulares", Mg: "clorofila (verde)" };
  const perfil = PERFILES[c.perfil];
  const tabla = `<table class="fert"><tr><th></th><th>Para qué</th><th class="q">por ${u}</th><th class="q">total</th></tr>
    ${Object.keys(NOMS).filter((n) => nec[n] > 0).map((n) => `<tr><td><b>${NOMS[n]}</b></td><td class="nota">${PARA[n]}</td>
      <td class="q">${peso(nec[n])}</td><td class="q">${peso(nec[n] * mult)}</td></tr>`).join("")}</table>
    <div class="barras">${Object.keys(NOMS).filter((n) => nec[n] > 0).map((n) => `<div class="barra"><span>${n}</span>
      <div>${perfil[n].map((v, i) => `<i style="width:${v}%" class="b${i}" title="${p.etapas[i].nombre} ${v}%"></i>`).join("")}</div></div>`).join("")}
      <div class="ley">${p.etapas.map((e, i) => `<span><i class="b${i}"></i>${e.nombre}</span>`).join("")}</div></div>`;

  // pH
  let phCard = "";
  if (p.ph) {
    if (p.ph.tipo === "ok") phCard = `<div class="card"><h3>⚗️ pH del suelo: ${cfg.ph} ✅</h3><p class="nota">Está dentro del rango ideal (${c.ph[0]}–${c.ph[1]}).</p></div>`;
    else {
      const total = p.ph.g * (c.perenne ? 4 : cfg.area);
      phCard = `<div class="card"><h3>⚗️ Corregir pH: ${cfg.ph} → ${r1(p.ph.meta)}</h3>
        <p><b>${p.ph.producto}</b>: ${peso(p.ph.g)} por m² ${c.perenne ? "(en la zona de plantación, ~4 m² por planta)" : ""} → <b>${peso(total)}</b>${c.perenne ? " por planta" : " en total"}.</p>
        <p class="nota">${p.ph.tipo === "subir" ? "Incorporar 1–2 meses antes de plantar o en otoño. Si la corrección es grande, repartir en 2 años." : "El azufre actúa lento (2–3 meses). Aplicar mezclado con la tierra y repetir al año si hace falta. La materia orgánica ayuda."}</p></div>`;
    }
  } else {
    phCard = `<div class="card"><h3>⚗️ pH del suelo</h3><p class="nota">Ideal para ${c.nombre.toLowerCase()}: ${c.ph[0]}–${c.ph[1]}. Si lo mides (kit o tiras en tiendas agrícolas) y lo pones en "Editar", te calculo la cal o el azufre.</p></div>`;
  }

  const compost = c.perenne
    ? `🌿 <b>Compost</b>: ${peso(10000 * p.edadF)} por planta al año, en invierno, bajo la copa (sin tocar el tronco).`
    : `🌿 <b>Compost o guano descompuesto</b>: ${peso(3000)} por m² → <b>${peso(3000 * cfg.area)}</b>, incorporado antes de plantar.`;

  const etapas = p.etapas.map((e) => {
    const n = e.ap.n;
    const cuando = !c.perenne && e.i === 0 ? "1 vez, antes de plantar (abonado de base)"
      : n > 1 ? `${n} aplicaciones, cada ${e.ap.cada} días` : "1 aplicación";
    const prod = e.nut.prod.length ? `<table class="fert">${e.nut.prod.map((x) => `<tr>
        <td><b>${x.nombre}</b><br><span class="nota">${peso(x.g / n)} por ${u} cada vez${!c.perenne && x.g / n / c.plantasM2 >= 0.3 ? ` (≈ ${peso(x.g / n / c.plantasM2)} por planta)` : ""}</span></td>
        <td class="q">${peso((x.g / n) * mult)}<br><span class="nota">cada vez</span></td></tr>`).join("")}</table>
        <div class="nota">📅 ${cuando}: ${e.fechasAp.slice(0, 12).map(fmt).join(", ")}${e.fechasAp.length > 12 ? "…" : ""}</div>`
      : `<div class="nota">Sin fertilización en esta etapa.</div>`;
    const org = e.nut.org.length ? `<div class="org">🌿 <b>Opción orgánica (en vez de lo anterior):</b> ${e.nut.org.map((o) => `${o.nombre} ${peso(o.g)}/${u}`).join(" + ")} en la etapa.</div>` : "";
    const micro = e.micro.length ? `<div class="micro">🔬 <b>Microelementos (foliar):</b>${e.micro.map((m) => {
        const L = c.perenne ? Math.max(0.5, c.areaPlanta * p.edadF * 0.3) * cfg.plantas : Math.max(1, cfg.area * 0.1);
        return `<div>• <b>${m.nombre}</b> — ${m.producto}: ${m.gL} g por litro → <b>${peso(m.gL * L)} en ${r1(L)} L</b> de agua</div>`;
      }).join("")}<span class="nota">Pulverizar al atardecer, mojando bien las hojas por ambos lados. 1–2 veces en la etapa, separadas 10–15 días.</span></div>` : "";
    const nutTxt = ["N", "P", "K"].map((k) => `${k} ${peso(e.nut.nutr[k])}`).join(" · ");
    return `<div class="card etapa ${e.actual ? "actual" : ""}">
      <b>${e.icono} ${e.nombre}</b>${e.actual ? '<span class="badge">AHORA</span>' : ""}
      <div class="fechas">${fmt(e.desde)} → ${fmt(e.hasta)} · aporta ${nutTxt} por ${u}</div>
      ${prod}${org}${micro}</div>`;
  }).join("");

  const fosforo = `<div class="card"><h3>🦴 Fósforo (P)</h3><p class="nota">Clave para <b>raíces, floración y cuaja</b>. Se mueve muy poco en el suelo: va enterrado al plantar
    (superfosfato triple) y después soluble con el riego (MAP 12-61-0). Con suelo frío (bajo 12 °C) o pH fuera de 6–7 la planta no lo absorbe aunque esté.
    Falta de P: hojas verde oscuro con tonos morados y pocas flores. Orgánico: harina de huesos o guano rojo.</p></div>`;

  const microResumen = (c.micro || []).length ? `<div class="card"><h3>🔬 Microelementos importantes en ${c.nombre.toLowerCase()}</h3>
    ${(c.micro || []).map((k) => { const m = MICRO[k]; return `<p><b>${m.nombre}</b>: ${m.para}<br><span class="nota">Si falta: ${m.sintomas}</span></p>`; }).join("")}</div>` : "";

  const ferti = cfg.metodo === "goteo"
    ? `<div class="alerta">💧 <b>Fertirriego:</b> disuelve la dosis de cada aplicación en el estanque y aplícala en la segunda mitad del riego. <b>No mezcles nitrato de calcio con sulfatos ni con MAP</b> en el mismo estanque (se forma yeso o fosfato de calcio que tapa los goteros): úsalos en riegos distintos.</div>`
    : `<div class="alerta">🥄 1 cucharada sopera ≈ 12–15 g de fertilizante granulado. Espárcelo alrededor de la planta (a 10 cm del tallo), incorpóralo levemente y riega. También puedes disolverlo en la regadera. No mezcles nitrato de calcio con sulfatos o MAP en el mismo balde.</div>`;

  return `<div class="card"><h3>📊 Necesidad total ${c.perenne ? "al año" : "de la temporada"}</h3>${tabla}
    <p class="nota mt">${c.perenne ? `Para una planta ${EDADES[cfg.edad].nombre.toLowerCase()}.` : ""} Reparto por etapa según lo que la planta absorbe en cada momento.</p></div>
    ${phCard}
    <div class="card"><h3>🧱 Base orgánica</h3><p>${compost}</p><p class="nota">La materia orgánica mejora la retención de agua y la vida del suelo; los fertilizantes de abajo completan lo que falta.</p></div>
    ${ferti}
    <h2 class="sub">Programa por etapa</h2>
    ${etapas}
    ${fosforo}${microResumen}
    <details class="card"><summary><b>🩺 Guía de deficiencias (¿qué le falta a mi planta?)</b></summary>
      ${DEFICIENCIAS.map((d) => `<p><b>${d.n}</b><br>${d.s}<br><span class="nota">Solución: ${d.f}</span></p>`).join("")}</details>
    <p class="pie">Dosis de referencia calculadas a partir de lo que extrae el cultivo. Lo ideal es un análisis de suelo. Lee siempre la etiqueta.</p>`;
}

function tabPlagas(p) {
  return p.c.plagas.map((x) => (typeof x === "string" ? PLAGAS[x] : x)).map((x) => `<div class="card plaga">
    <h3>${x.hongo ? "🍄" : "🐛"} ${x.nombre}${x.hongo && p.riesgoHongos ? '<span class="badge rojo">RIESGO ALTO EN TU ZONA</span>' : ""}</h3>
    <p>👀 <b>Cómo reconocerla:</b> ${x.sintomas}</p>
    <p>🌿 <b>Control natural:</b> ${x.org}</p>
    <p>🧪 <b>Control químico:</b> ${x.quim}</p></div>`).join("") +
    `<p class="pie">Usa productos autorizados para el cultivo, respeta la dosis y los días de carencia antes de cosechar.</p>`;
}

// ---------- guardar / editar / borrar ----------
function guardarCfg(cfg, nuevo) {
  const lista = cargar();
  if (nuevo || !cfg.id) { cfg.id = Date.now().toString(36); lista.unshift(cfg); }
  else { const i = lista.findIndex((x) => x.id === cfg.id); if (i >= 0) lista[i] = cfg; else lista.unshift(cfg); }
  guardarTodo(lista);
}

// ---------- eventos ----------
$("#btn-nuevo").onclick = () => { prepararForm(null); location.hash = "#nuevo"; };
$("#btn-back").onclick = () => history.back();
$("#btn-ver").onclick = verPlan;
$("#f-buscar").oninput = pintarCultivos;
$("#f-zona").innerHTML = Object.entries(ZONAS).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
$("#f-edad").innerHTML = Object.entries(EDADES).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
$$(".tabs button").forEach((b) => b.onclick = () => { tabActual = b.dataset.tab; renderPlan(); });
$("#btn-guardar").onclick = () => { guardarCfg(cfgActual, true); toast("💾 Cultivo guardado"); location.hash = ""; };
$("#btn-editar").onclick = () => { prepararForm(cfgActual); location.hash = "#editar"; };
$("#btn-borrar").onclick = () => {
  if (!confirm("¿Eliminar este cultivo?")) return;
  guardarTodo(cargar().filter((x) => x.id !== cfgActual.id));
  location.hash = "";
};
window.addEventListener("hashchange", router);

formVacio();
if (location.hash) history.replaceState(null, "", location.pathname);
router();
revisarVersion(false);

if ("serviceWorker" in navigator && !nativo()) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
