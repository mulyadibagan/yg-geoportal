const SPREADSHEET_ID = '1iCjtHWn-31IhkjgmEhJdMFnxvSNMYVcCfP5Prb37YU8';
const SHEET_NAME = 'Laporan Masuk';
const UPLOAD_FOLDER_ID = '1R8N0lsMQmzThOBDnJpq1ZmQ2TFP8xhGK';
const ADMIN_EMAIL = 'mulyadi@yayasangambut.org';
const NOTIFICATION_EMAILS = [
  ADMIN_EMAIL,
  'zamharier@yayasangambut.org'
];
const ADMIN_TOKEN = 'We612IBwjWpyxg-Jw7cf0u9eqlw-6DNn';

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

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page || '';
  const token = params.token || '';
  const callback = params.callback || '';
  if (page === 'public-content') {
  return contentAdminResponse_(getPublicContent_(), callback);
}

if (page === 'content-save-result') {
  return contentAdminResponse_(
    getContentSaveResult_(params.requestId),
    callback
  );
}

  if (page === 'admin') {
    if (token !== ADMIN_TOKEN) {
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
    if (token !== ADMIN_TOKEN) {
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

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'YG GeoPortal Reporting API',
      version: '2.0-validation'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const action = clean_(
      e && e.parameter
        ? e.parameter.action
        : ''
    );
if (action === 'content-save') {
  return handleContentAdminPost_(e);
}
    if (action === 'editor-login' || action === 'editor-logout') {
      return handleEditorAuthPost_(e);
    }

    if (action === 'update-master-object') {
      return handleMasterObjectEditorPost_(e);
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
    validateIncomingPayload_(data);

    // Normalisasi metadata tambahan agar frontend lama/baru tetap kompatibel.
    const normalizedTargetFeatureProperties =
      buildTargetFeaturePropertiesForStorage_(data);
    const normalizedProposedChanges =
      buildStoredProposedChanges_(data);

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

    notifyAdmin_(reportId, data, photoUrls, geometry);

    return HtmlService.createHtmlOutput(
      '<h2 style="font-family:Arial;color:#076b9c">Laporan berhasil diterima</h2>' +
      '<p style="font-family:Arial">ID laporan: <b>' +
      escapeHtml_(reportId) +
      '</b></p>'
    );
  } catch (error) {
    return HtmlService.createHtmlOutput(
      '<h2 style="font-family:Arial;color:#b42318">Laporan gagal dikirim</h2>' +
      '<p style="font-family:Arial">' +
      escapeHtml_(error.message) +
      '</p>'
    );
  }
}

function getAdminDashboardData(token) {
  assertAdmin_(token);

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
      reports: []
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
    reports: reports
  };
}

function updateReportStatus(token, rowNumber, newStatus, adminNote) {
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

  if (newStatus === 'Sudah Dipublikasikan') {
    validateReportForPublication_(sheet, rowNumber);
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

  return {
    ok: true,
    reportId: sheet.getRange(rowNumber, 1).getDisplayValue(),
    status: newStatus
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

  const normalizedEcosystemType = normalizeNewObjectEcosystemType_(
    data.newObjectEcosystem
  );
  if (normalizedEcosystemType) {
    stored.Kategori_Ekosistem = normalizedEcosystemType;
    stored.Jenis_Ekosistem = normalizedEcosystemType;
    stored.Program = mapEcosystemToProgramme_(normalizedEcosystemType);
  }

  const normalizedForestLandType = normalizeForestLandType_(data.forestLandType);
  if (normalizedForestLandType) {
    stored.Jenis_Lahan_Penanaman = normalizedForestLandType;
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

  const normalizedForestLandType = normalizeForestLandType_(
    data && data.forestLandType
  );
  if (normalizedForestLandType && !clean_(properties.Jenis_Lahan_Penanaman)) {
    properties.Jenis_Lahan_Penanaman = normalizedForestLandType;
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

function normalizeForestLandType_(value) {
  const text = clean_(value).toLowerCase();
  if (!text) {
    return '';
  }

  if (text === 'mineral' || text.indexOf('bukan gambut') !== -1) {
    return 'Mineral';
  }

  if (text === 'gambut') {
    return 'Gambut';
  }

  return 'Campuran/Tidak Pasti';
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
  return true;
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

  rows.forEach(function(row, index) {
    if (row[21] !== 'Sudah Dipublikasikan') {
      return;
    }

    const reportType = clean_(row[1]);

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

    try { targetProperties = row[30] ? JSON.parse(row[30]) : {}; } catch (error) {}
    try { storedChanges = row[31] ? JSON.parse(row[31]) : {}; } catch (error) {}

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
        proposedInformation: row[18],
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

  if (data.reportType === 'Area/Poligon Baru') {
    const ecosystemType = normalizeNewObjectEcosystemType_(
      data.newObjectEcosystem
    );
    if (!ecosystemType) {
      throw new Error(
        'Kategori ekosistem area baru wajib dipilih (Mangrove/Gambut/Lahan Mineral).'
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
  const adminUrl =
    ScriptApp.getService().getUrl() +
    '?page=admin&token=' +
    encodeURIComponent(ADMIN_TOKEN);

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
  if (token !== ADMIN_TOKEN) {
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