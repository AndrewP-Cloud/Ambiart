# Ambiart

Ambiart is a lightweight wallpaper API for Google TV-style ambient art screens. It serves curated image metadata, simple randomization, and TV-friendly response shapes without requiring a database or external services.

## Features

- `GET /health` service status
- `GET /v1/wallpapers` list wallpapers with optional filters
- `GET /v1/wallpapers/random` return a random wallpaper
- `GET /v1/wallpapers/:id` return one wallpaper
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
```

`AMBIART_BASE_URL` is used when clients need absolute image and API URLs.

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
  "attribution": "..."
}
```

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
