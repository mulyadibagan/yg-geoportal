import assert from "node:assert/strict";
import test from "node:test";
import { featureCollection, polygon } from "@turf/turf";
import { buildAnalysis } from "../scripts/build-rdtr-bagansiapiapi-analysis.mjs";

const names = [
  "Kelurahan Bagan Barat", "Kelurahan Bagan Hulu", "Kelurahan Bagan Kota",
  "Kelurahan Bagan Punak", "Kelurahan Bagan Timur", "Bagan Jawa",
  "Bagan Jawa Pesisir", "Bagan Punak Meranti", "Bagan Punak Pesisir",
  "Labuhan Tangga Besar", "Labuhan Tangga Hilir"
];

function square(x, properties) {
  return polygon([[[x, 2], [x + 0.01, 2], [x + 0.01, 2.01], [x, 2.01], [x, 2]]], properties);
}

test("builds an internal baseline for exactly the 11 invited planning-area villages", () => {
  const administration = featureCollection(names.map((name, index) => square(100 + index * 0.01, {
    WADMKK: "Rokan Hilir", WADMKC: "Bangko", WADMKD: name
  })));
  const mask = polygon([[[99.9, 1.9], [100.2, 1.9], [100.2, 2.2], [99.9, 2.2], [99.9, 1.9]]]);
  const result = buildAnalysis({
    administration,
    rtrw: featureCollection([{ ...mask, properties: { RENCANA: "Kawasan Permukiman", DASAR_HUKUM: "Perda No.10 Tahun 2018" } }]),
    peat: featureCollection([{ ...mask, properties: { KELAS_GBT: "100-<200 cm", KETEBALAN: "Sedang" } }]),
    forest: featureCollection([{ ...mask, properties: { fungsi: "HP" } }]),
    mangrove: { villages: [{ village: "Bagan Jawa Pesisir", status: "analysed", currentMangroveHa: 10, indicativeMangroveLossHa: 30 }] }
  });
  assert.equal(result.metadata.access, "staff_only");
  assert.equal(result.metadata.officialDraftGeometryStatus, "not_received");
  assert.equal(result.summary.villageCount, 11);
  assert.equal(result.villages.length, 11);
  assert.ok(result.summary.peatAreaHa > 0);
  assert.ok(result.summary.forestAreaHa > 0);
  assert.equal(result.summary.mangroveAnalysedVillageCount, 1);
  assert.ok(result.consultationQuestions.length >= 6);
  assert.equal(result.regulatoryAssessments.length, 10);
  assert.ok(result.regulationRegister.length >= 18);
  assert.equal(result.decisionClasses.length, 4);
  assert.ok(result.villages.every(row => row.regulatoryAssessments.length >= 4));
  assert.ok(result.regulatoryAssessments.some(row => row.theme === "Perlindungan ekosistem gambut" && row.decision === "hold"));
  assert.ok(result.regulationRegister.some(row => row.code.includes("11/2021") && row.code.includes("6/2026")));
  assert.ok(result.regulationRegister.filter(row => row.code.includes("jo.")).every(row =>
    Array.isArray(row.officialUrls) && row.officialUrls.length >= 2
  ));

  assert.equal(result.planningWorkflow.length, 5);
  assert.deepEqual(result.planningWorkflow.map(row => row.id), [
    "persiapan",
    "pengumpulan-data-informasi",
    "pengolahan-data-analisis",
    "perumusan-konsepsi",
    "penyusunan-rancangan-perkada"
  ]);
  assert.ok(result.planningWorkflow.every(row =>
    row.status && row.articleRef && row.requiredOutputs.length && row.ygWork.length && row.gaps.length
  ));
  assert.deepEqual(result.crossCuttingGates.map(row => row.id), [
    "rtrw-sync", "klhs-integration", "participation-fpr", "map-scale-5000"
  ]);

  assert.equal(result.p0EvidenceBoard.lastChecked, "2026-09-20");
  assert.equal(result.p0EvidenceBoard.items.length, 10);
  assert.deepEqual(result.p0EvidenceBoard.statusCounts, {
    verified_available: 1,
    not_verified: 1,
    historical_expired_reference: 1,
    verified_process_evidence: 1,
    not_received: 6
  });
  assert.match(result.p0EvidenceBoard.legalTruth, /27\/2002.*2002–2012/);
  assert.match(result.p0EvidenceBoard.promotionRule, /tidak boleh dinaikkan statusnya/);
  const invitationEvidence = result.p0EvidenceBoard.items.find(row => row.id === "P0-E01");
  assert.equal(invitationEvidence.status, "verified_available");
  assert.equal(invitationEvidence.documentNumber, "600.3.2.2/TARU/2026/2");
  assert.equal(invitationEvidence.documentDate, "2026-09-17");
  assert.match(invitationEvidence.finding, /11 kelurahan\/kepenghuluan/);
  assert.equal(invitationEvidence.access, "internal_only");
  assert.equal(invitationEvidence.sourceLinks, undefined);
  const historicalRtrw = result.p0EvidenceBoard.items.find(row => row.id === "P0-E03");
  assert.equal(historicalRtrw.status, "historical_expired_reference");
  assert.equal(historicalRtrw.planningPeriod, "2002–2012");
  assert.match(historicalRtrw.legalRole, /bukan sebagai bukti otomatis RTRW yang berlaku/);
  const currentRtrw = result.p0EvidenceBoard.items.find(row => row.id === "P0-E02");
  assert.equal(currentRtrw.status, "not_verified");
  assert.match(currentRtrw.limitation, /bukan bukti bahwa instrumen tidak ada/);

  assert.equal(result.mandatoryAnalysisMatrix.length, 21);
  assert.equal(result.mandatoryAnalysisMatrix.map(row => row.letter).join(""), "abcdefghijklmnopqrstu");
  assert.ok(result.mandatoryAnalysisMatrix.every(row =>
    row.id === `A24-${row.letter}` && row.articleRef.includes(`huruf ${row.letter}`) &&
    row.status && row.finding && row.nextStep
  ));
  assert.ok(result.mandatoryAnalysisMatrix.every(row =>
    ["P0", "P1", "P2"].includes(row.priority) && row.workstream && row.analysisQuestion &&
    row.requiredData.length >= 3 && row.method.length >= 2 && row.outputs.length >= 2 &&
    row.availableEvidence.length >= 1 && row.evidenceGaps.length >= 1 && row.geometryLink &&
    row.decisionUse && row.consultationPrompt
  ));
  assert.equal(result.analysisProgramme.priorities.reduce((sum, row) => sum + row.count, 0), 21);
  assert.ok(result.analysisProgramme.criticalPath.every(id =>
    result.mandatoryAnalysisMatrix.some(row => row.id === id)
  ));
  assert.match(result.analysisProgramme.promotionRule, /tidak dinaikkan statusnya/);

  assert.equal(result.ygPlan.status, "provisional_analytical_draft");
  assert.equal(result.ygPlan.selectedAlternative.id, "ALT-YG-1");
  assert.equal(result.ygPlan.selectedAlternative.status, "provisional");
  assert.deepEqual(result.ygPlan.alternatives.map(row => row.id), ["ALT-0", "ALT-OFF", "ALT-YG-1"]);
  assert.equal(result.ygPlan.alternatives.filter(row => row.selected).length, 1);
  assert.ok(result.ygPlan.planningObjective.statement);
  assert.ok(result.ygPlan.planningObjective.qualification.includes("Rumusan tujuan masih sementara"));
  assert.ok(result.ygPlan.strategies.length >= 5);
  assert.ok(result.ygPlan.structurePlan.centres.length > 0);
  assert.ok(result.ygPlan.structurePlan.networks.length > 0);
  assert.ok(result.ygPlan.patternPlan.zones.length > 0);
  assert.deepEqual(new Set(result.ygPlan.patternPlan.zones.map(row => row.patternCategory)),
    new Set(["protected_candidate", "cultivation_candidate"]));
  assert.ok(!result.ygPlan.patternPlan.zones.some(row => row.id === "ZONE-YG-RISK"));
  assert.ok(result.ygPlan.zoningRules.rules.length > 0);
  assert.ok(result.ygPlan.zoningRules.rules.some(row => row.id === "ZR-YG-RISK"));
  assert.ok(Object.values(result.ygPlan.zoningRules.numericIntensityParameters).every(value => value === null));
  assert.ok(result.ygPlan.programs.items.length > 0);
  assert.ok(result.ygPlan.traceability.length > 0);

  assert.ok(result.geometryRegistry.some(row => row.id === "GR-RDTR-OFFICIAL-DRAFT" && row.status === "not_received"));
  assert.equal(result.map.ygPlanningUnits.features.length, 11);
  assert.ok(result.map.ygPlanningUnits.features.every(feature =>
    feature.properties.role === "analytical_unit_not_swp_or_zone" &&
    feature.properties.screeningPriority && feature.properties.direction &&
    ["high", "moderate", "evidence_gap"].includes(feature.properties.knownConstraintBand) &&
    feature.properties.knownConstraintBasis && feature.properties.unresolvedRisk &&
    feature.properties.developmentSuitabilityStatus === "not_determined_pending_p0_analysis" &&
    feature.properties.screeningInterpretation.includes("bukan kelas kesesuaian lahan") &&
    feature.properties.disclaimer.includes("bukan batas WP")
  ));
  assert.ok(result.map.ygPlanningUnits.features.every(feature =>
    !Object.hasOwn(feature.properties, "decision") &&
    feature.properties.evidenceClass === "EV-I" &&
    feature.properties.geometryStatus === "analytical_simplified_administrative_input"
  ));
  assert.equal(result.map.ygPlanningUnits.metadata.access, "staff_only");
  assert.equal(result.map.ygPlanningUnits.metadata.role, "analytical_unit_not_swp_or_zone");
  assert.ok(result.map.ygPlanningUnits.metadata.geometryProcessing.includes("tolerance 0.00002"));

  const regulationIds = new Set(result.regulationRegister.map(row => row.id));
  const analysisIds = new Set(result.mandatoryAnalysisMatrix.map(row => row.id));
  const gateIds = new Set(result.crossCuttingGates.map(row => row.id));
  const objectsWithRegulationRefs = [
    ...result.planningWorkflow,
    ...result.crossCuttingGates,
    ...result.mandatoryAnalysisMatrix,
    result.ygPlan.planningObjective,
    ...result.ygPlan.strategies,
    ...result.ygPlan.traceability
  ];
  assert.ok(objectsWithRegulationRefs.every(row =>
    row.regulationRefs.every(id => regulationIds.has(id))
  ));
  assert.ok(result.ygPlan.traceability.every(row =>
    row.analysisRefs.every(id => analysisIds.has(id))
  ));
  assert.ok(result.p0EvidenceBoard.items.every(row =>
    row.evidenceClass === "EV-O" && row.analysisRefs.every(id => analysisIds.has(id)) &&
    row.gateRefs.every(id => gateIds.has(id)) && row.legalRole && row.finding && row.limitation && row.nextAction
  ));
});
