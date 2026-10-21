"""Index downloaded original images and labels, and build a local review gallery."""
from collections import Counter
from pathlib import Path
from statistics import mean, stdev
from PIL import Image
import csv
import html
import json
import os
import re

ROOT = Path(os.environ["LOCALAPPDATA"]) / "FaceIQ" / "datasets"
OUTPUT = Path(__file__).parent / "reference-library"


def image_record(path, view):
    with Image.open(path) as image:
        image.load()
        width, height = image.size
    return {"path": str(path.resolve()), "url": path.resolve().as_uri(), "view": view, "width": width, "height": height}


def main():
    OUTPUT.mkdir(exist_ok=True)
    records = []
    london = ROOT / "london"
    with (london / "archives/london_faces_ratings.csv").open(newline="", encoding="utf-8-sig") as file:
        responses = list(csv.DictReader(file))
    views = {"neutral_front": "front", "neutral_left_profile": "left_profile", "neutral_right_profile": "right_profile"}
    london_images = {}
    for folder, view in views.items():
        for path in (london / "images" / folder).rglob("*.jpg"):
            if path.name.startswith("._") or "__MACOSX" in path.parts:
                continue
            subject = path.stem.split("_")[0]
            london_images.setdefault(subject, []).append(image_record(path, view))
    with (london / "archives/london_faces_info.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            subject = row["face_id"]
            values = [float(r["X" + subject]) for r in responses if r.get("X" + subject, "") not in ("", "NA")]
            assert values and all(1 <= value <= 7 for value in values)
            records.append({"id": "london-" + subject, "dataset": "london", "source_subject_id": subject,
                "subject_identity_known_within_dataset": True, "age": int(row["face_age"]) if row["face_age"] else None,
                "source_gender": row["face_gender"], "images": london_images.get(subject, []),
                "source_rating": {"mean": mean(values), "sd": stdev(values), "count": len(values), "scale": [1, 7], "scope": "neutral_front_only"},
                "target_score_1_to_10": None, "quality_status": "priority_for_manual_review",
                "notes": "Standardised neutral photographs. Ratings apply to the frontal photo only; profiles have no separate ratings. Review exact yaw, hairline, ear canal, neck and Frankfort points. Capture distance/focal length not independently verified."})

    fei_files = {}
    for path in (ROOT / "fei/images").rglob("*.jpg"):
        match = re.fullmatch(r"(\d+)-(\d+)\.jpg", path.name, re.I)
        if match:
            fei_files.setdefault(match[1], {})[int(match[2])] = path
    for subject, files in sorted(fei_files.items(), key=lambda item: int(item[0])):
        images = [image_record(files[pose], view) for pose, view in [(11, "front"), (1, "endpoint_view_01"), (10, "endpoint_view_10")] if pose in files]
        records.append({"id": "fei-" + subject, "dataset": "fei", "source_subject_id": subject,
            "subject_identity_known_within_dataset": True, "images": images, "source_rating": None,
            "target_score_1_to_10": None, "quality_status": "pose_and_occlusion_review_required",
            "notes": "Original 640x480 photographs; pose 11 is the neutral frontal reference. Endpoint views 01 and 10 are profile candidates, not certified 90-degree views. Some hair, glasses and head turns fail the requested standard. No attractiveness labels supplied."})

    scut = ROOT / "scut-fbp5500/images/original/SCUT-FBP5500_v2"
    for line in (scut / "train_test_files/All_labels.txt").read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        name, score = line.split()
        score = float(score)
        assert 1 <= score <= 5
        path = scut / "Images" / name
        records.append({"id": "scut-" + path.stem, "dataset": "scut", "source_image_id": path.stem,
            "subject_identity_known_within_dataset": False, "images": [image_record(path, "front_crop")],
            "source_rating": {"mean": score, "scale": [1, 5], "count": 60, "scope": "front_crop_only"},
            "target_score_1_to_10": None, "quality_status": "frontal_rating_supplement_only",
            "notes": "Human-rated frontal crop with 86 source landmarks. Not a full front/profile measurement pair. Ears, neck or hairline may be missing; no standard camera distance guaranteed. Source image IDs are not verified unique identities."})

    for record in records:
        assert record["images"], record["id"]
        record["commercial_training_status"] = "copyright_licence_permissive_other_rights_review_needed" if record["dataset"] == "london" else "excluded_research_only_terms"
        record["commercial_training_cleared"] = False
    assert len({record["id"] for record in records}) == len(records)
    counts = Counter(record["dataset"] for record in records)
    image_counts = Counter()
    for record in records:
        image_counts[record["dataset"]] += len(record["images"])
    summary = {"retrieved_on": "2026-10-22", "root": str(ROOT), "records": len(records), "indexed_images": sum(image_counts.values()),
        "records_by_dataset": dict(counts), "indexed_images_by_dataset": dict(image_counts),
        "complete_london_triples": sum(r["dataset"] == "london" and len(r["images"]) == 3 for r in records),
        "fei_people_with_three_candidate_views": sum(r["dataset"] == "fei" and len(r["images"]) == 3 for r in records),
        "all_original_fei_images": sum(len(files) for files in fei_files.values()),
        "checks": "All indexed images decoded locally. View/identity pairing uses source filenames. No per-image landmark/pose validation or model training performed.",
        "target_scale": "Proposed 1-10 with average 5 and near-theoretical 10; no target labels assigned. Do not linearly rescale source maxima to 10.",
        "commercial_product_status": "No commercial training corpus cleared. FEI and SCUT excluded by current terms. London is CC BY 4.0, which permits commercial copyright reuse with attribution, but privacy/personality rights and the original consent need review for this specific product.",
        "commercial_training_cleared_records": 0,
        "research_only_records": counts["fei"] + counts["scut"],
        "sources": [
            {"name": "London", "url": "https://figshare.com/articles/dataset/Face_Research_Lab_London_Set/5047666", "licence": "CC BY 4.0", "citation": "DeBruine, Lisa; Jones, Benedict (2017). Face Research Lab London Set. doi:10.6084/m9.figshare.5047666"},
            {"name": "FEI", "url": "https://fei.edu.br/~cet/facedatabase.html", "licence": "Research only; no redistribution or reproduction"},
            {"name": "SCUT-FBP5500", "url": "https://github.com/HCIILAB/SCUT-FBP5500-Database-Release", "licence": "Non-commercial academic research only"}],
        "photo_standard": {"source": "https://www.faceiqlabs.com/support/photos", "requirements": ["Approximately 2m capture distance; eye-level camera", "Soft even lighting, no filters", "Neutral relaxed mouth and natural head posture", "Frontal: level direct view, visible hairline, ears and jaw", "Profile: true 90 degrees, visible ear canal, orbital rim, forehead, jaw and neck"], "status": "Criteria for review; not a claim that every downloaded image meets them"},
        "additional_sources_requiring_access": [
            {"name": "Chicago Face Database", "url": "https://www.chicagofaces.org/", "scope": "827 high-resolution standardised frontal identities with norms; no paired profiles", "status": "Not downloaded: official request form"},
            {"name": "Stirling/ESRC", "url": "https://pics.stir.ac.uk/ESRC/", "scope": "Neutral multi-view photographs, 1200x1200; 0,22,45,90 degrees; counts vary by set", "status": "Not downloaded: signed licence and obligation to offer derived data back to database"}]}
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with (OUTPUT / "manifest.jsonl").open("w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")
    data = json.dumps(records, ensure_ascii=False).replace("</", "<\\/")
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FaceIQ reference library</title>
<style>body{font:16px/1.5 system-ui;background:#f3f5f4;color:#172222;max-width:1500px;margin:32px auto;padding:0 24px}h1{line-height:1.15}a{color:#145b58}.lead{max-width:1100px}.notice{background:#e3eeeb;padding:14px 18px;border-radius:8px}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}select,input,button{font:inherit;padding:9px 12px;border:1px solid #b5c5c0;border-radius:6px;background:white}button{cursor:pointer}button:disabled{opacity:.4}#grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:20px}.card{background:white;border:1px solid #d4deda;border-radius:10px;padding:16px}.views{display:flex;gap:6px}.view{min-width:0;flex:1}.view img{width:100%;height:215px;object-fit:contain;background:#edf0ee}.view small{display:block;font-size:12px}.card h2{font-size:18px;margin:0 0 8px}.card p{font-size:13px;margin:8px 0}.rating{font-size:15px!important;font-weight:650}.badge{display:inline-block;font-size:12px;background:#edf1ef;padding:2px 6px;border-radius:4px}#page{align-self:center}footer{padding:28px 0;color:#455b55;font-size:14px}.muted{color:#455b55}</style>
<h1>FaceIQ reference library</h1><p class="lead">Original neutral frontal photographs, matched profile candidates, and published human ratings. Start with the London set for the clearest matched front/profile references.</p>
<p class="notice"><b>6,406 indexed images · 5,802 source records.</b> London: 102 people with front + left + right profile (306 photos). FEI: 200 people with three candidate views (600 indexed; all 2,800 originals downloaded). SCUT: 5,500 frontal crops. Every indexed image was decoded successfully. Individual capture/landmark suitability still needs review.</p>
<p class="lead"><b>Commercial product target:</b> FEI and SCUT are excluded from commercial training under their current research-only terms. London has a commercially permissive copyright licence (CC BY 4.0); product-specific privacy/personality rights and consent still need review. No records are marked commercially cleared. <a href="../reference-target.json">Looksmaxxing alignment and validation specification</a>.</p>
<p class="lead"><b>Ratings keep their original scales.</b> London ratings apply only to the frontal image (1–7); SCUT ratings use 1–5. FEI has no attractiveness labels. Profile photos have no independent rating labels. Your proposed 1–10 scale, with 5 average and 10 near-theoretical, has not been fitted.</p>
<div class="controls"><label>Source <select id="source"><option value="london">London · high-resolution matched views</option><option value="fei">FEI · pose candidates, review required</option><option value="scut">SCUT · frontal rating crops</option><option value="all">All sources</option></select></label><input id="search" type="search" aria-label="Find source ID" placeholder="Find source ID"><label>Order <select id="order"><option value="id">Source ID</option><option value="low">Source rating: low first</option><option value="high">Source rating: high first</option></select></label><button id="prev">Previous</button><span id="page" aria-live="polite"></span><button id="next">Next</button></div>
<p id="source-note" class="muted"></p><main id="grid"></main>
<footer><p><a href="manifest.jsonl">Machine-readable image/label manifest</a> · <a href="summary.json">Counts, source licences and photo criteria</a> · <a href="https://www.faceiqlabs.com/support/photos">FaceIQ Labs photo requirements</a></p><p>London: DeBruine &amp; Jones (2017), <a href="https://doi.org/10.6084/m9.figshare.5047666">Face Research Lab London Set</a>, CC BY 4.0. FEI: <a href="https://fei.edu.br/~cet/facedatabase.html">original source</a>, research only, no redistribution/reproduction. SCUT: Liang et al. (2018), <a href="https://github.com/HCIILAB/SCUT-FBP5500-Database-Release">SCUT-FBP5500</a>, non-commercial academic research only. Images stored locally outside the OneDrive project.</p></footer>
<script>const records=__DATA__;let current=0;const size=18;const $=id=>document.getElementById(id);const notes={london:'Priority set: 1350×1350 original photos. Human ratings are for the front photo only. Check ear canal, hairline, relaxed lips and exact head angle before geometry measurements.',fei:'Pose-evaluation supplement: 640×480 originals. Endpoint views are not certified as true 90° profiles; exclude wrong angles, glasses and obscured anatomy. No attractiveness ratings supplied.',scut:'Frontal-rating supplement: usually 350×350 crops. Many omit ears or neck, so these are not complete 71-measurement references. No side profiles. Image IDs do not establish unique people.',all:'Do not mix raw rating scales. Keep London and FEI views of each person together when splitting training and evaluation data; SCUT identity duplication needs separate review.'};
function render(){let rows=records.filter(r=>($('source').value==='all'||r.dataset===$('source').value)&&r.id.toLowerCase().includes($('search').value.toLowerCase()));const order=$('order').value;if(order!=='id')rows.sort((a,b)=>{const x=a.source_rating?.mean,y=b.source_rating?.mean;if(x==null)return y==null?0:1;if(y==null)return -1;return order==='low'?x-y:y-x});const pages=Math.max(1,Math.ceil(rows.length/size));current=Math.min(current,pages-1);$('grid').replaceChildren();for(const r of rows.slice(current*size,(current+1)*size)){const card=document.createElement('article');card.className='card';const heading=document.createElement('h2');heading.textContent=r.id;card.append(heading);const views=document.createElement('div');views.className='views';for(const im of r.images){const box=document.createElement('div');box.className='view';const a=document.createElement('a');a.href=im.url;a.target='_blank';a.rel='noopener';const img=document.createElement('img');img.src=im.url;img.loading='lazy';img.alt=r.id+' '+im.view;a.append(img);const caption=document.createElement('small');caption.textContent=im.view.replaceAll('_',' ')+' · '+im.width+'×'+im.height;box.append(a,caption);views.append(box)}card.append(views);const rating=document.createElement('p');rating.className='rating';rating.textContent=r.source_rating?'Front source mean '+r.source_rating.mean.toFixed(2)+' / '+r.source_rating.scale[1]+' · '+r.source_rating.count+' ratings':'No published attractiveness label';const status=document.createElement('span');status.className='badge';status.textContent=r.quality_status.replaceAll('_',' ');const note=document.createElement('p');note.textContent=r.notes;card.append(rating,status,note);$('grid').append(card)}$('page').textContent=(current+1)+' / '+pages+' · '+rows.length+' records';$('prev').disabled=current===0;$('next').disabled=current>=pages-1;$('source-note').textContent=notes[$('source').value]}
for(const id of ['source','search','order'])$(id).addEventListener(id==='search'?'input':'change',()=>{current=0;render()});$('prev').onclick=()=>{current--;render()};$('next').onclick=()=>{current++;render()};render();</script></html>'''
    page = page.replace("__DATA__", data)
    (OUTPUT / "index.html").write_text(page, encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
