/**
 * GANTI fungsi updateMasterObject() lama di DatabaseEngine.gs
 * dengan fungsi ini.
 *
 * Perubahan:
 * - Object ID baru dicatat sebagai CREATE_OBJECT.
 * - Object ID yang sudah ada dicatat sebagai UPDATE_OBJECT.
 * - Atribut donor/proyek disimpan konsisten di Properties_JSON.
 * - Identitas sistem pada Properties_JSON diselaraskan dengan kolom OBJECTS.
 */
function updateMasterObject(token, objectData, reason) {
  assertAdmin_(token);
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
    areaHa: numberOrBlank_(objectData.areaHa),
    lengthM: numberOrBlank_(objectData.lengthM),
    plantedCount: numberOrBlank_(objectData.plantedCount),
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
    changedBy: ADMIN_EMAIL
  });
}
