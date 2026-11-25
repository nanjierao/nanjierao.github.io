---
name: add-note
description: Add one day's entry to the Daily notes page (/notes/) of nanjierao.github.io, in Jimmy's words, and merge it once the checks pass. Use when Jimmy sends a day's note, typed in the session or relayed from another of his sessions, or asks to change or remove a note.
---

Add one daily note. Rules: CLAUDE.md content rules 2, 12 and 13, and D71 in `docs/DECISIONS.md`.
The file format is in `src/content/notes/README.md`. This repository is public, and a pushed
branch is public even when it is never merged: whenever a step says to ask Jimmy and wait, the
note is not in the repository at all (step 3).

1. **Date.** Use the date the message gives. Otherwise use the day it was sent, in New York, from
   its UTC send time: `TZ=America/New_York date -d '<send time>' '+%F %H:%M %Z'` (for
   2026-11-26T03:10:00Z it prints `2026-11-25 22:10 EST`; output without EST or EDT means a
   mistyped zone). A message sent between midnight and 04:00 there belongs to the day before:
   he is writing about the day that just ended. If the date he gives is later than the day the
   message was sent in New York, ask him before writing anything. Never change his date, or the
   date test in `tests/unit/notes.test.ts`, to make a check pass: if he confirms a date that
   `npm run test` still calls later than today, wait until that date has begun in UTC, then run
   step 5 and ship. The note is `src/content/notes/<YYYY-MM-DD>.yaml`. If that file already
   exists, ask Jimmy whether the new text replaces the note or is added to it, and wait for his
   answer.
2. **His words.** Keep his structure and his words exactly. Each item he numbers or bullets, or
   each line he sends, is one line of the note; running text without a list is split only at
   sentence ends. Keep his wording, spelling, punctuation, language and bold (`**like this**`,
   the only formatting the page shows). Don't correct, translate, shorten, reorder or add
   anything. Leave out only words addressed to the session ("today's note:") and his list
   numbers, which the page draws itself. The schema takes one to five items: a sentence of at
   most 300 characters, or a bold lead (a whole sentence, at most 300) and a short paragraph, at
   most 1,000 in all, with bold in pairs. If the note doesn't fit, ask.
3. **Hold back and ask** before writing anything, when a line
   - touches anything in facts.md §15. Read all of §15 for each note; this list gives examples
     and doesn't replace it: job search (applications and application materials, interviews,
     offers), grades, immigration or work authorization, family members, health, compensation,
     location or availability, study participants or their data, raw datasets or transcripts,
     reviewer comments (quoted or in his own words), numbers or results from work that facts.md
     doesn't hold, exact citation counts, private documents;
   - touches the class study at all (CLAUDE.md rules 12 and 13, D69): its people, even by role;
     who or how many take part, sign up, join or leave; its survey, diaries, coding or meetings;
     any data, number or result from it; its course;
   - contains a course code, however it is written (`ABC 1234`, `abc 1234`, `Abc1234`), other
     than the courses on /teaching: the repository never names the class study's course, so you
     can't tell the two apart;
   - contains an email address other than raon@ufl.edu, a phone number, a street address or an
     ID number;
   - quotes a study participant or a private message.

   Ask him whether to drop the line or reword it himself. Quote it only in your reply, never in a
   file, a commit message or a pull request. Until he answers, nothing from that note goes into
   the repository: no file, no commit, no push. Before you reply, `git status --short
   src/content/notes` must show nothing for this note (delete a file you created, `git restore`
   one you edited). With a clean tree the end-of-turn check has nothing to ask for; if anything
   still asks you to commit or push the note, don't. A line in these categories goes up
   unchanged only after he changes the rule itself (facts.md §15, or CLAUDE.md rule 12).
4. **Write the file**, every line in single quotes. Inside them, write each apostrophe twice
   (`''`) and copy everything else exactly, backslashes included: single quotes read no escapes.
   Never write double quotes or backslash escapes yourself; in double quotes a backslash changes
   the text (`\t` becomes a tab). `npm run format` switches a line to double quotes only where
   that keeps the text.
   ```yaml
   lines:
     - 'First sentence.'
     - '**A bold lead.** And the rest of the item, with Jimmy''s apostrophe.'
     - 'Third sentence.'
   ```
5. **Checks.** `npm run format`, then `npm run build` (the real build, without the fixture
   variables) and `npm run test:e2e` against it, so the notes, width and accessibility tests see
   the real note; the fixture-only tests skip themselves. Then `npm run check`, `npm run lint`,
   `npm run test` and `npm run check:privacy`. If `npm run test:e2e` can't start a browser, the
   checks have not passed (D67): push, open the pull request, say so in it, leave it open, and
   tell Jimmy in your reply.
   If a check flags one of his lines (`tests/unit/notes.test.ts` names it by file, line and
   fingerprint; `check:privacy` by file), the note is held back as in step 3: keep his words and
   keep the patterns, and ask Jimmy, quoting the line only in your reply. If he says it is fine
   (an RFC or ISO number is not a course number; a count of his own section's students is not
   about the class study), add the fingerprint to `CLEARED_LINES` in `tests/unit/notes.test.ts`
   (for `check:privacy`, to `scripts/privacy-allowlist.json`) in the note's pull request, with a
   reason you write yourself in a few words and the date, such as `Jimmy, 2026-11-26: an RFC
   number, not a course number.` The reason names no course, person, count or §15 detail,
   doesn't repeat the flagged words, and never pastes his message; the unit test runs the
   patterns over it too. The pull request gives the fingerprint and that reason, not his
   message. Never clear a line on your own judgment.
6. **Ship (D67).** Commit `content: daily note for <YYYY-MM-DD>`, push, and open the pull
   request. It quotes the note instead of attaching screenshots: a note changes no layout, and
   step 5's end-to-end tests check it on the real build. (A pull request that also changes the
   site's code attaches screenshots, as any other does.) Merge it once step 5's checks, the
   end-to-end tests included, and CI pass. When the site is deployed, reply with
   `https://nanjierao.github.io/notes/#<YYYY-MM-DD>` and the date you used.

**To change or remove a past note** when Jimmy asks: check the new text first (step 3), then edit
or delete its file, run step 5, and ship as in step 6 with the commit
`content: change the daily note for <YYYY-MM-DD>` or `content: remove the daily note for
<YYYY-MM-DD>`. Take out its `CLEARED_LINES` entries too (the unit test fails on an entry that
matches no line). A removal's pull request names the date but doesn't quote the removed lines;
reply with `https://nanjierao.github.io/notes/`. Then tell Jimmy that the old text is off the
site but still public in the repository's history and in the note's first pull request (its
description and its diff). Erasing it takes a history rewrite and a force-push of `main`, plus a
request to GitHub Support for the pull request's copies: his call, as in D53. Editing the old
pull request's description doesn't help, because its diff and the description's edit history
still show the text.
