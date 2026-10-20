import { expect, test } from '@playwright/test';
import { createCourse, expectAccessible, installDeck, isMobile, isolate, shot } from './helpers';

test.describe('library and editor', () => {
  test.beforeEach(async ({ page }) => isolate(page));

  test('create a course, topic and cloze item, then study it', async ({ page }) => {
    await createCourse(page, 'Discrete Mathematics', 'Logic');

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
    const rate = (name: RegExp) =>
      page
        .getByRole('group', { name: 'How well did you recall it?' })
        .getByRole('button', { name })
        .click();
    await page.getByRole('button', { name: /^Type/ }).click();
    const answer = page.getByLabel('Your answer');
    await answer.fill('no idea');
    await page.getByRole('button', { name: /^Check answer/ }).click();
    await rate(/^Again/);
    // The card comes straight back (its 1-minute step) as a fresh question: nothing carried over.
    await expect(answer).toHaveValue('');
    await answer.fill('$\\neg p \\lor \\neg q$');
    await page.getByRole('button', { name: /^Check answer/ }).click();
    await rate(/^Good/);
    // Next learning step (due in 10 min) — learned ahead or session done.
    await expect(page.getByText(/Session complete|Fill in the blank/)).toBeVisible();
  });

  test('a missing or deleted item cannot be edited, and Cancel stays in the app', async ({
    page,
  }) => {
    await installDeck(page);
    await page.goto('/library');
    const href = await page.locator('a[href^="/items/"]').first().getAttribute('href');
    if (!href) throw new Error('no item link');

    // Opened directly after another page: Cancel goes to the library, not back to that page.
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/library$/);

    await page.goto(href);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete item' }).click();
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
    await page.goto(href);
    await expect(page.getByText('This item no longer exists')).toBeVisible();
    await page.goto('/items/no-such-item');
    await expect(page.getByText('This item no longer exists')).toBeVisible();
  });

  test('browse the library tree: fold, select, keyboard, independent scrolling', async ({
    page,
  }) => {
    test.skip(isMobile(), 'the tree is the wide-screen layout');
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
});
