---
name: post-zhihu
description: Publish one of Jimmy's Zhihu answers as a blog post on nanjierao.github.io, with an English title and summary. Use only when Jimmy runs /post-zhihu.
argument-hint: "[zhihu-url] (draft pasted in chat or uploaded to inbox/)"
disable-model-invocation: true
---

Publish one Zhihu answer as a blog post. Zhihu URL of the original (optional): `$ARGUMENTS`.
Rules come from CLAUDE.md (public repository, content rules, images, git workflow) and DECISIONS
D41 and D52.

1. **Find the draft.** Use the Markdown file Jimmy uploaded to `inbox/`, or the text he pasted in
   this session. If both or neither, ask. It is Jimmy's own writing: keep his words exactly; fix
   only broken Markdown. If he says the answer is Zhihu-exclusive or paid (for example 盐选), stop
   and ask before going on.
2. **Find or create the post.** If a post with the same Zhihu URL already exists, update it
   instead of adding a second one. Otherwise create
   `src/content/blog/<YYYY-MM-DD>-<short-english-slug>/index.md` (the answer's date if the draft
   gives one, otherwise today).
3. **Front matter** (follow the blog schema in the content config; if it differs from this list,
   the schema wins): `title` (Chinese, as written), `title_en` (faithful translation), `date`,
   `lang: zh-CN`, `zhihu_url`, `summary_en`, `tags` (3–5, English), `draft: false`.
4. **English summary.** 2–3 plain sentences on what the answer argues, and why it matters for
   HCI, AI or learning when the post itself says so. Summarize only what the post says: no new
   claims, numbers, quotations or citations. Show Jimmy `title_en` and `summary_en` in the session
   and put them first in the PR description so he can edit them before merging.
5. **Images.** Move the images Jimmy uploaded to `inbox/` into the post folder and reference them
   relatively (`./name.jpg`), so Astro's image pipeline processes them and strips metadata. Never
   hot-link `zhimg.com`: Zhihu blocks hotlinking. If the draft points to images that aren't in
   `inbox/`, list them and ask Jimmy to upload them there. Only his own images: ask about
   screenshots or pictures made by other people. Strip metadata before committing
   (`npm run strip-images -- <files>`), and give every image Chinese alt text that says what it
   shows (`![…](./name.jpg)`); keep his own caption where he wrote one, and show Jimmy any alt
   text you drafted. The content tests fail on images without alt text.
6. **Privacy check.** Report what you find; don't fix it silently:
   - phone numbers, email addresses, street addresses, ID-like numbers;
   - names or @handles of other people (Zhihu users, students, colleagues). Readers' comments may
     be quoted only briefly, as "a Zhihu reader", without usernames;
   - anything in the facts.md §15 categories.
   If anything turns up, stop and ask.
7. **Build and check.** Run `npm run build`, `npm run check` and `npm run check:privacy`; take
   screenshots of the post (phone and desktop).
8. **Open a pull request** (`content: blog post <title_en>`) with the English title and summary,
   the screenshots, and what the checks found. Leave `inbox/` empty. Merging publishes the post at
   `https://nanjierao.github.io/blog/<slug>/`.
