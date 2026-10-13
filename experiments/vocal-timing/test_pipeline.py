import unittest
import os
from pathlib import Path
from pipeline import checked_words, private_output_path, choose_recognition

class TimelineTests(unittest.TestCase):
    def test_separation_is_preferred_even_when_original_has_more_words(self):
        vocal = [{'text': 'hello'}]
        original = [{'text': 'more words do not prove better recognition'}]
        self.assertEqual(choose_recognition(vocal, original), (vocal, 'vocals', False))

    def test_empty_vocals_can_use_original_only_as_a_review_candidate(self):
        original = [{'text': 'hello', 'start': 1, 'end': 2,
                     'words': [{'word': 'hello', 'start': 1, 'end': 2}]}]
        for vocal in [[], [{'text': '♪ ...'}], [{'text': '  '}]]:
            self.assertEqual(choose_recognition(vocal, original), (original, 'original_mix', True))
        # Do not turn punctuation from either path into lyrics, including on silence.
        self.assertEqual(choose_recognition([], [{'text': '♪'}]), ([], 'none', True))
        self.assertEqual(choose_recognition([], [{'text': 'Entertain',
            'words': [{'word': 'Entertain', 'start': .56, 'end': .56}]}]), ([], 'none', True))

    def test_non_english_vocals_are_not_discarded(self):
        vocals = [{'text': 'こんにちは'}]
        self.assertEqual(choose_recognition(vocals), (vocals, 'vocals', False))

    def test_private_output_cannot_replace_audio_or_enter_public_repository(self):
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            private_output_path(Path('/private/song.mp3'), Path('/private/song.mp3'), Path('/repo'))
        with self.assertRaisesRegex(ValueError, 'outside'):
            private_output_path(Path('/private/song.mp3'), Path('/repo/song.json'), Path('/repo'))
        self.assertEqual(private_output_path(Path('/private/song.mp3'), Path('/private/song.json'), Path('/repo')),
                         Path('/private/song.json'))

    def test_model_telemetry_is_disabled_before_native_imports(self):
        self.assertEqual(os.environ['ORT_DISABLE_TELEMETRY'], '1')
        self.assertEqual(os.environ['HF_HUB_DISABLE_TELEMETRY'], '1')

    def test_excerpt_restores_original_clock(self):
        words, rejected = checked_words([{'word': 'hello', 'start': 1, 'end': 2, 'score': .8}], 10, 20)
        self.assertEqual((words[0]['start'], words[0]['end']), (11, 12))
        self.assertEqual(rejected, 0)

    def test_unaligned_invalid_and_out_of_bounds_words_are_not_invented(self):
        words, rejected = checked_words([
            {'word': 'missing'}, {'word': 'nan', 'start': float('nan'), 'end': 2},
            {'word': 'late', 'start': 8, 'end': 11},
            {'word': 'valid', 'start': 1, 'end': 2},
            {'word': 'backwards', 'start': .5, 'end': 1}], 10, 20)
        self.assertEqual([w['word'] for w in words], ['valid'])
        self.assertEqual(rejected, 4)

    def test_boolean_timestamps_are_not_valid_audio_positions(self):
        words, rejected = checked_words([{'word': 'bad', 'start': True, 'end': 2}], 0, 10)
        self.assertEqual(words, [])
        self.assertEqual(rejected, 1)

if __name__ == '__main__':
    unittest.main()
