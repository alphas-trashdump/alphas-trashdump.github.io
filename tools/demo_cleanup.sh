#!/usr/bin/env bash
# Remove the local-only preview entries added to demo the gallery.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f data/releases/santoni/_demo-gallery.json data/releases/santoni/_demo-deadshots.json
rm -rf res/shots/santoni/_demo-gallery
python3 tools/build_index.py
echo "demo entries removed"
