"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const root=path.resolve("refonte");
const core=require("../refonte/clean-core");
const paidAt=new Date().toISOString(),day=core.paymentDay(paidAt);
const p={method:"sumup",amountCents:3500,attemptId:"demo-attempt",reference:"demo-reference",paidAt};
const cash={method:"cash",amountCents:1500,attemptId:"cash-demo",reference:"cash-demo",paidAt};
const fixture={...core.empty(),courses:[{id:"demo",client:"Client fictif",from:"Départ test",to:"Arrivée test",kind:"direct",status:"archived",payment:p,commissionCents:0},{id:"cash-demo",client:"Client espèces fictif",from:"Départ test",to:"Arrivée test",kind:"direct",status:"archived",payment:cash,commissionCents:0}],ledger:[{courseId:"demo",...p},{courseId:"cash-demo",...cash}]};
core.validateState(fixture);
(async()=>{
 const browser=await chromium.launch({executablePath:fs.existsSync("/usr/bin/google-chrome")?"/usr/bin/google-chrome":undefined,headless:true,args:["--no-sandbox"]});
 try{
 for(const width of [320,360,720]){
 const context=await browser.newContext({viewport:{width,height:780},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await context.route("**/*",r=>{const u=new URL(r.request().url());const file=u.pathname.slice(1)||"interface.html";if(u.origin!=="http://refund.test"||!["interface.html","clean-core.js","course-controller.js","sumup-course-payment.js","course-ui.js"].includes(file))return r.abort();return r.fulfill({contentType:file.endsWith(".js")?"application/javascript":"text/html",body:fs.readFileSync(path.join(root,file))});});
 await context.addInitScript(s=>{if(!localStorage.getItem("mon-taxi-android-refonte:v1"))localStorage.setItem("mon-taxi-android-refonte:v1",JSON.stringify({version:1,state:s}));},fixture);
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://refund.test/");
 await page.locator('.nav-menu summary').click();await page.locator('[data-go=archives]').click();
 const card=page.locator("#archive-list article").filter({has:page.getByRole("heading",{name:"Client fictif",exact:true})});
 const button=card.getByRole("button",{name:"Remboursement",exact:true});
 await button.click();
 const confirm=card.getByRole("button",{name:"Confirmer le remboursement effectué",exact:true});
 assert.ok(await confirm.isVisible());
 const amount=card.getByLabel("Montant remboursé (€)");assert.equal(await amount.inputValue(),"35,00");
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:"refund-preview/"+width+"-confirmation.png",fullPage:true});
 await card.getByRole("button",{name:"Annuler",exact:true}).click();
 assert.ok(await button.isVisible());assert.equal(await confirm.isVisible(),false);
 await button.click();await amount.fill("36");await confirm.click();assert.match(await page.locator("#status").innerText(),/invalide/);await amount.fill("35,00");await confirm.click();
 assert.match(await page.locator("#archive-list").innerText(),/Remboursée/);
 assert.equal(await button.count(),0);
 const s=await page.evaluate(()=>JSON.parse(localStorage.getItem("mon-taxi-android-refonte:v1")).state);
 assert.equal(s.courses[0].refund.amountCents,3500);assert.deepEqual(s.ledger,fixture.ledger);assert.equal(core.dayTotals(s,day).cardNet,-59);
 await page.screenshot({path:"refund-preview/"+width+"-remboursee.png",fullPage:true});
 const cashCard=page.locator("#archive-list article").filter({has:page.getByRole("heading",{name:"Client espèces fictif",exact:true})});
 await cashCard.getByRole("button",{name:"Remboursement",exact:true}).click();assert.match(await cashCard.innerText(),/Espèces/);
 const ca=cashCard.getByLabel("Montant remboursé (€)");assert.equal(await ca.inputValue(),"15,00");await ca.fill("5,00");await cashCard.getByRole("button",{name:"Confirmer le remboursement effectué",exact:true}).click();assert.match(await cashCard.innerText(),/Remboursée partiellement/);
 const cs=await page.evaluate(()=>JSON.parse(localStorage.getItem("mon-taxi-android-refonte:v1")).state);assert.equal(core.dayTotals(cs,day).cash,1000);assert.deepEqual(cs.ledger,fixture.ledger);
 await page.locator("[data-page=accounts]").click();assert.match(await page.locator("#accounts-card").innerText(),/0,00/);
 await page.reload();await page.locator('.nav-menu summary').click();await page.locator("[data-go=archives]").click();assert.match(await page.locator("#archive-list").innerText(),/Remboursée/);assert.deepEqual(errors,[]);
 await context.close();
 }
 }finally{await browser.close()}
 console.log("Interface remboursement testée sur 320, 360 et 720 px : confirmation, annulation, comptabilité et persistance.");
})().catch(e=>{console.error(e);process.exitCode=1});
