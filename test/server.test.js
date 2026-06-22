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

function listen() {
  const server = createServer({ baseUrl: "http://127.0.0.1" });

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
