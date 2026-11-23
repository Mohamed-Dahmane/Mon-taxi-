package be.montaxi.gestion;

import android.app.Application;
import com.sumup.reader.sdk.api.SumUpState;

/** Initialize the SumUp reader SDK once before any checkout activity. */
public final class TaxiApplication extends Application {
 @Override public void onCreate() {
  super.onCreate();
  SumUpState.init(this);
 }
}
