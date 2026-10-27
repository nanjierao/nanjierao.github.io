---
title: 'Grounding: checking what models assert about people'
context: personal
order: 2
summary: A unit-level check of every claim a model makes about a student — is it grounded in the student’s own material, or inferred?
facts: ['5.2']
publications: [icalt-2026-interest-extraction]
builds: [interest-extraction-pipeline]
---

When a model says something about a student, I check every claim, one unit at a time: is it
**grounded** in the student’s own material, or **inferred**?

## What the check found

- **Study 2 extractor.** The 384 explanations the LLM wrote contained 1,130 units: 625 grounded
  and 505 (44.7%) inferred. Only grounded units count toward Depth and Richness in my
  [interest-identification work](/research/interest-identification/).
- **Study 1 tutor** (dissertation Appendix E). Of the 57 units the tutor asserted about
  participants’ interests, 34 (59.6%) were inferred and 23 (40.4%) were grounded in something
  the participant had said.

## What “inferred” means

“Inferred” means the student’s material doesn’t show it, not that it is false: an inferred claim
may still be true. The check compares claims with what the student provided; it does not test
truth.

## The same convention on this site

The legend at the bottom of every page uses the same idea: a solid underline for something shown
in the source, a dotted underline for an inference. The planned Ask and Life & You pages will mark
their claims this way.
