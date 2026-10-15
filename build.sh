#!/bin/sh
# Builds build/zotero-safe-edit-<version>.xpi from addon/ and prints its SHA-256
# (needed for update_hash in updates.json).
set -e
cd "$(dirname "$0")"
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' addon/manifest.json | head -1)
mkdir -p build
xpi="build/zotero-safe-edit-$version.xpi"
rm -f "$xpi"
(cd addon && zip -qr "../$xpi" . -x '.*')
echo "$xpi"
shasum -a 256 "$xpi" | cut -d' ' -f1
