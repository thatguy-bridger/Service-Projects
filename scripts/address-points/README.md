# Address-point filtering scripts

Run these **locally**, on the machine where the downloaded statewide
address-point file actually lives (they never touch the network or this
app — pure local `jq` filtering).

Each one filters a statewide OpenAddresses.io export (newline-delimited
GeoJSON — one `{"type":"Feature",...}` object per line, their real
default distribution format) down to a single city, writing a much
smaller `<city>.geojson` file next to the input.

## Requirements

`jq` — `brew install jq` (Mac) or `apt install jq` (Linux).

## Usage

```bash
./filter-sandy.sh /path/to/statewide.geojson
./filter-draper.sh /path/to/statewide.geojson
./filter-white-city.sh /path/to/statewide.geojson
./filter-cottonwood-heights.sh /path/to/statewide.geojson
```

Each prints how many address points it found and where it wrote them.
Paste the resulting file's contents into `/admin/address-points` (each
with its own source label) — it auto-detects the newline-delimited
GeoJSON format, no conversion needed.

## Before the first run

Confirm the real city-name spelling in your specific export — city
names aren't perfectly standardized, and "White City" in particular is
an unincorporated community that may not appear under that exact name:

```bash
jq -r '.properties.city' /path/to/statewide.geojson | sort -u | grep -i "sandy\|draper\|white\|cottonwood"
```

If a name doesn't match exactly what a script hardcodes, edit that
script's `CITY=` line to match what actually shows up.
