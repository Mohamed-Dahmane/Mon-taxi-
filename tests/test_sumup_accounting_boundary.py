"""Offline guardrails: importing SumUp history must not silently book daily revenue."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "supabase/functions/taxi-sumup-sync/index.ts"

class SumUpAccountingBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SOURCE.read_text(encoding="utf-8")

    def test_status_is_preserved_for_later_settlement_validation(self):
        self.assertIn('status:String(tx.status??"UNKNOWN")', self.source)
        self.assertIn('transaction_id:String(tx.id)', self.source)
        self.assertIn('amount_cents:cents', self.source)

    def test_sync_does_not_book_revenue_or_override_manual_cards(self):
        # This importer is deliberately staging-only. Any future accounting
        # integration needs explicit settled-status and deduplication tests.
        targets = re.findall(r'\.from\(\s*["\']([^"\']+)["\']\s*\)', self.source)
        self.assertTrue(targets, "Expected an explicit storage target")
        self.assertEqual(set(targets), {"taxi_sumup_transactions"})
        self.assertNotIn("localStorage", self.source)

    def test_no_claim_that_processed_means_settled(self):
        self.assertIn('processed:count', self.source)
        self.assertNotIn('settled:count', self.source)
        self.assertNotIn('revenue_cents:', self.source)

if __name__ == "__main__":
    unittest.main()
