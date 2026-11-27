// Noyau de refonte indépendant. Aucun accès réseau, stockage, ou paiement réel.
// Les résultats de paiement doivent être fournis par un adaptateur de confiance.
function makeCore(){
 const empty=()=>({hotels:[],contacts:[],drivers:[],courses:[],ledger:[],entries:{},fixed:{}});
 const states={load:"planned",start:"loaded",finish:"in_progress",beginPayment:"awaiting_payment",paymentConfirmed:"payment_pending",paymentFailed:"payment_pending"};
 const next={load:"loaded",start:"in_progress",finish:"awaiting_payment",beginPayment:"payment_pending",paymentConfirmed:"archived",paymentFailed:"awaiting_payment"};
 function transition(course,event){
  if(!course||!event||states[event.type]!==course.status)throw Error("Action incompatible avec le statut de la course");
  const c={...course,status:next[event.type]};
  if(event.type==="start")c.startedAt=new Date().toISOString();
  if(event.type==="finish")c.finishedAt=new Date().toISOString();
  if(event.type==="beginPayment"){
   if(event.method!=="sumup"||!Number.isSafeInteger(event.amountCents)||event.amountCents<=0||!event.attemptId)throw Error("Paiement invalide");
   c.paymentDraftCents=event.amountCents;
   c.payment={method:event.method,amountCents:event.amountCents,attemptId:event.attemptId};
  }
  if(event.type==="paymentFailed"||event.type==="paymentConfirmed"){
   if(!course.payment||event.attemptId!==course.payment.attemptId)throw Error("Tentative de paiement inconnue");
   if(event.type==="paymentFailed"){
    if(!["cancelled","declined"].includes(event.result))throw Error("Statut incertain : ne pas relancer le paiement");
    c.paymentDraftCents=course.payment.amountCents;
    c.lastPaymentAttempt={attemptId:event.attemptId,status:event.result};
    if(event.verifiedBy==="sumup_transactions_api"){c.lastPaymentAttempt.reference=event.reference;c.lastPaymentAttempt.verifiedBy=event.verifiedBy;}
    c.payment=null;
   }else{
    if(event.result!=="confirmed"||!event.reference)throw Error("Confirmation de paiement manquante");
    c.payment={...course.payment,reference:event.reference,paidAt:event.paidAt||new Date().toISOString()};
   }
  }
  return c;
 }
 function apply(state,id,event){
  const index=state.courses.findIndex(c=>c.id===id);
  if(index<0)throw Error("Course inconnue");
  if(event.type==="beginPayment"){
   if(state.courses.some(c=>c.status==="payment_pending"))throw Error("Un paiement terminal est déjà en attente");
   if(typeof event.attemptId!=="string"||!event.attemptId.trim()||state.ledger.some(p=>p.attemptId===event.attemptId)||state.courses.some(c=>c.lastPaymentAttempt?.attemptId===event.attemptId))throw Error("Identifiant de tentative déjà utilisé ou invalide");
  }
  const course=transition(state.courses[index],event);
  const courses=state.courses.slice();courses[index]=course;
  let ledger=state.ledger;
  if(course.status==="archived"){
   if(ledger.some(x=>x.courseId===id||x.attemptId===course.payment.attemptId||x.method===course.payment.method&&x.reference===course.payment.reference))throw Error("Paiement déjà enregistré");
   ledger=[...ledger,{courseId:id,...course.payment}];
  }
  return {...state,courses,ledger};
 }
 // Le cash suit une action locale unique, sans adaptateur carte ni état de paiement externe.
 function validateReceiptProfile(p){
  if(!p||typeof p!=="object"||typeof p.driverNumber!=="string"||p.driverNumber.length>40||typeof p.enabled!=="boolean"||!Array.isArray(p.strokes)||p.strokes.length>40)throw Error("Profil reçu invalide");
  let n=0;for(const stroke of p.strokes){if(!Array.isArray(stroke)||stroke.length<2)throw Error("Signature invalide");for(const pt of stroke){if(!Array.isArray(pt)||pt.length!==2||!pt.every(v=>Number.isInteger(v)&&v>=0&&v<=1000)||++n>2500)throw Error("Signature invalide");}}
  const png=p.signaturePng;
  if(png!==undefined&&(typeof png!=="string"||png.length>20000||!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(png)))throw Error("Image de signature invalide");
  if(p.enabled&&n<2&&!png)throw Error("Signature manquante");
  return {driverNumber:p.driverNumber.trim(),enabled:p.enabled,strokes:p.strokes.map(s=>s.map(pt=>pt.slice())),...(png?{signaturePng:png}:{})};
 }
 function setReceiptProfile(s,p){return {...s,receiptProfile:validateReceiptProfile(p)};}
 function recordCash(state,id,amountCents){
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw Error("Montant espèces invalide");
  const index=state.courses.findIndex(c=>c.id===id);
  if(index<0||state.courses[index].status!=="awaiting_payment")throw Error("Course non disponible pour le paiement en espèces");
  const reference="cash:"+id;
  if(state.ledger.some(x=>x.courseId===id||x.attemptId===reference))throw Error("Paiement déjà enregistré");
  const payment={method:"cash",amountCents,attemptId:reference,reference,paidAt:new Date().toISOString()};
  const courses=state.courses.slice();
  const profile=state.receiptProfile;
  const receiptIdentity=profile?validateReceiptProfile(profile):null;
  courses[index]={...courses[index],status:"archived",payment,...(receiptIdentity?{receiptIdentity}: {})};
  return {...state,courses,ledger:[...state.ledger,{courseId:id,...payment}]};
 }
 function savePaymentDraft(state,id,cents){
  if(!Number.isSafeInteger(cents)||cents<100||cents>9999900)throw Error("Montant terminal invalide");
  const index=state.courses.findIndex(c=>c.id===id);
  if(index<0||state.courses[index].status!=="awaiting_payment")throw Error("Course non disponible pour la saisie du montant");
  const courses=state.courses.slice();courses[index]={...courses[index],paymentDraftCents:cents};
  return {...state,courses};
 }
 function addCourse(state,course){
  if(!course?.id||state.courses.some(c=>c.id===course.id))throw Error("Identifiant de course manquant ou en double");
  return {...state,courses:[...state.courses,{...course,status:"planned",payment:null}]};
 }
 const fields=["cash","appli","commission","fuel","expense","invoiceHt"];
 const validAmount=n=>Number.isSafeInteger(n)&&n>=0&&n<=99999999999;
 const validDay=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
 const validMonth=m=>typeof m==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 const dayOf=t=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(t)).filter(p=>["year","month","day"].includes(p.type)).reduce((a,p)=>(a[p.type]=p.value,a),{});
 const paymentDay=t=>{const d=dayOf(t);return d.year+"-"+d.month+"-"+d.day};
 const blank=()=>Object.fromEntries(fields.map(k=>[k,0]));
 function setDay(s,day,entry){
  if(!validDay(day)||!entry||!fields.every(k=>validAmount(entry[k])))throw Error("Montants journaliers invalides");
  return {...s,entries:{...(s.entries||{}),[day]:Object.fromEntries(fields.map(k=>[k,entry[k]]))}};
 }
 function setFixed(s,month,cents){
  if(!validMonth(month)||!validAmount(cents))throw Error("Frais fixes invalides");
  return {...s,fixed:{...(s.fixed||{}),[month]:cents}};
 }
 // Contre-écriture locale, uniquement après remboursement réellement effectué.
 function recordRefund(s,id,day,amountCents,proof){
  const c=s.courses.find(x=>x.id===id),p=s.ledger.find(x=>x.courseId===id);
  if(!c||c.status!=="archived"||!p||!["cash","sumup"].includes(p.method)||c.refund)throw Error("Course non remboursable ou déjà remboursée");
  if(!validDay(day)||day<paymentDay(p.paidAt)||day>paymentDay(new Date().toISOString()))throw Error("Date de remboursement invalide");
  if(!validAmount(amountCents)||amountCents<=0||amountCents>p.amountCents)throw Error("Montant de remboursement invalide");
  if(c.refundPending&&(!proof||proof.eventId==null||proof.reference!==p.reference||c.refundPending.amountCents!==amountCents))throw Error("Remboursement bancaire en attente de confirmation");
  const refund={amountCents,day,recordedAt:new Date().toISOString()};
  if(proof){refund.eventId=String(proof.eventId);refund.verifiedBy="sumup";}
  return {...s,courses:s.courses.map(x=>{if(x.id!==id)return x;const next={...x,refund};delete next.refundPending;return next;})};
 }
 function prepareRefund(s,id,amountCents){
  const c=s.courses.find(x=>x.id===id),p=s.ledger.find(x=>x.courseId===id);
  if(!c||c.status!=="archived"||p?.method!=="sumup"||c.refund||!Number.isSafeInteger(amountCents)||amountCents<1||amountCents>p.amountCents)throw Error("Remboursement non disponible");
  if(c.refundPending){if(c.refundPending.amountCents!==amountCents)throw Error("Montant déjà réservé");return s;}
  return {...s,courses:s.courses.map(x=>x.id===id?{...x,refundPending:{amountCents}}:x)};
 }
 function confirmRefund(s,id,result){
  const c=s.courses.find(x=>x.id===id),p=s.ledger.find(x=>x.courseId===id);
  if(!c||!p||p.method!=="sumup"||!result||result.reference!==p.reference||result.attemptId!==p.attemptId||result.status!=="confirmed"||typeof result.eventId!=="string"||!result.eventId||!Number.isFinite(Date.parse(result.timestamp)))throw Error("Confirmation SumUp non concordante");
  if(c.refund){if(c.refund.eventId===result.eventId&&c.refund.amountCents===result.amountCents)return s;throw Error("Remboursement déjà enregistré");}
  if(!c.refundPending||c.refundPending.amountCents!==result.amountCents)throw Error("Montant du remboursement non concordant");
  return recordRefund(s,id,paymentDay(result.timestamp),result.amountCents,result);
 }
 function dayTotals(s,day){
  if(!validDay(day))throw Error("Jour invalide");
  const e={...blank(),...(s.entries?.[day]||{})};
  let cardGross=0,fee=0,cash=e.cash,hotelCommission=0;
  const byId=new Map(s.courses.map(c=>[c.id,c]));
  for(const p of s.ledger){
   const c=byId.get(p.courseId);
   if(c?.refund?.day===day){if(p.method==="cash")cash-=c.refund.amountCents;else cardGross-=c.refund.amountCents;}
   // Une course effectuée lundi et encaissée mardi reste comptabilisée lundi.
   // Sans date d’exécution fiable, conserver la date du paiement.
   const executionTime=c?.finishedAt||c?.startedAt||(c?.date&&validDay(c.date)?c.date+"T"+(c.time&&/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)?c.time:"12:00")+":00":null);
   const accountingDay=executionTime&&Number.isFinite(Date.parse(executionTime))?paymentDay(executionTime):paymentDay(p.paidAt);
   if(accountingDay!==day)continue;
   if(p.method==="cash")cash+=p.amountCents;
   else if(p.method==="sumup"){cardGross+=p.amountCents;fee+=Math.round(p.amountCents*2/100);}
   if(c?.driverIsMe===true&&validAmount(c.commissionCents))hotelCommission+=c.commissionCents;
  }
  const commission=e.commission+hotelCommission,cashReal=cash-commission,cardNet=cardGross-fee;
  const invoiceTtc=e.invoiceHt+Math.round(e.invoiceHt*6/100);
  // Facturation TTC comptée seulement si non comprise dans les autres encaissements.
  const revenue=cardNet+cashReal+e.appli+invoiceTtc;
  const [y,m,d]=day.split("-").map(Number);
  const days=new Date(Date.UTC(y,m,0)).getUTCDate(),monthlyFixed=s.fixed?.[day.slice(0,7)]||0;
  const fixed=Math.floor(monthlyFixed/days)+(d<=monthlyFixed%days?1:0);
  return {cash,commission,hotelCommission,cashReal,cardGross,fee,cardNet,appli:e.appli,invoiceHt:e.invoiceHt,invoiceTtc,revenue,fuel:e.fuel,expense:e.expense,fixed,costs:e.fuel+e.expense+fixed,result:revenue-e.fuel-e.expense-fixed,worked:revenue>0};
 }
 function monthTotals(s,month){
  if(!validMonth(month))throw Error("Mois invalide");
  const [y,m]=month.split("-").map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate(),total={workedDays:0};
  for(let d=1;d<=days;d++){
   const row=dayTotals(s,month+"-"+String(d).padStart(2,"0"));
   for(const [k,v] of Object.entries(row))if(k!=="worked")total[k]=(total[k]||0)+v;
   if(row.worked)total.workedDays++;
  }
  total.average=total.workedDays?Math.round(total.revenue/total.workedDays):0;
  return total;
 }
 const cleanName=n=>typeof n==="string"?n.trim():"";
 const nameKey=n=>cleanName(n).normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase("fr-BE").replace(/[\p{P}\p{Z}\s]+/gu," ").trim();
 const phoneKey=n=>{let p=String(n||"").trim().replace(/[\s().-]/g,"");if(p.startsWith("00"))p="+"+p.slice(2);if(/^0[1-9]\d{6,9}$/.test(p))p="+32"+p.slice(1);return p;};
 const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
 function validateDirectory(s){
  const ids=new Set(),hotelNames=new Set();
  for(const k of ["hotels","contacts","drivers"])for(const item of s[k]){
   if(!item||!validId(item.id)||ids.has(item.id)||!cleanName(item.name)||item.name.length>160)throw Error("Répertoire invalide ou doublon");
   ids.add(item.id);
   if(k==="hotels"){
    const key=nameKey(item.name);if(hotelNames.has(key))throw Error("Hôtel déjà présent");hotelNames.add(key);
    if(item.defaultContactId&&!s.contacts.some(c=>c.id===item.defaultContactId&&c.hotelId===item.id))throw Error("Contact par défaut invalide");
   }else{
    if(typeof item.phone!=="string"||!/^\+?[0-9]{3,20}$/.test(item.phone))throw Error("Téléphone invalide");
    if(item.separateFrom!==undefined&&(!Array.isArray(item.separateFrom)||item.separateFrom.some(key=>typeof key!=="string")))throw Error("Décision de répertoire invalide");
    if(item.otherPhones!==undefined&&(!Array.isArray(item.otherPhones)||item.otherPhones.some(n=>typeof n!=="string"||!/^\+?[0-9]{3,20}$/.test(n))))throw Error("Téléphone secondaire invalide");
    if(k==="contacts"&&!s.hotels.some(h=>h.id===item.hotelId))throw Error("Hôtel du contact manquant");
   }
  }
 }
 function personMatches(a,b){
  const numbers=p=>[p.phone,...(p.otherPhones||[])].filter(Boolean).map(phoneKey);
  if(numbers(a).some(n=>numbers(b).includes(n)))return true;
  if(a.nativeId&&a.nativeId===b.nativeId)return true;
  const x=nameKey(a.name).replace(/ /g,""),y=nameKey(b.name).replace(/ /g,"");
  if(!x||!y)return false;
  if(x===y)return true;
  if(Math.min(x.length,y.length)<4||Math.abs(x.length-y.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<x.length&&j<y.length){
   if(x[i]===y[j]){i++;j++;continue;}
   if(++edits>1)return false;
   if(x.length>=y.length)i++;
   if(y.length>=x.length)j++;
  }
  return edits+x.length-i+y.length-j<=1;
 }
 const personIdentity=p=>JSON.stringify([p.id,nameKey(p.name),phoneKey(p.phone),p.otherPhones||[],p.nativeId||"",p.hotelId||""]);
 function directoryMatches(s,kind,item){
  if(!["drivers","contacts"].includes(kind))return [];
  return s[kind].filter(p=>p.id!==item.id&&personMatches(p,item)&&!(item.separateFrom||[]).includes(personIdentity(p))&&!(p.separateFrom||[]).includes(personIdentity(item)));
 }
 function saveDirectory(s,kind,item,decision){
  if(!["hotels","contacts","drivers"].includes(kind)||!item||!validId(item.id))throw Error("Élément inconnu");
  const list=s[kind],existing=list.find(p=>p.id===item.id);
  const name=cleanName(item.name);
  const next=kind==="hotels"?{id:item.id,name,defaultContactId:item.defaultContactId||null}:
   {id:item.id,name,phone:phoneKey(item.phone),nativeId:String(item.nativeId||"").slice(0,120),...(kind==="contacts"?{hotelId:item.hotelId}:{})};
  if(existing?.otherPhones)next.otherPhones=existing.otherPhones.filter(n=>n!==next.phone);
  if(existing?.separateFrom&&personIdentity(existing)===personIdentity(next))next.separateFrom=existing.separateFrom;
  const matches=directoryMatches(s,kind,next);
  if(matches.length&&!decision)throw Error("Doublon possible : vérifier les fiches.");
  if(decision==="keep")next.separateFrom=[...new Set([...(next.separateFrom||[]),...matches.map(personIdentity)])];
  let result={...s};
  let updated=list;
  if(decision&&decision!=="keep"){
   const other=matches.find(p=>p.id===decision);
   if(!other||kind==="contacts"&&other.hotelId!==next.hotelId)throw Error("Fusion incompatible avec les liens hôtel.");
   const retained=existing?next.id:other.id;
   next.otherPhones=[...new Set([...(next.otherPhones||[]),other.phone,...(other.otherPhones||[])])].filter(n=>n!==next.phone);
   next.id=retained;
   if(!next.nativeId)next.nativeId=other.nativeId||"";
   if(retained!==other.id){
    updated=list.filter(p=>p.id!==other.id);
    if(kind==="contacts")result.hotels=s.hotels.map(h=>h.defaultContactId===other.id?{...h,defaultContactId:retained}:h);
    const key=kind==="contacts"?"contactId":"driverId";
    result.courses=s.courses.map(c=>c[key]===other.id?{...c,[key]:retained}:c);
   }
  }
  result[kind]=updated.some(p=>p.id===next.id)?updated.map(p=>p.id===next.id?next:p):[...updated,next];
  validateDirectory(result);return result;
 }
 function removeDirectory(s,kind,id){
  if(!["hotels","contacts","drivers"].includes(kind)||!s[kind].some(x=>x.id===id))throw Error("Élément inconnu");
  let next={...s,[kind]:s[kind].filter(x=>x.id!==id)};
  if(kind==="hotels")next={...next,contacts:next.contacts.filter(c=>c.hotelId!==id)};
  if(kind==="contacts")next={...next,hotels:next.hotels.map(h=>h.defaultContactId===id?{...h,defaultContactId:null}:h)};
  validateDirectory(next);return next;
 }
 function moveDirectory(s,kind,id,delta){
  if(!["hotels","contacts","drivers"].includes(kind)||![1,-1].includes(delta))throw Error("Déplacement invalide");
  const list=s[kind].slice(),i=list.findIndex(x=>x.id===id);if(i<0)throw Error("Élément inconnu");
  const j=i+delta;if(j<0||j>=list.length)return s;
  [list[i],list[j]]=[list[j],list[i]];return {...s,[kind]:list};
 }
 function validateState(s){
  if(!s||typeof s!=="object"||!["hotels","contacts","drivers","courses","ledger"].every(k=>Array.isArray(s[k])))throw Error("Sauvegarde invalide");
  validateDirectory(s);
  if(s.receiptProfile!==undefined)validateReceiptProfile(s.receiptProfile);
  const ids=new Set(),ledgerIds=new Set(),attempts=new Set(),references=new Set(),statuses=new Set(["planned","loaded","in_progress","awaiting_payment","payment_pending","archived"]);
  for(const c of s.courses){
   if(!c||typeof c.id!=="string"||!c.id||ids.has(c.id)||!statuses.has(c.status))throw Error("Course invalide ou doublon");
   ids.add(c.id);
   if(c.receiptIdentity!==undefined){if(c.status!=="archived"||c.payment?.method!=="cash")throw Error("Identité de reçu incompatible");validateReceiptProfile(c.receiptIdentity);}
   if(c.commissionCents!==undefined&&!validAmount(c.commissionCents))throw Error("Commission invalide");
   if(c.paymentDraftCents!==undefined&&(!validAmount(c.paymentDraftCents)||c.paymentDraftCents===0))throw Error("Montant à payer invalide");
   if(c.status==="payment_pending"&&(!c.payment||c.payment.method!=="sumup"||!validAmount(c.payment.amountCents)||c.payment.amountCents<=0||typeof c.payment.attemptId!=="string"||!c.payment.attemptId))throw Error("Tentative en attente invalide");
  }
  for(const p of s.ledger){
   if(!p||!ids.has(p.courseId)||ledgerIds.has(p.courseId)||!["cash","sumup"].includes(p.method)||!validAmount(p.amountCents)||p.amountCents<=0||typeof p.attemptId!=="string"||!p.attemptId||attempts.has(p.attemptId)||typeof p.reference!=="string"||!p.reference||references.has(p.method+":"+p.reference)||typeof p.paidAt!=="string"||!Number.isFinite(Date.parse(p.paidAt)))throw Error("Encaissement invalide ou doublon");
   const c=s.courses.find(c=>c.id===p.courseId);
   if(c.status!=="archived"||!c.payment||!["method","amountCents","attemptId","reference","paidAt"].every(k=>c.payment[k]===p[k]))throw Error("Course et encaissement incohérents");
   ledgerIds.add(p.courseId);attempts.add(p.attemptId);references.add(p.method+":"+p.reference);
  }
  for(const c of s.courses){
   if(c.status==="archived"&&!ledgerIds.has(c.id))throw Error("Archive sans encaissement");
   if(c.refundPending!==undefined){
    const p=s.ledger.find(x=>x.courseId===c.id);
    if(c.status!=="archived"||p?.method!=="sumup"||c.refund||!validAmount(c.refundPending?.amountCents)||c.refundPending.amountCents<1||c.refundPending.amountCents>p.amountCents)throw Error("Remboursement en attente invalide");
   }
   if(c.refund!==undefined){
    const p=s.ledger.find(x=>x.courseId===c.id),r=c.refund;
    if(!r||c.status!=="archived"||!p||!["cash","sumup"].includes(p.method)||!validAmount(r.amountCents)||r.amountCents<=0||r.amountCents>p.amountCents||!validDay(r.day)||r.day<paymentDay(p.paidAt)||typeof r.recordedAt!=="string"||!Number.isFinite(Date.parse(r.recordedAt))||r.day>paymentDay(r.recordedAt))throw Error("Remboursement incohérent");
   }
  }
  if(s.courses.filter(c=>c.status==="payment_pending").length>1)throw Error("Plusieurs paiements en attente");
  for(const key of ["entries","fixed"])if(s[key]!==undefined&&(!s[key]||typeof s[key]!=="object"||Array.isArray(s[key])))throw Error("Comptabilité invalide");
  for(const [day,e] of Object.entries(s.entries||{}))if(!validDay(day)||!e||!fields.every(k=>validAmount(e[k])))throw Error("Journal invalide");
  for(const [month,cents] of Object.entries(s.fixed||{}))if(!validMonth(month)||!validAmount(cents))throw Error("Frais fixes invalides");
  return {...s,entries:s.entries||{},fixed:s.fixed||{}};
 }
 function backup(s){
  validateState(s);if(s.courses.some(c=>c.status==="payment_pending"||c.refundPending))throw Error("Attendre la résolution du paiement avant sauvegarde.");
  return JSON.stringify({format:"mon-taxi-android-autonome",version:1,createdAt:new Date().toISOString(),state:s});
 }
 function readBackup(raw){
  const b=JSON.parse(raw);
  if(b?.format!=="mon-taxi-android-autonome"||b.version!==1)throw Error("Ce fichier ne provient pas de la nouvelle application.");
  const s=validateState(b.state);
  if(s.courses.some(c=>c.status==="payment_pending"||c.refundPending))throw Error("Sauvegarde contenant un paiement incertain : restauration interdite.");
  return s;
 }
 return {directoryMatches,empty,setReceiptProfile,addCourse,apply,savePaymentDraft,recordCash,recordRefund,prepareRefund,confirmRefund,fields,setDay,setFixed,dayTotals,monthTotals,validateState,backup,readBackup,paymentDay,saveDirectory,removeDirectory,moveDirectory};
}
if(typeof module==='object'&&module.exports)module.exports=makeCore();
else if(typeof window!=='undefined')window.TaxiCleanCore=makeCore();
