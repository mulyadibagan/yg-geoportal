const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/process-drone-orthomosaic.yml'), 'utf8');

test('R2 source cleanup keeps results and waits for remote COG verification', () => {
  assert.match(workflow, /drone\/queue\/cleanup\.json/);
  assert.match(workflow, /cleanup-scheduled "\$ROOT\/job\.json" --days 7/);
  assert.match(workflow, /curl --fail --silent --show-error --head/);
  assert.match(workflow, /drone\/uploads/);
  assert.match(workflow, /drone\/cache\/\$JOB_ID/);
  assert.doesNotMatch(workflow, /object delete "yg-webgis-public-snapshots\/drone\/results\//);

  const verifyIndex = workflow.indexOf('curl --fail --silent --show-error --head');
  const deleteIndex = workflow.indexOf('npx wrangler r2 object delete', verifyIndex);
  assert.ok(verifyIndex >= 0 && deleteIndex > verifyIndex, 'source deletion must happen after COG verification');
});

test('cleanup metadata uses a grace period and records completion', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'drone-cleanup-'));
  const jobPath = path.join(temp, 'job.json');
  fs.writeFileSync(jobPath, JSON.stringify({
    id: 'drn-cleanup-test',
    status: 'ready',
    cogKey: 'drone/results/drn-cleanup-test/orthomosaic.cog.tif'
  }));

  execFileSync('python', [path.join(root, 'scripts/drone_job.py'), 'cleanup-scheduled', jobPath, '--days', '7']);
  let job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  assert.equal(job.r2CleanupStatus, 'scheduled');
  assert.equal(job.r2SourceRetained, true);
  assert.equal(job.r2CleanupPolicy, 'verified_result_with_7_day_grace');
  const remainingDays = (Date.parse(job.r2CleanupEligibleAt) - Date.now()) / 86400000;
  assert.ok(remainingDays > 6.9 && remainingDays <= 7.01);

  execFileSync('python', [path.join(root, 'scripts/drone_job.py'), 'cleanup-complete', jobPath]);
  job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  assert.equal(job.r2CleanupStatus, 'complete');
  assert.equal(job.r2SourceRetained, false);
  assert.ok(job.r2CleanedAt);
});

