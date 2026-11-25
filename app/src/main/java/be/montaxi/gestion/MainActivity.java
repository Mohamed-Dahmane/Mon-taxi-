package be.montaxi.gestion;
import android.app.Activity;
import android.content.Intent;
import com.sumup.merchant.reader.api.SumUpAPI;
import com.sumup.merchant.reader.api.SumUpLogin;
import com.sumup.merchant.reader.api.SumUpPayment;
import java.math.BigDecimal;
import java.util.UUID;
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
 private TaxiContactsBridge taxiContacts;
 private boolean recoveryShown=false;
 private final Handler webHealthHandler=new Handler(Looper.getMainLooper());
 private void verifyWebContent(){
  if(!unlocked||web==null||recoveryShown)return;
  web.evaluateJavascript("(function(){try{var m=document.querySelector('main');var g=document.querySelector('.taxi-access');return document.readyState==='complete'&&!!((m&&!m.hidden)||(g&&!g.hidden))}catch(e){return false}})()",value->{
   if(!unlocked||web==null||recoveryShown)return;
   if(!"true".equals(value))showWebRecovery();
  });
 }
 private void showWebRecovery(){
  if(recoveryShown||!unlocked)return;
  recoveryShown=true;
  new AlertDialog.Builder(this).setTitle("Mon Taxi Pro ne s'affiche pas")
   .setMessage("L'empreinte a fonctionne, mais le tableau n'a pas pu se charger. Aucune donnee ne sera effacee.")
   .setPositiveButton("Reessayer",(dialog,which)->{recoveryShown=false;if(web!=null)web.loadUrl("file:///android_asset/index.html");webHealthHandler.postDelayed(this::verifyWebContent,12000L);})
   .setNegativeButton("Fermer",(dialog,which)->{recoveryShown=false;finish();})
   .setOnCancelListener(dialog->recoveryShown=false).show();
 }
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
 private static final long IDLE_TIMEOUT_MS=120000L;
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
 private void lockTaxi(){cancelRemoval();idleHandler.removeCallbacks(idleCheck);if(!unlocked)return;unlocked=false;if(web!=null){web.setVisibility(View.INVISIBLE);web.onPause();}showLock();}
 private boolean acceptSessionInteraction(){
  if(!unlocked)return true;
  if(SystemClock.elapsedRealtime()-lastInteraction>=IDLE_TIMEOUT_MS){
   lockTaxi();
   return false;
  }
  touchSession();
  return true;
 }
 @Override public boolean dispatchTouchEvent(MotionEvent event){
  return !acceptSessionInteraction()||super.dispatchTouchEvent(event);
 }
 @Override public boolean dispatchKeyEvent(KeyEvent event){
  return !acceptSessionInteraction()||super.dispatchKeyEvent(event);
 }
 private CancellationSignal biometric;
 private static final int SUMUP_LOGIN=701, SUMUP_READER=702, SUMUP_CHECKOUT=703;
 // Process-local marker: never cancel an SDK setup that may still be running.
 private static String activeSumUpAttempt;
 // One durable checkout at a time. No history import and no automatic retry.
 private android.content.SharedPreferences sumUpState(){return getSharedPreferences("taxi_sumup_refonte_v1",MODE_PRIVATE);}
 private org.json.JSONObject pendingSumUp(){
  String raw=sumUpState().getString("pending",null);
  if(raw==null)return null;
  try{return new org.json.JSONObject(raw);}catch(Exception e){throw new IllegalStateException("Journal SumUp illisible",e);}
 }
 private void persistSumUp(org.json.JSONObject p){
  if(!sumUpState().edit().putString("pending",p.toString()).commit())throw new IllegalStateException("Journal SumUp non enregistré");
 }
 private void showSumUpMessage(String message){Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
 private void publishSumUp(){
  if(web==null||!unlocked||!isLocalAppPage(web.getUrl()))return;
  try{
   org.json.JSONObject p=pendingSumUp();if(p==null)return;
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('mon-taxi-sumup-result',{detail:"+p.toString()+"}))",null);
  }catch(Exception e){showSumUpMessage("Journal SumUp à vérifier.");}
 }
 private void recoverInterruptedSumUp(String courseId,String attempt){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl()))return;
  try{
   org.json.JSONObject p=pendingSumUp();
   if(p==null){showSumUpMessage("Journal natif absent : vérifier cette tentative dans SumUp avant toute nouvelle opération.");return;}
   if(!attempt.equals(p.optString("attemptId"))||!courseId.equals(p.optString("courseId"))){showSumUpMessage("Tentative différente dans le journal natif : vérifier dans SumUp.");return;}
   String stage=p.optString("stage");
   if("result".equals(stage)){publishSumUp();return;}
   // Only stages durably recorded BEFORE checkout can be cancelled after a process restart.
   if(activeSumUpAttempt==null&&("setup".equals(stage)||"login".equals(stage)||"reconnecting".equals(stage)||"reader".equals(stage))){
    finishSumUp("cancelled",null,null,null);return;
   }
   publishSumUp();
   showSumUpMessage("checkout".equals(stage)?"Paiement potentiellement envoyé : vérifier dans SumUp. Aucun nouvel encaissement.":"Configuration encore active : fermer puis rouvrir Mon Taxi avant vérification.");
  }catch(Exception e){showSumUpMessage("Journal SumUp à vérifier. Aucun nouvel encaissement.");}
 }
 // Read-only reconciliation; no checkout, no stored API credential, no history import.
 private boolean sumUpLookupRunning;
 private void lookupMessage(String courseId,String attempt,String message){
  if(web==null||!unlocked||!isLocalAppPage(web.getUrl()))return;
  try{org.json.JSONObject d=new org.json.JSONObject();d.put("courseId",courseId);d.put("attemptId",attempt);d.put("message",message);
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-sumup-diagnostic',{detail:"+d.toString()+"}))",null);
  }catch(Exception ignored){}
 }
 private static org.json.JSONObject sumUpRead(String path,String key)throws Exception{
  java.net.URL url=new java.net.URL("https://api.sumup.com"+path);
  javax.net.ssl.HttpsURLConnection connection=(javax.net.ssl.HttpsURLConnection)url.openConnection();
  try{
   connection.setInstanceFollowRedirects(false);connection.setRequestMethod("GET");connection.setConnectTimeout(10000);connection.setReadTimeout(15000);
   connection.setRequestProperty("Authorization","Bearer "+key);connection.setRequestProperty("Accept","application/json");
   int code=connection.getResponseCode();if(code!=200)throw new IOException("HTTP "+code);
   try(InputStream in=connection.getInputStream();java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){
    byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>262144)throw new IOException("Response too large");out.write(buffer,0,n);}
    return new org.json.JSONObject(out.toString("UTF-8"));
   }
  }finally{connection.disconnect();}
 }
 private void verifySumUpOnline(String courseId,String attempt){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl())||sumUpLookupRunning)return;
  try{
   org.json.JSONObject p=pendingSumUp();
   if(p==null||!attempt.equals(p.optString("attemptId"))||!courseId.equals(p.optString("courseId"))){lookupMessage(courseId,attempt,"Journal différent ou absent : aucune modification.");return;}
   String stage=p.optString("stage"),status=p.optString("status");
   if(activeSumUpAttempt!=null){lookupMessage(courseId,attempt,"SDK encore actif : fermer complètement Mon Taxi, puis rouvrir avant de vérifier.");return;}
   if(!"checkout".equals(stage)&&!("result".equals(stage)&&"uncertain".equals(status))){publishSumUp();lookupMessage(courseId,attempt,"Ce stade doit être traité par la vérification locale.");return;}
   final EditText field=new EditText(this);field.setSingleLine(true);field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);field.setHint("Clé API SumUp");
   new AlertDialog.Builder(this).setTitle("Vérification officielle SumUp")
    .setMessage("Recherche en lecture seule, par référence unique. Saisis une clé API autorisée à lire les transactions. Elle ne sera ni enregistrée ni affichée dans les journaux.")
    .setView(field).setNegativeButton("Annuler",(d,b)->field.setText(""))
    .setPositiveButton("Vérifier",(d,b)->{
     final String key=field.getText().toString().trim();field.setText("");
     if(key.isEmpty()||key.length()>512||key.contains("\\n")||key.contains("\\r")){lookupMessage(courseId,attempt,"Clé API manquante ou invalide.");return;}
     sumUpLookupRunning=true;lookupMessage(courseId,attempt,"Vérification officielle en cours. Ne pas relancer.");
     new Thread(()->{
      try{
       org.json.JSONObject me=sumUpRead("/v0.1/me",key);org.json.JSONObject profile=me.optJSONObject("merchant_profile");
       String merchant=me.optString("merchant_code",profile==null?"":profile.optString("merchant_code",""));
       if(!merchant.matches("[A-Za-z0-9_-]{1,80}"))throw new IOException("Merchant unavailable");
       org.json.JSONObject tx=sumUpRead("/v2.1/merchants/"+merchant+"/transactions?foreign_transaction_id="+android.net.Uri.encode(attempt),key);
       if(!attempt.equals(tx.optString("foreign_transaction_id"))||!merchant.equals(tx.optString("merchant_code"))||!"EUR".equals(tx.optString("currency"))||new BigDecimal(tx.getString("amount")).movePointRight(2).intValueExact()!=p.getInt("requestedCents"))throw new IOException("Mismatch");
       final String result=tx.optString("status"),reference=tx.optString("transaction_code"),timestamp=tx.optString("timestamp");
       if(!reference.matches("[A-Za-z0-9_-]{1,128}"))throw new IOException("Missing reference");
       if("SUCCESSFUL".equals(result))java.time.OffsetDateTime.parse(timestamp);
       runOnUiThread(()->{
        sumUpLookupRunning=false;
        try{
         org.json.JSONObject latest=pendingSumUp();
         if(!unlocked||latest==null||activeSumUpAttempt!=null||!latest.toString().equals(p.toString())){lookupMessage(courseId,attempt,"Journal modifié : recommencer la vérification.");return;}
         String mapped="SUCCESSFUL".equals(result)?"success":"FAILED".equals(result)?"declined":"CANCELLED".equals(result)?"cancelled":null;
         if(mapped==null){lookupMessage(courseId,attempt,"SumUp : paiement non définitif. Aucun nouvel encaissement.");return;}
         latest.put("stage","result");latest.put("status",mapped);latest.put("transactionCode",reference);latest.put("amountCents",p.getInt("requestedCents"));latest.put("currency","EUR");
         latest.put("verifiedBy","sumup_transactions_api");if("success".equals(mapped))latest.put("paidAt",timestamp);
         persistSumUp(latest);publishSumUp();lookupMessage(courseId,attempt,"Résultat officiel vérifié : "+result+" · "+reference);
        }catch(Exception ex){lookupMessage(courseId,attempt,"Résultat non enregistré. Protection maintenue.");}
       });
      }catch(Exception ex){runOnUiThread(()->{sumUpLookupRunning=false;lookupMessage(courseId,attempt,"Vérification impossible (accès, réseau ou référence non concordante). Aucun nouvel encaissement.");});}
     },"TaxiSumUpReadOnly").start();
    }).show();
  }catch(Exception ex){lookupMessage(courseId,attempt,"Journal non vérifiable. Protection maintenue.");}
 }
 private void ackSumUp(String attempt){
  try{
   org.json.JSONObject p=pendingSumUp();
   if(p!=null&&attempt.equals(p.optString("attemptId"))&&"result".equals(p.optString("stage"))&&
      ("success".equals(p.optString("status"))||"cancelled".equals(p.optString("status"))||"declined".equals(p.optString("status")))){
    if(!sumUpState().edit().remove("pending").commit())showSumUpMessage("Journal SumUp conservé : réessayer la synchronisation locale.");
   }
  }catch(Exception e){showSumUpMessage("Journal SumUp à vérifier.");}
 }
 private void beginSumUpPayment(String courseId,String attempt,int cents,boolean localReceipt){
  try{
   if(courseId==null||!courseId.matches("[a-zA-Z0-9_-]{1,80}")||attempt==null||!attempt.matches("[a-zA-Z0-9_-]{1,80}")||cents<100||cents>9999900){showSumUpMessage("Demande SumUp invalide.");return;}
   if(pendingSumUp()!=null){publishSumUp();showSumUpMessage("Une tentative SumUp reste à vérifier.");return;}
   org.json.JSONObject p=new org.json.JSONObject();
   p.put("courseId",courseId);p.put("attemptId",attempt);p.put("requestedCents",cents);p.put("stage","setup");p.put("status","pending");p.put("localReceipt",localReceipt);
   persistSumUp(p);
   activeSumUpAttempt=attempt;
   if(SumUpAPI.isLoggedIn())openSumUpReader();else askSumUpAffiliateKey();
  }catch(Exception e){showSumUpMessage("SumUp non lancé ou statut à vérifier. Ne pas recommencer automatiquement.");}
 }
 private void finishSumUp(String status,String tx,Integer actualCents,String currency){
  try{
   org.json.JSONObject p=pendingSumUp();if(p==null||"result".equals(p.optString("stage")))return;
   p.put("stage","result");p.put("status",status);
   if(tx!=null)p.put("transactionCode",tx);
   if(actualCents!=null)p.put("amountCents",actualCents);
   if(currency!=null)p.put("currency",currency);
   persistSumUp(p);activeSumUpAttempt=null;publishSumUp();
   if("uncertain".equals(status))showSumUpMessage("Statut incertain : ne pas encaisser à nouveau avant vérification.");
  }catch(Exception e){showSumUpMessage("Résultat SumUp non enregistré : vérification nécessaire.");}
 }
 private boolean sumUpStage(String stage){try{org.json.JSONObject p=pendingSumUp();return p!=null&&stage.equals(p.optString("stage"));}catch(Exception e){return false;}}
 private void setSumUpStage(String stage)throws Exception{
  org.json.JSONObject p=pendingSumUp();if(p==null)throw new IllegalStateException();p.put("stage",stage);persistSumUp(p);
 }
 private void cancelSumUpSetup(){finishSumUp("cancelled",null,null,null);}
 private void askSumUpAffiliateKey(){
  String saved=getSharedPreferences("taxi-sumup",MODE_PRIVATE).getString("affiliate","");
  if(!saved.isEmpty()){openSumUpLogin(saved);return;}
  EditText field=new EditText(this);field.setSingleLine(true);field.setHint("Clé d'affiliation SumUp");
  new AlertDialog.Builder(this).setTitle("Configurer SumUp").setMessage("Saisis la clé d'affiliation une seule fois sur ton téléphone.")
   .setView(field).setNegativeButton("Annuler",(d,w)->cancelSumUpSetup())
   .setOnCancelListener(d->cancelSumUpSetup())
   .setPositiveButton("Enregistrer",(d,w)->{
     String key=field.getText().toString().trim();
     if(key.isEmpty()){cancelSumUpSetup();return;}
     getSharedPreferences("taxi-sumup",MODE_PRIVATE).edit().putString("affiliate",key).apply();openSumUpLogin(key);
   }).show();
 }
 private void openSumUpLogin(String key){
  try{setSumUpStage("login");SumUpAPI.openLoginActivity(this,SumUpLogin.builder(key).build(),SUMUP_LOGIN);}
  catch(Exception e){cancelSumUpSetup();}
 }
 // Prepare only a previously paired reader, never initiate or retry a payment.
 private void prepareIdleSumUpReader(){
  if(!unlocked||!resumed)return;
  try{
   if(pendingSumUp()==null&&SumUpAPI.isLoggedIn()&&!SumUpAPI.isCardReaderConnected())SumUpAPI.prepareForCheckout();
  }catch(RuntimeException e){android.util.Log.w("TaxiSumUp","Reader preparation unavailable",e);}
 }
 // Reconnect a remembered reader before opening manual settings. Never retry a debit.
 private void openSumUpReader(){
  try{
   if(SumUpAPI.isCardReaderConnected()){openSumUpCheckout();return;}
   org.json.JSONObject p=pendingSumUp();
   if(p==null)return;
   String attempt=p.getString("attemptId");
   setSumUpStage("reconnecting");
   try{SumUpAPI.prepareForCheckout();}
   catch(RuntimeException e){android.util.Log.w("TaxiSumUp","Automatic reader preparation unavailable",e);}
   awaitSumUpReader(attempt,android.os.SystemClock.elapsedRealtime()+8000L);
  }catch(Exception e){cancelSumUpSetup();}
 }
 private void awaitSumUpReader(String attempt,long deadline){
  try{
   org.json.JSONObject p=pendingSumUp();
   if(p==null||!"reconnecting".equals(p.optString("stage"))||!attempt.equals(p.optString("attemptId")))return;
   if(isFinishing()||isDestroyed()||!unlocked){cancelSumUpSetup();return;}
   if(resumed&&SumUpAPI.isCardReaderConnected()){openSumUpCheckout();return;}
   if(android.os.SystemClock.elapsedRealtime()>=deadline){
    if(!resumed){cancelSumUpSetup();return;}
    setSumUpStage("reader");
    SumUpAPI.openCardReaderPage(this,SUMUP_READER);
    return;
   }
   new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->awaitSumUpReader(attempt,deadline),400L);
  }catch(Exception e){cancelSumUpSetup();}
 }
 private boolean receiptLookupRunning=false;
 private void receiptLookupResult(String reference,org.json.JSONObject verified,String error){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl()))return;
  try{org.json.JSONObject d=new org.json.JSONObject();d.put("reference",reference);if(verified!=null)d.put("verified",verified);if(error!=null)d.put("error",error);
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-receipt-result',{detail:"+d.toString()+"}))",null);
  }catch(Exception ignored){}
 }
 private CancellationSignal removalPrompt;
 private String removalId,removalMode,removalRequest,removalGrant;
 private long removalExpiry;
 private synchronized boolean consumeRemoval(String id,String mode,String request,String grant){
  boolean ok=removalGrant!=null&&removalGrant.equals(grant)&&id!=null&&id.equals(removalId)&&mode!=null&&mode.equals(removalMode)&&request!=null&&request.equals(removalRequest)&&android.os.SystemClock.elapsedRealtime()<=removalExpiry;
  if(ok){removalGrant=null;removalExpiry=0;}
  return ok;
 }
 private synchronized void clearRemovalGrant(){removalGrant=null;removalExpiry=0;}
 private void removalEvent(String id,String mode,String request,String grant){
  if(!receiptTrusted())return;
  try{org.json.JSONObject d=new org.json.JSONObject();d.put("id",id);d.put("mode",mode);d.put("request",request);if(grant!=null)d.put("grant",grant);
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-course-removal',{detail:"+d.toString()+"}))",null);
  }catch(Exception ignored){}
 }
 private void cancelRemoval(){
  clearRemovalGrant();CancellationSignal p=removalPrompt;removalPrompt=null;
  if(p!=null){p.cancel();removalEvent(removalId,removalMode,removalRequest,null);}
 }
 private void requestRemoval(String id,String mode,String request,String label){
  if(!receiptTrusted()||id==null||!id.matches("[a-zA-Z0-9_-]{1,80}")||request==null||!request.matches("[a-zA-Z0-9_-]{1,80}")||(!"hide".equals(mode)&&!"void-test".equals(mode)))return;
  if(removalPrompt!=null||!canUseFingerprint()){removalEvent(id,mode,request,null);return;}
  clearRemovalGrant();removalId=id;removalMode=mode;removalRequest=request;
  CancellationSignal signal=new CancellationSignal();removalPrompt=signal;
  String description=label==null?"":label.substring(0,Math.min(label.length(),140));
  try{
   new BiometricPrompt.Builder(this).setTitle("void-test".equals(mode)?"Annuler la saisie fictive":"Retirer la course")
    .setSubtitle("void-test".equals(mode)?"Aucune espèce réellement reçue":"Recette et justificatif conservés")
    .setDescription(description).setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    .setNegativeButton("Annuler",getMainExecutor(),(d,w)->cancelRemoval()).build()
    .authenticate(signal,getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
     @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){
      if(removalPrompt!=signal)return;removalPrompt=null;
      if(!receiptTrusted()){clearRemovalGrant();return;}
      String grant=java.util.UUID.randomUUID().toString();
      synchronized(MainActivity.this){removalGrant=grant;removalExpiry=android.os.SystemClock.elapsedRealtime()+10000L;}
      removalEvent(id,mode,request,grant);
     }
     @Override public void onAuthenticationError(int code,CharSequence message){if(removalPrompt==signal){removalPrompt=null;clearRemovalGrant();removalEvent(id,mode,request,null);}}
    });
  }catch(Exception ex){cancelRemoval();}
 }
 private boolean receiptTrusted(){return unlocked&&web!=null&&isLocalAppPage(web.getUrl());}
 private boolean validReceiptRequest(String reference,int cents){return receiptTrusted()&&!receiptLookupRunning&&reference!=null&&reference.matches("[A-Za-z0-9_-]{1,128}")&&cents>=100&&cents<=9999900;}
 private TaxiReceiptCredentials receiptCredentials(){return new TaxiReceiptCredentials(this);}
 private String loadReceiptLink(){
  try{String token=receiptCredentials().load();return TaxiReceiptOAuthClient.validToken(token)?token:"";}catch(Exception ex){return "";}
 }
 private void retrieveTaxiReceipt(String reference,int cents){
  if(!validReceiptRequest(reference,cents))return;
  String token=loadReceiptLink();
  if(token.isEmpty()){receiptLookupResult(reference,null,"Liaison non configurée. Utilise Configurer l’accès SumUp.");return;}
  receiptLookupRunning=true;
  new Thread(()->{
   try{org.json.JSONObject result=new TaxiReceiptOAuthClient().receipt(token,reference,cents);
    runOnUiThread(()->{receiptLookupRunning=false;receiptLookupResult(reference,result,null);});
   }catch(Exception ex){
    String message="Vérification du reçu indisponible. Aucun paiement déclenché.";
    if(ex instanceof TaxiReceiptOAuthClient.Rejected){
     TaxiReceiptOAuthClient.Rejected rejection=(TaxiReceiptOAuthClient.Rejected)ex;
     if(rejection.status==401)message="Liaison refusée. Reconfigure le code dédié aux reçus.";
     else if("reauthorize".equals(rejection.code))message="Autorisation SumUp expirée. Utilise Configurer l’accès SumUp.";
     else if(rejection.status==429)message="Vérification en cours. Réessaie dans quelques secondes.";
    }
    final String error=message;runOnUiThread(()->{receiptLookupRunning=false;receiptLookupResult(reference,null,error);});
   }
  },"TaxiReceiptReadOnly").start();
 }
 private void configureTaxiReceipt(String reference,int cents){
  if(!validReceiptRequest(reference,cents))return;
  final String existing=loadReceiptLink();
  if(!existing.isEmpty()){
   new AlertDialog.Builder(this).setTitle("Connexion SumUp — reçus uniquement").setMessage("Autoriser Mon Taxi Pro dans le navigateur ou modifier le code de liaison dédié.")
    .setPositiveButton("Connecter",(d,b)->startReceiptAuthorization(reference,cents,existing))
    .setNeutralButton("Modifier le code",(d,b)->promptReceiptLink(reference,cents)).setNegativeButton("Annuler",null).show();
  }else promptReceiptLink(reference,cents);
 }
 private void promptReceiptLink(String reference,int cents){
  if(!validReceiptRequest(reference,cents))return;
  final EditText field=new EditText(this);field.setSingleLine(true);field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);field.setHint("Code dédié aux reçus");
  new AlertDialog.Builder(this).setTitle("Liaison sécurisée des reçus").setMessage("Utilise uniquement le code de liaison des reçus, jamais une clé SumUp ou un code de remboursement.").setView(field)
   .setNegativeButton("Annuler",null).setPositiveButton("Connecter",(d,b)->{
    String token=field.getText().toString().trim();field.setText("");
    if(!TaxiReceiptOAuthClient.validToken(token)){receiptLookupResult(reference,null,"Code de liaison invalide.");return;}
    startReceiptAuthorization(reference,cents,token);
   }).show();
 }
 private void startReceiptAuthorization(String reference,int cents,String token){
  if(!validReceiptRequest(reference,cents))return;
  receiptLookupRunning=true;
  new Thread(()->{
   try{
    TaxiReceiptOAuthClient client=new TaxiReceiptOAuthClient();
    client.status(token);
    android.net.Uri uri=client.start(token);
    runOnUiThread(()->{
     receiptLookupRunning=false;if(!receiptTrusted())return;
     try{
      receiptCredentials().save(token);
      Intent browser=new Intent(Intent.ACTION_VIEW,uri);browser.addCategory(Intent.CATEGORY_BROWSABLE);
      receiptLookupResult(reference,null,"Autorise SumUp dans le navigateur, puis reviens et appuie sur Consulter les données officielles SumUp.");
      startActivity(browser);
     }catch(Exception ex){receiptLookupResult(reference,null,"Impossible d’ouvrir la connexion SumUp.");}
    });
   }catch(Exception ex){runOnUiThread(()->{receiptLookupRunning=false;receiptLookupResult(reference,null,"Liaison non confirmée. Vérifie le code dédié ou réessaie plus tard.");});}
  },"TaxiReceiptAuthorize").start();
 }
 private static final int CASH_RECEIPT_PICK=706, RECEIPT_PROFILE_PICK=707;
 private void receiptProfileEvent(String content,String error){if(!backupTrusted())return;try{org.json.JSONObject d=new org.json.JSONObject();if(content!=null)d.put("content",content);if(error!=null)d.put("error",error);web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-receipt-profile',{detail:"+d.toString()+"}))",null);}catch(Exception ignored){}}
 private void pickReceiptProfile(){if(!backupTrusted())return;try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");startActivityForResult(i,RECEIPT_PROFILE_PICK);}catch(Exception ex){receiptProfileEvent(null,"Sélecteur indisponible.");}}
 private void readReceiptProfile(int code,Intent data){if(code!=RESULT_OK||data==null||data.getData()==null||!backupTrusted())return;android.net.Uri uri=data.getData();if(!"content".equals(uri.getScheme()))return;new Thread(()->{try(InputStream in=getContentResolver().openInputStream(uri);java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){if(in==null)throw new IOException();byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(out.size()+n>50000)throw new IOException();out.write(buf,0,n);}String raw=new String(out.toByteArray(),java.nio.charset.StandardCharsets.UTF_8);org.json.JSONObject doc=new org.json.JSONObject(raw);if(!"taximo-receipt-profile-v1".equals(doc.optString("format")))throw new IOException();String png=doc.getJSONObject("profile").optString("signaturePng","");if(!png.isEmpty()){if(png.length()>20000)throw new IOException();byte[] bytes=Base64.decode(png,Base64.DEFAULT);BitmapFactory.Options b=new BitmapFactory.Options();b.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,b);if(b.outWidth<1||b.outHeight<1||b.outWidth>1200||b.outHeight>600||!"image/png".equals(b.outMimeType))throw new IOException();}runOnUiThread(()->receiptProfileEvent(raw,null));}catch(Exception e){runOnUiThread(()->receiptProfileEvent(null,"Profil chauffeur invalide ou illisible."));}},"ReceiptProfileImport").start();}

 private String sharePreviewToken,sharePreviewRaw;
 private byte[] sharePreviewBytes;
 private boolean sharePreviewCard;
 private void previewReceiptPdf(String token,String raw,boolean card){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl())||token==null||!token.matches("[0-9]{1,12}")||raw==null||raw.length()>50000)return;
  sharePreviewToken=token;sharePreviewRaw=null;sharePreviewBytes=null;
  new Thread(()->{
   java.io.File file=null;android.graphics.Bitmap bitmap=null;
   try{
    org.json.JSONObject r=new org.json.JSONObject(raw);
    byte[] pdf=card?TaxiCardReceiptPdf.render(r):TaxiCashReceiptPdf.render(r);
    file=java.io.File.createTempFile("receipt-preview-",".pdf",getCacheDir());
    try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){out.write(pdf);}
    android.os.ParcelFileDescriptor fd=android.os.ParcelFileDescriptor.open(file,android.os.ParcelFileDescriptor.MODE_READ_ONLY);
    android.graphics.pdf.PdfRenderer renderer;
    try{renderer=new android.graphics.pdf.PdfRenderer(fd);}catch(Exception ex){fd.close();throw ex;}
    try(android.graphics.pdf.PdfRenderer closeRenderer=renderer){
     if(renderer.getPageCount()!=1)throw new IOException("Unexpected page count");
     try(android.graphics.pdf.PdfRenderer.Page page=renderer.openPage(0)){
      float scale=Math.min(2.5f,Math.min(900f/page.getWidth(),2600f/page.getHeight()));
      bitmap=android.graphics.Bitmap.createBitmap(Math.max(1,Math.round(page.getWidth()*scale)),Math.max(1,Math.round(page.getHeight()*scale)),android.graphics.Bitmap.Config.ARGB_8888);
      bitmap.eraseColor(android.graphics.Color.WHITE);
      page.render(bitmap,null,null,android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
     }
    }
    java.io.ByteArrayOutputStream image=new java.io.ByteArrayOutputStream();
    if(!bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,image))throw new IOException("Preview encoding");
    String png=android.util.Base64.encodeToString(image.toByteArray(),android.util.Base64.NO_WRAP);
    if(png.length()>8000000)throw new IOException("Preview size");
    runOnUiThread(()->{if(!token.equals(sharePreviewToken)||!unlocked||web==null||!isLocalAppPage(web.getUrl()))return;sharePreviewRaw=raw;sharePreviewCard=card;sharePreviewBytes=pdf;receiptPreviewEvent(token,png,null);});
   }catch(Exception ex){runOnUiThread(()->receiptPreviewEvent(token,null,"Impossible de préparer l’aperçu PDF. Réessaie."));}
   finally{if(bitmap!=null)bitmap.recycle();if(file!=null)file.delete();}
  },"TaxiReceiptPreview").start();
 }
 private void receiptPreviewEvent(String token,String png,String error){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl()))return;
  try{org.json.JSONObject d=new org.json.JSONObject();d.put("token",token);if(png!=null)d.put("png",png);if(error!=null)d.put("error",error);
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-receipt-preview',{detail:"+d.toString()+"}))",null);
  }catch(Exception ignored){}
 }
 private void shareReceiptPdf(String token,String raw,boolean card){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl())||token==null||!token.equals(sharePreviewToken)||raw==null||!raw.equals(sharePreviewRaw)||card!=sharePreviewCard||sharePreviewBytes==null)return;
  try{
   java.io.File dir=new java.io.File(getCacheDir(),"receipt-share");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException();
   java.io.File[] old=dir.listFiles();if(old!=null)for(java.io.File f:old)if(f.isFile()&&System.currentTimeMillis()-f.lastModified()>86400000L)f.delete();
   java.io.File file=java.io.File.createTempFile(card?"Recu-carte-":"Recu-especes-",".pdf",dir);
   try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){out.write(sharePreviewBytes);}
   android.net.Uri uri=androidx.core.content.FileProvider.getUriForFile(this,getPackageName()+".receiptfiles",file);
   Intent intent=new Intent(Intent.ACTION_SEND);intent.setType("application/pdf");intent.putExtra(Intent.EXTRA_STREAM,uri);intent.setClipData(android.content.ClipData.newRawUri("Reçu PDF",uri));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   startActivity(Intent.createChooser(intent,"Partager le reçu PDF"));
  }catch(Exception ex){Toast.makeText(this,"Partage PDF impossible. Aucun paiement supplémentaire.",Toast.LENGTH_LONG).show();}
 }
 private byte[] pendingCashPdf;
 private void exportCashReceipt(String raw){exportReceiptPdf(raw,false);}
 private void exportReceiptPdf(String raw,boolean card){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl())||raw==null||raw.length()>50000||pendingCashPdf!=null)return;
  try{
   org.json.JSONObject r=new org.json.JSONObject(raw);
   pendingCashPdf=card?TaxiCardReceiptPdf.render(r):TaxiCashReceiptPdf.render(r);
   Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/pdf");intent.putExtra(Intent.EXTRA_TITLE,card?"Taximo-Transport-recu-carte.pdf":"Taximo-Transport-recu-especes.pdf");
   startActivityForResult(intent,CASH_RECEIPT_PICK);
  }catch(Exception ex){pendingCashPdf=null;Toast.makeText(this,"Impossible de préparer le reçu PDF.",Toast.LENGTH_LONG).show();}
 }
 private void finishCashReceiptExport(int resultCode,Intent data){
  byte[] bytes=pendingCashPdf;pendingCashPdf=null;
  if(resultCode!=RESULT_OK||bytes==null||data==null||data.getData()==null)return;
  try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){if(out==null)throw new IOException();out.write(bytes);out.flush();Toast.makeText(this,"Reçu PDF enregistré.",Toast.LENGTH_LONG).show();}
  catch(Exception ex){Toast.makeText(this,"Enregistrement PDF impossible. Réessaie depuis l’historique.",Toast.LENGTH_LONG).show();}
 }
 private void shareTaxiReceipt(String channel,String body){
  if(!unlocked||web==null||!isLocalAppPage(web.getUrl())||body==null||body.length()>1800||!body.startsWith("Mon Taxi Pro"))return;
  try{
   if("qr".equals(channel)){
    java.util.Map<com.google.zxing.EncodeHintType,Object> hints=new java.util.EnumMap<>(com.google.zxing.EncodeHintType.class);
    hints.put(com.google.zxing.EncodeHintType.CHARACTER_SET,"UTF-8");
    hints.put(com.google.zxing.EncodeHintType.MARGIN,4);
    com.google.zxing.common.BitMatrix matrix=new com.google.zxing.qrcode.QRCodeWriter().encode(body,com.google.zxing.BarcodeFormat.QR_CODE,600,600,hints);
    android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(600,600,android.graphics.Bitmap.Config.ARGB_8888);
    for(int y=0;y<600;y++)for(int x=0;x<600;x++)bitmap.setPixel(x,y,matrix.get(x,y)?0xff000000:0xffffffff);
    android.widget.ImageView img=new android.widget.ImageView(this);img.setImageBitmap(bitmap);img.setAdjustViewBounds(true);img.setContentDescription("QR code du justificatif de paiement");
    new AlertDialog.Builder(this).setTitle("Justificatif - QR texte").setMessage("Le QR contient le texte du justificatif, pas un lien bancaire. Si le scan échoue, revenez aux autres options.").setView(img).setPositiveButton("Retour aux options",null).show();return;
   }
   android.content.Intent intent;
   if("sms".equals(channel)){intent=new android.content.Intent(android.content.Intent.ACTION_SENDTO,android.net.Uri.parse("smsto:"));intent.putExtra("sms_body",body);}
   else if("email".equals(channel)){intent=new android.content.Intent(android.content.Intent.ACTION_SENDTO,android.net.Uri.parse("mailto:"));intent.putExtra(android.content.Intent.EXTRA_SUBJECT,"Justificatif Mon Taxi Pro");intent.putExtra(android.content.Intent.EXTRA_TEXT,body);}
   else if("whatsapp".equals(channel)){
    intent=new android.content.Intent(android.content.Intent.ACTION_SEND);intent.setType("text/plain");intent.putExtra(android.content.Intent.EXTRA_TEXT,body);intent.setPackage("com.whatsapp");
    try{startActivity(intent);return;}catch(android.content.ActivityNotFoundException ex){intent.setPackage("com.whatsapp.w4b");}
   }else if("share".equals(channel)){intent=new android.content.Intent(android.content.Intent.ACTION_SEND);intent.setType("text/plain");intent.putExtra(android.content.Intent.EXTRA_TEXT,body);intent=android.content.Intent.createChooser(intent,"Partager le justificatif");}
   else return;
   startActivity(intent);
  }catch(Exception e){new AlertDialog.Builder(this).setTitle("Partage indisponible").setMessage("Aucun paiement supplémentaire n’a été lancé. Revenez aux options et choisissez un autre moyen de partage.").setPositiveButton("Retour",null).show();}
 }
 private void openSumUpCheckout(){
  try{
   org.json.JSONObject p=pendingSumUp();if(p==null||"checkout".equals(p.optString("stage"))||"result".equals(p.optString("stage")))return;
   var builder=SumUpPayment.builder().total(BigDecimal.valueOf(p.getInt("requestedCents"),2))
    .currency(SumUpPayment.Currency.EUR).title("Course Mon Taxi Pro")
    .foreignTransactionId(p.getString("attemptId")).configureRetryPolicy(2000,60000,true);
   if(p.optBoolean("localReceipt",false))builder.skipSuccessScreen();
   SumUpPayment payment=builder.build();
   setSumUpStage("checkout"); // Durable before any external debit is possible.
   SumUpAPI.checkout(this,payment,SUMUP_CHECKOUT);
  }catch(Exception e){if(sumUpStage("checkout"))finishSumUp("uncertain",null,null,null);else cancelSumUpSetup();}
 }
 private static Object transactionField(Object info,String... names)throws Exception{
  if(info==null)throw new IllegalArgumentException("Transaction info missing");
  for(String name:names)try{return info.getClass().getMethod(name).invoke(info);}catch(NoSuchMethodException ignored){}
  throw new IllegalArgumentException("Transaction field missing");
 }
 private void handleSumUpCheckout(android.content.Intent data){
  if(!sumUpStage("checkout"))return;
  try{
   org.json.JSONObject p=pendingSumUp();
   int code=data==null?-1:data.getIntExtra(SumUpAPI.Response.RESULT_CODE,-1);
   String foreign=data==null?null:data.getStringExtra(SumUpAPI.Param.FOREIGN_TRANSACTION_ID);
   if(!p.getString("attemptId").equals(foreign)){finishSumUp("uncertain",null,null,null);return;}
   if(code==SumUpAPI.Response.ResultCode.SUCCESSFUL){
    String tx=data.getStringExtra(SumUpAPI.Response.TX_CODE);
    Object info=data.getParcelableExtra(SumUpAPI.Response.TX_INFO);
    int cents=new BigDecimal(String.valueOf(transactionField(info,"getAmount"))).movePointRight(2).intValueExact();
    String currency=String.valueOf(transactionField(info,"getCurrency"));
    String status=String.valueOf(transactionField(info,"getPaymentStatus","getStatus"));
    if(tx==null||tx.trim().isEmpty()||cents!=p.getInt("requestedCents")||!"EUR".equals(currency)||!"SUCCESSFUL".equals(status)){
     finishSumUp("uncertain",tx,cents,currency);return;
    }
    finishSumUp("success",tx,cents,currency);
   }else if(code==SumUpAPI.Response.ResultCode.ERROR_TRANSACTION_FAILED){
    // Retry policy enabled; require a definitive transaction status, not a generic error.
    Object info=data.getParcelableExtra(SumUpAPI.Response.TX_INFO);
    String status=String.valueOf(transactionField(info,"getPaymentStatus","getStatus"));
    if("FAILED".equals(status)||"CANCELLED".equals(status))finishSumUp("FAILED".equals(status)?"declined":"cancelled",null,null,null);
    else finishSumUp("uncertain",null,null,null);
   }else finishSumUp("uncertain",null,null,null);
  }catch(Exception e){finishSumUp("uncertain",null,null,null);}
 }
 private static final int BACKUP_PICK=704, BACKUP_MAX_BYTES=16*1024*1024;
 private boolean backupTrusted(){return unlocked&&web!=null&&isLocalAppPage(web.getUrl());}
 private void backupEvent(String action,String content,String error){
  if(!backupTrusted())return;
  try{org.json.JSONObject d=new org.json.JSONObject();if(action!=null)d.put("action",action);if(content!=null)d.put("content",content);if(error!=null)d.put("error",error);
   web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-backup-result',{detail:"+d.toString()+"}))",null);
  }catch(Exception ignored){}
 }
 private void exportLocalBackup(String json){
  if(!backupTrusted())return;
  try{
   if(pendingSumUp()!=null)throw new IllegalStateException("Journal SumUp actif");
   if(json==null||json.length()>BACKUP_MAX_BYTES)throw new IllegalArgumentException();
   byte[] bytes=json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
   if(bytes.length>BACKUP_MAX_BYTES||!"mon-taxi-android-autonome".equals(new org.json.JSONObject(json).optString("format")))throw new IllegalArgumentException();
   if(android.os.Build.VERSION.SDK_INT<29)throw new IllegalStateException("Android 10 requis");
   new Thread(()->{
    android.net.Uri target=null;
    try{
     android.content.ContentValues v=new android.content.ContentValues();
     v.put(android.provider.MediaStore.Downloads.DISPLAY_NAME,"mon_taxi_autonome_"+new java.text.SimpleDateFormat("yyyy-MM-dd_HH-mm-ss-SSS",java.util.Locale.ROOT).format(new java.util.Date())+".json");
     v.put(android.provider.MediaStore.Downloads.MIME_TYPE,"application/json");
     v.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,android.os.Environment.DIRECTORY_DOWNLOADS);
     v.put(android.provider.MediaStore.Downloads.IS_PENDING,1);
     target=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,v);
     if(target==null)throw new IOException();
     try(java.io.OutputStream out=getContentResolver().openOutputStream(target)){if(out==null)throw new IOException();out.write(bytes);}
     v.clear();v.put(android.provider.MediaStore.Downloads.IS_PENDING,0);
     if(getContentResolver().update(target,v,null,null)!=1)throw new IOException();
     runOnUiThread(()->backupEvent("exported",null,null));
    }catch(Exception e){if(target!=null)try{getContentResolver().delete(target,null,null);}catch(Exception ignored){}runOnUiThread(()->backupEvent(null,null,"Échec de la sauvegarde locale."));}
   }).start();
  }catch(Exception e){backupEvent(null,null,"Sauvegarde indisponible : vérifier le journal SumUp et le format.");}
 }
 private void pickLocalBackup(){
  if(!backupTrusted())return;
  try{
   if(pendingSumUp()!=null)throw new IllegalStateException();
   Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
   startActivityForResult(intent,BACKUP_PICK);
  }catch(Exception e){backupEvent(null,null,"Sélecteur indisponible ou paiement SumUp en attente.");}
 }
 private void readLocalBackup(int code,Intent data){
  if(code!=RESULT_OK||data==null||data.getData()==null)return;
  android.net.Uri uri=data.getData();
  if(!"content".equals(uri.getScheme())){backupEvent(null,null,"Fichier invalide.");return;}
  new Thread(()->{
   try(InputStream in=getContentResolver().openInputStream(uri);java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){
    if(in==null)throw new IOException();
    byte[] buf=new byte[8192];int n;
    while((n=in.read(buf))!=-1){if(out.size()+n>BACKUP_MAX_BYTES)throw new IOException();out.write(buf,0,n);}
    String json=new String(out.toByteArray(),java.nio.charset.StandardCharsets.UTF_8);
    runOnUiThread(()->backupEvent("imported",json,null));
   }catch(Exception e){runOnUiThread(()->backupEvent(null,null,"Fichier de sauvegarde illisible ou trop volumineux."));}
  }).start();
 }
 private static final String LOCAL_APP_URL="file:///android_asset/index.html";
 private static boolean isLocalAppPage(String url){
  if(url==null)return false;
  android.net.Uri uri=android.net.Uri.parse(url);
  return "file".equals(uri.getScheme())&&(uri.getAuthority()==null||uri.getAuthority().isEmpty())&&"/android_asset/index.html".equals(uri.getPath());
 }
 private android.media.SoundPool paymentSoundPool;
 private int paymentSoundId=0;
 private boolean paymentSoundReady=false;
 private void writeWavInt(java.io.OutputStream out,int value,int bytes)throws IOException{
  for(int j=0;j<bytes;j++)out.write((value>>(8*j))&255);
 }
 private void ensureCashRegisterSound(){
  if(paymentSoundPool!=null)return;
  try{
   final int rate=44100, frames=(int)(rate*1.12);
   java.io.File wav=new java.io.File(getCacheDir(),"taxi-cash-register-single-ting-v122.wav");
   if(!wav.exists()||wav.length()<100){
    try(java.io.FileOutputStream out=new java.io.FileOutputStream(wav)){
     out.write(new byte[]{'R','I','F','F'});
     writeWavInt(out,36+frames*2,4);
     out.write(new byte[]{'W','A','V','E','f','m','t',' '});
     writeWavInt(out,16,4);writeWavInt(out,1,2);writeWavInt(out,1,2);
     writeWavInt(out,rate,4);writeWavInt(out,rate*2,4);
     writeWavInt(out,2,2);writeWavInt(out,16,2);
     out.write(new byte[]{'d','a','t','a'});writeWavInt(out,frames*2,4);
     java.util.Random noise=new java.util.Random(120);
     for(int i=0;i<frames;i++){
      double t=(double)i/rate;
      // Nouveau timbre mecanique: loquet, glissement du tiroir, cloche.
      double latch=t<0.045?(noise.nextDouble()*2-1)*Math.exp(-t*95)*0.75:0;
      double drawer=t>0.07&&t<0.24?
       (noise.nextDouble()*2-1)*0.19*Math.sin(Math.PI*(t-0.07)/0.17):0;
      double stop=t>0.245&&t<0.32?
       (noise.nextDouble()*2-1)*Math.exp(-(t-0.245)*85)*0.65:0;
      // Une seule frappe de clochette, avec attaque nette et resonance decroissante.
      double bell=0;
      double dt=t-0.32;
      if(dt>=0){
       double strike=Math.exp(-dt*220)*0.13*Math.sin(2*Math.PI*3600*dt);
       double ring=Math.exp(-dt*7.5)*
        (0.30*Math.sin(2*Math.PI*1174*dt)+
         0.16*Math.sin(2*Math.PI*1767.4*dt)+
         0.11*Math.sin(2*Math.PI*2411.8*dt)+
         0.06*Math.sin(2*Math.PI*3279.1*dt));
       bell=strike+ring;
      }
      double v=Math.max(-1,Math.min(1,latch+drawer+stop+bell));
      short pcm=(short)(v*32767);
      out.write(pcm&255);out.write((pcm>>8)&255);
     }
    }
   }
   paymentSoundPool=new android.media.SoundPool.Builder().setMaxStreams(2)
    .setAudioAttributes(new android.media.AudioAttributes.Builder()
     .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
     .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
   paymentSoundPool.setOnLoadCompleteListener((pool,sample,status)->{
    if(sample==paymentSoundId&&status==0)paymentSoundReady=true;
   });
   paymentSoundId=paymentSoundPool.load(wav.getAbsolutePath(),1);
  }catch(Exception ex){
   android.util.Log.e("MonTaxi","Chargement du son de caisse impossible",ex);
  }
 }
 private void playCashRegisterSound(){
  ensureCashRegisterSound();
  if(paymentSoundReady&&paymentSoundPool!=null){
   paymentSoundPool.play(paymentSoundId,0.45f,0.45f,1,0,1.0f);
  }else{
   // Secours sonore Android deja confirme fonctionnel en V116.
   try{
    final android.media.ToneGenerator tone=new android.media.ToneGenerator(
      android.media.AudioManager.STREAM_MUSIC,45);
    tone.startTone(android.media.ToneGenerator.TONE_PROP_ACK,180);
    new Handler(Looper.getMainLooper()).postDelayed(tone::release,350);
   }catch(Exception ignored){}
  }
 }
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  vault=getSharedPreferences("taxi-lock",MODE_PRIVATE);
  // Autoriser les captures d'écran demandées par l'utilisateur.
  getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
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
  ensureCashRegisterSound();
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
  BiometricPrompt.Builder builder=new BiometricPrompt.Builder(this).setTitle("Ouvrir Mon Taxi Pro")
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
  android.content.Intent intent=km.createConfirmDeviceCredentialIntent("Ouvrir Mon Taxi Pro","Confirme avec ton code Samsung");
  if(intent!=null){
   prompting=true;
   startActivityForResult(intent,91);
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,android.content.Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(requestCode==RECEIPT_PROFILE_PICK){readReceiptProfile(resultCode,data);return;}
  if(requestCode==CASH_RECEIPT_PICK){finishCashReceiptExport(resultCode,data);return;}
  if(requestCode==BACKUP_PICK){readLocalBackup(resultCode,data);return;}
  if(requestCode==SUMUP_LOGIN){
   if(sumUpStage("login")){
    int code=data==null?-1:data.getIntExtra(SumUpAPI.Response.RESULT_CODE,-1);
    if(code==SumUpAPI.Response.ResultCode.SUCCESSFUL)openSumUpReader();else cancelSumUpSetup();
   }return;
  }
  if(requestCode==SUMUP_READER){
   if(sumUpStage("reader")){
    if(SumUpAPI.isCardReaderConnected())openSumUpCheckout();else cancelSumUpSetup();
   }return;
  }
  if(requestCode==SUMUP_CHECKOUT){handleSumUpCheckout(data);return;}
  if(requestCode==TaxiContactsBridge.CONTACT_PICK&&taxiContacts!=null)taxiContacts.picked(resultCode,data);
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
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle(setup?"Créer le PIN Mon Taxi Pro":"PIN Mon Taxi Pro").setView(fields).setNegativeButton("Annuler",null).setPositiveButton(setup?"Enregistrer":"Ouvrir",null).create();
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
  prepareIdleSumUpReader();
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
    @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);webHealthHandler.postDelayed(MainActivity.this::verifyWebContent,9000L);}
    @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){
     if(!req.isForMainFrame())return;
     android.net.Uri uri=req.getUrl();
     // Une ressource secondaire indisponible ne doit pas remplacer toute la page.
     if(uri==null||!isLocalAppPage(uri.toString()))return;
     webHealthHandler.postDelayed(MainActivity.this::verifyWebContent,1000L);
    }
    @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
     // Le processus WebView est mort : ne jamais réutiliser cette instance.
     webHealthHandler.removeCallbacksAndMessages(null);
     if(view.getParent() instanceof android.view.ViewGroup)
      ((android.view.ViewGroup)view.getParent()).removeView(view);
     view.destroy();
     if(web==view)web=null;
     recoveryShown=false;
     runOnUiThread(()->{
      if(isFinishing()||isDestroyed())return;
      Toast.makeText(MainActivity.this,"Affichage interrompu. Rouvre Mon Taxi Pro pour récupérer tes saisies sauvegardées.",Toast.LENGTH_LONG).show();
      showLock();
     });
     return true;
    }
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
     String url=req.getUrl().toString();
     return !isLocalAppPage(url);
    }
   });
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void exportJson(String json){runOnUiThread(()->exportLocalBackup(json));}
    @android.webkit.JavascriptInterface public void pickJson(){runOnUiThread(()->pickLocalBackup());}
    @android.webkit.JavascriptInterface public void approveRestore(){runOnUiThread(()->{
     if(!backupTrusted())return;
     try{if(pendingSumUp()!=null){backupEvent(null,null,"Journal SumUp encore actif : restauration interdite.");return;}backupEvent("restore-approved",null,null);}
     catch(Exception e){backupEvent(null,null,"Journal SumUp à vérifier.");}
    });}
   },"TaxiBackup");
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void schedule(String json){
     runOnUiThread(()->{
      if(web!=null&&isLocalAppPage(web.getUrl())){
       TaxiReminderReceiver.schedule(MainActivity.this,json);
      }
     });
    }
    @android.webkit.JavascriptInterface public void enable(){
     runOnUiThread(()->{
      if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
          !=android.content.pm.PackageManager.PERMISSION_GRANTED){
       requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},36);
      }else enableExactTaxiReminders();
     });
    }
   },"TaxiReminder");
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void tap(){
     runOnUiThread(()->{
      if(web==null||!web.hasWindowFocus())return;
      String url=web.getUrl();
      if(isLocalAppPage(url)){
       web.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK);
      }
     });
    }
   },"TaxiHaptics");
   // Son natif de caisse enregistreuse : fichier WAV local joue par SoundPool.
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void play(){
     runOnUiThread(()->playCashRegisterSound());
    }
   },"TaxiPaymentSound");
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void checkout(String courseId,String attemptId,int cents){
     runOnUiThread(()->{if(unlocked&&web!=null&&isLocalAppPage(web.getUrl()))beginSumUpPayment(courseId,attemptId,cents,false);});
    }
    @android.webkit.JavascriptInterface public void checkoutWithLocalReceipt(String courseId,String attemptId,int cents){
     runOnUiThread(()->{if(unlocked&&web!=null&&isLocalAppPage(web.getUrl()))beginSumUpPayment(courseId,attemptId,cents,true);});
    }
    @android.webkit.JavascriptInterface public void recover(){runOnUiThread(()->publishSumUp());}
    @android.webkit.JavascriptInterface public void recoverInterrupted(String courseId,String attemptId){runOnUiThread(()->recoverInterruptedSumUp(courseId,attemptId));}
    @android.webkit.JavascriptInterface public void verifyOnline(String courseId,String attemptId){runOnUiThread(()->verifySumUpOnline(courseId,attemptId));}
    @android.webkit.JavascriptInterface public void ack(String attemptId){runOnUiThread(()->{if(unlocked&&web!=null&&isLocalAppPage(web.getUrl()))ackSumUp(attemptId);});}
   },"TaxiSumUp");
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void share(String channel,String body){runOnUiThread(()->shareTaxiReceipt(channel,body));}
    @android.webkit.JavascriptInterface public void retrieve(String reference,int cents){runOnUiThread(()->retrieveTaxiReceipt(reference,cents));}
    @android.webkit.JavascriptInterface public void configure(String reference,int cents){runOnUiThread(()->configureTaxiReceipt(reference,cents));}
    @android.webkit.JavascriptInterface public void importProfile(){runOnUiThread(()->pickReceiptProfile());}
    @android.webkit.JavascriptInterface public void cashPdf(String raw){runOnUiThread(()->exportCashReceipt(raw));}
    @android.webkit.JavascriptInterface public void cardPdf(String raw){runOnUiThread(()->exportReceiptPdf(raw,true));}
    @android.webkit.JavascriptInterface public void sharePdf(String token,String raw,boolean card){runOnUiThread(()->shareReceiptPdf(token,raw,card));}
    @android.webkit.JavascriptInterface public void previewPdf(String token,String raw,boolean card){runOnUiThread(()->previewReceiptPdf(token,raw,card));}
   },"TaxiReceipt");
   web.addJavascriptInterface(new Object(){
    @android.webkit.JavascriptInterface public void request(String id,String mode,String request,String label){runOnUiThread(()->requestRemoval(id,mode,request,label));}
    @android.webkit.JavascriptInterface public boolean consume(String id,String mode,String request,String grant){return consumeRemoval(id,mode,request,grant);}
   },"TaxiCourseRemoval");
   web.addJavascriptInterface(new TaxiRefundBridge(this,web,()->unlocked&&web!=null&&isLocalAppPage(web.getUrl())),"TaxiRefund");
   taxiContacts=new TaxiContactsBridge(this,web);
   web.addJavascriptInterface(taxiContacts,"TaxiContacts");
   web.setWebChromeClient(new WebChromeClient());
   WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setBlockNetworkLoads(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setCacheMode(WebSettings.LOAD_NO_CACHE);
  }
  // L APK Android utilise exclusivement son interface embarquee, independante de Chrome.
  if(!isLocalAppPage(web.getUrl()))web.loadUrl(LOCAL_APP_URL);
  webHealthHandler.postDelayed(this::verifyWebContent,15000L);
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
 private void enableExactTaxiReminders(){
  TaxiReminderReceiver.restore(this);
  if(Build.VERSION.SDK_INT>=31&&!getSystemService(android.app.AlarmManager.class).canScheduleExactAlarms()){
   android.content.Intent settings=new android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
       android.net.Uri.parse("package:"+getPackageName()));
   if(settings.resolveActivity(getPackageManager())!=null)startActivity(settings);
  }else Toast.makeText(this,"Alertes de courses activées",Toast.LENGTH_SHORT).show();
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
  super.onRequestPermissionsResult(code,permissions,results);
  if(code==36&&results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED){
   enableExactTaxiReminders();
  }
 }
 @Override protected void onPause(){
  super.onPause();
  resumed=false;
  idleHandler.removeCallbacks(idleCheck);
 }
 @Override protected void onResume(){
  super.onResume();
  if(taxiContacts!=null)taxiContacts.hideBubble();
  if(unlocked&&web!=null&&isLocalAppPage(web.getUrl()))web.evaluateJavascript("window.dispatchEvent(new Event('taxi-native-resume'))",null);
  resumed=true;
  if(unlocked)publishSumUp();
  if(unlocked){checkIdleTimeout();prepareIdleSumUpReader();}
  else scheduleFingerprint();
 }
 @Override protected void onStop(){
  super.onStop();
  cancelRemoval();
  // Une courte sortie de l'application ne ferme plus la session.
  if(!unlocked&&biometric!=null&&!credentialPrompt){
   CancellationSignal attempt=biometric;
   biometric=null;
   prompting=false;
   autoPromptPending=true;
   attempt.cancel();
  }
 }
 @Override protected void onDestroy(){cancelRemoval();if(taxiContacts!=null)taxiContacts.hideBubble();super.onDestroy();}
 @Override public void onBackPressed(){if(unlocked&&web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}
