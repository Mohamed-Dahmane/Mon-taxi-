// Isolated server contract. A durable unique reservation must succeed before any financial POST.
export function cents(value){const s=String(value);if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))throw Error("amount");const [a,b=""]=s.split(".");return Number(a)*100+Number(b.padEnd(2,"0"));}
export function validateRequest(x){if(!x||!["start","status"].includes(x.mode)||!["reference","attemptId","courseId"].every(k=>typeof x[k]==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(x[k]))||!Number.isSafeInteger(x.paidCents)||!Number.isSafeInteger(x.amountCents)||x.amountCents<1||x.amountCents>x.paidCents||x.paidCents>9999900)throw Error("request");return x;}
export function verifyTransaction(tx,x,merchant){
 if(!tx||tx.merchant_code!==merchant||tx.transaction_code!==x.reference||tx.foreign_transaction_id!==x.attemptId||tx.currency!=="EUR"||cents(tx.amount)!==x.paidCents||typeof tx.id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(tx.id)||!["SUCCESSFUL","REFUNDED"].includes(tx.status)||tx.payment_type!=="POS")throw Error("transaction mismatch");
 const events=Array.isArray(tx.transaction_events)?tx.transaction_events:Array.isArray(tx.events)?tx.events:null;if(!events)throw Error("events unavailable");
 const refunds=events.filter(e=>(e.event_type??e.type)==="REFUND");
 const disputes=events.some(e=>(e.event_type??e.type)==="CHARGE_BACK");
 if(disputes)throw Error("chargeback");
 if(refunds.length===1){const e=refunds[0],time=e.timestamp??e.date;
  if(["REFUNDED","SUCCESSFUL"].includes(e.status)&&cents(e.amount)===x.amountCents&&e.id!=null&&Number.isFinite(Date.parse(time)))return {status:"confirmed",eventId:String(e.id),timestamp:new Date(time).toISOString(),amountCents:x.amountCents};
 }
 if(refunds.length||tx.status!=="SUCCESSFUL")return {status:"pending",message:"Un remboursement existe ou reste en traitement ; aucun nouveau débit."};
 return {status:"clear"};
}
export async function processRefund(x,merchant,io){
 validateRequest(x);
 let tx=await io.read(x),checked=verifyTransaction(tx,x,merchant);
 if(checked.status!=="clear")return checked;
 if(x.mode==="status")return {status:"pending",message:"Aucun remboursement confirmé ; reprendre uniquement via Mon Taxi."};
 const reserved=await io.reserve(tx.id,x);
 if(!reserved)return {status:"pending",message:"Demande déjà réservée ; vérifier le résultat, jamais renvoyer."};
 // Any error or timeout after reservation remains uncertain. Never release/retry automatically.
 try{
  await io.refund(tx.id,x.amountCents);
  tx=await io.read(x);checked=verifyTransaction(tx,x,merchant);
  return checked.status==="confirmed"?checked:{status:"pending",message:"Demande transmise, confirmation en attente."};
 }catch{return {status:"pending",message:"Résultat incertain : vérifier le statut, aucun renvoi automatique."};}
}
