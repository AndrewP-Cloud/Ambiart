import { parseCsv } from "./csv.js";

export const NGA_IMAGES_URL = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 500;

export function createNgaClient({
  fetchImpl = globalThis.fetch,
  imagesUrl = process.env.NGA_IMAGES_URL ?? NGA_IMAGES_URL,
  scanLimit = Number.parseInt(process.env.NGA_SCAN_LIMIT ?? `${DEFAULT_SCAN_LIMIT}`, 10),
  cacheTtlMs = CACHE_TTL_MS
} = {}) {
  if (!fetchImpl) {
    throw new Error("A fetch implementation is required for the NGA client.");
  }

  let cache = null;

  async function loadCatalog() {
    const now = Date.now();
    if (cache && now - cache.loadedAt < cacheTtlMs) {
      return cache.wallpapers;
    }

    const images = await fetchCsvRecords(fetchImpl, imagesUrl, scanLimit);
    const wallpapers = images
      .map((image) => mapImageToWallpaper(image))
      .filter(Boolean);

    cache = {
      loadedAt: now,
      wallpapers
    };

    return wallpapers;
  }

  return {
    async list(query = {}) {
      const wallpapers = await loadCatalog();
      const limit = clampLimit(query.limit);
      const category = normalize(query.category);
      const orientation = normalize(query.orientation);
      const q = normalize(query.q);

      return wallpapers.filter((wallpaper) => {
        const categoryMatches = !category || wallpaper.category === category;
        const orientationMatches = !orientation || wallpaper.orientation === orientation;
        const queryMatches = !q || `${wallpaper.title} ${wallpaper.artist} ${wallpaper.metadata.assistiveText}`.toLowerCase().includes(q);
        return categoryMatches && orientationMatches && queryMatches;
      }).slice(0, limit);
    },

    async getById(id) {
      const wallpapers = await loadCatalog();
      return wallpapers.find((wallpaper) => wallpaper.id === id) ?? null;
    },

    async random(query = {}, random = Math.random) {
      const wallpapers = await this.list({ ...query, limit: MAX_LIMIT });
      if (wallpapers.length === 0) {
        return null;
      }

      return wallpapers[Math.floor(random() * wallpapers.length)];
    },

    clearCache() {
      cache = null;
    }
  };
}

function mapImageToWallpaper(image) {
  const objectId = read(image, "depictstmsobjectid", "depictsTmsObjectId", "objectid", "objectID");
  const imageId = read(image, "uuid", "imageid", "imageID") || objectId;
  const iiifUrl = read(image, "iiifurl", "iiifURL", "imageurl", "imageURL", "url");
  const imageUrl = getIiifImageUrl(iiifUrl, 3840);
  const thumbnailUrl = read(image, "thumburl", "thumbnailurl", "thumbnailURL", "iiifthumburl", "iiifThumbURL") || imageUrl;
  const openAccess = read(image, "openaccess", "openAccess");

  if (!objectId || !imageUrl || openAccess === "0") {
    return null;
  }

  const width = toNumber(read(image, "width"));
  const height = toNumber(read(image, "height"));
  const assistiveText = read(image, "assistivetext", "assistiveText");
  const title = `National Gallery artwork ${objectId}`;

  return {
    id: `nga-${objectId}-${slug(imageId)}`,
    source: "national-gallery-of-art",
    sourceObjectId: objectId,
    title,
    artist: "National Gallery of Art",
    category: "artwork",
    orientation: getOrientation(width, height),
    dominantColor: "#1f2933",
    imageUrl,
    thumbnailUrl,
    attribution: `${title}. National Gallery of Art, Washington.`,
    metadata: {
      assistiveText,
      height,
      iiifUrl,
      openAccess: openAccess !== "0",
      viewType: read(image, "viewtype", "viewType"),
      width
    }
  };
}

async function fetchCsvRecords(fetchImpl, url, maxRows) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`NGA fetch failed for ${url}: ${response.status}`);
  }

  if (!response.body?.getReader) {
    return parseCsv(await response.text()).slice(0, maxRows);
  }

  return parseCsv(await readCsvPrefix(response.body, maxRows)).slice(0, maxRows);
}

async function readCsvPrefix(body, maxRows) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let rows = 0;
  let quoted = false;

  while (rows <= maxRows) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    for (const char of chunk) {
      text += char;
      if (char === "\"") {
        quoted = !quoted;
      } else if (char === "\n" && !quoted) {
        rows += 1;
        if (rows > maxRows) {
          await reader.cancel();
          return text;
        }
      }
    }
  }

  return text + decoder.decode();
}

function read(row, ...keys) {
  for (const key of keys) {
    if (row?.[key]) {
      return row[key].trim();
    }
  }

  const lowerCaseRow = Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lowerCaseRow[key.toLowerCase()];
    if (value) {
      return value.trim();
    }
  }

  return "";
}

function normalize(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function getOrientation(width, height) {
  if (!width || !height) {
    return "landscape";
  }

  if (width === height) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getIiifImageUrl(iiifUrl, width) {
  if (!iiifUrl) {
    return "";
  }

  return `${iiifUrl}/full/!${width},${width}/0/default.jpg`;
}

export function getSizedNgaImageUrl(wallpaper, width = 3840) {
  return getIiifImageUrl(wallpaper?.metadata?.iiifUrl, clampImageWidth(width));
}

function clampImageWidth(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 3840;
  }

  return Math.min(Math.max(parsed, 200), 4096);
}
