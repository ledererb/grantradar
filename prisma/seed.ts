import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

/**
 * Seed script to populate the Source table with all 14 grant sources.
 */
async function main() {
  console.log('Seeding sources...')
  console.log('DB:', process.env.DATABASE_URL?.substring(0, 60) + '...')

  const sources = [
    // ─── HUNGARIAN SOURCES ───
    {
      name: 'palyazat.gov.hu',
      slug: 'palyazat-gov-hu',
      url: 'https://palyazat.gov.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 3 * * *',
    },
    {
      name: 'NKFIH (K+F+I)',
      slug: 'nkfih',
      url: 'https://nkfih.gov.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_CRAWL' as const,
      cronSchedule: '0 3 * * *',
    },
    {
      name: 'DIMOP Plusz',
      slug: 'dimop-plusz',
      url: 'https://digitalismegujulas.kormany.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_CRAWL' as const,
      cronSchedule: '0 4 * * 1',
    },
    {
      name: 'KAVOSZ (Széchenyi Kártya)',
      slug: 'kavosz',
      url: 'https://kavosz.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 4 * * 1',
    },
    {
      name: 'MFB (Fejlesztési Bank)',
      slug: 'mfb',
      url: 'https://mfb.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 4 * * 1',
    },
    {
      name: 'HIPA (Beruházás Ösztönzés)',
      slug: 'hipa',
      url: 'https://hipa.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 4 1 * *',
    },
    {
      name: 'VOSZ Port (Hírek)',
      slug: 'voszport',
      url: 'https://voszport.com',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_CRAWL' as const,
      cronSchedule: '0 3 * * *',
    },
    {
      name: 'OFA (Foglalkoztatás)',
      slug: 'ofa',
      url: 'https://ofa.hu',
      country: 'HU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 4 * * 1',
    },
    // ─── EU SOURCES ───
    {
      name: 'EU Funding & Tenders Portal',
      slug: 'eu-funding-portal',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
      country: 'EU' as const,
      crawlMethod: 'API' as const,
      cronSchedule: '0 1 * * *',
    },
    {
      name: 'EIC Accelerator',
      slug: 'eic-accelerator',
      url: 'https://eic.ec.europa.eu',
      country: 'EU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 2 * * 1',
    },
    {
      name: 'EUREKA / Eurostars',
      slug: 'eureka',
      url: 'https://www.eurekanetwork.org',
      country: 'INT' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 2 1 * *',
    },
    {
      name: 'Enterprise Europe Network',
      slug: 'een',
      url: 'https://een.ec.europa.eu',
      country: 'EU' as const,
      crawlMethod: 'FIRECRAWL_CRAWL' as const,
      cronSchedule: '0 2 * * 1',
    },
    {
      name: 'Interreg Central Europe',
      slug: 'interreg-central',
      url: 'https://www.interreg-central.eu',
      country: 'EU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 2 1 * *',
    },
    {
      name: 'EIF/EIB (Garanciaprogramok)',
      slug: 'eif-eib',
      url: 'https://www.eif.org',
      country: 'EU' as const,
      crawlMethod: 'FIRECRAWL_SCRAPE' as const,
      cronSchedule: '0 2 1 * *',
    },
  ]

  for (const source of sources) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      update: source,
      create: source,
    })
    console.log(`  ✓ ${source.name}`)
  }

  console.log(`\nSeeded ${sources.length} sources.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
