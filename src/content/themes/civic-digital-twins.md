---
title: 'Civic AI: crowd-sourced urban digital twins'
context: civic
order: 3
summary: Our design framework for gamified, LLM-assisted crowd-sourced urban digital twins, and a flood prototype for Jacksonville that confirms an event when three channels agree.
facts: ['5.3']
publications: [dtrue-2026-csudt-framework]
builds: [cs-udt]
# This work is coauthored (D46). The author list, order and title stay off the site until Jimmy
# checks them against the v2 extended abstract (facts.md §5.3, §6 [10] VERIFY).
# TODO(jimmy): verify, then name the coauthor here.
# facts.md §5.3 says "Everything in the demo is labeled SIMULATED", but the demo labels its
# station locations and the phone's sensors as real; the page uses the narrower wording.
# TODO(jimmy): correct that sentence in facts.md §5.3.
---

Our design framework for crowd-sourced urban digital twins, and a prototype for hurricane flooding
in Jacksonville. This work is coauthored.

## Sense–Engage–Govern

A design framework for gamified, LLM-assisted crowd-sourced urban digital twins. It has three
tiers and six dimensions, each a spectrum with a named tension:

- contribution mode
- twin coupling
- incentive substrate
- verification locus
- temporal regime
- access threshold

plus a privacy boundary. The framework draws on value-sensitive design, contextual integrity, and
self-determination theory.

## CS-UDT: a flood prototype for Jacksonville

- A zero-install browser client, so residents can take part without an app.
- An LLM pipeline that parses citizen reports and social posts into hazard events.
- A three-channel convergence rule: an event is confirmed when an official sensor anomaly, a
  citizen report, and a social post fall in the same map cell.
- When two channels agree, nearby residents get a one-tap verification quest.

In a simulated replay modeled on Hurricane Irma (Sep 10–12, 2017), the first three-channel
confirmation came 10.8 hours into a 30-hour replay. At the storm’s peak there were four confirmed
cells and three open quests. The replay is simulated and all community content is synthetic.

[Open the CS-UDT demo](/demos/csudt/) (simulated data).

## Where it appears

- Oral presentation: DTRUE 2026, UF Jacksonville campus, Nov 19–20, 2026 (coauthored extended
  abstract).
- Full paper: EPiC Series in Technology (to appear).
