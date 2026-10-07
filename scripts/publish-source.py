"""Portable source-push fallback when the Sites helper is not installed.
Credentials are read once from stdin, held in process memory, and never saved.
"""
import base64
import json
import os
import subprocess
import sys
import tarfile
import termios
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if sys.stdin.isatty():
    tty_state = termios.tcgetattr(sys.stdin.fileno())
    tty_state[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, tty_state)
print("Ready for source credential JSON on stdin (input is hidden).", flush=True)
credential = json.loads(sys.stdin.readline())

def run(args, env=None):
    result = subprocess.run(args, cwd=root, env=env, capture_output=True, text=True)
    if result.returncode:
        # Never include stderr from authenticated Git commands in public output.
        raise RuntimeError("Source preparation failed for command: " + args[0])
    return result.stdout.strip()

if not (root / '.git').exists():
    run(['git', 'init', '-b', credential['branch']])
run(['git','config','user.name','Imagine Utopia'])
run(['git','config','user.email','team239@example.invalid'])
run(['git','add','.'])
if run(['git','status','--porcelain']):
    run(['git','commit','-m','Engineer Utopia SOC v2 simulation, report ingestion, benchmark lab and public workspaces'])
if run(['git','remote']):
    run(['git','remote','set-url','origin',credential['remote_url']])
else:
    run(['git','remote','add','origin',credential['remote_url']])
environment = os.environ.copy()
environment.update({'GIT_CONFIG_COUNT':'1','GIT_CONFIG_KEY_0':'http.extraHeader',
                    'GIT_CONFIG_VALUE_0':'Authorization: Bearer '+credential['token'],
                    'GIT_TERMINAL_PROMPT':'0'})
run(['git','push','origin','HEAD:'+credential['branch']], env=environment)
commit = run(['git','rev-parse','HEAD'])
remote = run(['git','ls-remote','origin','refs/heads/'+credential['branch']], env=environment)
if not remote.startswith(commit):
    raise RuntimeError('Source SHA did not match remote')
archive = root.parent / 'utopia-deploy.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for path in ['.openai/hosting.json','dist/server','dist/client','drizzle']:
        tar.add(root / path, arcname=path)
with tarfile.open(archive) as tar:
    names=tar.getnames()
    if '.openai/hosting.json' not in names or 'dist/server/index.js' not in names:
        raise RuntimeError('Deployment archive incomplete')
print(json.dumps({'project_id':json.loads((root/'.openai/hosting.json').read_text())['project_id'],
                  'checkout_path':str(root),'commit_sha':commit,'archive':str(archive)}), flush=True)
