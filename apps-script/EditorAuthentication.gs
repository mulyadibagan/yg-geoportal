/**
 * YG GeoPortal - autentikasi Editor WebGIS.
 *
 * Simpan sebagai file EditorAuthentication.gs pada project Apps Script.
 * Password tidak disimpan dalam source code; hanya hash hasil 2.000 putaran
 * SHA-256 yang tersimpan di sini.
 */
const EDITOR_SESSION_HOURS = 6;
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

function handleEditorAuthPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = clean_(params.action);
  const requestId = clean_(params.requestId).replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    if (action === 'editor-login') {
      return editorLoginResponse_(
        requestId,
        clean_(params.username).toLowerCase(),
        String(params.password || '')
      );
    }

    if (action === 'editor-logout') {
      deleteEditorSession_(clean_(params.sessionToken));
      return editorAuthHtml_({
        ok: true,
        source: 'yg-editor-auth',
        requestId: requestId
      });
    }

    throw new Error('Aksi autentikasi tidak dikenal.');
  } catch (error) {
    return editorAuthHtml_({
      ok: false,
      source: 'yg-editor-auth',
      requestId: requestId,
      message: error.message || 'Autentikasi gagal.'
    });
  }
}

function editorLoginResponse_(requestId, username, password) {
  const user = EDITOR_USERS[username];
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

  return editorAuthHtml_({
    ok: true,
    source: 'yg-editor-auth',
    requestId: requestId,
    sessionToken: sessionToken,
    username: username,
    role: user.role,
    expiresAt: expiresAt
  });
}

function assertEditorCredential_(credential) {
  const value = clean_(credential);

  // Jalur pemulihan untuk dashboard admin lama.
  if (value && typeof ADMIN_TOKEN !== 'undefined' && value === ADMIN_TOKEN) {
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

function editorAuthHtml_(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>' +
    'parent.postMessage(' + json + ', "*");' +
    '<\/script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
