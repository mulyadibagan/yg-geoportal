#!/usr/bin/env python3
"""Build the public Liberica morphology dataset from Azrul's Appendix 1."""

import argparse
import json
import math
import shutil
from collections import Counter
from pathlib import Path

import pdfplumber
from PIL import Image


COLUMNS = [
    ("population_raw", 80, 125), ("plant_shape", 125, 168),
    ("height_cm", 168, 200), ("leaf_tip", 200, 260),
    ("leaf_shape", 260, 320), ("leaf_colour", 320, 360),
    ("leaf_length_cm", 360, 400), ("leaf_width_cm", 400, 430),
    ("fruit_diameter_mm", 430, 465), ("fruit_shape", 465, 525),
    ("fruit_colour", 525, 585), ("fresh_100_fruit_g", 585, 625),
    ("seed_length_mm", 625, 655), ("seed_width_mm", 655, 685),
    ("seed_shape", 685, 735), ("seed_thickness_mm", 735, 765),
    ("dry_100_seed_g", 765, 820),
]

POPULATIONS = {
    "KB1": {"name": "Kembung Baru 1", "village": "Kembung Baru", "district": "Bantan", "lat": 1.444833, "lon": 102.438500, "dms": "1°26'41.4\"N 102°26'18.6\"E"},
    "KB2": {"name": "Kembung Baru 2", "village": "Kembung Baru", "district": "Bantan", "lat": 1.444750, "lon": 102.438944, "dms": "1°26'41.1\"N 102°26'20.2\"E"},
    "BT": {"name": "Bantan Tengah", "village": "Bantan Tengah", "district": "Bantan", "lat": 1.512250, "lon": 102.303361, "dms": "1°30'44.1\"N 102°18'12.1\"E"},
    "PN": {"name": "Pasiran", "village": "Pasiran", "district": "Bantan", "lat": 1.537333, "lon": 102.180111, "dms": "1°32'14.4\"N 102°10'48.4\"E"},
    "PK1": {"name": "Pedekik 1", "village": "Pedekik", "district": "Bengkalis", "lat": 1.512472, "lon": 102.110361, "dms": "1°30'44.9\"N 102°06'37.3\"E"},
    "PK2": {"name": "Pedekik 2", "village": "Pedekik", "district": "Bengkalis", "lat": 1.513500, "lon": 102.110639, "dms": "1°30'48.6\"N 102°06'38.3\"E"},
}


def source_image_numbers(sequence):
    """Return plant/leaf image numbers in visual row order.

    PDF image objects are stored bottom-to-top within each table page. Pages
    34 and 49 contain two samples; pages 35-48 contain four samples each.
    """
    if sequence <= 2:
        first_sample, last_sample, first_image = 1, 2, 15
    elif sequence <= 58:
        page_index = (sequence - 3) // 4
        first_sample = 3 + page_index * 4
        last_sample = first_sample + 3
        first_image = 19 + page_index * 8
    else:
        first_sample, last_sample, first_image = 59, 60, 131
    reversed_offset = last_sample - sequence
    plant = first_image + reversed_offset * 2
    return plant, plant + 1


def number(value):
    value = value.replace(",", ".").strip()
    return float(value) if "." in value else int(value)


def words_in_band(words, lo, hi, x0, x1):
    found = [w for w in words if lo <= float(w["top"]) < hi and x0 <= float(w["x0"]) < x1]
    found.sort(key=lambda w: (round(float(w["top"]), 1), float(w["x0"])))
    return " ".join(w["text"] for w in found).strip()


def clean_text(value):
    return " ".join(value.replace("Elips2", "Elips").split())


def parse_appendix(pdf_path):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number in range(85, 91):
            words = pdf.pages[page_number - 1].extract_words()
            anchors = []
            sequence_words = [w for w in words if 80 <= float(w["x0"]) < 125 and w["text"].isdigit() and 1 <= int(w["text"]) <= 60]
            for shape in words:
                if 125 <= float(shape["x0"]) < 168 and shape["text"] in {"Silinder", "Kerucut", "Elips2"} and float(shape["top"]) > 190:
                    y = float(shape["top"])
                    nearby = min(sequence_words, key=lambda w: abs(float(w["top"]) - y), default=None)
                    if nearby is not None and abs(float(nearby["top"]) - y) < 15:
                        anchors.append((y, int(nearby["text"])))
            anchors.sort()
            for i, (y, sequence) in enumerate(anchors):
                prev_y = anchors[i - 1][0] if i else y - 25
                next_y = anchors[i + 1][0] if i + 1 < len(anchors) else y + 25
                lo, hi = (prev_y + y) / 2, (y + next_y) / 2
                fields = {name: clean_text(words_in_band(words, lo, hi, x0, x1)) for name, x0, x1 in COLUMNS}
                raw = fields.pop("population_raw").split()[0]
                population = {"PD1": "PK1", "PD2": "PK2"}.get(raw, raw)
                row = {"observation_id": f"LIB-2026-{sequence:03d}", "sample_number": sequence, "population_code": population}
                numeric = {"height_cm", "leaf_length_cm", "leaf_width_cm", "fruit_diameter_mm", "fresh_100_fruit_g", "seed_length_mm", "seed_width_mm", "seed_thickness_mm", "dry_100_seed_g"}
                for key, value in fields.items():
                    row[key] = number(value) if key in numeric else clean_text(value)
                photo_no, leaf_photo_no = source_image_numbers(sequence)
                row["photos"] = [
                    {"slot": "plant", "src": f"assets/liberica-research/observations/{sequence:03d}-plant.png", "temporary": True, "observation_id": row["observation_id"]},
                    {"slot": "leaf", "src": f"assets/liberica-research/observations/{sequence:03d}-leaf.png", "temporary": True, "observation_id": row["observation_id"]},
                ]
                row["_source_image_numbers"] = [photo_no, leaf_photo_no]
                rows.append(row)
    rows.sort(key=lambda r: r["sample_number"])
    if [r["sample_number"] for r in rows] != list(range(1, 61)):
        raise ValueError(f"Appendix extraction did not produce samples 1-60: {[r['sample_number'] for r in rows]}")
    return rows


def stats(rows):
    numeric = ["height_cm", "leaf_length_cm", "leaf_width_cm", "fruit_diameter_mm", "fresh_100_fruit_g", "seed_length_mm", "seed_width_mm", "seed_thickness_mm", "dry_100_seed_g"]
    out = {"numeric": {}, "categorical": {}}
    for key in numeric:
        vals = [float(r[key]) for r in rows]
        out["numeric"][key] = {"min": min(vals), "max": max(vals), "mean": round(sum(vals) / len(vals), 2)}
    for key in ["plant_shape", "leaf_tip", "leaf_shape", "leaf_colour", "fruit_shape", "fruit_colour", "seed_shape"]:
        counts = Counter(r[key] for r in rows)
        out["categorical"][key] = [{"value": value, "count": count, "percent": round(count * 100 / len(rows), 2)} for value, count in counts.most_common()]
    return out


def copy_photos(rows, extracted_dir, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    for row in rows:
        for item, image_no in zip(row["photos"], row.pop("_source_image_numbers")):
            source = extracted_dir / f"img-{image_no:03d}.png"
            target = output_dir / Path(item["src"]).name
            if not source.exists():
                raise FileNotFoundError(source)
            with Image.open(source) as image:
                corrected = image.transpose(Image.Transpose.ROTATE_90) if item["slot"] == "plant" and image.width > image.height else image.copy()
                corrected.save(target, format="PNG", optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/liberica-morphology-2026.json"))
    parser.add_argument("--photo-output", type=Path, default=Path("assets/liberica-research/observations"))
    args = parser.parse_args()
    rows = parse_appendix(args.pdf)
    copy_photos(rows, args.images, args.photo_output)
    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "azrul-liberica-morphology-bengkalis-2026",
        "status": "Research Dataset — Morphological Characterization, 2026",
        "title": "Karakterisasi Morfologi Tanaman Kopi Liberika Lokal pada Beberapa Lahan Gambut di Pulau Bengkalis",
        "species": {"common_name": "Kopi Liberika", "scientific_name": "Coffea liberica", "family": "Rubiaceae"},
        "scope_note": "Observasi penelitian; bukan data penanaman atau restorasi program Yayasan Gambut.",
        "coordinate_note": "Koordinat mewakili lokasi/populasi penelitian. Titik yang sama tidak ditafsirkan sebagai posisi presisi setiap pohon.",
        "method": {"period": "Februari–Maret 2026", "approach": "Survei lapangan dengan purposive sampling", "descriptor": "UPOV (2008)", "sample_size": 60, "population_count": 6},
        "source": {"authors": "Azrul, M. Amrul Khoiri & Joni Irawan", "institution": "Fakultas Pertanian Universitas Riau", "year": 2026, "document": "Laporan Azrul_2206135664 final.pdf"},
        "populations": [{"code": code, **meta, "sample_count": 10, "coordinate_precision": "population"} for code, meta in POPULATIONS.items()],
        "statistics": stats(rows),
        "variability": {
            "broad": ["height_cm", "leaf_length_cm", "fresh_100_fruit_g", "dry_100_seed_g"],
            "note": "Klasifikasi luas/sempit mengikuti analisis variabilitas fenotipik laporan; statistik ringkas di halaman dihitung ulang dari 60 individu pada Lampiran 1."
        },
        "similarity": {"method": "Analisis kemiripan SPSS 26", "result_note": "Dendrogram menunjukkan pengelompokan morfologi antarsampel; gunakan hasil ini sebagai eksplorasi fenotipik, bukan identitas varietas final."},
        "observations": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
