import { test, expect, type Page } from '@playwright/test';
import type { GameCard, GameDetail } from '../../src/types';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const names = [
  '星港余烬',
  '霓虹裂界',
  '灰烬王冠',
  '深海协议',
  '牧野时光',
  '回声旅人',
  '零界竞速',
  '月下迷宫',
];
const games: GameCard[] = names.map((name, index) => ({
  id: index + 1,
  name,
  englishName: ['Starport Ember', 'Neon Divide', 'Ashen Crown'][index],
  slug: index === 0 ? 'starport-ember' : `game-${index + 1}`,
  summary: '探索未知世界，体验属于你的 Adventure。',
  coverUrl: 'placeholder://cover',
  category: index % 2 ? '独立游戏' : 'PC 单机',
  currentVersion: '1.2.0',
  status: 'PUBLISHED',
  viewCount: 2500 - index * 180,
  resourceClickCount: 100,
  updatedAt: '2026-10-12T00:00:00',
  tags: ['RPG', '开放世界'],
  platforms: [index % 2 ? 'Linux' : 'Windows'],
  languages: ['简体中文', 'English'],
}));
const categories = [
  {
    id: 1,
    name: 'PC 单机',
    slug: 'pc',
    icon: 'Monitor',
    sortOrder: 1,
    enabled: true,
    gameCount: 4,
  },
  {
    id: 2,
    name: '独立游戏',
    slug: 'indie',
    icon: 'Sparkles',
    sortOrder: 2,
    enabled: true,
    gameCount: 4,
  },
  {
    id: 3,
    name: 'VR 游戏',
    slug: 'vr',
    icon: 'Headset',
    sortOrder: 3,
    enabled: true,
    gameCount: 0,
  },
  {
    id: 4,
    name: '模拟器游戏',
    slug: 'emulator',
    icon: 'Gamepad2',
    sortOrder: 4,
    enabled: true,
    gameCount: 0,
  },
  {
    id: 5,
    name: '游戏工具',
    slug: 'tools',
    icon: 'Wrench',
    sortOrder: 5,
    enabled: true,
    gameCount: 0,
  },
];
const detail: GameDetail = {
  ...games[0],
  categoryId: 1,
  developer: 'Ember Studio',
  description: '## 探索星港\n\n发现新世界，体验未知的冒险。',
  tagIds: [1, 2],
  screenshots: [
    { id: 1, type: 'SCREENSHOT', url: 'placeholder://one', sortOrder: 1 },
    { id: 2, type: 'SCREENSHOT', url: 'placeholder://two', sortOrder: 2 },
  ],
  requirements: [{ id: 1, type: 'MINIMUM', os: 'Windows 10', cpu: 'Intel i5', memory: '8 GB' }],
  resourceLinks: [
    {
      id: 1,
      provider: '示例资源',
      password: 'abcd',
      version: '1.2.0',
      status: 'ACTIVE',
      sortOrder: 0,
      updatedAt: '2026-10-12',
    },
  ],
};
async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown;
    if (url.pathname.startsWith('/api/v1/admin/'))
      return route.fulfill({
        status: 401,
        json: { code: 40101, message: 'authentication required', data: null },
      });
    if (url.pathname === '/api/v1/categories') data = categories;
    else if (url.pathname === '/api/v1/games/latest') data = games;
    else if (url.pathname === '/api/v1/games/wall')
      data = games.map((game, index) => ({
        id: game.id,
        name: game.name,
        slug: game.slug,
        coverUrl: game.coverUrl,
        hue: index * 42,
        chroma: 0.12,
        lightness: 0.45,
        colorConfidence: 0.7,
      }));
    else if (url.pathname === '/api/v1/games/starport-ember') data = detail;
    else if (url.pathname.includes('/report')) data = null;
    else {
      const items = url.searchParams.get('platform')
        ? games.filter((game) => game.platforms.includes(url.searchParams.get('platform')!))
        : games;
      data = {
        items,
        total: items.length,
        page: Number(url.searchParams.get('page') || 1),
        size: Number(url.searchParams.get('size') || 20),
        pages: 1,
      };
    }
    return route.fulfill({ json: { code: 0, message: 'ok', data } });
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
async function capture(page: Page, name: string) {
  if (!process.env.QA_SCREENSHOT_DIR) return;
  await mkdir(process.env.QA_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.QA_SCREENSHOT_DIR, name), fullPage: true });
}
test('desktop home, catalog filters and search stay usable', async ({ page }) => {
  await mockApi(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('search').getByRole('searchbox')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0);
  await expect(page.locator('.hero-signature')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '按分类探索' })).toHaveCount(0);
  const screenHeight = await page.evaluate(() => window.innerHeight);
  await expect(page.locator('.hero-screen')).toHaveCSS('height', `${screenHeight}px`);
  const bridge = await page.locator('.hero-bridge').boundingBox();
  expect(bridge!.y).toBeGreaterThanOrEqual(screenHeight - 1);
  await expect(page.locator('.popular-columns')).toHaveCSS('column-count', '3');
  await expect(page.getByRole('heading', { name: '最近更新', exact: true })).toBeVisible();
  const carousel = page.getByRole('region', { name: '最近更新游戏' });
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel.getByRole('link', { name: '查看 星港余烬 的详情' })).toBeVisible();
  await expect(carousel.getByRole('link')).toHaveCount(1);
  await expect(carousel.getByRole('button', { name: '显示第 1 张封面：星港余烬' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  const width = await carousel.locator('.latest-viewport').evaluate((node) => node.clientWidth);
  await expect(carousel.locator('.latest-slide').first()).toHaveCSS('width', `${width}px`);
  await carousel.getByRole('button', { name: '下一张封面' }).click();
  await expect(carousel.getByRole('button', { name: '显示第 2 张封面：霓虹裂界' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(carousel.getByRole('link', { name: '查看 霓虹裂界 的详情' })).toBeVisible();
  await carousel.getByRole('button', { name: '显示第 5 张封面：牧野时光' }).click();
  await expect(carousel.getByRole('link', { name: '查看 牧野时光 的详情' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(carousel.getByRole('button', { name: '显示第 4 张封面：深海协议' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await carousel.getByRole('button', { name: '显示第 1 张封面：星港余烬' }).click();
  await noOverflow(page);
  await capture(page, 'desktop.png');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '最新' })
    .click();
  await expect(page.getByRole('heading', { name: '探索游戏库' })).toBeVisible();
  await page.getByLabel('游戏平台').selectOption('Linux');
  await expect(page.getByRole('heading', { name: '霓虹裂界', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '星港余烬', exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.getByRole('search').first().getByRole('searchbox').fill('Adventure');
  await page.getByRole('search').first().getByRole('button', { name: '提交搜索' }).click();
  await expect(page.getByRole('heading', { name: '搜索游戏', exact: true })).toBeVisible();
  await expect(page.getByRole('search').last().getByRole('searchbox')).toHaveValue('Adventure');
  expect(errors).toEqual([]);
});
test('mobile layout, menu, gallery keyboard and reporting work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('search').getByRole('searchbox')).toBeVisible();
  await expect(page.locator('.hero-screen')).toHaveCSS('height', '844px');
  expect((await page.locator('.hero-bridge').boundingBox())!.y).toBeGreaterThanOrEqual(843);
  await expect(page.locator('.popular-columns')).toHaveCSS('column-count', '1');
  await expect(page.getByRole('heading', { name: '按分类探索' })).toHaveCount(0);
  await noOverflow(page);
  await capture(page, 'mobile.png');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible();
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  await page
    .getByRole('navigation', { name: '移动端导航' })
    .getByRole('link', { name: '全部游戏' })
    .click();
  await expect(page.getByRole('heading', { name: '探索游戏库' })).toBeVisible();
  await noOverflow(page);
  await page.goto('/games/starport-ember');
  await expect(page.getByRole('heading', { name: '星港余烬', exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: '查看 星港余烬 截图 1' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: '报告失效' }).click();
  await page.getByLabel('反馈原因').selectOption('PASSWORD_WRONG');
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page.getByText('感谢反馈，已提交。')).toBeVisible();
  await noOverflow(page);
});
test('an expired administrator token returns to a working login form', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gamehub-token', 'test-expired-token'));
  await mockApi(page);
  await page.goto('/admin/games/1/edit');
  await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gamehub-token'))).toBeNull();
  await expect(page.getByLabel('用户名')).toBeVisible();
  await expect(page.getByLabel('密码')).toBeVisible();
});
