"""Offline regression checks for Uber event reconciliation; no network or production writes."""
from decimal import Decimal

def cents(value):
    amount = Decimal(str(value)) * 100
    if amount != amount.to_integral_value():
        raise ValueError("fractional euro cent")
    return int(amount)

def reconcile(events, allowed_driver):
    by_event, by_trip = {}, {}
    for e in events:
        if e["driver"] != allowed_driver:
            raise ValueError("unauthorized driver")
        if not e.get("event_id") or not e.get("source"):
            raise ValueError("missing event identity")
        key = (e["source"], e["driver"], e["event_id"])
        amount = cents(e["eur"])
        if key in by_event:
            if by_event[key] != amount:
                raise ValueError("conflicting replay")
            continue
        trip = e.get("trip_id")
        if trip:
            trip_key = (e["driver"], trip)
            if trip_key in by_trip and by_trip[trip_key] != (amount, e["source"]):
                raise ValueError("cross-source overlap or adjustment requires review")
            by_trip[trip_key] = (amount, e["source"])
        by_event[key] = amount
    return by_event

def test():
    base = dict(source="fleet", driver="d1", event_id="p1", trip_id="t1", eur="12.30")
    assert len(reconcile([base, base], "d1")) == 1
    assert cents("12.30") == 1230
    for invalid in (
        [base, dict(base, eur="13.30")],
        [base, dict(base, source="export", event_id="x1")],
        [dict(base, driver="d2")],
        [dict(base, eur="1.001")],
    ):
        try:
            reconcile(invalid, "d1")
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe event accepted")
    assert len(reconcile([base, dict(base, event_id="p2", trip_id="t2", eur="-1.00")], "d1")) == 2

if __name__ == "__main__":
    test()
    print("offline reconciliation checks passed")
