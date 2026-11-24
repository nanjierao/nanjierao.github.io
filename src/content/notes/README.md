# Daily notes

One file per day, added with the `add-note` skill (`.claude/skills/add-note/`; D71). The page is
`/notes/`, and the home page's Recent section shows the newest note.

```
src/content/notes/<YYYY-MM-DD>.yaml   the file name is the note's date
```

```yaml
lines:
  - 'What I did today, in one short sentence.'
  - 'Something I learned, at work or outside it.'
  - 'A third short sentence.'
```

- The sentences are Jimmy's words, as he sent them, one per line. No edits, translations or
  additions.
- Quote every line, so that a `#` or a `: ` inside a sentence can't change what YAML reads.
  `npm run format` then picks single or double quotes for each line, whichever needs no escape
  (a line with an apostrophe gets double quotes). A unit test fails on an unquoted line.
- One to five lines of at most 300 characters each (`noteSchema` in `src/content/schemas.ts`).
- A line in Chinese gets `lang="zh-CN"` on the page by itself.
- Before publishing, check every line against facts.md §15 and CLAUDE.md content rule 12 (the
  class study). If one touches them, ask Jimmy instead of publishing it.
