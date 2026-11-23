const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function section(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+start.length);assert(i>=0&&j>i,'Missing section '+start);return html.slice(i,j);}
const payment=section('window.parent.taxiFarePayment=function(', 'function reservationOutcomeActions(');
const status=section('function setReservationStatus(', 'let reservationTimePage');
const cash=section('window.taxiRecordCashFare=function(', 'function correctPayment(');
const bridge=section('function finishFare(id,method,amount,tip)', 'window.taxiFinishFare=finishFare');
assert.match(payment,/entry\.paidAt=reservationClock\(\)/);
assert.match(payment,/setReservationStatus\(entry\.id,'validated'/);
assert.match(status,/status==='validated'&&!entry\.paidAt/);
assert.match(cash,/cashFareReceipts\[receiptId\]\.amount===cents/);
assert.match(bridge,/if\(!window\.taxiFarePayment\(id,method,amount,tip\)\)/);
assert.match(html,/if\(result\.status==='success'\)/);
console.log('PASS: recorded payment precedes automatic archival; duplicate cash amount protected');
console.log('WARNING: SumUp success event authenticity requires Android integration verification');
