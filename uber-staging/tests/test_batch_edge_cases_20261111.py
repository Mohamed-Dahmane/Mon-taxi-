"""Additional offline regression checks for the Uber batch coverage gate.

Run from repository root: python3 uber-staging/tests/test_batch_edge_cases_20261111.py
No network, secrets, Supabase access, or production writes.
"""
from pathlib import Path
import importlib.util

gate_path = Path(__file__).with_name("test_batch_coverage_gate_20261110.py")
spec = importlib.util.spec_from_file_location("uber_coverage_gate", gate_path)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

BASE = dict(
    driver_id="driver-1", authorized_driver_id="driver-1", source="fleet",
    period_start="2026-11-11T00:00:00+01:00",
    period_end="2026-11-11T23:59:59+01:00",
    pages_expected=2, pages_received=[1, 2], complete=True,
)
EVENT = dict(driver_id="driver-1", event_id="payment-1", trip_id="trip-1", eur="12.30")


def rejects(metadata, events):
    try:
        gate.validate_batch(metadata, events)
    except ValueError:
        return
    raise AssertionError("Unsafe Uber batch accepted")


def test():
    assert gate.validate_batch(BASE, [EVENT, dict(EVENT)]) == 1230, "Replay must be idempotent"
    assert gate.validate_batch(BASE, []) == 0, "Complete empty batch can be zero"
    rejects(dict(BASE, complete=False), [])
    rejects(dict(BASE, pages_received=[2, 2]), [EVENT])
    rejects(dict(BASE, pages_expected=0, pages_received=[]), [EVENT])
    rejects(dict(BASE, source="unknown"), [EVENT])
    rejects(dict(BASE, driver_id="different-driver"), [EVENT])
    rejects(dict(BASE, period_start="2026-11-11T23:59:59+01:00"), [EVENT])
    rejects(dict(BASE, period_end="2026-11-12T00:01:00+01:00"), [EVENT])
    rejects(BASE, [EVENT, dict(EVENT, eur="13.30")])
    rejects(BASE, [EVENT, dict(EVENT, event_id="payment-2")])
    rejects(BASE, [dict(EVENT, trip_id="")])
    rejects(BASE, [dict(EVENT, eur="1.001")])
    rejects(BASE, [dict(EVENT, driver_id="foreign")])
    print("Uber offline edge-case regression checks passed")


if __name__ == "__main__":
    test()
