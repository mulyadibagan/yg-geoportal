(function () {
  'use strict';
  var reports;
  function loadReports() {
    if (reports) return reports;
    reports = new Promise(function (resolve) {
      var name = 'dayunReports_' + Date.now(), script = document.createElement('script');
      var timer = setTimeout(function () { finish(null); }, 6000);
      function finish(data) {
        clearTimeout(timer); script.remove();
        window[name] = function () {};
        setTimeout(function () { delete window[name]; }, 60000);
        if (!data || !Array.isArray(data.features)) {
          document.querySelectorAll('[data-dayun-freshness]').forEach(function (el) { el.textContent = 'Pembaruan kegiatan belum tersedia. Menampilkan catatan yang tersedia.'; });
          resolve({features:[]}); return;
        }
        resolve(data);
      }
      window[name] = finish;
      script.onerror = function () { finish(null); };
      script.src = 'https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec?page=public-reports&callback=' + name;
      document.head.appendChild(script);
    });
    return reports;
  }
  function loadDetails() {
    return Promise.all([
      window.DayunDataSource.fetchJSON('data/dayun-gawangan-details.json?v=20260917-performance1'),
      loadReports()
    ]).then(function (result) { return window.DayunPineappleAnalysis.applyPublishedMonitoring(result[0], result[1]); });
  }
  window.DayunData = {loadDetails:loadDetails, loadReports:loadReports};
})();
