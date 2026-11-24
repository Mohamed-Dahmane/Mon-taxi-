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
let controller,selected=null;
function message(value="",error=false){$('status').textContent=value;$('status').dataset.error=String(error);}
function safe(action){try{message();action();}catch(e){message(e.message||"Action impossible",true);}}
try{controller=window.createTaxiCourseController(storage);}catch(e){message(e.message,true);document.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);return;}
const current=()=>controller.snapshot().courses.find(c=>c.id===selected);
const route=c=>c.from+" → "+c.to;
const labels={planned:"Client à charger",loaded:"Client chargé",in_progress:"Course en cours",awaiting_payment:"En attente de paiement",payment_pending:"Paiement en attente",archived:"Course archivée"};
const actions={planned:"Charger",loaded:"Démarrer la course",in_progress:"Terminer la course"};
function card(c,archived=false){
 const box=document.createElement("article");box.className="card";
 const h=document.createElement("h3");h.textContent=c.client||"Course sans nom";
 const p=document.createElement("p");p.textContent=route(c);
 const detail=document.createElement("p");detail.className="muted";detail.textContent=[c.kind==="reservation"?"Réservation":"Course directe",c.direction==="pickup"?"Pick-up":"Dépose",c.date,c.time,labels[c.status]].filter(Boolean).join(" · ");
 box.append(h,p,detail);
 if(!archived){const b=document.createElement("button");b.type="button";b.className="primary";b.dataset.course=c.id;b.textContent=c.status==="awaiting_payment"?"Ouvrir le paiement":"Ouvrir la course";box.append(b);}
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
  if(id!=="ride"&&c.status!=="awaiting_payment")throw Error("La course doit être terminée avant le paiement");
  if(id==="ride"){
   $('ride-step').textContent=labels[c.status];$('ride-route').textContent=route(c);
   $('ride-next').textContent=actions[c.status]||"Accéder au paiement";$('ride-next').disabled=c.status==="payment_pending";
   document.querySelectorAll('[data-step]').forEach(e=>{if(e.dataset.step===c.status)e.setAttribute("aria-current","step");else e.removeAttribute("aria-current");});
  }else $('payment-route').textContent=route(c);
 }
 if(id==="planning"||id==="archives")renderLists();
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
 if(b.dataset.course){safe(()=>{selected=b.dataset.course;$('amount').value="";const c=current();if(!c)throw Error("Course inconnue");show(c.status==="awaiting_payment"?"payment":"ride");});return;}
 if(b.id==="ride-next"){safe(()=>{
  const c=current();if(!c)throw Error("Course inconnue");
  if(c.status==="planned"){controller.load(c.id);show("ride");}
  else if(c.status==="loaded"){controller.start(c.id);show("ride");}
  else if(c.status==="in_progress"){controller.finish(c.id);show("payment");}
  else if(c.status==="awaiting_payment")show("payment");
  else throw Error("Action incompatible avec le statut de la course.");
 });return;}
 const id=b.dataset.page||b.dataset.go;if(id)safe(()=>show(id));
});
renderLists();
})();
