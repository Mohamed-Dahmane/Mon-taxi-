package be.montaxi.gestion;

import java.io.IOException;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

final class TaxiReceiptPublisher {
 static final String BASE="https://uenyvsiturkihectolxp.supabase.co/functions/v1/";
 static boolean valid(String value){return value!=null&&value.matches("[a-f0-9]{64}");}
 static String link(String id){
  if(!valid(id))throw new IllegalArgumentException("Receipt identifier");
  return BASE+"taxi-receipt-view-v1?id="+id;
 }
 static void publish(String credential,String id,byte[] png)throws IOException{
  if(!valid(credential)||!valid(id)||png==null||png.length<33||png.length>6000000)throw new IOException("Invalid publication request");
  HttpsURLConnection c=(HttpsURLConnection)new URL(BASE+"taxi-receipt-publish-v1?id="+id).openConnection();
  try{
   c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(20000);
   c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Authorization","Bearer "+credential);
   c.setRequestProperty("Content-Type","image/png");c.setFixedLengthStreamingMode(png.length);
   try(java.io.OutputStream out=c.getOutputStream()){out.write(png);}
   int status=c.getResponseCode();if(status!=200&&status!=201)throw new IOException("Publication refused: "+status);
  }finally{c.disconnect();}
  HttpsURLConnection read=(HttpsURLConnection)new URL(link(id)).openConnection();
  try{
   read.setInstanceFollowRedirects(false);read.setConnectTimeout(10000);read.setReadTimeout(20000);
   if(read.getResponseCode()!=200||!"image/png".equalsIgnoreCase(read.getContentType()))throw new IOException("Receipt unavailable");
   try(java.io.InputStream in=read.getInputStream()){
    byte[] buffer=new byte[8192];int offset=0,n;
    while((n=in.read(buffer))!=-1){if(n>png.length-offset)throw new IOException("Receipt mismatch");for(int i=0;i<n;i++)if(buffer[i]!=png[offset+i])throw new IOException("Receipt mismatch");offset+=n;}
    if(offset!=png.length)throw new IOException("Receipt incomplete");
   }
  }finally{read.disconnect();}
 }
}
