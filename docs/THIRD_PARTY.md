# Third-party ledger — open source first

Rule (CLAUDE.md): adapt good open-source work instead of rebuilding it, and credit it.
Candidates below were checked on **24 Oct 2026** (license and latest release from the npm registry;
GitHub pages for the two collidingScopes projects); rows added for v4 were checked on **27 Oct
2026**. Re-check before installing, and update this file with the version you actually use. Every
entry that ships goes on `/credits`.

## Recommended

| Use | Project | License | Latest release (checked) | Notes |
|---|---|---|---|---|
| Home word-cloud layout | `d3-cloud` (Jason Davies) | BSD-3-Clause | 1.2.9 · 2026-03 | Proven layout; animate with Motion. Small. |
| Animation | `motion` (motion.dev) | MIT | 14.6.0 · 2026-10 | Springs, layout and scroll animation; respects reduced motion. |
| Left portal starting point | collidingScopes/threejs-handtracking-101 | MIT | GitHub (no release) | three.js + MediaPipe hand tracking in the browser. Fork/vendor with LICENSE kept. |
| Hand tracking | `@mediapipe/tasks-vision` (HandLandmarker) | Apache-2.0 | 1.1.1 · 2026-10 | Self-host the WASM files and `hand_landmarker.task` under `public/mediapipe/`. |
| 3D | `three` | MIT | 0.186.1 · 2026-09 | Load only on /hands. |
| 3D text (optional) | `troika-three-text` | MIT | 0.52.5 · 2026-07 | If puppet captions render in 3D. |
| Right portal particle photos | collidingScopes/particular-drift | MIT | GitHub (no release) | WebGL2 image → flowing particles, client-side. Vendor with LICENSE kept. |
| Chat UI | `@assistant-ui/react` | MIT | 0.15.31 · 2026-10 | Composable React chat primitives with a custom backend adapter. |
| Claude API (server) | `@anthropic-ai/sdk` | Apache-2.0 | 1.3.0 · 2026-10 | Official SDK; used only in the optional Worker (S8). Check docs for citations and caching. |
| Astro integrations | `@astrojs/react`, `@astrojs/sitemap`, `@astrojs/rss` | MIT | 7.1.1 / 3.7.4 / 4.0.19 · 2026 | No adapter: the site is static. |
| Deploy | `withastro/action` + `actions/deploy-pages` (GitHub Actions) | MIT | versions from the Astro GitHub Pages guide | The official Astro → GitHub Pages path. |
| In-browser search (/ask) | `minisearch` | MIT | 7.2.0 · 2025-09 | Fuzzy + prefix search over the Q&A library; small; no server. |
| Worker tooling (S8, optional) | `wrangler` | MIT OR Apache-2.0 | 4.153.0 · 2026-10 | Only inside `worker/`. |
| Image metadata check (CI, D31) | `sharp` (already pulled in by Astro's image service) or `exifr` | Apache-2.0 / MIT | check at install | Fail the build if any output image has GPS/EXIF location tags. Prefer `sharp` to avoid a new dependency. |

## Alternatives (pick in a spike if the recommended one disappoints)

| Use | Project | License | Latest release | Notes |
|---|---|---|---|---|
| Fuzzy search | `fuse.js` | Apache-2.0 | 7.5.0 · 2026-08 | Alternative to MiniSearch. |
| Word cloud (canvas) | `wordcloud` (wordcloud2.js) | MIT | 1.2.3 · 2024-11 | Canvas/HTML renderer. |
| Word cloud (3D sphere) | `TagCloud` | MIT | 2.5.0 · 2024-03 | Tiny rotating tag sphere; can feel dated. |
| Floating-word physics | `matter-js` | MIT | 0.20.0 · 2024-06 | Words that bump and react to the cursor. |
| Particles (general) | `@tsparticles/slim` | MIT | 4.4.0 · 2026-08 | Backgrounds, text masks. |
| React 3D | `@react-three/fiber`, `@react-three/drei` | MIT | 9.8.2 / 10.7.9 · 2026-10/09 | If /hands grows into a React scene. |
| Avatar rigging | `kalidokit` | MIT | 1.1.5 · **2022** | Landmarks → rig rotations. Unmaintained; use only if needed. |
| Avatars | `@pixiv/three-vrm` | MIT | 3.5.5 · 2026-07 | Only with a CC0/permissively licensed model. |
| Chat UI (web component) | `deep-chat` | MIT | 2.5.1 · 2026-08 | Framework-agnostic alternative to assistant-ui. |
| AI SDK | `ai` + `@ai-sdk/anthropic` | Apache-2.0 | 7.0.153 / 4.0.88 · 2026-10 | Only if the official SDK lacks something. |
| Scrollytelling | `scrollama` | MIT | 3.2.0 · 2022 | Simple and stable. |
| Vector animation | `@lottiefiles/dotlottie-web` / `lottie-web` | MIT | 0.81.0 / 5.13.0 | Runtime is MIT; each animation file has its own license. |
| Interactive animation | `@rive-app/canvas` | MIT runtime | 2.47.1 · 2026-10 | Runtime MIT; assets licensed separately. |

## Avoid, or ask Jimmy first

- `typed.js` — **GPL-3.0 since v3** (checked 2026-10). Don't ship it; a typewriter effect is a few
  lines with Motion or CSS.
- `gsap` — free under GreenSock's "Standard no-charge license", not an OSI license. Allowed only if
  Jimmy OKs it; Motion covers our needs.
- Community demos without a LICENSE file (common for viral single-file HTML demos): **inspiration
  only**. No license means all rights reserved; don't copy code.
- Any asset (3D model, image, sound, font) without a clear CC0/CC-BY/OFL license.

## Assets

- 3D models: Kenney (CC0), Quaternius (CC0); Poly Pizza only for items marked CC0 or CC-BY (credit).
- Fonts: from `@fontsource` packages (OFL); self-hosted.
- Photos: Jimmy's own. Photos of other people only with their consent.
- Puppet character: original, drawn or modeled for this site.
