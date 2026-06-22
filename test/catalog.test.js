import assert from "node:assert/strict";
import test from "node:test";
import { getManifest, getRandomWallpaper, getWallpaperById, listWallpapers } from "../src/catalog.js";

test("lists wallpapers with filters", () => {
  const wallpapers = listWallpapers({ category: "nature", orientation: "landscape" });

  assert.equal(wallpapers.length, 1);
  assert.equal(wallpapers[0].id, "aurora-drift");
});

test("limits list responses", () => {
  const wallpapers = listWallpapers({ limit: "2" });

  assert.equal(wallpapers.length, 2);
});

test("finds wallpaper by id", () => {
  const wallpaper = getWallpaperById("quiet-orbit");

  assert.equal(wallpaper.title, "Quiet Orbit");
});

test("returns null for random when filters do not match", () => {
  const wallpaper = getRandomWallpaper({ category: "missing" }, () => 0);

  assert.equal(wallpaper, null);
});

test("builds manifest with absolute endpoints", () => {
  const manifest = getManifest("https://example.test");

  assert.equal(manifest.endpoints.random, "https://example.test/v1/wallpapers/random");
  assert.equal(manifest.endpoints.ngaWallpapers, "https://example.test/v1/nga/wallpapers");
  assert.equal(manifest.endpoints.ngaRandomImage, "https://example.test/v1/nga/wallpapers/random.jpg");
  assert.deepEqual(manifest.supportedFilters.orientation, ["landscape"]);
});
