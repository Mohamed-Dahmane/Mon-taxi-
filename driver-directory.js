(function(root){
'use strict';
const KEY='montaxi:driver-directory:v1';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const phone=s=>String(s||'').trim().replace(/[\s().-]/g,'');
const validPhone=s=>/^\+?[0-9]{3,20}$/.test(phone(s));
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
 return {...d,category:physical,acceptsCar:physical==='car'||d.acceptsCar===true,availability:times};
}
function eligible(d,vehicle,period='all'){
 d=normalizeDriver(d);
 return (vehicle==='van'?d.category==='van':d.category==='car'||d.acceptsCar)&&(period==='all'||d.availability[period]===true);
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
 if(['BRU','ZAVENTEM','AIRPORT BRU','AEROPORT BRU','AIRPORT BRU (ZAVENTEM)'].includes(key))return 'Airport BRU (Zaventem)';
 if(['CRL','CHARLEROI','AIRPORT CRL','AEROPORT CRL','AIRPORT CRL (CHARLEROI)'].includes(key))return 'Airport CRL (Charleroi)';
 return text;
}
function courseText(e){
 const p=e.pickup||{};
 return [
  [e.scheduledDate||e.date,e.scheduledTime||e.recordedTime].filter(Boolean).join(' à '),
  [p.place?airportLabel(p.place):e.hotel,airportLabel(e.destination==='Autre'?(e.otherDestination||e.destination):e.destination)].filter(Boolean).join(' → '),
  String(e.room??'').trim()&&'Chambre : '+String(e.room).trim(),
  p.timeMode==='arrival'?'Suivi vol / train':'',
  p.client&&'Client : '+p.client,p.phone&&'Téléphone : '+p.phone,
  p.flight&&'Vol/train : '+p.flight,p.arrival&&'Arrivée : '+p.arrival,
  (e.carCount||e.vanCount)?[e.carCount&&e.carCount+' petite(s) voiture(s)',e.vanCount&&e.vanCount+' van(s)'].filter(Boolean).join(' · '):e.vehicle,
  p.passengers&&'Passagers : '+p.passengers,p.luggage&&'Bagages : '+p.luggage,
  e.announcedPrice!=null&&e.announcedPrice!==''?'Prix annoncé : '+e.announcedPrice+' €':'',e.note&&'Remarques : '+e.note
 ].filter(Boolean).join('\n');
}
const core={merge,parseVcard,airportLabel,courseText,phone,validPhone,category,isTx,availability,normalizeDriver,eligible};
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
const dialog=doc.createElement('dialog');dialog.id='taxiDrivers';dialog.innerHTML=`
<div class="drivers-heading"><h2>Répertoire chauffeurs</h2><button type="button" data-close>✕ Fermer</button></div>
<button type="button" id="driversTx">↻ Actualiser le répertoire</button>
<small id="driversLastSync"></small><p id="driversStatus" role="status" aria-live="polite"></p>
<p id="driversChoose">Choisis le véhicule pour voir les chauffeurs.</p>
<div class="drivers-tabs"><button type="button" data-category="car">Petite voiture</button><button type="button" data-category="van">Van</button></div>
<details class="drivers-management"><summary>Ajouter / sauvegarder</summary><div class="drivers-tools"><button type="button" id="driversPick">Importer un chauffeur</button><button type="button" id="driversAdd">+ Ajouter manuellement</button><button type="button" id="driversExport">Sauvegarder le répertoire</button></div></details>
<fieldset id="driversEditor" hidden><legend>Fiche chauffeur</legend>
<label>Nom<input id="driversName" autocomplete="off"></label><label>Téléphone<input id="driversPhone" type="tel" autocomplete="off"></label>
<label>Véhicule réel<select id="driversCategory"><option value="car">Petite voiture</option><option value="van">Van</option></select></label>
<div class="drivers-checks"><span>Courses possibles</span><label><input id="driversCarEligible" type="checkbox"> Petite voiture</label><label><input id="driversVanEligible" type="checkbox" disabled> Van</label></div>
<div class="drivers-checks"><span>Disponibilité</span><label><input id="driversDay" type="checkbox"> Jour</label><label><input id="driversNight" type="checkbox"> Nuit</label></div>
<p>Un van peut aussi assurer une petite voiture. Coche Jour et Nuit si le chauffeur travaille dans les deux périodes.</p>
<div class="drivers-tools"><button type="button" id="driversSave">Enregistrer dans Mon Taxi</button><button type="button" id="driversEditCancel">Annuler</button><button type="button" id="driversPhoneEdit" hidden>Modifier dans le téléphone</button><button type="button" id="driversDelete" hidden>Supprimer</button></div></fieldset>
<div id="driversContent" hidden>
<div class="drivers-periods" role="group" aria-label="Période"><button type="button" data-period="all">Tous</button><button type="button" data-period="day">Jour</button><button type="button" data-period="night">Nuit</button></div>
<label>Rechercher<input id="driversSearch" type="search" placeholder="Nom ou téléphone"></label>
<div id="driversList"></div>
<fieldset id="driversSmsPanel" hidden><legend>SMS au chauffeur sélectionné</legend><label>Contenu<select id="driversMessageSource"><option value="free">Message libre / saisie rapide</option><option value="course">Course du Planning / réservation</option></select></label><select id="driversCourse" aria-label="Course" hidden></select><label>Message à vérifier et modifier<textarea id="driversMessage" rows="7"></textarea></label><p id="driversRecipient">Sélectionne un chauffeur dans la liste.</p><button type="button" id="driversSms">Ouvrir l’application SMS</button><p>L’envoi est à confirmer dans l’application SMS.</p></fieldset></div>`;
doc.body.append(dialog);
const css=doc.createElement('style');css.textContent=`
#taxiDrivers{box-sizing:border-box;width:min(680px,96vw);max-height:92dvh;overflow:auto;background:#111c30;color:#f5f7ff;border:1px solid #7196c4;border-radius:16px;padding:15px}
#taxiDrivers::backdrop{background:#000b}#taxiDrivers h2{margin:0;font-size:17px}
#taxiDrivers button{font:inherit;border:1px solid #7196c4;border-radius:9px;background:#203856;color:white;padding:10px;min-height:42px;cursor:pointer}
#taxiDrivers button[aria-pressed=true]{background:#1467b7}#taxiDrivers button:disabled{opacity:.6;cursor:default}
#taxiDrivers label{display:block;margin:10px 0}#taxiDrivers input:not([type=checkbox]),#taxiDrivers select,#taxiDrivers textarea{display:block;box-sizing:border-box;width:100%;font:inherit;background:#0b1424;color:#fff;border:1px solid #7196c4;border-radius:8px;padding:10px;margin-top:5px}
#taxiDrivers fieldset{min-width:0;border:1px solid #4c6485;border-radius:10px;margin-top:16px}
#taxiDrivers .drivers-heading,#taxiDrivers .drivers-tools,#taxiDrivers .drivers-tabs,#taxiDrivers .driver-actions,#taxiDrivers .drivers-periods{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
#taxiDrivers .drivers-heading{justify-content:space-between;gap:8px}#taxiDrivers .drivers-heading button{font-size:13px;padding:8px}
#taxiDrivers .drivers-tabs{flex-wrap:nowrap;margin:12px 0}#taxiDrivers .drivers-tabs button{flex:1;min-width:0;min-height:56px;font-weight:700}
#taxiDrivers .driver-row{padding:12px 0;border-bottom:1px solid #34435e;overflow-wrap:anywhere}
#taxiDrivers .driver-row strong,#taxiDrivers .driver-row small{display:block;margin-bottom:7px}#taxiDrivers small{color:#bed0e5}
#taxiDrivers .drivers-checks{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;font-size:13px}#taxiDrivers .drivers-checks span{flex:none;width:88px;color:#bed0e5;font-size:11px}
#taxiDrivers .drivers-checks label{display:inline-flex;align-items:center;gap:6px;min-height:32px;margin:0}
#taxiDrivers input[type=checkbox]{display:inline-block;appearance:auto;flex:none;width:19px;height:19px;min-height:0;padding:0;margin:0;accent-color:#338de6}
#taxiDrivers .drivers-management{margin:12px 0}#taxiDrivers summary{cursor:pointer;padding:8px 0;color:#bed0e5}#taxiDrivers .drivers-periods{margin-top:12px}
#driversTx{margin-top:12px;width:100%}#driversLastSync{display:block;margin-top:6px}#driversStatus{white-space:pre-line;margin:8px 0}
#openTaxiDrivers{position:static;grid-column:2 / 4;grid-row:2;justify-self:end;margin-left:auto;width:auto;padding:6px 10px!important;min-height:32px;font-size:12px!important;border:1px solid #7196c4;border-radius:9px;background:#142238;color:white}
#taxiDrivers [hidden]{display:none!important}`;doc.head.append(css);
const $=s=>dialog.querySelector('#'+s);
let active=null,period='all',editing=null,recipient=null,busy=false;
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
function render(){
 $('driversContent').hidden=!active;$('driversChoose').hidden=!!active;
 dialog.querySelectorAll('[data-category]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.category===active));const label=b.dataset.category==='van'?'Van':'Petite voiture';b.textContent=label+' · '+state.drivers.filter(d=>eligible(d,b.dataset.category)).length;});
 dialog.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
 $('driversLastSync').textContent=state.lastSyncedAt?'Dernière actualisation : '+new Date(state.lastSyncedAt).toLocaleString('fr-BE'):'';
 const list=$('driversList');list.replaceChildren();if(!active)return;
 const query=norm($('driversSearch').value).toLocaleLowerCase('fr');
 const rows=state.drivers.filter(d=>eligible(d,active,period)&&(!query||(d.name+' '+d.phone).toLocaleLowerCase('fr').includes(query)));
 for(const d of rows){
  const row=doc.createElement('div');row.className='driver-row';row.dataset.driverId=d.id;
  const name=doc.createElement('strong');name.textContent=d.name;const num=doc.createElement('small');
  num.textContent=d.phone+' · '+(d.category==='van'?'Van':'Petite voiture')+' · '+(d.availability.day&&d.availability.night?'Jour et nuit':d.availability.night?'Nuit':'Jour');
  const actions=doc.createElement('div');actions.className='driver-actions';actions.append(action('Appeler',()=>launch('tel:'+phone(d.phone))),action('SMS',()=>{recipient=d.id;updateRecipient();$('driversSmsPanel').hidden=false;$('driversMessage').focus();}),action('Modifier',()=>edit(d)));
  const services=checkboxGroup('Courses possibles');services.append(check('Petite voiture',d.acceptsCar,d.category==='car',value=>editOptions(d,{acceptsCar:value,manualServices:true})),check('Van',d.category==='van',true,()=>{}));
  const times=checkboxGroup('Disponibilité');times.append(check('Jour',d.availability.day,false,value=>editOptions(d,{availability:{...d.availability,day:value},manualAvailability:true})),check('Nuit',d.availability.night,false,value=>editOptions(d,{availability:{...d.availability,night:value},manualAvailability:true})));
  row.append(name,num,actions,services,times);list.append(row);
 }
 if(!rows.length){const p=doc.createElement('p');p.textContent='Aucun chauffeur pour ce véhicule et cette période.';list.append(p);}
}
function editorServices(){const van=$('driversCategory').value==='van';$('driversCarEligible').disabled=!van;if(!van)$('driversCarEligible').checked=true;$('driversVanEligible').checked=van;}
function edit(d){
 editing=d?.id||null;$('driversName').value=d?.name||'';$('driversPhone').value=d?.phone||'';$('driversCategory').value=d?.category||(active==='van'?'van':'car');
 $('driversCarEligible').checked=d?d.acceptsCar:$('driversCategory').value==='car';editorServices();
 const times=d?.availability||{day:true,night:false};$('driversDay').checked=times.day;$('driversNight').checked=times.night;
 $('driversDelete').hidden=!d;$('driversPhoneEdit').hidden=!d?.nativeId||!root.TaxiContacts;
 $('driversEditor').hidden=false;$('driversName').focus();
}
function updateRecipient(){const d=state.drivers.find(x=>x.id===recipient);$('driversRecipient').textContent=d?'Destinataire : '+d.name+' · '+d.phone:'Sélectionne un chauffeur dans la liste.';$('driversSms').disabled=!d;}
function launch(url){if(root.TaxiContacts)root.TaxiContacts.open(url);else root.location.href=url;}
function courses(){try{const raw=JSON.parse(localStorage.getItem('montaxi:hotel-commissions:courses-v1')||'[]');return Array.isArray(raw)?raw:[];}catch{status('Impossible de lire les courses enregistrées.');return [];}}
function refreshCourses(selected){const select=$('driversCourse');select.replaceChildren();const blank=doc.createElement('option');blank.value='';blank.textContent='Choisir une course';select.append(blank);for(const e of courses()){const o=doc.createElement('option');o.value=e.id;o.textContent=[e.scheduledDate||e.date,e.scheduledTime||e.recordedTime,e.pickup?.client||e.hotel,e.destination].filter(Boolean).join(' · ');select.append(o);}select.value=selected||'';}
function chooseCourse(){const e=courses().find(x=>String(x.id)===$('driversCourse').value);if(e)$('driversMessage').value=courseText(e);}
function setBusy(value){busy=value;$('driversTx').disabled=value;$('driversTx').setAttribute('aria-busy',String(value));$('driversTx').textContent=value?'Analyse du répertoire…':'↻ Actualiser le répertoire';}
function importContacts(items,source,fromPhone=false,fullScan=false){
 if(!Array.isArray(items)){status('Réponse des contacts invalide. Les fiches existantes sont conservées.');return;}
 const filtered=(source==='tx'||source==='sync')?items.filter(c=>!state.deletedNativeIds.includes(String(c.nativeId))):items;
 const result=merge(state.drivers,filtered,source,{fromPhone});
 if(source==='chosen'){for(const c of result.drivers)if(!state.drivers.some(x=>x.id===c.id)){c.category=active==='van'?'van':'car';c.acceptsCar=c.category==='car';c.manualCategory=true;}}
 const missing=fullScan?state.drivers.filter(d=>d.nativeId&&!items.some(c=>String(c.nativeId)===d.nativeId)).length:0;
 if(commit(result.drivers,state.deletedNativeIds,fromPhone?{lastSyncedAt:new Date().toISOString()}:{})){
  status(result.added+' ajouté(s), '+result.updated+' modifié(s), '+result.unchanged+' inchangé(s).'+(missing?' '+missing+' contact(s) introuvable(s), fiche(s) conservée(s).':'')+' Les choix véhicule et Jour/Nuit sont conservés.');
 }
}
root.addEventListener('taxi-contacts-result',event=>{
 const d=event.detail||{};if(['sync','tx','refresh'].includes(d.mode)||d.error)setBusy(false);
 if(d.error){status(d.error);return;}
 if(d.contacts&&d.mode==='refresh')importContacts(d.contacts,'sync',true);
 else if(d.contacts)importContacts(d.contacts,d.mode==='sync'?'sync':d.mode==='tx'?'tx':'chosen',d.mode==='sync'||d.mode==='tx',d.mode==='sync');
});
async function browserImport(sync){
 if(navigator.contacts?.select){try{const contacts=await navigator.contacts.select(['name','tel'],{multiple:true});importContacts(contacts.map(c=>({name:c.name?.[0],phone:c.tel?.[0]})),sync?'sync':'chosen',sync);}catch(e){status(e.name==='AbortError'?'Actualisation annulée.':'Accès aux contacts indisponible. Utilisez un fichier vCard.');}finally{setBusy(false);}return;}
 setBusy(false);
 const input=doc.createElement('input');input.type='file';input.accept='.vcf,text/vcard,text/x-vcard';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5000000)throw Error('Fichier trop volumineux (5 Mo maximum).');const contacts=parseVcard(await file.text());if(sync)importContacts(contacts,'sync',true);else{const chosen=contacts.filter(c=>confirm('Importer '+c.name+' ('+c.phone+') dans '+(active==='van'?'Van':'Petite voiture')+' ?'));importContacts(chosen,'chosen');}}catch(e){status(e.message||'Import impossible.');}};input.click();status('Dans Chrome, sélectionnez les contacts ou un fichier .vcf récent pour les actualiser. L’analyse complète du téléphone se fait dans l’application Android.');
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
 const record=normalizeDriver({...old,id:old?.id||id(),name,phone:number,category:cat,acceptsCar:$('driversCarEligible').checked,availability:times,source:old?.source||'manual',manualCategory:true,manualServices:true,manualAvailability:true,localName:old?.localName||!!old&&old.name!==name,localPhone:old?.localPhone||!!old&&old.phone!==number});
 if(commit(old?state.drivers.map(x=>x.id===old.id?record:x):[...state.drivers,record])){active=cat;period='all';$('driversEditor').hidden=true;render();status('Fiche enregistrée dans Mon Taxi.');}
};
$('driversDelete').onclick=()=>{const d=state.drivers.find(x=>x.id===editing);if(!d||!confirm('Supprimer '+d.name+' du répertoire Mon Taxi ? Le contact du téléphone est conservé.'))return;const deleted=d.nativeId?[...new Set([...state.deletedNativeIds,d.nativeId])]:state.deletedNativeIds;if(commit(state.drivers.filter(x=>x.id!==d.id),deleted)){$('driversEditor').hidden=true;status('Chauffeur supprimé de Mon Taxi.');}};
$('driversPhoneEdit').onclick=()=>{const d=state.drivers.find(x=>x.id===editing);if(d?.nativeId&&root.TaxiContacts)root.TaxiContacts.edit(d.nativeId);};
$('driversSearch').oninput=render;
dialog.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{active=b.dataset.category;$('driversSearch').value='';$('driversEditor').hidden=true;render();});
dialog.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;render();});
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
$('driversMessageSource').onchange=()=>{const use=$('driversMessageSource').value==='course';$('driversCourse').hidden=!use;if(use)refreshCourses();};$('driversCourse').onchange=chooseCourse;
$('driversSms').onclick=()=>{const d=state.drivers.find(x=>x.id===recipient);if(!d||!validPhone(d.phone))return;if(!$('driversMessage').value.trim()){status('Saisissez ou choisissez le message à envoyer.');return;}launch('sms:'+phone(d.phone)+'?body='+encodeURIComponent($('driversMessage').value));};
$('driversExport').onclick=()=>{const raw=localStorage.getItem(KEY)||JSON.stringify(state);const a=doc.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download='mon-taxi-chauffeurs-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
root.openTaxiDrivers=function(course){
 active=null;period='all';$('driversSearch').value='';$('driversEditor').hidden=true;$('driversSmsPanel').hidden=true;
 if(!dialog.open)dialog.showModal();render();updateRecipient();if(readError)status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');
 if(course){$('driversMessageSource').value='course';$('driversCourse').hidden=false;refreshCourses(String(course.id));$('driversMessage').value=courseText(course);status('Choisis le véhicule, puis le chauffeur pour envoyer cette course.');}
};
root.addEventListener('storage',event=>{if(event.key!==KEY)return;try{state=readState();readError=false;render();updateRecipient();}catch{readError=true;status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');}});
const open=action('Répertoire',()=>root.openTaxiDrivers());open.id='openTaxiDrivers';open.setAttribute('aria-label','Ouvrir le répertoire chauffeurs');(doc.querySelector('.taxi-header')||doc.querySelector('main'))?.append(open);
})(typeof window!=='undefined'?window:globalThis);
