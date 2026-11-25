# Daily notes

One file per day, added with the `add-note` skill (`.claude/skills/add-note/`; D71). The page is
`/notes/`. The footer links it on every page, and on the home page the first card in Recent shows
the newest note (an item with a bold lead by its lead alone, with a link to the full note).

```
src/content/notes/<YYYY-MM-DD>.yaml   the file name is the note's date
```

```yaml
lines:
  - 'What I did today, in one short sentence.'
  - '**Or a bold lead.** And a short paragraph after it, with Jimmy''s apostrophe written twice.'
  - 'A third short note.'
```

- The items are Jimmy's words, as he sent them, one per line: each item he numbers is one line,
  and the page numbers them again. No edits, translations or additions.
- Write every line in single quotes, with each apostrophe written twice (`'it''s'`), and copy
  everything else exactly, backslashes included. Single quotes read no escapes, so a `#`, a `: `
  or a `\` stays as he wrote it. `npm run format` switches a line to double quotes only where that
  keeps the text. A unit test fails on an unquoted line, on a double-quoted line with a backslash
  (where `\t` would turn into a tab), and on a line whose quote ended early.
- One to five items of at most 1,000 characters each (`noteSchema` in `src/content/schemas.ts`): a
  short sentence, or a bold lead written `**like this**` and a short paragraph. Bold is the only
  formatting and shows as bold on /notes/; a `**` without its partner fails the schema, so no
  asterisks reach the page.
- Chinese text is marked `lang="zh-CN"` on the page by itself (`noteLine` in
  `src/lib/notes.ts`): a whole line when it has Chinese characters and no Latin letters, its
  numbers and punctuation included; otherwise each run of Chinese characters, and the rest of
  the line reads as the page's English.
- Before anything is written here, every line is checked against facts.md §15 and CLAUDE.md
  content rules 12 and 13 (the class study). If one touches them, Jimmy is asked instead. So is
  a line with a course code that is not on /teaching, however it is written.
- `tests/unit/notes.test.ts` also refuses some patterns: a marker such as `TODO(`, a course or
  review-board number, an email address other than the public one, and, in a line about a study
  or a course, a head count, who joined or a name with a title. A course code in lower case with
  a space (`abc 1234`) counts only in a line about a study or a course, or with a word such as
  homework or lecture, since on every line that pattern would stop sentences like "Did 8000
  steps today." When the test flags one of his lines, the note waits for Jimmy (add-note skill,
  step 5); a line he clears goes into `CLEARED_LINES` there, by fingerprint, with a short reason
  the session writes, which the patterns check too.
