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
let hotelEdit=null,personDraft=null,contactRequest=null,deleteDraft=null;
function message(value="",error=false){$('status').textContent=value;$('status').dataset.error=String(error);}
function safe(action){try{message();action();}catch(e){message(e.message||"Action impossible",true);}}
try{controller=window.createTaxiCourseController(storage);}catch(e){message(e.message,true);document.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);return;}
const current=()=>controller.snapshot().courses.find(c=>c.id===selected);
const route=c=>[c.from,c.to].filter(x=>typeof x==="string"&&x.trim()).join(" → ")||"Course libre";
function playConfirmedPayment(){try{window.TaxiPaymentSound?.play();}catch(_){/* A sound cannot reverse a recorded receipt. */}}
function showPaymentSuccess(c){
  $('success-amount').textContent=euros(c.payment.amountCents);
  $('success-route').textContent=route(c);
  $('success-method').textContent=c.payment.method==="cash"?"Espèces enregistrées":"Paiement réussi";
  const now=new Date(),local=localDate(now)+"T"+localTime(now);
  const planned=controller.snapshot().courses.filter(x=>x.status==="planned"&&typeof x.scheduledAt==="string"&&x.scheduledAt>=local).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
  const next=planned[0],button=$('success-next');
  $('success-next-time').textContent=next?(next.date===localDate(now)?"Aujourd’hui":next.date||"")+" · "+(next.time||""):"Aucune course planifiée";
  button.hidden=!next;
  if(next)button.dataset.course=next.id;else delete button.dataset.course;
  show("success");
}
const euros=cents=>new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR"}).format(cents/100);
// A monetary field always represents integer cents; typing appends digits from the right.
function moneyFormat(digits){
 const clean=String(digits).replace(/^0+(?=\d)/,"");
 if(!/^\d{0,11}$/.test(clean))throw Error("Montant trop élevé ou invalide.");
 const padded=(clean||"0").padStart(3,"0");
 return padded.slice(0,-2)+","+padded.slice(-2);
}
function moneyField(e){return e.target instanceof HTMLInputElement&&e.target.hasAttribute("data-money");}
function writeMoney(el,digits){
 const value=moneyFormat(digits);el.value=value;el.setSelectionRange(value.length,value.length);
}
function selectedDigits(el){
 const v=el.value,lo=el.selectionStart??v.length,hi=el.selectionEnd??v.length;
 return {before:v.slice(0,lo).replace(/\D/g,""),after:v.slice(hi).replace(/\D/g,""),all:lo===0&&hi===v.length,selected:hi>lo};
}
document.addEventListener("beforeinput",e=>{
 if(!moneyField(e)||!e.cancelable||e.isComposing)return;
 const el=e.target,sel=selectedDigits(el),type=e.inputType||"";
 if(type==="insertText"&&typeof e.data==="string"&&/^[0-9.,]+$/.test(e.data)){
  // Multi-character values with an explicit decimal separator can come from autofill.
  if(e.data.length>1&&/^\d{1,9}[,.]\d{2}$/.test(e.data))return;
  e.preventDefault();
  if(!/^\d+$/.test(e.data))return;
  try{writeMoney(el,sel.before+e.data+sel.after);}catch(err){message(err.message,true);}
 }else if(["deleteContentBackward","deleteContentForward","deleteByCut"].includes(type)){
  e.preventDefault();
  let before=sel.before,after=sel.after;
  if(!sel.selected){if(type==="deleteContentBackward")before=before.slice(0,-1);else if(type==="deleteContentForward")after=after.slice(1);}
  writeMoney(el,before+after);
 }
});
document.addEventListener("input",e=>{
 if(!moneyField(e)||e.isComposing)return;
 const el=e.target,v=el.value;
 // Non-cancelable mobile edits may append a digit after the two decimal places.
 // Do not turn malformed pasted decimal amounts into other financial amounts.
 if(/^\d+$/.test(v)||(/^\d+,\d{0,3}$/.test(v)&&e.inputType==="deleteContentBackward")){
  try{writeMoney(el,v.replace(/\D/g,""));}catch(err){message(err.message,true);}
 }else if(/^\d+,\d{3}$/.test(v)&&e.inputType==="insertText"&&/^\d$/.test(e.data||"")){
  try{writeMoney(el,v.replace(/\D/g,""));}catch(err){message(err.message,true);}
 }else if(/^\d{1,9}\.\d{2}$/.test(v)){el.value=v.replace(".",",");}
});
document.addEventListener("paste",e=>{
 if(!moneyField(e)||!e.clipboardData)return;
 e.preventDefault();const v=e.clipboardData.getData("text").trim();
 try{
  if(/^\d{1,9}[,.]\d{2}$/.test(v))writeMoney(e.target,v.replace(/\D/g,""));
  else if(/^\d{1,11}$/.test(v))writeMoney(e.target,v);
  else throw Error("Montant collé invalide : utilise des chiffres ou deux décimales.");
 }catch(err){message(err.message,true);}
});
let moneyTarget=null;
const moneyPad=document.createElement("div");
moneyPad.className="money-pad";moneyPad.hidden=true;moneyPad.setAttribute("role","group");moneyPad.setAttribute("aria-label","Clavier des montants");
const keys=[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"],["00","00"],["0","0"],["back","⌫"],["clear","Effacer"],["done","Terminé"]];
for(const [key,label] of keys){
 const button=document.createElement("button");button.type="button";button.dataset.moneyKey=key;button.textContent=label;
 if(key==="back")button.setAttribute("aria-label","Effacer le dernier chiffre");
 if(key==="00")button.setAttribute("aria-label","Double zéro");
 if(key==="clear"||key==="done")button.className="money-pad-action";
 moneyPad.append(button);
}
function closeMoneyPad(){
 const el=moneyTarget;moneyTarget=null;moneyPad.hidden=true;moneyPad.remove();
 if(el&&document.activeElement===el)el.blur();
}
function openMoneyPad(el){
 if(el.disabled||el.readOnly)return;
 moneyTarget=el;const field=el.closest(".field")||el;
 field.after(moneyPad);moneyPad.hidden=false;
}
function moneyKeyValue(value,key){
 if(!/^\d{1,9}[,.]\d{2}$/.test(value)&&value!==""&&value!=="0")throw Error("Montant invalide : efface-le avant de recommencer.");
 const digits=value.replace(/\D/g,"").replace(/^0+(?=\d)/,"");
 if(key==="clear")return "";
 if(key==="back")return moneyFormat(digits.slice(0,-1));
 if(!/^\d{1,2}$/.test(key))throw Error("Touche inconnue.");
 return moneyFormat(digits+key);
}
moneyPad.addEventListener("pointerdown",e=>{if(e.target.closest("button"))e.preventDefault();});
moneyPad.addEventListener("click",e=>{
 const b=e.target.closest("button[data-money-key]");if(!b)return;
 e.stopPropagation();const el=moneyTarget;if(!el||!el.isConnected){closeMoneyPad();return;}
 const key=b.dataset.moneyKey;if(key==="done"){closeMoneyPad();return;}
 try{
  // Effacer is also available when a pasted amount was malformed.
  el.value=key==="clear"?"":moneyKeyValue(el.value,key);
  el.setSelectionRange(el.value.length,el.value.length);
  el.dispatchEvent(new Event("change",{bubbles:true}));
 }catch(err){message(err.message,true);}
});
document.addEventListener("focusin",e=>{if(moneyField(e))openMoneyPad(e.target);});
document.addEventListener("click",e=>{
 if(moneyField(e)){openMoneyPad(e.target);return;}
 if(moneyTarget&&!moneyPad.contains(e.target))closeMoneyPad();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&moneyTarget){e.preventDefault();closeMoneyPad();}});
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
function selectOptions(select,items,emptyLabel,preferred=select.value){
 const options=[new Option(emptyLabel,""),...items.map(x=>new Option(x.name,x.id))];
 select.replaceChildren(...options);select.value=items.some(x=>x.id===preferred)?preferred:"";
}
function refreshCourseContacts(kind,applyDefault=false){
 const s=controller.snapshot(),hotel=s.hotels.find(h=>h.id===$(kind+'-hotel').value);
 const contacts=s.contacts.filter(c=>c.hotelId===hotel?.id),sel=$(kind+'-contact');
 selectOptions(sel,contacts,"Aucun",applyDefault?hotel?.defaultContactId||"":sel.value);
}
function refreshCourseDirectory(){
 const s=controller.snapshot();
 for(const kind of ["reservation","direct"]){
  selectOptions($(kind+'-hotel'),s.hotels,"Autre / aucun");
  selectOptions($(kind+'-driver'),s.drivers,"Moi");refreshCourseContacts(kind);
 }
}
for(const kind of ["reservation","direct"])$(kind+'-hotel').addEventListener("change",()=>refreshCourseContacts(kind,true));
function localButton(label,action,kind,id){
 const b=document.createElement("button");b.type="button";b.textContent=label;b.dataset.dirAction=action;b.dataset.dirKind=kind;b.dataset.dirId=id;return b;
}
function renderDirectory(){
 const s=controller.snapshot(),mode=$('directory-sort').value;
 selectOptions($('contact-hotel'),s.hotels,"Choisir un hôtel");
 $('pick-contact').disabled=!$('contact-hotel').value||!!contactRequest;$('pick-driver').disabled=!!contactRequest;
 for(const kind of ["hotels","contacts","drivers"]){
  const items=s[kind].slice();if(mode!=="priority")items.sort((a,b)=>(mode==="az"?1:-1)*a.name.localeCompare(b.name,"fr",{sensitivity:"base"}));
  const root=$(kind+'-list');root.replaceChildren();
  $(kind+'-empty').hidden=items.length>0;
  for(const item of items){
   const box=document.createElement("article");box.className="card";
   const h=document.createElement("h3");h.textContent=item.name;box.append(h);
   if(kind!=="hotels"){const p=document.createElement("p");p.textContent=item.phone+(kind==="contacts"?" · "+(s.hotels.find(h=>h.id===item.hotelId)?.name||""):"");box.append(p);}
   if(kind==="contacts"){const h=s.hotels.find(h=>h.id===item.hotelId);if(h?.defaultContactId===item.id){const p=document.createElement("p");p.textContent="Contact par défaut";box.append(p);}else box.append(localButton("Définir par défaut","default",kind,item.id));}
   box.append(localButton("Modifier","edit",kind,item.id),localButton("Supprimer","delete",kind,item.id));
   if(mode==="priority"){
    const row=document.createElement("div");row.className="grid";
    const up=localButton("Monter","up",kind,item.id),down=localButton("Descendre","down",kind,item.id);
    up.disabled=s[kind][0]?.id===item.id;down.disabled=s[kind].at(-1)?.id===item.id;row.append(up,down);box.append(row);
   }
   root.append(box);
  }
 }
 refreshCourseDirectory();
}
function resetHotel(){hotelEdit=null;$('hotel-form').reset();$('hotel-form-title').textContent="Ajouter un hôtel";$('hotel-cancel').hidden=true;}
function clearPerson(){personDraft=null;$('person-form').hidden=true;$('person-form').reset();}
function editPerson(kind,item){personDraft={kind,...item};$('person-title').textContent=kind==="drivers"?"Chauffeur dans Mon Taxi Pro":"Contact de l'hôtel dans Mon Taxi Pro";$('person-name').value=item.name;$('person-phone').value=item.phone;$('person-form').hidden=false;$('person-form').scrollIntoView({block:"nearest"});}
function clearDelete(){deleteDraft=null;$('directory-delete').hidden=true;}
$('directory-sort').addEventListener("change",()=>safe(renderDirectory));
$('contact-hotel').addEventListener("change",()=>safe(renderDirectory));
$('hotel-form').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 const old=controller.snapshot().hotels.find(h=>h.id===hotelEdit);
 controller.saveDirectory("hotels",{id:old?.id||newId(),name:$('hotel-name').value,defaultContactId:old?.defaultContactId});
 resetHotel();renderDirectory();message("Hôtel enregistré.");
});});
$('person-form').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 if(!personDraft)throw Error("Aucun contact sélectionné.");
 controller.saveDirectory(personDraft.kind,{...personDraft,name:$('person-name').value,phone:$('person-phone').value});
 clearPerson();renderDirectory();message("Contact enregistré uniquement dans Mon Taxi Pro.");
});});
function pickPerson(kind){
 if(contactRequest)throw Error("Sélection déjà ouverte.");
 if(typeof window.TaxiContacts?.pick!=="function")throw Error("Sélecteur disponible sur Samsung.");
 const hotelId=kind==="contacts"?$('contact-hotel').value:null;
 if(kind==="contacts"&&!hotelId)throw Error("Choisir l’hôtel.");
 clearPerson();contactRequest={kind,hotelId,requestId:newId()};
 renderDirectory();try{window.TaxiContacts.pick(contactRequest.requestId);}catch(e){contactRequest=null;renderDirectory();throw e;}
}
window.addEventListener("taxi-contacts-result",e=>{
 const d=e.detail,request=contactRequest;
 if(!request||d?.requestId!==request.requestId)return;
 contactRequest=null;safe(()=>{
  renderDirectory();if(d.error)throw Error(d.error);
  if($('directory').hidden||d.contacts?.length!==1)throw Error("Aucun contact sélectionné.");
  const c=d.contacts[0];editPerson(request.kind,{id:newId(),hotelId:request.hotelId,nativeId:c.nativeId,name:c.name||"",phone:c.phone||""});
 });
});
function directoryAction(b){
 const {dirAction:action,dirKind:kind,dirId:id}=b.dataset,s=controller.snapshot(),item=s[kind]?.find(x=>x.id===id);
 if(!item)throw Error("Élément introuvable.");
 if(action==="edit"){
  if(kind==="hotels"){hotelEdit=id;$('hotel-name').value=item.name;$('hotel-form-title').textContent="Modifier l'hôtel";$('hotel-cancel').hidden=false;$('hotel-form').scrollIntoView({block:"nearest"});}
  else editPerson(kind,item);
 }else if(action==="default"){
  const h=s.hotels.find(h=>h.id===item.hotelId);controller.saveDirectory("hotels",{...h,defaultContactId:id});renderDirectory();
 }else if(action==="up"||action==="down"){controller.moveDirectory(kind,id,action==="up"?-1:1);renderDirectory();}
 else if(action==="delete"){deleteDraft={kind,id};$('directory-delete-label').textContent="Supprimer "+item.name+" uniquement de Mon Taxi Pro ?"+(kind==="hotels"?" Ses contacts associés seront retirés du répertoire local.":"");$('directory-delete').hidden=false;$('directory-delete').scrollIntoView({block:"nearest"});}
}
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
   playConfirmedPayment();
   if(selected===c.id){selected=null;sumupDraft=null;$('amount').value="";showPaymentSuccess(result);}
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
 const h=document.createElement("h3");h.textContent=c.client||(c.kind==="free"?"Course libre":"Course sans nom");
 const p=document.createElement("p");p.textContent=route(c);
 const detail=document.createElement("p");detail.className="muted";detail.textContent=[c.kind==="reservation"?"Réservation":c.kind==="free"?"Course libre":"Course directe",c.direction==="pickup"?"Pick-up":"Dépose",c.date,c.time,labels[c.status]].filter(Boolean).join(" · ");
 box.append(h,p,detail);
 if(c.startedAt||c.finishedAt){const times=document.createElement("p");times.className="muted";const format=t=>t?new Date(t).toLocaleString("fr-BE",{timeZone:"Europe/Brussels",dateStyle:"short",timeStyle:"short"}):"—";times.textContent="Début : "+format(c.startedAt)+" · Fin : "+format(c.finishedAt);box.append(times);}
 if(c.hotelName||c.driverName){const a=document.createElement("p");a.textContent=[c.hotelName,c.driverName,c.commissionCents?euros(c.commissionCents):""].filter(Boolean).join(" · ");box.append(a);}
 if(archived&&c.payment){
  const pay=document.createElement("p");pay.textContent=(c.payment.method==="cash"?"Espèces":"Carte")+" · "+euros(c.payment.amountCents);box.append(pay);
  if(c.refund){
   const note=document.createElement("p");note.textContent=(c.refund.amountCents===c.payment.amountCents?"Remboursée":"Remboursée partiellement")+" · "+euros(c.refund.amountCents)+" · "+c.refund.day;box.append(note);
  }else if(["cash","sumup"].includes(c.payment.method)){
   const b=document.createElement("button");b.type="button";b.textContent="Remboursement";box.append(b);
   const panel=document.createElement("div");panel.className="card";panel.hidden=true;
   const note=document.createElement("p");note.textContent=c.payment.method==="sumup"?"SumUp · uniquement après remboursement confirmé dans SumUp. Aucun remboursement bancaire déclenché ici. Les frais estimés et commissions restent inchangés.":"Espèces · uniquement après avoir rendu l’argent. Les commissions restent inchangées.";
   const amountLabel=document.createElement("label");amountLabel.className="field";amountLabel.textContent="Montant remboursé (€)";
   const amount=document.createElement("input");amount.type="text";amount.inputMode="none";amount.setAttribute("data-money","");amount.value=(c.payment.amountCents/100).toFixed(2).replace(".",",");amountLabel.append(amount);
   const label=document.createElement("label");label.className="field";label.textContent="Date effective du remboursement ";
   const date=document.createElement("input");date.type="date";date.min=window.TaxiCleanCore.paymentDay(c.payment.paidAt);date.max=today();date.value=today();label.append(date);
   const yes=document.createElement("button");yes.type="button";yes.textContent="Confirmer le remboursement effectué";
   const no=document.createElement("button");no.type="button";no.textContent="Annuler";
   panel.append(note,amountLabel,label,yes,no);box.append(panel);
   b.addEventListener("click",()=>{panel.hidden=false;b.hidden=true;});
   no.addEventListener("click",()=>{panel.hidden=true;b.hidden=false;});
   yes.addEventListener("click",()=>safe(()=>{if($('archives').hidden)throw Error("Ouvre l’historique.");controller.refund(c.id,date.value,entryCents(amount.value));renderLists();renderCashTotals();message("Remboursement enregistré localement.");}));
  }
 }
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
 closeMoneyPad();
 if(!screens.some(e=>e.id===id))throw Error("Écran inconnu");
 if(['ride','payment','cash','sumup'].includes(id)){
  const c=current();if(!c||c.status==="archived")throw Error("Aucune course active");
  if(id!=="ride"&&c.status!=="awaiting_payment"&&!(id==="sumup"&&c.status==="payment_pending"))throw Error("La course doit être terminée avant le paiement");
  if(id==="ride"){
   $('ride-step').textContent=labels[c.status];$('ride-route').textContent=route(c);
   $('ride-next').textContent=actions[c.status]||"Accéder au paiement";$('ride-next').disabled=c.status==="payment_pending";
   $('waze-reopen').hidden=c.status!=="in_progress"||!c.to;
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
    $('sumup-message').textContent=pending?"Paiement en attente de confirmation. Ne pas recommencer.":"Confirme l’envoi du montant au terminal SumUp.";
   }
  }
 }
 if(id!=="cash")cashDraft=null;
 if(id!=="sumup")sumupDraft=null;
 if(id==="planning"||id==="archives")renderLists();
 if(id==="directory")renderDirectory();
 if(id==="reservation"||id==="direct")refreshCourseDirectory();
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
 const free=e.target.closest("#free-ride-form");if(free){e.preventDefault();safe(()=>{
   if(!free.reportValidity())return;
   const fields=Object.fromEntries(new FormData(free)),now=new Date();
   const from=String(fields.from||"").trim().slice(0,250),to=String(fields.to||"").trim().slice(0,250);
   const id=newId();controller.startFree({id,from,to,client:String(fields.label||"").trim().slice(0,160),date:localDate(now),time:localTime(now),scheduledAt:localDate(now)+"T"+localTime(now)});
   selected=id;$('amount').value="";free.reset();show("ride");if(to)launchWaze(current());
 });return;}
 const form=e.target.closest("form[data-kind]");if(!form)return;e.preventDefault();
 safe(()=>{
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form)),now=new Date(),kind=form.dataset.kind;
  const from=String(fields.from||"").trim(),to=String(fields.to||"").trim();
  if(!from||!to)throw Error("Renseigne le départ et la destination.");
  const date=kind==="reservation"?fields.date:localDate(now),time=kind==="reservation"?fields.time:localTime(now);
  if(!date||!time)throw Error("Renseigne la date et l’heure.");
  const s=controller.snapshot(),hotel=s.hotels.find(x=>x.id===fields.hotelId),contact=s.contacts.find(x=>x.id===fields.contactId&&x.hotelId===hotel?.id),driver=s.drivers.find(x=>x.id===fields.driverId);
  if((fields.hotelId&&!hotel)||(fields.contactId&&!contact)||(fields.driverId&&!driver))throw Error("Répertoire modifié : vérifier la sélection.");
  controller.plan({id:newId(),kind,direction:fields.direction,client:String(fields.client||"").trim(),phone:String(fields.phone||"").trim(),from,to,date,time,scheduledAt:date+"T"+time,hotelId:hotel?.id||null,hotelName:hotel?.name||"",contactId:contact?.id||null,contactName:contact?.name||"",driverId:driver?.id||null,driverName:driver?.name||"Moi",driverPhone:driver?.phone||"",driverIsMe:!driver,commissionCents:entryCents(fields.commission||"")});
  form.reset();show("home");message("Course enregistrée dans le planning.");
 });
});
document.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b||b.disabled)return;
 if(b.dataset.course){safe(()=>{selected=b.dataset.course;const c=current();if(!c)throw Error("Course inconnue");$('amount').value=c.paymentDraftCents?(c.paymentDraftCents/100).toFixed(2).replace(".",","):"";show(c.status==="awaiting_payment"?"payment":c.status==="payment_pending"?"sumup":"ride");if(c.status==="payment_pending")recoverSumUp();});return;}
 if(b.id==="success-home"){safe(()=>show("home"));return;}
 if(b.id==="ride-next"){safe(()=>{
  const c=current();if(!c)throw Error("Course inconnue");
  if(c.status==="planned"){controller.load(c.id);show("ride");}
  else if(c.status==="loaded"){controller.start(c.id);show("ride");launchWaze(current());}
  else if(c.status==="in_progress"){controller.finish(c.id);show("payment");}
  else if(c.status==="awaiting_payment")show("payment");
  else throw Error("Action incompatible avec le statut de la course.");
 });return;}
 if(b.dataset.dirAction){safe(()=>directoryAction(b));return;}
 if(b.id==="hotel-cancel"){resetHotel();return;}
 if(b.id==="person-cancel"){clearPerson();return;}
 if(b.id==="pick-contact"||b.id==="pick-driver"){safe(()=>pickPerson(b.id==="pick-contact"?"contacts":"drivers"));return;}
 if(b.id==="directory-delete-cancel"){clearDelete();return;}
 if(b.id==="directory-delete-confirm"){safe(()=>{if(!deleteDraft)throw Error("Aucune suppression à confirmer.");controller.removeDirectory(deleteDraft.kind,deleteDraft.id);clearDelete();clearPerson();resetHotel();renderDirectory();message("Suppression locale effectuée.");});return;}
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
  controller.savePaymentDraft(c.id,cents);
  sumupDraft={id:c.id,cents};show("sumup");
 });return;}
 if(b.id==="sumup-confirm"){safe(()=>{
  const c=current(),draft=sumupDraft;
  if($('sumup').hidden||!draft||draft.id!==c?.id||c.status!=="awaiting_payment")throw Error("Aucun paiement carte à confirmer.");
  if(typeof window.TaxiSumUp?.checkout!=="function")throw Error("Terminal disponible uniquement sur Android.");
  const blocking=controller.snapshot().courses.find(x=>x.status==="payment_pending");
  if(blocking)throw Error("Une tentative SumUp doit être vérifiée avant une nouvelle. Course concernée : "+(blocking.client||route(blocking))+" · "+euros(blocking.payment.amountCents)+". Ouvre cette course dans le planning. Aucun nouvel envoi au terminal.");
  const attempt=newId();
  controller.beginSumUp(c.id,draft.cents,attempt);
  show("sumup");window.TaxiSumUp.checkout(c.id,attempt,draft.cents);
 });return;}
 if(b.id==="sumup-recover"){safe(()=>{const c=current();if(c?.status!=="payment_pending")throw Error("Aucune tentative à vérifier.");if(typeof window.TaxiSumUp?.recoverInterrupted==="function")window.TaxiSumUp.recoverInterrupted(c.id,c.payment.attemptId);else recoverSumUp();});return;}
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
   const result=controller.cash(draft.id,draft.cents);
   cashDraft=null;selected=null;$('amount').value="";
   playConfirmedPayment();showPaymentSuccess(result);message("Espèces enregistrées : "+euros(draft.cents)+". Course archivée.");
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
