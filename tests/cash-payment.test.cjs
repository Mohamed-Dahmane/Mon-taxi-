const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function extract(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+start.length);assert(i>=0&&j>i,'Missing code: '+start);return html.slice(i,j);}
const credit=extract('window.taxiCreditCashFare=function(', 'function correctPayment(');
const bridge=extract('window.parent.taxiFarePayment=function(', 'function reservationOutcomeActions(');
function scenario({failSave=false,future=false}={}){
 const store=new Map(),account={months:{}},now='2026-11-22T14:30';
 const course={id:'ride-1',bookingMode:future?'Programmée':'Direct',scheduledDate:future?'2026-11-23':'2026-11-22',reservationStatus:'pending',driver:'self'};
 store.set('courses',JSON.stringify([course]));
 const win={parent:null};win.parent=win;
 const context={window:win,console,Date,JSON,Number,String,Math,Error,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(failSave&&k==='account')throw Error('disk full');store.set(k,v)}},data:account,storageKey:'account',defaultFixed:()=>({}),number:v=>Number(v)||0,save:()=>{try{context.localStorage.setItem('account',JSON.stringify(context.data))}catch{}},refreshMetrics(){},renderDays(){},renderAnnual(){},renderArchive(){},key:'courses',coursesReadable:true,readCourses:raw=>JSON.parse(raw),reservationCourseStatus:e=>e.reservationStatus==='validated'?'validated':'pending',reservationClock:()=>now,pendingReservationContact:()=>'',refreshCourseTotals(){},renderReservations(){}};
 vm.createContext(context);vm.runInContext(credit,context);vm.runInContext(bridge,context);
 return {context,store,win};
}
{
 const {context:c,store,win}=scenario();
 assert.equal(win.taxiFarePayment('ride-1','cash',1,0),true);
 assert.equal(store.has('account'),false);
 assert.equal(JSON.parse(store.get('courses'))[0].reservationStatus,'validated');
 assert.equal(win.taxiFarePayment('ride-1','cash',1,0),true);
 assert.equal(JSON.parse(store.get('account')).months['2026-10'].payments['2026-11-22'].cash,'1');
}
{
 const {store,win}=scenario({future:true});
 assert.throws(()=>win.taxiFarePayment('ride-1','cash',1,0),/future/i);
 assert.equal(JSON.parse(store.get('courses'))[0].reservationStatus,'pending');
}
{
 const {store,win}=scenario({failSave:true});
 assert.equal(win.taxiFarePayment('ride-1','cash',1,0),true);
 assert.equal(JSON.parse(store.get('courses'))[0].reservationStatus,'validated');
}
console.log('PASS: course closure without cash credit, repeat safe, future blocked');
