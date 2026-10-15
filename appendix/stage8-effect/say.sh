#!/bin/sh
# 発言を input/u<n>.txt に残して送る: say.sh <run> <n> <text|-> [card_id:option ...]
run=$1; n=$2; text=$3; shift 3
f=hearing/$run/input/u$n.txt
if [ "$text" = "-" ]; then msg=-; else printf '%s\n' "$text" > "$f"; msg=$f; fi
uv run --project ../../devex-api/backend python drive.py say "$run" "$msg" "$@" 2>&1 | grep -v " open *$"
