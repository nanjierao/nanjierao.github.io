# Blog posts

One folder per post, created by `/post-zhihu` (`.claude/skills/post-zhihu/`):

```
src/content/blog/<YYYY-MM-DD>-<short-english-slug>/
  index.md      front matter + Jimmy's Chinese text, unchanged
  figure-1.jpg  images beside the post, referenced as ./figure-1.jpg
```

Front matter (schema: `blogSchema` in `src/content/schemas.ts`):

```yaml
title: 中文标题（as written on Zhihu）
title_en: English title (faithful translation)
summary_en: Two or three plain sentences that only summarize the post.
date: 2026-11-01
lang: zh-CN
zhihu_url: https://www.zhihu.com/question/…/answer/…
tags: [learning, AI]
draft: false
```

The URL is `/blog/<folder name>/`. Posts with `draft: true` are not built.
