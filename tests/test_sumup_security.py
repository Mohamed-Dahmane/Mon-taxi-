"""Static regression checks for the private SumUp import path.
Run from repository root: python3 -m unittest discover -s tests -p 'test_sumup_security.py'
No credentials, network, or financial data are needed.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SumUpSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = (ROOT / '.github/workflows/sumup-sync.yml').read_text()
        cls.function = (ROOT / 'supabase/functions/taxi-sumup-sync/index.ts').read_text()
        cls.sql = (ROOT / 'supabase/migrations/202611050001_taxi_sumup.sql').read_text()

    def test_workflow_secrets_and_restricted_permissions(self):
        self.assertIn('contents: read', self.workflow)
        for name in ('SUMUP_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
            self.assertIn('${{ secrets.' + name + ' }}', self.workflow)
        self.assertIn('cancel-in-progress: false', self.workflow)

    def test_function_fails_closed_before_writes(self):
        for marker in ('if(!reachedEnd)', 'duplicate_sumup_transaction_in_pages',
                       'pagination_limit_reached', 'onConflict:"transaction_id"',
                       'redirect:"error"', 'status:403'):
            self.assertIn(marker, self.function)

    def test_ledger_remains_private_and_success_only(self):
        self.assertRegex(self.sql, r'(?i)enable\s+row\s+level\s+security')
        self.assertRegex(self.sql, r'(?i)revoke\s+all\s+on\s+public\.taxi_sumup_transactions\s+from\s+anon,\s*authenticated')
        self.assertRegex(self.sql, r'(?i)revoke\s+all\s+on\s+public\.taxi_sumup_daily_totals\s+from\s+anon,\s*authenticated')
        self.assertRegex(self.sql, r"(?i)where\s+status\s*=\s*'SUCCESSFUL'")
        self.assertIn('security_invoker = true', self.sql)


    def test_privileged_http_requests_do_not_follow_redirects(self):
        # A redirected request must never forward a privileged Authorization header.
        self.assertIn('class NoRedirect(urllib.request.HTTPRedirectHandler)', self.workflow)
        self.assertIn('return None', self.workflow)
        self.assertIn('redirect:"error"', self.function)
        self.assertIn('--proto \'=https\'', self.workflow)
        self.assertNotIn('--location', self.workflow)
        self.assertNotIn('--location-trusted', self.workflow)

    def test_sync_does_not_print_private_response_or_financial_rows(self):
        self.assertIn('--output response.json', self.workflow)
        self.assertIn("trap 'rm -f response.json' EXIT", self.workflow)
        self.assertIn('response intentionally not printed', self.workflow)
        self.assertIn('No financial details printed.', self.workflow)
        self.assertIn('No transaction details returned', self.function)


if __name__ == '__main__':
    unittest.main()
