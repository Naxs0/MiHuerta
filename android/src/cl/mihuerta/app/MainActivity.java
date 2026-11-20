package cl.mihuerta.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.provider.OpenableColumns;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.TimeZone;

public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String INICIO = "https://" + HOST + "/www/index.html";
    static final int REQ_CREAR = 1, REQ_ABRIR = 2, REQ_GPS = 3, REQ_CAL = 4;

    private WebView web;
    private SharedPreferences prefs;
    private String jsonPendiente;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigen;
    private boolean limpiarHistorial = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("mihuerta", MODE_PRIVATE);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(true);          // solo para recuperar datos de la versión 1
        s.setTextZoom(100);
        web.addJavascriptInterface(new Puente(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.equals("/www/")) path = "/www/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mime(path), "utf-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "No encontrado", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) || "file".equals(u.getScheme())) return false;
                abrirExterno(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                if (limpiarHistorial && url.startsWith("https://" + HOST)) {
                    v.clearHistory();
                    limpiarHistorial = false;
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (tieneGps()) {
                    cb.invoke(origin, true, false);
                } else {
                    geoCb = cb;
                    geoOrigen = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GPS);
                }
            }
        });

        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else if (!prefs.getBoolean("migrado", false)) web.loadUrl("file:///android_asset/www/migrar.html");
        else web.loadUrl(INICIO);
    }

    private boolean tieneGps() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permisos, int[] res) {
        if (code == REQ_GPS && geoCb != null) {
            boolean ok = false;
            for (int r : res) ok |= (r == PackageManager.PERMISSION_GRANTED);
            geoCb.invoke(geoOrigen, ok, false);
            geoCb = null;
        }
        if (code == REQ_CAL) {
            if (tieneCalendario()) listarCalendariosAhora();
            else llamarJs("alErrorCalendario", "Sin permiso para usar el calendario. Puedes darlo en Ajustes > Apps > Mi Huerta > Permisos.");
        }
    }

    // ---------- Calendario del teléfono (Google Calendar) ----------
    private boolean tieneCalendario() {
        return checkSelfPermission(Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    private void listarCalendariosAhora() {
        new Thread(() -> {
            JSONArray arr = new JSONArray();
            String[] cols = {CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                    CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.ACCOUNT_TYPE,
                    CalendarContract.Calendars.IS_PRIMARY};
            String sel = CalendarContract.Calendars.VISIBLE + "=1 AND " + CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL
                    + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR;
            try (Cursor c = getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols, sel, null, null)) {
                while (c != null && c.moveToNext()) {
                    JSONObject o = new JSONObject();
                    o.put("id", c.getLong(0));
                    o.put("nombre", c.getString(1));
                    o.put("cuenta", c.getString(2));
                    o.put("google", "com.google".equals(c.getString(3)) ? 1 : 0);
                    o.put("principal", c.getInt(4));
                    arr.put(o);
                }
                llamarJs("alCalendarios", arr.toString());
            } catch (Exception e) {
                llamarJs("alErrorCalendario", "No se pudieron leer los calendarios: " + e.getMessage());
            }
        }).start();
    }

    private void borrarIds(JSONArray ids) {
        ContentResolver cr = getContentResolver();
        for (int i = 0; i < ids.length(); i++) {
            try {
                cr.delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, ids.getLong(i)), null, null);
            } catch (Exception ignored) { }
        }
    }

    static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    private void abrirExterno(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir el enlace", Toast.LENGTH_SHORT).show();
        }
    }

    private void llamarJs(final String fn, final String arg) {
        web.post(() -> web.evaluateJavascript(
                "window." + fn + " && window." + fn + "(" + JSONObject.quote(arg) + ")", null));
    }

    // ---------- Copia de seguridad (Storage Access Framework: Google Drive, etc.) ----------
    private void escribir(Uri uri, String json) throws IOException {
        byte[] datos = json.getBytes(StandardCharsets.UTF_8);
        // Rellenar con espacios por si el proveedor no trunca el archivo (JSON los ignora)
        int anterior = prefs.getInt("copiaLargo", 0);
        if (datos.length < anterior) {
            byte[] relleno = Arrays.copyOf(datos, anterior);
            Arrays.fill(relleno, datos.length, anterior, (byte) ' ');
            datos = relleno;
        }
        OutputStream os;
        try {
            os = getContentResolver().openOutputStream(uri, "wt");
        } catch (Exception e) {
            os = getContentResolver().openOutputStream(uri, "w");
        }
        if (os == null) throw new IOException("No se pudo abrir el archivo");
        try { os.write(datos); } finally { os.close(); }
        prefs.edit().putInt("copiaLargo", Math.max(anterior, datos.length)).apply();
    }

    private String leer(Uri uri) throws IOException {
        InputStream in = getContentResolver().openInputStream(uri);
        if (in == null) throw new IOException("No se pudo leer el archivo");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        try { while ((n = in.read(buf)) > 0) out.write(buf, 0, n); } finally { in.close(); }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private String nombreDe(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return "copia de Mi Huerta";
    }

    private void fijarCopia(Uri uri) {
        prefs.edit().putString("copiaUri", uri.toString()).putString("copiaNombre", nombreDe(uri)).putInt("copiaLargo", 0).apply();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (res != RESULT_OK || data == null || data.getData() == null) return;
        final Uri uri = data.getData();
        final int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        boolean escritura = true;
        try {
            getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (Exception e) {
            escritura = false;
            try { getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
        }
        final boolean puedeEscribir = escritura;

        if (req == REQ_CREAR) {
            final String json = jsonPendiente;
            new Thread(() -> {
                try {
                    fijarCopia(uri);
                    escribir(uri, json);
                    llamarJs("alCopiaCreada", prefs.getString("copiaNombre", ""));
                } catch (Exception e) {
                    prefs.edit().remove("copiaUri").apply();
                    llamarJs("alErrorCopia", "No se pudo guardar la copia: " + e.getMessage());
                }
            }).start();
        } else if (req == REQ_ABRIR) {
            new Thread(() -> {
                try {
                    String texto = leer(uri);
                    if (puedeEscribir) fijarCopia(uri);   // seguir guardando en el mismo archivo
                    llamarJs("alRestaurarCopia", texto);
                } catch (Exception e) {
                    llamarJs("alErrorCopia", "No se pudo leer la copia: " + e.getMessage());
                }
            }).start();
        }
    }

    class Puente {
        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "0";
            }
        }

        @JavascriptInterface
        public void abrirEnlace(String url) {
            runOnUiThread(() -> abrirExterno(Uri.parse(url)));
        }

        @JavascriptInterface
        public String estadoCopia() {
            return prefs.getString("copiaUri", null) == null ? "" : prefs.getString("copiaNombre", "copia");
        }

        @JavascriptInterface
        public void crearCopia(String json, String nombre) {
            jsonPendiente = json;
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, nombre);
                startActivityForResult(i, REQ_CREAR);
            });
        }

        @JavascriptInterface
        public void guardarCopia(final String json) {
            final String u = prefs.getString("copiaUri", null);
            if (u == null) return;
            new Thread(() -> {
                try {
                    escribir(Uri.parse(u), json);
                } catch (Exception e) {
                    llamarJs("alErrorCopia", "No se pudo actualizar la copia en Drive (" + e.getMessage() + "). Revisa tu conexión o vuelve a activarla.");
                }
            }).start();
        }

        @JavascriptInterface
        public void abrirCopia() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                startActivityForResult(i, REQ_ABRIR);
            });
        }

        @JavascriptInterface
        public void desactivarCopia() {
            String u = prefs.getString("copiaUri", null);
            if (u != null) {
                try {
                    getContentResolver().releasePersistableUriPermission(Uri.parse(u),
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception ignored) { }
            }
            prefs.edit().remove("copiaUri").remove("copiaNombre").remove("copiaLargo").apply();
        }

        // ----- calendario del teléfono -----
        @JavascriptInterface
        public void listarCalendarios() {
            if (tieneCalendario()) listarCalendariosAhora();
            else runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CALENDAR,
                    Manifest.permission.WRITE_CALENDAR}, REQ_CAL));
        }

        @JavascriptInterface
        public void sincronizarCalendario(final String calId, final String eventosJson, final String borrarJson,
                                          final int aviso, final String token) {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                JSONObject ids = new JSONObject();
                try {
                    res.put("token", token);
                    if (!tieneCalendario()) throw new Exception("Sin permiso de calendario");
                    borrarIds(new JSONArray(borrarJson));
                    JSONArray evs = new JSONArray(eventosJson);
                    ContentResolver cr = getContentResolver();
                    String tz = TimeZone.getDefault().getID();
                    for (int i = 0; i < evs.length(); i++) {
                        JSONObject e = evs.getJSONObject(i);
                        ContentValues v = new ContentValues();
                        long ini = e.getLong("inicio");
                        v.put(CalendarContract.Events.CALENDAR_ID, Long.parseLong(calId));
                        v.put(CalendarContract.Events.TITLE, e.getString("titulo"));
                        v.put(CalendarContract.Events.DESCRIPTION, e.optString("desc"));
                        v.put(CalendarContract.Events.DTSTART, ini);
                        v.put(CalendarContract.Events.EVENT_TIMEZONE, tz);
                        v.put(CalendarContract.Events.HAS_ALARM, 1);
                        String rrule = e.optString("rrule", "");
                        int dur = e.optInt("durMin", 30);
                        if (rrule.length() > 0) {
                            v.put(CalendarContract.Events.RRULE, rrule);
                            v.put(CalendarContract.Events.DURATION, "PT" + dur + "M");
                        } else {
                            v.put(CalendarContract.Events.DTEND, ini + dur * 60000L);
                        }
                        Uri u = cr.insert(CalendarContract.Events.CONTENT_URI, v);
                        if (u == null) continue;
                        long id = Long.parseLong(u.getLastPathSegment());
                        ContentValues r = new ContentValues();
                        r.put(CalendarContract.Reminders.EVENT_ID, id);
                        r.put(CalendarContract.Reminders.MINUTES, aviso);
                        r.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                        cr.insert(CalendarContract.Reminders.CONTENT_URI, r);
                        ids.put(e.getString("key"), id);
                    }
                    res.put("ids", ids);
                } catch (Exception ex) {
                    try { res.put("ids", ids); res.put("error", "No se pudo actualizar el calendario: " + ex.getMessage()); } catch (Exception ignored) { }
                }
                llamarJs("alCalendarioSincronizado", res.toString());
            }).start();
        }

        @JavascriptInterface
        public void borrarEventos(final String idsJson) {
            new Thread(() -> {
                try { if (tieneCalendario()) borrarIds(new JSONArray(idsJson)); } catch (Exception ignored) { }
            }).start();
        }

        // ----- recuperar datos guardados por la versión 1 -----
        @JavascriptInterface
        public void guardarMigracion(String datos) {
            prefs.edit().putString("datosV1", datos == null ? "" : datos).putBoolean("migrado", true).apply();
            limpiarHistorial = true;
            runOnUiThread(() -> web.loadUrl(INICIO));
        }

        @JavascriptInterface
        public String datosMigrados() {
            return prefs.getString("datosV1", "");
        }

        @JavascriptInterface
        public void limpiarMigracion() {
            prefs.edit().remove("datosV1").apply();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
