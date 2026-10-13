import contextlib
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from preflight import check_runtime
import worker


class ReadinessTests(unittest.TestCase):
    def test_runtime_check_probes_binaries_and_both_caches_without_claiming_models_warm(self):
        with tempfile.TemporaryDirectory() as work:
            env = {'HF_HOME': str(Path(work) / 'hf'), 'TORCH_HOME': str(Path(work) / 'torch')}
            with patch.dict(os.environ, env), patch('preflight.subprocess.run') as binary, \
                    patch('preflight.importlib.import_module') as native:
                self.assertEqual(check_runtime(), {'runtimeReady': True, 'modelsWarmed': False})
            self.assertEqual(binary.call_count, 2)
            self.assertIn('whisperx.alignment', [c.args[0] for c in native.call_args_list])
            self.assertTrue(Path(env['HF_HOME']).is_dir())
            self.assertTrue(Path(env['TORCH_HOME']).is_dir())

    def test_bad_runtime_cannot_claim_a_billable_job_or_log_configuration_secrets(self):
        env = {'WALVR_APP_URL': 'https://app.test', 'WALVR_STORAGE_ORIGIN': 'https://storage.test',
               'WALVR_VOCAL_WORKER_SECRET': 'private-worker-secret' * 2}
        output = io.StringIO()
        with patch.dict(os.environ, env), patch('sys.argv', ['worker.py', '--once']), \
                patch('worker.Client') as client, \
                patch('preflight.check_runtime', side_effect=PermissionError(env['WALVR_VOCAL_WORKER_SECRET'])), \
                contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as result:
                worker.main()
        self.assertEqual(result.exception.code, 1)
        client.return_value.send.assert_not_called()
        self.assertIn('runtime_or_cache_unavailable', output.getvalue())
        self.assertNotIn(env['WALVR_VOCAL_WORKER_SECRET'], output.getvalue())


if __name__ == '__main__':
    unittest.main()
