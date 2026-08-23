const PS_DRIVE_ROOT_FOLDER_ID = '1YNJksFZLQtVTwJXWfixlCbJE_UH6ZRKS';
const PS_DOCUMENT_DETAILS_PATH = 'data/social-forestry-details.json';
const PS_DOCUMENT_PENDING_PROPERTY = 'PS_DOCUMENT_PENDING_V1';
const PS_DOCUMENT_SYNC_FUNCTION = 'syncSocialForestryDriveDocuments';
const PS_DOCUMENT_REVIEW_EMAIL = 'mulyadi@yayasangambut.org';

function installSocialForestryDriveSync() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === PS_DOCUMENT_SYNC_FUNCTION) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(PS_DOCUMENT_SYNC_FUNCTION).timeBased().everyHours(1).create();
  return syncSocialForestryDriveDocuments();
}

function syncSocialForestryDriveDocuments() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, skipped: true, reason: 'sync_locked' };
  try {
    const details = readSocialForestryDetailsFromGitHub_();
    const pending = getSocialForestryPending_();
    const publishedIds = socialForestryPublishedFileIds_(details);
    const discovered = [];

    Object.keys(details).forEach(function(profileKey) {
      const profile = details[profileKey] || {};
      if (!profile.driveFolderId) return;
      let folder;
      try {
        folder = DriveApp.getFolderById(profile.driveFolderId);
      } catch (error) {
        console.error({ event: 'ps_drive_folder_unavailable', profileKey: profileKey, message: error.message });
        return;
      }
      const categoryFolders = folder.getFolders();
      while (categoryFolders.hasNext()) {
        const categoryFolder = categoryFolders.next();
        const category = socialForestryCategory_(categoryFolder.getName());
        if (!category) continue;
        const files = categoryFolder.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          const fileId = file.getId();
          if (publishedIds[fileId] || pending[fileId]) continue;
          pending[fileId] = {
            fileId: fileId,
            profileKey: profileKey,
            profileName: clean_(profile.name) || folder.getName(),
            category: category,
            label: socialForestryDocumentLabel_(file.getName()),
            fileName: file.getName(),
            url: file.getUrl(),
            driveFolderId: profile.driveFolderId,
            detectedAt: new Date().toISOString(),
            status: 'Menunggu Verifikasi'
          };
          discovered.push(pending[fileId]);
        }
      }
    });

    saveSocialForestryPending_(pending);
    if (discovered.length) sendSocialForestryReviewEmail_(discovered);
    return {
      ok: true,
      rootFolderId: PS_DRIVE_ROOT_FOLDER_ID,
      profilesScanned: Object.keys(details).filter(function(key) { return details[key].driveFolderId; }).length,
      discovered: discovered.length,
      pending: Object.keys(pending).filter(function(id) { return pending[id].status === 'Menunggu Verifikasi'; }).length
    };
  } finally {
    lock.releaseLock();
  }
}

function getSocialForestryDocumentReview_(params) {
  const token = clean_(params && params.token);
  if (!isAdminToken_(token)) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:Arial;color:#b42318">Akses ditolak</h2>');
  }
  const action = clean_(params.action).toLowerCase();
  const fileId = clean_(params.fileId);
  let message = '';
  if (fileId && (action === 'approve' || action === 'reject')) {
    message = reviewSocialForestryDocument_(fileId, action, token);
  }
  return renderSocialForestryReviewPage_(token, message);
}

function reviewSocialForestryDocument_(fileId, action) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const pending = getSocialForestryPending_();
    const item = pending[fileId];
    if (!item) throw new Error('Dokumen tidak ditemukan dalam antrean.');
    if (item.status !== 'Menunggu Verifikasi') return 'Dokumen sudah diproses: ' + item.status;

    if (action === 'reject') {
      item.status = 'Ditolak';
      item.reviewedAt = new Date().toISOString();
      saveSocialForestryPending_(pending);
      return 'Dokumen ditolak dan tidak ditampilkan kepada publik.';
    }

    const details = readSocialForestryDetailsFromGitHub_();
    const profile = details[item.profileKey];
    if (!profile) throw new Error('Profil PS tidak ditemukan pada data publik.');
    profile.documents = Array.isArray(profile.documents) ? profile.documents : [];
    if (!profile.documents.some(function(document) { return driveFileIdFromUrl_(document.url) === fileId; })) {
      profile.documents.push({ label: item.label, category: item.category, url: item.url });
      updateGitHubFile_(
        PS_DOCUMENT_DETAILS_PATH,
        JSON.stringify(details, null, 2) + '\n',
        'Publish verified PS document: ' + item.profileName
      );
    }
    item.status = 'Disetujui';
    item.reviewedAt = new Date().toISOString();
    saveSocialForestryPending_(pending);
    return 'Dokumen disetujui. Pembaruan publik sedang diproses.';
  } finally {
    lock.releaseLock();
  }
}

function renderSocialForestryReviewPage_(token, message) {
  const pending = getSocialForestryPending_();
  const rows = Object.keys(pending).map(function(id) { return pending[id]; })
    .filter(function(item) { return item.status === 'Menunggu Verifikasi'; })
    .sort(function(a, b) { return String(b.detectedAt).localeCompare(String(a.detectedAt)); });
  const base = ScriptApp.getService().getUrl() + '?page=ps-document-review&token=' + encodeURIComponent(token);
  const cards = rows.map(function(item) {
    const approve = base + '&action=approve&fileId=' + encodeURIComponent(item.fileId);
    const reject = base + '&action=reject&fileId=' + encodeURIComponent(item.fileId);
    return '<article><h3>' + escapeSocialForestryHtml_(item.profileName) + '</h3>' +
      '<p><b>' + escapeSocialForestryHtml_(item.category) + '</b><br>' + escapeSocialForestryHtml_(item.fileName) + '</p>' +
      '<p><a href="' + escapeSocialForestryHtml_(item.url) + '" target="_blank">Lihat dokumen</a></p>' +
      '<p><a class="approve" href="' + approve + '">Setujui</a><a class="reject" href="' + reject + '">Tolak</a></p></article>';
  }).join('');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>' +
    'body{font:15px Arial;background:#f4f8f6;color:#123;padding:24px;max-width:900px;margin:auto}h1{color:#075f58}article{background:#fff;border:1px solid #d8e4df;border-radius:14px;padding:18px;margin:14px 0}a{color:#075f58}.approve,.reject{display:inline-block;padding:10px 16px;border-radius:9px;color:#fff;text-decoration:none;margin-right:8px}.approve{background:#168354}.reject{background:#c43d3d}.notice{background:#fff4cf;padding:12px;border-radius:9px}</style></head><body>' +
    '<h1>Verifikasi Dokumen Perhutanan Sosial</h1>' + (message ? '<p class="notice">' + escapeSocialForestryHtml_(message) + '</p>' : '') +
    (cards || '<p>Tidak ada dokumen yang menunggu verifikasi.</p>') + '</body></html>')
    .setTitle('Verifikasi Dokumen PS YG');
}

function readSocialForestryDetailsFromGitHub_() {
  const config = getGitHubConfig_();
  const endpoint = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
    encodeURIComponent(config.repo) + '/contents/' + PS_DOCUMENT_DETAILS_PATH + '?ref=' + encodeURIComponent(config.branch);
  const response = UrlFetchApp.fetch(endpoint, { headers: githubHeaders_(config.token), muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Gagal membaca data PS dari GitHub: ' + response.getResponseCode());
  const payload = JSON.parse(response.getContentText());
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(payload.content.replace(/\s/g, ''))).getDataAsString());
}

function socialForestryPublishedFileIds_(details) {
  const ids = {};
  Object.keys(details).forEach(function(key) {
    (details[key].documents || []).forEach(function(document) {
      const id = driveFileIdFromUrl_(document.url);
      if (id) ids[id] = true;
    });
  });
  return ids;
}

function driveFileIdFromUrl_(url) {
  const match = String(url || '').match(/\/d\/([A-Za-z0-9_-]+)/) || String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function socialForestryCategory_(folderName) {
  const name = clean_(folderName).toLowerCase();
  if (/sk|legal/.test(name)) return 'Legalitas';
  if (/kups/.test(name)) return 'KUPS';
  if (/rkps|rkt|rencana/.test(name)) return 'Rencana kerja';
  if (/peta|spasial/.test(name)) return 'Peta';
  return '';
}

function socialForestryDocumentLabel_(fileName) {
  return clean_(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function getSocialForestryPending_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(PS_DOCUMENT_PENDING_PROPERTY) || '{}');
  } catch (error) {
    return {};
  }
}

function saveSocialForestryPending_(pending) {
  const entries = Object.keys(pending).map(function(id) { return pending[id]; })
    .sort(function(a, b) { return String(b.detectedAt).localeCompare(String(a.detectedAt)); })
    .slice(0, 80);
  const compact = {};
  entries.forEach(function(item) { compact[item.fileId] = item; });
  PropertiesService.getScriptProperties().setProperty(PS_DOCUMENT_PENDING_PROPERTY, JSON.stringify(compact));
}

function sendSocialForestryReviewEmail_(documents) {
  const adminToken = getAdminToken_();
  if (!adminToken) throw new Error('Admin token belum tersedia untuk tautan verifikasi.');
  const reviewUrl = ScriptApp.getService().getUrl() + '?page=ps-document-review&token=' + encodeURIComponent(adminToken);
  const lines = documents.map(function(item) { return '- ' + item.profileName + ' | ' + item.category + ' | ' + item.fileName; });
  MailApp.sendEmail({
    to: PS_DOCUMENT_REVIEW_EMAIL,
    subject: '[YG GeoPortal] ' + documents.length + ' dokumen PS menunggu verifikasi',
    body: ['Dokumen baru ditemukan pada arsip Perhutanan Sosial.', '', lines.join('\n'), '', 'Buka dashboard verifikasi:', reviewUrl, '', 'Dokumen belum tampil kepada publik sebelum disetujui.'].join('\n')
  });
}

function escapeSocialForestryHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
