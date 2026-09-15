(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
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
      const callback = "ygAuthCallback_" + Date.now();
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Waktu koneksi habis."));
      }, 20000);

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
        reject(new Error("Skrip otentikasi gagal dimuat."));
      };
      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + callback;
      document.head.appendChild(script);
    });
  }

  async function postAuthRequest(action, fields) {
    const requestId = "yg-auth-" + Date.now();
    const body = new URLSearchParams({ action, requestId, ...fields });
    await fetch(API, { method: "POST", mode: "no-cors", body });
    if (action === "editor-logout") return { ok: true };

    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, i ? 800 : 400));
      const result = await callbackLoad(`${API}?page=editor-auth-result&requestId=${requestId}`);
      if (result && result.pending) continue;
      if (result && result.ok) return result;
      throw new Error(result?.message || "Login gagal.");
    }
    throw new Error("Waktu login habis.");
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

  function logout() {
    const session = readStoredSession();
    sessionStorage.removeItem(SESSION_KEY);
    if (session && session.token) {
      postAuthRequest("editor-logout", { token: session.token }).catch(console.warn);
    }
  }

  window.YG_AUTH = {
    readStoredSession,
    login,
    logout
  };
})();