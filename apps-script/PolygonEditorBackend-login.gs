/**
 * YG GeoPortal - backend penyimpanan Editor Polygon.
 * Ganti seluruh isi PolygonEditorBackend.gs dengan file ini.
 */

function handleMasterObjectEditorPost_(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const credential = clean_(
      params.sessionToken || params.token || ''
    );
    const reason = clean_(params.reason);

    if (!params.objectData) {
      throw new Error('Data objek tidak ditemukan.');
    }

    let objectData;
    try {
      objectData = JSON.parse(params.objectData);
    } catch (error) {
      throw new Error('Data objek bukan JSON yang valid.');
    }

    const result = updateMasterObject(
      credential,
      objectData,
      reason
    );

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        result: result
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        message: error.message || 'Penyimpanan objek gagal.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

