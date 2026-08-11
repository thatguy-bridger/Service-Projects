#!/usr/bin/env bash
# Filters a statewide OpenAddresses.io export (newline-delimited GeoJSON,
# one Feature per line) down to just Sandy, UT -- run this locally where
# the big file actually lives; nothing here talks to the network or the
# app. Requires jq (brew install jq / apt install jq).
#
# Before running any of these four scripts for the first time, confirm
# the real city-name spelling in your file:
#   jq -r '.properties.city' statewide.geojson | sort -u | grep -i "sandy\|draper\|white\|cottonwood"
# and adjust the CITY value below if it doesn't say exactly "SANDY".
set -euo pipefail

INPUT="${1:?Usage: ./filter-sandy.sh /path/to/statewide.geojson}"
CITY="SANDY"
OUTPUT="$(dirname "$INPUT")/sandy.geojson"

jq -c --arg city "$CITY" 'select(.properties.city == $city)' "$INPUT" > "$OUTPUT"

echo "Wrote $(wc -l < "$OUTPUT" | tr -d ' ') address points to $OUTPUT"
