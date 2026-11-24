"use strict";
const assert=require("node:assert/strict");
const core=require("../refonte/clean-core");
const create=require("../refonte/course-controller");
const clone=x=>JSON.parse(JSON.stringify(x));
let saved=null,fail=false;
const storage={load:()=>saved&&clone(saved),save:s=>{if(fail)throw Error("Disque indisponible");saved=clone(s)}};
let c=create(storage);
function ready(id){c.plan({id,driverIsMe:true,commissionCents:0});c.load(id);c.start(id);c.finish(id)}
function unchanged(fn){const before=c.snapshot(),disk=clone(saved);assert.throws(fn);assert.deepEqual(c.snapshot(),before);assert.deepEqual(saved,disk)}
ready("card");c.beginSumUp("card",3500,"a");const result={attemptId:"a",status:"success",transactionCode:"tx",amountCents:3500,currency:"EUR"};c.receiveSumUp("card",result);
const paid=c.snapshot(),day=core.paymentDay(paid.ledger[0].paidAt);
assert.equal(c.daily(day).cardGross,3500);assert.equal(c.daily(day).fee,59);
unchanged(()=>c.refund("card","2000-01-01"));
unchanged(()=>c.refund("card","9999-01-01"));
fail=true;unchanged(()=>c.refund("card",day));fail=false;
c.refund("card",day);
assert.deepEqual(c.snapshot().ledger,paid.ledger);
assert.deepEqual(c.snapshot().courses[0].payment,paid.courses[0].payment);
assert.equal(c.snapshot().courses[0].status,"archived");
assert.equal(c.daily(day).cardGross,0);assert.equal(c.daily(day).cardNet,-59);assert.equal(c.daily(day).worked,false);
unchanged(()=>c.refund("card",day));unchanged(()=>c.receiveSumUp("card",result));
c=create(storage);assert.equal(c.daily(day).cardNet,-59);
const backup=c.backup();assert.deepEqual(core.readBackup(backup),c.snapshot());
const bad=JSON.parse(backup);bad.state.courses[0].refund.amountCents=1;unchanged(()=>c.restore(JSON.stringify(bad)));
ready("cash");c.cash("cash",1500);unchanged(()=>c.refund("cash",day));assert.equal(c.daily(day).cash,1500);
ready("pending");c.beginSumUp("pending",100,"b");unchanged(()=>c.refund("pending",day));
c.receiveSumUp("pending",{attemptId:"b",status:"cancelled"});
// Paiement et remboursement sur deux mois distincts : conservation de la date réelle.
let previous=clone(paid);previous.ledger[0].paidAt="2025-01-31T11:00:00Z";previous.courses[0].payment.paidAt=previous.ledger[0].paidAt;
previous=core.recordRefund(previous,"card","2025-02-01");core.validateState(previous);
assert.equal(core.monthTotals(previous,"2025-01").cardGross,3500);
assert.equal(core.monthTotals(previous,"2025-02").cardGross,-3500);
assert.equal(core.monthTotals(previous,"2025-01").fee,59);
assert.equal(core.monthTotals(previous,"2025-02").fee,0);
console.log("Remboursements : garde-fous, conservation du paiement, comptabilité, redémarrage et sauvegarde validés.");
