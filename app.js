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
        estado = `${e.icono} ${e.nombre} · ${p.hidro ? `EC ${e.riego.ec[0]}–${e.riego.ec[1]}` : e.riego.cada ? `regar cada ${e.riego.cada} días` : "sin riego (lluvia)"}`;
      }
      const cant = p.c.perenne || p.hidro ? `${cfg.plantas} planta${cfg.plantas > 1 ? "s" : ""}${p.variedad ? " · " + p.variedad.nombre : ""}` : `${cfg.area} m²`;
      return `<div class="card item" data-id="${cfg.id}">
        <span class="e">${p.c.emoji}</span>
        <div><div class="t">${esc(p.c.nombre)} · ${esc(cfg.lugar || "Sin lugar")}</div>
        <div class="s">${estado}<br>${cant}</div></div></div>`;
    }).join("");
  $$("#lista .item").forEach((el) => el.onclick = () => {
    cfgActual = cargar().find((x) => x.id === el.dataset.id); tabActual = "resumen"; location.hash = "#plan";
  });
  renderAgenda(lista);
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
    modoClima: "auto", lat: null, lon: null, climaLoc: null, sistema: "nft", variedad: null });
}

function prepararForm(cfg) {
  formVacio();
  $("#f-buscar").value = ""; $("#f-lugar").value = ""; $("#f-area").value = 10; $("#f-plantas").value = 1;
  $("#f-fecha").value = hoyISO(); $("#f-zona").value = "valle"; $("#f-edad").value = "adulta";
  $("#f-ph").value = ""; $("#f-mulch").checked = false; $("#f-goteros").value = ""; $("#f-caudal").value = ""; $("#f-volumen").value = "";
  $("#ubic-estado").textContent = ""; $("#mapa-box").classList.add("hidden");
  if (cfg) {
    Object.assign(form, { editId: cfg.id, cultivo: cfg.cultivo, sol: cfg.sol, suelo: cfg.suelo, metodo: cfg.metodo || "manguera",
      modoClima: cfg.modoClima || "manual", lat: cfg.lat ?? null, lon: cfg.lon ?? null, climaLoc: cfg.climaLoc || null,
      sistema: cfg.sistema || "nft", variedad: cfg.variedad || null });
    if (cfg.volumen) $("#f-volumen").value = cfg.volumen;
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
  const enCat = (c) => form.cat === "todas" || (form.cat === "hidro" ? c.hidro : c.cat === form.cat && !c.hidro);
  const lista = CULTIVOS.filter((c) => enCat(c) && (!q || norm(c.nombre).includes(q)));
  $("#f-cultivos").innerHTML = lista.length
    ? lista.map((c) => `<div class="chip ${form.cultivo === c.id ? "sel" : ""}" data-id="${c.id}"><span class="e">${c.emoji}</span>${c.nombre}</div>`).join("")
    : `<div class="nota" style="grid-column:1/-1">Ese cultivo aún no está en la app.</div>`;
  $$("#f-cultivos .chip").forEach((el) => el.onclick = () => { form.cultivo = el.dataset.id; form.variedad = null; pintarCultivos(); pintarOpciones(); });
  const c = form.cultivo && cultivoPorId(form.cultivo);
  const per = !!(c && c.perenne), hidro = !!(c && c.hidro);
  const ver = (id, v) => $(id).classList.toggle("hidden", !v);
  ver("#area-wrap", !per && !hidro);
  ver("#plantas-wrap", per || hidro);
  ver("#fecha-wrap", !per);
  ver("#edad-wrap", per);
  ver("#suelo-box", !hidro);
  ver("#metodo-box", !hidro);
  ver("#hidro-box", hidro);
  ver("#variedad-box", !!(c && c.variedades));
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
  opciones("#f-sistema", SISTEMAS_HIDRO, form.sistema, (k) => { form.sistema = k; pintarOpciones(); });
  const c = form.cultivo && cultivoPorId(form.cultivo);
  if (c && c.variedades) {
    $("#f-variedad").innerHTML = `<button type="button" class="opt ${!form.variedad ? "sel" : ""}" data-k="">No sé</button>` +
      c.variedades.map((v) => `<button type="button" class="opt ${form.variedad === v.id ? "sel" : ""}" data-k="${v.id}">${v.nombre}</button>`).join("");
    $$("#f-variedad .opt").forEach((b) => b.onclick = () => { form.variedad = b.dataset.k || null; pintarOpciones(); });
  }
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
  if (c.variedades) cfg.variedad = form.variedad;
  if (c.hidro) {
    cfg.plantas = Math.round(num("#f-plantas") || 0); cfg.fecha = $("#f-fecha").value;
    cfg.sistema = form.sistema; cfg.volumen = num("#f-volumen");
    if (!cfg.plantas) return err("Escribe cuántas plantas tienes.");
    if (!cfg.fecha) return err("Elige la fecha de siembra.");
  } else if (c.perenne) {
    cfg.plantas = Math.round(num("#f-plantas") || 0); cfg.edad = $("#f-edad").value;
    if (!cfg.plantas) return err("Escribe cuántas plantas tienes.");
  } else {
    cfg.area = num("#f-area"); cfg.fecha = $("#f-fecha").value;
    if (!cfg.area) return err("Escribe la superficie en m².");
    if (!cfg.fecha) return err("Elige la fecha de plantación.");
  }
  if (cfg.ph && (cfg.ph < 3 || cfg.ph > 10)) return err("El pH debe estar entre 3 y 10.");
  if (cfg.id) {   // conservar agenda y notas al editar
    const prev = cargar().find((x) => x.id === cfg.id);
    if (prev) { cfg.calendario = prev.calendario; cfg.notas = prev.notas; }
  }
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
  const cant = p.hidro ? `${cfg.plantas} plantas · ${SISTEMAS_HIDRO[cfg.sistema].nombre} · ${p.volumen} L · sembrado el ${fmtAnio(p.inicio)}`
    : p.c.perenne ? `${cfg.plantas} planta(s) · ${EDADES[cfg.edad].nombre.toLowerCase()}${p.variedad ? " · " + p.variedad.nombre : ""}`
    : `${cfg.area} m² · plantado el ${fmtAnio(p.inicio)}`;
  const clima = cfg.modoClima === "auto" ? "🛰️ clima automático" : `✋ ${p.zona.nombre}`;
  $("#p-head").innerHTML = `<span class="e">${p.c.emoji}</span><div>
    <div class="t">${esc(p.c.nombre)}${cfg.lugar ? " · " + esc(cfg.lugar) : ""}</div>
    <div class="s">${p.sol.icono} ${p.sol.nombre} · ${clima}<br>${cant}</div></div>`;
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabActual));
  $("#p-body").innerHTML = { resumen: tabResumen, calendario: tabCalendario, riego: tabRiego, nutricion: tabNutricion, plagas: tabPlagas, notas: tabNotas }[tabActual](p);
  const bind = { calendario: bindCalendario, notas: bindNotas, plagas: bindPlagas }[tabActual];
  if (bind) bind(p);
  $("#btn-guardar").classList.toggle("hidden", !!cfg.id);
  $("#btn-editar").classList.toggle("hidden", !cfg.id);
  $("#btn-borrar").classList.toggle("hidden", !cfg.id);
  $$("#p-body [data-ir]").forEach((b) => b.onclick = (ev) => { ev.preventDefault(); tabActual = b.dataset.ir; renderPlan(); window.scrollTo(0, 0); });
}

const unidad = (p) => (p.c.perenne ? "planta" : "m²");

function lineaRiego(p, r) {
  if (r.hidro) return `💧 Cada 2 días: reponer ≈ <b>${litros(r.total)}</b> de agua y medir <b>EC ${r.ec[0]}–${r.ec[1]}</b> y <b>pH ${r.ph[0]}–${r.ph[1]}</b>`;
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
  const fertHoy = p.hidro ? `<li>🧪 Solución al ${Math.round(e.nut.conc * 100)}%, cambiarla ${e.ap.n > 1 ? `cada ${e.ap.cada} días` : "1 vez en la etapa"} <a href="#" data-ir="nutricion" class="lnk">ver receta</a></li>`
    : e.nut.prod.length ? `<li>🧪 Abonar ${e.ap.n > 1 ? `cada ${e.ap.cada} días` : "1 vez"}: ${e.nut.prod.map((x) => x.nombre.split(" (")[0]).join(", ")} <a href="#" data-ir="nutricion" class="lnk">ver dosis</a></li>` : "";
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
  if (p.variedad && p.cfg.climaLoc && p.cfg.climaLoc.tMin < p.variedad.frio)
    a.push(`🥶 En tu lugar la mínima del último año fue ${p.cfg.climaLoc.tMin} °C y la palta ${p.variedad.nombre} aguanta hasta ≈ ${p.variedad.frio} °C. Protege los árboles jóvenes o considera Bacon, Zutano o Negra de La Cruz.`);
  if (p.ph && p.ph.tipo !== "ok") a.push(`⚗️ Tu pH (${p.cfg.ph}) no es el ideal (${c.ph[0]}–${c.ph[1]}). Revisa la corrección en <a href="#" data-ir="nutricion" class="lnk">Nutrición</a>.`);
  return a.map((t) => `<div class="alerta">${t}</div>`).join("");
}

function tabResumen(p) {
  const c = p.c;
  const t = c.temp;
  const dens = c.perenne || p.hidro ? `${c.distancia}` : `${c.distancia} (≈ ${c.plantasM2} plantas/m² → ${Math.round(c.plantasM2 * p.cfg.area)} plantas)`;
  return cardAhora(p) + cardPronostico(p) + alertas(p) + cardVariedad(p) + `
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
  if (p.hidro) return tabRiegoHidro(p);
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
  if (p.hidro) return tabNutricionHidro(p);
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

// ---------------- PALTO: VARIEDAD ----------------
function cardVariedad(p) {
  const c = p.c;
  if (!c.variedades) return "";
  const v = p.variedad;
  const tabla = `<table class="fert"><tr><th>Variedad</th><th>Flor</th><th>Cosecha</th><th class="q">Frío</th></tr>
    ${c.variedades.map((x) => `<tr${v && v.id === x.id ? ' class="fila-sel"' : ""}><td><b>${x.nombre}</b></td><td>${x.flor}</td>
      <td>${MESES[x.cosecha[0] - 1]}–${MESES[x.cosecha[1] - 1]}</td><td class="q">${x.frio} °C</td></tr>`).join("")}</table>`;
  const polin = v && v.flor !== "—"
    ? `<p>🐝 Flor tipo <b>${v.flor}</b>: cuaja mejor con un árbol de flor tipo <b>${v.flor === "A" ? "B" : "A"}</b> cerca (${c.variedades.filter((x) => x.flor === (v.flor === "A" ? "B" : "A")).map((x) => x.nombre).join(", ")}).</p>` : "";
  return `<div class="card"><h3>🥑 ${v ? `Palta ${v.nombre}` : "Variedades de palta"}</h3>
    ${v ? `<p>${v.nota}</p><p>🧺 Cosecha aprox.: <b>${MESES[v.cosecha[0] - 1]} a ${MESES[v.cosecha[1] - 1]}</b> · ❄️ aguanta hasta ≈ <b>${v.frio} °C</b></p>${polin}` :
      `<p class="nota">Elige tu variedad en "Editar" para ver su cosecha, polinizante y resistencia al frío.</p>`}
    <details><summary class="nota">Comparar variedades</summary>${tabla}
    <p class="nota">Flor A y B: el palto abre sus flores como hembra y como macho en horarios distintos; mezclar tipos mejora la cuaja. Valores aproximados para Chile central.</p></details></div>`;
}

// ---------------- HIDROPONÍA ----------------
function tabRiegoHidro(p) {
  const cfg = p.cfg, sis = SISTEMAS_HIDRO[cfg.sistema || "nft"];
  return `<div class="card"><h3>${sis.icono} Tu sistema: ${sis.nombre}</h3>
      <p>${sis.bomba}</p>
      <p class="nota">Estanque: <b>${p.volumen} L</b> para ${cfg.plantas} plantas. El agua que la planta consume se repone con agua sola; los nutrientes se renuevan al cambiar la solución.</p></div>
    ${p.etapas.map((e) => {
      const r = e.riego;
      return `<div class="card etapa ${e.actual ? "actual" : ""}">
        <b>${e.icono} ${e.nombre}</b>${e.actual ? '<span class="badge">AHORA</span>' : ""}
        <div class="fechas">${fmt(e.desde)} → ${fmt(e.hasta)}</div>
        <div class="riego-box">
          <div><div class="n">${r.ec[0]}–${r.ec[1]}</div><div class="l">EC objetivo<br>(mS/cm)</div></div>
          <div><div class="n">${r.ph[0]}–${r.ph[1]}</div><div class="l">pH<br>objetivo</div></div>
          <div><div class="n">${litros(r.totalDia)}</div><div class="l">agua que<br>consume al día</div></div>
        </div>
        <p class="nota mt">≈ ${r1(r.porPlantaDia * 1000)} mL por planta al día. Cada 2 días repón ≈ <b>${litros(r.total)}</b> de agua.</p>
      </div>`;
    }).join("")}
    <div class="card"><h3>📏 Cómo manejar la solución</h3><ul class="tareas">
      <li><b>EC alta</b> (sobre el rango): agrega agua sola. <b>EC baja</b>: agrega solución nueva.</li>
      <li><b>pH alto</b> (sobre 6,2): baja con ácido fosfórico o cítrico, de a pocas gotas. <b>pH bajo</b> (bajo 5,8): sube con hidróxido de potasio.</li>
      <li>Mide primero la EC y después el pH, siempre con la solución bien mezclada.</li>
      <li>Temperatura de la solución <b>18–22 °C</b>. Sobre 24 °C hay poco oxígeno y aparece la pudrición de raíz: sombrea o pinta de blanco el estanque.</li>
      <li>Cambia toda la solución cada 2–3 semanas, y lava el sistema entre cultivos (agua con un poco de agua oxigenada).</li>
      <li>Usa agua de buena calidad. Si la del grifo trae mucho cloro, déjala reposar 24 h.</li>
    </ul></div>`;
}

function tabNutricionHidro(p) {
  const cfg = p.cfg, vol = p.volumen;
  const receta = (conc) => `<table class="fert"><tr><th>Producto</th><th class="q">por 100 L</th><th class="q">tu estanque</th></tr>
    ${RECETA_HIDRO.map((r) => `<tr><td><b>${r.nombre}</b> <span class="badge ${r.tanque === "A" ? "azul" : ""}">${r.tanque}</span></td>
      <td class="q">${peso(r.g / 10 * conc)}</td><td class="q">${peso(r.g * vol / 1000 * conc)}</td></tr>`).join("")}</table>`;
  const ppm = Object.entries(PPM_HIDRO).map(([k, v]) => `${k} ${v}`).join(" · ");
  return `<div class="card"><h3>🧪 Solución nutritiva para lechuga</h3>
      <p class="nota">Receta al 100% (EC ≈ 1,8–2,0). Aporta en ppm: ${ppm}. Calculada para tu estanque de <b>${vol} L</b>.</p>
      ${receta(1)}</div>
    <div class="alerta">⚠️ Usa <b>dos estanques concentrados</b> o disuelve por separado: <b>A</b> (nitrato de calcio + hierro) y <b>B</b> (todo lo demás). Si mezclas el calcio concentrado con sulfatos o fosfatos se forma un precipitado blanco y la planta no lo aprovecha. Agrega primero A al agua, revuelve, y después B.</div>
    <h2 class="sub">Por etapa</h2>
    ${p.etapas.map((e) => `<div class="card etapa ${e.actual ? "actual" : ""}">
      <b>${e.icono} ${e.nombre}</b>${e.actual ? '<span class="badge">AHORA</span>' : ""}
      <div class="fechas">${fmt(e.desde)} → ${fmt(e.hasta)} · solución al <b>${Math.round(e.nut.conc * 100)}%</b> · EC ${e.riego.ec[0]}–${e.riego.ec[1]}</div>
      ${receta(e.nut.conc)}
      <div class="nota">📅 ${e.ap.n > 1 ? `Cambiar la solución ${e.ap.n} veces` : "Preparar 1 vez"}: ${e.fechasAp.map(fmt).join(", ")}</div></div>`).join("")}
    <div class="card"><h3>🩺 Problemas típicos en hidroponía</h3>
      <p><b>Puntas quemadas (tipburn)</b>: falta calcio en hojas nuevas por calor o poca ventilación. Ventila y sombrea.</p>
      <p><b>Hojas nuevas amarillas con nervios verdes</b>: falta hierro, casi siempre por pH sobre 6,5.</p>
      <p><b>Hojas viejas amarillas</b>: solución agotada (EC baja) → cámbiala.</p>
      <p><b>Raíces cafés y con mal olor</b>: solución caliente o sin oxígeno → enfría y oxigena.</p></div>
    <p class="pie">En casas de jardinería venden mezclas A y B listas para hidroponía; úsalas según su etiqueta si prefieres no preparar la receta.</p>`;
}

// ---------------- TEMA ----------------
const TEMAS = { claro: "☀️ Claro", oscuro: "🌙 Oscuro", auto: "🌓 Automático" };
const temaGuardado = () => localStorage.getItem("mihuerta.tema") || "auto";
function sistemaOscuro() {
  if (nativo() && Android.oscuroSistema) return Android.oscuroSistema();
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
function aplicarTema() {
  const t = temaGuardado();
  const oscuro = t === "oscuro" || (t === "auto" && sistemaOscuro());
  document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
  document.querySelector('meta[name="theme-color"]').content = oscuro ? "#1b5e20" : "#2e7d32";
  $("#btn-tema").textContent = t === "auto" ? "🌓" : oscuro ? "🌙" : "☀️";
  const seg = $("#f-tema");
  if (seg) {
    seg.innerHTML = Object.entries(TEMAS).map(([k, v]) => `<button type="button" data-k="${k}" class="${t === k ? "sel" : ""}">${v}</button>`).join("");
    $$("#f-tema button").forEach((b) => b.onclick = () => { localStorage.setItem("mihuerta.tema", b.dataset.k); aplicarTema(); });
  }
}
$("#btn-tema").onclick = () => {
  const orden = ["auto", "claro", "oscuro"];
  const sig = orden[(orden.indexOf(temaGuardado()) + 1) % 3];
  localStorage.setItem("mihuerta.tema", sig); aplicarTema(); toast(TEMAS[sig]);
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", aplicarTema);
window.alCambiarModoSistema = aplicarTema;
aplicarTema();

let soloVerde = localStorage.getItem("mihuerta.soloVerde") === "1";

function opcionVerde(id) {
  const v = VERDES[id];
  return `<div class="verde-op ${v.bio ? "bio" : ""}"><b>${v.bio ? "🦠" : "🟢"} ${v.nombre}</b> <span class="nota">· ${v.tipo}</span>
    <div class="nota">Ej.: ${v.ejemplos}</div><div class="nota">💡 ${v.nota}</div></div>`;
}

function tabPlagas(p) {
  const franjas = `<div class="franjas">${FRANJAS.map((f) => `<div class="franja"><i style="background:${f.hex}"></i>
    <div><b>${f.color} · Clase ${f.clase}</b><br><span class="nota">${f.nombre}</span></div></div>`).join("")}</div>`;
  const cab = `<div class="card verde-card">
    <h3>🟢 Etiqueta verde</h3>
    <p class="nota">En Chile cada plaguicida trae abajo una <b>franja de color</b> según su toxicidad para las personas (SAG, Res. 2196/2000).
      La <b>verde (Clase IV)</b> son "productos que normalmente no ofrecen peligro": la mejor opción para la huerta de la casa.</p>
    ${franjas}
    <label class="check toggle"><input type="checkbox" id="solo-verde" ${soloVerde ? "checked" : ""}> Mostrar solo opciones de etiqueta verde y biológicas</label>
  </div>`;

  const cards = p.c.plagas.map((x) => (typeof x === "string" ? PLAGAS[x] : x)).map((x) => {
    const verdes = verdesPara(x);
    const quim = x.quim && x.quim !== "—" && !soloVerde
      ? `<p>🧪 <b>Químico convencional:</b> ${x.quim} <span class="nota">(revisa el color de la franja; prefiere verde o azul)</span></p>` : "";
    return `<div class="card plaga">
      <h3>${x.hongo ? "🍄" : "🐛"} ${x.nombre}${x.hongo && p.riesgoHongos ? '<span class="badge rojo">RIESGO ALTO EN TU ZONA</span>' : ""}</h3>
      <p>👀 <b>Cómo reconocerla:</b> ${x.sintomas}</p>
      <p>🌿 <b>Control natural:</b> ${x.org}</p>
      ${verdes.length ? `<div class="verde-box"><b>🟢 Opciones etiqueta verde y biológicas</b>${verdes.map(opcionVerde).join("")}</div>`
        : (soloVerde ? `<p class="nota">No hay un producto de etiqueta verde específico para esto: usa el control natural.</p>` : "")}
      ${quim}</div>`;
  }).join("");

  const guia = `<details class="card"><summary><b>📋 Todos los productos de etiqueta verde y biológicos</b></summary>
    ${Object.keys(VERDES).map(opcionVerde).join("")}
    <p class="nota mt">🧼 El <b>jabón potásico</b> visado por el SAG está autorizado para <b>lavado de plantas</b> (quita melaza, polvo y parte de la plaga), no como plaguicida.</p>
    <p class="nota">Fuente: SAG, Lista Nº 45 de insumos visados (dic. 2022) y Res. 2196/2000. Los registros cambian: confirma en el envase que diga <b>"Toxicidad IV – Verde"</b> y que el cultivo esté en la etiqueta.</p></details>`;

  const seguridad = `<div class="card"><h3>🧤 Verde no significa inofensivo</h3><ul class="tareas">
    <li>Lee la etiqueta: dosis, <b>período de carencia</b> (días antes de cosechar) y <b>reingreso</b>.</li>
    <li>Usa guantes, mascarilla y lentes; no comas ni fumes mientras aplicas.</li>
    <li>Aplica al atardecer, sin viento y sin flores abiertas, para cuidar a las abejas.</li>
    <li>Triple lavado del envase y no lo botes en acequias ni ríos.</li>
    <li>Guarda los productos lejos de niños, mascotas y alimentos.</li></ul></div>`;

  return cab + cards + guia + seguridad;
}

function bindPlagas() {
  const t = $("#solo-verde");
  if (t) t.onchange = () => { soloVerde = t.checked; localStorage.setItem("mihuerta.soloVerde", soloVerde ? "1" : "0"); renderPlan(); };
}

// =====================================================================
//  VENTANA INFERIOR (para editar)
// =====================================================================
function abrirSheet(html, alAbrir) {
  $("#sheet-body").innerHTML = `<button class="sheet-x" id="sheet-x">✕</button>` + html;
  $("#sheet").classList.remove("hidden");
  $("#sheet-x").onclick = cerrarSheet;
  if (alAbrir) alAbrir();
}
function cerrarSheet() { $("#sheet").classList.add("hidden"); $("#sheet-body").innerHTML = ""; }
$("#sheet").onclick = (e) => { if (e.target.id === "sheet") cerrarSheet(); };

// Guarda los cambios del cultivo que se está viendo (si ya está guardado)
function persistirActual(resync) {
  if (cfgActual.id) guardarCfg(cfgActual, false, resync);
}

// =====================================================================
//  AGENDA / CALENDARIO
// =====================================================================
let calFiltro = "proximos";
// Solo abonos, foliares y tareas propias de las últimas 2 semanas cuentan como atrasados
const puedeAtrasarse = (e, hoy) => e.tipo !== "etapa" && e.fecha < hoy && e.fecha >= sumarDias(hoy, -14);
const fechaLarga = (d) => `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;

function tabCalendario(p) {
  const cfg = p.cfg, hoy = hoy0();
  const todos = Calendario.eventos(p, true);
  const visibles = todos.filter((e) => !e.oculto), ocultos = todos.filter((e) => e.oculto);
  const sync = cfg.calendario && cfg.calendario.sync;

  let syncCard;
  if (nativo()) {
    syncCard = sync
      ? `<div class="card sync-ok"><b>✅ Vinculado al calendario del teléfono</b>
          <div class="nota">${esc(sync.calNombre)} · ${Object.keys(sync.ids || {}).length} eventos · aviso a las ${sync.hora}. Se actualiza solo cuando cambias algo.</div>
          <div class="row2 mt"><button class="btn-sec" id="cal-resync">🔄 Actualizar</button><button class="btn-sec" id="cal-unsync">⛓️‍💥 Desvincular</button></div></div>`
      : `<div class="card"><b>📲 Google Calendar</b><p class="nota">Pasa estas tareas al calendario de tu teléfono, con aviso. Se sincroniza con tu cuenta de Google.</p>
          <button class="btn-big" id="cal-sync">📲 Agregar a mi calendario</button></div>`;
  } else {
    syncCard = `<div class="card"><b>📲 Google Calendar</b><p class="nota">Descarga el archivo y ábrelo en Google Calendar (calendar.google.com → ⚙️ → Importar). En la app de Android se vincula directo.</p>
      <button class="btn-sec full" id="cal-ics">⬇️ Descargar calendario (.ics)</button></div>`;
  }

  const lista = visibles.filter((e) => {
    const prox = Calendario.proxima(e, hoy);
    if (calFiltro === "hechos") return !e.cada && e.hecho;
    if (calFiltro === "todos") return true;
    if (e.cada) return !!prox;
    if (e.hecho) return false;
    return e.fecha >= hoy || puedeAtrasarse(e, hoy);   // próximos + atrasados recientes
  });

  const filas = lista.map((e) => {
    const prox = Calendario.proxima(e, hoy);
    let cuando, okey = e.key, hecho = e.hecho, atrasado = false;
    if (e.cada) {
      cuando = `Cada ${e.cada} días · ${fmt(e.fecha)} → ${e.hasta ? fmt(e.hasta) : "sin fin"}${prox ? ` · próximo: <b>${fechaLarga(prox)}</b>` : " · terminado"}`;
      if (prox) {
        okey = `${e.key}@${Calendario.iso(prox)}`;
        const a = cfg.calendario && cfg.calendario.ajustes && cfg.calendario.ajustes[okey];
        hecho = !!(a && a.hecho);
      }
    } else {
      atrasado = !e.hecho && puedeAtrasarse(e, hoy);
      cuando = fechaLarga(e.fecha) + (atrasado ? ' <span class="badge rojo">atrasado</span>' : "");
    }
    return `<div class="ev t-${e.tipo} ${hecho ? "hecho" : ""}">
      <input type="checkbox" class="chk" data-ok="${okey}" ${hecho ? "checked" : ""} ${e.cada && !prox ? "disabled" : ""}>
      <div class="evt" data-edit="${e.key}"><b>${esc(e.titulo)}</b>${e.editado ? " ✏️" : ""}<div class="nota">${cuando}</div></div>
    </div>`;
  }).join("");

  return syncCard + `
    <button class="btn-big" id="cal-nuevo">＋ Agregar tarea</button>
    <div class="seg mt" id="cal-filtro">
      <button data-k="proximos" class="${calFiltro === "proximos" ? "sel" : ""}">Pendientes</button>
      <button data-k="todos" class="${calFiltro === "todos" ? "sel" : ""}">Todo</button>
      <button data-k="hechos" class="${calFiltro === "hechos" ? "sel" : ""}">Hechos</button>
    </div>
    <div class="card evs">${filas || '<div class="vacio">No hay tareas aquí.</div>'}</div>
    <p class="nota">Toca una tarea para cambiar la fecha, el texto o la repetición. ✓ marca como hecha.</p>
    ${ocultos.length ? `<details class="card"><summary>Ocultas (${ocultos.length})</summary>${ocultos.map((e) =>
      `<div class="ev"><div class="evt" data-edit="${e.key}">${esc(e.titulo)}<div class="nota">${fmt(e.fecha)}</div></div></div>`).join("")}</details>` : ""}`;
}

function bindCalendario(p) {
  const cfg = p.cfg;
  $$("#cal-filtro button").forEach((b) => b.onclick = () => { calFiltro = b.dataset.k; renderPlan(); });
  $$("#p-body .chk").forEach((c) => c.onchange = () => {
    Calendario.ajustar(cfg, c.dataset.ok, { hecho: c.checked });
    persistirActual(false);
    if (c.checked) toast("✅ Hecho");
    setTimeout(renderPlan, 250);
  });
  $$("#p-body [data-edit]").forEach((el) => el.onclick = () => editarEvento(p, el.dataset.edit));
  $("#cal-nuevo").onclick = () => editarEvento(p, null);
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on("#cal-ics", () => descargar(`mihuerta-${cfg.cultivo}.ics`, Calendario.ics([p], { hora: "08:00", aviso: 0 }), "text/calendar"));
  on("#cal-sync", () => abrirVincular(cfg));
  on("#cal-resync", () => { sincronizarTelefono(cfg); toast("🔄 Actualizando calendario…"); });
  on("#cal-unsync", () => {
    if (!confirm("¿Quitar estas tareas del calendario del teléfono?")) return;
    const ids = Object.values(cfg.calendario.sync.ids || {});
    if (ids.length) Android.borrarEventos(JSON.stringify(ids));
    delete cfg.calendario.sync; persistirActual(false); renderPlan(); toast("Tareas quitadas del calendario");
  });
}

const PLANTILLAS = ["✂️ Podar", "🌿 Desmalezar", "🧺 Cosechar", "🐛 Revisar plagas", "💊 Aplicar tratamiento", "🪴 Aporcar", "🧹 Limpiar goteros"];

function editarEvento(p, key) {
  const cfg = p.cfg;
  const e = key ? Calendario.eventos(p, true).find((x) => x.key === key) : null;
  const nuevo = !e, propio = nuevo || e.propio;
  const repite = nuevo ? false : !!e.cada;
  abrirSheet(`<h3>${nuevo ? "＋ Nueva tarea" : "✏️ Editar tarea"}</h3>
    ${nuevo ? `<div class="plantillas">${PLANTILLAS.map((t) => `<button type="button" class="chip-s">${t}</button>`).join("")}</div>` : ""}
    <label class="lbl">Título</label><input id="ev-titulo" class="inp" value="${esc(e ? e.titulo : "")}" placeholder="Ej. Revisar goteros">
    <div class="row2"><div><label class="lbl">${repite || propio ? "Desde" : "Fecha"}</label><input id="ev-fecha" type="date" class="inp" value="${Calendario.iso(e ? e.fecha : hoy0())}"></div>
      ${propio || repite ? `<div><label class="lbl">Repetir cada (días)</label><input id="ev-cada" type="number" min="1" class="inp" placeholder="No repetir" value="${e && e.cada ? e.cada : ""}"></div>` : "<div></div>"}</div>
    ${propio || repite ? `<label class="lbl">Hasta (si se repite)</label><input id="ev-hasta" type="date" class="inp" value="${e && e.hasta ? Calendario.iso(e.hasta) : ""}">` : ""}
    <label class="lbl">Nota / detalle</label><textarea id="ev-nota" class="inp" rows="5">${esc(e ? e.nota : "")}</textarea>
    <button class="btn-big mt" id="ev-ok">💾 Guardar</button>
    ${!nuevo && e.propio ? `<button class="btn-danger" id="ev-del">🗑 Eliminar tarea</button>` : ""}
    ${!nuevo && !e.propio ? `<div class="row2 mt"><button class="btn-sec" id="ev-ocultar">${e.oculto ? "👁️ Mostrar" : "🙈 Ocultar"}</button>
      <button class="btn-sec" id="ev-reset" ${e.editado ? "" : "disabled"}>↩️ Original</button></div>` : ""}`, () => {
    $$(".plantillas .chip-s").forEach((b) => b.onclick = () => { $("#ev-titulo").value = b.textContent; });
    const val = (id) => { const x = $(id); return x ? x.value.trim() : ""; };
    $("#ev-ok").onclick = () => {
      const titulo = val("#ev-titulo"), fecha = val("#ev-fecha");
      if (!titulo || !fecha) return toast("Escribe un título y una fecha");
      const cada = parseInt(val("#ev-cada"), 10) || null, hasta = val("#ev-hasta") || null, nota = $("#ev-nota").value;
      if (nuevo) Calendario.agregarPropio(cfg, { titulo, fecha, cada, hasta: cada ? hasta : null, nota });
      else if (e.propio) Calendario.ajustar(cfg, key, { titulo, fecha, cada, hasta: cada ? hasta : null, nota });
      else {
        const o = e.original;
        Calendario.ajustar(cfg, key, {
          titulo: titulo !== o.titulo ? titulo : undefined,
          nota: nota !== o.nota ? nota : undefined,
          fecha: fecha !== Calendario.iso(o.fecha) ? fecha : undefined,
          cada: o.cada && cada && cada !== o.cada ? cada : undefined,
          hasta: o.hasta && hasta && hasta !== Calendario.iso(o.hasta) ? hasta : undefined,
          oculto: e.oculto || undefined, hecho: e.hecho || undefined });
      }
      persistirActual(true); cerrarSheet(); renderPlan(); toast("💾 Guardado");
    };
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
    on("#ev-del", () => { Calendario.borrarPropio(cfg, e.id); persistirActual(true); cerrarSheet(); renderPlan(); });
    on("#ev-ocultar", () => { Calendario.ajustar(cfg, key, { oculto: !e.oculto }); persistirActual(true); cerrarSheet(); renderPlan(); });
    on("#ev-reset", () => { Calendario.restablecer(cfg, key); persistirActual(true); cerrarSheet(); renderPlan(); });
  });
}

function descargar(nombre, texto, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ----- Vincular con el calendario del teléfono (Android) -----
function abrirVincular(cfg) {
  if (!cfg.id) { guardarCfg(cfg, true); toast("💾 Cultivo guardado"); }
  abrirSheet(`<h3>📲 Agregar a mi calendario</h3><div id="vin-cals" class="nota">Buscando tus calendarios… (acepta el permiso si te lo pide)</div>`);
  window.alErrorCalendario = (msg) => { $("#vin-cals").innerHTML = `❌ ${esc(msg)}`; };
  window.alCalendarios = (json) => {
    const cals = JSON.parse(json);
    if (!cals.length) return window.alErrorCalendario("No encontré calendarios en el teléfono. Abre Google Calendar una vez e inténtalo de nuevo.");
    cals.sort((a, b) => (b.google - a.google) || (b.principal - a.principal));
    const tipos = Object.entries(Calendario.TIPOS);
    $("#sheet-body").innerHTML = `<button class="sheet-x" id="sheet-x">✕</button><h3>📲 Agregar a mi calendario</h3>
      <label class="lbl">Calendario</label>
      ${cals.map((c, i) => `<label class="radio"><input type="radio" name="cal" value="${c.id}" ${i === 0 ? "checked" : ""}>
        <span><b>${esc(c.nombre)}</b><br><span class="nota">${esc(c.cuenta)}</span></span></label>`).join("")}
      <div class="row2"><div><label class="lbl">Hora del aviso</label><input id="vin-hora" type="time" class="inp" value="08:00"></div>
        <div><label class="lbl">Avisar</label><select id="vin-aviso" class="inp">
          <option value="0">A esa hora</option><option value="30">30 min antes</option><option value="60">1 hora antes</option><option value="720">La noche anterior</option></select></div></div>
      <label class="lbl">Qué agregar</label>
      ${tipos.map(([k, t]) => `<label class="check"><input type="checkbox" class="vin-tipo" value="${k}" checked> ${t.icono} ${t.nombre}</label>`).join("")}
      <button class="btn-big mt" id="vin-ok">📲 Agregar</button>`;
    $("#sheet-x").onclick = cerrarSheet;
    $("#vin-ok").onclick = () => {
      const sel = document.querySelector('input[name="cal"]:checked');
      const cal = cals.find((c) => String(c.id) === sel.value);
      const old = (cfg.calendario && cfg.calendario.sync && cfg.calendario.sync.ids) || {};
      cfg.calendario = cfg.calendario || {};
      cfg.calendario.sync = { calId: cal.id, calNombre: `${cal.nombre} (${cal.cuenta})`, hora: $("#vin-hora").value || "08:00",
        aviso: parseInt($("#vin-aviso").value, 10) || 0, tipos: [...$$(".vin-tipo")].filter((x) => x.checked).map((x) => x.value), ids: old };
      persistirActual(false);
      sincronizarTelefono(cfg);
      cerrarSheet(); toast("📲 Agregando al calendario…");
    };
  };
  Android.listarCalendarios();
}

function sincronizarTelefono(cfg) {
  const s = cfg.calendario && cfg.calendario.sync;
  if (!nativo() || !s) return;
  const plan = calcularPlan(cfg);
  const evs = Calendario.paraTelefono(plan, s);
  Android.sincronizarCalendario(String(s.calId), JSON.stringify(evs), JSON.stringify(Object.values(s.ids || {})), s.aviso || 0, cfg.id);
}
window.alCalendarioSincronizado = (json) => {
  const r = JSON.parse(json);
  const lista = cargar();
  const cfg = lista.find((x) => x.id === r.token);
  if (!cfg || !cfg.calendario || !cfg.calendario.sync) return;
  cfg.calendario.sync.ids = r.ids || {};
  cfg.calendario.sync.fecha = new Date().toISOString();
  guardarTodo(lista);
  if (cfgActual && cfgActual.id === cfg.id) { cfgActual = cfg; if (location.hash === "#plan") renderPlan(); }
  toast(r.error ? "⚠️ " + r.error : `✅ ${Object.keys(r.ids || {}).length} tareas en tu calendario`, 4000);
};

const pendientesSync = {};
function programarResync(cfg) {
  if (!nativo() || !cfg.calendario || !cfg.calendario.sync) return;
  clearTimeout(pendientesSync[cfg.id]);
  pendientesSync[cfg.id] = setTimeout(() => {
    const fresco = cargar().find((x) => x.id === cfg.id);
    if (fresco) sincronizarTelefono(fresco);
  }, 1500);
}

// ----- Agenda del inicio (todos los cultivos) -----
function renderAgenda(lista) {
  const hoy = hoy0(), desde = sumarDias(hoy, -7), hasta = sumarDias(hoy, 7);
  const items = [];
  for (const cfg of lista) {
    const plan = calcularPlan(cfg);
    for (const o of Calendario.ocurrencias(cfg, Calendario.eventos(plan), desde, hasta)) {
      if (o.fecha < hoy && (o.hecho || o.ev.cada || o.ev.tipo === "etapa")) continue;   // riegos y etapas pasadas no se arrastran
      items.push({ ...o, cfg, c: plan.c });
    }
  }
  items.sort((a, b) => a.fecha - b.fecha);
  $("#agenda-box").classList.toggle("hidden", !items.length);
  if (!items.length) return;
  const manana = sumarDias(hoy, 1);
  const grupo = (f) => (f < hoy ? "⚠️ Atrasado" : f.getTime() === hoy.getTime() ? "Hoy" : f.getTime() === manana.getTime() ? "Mañana" : fechaLarga(f));
  let ult = "", html = "";
  for (const it of items.slice(0, 25)) {
    const g = grupo(it.fecha);
    if (g !== ult) { html += `<div class="ag-dia">${g}</div>`; ult = g; }
    html += `<div class="ev t-${it.ev.tipo} ${it.hecho ? "hecho" : ""}">
      <input type="checkbox" class="chk" data-id="${it.cfg.id}" data-ok="${it.okey}" ${it.hecho ? "checked" : ""}>
      <div class="evt" data-abrir="${it.cfg.id}"><b>${esc(it.ev.titulo)}</b>
      <div class="nota">${esc(it.cfg.lugar || it.c.nombre)}${it.fecha < hoy ? ` · ${fmt(it.fecha)}` : ""}</div></div></div>`;
  }
  if (items.length > 25) html += `<div class="nota">… y ${items.length - 25} más en cada cultivo.</div>`;
  $("#agenda").innerHTML = html;
  $$("#agenda .chk").forEach((c) => c.onchange = () => {
    const l = cargar(), cfg = l.find((x) => x.id === c.dataset.id);
    Calendario.ajustar(cfg, c.dataset.ok, { hecho: c.checked });
    guardarTodo(l);
    setTimeout(() => renderAgenda(cargar()), 250);
  });
  $$("#agenda [data-abrir]").forEach((el) => el.onclick = () => {
    cfgActual = cargar().find((x) => x.id === el.dataset.abrir); tabActual = "calendario"; location.hash = "#plan";
  });
}

// =====================================================================
//  NOTAS / BITÁCORA
// =====================================================================
const TIPOS_NOTA = {
  obs: "📝 Observación", cosecha: "🧺 Cosecha", plaga: "🐛 Plaga / enfermedad",
  riego: "💧 Riego", abono: "🧪 Abono / tratamiento", labor: "✂️ Labor",
};
let notaFiltro = "todas";

function tabNotas(p) {
  const notas = (p.cfg.notas || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const cosechas = notas.filter((n) => n.tipo === "cosecha");
  const kg = cosechas.reduce((s, n) => s + (n.kg || 0), 0);
  const lista = notas.filter((n) => notaFiltro === "todas" || n.tipo === notaFiltro);
  const resumen = `<div class="card"><div class="riego-box">
      <div><div class="n">${notas.length}</div><div class="l">notas</div></div>
      <div><div class="n">${r1(kg)} kg</div><div class="l">cosechado</div></div>
      <div><div class="n">${cosechas.length}</div><div class="l">cosechas</div></div></div>
      ${kg && !p.c.perenne ? `<p class="nota mt">Rendimiento: ${r1(kg / p.cfg.area)} kg/m²</p>` : ""}
      ${kg && p.c.perenne ? `<p class="nota mt">Rendimiento: ${r1(kg / p.cfg.plantas)} kg por planta</p>` : ""}</div>`;
  return resumen + `<button class="btn-big" id="nota-nueva">＋ Nueva nota</button>
    <div class="seg mt" id="nota-filtro"><button data-k="todas" class="${notaFiltro === "todas" ? "sel" : ""}">Todas</button>
      ${Object.entries(TIPOS_NOTA).map(([k, v]) => `<button data-k="${k}" class="${notaFiltro === k ? "sel" : ""}">${v.split(" ")[0]}</button>`).join("")}</div>
    ${lista.length ? lista.map((n) => `<div class="card nota-item" data-nota="${n.id}">
        <div class="nota">${fechaLarga(parseFecha(n.fecha))} · ${TIPOS_NOTA[n.tipo]}${n.kg ? ` · <b>${r1(n.kg)} kg</b>` : ""}</div>
        <div class="txt">${esc(n.texto).replace(/\n/g, "<br>") || "<i>(sin texto)</i>"}</div></div>`).join("")
      : `<div class="vacio">Anota lo que observas, cosechas, plagas o tratamientos. Te sirve para comparar entre temporadas.</div>`}`;
}

function bindNotas(p) {
  $("#nota-nueva").onclick = () => editarNota(p, null);
  $$("#nota-filtro button").forEach((b) => b.onclick = () => { notaFiltro = b.dataset.k; renderPlan(); });
  $$("#p-body [data-nota]").forEach((el) => el.onclick = () => editarNota(p, el.dataset.nota));
}

function editarNota(p, id) {
  const cfg = p.cfg;
  cfg.notas = cfg.notas || [];
  const n = id ? cfg.notas.find((x) => x.id === id) : null;
  let tipo = n ? n.tipo : (notaFiltro !== "todas" ? notaFiltro : "obs");
  abrirSheet(`<h3>${n ? "✏️ Editar nota" : "📝 Nueva nota"}</h3>
    <label class="lbl">Tipo</label><div class="opts opts-nota" id="nt-tipo"></div>
    <div class="row2"><div><label class="lbl">Fecha</label><input id="nt-fecha" type="date" class="inp" value="${n ? n.fecha : hoyISO()}"></div>
      <div id="nt-kg-box"><label class="lbl">Kilos cosechados</label><input id="nt-kg" type="number" min="0" step="0.1" class="inp" inputmode="decimal" value="${n && n.kg ? n.kg : ""}"></div></div>
    <label class="lbl">Nota</label><textarea id="nt-texto" class="inp" rows="6" placeholder="¿Qué viste o hiciste?">${esc(n ? n.texto : "")}</textarea>
    <button class="btn-big mt" id="nt-ok">💾 Guardar</button>
    ${n ? `<button class="btn-danger" id="nt-del">🗑 Eliminar nota</button>` : ""}`, () => {
    const pintar = () => {
      $("#nt-tipo").innerHTML = Object.entries(TIPOS_NOTA).map(([k, v]) => `<button type="button" class="opt ${tipo === k ? "sel" : ""}" data-k="${k}">${v}</button>`).join("");
      $$("#nt-tipo .opt").forEach((b) => b.onclick = () => { tipo = b.dataset.k; pintar(); });
      $("#nt-kg-box").style.visibility = tipo === "cosecha" ? "visible" : "hidden";
    };
    pintar();
    $("#nt-ok").onclick = () => {
      const datos = { fecha: $("#nt-fecha").value || hoyISO(), tipo, texto: $("#nt-texto").value.trim(),
        kg: tipo === "cosecha" ? parseFloat($("#nt-kg").value) || null : null };
      if (!datos.texto && !datos.kg) return toast("Escribe algo en la nota");
      if (n) Object.assign(n, datos); else cfg.notas.push({ id: Date.now().toString(36), ...datos });
      persistirActual(false); cerrarSheet(); renderPlan(); toast("💾 Nota guardada");
    };
    const del = $("#nt-del");
    if (del) del.onclick = () => { if (!confirm("¿Eliminar la nota?")) return; cfg.notas = cfg.notas.filter((x) => x.id !== id); persistirActual(false); cerrarSheet(); renderPlan(); };
  });
}

// ---------- guardar / editar / borrar ----------
function guardarCfg(cfg, nuevo, resync = true) {
  const lista = cargar();
  if (nuevo || !cfg.id) { cfg.id = Date.now().toString(36); lista.unshift(cfg); }
  else { const i = lista.findIndex((x) => x.id === cfg.id); if (i >= 0) lista[i] = cfg; else lista.unshift(cfg); }
  guardarTodo(lista);
  if (resync) programarResync(cfg);
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
  const s = cfgActual.calendario && cfgActual.calendario.sync;
  if (nativo() && s && s.ids && Object.keys(s.ids).length) Android.borrarEventos(JSON.stringify(Object.values(s.ids)));
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
