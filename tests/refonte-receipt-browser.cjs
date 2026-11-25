"use strict";
const {chromium}=require("playwright"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const core=require("../refonte/clean-core");
const p={method:"sumup",amountCents:6500,attemptId:"a-receipt",reference:"TEST-RECEIPT",paidAt:"2026-11-25T08:00:00Z"};
const fixture={...core.empty(),courses:[{id:"demo",client:"Client fictif",kind:"direct",status:"archived",payment:p,commissionCents:0}],ledger:[{courseId:"demo",...p}]};
(async()=>{const browser=await chromium.launch({executablePath:fs.existsSync("/usr/bin/google-chrome")?"/usr/bin/google-chrome":undefined,headless:true,args:["--no-sandbox"]});
try{for(const width of [320,360,720]){const context=await browser.newContext({viewport:{width,height:780},hasTouch:true,isMobile:true});
await context.route("**/*",r=>{const u=new URL(r.request().url()),file=u.pathname.slice(1)||"interface.html";if(u.origin!=="http://receipt.test"||!["interface.html","clean-core.js","course-controller.js","sumup-course-payment.js","course-ui.js"].includes(file))return r.abort();return r.fulfill({contentType:file.endsWith(".js")?"application/javascript":"text/html",body:fs.readFileSync(path.resolve("refonte",file))});});
await context.addInitScript(s=>{localStorage.setItem("mon-taxi-android-refonte:v1",JSON.stringify({version:1,state:s}));window.shared=[];window.TaxiReceipt={share:(channel,body)=>shared.push({channel,body}),retrieve:(reference,cents)=>{window.dispatchEvent(new CustomEvent("taxi-receipt-result",{detail:{reference,verified:{reference,amountCents:cents,currency:"EUR",timestamp:"2026-11-25T08:00:00Z",business:"Test"}}}))}};},fixture);
const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("http://receipt.test/");
await page.locator("[data-go=archives]").click();await page.locator("[data-receipt-course=demo]").click();
assert.ok(await page.locator("#receipt").isVisible());
assert.match(await page.locator("#receipt-summary").innerText(),/TEST-RECEIPT/);
await page.locator("#receipt-verify").click();assert.match(await page.locator("#receipt-summary").innerText(),/Commerçant : Test/);
for(const channel of ["qr","sms","whatsapp","email","share"]){const b=page.locator('[data-receipt-channel="'+channel+'"]');await b.scrollIntoViewIfNeeded();assert.ok(await b.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return h===e||e.contains(h)}));await b.click();assert.ok(await page.locator("#receipt").isVisible());}
assert.deepEqual(await page.evaluate(()=>shared.map(x=>x.channel)),["qr","sms","whatsapp","email","share"]);
await page.locator("#receipt-back").click();assert.ok(await page.locator("#archives").isVisible());assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("mon-taxi-android-refonte:v1")).state.ledger),fixture.ledger);assert.deepEqual(errors,[]);await context.close();}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
