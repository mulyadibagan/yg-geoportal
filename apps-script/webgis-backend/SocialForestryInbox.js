const YG_PS_ROOT_FOLDER_ID_ = '1YNJksFZLQtVTwJXWfixlCbJE_UH6ZRKS';
const YG_PS_PROFILE_LAYER_PATH_ = 'data/PERHUTANAN_SOSIAL_RIAU.geojson';
const YG_PS_INBOX_PROPERTY_KEY_ = 'YG_PS_INBOX_V1';
const YG_PS_SEEN_PROPERTY_KEY_ = 'YG_PS_SEEN_FILE_IDS_V1';
const YG_PS_NOTIFICATION_EMAILS_ = [ADMIN_EMAIL, 'zamharier@yayasangambut.org'];

function getSocialForestryInbox_(sessionToken) {
  assertEditorCredential_(clean_(sessionToken));
  const scan = scanSocialForestryDrive_({ notify: false });
  const sync = syncApprovedSocialForestryInboxDocuments_(scan.records, { includeUnapproved: true });
  return {
    records: sync.records,
    scannedAt: scan.scannedAt,
    scannedAtLabel: Utilities.formatDate(new Date(scan.scannedAt), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    synchronized: sync.synchronized,
    unmatched: sync.unmatched
  };
}

function syncApprovedSocialForestryInboxDocuments_(records, options) {
  records = Array.isArray(records) ? records : [];
  const settings = options || {};
  const candidates = records.filter(function(row) {
    const status = clean_(row.status) || 'Baru';
    const reviewReady = status === 'Disetujui' || (settings.includeUnapproved && (status === 'Baru' || status === 'Perlu Review'));
    return reviewReady && !clean_(row.profileKey) && !clean_(row.publishedAt);
  });
  if (!candidates.length) return { records: records, synchronized: 0, unmatched: 0 };

  const details = readSocialForestryDetailsFromGitHub_();
  const catalog = readSocialForestryProfileCatalogFromGitHub_(details);
  const resolved = [];
  let added = 0;
  candidates.forEach(function(row) {
    const target = matchSocialForestryInboxProfile_(details, row.psName, row.regency, catalog) ||
      createAuditedSocialForestryInboxProfile_(details, row);
    const document = socialForestryInboxDocument_(row);
    target.profile.documents = Array.isArray(target.profile.documents) ? target.profile.documents : [];
    const exists = target.profile.documents.some(function(item) {
      return driveFileIdFromUrl_(item.url) === clean_(row.fileId) || clean_(item.url) === document.url;
    });
    if (!exists) {
      target.profile.documents.push(document);
      added += 1;
    }
    resolved.push({ row: row, target: target });
  });

  if (added) {
    updateGitHubFile_(
      PS_DOCUMENT_DETAILS_PATH,
      JSON.stringify(details, null, 2) + '\n',
      'Synchronize approved PS inbox documents'
    );
  }
  const publishedAt = new Date().toISOString();
  resolved.forEach(function(item) {
    item.row.status = 'Disetujui';
    item.row.reviewedBy = item.row.reviewedBy || 'Audit Drive otomatis';
    item.row.reviewedAt = item.row.reviewedAt || publishedAt;
    item.row.profileKey = item.target.key;
    item.row.publishedAt = publishedAt;
  });
  if (resolved.length) writeDonorAdminProperty_(YG_PS_INBOX_PROPERTY_KEY_, records);
  return {
    records: records,
    synchronized: resolved.length,
    unmatched: candidates.length - resolved.length
  };
}

function createAuditedSocialForestryInboxProfile_(details, row) {
  const folderParts = clean_(row.psName).split('_');
  const name = clean_(folderParts.shift()) || socialForestryDocumentLabel_(row.fileName);
  const village = clean_(folderParts.join(' ')).replace(/^(?:desa|kelurahan|kepenghuluan|kampung)\s+/i, '');
  const regency = clean_(row.regency).replace(/^\d+[_\s-]*/, '').replace(/_/g, ' ');
  const slug = normalizeSocialForestryInboxName_([regency, name].join(' ')).replace(/\s+/g, '-');
  const key = 'drive-audit:' + slug;
  if (!details[key]) {
    details[key] = {
      name: name,
      village: village,
      district: '',
      regency: regency,
      scheme: 'Profil dokumen nonspasial',
      decree: '',
      areaHa: '',
      source: 'Audit Drive Perhutanan Sosial YG',
      spatialStatus: 'nonspatial',
      documents: []
    };
  }
  return { key: key, profile: details[key], normalized: normalizeSocialForestryInboxName_(name), regency: normalizeSocialForestryInboxRegency_(regency), village: normalizeSocialForestryInboxVillage_(village) };
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
  const scan = scanSocialForestryDrive_({ notify: true });
  return syncApprovedSocialForestryInboxDocuments_(scan.records, { includeUnapproved: true });
}

function synchronizeApprovedSocialForestryInboxFromSecureExecution() {
  const caller = clean_(Session.getActiveUser().getEmail()).toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) throw new Error('Hanya administrator yang dapat menjalankan sinkronisasi massal Data PS.');
  const scan = scanSocialForestryDrive_({ notify: false });
  return syncApprovedSocialForestryInboxDocuments_(scan.records, { includeUnapproved: true });
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
    if (decision === 'approve') publication = publishSocialForestryInboxDocument_(found, clean_(payload.profileKey), clean_(payload.profileName));
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

function publishSocialForestryInboxDocument_(row, requestedProfileKey, requestedProfileName) {
  const details = readSocialForestryDetailsFromGitHub_();
  if (requestedProfileKey) {
    const key = requestedProfileKey.toLowerCase();
    const profile = details[key] || { name: requestedProfileName || clean_(row.psName), documents: [] };
    details[key] = profile;
    return publishSocialForestryDocumentToProfile_(details, key, profile, row);
  }
  const target = matchSocialForestryInboxProfile_(details, row.psName);
  if (!target) {
    throw new Error('Profil PS tujuan tidak dapat dicocokkan secara aman untuk publikasi.');
  }
  return publishSocialForestryDocumentToProfile_(details, target.key, target.profile, row);
}

function matchSocialForestryInboxProfile_(details, psName, regency, catalog) {
  const folderParts = clean_(psName).split('_');
  const incoming = normalizeSocialForestryInboxName_(folderParts.shift());
  const inboxVillage = normalizeSocialForestryInboxVillage_(folderParts.join(' '));
  if (!incoming) return null;
  const area = normalizeSocialForestryInboxRegency_(regency);
  const source = Array.isArray(catalog) && catalog.length ? catalog : Object.keys(details).map(function(key) {
    const profile = details[key] || {};
    return { key: key, profile: profile, normalized: normalizeSocialForestryInboxName_(profile.name), regency: '' };
  });
  function matching(items) {
    const canonicalIncoming = canonicalSocialForestryInboxName_(incoming);
    return items.filter(function(item) {
      const canonicalProfile = canonicalSocialForestryInboxName_(item.normalized);
      return item.normalized && (
        item.normalized === incoming || incoming.indexOf(item.normalized + ' ') === 0 || item.normalized.indexOf(incoming + ' ') === 0 ||
        canonicalProfile === canonicalIncoming || canonicalIncoming.indexOf(canonicalProfile + ' ') === 0 || canonicalProfile.indexOf(canonicalIncoming + ' ') === 0 ||
        canonicalIncoming.indexOf(' ' + canonicalProfile) > -1 || canonicalProfile.indexOf(' ' + canonicalIncoming) > -1
      );
    }).sort(function(a, b) { return b.normalized.length - a.normalized.length; });
  }
  let matches = matching(source.filter(function(item) { return !area || item.regency === area; }));
  if (!matches.length && area) matches = matching(source);
  if (!matches.length && inboxVillage) {
    const villageMatches = source.filter(function(item) {
      return (!area || item.regency === area) && item.village === inboxVillage;
    });
    if (villageMatches.length === 1) matches = villageMatches;
  }
  if (!matches.length || (matches.length > 1 && matches[0].normalized.length === matches[1].normalized.length)) return null;
  const target = matches[0];
  if (!details[target.key]) details[target.key] = target.profile;
  target.profile = details[target.key];
  return target;
}

function readSocialForestryProfileCatalogFromGitHub_(details) {
  const config = getGitHubConfig_();
  const url = 'https://raw.githubusercontent.com/' + encodeURIComponent(config.owner) + '/' +
    encodeURIComponent(config.repo) + '/' + encodeURIComponent(config.branch) + '/' + YG_PS_PROFILE_LAYER_PATH_;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Gagal membaca referensi profil PS: ' + response.getResponseCode());
  const geojson = JSON.parse(response.getContentText());
  return (geojson.features || []).map(function(feature) {
    const props = feature.properties || {};
    let keyValue = props.NO_IUPHKM || props.SK || props.OBJECTID || props.ID ||
      [props.NAMA_HKM, props.NAMA_DESA, props.NAMA_KAB].filter(Boolean).join('|');
    if (typeof keyValue === 'number' && Math.floor(keyValue) === keyValue) keyValue = keyValue.toFixed(1);
    const key = clean_(keyValue).toLowerCase();
    const profile = details[key] || {
      name: clean_(props.NAMA_HKM) || clean_(props.NAMA_DESA) || 'Profil Perhutanan Sosial',
      village: clean_(props.NAMA_DESA),
      district: clean_(props.NAMA_KEC),
      regency: clean_(props.NAMA_KAB),
      scheme: clean_(props.Ket),
      decree: clean_(props.NO_IUPHKM),
      areaHa: props.L_IUPHKM == null ? '' : props.L_IUPHKM,
      documents: []
    };
    return {
      key: key,
      profile: profile,
      normalized: normalizeSocialForestryInboxName_(props.NAMA_HKM),
      regency: normalizeSocialForestryInboxRegency_(props.NAMA_KAB),
      village: normalizeSocialForestryInboxVillage_(props.NAMA_DESA)
    };
  }).filter(function(item) { return item.key && item.normalized; });
}

function normalizeSocialForestryInboxRegency_(value) {
  return clean_(value).toLowerCase().replace(/^\d+[_\s-]*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeSocialForestryInboxVillage_(value) {
  return clean_(value).toLowerCase().replace(/^(?:desa|kelurahan|kepenghuluan|kampung)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonicalSocialForestryInboxName_(value) {
  return clean_(value).toLowerCase()
    .replace(/^koperasi unit desa\s+/, '')
    .replace(/^(?:lphd|kth|kt|gapoktanhut|gapoktan|kud|kelompok nelayan)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function socialForestryInboxDocument_(row) {
  return {
    label: socialForestryDocumentLabel_(row.fileName),
    category: socialForestryCategory_(row.category) || clean_(row.category) || 'Dokumen pendukung',
    url: clean_(row.url)
  };
}

function publishSocialForestryDocumentToProfile_(details, profileKey, profile, row) {
  const document = socialForestryInboxDocument_(row);
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
    profileKey: profileKey,
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
