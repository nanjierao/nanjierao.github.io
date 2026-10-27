---
title: Where should an AI tutor’s knowledge of a student’s interests come from?
context: personal
order: 1
summary: My dissertation compares asking students with reading the records they already produce, and measures what each gives an AI tutor to teach from.
facts: ['5.1', '4']
publications: [icalt-2026-interest-extraction]
builds: [interest-extraction-pipeline]
# TODO(jimmy): GitHub URL for the extraction prompts, and the UF Digital Collections link once
# the dissertation is released (facts.md §5.1). The two-study synthesis (target ACM CHI) is listed
# only if you approve working papers (D28).
---

Interest-based learning connects instruction to topics each student cares about. Large language
model (LLM) tutors could scale it if they identified students’ interests automatically and
effectively. My dissertation asks, as its abstract puts it: “From what should student interests
be identified?”

## A tutor teaches from what reaches it

The core idea is that a tutor teaches not from the interest itself but from the information
about it that reaches the tutor. I judge identification on four constructs:

- **Accuracy**
- **Depth**: information beyond an interest’s name
- **Richness**: kinds of information
- **Phase**: where the interest is in its development

To measure Depth and Richness, I built the interest-information coding scheme: 28 codes in four
categories (affect, function, knowledge and engagement). Its unit is the **interest information
unit (IIU)**, one distinct fact stated about an interest beyond its name. Depth is the number of
units; Richness is the number of categories covered.

## Study 1: asking

I analyzed existing transcripts of 35 college students tutored by an interest-based LLM tutor
(Dr. Abhishek Kulkarni’s dataset).

- Every participant named an interest. The reply to the tutor’s opening question had a mean of
  2.5 units, and 29% of participants said nothing beyond the interest’s name.
- Knowledge of the interest’s domain was 10% of the units in that reply (9 of 86) but 88% of the
  units participants added later, while using the interest during teaching (29 of 33, from 14
  participants).
- The disclosures of 12 of the 35 participants placed the interest in an individual (later)
  phase. Evidence of a later, individual phase also correlated with perceived usefulness.
- More disclosure went with higher perceived usefulness of the interest-based session
  (r = .34; 0.11 points per unit on a seven-point scale, adjusted), but not significantly with
  motivation, relatedness, or quiz scores.
- Two coders double-coded 25 transcripts and agreed on 90.7% of 700 code-by-transcript
  decisions; code-level Cohen’s κ was .51, and 65 case-level disagreements were resolved under
  written rules.

## Study 2: reading records (IEEE ICALT 2026)

A within-subjects study: 77 initial participants, 32 retained after data-quality screening. An
LLM extracted interests, with explanations, from each student’s samples of browsing history and
social-media posts, and students confirmed or rejected each one.

- Browsing history had higher precision: students confirmed 69.8% of its interests, against
  56.3% for posts. It also overlapped more with what students reported themselves (Jaccard .44
  vs. .24).
- Explanations drawn from posts carried more grounded information per confirmed interest (2.14
  vs. 1.58 [grounded units](/research/grounding/), p = .023) and placed a smaller share of
  interests in the early, situational phases.
- The two sources overlapped only partly (Jaccard .31). Together they added confirmed interests
  that were missing from the self-report form: 38.2% of each participant’s validated interests
  on average. 54% of those missing interests were in the two situational phases.
- Privacy protocol: participants curated their own samples, sensitive content was filtered, and
  nothing was retained. The study was supported by NSF CAREER #1942937.

## What it adds up to

In the dissertation’s words: “Browsing history suits finding the right interest, posts suit
learning about it, and both suit covering more interests.” And: “Asking gives the interest in
the student’s own words, teaching draws out what the student knows about it, and data sources,
used with consent, add interests the student did not name.”

The appendices publish the materials for reuse: the coding scheme with worked examples and
rules, the survey instrument, and the extraction prompts with synthetic examples.

**Dissertation:** *Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based
Automated Identification of Students’ Personal Interests.* Ph.D. in Human-Centered Computing,
University of Florida. Committee: Sharon Lynn Chu (chair), Juan E. Gilbert, Lisa Anthony,
Pavlo Antonenko.
