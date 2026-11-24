// Noyau de refonte indépendant. Aucun accès réseau, stockage, ou paiement réel.
// Les résultats de paiement doivent être fournis par un adaptateur de confiance.
function makeCore(){
 const empty=()=>({hotels:[],contacts:[],drivers:[],courses:[],ledger:[]});
 const states={load:"planned",start:"loaded",finish:"in_progress",beginPayment:"awaiting_payment",paymentConfirmed:"payment_pending",paymentFailed:"payment_pending"};
 const next={load:"loaded",start:"in_progress",finish:"awaiting_payment",beginPayment:"payment_pending",paymentConfirmed:"archived",paymentFailed:"awaiting_payment"};
 function transition(course,event){
  if(!course||!event||states[event.type]!==course.status)throw Error("Action incompatible avec le statut de la course");
  const c={...course,status:next[event.type]};
  if(event.type==="beginPayment"){
   if(!["cash","sumup","payment_express"].includes(event.method)||!Number.isSafeInteger(event.amountCents)||event.amountCents<0||!event.attemptId)throw Error("Paiement invalide");
   c.payment={method:event.method,amountCents:event.amountCents,attemptId:event.attemptId};
  }
  if(event.type==="paymentFailed"||event.type==="paymentConfirmed"){
   if(!course.payment||event.attemptId!==course.payment.attemptId)throw Error("Tentative de paiement inconnue");
   if(event.type==="paymentFailed"){
    if(!["cancelled","declined"].includes(event.result))throw Error("Statut incertain : ne pas relancer le paiement");
    c.payment=null;
   }else{
    if(event.result!=="confirmed"||!event.reference)throw Error("Confirmation de paiement manquante");
    c.payment={...course.payment,reference:event.reference};
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
 function addCourse(state,course){
  if(!course?.id||state.courses.some(c=>c.id===course.id))throw Error("Identifiant de course manquant ou en double");
  return {...state,courses:[...state.courses,{...course,status:"planned",payment:null}]};
 }
 return {empty,addCourse,apply};
}
if(typeof module==='object'&&module.exports)module.exports=makeCore();
else if(typeof window!=='undefined')window.TaxiCleanCore=makeCore();
