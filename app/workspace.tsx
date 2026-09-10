'use client';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowUpRight,
  Upload,
  Landmark,
  LayoutDashboard,
  Table2,
  ChartNoAxesCombined,
  Files,
  NotebookPen,
  Plus,
  Moon,
  Search,
  Download,
  ChevronRight,
  Check,
  BookOpen,
  ShieldCheck,
  Sun,
  ExternalLink,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  type Company,
  type Doc,
  type Point,
  type Assumptions,
  type Peer,
  type Segment,
  defaults,
  periods,
  value,
  point,
  ratio,
  fcf,
  fmt,
  dcf,
  observations,
  makeMemo,
  importCSV,
  demoCompany,
} from '@/lib/finance';
const nav = [
  [LayoutDashboard, 'Overview'],
  [Table2, 'Financials'],
  [ChartNoAxesCombined, 'Valuation'],
  [ShieldCheck, 'Diligence'],
  [Files, 'Documents'],
  [NotebookPen, 'Investment memo'],
] as const;
const template =
  'metric,period,value,unit,source,section\nRevenue,2025-12-31,100,USD millions,Your annual report,Income statement\nOperating income,2025-12-31,20,USD millions,Your annual report,Income statement\nOperating cash flow,2025-12-31,25,USD millions,Your annual report,Cash flow statement\nCapex,2025-12-31,5,USD millions,Your annual report,Cash flow statement\n';
function download(name: string, body: string, type = 'text/plain') {
  const u = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function api<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit,
) {
  const r = await fetch(path, options);
  const data = (await r.json()) as { error?: string };
  if (!r.ok || data.error) throw Error(data.error || 'The request failed.');
  return data as T;
}
function initAssumptions(c: Company): Assumptions {
  const p = periods(c).at(-1) || '';
  return (
    c.assumptions || {
      ...defaults,
      cash: value(c, 'Cash', p) || 0,
      debt: value(c, 'Debt', p) || 0,
      shares: value(c, 'Diluted shares', p) || 0,
    }
  );
}
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={primary ? 'primary' : 'button'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export default function Workspace() {
  const [dark, setDark] = useState(true),
    [companies, setCompanies] = useState<Company[]>([]),
    [c, setC] = useState<Company | null>(demoCompany),
    [tab, setTab] = useState('Overview'),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [query, setQuery] = useState(''),
    [matches, setMatches] = useState<
      { cik_str: number; ticker: string; title: string }[]
    >([]),
    [newOpen, setNewOpen] = useState(false),
    [companyName, setCompanyName] = useState(''),
    [source, setSource] = useState<{
      title: string;
      points: Point[];
      formula?: string;
    } | null>(null),
    [a, setA] = useState<Assumptions>(() => initAssumptions(demoCompany())),
    [valTab, setValTab] = useState('DCF'),
    [statement, setStatement] = useState('Income statement'),
    [memo, setMemo] = useState(''),
    [dirty, setDirty] = useState(false),
    [docSearch, setDocSearch] = useState(''),
    [peers, setPeers] = useState<Peer[]>([]),
    [segments, setSegments] = useState<Segment[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api<Company[]>('/api/workspaces')
      .then(setCompanies)
      .catch((e) => setNotice(e.message));
    const storedDark = localStorage.getItem('folio-theme') !== 'light';
    queueMicrotask(() => setDark(storedDark));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('folio-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  const current = () =>
    c ? { ...c, assumptions: a, memo, peers, segments } : null;
  function openCompany(co: Company) {
    setC(co);
    setA(initAssumptions(co));
    setMemo(co.memo);
    setPeers(co.peers || []);
    setSegments(co.segments || []);
    setTab('Overview');
    setNewOpen(false);
    setDirty(false);
  }
  async function persist(co: Company) {
    await api('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(co),
    });
    setCompanies((cs) => [co, ...cs.filter((x) => x.id !== co.id)]);
    setDirty(false);
  }
  async function save() {
    if (!c) return;
    if (c.demo) {
      setNotice(
        'This is an illustrative workspace. Create a company to save your own research.',
      );
      return;
    }
    setBusy('Saving workspace');
    try {
      const co = current()!;
      await persist(co);
      setC(co);
      setNotice('Workspace saved.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function switchTo(co: Company | null) {
    if (dirty && c && !c.demo) {
      setBusy('Saving workspace');
      try {
        await persist(current()!);
      } catch (e) {
        setNotice((e as Error).message);
        setBusy('');
        return;
      }
      setBusy('');
    }
    if (co) openCompany(co);
    else {
      setC(null);
      setDirty(false);
    }
  }
  async function lookup(q = query) {
    if (dirty && c && !c.demo) {
      try {
        await persist(current()!);
      } catch (e) {
        setNotice((e as Error).message);
        return;
      }
    }
    setBusy('Reading SEC annual financials');
    setNotice('');
    setMatches([]);
    try {
      const co = await api<
        Company & {
          matches?: { cik_str: number; ticker: string; title: string }[];
        }
      >('/api/sec?q=' + encodeURIComponent(q));
      if (co.matches) {
        setMatches(co.matches);
        if (!co.matches.length)
          setNotice(
            'No matching SEC company. Use a CIK or create a workspace.',
          );
      } else {
        await persist(co);
        openCompany(co);
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function create() {
    if (!companyName.trim()) return;
    if (dirty && c && !c.demo) {
      try {
        await persist(current()!);
      } catch (e) {
        setNotice((e as Error).message);
        return;
      }
    }
    setBusy('Creating workspace');
    try {
      const co: Company = {
        id: crypto.randomUUID(),
        name: companyName.trim(),
        ticker: 'PRIVATE',
        description: '',
        currency: 'USD',
        points: [],
        docs: [],
        memo: '',
      };
      await persist(co);
      openCompany(co);
      setCompanyName('');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function upload(fs: FileList | null) {
    if (!fs?.length) return;
    if (!c || c.demo) {
      setNewOpen(true);
      setNotice('Create or open a company before uploading its documents.');
      return;
    }
    setBusy('Importing documents');
    let co = current()!;
    try {
      for (const file of Array.from(fs)) {
        if (file.size > 12000000)
          throw Error('Each document must be under 12 MB.');
        let incoming: Point[] = [];
        if (file.name.toLowerCase().endsWith('.csv')) {
          incoming = importCSV(await file.text(), file.name);
          const unit = incoming
            .find((p) => p.unit !== 'shares millions')
            ?.unit.split(' ')[0];
          if (co.points.length && unit && unit !== co.currency)
            throw Error(
              'Currency differs from this workspace. Create a separate workspace.',
            );
          for (const p of incoming) {
            const existing = point(co, p.metric, p.period);
            if (existing)
              throw Error(
                `${p.metric} for ${p.period} already exists. Duplicate periods require manual reconciliation; nothing from this CSV was imported.`,
              );
          }
          if (unit) co = { ...co, currency: unit };
        }
        await persist(co);
        const created = await api<Doc & { parts: number }>('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: co.id,
            name: file.name,
            size: file.size,
          }),
        });
        for (let part = 0; part < created.parts; part++) {
          setBusy(
            `Saving ${file.name} · ${Math.round((part / created.parts) * 100)}%`,
          );
          const bytes = new Uint8Array(
            await file
              .slice(part * 1500000, (part + 1) * 1500000)
              .arrayBuffer(),
          );
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          await api('/api/documents/chunks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: created.id, part, data: btoa(binary) }),
          });
        }
        const doc = await api<Doc>('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: created.id }),
        });
        co = {
          ...co,
          points: [...co.points, ...incoming],
          docs: [...co.docs, doc],
        };
        await persist(co);
        setC(co);
      }
      setNotice(
        'Documents saved. CSV figures are imported; PDF and text documents are available for review.',
      );
      setTab(co.points.length ? 'Overview' : 'Documents');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
  }
  const ps = c ? periods(c) : [],
    latest = ps.at(-1) || '',
    previous = ps.at(-2) || '',
    rev = c ? value(c, 'Revenue', latest) : null,
    growth = c ? ratio(rev, c ? value(c, 'Revenue', previous) : null) : null,
    d = dcf(rev || 0, a);
  function inspect(metric: string, p = latest) {
    if (!c) return;
    if (metric === 'FCF') {
      setSource({
        title: 'Free cash flow',
        points: ['Operating cash flow', 'Capex']
          .map((m) => point(c, m, p))
          .filter(Boolean) as Point[],
        formula:
          'Free cash flow = operating cash flow − capital expenditure (positive outflow). This is a calculated levered cash-flow measure, not DCF unlevered FCF.',
      });
    } else {
      const po = point(c, metric, p);
      setSource({
        title: metric,
        points: po ? [po] : [],
        formula: po
          ? undefined
          : 'Not disclosed or not available in the imported dataset.',
      });
    }
  }
  function changeAssumption(k: keyof Assumptions, n: number) {
    if (!Number.isFinite(n)) return;
    setA((old) => ({ ...old, [k]: n }));
    setDirty(true);
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    const tool = {
      name: 'set_dcf_assumptions',
      description:
        'Change the active company DCF assumptions in the visible workspace. Changes remain unsaved until Save workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          growth: { type: 'number' },
          margin: { type: 'number' },
          wacc: { type: 'number' },
          terminal: { type: 'number' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        if (!c) throw Error('Open a company first.');
        const v = input as Record<string, number>;
        for (const [k, n] of Object.entries(v))
          if (
            !['growth', 'margin', 'wacc', 'terminal'].includes(k) ||
            typeof n !== 'number' ||
            !Number.isFinite(n) ||
            n < 0 ||
            n > 100
          )
            throw Error('Use supported assumptions from 0 to 100.');
        const next = { ...a, ...v };
        if (next.wacc <= next.terminal)
          throw Error('WACC must exceed terminal growth.');
        setA(next);
        setTab('Valuation');
        setValTab('DCF');
        setDirty(true);
        return {
          assumptions: next,
          enterpriseValue: dcf(rev || 0, next)?.ev ?? null,
          saved: false,
        };
      },
    };
    Promise.resolve(
      context.registerTool(tool, { signal: controller.signal }),
    ).catch(() => {});
    return () => controller.abort();
  }, [c, a, rev]);
  const rows =
    statement === 'Income statement'
      ? [
          'Revenue',
          'Cost of revenue',
          'Gross profit',
          'Operating income',
          'Net income',
          'SBC',
          'Diluted shares',
        ]
      : statement === 'Balance sheet'
        ? [
            'Cash',
            'Debt',
            'Assets',
            'Liabilities',
            'Equity',
            'Receivables',
            'Inventory',
          ]
        : ['Operating cash flow', 'Capex', 'FCF', 'D&A'];
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <button className="brand" onClick={() => switchTo(null)}>
            <span className="brand-mark">f</span>
            <span className="brand-name">
              folio<span>THE RESEARCH DESK</span>
            </span>
          </button>
          <button className="new" onClick={() => setNewOpen(true)}>
            <Plus size={16} /> Analyze a company
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">RESEARCH</div>
          {nav.map(([Icon, label]) => (
            <button
              className={'nav-item ' + (c && tab === label ? 'active' : '')}
              key={label}
              onClick={() => (c ? setTab(label) : setNewOpen(true))}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <div className="nav-caption">YOUR COVERAGE</div>
          {companies.map((co) => (
            <button
              key={co.id}
              onClick={() => switchTo(co)}
              className={'nav-item ' + (co.id === c?.id ? 'active' : '')}
            >
              <span className="initial">{co.name[0]}</span>
              <span className="truncate">{co.name}</span>
            </button>
          ))}
          {companies.length === 0 && (
            <small className="nav-empty">Your saved research lives here.</small>
          )}
        </SidebarContent>
        <SidebarFooter>
          <button className="nav-item" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}{' '}
            {dark ? 'Light appearance' : 'Dark appearance'}
          </button>
          <div className="profile">
            <ShieldCheck size={20} />
            <span>
              Private browser workspace
              <small>No account needed · No AI charges</small>
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <SidebarTrigger />
          <span>
            Workspace / <b>{c ? c.name : 'Research desk'}</b>
          </span>
          <button className="search-button" onClick={() => setNewOpen(true)}>
            <Search size={15} /> Find a company <kbd>⌘ K</kbd>
          </button>
          <button
            className="theme-toggle"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {c && !c.demo && (
            <Button onClick={save} disabled={!!busy}>
              <Check size={15} />
              {dirty ? 'Save changes' : 'Save workspace'}
            </Button>
          )}
        </header>
        {(notice || busy) && (
          <output className={'notice ' + (busy ? 'loading' : '')}>
            {busy || notice}
            {!busy && (
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            )}
          </output>
        )}
        <input
          type="file"
          ref={input}
          className="hidden"
          accept=".pdf,.csv,.txt"
          multiple
          onChange={(e) => upload(e.target.files)}
        />
        {!c ? (
          <main className="canvas">
            <div className="eyebrow">YOUR NEXT INVESTMENT STARTS HERE</div>
            <h1>
              Understand the business.
              <br />
              <span>Underwrite the opportunity.</span>
            </h1>
            <p className="intro">
              Company materials in. A clear investment perspective out.
            </p>
            <section
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setNewOpen(true);
                setNotice(
                  'Create a company, then drop its documents into the workspace.',
                );
              }}
            >
              <Upload size={29} />
              <h2>Analyze a company</h2>
              <p>
                Start with public financials or bring your own company
                materials.
              </p>
              <div className="search-row">
                <input
                  aria-label="Company name, ticker, or CIK"
                  placeholder="Company, ticker, or CIK…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                />
                <Button primary onClick={() => lookup()} disabled={!!busy}>
                  Search SEC <ArrowUpRight size={16} />
                </Button>
              </div>
              <button className="text-button" onClick={() => setNewOpen(true)}>
                Create a company & upload documents <ChevronRight size={14} />
              </button>
              <small>
                Free SEC data · PDF & text source library · CSV financial import
              </small>
            </section>
            {matches.length > 0 && (
              <div className="panel">
                {matches.map((m) => (
                  <button
                    className="result"
                    key={m.cik_str}
                    onClick={() => lookup(String(m.cik_str))}
                  >
                    {m.title}
                    <span>{m.ticker} →</span>
                  </button>
                ))}
              </div>
            )}
            <div className="section-head">
              <h2>Your research desk</h2>
              <span>
                {companies.length} saved{' '}
                {companies.length === 1 ? 'company' : 'companies'}
              </span>
            </div>
            <div className="company-grid">
              {companies.map((co) => (
                <button
                  className="company-card"
                  key={co.id}
                  onClick={() => switchTo(co)}
                >
                  <span className="company-icon">{co.name[0]}</span>
                  <h3>{co.name}</h3>
                  <p>
                    {co.ticker} · {periods(co).length} reporting periods
                  </p>
                  <span>
                    Open workspace <ArrowUpRight size={16} />
                  </span>
                </button>
              ))}
              <button
                className="company-card demo-card"
                onClick={() => switchTo(demoCompany())}
              >
                <span className="company-icon">N</span>
                <span className="badge">ILLUSTRATIVE EXAMPLE</span>
                <h3>Northstar Systems</h3>
                <p>Explore the analysis and valuation tools.</p>
                <span>
                  Explore sample workspace <ArrowUpRight size={16} />
                </span>
              </button>
            </div>
            <div className="quiet">
              <ShieldCheck size={16} /> Private research. Transparent
              calculations. No AI charges.
            </div>
          </main>
        ) : (
          <main className="workspace">
            {c.demo && (
              <div className="sample-bar">
                <span>
                  <span className="status-dot" /> EXAMPLE WORKSPACE{' '}
                  <span className="sample-detail">
                    Explore the tools with fictional company data.
                  </span>
                </span>
                <button onClick={() => setNewOpen(true)}>
                  Analyze your company <ArrowUpRight size={14} />
                </button>
              </div>
            )}

            <div className="company-heading">
              <div className="company-icon">{c.name[0]}</div>
              <div>
                <div className="inline">
                  <h1>{c.name}</h1>
                  <span className="badge">{c.ticker}</span>
                  {c.demo && (
                    <span className="badge amber">FICTIONAL DATA</span>
                  )}
                </div>
                <p>
                  {latest
                    ? `Latest fiscal period ${latest}`
                    : 'No financials imported yet'}{' '}
                  <span>·</span> {c.currency} millions unless indicated
                </p>
              </div>
              <Button onClick={() => input.current?.click()} disabled={!!busy}>
                <Plus size={15} />
                Add documents
              </Button>
            </div>
            <nav className="research-tabs" aria-label="Company sections">
              {nav.map(([, label], i) => (
                <button
                  key={label}
                  className={tab === label ? 'selected' : ''}
                  onClick={() => setTab(label)}
                >
                  <span>0{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div className="page-title">
              <h2>{tab === 'Overview' ? 'Business at a glance' : tab}</h2>
              <span>
                {c.points.length} financial datapoints · {c.docs.length}{' '}
                documents
              </span>
            </div>
            {tab === 'Overview' && (
              <>
                <p className="description">
                  {c.description ||
                    'Import financial data to start your analysis. Add your business description in the investment memo.'}
                </p>
                <div className="kpi-strip">
                  {[
                    [
                      'Revenue',
                      rev,
                      growth !== null
                        ? `${fmt((growth - 1) * 100)}% vs prior period`
                        : 'Prior period unavailable',
                    ],
                    [
                      'Operating income',
                      value(c, 'Operating income', latest),
                      ratio(value(c, 'Operating income', latest), rev) !== null
                        ? `${fmt(ratio(value(c, 'Operating income', latest), rev)! * 100)}% operating margin`
                        : 'Margin unavailable',
                    ],
                    ['FCF', fcf(c, latest), 'Calculated · CFO less capex'],
                    [
                      'Cash',
                      value(c, 'Cash', latest),
                      c.demo
                        ? 'Illustrative cash & equivalents'
                        : 'Cash & equivalents',
                    ],
                  ].map(([label, n, sub]) => (
                    <button
                      className="kpi"
                      key={String(label)}
                      onClick={() => inspect(String(label))}
                    >
                      <span>
                        {label === 'FCF' ? 'Free cash flow' : label}
                        <ArrowUpRight size={13} />
                      </span>
                      <strong>
                        {fmt(n as number | null)}
                        <small>m</small>
                      </strong>
                      <small>{sub}</small>
                    </button>
                  ))}
                </div>
                <div className="overview-grid">
                  <section className="panel">
                    <div className="panel-head">
                      <h3>Revenue & profitability</h3>
                      <span>Annual · fiscal period end</span>
                    </div>
                    {ps.length > 0 ? (
                      <div className="chart">
                        <ResponsiveContainer width="100%" height={290}>
                          <ComposedChart
                            data={ps.map((p) => ({
                              period: p.slice(0, 4),
                              revenue: value(c, 'Revenue', p),
                              margin:
                                ratio(
                                  value(c, 'Operating income', p),
                                  value(c, 'Revenue', p),
                                ) === null
                                  ? null
                                  : ratio(
                                      value(c, 'Operating income', p),
                                      value(c, 'Revenue', p),
                                    )! * 100,
                            }))}
                            margin={{ top: 15, right: 5, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              vertical={false}
                              stroke="var(--border)"
                              strokeDasharray="3 4"
                            />
                            <XAxis
                              dataKey="period"
                              tickLine={false}
                              axisLine={false}
                              tick={{
                                fontSize: 12,
                                fill: 'var(--muted-foreground)',
                              }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{
                                fontSize: 12,
                                fill: 'var(--muted-foreground)',
                              }}
                            />
                            <YAxis
                              yAxisId="margin"
                              orientation="right"
                              unit="%"
                              tickLine={false}
                              axisLine={false}
                              tick={{
                                fontSize: 12,
                                fill: 'var(--muted-foreground)',
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                                borderRadius: 6,
                              }}
                            />
                            <Bar
                              dataKey="revenue"
                              name={`Revenue (${c.currency}m)`}
                              fill="var(--chart-1)"
                              maxBarSize={64}
                              radius={[2, 2, 0, 0]}
                            />
                            <Line
                              yAxisId="margin"
                              dataKey="margin"
                              name="Operating margin (%)"
                              stroke="var(--chart-2)"
                              strokeWidth={2.5}
                              dot={{ r: 4 }}
                              connectNulls={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="legend">
                          <span>
                            <i />
                            Revenue
                          </span>
                          <span>
                            <i className="green" />
                            Operating margin
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="empty">
                        Import a financial CSV or search SEC to see historical
                        trends.
                        <Button onClick={() => input.current?.click()}>
                          Import financials
                        </Button>
                      </div>
                    )}
                  </section>
                  <section className="panel matters">
                    <div className="panel-head">
                      <h3>What matters</h3>
                      <BookOpen size={16} />
                    </div>
                    {observations(c)
                      .slice(0, 3)
                      .map((o, i) => (
                        <div className="matter" key={o.title}>
                          <span>0{i + 1}</span>
                          <div>
                            <h3>{o.title}</h3>
                            <p>{o.text}</p>
                          </div>
                        </div>
                      ))}
                  </section>
                </div>
                <div className="overview-grid lower">
                  <section className="panel">
                    <div className="panel-head">
                      <h3>Financial snapshot</h3>
                      <button
                        className="text-button"
                        onClick={() => setTab('Financials')}
                      >
                        Full model <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <FinancialTable
                      company={c}
                      rows={[
                        'Revenue',
                        'Gross profit',
                        'Operating income',
                        'Operating cash flow',
                        'Capex',
                        'FCF',
                      ]}
                      inspect={inspect}
                    />
                  </section>
                  <section className="panel valuation-teaser">
                    <span className="eyebrow">UNDERWRITE YOUR VIEW</span>
                    <h3>What is the business worth?</h3>
                    <p>
                      Build a cash-flow valuation with your own growth, margin,
                      and capital assumptions.
                    </p>
                    <Button onClick={() => setTab('Valuation')}>
                      Open valuation <ArrowUpRight size={15} />
                    </Button>
                    <small>
                      Assumptions are illustrative until you review them.
                    </small>
                  </section>
                </div>
              </>
            )}
            {tab === 'Financials' && (
              <section className="panel">
                <div className="toolbar">
                  <Tabs
                    value={statement}
                    onValueChange={(v) => setStatement(String(v))}
                  >
                    <TabsList>
                      {['Income statement', 'Balance sheet', 'Cash flow'].map(
                        (t) => (
                          <TabsTrigger key={t} value={t}>
                            {t}
                          </TabsTrigger>
                        ),
                      )}
                    </TabsList>
                  </Tabs>
                  <Button
                    onClick={() => {
                      const safe = (s: string) =>
                        '"' +
                        (/^[=+@-]/.test(s) ? "'" : '') +
                        s.replaceAll('"', '""') +
                        '"';
                      download(
                        c.name + ' financials.csv',
                        [
                          'metric,period,value,unit,source,section',
                          ...c.points.map((p) =>
                            [
                              safe(p.metric),
                              safe(p.period),
                              p.value,
                              safe(p.unit),
                              safe(p.source),
                              safe(p.section),
                            ].join(','),
                          ),
                        ].join('\n'),
                        'text/csv',
                      );
                    }}
                  >
                    <Download size={15} />
                    Export CSV
                  </Button>
                </div>
                <FinancialTable company={c} rows={rows} inspect={inspect} />
                <div className="footnote">
                  Click any figure to inspect its source. “—” means unavailable,
                  not zero. Imported figures have not been independently
                  verified. SEC values use the latest filing for each fiscal
                  period; restatements may affect comparability. Annual periods
                  only.
                </div>
              </section>
            )}
            {tab === 'Valuation' && (
              <>
                <div className="toolbar">
                  <Tabs
                    value={valTab}
                    onValueChange={(v) => setValTab(String(v))}
                  >
                    <TabsList>
                      {['DCF', 'Scenarios', 'Sum of parts', 'Comparables'].map(
                        (t) => (
                          <TabsTrigger key={t} value={t}>
                            {t}
                          </TabsTrigger>
                        ),
                      )}
                    </TabsList>
                  </Tabs>
                  <span className="badge amber">USER ASSUMPTIONS</span>
                </div>
                {(valTab === 'DCF' || valTab === 'Scenarios') && (
                  <>
                    <div className="valuation-grid">
                      <section className="panel assumptions">
                        <div className="panel-head">
                          <h3>Model assumptions</h3>
                          <button
                            className="text-button"
                            onClick={() => {
                              setA(initAssumptions(c));
                              setDirty(true);
                            }}
                          >
                            Reset
                          </button>
                        </div>
                        {(
                          [
                            ['growth', 'Revenue growth', '%'],
                            ['margin', 'EBIT margin', '%'],
                            ['tax', 'Cash tax rate', '%'],
                            ['da', 'D&A / revenue', '%'],
                            ['capex', 'Capex / revenue', '%'],
                            ['nwc', 'NWC / incremental revenue', '%'],
                            ['wacc', 'WACC', '%'],
                            ['terminal', 'Terminal growth', '%'],
                            ['cash', 'Cash', 'm'],
                            ['debt', 'Total debt', 'm'],
                            ['shares', 'Diluted shares', 'm'],
                          ] as [keyof Assumptions, string, string][]
                        ).map(([k, label, unit]) => (
                          <label
                            className={
                              'assumption ' +
                              ([
                                'growth',
                                'margin',
                                'wacc',
                                'terminal',
                              ].includes(k)
                                ? 'with-slider'
                                : '')
                            }
                            key={k}
                          >
                            <span>{label}</span>
                            <div>
                              <input
                                type="number"
                                step="0.5"
                                aria-label={label}
                                value={a[k]}
                                onChange={(e) =>
                                  changeAssumption(k, Number(e.target.value))
                                }
                              />
                              <span>{unit}</span>
                            </div>
                            {['growth', 'margin', 'wacc', 'terminal'].includes(
                              k,
                            ) && (
                              <Slider
                                aria-label={label + ' slider'}
                                min={k === 'growth' ? -20 : 0}
                                max={
                                  k === 'wacc' ? 25 : k === 'terminal' ? 8 : 60
                                }
                                step={0.5}
                                value={[a[k]]}
                                onValueChange={(v) =>
                                  changeAssumption(
                                    k,
                                    Array.isArray(v) ? v[0] : v,
                                  )
                                }
                              />
                            )}
                          </label>
                        ))}
                        <p className="footnote">
                          Five-year FCFF model. Check all assumptions. Cash,
                          debt and share count require capital-structure review;
                          missing values start at zero. Terminal cash flow grows
                          at the terminal rate.
                        </p>
                      </section>
                      <div>
                        <div className="value-banner">
                          <span>Implied enterprise value</span>
                          <strong>
                            {d ? fmt(d.ev) : '—'}
                            <small>m {c.currency}</small>
                          </strong>
                          <div>
                            <span>
                              Equity value <b>{d ? fmt(d.equity) : '—'}m</b>
                            </span>
                            <span>
                              Per diluted share{' '}
                              <b>{fmt(d?.perShare ?? null)}</b>
                            </span>
                          </div>
                        </div>
                        {!d && (
                          <div className="notice">
                            Review the model inputs: positive revenue, valid
                            rates, and WACC above terminal growth are required.
                          </div>
                        )}
                        {valTab === 'DCF' ? (
                          <section className="panel">
                            <div className="panel-head">
                              <h3>Forecast cash flows</h3>
                              <span>{c.currency}m · estimated</span>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Forecast</TableHead>
                                  {d?.rows.map((r) => (
                                    <TableHead key={r.year}>
                                      Year {r.year}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(
                                  [
                                    'revenue',
                                    'ebit',
                                    'taxes',
                                    'da',
                                    'capex',
                                    'working',
                                    'fcff',
                                    'pv',
                                  ] as const
                                ).map((m, i) => (
                                  <TableRow key={m}>
                                    <TableCell>
                                      {
                                        [
                                          'Revenue',
                                          'EBIT',
                                          'Cash taxes',
                                          'D&A',
                                          'Capex',
                                          'Change in NWC',
                                          'Unlevered FCF',
                                          'Present value',
                                        ][i]
                                      }
                                    </TableCell>
                                    {d?.rows.map((r) => (
                                      <TableCell key={r.year}>
                                        {fmt(r[m])}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="footnote">
                              FCFF = EBIT − cash taxes + D&A − capex − change in
                              NWC. EV = discounted forecast FCFF + discounted
                              terminal value. Equity = EV + cash − debt.
                              Per-share value requires a positive diluted share
                              count.
                            </div>
                          </section>
                        ) : (
                          <section className="panel">
                            <div className="panel-head">
                              <h3>Bear / base / bull</h3>
                              <span>Illustrative sensitivity offsets</span>
                            </div>
                            {[-1, 0, 1].map((shift, i) => {
                              const scenario = {
                                  ...a,
                                  growth: a.growth + shift * 5,
                                  margin: a.margin + shift * 3,
                                },
                                v = dcf(rev || 0, scenario);
                              return (
                                <div className="scenario" key={i}>
                                  <div>
                                    <b>{['Bear', 'Base', 'Bull'][i]}</b>
                                    <small>
                                      {scenario.growth}% growth ·{' '}
                                      {scenario.margin}% EBIT margin
                                    </small>
                                  </div>
                                  <strong>{fmt(v?.ev ?? null)}m</strong>
                                </div>
                              );
                            })}
                            <p className="footnote">
                              Bear / bull apply ±5 percentage points to growth
                              and ±3 points to margin. These are mechanical
                              sensitivities, not probabilities or forecasts.
                            </p>
                          </section>
                        )}
                        <section className="panel sensitivity">
                          <div className="panel-head">
                            <h3>Enterprise value sensitivity</h3>
                            <span>WACC ↓ / terminal growth →</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>WACC</TableHead>
                                {[-1, -0.5, 0, 0.5, 1].map((i) => (
                                  <TableHead key={i}>
                                    {fmt(a.terminal + i)}%
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[-2, -1, 0, 1, 2].map((w) => (
                                <TableRow key={w}>
                                  <TableCell>{fmt(a.wacc + w)}%</TableCell>
                                  {[-1, -0.5, 0, 0.5, 1].map((g) => (
                                    <TableCell
                                      className={
                                        w === 0 && g === 0
                                          ? 'selected-cell'
                                          : ''
                                      }
                                      key={g}
                                    >
                                      {fmt(
                                        dcf(rev || 0, {
                                          ...a,
                                          wacc: a.wacc + w,
                                          terminal: a.terminal + g,
                                        })?.ev ?? null,
                                        0,
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </section>
                      </div>
                    </div>
                  </>
                )}
                {valTab === 'Sum of parts' && (
                  <section className="panel">
                    <div className="panel-head">
                      <h3>Segment valuation</h3>
                      <Button
                        onClick={() => {
                          setSegments([
                            ...segments,
                            { name: 'New segment', revenue: 0, multiple: 1 },
                          ]);
                          setDirty(true);
                        }}
                      >
                        <Plus size={15} />
                        Add segment
                      </Button>
                    </div>
                    <p className="footnote">
                      Enter disclosed segment revenue and your chosen EV /
                      revenue multiple. No segment values or multiples are
                      inferred.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[
                            'Segment',
                            'Revenue (m)',
                            'EV / revenue',
                            'Implied EV (m)',
                            '',
                          ].map((t, i) => (
                            <TableHead key={i}>{t}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {segments.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <input
                                aria-label={`Segment ${i + 1} name`}
                                value={s.name}
                                onChange={(e) => {
                                  setSegments(
                                    segments.map((x, j) =>
                                      j === i
                                        ? { ...x, name: e.target.value }
                                        : x,
                                    ),
                                  );
                                  setDirty(true);
                                }}
                              />
                            </TableCell>
                            {(['revenue', 'multiple'] as const).map((k) => (
                              <TableCell key={k}>
                                <input
                                  type="number"
                                  min="0"
                                  aria-label={`${s.name} ${k}`}
                                  value={s[k]}
                                  onChange={(e) => {
                                    setSegments(
                                      segments.map((x, j) =>
                                        j === i
                                          ? {
                                              ...x,
                                              [k]: Math.max(
                                                0,
                                                Number(e.target.value),
                                              ),
                                            }
                                          : x,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                />
                              </TableCell>
                            ))}
                            <TableCell>{fmt(s.revenue * s.multiple)}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => {
                                  setSegments(
                                    segments.filter((_, j) => j !== i),
                                  );
                                  setDirty(true);
                                }}
                                aria-label={'Remove ' + s.name}
                              >
                                ×
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="total">
                      Sum of segment enterprise values{' '}
                      <b>
                        {fmt(
                          segments.reduce(
                            (t, s) => t + s.revenue * s.multiple,
                            0,
                          ),
                        )}
                        m
                      </b>
                    </div>
                    <p className="footnote">
                      Before corporate overhead, unallocated assets, cash and
                      debt. Segment revenue total:{' '}
                      {fmt(segments.reduce((t, s) => t + s.revenue, 0))}m;
                      consolidated revenue: {fmt(rev)}m. Reconcile differences
                      before using this valuation.
                    </p>
                  </section>
                )}
                {valTab === 'Comparables' && (
                  <section className="panel">
                    <div className="panel-head">
                      <h3>Public & private comparables</h3>
                      <Button
                        onClick={() => {
                          setPeers([
                            ...peers,
                            {
                              name: 'New company',
                              revenue: 0,
                              ev: 0,
                              source: '',
                            },
                          ]);
                          setDirty(true);
                        }}
                      >
                        <Plus size={15} />
                        Add comparable
                      </Button>
                    </div>
                    <p className="footnote">
                      Bring your own verified enterprise values and
                      matching-period revenue. Use the same currency. Record the
                      source, valuation date, and whether the company is public
                      or private. Private funding valuations usually represent
                      equity value, not EV.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[
                            'Company',
                            'Revenue (m)',
                            'EV (m)',
                            'EV / revenue',
                            'Source & date',
                            '',
                          ].map((t, i) => (
                            <TableHead key={i}>{t}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {peers.map((p, i) => (
                          <TableRow key={i}>
                            {(['name', 'revenue', 'ev'] as const).map((k) => (
                              <TableCell key={k}>
                                <input
                                  aria-label={`Peer ${i + 1} ${k}`}
                                  type={k === 'name' ? 'text' : 'number'}
                                  value={p[k]}
                                  onChange={(e) => {
                                    setPeers(
                                      peers.map((x, j) =>
                                        j === i
                                          ? {
                                              ...x,
                                              [k]:
                                                k === 'name'
                                                  ? e.target.value
                                                  : Math.max(
                                                      0,
                                                      Number(e.target.value),
                                                    ),
                                            }
                                          : x,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                />
                              </TableCell>
                            ))}
                            <TableCell>
                              {fmt(ratio(p.ev, p.revenue))}×
                            </TableCell>
                            <TableCell>
                              <input
                                aria-label={`Peer ${i + 1} source`}
                                value={p.source}
                                placeholder="Source, date, public/private"
                                onChange={(e) => {
                                  setPeers(
                                    peers.map((x, j) =>
                                      j === i
                                        ? { ...x, source: e.target.value }
                                        : x,
                                    ),
                                  );
                                  setDirty(true);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <button
                                aria-label={'Remove ' + p.name}
                                onClick={() => {
                                  setPeers(peers.filter((_, j) => j !== i));
                                  setDirty(true);
                                }}
                              >
                                ×
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {!peers.length && (
                      <div className="empty">
                        Add comparable companies to build your reference set.
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
            {tab === 'Diligence' && (
              <>
                <div className="diligence-grid">
                  {observations(c).map((o) => (
                    <section className="panel diligence" key={o.title}>
                      <span className="badge">REVIEW QUESTION</span>
                      <h3>{o.title}</h3>
                      <p>{o.text}</p>
                      <button
                        className="text-button"
                        onClick={() => setTab('Financials')}
                      >
                        Inspect financials <ArrowUpRight size={14} />
                      </button>
                    </section>
                  ))}
                </div>
                <section className="panel">
                  <div className="panel-head">
                    <h3>Open diligence</h3>
                  </div>
                  <p className="footnote">
                    Customer concentration, debt maturities, management
                    incentives, segment economics, and accounting adjustments
                    require reading the original documents. These checks are not
                    automated in this version.
                  </p>
                  <Button onClick={() => setTab('Documents')}>
                    Open source library <ArrowUpRight size={15} />
                  </Button>
                </section>
              </>
            )}
            {tab === 'Documents' && (
              <>
                <section
                  className="dropzone compact"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void upload(e.dataTransfer.files);
                  }}
                >
                  <Upload size={24} />
                  <h2>Add to your source library</h2>
                  <p>
                    PDF and TXT are stored for review. CSV imports normalized
                    financial data.
                  </p>
                  <div className="inline">
                    <Button
                      primary
                      onClick={() => input.current?.click()}
                      disabled={!!busy}
                    >
                      Choose documents
                    </Button>
                    <Button
                      onClick={() =>
                        download(
                          'folio-financial-template.csv',
                          template,
                          'text/csv',
                        )
                      }
                    >
                      CSV template <Download size={15} />
                    </Button>
                  </div>
                  <small>
                    12 MB per file · annual fiscal period end dates · explicit
                    currency and units
                  </small>
                </section>
                <div className="section-head">
                  <h2>Sources & documents</h2>
                  <input
                    aria-label="Filter source documents"
                    placeholder="Filter sources…"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                  />
                </div>
                <section className="panel">
                  {c.docs
                    .filter((doc) =>
                      doc.name.toLowerCase().includes(docSearch.toLowerCase()),
                    )
                    .map((doc) => (
                      <a
                        className="document-row"
                        key={doc.id}
                        href={'/api/documents?id=' + encodeURIComponent(doc.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Files size={20} />
                        <span>
                          <b>{doc.name}</b>
                          <small>
                            {doc.type === 'text/csv'
                              ? 'Structured financial data'
                              : 'Source document · manual review'}
                          </small>
                        </span>
                        <ExternalLink size={16} />
                      </a>
                    ))}
                  {[
                    ...new Map(
                      c.points
                        .filter(
                          (p) =>
                            p.url &&
                            p.source
                              .toLowerCase()
                              .includes(docSearch.toLowerCase()),
                        )
                        .map((p) => [p.url, p]),
                    ).values(),
                  ].map((p) => (
                    <a
                      className="document-row"
                      key={p.url}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Landmark size={20} />
                      <span>
                        <b>{p.source}</b>
                        <small>SEC filing index · original source</small>
                      </span>
                      <ExternalLink size={16} />
                    </a>
                  ))}
                  {!c.docs.length && !c.points.some((p) => p.url) && (
                    <div className="empty">
                      Your company documents will appear here.
                    </div>
                  )}
                </section>
              </>
            )}
            {tab === 'Investment memo' && (
              <section className="panel">
                <div className="toolbar">
                  <span>Editable research draft</span>
                  <div className="inline">
                    <Button
                      onClick={() => {
                        if (memo.trim()) {
                          setNotice(
                            'Your existing memo is preserved. Export it before replacing its content.',
                          );
                          return;
                        }
                        setMemo(makeMemo(c, a));
                        setDirty(true);
                      }}
                    >
                      Generate from financials
                    </Button>
                    <Button
                      onClick={() =>
                        download(
                          c.name + ' investment memo.txt',
                          memo || makeMemo(c, a),
                        )
                      }
                    >
                      <Download size={15} />
                      Export memo
                    </Button>
                    <Button onClick={() => window.print()}>Print / PDF</Button>
                  </div>
                </div>
                <textarea
                  className="memo"
                  aria-label="Investment memo"
                  placeholder="Generate a structured draft from your financials, then write your investment thesis here…"
                  value={memo}
                  onChange={(e) => {
                    setMemo(e.target.value);
                    setDirty(true);
                  }}
                />
                <div className="print-memo">{memo || makeMemo(c, a)}</div>
                <p className="footnote">
                  Generated drafts use fixed templates and your financial data;
                  no AI is called. Save the workspace to retain edits.
                </p>
              </section>
            )}
          </main>
        )}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Analyze a company</DialogTitle>
              <DialogDescription>
                Find a public company or create a workspace for your own
                materials.
              </DialogDescription>
            </DialogHeader>
            <div className="search-row">
              <input
                aria-label="Find SEC company"
                placeholder="Company, ticker, CIK, or SEC filing URL"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
              />
              <Button primary onClick={() => lookup()} disabled={!!busy}>
                Search
              </Button>
            </div>
            {busy && <output>{busy}</output>}
            {notice && <output className="dialog-notice">{notice}</output>}
            {matches.map((m) => (
              <button
                className="result"
                key={m.cik_str}
                onClick={() => lookup(String(m.cik_str))}
              >
                {m.title}
                <span>{m.ticker} →</span>
              </button>
            ))}
            <div className="divider">OR START WITH YOUR DOCUMENTS</div>
            <label className="field">
              Company name
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Industries"
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </label>
            <Button
              primary
              onClick={create}
              disabled={!!busy || !companyName.trim()}
            >
              Create workspace <ArrowUpRight size={16} />
            </Button>
            <button
              className="text-button"
              onClick={() =>
                download('folio-financial-template.csv', template, 'text/csv')
              }
            >
              Download the financial CSV template
            </button>
          </DialogContent>
        </Dialog>
        <Sheet open={!!source} onOpenChange={(o) => !o && setSource(null)}>
          <SheetContent className="source-sheet sm:max-w-lg overflow-auto">
            <SheetHeader>
              <SheetTitle>{source?.title}</SheetTitle>
              <SheetDescription>
                Source evidence and calculation details
              </SheetDescription>
            </SheetHeader>
            <div className="source-body">
              {source?.formula && (
                <div className="formula">{source.formula}</div>
              )}
              {source?.points.map((p, i) => (
                <section className="source-point" key={i}>
                  <span className="badge">{p.status}</span>
                  <h2>
                    {fmt(p.value)} <small>{p.unit}</small>
                  </h2>
                  <dl>
                    <dt>Metric</dt>
                    <dd>{p.metric}</dd>
                    <dt>Fiscal period end</dt>
                    <dd>{p.period}</dd>
                    <dt>Document</dt>
                    <dd>{p.source}</dd>
                    <dt>Section / XBRL concept</dt>
                    <dd>{p.section}</dd>
                  </dl>
                  {p.url && (
                    <a
                      className="text-button"
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original filing <ExternalLink size={15} />
                    </a>
                  )}
                  <p className="footnote">
                    {p.status === 'Reported'
                      ? 'SEC XBRL value scaled to millions. Compare with the original filing and its accounting notes.'
                      : p.status === 'Illustrative'
                        ? 'Fictional demonstration data.'
                        : 'User-imported value. Check the source and confirm units and reporting period.'}
                  </p>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </SidebarInset>
    </SidebarProvider>
  );
}
function FinancialTable({
  company,
  rows,
  inspect,
}: {
  company: Company;
  rows: string[];
  inspect: (metric: string, period: string) => void;
}) {
  const ps = periods(company);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          {ps.map((p) => (
            <TableHead key={p}>{p}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m}>
            <TableCell>
              {m === 'FCF' ? 'Free cash flow' : m}
              {m === 'Diluted shares' && <small> (m shares)</small>}
            </TableCell>
            {ps.map((p) => (
              <TableCell key={p}>
                <button className="data-point" onClick={() => inspect(m, p)}>
                  {fmt(m === 'FCF' ? fcf(company, p) : value(company, m, p))}
                </button>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
