const {test}=require('node:test');const assert=require('node:assert/strict');const core=require('./driver-directory.js');
test('TX import classification, repeat import and same-phone different contacts',()=>{
 const list=[{nativeId:'1',name:'tx van Yacine',phone:'+32 470 12 34 56'},{nativeId:'2',name:'TX Alexis',phone:'+32470123456'},{nativeId:'3',name:'Autre',phone:'0470112233'}];
 const a=core.merge([],list,'tx');assert.equal(a.added,2);assert.equal(a.drivers[0].category,'van');assert.equal(a.drivers[1].category,'car');
 const b=core.merge(a.drivers,list,'tx');assert.equal(b.added,0);assert.equal(b.drivers.length,2);
});
test('native identity refresh changes phone without duplicates; category and local edits survive',()=>{
 const original={id:'a',nativeId:'1',name:'TX chauffeur',phone:'0470112233',category:'van',manualCategory:true};
 const next=core.merge([original],[{nativeId:'1',name:'TX nouveau',phone:'0470445566'}],'tx');assert.equal(next.drivers[0].phone,'0470445566');assert.equal(next.drivers[0].category,'van');assert.equal(next.drivers.length,1);
 original.localPhone=true;assert.equal(core.merge([original],[{nativeId:'1',name:'TX chauffeur',phone:'0470445566'}],'tx').drivers[0].phone,'0470112233');
 assert.equal(core.merge([original],[],'tx').drivers.length,1);
});
test('manual and selected non-TX contacts are accepted; invalid numbers excluded',()=>{
 assert.equal(core.merge([],[{name:'Karim',phone:'0470123456'}],'chosen').added,1);
 assert.equal(core.merge([],[{name:'TX broken',phone:'javascript:alert(1)'}],'tx').added,0);
});
test('vCard handles folding, escaped names and tel URI',()=>{assert.deepEqual(core.parseVcard('BEGIN:VCARD\r\nFN:Karim\\, chauffeur\r\nTEL;TYPE=CELL:tel:+32470\r\n 123456\r\nEND:VCARD'),[{name:'Karim, chauffeur',phone:'+32470123456'}]);});
test('SMS contains actual booking data and Unicode without inventing absent fields',()=>{
 const text=core.courseText({scheduledDate:'2026-11-19',scheduledTime:'04:30',destination:'Hôtel',carCount:1,vanCount:2,pickup:{place:'BRU',client:'Émilie',phone:'+32470123456',flight:'SN123'},note:'2 sièges'});
 assert.match(text,/19\/11\/2026 à 04:30/);assert.match(text,/Airport BRU \(Zaventem\) → Hôtel/);assert.match(text,/Émilie/);assert.match(text,/2 van/);assert.doesNotMatch(text,/undefined|Prix annoncé/);
});

test('v1 migration preserves identity and makes vehicle eligibility asymmetric',()=>{
 const car=core.normalizeDriver({id:'car',name:'TX Alexis',phone:'0470112233',category:'car',acceptsCar:false});
 const van=core.normalizeDriver({id:'van',name:'TX Van Hassan',phone:'0470223344',category:'van'});
 assert.equal(core.eligible(car,'car'),true);assert.equal(core.eligible(car,'van'),false);
 assert.equal(core.eligible(van,'van'),true);assert.equal(core.eligible(van,'car'),true);
 const both=core.normalizeDriver({...van,acceptsCar:true});assert.equal(core.eligible(both,'car'),true);assert.equal(core.eligible(both,'van'),true);assert.equal(both.id,'van');
});
test('night markers work for cars and vans; both periods and filtering are independent',()=>{
 assert.equal(core.category('TX Nuit Van Hassan'),'van');assert.equal(core.category('TX Van Night Hassan'),'van');
 assert.deepEqual(core.availability('TX Night Karim'),{day:false,night:true});assert.deepEqual(core.availability('TX Van Nuit Jour Hassan'),{day:true,night:true});
 const both=core.normalizeDriver({category:'van',acceptsCar:true,name:'Hassan',availability:{day:true,night:true}});
 for(const vehicle of ['car','van'])for(const period of ['day','night'])assert.equal(core.eligible(both,vehicle,period),true);
 const night=core.normalizeDriver({category:'car',name:'TX Nuit Karim'});assert.equal(core.eligible(night,'car','day'),false);assert.equal(core.eligible(night,'car','night'),true);assert.equal(core.eligible(night,'van','night'),false);
});
test('explicit refresh updates native names and numbers for TX and selected non-TX; preserves choices and priority',()=>{
 const prior=[{id:'van',nativeId:'1',name:'TX Van local',phone:'0470112233',category:'van',acceptsCar:true,manualCategory:true,manualServices:true,availability:{day:true,night:true},manualAvailability:true,localName:true,localPhone:true,priority:3},{id:'chosen',nativeId:'2',name:'Karim',phone:'0470223344',category:'car',source:'chosen'},{id:'manual',name:'Manuel',phone:'0470334455',category:'car'}];
 const incoming=[{nativeId:'1',name:'TX Van Night nouveau',phone:'0470998877'},{nativeId:'2',name:'Karim nouveau',phone:'0470887766'},{nativeId:'3',name:'TX Nuit nouveau',phone:'0470776655'},{nativeId:'4',name:'Non chauffeur',phone:'0470665544'}];
 const r=core.merge(prior,incoming,'sync',{fromPhone:true});assert.equal(r.added,1);assert.equal(r.updated,2);assert.equal(r.drivers.length,4);
 const van=r.drivers.find(d=>d.id==='van');assert.equal(van.phone,'0470998877');assert.equal(van.name,'TX Van Night nouveau');assert.equal(van.acceptsCar,true);assert.deepEqual(van.availability,{day:true,night:true});assert.equal(van.priority,3);
 assert.equal(r.drivers.find(d=>d.id==='chosen').name,'Karim nouveau');assert.equal(r.drivers.find(d=>d.id==='manual').phone,'0470334455');
 const again=core.merge(r.drivers,incoming,'sync',{fromPhone:true});assert.equal(again.added,0);assert.equal(again.updated,0);assert.equal(again.unchanged,3);
});
test('refresh preserves absent contacts and manual period choices despite renamed phone contact',()=>{
 const prior=[{id:'1',nativeId:'1',category:'van',name:'TX Van Nuit',phone:'0470112233',manualCategory:true,manualServices:true,acceptsCar:true,availability:{day:true,night:true},manualAvailability:true}];
 const r=core.merge(prior,[{nativeId:'1',name:'Chauffeur renommé sans TX',phone:'0470223344'}],'sync',{fromPhone:true});assert.equal(r.drivers.length,1);assert.equal(r.drivers[0].phone,'0470223344');assert.equal(core.eligible(r.drivers[0],'car','night'),true);
 assert.equal(core.merge(r.drivers,[],'sync',{fromPhone:true}).drivers.length,1);
});

test('driver messages use explicit airport names and include the entered room only',()=>{
 for(const [input,label] of [['BRU','Airport BRU (Zaventem)'],['Zaventem','Airport BRU (Zaventem)'],['Airport BRU','Airport BRU (Zaventem)'],['CRL','Airport CRL (Charleroi)'],['Charleroi','Airport CRL (Charleroi)'],['Airport CRL','Airport CRL (Charleroi)']]){
  assert.equal(core.airportLabel(input),label);assert.equal(core.airportLabel(label),label);
  assert.match(core.courseText({hotel:'DoubleTree',destination:input,room:'0123'}),/Chambre : 0123/);
  assert.ok(core.courseText({hotel:'DoubleTree',destination:input}).includes('DoubleTree → '+label));
 }
 const pickup=core.courseText({hotel:'Hôtel',destination:'Hôtel',pickup:{place:'CRL'},room:'7A'});assert.match(pickup,/Airport CRL \(Charleroi\) → Hôtel/);assert.match(pickup,/Chambre : 7A/);
 assert.doesNotMatch(core.courseText({hotel:'Hôtel',destination:'Gare du Midi',room:'  '}),/Chambre|undefined/);
 assert.equal(core.airportLabel('Gare du Midi'),'Gare du Midi');
});

test('fixed fare warning leads the message and uses the fare, never the commission',()=>{
 const text=core.courseText({hotel:'Standard',destination:'Zaventem',announcedPrice:74.79,amount:10,room:'204'});
 assert.match(text,/^ATTENTION — PRIX FIXÉ : 74,79\s€\n/);assert.match(text,/Chambre : 204/);assert.doesNotMatch(text,/Prix annoncé|10,00/);
 assert.match(core.fixedPriceLine(0),/^ATTENTION — PRIX FIXÉ : 0,00\s€/);
 assert.match(core.fixedPriceLine('80,50'),/80,50\s€/);
 for(const value of [null,undefined,'','  ',-1,'incorrect'])assert.equal(core.fixedPriceLine(value),'');
 assert.doesNotMatch(core.courseText({hotel:'Standard',destination:'Charleroi',amount:10}),/PRIX FIXÉ/);
});

test('driver dates use day/month/year while stored course dates and times stay unchanged',()=>{
 assert.equal(core.driverDate('2026-11-18'),'18/11/2026');assert.equal(core.driverDate('2026-01-05'),'05/01/2026');assert.equal(core.driverDate('18/11/2026'),'18/11/2026');assert.equal(core.driverDate(null),'');
 const course={date:'2026-11-18',recordedTime:'04:30',hotel:'Standard',destination:'Charleroi'};
 assert.match(core.courseText(course),/18\/11\/2026 à 04:30/);assert.equal(course.date,'2026-11-18');
 assert.match(core.courseText({...course,scheduledDate:'2026-11-20',scheduledTime:'05:15'}),/20\/11\/2026 à 05:15/);
});

test('optional client name and phone are copied independently, including existing pickups',()=>{
 assert.match(core.courseText({hotel:'Standard',destination:'BRU',clientName:'  Mme Dupont  ',clientPhone:'+32 470 12 34 56'}),/Client : Mme Dupont\nTéléphone : \+32 470 12 34 56/);
 assert.match(core.courseText({clientName:'M. Dupont'}),/Client : M. Dupont/);assert.doesNotMatch(core.courseText({clientName:'M. Dupont'}),/Téléphone/);
 assert.match(core.courseText({clientPhone:'0470123456'}),/Téléphone : 0470123456/);assert.doesNotMatch(core.courseText({clientPhone:'0470123456'}),/Client :/);
 assert.doesNotMatch(core.courseText({contact:'Réceptionniste',clientName:' ',clientPhone:''}),/Client :|Téléphone :/);
 assert.match(core.courseText({destination:'Hôtel',pickup:{place:'Bruxelles Aéroport (BRU)',client:'Client existant',phone:'0470123456'}}),/Airport BRU \(Zaventem\) → Hôtel\nClient : Client existant\nTéléphone : 0470123456/);
 assert.equal(core.airportLabel('Charleroi Airport (CRL)'),'Airport CRL (Charleroi)');
});
test('name search ignores TX/Van, prioritizes first letters and supports surname and accents',()=>{
 const van={name:'TX van Yassine Bekay',phone:'0470123456'},car={name:'TX Yacine',phone:'0470234567'},partial={name:'TX Farid Yassine',phone:'0470345678'};
 for(const q of ['Y','YA','Y A','yassine','Bekay'])assert.ok(core.searchRank(van,q)>=0,q);
 assert.equal(core.searchRank(van,'Y'),0);assert.equal(core.searchRank(car,'YA'),0);assert.equal(core.searchRank(partial,'ya'),1);assert.equal(core.searchRank(van,'TX'),-1);assert.equal(core.searchRank(van,'van'),-1);
 assert.equal(core.searchRank({name:'TX Van Éric'},'er'),0);assert.equal(core.searchRank(van,'0470'),3);assert.equal(core.driverSearchName('TX Nuit Van Yassine Bekay'),'Yassine Bekay');
});

test('passenger count is optional and shared between direct, reservation and existing pickup messages',()=>{
 assert.match(core.courseText({passengers:4}),/Passagers : 4/);assert.match(core.courseText({pickup:{passengers:7}}),/Passagers : 7/);assert.match(core.courseText({passengers:3,pickup:{passengers:7}}),/Passagers : 3/);
 for(const passengers of [null,undefined,'',0,-1,1.5])assert.doesNotMatch(core.courseText({passengers}),/Passagers :/);
});
test('course vehicle limits cannot send a van course to a car; car courses allow compatible vans',()=>{
 const car={category:'car',name:'TX Yacine'},van={category:'van',name:'TX Van Yassine'},both={...van,acceptsCar:true};
 const vanCourse={vehicle:'Van',carCount:0,vanCount:2},carCourse={vehicle:'Voiture normale',carCount:1,vanCount:0};
 assert.equal(core.requiredVehicle(vanCourse),'van');assert.equal(core.compatibleWithCourse(car,vanCourse),false);assert.equal(core.compatibleWithCourse(van,vanCourse),true);
 assert.equal(core.compatibleWithCourse(car,carCourse),true);assert.equal(core.compatibleWithCourse(both,carCourse),true);assert.equal(core.compatibleWithCourse(van,carCourse),true);
 assert.equal(core.requiredVehicle({carCount:1,vanCount:1,vehicle:'Autre'}),'mixed');assert.equal(core.compatibleWithCourse(car,{carCount:1,vanCount:1}),true);
});

test('existing courseVehicle callers keep single, grouped, mixed and unknown classifications',()=>{
 for(const e of [{vehicle:'Van'},{vehicleChoice:'Van'},{carCount:0,vanCount:3},{vehicle:'2 × Van'}])assert.equal(core.courseVehicle(e),'van');
 for(const e of [{vehicle:'Voiture normale'},{carCount:2,vanCount:0},{carCount:1,vanCount:2}])assert.equal(core.courseVehicle(e),'car');
 assert.equal(core.courseVehicle({vehicle:'Autre'}),null);
});

test('sorting keeps manual relevance and supports both alphabetical directions',()=>{
 const drivers=[{id:'z',name:'Zohra',priority:0},{id:'e',name:'Émile',priority:2},{id:'a',name:'Alexis',priority:1}];
 assert.deepEqual(core.orderedDrivers(drivers).map(d=>d.id),['z','a','e']);
 assert.deepEqual(core.orderedDrivers(drivers,'az').map(d=>d.id),['a','e','z']);
 assert.deepEqual(core.orderedDrivers(drivers,'za').map(d=>d.id),['z','e','a']);
 assert.deepEqual(drivers.map(d=>d.id),['z','e','a']);
});
test('legacy car bookings keep their eligibility and get the new name in SMS',()=>{
 assert.equal(core.courseVehicle({vehicle:'Petite voiture'}),'car');
 assert.match(core.courseText({vehicle:'Petite voiture'}),/Voiture normale/);
 assert.doesNotMatch(core.courseText({vehicle:'Petite voiture'}),/Petite voiture/);
 const legacyVan={category:'van',acceptsCar:false};
 assert.equal(core.eligible(legacyVan,'car'),true);
 assert.equal(core.eligible({category:'car'},'van'),false);
});

test('alphabetical sorting ignores telephone prefixes',()=>{assert.deepEqual(core.orderedDrivers([{name:'Karim'},{name:'TX Van Nuit Hassan'},{name:'TX Alexis'}],'az').map(d=>d.name),['TX Alexis','TX Van Nuit Hassan','Karim']);});
