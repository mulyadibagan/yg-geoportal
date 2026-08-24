const YG_PS_ROOT_FOLDER_ID_ = '1YNJksFZLQtVTwJXWfixlCbJE_UH6ZRKS';
const YG_PS_INBOX_PROPERTY_KEY_ = 'YG_PS_INBOX_V1';
const YG_PS_SEEN_PROPERTY_KEY_ = 'YG_PS_SEEN_FILE_IDS_V1';
const YG_PS_NOTIFICATION_EMAILS_ = [ADMIN_EMAIL, 'zamharier@yayasangambut.org'];

function getSocialForestryInbox_(sessionToken) {
  assertEditorCredential_(clean_(sessionToken));
  const scan = scanSocialForestryDrive_({ notify: false });
  return {
    records: scan.records,
    scannedAt: scan.scannedAt,
    scannedAtLabel: Utilities.formatDate(new Date(scan.scannedAt), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  };
}

function scanSocialForestryDrive_(options) {
  const settings = options || {};
  const stored = readDonorAdminProperty_(YG_PS_INBOX_PROPERTY_KEY_, []);
  const byId = {};
  stored.forEach(function(row) { byId[clean_(row.fileId)] = row; });
  const seen = readDonorAdminProperty_(YG_PS_SEEN_PROPERTY_KEY_, []);
  const seenMap = {};
  seen.forEach(function(id) { seenMap[clean_(id)] = true; });
  const discovered = [];
  walkSocialForestryFolder_(DriveApp.getFolderById(YG_PS_ROOT_FOLDER_ID_), [], discovered);
  const newRows = [];
  discovered.forEach(function(row) {
    if (!byId[row.fileId]) {
      byId[row.fileId] = row;
      if (!seenMap[row.fileId]) newRows.push(row);
    }
  });
  const records = Object.keys(byId).map(function(id) { return byId[id]; })
    .sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
    .slice(0, 3000);
  writeDonorAdminProperty_(YG_PS_INBOX_PROPERTY_KEY_, records);
  writeDonorAdminProperty_(YG_PS_SEEN_PROPERTY_KEY_, discovered.map(function(row) { return row.fileId; }).slice(-5000));
  if (settings.notify && newRows.length) emailNewSocialForestryFiles_(newRows);
  return { records: records, newRecords: newRows, scannedAt: new Date().toISOString() };
}

function walkSocialForestryFolder_(folder, path, output) {
  const currentPath = path.concat([folder.getName()]);
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const parts = currentPath.slice(1);
    output.push({
      fileId: file.getId(), fileName: file.getName(), url: file.getUrl(),
      regency: parts[0] || '', psName: parts[1] || '', category: parts[2] || '',
      folderPath: parts.join(' / '), dataDomain: 'social_forestry_profile',
      status: 'Baru', createdAt: file.getDateCreated().toISOString(),
      createdAtLabel: Utilities.formatDate(file.getDateCreated(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
    });
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) walkSocialForestryFolder_(folders.next(), currentPath, output);
}

function emailNewSocialForestryFiles_(rows) {
  const adminUrl = 'https://webgisyg.id/admin-dashboard.html#ps-inbox-title';
  const lines = rows.slice(0, 50).map(function(row, index) {
    return [index + 1 + '. ' + row.fileName, row.regency + ' / ' + row.psName + ' / ' + row.category, row.url].join('\n');
  });
  MailApp.sendEmail({
    to: YG_PS_NOTIFICATION_EMAILS_.join(','),
    subject: '[YG GeoPortal] ' + rows.length + ' Data PS Baru Perlu Ditinjau',
    body: ['Dokumen baru terdeteksi pada Database Perhutanan Sosial.', '', lines.join('\n\n'), '', 'Buka Inbox Data PS:', adminUrl].join('\n')
  });
}

function scheduledSocialForestryDriveScan() {
  return scanSocialForestryDrive_({ notify: true });
}

function installSocialForestryInboxMonitoringFromSecureExecution() {
  const caller = clean_(Session.getActiveUser().getEmail()).toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) throw new Error('Hanya administrator yang dapat memasang pemantauan Data PS.');
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'scheduledSocialForestryDriveScan') ScriptApp.deleteTrigger(trigger);
  });
  scanSocialForestryDrive_({ notify: false });
  ScriptApp.newTrigger('scheduledSocialForestryDriveScan').timeBased().everyHours(1).create();
  return { ok: true, folderId: YG_PS_ROOT_FOLDER_ID_, frequency: 'hourly', notificationEmails: YG_PS_NOTIFICATION_EMAILS_ };
}

function handleSocialForestryInboxPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = clean_(params.requestId).replace(/[^a-zA-Z0-9_-]/g, '');
  try {
    const editor = assertEditorCredential_(clean_(params.sessionToken));
    if (clean_(editor.role).toLowerCase() !== 'admin') throw new Error('Persetujuan Data PS khusus administrator.');
    const payload = JSON.parse(params.payload || '{}');
    const fileId = clean_(payload.fileId);
    const decision = clean_(payload.decision);
    const rows = readDonorAdminProperty_(YG_PS_INBOX_PROPERTY_KEY_, []);
    let found = null;
    rows.forEach(function(row) {
      if (clean_(row.fileId) !== fileId) return;
      found = row;
    });
    if (!found) throw new Error('Dokumen Data PS tidak ditemukan.');
    let publication = null;
    if (decision === 'approve') publication = publishSocialForestryInboxDocument_(found);
    rows.forEach(function(row) {
      if (clean_(row.fileId) !== fileId) return;
      row.status = decision === 'approve' ? 'Disetujui' : 'Perlu Perbaikan';
      row.reviewedBy = clean_(editor.username || editor.email);
      row.reviewedAt = new Date().toISOString();
      if (publication) {
        row.profileKey = publication.profileKey;
        row.publishedAt = row.reviewedAt;
      }
    });
    writeDonorAdminProperty_(YG_PS_INBOX_PROPERTY_KEY_, rows);
    setDonorAdminResult_(requestId, { ok: true, data: { rows: rows, publication: publication } });
  } catch (error) {
    setDonorAdminResult_(requestId, { ok: false, error: error.message || String(error) });
  }
  return donorAdminResponse_({ ok: true, accepted: true });
}

function publishSocialForestryInboxDocument_(row) {
  const details = readSocialForestryDetailsFromGitHub_();
  const incoming = normalizeSocialForestryInboxName_(row.psName);
  const matches = Object.keys(details).map(function(key) {
    const profile = details[key] || {};
    return { key: key, profile: profile, normalized: normalizeSocialForestryInboxName_(profile.name) };
  }).filter(function(item) {
    return item.normalized === incoming || incoming.indexOf(item.normalized + ' ') === 0 || item.normalized.indexOf(incoming + ' ') === 0;
  }).sort(function(a, b) { return b.normalized.length - a.normalized.length; });
  if (!matches.length || (matches.length > 1 && matches[0].normalized.length === matches[1].normalized.length)) {
    throw new Error('Profil PS tujuan tidak dapat dicocokkan secara aman untuk publikasi.');
  }
  const target = matches[0];
  const profile = target.profile;
  const document = {
    label: socialForestryDocumentLabel_(row.fileName),
    category: socialForestryCategory_(row.category) || clean_(row.category) || 'Dokumen pendukung',
    url: clean_(row.url)
  };
  profile.documents = Array.isArray(profile.documents) ? profile.documents : [];
  const exists = profile.documents.some(function(item) {
    return driveFileIdFromUrl_(item.url) === clean_(row.fileId) || clean_(item.url) === document.url;
  });
  let commitSha = '';
  if (!exists) {
    profile.documents.push(document);
    const result = updateGitHubFile_(
      PS_DOCUMENT_DETAILS_PATH,
      JSON.stringify(details, null, 2) + '\n',
      'Publish approved PS document: ' + (clean_(profile.name) || clean_(row.psName))
    );
    commitSha = result && result.commit && result.commit.sha || '';
  }
  return {
    profileKey: target.key,
    profileName: clean_(profile.name) || clean_(row.psName),
    document: document,
    published: !exists,
    commitSha: commitSha
  };
}

function normalizeSocialForestryInboxName_(value) {
  return clean_(value).toLowerCase().replace(/^kt\s+/, 'kth ')
    .replace(/[_-]+/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
