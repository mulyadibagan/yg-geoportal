(() => {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxeGTDZXkR0DyLZmBHTq2M-52Iu4dTTGpH164S7sYHg8qPzvffobC6-r-TBLVHMT3HU-A/exec?page=dashboard-summary";
  const CALLBACK = "ygDashboardSummaryCallback";

  function number(value) {
    return new Intl.NumberFormat("id-ID").format(Number(value || 0));
  }

  function area(value) {
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2
    }).format(Number(value || 0)) + " ha";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  window[CALLBACK] = function(data) {
    if (!data || !data.objects) return;

    setText("stat-villages", number(data.objects.villages));
    setText("stat-objects", number(data.objects.total));
    setText("stat-area", area(data.objects.totalAreaHa));
    setText("stat-planted", number(data.objects.totalPlanted));

    const categories = data.objects.categories || {};
    const categoryList = document.getElementById("dashboard-category-list");

    if (categoryList) {
      categoryList.innerHTML = Object.keys(categories)
        .sort((a, b) => categories[b] - categories[a])
        .map(name =>
          '<div class="dashboard-category-row">' +
            '<span>' + escapeHtml(name) + '</span>' +
            '<strong>' + number(categories[name]) + '</strong>' +
          '</div>'
        )
        .join("");
    }

    const generated = document.getElementById("dashboard-generated");
    if (generated && data.generatedAt) {
      generated.textContent =
        "Data diperbarui " +
        new Date(data.generatedAt).toLocaleString("id-ID");
    }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  const script = document.createElement("script");
  script.src =
    API +
    "&callback=" +
    CALLBACK +
    "&t=" +
    Date.now();
  script.async = true;
  script.onerror = function() {
    const generated = document.getElementById("dashboard-generated");
    if (generated) {
      generated.textContent =
        "Data langsung belum dapat dimuat; angka cadangan ditampilkan.";
    }
  };
  document.head.appendChild(script);
})();
