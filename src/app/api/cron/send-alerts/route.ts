import { NextRequest, NextResponse } from 'next/server'
import { processAndSendAlerts } from '@/lib/alerts-mailer'
import { runWithMonitoring } from '@/lib/scrapers/monitor'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { result, run } = await runWithMonitoring('send-alerts', async () => {
    const stats = await processAndSendAlerts()
    return {
      ...stats,
      processed: stats.alertsCreated,
    }
  })

  if (run.status === 'error') {
    return NextResponse.json(
      { error: run.errors[0] || 'Alert dispatch failed', monitoring: run },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    ...(result ?? {}),
    monitoring: run,
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
