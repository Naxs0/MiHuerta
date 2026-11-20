package cl.mihuerta.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Recibe la alarma programada y muestra la notificación. */
public class AvisoReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent it) {
        if (!Avisos.ACCION.equals(it.getAction())) return;
        Avisos.mostrar(ctx, it.getIntExtra("id", 1), it.getStringExtra("titulo"), it.getStringExtra("texto"));
    }
}
