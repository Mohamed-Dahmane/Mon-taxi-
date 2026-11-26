package be.montaxi.gestion;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import org.json.*;
import java.io.*;
import java.text.NumberFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
final class TaxiCashReceiptPdf {
 private static final int NAVY=0xff17324b,GOLD=0xffb69a62,GREEN=0xff16794b,GRAY=0xff586471;
 private static void text(Canvas c,Paint p,String s,float x,float y,int size,int color,boolean bold,Paint.Align align){p.setColor(color);p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextAlign(align);c.drawText(s,x,y,p);}
 private static String field(JSONObject r,String k,int max)throws Exception{String v=r.optString(k,"").trim();if(v.length()>max)throw new IOException("Field too long");return v;}
 private static String money(int cents){return NumberFormat.getCurrencyInstance(Locale.FRANCE).format(cents/100.0);}
 private static float wrapped(Canvas c,Paint p,String s,float y,int size){p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));String line="";for(String word:s.split("\\s+")){String w=word;while(!w.isEmpty()){String trial=line.isEmpty()?w:line+" "+w;if(p.measureText(trial)<=300){line=trial;break;}if(!line.isEmpty()){text(c,p,line,30,y,size,NAVY,false,Paint.Align.LEFT);y+=size+5;line="";continue;}int n=p.breakText(w,true,300,null);if(n<1)n=1;text(c,p,w.substring(0,n),30,y,size,NAVY,false,Paint.Align.LEFT);y+=size+5;w=w.substring(n);}}if(!line.isEmpty()){text(c,p,line,30,y,size,NAVY,false,Paint.Align.LEFT);y+=size+5;}return y;}
 static byte[] render(JSONObject r)throws Exception{
  int cents=r.getInt("amountCents");if(cents<=0)throw new IOException("Amount");
  String ref=field(r,"reference",160);if(!ref.startsWith("cash:"))throw new IOException("Reference");
  String route=field(r,"route",640),vehicle=field(r,"vehicle",40),driver=field(r,"driverNumber",40);
  String date=OffsetDateTime.parse(r.getString("paidAt")).atZoneSameInstant(ZoneId.of("Europe/Brussels")).format(DateTimeFormatter.ofPattern("dd/MM/yyyy · HH:mm",Locale.FRANCE));
  JSONArray strokes=r.optJSONArray("strokes");int count=0;if(strokes!=null){if(strokes.length()>40)throw new IOException("Signature");for(int i=0;i<strokes.length();i++){JSONArray stroke=strokes.getJSONArray(i);if(stroke.length()<2)throw new IOException("Signature");for(int j=0;j<stroke.length();j++){JSONArray pt=stroke.getJSONArray(j);if(pt.length()!=2||++count>2500||pt.getInt(0)<0||pt.getInt(0)>1000||pt.getInt(1)<0||pt.getInt(1)>1000)throw new IOException("Signature");}}}
  String remark=field(r,"remark",300);
  PdfDocument doc=new PdfDocument();
  PdfDocument.Page page=null;
  try(ByteArrayOutputStream out=new ByteArrayOutputStream()){
   page=doc.startPage(new PdfDocument.PageInfo.Builder(360,remark.isEmpty()?780:1100,1).create());Canvas c=page.getCanvas();Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);c.drawColor(Color.WHITE);
   text(c,p,"TAXIMO TRANSPORT",180,46,23,NAVY,true,Paint.Align.CENTER);p.setColor(GOLD);c.drawRect(145,55,215,57,p);
   text(c,p,"Reçu espèces / Cash receipt",180,81,12,GRAY,false,Paint.Align.CENTER);
   text(c,p,money(cents),180,130,35,NAVY,true,Paint.Align.CENTER);text(c,p,"TVA 6 % incl.",180,141,9,GRAY,false,Paint.Align.CENTER);text(c,p,"PAYÉ / PAID",180,158,13,GREEN,true,Paint.Align.CENTER);text(c,p,date,180,177,11,GRAY,false,Paint.Align.CENTER);
   p.setColor(GOLD);c.drawRect(30,193,330,194,p);float y=219;
   text(c,p,"Transport taxi / Taxi service",30,y,13,NAVY,true,Paint.Align.LEFT);y+=22;
   if(!route.isEmpty())y=wrapped(c,p,route,y,12);if(!vehicle.isEmpty())y=wrapped(c,p,"Véhicule / Vehicle : "+vehicle,y,12);
   y+=10;p.setColor(0xffdddddd);c.drawRect(30,y,330,y+1,p);y+=22;
   y=wrapped(c,p,"Référence / Reference : "+ref,y,10);
   int refund=r.optInt("refundCents",0);if(refund>0){if(refund>cents)throw new IOException("Refund");y=wrapped(c,p,"Remboursement / Refund : "+money(refund),y,11);}
   if(!remark.isEmpty()){text(c,p,"Remarque",30,y+10,12,NAVY,true,Paint.Align.LEFT);y=wrapped(c,p,remark,y+29,12);}
   if(!driver.isEmpty())y=wrapped(c,p,"N° chauffeur / Driver ID : "+driver,y+8,14);
   String png=r.optString("signaturePng","");if(!png.isEmpty()){if(png.length()>20000)throw new IOException("Signature");byte[] image=android.util.Base64.decode(png,android.util.Base64.DEFAULT);BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(image,0,image.length,bounds);if(bounds.outWidth<1||bounds.outHeight<1||bounds.outWidth>1200||bounds.outHeight>600)throw new IOException("Signature dimensions");Bitmap bmp=BitmapFactory.decodeByteArray(image,0,image.length);if(bmp==null)throw new IOException("Signature");y+=15;text(c,p,"Signature du chauffeur / Driver’s signature",30,y,10,GRAY,false,Paint.Align.LEFT);y+=10;float scale=Math.min(250f/bmp.getWidth(),75f/bmp.getHeight());p.setFilterBitmap(true);c.drawBitmap(bmp,null,new RectF(30,y,30+bmp.getWidth()*scale,y+bmp.getHeight()*scale),p);y+=bmp.getHeight()*scale+8;bmp.recycle();}
   else if(count>0){y+=15;text(c,p,"Signature du chauffeur / Driver's signature",30,y,10,GRAY,false,Paint.Align.LEFT);y+=10;p.setColor(Color.BLACK);p.setStrokeWidth(1.6f);p.setStrokeCap(Paint.Cap.ROUND);for(int i=0;i<strokes.length();i++){JSONArray st=strokes.getJSONArray(i);for(int j=1;j<st.length();j++){JSONArray a=st.getJSONArray(j-1),b=st.getJSONArray(j);c.drawLine(30+a.getInt(0)*.25f,y+a.getInt(1)*.07f,30+b.getInt(0)*.25f,y+b.getInt(1)*.07f,p);}}y+=78;}
   text(c,p,"Merci de votre confiance · Thank you",180,Math.max(420,y+30),11,GRAY,false,Paint.Align.CENTER);
   doc.finishPage(page);page=null;doc.writeTo(out);return out.toByteArray();
  }finally{try{if(page!=null)doc.finishPage(page);}finally{doc.close();}}
 }
}
