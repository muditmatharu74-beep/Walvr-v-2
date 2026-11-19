import unittest
from evaluate import measure


def fixture(words, verified=False):
    return {'sourceSha256': 'a' * 64, 'songDuration': 10, 'excerptStart': 0,
            'excerptDuration': 10, 'humanVerified': verified,
            'words': [{'word': word, 'start': i, 'end': i + .5} for i, word in enumerate(words)]}


class AccuracyTests(unittest.TestCase):
    def test_wrong_missing_and_extra_words_are_measured(self):
        reference = fixture(['hello', 'quiet', 'world'], True)
        analysis = fixture(['hello', 'bright', 'world', 'again'])
        result = measure(analysis, reference)
        self.assertEqual((result['substitutions'], result['insertions'], result['deletions']), (1, 1, 0))
        self.assertAlmostEqual(result['wordErrorRate'], 2 / 3)
        empty = measure(fixture([]), reference)
        self.assertEqual(empty['deletions'], 3)
        self.assertEqual(empty['wordErrorRate'], 1)
        self.assertIsNone(empty['p95MatchedStartErrorSeconds'])

    def test_correct_words_with_late_endings_do_not_pass_timing(self):
        reference = fixture(['Hello!', 'world'], True)
        analysis = fixture(['hello', 'world'])
        analysis['words'][1]['end'] += .4
        result = measure(analysis, reference)
        self.assertEqual(result['wordErrorRate'], 0)
        self.assertEqual(result['matchedWordsWithinTolerance'], 1)
        self.assertEqual(result['referenceWordsCorrectAndTimedFraction'], .5)
        self.assertAlmostEqual(result['p95MatchedEndErrorSeconds'], .4)

    def test_no_self_scoring_wrong_recording_or_wrong_excerpt(self):
        analysis = fixture(['hello'])
        with self.assertRaisesRegex(ValueError, 'human-verified'):
            measure(analysis, analysis)
        for change in [{'sourceSha256': 'b' * 64}, {'excerptStart': 1}]:
            reference = {**fixture(['hello'], True), **change}
            with self.assertRaises(ValueError): measure(analysis, reference)

    def test_invalid_reference_timings_are_rejected(self):
        reference = fixture(['hello'], True)
        reference['words'][0]['end'] = float('nan')
        with self.assertRaises(ValueError): measure(fixture(['hello']), reference)

    def test_human_confirmed_instrumental_counts_false_captions(self):
        result = measure(fixture(['Music']), fixture([], True))
        self.assertEqual(result['falsePositiveWordsOnInstrumental'], 1)
        self.assertIsNone(result['wordErrorRate'])
        self.assertEqual(result['insertions'], 1)

    def test_repeated_words_use_the_closest_timing_when_text_alignment_is_tied(self):
        result = measure(fixture(['go']), fixture(['go', 'go'], True))
        self.assertEqual(result['deletions'], 1)
        self.assertEqual(result['matchedWordsWithinTolerance'], 1)
        self.assertEqual(result['medianMatchedStartErrorSeconds'], 0)


if __name__ == '__main__': unittest.main()
