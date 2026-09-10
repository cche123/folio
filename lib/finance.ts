export type Point = {
  metric: string;
  period: string;
  value: number;
  unit: string;
  source: string;
  section: string;
  status: 'Reported' | 'Imported' | 'Illustrative';
  url?: string;
  start?: string;
};
export type Doc = { id: string; name: string; type: string };
export type Assumptions = {
  growth: number;
  margin: number;
  tax: number;
  da: number;
  capex: number;
  nwc: number;
  wacc: number;
  terminal: number;
  cash: number;
  debt: number;
  shares: number;
  years: number;
};
export type Company = {
  id: string;
  name: string;
  ticker: string;
  description: string;
  currency: string;
  points: Point[];
  docs: Doc[];
  memo: string;
  assumptions?: Assumptions;
  peers?: Peer[];
  segments?: Segment[];
  demo?: boolean;
};
export type Peer = {
  name: string;
  revenue: number;
  ev: number;
  source: string;
};
export type Segment = { name: string; revenue: number; multiple: number };
export const metrics = [
  'Revenue',
  'Cost of revenue',
  'Gross profit',
  'Operating income',
  'Net income',
  'Operating cash flow',
  'Capex',
  'Cash',
  'Debt',
  'Assets',
  'Liabilities',
  'Equity',
  'Receivables',
  'Inventory',
  'SBC',
  'D&A',
  'Diluted shares',
];
export const defaults: Assumptions = {
  growth: 10,
  margin: 20,
  tax: 25,
  da: 3,
  capex: 4,
  nwc: 10,
  wacc: 10,
  terminal: 2.5,
  cash: 0,
  debt: 0,
  shares: 0,
  years: 5,
};
export const periods = (c: Company) =>
  [...new Set(c.points.map((p) => p.period))].sort();
export function point(c: Company, metric: string, period: string) {
  return c.points.find((p) => p.metric === metric && p.period === period);
}
export function value(
  c: Company,
  metric: string,
  period: string,
): number | null {
  return point(c, metric, period)?.value ?? null;
}
export function ratio(a: number | null, b: number | null) {
  return a !== null && b !== null && b !== 0 ? a / b : null;
}
export function fcf(c: Company, p: string) {
  const a = value(c, 'Operating cash flow', p),
    b = value(c, 'Capex', p);
  return a !== null && b !== null ? a - b : null;
}
export const fmt = (n: number | null, d = 1) =>
  n === null || !Number.isFinite(n)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      }).format(n);
export function dcf(revenue: number, a: Assumptions) {
  if (
    !Number.isFinite(revenue) ||
    revenue <= 0 ||
    Object.values(a).some((v) => !Number.isFinite(v)) ||
    !Number.isInteger(a.years) ||
    a.years < 1 ||
    a.years > 10 ||
    a.growth <= -100 ||
    a.margin > 100 ||
    a.tax < 0 ||
    a.tax > 100 ||
    a.da < 0 ||
    a.capex < 0 ||
    a.nwc < 0 ||
    a.cash < 0 ||
    a.debt < 0 ||
    a.shares < 0 ||
    a.wacc <= a.terminal ||
    a.wacc <= 0
  )
    return null;
  let prev = revenue;
  const rows = Array.from({ length: a.years }, (_, i) => {
    const rev = prev * (1 + a.growth / 100),
      ebit = (rev * a.margin) / 100,
      da = (rev * a.da) / 100,
      capex = (rev * a.capex) / 100,
      working = ((rev - prev) * a.nwc) / 100,
      taxes = (Math.max(0, ebit) * a.tax) / 100,
      fcff = ebit - taxes + da - capex - working,
      pv = fcff / (1 + a.wacc / 100) ** (i + 1);
    prev = rev;
    return {
      year: i + 1,
      revenue: rev,
      ebit,
      taxes,
      da,
      capex,
      working,
      fcff,
      pv,
    };
  });
  const terminal =
    (rows.at(-1)!.fcff * (1 + a.terminal / 100)) /
    ((a.wacc - a.terminal) / 100);
  const terminalPV = terminal / (1 + a.wacc / 100) ** a.years;
  const ev = rows.reduce((s, r) => s + r.pv, 0) + terminalPV,
    equity = ev + a.cash - a.debt;
  return {
    rows,
    ev,
    equity,
    perShare: a.shares > 0 ? equity / a.shares : null,
    terminalPV,
  };
}
export function observations(c: Company) {
  const ps = periods(c),
    p = ps.at(-1) || '',
    prev = ps.at(-2) || '',
    rev = value(c, 'Revenue', p),
    old = value(c, 'Revenue', prev),
    op = value(c, 'Operating income', p),
    cash = fcf(c, p),
    sbc = value(c, 'SBC', p);
  return [
    {
      title: 'Growth trajectory',
      text:
        rev !== null && old !== null && old > 0
          ? `Revenue changed ${fmt((rev / old - 1) * 100)}% between ${prev} and ${p}. Test whether pricing, volume, or acquisitions explain the change.`
          : 'Comparable revenue periods are needed to assess growth.',
    },
    {
      title: 'Operating leverage',
      text:
        ratio(op, rev) !== null
          ? `Operating margin is ${fmt(ratio(op, rev)! * 100)}%. Compare the pace of expense growth with revenue.`
          : 'Operating income and revenue are needed to assess operating leverage.',
    },
    {
      title: 'Cash generation',
      text:
        cash !== null
          ? `CFO less capital expenditure is ${fmt(cash)}m ${c.currency}. Review working capital and recurring investment needs.`
          : 'Operating cash flow and positive capex outflow are needed for free cash flow.',
    },
    {
      title: 'Quality of earnings',
      text:
        sbc !== null && ratio(sbc, rev) !== null
          ? `Stock compensation is ${fmt(ratio(sbc, rev)! * 100)}% of revenue. Examine dilution and the gap between cash flow and economic earnings.`
          : 'Review stock compensation, adjustments, and one-off gains in the underlying filings.',
    },
  ];
}
export function makeMemo(c: Company, a: Assumptions) {
  const p = periods(c).at(-1) || '',
    d = dcf(value(c, 'Revenue', p) || 0, a);
  return `${c.name} — Investment memo\n\nSTATUS\nWorking research draft. ${c.demo ? 'Illustrative company, not a real investment.' : 'Financial data requires review against the original sources.'}\n\nBUSINESS\n${c.description || 'Add the business model, customers, and competitive position.'}\n\nFINANCIAL SNAPSHOT (${p}; ${c.currency} millions)\nRevenue: ${fmt(value(c, 'Revenue', p))}\nOperating income: ${fmt(value(c, 'Operating income', p))}\nCFO less capex: ${fmt(fcf(c, p))}\n\nWHAT MATTERS\n${observations(
    c,
  )
    .map((o) => o.title + ': ' + o.text)
    .join(
      '\n',
    )}\n\nVALUATION — USER ASSUMPTIONS\n${a.years}-year DCF; growth ${a.growth}%; EBIT margin ${a.margin}%; WACC ${a.wacc}%; terminal growth ${a.terminal}%.\nEnterprise value: ${d ? fmt(d.ev) : 'Unavailable'}m ${c.currency}.\n\nBULL CASE\nWhat supports durable growth and margin expansion?\n\nBEAR CASE\nWhat could impair growth, cash conversion, or access to funding?\n\nOPEN QUESTIONS\nValidate market position, management incentives, customer concentration, debt terms, and non-GAAP adjustments.\n\nSOURCES\n${[...new Set(c.points.map((p) => p.source + (p.url ? ' — ' + p.url : '')))].join('\n')}`;
}
export function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw Error('Unclosed CSV quotation.');
  row.push(cell);
  if (row.some((s) => s.trim())) rows.push(row);
  return rows;
}
export function importCSV(text: string, name: string): Point[] {
  const rows = csvRows(text.replace(/^\uFEFF/, '')),
    headers = rows.shift()?.map((h) => h.trim().toLowerCase()) || [];
  for (const h of ['metric', 'period', 'value', 'unit'])
    if (!headers.includes(h))
      throw Error(`CSV needs a ${h} column. Download the template.`);
  const out: Point[] = [];
  rows.forEach((r, i) => {
    const get = (h: string) => r[headers.indexOf(h)]?.trim() || '',
      metric = metrics.find(
        (m) => m.toLowerCase() === get('metric').toLowerCase(),
      );
    if (!metric)
      throw Error(`Row ${i + 2}: unsupported metric "${get('metric')}".`);
    const period = get('period');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period) || Number.isNaN(Date.parse(period)))
      throw Error(`Row ${i + 2}: period must be YYYY-MM-DD.`);
    const unit = get('unit');
    if (!/^[A-Z]{3} millions$/.test(unit) && unit !== 'shares millions')
      throw Error(
        `Row ${i + 2}: use "USD millions" (or another currency) or "shares millions".`,
      );
    const raw = get('value');
    if (!raw) throw Error(`Row ${i + 2}: missing value.`);
    const val = Number(raw);
    if (!Number.isFinite(val)) throw Error(`Row ${i + 2}: invalid value.`);
    if (['Capex', 'Diluted shares'].includes(metric) && val < 0)
      throw Error(`Row ${i + 2}: ${metric} must be nonnegative.`);
    if (
      (metric === 'Diluted shares' && unit !== 'shares millions') ||
      (metric !== 'Diluted shares' && unit === 'shares millions')
    )
      throw Error(`Row ${i + 2}: unit does not match metric.`);
    if (out.some((p) => p.metric === metric && p.period === period))
      throw Error(`Conflicting duplicate: ${metric}, ${period}.`);
    out.push({
      metric,
      period,
      value: val,
      unit,
      source: get('source') || name,
      section: get('section') || `CSV row ${i + 2}`,
      status: 'Imported',
    });
  });
  if (!out.length) throw Error('No financial rows found.');
  if (
    new Set(out.filter((p) => p.unit !== 'shares millions').map((p) => p.unit))
      .size > 1
  )
    throw Error('Mixed currencies are not supported in one workspace.');
  return out;
}
export function demoCompany(): Company {
  const rows: Record<string, number[]> = {
    Revenue: [124, 167, 221, 286],
    'Gross profit': [90, 124, 168, 223],
    'Operating income': [8, 17, 32, 52],
    'Net income': [5, 12, 23, 39],
    'Operating cash flow': [22, 34, 53, 76],
    Capex: [6, 8, 10, 13],
    Cash: [49, 64, 93, 128],
    Debt: [30, 30, 25, 20],
    SBC: [12, 17, 23, 28],
    Assets: [170, 215, 270, 340],
    Liabilities: [90, 105, 119, 141],
    Equity: [80, 110, 151, 199],
    'Diluted shares': [80, 82, 84, 86],
  };
  return {
    id: 'demo',
    name: 'Northstar Systems',
    ticker: 'DEMO',
    description:
      'Illustrative enterprise software business. Subscription revenue from workflow automation and analytics. All figures are fictional and demonstrate the research workflow.',
    currency: 'USD',
    points: Object.entries(rows).flatMap(([metric, vals]) =>
      vals.map((value, i) => ({
        metric,
        period: `${2022 + i}-12-31`,
        value,
        unit: metric === 'Diluted shares' ? 'shares millions' : 'USD millions',
        source: 'Illustrative financial dataset',
        section: metric,
        status: 'Illustrative' as const,
      })),
    ),
    docs: [],
    memo: '',
    demo: true,
    assumptions: { ...defaults, cash: 128, debt: 20, shares: 86 },
  };
}
