import { formatHuf } from './utils'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type LegalForm = 'KFT_ZRT' | 'EV' | 'OSTERMELO' | 'SZOVETKEZET' | 'EGYEB' | ''
export type TriState = 'YES' | 'NO' | 'UNKNOWN'
export type LocationRight = 'OWNED' | 'RENTED' | 'PLANNED' | 'UNKNOWN'

export interface CompanyPreScreenProfile {
  companyName: string
  taxNumber: string
  companySizePref: string[]
  sectorPrefs: string[]
  regions: string[]
  // Extended "2 perces előszűrés" fields (Section 1, 2, 9)
  legalForm: LegalForm
  closedFiscalYears: number | null
  headcount: number | null
  annualRevenueM: number | null // in Million HUF
  positiveEquity: TriState
  noTaxDebt: TriState
  locationRight: LocationRight
  ownContributionPct: number | null
  deMinimisUsedEur: number | null
  isAgriProducer: boolean
  hasKnyr: TriState
  steValue: number | null
  agriRevenuePct: number | null
  hasUnifiedApplication: TriState
}

export const DEFAULT_PRE_SCREEN_PROFILE: CompanyPreScreenProfile = {
  companyName: '',
  taxNumber: '',
  companySizePref: [],
  sectorPrefs: [],
  regions: [],
  legalForm: '',
  closedFiscalYears: null,
  headcount: null,
  annualRevenueM: null,
  positiveEquity: 'UNKNOWN',
  noTaxDebt: 'UNKNOWN',
  locationRight: 'UNKNOWN',
  ownContributionPct: null,
  deMinimisUsedEur: null,
  isAgriProducer: false,
  hasKnyr: 'UNKNOWN',
  steValue: null,
  agriRevenuePct: null,
  hasUnifiedApplication: 'UNKNOWN',
}

const META_PREFIX = 'meta:'

/**
 * Serialize extended pre-screening fields into `regionPrefs` (TEXT[]) alongside
 * plain region names so no breaking DB schema migration is required.
 */
export function serializeRegionPrefsWithMeta(profile: Partial<CompanyPreScreenProfile>): string[] {
  const cleanRegions = (profile.regions || []).filter(r => !r.startsWith(META_PREFIX))
  const metaEntries: string[] = []

  const addMeta = (key: string, val: unknown) => {
    if (val === undefined || val === null || val === '' || val === 'UNKNOWN') return
    metaEntries.push(`${META_PREFIX}${key}=${String(val)}`)
  }

  addMeta('legalForm', profile.legalForm)
  addMeta('closedFiscalYears', profile.closedFiscalYears)
  addMeta('headcount', profile.headcount)
  addMeta('annualRevenueM', profile.annualRevenueM)
  addMeta('positiveEquity', profile.positiveEquity)
  addMeta('noTaxDebt', profile.noTaxDebt)
  addMeta('locationRight', profile.locationRight)
  addMeta('ownContributionPct', profile.ownContributionPct)
  addMeta('deMinimisUsedEur', profile.deMinimisUsedEur)
  if (profile.isAgriProducer) addMeta('isAgriProducer', 'true')
  addMeta('hasKnyr', profile.hasKnyr)
  addMeta('steValue', profile.steValue)
  addMeta('agriRevenuePct', profile.agriRevenuePct)
  addMeta('hasUnifiedApplication', profile.hasUnifiedApplication)

  return [...cleanRegions, ...metaEntries]
}

/**
 * Parse a Prisma `UserProfile` row into a full `CompanyPreScreenProfile`.
 */
export function parseUserProfile(raw: {
  companyName?: string | null
  taxNumber?: string | null
  companySizePref?: string[] | null
  sectorPrefs?: string[] | null
  regionPrefs?: string[] | null
} | null | undefined): CompanyPreScreenProfile {
  if (!raw) return { ...DEFAULT_PRE_SCREEN_PROFILE }

  const regionPrefs = raw.regionPrefs || []
  const regions: string[] = []
  const meta: Record<string, string> = {}

  for (const item of regionPrefs) {
    if (item.startsWith(META_PREFIX)) {
      const eqIdx = item.indexOf('=')
      if (eqIdx > META_PREFIX.length) {
        const k = item.slice(META_PREFIX.length, eqIdx)
        const v = item.slice(eqIdx + 1)
        meta[k] = v
      }
    } else {
      regions.push(item)
    }
  }

  const parseNum = (v?: string): number | null => {
    if (v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const parseTri = (v?: string): TriState =>
    v === 'YES' || v === 'NO' ? v : 'UNKNOWN'

  const parseLoc = (v?: string): LocationRight =>
    v === 'OWNED' || v === 'RENTED' || v === 'PLANNED' ? v : 'UNKNOWN'

  const parseLegal = (v?: string): LegalForm =>
    v === 'KFT_ZRT' || v === 'EV' || v === 'OSTERMELO' || v === 'SZOVETKEZET' || v === 'EGYEB' ? v : ''

  return {
    companyName: raw.companyName || '',
    taxNumber: raw.taxNumber || '',
    companySizePref: raw.companySizePref || [],
    sectorPrefs: raw.sectorPrefs || [],
    regions,
    legalForm: parseLegal(meta.legalForm),
    closedFiscalYears: parseNum(meta.closedFiscalYears),
    headcount: parseNum(meta.headcount),
    annualRevenueM: parseNum(meta.annualRevenueM),
    positiveEquity: parseTri(meta.positiveEquity),
    noTaxDebt: parseTri(meta.noTaxDebt),
    locationRight: parseLoc(meta.locationRight),
    ownContributionPct: parseNum(meta.ownContributionPct),
    deMinimisUsedEur: parseNum(meta.deMinimisUsedEur),
    isAgriProducer: meta.isAgriProducer === 'true',
    hasKnyr: parseTri(meta.hasKnyr),
    steValue: parseNum(meta.steValue),
    agriRevenuePct: parseNum(meta.agriRevenuePct),
    hasUnifiedApplication: parseTri(meta.hasUnifiedApplication),
  }
}

// ─── SAVED GRANT CHECKLIST SERIALIZATION ────────────────────────────────────

export interface SavedGrantState {
  notes: string
  checkedDocs: string[]
}

export function parseSavedGrantState(rawNotes: string | null | undefined): SavedGrantState {
  if (!rawNotes) return { notes: '', checkedDocs: [] }
  try {
    const parsed = JSON.parse(rawNotes)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.checkedDocs)) {
      return {
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        checkedDocs: parsed.checkedDocs.filter((x: unknown): x is string => typeof x === 'string'),
      }
    }
  } catch {
    // Plain text note from legacy format
  }
  return { notes: rawNotes, checkedDocs: [] }
}

export function serializeSavedGrantState(state: SavedGrantState): string {
  return JSON.stringify({
    notes: state.notes || '',
    checkedDocs: Array.from(new Set(state.checkedDocs)),
  })
}

// ─── PROGRAM CLASSIFICATION & HANDBOOK KNOWLEDGE (SECTIONS 4–13) ───────────

export type ProgramFamily = 'GINOP_PLUSZ' | 'DIMOP_PLUSZ' | 'KAP' | 'LOAN_INSTRUMENT' | 'NKFIH_RDI' | 'GENERAL_HU_EU'

export interface ProgramProfile {
  family: ProgramFamily
  name: string
  focus: string
  typicalApplicant: string
  keyEligibilityData: string
  typicalCosts: string
  keyRisk: string
  financingModel: string
  specificRules: string[]
}

export function classifyGrantProgram(grant: {
  code?: string | null
  program?: string | null
  titleHu?: string | null
  fundingType?: string | null
  source?: { name?: string | null } | null
}): ProgramProfile {
  const haystack = [
    grant.code,
    grant.program,
    grant.titleHu,
    grant.source?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('kap') || haystack.includes('agrár') || haystack.includes('mezőgazdaság') || haystack.includes('erdő')) {
    return {
      family: 'KAP',
      name: 'KAP (Közös Agrárpolitika)',
      focus: 'Mezőgazdaság, élelmiszeripar, vidéki beruházás',
      typicalApplicant: 'Mezőgazdasági termelő, őstermelő, ŐCSG, EV, agrár gazdasági társaság vagy szövetkezet',
      keyEligibilityData: 'KNYR-regisztráció, STÉ üzemméret, Egységes Kérelem (EK), mezőgazdasági árbevétel aránya, MePAR/ENAR/TIR',
      typicalCosts: 'Mezőgazdasági gép, technológia, állattartó telep, építés, ültetvény, erőgép',
      keyRisk: 'STÉ üzemméret, mezőgazdasági árbevétel arány, agrár-nyilvántartások és a 12 hónapon belüli >10%-os elszámolási kötelezettség',
      financingModel: 'Jellemzően vissza nem térítendő támogatás (VNT), célterülettől függő (akár 50–85%) intenzitással',
      specificRules: [
        'Kedvezményezetti Nyilvántartási Rendszer (KNYR) regisztráció alapfeltétel.',
        'Sok beruházási felhívás minimum/maximum üzemméretet ír elő Standard Termelési Érték (STÉ) alapján.',
        'A növénytermesztési üzemméret alapja az adott vagy előző évi Egységes Kérelem (EK).',
        'A támogatási döntés véglegességétől számított 12 hónapon belül a megítélt támogatás több mint 10%-ára elszámolást kell benyújtani (2026-os KAP közlemény).',
        'Elkülönített számviteli nyilvántartás és a beruházás működtetéséhez szükséges kizárólagos jog igazolása kötelező a fenntartási időszakban.',
      ],
    }
  }

  if (haystack.includes('dimop')) {
    return {
      family: 'DIMOP_PLUSZ',
      name: 'DIMOP Plusz (Digitális Megújulás Operatív Program Plusz)',
      focus: 'Digitalizáció, üzleti folyamatok digitalizálása, felhő, kiberbiztonság, MI és fejlett digitális megoldások',
      typicalApplicant: 'Mikro-, kis- és középvállalkozások (KKV) vagy digitális szereplők, konstrukciótól függően',
      keyEligibilityData: 'Lezárt üzleti év + előzetes digitális érettségi mérés / tanúsítvány / szakértői felmérés',
      typicalCosts: 'Szoftver, felhőszolgáltatás, ERP/CRM üzleti rendszerek, kiberbiztonság, korlátozott arányban kapcsolódó hardver',
      keyRisk: 'Digitális tartalom valódisága (nem lehet puszta eszközcsere) és a hardverarány korlátozása',
      financingModel: 'Vissza nem térítendő támogatás (VNT), kedvezményes hitel vagy kombinált finanszírozás régiós keretekkel',
      specificRules: [
        'Igazolni kell, hogy a fejlesztés valódi digitális intenzitás-növekedést hoz, nem pusztán eszközcsere.',
        'Gyakori feltétel az előzetes digitális érettségi felmérés és a vállalt érettségi szint elérése a fenntartási időszakra.',
        'Hardver önmagában általában csak korlátozott százalékban támogatható; szoftver, felhő és folyamatfejlesztés kombinációja elvárt.',
        'Kiberbiztonsági, adatvédelmi és interoperabilitási elvárások jelenhetnek meg.',
      ],
    }
  }

  if (haystack.includes('ginop')) {
    return {
      family: 'GINOP_PLUSZ',
      name: 'GINOP Plusz (Gazdaságfejlesztési és Innovációs Operatív Program Plusz)',
      focus: 'Versenyképesség, technológiai korszerűsítés, kapacitásbővítés, K+F+I, energiahatékonyság, képzés',
      typicalApplicant: 'KKV-k (gyakran mikro- és kisvállalkozásokra fókuszálva)',
      keyEligibilityData: '1–2 lezárt üzleti év, statisztikai létszám, pénzügyi mutatók (árbevétel, saját tőke), megvalósítási régió',
      typicalCosts: 'Új termelőgép, technológiai rendszer, ingatlan átalakítás/bővítés, megújuló energia, képzés, tanácsadás',
      keyRisk: 'Projektméret vs. éves árbevétel/mérlegfőösszeg aránya, illetve a kevésbé fejlett régiós területi korlátozás',
      financingModel: 'VNT, 0%-os pénzügyi eszköz (MFB Pont Plusz hitel) vagy kombinált (hitel + vissza nem térítendő) konstrukció',
      specificRules: [
        'Sok GINOP Plusz konstrukció kevésbé fejlett régiókban (Budapest és Pest vármegyén kívül) megvalósuló projektekre korlátozódik.',
        'A projekt elszámolható összköltsége általában nem haladhatja meg az utolsó lezárt üzleti év nettó árbevételét vagy mérlegfőösszegét.',
        'Pénzügyi eszköz / kombinált konstrukció esetén banki / MFB Pont Plusz hitelképességi vizsgálat és likviditási terv szükséges.',
      ],
    }
  }

  if (grant.fundingType === 'LOAN' || grant.fundingType === 'GUARANTEE' || haystack.includes('kavosz') || haystack.includes('széchenyi') || haystack.includes('mfb')) {
    return {
      family: 'LOAN_INSTRUMENT',
      name: 'Támogatott Vállalkozói Hitel / Garancia (MFB / KAVOSZ)',
      focus: 'Kedvezményes kamatozású beruházási, forgóeszköz- vagy likviditási finanszírozás',
      typicalApplicant: 'Magyarországi székhelyű vagy telephelyű KKV-k',
      keyEligibilityData: 'Lezárt üzleti év, pozitív saját tőke, köztartozásmentesség, banki hitelképesség és fedezet',
      typicalCosts: 'Beruházás, gépbeszerzés, ingatlan, illetve forgóeszköz- és likviditásfinanszírozás',
      keyRisk: 'Hitelképesség, adósságszolgálati fedezet, biztosítéki kör és szabad De minimis keret',
      financingModel: 'Kedvezményes / kamattámogatott hitel vagy garancia (gyakran De minimis vagy regionális támogatási jogcímmel)',
      specificRules: [
        'A kamattámogatás támogatástartalma általában a vállalkozás szabad De minimis keretét terheli.',
        'Banki hitelbírálat, cash-flow alapú adósságszolgálati vizsgálat és megfelelő biztosítéki fedezet szükséges.',
      ],
    }
  }

  if (haystack.includes('nkfi') || haystack.includes('k+f') || haystack.includes('eic') || haystack.includes('eureka') || haystack.includes('horizon')) {
    return {
      family: 'NKFIH_RDI',
      name: 'K+F+I és Innovációs Pályázat (NKFIH / Horizon / EIC)',
      focus: 'Ipari kutatás, kísérleti fejlesztés, prototípus-fejlesztés és piacra vitel',
      typicalApplicant: 'Innovatív KKV-k, startupok, kutatóhelyekkel konzorciumban induló vállalkozások',
      keyEligibilityData: 'K+F tartalom (újdonságtartalom, TRL szint), szakmai csapat, lezárt üzleti év, saját forrás',
      typicalCosts: 'Kutató-fejlesztő bérköltség, K+F eszközök, igénybe vett K+F szolgáltatás, szabadalom/oltalom, piaci bevezetés',
      keyRisk: 'Valódi K+F újdonságtartalom igazolása (NKFIH szakértői vélemény / minősítés) és a munkaidő-nyilvántartás',
      financingModel: 'Vissza nem térítendő támogatás (tevékenységtípus szerint differenciált intenzitással)',
      specificRules: [
        'Az ipari kutatás és kísérleti fejlesztés eltérő támogatási intenzitással számolható el (K+F+I állami támogatási jogcím).',
        'A személyi jellegű ráfordításoknál szigorú munkaidő-kimutatás (timesheet) és munkaköri leírás szükséges.',
      ],
    }
  }

  return {
    family: 'GENERAL_HU_EU',
    name: 'Vállalkozói Támogatási Konstrukció',
    focus: 'Vállalkozásfejlesztés, beruházás, technológiai és fenntarthatósági fejlesztések',
    typicalApplicant: 'Magyarországi székhelyű/telephelyű mikro-, kis- és középvállalkozások (KKV)',
    keyEligibilityData: 'KKV-minősítés, lezárt üzleti év, rendezett köztartozás és munkaügyi státusz, megfelelő telephely',
    typicalCosts: 'Új eszközbeszerzés, technológia, informatikai fejlesztés, építés/korszerűsítés, tanácsadás',
    keyRisk: 'Túl korai projektkezdés, nem összehasonlítható árajánlatok, projektméret aránytalansága',
    financingModel: 'Vissza nem térítendő támogatás vagy kombinált finanszírozás',
    specificRules: [
      'A projektet nem szabad a felhívásban megengedettnél korábban megkezdeni (megrendelés és szerződéskötés is projektkezdésnek minősülhet!).',
      'Minden támogatott beszerzést piaci áron, összehasonlítható és független árajánlatokkal kell alátámasztani.',
    ],
  }
}

// ─── COST TABLE, STATE AID & PITFALLS (SECTIONS 4, 5, 6, 10, 11) ───────────

export interface CostCategoryRule {
  category: string
  eligible: string
  restriction: string
}

export const TYPICAL_COST_RULES: CostCategoryRule[] = [
  {
    category: 'Gép / technológia',
    eligible: 'Új eszköz, termelőgép, technológiai rendszer',
    restriction: 'Használt eszköz sok felhívásban kizárt; minimum műszaki paraméterek; piaci ár igazolása (független árajánlatok)',
  },
  {
    category: 'IKT / digitalizáció',
    eligible: 'Hardver, szoftver, felhő, üzleti rendszerek (ERP/CRM), kiberbiztonság',
    restriction: 'Önálló irodatechnika vagy nem célhoz kötött eszköz korlátozott; DIMOP+-ban valódi digitális szintlépés kell',
  },
  {
    category: 'Ingatlan / építés',
    eligible: 'Átalakítás, bővítés, új építés, energetikai korszerűsítés',
    restriction: 'Földvásárlás, lakóingatlan, nem projektcélú terület sokszor kizárt; rendezett tulajdoni/használati jog szükséges',
  },
  {
    category: 'Energetika',
    eligible: 'Energiahatékonyság, megújuló energia, energiatárolás',
    restriction: 'Méretezési korlátok, energetikai audit, saját fogyasztásra termelés, állami támogatási szabályok',
  },
  {
    category: 'Immateriális javak',
    eligible: 'Licenc, know-how, szoftver, szabadalom',
    restriction: 'Kapcsolt féltől történő beszerzés vagy nem piaci ár kizáró/szabálytalansági kockázat',
  },
  {
    category: 'Tanácsadás / szolgáltatás',
    eligible: 'Projekt-előkészítés, audit, tanúsítás, képzés, projektmenedzsment',
    restriction: 'Gyakran százalékos plafon (pl. összköltség max. 5–10%-a) és szakértői akkreditációhoz kötött',
  },
  {
    category: 'Bérköltség',
    eligible: 'K+F személyi költség, képzés, foglalkoztatás, projektmenedzsment',
    restriction: 'Szigorú munkaidő-kimutatás (timesheet), munkaköri kapcsolat és támogatási intenzitási korlát',
  },
]

export interface StateAidRule {
  title: string
  expectation: string
  preparation: string
}

export const STATE_AID_RULES: StateAidRule[] = [
  {
    title: 'De minimis (csekély összegű támogatás)',
    expectation: 'Kisebb támogatások; a vállalkozás és kapcsolt vállalkozásai („egyetlen vállalkozás”) 3 éves szabad keretének vizsgálata szükséges.',
    preparation: 'Korábbi de minimis támogatások nyilvántartása (támogatástartalom igazolások).',
  },
  {
    title: 'Regionális beruházási támogatás',
    expectation: 'Beruházási hely (régió), vállalkozásméret (mikro/kis/közép) és induló beruházás jellege szerint eltérő maximális támogatási intenzitás.',
    preparation: 'Telephely igazolása, projektméret, induló beruházás (kapacitásbővítés / új telephely / új termék) igazolása.',
  },
  {
    title: 'KKV beruházási / tanácsadási támogatás',
    expectation: 'Kifejezetten KKV-k részére nyújtott támogatási jogcím, költségkategóriától függő intenzitással.',
    preparation: 'Pontos KKV-minősítés (kapcsolt és partnervállalkozások beszámításával).',
  },
  {
    title: 'K+F+I támogatás',
    expectation: 'Ipari kutatás, kísérleti fejlesztés és innováció eltérő támogatási intenzitással.',
    preparation: 'Projektbesorolás (NKFIH szakértői minősítés), kutatói személyi és kutatási költségek elkülönítése.',
  },
  {
    title: 'Mezőgazdasági állami támogatás (KAP)',
    expectation: 'KAP konstrukcióknál külön uniós és hazai agrártámogatási szabályok és intenzitási plafonok érvényesülnek.',
    preparation: 'Mezőgazdasági termelői státusz, STÉ üzemméret, Egységes Kérelem (EK) és KNYR adatok.',
  },
]

export const COMMON_PITFALLS: string[] = [
  'Túl korai projektkezdés: a pályázat benyújtása (vagy a felhívásban megengedett dátum) előtt aláírt megrendelés, szerződés vagy előlegfizetés a teljes támogatás elvesztését okozhatja!',
  'Lezárt üzleti év / létszám / árbevétel hiánya: a pályázó nem éri el a felhívásban előírt minimum működési múltat vagy pénzügyi méretet.',
  'Projektméret aránytalansága: az igényelt támogatás vagy projektköltség meghaladja az utolsó lezárt év nettó árbevételét vagy mérlegfőösszegét.',
  'Saját tőke probléma: negatív saját tőke, vagy a saját tőke a jegyzett tőke (illetve a jogszabályi minimum) alá csökkent.',
  'Telephely és használati jog hiánya: a megvalósítási helyszín nincs időben bejegyezve a cégkivonatba, vagy nincs a fenntartási időszak végéig szóló tulajdon-/bérleti jog és tulajdonosi hozzájárulás.',
  'Területi korlátozás (régió): pl. Budapest/Pest vármegyei telephely olyan GINOP Plusz konstrukcióban, amely csak kevésbé fejlett régiókban engedélyezett.',
  'Nem megfelelő árajánlatok: nem független (kapcsolt/partner cégtől kért), műszakilag nem összehasonlítható vagy hiányos tartalmú árajánlatok.',
  'Hibás KKV-minősítés: a tulajdonosi láncban lévő kapcsolt és partnervállalkozások adatait nem számolták össze.',
  'Likviditási és önerő hiány: vissza nem térítendő támogatásnál is jelentős az előfinanszírozási igény; hiteles konstrukciónál a banki hitelképesség külön szűrő.',
  'Fenntartási vállalások: a pontozásnál vállalt létszám-, árbevétel- vagy digitális érettségi növekedést a fenntartási időszakban (3–5 év) számon kérik.',
]

// ─── 12. PÁLYÁZAT-ELŐKÉSZÍTÉSI DOKUMENTUMLISTA ─────────────────────────────

export interface PreparationDocItem {
  id: string
  area: string
  document: string
  hint: string
  kapOnly?: boolean
}

export const PREPARATION_CHECKLIST_ITEMS: PreparationDocItem[] = [
  {
    id: 'ceg_jogallas',
    area: 'Cég és jogállás',
    document: 'Cégkivonat / EV nyilvántartás / Őstermelői igazolvány / Szövetkezet / KNYR',
    hint: 'Ellenőrizd a főtevékenységet és a fejlesztendő TEÁOR/ÖVTJ kódok meglétét.',
  },
  {
    id: 'penzugy_beszamolo',
    area: 'Pénzügy és köztartozás',
    document: 'Utolsó 2–3 év beszámolója, főkönyvi kivonat, NAV KOMA igazolás',
    hint: 'Pozitív saját tőke, árbevétel vs. projektméret arány és köztartozásmentes státusz ellenőrzése.',
  },
  {
    id: 'letszam_ber',
    area: 'Létszám',
    document: 'Átlagos statisztikai létszám kimutatás (KSH/NAV) és béradatok',
    hint: 'Bázislétszám rögzítése a benyújtás előtti 12 hónapra.',
  },
  {
    id: 'tulajdonosi_hatter',
    area: 'Tulajdonosi háttér',
    document: 'Kapcsolt és partnervállalkozások listája, KKV-minősítő nyilatkozat',
    hint: 'Minden 25% feletti tulajdoni/szavazati kapcsolódást és közös ügyvezetést vizsgálni kell.',
  },
  {
    id: 'projekt_helyszin',
    area: 'Projekt helyszín',
    document: '30 napnál nem régebbi tulajdoni lap, bérleti szerződés, telephely-bejegyzés, hozzájárulások',
    hint: 'Haszonélvezet, osztatlan közös tulajdon vagy jelzálog esetén írásos hozzájárulás szükséges.',
  },
  {
    id: 'muszaki_tartalom',
    area: 'Műszaki tartalom',
    document: 'Összehasonlítható piaci árajánlatok (min. 2–3 db független), műszaki specifikáció, tervek',
    hint: 'Azonos műszaki paraméterek, nettó/bruttó ár, érvényesség és cégszerű aláírás.',
  },
  {
    id: 'finanszirozas',
    area: 'Finanszírozás',
    document: 'Önerő igazolás (bankszámlakivonat), banki hitelígérvény, likviditási terv',
    hint: 'Az előfinanszírozáshoz és a nem elszámolható költségekhez (pl. ÁFA) szükséges forrás.',
  },
  {
    id: 'allami_tamogatas',
    area: 'Állami támogatás',
    document: 'Korábbi De minimis és egyéb állami támogatások kimutatása',
    hint: 'Egyetlen vállalkozás szintjén (kapcsolt cégekkel együtt) vett 3 éves De minimis keret.',
  },
  {
    id: 'kap_specifikus',
    area: 'KAP-specifikus (Agrár)',
    document: 'STÉ kalkuláció, Egységes Kérelem (EK), MePAR, ENAR/TIR, mezőgazdasági árbevétel igazolás',
    hint: 'KNYR nyilvántartási szám, üzemméret (STÉ) és min. 40–50% mezőgazdasági árbevétel arány.',
    kapOnly: true,
  },
  {
    id: 'vallalasok',
    area: 'Vállalások és fenntartás',
    document: 'Üzleti terv, létszám-/energia-/kapacitás-/digitális érettségi vállalások kalkulációja',
    hint: 'Csak olyan pontozási vállalást tegyél, amely a 3–5 éves fenntartási időszakban teljesíthető.',
  },
]

// ─── 2-MINUTE PRE-SCREENING & ELIGIBILITY MATRIX EVALUATOR ─────────────────

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'CHECK'

export interface EligibilityMatrixRow {
  id: string
  checkpoint: string
  expectation: string
  companyState: string
  documentToPrepare: string
  status: CheckStatus
  riskNote: string
}

export interface EligibilityEvaluation {
  programProfile: ProgramProfile
  rows: EligibilityMatrixRow[]
  passedCount: number
  warnCount: number
  failCount: number
  checkCount: number
  profileConfigured: boolean
  verdictLabel: string
  verdictSummary: string
  verdictTone: 'green' | 'amber' | 'red' | 'muted'
}

export function evaluateGrantEligibility(
  grant: {
    code?: string | null
    program?: string | null
    titleHu?: string | null
    fundingType?: string | null
    minAmountHuf?: bigint | number | string | null
    maxAmountHuf?: bigint | number | string | null
    supportIntensityPct?: number | null
    eligibleSizes?: string[] | null
    eligibleRegions?: string[] | null
    eligibilityHu?: string | null
    descriptionHu?: string | null
    source?: { name?: string | null; country?: string | null } | null
  },
  profile?: CompanyPreScreenProfile | null,
): EligibilityEvaluation {
  const programProfile = classifyGrantProgram(grant)
  const p = profile || DEFAULT_PRE_SCREEN_PROFILE
  const profileConfigured = Boolean(
    p.companySizePref.length > 0 ||
    p.legalForm ||
    p.closedFiscalYears !== null ||
    p.annualRevenueM !== null ||
    p.regions.length > 0
  )

  const eligText = [grant.eligibilityHu, grant.descriptionHu, grant.titleHu]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const rows: EligibilityMatrixRow[] = []

  // 1. Pályázói kör és cégméret
  const allowedSizes = grant.eligibleSizes && grant.eligibleSizes.length > 0
    ? grant.eligibleSizes
    : ['MICRO', 'SMALL', 'MEDIUM']
  const sizeLabels: Record<string, string> = {
    MICRO: 'Mikro (0–9 fő)',
    SMALL: 'Kis (10–49 fő)',
    MEDIUM: 'Közép (50–249 fő)',
  }
  const legalLabels: Record<string, string> = {
    KFT_ZRT: 'Gazdasági társaság (Kft./Zrt./Bt.)',
    EV: 'Egyéni vállalkozó',
    OSTERMELO: 'Mezőgazdasági őstermelő / ŐCSG',
    SZOVETKEZET: 'Szövetkezet',
    EGYEB: 'Egyéb szervezet',
  }

  let sizeStatus: CheckStatus = 'CHECK'
  let sizeNote = 'Állítsd be a cégméretet és a szervezeti formát a Beállításokban.'
  if (p.companySizePref.length > 0 || p.legalForm) {
    const matchesSize = p.companySizePref.length === 0 || p.companySizePref.some(s => allowedSizes.includes(s))
    if (programProfile.family === 'KAP' && p.legalForm && !p.isAgriProducer && p.legalForm !== 'OSTERMELO') {
      sizeStatus = 'WARN'
      sizeNote = 'KAP pályázatoknál mezőgazdasági termelői státusz vagy élelmiszeripari jogosultság szükséges.'
    } else if (!matchesSize) {
      sizeStatus = 'FAIL'
      sizeNote = `A pályázat célcsoportja (${allowedSizes.map(s => sizeLabels[s] || s).join(', ')}) eltér a megadott cégmérettől.`
    } else {
      sizeStatus = 'PASS'
      sizeNote = 'A cégméret megfelel; a kapcsolt és partnervállalkozások adatait is össze kell számolni a KKV-minősítéshez.'
    }
  }

  rows.push({
    id: 'applicant_scope',
    checkpoint: 'Pályázói kör és KKV-minősítés',
    expectation: `${allowedSizes.map(s => sizeLabels[s] || s).join(', ')} • ${programProfile.typicalApplicant}`,
    companyState: [
      p.legalForm ? legalLabels[p.legalForm] : null,
      p.companySizePref.length > 0 ? p.companySizePref.map(s => sizeLabels[s] || s).join(', ') : null,
    ].filter(Boolean).join(' · ') || 'Nincs megadva',
    documentToPrepare: 'Cégkivonat / EV nyilvántartás / KKV-minősítő nyilatkozat (kapcsolt cégekkel)',
    status: sizeStatus,
    riskNote: sizeNote,
  })

  // 2. Működési múlt (lezárt üzleti évek)
  const requiresTwoYears = eligText.includes('két lezárt') || eligText.includes('2 lezárt')
  const allowsStartup = eligText.includes('induló') || eligText.includes('startup') || eligText.includes('fiatal')
  const minYears = allowsStartup ? 0 : requiresTwoYears ? 2 : 1

  let yearsStatus: CheckStatus = 'CHECK'
  let yearsNote = 'Ellenőrizd az éves beszámolóval lezárt teljes (365 napos) üzleti éveket.'
  if (p.closedFiscalYears !== null) {
    if (p.closedFiscalYears >= minYears) {
      yearsStatus = 'PASS'
      yearsNote = `Megfelel (${p.closedFiscalYears} lezárt üzleti év).`
    } else if (p.closedFiscalYears === 0 && !allowsStartup) {
      yearsStatus = 'FAIL'
      yearsNote = 'Induló vállalkozás (0 lezárt év) a legtöbb beruházási konstrukcióban nem jogosult.'
    } else {
      yearsStatus = 'WARN'
      yearsNote = `A konstrukció jellemzően min. ${minYears} lezárt teljes üzleti évet vár el.`
    }
  }

  rows.push({
    id: 'operating_history',
    checkpoint: 'Működési múlt (lezárt üzleti év)',
    expectation: allowsStartup
      ? 'Induló vállalkozások is pályázhatnak (vagy min. 1 lezárt év)'
      : `Legalább ${minYears} lezárt, beszámolóval alátámasztott teljes üzleti év`,
    companyState: p.closedFiscalYears !== null ? `${p.closedFiscalYears} lezárt üzleti év` : 'Nincs megadva',
    documentToPrepare: 'Közzétett éves beszámolók (e-beszámoló), SZJA/EVA/KATA bevallás',
    status: yearsStatus,
    riskNote: yearsNote,
  })

  // 3. Pénzügyi méret vs. projektméret
  const minAmtHuf = grant.minAmountHuf ? Number(grant.minAmountHuf) : null
  const maxAmtHuf = grant.maxAmountHuf ? Number(grant.maxAmountHuf) : null
  let finStatus: CheckStatus = 'CHECK'
  let finNote = 'A projekt összköltsége általában nem haladhatja meg az utolsó lezárt év nettó árbevételét vagy mérlegfőösszegét.'
  if (p.annualRevenueM !== null) {
    const revHuf = p.annualRevenueM * 1_000_000
    if (minAmtHuf && revHuf < minAmtHuf * 0.5) {
      finStatus = 'FAIL'
      finNote = `Az éves árbevétel (${p.annualRevenueM} M Ft) alacsony a minimum támogatási összeghez (${formatHuf(minAmtHuf)}) képest.`
    } else if (minAmtHuf && revHuf < minAmtHuf) {
      finStatus = 'WARN'
      finNote = `Az éves árbevétel (${p.annualRevenueM} M Ft) kisebb a minimum támogatási összegnél (${formatHuf(minAmtHuf)}); mérlegfőösszeg vizsgálata szükséges.`
    } else {
      finStatus = 'PASS'
      finNote = `Az árbevétel (${p.annualRevenueM} M Ft) arányos a pályázati kerettel.`
    }
  }

  rows.push({
    id: 'financial_capacity',
    checkpoint: 'Pénzügyi méret (árbevétel vs. projektméret)',
    expectation: minAmtHuf || maxAmtHuf
      ? `Támogatási sáv: ${minAmtHuf ? formatHuf(minAmtHuf) : '—'} – ${maxAmtHuf ? formatHuf(maxAmtHuf) : '—'} (ne legyen aránytalan az árbevételhez képest)`
      : 'A projektméret nem haladhatja meg a vállalkozás éves nettó árbevételét / mérlegfőösszegét',
    companyState: p.annualRevenueM !== null ? `${p.annualRevenueM} millió Ft éves nettó árbevétel` : 'Nincs megadva',
    documentToPrepare: 'Utolsó 1–2 lezárt év eredménykimutatása, mérlege és főkönyvi kivonata',
    status: finStatus,
    riskNote: finNote,
  })

  // 4. Saját tőke és Köztartozásmentesség
  let equityStatus: CheckStatus = 'CHECK'
  let equityNote = 'Negatív saját tőke vagy lejárt köztartozás azonnali kizáró ok.'
  if (p.positiveEquity === 'NO' || p.noTaxDebt === 'NO') {
    equityStatus = 'FAIL'
    equityNote = p.positiveEquity === 'NO'
      ? 'Kizáró ok: negatív vagy jegyzett tőke alá csökkent saját tőke!'
      : 'Kizáró ok: lejárt köztartozás vagy nem rendezett munkaügyi státusz!'
  } else if (p.positiveEquity === 'YES' && p.noTaxDebt === 'YES') {
    equityStatus = 'PASS'
    equityNote = 'Pozitív saját tőke és köztartozásmentes (KOMA) státusz.'
  } else if (p.positiveEquity === 'YES' || p.noTaxDebt === 'YES') {
    equityStatus = 'WARN'
    equityNote = 'Erősítsd meg mind a saját tőke megfelelőségét, mind a NAV KOMA státuszt.'
  }

  rows.push({
    id: 'equity_and_tax',
    checkpoint: 'Saját tőke és köztartozásmentesség',
    expectation: 'Pozitív (jegyzett tőkének megfelelő) saját tőke, NAV köztartozásmentesség, rendezett munkaügy',
    companyState: [
      p.positiveEquity === 'YES' ? 'Saját tőke rendben' : p.positiveEquity === 'NO' ? 'Saját tőke problémás' : null,
      p.noTaxDebt === 'YES' ? 'Köztartozásmentes' : p.noTaxDebt === 'NO' ? 'Köztartozás fennáll' : null,
    ].filter(Boolean).join(' · ') || 'Nincs megadva',
    documentToPrepare: 'Mérleg (saját tőke sor), NAV KOMA szereplés vagy 0-s adóigazolás',
    status: equityStatus,
    riskNote: equityNote,
  })

  // 5. Létszám
  let hcStatus: CheckStatus = 'CHECK'
  let hcNote = 'Egyes felhívások min. 1–3 fő átlagos statisztikai létszámot és annak fenntartását írják elő.'
  if (p.headcount !== null) {
    if (p.headcount >= 1) {
      hcStatus = 'PASS'
      hcNote = `${p.headcount} fő statisztikai létszám — figyelj a fenntartási időszaki létszámtartási kötelezettségre.`
    } else {
      hcStatus = 'WARN'
      hcNote = '0 fős statisztikai létszám sok GINOP+/DIMOP+ beruházási felhívásban kizáró ok lehet.'
    }
  }

  rows.push({
    id: 'headcount',
    checkpoint: 'Átlagos statisztikai létszám',
    expectation: 'Jellemzően min. 1 fő átlagos statisztikai létszám és a bázislétszám megtartása',
    companyState: p.headcount !== null ? `${p.headcount} fő` : 'Nincs megadva',
    documentToPrepare: 'KSH / NAV havi járulékbevallások alapján számított statisztikai létszám kimutatás',
    status: hcStatus,
    riskNote: hcNote,
  })

  // 6. Projekt helyszíne és területi hatály + használati jog
  const isBudapestOnlyProfile = p.regions.length > 0 &&
    p.regions.every(r => r.toLowerCase().includes('budapest') || r.toLowerCase().includes('pest'))
  let locStatus: CheckStatus = 'CHECK'
  let locNote = 'A megvalósítási helyszínnek bejegyzett telephelynek kell lennie, érvényes tulajdon- vagy bérleti joggal.'
  if (programProfile.family === 'GINOP_PLUSZ' && isBudapestOnlyProfile) {
    locStatus = 'WARN'
    locNote = 'Sok GINOP Plusz konstrukció csak a kevésbé fejlett (Budapesten és Pest vármegyén kívüli) régiókban érhető el!'
  } else if (p.regions.length > 0 && (p.locationRight === 'OWNED' || p.locationRight === 'RENTED')) {
    locStatus = 'PASS'
    locNote = 'Megvalósítási régió és helyszín használati jog megadva.'
  } else if (p.locationRight === 'PLANNED') {
    locStatus = 'WARN'
    locNote = 'A telephelyet sok felhívásnál már a benyújtás előtt be kell jegyeztetni a cégkivonatba!'
  }

  const locLabels: Record<LocationRight, string> = {
    OWNED: 'Saját tulajdonú telephely',
    RENTED: 'Bérlemény / használati jog',
    PLANNED: 'Tervezett telephely (még nincs bejegyezve)',
    UNKNOWN: '',
  }

  rows.push({
    id: 'project_location',
    checkpoint: 'Projekt helyszíne és használati jog',
    expectation: programProfile.family === 'GINOP_PLUSZ'
      ? 'Magyarországi (gyakran kevésbé fejlett régiós) bejegyzett telephely + fenntartási időre szóló használati jog'
      : 'Területi hatálynak megfelelő, bejegyzett megvalósítási helyszín + tulajdon/bérleti jog',
    companyState: [
      p.regions.join(', '),
      locLabels[p.locationRight],
    ].filter(Boolean).join(' · ') || 'Nincs megadva',
    documentToPrepare: 'Tulajdoni lap, bérleti szerződés, tulajdonosi/zálogjogosulti hozzájárulás, cégkivonat',
    status: locStatus,
    riskNote: locNote,
  })

  // 7. Önerő és likviditás
  const intensity = grant.supportIntensityPct || (programProfile.family === 'KAP' ? 65 : 50)
  const requiredOwnPct = Math.max(0, 100 - intensity)
  let ownStatus: CheckStatus = 'CHECK'
  let ownNote = `VNT esetén is szükséges a min. ${requiredOwnPct}% önerő igazolása és a számlák előfinanszírozása.`
  if (p.ownContributionPct !== null) {
    if (p.ownContributionPct >= requiredOwnPct) {
      ownStatus = 'PASS'
      ownNote = `A megadott önerő (${p.ownContributionPct}%) fedezi az elvárt ${requiredOwnPct}%-os saját forrás arányt.`
    } else {
      ownStatus = 'WARN'
      ownNote = `A megadott önerő (${p.ownContributionPct}%) alacsonyabb a várható ${requiredOwnPct}% saját forrás igénynél.`
    }
  }

  rows.push({
    id: 'own_contribution',
    checkpoint: 'Önerő, likviditás és támogatási intenzitás',
    expectation: grant.supportIntensityPct
      ? `Max. ${grant.supportIntensityPct}% támogatási intenzitás → min. ${requiredOwnPct}% saját forrás + előfinanszírozás`
      : `Konstrukciótól függő intenzitás (tipikusan ${intensity}% támogatás, ${requiredOwnPct}% önerő)`,
    companyState: p.ownContributionPct !== null ? `${p.ownContributionPct}% rendelkezésre álló önerő` : 'Nincs megadva',
    documentToPrepare: 'Likviditási terv, bankszámlakivonat (saját forrás igazolása) vagy banki hitelígérvény',
    status: ownStatus,
    riskNote: ownNote,
  })

  // 8. KAP-specifikus ellenőrzés (Section 9)
  if (programProfile.family === 'KAP' || p.isAgriProducer) {
    let kapStatus: CheckStatus = 'CHECK'
    let kapNote = 'KAP pályázatoknál a KNYR, STÉ üzemméret, Egységes Kérelem (EK) és mezőgazdasági árbevétel arány kulcsfontosságú.'
    if (p.hasKnyr === 'NO') {
      kapStatus = 'FAIL'
      kapNote = 'KNYR (Kedvezményezetti Nyilvántartási Rendszer) regisztráció hiánya kizáró ok a KAP-ban!'
    } else if (p.hasKnyr === 'YES' && (p.steValue !== null || p.agriRevenuePct !== null)) {
      if (p.agriRevenuePct !== null && p.agriRevenuePct < 40) {
        kapStatus = 'WARN'
        kapNote = `A mezőgazdasági árbevétel aránya (${p.agriRevenuePct}%) sok főállású agrár felhívásban elvárt 40–50% alatt van.`
      } else {
        kapStatus = 'PASS'
        kapNote = 'KNYR regisztráció és agrár alapadatok rögzítve.'
      }
    }

    rows.push({
      id: 'kap_agri_specific',
      checkpoint: 'KAP agrár jogosultság (KNYR, STÉ, EK)',
      expectation: 'KNYR regisztráció, előírt STÉ üzemméret, Egységes Kérelem (EK) és mezőgazdasági árbevétel arány',
      companyState: [
        p.hasKnyr === 'YES' ? 'KNYR regisztrált' : p.hasKnyr === 'NO' ? 'Nincs KNYR' : null,
        p.steValue !== null ? `${p.steValue.toLocaleString('hu-HU')} EUR STÉ` : null,
        p.agriRevenuePct !== null ? `${p.agriRevenuePct}% agrár árbevétel` : null,
        p.hasUnifiedApplication === 'YES' ? 'EK beadva' : null,
      ].filter(Boolean).join(' · ') || 'Nincs megadva',
      documentToPrepare: 'KNYR kivonat, EK határozat, STÉ-kalkuláció, MePAR/ENAR/TIR, könyvelői árbevétel-megosztás',
      status: kapStatus,
      riskNote: kapNote,
    })
  }

  const passedCount = rows.filter(r => r.status === 'PASS').length
  const warnCount = rows.filter(r => r.status === 'WARN').length
  const failCount = rows.filter(r => r.status === 'FAIL').length
  const checkCount = rows.filter(r => r.status === 'CHECK').length

  let verdictLabel = 'Előszűrésre vár'
  let verdictSummary = 'Töltsd ki a 2 perces előszűrő adatokat a Beállításokban, hogy lásd a cégedre szabott jogosultsági mátrixot.'
  let verdictTone: EligibilityEvaluation['verdictTone'] = 'muted'

  if (profileConfigured) {
    if (failCount > 0) {
      verdictLabel = `${failCount} kizáró kockázat észlelve`
      verdictSummary = 'A megadott cégadatok alapján kritikus jogosultsági bukópont látható. Ellenőrizd a pirossal jelölt sorokat!'
      verdictTone = 'red'
    } else if (warnCount > 0) {
      verdictLabel = `Esélyes (${passedCount}/${rows.length} pont rendben, ${warnCount} figyelendő)`
      verdictSummary = 'Alapfeltételeknek megfelelsz, de a sárgával jelölt pontokat a felhívás szövegében tételesen ellenőrizni kell.'
      verdictTone = 'amber'
    } else {
      verdictLabel = `Kiváló illeszkedés (${passedCount}/${rows.length} ellenőrzött pont megfelel)`
      verdictSummary = 'A 2 perces előszűrés alapján nincs kizáró ok. Érdemes elindítani a dokumentumok és árajánlatok előkészítését.'
      verdictTone = 'green'
    }
  }

  return {
    programProfile,
    rows,
    passedCount,
    warnCount,
    failCount,
    checkCount,
    profileConfigured,
    verdictLabel,
    verdictSummary,
    verdictTone,
  }
}
