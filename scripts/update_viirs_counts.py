import concurrent.futures
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "village-forest-analytics.json"
API = "https://production-api.globalforestwatch.org/viirs-active-fires"


def count(record):
    end = dt.date.today()
    start = end - dt.timedelta(days=6)
    query = urllib.parse.urlencode(
        {
            "geostore": record["geostoreId"],
            "period": f"{start.isoformat()},{end.isoformat()}",
        }
    )
    request = urllib.request.Request(
        f"{API}?{query}",
        headers={"Accept": "application/json", "User-Agent": "YG-GeoPortal/1.0"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        result = json.loads(response.read().decode("utf-8"))
    return int(result["data"]["attributes"].get("value") or 0)


def main():
    data = json.loads(TARGET.read_text(encoding="utf-8"))
    jobs = []
    for collection in ("villages", "socialForestry"):
        for key, record in data.get(collection, {}).items():
            jobs.append((collection, key, record))
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(count, record): (collection, key) for collection, key, record in jobs}
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            collection, key = futures[future]
            try:
                data[collection][key]["hotspot7d"] = future.result()
            except Exception as error:
                errors.append({"collection": collection, "key": key, "error": str(error)})
            print(f"{index}/{len(jobs)}", flush=True)
    data["viirs"] = {
        "source": "NASA FIRMS/VIIRS via Global Forest Watch",
        "periodDays": 7,
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "errors": errors,
    }
    TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(jobs) - len(errors)} records; errors={len(errors)}")


if __name__ == "__main__":
    main()
