/* Éditeur réutilisable : aucune écriture réseau, aucune mutation Supabase. */
(function(root){
"use strict";
function mount(host, options={}){
 if(!host || !root.TaxiVehicleAllocations) throw Error("Éditeur véhicules indisponible");
 const model=root.TaxiVehicleAllocations;
 const doc=host.ownerDocument;
 const rows=[];
 const shell=doc.createElement("div");
 const heading=doc.createElement("h3");heading.textContent="Véhicules et chauffeurs";shell.append(heading);
 const list=doc.createElement("div");shell.append(list);
 const feedback=doc.createElement("p");feedback.setAttribute("role","alert");shell.append(feedback);
 const add=doc.createElement("button");add.type="button";add.textContent="+ Ajouter un véhicule / chauffeur";shell.append(add);
 const confirm=doc.createElement("button");confirm.type="button";confirm.textContent="Confirmer les véhicules";shell.append(confirm);
 let approved=null;
 function field(tag,label,value){
  const wrap=doc.createElement("label");wrap.textContent=label+" ";
  const el=doc.createElement(tag);el.value=value;wrap.append(el);return {wrap,el};
 }
 function invalidate(){approved=null;feedback.textContent="Validation des véhicules nécessaire";if(typeof options.onInvalidate==="function")options.onInvalidate();}
 function addRow(value={}){
  const line=doc.createElement("div");
  const type=field("select","Véhicule",value.type||"Voiture normale");
  model.TYPES.forEach(t=>{const o=doc.createElement("option");o.value=t;o.textContent=t;type.el.append(o)});
  type.el.value=value.type==="Petite voiture"?"Voiture normale":value.type||"Voiture normale";
  const quantity=field("input","Quantité",value.quantity??1);quantity.el.type="number";quantity.el.min="1";quantity.el.step="1";
  const driver=field("input","Chauffeur",value.driver??options.defaultDriver??"Moi");
  driver.el.setAttribute("list",options.driverListId||"driverSuggestions");
  const defaultForType=t=>typeof options.commissionFor==="function"?options.commissionFor(t):options.defaultCommission??10;
  const commission=field("input","Commission unitaire (€)",value.commissionUnit??defaultForType(type.el.value));
  commission.el.type="number";commission.el.min="0";commission.el.step=".01";
  const subtotal=doc.createElement("output");subtotal.setAttribute("aria-live","polite");subtotal.style.display="block";
  function updateSubtotal(){const q=Number(quantity.el.value),c=Number(commission.el.value);subtotal.textContent=Number.isSafeInteger(q)&&q>0&&Number.isFinite(c)&&c>=0&&Number.isSafeInteger(Math.round(q*c*100))?"Sous-total : "+(Math.round(q*c*100)/100).toFixed(2)+" €":"Sous-total : à vérifier";}
  [quantity.el,commission.el].forEach(el=>el.addEventListener("input",updateSubtotal));
  const remove=doc.createElement("button");remove.type="button";remove.textContent="Supprimer";
  [type,quantity,driver,commission].forEach(f=>{line.append(f.wrap);f.el.addEventListener("input",invalidate);f.el.addEventListener("change",invalidate)});
  type.el.addEventListener("change",()=>{if(!commission.el.dataset.manuallyEdited){commission.el.value=defaultForType(type.el.value)}updateSubtotal();invalidate()});
  commission.el.addEventListener("input",()=>{commission.el.dataset.manuallyEdited="1"});
  line.append(subtotal,remove);list.append(line);updateSubtotal();
  const row={line,type:type.el,quantity:quantity.el,driver:driver.el,commission:commission.el};rows.push(row);
  remove.addEventListener("click",()=>{const index=rows.indexOf(row);if(index<0)return;line.remove();rows.splice(index,1);invalidate()});
  invalidate();
 }
 function values(){return rows.map(r=>({type:r.type.value,quantity:r.quantity.value,driver:r.driver.value,commissionUnit:r.commission.value}))}
 function validate(){
  try{
   approved=model.normalize(values());
   feedback.textContent=approved.totalVehicles+" véhicule(s) confirmés : "+approved.vehicleCounts.cars+" voiture(s), "+approved.vehicleCounts.vans+" van(s), "+approved.totalCommission.toFixed(2)+" € de commissions. Attribution : "+approved.assignments.map(a=>a.quantity+" × "+a.type+" → "+a.driver+" ("+a.commissionUnit.toFixed(2)+" € / véhicule)").join(" ; ");
   if(typeof options.onConfirm==="function")options.onConfirm(approved);
   return approved;
  }catch(e){approved=null;feedback.textContent=e&&e.message?e.message:"Confirmation impossible";if(typeof options.onInvalidate==="function")options.onInvalidate();return null}
 }
 add.addEventListener("click",()=>addRow());
 confirm.addEventListener("click",validate);
 host.append(shell);
 (options.initialRows&&options.initialRows.length?options.initialRows:[{}]).forEach(addRow);
 return Object.freeze({getConfirmed:()=>approved,validate,getRows:values,addRow,reset(initialRows){invalidate();list.replaceChildren();rows.length=0;(Array.isArray(initialRows)&&initialRows.length?initialRows:[{}]).forEach(addRow);}});
}
root.TaxiVehicleAllocationEditor=Object.freeze({mount});
})(typeof window!=="undefined"?window:globalThis);
