// =====================================================================
//  Copia de seguridad (Google Drive) y aviso de nuevas versiones
// =====================================================================
const REPO = "Naxs0/MiHuerta";
const VERSION_WEB = "2.0.0";
const nativo = () => typeof window.Android !== "undefined";

const Respaldo = (() => {
  const empaquetar = (cultivos) => JSON.stringify({ app: "MiHuerta", formato: 1, fecha: new Date().toISOString(), cultivos }, null, 1);

  function leer(texto) {
    const j = JSON.parse(texto);
    if (!j || !Array.isArray(j.cultivos)) throw new Error("El archivo no es una copia de Mi Huerta.");
    return j.cultivos.filter((c) => c && c.id && c.cultivo);
  }

  // Estado de la copia automática (solo app Android)
  const estado = () => (nativo() && Android.estadoCopia ? Android.estadoCopia() : "");

  // Se llama cada vez que cambian los datos
  function sincronizar(cultivos) {
    if (nativo() && estado()) Android.guardarCopia(empaquetar(cultivos));
  }

  // Crear archivo de copia: en Android abre el selector (elige Google Drive)
  function crear(cultivos) {
    const json = empaquetar(cultivos);
    const nombre = `mihuerta-copia.json`;
    if (nativo()) { Android.crearCopia(json, nombre); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Restaurar: en Android abre el selector; el resultado llega a window.alRestaurarCopia
  function restaurar(alTerminar) {
    window.alRestaurarCopia = (texto) => {
      try { alTerminar(null, leer(texto)); } catch (e) { alTerminar(e); }
    };
    if (nativo()) { Android.abrirCopia(); return; }
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => { const f = inp.files[0]; if (f) f.text().then(window.alRestaurarCopia); };
    inp.click();
  }

  function desactivar() { if (nativo() && Android.desactivarCopia) Android.desactivarCopia(); }

  return { crear, restaurar, sincronizar, estado, desactivar };
})();

const Actualizar = (() => {
  const version = () => (nativo() && Android.version ? Android.version() : VERSION_WEB);
  const comparar = (a, b) => {
    const pa = a.replace(/^v/, "").split(".").map(Number), pb = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
    return 0;
  };

  // Devuelve {version, url, notas} si hay una versión más nueva
  async function buscar(forzar) {
    const KEY = "mihuerta.update";
    if (!forzar) {
      try {
        const c = JSON.parse(localStorage.getItem(KEY));
        if (c && Date.now() - c.t < 6 * 3600 * 1000) return c.v && comparar(c.v.version, version()) > 0 ? c.v : null;
      } catch {}
    }
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (r.status === 404) return null;           // aún no hay versiones publicadas
    if (!r.ok) throw new Error("No se pudo revisar (" + r.status + ")");
    const j = await r.json();
    const apk = (j.assets || []).find((a) => a.name.toLowerCase().endsWith(".apk"));
    let v = null;
    if (j.tag_name && comparar(j.tag_name, version()) > 0) {
      v = { version: j.tag_name.replace(/^v/, ""), url: apk ? apk.browser_download_url : j.html_url, notas: j.body || "" };
    }
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v }));
    return v;
  }

  function abrir(url) {
    if (nativo() && Android.abrirEnlace) Android.abrirEnlace(url); else window.open(url, "_blank");
  }

  return { version, buscar, abrir };
})();
