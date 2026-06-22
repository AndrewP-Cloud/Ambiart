import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/server.js";

test("health endpoint responds", async () => {
  const { baseUrl, close } = await listen();

  try {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
  } finally {
    await close();
  }
});

test("unknown wallpaper returns 404", async () => {
  const { baseUrl, close } = await listen();

  try {
    const response = await fetch(`${baseUrl}/v1/wallpapers/nope`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error, "not_found");
  } finally {
    await close();
  }
});

test("NGA wallpaper endpoint uses injected provider", async () => {
  const wallpaper = {
    id: "nga-1-img-a",
    title: "Blue, Green, and Red",
    artist: "Alma Thomas",
    source: "national-gallery-of-art",
    metadata: {
      iiifUrl: "https://api.nga.gov/iiif/img-a"
    }
  };
  const ngaClient = {
    list: async () => [wallpaper],
    getById: async () => null,
    options: async () => ({ artists: ["Alma Thomas"], categories: ["painting"], orientations: ["landscape"] }),
    random: async () => null
  };
  const { baseUrl, close } = await listen({ ngaClient });

  try {
    const response = await fetch(`${baseUrl}/v1/nga/wallpapers`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data[0].source, "national-gallery-of-art");
    assert.equal(payload.data[0].downloadUrl, `${baseUrl}/v1/nga/wallpapers/nga-1-img-a.jpg`);
    assert.equal(payload.links.source, "https://github.com/NationalGalleryOfArt/opendata");
  } finally {
    await close();
  }
});

test("NGA options endpoint exposes filters", async () => {
  const ngaClient = {
    list: async () => [],
    getById: async () => null,
    options: async () => ({
      artists: ["Alma Thomas"],
      categories: ["painting"],
      orientations: ["landscape"],
      sourceFields: {
        artist: "objects.csv attribution"
      }
    }),
    random: async () => null
  };
  const { baseUrl, close } = await listen({ ngaClient });

  try {
    const response = await fetch(`${baseUrl}/v1/nga/options`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.data.artists, ["Alma Thomas"]);
    assert.equal(payload.data.sourceFields.artist, "objects.csv attribution");
  } finally {
    await close();
  }
});

test("NGA JPEG endpoint redirects to sized image", async () => {
  const ngaClient = {
    list: async () => [],
    getById: async () => null,
    options: async () => ({}),
    random: async () => ({
      id: "nga-1-img-a",
      metadata: {
        iiifUrl: "https://api.nga.gov/iiif/img-a"
      }
    })
  };
  const { baseUrl, close } = await listen({ ngaClient });

  try {
    const response = await fetch(`${baseUrl}/v1/nga/wallpapers/random.jpg?width=2160`, {
      redirect: "manual"
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://api.nga.gov/iiif/img-a/full/!2160,2160/0/default.jpg");
  } finally {
    await close();
  }
});

function listen(options = {}) {
  const server = createServer(options);

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve) => server.close(closeResolve))
      });
    });
  });
}
