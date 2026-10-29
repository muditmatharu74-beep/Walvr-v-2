import unittest
import os
from pathlib import Path
from pipeline import checked_words, private_output_path, choose_recognition, review_reasons_for

class TimelineTests(unittest.TestCase):
    def test_scattered_words_across_a_full_song_require_review(self):
        # A real 190-second comparison produced isolated two-word phrases.
        # Six words exceed the old absolute count but are not a safe full-song result.
        words = [{'word': 'phrase', 'start': i * 30, 'end': i * 30 + .5} for i in range(6)]
        self.assertIn('sparse_recognition', review_reasons_for(words, 0, 1, 'vocals', 190.104))
        self.assertEqual(len(words), 6, 'Review must not erase possibly genuine sparse lyrics')
        dense = [{'word': 'lyric', 'start': i * .4, 'end': i * .4 + .2} for i in range(319)]
        self.assertNotIn('sparse_recognition', review_reasons_for(dense, 0, 1, 'vocals', 153.992))

    def test_one_timed_music_word_cannot_automatically_caption_a_long_excerpt(self):
        words = [{'word': 'Music', 'start': 2.08, 'end': 3.48}]
        self.assertIn('sparse_recognition', review_reasons_for(words, 0, 1, 'vocals', 25))
        # Keep an actual short one-word lyric intact; a sparse longer song needs review.
        self.assertEqual(review_reasons_for(words, 0, 1, 'vocals', 4), [])
        self.assertIn('original_mix_fallback', review_reasons_for(words * 4, 0, 1, 'original_mix', 25))

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

    def test_rounded_or_clipped_intervals_must_still_have_positive_duration(self):
        words, rejected = checked_words([
            {'word': 'too short', 'start': .1001, 'end': .1002},
            {'word': 'valid', 'start': .2, 'end': .4},
            {'word': 'past source', 'start': 1.01, 'end': 1.02},
        ], 10, 11)
        self.assertEqual([w['word'] for w in words], ['valid'])
        self.assertEqual(rejected, 2)
        self.assertIn('rejected_alignment_words',
                      review_reasons_for(words, rejected, 1, 'vocals', 1))
        tail, rejected = checked_words([
            {'word': 'tail', 'start': .99, 'end': 1.00059},
        ], 0, 1.0006)
        self.assertEqual(rejected, 0)
        self.assertEqual(tail[0]['end'], 1.0006, 'Rounding cannot extend past the audio')

    def test_malformed_alignment_entries_are_counted_without_losing_valid_words(self):
        words, rejected = checked_words([
            None, 'not a word', [],
            {'word': 'valid', 'start': 1, 'end': 2},
        ], 0, 10)
        self.assertEqual([w['word'] for w in words], ['valid'])
        self.assertEqual(rejected, 3)

if __name__ == '__main__':
    unittest.main()

