// End-to-end checks against the production build (`npm run build`, then `npm run test:e2e`).
// Network access outside the site is blocked here, so tests also prove the pages work offline
// and fall back quietly when GitHub or YouTube can't be reached.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const PAGES = [
  '/',
  '/research/',
  '/research/interest-identification/',
  '/research/grounding/',
  '/research/civic-digital-twins/',
  '/research/embodied-learning/',
  '/research/teacher-support/',
  '/research/data-analysis-through-ai/',
  '/publications/',
  '/builds/',
  '/builds/cs-udt/',
  '/builds/interest-extraction-pipeline/',
  '/builds/gaze-log-platform/',
  '/builds/academic-revision-checklist/',
  '/builds/puppet-system/',
  '/builds/ar-smart-glasses/',
  '/builds/cte-activity-recognition/',
  '/builds/xprize-avatar-robot/',
  '/builds/robot-imitation-thesis/',
  '/builds/baby-thermometer/',
  '/builds/engagement-dashboards/',
  '/teaching/',
  '/cv/',
  '/about/',
  '/blog/',
  '/notes/',
  '/privacy/',
  '/credits/',
  '/hands/',
  '/ask/',
  '/life/',
  '/demos/csudt/',
];

const githubEvents = readFileSync(
  new URL('../fixtures/github-events.json', import.meta.url),
  'utf8',
);

/** Keep every test offline: only the local preview server answers. */
async function isolate(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
    external.push(new URL(route.request().url()).host);
    await route.abort();
  });
  return external;
}

test.describe('every page', () => {
  for (const path of PAGES) {
    test(`${path} is well-formed`, async ({ page }) => {
      const external = await isolate(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle(/Nanjie \(Jimmy\) Rao/);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://nanjierao.github.io${path}`,
      );
      expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
      // D30: the annotation legend on every page, with line style + label (+ color).
      await expect(page.locator('footer .legend')).toContainText(
        'Solid underline: shown in the source · Dotted: inferred',
      );
      // D70: the one public email address, in the footer of every page.
      await expect(page.locator('footer a[href^="mailto:"]')).toHaveText(['raon@ufl.edu']);
      // D71: the footer links the Daily notes on every page, a second way in beside the home card.
      await expect(page.locator('footer a[href="/notes/"]')).toHaveText('Daily notes');
      await expect(page.locator('footer a[href^="mailto:"]')).toHaveAttribute(
        'href',
        'mailto:raon@ufl.edu',
      );
      // Every image has alt text (empty only for decoration).
      for (const img of await page.locator('img').all()) {
        expect(await img.getAttribute('alt')).not.toBeNull();
      }
      // Only GitHub's public API may be contacted on load, and only from the homepage.
      const allowed = path === '/' ? ['api.github.com'] : [];
      expect(external.filter((host) => !allowed.includes(host))).toEqual([]);
    });

    test(`${path} keeps spaces around links and emphasis`, async ({ page }) => {
      await isolate(page);
      await page.goto(path);
      const html = (await page.content())
        .slice((await page.content()).indexOf('<body'))
        .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '');
      expect(html).not.toMatch(/[A-Za-z0-9.,;:)](?=<(a|strong|em|cite|time)\b)/);
      expect(html).not.toMatch(/<\/(a|strong|em|cite|time)>(?=[A-Za-z0-9(])/);
      // e.g. "repo· Oct 26": a link followed directly by a span that starts with punctuation.
      expect(html).not.toMatch(/<\/(a|time)>(?=<span[^>]*>[·(])/);
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`${path} has no axe violations (${scheme})`, async ({ page }) => {
        await isolate(page);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        // Check the page as a visitor sees it once it has settled: the homepage word cloud is
        // laid out after the fonts load and then fades in for 0.4 s, and axe would otherwise
        // measure the half-transparent words.
        await page.waitForFunction(() => {
          const cloud = document.querySelector('[data-wordcloud]');
          const box = cloud?.querySelector<HTMLElement>('[data-cloud]');
          const laidOut = !box || box.clientWidth < 600 || cloud!.classList.contains('is-cloud');
          return laidOut && document.getAnimations().every((a) => a.playState !== 'running');
        });
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
      });
    }
  }
});

test('unknown addresses get the 404 page', async ({ page }) => {
  await isolate(page);
  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page not found');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('skip link moves focus to the main content', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await isolate(page);
  await page.goto('/publications/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('theme toggle switches to dark and remembers the choice', async ({ page }) => {
  await isolate(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(21, 21, 19)');
});

test.describe('time-aware wording (D26)', () => {
  test('says "Upcoming" before DTRUE 2026', async ({ page }) => {
    await isolate(page);
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-05:00'));
    await page.goto('/');
    await expect(page.locator('main')).toContainText('Upcoming oral presentation at DTRUE 2026');
    await page.goto('/cv/');
    await expect(page.locator('main')).toContainText('Upcoming oral presentation at DTRUE 2026');
  });

  test('says "Presented" after 2026-11-20, even on a page built earlier', async ({ page }) => {
    await isolate(page);
    await page.clock.setFixedTime(new Date('2026-11-21T09:00:00-05:00'));
    await page.goto('/');
    await expect(page.locator('main')).toContainText('Presented at DTRUE 2026');
    await expect(page.locator('main')).not.toContainText('Upcoming oral presentation');
    await page.goto('/about/');
    await expect(page.locator('main')).toContainText('Presented at DTRUE 2026');
  });

  test('shows the degree note through December 2026 and drops it after (D65)', async ({ page }) => {
    await isolate(page);
    await page.clock.setFixedTime(new Date('2026-12-31T23:00:00-05:00'));
    await page.goto('/');
    await expect(page.locator('.intro__role')).toHaveText(
      'Ph.D., Human-Centered Computing, University of Florida (defense passed and dissertation accepted; degree will be granted December 2026) · ELX Lab, advised by Dr. Sharon Lynn Chu',
    );
    await page.clock.setFixedTime(new Date('2027-01-01T00:30:00-05:00'));
    await page.goto('/');
    await expect(page.locator('.intro__role')).toHaveText(
      'Ph.D., Human-Centered Computing, University of Florida · ELX Lab, advised by Dr. Sharon Lynn Chu',
    );
  });
});

test.describe('YouTube facade', () => {
  test('loads nothing from YouTube until clicked, then uses youtube-nocookie.com', async ({
    page,
  }) => {
    const external = await isolate(page);
    await page.goto('/builds/xprize-avatar-robot/');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(external.filter((host) => host.includes('youtube') || host.includes('ytimg'))).toEqual(
      [],
    );
    await page.getByRole('link', { name: /Play video: ANA Avatar XPRIZE/ }).click();
    const frame = page.locator('iframe');
    await expect(frame).toHaveAttribute(
      'src',
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/u9nYUBc-_s0\?.*start=74/,
    );
    await expect(frame).toHaveAttribute('title', 'ANA Avatar XPRIZE');
  });

  test('works as a plain link to YouTube without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/builds/puppet-system/');
    await expect(page.getByRole('link', { name: /Play video/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=OX2zRUeDojg',
    );
    await expect(page.getByRole('button', { name: 'Dark theme' })).toBeHidden();
    await context.close();
  });
});

test.describe('GitHub activity in the browser (D40)', () => {
  test('refreshes from the public API and renders text only', async ({ page }) => {
    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: githubEvents }),
    );
    await page.goto('/');
    test.skip(
      (await page.locator('[data-github-activity]').getAttribute('data-allowed-repos')) === null,
      'Build with EXTERNAL_DATA=fixtures to test the refresh',
    );
    const list = page.locator('[data-github-activity] [data-list]');
    await expect(list).toBeVisible();
    await expect(list.locator('li')).toHaveCount(4);
    await expect(list).toContainText('Pushed commits to JimmyRaoUF/fixture-study-tools');
    await expect(list.locator('script')).toHaveCount(0);
    const cached = await page.evaluate(() => sessionStorage.getItem('github-activity-v1'));
    expect(cached).toContain('fixture-study-tools');
  });

  test("does not refresh without the build's list of approved repositories", async ({ page }) => {
    const events = JSON.parse(githubEvents) as Array<Record<string, unknown>>;
    events.unshift({
      id: '98',
      type: 'PushEvent',
      created_at: '2026-10-27T11:00:00Z',
      repo: { name: 'JimmyRaoUF/never-seen-by-the-build' },
      payload: {},
    });
    let requests = 0;
    await page.route('https://api.github.com/**', (route) => {
      requests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(events),
      });
    });
    // Serve the homepage the way a build without GitHub data writes it: no approved list.
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/ data-allowed-repos="[^"]*"/, '');
        await route.fulfill({ response, body });
      },
    );
    await page.goto('/');
    const root = page.locator('[data-github-activity]');
    expect(await root.getAttribute('data-allowed-repos')).toBeNull();
    await page.waitForLoadState('networkidle');
    expect(requests).toBe(0);
    await expect(root).not.toContainText('never-seen-by-the-build');
    await expect(root).toContainText('More on github.com/JimmyRaoUF');
  });

  test('keeps the build-time content when the API fails', async ({ page }) => {
    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({ status: 403, body: '{"message":"API rate limit exceeded"}' }),
    );
    await page.goto('/');
    const section = page.locator('[data-github-activity]');
    await expect(section).toContainText('More on github.com/JimmyRaoUF');
    await expect(section).not.toContainText('rate limit');
  });
});

test.describe('feeds and crawlers', () => {
  test('RSS, sitemap and robots.txt', async ({ request }) => {
    const rss = await request.get('/rss.xml');
    expect(rss.ok()).toBe(true);
    expect(await rss.text()).toContain('<rss');
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).toContain('https://nanjierao.github.io/research/grounding/');
    expect(sitemap).not.toContain('/hands/');
    expect(sitemap).not.toContain('/404');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://nanjierao.github.io/sitemap-index.xml');
  });

  test('gives the public email wherever the site offers contact details (D70)', async ({
    page,
  }) => {
    await isolate(page);
    const MAILTO = 'mailto:raon@ufl.edu';
    await page.goto('/');
    await expect(
      page.getByRole('list', { name: 'Quick links' }).getByRole('link', { name: 'Email' }),
    ).toHaveAttribute('href', MAILTO);
    await page.goto('/about/');
    const contact = page.locator('section[aria-labelledby="about-contact"]');
    await expect(contact.locator('h2')).toHaveText('Contact');
    await expect(contact.locator('p')).toHaveText('Email me at raon@ufl.edu.');
    await expect(contact.getByRole('link', { name: 'raon@ufl.edu' })).toHaveAttribute(
      'href',
      MAILTO,
    );
    await page.goto('/cv/');
    await expect(
      page.locator('.cv-header').getByRole('link', { name: 'raon@ufl.edu' }),
    ).toHaveAttribute('href', MAILTO);
    await page.goto('/privacy/');
    await expect(page.locator('main').getByRole('link', { name: 'raon@ufl.edu' })).toHaveAttribute(
      'href',
      MAILTO,
    );
    // No page links any other address.
    for (const path of PAGES) {
      await page.goto(path);
      for (const href of await page
        .locator('a[href^="mailto:"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
        expect(href, path).toBe(MAILTO);
    }
  });

  test('home and about carry a JSON-LD Person with sameAs links', async ({ page }) => {
    await isolate(page);
    await page.goto('/about/');
    const json = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    ) as { '@type': string; sameAs: string[]; email: string };
    expect(json['@type']).toBe('Person');
    expect(json.email).toBe('mailto:raon@ufl.edu');
    expect(json.sameAs).toContain('https://github.com/JimmyRaoUF');
    expect(json.sameAs).toContain('https://www.zhihu.com/people/daozhu');
  });
});

test.describe('daily notes (D71)', () => {
  const CARD = 'section[aria-labelledby="daily-notes"]';
  /** The notes a build can show: the real ones, or the synthetic ones (NOTES_FIXTURES=1). */
  const onDisk = (dir: string) =>
    readdirSync(new URL(`../../${dir}/`, import.meta.url))
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => name.replace(/\.yaml$/, ''))
      .sort()
      .reverse();
  /** Chinese characters must sit inside lang="zh-CN", and Latin letters outside it (WCAG 3.1.2). */
  const misLabelled = (lists: Element[]) =>
    lists.flatMap((list) => {
      const found: string[] = [];
      // A line in Chinese, without Latin letters, is marked as a whole, its numbers included.
      for (const line of list.querySelectorAll('li')) {
        const text = line.textContent ?? '';
        if (
          /\p{Script=Han}/u.test(text) &&
          !/\p{Script=Latin}/u.test(text) &&
          line.getAttribute('lang') !== 'zh-CN'
        )
          found.push(`not marked as a whole: ${text}`);
      }
      const walker = document.createTreeWalker(list, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        const lang = node.parentElement?.closest('[lang]')?.getAttribute('lang');
        if (/\p{Script=Han}/u.test(text) && lang !== 'zh-CN') found.push(`not Chinese: ${text}`);
        if (/[A-Za-z]/.test(text) && lang === 'zh-CN') found.push(`marked Chinese: ${text}`);
      }
      return found;
    });

  test('is the first card in Recent on the home page, with a link to the page', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    const card = page.locator(`#recent-heading ~ .recent-grid > ${CARD}`);
    await expect(card).toHaveCount(1);
    await expect(page.locator('.recent-grid > .card').first()).toHaveAttribute(
      'aria-labelledby',
      'daily-notes',
    );
    await card
      .getByRole('heading', { level: 3 })
      .getByRole('link', { name: 'Daily notes' })
      .click();
    await expect(page).toHaveURL(/\/notes\/$/);
    await expect(page.locator('h1')).toHaveText('Daily notes');
    await expect(page.locator('main .lede')).toHaveText(
      'Each entry is a date and three short notes: what I did that day, and what I learned, at work or outside it.',
    );
  });

  test('lists the notes newest first by month, or says that there are none yet', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/notes/');
    const notes = page.locator('article.note');
    const ids = await notes.evaluateAll((els) => els.map((el) => el.id));
    // Every note file the build read is on the page: nothing went missing on the way.
    expect([onDisk('src/content/notes'), onDisk('tests/fixtures/notes')]).toContainEqual(ids);
    await page.goto('/');
    const card = page.locator(CARD);
    if (ids.length === 0) {
      await page.goto('/notes/');
      await expect(page.locator('.notes-empty')).toHaveText('No notes yet.');
      await expect(page.locator('main h2')).toHaveCount(0);
      await page.goto('/');
      await expect(card.locator('p')).toHaveText(
        'A date and three short notes a day: what I did, and what I learned.',
      );
      await expect(card.locator('li')).toHaveCount(0);
      return;
    }
    // Newest first: the ids are dates, and they sort.
    expect(ids).toEqual([...ids].sort().reverse());
    // The home card shows the newest note: each item, or only its bold lead when it has one,
    // then a link to the full note. Chinese is marked there as on the page, and no ** shows.
    await expect(card.locator('time')).toHaveAttribute('datetime', ids[0]!);
    const shown = await card.locator('li').allTextContents();
    expect(await card.locator('ol').evaluateAll(misLabelled)).toEqual([]);
    const fullNote = await card
      .getByRole('link', { name: 'Read the full note' })
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(await page.locator('main').innerText()).not.toContain('**');
    await page.goto('/notes/');
    const items = await notes
      .first()
      .locator('li')
      .evaluateAll((lines) =>
        lines.map((line) => {
          // A lead is a whole sentence in bold at the start, with more after it: after a space,
          // or straight after a Chinese sentence's end (noteLead in src/lib/notes.ts).
          const text = line.textContent ?? '';
          const first = line.firstChild;
          const bold =
            first instanceof HTMLElement && first.tagName === 'STRONG'
              ? (first.textContent ?? '')
              : '';
          const rest = text.slice(bold.length);
          const sentence = /[.!?\u3002\uFF01\uFF1F]['"\u2019\u201D)\uFF09\u300D\u300F]?$/u.test(
            bold,
          );
          const chinese = /[\u3002\uFF01\uFF1F]['"\u2019\u201D)\uFF09\u300D\u300F]?$/u.test(bold);
          const lead =
            bold && sentence && (/^\s+\S/u.test(rest) || (chinese && /^\S/u.test(rest)))
              ? bold
              : null;
          return { text, lead };
        }),
      );
    expect(shown).toEqual(items.map((item) => item.lead ?? item.text));
    expect(fullNote).toEqual(items.some((item) => item.lead) ? [`/notes/#${ids[0]}`] : []);
    expect(await page.locator('main').innerText()).not.toContain('**');
    await expect(page.locator('.notes-empty')).toHaveCount(0);
    // One month heading per month, newest first; each day under its own month.
    const months = await page.locator('section.notes-month').evaluateAll((sections) =>
      sections.map((section) => ({
        heading: section.querySelector('h2')?.textContent ?? '',
        days: [...section.querySelectorAll('article.note')].map((article) => article.id),
      })),
    );
    expect(months.flatMap((month) => month.days)).toEqual(ids);
    expect(new Set(months.map((month) => month.heading)).size).toBe(months.length);
    expect(months.every((month) => month.days.length > 0)).toBe(true);
    for (const month of months)
      for (const day of month.days) {
        const label = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });
        expect(month.heading).toBe(label);
      }
    // Each day: a heading with its date, and one to five lines.
    for (const id of ids) {
      const note = page.locator(`article.note[id="${id}"]`);
      await expect(note.locator('h3 time')).toHaveAttribute('datetime', id);
      const count = await note.locator('li').count();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
    // Chinese text is marked as Chinese, and nothing else is.
    expect(await page.locator('.note__lines').evaluateAll(misLabelled)).toEqual([]);
  });

  test('keeps the words of a note exactly, and gives each day an address', async ({ page }) => {
    await isolate(page);
    const response = await page.goto('/notes/');
    expect(response?.status()).toBe(200);
    test.skip(
      (await page.locator('article.note[id="2026-10-01"]').count()) === 0,
      'Build with NOTES_FIXTURES=1 to test the notes layout',
    );
    const note = page.locator('article.note[id="2026-10-01"]');
    await expect(note.locator('h3')).toHaveText('Thursday, October 1');
    await expect(note.locator('li').first()).toHaveText(
      'Test note: issue #12 keeps its hash sign, because every line is quoted.',
    );
    await expect(page.locator('article.note[id="2026-10-02"] li').nth(1)).toHaveText(
      "A second sentence with an apostrophe, so the quoting is tested: it's kept as written.",
    );
    // A backslash stays as written (single quotes in the YAML read no escapes).
    await expect(note.locator('li').nth(3)).toHaveText(
      'A backslash stays as written in single quotes: \\textbf{bold} and C:\\temp.',
    );
    // A line in Chinese, without Latin letters, is marked as a whole; in a mixed line, each run
    // of Chinese is.
    const lines = (id: string) => page.locator(`article.note[id="${id}"] li`);
    await expect(lines('2026-10-02').nth(2)).toHaveAttribute('lang', 'zh-CN');
    await expect(lines('2026-10-02').nth(2).locator('span')).toHaveCount(0);
    expect(await lines('2026-10-01').nth(1).getAttribute('lang')).toBeNull();
    await expect(lines('2026-10-01').nth(1).locator('span[lang="zh-CN"]')).toHaveText([
      '测试句子里也可以有一个英文词',
      '。',
    ]);
    await expect(lines('2026-10-01').nth(4).locator('span[lang="zh-CN"]')).toHaveText(['测试短语']);
    // An item's bold lead is bold, and its words are kept without the asterisks.
    // A lead that mixes English and Chinese is one bold element, its Chinese marked inside it.
    const led = lines('2026-10-02').nth(4);
    await expect(led.locator('strong')).toHaveText(
      'A bold lead with a Chinese word, 中文, for a longer test item.',
    );
    await expect(led.locator('strong span[lang="zh-CN"]')).toHaveText('中文');
    await expect(led).toHaveText(
      'A bold lead with a Chinese word, 中文, for a longer test item. The rest of the item follows on the same line, as in a note whose items are a bold lead and a short paragraph. The home page card shows only the lead and links to the full note.',
    );
    // The home card shows the newest test note, with its Chinese line marked, the bold item by
    // its lead alone, and a link to the full note.
    await page.goto('/');
    await expect(page.locator(`${CARD} li`)).toHaveCount(5);
    await expect(page.locator(`${CARD} li`).nth(4)).toHaveText(
      'A bold lead with a Chinese word, 中文, for a longer test item.',
    );
    await expect(
      page.locator(CARD).getByRole('link', { name: 'Read the full note' }),
    ).toHaveAttribute('href', '/notes/#2026-10-02');
    await expect(page.locator(`${CARD} li[lang="zh-CN"]`)).toHaveText([
      '10月2日，这是一句用来检查中文排版的测试句子。',
    ]);
    await page.goto('/notes/');
    // /notes/#<date> brings that day into view: to the top, with a margin above its heading,
    // when the page is long enough below it, and at least fully on screen when it is the last.
    await page.setViewportSize({ width: 390, height: 700 });
    const heading = (id: string) =>
      page
        .locator(`article.note[id="${id}"] h3`)
        .evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().bottom]);
    await page.goto('/notes/#2026-10-01');
    const [top] = await heading('2026-10-01');
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(80);
    await page.goto('/notes/#2026-09-30');
    const [lastTop, lastBottom] = await heading('2026-09-30');
    expect(lastTop).toBeGreaterThan(0);
    expect(lastBottom).toBeLessThanOrEqual(700);
  });

  test('fits the page at every width', async ({ page }) => {
    await isolate(page);
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/notes/', '/']) {
        await page.goto(path);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${path} at ${width}px`,
        ).toBeLessThanOrEqual(width);
      }
    }
  });
});

test.describe('blog', () => {
  test('post layout: English title and summary first, Chinese body, Zhihu link', async ({
    page,
  }) => {
    await isolate(page);
    const response = await page.goto('/blog/2026-10-01-fixture-post/');
    test.skip(response?.status() !== 200, 'Build with BLOG_FIXTURES=1 to test the post layout');
    await expect(page.locator('h1')).toHaveText('Test post: a sample used to check the layout');
    await expect(page.locator('.post__body')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('link', { name: 'Original on Zhihu' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.zhihu\.com\//,
    );
    // The post image went through Astro's pipeline (no raw file from the post folder).
    await expect(page.locator('.post__body img')).toHaveAttribute('src', /^\/_astro\//);
  });
});

test('keyboard focus on the YouTube facade is visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await isolate(page);
  await page.goto('/builds/xprize-avatar-robot/');
  const facade = page.locator('yt-facade');
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (await facade.evaluate((el) => el.contains(document.activeElement))) break;
  }
  await expect(facade.locator('a')).toBeFocused();
  expect(await facade.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
});

test('the nav marks the current page and the current section differently', async ({ page }) => {
  await isolate(page);
  await page.goto('/builds/');
  const builds = page.locator('.site-nav a[href="/builds/"]');
  await expect(builds).toHaveAttribute('aria-current', 'page');
  await page.goto('/builds/xprize-avatar-robot/');
  await expect(builds).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveCount(0);
});

test('mouse users get no focus ring around the player', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await isolate(page);
  await page.goto('/builds/xprize-avatar-robot/');
  await page.getByRole('link', { name: /Play video/ }).click();
  await expect(page.locator('yt-facade iframe')).toHaveCount(1);
  expect(await page.locator('yt-facade').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    'none',
  );
});

test('the browser refresh shows only repositories the build approved', async ({ page }) => {
  const events = JSON.parse(githubEvents) as Array<Record<string, unknown>>;
  events.unshift({
    id: '99',
    type: 'PushEvent',
    created_at: '2026-10-27T10:00:00Z',
    repo: { name: 'JimmyRaoUF/not-approved-by-the-build' },
    payload: {},
  });
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(events) }),
  );
  await page.goto('/');
  const root = page.locator('[data-github-activity]');
  test.skip(
    (await root.getAttribute('data-allowed-repos')) === null,
    'Build with EXTERNAL_DATA=fixtures to test the approved-repository filter',
  );
  await expect(root.locator('li').first()).toBeVisible();
  await expect(root).not.toContainText('not-approved-by-the-build');
});

test('the latest-video card shows the newest title that passes the filters (D54)', async ({
  page,
}) => {
  const external = await isolate(page);
  await page.goto('/');
  const card = page.locator('section[aria-labelledby="latest-video"]');
  test.skip((await card.count()) === 0, 'Build with EXTERNAL_DATA=fixtures to test the card');
  // The newest fixture title names a child, so the card skips to the next one.
  await expect(card).toContainText(
    'Fixture video: testing a common piece of advice & what happened',
  );
  await expect(card).not.toContainText('daughter');
  await expect(card.locator('img')).toHaveAttribute('src', /^\/_astro\//);
  expect(external.filter((host) => host.includes('youtube') || host.includes('ytimg'))).toEqual([]);
});

test.describe('CS-UDT phone demo', () => {
  const DEMO = '/demos/csudt/csudt_mobile.html';
  const relayLink = (payload: object, query = '') =>
    `${DEMO}${query}#relay=${encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString('base64'))}`;
  const report = {
    v: 1,
    id: 'r-test-1',
    user: 'Neighbor',
    type: 'Flooded road',
    sev: 4,
    txt: 'Water over the curb',
    hood: 'San Marco',
    coords: null,
    t: 0,
  };
  const injected = (page: Page) =>
    page.evaluate(() => (window as unknown as { __relayed?: number }).__relayed);

  test('shows relayed report fields as text, also after a reload', async ({ page }) => {
    await isolate(page);
    await page.goto(
      relayLink({
        ...report,
        user: '<img src=x onerror="window.__relayed=1">',
        txt: '<b>bold</b><img src=x onerror="window.__relayed=2">',
      }),
    );
    const feed = page.locator('#feedList');
    await expect(feed).toContainText('<b>bold</b>');
    await expect(feed.locator('b, img, script')).toHaveCount(0);
    expect(await injected(page)).toBeUndefined();
    await page.goto(DEMO);
    await expect(feed).toContainText('<b>bold</b>');
    await expect(feed.locator('b, img, script')).toHaveCount(0);
    expect(await injected(page)).toBeUndefined();
  });

  test('accepts a valid relayed report and ignores malformed ones', async ({ page }) => {
    await isolate(page);
    const feed = page.locator('#feedList');
    const bad = [
      { ...report, id: 'bad-type', type: 'Anything', txt: 'marker bad type' },
      { ...report, id: 'bad-sev', sev: 9, txt: 'marker bad severity' },
      { ...report, id: 'bad-coords', coords: ['x', 1], txt: 'marker bad coordinates' },
      { ...report, id: 'bad id!', txt: 'marker bad id' },
    ];
    for (const [i, payload] of bad.entries()) {
      await page.goto(relayLink(payload, `?case=${i}`));
      await expect(feed).not.toContainText(payload.txt);
    }
    await page.goto(relayLink({ ...report, coords: [30.31, -81.66] }, '?case=ok'));
    await expect(feed).toContainText('Water over the curb');
    await expect(feed).toContainText('@Neighbor · relayed');
  });

  test('shrinks photos and keeps working when storage is full', async ({ page }) => {
    await isolate(page);
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      };
    });
    await page.goto(DEMO);
    await page.locator('nav button[data-v="report"]').click();
    const big = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#3a6' },
    })
      .png()
      .toBuffer();
    await page.setInputFiles('#photoIn', { name: 'big.png', mimeType: 'image/png', buffer: big });
    const photo = page.locator('#photoBox img');
    await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1024);
    await page.locator('#typeChips .chip').first().click();
    await page.locator('#submitBtn').click();
    await expect(page.locator('#toast')).toContainText("Couldn't save in this browser");
    await expect(page.locator('#feedList .feeditem').first()).toContainText('@You');
    await expect(page.locator('#feedList .feeditem').first().locator('img')).toHaveCount(1);
  });
});

test.describe('learners and teachers on the home page (D66)', () => {
  const SECTION = '#learners-and-teachers';

  test('is a section after the word cloud, with its parts in order and the shared citations', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    const section = page.locator(SECTION);
    await expect(section.locator('h2')).toHaveText('How AI learns about people and places');
    await expect(section.locator('.lt__part > h3')).toHaveText([
      'Observing learners',
      'Modeling teachers',
      'Supporting breadth',
    ]);
    // Home page order: intro strip, word cloud, this section, then Research and Recent.
    await expect(page.locator('main h2')).toHaveText([
      'Topics',
      'How AI learns about people and places',
      'Research',
      'Recent',
    ]);
    // Inside the section: the lede, the sketch scenes, then the diagram and the three parts.
    const order = await section.evaluate((el) =>
      ['.lede', '.sk', '.fig', '.lt__part'].map((selector) => {
        const first = el.querySelector(selector)!;
        return [...el.children].findIndex((child) => child === first || child.contains(first));
      }),
    );
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(new Set(order).size).toBe(4);
    await expect(section.locator('.study')).toHaveCount(4);
    // Each card: a short label as its heading, then the work's own title as a citation.
    await expect(section.locator('.study h4').first()).toHaveText(
      'The dissertation: asking students, and reading their records',
    );
    await expect(section.locator('.study cite')).toHaveCount(4);
    await expect(section.locator('#teachers-heading ~ .pub-list .pub')).toHaveCount(3);
    await expect(section.locator('#breadth-heading ~ .pub-list .pub')).toHaveCount(4);
  });

  test('has no tab and no page of its own', async ({ page }) => {
    await isolate(page);
    await page.goto('/');
    await expect(page.locator('.site-nav a')).toHaveText([
      'Research',
      'Publications',
      'Builds',
      'Teaching',
      'CV',
      'Blog',
      'About',
    ]);
    const response = await page.goto('/learners-and-teachers/');
    expect(response?.status()).toBe(404);
  });

  test('says "learner model", never "world model", and has no em dash in its text', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    const text = await page.locator(SECTION).innerText();
    expect(text).toContain('learner model');
    expect(text).not.toMatch(/world model/i);
    expect(text).not.toContain('—');
  });

  test('every link in the study cards leads to a page that has its target', async ({ page }) => {
    await isolate(page);
    await page.goto('/');
    const hrefs = await page
      .locator(`${SECTION} .study__links a`)
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThan(7);
    // One visit per page, then every anchor on it: going from one anchor to another on the same
    // page is not a navigation, so it has no response to check.
    const anchorsByPath = new Map<string, string[]>();
    for (const href of hrefs) {
      const [path, anchor] = href.split('#') as [string, string | undefined];
      anchorsByPath.set(path, [...(anchorsByPath.get(path) ?? []), ...(anchor ? [anchor] : [])]);
    }
    for (const [path, anchors] of anchorsByPath) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      for (const anchor of anchors) {
        await expect(page.locator(`[id="${anchor}"]`), `${path}#${anchor}`).toHaveCount(1);
      }
    }
  });

  test('a citation link marks the citation it points at', async ({ page }) => {
    await isolate(page);
    await page.goto('/');
    const link = page.locator(`${SECTION} #ieeevr-2020 .study__links a`, { hasText: 'Citation' });
    await expect(link).toHaveAccessibleName('Citation: IEEE VR 2020');
    await link.click();
    await expect(page).toHaveURL(/\/publications\/#ieeevr-2020-ar-smart-glasses$/);
    await expect(page.locator('#ieeevr-2020-ar-smart-glasses')).toHaveCSS(
      'border-left-width',
      '6px',
    );
  });

  test('fits the page at every width, cards and figures included', async ({ page }) => {
    await isolate(page);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.locator(`${SECTION} .study`).first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${width}px`,
      ).toBeLessThanOrEqual(width);
    }
  });
});

test.describe('sketch scenes on the home page (D68)', () => {
  const SK = '#learners-and-teachers .sk';
  const SCENES = ['tracker', 'dorm', 'dining', 'puppet', 'city'];
  const scene = (page: Page, id: string) => page.locator(`${SK} [data-scene="${id}"]`);
  const tab = (page: Page, id: string) => page.locator(`${SK} [data-scene-button="${id}"]`);
  /** The one line of a set that the scene's state shows (the others stay in the page, unseen). */
  const shown = (scope: Locator) => scope.locator('.sk__when:visible');
  /** Strokes of a drawing that are not fully drawn, by what the browser renders. */
  const undrawn = (scope: Locator) =>
    scope
      .locator('.sk__ink')
      .evaluateAll(
        (paths) => paths.filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset) > 0).length,
      );

  /** The home page with motion reduced: scenes open finished, and the steps are the visitor's. */
  async function openStill(page: Page) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await isolate(page);
    await page.goto('/');
    await page.locator(SK).scrollIntoViewIfNeeded();
  }

  /** The home page with motion on, at a given speed, scrolled so the first drawing is in view. */
  async function openMoving(page: Page, speed: number) {
    await isolate(page);
    await page.goto('/');
    await page.locator(SK).evaluate((el, value) => {
      (el as HTMLElement).dataset.speed = String(value);
    }, speed);
    await scene(page, 'tracker')
      .locator('svg[data-svg]')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  }

  test('shows one scene at a time, in Jimmy’s order, with Replay and Show all', async ({
    page,
  }) => {
    await openStill(page);
    await expect(page.locator(`${SK} .sk__sub`)).toHaveText(
      'Each scene shows where the data comes from, what the system builds from it, and who checks it.',
    );
    await expect(page.locator(`${SK} [data-scene-button]`)).toHaveText([
      'Desk, browser',
      'Dorm, laptop',
      'Dining hall, phone',
      'Classroom, puppet',
      'Street, flood',
    ]);
    // Grouped by what is observed, and the groups are named for a screen reader too.
    for (const [group, count] of [
      ['Learners', 3],
      ['Hands', 1],
      ['City', 1],
    ] as const)
      await expect(
        page.getByRole('group', { name: group, exact: true }).getByRole('button'),
      ).toHaveCount(count);
    await expect(page.getByRole('button', { name: 'Replay' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
    // A cue over the buttons names them, and the teacher scenes are a link away (D73).
    await expect(page.locator(`${SK} .sk__cue`)).toHaveText(/^Pick a scene/);
    await expect(
      page.getByRole('group', { name: 'Pick a scene', exact: true }).getByRole('button'),
    ).toHaveCount(5);
    const teachers = page.getByRole('group', { name: 'Teachers', exact: true });
    await expect(teachers.getByRole('button')).toHaveCount(0);
    await expect(
      teachers.getByRole('link', { name: 'Three scenes on their own page', exact: true }),
    ).toHaveAttribute('href', '/research/teacher-support/#scenes');
    // The open scene's button is filled in; the others look like buttons waiting to be pressed.
    const fill = (id: string) =>
      tab(page, id).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fill('tracker')).not.toBe(await fill('dorm'));
    expect(await fill('dorm')).not.toBe('rgba(0, 0, 0, 0)');
    for (const id of SCENES) {
      await tab(page, id).click();
      await expect(tab(page, id)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator(`${SK} [data-scene-button][aria-pressed="true"]`)).toHaveCount(1);
      await expect(page.locator(`${SK} .sk__scene:visible`)).toHaveCount(1);
      await expect(scene(page, id)).toBeVisible();
      await expect(scene(page, id).locator('svg[role="img"]')).toHaveAttribute(
        'aria-label',
        /^Line drawing: /,
      );
      // Every scene answers the subtitle's three questions.
      await expect(scene(page, id).locator('.sk__summary dt')).toHaveText([
        'Data from',
        'It builds',
        'Checked by',
      ]);
    }
    await expect(scene(page, 'tracker').locator('.sk__badge')).toHaveText('Prototype');
    await expect(scene(page, 'city').locator('.sk__badge')).toHaveText('Simulated');
    await expect(scene(page, 'dorm').locator('.sk__badge')).toHaveText('Synthetic sample');
  });

  test('the tracker scene: the answer to the pop-up labels the record, and shows no numbers', async ({
    page,
  }) => {
    await openStill(page);
    const tracker = scene(page, 'tracker');
    const label = shown(tracker.locator('.sk__entry--label'));
    await expect(tracker).toHaveAttribute('data-state', 'ready');
    await expect(label).toHaveText('no answer yet');
    await expect(tracker.locator('.sk__results')).toBeHidden();
    const no = tracker.getByRole('radio', { name: 'No' });
    await expect(
      tracker.getByRole('group', { name: 'Did you learn something in the last minute?' }),
    ).toBeVisible();
    // With the keyboard: focus the choice and press Space.
    await no.focus();
    await page.keyboard.press('Space');
    await expect(tracker).toHaveAttribute('data-state', 'done');
    await expect(label).toHaveText('No, I did not learn anything.');
    await expect(tracker.locator('.sk__results')).toBeVisible();
    // Said once: the answer, and the result it released.
    await expect(page.locator(`${SK} [data-live]`)).toHaveText(
      /^No, I did not learn anything\. The log shows what the learner did\./,
    );
    await tracker.getByRole('radio', { name: 'Yes' }).check();
    await expect(label).toHaveText('Yes, I learned something.');
    expect(await tracker.innerText()).not.toMatch(/\d/);
  });

  test('the dorm and dining-hall scenes: marking the interests shows the study’s numbers', async ({
    page,
  }) => {
    await openStill(page);
    await tab(page, 'dorm').click();
    const dorm = scene(page, 'dorm');
    await expect(dorm.locator('.sk__results')).toBeHidden();
    await expect(dorm.locator('.sk__locked')).toBeVisible();
    // Keyboard only: each interest is a pair of radio buttons named by the interest.
    const groups = ['bouldering', 'film photography', 'home espresso', 'car insurance'];
    for (const [index, name] of groups.entries()) {
      const choice = dorm
        .getByRole('group', { name, exact: true })
        .getByRole('radio', { name: index < 2 ? 'Confirm' : 'Reject' });
      await choice.focus();
      await page.keyboard.press('Space');
      await expect(choice).toBeChecked();
      // Results wait for the last mark.
      if (index < 3) await expect(dorm.locator('.sk__results')).toBeHidden();
    }
    await expect(dorm).toHaveAttribute('data-state', 'done');
    await expect(dorm.locator('[data-tally]')).toBeVisible();
    await expect(dorm.locator('[data-tally]')).toHaveText('You confirmed 2 of 4.');
    await expect(dorm.locator('.sk__results')).toBeVisible();
    await expect(dorm.locator('.sk__result')).toContainText(
      '69.8% of the interests extracted from browsing history were confirmed',
    );
    await expect(dorm.locator('.sk__locked')).toBeHidden();

    // The dining-hall scene keeps what the visitor confirmed, and notes the shared interest.
    await tab(page, 'dining').click();
    const dining = scene(page, 'dining');
    await expect(dining.locator('.sk__carried-title')).toHaveText(
      'Already in the learner model, from browsing history',
    );
    await expect(dining.locator('[data-carried-list] li')).toHaveText([
      'bouldering',
      'film photography',
    ]);
    await expect(dining.locator('[data-entry][data-name="bouldering"] [data-also]')).toBeVisible();
    await expect(dining.locator('.sk__after > .sk__results')).toBeHidden();
    for (const row of await dining.locator('.sk__marks').all())
      await row.getByRole('radio', { name: 'Confirm' }).check();
    await expect(dining.locator('[data-tally]')).toHaveText('You confirmed 4 of 4.');
    const results = dining.locator('.sk__after > .sk__results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('56.3% of the interests extracted from posts');
    await expect(results).toContainText('2.14 grounded units of information per confirmed');
    await expect(results).toContainText('compared with 1.58 for browsing history');
    // Both learner scenes done: what the two sources add together.
    await expect(dining.locator('.sk__result--both')).toBeVisible();
    await expect(dining.locator('.sk__result--both')).toContainText('38.2%');
  });

  test('the dining-hall scene alone does not show what the two sources add together', async ({
    page,
  }) => {
    await openStill(page);
    await tab(page, 'dining').click();
    const dining = scene(page, 'dining');
    await expect(dining.locator('[data-carried]')).toBeHidden();
    for (const row of await dining.locator('.sk__marks').all())
      await row.getByRole('radio', { name: 'Reject' }).check();
    await expect(dining).toHaveAttribute('data-state', 'done');
    await expect(dining.locator('.sk__after > .sk__results .sk__result').first()).toBeVisible();
    await expect(dining.locator('.sk__result--both')).toBeHidden();
    await expect(dining.locator('.sk__both .sk__locked')).toBeVisible();
  });

  test('the puppet scene: one tap turns the puppet and the character on the screen', async ({
    page,
  }) => {
    await openStill(page);
    await tab(page, 'puppet').click();
    const puppet = scene(page, 'puppet');
    const status = shown(puppet.locator('.sk__status'));
    await expect(puppet).toHaveAttribute('data-facing', 'right');
    await expect(status).toHaveText('The puppet faces right. The character on screen faces right.');
    await expect(puppet.locator('.sk__results')).toBeHidden();
    const transformOf = (part: string) =>
      puppet
        .locator(`[data-part="${part}"]`)
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
    expect(await transformOf('puppet')).toBe('none');
    const turn = puppet.getByRole('button', { name: 'Turn the puppet' });
    await turn.focus();
    await page.keyboard.press('Enter');
    await expect(puppet).toHaveAttribute('data-facing', 'left');
    // Mirrored about its own upright axis, the puppet and its character alike.
    for (const part of ['puppet', 'avatar'])
      expect(await transformOf(part), part).toMatch(/^matrix\(-1, 0, 0, 1, /);
    await expect(status).toHaveText(
      'The puppet faces left. The character on screen faces left too.',
    );
    await expect(puppet.locator('.sk__results')).toBeVisible();
    await expect(puppet.locator('.sk__results')).toContainText('through the IMU');
    await expect(page.locator(`${SK} [data-live]`)).toHaveText(
      /^The puppet faces left\. The character on screen faces left too\. The turn reaches the screen/,
    );
    // A tap on the character in the lens turns both back.
    await puppet.locator('rect.sk__hit').last().click();
    await expect(puppet).toHaveAttribute('data-facing', 'right');
    await expect(status).toHaveText('The puppet faces right. The character on screen faces right.');
  });

  test('the flood scene: switching channels off changes what the map cell shows', async ({
    page,
  }) => {
    await openStill(page);
    await tab(page, 'city').click();
    const city = scene(page, 'city');
    const status = shown(city.locator('.sk__status'));
    const sensor = city.getByRole('switch', { name: 'Official sensor' });
    const report = city.getByRole('switch', { name: 'Citizen report' });
    const post = city.getByRole('switch', { name: 'Social post' });
    await expect(sensor).toBeChecked();
    await expect(status).toHaveText(/^Confirmed\. All three channels/);
    await expect(city.locator('[data-part="cell"]').first()).toBeVisible();
    await expect(city.locator('[data-part="cell-tick"]')).toBeVisible();
    await expect(city.locator('.sk__results')).toBeHidden();
    const height = () => city.evaluate((el) => el.getBoundingClientRect().height);
    const before = await height();

    await sensor.focus();
    await page.keyboard.press('Space');
    await expect(sensor).not.toBeChecked();
    await expect(status).toHaveText(
      /^Verification quest\. Two channels agree\. Nearby residents get a one-tap verification quest/,
    );
    await expect(city.locator('svg[data-svg]')).toHaveAttribute('data-off', 'sensor');
    await expect(city.locator('[data-part="cell"]').first()).toBeHidden();
    await expect(city.locator('[data-part="cell-tick"]')).toBeHidden();
    await expect(city.locator('[data-part="cell-hatch"]').first()).toBeVisible();
    // A switched-off channel says so in the place of its description: the scene keeps its height.
    await expect(city.locator('[data-entry][data-off] .sk__off-note')).toBeVisible();
    await expect(city.locator('[data-entry][data-off] .sk__off-note')).toHaveText('switched off');
    await expect(city.locator('[data-entry][data-off] .sk__why')).toBeHidden();
    expect(await height()).toBe(before);
    // The step is done: the replay's numbers, all from facts.md §5.3.
    await expect(city.locator('.sk__results')).toBeVisible();
    await expect(city.locator('.sk__results')).toContainText('10.8 hours into a 30-hour');
    await expect(city.locator('.sk__results')).toContainText(
      'four confirmed cells and three open quests',
    );

    await report.uncheck();
    await expect(status).toHaveText(/^Not confirmed\. One channel alone/);
    await expect(city.locator('[data-part="cell-hatch"]').first()).toBeHidden();
    await post.uncheck();
    await expect(status).toHaveText(/^No data\./);
    expect(await height()).toBe(before);
    await sensor.check();
    await report.check();
    await post.check();
    await expect(status).toHaveText(/^Confirmed\./);
    await expect(city.locator('[data-part="cell-tick"]')).toBeVisible();
  });

  test('cites the paper under each scene that comes from one, linked to its DOI', async ({
    page,
  }) => {
    await openStill(page);
    const papers: Record<string, string | null> = {
      tracker: null,
      dorm: 'https://doi.org/10.1109/ICALT68022.2026.00023',
      dining: 'https://doi.org/10.1109/ICALT68022.2026.00023',
      puppet: 'https://doi.org/10.1007/978-3-030-77599-5_46',
      // No link has been found for the DTRUE 2026 extended abstract yet.
      city: '',
    };
    for (const [id, url] of Object.entries(papers)) {
      await tab(page, id).click();
      const reference = scene(page, id).locator('.sk__paper');
      if (url === null) {
        // The tracker is an unpublished prototype: no paper to cite.
        await expect(reference, id).toHaveCount(0);
        continue;
      }
      await expect(reference, id).toBeVisible();
      await expect(reference, id).toHaveText(/^Paper: Rao, N\., .*\(20\d\d\)\. .+\./);
      await expect(reference.locator('cite'), id).toHaveCount(1);
      if (url) {
        await expect(reference.getByRole('link'), id).toHaveAttribute('href', url);
        await expect(reference.getByRole('link'), id).toHaveText(url.replace('https://', ''));
      } else {
        await expect(reference.getByRole('link'), id).toHaveCount(0);
      }
    }
    const city = scene(page, 'city').locator('.sk__paper');
    await expect(city).toContainText('Proceedings: EPiC Series in Computing.');
    await expect(city.locator('.sk__award')).toHaveText('Best Paper Mention');
  });

  test('"Show all" shows results with sample answers, and Replay clears the step', async ({
    page,
  }) => {
    await openStill(page);
    await tab(page, 'dorm').click();
    const dorm = scene(page, 'dorm');
    await dorm.getByRole('group', { name: 'bouldering', exact: true }).getByLabel('Reject').check();
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(dorm).toHaveAttribute('data-state', 'done');
    // The visitor's own mark stays; the sample fills in the rest and says so.
    await expect(
      dorm.getByRole('group', { name: 'bouldering', exact: true }).getByLabel('Reject'),
    ).toBeChecked();
    await expect(
      dorm.getByRole('group', { name: 'car insurance', exact: true }).getByLabel('Reject'),
    ).toBeChecked();
    await expect(dorm.locator('.sk__sample-note')).toBeVisible();
    await expect(dorm.locator('[data-tally]')).toBeHidden();
    await expect(dorm.locator('.sk__results')).toBeVisible();
    await expect(dorm.locator('.sk__results')).toContainText('69.8%');
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(dorm).toHaveAttribute('data-state', 'ready');
    await expect(dorm.locator('input:checked')).toHaveCount(0);
    await expect(dorm.locator('.sk__results')).toBeHidden();
    await expect(dorm.locator('.sk__sample-note')).toBeHidden();
  });

  test('draws a scene stroke by stroke, caption by caption, and stops at "Show all"', async ({
    page,
  }) => {
    test.slow();
    await openMoving(page, 100);
    await expect(scene(page, 'tracker')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '3'));
    await tab(page, 'city').click();
    const city = scene(page, 'city');
    await expect(city).toHaveAttribute('data-state', 'playing');
    // Mid-drawing: some strokes are still to come, the pencil is on the paper, and only the
    // captions and rows reached so far are shown.
    expect(await undrawn(city)).toBeGreaterThan(5);
    await expect(city.locator('.sk__pen[data-on]')).toHaveCount(1);
    expect(await city.locator('.sk__steps li[data-on]').count()).toBeLessThan(7);
    await expect(city.locator('[data-entry][data-on]')).toHaveCount(0);
    await expect(city.locator('svg[data-svg]')).toHaveAttribute('data-count', '0');
    // One stroke per path, so the pencil and the line it draws stay together.
    expect(
      await city
        .locator('.sk__ink')
        .evaluateAll((paths) => paths.filter((p) => /M[^M]*M/.test(p.getAttribute('d') ?? ''))),
    ).toHaveLength(0);
    // The step, its status line and its results are out of reach while it draws.
    await expect(city.getByRole('switch', { name: 'Official sensor' })).toBeHidden();
    await expect(shown(city.locator('.sk__status'))).toHaveCount(0);
    await expect(city.locator('.sk__after .sk__locked')).toBeHidden();
    // Then the data arrives: cards on a wire, a first row, and the map cell starts to count.
    await expect(city.locator('.sk__card').first()).toBeAttached({ timeout: 20_000 });
    await expect(city.locator('[data-entry][data-on]')).toHaveCount(1, { timeout: 20_000 });
    await expect(city.locator('svg[data-svg]')).toHaveAttribute('data-count', '1');
    await expect(city.locator('[data-entry][data-on]')).toHaveCount(2, { timeout: 20_000 });
    await expect(city.locator('[data-part="cell-hatch"]').first()).toBeVisible();

    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '100'));
    await expect(city).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await expect(city.locator('.sk__steps li[data-on]')).toHaveCount(7);
    for (const caption of await city.locator('.sk__steps li').all())
      await expect(caption).toHaveCSS('opacity', '1');
    await expect(city.locator('[data-entry][data-on]')).toHaveCount(3);
    await expect(city.getByRole('switch', { name: 'Official sensor' })).toBeVisible();
    // With all three channels the cell is filled and ticked.
    await expect(city.locator('svg[data-svg]')).toHaveAttribute('data-count', '3');
    await expect(city.locator('[data-part="cell-tick"]')).toBeVisible();
    // No stroke is left hidden, and the pencil, the wire and the cards are gone.
    expect(await undrawn(city)).toBe(0);
    await expect(city.locator('.sk__pen')).toBeHidden();
    await expect(city.locator('.sk__wire, .sk__card')).toHaveCount(0);

    // Replay at normal speed, then stop it.
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '1'));
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(city).toHaveAttribute('data-state', 'playing');
    expect(await undrawn(city)).toBeGreaterThan(5);
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(city).toHaveAttribute('data-state', 'done');
    expect(await undrawn(city)).toBe(0);
    await expect(city.locator('.sk__results')).toBeVisible();
    await expect(city.locator('.sk__results')).toContainText('10.8 hours');
  });

  test('draws the first scene when its drawing is in view, once, and says nothing meanwhile', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '25'));
    const tracker = scene(page, 'tracker');
    const live = page.locator(`${SK} [data-live]`);
    // Waiting as blank paper: nothing has been drawn while it was out of view.
    await expect(tracker).toHaveAttribute('data-state', 'playing');
    await expect(tracker.locator('[data-step][data-on]')).toHaveCount(0);
    expect(await undrawn(tracker)).toBeGreaterThan(20);
    // The block's first line in view is not enough.
    await page.locator(`${SK} .sk__sub`).evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(400);
    await expect(tracker.locator('[data-step][data-on]')).toHaveCount(0);
    // Record everything the live region is ever given during the automatic drawing.
    await live.evaluate((el) => {
      const said: string[] = [];
      (window as unknown as { said: string[] }).said = said;
      new MutationObserver(() => {
        if (el.textContent) said.push(el.textContent);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await tracker.locator('svg[data-svg]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(tracker).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { said: string[] }).said)).toEqual([]);
    // Scrolling away and back does not draw it again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await tracker.locator('svg[data-svg]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await expect(tracker).toHaveAttribute('data-state', 'ready');
    expect(await undrawn(tracker)).toBe(0);
  });

  test('a scene that was opened keeps its state; a first scene left undrawn draws on return', async ({
    page,
  }) => {
    await openMoving(page, 100);
    const tracker = scene(page, 'tracker');
    await expect(tracker).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await tab(page, 'dorm').click();
    const dorm = scene(page, 'dorm');
    await expect(dorm).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    const mark = dorm.getByRole('group', { name: 'bouldering', exact: true }).getByLabel('Reject');
    await mark.check();
    await tab(page, 'tracker').click();
    await expect(tracker).toHaveAttribute('data-state', 'ready');
    await tab(page, 'dorm').click();
    // Back in the dorm scene: not drawn again, and the mark is still there.
    await expect(dorm).toHaveAttribute('data-state', 'ready');
    await expect(mark).toBeChecked();

    // On a fresh page, leave the first scene before it has drawn: it draws when picked again.
    await page.goto('/');
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '100'));
    await tab(page, 'puppet').click();
    await expect(scene(page, 'puppet')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '2'));
    await tab(page, 'tracker').click();
    await expect(scene(page, 'tracker')).toHaveAttribute('data-state', 'playing');
    expect(await undrawn(scene(page, 'tracker'))).toBeGreaterThan(10);
  });

  test('keeps the page still while each scene draws and when its results appear', async ({
    page,
  }) => {
    test.slow();
    await openMoving(page, 100);
    await expect(scene(page, 'tracker')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '8'));
    for (const id of ['dorm', 'dining', 'puppet', 'city']) {
      await tab(page, id).click();
      const active = scene(page, id);
      // Sampled on every frame of the drawing: the caption being drawn, the rows and the
      // cards must not change the height of the scene.
      const heights = await active.evaluate(
        (el) =>
          new Promise<number[]>((resolve) => {
            const seen = new Set<number>();
            const sample = () => {
              seen.add(Math.round(el.getBoundingClientRect().height * 10) / 10);
              if ((el as HTMLElement).dataset.state === 'playing') requestAnimationFrame(sample);
              else resolve([...seen]);
            };
            sample();
          }),
      );
      expect(heights, id).toHaveLength(1);
      await page.getByRole('button', { name: 'Show all' }).click();
      await expect(active).toHaveAttribute('data-state', 'done');
      expect(
        Math.round((await active.evaluate((el) => el.getBoundingClientRect().height)) * 10) / 10,
        `${id}, results shown`,
      ).toBe(heights[0]);
    }
  });

  test('a control used while its scene draws ends the drawing; Tab from "Show all" does too', async ({
    page,
  }) => {
    await openMoving(page, 100);
    await expect(scene(page, 'tracker')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    // Normal speed: the drawing takes many seconds, so the scene is still drawing below.
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '1'));
    await tab(page, 'dorm').click();
    const dorm = scene(page, 'dorm');
    await expect(dorm).toHaveAttribute('data-state', 'playing');
    await page.getByRole('button', { name: 'Show all' }).focus();
    await page.keyboard.press('Tab');
    await expect(dorm).toHaveAttribute('data-state', 'ready');
    // Focus is on the scene's first control, not somewhere down the page.
    await expect(
      dorm.getByRole('group', { name: 'bouldering', exact: true }).getByRole('radio').first(),
    ).toBeFocused();

    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(dorm).toHaveAttribute('data-state', 'playing');
    // Replay starts from blank paper: no wire or card left from the drawing it interrupts.
    await expect(dorm.locator('.sk__wire, .sk__card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(dorm).toHaveAttribute('data-state', 'done');
  });

  test('after Back, the controls show what the scenes hold', async ({ page }) => {
    await openStill(page);
    await tab(page, 'dorm').click();
    const dorm = scene(page, 'dorm');
    for (const row of await dorm.locator('.sk__marks').all())
      await row.getByRole('radio', { name: 'Confirm' }).check();
    await expect(dorm).toHaveAttribute('data-state', 'done');
    await page.goto('/about/');
    await page.goBack();
    await page.locator(SK).scrollIntoViewIfNeeded();
    await tab(page, 'dorm').click();
    const state = await dorm.getAttribute('data-state');
    const checked = await dorm.locator('input:checked').count();
    // Either the page came back as it was, or it started over: never marks without their results.
    expect([state, checked]).toEqual(state === 'done' ? ['done', 4] : ['ready', 0]);
  });

  test('without JavaScript, all five scenes are there, finished, with sample answers', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator(`${SK} .sk__scene:visible`)).toHaveCount(5);
    await expect(page.locator(`${SK} .sk__heading`)).toHaveText([
      'Clicks, scrolls, searches and gaze in a browser',
      'Browsing history on a dorm laptop',
      'Social-media posts on a phone',
      'A puppet tracked by a camera and a motion sensor',
      'A flooded street, seen through three channels',
    ]);
    // The scene buttons could do nothing: only the link to the teacher scenes stays.
    await expect(page.locator(`${SK} [data-scene-button]:visible`)).toHaveCount(0);
    await expect(page.locator(`${SK} .sk__cue`)).toBeHidden();
    await expect(page.locator(`${SK} .sk__ctl`)).toBeHidden();
    await expect(page.locator(`${SK} .sk__jump`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn the puppet' })).toBeHidden();
    await expect(page.locator(`${SK} .sk__locked:visible`)).toHaveCount(0);
    for (const id of SCENES) {
      const active = scene(page, id);
      // Finished drawings, by what the browser renders: every line fully drawn, every fill in.
      expect(await active.locator('.sk__ink').count(), id).toBeGreaterThan(10);
      expect(await undrawn(active), id).toBe(0);
      for (const fill of await active.locator('.sk__fill:visible').all())
        await expect(fill).toHaveCSS('opacity', '1');
      // Every caption is shown.
      const captions = await active.locator('.sk__steps li').all();
      expect(captions.length, id).toBeGreaterThanOrEqual(6);
      for (const caption of captions) {
        await expect(caption).toBeVisible();
        await expect(caption).toHaveCSS('opacity', '1');
      }
      // The results are plain content.
      await expect(active.locator('.sk__after > .sk__results')).toBeVisible();
    }
    await expect(scene(page, 'dorm').locator('.sk__results')).toContainText('69.8%');
    await expect(scene(page, 'dining').locator('.sk__results')).toContainText('56.3%');
    await expect(scene(page, 'dining').locator('.sk__result--both')).toBeVisible();
    await expect(scene(page, 'dining').locator('.sk__result--both')).toContainText('38.2%');
    await expect(scene(page, 'city').locator('.sk__results')).toContainText('10.8 hours');
    // Sample answers, which cannot be changed, and a line that says they are samples.
    await expect(scene(page, 'dorm').locator('.sk__sample-note')).toBeVisible();
    await expect(scene(page, 'dorm').locator('input:checked')).toHaveCount(4);
    await expect(scene(page, 'dorm').locator('input:enabled')).toHaveCount(0);
    await expect(shown(scene(page, 'tracker').locator('.sk__entry--label'))).toHaveText(
      'Yes, I learned something.',
    );
    await expect(shown(scene(page, 'puppet').locator('.sk__status'))).toHaveText(
      'The puppet faces right. The character on screen faces right.',
    );
    await expect(shown(scene(page, 'city').locator('.sk__status'))).toHaveText(/^Confirmed\./);
    await expect(scene(page, 'city').locator('[data-part="cell-tick"]')).toBeVisible();
    // Switches that could not be used are not shown.
    await expect(scene(page, 'city').locator('.sk__switch:visible')).toHaveCount(0);
    await context.close();
  });

  test('falls back to the finished scenes if its script never starts, and stays there', async ({
    page,
  }) => {
    test.slow();
    await isolate(page);
    await page.route(/SketchScenes.*\.js$/, (route) => route.abort());
    await page.goto('/');
    await expect(page.locator(SK)).toHaveAttribute('data-failed', '', { timeout: 8_000 });
    await expect(page.locator(`${SK} .sk__scene:visible`)).toHaveCount(5);
    await expect(page.locator(`${SK} [data-scene-button]:visible`)).toHaveCount(0);
    await expect(page.locator(`${SK} .sk__ctl`)).toBeHidden();
    await expect(page.locator(`${SK} .sk__jump`)).toBeVisible();
    await expect(scene(page, 'dining').locator('.sk__after > .sk__results')).toBeVisible();
    await expect(scene(page, 'dining').locator('.sk__results')).toContainText('56.3%');
  });

  test('has no accessibility violations in any scene, light or dark, mid-step or finished', async ({
    page,
  }) => {
    test.slow();
    for (const colorScheme of ['light', 'dark'] as const) {
      // A fresh page for each theme, so every scene is scanned before and after its step.
      await openStill(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const id of SCENES) {
        await tab(page, id).click();
        for (const finished of [false, true]) {
          if (finished) await page.getByRole('button', { name: 'Show all' }).click();
          await expect(scene(page, id)).toHaveAttribute('data-state', finished ? 'done' : 'ready');
          const results = await new AxeBuilder({ page })
            .include('#learners-and-teachers .sk')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
            `${id}, ${colorScheme}, ${finished ? 'finished' : 'ready'}`,
          ).toEqual([]);
        }
      }
    }
  });

  test('every control is a target of at least 24 px and shows where the focus is', async ({
    page,
  }) => {
    await openStill(page);
    for (const id of SCENES) {
      await tab(page, id).click();
      // The link in a scene's reference is part of a sentence: WCAG 2.5.8 leaves it out.
      const controls = page.locator(
        `${SK} .sk__bar :is(button, a), ${SK} [data-scene="${id}"] :is(button, input)`,
      );
      for (const control of await controls.all()) {
        const box = (await control.boundingBox())!;
        expect(
          Math.min(box.width, box.height),
          `${id}: ${await control.evaluate((el) => el.outerHTML.slice(0, 80))}`,
        ).toBeGreaterThanOrEqual(24);
      }
    }
    // A drawn face shows the focus ring of the input that lies over it.
    // Tab order: the scene buttons, Replay, Show all, then the open scene's first control.
    await tab(page, 'dorm').click();
    await page.getByRole('button', { name: 'Show all' }).focus();
    await page.keyboard.press('Tab');
    const focused = page.locator(`${SK} [data-scene="dorm"] input:focus`);
    await expect(focused).toHaveCount(1);
    expect(
      await focused.evaluate((el) => getComputedStyle(el.nextElementSibling!).outlineStyle),
    ).toBe('solid');
  });

  test('fits a 375 px phone and wider screens in every scene, with and without JavaScript', async ({
    page,
    browser,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await isolate(page);
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      for (const id of SCENES) {
        await tab(page, id).click();
        await page.getByRole('button', { name: 'Show all' }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${id} at ${width}px`,
        ).toBeLessThanOrEqual(width);
      }
    }
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 375, height: 800 },
    });
    const plain = await context.newPage();
    await plain.goto('/');
    expect(await plain.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    await context.close();
  });

  test('on a phone held upright the drawing stays in view while its control is used', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openStill(page);
    await tab(page, 'puppet').click();
    const puppet = scene(page, 'puppet');
    const turn = puppet.getByRole('button', { name: 'Turn the puppet' });
    await turn.scrollIntoViewIfNeeded();
    await turn.click();
    await expect(puppet).toHaveAttribute('data-facing', 'left');
    // The button and the whole drawing are in the window together.
    await expect(turn).toBeInViewport();
    await expect(puppet.locator('svg[data-svg]')).toBeInViewport({ ratio: 1 });
    // A wide window has the panel beside the drawing, and nothing is pinned.
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await puppet.locator('.sk__board').evaluate((el) => getComputedStyle(el).position)).toBe(
      'static',
    );
  });

  test('loads under 50 KB of JavaScript on the home page, and no framework runtime', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    const sources = await page
      .locator('script[src]')
      .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')!));
    expect(sources.length).toBeGreaterThan(0);
    let total = 0;
    for (const src of sources) {
      const file = readFileSync(new URL(`../../dist${src}`, import.meta.url));
      total += gzipSync(file).length;
      // Modules the scripts import are part of what the page loads.
      for (const [, name] of file.toString().matchAll(/from\s*"\.\/([^"]+\.js)"/g))
        total += gzipSync(
          readFileSync(new URL(`../../dist/_astro/${name}`, import.meta.url)),
        ).length;
    }
    expect(total).toBeLessThan(50_000);
    // React's client runtime alone is larger than that (D68): the home page must not load it.
    expect(sources.join(' ')).not.toMatch(/client\.[\w-]+\.js/);
  });
});

test.describe('teacher scenes on the teacher support page (D73)', () => {
  const PATH = '/research/teacher-support/';
  const SK = '#scenes .sk';
  const SCENES = ['views', 'pris', 'context'];
  const scene = (page: Page, id: string) => page.locator(`${SK} [data-scene="${id}"]`);
  const tab = (page: Page, id: string) => page.locator(`${SK} [data-scene-button="${id}"]`);
  const shown = (scope: Locator) => scope.locator('.sk__when:visible');
  const undrawn = (scope: Locator) =>
    scope
      .locator('.sk__ink')
      .evaluateAll(
        (paths) => paths.filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset) > 0).length,
      );
  /** The options whose parts the drawing shows, by what the browser renders. */
  const pictured = (scope: Locator) =>
    scope.locator('svg [data-part^="pick-"]').evaluateAll((parts) => [
      ...new Set(
        parts
          .filter((part) => {
            const style = getComputedStyle(part);
            return style.visibility !== 'hidden' && style.opacity !== '0';
          })
          .map((part) => part.getAttribute('data-part')),
      ),
    ]);
  /** Every option of a scene: its value, the radio's name and the outcome it shows. */
  const options = (scope: Locator) =>
    scope.locator('.sk__pick input').evaluateAll((inputs) =>
      inputs.map((input) => ({
        value: (input as HTMLInputElement).value,
        name: input.nextElementSibling!.textContent!.trim(),
        sample: input.hasAttribute('data-sample'),
        outcome: input
          .closest('[data-scene]')!
          .querySelector(`.sk__status [data-when="${(input as HTMLInputElement).value}"]`)!
          .textContent!.trim(),
      })),
    );

  async function openStill(page: Page) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await isolate(page);
    await page.goto(PATH);
    await page.locator(SK).scrollIntoViewIfNeeded();
  }

  test('sit after the page text and before its publications, and link back to the home scenes', async ({
    page,
  }) => {
    await openStill(page);
    await expect(page.locator('main h2')).toHaveText(['One scene per paper', 'Publications']);
    await expect(page.locator(`${SK} .sk__cue`)).toHaveText(/^Pick a scene/);
    await expect(page.locator(`${SK} [data-scene-button]`)).toHaveText([
      'Classroom, tablet',
      'Classroom, Kinect',
      'Staff room, focus group',
    ]);
    await expect(
      page.getByRole('group', { name: 'Teachers', exact: true }).getByRole('button'),
    ).toHaveCount(3);
    const back = page
      .getByRole('group', { name: 'Learners, hands, city', exact: true })
      .getByRole('link', { name: 'Five scenes on the home page', exact: true });
    await expect(back).toHaveAttribute('href', '/#learners-and-teachers');
    for (const id of SCENES) {
      await tab(page, id).click();
      await expect(tab(page, id)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator(`${SK} .sk__scene:visible`)).toHaveCount(1);
      await expect(scene(page, id).locator('.sk__badge')).toHaveText('Synthetic sample');
      await expect(scene(page, id).locator('.sk__summary dt')).toHaveText([
        'Data from',
        'It builds',
        'Checked by',
      ]);
      await expect(scene(page, id).locator('.sk__source')).toContainText('made up');
    }
    await back.click();
    await expect(page).toHaveURL(/\/#learners-and-teachers$/);
    await expect(page.locator('#learners-and-teachers .sk [data-scene-button]')).toHaveCount(5);
    // And from the home page's row of buttons to this page's scenes.
    await page.getByRole('link', { name: 'Three scenes on their own page', exact: true }).click();
    await expect(page).toHaveURL(/\/research\/teacher-support\/#scenes$/);
    await expect(page.locator(SK)).toBeVisible();
  });

  test('cites each scene’s paper with its DOI, and only ICALT 2021’s recognition', async ({
    page,
  }) => {
    await openStill(page);
    const dois: Record<string, string> = {
      views: 'https://doi.org/10.1109/ICALT52272.2021.00011',
      pris: 'https://doi.org/10.1007/978-3-031-19682-9_25',
      context: 'https://doi.org/10.1109/ICALT58122.2023.00027',
    };
    for (const [id, url] of Object.entries(dois)) {
      await tab(page, id).click();
      const reference = scene(page, id).locator('.sk__paper');
      await expect(reference).toHaveText(/^Paper: Rao, N\., .*\(20\d\d\)\. .+\./);
      await expect(reference.getByRole('link')).toHaveAttribute('href', url);
    }
    await expect(scene(page, 'views').locator('.sk__award')).toHaveText(
      'Best Short Paper Nomination',
    );
    for (const id of ['pris', 'context'])
      await expect(scene(page, id).locator('.sk__award')).toHaveCount(0);
    expect(await page.locator(SK).innerText()).not.toMatch(/best paper|award/i);
  });

  test('each pick changes the drawing and the outcome, and the first one opens the results', async ({
    page,
  }) => {
    await openStill(page);
    for (const id of SCENES) {
      await tab(page, id).click();
      const active = scene(page, id);
      await expect(active).toHaveAttribute('data-state', 'ready');
      // Nothing picked yet: no option in the drawing, no outcome, results waiting.
      await expect(active.locator('.sk__pick input:checked')).toHaveCount(0);
      expect(await pictured(active), id).toEqual([]);
      await expect(shown(active.locator('.sk__status'))).toHaveCount(0);
      await expect(active.locator('.sk__results')).toBeHidden();
      await expect(active.locator('.sk__after .sk__locked')).toBeVisible();
      const all = await options(active);
      expect(all.length, id).toBe(3);
      for (const [index, option] of all.entries()) {
        const radio = active.getByRole('radio', { name: option.name, exact: true });
        if (index === 0) {
          // With the keyboard: focus the option and press Space.
          await radio.focus();
          await page.keyboard.press('Space');
        } else await radio.check();
        await expect(radio).toBeChecked();
        await expect(active).toHaveAttribute('data-state', 'done');
        expect(await pictured(active), `${id}: ${option.value}`).toEqual([`pick-${option.value}`]);
        await expect(shown(active.locator('.sk__status'))).toHaveText(option.outcome);
        await expect(active.locator('.sk__results')).toBeVisible();
        if (index === 0) {
          // Said once: the outcome, then the results it released.
          const live = page.locator(`${SK} [data-live]`);
          await expect(live).toContainText(option.outcome);
          await expect(live).toContainText(await active.locator('.sk__result').first().innerText());
        }
      }
    }
  });

  test('"Show all" picks the sample and says so; Replay clears the pick', async ({ page }) => {
    await openStill(page);
    for (const id of SCENES) {
      await tab(page, id).click();
      const active = scene(page, id);
      const sample = (await options(active)).find((option) => option.sample)!;
      await page.getByRole('button', { name: 'Show all' }).click();
      await expect(active).toHaveAttribute('data-state', 'done');
      await expect(active.getByRole('radio', { name: sample.name, exact: true })).toBeChecked();
      expect(await pictured(active), id).toEqual([`pick-${sample.value}`]);
      await expect(shown(active.locator('.sk__status'))).toHaveText(sample.outcome);
      await expect(active.locator('.sk__sample-note')).toBeVisible();
      await page.getByRole('button', { name: 'Replay' }).click();
      await expect(active).toHaveAttribute('data-state', 'ready');
      await expect(active.locator('input:checked')).toHaveCount(0);
      expect(await pictured(active), id).toEqual([]);
      await expect(active.locator('.sk__sample-note')).toBeHidden();
    }
  });

  test('draws each scene without the options, then shows only the one picked', async ({ page }) => {
    test.slow();
    await isolate(page);
    await page.goto(PATH);
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '100'));
    await scene(page, 'views')
      .locator('svg[data-svg]')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(scene(page, 'views')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    for (const id of SCENES) {
      await tab(page, id).click();
      const active = scene(page, id);
      await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '4'));
      if (id === 'views') await page.getByRole('button', { name: 'Replay' }).click();
      await expect(active).toHaveAttribute('data-state', 'playing');
      // While it draws, the pencil never traces an option: none is picked.
      const seen = await active.evaluate(
        (el) =>
          new Promise<string[]>((resolve) => {
            const found = new Set<string>();
            const sample = () => {
              for (const part of el.querySelectorAll('svg [data-part^="pick-"]')) {
                const style = getComputedStyle(part);
                if (style.visibility !== 'hidden' && style.opacity !== '0')
                  found.add(part.getAttribute('data-part')!);
              }
              if ((el as HTMLElement).dataset.state === 'playing') requestAnimationFrame(sample);
              else resolve([...found]);
            };
            sample();
          }),
      );
      expect(seen, id).toEqual([]);
      await expect(active).toHaveAttribute('data-state', 'ready');
      expect(await undrawn(active), id).toBe(0);
      const last = (await options(active)).at(-1)!;
      await active.getByRole('radio', { name: last.name, exact: true }).check();
      await expect.poll(() => pictured(active), { message: id }).toEqual([`pick-${last.value}`]);
    }
  });

  test('keeps the page still while each scene draws and when its results appear', async ({
    page,
  }) => {
    test.slow();
    await isolate(page);
    await page.goto(PATH);
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '100'));
    await scene(page, 'views')
      .locator('svg[data-svg]')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(scene(page, 'views')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.locator(SK).evaluate((el) => ((el as HTMLElement).dataset.speed = '8'));
    for (const id of SCENES) {
      await tab(page, id).click();
      if (id === 'views') await page.getByRole('button', { name: 'Replay' }).click();
      const active = scene(page, id);
      const heights = await active.evaluate(
        (el) =>
          new Promise<number[]>((resolve) => {
            const seen = new Set<number>();
            const sample = () => {
              seen.add(Math.round(el.getBoundingClientRect().height * 10) / 10);
              if ((el as HTMLElement).dataset.state === 'playing') requestAnimationFrame(sample);
              else resolve([...seen]);
            };
            sample();
          }),
      );
      expect(heights, id).toHaveLength(1);
      for (const option of await options(active)) {
        await active.getByRole('radio', { name: option.name, exact: true }).check();
        await expect(active).toHaveAttribute('data-state', 'done');
        expect(
          Math.round((await active.evaluate((el) => el.getBoundingClientRect().height)) * 10) / 10,
          `${id}: ${option.value}`,
        ).toBe(heights[0]);
      }
    }
  });

  test('without JavaScript, the three scenes are there, finished, with the sample picked', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PATH);
    await expect(page.locator(`${SK} .sk__scene:visible`)).toHaveCount(3);
    await expect(page.locator(`${SK} [data-scene-button]:visible`)).toHaveCount(0);
    await expect(page.locator(`${SK} .sk__jump`)).toBeVisible();
    for (const id of SCENES) {
      const active = scene(page, id);
      expect(await undrawn(active), id).toBe(0);
      const sample = (await options(active)).find((option) => option.sample)!;
      await expect(active.getByRole('radio', { name: sample.name, exact: true })).toBeChecked();
      await expect(active.locator('input:enabled')).toHaveCount(0);
      expect(await pictured(active), id).toEqual([`pick-${sample.value}`]);
      await expect(shown(active.locator('.sk__status'))).toHaveText(sample.outcome);
      await expect(active.locator('.sk__sample-note')).toBeVisible();
      await expect(active.locator('.sk__after > .sk__results')).toBeVisible();
      await expect(active.locator('.sk__paper')).toBeVisible();
    }
    await context.close();
  });

  test('has no accessibility violations in any scene, light or dark, before and after a pick', async ({
    page,
  }) => {
    test.slow();
    for (const colorScheme of ['light', 'dark'] as const) {
      await openStill(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const id of SCENES) {
        await tab(page, id).click();
        for (const finished of [false, true]) {
          if (finished) await page.getByRole('button', { name: 'Show all' }).click();
          await expect(scene(page, id)).toHaveAttribute('data-state', finished ? 'done' : 'ready');
          const results = await new AxeBuilder({ page })
            .include(SK)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
            `${id}, ${colorScheme}, ${finished ? 'finished' : 'ready'}`,
          ).toEqual([]);
        }
      }
    }
  });

  test('every control is a target of at least 24 px, at every width, with no sideways scroll', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await isolate(page);
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PATH);
      for (const id of SCENES) {
        await tab(page, id).click();
        const controls = page.locator(
          `${SK} .sk__bar :is(button, a), ${SK} [data-scene="${id}"] :is(button, input)`,
        );
        for (const control of await controls.all()) {
          const box = (await control.boundingBox())!;
          expect(
            Math.min(box.width, box.height),
            `${id} at ${width}px: ${await control.evaluate((el) => el.outerHTML.slice(0, 80))}`,
          ).toBeGreaterThanOrEqual(24);
        }
        await page.getByRole('button', { name: 'Show all' }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${id} at ${width}px`,
        ).toBeLessThanOrEqual(width);
      }
    }
  });

  test('loads under 50 KB of JavaScript, and no framework runtime', async ({ page }) => {
    await isolate(page);
    await page.goto(PATH);
    const sources = await page
      .locator('script[src]')
      .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')!));
    let total = 0;
    for (const src of sources) {
      const file = readFileSync(new URL(`../../dist${src}`, import.meta.url));
      total += gzipSync(file).length;
      for (const [, name] of file.toString().matchAll(/from\s*"\.\/([^"]+\.js)"/g))
        total += gzipSync(
          readFileSync(new URL(`../../dist/_astro/${name}`, import.meta.url)),
        ).length;
    }
    expect(total).toBeLessThan(50_000);
    expect(sources.join(' ')).not.toMatch(/client\.[\w-]+\.js/);
  });
});

test.describe('the ongoing class study (D69)', () => {
  const PATH = '/research/data-analysis-through-ai/';
  const TITLE =
    'Analyzing data through an AI assistant without a programming background: a first-person study of one course';

  test('is a research page marked ongoing, with Jimmy’s sections and no card sentence on top', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto(PATH);
    await expect(page.locator('.breadcrumb')).toHaveText('Research · Ongoing');
    await expect(page.locator('h1')).toHaveText(TITLE);
    await expect(page.locator('main .lede')).toHaveCount(0);
    await expect(page.locator('main .prose > p').first()).toHaveText(
      'Status: ongoing since November 2026. This page describes the design of the study. It holds no data and no results, and it does not say who takes part.',
    );
    await expect(page.locator('main .prose h2')).toHaveText([
      'In short',
      'Why I started it',
      'The course',
      'What I ask',
      'How the study works',
      'How the students are protected',
      'What this study can and cannot show',
      'What may be new',
      'Work I build on (selected)',
      'Timeline',
      'How this connects to my other work',
      'How AI is used in this research',
      'Team',
      'Contact',
    ]);
    // Every reference links to its DOI or its arXiv page.
    const references = page.locator('main .prose a[href^="https://"]');
    await expect(references).toHaveCount(14);
    for (const href of await references.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')!),
    ))
      expect(href).toMatch(/^https:\/\/(?:doi\.org\/10\.\d{4}\/|arxiv\.org\/abs\/\d{4}\.\d{5}$)/);
  });

  test('names nobody and no course in what a visitor reads', async ({ page }) => {
    await isolate(page);
    for (const path of [PATH, '/', '/research/', '/cv/']) {
      await page.goto(path);
      // The Daily notes card repeats Jimmy's newest note: notes.test.ts checks each of its lines,
      // and a line he cleared there (CLEARED_LINES) must not fail here (D71).
      await page
        .locator('section[aria-labelledby="daily-notes"]')
        .evaluateAll((cards) => cards.forEach((card) => card.remove()));
      const text = await page.locator('main').innerText();
      if (path === PATH) {
        // Three letters and four digits, however written, are a course number; a venue with
        // its year ("CHI 2025") is not. The unit tests hold the sources to the same patterns.
        const prose = text.replace(/\b(?:CHI|ICER) 20\d{2}\b/g, '');
        expect(prose).not.toMatch(
          /(?<![A-Za-z])[A-Za-z]{3}[\s-]*(?!(?:19|20)\d{2}(?!\d))\d{4}[A-Za-z]?(?![A-Za-z\d])/,
        );
        expect(prose).not.toMatch(/(?<![A-Za-z])[A-Z]{3}[\s-]*\d{4}[A-Za-z]?(?![A-Za-z\d])/);
        expect(text).not.toMatch(/\b(?:Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\.?\s+\p{Lu}/u);
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
        expect(text).not.toMatch(/\bIRB/);
        expect(text).toContain('it does not say who takes part');
      }
      // A review-board or protocol number, on any page that lists the study. (The CV page
      // names "IRB protocols" as a skill, without a number.)
      expect(text, path).not.toMatch(/\bIRB[\s#:-]*\d|\bprotocol\s+\S*\d/);
    }
  });

  test('is listed under "Ongoing" on the research overview, the home page and the CV page', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/research/');
    await expect(page.locator('main h2')).toHaveText(['Personal', 'Embodied', 'Civic', 'Ongoing']);
    const card = page.locator('section[aria-labelledby="context-ongoing"] .card');
    await expect(card).toHaveCount(1);
    await expect(card.locator('a')).toHaveText(TITLE);
    await expect(card.locator('a')).toHaveAttribute('href', PATH);
    await expect(card.locator('p')).toHaveText(
      'An ongoing first-person study of one university course in which students without programming experience do data mining through an AI assistant.',
    );

    await page.goto('/');
    const research = page.locator('section[aria-labelledby="research-heading"]');
    await expect(research.locator('h3')).toHaveText(['Personal', 'Embodied', 'Civic', 'Ongoing']);
    await expect(research.locator('section[aria-labelledby="context-ongoing"] a')).toHaveAttribute(
      'href',
      PATH,
    );
    // Recent: the study's start is one of the three news items, with a link to the page.
    await expect(page.locator('.news__item')).toHaveCount(3);
    const started = page.locator('.news__item', { has: page.locator(`a[href="${PATH}"]`) });
    await expect(started).toHaveCount(1);
    await expect(started).toContainText('Started a first-person study of one university course');

    await page.goto('/cv/');
    await expect(
      page.locator('section[aria-labelledby="cv-research"] li', { hasText: TITLE }),
    ).toHaveText(`${TITLE} (ongoing)`);
  });

  test('keeps its four-column table inside a frame that scrolls, shows it and takes focus', async ({
    page,
  }) => {
    await isolate(page);
    for (const width of [320, 360, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PATH);
      const frame = page.getByRole('region', {
        name: 'What each position sees, does not see and writes',
      });
      await expect(frame.locator('thead th[scope="col"]')).toHaveText([
        'Position',
        'Sees',
        'Does not see',
        'Writes',
      ]);
      // Each position is the header of its row.
      await expect(frame.locator('tbody th[scope="row"]')).toHaveText([
        'Student now (those who choose to join)',
        'Former student, now analyst (I)',
        'Teaching assistant',
        'Designer and instructor',
      ]);
      await expect(frame.locator('tbody td')).toHaveCount(12);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${width}px`,
      ).toBeLessThanOrEqual(width);
      const shade = await frame.evaluate((el) => getComputedStyle(el).backgroundImage);
      if (width < 700) {
        // Narrower than the table: the frame scrolls, an edge shadow says so, and the keyboard
        // can reach it.
        expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        expect(shade, `${width}px`).toContain('linear-gradient');
        await frame.focus();
        await expect(frame).toBeFocused();
        expect(await frame.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
      } else {
        expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
        expect(shade).toBe('none');
      }
    }
  });

  test('prints its table whole', async ({ page }) => {
    await isolate(page);
    // A Letter page with one-inch margins leaves 6.5 inches: 624 px, narrower than the table's
    // width on a screen. Paper cannot scroll, so the table has to fit there.
    await page.setViewportSize({ width: 624, height: 900 });
    await page.goto(PATH);
    const frame = page.getByRole('region', {
      name: 'What each position sees, does not see and writes',
    });
    const fits = () =>
      frame.locator('table').evaluate((el) => {
        const frame = el.parentElement!;
        return el.getBoundingClientRect().right <= frame.getBoundingClientRect().right + 1;
      });
    expect(await fits(), 'on a screen this narrow the frame scrolls').toBe(false);
    await page.emulateMedia({ media: 'print' });
    expect(await fits(), 'on paper').toBe(true);
    expect(await frame.evaluate((el) => getComputedStyle(el).overflowX)).toBe('visible');
    expect(await frame.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
  });
});

test.describe('who and where in the intro strip (D64)', () => {
  test('shows the Chinese name as text marked zh-CN on the homepage, /about and /cv', async ({
    page,
  }) => {
    await isolate(page);
    for (const path of ['/', '/about/', '/cv/']) {
      await page.goto(path);
      await expect(page.locator('main span[lang="zh-CN"]', { hasText: '饶楠杰' })).toHaveCount(1);
    }
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Nanjie (Jimmy) Rao 饶楠杰');
    // The spacing around the name is checked as text: the link checks don't look at <span>.
    await page.goto('/cv/');
    await expect(page.locator('.cv-header .lede')).toHaveText('Nanjie (Jimmy) Rao 饶楠杰');
    await page.goto('/about/');
    const sentence = page.locator('.about .prose p').first();
    await expect(sentence).toContainText('Nanjie (Jimmy) Rao (饶楠杰); my papers');
    // In running text the name keeps the size of the text around it.
    const sizes = await sentence.evaluate((p) => [
      getComputedStyle(p).fontSize,
      getComputedStyle(p.querySelector('span[lang="zh-CN"]')!).fontSize,
    ]);
    expect(sizes[1]).toBe(sizes[0]);
  });

  test('puts the photo beside the name on a phone and beside the text on a desktop', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/');
    await expect(page.locator('.intro__photo')).toHaveAttribute('alt', /^Nanjie \(Jimmy\) Rao, /);
    await expect(page.locator('.intro__role a')).toHaveCount(2);
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const photo = await box('.intro__photo');
    const name = await box('#intro-name');
    const line = await box('.intro__line');
    const width = page.viewportSize()!.width;
    if (width < 768) {
      expect(photo.x + photo.width).toBeLessThanOrEqual(name.x);
      expect(line.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    } else {
      expect(photo.x).toBeGreaterThanOrEqual(line.x + line.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    // SITE_PLAN §4: the top of the cloud shows in the first screen.
    expect((await box('[data-wordcloud]')).y).toBeLessThan(page.viewportSize()!.height);
  });
});

test.describe('homepage word cloud', () => {
  const words = (
    parseYaml(readFileSync(new URL('../../content/wordcloud.yaml', import.meta.url), 'utf8')) as {
      words: Array<{ text: string; blurb?: string }>;
    }
  ).words;

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 800, height: 900 },
  ]) {
    test(`packs every word inside the cloud at ${viewport.width} px`, async ({ page }) => {
      await isolate(page);
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('[data-wordcloud]')).toHaveClass(/is-cloud/);
      const { box, rects } = await page.evaluate(() => {
        const cloud = document.querySelector('[data-cloud]')!.getBoundingClientRect();
        return {
          box: { x: cloud.x, y: cloud.y, right: cloud.right, bottom: cloud.bottom },
          rects: [...document.querySelectorAll('.wc__word a')].map((link) => {
            const r = link.getBoundingClientRect();
            return { text: link.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
          }),
        };
      });
      expect(rects).toHaveLength(words.length);
      for (const r of rects) {
        expect(r.w, r.text).toBeGreaterThan(0);
        expect(r.x, r.text).toBeGreaterThanOrEqual(box.x - 1);
        expect(r.y, r.text).toBeGreaterThanOrEqual(box.y - 1);
        expect(r.x + r.w, r.text).toBeLessThanOrEqual(box.right + 1);
        expect(r.y + r.h, r.text).toBeLessThanOrEqual(box.bottom + 1);
      }
      // d3-cloud packs glyphs, so link boxes may touch where ascenders and descenders sit, but
      // every word can still be pointed at: the middle of each word hits that word.
      const hits = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('.wc__word a')].map((link) => {
          link.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = link.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { text: link.textContent ?? '', ok: Boolean(hit && link.contains(hit)) };
        }),
      );
      for (const { text, ok } of hits) expect(ok, text).toBe(true);
    });
  }

  test('keeps three lists of 24 px targets on a phone', async ({ page }) => {
    await isolate(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-wordcloud]')).not.toHaveClass(/is-cloud/);
    await expect(page.locator('.wc__group-title').first()).toBeVisible();
    for (const link of await page.locator('.wc__word a').all()) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test('shows the blurb on focus and gives it to screen readers', async ({ page }) => {
    await isolate(page);
    await page.goto('/');
    const word = words.find((w) => w.text === 'grounded vs. inferred')!;
    const link = page.getByRole('link', { name: word.text, exact: true });
    await expect(link).toHaveAccessibleDescription(word.blurb!);
    await link.focus();
    await expect(page.locator('[data-detail]')).toContainText(word.blurb!);
    await link.blur();
    await expect(page.locator('[data-detail]')).toContainText('Point at or focus a word');
  });

  test('is three headed lists of links without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.wc__group-title')).toHaveText([
      'Research',
      'Building and sensing',
      'Teaching and life',
    ]);
    await expect(page.locator('.wc__word a')).toHaveCount(words.length);
    for (const title of await page.locator('.wc__group-title').all())
      await expect(title).toBeVisible();
    await context.close();
  });
});
