import { db, owner, fail, protect, rateLimit } from '@/lib/server';
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await owner();
    await rateLimit('upload:' + user, 40);
    const b = (await req.json()) as {
      workspace: string;
      name: string;
      size: number;
    };
    if (
      typeof b.name !== 'string' ||
      b.name.length > 200 ||
      !Number.isInteger(b.size) ||
      b.size <= 0 ||
      b.size > 12000000
    )
      throw Error('Choose a file under 12 MB.');
    const ext = b.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'csv', 'txt'].includes(ext || ''))
      throw Error('Use PDF, CSV, or TXT.');
    const workspace = await db()
      .prepare('SELECT id FROM workspaces WHERE id=? AND owner=?')
      .bind(b.workspace, user)
      .first();
    if (!workspace) throw Error('Workspace not found.');
    const usage = await db()
      .prepare(
        'SELECT COALESCE(sum(size),0) AS size FROM documents WHERE owner=?',
      )
      .bind(user)
      .first<{ size: string }>();
    if (Number(usage?.size) + b.size > 50000000)
      throw Error('This workspace has a 50 MB document limit.');
    const total = await db()
      .prepare('SELECT COALESCE(sum(size),0) AS size FROM documents')
      .bind()
      .first<{ size: string }>();
    if (Number(total?.size) + b.size > 200000000)
      throw Error(
        'Document storage is at capacity. Financial analysis remains available.',
      );
    const id = crypto.randomUUID(),
      type =
        ext === 'pdf'
          ? 'application/pdf'
          : ext === 'csv'
            ? 'text/csv'
            : 'text/plain',
      parts = Math.ceil(b.size / 1500000);
    await db()
      .prepare(
        'INSERT INTO documents(id,owner,workspace,name,type,size,parts,state) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(id, user, b.workspace, b.name, type, b.size, parts, 'pending')
      .run();
    return Response.json({ id, name: b.name, type, parts });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: Request) {
  try {
    protect(req);
    const user = await owner(),
      b = (await req.json()) as { id: string };
    const doc = await db()
      .prepare(
        'SELECT id,name,type,size,parts FROM documents WHERE id=? AND owner=?',
      )
      .bind(b.id, user)
      .first<{
        id: string;
        name: string;
        type: string;
        size: number;
        parts: number;
      }>();
    if (!doc) throw Error('Document not found.');
    const rows = await db()
      .prepare(
        'SELECT part,data FROM document_chunks WHERE document=? ORDER BY part',
      )
      .bind(doc.id)
      .all<{ part: number; data: string }>();
    if (
      rows.results.length !== doc.parts ||
      rows.results.reduce(
        (s, r) => s + Buffer.from(r.data, 'base64').length,
        0,
      ) !== doc.size
    )
      throw Error('Upload incomplete. Please retry.');
    await db()
      .prepare('UPDATE documents SET state=? WHERE id=? AND owner=?')
      .bind('ready', doc.id, user)
      .run();
    return Response.json({ id: doc.id, name: doc.name, type: doc.type });
  } catch (e) {
    return fail(e);
  }
}
export async function GET(req: Request) {
  try {
    const user = await owner(),
      id = new URL(req.url).searchParams.get('id');
    const doc = await db()
      .prepare(
        'SELECT name,type,parts FROM documents WHERE id=? AND owner=? AND state=?',
      )
      .bind(id, user, 'ready')
      .first<{ name: string; type: string; parts: number }>();
    if (!doc) throw Error('Document not found.');
    let part = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        if (part >= doc.parts) {
          controller.close();
          return;
        }
        try {
          const row = await db()
            .prepare(
              'SELECT data FROM document_chunks WHERE document=? AND part=?',
            )
            .bind(id, part++)
            .first<{ data: string }>();
          if (!row) throw Error('Missing document part');
          controller.enqueue(new Uint8Array(Buffer.from(row.data, 'base64')));
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': doc.type,
        'Content-Disposition': `inline; filename="${doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': 'sandbox',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
