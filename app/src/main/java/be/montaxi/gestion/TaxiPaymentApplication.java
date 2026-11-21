package be.montaxi.gestion;

import android.app.Application;
import com.sumup.reader.sdk.api.SumUpState;

/** Initialise le SDK SumUp une seule fois pour l'application Android. */
public final class TaxiPaymentApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        SumUpState.init(this);
    }
}
