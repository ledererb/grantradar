import { prisma, pgPool } from '@/lib/db'
import { generateEmbedding, enrichGrant } from '@/lib/openai'

/**
 * Auto-enrich any grants that haven't been AI-processed yet.
 * Call this at the end of every scrape cycle.
 * Only processes OPEN/FORTHCOMING grants with no AI summary.
 */
export async function autoEnrich(limit = 20): Promise<{ processed: number; enriched: number }> {
  const unenrichedGrants = await prisma.grant.findMany({
    where: {
      aiSummaryHu: null,
      status: { in: ['OPEN', 'FORTHCOMING'] },
    },
    take: limit,
    orderBy: { firstSeenAt: 'desc' },
  })

  if (unenrichedGrants.length === 0) {
    return { processed: 0, enriched: 0 }
  }

  console.log(`[AutoEnrich] Processing ${unenrichedGrants.length} grants...`)
  let enriched = 0

  for (const grant of unenrichedGrants) {
    try {
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

      const searchText = [
        grant.titleHu, grant.code, grant.program,
        grant.descriptionHu, aiData.aiSummaryHu,
        ...aiData.aiKeyPoints, ...aiData.aiSectors,
      ].filter(Boolean).join(' ')

      const embedding = await generateEmbedding(searchText)

      await prisma.grant.update({
        where: { id: grant.id },
        data: {
          aiSummaryHu: aiData.aiSummaryHu,
          aiKeyPoints: aiData.aiKeyPoints,
          aiDifficultyScore: aiData.aiDifficultyScore,
          aiSectors: aiData.aiSectors,
        },
      })

      await pgPool.query(
        `UPDATE "Grant" SET embedding = $1::vector WHERE id = $2`,
        [`[${embedding.join(',')}]`, grant.id]
      )

      enriched++
      console.log(`[AutoEnrich] ✓ ${grant.code || grant.titleHu}`)
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (err) {
      console.error(`[AutoEnrich] Error on ${grant.id}:`, err)
    }
  }

  return { processed: unenrichedGrants.length, enriched }
}

/**
 * Auto-archive grants past their deadline.
 * Marks OPEN grants with expired deadlines as ARCHIVED.
 */
export async function autoArchiveExpired(): Promise<number> {
  const now = new Date()
  const result = await prisma.grant.updateMany({
    where: {
      status: 'OPEN',
      deadline: { lt: now },
    },
    data: {
      status: 'ARCHIVED',
      updatedAt: now,
    },
  })

  if (result.count > 0) {
    console.log(`[AutoArchive] Archived ${result.count} expired grants`)
  }
  return result.count
}
