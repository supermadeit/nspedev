#!/usr/bin/env bash
# NFL query examples for frontend querybuilder integration.
# Demonstrates explosive plays (PBP) and standard aggregated stats.
# Output written to data/output/nfl_results.json for temporary frontend reference.

OUT=data/output/nfl_results.json
rm -f $OUT

# Initialize JSON array
echo "[" > $OUT

FIRST=1

run_query() {
    local desc="$1"; shift
    local cmd="$@"
    
    # Add comma before all entries except the first
    if [ $FIRST -eq 0 ]; then
        echo "," >> $OUT
    fi
    FIRST=0
    
    echo "  {" >> $OUT
    echo "    \"description\": \"$desc\"," >> $OUT
    echo "    \"query\": \"$cmd\"," >> $OUT
    echo "    \"result\": " >> $OUT
    
    # Run the command and capture output, escape for JSON string
    local result=$($cmd 2>&1)
    if [ $? -eq 0 ] && [ -n "$result" ]; then
        # Escape quotes and backslashes for JSON
        result=$(echo "$result" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')
        echo "    \"$result\"" >> $OUT
    else
        echo "    null" >> $OUT
    fi
    
    echo "  }" >> $OUT
}

echo "Running NFL queries for frontend integration..."

# ===== EXPLOSIVE PLAYS (PBP DATA) =====
# These use "long pass", "long rush", "long rec" syntax

run_query "QBs with 30+ yard pass plays in 2 of last 5 games" \
    nspe nfl long pass -yds30 -last2/5

run_query "QBs with 50+ yard pass plays in 3 of last 10 games" \
    nspe nfl long pass -yds50 -last3/10

run_query "RBs with 20+ yard rush plays in 2 of last 5 games" \
    nspe nfl long rush -yds20 -last2/5

run_query "RBs with 40+ yard rush plays in last 3 of 10 games" \
    nspe nfl long rush -yds40 -last3/10

run_query "Players with 40+ yard reception plays in 3 of last 5 games" \
    nspe nfl long rec -yds40 -last3/5

run_query "Players with 60+ yard reception plays in 2 of last 10 games" \
    nspe nfl long rec -yds60 -last2/10

# Explosive play leaderboards
run_query "QBs ranked by total 30+ yard pass plays (season)" \
    nspe nfl long pass -yds30 -leaderboard

run_query "QBs ranked by total 50+ yard pass plays in last 5 games" \
    nspe nfl long pass -yds50 -leaderboard -last5

run_query "RBs ranked by total 20+ yard rush plays (season)" \
    nspe nfl long rush -yds20 -leaderboard

run_query "Players ranked by total 40+ yard reception plays (season)" \
    nspe nfl long rec -yds40 -leaderboard

run_query "Players ranked by total 50+ yard receptions in last 10 games" \
    nspe nfl long rec -yds50 -leaderboard -last10

# ===== STANDARD AGGREGATED STATS (TREND QUERIES) =====
# These use per-game yard thresholds: pass/rush/rec -ydsN -lastN/N

run_query "QBs with 250+ passing yards in 3 of last 5 games" \
    nspe nfl pass -yds250 -last3/5

run_query "QBs with 300+ passing yards in 2 of last 5 games" \
    nspe nfl pass -yds300 -last2/5

run_query "RBs with 100+ rushing yards in 3 of last 5 games" \
    nspe nfl rush -yds100 -last3/5

run_query "RBs with 150+ rushing yards in 2 of last 10 games" \
    nspe nfl rush -yds150 -last2/10

run_query "WRs with 100+ receiving yards in 3 of last 5 games" \
    nspe nfl rec -yds100 -last3/5

run_query "Players with 120+ receiving yards in 4 of last 10 games" \
    nspe nfl rec -yds120 -last4/10

# Min/Max aggregated queries (total yards across games)
run_query "QBs with at least 1000 total passing yards in last 5 games" \
    nspe nfl pass -yds min1000 -last5

run_query "RBs with at least 400 total rushing yards in last 5 games" \
    nspe nfl rush -yds min400 -last5

run_query "WRs with at least 500 total receiving yards in last 10 games" \
    nspe nfl rec -yds min500 -last10

run_query "QBs with passing yards between 800 and 1200 in last 5 games" \
    nspe nfl pass -yds min800 max1200 -last5

# Season totals
run_query "QBs with at least 3000 passing yards on the season" \
    nspe nfl pass -yds min3000 -season

run_query "RBs with at least 800 rushing yards on the season" \
    nspe nfl rush -yds min800 -season

run_query "WRs with at least 1000 receiving yards on the season" \
    nspe nfl rec -yds min1000 -season

# Touchdown queries (trend format)
run_query "RBs with 2+ rushing TDs in 3 of last 5 games" \
    nspe nfl rush_td -yds2 -last3/5

run_query "QBs with 3+ passing TDs in 2 of last 5 games" \
    nspe nfl pass_td -yds3 -last2/5

run_query "Players with 2+ receiving TDs in 2 of last 10 games" \
    nspe nfl rec_td -yds2 -last2/10

run_query "QBs with at least 20 passing TDs on the season" \
    nspe nfl pass_td -yds min20 -season

run_query "RBs with at least 10 rushing TDs on the season" \
    nspe nfl rush_td -yds min10 -season

# ===== COMBINED/ADVANCED QUERIES =====

run_query "Elite QBs: 300+ pass yards in 4 of last 10 games" \
    nspe nfl pass -yds300 -last4/10

run_query "Elite RBs: 120+ rush yards in 3 of last 5 games" \
    nspe nfl rush -yds120 -last3/5

run_query "Deep threats: 60+ yard receptions in 2 of last 10 games" \
    nspe nfl long rec -yds60 -last2/10

run_query "Big play QBs: 40+ yard passes in 3 of last 5 games" \
    nspe nfl long pass -yds40 -last3/5

# Close the JSON array
echo "" >> $OUT
echo "]" >> $OUT

echo ""
echo "✓ NFL queries complete!"
echo "Results written to: $OUT"
echo ""
echo "This file contains query examples and their JSON responses for frontend integration."
echo "Each entry shows the query description, command, and result format."
