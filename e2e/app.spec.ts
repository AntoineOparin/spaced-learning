import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { type Browser, expect, type Page, test } from '@playwright/test';

const SHOTS = 'test-results/screens';

/** Waits for running animations; a cancelled one (its element unmounted) counts as settled. */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: `${SHOTS}/${test.info().project.name}-${name}.png`,
    fullPage: true,
  });
}

/** No serious or critical accessibility violations, checked once entry animations settle. */
async function expectAccessible(page: Page) {
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
async function isolate(page: Page) {
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
}

async function installDeck(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Install starter deck' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Trigonometric Identities')).toBeVisible();
  await dialog.getByRole('button', { name: /^Install \d+ items$/ }).click();
  await expect(page.getByText(/Installed \d+ items/)).toBeVisible();
}

async function answerCards(page: Page, n: number, ratings: number[]) {
  const mobile = test.info().project.name.includes('iphone');
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

test.describe('local study flow', () => {
  test.beforeEach(async ({ page }) => isolate(page));

  test('install the Calculus 2 deck, study with undo, and see progress', async ({ page }) => {
    await installDeck(page);
    await expect(page.getByRole('link', { name: 'Calculus 2' })).toBeVisible();
    await shot(page, 'dashboard');
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(page).toHaveURL(/\/study/);
    await expect(page.getByRole('article', { name: 'Question' })).toBeVisible();
    await shot(page, 'study-question');
    await expectAccessible(page);

    await answerCards(page, 1, [3]);
    // Reveal the next one to capture the answer side with interval hints.
    if (test.info().project.name.includes('iphone'))
      await page.getByRole('button', { name: 'Show answer' }).click();
    else await page.keyboard.press('Space');
    await expect(
      page.getByRole('button', { name: /^Good — Recalled; next review in/ }),
    ).toBeVisible();
    await shot(page, 'study-answer');
    await expectAccessible(page);
    await page.getByRole('button', { name: /^Again/ }).click();
    await expect(page.getByRole('group', { name: 'How well did you recall it?' })).toBeHidden();

    await answerCards(page, 6, [3, 1, 4, 2]);

    await page.getByRole('button', { name: 'Undo (U)' }).click();
    await expect(page.getByText('Rating undone')).toBeVisible();

    // Edit the current item from inside the session.
    await page.getByRole('button', { name: 'Edit item (E)' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit item' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Edit item' })).toBeHidden();

    await page.getByRole('button', { name: 'End session (Esc)' }).click();
    await expect(page).toHaveURL(/\/$/);
    // 8 answered, 1 undone.
    await expect(
      page.locator('dt', { hasText: 'Reviewed' }).locator('xpath=following-sibling::dd'),
    ).toHaveText('7');

    // Data survives a reload (IndexedDB).
    await page.reload();
    await expect(
      page.locator('dt', { hasText: 'Reviewed' }).locator('xpath=following-sibling::dd'),
    ).toHaveText('7');
  });

  test('create a course, topic and cloze item, then study it', async ({ page }) => {
    await page.goto('/library?new=course');
    const dialog = page.getByRole('dialog', { name: 'New course' });
    await dialog.getByLabel('Name').fill('Discrete Mathematics');
    await dialog.getByRole('button', { name: 'Create course' }).click();

    await page.getByRole('button', { name: 'Add a topic' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Logic');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'New item' }).click();
    await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible();
    await page.getByText('Cloze', { exact: true }).click();
    await page
      .getByLabel('Text with deletions')
      .fill('De Morgan: $\\neg(p \\land q) \\equiv {{c1::\\neg p \\lor \\neg q}}$');
    const preview = page.getByRole('complementary', { name: 'Preview' });
    await expect(preview.locator('.cloze-blank').first()).toBeVisible();
    await shot(page, 'editor');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page).toHaveURL(/\/library\?topic=/);
    await expect(page.getByText('De Morgan:')).toBeVisible();
    await shot(page, 'library');
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Study this topic' }).click();
    await expect(page.locator('article .cloze-blank').first()).toBeVisible();
    await answerCards(page, 1, [3]);
    // The new card goes into its learning step (due in 10 min) — learned ahead or session done.
    await expect(page.getByText(/Session complete|Fill in the blank/)).toBeVisible();
  });

  test('draw an answer, then compare it with the key', async ({ page }) => {
    await installDeck(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(page.getByRole('article', { name: 'Question' })).toBeVisible();

    const draw = page.getByRole('button', { name: /^Draw/ });
    await draw.click();
    await expect(draw).toHaveAttribute('aria-pressed', 'true');
    const pad = page.getByRole('img', { name: /^Drawing pad/ });
    await expect(pad).toHaveAccessibleName('Drawing pad, empty');

    await settle(page);
    const box = await pad.boundingBox();
    const footer = await page.locator('footer').boundingBox();
    if (!box || !footer) throw new Error('pad or footer not laid out');
    // The pad fills the screen down to the footer: no dead space before checking the answer.
    expect(footer.y - (box.y + box.height)).toBeGreaterThanOrEqual(16);
    expect(footer.y - (box.y + box.height)).toBeLessThanOrEqual(32);
    expect(box.height).toBeGreaterThanOrEqual(240);
    const stroke = async (from: [number, number], to: [number, number]) => {
      await page.mouse.move(box.x + from[0], box.y + from[1]);
      await page.mouse.down();
      await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
      await page.mouse.up();
    };
    // A tall stroke spanning the pad, then a short one that gets undone.
    await stroke([40, 20], [90, box.height - 20]);
    await stroke([60, 140], [200, 60]);
    await expect(pad).toHaveAccessibleName('Drawing pad, 2 strokes drawn');
    await page.getByRole('button', { name: 'Undo last stroke' }).click();
    await expect(pad).toHaveAccessibleName('Drawing pad, 1 stroke drawn');
    await shot(page, 'study-draw');
    await expectAccessible(page);

    await page.getByRole('button', { name: /^Check answer/ }).click();
    const drawing = page.getByRole('img', { name: 'Your drawing' });
    await expect(drawing).toBeVisible();
    await expect(drawing.locator('path')).toHaveCount(1);
    // The key comes first, above the rating buttons; a big drawing below it is scaled down.
    await settle(page);
    const drawingBox = await drawing.boundingBox();
    const answerBox = await page.getByRole('region', { name: 'Answer' }).boundingBox();
    const ratingBar = await page.locator('footer').boundingBox();
    if (!drawingBox || !answerBox || !ratingBar) throw new Error('answer not laid out');
    expect(drawingBox.height).toBeLessThanOrEqual(160);
    expect(answerBox.y + answerBox.height).toBeLessThanOrEqual(ratingBar.y);
    expect(drawingBox.y).toBeGreaterThan(answerBox.y + answerBox.height);
    await shot(page, 'study-draw-answer');

    await page.getByRole('button', { name: /^Good/ }).click();
    // Draw mode persists; the next card starts with a blank pad.
    await expect(page.getByRole('img', { name: 'Drawing pad, empty' })).toBeVisible();
  });

  test('browse the library tree: fold, select, keyboard, independent scrolling', async ({
    page,
  }) => {
    test.skip(test.info().project.name.includes('iphone'), 'the tree is the wide-screen layout');
    await installDeck(page);
    await page.goto('/library');
    const tree = page.getByRole('tree', { name: 'Courses' });
    const item = (name: string) => tree.getByRole('treeitem', { name: new RegExp(`^${name},`) });
    const calc = item('Calculus 2');
    const trig = item('Trigonometric Identities');

    // The selected course starts open with its topics folded.
    await expect(calc).toHaveAttribute('aria-expanded', 'true');
    await expect(trig).toHaveAttribute('aria-expanded', 'false');
    await expect(tree.getByRole('treeitem', { name: /^Double-Angle,/ })).toBeHidden();

    // Clicking a topic selects it, shows its items and opens it; clicking again folds it.
    await trig.click();
    await expect(trig).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Trigonometric Identities' })).toBeVisible();
    await expect(tree.getByRole('treeitem', { name: /^Double-Angle,/ })).toBeVisible();
    await trig.click();
    await expect(trig).toHaveAttribute('aria-expanded', 'false');

    // VS Code keys: → opens, ↓ moves, ← climbs to the parent and folds it.
    await page.keyboard.press('ArrowRight');
    await expect(trig).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(tree.getByRole('treeitem', { name: /^Pythagorean/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(trig).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(trig).toHaveAttribute('aria-expanded', 'false');

    // The tree keeps its place while the long item list scrolls the page.
    await calc.click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const header = await page.getByRole('heading', { name: 'Courses', level: 2 }).boundingBox();
    const viewport = page.viewportSize();
    if (!header || !viewport) throw new Error('layout missing');
    expect(header.y).toBeGreaterThanOrEqual(0);
    expect(header.y).toBeLessThan(viewport.height / 2);
    await shot(page, 'library-tree');

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(tree.getByRole('treeitem')).toHaveCount(1);
  });

  test('export a backup, reset the device, and restore it', async ({ page }) => {
    await installDeck(page);
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const file = await (await download).path();
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    expect(backup.format).toBe('spaced-learning-backup');
    expect(backup.items.length).toBeGreaterThan(150);

    await page.getByRole('button', { name: 'Reset this device' }).click();
    const erase = page.getByRole('dialog', { name: 'Reset this device?' });
    const eraseButton = erase.getByRole('button', { name: 'Erase this device' });
    await expect(eraseButton).toBeDisabled();
    await erase.getByLabel('Type ERASE to confirm').fill('ERASE');
    await eraseButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.goto('/settings');
    await page.locator('#backup input[type=file]').setInputFiles(file);
    const confirm = page.getByRole('dialog', { name: 'Restore this backup?' });
    await expect(confirm).toContainText(`${backup.items.length} items`);
    await confirm.getByRole('button', { name: 'Replace local data' }).click();
    await expect(page.getByText('Backup restored')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Calculus 2' })).toBeVisible();
  });
});

test.describe('sync between devices', () => {
  async function device(browser: Browser) {
    const context = await browser.newContext(test.info().project.use);
    return { context, page: await context.newPage() };
  }

  test('reviews made on one device appear on another', async ({ browser }) => {
    const name = `Sync test ${Date.now()}`;
    const laptop = await device(browser);
    await laptop.page.goto('/library?new=course');
    const dialog = laptop.page.getByRole('dialog', { name: 'New course' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Create course' }).click();
    await laptop.page.getByRole('button', { name: 'Add a topic' }).click();
    await laptop.page.getByRole('dialog').getByLabel('Name').fill('Topic');
    await laptop.page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await laptop.page.getByRole('button', { name: 'New item' }).click();
    await laptop.page.getByLabel('Question').fill(`Sum of a geometric series? (${name})`);
    await laptop.page.getByLabel('Answer').fill('$\\frac{a}{1-r}$ for $|r|<1$');
    await laptop.page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(laptop.page).toHaveURL(/\/library\?topic=/);
    await expect(laptop.page.getByText(`Sum of a geometric series? (${name})`)).toBeVisible();

    await laptop.page.goto('/settings#sync');
    await laptop.page.getByRole('button', { name: 'Sync now' }).click();
    await expect(laptop.page.getByText(/Cloud sync · Synced/)).toBeVisible();
    await expect(laptop.page.getByText('0 local changes pending')).toBeVisible();

    const phone = await device(browser);
    await phone.page.goto('/');
    await expect(phone.page.getByRole('link', { name })).toBeVisible({ timeout: 15_000 });

    await laptop.context.close();
    await phone.context.close();
  });
});
