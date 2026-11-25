"use strict";
// Experimental standalone payment model. Not wired to native checkout or production storage.
function createPaymentLedger(initial, now=()=>new Date().toISOString()){
 const s=initial===undefined?{courses:{},free:{},receipts:[],attempts:[]}:JSON.parse(JSON.stringify(initial));
 const fail=m=>{throw Error(m)}, check=(x,m)=>{if(!x)fail(m)};
 const cents=(n,min=1)=>{check(Number.isSafeInteger(n)&&n>=min&&n<=9999900,"Montant invalide");return n};
 const id=x=>{check(typeof x==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(x)&&!["__proto__","constructor","prototype"].includes(x),"Identifiant invalide");return x};
 const copy=x=>JSON.parse(JSON.stringify(x));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const target=(kind,key)=>{check(["course","free"].includes(kind),"Type invalide");id(key);const map=kind==="course"?s.courses:s.free;check(own(map,key),"Cible inconnue");return map[key]};
 const items=(kind,key)=>s.receipts.filter(p=>p.kind===kind&&p.key===key);
 const paid=(kind,key)=>items(kind,key).reduce((a,p)=>a+p.cents,0);
 const balance=(kind,key)=>{const t=target(kind,key);return t.waived?0:t.price-paid(kind,key)};
 const pending=()=>s.attempts.find(a=>a.status==="pending");
 const noPendingFor=(kind,key)=>check(!s.attempts.some(a=>a.kind===kind&&a.key===key&&a.status==="pending"),"Tentative à vérifier");
 const available=(kind,key,n)=>{const t=target(kind,key);check(!t.waived&&(!("rideStatus" in t)||t.rideStatus==="finished"),"Course non terminée ou clôturée sans paiement");check(cents(n)<=balance(kind,key),"Montant supérieur au solde");};
 const record=(kind,key,n,method,ref)=>{available(kind,key,n);check(typeof ref==="string"&&ref.trim()&&ref.length<=200,"Référence obligatoire");check(!s.receipts.some(p=>p.method===method&&p.ref===ref),"Référence déjà enregistrée");const p={kind,key,cents:n,method,ref,paidAt:now()};s.receipts.push(p);return copy(p)};
 function finish(key,price){const t=target("course",key);check(t.rideStatus==="open","Course déjà terminée");cents(price,0);t.price=price;t.rideStatus="finished";}
 function openCourse(key){id(key);check(!own(s.courses,key),"Course existante");s.courses[key]={rideStatus:"open",price:null,waived:false,expected:null};}
 function openFree(key,price,label=""){id(key);cents(price);check(!own(s.free,key),"Encaissement existant");check(typeof label==="string"&&label.length<=200,"Libellé invalide");s.free[key]={price,label:label.trim(),waived:false,expected:null};}
 function defer(kind,key,method){const t=target(kind,key);check(["invoice","cash","sumup","link"].includes(method),"Mode inconnu");available(kind,key,1);t.expected=method;}
 function waive(key,note=""){const t=target("course",key);noPendingFor("course",key);check(t.rideStatus==="finished"&&!t.waived&&paid("course",key)===0,"Clôture sans paiement impossible");check(typeof note==="string"&&note.length<=500,"Remarque invalide");t.waived=true;t.note=note;t.expected=null;}
 // Raise the agreed total without rewriting receipts or charging the terminal.
 function increaseTotal(key,newTotal,reason=""){
  const t=target("course",key);noPendingFor("course",key);
  check(t.rideStatus==="finished"&&!t.waived&&paid("course",key)>0,"Course non encaissée ou annulée");
  cents(newTotal);check(newTotal>t.price,"Pour diminuer le montant, utiliser le remboursement");
  check(typeof reason==="string"&&reason.length<=500,"Motif invalide");
  const change={previousCents:t.price,newTotalCents:newTotal,reason:reason.trim(),changedAt:now()};
  t.adjustments=[...(t.adjustments||[]),change];t.price=newTotal;t.expected=null;
  return view("course",key);
 }
 function cash(kind,key,n,ref){noPendingFor(kind,key);return record(kind,key,n,"cash",ref)}
 function begin(kind,key,n,attempt){available(kind,key,n);id(attempt);check(n>=100,"Minimum terminal 1 euro");check(!pending(),"Une tentative terminal doit être résolue");check(!s.attempts.some(a=>a.attempt===attempt),"Tentative déjà utilisée");s.attempts.push({kind,key,cents:n,attempt,status:"pending",createdAt:now()});return copy(pending());}
 function terminal(result){check(result&&typeof result==="object","Retour invalide");const a=s.attempts.find(a=>a.attempt===result.attempt);check(a&&a.key===result.key&&a.kind===result.kind,"Tentative inconnue");if(a.status!=="pending"){check(a.status===result.status&&(a.status!=="confirmed"||(a.ref===result.ref&&a.cents===result.cents&&result.currency==="EUR")),"Retour contradictoire");return copy(a);}
 if(result.status==="uncertain")return copy(a);
 if(["declined","cancelled"].includes(result.status)){a.status=result.status;return copy(a);}
 check(result.status==="confirmed"&&result.currency==="EUR"&&result.cents===a.cents,"Confirmation ou montant invalide");record(a.kind,a.key,a.cents,"sumup",result.ref);a.ref=result.ref;a.status="confirmed";return copy(a);}
 function view(kind,key){const t=target(kind,key);return {...copy(t),paid:paid(kind,key),balance:t.price===null?null:balance(kind,key),paymentStatus:t.price===null?"unpriced":t.waived?"waived":balance(kind,key)===0?"settled":paid(kind,key)>0?"partial":"due"}}
 return {snapshot:()=>copy(s),openCourse,finish,openFree,defer,waive,increaseTotal,cash,begin,terminal,view,pending:()=>copy(pending()||null)};
}
module.exports=createPaymentLedger;
