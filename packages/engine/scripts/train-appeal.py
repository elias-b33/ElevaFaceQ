"""
Fits the facial-appeal head (src/rating/appeal.json).

A ridge regression maps a CLIP ViT-B/16 image embedding of the face crop to
the mean human attractiveness rating of SCUT-FBP5500 (Liang et al. 2018;
non-commercial research use only). The prediction is then standardised per
gender against the Face Research Lab London Set, so 0 is an average adult.

Usage: python3 train-appeal.py <work dir> <out.json>
Expects in <work dir>: scut-meta.json, emb-clip16-scut.f32, emb-clip16-london.f32,
london-ids.json (subject id per London row), london-gender.json, geometry.json
(per-subject mean overall score from the geometric rating).
"""
import json, sys
import numpy as np

W, OUT = sys.argv[1], sys.argv[2]
LAMBDA, BLEND = 300.0, 0.8
meta = json.load(open(f"{W}/scut-meta.json"))
X = np.fromfile(f"{W}/emb-clip16-scut.f32", dtype=np.float32).reshape(len(meta), -1).astype(np.float64)
X /= np.linalg.norm(X, axis=1, keepdims=True)
y = np.array([m["score"] for m in meta])
mu, sd = X.mean(0), X.std(0) + 1e-8
Z = (X - mu) / sd
w = np.linalg.solve(Z.T @ Z + LAMBDA * np.eye(Z.shape[1]), Z.T @ (y - y.mean()))
# Fold the standardisation into the weights: raw = unit_embedding . coef + bias.
coef = w / sd; bias = float(y.mean() - (mu / sd) @ w)
L = np.fromfile(f"{W}/emb-clip16-london.f32", dtype=np.float32).reshape(-1, X.shape[1]).astype(np.float64)
L /= np.linalg.norm(L, axis=1, keepdims=True)
raw = L @ coef + bias
gender = json.load(open(f"{W}/london-gender.json")); geo = np.array(json.load(open(f"{W}/geometry.json")))
from statistics import NormalDist
def z_from_score(s):  # inverse of the rating scale (engine/rating/scale.ts anchors)
    A = [(0, 5), (0.566, 6), (1.02, 6.5), (1.593, 7), (2.128, 7.5), (2.652, 8), (3.353, 8.5), (3.891, 9), (4.265, 9.5), (5, 10)]
    sign = 1 if s >= 5 else -1; t = 5 + abs(s - 5)
    for (z0, s0), (z1, s1) in zip(A, A[1:]):
        if t <= s1: return sign * (z0 + (z1 - z0) * (t - s0) / (s1 - s0))
    return sign * 5
cal = {}
for g in ["male", "female"]:
    m = np.array([x == g for x in gender])
    mean, std = float(raw[m].mean()), float(raw[m].std())
    zl = (raw[m] - mean) / std; zg = np.array([z_from_score(s) for s in geo[m]])
    blend_sd = float((BLEND * zl + (1 - BLEND) * zg).std())
    cal[g] = {"mean": round(mean, 6), "sd": round(std, 6), "blendSd": round(blend_sd, 6)}
json.dump({
    "version": "appeal-1",
    "model": "Xenova/clip-vit-base-patch16@342fdf2f67aded64d138ff074745fb4a5d2bba5f onnx/vision_model_quantized.onnx",
    "training": "Ridge regression (lambda 300) on SCUT-FBP5500 mean ratings, 5,500 faces, 60 raters each. Non-commercial research use only.",
    "calibration": "Per-gender mean/SD of predictions on the Face Research Lab London Set (102 adults, CC BY 4.0)",
    "blend": BLEND, "bias": round(bias, 8), "coef": [round(float(c), 8) for c in coef], "gender": cal,
}, open(OUT, "w"), separators=(",", ":"))
print("bias", bias, cal)
