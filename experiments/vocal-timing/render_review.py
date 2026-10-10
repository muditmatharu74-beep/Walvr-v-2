"""Private timing review clip using ffmpeg/libass, not the production composition."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


def ass_time(seconds):
    total = max(0, round(seconds * 100))
    return f'{total // 360000}:{total // 6000 % 60:02}:{total // 100 % 60:02}.{total % 100:02}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio', type=Path)
    parser.add_argument('analysis', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--start', type=float, default=10)
    parser.add_argument('--seconds', type=float, default=30)
    args = parser.parse_args()
    import math
    if not math.isfinite(args.start) or args.start < 0 or not math.isfinite(args.seconds) or args.seconds <= 0:
        parser.error('Invalid review interval')
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[2]):
        parser.error('Keep private clips outside the repository')
    data = json.loads(args.analysis.read_text())
    if data['sourceSha256'] != hashlib.sha256(args.audio.read_bytes()).hexdigest():
        parser.error('Analysis does not match source audio')
    if args.start < data['excerptStart'] or args.start + args.seconds > data['excerptStart'] + data['excerptDuration'] + .05:
        parser.error('Review interval is outside analyzed audio')
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Word,DejaVu Sans,72,&H00FFFF00,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,5,100,100,0,1
Style: Label,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,8,70,70,100,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
'''
    lines = [f'Dialogue: 0,0:00:00.00,{ass_time(args.seconds)},Label,,0,0,0,,EXPERIMENTAL TIMING REVIEW\\NOriginal audio / separated-vocal alignment']
    count = 0
    for word in data['words']:
        start, end = max(0, word['start'] - args.start), min(args.seconds, word['end'] - args.start)
        if start >= end:
            continue
        text = word['word'].replace('\\', '').replace('{', '').replace('}', '').replace('\n', ' ')
        lines.append(f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Word,,0,0,0,,{text}')
        count += 1
    if not count:
        parser.error('No words in review interval')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='walvr-review-') as work:
        Path(work, 'captions.ass').write_text(header + '\n'.join(lines))
        temporary = Path(work, 'review.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-f', 'lavfi', '-i',
            f'color=c=0x100713:s=1080x1920:r=30:d={args.seconds}', '-ss', str(args.start), '-i',
            str(args.audio), '-t', str(args.seconds), '-vf', 'ass=captions.ass', '-map', '0:v', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-threads', '2',
            '-c:a', 'aac', '-movflags', '+faststart', str(temporary)], cwd=work, check=True)
        import shutil
        shutil.copyfile(temporary, args.output)
    print(json.dumps({'reviewClip': True, 'seconds': args.seconds, 'words': count}))


if __name__ == '__main__':
    main()
