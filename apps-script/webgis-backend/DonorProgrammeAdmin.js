const YG_DONOR_PROGRAMME_PROPERTY_KEY_ = 'YG_DONOR_PROGRAMMES_V1';
const YG_DONOR_ASSIGNMENT_PROPERTY_KEY_ = 'YG_DONOR_ASSIGNMENTS_V1';
const YG_DONOR_ADMIN_RESULT_PREFIX_ = 'YG_DONOR_ADMIN_RESULT_';

function getDonorProgrammeAdminData_() {
  return {
    programmes: readDonorAdminProperty_(YG_DONOR_PROGRAMME_PROPERTY_KEY_, []),
    assignments: readDonorAdminProperty_(YG_DONOR_ASSIGNMENT_PROPERTY_KEY_, [])
  };
}

function handleDonorProgrammeAdminPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = clean_(params.requestId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!requestId) return donorAdminResponse_({ ok: false, error: 'Request ID tidak valid.' });

  try {
    const editor = assertEditorCredential_(clean_(params.sessionToken));
    if (clean_(editor.role).toLowerCase() !== 'admin') {
      throw new Error('Hanya administrator yang dapat mengubah konfigurasi program.');
    }
    const payload = JSON.parse(params.payload || '{}');
    const action = clean_(params.action);
    let result;

    if (action === 'donor-programme-save') result = saveDonorProgramme_(payload);
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

function getDonorAdminResult_(requestId) {
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
