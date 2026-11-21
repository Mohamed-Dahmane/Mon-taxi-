package be.montaxi.gestion;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit contact actions. Editing is performed in the phone's own contact editor. */
public final class TaxiContactsBridge {
 static final int CONTACT_PERMISSION=71, CONTACT_PICK=72;
 private final Activity activity;
 private final WebView web;
 private String pendingMode=null;
 private java.util.Set<String> pendingIds=java.util.Collections.emptySet();
 private boolean reading=false;
 TaxiContactsBridge(Activity activity,WebView web){this.activity=activity;this.web=web;}
 private boolean trusted(){
  String url=web.getUrl();if(url==null)return false;
  Uri uri=Uri.parse(url);
  return ("https".equals(uri.getScheme())&&"mohamed-dahmane.github.io".equals(uri.getHost())&&"/Mon-taxi-/".equals(uri.getPath())&&(uri.getPort()==-1||uri.getPort()==443))||url.equals("file:///android_asset/index.html");
 }
 private void result(String mode,JSONArray contacts,String error){
  try{JSONObject data=new JSONObject();data.put("mode",mode);if(contacts!=null)data.put("contacts",contacts);if(error!=null)data.put("error",error);
   activity.runOnUiThread(()->{if(trusted())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:"+data.toString()+"}))",null);});
  }catch(Exception ignored){}
 }
 @JavascriptInterface public void importTx(){beginRead("tx",java.util.Collections.emptySet());}
 @JavascriptInterface public void sync(String idsJson){syncDirectory(idsJson,"[]");}
 @JavascriptInterface public void syncDirectory(String idsJson,String namesJson){
  try{
   JSONArray ids=new JSONArray(idsJson);if(ids.length()>20000)throw new IllegalArgumentException();
   java.util.Set<String> linked=new java.util.HashSet<>();
   for(int i=0;i<ids.length();i++){String value=ids.getString(i);if(!value.matches("[0-9]{1,20}"))throw new IllegalArgumentException();linked.add(value);}
   JSONArray names=new JSONArray(namesJson);if(names.length()>20000)throw new IllegalArgumentException();
   for(int i=0;i<names.length();i++){
    String value=names.getString(i);
    if(value.length()<=400)linked.add("name:"+contactName(value));
   }
   beginRead("sync",linked);
  }catch(Exception e){result("sync",null,"Actualisation impossible : liste de contacts invalide. Les fiches sont conservées.");}
 }
 @JavascriptInterface public void refresh(String nativeId){
  if(nativeId==null||!nativeId.matches("[0-9]{1,20}"))return;
  beginRead("refresh",java.util.Collections.singleton(nativeId));
 }
 @JavascriptInterface public void findDriver(String name){findNamedContact("driver-lookup",name);}
 @JavascriptInterface public void findReferrer(String name){findNamedContact("referrer-lookup",name);}
 private void findNamedContact(String mode,String name){
  if(name==null)return;
  String query=name.trim();
  if(query.isEmpty()||query.length()>160)return;
  beginRead(mode,java.util.Collections.singleton(query));
 }
 private void beginRead(String mode,java.util.Set<String> ids){activity.runOnUiThread(()->{
  if(!trusted())return;
  if(reading||pendingMode!=null){result(mode,null,"Une analyse du répertoire est déjà en cours.");return;}
  if(activity.checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED){pendingMode=mode;pendingIds=ids;activity.requestPermissions(new String[]{Manifest.permission.READ_CONTACTS},CONTACT_PERMISSION);return;}
  readContacts(mode,ids);
 });}
 void permissionResult(int[] grants){
  if(pendingMode==null)return;
  String mode=pendingMode;java.util.Set<String> ids=pendingIds;pendingMode=null;pendingIds=java.util.Collections.emptySet();
  if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED&&trusted())readContacts(mode,ids);
  else result(mode,null,"referrer-lookup".equals(mode)?"Accès aux contacts du téléphone refusé.":"Accès aux contacts refusé. Les chauffeurs déjà enregistrés sont conservés.");
 }
 private static String contactName(String name){
  return java.text.Normalizer.normalize(name.trim().replaceAll("\\s+"," "),java.text.Normalizer.Form.NFD)
   .replaceAll("[\\u0300-\\u036f]","").toLowerCase(java.util.Locale.ROOT);
 }
 private void readContacts(String mode,java.util.Set<String> linked){
  reading=true;
  new Thread(()->{
   JSONArray contacts=new JSONArray();java.util.Set<String> seen=new java.util.HashSet<>();
   String[] columns={ContactsContract.CommonDataKinds.Phone.CONTACT_ID,ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,ContactsContract.CommonDataKinds.Phone.NUMBER,ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY};
   boolean single="refresh".equals(mode);
   boolean sync="sync".equals(mode);
   boolean referrerLookup="referrer-lookup".equals(mode);
   boolean lookup=referrerLookup||"driver-lookup".equals(mode);
   Uri source=lookup?Uri.withAppendedPath(ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI,Uri.encode(linked.iterator().next()))
     :ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
   String selection=single?ContactsContract.CommonDataKinds.Phone.CONTACT_ID+"=?":null;
   String[] args=single?new String[]{linked.iterator().next()}:null;
   try(Cursor c=activity.getContentResolver().query(source,columns,selection,args,ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY+" DESC")){
    if(c==null)throw new IllegalStateException();
    while(c.moveToNext()){
     String nativeId=c.getString(0),name=c.getString(1),number=c.getString(2);
     if(name==null||number==null)continue;
     boolean tx=name.trim().toUpperCase(java.util.Locale.ROOT).startsWith("TX");
     if(!lookup&&!(linked.contains(nativeId)||(!single&&tx)||(sync&&linked.contains("name:"+contactName(name)))))continue;
     if(!number.replaceAll("[\\s().-]", "").matches("\\+?[0-9]{3,20}")||(!lookup&&!sync&&!single&&!seen.add(nativeId)))continue;
     JSONObject item=new JSONObject();item.put("nativeId",nativeId);item.put("name",name);item.put("phone",number);
     if(referrerLookup||sync||single)item.put("preferred",c.getInt(3)==1);
     contacts.put(item);
    }
    if(single&&contacts.length()==0)result(mode,null,"Contact introuvable. La fiche Mon Taxi est conservée.");
    else result(mode,contacts,null);
   }catch(Exception e){result(mode,null,"Impossible de lire les contacts. Les fiches existantes sont conservées.");}
   finally{activity.runOnUiThread(()->reading=false);}
  },"TaxiContactsScan").start();
 }
 private JSONObject contact(Cursor cursor)throws Exception{
  JSONObject c=new JSONObject();c.put("nativeId",cursor.getString(0));c.put("name",cursor.getString(1));c.put("phone",cursor.getString(2));return c;
 }
 @JavascriptInterface public void pick(){activity.runOnUiThread(()->{
  if(!trusted())return;
  try{Intent intent=new Intent(Intent.ACTION_PICK,ContactsContract.CommonDataKinds.Phone.CONTENT_URI);activity.startActivityForResult(intent,CONTACT_PICK);}
  catch(Exception e){result("chosen",null,"Le sélecteur de contacts n’est pas disponible.");}
 });}
 void picked(int code,Intent data){
  if(code!=Activity.RESULT_OK||data==null||data.getData()==null){result("chosen",null,"Import annulé.");return;}
  if(!trusted())return;
  Uri uri=data.getData();if(!"content".equals(uri.getScheme())||!ContactsContract.AUTHORITY.equals(uri.getAuthority())){result("chosen",null,"Contact invalide.");return;}
  try(Cursor c=activity.getContentResolver().query(uri,new String[]{ContactsContract.CommonDataKinds.Phone.CONTACT_ID,ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,ContactsContract.CommonDataKinds.Phone.NUMBER},null,null,null)){
   JSONArray contacts=new JSONArray();if(c!=null&&c.moveToFirst())contacts.put(contact(c));result("chosen",contacts,null);
  }catch(Exception e){result("chosen",null,"Ce contact n’a pas pu être importé.");}
 }
 @JavascriptInterface public void edit(String nativeId){activity.runOnUiThread(()->{
  if(!trusted()||nativeId==null||!nativeId.matches("[0-9]{1,20}"))return;
  try{Intent intent=new Intent(Intent.ACTION_EDIT,Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI,nativeId));activity.startActivity(intent);}
  catch(Exception e){result("edit",null,"Impossible d’ouvrir le contact téléphone.");}
 });}
 @JavascriptInterface public void openWhatsApp(String number){openWhatsAppChat(number,null);}
 @JavascriptInterface public void openWhatsAppMessage(String number,String message){
  if(message==null||message.length()>1000)return;
  openWhatsAppChat(number,message);
 }
 private void openWhatsAppChat(String number,String message){activity.runOnUiThread(()->{
  if(!trusted()||number==null||!number.matches("\\+[1-9][0-9]{7,14}"))return;
  Uri.Builder address=Uri.parse("https://wa.me/"+number.substring(1)).buildUpon();
  if(message!=null)address.appendQueryParameter("text",message);
  Uri chat=address.build();
  for(String app:new String[]{"com.whatsapp","com.whatsapp.w4b"}){
   try{
    activity.startActivity(new Intent(Intent.ACTION_VIEW,chat).setPackage(app));
    return;
   }catch(ActivityNotFoundException|SecurityException ignored){}
  }
  if(message!=null){
   try{
    activity.startActivity(new Intent(Intent.ACTION_VIEW,chat));
   }catch(ActivityNotFoundException|SecurityException e){
    result("open",null,"Impossible d’ouvrir WhatsApp.");
   }
   return;
  }
  new AlertDialog.Builder(activity)
   .setTitle("WhatsApp indisponible")
   .setMessage("Ouvrir les SMS pour contacter ce client ?")
   .setNegativeButton("Annuler",null)
   .setPositiveButton("Ouvrir SMS",(dialog,which)->open("sms:"+number))
   .show();
 });}
 @JavascriptInterface public void open(String url){activity.runOnUiThread(()->{
  if(!trusted()||url==null)return;
  try{Uri uri=Uri.parse(url);String scheme=uri.getScheme();Intent intent;
   if("tel".equals(scheme)&&uri.getSchemeSpecificPart().matches("\\+?[0-9]{3,20}"))intent=new Intent(Intent.ACTION_DIAL,uri);
   else if("sms".equals(scheme)){
    String raw=url.substring(4);int mark=raw.indexOf('?');String number=mark<0?raw:raw.substring(0,mark);
    if(!number.matches("\\+?[0-9]{3,20}"))return;
    intent=new Intent(Intent.ACTION_SENDTO,Uri.parse("smsto:"+number));
    if(mark>=0&&raw.substring(mark+1).startsWith("body="))intent.putExtra("sms_body",Uri.decode(raw.substring(mark+6)));
   }else if("https".equals(scheme)&&"waze.com".equalsIgnoreCase(uri.getHost())&&"/ul".equals(uri.getPath())){
    intent=new Intent(Intent.ACTION_VIEW,uri);
    try{intent.setPackage("com.waze");activity.startActivity(intent);return;}
    catch(ActivityNotFoundException ignored){intent.setPackage(null);}
   }else return;
   activity.startActivity(intent);
  }catch(Exception e){result("open",null,"Aucune application compatible n’a pu être ouverte.");}
 });}
}
