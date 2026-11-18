(function(root){
'use strict';
const KEY='montaxi:driver-directory:v1';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const phone=s=>String(s||'').trim().replace(/[\s().-]/g,'');
const validPhone=s=>/^\+?[0-9]{3,20}$/.test(phone(s));
const category=name=>/^TX\s*Van\b/i.test(norm(name))?'van':'car';
const isTx=name=>/^TX/i.test(norm(name));
const id=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
function merge(existing,incoming,source){
 const result=existing.map(x=>({...x}));let added=0,updated=0;
 for(const c of incoming){
  if(!norm(c.name)||!validPhone(c.phone)||(source==='tx'&&!isTx(c.name)))continue;
  const nativeId=c.nativeId?String(c.nativeId):'';
  // Phone numbers are not identity: two people may share a number.
  let old=nativeId?result.find(x=>x.nativeId===nativeId):result.find(x=>!x.nativeId&&norm(x.name).toLocaleLowerCase('fr')===norm(c.name).toLocaleLowerCase('fr')&&phone(x.phone)===phone(c.phone));
  if(old){
   // Preserve edits made in Mon Taxi until the user requests a phone refresh.
   if(!old.localName)old.name=norm(c.name);
   if(!old.localPhone)old.phone=phone(c.phone);
   if(!old.manualCategory)old.category=category(c.name);
   updated++;
  }else{result.push({id:id(),name:norm(c.name),phone:phone(c.phone),nativeId,category:category(c.name),source,manualCategory:source!=='tx'});added++;}
 }
 return {drivers:result,added,updated};
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
function courseText(e){
 const p=e.pickup||{};
 return [
  [e.scheduledDate||e.date,e.scheduledTime||e.recordedTime].filter(Boolean).join(' à '),
  [p.place||e.hotel,e.destination==='Autre'?(e.otherDestination||e.destination):e.destination].filter(Boolean).join(' → '),
  p.timeMode==='arrival'?'Suivi vol / train':'',
  p.client&&'Client : '+p.client,p.phone&&'Téléphone : '+p.phone,
  p.flight&&'Vol/train : '+p.flight,p.arrival&&'Arrivée : '+p.arrival,
  (e.carCount||e.vanCount)?[e.carCount&&e.carCount+' petite(s) voiture(s)',e.vanCount&&e.vanCount+' van(s)'].filter(Boolean).join(' · '):e.vehicle,
  p.passengers&&'Passagers : '+p.passengers,p.luggage&&'Bagages : '+p.luggage,
  e.announcedPrice!=null&&e.announcedPrice!==''?'Prix annoncé : '+e.announcedPrice+' €':'',e.note&&'Remarques : '+e.note
 ].filter(Boolean).join('\n');
}
const core={merge,parseVcard,courseText,phone,validPhone,category,isTx};
if(typeof module==='object'&&module.exports){module.exports=core;return;}
root.TaxiDriverDirectoryCore=core;
const doc=root.document;
let state,readError=false;
try{const raw=localStorage.getItem(KEY);state=raw?JSON.parse(raw):{version:1,drivers:[],deletedNativeIds:[]};if(!Array.isArray(state.drivers)||!state.drivers.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.phone==='string'))throw Error('Format');}catch{readError=true;state={version:1,drivers:[],deletedNativeIds:[]};}
state.deletedNativeIds=state.deletedNativeIds||[];
const dialog=doc.createElement('dialog');dialog.id='taxiDrivers';dialog.innerHTML=`<div class="drivers-heading"><h2>Chauffeurs</h2><button type="button" data-close>✕ Fermer</button></div>
<div class="drivers-tabs"><button type="button" data-category="car">Petite voiture</button><button type="button" data-category="van">Van</button></div>
<label>Rechercher<input id="driversSearch" type="search" placeholder="Nom ou téléphone"></label>
<div class="drivers-tools"><button type="button" id="driversTx">Importer / actualiser les TX</button><button type="button" id="driversPick">Importer un chauffeur</button><button type="button" id="driversAdd">+ Ajouter manuellement</button><button type="button" id="driversExport">Sauvegarder le répertoire</button></div>
<p id="driversStatus" role="status"></p><div id="driversList"></div>
<fieldset id="driversEditor" hidden><legend>Fiche chauffeur</legend><label>Nom<input id="driversName" autocomplete="off"></label><label>Téléphone<input id="driversPhone" type="tel" autocomplete="off"></label><label>Véhicule<select id="driversCategory"><option value="car">Petite voiture</option><option value="van">Van</option></select></label><button type="button" id="driversSave">Enregistrer dans Mon Taxi</button><button type="button" id="driversEditCancel">Annuler</button></fieldset>
<fieldset><legend>SMS au chauffeur sélectionné</legend><label>Contenu<select id="driversMessageSource"><option value="free">Message libre / saisie rapide</option><option value="course">Course du Planning / réservation</option></select></label><select id="driversCourse" aria-label="Course" hidden></select><label>Message à vérifier et modifier<textarea id="driversMessage" rows="7"></textarea></label><p id="driversRecipient">Sélectionne un chauffeur dans la liste.</p><button type="button" id="driversSms">Ouvrir l’application SMS</button><p>L’envoi est à confirmer dans l’application SMS.</p></fieldset>`;
doc.body.append(dialog);
const css=doc.createElement('style');css.textContent=`#taxiDrivers{box-sizing:border-box;width:min(680px,96vw);max-height:92dvh;overflow:auto;background:#111c30;color:#f5f7ff;border:1px solid #7196c4;border-radius:16px;padding:15px}#taxiDrivers::backdrop{background:#000b}#taxiDrivers h2{margin:0}#taxiDrivers button{font:inherit;border:1px solid #7196c4;border-radius:9px;background:#203856;color:white;padding:10px;min-height:42px;cursor:pointer}#taxiDrivers button[aria-pressed=true]{background:#1467b7}#taxiDrivers label{display:block;margin:10px 0}#taxiDrivers input,#taxiDrivers select,#taxiDrivers textarea{display:block;box-sizing:border-box;width:100%;font:inherit;background:#0b1424;color:#fff;border:1px solid #7196c4;border-radius:8px;padding:10px;margin-top:5px}#taxiDrivers fieldset{min-width:0;border:1px solid #4c6485;border-radius:10px;margin-top:16px}#taxiDrivers .drivers-heading,#taxiDrivers .drivers-tools,#taxiDrivers .drivers-tabs,#taxiDrivers .driver-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}#taxiDrivers .drivers-heading{justify-content:space-between}#taxiDrivers .driver-row{padding:12px 0;border-bottom:1px solid #34435e;overflow-wrap:anywhere}#taxiDrivers .driver-row strong,#taxiDrivers .driver-row small{display:block;margin-bottom:7px}#taxiDrivers .driver-row small{color:#bed0e5}#driversStatus{white-space:pre-line}#openTaxiDrivers{position:static;grid-column:2 / 4;grid-row:2;justify-self:end;margin-left:auto;width:auto;padding:6px 10px!important;min-height:32px;font-size:12px!important;border:1px solid #7196c4;border-radius:9px;background:#142238;color:white}#taxiDrivers [hidden]{display:none!important}`;doc.head.append(css);
const $=s=>dialog.querySelector('#'+s);
let active='car',editing=null,recipient=null;
const status=t=>{$('driversStatus').textContent=t;};
function save(){if(readError){status('Le répertoire enregistré est illisible. Exportez une sauvegarde avant toute réparation.');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{status('Enregistrement impossible : espace de stockage indisponible.');return false;}}
function commit(drivers,deleted=state.deletedNativeIds){const old=state;state={version:1,drivers,deletedNativeIds:deleted};if(!save()){state=old;return false;}render();return true;}
function action(label,fn){const b=doc.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function render(){
 dialog.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===active)));
 const list=$('driversList');list.replaceChildren();const query=norm($('driversSearch').value).toLocaleLowerCase('fr');
 const rows=state.drivers.filter(d=>d.category===active&&(!query||(d.name+' '+d.phone).toLocaleLowerCase('fr').includes(query)));
 for(const d of rows){const row=doc.createElement('div');row.className='driver-row';const name=doc.createElement('strong');name.textContent=d.name;const num=doc.createElement('small');num.textContent=d.phone+(d.nativeId?' · Contact téléphone':' · Mon Taxi');const actions=doc.createElement('div');actions.className='driver-actions';actions.append(action('Appeler',()=>launch('tel:'+phone(d.phone))),action('SMS',()=>{recipient=d.id;updateRecipient();$('driversMessage').focus();}),action('Modifier',()=>edit(d)),action('Supprimer',()=>{if(!confirm('Supprimer '+d.name+' du répertoire Mon Taxi ? Le contact du téléphone est conservé.'))return;const deleted=d.nativeId?[...new Set([...state.deletedNativeIds,d.nativeId])]:state.deletedNativeIds;if(commit(state.drivers.filter(x=>x.id!==d.id),deleted)&&recipient===d.id){recipient=null;updateRecipient();}}));
 if(d.nativeId&&root.TaxiContacts)actions.append(action('Modifier dans le téléphone',()=>{if(confirm('Ouvrir le contact téléphone pour modifier son nom ou son numéro ? Pour récupérer ces changements, utilisez ensuite « Reprendre le contact téléphone ».'))root.TaxiContacts.edit(d.nativeId);}));
 if(d.nativeId&&root.TaxiContacts)actions.append(action('Reprendre le contact téléphone',()=>{if(!confirm('Remplacer les modifications locales du nom et du numéro par celles du téléphone ? La catégorie est conservée.'))return;root.TaxiContacts.refresh(d.nativeId);}));
 row.append(name,num,actions);list.append(row);}
 if(!rows.length){const p=doc.createElement('p');p.textContent='Aucun chauffeur dans cette catégorie.';list.append(p);}
}
function edit(d){editing=d?.id||null;$('driversName').value=d?.name||'';$('driversPhone').value=d?.phone||'';$('driversCategory').value=d?.category||active;$('driversEditor').hidden=false;$('driversName').focus();}
function updateRecipient(){const d=state.drivers.find(x=>x.id===recipient);$('driversRecipient').textContent=d?'Destinataire : '+d.name+' · '+d.phone:'Sélectionne un chauffeur dans la liste.';$('driversSms').disabled=!d;}
function launch(url){if(root.TaxiContacts)root.TaxiContacts.open(url);else root.location.href=url;}
function courses(){try{const raw=JSON.parse(localStorage.getItem('montaxi:hotel-commissions:courses-v1')||'[]');return Array.isArray(raw)?raw:[];}catch{status('Impossible de lire les courses enregistrées.');return [];}}
function refreshCourses(selected){const select=$('driversCourse');select.replaceChildren();const blank=doc.createElement('option');blank.value='';blank.textContent='Choisir une course';select.append(blank);for(const e of courses()){const o=doc.createElement('option');o.value=e.id;o.textContent=[e.scheduledDate||e.date,e.scheduledTime||e.recordedTime,e.pickup?.client||e.hotel,e.destination].filter(Boolean).join(' · ');select.append(o);}select.value=selected||'';}
function chooseCourse(){const e=courses().find(x=>String(x.id)===$('driversCourse').value);if(e)$('driversMessage').value=courseText(e);}
function importContacts(items,source){
 const filtered=source==='tx'?items.filter(c=>!state.deletedNativeIds.includes(String(c.nativeId))):items;
 const result=merge(state.drivers,filtered,source);
 if(source==='chosen'){for(const c of result.drivers)if(!state.drivers.some(x=>x.id===c.id)){c.category=active;c.manualCategory=true;}}
 if(commit(result.drivers)){status(result.added+' chauffeur(s) ajouté(s), '+result.updated+' actualisé(s). Les modifications locales et les catégories choisies sont conservées.');}
}
root.addEventListener('taxi-contacts-result',event=>{const d=event.detail||{};if(d.error){status(d.error);return;}if(d.contacts&&d.mode==='refresh'){
 const items=d.contacts;const prior=state.drivers.map(x=>items.some(c=>String(c.nativeId)===x.nativeId)?{...x,localName:false,localPhone:false}:x);const merged=merge(prior,items,'chosen');if(commit(merged.drivers))status('Nom et numéro repris du contact téléphone.');
 }else if(d.contacts)importContacts(d.contacts,d.mode==='tx'?'tx':'chosen');});
async function browserImport(tx){
 if(navigator.contacts?.select){try{const contacts=await navigator.contacts.select(['name','tel'],{multiple:true});importContacts(contacts.map(c=>({name:c.name?.[0],phone:c.tel?.[0]})),tx?'tx':'chosen');}catch(e){status(e.name==='AbortError'?'Import annulé.':'Accès aux contacts indisponible. Utilisez un fichier vCard.');}return;}
 const input=doc.createElement('input');input.type='file';input.accept='.vcf,text/vcard,text/x-vcard';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5000000)throw Error('Fichier trop volumineux (5 Mo maximum).');const contacts=parseVcard(await file.text());if(tx)importContacts(contacts,'tx');else{const chosen=contacts.filter(c=>confirm('Importer '+c.name+' ('+c.phone+') dans '+(active==='van'?'Van':'Petite voiture')+' ?'));importContacts(chosen,'chosen');}}catch(e){status(e.message||'Import impossible.');}};input.click();status('Dans Chrome, choisissez un fichier de contacts .vcf exporté depuis votre téléphone.');
}
$('driversTx').onclick=()=>{if(root.TaxiContacts)root.TaxiContacts.importTx();else browserImport(true);};
$('driversPick').onclick=()=>{if(root.TaxiContacts)root.TaxiContacts.pick();else browserImport(false);};
$('driversAdd').onclick=()=>edit(null);$('driversEditCancel').onclick=()=>{$('driversEditor').hidden=true;};
$('driversSave').onclick=()=>{const name=norm($('driversName').value),number=phone($('driversPhone').value),cat=$('driversCategory').value;if(!name||!validPhone(number)){status('Saisissez un nom et un numéro de téléphone valide.');return;}
 const old=state.drivers.find(x=>x.id===editing);if(state.drivers.some(x=>x.id!==editing&&phone(x.phone)===number)&&!confirm('Ce numéro existe déjà. Ajouter / conserver une autre fiche avec ce numéro ?'))return;
 const record={...old,id:old?.id||id(),name,phone:number,category:cat,source:old?.source||'manual',manualCategory:true,localName:old?.localName||!!old&&old.name!==name,localPhone:old?.localPhone||!!old&&old.phone!==number};
 if(commit(old?state.drivers.map(x=>x.id===old.id?record:x):[...state.drivers,record])){active=cat;$('driversEditor').hidden=true;render();updateRecipient();status('Fiche enregistrée dans Mon Taxi.');}};
$('driversSearch').oninput=render;dialog.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{active=b.dataset.category;render();});
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
$('driversMessageSource').onchange=()=>{const use=$('driversMessageSource').value==='course';$('driversCourse').hidden=!use;if(use)refreshCourses();};$('driversCourse').onchange=chooseCourse;
$('driversSms').onclick=()=>{const d=state.drivers.find(x=>x.id===recipient);if(!d||!validPhone(d.phone))return;if(!$('driversMessage').value.trim()){status('Saisissez ou choisissez le message à envoyer.');return;}launch('sms:'+phone(d.phone)+'?body='+encodeURIComponent($('driversMessage').value));};
$('driversExport').onclick=()=>{const raw=localStorage.getItem(KEY)||JSON.stringify(state);const a=doc.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download='mon-taxi-chauffeurs-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
root.openTaxiDrivers=function(course){if(!dialog.open)dialog.showModal();render();updateRecipient();if(readError)status('Le répertoire enregistré est illisible : sauvegardez-le avant réparation.');if(course){$('driversMessageSource').value='course';$('driversCourse').hidden=false;refreshCourses(String(course.id));$('driversMessage').value=courseText(course);}};
const open=action('Chauffeurs',()=>root.openTaxiDrivers());open.id='openTaxiDrivers';open.setAttribute('aria-label','Ouvrir le répertoire chauffeurs');(doc.querySelector('.taxi-header')||doc.querySelector('main'))?.append(open);
})(typeof window!=='undefined'?window:globalThis);
