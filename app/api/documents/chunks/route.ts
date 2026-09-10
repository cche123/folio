import { db, owner, fail, protect } from '@/lib/server';
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await owner();
    const { id, part, data } = (await req.json()) as {
      id: string;
      part: number;
      data: string;
    };
    if (
      !Number.isInteger(part) ||
      typeof data !== 'string' ||
      data.length > 2000000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
    )
      throw Error('Invalid upload part.');
    const doc = await db()
      .prepare(
        'SELECT size,parts FROM documents WHERE id=? AND owner=? AND state=?',
      )
      .bind(id, user, 'pending')
      .first<{ size: number; parts: number }>();
    if (!doc || part < 0 || part >= doc.parts) throw Error('Upload not found.');
    const expected =
      part === doc.parts - 1 ? doc.size - part * 1500000 : 1500000;
    if (Buffer.from(data, 'base64').length !== expected)
      throw Error('Upload part has incorrect size.');
    await db()
      .prepare(
        'INSERT INTO document_chunks(document,part,data) VALUES(?,?,?) ON CONFLICT(document,part) DO UPDATE SET data=excluded.data',
      )
      .bind(id, part, data)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
