/**
 * Trigger the existing GitHub snapshot pipeline after a report is published.
 * GitHub then builds and publishes the public snapshots to Cloudflare R2.
 */
function notifyCloudflarePublication_(reportId) {
  try {
    const config = getGitHubConfig_();
    const endpoint = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo) + '/dispatches';
    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: githubHeaders_(config.token),
      payload: JSON.stringify({ event_type: 'report-published', client_payload: { reportId: clean_(reportId), publishedAt: new Date().toISOString() } })
    });
    const ok = response.getResponseCode() === 204;
    if (!ok) console.error('GitHub snapshot dispatch failed: HTTP ' + response.getResponseCode());
    return { ok: ok, status: response.getResponseCode() };
  } catch (error) {
    console.error('GitHub snapshot dispatch failed: ' + error.message);
    return { ok: false, error: error.message };
  }
}
