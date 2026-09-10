import 'server-only';
import { neon } from '@neondatabase/serverless';
import { cookies, headers } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function db() {
  const uri = process.env.DATABASE_URL;
  if (!uri)
    throw Error(
      'The workspace service is being connected. Please try again shortly.',
    );
  const sql = neon(uri);
  return {
    prepare(statement: string) {
      let i = 0;
      const query = statement.replace(/\?/g, () => `$${++i}`);
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>() {
              return { results: (await sql.query(query, params)) as T[] };
            },
            async first<T = Record<string, unknown>>() {
              return (await sql.query(query, params))[0] as T | undefined;
            },
            async run() {
              return sql.query(query, params);
            },
          };
        },
      };
    },
  };
}
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds = 3600,
) {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const result = await db()
    .prepare(
      'INSERT INTO request_limits (key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count',
    )
    .bind(`${key}:${bucket}`)
    .first<{ count: number }>();
  if (!result || result.count > max)
    throw Error('Too many requests. Please try again later.');
}
export async function owner(create = false) {
  const jar = await cookies();
  let token = jar.get('folio_session')?.value;
  if (!token || !/^([a-f0-9]{64})$/.test(token)) {
    if (!create)
      throw Error('Your workspace is opening. Please refresh and try again.');
    const h = await headers();
    const ip =
      h.get('x-vercel-forwarded-for') || h.get('x-forwarded-for') || 'local';
    await rateLimit('session:' + hash(ip), 20, 86400);
    token = randomBytes(32).toString('hex');
    jar.set('folio_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 86400,
    });
  }
  return hash(token);
}
export function fail(e: unknown) {
  console.error(
    'Folio request failed:',
    e instanceof Error ? e.name : 'Unknown',
  );
  return Response.json(
    {
      error:
        e instanceof Error &&
        !/password|postgres|sql|relation|database.*does not/i.test(e.message)
          ? e.message
          : 'The workspace service is temporarily unavailable. Please try again.',
    },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function protect(r: Request) {
  const origin = r.headers.get('origin');
  if (
    r.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && new URL(origin).host !== new URL(r.url).host)
  )
    throw Error('Cross-site requests are not accepted.');
}
