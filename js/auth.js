(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
  const AUTH_RESULT_APIS = [
    "https://webgis-api.yayasangambut.org/api/staff/auth-result",
    "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/staff/auth-result"
  ];
  const SESSION_KEY = "ygEditorSessionV1";
  const AUTH_RESULT_DEADLINE_MS = 45000;
  const AUTH_RESULT_REQUEST_TIMEOUT_MS = 30000;
  const AUTH_POST_TIMEOUT_MS = 45000;

  function readStoredSession() {
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
      if (!stored || !stored.token || !stored.username || !stored.expiresAt) return null;
      if (!Number.isFinite(Number(stored.expiresAt)) || Number(stored.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      sessionStorage.removeItem(SESSION_KEY);
      return stored;
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function callbackLoad(url, timeoutMs = AUTH_RESULT_REQUEST_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const callback = "ygAuthCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Waktu koneksi habis."));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (e) {}
      }

      window[callback] = data => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("Hasil autentikasi belum dapat dimuat."));
      };
      script.src = url + (url.includes("?") ? "&" : "?") +
        "callback=" + encodeURIComponent(callback) + "&t=" + Date.now();
      document.head.appendChild(script);
    });
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function postAuthRequest(action, fields, onProgress, directResult = false) {
    const requestId = "yg-auth-" + crypto.randomUUID();
    const startedAt = Date.now();
    if (onProgress) onProgress("Mengirim permintaan login…");
    const body = new URLSearchParams({ action, requestId, ...(fields || {}) });
    let postError = null;
    const postPromise = fetchWithTimeout(API, {
      method: "POST",
      mode: "no-cors",
      body,
      keepalive: action === "editor-logout"
    }, AUTH_POST_TIMEOUT_MS).catch(error => {
      // A no-cors request can be accepted upstream even when the browser does
      // not receive its opaque response. Continue polling by request ID.
      postError = error;
    });
    if (action === "editor-logout") {
      postPromise.catch(() => {});
      return { ok: true };
    }

    const deadline = startedAt + AUTH_RESULT_DEADLINE_MS;
    let lastLoadError = null;
    let endpointIndex = 0;
    let nextPollDelay = 0;
    while (Date.now() < deadline) {
      if (nextPollDelay) await new Promise(resolve => setTimeout(resolve, Math.min(nextPollDelay, Math.max(0, deadline - Date.now()))));
      if (Date.now() >= deadline) break;
      nextPollDelay = 600;
      if (onProgress) onProgress("Menunggu verifikasi akun… " + Math.floor((Date.now() - startedAt) / 1000) + " detik");
      try {
        // Apps Script consumes each result once. Never race two readers:
        // a fast pending response could discard the only successful result.
        const endpoint = AUTH_RESULT_APIS[endpointIndex];
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(
          AUTH_RESULT_REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())
        ));
        let result;
        try {
          if (directResult) {
            result = await callbackLoad(`${API}?page=editor-auth-result&requestId=${encodeURIComponent(requestId)}`, Math.min(AUTH_RESULT_REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())));
          } else {
            const response = await fetch(
              `${endpoint}?requestId=${encodeURIComponent(requestId)}&t=${Date.now()}`,
              { cache: "no-store", signal: controller.signal }
            );
            if (!response.ok) throw new Error("Hasil autentikasi belum dapat dimuat.");
            result = await response.json();
          }
          if (!result || typeof result !== "object" ||
              (result.pending !== true && typeof result.ok !== "boolean")) {
            throw new Error("Hasil autentikasi belum dapat dimuat.");
          }
        } catch (error) {
          // Fail over only after the previous read has settled or been aborted.
          endpointIndex = (endpointIndex + 1) % AUTH_RESULT_APIS.length;
          throw new Error("Hasil autentikasi belum dapat dimuat.");
        } finally {
          clearTimeout(timer);
        }
        lastLoadError = null;
        if (result && result.pending) continue;
        if (result && result.ok) return result;
        throw new Error(result?.message || "Autentikasi gagal.");
      } catch (error) {
        if (error && error.message && !/belum dapat dimuat|koneksi habis/i.test(error.message)) throw error;
        lastLoadError = error;
      }
    }
    if (lastLoadError || postError) throw new Error("Layanan login belum merespons. Periksa koneksi dan coba lagi; akun belum diverifikasi.");
    throw new Error("Verifikasi belum selesai dalam 45 detik. Silakan coba lagi; akun belum diverifikasi.");
  }

  async function login(username, password, onProgress) {
    const startedAt = Date.now();
    const progress = () => { if (onProgress) onProgress("Memverifikasi akun… " + Math.floor((Date.now() - startedAt) / 1000) + " detik"); };
    progress();
    const progressTimer = setInterval(progress, 1000);
    let result;
    try {
      const gateway = "https://webgis-api.yayasangambut.org/api/staff/login";
      let gatewayReachable = false;
      try {
        // Check connectivity before sending credentials, so fallback never
        // replays a potentially accepted login request.
        await fetchWithTimeout(gateway, { method: "HEAD", cache: "no-store" }, 4000);
        gatewayReachable = true;
      } catch (_) {}
      if (!gatewayReachable) {
        result = await postAuthRequest("editor-login", { username, password }, null, true);
      } else {
        const response = await fetchWithTimeout(
          gateway,
          { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, cache: "no-store", body: JSON.stringify({ username, password }) },
          75000
        );
        // Compatibility while the gateway rollout is still pending.
        // Do not replay a possibly accepted credential request on transport errors.
        if ([404, 405, 501].includes(response.status)) {
          result = await postAuthRequest("editor-login", { username, password });
        } else {
          result = await response.json();
          if (!response.ok || result?.ok !== true) throw new Error(result?.message || "Login belum dapat diproses. Silakan coba lagi.");
        }
      }
    } catch (error) {
      if (error?.name === "TypeError" || error?.name === "AbortError") {
        throw new Error("Koneksi layanan login terputus. Muat ulang halaman dan coba lagi.");
      }
      throw error;
    } finally { clearInterval(progressTimer); }

    if (!result.sessionToken || !result.username || !Number.isFinite(Number(result.expiresAt)) || Number(result.expiresAt) <= Date.now()) {
      throw new Error("Data sesi login tidak lengkap. Silakan login kembali.");
    }
    const session = {
      token: result.sessionToken,
      username: result.username,
      name: result.name || result.username,
      expiresAt: Number(result.expiresAt)
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);
    return session;
  }

  async function registerStaff(username, email, password) {
    return postAuthRequest("staff-register", { username, email, password });
  }

  async function activateStaff(activationToken) {
    return postAuthRequest("staff-activate", { activationToken });
  }

  async function requestPasswordReset(email) {
    return postAuthRequest("staff-password-reset-request", { email });
  }

  async function resetPassword(resetToken, password) {
    return postAuthRequest("staff-password-reset", { resetToken, password });
  }

  function logout(expectedToken) {
    const session = readStoredSession();

    // A timer from an older tab/session must never invalidate a newer login.
    if (expectedToken && (!session || session.token !== expectedToken)) return false;

    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (session && session.token) {
      postAuthRequest("editor-logout", { sessionToken: session.token }).catch(console.warn);
    }
    return true;
  }

  window.YG_AUTH = {
    readStoredSession,
    login,
    registerStaff,
    activateStaff,
    requestPasswordReset,
    resetPassword,
    logout
  };
  window.addEventListener("storage", event => {
    if (event.key === SESSION_KEY) location.reload();
  });

  function mountSessionControl(session) {
    function render() {
      if (!document.body || document.getElementById("yg-staff-session")) return;
      if (document.querySelector("#logout-editor, #rspo-logout, [data-yg-logout]")) return;

      const style = document.createElement("style");
      style.id = "yg-staff-session-style";
      style.textContent =
        ".yg-staff-session{position:fixed;right:16px;bottom:16px;z-index:10050;display:flex;align-items:center;gap:9px;padding:8px 9px 8px 12px;border:1px solid rgba(15,74,55,.18);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 8px 26px rgba(15,43,34,.18);font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#174b3b;backdrop-filter:blur(8px)}" +
        ".yg-staff-session span{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".yg-staff-session button{border:0;border-radius:999px;padding:8px 12px;background:#9b2c2c;color:#fff;font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;cursor:pointer}" +
        ".yg-staff-session button:hover{background:#7f1d1d}.yg-staff-session button:focus-visible{outline:3px solid rgba(155,44,44,.28);outline-offset:2px}" +
        "@media(max-width:560px){.yg-staff-session{right:10px;bottom:10px}.yg-staff-session span{display:none}}";

      const control = document.createElement("div");
      control.id = "yg-staff-session";
      control.className = "yg-staff-session";
      control.setAttribute("role", "status");

      const label = document.createElement("span");
      label.textContent = "Staf: " + (session.name || session.username || "aktif");

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Keluar staf";
      button.setAttribute("aria-label", "Keluar dari sesi staf");
      button.addEventListener("click", () => {
        button.disabled = true;
        button.textContent = "Keluar…";
        logout();
        location.replace("staff-login.html?loggedOut=1");
      });

      control.append(label, button);
      document.head.appendChild(style);
      document.body.appendChild(control);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render, { once: true });
    } else {
      render();
    }
  }

  const activeSession = readStoredSession();
  if (activeSession) {
    mountSessionControl(activeSession);
    const sessionTokenAtLoad = activeSession.token;
    const expiresIn = Math.max(0, Number(activeSession.expiresAt) - Date.now());
    setTimeout(() => {
      // Only expire the session that scheduled this timer. If the user has
      // logged in again, the newer token remains active across every tab.
      if (logout(sessionTokenAtLoad)) location.reload();
    }, Math.min(2147483647, expiresIn));
  }
})();
