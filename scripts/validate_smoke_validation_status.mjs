import fs from "node:fs/promises";

const status = JSON.parse(await fs.readFile(process.argv[2] || "data/smoke-validation-status.json", "utf8"));
const allowed = new Set(["uncalibrated", "preliminary-calibration", "calibrated"]);
if (status.schemaVersion !== 1 || !allowed.has(status.status)) throw new Error("Smoke validation status has an unsupported schema or state.");
for (const field of ["candidateCaseCount", "reviewedScoreableCaseCount", "calibrationCaseCount", "independentEvaluationCaseCount"]) {
  if (!Number.isInteger(status[field]) || status[field] < 0) throw new Error(`Smoke validation status has invalid ${field}.`);
}
if (status.status === "calibrated" && (status.reviewedScoreableCaseCount < status.thresholds.calibratedMinimumReviewedCases || status.independentEvaluationCaseCount < status.thresholds.calibratedMinimumIndependentEvaluationCases)) {
  throw new Error("Calibrated status does not meet its declared case-count thresholds.");
}
if (status.status !== "calibrated" && status.metricsAvailable === true) throw new Error("Uncalibrated product cannot advertise final metrics.");
if (!status.claimBoundary || !status.parameterStatus) throw new Error("Smoke validation status is missing its claim boundary or parameter status.");
console.log(`Validated smoke status: ${status.status}; ${status.reviewedScoreableCaseCount} scoreable cases.`);
