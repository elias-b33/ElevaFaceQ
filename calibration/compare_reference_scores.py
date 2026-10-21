"""Compare authorised reference reports with independent candidate scores.

JSONL rows: {"id":"...", "subject_id":"...", "reference":{"overall":6.1},
             "candidate":{"overall":6.0}}
Optional shared metrics: harmony, angularity, dimorphism, features.
Use independent held-out people and identical input photos/settings. This tool
reads local reports only; it does not access FaceIQ Labs or generate labels.
"""
import argparse
import json
import math
from pathlib import Path
from statistics import correlation, mean, median


def ranks(values):
    result = [0.0] * len(values)
    order = sorted(range(len(values)), key=values.__getitem__)
    i = 0
    while i < len(order):
        end = i + 1
        while end < len(order) and values[order[end]] == values[order[i]]:
            end += 1
        for index in order[i:end]:
            result[index] = (i + end - 1) / 2
        i = end
    return result


def compare(rows):
    ids = [row["id"] for row in rows]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate report IDs")
    if any(not row.get("subject_id") for row in rows):
        raise ValueError("Every report needs subject_id to audit independent-person counts")
    result = {"reports": len(rows), "people": len({row["subject_id"] for row in rows}), "metrics": {},
              "interpretation": "Agreement with supplied reference outputs; not proof of objective attractiveness accuracy. Subject-level train/test independence must be verified separately."}
    for metric in ["overall", "harmony", "angularity", "dimorphism", "features"]:
        pairs = [(row["reference"][metric], row["candidate"][metric]) for row in rows
                 if row.get("reference", {}).get(metric) is not None and row.get("candidate", {}).get(metric) is not None]
        if not pairs:
            continue
        if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) or not 0 <= x <= 10 for pair in pairs for x in pair):
            raise ValueError("Scores must be finite numbers between 0 and 10")
        errors = sorted(abs(a - b) for a, b in pairs)
        reference, candidate = map(list, zip(*pairs))
        rho = correlation(ranks(reference), ranks(candidate)) if len(pairs) >= 2 and len(set(reference)) > 1 and len(set(candidate)) > 1 else None
        result["metrics"][metric] = {"n": len(pairs), "MAE": mean(errors), "RMSE": math.sqrt(mean(e * e for e in errors)),
            "median_abs_error": median(errors), "P90_abs_error_nearest_rank": errors[math.ceil(.9 * len(errors)) - 1], "spearman": rho}
    if not result["metrics"]:
        raise ValueError("No paired reference/candidate scores supplied")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reports", type=Path)
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.reports.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    print(json.dumps(compare(rows), indent=2, allow_nan=False))
