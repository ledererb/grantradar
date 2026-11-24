import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { parseUserProfile, evaluateGrantEligibility } from '@/lib/grant-handbook'
import { formatHuf, formatDate } from '@/lib/utils'

export interface DigestGrantItem {
  id: string
  code: string | null
  title: string
  deadline: Date | null
  maxAmountHuf: bigint | null
  verdictLabel: string
  type: 'NEW_GRANT' | 'DEADLINE_APPROACHING'
}

function getUnsubscribeSecret(): string {
  return (
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'grantradar-unsubscribe-fallback'
  )
}

export function createUnsubscribeToken(userId: string): string {
  return crypto
    .createHmac('sha256', getUnsubscribeSecret())
    .update(userId)
    .digest('hex')
    .slice(0, 32)
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = createUnsubscribeToken(userId)
  if (token.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

function createTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null

  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10)
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        }
      : undefined,
  })
}

export function buildAlertDigestHtml(
  companyName: string | null,
  items: DigestGrantItem[],
  appUrl: string,
  unsubscribeUrl?: string,
): { subject: string; html: string } {
  const newGrants = items.filter((i) => i.type === 'NEW_GRANT')
  const deadlineGrants = items.filter((i) => i.type === 'DEADLINE_APPROACHING')
  const settingsUrl = `${appUrl}/dashboard/settings`
  const unsubLink = unsubscribeUrl || settingsUrl

  const subjectParts: string[] = []
  if (newGrants.length > 0) subjectParts.push(`${newGrants.length} új releváns pályázat`)
  if (deadlineGrants.length > 0) subjectParts.push(`${deadlineGrants.length} közelgő határidő`)
  const subject = `[GrantRadar] ${subjectParts.join(' · ') || 'Pályázati értesítő'}`

  const renderRows = (list: DigestGrantItem[]) =>
    list
      .map(
        (g) => `
      <tr>
        <td style="padding:14px 12px;border-bottom:1px solid #E2E8F0;">
          <div style="font-family:monospace;font-size:12px;color:#1D4ED8;font-weight:700;margin-bottom:4px;">
            ${g.code || 'PÁLYÁZAT'} · ${g.verdictLabel}
          </div>
          <a href="${appUrl}/dashboard/grants/${g.id}" style="color:#0F172A;font-weight:600;text-decoration:none;font-size:14px;">
            ${g.title}
          </a>
          <div style="font-size:12px;color:#475569;margin-top:4px;">
            Határidő: ${g.deadline ? formatDate(g.deadline) : 'Folyamatos'}
            ${g.maxAmountHuf ? ` · Max. támogatás: ${formatHuf(g.maxAmountHuf)}` : ''}
          </div>
        </td>
      </tr>`,
      )
      .join('')

  const html = `<!DOCTYPE html>
<html lang="hu">
<body style="margin:0;padding:24px;background:#F8F7F4;color:#0F172A;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #D6D3C9;border-radius:12px;padding:24px;">
    <div style="font-size:12px;font-weight:700;color:#1D4ED8;letter-spacing:0.04em;margin-bottom:8px;">
      GRANTRADAR PÁLYÁZATI ÉRTESÍTŐ
    </div>
    <h1 style="font-size:20px;margin:0 0 12px 0;color:#0F172A;">
      Személyre szabott pályázati riasztás${companyName ? ` — ${companyName}` : ''}
    </h1>
    <p style="font-size:13px;color:#334155;line-height:1.6;margin:0 0 20px 0;">
      A beállított cégprofilod és szűrőid alapján az alábbi új vagy hamarosan záruló pályázati lehetőségeket találtuk:
    </p>

    ${
      deadlineGrants.length > 0
        ? `<h2 style="font-size:14px;color:#B45309;margin:16px 0 8px 0;">
            ⚠️ Közelgő határidők (14 napon belül lejáró mentett pályázatok)
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
            ${renderRows(deadlineGrants)}
          </table>`
        : ''
    }

    ${
      newGrants.length > 0
        ? `<h2 style="font-size:14px;color:#15803D;margin:16px 0 8px 0;">
            ✨ Új, cégprofilodra illeszkedő pályázatok
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
            ${renderRows(newGrants)}
          </table>`
        : ''
    }

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center;">
      <a href="${appUrl}/dashboard/grants?forMe=1" style="display:inline-block;padding:11px 22px;background:#1D4ED8;color:#FFFFFF;font-weight:600;font-size:13px;border-radius:8px;text-decoration:none;">
        Cégemre szabott pályázatok megnyitása
      </a>
    </div>

    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #F1EFEA;text-align:center;font-size:11px;color:#64748B;line-height:1.6;">
      Ezt az értesítőt a GrantRadar rendszerében beállított cégprofilod alapján küldtük.<br />
      <a href="${settingsUrl}" style="color:#1D4ED8;text-decoration:underline;">Gyakoriság és szűrők módosítása</a>
      &nbsp;·&nbsp;
      <a href="${unsubLink}" style="color:#64748B;text-decoration:underline;">Leiratkozás egy kattintással</a>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Process new grants and approaching deadlines for all active PRO/AGENCY subscribers,
 * respecting user alertFrequency ('DAILY' | 'WEEKLY' | 'OFF'), record Alert rows,
 * and send digest emails with one-click unsubscribe links.
 */
export async function processAndSendAlerts(): Promise<{
  usersChecked: number
  alertsCreated: number
  emailsSent: number
}> {
  const now = new Date()
  const isMonday = now.getUTCDay() === 1
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grantradar.hu'

  const activeSubs = await prisma.subscription.findMany({
    where: {
      plan: { in: ['PRO', 'AGENCY'] },
      status: { in: ['active', 'trialing'] },
      currentPeriodEnd: { gt: now },
    },
    include: {
      user: {
        include: {
          profile: true,
          savedGrants: {
            include: { grant: true },
          },
          alerts: {
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { grantId: true, type: true },
          },
        },
      },
    },
  })

  if (activeSubs.length === 0) {
    return { usersChecked: 0, alertsCreated: 0, emailsSent: 0 }
  }

  const recentGrants = await prisma.grant.findMany({
    where: {
      status: { in: ['OPEN', 'FORTHCOMING'] },
      firstSeenAt: { gte: sevenDaysAgo },
      OR: [{ deadline: null }, { deadline: { gte: now } }],
    },
    include: {
      source: { select: { name: true, country: true } },
    },
    orderBy: { firstSeenAt: 'desc' },
    take: 50,
  })

  const transporter = createTransporter()
  const fromAddress = process.env.SMTP_FROM || 'GrantRadar <noreply@grantradar.hu>'

  let alertsCreated = 0
  let emailsSent = 0

  for (const sub of activeSubs) {
    const { user } = sub
    const companyProfile = parseUserProfile(user.profile)

    if (companyProfile.alertFrequency === 'OFF') continue
    if (companyProfile.alertFrequency === 'WEEKLY' && !isMonday) continue

    const existingKeys = new Set(user.alerts.map((a) => `${a.type}:${a.grantId}`))
    const digestItems: DigestGrantItem[] = []

    for (const saved of user.savedGrants) {
      const g = saved.grant
      if (!g.deadline || g.status !== 'OPEN') continue
      if (g.deadline >= now && g.deadline <= fourteenDaysFromNow) {
        const key = `DEADLINE_APPROACHING:${g.id}`
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          digestItems.push({
            id: g.id,
            code: g.code,
            title: g.titleHu || g.titleEn || 'Pályázat',
            deadline: g.deadline,
            maxAmountHuf: g.maxAmountHuf,
            verdictLabel: 'Mentett pályázat — 14 napon belül lejár',
            type: 'DEADLINE_APPROACHING',
          })
        }
      }
    }

    for (const g of recentGrants) {
      const key = `NEW_GRANT:${g.id}`
      if (existingKeys.has(key)) continue

      const evaluation = evaluateGrantEligibility(g, companyProfile)
      if (evaluation.failCount > 0) continue

      if (companyProfile.sectorPrefs.length > 0) {
        const grantSectors = [...(g.eligibleSectors || []), ...(g.aiSectors || [])]
          .join(' ')
          .toLowerCase()
        const sectorMatch = companyProfile.sectorPrefs.some((s) =>
          grantSectors.includes(s.toLowerCase().split(' ')[0]),
        )
        if (!sectorMatch && grantSectors.length > 0) continue
      }

      existingKeys.add(key)
      digestItems.push({
        id: g.id,
        code: g.code,
        title: g.titleHu || g.titleEn || 'Pályázat',
        deadline: g.deadline,
        maxAmountHuf: g.maxAmountHuf,
        verdictLabel: evaluation.verdictLabel,
        type: 'NEW_GRANT',
      })
    }

    if (digestItems.length === 0) continue

    const topDigest = digestItems.slice(0, 10)

    await prisma.alert.createMany({
      data: topDigest.map((item) => ({
        userId: user.id,
        grantId: item.id,
        type: item.type,
        sentAt: now,
      })),
    })
    alertsCreated += topDigest.length

    const unsubToken = createUnsubscribeToken(user.id)
    const unsubscribeUrl = `${appUrl}/api/alerts/unsubscribe?uid=${encodeURIComponent(user.id)}&token=${encodeURIComponent(unsubToken)}`

    const { subject, html } = buildAlertDigestHtml(
      companyProfile.companyName || user.name || null,
      topDigest,
      appUrl,
      unsubscribeUrl,
    )

    if (transporter && user.email) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: user.email,
          subject,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })
        emailsSent++
      } catch (err) {
        console.error(`[Alerts] Failed to send email to ${user.email}:`, err)
      }
    } else {
      console.log(`[Alerts] Dry-run digest prepared for ${user.email}: ${subject}`)
    }
  }

  return {
    usersChecked: activeSubs.length,
    alertsCreated,
    emailsSent,
  }
}
