#!/bin/sh
# Builds build/zotero-safe-edit-<version>.xpi from addon/, prints its SHA-256
# and writes it as update_hash into updates.json (the released file must be
# exactly this build).
set -e
cd "$(dirname "$0")"
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' addon/manifest.json | head -1)
mkdir -p build
xpi="build/zotero-safe-edit-$version.xpi"
rm -f "$xpi"
(cd addon && zip -qr "../$xpi" . -x '.*')
hash=$(shasum -a 256 "$xpi" | cut -d' ' -f1)
sed -i.bak "s/\"update_hash\": *\"[^\"]*\"/\"update_hash\": \"sha256:$hash\"/" updates.json
rm -f updates.json.bak
echo "$xpi"
echo "$hash"
