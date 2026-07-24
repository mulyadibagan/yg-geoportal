import https from "node:https";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "data", "village-forest-analytics.json");
const API = "https://production-api.globalforestwatch.org/viirs-active-fires";
const MAX_WORKERS = Number(process.env.VIIRS_MAX_WORKERS || 8);

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthRange(anchorDate, monthsAgo) {
  const yearShift = Math.floor((anchorDate.getUTCMonth() - monthsAgo) / 12);
  const monthIndex = (anchorDate.getUTCMonth() - monthsAgo + 1200) % 12;
  const year = anchorDate.getUTCFullYear() + yearShift;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const nextMonth = monthIndex === 11
    ? new Date(Date.UTC(year + 1, 0, 1))
    : new Date(Date.UTC(year, monthIndex + 1, 1));
  const end = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
  if (end > anchorDate) {
    return [start, anchorDate];
  }
  return [start, end];
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "YG-GeoPortal/1.0"
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${body.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
          }
        });
      }
    );
    request.setTimeout(90000, () => request.destroy(new Error("Request timeout")));
    request.on("error", reject);
  });
}

async function countPeriod(geostoreId, startDate, endDate) {
  const query = new URLSearchParams({
    geostore: geostoreId,
    period: `${toIsoDate(startDate)},${toIsoDate(endDate)}`
  });
  const payload = await requestJson(`${API}?${query.toString()}`);
  const value = payload?.data?.attributes?.value;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

async function countRecord(record, anchorDate) {
  const geostoreId = record?.geostoreId;
  if (!geostoreId) {
    throw new Error("Missing geostoreId");
  }

  const hotspot7d = await countPeriod(geostoreId, new Date(anchorDate.getTime() - 6 * 86400000), anchorDate);
  const hotspot30d = await countPeriod(geostoreId, new Date(anchorDate.getTime() - 29 * 86400000), anchorDate);
  const hotspot90d = await countPeriod(geostoreId, new Date(anchorDate.getTime() - 89 * 86400000), anchorDate);

  const hotspotMonthly12m = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const [startDate, endDate] = monthRange(anchorDate, offset);
    const count = await countPeriod(geostoreId, startDate, endDate);
    hotspotMonthly12m.push({
      month: `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`,
      count
    });
  }

  const hotspotYearly5y = [];
  const currentYear = anchorDate.getUTCFullYear();
  for (let year = currentYear - 4; year <= currentYear; year += 1) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = year === currentYear
      ? anchorDate
      : new Date(Date.UTC(year, 11, 31));
    const count = await countPeriod(geostoreId, startDate, endDate);
    hotspotYearly5y.push({ year: String(year), count });
  }

  return {
    hotspot7d,
    hotspot30d,
    hotspot90d,
    hotspotMonthly12m,
    hotspotYearly5y
  };
}

async function runPool(tasks, maxWorkers) {
  const workers = Array.from({ length: Math.max(1, maxWorkers) }, async () => {
    while (tasks.length) {
      const task = tasks.shift();
      if (!task) {
        return;
      }
      await task();
    }
  });
  await Promise.all(workers);
}

async function main() {
  const raw = await readFile(TARGET, "utf-8");
  const data = JSON.parse(raw);
  const jobs = [];
  for (const collection of ["villages", "socialForestry"]) {
    const entries = Object.entries(data?.[collection] || {});
    for (const [key, record] of entries) {
      jobs.push({ collection, key, record });
    }
  }

  const errors = [];
  const anchorDate = new Date();
  const total = jobs.length;
  let processed = 0;
  const tasks = jobs.map((job) => async () => {
    try {
      const metrics = await countRecord(job.record, anchorDate);
      Object.assign(data[job.collection][job.key], metrics);
    } catch (error) {
      errors.push({
        collection: job.collection,
        key: job.key,
        error: String(error?.message || error)
      });
    } finally {
      processed += 1;
      console.log(`${processed}/${total}`);
    }
  });

  await runPool(tasks, MAX_WORKERS);

  data.viirs = {
    source: "NASA FIRMS/VIIRS via Global Forest Watch",
    periodDays: [7, 30, 90],
    monthlyTrendMonths: 12,
    yearlyTrendYears: 5,
    updatedAt: new Date().toISOString(),
    errors
  };

  await writeFile(TARGET, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`Updated ${total - errors.length} records; errors=${errors.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
