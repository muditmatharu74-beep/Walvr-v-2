"""Score private analysis against a human-checked reference for the same excerpt.

Print aggregate errors only. Never treat an ASR output as its own ground truth.
"""
import argparse
import json
import math
import re
import statistics
import unicodedata


def normalized(word):
    return ''.join(c for c in unicodedata.normalize('NFKC', word).casefold() if c.isalnum())


def valid_words(words):
    if not isinstance(words, list) or len(words) > 5000:
        raise ValueError('Provide at most 5000 word timings')
    previous = -1
    for word in words:
        if (not isinstance(word, dict) or not isinstance(word.get('word'), str) or
                not normalized(word['word']) or
                any(isinstance(word.get(k), bool) or not isinstance(word.get(k), (int, float)) or
                    not math.isfinite(word[k]) for k in ('start', 'end')) or
                word['start'] < 0 or word['end'] <= word['start'] or word['start'] < previous):
            raise ValueError('Reference and analysis need valid ordered word timings')
        previous = word['start']


def measure(analysis, reference, tolerance=.15):
    if not reference.get('humanVerified') is True:
        raise ValueError('Use a human-verified reference, not another model output')
    if (not re.fullmatch('[a-f0-9]{64}', str(reference.get('sourceSha256', ''))) or
            analysis.get('sourceSha256') != reference['sourceSha256']):
        raise ValueError('Reference and analysis must match the same original audio')
    for key in ('songDuration', 'excerptStart', 'excerptDuration'):
        values = [analysis.get(key), reference.get(key)]
        if (any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values)
                or abs(values[0] - values[1]) > .05):
            raise ValueError('Reference and analysis must cover the same audio interval')
    for result in (analysis, reference):
        if (result['songDuration'] <= 0 or result['excerptStart'] < 0 or result['excerptDuration'] <= 0
                or result['excerptStart'] + result['excerptDuration'] > result['songDuration'] + .05):
            raise ValueError('Invalid audio interval')
    if not math.isfinite(tolerance) or tolerance < 0:
        raise ValueError('Timing tolerance must be finite and nonnegative')
    valid_words(analysis.get('words'))
    valid_words(reference.get('words'))
    truth, hypothesis = reference['words'], analysis['words']
    for result in (analysis, reference):
        end = result['excerptStart'] + result['excerptDuration']
        if any(w['start'] < result['excerptStart'] or w['end'] > end + .05 for w in result['words']):
            raise ValueError('Word timings fall outside the scored excerpt')
    a, b = [normalized(w['word']) for w in truth], [normalized(w['word']) for w in hypothesis]
    # Two cost rows plus byte-sized backpointers keep long-song scoring bounded.
    parents = [bytearray([1] * (len(b) + 1))]
    previous = [(j, 0.0) for j in range(len(b) + 1)]
    for i in range(1, len(a) + 1):
        row, parent = [(i, 0.0)], bytearray(len(b) + 1)
        parent[0] = 2
        for j in range(1, len(b) + 1):
            same = a[i - 1] == b[j - 1]
            # Resolve equally good text alignments using timing for repeated lyrics.
            timing = (abs(truth[i - 1]['start'] - hypothesis[j - 1]['start']) +
                      abs(truth[i - 1]['end'] - hypothesis[j - 1]['end'])) if same else 0
            diagonal = (previous[j - 1][0] + (not same), previous[j - 1][1] + timing)
            deletion = (previous[j][0] + 1, previous[j][1])
            insertion = (row[j - 1][0] + 1, row[j - 1][1])
            best = min(diagonal, deletion, insertion)
            parent[j] = (0 if a[i - 1] == b[j - 1] else 3) if best == diagonal else (2 if best == deletion else 1)
            row.append(best)
        parents.append(parent)
        previous = row
    i, j = len(a), len(b)
    counts = {'substitutions': 0, 'deletions': 0, 'insertions': 0}
    matches = []
    while i or j:
        action = parents[i][j]
        if action == 0:
            matches.append((i - 1, j - 1)); i -= 1; j -= 1
        elif action == 3:
            counts['substitutions'] += 1; i -= 1; j -= 1
        elif action == 2:
            counts['deletions'] += 1; i -= 1
        else:
            counts['insertions'] += 1; j -= 1
    starts = [abs(truth[i]['start'] - hypothesis[j]['start']) for i, j in matches]
    ends = [abs(truth[i]['end'] - hypothesis[j]['end']) for i, j in matches]
    within = sum(s <= tolerance and e <= tolerance for s, e in zip(starts, ends))
    p95 = lambda values: sorted(values)[math.ceil(len(values) * .95) - 1] if values else None
    return {**counts, 'referenceWords': len(a), 'recognizedWords': len(b),
            'wordErrorRate': sum(counts.values()) / len(a) if a else None, 'matchedWords': len(matches),
            'falsePositiveWordsOnInstrumental': len(b) if not a else None,
            'timingToleranceSeconds': tolerance, 'matchedWordsWithinTolerance': within,
            'referenceWordsCorrectAndTimedFraction': within / len(a) if a else None,
            'medianMatchedStartErrorSeconds': statistics.median(starts) if starts else None,
            'p95MatchedStartErrorSeconds': p95(starts), 'p95MatchedEndErrorSeconds': p95(ends)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('analysis')
    parser.add_argument('reference')
    parser.add_argument('--tolerance-ms', type=float, default=150)
    args = parser.parse_args()
    with open(args.analysis) as f: analysis = json.load(f)
    with open(args.reference) as f: reference = json.load(f)
    print(json.dumps(measure(analysis, reference, args.tolerance_ms / 1000), indent=2))
