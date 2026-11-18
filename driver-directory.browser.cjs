const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const KEY='montaxi:driver-directory:v1';
const code=fs.readFileSync(__dirname+'/driver-directory.js','utf8');
const row=(page,name)=>page.locator('.driver-row').filter({has:page.locator('strong',{hasText:name})});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:360,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://taxi.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><head></head><body><main></main></body></html>'}));
 await page.addInitScript(()=>{window.nativeCalls=[];window.TaxiContacts={sync:ids=>window.nativeCalls.push({type:'sync',ids:JSON.parse(ids)}),pick:()=>{},edit:()=>{},open:url=>window.nativeCalls.push({type:'open',url})};});
 await page.goto('http://taxi.test/');
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:1,drivers:[
  {id:'car',nativeId:'1',name:'TX Alexis',phone:'0470112233',category:'car',localPhone:true},
  {id:'van',nativeId:'2',name:'TX Van Nuit Hassan',phone:'0470223344',category:'van',priority:4},
  {id:'chosen',nativeId:'3',name:'Karim',phone:'0470334455',category:'car',source:'chosen'}
 ],deletedNativeIds:[]})),KEY);
 await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 assert.equal(await page.locator('#driversContent').isVisible(),false);
 await page.click('[data-category="car"]');assert.equal(await page.locator('.driver-row').count(),2);
 assert.equal(await row(page,'TX Alexis').getByRole('checkbox',{name:'Van',exact:true}).isDisabled(),true);
 assert.equal(await row(page,'TX Alexis').getByRole('checkbox',{name:'Van',exact:true}).isChecked(),false);
 await page.click('[data-category="van"]');assert.equal(await page.locator('.driver-row').count(),1);
 await row(page,'TX Van Nuit Hassan').getByRole('checkbox',{name:'Petite voiture',exact:true}).check();
 await row(page,'TX Van Nuit Hassan').getByRole('checkbox',{name:'Jour',exact:true}).check();
 assert.equal(await row(page,'TX Van Nuit Hassan').getByRole('checkbox',{name:'Nuit',exact:true}).isChecked(),true);
 await page.click('[data-category="car"]');assert.equal(await page.locator('.driver-row').count(),3);
 await page.click('[data-period="night"]');assert.equal(await page.locator('.driver-row').count(),1);
 await page.click('[data-period="day"]');assert.equal(await page.locator('.driver-row').count(),3);
 await page.click('#driversTx');assert.equal(await page.locator('#driversTx').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>nativeCalls.filter(x=>x.type==='sync')[0].ids.sort()),['1','2','3']);
 const incoming=[
  {nativeId:'1',name:'TX Alexis actualisé',phone:'0470998877'},
  {nativeId:'2',name:'TX Van Hassan renommé',phone:'0470887766'},
  {nativeId:'3',name:'Karim nouveau',phone:'0470776655'},
  {nativeId:'4',name:'TX Nuit Van Nouveau',phone:'0470665544'},
  {nativeId:'99',name:'Autre contact privé',phone:'0470554433'}
 ];
 const respond=detail=>page.evaluate(d=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:d})),detail);
 await respond({mode:'sync',contacts:incoming});assert.equal(await page.locator('#driversTx').isDisabled(),false);
 assert.match(await page.locator('#driversStatus').innerText(),/1 ajouté\(s\), 3 modifié\(s\)/);
 assert.match(await row(page,'TX Alexis actualisé').innerText(),/0470998877/);
 assert.match(await row(page,'Karim nouveau').innerText(),/0470776655/);
 const vanAfter=row(page,'TX Van Hassan renommé');
 for(const name of ['Petite voiture','Van','Jour','Nuit'])assert.equal(await vanAfter.getByRole('checkbox',{name,exact:true}).isChecked(),true);
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.match(await page.locator('#driversStatus').innerText(),/0 ajouté\(s\), 0 modifié\(s\)/);
 await page.click('#driversTx');await respond({mode:'sync',error:'Accès aux contacts refusé. Les fiches sont conservées.'});assert.equal(await page.locator('#driversTx').isDisabled(),false);
 assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).drivers.length,KEY),4);
 await page.click('[data-category="van"]');await page.click('[data-period="all"]');assert.equal(await page.locator('.driver-row').count(),2);
 await row(page,'TX Nuit Van Nouveau').getByRole('button',{name:'Modifier',exact:true}).click();page.once('dialog',d=>d.accept());await page.click('#driversDelete');
 await page.click('#driversTx');await respond({mode:'sync',contacts:incoming});assert.equal(await page.locator('.driver-row').count(),1);
 await page.evaluate(()=>openTaxiDrivers({id:'course1',date:'2026-11-19',hotel:'DoubleTree',destination:'BRU',room:'418',note:'Bonjour Émilie'}));
 assert.equal(await page.locator('#driversContent').isVisible(),false);await page.click('[data-category="car"]');
 await row(page,'TX Van Hassan renommé').getByRole('button',{name:'SMS',exact:true}).click();assert.match(await page.inputValue('#driversMessage'),/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(await page.inputValue('#driversMessage'),/Chambre : 418/);
 await page.click('#driversSms');const sms=await page.evaluate(()=>nativeCalls.filter(x=>x.type==='open').at(-1).url);assert.ok(sms.startsWith('sms:0470887766?body='));assert.match(decodeURIComponent(sms),/Bonjour Émilie/);
 await row(page,'TX Van Hassan renommé').getByRole('button',{name:'Appeler',exact:true}).click();assert.equal(await page.evaluate(()=>nativeCalls.at(-1).url),'tel:0470887766');
 assert.equal(await page.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await page.reload();await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');await page.click('[data-category="car"]');await page.click('[data-period="night"]');assert.equal(await page.locator('.driver-row').count(),1);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(saved.version,2);assert.equal(saved.drivers.find(d=>d.id==='van').priority,4);assert.ok(saved.lastSyncedAt);assert.deepEqual(errors,[]);
 // Exercise the real app CSS and Planning integration without contacting a live backend.
 const integrated=await browser.newPage({viewport:{width:360,height:780}});
 await integrated.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://taxi-app.test')return r.abort();const path=u.pathname==='/'?'index.html':u.pathname.slice(1);if(path.includes('..'))return r.abort();const target=__dirname+'/'+path;if(!fs.existsSync(target))return r.fulfill({status:404,body:''});return r.fulfill({contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(target)});});
 await integrated.goto('http://taxi-app.test/');await integrated.waitForFunction(()=>typeof window.openTaxiDrivers==='function');
 await integrated.evaluate(()=>{document.body.classList.remove('taxi-intro-pending','taxi-opening','taxi-entering');document.querySelector('main').hidden=false;document.querySelectorAll('.taxi-access,.taxi-splash').forEach(e=>e.remove());});
 await integrated.click('#openTaxiDrivers');await integrated.click('[data-category="van"]');await integrated.locator('.drivers-management summary').click();await integrated.click('#driversAdd');
 await integrated.fill('#driversName','Test intégré');await integrated.fill('#driversPhone','0470123456');await integrated.check('#driversCarEligible');await integrated.check('#driversNight');await integrated.click('#driversSave');
 assert.equal(await integrated.locator('.driver-row').count(),1);assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await integrated.click('[data-category="car"]');await integrated.click('[data-period="night"]');assert.equal(await integrated.locator('.driver-row').count(),1);
 await integrated.locator('#taxiDrivers [data-close]').click();
 const driversRect=await integrated.locator('#openTaxiDrivers').boundingBox();const planningRect=await integrated.locator('.hotel-home-actions').boundingBox();assert.ok(driversRect.y+driversRect.height<=planningRect.y);
 await integrated.click('#openHotelPlanning');await integrated.waitForFunction(()=>!!document.querySelector('#hotelCommissionsFrame')?.contentDocument?.querySelector('#reservationBoardTitle'));
 const copied=await integrated.evaluate(async()=>{
  const frame=document.querySelector('#hotelCommissionsFrame').contentWindow;
  Object.defineProperty(frame.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{frame.__copiedCourse=text;}}});
  await frame.copyCourse({bookingMode:'Programmée',scheduledDate:'2026-11-20',scheduledTime:'05:15',hotel:'DoubleTree',destination:'Zaventem',room:'0123',vehicle:'Van',driver:'self'});
  return frame.__copiedCourse;
 });
 assert.match(copied,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(copied,/Chambre : 0123/);
 const pickupCopied=await integrated.evaluate(async()=>{
  const frame=document.querySelector('#hotelCommissionsFrame').contentWindow;
  await frame.copyCourse({bookingMode:'Direct',date:'2026-11-20',recordedTime:'05:15',hotel:'Standard',destination:'Hôtel',room:'7A',vehicle:'Van',driver:'self',pickup:{place:'CRL'}});
  return frame.__copiedCourse;
 });
 assert.match(pickupCopied,/Pick-up · Airport CRL \(Charleroi\) → Hôtel/);assert.match(pickupCopied,/Chambre : 7A/);
 await integrated.evaluate(()=>document.querySelector('#hotelCommissionsFrame').contentWindow.parent.openTaxiDrivers({id:'planning',date:'2026-11-20',hotel:'Standard',destination:'CRL'}));assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.open),true);
 await integrated.click('[data-category="car"]');await integrated.locator('.driver-row').getByRole('button',{name:'SMS',exact:true}).click();assert.match(await integrated.inputValue('#driversMessage'),/Standard → Airport CRL \(Charleroi\)/);
 // The course constrains the directory; opening it independently clears that context.
 await integrated.evaluate(()=>openTaxiDrivers({id:'van-course',carCount:0,vanCount:2,passengers:6}));
 assert.equal(await integrated.locator('[data-category="car"]').isDisabled(),true);
 assert.equal(await integrated.locator('[data-category="van"]').getAttribute('aria-pressed'),'true');
 await integrated.locator('.driver-row').getByRole('button',{name:'SMS',exact:true}).click();
 assert.match(await integrated.inputValue('#driversMessage'),/Passagers : 6/);
 await integrated.evaluate(()=>openTaxiDrivers({id:'car-course',vehicle:'Petite voiture',passengers:3}));
 assert.equal(await integrated.locator('[data-category="car"]').isDisabled(),false);
 assert.equal(await integrated.locator('[data-category="car"]').getAttribute('aria-pressed'),'true');
 await integrated.click('[data-category="van"]');assert.equal(await integrated.locator('.driver-row').count(),1);
 await integrated.evaluate(()=>openTaxiDrivers());
 assert.equal(await integrated.locator('[data-category="car"]').isDisabled(),false);
 assert.equal(await integrated.locator('#driversContent').isVisible(),false);
 // Check the actual reservation editor restores the count and copied course includes it.
 const passengers=await integrated.evaluate(async()=>{
  const frame=document.querySelector('#hotelCommissionsFrame').contentWindow;
  const entry={id:'passengers-test',bookingMode:'Programmée',scheduledDate:'2026-11-20',scheduledTime:'05:15',hotelGroup:'DoubleTree by Hilton',hotel:'DoubleTree by Hilton',contact:'Night',destination:'Zaventem',vehicle:'Van',passengers:5,driver:'self'};
  frame.showReservationForm(entry);
  await frame.copyCourse(entry);
  return {value:frame.document.querySelector('#reservationPassengers').value,text:frame.__copiedCourse,direct:!!frame.document.querySelector('#directPassengers')};
 });
 assert.equal(passengers.value,'5');assert.equal(passengers.direct,true);assert.match(passengers.text,/Passagers : 5/);
 console.log('Browser passed: quick category choice, car/van asymmetry, day/night dual availability, explicit full refresh including non-TX, denial retention, no duplicates, deletion, calls, SMS, v1 migration, persistence, 360px real app and Planning.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
