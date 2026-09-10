import { owner, fail, rateLimit } from '@/lib/server';
import type { Point } from '@/lib/finance';
const tags: Record<string, string[]> = {
  Revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ],
  'Cost of revenue': ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
  'Gross profit': ['GrossProfit'],
  'Operating income': ['OperatingIncomeLoss'],
  'Net income': ['NetIncomeLoss'],
  'Operating cash flow': ['NetCashProvidedByUsedInOperatingActivities'],
  Capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  Cash: ['CashAndCashEquivalentsAtCarryingValue'],
  Debt: ['LongTermDebtCurrent', 'LongTermDebtNoncurrent'],
  Assets: ['Assets'],
  Liabilities: ['Liabilities'],
  Equity: ['StockholdersEquity'],
  Receivables: ['AccountsReceivableNetCurrent'],
  Inventory: ['InventoryNet'],
  SBC: ['ShareBasedCompensation'],
  'D&A': ['DepreciationDepletionAndAmortization'],
  'Diluted shares': ['WeightedAverageNumberOfDilutedSharesOutstanding'],
};
const instant = new Set([
  'Cash',
  'Debt',
  'Assets',
  'Liabilities',
  'Equity',
  'Receivables',
  'Inventory',
]);
async function sec<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Folio CompanyResearch/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok)
    throw Error(
      `SEC data is temporarily unavailable (${r.status}). You can still import a CSV.`,
    );
  return r.json() as Promise<T>;
}
export async function GET(req: Request) {
  try {
    const user = await owner();
    await rateLimit('sec:' + user, 30);
    const q = (new URL(req.url).searchParams.get('q') || '').trim();
    if (!q || q.length > 160) throw Error('Enter a company, ticker, or CIK.');
    let cik = '',
      ticker = '';
    const match = q.match(
      /^https:\/\/www.sec.gov\/Archives\/edgar\/data\/(\d+)\//,
    );
    if (match) cik = match[1];
    else if (/^\d{1,10}$/.test(q)) cik = q;
    else {
      const list = await sec<
        Record<string, { cik_str: number; ticker: string; title: string }>
      >('https://www.sec.gov/files/company_tickers.json');
      const companies = Object.values(list) as {
        cik_str: number;
        ticker: string;
        title: string;
      }[];
      const exact = companies.find(
        (c) =>
          c.ticker.toLowerCase() === q.toLowerCase() ||
          c.title.toLowerCase() === q.toLowerCase(),
      );
      const found =
        exact ||
        companies.filter((c) =>
          c.title.toLowerCase().includes(q.toLowerCase()),
        );
      if (Array.isArray(found)) {
        if (found.length !== 1)
          return Response.json({ matches: found.slice(0, 12) });
        cik = String(found[0].cik_str);
        ticker = found[0].ticker;
      } else {
        cik = String(found.cik_str);
        ticker = found.ticker;
      }
    }
    const data = await sec<{
        entityName: string;
        facts: Record<
          string,
          Record<
            string,
            {
              units: Record<
                string,
                {
                  start?: string;
                  end: string;
                  val: number;
                  form: string;
                  filed: string;
                  accn: string;
                }[]
              >;
            }
          >
        >;
      }>(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`,
      ),
      facts = data.facts?.['us-gaap'];
    if (!facts)
      throw Error(
        'No supported US-GAAP financials found. Import a CSV for this company.',
      );
    type Fact = {
      start?: string;
      end: string;
      val: number;
      form: string;
      filed: string;
      accn: string;
    };
    const select = (tag: string, unit: string, isInstant = false) =>
      (facts[tag]?.units?.[unit] || ([] as Fact[])).filter(
        (f: Fact) =>
          ['10-K', '10-K/A'].includes(f.form) &&
          (isInstant
            ? !f.start
            : f.start &&
              (Date.parse(f.end) - Date.parse(f.start)) / 86400000 >= 330 &&
              (Date.parse(f.end) - Date.parse(f.start)) / 86400000 <= 380),
      );
    const revTag = tags.Revenue.find((t) => select(t, 'USD').length);
    if (!revTag)
      throw Error(
        'No supported USD annual revenue data found. Use a CSV with explicit currency and periods.',
      );
    const revenueFacts = select(revTag, 'USD') as Fact[];
    const ends = [...new Set(revenueFacts.map((f) => f.end))].sort().slice(-5),
      points: Point[] = [];
    for (const [metric, options] of Object.entries(tags)) {
      if (metric === 'Debt') continue;
      for (const end of ends) {
        const unit = metric === 'Diluted shares' ? 'shares' : 'USD';
        let chosen: Fact | undefined,
          tag = '';
        for (const t of options) {
          const candidates = (select(t, unit, instant.has(metric)) as Fact[])
            .filter((f) => f.end === end)
            .sort((a, b) => b.filed.localeCompare(a.filed));
          if (candidates.length) {
            chosen = candidates[0];
            tag = t;
            break;
          }
        }
        if (chosen) {
          points.push({
            metric,
            period: end,
            value: chosen.val / 1e6,
            unit: unit === 'USD' ? 'USD millions' : 'shares millions',
            source: `${chosen.form} filed ${chosen.filed}`,
            section: `US-GAAP ${tag}; ${chosen.start ? chosen.start + ' to ' : ''}${end}`,
            status: 'Reported',
            start: chosen.start,
            url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${chosen.accn.replaceAll('-', '')}/${chosen.accn}-index.html`,
          });
        }
      }
    }
    return Response.json({
      id: crypto.randomUUID(),
      name: data.entityName,
      ticker: ticker || `CIK ${Number(cik)}`,
      currency: 'USD',
      description:
        'Annual consolidated financials from SEC XBRL disclosures. Latest filed values are selected for each period. Debt and industry-specific metrics require additional review.',
      points,
      docs: [],
      memo: '',
    });
  } catch (e) {
    return fail(e);
  }
}
