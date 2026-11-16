(function (global) {
  "use strict";
  const missing = undefined;
  const own = (object, key) => Object.hasOwn(object, key) ? object[key] : missing;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const equal = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, i) => equal(value, b[i]))) ||
    (isRecord(a) && isRecord(b) && Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(key => Object.hasOwn(b, key) && equal(a[key], b[key])));

  function merge(base, local, remote, initial = false) {
    if (equal(local, base)) return remote;
    if (local === missing) return missing;
    if (remote === missing && base !== missing && !initial) return missing;
    if (isRecord(local) && (remote === missing || isRecord(remote))) {
      const before = isRecord(base) ? base : {};
      const after = remote ?? {};
      const keys = new Set([...Object.keys(local), ...Object.keys(after), ...Object.keys(before)]);
      return Object.fromEntries([...keys].flatMap(key => {
        const value = merge(own(before, key), own(local, key), own(after, key), initial);
        return value === missing ? [] : [[key, value]];
      }));
    }
    if (Array.isArray(local) && Array.isArray(remote) &&
        [...local, ...remote].every(item => typeof item === "string")) {
      if (initial) return [...new Set([...remote, ...local])];
      const previous = Array.isArray(base) ? base : [];
      return [...new Set([...local.filter(item => !previous.includes(item) || remote.includes(item)),
        ...remote.filter(item => !previous.includes(item))])];
    }
    return initial && remote !== missing ? remote : local;
  }

  function applyPartnerDirectory(directory, feed) {
    const previous = directory.partnerDirectory;
    if (!feed || previous?.revision >= feed.revision) return directory;

    const { hotels, drivers } = feed.payload;
    const oldHotels = new Map((previous?.hotels ?? []).map(hotel => [hotel.id, hotel]));
    const oldHotelNames = new Set([...oldHotels.values()].map(hotel => hotel.name));
    const oldPeople = new Set(previous?.people ?? []);
    const partnerNames = new Set(hotels.map(hotel => hotel.name));
    const partners = new Set([...drivers.map(person => person.name),
      ...hotels.flatMap(hotel => hotel.people.map(person => person.name))]);
    const assigners = hotels.filter(hotel => hotel.role === "attribution")
      .flatMap(hotel => hotel.people.map(person => person.name));

    const existingHotels = Object.entries(directory.hotels ?? {})
      .filter(([name]) => !oldHotelNames.has(name) && !partnerNames.has(name));
    const hotelDefaults = hotels.map(hotel => [hotel.name,
      hotel.people.find(person => person.id === hotel.defaultId)?.name ?? ""]);
    const existingContacts = Object.entries(directory.allowedContacts ?? {})
      .filter(([name]) => !oldHotelNames.has(name) && !partnerNames.has(name));
    const allowedContacts = hotels.map(hotel => [hotel.name, hotel.people.map(person => person.name)]);
    const tariffNames = { ...directory.tariffNames };
    for (const hotel of hotels) {
      const oldName = oldHotels.get(hotel.id)?.name;
      if (oldName && oldName !== hotel.name) tariffNames[hotel.name] = tariffNames[oldName] ?? oldName;
    }
    const unique = values => [...new Set(values)];
    const nameKey = value => value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
    const managedPeople = new Set([...oldPeople, ...partners].map(nameKey));
    const driverNames = [...drivers.map(person => person.name),
      ...hotels.filter(hotel => hotel.role === "chauffeur").flatMap(hotel => hotel.people.map(person => person.name))];
    return {
      ...directory,
      hotels: Object.fromEntries([...hotelDefaults, ...existingHotels]),
      allowedContacts: Object.fromEntries([...allowedContacts, ...existingContacts]),
      contacts: unique([...partners, ...(directory.contacts ?? []).filter(name => !managedPeople.has(nameKey(name)))]),
      hotelSequence: unique([...partnerNames, ...(directory.hotelSequence ?? []).filter(name => !oldHotelNames.has(name))]),
      driverOrder: unique([...driverNames, ...(directory.driverOrder ?? []).filter(name => !managedPeople.has(nameKey(name)))]),
      manualHotelOrder: true,
      tariffNames,
      referralOnlyContacts: unique([...assigners.map(nameKey),
        ...(directory.referralOnlyContacts ?? []).filter(key => !managedPeople.has(key))]),
      inactiveCommissionHotels: unique([...(directory.inactiveCommissionHotels ?? []).filter(name => !oldHotelNames.has(name) && !partnerNames.has(name)),
        ...hotels.filter(hotel => hotel.role === "chauffeur").map(hotel => hotel.name)]),
      partnerDirectory: { revision: feed.revision, hotels: hotels.map(({ id, name }) => ({ id, name })), people: [...partners] }
    };
  }

  const courseMap = entries => Object.fromEntries(entries
    .filter(entry => isRecord(entry) && entry.id != null)
    .map(entry => [String(entry.id), entry]));
  const dateTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  function pickupTime(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(time ?? "")) return NaN;
    const target = Date.parse(date + "T" + time + ":00Z");
    if (!Number.isFinite(target)) return NaN;
    let estimate = target;
    for (let attempt = 0; attempt < 3; attempt++) {
      const local = Object.fromEntries(dateTime.formatToParts(estimate).map(({ type, value }) => [type, value]));
      const actual = Date.parse(local.year + "-" + local.month + "-" + local.day + "T" + local.hour + ":" + local.minute + ":00Z");
      if (actual === target) return estimate;
      estimate += target - actual;
    }
    return NaN;
  }

  function reminders(courses, now = Date.now()) {
    return courses.filter(entry => entry.bookingMode === "Programmée" &&
      entry.reservationStatus !== "cancelled" && !(entry.reservationStatus === "validated" &&
        entry.validatedAt && entry.validatedAt >= entry.scheduledDate))
      .map(entry => ({
        id: String(entry.id), pickup: pickupTime(entry.scheduledDate, entry.scheduledTime),
        hotel: String(entry.pickup?.place || entry.hotel || "Réservation"), time: entry.scheduledTime,
        pickupOptions: entry.pickup,
        destination: String(entry.destination || "")
      }))
      .filter(entry => entry.pickup > now)
      .flatMap(({ pickupOptions, ...entry }) => [60, 30]
        .filter(minutes => pickupOptions?.["reminder" + minutes] !== false)
        .map(minutes => ({
          ...entry, id: entry.id + ":" + minutes, minutes,
          at: entry.pickup - minutes * 60 * 1000
        })).filter(item => item.at > now))
      .sort((a, b) => a.at - b.at);
  }
  global.TaxiHotels = { equal, merge, applyPartnerDirectory, courseMap, reminders };
})(globalThis);
