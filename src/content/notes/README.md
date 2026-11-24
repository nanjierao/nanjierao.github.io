# Daily notes

One file per day, added with the `add-note` skill (`.claude/skills/add-note/`; D71). The page is
`/notes/`. The footer links it on every page, and on the home page the first card in Recent shows
the newest note.

```
src/content/notes/<YYYY-MM-DD>.yaml   the file name is the note's date
```

```yaml
lines:
  - 'What I did today, in one short sentence.'
  - 'Something I learned, at work or outside it, with Jimmy''s apostrophe written twice.'
  - 'A third short sentence.'
```

- The sentences are Jimmy's words, as he sent them, one per line. No edits, translations or
  additions.
- Write every line in single quotes, with each apostrophe written twice (`'it''s'`), and copy
  everything else exactly, backslashes included. Single quotes read no escapes, so a `#`, a `: `
  or a `\` stays as he wrote it. `npm run format` switches a line to double quotes only where that
  keeps the text. A unit test fails on an unquoted line, on a double-quoted line with a backslash
  (where `\t` would turn into a tab), and on a line whose quote ended early.
- One to five lines of at most 300 characters each (`noteSchema` in `src/content/schemas.ts`).
- Chinese text is marked `lang="zh-CN"` on the page by itself: a whole line when it is all
  Chinese, otherwise each run of Chinese characters (`noteLine` in `src/lib/notes.ts`). The rest
  of a line reads as the page's English.
- Before anything is written here, every line is checked against facts.md §15 and CLAUDE.md
  content rules 12 and 13 (the class study). If one touches them, Jimmy is asked instead.
- `tests/unit/notes.test.ts` also refuses some patterns: a marker such as `TODO(`, a course or
  review-board number, an email address other than the public one, and, in a line about a study
  or a course, a head count or who joined. When it flags one of his lines, the note waits for
  Jimmy (add-note skill, step 5); a line he clears goes into `CLEARED_LINES` there, by
  fingerprint.
