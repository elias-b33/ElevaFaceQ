"""Fetch original research face sets locally; never manufacture attractiveness labels.

Standard-library downloader. Images stay outside the OneDrive project by default.
The official source licences still apply. No models or remote code are executed.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen
import argparse
import hashlib
import json
import os
import shutil
import time
import zipfile


def download(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return destination
    partial = destination.with_suffix(destination.suffix + ".partial")
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0 FaceIQ-local-research"})
            with urlopen(request, timeout=60) as response, partial.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            if destination.suffix == ".zip" and not zipfile.is_zipfile(partial):
                raise ValueError("Source did not return a ZIP archive (possibly access-gated)")
            partial.replace(destination)
            return destination
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def unpack(archive, destination):
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with zipfile.ZipFile(archive) as source:
        for item in source.infolist():
            target = (destination / item.filename).resolve()
            if not target.is_relative_to(root):
                raise ValueError("Unsafe archive path")
        source.extractall(destination)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(os.environ["LOCALAPPDATA"]) / "FaceIQ" / "datasets")
    args = parser.parse_args()
    root = args.root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    article_url = "https://api.figshare.com/v2/articles/5047666"
    with urlopen(article_url, timeout=30) as response:
        article = json.load(response)
    london = root / "london"
    london.mkdir(exist_ok=True)
    (london / "source_metadata.json").write_text(json.dumps(article, indent=2), encoding="utf-8")
    jobs = []
    wanted = {"neutral_front.zip", "neutral_left_profile.zip", "neutral_right_profile.zip", "london_faces_info.csv", "london_faces_ratings.csv", "facelab_london.pdf"}
    for entry in article["files"]:
        if entry["name"] in wanted:
            jobs.append(("london", entry["download_url"], london / "archives" / entry["name"]))
    for part in range(1, 5):
        name = f"originalimages_part{part}.zip"
        jobs.append(("fei", "https://fei.edu.br/~cet/" + name, root / "fei" / "archives" / name))
    jobs.append(("fei", "https://fei.edu.br/~cet/facedatabase.html", root / "fei" / "source.html"))
    jobs.append(("fei", "https://fei.edu.br/~cet/examples_variations.jpg", root / "fei" / "source_pose_examples.jpg"))
    jobs.append(("scut", "https://drive.usercontent.google.com/download?id=1w0TorBfTIqbquQVd6k3h_77ypnrvfGwf&export=download&confirm=t", root / "scut-fbp5500" / "archives" / "SCUT-FBP5500.zip"))
    jobs.append(("scut", "https://raw.githubusercontent.com/HCIILAB/SCUT-FBP5500-Database-Release/master/README.md", root / "scut-fbp5500" / "SOURCE_README.md"))
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(download, url, path): (group, url, path) for group, url, path in jobs}
        for future in as_completed(futures):
            group, url, path = futures[future]
            record = {"dataset": group, "url": url, "file": str(path)}
            try:
                future.result()
                record.update(status="downloaded", bytes=path.stat().st_size, sha256=hashlib.file_digest(path.open("rb"), "sha256").hexdigest())
                print(f"Downloaded {group}: {path.name} ({path.stat().st_size / 1e6:.1f} MB)", flush=True)
                if path.suffix == ".zip":
                    unpack(path, path.parent.parent / "images" / (path.stem if group == "london" else "original"))
                record["extracted"] = path.suffix == ".zip"
            except Exception as error:
                record.update(status="failed", error=str(error))
                print(f"Unavailable {group}: {path.name}: {error}", flush=True)
            results.append(record)
            (root / "downloads.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({"root": str(root), "completed": sum(r["status"] == "downloaded" for r in results), "failed": sum(r["status"] == "failed" for r in results)}), flush=True)


if __name__ == "__main__":
    main()
