// =====================================================================
//  Ubicación, mapa, clima de la zona y pronóstico (Open-Meteo + OpenStreetMap)
// =====================================================================
const Clima = (() => {
  const getJSON = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  };

  function gps() {
    return new Promise((ok, mal) => {
      if (!navigator.geolocation) return mal(new Error("Este equipo no tiene GPS disponible."));
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => mal(new Error(e.code === 1 ? "Permiso de ubicación denegado." : "No se pudo obtener la ubicación.")),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    });
  }

  async function nombreLugar(lat, lon) {
    try {
      const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&accept-language=es`);
      const a = j.address || {};
      const local = a.village || a.hamlet || a.suburb || a.town || a.city || a.municipality || a.county || "";
      const region = a.state || "";
      return { corto: local || region || "", largo: [local, a.city && a.city !== local ? a.city : "", region].filter(Boolean).join(", ") };
    } catch { return { corto: "", largo: "" }; }
  }

  async function buscar(q) {
    const j = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=es&q=${encodeURIComponent(q)}`);
    return j.map((x) => ({ lat: +x.lat, lon: +x.lon, nombre: x.display_name }));
  }

  // Clima típico de la ubicación con datos del último año completo
  async function climaUbicacion(lat, lon) {
    const anio = new Date().getFullYear() - 1;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&start_date=${anio}-01-01&end_date=${anio}-12-31&timezone=auto` +
      `&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_mean,temperature_2m_min,temperature_2m_max,relative_humidity_2m_mean,cloud_cover_mean`;
    const j = await getJSON(url);
    const d = j.daily;
    const et0 = Array(12).fill(0), lluvia = Array(12).fill(0), n = Array(12).fill(0);
    d.time.forEach((t, i) => {
      const m = +t.slice(5, 7) - 1;
      et0[m] += d.et0_fao_evapotranspiration[i] || 0; lluvia[m] += d.precipitation_sum[i] || 0; n[m]++;
    });
    const avg = (a) => a.reduce((s, x) => s + (x || 0), 0) / a.length;
    const temps = [...d.temperature_2m_mean].sort((a, b) => a - b);
    const amplitud = avg(temps.slice(-60)) - avg(temps.slice(0, 60));
    const r = {
      et0: et0.map((x, m) => Math.round((x / (n[m] || 1)) * 10) / 10),
      lluvia: lluvia.map((x) => Math.round(x)),
      lluviaAnual: Math.round(lluvia.reduce((s, x) => s + x, 0)),
      tMedia: Math.round(avg(d.temperature_2m_mean) * 10) / 10,
      tMin: Math.round(Math.min(...d.temperature_2m_min) * 10) / 10,
      tMax: Math.round(Math.max(...d.temperature_2m_max) * 10) / 10,
      heladas: d.temperature_2m_min.filter((t) => t <= 0).length,
      humedad: Math.round(avg(d.relative_humidity_2m_mean)),
      nubes: Math.round(avg(d.cloud_cover_mean)),
      elevacion: Math.round(j.elevation),
      amplitud: Math.round(amplitud * 10) / 10,
      anio,
    };
    r.zona = clasificarZona(r);
    r.sol = r.nubes < 45 ? "sol" : r.nubes < 60 ? "mixto" : "nublado";
    return r;
  }

  function clasificarZona(r) {
    if (r.elevacion >= 1200 || r.heladas >= 40) return "cordillera";
    if (r.lluviaAnual >= 900) return "sur";
    if (r.lluviaAnual < 200) return "norte";
    if (r.amplitud <= 10 && r.humedad >= 72) return "costa";
    return "valle";
  }

  // Pronóstico de 7 días (se guarda 3 horas)
  async function pronostico(lat, lon) {
    const key = `mihuerta.pron.${lat.toFixed(2)},${lon.toFixed(2)}`;
    try {
      const c = JSON.parse(localStorage.getItem(key));
      if (c && Date.now() - c.t < 3 * 3600 * 1000) return c.v;
    } catch {}
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max` +
      `&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto&forecast_days=7`);
    const d = j.daily;
    const v = {
      actual: { temp: j.current.temperature_2m, hum: j.current.relative_humidity_2m, code: j.current.weather_code },
      dias: d.time.map((t, i) => ({
        fecha: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
        lluvia: d.precipitation_sum[i] || 0, prob: d.precipitation_probability_max[i] || 0,
        et0: d.et0_fao_evapotranspiration[i] || 0, viento: d.wind_speed_10m_max[i] || 0 })),
    };
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
    return v;
  }

  function icono(code) {
    if (code === 0) return "☀️";
    if (code <= 2) return "🌤️";
    if (code === 3) return "☁️";
    if (code <= 48) return "🌫️";
    if (code <= 57) return "🌦️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "🌨️";
    if (code <= 82) return "🌧️";
    if (code <= 86) return "🌨️";
    return "⛈️";
  }

  // ---------- Mapa (Leaflet) ----------
  let mapa = null, marcador = null;
  function abrirMapa(div, inicial, alElegir) {
    if (typeof L === "undefined") throw new Error("El mapa no está disponible.");
    const centro = inicial ? [inicial.lat, inicial.lon] : [-33.45, -70.66];
    if (!mapa) {
      mapa = L.map(div, { zoomControl: true }).setView(centro, inicial ? 14 : 6);
      const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "© OpenStreetMap" });
      const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Imágenes © Esri" });
      satelite.addTo(mapa);
      L.control.layers({ "Satélite": satelite, "Mapa": calles }).addTo(mapa);
      mapa.on("click", (ev) => { poner(ev.latlng.lat, ev.latlng.lng); mapa._alElegir(ev.latlng.lat, ev.latlng.lng); });
    }
    mapa._alElegir = alElegir;
    setTimeout(() => { mapa.invalidateSize(); if (inicial) { mapa.setView(centro, 14); poner(inicial.lat, inicial.lon); } }, 50);
  }
  function poner(lat, lon) {
    if (!mapa) return;
    if (marcador) marcador.setLatLng([lat, lon]); else marcador = L.marker([lat, lon]).addTo(mapa);
  }
  function centrar(lat, lon) { if (mapa) { mapa.setView([lat, lon], 15); poner(lat, lon); } }

  return { gps, nombreLugar, buscar, climaUbicacion, pronostico, icono, abrirMapa, centrar };
})();
