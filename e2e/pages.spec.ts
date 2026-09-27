import { expect, test, type Page } from '@playwright/test';

// Chaque page s'ouvre sans erreur JavaScript, avec le profil d'exemple (RV 8, 22 ouvriers).

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  // Les images du wiki officiel ne sont pas nécessaires aux tests.
  await page.route(/worldx-website-cdn\.aniimo\.com/, (r) => r.abort());
  await page.goto('#logis');
  await page.getByRole('button', { name: /Charger l'exemple/ }).click();
});

const PAGES: [string, string][] = [
  ['jour', 'Objectif : Camping-car niv. 9'],
  ['plan', 'Camping-car niv. 9 dans'],
  ['recruter', 'Équipe optimale'],
  ['combos', 'Codes combo du logis'],
  ['ouvriers', 'Ouvriers'],
  ['aniidex', 'Aniidex'],
  ['carte', 'Où trouver'],
  ['tier', 'Tier list'],
  ['equipes', 'Équipes de combat'],
  ['codes', 'Codes cadeaux'],
  ['mesures', 'Vérifier en jeu'],
];

for (const [id, text] of PAGES) {
  test(`page ${id}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`#${id}`);
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
}

test('Aujourd’hui : temps restant calculé', async ({ page }) => {
  await page.goto('#jour');
  await expect(page.locator('.estimate')).toContainText(/Encore \d+ h/, { timeout: 30_000 });
});

test('Optimiser : plan des zones climatiques', async ({ page }) => {
  await page.goto('#plan');
  await expect(page.locator('.zones .zone').first()).toBeVisible({ timeout: 30_000 });
});

test('Aniidex : fiche détaillée', async ({ page }) => {
  await page.goto('#aniidex');
  await page.locator('.dex-grid a').first().click();
  await expect(page.locator('.stat-bars li')).toHaveCount(6);
});

test('Codes : case « utilisé » gardée après rechargement', async ({ page }) => {
  await page.goto('#codes');
  const first = page.locator('.codes .code').first();
  const code = await first.locator('.code__text').textContent();
  // Un code coché quitte aussitôt la liste : un simple clic (check() re-cocherait le suivant).
  await first.locator('.code__used input').click();
  await expect(page.locator('.codes .code__text', { hasText: code! })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.codes .code__text', { hasText: code! })).toHaveCount(0);
});

test('synchro : le lien recrée le même logis dans un autre navigateur', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#logis');
  await page.getByRole('button', { name: /Synchroniser/ }).click();
  await expect(page.locator('.sync__qr svg')).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.getByRole('button', { name: 'Partager le lien' }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/#import=z[\w-]+$/);

  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await other.goto(url);
  await expect(other.locator('.banner')).toContainText('22 ouvriers');
  await other.getByRole('button', { name: 'Remplacer' }).click();
  await expect(other.locator('h2', { hasText: 'Mes ouvriers' })).toContainText('22');
});
