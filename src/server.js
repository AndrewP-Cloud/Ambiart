import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getManifest } from "./catalog.js";
import { createNgaClient, getSizedNgaImageUrl } from "./nga.js";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export function createServer({ baseUrl = process.env.AMBIART_BASE_URL, ngaClient = createNgaClient() } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
      const origin = baseUrl ?? `${requestUrl.protocol}//${requestUrl.host}`;

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }

      if (requestUrl.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: "ambiart" });
        return;
      }

      if (requestUrl.pathname === "/v1/manifest") {
        sendJson(response, 200, getManifest(origin));
        return;
      }

      if (requestUrl.pathname === "/v1/wallpapers") {
        sendJson(response, 200, {
          data: (await ngaClient.list(Object.fromEntries(requestUrl.searchParams))).map((wallpaper) => {
            return withDownloadUrl(wallpaper, origin, "/v1/wallpapers");
          }),
          links: {
            self: `${origin}${requestUrl.pathname}${requestUrl.search}`,
            source: "https://www.nga.gov/artworks/free-images-and-open-access"
          }
        });
        return;
      }

      if (requestUrl.pathname === "/v1/nga/wallpapers") {
        sendJson(response, 200, {
          data: (await ngaClient.list(Object.fromEntries(requestUrl.searchParams))).map((wallpaper) => {
            return withDownloadUrl(wallpaper, origin, "/v1/nga/wallpapers");
          }),
          links: {
            self: `${origin}${requestUrl.pathname}${requestUrl.search}`,
            source: "https://github.com/NationalGalleryOfArt/opendata"
          }
        });
        return;
      }

      if (requestUrl.pathname === "/v1/nga/options") {
        sendJson(response, 200, {
          data: await ngaClient.options(),
          links: {
            source: "https://github.com/NationalGalleryOfArt/opendata/blob/main/documentation/Data%20Dictionary.txt"
          }
        });
        return;
      }

      if (requestUrl.pathname === "/v1/nga/wallpapers/random") {
        const wallpaper = await ngaClient.random(Object.fromEntries(requestUrl.searchParams));
        sendJson(response, wallpaper ? 200 : 404, wallpaper ? { data: withDownloadUrl(wallpaper, origin, "/v1/nga/wallpapers") } : { error: "not_found" });
        return;
      }

      if (requestUrl.pathname === "/v1/nga/wallpapers/random.jpg") {
        const wallpaper = await ngaClient.random(Object.fromEntries(requestUrl.searchParams));
        sendImageRedirect(response, wallpaper, requestUrl.searchParams.get("width"));
        return;
      }

      const ngaImageMatch = requestUrl.pathname.match(/^\/v1\/nga\/wallpapers\/([\w-]+)\.jpg$/);
      if (ngaImageMatch) {
        const wallpaper = await ngaClient.getById(ngaImageMatch[1]);
        sendImageRedirect(response, wallpaper, requestUrl.searchParams.get("width"));
        return;
      }

      const ngaMatch = requestUrl.pathname.match(/^\/v1\/nga\/wallpapers\/([\w-]+)$/);
      if (ngaMatch) {
        const wallpaper = await ngaClient.getById(ngaMatch[1]);
        sendJson(response, wallpaper ? 200 : 404, wallpaper ? { data: withDownloadUrl(wallpaper, origin, "/v1/nga/wallpapers") } : { error: "not_found" });
        return;
      }

      if (requestUrl.pathname === "/v1/wallpapers/random") {
        const wallpaper = await ngaClient.random(Object.fromEntries(requestUrl.searchParams));
        sendJson(response, wallpaper ? 200 : 404, wallpaper ? { data: withDownloadUrl(wallpaper, origin, "/v1/wallpapers") } : { error: "not_found" });
        return;
      }

      if (requestUrl.pathname === "/v1/wallpapers/random.jpg") {
        const wallpaper = await ngaClient.random(Object.fromEntries(requestUrl.searchParams));
        sendImageRedirect(response, wallpaper, requestUrl.searchParams.get("width"));
        return;
      }

      const match = requestUrl.pathname.match(/^\/v1\/wallpapers\/([\w-]+)$/);
      if (match) {
        const wallpaper = await ngaClient.getById(match[1]);
        sendJson(response, wallpaper ? 200 : 404, wallpaper ? { data: withDownloadUrl(wallpaper, origin, "/v1/wallpapers") } : { error: "not_found" });
        return;
      }

      const imageMatch = requestUrl.pathname.match(/^\/v1\/wallpapers\/([\w-]+)\.jpg$/);
      if (imageMatch) {
        const wallpaper = await ngaClient.getById(imageMatch[1]);
        sendImageRedirect(response, wallpaper, requestUrl.searchParams.get("width"));
        return;
      }

      if (requestUrl.pathname === "/" || requestUrl.pathname.startsWith("/assets/")) {
        await sendStatic(response, requestUrl.pathname);
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 500, { error: "internal_error", message: error.message });
    }
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": statusCode === 200 ? "public, max-age=60" : "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendImageRedirect(response, wallpaper, width) {
  const imageUrl = getSizedNgaImageUrl(wallpaper, width);
  if (!imageUrl) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  response.writeHead(302, {
    Location: imageUrl,
    "Cache-Control": "no-store"
  });
  response.end();
}

function withDownloadUrl(wallpaper, origin, pathPrefix) {
  return {
    ...wallpaper,
    downloadUrl: `${origin}${pathPrefix}/${wallpaper.id}.jpg`
  };
}

async function sendStatic(response, pathname) {
  const filePath = pathname === "/" ? join(PUBLIC_DIR, "index.html") : join(PUBLIC_DIR, pathname);
  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "public, max-age=300"
  });
  response.end(content);
}

function contentType(filePath) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  }[extname(filePath)] ?? "application/octet-stream";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(PORT, () => {
    console.log(`Ambiart API listening on http://localhost:${PORT}`);
  });
}
