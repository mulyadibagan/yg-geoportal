(function () {
  "use strict";
  var returnTo = location.pathname.split("/").pop() + location.search;
  function login() {
    location.replace("staff-login.html?return=" + encodeURIComponent(returnTo));
  }
  var session = window.YG_AUTH && window.YG_AUTH.readStoredSession();
  if (!session || !session.token || !window.YG_STAFF_DATA) {
    login();
    return;
  }
  window.YG_STAFF_DATA.fetch("data/rdtr-bagansiapiapi-analysis.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (analysis) {
      if (!analysis || analysis.metadata?.access !== "staff_only") throw new Error("invalid_analysis");
      window.YG_RDTR_BOOTSTRAP = { analysis: analysis, session: session };
      document.documentElement.style.visibility = "visible";
      document.dispatchEvent(new CustomEvent("yg:rdtr-authorized"));
    })
    .catch(function () {
      localStorage.removeItem("ygEditorSessionV1");
      sessionStorage.removeItem("ygEditorSessionV1");
      login();
    });
})();
