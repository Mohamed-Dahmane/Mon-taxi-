/* Règles de référence pour la future interface Commissions Hôtels.
   Module pur : ne modifie ni le stockage, ni les courses existantes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MonTaxiHotelContacts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const specialHotels = new Set(["doubletree by hilton", "the standard"]);
  const normalize = value => String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const hotelKey = name => {
    const key = normalize(name);
    if (key.startsWith("doubletree")) return "doubletree by hilton";
    if (key.startsWith("the standard")) return "the standard";
    return key;
  };
  const unique = names => [...new Map((names || []).filter(name => typeof name === "string" && name.trim()).map(name => [normalize(name), name.trim()])).values()];
  function isSpecialHotel(name) { return specialHotels.has(hotelKey(name)); }
  function restrictedContacts(directory) {
    const result = new Set();
    for (const hotel of directory || []) {
      if (!isSpecialHotel(hotel.name)) continue;
      for (const contact of unique([hotel.defaultContact, ...(hotel.contacts || [])])) result.add(normalize(contact));
    }
    return result;
  }
  function eligibleDrivers(directory, driverNames) {
    const forbidden = restrictedContacts(directory);
    const candidates = unique([...(driverNames || []), ...(directory || []).filter(h => !isSpecialHotel(h.name)).flatMap(h => [h.defaultContact, ...(h.contacts || [])])]);
    return candidates.filter(name => !forbidden.has(normalize(name)));
  }
  function upsertHotel(directory, name, defaultContact) {
    const hotelName = String(name || "").trim();
    const contactName = String(defaultContact || "").trim();
    if (!hotelName || !contactName) throw new Error("Nom de l'hôtel et contact par défaut obligatoires");
    const copy = (directory || []).map(h => ({...h, contacts: [...(h.contacts || [])]}));
    const index = copy.findIndex(h => hotelKey(h.name) === hotelKey(hotelName));
    const current = index < 0 ? {name: hotelName, contacts: []} : copy[index];
    const updated = {...current, defaultContact: contactName, contacts: unique([...(current.contacts || []), contactName])};
    if (index < 0) copy.push(updated); else copy[index] = updated;
    return copy;
  }
  return Object.freeze({isSpecialHotel, restrictedContacts, eligibleDrivers, upsertHotel});
});
