(function () {
  "use strict";

  const API = "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec";
  const CACHE_KEY = "ygPublicContentV1";
  const textTargets = {
    heroEyebrow: "content-hero-eyebrow",
    heroTitle: "content-hero-title",
    heroDescription: "content-hero-description",
    heroTagline: "content-hero-tagline",
    programTitle: "content-program-title",
    fundingTitle: "content-funding-title",
    coverageTitle: "content-coverage-title"
  };

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      const callback = "ygContentCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const script = document.createElement("script");
      const timer = setTimeout(function () { cleanup(); reject(new Error("timeout")); }, 10000);
      function cleanup() { clearTimeout(timer); delete window[callback]; script.remove(); }
      window[callback] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error("network")); };
      script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + callback + "&_=" + Date.now();
      document.head.appendChild(script);
    });
  }

  function applyContent(content) {
    if (!content) return;
    Object.keys(textTargets).forEach(function (key) {
      const node = document.getElementById(textTargets[key]);
      if (node && content[key]) node.textContent = content[key];
    });
    applyPartnerLogos(content.partnerLogos || {});
  }

  function applyPartnerLogos(logos) {
    document.querySelectorAll(".funding-card").forEach(function (card) {
      const text = (card.textContent || "").toLowerCase();
      Object.keys(logos).some(function (partner) {
        if (!logos[partner] || text.indexOf(partner.toLowerCase()) < 0) return false;
        let image = card.querySelector(".content-partner-logo");
        if (!image) {
          image = document.createElement("img");
          image.className = "content-partner-logo";
          image.alt = "Logo " + partner;
          card.insertBefore(image, card.firstChild);
        }
        image.src = logos[partner];
        return true;
      });
    });
  }

  try { applyContent(JSON.parse(localStorage.getItem(CACHE_KEY) || "null")); } catch (error) {}
  jsonp(API + "?page=public-content").then(function (result) {
    const content = result && (result.content || result);
    if (!content) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(content));
    applyContent(content);
  }).catch(function () {});

  new MutationObserver(function () {
    try { applyPartnerLogos((JSON.parse(localStorage.getItem(CACHE_KEY) || "null") || {}).partnerLogos || {}); } catch (error) {}
  }).observe(document.body, { childList: true, subtree: true });
}());
