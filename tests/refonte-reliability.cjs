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

// Régression : l'ordre des archives dépend de l'exécution, jamais de l'encaissement.
const fs=require("node:fs"),vm=require("node:vm");
const ui=fs.readFileSync(require("node:path").join(__dirname,"../refonte/course-ui.js"),"utf8");
const render=ui.slice(ui.indexOf("function renderLists(){"),ui.indexOf("function show(id){"));
assert.ok(render.startsWith("function renderLists(){"),"Tri des archives introuvable");
const archiveSort=render.slice(render.indexOf("const courseTime="),render.indexOf(" $('course-list')"));
assert.ok(archiveSort.includes("c.finishedAt"),"Tri par heure de course requis");
const rides=[
 {id:"lundi",status:"archived",finishedAt:"2026-11-23T10:00:00Z",payment:{paidAt:"2026-11-24T17:00:00Z"}},
 {id:"mardi",status:"archived",finishedAt:"2026-11-24T09:00:00Z",payment:{paidAt:"2026-11-24T09:30:00Z"}},
 {id:"ancienne",status:"archived",finishedAt:"2026-11-22T18:00:00Z",payment:{paidAt:"2026-11-25T08:00:00Z"}}
];
const order=vm.runInNewContext("const all=rides;"+archiveSort+";archived.map(c=>c.id)",{rides});
assert.deepEqual(Array.from(order),["mardi","lundi","ancienne"]);
console.log("Historique : ordre des courses indépendant des paiements différés OK.");

// Régression : planning trié par date/heure, courses directes sans horaire toujours visibles.
const planningSort=render.slice(render.indexOf("const plannedTime="),render.indexOf(" // Historique par heure"));
assert.ok(planningSort.includes("c.date")&&planningSort.includes("c.time"));
const planned=[
 {id:"sans-heure",status:"planned"},
 {id:"demain",status:"planned",date:"2026-11-28",time:"08:00"},
 {id:"aujourdhui",status:"planned",date:"2026-11-27",time:"17:00"}
];
const planningOrder=vm.runInNewContext("const all=planned;"+planningSort+";active.map(c=>c.id)",{planned});
assert.deepEqual(Array.from(planningOrder),["aujourdhui","demain","sans-heure"]);
console.log("Planning : ordre chronologique et courses sans horaire conservées OK.");

// Une course archivée avec date/heure mais sans finishedAt reste classée par sa course.
const datedRides=[
 {id:"lundi",status:"archived",date:"2026-11-23",time:"10:00",payment:{paidAt:"2026-11-27T12:00:00Z"}},
 {id:"mardi",status:"archived",date:"2026-11-24",time:"09:00",payment:{paidAt:"2026-11-24T10:00:00Z"}}
];
const datedOrder=vm.runInNewContext("const all=rides;"+archiveSort+";archived.map(c=>c.id)",{rides:datedRides});
assert.deepEqual(Array.from(datedOrder),["mardi","lundi"]);
console.log("Historique : repli sur la date et l'heure de course sans timestamp OK.");
 
// Régression comptable : un paiement le mardi ne déplace pas une course du lundi.
let deferred=core.addCourse(core.empty(),{id:"deferred",date:"2026-11-23",time:"10:00"});
for(const type of ["load","start","finish"])deferred=core.apply(deferred,"deferred",{type});
deferred=core.recordCash(deferred,"deferred",4200);
deferred.courses[0].finishedAt="2026-11-23T10:00:00Z";
deferred.ledger[0].paidAt="2026-11-24T11:00:00Z";
deferred.courses[0].payment.paidAt="2026-11-24T11:00:00Z";
assert.equal(core.dayTotals(deferred,"2026-11-23").cash,4200);
assert.equal(core.dayTotals(deferred,"2026-11-24").cash,0);
assert.equal(core.monthTotals(deferred,"2026-11").revenue,4200);
console.log("Comptabilité : course lundi, paiement mardi, recette lundi OK.");
const dated=core.addCourse(core.empty(),{id:"dated-only",date:"2026-11-23"});
let paid=dated;
for(const type of ["load","start","finish"])paid=core.apply(paid,"dated-only",{type});
paid=core.recordCash(paid,"dated-only",1200);
delete paid.courses[0].startedAt;
delete paid.courses[0].finishedAt;
paid.ledger[0].paidAt="2026-11-24T11:00:00Z";
paid.courses[0].payment.paidAt="2026-11-24T11:00:00Z";
assert.equal(core.dayTotals(paid,"2026-11-23").cash,1200);
assert.equal(core.dayTotals(paid,"2026-11-24").cash,0);
console.log("Comptabilité : date de course seule sans heure conservée OK.");
