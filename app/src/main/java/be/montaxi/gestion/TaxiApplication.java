package be.montaxi.gestion;

import android.app.Application;
import com.sumup.reader.sdk.api.SumUpState;

public final class TaxiApplication extends Application {
 @Override public void onCreate() {
  super.onCreate();
  SumUpState.init(this);
 }
}
