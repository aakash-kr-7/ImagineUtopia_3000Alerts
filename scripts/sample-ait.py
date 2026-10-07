"""Bounded-memory reservoir sampling. Public archive stays outside source control.

Usage: python scripts/sample-ait.py /path/to/ait_ads.zip /path/to/sample.json
The checksum is mandatory. Every sampled row retains its original archive member
and 1-based line number. No phase intervals are converted into attack labels.
"""
import hashlib
import json
import random
import sys
import zipfile
from pathlib import Path

archive = Path(sys.argv[1])
output = Path(sys.argv[2])
expected = '43db6b1f0996e0024befd617706c50e9'
md5, sha = hashlib.md5(), hashlib.sha256()
with archive.open('rb') as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        md5.update(chunk)
        sha.update(chunk)
if md5.hexdigest() != expected:
    raise SystemExit('Archive checksum differs from official AIT-ADS record')
files = []
with zipfile.ZipFile(archive) as z:
    for name in sorted(z.namelist()):
        generator = random.Random('utopia-ait-v2:' + name)
        limit = 375 if '_wazuh' in name else 50
        sample, count = [], 0
        content_sha = hashlib.sha256()
        with z.open(name) as stream:
            for count, line in enumerate(stream, 1):
                content_sha.update(line)
                if not line.strip():
                    continue
                if len(sample) < limit:
                    sample.append((count, json.loads(line)))
                else:
                    i = generator.randrange(count)
                    if i < limit:
                        sample[i] = (count, json.loads(line))
        files.append({'member': name, 'rows': count, 'sha256': content_sha.hexdigest(), 'records': [{'row': row, 'value': value} for row, value in sorted(sample)]})
        print(f'{name}: {count} source rows / {len(sample)} sampled', flush=True)
output.write_text(json.dumps({'archive_md5': md5.hexdigest(), 'archive_sha256': sha.hexdigest(), 'method': 'Independent uniform reservoir per archive member; 375 Wazuh / 50 AMiner; random seed string utopia-ait-v2:<member>', 'files': files}))
