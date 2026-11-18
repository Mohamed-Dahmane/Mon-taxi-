/* Mon Taxi — modèle indépendant des attributions de véhicules.
   Aucune écriture réseau ou Supabase. Utilisable par dépose, pick-up,
   course directe et réservation après raccordement des formulaires. */
(function(root){
"use strict";
const TYPES=["Voiture normale","Van"];
function money(value){
 if(value===null||value===undefined||String(value).trim()==="")throw Error("Commission obligatoire (0 € autorisé)");
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>1e-7)throw Error("Commission invalide (0 € autorisé, deux décimales maximum)");
 return Math.round(n*100);
}
function normalize(rows){
 if(!Array.isArray(rows)||rows.length===0)throw Error("Ajoute au moins un véhicule");
 const result=rows.map((row,index)=>{
  const type=row?.type==="Petite voiture"?"Voiture normale":row?.type;
  if(!row||!TYPES.includes(type))throw Error("Type de véhicule invalide à la ligne "+(index+1));
  const quantity=Number(row.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<1)throw Error("Quantité entière positive obligatoire à la ligne "+(index+1));
  const driver=String(row.driver||"").trim();
  if(!driver)throw Error("Chauffeur obligatoire à la ligne "+(index+1));
  const commissionCents=money(row.commissionUnit);
  if(!Number.isSafeInteger(commissionCents*quantity))throw Error("Commission totale trop élevée à la ligne "+(index+1));
  return {type,quantity,driver,commissionUnit:commissionCents/100,commissionCents:commissionCents*quantity};
 });
 const totalVehicles=result.reduce((n,r)=>n+r.quantity,0);
 if(!Number.isSafeInteger(totalVehicles))throw Error("Trop de véhicules");
 const totalCents=result.reduce((n,r)=>n+r.commissionCents,0);
 if(!Number.isSafeInteger(totalCents))throw Error("Total des commissions trop élevé");
 const cars=result.filter(r=>r.type==="Voiture normale").reduce((n,r)=>n+r.quantity,0);
 const vans=result.filter(r=>r.type==="Van").reduce((n,r)=>n+r.quantity,0);
 if(!Number.isSafeInteger(cars)||!Number.isSafeInteger(vans))throw Error("Quantité de véhicules trop élevée");
 return Object.freeze({assignments:Object.freeze(result.map(row=>Object.freeze(row))),totalVehicles,totalCommission:totalCents/100,vehicleCounts:Object.freeze({cars,vans})});
}
root.TaxiVehicleAllocations=Object.freeze({normalize,TYPES:Object.freeze(TYPES)});
})(typeof window!=="undefined"?window:globalThis);
