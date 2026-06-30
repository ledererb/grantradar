import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai, generateEmbedding } from '@/lib/openai'
import { pgPool } from '@/lib/db'

/**
 * Deep-scrape: follow a grant's sourceUrl, extract full details from the
 * detail page, and re-enrich with the richer context.
 */
export async function deepScrapeGrants(limit = 5): Promise<{
  processed: number
  enriched: number
  skipped: number
  errors: string[]
}> {
  const grants = await prisma.grant.findMany({
    where: {
      detailScrapedAt: null,
      status: { in: ['OPEN', 'FORTHCOMING'] },
      sourceUrl: { not: '' },
    },
    take: limit,
    orderBy: { firstSeenAt: 'desc' },
  })

  if (grants.length === 0) {
    return { processed: 0, enriched: 0, skipped: 0, errors: [] }
  }

  console.log(`[DeepScrape] Processing ${grants.length} grants...`)
  let enriched = 0
  let skipped = 0
  const errors: string[] = []

  for (const grant of grants) {
    const url = grant.sourceUrl
    const label = grant.code || (grant.titleHu || '').slice(0, 30)

    // Skip generic homepages
    if (!url || ['https://kap.gov.hu', 'https://nffku.hu', 'https://magyarfaluprogram.hu'].includes(url)) {
      await prisma.grant.update({ where: { id: grant.id }, data: { detailScrapedAt: new Date() } })
      skipped++
      continue
    }

    // Step 1: Firecrawl
    console.log(`[DeepScrape] Step 1 — Firecrawl: ${url}`)
    let markdown = ''
    try {
      const doc = await scrapeGrantPage(url)
      markdown = doc?.markdown || ''
    } catch (err) {
      const msg = `Firecrawl failed for ${label}: ${err instanceof Error ? err.message : String(err)}`
      console.error(`[DeepScrape] ${msg}`)
      errors.push(msg)
      await prisma.grant.update({ where: { id: grant.id }, data: { detailScrapedAt: new Date() } })
      continue
    }

    if (markdown.length < 200) {
      console.log(`[DeepScrape] Skip ${label}: only ${markdown.length} chars`)
      await prisma.grant.update({ where: { id: grant.id }, data: { detailScrapedAt: new Date() } })
      skipped++
      continue
    }

    // Step 2: GPT extraction
    console.log(`[DeepScrape] Step 2 — GPT extract (${markdown.length} chars input)`)
    let detail: Record<string, unknown> = {}
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Nyerd ki a pályázat részleteit JSON-ban.

Pályázat: ${grant.titleHu || grant.titleEn || 'N/A'} (${grant.code || 'N/A'})

Kért mezők:
{
  "descriptionHu": "3-6 mondatos leírás",
  "eligibilityHu": "Ki pályázhat? Feltételek.",
  "applicationStepsHu": "Hogyan kell pályázni? 3-5 lépés.",
  "eligibleSizes": ["MICRO","SMALL","MEDIUM","LARGE"],
  "eligibleSectors": ["szektor"],
  "supportIntensityPct": null,
  "minAmountHuf": null,
  "maxAmountHuf": null
}

Ha egy mező nem állapítható meg, használj null-t.
Összegek HUF-ban, számként.

Oldal:
${markdown.slice(0, 30000)}`,
        }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty GPT response')
      detail = JSON.parse(content)
    } catch (err) {
      const msg = `GPT extract failed for ${label}: ${err instanceof Error ? err.message : String(err)}`
      console.error(`[DeepScrape] ${msg}`)
      errors.push(msg)
      continue
    }

    // Step 3: Update DB
    console.log(`[DeepScrape] Step 3 — DB update`)
    try {
      const updateData: Record<string, unknown> = { detailScrapedAt: new Date() }

      const descHu = detail.descriptionHu as string | undefined
      if (descHu && descHu.length > (grant.descriptionHu?.length || 0)) {
        updateData.descriptionHu = descHu
      }
      if (detail.eligibilityHu) updateData.eligibilityHu = detail.eligibilityHu
      if (detail.applicationStepsHu) updateData.applicationStepsHu = detail.applicationStepsHu

      // Skip eligibleSizes — already set during initial scrape, Prisma enum validation is strict
      const sectors = detail.eligibleSectors as string[] | undefined
      if (sectors && sectors.length > 0) updateData.eligibleSectors = sectors

      const pct = detail.supportIntensityPct as number | null
      if (pct != null && typeof pct === 'number') updateData.supportIntensityPct = pct

      const minAmt = detail.minAmountHuf as number | null
      if (minAmt != null && minAmt > 0) {
        try { updateData.minAmountHuf = BigInt(Math.round(Number(minAmt))) } catch {}
      }
      const maxAmt = detail.maxAmountHuf as number | null
      if (maxAmt != null && maxAmt > 0) {
        try { updateData.maxAmountHuf = BigInt(Math.round(Number(maxAmt))) } catch {}
      }

      await prisma.grant.update({ where: { id: grant.id }, data: updateData })
    } catch (err) {
      const msg = `DB update failed for ${label}: ${err instanceof Error ? err.message : String(err)}`
      console.error(`[DeepScrape] ${msg}`)
      errors.push(msg)
      continue
    }

    // Step 4: Re-enrich AI summary with richer data
    console.log(`[DeepScrape] Step 4 — Re-enrich + embedding`)
    try {
      const enrichResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Te egy magyar KKV pályázati tanácsadó vagy. Készíts JSON-t:
{
  "aiSummaryHu": "3-5 mondatos összefoglaló",
  "aiKeyPoints": ["4-6 tömör kulcspont"],
  "aiDifficultyScore": 3,
  "aiSectors": ["max 5 ágazat"]
}

Pályázat:
Cím: ${grant.titleHu || 'N/A'}
Kód: ${grant.code || 'N/A'}
Leírás: ${(detail.descriptionHu as string) || grant.descriptionHu || 'N/A'}
Jogosultság: ${(detail.eligibilityHu as string) || 'N/A'}
Folyamat: ${(detail.applicationStepsHu as string) || 'N/A'}` }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const enrichContent = enrichResponse.choices[0]?.message?.content
      if (enrichContent) {
        const aiData = JSON.parse(enrichContent)

        const searchText = [
          grant.titleHu, grant.code, grant.program,
          (detail.descriptionHu as string) || grant.descriptionHu,
          detail.eligibilityHu as string,
          aiData.aiSummaryHu,
          ...aiData.aiKeyPoints,
          ...aiData.aiSectors,
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
      }
    } catch (err) {
      // Enrichment failure is non-fatal — detail data is already saved
      console.error(`[DeepScrape] Enrich failed for ${label}: ${err instanceof Error ? err.message : String(err)}`)
    }

    enriched++
    console.log(`[DeepScrape] ✓ ${label} done`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return { processed: grants.length, enriched, skipped, errors }
}
