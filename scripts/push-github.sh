#!/usr/bin/env bash
# Push the reviewed source commit with the caller's own authenticated GitHub CLI.
# Tokens never enter a URL, file, command argument or log.
set -euo pipefail
cd "$(dirname "$0")/.."
repository='aakash-kr-7/ImagineUtopia_3000Alerts'
remote_url="https://github.com/${repository}.git"
if ! gh auth status >/dev/null 2>&1; then
  printf '%s\n' 'GitHub write authentication is unavailable. Authenticate GitHub CLI for the repository, then rerun this script.' >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Commit the reviewed source first. The push must identify an exact clean source state.' >&2
  exit 1
fi
gh auth setup-git
if git remote get-url github >/dev/null 2>&1; then
  if [ "$(git remote get-url github)" != "$remote_url" ]; then
    printf '%s\n' 'The github remote points to another repository; refusing to replace it.' >&2
    exit 1
  fi
else
  git remote add github "$remote_url"
fi
git push github HEAD:main
source_commit="$(git rev-parse HEAD)"
remote_commit="$(git ls-remote github refs/heads/main | cut -f1)"
[ "$source_commit" = "$remote_commit" ] || { printf '%s\n' 'Remote commit verification failed.' >&2; exit 1; }
printf 'Verified GitHub main at %s\n' "$source_commit"
