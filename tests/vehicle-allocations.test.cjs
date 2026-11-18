const fs=require("fs"),vm=require("vm"),assert=require("assert");
const context={};vm.runInNewContext(fs.readFileSync("vehicle-allocations.js","utf8"),context);
const normalize=context.TaxiVehicleAllocations.normalize;
const result=normalize([{type:"Voiture normale",quantity:3,driver:"Alexis",commissionUnit:10},{type:"Van",quantity:2,driver:"Alexis",commissionUnit:0},{type:"Van",quantity:1,driver:"Yassine",commissionUnit:15}]);
assert.strictEqual(result.totalVehicles,6);assert.strictEqual(result.totalCommission,45);
assert.strictEqual(result.vehicleCounts.cars,3);assert.strictEqual(result.vehicleCounts.vans,3);
for(const rows of [[],[{type:"Van",quantity:0,driver:"Moi",commissionUnit:10}],[{type:"Van",quantity:1.5,driver:"Moi",commissionUnit:10}],[{type:"Van",quantity:1,driver:"",commissionUnit:10}],[{type:"Van",quantity:1,driver:"Moi",commissionUnit:-1}],[{type:"Van",quantity:1,driver:"Moi",commissionUnit:0.001}]])assert.throws(()=>normalize(rows));
console.log("Vehicle allocations: tests OK");
