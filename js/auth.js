(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
  const AUTH_RESULT_API = "https://yg-webgis-public-data-staging.yg-webgis-public-data-worker.workers.dev/api/staff/auth-result";
  const SESSION_KEY = "ygEditorSessionV1";

  function readStoredSession() {
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
      if (!stored || !stored.token || !stored.username || !stored.expiresAt) return null;
      if (Number(stored.expiresAt) <= Date.now()) {
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

  function logout() {
    const session = readStoredSession();
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (session && session.token) {
      postAuthRequest("editor-logout", { sessionToken: session.token }).catch(console.warn);
    }
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
    setTimeout(() => { logout(); location.reload(); }, Math.min(2147483647, Number(activeSession.expiresAt) - Date.now()));
  }
})();
