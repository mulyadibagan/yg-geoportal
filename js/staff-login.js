(() => {
  "use strict";

  const loginPanel = document.getElementById("staff-request-panel");
  const registrationPanel = document.getElementById("staff-registration-panel");
  const processingPanel = document.getElementById("staff-processing-panel");
  const retryLink = document.getElementById("staff-retry-link");

  function returnTarget() {
    const value = new URLSearchParams(window.location.search).get("return") || "";
    if (!value || /^(?:[a-z]+:|\/\/)/i.test(value) || value.includes("..")) return "admin-dashboard.html";
    return value;
  }

  function updateStatus(node, message, isError) {
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  document.getElementById("show-registration").addEventListener("click", () => {
    loginPanel.hidden = true;
    registrationPanel.hidden = false;
  });
  document.getElementById("show-login").addEventListener("click", () => {
    registrationPanel.hidden = true;
    loginPanel.hidden = false;
  });

  document.getElementById("staff-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = document.getElementById("staff-login-submit");
    const status = document.getElementById("staff-login-status");
    submit.disabled = true;
    updateStatus(status, "Memeriksa akun…", false);
    try {
      await window.YG_AUTH.login(
        document.getElementById("staff-username").value.trim().toLowerCase(),
        document.getElementById("staff-password").value
      );
      window.location.replace(returnTarget());
    } catch (error) {
      updateStatus(status, error.message || "Login gagal.", true);
      submit.disabled = false;
    }
  });

  document.getElementById("staff-registration-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = document.getElementById("staff-registration-submit");
    const status = document.getElementById("staff-registration-status");
    const username = document.getElementById("registration-username").value.trim().toLowerCase();
    const email = document.getElementById("registration-email").value.trim().toLowerCase();
    const password = document.getElementById("registration-password").value;
    const confirmation = document.getElementById("registration-password-confirm").value;
    if (password !== confirmation) {
      updateStatus(status, "Ulangi password dengan nilai yang sama.", true);
      return;
    }
    if (!email.endsWith("@yayasangambut.org")) {
      updateStatus(status, "Gunakan email aktif @yayasangambut.org.", true);
      return;
    }
    submit.disabled = true;
    updateStatus(status, "Mengirim tautan verifikasi…", false);
    try {
      const result = await window.YG_AUTH.registerStaff(username, email, password);
      updateStatus(status, result.message || "Tautan verifikasi telah dikirim.", false);
      event.target.reset();
    } catch (error) {
      updateStatus(status, error.message || "Aktivasi belum dapat diproses.", true);
    } finally {
      submit.disabled = false;
    }
  });

  async function activateAccount(activationToken) {
    loginPanel.hidden = true;
    registrationPanel.hidden = true;
    processingPanel.hidden = false;
    const status = document.getElementById("staff-processing-status");
    try {
      const result = await window.YG_AUTH.activateStaff(activationToken);
      status.textContent = result.message || "Akun berhasil diaktifkan. Silakan login.";
      history.replaceState({}, document.title, "staff-login.html");
      retryLink.textContent = "Login sekarang";
      retryLink.hidden = false;
    } catch (error) {
      status.textContent = error.message || "Tautan aktivasi tidak dapat digunakan.";
      retryLink.hidden = false;
    }
  }

  const storedSession = window.YG_AUTH.readStoredSession();
  const activationToken = new URLSearchParams(window.location.search).get("activationToken");
  if (activationToken) {
    activateAccount(activationToken);
  } else if (storedSession) {
    window.location.replace(returnTarget());
  }
})();
