import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def slug(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def key(row):
    return "|".join(slug(row.get(field, "")) for field in ("regency", "district", "village"))


intervention = load("coastal-change-annual.json")
regional = load("coastal-change-non-intervention-annual.json")
intervention_geo = load("coastal-change-annual.geojson")
regional_geo = load("coastal-change-non-intervention-annual.geojson")

villages = {}
for row in regional.get("villages", []):
    item = dict(row)
    item["id"] = slug(f'{item.get("regency", "")}-{item.get("district", "")}-{item.get("village", "")}')
    item["intervention"] = False
    item["programmeStatus"] = "regional"
    villages[key(item)] = item

for row in intervention.get("villages", []):
    item = dict(row)
    item["id"] = slug(f'{item.get("regency", "")}-{item.get("district", "")}-{item.get("village", "")}')
    item["intervention"] = True
    item["programmeStatus"] = "intervention-yg"
    villages[key(item)] = item

rows = sorted(villages.values(), key=lambda r: (r.get("regency", ""), r.get("district", ""), r.get("village", "")))
by_key = {key(row): row for row in rows}

regencies = defaultdict(lambda: {
    "checked": 0, "analysed": 0, "notCoastal": 0, "intervention": 0,
    "nonIntervention": 0, "erosionAreaHa": 0.0, "accretionAreaHa": 0.0
})
for row in rows:
    stats = regencies[row["regency"]]
    stats["checked"] += 1
    stats["analysed" if row.get("status") == "analysed" else "notCoastal"] += 1
    stats["intervention" if row["intervention"] else "nonIntervention"] += 1
    stats["erosionAreaHa"] += float(row.get("erosionAreaHa", 0) or 0)
    stats["accretionAreaHa"] += float(row.get("accretionAreaHa", 0) or 0)

regency_rows = []
for name, stats in sorted(regencies.items()):
    stats["erosionAreaHa"] = round(stats["erosionAreaHa"], 2)
    stats["accretionAreaHa"] = round(stats["accretionAreaHa"], 2)
    regency_rows.append({"regency": name, **stats})

summary = {
    "schemaVersion": "1.0",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "product": "Analisis pesisir regional inklusif",
    "baseline": regional.get("baseline", "2016"),
    "current": regional.get("current", "2025"),
    "updateFrequency": "annual",
    "totals": {
        "checked": len(rows),
        "analysed": sum(row.get("status") == "analysed" for row in rows),
        "notCoastal": sum(row.get("status") != "analysed" for row in rows),
        "intervention": sum(bool(row["intervention"]) for row in rows),
        "nonIntervention": sum(not row["intervention"] for row in rows),
        "regencies": len(regency_rows),
    },
    "regencies": regency_rows,
    "villages": rows,
    "disclaimer": "Indikasi berbasis komposit Sentinel-2; bukan survei garis pantai atau penetapan abrasi.",
    "source": regional.get("source", intervention.get("source", "Copernicus Sentinel-2")),
}

features = []
for collection, is_intervention in ((regional_geo, False), (intervention_geo, True)):
    for feature in collection.get("features", []):
        props = dict(feature.get("properties", {}))
        row = by_key.get(key(props))
        if not row:
            continue
        props.update({
            "id": row["id"],
            "intervention": is_intervention,
            "programmeStatus": "intervention-yg" if is_intervention else "regional",
        })
        features.append({"type": "Feature", "properties": props, "geometry": feature.get("geometry")})

geojson = {"type": "FeatureCollection", "metadata": summary["totals"], "features": features}
(DATA / "coastal-analysis-regional.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
(DATA / "coastal-analysis-regional.geojson").write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print(json.dumps({"totals": summary["totals"], "features": len(features), "regencies": regency_rows}, ensure_ascii=False, indent=2))
