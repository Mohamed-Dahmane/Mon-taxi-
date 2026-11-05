package be.montaxi.gestion;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Build;
import android.os.CancellationSignal;
import android.hardware.biometrics.BiometricPrompt;
import android.content.SharedPreferences;
import android.text.InputType;
import android.webkit.*;
import android.view.WindowManager;
import android.graphics.Color;
import android.widget.*;
import java.security.SecureRandom;
import java.security.MessageDigest;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import android.util.Base64;

public class MainActivity extends Activity {
 private WebView web;
 private SharedPreferences vault;
 private boolean unlocked=false, prompting=false;
 private CancellationSignal biometric;
 private static final String APP_URL="https://mohamed-dahmane.github.io/Mon-taxi-/";
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  vault=getSharedPreferences("taxi-lock",MODE_PRIVATE);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
  getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
  getWindow().getDecorView().setSystemUiVisibility(0);
  getWindow().setStatusBarColor(Color.rgb(17,24,39));
  showLock();
 }
 private byte[] derive(char[] pin,byte[] salt) throws Exception {
  PBEKeySpec spec=new PBEKeySpec(pin,salt,210000,256);
  try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}
  finally{spec.clearPassword();java.util.Arrays.fill(pin,'\0');}
 }
 private void showLock() {
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(36,80,36,36);
  TextView title=new TextView(this);title.setText("Mon Taxi · accès privé");title.setTextSize(24);layout.addView(title);
  TextView hint=new TextView(this);hint.setText("Déverrouille avec ton empreinte ou ton code PIN Mon Taxi.");layout.addView(hint);
  Button finger=new Button(this);finger.setText("Utiliser mon empreinte");layout.addView(finger);
  Button pin=new Button(this);pin.setText(vault.contains("hash")?"Utiliser mon PIN Mon Taxi":"Créer mon PIN Mon Taxi");layout.addView(pin);
  finger.setOnClickListener(v->authenticate());
  pin.setOnClickListener(v->pinDialog(!vault.contains("hash")));
  setContentView(layout);
  if(!vault.contains("hash"))hint.setText("Choisis d’abord un PIN Mon Taxi de 6 chiffres. La connexion privée au compte reste nécessaire lors de la première utilisation.");
 }
 private void authenticate() {
  if(!vault.contains("hash")){pinDialog(true);return;}
  if(Build.VERSION.SDK_INT<28){pinDialog(false);return;}
  if(prompting)return;prompting=true;
  biometric=new CancellationSignal();
  new BiometricPrompt.Builder(this).setTitle("Ouvrir Mon Taxi").setSubtitle("Confirme avec ton empreinte")
   .setNegativeButton("Code PIN Mon Taxi",getMainExecutor(),(d,w)->{prompting=false;pinDialog(false);})
   .build().authenticate(biometric,getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r){prompting=false;openTaxi();}
    @Override public void onAuthenticationError(int code,CharSequence message){prompting=false;if(code!=BiometricPrompt.BIOMETRIC_ERROR_CANCELED&&code!=BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED)Toast.makeText(MainActivity.this,"Empreinte indisponible : utilise ton PIN Mon Taxi.",Toast.LENGTH_LONG).show();}
   });
 }
 private void pinDialog(boolean setup) {
  long remaining=vault.getLong("blockedUntil",0)-System.currentTimeMillis();
  if(!setup&&remaining>0){Toast.makeText(this,"Réessaie dans "+((remaining+999)/1000)+" secondes, ou utilise ton empreinte.",Toast.LENGTH_LONG).show();return;}
  LinearLayout fields=new LinearLayout(this);fields.setPadding(28,12,28,12);fields.setOrientation(LinearLayout.VERTICAL);
  EditText pin=new EditText(this);pin.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_VARIATION_PASSWORD);pin.setHint("PIN de 6 chiffres");fields.addView(pin);
  EditText confirm=new EditText(this);confirm.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_VARIATION_PASSWORD);confirm.setHint("Confirmer le PIN");if(setup)fields.addView(confirm);
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle(setup?"Créer le PIN Mon Taxi":"PIN Mon Taxi").setView(fields).setNegativeButton("Annuler",null).setPositiveButton(setup?"Enregistrer":"Ouvrir",null).create();
  dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String value=pin.getText().toString();
   if(!value.matches("[0-9]{6}")){pin.setError("Saisis 6 chiffres");return;}
   if(setup&&!value.equals(confirm.getText().toString())){confirm.setError("Les codes doivent être identiques");return;}
   dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
   new Thread(()->{
    try {
     boolean valid;
     if(setup){
      byte[] salt=new byte[32];new SecureRandom().nextBytes(salt);
      byte[] hash=derive(value.toCharArray(),salt);
      vault.edit().putString("salt",Base64.encodeToString(salt,Base64.NO_WRAP)).putString("hash",Base64.encodeToString(hash,Base64.NO_WRAP)).commit();valid=true;
     }else{
      byte[] salt=Base64.decode(vault.getString("salt",""),Base64.NO_WRAP);
      valid=MessageDigest.isEqual(derive(value.toCharArray(),salt),Base64.decode(vault.getString("hash",""),Base64.NO_WRAP));
     }
     if(valid){vault.edit().remove("failures").remove("blockedUntil").commit();runOnUiThread(()->{dialog.dismiss();openTaxi();});}
     else{
      int failures=vault.getInt("failures",0)+1;
      long delay=failures>=5?Math.min(3600000L,30000L*(1L<<Math.min(failures-5,7))):0;
      vault.edit().putInt("failures",failures).putLong("blockedUntil",System.currentTimeMillis()+delay).commit();
      runOnUiThread(()->{dialog.dismiss();Toast.makeText(this,delay>0?"Trop d’essais. Patiente avant de réessayer.":"PIN incorrect.",Toast.LENGTH_LONG).show();});
     }
    }catch(Exception e){runOnUiThread(()->{dialog.dismiss();Toast.makeText(this,"Déverrouillage impossible. Réessaie.",Toast.LENGTH_LONG).show();});}
   }).start();
  }));dialog.show();
 }
 private void openTaxi() {
  unlocked=true;
  if(web==null){
   web=new WebView(this);
   web.setWebViewClient(new WebViewClient(){
    @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())view.loadUrl("file:///android_asset/index.html");}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){return !req.getUrl().toString().startsWith(APP_URL);}
   });
   web.setWebChromeClient(new WebChromeClient());
   WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
   web.loadUrl(APP_URL);
  }
  if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);
  setContentView(web);web.onResume();
 }
 @Override protected void onStop(){
  super.onStop();
  if(biometric!=null){biometric.cancel();biometric=null;}prompting=false;
  if(unlocked){unlocked=false;if(web!=null)web.onPause();showLock();}
 }
 @Override public void onBackPressed(){if(unlocked&&web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}
