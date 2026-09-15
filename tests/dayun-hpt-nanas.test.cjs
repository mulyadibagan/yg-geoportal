const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "dayun-hpt-nanas.html"), "utf8");
const script = fs.readFileSync(path.join(root, "js/dayun-hpt-nanas.js"), "utf8");

test("all six HPT cards use stable local photos", () => {
  const localPhotos = ["uret", "kutu-putih", "kerusakan-buah", "layu-nanas", "busuk-hitam", "busuk-hati"];
  for (const photo of localPhotos) {
    assert.match(html, new RegExp(`src="assets/dayun/hpt/${photo}\\.jpg"`));
    assert.ok(fs.existsSync(path.join(root, `assets/dayun/hpt/${photo}.jpg`)));
  }
  assert.doesNotMatch(html, /<img[^>]+src="https?:\/\//);
});

test("calculator maps observed HPT to specific field guidance", () => {
  for (const id of ["hpt-uret", "hpt-kutu-putih", "hpt-tikus", "hpt-layu", "hpt-busuk-hitam", "hpt-busuk-hati"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(script, new RegExp(`id:"${id}"`));
  }
  assert.match(html, /id="hpt-guide-link"/);
  assert.match(script, /Tindakan awal:/);
});
