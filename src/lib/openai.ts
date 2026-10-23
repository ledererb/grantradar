import OpenAI from 'openai'

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined
}

export const openai = globalForOpenAI.openai ?? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-build',
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
  const prompt = `Te egy vezető magyar KKV és agrár pályázati tanácsadó vagy (GINOP Plusz, DIMOP Plusz, KAP, NKFIH, MFB/KAVOSZ szakértő).
Az alábbi pályázati adatok alapján készítsd el a strukturált elemzést:

1. Egy 3-4 mondatos gyakorlati összefoglaló (aiSummaryHu) — mi a pályázat célja, pontosan ki indulhat (cégforma, KKV/agrár státusz, régió), mire ad pénzt és milyen konstrukcióban (VNT / hitel / kombinált).
2. 4-6 tömör, szakmai kulcspont (aiKeyPoints), amelyek tartalmazzák:
   - Jogosultsági alapkövetelmény (pl. lezárt üzleti évek száma, KNYR/STÉ agrárnál, digitális érettség DIMOP+-nál, régiós korlát GINOP+-nál)
   - Támogatható költségek köre (pl. új gép/technológia, IKT/szoftver, építés, energetika, bér)
   - Pénzügyi keret, támogatási intenzitás / elvárt önerő és állami támogatási jogcím (pl. De minimis, regionális beruházási, KAP)
   - Legfontosabb bukópont / kockázat (pl. túl korai projektkezdés tilalma, árbevétel-arányosság, önálló hardver korlát, 12 hónapos 10%-os elszámolás)
3. Nehézségi szint (aiDifficultyScore) 1-5 skálán (1 = egyszerű de minimis / hitel, 3 = sztenderd beruházási VNT, 5 = komplex K+F+I vagy többlépcsős EU pályázat)
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
