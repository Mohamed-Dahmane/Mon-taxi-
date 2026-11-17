/* Tests sans accès réseau ni données Supabase : node --test tests/vehicle-allocations-regression-20261118.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../vehicle-allocations.js');
const {normalize} = globalThis.TaxiVehicleAllocations;

test('une course contient voitures et vans attribués à plusieurs chauffeurs', () => {
 const course=normalize([
  {type:'Petite voiture',quantity:3,driver:'Chauffeur A',commissionUnit:10},
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
