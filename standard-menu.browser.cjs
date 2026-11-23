const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage({viewport:{width:360,height:700}});
  await page.route('**/*', route => {
   const u=new URL(route.request().url());
   if(u.origin!=='http://taxi-app.test') return route.abort();
   const path=u.pathname==='/'?'index.html':u.pathname.slice(1);
   if(path.includes('..')||!fs.existsSync(__dirname+'/'+path)) return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(__dirname+'/'+path),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'application/octet-stream'});
  });
  await page.goto('http://taxi-app.test/');
  await page.waitForFunction(()=>typeof window.openHotelModule==='function');
  await page.evaluate(()=>{document.body.classList.remove('taxi-intro-pending','taxi-opening','taxi-entering');document.querySelector('main').hidden=false;document.querySelectorAll('.taxi-access,.taxi-splash').forEach(e=>e.remove());openHotelModule('direct');});
  await page.waitForFunction(()=>!!document.querySelector('#hotelCommissionsFrame')?.contentDocument?.querySelector('#reservationHotelGroup'));
  const frame=await (await page.$('#hotelCommissionsFrame')).contentFrame();
  const result=await frame.evaluate(()=>{
   const errors=[];
   try {
    openReservations(null);
    const entry={id:'standard-focus-test',reservationBoard:true,hotelGroup:'The Standard',hotel:'The Standard',contact:'Fal',driver:'self',bookingMode:'Programmée',reservationStatus:'pending',scheduledDate:reservationClock().slice(0,10),scheduledTime:'15:00',vehicle:'Voiture normale',vehicleChoice:'Voiture normale',carCount:1,vanCount:0,destination:'Zaventem',amount:10,pricing:'Compteur',room:'240',clientName:'Client test'};
    data.push(entry);
    showReservationForm(entry,false);
    const menu=document.getElementById('standardContactDropdown');
    if(!menu)throw Error('Menu Standard absent');
    const options=[...menu.options].map(o=>o.value);
    if(!options.includes('Fal'))throw Error('Contact Fal absent');
    menu.value='Fal';menu.dispatchEvent(new Event('change',{bubbles:true}));
    if(document.getElementById('reservationContact').value!=='Fal')throw Error('Contact non synchronisé');
    return {ok:true,options,selected:menu.value};
   }catch(e){return {ok:false,error:e.stack||String(e)}}
  });
  console.log('STANDARD ONLY:',JSON.stringify(result));
  assert.equal(result.ok,true,result.error);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
