# Rating calibration

The rating's population constants live in
`packages/engine/src/rating/calibration.json`. They are fitted by running this
app's own vision models, automatic landmarks and image measurements over
reference photographs, so the calibration matches what a visitor's browser
computes.

The shipped constants come from the **Face Research Lab London Set**
(DeBruine & Jones 2017, [CC BY 4.0](https://figshare.com/articles/dataset/Face_Research_Lab_London_Set/5047666)):
102 adults (53 men, 49 women), each with a neutral front photo and left and
right profiles. Photographs are never committed to this repository; only the
fitted means and spreads are.

## Reproduce

Requirements beyond the workspace: Node 24, Python 3, `playwright` with a
Chromium build, and `jpeg-js` installed in the working folder.

```sh
export CALIBRATION_DIR=/path/to/work        # outside this repository
cd "$CALIBRATION_DIR" && npm init -y && npm install playwright jpeg-js
# 1. Download neutral_front.zip, neutral_left_profile.zip, neutral_right_profile.zip,
#    london_faces_info.csv and london_faces_ratings.csv from the figshare record above.
#    Unzip the photos under $CALIBRATION_DIR/london/images/ and the CSVs under
#    $CALIBRATION_DIR/london/archives/.
# 2. Prepare the app's model files once (from the repository root).
pnpm setup:assets
# 3. Serve the harness and cache every photo's model outputs.
node calibration/rating/server.mjs &
(cd "$CALIBRATION_DIR/london" && find images -name '*.jpg' | grep -v MACOSX | sed 's#^#london/#') > "$CALIBRATION_DIR/list.txt"
node calibration/rating/extract.mjs "$CALIBRATION_DIR/list.txt"
# 4. Build one JSON line per person with the engine's automatic landmarks and photo features.
packages/engine/node_modules/.bin/tsx calibration/rating/build-inputs.ts "$CALIBRATION_DIR/rating-inputs.jsonl"
# 5. Fit the constants and evaluate against the published human ratings.
pnpm --filter @freeharmony/engine calibrate:rating "$CALIBRATION_DIR/rating-inputs.jsonl" "Face Research Lab London Set (DeBruine & Jones 2017, CC BY 4.0)"
packages/engine/node_modules/.bin/tsx calibration/rating/eval-rating.ts "$CALIBRATION_DIR/rating-inputs.jsonl" "$CALIBRATION_DIR/eval.jsonl"
python3 calibration/rating/rating_eval.py "$CALIBRATION_DIR/eval.jsonl"
```

`rating_eval.py` reports each score's distribution, its Spearman correlation
with the mean human attractiveness rating within each sex, and the agreement
between a person's left- and right-profile analyses.

## What the numbers mean

Agreement is measured on the same people the constants were fitted to, and
some ideal ranges were nudged toward what this population rated as more
attractive, so the correlations are optimistic. The London ratings are of the
front photograph only. A larger, independent and more diverse reference set
would give a fairer estimate and better-calibrated ranges.
