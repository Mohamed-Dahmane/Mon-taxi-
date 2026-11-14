"""Offline security regression checks for the SumUp integration (no secrets or network)."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/sumup-sync.yml"
FUNCTION = ROOT / "supabase/functions/taxi-sumup-sync/index.ts"


class SumUpSecurityContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")
        cls.function = FUNCTION.read_text(encoding="utf-8")

    def test_private_credentials_only_from_secrets(self):
        for secret in ("SUMUP_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"):
            self.assertIn("${{ secrets." + secret + " }}", self.workflow)

    def test_http_credentials_never_follow_redirects(self):
        self.assertIn("curl --disable", self.workflow)
        self.assertNotIn("--location", self.workflow)
        self.assertIn("redirect:\"error\"", self.function)
        self.assertIn("class NoRedirect", self.workflow)

    def test_no_partial_history_writes(self):
        self.assertIn("const pendingRows:", self.function)
        self.assertIn("if(!reachedEnd)", self.function)
        self.assertIn("if(seenTransactionIds.has(tx.id))", self.function)
        self.assertEqual(self.function.count('.upsert(pendingRows,'), 1)
        self.assertLess(self.function.index("if(!reachedEnd)"), self.function.index(".upsert(pendingRows,"))

    def test_service_role_and_origin_guards(self):
        self.assertIn("claims.role!==\"service_role\"", self.function)
        self.assertIn("origin.protocol !== \"https:\"", self.function)
        self.assertIn("claims.get('role') != 'service_role'", self.workflow)

    def test_no_financial_response_dump(self):
        self.assertIn("response intentionally not printed", self.workflow)
        self.assertNotIn("cat response.json", self.workflow)
        self.assertIn('note:"No transaction details returned"', self.function)


if __name__ == "__main__":
    unittest.main()
