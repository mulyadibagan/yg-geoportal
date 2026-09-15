import fs from "node:fs/promises";

const catalog = JSON.parse(await fs.readFile("data/smoke-validation-catalog.json", "utf8"));
const observed = JSON.parse(await fs.readFile("data/smoke-validation-observed.geojson", "utf8"));
const plan = JSON.parse(await fs.readFile("data/smoke-calibration-plan.json", "utf8"));
const output = process.argv[2] || "data/smoke-validation-status.json";
const catalogIds = new Set((catalog.cases || []).map((item) => item.id));
for (const caseId of Object.keys(plan.caseRoles || {})) if (!catalogIds.has(caseId)) throw new Error(`Calibration plan references unknown case ${caseId}.`);

const featuresByCase = Map.groupBy(observed.features || [], (feature) => feature.properties?.caseId);
const scoreable = (observed.metadata?.cases || []).filter((record) =>
  record.annotationStatus === "reviewed" &&
  ["clear", "partial"].includes(record.visibility) &&
  ["high", "medium"].includes(record.confidence) &&
  record.blindToModel === true &&
  (featuresByCase.get(record.caseId) || []).length > 0
);
const calibrationCases = scoreable.filter((record) => /calibration/.test(plan.caseRoles[record.caseId] || ""));
const evaluationCases = scoreable.filter((record) => /evaluation/.test(plan.caseRoles[record.caseId] || ""));
const rules = plan.statusRules;
let status = "uncalibrated";
if (scoreable.length >= rules.preliminaryCalibrationMinimumReviewedCases) status = "preliminary-calibration";
if (scoreable.length >= rules.calibratedMinimumReviewedCases && evaluationCases.length >= rules.calibratedMinimumIndependentEvaluationCases) status = "calibrated";

const messages = {
  uncalibrated: "No independently reviewed plume cases are yet sufficient to fit or evaluate the model parameters.",
  "preliminary-calibration": "A preliminary fit is available, but the independent evaluation sample is still below the publication threshold.",
  calibrated: "The historical sample meets the declared minimum case-count rules; consult the metrics before interpreting performance."
};
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  product: plan.product,
  status,
  candidateCaseCount: catalogIds.size,
  reviewedScoreableCaseCount: scoreable.length,
  calibrationCaseCount: calibrationCases.length,
  independentEvaluationCaseCount: evaluationCases.length,
  thresholds: rules,
  parameters: plan.parameters,
  parameterStatus: plan.parameterStatus,
  metricsAvailable: false,
  message: messages[status],
  claimBoundary: plan.claimBoundary
};
await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Built smoke validation status: ${status}; ${scoreable.length} scoreable cases.`);
