import AxeBuilder from '@axe-core/playwright';
import { type Browser, expect, type Page, test } from '@playwright/test';

const SHOTS = 'test-results/screens';

export function isMobile(): boolean {
  return test.info().project.name.includes('iphone');
}

/** Waits for running animations; a cancelled one (its element unmounted) counts as settled. */
export async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

export async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: `${SHOTS}/${test.info().project.name}-${name}.png`,
    fullPage: true,
  });
}

/** No serious or critical accessibility violations, checked once entry animations settle. */
export async function expectAccessible(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({
    // @axe-core/playwright types against its own playwright-core copy; the runtime object is the same.
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'],
  }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} — ${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary?.split('\n').slice(1).join(' ')}`).join(' | ')}`,
    ),
  ).toEqual([]);
}

/** Simulates being offline from the sync API so tests don't share server state. */
export async function isolate(page: Page) {
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
}

export async function installDeck(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Install Calculus 2' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Trigonometric Identities')).toBeVisible();
  await dialog.getByRole('button', { name: /^Install \d+ items$/ }).click();
  await expect(page.getByText(/Installed \d+ items/)).toBeVisible();
}

/** Creates a course with one topic through the library dialogs. */
export async function createCourse(page: Page, course: string, topic: string) {
  await page.goto('/library?new=course');
  const dialog = page.getByRole('dialog', { name: 'New course' });
  await dialog.getByLabel('Name').fill(course);
  await dialog.getByRole('button', { name: 'Create course' }).click();
  await page.getByRole('button', { name: 'Add a topic' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill(topic);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
}

export async function answerCards(page: Page, n: number, ratings: number[]) {
  const mobile = isMobile();
  for (let i = 0; i < n; i++) {
    await expect(page.getByRole('article', { name: 'Question' })).toBeVisible();
    if (mobile) await page.getByRole('button', { name: 'Show answer' }).click();
    else await page.keyboard.press('Space');
    const group = page.getByRole('group', { name: 'How well did you recall it?' });
    await expect(group).toBeVisible();
    const rating = ratings[i % ratings.length] ?? 3;
    if (mobile)
      await group
        .getByRole('button')
        .nth(rating - 1)
        .click();
    else await page.keyboard.press(String(rating));
    // Wait until the rating is saved and the next question is shown.
    await expect(group).toBeHidden();
  }
}

/** A separate browser context: its own IndexedDB, like another device. */
export async function device(browser: Browser) {
  const context = await browser.newContext(test.info().project.use);
  return { context, page: await context.newPage() };
}
