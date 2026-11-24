package be.montaxi.gestion;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.EditText;
import android.text.InputType;
import android.util.Base64;
import org.json.JSONObject;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.function.BooleanSupplier;

final class TaxiRefundBridge {
 private static final String ENDPOINT="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-refund-v1";
 private static final String ALIAS="taxi-refund-device-v1";
 private final Activity activity;private final WebView web;private final BooleanSupplier trusted;
 private boolean busy;
 TaxiRefundBridge(Activity a,WebView w,BooleanSupplier t){activity=a;web=w;trusted=t;}
 private SharedPreferences prefs(){return activity.getSharedPreferences(ALIAS,Context.MODE_PRIVATE);}
 private SecretKey key() throws Exception{
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias(ALIAS)){KeyGenerator kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");kg.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());kg.generateKey();}
  return (SecretKey)ks.getKey(ALIAS,null);
 }
 private void store(String token)throws Exception{
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String value=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(token.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!prefs().edit().putString("pair",value).commit())throw new Exception("storage");
 }
 private String load()throws Exception{
  String raw=prefs().getString("pair","");if(raw.isEmpty())return "";
  String[] parts=raw.split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
 }
 private void publish(JSONObject req,JSONObject result){
  if(!trusted.getAsBoolean())return;
  try{result.put("courseId",req.getString("courseId"));result.put("reference",req.getString("reference"));result.put("attemptId",req.getString("attemptId"));web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-refund-result',{detail:"+result.toString()+"}))",null);}catch(Exception ignored){}
 }
 private void fail(JSONObject req,String msg){try{JSONObject r=new JSONObject();r.put("status","pending");r.put("message",msg);publish(req,r);}catch(Exception ignored){}}
 @JavascriptInterface public void request(String course,String ref,String attempt,int paid,int amount,String mode){
  activity.runOnUiThread(()->{
   if(!trusted.getAsBoolean()||busy)return;
   if(course==null||ref==null||attempt==null||!course.matches("[A-Za-z0-9_-]{1,80}")||!ref.matches("[A-Za-z0-9_-]{1,128}")||!attempt.matches("[A-Za-z0-9_-]{1,80}")||paid<1||amount<1||amount>paid||(!"start".equals(mode)&&!"status".equals(mode)))return;
   try{
    JSONObject req=new JSONObject();req.put("courseId",course);req.put("reference",ref);req.put("attemptId",attempt);req.put("paidCents",paid);req.put("amountCents",amount);req.put("mode",mode);
    String token;try{token=load();}catch(Exception e){prefs().edit().remove("pair").commit();token="";}
    if(!token.isEmpty()){send(req,token);return;}
    EditText field=new EditText(activity);field.setSingleLine(true);field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);field.setHint("Code de liaison dédié");
    new AlertDialog.Builder(activity).setTitle("Configuration unique du remboursement").setMessage("Ce code de liaison est configuré côté serveur. Ce n’est pas ta clé API SumUp. Aucun remboursement sans autorisation.")
     .setView(field).setNegativeButton("Annuler",(d,b)->{field.setText("");fail(req,"Liaison non configurée. Aucun remboursement déclenché.");})
     .setPositiveButton("Connecter",(d,b)->{String code=field.getText().toString().trim();field.setText("");if(!code.matches("[A-Za-z0-9_-]{43,128}")){fail(req,"Code de liaison invalide.");return;}send(req,code);}).show();
   }catch(Exception e){/* fail closed */}
  });
 }
 private void send(JSONObject req,String token){
  busy=true;new Thread(()->{
   JSONObject result=null;int http=0;
   try{
    HttpsURLConnection conn=(HttpsURLConnection)new URL(ENDPOINT).openConnection();
    try{conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(10000);conn.setReadTimeout(25000);conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");conn.setRequestProperty("Authorization","Bearer "+token);try(java.io.OutputStream out=conn.getOutputStream()){out.write(req.toString().getBytes(StandardCharsets.UTF_8));}
     http=conn.getResponseCode();if(http==200){try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(out.size()+n>65536)throw new Exception("response");out.write(buf,0,n);}result=new JSONObject(out.toString("UTF-8"));}}
    }finally{conn.disconnect();}
   }catch(Exception ignored){}
   final JSONObject r=result;final int status=http;
   activity.runOnUiThread(()->{busy=false;if(status==401||status==403){prefs().edit().remove("pair").commit();fail(req,"Liaison refusée : vérifier la configuration serveur.");return;}if(r==null){fail(req,"Serveur indisponible ou non configuré. Vérifier avant toute nouvelle demande.");return;}
    try{store(token);}catch(Exception e){fail(req,"Liaison non enregistrée ; vérifier le statut avant toute action.");return;}
    publish(req,r);
   });
  },"TaxiRefundNetwork").start();
 }
}
