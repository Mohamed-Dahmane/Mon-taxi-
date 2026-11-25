"use strict";
const make=require("../refonte/payment-ledger-experimental.cjs");
const assert=require("node:assert/strict");
function testLedger(make,assert){
 let count=0; const test=(label,fn)=>{fn();count++;}; const eq=(a,b)=>assert(a===b,`${a} != ${b}`); const throws=fn=>{let did=false;try{fn()}catch{did=true}assert(did,"Expected rejection")};
 const m=make(undefined,()=>"2026-11-24T19:00:00Z");
 const result=(key,attempt,cents,extra={})=>({kind:"course",key,attempt,cents,currency:"EUR",status:"confirmed",ref:"tx-"+attempt,...extra});
 test("finish without collection",()=>{m.openCourse("ride");throws(()=>m.cash("course","ride",100,"bad"));m.finish("ride",8000);eq(m.view("course","ride").balance,8000);eq(m.snapshot().receipts.length,0)});
 test("partial cash and deferred invoice",()=>{m.cash("course","ride",3000,"c1");m.defer("course","ride","invoice");eq(m.view("course","ride").balance,5000);eq(m.view("course","ride").paymentStatus,"partial");eq(m.view("course","ride").expected,"invoice")});
 test("failed card keeps cash and balance",()=>{m.begin("course","ride",5000,"a1");m.terminal(result("ride","a1",5000,{status:"declined"}));eq(m.view("course","ride").balance,5000);eq(m.snapshot().receipts.length,1)});
 test("uncertainty prevents new card but other cash allowed",()=>{m.begin("course","ride",5000,"a2");m.terminal(result("ride","a2",5000,{status:"uncertain"}));m.openFree("free",150,"");throws(()=>m.begin("free","free",150,"f0"));throws(()=>m.cash("course","ride",5000,"c2"));m.openCourse("other");m.finish("other",700);m.cash("course","other",700,"c3");eq(m.view("course","other").balance,0)});
 test("mismatched amount and currency rejected",()=>{throws(()=>m.terminal(result("ride","a2",4999)));throws(()=>m.terminal(result("ride","a2",5000,{currency:"USD"})));throws(()=>m.terminal(result("other","a2",5000)));eq(m.view("course","ride").balance,5000)});
 test("confirmed card exactly once",()=>{m.terminal(result("ride","a2",5000));m.terminal(result("ride","a2",5000));eq(m.view("course","ride").balance,0);eq(m.snapshot().receipts.filter(p=>p.key==="ride").length,2);throws(()=>m.cash("course","ride",100,"c4"))});
 test("waiver and later free payment independent",()=>{m.openCourse("gift");m.finish("gift",1000);m.waive("gift","geste commercial");eq(m.view("course","gift").paymentStatus,"waived");m.openFree("gift-payment",1000);m.cash("free","gift-payment",1000,"c5");eq(m.view("course","gift").paid,0);eq(m.view("free","gift-payment").balance,0)});
 test("free card, no route and optional label",()=>{m.begin("free","free",150,"f1");m.terminal({kind:"free",key:"free",attempt:"f1",cents:150,currency:"EUR",status:"confirmed",ref:"free-tx"});eq(m.view("free","free").balance,0);eq(m.snapshot().courses.free,undefined);eq(m.view("free","free").label,"")});
 test("duplicate reference and overpayment",()=>{m.openFree("second",200,"acompte");throws(()=>m.cash("free","second",201,"c6"));throws(()=>m.cash("free","second",100,"c5"));eq(m.view("free","second").paid,0)});
 test("reload maintains partial balance and pending",()=>{m.begin("free","second",200,"f2");const re=make(m.snapshot());eq(re.pending().attempt,"f2");eq(re.view("free","second").balance,200);eq(re.view("course","ride").balance,0);throws(()=>re.begin("free","second",200,"f3"))});
 test("Settled cash then card supplement, immutable original, retries and reload",()=>{
  const x=make(undefined,()=>"2026-11-25T03:00:00Z");
  x.openCourse("cash-first");x.finish("cash-first",5000);x.cash("course","cash-first",5000,"cash-original");
  const original=x.snapshot().receipts[0];x.increaseTotal("cash-first",6000,"bagages");
  eq(x.view("course","cash-first").balance,1000);eq(x.snapshot().receipts.length,1);
  x.begin("course","cash-first",1000,"extra-a");x.terminal(result("cash-first","extra-a",1000,{status:"uncertain"}));
  throws(()=>x.increaseTotal("cash-first",6500));throws(()=>x.cash("course","cash-first",1000,"extra-cash"));
  const y=make(x.snapshot());eq(y.pending().attempt,"extra-a");y.terminal(result("cash-first","extra-a",1000));y.terminal(result("cash-first","extra-a",1000));
  eq(y.view("course","cash-first").paid,6000);eq(y.snapshot().receipts.length,2);assert(JSON.stringify(original)===JSON.stringify(y.snapshot().receipts[0]));
  eq(y.view("course","cash-first").adjustments[0].previousCents,5000);
  y.increaseTotal("cash-first",6500);y.cash("course","cash-first",500,"extra-cash");eq(y.view("course","cash-first").balance,0);
  throws(()=>y.increaseTotal("cash-first",6400));throws(()=>y.cash("course","cash-first",100,"over"));
 });
 test("Settled card then cash supplement, declined card can switch to cash",()=>{
  const x=make();x.openCourse("card-first");x.finish("card-first",5000);
  x.begin("course","card-first",5000,"original");x.terminal(result("card-first","original",5000));
  x.increaseTotal("card-first",6000);x.begin("course","card-first",1000,"declined");
  x.terminal(result("card-first","declined",1000,{status:"declined"}));x.cash("course","card-first",1000,"supplement");
  eq(x.view("course","card-first").paymentStatus,"settled");eq(x.snapshot().receipts.length,2);
  eq(x.snapshot().receipts[0].method,"sumup");eq(x.snapshot().receipts[1].method,"cash");
  eq(x.snapshot().receipts[1].cents,1000);
 });
 return count;
}
console.log(testLedger(make,assert.ok)+" payment scenarios passed");
