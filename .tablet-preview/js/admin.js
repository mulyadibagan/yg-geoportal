(() => {
  "use strict";

  let editorSession = null;

  const loginScreen = document.getElementById("login-screen");
  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("login-status");
  const loginSubmit = document.getElementById("login-submit");
  const adminDashboard = document.getElementById("admin-dashboard");
  const editorUser = document.getElementById("editor-user");
  const logoutButton = document.getElementById("logout-editor");

  function activateSession(session) {
    editorSession = session;
    if (editorUser) editorUser.textContent = session.username;
    loginScreen.hidden = true;
    adminDashboard.hidden = false;
    document.body.classList.remove("auth-pending");
  }

  function deactivateSession(message) {
    editorSession = null;
    if (editorUser) editorUser.textContent = "";
    loginScreen.hidden = false;
    adminDashboard.hidden = true;
    document.body.classList.add("auth-pending");
    if (loginStatus) loginStatus.textContent = message || "";
  }
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginSubmit.disabled = true;
    loginStatus.textContent = "Memeriksa akun...";
    try {
      const session = await window.YG_AUTH.login(
        document.getElementById("login-username").value.trim(),
        document.getElementById("login-password").value
      );
      activateSession(session);
    } catch (error) {
      loginStatus.textContent = error.message;
    } finally {
      loginSubmit.disabled = false;
    }
  });

  logoutButton.addEventListener("click", () => {
    window.YG_AUTH.logout();
    deactivateSession("Anda telah keluar.");
  });

  const storedSession = window.YG_AUTH.readStoredSession();
  if (storedSession) activateSession(storedSession);
})();