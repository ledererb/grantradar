import OpenAI from 'openai'

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined
}

export const openai = globalForOpenAI.openai ?? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

if (process.env.NODE_ENV !== 'production') globalForOpenAI.openai = openai

/**
 * Generate an embedding vector for semantic search.
 * Uses text-embedding-3-small (1536 dims) for cost efficiency.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Enrich a grant with AI-generated summary, key points, and difficulty score.
 */
export async function enrichGrant(grantData: {
  titleHu?: string | null
  code?: string | null
  program?: string | null
  descriptionHu?: string | null
  eligibleSizes?: string[]
  supportIntensityPct?: number | null
  minAmountHuf?: bigint | null
  maxAmountHuf?: bigint | null
}) {
  const prompt = `Te egy magyar KKV pályázati tanácsadó vagy. Az alábbi nyers pályázati adatok alapján készítsd el a következőket:

1. Egy 2-3 mondatos összefoglaló (aiSummaryHu) — mi ez a pályázat, kinek szól, mire kaphat támogatást
2. 3-5 kulcspont (aiKeyPoints) — a legfontosabb tudnivalók röviden
3. Nehézségi szint (aiDifficultyScore) 1-5 skálán (1 = könnyű, 5 = nagyon bonyolult)
4. Releváns ágazatok listája (aiSectors) — max 5

Pályázat adatai:
Cím: ${grantData.titleHu || 'N/A'}
Kód: ${grantData.code || 'N/A'}
Program: ${grantData.program || 'N/A'}
Leírás: ${grantData.descriptionHu || 'N/A'}
Méret: ${grantData.eligibleSizes?.join(', ') || 'N/A'}
Támogatási intenzitás: ${grantData.supportIntensityPct || 'N/A'}%
Összeg: ${grantData.minAmountHuf?.toString() || '?'} - ${grantData.maxAmountHuf?.toString() || '?'} HUF

Válaszolj JSON formátumban:
{
  "aiSummaryHu": "...",
  "aiKeyPoints": ["...", "..."],
  "aiDifficultyScore": 3,
  "aiSectors": ["Feldolgozóipar", "IT", ...]
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No AI response received')

  return JSON.parse(content) as {
    aiSummaryHu: string
    aiKeyPoints: string[]
    aiDifficultyScore: number
    aiSectors: string[]
  }
}
