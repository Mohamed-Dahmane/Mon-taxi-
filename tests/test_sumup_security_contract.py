"""Offline security regression checks for the SumUp integration (no secrets or network)."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/sumup-sync.yml"
FUNCTION = ROOT / "supabase/functions/taxi-sumup-sync/index.ts"
OFFLINE_WORKFLOW = ROOT / ".github/workflows/sumup-security-tests.yml"


class SumUpSecurityContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")
        cls.function = FUNCTION.read_text(encoding="utf-8")
        cls.offline_workflow = OFFLINE_WORKFLOW.read_text(encoding="utf-8")

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


    def test_offline_ci_is_read_only_without_secrets(self):
        self.assertIn("permissions:\n  contents: read", self.offline_workflow)
        self.assertIn("persist-credentials: false", self.offline_workflow)
        self.assertNotIn("${{ secrets.", self.offline_workflow)
        self.assertNotIn("contents: write", self.offline_workflow)

    def test_sync_serialization_and_response_cleanup(self):
        self.assertIn("permissions:\n  contents: read", self.workflow)
        self.assertIn("group: taxi-sumup-sync", self.workflow)
        self.assertIn("cancel-in-progress: false", self.workflow)
        self.assertIn("umask 077", self.workflow)
        self.assertIn("trap 'rm -f response.json' EXIT", self.workflow)


    def test_bounded_history_and_eur_validation(self):
        self.assertIn('for(let page=0;page<20;page++)', self.function)
        self.assertIn('if(entries.length>100)', self.function)
        self.assertIn('if(!Array.isArray(entries))', self.function)
        self.assertIn('if(tx.currency!=="EUR")continue;', self.function)
        self.assertIn('if(!Number.isSafeInteger(cents)||cents<0)', self.function)
        self.assertIn('timeZone:"Europe/Brussels"', self.function)

    def test_no_verbose_http_or_shell_tracing_of_credentials(self):
        # Workflow carries privileged values in environment variables.
        # Verbose curl and shell tracing could expose headers in public CI logs.
        self.assertNotIn("set -x", self.workflow)
        self.assertNotIn("set -o xtrace", self.workflow)
        self.assertNotIn("curl -v", self.workflow)
        self.assertNotIn("curl --verbose", self.workflow)
        self.assertNotIn("--trace-ascii", self.workflow)
        self.assertNotIn("--trace ", self.workflow)
        self.assertNotIn("printenv", self.workflow)
        self.assertNotIn("env |", self.workflow)

    def test_function_does_not_log_sensitive_transaction_data(self):
        self.assertNotIn("console.log(", self.function)
        self.assertNotIn("console.error(", self.function)
        self.assertNotIn("JSON.stringify(pendingRows)", self.function)
        self.assertNotIn("JSON.stringify(entries)", self.function)

    def test_zero_processed_is_warned_without_financial_details(self):
        self.assertIn("if processed == 0:", self.workflow)
        self.assertIn("WARNING: SumUp returned zero processed EUR records", self.workflow)
        self.assertIn("No financial details printed.", self.workflow)

    def test_success_is_not_a_new_payment_count(self):
        self.assertIn('processed counts examined EUR rows', self.workflow)
        self.assertIn('not necessarily new', self.workflow)
        self.assertIn('result.get("ok") is not True', self.workflow)
        self.assertIn('result.get("window_start")', self.workflow)


if __name__ == "__main__":
    unittest.main()
