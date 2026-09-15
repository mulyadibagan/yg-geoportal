/**
 * Admin Konten V1.
 * Hanya mengelola narasi publik dan logo mitra. Statistik WebGIS tidak
 * disimpan di sini dan tetap dihitung oleh sistem yang sudah ada.
 */
const YG_CONTENT_PROPERTY_KEY_ = 'YG_PUBLIC_CONTENT_V1';
const YG_CONTENT_RESULT_PREFIX_ = 'YG_CONTENT_SAVE_RESULT_';

function getPublicContent_() {
  const defaults = getPublicContentDefaults_();
  let stored = {};

  try {
    stored = JSON.parse(
      PropertiesService.getScriptProperties()
        .getProperty(YG_CONTENT_PROPERTY_KEY_) || '{}'
    );
  } catch (error) {
    stored = {};
  }

  return Object.assign({}, defaults, sanitizePublicContent_(stored));
}

function getPublicContentDefaults_() {
  return {
    heroEyebrow: 'PLATFORM DATA SPASIAL RESMI YAYASAN GAMBUT',
    heroTitle: 'Platform Data Spasial Yayasan Gambut',
    heroDescription: 'Menyajikan informasi spasial yang terverifikasi untuk mendukung pengelolaan lahan basah, gambut, mangrove, dan ekosistem lainnya secara berkelanjutan melalui restorasi, rehabilitasi, pemantauan lapangan, pemberdayaan masyarakat, serta kemitraan strategis yang berbasis data.',
    heroTagline: 'Menghubungkan data spasial, pemantauan lapangan, dan pelaporan masyarakat dalam satu platform untuk mendukung pengelolaan lahan basah dan ekosistem yang berkelanjutan.',
    programTitle: 'Program Yayasan Gambut',
    fundingTitle: 'Mitra Pendanaan',
    coverageTitle: 'Wilayah Cakupan Program',
    partnerLogos: {}
  };
}

function handleContentAdminPost_(e) {
  const requestId = clean_(e && e.parameter && e.parameter.requestId);

  if (!requestId) {
    return contentAdminResponse_({ ok: false, error: 'Request ID tidak ditemukan.' });
  }

  try {
    const token = clean_(e.parameter.sessionToken);
    const payload = JSON.parse(e.parameter.payload || '{}');
    const content = savePublicContent_(token, payload);
    setContentAdminResult_(requestId, { ok: true, content: content });
  } catch (error) {
    setContentAdminResult_(requestId, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }

  return contentAdminResponse_({ ok: true, accepted: true });
}

function savePublicContent_(token, payload) {
  const editor = assertEditorCredential_(token);

  if (clean_(editor.role).toLowerCase() !== 'admin') {
    throw new Error('Hanya administrator yang dapat mengubah konten publik.');
  }

  const current = getPublicContent_();
  const cleanPayload = sanitizePublicContent_(payload || {});
  const next = Object.assign({}, current, cleanPayload);
  next.partnerLogos = Object.assign({}, current.partnerLogos || {});

  const submittedLogos = payload && payload.partnerLogos;
  if (submittedLogos && typeof submittedLogos === 'object') {
    Object.keys(submittedLogos).forEach(function(partnerKey) {
      if (!isAllowedPartnerLogo_(partnerKey)) return;
      const value = String(submittedLogos[partnerKey] || '').trim();
      if (!value) return;
      next.partnerLogos[partnerKey] = value.indexOf('data:image/') === 0
        ? saveContentLogo_(value, partnerKey)
        : value;
    });
  }

  PropertiesService.getScriptProperties().setProperty(
    YG_CONTENT_PROPERTY_KEY_,
    JSON.stringify(next)
  );

  return next;
}

function sanitizePublicContent_(value) {
  const source = value && typeof value === 'object' ? value : {};
  const allowed = [
    'heroEyebrow', 'heroTitle', 'heroDescription', 'heroTagline',
    'programTitle', 'fundingTitle', 'coverageTitle'
  ];
  const output = {};

  allowed.forEach(function(key) {
    if (source[key] === undefined || source[key] === null) return;
    output[key] = String(source[key]).trim().slice(0, 2500);
  });

  if (source.partnerLogos && typeof source.partnerLogos === 'object') {
    output.partnerLogos = {};
    Object.keys(source.partnerLogos).forEach(function(key) {
      if (!isAllowedPartnerLogo_(key)) return;
      const logo = String(source.partnerLogos[key] || '').trim();
      if (logo && logo.indexOf('data:image/') !== 0) {
        output.partnerLogos[key] = logo;
      }
    });
  }

  return output;
}

function isAllowedPartnerLogo_(key) {
  return [
    'aramco-asia-singapore',
    'global-environment-centre',
    'pan-pacific-conservation-foundation-ppcf',
    'aliansi-kolibri',
    'yayasan-penabulu'
  ].indexOf(String(key || '').toLowerCase()) !== -1;
}

function saveContentLogo_(dataUrl, partnerKey) {
  const match = String(dataUrl).match(
    /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i
  );
  if (!match) throw new Error('Logo harus berupa PNG, JPG, atau WebP.');

  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 3 * 1024 * 1024) {
    throw new Error('Ukuran logo maksimum 3 MB.');
  }

  const root = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const folders = root.getFoldersByName('YG-CONTENT-ASSETS');
  const folder = folders.hasNext()
    ? folders.next()
    : root.createFolder('YG-CONTENT-ASSETS');
  const extension = match[1].toLowerCase().replace('jpeg', 'jpg');
  const blob = Utilities.newBlob(
    bytes,
    'image/' + (extension === 'jpg' ? 'jpeg' : extension),
    partnerKey + '-' + Date.now() + '.' + extension
  );
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    console.warn('Logo tidak dapat dibuat publik: ' + file.getName());
  }

  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
}

function setContentAdminResult_(requestId, result) {
  PropertiesService.getScriptProperties().setProperty(
    YG_CONTENT_RESULT_PREFIX_ + requestId,
    JSON.stringify(result)
  );
}

function getContentSaveResult_(requestId) {
  const key = YG_CONTENT_RESULT_PREFIX_ + clean_(requestId);
  const properties = PropertiesService.getScriptProperties();
  const stored = properties.getProperty(key);
  if (!stored) return { pending: true };
  properties.deleteProperty(key);
  try {
    return JSON.parse(stored);
  } catch (error) {
    return { ok: false, error: 'Hasil penyimpanan tidak valid.' };
  }
}

function contentAdminResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
