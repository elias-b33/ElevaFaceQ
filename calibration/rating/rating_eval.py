"""Evaluate full ratings: distributions, human-rating agreement within sex, L/R reliability."""
import csv, json, statistics as st, sys
from collections import defaultdict
from pathlib import Path

import os
S = Path(os.environ["CALIBRATION_DIR"])
ratings = defaultdict(list)
for r in csv.DictReader(open(S / "london/archives/london_faces_ratings.csv", encoding="utf-8-sig")):
    for k, v in r.items():
        if k.startswith("X") and v not in ("", "NA"):
            ratings[k[1:]].append(float(v))
mr = {k: st.mean(v) for k, v in ratings.items()}
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
def rank(x):
    o = sorted(range(len(x)), key=x.__getitem__); r = [0.0] * len(x)
    for i, j in enumerate(o): r[j] = i
    return r
def sp(a, b): return st.correlation(rank(a), rank(b))
keys = ["overall", "harmony", "front", "sideH", "angularity", "dimorphism", "features"]
print(f"{'score':11s} {'n':>4s} {'mean':>6s} {'sd':>5s} {'min':>5s} {'max':>5s} | {'rhoM':>6s} {'rhoF':>6s} | {'L/R r':>6s}")
by = defaultdict(dict)
for r in rows: by[r["id"]][r["side"]] = r
for k in keys:
    v = [r[k] for r in rows if r[k] is not None]
    res = []
    for g in ["male", "female"]:
        # average L/R per person for agreement with ratings
        pr = [(st.mean([x[k] for x in p.values() if x[k] is not None]), mr[i]) for i, p in by.items() if list(p.values())[0]["gender"] == g and any(x[k] is not None for x in p.values())]
        res.append(sp([a for a, _ in pr], [b for _, b in pr]))
    lr = [(p["L"][k], p["R"][k]) for p in by.values() if "L" in p and "R" in p and p["L"][k] is not None and p["R"][k] is not None]
    rel = st.correlation([a for a, _ in lr], [b for _, b in lr]) if len(lr) > 3 else float("nan")
    print(f"{k:11s} {len(v):4d} {st.mean(v):6.2f} {st.pstdev(v):5.2f} {min(v):5.2f} {max(v):5.2f} | {res[0]:+6.2f} {res[1]:+6.2f} | {rel:6.2f}")
# item-level agreement
items = sorted({k for r in rows for k in r["items"]})
print("\nassessment items: rhoM rhoF")
for k in items:
    res = []
    for g in ["male", "female"]:
        pr = [(st.mean([x["items"][k] for x in p.values() if k in x["items"]]), mr[i]) for i, p in by.items() if list(p.values())[0]["gender"] == g and any(k in x["items"] for x in p.values())]
        res.append(sp([a for a, _ in pr], [b for _, b in pr]) if len(pr) > 5 else float("nan"))
    print(f"  {k:28s} {res[0]:+.2f} {res[1]:+.2f}")
print("\nexamples:")
for r in rows[:6]:
    print(r["id"], r["side"], r["gender"], "overall", r["overall"] and round(r["overall"], 2), "pot", r["potential"] and round(r["potential"], 2), "H", r["harmony"] and round(r["harmony"], 1), "A", r["angularity"] and round(r["angularity"], 1), "D", r["dimorphism"] and round(r["dimorphism"], 1), "F", r["features"] and round(r["features"], 1), "| human", round(mr[r["id"]], 2))
    print("    flaws:", r["flaws"], " strengths:", r["strengths"])
