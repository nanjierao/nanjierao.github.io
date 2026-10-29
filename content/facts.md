# facts.md — source of truth for site content

Compiled 24 Oct 2026 from Jimmy's CVs (Sept–Oct 2026), his research statement (Sept 2026),
his Google Scholar profile, and the old site (cise.ufl.edu/~nr0); updated the same night with
status-line options (§2), TL;DR drafts (§6), "hardest bug" notes (§7), and §16; updated 27 Oct
for the public repository (site URL, DTRUE coauthor, general wording). This repository is
public: everything here is public too. Anything not in this file
is unknown: write `TODO(jimmy): …` instead of guessing. Lines marked **VERIFY** must be
checked by Jimmy against the final dissertation before they appear on the site.

---

## 1. Identity

- Display name: **Nanjie (Jimmy) Rao**
- Scholarly name (matches Google Scholar and papers): **Nanjie Rao** (one 2020 CHI paper lists "N. J. Rao")
- Chinese name (for the future /zh pages): 饶楠杰
- Pronouns: he/him
- Location (public, city level only): Gainesville, Florida
- Public contact: `TODO(jimmy)`: pick the one email address the site shows (intro strip, /about).
  Don't reuse the old site's mailto link; it pointed to someone else.
- Website: https://nanjierao.github.io (repository `nanjierao/nanjierao.github.io`, owned by the
  GitHub organization `nanjierao`).

## 2. Current status (keep exactly this until Jimmy updates it)

- Ph.D. candidate, Human-Centered Computing, University of Florida (Dept. of Computer &
  Information Science & Engineering, Herbert Wertheim College of Engineering)
- Embodied Learning & Experience (ELX) Lab, advised by Dr. Sharon Lynn Chu
- Oral defense passed October 2026; Ph.D. to be conferred **December 2026**
- Don't mention job-search news until this section says so.

Status line for the intro strip — DRAFT options; none ships until Jimmy picks one and moves it
above this note:
1. "Open to postdoctoral and research roles in HCI and AI for learning, in academia and industry."
2. "Open to research, teaching, and learning-technology roles in academia and industry."
3. (outside review) "Open to Postdoctoral, Research Scientist, and Faculty opportunities."
Whatever he picks: roles and fields only; no locations, dates, or employer names.

## 3. Positioning — drafts for Jimmy to choose (DRAFT)

1. "I study what AI systems can know about a person — by asking, or by reading the records
   people already produce — how well grounded those inferences are, and what they cost in privacy."
2. "Where should an AI's knowledge of you come from, and how would anyone check it?"
3. Industry-facing: "HCI researcher and builder: LLM pipelines, sensing, and XR systems,
   evaluated like measurement instruments."
4. Dissertation-aligned: "An AI tutor teaches from what reaches it about a student. I study where
   that information should come from — asking, teaching, or the records students already produce."
5. (outside review, reworded) "I study where an AI tutor should get what it knows about a
   student's interests — asking, or the records students already produce — and check how much of
   what models then say is grounded in the student's own data."

Short bio (≈50 words, DRAFT):
> Nanjie (Jimmy) Rao is a human-computer interaction researcher at the University of Florida.
> He studies what AI systems can learn about people from what they say and what they do, how
> well grounded those inferences are, and what they cost in privacy. He receives his Ph.D. in
> Human-Centered Computing in December 2026.

Long bio (≈150 words, DRAFT):
> Nanjie (Jimmy) Rao is a human-computer interaction researcher who builds and evaluates AI
> systems that adapt to people. His dissertation at the University of Florida compares where an
> AI tutor's knowledge of a student should come from — asking the student, or reading records the
> student already produces, such as browsing history and social-media posts — and audits how much
> of what the models then say about students is actually supported by the students' own data.
> He applies the same methods to civic AI, with a crowd-sourced urban digital twin for hurricane
> flooding in Jacksonville. Before HCI he trained in electrical engineering, and he still builds
> hardware: a sensor-tracked puppet storytelling system for classrooms, AR smart-glasses apps, and
> the on-site build of a humanoid telepresence robot that reached the ANA Avatar XPRIZE
> semifinals. At UF he leads data-structures discussion sections and has co-taught graduate HCI.

## 4. Education

- Ph.D., Human-Centered Computing — University of Florida, Aug 2018 – Dec 2026.
  Dissertation: *Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based
  Automated Identification of Students' Personal Interests.* Committee: Sharon Lynn Chu (chair),
  Juan E. Gilbert, Lisa Anthony, Pavlo Antonenko.
- Doctoral coursework, Electrical Engineering — Texas A&M University, Jan 2017 – May 2018
- Doctoral coursework, Electrical Engineering — University of Houston, Aug 2016 – Dec 2016
- B.S., Optical and Electrical Information Engineering — Huazhong University of Science and
  Technology (HUST), China, Sep 2012 – Jun 2016. Summa Cum Laude (**VERIFY** source of this
  honor). Outstanding Thesis Award (top 1% of undergraduates): *Humanoid Robot Behavior Imitation
  System* (Kinect-based human action recognition driving a humanoid robot over Wi-Fi).
  Note: the official degree name on the HUST diploma is "Bachelor of Engineering, Optoelectronic
  Information Engineering" — **VERIFY** which wording Jimmy wants on the site.

## 5. Research themes (with verified numbers)

Research overview grouping (D27, D45):
- Three contexts (decided): **Personal** (§5.1 interest identification, §5.2 grounding, §5.5
  teacher support, §5.6 explanation and recommendation) · **Embodied** (§5.4 hand enactment,
  puppets, AR glasses; the XPRIZE robot in §7) · **Civic** (§5.3 civic digital twins).
- Umbrella line — DRAFT, Jimmy picks. Default, from his Sept 2026 research statement: an AI system
  that adapts to a person must first know something about them, by asking or by reading records
  the person already produced; his research asks which to rely on, how accurate and well grounded
  the result is, and what it costs in privacy. Alternative from the outside review: "Grounding AI
  in Authentic Human Contexts" ("grounded" is also a technical term in §5.2, so the two senses
  could blur).

### 5.1 Dissertation: where should an AI tutor's knowledge of a student's interests come from?
Source: final dissertation (Dec 2026, "RDoc_UseThis" version, 227 pp.). Use these numbers;
they supersede the CVs and the research statement wherever they differ.

- Question (as the abstract puts it): "From what should student interests be identified?"
  Interest-based learning (IBL) connects instruction to topics each student cares about; LLM
  tutors could scale it if they identified interests automatically and effectively.
- Framework: identification effectiveness has four constructs — **Accuracy**, **Depth**
  (information beyond an interest's name), **Richness** (kinds of information), and interest
  development **Phase**. Core idea: a tutor teaches not from the interest itself but from the
  information about it that reaches the tutor.
- Instrument: the interest-information coding scheme — 28 codes in four categories
  (**affect**, **function**, **knowledge**, **engagement**) — and its unit, the **interest
  information unit (IIU)**: one distinct fact stated about an interest beyond its name.
  Depth = number of units; Richness = number of categories covered.
- Study 1 (asking): existing transcripts of **35** college students tutored by an interest-based
  LLM tutor (Dr. Abhishek Kulkarni's dataset).
  - Every participant named an interest. The reply to the tutor's opening question had a mean of
    **2.5** units, and **29%** of participants said nothing beyond the interest's name.
  - Knowledge of the interest's domain was **10%** of the units in that reply (9 of 86) but
    **88%** of the units participants added later, while using the interest during teaching
    (29 of 33, from 14 participants).
  - 12 of the 35 participants' disclosures placed the interest in an individual (later) phase.
    Evidence of a later, individual phase also correlated with perceived usefulness.
  - More disclosure went with higher perceived usefulness of the interest-based session
    (**r = .34**; 0.11 points per unit on a seven-point scale, adjusted), but not significantly
    with motivation, relatedness, or quiz scores.
  - Coding reliability: two coders; on 25 double-coded transcripts they agreed on **90.7%** of
    700 code-by-transcript decisions; code-level **Cohen's κ = .51**; 65 case-level disagreements
    resolved under written rules.
- Study 2 (reading records; IEEE ICALT 2026): within-subjects; **77** initial participants,
  **32** retained after data-quality screening. An LLM extracted interests, with explanations,
  from each student's samples of browsing history and social-media posts; students confirmed or
  rejected each.
  - Browsing history had higher precision: **69.8%** confirmed vs. **56.3%** for posts
    (round to 70% / 56% only where space is tight), and overlapped more with self-report
    (Jaccard .44 vs. .24).
  - Posts' explanations carried more grounded information per confirmed interest
    (**2.14 vs. 1.58** grounded units, p = .023) and placed a smaller share of interests in the
    early, situational phases.
  - The two sources overlapped only partly (Jaccard .31). Together they added confirmed interests
    missing from the self-report form: **38.2%** of each participant's validated interests on
    average; 54% of those missing interests were in the two situational phases.
  - Privacy protocol: participant self-curation, sensitive-content filtering, non-retention.
    Supported by NSF CAREER #1942937.
- Takeaways (the dissertation's own wording, OK to quote): "Browsing history suits finding the
  right interest, posts suit learning about it, and both suit covering more interests."
  "Asking gives the interest in the student's own words, teaching draws out what the student
  knows about it, and data sources, used with consent, add interests the student did not name."
- Reusable materials published in the appendices: the coding scheme with worked examples and
  rules, the survey instrument, and the extraction prompts with synthetic examples.
  (`TODO(jimmy)`: GitHub URL for the prompts, and a UF Digital Collections link once the
  dissertation is released.)
- Manuscript: two-study synthesis in preparation (target ACM CHI).
- Retired framing — do not use: "decision matrix", "18% name-only", "self-report missed 38%".

### 5.2 Grounding: checking what models assert about people
- Unit-level check of every claim a model made about a student: is it **grounded** in the
  student's own material, or **inferred**?
- Study 2 extractor: the 384 explanations contained **1,130** units — 625 grounded and
  **505 (44.7%) inferred**. Only grounded units count toward Depth and Richness.
- Study 1 tutor (Appendix E): of the **57** units the tutor asserted about participants' interests,
  **34 (59.6%) were inferred** and 23 (40.4%) grounded in something the participant had said.
- Required caveat wherever these numbers appear: "inferred" means the student's material doesn't
  show it, not that it is false — an inferred claim may still be true. The check compares claims
  with what the student provided; it does not test truth.

### 5.3 Civic AI: crowd-sourced urban digital twins (DTRUE 2026, with Jatin Verma)
- Authorship: Jimmy added his teammate Jatin Verma as coauthor after confirming with the
  organizers. **VERIFY** the author order, spelling, and title against the v2 extended abstract.
  Don't call this work sole-authored anywhere.
- *Sense–Engage–Govern*: design framework for gamified, LLM-assisted crowd-sourced urban digital
  twins — three tiers, six dimensions, each a spectrum with a named tension (contribution mode,
  twin coupling, incentive substrate, verification locus, temporal regime, access threshold),
  plus a privacy boundary. Grounded in value-sensitive design, contextual integrity,
  self-determination theory.
- CS-UDT prototype for Jacksonville hurricane flooding: zero-install browser client; LLM
  pipeline parsing citizen reports and social posts into hazard events; three-channel
  convergence rule (official sensor anomaly + citizen report + social post in the same map cell);
  when two agree, nearby residents get a one-tap verification quest.
- Simulated replay modeled on Hurricane Irma (Sep 10–12, 2017): first three-channel
  confirmation **10.8 hours** into a 30-hour replay; at the storm's peak, four confirmed cells
  and three open quests. Everything in the demo is labeled SIMULATED.
- Extended abstract accepted for an oral presentation at DTRUE 2026 (UF Jacksonville campus,
  **Nov 19–20, 2026**); full paper to appear in EPiC Series in Technology.
- Live demo files: `public/demos/csudt/csudt_dashboard.html` (planner view) and
  `csudt_mobile.html` (citizen client). Background: `source/csudt/README.md`.

### 5.4 Embodied and creative learning
- Hands as Narrators (ICIDS 2026, full paper): remote web platform logging every video-scrub
  and keystroke with a WebGazer.js gaze stream; two-part study, **N = 24**; returning to recorded
  hand enactments took about a quarter of writing time; four strategies, five behaviorally
  inferred reasons; design implications for authoring tools.
- Flexible low-cost digital puppet system (NSF *To Enact, To Tell, To Write*; HCII 2021).
- Interactive emotional priming and storytelling (ICIDS 2019).
- Self-avatars and story-relevant avatars in children's creative storytelling (ACM CHI 2020,
  co-author).
- AR smart glasses for everyday learning (IEEE VR 2020): Latin-square within-subjects study,
  **N = 25**; speech-triggered display produced better learning and task scores;
  object-anchored display produced higher immersion and usability.

### 5.5 Teacher support technologies
- Survey of **81** studies on teacher autonomy vs. automation (An & Holstein's TA framework,
  automation levels, Norman's action cycle); update covering 2021–2026 generative-AI systems in
  preparation for IEEE Transactions on Learning Technologies.
- Teacher-facing papers: ICALT 2021 (Best Short Paper Nomination), HCII 2022, ICALT 2023.

### 5.6 Explanation and recommendation
- Explanation types and user motivations in recommender systems (AAAI HCOMP 2020, co-author).
- Everyday-inspired movie recommendation from personal social media (IFIP INTERACT 2023, co-author).

## 6. Publications (12 peer-reviewed; * = first author)

Do not hard-code citation counts or h-index on the site (they go stale) — link to Google Scholar.
DOIs/URLs: `TODO` — get them from a Google Scholar BibTeX export.

Refereed conference papers
1. *Rao, N., Lanzino, A., Chenore, R., Adhikari, I., Brown, S. A., Quek, F., & Chu, S. L. (2026).
   Hands as Narrators: Characterizing Idea Reuptake from Hand Enactment in Story Writing. ICIDS
   2026, Springer. Full paper, accepted.
2. *Rao, N., Huang, Z., Kulkarni, A., Ragan, E., & Chu, S. L. (2026). Identifying Student
   Interests for Interest-Based Learning: A Comparison of Interest Extraction from Browsing
   History and Social Media Posts. IEEE ICALT 2026. Full paper.
3. Kulkarni, A., Powell, L., Murphy, S., Rao, N., & Chu, S. L. (2023). Everyday-Inspired Movies:
   Towards the Design of Movie Recommender Systems Based on Everyday Life through Personal Social
   Media. IFIP INTERACT 2023, Springer, pp. 160–169.
4. *Rao, N., Li, Q., Murphy, S., & Chu, S. L. (2023). The Context for Contextualizing: Design
   Implications for Adaptive Teacher Support Systems for More Relevant Instruction. IEEE ICALT
   2023, pp. 71–73.
5. *Rao, N., & Chu, S. L. (2021). Enhancing the Visual Efficiency for Communicating Students'
   Personal Relevant Information. IEEE ICALT 2021. Best Short Paper Nomination.
6. *Rao, N., Chu, S. L., & Chenore, R. (2021). Flexible Low-Cost Digital Puppet System. HCI
   International (HCII 2021), Springer LNCS.
7. Li, Q., Chu, S. L., Rao, N., & Nourani, M. (2020). Understanding the Effects of Explanation
   Types and User Motivations on Recommender System Use. AAAI HCOMP 2020.
8. Zarei, N., Chu, S. L., Quek, F., Rao, N. J., & Brown, S. A. (2020). Investigating the Effects
   of Self-Avatars and Story-Relevant Avatars on Children's Creative Storytelling. ACM CHI 2020.
9. *Rao, N., Chu, S. L., Faris, R. W., & Ospina, D. (2019). The Effects of Interactive Emotional
   Priming on Storytelling: An Exploratory Study. ICIDS 2019, Springer, pp. 395–404.

Extended abstracts, posters, workshop papers
10. *Rao, N., & Verma, J. (2026). A Design Framework for Gamified, LLM-Assisted Crowd-Sourced
    Urban Digital Twins. DTRUE 2026, UF Jacksonville Campus. Oral presentation; full paper to
    appear in EPiC Series in Technology. **VERIFY** authors and title against the v2 extended
    abstract.
11. *Rao, N., Chu, S. L., Jing, Z., Kuang, H., Tang, Y., & Dong, Z. (2022). Exploring Information
    Retrieval for Personalized Teaching Support. HCI International 2022 — Late Breaking Posters,
    Springer, pp. 191–197.
12. *Rao, N., Zhang, L., Chu, S. L., Jurczyk, K., Candelora, C., Su, S., & Kozlin, C. (2020).
    Investigating the Necessity of Meaningful Context Anchoring in Augmented Reality Smart Glasses
    Interaction for Everyday Learning. IEEE VR 2020, workshop paper and poster.

TL;DR lines for first-author papers (D28) — DRAFT; each stays hidden until Jimmy removes "DRAFT":
- [1] DRAFT: Writers who first acted out story ideas with their hands went back to those
  recordings for about a quarter of their writing time; the paper maps four strategies and five
  reasons for doing so.
- [2] DRAFT: Browsing history found the right interests more often (69.8% vs. 56.3% confirmed);
  social-media posts said more about each one.
- [4] `TODO(jimmy)`: one sentence.
- [5] `TODO(jimmy)`: one sentence.
- [6] DRAFT: A low-cost puppet storytelling system: 3D-printed puppets tracked by a YOLO detector
  and IMUs, animated live in Unity.
- [9] `TODO(jimmy)`: one sentence.
- [10] DRAFT: A design framework for crowd-sourced urban digital twins, and a flood prototype that
  confirms an event only when a sensor, a resident, and a social post agree.
- [11] `TODO(jimmy)`: one sentence.
- [12] DRAFT: On AR smart glasses, showing information when the learner asked for it led to better
  learning and task scores; showing it when the camera recognized an object felt more immersive
  and usable.

In preparation (list only if Jimmy approves — D28 "Working papers")
- *Rao, N., et al. Two-study synthesis of the dissertation. Target: ACM CHI.
- *Rao, N. Teacher autonomy and automation in teacher-support technologies: a survey of 81
  studies, updated for 2021–2026 generative-AI systems. Target: IEEE TLT.

Optional (on Google Scholar, omitted from recent CVs — ask Jimmy): 饶正寿, 饶楠杰, 孙晖, 翁雨雄
(2019). 人工智能改变医院管理之探讨. 中国数字医学 14(1), 24–25.

## 7. Builds (projects page; "datasheet" facts)

| Build | When | Facts | Media |
|---|---|---|---|
| CS-UDT flood digital twin (live demo) | 2026 | See 5.3 | demo files; `TODO` screenshots |
| LLM interest-extraction pipeline | ICALT 2026 study | Qualtrics front end, JavaScript backend, OpenAI API, five-step extraction prompt, no cross-call retention; used by 77 participants | `TODO` diagram |
| Gaze + interaction-log study platform | ICIDS 2026 study (`TODO` build year) | WebGazer.js gaze stream synchronized with time-stamped scrubbing and keystrokes; each inferred episode anchored to a logged event to offset webcam gaze noise; N = 24 | `TODO` |
| Academic revision checklist (open source, github.com/JimmyRaoUF/academic-revision-checklist) | Oct 2026 (v1.0.0 published Oct 29, 2026) | A revision checklist for academic English, written for a first-time reader: 66 rules (each with a sentence from the dissertation before and after the fix, and how to check for it), a 16-item quick list, the method "one case, one rule, the whole document" (fix the sentence where a reader stopped, write the fix as a rule that can be checked, then check the whole document for it), reading protocols, and a script that lists candidates for the mechanical checks (Python 3, no other packages; reads .tex, .md and .txt). The rules come from five weeks and more than 60 revision rounds of his English-language HCI dissertation; each began as one sentence where a reader stopped. In his own revision the script's abbreviation check flagged 13 places, of which 3 were real problems. "Reads like AI" there means the places where a first-time reader stops or reads twice; it is not a tool for getting past AI detectors. Use: as a checklist, as a Claude Code skill, or pasted into another AI assistant. Rules written in Chinese with English example sentences; SKILL.md in English. Text CC BY 4.0, scripts MIT. First posted in a Zhihu answer. Source: the repository README, v1.0.0 | `TODO` screenshots |
| Unity puppet storytelling system (NSF) | 2018–21 | 3D-printed puppets animated in Unity in real time; position from a YOLO detector trained on 148 labeled images; rotation from BBC micro:bit and Aimxy IMUs over Bluetooth; Python bridge into Unity over UDP and shared memory; perception study with 23 MTurk workers; supported on site with elementary-school teachers | YouTube `OX2zRUeDojg`; old-site images `PuppetSystemcomp1.jpg`, `Enactment1.png`, `enactment.png`, `p2cap.jpg` |
| AR smart-glasses apps | IEEE VR 2020 | Two Android apps for Vuzix Blade: display on object detection (real-time color detection) vs. on spoken request; N = 25; 92.9% inter-rater agreement on task performance | YouTube `9AHrOjfYdMc`; `ObjectInter.jpg` |
| CTE activity recognition for bench electronics | `TODO` | Breadboarding and soldering recorded with Tobii Pro Glasses 3 (first-person video + gaze) and a GoPro; GPT-4o vision stage (frame extraction, prompt design, activity summaries); compared GPT-4o vs. GPT-4 task identification and API cost; revived the project's React/TypeScript + Node/Flask + Docker Compose dashboard; built with two student researchers | `TODO` |
| Humanoid telepresence robot — ANA Avatar XPRIZE | Sept 2021 | On-site leader of four-person Team Limitless; 300+ lb humanoid telepresence robot (NVIDIA Jetson) with motion-capture teleoperation; 37 teams from 15 countries; semifinalist; re-scoped the system overnight after the power converter failed | YouTube `u9nYUBc-_s0` (XPRIZE channel; start at 74 s) |
| Humanoid robot behavior imitation (B.S. thesis) | 2016 | Kinect-based human action recognition driving a humanoid robot over Wi-Fi; Outstanding Thesis Award (top 1%) | `TODO` |
| Wearable baby thermometer (Galaxy Studio) | 2012–16 | Designed and iterated; later commercialized and sold in the U.S. | `TODO` |
| IoT Curiosity Detector for Connected Learning | `TODO` | `TODO(jimmy): one-paragraph description` | YouTube `zzlthBSD1ns` |
| Engagement dashboards — The Teaching Lab (internship) | 2022 | Two interactive dashboards of student-engagement data for program directors; centralized web grading system | `TODO` |

Other videos from the old site (ask Jimmy what they are before using):
`bxRCMLH5a6I` "Presentation for AI Viz", `ONgrs1e2UUo` "updatedcnc".

"Hardest bug & fix" (D29; optional field on each build page):
- Humanoid telepresence robot (XPRIZE): the power converter failed the night before testing; he
  disconnected the drive train, ran on a borrowed lower-rated unit, and kept the scored
  manipulation task.
- Every other build: `TODO(jimmy)` — one or two sentences, or leave the field out.

## 8. Teaching

- Teaching Assistant, UF CISE, Aug 2018 – present
  - COP 3530 Data Structures & Algorithms (Fall 2026): leads weekly discussion sections for about
    150 students; office hours in person and on Zoom at the same time. (About 150 in total across
    sections — don't write "a room of 150".)
  - CIS 4360 Computer & Information Security (Spring 2026): grading cycles; built a Canvas API
    gradebook workflow.
  - Co-taught graduate CAP 5100 Human-Computer Interaction and CAP 5108 Research Methods:
    lectures, office hours, rubric design, course-development feedback to faculty.
  - Taught programming class sessions; one-on-one tutoring in office hours.
- English teacher (part-time), after-school program, during the B.S.: a class of six
  elementary-school students for a year and a half.
- Tutor in English, mathematics, and science for elementary, middle, and high school students
  (2012–2016).
- Teaching interests: programming and data structures; HCI and human-centered design; research
  methods; prototyping and physical computing (Arduino, 3D printing, Fusion 360); AI literacy and
  checking what AI tools assert.

## 9. Mentoring and leadership

- ELX Lab: onboarded and mentored graduate and undergraduate research assistants in qualitative
  coding, inter-rater reliability, mixed-methods design, and documentation.
- Founder & team lead, Galaxy Studio (HUST, 2012–2016): student hardware/software studio;
  8 national and 21 university-level awards; PI on a national-grant undergraduate project.

## 10. Honors

- CISE Gartner Group Graduate Fellowship, four times (2021–2024)
- Best Short Paper Nomination, IEEE ICALT 2021
- Semifinalist, ANA Avatar XPRIZE (2021)
- Outstanding Thesis Award (top 1%), HUST 2016

## 11. Talks

- First-author presentations: IEEE ICALT (2021, 2023, 2026), ICIDS (2019), HCI International
  (2021, 2022), IEEE VR (2020).
- Upcoming: DTRUE 2026 oral presentation, UF Jacksonville campus, Nov 19–20, 2026;
  ICIDS 2026 (`TODO` date and location).

## 12. Skills (for CV page and the assistant's knowledge pack)

- XR, sensing, teleoperation: Unity 3D (C#) with external tracking input via a Python bridge;
  AR smart-glasses apps (Vuzix Blade, Android); YOLO; IMUs (micro:bit, Aimxy); Leap Motion;
  Kinect; motion-capture teleoperation (NVIDIA Jetson); Tobii Pro Glasses 3; WebGazer.js.
- AI/ML: PyTorch, TensorFlow, scikit-learn, OpenCV; LLM pipelines (OpenAI, Claude, Gemini) with
  structured outputs, retrieval, tool use; sentence-transformer embeddings; grounding audits.
- Data & study design: Python (pandas, statsmodels), R, SQL; GEE, multilevel models, ANCOVA,
  bootstrap/jackknife, Holm and Benjamini–Hochberg control; inter-rater reliability; MAXQDA,
  Taguette; Qualtrics, MTurk; IRB protocols.
- Software & hardware: TypeScript/JavaScript (React), Node.js, Flask, Java/Android, C/C++, C#;
  Docker Compose, Git; microcontrollers (TI, micro:bit, Jetson), PCB CAD, FPGA, soldering,
  3D printing.
- Not a skill to list: SAS.

## 13. Links

- Google Scholar: https://scholar.google.com/citations?user=EBetHqQAAAAJ
- ELX Lab: https://elxlab.cise.ufl.edu/
- Advisor: https://www.cise.ufl.edu/~slchu/
- GitHub (personal account; activity and repos come from here): https://github.com/JimmyRaoUF
- Website (GitHub organization `nanjierao`): https://nanjierao.github.io
- YouTube: "Dr. Lucky Dad - Research and Engineer the Dad Life", https://www.youtube.com/@drluckydadredl
  (channel ID UCsaBHMWGQFx1Mltl3nFQc3g; English short videos that test common parenting advice
  against real home life)
- Zhihu: https://www.zhihu.com/people/daozhu (his Chinese writing; blog posts link back here)
- LinkedIn: `TODO(jimmy)` · ORCID: `TODO(jimmy)` (create one if none)
- Old site (to be replaced by a redirect stub): https://www.cise.ufl.edu/~nr0/

## 14. Personal (About page, optional)

- Go (weiqi): certified rank-2 master; ballroom dancing; soccer and its esports games.

## 15. Never publish (also excluded from the AI assistant's knowledge pack)

- Personal contact details beyond the one public email: phone number, home or street address
- Grades (GPA)
- Immigration or work-authorization matters
- Family members, health, compensation
- Job-search activity (applications, interviews, offers) and references' contact details
- Location or availability constraints
- Study participant data, raw datasets, transcripts, participant quotations, reviewer comments,
  unpublished numbers not in this file
- Exact citation counts (link to Scholar instead)
- Photo metadata (EXIF/GPS) and photos of family members or children (D31)
- Application materials and private documents (they stay in Jimmy's local folders, never in this
  repository)

## 16. Claims from outside reviews — not verified; don't use until Jimmy confirms

From the Gemini Argon review (Oct 24, 2026). Move a line into the right section above once Jimmy
confirms it; delete it if he says it's wrong.
- TA work in CAP 5771, CIS 4362, and CIS 4930 (the CVs list COP 3530, CIS 4360, CAP 5100, CAP 5108).
- Go (the programming language) as a working language (§12 lists C/C++, not Go).
- A Wear OS (Galaxy Watch) app for passive sensing.
- Journal targets ACM TOCHI or IJHCS for the dissertation synthesis (§5.1 says ACM CHI).
- Grice's maxims and the Johari window as foundations of the dissertation (the final dissertation
  cites neither). Goffman's model is explicitly not adopted (dissertation Ch. 2).
- Personal details used in the drafted reflections (home repairs, an older V6 car, kayaking,
  cooking braised pork and taro balls, following a football club, dumbbell training): fine once
  Jimmy approves the reflection that mentions them.
