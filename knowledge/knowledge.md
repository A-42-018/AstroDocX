## [adx-overview] AstroDocX overview (README)
URL: https://github.com/A-42-018/AstroDocX
Astronaut + Doctor + X — an offline-first health co-pilot for astronauts on long-duration missions. Built by Team AstroDocX in Dhaka, Bangladesh for the NASA Space Apps Challenge 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". The loop is Detect, Explain, Act, Log, Sync later. AstroDocX is a prototype and not a medical device. It runs on synthetic demo data (a 6-crew 30-day demo mission). It is an independent Space Apps project using NASA open data and is not affiliated with or endorsed by NASA. Every number, alert, finding and step comes from tested, deterministic code; VITA's live answers only re-word cited sources or the console's own crew exam. Only the CO2 and radiation dose limits are NASA-STD-3001 cited; other thresholds are illustrative and labelled so.

## [adx-personal-baselines] AstroDocX: Personal baselines
URL: https://github.com/A-42-018/AstroDocX
Personal baselines: Learns each astronaut's own normal for 11 metrics (HR, HRV, SpO₂, sleep, exercise, reaction time, mood, CO₂, cabin temperature, noise, radiation dose) with Welford + EWMA; it only learns while nominal, so slow drift is not "learned away"

## [adx-detection] AstroDocX: Detection
URL: https://github.com/A-42-018/AstroDocX
Detection: Smoothed z-scores plus cited absolute limits (NASA-STD-3001 CO₂ and dose), persistence (2–3 readings in a row) and two-signal rules (sleep + reaction); Nominal / Watch / Act with hysteresis

## [adx-explainable-alerts] AstroDocX: Explainable alerts
URL: https://astrodocx.vercel.app/app/alerts
Explainable alerts: Each alert says what changed, by how much, against whose baseline and since when, and links the published NASA evidence behind it (OSDR studies with DOIs, Human Research Program reports on NTRS); context, never a diagnosis

## [adx-action-cards] AstroDocX: Action cards
URL: https://astrodocx.vercel.app/app/alerts
Action cards: Checkable countermeasure steps with progress and Done; open → escalate → ease → resolve lifecycle, all logged

## [adx-status-board] AstroDocX: Status Board
URL: https://astrodocx.vercel.app/app/board
Status Board: Five RIDGE tiles, crew readiness score, crew overview, next action, live vitals strip (ECG-style waves, heart pulse)

## [adx-crew-doctor-vita] AstroDocX: Crew Doctor (VITA)
URL: https://astrodocx.vercel.app/app/doctor
Crew Doctor (VITA): VITA reads every crew member's alerts, baselines, readiness, dose and the ground link together: one cabin-wide finding when the same CO₂ or dose alert hits two or more crew, fatigue clusters, triage order and an EVA screen per person, with steps grouped now / today / next link window. Brief, clinical or SBAR ground-handoff wording, read aloud, added to the ground log; an optional live layer (Claude, /api/doctor) only re-words that exam, and the server rejects any number or crew member the exam does not contain. In the 3D cabin the VITA robot speaks the same brief

## [adx-health-twin-console] AstroDocX: Health Twin (console)
URL: https://astrodocx.vercel.app/app/board
Health Twin (console): A 3D particle body (the same baked human as the landing page) turning gently: the heart beats with the live ECG, a pulse runs down the arteries, and each hazard colours its own part (brain, lungs, legs, skin, transmitter arm) amber or red

## [adx-trends] AstroDocX: Trends
URL: https://astrodocx.vercel.app/app/trends
Trends: 11 charts with the personal baseline band, alert markers, 24 h / 7 d / 30 d

## [adx-daily-check-in] AstroDocX: Daily Check-in
URL: https://astrodocx.vercel.app/app/checkin
Daily Check-in: Opens on an optional face scan (below), then mood, sleep quality, hours slept, 8 symptom chips and a 5-tap reaction test (PVT-style); symptoms and sleep quality raise alerts

## [adx-face-scan-experimental] AstroDocX: Face scan (experimental)
URL: https://github.com/A-42-018/AstroDocX
Face scan (experimental): A 30-second webcam scan estimates heart rate, breathing and a rough HRV from the tiny colour change of facial skin (remote photoplethysmography, POS method), each with a quality score. The video never leaves the device and only the numbers are kept. A webcam is not a medical sensor: scans are context, never a diagnosis

## [adx-watch-experimental] AstroDocX: Watch (experimental)
URL: https://github.com/A-42-018/AstroDocX
Watch (experimental): Connect a Haylou Solar 5 smartwatch over Web Bluetooth (Chrome or Edge) for live heart rate and SpO₂, plus its stored stress and sleep history. Nothing is saved unless you switch on *Save watch data on this device*; saved data is linked to one crew member, exportable as CSV or JSON and erasable in one click

## [adx-on-device-insights-shadow-mode] AstroDocX: On-device insights (shadow mode)
URL: https://github.com/A-42-018/AstroDocX
On-device insights (shadow mode): From saved watch data, in the Trends screen: a personal anomaly detector (Isolation Forest plus robust z-scores, scored walk-forward), a 24-hour heart-rate forecast band (Holt-Winters), a transparent readiness score and a watch-vs-face-scan agreement check. All of it runs in the browser and is never wired into the alert engine, so a wrist artefact cannot raise a medical alert. See the model card

## [adx-3d-cabin] AstroDocX: 3D Cabin
URL: https://github.com/A-42-018/AstroDocX
3D Cabin: A walk through a lived-in ISS-style module at /app/cabin, from the helmet view out to the astronaut on EVA, driven by the console's live data: a crew of six with name tags, the robots VITA and MEDI patrolling the hall, wall screens that run real console pages, a helmet-visor HUD tied to the health monitor, NASA Visible Earth in the window, touch and float-mode controls

## [adx-guided-tour] AstroDocX: Guided tour
URL: https://github.com/A-42-018/AstroDocX
Guided tour: One link (/?tour=full) plays the homepage briefing, the console's main screens with a live CO₂ fault, and the cabin out to the EVA; VITA narrates every stop, captions match the voice, and you can pause, skip or exit at any time

## [adx-sound] AstroDocX: Sound
URL: https://github.com/A-42-018/AstroDocX
Sound: Everything is synthesised in the browser, no audio files: glass-bell interface sounds, Quindar radio tones, generated score beds per screen that duck under speech, and a distinct speaking voice for each crew role, VITA, MEDI and NOVA. One Sound switch per page (remembered in the browser, shared with the homepage); the score is a separate opt-in

## [adx-nasa-library] AstroDocX: NASA Library
URL: https://github.com/A-42-018/AstroDocX
NASA Library: A curated, searchable library of NASA images, video and audio on astronaut health (six collections: bone and muscle, radiation, sleep and isolation, the Twins Study, life support, spacewalks), pulled live from NASA's Image and Video Library with credit and links

## [adx-mission-simulator] AstroDocX: Mission Simulator
URL: https://astrodocx.vercel.app/app/simulator
Mission Simulator: Mission clock, fast-forward, 4 injectable scenarios (solar event, CO₂ fault, insomnia, deconditioning); watch the engine react

## [adx-ground-sync] AstroDocX: Ground Sync
URL: https://astrodocx.vercel.app/app/sync
Ground Sync: Delay-tolerant outbox: link windows, 12-minute delay, blackout, auto-sync, CSV log export

## [adx-ground-view] AstroDocX: Ground View
URL: https://astrodocx.vercel.app/app/ground
Ground View: Flight-surgeon view rebuilt only from synced entries (shows what Earth knows, and when); each crew card shows the 3D body in its status colour

## [adx-nasa-data] AstroDocX: NASA Data
URL: https://astrodocx.vercel.app/app/nasa
NASA Data: The NASA basis of the console in one screen: for each of NASA's five hazards, what AstroDocX monitors, the NASA-STD-3001 limit it checks and the NASA studies cited; every alert and Status Board tile carries a NASA source tag. Also a Real crew data panel: measured blood counts, metabolic and inflammation markers from the four SpaceX Inspiration4 crew (NASA OSDR OSD-569 and OSD-575), each person charted against their own pre-flight baseline and the lab reference range

## [adx-platform] AstroDocX: Platform
URL: https://github.com/A-42-018/AstroDocX
Platform: Offline-first installable PWA, IndexedDB on the device, 6-crew 30-day demo mission preloaded

## [adx-roadmap] AstroDocX roadmap (README)
URL: https://github.com/A-42-018/AstroDocX
Not built yet (Roadmap): support for more wearables than the one watch, wearable data feeding the alert engine (today it stays in shadow mode), a real Supabase ground backend with proper policies, vision/SANS self-tests, blood pressure, bone density, a multi-device ground station.

## [adx-screens] AstroDocX Crew Console screens
URL: https://astrodocx.vercel.app/app/
The Crew Console at /app/ has 9 screens: Status Board (/board), Crew Doctor (/doctor), Alerts (/alerts), Trends (/trends), Check-in (/checkin), Simulator (/simulator), Ground Sync (/sync), Ground View (/ground), NASA Data (/nasa). It is an offline-first installable PWA.

## [adx-cabin] AstroDocX 3D cabin
URL: https://astrodocx.vercel.app/app/cabin
The 3D cabin (/app/cabin) is a scroll-driven tour of a space-station hall with 10 camera stops. It starts inside an astronaut's helmet, where a visor HUD wired to AstroDocX shows crew readiness, the five hazard modules, the ground link and the engine's next action. It passes four wall screens running the real Crew Console, with crew members floating beside them and TARS robots walking the floor, looks back from the window, and ends outside with a crew member on a spacewalk (EVA) beside the station.

## [adx-how-detection-works] How AstroDocX detection works (engine)
URL: https://astrodocx.vercel.app/app/alerts
AstroDocX monitors 11 metrics: Heart rate (bpm, hazard G); HRV (ms, hazard G); SpO₂ (%, hazard E); Sleep last night (h, hazard I); Exercise load (min, hazard G); Reaction time (ms, hazard I); Mood (1-5, hazard I); Cabin CO₂ (mmHg, hazard E); Cabin temperature (°C, hazard E); Cabin noise (dBA, hazard E); Dose rate (µSv/h, hazard R). For each crew member it learns a personal baseline with Welford running statistics and an EWMA-smoothed z-score, and only learns while the status is nominal so slow drift is not learned away. A status is Nominal, Watch or Act, with hysteresis; a statistical Watch or Act needs 2 readings in a row. Absolute limits come from NASA-STD-3001 for CO2 and radiation dose. A two-signal rule combines low sleep with slow reaction time. Each alert says what changed, by how much, against whose baseline and since when, and links published NASA evidence. This is context, never a diagnosis.

## [adx-limits] AstroDocX limits (limits.ts)
URL: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf
CO2: NASA-STD-3001 Vol. 2 [V2 6004] limits the average 1-hour habitat ppCO2 to 3 mmHg. AstroDocX raises Watch after 3 consecutive hourly readings over the limit and Act after 6; a single reading of 4.5 mmHg or more is an illustrative emergency level (AstroDocX's own choice, not a NASA value). Radiation: NASA-STD-3001 Vol. 1 sets a career effective dose of 600 mSv and 250 mSv per solar particle event; AstroDocX compares a rolling 24-hour dose with the per-event limit, Watch at 125 mSv and Act at 250 mSv. Ground Sync flags data not yet sent to Earth: Watch at 24 h, Act at 72 h (AstroDocX design, not a NASA value).

## [std-std-3001-v2-6004-3] NASA-STD-3001 Vol. 2 [V2 6004]: habitat carbon dioxide
URL: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf
NASA-STD-3001 Vol. 2 [V2 6004]: habitat carbon dioxide: 3 mmHg ppCO₂, 1-hour average. How AstroDocX applies it: Watch after 3 consecutive hours over the limit, Act after 6.

## [std-std-3001-v1-250] NASA-STD-3001 Vol. 1: solar particle event dose
URL: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
NASA-STD-3001 Vol. 1: solar particle event dose: 250 mSv effective dose per event. How AstroDocX applies it: Rolling 24-hour dose: Watch at 125 mSv, Act at 250 mSv.

## [std-std-3001-v1-600] NASA-STD-3001 Vol. 1: career radiation dose
URL: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
NASA-STD-3001 Vol. 1: career radiation dose: 600 mSv effective dose, career. How AstroDocX applies it: The ceiling the cumulative dose is read against.

## [hazard-r] NASA hazard R: Space Radiation
URL: https://www.nasa.gov/hrp/hazards/
Space Radiation (R in RIDGE). Outside Earth’s protective field, radiation raises long-term risks such as cancer and damage to the nervous system. AstroDocX: Tracks dose rate and cumulative dose, and checks the last 24 hours against the NASA per-event limit. Metrics: Dose rate. Limits checked: 250 mSv effective dose per event; 600 mSv effective dose, career.

## [hazard-i] NASA hazard I: Isolation & Confinement
URL: https://www.nasa.gov/hrp/hazards/
Isolation & Confinement (I in RIDGE). Long missions in a small crew and a closed space wear on sleep, mood and performance. AstroDocX: Tracks sleep, mood and a psychomotor vigilance (reaction time) test against each person’s own baseline. Metrics: Sleep last night, Reaction time, Mood.

## [hazard-d] NASA hazard D: Distance from Earth
URL: https://www.nasa.gov/hrp/hazards/
Distance from Earth (D in RIDGE). Far from Earth, help and communication are delayed, so the crew must handle problems on board. AstroDocX: Works fully offline; action cards guide the crew, and Ground Sync flags data not yet sent to Earth (Watch at 24 h, Act at 72 h). Metrics: .

## [hazard-g] NASA hazard G: Gravity Fields
URL: https://www.nasa.gov/hrp/hazards/
Gravity Fields (G in RIDGE). Weightlessness unloads muscle and bone and changes how the heart works. AstroDocX: Tracks exercise load, heart rate and heart rate variability against each person’s own baseline. Metrics: Heart rate, HRV, Exercise load.

## [hazard-e] NASA hazard E: Hostile/Closed Environments
URL: https://www.nasa.gov/hrp/hazards/
Hostile/Closed Environments (E in RIDGE). The cabin is a closed system: its air, temperature and noise affect crew health directly. AstroDocX: Tracks cabin CO₂ against the NASA habitat limit, plus SpO₂, temperature and noise. Metrics: SpO₂, Cabin CO₂, Cabin temperature, Cabin noise. Limits checked: 3 mmHg ppCO₂, 1-hour average.

## [ev-20170005625] NASA NTRS 20170005625: Risk of Cardiac Rhythm Problems During Spaceflight
URL: https://ntrs.nasa.gov/citations/20170005625
NASA NTRS 20170005625, "Risk of Cardiac Rhythm Problems During Spaceflight". Why AstroDocX cites it: Human Research Program evidence on heart rate and rhythm changes in flight.

## [ev-osd-484] NASA OSDR OSD-484 · doi:10.26030/semj-9y19: Astronauts plasma-derived exosomes induced gene expression in AC16 cells
URL: https://osdr.nasa.gov/bio/repo/data/studies/OSD-484
NASA OSDR OSD-484 · doi:10.26030/semj-9y19, "Astronauts plasma-derived exosomes induced gene expression in AC16 cells". Why AstroDocX cites it: Astronaut blood after flight changes gene expression in human heart cells.

## [ev-osd-942] NASA OSDR OSD-942 · doi:10.26030/2ngb-7470: Exercise Training Attenuates the Muscle Mitochondria Genomic Response to Bed Rest (microarray data)
URL: https://osdr.nasa.gov/bio/repo/data/studies/OSD-942
NASA OSDR OSD-942 · doi:10.26030/2ngb-7470, "Exercise Training Attenuates the Muscle Mitochondria Genomic Response to Bed Rest (microarray data)". Why AstroDocX cites it: Without exercise, unloaded muscle loses mitochondrial gene activity; training limits the loss.

## [ev-20160003864] NASA NTRS 20160003864: Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload
URL: https://ntrs.nasa.gov/citations/20160003864
NASA NTRS 20160003864, "Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload". Why AstroDocX cites it: Human Research Program evidence linking short sleep to slower reactions and errors.

## [ev-20160004365] NASA NTRS 20160004365: Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders: Evidence Report
URL: https://ntrs.nasa.gov/citations/20160004365
NASA NTRS 20160004365, "Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders: Evidence Report". Why AstroDocX cites it: Human Research Program evidence on mood and behavioural health in isolation and confinement.

## [ev-osd-993] NASA OSDR OSD-993 · doi:10.26030/4kkv-z246: Space radiation induces distinct senescent phenotypes: Implications for space travel [bulk RNA-Seq]
URL: https://osdr.nasa.gov/bio/repo/data/studies/OSD-993
NASA OSDR OSD-993 · doi:10.26030/4kkv-z246, "Space radiation induces distinct senescent phenotypes: Implications for space travel [bulk RNA-Seq]". Why AstroDocX cites it: Space-like radiation drives human cells into senescence, a long-term health risk of dose.

## [ev-20160012725] NASA NTRS 20160012725: Relationship Between Carbon Dioxide Levels and Reported Congestion and Headaches on the International Space Station
URL: https://ntrs.nasa.gov/citations/20160012725
NASA NTRS 20160012725, "Relationship Between Carbon Dioxide Levels and Reported Congestion and Headaches on the International Space Station". Why AstroDocX cites it: ISS crew reports of headache and congestion rise with cabin CO₂.

## [nasa-resources] NASA resources AstroDocX draws on
URL: https://osdr.nasa.gov/bio/
NASA Human Research Program: the five hazards: The RIDGE framework the Status Board and readiness score are organised by. (https://www.nasa.gov/hrp/hazards/) NASA Open Science Data Repository (OSDR): Spaceflight and analogue studies cited as evidence for heart, muscle and radiation alerts. (https://osdr.nasa.gov/bio/) NASA OSDR: SpaceX Inspiration4 studies: Ten public studies of the four-person civilian crew (OSD-569 to 575, 630, 656, 687). The blood counts, metabolic panel and cardiovascular markers in OSD-569 and OSD-575 are drawn on the NASA Data screen; the omics, microbiome and urine studies are cited, not used as data. (https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) NASA Technical Reports Server (NTRS): Human Research Program evidence reports on heart rhythm, sleep loss, behavioural health and CO₂. (https://ntrs.nasa.gov/) NASA Office of the Chief Health & Medical Officer: Publishes NASA-STD-3001 and the technical briefs behind the CO₂ and radiation limits. (https://www.nasa.gov/ochmo/) NASA Human Research Roadmap: Where each Human Research Program risk and its evidence are tracked. (https://humanresearchroadmap.nasa.gov/) NASA Visible Earth: Earth imagery seen from the 3D cabin window. (https://visibleearth.nasa.gov/) NASA 3D Resources: The Z2 spacesuit, Orion and TDRS models on the landing page. (https://science.nasa.gov/3d-resources/)

## [res-nasa-gov-hrp-hazards] NASA Human Research Program: the five hazards
URL: https://www.nasa.gov/hrp/hazards/
NASA Human Research Program: the five hazards: The RIDGE framework the Status Board and readiness score are organised by.

## [res-osdr-nasa-gov-bio] NASA Open Science Data Repository (OSDR)
URL: https://osdr.nasa.gov/bio/
NASA Open Science Data Repository (OSDR): Spaceflight and analogue studies cited as evidence for heart, muscle and radiation alerts.

## [res-osdr-nasa-gov-bio-repo-data-studies-OSD-575] NASA OSDR: SpaceX Inspiration4 studies
URL: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
NASA OSDR: SpaceX Inspiration4 studies: Ten public studies of the four-person civilian crew (OSD-569 to 575, 630, 656, 687). The blood counts, metabolic panel and cardiovascular markers in OSD-569 and OSD-575 are drawn on the NASA Data screen; the omics, microbiome and urine studies are cited, not used as data.

## [res-ntrs-nasa-gov] NASA Technical Reports Server (NTRS)
URL: https://ntrs.nasa.gov/
NASA Technical Reports Server (NTRS): Human Research Program evidence reports on heart rhythm, sleep loss, behavioural health and CO₂.

## [res-nasa-gov-ochmo] NASA Office of the Chief Health & Medical Officer
URL: https://www.nasa.gov/ochmo/
NASA Office of the Chief Health & Medical Officer: Publishes NASA-STD-3001 and the technical briefs behind the CO₂ and radiation limits.

## [res-humanresearchroadmap-nasa-gov] NASA Human Research Roadmap
URL: https://humanresearchroadmap.nasa.gov/
NASA Human Research Roadmap: Where each Human Research Program risk and its evidence are tracked.

## [res-visibleearth-nasa-gov] NASA Visible Earth
URL: https://visibleearth.nasa.gov/
NASA Visible Earth: Earth imagery seen from the 3D cabin window.

## [res-science-nasa-gov-3d-resources] NASA 3D Resources
URL: https://science.nasa.gov/3d-resources/
NASA 3D Resources: The Z2 spacesuit, Orion and TDRS models on the landing page.

## [gen-bone-loss] NASA: Counteracting Bone and Muscle Loss in Microgravity
URL: https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/
In space, astronauts' weight-bearing bones become roughly 1% less dense for every month. Bone-building cells slow down while the cells that break down old or damaged bone keep working at their normal pace. Muscles weaken because they no longer need to work as hard. Crews exercise an average of about two hours a day, using treadmills, stationary bicycles and the Advanced Resistive Exercise Device (ARED), which simulates weightlifting. Pre-flight exercise training improves performance on station. Researchers found decreased expression of genes related to muscle growth and metabolism in microgravity, and drugs such as myostatin inhibitors may help prevent bone and muscle loss.

## [gen-exercise] NASA: Astronaut Exercise
URL: https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/
Astronauts on the space station average two hours of exercise per day to maintain bone and muscle health. Equipment includes ARED (a piston and flywheel system that mimics weightlifting in weightlessness), the T2 treadmill and CEVIS, a computer-controlled cycle ergometer with vibration isolation. Without Earth's gravity both bone and muscle atrophy, becoming smaller and weaker. Early programmes of long, low-intensity workouts proved ineffective; high-intensity, low-volume exercise was found more effective, which also saves crew time and equipment wear.

## [gen-sans] NASA: Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)
URL: https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/
Spaceflight Associated Neuro-ocular Syndrome (SANS) is a set of eye and brain changes linked to weightlessness. Chronic weightlessness can shift blood and cerebrospinal fluid toward the head, which can lead to optic nerve swelling, folds in the retina, flattening of the back of the eye and swelling in the brain. Approximately 70 percent of astronauts aboard the International Space Station experience some swelling in the back of their eyes. Some astronauts have only mild changes; others have clinically significant outcomes. The risk is higher on longer missions. The long-term health outcome is unknown and actively being investigated. NASA is investigating nutritional supplements that could protect the eyes and mechanical interventions that may help reverse headward fluid shifts. AstroDocX does not yet include vision or SANS self-tests; they are on its roadmap.

## [gen-radiation] NASA HRP: Space Radiation hazard
URL: https://www.nasa.gov/hrp/hazard-space-radiation/
NASA considers space radiation one of the most hazardous aspects of spaceflight. The sources are high-energy galactic cosmic rays, which are remnants of supernovas, and solar storms such as solar particle events and coronal mass ejections. Radiation exposure increases cancer risk, damages the central nervous system, can alter cognitive function, reduce motor function and prompt behavioral changes. Astronauts cannot see or feel it. NASA scientists are studying its effects on the human body and developing ways to monitor and protect against it.

## [gen-isolation] NASA HRP: Isolation and Confinement hazard
URL: https://www.nasa.gov/hrp/hazard-isolation-and-confinement/
Behavioral responses occur among groups of people far from Earth who are isolated and confined in a small space over a long period. Sleep loss, circadian desynchronization and work overload compound this and may lead to decreased performance, adverse health outcomes and compromised mission objectives. NASA's Human Research Program studies behavioral health monitoring, workload and performance, circadian rhythm management and team dynamics. Countermeasures include careful crew selection, training and support, journaling tools, and analog missions in habitats such as HERA and CHAPEA that simulate confinement.

## [gen-behavioral-report] NTRS 20160004365: Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders
URL: https://ntrs.nasa.gov/citations/20160004365
NASA's evidence report says the average incidence of an adverse behavioral health event during a space mission is relatively low under current conditions, but that the likelihood of an adverse cognitive or behavioral condition or psychiatric disorder greatly increases with mission length. Mood and anxiety disturbances have occurred historically, with no severe behavioral emergencies documented on missions to date. Even when they do not threaten the mission, such conditions adversely affect individual and crew health, welfare and performance, so prevention, early detection and treatment countermeasures are essential.

## [gen-sleep] NTRS 20160003864: Risk of Performance Decrements from Sleep Loss, Circadian Desynchronization, and Work Overload
URL: https://ntrs.nasa.gov/citations/20160003864
NASA's evidence report states that astronauts consistently average less sleep during spaceflight than on the ground. Ground evidence indicates the amount of sleep astronauts get is likely to lead to performance impairment and short- and long-term health consequences. The causes of the sleep loss remain unknown, and the report calls for tools to measure individual sleep needs. It also flags sleep inertia: ground studies show it takes two to four hours to reach optimal performance after waking from a sleep episode, a hazard when crews must respond quickly to an emergency.

## [gen-co2-headache] NTRS 20160012725: CO2 levels, congestion and headaches on the ISS
URL: https://ntrs.nasa.gov/citations/20160012725
A NASA analysis of International Space Station expeditions 2 to 31 found that for each 1 mmHg increase in CO2, the odds of a crew member reporting congestion doubled, and that congestion emerges at roughly 1 mmHg lower than headache reports. To keep the chance of congestion below 1 percent, the average 7-day CO2 level would need to stay under 1.5 mmHg. The study confirmed earlier findings linking CO2 to headaches.

## [gen-twins-immune] NASA: Landmark Twins Study Reveals Resilience of Human Body in Space
URL: https://www.nasa.gov/news-release/nasas-landmark-twins-study-reveals-resilience-of-human-body-in-space/
In NASA's Twins Study, astronaut Scott Kelly spent nearly a year on the space station while his identical twin stayed on Earth. The flu vaccine given in space worked as it does on Earth, so the immune system responded properly. Scott's telomere length unexpectedly increased in space and shortened after he returned, going back to normal within six months; his twin's stayed stable. Most gene-expression changes normalized within six months of return, but a small percentage of genes related to the immune system and DNA repair did not return to baseline. The study also found changes in cognitive function and vision-related changes. Most physiological changes reversed within six months back on Earth.

## [gen-hazard-gravity] NASA HRP: The five hazards of human spaceflight
URL: https://www.nasa.gov/hrp/hazards/
NASA's Human Research Program groups spaceflight risk into five hazards. Gravity Fields: astronauts' entire bodies, including muscles, bones, inner ear and organs, must adjust to the new gravities they encounter. Distance from Earth: instructions, new supplies and medical care become increasingly challenging to receive from Earth. Hostile/Closed Environments: maintaining a safe ecosystem inside a spacecraft presents unique challenges, including temperature, pressure and microbial monitoring. Space Radiation and Isolation and Confinement are the other two.
