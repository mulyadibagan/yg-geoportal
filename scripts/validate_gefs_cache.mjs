import fs from "node:fs/promises";

const path = process.argv[2] || "data/gefs-multilevel.json";
const cache = JSON.parse(await fs.readFile(path, "utf8"));
const levels = [925, 850, 700];
const requiredMetadata = ["schemaVersion", "generatedAt", "validFrom", "validUntil", "source", "underlyingModel", "attribution", "termsUrl", "gridCount", "memberCount"];

for (const field of requiredMetadata) if (cache[field] === undefined || cache[field] === null || cache[field] === "") throw new Error(`GEFS cache missing ${field}.`);
if (cache.schemaVersion !== 2) throw new Error(`Unsupported GEFS cache schemaVersion ${cache.schemaVersion}.`);
if (!/^https:\/\//.test(cache.termsUrl)) throw new Error("GEFS termsUrl must use HTTPS.");
if (!Array.isArray(cache.levels) || levels.some((level) => !cache.levels.includes(level))) throw new Error("GEFS cache does not declare all required pressure levels.");
if (!Array.isArray(cache.data) || cache.data.length !== cache.gridCount || cache.gridCount < 4) throw new Error("GEFS grid is empty or inconsistent.");

const generatedAt = Date.parse(cache.generatedAt), validFrom = Date.parse(cache.validFrom), validUntil = Date.parse(cache.validUntil);
if (![generatedAt, validFrom, validUntil].every(Number.isFinite) || validUntil <= validFrom) throw new Error("GEFS cache time metadata is invalid.");

let commonStart = -Infinity, commonEnd = Infinity, minimumMembers = Infinity;
for (const [index, row] of cache.data.entries()) {
  const hourly = row.hourly;
  if (!hourly || !Array.isArray(hourly.time) || hourly.time.length < 2) throw new Error(`GEFS row ${index} has no hourly time axis.`);
  const times = hourly.time.map((value) => new Date(`${value}+07:00`).getTime());
  if (!times.every(Number.isFinite) || times.some((time, i) => i && time <= times[i - 1])) throw new Error(`GEFS row ${index} has an invalid time axis.`);
  commonStart = Math.max(commonStart, times[0]);
  commonEnd = Math.min(commonEnd, times.at(-1));
  const speedKeys = Object.keys(hourly).filter((key) => /^wind_speed_925hPa(_member\d+)?$/.test(key));
  minimumMembers = Math.min(minimumMembers, speedKeys.length);
  for (const speedKey of speedKeys) {
    const suffix = speedKey.replace("wind_speed_925hPa", "");
    for (const level of levels) {
      for (const variable of [`wind_speed_${level}hPa${suffix}`, `wind_direction_${level}hPa${suffix}`]) {
        if (!Array.isArray(hourly[variable]) || hourly[variable].length !== times.length) throw new Error(`GEFS row ${index} has incomplete ${variable}.`);
        if (hourly[variable].some((value) => value !== null && !Number.isFinite(Number(value)))) throw new Error(`GEFS row ${index} has non-numeric ${variable}.`);
      }
    }
  }
}

if (minimumMembers !== cache.memberCount || minimumMembers < 2) throw new Error("GEFS member count is inconsistent.");
if (Math.abs(commonStart - validFrom) > 1000 || Math.abs(commonEnd - validUntil) > 1000) throw new Error("GEFS declared coverage does not match its rows.");
console.log(`Validated GEFS cache: ${cache.gridCount} grid locations, ${cache.memberCount} members, ${cache.validFrom} to ${cache.validUntil}.`);
