# CS-UDT Prototype — DTRUE 2026 Video Abstract

**CS-UDT (Crowd-Sourced Urban Digital Twin)** — gamified crowd-sensing as the
human layer of an urban digital twin, with triple-channel convergence
verification ("two channels locate, the third verifies").

```
CSUDT_Prototype/
├── README.md                                  ← you are here (setup + filming guide)
├── VideoAbstract_Summary.md                   ← submission text, shot list, deadlines
├── Design_Notes_Triple_Channel_Convergence.md ← the "three tapes" mechanism, prior art
├── Framework_GCS_UDT_Design_Space.md          ← design-space framework skeleton (full-paper backbone,
│                                                genre-modeled on the TA Framework, CHI 2020)
├── models/
│   ├── csudt_models.json                      ← DTDL v3 twin interfaces (Track 1 interoperability)
│   └── README.md                              ← why DTDL + related standards (NGSI-LD, SensorThings, CityGML)
├── dashboard/
│   └── csudt_dashboard.html                   ← planner's twin dashboard (open in browser)
├── client/
│   └── csudt_mobile.html                      ← ZERO-INSTALL citizen client (open on phone)
└── app/                                       ← optional native companion (reference only —
    └── …                                        the one way to read phone barometers)
```

---

## 1. Twin dashboard (zero setup — the big-screen view)

Open `dashboard/csudt_dashboard.html` in any browser (needs internet for map tiles).

- Press **▶ Play** to replay the simulated Hurricane Irma window (Sep 10–12, 2017).
- **Convergence in action:** dots start faint (1 channel), brighten at 2 channels
  (quest opens), and when sensor anomaly + crowd report + social signal converge
  in the same ~2.8 km cell a green **triangle** snaps shut with a "▲ CONFIRMED ·
  +25 convergence bonus" ticker entry. Watch San Marco/Downtown at the peak.
- Everything is labeled SIMULATED; station locations real-but-approximate.

## 2. Citizen client (zero install — the phone view)

Open `client/csudt_mobile.html` on any phone browser. No app store, no install —
this is the participation-equity point: a QR code at a shelter is the entire
onboarding.

- **Sense tab:** official-station pressure anchor (simulated feed, honestly
  labeled — browsers cannot read the phone barometer), real in-browser
  accelerometer (tap Enable; iOS asks once), GPS attach with a manual
  neighborhood fallback.
- **Report tab:** camera opens directly from the photo box (`<input capture>`),
  hazard chips, severity, note → mock-LLM parse → points, badge unlocks.
- **Quests tab:** the convergence mechanic as UI — "2 of 3 channels agree, be
  the third tape," one-tap confirm (+10), with a ▲ CONFIRMED payoff.
- **Community tab:** feed, kudos-as-verification, leaderboard.
- **📡 Offline relay (QR data-mule):** on your own reports, tap "QR" — the
  report (minus photo) becomes a single QR any phone camera can scan. The
  scanning phone opens the client and delivers the report when it has signal;
  the courier earns +5. Networks fail during extreme weather — reports can hop
  person-to-person until one phone finds connectivity. (Pattern inspired by
  airgapped-qr-code-transfer, MIT; ours is encode-only, so no scanner library.)
- Demo build: state lives in localStorage; community content is synthetic.

**Serving it to a phone:**
- UI + camera + quests work from a plain file or `python3 -m http.server`.
- **Geolocation and motion need HTTPS.** Quickest paths: drag the file onto
  Netlify Drop, or push to GitHub Pages — both free, ~2 minutes, give you an
  https:// URL (and a QR code makes a great demo moment).

## 3. Optional native companion app (`app/` — reference only)

Browsers expose camera/GPS/motion but **no barometer** (no browser implements a
pressure sensor; a PWA doesn't change this). The Expo app in `app/` remains the
only way to add passive phone-pressure sensing ("power users"), and is kept as
reference source. Not needed for the demo.

## 4. Filming the 15–30s clip (due July 31 with the summary)

Follow the shot list in `VideoAbstract_Summary.md`. Tips:
- Dashboard: screen-record at 1080p+, browser chrome hidden (F11). The money
  shot is the **triangle snapping shut at San Marco** — scrub to ~Sep 11 late
  morning and press Play just before.
- Client: film the phone in hand, opening the link from a QR code → report flow
  → quest confirm. "No install" reads on camera in seconds.
- Keep the SIMULATED labels visible — reviewers respect honesty.

## 5. Honest framing (keep this discipline)

- Demo = **tracking/nowcasting**, not prediction.
- Replay/community events are synthetic, HumAID-category-styled; real HumAID
  data (crisisnlp.qcri.org/humaid_dataset.html — includes Hurricane Irma) is the
  planned source for the full paper.
- Passive pressure = **official stations** (browsers can't read phone
  barometers); phone-barometer crowdsensing is an optional companion-app
  extension, not a current claim.
- Novelty = the integration + the convergence game loop
  (see Design_Notes_Triple_Channel_Convergence.md); cite PressureNet, MyShake,
  CrowdWater, CrisisSense-LLM, truth-discovery work as foundations.
- Terminology: "collective sensing / crowd verification," not "swarm intelligence."

## 6. Roadmap after acceptance

- Backend (Supabase) so reports persist beyond one browser; live quest routing.
- Real HumAID Irma tweets through the LLM pipeline.
- Simulated-testbed evaluation for the extended abstract (spam-injection
  robustness; latency/precision vs. single-channel baseline).
- User study on convergence mechanics vs. report quality + motivation (SDT) →
  post-conference full paper for the EPiC proceedings.
