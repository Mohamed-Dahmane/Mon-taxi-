// Noyau de refonte indépendant. Aucun accès réseau, stockage, ou paiement réel.
// Les résultats de paiement doivent être fournis par un adaptateur de confiance.
function makeCore(){
 const empty=()=>({hotels:[],contacts:[],drivers:[],courses:[],ledger:[],entries:{},fixed:{}});
 const states={load:"planned",start:"loaded",finish:"in_progress",beginPayment:"awaiting_payment",paymentConfirmed:"payment_pending",paymentFailed:"payment_pending"};
 const next={load:"loaded",start:"in_progress",finish:"awaiting_payment",beginPayment:"payment_pending",paymentConfirmed:"archived",paymentFailed:"awaiting_payment"};
 function transition(course,event){
  if(!course||!event||states[event.type]!==course.status)throw Error("Action incompatible avec le statut de la course");
  const c={...course,status:next[event.type]};
  if(event.type==="beginPayment"){
   if(event.method!=="sumup"||!Number.isSafeInteger(event.amountCents)||event.amountCents<=0||!event.attemptId)throw Error("Paiement invalide");
   c.payment={method:event.method,amountCents:event.amountCents,attemptId:event.attemptId};
  }
  if(event.type==="paymentFailed"||event.type==="paymentConfirmed"){
   if(!course.payment||event.attemptId!==course.payment.attemptId)throw Error("Tentative de paiement inconnue");
   if(event.type==="paymentFailed"){
    if(!["cancelled","declined"].includes(event.result))throw Error("Statut incertain : ne pas relancer le paiement");
    c.lastPaymentAttempt={attemptId:event.attemptId,status:event.result};c.payment=null;
   }else{
    if(event.result!=="confirmed"||!event.reference)throw Error("Confirmation de paiement manquante");
    c.payment={...course.payment,reference:event.reference,paidAt:new Date().toISOString()};
   }
  }
  return c;
 }
 function apply(state,id,event){
  const index=state.courses.findIndex(c=>c.id===id);
  if(index<0)throw Error("Course inconnue");
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
 function recordCash(state,id,amountCents){
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw Error("Montant espèces invalide");
  const index=state.courses.findIndex(c=>c.id===id);
  if(index<0||state.courses[index].status!=="awaiting_payment")throw Error("Course non disponible pour le paiement en espèces");
  const reference="cash:"+id;
  if(state.ledger.some(x=>x.courseId===id||x.attemptId===reference))throw Error("Paiement déjà enregistré");
  const payment={method:"cash",amountCents,attemptId:reference,reference,paidAt:new Date().toISOString()};
  const courses=state.courses.slice();
  courses[index]={...courses[index],status:"archived",payment};
  return {...state,courses,ledger:[...state.ledger,{courseId:id,...payment}]};
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
 function dayTotals(s,day){
  if(!validDay(day))throw Error("Jour invalide");
  const e={...blank(),...(s.entries?.[day]||{})};
  let cardGross=0,fee=0,cash=e.cash,hotelCommission=0;
  const byId=new Map(s.courses.map(c=>[c.id,c]));
  for(const p of s.ledger){
   if(paymentDay(p.paidAt)!==day)continue;
   if(p.method==="cash")cash+=p.amountCents;
   else if(p.method==="sumup"){cardGross+=p.amountCents;fee+=Math.round(p.amountCents*169/10000);}
   const c=byId.get(p.courseId);
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
 function validateState(s){
  if(!s||typeof s!=="object"||!["hotels","contacts","drivers","courses","ledger"].every(k=>Array.isArray(s[k])))throw Error("Sauvegarde invalide");
  const ids=new Set(),ledgerIds=new Set(),attempts=new Set(),references=new Set(),statuses=new Set(["planned","loaded","in_progress","awaiting_payment","payment_pending","archived"]);
  for(const c of s.courses){
   if(!c||typeof c.id!=="string"||!c.id||ids.has(c.id)||!statuses.has(c.status))throw Error("Course invalide ou doublon");
   ids.add(c.id);
   if(c.commissionCents!==undefined&&!validAmount(c.commissionCents))throw Error("Commission invalide");
   if(c.status==="payment_pending"&&(!c.payment||c.payment.method!=="sumup"||!validAmount(c.payment.amountCents)||c.payment.amountCents<=0||typeof c.payment.attemptId!=="string"||!c.payment.attemptId))throw Error("Tentative en attente invalide");
  }
  for(const p of s.ledger){
   if(!p||!ids.has(p.courseId)||ledgerIds.has(p.courseId)||!["cash","sumup"].includes(p.method)||!validAmount(p.amountCents)||p.amountCents<=0||typeof p.attemptId!=="string"||!p.attemptId||attempts.has(p.attemptId)||typeof p.reference!=="string"||!p.reference||references.has(p.method+":"+p.reference)||typeof p.paidAt!=="string"||!Number.isFinite(Date.parse(p.paidAt)))throw Error("Encaissement invalide ou doublon");
   const c=s.courses.find(c=>c.id===p.courseId);
   if(c.status!=="archived"||!c.payment||!["method","amountCents","attemptId","reference","paidAt"].every(k=>c.payment[k]===p[k]))throw Error("Course et encaissement incohérents");
   ledgerIds.add(p.courseId);attempts.add(p.attemptId);references.add(p.method+":"+p.reference);
  }
  for(const c of s.courses)if(c.status==="archived"&&!ledgerIds.has(c.id))throw Error("Archive sans encaissement");
  if(s.courses.filter(c=>c.status==="payment_pending").length>1)throw Error("Plusieurs paiements en attente");
  for(const key of ["entries","fixed"])if(s[key]!==undefined&&(!s[key]||typeof s[key]!=="object"||Array.isArray(s[key])))throw Error("Comptabilité invalide");
  for(const [day,e] of Object.entries(s.entries||{}))if(!validDay(day)||!e||!fields.every(k=>validAmount(e[k])))throw Error("Journal invalide");
  for(const [month,cents] of Object.entries(s.fixed||{}))if(!validMonth(month)||!validAmount(cents))throw Error("Frais fixes invalides");
  return {...s,entries:s.entries||{},fixed:s.fixed||{}};
 }
 function backup(s){
  validateState(s);if(s.courses.some(c=>c.status==="payment_pending"))throw Error("Attendre la résolution du paiement avant sauvegarde.");
  return JSON.stringify({format:"mon-taxi-android-autonome",version:1,createdAt:new Date().toISOString(),state:s});
 }
 function readBackup(raw){
  const b=JSON.parse(raw);
  if(b?.format!=="mon-taxi-android-autonome"||b.version!==1)throw Error("Ce fichier ne provient pas de la nouvelle application.");
  const s=validateState(b.state);
  if(s.courses.some(c=>c.status==="payment_pending"))throw Error("Sauvegarde contenant un paiement incertain : restauration interdite.");
  return s;
 }
 return {empty,addCourse,apply,recordCash,fields,setDay,setFixed,dayTotals,monthTotals,validateState,backup,readBackup,paymentDay};
}
if(typeof module==='object'&&module.exports)module.exports=makeCore();
else if(typeof window!=='undefined')window.TaxiCleanCore=makeCore();
