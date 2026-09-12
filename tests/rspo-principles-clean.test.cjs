const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sawit-riau-rspo.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/rspo-riau.css'), 'utf8');

test('public certification panel stays concise', () => {
  assert.match(html, /Ruang lingkup utama sertifikasi/);
  assert.match(html, /01 · KEMAKMURAN/);
  assert.match(html, /02 · MANUSIA/);
  assert.match(html, /03 · LINGKUNGAN/);
  assert.doesNotMatch(html, /Cara (?:masyarakat|NGO) membaca informasi RSPO/i);
  assert.doesNotMatch(html, /Perhatikan jenis informasi|Periksa cakupannya|Lihat tanggal pembaruan/);
});

test('principles panel links to the document tab and remains responsive', () => {
  assert.match(html, /data-open-tab="dokumen">Lihat dokumen/);
  assert.match(css, /\.rspo-principle-note\{[^}]*display:flex/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.rspo-principle-note\{[^}]*flex-direction:column/);
});

test('public document panel opens individual Drive files without exposing internal archives', () => {
  const driveFiles = html.match(/https:\/\/drive\.google\.com\/file\/d\//g) || [];
  assert.equal(driveFiles.length, 3);
  assert.doesNotMatch(html, /drive\.google\.com\/drive\/folders\//);
  assert.doesNotMatch(html, /arsip (?:data )?YG|salinan (?:di Drive )?YG|folder dokumen YG/i);
  assert.match(html, /Dokumen &amp; Rujukan/);
  assert.match(html, /Buka dokumen/);
  assert.match(html, /Sumber resmi/);
});

test('public portal omits the methodology module and literal escape artifacts', () => {
  assert.doesNotMatch(html, /data-tab="metodologi"|data-panel="metodologi"/);
  assert.doesNotMatch(html, /\\n/);
});
