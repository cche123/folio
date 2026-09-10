import { db, owner, fail, protect, rateLimit } from '@/lib/server';
import { metrics } from '@/lib/finance';
export async function GET() {
  try {
    const user = await owner(true);
    const r = await db()
      .prepare(
        'SELECT data FROM workspaces WHERE owner = ? ORDER BY updated DESC LIMIT 100',
      )
      .bind(user)
      .all<{ data: string }>();
    return Response.json(
      r.results.map((r) => JSON.parse(r.data)),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await owner();
    await rateLimit('save:' + user, 60, 60);
    const text = await req.text();
    if (text.length > 1500000) throw Error('Workspace is too large.');
    const c = JSON.parse(text);
    if (
      !c.id ||
      typeof c.id !== 'string' ||
      !c.name ||
      typeof c.name !== 'string' ||
      !Array.isArray(c.points) ||
      c.points.length > 5000 ||
      !Array.isArray(c.docs)
    )
      throw Error('Invalid workspace.');
    if (c.demo) throw Error('Create your own workspace to save.');
    for (const p of c.points)
      if (
        !metrics.includes(p.metric) ||
        typeof p.value !== 'number' ||
        !Number.isFinite(p.value) ||
        typeof p.period !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.period) ||
        typeof p.source !== 'string' ||
        typeof p.section !== 'string' ||
        typeof p.unit !== 'string'
      )
        throw Error('Invalid financial datapoint.');
    if (typeof c.currency !== 'string' || !/^\w{3}$/.test(c.currency))
      throw Error('Invalid currency.');
    const seen = new Set();
    for (const p of c.points) {
      const key = p.metric + '|' + p.period;
      if (seen.has(key))
        throw Error('Duplicate datapoints require reconciliation.');
      seen.add(key);
      if (
        p.unit !==
        (p.metric === 'Diluted shares'
          ? 'shares millions'
          : c.currency + ' millions')
      )
        throw Error('Inconsistent financial units.');
      if (
        p.url &&
        !(
          typeof p.url === 'string' &&
          p.url.startsWith('https://www.sec.gov/Archives/edgar/data/')
        )
      )
        throw Error('Invalid source URL.');
    }
    const total = await db()
      .prepare('SELECT count(*) AS n FROM workspaces WHERE owner = ?')
      .bind(user)
      .first<{ n: string }>();
    const prior = await db()
      .prepare('SELECT owner FROM workspaces WHERE id = ?')
      .bind(c.id)
      .first<{ owner: string }>();
    if (!prior && Number(total?.n) >= 40)
      throw Error('This workspace can store up to 40 companies.');
    if (prior && prior.owner !== user) throw Error('Workspace not found.');
    await db()
      .prepare(
        'INSERT INTO workspaces (id,owner,name,data,updated) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,updated=excluded.updated WHERE workspaces.owner=excluded.owner',
      )
      .bind(c.id, user, c.name, text, new Date().toISOString())
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
