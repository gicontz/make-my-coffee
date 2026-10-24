// The maintenance log's CSV export (issue #51). Escaping and the formula guard
// are the parts that go wrong silently — a broken file still downloads — so
// they are pinned here; the query itself is checked against the database.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CSV_HEADER,
  brewsToCsv,
  csvCell,
  exportFilename,
  manilaStamp,
  parseExportRange,
} from '../lib/maintenanceExport.ts'
import type { MaintenanceBrew } from '../lib/maintenanceBrews.ts'

const brew = (over: Partial<MaintenanceBrew> = {}): MaintenanceBrew => ({
  id: 1,
  activity: 'Backflush',
  beans_grams: 18,
  operator_id: 1,
  operator_name: 'Gim',
  status: 'done',
  created_at: '2026-10-21T00:30:00.000Z',
  done_at: '2026-10-21T01:05:00.000Z',
  failed_at: null,
  ...over,
})

/** Rows of a CSV without the BOM, split on CRLF. */
const lines = (csv: string) => csv.replace(/^﻿/, '').split('\r\n').filter(Boolean)

test('plain values pass through; commas, quotes and newlines are quoted', () => {
  assert.equal(csvCell('Backflush'), 'Backflush')
  assert.equal(csvCell(18), '18')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell('Grinder, burrs'), '"Grinder, burrs"')
  assert.equal(csvCell('the "new" lot'), '"the ""new"" lot"')
  assert.equal(csvCell('line one\nline two'), '"line one\nline two"')
})

test('a cell that would run as a formula is neutralised', () => {
  for (const evil of ['=HYPERLINK("http://x","click")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
    const cell = csvCell(evil)
    const unquoted = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell
    assert.ok(unquoted.startsWith("'"), `${JSON.stringify(evil)} would execute: ${cell}`)
  }
  // Numbers are ours and stay numbers, negative or not.
  assert.equal(csvCell(-5), '-5')
})

test('times are Asia/Manila, 24-hour, and sort as text', () => {
  assert.equal(manilaStamp('2026-10-21T00:30:00.000Z'), '2026-10-21 08:30')
  // 16:30 UTC is already the next day in Manila.
  assert.equal(manilaStamp('2026-10-21T16:30:00.000Z'), '2026-10-22 00:30')
  assert.equal(manilaStamp(null), null)
})

test('the CSV has a BOM, a header, CRLF rows, and the counted-as-used rule', () => {
  const csv = brewsToCsv([
    brew(),
    brew({ id: 2, status: 'failed', done_at: null, failed_at: '2026-10-21T02:00:00.000Z', beans_grams: 500 }),
    brew({ id: 3, status: 'in_progress', done_at: null }),
  ])
  assert.ok(csv.startsWith('﻿'), 'Excel needs the BOM to read UTF-8')
  assert.ok(!/[^\r]\n/.test(csv.replace(/"[^"]*"/g, '')), 'row ends must be CRLF')
  const [header, done, failed, inProgress] = lines(csv)
  assert.equal(header, CSV_HEADER.join(','))
  assert.equal(done, '1,Backflush,18,Yes,Gim,Done,2026-10-21 08:30,2026-10-21 09:05')
  assert.equal(failed, '2,Backflush,500,No,Gim,Failed,2026-10-21 08:30,2026-10-21 10:00')
  assert.equal(inProgress, '3,Backflush,18,No,Gim,In Progress,2026-10-21 08:30,')
})

test('an empty log is still a valid file with its header', () => {
  assert.deepEqual(lines(brewsToCsv([])), [CSV_HEADER.join(',')])
})

test('the range is optional at either end and must be real, ordered days', () => {
  assert.deepEqual(parseExportRange(null, null).range, { from: null, to: null })
  assert.deepEqual(parseExportRange('', '  ').range, { from: null, to: null })
  assert.deepEqual(parseExportRange('2026-10-01', '2026-10-31').range, { from: '2026-10-01', to: '2026-10-31' })
  assert.deepEqual(parseExportRange('2026-10-21', '2026-10-21').range, { from: '2026-10-21', to: '2026-10-21' })
  assert.deepEqual(parseExportRange(null, '2026-10-31').range, { from: null, to: '2026-10-31' })
  for (const [from, to] of [
    ['2026-02-30', null],
    ['10/21/2026', null],
    [null, '2026-13-01'],
    ['2026-10-31', '2026-10-01'],
    ["2026-10-01'; DROP TABLE x;--", null],
  ]) {
    assert.ok(parseExportRange(from, to).error, `accepted ${from} → ${to}`)
  }
})

test('the filename names the range, with open ends as "up to" today in Manila', () => {
  const now = new Date('2026-10-21T17:00:00.000Z') // already Oct 22 in Manila
  assert.equal(exportFilename({ from: '2026-10-01', to: '2026-10-31' }, now), 'maintenance-brews_2026-10-01_to_2026-10-31.csv')
  assert.equal(exportFilename({ from: '2026-10-01', to: null }, now), 'maintenance-brews_2026-10-01_to_2026-10-22.csv')
  assert.equal(exportFilename({ from: null, to: null }, now), 'maintenance-brews_up-to_2026-10-22.csv')
})
