(() => {
  "use strict";

  const loginPanel = document.getElementById("staff-request-panel");
  const registrationPanel = document.getElementById("staff-registration-panel");
  const processingPanel = document.getElementById("staff-processing-panel");
  const resetRequestPanel = document.getElementById("staff-password-reset-request-panel");
  const resetPanel = document.getElementById("staff-password-reset-panel");
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

  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Sembunyikan" : "Lihat";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
      input.focus({ preventScroll: true });
    });
  });

  document.getElementById("show-registration").addEventListener("click", () => {
    loginPanel.hidden = true;
    registrationPanel.hidden = false;
  });
  document.getElementById("show-login").addEventListener("click", () => {
    registrationPanel.hidden = true;
    loginPanel.hidden = false;
  });
  document.querySelectorAll(".show-login").forEach(button => button.addEventListener("click", () => {
    resetRequestPanel.hidden = true;
    loginPanel.hidden = false;
  }));
  document.getElementById("show-password-reset-request").addEventListener("click", () => {
    loginPanel.hidden = true;
    resetRequestPanel.hidden = false;
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

  document.getElementById("staff-password-reset-request-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = document.getElementById("staff-password-reset-request-submit");
    const status = document.getElementById("staff-password-reset-request-status");
    const email = document.getElementById("password-reset-email").value.trim().toLowerCase();
    if (!email.endsWith("@yayasangambut.org")) {
      updateStatus(status, "Gunakan email aktif @yayasangambut.org.", true);
      return;
    }
    submit.disabled = true;
    updateStatus(status, "Mengirim tautan reset…", false);
    try {
      const result = await window.YG_AUTH.requestPasswordReset(email);
      updateStatus(status, result.message || "Jika email terdaftar, tautan reset telah dikirim.", false);
      event.target.reset();
    } catch (error) {
      updateStatus(status, error.message || "Permintaan reset belum dapat diproses.", true);
    } finally { submit.disabled = false; }
  });

  document.getElementById("staff-password-reset-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = document.getElementById("staff-password-reset-submit");
    const status = document.getElementById("staff-password-reset-status");
    const password = document.getElementById("password-reset-new").value;
    const confirmation = document.getElementById("password-reset-confirm").value;
    if (password !== confirmation) {
      updateStatus(status, "Ulangi password dengan nilai yang sama.", true);
      return;
    }
    submit.disabled = true;
    updateStatus(status, "Memperbarui password…", false);
    try {
      const result = await window.YG_AUTH.resetPassword(resetToken, password);
      updateStatus(status, result.message || "Password berhasil diperbarui.", false);
      event.target.reset();
      history.replaceState({}, document.title, "staff-login.html");
    } catch (error) {
      updateStatus(status, error.message || "Password belum dapat diperbarui.", true);
    } finally { submit.disabled = false; }
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
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  if (resetToken) {
    loginPanel.hidden = true;
    registrationPanel.hidden = true;
    resetRequestPanel.hidden = true;
    resetPanel.hidden = false;
  } else if (activationToken) {
    activateAccount(activationToken);
  } else if (storedSession) {
    window.location.replace(returnTarget());
  }
})();
