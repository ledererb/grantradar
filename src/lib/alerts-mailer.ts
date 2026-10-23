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
): { subject: string; html: string } {
  const newGrants = items.filter((i) => i.type === 'NEW_GRANT')
  const deadlineGrants = items.filter((i) => i.type === 'DEADLINE_APPROACHING')

  const subjectParts: string[] = []
  if (newGrants.length > 0) subjectParts.push(`${newGrants.length} új releváns pályázat`)
  if (deadlineGrants.length > 0) subjectParts.push(`${deadlineGrants.length} közelgő határidő`)
  const subject = `[GrantRadar] ${subjectParts.join(' · ') || 'Pályázati értesítő'}`

  const renderRows = (list: DigestGrantItem[]) =>
    list
      .map(
        (g) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #27272A;">
          <div style="font-family:monospace;font-size:12px;color:#E8B931;margin-bottom:4px;">
            ${g.code || 'PÁLYÁZAT'} · ${g.verdictLabel}
          </div>
          <a href="${appUrl}/dashboard/grants/${g.id}" style="color:#FAFAFA;font-weight:600;text-decoration:none;font-size:14px;">
            ${g.title}
          </a>
          <div style="font-size:12px;color:#A1A1AA;margin-top:4px;">
            Határidő: ${g.deadline ? formatDate(g.deadline) : 'Folyamatos'}
            ${g.maxAmountHuf ? ` · Max. támogatás: ${formatHuf(g.maxAmountHuf)}` : ''}
          </div>
        </td>
      </tr>`,
      )
      .join('')

  const html = `<!DOCTYPE html>
<html lang="hu">
<body style="margin:0;padding:24px;background:#09090B;color:#FAFAFA;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111113;border:1px solid #27272A;border-radius:12px;padding:24px;">
    <div style="font-size:12px;font-weight:700;color:#E8B931;letter-spacing:0.05em;margin-bottom:8px;">
      GRANTRADAR ÉRTESÍTŐ
    </div>
    <h1 style="font-size:20px;margin:0 0 12px 0;color:#FAFAFA;">
      Személyre szabott pályázati riasztás${companyName ? ` — ${companyName}` : ''}
    </h1>
    <p style="font-size:13px;color:#A1A1AA;line-height:1.5;margin:0 0 20px 0;">
      A beállított 2 perces előszűrő és cégprofil alapján az alábbi fontos pályázati eseményeket észleltük:
    </p>

    ${
      deadlineGrants.length > 0
        ? `<h2 style="font-size:14px;color:#F59E0B;margin:16px 0 8px 0;">
            ⚠️ Közelgő határidők (14 napon belül lejáró mentett pályázatok)
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
            ${renderRows(deadlineGrants)}
          </table>`
        : ''
    }

    ${
      newGrants.length > 0
        ? `<h2 style="font-size:14px;color:#22C55E;margin:16px 0 8px 0;">
            ✨ Új, cégprofilodra illeszkedő pályázatok
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
            ${renderRows(newGrants)}
          </table>`
        : ''
    }

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #27272A;text-align:center;">
      <a href="${appUrl}/dashboard/alerts" style="display:inline-block;padding:10px 20px;background:#E8B931;color:#09090B;font-weight:600;font-size:13px;border-radius:8px;text-decoration:none;">
        Részletes jogosultsági mátrix megnyitása
      </a>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}

/**
 * Process new grants and approaching deadlines for all active PRO/AGENCY subscribers,
 * record Alert rows, and send digest emails.
 */
export async function processAndSendAlerts(): Promise<{
  usersChecked: number
  alertsCreated: number
  emailsSent: number
}> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grantradar.hu'

  // Active PRO/AGENCY subscriptions
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
    const existingKeys = new Set(user.alerts.map((a) => `${a.type}:${a.grantId}`))
    const digestItems: DigestGrantItem[] = []

    // 1. Check approaching deadlines on user's saved grants
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

    // 2. Check recent grants against user's 2-minute pre-screening profile
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

    // Persist Alert rows
    await prisma.alert.createMany({
      data: topDigest.map((item) => ({
        userId: user.id,
        grantId: item.id,
        type: item.type,
        sentAt: now,
      })),
    })
    alertsCreated += topDigest.length

    // Send digest email if SMTP is configured
    const { subject, html } = buildAlertDigestHtml(
      companyProfile.companyName || user.name || null,
      topDigest,
      appUrl,
    )

    if (transporter && user.email) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: user.email,
          subject,
          html,
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
