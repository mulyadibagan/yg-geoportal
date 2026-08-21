/**
 * YG GeoPortal - autentikasi Editor WebGIS.
 *
 * Simpan sebagai file EditorAuthentication.gs pada project Apps Script.
 * Password tidak disimpan dalam source code; hanya hash hasil 2.000 putaran
 * SHA-256 yang tersimpan di sini.
 */
const EDITOR_SESSION_HOURS = 12;
const STAFF_ACTIVATION_LINK_MINUTES = 30;
const STAFF_PASSWORD_RESET_MINUTES = 30;
const STAFF_PORTAL_URL = 'https://webgisyg.id/staff-login.html';
const EDITOR_PASSWORD_SALT = 'YG-EDITOR-2026';
const EDITOR_USERS = {
  mulyadi: {
    name: 'Mulyadi',
    email: 'mulyadi@yayasangambut.org',
    role: 'admin',
    passwordHash: 'fc4c7cdf2f46c6efa7d90f3948bc029ac344a62ea2bea5a0f87d53d1ffc67745'
  },
  zamharir: {
    name: 'Zamharir',
    email: 'zamharier@yayasangambut.org',
    role: 'gis',
    passwordHash: '6fbeee6ffd3afc068e525ce089047e5f8ebb2fccb91ed16f2e9a5a434826c7e1'
  }
};

function cleanupExpiredAuthProperties() {
  const caller = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (caller !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Only the configured administrator may clean authentication properties.');
  }
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  const now = Date.now();
  let deleted = 0;
  Object.keys(all).forEach(function(key) {
    if (
      key.indexOf('EDITOR_SESSION_') !== 0 &&
      key.indexOf('EDITOR_LOGIN_RESULT_') !== 0 &&
      key.indexOf('STAFF_ACTIVATION_') !== 0 &&
      key.indexOf('STAFF_PASSWORD_RESET_') !== 0
    ) return;
    let value = {};
    try { value = JSON.parse(all[key] || '{}'); } catch (error) {}
    const expiresAt = Number(value.expiresAt || 0);
    const createdAt = Number(value.createdAt || 0);
    const expiredSession = key.indexOf('EDITOR_SESSION_') === 0 && (!expiresAt || expiresAt <= now);
    const staleResult = key.indexOf('EDITOR_LOGIN_RESULT_') === 0 && (!createdAt || now - createdAt > 10 * 60 * 1000);
    const expiredActivation = key.indexOf('STAFF_ACTIVATION_') === 0 && (!expiresAt || expiresAt <= now);
    const expiredReset = key.indexOf('STAFF_PASSWORD_RESET_') === 0 && (!expiresAt || expiresAt <= now);
    if (expiredSession || staleResult || expiredActivation || expiredReset) {
      properties.deleteProperty(key);
      deleted += 1;
    }
  });
  return { ok: true, deleted: deleted, remaining: Object.keys(properties.getProperties()).length };
}

function handleEditorAuthPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = clean_(params.action);
  const requestId = clean_(params.requestId).replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    if (action === 'editor-login') {
      const result = createEditorLoginResult_(
          requestId,
          clean_(params.username).toLowerCase(),
          String(params.password || '')
        );
      storeEditorAuthResult_(requestId, result);
      return editorAuthTransportResponse_(params, result);
    }

    if (action === 'staff-register') {
      const result = requestStaffActivation_(
        requestId,
        clean_(params.username).toLowerCase(),
        clean_(params.email).toLowerCase(),
        String(params.password || '')
      );
      storeEditorAuthResult_(requestId, result);
      return editorAuthTransportResponse_(params, result);
    }

    if (action === 'staff-activate') {
      const result = activateStaffAccount_(
        requestId,
        clean_(params.activationToken)
      );
      storeEditorAuthResult_(requestId, result);
      return editorAuthTransportResponse_(params, result);
    }

    if (action === 'staff-password-reset-request') {
      const result = requestStaffPasswordReset_(requestId, clean_(params.email).toLowerCase());
      storeEditorAuthResult_(requestId, result);
      return editorAuthTransportResponse_(params, result);
    }

    if (action === 'staff-password-reset') {
      const result = resetStaffPassword_(requestId, clean_(params.resetToken), String(params.password || ''));
      storeEditorAuthResult_(requestId, result);
      return editorAuthTransportResponse_(params, result);
    }

    if (action === 'editor-logout') {
      deleteEditorSession_(clean_(params.sessionToken));
      return editorAuthTransportResponse_(params, { ok: true, requestId: requestId });
    }

    throw new Error('Aksi autentikasi tidak dikenal.');
  } catch (error) {
    const result = {
      ok: false,
      requestId: requestId,
      message: error.message || 'Autentikasi gagal.'
    };
    if (requestId) storeEditorAuthResult_(requestId, result);
    return editorAuthTransportResponse_(params, result);
  }
}

function requestStaffActivation_(requestId, username, email, password) {
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('Username harus 3–32 karakter dan diawali huruf.');
  }
  if (!isOfficialStaffEmail_(email)) {
    throw new Error('Gunakan email aktif @yayasangambut.org.');
  }
  if (String(password || '').length < 10) {
    throw new Error('Password minimal 10 karakter.');
  }
  if (getEditorUser_(username)) {
    throw new Error('Username sudah digunakan. Silakan login.');
  }
  if (findEditorUserByEmail_(email)) {
    throw new Error('Email ini sudah memiliki akun. Silakan login.');
  }

  const activationToken = Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');
  const now = Date.now();
  const record = {
    username: username,
    email: email,
    passwordHash: hashEditorPassword_(username, password),
    createdAt: now,
    expiresAt: now + STAFF_ACTIVATION_LINK_MINUTES * 60 * 1000
  };
  PropertiesService.getScriptProperties().setProperty(
    staffActivationKey_(activationToken),
    JSON.stringify(record)
  );

  const activationUrl = STAFF_PORTAL_URL + '?activationToken=' + encodeURIComponent(activationToken);
  MailApp.sendEmail({
    to: email,
    subject: '[YG GeoPortal] Aktivasi akun staf',
    body: [
      'Aktifkan akun staf YG GeoPortal dengan username: ' + username,
      '',
      activationUrl,
      '',
      'Tautan hanya dapat digunakan satu kali dan berlaku selama ' +
        STAFF_ACTIVATION_LINK_MINUTES + ' menit.',
      'Setelah akun aktif, login berikutnya cukup menggunakan username dan password.',
      '',
      'Abaikan email ini jika Anda tidak meminta akses.'
    ].join('\n'),
    name: 'YG GeoPortal'
  });

  return {
    ok: true,
    requestId: requestId,
    emailSent: true,
    message: 'Tautan aktivasi telah dikirim ke email Anda.'
  };
}

function activateStaffAccount_(requestId, activationToken) {
  if (!activationToken) throw new Error('Tautan aktivasi tidak valid.');
  const properties = PropertiesService.getScriptProperties();
  const key = staffActivationKey_(activationToken);
  const raw = properties.getProperty(key);
  properties.deleteProperty(key);
  if (!raw) throw new Error('Tautan aktivasi tidak valid atau sudah digunakan.');

  let login;
  try { login = JSON.parse(raw); } catch (error) {
    throw new Error('Tautan masuk tidak valid.');
  }
  if (!login.expiresAt || Number(login.expiresAt) <= Date.now()) {
    throw new Error('Tautan aktivasi telah kedaluwarsa. Silakan daftar kembali.');
  }
  if (!isOfficialStaffEmail_(login.email)) {
    throw new Error('Email staf tidak diizinkan.');
  }

  if (getEditorUser_(login.username) || findEditorUserByEmail_(login.email)) {
    throw new Error('Akun sudah aktif. Silakan login.');
  }
  properties.setProperty(staffUserKey_(login.username), JSON.stringify({
    name: login.username,
    email: login.email,
    role: 'operator',
    passwordHash: login.passwordHash,
    active: true,
    activatedAt: Date.now()
  }));
  return {
    ok: true,
    requestId: requestId,
    activated: true,
    username: login.username,
    message: 'Akun berhasil diaktifkan. Silakan login dengan username dan password.'
  };
}

function isOfficialStaffEmail_(email) {
  return /^[^\s@]+@yayasangambut\.org$/i.test(String(email || ''));
}

function staffActivationKey_(activationToken) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(activationToken),
    Utilities.Charset.UTF_8
  );
  return 'STAFF_ACTIVATION_' + bytesToHex_(digest);
}

function staffPasswordResetKey_(resetToken) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(resetToken),
    Utilities.Charset.UTF_8
  );
  return 'STAFF_PASSWORD_RESET_' + bytesToHex_(digest);
}

function staffUserKey_(username) {
  return 'STAFF_USER_' + String(username || '').toLowerCase();
}

function getEditorUser_(username) {
  const cleanUsername = clean_(username).toLowerCase();
  const raw = PropertiesService.getScriptProperties().getProperty(staffUserKey_(cleanUsername));
  if (raw) {
    try {
      const user = JSON.parse(raw);
      if (user && user.active) return user;
    } catch (error) {}
  }
  return EDITOR_USERS[cleanUsername] || null;
}

function findEditorIdentityByEmail_(email) {
  const target = clean_(email).toLowerCase();
  const properties = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(properties).filter(function(key) { return key.indexOf('STAFF_USER_') === 0; });
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const user = JSON.parse(properties[keys[index]] || '{}');
      if (user.active && clean_(user.email).toLowerCase() === target) {
        return { username: keys[index].slice('STAFF_USER_'.length).toLowerCase(), user: user };
      }
    } catch (error) {}
  }
  const username = Object.keys(EDITOR_USERS).find(function(key) {
    return clean_(EDITOR_USERS[key].email).toLowerCase() === target;
  });
  return username ? { username: username, user: EDITOR_USERS[username] } : null;
}

function findEditorUserByEmail_(email) {
  const identity = findEditorIdentityByEmail_(email);
  return identity ? identity.user : null;
}

function requestStaffPasswordReset_(requestId, email) {
  const generic = {
    ok: true,
    requestId: requestId,
    message: 'Jika email terdaftar, tautan reset password telah dikirim.'
  };
  if (!isOfficialStaffEmail_(email)) return generic;
  const identity = findEditorIdentityByEmail_(email);
  if (!identity) return generic;

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = Date.now();
  PropertiesService.getScriptProperties().setProperty(staffPasswordResetKey_(token), JSON.stringify({
    username: identity.username,
    email: email,
    createdAt: now,
    expiresAt: now + STAFF_PASSWORD_RESET_MINUTES * 60 * 1000
  }));
  const resetUrl = STAFF_PORTAL_URL + '?resetToken=' + encodeURIComponent(token);
  MailApp.sendEmail({
    to: email,
    subject: '[YG GeoPortal] Reset password akun staf',
    body: [
      'Permintaan reset password akun staf YG GeoPortal diterima.',
      '',
      resetUrl,
      '',
      'Tautan hanya dapat digunakan satu kali dan berlaku selama ' + STAFF_PASSWORD_RESET_MINUTES + ' menit.',
      'Abaikan email ini jika Anda tidak meminta reset password.'
    ].join('\n'),
    name: 'YG GeoPortal'
  });
  return generic;
}

function resetStaffPassword_(requestId, resetToken, password) {
  if (!resetToken) throw new Error('Tautan reset password tidak valid.');
  if (String(password || '').length < 10) throw new Error('Password minimal 10 karakter.');
  const properties = PropertiesService.getScriptProperties();
  const key = staffPasswordResetKey_(resetToken);
  const raw = properties.getProperty(key);
  properties.deleteProperty(key);
  if (!raw) throw new Error('Tautan reset password tidak valid atau sudah digunakan.');
  let record;
  try { record = JSON.parse(raw); } catch (error) { throw new Error('Tautan reset password tidak valid.'); }
  if (!record.expiresAt || Number(record.expiresAt) <= Date.now()) {
    throw new Error('Tautan reset password telah kedaluwarsa. Silakan minta tautan baru.');
  }
  const current = getEditorUser_(record.username);
  if (!current || clean_(current.email).toLowerCase() !== clean_(record.email).toLowerCase()) {
    throw new Error('Akun staf tidak ditemukan.');
  }
  properties.setProperty(staffUserKey_(record.username), JSON.stringify({
    name: current.name || record.username,
    email: record.email,
    role: current.role || 'operator',
    passwordHash: hashEditorPassword_(record.username, password),
    active: true,
    passwordUpdatedAt: Date.now()
  }));
  Object.keys(properties.getProperties()).forEach(function(propertyKey) {
    if (propertyKey.indexOf('EDITOR_SESSION_') !== 0) return;
    try {
      const session = JSON.parse(properties.getProperty(propertyKey) || '{}');
      if (clean_(session.username).toLowerCase() === clean_(record.username).toLowerCase()) {
        properties.deleteProperty(propertyKey);
      }
    } catch (error) {}
  });
  return { ok: true, requestId: requestId, message: 'Password berhasil diperbarui. Silakan login.' };
}

function createEditorLoginResult_(requestId, username, password) {
  const user = getEditorUser_(username);
  const suppliedHash = hashEditorPassword_(username, password);

  if (!user || !constantTimeEquals_(suppliedHash, user.passwordHash)) {
    Utilities.sleep(350);
    throw new Error('Username atau password tidak benar.');
  }

  const now = Date.now();
  const expiresAt = now + EDITOR_SESSION_HOURS * 60 * 60 * 1000;
  const sessionToken =
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');

  const session = {
    username: username,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: now,
    expiresAt: expiresAt
  };

  PropertiesService.getScriptProperties().setProperty(
    editorSessionKey_(sessionToken),
    JSON.stringify(session)
  );

  return {
    ok: true,
    requestId: requestId,
    sessionToken: sessionToken,
    username: username,
    role: user.role,
    expiresAt: expiresAt
  };
}

function getEditorAuthResult_(requestId) {
  const cleanRequestId = clean_(requestId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanRequestId) return { ok: false, message: 'Request ID tidak valid.' };

  const properties = PropertiesService.getScriptProperties();
  const key = editorAuthResultKey_(cleanRequestId);
  const raw = properties.getProperty(key);
  if (!raw) return { pending: true };

  properties.deleteProperty(key);
  try {
    const result = JSON.parse(raw);
    if (Date.now() - Number(result.createdAt || 0) > 60000) {
      return { ok: false, message: 'Permintaan login telah kedaluwarsa.' };
    }
    delete result.createdAt;
    return result;
  } catch (error) {
    return { ok: false, message: 'Hasil login tidak valid.' };
  }
}

function storeEditorAuthResult_(requestId, result) {
  if (!requestId) return;
  const stored = Object.assign({ createdAt: Date.now() }, result);
  PropertiesService.getScriptProperties().setProperty(
    editorAuthResultKey_(requestId),
    JSON.stringify(stored)
  );
}

function editorAuthResultKey_(requestId) {
  return 'EDITOR_LOGIN_RESULT_' + requestId;
}

function assertEditorCredential_(credential) {
  const value = clean_(credential);

  // Jalur pemulihan untuk dashboard admin lama.
  if (value && typeof isAdminToken_ === 'function' && isAdminToken_(value)) {
    return {
      username: 'admin-legacy',
      name: 'Administrator',
      email: ADMIN_EMAIL,
      role: 'admin'
    };
  }

  if (!value) throw new Error('Sesi editor tidak ditemukan. Silakan login kembali.');

  const properties = PropertiesService.getScriptProperties();
  const key = editorSessionKey_(value);
  const raw = properties.getProperty(key);
  if (!raw) throw new Error('Sesi editor tidak valid. Silakan login kembali.');

  let session;
  try {
    session = JSON.parse(raw);
  } catch (error) {
    properties.deleteProperty(key);
    throw new Error('Sesi editor tidak valid. Silakan login kembali.');
  }

  if (!session.expiresAt || Number(session.expiresAt) <= Date.now()) {
    properties.deleteProperty(key);
    throw new Error('Sesi editor telah berakhir. Silakan login kembali.');
  }

  return session;
}

function deleteEditorSession_(sessionToken) {
  const value = clean_(sessionToken);
  if (!value) return;
  PropertiesService.getScriptProperties().deleteProperty(editorSessionKey_(value));
}

function editorSessionKey_(sessionToken) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(sessionToken),
    Utilities.Charset.UTF_8
  );
  return 'EDITOR_SESSION_' + bytesToHex_(digest);
}

function hashEditorPassword_(username, password) {
  let value = username + '|' + EDITOR_PASSWORD_SALT + '|' + password;

  for (let index = 0; index < 2000; index += 1) {
    value = bytesToHex_(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      value,
      Utilities.Charset.UTF_8
    ));
  }
  return value;
}

function bytesToHex_(bytes) {
  return bytes.map(function(value) {
    const byte = value < 0 ? value + 256 : value;
    return ('0' + byte.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function editorAuthAccepted_() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, accepted: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function editorAuthTransportResponse_(params, result) {
  if (clean_(params && params.transport) !== 'iframe') {
    return editorAuthAccepted_();
  }
  const safeResult = JSON.stringify(result || { ok: false, message: 'Autentikasi gagal.' })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>' +
    'parent.postMessage(' + safeResult + ',"https://webgisyg.id");' +
    '<\/script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
