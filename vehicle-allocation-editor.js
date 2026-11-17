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
 function invalidate(){approved=null;feedback.textContent="Validation des véhicules nécessaire";}
 function addRow(value={}){
  const line=doc.createElement("div");
  const type=field("select","Véhicule",value.type||"Petite voiture");
  model.TYPES.forEach(t=>{const o=doc.createElement("option");o.value=t;o.textContent=t;type.el.append(o)});
  const quantity=field("input","Quantité",value.quantity??1);quantity.el.type="number";quantity.el.min="1";quantity.el.step="1";
  const driver=field("input","Chauffeur",value.driver??options.defaultDriver??"Moi");
  driver.el.setAttribute("list",options.driverListId||"driverSuggestions");
  const commission=field("input","Commission unitaire (€)",value.commissionUnit??options.defaultCommission??10);
  commission.el.type="number";commission.el.min="0";commission.el.step=".01";
  const remove=doc.createElement("button");remove.type="button";remove.textContent="Supprimer";
  [type,quantity,driver,commission].forEach(f=>{line.append(f.wrap);f.el.addEventListener("input",invalidate);f.el.addEventListener("change",invalidate)});
  line.append(remove);list.append(line);
  const row={line,type:type.el,quantity:quantity.el,driver:driver.el,commission:commission.el};rows.push(row);
  remove.addEventListener("click",()=>{line.remove();rows.splice(rows.indexOf(row),1);invalidate()});
  invalidate();
 }
 function values(){return rows.map(r=>({type:r.type.value,quantity:r.quantity.value,driver:r.driver.value,commissionUnit:r.commission.value}))}
 function validate(){
  try{
   approved=model.normalize(values());
   feedback.textContent=approved.totalVehicles+" véhicule(s), "+approved.totalCommission.toFixed(2)+" € de commissions confirmés";
   if(typeof options.onConfirm==="function")options.onConfirm(approved);
   return approved;
  }catch(e){approved=null;feedback.textContent=e.message;return null}
 }
 add.addEventListener("click",()=>addRow());
 confirm.addEventListener("click",validate);
 host.append(shell);
 (options.initialRows&&options.initialRows.length?options.initialRows:[{}]).forEach(addRow);
 return Object.freeze({getConfirmed:()=>approved,validate,getRows:values,addRow});
}
root.TaxiVehicleAllocationEditor=Object.freeze({mount});
})(typeof window!=="undefined"?window:globalThis);
