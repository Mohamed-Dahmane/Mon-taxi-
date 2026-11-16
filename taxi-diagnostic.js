/* Diagnostic local Mon Taxi : aucune donnée métier, aucun envoi réseau. */
(function(){
"use strict";
const KEY="montaxi:diagnostic:v1",MAX=300;
const allowedPages=new Set(["home","details","fixedPage","planning","direct","plan","hotelArchives","hotelAll","commissions"]);
let enabled=false,records=[];
try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");enabled=saved.enabled===true;records=Array.isArray(saved.records)?saved.records.slice(-MAX):[]}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({enabled,records:records.slice(-MAX)}))}catch{}};
const page=()=>{const active=document.querySelector(".page.active");return allowedPages.has(active?.id)?active.id:"hotel-module"};
function log(type,detail){
 if(!enabled)return;
 records.push({at:new Date().toISOString(),type,page:page(),detail});
 if(records.length>MAX)records=records.slice(-MAX);
 save();update();
}
function update(){
 const status=document.getElementById("diagnosticStatus");
 if(status)status.textContent=enabled?"Activé · "+records.length+" événements locaux":"Désactivé";
 const toggle=document.getElementById("diagnosticToggle");
 if(toggle)toggle.textContent=enabled?"Désactiver le diagnostic":"Activer le diagnostic";
}
const dialog=document.getElementById("diagnosticDialog");
document.getElementById("openDiagnostic")?.addEventListener("click",()=>{update();dialog?.showModal()});
document.getElementById("diagnosticClose")?.addEventListener("click",()=>dialog?.close());
document.getElementById("diagnosticToggle")?.addEventListener("click",()=>{
 enabled=!enabled;save();update();
});
document.getElementById("diagnosticClear")?.addEventListener("click",()=>{
 records=[];save();update();
});
document.getElementById("diagnosticExport")?.addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="mon-taxi-diagnostic.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener("click",event=>{
 if(!enabled)return;
 const button=event.target.closest("button");
 if(!button||button.closest("#diagnosticDialog"))return;
 // Identifiants techniques uniquement : jamais de texte saisi, de client ou de montant.
 const id=button.id||"";
 const action=button.dataset?.quick||button.dataset?.page||"";
 if(/^[a-zA-Z0-9_-]{1,48}$/.test(id))log("button",{id});
 else if(/^[a-zA-Z0-9_-]{1,32}$/.test(action))log("navigation",{action});
},true);
window.addEventListener("error",event=>{
 const filename=String(event.filename||"").split("/").pop();
 log("script-error",{file:/^[\w.-]{1,70}$/.test(filename)?filename:"unknown",line:Number(event.lineno)||0});
});
window.addEventListener("unhandledrejection",()=>log("promise-error",{}));
window.addEventListener("online",()=>log("network-online",{}));
window.addEventListener("offline",()=>log("network-offline",{}));
update();
})();
