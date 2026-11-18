(function(){
"use strict";
const KEY="montaxi:hotel-commissions:directory-v1";
const norm=s=>String(s||"").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const reserved=new Set(["night","day","papa","papas","fal","moncef","djo","jonas","yaguy","celine","adelia","diego","estella","sumira","aline","sophia"].map(norm));
function isProtectedHotel(d,name){return /^(?:double\s?tree|the standard)\b/.test(norm(d.tariffNames?.[name]||name))}
function reservedContacts(d){
  const names=new Set([...reserved,...(d.referralOnlyContacts||[]).map(norm),...(d.standardReceptionNames||[]).map(norm),...Object.values(d.doubleTreeContactNames||{}).map(norm)]);
  for(const [hotel,contact] of Object.entries(d.hotels)){
    if(!isProtectedHotel(d,hotel))continue;
    for(const name of [contact,...(d.allowedContacts?.[hotel]||[])])if(name)names.add(norm(name));
  }
  return names;
}
const dialog=document.createElement("dialog");dialog.id="taxiDirectoryEditor";dialog.innerHTML='<div class="directory-head"><h2 id="directoryTitle"></h2><button type="button" id="directoryClose">✕ Fermer</button></div><p id="directoryInfo"></p><div class="directory-sort"><label for="directorySort">Classement</label><select id="directorySort"><option value="priority">Pertinence</option><option value="az">Alphabétique A → Z</option><option value="za">Alphabétique Z → A</option></select></div><label id="directorySearchLabel">Rechercher un hôtel <input id="directorySearch" type="search" autocomplete="off"></label><div id="directoryRows"></div><div class="directory-add"><input id="directoryNew" placeholder="Nouveau nom" aria-label="Nouveau nom"><button type="button" id="directoryAdd">+ Ajouter</button></div><p class="directory-note">Les contacts d’attribution DoubleTree et The Standard restent séparés des chauffeurs.</p>';
document.body.append(dialog);
const style=document.createElement("style");style.textContent='#taxiDirectoryEditor{width:min(680px,96vw);max-height:90dvh;overflow:auto;background:#111c30;color:#f5f7ff;border:1px solid #4c6485;border-radius:16px;padding:17px}#taxiDirectoryEditor::backdrop{background:#000b}#taxiDirectoryEditor .directory-head{display:flex;align-items:center;justify-content:space-between;gap:10px}#taxiDirectoryEditor button{cursor:pointer;border:1px solid #4c6485;border-radius:8px;background:#203856;color:white;padding:9px;font:inherit}#taxiDirectoryEditor .directory-row{padding:10px 0;border-bottom:1px solid #34435e;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}#taxiDirectoryEditor .directory-actions{display:flex;flex-wrap:wrap;gap:4px}#taxiDirectoryEditor .directory-row small{display:block;color:#b5c6dc;margin-top:5px}#taxiDirectoryEditor .directory-add{display:flex;gap:8px;margin-top:15px}#taxiDirectoryEditor .directory-add input{flex:1;min-width:0}#taxiDirectoryEditor .directory-note{color:#b5c6dc;font-size:13px}#taxiDirectoryEditor select{width:100%;margin-top:5px}#taxiDirectoryEditor .directory-sort{display:flex;align-items:center;gap:10px;margin:12px 0}#taxiDirectoryEditor .directory-sort select{flex:1;width:auto}#taxiDirectoryEditor #directorySearchLabel{display:grid;gap:5px;margin-bottom:10px}#taxiDirectoryEditor #directorySearchLabel[hidden]{display:none}#taxiDirectoryEditor button:disabled{opacity:.35;cursor:default}';document.head.append(style);
const $=id=>document.getElementById(id);let mode="hotels";const sortMode={hotels:"priority",drivers:"priority"};const collator=new Intl.Collator("fr",{sensitivity:"base",numeric:true});
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));return d&&typeof d.hotels==="object"&&!Array.isArray(d.hotels)?d:null}catch{return null}}
window.taxiHotelDriverContactNames=()=>{
  const d=load();
  if(!d?.hotels)return new Set();
  const reservedNames=reservedContacts(d);
  const names=new Set();
  for(const [hotel,contact] of Object.entries(d.hotels)){
    if(isProtectedHotel(d,hotel))continue;
    for(const name of [contact,...(d.allowedContacts?.[hotel]||[])]){
      const key=norm(name).replace(/\s+/g," ");
      if(key&&!reservedNames.has(key))names.add(key);
    }
  }
  return names;
};
function save(d){localStorage.setItem(KEY,JSON.stringify(d));window.dispatchEvent(new Event("hotel-commissions-updated"));window.dispatchEvent(new Event("mon-taxi-hotel-sync"));const frame=$("hotelCommissionsFrame");try{frame?.contentWindow?.dispatchEvent(new Event("mon-taxi-hotel-sync"))}catch{}render()}
function drivers(d){
  const reservedNames=reservedContacts(d);
  const contacts=new Map((d.contacts||[]).filter(name=>name&&!reservedNames.has(norm(name))).map(name=>[norm(name),name]));
  const names=[];
  for(const name of d.driverOrder||[]){
    const key=norm(name);
    if(contacts.has(key)){names.push(contacts.get(key));contacts.delete(key)}
  }
  return [...names,...[...contacts.values()].sort(collator.compare)];
}
function hotelNames(d){return [...new Set([...(d.hotelSequence||[]),...Object.keys(d.hotels||{})])].filter(n=>Object.hasOwn(d.hotels,n))}
function orderedNames(d){const base=mode==="hotels"?hotelNames(d):drivers(d);if(sortMode[mode]==="az")return base.slice().sort(collator.compare);if(sortMode[mode]==="za")return base.slice().sort((a,b)=>collator.compare(b,a));return base}
function button(label,fn){const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b}
function rename(d,oldName,newName,isHotel){newName=newName.trim();if(!newName||norm(oldName)===norm(newName))return false;if(isHotel){if(hotelNames(d).some(n=>norm(n)===norm(newName)))return false;Object.defineProperty(d.hotels,newName,{value:d.hotels[oldName],writable:true,enumerable:true,configurable:true});delete d.hotels[oldName];for(const field of ["allowedContacts","tariffNames"]){if(d[field]&&Object.hasOwn(d[field],oldName)){Object.defineProperty(d[field],newName,{value:d[field][oldName],writable:true,enumerable:true,configurable:true});delete d[field][oldName]}}for(const field of ["hotelSequence","inactiveCommissionHotels","deletedHotels"]){if(Array.isArray(d[field]))d[field]=d[field].map(n=>n===oldName?newName:n)}}else{if(drivers(d).some(n=>norm(n)===norm(newName))||reservedContacts(d).has(norm(newName)))return false;for(const field of ["contacts","driverOrder","archivedDriverNames","contactGroupSequence"]){if(Array.isArray(d[field]))d[field]=d[field].map(n=>n===oldName?newName:n)}for(const [h,n] of Object.entries(d.hotels))if(n===oldName)d.hotels[h]=newName;for(const h of Object.keys(d.allowedContacts||{}))d.allowedContacts[h]=(d.allowedContacts[h]||[]).map(n=>n===oldName?newName:n)}return true}
function render(){const d=load();$("directoryRows").replaceChildren();$("directorySearchLabel").hidden=mode!=="hotels";$("directoryTitle").textContent=mode==="hotels"?"Liste des hôtels":"Liste des chauffeurs";$("directoryInfo").textContent="Maintiens un nom puis déplace-le pour régler la pertinence.";if(!d){$("directoryInfo").textContent="Chargement des listes…";return}$("directorySort").value=sortMode[mode];const base=orderedNames(d);
const query=mode==="hotels"?$("directorySearch").value.trim():"";
const names=query?base.map(name=>({name,rank:window.TaxiDriverDirectoryCore.nameSearchRank(name,query)})).filter(item=>item.rank>=0).sort((a,b)=>a.rank-b.rank).map(item=>item.name):base;
const people=drivers(d);
if(query&&!names.length)$("directoryRows").textContent="Aucun hôtel trouvé.";
names.forEach(name=>{const row=document.createElement("div");row.className="directory-row";const info=document.createElement("div");row.dataset.reorderKey=name;const strong=document.createElement("button");strong.type="button";strong.className="directory-name taxi-hold-handle";strong.textContent=name;strong.title="Maintenir puis déplacer pour changer l’ordre de pertinence";info.append(strong);if(mode==="hotels"){if(isProtectedHotel(d,name)){const sm=document.createElement("small");sm.textContent=d.hotels[name]?"Contact par défaut · "+d.hotels[name]:"Contacts d’attribution";info.append(sm);info.append(button("Gérer les contacts",()=>{dialog.close();window.openHotelModule("module",name)}))}else{const sel=document.createElement("select");sel.setAttribute("aria-label","Chauffeur par défaut pour "+name);const blank=document.createElement("option");blank.value="";blank.textContent="Aucun chauffeur par défaut";sel.append(blank);for(const p of people){const o=document.createElement("option");o.value=p;o.textContent=p;sel.append(o)}sel.value=people.includes(d.hotels[name])?d.hotels[name]:"";sel.onchange=()=>{
  const current=load();
  if(!current||!Object.hasOwn(current.hotels,name))return;
  current.hotels[name]=sel.value;
  if(sel.value){
    current.allowedContacts??={};
    current.allowedContacts[name]=[...new Set([sel.value,...(current.allowedContacts[name]||[])])];
  }
  save(current);
};info.append(sel)}}const actions=document.createElement("div");actions.className="directory-actions";if(!(mode==="hotels"&&isProtectedHotel(d,name))){actions.append(button("Modifier",()=>{const next=prompt("Nouveau nom",name);if(next===null)return;if(!rename(d,name,next,mode==="hotels")){alert("Nom invalide ou déjà utilisé.");return}save(d)}));actions.append(button("Supprimer",()=>{if(!confirm("Supprimer « "+name+" » du référentiel ?"))return;if(mode==="hotels"){delete d.hotels[name];d.hotelSequence=(d.hotelSequence||[]).filter(n=>n!==name);delete d.allowedContacts?.[name];d.deletedHotels=[...new Set([...(d.deletedHotels||[]),name])]}else{d.driverOrder=(d.driverOrder||[]).filter(n=>n!==name);d.contacts=(d.contacts||[]).filter(n=>norm(n)!==norm(name));d.archivedDriverNames=(d.archivedDriverNames||[]).filter(n=>norm(n)!==norm(name));d.contactGroupSequence=(d.contactGroupSequence||[]).filter(n=>norm(n)!==norm(name));for(const h of Object.keys(d.hotels))if(d.hotels[h]===name)d.hotels[h]="";for(const h of Object.keys(d.allowedContacts||{}))d.allowedContacts[h]=d.allowedContacts[h].filter(n=>n!==name)}save(d)}))}row.append(info,actions);$("directoryRows").append(row)})}
window.TaxiHoldReorder.bind($("directoryRows"),{item:'.directory-row',handle:'.directory-name',enabled:()=>sortMode[mode]==='priority'&&(mode!=='hotels'||!$('directorySearch').value.trim()),onDrop(order){const d=load();if(!d)return false;if(mode==='hotels'){d.hotelSequence=order;d.manualHotelOrder=true}else d.driverOrder=order;save(d);return true;}});
$("directorySearch").oninput=render;
$("directorySort").onchange=()=>{sortMode[mode]=$("directorySort").value;render()};
$("directoryClose").onclick=()=>dialog.close();$("directoryAdd").onclick=()=>{const d=load(),name=$("directoryNew").value.trim();if(!d||!name)return;const existing=mode==="hotels"?hotelNames(d):drivers(d);if(existing.some(n=>norm(n)===norm(name))||(mode==="drivers"&&((d.contacts||[]).some(n=>norm(n)===norm(name))||reservedContacts(d).has(norm(name))))){alert("Ce nom existe déjà ou est réservé aux contacts d’attribution.");return}if(mode==="hotels"){Object.defineProperty(d.hotels,name,{value:"",writable:true,enumerable:true,configurable:true});d.hotelSequence=[...new Set([...(d.hotelSequence||[]),name])];d.allowedContacts=d.allowedContacts||{};Object.defineProperty(d.allowedContacts,name,{value:[],writable:true,enumerable:true,configurable:true});d.deletedHotels=(d.deletedHotels||[]).filter(n=>norm(n)!==norm(name));d.inactiveCommissionHotels=[...new Set([...(d.inactiveCommissionHotels||[]),name])]}else{d.contacts=[...new Set([...(d.contacts||[]),name])];d.driverOrder=[...new Set([...(d.driverOrder||[]),name])]}$("directoryNew").value="";save(d)};
$("directoryNew").addEventListener("keydown",e=>{if(e.key==="Enter")$("directoryAdd").click()});
$("hotelCommissionsFrame").addEventListener("load",()=>{if(dialog.open)render()});
window.openTaxiDirectory=function(which){
  $("directorySearch").value="";
  mode=which==="drivers"?"drivers":"hotels";
  render();
  if(!dialog.open)dialog.showModal();
  if(!load())window.initializeHotelDirectory();
};
})();
