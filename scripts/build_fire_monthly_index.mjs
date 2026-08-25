import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "data", "fire-monthly");
const names = (await readdir(dir)).filter((name) => /^\d{4}-\d{2}\.json$/.test(name)).sort().reverse();
const reports = [];
for (const name of names) {
  const report = JSON.parse(await readFile(path.join(dir, name), "utf8"));
  if (!report?.month || !Number(report?.summary?.hotspots)) continue;
  reports.push({ month: report.month, status: report.status || "final", period: report.period, generatedAt: report.generatedAt, summary: report.summary, href: `fire-monthly-report.html?month=${report.month}`, data: `data/fire-monthly/${report.month}.json` });
}
await writeFile(path.join(dir, "index.json"), `${JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), latest: reports[0]?.month || null, retention: { rawArchiveMonths: 60, finalReports: "permanent" }, reports }, null, 2)}\n`, "utf8");
console.log(`Indexed ${reports.length} monthly fire report(s).`);
