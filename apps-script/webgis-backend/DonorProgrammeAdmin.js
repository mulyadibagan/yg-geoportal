const YG_DONOR_PROGRAMME_PROPERTY_KEY_ = 'YG_DONOR_PROGRAMMES_V1';
const YG_DONOR_ASSIGNMENT_PROPERTY_KEY_ = 'YG_DONOR_ASSIGNMENTS_V1';
const YG_DONOR_EVIDENCE_PROPERTY_KEY_ = 'YG_DONOR_EVIDENCE_V1';
const YG_DONOR_ADMIN_RESULT_PREFIX_ = 'YG_DONOR_ADMIN_RESULT_';

function getDonorProgrammeAdminData_(sessionToken) {
  let staff = null;
  try { staff = assertEditorCredential_(clean_(sessionToken)); } catch (error) {}
  const includePrivateEvidence = Boolean(staff);
  const evidence = readDonorAdminProperty_(YG_DONOR_EVIDENCE_PROPERTY_KEY_, []);
  const evidenceById = {};
  evidence.forEach(function(row) { evidenceById[clean_(row.id)] = row; });
  const assignments = readDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, []).map(function(row) {
    const source = evidenceById[clean_(row.evidenceId)];
    const safeRow = Object.assign({}, row, {
      evidenceUrl: includePrivateEvidence ? clean_(row.evidenceUrl) : ''
    });
    if (!source) return safeRow;
    safeRow.evidenceUrl = includePrivateEvidence ? clean_(source.url) : '';
    safeRow.evidenceType = 'Evidence Nonspasial';
    safeRow.evidenceDocumentType = clean_(source.type);
    return safeRow;
  });
  return {
    programmes: readDonorAdminProperty_(YG_DONOR_PROGRAMME_PROPERTY_KEY_, []),
    assignments: assignments,
    evidence: includePrivateEvidence ? evidence : [],
    authorized: includePrivateEvidence
  };
}

function handleDonorProgrammeAdminPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = clean_(params.requestId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!requestId) return donorAdminResponse_({ ok: false, error: 'Request ID tidak valid.' });

  try {
    const editor = assertEditorCredential_(clean_(params.sessionToken));
    const action = clean_(params.action);
    const role = clean_(editor.role).toLowerCase();
    const staffActions = [
      'donor-evidence-save',
      'donor-assignment-save',
      'donor-assignment-delete'
    ];
    if (role !== 'admin' && staffActions.indexOf(action) === -1) {
      throw new Error('Aksi ini khusus administrator. Staf dapat menambah evidence dan mencocokkannya ke capaian donor.');
    }
    const payload = JSON.parse(params.payload || '{}');
    if (action === 'donor-evidence-save' || action === 'donor-assignment-save') {
      payload.verifiedBy = clean_(editor.username || editor.email || 'staf').slice(0, 200);
      payload.verifiedAt = new Date().toISOString();
      payload.verifiedAtLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    }
    let result;

    if (action === 'donor-programme-save') result = saveDonorProgramme_(payload);
    else if (action === 'donor-evidence-save') result = saveDonorEvidence_(payload);
    else if (action === 'donor-evidence-delete') result = deleteDonorEvidence_(payload);
    else if (action === 'donor-assignment-save') result = saveDonorAssignment_(payload);
    else if (action === 'donor-assignment-delete') result = deleteDonorAssignment_(payload);
    else throw new Error('Aksi admin donor tidak dikenal.');

    setDonorAdminResult_(requestId, { ok: true, data: result });
  } catch (error) {
    setDonorAdminResult_(requestId, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
  return donorAdminResponse_({ ok: true, accepted: true });
}

function saveDonorEvidence_(payload) {
  const uploadedUrl = saveDonorEvidenceFile_(payload && payload.document, payload && payload.id);
  const row = {
    id: clean_(payload && payload.id).slice(0, 120),
    type: clean_(payload && payload.type).slice(0, 160),
    title: clean_(payload && payload.title).slice(0, 1000),
    date: clean_(payload && payload.date).slice(0, 30),
    location: clean_(payload && payload.location).slice(0, 500),
    url: uploadedUrl || clean_(payload && payload.url).slice(0, 3000),
    description: clean_(payload && payload.description).slice(0, 5000),
    verifiedAt: clean_(payload && payload.verifiedAt).slice(0, 80),
    verifiedBy: clean_(payload && payload.verifiedBy).slice(0, 200)
  };
  if (!row.id || !row.type || !row.title || !row.date || !row.url || !row.description) {
    throw new Error('Jenis, judul, tanggal, file laporan, dan ringkasan evidence wajib diisi.');
  }
  if (!/^https:\/\//i.test(row.url)) throw new Error('Tautan evidence harus menggunakan HTTPS.');
  const rows = readDonorAdminProperty_(YG_DONOR_EVIDENCE_PROPERTY_KEY_, [])
    .filter(function(item) { return clean_(item.id) !== row.id; });
  rows.push(row);
  writeDonorAdminProperty_(YG_DONOR_EVIDENCE_PROPERTY_KEY_, rows.slice(-1000));
  return rows.slice(-1000);
}

function saveDonorEvidenceFile_(document, evidenceId) {
  if (!document || !document.dataUrl) return '';
  const maxBytes = 20 * 1024 * 1024;
  if (Number(document.size) > maxBytes) throw new Error('Ukuran file evidence melebihi 20 MB.');

  const match = String(document.dataUrl).match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) throw new Error('Data file evidence tidak valid.');

  const allowedTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  const mimeType = clean_(match[1]).toLowerCase();
  const originalName = clean_(document.name);
  const extensionAllowed = /\.(doc|docx|pdf|xls|xlsx|ppt|pptx|jpe?g|png|webp)$/i.test(originalName);
  if (allowedTypes.indexOf(mimeType) === -1 && !extensionAllowed) {
    throw new Error('Format file evidence belum didukung.');
  }

  const safeName = (originalName || 'evidence')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-180);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(match[2]),
    mimeType === 'application/octet-stream' ? 'application/octet-stream' : mimeType,
    safeName
  );
  if (blob.getBytes().length > maxBytes) throw new Error('Ukuran file evidence melebihi 20 MB.');

  const rootFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const folder = getOrCreateReportFolder_(rootFolder, clean_(evidenceId) || ('EV-NS-' + Date.now()));
  const file = folder.createFile(blob);
  return file.getUrl();
}

function deleteDonorEvidence_(payload) {
  const evidenceId = clean_(payload && payload.evidenceId);
  const inUse = readDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, [])
    .some(function(row) { return clean_(row.evidenceId) === evidenceId; });
  if (inUse) throw new Error('Evidence masih terhubung ke capaian. Batalkan assignment terlebih dahulu.');
  const rows = readDonorAdminProperty_(YG_DONOR_EVIDENCE_PROPERTY_KEY_, [])
    .filter(function(row) { return clean_(row.id) !== evidenceId; });
  writeDonorAdminProperty_(YG_DONOR_EVIDENCE_PROPERTY_KEY_, rows);
  return rows;
}

function saveDonorProgramme_(payload) {
  const donorId = clean_(payload.donorId).slice(0, 120);
  const record = sanitizeDonorProgrammeRecord_(payload.record || {});
  if (!donorId || !record.id || !record.name || !record.period) {
    throw new Error('Donor, ID, judul resmi, dan periode wajib diisi.');
  }
  const rows = readDonorAdminProperty_(YG_DONOR_PROGRAMME_PROPERTY_KEY_, []);
  const filtered = rows.filter(function(item) {
    return !(item.donorId === donorId && item.record && item.record.id === record.id);
  });
  filtered.push({ donorId: donorId, recordId: record.id, record: record, updatedAt: new Date().toISOString() });
  writeDonorAdminProperty_(YG_DONOR_PROGRAMME_PROPERTY_KEY_, filtered);
  return filtered;
}

function saveDonorAssignment_(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const evidenceType = clean_(row.evidenceType).toLowerCase();
  if (row.dataDomain === 'social_forestry_profile' || row.psProfileDocument === true ||
      /sk\s*&?\s*legalitas|profil\s*ps|rkps|rkt|data\s*spasial\s*ps|kelengkapan\s*ps/.test(evidenceType)) {
    throw new Error('Dokumen kelengkapan PS tidak dapat dikaitkan ke kartu donor. Gunakan Inbox Data PS.');
  }
  if (!clean_(row.assignmentId) || !clean_(row.evidenceId) || !clean_(row.programmeId)) {
    throw new Error('Assignment tidak lengkap.');
  }
  const rows = readDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, []);
  rows.push(JSON.parse(JSON.stringify(row)));
  writeDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, rows.slice(-1000));
  return rows.slice(-1000);
}

function deleteDonorAssignment_(payload) {
  const assignmentId = clean_(payload && payload.assignmentId);
  const rows = readDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, [])
    .filter(function(row) { return clean_(row.assignmentId) !== assignmentId; });
  writeDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, rows);
  return rows;
}

function sanitizeDonorProgrammeRecord_(source) {
  const record = source && typeof source === 'object' ? source : {};
  const output = {
    id: clean_(record.id).slice(0, 160),
    phase: clean_(record.phase).slice(0, 120),
    name: clean_(record.name).slice(0, 500),
    period: clean_(record.period).slice(0, 160),
    status: clean_(record.status).slice(0, 80),
    implementingOrganization: clean_(record.implementingOrganization).slice(0, 300),
    locations: Array.isArray(record.locations) ? record.locations.map(function(item) {
      return clean_(item).slice(0, 200);
    }).filter(Boolean).slice(0, 50) : [],
    goal: clean_(record.goal).slice(0, 5000),
    outcome: clean_(record.outcome).slice(0, 5000),
    summary: clean_(record.summary).slice(0, 5000),
    detailsPending: false,
    outputs: []
  };
  output.outputs = (Array.isArray(record.outputs) ? record.outputs : []).slice(0, 100).map(function(item) {
    return {
      id: clean_(item.id).slice(0, 180),
      name: clean_(item.name).slice(0, 1000),
      outcome: clean_(item.outcome).slice(0, 3000),
      activities: (Array.isArray(item.activities) ? item.activities : []).slice(0, 200).map(function(activity) {
        return {
          id: clean_(activity.id).slice(0, 180),
          name: clean_(activity.name).slice(0, 2000),
          indicator: clean_(activity.indicator).slice(0, 2000)
        };
      })
    };
  });
  return output;
}

function readDonorAdminProperty_(key, fallback) {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function writeDonorAdminProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value));
}

function setDonorAdminResult_(requestId, result) {
  PropertiesService.getScriptProperties().setProperty(
    YG_DONOR_ADMIN_RESULT_PREFIX_ + requestId,
    JSON.stringify(result)
  );
}

function getDonorAdminResult_(requestId, sessionToken) {
  try {
    assertEditorCredential_(clean_(sessionToken));
  } catch (error) {
    return { ok: false, error: 'Sesi staf tidak valid.' };
  }
  const key = YG_DONOR_ADMIN_RESULT_PREFIX_ + clean_(requestId);
  const properties = PropertiesService.getScriptProperties();
  const raw = properties.getProperty(key);
  if (!raw) return { pending: true };
  properties.deleteProperty(key);
  try { return JSON.parse(raw); }
  catch (error) { return { ok: false, error: 'Hasil penyimpanan tidak valid.' }; }
}

function donorAdminResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
