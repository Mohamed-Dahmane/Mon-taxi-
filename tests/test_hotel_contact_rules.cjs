const assert = require("node:assert/strict");
const {isSpecialHotel, eligibleDrivers, upsertHotel} = require("../hotel-contact-rules.js");
const directory = [
  {name:"DoubleTree by Hilton", defaultContact:"Papas", contacts:["Day","Night","Papas"]},
  {name:"The Standard", defaultContact:"Fal", contacts:["Fal","Moncef"]},
  {name:"NH Collection (Atlanta)", defaultContact:"Yassine", contacts:["Yassine"]},
];
assert.equal(isSpecialHotel("DoubleTree by Hilton Brussels City"), true);
assert.equal(isSpecialHotel("The Standard Brussels"), true);
assert.deepEqual(eligibleDrivers(directory, ["Papas","Fal","Yassine","Alexis"]), ["Yassine","Alexis"]);
const updated = upsertHotel(directory, "Nouvel Hôtel", "Mehdi");
assert.equal(updated.length, 4);
assert.equal(updated[3].defaultContact, "Mehdi");
assert.deepEqual(eligibleDrivers(updated, []), ["Yassine","Mehdi"]);
assert.equal(directory.length, 3, "la liste source reste intacte");
assert.equal(upsertHotel(updated, "Nouvel Hôtel", "Alexis").length, 4, "pas de doublon d'hôtel");
assert.throws(() => upsertHotel(directory, "", "Mehdi"));
console.log("Tests des règles hôtels/contacts : OK");
