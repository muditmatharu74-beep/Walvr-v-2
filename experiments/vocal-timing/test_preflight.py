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
    def test_bad_or_missing_configuration_exits_before_model_loading_or_claims(self):
        base = {'WALVR_APP_URL': 'https://app.test', 'WALVR_STORAGE_ORIGIN': 'https://storage.test',
                'WALVR_VOCAL_WORKER_SECRET': 'private-worker-secret' * 2}
        cases = [dict(base, WALVR_STORAGE_ORIGIN='https://storage.test/wrong-path'),
                 dict(base, WALVR_APP_URL='https://'),
                 dict(base, WALVR_VOCAL_WORKER_SECRET='short-private-secret'),
                 {k: v for k, v in base.items() if k != 'WALVR_STORAGE_ORIGIN'}]
        for env in cases:
            output = io.StringIO()
            with self.subTest(keys=sorted(env)), patch.dict(os.environ, env, clear=True), \
                    patch('sys.argv', ['worker.py', '--once']), \
                    patch('worker.prepare_models') as warm, patch('worker.run_once') as claim, \
                    contextlib.redirect_stdout(output):
                with self.assertRaises(SystemExit) as result:
                    worker.main()
            self.assertEqual(result.exception.code, 1)
            warm.assert_not_called()
            claim.assert_not_called()
            self.assertIn('configuration_runtime_cache_or_model_unavailable', output.getvalue())
            self.assertNotIn('private-worker-secret', output.getvalue())
            self.assertNotIn('short-private-secret', output.getvalue())

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
                patch('worker.prepare_models', side_effect=PermissionError(env['WALVR_VOCAL_WORKER_SECRET'])), \
                contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as result:
                worker.main()
        self.assertEqual(result.exception.code, 1)
        client.return_value.send.assert_not_called()
        self.assertIn('runtime_cache_or_model_unavailable', output.getvalue())
        self.assertNotIn(env['WALVR_VOCAL_WORKER_SECRET'], output.getvalue())

    def test_warmup_failure_cannot_claim_a_job(self):
        env = {'WALVR_APP_URL': 'https://app.test', 'WALVR_STORAGE_ORIGIN': 'https://storage.test',
               'WALVR_VOCAL_WORKER_SECRET': 'private-worker-secret' * 2}
        with patch.dict(os.environ, env), patch('sys.argv', ['worker.py', '--once']), \
                patch('worker.Client') as client, patch('preflight.check_runtime'), \
                patch('worker.prepare_models', side_effect=OSError('model unavailable')), \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit):
                worker.main()
        client.return_value.send.assert_not_called()

    def test_warmup_finishes_before_the_first_queue_claim(self):
        events = []
        env = {'WALVR_APP_URL': 'https://app.test', 'WALVR_STORAGE_ORIGIN': 'https://storage.test',
               'WALVR_VOCAL_WORKER_SECRET': 'private-worker-secret' * 2}
        def warm(*args):
            events.append('warm')
            return {'modelsWarmed': True}
        def claim(action, **kwargs):
            events.append(action)
            return {'job': None}
        with patch.dict(os.environ, env), patch('sys.argv', ['worker.py', '--once']), \
                patch('worker.Client') as client, patch('preflight.check_runtime'), \
                patch('worker.prepare_models', side_effect=warm), \
                contextlib.redirect_stdout(io.StringIO()):
            client.return_value.send.side_effect = claim
            worker.main()
        self.assertEqual(events, ['warm', 'claim'])


if __name__ == '__main__':
    unittest.main()

