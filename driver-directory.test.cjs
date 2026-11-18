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
 assert.match(text,/2026-11-19 à 04:30/);assert.match(text,/BRU → Hôtel/);assert.match(text,/Émilie/);assert.match(text,/2 van/);assert.doesNotMatch(text,/undefined|Prix annoncé/);
});
