export function getManifest(baseUrl) {
  return {
    name: "Ambiart",
    version: "0.1.0",
    baseUrl,
    endpoints: {
      health: `${baseUrl}/health`,
      wallpapers: `${baseUrl}/v1/wallpapers`,
      random: `${baseUrl}/v1/wallpapers/random`,
      randomImage: `${baseUrl}/v1/wallpapers/random.jpg`,
      ngaWallpapers: `${baseUrl}/v1/nga/wallpapers`,
      ngaOptions: `${baseUrl}/v1/nga/options`,
      ngaRandom: `${baseUrl}/v1/nga/wallpapers/random`,
      ngaRandomImage: `${baseUrl}/v1/nga/wallpapers/random.jpg`
    },
    supportedFilters: {
      artist: "Use /v1/nga/options for current values",
      category: "Use /v1/nga/options for current values",
      orientation: ["landscape", "portrait", "square"]
    }
  };
}
