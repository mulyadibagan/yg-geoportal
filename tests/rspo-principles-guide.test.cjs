const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const guide = fs.readFileSync(path.join(root, 'rspo-prinsip-kriteria.html'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'sawit-riau-rspo.html'), 'utf8');

test('guide presents all seven principles without duplicating the map', () => {
  for (let number = 1; number <= 7; number += 1) {
    assert.match(guide, new RegExp(`id="p${number}"`));
    assert.match(guide, new RegExp(`PRINSIP 0${number}`));
  }
  assert.equal((guide.match(/class="guide-principle /g) || []).length, 7);
  assert.doesNotMatch(guide, /id="rspo-map"|leaflet/i);
});

test('guide remains a public learning resource', () => {
  assert.match(guide, /Apa maksudnya\?/);
  assert.match(guide, /Cakupan yang dipelajari/);
  assert.match(guide, /Contoh penerapan/);
  assert.match(guide, /Sering disalahpahami/);
  assert.match(guide, /tidak menggantikan dokumen standar/i);
  assert.doesNotMatch(guide, /checklist audit|nilai kepatuhan|status lulus/i);
});

test('portal exposes the guide from principles and documents', () => {
  assert.equal((portal.match(/href="rspo-prinsip-kriteria\.html"/g) || []).length, 2);
  assert.match(portal, /Buka panduan prinsip/);
  assert.match(portal, /Pelajari prinsip dan proses sertifikasi/);
});
