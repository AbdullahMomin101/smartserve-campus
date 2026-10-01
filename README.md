# Smart Canteen

**Plan better. Waste less.** Smart Canteen is a browser-based engineering prototype that turns simulated canteen sensor readings into transparent food-demand forecasts, preparation guidance, and waste analytics.

> **Prototype disclosure:** sensor readings are simulated in JavaScript. “AI Prediction Prototype” is a transparent, rule-based forecasting calculation; there is no trained machine-learning model, backend, or physical sensor connection in this version.

## Try the demo

This is a static site: no install, build step, server, account, or API key is required. Open `index.html` in a modern browser.

Use **Demo Login** on the landing page, or choose Login with the displayed demo credentials. Start from **Presentation Mode** for a clean judge-facing walkthrough. All editable data is stored in the browser’s LocalStorage; **Reset Demo Data** restores the initial dataset.

## What it demonstrates

- Five simulated live sensor streams: student count, food remaining, container fill, waste weight, and temperature.
- Gradual, range-bounded sensor changes that update dashboard values, trends, predictions, and threshold alerts.
- A readable demand calculation using expected and current attendance, historical consumption, prior waste, weekday, special-event status, and weather.
- Food-item create, edit, delete, and search flows; analytics filters and Chart.js visualizations; alert resolution; persistent settings and theme.
- A presentation view connecting sensor status → canteen data → forecast → preparation recommendation → expected waste.

## Run and deploy

No dependencies are installed locally. Charts use Chart.js from its public CDN when available and switch to a lightweight native SVG renderer if the CDN cannot be reached, so local/offline demos still show the data visualizations.

### GitHub Pages

1. Create a GitHub repository and push these project files to its default branch.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
4. Wait for the Pages URL to appear in that section. Open it in a private window and run the demo flow.

### Netlify

Import the GitHub repository in Netlify. The included `netlify.toml` configures a no-build publish from the project root. Or drag the project folder into Netlify Drop.

### Vercel

Import the GitHub repository in Vercel. The included `vercel.json` serves this root-level static site without a build command.

Before a public demo, use a clean browser profile, reset demo data, make sure the Chart.js CDN is reachable, and check the deployed URL on laptop and mobile. Do not put private data into this client-only prototype.

## Judging walkthrough

1. Explain the canteen waste-planning problem and the website-only scope.
2. Start Presentation Mode and turn on **Start Demo** to see the sensor readings move.
3. Point out the five sensor cards and how attendance, food remaining, waste, and temperature flow to the dashboard.
4. Open AI Prediction, change expected students or weather, and run the calculation. Explain the visible factors rather than calling it a trained model.
5. Show one food-item edit, the analytics filter, and the resulting recommendation or alert.
6. Close with deployment path and next engineering step: connect verified ESP32/load-cell/ultrasonic/temperature telemetry, then evaluate a trained forecast against a baseline.

For a compact pitch and resume-ready wording, see [HACKATHON_PITCH.md](HACKATHON_PITCH.md) and [RESUME_PROJECT.md](RESUME_PROJECT.md).
