import {processRefund,validateRequest,verifyTransaction} from "./refund-engine.mjs";
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
async function eq(a:string,b:string){const enc=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(a)),crypto.subtle.digest("SHA-256",enc.encode(b))]);let n=0;for(let i=0;i<32;i++)n|=new Uint8Array(x)[i]^new Uint8Array(y)[i];return n===0;}
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"method"},405);
 const token=Deno.env.get("TAXI_REFUND_DEVICE_TOKEN")||"", key=Deno.env.get("TAXI_REFUND_SUMUP_KEY")||"",merchant=Deno.env.get("TAXI_REFUND_MERCHANT")||"";
 const db=Deno.env.get("SUPABASE_URL")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const enabled=Deno.env.get("TAXI_REFUND_ENABLED")==="true";
 if(!token.match(/^[A-Za-z0-9_-]{43,128}$/)||!key||!merchant.match(/^[A-Za-z0-9_-]{1,80}$/)||!db||!service)return json({error:"not configured"},503);
 const auth=req.headers.get("authorization")||"";if(auth.length>160||!(await eq(auth,"Bearer "+token)))return json({error:"unauthorized"},401);
 try{
  const raw=await req.text();if(raw.length>4096)return json({error:"too large"},400);const x=JSON.parse(raw);
  const headers={Authorization:"Bearer "+key,Accept:"application/json"};
  const io={
   async read(v:any){const url="https://api.sumup.com/v2.1/merchants/"+merchant+"/transactions?foreign_transaction_id="+encodeURIComponent(v.attemptId);const r=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error("read");return await r.json();},
   async reserve(id:string,v:any){const r=await fetch(db+"/rest/v1/taxi_refund_reservations",{method:"POST",headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({merchant_code:merchant,transaction_id:id,attempt_id:v.attemptId,reference:v.reference,amount_cents:v.amountCents}),redirect:"error",signal:AbortSignal.timeout(5000)});if(r.status===409)return false;if(r.status!==201)throw Error("reservation");return true;},
   async refund(id:string,amount:number){const r=await fetch("https://api.sumup.com/v1.0/merchants/"+merchant+"/payments/"+id+"/refunds",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({amount}),redirect:"error",signal:AbortSignal.timeout(10000)});if(r.status!==201)throw Error("refund");}
  };
  if(!enabled){
   validateRequest(x);
   const tx=await io.read(x),checked=verifyTransaction(tx,x,merchant);
   const dbCheck=await fetch(db+"/rest/v1/taxi_refund_reservations?select=transaction_id&limit=0",{headers:{apikey:service,Authorization:"Bearer "+service},redirect:"error",signal:AbortSignal.timeout(5000)});
   if(!dbCheck.ok)throw Error("reservation access");
   return json({status:"pending",message:checked.status==="clear"?"Liaison sécurisée vérifiée : transaction et registre accessibles. Remboursement bancaire désactivé pour le test.":"Liaison vérifiée : transaction déjà remboursée ou non disponible. Aucun remboursement déclenché."});
  }
  const result=await processRefund(x,merchant,io);return json(result);
 }catch{return json({status:"pending",message:"Vérification indisponible ou transaction non concordante. Aucun renvoi automatique."});}
});
