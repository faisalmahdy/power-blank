#!/bin/bash
set -eu
cd /workspace
if curl -sf -o /dev/null http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >/tmp/powerblank-dev.log 2>&1 &
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null http://127.0.0.1:8080/; then
    exit 0
  fi
  sleep 0.4
done
exit 0
