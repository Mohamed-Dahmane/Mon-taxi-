"""Offline assertions for privileged HTTP boundary and safe API failures."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
FUNCTION = (ROOT / "supabase/functions/taxi-sumup-sync/index.ts").read_text(encoding="utf-8")
WORKFLOW = (ROOT / ".github/workflows/sumup-sync.yml").read_text(encoding="utf-8")


class SumUpNetworkBoundary(unittest.TestCase):
    def test_sumup_requests_are_https_only_and_do_not_follow_redirects(self):
        self.assertIn('new URL("https://api.sumup.com/v0.1/me/transactions/history")', FUNCTION)
        self.assertIn('redirect:"error"', FUNCTION)
        self.assertIn('signal:AbortSignal.timeout(20000)', FUNCTION)

    def test_sumup_failures_do_not_echo_response_body(self):
        self.assertIn('reason:"sumup_http_"+response.status', FUNCTION)
        self.assertIn('reason:"invalid_sumup_json"', FUNCTION)
        self.assertIn('reason:"unexpected_sumup_response"', FUNCTION)
        self.assertNotIn('console.log(', FUNCTION)
        self.assertNotIn('console.error(', FUNCTION)

    def test_github_request_does_not_follow_redirects_or_dump_body(self):
        self.assertIn("curl --disable --proto '=https'", WORKFLOW)
        self.assertNotIn('--location', WORKFLOW)
        self.assertIn('response intentionally not printed', WORKFLOW)
        self.assertIn("trap 'rm -f response.json' EXIT", WORKFLOW)

    def test_no_partial_upsert_on_pagination_error(self):
        self.assertIn('reason:"duplicate_sumup_transaction_in_pages"', FUNCTION)
        self.assertIn('reason:"pagination_limit_reached"', FUNCTION)
        self.assertLess(FUNCTION.index('if(!reachedEnd)'), FUNCTION.index('.upsert(pendingRows,'))


if __name__ == "__main__":
    unittest.main()
