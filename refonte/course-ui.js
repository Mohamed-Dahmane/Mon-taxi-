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
let receiptCourse=null,receiptReturn='success',successCourse=null;const receiptVerified=new Map();
let hotelEdit=null,personDraft=null,contactRequest=null,deleteDraft=null;
function message(value="",error=false){$('status').textContent=value;$('status').dataset.error=String(error);}
function safe(action){try{message();action();}catch(e){message(e.message||"Action impossible",true);}}
try{controller=window.createTaxiCourseController(storage);}catch(e){message(e.message,true);document.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);return;}
const current=()=>controller.snapshot().courses.find(c=>c.id===selected);
const route=c=>[c.from,c.to].filter(x=>typeof x==="string"&&x.trim()).join(" → ")||"Course libre";
function playConfirmedPayment(){try{window.TaxiPaymentSound?.play();}catch(_){/* A sound cannot reverse a recorded receipt. */}}
function showPaymentSuccess(c){
  successCourse=c.id;$('success-receipt').hidden=false;
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
let signatureStrokes=[],activeStroke=null,signaturePng="";
function drawSignature(canvas,strokes,png=""){
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#000000";ctx.lineWidth=2;ctx.lineCap="round";ctx.lineJoin="round";
 if(png){const img=new Image();canvas.dataset.signatureImage=png;img.onload=()=>{if(canvas.dataset.signatureImage!==png)return;const scale=Math.min(canvas.width/img.width,canvas.height/img.height);ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);};img.src="data:image/png;base64,"+png;return;}delete canvas.dataset.signatureImage;
 for(const stroke of strokes){if(stroke.length<2)continue;ctx.beginPath();stroke.forEach(([x,y],i)=>{const px=x*canvas.width/1000,py=y*canvas.height/1000;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});ctx.stroke();}
}
const pad=$("signature-pad");
function point(e){const r=pad.getBoundingClientRect();return [Math.max(0,Math.min(1000,Math.round((e.clientX-r.left)*1000/r.width))),Math.max(0,Math.min(1000,Math.round((e.clientY-r.top)*1000/r.height)))];}
pad.addEventListener("pointerdown",e=>{if(activeStroke||signatureStrokes.length>=40||signatureStrokes.flat().length>=2498)return;e.preventDefault();if(signaturePng){signaturePng="";signatureStrokes=[];drawSignature(pad,[]);}pad.setPointerCapture(e.pointerId);activeStroke=[point(e)];signatureStrokes.push(activeStroke);});
pad.addEventListener("pointermove",e=>{if(!activeStroke||!pad.hasPointerCapture(e.pointerId)||signatureStrokes.flat().length>=2499)return;activeStroke.push(point(e));drawSignature(pad,signatureStrokes);});
function endStroke(){if(activeStroke&&activeStroke.length<2)signatureStrokes.pop();activeStroke=null;drawSignature(pad,signatureStrokes);}
pad.addEventListener("pointerup",endStroke);pad.addEventListener("pointercancel",endStroke);pad.addEventListener("lostpointercapture",endStroke);
function loadReceiptProfile(){const p=controller.snapshot().receiptProfile;$("receipt-driver").value=p?.driverNumber||"";$("signature-enabled").checked=!!p?.enabled;signatureStrokes=p?.strokes||[];signaturePng=p?.signaturePng||"";activeStroke=null;drawSignature(pad,signatureStrokes,signaturePng);}
function cashReceipt(id){
 const c=controller.snapshot().courses.find(x=>x.id===id),p=c?.payment;if(c?.status!=="archived"||p?.method!=="cash")throw Error("Aucun paiement espèces confirmé.");
 const ident=c.receiptIdentity;return {remark:$("receipt-remark").value.trim(),reference:p.reference,paidAt:p.paidAt,amountCents:p.amountCents,route:[c.from,c.to].filter(Boolean).join(" → "),vehicle:c.vehicle==="van"?"Van":"",driverNumber:ident?.driverNumber||"",strokes:ident?.enabled?ident.strokes:[],signaturePng:ident?.enabled?ident.signaturePng||"":"",refundCents:c.refund?.amountCents||0};
}
function cardReceipt(id){
 const c=controller.snapshot().courses.find(x=>x.id===id),p=c?.payment;
 if(c?.status!=="archived"||p?.method!=="sumup"||!p.reference||!Number.isSafeInteger(p.amountCents)||p.amountCents<=0)throw Error("Aucun paiement carte confirmé.");
 const v=receiptVerified.get(p.reference),verified=v?.reference===p.reference&&v.amountCents===p.amountCents&&v.currency==="EUR"&&Number.isFinite(Date.parse(v.timestamp));
 return {remark:"",reference:p.reference,paidAt:verified?v.timestamp:p.paidAt,amountCents:p.amountCents,from:c.from||"",to:c.to||"",vehicle:c.vehicle==="van"?"Van":"",verified:!!verified,business:verified?v.business||"":"",vat:verified?v.vat||"":"",number:verified?v.number||"":"",refundCents:c.refund?.amountCents||0};
}
function receiptData(id){
 const c=controller.snapshot().courses.find(x=>x.id===id),p=c?.payment;
 if(c?.status!=="archived"||!p?.reference||!Number.isSafeInteger(p.amountCents))throw Error("Aucun paiement confirmé.");
 if(p.method==="cash"){const r=cashReceipt(id);return "TAXIMO TRANSPORT\nReçu espèces / Cash receipt\n"+euros(r.amountCents)+" — Payé / Paid\n"+new Date(r.paidAt).toLocaleString("fr-BE",{timeZone:"Europe/Brussels"})+"\nTransport taxi / Taxi service"+(r.route?"\n"+r.route:"")+(r.vehicle?"\n"+r.vehicle:"")+"\nRéférence / Reference : "+r.reference+(r.driverNumber?"\nN° chauffeur / Driver ID : "+r.driverNumber:"")+(r.refundCents?"\nRemboursement / Refund : "+euros(r.refundCents):"");}
 if(p.method!=="sumup")throw Error("Paiement inconnu.");
 const v=receiptVerified.get(p.reference);
 const details=v&&v.amountCents===p.amountCents?"\nDonnées vérifiées via l’API SumUp"+(v.business?"\nCommerçant : "+v.business:"")+(v.vat?"\nTVA : "+v.vat:"")+(v.number?"\nN° de reçu : "+v.number:""):"\nJustificatif local, données officielles non consultées.";
 return "Mon Taxi Pro — Justificatif de paiement\nMontant initial payé : "+euros(p.amountCents)+"\nDate : "+new Date(v?.timestamp||p.paidAt).toLocaleString("fr-BE",{timeZone:"Europe/Brussels"})+"\nRéférence SumUp : "+p.reference+details+(c.refund?"\nRemboursement enregistré : "+euros(c.refund.amountCents):"")+"\nDocument Mon Taxi Pro, distinct du reçu émis par SumUp.";
}
let previewSequence=0,previewReady=false,previewConfirmed=false;
function clearReceiptPreview(){
 $("receipt-share-options").hidden=true;
 previewSequence++;previewReady=false;previewConfirmed=false;$("receipt-share-pdf").hidden=true;
 $("receipt-pdf-preview").hidden=true;$("receipt-pdf-preview").removeAttribute("src");
 $("receipt-confirm-preview").disabled=true;$("receipt-confirm-preview").hidden=false;
 $("receipt-delivery-note").hidden=true;
}
function requestReceiptPreview(){
 clearReceiptPreview();
 const c=controller.snapshot().courses.find(x=>x.id===receiptCourse),cash=c?.payment?.method==="cash";
 const r=cash?cashReceipt(receiptCourse):cardReceipt(receiptCourse);
 $("receipt-confirm-preview").textContent=cash?"Confirmer le reçu":"Envoyer reçu";
 $("receipt-confirm-preview").disabled=cash;
 $("receipt-summary").hidden=false;
 $("receipt-status").textContent="Préparation du PDF…";
 if(typeof window.TaxiReceipt?.previewPdf!=="function"){$("receipt-status").textContent="Aperçu PDF disponible dans l’application Android.";return;}
 window.TaxiReceipt.previewPdf(String(previewSequence),JSON.stringify(r),!cash);
}
window.addEventListener("taxi-receipt-preview",e=>safe(()=>{
 const d=e.detail;
 if($("receipt").hidden||d?.token!==String(previewSequence))return;
 if(d.error){$("receipt-status").textContent=d.error;return;}
 if(typeof d.png!=="string"||!d.png.length||d.png.length>8000000||!/^[A-Za-z0-9+/=]+$/.test(d.png))throw Error("Aperçu PDF invalide.");
 const img=$("receipt-pdf-preview"),token=previewSequence;
 img.onload=()=>{if(token!==previewSequence||$("receipt").hidden)return;previewReady=true;img.hidden=false;$("receipt-summary").hidden=true;$("receipt-confirm-preview").disabled=false;if(previewConfirmed)$("receipt-share-pdf").hidden=typeof window.TaxiReceipt?.sharePdf!=="function";
 $("receipt-status").textContent=controller.snapshot().courses.find(x=>x.id===receiptCourse)?.payment?.method==="cash"?"Vérifie le reçu avant de le confirmer.":"";};
 img.onerror=()=>{if(token!==previewSequence)return;previewReady=false;$("receipt-confirm-preview").disabled=controller.snapshot().courses.find(x=>x.id===receiptCourse)?.payment?.method==="cash";$("receipt-status").textContent="Impossible d’afficher le PDF. Réessaie.";};
 img.src="data:image/png;base64,"+d.png;
}));
document.addEventListener("input",event=>{
 if(event.target.id==="receipt-remark") clearReceiptPreview();
});
document.addEventListener("change",event=>{
 if(event.target.id==="receipt-remark") requestReceiptPreview();
});
function openReceipt(id,back){
 $("receipt-remark").value="";
 const body=receiptData(id);receiptCourse=id;receiptReturn=back;$("receipt-summary").textContent=body;
 const cash=controller.snapshot().courses.find(x=>x.id===id).payment.method==="cash";
 $("receipt-remark").hidden=!cash;document.querySelector('label[for="receipt-remark"]').hidden=!cash;
 $("receipt-verify").hidden=cash;$("receipt-configure").hidden=cash||typeof window.TaxiReceipt?.configure!=="function";$("receipt-share-options").hidden=true;$("receipt-share-other").hidden=true;
 $("receipt-signature").hidden=true;
 $("receipt-privacy").hidden=false;
 const r=cash?cashReceipt(id):null;
 $("receipt-identity-note").hidden=!cash||!!(r.driverNumber&&(r.signaturePng||r.strokes?.length));
 show("receipt");requestReceiptPreview();
}
window.addEventListener("taxi-receipt-profile",e=>safe(()=>{if($("accounts").hidden)return;if(e.detail?.error)throw Error(e.detail.error);const doc=JSON.parse(e.detail.content);if(doc.format!=="taximo-receipt-profile-v1")throw Error("Fichier de profil invalide.");controller.setReceiptProfile(doc.profile);loadReceiptProfile();message("Profil chauffeur privé importé. Signature automatique activée.");}));
window.addEventListener("taxi-receipt-result",e=>safe(()=>{
 const d=e.detail,c=controller.snapshot().courses.find(x=>x.id===receiptCourse),p=c?.payment;
 if(!p||p.method!=="sumup"||d?.reference!==p.reference)return;
 if(d.verified?.reference===p.reference&&d.verified.amountCents===p.amountCents&&d.verified.currency==="EUR"&&Number.isFinite(Date.parse(d.verified.timestamp)))receiptVerified.set(p.reference,d.verified);
 if(!$("receipt").hidden){$("receipt-summary").textContent=receiptData(receiptCourse);if(d.error)$("receipt-status").textContent=d.error;else requestReceiptPreview();}
}));
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
const moneyCurrency=document.createElement("div");moneyCurrency.className="money-pad-currency";moneyCurrency.textContent="EUR · €";moneyPad.append(moneyCurrency);
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
 if(key==="clear")return "";
 const valid=/^\d{1,9}[,.]\d{2}$/.test(value)||value===""||value==="0";
 if(key==="back"){
  // A malformed intermediate edit must remain correctable, without silently interpreting it as cents.
  if(!valid)return value.slice(0,-1);
  const digits=value.replace(/\D/g,"").replace(/^0+(?=\d)/,"");
  return moneyFormat(digits.slice(0,-1));
 }
 if(!valid)throw Error("Montant invalide : corrige-le avant de continuer.");
 const digits=value.replace(/\D/g,"").replace(/^0+(?=\d)/,"");
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
   if(kind!=="hotels"){const p=document.createElement("p");p.textContent=[item.phone,...(item.otherPhones||[])].join(" / ")+(kind==="contacts"?" · "+(s.hotels.find(h=>h.id===item.hotelId)?.name||""):"");box.append(p);}
   if(kind==="contacts"){const h=s.hotels.find(h=>h.id===item.hotelId);if(h?.defaultContactId===item.id){const p=document.createElement("p");p.textContent="Contact par défaut";box.append(p);}else box.append(localButton("Définir par défaut","default",kind,item.id));}
   if(kind!=="hotels"&&window.TaxiCleanCore.directoryMatches(s,kind,item).length){
    box.append(localButton("Vérifier les doublons","edit",kind,item.id));
   }
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
function editPerson(kind,item){$('person-form').querySelector('[data-review]')?.remove();personDraft={kind,...item};$('person-title').textContent=kind==="drivers"?"Chauffeur dans Mon Taxi Pro":"Contact de l'hôtel dans Mon Taxi Pro";$('person-name').value=item.name;$('person-phone').value=item.phone;$('person-form').hidden=false;$('person-form').scrollIntoView({block:"nearest"});}
function clearDelete(){deleteDraft=null;$('directory-delete').hidden=true;}
$('directory-sort').addEventListener("change",()=>safe(renderDirectory));
$('contact-hotel').addEventListener("change",()=>safe(renderDirectory));
$('hotel-form').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 const old=controller.snapshot().hotels.find(h=>h.id===hotelEdit);
 controller.saveDirectory("hotels",{id:old?.id||newId(),name:$('hotel-name').value,defaultContactId:old?.defaultContactId});
 resetHotel();renderDirectory();message("Hôtel enregistré.");
});});
$('person-form').addEventListener("input",()=>$('person-form').querySelector('[data-review]')?.remove());
$('person-form').addEventListener("submit",e=>{e.preventDefault();safe(()=>{
 if(!personDraft)throw Error("Aucun contact sélectionné.");
 const draft={...personDraft,name:$('person-name').value,phone:$('person-phone').value};
 if(draft.name!==personDraft.name||draft.phone!==personDraft.phone)delete draft.separateFrom;
 const state=controller.snapshot(),matches=window.TaxiCleanCore.directoryMatches(state,draft.kind,draft);
 if(matches.length){
  const form=$('person-form');
  form.querySelector('[data-review]')?.remove();
  const panel=document.createElement("div");panel.dataset.review="true";
  const finish=decision=>safe(()=>{
   controller.saveDirectory(draft.kind,draft,decision);
   panel.remove();clearPerson();renderDirectory();message("Répertoire enregistré.");
  });
  const option=(label,action)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=action;panel.append(b);};
  const heading=document.createElement("p");heading.textContent="Comparer avec "+draft.name+" · "+draft.phone;panel.append(heading);
  for(const other of matches){
   const line=document.createElement("p");
   line.textContent=[other.name,other.phone,...(other.otherPhones||[]),state.hotels.find(h=>h.id===other.hotelId)?.name].filter(Boolean).join(" · ");panel.append(line);
   if(draft.kind==="drivers"||draft.hotelId===other.hotelId)option("Fusionner avec "+other.name,()=>finish(other.id));
  }
  option("Garder les fiches séparées",()=>finish("keep"));
  form.append(panel);panel.scrollIntoView({block:"nearest"});return;
 }
 controller.saveDirectory(draft.kind,draft);
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
   if(selected===c.id){selected=null;sumupDraft=null;$('amount').value="";showPaymentSuccess(result);openReceipt(result.id,"success");}
   else{renderLists();renderCashTotals();}
   message("Paiement SumUp confirmé : "+euros(result.payment.amountCents)+". Course archivée.");
  }else if(result.status==="awaiting_payment"){
   ackSumUp(d.attemptId);
   if(selected===c.id){$('amount').value=String(c.payment.amountCents/100).replace(".",",");show("payment");}
   message("Paiement non effectué. La course reste à payer.");
  }else{
   if(selected===c.id&& !$('sumup').hidden)show("sumup");
   if(d.status==="uncertain"||d.stage==="checkout"){const warning="Statut incertain : ne pas relancer ni encaisser en espèces pour cette course avant vérification.";message(warning,true);if(selected===c.id){$('sumup-diagnostic').textContent=warning;$('sumup-diagnostic').hidden=false;}}
  }
 }catch(error){message(error.message||"Résultat SumUp à vérifier. Ne pas relancer.",true);}
});
window.addEventListener("taxi-sumup-diagnostic",e=>{
 const d=e.detail,c=current();if(!c||c.id!==d?.courseId||c.payment?.attemptId!==d.attemptId)return;
 $('sumup-diagnostic').textContent=String(d.message||"");$('sumup-diagnostic').hidden=false;
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
const refundMessages=new Map();
window.addEventListener("taxi-refund-result",e=>safe(()=>{
 const d=e.detail,c=controller.snapshot().courses.find(x=>x.id===d?.courseId);
 if(!c?.refundPending||c.payment?.reference!==d.reference||c.payment?.attemptId!==d.attemptId)return;
 if(d.status==="confirmed"){controller.confirmRefund(c.id,d);refundMessages.set(c.id,"Remboursement confirmé par SumUp.");renderCashTotals();}
 else refundMessages.set(c.id,String(d.message||"Remboursement en attente : ne pas recommencer hors de Mon Taxi."));
 renderLists();
}));
function requestBankRefund(c,amount,mode){
 if(typeof window.TaxiRefund?.request!=="function")throw Error("Remboursement bancaire disponible uniquement sur Android.");
 const updated=controller.prepareRefund(c.id,amount);
 window.TaxiRefund.request(updated.id,updated.payment.reference,updated.payment.attemptId,updated.payment.amountCents,amount,mode);
 refundMessages.set(c.id,"Vérification SumUp en cours…");renderLists();
}
function card(c,archived=false){
 const box=document.createElement("article");box.className="card";
 const h=document.createElement("h3");h.textContent=c.client||(c.kind==="free"?"Course libre":"Course sans nom");
 const p=document.createElement("p");p.textContent=route(c);
 const detail=document.createElement("p");detail.className="muted";detail.textContent=[c.kind==="reservation"?"Réservation":c.kind==="free"?"Course libre":"Course directe",c.direction==="pickup"?"Pick-up":"Dépose",c.date,c.time,labels[c.status]].filter(Boolean).join(" · ");
 const menu=document.createElement("details"),more=document.createElement("summary");
 more.textContent="⋮";more.setAttribute("aria-label","Actions pour "+h.textContent);
 const remove=document.createElement("button");remove.type="button";remove.textContent="Supprimer cette course";
 remove.addEventListener("click",()=>safe(()=>{
  const impact=archived?" et son encaissement dans les comptes locaux":" du planning";
  if(!confirm("Supprimer la course « "+h.textContent+" »"+impact+" ?"))return;
  controller.removeCourse(c.id);
  if(selected===c.id)selected=null;
  renderLists();message("Course supprimée.");
 }));
 menu.append(more,remove);
 box.append(h,menu,p,detail);
 if(c.startedAt||c.finishedAt){const times=document.createElement("p");times.className="muted";const format=t=>t?new Date(t).toLocaleString("fr-BE",{timeZone:"Europe/Brussels",dateStyle:"short",timeStyle:"short"}):"—";times.textContent="Début : "+format(c.startedAt)+" · Fin : "+format(c.finishedAt);box.append(times);}
 if(c.hotelName||c.driverName){const a=document.createElement("p");a.textContent=[c.hotelName,c.driverName,c.commissionCents?euros(c.commissionCents):""].filter(Boolean).join(" · ");box.append(a);}
 if(archived&&c.payment){
  if(["cash","sumup"].includes(c.payment.method)){const receipt=document.createElement("button");receipt.type="button";receipt.textContent="Justificatif de paiement";receipt.dataset.receiptCourse=c.id;box.append(receipt);}
  const pay=document.createElement("p");pay.textContent=(c.payment.method==="cash"?"Espèces":"Carte")+" · "+euros(c.payment.amountCents);if(c.payment.paidAt)pay.textContent+=" · Encaissée le "+new Date(c.payment.paidAt).toLocaleString("fr-BE",{timeZone:"Europe/Brussels",dateStyle:"short",timeStyle:"short"});
  box.append(pay);
  if(c.refund){
   const note=document.createElement("p");note.className="refund-notice";note.textContent=(c.refund.amountCents===c.payment.amountCents?"Remboursée":"Remboursée partiellement")+" · "+euros(c.refund.amountCents)+" · "+c.refund.day;box.append(note);
  }else if(c.payment.method==="sumup"&&typeof window.TaxiRefund?.request==="function"){
   const note=document.createElement("p");note.setAttribute("role","status");note.textContent=refundMessages.get(c.id)||(c.refundPending?"Remboursement en attente de vérification officielle.":"Remboursement bancaire SumUp · les frais initiaux restent comptabilisés.");
   box.append(note);
   if(c.refundPending){
    const verify=document.createElement("button");verify.type="button";verify.textContent="Vérifier le remboursement · "+euros(c.refundPending.amountCents);box.append(verify);
    verify.addEventListener("click",()=>safe(()=>requestBankRefund(c,c.refundPending.amountCents,"status")));
    const retry=document.createElement("button");retry.type="button";retry.textContent="Reprendre la demande après vérification";box.append(retry);
    retry.addEventListener("click",()=>safe(()=>{if(confirm("Vérifier et poursuivre uniquement si aucune demande bancaire n’a été envoyée ?"))requestBankRefund(c,c.refundPending.amountCents,"start");}));
   }else{
    const b=document.createElement("button");b.type="button";b.textContent="Remboursement";box.append(b);
    const panel=document.createElement("div");panel.className="card";panel.hidden=true;
    const label=document.createElement("label");label.className="field";label.textContent="Montant à rembourser (€)";
    const amount=document.createElement("input");amount.type="text";amount.inputMode="none";amount.setAttribute("data-money","");amount.value=(c.payment.amountCents/100).toFixed(2).replace(".",",");label.append(amount);
    const yes=document.createElement("button");yes.type="button";yes.textContent="Confirmer le remboursement bancaire";
    const no=document.createElement("button");no.type="button";no.textContent="Annuler";
    panel.append(label,yes,no);box.append(panel);b.addEventListener("click",()=>{b.hidden=true;panel.hidden=false;});
    no.addEventListener("click",()=>{panel.hidden=true;b.hidden=false;});
    yes.addEventListener("click",()=>safe(()=>{const cents=entryCents(amount.value);if(cents<1||cents>c.payment.amountCents)throw Error("Montant invalide.");if(confirm("Rembourser "+euros(cents)+" via SumUp ?"))requestBankRefund(c,cents,"start");}));
   }
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
for(const id of ["planning-reverse","archives-reverse"]){
 const button=$(id);
 button.addEventListener("click",()=>{
  button.setAttribute("aria-pressed",String(button.getAttribute("aria-pressed")!=="true"));
  renderLists();
 });
}
function renderLists(){
 const all=controller.snapshot().courses;
 // Les horaires du planning sont enregistrés en heure locale au format ISO.
 const planningTime=c=>c.scheduledAt || (c.date ? c.date+"T"+(c.time || "99:99") : "");
 const active=all.filter(c=>c.status==="planned").sort((a,b)=>{
  const first=planningTime(a),second=planningTime(b);
  if(!first || !second)return Number(!first)-Number(!second);
  return first.localeCompare(second);
 });
 const executionTime=c=>{
  for(const value of [c.startedAt,c.finishedAt,c.scheduledAt,c.date && c.date+"T"+(c.time||"00:00"),c.payment?.paidAt]){
   const timestamp=Date.parse(value);
   if(Number.isFinite(timestamp))return timestamp;
  }
  return -Infinity;
 };
 const archived=all.filter(c=>c.status==="archived").reverse().sort((a,b)=>executionTime(b)-executionTime(a));
 if($("planning-reverse").getAttribute("aria-pressed")==="true")active.reverse();
 if($("archives-reverse").getAttribute("aria-pressed")==="true")archived.reverse();
 $('course-list').replaceChildren(...active.map(c=>card(c)));
 $('archive-list').replaceChildren(...archived.map(c=>card(c,true)));
 $('planning-empty').hidden=active.length>0;$('archives-empty').hidden=archived.length>0;
}
// Keep the focused field reachable when Samsung's on-screen keyboard resizes the viewport.
let keyboardFocusFrame=0;
function keepFocusedFieldVisible(){
 if(document.visibilityState==='hidden')return;
 const el=document.activeElement;
 if(!el||!el.matches?.('input,textarea,select,[contenteditable="true"]')||el.disabled||el.readOnly)return;
 if(el.closest('[hidden], [inert]')||el.getClientRects().length===0)return;
 cancelAnimationFrame(keyboardFocusFrame);
 keyboardFocusFrame=requestAnimationFrame(()=>{
  if(document.activeElement!==el||el.closest('[hidden], [inert]')||el.getClientRects().length===0)return;
  const viewport=window.visualViewport;
  const top=viewport?viewport.offsetTop:0;
  const height=viewport?viewport.height:window.innerHeight;
  if(!Number.isFinite(height)||height<=0)return;
  const bounds=el.getBoundingClientRect();
  if(!Number.isFinite(bounds.top)||!Number.isFinite(bounds.bottom))return;
  const safeTop=top+16,safeBottom=Math.max(safeTop+1,top+height-24);
  if(bounds.bottom>safeBottom||bounds.top<safeTop){
   el.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
  }
 });
}
document.addEventListener('focusin',e=>{
 if(e.target.matches?.('input,textarea,select,[contenteditable="true"]'))keepFocusedFieldVisible();
});
window.visualViewport?.addEventListener('resize',keepFocusedFieldVisible);
window.visualViewport?.addEventListener('scroll',keepFocusedFieldVisible);
// Avoid stale animation callbacks after the keyboard closes or the focused input is removed.
document.addEventListener('focusout',()=>{
 cancelAnimationFrame(keyboardFocusFrame);
 keyboardFocusFrame=0;
});

// Close the navigation drawer whenever a destination is shown, including programmatic transitions.
function closeNavigationMenu(){
 const menu=document.querySelector('.nav-menu');
 if(menu?.open)menu.open=false;
}
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const menu=document.querySelector('.nav-menu');
 if(menu?.open){
  event.preventDefault();
  event.stopPropagation();
  closeNavigationMenu();
 }
},true);
function show(id){
 if(!screens.some(e=>e.id===id))throw Error("Écran inconnu");
 if(id==="reservation"){
  const now=new Date();
  if(!$("reservation-date").value)$("reservation-date").value=localDate(now);
  if(!$("reservation-time").value)$("reservation-time").value=localTime(now);
 }
 // Conserver le sens du tri lors des allers-retours entre écrans.
 if(id!=="receipt")clearReceiptPreview();
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
    $('sumup-online').hidden=!pending;$('sumup-reference').hidden=!pending;
    $('sumup-reference').textContent=pending?"Référence de tentative : "+c.payment.attemptId:"";
    $('sumup-diagnostic').hidden=true;$('sumup-diagnostic').textContent="";
    $('sumup-message').textContent=pending?"Paiement en attente de confirmation. Ne pas recommencer.":"Confirme l’envoi du montant au terminal SumUp.";
   }
  }
 }
 closeMoneyPad();
 if(id!=="cash")cashDraft=null;
 if(id!=="sumup")sumupDraft=null;
 if(id==="planning"||id==="archives")renderLists();
 if(id==="directory")renderDirectory();
 if(id==="reservation"||id==="direct")refreshCourseDirectory();
 if(id==="home")renderCashTotals();
 if(id==="accounts"){loadAccountFields();loadReceiptProfile();}else clearRestore();
 closeNavigationMenu();
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
  const course={id:newId(),kind,direction:fields.direction,client:String(fields.client||"").trim(),phone:String(fields.phone||"").trim(),from,to,date,time,scheduledAt:date+"T"+time,hotelId:hotel?.id||null,hotelName:hotel?.name||"",contactId:contact?.id||null,contactName:contact?.name||"",driverId:driver?.id||null,driverName:driver?.name||"Moi",driverPhone:driver?.phone||"",driverIsMe:!driver,commissionCents:entryCents(fields.commission||"")};
  if(fields.pastSettlement){
   const cash=fields.pastSettlement==="cash";
   controller.recordPast(course,cash?entryCents(fields.pastAmount):null,fields.pastPaidDay||date);
   form.reset();show(cash?"archives":"planning");message(cash?"Course passée archivée.":"Course effectuée, en attente de règlement.");return;
  }
  controller.plan(course);
  form.reset();show("home");message("Course enregistrée dans le planning.");
 });
});
document.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b||b.disabled)return;
 if(b.dataset.course){safe(()=>{selected=b.dataset.course;const c=current();if(!c)throw Error("Course inconnue");$('amount').value=c.paymentDraftCents?(c.paymentDraftCents/100).toFixed(2).replace(".",","):"";show(c.status==="awaiting_payment"?"payment":c.status==="payment_pending"?"sumup":"ride");if(c.status==="payment_pending")recoverSumUp();});return;}
 if(b.id==="receipt-profile-import"){safe(()=>{if(typeof window.TaxiReceipt?.importProfile!=="function")throw Error("Import disponible sur Android.");window.TaxiReceipt.importProfile();});return;}
 if(b.id==="receipt-profile-save"){safe(()=>{controller.setReceiptProfile({driverNumber:$("receipt-driver").value.trim(),enabled:$("signature-enabled").checked,strokes:signatureStrokes.filter(s=>s.length>=2),...(signaturePng?{signaturePng}:{})});loadReceiptProfile();message("Préférences de reçu enregistrées.");});return;}
 if(b.id==="signature-clear"){signaturePng="";signatureStrokes=[];activeStroke=null;$("signature-enabled").checked=false;drawSignature(pad,[]);return;}
 if(b.id==="receipt-open"){safe(()=>openReceipt(successCourse,"success"));return;}
 if(b.dataset.receiptCourse){safe(()=>openReceipt(b.dataset.receiptCourse,"archives"));return;}
 if(b.id==="receipt-back"){safe(()=>show(receiptReturn));return;}
 if(b.id==="receipt-preview-retry"){safe(()=>requestReceiptPreview());return;}
 if(b.id==="receipt-confirm-preview"){safe(()=>{const card=controller.snapshot().courses.find(x=>x.id===receiptCourse)?.payment?.method==="sumup";if($("receipt").hidden||(!previewReady&&!card))throw Error("Aperçu non disponible.");if(card)$("receipt-share-options").hidden=typeof window.TaxiReceipt?.share!=="function";previewConfirmed=true;$("receipt-confirm-preview").hidden=true;$("receipt-delivery-note").hidden=false;$("receipt-share-pdf").hidden=!previewReady||typeof window.TaxiReceipt?.sharePdf!=="function";$("receipt-status").textContent="Reçu confirmé. Aucun envoi effectué.";});return;}
 if(b.id==="receipt-share-pdf"){safe(()=>{if(!previewConfirmed||!previewReady||$("receipt").hidden||typeof window.TaxiReceipt?.sharePdf!=="function")throw Error("Confirme d’abord le reçu.");const cash=controller.snapshot().courses.find(x=>x.id===receiptCourse)?.payment?.method==="cash";window.TaxiReceipt.sharePdf(String(previewSequence),JSON.stringify(cash?cashReceipt(receiptCourse):cardReceipt(receiptCourse)),!cash);});return;}
 if(b.id==="receipt-verify"){safe(()=>{receiptData(receiptCourse);const p=controller.snapshot().courses.find(x=>x.id===receiptCourse).payment;if($("receipt").hidden||typeof window.TaxiReceipt?.retrieve!=="function")throw Error("Consultation disponible sur Android.");window.TaxiReceipt.retrieve(p.reference,p.amountCents);});return;}
 if(b.id==="receipt-configure"){safe(()=>{receiptData(receiptCourse);const p=controller.snapshot().courses.find(x=>x.id===receiptCourse).payment;if($("receipt").hidden||typeof window.TaxiReceipt?.configure!=="function")throw Error("Configuration disponible sur Android.");window.TaxiReceipt.configure(p.reference,p.amountCents);});return;}
 if(b.dataset.receiptChannel){safe(()=>{
  if($("receipt").hidden||$("receipt-share-options").hidden||!previewConfirmed)return;
  cardReceipt(receiptCourse);
  window.TaxiReceipt.share(b.dataset.receiptChannel,receiptData(receiptCourse));
 });return;}
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
 if(b.id==="clear-ride-history"){safe(()=>{
  if($('accounts').hidden)return;
  const state=controller.snapshot();
  if(!confirm("Effacer "+state.courses.length+" course(s), le planning, l’historique, les encaissements et les recettes journalières de Mon Taxi Pro ? Les dépenses, le carburant, le répertoire, la signature et les réglages seront conservés."))return;
  controller.clearRideHistory();clearRestore();selected=null;renderLists();loadAccountFields();message("Courses et encaissements effacés.");
 });return;}
 if(b.id==="backup-export"){safe(()=>{
  if($('accounts').hidden||typeof window.TaxiBackup?.exportJson!=="function")throw Error("Sauvegarde disponible sur Android.");
  window.TaxiBackup.exportJson(controller.backup());
 });return;}
 if(b.id==="backup-import"){safe(()=>{
  if($('accounts').hidden||typeof window.TaxiBackup?.pickJson!=="function")throw Error("Restauration disponible sur Android.");
  if(controller.snapshot().courses.some(c=>c.status==="payment_pending"||c.refundPending))throw Error("Paiement en attente : restauration interdite.");
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
  const blocking=controller.snapshot().courses.find(x=>x.status==="payment_pending");
  if(blocking)throw Error("Une tentative SumUp doit être vérifiée avant une nouvelle. Course concernée : "+(blocking.client||route(blocking))+" · "+euros(blocking.payment.amountCents)+". Ouvre cette course dans le planning. Aucun nouvel envoi au terminal.");
  if(typeof window.TaxiSumUp?.checkoutWithLocalReceipt!=="function")throw Error("Retour direct non disponible sur cette version.");
  const attempt=newId();
  controller.beginSumUp(c.id,draft.cents,attempt);
  show("sumup");window.TaxiSumUp.checkoutWithLocalReceipt(c.id,attempt,draft.cents);
 });return;}
 if(b.id==="sumup-online"){safe(()=>{const c=current();if(c?.status!=="payment_pending"||$('sumup').hidden)throw Error("Aucune tentative à vérifier.");if(typeof window.TaxiSumUp?.verifyOnline!=="function")throw Error("Vérification officielle disponible uniquement sur Android.");window.TaxiSumUp.verifyOnline(c.id,c.payment.attemptId);});return;}
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
 const id=b.dataset.page||b.dataset.go;
 if(id==="reservation"){
  const past=b.id==="past-ride";
  $("past-fields").disabled=!past;$("past-fields").hidden=!past;
  $("reservation").querySelector("h2").textContent=past?"Encoder une course passée":"Réservation";
  $("past-cash").hidden=$("past-fields").querySelector("select").value!=="cash";
 }
 if(id)safe(()=>{document.querySelector(".nav-menu")?.removeAttribute("open");show(id);});
});
function words(value){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function suggest(input,choices,accept){
 const menu=document.createElement("div");
 menu.className="actions";
 input.after(menu);
 input.autocomplete="off";
 function close(){menu.replaceChildren();}
 function display(){
  close();
  const tokens=words(input.value);
  if(!tokens.length)return;
  for(const choice of choices().filter(item=>tokens.every(t=>words(item.label).some(w=>w.startsWith(t)))).slice(0,12)){
   const button=document.createElement("button");
   button.type="button";button.textContent=choice.label;
   button.addEventListener("mousedown",e=>e.preventDefault());
   button.addEventListener("click",()=>{accept(choice);close();});
   menu.append(button);
  }
 }
 input.addEventListener("input",display);
 input.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
 input.parentElement.addEventListener("focusout",e=>{if(!input.parentElement.contains(e.relatedTarget))close();});
 input.form?.addEventListener("reset",close);
}
for(const select of document.querySelectorAll("select[name=hotelId],select[name=contactId],select[name=driverId],#contact-hotel")){
 const search=document.createElement("input");
 search.type="search";search.placeholder="Rechercher : "+select.labels[0].textContent;
 search.setAttribute("aria-label",search.placeholder);
 select.before(search);
 suggest(search,()=>Array.from(select.options,o=>({label:o.text,value:o.value})),choice=>{
  select.value=choice.value;search.value="";
  select.dispatchEvent(new Event("change",{bubbles:true}));
 });
}
for(const form of document.querySelectorAll("form[data-kind]")){
 const {hotelId,direction,from,to}=form.elements;
 let automatic=null;
 function defaultHotel(){
  if(automatic&&automatic.field.value===automatic.value)automatic.field.value="";
  automatic=null;
  if(!hotelId.value)return;
  const field=direction.value==="pickup"?to:from;
  if(field.value)return;
  field.value=hotelId.selectedOptions[0].text;
  automatic={field,value:field.value};
 }
 hotelId.addEventListener("change",defaultHotel);
 direction.addEventListener("change",defaultHotel);
 for(const field of [from,to])field.addEventListener("input",()=>{if(automatic?.field===field)automatic=null;});
 form.addEventListener("reset",()=>{automatic=null;});
}
for(const field of document.querySelectorAll("input[name=from],input[name=to],input[name=client],input[name=label]")){
 field.addEventListener("focus",()=>field.select());
 suggest(field,()=>{
  const state=controller.snapshot(),places=["from","to"].includes(field.name);
  const values=places?[...state.hotels.map(h=>h.name),...state.courses.flatMap(c=>[c.from,c.to])]:state.courses.map(c=>c.client);
  return Array.from(new Set(values.filter(Boolean)),label=>({label}));
 },choice=>{field.value=choice.label;field.dispatchEvent(new Event("change",{bubbles:true}));});
}
$("past-fields").querySelector("select").addEventListener("change",e=>{$("past-cash").hidden=e.target.value!=="cash";});
const reservationTime=$("reservation-time");
reservationTime.type="text";reservationTime.inputMode="numeric";reservationTime.maxLength=5;
reservationTime.placeholder="8:35";reservationTime.addEventListener("focus",()=>reservationTime.select());
function normalizeTime(){
 const match=reservationTime.value.trim().match(/^(\d{1,2}):?(\d{2})$/);
 const valid=match&&Number(match[1])<24&&Number(match[2])<60;
 reservationTime.setCustomValidity(reservationTime.value&&!valid?"Entre une heure valide, par exemple 835 ou 1430.":"");
 if(valid)reservationTime.value=match[1].padStart(2,"0")+":"+match[2];
}
reservationTime.addEventListener("input",()=>reservationTime.setCustomValidity(""));
reservationTime.addEventListener("blur",normalizeTime);
reservationTime.form.addEventListener("submit",normalizeTime,true);

renderLists();
renderCashTotals();
resumeWaze();
recoverSumUp();
})();

