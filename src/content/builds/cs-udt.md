---
title: CS-UDT flood digital twin
when: '2026'
order: 1
summary: A crowd-sourced urban digital twin for hurricane flooding in Jacksonville, with a zero-install citizen client and a planner dashboard. The demo runs on simulated data.
datasheet:
  - { label: Client, value: 'Zero-install browser client' }
  - { label: Pipeline, value: 'LLM parsing of citizen reports and social posts into hazard events' }
  - { label: Verification, value: 'Three-channel convergence rule: official sensor anomaly + citizen report + social post in the same map cell' }
  - { label: Engagement, value: 'When two channels agree, nearby residents get a one-tap verification quest' }
  - { label: Replay, value: 'Simulated replay modeled on Hurricane Irma (Sep 10–12, 2017): first three-channel confirmation 10.8 hours into a 30-hour replay; four confirmed cells and three open quests at the peak' }
  - { label: Data, value: 'Simulated replay and synthetic community content' }
  - { label: Paper, value: 'Coauthored extended abstract, DTRUE 2026 (oral presentation)' }
tags: [LLM pipeline, digital twin, web]
areas: [ai, web]
links:
  - { label: Open the demo, href: /demos/csudt/ }
themes: [civic-digital-twins]
facts: ['5.3', '7']
# Coauthored (D46): name the coauthor here once facts.md §6 [10] is verified. TODO(jimmy)
# TODO(jimmy): screenshots of the demo (facts.md §7 media); S4 adds the explainer and preview image.
---
