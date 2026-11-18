/* Tests sans accès réseau ni données Supabase : node --test tests/vehicle-allocations-regression-20261118.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../vehicle-allocations.js');
const {normalize} = globalThis.TaxiVehicleAllocations;

test('une course contient voitures et vans attribués à plusieurs chauffeurs', () => {
 const course=normalize([
  {type:'Voiture normale',quantity:3,driver:'Chauffeur A',commissionUnit:10},
  {type:'Van',quantity:2,driver:'Chauffeur B',commissionUnit:15},
  {type:'Van',quantity:1,driver:'Chauffeur A',commissionUnit:0}
 ]);
 assert.deepEqual(course.vehicleCounts,{cars:3,vans:3});
 assert.equal(course.totalVehicles,6);
 assert.equal(course.totalCommission,60);
 assert.equal(course.assignments.length,3);
 assert.equal(course.assignments[2].commissionUnit,0);
});

test('0 € est accepté, les valeurs négatives et les fractions de centime sont rejetées',()=>{
 const row={type:'Van',quantity:1,driver:'Moi',commissionUnit:0};
 assert.equal(normalize([row]).totalCommission,0);
 assert.throws(()=>normalize([{...row,commissionUnit:-1}]));
 assert.throws(()=>normalize([{...row,commissionUnit:0.001}]));
 assert.throws(()=>normalize([{...row,quantity:0}]));
 assert.throws(()=>normalize([{...row,driver:' '}])) ;
});

test('confirmation impossible sans attribution et sans chauffeur',()=>{
 assert.throws(()=>normalize([]));
 assert.throws(()=>normalize([{type:'Van',quantity:1,driver:'',commissionUnit:10}]));
 assert.throws(()=>normalize([{type:'Autobus',quantity:1,driver:'Moi',commissionUnit:10}]));
});
test('une quantité non entière et un total hors plage sûre sont refusés',()=>{
 const row={type:'Voiture normale',quantity:1,driver:'Moi',commissionUnit:10};
 assert.throws(()=>normalize([{...row,quantity:1.5}]));
 assert.throws(()=>normalize([{...row,quantity:Number.MAX_SAFE_INTEGER,commissionUnit:10}]));
});

test('une attribution confirmée est immuable, y compris ses lignes',()=>{
 const confirmed=normalize([{type:'Van',quantity:2,driver:'Moi',commissionUnit:0}]);
 assert.equal(Object.isFrozen(confirmed),true);
 assert.equal(Object.isFrozen(confirmed.assignments),true);
 assert.equal(Object.isFrozen(confirmed.assignments[0]),true);
 assert.equal(Object.isFrozen(confirmed.vehicleCounts),true);
 assert.equal(confirmed.totalVehicles,2);
});

test('les commissions décimales restent exactes au centime sur plusieurs véhicules',()=>{
 const course=normalize([
  {type:'Voiture normale',quantity:3,driver:'Moi',commissionUnit:12.35},
  {type:'Van',quantity:2,driver:'Autre',commissionUnit:0},
  {type:'Van',quantity:1,driver:'Moi',commissionUnit:20.10}
 ]);
 assert.equal(course.totalCommission,57.15);
 assert.equal(course.assignments[0].commissionCents,3705);
 assert.equal(course.assignments[1].commissionCents,0);
 assert.deepEqual(course.vehicleCounts,{cars:3,vans:3});
});

test('une confirmation conserve ses valeurs malgré une modification ultérieure des données saisies',()=>{
 const rows=[{type:'Van',quantity:2,driver:'Moi',commissionUnit:10}];
 const confirmed=normalize(rows);
 rows[0].quantity=99;
 rows[0].driver='Autre';
 rows[0].commissionUnit=0;
 assert.equal(confirmed.totalVehicles,2);
 assert.equal(confirmed.totalCommission,20);
 assert.equal(confirmed.assignments[0].driver,'Moi');
});
