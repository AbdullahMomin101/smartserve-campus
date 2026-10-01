w# Smart Canteen — hackathon pitch

## 30-second pitch

Campus kitchens make high-impact food-preparation decisions with incomplete information. Smart Canteen demonstrates a practical feedback loop: simulated attendance, food, waste, bin, and temperature signals feed a transparent demand forecast; the forecast becomes a preparation recommendation; and the result is visible in waste analytics. It runs as a deployable browser prototype today, while making the future hardware and model-validation path explicit.

## The problem

Preparing too much food wastes ingredients, money, and staff effort. Preparing too little harms service. A useful system needs to connect changing attendance and consumption to decisions kitchen teams can understand and act on.

## The solution

Smart Canteen presents five simulated IoT streams, live operational cards, a factor-by-factor demand calculation, menu-level controls, threshold alerts, and an analytics view. The whole demonstration runs in a browser and preserves the demo state locally.

## What is technically interesting

- The prototype joins multiple simulated signals into one operational view rather than showing an isolated chart.
- The forecast is explainable: judges can change weekday, expected attendance, current attendance, prior consumption, waste, weather, and event status, then inspect the result and rationale.
- Sensor values evolve gradually within defined ranges. The simulation feeds shared application state so dashboard, recommendation, and analytics views stay connected.
- It is static-host deployable and does not need credentials, a backend, hardware, or a paid service.

## Honest scope and next validation

This version does not connect hardware or claim trained ML. The forecast is a transparent prototype calculation. Next, collect opt-in historical meal counts and waste weights, compare simple baselines with candidate forecasts using held-out days, and report forecast error before making operational savings claims. A hardware pilot can replace simulated readings with ESP32 telemetry and calibrated load-cell, bin-level, and temperature sensors.

## Live demo sequence (about two minutes)

1. **Start with the outcome:** “We want kitchens to prepare closer to actual demand.”
2. **Start Demo** in Presentation Mode. Point to attendance, remaining food, waste, and temperature changing live.
3. **Show the mechanism:** open AI Prediction; change expected attendance or weather; run the forecast; explain how the listed inputs affect demand and preparation.
4. **Show an operational action:** open Food Management and edit an item, then show Analytics or Recommendations using the same application data.
5. **Close credibly:** the prototype is deployable now; the next step is instrumented data collection and forecast validation before a real deployment.

## Likely judge questions

**Is the AI real?** The screen is clearly labelled **AI Prediction Prototype**. This version uses an explainable browser calculation, not a trained model or external AI API. We would train and evaluate a model only after collecting representative, consented data.

**Are these real sensors?** No. All five readings are simulated in the browser. The “Future Implementation” section describes how physical sensors could replace that layer.

**How will you prove it reduces waste?** Run a measured pilot, compare forecast-assisted preparation with a suitable historical or operational baseline, and report waste per meal plus forecast error across comparable service days. This prototype does not claim measured savings.

**How can it scale?** The UI and browser simulation establish the workflow. A production design would add authenticated ingestion, sensor calibration/health monitoring, a durable database, role-based access, privacy controls, and a validated forecasting service.
