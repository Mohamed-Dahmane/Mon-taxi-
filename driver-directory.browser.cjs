const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const KEY='montaxi:driver-directory:v1';
const code=fs.readFileSync(__dirname+'/driver-directory.js','utf8');
const reorderCode=fs.readFileSync(__dirname+'/hold-reorder.js','utf8');
async function holdDrag(page,from,to){await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.waitForTimeout(550);await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();}
async function touchDrag(page,from,to){await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox(),cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});await page.waitForTimeout(550);for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*step/8,y:a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*step/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
async function swipeScreen(page,x,y,dy){
 const cdp=await page.context().newCDPSession(page);
 try{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=8;step++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*step/8}]});
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await cdp.detach();}
}
const openDriverOptions=async page=>{
 const options=page.locator('#driversManagement');
 if(await options.getAttribute('open')===null)await options.locator('summary').click();
};
const names=page=>page.locator('#driversList .driver-row');
const select=async(page,name)=>page.locator('#driversList .driver-name').filter({hasText:name}).click();
const back=async page=>page.click('#driversBack');
const details=page=>page.locator('#driversDetails');
async function checkBookingRoom(frame,id){
 const field=frame.getByRole('textbox',{name:'Numéro de chambre Facultatif'});
 assert.equal(await field.getAttribute('id'),id);
 const bounds=await field.boundingBox();
 assert.ok(bounds&&bounds.height>=52&&bounds.width>=160,JSON.stringify(bounds));
 assert.equal(await field.evaluate(el=>getComputedStyle(el).fontSize),'22px');
 await frame.locator('label[for="'+id+'"]').click();
 assert.equal(await field.evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineWidth==='2px'),true);
}
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
 await openDriverOptions(page);
 assert.equal(await page.locator('#driversPriorityLegend').isVisible(),true);
 assert.equal(await page.locator('#driversExport').isVisible(),true);
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
 await page.click('[data-period="all"]');await page.fill('#driversSearch','');await openDriverOptions(page);await page.selectOption('#driversSort','az');
 assert.deepEqual(await page.locator('.driver-name').allTextContents(),['TX Alexis actualisé','TX Van Hassan renommé','Karim nouveau']);
 await page.selectOption('#driversSort','za');
 assert.deepEqual(await page.locator('.driver-name').allTextContents(),['Karim nouveau','TX Van Hassan renommé','TX Alexis actualisé']);
 await page.reload();await page.addScriptTag({content:reorderCode});await page.addScriptTag({content:code});await page.click('#openTaxiDrivers');
 await openDriverOptions(page);
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
 const entryFields=['commissionInput','cashInput','appeleInput','invoiceInput','FuelInput','ExpenseInput'];
 assert.deepEqual(await integrated.locator('.entry-hub .taxi-entry input').evaluateAll(fields=>fields.map(field=>field.id)),entryFields);
 for(const viewport of [{width:320,height:560},{width:360,height:640},{width:390,height:700}]){
  await integrated.setViewportSize(viewport);
  await integrated.evaluate(()=>scrollTo(0,0));
  const geometry=await integrated.evaluate(ids=>{
   const rect=id=>document.getElementById(id).getBoundingClientRect();
   const nav=document.getElementById('taxiQuickNavigation');
   const limit=innerHeight;
   const top=nav.getBoundingClientRect().bottom;
   const buttons=[...document.querySelectorAll('.hotel-home-actions button')];
   const firstButtonTop=buttons[0].getBoundingClientRect().top;
   return {fits:ids.every(id=>{const r=rect(id);return r.top>=top&&r.bottom<=limit&&r.height>=42&&r.width>0;}),
    buttonsFit:buttons.length===4&&buttons.every(button=>{
     const r=button.getBoundingClientRect();
     return Math.abs(r.top-firstButtonTop)<=1&&button.scrollWidth<=button.clientWidth&&button.scrollHeight<=button.clientHeight;
    }),
    bottom:rect('ExpenseInput').bottom,limit,scroll:scrollY};
  },entryFields);
  assert.ok(geometry.fits&&geometry.buttonsFit,JSON.stringify({viewport,...geometry}));
  assert.equal(geometry.scroll,0);
 }
 await integrated.setViewportSize({width:360,height:640});
 const manualCommission=integrated.locator('#commissionInput');
 assert.equal(await manualCommission.getAttribute('enterkeyhint'),'done');
 await manualCommission.fill('12,50');
 await manualCommission.press('Enter');
 assert.equal(await manualCommission.inputValue(),'');
 assert.equal(await integrated.evaluate(()=>document.activeElement.tagName),'BODY');
 assert.match(await integrated.locator('#commissionToday').innerText(),/12,50/);
 await manualCommission.fill('12,50');
 await manualCommission.press('Enter');
 assert.match(await integrated.locator('#commissionToday').innerText(),/25,00/);
 const cashEntry=integrated.locator('#cashInput');
 assert.equal(await cashEntry.getAttribute('enterkeyhint'),'done');
 await cashEntry.fill('32,75');
 await cashEntry.press('Enter');
 assert.equal(await cashEntry.inputValue(),'');
 assert.equal(await integrated.evaluate(()=>document.activeElement.tagName),'BODY');
 assert.match(await integrated.locator('#cashToday').innerText(),/32,75/);
 await cashEntry.fill('7,25');
 await cashEntry.press('Enter');
 assert.equal(await integrated.evaluate(()=>document.activeElement.tagName),'BODY');
 assert.match(await integrated.locator('#cashToday').innerText(),/40,00/);
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
 assert.equal(await monthDetail.locator('#homeMonthlyRevenue').isVisible(),true);
 assert.equal(await monthDetail.locator('#homeCosts').isVisible(),true);
 assert.equal(await monthDetail.locator('#homeBalance').isVisible(),true);
 assert.equal(await monthDetail.locator('#monthReceiptTotal').count(),0);
 assert.equal(await integrated.locator('#home > section').last().getAttribute('id'),'monthAverageDetails');
 assert.match(await monthDetail.locator('#averageWorkedDays').innerText(),/^\d+$/);
 await monthToggle.click();
 assert.equal(await monthDetail.isVisible(),false);
 assert.equal(await integrated.evaluate(()=>window.testHaptics),3);
 await integrated.evaluate(()=>scrollTo(0,0));
 assert.equal(await integrated.locator('#paymentNetToday').evaluate(el=>getComputedStyle(el).color),'rgb(165, 209, 255)');
 assert.equal(await integrated.locator('#homeCosts').evaluate(el=>getComputedStyle(el).color),'rgb(233, 200, 142)');
 assert.equal(await integrated.locator('#taxiPagePrev').isVisible(),false);
 await integrated.evaluate(()=>{
  window.refreshGestureCalls=[];
  window.refreshGestureObserver=new MutationObserver(records=>{
   if(records.some(record=>record.oldValue!==null)&&!document.querySelector('#fullRefreshIndicator').hidden){
    refreshGestureCalls.push(document.querySelector('.page.active').id);
   }
  });
  refreshGestureObserver.observe(document.querySelector('#fullRefreshIndicator'),{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  scrollTo(0,0);
 });
 const quickTitle=await integrated.locator('#home .entry-heading').boundingBox();
 await swipeScreen(integrated,quickTitle.x+10,quickTitle.y+7,36);
 assert.deepEqual(await integrated.evaluate(()=>refreshGestureCalls),[]);
 await swipeScreen(integrated,quickTitle.x+10,quickTitle.y+7,115);
 assert.deepEqual(await integrated.evaluate(()=>refreshGestureCalls),['home']);
 // The standard refresh indicator stays active for at least 900 ms.
 await integrated.waitForTimeout(950);
 const homeActions=integrated.locator('.hotel-home-actions');
 const actions=await homeActions.locator('button').evaluateAll(buttons=>buttons.map(button=>({id:button.id,top:button.getBoundingClientRect().top})));
 assert.deepEqual(actions.map(action=>action.id),['openHotelPlanning','openHotelReservationQuick','openHotelCommissions','openTaxiDrivers']);
 assert.equal(new Set(actions.map(action=>action.top)).size,1);
 assert.deepEqual(await homeActions.locator('button').evaluateAll(buttons=>buttons.slice(1).map(button=>getComputedStyle(button).backgroundColor)),
  ['rgb(98, 66, 142)','rgb(22, 95, 102)','rgb(23, 99, 61)']);

 const header=await integrated.locator('.taxi-header').evaluate(el=>{
  const rect=el.getBoundingClientRect();
  return [...el.querySelectorAll('.taxi-brand,#calendarTrigger,#refreshLocal,#quickMenuBtn')].every(control=>{
   const r=control.getBoundingClientRect();return r.top>=rect.top-1&&r.bottom<=rect.bottom+1;
  });
 });
 assert.equal(header,true);
 const activeColor=el=>getComputedStyle(el).backgroundColor;
 assert.equal(await integrated.locator('#taxiPageLocation [aria-current="page"]').evaluate(activeColor),'rgb(18, 52, 93)');
 assert.equal(await integrated.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await integrated.locator('#taxiPageLocation [data-location="details"]').click();
 await integrated.waitForFunction(()=>getComputedStyle(document.querySelector('#taxiPageLocation [data-location="details"]')).backgroundColor==='rgb(18, 52, 93)');
 assert.equal(await integrated.locator('#taxiQuickNavigation').isVisible(),true);
 const balanceAverage=integrated.locator('#details .workday-average .reference-amount');
 assert.equal(await balanceAverage.evaluate(el=>getComputedStyle(el).color),averageColor);
 assert.equal(await balanceAverage.textContent(),await homeAverage.textContent());
 const financial=integrated.locator('.financial-disclosure').first();
 assert.equal(await financial.locator('.monthly-payment-summary').isVisible(),false);
 await financial.locator('summary').click();
 assert.equal(await financial.locator('#detailsCashReal').isVisible(),true);
 assert.equal(await integrated.locator('#v11DetailsCosts').isVisible(),true);
 const journal=integrated.locator('#monthlyJournal');
 const journalSummary=journal.locator('summary').first();
 assert.equal(await journal.getAttribute('open'),null);
 assert.equal(await journal.locator('#dayRows').isVisible(),false);
 assert.ok((await journalSummary.boundingBox()).height>=44);
 await journalSummary.click();
 assert.equal(await journal.locator('#dayRows').isVisible(),true);
 assert.equal(await journal.getByRole('button',{name:'+ Carburant'}).isVisible(),true);
 await journalSummary.press('Enter');
 assert.equal(await journal.locator('#dayRows').isVisible(),false);
 await integrated.evaluate(()=>scrollTo(0,0));
 const bilanTitle=await integrated.locator('#detailsHeading').boundingBox();
 await swipeScreen(integrated,bilanTitle.x+10,bilanTitle.y+7,115);
 assert.deepEqual(await integrated.evaluate(()=>refreshGestureCalls),['home','details']);
 assert.equal(await journal.getAttribute('open'),null);
 await integrated.waitForTimeout(950);
 await integrated.evaluate(()=>{
  refreshGestureObserver.disconnect();
  document.body.classList.remove('taxi-refreshing','taxi-refresh-error');
  document.querySelector('#fullRefreshIndicator').hidden=true;
 });
 await integrated.locator('#taxiPageLocation [data-location="home"]').click();
 await integrated.setViewportSize({width:320,height:560});
 await integrated.evaluate(key=>{
  const book=JSON.parse(localStorage.getItem(key)||'{"drivers":[],"deletedNativeIds":[]}');
  window.restoreDriverFixture=localStorage.getItem(key);
  book.lastSyncedAt='2026-11-19T15:00:00Z';
  book.drivers=Array.from({length:14},(_,index)=>({id:'compact-'+index,name:'TX Chauffeur '+index,phone:'04701234'+String(index).padStart(2,'0'),category:'car'}));
  localStorage.setItem(key,JSON.stringify(book));window.dispatchEvent(new StorageEvent('storage',{key}));
 },KEY);
 await integrated.click('#openTaxiDrivers');
 assert.equal(await integrated.locator('#driversSearch').isVisible(),true);
 for(const id of ['driversLastSync','driversSort','driversPriorityLegend','driversTx']){
  assert.equal(await integrated.locator('#'+id).isVisible(),false);
 }
 const compact=await integrated.locator('#taxiDrivers').evaluate(dialog=>{
  const area=dialog.getBoundingClientRect();
  const list=dialog.querySelector('#driversList');
  const rows=[...list.children].filter(row=>row.getBoundingClientRect().bottom<=area.bottom);
  const filters=[...dialog.querySelectorAll('#driversVanFilter,#driversPeriodFilters,#driversManagement summary')];
  return { visible:rows.length,listGap:list.getBoundingClientRect().top-dialog.querySelector('#driversListControls').getBoundingClientRect().bottom,overflow:dialog.scrollWidth>dialog.clientWidth,
   filterLine:Math.max(...filters.map(el=>el.getBoundingClientRect().top))-Math.min(...filters.map(el=>el.getBoundingClientRect().top))<2,
   keyboard:document.activeElement===dialog.querySelector('#driversSearch') };
 });
 assert.ok(compact.visible>=4&&compact.listGap>=0&&compact.listGap<=12&&!compact.overflow&&compact.filterLine&&!compact.keyboard,JSON.stringify(compact));
 await openDriverOptions(integrated);
 assert.equal(await integrated.locator('#driversLastSync').isVisible(),true);
 assert.equal(await integrated.evaluate(()=>taxiDriverNavigateBack()),true);
 assert.equal(await integrated.locator('#driversManagement').getAttribute('open'),null);
 await integrated.locator('#taxiDrivers [data-close]').click();
 await integrated.evaluate(key=>{
  if(window.restoreDriverFixture===null)localStorage.removeItem(key);
  else localStorage.setItem(key,window.restoreDriverFixture);
  window.dispatchEvent(new StorageEvent('storage',{key}));
 },KEY);
 await integrated.setViewportSize({width:360,height:780});
 await integrated.click('#openTaxiDrivers');await integrated.check('#driversVanOnly');await openDriverOptions(integrated);await integrated.click('#driversAdd');
 await integrated.fill('#driversName','Test intégré');await integrated.fill('#driversPhone','0470123456');await integrated.check('#driversCarEligible');await integrated.check('#driversNight');await integrated.click('#driversSave');await back(integrated);
 assert.equal(await names(integrated).count(),1);assert.equal(await integrated.locator('#taxiDrivers').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await integrated.uncheck('#driversVanOnly');await integrated.click('[data-period="night"]');assert.equal(await names(integrated).count(),1);await integrated.locator('#taxiDrivers [data-close]').click();
 const driversRect=await integrated.locator('#openTaxiDrivers').boundingBox();
 const directRect=await integrated.locator('#openHotelCommissions').boundingBox();
 assert.ok(driversRect.x>=directRect.x+directRect.width);
 assert.equal(driversRect.y,directRect.y);
 assert.equal(await integrated.locator('#hotelSyncStatus').isVisible(),false);
 assert.equal(await integrated.locator('#openTaxiDrivers').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 99, 61)');
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
 const sophia=await frame.evaluate(()=>{
  const snapshot=localStorage.getItem(configKey);
  const old=JSON.parse(snapshot);
  const fresh=contactsForHotel('The Standard').includes('Sophia');
  delete old.standardSophiaAdded;
  old.contacts=old.contacts.filter(name=>name!=='Sophia').concat('Contact local');
  old.allowedContacts['The Standard']=old.allowedContacts['The Standard'].filter(name=>name!=='Sophia').concat('Contact local');
  old.hotels['The Standard']='Contact local';
  localStorage.setItem(configKey,JSON.stringify(old));
  window.dispatchEvent(new Event('mon-taxi-hotel-sync'));
  window.dispatchEvent(new Event('mon-taxi-hotel-sync'));
  const names=contactsForHotel('The Standard');
  const previousGroup=commissionHotel;commissionHotel='The Standard';renderPots();
  const result={fresh,names,defaultContact:config.hotels['The Standard'],canDrive:canDrive('Sophia'),commission:$('contactPots').textContent.includes('Sophia')};
  commissionHotel=previousGroup;
  localStorage.setItem(configKey,snapshot);
  window.dispatchEvent(new Event('mon-taxi-hotel-sync'));
  return result;
 });
 assert.equal(sophia.fresh,true);
 assert.equal(sophia.names.filter(name=>name==='Sophia').length,1);
 assert.ok(sophia.names.includes('Contact local'));
 assert.equal(sophia.defaultContact,'Contact local');
 assert.equal(sophia.canDrive,false);
 assert.equal(sophia.commission,true);

 const copied=await frame.evaluate(async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedCourse=text;}}});
  await copyCourse({bookingMode:'Programmée',scheduledDate:'2026-11-20',scheduledTime:'05:15',hotel:'DoubleTree',destination:'Zaventem',room:'0123',passengers:4,clientName:'Mme Dupont',clientPhone:'+32470123456',announcedPrice:74.79,amount:10,vehicle:'Van',driver:'self'});return window.__copiedCourse;
 });
 assert.match(copied,/DoubleTree → Airport BRU \(Zaventem\)/);assert.match(copied,/Chambre : 0123/);assert.match(copied,/20\/11\/2026 à 05:15/);assert.match(copied,/^ATTENTION — PRIX FIXÉ : 74,79\s€/);assert.match(copied,/Client : Mme Dupont\nTéléphone : \+32470123456/);assert.doesNotMatch(copied,/10,00/);assert.match(copied,/Passagers : 4/);
 const pickupCopied=await frame.evaluate(async()=>{await copyCourse({bookingMode:'Direct',date:'2026-11-20',recordedTime:'05:15',hotel:'Standard',destination:'Hôtel',room:'7A',vehicle:'Van',driver:'self',pickup:{place:'Charleroi Airport (CRL)',client:'Client existant',phone:'0470000000'}});return window.__copiedCourse;});
 assert.match(pickupCopied,/Airport CRL \(Charleroi\) → Hôtel/);assert.match(pickupCopied,/Chambre : 7A/);assert.match(pickupCopied,/Client : Client existant/);assert.doesNotMatch(pickupCopied,/PRIX FIXÉ|Chauffeur :/);
 await integrated.setViewportSize({width:320,height:620});
 await integrated.evaluate(()=>openHotelModule('direct'));
 await frame.click('#rideDropoff');
 await frame.evaluate(()=>showStep('details'));
 await checkBookingRoom(frame,'room');
 const direct=await frame.evaluate(()=>{
  const initial=data.length;setDriverChoice('direct','self');$('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Voiture normale',false);selected=10;
  $('room').value='0240';$('directClientName').value='Mme Test';$('directClientPhone').value='+32470000000';$('directFlight').value='SN123';$('directCompany').value='Brussels Airlines';$('directPassengers').value='4';$('add').onclick();
  const first=data.at(-1);const count=data.length-initial;const cleared=['directClientName','directClientPhone','directFlight','directCompany'].every(id=>$(id).value==='');
  $('hotel').value='The Standard';refreshContacts();$('contact').value='Fal';setVehicle('Voiture normale',false);selected=10;$('add').onclick();
  return {count,first,second:data.at(-1),cleared,total:data.length-initial,error:$('message').textContent};
 });
 assert.equal(direct.count,1,direct.error);assert.equal(direct.first.room,'0240');assert.equal(direct.first.clientName,'Mme Test');assert.equal(direct.first.clientPhone,'+32470000000');assert.equal(direct.first.passengers,4);assert.equal(direct.first.flight,'SN123');assert.equal(direct.first.company,'Brussels Airlines');assert.equal(direct.cleared,true);assert.equal(direct.total,2);assert.equal(direct.second.clientName,'');assert.equal(direct.second.clientPhone,'');assert.equal(direct.second.passengers,null);
 const reservation=await frame.evaluate(()=>{
  openReservations($('openTodayReservations'));
  const today=reservationClock().slice(0,10);const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10);
  const original={id:'optional-client-reservation',reservationBoard:true,hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',bookingMode:'Programmée',reservationStatus:'pending',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',vehicle:'Voiture normale',vehicleChoice:'Voiture normale',carCount:1,vanCount:0,destination:'Zaventem',amount:10,pricing:'Compteur',announcedPrice:null,room:'240',clientName:'Nom initial',clientPhone:'0470000000',flight:'BA388',company:'British Airways',passengers:3};
  data.push(original);showReservationForm(original,false);
  $('reservationStandardContacts').querySelector('[data-contact="Sophia"]').click();
  const loaded={name:$('reservationClientName').value,phone:$('reservationClientPhone').value,flight:$('reservationFlight').value,company:$('reservationCompany').value};showReservationStep(reservationSaveStep);
  $('reservationRoom').value='0240';$('reservationClientName').value='Nom modifié';$('reservationClientPhone').value='+32470000001';$('reservationPassengers').value='5';$('reservationForm').onsubmit({preventDefault(){}});
  const edited=data.find(e=>e.id===original.id);showReservationForm(edited,false);showReservationStep(reservationSaveStep);$('reservationClientName').value='';$('reservationClientPhone').value='';$('reservationPassengers').value='';$('reservationForm').onsubmit({preventDefault(){}});
  return {loaded,edited,cleared:data.find(e=>e.id===original.id),error:$('reservationMessage').textContent};
 });
 assert.equal(reservation.loaded.name,'Nom initial');assert.equal(reservation.loaded.flight,'BA388');assert.equal(reservation.loaded.company,'British Airways');assert.equal(reservation.edited.flight,'BA388');assert.equal(reservation.edited.company,'British Airways');assert.equal(reservation.edited.room,'0240');assert.equal(reservation.edited.clientName,'Nom modifié',reservation.error);assert.equal(reservation.edited.clientPhone,'+32470000001');assert.equal(reservation.edited.contact,'Sophia');assert.equal(reservation.cleared.clientName,'');assert.equal(reservation.cleared.clientPhone,'');assert.equal(reservation.edited.passengers,5);assert.equal(reservation.cleared.passengers,null);
 await frame.evaluate(id=>{showReservationForm(data.find(course=>course.id===id),false);showReservationStep(reservationSaveStep);},reservation.edited.id);
 await checkBookingRoom(frame,'reservationRoom');
 // The real pick-up save handler must also accept blank client fields.
 await integrated.evaluate(()=>{window.pickupSaved=[];openHotelPickup({mode:'Réservation',today:'2026-11-20',hotels:['Test Hôtel'],contacts:{'Test Hôtel':['Contact']},drivers:[],save:form=>{pickupSaved.push(form);return 'Validation du test';}});});
 await integrated.waitForFunction(()=>!!document.querySelector('#hotelPickupFrame')?.contentDocument?.querySelector('#client'));
 const pickupFrame=await (await integrated.$('#hotelPickupFrame')).contentFrame();
 await pickupFrame.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--clean-bg').trim()==='#10151c');
 const pickupPlace=pickupFrame.locator('#place');
 assert.deepEqual(await pickupPlace.locator('option').allTextContents(),['Bruxelles Aéroport (BRU)','Charleroi Airport (CRL)']);
 await pickupPlace.selectOption('Charleroi Airport (CRL)');
 await pickupFrame.getByRole('button',{name:'Gare',exact:true}).click();
 assert.deepEqual(await pickupPlace.locator('option').allTextContents(),['Gare du Midi','Gare du Nord','Gare Centrale']);
 assert.equal(await pickupFrame.getByLabel('Numéro de train').isVisible(),true);
 await pickupPlace.selectOption('Gare du Nord');
 await pickupFrame.getByRole('button',{name:'Aéroport',exact:true}).click();
 assert.equal(await pickupPlace.inputValue(),'Charleroi Airport (CRL)');
 await pickupFrame.getByRole('button',{name:'Gare',exact:true}).click();
 assert.equal(await pickupPlace.inputValue(),'Gare du Nord');
 await pickupFrame.getByRole('button',{name:'Autre',exact:true}).click();
 assert.equal(await pickupPlace.isVisible(),false);
 assert.equal(await pickupFrame.getByLabel('Lieu de prise en charge').isVisible(),true);
 await pickupFrame.getByRole('button',{name:'Gare',exact:true}).click();
 assert.equal(await pickupFrame.locator('.pickup-details[open]').count(),0);
 await pickupFrame.getByText('Client, bagages et rappels',{exact:true}).click();
 await checkBookingRoom(pickupFrame,'room');
 await pickupFrame.fill('#room','0204');
 await pickupFrame.fill('#hotelSearch','hot te');
 await pickupFrame.getByRole('button',{name:'Test Hôtel',exact:true}).click();
 assert.equal(await pickupFrame.inputValue('#hotelSearch'),'Test Hôtel');
 const pickupOptional=await pickupFrame.evaluate(()=>{
  window.alert=message=>{throw Error(message)};window.confirm=()=>true;
  $('date').value='2026-11-20';$('timeMode').value='fixed';$('time').value='05:15';$('hotelSearch').value='Test Hôtel';$('contactSearch').value='Contact';$('driverSearch').value='Moi';$('flight').value='9123';$('vans').value='1';$('passengers').value='1';$('commissionUnit').value='10';$('client').value='';$('phone').value='';
  const optional=!$('client').required&&!$('phone').required;$('save').onclick();return optional;
 });
 assert.equal(pickupOptional,true);const pickupSaved=await integrated.evaluate(()=>pickupSaved);assert.equal(pickupSaved.length,1);assert.equal(pickupSaved[0].client,'');assert.equal(pickupSaved[0].phone,'');assert.equal(pickupSaved[0].room,'0204');assert.equal(pickupSaved[0].place,'Gare du Nord');await integrated.evaluate(()=>document.getElementById('closeHotelPickup').click());
 await frame.evaluate(()=>openPickupEditor('Réservation'));
 const pickupPapa=pickupFrame.getByRole('button',{name:'Papa',exact:true});
 await pickupFrame.locator('#hotelSearch').fill('DoubleTree');
 await pickupFrame.getByRole('button',{name:'DoubleTree',exact:true}).click();
 assert.equal(await pickupFrame.inputValue('#hotelSearch'),'DoubleTree');
 assert.equal(await pickupFrame.inputValue('#hotel'),'DoubleTree by Hilton');
 const pickupShift=pickupFrame.locator('#pickupAutoContact');
 await pickupFrame.locator('#timeHour').fill('06');
 await pickupFrame.locator('#timeMinute').fill('59');
 assert.equal(await pickupShift.innerText(),'Night');
 await pickupPapa.click();
 assert.equal(await pickupShift.innerText(),'Papas');
 await pickupFrame.locator('#timeHour').fill('07');
 await pickupFrame.locator('#timeMinute').fill('00');
 assert.equal(await pickupShift.innerText(),'Papas');
 await pickupPapa.click();
 assert.equal(await pickupShift.innerText(),'Day');
 await pickupFrame.locator('#timeMode').selectOption('arrival');
 await pickupFrame.locator('#arrivalHour').fill('23');
 await pickupFrame.locator('#arrivalMinute').fill('00');
 assert.equal(await pickupShift.innerText(),'Night');
 await integrated.evaluate(()=>document.getElementById('closeHotelPickup').click());
 await integrated.setViewportSize({width:360,height:780});
 await integrated.evaluate(()=>openTaxiDrivers({id:'planning',date:'2026-11-20',hotel:'Standard',destination:'CRL',clientName:'Mme Test',clientPhone:'0470000000'}));
 await select(integrated,'Test intégré');await details(integrated).getByRole('button',{name:'SMS',exact:true}).click();assert.match(await integrated.inputValue('#driversMessage'),/Standard → Airport CRL \(Charleroi\)/);assert.match(await integrated.inputValue('#driversMessage'),/Client : Mme Test/);
 await integrated.click('#driversSms');const sent=await integrated.evaluate(()=>externalActions.at(-1));assert.equal(sent.home,true);assert.equal(sent.directoryClosed,true);assert.equal(sent.planningClosed,true);assert.ok(sent.url.startsWith('sms:'));
 // Course-linked calls, vehicle filtering, last-driver confirmation and the reverse import path.
 await integrated.evaluate(()=>window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:{mode:'sync',contacts:[{nativeId:'81',name:'TX Petit test',phone:'0470101010'},{nativeId:'82',name:'TX Van uniquement',phone:'0470202020'}]}})));
 const linked=await frame.evaluate(()=>{
  const future=reservationClock(new Date(Date.now()+86400000)).slice(0,10),today=reservationClock().slice(0,10);
  const base={bookingMode:'Programmée',reservationBoard:true,reservationStatus:'pending',hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',date:today,recordedTime:'12:00',receivedAt:today+'T12:00',scheduledDate:future,scheduledTime:'15:00',room:'204',clientName:'Client lié',clientPhone:'+32470000011',flight:'SN123',company:'Brussels Airlines',passengers:5,amount:10,announcedPrice:90,pricing:'Forfait'};
  const van={...base,id:'linked-van',vehicle:'Van',vehicleChoice:'Van',carCount:0,vanCount:1};const car={...base,id:'linked-car',vehicle:'Voiture normale',vehicleChoice:'Voiture normale',carCount:1,vanCount:0,destination:'Zaventem'};van.destination='Charleroi';data.push(van,car);save();return {van,car};
 });
 await integrated.evaluate(()=>openHotelModule('planning'));
 const vanRow=frame.locator('.reservation-card[data-entry-id="linked-van"]');
 const driverIds=await integrated.evaluate(key=>Object.fromEntries(JSON.parse(localStorage.getItem(key)).drivers.map(driver=>[driver.phone,driver.id])),KEY);
 const storedCourse=id=>integrated.evaluate(id=>JSON.parse(localStorage.getItem('montaxi:hotel-commissions:courses-v1')).find(course=>course.id===id),id);
 const editableDirect={...linked.car,id:'field-edit-direct',bookingMode:'Direct',hotel:'NH Collection (Atlanta)',
  hotelGroup:'Autre',contact:'Yassine',recordedTime:'04:30',room:'204'};
 delete editableDirect.scheduledDate;
 delete editableDirect.scheduledTime;
 await frame.evaluate(course=>{data.push(course);save();renderReservations();},editableDirect);
 const editRow=frame.locator('[data-entry-id="field-edit-direct"]');
 assert.equal(await editRow.locator('.planning-route-title').textContent(),'NH (Atlanta) → Airport BRU');
 const editGroup=editRow.getByRole('group',{name:'Modifier la course'});
 assert.equal(await editGroup.getByRole('button').count(),5);
 const fieldDialog=frame.locator('#planningFieldDialog');
 async function editCourseField(label,value,choice=false){
  await editGroup.getByRole('button',{name:label,exact:true}).click();
  if(choice)await fieldDialog.locator('select').selectOption({label:value});
  else await fieldDialog.locator('input').fill(value);
  await fieldDialog.getByRole('button',{name:'Enregistrer',exact:true}).click();
  assert.equal(await fieldDialog.isVisible(),false);
 }
 await editCourseField('Modifier l’heure','05:20');
 await editCourseField('Modifier la destination','Airport CRL');
 await editCourseField('Modifier le départ','Moxy');
 await editCourseField('Modifier le contact','Karim');
 await editCourseField('Modifier le chauffeur','TX Petit test',true);
 const editedDirect=await storedCourse(editableDirect.id);
 assert.equal(editedDirect.bookingMode,'Direct');
 assert.equal(editedDirect.recordedTime,'05:20');
 assert.equal(editedDirect.hotel,'Moxy');
 assert.equal(editedDirect.destination,'Charleroi');
 assert.equal(editedDirect.contact,'Karim');
 assert.equal(editedDirect.driverName,'Petit test');
 assert.equal(editedDirect.room,'204');
 assert.equal(editedDirect.amount,editableDirect.amount);
 await editGroup.getByRole('button',{name:'Modifier le contact'}).click();
 await fieldDialog.locator('input').fill('Changement annulé');
 await fieldDialog.getByRole('button',{name:'Annuler',exact:true}).click();
 assert.equal((await storedCourse(editableDirect.id)).contact,'Karim');
 await frame.evaluate(id=>{data=data.filter(course=>course.id!==id);save();renderReservations();},editableDirect.id);
 await integrated.setViewportSize({width:320,height:680});
 const planningHeader=await frame.evaluate(course=>{
  const list=$('reservationList');
  const filter=$('reservationPeriodBox');
  const heading=$('reservationBoardTitle');
  const first=list.querySelector('.reservation-card:not([hidden])');
  const compact={
   filterHidden:getComputedStyle(filter).display==='none',
   localBackHidden:getComputedStyle($('closeReservations')).display==='none',
   monthCount:list.querySelectorAll('[data-group-heading="month"]').length,
   firstDayVisible:!first.previousElementSibling.hidden&&first.previousElementSibling.dataset.groupHeading==='day',
   offset:first.getBoundingClientRect().top-heading.getBoundingClientRect().top
  };
  data.push({...course,id:'compact-header-archived',reservationStatus:'validated',validatedAt:course.receivedAt});
  selectReservationBoardStatus('history');
  const archives={
   filterVisible:filter.getClientRects().length>0,
   hasMonthHeading:!!list.querySelector('[data-group-heading="month"]'),
   hasMonthSearch:!!filter.querySelector('button')
  };
  data.pop();
  openScheduleBoard('upcoming');
  return {compact,archives};
 },linked.car);
 assert.equal(planningHeader.compact.filterHidden,true);
 assert.equal(planningHeader.compact.localBackHidden,true);
 const fixedNavigation=integrated.locator('#taxiQuickNavigation');
 const fixedBack=fixedNavigation.getByRole('button',{name:'Page précédente',exact:true});
 assert.equal(await fixedBack.isVisible(),true);
 assert.equal(await fixedNavigation.getByRole('button',{name:'Retour à l’accueil',exact:true}).isVisible(),true);
 await fixedBack.click();
 assert.equal(await frame.locator('#reservationsOverlay').isVisible(),false);
 await integrated.evaluate(()=>openHotelModule('planning'));
 assert.equal(planningHeader.compact.monthCount,0);
 assert.equal(planningHeader.compact.firstDayVisible,true);
 assert.ok(planningHeader.compact.offset>0&&planningHeader.compact.offset<100,JSON.stringify(planningHeader));
 assert.deepEqual(planningHeader.archives,{filterVisible:true,hasMonthHeading:true,hasMonthSearch:true});
 const planningStyles=await frame.evaluate(course=>{
  const hotels=[
   {...course,id:'color-doubletree',hotel:'DoubleTree by Hilton',hotelGroup:'DoubleTree by Hilton',destination:'Airport BRU'},
   {...course,id:'color-moxy',hotel:'Moxy',hotelGroup:'Autre',driver:'other',driverName:'ChauffeurAvecUnNomExceptionnellementLongPourVérifierLeRetourÀLaLigne'},
   {...course,id:'color-pickup',hotel:'The Standard',pickup:{place:'BRU',passengers:1},destination:'The Standard'},
   {...course,id:'station-pickup',hotel:'The Standard',pickup:{place:'Gare Centrale',passengers:1},destination:'The Standard'},
   {...course,id:'dolce-dropoff',hotel:'Hôtel Dolce',destination:'Airport BRU'},
   {...course,id:'dolce-pickup',hotel:'Hôtel Dolce',destination:'Hôtel Dolce',pickup:{place:'Bruxelles Aéroport (BRU)'}},
   {...course,id:'office-pickup',hotel:'The Standard',destination:'Bureau',pickup:{place:'BRU'}},
   {...course,id:'crl-pickup',destination:'The Standard',pickup:{place:'Charleroi Airport (CRL)'}},
   {...course,id:'station-dropoff',destination:'Gare du Midi'},
   {...course,id:'other-dropoff',destination:'Autre',otherDestination:'Palais des congrès'},
   {...course,id:'long-route',hotel:'Hôtel de la très longue avenue des grands boulevards de Bruxelles',destination:'Adresse particulièrement longue sans abréviation à Anderlecht'}
  ];
  data.push(...hotels);
  renderReservations();
  const title=id=>$('reservationList').querySelector('[data-entry-id="'+id+'"] .reservation-card-title');
  const style=el=>{const computed=getComputedStyle(el);return [computed.color,computed.fontSize];};
  const moxyColor=style(title('color-moxy').lastElementChild)[0];
  data.reverse();renderReservations();data.reverse();
  const result={
   time:style(title('linked-van').querySelector('time')),
   hasRouteIcons:hotels.some(({id})=>title(id).querySelector('img, [role="img"]')),
   hasClock:hotels.every(({id})=>title(id).firstElementChild.tagName==='TIME'),
   standard:style(title('linked-van').lastElementChild),
   doubleTree:style(title('color-doubletree').lastElementChild),
   moxyColor,moxyAfterRender:style(title('color-moxy').lastElementChild)[0],
   titles:Object.fromEntries(['color-doubletree','color-pickup','crl-pickup','station-pickup','station-dropoff','dolce-dropoff','dolce-pickup','linked-van','office-pickup','other-dropoff'].map(id=>[id,title(id).querySelector('.planning-route-title').textContent])),

   routeFit:Object.fromEntries(['color-doubletree','dolce-pickup','crl-pickup','station-pickup','long-route'].map(id=>{
    const route=title(id).querySelector('.planning-route-title');
    const text=route.firstElementChild;
    return [id,{width:route.clientWidth,content:route.scrollWidth,font:Number.parseFloat(getComputedStyle(text).fontSize),
     noWrap:getComputedStyle(route).whiteSpace==='nowrap',
     title:route.title,scrollable:route.tabIndex===0}];
   })),
   routeSummary:title('color-pickup').parentElement.querySelector('.reservation-card-route').textContent,
   pickupDetails:title('color-pickup').parentElement.textContent,
   people:[...title('linked-van').parentElement.querySelectorAll('.reservation-card-people :is(select,strong)')].map(el=>[el.selectedOptions?.[0].textContent||el.textContent,style(el)[1]]),
   textSize:style(title('linked-van').parentElement.querySelector('.reservation-card-info > small'))[1],
   narrowFits:document.querySelector('[data-entry-id="color-moxy"]').scrollWidth<=document.querySelector('[data-entry-id="color-moxy"]').clientWidth
  };
  data.splice(-hotels.length);
  renderReservations();
  return result;
 },linked.car);
 assert.deepEqual(planningStyles.time,['rgb(165, 209, 255)','18px']);
 assert.equal(planningStyles.hasRouteIcons,false);
 assert.equal(planningStyles.hasClock,true);
 assert.deepEqual(planningStyles.standard,['rgb(213, 186, 255)','19px']);
 assert.deepEqual(planningStyles.doubleTree,['rgb(255, 210, 134)','19px']);
 assert.equal(planningStyles.moxyColor,planningStyles.moxyAfterRender);
 assert.deepEqual(planningStyles.titles,{
  'color-doubletree':'DoubleTree → Airport BRU',
  'color-pickup':'Airport BRU → The Standard',
  'crl-pickup':'Airport CRL (Charleroi) → The Standard',
  'station-pickup':'Gare Centrale → The Standard',
  'station-dropoff':'The Standard → Gare du Midi',
  'dolce-dropoff':'Hôtel Dolce → Airport BRU',
  'dolce-pickup':'Airport BRU → Hôtel Dolce',
  'linked-van':'The Standard → Airport CRL (Charleroi)',
  'office-pickup':'Airport BRU → Bureau',
  'other-dropoff':'The Standard → Palais des congrès'
 });
 for(const id of ['color-doubletree','dolce-pickup','crl-pickup','station-pickup']){
  const fit=planningStyles.routeFit[id];
  assert.ok(fit.noWrap&&fit.content<=fit.width&&fit.font>=11&&fit.font<=19,JSON.stringify({id,...fit}));
 }
 const longRoute=planningStyles.routeFit['long-route'];
 assert.ok(longRoute.scrollable&&longRoute.noWrap&&longRoute.content>longRoute.width&&longRoute.font===11);
 assert.match(longRoute.title,/Hôtel de la très longue avenue/);
 assert.doesNotMatch(planningStyles.routeSummary,/Airport|→/);
 assert.match(planningStyles.pickupDetails,/Contact · Fal/);
 assert.deepEqual(planningStyles.people,[['Moi','18px'],['Fal','18px']]);
 assert.equal(planningStyles.textSize,'16px');
 assert.ok(planningStyles.narrowFits);
 const contactCard=frame.locator('[data-entry-id="linked-car"] .planning-client-contact');
 const whatsApp=contactCard.getByRole('link',{name:'WhatsApp'});
 const clientSms=contactCard.getByRole('link',{name:'SMS'});
 assert.equal(await whatsApp.getAttribute('href'),'https://wa.me/32470000011');
 assert.equal(await whatsApp.getAttribute('target'),'_blank');
 assert.equal(await clientSms.getAttribute('href'),'sms:+32470000011');
 await whatsApp.click();
 assert.match(await contactCard.getByRole('status').innerText(),/WhatsApp indisponible/);
 await integrated.evaluate(()=>{window.TaxiContacts.openWhatsApp=number=>window.clientChat=number});
 await frame.evaluate(()=>renderReservations());
 await whatsApp.click();
 assert.equal(await integrated.evaluate(()=>window.clientChat),'+32470000011');
 await clientSms.click();
 assert.equal(await integrated.evaluate(()=>externalActions.at(-1).url),'sms:+32470000011');
 assert.equal(await integrated.evaluate(()=>externalActions.at(-1).planningClosed),false);
 await integrated.evaluate(()=>delete window.TaxiContacts.openWhatsApp);
 const clientLinks=await frame.evaluate(course=>{
  const previousFilter=reservationBoardStatus;
  const examples=[
   {...course,id:'client-direct',bookingMode:'Direct',clientPhone:'0470 12 34 56'},
   {...course,id:'client-transfer',destination:'Gare du Midi',clientPhone:'0044 7700 900123'},
   {...course,id:'client-historical',reservationStatus:'validated'},
   {...course,id:'client-legacy-pickup',clientPhone:'',pickup:{place:'BRU',client:'Client existant',phone:'+33 6 12 34 56 78'}},
   {...course,id:'client-no-phone',clientPhone:''}
  ];
  data.push(...examples);
  reservationBoardStatus='all';
  renderReservations();
  const links=Object.fromEntries(examples.map(({id})=>[
   id,[...$('reservationList').querySelectorAll('[data-entry-id="'+id+'"] .planning-client-actions a')].map(link=>link.getAttribute('href'))
  ]));
  reservationBoardStatus=previousFilter;
  data.splice(-examples.length);
  renderReservations();
  return links;
 },linked.car);
 assert.deepEqual(clientLinks,{
  'client-direct':['https://wa.me/32470123456','sms:+32470123456'],
  'client-transfer':['https://wa.me/447700900123','sms:+447700900123'],
  'client-historical':['https://wa.me/32470000011','sms:+32470000011'],
  'client-legacy-pickup':['https://wa.me/33612345678','sms:+33612345678'],
  'client-no-phone':[]
 });
 const courseActions=frame.locator('[data-entry-id="linked-car"] .course-contact-actions');
 assert.deepEqual(await courseActions.getByRole('button').evaluateAll(buttons=>buttons.map(button=>{
  const style=getComputedStyle(button);
  return [button.textContent,style.backgroundColor,style.color,button.getBoundingClientRect().height>=44];
 })),[
  ['Exporter au chauffeur','rgb(36, 115, 58)','rgb(255, 255, 255)',true],
  ['Attribuer à','rgb(38, 91, 152)','rgb(255, 255, 255)',true],
  ['Supprimer la course','rgb(115, 55, 64)','rgb(255, 255, 255)',true]
 ]);
 const references=await frame.evaluate(course=>{
  const date=course.scheduledDate;
  const {nextReference,referenceCountersKey}=window.parent.TaxiHotels;
  const counters=JSON.parse(localStorage.getItem(referenceCountersKey)||'{}');
  const firstExpected=nextReference(date,data,counters).reference;
  const emptyDay=nextReference('2026-11-19',[],{}).reference;
  const first={...course,id:'first-reference'};
  const second={...course,id:'second-reference'};
  const firstSaved=saveNewCourse(first);
  const firstReference=data.find(item=>item.id===first.id).reference;
  data=data.filter(item=>item.id!==first.id);
  save();
  const secondSaved=saveNewCourse(second);
  const savedSecond=data.find(item=>item.id===second.id);
  renderReservations();
  const migratedInput={courses:{
   pickup:{bookingMode:'Programmée',date:'2026-11-19',scheduledDate:'2026-11-22',reference:'261119.02'},
   dropoff:{bookingMode:'Programmée',date:'2026-11-19',scheduledDate:'2026-11-23',reference:'261119.03'},
   direct:{bookingMode:'Direct',date:'2026-11-19',reference:'261119.01'},
   legacy:{bookingMode:'Programmée',date:'2026-11-19',scheduledDate:'2026-11-22'}
  }};
  const migrate=window.parent.TaxiHotels.reconcileReferences;
  const corrected=migrate(migratedInput,migratedInput);
  const changedDate={...corrected,courses:{...corrected.courses,
   pickup:{...corrected.courses.pickup,scheduledDate:'2026-11-23'}
  }};
  const rescheduled=migrate(changedDate,corrected);
  const idempotent=window.parent.TaxiHotels.equal(corrected,migrate(corrected,corrected));
  const displayed=$('reservationList').querySelector('[data-entry-id="second-reference"] .reservation-card-reference').textContent;
  const legacy=$('reservationList').querySelector('[data-entry-id="linked-car"] .reservation-card-reference');
  const sms=window.parent.TaxiDriverDirectoryCore.courseText(savedSecond);
  const third=window.parent.TaxiHotels.nextReference('2026-11-19',[],{'261119':99}).reference;
  const published={courses:{remote:{reference:'261119.01'}},referenceCounters:{'261119':2}};
  const reconciled=window.parent.TaxiHotels.reconcileReferences({
   courses:{...published.courses,local:{reference:'261119.02'},untouched:{}}
  },published);
  data=data.filter(item=>item.id!==second.id);
  save();
  renderReservations();
  return {firstExpected,emptyDay,firstSaved,secondSaved,firstReference,secondReference:savedSecond.reference,displayed,
   legacy:legacy===null,sms,third,reconciled,corrected,rescheduled,idempotent};
 },linked.car);
 assert.equal(references.firstSaved&&references.secondSaved,true);
 assert.equal(references.emptyDay,'261119.01');
 assert.equal(references.corrected.courses.pickup.reference,'261122.01');
 assert.equal(references.corrected.courses.dropoff.reference,'261123.01');
 assert.equal(references.corrected.courses.direct.reference,'261119.01');
 assert.equal(references.corrected.courses.legacy.reference,undefined);
 assert.equal(references.rescheduled.courses.pickup.reference,'261123.02');
 assert.equal(references.idempotent,true);
 assert.equal(references.firstReference,references.firstExpected);
 assert.equal(Number(references.secondReference.split('.')[1]),Number(references.firstReference.split('.')[1])+1);
 assert.equal(references.displayed,'Réf. '+references.secondReference);
 assert.ok(references.legacy);
 assert.ok(references.sms.includes('Réf. '+references.secondReference));
 assert.equal(references.third,'261119.100');
 assert.deepEqual(references.reconciled.courses,{remote:{reference:'261119.01'},local:{reference:'261119.03'},untouched:{}});
 await integrated.setViewportSize({width:360,height:780});
 const temporaryId='planning-removal';
 await frame.evaluate(course=>{data.push(course);save();renderReservations();},{...linked.car,id:temporaryId});
 const temporaryRow=frame.locator(`.reservation-card[data-entry-id="${temporaryId}"]`);
 const removeCourse=temporaryRow.getByRole('button',{name:'Supprimer la course',exact:true});
 assert.equal(await temporaryRow.locator('.course-options').getAttribute('open'),null);
 assert.equal(await removeCourse.isVisible(),true);
 integrated.once('dialog',dialog=>dialog.dismiss());
 await removeCourse.click();
 assert.equal(await temporaryRow.isVisible(),true);
 integrated.once('dialog',dialog=>dialog.accept());
 await removeCourse.click();
 assert.equal(await temporaryRow.count(),0);
 assert.equal(await vanRow.isVisible(),true);
 assert.equal(await frame.locator('#reservationBoardMessage').textContent(),'Course supprimée.');
 assert.equal(await frame.evaluate(id=>readCourses(localStorage.getItem(key)).some(course=>course.id===id),temporaryId),false);
 const earlyDoubleTree={...linked.car,id:'planning-early-papa',hotel:'DoubleTree by Hilton',hotelGroup:'DoubleTree by Hilton',contact:'Night',scheduledTime:'06:40'};
 await frame.evaluate(course=>{data.push(course);save();renderReservations();},earlyDoubleTree);
 const earlyRow=frame.locator('.reservation-card[data-entry-id="planning-early-papa"]');
 await earlyRow.getByText('Contact · Night',{exact:true}).waitFor();
 const earlyPapa=earlyRow.getByRole('button',{name:'Papa',exact:true});
 const earlyContact=earlyRow.getByText('Contact · Night',{exact:true});
 const [papaBox,contactBox]=await Promise.all([earlyPapa.boundingBox(),earlyContact.boundingBox()]);
 assert.ok(papaBox.x>=contactBox.x+contactBox.width&&papaBox.y<contactBox.y+contactBox.height&&papaBox.width<80,JSON.stringify({papaBox,contactBox}));
 await earlyPapa.click();
 await earlyRow.getByText('Contact · Papas',{exact:true}).waitFor();
 assert.equal(await earlyPapa.getAttribute('aria-pressed'),'true');
 await earlyPapa.click();
 await earlyContact.waitFor();
 assert.equal(await earlyPapa.getAttribute('aria-pressed'),'false');
 assert.deepEqual(await storedCourse(earlyDoubleTree.id),{...earlyDoubleTree,manualReservationShift:''});
 await earlyPapa.click();
 await earlyRow.getByText('Contact · Papas',{exact:true}).waitFor();
 assert.equal(await earlyRow.locator('time').innerText(),'06:40');
 assert.deepEqual(await storedCourse(earlyDoubleTree.id),{...earlyDoubleTree,contact:'Papas',manualReservationShift:'Papas'});
 assert.equal(await frame.evaluate(()=>doubleTreeReservationContact('23:45','Papas')),'Papas');
 assert.equal(await vanRow.getByRole('button',{name:'Papa',exact:true}).count(),0);
 const quickVan=vanRow.getByRole('combobox',{name:'Changer le chauffeur'});
 assert.equal(await quickVan.locator('option').filter({hasText:'TX Petit test'}).count(),0);
 const papaVariants=[
  {...earlyDoubleTree,id:'planning-papa-pickup',scheduledTime:'07:00',contact:'Day',destination:'DoubleTree by Hilton',pickup:{place:'BRU'}},
  {...earlyDoubleTree,id:'planning-papa-direct',bookingMode:'Direct',recordedTime:'23:00',contact:'Night'}
 ];
 await frame.evaluate(courses=>{data.push(...courses);save();renderReservations();},papaVariants);
 for(const course of papaVariants){
  const row=frame.locator('.reservation-card[data-entry-id="'+course.id+'"]');
  assert.equal(await row.locator('.planning-route-title').textContent(),course.pickup?'Airport BRU → DoubleTree':'DoubleTree → Airport BRU');
  const quickDriver=row.getByRole('combobox',{name:'Changer le chauffeur'});
  await quickDriver.selectOption({label:'TX Petit test'});
  assert.deepEqual(await storedCourse(course.id),{...course,driver:'other',driverName:'Petit test',driverDirectoryId:driverIds['0470101010']});
  await quickDriver.selectOption({label:'Moi'});
  assert.deepEqual(await storedCourse(course.id),{...course,driverName:''});
  const papa=row.getByRole('button',{name:'Papa',exact:true});
  await papa.click();
  await row.getByText('Contact · Papas',{exact:true}).waitFor();
  assert.equal((await storedCourse(course.id)).contact,'Papas');
  await papa.click();
  await row.getByText('Contact · '+course.contact,{exact:true}).waitFor();
  assert.equal((await storedCourse(course.id)).contact,course.contact);
 }
 const referrerSms=earlyRow.getByRole('button',{name:'SMS au contact',exact:true});
 await referrerSms.click();
 const referrerPhone=frame.getByRole('dialog',{name:'Téléphone du contact'});
 await referrerPhone.getByRole('textbox',{name:/Papas/}).fill('0470 00 00 22');
 await referrerPhone.getByRole('button',{name:'Enregistrer et ouvrir le SMS'}).click();
 assert.equal(await integrated.evaluate(()=>externalActions.at(-1).url),'sms:+32470000022');
 for(const course of papaVariants){
  const row=frame.locator('.reservation-card[data-entry-id="'+course.id+'"]');
  await row.getByRole('button',{name:'Papa',exact:true}).click();
  await row.getByRole('button',{name:'SMS au contact',exact:true}).click();
  assert.equal(await referrerPhone.isVisible(),false);
  assert.equal(await integrated.evaluate(()=>externalActions.at(-1).url),'sms:+32470000022');
 }
 await earlyPapa.click();
 await referrerSms.click();
 assert.equal(await referrerPhone.getByRole('textbox',{name:/Night/}).inputValue(),'');
 await referrerPhone.getByRole('button',{name:'Annuler'}).click();
 await earlyPapa.click();
 assert.equal(await earlyRow.getByRole('button',{name:'Charger',exact:true}).count(),0);
 assert.equal(await earlyRow.getByRole('button',{name:'Chargé',exact:true}).isVisible(),true);
 const doubleTreeDirect=papaVariants.find(course=>course.bookingMode==='Direct');
 const doubleTreeDirectRow=frame.locator('[data-entry-id="'+doubleTreeDirect.id+'"]');
 const externalCount=await integrated.evaluate(()=>externalActions.length);
 await doubleTreeDirectRow.getByRole('button',{name:'Chargé',exact:true}).click();
 assert.equal((await storedCourse(doubleTreeDirect.id)).reservationStatus,'validated');
 assert.equal(await integrated.evaluate(()=>externalActions.length),externalCount);
 assert.equal(await referrerPhone.isVisible(),false);
 const chargeStandard=vanRow.getByRole('button',{name:'Charger',exact:true});
 await integrated.evaluate(()=>{window.TaxiContacts.openWhatsAppMessage=(number,text)=>{window.commissionChat={number,text}}});
 await chargeStandard.click();
 await referrerPhone.getByRole('textbox',{name:/Fal/}).fill('0470 00 00 33');
 await referrerPhone.getByRole('button',{name:'Enregistrer et ouvrir WhatsApp'}).click();
 const commissionChat=await integrated.evaluate(()=>window.commissionChat);
 assert.equal(commissionChat.number,'+32470000033');
 assert.equal(commissionChat.text,'The Standard 10');
 assert.equal((await storedCourse('linked-van')).reservationStatus,'pending');
 const chargeOther={...linked.car,id:'planning-charge-other',hotel:'Moxy',hotelGroup:'Autre',contact:'Alexis',amount:10};
 await frame.evaluate(course=>{data.push(course);save();renderReservations();},chargeOther);
 const otherRow=frame.locator('[data-entry-id="planning-charge-other"]');
 await otherRow.getByRole('button',{name:'Charger',exact:true}).click();
 await referrerPhone.getByRole('textbox',{name:/Alexis/}).fill('0470 00 00 44');
 await referrerPhone.getByRole('button',{name:'Enregistrer et ouvrir le SMS'}).click();
 assert.equal(decodeURIComponent(await integrated.evaluate(()=>externalActions.at(-1).url)),
  'sms:+32470000044?body=Moxy 10');
 assert.deepEqual(await frame.evaluate(()=>[6,25,50,10.5].map(amount=>planningCommissionMessage({hotel:'Moxy',amount}))),
  ['Moxy 6','Moxy 25','Moxy 50','Moxy 11']);
 assert.equal((await storedCourse(chargeOther.id)).reservationStatus,'pending');
 await otherRow.locator('summary').click();
 assert.equal(await otherRow.getByRole('button',{name:'Effectuée',exact:true}).isVisible(),true);
 await frame.evaluate(id=>{data=data.filter(course=>course.id!==id);save();renderReservations();},chargeOther.id);
 await frame.evaluate(ids=>{data=data.filter(course=>!ids.includes(course.id));save();renderReservations();},papaVariants.map(course=>course.id));

 await vanRow.getByRole('button',{name:'Exporter au chauffeur',exact:true}).click();
 assert.equal(await integrated.locator('#driversVanOnly').isChecked(),true);assert.equal(await integrated.locator('#driversVanOnly').isDisabled(),true);assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','TX Van uniquement']);
 await select(integrated,'Test intégré');
 assert.equal(await integrated.locator('#driversSmsPanel').isVisible(),true);
 assert.equal(await integrated.locator('#driversSms').innerText(),'Attribuer et ouvrir le SMS');
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
 assert.equal((await storedCourse('linked-van')).driver,'self');
 const leaveAndReturn=()=>integrated.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await leaveAndReturn();await integrated.waitForFunction(()=>document.querySelector('#hotelCommissionsDialog').open&&!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver').waitFor();assert.match(await vanRow.locator('.last-called-driver strong').innerText(),/Test intégré/);
 await vanRow.getByRole('button',{name:'Chauffeur suivant',exact:true}).click();assert.match(await details(integrated).locator('h3').innerText(),/uniquement/);await details(integrated).getByRole('button',{name:'Appeler',exact:true}).click();
 await leaveAndReturn();await integrated.waitForFunction(()=>!document.querySelector('#taxiDrivers').open);
 await vanRow.locator('.last-called-driver strong').filter({hasText:'uniquement'}).waitFor();await vanRow.getByRole('button',{name:'J’envoie',exact:true}).click();
 const linkedSms=await integrated.evaluate(()=>externalActions.at(-1));assert.ok(linkedSms.url.startsWith('sms:0470202020?body='));const linkedText=decodeURIComponent(linkedSms.url);for(const value of ['Airport CRL (Charleroi)','Chambre : 204','Client : Client lié','Téléphone : +32470000011','Vol : SN123','Compagnie : Brussels Airlines','Passagers : 5','PRIX FIXÉ : 90,00'])assert.ok(linkedText.includes(value),value);assert.equal(linkedSms.home,true);assert.equal(linkedSms.planningClosed,true);
 assert.deepEqual(await storedCourse('linked-van'),{...linked.van,driver:'other',driverName:'uniquement',driverDirectoryId:driverIds['0470202020']});
 await integrated.evaluate(course=>openTaxiDrivers(course),linked.car);assert.equal(await integrated.locator('#driversVanOnly').isChecked(),false);
 assert.equal(await integrated.locator('#driversVanOnly').isEnabled(),true);
 assert.equal(await names(integrated).count(),3);
 await integrated.check('#driversVanOnly');assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['Test intégré','TX Van uniquement']);await integrated.uncheck('#driversVanOnly');assert.equal(await names(integrated).count(),3);await integrated.locator('#taxiDrivers [data-close]').click();
 await integrated.evaluate(()=>openTaxiDrivers());await select(integrated,'Petit test');await details(integrated).getByRole('button',{name:'Importer une course',exact:true}).click();
 const choices=await integrated.locator('#driversImportCourse option').evaluateAll(options=>options.map(option=>option.value));assert.ok(choices.includes('linked-car'));assert.ok(!choices.includes('linked-van'));
 await integrated.selectOption('#driversImportCourse','linked-car');await integrated.click('#driversImportConfirm');assert.match(await integrated.inputValue('#driversMessage'),/Client : Client lié/);assert.match(await integrated.locator('#driversRecipient').innerText(),/Petit test/);
 assert.equal((await storedCourse('linked-car')).driverName,'Petit test');
 await integrated.click('#driversSms');assert.ok((await integrated.evaluate(()=>externalActions.at(-1).url)).startsWith('sms:0470101010?body='));
 assert.deepEqual(await storedCourse('linked-car'),{...linked.car,driver:'other',driverName:'Petit test',driverDirectoryId:driverIds['0470101010']});
 await integrated.evaluate(()=>openHotelModule('planning'));
 assert.equal(await vanRow.locator('.planning-quick-driver option:checked').textContent(),'TX Van uniquement');
 const carRow=frame.locator('.reservation-card[data-entry-id="linked-car"]');
 const originalDirectory=await integrated.evaluate(key=>localStorage.getItem(key),KEY);
 await integrated.evaluate(({key,ids})=>{
  const directory=JSON.parse(localStorage.getItem(key));
  directory.sortMode='za';
  const priorities=new Map([[ids['0470101010'],1],[ids['0470202020'],2],[ids['0470123456'],3]]);
  for(const driver of directory.drivers)driver.priorityClass=priorities.get(driver.id);
  localStorage.setItem(key,JSON.stringify(directory));
  window.dispatchEvent(new StorageEvent('storage',{key}));
 },{key:KEY,ids:driverIds});
 await vanRow.getByRole('button',{name:'Attribuer à',exact:true}).click();
 assert.equal(await details(integrated).locator('h3').innerText(),'TX Van uniquement');
 assert.equal((await storedCourse('linked-van')).driverName,'uniquement');
 await back(integrated);
 assert.equal(await integrated.locator('#driversVanOnly').isDisabled(),true);
 assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['TX Van uniquement','Test intégré']);
 await integrated.locator('#taxiDrivers [data-close]').click();
 await carRow.getByRole('button',{name:'Attribuer à',exact:true}).click();
 assert.equal(await details(integrated).locator('h3').innerText(),'TX Petit test');
 assert.equal((await storedCourse('linked-car')).driverName,'Petit test');
 await back(integrated);
 assert.equal(await integrated.inputValue('#driversSort'),'priority');
 assert.equal(await integrated.locator('#driversList').getByRole('button',{name:'Moi',exact:true}).isVisible(),true);
 assert.deepEqual(await integrated.locator('.driver-name').allTextContents(),['TX Petit test','TX Van uniquement','Test intégré']);
 assert.equal(await integrated.evaluate(key=>JSON.parse(localStorage.getItem(key)).sortMode,KEY),'za');
 await integrated.evaluate(({key,originalDirectory})=>{
  localStorage.setItem(key,originalDirectory);
  window.dispatchEvent(new StorageEvent('storage',{key}));
 },{key:KEY,originalDirectory});
 await select(integrated,'Test intégré');
 await details(integrated).getByRole('button',{name:'Choisir ce chauffeur',exact:true}).click();
 assert.equal(await carRow.locator('.planning-quick-driver option:checked').textContent(),'Test intégré');
 assert.deepEqual(await storedCourse('linked-car'),{...linked.car,driver:'other',driverName:'Test intégré',driverDirectoryId:driverIds['0470123456']});
 await carRow.locator('.course-options summary').click();
 await carRow.getByRole('button',{name:'Copier le texte',exact:true}).click();
 const planningCopy=await frame.evaluate(()=>window.__copiedCourse);
 await carRow.getByRole('button',{name:'Exporter au chauffeur',exact:true}).click();
 const directSms=await integrated.evaluate(()=>externalActions.at(-1));
 assert.ok(directSms.url.startsWith('sms:0470123456?body='));
 assert.equal(decodeURIComponent(directSms.url.split('?body=')[1]),planningCopy);
 assert.match(planningCopy,/Client : Client lié\nTéléphone : \+32470000011\nVol : SN123\nCompagnie : Brussels Airlines/);
 assert.equal(directSms.directoryClosed,true);
 assert.equal(directSms.planningClosed,true);
 assert.doesNotMatch(planningCopy,/Chauffeur :|Test intégré/);
 await integrated.evaluate(()=>openHotelModule('planning'));
 assert.deepEqual(await storedCourse('linked-car'),{...linked.car,driver:'other',driverName:'Test intégré',driverDirectoryId:driverIds['0470123456']});
 await frame.evaluate(()=>{
  const course=data.find(item=>item.id==='linked-car');
  course.driverName='Mathieu Lille';
  delete course.driverDirectoryId;
  save();
  renderReservations();
 });
 await integrated.evaluate(()=>{
  TaxiContacts.findDriver=name=>{
   window.lookedUpDriver=name;
   window.dispatchEvent(new CustomEvent('taxi-contacts-result',{detail:{
    mode:'driver-lookup',contacts:[{nativeId:'225',name:'TX Lille Mathieu',phone:'0470225000'}]
   }}));
  };
 });
 await integrated.evaluate(()=>openHotelModule('planning'));
 await carRow.getByRole('button',{name:'Exporter au chauffeur',exact:true}).click();
 assert.equal(await integrated.evaluate(()=>lookedUpDriver),'Mathieu Lille');
 const recoveredSms=await integrated.evaluate(()=>externalActions.at(-1));
 assert.equal(recoveredSms.url,'sms:0470225000?body='+encodeURIComponent(planningCopy));
 assert.equal((await storedCourse('linked-car')).driverName,'Mathieu Lille');
 await integrated.evaluate(()=>{delete TaxiContacts.findDriver;});
 await integrated.evaluate(()=>openHotelModule('planning'));
 await frame.evaluate(driverDirectoryId=>{
  Object.assign(data.find(item=>item.id==='linked-car'),{driverName:'Test intégré',driverDirectoryId});
  save();
  renderReservations();
 },driverIds['0470123456']);
 await integrated.evaluate(course=>openTaxiDrivers(course,{exportCourse:true}),await storedCourse('linked-car'));
 await select(integrated,'Petit test');
 assert.equal(await integrated.locator('#driversSmsPanel').isVisible(),true);
 await integrated.selectOption('#driversMessageSource','free');await integrated.fill('#driversMessage','Message libre');await integrated.click('#driversSms');
 assert.equal((await storedCourse('linked-car')).driverName,'Test intégré');
 await integrated.evaluate(()=>openHotelModule('planning'));
 await earlyRow.getByRole('button',{name:'Exporter au chauffeur',exact:true}).click();
 await select(integrated,'Petit test');
 assert.equal((await storedCourse(earlyDoubleTree.id)).driver,'self');
 assert.doesNotMatch(await integrated.inputValue('#driversMessage'),/Petit test|Chauffeur :/);
 await integrated.getByRole('button',{name:'Attribuer et ouvrir le SMS',exact:true}).click();
 assert.ok((await integrated.evaluate(()=>externalActions.at(-1).url)).startsWith('sms:0470101010?body='));
 assert.deepEqual(await storedCourse(earlyDoubleTree.id),{...earlyDoubleTree,contact:'Papas',manualReservationShift:'Papas',driver:'other',driverName:'Petit test',driverDirectoryId:driverIds['0470101010']});
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
 assert.equal(await integrated.evaluate(()=>scrollY),0);
 await integrated.locator('#taxiPageLocation [data-location="details"]').click();
 await integrated.locator('#taxiQuickNavigation button').first().click();
 assert.equal(await integrated.locator('.page.active').getAttribute('id'),'home');
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
 await fresh.locator('#directoryOptions summary').click();
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
  await integrated.locator('#directoryOptions summary').click();
  await integrated.selectOption('#directorySort','az');const alphabetical=await rows.allTextContents();await holdDrag(integrated,rows.nth(0),rows.nth(1));assert.deepEqual(await rows.allTextContents(),alphabetical);
  await integrated.click('#directoryClose');
 }
 await integrated.evaluate(()=>openHotelModule('home'));
 await frame.evaluate(()=>{openHotelManagement('The Standard');$('driverOrderSettings').open=true;});
 const orderedDrivers=frame.locator('#driverOrderList button');await orderedDrivers.first().waitFor();
 const oldDriverOrder=await orderedDrivers.allTextContents();
 await orderedDrivers.first().evaluate(button=>button.scrollIntoView({block:'center',behavior:'instant'}));
 await holdDrag(integrated,orderedDrivers.nth(0),orderedDrivers.nth(1));
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
 await openDriverOptions(integrated);
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
 await integrated.locator('#taxiDrivers [data-close]').click();
 assert.equal(await integrated.locator('main button').filter({hasText:/^Déconnexion$/}).count(),0);
 for(const hotelMenu of [false,true]){
  await integrated.evaluate(()=>{
   document.body.classList.remove('taxi-intro-pending','taxi-opening','taxi-entering');
   document.querySelector('main').hidden=false;
   document.querySelector('.taxi-access').hidden=true;
   document.querySelectorAll('.taxi-splash').forEach(element=>element.remove());
   localStorage.setItem('taxi-private-session','{}');
  });
  if(hotelMenu)await integrated.evaluate(()=>openHotelModule('planning'));
  const menu=integrated.locator(hotelMenu?'#hotelQuickMenu':'#quickMenu');
  const logout=menu.getByRole('button',{name:'Déconnexion',exact:true});
  assert.equal(await logout.isVisible(),false);
  await integrated.locator(hotelMenu?'#hotelQuickMenuBtn':'#quickMenuBtn').click();
  await logout.click();
  assert.equal(await integrated.locator('main').isVisible(),false);
  assert.equal(await integrated.locator('#privateForm').isVisible(),true);
  assert.equal(await integrated.locator('#hotelCommissionsDialog').evaluate(el=>el.open),false);
  assert.equal(await integrated.evaluate(()=>localStorage.getItem('taxi-private-session')),null);
 }
 console.log('Browser passed: names-only directory, prefix-free ranked search, detail/back flow, vehicle/day/night choices, native refresh, optional client creation/editing, airport/room/fare/date in copied text and SMS, and home return.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
