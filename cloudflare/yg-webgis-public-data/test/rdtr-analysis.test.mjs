import assert from "node:assert/strict";
import test from "node:test";
import { area, featureCollection, intersect, lineString, point, polygon } from "@turf/turf";
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
  const peatMask = polygon([[[99.99, 1.99], [100.055, 1.99], [100.055, 2.02], [99.99, 2.02], [99.99, 1.99]]]);
  const forestMask = polygon([[[100.04, 1.99], [100.085, 1.99], [100.085, 2.02], [100.04, 2.02], [100.04, 1.99]]]);
  const result = buildAnalysis({
    administration,
    rtrw: featureCollection([{ ...mask, properties: { RENCANA: "Kawasan Permukiman", DASAR_HUKUM: "Perda No.10 Tahun 2018" } }]),
    peat: featureCollection([{ ...peatMask, properties: { KELAS_GBT: "100-<200 cm", KETEBALAN: "Sedang" } }]),
    forest: featureCollection([{ ...forestMask, properties: { fungsi: "HP" } }]),
    mangrove: { villages: [{ village: "Bagan Jawa Pesisir", status: "analysed", currentMangroveHa: 10, indicativeMangroveLossHa: 30 }] },
    mangroveCandidates: featureCollection([square(100.06, {
      regency: "Rokan Hilir", district: "Bangko", village: "Bagan Jawa Pesisir",
      polygonId: "MPR-TEST-1", priorityClass: "P1", priorityLabel: "Perlindungan segera",
      priorityScore: 80, confidence: "tinggi", recommendedAction: "perlindungan", methodVersion: "test-v1"
    })]),
    roads: Object.assign(featureCollection([
      lineString([[100.001, 2.005], [100.019, 2.005]], { osmId: 1, highway: "primary", name: "Jalan Uji Utama" }),
      lineString([[100.061, 2.005], [100.069, 2.005]], { osmId: 2, highway: "residential", name: null })
    ]), { source: "OpenStreetMap contributors via Overpass" }),
    facilities: featureCollection([
      point([100.005, 2.005], { id: "OSM-NODE-10", name: "Puskesmas Uji", category: "health", critical: true }),
      point([100.015, 2.005], { id: "OSM-NODE-11", name: "Sekolah Uji", category: "education", critical: false })
    ]),
    hydrology: featureCollection([
      lineString([[100.002, 2.002], [100.018, 2.008]], { id: "OSM-WAY-20", name: "Sungai Uji", waterway: "river" })
    ])
  });
  assert.equal(result.metadata.access, "staff_only");
  assert.equal(result.metadata.ygDraftZoningStatus, "provisional_internal_zone_geometry");
  assert.equal(result.summary.villageCount, 11);
  assert.equal(result.villages.length, 11);
  assert.ok(result.summary.peatAreaHa > 0);
  assert.ok(result.summary.forestAreaHa > 0);
  assert.equal(result.summary.mangroveAnalysedVillageCount, 1);
  assert.equal(result.summary.mangroveCandidateCount, 1);
  assert.ok(result.summary.mangroveCandidateAreaHa > 0);
  assert.ok(result.consultationQuestions.length >= 6);
  assert.equal(result.regulatoryAssessments.length, 10);
  assert.ok(result.regulationRegister.length >= 18);
  assert.equal(result.decisionClasses.length, 4);
  assert.ok(result.villages.every(row => row.regulatoryAssessments.length >= 3));
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
    available_internal_draft: 1,
    not_received: 5
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
  const ygZoneEvidence = result.p0EvidenceBoard.items.find(row => row.id === "P0-E07");
  assert.equal(ygZoneEvidence.status, "available_internal_draft");
  assert.equal(ygZoneEvidence.evidenceClass, "EV-I");
  assert.match(ygZoneEvidence.finding, /geometri zona kandidat saling eksklusif/);

  assert.equal(result.policyMapFramework.status, "mapped_policy_synthesis_v0");
  assert.equal(result.policyMapFramework.layers.length, 3);
  assert.deepEqual(result.policyMapFramework.layers.map(row => row.id), [
    "PM-YG-PEAT", "PM-YG-FOREST", "PM-YG-COAST"
  ]);
  assert.deepEqual(result.policyMapFramework.completionStages.map(row => row.id), ["MAP-0", "MAP-1", "MAP-2", "MAP-3"]);
  assert.equal(result.policyMapFramework.completionStages[0].status, "complete_internal_v0");
  assert.ok(result.policyMapFramework.completionStages.slice(1).every(row => row.status !== "complete_internal_v0"));
  assert.match(result.policyMapFramework.readingRule, /tidak boleh dijumlahkan/);

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
  assert.deepEqual(result.ygPlan.alternatives.map(row => row.id), ["ALT-0", "ALT-YG-2", "ALT-YG-1"]);
  assert.equal(result.ygPlan.alternatives.filter(row => row.selected).length, 1);
  assert.ok(result.ygPlan.planningObjective.statement);
  assert.ok(result.ygPlan.planningObjective.qualification.includes("dasar rancangan alternatif YG"));
  assert.ok(result.ygPlan.strategies.length >= 5);
  assert.ok(result.ygPlan.structurePlan.centres.length > 0);
  assert.ok(result.ygPlan.structurePlan.networks.length > 0);
  assert.ok(result.ygPlan.patternPlan.zones.length > 0);
  assert.deepEqual(new Set(result.ygPlan.patternPlan.zones.map(row => row.patternCategory)),
    new Set(["protected_candidate", "cultivation_candidate", "verification_candidate"]));
  assert.ok(!result.ygPlan.patternPlan.zones.some(row => row.id === "ZONE-YG-RISK"));
  assert.ok(result.ygPlan.zoningRules.rules.length > 0);
  assert.ok(result.ygPlan.zoningRules.rules.some(row => row.id === "ZR-YG-RISK"));
  assert.equal(result.ygPlan.zoningRules.codebookVersion, "0.1.0-internal");
  assert.equal(result.ygPlan.zoningRules.activityCatalog.length, 12);
  assert.ok(result.ygPlan.zoningRules.subzoneCandidates.length >= result.map.ygCandidateZones.features.length);
  assert.equal(result.ygPlan.zoningRules.itbxMatrix.length,
    new Set(result.map.ygCandidateZones.features.map(feature => feature.properties.zoneFamily)).size * 12);
  assert.deepEqual(new Set(result.ygPlan.zoningRules.itbxMatrix.map(row => row.classification)), new Set(["I", "T", "B", "X"]));
  assert.ok(result.ygPlan.zoningRules.itbxMatrix.every(row =>
    row.status === "candidate_internal_not_legal_rule" && row.condition &&
    row.evidenceLocks.length >= 1 && row.regulationRefs.length >= 1
  ));
  assert.ok(result.ygPlan.zoningRules.intensityEnvelopes.every(row =>
    row.status === "numeric_values_not_set" && Object.values(row.parameters).every(value => value === null)
  ));
  assert.ok(Object.values(result.ygPlan.zoningRules.numericIntensityParameters).every(value => value === null));
  assert.equal(result.ygPlan.programs.items.length, 8);
  assert.equal(result.ygPlan.programs.version, "0.1.0-internal");
  assert.ok(result.ygPlan.programs.items.every(row =>
    ["P0", "P1", "P2"].includes(row.priority) && row.relativePhase && row.spatialStatus &&
    row.linkedZoneCodes.length >= 1 && row.analysisRefs.length >= 1 && row.regulationRefs.length >= 1 &&
    row.candidateLeadRole && row.financingStatus === "not_costed_not_committed" && row.indicators.length >= 2 &&
    row.indicators.every(indicator => indicator.baseline === null && indicator.target === null)
  ));
  assert.ok(result.ygPlan.traceability.length > 0);

  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-DRAFT-ZONES" && row.status === "provisional_internal_zone_geometry"));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-STRUCTURE-NODES" && row.featureCount === 11));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-STRUCTURE-AXES" && row.featureCount === 10));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-ROAD-EVIDENCE" && row.featureCount === 2));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-FACILITY-EVIDENCE" && row.featureCount === 2));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-HYDROLOGY-EVIDENCE" && row.featureCount === 1));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-RTRW-ROHIL" && row.status === "not_verified"));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-MANGROVE-CANDIDATES" && row.featureCount === 1));
  assert.equal(result.map.mangroveCandidates.features.length, 1);
  assert.equal(result.map.mangroveCandidates.features[0].properties.polygonId, "MPR-TEST-1");
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

  assert.equal(result.ygDraftRdtr.status, "provisional_internal_spatial_draft");
  assert.equal(result.ygDraftRdtr.version, "0.21.0-internal-release-candidate");
  assert.equal(result.ygDraftRdtr.programmePortfolio.programmeCount, 8);
  assert.equal(result.ygDraftRdtr.programmePortfolio.indicatorCount, 16);
  assert.equal(result.consultationArgumentMatrix.items.length, 10);
  assert.equal(result.ygDraftRdtr.consultationArgumentMatrix.argumentCount, 10);
  assert.equal(result.consultationQuestions.length, 10);
  assert.ok(result.consultationArgumentMatrix.items.every(row =>
    row.id && row.assessmentRef && ["P0", "P1", "P2"].includes(row.priority) &&
    row.consultationQuestion && row.legalBasisRefs.length >= 1 && row.evidenceRefs.length >= 1 &&
    row.linkedZoneCodes.length >= 1 && row.ygFinding && row.ygPosition && row.requestedChange &&
    row.responseStandard && row.requestedDisposition === "accept_or_reasoned_reject_with_evidence" &&
    row.governmentResponse === null && row.agreedChange === null && row.mapChangeRef === null &&
    row.ruleChangeRef === null && row.responsibleParty === null && row.dueDate === null &&
    row.resolutionStatus === "not_started"
  ));
  assert.equal(result.consultationReadinessPack.priorityAgenda.length, 10);
  assert.equal(result.consultationReadinessPack.mapChecklist.length, 7);
  assert.equal(result.consultationReadinessPack.teamRoles.length, 5);
  assert.equal(result.consultationReadinessPack.noteTemplate.length, 10);
  assert.equal(result.ygDraftRdtr.consultationReadinessPack.agendaCount, 10);
  assert.ok(result.consultationReadinessPack.priorityAgenda.every((row, index) =>
    row.order === index + 1 && row.argumentRef && row.oralQuestion && row.requestedOutcome && row.timeAllocationMinutes > 0
  ));
  assert.ok(result.consultationReadinessPack.teamRoles.every(row => row.assignedTo === null));
  assert.ok(result.consultationReadinessPack.mapChecklist.every(row =>
    row.exportOrPrintChecked === false && row.reviewedBy === null && row.reviewDate === null
  ));
  assert.ok(result.consultationReadinessPack.noteTemplate.every(row =>
    row.questionAsked === false && row.respondentNameAndRole === null && row.responseVerbatimOrSummary === null &&
    row.responsibleParty === null && row.dueDate === null && row.followUpOwner === null && row.resolutionStatus === "not_started"
  ));
  assert.equal(result.completenessAudit.totalComponents, 18);
  assert.equal(result.completenessAudit.status, "not_ready_for_legal_or_public_release");
  assert.equal(result.ygDraftRdtr.completenessAudit.totalComponents, 18);
  assert.deepEqual(Object.fromEntries(result.completenessAudit.statusSummary.map(row => [row.status, row.count])), {
    available_internal_provisional: 2,
    partial_internal: 9,
    blocked_external_evidence: 3,
    blocked_authority_process: 3,
    blocked_internal_approval: 1
  });
  assert.ok(result.completenessAudit.items.every(row =>
    row.regulationRefs.length >= 1 && row.available && row.gap && row.completionGate &&
    row.legalCompleteness === "not_complete" && row.publicationEligible === false &&
    row.reviewedBy === null && row.reviewDate === null
  ));
  assert.equal(result.completenessAudit.releaseGates.length, 5);
  assert.ok(result.completenessAudit.releaseGates.every(row => row.status === "not_completed"));
  assert.equal(result.gapClosureWorkplan.totalItems, 18);
  assert.equal(result.ygDraftRdtr.gapClosureWorkplan.totalItems, 18);
  assert.deepEqual(Object.fromEntries(result.gapClosureWorkplan.prioritySummary.map(row => [row.priority, row.count])), { P0: 7, P1: 9, P2: 2 });
  assert.ok(result.gapClosureWorkplan.items.every(row =>
    row.status === "not_started" && row.assignedTo === null && row.dueDate === null && row.ownerRole &&
    row.acceptanceCriteria && Object.values(row.evidenceReceipt).every(value => value === null)
  ));
  const gapAuditRefs = new Set(result.gapClosureWorkplan.items.map(row => row.auditRef));
  assert.equal(gapAuditRefs.size, 18);
  assert.ok(result.gapClosureWorkplan.items.every(row => row.dependencies.every(id => gapAuditRefs.has(id))));
  assert.equal(result.v1ReleaseDossier.targetVersion, "1.0.0");
  assert.equal(result.v1ReleaseDossier.releaseDecision, "hold_not_ready_for_publication");
  assert.equal(result.v1ReleaseDossier.publicationAuthorized, false);
  assert.equal(result.v1ReleaseDossier.validationChecks.length, 6);
  assert.equal(result.v1ReleaseDossier.evidenceRequests.length, 18);
  assert.equal(result.v1ReleaseDossier.openWorkItemCount, 18);
  assert.equal(result.v1ReleaseDossier.acceptedEvidenceCount, 0);
  assert.ok(result.v1ReleaseDossier.evidenceRequests.every(row => row.requestSentAt === null && row.receivedAt === null &&
    row.acceptedForUse === false && row.reviewer === null && row.reviewDate === null));
  assert.ok(result.v1ReleaseDossier.releaseGates.every(row => row.status === "not_completed" && row.decision === "hold"));
  assert.equal(result.ygDraftRdtr.v1ReleaseDossier.publicationAuthorized, false);
  assert.equal(result.existingEvidenceReconciliation.totalItems, 18);
  assert.equal(result.existingEvidenceReconciliation.legalPromotionCount, 0);
  assert.deepEqual(Object.fromEntries(result.existingEvidenceReconciliation.statusSummary.map(row => [row.status, row.count])), {
    available_internal_screening: 2, partial_internal_screening: 9, official_or_external_evidence_missing: 3,
    authority_process_evidence_missing: 3, internal_approval_missing: 1
  });
  assert.ok(result.existingEvidenceReconciliation.items.every(row => row.legalCompletenessChanged === false &&
    row.publicationEligibilityChanged === false && row.humanReviewedBy === null && row.humanReviewDate === null));
  assert.equal(result.ygDraftRdtr.existingEvidenceReconciliation.legalPromotionCount, 0);
  assert.equal(result.evidenceRequestBriefing.totalBriefs, 7);
  assert.equal(result.ygDraftRdtr.evidenceRequestBriefing.totalBriefs, 7);
  assert.ok(result.evidenceRequestBriefing.items.every(row => row.recipientRole && row.requestedEvidence && row.consultationQuestion &&
    row.responseStandard && row.approvalBeforeSend === true && row.recipientName === null && row.approvedAt === null &&
    row.sentAt === null && row.responseReceivedAt === null && row.status === "draft_not_sent"));
  assert.equal(result.responseChangeControlLedger.totalEntries, 7);
  assert.equal(result.ygDraftRdtr.responseChangeControlLedger.totalEntries, 7);
  assert.ok(result.responseChangeControlLedger.entries.every(row => row.responseReceivedAt === null && row.respondentNameAndRole === null &&
    row.validationDecision === "not_reviewed" && row.proposedDisposition === null && row.technicalReviewer === null &&
    row.legalReviewer === null && row.approvedBy === null && row.implementationStatus === "not_started" && row.closedAt === null &&
    Object.entries(row.impactAssessment).every(([key, value]) => key === "impactNotes" ? value === null : value === false)));
  assert.equal(result.ygDraftRdtr.zoningCodebook.version, "0.1.0-internal");
  assert.equal(result.ygDraftRdtr.structureDraft.status, "analytical_reference_geometry");
  assert.equal(result.ygDraftRdtr.structureDraft.nodeCount, 11);
  assert.equal(result.ygDraftRdtr.structureDraft.axisCount, 10);
  assert.equal(result.ygPlan.structurePlan.status, "analytical_reference_geometry_v0_1");
  assert.equal(result.ygPlan.structurePlan.referenceNodeCount, 11);
  assert.equal(result.ygPlan.structurePlan.referenceAxisCount, 10);
  assert.equal(result.ygPlan.structurePlan.networkSystems.length, 5);
  assert.equal(result.map.ygStructureNodes.features.length, 11);
  assert.equal(result.map.ygStructureAxes.features.length, 10);
  assert.equal(result.map.ygStructureNodes.features.filter(feature =>
    feature.properties.hierarchy === "primary_reference").length, 1);
  assert.ok(result.map.ygStructureNodes.features.every(feature =>
    feature.geometry.type === "Point" && feature.properties.legalEffect === "none" &&
    feature.properties.geometryStatus.includes("not_facility_location")
  ));
  assert.ok(result.map.ygStructureAxes.features.every(feature =>
    feature.geometry.type === "LineString" && feature.properties.legalEffect === "none" &&
    feature.properties.geometryStatus === "straight_line_connectivity_test_not_transport_route"
  ));
  assert.equal(result.ygDraftRdtr.networkEvidence.status, "partial_open_road_evidence");
  assert.equal(result.map.ygRoadEvidence.features.length, 2);
  assert.equal(result.map.ygRoadEvidence.metadata.namedFeatureCount, 1);
  assert.ok(result.map.ygRoadEvidence.metadata.totalLengthKm > 0);
  assert.deepEqual(new Set(result.ygPlan.structurePlan.roadClassSummary.map(row => row.highwayClass)),
    new Set(["primary", "residential"]));
  assert.equal(result.ygPlan.structurePlan.evidenceGaps.length, 6);
  assert.ok(result.map.ygRoadEvidence.features.every(feature =>
    feature.properties.evidenceStatus === "open_data_screening_not_official_road_network" &&
    feature.properties.legalEffect === "none"
  ));
  assert.equal(result.ygDraftRdtr.serviceHydrologyEvidence.status, "partial_open_evidence");
  assert.equal(result.map.ygFacilityEvidence.features.length, 2);
  assert.equal(result.map.ygHydrologyEvidence.features.length, 1);
  assert.equal(result.map.ygFacilityEvidence.metadata.criticalCount, 1);
  assert.equal(result.serviceAccessAnalysis.villageMatrix.length, 11);
  assert.equal(result.ygDraftRdtr.serviceAccessAnalysis.status, "screening_analysis_available");
  assert.equal(result.map.ygFacilityEvidence.features[0].properties.village, "Kelurahan Bagan Barat");
  assert.ok(Number.isFinite(result.map.ygFacilityEvidence.features[0].properties.nearestOsmRoadDistanceM));
  assert.equal(result.map.ygFacilityEvidence.features[0].properties.adequacyConclusion, "not_determined");
  assert.ok(result.map.ygFacilityEvidence.features.every(feature =>
    ["high", "medium", "standard"].includes(feature.properties.verificationPriority) &&
    feature.properties.ygZoneCode && feature.properties.legalEffect === "none"
  ));
  assert.ok(result.serviceAccessAnalysis.villageMatrix.every(row =>
    row.serviceAdequacy === "not_assessed_population_capacity_travel_time_missing"
  ));
  assert.ok(result.serviceAccessAnalysis.villageMatrix.some(row => row.evidenceCheckPriority === "high"));
  assert.ok(result.map.ygHydrologyEvidence.metadata.totalLengthKm > 0);
  assert.deepEqual(new Set(result.ygPlan.structurePlan.facilityCategories.map(row => row.category)), new Set(["education", "health"]));
  assert.equal(result.ygPlan.structurePlan.waterwayClasses[0].waterwayClass, "river");
  assert.equal(result.map.ygCandidateZones.metadata.status, "provisional_internal_zone_geometry");
  assert.ok(result.map.ygCandidateZones.features.length >= 4);
  assert.ok(result.map.ygCandidateZones.features.some(feature => feature.properties.code === "YG-ZK"));
  assert.ok(result.map.ygCandidateZones.metadata.coveragePct > 99.99);
  assert.ok(Math.abs(area(result.map.ygCandidateZones) / 10000 - result.summary.areaHa) < 0.2);
  assert.ok(result.map.ygCandidateZones.features.every(feature =>
    feature.properties.code && feature.properties.direction &&
    feature.properties.maturity === "provisional_internal_zone_geometry" &&
    feature.properties.legalEffect === "none" && feature.properties.constraintOverlays &&
    feature.properties.rtrwProvinceClasses
  ));
  assert.equal(result.map.ygDevelopmentReadiness.features.length, result.map.ygCandidateZones.features.length);
  assert.equal(result.developmentReadinessAnalysis.status, "development_readiness_not_determined");
  assert.equal(result.ygDraftRdtr.developmentReadinessAnalysis.status, "development_readiness_not_determined");
  assert.ok(result.map.ygDevelopmentReadiness.features.every(feature =>
    feature.properties.developmentReadiness === "not_determined" &&
    feature.properties.safeForIntensification === "not_demonstrated" &&
    ["high", "medium", "standard"].includes(feature.properties.surveyPriority) &&
    feature.properties.evidenceLockCount >= 7 && feature.properties.legalEffect === "none"
  ));
  assert.ok(result.map.ygDevelopmentReadiness.features.filter(feature => feature.properties.patternCategory === "cultivation_candidate")
    .every(feature => feature.properties.promotionDecision === "hold_development_promotion_pending_complete_evidence"));
  assert.ok(result.geometryRegistry.some(row => row.id === "GR-YG-DEVELOPMENT-READINESS" &&
    row.featureCount === result.map.ygCandidateZones.features.length));
  for (let i = 0; i < result.map.ygCandidateZones.features.length; i += 1) {
    for (let j = i + 1; j < result.map.ygCandidateZones.features.length; j += 1) {
      const overlap = intersect(featureCollection([
        result.map.ygCandidateZones.features[i], result.map.ygCandidateZones.features[j]
      ]));
      assert.ok(!overlap || area(overlap) / 10000 < 0.01, "YG zones must not overlap");
    }
  }

  const regulationIds = new Set(result.regulationRegister.map(row => row.id));
  const analysisIds = new Set(result.mandatoryAnalysisMatrix.map(row => row.id));
  const gateIds = new Set(result.crossCuttingGates.map(row => row.id));
  const geometryIds = new Set(result.geometryRegistry.map(row => row.id));
  const objectsWithRegulationRefs = [
    ...result.planningWorkflow,
    ...result.crossCuttingGates,
    ...result.mandatoryAnalysisMatrix,
    result.ygPlan.planningObjective,
    ...result.ygPlan.strategies,
    ...result.ygPlan.programs.items,
    ...result.ygPlan.traceability,
    ...result.ygPlan.zoningRules.itbxMatrix
  ];
  assert.ok(objectsWithRegulationRefs.every(row =>
    row.regulationRefs.every(id => regulationIds.has(id))
  ));
  assert.ok(result.ygPlan.traceability.every(row =>
    row.analysisRefs.every(id => analysisIds.has(id))
  ));
  assert.ok(result.p0EvidenceBoard.items.every(row =>
    ["EV-O", "EV-I"].includes(row.evidenceClass) && row.analysisRefs.every(id => analysisIds.has(id)) &&
    row.gateRefs.every(id => gateIds.has(id)) && row.legalRole && row.finding && row.limitation && row.nextAction
  ));
  const evidenceIds = new Set(result.p0EvidenceBoard.items.map(row => row.id));
  assert.ok(result.consultationArgumentMatrix.items.every(row =>
    row.legalBasisRefs.every(id => regulationIds.has(id)) &&
    row.evidenceRefs.every(id => evidenceIds.has(id))
  ));
  assert.ok(result.completenessAudit.items.every(row => row.regulationRefs.every(id => regulationIds.has(id))));
  assert.ok(result.policyMapFramework.layers.every(row =>
    row.regulationRefs.every(id => regulationIds.has(id)) &&
    row.analysisRefs.every(id => analysisIds.has(id)) && geometryIds.has(row.sourceRef) &&
    row.featureCount >= 1 && row.grossAreaHa > 0 && row.policyDirection && row.promotionRequirements.length
  ));
});
