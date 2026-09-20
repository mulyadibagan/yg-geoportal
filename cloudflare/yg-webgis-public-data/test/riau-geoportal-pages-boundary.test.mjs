import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const guardScript = path.resolve(
  testDirectory,
  "../../../scripts/assert-riau-geoportal-private.mjs"
);

function runGuard(directory) {
  return spawnSync(process.execPath, [guardScript, directory], {
    encoding: "utf8"
  });
}

test("Pages privacy guard rejects compressed Riau Geoportal source artifacts", async () => {
  const safeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "riau-pages-safe-"));
  await fs.writeFile(path.join(safeDirectory, "index.html"), "<!doctype html><title>safe</title>");
  const safe = runGuard(safeDirectory);
  assert.equal(safe.status, 0, safe.stderr);

  for (const relative of [
    "exports/source.geojson.gz",
    "downloads/riau-geoportal-contours.geojson.gz"
  ]) {
    const unsafeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "riau-pages-unsafe-"));
    const target = path.join(unsafeDirectory, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "private");
    const unsafe = runGuard(unsafeDirectory);
    assert.notEqual(unsafe.status, 0);
    assert.match(unsafe.stderr, /private artifacts entered the Pages build/);
    assert.match(unsafe.stderr, new RegExp(relative.replaceAll(".", "\\.")));
  }
});
