import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dcf,
  defaults,
  importCSV,
  fcf,
  demoCompany,
  ratio,
} from '../lib/finance.ts';
void test('DCF matches independently derived constant cash-flow perpetuity', () => {
  const a = {
    ...defaults,
    growth: 0,
    margin: 20,
    tax: 0,
    da: 0,
    capex: 0,
    nwc: 0,
    wacc: 10,
    terminal: 0,
    cash: 7,
    debt: 2,
    shares: 5,
  };
  const d = dcf(100, a)!;
  assert.ok(Math.abs(d.ev - 200) < 1e-9);
  assert.ok(Math.abs(d.equity - 205) < 1e-9);
  assert.ok(Math.abs(d.perShare! - 41) < 1e-9);
});
void test('discount rate and terminal growth domain guarded', () => {
  assert.equal(dcf(100, { ...defaults, wacc: 2, terminal: 3 }), null);
  assert.equal(dcf(0, defaults), null);
  assert.equal(dcf(100, defaults)!.perShare, null);
});
void test('growth requires investment in incremental working capital', () => {
  const d = dcf(100, { ...defaults, growth: 10, nwc: 20 })!;
  assert.ok(Math.abs(d.rows[0].working - 2) < 1e-9);
  assert.ok(dcf(100, { ...defaults, wacc: 12 })!.ev < dcf(100, defaults)!.ev);
});
void test('CSV handles quotation and refuses duplicate data, missing numbers, mixed currencies', () => {
  const h = 'metric,period,value,unit,source\n';
  const row = 'Revenue,2025-12-31,100,USD millions,"Annual report, 2025"';
  assert.equal(importCSV(h + row, 'file')[0].source, 'Annual report, 2025');
  assert.throws(() => importCSV(h + row + '\n' + row, 'file'), /duplicate/i);
  assert.throws(
    () => importCSV(h + 'Revenue,2025-12-31,,USD millions,doc', 'file'),
    /missing/i,
  );
  assert.throws(
    () => importCSV(h + row + '\nCash,2025-12-31,2,EUR millions,doc', 'file'),
    /currencies/i,
  );
  assert.throws(
    () => importCSV(h + 'Capex,2025-12-31,-2,USD millions,doc', 'file'),
    /nonnegative/i,
  );
});
void test('missing figures do not become zero, free cash flow uses positive outflows', () => {
  const c = demoCompany();
  assert.equal(fcf(c, '2025-12-31'), 63);
  assert.equal(fcf(c, '2020-12-31'), null);
  assert.equal(ratio(10, 0), null);
});
