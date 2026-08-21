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
    return new Promise((resolve, reject) => {
      const frameName = "yg-auth-frame-" + Date.now();
      const iframe = document.createElement("iframe");
      const form = document.createElement("form");
      const timer = setTimeout(() => finish(new Error("Waktu koneksi autentikasi habis.")), 25000);

      iframe.name = frameName;
      iframe.hidden = true;
      form.method = "POST";
      form.action = API;
      form.target = frameName;
      form.hidden = true;

      function addField(name, value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value == null ? "" : value);
        form.appendChild(input);
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        form.remove();
        iframe.remove();
      }

      function finish(error, result) {
        cleanup();
        if (error) reject(error);
        else if (result && result.ok) resolve(result);
        else reject(new Error(result?.message || "Autentikasi gagal."));
      }

      function onMessage(event) {
        if (event.origin !== "https://script.google.com" &&
            event.origin !== "https://script.googleusercontent.com") return;
        const result = event.data;
        if (!result || result.requestId !== requestId) return;
        finish(null, result);
      }

      addField("action", action);
      addField("requestId", requestId);
      addField("transport", "iframe");
      Object.keys(fields || {}).forEach(key => addField(key, fields[key]));
      window.addEventListener("message", onMessage);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
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
