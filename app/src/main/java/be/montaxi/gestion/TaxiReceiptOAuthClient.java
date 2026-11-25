package be.montaxi.gestion;
import android.net.Uri;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class TaxiReceiptOAuthClient {
 private static final String ENDPOINT="https://uenyvsiturkihectolxp.supabase.co/functions/v1/taxi-sumup-oauth";
 static boolean validToken(String token){return token!=null&&token.matches("[A-Za-z0-9_-]{43,128}");}
 static final class Rejected extends IOException {
  final int status; final String code;
  Rejected(int status,String code){super("Receipt service rejected");this.status=status;this.code=code;}
 }
 private JSONObject call(String token,JSONObject body)throws Exception{
  if(!validToken(token))throw new IOException("Invalid device credential");
  HttpsURLConnection c=(HttpsURLConnection)new URL(ENDPOINT).openConnection();
  try{
   c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(75000);
   c.setRequestMethod("POST");c.setDoOutput(true);
   c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Accept","application/json");
   c.setRequestProperty("Authorization","Bearer "+token);
   byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);
   c.setFixedLengthStreamingMode(data.length);
   try(OutputStream out=c.getOutputStream()){out.write(data);}
   int status=c.getResponseCode();
   InputStream stream=status==200?c.getInputStream():c.getErrorStream();
   JSONObject result=new JSONObject();
   if(stream!=null)try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(out.size()+n>32768)throw new IOException("Response too large");out.write(buf,0,n);}
    result=new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));
   }
   if(status!=200)throw new Rejected(status,result.optString("error",""));
   return result;
  }finally{c.disconnect();}
 }
 JSONObject status(String token)throws Exception{return call(token,new JSONObject().put("action","status"));}
 Uri start(String token)throws Exception{
  JSONObject r=call(token,new JSONObject().put("action","start"));
  Uri uri=Uri.parse(r.getString("authorizeUrl"));
  if(!"https".equals(uri.getScheme())||!"api.sumup.com".equals(uri.getEncodedAuthority())||!"/authorize".equals(uri.getPath())||uri.getFragment()!=null||!ENDPOINT.equals(uri.getQueryParameter("redirect_uri"))||!"code".equals(uri.getQueryParameter("response_type"))||!"transactions.history user.profile_readonly".equals(uri.getQueryParameter("scope"))||!uri.getQueryParameterNames().equals(new java.util.HashSet<>(java.util.Arrays.asList("response_type","client_id","redirect_uri","scope","state")))||!String.valueOf(uri.getQueryParameter("state")).matches("[a-f0-9]{64}"))throw new IOException("Untrusted authorization URL");
  for(String k:uri.getQueryParameterNames())if(uri.getQueryParameters(k).size()!=1)throw new IOException("Repeated parameter");
  return uri;
 }
 JSONObject receipt(String token,String reference,int cents)throws Exception{
  if(reference==null||!reference.matches("[A-Za-z0-9_-]{1,128}")||cents<100||cents>9999900)throw new IOException("Invalid request");
  JSONObject r=call(token,new JSONObject().put("action","receipt").put("reference",reference).put("cents",cents)).getJSONObject("receipt");
  if(!reference.equals(r.getString("reference"))||r.getInt("amountCents")!=cents||!"EUR".equals(r.getString("currency")))throw new IOException("Receipt mismatch");
  java.time.OffsetDateTime.parse(r.getString("timestamp"));
  return new JSONObject().put("reference",reference).put("amountCents",cents).put("currency","EUR").put("timestamp",r.getString("timestamp")).put("business",field(r,"business")).put("vat",field(r,"vat")).put("number",field(r,"number"));
 }
 private static String field(JSONObject r,String key){String v=r.optString(key,"").replaceAll("[\\p{Cntrl}]"," ").trim();return v.length()>160?v.substring(0,160):v;}
}
