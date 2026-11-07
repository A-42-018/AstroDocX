# AstroDocX On-Device Wearable ML Model Card

## 1. Model Details

- **Model Family**: On-Device Statistical & Unsupervised Machine Learning Suite
- **Application**: AstroDocX Astronaut Health & Telemetry Console
- **Sub-Models**:
  1. **Personal Anomaly Detector** (`app/src/ml/anomaly.ts`, `isolationForest.ts`):
     - Unsupervised Isolation Forest (100 trees, sub-sample size 64) combined with robust statistics (Median Absolute Deviation / MAD z-scores).
     - Learns the individual wearer's normative physiological manifold across resting HR, circadian HR mean, minimum/mean SpO₂, daytime stress, and sleep duration/awakenings.
  2. **Diurnal 24-Hour Heart Rate Forecaster** (`app/src/ml/forecast.ts`):
     - Additive Holt-Winters Exponential Smoothing with hourly diurnal seasonality ($L=24$, $\alpha=0.2$, $\beta=0.05$, $\gamma=0.3$).
     - Forecasts the expected 24-hour HR band with $\pm 2$ standard deviations residual spread computed via Welford's online variance algorithm.
  3. **Readiness Score** (`app/src/ml/readiness.ts`):
     - Transparent, multi-component physiological readiness index (0–100 scale) accounting for resting HR deviation from personal baseline, total sleep duration and fragmentation penalty, nocturnal SpO₂ sufficiency, and autonomic stress.
     - Extensible ridge / logistic regression adaptation once $\ge 20$ subjective crew check-in self-reports are recorded.
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
  - **Opt-In Storage**: Persistence is disabled by default; users explicitly enable local storage via a toggle in `WatchControl.tsx`.
  - **Data Governance**: Users have instantaneous access to CSV/JSON telemetry export, coverage summaries, and single-click total data wipe (`deleteWatchData()`).

---

## 4. Feature Engineering

Raw telemetry samples are aggregated into structured vectors skipping invalid or missing epochs:
- **Hourly Features**: HR mean/min/max/SD, mean $\text{SpO}_2$, mean stress, sample coverage.
- **Daily Features**:
  - **Resting Heart Rate (RHR)**: 10th percentile of nighttime (00:00–07:00) heart rate readings.
  - **Daytime Heart Rate**: 24-hour mean, standard deviation, minimum, and maximum.
  - **Oxygen Saturation**: Mean $\text{SpO}_2$, minimum $\text{SpO}_2$, and hypoxic dip count ($\text{SpO}_2 < 94\%$).
  - **Autonomic Stress**: 24-hour mean stress level.
  - **Sleep Architecture**: Total sleep duration (hours) and wake-up event count derived from sleep stage transitions.
  - **Coverage Filter**: Epochs with $< 50\%$ daily coverage are flagged as low quality and excluded from model baseline updates.

---

## 5. Warm-Up Requirements

Wearable models require sufficient historical telemetry before emitting inferences:
1. **Anomaly Model Warm-Up**: Requires at least **14 days** of high-quality ($\ge 50\%$ coverage) data to establish the personal physiological manifold, mirroring clinical baseline stabilization.
2. **Forecast Model Warm-Up**: Requires at least **48 hours** (two complete circadian cycles) of hourly telemetry to initialize diurnal seasonality factors.
3. **Scan Agreement Warm-Up**: Requires at least **5 paired observations** within $\pm 60$ seconds.

During warm-up, the user interface displays explicit progress banners (e.g., *"Establishing personal baseline: X of 14 days completed"*).

---

## 6. Evaluation & Quantitative Performance

Evaluated against a synthetic wearer benchmark with 60 days of continuous telemetry ($14\text{-day}$ baseline + $46\text{-day}$ test period) containing injected multi-day physiological perturbation episodes (fever/infection, nocturnal hypoxia, severe insomnia):

| Metric | Target | Evaluated Benchmark Value | Result |
| :--- | :--- | :--- | :--- |
| **Anomaly Precision** | $\ge 0.80$ | **0.889** ($88.9\%$) | **Passed** |
| **Anomaly Recall** | $\ge 0.85$ | **0.889** ($88.9\%$) | **Passed** |
| **False Alarms per Week** | $\le 1.0$ alarms/week | **0.19** alarms/week | **Passed** |
| **True Positives** | - | **8 / 9** anomalous days | **Passed** |
| **False Positives** | - | **1 / 37** normal days | **Passed** |
| **24-Hour Forecast MAE** | $\le 4.0$ bpm | **2.66** bpm | **Passed** |
| **Model Determinism** | $100\%$ reproducible | Identical across fixed seeds | **Passed** |

---

## 7. Limitations & Known Edge Cases

- **Consumer Sensor Noise**: Consumer optical PPG sensors are susceptible to motion artifacts, wrist skin tone variations, ambient light leakage, and fit looseness.
- **Acute Event Blindspot**: The anomaly detector is designed for daily macro-trends (e.g., prodromal illness, chronic stress, systemic hypoxia). It is not designed to detect acute life-threatening arrhythmias (e.g., ventricular fibrillation) in real time.
- **Check-in Label Availability**: Supervised readiness adaptation is deferred until at least 20 subjective check-in labels are recorded by the user. Prior to that threshold, the transparent rule-based readiness score is used.
