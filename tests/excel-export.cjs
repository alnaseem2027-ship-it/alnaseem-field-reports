const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const ExcelJS = require('exceljs');
const filename = path.resolve('src/lib/exportReports.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { createReportsWorkbook } = mod.exports;
const report = (id, uid, reportDate, paymentStatus = 'cash') => ({
  id, reportNumber: id, createdByUid: uid, createdByName: 'نفس الاسم', reportDate, paymentStatus,
  customerName: '=SUM(A1:A2)', customerPhone: '0599000000', orderNumber: '0012',
  area: 'رام الله', projectName: '', workType: 'maintenance', serviceFee: 5.5,
  parts: [{ item: 'قطعة', quantity: 2, price: 10.25 }], technicians: ['أحمد', 'أحمد', '  '],
  warranty: 'yes', problemDescription: '', recommendations: '', carNumber: '', startTime: '', endTime: '',
  previousSupply: 'no', previousSupplyDetails: '', archived: false
});
(async () => {
  const data = [report('1', 'a', '2025-12-31'), report('2', 'b', '2026-01-01', 'on_account'), report('3', 'a', '2026-01-31'), { ...report('4', 'a', '2026-02-01'), archived: true }];
  const admin = { uid: 'admin', role: 'admin', displayName: 'المدير' };
  const wb = createReportsWorkbook(data, admin, 'اختبار');
  assert.equal(wb.worksheets.length, 5);
  const bytes = await wb.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  const details = reopened.getWorksheet('التقارير');
  assert.equal(details.rowCount, 8);
  assert.equal(details.getCell('I6').value, '0599000000');
  assert.equal(details.getCell('H6').value, '=SUM(A1:A2)');
  assert.equal(details.getCell('H6').type, ExcelJS.ValueType.String);
  assert.equal(details.getCell('P6').value, 26);
  assert(details.getCell('C6').value instanceof Date);
  assert.equal(details.getCell('C6').value.toISOString().slice(0, 10), '2025-12-31');
  assert.equal(reopened.getWorksheet('الفنيون').rowCount, 8);
  const monthly = reopened.getWorksheet('الملخص الشهري');
  assert.equal(monthly.rowCount, 8);
  assert.equal(monthly.getCell('J6').value + monthly.getCell('J7').value + monthly.getCell('J8').value, 78);
  assert.equal(monthly.getCell('L8').value, 26);
  for (const ws of reopened.worksheets) {
    assert.equal(ws.views[0].rightToLeft, true);
    assert.equal(ws.views[0].ySplit, 5);
    assert.equal(ws.getTables().length, 1);
  }
  const employee = createReportsWorkbook(data, { uid: 'a', role: 'employee', displayName: 'موظف' }, 'اختبار');
  assert.equal(employee.getWorksheet('التقارير').rowCount, 7);
  assert.throws(() => createReportsWorkbook([], admin, ''), /لا توجد/);
  assert.throws(() => createReportsWorkbook([report('x', 'a', '2026-02-30')], admin, ''), /بتاريخ/);
  const many = Array.from({ length: 250 }, (_, i) => report(String(i), 'a', '2026-01-01'));
  assert.equal(createReportsWorkbook(many, admin, '').getWorksheet('التقارير').rowCount, 255);
  const emptyDetails = createReportsWorkbook([{ ...data[0], parts: [], technicians: [] }], admin, '');
  await emptyDetails.xlsx.writeBuffer();
  console.log('PASS: XLSX round-trip, dates, numbers, text safety, RTL, tables, 250 reports, employee scope, archived exclusion, summaries and empty detail sheets.');
})().catch((error) => { console.error(error); process.exit(1); });
