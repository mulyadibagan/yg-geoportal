const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const examples = require('../js/rspo-criteria-learning.js');
test('every criterion has an individual learning illustration', () => {
  const counts = [3, 5, 5, 7, 2, 9, 7];
  assert.equal(Object.keys(examples).length, 38);
  counts.forEach((count, p) => {
    for (let c = 1; c <= count; c++) assert.ok(examples[`${p + 1}.${c}`].length > 80);
  });
  assert.equal(new Set(Object.values(examples)).size, 38);
});
test('guide loads isolated learning assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '../rspo-prinsip-kriteria.html'), 'utf8');
  assert.match(html, /rspo-criteria-learning.js[^>]+defer/);
  assert.match(html, /rspo-learning.css/);
});
