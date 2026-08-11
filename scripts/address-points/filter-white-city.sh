#!/usr/bin/env bash
# Filters a statewide OpenAddresses.io export (newline-delimited GeoJSON,
# one Feature per line) down to just White City, UT -- run this locally
# where the big file actually lives; nothing here talks to the network or
# the app. Requires jq (brew install jq / apt install jq).
#
# White City is an unincorporated community, not its own municipality --
# it may not appear under this exact name in the source data (it's
# sometimes folded into "SANDY" or another neighboring city's records).
# Before running, confirm the real spelling:
#   jq -r '.properties.city' statewide.geojson | sort -u | grep -i "sandy\|draper\|white\|cottonwood"
# and adjust CITY below to match whatever actually shows up.
set -euo pipefail

INPUT="${1:?Usage: ./filter-white-city.sh /path/to/statewide.geojson}"
CITY="WHITE CITY"
OUTPUT="$(dirname "$INPUT")/white-city.geojson"

jq -c --arg city "$CITY" 'select(.properties.city == $city)' "$INPUT" > "$OUTPUT"

echo "Wrote $(wc -l < "$OUTPUT" | tr -d ' ') address points to $OUTPUT"
