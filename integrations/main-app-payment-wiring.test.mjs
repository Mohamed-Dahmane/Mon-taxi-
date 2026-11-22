import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const paymentStart=html.indexOf('window.parent.taxiRecordPaymentOnly=window.parent.taxiFarePayment=');
const paymentEnd=html.indexOf('function reservationOutcomeActions(',paymentStart);
assert.ok(paymentStart>=0&&paymentEnd>paymentStart,'payment-only handler must exist before Planning actions');
const realPayment=html.slice(paymentStart,paymentEnd);
const fareBridge=html.slice(html.lastIndexOf('function finishFare('),html.lastIndexOf('window.taxiBeginFareSumUp='));
const sumupBridge=html.slice(html.lastIndexOf('window.taxiBeginFareSumUp='),html.lastIndexOf('</script>'));

test('the real fare page calls a payment-only bridge, never Planning completion',()=>{
 assert.match(fareBridge,/window\.taxiRecordPaymentOnly\(id,method,amount,tip\)/);
 assert.doesNotMatch(fareBridge,/window\.taxiFarePayment\(id,method,amount,tip\)/);
 assert.doesNotMatch(fareBridge,/setReservationStatus\(/);
});
test('payment storage does not mark a ride as completed',()=>{
 assert.match(realPayment,/entry\.paidAt=paidAt/);
 assert.match(realPayment,/reservationCourseStatus\(verified\)!=='pending'/);
 assert.doesNotMatch(realPayment,/entry\.reservationStatus\s*=/);
 assert.doesNotMatch(realPayment,/setReservationStatus\(/);
});
test('the Planning completion button remains a separate action',()=>{
 const actions=html.slice(html.indexOf('function reservationOutcomeActions('),html.indexOf('function setReservationStatus('));
 assert.match(actions,/done\.textContent='Course effectuée'/);
 assert.match(actions,/setReservationStatus\(entry\.id,'validated'/);
});
test('uncertain or unsaved SumUp results retain the payment lock',()=>{
 assert.match(sumupBridge,/if\(activePayment\)return false/);
 assert.match(sumupBridge,/if\(result\.status==='uncertain'\)/);
 assert.doesNotMatch(sumupBridge,/finishFare\(pending\.id,'sumup'/);
 assert.match(sumupBridge,/transaction doit etre verifiee avant enregistrement/);
});

test('cash payment never calls the legacy close-and-archive bridge',()=>{
 const farePage=readFileSync(new URL('../test-tarifs.html',import.meta.url),'utf8');
 assert.match(farePage,/const recordPayment=window\.parent\.taxiRecordFarePayment;/);
 assert.match(farePage,/recordPayment\(realId,'cash',amount,tip\)/);
 assert.doesNotMatch(farePage,/window\.parent\.taxiFinishFare\(realId,'cash',amount,tip\)/);
});
test('already archived rides cannot be paid again',()=>{
 assert.match(realPayment,/Course deja archivee ou annulee : verifier dans Historique/);
});

test('blank payment amount is rejected before it can become zero',()=>{
 assert.match(realPayment,/if\(amount===null\|\|amount===undefined\|\|String\(amount\)\.trim\(\)===''\)return false/);
 assert.match(sumupBridge,/if\(amount===null\|\|amount===undefined\|\|String\(amount\)\.trim\(\)===''\)return false/);
});
test('SumUp result for another ride is ignored',()=>{
 assert.match(sumupBridge,/String\(result\.courseId\)!==pending\.id/);
});

test('real payment rejects fractional cents rather than silently rounding',()=>{
 assert.match(realPayment,/Math\.abs\(rawAmount\*100-cents\)>0\.000001/);
 assert.match(realPayment,/Math\.abs\(rawTip\*100-tipCents\)>0\.000001/);
});

test('SumUp pending lock survives reload and blocks another checkout',()=>{
 assert.match(sumupBridge,/localStorage\.setItem\(pendingKey,JSON\.stringify\(pending\)\)/);
 assert.match(html,/JSON\.parse\(localStorage\.getItem\(pendingKey\)\|\|'null'\)/);
 assert.match(sumupBridge,/if\(activePayment\)return false/);
});
test('browser SumUp success cannot mark a ride as paid',()=>{
 assert.match(sumupBridge,/if\(result\.status==='success'\)/);
 assert.doesNotMatch(sumupBridge,/finishFare\(pending\.id,'sumup'/);
 assert.match(sumupBridge,/verification serveur authentifiee/);
});
