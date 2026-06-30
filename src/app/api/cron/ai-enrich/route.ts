import { NextRequest, NextResponse } from 'next/server'
import { prisma, pgPool } from '@/lib/db'
import { generateEmbedding, enrichGrant } from '@/lib/openai'
import pg from 'pg'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find grants that haven't been AI-enriched yet
    const unenrichedGrants = await prisma.grant.findMany({
      where: {
        aiSummaryHu: null,
        status: { in: ['OPEN', 'FORTHCOMING'] },
      },
      take: 20,
      orderBy: { firstSeenAt: 'desc' },
    })

    console.log(`[AI Enrich] Processing ${unenrichedGrants.length} grants...`)

    let enriched = 0

    for (const grant of unenrichedGrants) {
      try {
        // Step 1: AI enrichment (summary, key points, sectors)
        const aiData = await enrichGrant({
          titleHu: grant.titleHu,
          code: grant.code,
          program: grant.program,
          descriptionHu: grant.descriptionHu,
          eligibleSizes: grant.eligibleSizes,
          supportIntensityPct: grant.supportIntensityPct,
          minAmountHuf: grant.minAmountHuf,
          maxAmountHuf: grant.maxAmountHuf,
        })

        // Step 2: Generate embedding for semantic search
        const searchText = [
          grant.titleHu,
          grant.code,
          grant.program,
          grant.descriptionHu,
          aiData.aiSummaryHu,
          ...aiData.aiKeyPoints,
          ...aiData.aiSectors,
        ]
          .filter(Boolean)
          .join(' ')

        const embedding = await generateEmbedding(searchText)

        // Step 3: Update non-vector fields via Prisma
        await prisma.grant.update({
          where: { id: grant.id },
          data: {
            aiSummaryHu: aiData.aiSummaryHu,
            aiKeyPoints: aiData.aiKeyPoints,
            aiDifficultyScore: aiData.aiDifficultyScore,
            aiSectors: aiData.aiSectors,
          },
        })

        // Step 4: Update embedding via raw SQL (pgvector needs direct query)
        await pgPool.query(
          `UPDATE "Grant" SET embedding = $1::vector WHERE id = $2`,
          [`[${embedding.join(',')}]`, grant.id]
        )

        enriched++
        console.log(`[AI Enrich] ✓ ${grant.code || grant.titleHu}`)

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (err) {
        console.error(`[AI Enrich] Error on grant ${grant.id}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      processed: unenrichedGrants.length,
      enriched,
    })

  } catch (error) {
    console.error('[CRON] ai-enrich error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
