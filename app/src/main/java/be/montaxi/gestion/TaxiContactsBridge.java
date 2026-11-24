package be.montaxi.gestion;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;

/** Read-only contact selection, explicit calls/SMS, and dedicated Waze navigation. */
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
 private String pendingContactRequest;
 private void result(String mode,JSONArray contacts,String error){
  try{JSONObject data=new JSONObject();data.put("mode",mode);if("chosen".equals(mode)){data.put("requestId",pendingContactRequest);pendingContactRequest=null;}if(contacts!=null)data.put("contacts",contacts);if(error!=null)data.put("error",error);
   activity.runOnUiThread(()->{if(trusted())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:"+data.toString()+"}))",null);});
  }catch(Exception ignored){}
 }
 private JSONObject contact(Cursor cursor)throws Exception{
  JSONObject c=new JSONObject();c.put("nativeId",cursor.getString(0));c.put("name",cursor.getString(1));c.put("phone",cursor.getString(2));return c;
 }
 @JavascriptInterface public void pick(String requestId){activity.runOnUiThread(()->{
  if(!trusted()||requestId==null||!requestId.matches("[a-zA-Z0-9_-]{1,80}")||pendingContactRequest!=null)return;
  pendingContactRequest=requestId;
  try{Intent intent=new Intent(Intent.ACTION_PICK,ContactsContract.CommonDataKinds.Phone.CONTENT_URI);activity.startActivityForResult(intent,CONTACT_PICK);}
  catch(Exception e){result("chosen",null,"Le sélecteur de contacts n’est pas disponible.");}
 });}
 void picked(int code,Intent data){
  if(pendingContactRequest==null)return;
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
 private String bubbleCourseId;
 private android.content.SharedPreferences wazeState(){return activity.getSharedPreferences("taxi_waze_refonte",Activity.MODE_PRIVATE);}
 private boolean validCourseId(String id){return id!=null&&id.matches("[a-zA-Z0-9_-]{1,80}");}
 private void dispatch(String event,JSONObject detail){
  if(trusted())web.evaluateJavascript("window.dispatchEvent(new CustomEvent("+JSONObject.quote(event)+",{detail:"+detail.toString()+"}))",null);
 }
 private void wazeResult(String id,String status,boolean overlay,String error){
  try{JSONObject d=new JSONObject();d.put("courseId",id);d.put("status",status);d.put("overlay",overlay);if(error!=null)d.put("error",error);dispatch("taxi-waze-result",d);}catch(Exception ignored){}
 }
 @JavascriptInterface public void navigateWaze(String courseId,String destination){activity.runOnUiThread(()->{
  if(!trusted()||!validCourseId(courseId))return;
  String address=destination==null?"":destination.trim();
  if(address.isEmpty()||address.length()>250){wazeResult(courseId,"error",false,"Destination invalide.");return;}
  hideBubble();
  Uri uri=new Uri.Builder().scheme("https").authority("waze.com").path("/ul").appendQueryParameter("q",address).appendQueryParameter("navigate","yes").build();
  Intent intent=new Intent(Intent.ACTION_VIEW,uri);
  intent.setPackage("com.waze");
  boolean overlay=false;
  try{
   overlay=showBubble(courseId);
   activity.startActivity(intent);
   if(!overlay)android.widget.Toast.makeText(activity,"Retour manuel à Mon Taxi possible. Autorise le bouton flottant pour la prochaine navigation.",android.widget.Toast.LENGTH_LONG).show();
   wazeResult(courseId,"opened",overlay,null);
  }catch(Exception e){hideBubble();wazeResult(courseId,"error",false,"Waze indisponible. La course reste en cours.");}
 });}
 @JavascriptInterface public void enableWazeOverlay(){activity.runOnUiThread(()->{
  if(!trusted())return;
  if(android.provider.Settings.canDrawOverlays(activity)){android.widget.Toast.makeText(activity,"Bouton flottant autorisé.",android.widget.Toast.LENGTH_SHORT).show();return;}
  try{activity.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+activity.getPackageName())));}
  catch(Exception e){android.widget.Toast.makeText(activity,"Autorisation du bouton flottant indisponible.",android.widget.Toast.LENGTH_LONG).show();}
 });}
 @JavascriptInterface public void requestWazeReturn(){activity.runOnUiThread(()->{
  if(!trusted())return;String id=wazeState().getString("returnCourse",null);
  if(validCourseId(id))try{JSONObject d=new JSONObject();d.put("courseId",id);dispatch("taxi-return-active-course",d);}catch(Exception ignored){}
 });}
 @JavascriptInterface public void ackWazeReturn(String id){activity.runOnUiThread(()->{
  if(trusted()&&validCourseId(id)&&id.equals(wazeState().getString("returnCourse",null)))wazeState().edit().remove("returnCourse").commit();
 });}
 private boolean showBubble(String courseId){
  if(!android.provider.Settings.canDrawOverlays(activity))return false;
  if(bubble!=null)return false;
  bubbleCourseId=courseId;
  bubbleManager=(android.view.WindowManager)activity.getSystemService(Activity.WINDOW_SERVICE);
  bubble=new android.widget.TextView(activity);
  bubble.setText("🚕");
  bubble.setContentDescription("Retour à la course Mon Taxi");
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
      if(moved&&bubble!=null){
       android.graphics.Rect bounds;
       if(android.os.Build.VERSION.SDK_INT>=30)bounds=bubbleManager.getCurrentWindowMetrics().getBounds();
       else{android.util.DisplayMetrics dm=new android.util.DisplayMetrics();bubbleManager.getDefaultDisplay().getRealMetrics(dm);bounds=new android.graphics.Rect(0,0,dm.widthPixels,dm.heightPixels);}
       bubbleParams.x=Math.max(0,Math.min(Math.max(0,bounds.width()-size),initialX+dx));bubbleParams.y=Math.max(0,Math.min(Math.max(0,bounds.height()-size),initialY+dy));
       try{bubbleManager.updateViewLayout(bubble,bubbleParams);}catch(Exception ignored){}
      }
      return true;
     case android.view.MotionEvent.ACTION_UP:
      if(!moved){
       String returning=bubbleCourseId;
       if(!validCourseId(returning))return true;
       if(!wazeState().edit().putString("returnCourse",returning).commit())return true;
       hideBubble();
       Intent back=new Intent(activity,MainActivity.class);
       back.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT|Intent.FLAG_ACTIVITY_SINGLE_TOP);
       activity.startActivity(back);

      }
      return true;
     case android.view.MotionEvent.ACTION_CANCEL:return true;
    }
    return false;
   }
  });
  try{bubbleManager.addView(bubble,bubbleParams);return true;}
  catch(Exception error){bubble=null;bubbleCourseId=null;return false;}
 }
 public void hideBubble(){
  if(bubble!=null)try{bubbleManager.removeView(bubble);}catch(Exception ignored){}
  bubble=null;bubbleCourseId=null;
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
   }else return;
   activity.startActivity(intent);
  }catch(Exception e){result("open",null,"Aucune application compatible n’a pu être ouverte.");}
 });}
}
