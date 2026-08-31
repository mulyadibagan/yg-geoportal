const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "apps-script", "webgis-backend", "Admin.html"),
  "utf8"
);

test("Apps Script admin cards contain long content without horizontal overflow", () => {
  assert.match(source, /html,body\{max-width:100%;overflow-x:hidden\}/);
  assert.match(source, /\.item\{min-width:0;max-width:100%;[^}]*overflow:hidden\}/);
  assert.match(source, /\.description\{[^}]*overflow-wrap:anywhere;word-break:break-word\}/);
  assert.match(source, /\.actions\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(170px,260px\)/);
  assert.match(source, /class="action-buttons"/);
  assert.match(source, /\.action-buttons\{[^}]*flex-wrap:wrap/);
});
