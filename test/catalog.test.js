import assert from "node:assert/strict";
import test from "node:test";
import { getManifest } from "../src/catalog.js";

test("builds manifest with absolute endpoints", () => {
  const manifest = getManifest("https://example.test");

  assert.equal(manifest.endpoints.random, "https://example.test/v1/wallpapers/random");
  assert.equal(manifest.endpoints.randomImage, "https://example.test/v1/wallpapers/random.jpg");
  assert.equal(manifest.endpoints.ngaWallpapers, "https://example.test/v1/nga/wallpapers");
  assert.equal(manifest.endpoints.ngaRandomImage, "https://example.test/v1/nga/wallpapers/random.jpg");
  assert.deepEqual(manifest.supportedFilters.orientation, ["landscape", "portrait", "square"]);
});
