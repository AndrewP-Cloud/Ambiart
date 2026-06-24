# Ambiart

A google streaming OS wallpaper manager for National Gallery of Art artworks.

Ambiart is a lightweight wallpaper API for Google TV-style ambient art screens. It serves National Gallery of Art Open Access image metadata, simple randomization, and TV-friendly response shapes.

## Features

- `GET /health` service status
- `GET /v1/wallpapers` list NGA Open Access wallpapers with optional filters
- `GET /v1/wallpapers/random` return a random NGA Open Access wallpaper
- `GET /v1/wallpapers/random.jpg` redirect directly to a TV-sized NGA JPEG
- `GET /v1/wallpapers/:id` return one NGA Open Access wallpaper
- `GET /v1/wallpapers/:id.jpg` redirect directly to a TV-sized NGA JPEG
- `GET /v1/nga/wallpapers` list National Gallery of Art wallpapers
- `GET /v1/nga/options` list available National Gallery filter values
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
NGA_OBJECTS_URL=https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/objects.csv
NGA_SCAN_LIMIT=500
NGA_OBJECT_SCAN_LIMIT=200000
```

`AMBIART_BASE_URL` is used when clients need absolute image and API URLs.

The NGA URLs default to the official National Gallery of Art Open Data CSV files on GitHub. Ambiart streams a bounded slice of `published_images.csv`, finds matching records in `objects.csv`, maps each row into the wallpaper shape, builds TV-friendly IIIF image URLs, and caches the result in memory for six hours. Increase `NGA_SCAN_LIMIT` if you want Ambiart to scan deeper into the image dataset.

## API Examples

List NGA Open Access wallpapers:

```bash
curl "http://localhost:8787/v1/wallpapers?artist=Claude%20Monet&category=painting&orientation=landscape&limit=10"
```

Random wallpaper:

```bash
curl "http://localhost:8787/v1/wallpapers/random"
```

Single wallpaper:

```bash
curl "http://localhost:8787/v1/wallpapers/nga-17387-00007f61-4922-417b-8f27-893ea328206c"
```

National Gallery artworks:

```bash
curl "http://localhost:8787/v1/nga/wallpapers?artist=Alma%20Thomas&category=painting&orientation=landscape&limit=10"
```

Available National Gallery filter values:

```bash
curl "http://localhost:8787/v1/nga/options"
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
  "id": "nga-17387-00007f61-4922-417b-8f27-893ea328206c",
  "title": "National Gallery artwork",
  "artist": "National Gallery of Art",
  "category": "drawing",
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

Ambiart uses the National Gallery of Art's [Free Images and Open Access](https://www.nga.gov/artworks/free-images-and-open-access) program, the official [National Gallery of Art Open Data repository](https://github.com/NationalGalleryOfArt/opendata), and NGA's [IIIF image API](https://api.nga.gov/iiif/). The Gallery makes more than 60,000 images available as free downloads and says images of those works are free of charge for commercial or non-commercial use. The Open Data dataset is released under CC0 and contains factual records for 130,000+ artworks and artists. Image files are not included in the CSV dataset, but `published_images.csv` contains public IIIF image references that Ambiart exposes as `imageUrl`, `thumbnailUrl`, and direct `.jpg` download routes.

### National Gallery Filter Options

Ambiart exposes the current filter values from the scanned NGA feed at `GET /v1/nga/options`. Because the NGA dataset is updated frequently and Ambiart intentionally scans a bounded image window, these options can change when `NGA_SCAN_LIMIT` changes or the upstream CSV refreshes.

Supported query parameters for `GET /v1/nga/wallpapers`, `GET /v1/nga/wallpapers/random`, and `GET /v1/nga/wallpapers/random.jpg`:

- `artist`: partial, case-insensitive match against `objects.csv` `attribution`
- `category`: case-insensitive match against `objects.csv` `visualBrowserClassification`, `classification`, or `subClassification`
- `orientation`: exact match against Ambiart's computed `landscape`, `portrait`, or `square` value from `published_images.csv` `width` and `height`
- `q`: partial, case-insensitive text search across title, artist, category, and assistive text
- `limit`: number of JSON records to return, clamped from `1` to `100`
- `width`: direct `.jpg` endpoints only, IIIF image width clamped from `200` to `4096`

Relevant NGA Open Data fields Ambiart uses:

- `published_images.csv`: `iiifURL`, `iiifThumbURL`, `width`, `height`, `openaccess`, `depictstmsobjectid`, `assistivetext`, `viewtype`
- `objects.csv`: `objectID`, `title`, `displayDate`, `medium`, `attribution`, `classification`, `subClassification`, `visualBrowserClassification`, `accessionNum`
