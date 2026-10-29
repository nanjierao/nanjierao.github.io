---
title: Academic revision checklist
when: Oct 2026
order: 4
summary: An open checklist for revising academic English for a first-time reader, drawn from five weeks and more than 60 revision rounds of my dissertation. It also installs as a Claude Code skill.
datasheet:
  - { label: Contents, value: '66 rules, a 16-item quick list, reading protocols, and a script' }
  - { label: Method, value: 'One case, one rule, the whole document: fix the sentence where a reader stopped, write the fix as a rule that can be checked, then check the whole document for it' }
  - { label: Source, value: 'Five weeks and more than 60 revision rounds of my English-language HCI dissertation; each rule began as one sentence where a reader stopped' }
  - { label: Script, value: 'Python 3, no other packages; lists candidates for the mechanical checks in .tex, .md and .txt files, and reading decides' }
  - { label: Reading decides, value: 'When I revised my dissertation, an abbreviation check flagged 13 places, of which 3 were real problems' }
  - { label: Use, value: 'As a checklist, as a Claude Code skill, or pasted into another AI assistant' }
  - { label: Scope, value: '“Reads like AI” here means the places where a first-time reader stops or reads twice. It is not a tool for getting past AI detectors' }
  - { label: Language, value: 'Rules in Chinese with English example sentences; the skill file in English' }
  - { label: License, value: 'Text CC BY 4.0, scripts MIT' }
tags: [academic writing, Claude Code skill, Python, open source]
areas: [ai]
links:
  - { label: The repository on GitHub, href: 'https://github.com/JimmyRaoUF/academic-revision-checklist' }
facts: ['7']
# TODO(jimmy): a screenshot or two (facts.md §7 media), and the Zhihu answer it first appeared in,
# if you want it on the blog (/post-zhihu).
---

## The 16-item quick list

From the repository (CC BY 4.0). Ask each question after revising a paragraph.

1. Would a first-time reader stop at this sentence? If they would read it twice, write down why.
2. Report one result per sentence.
3. If you write “more” or “higher”, say than what.
4. Use “significant” only for a difference, an association or a test, never for a share or a mean.
5. Does “this”, “these”, “the former” or “the name” point to something within the previous sentence?
6. Use one name for one thing, and keep ordinary words from colliding with your defined terms.
7. Use a colon only to introduce a list, a quotation, a question or a definition.
8. Use few “not A but B” set-ups, and keep the negations that carry content.
9. Use no em dashes to join clauses in the body text.
10. When several sentences in a row have nearly the same length or the same opening, change one.
11. Delete hollow transitions and paragraph endings that only summarize. If one cannot go, replace it with something specific.
12. Use the words you and your field would use, and prefer the common word.
13. Write about the research, not about how the text was revised.
14. Keep research questions, quotations, numbers and your own reflections away from AI editing.
15. After a change, reread that paragraph and the one before it, and rerun hard limits such as word caps and paragraph length.
16. Check comments from people and from AI against the text and the data, and apply only what holds.

The full 66 rules are in the repository, most with a sentence from the dissertation before and after the fix and a way to check for it.
