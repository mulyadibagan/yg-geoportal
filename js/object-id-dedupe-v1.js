(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);

  function normalized(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function featureKey(feature) {
    const props = feature && feature.properties || {};
    const objectId = normalized(
      props.Object_ID || props.objectId || props.OBJECTID
    );
    if (!objectId) return "";

    return objectId;
  }

  function deduplicateFeatures(data) {
    if (!data || !Array.isArray(data.features)) return data;

    const seen = new Set();
    data.features = data.features.filter(feature => {
      const key = featureKey(feature);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return data;
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const request = args[0];
    const url = String(
      request && typeof request === "object" && request.url
        ? request.url
        : request || ""
    );

    if (!/[?&]page=objects(?:&|$)/i.test(url)) {
      return response;
    }

    try {
      const data = deduplicateFeatures(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");

      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn("Deduplikasi Object_ID tidak diterapkan.", error);
      return response;
    }
  };
})();