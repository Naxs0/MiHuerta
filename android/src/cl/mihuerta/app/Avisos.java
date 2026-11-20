package cl.mihuerta.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Programa y muestra las notificaciones de Mi Huerta (funcionan con la app cerrada). */
public final class Avisos {
    static final String CANAL = "avisos";
    static final String ACCION = "cl.mihuerta.app.AVISO";
    static final int BASE = 5000;

    private Avisos() { }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("mihuerta", Context.MODE_PRIVATE);
    }

    /** lista: [{id, t (ms), titulo, texto}] — reemplaza todo lo programado antes. */
    static void programar(Context ctx, String json) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(ctx);
        int previos = p.getInt("avisosN", 0);
        for (int i = 0; i < previos; i++) {
            PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE + i, new Intent(ctx, AvisoReceiver.class).setAction(ACCION),
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
        int n = 0;
        try {
            JSONArray arr = new JSONArray(json);
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                long t = o.getLong("t");
                if (t <= ahora) continue;
                Intent it = new Intent(ctx, AvisoReceiver.class).setAction(ACCION)
                        .putExtra("id", o.optInt("id", i))
                        .putExtra("titulo", o.optString("titulo"))
                        .putExtra("texto", o.optString("texto"));
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE + n, it,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                n++;
            }
        } catch (Exception ignored) { }
        p.edit().putInt("avisosN", n).putString("avisosJson", json).apply();
    }

    /** Vuelve a programar lo guardado (después de reiniciar el teléfono o actualizar la app). */
    static void reprogramar(Context ctx) {
        String json = prefs(ctx).getString("avisosJson", null);
        if (json != null) programar(ctx, json);
    }

    static void mostrar(Context ctx, int id, String titulo, String texto) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Avisos de la huerta", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Tareas del día, riegos, abonos y alertas de heladas");
            nm.createNotificationChannel(ch);
        }
        Intent abrir = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CANAL) : new Notification.Builder(ctx);
        String resumen = texto.contains("\n") ? texto.substring(0, texto.indexOf('\n')) : texto;
        b.setSmallIcon(R.drawable.ic_notif)
                .setColor(Color.parseColor("#2e7d32"))
                .setContentTitle(titulo)
                .setContentText(resumen)
                .setStyle(new Notification.BigTextStyle().bigText(texto))
                .setAutoCancel(true)
                .setContentIntent(pi);
        nm.notify(id, b.build());
    }
}
