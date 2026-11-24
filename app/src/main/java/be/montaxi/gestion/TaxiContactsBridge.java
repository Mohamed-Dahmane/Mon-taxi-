package be.montaxi.gestion;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit contact actions. Editing is performed in the phone's own contact editor. */
public final class TaxiContactsBridge {
 static final int CONTACT_PICK=72;
 private final Activity activity;
 private final WebView web;

 TaxiContactsBridge(Activity activity,WebView web){this.activity=activity;this.web=web;}
 private boolean trusted(){
  String url=web.getUrl();if(url==null)return false;
  Uri uri=Uri.parse(url);
  return "file".equals(uri.getScheme())&&(uri.getAuthority()==null||uri.getAuthority().isEmpty())&&"/android_asset/index.html".equals(uri.getPath());
 }
 private void result(String mode,JSONArray contacts,String error){
  try{JSONObject data=new JSONObject();data.put("mode",mode);if(contacts!=null)data.put("contacts",contacts);if(error!=null)data.put("error",error);
   activity.runOnUiThread(()->{if(trusted())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:"+data.toString()+"}))",null);});
  }catch(Exception ignored){}
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
 private android.view.WindowManager bubbleManager;
 private android.widget.TextView bubble;
 private android.view.WindowManager.LayoutParams bubbleParams;
 @JavascriptInterface public void showBubble(){activity.runOnUiThread(()->{
  if(!trusted())return;
  if(android.os.Build.VERSION.SDK_INT>=23&&!android.provider.Settings.canDrawOverlays(activity)){
   Intent permission=new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+activity.getPackageName()));
   activity.startActivity(permission);
   android.widget.Toast.makeText(activity,"Autorise Mon Taxi à apparaître par-dessus Waze, puis reprends la course.",android.widget.Toast.LENGTH_LONG).show();
   return;
  }
  if(bubble!=null)return;
  bubbleManager=(android.view.WindowManager)activity.getSystemService(Activity.WINDOW_SERVICE);
  bubble=new android.widget.TextView(activity);
  bubble.setText("🚕");
  bubble.setTextSize(25f);
  bubble.setGravity(android.view.Gravity.CENTER);
  bubble.setTextColor(android.graphics.Color.WHITE);
  android.graphics.drawable.GradientDrawable background=new android.graphics.drawable.GradientDrawable();
  background.setColor(0xff173b70);
  background.setCornerRadius(100f);
  background.setStroke(3,0xffe7f1ff);
  bubble.setBackground(background);
  int size=(int)(58*activity.getResources().getDisplayMetrics().density);
  bubbleParams=new android.view.WindowManager.LayoutParams(size,size,
   android.os.Build.VERSION.SDK_INT>=26?android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:android.view.WindowManager.LayoutParams.TYPE_PHONE,
   android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|android.view.WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
   android.graphics.PixelFormat.TRANSLUCENT);
  bubbleParams.gravity=android.view.Gravity.TOP|android.view.Gravity.START;
  bubbleParams.x=12;
  bubbleParams.y=(int)(190*activity.getResources().getDisplayMetrics().density);
  bubble.setOnTouchListener(new android.view.View.OnTouchListener(){
   float startX,startY;int initialX,initialY;boolean moved;
   @Override public boolean onTouch(android.view.View v,android.view.MotionEvent event){
    switch(event.getActionMasked()){
     case android.view.MotionEvent.ACTION_DOWN:
      startX=event.getRawX();startY=event.getRawY();initialX=bubbleParams.x;initialY=bubbleParams.y;moved=false;return true;
     case android.view.MotionEvent.ACTION_MOVE:
      int dx=Math.round(event.getRawX()-startX),dy=Math.round(event.getRawY()-startY);
      if(Math.abs(dx)+Math.abs(dy)>12)moved=true;
      if(moved){bubbleParams.x=Math.max(0,initialX+dx);bubbleParams.y=Math.max(0,initialY+dy);bubbleManager.updateViewLayout(bubble,bubbleParams);}
      return true;
     case android.view.MotionEvent.ACTION_UP:
      if(!moved){
       hideBubble();
       Intent back=new Intent(activity,MainActivity.class);
       back.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT|Intent.FLAG_ACTIVITY_SINGLE_TOP);
       activity.startActivity(back);
       web.postDelayed(()->web.evaluateJavascript("window.dispatchEvent(new Event('taxi-return-active-course'))",null),450);
      }
      return true;
    }
    return false;
   }
  });
  try{bubbleManager.addView(bubble,bubbleParams);}catch(Exception error){bubble=null;android.widget.Toast.makeText(activity,"Bouton flottant indisponible",android.widget.Toast.LENGTH_SHORT).show();}
 });}
 public void hideBubble(){
  activity.runOnUiThread(()->{
   if(bubble==null)return;
   try{bubbleManager.removeView(bubble);}catch(Exception ignored){}
   bubble=null;
  });
 }
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
    catch(ActivityNotFoundException ignored){result("open",null,"Waze n’est pas installé.");return;}
   }else return;
   activity.startActivity(intent);
  }catch(Exception e){result("open",null,"Aucune application compatible n’a pu être ouverte.");}
 });}
}
