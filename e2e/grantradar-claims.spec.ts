import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

function loadEnvLocalIfPresent() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    val = val.replace(/\\n$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocalIfPresent()

const SCREENSHOT_DIR =
  process.env.PLAYWRIGHT_SCREENSHOT_DIR || path.resolve(process.cwd(), 'test-results/screenshots')

function shotPath(filename: string): string {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  return path.join(SCREENSHOT_DIR, filename)
}

const TEST_EMAIL = `pw-e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'GrPwTest!2026#Verify99'

let createdSupabaseId: string | null = null
let createdDbUserId: string | null = null

async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('te@ceg.hu').fill(TEST_EMAIL)
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /Belépés/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20_000 })
}

test.describe('GrantRadar — Teljes körű állítás- és UX-bizonyító E2E tesztcsomag', () => {
  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const databaseUrl = process.env.DATABASE_URL

    if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL for authenticated E2E tests.',
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Playwright E2E Teszt' },
    })
    if (error || !created.user) {
      throw new Error(`Failed to create E2E Supabase user: ${error?.message}`)
    }
    createdSupabaseId = created.user.id

    const pool = new pg.Pool({ connectionString: databaseUrl })
    try {
      const id = `pw_${crypto.randomBytes(8).toString('hex')}`
      const res = await pool.query(
        `INSERT INTO "User" (id, "supabaseId", email, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("supabaseId") DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [id, createdSupabaseId, TEST_EMAIL, 'Playwright E2E Teszt'],
      )
      createdDbUserId = res.rows[0].id
    } finally {
      await pool.end()
    }
  })

  test.afterAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const databaseUrl = process.env.DATABASE_URL

    if (databaseUrl && createdSupabaseId) {
      const pool = new pg.Pool({ connectionString: databaseUrl })
      try {
        await pool.query(`DELETE FROM "User" WHERE "supabaseId" = $1`, [createdSupabaseId])
      } finally {
        await pool.end()
      }
    }

    if (supabaseUrl && serviceRoleKey && createdSupabaseId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await supabase.auth.admin.deleteUser(createdSupabaseId)
    }
  })

  test('1. Világos B2B dizájn, új főcím, célcsoport és sötét/világos témaváltó', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText(
      'Találd meg a vállalkozásod számára elérhető támogatásokat – egyszerűen, egyetlen felületen.',
    )
    await expect(page.getByText('KKV-knak • Egyéni vállalkozóknak • Agrártermelőknek')).toBeVisible()
    await expect(page.getByRole('link', { name: /Rövid előszűrés indítása/i })).toBeVisible()
    await expect(page.locator('nav').getByRole('link', { name: /Ingyenes regisztráció/i })).toBeVisible()

    const lightStyles = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
    }))
    expect(lightStyles.bg).toBe('rgb(248, 247, 244)')
    expect(lightStyles.color).toBe('rgb(15, 23, 42)')

    await page.screenshot({ path: shotPath('pw-01-hero-light.png') })

    // Toggle to Dark Mode
    await page.locator('nav').getByRole('button', { name: /Váltás sötét megjelenésre/i }).click()
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(darkBg).toBe('rgb(17, 19, 24)')
    await page.screenshot({ path: shotPath('pw-02-hero-dark-toggle.png') })

    // Toggle back to Light Mode
    await page.locator('nav').getByRole('button', { name: /Váltás világos megjelenésre/i }).click()
    const restoredLightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(restoredLightBg).toBe('rgb(248, 247, 244)')
  })

  test('2. Főoldali folyamatábra, szakmai háttér, zsargonmentesség, többcélos előszűrő és GYIK', async ({
    page,
  }) => {
    await page.goto('/')

    const bodyText = await page.locator('main').innerText()
    expect(bodyText).not.toContain('TRL')
    expect(bodyText).not.toContain('White-label')
    expect(bodyText).not.toContain('GPT-4o')

    const flowHeading = page.getByRole('heading', {
      name: /Három egyszerű lépés az első beadható pályázatig/i,
    })
    await flowHeading.scrollIntoViewIfNeeded()
    await expect(flowHeading).toBeVisible()
    await page.screenshot({ path: shotPath('pw-03-flowchart-and-methodology.png') })

    // Multi-select goals in Pre-Screener + region terminology check
    const preScreener = page.locator('#eloszuro')
    await preScreener.scrollIntoViewIfNeeded()
    await expect(preScreener).toContainText('Budapest vagy Pest régió')
    await expect(preScreener).not.toContainText('vármegye')

    await preScreener.getByText('Szoftver, felhő, adatbiztonság, MI').click()
    await preScreener.getByText('Napelem, energiatárolás, energetika').click()

    await expect(preScreener.locator('input[type="checkbox"]:checked')).toHaveCount(3)
    await expect(preScreener).toContainText('DIMOP Plusz (Digitális fejlesztés)')
    await expect(preScreener).toContainText('GINOP Plusz')
    await preScreener.screenshot({ path: shotPath('pw-04-prescreener-multiselect.png') })

    // Open two FAQ accordion items
    const faq = page.locator('#gyik')
    await faq.scrollIntoViewIfNeeded()
    await faq.getByText('Hogyan működik a személyre szabás?').click()
    await faq.getByText('Hogyan működik az e-mail értesítő').click()
    await expect(faq.getByText('1-kattintásos leiratkozási')).toBeVisible()
    await faq.screenshot({ path: shotPath('pw-05-faq-open.png') })
  })

  test('3. Forintos árazás (nettó + ÁFA és bruttó), Kinek szól? és összehasonlító táblázat', async ({
    page,
  }) => {
    await page.goto('/pricing')

    const pageText = await page.locator('main').innerText()
    expect(pageText).not.toContain('€29')
    expect(pageText).not.toContain('€99')
    await expect(page.getByText('0 Ft', { exact: true })).toBeVisible()
    await expect(page.getByText('11 900 Ft', { exact: true })).toBeVisible()
    await expect(page.getByText('(bruttó 15 113 Ft / hó)')).toBeVisible()
    await expect(page.getByText('39 900 Ft', { exact: true })).toBeVisible()
    await expect(page.getByText('(bruttó 50 673 Ft / hó)')).toBeVisible()
    await expect(page.getByText('Kinek szól?')).toHaveCount(3)

    await page.screenshot({ path: shotPath('pw-06-pricing-huf-cards.png') })

    const compHeading = page.getByRole('heading', { name: /Csomagok részletes összehasonlítása/i })
    await compHeading.scrollIntoViewIfNeeded()
    await expect(compHeading).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Cégprofilra szabott találati lista' })).toBeVisible()
    await page.screenshot({ path: shotPath('pw-07-pricing-comparison-table.png') })
  })

  test('4. Publikus pályázatlista: alapból aktív magyar pályázatok, külön EU és Lezárult fülek', async ({
    page,
  }) => {
    await page.goto('/grants')
    await expect(page.getByRole('link', { name: /Nyitott magyar/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Közvetlen EU/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Lezárult kiírások/i })).toBeVisible()

    const huText = await page.locator('body').innerText()
    expect(huText).not.toContain('napja lejárt')
    await page.screenshot({ path: shotPath('pw-08-public-grants-hu.png') })

    await page.getByRole('link', { name: /Közvetlen EU/i }).click()
    await expect(page).toHaveURL(/scope=eu/)

    await page.getByRole('link', { name: /Lezárult kiírások/i }).click()
    await expect(page).toHaveURL(/scope=closed/)
  })

  test('5. Belépett folyamatok: Cégprofil + hírlevél, kattintható Áttekintés, ingyenes Cégemre szabva, DIMOP-1.2.6/C, önkormányzat és leiratkozás', async ({
    page,
  }) => {
    await loginAsTestUser(page)

    // 5a. Configure company profile + weekly newsletter frequency
    await page.goto('/dashboard/settings')
    await page.getByPlaceholder('Példa Kft.').fill('Teszt KKV Kft.')
    await page.locator('select').nth(0).selectOption('KFT_ZRT')
    await page.getByRole('button', { name: 'Kisvállalkozás (10–49 fő)' }).click()
    await page.getByPlaceholder('pl. 2').fill('2')
    await page.getByPlaceholder('pl. 8').fill('12')
    await page.getByPlaceholder('pl. 120').fill('150')
    await page.locator('select').nth(1).selectOption('YES')
    await page.locator('select').nth(2).selectOption('YES')
    await page.getByRole('button', { name: /Kevésbé fejlett régió/i }).click()
    await page.locator('select').nth(3).selectOption('OWNED')
    await page.getByRole('button', { name: 'IT és szoftverfejlesztés' }).click()
    await page.getByRole('button', { name: 'Feldolgozóipar' }).click()

    const weeklyCard = page.locator('label').filter({ hasText: 'Heti összefoglaló' })
    await weeklyCard.click()
    await expect(weeklyCard.locator('input[type="radio"]')).toBeChecked()

    await page.getByRole('button', { name: /Beállítások mentése/i }).click()
    await expect(page.getByText(/Mentve! Frissült a cégedre szabott pályázati lista/i)).toBeVisible()
    await page.locator('text=6. E-mail értesítések').scrollIntoViewIfNeeded()
    await page.screenshot({ path: shotPath('pw-09-settings-newsletter-frequency.png') })

    // 5b. Dashboard overview: all 4 stat cards clickable + personalized section visible + exact count parity
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Cégemre szabott pályázati lehetőségek' })).toBeVisible()

    const openCard = page.locator('a.stat-card[href="/dashboard/grants?status=OPEN&country=HU"]')
    const forthcomingCard = page.locator('a.stat-card[href="/dashboard/grants?status=FORTHCOMING&country=HU"]')
    const forMeCard = page.locator('a.stat-card[href="/dashboard/grants?forMe=1"]')
    const allDbCard = page.locator('a.stat-card[href="/dashboard/grants?status=ALL&country=ALL"]')

    await expect(openCard).toBeVisible()
    await expect(forthcomingCard).toBeVisible()
    await expect(forMeCard).toBeVisible()
    await expect(allDbCard).toBeVisible()

    const openCardCountText = await openCard.locator('.text-2xl').innerText()
    const openCardCount = Number.parseInt(openCardCountText.trim(), 10)
    expect(openCardCount).toBeGreaterThan(0)
    await page.screenshot({ path: shotPath('pw-10-dashboard-clickable-and-personalized.png') })

    await openCard.click()
    await page.waitForURL('**/dashboard/grants?status=OPEN&country=HU')
    await expect(page.getByText(`${openCardCount} pályázat a szűrésed alapján`)).toBeVisible()

    // 5c. Free-tier personalized "Cégemre szabva" view
    await page.goto('/dashboard/grants?forMe=1')
    await expect(page.getByText(/\d+ pályázat a szűrésed alapján/)).toBeVisible()
    await page.screenshot({ path: shotPath('pw-11-grants-for-me-free.png') })

    // 5d. DIMOP Plusz-1.2.6/C search -> closed matches -> detail page must NEVER say eligible
    await page.goto('/dashboard/grants')
    await expect(page.getByText(/\d+ pályázat a szűrésed alapján/)).toBeVisible()
    const searchInput = page.getByPlaceholder(/Keresés cím, kód/i)
    await searchInput.fill('DIMOP Plusz-1.2.6/C')
    await page.getByRole('button', { name: 'Keresés', exact: true }).click()

    const showClosedBtn = page.getByRole('button', { name: /Lezárult találatok megjelenítése/i })
    await expect(showClosedBtn).toBeVisible()
    await showClosedBtn.click()

    const dimopLink = page.locator('a[href^="/dashboard/grants/"]').filter({ hasText: '1.2.6/C' }).first()
    await expect(dimopLink).toBeVisible()
    await expect(dimopLink).toContainText('Lezárult')
    await dimopLink.click()

    await expect(
      page.getByText(/Ez a pályázati felhívás jelenleg lezárult vagy felfüggesztett státuszú — pályázat jelenleg nem nyújtható be/i),
    ).toBeVisible()
    await expect(page.getByText('Lezárult felhívás — jelenleg nem nyújtható be')).toBeVisible()
    await page.screenshot({ path: shotPath('pw-12-dimop-126c-closed-verdict.png') })

    // 5e. Municipal search ("önkormányzat") must exclude false KKV/KAP hits & disqualify Kft. on MFP/ÖTIFB/2026
    await page.goto('/dashboard/grants')
    await expect(page.getByText(/\d+ pályázat a szűrésed alapján/)).toBeVisible()
    await page.getByPlaceholder(/Keresés cím, kód/i).fill('önkormányzat')
    await page.getByRole('button', { name: 'Keresés', exact: true }).click()

    await expect(page.getByText('MFP/ÖTIFB/2026')).toBeVisible()
    const munListText = await page.locator('main').innerText()
    expect(munListText).not.toContain('Kisboltok támogatása')
    expect(munListText).not.toContain('KAP-RD')
    await page.screenshot({ path: shotPath('pw-13-municipal-search-clean.png') })

    await page.locator('a[href^="/dashboard/grants/"]').filter({ hasText: 'MFP/ÖTIFB/2026' }).first().click()
    await page.waitForURL('**/dashboard/grants/*')
    await expect(
      page.getByText(/Ez a felhívás önkormányzatoknak \/ települési közszolgáltatásoknak szól/i),
    ).toBeVisible()
    await expect(page.getByText('1 kizáró kockázat észlelve')).toBeVisible()
    await page.screenshot({ path: shotPath('pw-14-municipal-kft-disqualified.png') })

    // 5f. Verify HUF pricing in Billing & Alerts
    await page.goto('/dashboard/billing')
    await expect(page.getByText(/11[\s\u00a0]900 Ft \+ ÁFA \/ hó/).first()).toBeVisible()
    expect(await page.locator('main').innerText()).not.toContain('€29')

    // 5g. One-click unsubscribe flow
    if (!createdDbUserId) throw new Error('createdDbUserId missing')
    const rawSecret =
      process.env.CRON_SECRET?.replace(/\\n$/g, '').trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\\n$/g, '').trim() ||
      'grantradar-unsubscribe-fallback'
    const token = crypto
      .createHmac('sha256', rawSecret)
      .update(createdDbUserId)
      .digest('hex')
      .slice(0, 32)

    await page.goto(
      `/api/alerts/unsubscribe?uid=${encodeURIComponent(createdDbUserId)}&token=${encodeURIComponent(token)}`,
    )
    await page.waitForURL('**/leiratkozas?status=ok')
    await expect(page.getByText('Sikeresen leiratkoztál az e-mail értesítőkről')).toBeVisible()
    await page.screenshot({ path: shotPath('pw-15-one-click-unsubscribe.png') })

    await page.goto('/dashboard/settings')
    const offCard = page.locator('label').filter({ hasText: 'Leiratkozva (Kikapcsolva)' })
    await expect(offCard.locator('input[type="radio"]')).toBeChecked()
    await page.screenshot({ path: shotPath('pw-16-settings-unsubscribed-confirmed.png') })
  })
})
