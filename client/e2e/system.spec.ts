import { test, expect, type Page } from '@playwright/test';
const password = 'BrowserTests123!';
const email = () => `e2e-${crypto.randomUUID()}@example.test`;
async function signup(page: Page, address = email()) {
    expect((await page.request.post('/api/auth/register', { data: { email: address, password } })).ok()).toBeTruthy();
    await page.goto('/');
    await page.getByLabel('Email address', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Where to next?' })).toBeVisible();
    return address;
}
async function createTrip(page: Page) {
    const response = await page.request.post('/api/trips', { data: { destination: 'Rome', country: 'Italy', startDate: '2099-06-01', endDate: '2099-06-05' } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).id as number;
}

test('direct URLs refresh through the published SPA and missing APIs stay 404', async ({ page }) => {
    await signup(page);
    const id = await createTrip(page);
    await page.goto(`/trips/${id}`);
    await expect(page.getByRole('heading', { name: 'Rome', level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Rome', level: 1 })).toBeVisible();
    expect((await page.request.get('/api/not-a-route')).status()).toBe(404);
    await page.goto('/budgets');
    await expect(page.getByRole('heading', { name: 'Budgets', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rome', exact: true })).toBeVisible();
});

test('sharing works across independent browser sessions', async ({ page, browser }) => {
    await signup(page);
    const recipient = email();
    const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4179' });
    try {
        const guest = await guestContext.newPage();
        await signup(guest, recipient);
        const id = await createTrip(page);
        await page.goto(`/trips/${id}`);
        await page.getByRole('button', { name: '+ Invite someone', exact: true }).click();
        await page.getByLabel('Email address', { exact: true }).fill(recipient);
        await page.getByLabel('Permission').selectOption('Viewer');
        await page.getByRole('button', { name: 'Send invite', exact: true }).click();
        await expect(page.getByText('Invitation pending ·', { exact: false })).toBeVisible();
        await guest.goto('/invitations');
        await guest.getByRole('button', { name: 'Accept', exact: true }).click();
        await expect(guest.getByRole('heading', { name: 'No pending invitations' })).toBeVisible();
        await guest.goto(`/trips/${id}`);
        await expect(guest.getByRole('heading', { name: 'Rome', level: 1 })).toBeVisible();
        await expect(guest.getByRole('button', { name: 'Delete trip', exact: true })).toHaveCount(0);
    } finally { await guestContext.close(); }
});

test('Hebrew preferences persist and mobile navigation fits the viewport', async ({ page }) => {
    await signup(page);
    await page.goto('/settings');
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('he');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('combobox', { name: 'שפה', exact: true })).toHaveValue('he');
    await expect(page.getByRole('navigation')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: test.info().outputPath('settings-rtl.png'), fullPage: true });
});

test('trip summary renders printable content and downloads an offline copy', async ({ page }) => {
    await signup(page);
    const id = await createTrip(page);
    await page.goto(`/trips/${id}`);
    await page.getByRole('button', { name: 'Prepare trip summary' }).click();
    const frame = page.frameLocator('iframe[title="Trip summary preview"]');
    await expect(frame.getByRole('heading', { name: 'Rome' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
    const summaryFrame = page.frames().find(item => item.url() === 'about:srcdoc');
    expect(summaryFrame).toBeTruthy();
    await summaryFrame!.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = 'true'; }; });
    await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
    await expect(frame.locator('html')).toHaveAttribute('data-print-requested', 'true');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download summary' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.html$/);
    await page.emulateMedia({ media: 'print' });
    await expect(frame.getByText('TripPlanner · Trip summary')).toBeVisible();
});

test('browser notifications have an explicit opt-in and register the service worker', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await signup(page);
    await page.goto('/notifications');
    await page.getByRole('button', { name: 'Enable browser alerts' }).click();
    await expect.poll(async () => (await (await page.request.get('/api/notifications/preferences')).json()).browserNotifications).toBe(true);
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
    // Native OS notification display and delivery with a closed app require a separate device check.
});
