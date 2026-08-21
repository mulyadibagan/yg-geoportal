(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
  const AUTH_RESULT_API = "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/staff/auth-result";
  const SESSION_KEY = "ygEditorSessionV1";

  function readStoredSession() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!stored || !stored.token || !stored.username || !stored.expiresAt) return null;
      if (Number(stored.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return stored;
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function callbackLoad(url) {
    return new Promise((resolve, reject) => {
      const callback = "ygAuthCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Waktu koneksi habis."));
      }, 10000);

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

  async function postAuthRequest(action, fields) {
    const requestId = "yg-auth-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
    const body = new URLSearchParams({ action, requestId, ...(fields || {}) });
    await fetch(API, { method: "POST", mode: "no-cors", body });
    if (action === "editor-logout") return { ok: true };

    const deadline = Date.now() + 30000;
    let lastLoadError = null;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 700));
      try {
        const response = await fetch(`${AUTH_RESULT_API}?requestId=${encodeURIComponent(requestId)}&t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Hasil autentikasi belum dapat dimuat.");
        const result = await response.json();
        lastLoadError = null;
        if (result && result.pending) continue;
        if (result && result.ok) return result;
        throw new Error(result?.message || "Autentikasi gagal.");
      } catch (error) {
        if (error && error.message && !/belum dapat dimuat|koneksi habis/i.test(error.message)) throw error;
        lastLoadError = error;
      }
    }
    if (lastLoadError) throw new Error("Hasil autentikasi belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    throw new Error("Waktu koneksi autentikasi habis. Silakan coba lagi.");
  }

  async function login(username, password) {
    const result = await postAuthRequest("editor-login", { username, password });
    const session = {
      token: result.sessionToken,
      username: result.username,
      expiresAt: Number(result.expiresAt)
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async function registerStaff(username, email, password) {
    return postAuthRequest("staff-register", { username, email, password });
  }

  async function activateStaff(activationToken) {
    return postAuthRequest("staff-activate", { activationToken });
  }

  function logout() {
    const session = readStoredSession();
    sessionStorage.removeItem(SESSION_KEY);
    if (session && session.token) {
      postAuthRequest("editor-logout", { sessionToken: session.token }).catch(console.warn);
    }
  }

  window.YG_AUTH = {
    readStoredSession,
    login,
    registerStaff,
    activateStaff,
    logout
  };
})();
