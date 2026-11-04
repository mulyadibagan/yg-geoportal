const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/donor-evidence-summary.js'), 'utf8');

test('Penabulu overview counts unique activities, not evidence records', () => {
  const programme = { outputs: [{ activities: [{id:'A'}, {id:'B'}, {id:'C'}] }] };
  const node = {};
  const context = { document: { getElementById: () => node }, programmeForDonor: () => programme };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function renderPenabuluOverview('), source.indexOf('  function renderPenabuluEvidence(')), context);
  context.renderPenabuluOverview([{indicatorId:'A'}, {indicatorId:'A'}, {indicatorId:'B'}, {indicatorId:'OTHER'}]);
  assert.match(node.innerHTML, /2\/3/);
  assert.match(node.innerHTML, /66,7%/);
  assert.match(node.innerHTML, /<strong>4<\/strong><span>Dokumentasi/);
  context.renderPenabuluOverview([]);
  assert.match(node.innerHTML, /0\/3/);
});

test('nursery evidence opens an existing photo instead of a map search', () => {
  const context = { isCapacityEvidence: () => false };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function evidenceDestination('), source.indexOf('  function statusFor(')), context);
  const link = context.evidenceDestination({evidenceId:'EV-PENABULU-1.3.2'});
  assert.ok(fs.existsSync(path.join(root, link.href)));
  assert.match(link.label, /foto pembibitan/);
});
