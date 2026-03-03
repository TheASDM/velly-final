#!/usr/bin/env python3
"""
Step 0 — Filter 5etools JSON files to XPHB, XDMG, XMM entries only.
Outputs to campaign-data/5e-filtered/
"""

import json
import sys
from pathlib import Path

ROOT      = Path(__file__).parent
RULES_DIR = ROOT / "campaign-data" / "rules"
OUT_DIR   = ROOT / "campaign-data" / "5e-filtered"

TARGET = {"XPHB", "XDMG", "XMM"}
SKIP_KEYS = {"_meta", "$schema"}


def filter_file(path: Path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    out   = {}
    stats = {}   # array_key -> (kept, dropped)

    for key, value in data.items():
        if key in SKIP_KEYS:
            out[key] = value
            continue
        if not isinstance(value, list):
            out[key] = value
            continue

        kept, dropped = [], 0
        for entry in value:
            if isinstance(entry, dict) and entry.get("source") in TARGET:
                kept.append(entry)
            else:
                dropped += 1

        stats[key] = (len(kept), dropped)
        if kept:
            out[key] = kept

    return out, stats


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(RULES_DIR.glob("*.json"))

    total_kept = total_dropped = files_written = 0

    col = 42
    print(f"\n{'File':<{col}} {'Array':<22} {'Kept':>6}  {'Dropped':>8}")
    print("─" * (col + 42))

    for path in files:
        try:
            out, stats = filter_file(path)
        except Exception as exc:
            print(f"  ERROR {path.name}: {exc}", file=sys.stderr)
            continue

        if not stats:
            continue

        # only write if at least one array has content
        has_content = any(
            isinstance(v, list) and v
            for k, v in out.items()
            if k not in SKIP_KEYS
        )

        for arr_key, (kept, dropped) in stats.items():
            total_kept    += kept
            total_dropped += dropped
            if kept or dropped:
                print(f"  {path.name:<{col}} {arr_key:<22} {kept:>6}  {dropped:>8}")

        if has_content:
            dest = OUT_DIR / path.name
            with open(dest, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
            files_written += 1

    print("─" * (col + 42))
    print(f"\n  Kept: {total_kept:,}   Dropped: {total_dropped:,}")
    print(f"  Files written to {OUT_DIR.relative_to(ROOT)}: {files_written}\n")


if __name__ == "__main__":
    main()
