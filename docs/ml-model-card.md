# AstroDocX On-Device Wearable ML Model Card

## 1. Model Details

- **Model Family**: On-Device Statistical & Unsupervised Machine Learning Suite
- **Application**: AstroDocX Astronaut Health & Telemetry Console
- **Sub-Models**:
  1. **Personal Anomaly Detector** (`app/src/ml/anomaly.ts`, `isolationForest.ts`):
     - Unsupervised Isolation Forest (100 trees, sub-sample size up to 256) combined with robust statistics (Median Absolute Deviation / MAD z-scores).
     - Walk-forward scoring: each day is scored only against the good days before it (rolling window of up to 60 days), so a later day never changes an earlier verdict.
     - Flags a day on a high forest score (≥ 0.60), one extreme feature with forest support (|z| ≥ 2.5 and ≥ 0.52), or two or more extreme features.
     - Learns the individual wearer's normative physiological manifold across resting HR, circadian HR mean, minimum/mean SpO₂, daytime stress, and sleep duration/awakenings.
  2. **Diurnal 24-Hour Heart Rate Forecaster** (`app/src/ml/forecast.ts`):
     - Additive Holt-Winters Exponential Smoothing with hourly diurnal seasonality ($L=24$, $\alpha=0.2$, $\beta=0.05$, $\gamma=0.2$).
     - Fitted on every hour before the most recent 24 h, then bands those 24 h ($\pm 1.96\sigma$ of the one-step residuals, Welford's online variance) and compares them with the real readings; hours outside the band are "unusual for this time of day".
  3. **Readiness Score** (`app/src/ml/readiness.ts`):
     - Transparent, multi-component physiological readiness index (0–100 scale) accounting for resting HR deviation from personal baseline, total sleep duration and fragmentation penalty, nocturnal SpO₂ sufficiency, and autonomic stress.
     - Personal ridge regression once $\ge 20$ of the wearer's own check-ins can each be paired with the previous day's features (a day's data predicts the next check-in; no same-day leakage).
     - No score is shown until there are 7 good-quality days of baseline and a recent day with resting HR or sleep data.
  4. **Watch vs. Facial rPPG Agreement** (`app/src/ml/agreement.ts`):
     - Bland-Altman agreement analysis comparing smartwatch optical photoplethysmography (PPG) against experimental contactless webcam remote-PPG (rPPG) within $\pm 60$-second measurement windows.
- **Implementation**: Deterministic TypeScript running entirely in-browser, powered by a seeded pseudo-random number generator (`mulberry32` PRNG) without heavy external machine learning runtimes.

---

## 2. Intended Use & Clinical Safety ("Shadow Mode")

- **Intended Use**: Personalized circadian and autonomic recovery insights for crew members, providing continuous self-monitoring and baseline deviation tracking.
- **Shadow Mode Guarantee**: 
  - The wearable ML subsystem operates strictly in **shadow mode**.
  - All outputs are presented under clear, prominent disclaimers: *"Shadow Mode • Consumer Wearable Insight • Not a Medical Diagnosis"*.
  - **Zero Coupling to Clinical Alert Engine**: Under architectural constraints, wearable data is stored in the isolated Dexie v3 `wearables` store and **never** feeds into the mission-critical medical alert engine (`app/src/engine/*`) or crew baseline stores (`readings`). Consumer-grade sensor artifacts or wrist displacement cannot trigger false emergency alerts.

---

## 3. Data Sources & Privacy

- **Primary Data Source**: Real Haylou Solar 5 smartwatch telemetry received via Web Bluetooth API:
  - Heart rate (HR in bpm)
  - Blood oxygen saturation ($\text{SpO}_2$ in %)
  - Autonomic stress index (1–100)
  - Multi-stage hypnogram (light sleep, deep sleep, REM sleep, wake events)
- **Local Storage**: IndexedDB (Dexie v3) in table `wearables` (`[kind+ts]`, `kind`, `ts`).
- **Privacy & Data Sovereignity**:
  - **100% On-Device**: Zero raw telemetry or model weights are transmitted to cloud servers. All inference, feature engineering, and training take place in the user's browser.
  - **Opt-In Storage**: Persistence is disabled by default; users explicitly enable local storage with the "Save watch data on this device" toggle in the Watch data panel on the Trends page (`app/src/watch/WatchDataPanel.tsx`). The live heart-rate card only shows the watch's status.
  - **One Wearer**: Turning saving on links the watch to the selected crew member. Insights pair watch data only with that person's check-ins and face scans, and other crew members see whose insights they are instead of the insights.
  - **Data Governance**: Users have instantaneous access to CSV/JSON telemetry export, coverage summaries, and single-click total data wipe (`deleteWearableData()`).

---

## 4. Feature Engineering

Raw telemetry samples are aggregated into structured vectors skipping invalid or missing epochs:
- **Hourly Features**: HR mean/min/max/SD, mean $\text{SpO}_2$, mean stress, sample coverage.
- **Local time**: days, hours and the night window follow the wearer's clock (the browser's UTC offset), not UTC. Sleep points are assigned to the day the wearer wakes up on, so a night is never split at midnight.
- **Daily Features**:
  - **Resting Heart Rate (RHR)**: 10th percentile of nighttime (00:00–06:00 local) heart rate readings.
  - **Daytime Heart Rate**: 24-hour mean, standard deviation, minimum, and maximum.
  - **Oxygen Saturation**: Mean $\text{SpO}_2$, minimum $\text{SpO}_2$, and hypoxic dip count ($\text{SpO}_2 < 94\%$).
  - **Autonomic Stress**: 24-hour mean stress level.
  - **Sleep Architecture**: Total sleep duration (hours) and wake-up event count derived from sleep stage transitions.
  - **Coverage Filter**: Epochs with $< 50\%$ daily coverage are flagged as low quality and excluded from model baseline updates.

---

## 5. Warm-Up Requirements

Wearable models require sufficient historical telemetry before emitting inferences:
1. **Anomaly Model Warm-Up**: A day is scored once it has at least **14 good-quality days** ($\ge 50\%$ coverage) before it, mirroring clinical baseline stabilization. The first score appears on the 15th good day.
2. **Forecast Model Warm-Up**: Requires **72 hours** of hourly telemetry: 48 hours (two complete circadian cycles) to initialize diurnal seasonality, plus the 24 hours the band is checked against.
3. **Readiness Warm-Up**: Requires **7 good-quality days** of baseline besides the scored day.
4. **Scan Agreement Warm-Up**: Requires at least **3 paired observations** within $\pm 60$ seconds, using the wearer's own scans.

During warm-up, the user interface displays explicit progress banners (e.g., *"Establishing personal baseline: X of 15 good-quality days recorded"*).

---

## 6. Evaluation & Quantitative Performance

Evaluated against a synthetic wearer benchmark with 60 days of continuous telemetry ($14\text{-day}$ baseline + $46\text{-day}$ test period) containing injected multi-day physiological perturbation episodes (fever/infection, nocturnal hypoxia, severe insomnia). Both models are evaluated **out-of-sample**:
- **Anomaly**: walk-forward, exactly as the live model runs. Each day is scored with a forest and robust statistics fitted only on the days before it, and results are matched to ground truth by date.
- **Forecast**: fitted on days 0–29 and checked on the held-out next 24 hours.

| Metric | Target | Seed 42 | Seed 12345 | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Anomaly Precision** | $\ge 0.80$ | **0.889** | **0.818** | **Passed** |
| **Anomaly Recall** | $\ge 0.85$ | **0.889** | **1.000** | **Passed** |
| **False Alarms per Week** | $\le 1.0$ alarms/week | **0.19** | **0.38** | **Passed** |
| **True Positives** | - | **8 / 9** | **9 / 9** | - |
| **False Positives** | - | **1 / 37** | **2 / 37** | - |
| **24-Hour Forecast MAE** | $\le 4.0$ bpm | **2.66** bpm | **2.70** bpm | **Passed** |
| **Model Determinism** | $100\%$ reproducible | Identical across fixed seeds | | **Passed** |

**Change from the first version.** The first evaluation scored every day against a baseline fitted on all 60 days, including later and anomalous days, and matched results by array index. The walk-forward rerun gives the same counts for seed 42 (8 TP, 1 FP, 1 FN). It missed the first insomnia day and raised one false alarm on day 31. Out-of-sample, the forest cannot isolate anything when the baseline barely varies (it scores every day about 0.5), so a day with **two or more** extreme features ($|z| \ge 2.5$) is now flagged on that alone. Across five seeds this rule is equal or better, with no added false alarms. The second seed, added as a regression check, catches all 9 anomalous days, with 2 false alarms (precision 0.818). The forecast MAE is unchanged (2.66 bpm), because the forecast was already checked on held-out hours.

**Caveat.** The synthetic generator works in UTC with sleep at 00:00–08:00 and clean, full-coverage days, so these numbers are an upper bound. They are not a measure of performance on real watch data.

---

## 7. Limitations & Known Edge Cases

- **Consumer Sensor Noise**: Consumer optical PPG sensors are susceptible to motion artifacts, wrist skin tone variations, ambient light leakage, and fit looseness.
- **Acute Event Blindspot**: The anomaly detector is designed for daily macro-trends (e.g., prodromal illness, chronic stress, systemic hypoxia). It is not designed to detect acute life-threatening arrhythmias (e.g., ventricular fibrillation) in real time.
- **Check-in Label Availability**: Supervised readiness adaptation is deferred until at least 20 subjective check-in labels are recorded by the user. Prior to that threshold, the transparent rule-based readiness score is used.
