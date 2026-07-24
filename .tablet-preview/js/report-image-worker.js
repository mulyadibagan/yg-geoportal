"use strict";

function jpegDimensions(view) {
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;

  const startOfFrameMarkers = [
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf
  ];
  let offset = 2;

  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    if (startOfFrameMarkers.indexOf(marker) !== -1) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false)
      };
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = view.getUint16(offset + 2, false);
    if (length < 2) break;
    offset += 2 + length;
  }

  return null;
}

function pngDimensions(view) {
  if (
    view.byteLength < 24 ||
    view.getUint32(0, false) !== 0x89504e47 ||
    view.getUint32(4, false) !== 0x0d0a1a0a
  ) {
    return null;
  }

  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  };
}

async function imageDimensions(file) {
  const header = await file.slice(0, 262144).arrayBuffer();
  const view = new DataView(header);
  return jpegDimensions(view) || pngDimensions(view);
}

self.addEventListener("message", async event => {
  const data = event.data || {};
  let bitmap = null;

  try {
    if (!data.file || typeof OffscreenCanvas === "undefined") {
      throw new Error("Pemrosesan foto latar belakang tidak tersedia.");
    }

    const maxDimension = Number(data.maxDimension) || 1280;
    const quality = Number(data.quality) || 0.7;
    const dimensions = await imageDimensions(data.file);
    let resizeOptions = { imageOrientation: "from-image" };

    if (dimensions && dimensions.width && dimensions.height) {
      const scale = Math.min(
        1,
        maxDimension / Math.max(dimensions.width, dimensions.height)
      );
      resizeOptions.resizeWidth = Math.max(
        1,
        Math.round(dimensions.width * scale)
      );
      resizeOptions.resizeHeight = Math.max(
        1,
        Math.round(dimensions.height * scale)
      );
      resizeOptions.resizeQuality = "medium";
    }

    try {
      bitmap = await createImageBitmap(data.file, resizeOptions);
    } catch (error) {
      bitmap = await createImageBitmap(data.file);
    }

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
