/**
 * YG GeoPortal - GitHub Sync
 * Tambahkan sebagai file baru bernama GitHubSync.gs.
 * Token GitHub disimpan di Script Properties, jangan ditulis di kode.
 */

function handleGitHubSyncPost_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const token = clean_(params.token);

  assertAdmin_(token);

  const path = normalizeGitHubPath_(params.path);
  const content = String(params.content || '');
  const message = clean_(params.message);

  if (!path || !/^data\/[A-Za-z0-9._-]+\.geojson$/i.test(path)) {
    throw new Error('Path GeoJSON tidak diizinkan.');
  }

  if (!content) {
    throw new Error('Isi GeoJSON kosong.');
  }

  if (!message) {
    throw new Error('Alasan perubahan wajib diisi.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error('GeoJSON tidak valid: ' + error.message);
  }

  validateGeoJsonForGitHub_(parsed);

  const result = updateGitHubFile_(path, JSON.stringify(parsed, null, 2), message);

  return githubSyncResponse_({
    source: 'YG_GITHUB_SYNC',
    ok: true,
    path: path,
    commitSha: result.commit && result.commit.sha || '',
    contentSha: result.content && result.content.sha || ''
  });
}

function githubSyncResponse_(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>' +
    'window.parent.postMessage(' + json + ', "*");' +
    '</script></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function githubSyncErrorResponse_(error) {
  return githubSyncResponse_({
    source: 'YG_GITHUB_SYNC',
    ok: false,
    message: error && error.message ? error.message : String(error)
  });
}

function updateGitHubFile_(path, content, message) {
  const config = getGitHubConfig_();
  const endpoint =
    'https://api.github.com/repos/' +
    encodeURIComponent(config.owner) + '/' +
    encodeURIComponent(config.repo) + '/contents/' +
    path.split('/').map(encodeURIComponent).join('/');

  const currentResponse = UrlFetchApp.fetch(
    endpoint + '?ref=' + encodeURIComponent(config.branch),
    {
      method: 'get',
      headers: githubHeaders_(config.token),
      muteHttpExceptions: true
    }
  );

  const currentCode = currentResponse.getResponseCode();
  let current = {};

  if (currentCode === 200) {
    current = JSON.parse(currentResponse.getContentText());
  } else if (currentCode !== 404) {
    throw new Error(
      'Gagal membaca file GitHub (' + currentCode + '): ' +
      currentResponse.getContentText().slice(0, 300)
    );
  }

  const payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: config.branch,
    committer: {
      name: config.committerName,
      email: config.committerEmail
    }
  };

  if (current.sha) payload.sha = current.sha;

  const updateResponse = UrlFetchApp.fetch(endpoint, {
    method: 'put',
    contentType: 'application/json',
    headers: githubHeaders_(config.token),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const updateCode = updateResponse.getResponseCode();
  const body = updateResponse.getContentText();

  if (updateCode !== 200 && updateCode !== 201) {
    throw new Error(
      'GitHub menolak perubahan (' + updateCode + '): ' +
      body.slice(0, 500)
    );
  }

  return JSON.parse(body);
}

function githubHeaders_(token) {
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'YG-GeoPortal-Apps-Script'
  };
}

function getGitHubConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const config = {
    token: clean_(properties.getProperty('GITHUB_TOKEN')),
    owner: clean_(properties.getProperty('GITHUB_OWNER')) || 'mulyadibagan',
    repo: clean_(properties.getProperty('GITHUB_REPO')) || 'yg-geoportal',
    branch: clean_(properties.getProperty('GITHUB_BRANCH')) || 'main',
    committerName: clean_(properties.getProperty('GITHUB_COMMITTER_NAME')) || 'YG GeoPortal Admin',
    committerEmail: clean_(properties.getProperty('GITHUB_COMMITTER_EMAIL')) || ADMIN_EMAIL
  };

  if (!config.token) {
    throw new Error('GITHUB_TOKEN belum diatur di Script Properties.');
  }

  return config;
}

function normalizeGitHubPath_(value) {
  return clean_(value)
    .replace(/^\.?\//, '')
    .replace(/\\/g, '/');
}

function validateGeoJsonForGitHub_(data) {
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Data harus berupa GeoJSON FeatureCollection.');
  }

  const ids = {};

  data.features.forEach(function(feature, index) {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) {
      throw new Error('Feature ke-' + (index + 1) + ' tidak valid.');
    }

    const properties = feature.properties || {};
    const objectId = clean_(properties.Object_ID);
    const objectName = clean_(properties.Nama_Objek);

    if (!objectId) {
      throw new Error('Feature ke-' + (index + 1) + ' belum memiliki Object_ID.');
    }

    if (!objectName) {
      throw new Error('Feature ke-' + (index + 1) + ' belum memiliki Nama_Objek.');
    }

    if (ids[objectId]) {
      throw new Error('Object_ID duplikat: ' + objectId);
    }

    ids[objectId] = true;
  });

  return true;
}

/** Jalankan sekali untuk mengecek konfigurasi GitHub. */
function testGitHubConnection() {
  const config = getGitHubConfig_();
  const url =
    'https://api.github.com/repos/' +
    encodeURIComponent(config.owner) + '/' +
    encodeURIComponent(config.repo);

  const response = UrlFetchApp.fetch(url, {
    headers: githubHeaders_(config.token),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Koneksi GitHub gagal (' + code + '): ' + response.getContentText());
  }

  const repository = JSON.parse(response.getContentText());
  console.log(JSON.stringify({
    ok: true,
    repository: repository.full_name,
    defaultBranch: repository.default_branch
  }, null, 2));

  return true;
}
