// Une seule entrée pour les transitions et un stockage propre à la refonte Android.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const screens=[...document.querySelectorAll('.screen')];
const storeKey="mon-taxi-android-refonte:v1";
const statuses=new Set(['planned','loaded','in_progress','awaiting_payment','payment_pending','archived']);
const storage={
 load(){
  const raw=localStorage.getItem(storeKey);
  if(raw===null)return null;
  const data=JSON.parse(raw);
  if(!data||data.version!==1||!data.state||!['hotels','contacts','drivers','courses','ledger'].every(k=>Array.isArray(data.state[k])))throw Error("Données locales illisibles : aucune réinitialisation automatique.");
  const ids=new Set();
  for(const c of data.state.courses){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!statuses.has(c.status))throw Error("Course locale invalide : données conservées.");ids.add(c.id);}
  return data.state;
 },
 save(state){localStorage.setItem(storeKey,JSON.stringify({version:1,state}));}
};
let controller,selected=null,cashDraft=null,sumupDraft=null,restoreDraft=null;
function message(value="",error=false){$('status').textContent=value;$('status').dataset.error=String(error);}
function safe(action){try{message();action();}catch(e){message(e.message||"Action impossible",true);}}
try{controller=window.createTaxiCourseController(storage);}catch(e){message(e.message,true);document.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);return;}
const current=()=>controller.snapshot().courses.find(c=>c.id===selected);
const route=c=>c.from+" → "+c.to;
const euros=cents=>new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR"}).format(cents/100);
function readCashCents(raw){
 const normalized=String(raw).trim();
 if(!/^\d{1,9}(?:[,.]\d{1,2})?$/.test(normalized))throw Error("Montant espèces invalide : deux décimales maximum.");
 const [whole,fraction=""]=normalized.replace(",",".").split(".");
 const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<=0)throw Error("Renseigne le montant positif réellement reçu.");
 return cents;
}
const today=()=>window.TaxiCleanCore.paymentDay(new Date().toISOString());
function entryCents(raw){
 const value=String(raw).trim();
 if(!value)return 0;
 if(!/^\d{1,9}(?:[,.]\d{1,2})?$/.test(value))throw Error("Montant invalide : deux décimales maximum.");
 const [whole,fraction=""]=value.replace(",",".").split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}
function renderCashTotals(){
 const daily=controller.daily(today());
 $('home-cash').textContent=euros(daily.cash);
 $('home-card').textContent=euros(daily.cardGross);
 $('home-receipts').textContent=euros(daily.revenue);
 const day=$('account-day').value||today();
 const row=controller.daily(day),month=controller.monthly(day.slice(0,7));
 for(const [id,key] of Object.entries({cash:"cash",commission:"commission",cashReal:"cashReal",card:"cardGross",fee:"fee",cardNet:"cardNet",appli:"appli",invoiceTtc:"invoiceTtc",revenue:"revenue",fuel:"fuel",expense:"expense",fixed:"fixed",result:"result"}))$('accounts-'+id).textContent=euros(row[key]);
 $('month-label').textContent="Bilan "+day.slice(0,7);
 for(const id of ["revenue","costs","result","average"])$('month-'+id).textContent=euros(month[id]);
 $('month-workedDays').textContent=String(month.workedDays);
}
function loadAccountFields(){
 const day=$('account-day').value||today();$('account-day').value=day;
 const state=controller.snapshot();
 for(const k of window.TaxiCleanCore.fields){const n=state.entries?.[day]?.[k]||0;$('entry-'+k).value=n?(n/100).toFixed(2).replace(".",","):"";}
 const fixed=state.fixed?.[day.slice(0,7)]||0;$('monthly-fixed').value=fixed?(fixed/100).toFixed(2).replace(".",","):"";
 renderCashTotals();
}
$('account-day').value=today();
$('account-day').addEventListener("change",()=>safe(loadAccountFields));
$('accounts-entry').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 const entry=Object.fromEntries(window.TaxiCleanCore.fields.map(k=>[k,entryCents($('entry-'+k).value)]));
 controller.setDay($('account-day').value,entry);loadAccountFields();message("Journal enregistré.");
});});
$('fixed-entry').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 controller.setFixed($('account-day').value.slice(0,7),entryCents($('monthly-fixed').value));loadAccountFields();message("Frais fixes enregistrés.");
});});
function clearRestore(){restoreDraft=null;$('backup-review').hidden=true;}
window.addEventListener("taxi-backup-result",e=>safe(()=>{
 const d=e.detail;if(!d)return;
 if(d.error)throw Error(d.error);
 if(d.action==="exported"){message("Sauvegarde enregistrée dans Téléchargements.");return;}
 if(d.action==="restore-approved"){
  if(!restoreDraft||$('accounts').hidden)throw Error("Restauration non confirmée.");
  controller.restore(restoreDraft);clearRestore();selected=null;renderLists();loadAccountFields();message("Sauvegarde restaurée localement.");return;
 }
 if(d.action==="imported"){
  clearRestore();const candidate=window.TaxiCleanCore.readBackup(d.content);
  restoreDraft=d.content;$('backup-summary').textContent="Sauvegarde : "+candidate.courses.length+" courses, "+candidate.ledger.length+" encaissements. Le remplacement est irréversible sans autre sauvegarde. Sauvegarde d’abord les données actuelles.";
  $('backup-review').hidden=false;
 }
}));
function recoverSumUp(){if(typeof window.TaxiSumUp?.recover==="function")window.TaxiSumUp.recover();}
function ackSumUp(id){if(typeof window.TaxiSumUp?.ack==="function")window.TaxiSumUp.ack(id);}
window.addEventListener("mon-taxi-sumup-result",e=>{
 try{
  const d=e.detail;if(!d||!d.courseId||!d.attemptId)return;
  const c=controller.snapshot().courses.find(x=>x.id===d.courseId);
  if(!c)return;
  if(c.status==="archived"&&c.payment?.attemptId===d.attemptId&&c.payment?.reference===d.transactionCode){ackSumUp(d.attemptId);return;}
  if(c.lastPaymentAttempt?.attemptId===d.attemptId&&c.lastPaymentAttempt.status===d.status){ackSumUp(d.attemptId);return;}
  if(c.status!=="payment_pending"||c.payment?.attemptId!==d.attemptId)return;
  const result=controller.receiveSumUp(c.id,d);
  if(result.status==="archived"){
   ackSumUp(d.attemptId);
   if(selected===c.id){selected=null;sumupDraft=null;$('amount').value="";show("home");}
   else{renderLists();renderCashTotals();}
   message("Paiement SumUp confirmé : "+euros(result.payment.amountCents)+". Course archivée.");
  }else if(result.status==="awaiting_payment"){
   ackSumUp(d.attemptId);
   if(selected===c.id){$('amount').value=String(c.payment.amountCents/100).replace(".",",");show("payment");}
   message("Paiement non effectué. La course reste à payer.");
  }else{
   if(selected===c.id&& !$('sumup').hidden)show("sumup");
   if(d.status==="uncertain")message("Statut incertain : ne pas relancer ni encaisser en espèces pour cette course avant vérification.",true);
  }
 }catch(error){message(error.message||"Résultat SumUp à vérifier. Ne pas relancer.",true);}
});
window.addEventListener("taxi-native-resume",recoverSumUp);
const labels={planned:"Client à charger",loaded:"Client chargé",in_progress:"Course en cours",awaiting_payment:"En attente de paiement",payment_pending:"Paiement en attente",archived:"Course archivée"};
function launchWaze(c){
 if(c.status!=="in_progress")throw Error("La course doit être démarrée.");
 if(!window.TaxiContacts||typeof window.TaxiContacts.navigateWaze!=="function")throw Error("Waze est disponible uniquement dans l’application Android.");
 window.TaxiContacts.navigateWaze(c.id,c.to);
}
function resumeWaze(){
 if(window.TaxiContacts&&typeof window.TaxiContacts.requestWazeReturn==="function")window.TaxiContacts.requestWazeReturn();
}
window.addEventListener("taxi-waze-result",e=>safe(()=>{
 const d=e.detail;if(!d||d.courseId!==selected||current()?.status!=="in_progress")return;
 if(d.status==="error")message(d.error||"Waze indisponible : la course reste en cours.",true);
 else if(d.status==="opened"&&d.overlay===false)message("Waze ouvert. Le bouton flottant nécessite une autorisation ; retour manuel possible.");
}));
window.addEventListener("taxi-return-active-course",e=>safe(()=>{
 const id=e.detail?.courseId,c=controller.snapshot().courses.find(x=>x.id===id);
 if(c?.status==="in_progress"){selected=id;show("ride");message("Course en cours. Termine-la uniquement à l’arrivée.");}
 if(id&&typeof window.TaxiContacts?.ackWazeReturn==="function")window.TaxiContacts.ackWazeReturn(id);
}));
window.addEventListener("taxi-native-resume",resumeWaze);
const actions={planned:"Charger",loaded:"Démarrer la course",in_progress:"Terminer la course"};
function card(c,archived=false){
 const box=document.createElement("article");box.className="card";
 const h=document.createElement("h3");h.textContent=c.client||"Course sans nom";
 const p=document.createElement("p");p.textContent=route(c);
 const detail=document.createElement("p");detail.className="muted";detail.textContent=[c.kind==="reservation"?"Réservation":"Course directe",c.direction==="pickup"?"Pick-up":"Dépose",c.date,c.time,labels[c.status]].filter(Boolean).join(" · ");
 box.append(h,p,detail);
 if(archived&&c.payment){const pay=document.createElement("p");pay.textContent=(c.payment.method==="cash"?"Espèces":"Carte")+" · "+euros(c.payment.amountCents);box.append(pay);}
 if(!archived){const b=document.createElement("button");b.type="button";b.className="primary";b.dataset.course=c.id;b.textContent=c.status==="awaiting_payment"||c.status==="payment_pending"?"Ouvrir le paiement":"Ouvrir la course";box.append(b);}
 return box;
}
function renderLists(){
 const all=controller.snapshot().courses;
 const active=all.filter(c=>c.status!=="archived").sort((a,b)=>(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 const archived=all.filter(c=>c.status==="archived");
 $('course-list').replaceChildren(...active.map(c=>card(c)));
 $('archive-list').replaceChildren(...archived.map(c=>card(c,true)));
 $('planning-empty').hidden=active.length>0;$('archives-empty').hidden=archived.length>0;
}
function show(id){
 if(!screens.some(e=>e.id===id))throw Error("Écran inconnu");
 if(['ride','payment','cash','sumup'].includes(id)){
  const c=current();if(!c||c.status==="archived")throw Error("Aucune course active");
  if(id!=="ride"&&c.status!=="awaiting_payment"&&!(id==="sumup"&&c.status==="payment_pending"))throw Error("La course doit être terminée avant le paiement");
  if(id==="ride"){
   $('ride-step').textContent=labels[c.status];$('ride-route').textContent=route(c);
   $('ride-next').textContent=actions[c.status]||"Accéder au paiement";$('ride-next').disabled=c.status==="payment_pending";
   $('waze-reopen').hidden=c.status!=="in_progress";
   $('waze-overlay').hidden=c.status!=="in_progress";
   document.querySelectorAll('[data-step]').forEach(e=>{if(e.dataset.step===c.status)e.setAttribute("aria-current","step");else e.removeAttribute("aria-current");});
  }else {
   $('payment-route').textContent=route(c);
   if(id==="cash"){
    if(!cashDraft||cashDraft.id!==c.id)throw Error("Montant espèces à confirmer.");
    $('cash-route').textContent=route(c);$('cash-confirm-amount').textContent=euros(cashDraft.cents);
   }
   if(id==="sumup"){
    const pending=c.status==="payment_pending";
    if(!pending&&(!sumupDraft||sumupDraft.id!==c.id))throw Error("Montant carte à confirmer.");
    $('sumup-route').textContent=route(c);
    $('sumup-amount').textContent=euros(pending?c.payment.amountCents:sumupDraft.cents);
    $('sumup-confirm').hidden=pending;$('sumup-back').hidden=pending;$('sumup-recover').hidden=!pending;
    $('sumup-message').textContent=pending?"Paiement en attente de confirmation. Ne pas recommencer.":"Confirme l’envoi du montant au Solo Lite.";
   }
  }
 }
 if(id!=="cash")cashDraft=null;
 if(id!=="sumup")sumupDraft=null;
 if(id==="planning"||id==="archives")renderLists();
 if(id==="home")renderCashTotals();
 if(id==="accounts")loadAccountFields();else clearRestore();
 screens.forEach(e=>e.hidden=e.id!==id);
 document.querySelectorAll('[data-page]').forEach(e=>{if(e.dataset.page===id)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});
 window.scrollTo(0,0);
}
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function localTime(d){return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function newId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
document.addEventListener("submit",e=>{
 const form=e.target.closest("form[data-kind]");if(!form)return;e.preventDefault();
 safe(()=>{
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form)),now=new Date(),kind=form.dataset.kind;
  const from=String(fields.from||"").trim(),to=String(fields.to||"").trim();
  if(!from||!to)throw Error("Renseigne le départ et la destination.");
  const date=kind==="reservation"?fields.date:localDate(now),time=kind==="reservation"?fields.time:localTime(now);
  if(!date||!time)throw Error("Renseigne la date et l’heure.");
  controller.plan({id:newId(),kind,direction:fields.direction,client:String(fields.client||"").trim(),phone:String(fields.phone||"").trim(),from,to,date,time,scheduledAt:date+"T"+time});
  form.reset();show("home");message("Course enregistrée dans le planning.");
 });
});
document.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b||b.disabled)return;
 if(b.dataset.course){safe(()=>{selected=b.dataset.course;$('amount').value="";const c=current();if(!c)throw Error("Course inconnue");show(c.status==="awaiting_payment"?"payment":c.status==="payment_pending"?"sumup":"ride");if(c.status==="payment_pending")recoverSumUp();});return;}
 if(b.id==="ride-next"){safe(()=>{
  const c=current();if(!c)throw Error("Course inconnue");
  if(c.status==="planned"){controller.load(c.id);show("ride");}
  else if(c.status==="loaded"){controller.start(c.id);show("ride");launchWaze(current());}
  else if(c.status==="in_progress"){controller.finish(c.id);show("payment");}
  else if(c.status==="awaiting_payment")show("payment");
  else throw Error("Action incompatible avec le statut de la course.");
 });return;}
 if(b.id==="backup-export"){safe(()=>{
  if($('accounts').hidden||typeof window.TaxiBackup?.exportJson!=="function")throw Error("Sauvegarde disponible sur Android.");
  window.TaxiBackup.exportJson(controller.backup());
 });return;}
 if(b.id==="backup-import"){safe(()=>{
  if($('accounts').hidden||typeof window.TaxiBackup?.pickJson!=="function")throw Error("Restauration disponible sur Android.");
  if(controller.snapshot().courses.some(c=>c.status==="payment_pending"))throw Error("Paiement en attente : restauration interdite.");
  clearRestore();window.TaxiBackup.pickJson();
 });return;}
 if(b.id==="backup-cancel"){clearRestore();return;}
 if(b.id==="backup-restore"){safe(()=>{
  if($('accounts').hidden||!restoreDraft)throw Error("Aucune sauvegarde à restaurer.");
  if(typeof window.TaxiBackup?.approveRestore!=="function")throw Error("Restauration disponible sur Android.");
  window.TaxiBackup.approveRestore(); 
 });return;}
 if(b.id==="pay-sumup"){safe(()=>{
  const c=current();if(c?.status!=="awaiting_payment"||$('payment').hidden)throw Error("La course doit être terminée avant le paiement.");
  const cents=readCashCents($('amount').value);
  if(cents<100||cents>9999900)throw Error("Montant terminal : de 1 à 99 999 euros.");
  sumupDraft={id:c.id,cents};show("sumup");
 });return;}
 if(b.id==="sumup-confirm"){safe(()=>{
  const c=current(),draft=sumupDraft;
  if($('sumup').hidden||!draft||draft.id!==c?.id||c.status!=="awaiting_payment")throw Error("Aucun paiement carte à confirmer.");
  if(typeof window.TaxiSumUp?.checkout!=="function")throw Error("Terminal disponible uniquement sur Android.");
  if(controller.snapshot().courses.some(x=>x.status==="payment_pending"))throw Error("Une tentative SumUp doit être vérifiée avant une nouvelle.");
  const attempt=newId();
  controller.beginSumUp(c.id,draft.cents,attempt);
  show("sumup");window.TaxiSumUp.checkout(c.id,attempt,draft.cents);
 });return;}
 if(b.id==="sumup-recover"){safe(()=>{recoverSumUp();});return;}
 if(b.id==="pay-cash"){safe(()=>{
  const c=current();if(c?.status!=="awaiting_payment"||$('payment').hidden)throw Error("La course doit être terminée avant le paiement.");
  cashDraft={id:c.id,cents:readCashCents($('amount').value)};
  show("cash");
 });return;}
 if(b.id==="cash-confirm"){safe(()=>{
  const c=current(),draft=cashDraft;
  if($('cash').hidden||!draft||c?.id!==draft.id||c.status!=="awaiting_payment")throw Error("Aucun paiement espèces à confirmer.");
  b.disabled=true;
  try{
   controller.cash(draft.id,draft.cents);
   cashDraft=null;selected=null;$('amount').value="";
   show("home");message("Espèces enregistrées : "+euros(draft.cents)+". Course archivée.");
  }finally{b.disabled=false;}
 });return;}
 if(b.id==="waze-reopen"){safe(()=>{const c=current();if(!c)throw Error("Course inconnue");launchWaze(c);});return;}
 if(b.id==="waze-overlay"){safe(()=>{if(current()?.status!=="in_progress")throw Error("Aucune course en cours.");if(typeof window.TaxiContacts?.enableWazeOverlay!=="function")throw Error("Disponible uniquement sur Android.");window.TaxiContacts.enableWazeOverlay();});return;}
 const id=b.dataset.page||b.dataset.go;if(id)safe(()=>show(id));
});
renderLists();
renderCashTotals();
resumeWaze();
recoverSumUp();
})();
