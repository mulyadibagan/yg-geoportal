/**
 * YG GeoPortal v2 - Master Database Engine
 * Simpan sebagai file baru: DatabaseEngine.gs
 *
 * Sumber utama data operasional:
 * - Sheet OBJECTS: master objek spasial
 * - Sheet CHANGE_LOG: riwayat perubahan
 * - Sheet Laporan Masuk: laporan masyarakat + monitoring yang sudah ada
 */

const OBJECTS_SHEET_NAME = 'OBJECTS';
const CHANGE_LOG_SHEET_NAME = 'CHANGE_LOG';
const MASTER_REPOSITORY_RAW =
  'https://raw.githubusercontent.com/mulyadibagan/yg-geoportal/main/';

const MASTER_LAYER_CONFIG = [
  { id: 'area_mangrove', label: 'Area Penanaman Mangrove', category: 'Penanaman Mangrove', file: 'data/area_mangrove.geojson' },
  { id: 'apo', label: 'Alat Pemecah Ombak (APO)', category: 'APO', file: 'data/apo.geojson' },
  { id: 'fdrs', label: 'FDRS / Water Table', category: 'FDRS', file: 'data/fdrs.geojson' },
  { id: 'sekat_kanal', label: 'Sekat Kanal', category: 'Sekat Kanal', file: 'data/sekat_kanal.geojson' },
  { id: 'nursery_mangrove', label: 'Pembibitan Mangrove', category: 'Pembibitan', file: 'data/nursery_mangrove.geojson' },
  { id: 'kopi', label: 'Distribusi Lahan Kopi', category: 'Agroforestri/Kopi', file: 'data/kopi.geojson' },
  { id: 'area_kopi', label: 'Wilayah Penanaman Kopi', category: 'Agroforestri/Kopi', file: 'data/area_kopi.geojson' },
  { id: 'desa_intervensi', label: 'Batas Desa Intervensi', category: 'Wilayah Intervensi', file: 'data/desa_intervensi.geojson' },
  { id: 'titik_desa', label: 'Titik Desa Intervensi', category: 'Titik Desa', file: 'data/titik_desa.geojson' }
];

const OBJECT_HEADERS = [
  'Object_ID', 'Layer_ID', 'Layer_Label', 'Nama_Objek', 'Kategori',
  'Source_Type', 'Source_Report_ID', 'Program', 'Fase', 'Tahun',
  'Provinsi', 'Kabupaten', 'Kecamatan', 'Desa', 'Luas_Ha',
  'Panjang_M', 'Jumlah_Tanam', 'Status_Objek', 'Geometry_Type',
  'Geometry_GeoJSON', 'Properties_JSON', 'Updated_At', 'Updated_By',
  'Revision'
];

const CHANGE_LOG_HEADERS = [
  'Timestamp', 'Object_ID', 'Action', 'Reason', 'Changed_By',
  'Before_JSON', 'After_JSON'
];

/**
 * Jalankan sekali dari editor Apps Script.
 * Fungsi ini membuat sheet master dan mengimpor seluruh layer GeoJSON GitHub.
 */
function setupAndMigrateMasterDatabase() {
  ensureMasterDatabaseSheets_();

  const summary = {
    startedAt: new Date().toISOString(),
    layers: [],
    inserted: 0,
    updated: 0,
    failed: 0
  };

  MASTER_LAYER_CONFIG.forEach(function(layer) {
    try {
      const result = importGitHubLayerToObjects_(layer);
      summary.layers.push(result);
      summary.inserted += result.inserted;
      summary.updated += result.updated;
    } catch (error) {
      summary.failed += 1;
      summary.layers.push({
        layerId: layer.id,
        ok: false,
        error: error.message
      });
    }
  });

  summary.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * Jalankan manual bila ingin memasukkan laporan masyarakat terpublikasi
 * sebagai objek resmi. Monitoring tidak dibuat menjadi objek baru.
 */
function syncPublishedCommunityReportsToObjects() {
  ensureMasterDatabaseSheets_();

  const reportSheet = getSheet_();

  if (!reportSheet || reportSheet.getLastRow() < 2) {
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      monitoringInserted: 0,
      communityInserted: 0,
      skipped: 0
    };
  }

  const rows = reportSheet
    .getRange(2, 1, reportSheet.getLastRow() - 1, 32)
    .getDisplayValues();

  let inserted = 0;
  let updated = 0;
  let monitoringInserted = 0;
  let communityInserted = 0;
  let skipped = 0;

  rows.forEach(function(row) {
    const status = clean_(row[21]);
    const reportType = clean_(row[1]);

    if (status !== 'Sudah Dipublikasikan') return;

    if (
      ['Perbaikan Informasi', 'Tambah Foto Kegiatan']
        .indexOf(reportType) !== -1
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

    if (!geometry) {
      skipped += 1;
      return;
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

    const reportId = clean_(row[0]);
    const isMonitoring = reportType === 'Monitoring';
    const monitoringData =
      proposedChanges &&
      proposedChanges.monitoring &&
      typeof proposedChanges.monitoring === 'object'
        ? proposedChanges.monitoring
        : {};

    const layerId = isMonitoring
      ? 'monitoring_reports'
      : 'community_reports';

    const layerLabel = isMonitoring
      ? 'Hasil Monitoring Terverifikasi'
      : 'Laporan Masyarakat Terverifikasi';

    const sourceType = isMonitoring
      ? 'monitoring_report'
      : 'community_report';

    const objectId = isMonitoring
      ? 'MONITORING-' + reportId
      : 'COMMUNITY-' + reportId;

    const monitoringType = clean_(
      monitoringData.monitoringType ||
      targetProperties.monitoringType ||
      'Monitoring'
    );

    const baseObjectName =
      clean_(row[16]) ||
      clean_(row[11]) ||
      reportId;

    const objectName = isMonitoring
      ? monitoringType + ' – ' + baseObjectName
      : baseObjectName;

    const properties = Object.assign({}, targetProperties, {
      Object_ID: objectId,
      Layer_ID: layerId,
      Layer_Label: layerLabel,
      Nama_Objek: objectName,
      Kategori: isMonitoring ? monitoringType : (reportType || 'Laporan Masyarakat'),
      Source_Type: sourceType,
      Source_Report_ID: reportId,
      reportId: reportId,
      reportType: reportType,
      title: clean_(row[11]),
      description: clean_(row[12]),
      activityDate: clean_(row[13]),
      receivedAt: clean_(row[2]),
      locationName: clean_(row[16]),
      reporterName: clean_(row[3]),
      organization: clean_(row[4]),
      photos: row[19]
        ? row[19].split(/\r?\n/).filter(Boolean)
        : [],
      documentUrl: clean_(row[20]),
      verifiedBy: clean_(row[23]),
      verifiedAt: clean_(row[24]),
      publishedAt: clean_(row[25]),
      Monitoring_ID: isMonitoring ? reportId : '',
      Monitoring_Type: isMonitoring ? monitoringType : '',
      Kondisi: isMonitoring ? clean_(monitoringData.condition) : '',
      Survival: isMonitoring ? clean_(monitoringData.survivalPercent) : '',
      Jumlah_Hidup: isMonitoring ? clean_(monitoringData.aliveCount) : '',
      Jumlah_Mati_Rusak: isMonitoring ? clean_(monitoringData.deadOrDamagedCount) : '',
      Luas_Terpantau_Ha: isMonitoring ? clean_(monitoringData.monitoredAreaHa) : '',
      Tinggi_Rata_Rata_Cm: isMonitoring ? clean_(monitoringData.averageHeightCm) : '',
      Diameter_Rata_Rata_Cm: isMonitoring ? clean_(monitoringData.averageDiameterCm) : '',
      Sedimentasi_Cm: isMonitoring ? clean_(monitoringData.sedimentationCm) : '',
      Water_Table_Cm: isMonitoring ? clean_(monitoringData.waterTableCm) : '',
      Ancaman: isMonitoring ? clean_(monitoringData.threats) : '',
      Temuan: isMonitoring ? clean_(monitoringData.notes) : '',
      Tindak_Lanjut: isMonitoring ? clean_(monitoringData.followUp) : '',
      Target_Object_ID: clean_(proposedChanges.targetObjectId),
      Target_Layer_ID: clean_(proposedChanges.targetLayerId || row[28]),
      Target_Layer_Label: clean_(proposedChanges.targetLayerLabel || row[29])
    });

    const object = {
      objectId: objectId,
      layerId: layerId,
      layerLabel: layerLabel,
      objectName: objectName,
      category: isMonitoring
        ? monitoringType
        : (reportType || 'Laporan Masyarakat'),
      sourceType: sourceType,
      sourceReportId: reportId,
      program: clean_(targetProperties.Program || targetProperties.program),
      phase: clean_(targetProperties.Fase || targetProperties.phase),
      year: extractYear_(row[13]) || extractYear_(row[2]),
      province: clean_(row[7]) || 'Riau',
      regency: clean_(row[8]),
      district: clean_(row[9]),
      village: clean_(row[10]),
      areaHa: isMonitoring
        ? numberOrBlank_(monitoringData.monitoredAreaHa)
        : numberOrBlank_(firstValue_(targetProperties, ['Luas_Ha', 'luas_ha', 'areaHa'])),
      lengthM: numberOrBlank_(firstValue_(targetProperties, ['Panjang_M', 'panjang_m', 'lengthM'])),
      plantedCount: isMonitoring
        ? numberOrBlank_(monitoringData.aliveCount)
        : numberOrBlank_(firstValue_(targetProperties, ['Jumlah_Tanam', 'jumlah_tanam', 'plantedCount'])),
      status: 'Aktif',
      geometry: geometry,
      properties: properties
    };

    const result = upsertMasterObject_(object, {
      action: isMonitoring
        ? 'SYNC_MONITORING_REPORT'
        : 'SYNC_COMMUNITY_REPORT',
      reason: isMonitoring
        ? 'Sinkronisasi laporan monitoring terpublikasi'
        : 'Sinkronisasi laporan masyarakat terpublikasi',
      changedBy: ADMIN_EMAIL
    });

    if (result.created) {
      inserted += 1;
      if (isMonitoring) monitoringInserted += 1;
      else communityInserted += 1;
    } else {
      updated += 1;
    }
  });

  const result = {
    ok: true,
    inserted: inserted,
    updated: updated,
    monitoringInserted: monitoringInserted,
    communityInserted: communityInserted,
    skipped: skipped
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Menyusun FeatureCollection publik untuk WebGIS.
 * Data utama berasal dari OBJECTS. Laporan masyarakat terpublikasi yang
 * belum sempat disinkronkan tetap ditambahkan secara dinamis agar tidak hilang.
 */
function getWebGisObjectsFeatureCollection_() {
  ensureMasterDatabaseSheets_();

  const objects = readMasterObjects_({ activeOnly: true });
  const features = [];
  const knownObjectIds = {};

  objects.forEach(function(object) {
    knownObjectIds[object.objectId] = true;
    features.push(masterObjectToFeature_(object));
  });

  const reportSheet = getSheet_();

  if (reportSheet && reportSheet.getLastRow() >= 2) {
    const rows = reportSheet
      .getRange(2, 1, reportSheet.getLastRow() - 1, 32)
      .getDisplayValues();

    rows.forEach(function(row) {
      const status = clean_(row[21]);
      const reportType = clean_(row[1]);

      if (status !== 'Sudah Dipublikasikan') return;

      if (
        ['Perbaikan Informasi', 'Tambah Foto Kegiatan']
          .indexOf(reportType) !== -1
      ) {
        return;
      }

      const reportId = clean_(row[0]);
      const isMonitoring = reportType === 'Monitoring';

      const objectId = isMonitoring
        ? 'MONITORING-' + reportId
        : 'COMMUNITY-' + reportId;

      if (knownObjectIds[objectId]) return;

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

      if (!geometry) return;

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

      const monitoringData =
        proposedChanges &&
        proposedChanges.monitoring &&
        typeof proposedChanges.monitoring === 'object'
          ? proposedChanges.monitoring
          : {};

      const layerId = isMonitoring
        ? 'monitoring_reports'
        : 'community_reports';

      const layerLabel = isMonitoring
        ? 'Hasil Monitoring Terverifikasi'
        : 'Laporan Masyarakat Terverifikasi';

      const monitoringType = clean_(
        monitoringData.monitoringType ||
        targetProperties.monitoringType ||
        'Monitoring'
      );

      const baseObjectName =
        clean_(row[16]) ||
        clean_(row[11]) ||
        reportId;

      const objectName = isMonitoring
        ? monitoringType + ' – ' + baseObjectName
        : baseObjectName;

      features.push({
        type: 'Feature',
        geometry: geometry,
        properties: Object.assign({}, targetProperties, {
          Object_ID: objectId,
          Layer_ID: layerId,
          Layer_Label: layerLabel,
          Nama_Objek: objectName,
          Kategori: isMonitoring
            ? monitoringType
            : (reportType || 'Laporan Masyarakat'),
          Source_Type: isMonitoring
            ? 'monitoring_report'
            : 'community_report',
          Source_Report_ID: reportId,
          Program: clean_(targetProperties.Program || targetProperties.program),
          Fase: clean_(targetProperties.Fase || targetProperties.phase),
          Tahun: extractYear_(row[13]) || extractYear_(row[2]),
          Provinsi: clean_(row[7]) || 'Riau',
          Kabupaten: clean_(row[8]),
          Kecamatan: clean_(row[9]),
          Desa: clean_(row[10]),
          Status_Objek: 'Aktif',
          reportId: reportId,
          reportType: reportType,
          title: clean_(row[11]),
          description: clean_(row[12]),
          activityDate: clean_(row[13]),
          locationName: clean_(row[16]),
          photos: row[19]
            ? row[19].split(/\r?\n/).filter(Boolean)
            : [],
          documentUrl: clean_(row[20]),
          Monitoring_ID: isMonitoring ? reportId : '',
          Monitoring_Type: isMonitoring ? monitoringType : '',
          Kondisi: isMonitoring ? clean_(monitoringData.condition) : '',
          Survival: isMonitoring ? clean_(monitoringData.survivalPercent) : '',
          Jumlah_Hidup: isMonitoring ? clean_(monitoringData.aliveCount) : '',
          Jumlah_Mati_Rusak: isMonitoring ? clean_(monitoringData.deadOrDamagedCount) : '',
          Luas_Terpantau_Ha: isMonitoring ? clean_(monitoringData.monitoredAreaHa) : '',
          Tinggi_Rata_Rata_Cm: isMonitoring ? clean_(monitoringData.averageHeightCm) : '',
          Diameter_Rata_Rata_Cm: isMonitoring ? clean_(monitoringData.averageDiameterCm) : '',
          Sedimentasi_Cm: isMonitoring ? clean_(monitoringData.sedimentationCm) : '',
          Water_Table_Cm: isMonitoring ? clean_(monitoringData.waterTableCm) : '',
          Ancaman: isMonitoring ? clean_(monitoringData.threats) : '',
          Temuan: isMonitoring ? clean_(monitoringData.notes) : '',
          Tindak_Lanjut: isMonitoring ? clean_(monitoringData.followUp) : '',
          Target_Object_ID: clean_(proposedChanges.targetObjectId)
        })
      });
    });
  }

  return {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    featureCount: features.length,
    source: 'YG_MASTER_DATABASE',
    features: features
  };
}

function masterObjectToFeature_(object) {
  return {
    type: 'Feature',
    geometry: object.geometry,
    properties: Object.assign({}, object.properties, {
      Object_ID: object.objectId,
      Layer_ID: object.layerId,
      Layer_Label: object.layerLabel,
      Nama_Objek: object.objectName,
      Kategori: object.category,
      Source_Type: object.sourceType,
      Source_Report_ID: object.sourceReportId,
      Program: object.program,
      Fase: object.phase,
      Tahun: object.year,
      Provinsi: object.province,
      Kabupaten: object.regency,
      Kecamatan: object.district,
      Desa: object.village,
      Luas_Ha: object.areaHa,
      Panjang_M: object.lengthM,
      Jumlah_Tanam: object.plantedCount,
      Status_Objek: object.status,
      Revision: object.revision
    })
  };
}

function getObjectsFeatureCollection_() {
  return getWebGisObjectsFeatureCollection_();
}

function getDashboardSummaryV2_() {
  ensureMasterDatabaseSheets_();

  const objects = readMasterObjects_({ activeOnly: true });
  const villages = {};
  const categories = {};
  let totalAreaHa = 0;
  let totalPlanted = 0;

  objects.forEach(function(object) {
    if (object.village) villages[object.village.toLowerCase()] = object.village;
    categories[object.category || 'Lainnya'] =
      (categories[object.category || 'Lainnya'] || 0) + 1;

    const area = Number(object.areaHa);
    if (Number.isFinite(area)) totalAreaHa += area;

    const planted = Number(object.plantedCount);
    if (Number.isFinite(planted)) totalPlanted += planted;
  });

  const reportSummary = summarizePublishedReports_();

  return {
    generatedAt: new Date().toISOString(),
    objects: {
      total: objects.length,
      villages: Object.keys(villages).length,
      totalAreaHa: roundNumber_(totalAreaHa, 3),
      totalPlanted: totalPlanted,
      categories: categories
    },
    reports: reportSummary
  };
}

function getMasterObjectsForAdmin(token) {
  assertAdmin_(token);
  ensureMasterDatabaseSheets_();

  return readMasterObjects_({ activeOnly: false }).map(function(object) {
    return {
      objectId: object.objectId || '',
      layerId: object.layerId || '',
      layerLabel: object.layerLabel || '',
      objectName: object.objectName || '',
      category: object.category || '',
      sourceType: object.sourceType || '',
      sourceReportId: object.sourceReportId || '',
      program: object.program || '',
      phase: object.phase || '',
      year: object.year || '',
      province: object.province || '',
      regency: object.regency || '',
      district: object.district || '',
      village: object.village || '',
      areaHa: object.areaHa === '' ? '' : Number(object.areaHa || 0),
      lengthM: object.lengthM === '' ? '' : Number(object.lengthM || 0),
      plantedCount: object.plantedCount === '' ? '' : Number(object.plantedCount || 0),
      status: object.status || 'Aktif',
      geometryType: object.geometryType || '',
      geometry: object.geometry || null,
      properties: object.properties || {},
      updatedAt: object.updatedAt instanceof Date
        ? object.updatedAt.toISOString()
        : (object.updatedAt || ''),
      updatedBy: object.updatedBy || '',
      revision: Number(object.revision || 0)
    };
  });
}

function updateMasterObject(token, objectData, reason) {
  const editor = assertEditorCredential_(token);
  ensureMasterDatabaseSheets_();

  if (!objectData || typeof objectData !== 'object') {
    throw new Error('Data objek tidak ditemukan.');
  }

  const objectId = clean_(objectData.objectId);
  if (!objectId) throw new Error('Object_ID wajib diisi.');

  const geometry = parseGeometry_(objectData.geometry);
  if (!geometry) throw new Error('Geometry GeoJSON tidak valid.');

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const objectSheet = spreadsheet.getSheetByName(OBJECTS_SHEET_NAME);
  const existingRow = findObjectRowById_(objectSheet, objectId);
  const isCreate = !existingRow;

  const properties =
    objectData.properties &&
    typeof objectData.properties === 'object' &&
    !Array.isArray(objectData.properties)
      ? Object.assign({}, objectData.properties)
      : {};

  const layerId = clean_(objectData.layerId);
  const layerLabel = clean_(objectData.layerLabel);
  const objectName = clean_(objectData.objectName);
  const category = clean_(objectData.category);
  const sourceType = clean_(objectData.sourceType) || 'program_layer';
  const status = clean_(objectData.status) || 'Aktif';

  properties.Object_ID = objectId;
  properties.Layer_ID = layerId;
  properties.Layer_Label = layerLabel;
  properties.Source_Layer = layerId;
  properties.Source_Type = sourceType;
  properties.Nama_Objek = objectName;
  properties.Kategori = category;
  properties.Status_Objek = status;
  properties.Program = clean_(objectData.program);
  properties.Donor = clean_(objectData.donor || properties.Donor);
  properties.Nama_Proyek = clean_(
    objectData.projectName || properties.Nama_Proyek
  );
  properties.Project_ID = clean_(
    objectData.projectId || properties.Project_ID
  );
  properties.Nomor_Perjanjian = clean_(
    objectData.agreementNumber || properties.Nomor_Perjanjian
  );

  /*
   * Nilai capaian di kolom OBJECTS dan Properties_JSON harus identik.
   * Luas_Ha adalah luas resmi yang diisi editor dan dipakai dashboard.
   */
  const areaHa = numberOrBlank_(objectData.areaHa);
  const lengthM = numberOrBlank_(objectData.lengthM);
  const plantedCount = numberOrBlank_(objectData.plantedCount);
  properties.Luas_Ha = areaHa;
  properties.Panjang_M = lengthM;
  properties.Jumlah_Tanam = plantedCount;

  const object = {
    objectId: objectId,
    layerId: layerId,
    layerLabel: layerLabel,
    objectName: objectName,
    category: category,
    sourceType: sourceType,
    sourceReportId: clean_(objectData.sourceReportId),
    program: clean_(objectData.program),
    phase: clean_(objectData.phase),
    year: clean_(objectData.year),
    province: clean_(objectData.province) || 'Riau',
    regency: clean_(objectData.regency),
    district: clean_(objectData.district),
    village: clean_(objectData.village),
    areaHa: areaHa,
    lengthM: lengthM,
    plantedCount: plantedCount,
    status: status,
    geometry: geometry,
    properties: properties
  };

  validateMasterObject_(object);

  return upsertMasterObject_(object, {
    action: isCreate ? 'CREATE_OBJECT' : 'UPDATE_OBJECT',
    reason: clean_(reason) || (
      isCreate ? 'Penambahan objek baru' : 'Revisi data objek'
    ),
    changedBy: editor.email || editor.username
  });
}

function ensureMasterDatabaseSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheetWithHeaders_(spreadsheet, OBJECTS_SHEET_NAME, OBJECT_HEADERS);
  ensureSheetWithHeaders_(spreadsheet, CHANGE_LOG_SHEET_NAME, CHANGE_LOG_HEADERS);
}

function ensureSheetWithHeaders_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#076b9c')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);

  return sheet;
}

function importGitHubLayerToObjects_(layerConfig) {
  const url = MASTER_REPOSITORY_RAW + layerConfig.file;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('Gagal membaca ' + layerConfig.file + ' (' + code + ')');
  }

  const data = JSON.parse(response.getContentText());
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error(layerConfig.file + ' bukan FeatureCollection.');
  }

  let inserted = 0;
  let updated = 0;

  data.features.forEach(function(feature, index) {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return;

    const props = feature.properties || {};
    const object = normalizeFeatureToMasterObject_(
      layerConfig,
      feature,
      index
    );

    const result = upsertMasterObject_(object, {
      action: 'MIGRATE_GITHUB_LAYER',
      reason: 'Migrasi awal dari ' + layerConfig.file,
      changedBy: ADMIN_EMAIL,
      skipLogWhenUnchanged: true
    });

    if (result.created) inserted += 1;
    else updated += 1;
  });

  return {
    layerId: layerConfig.id,
    ok: true,
    features: data.features.length,
    inserted: inserted,
    updated: updated
  };
}

function normalizeFeatureToMasterObject_(layerConfig, feature, index) {
  const props = feature.properties || {};
  const geometry = feature.geometry;

  const village = firstValue_(props, ['Desa', 'desa', 'DESA', 'Kelurahan', 'kelurahan']);
  const year = firstValue_(props, ['Tahun', 'tahun', 'YEAR', 'Year']);
  const phase = firstValue_(props, ['Fase', 'fase', 'Phase', 'phase']);

  const objectName =
    firstValue_(props, ['Nama_Objek', 'nama_objek', 'Nama', 'nama', 'Name', 'name', 'Lokasi', 'lokasi']) ||
    buildDefaultObjectName_(layerConfig.label, village, phase || year, index + 1);

  const existingId = firstValue_(props, ['Object_ID', 'object_id', 'OBJECT_ID']);
  const objectId = existingId || createDatabaseObjectId_(
    layerConfig.id,
    objectName,
    geometry,
    index
  );

  return {
    objectId: objectId,
    layerId: layerConfig.id,
    layerLabel: layerConfig.label,
    objectName: objectName,
    category: firstValue_(props, ['Kategori', 'kategori']) || layerConfig.category,
    sourceType: 'program_layer',
    sourceReportId: '',
    program: firstValue_(props, ['Program', 'program']),
    phase: phase,
    year: year,
    province: firstValue_(props, ['Provinsi', 'provinsi', 'PROVINSI']) || 'Riau',
    regency: firstValue_(props, ['Kabupaten', 'kabupaten', 'KABUPATEN', 'Kab_Kota']),
    district: firstValue_(props, ['Kecamatan', 'kecamatan', 'KECAMATAN']),
    village: village,
    areaHa: numberOrBlank_(firstValue_(props, ['Luas_Ha', 'luas_ha', 'Area_Ha', 'area_ha'])),
    lengthM: numberOrBlank_(firstValue_(props, ['Panjang_M', 'panjang_m', 'Length_M'])),
    plantedCount: numberOrBlank_(firstValue_(props, ['Jumlah_Tanam', 'jumlah_tanam', 'Jumlah', 'jumlah'])),
    status: firstValue_(props, ['Status_Objek', 'status_objek', 'Status']) || 'Aktif',
    geometry: geometry,
    properties: props
  };
}

function upsertMasterObject_(object, options) {
  validateMasterObject_(object);

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(OBJECTS_SHEET_NAME);
  const rowNumber = findObjectRowById_(sheet, object.objectId);
  const before = rowNumber ? readObjectFromRow_(sheet.getRange(rowNumber, 1, 1, OBJECT_HEADERS.length).getValues()[0]) : null;
  const revision = before ? Number(before.revision || 0) + 1 : 1;
  const now = new Date();

  const row = objectToRow_(object, now, options.changedBy || ADMIN_EMAIL, revision);

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  const after = Object.assign({}, object, {
    updatedAt: now,
    updatedBy: options.changedBy || ADMIN_EMAIL,
    revision: revision
  });

  if (!options.skipLogWhenUnchanged || JSON.stringify(before) !== JSON.stringify(after)) {
    appendChangeLog_(
      object.objectId,
      options.action || (rowNumber ? 'UPDATE' : 'CREATE'),
      options.reason || '',
      options.changedBy || ADMIN_EMAIL,
      before,
      after
    );
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    created: !rowNumber,
    objectId: object.objectId,
    revision: revision
  };
}

function readMasterObjects_(options) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(OBJECTS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, OBJECT_HEADERS.length)
    .getValues()
    .map(readObjectFromRow_)
    .filter(function(object) {
      return object.objectId && object.geometry &&
        (!options.activeOnly || object.status !== 'Arsip');
    });
}

function objectToRow_(object, updatedAt, updatedBy, revision) {
  return [
    object.objectId,
    object.layerId,
    object.layerLabel,
    object.objectName,
    object.category,
    object.sourceType,
    object.sourceReportId,
    object.program,
    object.phase,
    object.year,
    object.province,
    object.regency,
    object.district,
    object.village,
    object.areaHa,
    object.lengthM,
    object.plantedCount,
    object.status,
    object.geometry.type,
    JSON.stringify(object.geometry),
    JSON.stringify(object.properties || {}),
    updatedAt,
    updatedBy,
    revision
  ];
}

function readObjectFromRow_(row) {
  let geometry = null;
  let properties = {};
  try { geometry = row[19] ? JSON.parse(row[19]) : null; } catch (error) {}
  try { properties = row[20] ? JSON.parse(row[20]) : {}; } catch (error) {}

  return {
    objectId: clean_(row[0]),
    layerId: clean_(row[1]),
    layerLabel: clean_(row[2]),
    objectName: clean_(row[3]),
    category: clean_(row[4]),
    sourceType: clean_(row[5]),
    sourceReportId: clean_(row[6]),
    program: clean_(row[7]),
    phase: clean_(row[8]),
    year: clean_(row[9]),
    province: clean_(row[10]),
    regency: clean_(row[11]),
    district: clean_(row[12]),
    village: clean_(row[13]),
    areaHa: row[14],
    lengthM: row[15],
    plantedCount: row[16],
    status: clean_(row[17]),
    geometryType: clean_(row[18]),
    geometry: geometry,
    properties: properties,
    updatedAt: row[21] instanceof Date
      ? row[21].toISOString()
      : clean_(row[21]),
    updatedBy: clean_(row[22]),
    revision: row[23]
  };
}

function validateMasterObject_(object) {
  if (!object.objectId) throw new Error('Object_ID wajib tersedia.');
  if (!object.objectName) throw new Error('Nama_Objek wajib tersedia.');
  if (!object.layerId) throw new Error('Layer_ID wajib tersedia.');
  if (!object.category) throw new Error('Kategori wajib tersedia.');
  if (!object.geometry || !object.geometry.type) throw new Error('Geometry wajib tersedia.');

  const allowed = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];
  if (allowed.indexOf(object.geometry.type) === -1) {
    throw new Error('Jenis geometry tidak didukung: ' + object.geometry.type);
  }
}

function findObjectRowById_(sheet, objectId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const finder = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(clean_(objectId))
    .matchEntireCell(true)
    .findNext();
  return finder ? finder.getRow() : 0;
}

function appendChangeLog_(objectId, action, reason, changedBy, before, after) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CHANGE_LOG_SHEET_NAME);
  sheet.appendRow([
    new Date(), objectId, action, reason, changedBy,
    before ? JSON.stringify(before) : '',
    after ? JSON.stringify(after) : ''
  ]);
}

function summarizePublishedReports_() {
  const sheet = getSheet_();
  if (!sheet || sheet.getLastRow() < 2) {
    return { published: 0, monitoring: 0, community: 0, monitoredObjects: 0, latestDate: '' };
  }

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 32)
    .getDisplayValues();

  let published = 0;
  let monitoring = 0;
  let community = 0;
  let latestDate = '';
  const monitoredObjects = {};

  rows.forEach(function(row) {
    if (clean_(row[21]) !== 'Sudah Dipublikasikan') return;
    published += 1;

    if (clean_(row[1]) === 'Monitoring') {
      monitoring += 1;
      let changes = {};
      try { changes = row[31] ? JSON.parse(row[31]) : {}; } catch (error) {}
      const objectId = clean_(changes.targetObjectId) || clean_(row[16]);
      if (objectId) monitoredObjects[objectId] = true;
    } else {
      community += 1;
    }

    const dateText = clean_(row[13]) || clean_(row[2]);
    if (dateText && dateText > latestDate) latestDate = dateText;
  });

  return {
    published: published,
    monitoring: monitoring,
    community: community,
    monitoredObjects: Object.keys(monitoredObjects).length,
    latestDate: latestDate
  };
}

function createDatabaseObjectId_(layerId, objectName, geometry, index) {
  const raw = [layerId, objectName, JSON.stringify(geometry), index].join('|');
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );
  const hash = digest.slice(0, 6).map(function(value) {
    const byte = value < 0 ? value + 256 : value;
    return ('0' + byte.toString(16)).slice(-2);
  }).join('').toUpperCase();

  return String(layerId || 'OBJECT').toUpperCase().replace(/[^A-Z0-9]+/g, '-') + '-' + hash;
}

function buildDefaultObjectName_(layerLabel, village, period, number) {
  return [layerLabel, village, period, 'Plot ' + number]
    .filter(Boolean)
    .join(' – ');
}

function firstValue_(object, keys) {
  object = object || {};
  for (let i = 0; i < keys.length; i += 1) {
    const value = object[keys[i]];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function numberOrBlank_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const normalized = String(value).replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : '';
}

function extractYear_(value) {
  const match = String(value || '').match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : '';
}

function roundNumber_(value, decimals) {
  const factor = Math.pow(10, decimals || 0);
  return Math.round(Number(value || 0) * factor) / factor;
}
