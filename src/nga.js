import { parseCsv } from "./csv.js";

export const NGA_OBJECTS_URL = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/objects.csv";
export const NGA_IMAGES_URL = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 500;
const DEFAULT_SEARCH_LIMIT = 200000;
const DEFAULT_OBJECT_MATCH_LIMIT = 2000;
const DEFAULT_RANDOM_POOL_SIZE = 5;

export function createNgaClient({
  fetchImpl = globalThis.fetch,
  objectsUrl = process.env.NGA_OBJECTS_URL ?? NGA_OBJECTS_URL,
  imagesUrl = process.env.NGA_IMAGES_URL ?? NGA_IMAGES_URL,
  scanLimit = Number.parseInt(process.env.NGA_SCAN_LIMIT ?? `${DEFAULT_SCAN_LIMIT}`, 10),
  objectScanLimit = Number.parseInt(process.env.NGA_OBJECT_SCAN_LIMIT ?? `${DEFAULT_SEARCH_LIMIT}`, 10),
  imageSearchLimit = Number.parseInt(process.env.NGA_IMAGE_SEARCH_LIMIT ?? `${DEFAULT_SEARCH_LIMIT}`, 10),
  objectMatchLimit = Number.parseInt(process.env.NGA_OBJECT_MATCH_LIMIT ?? `${DEFAULT_OBJECT_MATCH_LIMIT}`, 10),
  randomPoolSize = Number.parseInt(process.env.NGA_RANDOM_POOL_SIZE ?? `${DEFAULT_RANDOM_POOL_SIZE}`, 10),
  cacheTtlMs = CACHE_TTL_MS
} = {}) {
  if (!fetchImpl) {
    throw new Error("A fetch implementation is required for the NGA client.");
  }

  let cache = null;
  const randomPools = new Map();

  async function loadCatalog() {
    const now = Date.now();
    if (cache && now - cache.loadedAt < cacheTtlMs) {
      return cache.wallpapers;
    }

    const images = await fetchCsvRecords(fetchImpl, imagesUrl, scanLimit);
    const objectIds = new Set(images.map((image) => read(image, "depictstmsobjectid", "depictsTmsObjectId")).filter(Boolean));
    const objectsById = await fetchObjectsById(fetchImpl, objectsUrl, objectIds, objectScanLimit);
    const wallpapers = images
      .map((image) => mapImageToWallpaper(image, objectsById.get(read(image, "depictstmsobjectid", "depictsTmsObjectId"))))
      .filter(Boolean);

    cache = {
      loadedAt: now,
      wallpapers
    };

    return wallpapers;
  }

  return {
    async list(query = {}) {
      const limit = clampLimit(query.limit);
      const artist = normalize(query.artist);
      const category = normalize(query.category);
      const orientation = normalize(query.orientation);
      const q = normalize(query.q);

      if (artist || category || q) {
        return searchWallpapers({ artist, category, orientation, q, limit });
      }

      const wallpapers = await loadCatalog();
      return wallpapers.filter((wallpaper) => {
        const orientationMatches = !orientation || wallpaper.orientation === orientation;
        return orientationMatches;
      }).slice(0, limit);
    },

    async getById(id) {
      const wallpapers = await loadCatalog();
      const wallpaper = wallpapers.find((item) => item.id === id);
      if (wallpaper) {
        return wallpaper;
      }

      return findWallpaperById(id);
    },

    async random(query = {}, random = Math.random) {
      return getNextRandomWallpaper(query, random, this.list.bind(this));
    },

    async options() {
      const wallpapers = await loadCatalog();

      return {
        artists: uniqueValues(wallpapers.map((wallpaper) => wallpaper.artist)),
        categories: uniqueValues(wallpapers.flatMap(getCategoryValues)),
        orientations: uniqueValues(wallpapers.map((wallpaper) => wallpaper.orientation)),
        sourceFields: {
          artist: "objects.csv attribution",
          category: "objects.csv visualBrowserClassification, classification, and subClassification",
          orientation: "computed from published_images.csv width and height"
        }
      };
    },

    clearCache() {
      cache = null;
      randomPools.clear();
    }
  };

  async function getNextRandomWallpaper(query, random, listWallpapers) {
    const key = getRandomPoolKey(query);
    let state = randomPools.get(key);

    if (!state) {
      state = await createRandomPoolState(query, random, listWallpapers);
      randomPools.set(key, state);
    }

    if (state.sets[state.activeSet].length === 0) {
      return null;
    }

    if (state.cursor >= state.sets[state.activeSet].length) {
      const exhaustedSet = state.activeSet;
      state.activeSet = state.activeSet === 0 ? 1 : 0;
      state.cursor = 0;
      state.sets[exhaustedSet] = await buildRandomPool(query, random, listWallpapers, state.sets[state.activeSet]);
    }

    if (state.sets[state.activeSet].length === 0) {
      const inactiveSet = state.activeSet === 0 ? 1 : 0;
      state.sets[state.activeSet] = await buildRandomPool(query, random, listWallpapers, state.sets[inactiveSet]);
    }

    return state.sets[state.activeSet][state.cursor++] ?? null;
  }

  async function createRandomPoolState(query, random, listWallpapers) {
    const firstSet = await buildRandomPool(query, random, listWallpapers);
    const secondSet = await buildRandomPool(query, random, listWallpapers, firstSet);

    return {
      activeSet: 0,
      cursor: 0,
      sets: [firstSet, secondSet]
    };
  }

  async function buildRandomPool(query, random, listWallpapers, avoidWallpapers = []) {
    const candidateLimit = Math.max(MAX_LIMIT, getRandomPoolSize() * 4);
    const candidates = await listWallpapers({ ...query, limit: candidateLimit });
    const avoidIds = new Set(avoidWallpapers.map((wallpaper) => wallpaper.id));
    const preferred = candidates.filter((wallpaper) => !avoidIds.has(wallpaper.id));
    const poolSource = preferred.length > 0 ? preferred : candidates;

    return shuffle(poolSource, random).slice(0, getRandomPoolSize());
  }

  function getRandomPoolSize() {
    if (Number.isNaN(randomPoolSize)) {
      return DEFAULT_RANDOM_POOL_SIZE;
    }

    return Math.max(1, randomPoolSize);
  }

  async function searchWallpapers({ artist, category, orientation, q, limit }) {
    const objectMatches = await fetchMatchingCsvRecords(
      fetchImpl,
      objectsUrl,
      (object) => objectMatchesQuery(object, { artist, category, q }),
      (matches) => matches.length >= objectMatchLimit,
      objectScanLimit
    );
    const objectsById = new Map(objectMatches.map((object) => [read(object, "objectid", "objectID"), object]));
    const objectIds = new Set(objectsById.keys());

    if (objectIds.size === 0) {
      return [];
    }

    const imageMatches = await fetchMatchingCsvRecords(
      fetchImpl,
      imagesUrl,
      (image) => imageMatchesQuery(image, objectIds, { orientation, q }),
      (matches) => matches.length >= limit,
      imageSearchLimit
    );

    return imageMatches
      .map((image) => mapImageToWallpaper(image, objectsById.get(read(image, "depictstmsobjectid", "depictsTmsObjectId"))))
      .filter(Boolean)
      .filter((wallpaper) => wallpaperMatchesQuery(wallpaper, { artist, category, orientation, q }))
      .slice(0, limit);
  }

  async function findWallpaperById(id) {
    const match = id.match(/^nga-(\d+)-(.+)$/);
    if (!match) {
      return null;
    }

    const [, objectId] = match;
    const object = await fetchObjectById(fetchImpl, objectsUrl, objectId, objectScanLimit);
    if (!object) {
      return null;
    }

    const images = await fetchMatchingCsvRecords(
      fetchImpl,
      imagesUrl,
      (image) => read(image, "depictstmsobjectid", "depictsTmsObjectId") === objectId,
      (matches) => matches.length >= 50,
      imageSearchLimit
    );

    return images
      .map((image) => mapImageToWallpaper(image, object))
      .filter(Boolean)
      .find((wallpaper) => wallpaper.id === id) ?? null;
  }
}

function mapImageToWallpaper(image, object = {}) {
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
  const title = read(object, "title") || `National Gallery artwork ${objectId}`;
  const artist = read(object, "attribution") || "National Gallery of Art";
  const classification = read(object, "classification");
  const subClassification = read(object, "subclassification", "subClassification");
  const visualBrowserClassification = read(object, "visualbrowserclassification", "visualBrowserClassification");
  const category = normalize(visualBrowserClassification || classification || subClassification) ?? "artwork";

  return {
    id: `nga-${objectId}-${slug(imageId)}`,
    source: "national-gallery-of-art",
    sourceObjectId: objectId,
    title,
    artist,
    category,
    orientation: getOrientation(width, height),
    dominantColor: "#1f2933",
    imageUrl,
    thumbnailUrl,
    attribution: `${title}${artist ? `, ${artist}` : ""}. National Gallery of Art, Washington.`,
    metadata: {
      accessionNumber: read(object, "accessionnum", "accessionNum"),
      assistiveText,
      classification,
      date: read(object, "displaydate", "displayDate"),
      height,
      iiifUrl,
      medium: read(object, "medium"),
      openAccess: openAccess !== "0",
      subClassification,
      visualBrowserClassification,
      viewType: read(image, "viewtype", "viewType"),
      width
    }
  };
}

async function fetchObjectsById(fetchImpl, url, objectIds, maxRows) {
  if (objectIds.size === 0) {
    return new Map();
  }

  const records = await fetchMatchingCsvRecords(
    fetchImpl,
    url,
    (row) => objectIds.has(read(row, "objectid", "objectID")),
    (matches) => matches.length >= objectIds.size,
    maxRows
  );

  return new Map(records.map((object) => [read(object, "objectid", "objectID"), object]));
}

async function fetchObjectById(fetchImpl, url, objectId, maxRows) {
  const matches = await fetchMatchingCsvRecords(
    fetchImpl,
    url,
    (row) => read(row, "objectid", "objectID") === objectId,
    (records) => records.length >= 1,
    maxRows
  );

  return matches[0] ?? null;
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

async function fetchMatchingCsvRecords(fetchImpl, url, isMatch, shouldStop, maxRows) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`NGA fetch failed for ${url}: ${response.status}`);
  }

  if (!response.body?.getReader) {
    const matches = [];
    for (const row of parseCsv(await response.text()).slice(0, maxRows)) {
      if (isMatch(row)) {
        matches.push(row);
        if (shouldStop(matches)) {
          break;
        }
      }
    }
    return matches;
  }

  const matches = [];
  let scannedRows = 0;
  await streamCsvRows(response.body, (row) => {
    if (scannedRows >= maxRows) {
      return false;
    }

    scannedRows += 1;
    if (isMatch(row)) {
      matches.push(row);
    }

    return !shouldStop(matches);
  });

  return matches;
}

async function streamCsvRows(body, onRow) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let headers = null;
  let row = [];
  let field = "";
  let quoted = false;
  let keepReading = true;

  function emitRow(values) {
    if (!headers) {
      headers = values.map((header) => header.trim());
      return true;
    }

    if (!values.some(Boolean)) {
      return true;
    }

    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return onRow(record);
  }

  while (keepReading) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];
      const next = chunk[index + 1];

      if (quoted) {
        if (char === "\"" && next === "\"") {
          field += "\"";
          index += 1;
        } else if (char === "\"") {
          quoted = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === "\"") {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        keepReading = emitRow(row);
        row = [];
        field = "";
        if (!keepReading) {
          await reader.cancel();
          break;
        }
      } else if (char !== "\r") {
        field += char;
      }
    }
  }

  if (keepReading && (field.length > 0 || row.length > 0)) {
    row.push(field);
    emitRow(row);
  }
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

function objectMatchesQuery(object, { artist, category, q }) {
  const artistMatches = !artist || normalize(read(object, "attribution"))?.includes(artist);
  const categoryMatches = !category || getObjectCategoryValues(object).includes(category);
  const queryText = [
    read(object, "title"),
    read(object, "attribution"),
    read(object, "classification"),
    read(object, "subclassification", "subClassification"),
    read(object, "visualbrowserclassification", "visualBrowserClassification"),
    read(object, "medium"),
    read(object, "displaydate", "displayDate")
  ].join(" ").toLowerCase();
  const queryMatches = !q || queryText.includes(q);

  return artistMatches && categoryMatches && queryMatches;
}

function imageMatchesQuery(image, objectIds, { orientation }) {
  const objectId = read(image, "depictstmsobjectid", "depictsTmsObjectId");
  if (!objectIds.has(objectId)) {
    return false;
  }

  const openAccess = read(image, "openaccess", "openAccess");
  if (openAccess === "0") {
    return false;
  }

  const iiifUrl = read(image, "iiifurl", "iiifURL", "imageurl", "imageURL", "url");
  if (!iiifUrl) {
    return false;
  }

  const width = toNumber(read(image, "width"));
  const height = toNumber(read(image, "height"));
  const orientationMatches = !orientation || getOrientation(width, height) === orientation;
  return orientationMatches;
}

function wallpaperMatchesQuery(wallpaper, { artist, category, orientation, q }) {
  const artistMatches = !artist || normalize(wallpaper.artist)?.includes(artist);
  const categoryMatches = !category || getCategoryValues(wallpaper).includes(category);
  const orientationMatches = !orientation || wallpaper.orientation === orientation;
  const queryMatches = !q || `${wallpaper.title} ${wallpaper.artist} ${wallpaper.category} ${wallpaper.metadata.assistiveText} ${wallpaper.metadata.medium} ${wallpaper.metadata.date}`.toLowerCase().includes(q);

  return artistMatches && categoryMatches && orientationMatches && queryMatches;
}

function getObjectCategoryValues(object) {
  return uniqueValues([
    read(object, "classification"),
    read(object, "subclassification", "subClassification"),
    read(object, "visualbrowserclassification", "visualBrowserClassification")
  ]).map(normalize).filter(Boolean);
}

function getCategoryValues(wallpaper) {
  return uniqueValues([
    wallpaper.category,
    wallpaper.metadata.classification,
    wallpaper.metadata.subClassification,
    wallpaper.metadata.visualBrowserClassification
  ]).map(normalize).filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function getRandomPoolKey(query = {}) {
  const filters = {
    artist: normalize(query.artist) ?? "",
    category: normalize(query.category) ?? "",
    orientation: normalize(query.orientation) ?? "",
    q: normalize(query.q) ?? ""
  };

  return JSON.stringify(filters);
}

function shuffle(values, random) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
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
