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
import android.graphics.Canvas;
import android.graphics.Paint;
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
 private FrameLayout unlockContent;
 private Runnable revealHome;
 private Bitmap splashPhoto;
 private Bitmap splashStudio;
 private static final long SPLASH_ENTRANCE_MS=1150L;
 private static final long SPLASH_TRANSITION_MS=1700L;
 private static final long SPLASH_FINGERPRINT_HOLD_MS=1000L;
 private static final int SPLASH_BACKGROUND=0xff101114;
 private boolean credentialPrompt, credentialOffered, autoPromptPending, resumed;
 private boolean unlockedWithFingerprint;
 private TextView lockAction;
 private SharedPreferences vault;
 private boolean unlocked=false, prompting=false;
 private static final long IDLE_TIMEOUT_MS=60000L;
 private long lastInteraction=SystemClock.elapsedRealtime();
 private final Handler idleHandler=new Handler(Looper.getMainLooper());
 private final Runnable idleCheck=this::checkIdleTimeout;
 private void checkIdleTimeout(){
  idleHandler.removeCallbacks(idleCheck);
  if(!unlocked)return;
  long remaining=IDLE_TIMEOUT_MS-(SystemClock.elapsedRealtime()-lastInteraction);
  if(remaining<=0L)lockTaxi();
  else if(resumed)idleHandler.postDelayed(idleCheck,remaining);
 }
 private void touchSession(){
  lastInteraction=SystemClock.elapsedRealtime();
  checkIdleTimeout();
 }
 private void lockTaxi(){idleHandler.removeCallbacks(idleCheck);if(!unlocked)return;unlocked=false;if(web!=null){web.setVisibility(View.INVISIBLE);web.onPause();}showLock();}
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
  try(InputStream image=getAssets().open("app/mercedes-foreground.webp");
      InputStream studio=getAssets().open("app/mercedes-studio.webp")){
   splashStudio=BitmapFactory.decodeStream(studio);
   if(splashStudio!=null)splashPhoto=BitmapFactory.decodeStream(image);
  }catch(IOException ignored){
   // L'interface web conserve son propre écran de démarrage.
  }
  showLock();
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
 private void showLock() {
  FrameLayout content=createTaxiContent();
  unlockContent=content;
  credentialOffered=false;
  autoPromptPending=true;
  revealHome=showStartupPhoto(content);
  setContentView(content);
  content.requestApplyInsets();
  scheduleFingerprint();
 }
 private void scheduleFingerprint(){
  FrameLayout content=unlockContent;
  if(!resumed||!autoPromptPending||content==null)return;
  content.postOnAnimation(()->{
   if(!resumed||!autoPromptPending||unlockContent!=content)return;
   autoPromptPending=false;
   authenticate();
  });
 }
 private void showLockAction(boolean offerCode){
  if(lockAction==null)return;
  credentialOffered=offerCode;
  lockAction.setText(offerCode?"Utiliser le code Samsung":"Réessayer l’empreinte");
  lockAction.setOnClickListener(view->{
   if(credentialOffered)deviceCredential();
   else authenticate();
  });
  lockAction.setVisibility(View.VISIBLE);
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
  else showLockAction(true);
 }
 private void showSystemPrompt(boolean useCode){
  prompting=true;
  credentialPrompt=useCode;
  if(lockAction!=null)lockAction.setVisibility(View.INVISIBLE);
  CancellationSignal attempt=new CancellationSignal();
  biometric=attempt;
  BiometricPrompt.Builder builder=new BiometricPrompt.Builder(this).setTitle("Ouvrir Mon Taxi")
   .setAllowedAuthenticators(useCode?BiometricManager.Authenticators.DEVICE_CREDENTIAL:
    BiometricManager.Authenticators.BIOMETRIC_STRONG);
  if(!useCode){
   builder.setSubtitle("Utilise ton empreinte")
    .setNegativeButton("Annuler",getMainExecutor(),(dialog,which)->{
     if(biometric!=attempt)return;
     biometric=null;
     prompting=false;
     showLockAction(false);
    });
  }
  builder.build().authenticate(attempt,getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
   private int failedScans;
   @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){
    if(biometric!=attempt)return;
    biometric=null;
    prompting=false;
    credentialPrompt=false;
    lockAction=null;
    openTaxi(!useCode);
   }
   @Override public void onAuthenticationFailed(){
    if(!useCode&&biometric==attempt&&++failedScans>=3)offerCredential(attempt);
   }
   @Override public void onAuthenticationError(int code,CharSequence message){
    if(biometric!=attempt)return;
    boolean canceled=code==BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
     ||code==BiometricPrompt.BIOMETRIC_ERROR_CANCELED;
    biometric=null;
    prompting=false;
    credentialPrompt=false;
    showLockAction(useCode||!canceled);
    if(useCode&&!canceled){
     Toast.makeText(MainActivity.this,message,Toast.LENGTH_LONG).show();
    }
   }
  });
 }
 private void offerCredential(CancellationSignal attempt){
  if(biometric!=attempt)return;
  biometric=null;
  prompting=false;
  attempt.cancel();
  showLockAction(true);
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
 private FrameLayout createTaxiContent(){
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
  return content;
 }
 private void openTaxi(){openTaxi(false);}
 private void openTaxi(boolean withFingerprint) {
  unlockedWithFingerprint=withFingerprint;
  unlocked=true;
  touchSession();
  FrameLayout content=unlockContent;
  Runnable reveal=revealHome;
  unlockContent=null;
  revealHome=null;
  if(content!=null&&reveal!=null&&content.isAttachedToWindow()){
   attachTaxiWeb(content,true);
   content.postOnAnimation(reveal);
   return;
  }
  content=createTaxiContent();
  setContentView(content);
  content.requestApplyInsets();
  attachTaxiWeb(content,false);
 }
 private void attachTaxiWeb(FrameLayout content,boolean covered){
  if(web==null){
   web=new WebView(this);
   web.setBackgroundColor(SPLASH_BACKGROUND);
   WebSettings settings=web.getSettings();
   settings.setUserAgentString(settings.getUserAgentString()+" MonTaxiNativeSplash");
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
  if(web.getUrl()==null)web.loadUrl(APP_URL+"?appbuild=5");
  if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);
  web.setVisibility(covered?View.INVISIBLE:View.VISIBLE);
  web.setAlpha(covered?0f:1f);
  content.addView(web,0,new FrameLayout.LayoutParams(-1,-1));
  web.onResume();
 }
 private Runnable showStartupPhoto(FrameLayout content){
  LinearLayout art=new LinearLayout(this);
  art.setOrientation(LinearLayout.VERTICAL);
  FrameLayout scene=new FrameLayout(this);


  FrameLayout vehicle=new FrameLayout(this);
  vehicle.setScaleX(.84f);
  vehicle.setScaleY(.84f);
  scene.addView(vehicle,new FrameLayout.LayoutParams(-1,-1));
  GradientDrawable shadowFill=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
   new int[]{0xc0000000,0x5c000000,0x00000000});
  shadowFill.setGradientType(GradientDrawable.RADIAL_GRADIENT);
  View shadow=new View(this);
  shadow.setBackground(shadowFill);
  shadow.setScaleY(.11f);
  vehicle.addView(shadow,new FrameLayout.LayoutParams(-1,-1));
  ImageView photo=new ImageView(this);
  photo.setImageBitmap(splashPhoto);
  photo.setScaleType(ImageView.ScaleType.FIT_CENTER);
  vehicle.addView(photo,new FrameLayout.LayoutParams(-1,-1));
  WheelTreads treads=new WheelTreads();
  vehicle.addView(treads,new FrameLayout.LayoutParams(-1,-1));

  scene.addOnLayoutChangeListener((view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->{
   int side=Math.min(right-left,bottom-top);
   shadowFill.setGradientRadius(Math.max(1f,.4f*side));
   shadow.setTranslationY(.41f*side);
  });
  art.addView(scene,new LinearLayout.LayoutParams(-1,0,1f));
  int labelHeight=dp(58)+dp(9)+dp(27)+dp(28);
  LinearLayout signature=new LinearLayout(this);
  signature.setOrientation(LinearLayout.VERTICAL);
  signature.setAlpha(0f);
  LinearLayout.LayoutParams signatureSize=new LinearLayout.LayoutParams(-2,labelHeight);
  signatureSize.gravity=Gravity.CENTER_HORIZONTAL;
  art.addView(signature,signatureSize);
  TextView title=lockText("TAXIMO",46,0xffe7d2a6);
  title.setTypeface(Typeface.create("serif",Typeface.NORMAL));
  title.setLetterSpacing(.21f);
  title.getPaint().setShader(new LinearGradient(0f,0f,0f,title.getTextSize(),
   0xfffff3d7,0xffc3a16b,Shader.TileMode.CLAMP));
  signature.addView(title,new LinearLayout.LayoutParams(-2,dp(58)));
  View separator=new View(this);
  separator.setBackgroundColor(0xff8a7249);
  LinearLayout.LayoutParams separatorSize=new LinearLayout.LayoutParams(dp(82),dp(1));
  separatorSize.gravity=Gravity.CENTER_HORIZONTAL;
  separatorSize.bottomMargin=dp(8);
  signature.addView(separator,separatorSize);
  TextView city=lockText("Bruxelles Mobility",13,0xffe7d2a6);
  city.setLetterSpacing(.08f);
  signature.addView(city,new LinearLayout.LayoutParams(-1,dp(27)));
  TextView continueHint=lockText("",12,0xffbca98c);
  lockAction=continueHint;
  continueHint.setVisibility(View.INVISIBLE);
  LinearLayout.LayoutParams hintSize=new LinearLayout.LayoutParams(-2,dp(28));
  hintSize.gravity=Gravity.CENTER_HORIZONTAL;
  signature.addView(continueHint,hintSize);
  FrameLayout cover=new FrameLayout(this){
   @Override protected void onMeasure(int widthSpec,int heightSpec){
    int side=Math.max(0,Math.min(MeasureSpec.getSize(widthSpec),MeasureSpec.getSize(heightSpec)-labelHeight-dp(24)));
    FrameLayout.LayoutParams size=(FrameLayout.LayoutParams)art.getLayoutParams();
    size.width=side;
    size.height=side+labelHeight;
    super.onMeasure(widthSpec,heightSpec);
   }
  };
  ImageView backdrop=new ImageView(this);
  backdrop.setBackgroundColor(SPLASH_BACKGROUND);
  backdrop.setImageBitmap(splashStudio);
  backdrop.setColorFilter(0x20101927,android.graphics.PorterDuff.Mode.SRC_ATOP);
  backdrop.setScaleType(ImageView.ScaleType.FIT_XY);
  backdrop.setScaleY(2.18f);
  backdrop.addOnLayoutChangeListener((view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->
   backdrop.setPivotY(bottom-top));
  cover.addView(backdrop,new FrameLayout.LayoutParams(-1,-1));
  cover.setClickable(true);
  art.setScaleX(.025f);
  art.setScaleY(.025f);
  art.setAlpha(0f);
  cover.addView(art,new FrameLayout.LayoutParams(0,0,Gravity.CENTER));
  content.addView(cover,new FrameLayout.LayoutParams(-1,-1));
  Runnable exit=()->{
   if(!cover.isAttachedToWindow()||!unlocked||signature.getAlpha()<1f)return;
   if(web!=null&&web.getVisibility()==View.VISIBLE)return;
   continueHint.setVisibility(View.INVISIBLE);
   if(web==null){
    content.removeView(cover);
    return;
   }
   web.setScaleX(.12f);
   web.setScaleY(.12f);
   web.setVisibility(View.VISIBLE);
   ValueAnimator transition=ValueAnimator.ofFloat(0f,1f);
   transition.setDuration(SPLASH_TRANSITION_MS);
   if(unlockedWithFingerprint)transition.setStartDelay(SPLASH_FINGERPRINT_HOLD_MS);
   transition.setInterpolator(new AccelerateDecelerateInterpolator());
   transition.addUpdateListener(new ValueAnimator.AnimatorUpdateListener(){
    private int photoBlur;
    private int appBlur=-1;
    @Override public void onAnimationUpdate(ValueAnimator frame){
     float progress=(float)frame.getAnimatedValue();
     float appScale=.12f+.88f*smoothStartupPhase(progress,.1f,1f);
     web.setScaleX(appScale);
     web.setScaleY(appScale);
     backdrop.setAlpha(1f-smoothStartupPhase(progress,.12f,.85f));
     art.setAlpha(1f-smoothStartupPhase(progress,.18f,.95f));
     web.setAlpha(smoothStartupPhase(progress,.1f,.38f));
     if(Build.VERSION.SDK_INT>=31){
      int nextPhotoBlur=Math.round(18f*smoothStartupPhase(progress,0f,.88f));
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
  };
  cover.postOnAnimation(()->{
   art.setTranslationY(cover.getHeight()*.48f);
   float restingOffset=.04f*scene.getHeight();
   float approachOffset=-.01f*scene.getHeight();
   vehicle.setTranslationY(restingOffset+approachOffset);
   ValueAnimator approach=ValueAnimator.ofFloat(0f,1f);
   approach.setDuration(SPLASH_ENTRANCE_MS);
   approach.setInterpolator(new AccelerateDecelerateInterpolator());
   approach.addUpdateListener(frame->{
    float progress=(float)frame.getAnimatedValue();
    float vehicleScale=.84f+.16f*progress;
    vehicle.setTranslationY(restingOffset+approachOffset*(1f-progress));
    vehicle.setScaleX(vehicleScale);
    vehicle.setScaleY(vehicleScale);
    treads.progress=progress;
    treads.invalidate();
   });
   approach.start();
   art.animate().translationY(0f).scaleX(1f).scaleY(1f).alpha(1f)
    .setDuration(SPLASH_ENTRANCE_MS).setInterpolator(new AccelerateDecelerateInterpolator())
    .withEndAction(()->{
     signature.setTranslationX(-.65f*signature.getWidth());
     signature.animate().translationX(0f).alpha(1f).setDuration(550L)
      .setInterpolator(new AccelerateDecelerateInterpolator())
      .withEndAction(()->{
       if(!cover.isAttachedToWindow())return;
       shineTitle(title);
       if(unlocked)exit.run();
      }).start();
    }).start();
  });
  return exit;
 }
 private final class WheelTreads extends View{
  private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
  private final int[] treadPositions={103,824};
  private float progress;

  WheelTreads(){super(MainActivity.this);}

  @Override protected void onDraw(Canvas canvas){
   super.onDraw(canvas);
   float pulse=(float)Math.sin(Math.PI*progress);
   if(pulse<=0f)return;
   canvas.save();
   canvas.scale(getWidth()/1000f,getHeight()/1000f);
   paint.setStrokeWidth(1.4f);
   float offset=(progress*72f)%12f;
   for(int left:treadPositions){
    canvas.save();
    canvas.clipRect(left,849f,left+73,901f);
    for(float y=837f+offset;y<913f;y+=12f){
     float edge=Math.max(0f,1f-Math.abs(y-875f)/27f);
     paint.setColor(Color.argb(Math.round(25f*pulse*edge),150,150,150));
     canvas.drawLine(left+2,y,left+71,y-4f,paint);
    }
    canvas.restore();
   }
   canvas.restore();
  }
 }
 private void shineTitle(TextView title){
  ValueAnimator shine=ValueAnimator.ofFloat(0f,1f,0f);
  shine.setDuration(650L);
  shine.addUpdateListener(frame->{
   float intensity=(float)frame.getAnimatedValue();
   title.setShadowLayer(dp(8)*intensity,0f,0f,Color.argb(Math.round(180f*intensity),255,226,170));
  });
  shine.start();
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
  resumed=false;
  idleHandler.removeCallbacks(idleCheck);
 }
 @Override protected void onResume(){
  super.onResume();
  resumed=true;
  if(unlocked)checkIdleTimeout();
  else scheduleFingerprint();
 }
 @Override protected void onStop(){
  super.onStop();
  // Une courte sortie de l'application ne ferme plus la session.
  if(!unlocked&&biometric!=null&&!credentialPrompt){
   CancellationSignal attempt=biometric;
   biometric=null;
   prompting=false;
   autoPromptPending=true;
   attempt.cancel();
  }
 }
 @Override public void onBackPressed(){if(unlocked&&web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}
