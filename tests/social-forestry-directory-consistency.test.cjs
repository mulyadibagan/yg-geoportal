const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const summary = readJson("data/social-forestry-summary.json");
const details = readJson("data/social-forestry-details.json");

test("PS summary has one canonical profile per decree or signature", () => {
  const profiles = summary.profiles || [];
  assert.equal(profiles.length, 181);
  assert.equal(summary.totals.profileCount, profiles.length);
  assert.equal(profiles.filter(profile => profile.spatial).length, 179);
  assert.equal(profiles.filter(profile => !profile.spatial).length, 2);
  assert.equal(profiles.filter(profile => profile.areaHa == null).length, 0);

  const decrees = profiles.map(profile => profile.decreeNorm).filter(Boolean);
  const signatures = profiles.map(profile => profile.signature).filter(Boolean);
  assert.equal(new Set(decrees).size, decrees.length);
  assert.equal(new Set(signatures).size, signatures.length);
  profiles.forEach(profile => assert.ok(details[profile.key], `detail missing for ${profile.key}`));
});

test("all spatial PS sources contain valid polygon geometry", () => {
  const files = [
    "data/PERHUTANAN_SOSIAL_RIAU.geojson",
    "data/social-forestry-pkk-samj.geojson",
    "data/social-forestry-kud-agro-lestari.geojson",
    "data/social-forestry-derived-2025.geojson",
    "data/social-forestry-official-2026.geojson"
  ];
  const features = files.flatMap(file => readJson(file).features || []);
  assert.equal(features.length, 186);
  features.forEach((feature, index) => {
    assert.ok(feature.geometry, `geometry missing at feature ${index}`);
    assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
    assert.ok(Array.isArray(feature.geometry.coordinates));
    assert.ok(feature.geometry.coordinates.length > 0);
  });
});

test("document-backed schemes and approved 2025 profile stay canonical", () => {
  const byName = new Map(summary.profiles.map(profile => [profile.name.toUpperCase(), profile]));
  assert.equal(byName.get("KTH JEPUN BESTARI").decree, "8652 TAHUN 2025");
  assert.equal(byName.get("KTH JEPUN BESTARI").scheme, "Hutan Kemasyarakatan");
  assert.equal(byName.get("GAPOKTANHUT KAMPUNG DOSAN").scheme, "Kemitraan Kehutanan");
  assert.equal(byName.get("KTH PECINTA MANGROVE KULIT BAKAU").scheme, "Hutan Kemasyarakatan");
  assert.equal(byName.get("KTH PECINTA MANGROVE KULIT BAKAU").decree, "SK.5133/MENLHK-PSKL/PKPS/PSL.0/6/2022");
  assert.equal(byName.get("KTH PECINTA MANGROVE KULIT BAKAU").areaHa, 14);
  assert.equal(byName.get("HUTAN ADAT GHIMBO BONCA LIDA DAN GHIMBO POMUAN").scheme, "Hutan Adat");
  assert.equal(byName.get("MHA KENEGERIAN PETAPAHAN").scheme, "Hutan Adat");
  ["KTH BOMBAN BERDURI", "KTH BATU BERDIRI", "KTH BATU KUCING", "KTH KASIH ALAM"].forEach(name => {
    assert.equal(byName.get(name).scheme, "Kemitraan Kehutanan");
  });
});

test("directory uses extracted decrees and canonical summary keys", () => {
  const directory = fs.readFileSync(path.join(root, "js/social-forestry-directory.js"), "utf8");
  const overlay = fs.readFileSync(path.join(root, "js/social-forestry-process-overlay.js"), "utf8");
  assert.match(directory, /d\.decree\|\|legal\.decreeNumber/);
  assert.match(directory, /r\.key=sm\.key\|\|r\.key/);
  assert.match(directory, /canonicalScheme\(r\.summaryScheme\|\|r\.scheme\)/);
  assert.match(overlay, /d\.decree\|\|legal\.decreeNumber/);
});

test("scheme summary cards are accessible directory filters", () => {
  const directory = fs.readFileSync(path.join(root, "js/social-forestry-directory.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "social-forestry-directory.html"), "utf8");
  const styles = fs.readFileSync(path.join(root, "css/social-forestry-directory-clickable.css"), "utf8");

  assert.match(directory, /activeScheme/);
  assert.match(directory, /data-area-action="approved"/);
  assert.match(directory, /data-area-action="process"/);
  assert.match(directory, /data-area-scheme=/);
  assert.match(directory, /aria-pressed=/);
  assert.match(directory, /schemeGrid\.addEventListener\("click"/);
  assert.match(page, /social-forestry-directory-clickable\.css\?v=20260904-document-filters1/);
  assert.match(page, /social-forestry-directory\.js\?v=20260904-document-filters1/);
  assert.match(styles, /\.psd-area-card:focus-visible/);
  assert.match(styles, /\.psd-area-card\.is-active/);
});

test("verified late-2025 profiles keep their authoritative decree and regency", () => {
  assert.equal(details["3577.0"].regency, "Kuantan Singingi");
  assert.equal(details["3577.0"].bpsklVerification.sourceSheet, "Kuantan Singingi");
  assert.equal(details["3578.0"].decree, "11976 TAHUN 2025");
  assert.equal(details["3579.0"].regency, "Pelalawan");
  assert.equal(details["3579.0"].bpsklVerification.sourceSheet, "Pelalawan");

  const byKey = new Map(summary.profiles.map(profile => [profile.key, profile]));
  assert.equal(byKey.get("3577.0").regency, "Kuantan Singingi");
  assert.equal(byKey.get("3578.0").decree, "11976 TAHUN 2025");
  assert.equal(byKey.get("3579.0").regency, "Pelalawan");
});

test("document completeness cards filter available and missing profiles", () => {
  const directory = fs.readFileSync(path.join(root, "js/social-forestry-directory.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "social-forestry-directory.html"), "utf8");
  const styles = fs.readFileSync(path.join(root, "css/social-forestry-directory-clickable.css"), "utf8");

  ["sk", "map", "rkps", "rkt", "kups"].forEach(type => {
    assert.match(page, new RegExp(`data-document-filter="available-${type}"`));
    assert.match(page, new RegExp(`data-document-filter="missing-${type}"`));
    assert.match(page, new RegExp(`<option value="available-${type}">`));
    assert.match(page, new RegExp(`<option value="missing-${type}">`));
  });
  assert.match(directory, /documentStats\.addEventListener\("click"/);
  assert.match(directory, /legalFilter\.value="approved"/);
  assert.match(directory, /button\.classList\.toggle\("is-active",active\)/);
  assert.match(styles, /\.psd-completeness-filter:focus-visible/);
  assert.match(styles, /\.psd-completeness-missing\.is-active/);
  assert.match(page, /social-forestry-directory-clickable\.css\?v=20260904-document-filters1/);
  assert.match(page, /social-forestry-directory\.js\?v=20260904-document-filters1/);
});
