"""Offline cross-source Uber trip reconciliation; never writes to Mon Taxi.

Only use for batches whose driver and provenance were already authorized.
Unknown trip IDs must be reviewed, not treated as unique.
"""
from decimal import Decimal, InvalidOperation


def reconcile_events(existing, incoming):
    """Return (new_events, duplicates) or reject ambiguous/conflicting trips.

    Each item requires source, driver_id, event_id, trip_id and amount_cents.
    Identical event replays are harmless. Different sources claiming the same
    trip are *not* added automatically, even if the amount matches.
    """
    by_event = {}
    by_trip = {}
    for event in existing:
        key, trip, cents = _identity(event)
        if key in by_event and by_event[key] != (trip, cents):
            raise ValueError("conflicting existing event")
        if trip in by_trip and by_trip[trip] != key:
            raise ValueError("ambiguous existing trip")
        by_event[key] = (trip, cents)
        by_trip[trip] = key

    accepted, duplicates = [], []
    for event in incoming:
        key, trip, cents = _identity(event)
        if key in by_event:
            if by_event[key] != (trip, cents):
                raise ValueError("conflicting event replay")
            duplicates.append(event)
            continue
        if trip in by_trip:
            raise ValueError("trip already represented; manual review required")
        by_event[key] = (trip, cents)
        by_trip[trip] = key
        accepted.append(event)
    return accepted, duplicates


def _identity(event):
    fields = ("source", "driver_id", "event_id", "trip_id", "amount_cents")
    if any(k not in event for k in fields):
        raise ValueError("missing event identity")
    source, driver, eid, trip = (event[k] for k in fields[:4])
    if source not in ("fleet", "official_export") or any(
        not isinstance(v, str) or not v.strip() for v in (driver, eid, trip)
    ):
        raise ValueError("invalid identity")
    cents = event["amount_cents"]
    if type(cents) is not int:
        raise ValueError("amount must be integer cents")
    return (source, driver, eid), (driver, trip), cents


def test():
    base = dict(source="fleet", driver_id="d1", event_id="p1",
                trip_id="t1", amount_cents=1230)
    new = dict(base, event_id="p2", trip_id="t2")
    accepted, dupes = reconcile_events([base], [dict(base), new])
    assert accepted == [new] and dupes == [base]
    for incoming in (
        [dict(base, source="official_export", event_id="export-1")],
        [dict(base, event_id="p2")],
        [dict(base, amount_cents=1231)],
        [dict(base, driver_id="d2", trip_id="")],
        [dict(base, event_id="p3", trip_id="t3", amount_cents=1.5)],
    ):
        try:
            reconcile_events([base], incoming)
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe event accepted")
    assert reconcile_events([], [dict(base, driver_id="d2")])[0]
    print("cross-source offline reconciliation tests passed")


if __name__ == "__main__":
    test()
