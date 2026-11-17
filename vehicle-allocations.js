/* Mon Taxi — modèle indépendant des attributions de véhicules.
   Aucune écriture réseau ou Supabase. Utilisable par dépose, pick-up,
   course directe et réservation après raccordement des formulaires. */
(function(root){
"use strict";
const TYPES=["Petite voiture","Van"];
function money(value){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||Math.round(n*100)!==n*100)throw Error("Commission invalide (0 € autorisé, deux décimales maximum)");
 return Math.round(n*100);
}
function normalize(rows){
 if(!Array.isArray(rows)||rows.length===0)throw Error("Ajoute au moins un véhicule");
 const result=rows.map((row,index)=>{
  if(!row||!TYPES.includes(row.type))throw Error("Type de véhicule invalide à la ligne "+(index+1));
  const quantity=Number(row.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<1)throw Error("Quantité entière positive obligatoire à la ligne "+(index+1));
  const driver=String(row.driver||"").trim();
  if(!driver)throw Error("Chauffeur obligatoire à la ligne "+(index+1));
  const commissionCents=money(row.commissionUnit);
  return {type:row.type,quantity,driver,commissionUnit:commissionCents/100,commissionCents:commissionCents*quantity};
 });
 const totalVehicles=result.reduce((n,r)=>n+r.quantity,0);
 if(!Number.isSafeInteger(totalVehicles))throw Error("Trop de véhicules");
 const totalCents=result.reduce((n,r)=>n+r.commissionCents,0);
 if(!Number.isSafeInteger(totalCents))throw Error("Total des commissions trop élevé");
 return {assignments:result,totalVehicles,totalCommission:totalCents/100,vehicleCounts:{
  cars:result.filter(r=>r.type==="Petite voiture").reduce((n,r)=>n+r.quantity,0),
  vans:result.filter(r=>r.type==="Van").reduce((n,r)=>n+r.quantity,0)
 }};
}
root.TaxiVehicleAllocations=Object.freeze({normalize,TYPES:Object.freeze(TYPES)});
})(typeof window!=="undefined"?window:globalThis);
