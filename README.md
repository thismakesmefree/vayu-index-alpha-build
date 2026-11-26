# Vayu Index

Vayu Index is a no-login weather and air-quality PWA. It pairs current conditions, forecasts, local air-quality readings, and an AQI map to help people make more informed day-to-day plans.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to create the production bundle and `npm test` for focused weather-data tests.

## Data and privacy

- Weather, air quality, and place search use Open-Meteo's public endpoints directly from the browser; no API key or application account is required.
- The selected location, theme, and most recent weather response are stored in this browser for convenience and offline fallback.
- The map uses Leaflet with OpenStreetMap tiles. The app shows the current weather/AQI location and a direct-distance destination preview; turn-by-turn directions open separately on OpenStreetMap.
- The Weather Coach runs the open-weight SmolLM2 360M instruction model locally in a web worker through Transformers.js. Its quantized model files (about 400 MB) download from Hugging Face on first use and are cached by the browser; questions and weather context stay on-device and are not sent to an AI service. No AI account or key is needed. Advice may be inaccurate and is not medical or emergency guidance.
- The service worker caches the app shell, not live API responses. Live data requires an internet connection; the last saved reading can be shown offline.

Open-Meteo supplies the AQI/pollutant forecasts, current aerosol optical depth and dust summary, plus boundary-layer height and 3–9 cm soil volumetric water content for the dispersion tile. These are model estimates, not direct sensor readings, and unavailable fields are shown as such. Vayu Index is not a medical or emergency service.

## Deploy to Vercel

1. Commit and push this branch to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository, leaving the root directory as `./`.
3. Deploy. The included `vercel.json` selects Vite, runs `npm run build`, and publishes `dist`; no environment variables, API keys, or server functions are required. Vercel serves the app over HTTPS, enabling PWA installation and browser AI features.

The Weather Coach model is downloaded directly by each user's browser from Hugging Face on first use (about 400 MB) and cached locally. That download is separate from the Vercel deployment; prompts and weather context are not sent to Vercel or an AI inference service.
