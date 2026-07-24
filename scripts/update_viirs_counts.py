import concurrent.futures
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "village-forest-analytics.json"
API = "https://production-api.globalforestwatch.org/viirs-active-fires"


def month_range(anchor_date: dt.date, months_ago: int):
    year = anchor_date.year
    month = anchor_date.month - months_ago
    while month <= 0:
        month += 12
        year -= 1
    start = dt.date(year, month, 1)
    if month == 12:
        next_month = dt.date(year + 1, 1, 1)
    else:
        next_month = dt.date(year, month + 1, 1)
    end = next_month - dt.timedelta(days=1)
    if end > anchor_date:
        end = anchor_date
    return start, end


def count_period(geostore_id: str, start: dt.date, end: dt.date):
    query = urllib.parse.urlencode(
        {
            "geostore": geostore_id,
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


def count(record):
    geostore_id = record["geostoreId"]
    end = dt.date.today()
    metrics = {
        "hotspot7d": count_period(geostore_id, end - dt.timedelta(days=6), end),
        "hotspot30d": count_period(geostore_id, end - dt.timedelta(days=29), end),
        "hotspot90d": count_period(geostore_id, end - dt.timedelta(days=89), end),
    }
    monthly = []
    for offset in range(11, -1, -1):
        start, month_end = month_range(end, offset)
        monthly.append(
            {
                "month": start.strftime("%Y-%m"),
                "count": count_period(geostore_id, start, month_end),
            }
        )
    metrics["hotspotMonthly12m"] = monthly
    return metrics


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
                result = future.result()
                data[collection][key]["hotspot7d"] = result["hotspot7d"]
                data[collection][key]["hotspot30d"] = result["hotspot30d"]
                data[collection][key]["hotspot90d"] = result["hotspot90d"]
                data[collection][key]["hotspotMonthly12m"] = result["hotspotMonthly12m"]
            except Exception as error:
                errors.append({"collection": collection, "key": key, "error": str(error)})
            print(f"{index}/{len(jobs)}", flush=True)
    data["viirs"] = {
        "source": "NASA FIRMS/VIIRS via Global Forest Watch",
        "periodDays": [7, 30, 90],
        "monthlyTrendMonths": 12,
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "errors": errors,
    }
    TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(jobs) - len(errors)} records; errors={len(errors)}")


if __name__ == "__main__":
    main()
