import Firecrawl from '@mendable/firecrawl-js'
import https from 'node:https'

const globalForFirecrawl = globalThis as unknown as {
  firecrawl: Firecrawl | undefined
}

const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-placeholder-build'
const hasValidFirecrawlKey =
  Boolean(process.env.FIRECRAWL_API_KEY) &&
  process.env.FIRECRAWL_API_KEY !== 'fc-placeholder-build'

export const firecrawl = globalForFirecrawl.firecrawl ?? new Firecrawl({
  apiKey,
})

if (process.env.NODE_ENV !== 'production') globalForFirecrawl.firecrawl = firecrawl

/**
 * Convert raw HTML into clean, compact Markdown for LLM extraction.
 * Strips scripts, styles, SVGs, and site navigation headers/footers while
 * preserving links (`[label](href)`) and headings (`#`).
 */
export function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Convert links <a href="...">label</a> -> [label](href)
  text = text.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, inner: string) => {
      const cleanInner = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (!cleanInner || href.startsWith('javascript:') || href === '#') return cleanInner
      return ` [${cleanInner}](${href}) `
    },
  )

  // Convert headings
  text = text.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, inner: string) => {
      const cleanInner = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return `\n${'#'.repeat(Number(level))} ${cleanInner}\n`
    },
  )

  // Convert block elements to newlines
  text = text.replace(/<\/(p|div|li|tr|section|article|br)>/gi, '\n')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()

  return text
}

/**
 * Fetch HTML over HTTPS with automatic fallback for Hungarian gov/bank servers
 * (e.g. mfb.hu) that omit intermediate CA certificates in their TLS chain.
 */
async function fetchRawHtml(url: string): Promise<string> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
  }

  try {
    const resp = await fetch(url, { headers, redirect: 'follow' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
    return await resp.text()
  } catch (err) {
    const causeCode = (err as { cause?: { code?: string } })?.cause?.code
    if (causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || causeCode === 'CERT_HAS_EXPIRED') {
      return new Promise<string>((resolve, reject) => {
        const req = https.get(
          url,
          { headers, rejectUnauthorized: false, timeout: 15000 },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              const nextUrl = new URL(res.headers.location, url).toString()
              fetchRawHtml(nextUrl).then(resolve).catch(reject)
              return
            }
            const chunks: Buffer[] = []
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          },
        )
        req.on('error', reject)
      })
    }
    throw err
  }
}

/**
 * Scrape a single URL into Markdown.
 * Uses Firecrawl when configured, and falls back to direct HTTP HTML-to-Markdown
 * conversion when Firecrawl is unconfigured, out of credits, or returns empty content.
 */
export async function scrapeGrantPage(url: string): Promise<{ markdown?: string }> {
  if (hasValidFirecrawlKey) {
    try {
      const result = await firecrawl.scrape(url, {
        formats: ['markdown'],
      })
      if (result?.markdown && result.markdown.length >= 200) {
        return result
      }
    } catch (err) {
      console.warn(
        `[Scrape] Firecrawl failed for ${url}, falling back to direct HTTP fetch:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  try {
    const html = await fetchRawHtml(url)
    const markdown = htmlToMarkdown(html)
    return { markdown }
  } catch (err) {
    console.error(
      `[Scrape] Direct HTTP fallback failed for ${url}:`,
      err instanceof Error ? err.message : err,
    )
    return { markdown: '' }
  }
}

/**
 * Crawl a website and discover all grant-related pages.
 */
export async function crawlGrantSite(url: string, options?: {
  maxPages?: number
  includePaths?: string[]
  excludePaths?: string[]
}) {
  const result = await firecrawl.crawl(url, {
    limit: options?.maxPages || 50,
    includePaths: options?.includePaths,
    excludePaths: options?.excludePaths,
    scrapeOptions: {
      formats: ['markdown'],
    },
  })

  return result
}
