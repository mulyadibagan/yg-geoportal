/**
 * PATCH Kode.gs — unggah beberapa materi PDF Capacity Building.
 *
 * Di doPost(e), tepat setelah:
 *   const photoUrls = saveImages_(data.images || [], reportId);
 * tambahkan:
 *   const uploadedDocumentUrls = saveCapacityDocuments_(data.documents || [], reportId);
 *   const documentUrls = mergeDocumentUrls_(data.documentUrl, uploadedDocumentUrls);
 *
 * Kemudian pada sheet.appendRow(), ganti:
 *   clean_(data.documentUrl),
 * menjadi:
 *   documentUrls.join('\n'),
 */

function saveCapacityDocuments_(documents, reportId) {
  if (!documents || !documents.length) return [];

  const maxFiles = 10;
  const maxBytesPerFile = 8 * 1024 * 1024;
  const maxTotalBytes = 25 * 1024 * 1024;
  const selected = documents.slice(0, maxFiles);
  let totalBytes = 0;

  selected.forEach(function(document) {
    const size = Number(document && document.size) || 0;
    if (size > maxBytesPerFile) {
      throw new Error('Ukuran setiap PDF maksimal 8 MB.');
    }
    totalBytes += size;
  });

  if (totalBytes > maxTotalBytes) {
    throw new Error('Total seluruh materi PDF maksimal 25 MB.');
  }

  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const reportFolder = getOrCreateReportFolder_(rootFolder, reportId);
  const urls = [];

  selected.forEach(function(document, index) {
    if (!document || !document.dataUrl) return;

    const parts = String(document.dataUrl).match(
      /^data:application\/pdf;base64,(.+)$/i
    );
    if (!parts) {
      throw new Error('Materi ke-' + (index + 1) + ' bukan PDF yang valid.');
    }

    const safeName = String(document.name || ('materi-' + (index + 1) + '.pdf'))
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = 'materi_' + String(index + 1).padStart(2, '0') + '_' + safeName;
    const blob = Utilities.newBlob(
      Utilities.base64Decode(parts[1]),
      'application/pdf',
      filename
    );

    if (blob.getBytes().length > maxBytesPerFile) {
      throw new Error('Ukuran setiap PDF maksimal 8 MB.');
    }

    const file = reportFolder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (error) {
      console.warn('PDF tidak dapat dibuat publik: ' + file.getName());
    }
    urls.push(file.getUrl());
  });

  return urls;
}

function getOrCreateReportFolder_(rootFolder, reportId) {
  const folders = rootFolder.getFoldersByName(reportId);
  const folder = folders.hasNext() ? folders.next() : rootFolder.createFolder(reportId);
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    console.warn('Folder laporan tidak dapat dibuat publik: ' + reportId);
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
