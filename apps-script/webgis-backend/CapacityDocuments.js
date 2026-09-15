/**
 * Upload maksimal 6 materi PDF.
 * Maksimal ukuran setiap PDF: 25 MB.
 */
function saveCapacityDocuments_(documents, reportId) {
  if (!documents || !documents.length) return [];

  const maxFiles = 6;
  const maxBytesPerFile = 25 * 1024 * 1024;
  const maxTotalBytes = maxFiles * maxBytesPerFile;

  if (documents.length > maxFiles) {
    throw new Error('Maksimal 6 materi PDF dapat diunggah.');
  }

  const selected = documents.slice(0, maxFiles);
  let totalBytes = 0;

  selected.forEach(function(document, index) {
    const size = Number(document && document.size) || 0;

    if (size > maxBytesPerFile) {
      throw new Error(
        'Materi ke-' + (index + 1) +
        ' melebihi batas maksimal 25 MB.'
      );
    }

    totalBytes += size;
  });

  if (totalBytes > maxTotalBytes) {
    throw new Error(
      'Total ukuran seluruh materi melebihi batas 150 MB.'
    );
  }

  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const reportFolder = getOrCreateReportFolder_(
    rootFolder,
    reportId
  );

  const urls = [];

  selected.forEach(function(document, index) {
    if (!document || !document.dataUrl) return;

    const parts = String(document.dataUrl).match(
      /^data:application\/pdf;base64,(.+)$/i
    );

    if (!parts) {
      throw new Error(
        'Materi ke-' + (index + 1) +
        ' bukan file PDF yang valid.'
      );
    }

    const safeName = String(
      document.name || ('materi-' + (index + 1) + '.pdf')
    ).replace(/[^a-zA-Z0-9._-]/g, '_');

    const filename =
      'materi_' +
      String(index + 1).padStart(2, '0') +
      '_' +
      safeName;

    const blob = Utilities.newBlob(
      Utilities.base64Decode(parts[1]),
      'application/pdf',
      filename
    );

    if (blob.getBytes().length > maxBytesPerFile) {
      throw new Error(
        'Materi ke-' + (index + 1) +
        ' melebihi batas maksimal 25 MB.'
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
        'PDF tidak dapat dibuat publik: ' + file.getName()
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
      'Folder laporan tidak dapat dibuat publik: ' + reportId
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