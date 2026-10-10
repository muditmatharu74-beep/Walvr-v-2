import unittest
from pipeline import checked_words

class TimelineTests(unittest.TestCase):
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

if __name__ == '__main__':
    unittest.main()
