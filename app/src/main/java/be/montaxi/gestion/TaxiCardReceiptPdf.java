package be.montaxi.gestion;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import org.json.*;
import java.io.*;
import java.text.NumberFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
final class TaxiCardReceiptPdf {
 private static final int NAVY=0xff17324b,GOLD=0xffb69a62,GREEN=0xff16794b,GRAY=0xff586471;
 private static String field(JSONObject r,String k,int max)throws IOException{
  String s=r.optString(k,"").replaceAll("[\\p{Cntrl}]"," ").trim();if(s.length()>max)throw new IOException("Field too long");return s;
 }
 private static String money(int cents){return NumberFormat.getCurrencyInstance(Locale.FRANCE).format(cents/100.0);}
 private static void text(Canvas c,Paint p,String s,float x,float y,int size,int color,boolean bold,Paint.Align align){
  p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setColor(color);p.setTextAlign(align);c.drawText(s,x,y,p);
 }
 private static void wrap(ArrayList<String> rows,Paint p,String s){
  if(s.isEmpty())return;
  p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));p.setTextSize(12);
  while(!s.isEmpty()){
   int n=p.breakText(s,true,300,null);if(n<1)n=1;
   if(n<s.length()){int split=s.lastIndexOf(' ',n-1);if(split>0)n=split;}
   rows.add(s.substring(0,n).trim());s=s.substring(n).trim();
  }
 }
 static byte[] render(JSONObject r)throws Exception{
  int cents=r.getInt("amountCents");if(cents<100||cents>9999900)throw new IOException("Amount");
  String ref=field(r,"reference",128);if(!ref.matches("[A-Za-z0-9_-]{1,128}"))throw new IOException("Reference");
  String date=OffsetDateTime.parse(r.getString("paidAt")).atZoneSameInstant(ZoneId.of("Europe/Brussels")).format(DateTimeFormatter.ofPattern("dd/MM/yyyy · HH:mm",Locale.FRANCE));
  Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);ArrayList<String> rows=new ArrayList<>();
  String from=field(r,"from",250),to=field(r,"to",250),vehicle=field(r,"vehicle",40);
  if(!from.isEmpty())wrap(rows,p,"Départ / From : "+from);
  if(!to.isEmpty())wrap(rows,p,"Destination / To : "+to);
  if(!vehicle.isEmpty())wrap(rows,p,"Véhicule / Vehicle : "+vehicle);
  wrap(rows,p,"Référence SumUp / Reference : "+ref);
  boolean verified=r.optBoolean("verified",false);
  if(verified){
   String business=field(r,"business",160),vat=field(r,"vat",160),number=field(r,"number",160);
   if(!business.isEmpty())wrap(rows,p,"Commerçant / Merchant : "+business);
   if(!vat.isEmpty())wrap(rows,p,"N° TVA / VAT ID : "+vat);
   if(!number.isEmpty())wrap(rows,p,"N° reçu / Receipt no. : "+number);
  }
  int refund=r.optInt("refundCents",0);if(refund<0||refund>cents)throw new IOException("Refund");
  if(refund>0)wrap(rows,p,"Remboursement / Refund : "+money(refund));
  PdfDocument doc=new PdfDocument();PdfDocument.Page page=null;
  try(ByteArrayOutputStream out=new ByteArrayOutputStream()){
   int height=Math.max(455,303+rows.size()*18);
   page=doc.startPage(new PdfDocument.PageInfo.Builder(360,height,1).create());
   Canvas c=page.getCanvas();c.drawColor(Color.WHITE);
   text(c,p,"TAXIMO TRANSPORT",180,44,23,NAVY,true,Paint.Align.CENTER);p.setColor(GOLD);c.drawRect(145,54,215,56,p);
   text(c,p,"Reçu carte / Card receipt",180,80,12,GRAY,false,Paint.Align.CENTER);
   text(c,p,money(cents),180,129,35,NAVY,true,Paint.Align.CENTER);
   text(c,p,"PAYÉ / PAID",180,153,13,GREEN,true,Paint.Align.CENTER);
   text(c,p,date,180,177,11,GRAY,false,Paint.Align.CENTER);
   p.setColor(GOLD);c.drawRect(30,193,330,194,p);
   text(c,p,"Transport taxi / Taxi service",30,216,13,NAVY,true,Paint.Align.LEFT);
   text(c,p,"SumUp",330,216,11,GRAY,true,Paint.Align.RIGHT);
   float y=239;for(String row:rows){text(c,p,row,30,y,12,NAVY,false,Paint.Align.LEFT);y+=18;}
   p.setColor(0xffdddddd);c.drawRect(30,y+1,330,y+2,p);y+=20;
   text(c,p,verified?"Données SumUp vérifiées / SumUp data checked":"Justificatif local / Local payment record",180,y,10,GRAY,false,Paint.Align.CENTER);
   text(c,p,"Distinct du reçu SumUp / Not a SumUp-issued receipt",180,y+15,9,GRAY,false,Paint.Align.CENTER);
   text(c,p,"Merci de votre confiance · Thank you",180,y+37,11,GRAY,false,Paint.Align.CENTER);
   doc.finishPage(page);page=null;doc.writeTo(out);return out.toByteArray();
  }finally{try{if(page!=null)doc.finishPage(page);}finally{doc.close();}}
 }
}
