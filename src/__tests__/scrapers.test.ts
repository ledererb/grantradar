import { describe, it, expect } from 'vitest'
import { parseGrantCard, parseKapAmountHuf } from '@/lib/scrapers/kap'
import { mapEuStatus, buildEuTopicUrl } from '@/lib/scrapers/eu-portal'
import { htmlToMarkdown } from '@/lib/firecrawl'

describe('Scrapers parsing & normalization', () => {
  it('parses KAP grant card HTML with onclick window.open and arrow img', () => {
    const sampleHtml = `
      <div class="pbitem">
        <div class="row">
          <div class="col-8 pbtitle">LEADER Helyi Akciócsoportok támogatása - KAP-RD57-24</div>
          <div class="col-4"><div class="pstatus"><img src="/themes/kap/images/status-aktiv-f.png">Aktív</div></div>
        </div>
        <div class="row">
          <div class="col-sm-4"><label class="form-label">Támogatás minimum összege</label>nincs megadva</div>
          <div class="col-sm-4"><label class="form-label">Támogatás maximum összege</label>50.000 eurónak megfelelő forintösszeg</div>
          <div class="col-sm-4"><label class="form-label">Támogatás formája</label>Vissza nem térítendő támogatás (VNT)</div>
        </div>
        <div class="row">
          <div class="col-8">
            <label class="form-label">Beadási időszak</label>
            2026-04-23 <img src="/themes/kap/images/arrow.png"> 2026-05-06
          </div>
          <div class="col-4 submitter2">
            <button onclick="window.open('/tamogatas/kap-rd57-24', '_self');" class="btn-own">Tovább<span> a támogatáshoz</span></button>
          </div>
        </div>
      </div>
    `

    const parsed = parseGrantCard(sampleHtml)
    expect(parsed.code).toBe('KAP-RD57-24')
    expect(parsed.title).toBe('LEADER Helyi Akciócsoportok támogatása')
    expect(parsed.status).toBe('Aktív')
    expect(parsed.detailUrl).toBe('/tamogatas/kap-rd57-24')
    expect(parsed.startDate).toBe('2026-04-23')
    expect(parsed.endDate).toBe('2026-05-06')
    expect(parseKapAmountHuf(parsed.minAmount)).toBeNull()
    expect(parseKapAmountHuf(parsed.maxAmount)).toBe(20_000_000)
  })

  it('maps EU SEDIA status codes and topic URLs accurately', () => {
    expect(mapEuStatus('31094502', '1')).toBe('OPEN')
    expect(mapEuStatus('31094501', '2')).toBe('FORTHCOMING')
    expect(mapEuStatus('31094503', '3')).toBe('CLOSED')

    const urlFromDataJson = buildEuTopicUrl({
      reference: '44257239EDFResearchActions1631145600000en',
      summary: 'Test',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/HORIZON-CL3-2027-01-SSRI-01.json',
      metadata: { identifier: ['HORIZON-CL3-2027-01-SSRI-01'] },
    })
    expect(urlFromDataJson).toBe(
      'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/horizon-cl3-2027-01-ssri-01',
    )

    const urlFromPortalScreen = buildEuTopicUrl({
      reference: '44087099',
      summary: 'Cascade call',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/competitive-calls-cs/44087099',
      metadata: {},
    })
    expect(urlFromPortalScreen).toBe(
      'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/competitive-calls-cs/44087099',
    )
  })

  it('converts HTML to clean Markdown and strips nav/header/footer', () => {
    const html = `
      <html>
        <header><a href="/menu">Menu</a></header>
        <main>
          <h1>Aktuális felhívások</h1>
          <p>Pályázat: <a href="/palyazat/ginop-1">GINOP Plusz 1.2.4</a></p>
        </main>
        <footer>Footer text</footer>
      </html>
    `
    const md = htmlToMarkdown(html)
    expect(md).not.toContain('Menu')
    expect(md).not.toContain('Footer text')
    expect(md).toContain('# Aktuális felhívások')
    expect(md).toContain('[GINOP Plusz 1.2.4](/palyazat/ginop-1)')
  })
})
