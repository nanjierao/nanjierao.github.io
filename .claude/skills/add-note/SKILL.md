---
name: add-note
description: Add one day's entry to the Daily notes page (/notes/) of nanjierao.github.io, in Jimmy's words, and merge it once the checks pass. Use when Jimmy sends a day's note, typed in the session or relayed from another of his sessions, or asks to change or remove a note.
---

Add one daily note. Rules: CLAUDE.md content rules 2, 12 and 13, and D71 in `docs/DECISIONS.md`.
The file format is in `src/content/notes/README.md`.

1. **Date.** Use the date the message gives. Otherwise use the day the message was sent, in
   Jimmy's time zone (America/New_York): a message sent at 02:00 UTC belongs to the day before.
   The note is `src/content/notes/<YYYY-MM-DD>.yaml`. If that file already exists, ask Jimmy
   whether the new text replaces the note or is added to it, and wait for his answer.
2. **His words.** One sentence per line, exactly as written: keep his wording, spelling,
   punctuation and language. Don't correct, translate, shorten, reorder or add anything. If he
   sends one paragraph, split it only at sentence ends; if he sends separate lines, keep them.
   Leave out only words addressed to the session ("today's note:"). The schema takes one to five
   lines of at most 300 characters each; if the note doesn't fit, ask.
3. **Write the file**, every line quoted (`npm run format` later picks single or double quotes,
   whichever needs no escape; a unit test fails on an unquoted line):
   ```yaml
   lines:
     - 'First sentence.'
     - "Second sentence, with Jimmy's apostrophe."
     - 'Third sentence.'
   ```
4. **Hold back and ask** instead of publishing when a line
   - falls under facts.md §15: job search (applications, interviews, offers), grades,
     immigration or work authorization, family members, health, compensation, location or
     availability, study participants, private documents;
   - names or describes anyone in the class study, or names its course (CLAUDE.md rule 12);
   - contains an email address other than raon@ufl.edu, a phone number, a street address or an
     ID number;
   - quotes a reviewer, a study participant or a private message.
   Quote the line only in your reply to Jimmy, never in a file, a commit message or a pull
   request, and publish nothing from that note until he answers.
5. **Checks.** `npm run format`, then `npm run build`, `npm run check`, `npm run lint`,
   `npm run test` and `npm run check:privacy`. The note changes no layout (the tests cover the
   layout), so its pull request quotes the note instead of attaching screenshots.
6. **Ship (D67).** Commit `content: daily note for <YYYY-MM-DD>`, push, open the pull request,
   and merge it once CI passes. When the site is deployed, reply with
   `https://nanjierao.github.io/notes/#<YYYY-MM-DD>`.

To change or remove a past note when Jimmy asks: edit or delete its file, then steps 4 to 6.
