import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('privacy',Path(__file__).parents[1]/'scripts/verify_dayun_r2_privacy.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class PrivacyTests(unittest.TestCase):
    def test_only_explicitly_private_bucket_passes(self):
        with patch.object(mod,'api_get',side_effect=[{'enabled':False},{'domains':[]}]):
            self.assertTrue(mod.verify('test')['ok'])
    def test_public_unknown_and_any_custom_domain_fail_closed(self):
        for managed,custom in [({'enabled':True},{'domains':[]}),({}, {'domains':[]}),({'enabled':False},{}),({'enabled':False},{'domains':[{'enabled':False}]})]:
            with self.subTest(managed=managed,custom=custom),patch.object(mod,'api_get',side_effect=[managed,custom]),self.assertRaises(RuntimeError):
                mod.verify('test')
    def test_missing_identity_never_contacts_cloudflare(self):
        with patch.dict(mod.os.environ,{'CLOUDFLARE_API_TOKEN':''}),patch.object(mod,'api_get') as call,self.assertRaisesRegex(RuntimeError,'credentials_missing'):
            mod.verify()
        call.assert_not_called()

if __name__=='__main__':unittest.main()
