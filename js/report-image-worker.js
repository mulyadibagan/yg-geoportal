"use strict";

self.addEventListener("message", async event => {
  const data = event.data || {};
  let bitmap = null;

  try {
    if (!data.file || typeof OffscreenCanvas === "undefined") {
      throw new Error("Pemrosesan foto latar belakang tidak tersedia.");
    }

    try {
      bitmap = await createImageBitmap(data.file, {
        imageOrientation: "from-image"
      });
    } catch (error) {
      bitmap = await createImageBitmap(data.file);
    }

    const maxDimension = Number(data.maxDimension) || 1280;
    const quality = Number(data.quality) || 0.7;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { alpha: false });

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    bitmap = null;

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality
    });

    self.postMessage({ ok: true, blob });
  } catch (error) {
    if (bitmap) bitmap.close();
    self.postMessage({
      ok: false,
      error: error && error.message
        ? error.message
        : "Foto gagal diproses."
    });
  }
});
