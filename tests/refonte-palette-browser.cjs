"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
const browser=await chromium.launch({executablePath:fs.existsSync("/usr/bin/google-chrome")?"/usr/bin/google-chrome":undefined,headless:true,args:["--no-sandbox"]});
try{
for(const [width,height] of [[320,640],[360,780],[400,850],[720,800],[840,720],[850,400]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});
 await page.goto("file://"+process.cwd()+"/refonte/interface.html");
 for(const [go,color] of [["reservation","rgb(18, 62, 112)"],["direct","rgb(33, 100, 207)"],["free-ride","rgb(80, 89, 101)"]]){
  const b=page.locator('#home button[data-go="'+go+'"]');
  assert.equal(await b.evaluate(e=>getComputedStyle(e).backgroundColor),color);
  await b.scrollIntoViewIfNeeded();
  assert.ok(await b.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.height>=48&&r.width>=48&&!!hit&&(hit===e||e.contains(hit));}),go+" inaccessible "+width);
  await b.click({timeout:3000});
  assert.ok(await page.locator("#"+go).isVisible(),go+" ouverture");
  await page.locator('button[data-page="home"]').click();
 }
 const overlapping=await page.locator("#home .actions>button").evaluateAll(es=>es.some((a,i)=>es.slice(i+1).some(b=>{const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return Math.min(r.right,s.right)-Math.max(r.left,s.left)>1&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>1})));
 assert.equal(overlapping,false,"Superposition "+width);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Débordement "+width);
 await page.close();
 console.log(width+"x"+height+" : boutons visibles, clics et ouverture OK");
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
