// End-to-end checks against the production build (`npm run build`, then `npm run test:e2e`).
// Network access outside the site is blocked here, so tests also prove the pages work offline
// and fall back quietly when GitHub or YouTube can't be reached.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  '/',
  '/research/',
  '/research/interest-identification/',
  '/research/grounding/',
  '/research/civic-digital-twins/',
  '/research/embodied-learning/',
  '/research/teacher-support/',
  '/publications/',
  '/builds/',
  '/builds/cs-udt/',
  '/builds/interest-extraction-pipeline/',
  '/builds/gaze-log-platform/',
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
    const list = page.locator('[data-github-activity] [data-list]');
    await expect(list).toBeVisible();
    await expect(list.locator('li')).toHaveCount(4);
    await expect(list).toContainText('Pushed commits to JimmyRaoUF/fixture-study-tools');
    await expect(list.locator('script')).toHaveCount(0);
    const cached = await page.evaluate(() => sessionStorage.getItem('github-activity-v1'));
    expect(cached).toContain('fixture-study-tools');
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

  test('home and about carry a JSON-LD Person with sameAs links', async ({ page }) => {
    await isolate(page);
    await page.goto('/about/');
    const json = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    ) as { '@type': string; sameAs: string[] };
    expect(json['@type']).toBe('Person');
    expect(json.sameAs).toContain('https://github.com/JimmyRaoUF');
    expect(json.sameAs).toContain('https://www.zhihu.com/people/daozhu');
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
