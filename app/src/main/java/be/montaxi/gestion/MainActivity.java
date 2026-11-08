package be.montaxi.gestion;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.KeyEvent;
import android.view.View;
import android.view.Gravity;
import android.os.Build;
import android.os.CancellationSignal;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.text.InputType;
import android.webkit.*;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.view.animation.AccelerateDecelerateInterpolator;
import java.io.IOException;
import java.io.InputStream;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.*;
import java.security.SecureRandom;
import java.security.MessageDigest;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import android.util.Base64;

public class MainActivity extends Activity {
 private WebView web;
 private Bitmap splashPhoto;
 private static final long SPLASH_HOLD_MS=2600L;
 private static final long SPLASH_TRANSITION_MS=1700L;
 private static final int SPLASH_BACKGROUND=0xff101114;
 private boolean credentialPrompt;
 private SharedPreferences vault;
 private boolean unlocked=false, prompting=false;
 private static final long IDLE_TIMEOUT_MS=60000L;
 private long lastInteraction=SystemClock.elapsedRealtime();
 private long backgroundAt=-1L;
 private final Handler idleHandler=new Handler(Looper.getMainLooper());
 private final Runnable idleCheck=new Runnable(){@Override public void run(){if(unlocked){if(SystemClock.elapsedRealtime()-lastInteraction>=IDLE_TIMEOUT_MS){lockTaxi();}else idleHandler.postDelayed(this,Math.max(1000L,IDLE_TIMEOUT_MS-(SystemClock.elapsedRealtime()-lastInteraction)));}}};
 private void touchSession(){lastInteraction=SystemClock.elapsedRealtime();if(unlocked){idleHandler.removeCallbacks(idleCheck);idleHandler.postDelayed(idleCheck,IDLE_TIMEOUT_MS);}}
 private void lockTaxi(){idleHandler.removeCallbacks(idleCheck);if(!unlocked)return;unlocked=false;if(web!=null)web.onPause();showLock();}
 @Override public boolean dispatchTouchEvent(MotionEvent event){if(unlocked)touchSession();return super.dispatchTouchEvent(event);}
 @Override public boolean dispatchKeyEvent(KeyEvent event){if(unlocked)touchSession();return super.dispatchKeyEvent(event);}
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
  try(InputStream image=getAssets().open("app/mercedes-splash.webp")){
   splashPhoto=BitmapFactory.decodeStream(image);
  }catch(IOException ignored){
   // L'interface web conserve son propre écran de démarrage.
  }
 }
 private byte[] derive(char[] pin,byte[] salt) throws Exception {
  PBEKeySpec spec=new PBEKeySpec(pin,salt,210000,256);
  try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}
  finally{spec.clearPassword();java.util.Arrays.fill(pin,'\0');}
 }
 private int dp(int value){
  return Math.round(value*getResources().getDisplayMetrics().density);
 }
 private TextView lockText(String text,int size,int color){
  TextView view=new TextView(this);
  view.setText(text);
  view.setTextSize(size);
  view.setTextColor(color);
  view.setGravity(Gravity.CENTER);
  return view;
 }
 private Button lockButton(String label,int background,int foreground){
  Button button=new Button(this);
  GradientDrawable shape=new GradientDrawable();
  shape.setColor(background);
  shape.setCornerRadius(dp(14));
  button.setBackground(new android.graphics.drawable.RippleDrawable(
   android.content.res.ColorStateList.valueOf(0x408da7cb),shape,null));
  button.setText(label);
  button.setTextColor(foreground);
  button.setTextSize(16);
  button.setAllCaps(false);
  button.setMinHeight(dp(54));
  return button;
 }
 private void showLock() {
  ScrollView layout=new ScrollView(this);
  layout.setFillViewport(true);
  layout.setBackgroundColor(0xff0b1020);
  LinearLayout card=new LinearLayout(this);
  card.setOrientation(LinearLayout.VERTICAL);
  card.setGravity(Gravity.CENTER);
  card.setPadding(dp(24),dp(28),dp(24),dp(28));
  layout.addView(card);

  TextView title=lockText("🚕  Mon Taxi",30,Color.WHITE);
  title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
  card.addView(title);
  TextView subtitle=lockText("Déverrouille ton espace de travail",16,0xffb7c9df);
  subtitle.setPadding(0,dp(8),0,dp(26));
  card.addView(subtitle);

  Button fingerprint=lockButton("Utiliser mon empreinte",0xfffacc15,0xff171b25);
  fingerprint.setOnClickListener(v->authenticate());
  card.addView(fingerprint,new LinearLayout.LayoutParams(dp(270),-2));
  Button code=lockButton("Utiliser le code Samsung",0xff263851,Color.WHITE);
  code.setOnClickListener(v->deviceCredential());
  LinearLayout.LayoutParams codeLayout=new LinearLayout.LayoutParams(dp(270),-2);
  codeLayout.topMargin=dp(10);
  card.addView(code,codeLayout);
  if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(true);
  setContentView(layout);
  layout.post(()->{if(layout.isAttachedToWindow()&&canUseFingerprint())authenticate();});
 }
 private boolean canUseFingerprint(){
  if(Build.VERSION.SDK_INT<30)return false;
  BiometricManager manager=getSystemService(BiometricManager.class);
  return manager!=null&&manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
   ==BiometricManager.BIOMETRIC_SUCCESS;
 }
 private void authenticate(){
  if(prompting||unlocked)return;
  if(canUseFingerprint())showSystemPrompt(false);
  else deviceCredential();
 }
 private void showSystemPrompt(boolean useCode){
  prompting=true;
  credentialPrompt=useCode;
  CancellationSignal attempt=new CancellationSignal();
  biometric=attempt;
  BiometricPrompt.Builder builder=new BiometricPrompt.Builder(this).setTitle("Ouvrir Mon Taxi")
   .setAllowedAuthenticators(useCode?BiometricManager.Authenticators.DEVICE_CREDENTIAL:
    BiometricManager.Authenticators.BIOMETRIC_STRONG);
  if(!useCode){
   builder.setSubtitle("Utilise ton empreinte")
    .setNegativeButton("Code Samsung",getMainExecutor(),(dialog,which)->fallbackToCredential(attempt));
  }
  builder.build().authenticate(attempt,getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
   private int failedScans;
   @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){
    if(biometric!=attempt)return;
    biometric=null;
    prompting=false;
    credentialPrompt=false;
    openTaxi();
   }
   @Override public void onAuthenticationFailed(){
    if(!useCode&&biometric==attempt&&++failedScans>=3)fallbackToCredential(attempt);
   }
   @Override public void onAuthenticationError(int code,CharSequence message){
    if(biometric!=attempt)return;
    if(!useCode&&code!=BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
      &&code!=BiometricPrompt.BIOMETRIC_ERROR_CANCELED){
     fallbackToCredential(attempt);
     return;
    }
    biometric=null;
    prompting=false;
    credentialPrompt=false;
    if(useCode&&code!=BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
      &&code!=BiometricPrompt.BIOMETRIC_ERROR_CANCELED){
     Toast.makeText(MainActivity.this,message,Toast.LENGTH_LONG).show();
    }
   }
  });
 }
 private void fallbackToCredential(CancellationSignal attempt){
  if(biometric!=attempt)return;
  biometric=null;
  prompting=false;
  attempt.cancel();
  deviceCredential();
 }
 private void deviceCredential(){
  if(prompting||unlocked)return;
  KeyguardManager km=(KeyguardManager)getSystemService(Context.KEYGUARD_SERVICE);
  if(km==null||!km.isDeviceSecure()){
   Toast.makeText(this,"Configure d’abord le verrouillage sécurisé Samsung.",Toast.LENGTH_LONG).show();
   return;
  }
  if(Build.VERSION.SDK_INT>=30){
   showSystemPrompt(true);
   return;
  }
  android.content.Intent intent=km.createConfirmDeviceCredentialIntent("Ouvrir Mon Taxi","Confirme avec ton code Samsung");
  if(intent!=null){
   prompting=true;
   startActivityForResult(intent,91);
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,android.content.Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(requestCode==91){
   prompting=false;
   if(resultCode==RESULT_OK)openTaxi();
  }
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
  touchSession();
  FrameLayout content=new FrameLayout(this);
  content.setBackgroundColor(SPLASH_BACKGROUND);
  if(Build.VERSION.SDK_INT>=30){
   // Réserver les barres système et la découpe en mode bord à bord.
   getWindow().setDecorFitsSystemWindows(false);
   android.view.WindowInsetsController controller=getWindow().getInsetsController();
   if(controller!=null)controller.show(WindowInsets.Type.statusBars());
   content.setOnApplyWindowInsetsListener((view,insets)->{
    android.graphics.Insets safe=insets.getInsets(
     WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
    view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
    return WindowInsets.CONSUMED;
   });
  }
  boolean showPhoto=splashPhoto!=null&&ValueAnimator.areAnimatorsEnabled();
  if(showPhoto)showStartupPhoto(content);
  setContentView(content);
  content.requestApplyInsets();
  if(showPhoto){
   // Laisser Android dessiner la photo avant de monter la WebView.
   content.postOnAnimation(()->content.postOnAnimation(()->{
    if(unlocked&&content.isAttachedToWindow())attachTaxiWeb(content);
   }));
  }else attachTaxiWeb(content);
 }
 private void attachTaxiWeb(FrameLayout content){
  if(web==null){
   web=new WebView(this);
   web.setBackgroundColor(SPLASH_BACKGROUND);
   if(splashPhoto!=null){
    WebSettings settings=web.getSettings();
    settings.setUserAgentString(settings.getUserAgentString()+" MonTaxiNativeSplash");
   }
   web.setWebViewClient(new WebViewClient(){
    @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())view.loadUrl("file:///android_asset/index.html");}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){return !req.getUrl().toString().startsWith(APP_URL);}
   });
   web.setDownloadListener((url,userAgent,contentDisposition,mimeType,contentLength)->{
    try{
     if(url.startsWith("blob:")){
      Toast.makeText(this,"Préparation de la sauvegarde…",Toast.LENGTH_SHORT).show();
      String js="(function(){fetch("+org.json.JSONObject.quote(url)+").then(r=>r.blob()).then(b=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(b)})).then(v=>window.TaxiDownload.save(v)).catch(e=>console.error('Export',e))})()";
      web.evaluateJavascript(js,null);
     }else{
      android.app.DownloadManager.Request request=new android.app.DownloadManager.Request(android.net.Uri.parse(url));
      request.setTitle("Sauvegarde Gestion Taxi");
      request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS,"sauvegarde_gestion_taxi.json");
      ((android.app.DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
     }
    }catch(Exception e){Toast.makeText(this,"Export impossible : "+e.getMessage(),Toast.LENGTH_LONG).show();}
   });
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void save(String dataUrl){
     try{
      int comma=dataUrl.indexOf(',');
      if(comma<0)throw new IllegalArgumentException("Données invalides");
      byte[] bytes=android.util.Base64.decode(dataUrl.substring(comma+1),android.util.Base64.DEFAULT);
      android.content.ContentValues values=new android.content.ContentValues();
      values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME,"sauvegarde_gestion_taxi_"+new java.text.SimpleDateFormat("yyyy-MM-dd_HH-mm-ss",java.util.Locale.ROOT).format(new java.util.Date())+".json");
      values.put(android.provider.MediaStore.Downloads.MIME_TYPE,"application/json");
      values.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,android.os.Environment.DIRECTORY_DOWNLOADS);
      android.net.Uri target=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
      if(target==null)throw new IllegalStateException("Enregistrement impossible");
      try(java.io.OutputStream out=getContentResolver().openOutputStream(target)){if(out==null)throw new IllegalStateException("Fichier inaccessible");out.write(bytes);}
      runOnUiThread(()->Toast.makeText(MainActivity.this,"Sauvegarde enregistrée dans Téléchargements",Toast.LENGTH_LONG).show());
     }catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"Échec sauvegarde : "+e.getMessage(),Toast.LENGTH_LONG).show());}
    }
   },"TaxiDownload");
   web.setWebChromeClient(new WebChromeClient());
   WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setCacheMode(WebSettings.LOAD_NO_CACHE);
  }
  // Toujours charger la dernière version en ligne après déverrouillage.
  if(web.getUrl()==null)web.loadUrl(APP_URL);
  if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);
  content.addView(web,0,new FrameLayout.LayoutParams(-1,-1));
  web.onResume();
 }
 private void showStartupPhoto(FrameLayout content){
  LinearLayout art=new LinearLayout(this);
  art.setOrientation(LinearLayout.VERTICAL);
  ImageView photo=new ImageView(this);
  photo.setImageBitmap(splashPhoto);
  photo.setScaleType(ImageView.ScaleType.FIT_CENTER);
  GradientDrawable photoFrame=new GradientDrawable();
  photoFrame.setColor(SPLASH_BACKGROUND);
  photoFrame.setCornerRadius(dp(18));
  photo.setBackground(photoFrame);
  photo.setClipToOutline(true);
  GradientDrawable photoBorder=new GradientDrawable();
  photoBorder.setCornerRadius(dp(18));
  photoBorder.setStroke(dp(1),0x3294add0);
  photo.setForeground(photoBorder);
  art.addView(photo,new LinearLayout.LayoutParams(-1,0,1f));
  int labelHeight=dp(58)+dp(26);
  LinearLayout signature=new LinearLayout(this);
  signature.setOrientation(LinearLayout.VERTICAL);
  LinearLayout.LayoutParams signatureSize=new LinearLayout.LayoutParams(-2,labelHeight);
  signatureSize.gravity=Gravity.CENTER_HORIZONTAL;
  art.addView(signature,signatureSize);
  TextView title=lockText("TAXIMO",44,0xffe4edf9);
  title.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
  title.setLetterSpacing(.21f);
  title.getPaint().setShader(new LinearGradient(0f,0f,0f,title.getTextSize(),
   0xfff7faff,0xffb8cbe4,Shader.TileMode.CLAMP));
  signature.addView(title,new LinearLayout.LayoutParams(-2,dp(58)));
  String versionName="";
  try{versionName=getPackageManager().getPackageInfo(getPackageName(),0).versionName;}
  catch(PackageManager.NameNotFoundException ignored){}
  LinearLayout versionRow=new LinearLayout(this);
  versionRow.setGravity(Gravity.CENTER_VERTICAL);
  versionRow.setAlpha(0f);
  signature.addView(versionRow,new LinearLayout.LayoutParams(-1,dp(26)));
  View rule=new View(this);
  rule.setBackgroundColor(0xff35465e);
  LinearLayout.LayoutParams ruleSize=new LinearLayout.LayoutParams(0,dp(1),1f);
  ruleSize.setMarginEnd(dp(12));
  versionRow.addView(rule,ruleSize);
  TextView version=lockText(versionName,11,0xff96adca);
  version.setLetterSpacing(.15f);
  version.setSingleLine(true);
  versionRow.addView(version,new LinearLayout.LayoutParams(-2,-2));
  FrameLayout cover=new FrameLayout(this){
   @Override protected void onMeasure(int widthSpec,int heightSpec){
    int side=Math.max(0,Math.min(MeasureSpec.getSize(widthSpec),MeasureSpec.getSize(heightSpec)-labelHeight)-dp(24));
    FrameLayout.LayoutParams size=(FrameLayout.LayoutParams)art.getLayoutParams();
    size.width=side;
    size.height=side+labelHeight;
    super.onMeasure(widthSpec,heightSpec);
   }
  };
  View backdrop=new View(this);
  backdrop.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
   new int[]{0xff0a0d14,0xff151d2b,0xff0a0d14}));
  cover.addView(backdrop,new FrameLayout.LayoutParams(-1,-1));
  cover.setClickable(true);
  cover.addView(art,new FrameLayout.LayoutParams(0,0,Gravity.CENTER));
  content.addView(cover,new FrameLayout.LayoutParams(-1,-1));
  cover.postOnAnimation(()->versionRow.animate().alpha(1f).setDuration(450L).start());
  cover.postOnAnimation(()->cover.postDelayed(()->{
   if(!cover.isAttachedToWindow())return;
   if(web==null){
    content.removeView(cover);
    return;
   }
   ValueAnimator transition=ValueAnimator.ofFloat(0f,1f);
   transition.setDuration(SPLASH_TRANSITION_MS);
   transition.setInterpolator(new AccelerateDecelerateInterpolator());
   transition.addUpdateListener(new ValueAnimator.AnimatorUpdateListener(){
    private int photoBlur;
    private int appBlur=-1;
    @Override public void onAnimationUpdate(ValueAnimator frame){
     float progress=(float)frame.getAnimatedValue();
     float photoScale=1f-.92f*smoothStartupPhase(progress,0f,.88f);
     float appScale=.12f+.88f*smoothStartupPhase(progress,.1f,1f);
     art.setScaleX(photoScale);
     art.setScaleY(photoScale);
     web.setScaleX(appScale);
     web.setScaleY(appScale);
     backdrop.setAlpha(1f-smoothStartupPhase(progress,.12f,.85f));
     art.setAlpha(1f-smoothStartupPhase(progress,.42f,.88f));
     web.setAlpha(smoothStartupPhase(progress,.1f,.38f));
     if(Build.VERSION.SDK_INT>=31){
      int nextPhotoBlur=Math.round(12f*smoothStartupPhase(progress,.42f,.88f));
      int nextAppBlur=Math.round(9f*(1f-smoothStartupPhase(progress,.1f,.76f)));
      if(nextPhotoBlur!=photoBlur){
       photoBlur=nextPhotoBlur;
       setStartupBlur(art,dp(photoBlur));
      }
      if(nextAppBlur!=appBlur){
       appBlur=nextAppBlur;
       setStartupBlur(web,dp(appBlur));
      }
     }
    }
   });
   transition.addListener(new AnimatorListenerAdapter(){
    @Override public void onAnimationEnd(Animator animation){
     content.removeView(cover);
    }
   });
   transition.start();
  },SPLASH_HOLD_MS));
 }
 private float smoothStartupPhase(float progress,float start,float end){
  float fraction=Math.max(0f,Math.min(1f,(progress-start)/(end-start)));
  return fraction*fraction*(3f-2f*fraction);
 }
 private void setStartupBlur(View view,float radius){
  view.setRenderEffect(radius>0f?RenderEffect.createBlurEffect(radius,radius,Shader.TileMode.CLAMP):null);
 }
 @Override protected void onPause(){
  super.onPause();
  backgroundAt=SystemClock.elapsedRealtime();
  idleHandler.removeCallbacks(idleCheck);
 }
 @Override protected void onResume(){
  super.onResume();
  if(unlocked){
   if(SystemClock.elapsedRealtime()-lastInteraction>=IDLE_TIMEOUT_MS)lockTaxi();
   else touchSession();
  }
 }
 @Override protected void onStop(){
  super.onStop();
  // Une courte sortie de l'application ne ferme plus la session.
  if(!unlocked&&biometric!=null&&!credentialPrompt){
   CancellationSignal attempt=biometric;
   biometric=null;
   prompting=false;
   attempt.cancel();
  }
 }
 @Override public void onBackPressed(){if(unlocked&&web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}
