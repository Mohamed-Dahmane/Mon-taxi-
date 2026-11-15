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
        hotel: String(entry.hotel || "Réservation"), time: entry.scheduledTime,
        destination: String(entry.destination || "")
      }))
      .filter(entry => entry.pickup > now)
      .flatMap(entry => [60, 30].map(minutes => ({
        ...entry, id: entry.id + ":" + minutes, minutes,
        at: entry.pickup - minutes * 60 * 1000
      })).filter(item => item.at > now))
      .sort((a, b) => a.at - b.at);
  }
  global.TaxiHotels = { equal, merge, courseMap, reminders };
})(globalThis);
