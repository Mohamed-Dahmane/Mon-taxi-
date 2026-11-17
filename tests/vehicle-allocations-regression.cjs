/* Regression tests for the shared vehicle allocation model. Run: node tests/vehicle-allocations-regression.cjs */
const assert = require('node:assert/strict');
require('../vehicle-allocations.js');
const normalize = globalThis.TaxiVehicleAllocations.normalize;
const rows = [
  {type:'Petite voiture',quantity:3,driver:'Alexis',commissionUnit:10},
  {type:'Van',quantity:2,driver:'Yassine',commissionUnit:15},
  {type:'Van',quantity:1,driver:'Alexis',commissionUnit:0}
];
const result = normalize(rows);
assert.equal(result.totalVehicles,6);
assert.equal(result.vehicleCounts.cars,3);
assert.equal(result.vehicleCounts.vans,3);
assert.equal(result.totalCommission,60);
assert.equal(result.assignments.length,3);
assert.equal(result.assignments[2].commissionUnit,0);
assert.equal(result.assignments[2].driver,'Alexis');
assert.deepEqual(rows[0],{type:'Petite voiture',quantity:3,driver:'Alexis',commissionUnit:10});
for(const invalid of [
 [],[{type:'Van',quantity:0,driver:'Moi',commissionUnit:10}],
 [{type:'Van',quantity:1.5,driver:'Moi',commissionUnit:10}],
 [{type:'Van',quantity:1,driver:'',commissionUnit:10}],
 [{type:'Van',quantity:1,driver:'Moi',commissionUnit:''}],
 [{type:'Van',quantity:1,driver:'Moi',commissionUnit:-1}],
 [{type:'Van',quantity:1,driver:'Moi',commissionUnit:1.234}],
 [{type:'Camion',quantity:1,driver:'Moi',commissionUnit:10}],
 [{type:'Van',quantity:Number.MAX_SAFE_INTEGER,driver:'Moi',commissionUnit:100}]
]) assert.throws(()=>normalize(invalid));
console.log('Vehicle allocations regression: OK');
