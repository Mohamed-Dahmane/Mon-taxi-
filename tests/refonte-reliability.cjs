"use strict";
const assert=require("node:assert/strict");
const core=require("../refonte/clean-core.js");
const create=require("../refonte/course-controller.js");
let persisted=null, fail=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const storage={load:()=>persisted&&clone(persisted),save:s=>{if(fail)throw Error("Disque indisponible");persisted=clone(s);}};
let c=create(storage);
const reopen=()=>{c=create(storage);assert.deepEqual(c.snapshot(),persisted);};
function unchanged(fn){const before=c.snapshot(),disk=clone(persisted);assert.throws(fn);assert.deepEqual(c.snapshot(),before);assert.deepEqual(persisted,disk);}
function prepare(id){c.plan({id,from:"Départ fictif",to:"Arrivée fictive",driverIsMe:true,commissionCents:0});unchanged(()=>c.finish(id));c.load(id);reopen();c.start(id);reopen();c.finish(id);reopen();}
assert.deepEqual(c.snapshot(),core.empty());
c.saveDirectory("hotels",{id:"h",name:"Hôtel fictif"});
c.saveDirectory("contacts",{id:"contact",hotelId:"h",name:"Contact fictif",phone:"+32470000001"});
c.saveDirectory("drivers",{id:"driver",name:"Chauffeur fictif",phone:"+32470000002",nativeId:"test"});
let expected=0,completed=0;
for(let i=0;i<24;i++){
 const id="ride-"+i,amount=1000+i*17;
 prepare(id);
 fail=true;
 unchanged(()=>c.cash(id,amount));
 unchanged(()=>c.beginSumUp(id,amount,"failed-"+i));
 fail=false;reopen();
 if(i%2===0){
  c.cash(id,amount);reopen();unchanged(()=>c.cash(id,amount));
 }else{
  const attempt="attempt-"+i;
  c.beginSumUp(id,amount,attempt);reopen();
  unchanged(()=>c.cash(id,amount));unchanged(()=>c.backup());
  unchanged(()=>c.restore(core.backup(core.empty())));
  const result={attemptId:attempt,status:"success",transactionCode:"tx-"+i,amountCents:amount,currency:"EUR"};
  unchanged(()=>c.receiveSumUp(id,{...result,amountCents:amount+1}));
  unchanged(()=>c.receiveSumUp(id,{...result,currency:"USD"}));
  unchanged(()=>c.receiveSumUp(id,{...result,attemptId:"foreign"}));
  assert.equal(c.receiveSumUp(id,{attemptId:attempt,status:"uncertain"}).status,"payment_pending");reopen();
  fail=true;unchanged(()=>c.receiveSumUp(id,result));fail=false;reopen();
  c.receiveSumUp(id,result);reopen();unchanged(()=>c.receiveSumUp(id,result));
 }
 expected+=amount;completed++;
 assert.equal(c.snapshot().ledger.length,completed);
 assert.equal(c.snapshot().ledger.reduce((sum,p)=>sum+p.amountCents,0),expected);
}
prepare("a");prepare("b");
c.savePaymentDraft("b",100);reopen();
assert.equal(c.snapshot().courses.find(x=>x.id==="b").paymentDraftCents,100);
c.beginSumUp("a",1000,"single-pending");
unchanged(()=>c.savePaymentDraft("a",100));
unchanged(()=>c.beginSumUp("b",1000,"second-pending"));
c.receiveSumUp("a",{attemptId:"single-pending",status:"declined"});reopen();
assert.equal(c.snapshot().courses.find(x=>x.id==="a").paymentDraftCents,1000);
assert.equal(c.snapshot().courses.find(x=>x.id==="b").paymentDraftCents,100);
unchanged(()=>c.beginSumUp("a",1000,"single-pending"));
c.beginSumUp("a",1000,"new-attempt");
c.receiveSumUp("a",{attemptId:"new-attempt",status:"cancelled"});reopen();
c.cash("a",1000);c.cash("b",1000);reopen();
const before=c.snapshot();
c.removeDirectory("hotels","h");c.removeDirectory("drivers","driver");reopen();
assert.deepEqual(c.snapshot().courses,before.courses);assert.deepEqual(c.snapshot().ledger,before.ledger);
const backup=c.backup();assert.deepEqual(core.readBackup(backup),c.snapshot());
unchanged(()=>c.restore('{"hotels":[],"courses":[]}'));
const damaged=JSON.parse(backup);damaged.state.ledger.push(damaged.state.ledger[0]);unchanged(()=>c.restore(JSON.stringify(damaged)));
const day=core.paymentDay(c.snapshot().ledger[0].paidAt);
assert.ok(c.daily(day).cardGross+c.daily(day).cash>0);
console.log("Point 10 : 26 courses fictives, redémarrages, écritures interrompues, refus, annulations, paiements incertains, absence de doublon, sauvegarde et indépendance des archives vérifiés.");
