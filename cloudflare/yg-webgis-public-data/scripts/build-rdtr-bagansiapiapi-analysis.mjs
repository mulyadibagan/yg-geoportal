import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  area,
  bbox,
  featureCollection,
  intersect,
  simplify,
  union
} from "@turf/turf";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const TARGET_VILLAGES = new Set([
  "bagan barat",
  "bagan hulu",
  "bagan kota",
  "bagan punak",
  "bagan timur",
  "bagan jawa",
  "bagan jawa pesisir",
  "bagan punak meranti",
  "bagan punak pesisir",
  "labuhan tangga besar",
  "labuhan tangga hilir"
]);

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} tidak dapat dibaca: ${error.message}`);
  }
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(kelurahan|kepenghuluan|desa)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function boxesOverlap(left, right) {
  return left[0] <= right[2] && left[2] >= right[0] &&
    left[1] <= right[3] && left[3] >= right[1];
}

function safeIntersection(left, right, warnings, label) {
  try {
    return intersect(featureCollection([left, right]));
  } catch (error) {
    warnings.add(`${label}: ${error.message}`);
    return null;
  }
}

function areaHa(feature) {
  return feature ? area(feature) / 10000 : 0;
}

function round(value, digits = 2) {
  const power = 10 ** digits;
  return Math.round((Number(value) || 0) * power) / power;
}

function clippedFeatures(features, mask, pickProperties, warnings, label) {
  const maskBox = bbox(mask);
  const clipped = [];
  for (const feature of features || []) {
    if (!feature?.geometry || !boxesOverlap(maskBox, bbox(feature))) continue;
    const overlap = safeIntersection(feature, mask, warnings, label);
    if (!overlap || areaHa(overlap) < 0.01) continue;
    const display = simplify(overlap, {
      tolerance: 0.00002,
      highQuality: false,
      mutate: false
    });
    display.properties = pickProperties(feature.properties || {});
    clipped.push(display);
  }
  return clipped;
}

function coverageByClass(village, features, className, warnings, label) {
  const villageBox = bbox(village);
  const totals = new Map();
  for (const feature of features || []) {
    if (!feature?.geometry || !boxesOverlap(villageBox, bbox(feature))) continue;
    const overlap = safeIntersection(feature, village, warnings, label);
    const hectares = areaHa(overlap);
    if (hectares < 0.01) continue;
    const key = String(className(feature.properties || {}) || "Tidak terklasifikasi").trim();
    totals.set(key, (totals.get(key) || 0) + hectares);
  }
  return [...totals.entries()]
    .map(([name, hectares]) => ({ name, areaHa: round(hectares) }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

function recommendationRows(metrics) {
  const rows = [
    {
      theme: "Konsistensi tata ruang",
      priority: "tinggi",
      recommendation:
        "Bandingkan setiap zona RDTR dengan arahan RTRW Provinsi Riau dan RTRW Kabupaten Rokan Hilir; setiap perbedaan wajib diberi justifikasi skala, data, dan dasar hukum."
    },
    {
      theme: "Risiko pesisir dan sungai",
      priority: "tinggi",
      recommendation:
        "Tetapkan sempadan pantai, muara, Sungai Rokan, dan anak sungai berdasarkan garis pasang tertinggi serta kajian rob, banjir, abrasi, dan keselamatan masyarakat."
    }
  ];
  if (metrics.peatAreaHa > 0.1) rows.push({
    theme: "Ekosistem gambut",
    priority: metrics.peatCoveragePct >= 20 ? "kritis" : "tinggi",
    recommendation:
      "Hindari peningkatan intensitas pemanfaatan pada gambut sebelum fungsi ekosistem, kedalaman, hidrologi, subsidensi, dan kerentanan kebakaran diverifikasi dalam KLHS."
  });
  if (metrics.forestAreaHa > 0.1) rows.push({
    theme: "Kawasan hutan",
    priority: "tinggi",
    recommendation:
      "Selaraskan zonasi dengan fungsi kawasan hutan dan kewenangan kehutanan; jangan menganggap perubahan pola ruang otomatis mengubah status kawasan hutan."
  });
  if (metrics.mangrove && metrics.mangrove.status === "analysed") rows.push({
    theme: "Mangrove dan perlindungan pantai",
    priority: metrics.mangrove.indicativeMangroveLossHa > 25 ? "kritis" : "tinggi",
    recommendation:
      "Pertahankan tutupan mangrove tersisa, lindungi konektivitas pasang-surut, dan tempatkan kandidat pemulihan sebagai arahan perlindungan/pemulihan setelah verifikasi hidrodinamika dan tenurial."
  });
  rows.push({
    theme: "Partisipasi dan bukti",
    priority: "tinggi",
    recommendation:
      "Cantumkan sumber, tahun, skala, keterbatasan data, serta tanggapan terhadap masukan masyarakat untuk setiap keputusan zonasi yang berdampak besar."
  });
  return rows;
}

export function buildAnalysis({ rtrw, administration, peat, forest, mangrove }) {
  const warnings = new Set();
  const villages = (administration.features || []).filter(feature => {
    const props = feature.properties || {};
    return normalize(props.WADMKK) === "rokan hilir" &&
      normalize(props.WADMKC) === "bangko" &&
      TARGET_VILLAGES.has(normalize(props.WADMKD || props.NAMOBJ));
  });
  const villageNames = new Set(villages.map(feature => normalize(
    feature.properties?.WADMKD || feature.properties?.NAMOBJ
  )));
  if (villages.length !== TARGET_VILLAGES.size || villageNames.size !== TARGET_VILLAGES.size) {
    throw new Error(
      `Batas wilayah studi tidak lengkap: ditemukan ${villages.length} fitur / ${villageNames.size} nama; ` +
      `diharapkan ${TARGET_VILLAGES.size}.`
    );
  }

  const studyArea = union(featureCollection(villages));
  studyArea.properties = {
    name: "Kawasan Perkotaan Bagansiapiapi",
    district: "Bangko",
    regency: "Rokan Hilir",
    villageCount: villages.length,
    source: "Batas administrasi desa Riau — Hasil Delineasi Tahun 2018"
  };
  const nonAplForest = (forest.features || []).filter(feature =>
    normalize(feature.properties?.fungsi) !== "apl"
  );
  const mangroveByVillage = new Map(
    (mangrove.villages || []).map(row => [normalize(row.village), row])
  );

  const villageMetrics = villages.map(village => {
    const props = village.properties || {};
    const name = props.WADMKD || props.NAMOBJ;
    const hectares = areaHa(village);
    const rtrwCoverage = coverageByClass(
      village,
      rtrw.features,
      item => item.RENCANA || item.rtrsys || item.POLA_RUANG || item.rtrppr,
      warnings,
      `RTRW ${name}`
    );
    const peatCoverage = coverageByClass(
      village,
      peat.features,
      item => item.KELAS_GBT || item.KETEBALAN || "Gambut",
      warnings,
      `Gambut ${name}`
    );
    const forestCoverage = coverageByClass(
      village,
      nonAplForest,
      item => item.fungsi || "Kawasan hutan",
      warnings,
      `Kawasan hutan ${name}`
    );
    const peatAreaHa = peatCoverage.reduce((sum, row) => sum + row.areaHa, 0);
    const forestAreaHa = forestCoverage.reduce((sum, row) => sum + row.areaHa, 0);
    const mangroveRow = mangroveByVillage.get(normalize(name));
    const metrics = {
      id: normalize(name).replace(/\s+/g, "-"),
      name,
      areaHa: round(hectares),
      rtrwCoverage: rtrwCoverage.slice(0, 8),
      peatAreaHa: round(peatAreaHa),
      peatCoveragePct: round(Math.min(100, peatAreaHa / hectares * 100), 1),
      peatClasses: peatCoverage,
      forestAreaHa: round(forestAreaHa),
      forestCoveragePct: round(Math.min(100, forestAreaHa / hectares * 100), 1),
      forestFunctions: forestCoverage,
      mangrove: mangroveRow ? {
        status: mangroveRow.status,
        baselineMangroveHa: mangroveRow.baselineMangroveHa,
        currentMangroveHa: mangroveRow.currentMangroveHa,
        indicativeMangroveLossHa: mangroveRow.indicativeMangroveLossHa,
        priorityAreaHa: mangroveRow.priorityAreaHa,
        recommendedAction: mangroveRow.recommendedAction,
        confidence: mangroveRow.confidence
      } : { status: "not_analysed" }
    };
    metrics.recommendations = recommendationRows(metrics);
    return metrics;
  }).sort((a, b) => a.name.localeCompare(b.name, "id"));

  const totalAreaHa = villageMetrics.reduce((sum, row) => sum + row.areaHa, 0);
  const totalPeatHa = villageMetrics.reduce((sum, row) => sum + row.peatAreaHa, 0);
  const totalForestHa = villageMetrics.reduce((sum, row) => sum + row.forestAreaHa, 0);
  const rtrwMap = clippedFeatures(
    rtrw.features,
    studyArea,
    item => ({
      class: item.RENCANA || item.rtrsys || item.POLA_RUANG || item.rtrppr,
      pattern: item.POLA_RUANG || item.rtrppr || "",
      legalBasis: item.DASAR_HUKUM || item.nothpd || "",
      sourceObjectId: item.Source_Object_ID || item.objectid || ""
    }),
    warnings,
    "Geometri RTRW"
  );
  const peatMap = clippedFeatures(
    peat.features,
    studyArea,
    item => ({
      peatClass: item.KELAS_GBT || "Gambut",
      thickness: item.KETEBALAN || "",
      year: item.TAHUN || 2019
    }),
    warnings,
    "Geometri gambut"
  );
  const forestMap = clippedFeatures(
    nonAplForest,
    studyArea,
    item => ({ function: item.fungsi || "Kawasan hutan" }),
    warnings,
    "Geometri kawasan hutan"
  );

  return {
    metadata: {
      title: "Kajian Pembanding RDTR Kawasan Perkotaan Bagansiapiapi",
      owner: "Yayasan Gambut",
      access: "staff_only",
      status: "baseline_internal",
      generatedAt: new Date().toISOString(),
      consultationDate: "2026-09-22",
      officialDraftGeometryStatus: "not_received",
      limitation:
        "Baseline internal untuk menyiapkan pertanyaan dan rekomendasi. Temuan konflik zonasi baru dapat dinilai setelah geometri dan aturan zonasi draf RDTR diterima."
    },
    summary: {
      villageCount: villages.length,
      areaHa: round(totalAreaHa),
      peatAreaHa: round(totalPeatHa),
      peatCoveragePct: round(totalPeatHa / totalAreaHa * 100, 1),
      forestAreaHa: round(totalForestHa),
      forestCoveragePct: round(totalForestHa / totalAreaHa * 100, 1),
      rtrwClassCount: new Set(rtrwMap.map(feature => feature.properties.class)).size,
      mangroveAnalysedVillageCount: villageMetrics.filter(row => row.mangrove.status === "analysed").length
    },
    readiness: [
      { id: "study-area", label: "Batas 11 kelurahan/kepenghuluan", status: "ready" },
      { id: "rtrw-province", label: "RTRW Provinsi Riau", status: "ready" },
      { id: "peat", label: "Gambut BBSDLP 2019", status: "ready" },
      { id: "forest", label: "Kawasan hutan SK 903", status: "ready" },
      { id: "mangrove", label: "Analisis mangrove 2016–2025", status: "partial" },
      { id: "rdtr-draft", label: "Geometri dan aturan zonasi draf RDTR", status: "missing" },
      { id: "klhs", label: "Dokumen dan peta kerja KLHS", status: "missing" },
      { id: "hazards", label: "Peta rob, banjir, abrasi, dan subsidensi", status: "missing" }
    ],
    legalFramework: [
      { code: "UU 26/2007 jo. UU 6/2023", theme: "Penataan ruang" },
      { code: "PP 21/2021", theme: "Penyelenggaraan penataan ruang" },
      { code: "PP 46/2016 dan Permen LHK 13/2024", theme: "KLHS dan daya dukung lingkungan" },
      { code: "PP 71/2014 jo. PP 57/2016", theme: "Perlindungan dan pengelolaan ekosistem gambut" },
      { code: "Perpres 51/2016", theme: "Batas sempadan pantai" },
      { code: "Perda Riau 10/2018", theme: "RTRW Provinsi Riau 2018–2038; baca bersama Putusan MA 63 P/HUM/2019" }
    ],
    consultationQuestions: [
      "Mohon geometri digital batas wilayah perencanaan, pola ruang, struktur ruang, sub-BWP, dan blok beserta metadata, skala, serta tanggal pemutakhiran.",
      "Bagaimana draf RDTR mengintegrasikan hasil KLHS, fungsi ekosistem gambut, rob, banjir, abrasi, subsidensi, dan risiko kebakaran?",
      "Apa dasar penetapan garis sempadan pantai, Sungai Rokan, anak sungai, dan kawasan sekitar muara?",
      "Bagaimana perlindungan tutupan mangrove tersisa, koridor pasang-surut, perikanan tradisional, dan akses masyarakat pesisir diatur dalam zonasi?",
      "Bagaimana setiap perbedaan terhadap RTRW Provinsi dan RTRW Kabupaten dijelaskan dan didokumentasikan?",
      "Bagaimana masukan konsultasi publik dicatat, dijawab, dan ditelusuri pada revisi draf berikutnya?"
    ],
    villages: villageMetrics,
    map: {
      studyArea: featureCollection(villages),
      rtrw: featureCollection(rtrwMap),
      peat: featureCollection(peatMap),
      forest: featureCollection(forestMap)
    },
    warnings: [...warnings].slice(0, 50)
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [rtrwPath, outputPath] = process.argv.slice(2);
  if (!rtrwPath || !outputPath) {
    console.error("Usage: node build-rdtr-bagansiapiapi-analysis.mjs <rtrw.geojson> <output.json>");
    process.exit(2);
  }
  const analysis = buildAnalysis({
    rtrw: readJson(rtrwPath, "RTRW Riau"),
    administration: readJson(path.join(REPO_ROOT, "data/batas_administrasi_desa_riau.geojson"), "Batas administrasi"),
    peat: readJson(path.join(REPO_ROOT, "data/Gambut_BBSDLP_2019.geojson"), "Gambut BBSDLP"),
    forest: readJson(path.join(REPO_ROOT, "data/kawasan_hutan_sk_903.geojson"), "Kawasan hutan"),
    mangrove: readJson(path.join(REPO_ROOT, "data/mangrove-priority-rokan-hilir-results.json"), "Analisis mangrove")
  });
  fs.writeFileSync(outputPath, JSON.stringify(analysis));
  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    bytes: fs.statSync(outputPath).size,
    summary: analysis.summary,
    warnings: analysis.warnings.length
  }, null, 2));
}
