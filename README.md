# Ambiart

Ambiart is a lightweight wallpaper API for Google TV-style ambient art screens. It serves curated image metadata, simple randomization, and TV-friendly response shapes, with optional National Gallery of Art Open Data integration.

## Features

- `GET /health` service status
- `GET /v1/wallpapers` list wallpapers with optional filters
- `GET /v1/wallpapers/random` return a random wallpaper
- `GET /v1/wallpapers/:id` return one wallpaper
- `GET /v1/nga/wallpapers` list National Gallery of Art wallpapers
- `GET /v1/nga/wallpapers/random` return a random National Gallery artwork
- `GET /v1/nga/wallpapers/random.jpg` redirect directly to a TV-sized NGA JPEG
- `GET /v1/nga/wallpapers/:id` return one National Gallery artwork
- `GET /v1/nga/wallpapers/:id.jpg` redirect directly to a TV-sized NGA JPEG
- `GET /v1/manifest` describe API capabilities for clients
- `GET /` tiny browser preview page

## Quick Start

```bash
npm start
```

The API runs on `http://localhost:8787` by default.

## Configuration

Create a `.env` file or set environment variables directly:

```bash
PORT=8787
AMBIART_BASE_URL=https://your-domain.example
NGA_IMAGES_URL=https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv
NGA_SCAN_LIMIT=500
```

`AMBIART_BASE_URL` is used when clients need absolute image and API URLs.

The NGA URL defaults to the official National Gallery of Art Open Data image CSV on GitHub. Ambiart streams a bounded slice of `published_images.csv`, maps each row into the wallpaper shape, builds TV-friendly IIIF image URLs, and caches the result in memory for six hours. Increase `NGA_SCAN_LIMIT` if you want Ambiart to scan deeper into the dataset.

## API Examples

List wallpapers:

```bash
curl "http://localhost:8787/v1/wallpapers?category=nature&orientation=landscape&limit=10"
```

Random wallpaper:

```bash
curl "http://localhost:8787/v1/wallpapers/random"
```

Single wallpaper:

```bash
curl "http://localhost:8787/v1/wallpapers/aurora-drift"
```

National Gallery artworks:

```bash
curl "http://localhost:8787/v1/nga/wallpapers?orientation=landscape&limit=10"
```

Random National Gallery artwork:

```bash
curl "http://localhost:8787/v1/nga/wallpapers/random"
```

Direct TV-sized National Gallery JPEG:

```bash
curl -L "http://localhost:8787/v1/nga/wallpapers/random.jpg?orientation=landscape&width=3840" --output wallpaper.jpg
```

## Google Streamer and Projectivy

Projectivy can display Android TV wallpapers, so the most reliable integration path is:

1. Run Ambiart on a computer, NAS, mini PC, or container that your Google streamer can reach.
2. Use Ambiart's `.jpg` endpoint to pull a TV-sized NGA image.
3. Push that image to the streamer and set it as the Android wallpaper, then let Projectivy show it.

For a local Docker install, copy `tools/ambiart-compose.yml`, replace `YOUR_COMPUTER_OR_SERVER_IP`, and run:

```bash
docker compose -f tools/ambiart-compose.yml up -d --build
```

From Windows with ADB enabled on the Google streamer:

```powershell
.\tools\install-projectivy-wallpaper.ps1 -AmbiartUrl "http://YOUR_COMPUTER_OR_SERVER_IP:8787" -Device "STREAMER_IP:5555"
```

Before running the script, connect ADB once:

```powershell
adb connect STREAMER_IP:5555
adb devices
```

The script downloads a random landscape NGA image from Ambiart, pushes it to `/sdcard/Pictures/Ambiart/nga-wallpaper.jpg`, refreshes Android's media index, and tries Android's wallpaper service. If your Google streamer firmware blocks command-line wallpaper changes, the image is still on-device and can be selected from Projectivy or Android wallpaper settings.

## Wallpaper Shape

```json
{
  "id": "aurora-drift",
  "title": "Aurora Drift",
  "artist": "Ambiart Studio",
  "category": "nature",
  "orientation": "landscape",
  "dominantColor": "#223c5f",
  "imageUrl": "https://...",
  "thumbnailUrl": "https://...",
  "downloadUrl": "http://...",
  "attribution": "...",
  "metadata": {
    "accessionNumber": "...",
    "date": "...",
    "medium": "...",
    "creditLine": "...",
    "iiifUrl": "https://..."
  }
}
```

## National Gallery of Art Data

Ambiart uses the official [National Gallery of Art Open Data repository](https://github.com/NationalGalleryOfArt/opendata) and its [IIIF image API](https://api.nga.gov/iiif/). The NGA dataset is released as CSV under CC0 and contains records for 130,000+ artworks. Image files are not included in that dataset, but `published_images.csv` contains public IIIF image references that Ambiart exposes as `imageUrl` and `thumbnailUrl`.

## Publish to GitHub

This workspace has Git available through Codex's bundled runtime, but the GitHub connector exposed in this session does not include a create-repository action. To publish after creating the repo on GitHub:

```bash
git remote add origin https://github.com/AndrewP-Cloud/Ambiart.git
git push -u origin main
```

If you install GitHub CLI locally, this single command creates and pushes it:

```bash
gh repo create AndrewP-Cloud/Ambiart --private --source . --remote origin --push
```
