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

  function directoryForPartners(directory) {
    return Object.fromEntries([
      "hotels", "allowedContacts", "contacts", "hotelSequence", "driverOrder", "referralOnlyContacts"
    ].map(key => [key, directory[key] ?? (["hotels", "allowedContacts"].includes(key) ? {} : [])]));
  }

  function applyPartnerDirectory(directory, feed) {
    const previous = directory.partnerDirectory;
    if (!feed || previous?.revision > feed.revision) return directory;
    if (previous?.revision === feed.revision) {
      return previous.baseline ? directory : {
        ...directory, partnerDirectory: { ...previous, baseline: directoryForPartners(directory) }
      };
    }

    const local = directoryForPartners(directory);
    const expected = previous?.baseline ? { ...directory, ...previous.baseline } : directory;
    const { hotels, drivers } = feed.payload;
    const oldHotels = new Map((previous?.hotels ?? []).map(hotel => [hotel.id, hotel]));
    const oldHotelNames = new Set([...oldHotels.values()].map(hotel => hotel.name));
    const oldPeople = new Set(previous?.people ?? []);
    const partnerNames = new Set(hotels.map(hotel => hotel.name));
    const partners = new Set([...drivers.map(person => person.name),
      ...hotels.flatMap(hotel => hotel.people.map(person => person.name))]);
    const assigners = hotels.filter(hotel => hotel.role === "attribution")
      .flatMap(hotel => hotel.people.map(person => person.name));

    const existingHotels = Object.entries(expected.hotels ?? {})
      .filter(([name]) => !oldHotelNames.has(name) && !partnerNames.has(name));
    const hotelDefaults = hotels.map(hotel => [hotel.name,
      hotel.people.find(person => person.id === hotel.defaultId)?.name ?? ""]);
    const existingContacts = Object.entries(expected.allowedContacts ?? {})
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
    const synced = {
      ...directory,
      hotels: Object.fromEntries([...hotelDefaults, ...existingHotels]),
      allowedContacts: Object.fromEntries([...allowedContacts, ...existingContacts]),
      contacts: unique([...partners, ...(expected.contacts ?? []).filter(name => !managedPeople.has(nameKey(name)))]),
      hotelSequence: unique([...partnerNames, ...(expected.hotelSequence ?? []).filter(name => !oldHotelNames.has(name))]),
      driverOrder: unique([...driverNames, ...(expected.driverOrder ?? []).filter(name => !managedPeople.has(nameKey(name)))]),
      manualHotelOrder: true,
      tariffNames,
      referralOnlyContacts: unique([...assigners.map(nameKey),
        ...(expected.referralOnlyContacts ?? []).filter(key => !managedPeople.has(key))]),
      inactiveCommissionHotels: unique([...(directory.inactiveCommissionHotels ?? []).filter(name => !oldHotelNames.has(name) && !partnerNames.has(name)),
        ...hotels.filter(hotel => hotel.role === "chauffeur").map(hotel => hotel.name)]),
      partnerDirectory: { revision: feed.revision, hotels: hotels.map(({ id, name }) => ({ id, name })), people: [...partners] }
    };
    const baseline = directoryForPartners(synced);
    synced.partnerDirectory.baseline = baseline;
    if (previous?.baseline) {
      Object.assign(synced, merge(previous.baseline, local, baseline));
      for (const field of ["hotelRenames", "peopleRenames"]) {
        if (previous[field]) synced.partnerDirectory[field] = previous[field];
      }
    }
    return synced;
  }

  const courseMap = entries => Object.fromEntries(entries
    .filter(entry => isRecord(entry) && entry.id != null)
    .map(entry => [String(entry.id), entry]));
  const referenceCountersKey = "montaxi:course-reference-counters:v1";
  const referenceParts = reference => /^(\d{6})\.(\d{2,})$/.exec(reference ?? "");
  const validSequence = number => Number.isSafeInteger(number) && number > 0;
  const formatReference = (day, number) => day + "." + String(number).padStart(2, "0");

  function collectReferenceCounters(...states) {
    const counters = {};
    const keep = (day, number) => {
      if (/^\d{6}$/.test(day) && validSequence(number)) {
        counters[day] = Math.max(counters[day] ?? 0, number);
      }
    };
    for (const state of states) {
      for (const [day, number] of Object.entries(state.referenceCounters ?? {})) keep(day, number);
      for (const course of Object.values(state.courses ?? {})) {
        const parts = referenceParts(course.reference);
        if (parts) keep(parts[1], Number(parts[2]));
      }
    }
    return counters;
  }

  function nextReference(date, courses, referenceCounters) {
    const day = date.slice(2).replaceAll("-", "");
    const counters = collectReferenceCounters({ courses, referenceCounters });
    const sequence = (counters[day] ?? 0) + 1;
    if (!/^\d{6}$/.test(day) || !validSequence(sequence)) throw Error("Référence de course invalide");
    counters[day] = sequence;
    return { reference: formatReference(day, sequence), referenceCounters: counters };
  }

  function reconcileReferences(state, published, ...previous) {
    const publishedCounters = collectReferenceCounters(published);
    const counters = collectReferenceCounters(state, published, ...previous);
    const courses = { ...state.courses };
    const claimed = new Set();
    const pending = [];
    for (const id of Object.keys(courses).sort()) {
      const course = courses[id];
      const remoteReference = published.courses?.[id]?.reference;
      if (referenceParts(remoteReference) && !claimed.has(remoteReference)) {
        claimed.add(remoteReference);
        if (course.reference !== remoteReference) courses[id] = { ...course, reference: remoteReference };
      } else if (referenceParts(course.reference)) {
        pending.push(id);
      }
    }
    for (const id of pending) {
      const course = courses[id];
      const [, day, sequence] = referenceParts(course.reference);
      if (!claimed.has(course.reference) && Number(sequence) > (publishedCounters[day] ?? 0)) {
        claimed.add(course.reference);
        continue;
      }
      const next = (counters[day] ?? 0) + 1;
      if (!validSequence(next)) throw Error("Compteur de références invalide");
      counters[day] = next;
      courses[id] = { ...course, reference: formatReference(day, next) };
      claimed.add(courses[id].reference);
    }
    return { ...state, courses, referenceCounters: counters };
  }

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
  global.TaxiHotels = { equal, merge, applyPartnerDirectory, courseMap, reminders, referenceCountersKey, nextReference, reconcileReferences };
})(globalThis);
