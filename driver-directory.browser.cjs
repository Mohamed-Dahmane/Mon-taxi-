const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const KEY='montaxi:driver-directory:v1';
const code=fs.readFileSync(__dirname+'/driver-directory.js','utf8');
const reorderCode=fs.readFileSync(__dirname+'/hold-reorder.js','utf8');
async function holdDrag(page,from,to){await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.waitForTimeout(550);await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();}
async function touchDrag(page,from,to){await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox(),cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});await page.waitForTimeout(550);for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*step/8,y:a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*step/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
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
 await page.addScriptTag({content:reorderCode});await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 assert.equal(await page.locator('#driversContent').isVisible(),true);
 assert.equal(await page.locator('#driversVanOnly').isChecked(),false);
 assert.equal(await names(page).count(),3);
 assert.equal(await page.getByRole('button',{name:'Appeler',exact:true}).count(),0);
 assert.equal(await names(page).locator('input,small').count(),0);
 await select(page,'Alexis');
 assert.equal(await details(page).locator('h3').innerText(),'TX Alexis');
 assert.equal(await details(page).getByRole('checkbox',{name:'Van',exact:true}).isDisabled(),true);
 assert.equal(await details(page).getByRole('checkbox',{name:'Van',exact:true}).isChecked(),false);await back(page);
 await page.check('#driversVanOnly');assert.equal(await names(page).count(),1);await select(page,'Hassan');
 await details(page).getByRole('checkbox',{name:'Voiture normale',exact:true}).check();
 await details(page).getByRole('checkbox',{name:'Jour',exact:true}).check();
 assert.equal(await details(page).getByRole('checkbox',{name:'Nuit',exact:true}).isChecked(),true);await back(page);
 await page.uncheck('#driversVanOnly');assert.equal(await names(page).count(),3);
 await page.click('[data-period="night"]');assert.equal(await names(page).count(),1);
 await page.click('[data-period="day"]');assert.equal(await names(page).count(),3);
 await page.click('#driversTx');assert.equal(await page.locator('#driversTx').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>nativeCalls.filter(x=>x.type==='sync')[0].ids.sort()),['1','2','3']);
 const incoming=[{nativeId:'1',name:'TX Alexis actualisé',phone:'0470998877'},{nativeId:'2',name:'TX Van Hassan renommé',phone:'0470887766'},{nativeId:'3',name:'Karim nouveau',phone:'0470776655'},{nativeId:'4',name:'TX Nuit Van Nouveau',phone:'0470665544'},{nativeId:'99',name:'Autre contact privé',phone:'0470554433'}];
 const respond=detail=>page.evaluate(d=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:d})),detail);
 await respond({mode:'sync',contacts:incoming});assert.equal(await page.locator('#driversTx').isDisabled(),false);assert.match(await page.locator('#driversStatus').innerText(),/1 ajouté\(s\), 3 modifié\(s\)/);
 await select(page,'Alexis actualisé');assert.match(await details(page).innerText(),/0470998877/);await back(page);
 await select(page,'Karim nouveau');assert.match(await details(page).innerText(),/0470776655/);await back(page);
 await select(page,'Hassan renommé');for(const name of ['Voiture normale','Van','Jour','Nuit'])assert.equal(await details(page).getByRole('checkbox',{name,exact:true}).isChecked(),true);await back(page);
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.match(await page.locator('#driversStatus').innerText(),/0 ajouté\(s\), 0 modifié\(s\)/);
 await page.click('#driversTx');await respond({mode:'sync',error:'Accès aux contacts refusé. Les fiches sont conservées.'});assert.equal(await page.locator('#driversTx').isDisabled(),false);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drivers.length,KEY),4);
 await page.check('#driversVanOnly');await page.click('[data-period="all"]');assert.equal(await names(page).count(),2);
 await select(page,'Nouveau');page.once('dialog',d=>d.accept());await details(page).getByRole('button',{name:'Supprimer',exact:true}).click();
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.equal(await names(page).count(),1);
 const sample={id:'course1',date:'2026-11-19',hotel:'DoubleTree',destination:'BRU',room:'418',announcedPrice:80,clientName:'Mme Dupont',clientPhone:'+32470123456',note:'Bonjour Émilie'};
 await page.evaluate(course=>openTaxiDrivers(course),sample);assert.equal(await page.locator('#driversContent').isVisible(),true);await select(page,'Hassan renommé');
 await details(page).getByRole('button',{name:'SMS',exact:true}).click();const message=await page.inputValue('#driversMessage');
 assert.match(message,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(message,/Chambre : 418/);assert.match(message,/19\/11\/2026/);assert.match(message,/Client : Mme Dupont/);assert.match(message,/Téléphone : \+32470123456/);
 assert.equal(await page.locator('#driversPriceAlert strong').evaluate(el=>Number(getComputedStyle(el).fontWeight)>=600),true);
 await page.click('#driversSms');const sms=await page.evaluate(()=>nativeCalls.filter(x=>x.type==='open').at(-1));assert.ok(sms.url.startsWith('sms:0470887766?body='));assert.match(decodeURIComponent(sms.url),/ATTENTION — PRIX FIXÉ : 80,00\s€/);assert.equal(sms.directoryClosed,true);
 await page.evaluate(()=>openTaxiDrivers());await select(page,'Hassan renommé');await details(page).getByRole('button',{name:'Appeler',exact:true}).click();assert.equal(await page.evaluate(()=>nativeCalls.at(-1).url),'tel:0470887766');
 assert.equal(await page.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await page.reload();await page.addScriptTag({content:reorderCode});await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');await page.click('[data-period="night"]');assert.equal(await names(page).count(),1);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(saved.version,2);assert.equal(saved.drivers.find(d=>d.id==='van').priority,4);assert.ok(saved.lastSyncedAt);
 // Sorting works on displayed names, persists and preserves manual relevance.
 await page.click('[data-period="all"]');await page.fill('#driversSearch','');await page.selectOption('#driversSort','az');
 assert.deepEqual(await page.locator('.driver-name').allTextContents(),['TX Alexis actualisé','TX Van Hassan renommé','Karim nouveau']);
 await page.selectOption('#driversSort','za');
 assert.deepEqual(await page.locator('.driver-name').allTextContents(),['Karim nouveau','TX Van Hassan renommé','TX Alexis actualisé']);
 await page.reload();await page.addScriptTag({content:reorderCode});await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 assert.equal(await page.inputValue('#driversSort'),'za');await page.selectOption('#driversSort','priority');
 const priorOrder=await page.locator('.driver-name').allTextContents();
 await holdDrag(page,page.locator('.driver-name').nth(0),page.locator('.driver-name').nth(1));
 let movedOrder=await page.locator('.driver-name').allTextContents();assert.deepEqual(movedOrder,[priorOrder[1],priorOrder[0],priorOrder[2]]);
 assert.equal(await page.locator('#driversDetails').isVisible(),false);
 await touchDrag(page,page.locator('.driver-name').nth(1),page.locator('.driver-name').nth(0));movedOrder=await page.locator('.driver-name').allTextContents();assert.deepEqual(movedOrder,priorOrder);
 await page.reload();await page.addScriptTag({content:reorderCode});await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 assert.deepEqual(await page.locator('.driver-name').allTextContents(),movedOrder);
 await respond({mode:'sync',contacts:[{nativeId:'51',name:'TX Yacine',phone:'0470111122'},{nativeId:'52',name:'TX Van Yassine Bekay',phone:'0470111133'},{nativeId:'53',name:'TX Farid Yassine',phone:'0470111144'}]});
 await page.click('[data-period="all"]');await page.fill('#driversSearch','y');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['TX Yacine','TX Van Yassine Bekay','TX Farid Yassine']);
 await select(page,'Yacine');await back(page);assert.equal(await page.inputValue('#driversSearch'),'y');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['TX Yacine','TX Van Yassine Bekay','TX Farid Yassine']);
 await page.check('#driversVanOnly');assert.equal(await page.inputValue('#driversSearch'),'y');await page.fill('#driversSearch','Y A');assert.deepEqual(await page.locator('.driver-name').allTextContents(),['TX Van Yassine Bekay']);await page.fill('#driversSearch','Bekay');assert.equal(await names(page).count(),1);assert.deepEqual(errors,[]);
 // The real app stylesheet, copied course, optional client forms and home return.
 const integrated=await browser.newPage({viewport:{width:360,height:780}});
 await integrated.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://taxi-app.test')return r.abort();const path=u.pathname==='/'?'index.html':u.pathname.slice(1);if(path.includes('..'))return r.abort();const target=__dirname+'/'+path;if(!fs.existsSync(target))return r.fulfill({status:404,body:''});return r.fulfill({contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(target)});});
 await integrated.goto('http://taxi-app.test/');await integrated.waitForFunction(()=>typeof window.openTaxiDrivers==='function');
 await integrated.evaluate(()=>{document.body.classList.remove('taxi-intro-pending','taxi-opening','taxi-entering');document.querySelector('main').hidden=false;document.querySelectorAll('.taxi-access,.taxi-splash').forEach(e=>e.remove());window.externalActions=[];window.TaxiContacts={open:url=>externalActions.push({url,home:document.querySelector('#home').classList.contains('active'),directoryClosed:!document.querySelector('#taxiDrivers').open,planningClosed:!document.querySelector('#hotelCommissionsDialog').open})};});
 await integrated.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--clean-bg').trim()==='#10151c');
 const entryFields=['cashInput','appeleInput','invoiceInput','commissionInput','FuelInput','ExpenseInput'];
 for(const viewport of [{width:320,height:560},{width:360,height:640},{width:390,height:700}]){
  await integrated.setViewportSize(viewport);
  await integrated.evaluate(()=>scrollTo(0,0));
  const geometry=await integrated.evaluate(ids=>{
   const rect=id=>document.getElementById(id).getBoundingClientRect();
   const nav=document.getElementById('taxiQuickNavigation');
   const limit=nav.hidden?innerHeight:Math.min(innerHeight,nav.getBoundingClientRect().top);
   return {fits:ids.every(id=>{const r=rect(id);return r.top>=0&&r.bottom<=limit&&r.height>=42&&r.width>0;}),
    bottom:rect('ExpenseInput').bottom,limit,scroll:scrollY};
  },entryFields);
  assert.ok(geometry.fits,JSON.stringify({viewport,...geometry}));
  assert.equal(geometry.scroll,0);
 }
 await integrated.setViewportSize({width:360,height:640});
 await integrated.fill('#ExpenseInput','12');
 assert.equal(await integrated.locator('#quickExpenseName').isVisible(),true);
 assert.equal(await integrated.locator('#validateExpense').isVisible(),true);
 await integrated.fill('#ExpenseInput','');
 await integrated.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
 await integrated.setViewportSize({width:360,height:780});
 const homeAverage=integrated.locator('#home .workday-average .reference-amount');
 const averageColor=await homeAverage.evaluate(el=>getComputedStyle(el).color);
 assert.equal(averageColor,'rgb(156, 231, 190)');
 assert.equal(await integrated.locator('#taxiQuickNavigation').isVisible(),false);
 const dailyToggle=integrated.locator('#todayReceiptToggle'),monthToggle=integrated.locator('#monthAverageToggle');
 const dailyDetail=integrated.locator('#paymentSplit'),monthDetail=integrated.locator('#monthAverageDetails');
 assert.equal(await dailyDetail.isVisible(),false);
 assert.equal(await monthDetail.isVisible(),false);
 await integrated.evaluate(()=>{window.testHaptics=0;window.TaxiHaptics={tap:()=>window.testHaptics++};});
 await dailyToggle.click();
 assert.equal(await dailyToggle.getAttribute('aria-expanded'),'true');
 assert.equal(await dailyDetail.locator('#dailyCash').isVisible(),true);
 await monthToggle.click();
 assert.equal(await dailyToggle.getAttribute('aria-expanded'),'false');
 assert.equal(await dailyDetail.isVisible(),false);
 assert.equal(await monthDetail.locator('#averageReceiptBase').isVisible(),true);
 assert.match(await monthDetail.locator('#averageReceiptBase').innerText(),/^(?:—|.*€)$/);
 assert.match(await monthDetail.locator('#averageWorkedDays').innerText(),/^\d+$/);
 await monthToggle.click();
 assert.equal(await monthDetail.isVisible(),false);
 assert.equal(await integrated.evaluate(()=>window.testHaptics),3);
 await integrated.evaluate(()=>scrollTo(0,0));
 assert.equal(await integrated.locator('#paymentNetToday').evaluate(el=>getComputedStyle(el).color),'rgb(165, 209, 255)');
 assert.equal(await integrated.locator('#homeCosts').evaluate(el=>getComputedStyle(el).color),'rgb(233, 200, 142)');
 assert.equal(await integrated.locator('#taxiPagePrev').isVisible(),false);
 const homeActions=integrated.locator('.hotel-home-actions');
 const actionTops=await homeActions.locator('button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().top));
 assert.equal(new Set(actionTops).size,1);
 assert.equal(await integrated.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await integrated.locator('#taxiPageLocation [data-location="details"]').click();
 const balanceAverage=integrated.locator('#details .workday-average .reference-amount');
 assert.equal(await balanceAverage.evaluate(el=>getComputedStyle(el).color),averageColor);
 assert.equal(await balanceAverage.textContent(),await homeAverage.textContent());
 const financial=integrated.locator('.financial-disclosure').first();
 assert.equal(await financial.locator('.monthly-payment-summary').isVisible(),false);
 await financial.locator('summary').click();
 assert.equal(await financial.locator('#detailsCashReal').isVisible(),true);
 assert.equal(await integrated.locator('#v11DetailsCosts').isVisible(),true);
 await integrated.locator('#taxiPageLocation [data-location="home"]').click();
 await integrated.click('#openTaxiDrivers');await integrated.check('#driversVanOnly');await integrated.locator('.drivers-management summary').click();await integrated.click('#driversAdd');
 await integrated.fill('#driversName','Test intégré');await integrated.fill('#driversPhone','0470123456');await integrated.check('#driversCarEligible');await integrated.check('#driversNight');await integrated.click('#driversSave');await back(integrated);
 assert.equal(await names(integrated).count(),1);assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await integrated.uncheck('#driversVanOnly');await integrated.click('[data-period="night"]');assert.equal(await names(integrated).count(),1);await integrated.locator('#taxiDrivers [data-close]').click();
 const driversRect=await integrated.locator('#openTaxiDrivers').boundingBox();const planningRect=await integrated.locator('.hotel-home-actions').boundingBox();assert.ok(driversRect.y+driversRect.height<=planningRect.y);
 await integrated.evaluate(()=>document.querySelector('.pageBtn[data-page="details"]').click());await integrated.click('#openHotelPlanning');await integrated.waitForFunction(()=>!!document.querySelector('#hotelCommissionsFrame')?.contentDocument?.querySelector('#reservationBoardTitle'));
 const frame=await (await integrated.$('#hotelCommissionsFrame')).contentFrame();
 await frame.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--clean-bg').trim()==='#10151c');
 const hotelKeySearch=await frame.evaluate(()=>{
  searchByHotelName=true;
  searchChoices=hotelSearchChoices(()=>{}).map(choice=>({...choice,searchText:searchText(choice)}));
  searchQuery.value='mar bou';renderSelectionSearch();
  return [...searchResults.children].map(button=>button.textContent);
 });
 assert.equal(hotelKeySearch[0],'Marriott Hotel (Bourse)');
 const copied=await frame.evaluate(async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedCourse=text;}}});
  await copyCourse({bookingMode:'Programmée',scheduledDate:'2026-11-20',scheduledTime:'05:15',hotel:'DoubleTree',destination:'Zaventem',room:'0123',passengers:4,clientName:'Mme Dupont',clientPhone:'+32470123456',announcedPrice:74.79,amount:10,vehicle:'Van',driver:'self'});return window.__copiedCourse;
 });
 assert.match(copied,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(copied,/Chambre : 0123/);assert.match(copied,/20\/11\/2026 à 05:15/);assert.match(copied,/^ATTENTION — PRIX FIXÉ : 74,79\s€/);assert.match(copied,/Client : Mme Dupont\nTéléphone : \+32470123456/);assert.doesNotMatch(copied,/10,00/);assert.match(copied,/Passagers : 4/);
 const pickupCopied=await frame.evaluate(async()=>{await copyCourse({bookingMode:'Direct',date:'2026-11-20',recordedTime:'05:15',hotel:'Standard',destination:'Hôtel',room:'7A',vehicle:'Van',driver:'self',pickup:{place:'Charleroi Airport (CRL)',client:'Client existant',phone:'0470000000'}});return window.__copiedCourse;});
 assert.match(pickupCopied,/Pick-up · Airport CRL \(Charleroi\) → Hôtel/);assert.match(pickupCopied,/Chambre : 7A/);assert.match(pickupCopied,/Client : Client existant/);assert.doesNotMatch(pickupCopied,/PRIX FIXÉ/);
 const direct=await frame.evaluate(()=>{
  const initial=data.length;setDriverChoice('direct','self');$('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Voiture normale',false);selected=10;
  $('room').value='0240';$('directClientName').value='Mme Test';$('directClientPhone').value='+32470000000';$('directPassengers').value='4';$('add').onclick();
  const first=data.at(-1);const count=data.length-initial;const cleared=$('directClientName').value===''&&$('directClientPhone').value==='';
  $('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Voiture normale',false);selected=10;$('add').onclick();
  return {count,first,second:data.at(-1),cleared,total:data.length-initial,error:$('message').textContent};
 });
 assert.equal(direct.count,1,direct.error);assert.equal(direct.first.clientName,'Mme Test');assert.equal(direct.first.clientPhone,'+32470000000');assert.equal(direct.first.passengers,4);assert.equal(direct.cleared,true);assert.equal(direct.total,2);assert.equal(direct.second.clientName,'');assert.equal(direct.second.clientPhone,'');assert.equal(direct.second.passengers,null);
 const reservation=await frame.evaluate(()=>{
  const today=reservationClock().slice(0,10);const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10);
  const original={id:'optional-client-reservation',reservationBoard:true,hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',bookingMode:'Programmée',reservationStatus:'pending',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',vehicle:'Voiture normale',vehicleChoice:'Voiture normale',carCount:1,vanCount:0,destination:'Zaventem',amount:10,pricing:'Compteur',announcedPrice:null,room:'240',clientName:'Nom initial',clientPhone:'0470000000',passengers:3};
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
 await pickupFrame.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--clean-bg').trim()==='#10151c');
 await pickupFrame.fill('#hotelSearch','hot te');
 await pickupFrame.getByRole('button',{name:'Test Hôtel',exact:true}).click();
 assert.equal(await pickupFrame.inputValue('#hotelSearch'),'Test Hôtel');
 const pickupOptional=await pickupFrame.evaluate(()=>{
  window.alert=message=>{throw Error(message)};window.confirm=()=>true;
  $('date').value='2026-11-20';$('timeMode').value='fixed';$('time').value='05:15';$('hotelSearch').value='Test Hôtel';$('contactSearch').value='Contact';$('driverSearch').value='Moi';$('flight').value='SN123';$('vans').value='1';$('passengers').value='1';$('commissionUnit').value='10';$('client').value='';$('phone').value='';
  const optional=!$('client').required&&!$('phone').required;$('save').onclick();return optional;
 });
 assert.equal(pickupOptional,true);const pickupSaved=await integrated.evaluate(()=>pickupSaved);assert.equal(pickupSaved.length,1);assert.equal(pickupSaved[0].client,'');assert.equal(pickupSaved[0].phone,'');await integrated.evaluate(()=>document.getElementById('closeHotelPickup').click());
 await integrated.evaluate(()=>openTaxiDrivers({id:'planning',date:'2026-11-20',hotel:'Standard',destination:'CRL',clientName:'Mme Test',clientPhone:'0470000000'}));
 await select(integrated,'Test intégré');await details(integrated).getByRole('button',{name:'SMS',exact:true}).click();assert.match(await integrated.inputValue('#driversMessage'),/Standard → Airport CRL \(Charleroi\)/);assert.match(await integrated.inputValue('#driversMessage'),/Client : Mme Test/);
 await integrated.click('#driversSms');const sent=await integrated.evaluate(()=>externalActions.at(-1));assert.equal(sent.home,true);assert.equal(sent.directoryClosed,true);assert.equal(sent.planningClosed,true);assert.ok(sent.url.startsWith('sms:'));
 // Course-linked calls, vehicle filtering, last-driver confirmation and the reverse import path.
 await integrated.evaluate(()=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:{mode:'sync',contacts:[{nativeId:'81',name:'TX Petit test',phone:'0470101010'},{nativeId:'82',name:'TX Van uniquement',phone:'0470202020'}]}})));
 const linked=await frame.evaluate(()=>{
  const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10),today=reservationClock().slice(0,10);
  const base={bookingMode:'Programmée',reservationBoard:true,reservationStatus:'pending',hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',room:'204',clientName:'Client lié',clientPhone:'+32470000011',passengers:5,amount:10,announcedPrice:90,pricing:'Forfait'};
  const van={...base,id:'linked-van',vehicle:'Van',vehicleChoice:'Van',carCount:0,vanCount:1};const car={...base,id:'linked-car',vehicle:'Voiture normale',vehicleChoice:'Voiture normale',carCount:1,vanCount:0,destination:'Zaventem'};van.destination='Charleroi';data.push(van,car);save();return {van,car};
 });
 await integrated.evaluate(()=>openHotelModule('planning'));
 const vanRow=frame.locator('.reservation-card[data-entry-id="linked-van"]');
 const options=vanRow.locator('.course-options');
 const removeCourse=options.locator('button').filter({hasText:'Supprimer la course'});
 assert.equal(await removeCourse.isVisible(),false);
 await options.locator('summary').click();
 assert.equal(await removeCourse.isVisible(),true);
 await options.locator('summary').click();
 await vanRow.getByRole('button',{name:'Répertoire',exact:true}).click();
 assert.equal(await integrated.locator('#driversVanOnly').isChecked(),true);assert.equal(await integrated.locator('#driversVanOnly').isDisabled(),true);assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','TX Van uniquement']);
 await select(integrated,'Test intégré');
 const callButton=details(integrated).getByRole('button',{name:'Appeler',exact:true});
 const callPosition=await callButton.evaluate(button=>({
  rightGap:button.closest('.driver-call-line').getBoundingClientRect().right-button.getBoundingClientRect().right,
  smsColor:getComputedStyle(button.previousElementSibling).backgroundColor,
  smsGap:button.getBoundingClientRect().left-button.previousElementSibling.getBoundingClientRect().right,
  sameRow:button.getBoundingClientRect().top===button.previousElementSibling.getBoundingClientRect().top,
  smsHeight:button.previousElementSibling.getBoundingClientRect().height,
  color:getComputedStyle(button).backgroundColor,
  height:button.getBoundingClientRect().height
 }));
 assert.ok(Math.abs(callPosition.rightGap)<1);
 assert.equal(callPosition.color,'rgb(23, 99, 61)');
 assert.ok(callPosition.height>=44);
 assert.equal(callPosition.smsColor,'rgb(37, 95, 159)');
 assert.ok(callPosition.sameRow&&callPosition.smsGap>=6&&callPosition.smsGap<=12);
 assert.ok(callPosition.smsHeight>=44);
 await callButton.click();
 assert.equal(await integrated.evaluate(()=>externalActions.at(-1).url),'tel:0470123456');
 const leaveAndReturn=()=>integrated.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await leaveAndReturn();await integrated.waitForFunction(()=>document.querySelector('#hotelCommissionsDialog').open&&!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver').waitFor();assert.match(await vanRow.locator('.last-called-driver strong').innerText(),/Test intégré/);
 await vanRow.getByRole('button',{name:'Chauffeur suivant',exact:true}).click();assert.match(await details(integrated).locator('h3').innerText(),/uniquement/);await details(integrated).getByRole('button',{name:'Appeler',exact:true}).click();
 await leaveAndReturn();await integrated.waitForFunction(()=>!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver strong').filter({hasText:'uniquement'}).waitFor();await vanRow.getByRole('button',{name:'J’envoie',exact:true}).click();
 const linkedSms=await integrated.evaluate(()=>externalActions.at(-1));assert.ok(linkedSms.url.startsWith('sms:0470202020?body='));const linkedText=decodeURIComponent(linkedSms.url);for(const value of ['Airport CRL (Charleroi)','Chambre : 204','Client : Client lié','Téléphone : +32470000011','Passagers : 5','PRIX FIXÉ : 90,00'])assert.ok(linkedText.includes(value),value);assert.equal(linkedSms.home,true);assert.equal(linkedSms.planningClosed,true);
 await integrated.evaluate(course=>openTaxiDrivers(course),linked.car);assert.equal(await integrated.locator('#driversVanOnly').isChecked(),false);
 assert.equal(await integrated.locator('#driversVanOnly').isEnabled(),true);
 assert.equal(await names(integrated).count(),3);
 await integrated.check('#driversVanOnly');assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','TX Van uniquement']);await integrated.uncheck('#driversVanOnly');assert.equal(await names(integrated).count(),3);await integrated.locator('#taxiDrivers [data-close]').click();
 await integrated.evaluate(()=>openTaxiDrivers());await select(integrated,'Petit test');await details(integrated).getByRole('button',{name:'Importer une course',exact:true}).click();
 const choices=await integrated.locator('#driversImportCourse option').evaluateAll(options=>options.map(option=>option.value));assert.ok(choices.includes('linked-car'));assert.ok(!choices.includes('linked-van'));
 await integrated.selectOption('#driversImportCourse','linked-car');await integrated.click('#driversImportConfirm');assert.match(await integrated.inputValue('#driversMessage'),/Client : Client lié/);assert.match(await integrated.locator('#driversRecipient').innerText(),/Petit test/);await integrated.click('#driversSms');assert.ok((await integrated.evaluate(()=>externalActions.at(-1).url)).startsWith('sms:0470101010?body='));
 // Assignment while encoding uses the same filtered directory and rejects a later incompatible vehicle change.
 await frame.evaluate(()=>{setVehicle('Van',false);setDriverChoice('direct','other');setDriverMenuOpen('direct',true);});
 assert.equal(await integrated.locator('#driversVanOnly').isChecked(),true);assert.equal(await integrated.locator('#driversVanOnly').isDisabled(),true);await select(integrated,'uniquement');await details(integrated).getByRole('button',{name:'Choisir ce chauffeur',exact:true}).click();
 const assignment=await frame.evaluate(()=>{const selected=getDriverChoice('direct');setVehicle('Voiture normale',false);const rejected=getDriverChoice('direct');setDriverChoice('direct','self');return {selected,rejected};});assert.equal(assignment.selected.driverName,'uniquement');assert.equal(assignment.rejected.driverName,'uniquement');
 await integrated.evaluate(()=>openHotelModule('home'));
 // The joined back/home control stays fixed while scrolling and handles nested forms.
 await integrated.evaluate(()=>{
  const frame=document.querySelector('#hotelCommissionsFrame').contentWindow;
  frame.document.querySelector('#reservationsOverlay').hidden=true;
  frame.document.querySelector('#directCourseForm').hidden=false;
  frame.showStep('details');
 });
 await integrated.locator('#taxiQuickNavigation button').first().click();
 assert.equal(await integrated.evaluate(()=>document.querySelector('#hotelCommissionsFrame').contentDocument.querySelector('#step-amount').hidden),false);
 await integrated.locator('#taxiQuickNavigation button').last().click();
 assert.equal(await integrated.locator('#hotelCommissionsDialog').evaluate(el=>el.open),false);
 assert.equal(await integrated.locator('.page.active').getAttribute('id'),'home');
 await integrated.evaluate(()=>{const spacer=document.createElement('div');spacer.id='testScrollSpace';spacer.style.height='2000px';document.body.append(spacer);});
 assert.equal(await integrated.locator('#taxiQuickNavigation').isVisible(),false);
 await integrated.locator('#taxiPageLocation [data-location="details"]').click();
 const beforeScroll=await integrated.locator('#taxiQuickNavigation').boundingBox();
 await integrated.evaluate(()=>window.scrollTo(0,1400));
 const afterScroll=await integrated.locator('#taxiQuickNavigation').boundingBox();
 assert.ok(Math.abs(beforeScroll.y-afterScroll.y)<2);
 assert.equal(await integrated.locator('#taxiQuickNavigation').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await integrated.locator('#taxiQuickNavigation button').last().click();
 await integrated.evaluate(()=>document.querySelector('#testScrollSpace').remove());
 await integrated.click('#openTaxiDrivers');
 assert.equal(await integrated.locator('#taxiQuickNavigation').evaluate(el=>el.parentElement.id),'taxiDrivers');
 await integrated.locator('#taxiQuickNavigation button').first().click();
 assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.open),false);
 await integrated.click('#openHotelPlanning');
 await integrated.evaluate(()=>openHotelPickup({mode:'Réservation',today:'2026-11-19',hotels:[],contacts:{},drivers:[],save:()=>''}));
 await integrated.locator('#taxiQuickNavigation button').first().click();
 assert.equal(await integrated.locator('#hotelPickup').isVisible(),false);
 assert.equal(await integrated.locator('#hotelCommissionsDialog').evaluate(el=>el.open),true);
 await integrated.locator('#taxiQuickNavigation button').last().click();
 assert.equal(await integrated.locator('#hotelCommissionsDialog').evaluate(el=>el.open),false);
 // The hotel list can be opened before any course form has initialized its data.
 const fresh=await browser.newPage({viewport:{width:360,height:780}});
 await fresh.route('http://taxi.test/**',r=>{
  const requested=new URL(r.request().url()).pathname;
  const relative=requested==='/'?'index.html':requested.slice(1);
  const path=__dirname+'/'+relative;
  return fs.existsSync(path)?r.fulfill({path}):r.abort();
 });
 await fresh.goto('http://taxi.test/');
 await fresh.evaluate(()=>openTaxiDirectory('hotels'));
 const freshRows=fresh.locator('#directoryRows .directory-row');
 await freshRows.first().waitFor();
 await fresh.fill('#directoryNew','Hôtel test');
 await fresh.click('#directoryAdd');
 const newHotel=freshRows.filter({hasText:'Hôtel test'});
 await fresh.fill('#directorySearch','hotel te');
 assert.equal(await freshRows.count(),1);
 assert.match(await newHotel.innerText(),/Hôtel test/);
 await fresh.fill('#directorySearch','');
 const defaultContact=newHotel.getByRole('combobox');
 await defaultContact.selectOption('Alexis');
 const directoryKey='montaxi:hotel-commissions:directory-v1';
 const hotelSettings=await fresh.evaluate(key=>JSON.parse(localStorage.getItem(key)),directoryKey);
 assert.equal(hotelSettings.hotels['Hôtel test'],'Alexis');
 assert.ok(hotelSettings.allowedContacts['Hôtel test'].includes('Alexis'));
 await fresh.reload();
 await fresh.evaluate(()=>openTaxiDirectory('hotels'));
 assert.equal(await defaultContact.inputValue(),'Alexis');
 fresh.once('dialog',dialog=>dialog.accept());
 await newHotel.getByRole('button',{name:'Supprimer'}).click();
 assert.equal(await newHotel.count(),0);
 await fresh.close();

 // Long press is shared by the editable reference lists, with persistent order.
 for(const mode of ['hotels','drivers']){
  await integrated.evaluate(mode=>openTaxiDirectory(mode),mode);
  const rows=integrated.locator('#directoryRows .directory-name');const original=await rows.allTextContents();assert.ok(original.length>2);
  await holdDrag(integrated,rows.nth(0),rows.nth(1));const reordered=await rows.allTextContents();assert.deepEqual(reordered.slice(0,3),[original[1],original[0],original[2]]);
  assert.equal(await integrated.locator('#directoryRows button').filter({hasText:/^[↑↓]$/}).count(),0);
  await integrated.click('#directoryClose');await integrated.evaluate(mode=>openTaxiDirectory(mode),mode);assert.deepEqual(await rows.allTextContents(),reordered);
  await integrated.selectOption('#directorySort','az');const alphabetical=await rows.allTextContents();await holdDrag(integrated,rows.nth(0),rows.nth(1));assert.deepEqual(await rows.allTextContents(),alphabetical);
  await integrated.click('#directoryClose');
 }
 await integrated.evaluate(()=>openHotelModule('home'));
 await frame.evaluate(()=>{openHotelManagement('The Standard');$('driverOrderSettings').open=true;});
 const orderedDrivers=frame.locator('#driverOrderList button');await orderedDrivers.first().waitFor();
 const oldDriverOrder=await orderedDrivers.allTextContents();await holdDrag(integrated,orderedDrivers.nth(0),orderedDrivers.nth(1));
 assert.deepEqual((await orderedDrivers.allTextContents()).slice(0,3),[oldDriverOrder[1],oldDriverOrder[0],oldDriverOrder[2]]);
 assert.equal(await frame.locator('#moveDriverUp,#moveDriverDown').count(),0);
 await integrated.locator('#taxiQuickNavigation button').last().click();
 // Hotel contacts are classified automatically while attribution-only names are excluded.
 await integrated.evaluate(()=>{
  const key='montaxi:hotel-commissions:directory-v1';
  const directory=JSON.parse(localStorage.getItem(key));
  directory.hotels['Hôtel priorité']='Test intégré';
  directory.allowedContacts['Hôtel priorité']=['Petit test'];
  directory.allowedContacts['The Standard'].push('Petit test');
  localStorage.setItem(key,JSON.stringify(directory));
  openTaxiDrivers();
 });
 const priorities=()=>integrated.locator('#driversList .driver-priority').allTextContents();
 assert.deepEqual(await priorities(),['1','3','3']);
 await select(integrated,'TX Van uniquement');
 await details(integrated).getByRole('button',{name:'Modifier',exact:true}).click();
 await integrated.selectOption('#driversEditPriority','2');
 await integrated.click('#driversSave');
 await back(integrated);
 assert.deepEqual(await priorities(),['1','2','3']);
 assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','TX Van uniquement','TX Petit test']);
 await integrated.check('#driversVanOnly');
 assert.deepEqual(await priorities(),['1','2']);
 const priorityNames=integrated.locator('.driver-name');
 await holdDrag(integrated,priorityNames.nth(1),priorityNames.nth(0));
 assert.deepEqual(await priorities(),['1','2']);
 const picker=integrated.locator('#driversPriorityPicker');
 const badgeShortcut=integrated.getByRole('button',{name:/Modifier la priorité de Test intégré/});
 await badgeShortcut.click();
 assert.equal(await picker.isVisible(),true);
 assert.equal(await picker.locator('#driversPriorityOptions button').count(),3);
 assert.equal(await picker.getByRole('button',{name:'1 · Contact d’hôtel'}).getAttribute('aria-pressed'),'true');
 await picker.getByRole('button',{name:'3 · Chauffeur standard'}).click();
 assert.equal(await picker.isVisible(),false);
 assert.deepEqual(await priorities(),['2','3']);
 await integrated.selectOption('#driversSort','az');
 const heldName=integrated.locator('.driver-name').filter({hasText:'Test intégré'});
 await touchDrag(integrated,heldName,heldName);
 assert.equal(await picker.isVisible(),true);
 assert.equal(await details(integrated).isVisible(),false);
 await picker.getByRole('button',{name:'1 · Contact d’hôtel'}).click();
 assert.equal(await picker.isVisible(),false);
 await integrated.selectOption('#driversSort','priority');
 assert.deepEqual(await priorities(),['1','2']);
 await integrated.locator('#taxiDrivers [data-close]').click();
 await integrated.reload();
 await integrated.waitForFunction(()=>typeof window.openTaxiDrivers==='function');
 await integrated.evaluate(()=>openTaxiDrivers());
 assert.deepEqual(await priorities(),['1','2','3']);
 console.log('Browser passed: names-only directory, prefix-free ranked search, detail/back flow, vehicle/day/night choices, native refresh, optional client creation/editing, airport/room/fare/date in copied text and SMS, and home return.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
