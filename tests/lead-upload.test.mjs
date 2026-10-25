import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('CSV upload preserves UTF-8 headers and phone leading zero', () => {
  const context = {}; vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../vendor/xlsx.full.min.js', import.meta.url), 'utf8'), context);
  const bytes = new TextEncoder().encode('고객명,휴대전화번호,지역,관심품목\n테스트,01099990000,서울,TV');
  const workbook = context.XLSX.read(bytes, { type: 'array', raw: true, codepage: 65001, sheetRows: 102 });
  const rows = context.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
  assert.equal(rows[0]['휴대전화번호'], '01099990000'); assert.equal(rows[0]['고객명'], '테스트');
  const source = readFileSync(new URL('../lead-workspace.js', import.meta.url), 'utf8');
  assert.match(source, /raw: true, codepage: 65001/);
});
