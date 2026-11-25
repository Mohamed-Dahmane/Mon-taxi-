"use strict";
const assert=require("node:assert/strict"),create=require("../refonte/course-controller"),core=require("../refonte/clean-core");
let saved;const c=create({load:()=>saved,save:s=>saved=JSON.parse(JSON.stringify(s))});
function plan(id){c.plan({id,from:"Test",to:"Destination",driverIsMe:true,commissionCents:0});c.load(id);c.start(id);c.finish(id);}
plan("test");const cash=c.cash("test",100);const day=core.paymentDay(cash.payment.paidAt);
plan("real");c.cash("real",3500);
plan("card");c.beginSumUp("card",2000,"attempt-card");c.receiveSumUp("card",{status:"success",attemptId:"attempt-card",transactionCode:"CARD-TEST",amountCents:2000,currency:"EUR"});
const before=c.daily(day),ledger=JSON.stringify(c.snapshot().ledger);
assert.equal(before.cash,3600);assert.equal(before.cardGross,2000);
assert.throws(()=>c.removeArchived("card","void-test"));
c.removeArchived("test","void-test");assert.equal(c.daily(day).cash,3500);assert.equal(c.daily(day).cardGross,2000);
assert.throws(()=>c.removeArchived("test","void-test"));assert.throws(()=>c.refund("test",day,100));
c.removeArchived("real","hide");c.removeArchived("card","hide");
assert.equal(c.daily(day).cash,3500);assert.equal(c.daily(day).cardGross,2000);
assert.equal(JSON.stringify(c.snapshot().ledger),ledger);
assert.deepEqual(core.readBackup(c.backup()),c.snapshot());assert.deepEqual(create({load:()=>saved}).snapshot(),c.snapshot());
assert.throws(()=>c.removeArchived("absent","hide"));
plan("pending");c.beginSumUp("pending",100,"attempt-pending");assert.throws(()=>c.removeArchived("pending","hide"));
console.log("Archive removal: fictive cash excluded; real payments, ledger, backup and pending payments protected.");
