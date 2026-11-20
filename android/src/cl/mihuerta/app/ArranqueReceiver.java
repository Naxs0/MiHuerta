package cl.mihuerta.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el teléfono o actualizar la app, las alarmas se pierden: se vuelven a programar. */
public class ArranqueReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent it) {
        String a = it.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Avisos.reprogramar(ctx);
        }
    }
}
