(function(root){
'use strict';
const KEY='montaxi:driver-directory:v1';
const HOTEL_DIRECTORY_KEY='montaxi:hotel-commissions:directory-v1';
const COURSES_KEY='montaxi:hotel-commissions:courses-v1';
const priorityLabels=['','Contact d’hôtel','Chauffeur de confiance','Chauffeur standard'];
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const phone=s=>String(s||'').trim().replace(/[\s().-]/g,'');
const validPhone=s=>/^\+?[0-9]{3,20}$/.test(phone(s));
function clientContactPhone(value){
 const raw=String(value??'').trim();
 const compact=phone(raw.startsWith('+')||raw.startsWith('00')?raw.replace('(0)',''):raw);
 const international=compact.startsWith('00')?'+'+compact.slice(2)
  :compact.startsWith('0')?'+32'+compact.slice(1)
  :/^32[1-9][0-9]{7,8}$/.test(compact)?'+'+compact:compact;
 return /^\+[1-9][0-9]{7,14}$/.test(international)?international:'';
}
const category=name=>/^TX\s*Van\b/i.test(norm(name))||/^TX\b.*\bVan\b/i.test(norm(name))?'van':'car';
const isTx=name=>/^TX/i.test(norm(name));
const id=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
function availability(name){
 const night=/\b(?:nuit|night)\b/i.test(norm(name));
 const day=/\b(?:jour|day)\b/i.test(norm(name));
 return {day:day||!night,night};
}
function normalizeDriver(d){
 const physical=d.category==='van'?'van':'car';
 const periods=d.availability;
 const times=periods&&typeof periods.day==='boolean'&&typeof periods.night==='boolean'&&(periods.day||periods.night)?{day:periods.day,night:periods.night}:availability(d.name);
 return {...d,category:physical,acceptsCar:true,availability:times};
}
function eligible(d,vehicle,period='all'){
 d=normalizeDriver(d);
 return (vehicle==='van'?d.category==='van':d.category==='car'||d.acceptsCar)&&(period==='all'||d.availability[period]===true);
}
function driverSearchName(name){
 let text=norm(name).replace(/^TX\s*/i,'');
 let previous;
 do{previous=text;text=text.replace(/^(?:van|nuit|night|jour|day)\b[\s:._-]*/i,'');}while(text!==previous);
 return text.trim();
}
const cleanSearch=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
function assignedNameMatches(drivers,name){
 const normalized=value=>cleanSearch(driverSearchName(value)||value).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const key=normalized(name);
 if(!key)return [];
 const exact=drivers.filter(driver=>normalized(driver.name)===key||cleanSearch(driver.name)===cleanSearch(name));
 if(exact.length||!key.includes(' '))return exact;
 const tokens=value=>value.split(' ').sort().join(' ');
 return drivers.filter(driver=>tokens(normalized(driver.name))===tokens(key));
}
function nameSearchRank(name,query){
 let q=cleanSearch(query);if(!q)return 0;
 if(/^(?:[a-z]\s+)+[a-z]$/.test(q))q=q.replace(/\s/g,'');
 name=cleanSearch(name);const words=name.split(/\s+/);
 if(name.startsWith(q))return 0;
 if(words.some(word=>word.startsWith(q)))return 1;
 const tokens=q.split(/\s+/);if(tokens.length>1&&tokens.every(token=>words.some(word=>word.startsWith(token))))return 1;
 return name.includes(q)?2:-1;
}
function searchRank(driver,query){
 const rank=nameSearchRank(driverSearchName(driver.name),query);
 if(rank>=0)return rank;
 const digits=phone(cleanSearch(query));
 return /[0-9]/.test(digits)&&phone(driver.phone).includes(digits)?3:-1;
}
function driverPriority(driver,hotelContacts){
 if([1,2,3].includes(driver.priorityClass))return driver.priorityClass;
 return hotelContacts.has(cleanSearch(driverSearchName(driver.name)))||hotelContacts.has(cleanSearch(driver.name))?1:3;
}
function orderedDrivers(drivers,mode='priority',hotelContacts=new Set()){
 const priority=item=>Number.isFinite(item.driver.priority)?item.driver.priority:item.index;
 const collator=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
 return drivers.map((driver,index)=>({driver,index})).sort((a,b)=>{
  if(mode==='az'||mode==='za')return (mode==='az'?1:-1)*collator.compare(driverSearchName(a.driver.name),driverSearchName(b.driver.name))||a.index-b.index;
  return driverPriority(a.driver,hotelContacts)-driverPriority(b.driver,hotelContacts)||priority(a)-priority(b)||a.index-b.index;
 }).map(item=>item.driver);
}
function requiredVehicle(course){
 const cars=Number(course?.carCount)||0,vans=Number(course?.vanCount)||0;
 if(cars>0&&vans>0)return 'mixed';if(vans>0)return 'van';if(cars>0)return 'car';
 const vehicle=String(course?.vehicleChoice||course?.vehicle||'').toLocaleLowerCase('fr');
 if(/\bvan\b/.test(vehicle))return 'van';if(/voiture/.test(vehicle))return 'car';return 'any';
}
function courseVehicle(course){if(!course)return null;const value=requiredVehicle(course);return value==='mixed'?'car':value==='any'?null:value;}
function compatibleWithCourse(driver,course){
 const required=requiredVehicle(course);
 return required==='van'?normalizeDriver(driver).category==='van':required==='car'?eligible(driver,'car'):true;
}
function merge(existing,incoming,source,options={}){
 const result=existing.map(normalizeDriver);let added=0,updated=0,unchanged=0;
 for(const c of incoming){
  if(!norm(c.name)||!validPhone(c.phone))continue;
  const nativeId=c.nativeId?String(c.nativeId):'';
  let old=nativeId?result.find(x=>x.nativeId===nativeId):null;
  // Browser contact files have no stable phone ID. Only match a unique exact name.
  if(!nativeId){const matches=result.filter(x=>!x.nativeId&&norm(x.name).toLocaleLowerCase('fr')===norm(c.name).toLocaleLowerCase('fr'));old=matches.length===1?matches[0]:matches.find(x=>phone(x.phone)===phone(c.phone));}
  if(source==='tx'&&!isTx(c.name))continue;
  if(source==='sync'&&!old&&!isTx(c.name))continue;
  if(old){
   const fingerprint=d=>JSON.stringify([d.name,d.phone,d.category,d.acceptsCar,d.availability]);
   const before=fingerprint(old);
   if(options.fromPhone||!old.localName)old.name=norm(c.name);
   if(options.fromPhone||!old.localPhone)old.phone=phone(c.phone);
   if(options.fromPhone){old.localName=false;old.localPhone=false;}
   if(!old.manualCategory){old.category=category(c.name);if(!old.manualServices)old.acceptsCar=old.category==='car';}
   if(!old.manualAvailability)old.availability=availability(c.name);
   Object.assign(old,normalizeDriver(old));
   if(fingerprint(old)!==before)updated++;else unchanged++;
  }else{
   result.push(normalizeDriver({id:id(),name:norm(c.name),phone:phone(c.phone),nativeId,category:category(c.name),source:source==='sync'?'tx':source,manualCategory:source==='chosen'}));added++;
  }
 }
 return {drivers:result,added,updated,unchanged};
}
function parseVcard(text){
 const unfolded=String(text).replace(/\r?\n[ \t]/g,'');const rows=[];
 for(const block of unfolded.split(/BEGIN:VCARD/i).slice(1)){
  const fields=block.split(/\r?\n/);const fn=fields.find(l=>/^FN(?:;[^:]*)?:/i.test(l));const n=fields.find(l=>/^N(?:;[^:]*)?:/i.test(l));
  const decode=s=>s.replace(/\\[nN]/g,' ').replace(/\\([,;\\])/g,'$1');
  const name=fn?decode(fn.slice(fn.indexOf(':')+1)):n?decode(n.slice(n.indexOf(':')+1).split(';').filter(Boolean).reverse().join(' ')):'';
  const tel=fields.find(l=>/^(?:item\d+\.)?TEL(?:;[^:]*)?:/i.test(l));
  if(tel)rows.push({name,phone:tel.slice(tel.indexOf(':')+1).replace(/^tel:/i,'')});
 }
 return rows;
}
function airportLabel(value){
 const text=String(value??'').trim();
 const key=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
 if(['BRU','ZAVENTEM','AIRPORT BRU','AEROPORT BRU','BRUXELLES AEROPORT (BRU)','AIRPORT BRU (ZAVENTEM)'].includes(key))return 'Airport BRU (Zaventem)';
 if(['CRL','CHARLEROI','AIRPORT CRL','AEROPORT CRL','CHARLEROI AIRPORT (CRL)','AIRPORT CRL (CHARLEROI)'].includes(key))return 'Airport CRL (Charleroi)';
 return text;
}
function fixedPriceLine(value){
 if(value==null||String(value).trim()==='')return '';
 const amount=Number(String(value).replace(/\s/g,'').replace(',','.'));
 if(!Number.isFinite(amount)||amount<0)return '';
 return 'ATTENTION — PRIX FIXÉ : '+new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(amount);
}
function driverDate(value){
 const text=String(value??'').trim();
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
 return match?match[3]+'/'+match[2]+'/'+match[1]:text;
}
function passengerLine(entry){
 const count=Number(entry.passengers??entry.pickup?.passengers);
 return Number.isSafeInteger(count)&&count>0?'Passagers : '+count:'';
}
function courseText(e){
 const p=e.pickup||{};
 const client=String(e.clientName??'').trim()||String(p.client??'').trim();
 const clientPhone=String(e.clientPhone??'').trim()||String(p.phone??'').trim();
 const flight=String(p.flight??'').trim()||String(e.flight??'').trim();
 const company=String(p.company??'').trim()||String(e.company??'').trim();
 return [
  fixedPriceLine(e.announcedPrice),
  [driverDate(e.scheduledDate||e.date),e.scheduledTime||e.recordedTime].filter(Boolean).join(' à '),
  /^\d{6}\.\d{2,}$/.test(e.reference??'')&&'Réf. '+e.reference,
  [p.place?airportLabel(p.place):e.hotel,airportLabel(e.destination==='Autre'?(e.otherDestination||e.destination):e.destination)].filter(Boolean).join(' → '),
  String(e.room??'').trim()&&'Chambre : '+String(e.room).trim(),
  p.timeMode==='arrival'?'Suivi vol / train':'',
  client&&'Client : '+client,clientPhone&&'Téléphone : '+clientPhone,
  flight&&(p.place?'Vol/train : ':'Vol : ')+flight,company&&'Compagnie : '+company,p.arrival&&'Arrivée : '+p.arrival,
  (e.carCount||e.vanCount)?[e.carCount&&e.carCount+' voiture(s) normale(s)',e.vanCount&&e.vanCount+' van(s)'].filter(Boolean).join(' · '):String(e.vehicle||'').replace(/Petite voiture/g,'Voiture normale'),
  passengerLine(e),p.luggage&&'Bagages : '+p.luggage,
  e.note&&'Remarques : '+e.note
 ].filter(Boolean).join('\n');
}
const core={merge,parseVcard,airportLabel,fixedPriceLine,driverDate,passengerLine,courseText,phone,validPhone,clientContactPhone,category,isTx,availability,normalizeDriver,eligible,driverSearchName,nameSearchRank,searchRank,requiredVehicle,compatibleWithCourse,courseVehicle,driverPriority,orderedDrivers};
if(typeof module==='object'&&module.exports){module.exports=core;return;}
root.TaxiDriverDirectoryCore=core;
const doc=root.document;
let state,readError=false;
function readState(){
 const raw=localStorage.getItem(KEY);const data=raw?JSON.parse(raw):{version:2,drivers:[],deletedNativeIds:[]};
 if(data.version>2||!Array.isArray(data.drivers)||!data.drivers.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.phone==='string')||(data.deletedNativeIds&&!Array.isArray(data.deletedNativeIds)))throw Error('Format');
 return {...data,version:2,drivers:data.drivers.map(normalizeDriver),deletedNativeIds:data.deletedNativeIds||[]};
}
try{state=readState();}catch{readError=true;state={version:2,drivers:[],deletedNativeIds:[]};}
const dialog=doc.createElement('dialog');dialog.id='taxiDrivers';dialog.setAttribute('aria-labelledby','driversHeading');dialog.innerHTML=`
<div class="drivers-heading"><h2 id="driversHeading">Répertoire chauffeurs</h2><button type="button" data-close aria-label="Fermer">✕</button></div>
<p id="driversStatus" role="status" aria-live="polite"></p>
<fieldset id="driversEditor" hidden><legend>Fiche chauffeur</legend>
<label>Nom<input id="driversName" autocomplete="off"></label><label>Téléphone<input id="driversPhone" type="tel" autocomplete="off"></label>
<label>Priorité<select id="driversEditPriority"><option value="">Automatique · selon les contacts d’hôtel</option>${priorityLabels.slice(1).map((label,index)=>`<option value="${index+1}">${index+1} · ${label}</option>`).join('')}</select></label>
<label>Véhicule réel<select id="driversCategory"><option value="car">Voiture normale</option><option value="van">Van</option></select></label>
<div class="drivers-checks"><span>Courses possibles</span><label><input id="driversCarEligible" type="checkbox"> Voiture normale</label><label><input id="driversVanEligible" type="checkbox" disabled> Van</label></div>
<div class="drivers-checks"><span>Disponibilité</span><label><input id="driversDay" type="checkbox"> Jour</label><label><input id="driversNight" type="checkbox"> Nuit</label></div>
<p>Les vans figurent aussi dans Voiture normale. Coche Jour et Nuit si le chauffeur travaille dans les deux périodes.</p>
<div class="drivers-tools"><button type="button" id="driversSave">Enregistrer dans Mon Taxi</button><button type="button" id="driversEditCancel">Annuler</button><button type="button" id="driversPhoneEdit" hidden>Modifier dans le téléphone</button><button type="button" id="driversDelete" hidden>Supprimer</button></div></fieldset>
<div id="driversContent">
<div id="driversListControls">
<input id="driversSearch" type="search" aria-label="Rechercher un chauffeur" placeholder="Nom ou téléphone">
<div class="drivers-list-filters">
<label id="driversVanFilter"><input type="checkbox" id="driversVanOnly" aria-label="Uniquement van"> Van</label>
<div id="driversPeriodFilters" class="drivers-periods" role="group" aria-label="Période"><button type="button" data-period="all">Tous</button><button type="button" data-period="day">Jour</button><button type="button" data-period="night">Nuit</button></div>
<details class="drivers-management" id="driversManagement">
<summary>Options</summary>
<div class="drivers-option-panel">
<label id="driversSortBox">Tri<select id="driversSort"><option value="priority">Priorité</option><option value="az">Ordre alphabétique A → Z</option><option value="za">Ordre alphabétique Z → A</option></select></label>
<div id="driversPriorityLegend" aria-label="Couleurs des priorités"></div>
<div class="drivers-tools">
<button type="button" id="driversTx">↻ Actualiser le répertoire</button>
<button type="button" id="driversPick">Importer un chauffeur</button>
<button type="button" id="driversAdd">+ Ajouter manuellement</button>
<button type="button" id="driversExport">Sauvegarder le répertoire</button>
</div>
<small id="driversLastSync"></small>
</div></details>
</div></div>
<dialog id="driversPriorityPicker" aria-labelledby="driversPriorityTitle"><div class="drivers-heading"><h2 id="driversPriorityTitle">Priorité</h2><button type="button" id="driversPriorityCancel">Fermer</button></div><div id="driversPriorityOptions"></div></dialog>
<p id="driversCourseContext" hidden></p><div id="driversList"></div><section id="driversDetails" hidden></section><fieldset id="driversImportPanel" hidden><legend>Importer une course du Planning</legend><label>Course<select id="driversImportCourse"></select></label><button type="button" id="driversImportConfirm">Importer et attribuer</button></fieldset>
<fieldset id="driversSmsPanel" hidden><legend>SMS au chauffeur sélectionné</legend><label>Contenu<select id="driversMessageSource"><option value="free">Message libre / saisie rapide</option><option value="course">Course du Planning / réservation</option></select></label><select id="driversCourse" aria-label="Course" hidden></select><p id="driversPriceAlert" hidden><strong></strong></p><label>Message à vérifier et modifier<textarea id="driversMessage" rows="7"></textarea></label><p id="driversRecipient">Sélectionne un chauffeur dans la liste.</p><button type="button" id="driversSms">Ouvrir l’application SMS</button><p>L’envoi est à confirmer dans l’application SMS.</p></fieldset></div>`;
doc.body.append(dialog);
const css=doc.createElement('style');css.textContent=`
#taxiDrivers{box-sizing:border-box;width:min(680px,96vw);max-height:92dvh;overflow:auto;background:#111c30;color:#f5f7ff;border:1px solid #7196c4;border-radius:16px;padding:12px clamp(9px,3vw,15px)}
#taxiDrivers::backdrop{background:#000b}#taxiDrivers h2{margin:0;font-size:17px}
#taxiDrivers button{font:inherit;border:1px solid #7196c4;border-radius:9px;background:#203856;color:white;padding:10px;min-height:42px;cursor:pointer}
#taxiDrivers button[aria-pressed=true]{background:#1467b7}#taxiDrivers button:disabled{opacity:.6;cursor:default}
#taxiDrivers label{display:block;margin:10px 0}#taxiDrivers input:not([type=checkbox]),#taxiDrivers select,#taxiDrivers textarea{display:block;box-sizing:border-box;width:100%;font:inherit;background:#0b1424;color:#fff;border:1px solid #7196c4;border-radius:8px;padding:10px;margin-top:5px}
#taxiDrivers fieldset{min-width:0;border:1px solid #4c6485;border-radius:10px;margin-top:16px}
#taxiDrivers .drivers-heading,#taxiDrivers .drivers-tools,#taxiDrivers .driver-actions,#taxiDrivers .drivers-periods{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
#taxiDrivers .drivers-heading{justify-content:space-between;gap:8px}#taxiDrivers .drivers-heading button{font-size:13px;padding:8px}
#taxiDrivers #driversVanFilter{display:flex;align-items:center;gap:8px;min-height:36px;width:fit-content}
#taxiDrivers .driver-row{display:flex;align-items:center;gap:4px;padding:0;border-bottom:1px solid #34435e;overflow-wrap:anywhere}#taxiDrivers .driver-name{display:block;flex:1;min-width:0;width:auto;min-height:44px;padding:11px 6px;border:0;border-radius:0;background:transparent;text-align:left}#taxiDrivers .driver-reorder{flex:none;width:34px;padding:4px;min-height:34px}#taxiDrivers .driver-name:hover,#taxiDrivers .driver-name:focus-visible{background:#203856}#taxiDrivers .driver-detail-phone{font-size:21px;margin:10px 0}#driversDetails .driver-actions{margin:14px 0}#driversDetails h3{margin:16px 0 0}
#driversPriorityLegend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
#taxiDrivers .driver-priority{display:inline-flex;flex:none;align-items:center;justify-content:center;min-width:24px;min-height:24px;padding:2px 6px;border-radius:7px;font-size:12px;font-weight:700;line-height:1.2}
#taxiDrivers .driver-row .driver-priority{min-width:44px;min-height:44px;border:0;padding:0}
#taxiDrivers #driversPriorityPicker{width:min(340px,86vw);box-sizing:border-box;background:#111c30;color:#f5f7ff;border:1px solid #7196c4;border-radius:16px;padding:14px}
#taxiDrivers #driversPriorityPicker::backdrop{background:#0009}
#driversPriorityOptions{display:grid;gap:8px;margin-top:12px}#driversPriorityError:empty{display:none}
#taxiDrivers #driversPriorityOptions button{min-height:44px;font-size:14px}
#taxiDrivers #driversPriorityOptions [aria-pressed=true]{outline:2px solid currentColor;outline-offset:-4px}
#taxiDrivers .driver-priority[data-level="1"]{background:#145733;color:#dcfce7}
#taxiDrivers .driver-priority[data-level="2"]{background:#204f96;color:#e0f2fe}
#taxiDrivers .driver-priority[data-level="3"]{background:#3b485a;color:#f1f5f9}
#taxiDrivers .driver-call-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0}
#taxiDrivers .driver-call-line .driver-detail-phone{margin:0;min-width:0;overflow-wrap:anywhere}
#taxiDrivers .driver-contact-actions{display:flex;flex:none;gap:8px;margin-inline-start:auto}
#taxiDrivers .driver-contact-actions button{min-width:56px;min-height:44px;color:#fff;font-weight:700}
#taxiDrivers #driversSmsShortcut{background:#255f9f;border-color:#5796d6}
#taxiDrivers #driversSmsShortcut:hover,#taxiDrivers #driversSmsShortcut:active{background:#2c6eaf}
#taxiDrivers #driversCall{background:#17633d;border-color:#3bae75}
#taxiDrivers #driversCall:hover,#taxiDrivers #driversCall:active{background:#1b7146}
#taxiDrivers #driversAssignCourse{min-height:44px;background:#255f9f;border-color:#5796d6}
#taxiDrivers .driver-row strong,#taxiDrivers .driver-row small{display:block;margin-bottom:7px}#taxiDrivers small{color:#bed0e5}
#taxiDrivers .drivers-checks{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;font-size:13px}#taxiDrivers .drivers-checks span{flex:none;width:88px;color:#bed0e5;font-size:11px}
#taxiDrivers .drivers-checks label{display:inline-flex;align-items:center;gap:6px;min-height:32px;margin:0}
#taxiDrivers input[type=checkbox]{display:inline-block;appearance:auto;flex:none;width:19px;height:19px;min-height:0;padding:0;margin:0;accent-color:#338de6}
#taxiDrivers .drivers-heading>button[data-close]{width:44px;min-height:44px;padding:0;font-size:16px}
#taxiDrivers #driversListControls{margin-block:6px 4px}
#taxiDrivers #driversSearch{margin:0;min-height:44px;padding:8px 10px}
#taxiDrivers .drivers-list-filters{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px}
#taxiDrivers .drivers-list-filters :is(#driversPeriodFilters,#driversVanFilter){margin:0}
#taxiDrivers #driversVanFilter{gap:4px;min-height:44px;padding:0 3px;font-size:14px}
#taxiDrivers .drivers-periods{flex-wrap:nowrap;gap:3px}
#taxiDrivers .drivers-periods button{padding:4px 5px;min-height:44px;font-size:13px}
#taxiDrivers .drivers-management{margin-inline-start:auto;min-width:0}
#taxiDrivers .drivers-management[open]{flex-basis:100%}
#taxiDrivers .drivers-management summary{display:list-item;box-sizing:border-box;min-height:44px;width:max-content;margin-inline-start:auto;padding:12px 5px;color:#bed0e5;font-size:13px;cursor:pointer;list-style:none}
#taxiDrivers .drivers-management summary::-webkit-details-marker{display:none}
#taxiDrivers .drivers-management summary::after{content:"⌄";margin-inline-start:3px}
#taxiDrivers .drivers-management[open] summary::after{content:"⌃"}
#taxiDrivers .drivers-option-panel{padding:8px;border:1px solid var(--clean-line,#4c6485);border-radius:9px}
#taxiDrivers #driversSortBox{display:flex;align-items:center;gap:8px;margin:0}
#taxiDrivers #driversSort{flex:1;min-width:0;margin:0}
#taxiDrivers .drivers-option-panel .drivers-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:5px}
#taxiDrivers .drivers-option-panel button{width:100%;padding:5px 7px;font-size:14px;min-height:44px}
#driversPriceAlert{border:1px solid #eab308;border-radius:8px;background:#422b08;color:#fde68a;padding:10px}
#driversLastSync{display:block;margin-top:6px}
#driversStatus{white-space:pre-line;margin:5px 0;font-size:14px}
#taxiDrivers :is(#driversLastSync,#driversStatus):empty{display:none}
#openTaxiDrivers{position:static;grid-column:2 / 4;grid-row:2;justify-self:end;margin-left:auto;width:auto;padding:6px 10px!important;min-height:32px;font-size:12px!important;border:1px solid #7196c4;border-radius:9px;background:#142238;color:white}
#taxiDrivers [hidden]{display:none!important}`;doc.head.append(css);
const $=s=>dialog.querySelector('#'+s);
function priorityBadge(level,full=false,onClick){
 const badge=doc.createElement(onClick?'button':'span');
 if(onClick){badge.type='button';badge.onclick=onClick;}
 badge.className='driver-priority';badge.dataset.level=level;
 const label=level+' · '+priorityLabels[level];
 badge.textContent=full?label:level;
 badge.title=label;badge.setAttribute('aria-label',label);
 return badge;
}
for(const level of [1,2,3])$('driversPriorityLegend').append(priorityBadge(level,true));
const hotelDriverContacts=()=>root.taxiHotelDriverContactNames?.()||new Set();
const priorityPicker=$('driversPriorityPicker');
let priorityDriverId=null;
function showPriorityPicker(driverId){
 const driver=state.drivers.find(d=>d.id===driverId);
 if(!driver||priorityPicker.open)return;
 priorityDriverId=driverId;
 $('driversPriorityTitle').textContent='Priorité · '+driver.name;
 const current=driverPriority(driver,hotelDriverContacts());
 const choices=[1,2,3].map(level=>{
  const button=priorityBadge(level,true,()=>{
   const updated=state.drivers.map(d=>d.id===driverId?{...d,priorityClass:level}:d);
   if(commit(updated)){priorityPicker.close();status('Priorité enregistrée pour '+driver.name+'.');}
   else $('driversPriorityError').textContent=$('driversStatus').textContent;
  });
  button.setAttribute('aria-pressed',String(level===current));
  return button;
 });
 const error=doc.createElement('p');error.id='driversPriorityError';error.setAttribute('role','status');
 $('driversPriorityOptions').replaceChildren(...choices,error);
 priorityPicker.showModal();
 choices[current-1].focus();
}
$('driversPriorityCancel').onclick=()=>priorityPicker.close();
priorityPicker.addEventListener('close',()=>{
 if(dialog.open){
  const row=[...$('driversList').children].find(item=>item.dataset.driverId===priorityDriverId);
  row?.querySelector('.driver-priority')?.focus({preventScroll:true});
 }
 priorityDriverId=null;
});
dialog.addEventListener('close',()=>{if(priorityPicker.open)priorityPicker.close()});
let pendingDriverLookup=null;
let vanOnly=false,period='all',editing=null,recipient=null,busy=false,selectedDriver=null,listScroll=0,courseContext=null,linkedCourse=null,pickDriverCallback=null;
let exportCourse=false,changeDriver=false,courseSort=null;
const vanRequired=()=>requiredVehicle(courseContext)==='van';
const vanFilter=()=>vanOnly||vanRequired();
const compatibleDrivers=(sort,hotelContacts)=>orderedDrivers(state.drivers,sort,hotelContacts)
 .filter(driver=>eligible(driver,vanFilter()?'van':'car',period)&&compatibleWithCourse(driver,courseContext));
const status=t=>{$('driversStatus').textContent=t;};
function save(){if(readError){status('Le répertoire enregistré est illisible. Exportez une sauvegarde avant toute réparation.');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{status('Enregistrement impossible : espace de stockage indisponible.');return false;}}
function commit(drivers,deleted=state.deletedNativeIds,metadata={}){const old=state;state={...state,...metadata,version:2,drivers:drivers.map(normalizeDriver),deletedNativeIds:deleted};if(!save()){state=old;return false;}render();updateRecipient();return true;}
function action(label,fn){const b=doc.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function check(label,checked,disabled,onchange){
 const l=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.checked=checked;input.disabled=disabled;input.setAttribute('aria-label',label);input.onchange=()=>onchange(input.checked);l.append(input,doc.createTextNode(label));return l;
}
function editOptions(d,changes){
 const record=normalizeDriver({...d,...changes});
 if(changes.availability&&!changes.availability.day&&!changes.availability.night){status('Coche au moins Jour ou Nuit pour ce chauffeur.');render();return;}
 if(commit(state.drivers.map(x=>x.id===d.id?record:x)))status('Choix du chauffeur enregistrés.');
}
function checkboxGroup(title){const group=doc.createElement('div');group.className='drivers-checks';const label=doc.createElement('span');label.textContent=title;group.append(label);return group;}
function selectDriver(id){
 listScroll=dialog.scrollTop;selectedDriver=id;render();
 if(exportCourse){
  showDriverSms(id);
  $('driversSmsPanel').scrollIntoView({block:'nearest'});
 }else $('driversDetails').scrollIntoView({block:'start'});
}
function showDriverSms(id){
 recipient=id;updateRecipient();$('driversSmsPanel').hidden=false;
}
function returnToNames(){
 const previous=selectedDriver;selectedDriver=null;$('driversEditor').hidden=true;$('driversSmsPanel').hidden=true;$('driversImportPanel').hidden=true;render();
 requestAnimationFrame(()=>{dialog.scrollTop=listScroll;const row=[...$('driversList').children].find(x=>x.dataset.driverId===previous);row?.querySelector('button')?.focus({preventScroll:true});});
}
function deleteDriver(d){
 if(!confirm('Supprimer '+d.name+' du répertoire Mon Taxi ? Le contact du téléphone est conservé.'))return;
 const deleted=d.nativeId?[...new Set([...state.deletedNativeIds,d.nativeId])]:state.deletedNativeIds;
 if(commit(state.drivers.filter(x=>x.id!==d.id),deleted)){$('driversEditor').hidden=true;$('driversSmsPanel').hidden=true;status('Chauffeur supprimé de Mon Taxi.');}
}
function render(){
 const sort=courseSort??state.sortMode;
 $('driversSort').value=['az','za'].includes(sort)?sort:'priority';
 $('driversVanOnly').checked=vanFilter();
 $('driversVanOnly').disabled=vanRequired();
 dialog.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
 $('driversLastSync').textContent=state.lastSyncedAt?'Dernière actualisation : '+new Date(state.lastSyncedAt).toLocaleString('fr-BE'):'';
 const list=$('driversList'),details=$('driversDetails');list.replaceChildren();details.replaceChildren();
 const selected=state.drivers.find(d=>d.id===selectedDriver);if(!selected)selectedDriver=null;
 list.hidden=!!selectedDriver;details.hidden=!selectedDriver;$('driversListControls').hidden=!!selectedDriver;
 const hotelContacts=hotelDriverContacts();
 $('driversCourseContext').hidden=!linkedCourse;$('driversCourseContext').textContent=linkedCourse?'Course : '+courseTitle(linkedCourse):'';
 if(selected){
  const back=action('← Retour aux noms',returnToNames);back.id='driversBack';const name=doc.createElement('h3');name.textContent=selected.name;
  const num=doc.createElement('p');num.className='driver-detail-phone';num.textContent=selected.phone;
  const call=action('Appeler',()=>callDriver(selected));call.id='driversCall';
  const sms=action('SMS',()=>{
   showDriverSms(selected.id);$('driversMessage').focus();
  });sms.id='driversSmsShortcut';
  const contactActions=doc.createElement('div');contactActions.className='driver-contact-actions';contactActions.append(sms,call);
  const callLine=doc.createElement('div');callLine.className='driver-call-line';callLine.append(num,contactActions);
  const kind=doc.createElement('small');kind.textContent=selected.category==='van'?'Véhicule : Van':'Véhicule : Voiture normale';
  const actions=doc.createElement('div');actions.className='driver-actions';actions.append(action('Modifier',()=>edit(selected)),action('Supprimer',()=>deleteDriver(selected)));
  if(pickDriverCallback)actions.prepend(action('Choisir ce chauffeur',()=>{if(courseContext&&!compatibleWithCourse(selected,courseContext)){status('Ce véhicule ne correspond pas à la course.');return;}if(pickDriverCallback(selected)!==false)dialog.close();else status('Ce nom ne peut pas être attribué comme chauffeur. Choisis une autre fiche.');}));
  else if(!changeDriver&&!exportCourse)actions.append(action('Importer une course',()=>showCoursePicker(selected)));
  if(selected.nativeId&&root.TaxiContacts)actions.append(action('Modifier dans le téléphone',()=>root.TaxiContacts.edit(selected.nativeId)));
  const services=checkboxGroup('Courses possibles');services.append(check('Voiture normale',true,true,value=>editOptions(selected,{acceptsCar:value,manualServices:true})),check('Van',selected.category==='van',true,()=>{}));
  const times=checkboxGroup('Disponibilité');times.append(check('Jour',selected.availability.day,false,value=>editOptions(selected,{availability:{...selected.availability,day:value},manualAvailability:true})),check('Nuit',selected.availability.night,false,value=>editOptions(selected,{availability:{...selected.availability,night:value},manualAvailability:true})));
  details.append(back,name,callLine);
  if(isPendingPlanningCourse(linkedCourse)){
   const assign=action(changeDriver?'Choisir ce chauffeur':'Attribuer cette course',()=>{
    if(!assignPlanningCourse(linkedCourse,selected))return;
    dialog.close();
    if(!doc.getElementById('hotelCommissionsDialog')?.open)root.openHotelModule?.('planning');
   });
   assign.id='driversAssignCourse';
   details.append(assign);
  }
  details.append(kind,priorityBadge(driverPriority(selected,hotelContacts),true),actions,services,times);return;
 }
 if(changeDriver)list.append(action('Moi',()=>{
  if(assignPlanningCourse(linkedCourse,null))dialog.close();
 }));
 const query=norm($('driversSearch').value);
 const priorityOrder=$('driversSort').value==='priority';
 const rows=compatibleDrivers(sort,hotelContacts)
  .map((driver,index)=>({driver,index,rank:searchRank(driver,query),priority:driverPriority(driver,hotelContacts)}))
  .filter(x=>x.rank>=0)
  .sort((a,b)=>(priorityOrder?a.priority-b.priority||a.rank-b.rank:0)||a.index-b.index)
  .map(x=>x.driver);
 for(const d of rows){
  const row=doc.createElement('div');row.className='driver-row';row.dataset.driverId=d.id;row.dataset.reorderKey=d.id;
  const button=action(d.name,()=>selectDriver(d.id));button.className='driver-name taxi-hold-handle';button.title='Appui long pour la priorité · Maintenir et déplacer pour réordonner';
  const badge=priorityBadge(driverPriority(d,hotelContacts),false,()=>showPriorityPicker(d.id));
  badge.setAttribute('aria-label','Modifier la priorité de '+d.name+' · '+badge.getAttribute('aria-label'));
  badge.setAttribute('aria-haspopup','dialog');
  row.append(badge,button);
  list.append(row);
 }
 if(!rows.length){const p=doc.createElement('p');p.textContent='Aucun chauffeur ne correspond aux filtres.';list.append(p);}
}
root.TaxiHoldReorder.bind($('driversList'),{
 item:'.driver-row',handle:'.driver-name',
 enabled:()=>$('driversSort').value==='priority'&&!norm($('driversSearch').value),
 onHold:row=>showPriorityPicker(row.dataset.driverId),
 onDrop(ids){
  const visible=new Set(ids),byId=new Map(state.drivers.map(d=>[d.id,d]));
  const hotelContacts=hotelDriverContacts();
  const ranked=orderedDrivers(state.drivers,'priority',hotelContacts);
  let index=0;
  const reordered=ranked.map(driver=>visible.has(driver.id)?byId.get(ids[index++]):driver);
  if(reordered.some((driver,i)=>driverPriority(driver,hotelContacts)!==driverPriority(ranked[i],hotelContacts))){
   status('Pour changer de priorité, modifie la fiche du chauffeur.');
   return false;
  }
  const saved=commit(reordered.map((driver,priority)=>({...driver,priority})));
  if(saved)status('Ordre enregistré.');
  return saved;
 }
});
function editorServices(){const van=$('driversCategory').value==='van';$('driversCarEligible').disabled=true;$('driversCarEligible').checked=true;$('driversVanEligible').checked=van;}
function edit(d){
 editing=d?.id||null;$('driversName').value=d?.name||'';$('driversPhone').value=d?.phone||'';$('driversCategory').value=d?.category||(vanFilter()?'van':'car');
 $('driversEditPriority').value=[1,2,3].includes(d?.priorityClass)?String(d.priorityClass):'';
 $('driversCarEligible').checked=d?d.acceptsCar:$('driversCategory').value==='car';editorServices();
 const times=d?.availability||{day:true,night:false};$('driversDay').checked=times.day;$('driversNight').checked=times.night;
 $('driversDelete').hidden=!d;$('driversPhoneEdit').hidden=!d?.nativeId||!root.TaxiContacts;
 $('driversEditor').hidden=false;$('driversName').focus();
}
function updateRecipient(){
 const driver=state.drivers.find(item=>item.id===recipient);
 $('driversRecipient').textContent=driver?'Destinataire : '+driver.name+' · '+driver.phone:'Sélectionne un chauffeur dans la liste.';
 $('driversSms').disabled=!driver;
 const course=messageCourse();
 $('driversSms').textContent=isPendingPlanningCourse(course)&&exportCourse?'Attribuer et ouvrir le SMS':course?'J’envoie la course':'Ouvrir l’application SMS';
}
function launch(url){if(root.TaxiContacts)root.TaxiContacts.open(url);else root.location.href=url;}
function courses(){try{const raw=JSON.parse(localStorage.getItem(COURSES_KEY)||'[]');return Array.isArray(raw)?raw.filter(e=>e?.id!=null):[];}catch{status('Impossible de lire les courses enregistrées.');return [];}}
function refreshCourses(selected){const select=$('driversCourse');select.replaceChildren();const blank=doc.createElement('option');blank.value='';blank.textContent='Choisir une course';select.append(blank);for(const e of courses()){const o=doc.createElement('option');o.value=e.id;o.textContent=[driverDate(e.scheduledDate||e.date),e.scheduledTime||e.recordedTime,e.pickup?.client||e.hotel,e.destination].filter(Boolean).join(' · ');select.append(o);}select.value=selected||'';}
function pricePreview(entry){const text=fixedPriceLine(entry?.announcedPrice);$('driversPriceAlert').hidden=!text;$('driversPriceAlert').querySelector('strong').textContent=text;}
function chooseCourse(){const e=courses().find(x=>String(x.id)===$('driversCourse').value);if(e)importCourse(e);}
function setBusy(value){busy=value;$('driversTx').disabled=value;$('driversTx').setAttribute('aria-busy',String(value));$('driversTx').textContent=value?'Analyse du répertoire…':'↻ Actualiser le répertoire';}
function importContacts(items,source,fromPhone=false,fullScan=false){
 if(!Array.isArray(items)){status('Réponse des contacts invalide. Les fiches existantes sont conservées.');return;}
 const filtered=(source==='tx'||source==='sync')?items.filter(c=>!state.deletedNativeIds.includes(String(c.nativeId))):items;
 const result=merge(state.drivers,filtered,source,{fromPhone});
 if(source==='chosen'){for(const c of result.drivers)if(!state.drivers.some(x=>x.id===c.id)){c.category=vanFilter()?'van':category(c.name);c.acceptsCar=c.category==='car';c.manualCategory=true;}}
 const missing=fullScan?state.drivers.filter(d=>d.nativeId&&!items.some(c=>String(c.nativeId)===d.nativeId)).length:0;
 if(commit(result.drivers,state.deletedNativeIds,fromPhone?{lastSyncedAt:new Date().toISOString()}:{})){
  status(result.added+' ajouté(s), '+result.updated+' modifié(s), '+result.unchanged+' inchangé(s).'+(missing?' '+missing+' contact(s) introuvable(s), fiche(s) conservée(s).':''));
 }
}
root.addEventListener('taxi-contacts-result',event=>{
 const d=event.detail||{};
 if(d.mode==='driver-lookup'){finishDriverLookup(d);return;}
 if(['sync','tx','refresh'].includes(d.mode)||d.error)setBusy(false);
 if(d.error){if(d.mode==='open'&&lastCall?.awaitingReturn){lastCall.awaitingReturn=false;saveCall();}if(!dialog.open&&d.mode==='open')root.alert(d.error);else status(d.error);return;}
 if(d.contacts&&d.mode==='refresh')importContacts(d.contacts,'sync',true);
 else if(d.contacts)importContacts(d.contacts,d.mode==='sync'?'sync':d.mode==='tx'?'tx':'chosen',d.mode==='sync'||d.mode==='tx',d.mode==='sync');
});
async function browserImport(sync){
 if(navigator.contacts?.select){try{const contacts=await navigator.contacts.select(['name','tel'],{multiple:true});importContacts(contacts.map(c=>({name:c.name?.[0],phone:c.tel?.[0]})),sync?'sync':'chosen',sync);}catch(e){status(e.name==='AbortError'?'Actualisation annulée.':'Accès aux contacts indisponible. Utilisez un fichier vCard.');}finally{setBusy(false);}return;}
 setBusy(false);
 const input=doc.createElement('input');input.type='file';input.accept='.vcf,text/vcard,text/x-vcard';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5000000)throw Error('Fichier trop volumineux (5 Mo maximum).');const contacts=parseVcard(await file.text());if(sync)importContacts(contacts,'sync',true);else{const chosen=contacts.filter(c=>confirm('Importer '+c.name+' ('+c.phone+') dans '+(vanFilter()||category(c.name)==='van'?'Van':'Voiture normale')+' ?'));importContacts(chosen,'chosen');}}catch(e){status(e.message||'Import impossible.');}};input.click();status('Dans Chrome, sélectionnez les contacts ou un fichier .vcf récent pour les actualiser. L’analyse complète du téléphone se fait dans l’application Android.');
}
$('driversTx').onclick=()=>{
 if(busy)return;if(readError){status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');return;}
 setBusy(true);status('Analyse des nouveaux contacts TX et des chauffeurs déjà importés…');
 try{if(root.TaxiContacts?.sync)root.TaxiContacts.sync(JSON.stringify(state.drivers.filter(d=>d.nativeId).map(d=>d.nativeId)));else if(root.TaxiContacts)root.TaxiContacts.importTx();else browserImport(true);}catch{setBusy(false);status('Actualisation impossible. Les fiches existantes sont conservées.');}
};
$('driversPick').onclick=()=>{if(root.TaxiContacts)root.TaxiContacts.pick();else browserImport(false);};
$('driversAdd').onclick=()=>edit(null);$('driversEditCancel').onclick=()=>{$('driversEditor').hidden=true;};$('driversCategory').onchange=()=>{if($('driversCategory').value==='van')$('driversCarEligible').checked=false;editorServices();};
$('driversSave').onclick=()=>{
 const name=norm($('driversName').value),number=phone($('driversPhone').value),cat=$('driversCategory').value;
 if(!name||!validPhone(number)){status('Saisissez un nom et un numéro de téléphone valide.');return;}
 const times={day:$('driversDay').checked,night:$('driversNight').checked};if(!times.day&&!times.night){status('Coche au moins Jour ou Nuit.');return;}
 const old=state.drivers.find(x=>x.id===editing);
 if(state.drivers.some(x=>x.id!==editing&&phone(x.phone)===number)&&!confirm('Ce numéro existe déjà. Ajouter / conserver une autre fiche avec ce numéro ?'))return;
 const record=normalizeDriver({...old,id:old?.id||id(),name,phone:number,category:cat,priorityClass:Number($('driversEditPriority').value)||null,acceptsCar:$('driversCarEligible').checked,availability:times,source:old?.source||'manual',manualCategory:true,manualServices:true,manualAvailability:true,localName:old?.localName||!!old&&old.name!==name,localPhone:old?.localPhone||!!old&&old.phone!==number});
 if(commit(old?state.drivers.map(x=>x.id===old.id?record:x):[...state.drivers,record])){selectedDriver=record.id;$('driversEditor').hidden=true;render();status('Fiche enregistrée dans Mon Taxi.');}
};
$('driversDelete').onclick=()=>{const d=state.drivers.find(x=>x.id===editing);if(d)deleteDriver(d);};
$('driversPhoneEdit').onclick=()=>{const d=state.drivers.find(x=>x.id===editing);if(d?.nativeId&&root.TaxiContacts)root.TaxiContacts.edit(d.nativeId);};
$('driversSearch').oninput=render;
$('driversSort').onchange=()=>{
 const sortMode=$('driversSort').value;
 if(courseSort!==null){
  courseSort=sortMode;
  render();
 }else commit(state.drivers,state.deletedNativeIds,{sortMode});
};
$('driversVanOnly').onchange=()=>{vanOnly=$('driversVanOnly').checked;render();};
dialog.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;selectedDriver=null;render();});
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
function messageCourse(){return $('driversMessageSource').value==='course'?linkedCourse:null;}
$('driversMessageSource').onchange=()=>{
 const use=$('driversMessageSource').value==='course';
 $('driversCourse').hidden=!use;
 pricePreview(use?linkedCourse:null);
 if(use)refreshCourses(linkedCourse?.id==null?'':String(linkedCourse.id));
 updateRecipient();
};
$('driversCourse').onchange=chooseCourse;
$('driversSms').onclick=()=>{
 const driver=state.drivers.find(x=>x.id===recipient);
 if(!driver||!validPhone(driver.phone))return;
 const text=$('driversMessage').value;
 if(!text.trim()){status('Saisis ou choisis le message à envoyer.');return;}
 const course=messageCourse();
 if($('driversMessageSource').value==='course'&&!course){status('Choisis la course à envoyer.');return;}
 openSms(driver,text,course);
};
$('driversExport').onclick=()=>{const raw=localStorage.getItem(KEY)||JSON.stringify(state);const a=doc.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download='mon-taxi-chauffeurs-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
const CALL_KEY='montaxi:driver-directory:last-call:v1';
let lastCall=null;
try{const saved=JSON.parse(localStorage.getItem(CALL_KEY)||'null');if(saved&&Date.now()-saved.at<14400000)lastCall=saved;}catch{}
function saveCall(){try{localStorage.setItem(CALL_KEY,JSON.stringify(lastCall));}catch{}}
function courseTitle(e){return [driverDate(e.scheduledDate||e.date),e.scheduledTime||e.recordedTime,(e.pickup?.place?airportLabel(e.pickup.place):e.hotel)+' → '+airportLabel(e.destination)].filter(Boolean).join(' · ');}
function callDriver(d){
 if(linkedCourse&&!compatibleWithCourse(d,linkedCourse)){status('Ce chauffeur ne peut pas assurer ce véhicule.');return;}
 if(linkedCourse&&linkedCourse.id!=null){lastCall={courseId:String(linkedCourse.id),driverId:d.id,at:Date.now(),awaitingReturn:true};saveCall();}
 launch('tel:'+phone(d.phone));
}
function openSms(d,text,course){
 if(isPendingPlanningCourse(course)){
  if(!assignPlanningCourse(course,d))return;
 }else if(course&&!compatibleWithCourse(d,course)){
  status('Ce chauffeur ne peut pas assurer ce véhicule.');return;
 }
 if(lastCall){lastCall.awaitingReturn=false;saveCall();}
 const url='sms:'+phone(d.phone)+'?body='+encodeURIComponent(text);dialog.close();
 root.dispatchEvent(new Event('mon-taxi-close-hotel-planning'));doc.querySelector('.pageBtn[data-page="home"]')?.click();launch(url);
}
function isPendingPlanningCourse(course){
 return course?.id!=null&&(course.reservationBoard||course.bookingMode==='Direct'||course.bookingMode==='Programmée')&&
  !['validated','cancelled','non_effectuee','non-effectuee'].includes(course.reservationStatus);
}
function planningCourses(driver){
 return courses().filter(course=>isPendingPlanningCourse(course)&&(!driver||compatibleWithCourse(driver,course)));
}
function assignPlanningCourse(course,driver){
 const frame=doc.getElementById('hotelCommissionsFrame');
 function fail(message){
  if(dialog.open)status(message);
  else{
   const feedback=frame?.contentDocument?.getElementById('reservationBoardMessage');
   if(feedback)feedback.textContent=message;
  }
  return false;
 }
 const driverName=driver?(driverSearchName(driver.name)||driver.name):'';
 try{
  const entries=JSON.parse(localStorage.getItem(COURSES_KEY)||'[]');
  const current=entries.find(entry=>entry?.id!=null&&String(entry.id)===String(course.id));
  if(!isPendingPlanningCourse(current))return fail('Cette course n’est plus en attente dans le Planning.');
  if(driver&&!compatibleWithCourse(driver,current))return fail('Ce chauffeur ne peut pas assurer le véhicule de cette course.');
  if(driver&&frame?.contentWindow?.canDrive?.(driverName)===false)return fail('Ce nom est réservé à un contact d’attribution.');
  current.driver=driver?'other':'self';
  current.driverName=driverName;
  if(driver)current.driverDirectoryId=driver.id;
  else delete current.driverDirectoryId;
  localStorage.setItem(COURSES_KEY,JSON.stringify(entries));
 }catch{return fail('Impossible d’enregistrer le chauffeur dans le Planning. Réessaie.');}
 if(lastCall?.courseId===String(course.id)){lastCall=null;saveCall();}
 frame?.contentWindow?.dispatchEvent(new Event('mon-taxi-hotel-sync'));
 root.dispatchEvent(new Event('hotel-commissions-updated'));
 return true;
}
function showCoursePicker(d){
 const select=$('driversImportCourse');select.replaceChildren();
 for(const e of planningCourses(d)){const option=doc.createElement('option');option.value=String(e.id);option.textContent=courseTitle(e);select.append(option);}
 $('driversImportPanel').hidden=false;$('driversImportConfirm').disabled=!select.options.length;
 if(!select.options.length)status('Aucune course compatible à importer depuis le Planning.');
 $('driversImportPanel').scrollIntoView({block:'nearest'});
}
function importCourse(e){
 const d=state.drivers.find(x=>x.id===selectedDriver)||state.drivers.find(x=>x.id===recipient);
 if(d&&!compatibleWithCourse(d,e)){status('Cette course demande un autre type de véhicule.');return;}
 linkedCourse=e;courseContext=e;$('driversMessageSource').value='course';refreshCourses(String(e.id));$('driversCourse').hidden=false;$('driversMessage').value=courseText(e);pricePreview(e);
 if(d)recipient=d.id;$('driversImportPanel').hidden=true;$('driversSmsPanel').hidden=false;render();updateRecipient();status('Course importée : vérifie le message puis appuie sur J’envoie.');$('driversMessage').focus();
}
$('driversImportConfirm').onclick=()=>{
 const driver=state.drivers.find(item=>item.id===selectedDriver);
 if(!driver)return;
 const course=planningCourses(driver).find(item=>String(item.id)===$('driversImportCourse').value);
 if(course&&assignPlanningCourse(course,driver)){
  importCourse(course);
  status('Course attribuée à '+(driverSearchName(driver.name)||driver.name)+' dans le Planning.');
 }
};
function lastFor(course){
 if(!lastCall||String(course.id)!==lastCall.courseId)return null;
 const d=state.drivers.find(x=>x.id===lastCall.driverId);return d&&compatibleWithCourse(d,course)?{id:d.id,name:driverSearchName(d.name)||d.name,phone:d.phone}:null;
}
function revealLastCall(course){
 const frame=doc.getElementById('hotelCommissionsFrame');
 const reveal=()=>frame?.contentWindow?.revealLastCalledDriver?.(String(course.id));
 if(frame?.contentWindow?.revealLastCalledDriver)reveal();else frame?.addEventListener('load',reveal,{once:true});
}
function finishDriverLookup(response){
 const previous=pendingDriverLookup;
 pendingDriverLookup=null;
 if(!previous||!dialog.open||selectedDriver||String(linkedCourse?.id)!==previous.id)return;
 const course=courses().find(item=>String(item.id)===previous.id);
 if(!course||course.driver!=='other'||norm(course.driverName)!==previous.name)return;
 const contacts=Array.isArray(response.contacts)?response.contacts.filter(contact=>
  !state.deletedNativeIds.includes(String(contact.nativeId))&&validPhone(contact.phone)):[];
 const matches=assignedNameMatches(contacts,previous.name);
 const numbers=new Set(matches.map(driver=>phone(driver.phone)));
 if(numbers.size===1){
  openSms(matches[0],courseText(course));
  return;
 }
 status(response.error||(numbers.size>1?'Plusieurs numéros correspondent à '+previous.name+'. Choisis sa fiche.':
  'Numéro introuvable pour '+previous.name+'. Importe sa fiche depuis les contacts.'));
}
root.TaxiDriverCommunication={
 lastFor,
 exportFromPlanning(courseId){
  const course=courses().find(item=>String(item.id)===String(courseId));
  if(!course){
   const feedback=doc.getElementById('hotelCommissionsFrame')?.contentDocument?.getElementById('reservationBoardMessage');
   if(feedback)feedback.textContent='Cette course est introuvable dans le Planning.';
   return;
  }
  const name=course.driver==='other'?norm(course.driverName):'';
  const stored=course.driver==='other'?state.drivers.find(driver=>driver.id===course.driverDirectoryId):null;
  const matches=stored?[stored]:assignedNameMatches(state.drivers,name);
  const reachable=matches.filter(driver=>validPhone(driver.phone));
  const numbers=new Set(reachable.map(driver=>phone(driver.phone)));
  const driver=reachable.find(item=>compatibleWithCourse(item,course));
  if(numbers.size===1&&driver){
   openSms(driver,courseText(course));
   return;
  }
  root.openTaxiDrivers(course,{exportCourse:true});
  if(!name)return;
  $('driversSearch').value=name;
  render();
  if(!matches.length&&typeof root.TaxiContacts?.findDriver==='function'&&name.length<=160&&!pendingDriverLookup){
   pendingDriverLookup={id:String(course.id),name};
   status('Recherche de '+name+' dans les contacts du téléphone…');
   root.TaxiContacts.findDriver(name);
   return;
  }
  status(numbers.size>1?'Plusieurs numéros correspondent à '+name+'. Choisis sa fiche.':
   reachable.length?'La fiche de '+name+' ne correspond pas au véhicule demandé.':
   'Numéro introuvable pour '+name+'. Importe sa fiche depuis les contacts.');
 },
 resumeCall(){
  if(!lastCall?.awaitingReturn)return false;
  const course=courses().find(e=>String(e.id)===lastCall.courseId);lastCall.awaitingReturn=false;saveCall();
  if(!course||!lastFor(course))return false;
  dialog.close();Promise.resolve(root.openHotelModule('planning')).then(()=>revealLastCall(course)).catch(()=>root.openTaxiDrivers(course,{driverId:lastCall.driverId}));return true;
 },
 sendToLast(course){const actual=courses().find(e=>String(e.id)===String(course.id))||course;const d=lastFor(course);if(!d)return;const profile=state.drivers.find(x=>x.id===d.id);openSms(profile,courseText(actual),course);},
 nextFor(course){const compatible=orderedDrivers(state.drivers,'priority',hotelDriverContacts()).filter(d=>compatibleWithCourse(d,course));if(!compatible.length){root.openTaxiDrivers(course);return;}const current=compatible.findIndex(d=>d.id===lastCall?.driverId);root.openTaxiDrivers(course,{driverId:compatible[(current+1)%compatible.length].id});},
 namesForCourse(course){return [...new Set(state.drivers.filter(d=>compatibleWithCourse(d,course)).map(d=>driverSearchName(d.name)||d.name))];},
 canAssignName(name,course){if(['moi','self'].includes(String(name).toLocaleLowerCase('fr')))return true;const matches=assignedNameMatches(state.drivers,name);return matches.length?matches.some(d=>compatibleWithCourse(d,course)):requiredVehicle(course)!=='van';}
};

root.taxiDriverNavigateBack=()=>{
 if(!$('driversEditor').hidden){$('driversEditor').hidden=true;return true;}
 if(!$('driversImportPanel').hidden){$('driversImportPanel').hidden=true;return true;}
 if(!$('driversSmsPanel').hidden){$('driversSmsPanel').hidden=true;return true;}
 if(selectedDriver){returnToNames();return true;}
 const options=$('driversManagement');
 if(options.open){options.open=false;options.querySelector('summary').focus();return true;}
 return false;
};
root.openTaxiDrivers=function(course,options={}){
 courseContext=course||null;linkedCourse=options.onSelect?null:course||null;pickDriverCallback=options.onSelect||null;
 exportCourse=Boolean(linkedCourse&&options.exportCourse);changeDriver=Boolean(isPendingPlanningCourse(linkedCourse)&&options.changeDriver);
 const required=requiredVehicle(course);vanOnly=false;period='all';selectedDriver=null;recipient=null;listScroll=0;
 courseSort=changeDriver&&options.firstByPriority?'priority':null;
 $('driversSearch').value='';$('driversManagement').open=false;$('driversEditor').hidden=true;$('driversSmsPanel').hidden=true;$('driversImportPanel').hidden=true;pricePreview(null);
 if(options.driverId){const d=state.drivers.find(x=>x.id===options.driverId);if(d&&(!course||compatibleWithCourse(d,course))){selectedDriver=d.id;}}
 if(courseSort==='priority')selectedDriver=compatibleDrivers(courseSort,hotelDriverContacts())[0]?.id??null;
 if(!dialog.open)dialog.showModal();render();updateRecipient();
 if(!localStorage.getItem(HOTEL_DIRECTORY_KEY))root.initializeHotelDirectory?.();if(readError)status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');
 if(linkedCourse){$('driversMessageSource').value='course';$('driversCourse').hidden=false;refreshCourses(String(course.id));$('driversMessage').value=courseText(course);pricePreview(course);status(required==='van'?'Course Van : chauffeurs Van uniquement.':'Course conservée : choisis un chauffeur compatible.');}
 else{
  $('driversMessageSource').value='free';$('driversCourse').hidden=true;$('driversMessage').value='';
  if(pickDriverCallback&&!readError)status('Choisis le chauffeur pour cette course.');
  else if(!readError&&!busy)status('');
 }
 updateRecipient();
 if(courseSort==='priority'&&selectedDriver)$('driversAssignCourse')?.focus();
};
root.addEventListener('hotel-commissions-updated',()=>{if(dialog.open)render()});
root.addEventListener('storage',event=>{if(event.key===HOTEL_DIRECTORY_KEY){if(dialog.open)render();return;}if(event.key!==KEY)return;try{state=readState();readError=false;render();updateRecipient();}catch{readError=true;status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');}});
const open=action('Répertoire',()=>root.openTaxiDrivers());open.id='openTaxiDrivers';open.setAttribute('aria-label','Ouvrir le répertoire chauffeurs');(doc.getElementById('taxiDriverShortcut')||doc.querySelector('.taxi-header')||doc.querySelector('main'))?.append(open);
})(typeof window!=='undefined'?window:globalThis);
