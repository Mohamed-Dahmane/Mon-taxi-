const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const KEY='montaxi:driver-directory:v1';
const code=fs.readFileSync(__dirname+'/driver-directory.js','utf8');
const names=page=>page.locator('#driversList .driver-row');
const select=async(page,name)=>page.locator('#driversList .driver-name').filter({hasText:name}).click();
const back=async page=>page.click('#driversBack');
const details=page=>page.locator('#driversDetails');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:360,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://taxi.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><head></head><body><main></main></body></html>'}));
 await page.addInitScript(()=>{window.nativeCalls=[];window.TaxiContacts={sync:ids=>window.nativeCalls.push({type:'sync',ids:JSON.parse(ids)}),pick:()=>{},edit:()=>{},open:url=>window.nativeCalls.push({type:'open',url,directoryClosed:!document.querySelector('#taxiDrivers').open})};});
 await page.goto('http://taxi.test/');
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:1,drivers:[
  {id:'car',nativeId:'1',name:'TX Alexis',phone:'0470112233',category:'car',localPhone:true},
  {id:'van',nativeId:'2',name:'TX Van Nuit Hassan',phone:'0470223344',category:'van',priority:4},
  {id:'chosen',nativeId:'3',name:'Karim',phone:'0470334455',category:'car',source:'chosen'}
 ],deletedNativeIds:[]})),KEY);
 await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 assert.equal(await page.locator('#driversContent').isVisible(),false);
 await page.click('[data-category="car"]');assert.equal(await names(page).count(),2);
 assert.equal(await page.getByRole('button',{name:'Appeler',exact:true}).count(),0);
 assert.equal(await names(page).locator('input,small').count(),0);
 await select(page,'Alexis');
 assert.equal(await details(page).getByRole('checkbox',{name:'Van',exact:true}).isDisabled(),true);
 assert.equal(await details(page).getByRole('checkbox',{name:'Van',exact:true}).isChecked(),false);await back(page);
 await page.click('[data-category="van"]');assert.equal(await names(page).count(),1);await select(page,'Hassan');
 await details(page).getByRole('checkbox',{name:'Petite voiture',exact:true}).check();
 await details(page).getByRole('checkbox',{name:'Jour',exact:true}).check();
 assert.equal(await details(page).getByRole('checkbox',{name:'Nuit',exact:true}).isChecked(),true);await back(page);
 await page.click('[data-category="car"]');assert.equal(await names(page).count(),3);
 await page.click('[data-period="night"]');assert.equal(await names(page).count(),1);
 await page.click('[data-period="day"]');assert.equal(await names(page).count(),3);
 await page.click('#driversTx');assert.equal(await page.locator('#driversTx').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>nativeCalls.filter(x=>x.type==='sync')[0].ids.sort()),['1','2','3']);
 const incoming=[{nativeId:'1',name:'TX Alexis actualisé',phone:'0470998877'},{nativeId:'2',name:'TX Van Hassan renommé',phone:'0470887766'},{nativeId:'3',name:'Karim nouveau',phone:'0470776655'},{nativeId:'4',name:'TX Nuit Van Nouveau',phone:'0470665544'},{nativeId:'99',name:'Autre contact privé',phone:'0470554433'}];
 const respond=detail=>page.evaluate(d=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:d})),detail);
 await respond({mode:'sync',contacts:incoming});assert.equal(await page.locator('#driversTx').isDisabled(),false);assert.match(await page.locator('#driversStatus').innerText(),/1 ajouté\(s\), 3 modifié\(s\)/);
 await select(page,'Alexis actualisé');assert.match(await details(page).innerText(),/0470998877/);await back(page);
 await select(page,'Karim nouveau');assert.match(await details(page).innerText(),/0470776655/);await back(page);
 await select(page,'Hassan renommé');for(const name of ['Petite voiture','Van','Jour','Nuit'])assert.equal(await details(page).getByRole('checkbox',{name,exact:true}).isChecked(),true);await back(page);
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.match(await page.locator('#driversStatus').innerText(),/0 ajouté\(s\), 0 modifié\(s\)/);
 await page.click('#driversTx');await respond({mode:'sync',error:'Accès aux contacts refusé. Les fiches sont conservées.'});assert.equal(await page.locator('#driversTx').isDisabled(),false);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drivers.length,KEY),4);
 await page.click('[data-category="van"]');await page.click('[data-period="all"]');assert.equal(await names(page).count(),2);
 await select(page,'Nouveau');page.once('dialog',d=>d.accept());await details(page).getByRole('button',{name:'Supprimer',exact:true}).click();
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.equal(await names(page).count(),1);
 const sample={id:'course1',date:'2026-11-19',hotel:'DoubleTree',destination:'BRU',room:'418',announcedPrice:80,clientName:'Mme Dupont',clientPhone:'+32470123456',note:'Bonjour Émilie'};
 await page.evaluate(course=>openTaxiDrivers(course),sample);assert.equal(await page.locator('#driversContent').isVisible(),true);await page.click('[data-category="car"]');await select(page,'Hassan renommé');
 await details(page).getByRole('button',{name:'SMS',exact:true}).click();const message=await page.inputValue('#driversMessage');
 assert.match(message,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(message,/Chambre : 418/);assert.match(message,/19\/11\/2026/);assert.match(message,/Client : Mme Dupont/);assert.match(message,/Téléphone : \+32470123456/);
 assert.equal(await page.locator('#driversPriceAlert strong').evaluate(el=>Number(getComputedStyle(el).fontWeight)>=600),true);
 await page.click('#driversSms');const sms=await page.evaluate(()=>nativeCalls.filter(x=>x.type==='open').at(-1));assert.ok(sms.url.startsWith('sms:0470887766?body='));assert.match(decodeURIComponent(sms.url),/ATTENTION — PRIX FIXÉ : 80,00\s€/);assert.equal(sms.directoryClosed,true);
 await page.evaluate(()=>openTaxiDrivers());await page.click('[data-category="car"]');await select(page,'Hassan renommé');await details(page).getByRole('button',{name:'Appeler',exact:true}).click();assert.equal(await page.evaluate(()=>nativeCalls.at(-1).url),'tel:0470887766');
 assert.equal(await page.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await page.reload();await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');await page.click('[data-category="car"]');await page.click('[data-period="night"]');assert.equal(await names(page).count(),1);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(saved.version,2);assert.equal(saved.drivers.find(d=>d.id==='van').priority,4);assert.ok(saved.lastSyncedAt);
 await respond({mode:'sync',contacts:[{nativeId:'51',name:'TX Yacine',phone:'0470111122'},{nativeId:'52',name:'TX Van Yassine Bekay',phone:'0470111133'},{nativeId:'53',name:'TX Farid Yassine',phone:'0470111144'}]});
 await page.click('[data-category="car"]');await page.click('[data-period="all"]');await page.fill('#driversSearch','y');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['Yacine','Farid Yassine']);
 await select(page,'Yacine');await back(page);assert.equal(await page.inputValue('#driversSearch'),'y');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['Yacine','Farid Yassine']);
 await page.click('[data-category="van"]');await page.fill('#driversSearch','Y A');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['Yassine Bekay']);await page.fill('#driversSearch','Bekay');assert.equal(await names(page).count(),1);assert.deepEqual(errors,[]);
 // The real app stylesheet, copied course, optional client forms and home return.
 const integrated=await browser.newPage({viewport:{width:360,height:780}});
 await integrated.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://taxi-app.test')return r.abort();const path=u.pathname==='/'?'index.html':u.pathname.slice(1);if(path.includes('..'))return r.abort();const target=__dirname+'/'+path;if(!fs.existsSync(target))return r.fulfill({status:404,body:''});return r.fulfill({contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(target)});});
 await integrated.goto('http://taxi-app.test/');await integrated.waitForFunction(()=>typeof window.openTaxiDrivers==='function');
 await integrated.evaluate(()=>{document.body.classList.remove('taxi-intro-pending','taxi-opening','taxi-entering');document.querySelector('main').hidden=false;document.querySelectorAll('.taxi-access,.taxi-splash').forEach(e=>e.remove());window.externalActions=[];window.TaxiContacts={open:url=>externalActions.push({url,home:document.querySelector('#home').classList.contains('active'),directoryClosed:!document.querySelector('#taxiDrivers').open,planningClosed:!document.querySelector('#hotelCommissionsDialog').open})};});
 await integrated.click('#openTaxiDrivers');await integrated.click('[data-category="van"]');await integrated.locator('.drivers-management summary').click();await integrated.click('#driversAdd');
 await integrated.fill('#driversName','Test intégré');await integrated.fill('#driversPhone','0470123456');await integrated.check('#driversCarEligible');await integrated.check('#driversNight');await integrated.click('#driversSave');await back(integrated);
 assert.equal(await names(integrated).count(),1);assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await integrated.click('[data-category="car"]');await integrated.click('[data-period="night"]');assert.equal(await names(integrated).count(),1);await integrated.locator('#taxiDrivers [data-close]').click();
 const driversRect=await integrated.locator('#openTaxiDrivers').boundingBox();const planningRect=await integrated.locator('.hotel-home-actions').boundingBox();assert.ok(driversRect.y+driversRect.height<=planningRect.y);
 await integrated.evaluate(()=>document.querySelector('.pageBtn[data-page="details"]').click());await integrated.click('#openHotelPlanning');await integrated.waitForFunction(()=>!!document.querySelector('#hotelCommissionsFrame')?.contentDocument?.querySelector('#reservationBoardTitle'));
 const frame=await (await integrated.$('#hotelCommissionsFrame')).contentFrame();
 const copied=await frame.evaluate(async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedCourse=text;}}});
  await copyCourse({bookingMode:'Programmée',scheduledDate:'2026-11-20',scheduledTime:'05:15',hotel:'DoubleTree',destination:'Zaventem',room:'0123',passengers:4,clientName:'Mme Dupont',clientPhone:'+32470123456',announcedPrice:74.79,amount:10,vehicle:'Van',driver:'self'});return window.__copiedCourse;
 });
 assert.match(copied,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(copied,/Chambre : 0123/);assert.match(copied,/20\/11\/2026 à 05:15/);assert.match(copied,/^ATTENTION — PRIX FIXÉ : 74,79\s€/);assert.match(copied,/Client : Mme Dupont\nTéléphone : \+32470123456/);assert.doesNotMatch(copied,/10,00/);assert.match(copied,/Passagers : 4/);
 const pickupCopied=await frame.evaluate(async()=>{await copyCourse({bookingMode:'Direct',date:'2026-11-20',recordedTime:'05:15',hotel:'Standard',destination:'Hôtel',room:'7A',vehicle:'Van',driver:'self',pickup:{place:'Charleroi Airport (CRL)',client:'Client existant',phone:'0470000000'}});return window.__copiedCourse;});
 assert.match(pickupCopied,/Pick-up · Airport CRL \(Charleroi\) → Hôtel/);assert.match(pickupCopied,/Chambre : 7A/);assert.match(pickupCopied,/Client : Client existant/);assert.doesNotMatch(pickupCopied,/PRIX FIXÉ/);
 const direct=await frame.evaluate(()=>{
  const initial=data.length;setDriverChoice('direct','self');$('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Petite voiture',false);selected=10;
  $('room').value='0240';$('directClientName').value='Mme Test';$('directClientPhone').value='+32470000000';$('directPassengers').value='4';$('add').onclick();
  const first=data.at(-1);const count=data.length-initial;const cleared=$('directClientName').value===''&&$('directClientPhone').value==='';
  $('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Petite voiture',false);selected=10;$('add').onclick();
  return {count,first,second:data.at(-1),cleared,total:data.length-initial,error:$('message').textContent};
 });
 assert.equal(direct.count,1,direct.error);assert.equal(direct.first.clientName,'Mme Test');assert.equal(direct.first.clientPhone,'+32470000000');assert.equal(direct.first.passengers,4);assert.equal(direct.cleared,true);assert.equal(direct.total,2);assert.equal(direct.second.clientName,'');assert.equal(direct.second.clientPhone,'');assert.equal(direct.second.passengers,null);
 const reservation=await frame.evaluate(()=>{
  const today=reservationClock().slice(0,10);const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10);
  const original={id:'optional-client-reservation',reservationBoard:true,hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',bookingMode:'Programmée',reservationStatus:'pending',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',vehicle:'Petite voiture',vehicleChoice:'Petite voiture',carCount:1,vanCount:0,destination:'Zaventem',amount:10,pricing:'Compteur',announcedPrice:null,room:'240',clientName:'Nom initial',clientPhone:'0470000000',passengers:3};
  data.push(original);showReservationForm(original,false);const loaded={name:$('reservationClientName').value,phone:$('reservationClientPhone').value};showReservationStep(reservationSaveStep);
  $('reservationClientName').value='Nom modifié';$('reservationClientPhone').value='+32470000001';$('reservationPassengers').value='5';$('reservationForm').onsubmit({preventDefault(){}});
  const edited=data.find(e=>e.id===original.id);showReservationForm(edited,false);showReservationStep(reservationSaveStep);$('reservationClientName').value='';$('reservationClientPhone').value='';$('reservationPassengers').value='';$('reservationForm').onsubmit({preventDefault(){}});
  return {loaded,edited,cleared:data.find(e=>e.id===original.id),error:$('reservationMessage').textContent};
 });
 assert.equal(reservation.loaded.name,'Nom initial');assert.equal(reservation.edited.clientName,'Nom modifié',reservation.error);assert.equal(reservation.edited.clientPhone,'+32470000001');assert.equal(reservation.cleared.clientName,'');assert.equal(reservation.cleared.clientPhone,'');assert.equal(reservation.edited.passengers,5);assert.equal(reservation.cleared.passengers,null);
 // The real pick-up save handler must also accept blank client fields.
 await integrated.evaluate(()=>{window.pickupSaved=[];openHotelPickup({mode:'Réservation',today:'2026-11-20',hotels:['Test Hôtel'],contacts:{'Test Hôtel':['Contact']},drivers:[],save:form=>{pickupSaved.push(form);return 'Validation du test';}});});
 await integrated.waitForFunction(()=>!!document.querySelector('#hotelPickupFrame')?.contentDocument?.querySelector('#client'));
 const pickupFrame=await (await integrated.$('#hotelPickupFrame')).contentFrame();
 const pickupOptional=await pickupFrame.evaluate(()=>{
  window.alert=message=>{throw Error(message)};window.confirm=()=>true;
  $('date').value='2026-11-20';$('timeMode').value='fixed';$('time').value='05:15';$('hotelSearch').value='Test Hôtel';$('contactSearch').value='Contact';$('driverSearch').value='Moi';$('flight').value='SN123';$('vans').value='1';$('passengers').value='1';$('commissionUnit').value='10';$('client').value='';$('phone').value='';
  const optional=!$('client').required&&!$('phone').required;$('save').onclick();return optional;
 });
 assert.equal(pickupOptional,true);const pickupSaved=await integrated.evaluate(()=>pickupSaved);assert.equal(pickupSaved.length,1);assert.equal(pickupSaved[0].client,'');assert.equal(pickupSaved[0].phone,'');await integrated.evaluate(()=>document.getElementById('closeHotelPickup').click());
 await integrated.evaluate(()=>openTaxiDrivers({id:'planning',date:'2026-11-20',hotel:'Standard',destination:'CRL',clientName:'Mme Test',clientPhone:'0470000000'}));
 await integrated.click('[data-category="car"]');await select(integrated,'Test intégré');await details(integrated).getByRole('button',{name:'SMS',exact:true}).click();assert.match(await integrated.inputValue('#driversMessage'),/Standard → Airport CRL \(Charleroi\)/);assert.match(await integrated.inputValue('#driversMessage'),/Client : Mme Test/);
 await integrated.click('#driversSms');const sent=await integrated.evaluate(()=>externalActions.at(-1));assert.equal(sent.home,true);assert.equal(sent.directoryClosed,true);assert.equal(sent.planningClosed,true);assert.ok(sent.url.startsWith('sms:'));
 // Course-linked calls, vehicle filtering, last-driver confirmation and the reverse import path.
 await integrated.evaluate(()=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:{mode:'sync',contacts:[{nativeId:'81',name:'TX Petit test',phone:'0470101010'},{nativeId:'82',name:'TX Van uniquement',phone:'0470202020'}]}})));
 const linked=await frame.evaluate(()=>{
  const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10),today=reservationClock().slice(0,10);
  const base={bookingMode:'Programmée',reservationBoard:true,reservationStatus:'pending',hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',room:'204',clientName:'Client lié',clientPhone:'+32470000011',passengers:5,amount:10,announcedPrice:90,pricing:'Forfait'};
  const van={...base,id:'linked-van',vehicle:'Van',vehicleChoice:'Van',carCount:0,vanCount:1};const car={...base,id:'linked-car',vehicle:'Petite voiture',vehicleChoice:'Petite voiture',carCount:1,vanCount:0,destination:'Zaventem'};van.destination='Charleroi';data.push(van,car);save();return {van,car};
 });
 await integrated.evaluate(()=>openHotelModule('planning'));
 const vanRow=frame.locator('.reservation-card[data-entry-id="linked-van"]');await vanRow.getByRole('button',{name:'Répertoire',exact:true}).click();
 assert.equal(await integrated.locator('[data-category="car"]').isVisible(),false);assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','uniquement']);
 await select(integrated,'Test intégré');await details(integrated).getByRole('button',{name:'Appeler',exact:true}).click();
 const leaveAndReturn=()=>integrated.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await leaveAndReturn();await integrated.waitForFunction(()=>document.querySelector('#hotelCommissionsDialog').open&&!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver').waitFor();assert.match(await vanRow.locator('.last-called-driver strong').innerText(),/Test intégré/);
 await vanRow.getByRole('button',{name:'Chauffeur suivant',exact:true}).click();assert.match(await details(integrated).locator('h3').innerText(),/uniquement/);await details(integrated).getByRole('button',{name:'Appeler',exact:true}).click();
 await leaveAndReturn();await integrated.waitForFunction(()=>!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver strong').filter({hasText:'uniquement'}).waitFor();await vanRow.getByRole('button',{name:'J’envoie',exact:true}).click();
 const linkedSms=await integrated.evaluate(()=>externalActions.at(-1));assert.ok(linkedSms.url.startsWith('sms:0470202020?body='));const linkedText=decodeURIComponent(linkedSms.url);for(const value of ['Airport CRL (Charleroi)','Chambre : 204','Client : Client lié','Téléphone : +32470000011','Passagers : 5','PRIX FIXÉ : 90,00'])assert.ok(linkedText.includes(value),value);assert.equal(linkedSms.home,true);assert.equal(linkedSms.planningClosed,true);
 await integrated.evaluate(course=>openTaxiDrivers(course),linked.car);assert.equal(await integrated.locator('[data-category="car"]').isVisible(),true);await integrated.click('[data-category="van"]');assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré']);await integrated.locator('#taxiDrivers [data-close]').click();
 await integrated.evaluate(()=>openTaxiDrivers());await integrated.click('[data-category="car"]');await select(integrated,'Petit test');await details(integrated).getByRole('button',{name:'Importer une course',exact:true}).click();
 const choices=await integrated.locator('#driversImportCourse option').evaluateAll(options=>options.map(option=>option.value));assert.ok(choices.includes('linked-car'));assert.ok(!choices.includes('linked-van'));
 await integrated.selectOption('#driversImportCourse','linked-car');await integrated.click('#driversImportConfirm');assert.match(await integrated.inputValue('#driversMessage'),/Client : Client lié/);assert.match(await integrated.locator('#driversRecipient').innerText(),/Petit test/);await integrated.click('#driversSms');assert.ok((await integrated.evaluate(()=>externalActions.at(-1).url)).startsWith('sms:0470101010?body='));
 // Assignment while encoding uses the same filtered directory and rejects a later incompatible vehicle change.
 await frame.evaluate(()=>{setVehicle('Van',false);setDriverChoice('direct','other');setDriverMenuOpen('direct',true);});
 assert.equal(await integrated.locator('[data-category="car"]').isVisible(),false);await select(integrated,'uniquement');await details(integrated).getByRole('button',{name:'Choisir ce chauffeur',exact:true}).click();
 const assignment=await frame.evaluate(()=>{const selected=getDriverChoice('direct');setVehicle('Petite voiture',false);const rejected=getDriverChoice('direct');setDriverChoice('direct','self');return {selected,rejected};});assert.equal(assignment.selected.driverName,'uniquement');assert.equal(assignment.rejected,null);
 console.log('Browser passed: names-only directory, prefix-free ranked search, detail/back flow, vehicle/day/night choices, native refresh, optional client creation/editing, airport/room/fare/date in copied text and SMS, and home return.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
