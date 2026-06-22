import wallpapers from "./data/wallpapers.json" with { type: "json" };

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export function listWallpapers(query = {}) {
  const category = normalize(query.category);
  const orientation = normalize(query.orientation);
  const limit = clampLimit(query.limit);

  const filtered = wallpapers.filter((wallpaper) => {
    const categoryMatches = !category || wallpaper.category === category;
    const orientationMatches = !orientation || wallpaper.orientation === orientation;
    return categoryMatches && orientationMatches;
  });

  return filtered.slice(0, limit);
}

export function getWallpaperById(id) {
  return wallpapers.find((wallpaper) => wallpaper.id === id) ?? null;
}

export function getRandomWallpaper(query = {}, random = Math.random) {
  const matches = listWallpapers({ ...query, limit: MAX_LIMIT });
  if (matches.length === 0) {
    return null;
  }

  const index = Math.floor(random() * matches.length);
  return matches[index];
}

export function getManifest(baseUrl) {
  return {
    name: "Ambiart",
    version: "0.1.0",
    baseUrl,
    endpoints: {
      health: `${baseUrl}/health`,
      wallpapers: `${baseUrl}/v1/wallpapers`,
      random: `${baseUrl}/v1/wallpapers/random`,
      ngaWallpapers: `${baseUrl}/v1/nga/wallpapers`,
      ngaRandom: `${baseUrl}/v1/nga/wallpapers/random`,
      ngaRandomImage: `${baseUrl}/v1/nga/wallpapers/random.jpg`
    },
    supportedFilters: {
      category: uniqueValues("category"),
      orientation: uniqueValues("orientation")
    }
  };
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

function uniqueValues(key) {
  return [...new Set(wallpapers.map((wallpaper) => wallpaper[key]))].sort();
}
