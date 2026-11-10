"""Offline-only gate: never publish an incomplete Uber earnings batch.

No Supabase, Uber, or Mon Taxi production access. Run with Python 3.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

BRUSSELS = ZoneInfo("Europe/Brussels")


def validate_batch(metadata, events):
    """Return EUR cents only for a complete, authorized, internally consistent batch.

    This is a preview validation, NOT permission to write to Appli.
    """
    required = ("driver_id", "authorized_driver_id", "source", "period_start",
                "period_end", "pages_expected", "pages_received", "complete")
    if any(k not in metadata for k in required):
        raise ValueError("missing batch metadata")
    if not metadata["driver_id"] or metadata["driver_id"] != metadata["authorized_driver_id"]:
        raise ValueError("driver authorization not established")
    if metadata["source"] not in ("fleet", "official_export"):
        raise ValueError("unapproved source")
    if metadata["complete"] is not True:
        raise ValueError("incomplete or unknown coverage")
    expected = metadata["pages_expected"]
    received = metadata["pages_received"]
    if not isinstance(expected, int) or isinstance(expected, bool) or expected < 1:
        raise ValueError("invalid expected page count")
    if sorted(received) != list(range(1, expected + 1)):
        raise ValueError("missing or duplicate pages")
    start = datetime.fromisoformat(metadata["period_start"])
    end = datetime.fromisoformat(metadata["period_end"])
    if start.tzinfo is None or end.tzinfo is None or start >= end:
        raise ValueError("invalid time window")
    if start.astimezone(BRUSSELS).date() != (end.astimezone(BRUSSELS).date()):
        raise ValueError("cross-day batch requires separate reconciliation")
    from decimal import Decimal
    seen_events, seen_trips = {}, set()
    total = 0
    for event in events:
        if event.get("driver_id") != metadata["driver_id"]:
            raise ValueError("foreign driver")
        eid, trip = event.get("event_id"), event.get("trip_id")
        if not eid or not trip:
            raise ValueError("unreconciled event identity")
        key = (metadata["source"], metadata["driver_id"], eid)
        amount = Decimal(str(event["eur"])) * 100
        if not amount.is_finite() or amount != amount.to_integral_value():
            raise ValueError("invalid cents")
        if key in seen_events:
            if seen_events[key] != (int(amount), trip):
                raise ValueError("conflicting replay")
            continue
        if trip in seen_trips:
            raise ValueError("second event for same trip needs review")
        seen_events[key] = (int(amount), trip)
        seen_trips.add(trip)
        total += int(amount)
    return total


def test():
    m = dict(driver_id="d1", authorized_driver_id="d1", source="fleet",
             period_start="2026-11-10T00:00:00+01:00",
             period_end="2026-11-10T23:59:59+01:00",
             pages_expected=2, pages_received=[1, 2], complete=True)
    a = dict(driver_id="d1", event_id="e1", trip_id="t1", eur="12.30")
    assert validate_batch(m, [a, a]) == 1230
    for changes in (dict(complete=False), dict(pages_received=[1]),
                    dict(pages_received=[1, 1]), dict(authorized_driver_id="d2")):
        try:
            validate_batch(dict(m, **changes), [a])
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe batch accepted")
    for bad in ([a, dict(a, event_id="e2")],
                [dict(a, driver_id="d2")], [dict(a, eur="1.001")]):
        try:
            validate_batch(m, bad)
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe event accepted")


if __name__ == "__main__":
    test()
    print("coverage gate offline checks passed")
