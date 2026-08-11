#!/usr/bin/env bash
# Hits the live API for every demo command and saves each JSON response to
# src/assets/data/demo/{slug}.json for use in the auto-cycle demo.
# Run from the repo root: bash scripts/capture-demos.sh
# Requires: curl, jq (jq is used only for pretty-printing; remove if unavailable)

set -euo pipefail

API="${NSPE_API_BASE:-https://api.nspe.dev}"
OUT_DIR="src/assets/data/demo"
mkdir -p "$OUT_DIR"

run_query() {
  local slug="$1"
  local query="$2"
  # Strip leading "nspe " prefix so the backend receives the bare query
  local bare="${query#nspe }"
  echo "→ $query"
  curl -s -X POST "$API/run" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$bare\"}" \
    | (command -v jq &>/dev/null && jq '.' || cat) \
    > "$OUT_DIR/$slug.json"
  echo "   saved $OUT_DIR/$slug.json"
}

# ── NBA ──────────────────────────────────────────────────────────────────────
run_query "nba-1h-pts20-last2-5"      "nspe nba 1h -pts20 -last2/5"
run_query "nba-q1-tpm2-last3-5"       "nspe nba q1 -tpm2 -last3/5"
run_query "nba-pts-ast35-last2-5"     "nspe nba -pts+ast35 -last2/5"

# ── MLB ──────────────────────────────────────────────────────────────────────
run_query "mlb-hits-min20-last10"     "nspe mlb -hits min20 -last10"
run_query "mlb-tb2-last3-5"           "nspe mlb -tb2 -last3/5"

# ── NHL ──────────────────────────────────────────────────────────────────────
run_query "nhl-p1-pts1-streak3"       "nspe nhl p1 -pts1 -streak3"

# ── NFL explosive trend ───────────────────────────────────────────────────────
run_query "nfl-long-pass-yds50-last1-2"   "nspe nfl long pass -yds50 -last1/2"
run_query "nfl-long-rush-yds30-last2-5"   "nspe nfl long rush -yds30 -last2/5"

# ── NFL explosive compute ────────────────────────────────────────────────────
run_query "nfl-long-pass-min1000-season"  "nspe nfl long pass -yds min1000 -season"
run_query "nfl-long-rush-min500-season"   "nspe nfl long rush -yds min500 -season"

echo ""
echo "Done. $(ls "$OUT_DIR"/*.json | wc -l | tr -d ' ') files written to $OUT_DIR/"
