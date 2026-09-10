import assert from 'node:assert/strict';
const root = process.argv[2] || 'http://localhost:3000';
const initial = await fetch(root + '/api/workspaces');
const cookie = initial.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie, 'Anonymous browser session created');
assert.ok(Array.isArray(await initial.json()));
const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
async function post(path, body, method = 'POST') {
  // eslint-disable-next-line unicorn/no-invalid-fetch-options -- method is POST or PATCH only.
  const r = await fetch(root + path, {
    method,
    headers,
    // eslint-disable-next-line unicorn/no-invalid-fetch-options -- only POST or PATCH.
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const company = {
  id: crypto.randomUUID(),
  name: 'Synthetic verification',
  currency: 'USD',
  points: [],
  docs: [],
};
await post('/api/workspaces', company);
const list = await fetch(root + '/api/workspaces', { headers }).then((r) =>
  r.json(),
);
assert.ok(
  list.some((c) => c.id === company.id),
  'Company saved',
);
const content = Buffer.from('Synthetic document-storage verification.');
const doc = await post('/api/documents', {
  workspace: company.id,
  name: 'verification.txt',
  size: content.length,
});
await post('/api/documents/chunks', {
  id: doc.id,
  part: 0,
  data: content.toString('base64'),
});
await post('/api/documents', { id: doc.id }, 'PATCH');
const read = await fetch(root + '/api/documents?id=' + doc.id, { headers });
assert.equal(await read.text(), content.toString());
const other = await fetch(root + '/api/workspaces');
const otherCookie = other.headers.get('set-cookie')?.split(';')[0];
assert.ok(
  !(await other.json()).some((c) => c.id === company.id),
  'Separate browser cannot list workspace',
);
const rejected = await fetch(root + '/api/documents?id=' + doc.id, {
  headers: { Cookie: otherCookie },
});
assert.ok(!rejected.ok, 'Separate browser cannot read document');
const cross = await fetch(root + '/api/workspaces', {
  method: 'POST',
  headers: { ...headers, 'sec-fetch-site': 'cross-site' },
  body: JSON.stringify(company),
});
assert.ok(!cross.ok, 'Cross-site writes rejected');
console.log(
  'Passed: anonymous session, company persistence, chunked document round trip, browser isolation, cross-site write rejection.',
);
