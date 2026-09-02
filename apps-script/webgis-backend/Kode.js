const SPREADSHEET_ID = '1iCjtHWn-31IhkjgmEhJdMFnxvSNMYVcCfP5Prb37YU8';
const SHEET_NAME = 'Laporan Masuk';
const UPLOAD_FOLDER_ID = '1R8N0lsMQmzThOBDnJpq1ZmQ2TFP8xhGK';
const ADMIN_EMAIL = 'mulyadi@yayasangambut.org';
const NOTIFICATION_EMAILS = [
  ADMIN_EMAIL,
  'zamharier@yayasangambut.org'
];
const ADMIN_TOKEN_PROPERTY = 'YG_ADMIN_TOKEN';
const OFFICIAL_EMAIL_DOMAIN = 'yayasangambut.org';
const PREPOST_SESSION_SHEET = 'TEST_SESSIONS';
const PREPOST_QUESTION_SHEET = 'TEST_QUESTIONS';
const PREPOST_RESPONSE_SHEET = 'TEST_RESPONSES';

function getAdminToken_() {
  return String(
    PropertiesService.getScriptProperties().getProperty(ADMIN_TOKEN_PROPERTY) || ''
  ).trim();
}

function isAdminToken_(value) {
  const expected = getAdminToken_();
  return Boolean(expected) && String(value || '') === expected;
}

function setAdminTokenFromSecureExecution(token) {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may rotate the admin token.');
  }
  const value = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) {
    throw new Error('Admin token must be 43-128 URL-safe characters.');
  }
  PropertiesService.getScriptProperties().setProperty(ADMIN_TOKEN_PROPERTY, value);
  return { ok: true, property: ADMIN_TOKEN_PROPERTY, rotatedAt: new Date().toISOString() };
}

function emailAdminDashboardAccessLinksFromSecureExecution() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may send admin access links.');
  }

  const token = getAdminToken_();
  if (!token) {
    throw new Error('Admin token is not configured.');
  }

  const adminUrl =
    ScriptApp.getService().getUrl() +
    '?page=admin&token=' +
    encodeURIComponent(token);

  MailApp.sendEmail(
    NOTIFICATION_EMAILS.join(','),
    '[YG GeoPortal] Tautan Dashboard Verifikasi',
    [
      'Tautan akses Dashboard Verifikasi YG GeoPortal telah diperbarui.',
      '',
      'Buka Dashboard Verifikasi:',
      adminUrl,
      '',
      'Jangan meneruskan tautan ini kepada pihak di luar administrator YG.'
    ].join('\n')
  );

  return {
    ok: true,
    recipientCount: NOTIFICATION_EMAILS.length,
    sentAt: new Date().toISOString()
  };
}

function rotateAdminTokenAndEmailAccessLinksFromSecureExecution() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may rotate admin access.');
  }

  const token = (
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '')
  );
  setAdminTokenFromSecureExecution(token);
  const delivery = emailAdminDashboardAccessLinksFromSecureExecution();

  return {
    ok: true,
    recipientCount: delivery.recipientCount,
    rotatedAt: new Date().toISOString()
  };
}

function migratePermanentMeasurementPlotsFromSecureExecution() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may migrate PUP reports.');
  }

  const reportIds = [
    'YG-20260713-165850-288',
    'YG-20260820-190119-864'
  ];
  const layerId = 'permanent_measurement_plots';
  const layerLabel = 'Petak Ukur Permanen';
  const sheet = getSheet_();
  if (!sheet) throw new Error('Sheet laporan tidak ditemukan.');

  const migrated = [];
  reportIds.forEach(function(reportId) {
    const rowNumber = findReportRowById_(sheet, reportId);
    if (!rowNumber) throw new Error('Laporan tidak ditemukan: ' + reportId);
    if (clean_(sheet.getRange(rowNumber, 22).getDisplayValue()) !== 'Sudah Dipublikasikan') {
      throw new Error('Laporan belum dipublikasikan: ' + reportId);
    }

    let targetProperties = {};
    let proposedChanges = {};
    try {
      targetProperties = JSON.parse(sheet.getRange(rowNumber, 31).getDisplayValue() || '{}');
    } catch (error) {}
    try {
      proposedChanges = JSON.parse(sheet.getRange(rowNumber, 32).getDisplayValue() || '{}');
    } catch (error) {}

    targetProperties.Layer_Tujuan = layerId;
    targetProperties.Layer_Label = layerLabel;
    targetProperties.Kategori = layerLabel;
    proposedChanges.targetLayerId = layerId;
    proposedChanges.targetLayerLabel = layerLabel;

    sheet.getRange(rowNumber, 29).setValue(layerId);
    sheet.getRange(rowNumber, 30).setValue(layerLabel);
    sheet.getRange(rowNumber, 31).setValue(JSON.stringify(targetProperties));
    sheet.getRange(rowNumber, 32).setValue(JSON.stringify(proposedChanges));
    migrated.push(reportId);
  });

  SpreadsheetApp.flush();
  const syncResult = syncPublishedCommunityReportsToObjects();
  notifyCloudflarePublication_('PUP-LAYER-MIGRATION');

  return {
    ok: true,
    layerId: layerId,
    layerLabel: layerLabel,
    migrated: migrated,
    sync: syncResult
  };
}

/**
 * One-time repair for the verified Tanjung Kuras planting polygon. The value
 * comes from planting report YG-20260725-135142-186 and belongs specifically
 * to polygon report YG-20260829-144847-315, not to the separate Phase III
 * programme target of 4,000 seedlings.
 */
function repairTanjungKurasPlantingCountFromSecureExecution() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may repair report data.');
  }

  const reportId = 'YG-20260829-144847-315';
  const sheet = getSheet_();
  if (!sheet) throw new Error('Sheet laporan tidak ditemukan.');

  const rowNumber = findReportRowById_(sheet, reportId);
  if (!rowNumber) throw new Error('Laporan tidak ditemukan: ' + reportId);
  if (clean_(sheet.getRange(rowNumber, 22).getDisplayValue()) !== 'Sudah Dipublikasikan') {
    throw new Error('Laporan belum dipublikasikan: ' + reportId);
  }

  let targetProperties = {};
  try {
    targetProperties = JSON.parse(
      sheet.getRange(rowNumber, 31).getDisplayValue() || '{}'
    );
  } catch (error) {
    targetProperties = {};
  }

  targetProperties = applyPublishedReportDataCorrections_(
    reportId,
    targetProperties
  );
  sheet.getRange(rowNumber, 31).setValue(JSON.stringify(targetProperties));
  SpreadsheetApp.flush();

  const syncResult = syncPublishedCommunityReportsToObjects();
  const publicationResult = notifyCloudflarePublication_(reportId);

  return {
    ok: true,
    reportId: reportId,
    sourcePlantingReportId: 'YG-20260725-135142-186',
    plantedCount: 200,
    areaHa: 0.088,
    sync: syncResult,
    publication: publicationResult
  };
}

/*
  Struktur kolom:
  A  ID Laporan
  B  Jenis Laporan
  C  Tanggal Masuk
  D  Nama Pelapor
  E  Instansi/Kelompok
  F  Email
  G  Nomor HP
  H  Provinsi
  I  Kabupaten
  J  Kecamatan
  K  Desa
  L  Judul
  M  Deskripsi
  N  Tanggal Kegiatan
  O  Latitude
  P  Longitude
  Q  Nama Lokasi/Objek
  R  Informasi Lama
  S  Informasi Usulan
  T  Tautan Foto
  U  Tautan Dokumen
  V  Status
  W  Catatan Admin
  X  Diverifikasi Oleh
  Y  Tanggal Verifikasi
  Z  Tanggal Publikasi
  AA Jenis Geometri
  AB Geometry GeoJSON
  AC Target Layer ID
  AD Target Layer Label
  AE Target Feature Properties
  AF Proposed Changes JSON
*/

function getServiceHealth_() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const uploadFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
    return {
      ok: Boolean(spreadsheet.getId()) && Boolean(uploadFolder.getId()),
      service: 'YG GeoPortal Reporting API',
      version: '2.1-stack-health',
      dependencies: { spreadsheet: true, drive: true },
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error({ event: 'service_health_failed', message: error.message });
    return {
      ok: false,
      service: 'YG GeoPortal Reporting API',
      version: '2.1-stack-health',
      dependencies: { spreadsheet: false, drive: false },
      checkedAt: new Date().toISOString()
    };
  }
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page || '';
  const token = params.token || '';
  const callback = params.callback || '';
  if (page === 'health') {
    return jsonOrJsonpResponse_(getServiceHealth_(), callback);
  }
  if (page === 'public-content') {
    return contentAdminResponse_(getPublicContent_(), callback);
  }

if (page === 'content-save-result') {
  return contentAdminResponse_(
    getContentSaveResult_(params.requestId),
    callback
  );
}

if (page === 'donor-programmes') {
  return donorAdminResponse_(
    getDonorProgrammeAdminData_(params.sessionToken),
    callback
  );
}

if (page === 'donor-admin-result') {
  return donorAdminResponse_(
    getDonorAdminResult_(params.requestId, params.sessionToken),
    callback
  );
}

if (page === 'ps-inbox') {
  return donorAdminResponse_(getSocialForestryInbox_(params.sessionToken), callback);
}

if (page === 'staff-reports') {
  return donorAdminResponse_(getStaffReportInbox_(params.sessionToken), callback);
}

if (page === 'report-submission-status') {
  return jsonOrJsonpResponse_(
    getReportSubmissionStatus_(params.clientSubmissionId),
    callback
  );
}

  if (page === 'admin') {
    if (!isAdminToken_(token)) {
      return HtmlService.createHtmlOutput(
        '<h2 style="font-family:Arial;color:#b42318">Akses ditolak</h2>'
      );
    }

    const template = HtmlService.createTemplateFromFile('Admin');
    template.adminToken = token;

    return template.evaluate()
      .setTitle('Dashboard Verifikasi YG GeoPortal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === 'edit-object') {
    const template = HtmlService.createTemplateFromFile('EditObject');
    template.reportId = clean_(params.reportId);

    return template.evaluate()
      .setTitle('Perbaiki Objek Monitoring YG GeoPortal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === 'object-admin') {
    if (!isAdminToken_(token)) {
      return HtmlService.createHtmlOutput(
        '<h2 style="font-family:Arial;color:#b42318">Akses ditolak</h2>'
      );
    }

    const template = HtmlService.createTemplateFromFile('ObjectManagerDB');
    template.adminToken = token;

    return template.evaluate()
      .setTitle('Master Object Manager YG')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === 'editor-auth-result') {
    const result = getEditorAuthResult_(params.requestId || '');
    const json = JSON.stringify(result);

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'objects') {
    const result = getObjectsFeatureCollection_();
    const json = JSON.stringify(result);

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'duplicate-candidates') {
    return jsonOrJsonpResponse_(
      getPendingDuplicateCandidates_(params.layerId),
      callback
    );
  }

  if (page === 'dashboard-summary') {
    const result = getDashboardSummaryV2_();
    const json = JSON.stringify(result);

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'public-updates') {
    const result = getPublishedUpdates_();
    const json = JSON.stringify(result);

    if (
      callback &&
      /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)
    ) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'public-reports') {
    const result = getPublishedReports_();
    const json = JSON.stringify(result);

    if (
      callback &&
      /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)
    ) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'prepost-sessions') {
    return jsonOrJsonpResponse_(
      getPrepostSessions_(params),
      callback
    );
  }

  if (page === 'prepost-session-detail') {
    return jsonOrJsonpResponse_(
      getPrepostSessionDetail_(params.sessionId, params.sessionToken),
      callback
    );
  }

  if (page === 'prepost-questionnaire') {
    return jsonOrJsonpResponse_(
      getPrepostQuestionnaire_(params.sessionId),
      callback
    );
  }

  if (page === 'prepost-live-summary') {
    return jsonOrJsonpResponse_(
      getPrepostLiveSummary_(params),
      callback
    );
  }

  if (page === 'prepost-session-responses') {
    return jsonOrJsonpResponse_(
      getPrepostSessionResponses_(params.sessionId, params.phase, params.sessionToken),
      callback
    );
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'YG GeoPortal Reporting API',
      version: '2.0-validation'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let clientSubmissionId = '';
  try {
    const action = clean_(
      e && e.parameter
        ? e.parameter.action
        : ''
    );
if (action === 'content-save') {
  return handleContentAdminPost_(e);
}
    if (action === 'data-request') {
      return handleDataRequestPost_(e);
    }
    if (
      action === 'donor-programme-save' ||
      action === 'donor-evidence-save' ||
      action === 'donor-evidence-delete' ||
      action === 'donor-assignment-save' ||
      action === 'donor-assignment-delete'
    ) {
      return handleDonorProgrammeAdminPost_(e);
    }
    if (action === 'ps-inbox-review') {
      return handleSocialForestryInboxPost_(e);
    }
    if (
      action === 'editor-login' ||
      action === 'editor-logout' ||
      action === 'staff-register' ||
      action === 'staff-activate' ||
      action === 'staff-password-reset-request' ||
      action === 'staff-password-reset'
    ) {
      return handleEditorAuthPost_(e);
    }

    if (action === 'update-master-object') {
      return handleMasterObjectEditorPost_(e);
    }

    if (action === 'prepost-create-session') {
      return handlePrepostCreateSessionPost_(e);
    }

    if (action === 'prepost-update-session') {
      return handlePrepostUpdateSessionPost_(e);
    }

    if (action === 'prepost-create-question') {
      return handlePrepostCreateQuestionPost_(e);
    }

    if (action === 'prepost-update-question') {
      return handlePrepostUpdateQuestionPost_(e);
    }

    if (action === 'prepost-submit-response') {
      return handlePrepostSubmitResponsePost_(e);
    }

    if (
  e &&
  e.parameter &&
  e.parameter.action === 'github-update'
) {
  try {
    return handleGitHubSyncPost_(e);
  } catch (error) {
    return githubSyncErrorResponse_(error);
  }
}

    if (!e || !e.parameter || !e.parameter.payload) {
      throw new Error('Payload laporan tidak ditemukan.');
    }

    const data = JSON.parse(e.parameter.payload);
    clientSubmissionId = clean_(data.clientSubmissionId);
    validateIncomingPayload_(data);

    // Normalisasi metadata tambahan agar frontend lama/baru tetap kompatibel.
    const normalizedTargetFeatureProperties =
      buildTargetFeaturePropertiesForStorage_(data);

    const geometry = parseGeometry_(data.geometryGeoJSON);
    validateGeometryForIncomingReport_(data.reportType, geometry);

    let latitude = parseCoordinate_(data.latitude, 'latitude');
    let longitude = parseCoordinate_(data.longitude, 'longitude');

    if (geometry && geometry.type === 'Point') {
      longitude = Number(geometry.coordinates[0]);
      latitude = Number(geometry.coordinates[1]);
    }

    const sheet = getOrCreateSheet_();
    ensureExtendedColumns_(sheet);
    const serverDuplicate = findNearbyPendingDuplicate_(
      sheet,
      data.reportType,
      data.targetLayerId,
      geometry,
      25
    );
    if (serverDuplicate) {
      data.serverDuplicateWarning = serverDuplicate;
    }
    const normalizedProposedChanges =
      buildStoredProposedChanges_(data);

    const reportId = createReportId_();
    const photoUrls = saveImages_(data.images || [], reportId);
    const uploadedDocumentUrls = saveCapacityDocuments_(
      data.documents || [],
      reportId
    );

    const documentUrls = mergeDocumentUrls_(
      data.documentUrl,
      uploadedDocumentUrls
    );
    sheet.appendRow([
      reportId,
      clean_(data.reportType),
      new Date(),
      clean_(data.name),
      clean_(data.organization),
      clean_(data.email),
      clean_(data.phone),
      clean_(data.province || 'Riau'),
      clean_(data.regency),
      clean_(data.district),
      clean_(data.village),
      clean_(data.title),
      clean_(data.description),
      parseDate_(data.activityDate),
      Number.isFinite(latitude) ? latitude : '',
      Number.isFinite(longitude) ? longitude : '',
      clean_(data.locationName),
      clean_(data.oldInformation),
      clean_(data.proposedInformation),
      photoUrls.join('\n'),
      documentUrls.join('\n'),
      'Menunggu Verifikasi',
      '',
      '',
      '',
      '',
      geometry ? geometry.type : '',
      geometry ? JSON.stringify(geometry) : '',
      clean_(data.targetLayerId),
      clean_(data.targetLayerLabel),
      normalizedTargetFeatureProperties,
      normalizedProposedChanges
    ]);

    const row = sheet.getLastRow();
    sheet.getRange(row, 1, 1, 32)
      .setVerticalAlignment('top')
      .setWrap(true);

    sheet.getRange(row, 22).setBackground('#fff4cc');

    if (Number.isFinite(latitude)) {
      sheet.getRange(row, 15).setNumberFormat('0.0000000');
    }

    if (Number.isFinite(longitude)) {
      sheet.getRange(row, 16).setNumberFormat('0.0000000');
    }

    let emailSent = true;
    let emailError = '';
    try {
      notifyAdmin_(reportId, data, photoUrls, geometry);
    } catch (notificationError) {
      emailSent = false;
      emailError = clean_(notificationError.message);
      console.error(
        'Laporan ' + reportId +
        ' tersimpan, tetapi notifikasi email gagal: ' + emailError
      );
    }

    const submissionResult = {
      ok: true,
      reportId: reportId,
      emailSent: emailSent,
      message: emailSent
        ? 'Laporan berhasil disimpan dan notifikasi email dikirim.'
        : 'Laporan berhasil disimpan, tetapi notifikasi email gagal.',
      emailError: emailError
    };
    storeReportSubmissionStatus_(clientSubmissionId, submissionResult);
    return reportSubmissionResponse_(submissionResult);
  } catch (error) {
    console.error('Pengiriman laporan gagal: ' + error.stack);
    const submissionError = {
      ok: false,
      reportId: '',
      emailSent: false,
      message: clean_(error.message) || 'Laporan gagal disimpan.'
    };
    storeReportSubmissionStatus_(clientSubmissionId, submissionError);
    return reportSubmissionResponse_(submissionError);
  }
}

const DATA_REQUEST_SHEET = 'DATA_REQUESTS';

function handleDataRequestPost_(e) {
  const raw = e && e.parameter ? e.parameter.payload : '';
  if (!raw) throw new Error('Payload permintaan data tidak ditemukan.');
  const data = JSON.parse(raw);
  const required = ['dataset', 'scopeLevel', 'scopeName', 'accessType', 'name',
    'email', 'organization', 'purposeType', 'purpose'];
  required.forEach(function(key) {
    if (!clean_(data[key])) throw new Error('Kolom wajib belum lengkap: ' + key);
  });
  const email = clean_(data.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Alamat email tidak valid.');
  }
  if (clean_(data.termsAccepted) !== 'yes') {
    throw new Error('Ketentuan penggunaan harus disetujui.');
  }
  if (clean_(data.purpose).length < 30) {
    throw new Error('Tujuan penggunaan perlu dijelaskan sedikitnya 30 karakter.');
  }
  const cache = CacheService.getScriptCache();
  const rateKey = 'data-request:' + Utilities.base64EncodeWebSafe(email).slice(0, 80);
  if (cache.get(rateKey)) throw new Error('Permintaan baru saja dikirim. Tunggu satu menit sebelum mencoba lagi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let requestId;
  try {
    const sheet = getOrCreateDataRequestSheet_();
    const now = new Date();
    const datePart = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd');
    const sequence = String(Math.max(1, sheet.getLastRow())).padStart(4, '0');
    requestId = 'YG-DATA-' + datePart + '-' + sequence;
    const automatic = clean_(data.accessType) === 'summary';
    sheet.appendRow([
      requestId, now, clean_(data.name), clean_(data.organization), email,
      clean_(data.dataset), clean_(data.scopeLevel), clean_(data.scopeName),
      clean_(data.accessType), clean_(data.purposeType), clean_(data.purpose),
      automatic ? 'Automatic summary' : 'Pending review',
      clean_(data.sourcePage), 'YG GeoPortal', '', ''
    ]);
    cache.put(rateKey, '1', 60);
    notifyDataRequest_(requestId, data, automatic);
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      requestId: requestId,
      accessStatus: automatic ? 'automatic' : 'review',
      message: automatic ? 'Ringkasan tersedia.' : 'Permintaan menunggu peninjauan YG.'
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateDataRequestSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(DATA_REQUEST_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(DATA_REQUEST_SHEET);
  const headers = ['Request ID', 'Submitted At', 'Name', 'Organization', 'Email',
    'Dataset', 'Scope Level', 'Scope Name', 'Access Type', 'Purpose Type',
    'Purpose', 'Status', 'Source Page', 'Channel', 'Admin Notes', 'Completed At'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notifyDataRequest_(requestId, data, automatic) {
  const subject = '[YG Data] ' + requestId + ' · ' + clean_(data.dataset);
  const body = [
    'Permintaan data baru tercatat.', '',
    'Nomor: ' + requestId,
    'Pemohon: ' + clean_(data.name),
    'Organisasi: ' + clean_(data.organization),
    'Email: ' + clean_(data.email),
    'Data: ' + clean_(data.dataset),
    'Cakupan: ' + clean_(data.scopeLevel) + ' · ' + clean_(data.scopeName),
    'Akses: ' + clean_(data.accessType),
    'Status: ' + (automatic ? 'Ringkasan otomatis' : 'Menunggu peninjauan'),
    'Tujuan: ' + clean_(data.purposeType), '', clean_(data.purpose)
  ].join('\n');
  MailApp.sendEmail({to: NOTIFICATION_EMAILS.join(','), subject: subject, body: body});
}

function reportSubmissionResponse_(result) {
  const payload = {
    type: 'yg-report-submission-result',
    ok: result.ok === true,
    reportId: clean_(result.reportId),
    emailSent: result.emailSent === true,
    message: clean_(result.message),
    emailError: clean_(result.emailError)
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const color = payload.ok ? '#076b9c' : '#b42318';
  const title = payload.ok
    ? 'Laporan berhasil diterima'
    : 'Laporan gagal dikirim';
  const detail = payload.ok
    ? 'ID laporan: <b>' + escapeHtml_(payload.reportId) + '</b>'
    : escapeHtml_(payload.message);

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<h2 style="font-family:Arial;color:' + color + '">' + title + '</h2>' +
    '<p style="font-family:Arial">' + detail + '</p>' +
    '<script>top.postMessage(' + json + ', "*");<\/script>' +
    '</body></html>'
  );
}

function reportSubmissionStatusKey_(clientSubmissionId) {
  const value = clean_(clientSubmissionId);
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(value)) return '';
  return 'REPORT_SUBMISSION_' + value;
}

function storeReportSubmissionStatus_(clientSubmissionId, result) {
  const key = reportSubmissionStatusKey_(clientSubmissionId);
  if (!key) return;
  CacheService.getScriptCache().put(
    key,
    JSON.stringify(Object.assign({
      type: 'yg-report-submission-result',
      confirmedAt: new Date().toISOString()
    }, result)),
    21600
  );
}

function getReportSubmissionStatus_(clientSubmissionId) {
  const key = reportSubmissionStatusKey_(clientSubmissionId);
  if (!key) return { pending: false, ok: false, message: 'ID pengiriman tidak valid.' };
  const raw = CacheService.getScriptCache().get(key);
  if (!raw) return { pending: true, clientSubmissionId: clean_(clientSubmissionId) };
  try {
    return Object.assign({ pending: false }, JSON.parse(raw));
  } catch (error) {
    return { pending: false, ok: false, message: 'Konfirmasi pengiriman tidak valid.' };
  }
}

function getPendingDuplicateCandidates_(requestedLayerId) {
  const layerId = clean_(requestedLayerId);
  const collection = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    features: []
  };

  if (!layerId) return collection;

  const sheet = getOrCreateSheet_();
  ensureExtendedColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return collection;

  const rows = sheet.getRange(2, 1, lastRow - 1, 32).getValues();
  const visibleStatuses = {
    'Menunggu Verifikasi': true,
    'Perlu Perbaikan': true,
    'Disetujui': true
  };

  rows.forEach(function(row) {
    if (clean_(row[1]) !== 'Titik Baru') return;
    if (!visibleStatuses[clean_(row[21])]) return;
    if (clean_(row[28]) !== layerId) return;

    let geometry = null;
    try {
      geometry = parseGeometry_(row[27]);
    } catch (error) {
      return;
    }
    if (!geometry || geometry.type !== 'Point') return;

    collection.features.push({
      type: 'Feature',
      geometry: geometry,
      properties: {
        Layer_ID: layerId,
        Layer_Label: clean_(row[29]),
        Nama_Objek: clean_(row[16]) || clean_(row[11]) || 'Titik baru',
        title: clean_(row[11]),
        status: clean_(row[21]),
        activityDate: formatPublicDate_(row[13]),
        submittedAt: formatPublicDate_(row[2])
      }
    });
  });

  return collection;
}

function findNearbyPendingDuplicate_(
  sheet,
  reportType,
  targetLayerId,
  geometry,
  radiusMeters
) {
  if (
    clean_(reportType) !== 'Titik Baru' ||
    !geometry ||
    geometry.type !== 'Point'
  ) {
    return null;
  }

  const layerId = clean_(targetLayerId);
  const longitude = Number(geometry.coordinates[0]);
  const latitude = Number(geometry.coordinates[1]);
  if (
    !layerId ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const rows = sheet.getRange(2, 1, lastRow - 1, 32).getValues();
  const activeStatuses = {
    'Menunggu Verifikasi': true,
    'Perlu Perbaikan': true,
    'Disetujui': true
  };
  let nearest = null;

  rows.forEach(function(row) {
    if (clean_(row[1]) !== 'Titik Baru') return;
    if (!activeStatuses[clean_(row[21])]) return;
    if (clean_(row[28]) !== layerId) return;

    let candidateGeometry = null;
    try {
      candidateGeometry = parseGeometry_(row[27]);
    } catch (error) {
      return;
    }
    if (!candidateGeometry || candidateGeometry.type !== 'Point') return;

    const candidateLongitude = Number(candidateGeometry.coordinates[0]);
    const candidateLatitude = Number(candidateGeometry.coordinates[1]);
    if (
      !Number.isFinite(candidateLatitude) ||
      !Number.isFinite(candidateLongitude)
    ) {
      return;
    }

    const distance = pointDistanceMeters_(
      latitude,
      longitude,
      candidateLatitude,
      candidateLongitude
    );
    if (distance > radiusMeters) return;
    if (!nearest || distance < nearest.distanceMeters) {
      nearest = {
        reportId: clean_(row[0]),
        objectName: clean_(row[16]) || clean_(row[11]) || 'Titik baru',
        status: clean_(row[21]),
        distanceMeters: Math.round(distance)
      };
    }
  });

  return nearest;
}

function pointDistanceMeters_(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRadians = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRadians;
  const dLng = (lng2 - lng1) * toRadians;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRadians) *
      Math.cos(lat2 * toRadians) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPublicDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : Utilities.formatDate(
        date,
        Session.getScriptTimeZone() || 'Asia/Jakarta',
        'yyyy-MM-dd'
      );
}

function getAdminDashboardData(token) {
  assertAdmin_(token);

  return buildReportDashboardData_();
}

function getStaffReportInbox_(sessionToken) {
  const staff = assertEditorCredential_(sessionToken);
  const data = buildReportDashboardData_();
  data.viewer = {
    username: clean_(staff.username),
    name: clean_(staff.name),
    role: clean_(staff.role)
  };
  return data;
}

function buildReportDashboardData_() {

  const targetLayerOptions = getAdminTargetLayerOptions_();

  const sheet = getSheet_();

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        revision: 0,
        published: 0
      },
      reports: [],
      targetLayerOptions: targetLayerOptions
    };
  }

  ensureExtendedColumns_(sheet);

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 32)
    .getDisplayValues();

  const reports = rows.map(function(row, index) {
    return {
      rowNumber: index + 2,
      id: row[0],
      reportType: row[1],
      receivedAt: row[2],
      name: row[3],
      organization: row[4],
      email: row[5],
      phone: row[6],
      province: row[7],
      regency: row[8],
      district: row[9],
      village: row[10],
      title: row[11],
      description: row[12],
      activityDate: row[13],
      latitude: row[14],
      longitude: row[15],
      locationName: row[16],
      oldInformation: row[17],
      proposedInformation: row[18],
      photos: row[19]
        ? row[19].split(/\r?\n/).filter(Boolean)
        : [],
      documentUrl: row[20],
      status: row[21],
      adminNote: row[22],
      verifiedBy: row[23],
      verifiedAt: row[24],
      publishedAt: row[25],
      geometryType: row[26],
      geometryGeoJSON: row[27],
      targetLayerId: row[28],
      targetLayerLabel: row[29],
      targetFeatureProperties: row[30],
      proposedChanges: row[31]
    };
  }).reverse();

  return {
    stats: {
      total: reports.length,
      pending: reports.filter(r => r.status === 'Menunggu Verifikasi').length,
      approved: reports.filter(r => r.status === 'Disetujui').length,
      rejected: reports.filter(r => r.status === 'Ditolak').length,
      revision: reports.filter(r => r.status === 'Perlu Perbaikan').length,
      published: reports.filter(r => r.status === 'Sudah Dipublikasikan').length
    },
    reports: reports,
    targetLayerOptions: targetLayerOptions
  };
}

function restoreTanjungKurasCapacityPublicationFromSecureExecution() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may repair report data.');
  }

  const reportId = 'YG-20260901-211328-989';
  const sheet = getSheet_();
  if (!sheet) throw new Error('Sheet laporan tidak ditemukan.');

  const rowNumber = findReportRowById_(sheet, reportId);
  if (!rowNumber) throw new Error('Laporan tidak ditemukan: ' + reportId);

  const reportType = clean_(sheet.getRange(rowNumber, 2).getDisplayValue());
  const publishedAt = sheet.getRange(rowNumber, 26).getValue();
  if (reportType !== 'Capacity Building') {
    throw new Error('Laporan bukan Capacity Building: ' + reportId);
  }
  if (!publishedAt) {
    throw new Error('Riwayat tanggal publikasi tidak ditemukan: ' + reportId);
  }

  sheet.getRange(rowNumber, 22)
    .setValue('Sudah Dipublikasikan')
    .setBackground('#dceeff');
  SpreadsheetApp.flush();

  const publicationResult = notifyCloudflarePublication_(reportId);
  return {
    ok: true,
    reportId: reportId,
    rowNumber: rowNumber,
    status: 'Sudah Dipublikasikan',
    publishedAt: publishedAt,
    publication: publicationResult
  };
}

function getAdminTargetLayerOptions_() {
  return [
    { id: 'area_mangrove', label: 'Area Penanaman Mangrove', types: ['Polygon', 'MultiPolygon'] },
    { id: 'mineral_land_restoration_area', label: 'Area Restorasi Lahan Mineral', types: ['Polygon', 'MultiPolygon'] },
    { id: 'permanent_measurement_plots', label: 'Petak Ukur Permanen', types: ['Polygon', 'MultiPolygon'] },
    { id: 'titik_penanaman', label: 'Titik Tanam Mangrove', types: ['Point', 'MultiPoint'] },
    { id: 'area_kopi', label: 'Wilayah Penanaman Kopi', types: ['Polygon', 'MultiPolygon'] },
    { id: 'area_agroforestry', label: 'Area Agroforestry', types: ['Polygon', 'MultiPolygon'] },
    { id: 'apo', label: 'Alat Pemecah Ombak (APO)', types: ['LineString', 'MultiLineString'] },
    { id: 'kopi', label: 'Titik Tanam Kopi', types: ['Point', 'MultiPoint'] },
    { id: 'nursery_mangrove', label: 'Rumah Pembibitan Mangrove', types: ['Point', 'MultiPoint'] },
    { id: 'nursery_coffee', label: 'Rumah Pembibitan Kopi', types: ['Point', 'MultiPoint'] },
    { id: 'fdrs', label: 'FDRS / Water Table', types: ['Point', 'MultiPoint'] },
    { id: 'sekat_kanal', label: 'Sekat Kanal', types: ['Point', 'MultiPoint'] },
    { id: 'kolam_ikan', label: 'Titik Kolam Ikan', types: ['Point', 'MultiPoint'] },
    { id: 'information_signs', label: 'Plang Informasi & Perlindungan', types: ['Point', 'MultiPoint'] },
    { id: 'supporting_infrastructure', label: 'Infrastruktur Pendukung', types: ['Point', 'MultiPoint'] },
    { id: 'lainnya', label: 'Titik Lainnya', types: ['Point', 'MultiPoint'] }
  ];
}

function updateReportStatus(token, rowNumber, newStatus, adminNote, targetLayerId, targetLayerLabel) {
  assertAdmin_(token);

  const allowedStatuses = [
    'Menunggu Verifikasi',
    'Perlu Perbaikan',
    'Disetujui',
    'Ditolak',
    'Sudah Dipublikasikan'
  ];

  if (allowedStatuses.indexOf(newStatus) === -1) {
    throw new Error('Status tidak valid.');
  }

  const sheet = getSheet_();

  if (!sheet) {
    throw new Error('Sheet laporan tidak ditemukan.');
  }

  ensureExtendedColumns_(sheet);

  rowNumber = Number(rowNumber);

  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2 ||
    rowNumber > sheet.getLastRow()
  ) {
    throw new Error('Baris laporan tidak valid.');
  }

  const currentStatus = clean_(
    sheet.getRange(rowNumber, 22).getDisplayValue()
  );
  if (
    currentStatus === 'Sudah Dipublikasikan' &&
    newStatus !== 'Sudah Dipublikasikan'
  ) {
    throw new Error(
      'Laporan sudah dipublikasikan dan tidak boleh diturunkan statusnya melalui aksi verifikasi biasa.'
    );
  }

  const reportType = clean_(sheet.getRange(rowNumber, 2).getDisplayValue());
  const isMonitoring = reportType === 'Monitoring';
  const requiresTargetLayer = (
    reportType === 'Titik Baru' ||
    reportType === 'Area/Poligon Baru' ||
    reportType === 'Kebakaran' ||
    reportType === 'Biodiversitas' ||
    reportType === 'Abrasi'
  );

  const nextTargetLayerId = clean_(targetLayerId);
  const nextTargetLayerLabel = clean_(targetLayerLabel);

  if (newStatus === 'Sudah Dipublikasikan') {
    if (!isMonitoring && requiresTargetLayer && !nextTargetLayerId) {
      throw new Error('Pilih layer target sebelum publikasi.');
    }
    if (!isMonitoring && nextTargetLayerId) {
      sheet.getRange(rowNumber, 29).setValue(nextTargetLayerId);
      sheet.getRange(rowNumber, 30).setValue(
        nextTargetLayerLabel || nextTargetLayerId
      );
    }
    validateReportForPublication_(sheet, rowNumber);
  } else if (!isMonitoring && nextTargetLayerId) {
    sheet.getRange(rowNumber, 29).setValue(nextTargetLayerId);
    sheet.getRange(rowNumber, 30).setValue(
      nextTargetLayerLabel || nextTargetLayerId
    );
  }

  const now = new Date();

  sheet.getRange(rowNumber, 22).setValue(newStatus);
  sheet.getRange(rowNumber, 23).setValue(clean_(adminNote));
  sheet.getRange(rowNumber, 24).setValue(ADMIN_EMAIL);
  sheet.getRange(rowNumber, 25).setValue(now);

  if (newStatus === 'Sudah Dipublikasikan') {
    sheet.getRange(rowNumber, 26).setValue(now);
  }

  const colors = {
    'Menunggu Verifikasi': '#fff4cc',
    'Perlu Perbaikan': '#ffe6bd',
    'Disetujui': '#dff4e7',
    'Ditolak': '#fde2e2',
    'Sudah Dipublikasikan': '#dceeff'
  };

  sheet.getRange(rowNumber, 22)
    .setBackground(colors[newStatus] || '#ffffff');

  const reportId = sheet.getRange(rowNumber, 1).getDisplayValue();
  let syncResult = null;
  let publicationResult = null;
  if (newStatus === 'Sudah Dipublikasikan') {
    SpreadsheetApp.flush();
    syncResult = syncPublishedCommunityReportsToObjects();
    publicationResult = notifyCloudflarePublication_(reportId);
  }

  return {
    ok: true,
    reportId: reportId,
    status: newStatus,
    sync: syncResult,
    publication: publicationResult
  };
}


function getReportForObjectEdit(token, reportId) {
  assertAdmin_(token);
  const sheet = getSheet_();
  if (!sheet) throw new Error('Sheet laporan tidak ditemukan.');
  ensureExtendedColumns_(sheet);

  const rowNumber = findReportRowById_(sheet, reportId);
  if (!rowNumber) throw new Error('ID laporan tidak ditemukan.');

  const row = sheet.getRange(rowNumber, 1, 1, 32).getDisplayValues()[0];
  let targetProperties = {};
  let storedChanges = {};
  try { targetProperties = row[30] ? JSON.parse(row[30]) : {}; } catch (error) {}
  try { storedChanges = row[31] ? JSON.parse(row[31]) : {}; } catch (error) {}

  return {
    reportId: row[0],
    reportType: row[1],
    title: row[11],
    locationName: row[16],
    province: row[7],
    regency: row[8],
    district: row[9],
    village: row[10],
    status: row[21],
    geometryType: row[26],
    geometry: parseGeometry_(row[27]),
    targetLayerId: row[28],
    targetLayerLabel: row[29],
    targetFeatureProperties: targetProperties,
    targetObjectId: clean_(storedChanges.targetObjectId),
    targetSourceType: clean_(storedChanges.targetSourceType)
  };
}

function updateReportObject(token, reportId, objectData) {
  assertAdmin_(token);
  if (!objectData || typeof objectData !== 'object') {
    throw new Error('Data objek baru tidak ditemukan.');
  }

  const geometry = parseGeometry_(objectData.geometry);
  if (!geometry) throw new Error('Geometri objek baru tidak valid.');

  const sheet = getSheet_();
  if (!sheet) throw new Error('Sheet laporan tidak ditemukan.');
  ensureExtendedColumns_(sheet);

  const rowNumber = findReportRowById_(sheet, reportId);
  if (!rowNumber) throw new Error('ID laporan tidak ditemukan.');

  const reportType = clean_(sheet.getRange(rowNumber, 2).getDisplayValue());
  if (reportType !== 'Monitoring') {
    throw new Error('Fitur ini hanya untuk laporan Monitoring.');
  }

  const properties =
    objectData.properties && typeof objectData.properties === 'object'
      ? objectData.properties : {};

  const province = firstProperty_(properties, [
    'province','provinsi','Provinsi','PROVINSI'
  ]) || clean_(objectData.province) || 'Riau';

  const regency = firstProperty_(properties, [
    'regency','kabupaten','Kabupaten','KABUPATEN','kab_kota','KAB_KOTA'
  ]) || clean_(objectData.regency);

  const district = firstProperty_(properties, [
    'district','kecamatan','Kecamatan','KECAMATAN'
  ]) || clean_(objectData.district);

  const village = firstProperty_(properties, [
    'village','desa','Desa','DESA','kelurahan','Kelurahan','DESA_KELURAHAN'
  ]) || clean_(objectData.village);

  const locationName =
    clean_(objectData.objectName) ||
    firstProperty_(properties, [
      'Nama_Objek','nama_objek','Nama','nama','Desa','desa',
      'Lokasi','lokasi','title'
    ]) ||
    clean_(objectData.layerLabel) ||
    'Objek monitoring';

  const objectId =
    clean_(objectData.objectId) ||
    createStableObjectId_(clean_(objectData.layerId), locationName, geometry);

  let storedChanges = {};
  try {
    const current = sheet.getRange(rowNumber, 32).getDisplayValue();
    storedChanges = current ? JSON.parse(current) : {};
  } catch (error) {}

  storedChanges.targetObjectId = objectId;
  storedChanges.targetSourceType =
    clean_(objectData.sourceType) || 'program_layer';
  storedChanges.targetLayerId = clean_(objectData.layerId);
  storedChanges.targetLayerLabel = clean_(objectData.layerLabel);
  storedChanges.targetObjectName = locationName;
  storedChanges.objectUpdatedAt = new Date().toISOString();
  storedChanges.objectUpdatedBy = ADMIN_EMAIL;

  sheet.getRange(rowNumber, 8).setValue(province);
  sheet.getRange(rowNumber, 9).setValue(regency);
  sheet.getRange(rowNumber, 10).setValue(district);
  sheet.getRange(rowNumber, 11).setValue(village);
  sheet.getRange(rowNumber, 17).setValue(locationName);
  sheet.getRange(rowNumber, 18).setValue(
    buildSelectedObjectInformation_(
      clean_(objectData.layerLabel),
      clean_(objectData.layerId),
      geometry,
      properties
    )
  );
  sheet.getRange(rowNumber, 27).setValue(geometry.type);
  sheet.getRange(rowNumber, 28).setValue(JSON.stringify(geometry));
  sheet.getRange(rowNumber, 29).setValue(clean_(objectData.layerId));
  sheet.getRange(rowNumber, 30).setValue(clean_(objectData.layerLabel));
  sheet.getRange(rowNumber, 31).setValue(JSON.stringify(properties));
  sheet.getRange(rowNumber, 32).setValue(JSON.stringify(storedChanges));

  if (geometry.type === 'Point') {
    sheet.getRange(rowNumber, 15).setValue(Number(geometry.coordinates[1]));
    sheet.getRange(rowNumber, 16).setValue(Number(geometry.coordinates[0]));
  } else {
    sheet.getRange(rowNumber, 15, 1, 2).clearContent();
  }

  sheet.getRange(rowNumber, 1, 1, 32)
    .setVerticalAlignment('top')
    .setWrap(true);

  SpreadsheetApp.flush();

  return {
    ok: true,
    reportId: reportId,
    objectId: objectId,
    objectName: locationName,
    geometryType: geometry.type
  };
}

function findReportRowById_(sheet, reportId) {
  const id = clean_(reportId);
  if (!id || sheet.getLastRow() < 2) return 0;

  const finder = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findNext();

  return finder ? finder.getRow() : 0;
}

function firstProperty_(properties, keys) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = properties[keys[index]];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function createStableObjectId_(layerId, objectName, geometry) {
  const raw = [
    clean_(layerId) || 'monitoring',
    clean_(objectName) || 'objek',
    JSON.stringify(geometry)
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );

  const hash = digest.slice(0, 8).map(function(value) {
    const byte = value < 0 ? value + 256 : value;
    return ('0' + byte.toString(16)).slice(-2);
  }).join('');

  return (clean_(layerId) || 'monitoring') + ':auto:' + hash;
}

function buildSelectedObjectInformation_(layerLabel, layerId, geometry, properties) {
  const lines = [
    'OBJEK WEBGIS YANG DIPILIH',
    'Layer: ' + (layerLabel || '-'),
    'Layer ID: ' + (layerId || '-'),
    'Jenis geometri: ' + (geometry ? geometry.type : '-'),
    '',
    'ATRIBUT OBJEK'
  ];

  Object.keys(properties || {}).forEach(function(key) {
    const value = properties[key];
    if (value === null || value === undefined || typeof value === 'object') return;
    lines.push(key + ': ' + String(value));
  });

  return lines.join('\n');
}

function buildStoredProposedChanges_(data) {
  let stored = {};
  try {
    stored = data.proposedChanges ? JSON.parse(data.proposedChanges) : {};
  } catch (error) {}

  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    stored = {};
  }

  if (clean_(data.targetObjectId)) {
    stored.targetObjectId = clean_(data.targetObjectId);
  }
  if (clean_(data.targetSourceType)) {
    stored.targetSourceType = clean_(data.targetSourceType);
  }
  if (clean_(data.targetLayerId)) {
    stored.targetLayerId = clean_(data.targetLayerId);
  }
  if (clean_(data.targetLayerLabel)) {
    stored.targetLayerLabel = clean_(data.targetLayerLabel);
  }
  if (clean_(data.locationName)) {
    stored.targetObjectName = clean_(data.locationName);
  }
  if (
    data.serverDuplicateWarning &&
    typeof data.serverDuplicateWarning === 'object'
  ) {
    stored.Potensi_Duplikat = {
      reportId: clean_(data.serverDuplicateWarning.reportId),
      objectName: clean_(data.serverDuplicateWarning.objectName),
      status: clean_(data.serverDuplicateWarning.status),
      distanceMeters: Number(
        data.serverDuplicateWarning.distanceMeters || 0
      )
    };
    stored.Duplikat_Dikonfirmasi_Pelapor =
      Boolean(data.duplicateCheckAcknowledged);
  }

  const normalizedEcosystemType = normalizeNewObjectEcosystemType_(
    data.newObjectEcosystem
  );
  if (normalizedEcosystemType) {
    stored.Kategori_Ekosistem = normalizedEcosystemType;
    stored.Jenis_Ekosistem = normalizedEcosystemType;
    stored.Program = mapEcosystemToProgramme_(normalizedEcosystemType);
  }

  const normalizedForestSeedlingCount = normalizeNonNegativeInteger_(
    data.forestSeedlingsCount
  );
  if (normalizedForestSeedlingCount !== '') {
    stored.Jumlah_Bibit_Hutan = normalizedForestSeedlingCount;
  }

  const normalizedForestSeedlingSpecies = clean_(data.forestSeedlingsSpecies);
  if (normalizedForestSeedlingSpecies) {
    stored.Jenis_Bibit_Hutan = normalizedForestSeedlingSpecies;
  }

  return JSON.stringify(stored);
}

function buildTargetFeaturePropertiesForStorage_(data) {
  let properties = {};

  try {
    properties = data && data.targetFeatureProperties
      ? JSON.parse(data.targetFeatureProperties)
      : {};
  } catch (error) {
    properties = {};
  }

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    properties = {};
  }

  const donor = clean_(data && data.donor);
  if (donor) {
    if (!clean_(properties.Donor)) properties.Donor = donor;
    if (!clean_(properties.Donor_Cluster)) properties.Donor_Cluster = donor;
    if (!clean_(properties.Nama_Donor)) properties.Nama_Donor = donor;
  }

  const normalizedEcosystemType = normalizeNewObjectEcosystemType_(
    data && data.newObjectEcosystem
  );
  if (normalizedEcosystemType) {
    if (!clean_(properties.Kategori_Ekosistem)) {
      properties.Kategori_Ekosistem = normalizedEcosystemType;
    }
    if (!clean_(properties.Jenis_Ekosistem)) {
      properties.Jenis_Ekosistem = normalizedEcosystemType;
    }
    if (!clean_(properties.Program)) {
      properties.Program = mapEcosystemToProgramme_(normalizedEcosystemType);
    }
  }

  const normalizedForestSeedlingCount = normalizeNonNegativeInteger_(
    data && data.forestSeedlingsCount
  );
  if (
    normalizedForestSeedlingCount !== '' &&
    normalizeNonNegativeInteger_(properties.Jumlah_Bibit_Hutan) === ''
  ) {
    properties.Jumlah_Bibit_Hutan = normalizedForestSeedlingCount;
  }

  const normalizedForestSeedlingSpecies = clean_(
    data && data.forestSeedlingsSpecies
  );
  if (normalizedForestSeedlingSpecies && !clean_(properties.Jenis_Bibit_Hutan)) {
    properties.Jenis_Bibit_Hutan = normalizedForestSeedlingSpecies;
  }

  return JSON.stringify(properties);
}

function normalizeNewObjectEcosystemType_(value) {
  const text = clean_(value).toLowerCase();
  if (!text) {
    return '';
  }

  if (text.indexOf('mangrove') !== -1) {
    return 'Mangrove';
  }

  if (text.indexOf('gambut') !== -1 || text.indexOf('peat') !== -1) {
    return 'Gambut';
  }

  if (text.indexOf('mineral') !== -1) {
    return 'Lahan Mineral';
  }

  return '';
}

function mapEcosystemToProgramme_(ecosystemType) {
  if (ecosystemType === 'Mangrove') {
    return 'Restorasi Mangrove';
  }
  if (ecosystemType === 'Gambut') {
    return 'Restorasi Gambut';
  }
  if (ecosystemType === 'Lahan Mineral') {
    return 'Restorasi Lahan Mineral';
  }
  return '';
}

function normalizeNonNegativeInteger_(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return '';
  }

  return Math.round(number);
}


function validateReportForPublication_(sheet, rowNumber) {
  const row = sheet
    .getRange(rowNumber, 1, 1, 32)
    .getDisplayValues()[0];

  const reportType = clean_(row[1]);if (reportType === 'Capacity Building') {
  return true;
}
  const latitude = parseCoordinate_(row[14], 'latitude');
  const longitude = parseCoordinate_(row[15], 'longitude');
  const geometry = parseGeometry_(row[27]);
  const oldInformation = clean_(row[17]);
  const proposedInformation = clean_(row[18]);
  const photoUrls = clean_(row[19]);
  const targetLayerId = clean_(row[28]);
  const targetFeatureProperties = clean_(row[30]);
  const proposedChanges = clean_(row[31]);

  if (reportType === 'Perbaikan Informasi') {
    if (!oldInformation || !proposedInformation || !proposedChanges) {
      throw new Error(
        'Perbaikan Informasi belum lengkap. Atribut baru dan catatan perbaikan wajib tersedia.'
      );
    }

    if (!geometry && !targetLayerId && !targetFeatureProperties) {
      throw new Error(
        'Perbaikan Informasi belum memiliki objek WebGIS yang dipilih.'
      );
    }

    return true;
  }

  if (reportType === 'Area/Poligon Baru') {
    if (
      !geometry ||
      ['Polygon', 'MultiPolygon'].indexOf(geometry.type) === -1
    ) {
      throw new Error(
        'Area Baru belum memiliki Polygon atau MultiPolygon yang valid.'
      );
    }

    return true;
  }

  if (reportType === 'Titik Baru') {
    requirePointLocation_(geometry, latitude, longitude);
    return true;
  }

  if (reportType === 'Kebakaran') {
    requirePointLocation_(geometry, latitude, longitude);
    return true;
  }

  if (reportType === 'Biodiversitas') {
    requireAnyGeometryOrPoint_(geometry, latitude, longitude);
    return true;
  }

  if (reportType === 'Abrasi') {
    requireAnyGeometryOrPoint_(geometry, latitude, longitude);
    return true;
  }

  if (reportType === 'Monitoring') {
    requireAnyGeometryOrPoint_(geometry, latitude, longitude);
    return true;
  }

  if (reportType === 'Tambah Foto Kegiatan') {
    if (!photoUrls) {
      throw new Error('Tambah Foto belum memiliki foto yang diunggah.');
    }

    if (!targetLayerId || !targetFeatureProperties || !geometry) {
      throw new Error(
        'Tambah Foto belum memiliki objek WebGIS yang dipilih.'
      );
    }

    return true;
  }

  if (reportType === 'Replanting/Penyulaman Mangrove') {
    const photos = photoUrls
      ? photoUrls.split(/\r?\n/).map(clean_).filter(Boolean)
      : [];

    if (photos.length < 2) {
      throw new Error(
        'Replanting belum memiliki dua foto BEFORE dan AFTER.'
      );
    }

    if (
      targetLayerId !== 'area_mangrove' ||
      !targetFeatureProperties ||
      !geometry
    ) {
      throw new Error(
        'Replanting belum terhubung ke objek Area Penanaman Mangrove.'
      );
    }

    let replanting = {};
    try {
      replanting = proposedInformation
        ? JSON.parse(proposedInformation)
        : {};
    } catch (error) {
      throw new Error('Data replanting tidak valid.');
    }

    if (
      Number(replanting.replantedCount) < 1 ||
      !clean_(replanting.species) ||
      Number(replanting.replantedAreaHa) <= 0 ||
      !clean_(replanting.reason) ||
      !clean_(replanting.notes)
    ) {
      throw new Error('Data replanting belum lengkap.');
    }

    return true;
  }

  requireAnyGeometryOrPoint_(geometry, latitude, longitude);

  if (reportType === 'Monitoring') {
    return true;
  }

  const effectiveGeometryType = geometry
    ? geometry.type
    : 'Point';

  validateTargetLayerCompatibility_(targetLayerId, effectiveGeometryType);
  return true;
}

function validateTargetLayerCompatibility_(targetLayerId, geometryType) {
  const layer = clean_(targetLayerId);
  const geom = clean_(geometryType);
  if (!layer || !geom) return;

  const pointLayers = {
    kopi: true,
    titik_penanaman: true,
    nursery_mangrove: true,
    nursery_coffee: true,
    fdrs: true,
    sekat_kanal: true,
    kolam_ikan: true,
    information_signs: true,
    supporting_infrastructure: true,
    lainnya: true
  };
  const lineLayers = {
    apo: true
  };
  const polygonLayers = {
    area_mangrove: true,
    mineral_land_restoration_area: true,
    area_kopi: true,
    desa_intervensi: true
  };

  if (pointLayers[layer] && ['Point', 'MultiPoint'].indexOf(geom) === -1) {
    throw new Error('Layer target ' + layer + ' hanya menerima geometri titik.');
  }

  if (lineLayers[layer] && ['LineString', 'MultiLineString'].indexOf(geom) === -1) {
    throw new Error('Layer target ' + layer + ' hanya menerima geometri garis.');
  }

  if (polygonLayers[layer] && ['Polygon', 'MultiPolygon'].indexOf(geom) === -1) {
    throw new Error('Layer target ' + layer + ' hanya menerima geometri area/poligon.');
  }
}

function requirePointLocation_(geometry, latitude, longitude) {
  if (geometry && geometry.type === 'Point') {
    return;
  }

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return;
  }

  throw new Error(
    'Laporan belum dapat dipublikasikan karena titik koordinat tidak valid.'
  );
}

function requireAnyGeometryOrPoint_(geometry, latitude, longitude) {
  if (geometry) {
    return;
  }

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return;
  }

  throw new Error(
    'Laporan belum memiliki geometri atau koordinat yang valid.'
  );
}

function getPublishedReports_() {
  const sheet = getSheet_();

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      type: 'FeatureCollection',
      generatedAt: new Date().toISOString(),
      featureCount: 0,
      skipped: [],
      features: []
    };
  }

  ensureExtendedColumns_(sheet);

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 32)
    .getDisplayValues();

  const features = [];
  const skipped = [];
  const capacitySessionSummaries = {};

  try {
    const sessions = allSessionRows_();
    const questions = allQuestionRows_();
    const responses = allResponseRows_();

    sessions.forEach(function(session) {
      if (!session.sessionId) return;
      capacitySessionSummaries[session.sessionId] = summarizeSession_(
        session,
        questions,
        responses
      );
    });
  } catch (error) {
    console.warn('Ringkasan sesi pelatihan tidak dapat disegarkan: ' + error.message);
  }

  rows.forEach(function(row, index) {
    if (row[21] !== 'Sudah Dipublikasikan') {
      return;
    }

    const reportType = clean_(row[1]);

    if (isMergedEvidenceReport_(row[0])) {
      return;
    }

    /*
      Perbaikan Informasi adalah usulan perubahan terhadap objek lama.
      Jangan dibuat sebagai titik/poligon publik baru.
    */
    if (
      reportType === 'Perbaikan Informasi' ||
      reportType === 'Tambah Foto Kegiatan'
    ) {
      return;
    }

    let geometry = parseGeometry_(row[27]);

    if (!geometry) {
      const latitude = parseCoordinate_(row[14], 'latitude');
      const longitude = parseCoordinate_(row[15], 'longitude');

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        geometry = {
          type: 'Point',
          coordinates: [longitude, latitude]
        };
      }
    }

    if (!geometry && reportType !== 'Capacity Building') {
  skipped.push({
    row: index + 2,
    id: row[0],
    reason: 'Geometri tidak valid'
  });
  return;
}

    let targetProperties = {};
    let storedChanges = {};
    let proposedInformation = row[18];

    try { targetProperties = row[30] ? JSON.parse(row[30]) : {}; } catch (error) {}
    try { storedChanges = row[31] ? JSON.parse(row[31]) : {}; } catch (error) {}

    if (reportType === 'Capacity Building' && proposedInformation) {
      try {
        const capacityInformation = JSON.parse(proposedInformation);
        const sessionId = clean_(capacityInformation.supportSessionId);

        if (sessionId && capacitySessionSummaries[sessionId]) {
          capacityInformation.supportTestSummary = capacitySessionSummaries[sessionId];
          proposedInformation = JSON.stringify(capacityInformation);
        }
      } catch (error) {
        console.warn(
          'Ringkasan post-test laporan ' + clean_(row[0]) +
          ' tidak dapat disegarkan: ' + error.message
        );
      }
    }

    features.push({
      type: 'Feature',
      geometry: geometry,
      properties: {
        reportId: row[0],
        reportType: row[1],
        receivedAt: row[2],
        reporterName: row[3],
        organization: row[4],
        province: row[7],
        regency: row[8],
        district: row[9],
        village: row[10],
        title: row[11],
        description: row[12],
        activityDate: row[13],
        locationName: row[16],
        proposedInformation: proposedInformation,
        photos: row[19]
          ? row[19].split(/\r?\n/).filter(Boolean)
          : [],
        documentUrl: row[20],
        status: row[21],
        verifiedBy: row[23],
        verifiedAt: row[24],
        publishedAt: row[25],
        geometryType: geometry ? geometry.type : '',
        targetLayerId: row[28],
        targetLayerLabel: row[29],
        targetFeatureProperties: targetProperties,
        targetObjectId:
          clean_(storedChanges.targetObjectId) ||
          createStableObjectId_(row[28], row[16] || row[11], geometry),
        targetObjectName:
          clean_(storedChanges.targetObjectName) || row[16] || row[11],
        targetSourceType:
          clean_(storedChanges.targetSourceType) || 'program_layer'
      }
    });
  });

  return {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    featureCount: features.length,
    skipped: skipped,
    features: features
  };
}



function getPublishedUpdates_() {
  const sheet = getSheet_();

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      type: 'FeatureCollection',
      generatedAt: new Date().toISOString(),
      updateCount: 0,
      featureCount: 0,
      updates: [],
      features: []
    };
  }

  ensureExtendedColumns_(sheet);

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 32)
    .getDisplayValues();

  const updates = [];
  const features = [];

  rows.forEach(function(row) {
    const reportType = clean_(row[1]);

    if (
      row[21] !== 'Sudah Dipublikasikan' ||
      ['Perbaikan Informasi', 'Tambah Foto Kegiatan']
        .indexOf(reportType) === -1
    ) {
      return;
    }

    let geometry = parseGeometry_(row[27]);

    if (!geometry) {
      const latitude = parseCoordinate_(row[14], 'latitude');
      const longitude = parseCoordinate_(row[15], 'longitude');

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        geometry = {
          type: 'Point',
          coordinates: [longitude, latitude]
        };
      }
    }

    let targetProperties = {};
    let proposedChanges = {};

    try {
      targetProperties = row[30] ? JSON.parse(row[30]) : {};
    } catch (error) {
      targetProperties = {};
    }

    try {
      proposedChanges = row[31] ? JSON.parse(row[31]) : {};
    } catch (error) {
      proposedChanges = {};
    }

    const photos = row[19]
      ? row[19].split(/\r?\n/).map(clean_).filter(Boolean)
      : [];

    const targetObjectName =
      clean_(proposedChanges.targetObjectName) ||
      clean_(row[16]) ||
      clean_(row[11]);

    const targetObjectId =
      clean_(proposedChanges.targetObjectId) ||
      createStableObjectId_(
        clean_(row[28]) || clean_(proposedChanges.targetLayerId),
        targetObjectName,
        geometry || {
          type: 'Point',
          coordinates: [
            parseCoordinate_(row[15], 'longitude') || 0,
            parseCoordinate_(row[14], 'latitude') || 0
          ]
        }
      );

    const update = {
      reportId: row[0],
      reportType: reportType,
      title: row[11],
      description: row[12],
      activityDate: row[13],
      locationName: row[16],
      targetObjectName: targetObjectName,
      note: row[18],
      photos: photos,
      targetLayerId:
        clean_(row[28]) || clean_(proposedChanges.targetLayerId),
      targetLayerLabel:
        clean_(row[29]) || clean_(proposedChanges.targetLayerLabel),
      targetFeatureProperties: targetProperties,
      proposedChanges: proposedChanges,
      targetObjectId: targetObjectId,
      targetSourceType:
        clean_(proposedChanges.targetSourceType) || 'program_layer',
      geometry: geometry,
      publishedAt: row[25],
      verifiedBy: row[23]
    };

    updates.push(update);

    features.push({
      type: 'Feature',
      geometry: geometry,
      properties: {
        reportId: update.reportId,
        reportType: update.reportType,
        title: update.title,
        description: update.description,
        activityDate: update.activityDate,
        locationName: update.locationName,
        targetObjectName: update.targetObjectName,
        note: update.note,
        photos: update.photos,
        targetLayerId: update.targetLayerId,
        targetLayerLabel: update.targetLayerLabel,
        targetFeatureProperties: update.targetFeatureProperties,
        proposedChanges: update.proposedChanges,
        targetObjectId: update.targetObjectId,
        targetSourceType: update.targetSourceType,
        publishedAt: update.publishedAt,
        verifiedBy: update.verifiedBy
      }
    });
  });

  return {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    updateCount: updates.length,
    featureCount: features.length,
    updates: updates,
    features: features
  };
}

function validateIncomingPayload_(data) {
  if (!data.name) {
    throw new Error('Nama pelapor wajib diisi.');
  }

  if (!data.reportType) {
    throw new Error('Jenis laporan wajib dipilih.');
  }

  if (!data.title) {
    throw new Error('Judul laporan wajib diisi.');
  }

  if (!data.description) {
    throw new Error('Deskripsi wajib diisi.');
  }

  if (data.reportType === 'Perbaikan Informasi') {
    if (
      !data.oldInformation ||
      !data.proposedInformation ||
      !data.proposedChanges ||
      !data.targetLayerId
    ) {
      throw new Error(
        'Objek lama, atribut baru, dan catatan perbaikan wajib diisi.'
      );
    }
  }

  if (
    data.reportType === 'Titik Baru' ||
    data.reportType === 'Area/Poligon Baru'
  ) {
    const ecosystemType = normalizeNewObjectEcosystemType_(
      data.newObjectEcosystem
    );
    if (!ecosystemType) {
      throw new Error(
        'Kategori ekosistem objek baru wajib dipilih (Mangrove/Gambut/Lahan Mineral).'
      );
    }
  }

  if (data.reportType === 'Tambah Foto Kegiatan') {
    if (!data.targetLayerId || !data.targetFeatureProperties) {
      throw new Error('Pilih objek WebGIS untuk penambahan foto.');
    }

    if (!data.images || !data.images.length) {
      throw new Error('Pilih minimal satu foto.');
    }
  }

  if (data.reportType === 'Replanting/Penyulaman Mangrove') {
    if (
      clean_(data.targetLayerId) !== 'area_mangrove' ||
      !clean_(data.targetObjectId) ||
      !clean_(data.targetFeatureProperties)
    ) {
      throw new Error(
        'Replanting wajib terhubung ke objek Area Penanaman Mangrove.'
      );
    }

    if (!clean_(data.activityDate)) {
      throw new Error('Tanggal kegiatan replanting wajib diisi.');
    }

    if (!data.images || data.images.length < 2) {
      throw new Error(
        'Replanting wajib memiliki minimal dua foto: BEFORE dan AFTER.'
      );
    }

    let replanting = {};
    try {
      replanting = JSON.parse(data.proposedInformation || '{}');
    } catch (error) {
      throw new Error('Data replanting tidak valid.');
    }

    if (
      Number(replanting.replantedCount) < 1 ||
      !clean_(replanting.species) ||
      Number(replanting.replantedAreaHa) <= 0 ||
      !clean_(replanting.reason) ||
      !clean_(replanting.notes)
    ) {
      throw new Error(
        'Jumlah bibit, jenis bibit, luas, penyebab, dan catatan replanting wajib diisi.'
      );
    }
  }
}

function validateGeometryForIncomingReport_(reportType, geometry) {
  if (reportType === 'Area/Poligon Baru') {
    if (
      !geometry ||
      ['Polygon', 'MultiPolygon'].indexOf(geometry.type) === -1
    ) {
      throw new Error(
        'Area Baru wajib memiliki Polygon atau MultiPolygon.'
      );
    }
  }

  if (
    ['Titik Baru', 'Kebakaran'].indexOf(reportType) !== -1 &&
    (!geometry || geometry.type !== 'Point')
  ) {
    throw new Error(
      'Jenis laporan ini wajib memiliki satu titik lokasi.'
    );
  }

  if (
    reportType === 'Perbaikan Informasi' &&
    !geometry &&
    !clean_(arguments[2])
  ) {
    /*
      Tidak melempar error di sini karena beberapa laporan lama
      mungkin menyimpan target di kolom metadata.
    */
  }
}

function parseGeometry_(value) {
  if (!value) {
    return null;
  }

  try {
    const geometry =
      typeof value === 'string'
        ? JSON.parse(value)
        : value;

    if (
      !geometry ||
      !geometry.type ||
      typeof geometry.coordinates === 'undefined'
    ) {
      return null;
    }

    const allowed = [
      'Point',
      'MultiPoint',
      'LineString',
      'MultiLineString',
      'Polygon',
      'MultiPolygon'
    ];

    if (allowed.indexOf(geometry.type) === -1) {
      return null;
    }

    return geometry;
  } catch (error) {
    return null;
  }
}

function parseCoordinate_(value, type) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return NaN;
  }

  let text = String(value)
    .trim()
    .replace(/\s+/g, '');

  if (!text) {
    return NaN;
  }

  text = text.replace(',', '.');

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return NaN;
  }

  if (
    type === 'latitude' &&
    number >= -90 &&
    number <= 90
  ) {
    return number;
  }

  if (
    type === 'longitude' &&
    number >= -180 &&
    number <= 180
  ) {
    return number;
  }

  return NaN;
}

function getOrCreateSheet_() {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  let sheet =
    spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    setupSheet_(sheet);
  }

  ensureExtendedColumns_(sheet);
  return sheet;
}

function getSheet_() {
  return SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SHEET_NAME);
}

function ensureExtendedColumns_(sheet) {
  const headers = [
    'Jenis Geometri',
    'Geometry GeoJSON',
    'Target Layer ID',
    'Target Layer Label',
    'Target Feature Properties',
    'Proposed Changes JSON'
  ];

  const startColumn = 27;

  if (sheet.getMaxColumns() < 32) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      32 - sheet.getMaxColumns()
    );
  }

  const currentHeaders =
    sheet.getRange(1, startColumn, 1, 6)
      .getDisplayValues()[0];

  headers.forEach(function(header, index) {
    if (!currentHeaders[index]) {
      sheet
        .getRange(1, startColumn + index)
        .setValue(header);
    }
  });

  sheet.getRange(1, startColumn, 1, 6)
    .setBackground('#076b9c')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

function setupSheet_(sheet) {
  const headers = [
    'ID Laporan',
    'Jenis Laporan',
    'Tanggal Masuk',
    'Nama Pelapor',
    'Instansi/Kelompok',
    'Email',
    'Nomor HP',
    'Provinsi',
    'Kabupaten',
    'Kecamatan',
    'Desa',
    'Judul Kegiatan',
    'Deskripsi',
    'Tanggal Kegiatan',
    'Latitude',
    'Longitude',
    'Nama Lokasi/Objek',
    'Informasi Lama',
    'Informasi Usulan',
    'Tautan Foto',
    'Tautan Dokumen',
    'Status',
    'Catatan Admin',
    'Diverifikasi Oleh',
    'Tanggal Verifikasi',
    'Tanggal Publikasi',
    'Jenis Geometri',
    'Geometry GeoJSON',
    'Target Layer ID',
    'Target Layer Label',
    'Target Feature Properties',
    'Proposed Changes JSON'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#076b9c')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);

  const statusRule =
    SpreadsheetApp.newDataValidation()
      .requireValueInList([
        'Menunggu Verifikasi',
        'Perlu Perbaikan',
        'Disetujui',
        'Ditolak',
        'Sudah Dipublikasikan'
      ], true)
      .setAllowInvalid(false)
      .build();

  sheet.getRange('V2:V')
    .setDataValidation(statusRule);
}

function saveImages_(images, reportId) {
  if (!images || !images.length) {
    return [];
  }

  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const reportFolder = rootFolder.createFolder(reportId);

  try {
    reportFolder.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );
  } catch (folderError) {
    console.warn(
      'Folder laporan tidak dapat dibuat publik: ' +
      folderError.message
    );
  }

  const urls = [];

  images.slice(0, 5).forEach(function(image, index) {
    if (!image || !image.dataUrl || !image.name) {
      return;
    }

    const parts = image.dataUrl.match(
      /^data:(.+);base64,(.+)$/
    );

    if (!parts) {
      return;
    }

    const safeName = String(image.name)
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const filename =
      String(index + 1).padStart(2, '0') +
      '_' +
      safeName;

    const blob = Utilities.newBlob(
      Utilities.base64Decode(parts[2]),
      parts[1],
      filename
    );

    const file = reportFolder.createFile(blob);

    try {
      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );
    } catch (fileError) {
      console.warn(
        'File tidak dapat dibuat publik: ' +
        file.getName() +
        ' - ' +
        fileError.message
      );
    }

    urls.push(file.getUrl());
  });

  return urls;
}

function notifyAdmin_(reportId, data, photoUrls, geometry) {
  const adminToken = getAdminToken_();
  if (!adminToken) {
    throw new Error('Admin token is not configured; notification link was not sent.');
  }

  const adminUrl =
    ScriptApp.getService().getUrl() +
    '?page=admin&token=' +
    encodeURIComponent(adminToken);

  const body = [
    'Laporan baru telah diterima.',
    '',
    'ID: ' + reportId,
    'Jenis: ' + clean_(data.reportType),
    'Pelapor: ' + clean_(data.name),
    'Judul: ' + clean_(data.title),
    'Target Layer: ' + clean_(data.targetLayerLabel),
    'Jenis Geometri: ' + (geometry ? geometry.type : 'Tidak ada'),
    'Jumlah Foto: ' + photoUrls.length,
    '',
    'Buka Dashboard Verifikasi:',
    adminUrl
  ].join('\n');

  MailApp.sendEmail(
    NOTIFICATION_EMAILS.join(','),
    '[YG GeoPortal] Laporan baru ' + reportId,
    body
  );
}

function createReportId_() {
  return (
    'YG-' +
    Utilities.formatDate(
      new Date(),
      'Asia/Jakarta',
      'yyyyMMdd-HHmmss'
    ) +
    '-' +
    Math.floor(100 + Math.random() * 900)
  );
}

function assertAdmin_(token) {
  if (!isAdminToken_(token)) {
    throw new Error('Akses admin tidak valid.');
  }
}

function parseDate_(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  return isNaN(date.getTime())
    ? value
    : date;
}

function normalizeDateTimeForApi_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = clean_(value);
  if (!raw) return '';

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function clean_(value) {
  return value === null ||
    value === undefined
      ? ''
      : String(value).trim();
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function makeExistingReportPhotosPublic() {
  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);

  let folderCount = 0;
  let fileCount = 0;
  const errors = [];

  const folders = rootFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();

    try {
      folder.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );
      folderCount += 1;
    } catch (folderError) {
      errors.push(
        'Folder ' +
        folder.getName() +
        ': ' +
        folderError.message
      );
    }

    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      try {
        file.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
        fileCount += 1;
      } catch (fileError) {
        errors.push(
          'File ' +
          file.getName() +
          ': ' +
          fileError.message
        );
      }
    }
  }

  const result = {
    ok: errors.length === 0,
    foldersUpdated: folderCount,
    filesUpdated: fileCount,
    errors: errors
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
function saveCapacityDocuments_(documents, reportId) {
  if (!documents || !documents.length) return [];

  const maxFiles = 6;
  const maxBytesPerFile = 25 * 1024 * 1024;
  const selected = documents.slice(0, maxFiles);

  if (documents.length > maxFiles) {
    throw new Error('Maksimal 6 materi pelatihan.');
  }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const reportFolder = getOrCreateReportFolder_(
    rootFolder,
    reportId
  );

  const urls = [];

  selected.forEach(function(document, index) {
    if (!document || !document.dataUrl) return;

    const size = Number(document.size) || 0;

    if (size > maxBytesPerFile) {
      throw new Error(
        'Ukuran materi ke-' +
        (index + 1) +
        ' melebihi 25 MB.'
      );
    }

    const match = String(document.dataUrl).match(
      /^data:([^;]+);base64,(.+)$/i
    );

    if (!match) {
      throw new Error(
        'Materi ke-' + (index + 1) + ' tidak valid.'
      );
    }

    const mimeType = clean_(match[1]).toLowerCase();

    if (allowedTypes.indexOf(mimeType) === -1) {
      throw new Error(
        'Materi hanya boleh berupa PDF, PPT, atau PPTX.'
      );
    }

    const originalName =
      document.name ||
      ('materi-' + (index + 1));

    const safeName = String(originalName)
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const filename =
      'materi_' +
      String(index + 1).padStart(2, '0') +
      '_' +
      safeName;

    const blob = Utilities.newBlob(
      Utilities.base64Decode(match[2]),
      mimeType,
      filename
    );

    if (blob.getBytes().length > maxBytesPerFile) {
      throw new Error(
        'Ukuran materi ke-' +
        (index + 1) +
        ' melebihi 25 MB.'
      );
    }

    const file = reportFolder.createFile(blob);

    try {
      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );
    } catch (error) {
      console.warn(
        'Materi tidak dapat dibuat publik: ' +
        file.getName()
      );
    }

    urls.push(file.getUrl());
  });

  return urls;
}

function getOrCreateReportFolder_(rootFolder, reportId) {
  const folders = rootFolder.getFoldersByName(reportId);

  const folder = folders.hasNext()
    ? folders.next()
    : rootFolder.createFolder(reportId);

  try {
    folder.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );
  } catch (error) {
    console.warn(
      'Folder tidak dapat dibuat publik: ' + reportId
    );
  }

  return folder;
}

function mergeDocumentUrls_(existingValue, uploadedUrls) {
  const values = [];
  const seen = {};

  String(existingValue || '')
    .split(/\r?\n|,/)
    .concat(uploadedUrls || [])
    .forEach(function(value) {
      const url = clean_(value);

      if (!url || seen[url]) return;

      seen[url] = true;
      values.push(url);
    });

  return values;
}

function jsonOrJsonpResponse_(result, callback) {
  const json = JSON.stringify(result);

  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function prepostResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function prepostErrorResponse_(message) {
  return prepostResponse_({
    ok: false,
    error: clean_(message) || 'Permintaan tidak valid.'
  });
}

function parsePostPayload_(e) {
  if (!e || !e.parameter || !e.parameter.payload) {
    throw new Error('Payload tidak ditemukan.');
  }
  return JSON.parse(e.parameter.payload);
}

function isOfficialEmail_(value) {
  const email = clean_(value).toLowerCase();
  return email.indexOf('@') > 0 &&
    email.endsWith('@' + OFFICIAL_EMAIL_DOMAIN);
}

function assertOfficialEmail_(value) {
  if (!isOfficialEmail_(value)) {
    throw new Error(
      'Akses dibatasi untuk email resmi Yayasan Gambut (' +
      OFFICIAL_EMAIL_DOMAIN + ').'
    );
  }
}

function getOrCreatePrepostSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, headers.length)
    .getDisplayValues()[0];

  headers.forEach(function(header, index) {
    if (clean_(currentHeaders[index]) !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#0a6f52')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);

  return sheet;
}

function getPrepostSessionSheet_() {
  return getOrCreatePrepostSheet_(PREPOST_SESSION_SHEET, [
    'Session ID',
    'Title',
    'Activity Date',
    'Location',
    'Village',
    'Facilitator',
    'Donor',
    'Target Participants',
    'Status',
    'Pre Form URL',
    'Post Form URL',
    'Pre QR URL',
    'Post QR URL',
    'Created By Email',
    'Created At',
    'Updated At'
  ]);
}

function getPrepostQuestionSheet_() {
  return getOrCreatePrepostSheet_(PREPOST_QUESTION_SHEET, [
    'Question ID',
    'Session ID',
    'Phase',
    'Question Text',
    'Question Type',
    'Options JSON',
    'Max Score',
    'Display Order',
    'Active',
    'Created By Email',
    'Created At',
    'Updated At'
  ]);
}

function getPrepostResponseSheet_() {
  return getOrCreatePrepostSheet_(PREPOST_RESPONSE_SHEET, [
    'Response ID',
    'Session ID',
    'Phase',
    'Participant Code',
    'Participant Name',
    'Participant Email',
    'Participant Gender',
    'Participant Age Category',
    'Participant Delegate',
    'Answers JSON',
    'Total Score',
    'Source Channel',
    'Submitted At'
  ]);
}

function createPrepostId_(prefix) {
  return (
    prefix + '-' +
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') +
    '-' +
    Math.floor(100 + Math.random() * 900)
  );
}

function prepostAppBaseUrl_() {
  return 'https://webgisyg.id/prepost-test.html';
}

function buildPrepostUrls_(sessionId) {
  const base = prepostAppBaseUrl_();
  const preUrl =
    base + '?session=' + encodeURIComponent(sessionId) + '&phase=pre';
  const postUrl =
    base + '?session=' + encodeURIComponent(sessionId) + '&phase=post';
  const logoUrl = 'https://raw.githubusercontent.com/mulyadibagan/yg-geoportal/main/assets/logo-yayasan-gambut-192.png';
  const qrBase = 'https://quickchart.io/qr?size=320&ecLevel=H&margin=2&centerImageUrl=' +
    encodeURIComponent(logoUrl) + '&text=';
  return {
    preFormUrl: preUrl,
    postFormUrl: postUrl,
    preQrUrl: qrBase + encodeURIComponent(preUrl),
    postQrUrl: qrBase + encodeURIComponent(postUrl)
  };
}

function parseSessionRow_(row) {
  const sessionId = clean_(row[0]);
  const generatedUrls = sessionId ? buildPrepostUrls_(sessionId) : {};
  return {
    sessionId: sessionId,
    title: clean_(row[1]),
    activityDate: clean_(row[2]),
    location: clean_(row[3]),
    village: clean_(row[4]),
    facilitator: clean_(row[5]),
    donor: clean_(row[6]),
    targetParticipants: Number(row[7]) || 0,
    status: clean_(row[8]) || 'active',
    preFormUrl: generatedUrls.preFormUrl || clean_(row[9]) || '',
    postFormUrl: generatedUrls.postFormUrl || clean_(row[10]) || '',
    preQrUrl: generatedUrls.preQrUrl || clean_(row[11]) || '',
    postQrUrl: generatedUrls.postQrUrl || clean_(row[12]) || '',
    createdByEmail: clean_(row[13]),
    createdAt: clean_(row[14]),
    updatedAt: clean_(row[15])
  };
}

function parseQuestionRow_(row) {
  let options = [];
  try {
    const parsed = row[5] ? JSON.parse(row[5]) : [];
    options = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    options = [];
  }

  return {
    questionId: clean_(row[0]),
    sessionId: clean_(row[1]),
    phase: clean_(row[2]).toLowerCase(),
    questionText: clean_(row[3]),
    questionType: clean_(row[4]) || 'single',
    options: options,
    maxScore: Number(row[6]) || 0,
    order: Number(row[7]) || 0,
    active: clean_(row[8]) !== 'false',
    createdByEmail: clean_(row[9]),
    createdAt: clean_(row[10]),
    updatedAt: clean_(row[11])
  };
}

function parseResponseRow_(row) {
  let participantGender = '';
  let participantAgeCategory = '';
  let participantDelegate = '';
  let answersIndex = 6;
  let totalScoreIndex = 7;
  let sourceIndex = 8;
  let submittedIndex = 9;

  if (row.length >= 13) {
    participantGender = clean_(row[6]);
    participantAgeCategory = clean_(row[7]);
    participantDelegate = clean_(row[8]);
    answersIndex = 9;
    totalScoreIndex = 10;
    sourceIndex = 11;
    submittedIndex = 12;
  }

  let answers = [];
  try {
    const parsed = row[answersIndex] ? JSON.parse(row[answersIndex]) : [];
    answers = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    answers = [];
  }

  return {
    responseId: clean_(row[0]),
    sessionId: clean_(row[1]),
    phase: clean_(row[2]).toLowerCase(),
    participantCode: clean_(row[3]),
    participantName: clean_(row[4]),
    participantEmail: clean_(row[5]),
    participantGender: participantGender,
    participantAgeCategory: participantAgeCategory,
    participantDelegate: participantDelegate,
    answers: answers,
    totalScore: Number(row[totalScoreIndex]) || 0,
    sourceChannel: clean_(row[sourceIndex]) || 'web',
    submittedAt: normalizeDateTimeForApi_(row[submittedIndex])
  };
}

function allSessionRows_() {
  const sheet = getPrepostSessionSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 16)
    .getDisplayValues()
    .map(parseSessionRow_)
    .filter(function(item) { return !!item.sessionId; });
}

function allQuestionRows_() {
  const sheet = getPrepostQuestionSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 12)
    .getDisplayValues()
    .map(parseQuestionRow_)
    .filter(function(item) { return !!item.questionId; });
}

function allResponseRows_() {
  const sheet = getPrepostResponseSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 13)
    .getValues()
    .map(parseResponseRow_)
    .filter(function(item) { return !!item.responseId; });
}

function responseCategoryBreakdown_(responses, key) {
  return responses.reduce(function(acc, item) {
    const label = clean_(item[key]);
    if (!label) return acc;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function summarizeSession_(session, questions, responses) {
  const sessionQuestions = questions.filter(function(item) {
    return item.sessionId === session.sessionId && item.active;
  });
  const sessionResponses = responses.filter(function(item) {
    return item.sessionId === session.sessionId;
  });

  const preResponses = sessionResponses.filter(function(item) {
    return item.phase === 'pre';
  });
  const postResponses = sessionResponses.filter(function(item) {
    return item.phase === 'post';
  });

  const preTotal = preResponses.reduce(function(total, item) {
    return total + Number(item.totalScore || 0);
  }, 0);
  const postTotal = postResponses.reduce(function(total, item) {
    return total + Number(item.totalScore || 0);
  }, 0);

  const preAvg = preResponses.length ? preTotal / preResponses.length : 0;
  const postAvg = postResponses.length ? postTotal / postResponses.length : 0;
  const gain = postAvg - preAvg;

  const preQuestionMax = sessionQuestions
    .filter(function(item) { return item.phase === 'pre'; })
    .reduce(function(total, item) { return total + Number(item.maxScore || 0); }, 0);
  const postQuestionMax = sessionQuestions
    .filter(function(item) { return item.phase === 'post'; })
    .reduce(function(total, item) { return total + Number(item.maxScore || 0); }, 0);

  const preQuestionCount = sessionQuestions
    .filter(function(item) { return item.phase === 'pre'; })
    .length;
  const postQuestionCount = sessionQuestions
    .filter(function(item) { return item.phase === 'post'; })
    .length;

  const preAvgPercent = preResponses.length && preQuestionCount > 0
    ? preResponses.reduce(function(total, item) {
      return total + ((Number(item.totalScore || 0) / preQuestionCount) * 100);
    }, 0) / preResponses.length
    : 0;

  const postAvgPercent = postResponses.length && postQuestionCount > 0
    ? postResponses.reduce(function(total, item) {
      return total + ((Number(item.totalScore || 0) / postQuestionCount) * 100);
    }, 0) / postResponses.length
    : 0;

  const completionRate = session.targetParticipants > 0
    ? (postResponses.length / session.targetParticipants) * 100
    : 0;

  return {
    preRespondents: preResponses.length,
    postRespondents: postResponses.length,
    preAvgScore: Number(preAvg.toFixed(2)),
    postAvgScore: Number(postAvg.toFixed(2)),
    gainScore: Number(gain.toFixed(2)),
    preAvgPercent: Number(preAvgPercent.toFixed(2)),
    postAvgPercent: Number(postAvgPercent.toFixed(2)),
    gainPercentPoint: Number((postAvgPercent - preAvgPercent).toFixed(2)),
    gainPercent: preAvg > 0
      ? Number((((postAvg - preAvg) / preAvg) * 100).toFixed(2))
      : 0,
    completionRate: Number(completionRate.toFixed(2)),
    preMaxScore: preQuestionMax,
    postMaxScore: postQuestionMax,
    questionCount: sessionQuestions.length,
    preQuestionCount: preQuestionCount,
    postQuestionCount: postQuestionCount,
    postDemographics: {
      gender: responseCategoryBreakdown_(postResponses, 'participantGender'),
      ageCategory: responseCategoryBreakdown_(postResponses, 'participantAgeCategory'),
      delegate: responseCategoryBreakdown_(postResponses, 'participantDelegate')
    }
  };
}

function getPrepostSessions_(params) {
  const status = clean_(params.status || '').toLowerCase();
  const query = clean_(params.q || '').toLowerCase();
  const sessions = allSessionRows_();
  const questions = allQuestionRows_();
  const responses = allResponseRows_();

  const rows = sessions
    .filter(function(item) {
      if (status && item.status.toLowerCase() !== status) return false;
      if (!query) return true;
      const hay = [
        item.title,
        item.location,
        item.village,
        item.facilitator,
        item.donor
      ].join(' ').toLowerCase();
      return hay.indexOf(query) !== -1;
    })
    .map(function(session) {
      return {
        session: session,
        summary: summarizeSession_(session, questions, responses)
      };
    })
    .sort(function(a, b) {
      return String(b.session.activityDate).localeCompare(String(a.session.activityDate));
    });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    count: rows.length,
    sessions: rows
  };
}

function getPrepostSessionDetail_(sessionId, sessionToken) {
  const id = clean_(sessionId);
  if (!id) {
    return { ok: false, error: 'Session ID wajib diisi.' };
  }

  const sessions = allSessionRows_();
  const session = sessions.find(function(item) {
    return item.sessionId === id;
  });

  if (!session) {
    return { ok: false, error: 'Sesi tidak ditemukan.' };
  }

  const questions = allQuestionRows_().filter(function(item) {
    return item.sessionId === id && item.active;
  }).sort(function(a, b) {
    return a.order - b.order;
  });

  const responses = allResponseRows_().filter(function(item) {
    return item.sessionId === id;
  });

  let staff = null;
  try { staff = assertEditorCredential_(sessionToken); } catch (error) {}
  const questionCount = {
    pre: questions.filter(function(item) { return item.phase === 'pre'; }).length,
    post: questions.filter(function(item) { return item.phase === 'post'; }).length,
    total: questions.length
  };

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    session: session,
    summary: summarizeSession_(session, questions, responses),
    questionCount: questionCount,
    authorized: Boolean(staff),
    questions: staff ? questions : []
  };
}

function getPrepostQuestionnaire_(sessionId) {
  const id = clean_(sessionId);
  if (!id) return { ok: false, error: 'Session ID wajib diisi.' };

  const session = allSessionRows_().find(function(item) { return item.sessionId === id; });
  if (!session) return { ok: false, error: 'Sesi tidak ditemukan.' };
  if (session.status !== 'active') return { ok: false, error: 'Sesi tidak aktif.' };

  const questions = allQuestionRows_().filter(function(item) {
    return item.sessionId === id && item.active;
  }).sort(function(a, b) { return a.order - b.order; }).map(function(item) {
    return {
      questionId: item.questionId,
      sessionId: item.sessionId,
      phase: item.phase,
      questionText: item.questionText,
      questionType: item.questionType,
      options: (item.options || []).map(function(option) {
        return { label: clean_(option.label || option.value), value: clean_(option.value || option.label) };
      }),
      order: item.order
    };
  });

  return { ok: true, session: session, questions: questions };
}

function getPrepostLiveSummary_(params) {
  const scope = clean_(params.scope || 'all').toLowerCase();
  const sessions = allSessionRows_();
  const questions = allQuestionRows_();
  const responses = allResponseRows_();

  const selectedSessions = scope === 'active'
    ? sessions.filter(function(item) { return item.status === 'active'; })
    : sessions;

  const mapped = selectedSessions.map(function(session) {
    return {
      sessionId: session.sessionId,
      title: session.title,
      activityDate: session.activityDate,
      status: session.status,
      targetParticipants: session.targetParticipants,
      summary: summarizeSession_(session, questions, responses)
    };
  });

  const totals = mapped.reduce(function(acc, item) {
    acc.sessions += 1;
    acc.preRespondents += item.summary.preRespondents;
    acc.postRespondents += item.summary.postRespondents;
    acc.avgGain += item.summary.gainScore;
    return acc;
  }, {
    sessions: 0,
    preRespondents: 0,
    postRespondents: 0,
    avgGain: 0
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    totals: {
      sessions: totals.sessions,
      preRespondents: totals.preRespondents,
      postRespondents: totals.postRespondents,
      avgGain: totals.sessions
        ? Number((totals.avgGain / totals.sessions).toFixed(2))
        : 0
    },
    sessions: mapped
  };
}

const PREPOST_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const PREPOST_ACCESS_PROPERTY_PREFIX = 'PREPOST_ACCESS_';
const PREPOST_ACCESS_THROTTLE_PREFIX = 'PREPOST_ACCESS_THROTTLE_';

function prepostAccessHash_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function prepostAccessPropertyKey_(token) {
  return PREPOST_ACCESS_PROPERTY_PREFIX + prepostAccessHash_(token);
}

function getValidPrepostAccess_(token, sessionId) {
  const cleanToken = clean_(token);
  if (!cleanToken) return null;
  const properties = PropertiesService.getScriptProperties();
  const key = prepostAccessPropertyKey_(cleanToken);
  const raw = properties.getProperty(key);
  if (!raw) return null;
  let record = null;
  try { record = JSON.parse(raw); } catch (error) {}
  if (!record || record.sessionId !== clean_(sessionId) || Number(record.expiresAt || 0) <= Date.now()) {
    properties.deleteProperty(key);
    return null;
  }
  return record;
}

function maskPrepostName_(value, index) {
  const name = clean_(value).replace(/\s+/g, ' ');
  if (!name) return 'Peserta ' + (index + 1);
  if (name.length <= 4) return name.charAt(0) + '***' + name.charAt(name.length - 1);
  return name.slice(0, 2) + '***' + name.slice(-2);
}

function maskPrepostEmail_(value) {
  const email = clean_(value);
  const at = email.lastIndexOf('@');
  if (at < 1) return '-';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return (local.length > 1 ? local.slice(0, 2) : local.charAt(0)) + '***@' + domain;
}

function handlePrepostParticipantAccessRequest_(e) {
  try {
    const data = parsePostPayload_(e);
    const sessionId = clean_(data.sessionId);
    const email = clean_(data.email).toLowerCase();
    if (!sessionId || !/^[^\s@]+@yayasangambut\.org$/i.test(email)) {
      return prepostResponse_({ ok: true });
    }
    const session = allSessionRows_().find(function(item) {
      return item.sessionId === sessionId;
    });
    if (!session) return prepostResponse_({ ok: true });

    const properties = PropertiesService.getScriptProperties();
    const throttleKey = PREPOST_ACCESS_THROTTLE_PREFIX + prepostAccessHash_(email + '|' + sessionId);
    const lastSentAt = Number(properties.getProperty(throttleKey) || 0);
    if (Date.now() - lastSentAt < 60000) return prepostResponse_({ ok: true });

    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const expiresAt = Date.now() + PREPOST_ACCESS_TTL_MS;
    properties.setProperty(prepostAccessPropertyKey_(token), JSON.stringify({
      email: email,
      sessionId: sessionId,
      expiresAt: expiresAt,
      createdAt: Date.now()
    }));
    properties.setProperty(throttleKey, String(Date.now()));

    const accessUrl = 'https://webgisyg.id/prepost-live-session.html?session=' +
      encodeURIComponent(sessionId) + '&access=' + encodeURIComponent(token);
    MailApp.sendEmail({
      to: email,
      subject: '[YG GeoPortal] Tautan akses data peserta',
      body: [
        'Permintaan akses data peserta diterima.',
        '',
        'Sesi: ' + clean_(session.title || session.sessionId),
        'Buka data lengkap:',
        accessUrl,
        '',
        'Tautan berlaku selama 12 jam. Setelah kedaluwarsa, silakan minta tautan baru.',
        'Jangan meneruskan tautan ini kepada pihak di luar Yayasan Gambut.'
      ].join('\n')
    });
    return prepostResponse_({ ok: true });
  } catch (error) {
    console.error({ event: 'prepost_access_request_failed', message: error.message });
    return prepostResponse_({ ok: true });
  }
}

function getPrepostSessionResponses_(sessionId, phase, sessionToken) {
  const id = clean_(sessionId);
  if (!id) {
    return { ok: false, error: 'Session ID wajib diisi.' };
  }

  const requestedPhase = clean_(phase || 'post').toLowerCase();
  if (['pre', 'post', 'all'].indexOf(requestedPhase) === -1) {
    return { ok: false, error: 'Phase harus pre, post, atau all.' };
  }

  const sessions = allSessionRows_();
  const session = sessions.find(function(item) {
    return item.sessionId === id;
  });
  if (!session) {
    return { ok: false, error: 'Sesi tidak ditemukan.' };
  }

  const questions = allQuestionRows_().filter(function(item) {
    return item.sessionId === id && item.active;
  });
  const responses = allResponseRows_().filter(function(item) {
    return item.sessionId === id &&
      (requestedPhase === 'all' ? true : item.phase === requestedPhase);
  });

  const questionCount = {
    pre: questions.filter(function(item) { return item.phase === 'pre'; }).length,
    post: questions.filter(function(item) { return item.phase === 'post'; }).length
  };

  let staff = null;
  try { staff = assertEditorCredential_(sessionToken); } catch (error) {}
  const authorized = Boolean(staff);

  const mapped = responses
    .map(function(item, index) {
      const phaseKey = item.phase === 'pre' ? 'pre' : 'post';
      const totalQuestion = questionCount[phaseKey] || 0;
      const scorePercent = totalQuestion > 0
        ? Number(((Number(item.totalScore || 0) / totalQuestion) * 100).toFixed(2))
        : 0;
      if (!authorized) {
        return {
          participantCode: 'Peserta ' + (index + 1),
          participantName: maskPrepostName_(item.participantName, index),
          participantEmail: maskPrepostEmail_(item.participantEmail)
        };
      }
      return {
        responseId: item.responseId,
        sessionId: item.sessionId,
        phase: item.phase,
        participantCode: item.participantCode,
        participantName: item.participantName,
        participantEmail: item.participantEmail,
        participantGender: item.participantGender,
        participantAgeCategory: item.participantAgeCategory,
        participantDelegate: item.participantDelegate,
        totalScore: Number(item.totalScore || 0),
        scorePercent: scorePercent,
        answeredCount: Array.isArray(item.answers) ? item.answers.length : 0,
        sourceChannel: item.sourceChannel,
        submittedAt: item.submittedAt
      };
    })
    .sort(function(a, b) {
      return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
    });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    session: session,
    phase: requestedPhase,
    questionCount: questionCount,
    count: mapped.length,
    authorized: authorized,
    expiresAt: authorized ? new Date(Number(staff.expiresAt || 0)).toISOString() : null,
    responses: mapped
  };
}

function handlePrepostCreateSessionPost_(e) {
  try {
    const data = parsePostPayload_(e);
    assertOfficialEmail_(data.staffEmail);

    const sessionId = createPrepostId_('SESS');
    const urls = buildPrepostUrls_(sessionId);
    const now = new Date();
    const sheet = getPrepostSessionSheet_();

    sheet.appendRow([
      sessionId,
      clean_(data.title),
      clean_(data.activityDate),
      clean_(data.location),
      clean_(data.village),
      clean_(data.facilitator),
      clean_(data.donor),
      Number(data.targetParticipants) || 0,
      clean_(data.status) || 'active',
      urls.preFormUrl,
      urls.postFormUrl,
      urls.preQrUrl,
      urls.postQrUrl,
      clean_(data.staffEmail).toLowerCase(),
      now,
      now
    ]);

    return prepostResponse_({
      ok: true,
      sessionId: sessionId,
      links: urls
    });
  } catch (error) {
    return prepostErrorResponse_(error.message);
  }
}

function handlePrepostUpdateSessionPost_(e) {
  try {
    const data = parsePostPayload_(e);
    assertOfficialEmail_(data.staffEmail);
    const sessionId = clean_(data.sessionId);
    if (!sessionId) throw new Error('Session ID wajib diisi.');

    const sheet = getPrepostSessionSheet_();
    if (sheet.getLastRow() < 2) throw new Error('Sesi tidak ditemukan.');

    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 16)
      .getDisplayValues();

    let found = -1;
    rows.forEach(function(row, index) {
      if (clean_(row[0]) === sessionId) found = index + 2;
    });
    if (found === -1) throw new Error('Sesi tidak ditemukan.');

    const urls = buildPrepostUrls_(sessionId);
    const previous = sheet.getRange(found, 1, 1, 16).getDisplayValues()[0];

    sheet.getRange(found, 1, 1, 16).setValues([[
      sessionId,
      clean_(data.title) || clean_(previous[1]),
      clean_(data.activityDate) || clean_(previous[2]),
      clean_(data.location) || clean_(previous[3]),
      clean_(data.village) || clean_(previous[4]),
      clean_(data.facilitator) || clean_(previous[5]),
      clean_(data.donor) || clean_(previous[6]),
      Number(data.targetParticipants || previous[7]) || 0,
      clean_(data.status) || clean_(previous[8]) || 'active',
      urls.preFormUrl,
      urls.postFormUrl,
      urls.preQrUrl,
      urls.postQrUrl,
      clean_(previous[13]),
      previous[14],
      new Date()
    ]]);

    return prepostResponse_({ ok: true, sessionId: sessionId, links: urls });
  } catch (error) {
    return prepostErrorResponse_(error.message);
  }
}

function normalizeQuestionOptions_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function handlePrepostCreateQuestionPost_(e) {
  try {
    const data = parsePostPayload_(e);
    assertOfficialEmail_(data.staffEmail);
    const sessionId = clean_(data.sessionId);
    if (!sessionId) throw new Error('Session ID wajib diisi.');

    const phase = clean_(data.phase).toLowerCase();
    if (['pre', 'post'].indexOf(phase) === -1) {
      throw new Error('Phase harus pre atau post.');
    }

    const questionText = clean_(data.questionText);
    if (!questionText) throw new Error('Pertanyaan wajib diisi.');

    const questionType = clean_(data.questionType) || 'single';
    const maxScore = Number(data.maxScore);
    const options = normalizeQuestionOptions_(data.options);

    const sheet = getPrepostQuestionSheet_();
    const now = new Date();
    sheet.appendRow([
      createPrepostId_('QST'),
      sessionId,
      phase,
      questionText,
      questionType,
      JSON.stringify(options),
      Number.isFinite(maxScore) ? maxScore : 0,
      Number(data.order) || 0,
      'true',
      clean_(data.staffEmail).toLowerCase(),
      now,
      now
    ]);

    return prepostResponse_({ ok: true });
  } catch (error) {
    return prepostErrorResponse_(error.message);
  }
}

function handlePrepostUpdateQuestionPost_(e) {
  try {
    const data = parsePostPayload_(e);
    assertOfficialEmail_(data.staffEmail);

    const questionId = clean_(data.questionId);
    if (!questionId) throw new Error('Question ID wajib diisi.');

    const questionSheet = getPrepostQuestionSheet_();
    if (questionSheet.getLastRow() < 2) {
      throw new Error('Data pertanyaan belum tersedia.');
    }

    const rows = questionSheet
      .getRange(2, 1, questionSheet.getLastRow() - 1, 12)
      .getDisplayValues();

    let found = -1;
    rows.forEach(function(row, index) {
      if (clean_(row[0]) === questionId) found = index + 2;
    });

    if (found === -1) throw new Error('Pertanyaan tidak ditemukan.');

    const previous = questionSheet.getRange(found, 1, 1, 12).getDisplayValues()[0];
    const phase = clean_(data.phase || previous[2]).toLowerCase();
    if (['pre', 'post'].indexOf(phase) === -1) {
      throw new Error('Phase harus pre atau post.');
    }

    const questionText = clean_(data.questionText || previous[3]);
    if (!questionText) throw new Error('Pertanyaan wajib diisi.');

    const questionType = clean_(data.questionType || previous[4] || 'single');
    const options = normalizeQuestionOptions_(data.options);
    const maxScore = Number(data.maxScore);
    const displayOrder = Number(data.order);

    questionSheet.getRange(found, 1, 1, 12).setValues([[
      questionId,
      clean_(data.sessionId || previous[1]),
      phase,
      questionText,
      questionType,
      JSON.stringify(options),
      Number.isFinite(maxScore) ? maxScore : Number(previous[6]) || 0,
      Number.isFinite(displayOrder) ? displayOrder : Number(previous[7]) || 0,
      clean_(previous[8]) || 'true',
      clean_(previous[9]),
      previous[10],
      new Date()
    ]]);

    return prepostResponse_({ ok: true, questionId: questionId });
  } catch (error) {
    return prepostErrorResponse_(error.message);
  }
}

function findQuestionById_(questions, questionId) {
  const id = clean_(questionId);
  return questions.find(function(item) {
    return item.questionId === id;
  });
}

function scoreResponseAnswers_(answers, questions) {
  if (!Array.isArray(answers)) return 0;
  return answers.reduce(function(total, answer) {
    const question = findQuestionById_(questions, answer.questionId);
    if (!question) return total;

    if (question.questionType === 'scale') {
      const value = Number(answer.value);
      return total + (Number.isFinite(value) ? value : 0);
    }

    if (question.questionType === 'single') {
      const selected = clean_(answer.value);
      const option = (question.options || []).find(function(item) {
        return clean_(item.value) === selected || clean_(item.label) === selected;
      });
      return total + Number((option && option.score) || 0);
    }

    return total;
  }, 0);
}

function handlePrepostSubmitResponsePost_(e) {
  try {
    const data = parsePostPayload_(e);
    const sessionId = clean_(data.sessionId);
    const phase = clean_(data.phase).toLowerCase();
    const participantGender = clean_(data.participantGender);
    const participantAgeCategory = clean_(data.participantAgeCategory);
    const participantDelegate = clean_(data.participantDelegate);

    if (!sessionId) throw new Error('Session ID wajib diisi.');
    if (['pre', 'post'].indexOf(phase) === -1) {
      throw new Error('Phase harus pre atau post.');
    }

    const sessions = allSessionRows_();
    const session = sessions.find(function(item) {
      return item.sessionId === sessionId;
    });
    if (!session) throw new Error('Sesi tidak ditemukan.');
    if (session.status === 'closed') {
      throw new Error('Sesi sudah ditutup.');
    }

    const participantName = clean_(data.participantName);
    if (!participantName) {
      throw new Error('Nama peserta wajib diisi.');
    }

    if (!participantGender) {
      throw new Error('Jenis kelamin peserta wajib diisi.');
    }

    if (!participantAgeCategory) {
      throw new Error('Kategori umur peserta wajib diisi.');
    }

    if (!participantDelegate) {
      throw new Error('Utusan lembaga peserta wajib diisi.');
    }

    const participantCode = clean_(data.participantCode) || createPrepostId_('PTC');

    const answers = Array.isArray(data.answers) ? data.answers : [];
    if (!answers.length) throw new Error('Jawaban belum diisi.');

    const questions = allQuestionRows_().filter(function(item) {
      return item.sessionId === sessionId && item.phase === phase && item.active;
    });
    if (!questions.length) {
      throw new Error('Pertanyaan sesi belum tersedia.');
    }

    const totalScore = scoreResponseAnswers_(answers, questions);
    const questionCount = questions.length;
    const scorePercent = questionCount > 0
      ? (totalScore / questionCount) * 100
      : 0;
    const sheet = getPrepostResponseSheet_();
    const submittedAt = Utilities.formatDate(
      new Date(),
      'Asia/Jakarta',
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );

    sheet.appendRow([
      createPrepostId_('RSP'),
      sessionId,
      phase,
      participantCode,
      participantName,
      clean_(data.participantEmail),
      participantGender,
      participantAgeCategory,
      participantDelegate,
      JSON.stringify(answers),
      totalScore,
      clean_(data.sourceChannel) || 'web',
      submittedAt
    ]);

    return prepostResponse_({
      ok: true,
      sessionId: sessionId,
      phase: phase,
      totalScore: totalScore,
      questionCount: questionCount,
      scorePercent: Number(scorePercent.toFixed(2))
    });
  } catch (error) {
    return prepostErrorResponse_(error.message);
  }
}
