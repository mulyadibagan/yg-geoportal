(() => {
  "use strict";

  const CALLBACK = "ygPublishedUpdatesCallback";

  function parseObject(value) {
    if (value && typeof value === "object") return { ...value };
    if (typeof value !== "string" || !value.trim()) return {};
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  function firstValue(values) {
    return values.find(value =>
      value !== null && value !== undefined && String(value).trim() !== ""
    );
  }

  function normalizeUpdate(update) {
    if (!update || typeof update !== "object") return update;

    const target = parseObject(update.targetFeatureProperties);
    const changes = parseObject(update.proposedChanges);

    /*
     * Pada laporan lama, Object_ID pada level utama adalah ID laporan,
     * bukan ID objek peta. data-updates.js sebelumnya membaca ID laporan
     * lebih dahulu sehingga foto tidak pernah cocok dengan FDRS/sekat kanal.
     * Prioritaskan ID objek sasaran dan simpan ke targetFeatureProperties.
     */
    const targetObjectId = firstValue([
      update.targetObjectId,
      update.Target_Object_ID_Current,
      update.Target_Object_ID,
      target.Object_ID,
      target.Target_Object_ID_Current,
      target.Target_Object_ID,
      target.objectId,
      target.OBJECTID,
      changes.targetObjectId,
      changes.Target_Object_ID_Current,
      changes.Target_Object_ID
    ]);

    if (targetObjectId) {
      target.Object_ID = String(targetObjectId).trim();
      update.targetObjectId = String(targetObjectId).trim();
      update.targetFeatureProperties = target;
      return update;
    }

    /*
     * Jika laporan lama belum memiliki ID sasaran permanen, hapus ID laporan
     * dari salinan yang diproses agar pencocokan lama berdasarkan No/desa/
     * tahun/nama tetap dapat berjalan seperti sebelumnya.
     */
    const reportLikeId = String(
      update.Object_ID || update.OBJECTID || update.objectId || ""
    ).trim();

    if (/^(?:COMMUNITY|MONITORING|REPORT|UPDATE)-/i.test(reportLikeId)) {
      delete update.Object_ID;
      delete update.OBJECTID;
      delete update.objectId;
    }

    update.targetFeatureProperties = target;
    return update;
  }

  function install(attempt = 0) {
    const original = window[CALLBACK];

    if (typeof original !== "function") {
      if (attempt < 50) {
        window.setTimeout(() => install(attempt + 1), 20);
      }
      return;
    }

    if (original._ygTargetFixInstalled) return;

    const wrapped = data => {
      if (data && Array.isArray(data.updates)) {
        data.updates = data.updates.map(normalizeUpdate);
      }
      return original(data);
    };

    wrapped._ygTargetFixInstalled = true;
    window[CALLBACK] = wrapped;
  }

  install();
})();
