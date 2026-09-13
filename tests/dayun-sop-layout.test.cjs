const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "dayun-sop-nanas.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/dayun.css"), "utf8");

test("SOP jump navigation scrolls with the page and cannot cover content", () => {
  assert.match(html, /class="dy-sop-jump"/);
  assert.match(html, /dayun\.css\?v=20260913-sopnav1/);
  assert.match(css, /\.dy-sop-jump\{position:relative;/);
  assert.doesNotMatch(css, /\.dy-sop-jump\{[^}]*position:sticky/);
});
