import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import render_review


class ReviewClipTests(unittest.TestCase):
    def test_relative_paths_survive_the_private_ffmpeg_work_directory(self):
        with tempfile.TemporaryDirectory() as work:
            previous = Path.cwd()
            try:
                os.chdir(work)
                audio = Path('song.mp3')
                audio.write_bytes(b'private-audio-fixture')
                Path('analysis.json').write_text(json.dumps({
                    'sourceSha256': hashlib.sha256(audio.read_bytes()).hexdigest(),
                    'excerptStart': 0, 'excerptDuration': 10,
                    'words': [{'word': 'hello', 'start': 1, 'end': 2}]}))
                def ffmpeg(command, cwd, check):
                    # Resolve input as ffmpeg would after changing cwd. The old
                    # relative path fails here even though validation succeeded.
                    source = Path(command[command.index('-ss') + 3])
                    self.assertTrue((Path(cwd) / source).is_file())
                    self.assertTrue(source.is_absolute())
                    Path(command[-1]).write_bytes(b'review-output')
                with patch('sys.argv', ['render_review.py', 'song.mp3', 'analysis.json',
                            'review.mp4', '--start', '0', '--seconds', '5']), \
                        patch('render_review.subprocess.run', side_effect=ffmpeg), \
                        contextlib.redirect_stdout(io.StringIO()):
                    render_review.main()
                self.assertEqual(Path('review.mp4').read_bytes(), b'review-output')
                self.assertEqual(audio.read_bytes(), b'private-audio-fixture')
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
