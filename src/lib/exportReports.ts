import ExcelJS from "exceljs";
import type { AppUser, FieldReport } from "./types";

const labels = { installation: "تركيب", maintenance: "صيانة", inspection: "كشف" };
const money = '#,##0.00 "₪"';
type Value = string | number | Date;

function date(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("يوجد تقرير بتاريخ غير صالح. صحح التاريخ قبل التصدير.");
  }
  return parsed;
}

function number(value: number) {
  if (!Number.isFinite(value)) throw new Error("يوجد مبلغ أو كمية غير صالحة في التقارير.");
  return value;
}

export function createReportsWorkbook(source: FieldReport[], user: AppUser, scope: string) {
  const reports = source.filter((r) => !r.archived && (user.role === "admin" || r.createdByUid === user.uid))
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.reportNumber.localeCompare(b.reportNumber));
  if (!reports.length) throw new Error("لا توجد تقارير قابلة للتصدير ضمن الفلاتر الحالية.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "شركة النسيم إخوان";
  workbook.created = new Date();
  const stamp = new Date().toISOString();

  function sheet(name: string, headers: string[], rows: Value[][], currencyColumns: number[] = [], dateColumns: number[] = []) {
    const ws = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 5 }] });
    ws.mergeCells(1, 1, 1, headers.length);
    ws.getCell(1, 1).value = `شركة النسيم إخوان - ${name}`;
    ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, headers.length);
    ws.getCell(2, 1).value = `المصدر: تقارير التطبيق | ${scope} | صدّره: ${user.displayName} | ${stamp}`;
    ws.mergeCells(3, 1, 3, headers.length);
    ws.getCell(3, 1).value = "لقطة وقت التصدير؛ الملخصات لا تتحدث عند تعديل الملف. القيم مصنفة حسب طريقة الدفع وليست إثبات تحصيل.";
    ws.getRow(2).height = 34;
    ws.getRow(3).height = 34;
    ws.addTable({ name: `ExportTable${workbook.worksheets.length}`, ref: "A5", headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })), rows });
    ws.columns.forEach((col, index) => {
      col.width = Math.max(18, Math.min(38, headers[index].length + 5));
      col.numFmt = "@";
    });
    ws.eachRow((row, rowIndex) => {
      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, color: { argb: "FF202B30" } };
        cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true, readingOrder: "rtl" };
        if (typeof cell.value === "number") cell.numFmt = "#,##0.##";
      });
      if (rowIndex >= 5) row.height = rowIndex === 5 ? 40 : 32;
    });
    for (const column of currencyColumns) ws.getColumn(column).numFmt = money;
    for (const column of dateColumns) ws.getColumn(column).numFmt = "yyyy-mm-dd";
    for (const rowIndex of [1, 5]) ws.getRow(rowIndex).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF811914" } };
      cell.font = { name: "Arial", size: rowIndex === 1 ? 16 : 11, bold: true, color: { argb: "FFFFFFFF" } };
    });
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5" };
    return ws;
  }

  const detail: Value[][] = [];
  const parts: Value[][] = [];
  const technicians: Value[][] = [];
  const summaries = new Map<string, { period: string; annual: boolean; uid: string; name: string; count: number; installation: number; maintenance: number; inspection: number; parts: number; fees: number; cash: number; account: number }>();
  for (const r of reports) {
    const reportDate = date(r.reportDate);
    const year = reportDate.getUTCFullYear();
    const month = reportDate.getUTCMonth() + 1;
    const partsValue = r.parts.reduce((sum, part) => sum + number(part.quantity) * number(part.price), 0);
    const fees = number(r.serviceFee);
    const total = partsValue + fees;
    detail.push([r.id || r.reportNumber, r.reportNumber, reportDate, year, month, r.createdByUid, r.createdByName,
      r.customerName, r.customerPhone, r.orderNumber, r.area, r.projectName, labels[r.workType],
      partsValue, fees, total, r.paymentStatus === "cash" ? "نقدًا" : "على الذمة", r.warranty === "yes" ? "نعم" : "لا",
      r.problemDescription, r.recommendations, r.carNumber, r.startTime, r.endTime,
      r.previousSupply === "yes" ? "نعم" : "لا", r.previousSupplyDetails]);
    for (const part of r.parts) {
      if (!part.item.trim() && !part.price) continue;
      parts.push([r.id || r.reportNumber, r.reportNumber, reportDate, year, month, r.createdByName, part.item, part.quantity, part.price, part.quantity * part.price]);
    }
    for (const name of new Set(r.technicians.map((name) => name.trim()).filter(Boolean))) {
      technicians.push([r.id || r.reportNumber, r.reportNumber, reportDate, year, month, name, r.createdByName, labels[r.workType], r.area]);
    }
    for (const annual of [true, false]) {
      const period = annual ? String(year) : r.reportDate.slice(0, 7);
      const key = JSON.stringify([annual, period, r.createdByUid]);
      const entry = summaries.get(key) || { period, annual, uid: r.createdByUid, name: r.createdByName, count: 0, installation: 0, maintenance: 0, inspection: 0, parts: 0, fees: 0, cash: 0, account: 0 };
      entry.count++;
      entry[r.workType]++;
      entry.parts += partsValue;
      entry.fees += fees;
      if (r.paymentStatus === "cash") entry.cash += total;
      else entry.account += total;
      summaries.set(key, entry);
    }
  }
  for (const annual of [true, false]) {
    const rows = [...summaries.values()].filter((r) => r.annual === annual)
      .sort((a, b) => a.period.localeCompare(b.period) || a.uid.localeCompare(b.uid))
      .map((r) => [r.period, r.uid, r.name, r.count, r.installation, r.maintenance, r.inspection, r.parts, r.fees, r.parts + r.fees, r.cash, r.account]);
    sheet(annual ? "الملخص السنوي" : "الملخص الشهري",
      ["الفترة", "معرف الموظف", "موظف الإدخال", "عدد التقارير", "تركيب", "صيانة", "كشف", "قيمة القطع", "أجور الصيانة", "قيمة التقارير", "قيمة المصنف نقدًا", "قيمة المصنف على الذمة"], rows, [8, 9, 10, 11, 12]);
  }
  sheet("التقارير", ["معرف التقرير", "رقم التقرير", "التاريخ", "السنة", "الشهر", "معرف الموظف", "موظف الإدخال", "العميل", "الجوال", "رقم الطلب", "المنطقة", "المشروع", "نوع العمل", "قيمة القطع", "أجور الصيانة", "المجموع", "طريقة الدفع", "ضمن الكفالة", "وصف العمل", "التوصيات", "السيارة", "وقت البداية", "وقت النهاية", "توريد سابق", "تفاصيل التوريد"], detail, [14, 15, 16], [3]);
  sheet("القطع", ["معرف التقرير", "رقم التقرير", "التاريخ", "السنة", "الشهر", "موظف الإدخال", "الصنف", "الكمية", "سعر الوحدة", "قيمة القطع"], parts, [9, 10], [3]);
  sheet("الفنيون", ["معرف التقرير", "رقم التقرير", "التاريخ", "السنة", "الشهر", "الفني", "موظف الإدخال", "نوع العمل", "المنطقة"], technicians, [], [3]);
  return workbook;
}

export async function downloadReportsExcel(reports: FieldReport[], user: AppUser, scope: string) {
  const workbook = createReportsWorkbook(reports, user, scope);
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alnaseem-reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
