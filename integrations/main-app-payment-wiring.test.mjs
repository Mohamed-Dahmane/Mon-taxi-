import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const realPayment=html.slice(html.indexOf('window.parent.taxiRecordPaymentOnly=window.parent.taxiFarePayment='),html.indexOf('function reservationOutcomeActions('));
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
 assert.match(sumupBridge,/if\(finishFare\(pending\.id,'sumup',pending\.amount,pending\.tip\)\)\{/);
});
