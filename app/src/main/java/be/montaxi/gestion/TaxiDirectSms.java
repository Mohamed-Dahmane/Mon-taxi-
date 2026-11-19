package be.montaxi.gestion;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.UUID;

final class TaxiDirectSms {
 static final int SMS_PERMISSION=73;
 private static final String SCHEME="montaxi-sms:";
 private static final String BODY="?body=";
 private final Activity activity;
 private final TaxiContactsBridge contacts;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private Request pendingPermission;
 private Request latest;
 private long latestAt;
 private boolean sending;

 private static final class Request {
  final String number;
  final String text;

  Request(String number,String text){
   this.number=number;
   this.text=text;
  }
 }

 TaxiDirectSms(Activity activity,TaxiContactsBridge contacts){
  this.activity=activity;
  this.contacts=contacts;
 }

 void request(Uri uri){
  String value=uri.toString();
  if(!value.startsWith(SCHEME)||value.length()>50_000)return;
  int bodyStart=value.indexOf(BODY);
  if(bodyStart<0)return;
  String number=value.substring(SCHEME.length(),bodyStart);
  String message=Uri.decode(value.substring(bodyStart+BODY.length()));
  if(!number.matches("\\+?[0-9]{7,15}")||message.trim().isEmpty()||message.length()>4_000)return;
  if(pendingPermission!=null||sending){
   show("Un SMS est déjà en cours.");
   return;
  }
  if(latest!=null&&latest.number.equals(number)&&latest.text.equals(message)&&SystemClock.elapsedRealtime()-latestAt<10_000){
   show("Le même SMS vient d’être traité.");
   return;
  }

  Request request=new Request(number,message);
  if(activity.checkSelfPermission(Manifest.permission.SEND_SMS)==PackageManager.PERMISSION_GRANTED){
   send(request);
  }else{
   pendingPermission=request;
   activity.requestPermissions(new String[]{Manifest.permission.SEND_SMS},SMS_PERMISSION);
  }
 }

 void permissionResult(int[] grants,boolean unlocked){
  Request request=pendingPermission;
  pendingPermission=null;
  if(request==null||!unlocked||!contacts.trusted())return;
  if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED){
   send(request);
  }else{
   compose(request,"Autorisation SMS indisponible. Confirme l’envoi dans Messages.");
  }
 }

 private void send(Request request){
  if(!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    &&!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)){
   compose(request,"L’envoi direct est indisponible. Confirme l’envoi dans Messages.");
   return;
  }
  int subscription;
  try{
   subscription=SmsManager.getDefaultSmsSubscriptionId();
  }catch(UnsupportedOperationException e){
   compose(request,"L’envoi direct est indisponible. Confirme l’envoi dans Messages.");
   return;
  }
  if(subscription==SubscriptionManager.INVALID_SUBSCRIPTION_ID){
   compose(request,"Choisis une carte SIM et confirme l’envoi dans Messages.");
   return;
  }
  SmsManager manager;
  if(Build.VERSION.SDK_INT>=31){
   SmsManager service=activity.getSystemService(SmsManager.class);
   manager=service==null?null:service.createForSubscriptionId(subscription);
  }else{
   manager=SmsManager.getSmsManagerForSubscriptionId(subscription);
  }
  if(manager==null){
   compose(request,"L’envoi direct est indisponible. Confirme l’envoi dans Messages.");
   return;
  }
  ArrayList<String> parts=manager.divideMessage(request.text);
  Context context=activity.getApplicationContext();
  String action=context.getPackageName()+".SMS_RESULT."+UUID.randomUUID();
  final class SendResult extends BroadcastReceiver {
   int remaining=parts.size();
   boolean failed;
   final Runnable timeout=()->finish("Résultat SMS inconnu. Vérifie dans Messages avant de renvoyer.");

   void finish(String message){
    sending=false;
    handler.removeCallbacks(timeout);
    context.unregisterReceiver(this);
    if(message!=null)show(message);
   }

   @Override public void onReceive(Context receivedContext,Intent intent){
    if(!action.equals(intent.getAction()))return;
    failed|=getResultCode()!=Activity.RESULT_OK;
    if(--remaining==0){
     finish(failed?"Envoi SMS incomplet ou refusé. Vérifie dans Messages.":"SMS envoyé au chauffeur.");
    }
   }
  }
  SendResult result=new SendResult();
  IntentFilter filter=new IntentFilter(action);
  if(Build.VERSION.SDK_INT>=33)context.registerReceiver(result,filter,Context.RECEIVER_NOT_EXPORTED);
  else context.registerReceiver(result,filter);

  ArrayList<PendingIntent> callbacks=new ArrayList<>();
  for(int i=0;i<parts.size();i++){
   Intent sent=new Intent(action).setPackage(context.getPackageName());
   callbacks.add(PendingIntent.getBroadcast(context,i,sent,PendingIntent.FLAG_ONE_SHOT|PendingIntent.FLAG_IMMUTABLE));
  }
  sending=true;
  latest=request;
  latestAt=SystemClock.elapsedRealtime();
  handler.postDelayed(result.timeout,60_000);
  try{
   if(parts.size()==1)manager.sendTextMessage(request.number,null,parts.get(0),callbacks.get(0),null);
   else manager.sendMultipartTextMessage(request.number,null,parts,callbacks,null);
  }catch(SecurityException|IllegalArgumentException|UnsupportedOperationException e){
   result.finish(null);
   latest=null;
   compose(request,"L’envoi direct est indisponible. Confirme l’envoi dans Messages.");
  }
 }

 private void compose(Request request,String message){
  show(message);
  contacts.open("sms:"+request.number+BODY+Uri.encode(request.text));
 }

 private void show(String message){
  Toast.makeText(activity,message,Toast.LENGTH_LONG).show();
 }
}
