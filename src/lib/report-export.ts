// Helpers para exportar relatórios em PDF e Excel (client-side).
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(filename: string, sheets: { name: string; rows: Record<string, any>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  filename: string,
  title: string,
  subtitle: string,
  tables: { title?: string; head: string[]; body: (string | number)[][] }[],
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(subtitle, 40, 58);
  doc.setTextColor(0);
  let y = 80;
  for (const t of tables) {
    if (t.title) {
      doc.setFontSize(11);
      doc.text(t.title, 40, y);
      y += 12;
    }
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });
    y = (doc as any).lastAutoTable.finalY + 20;

  }
  doc.save(`${filename}.pdf`);
}

export const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtPct = (n: number) =>
  `${((Number(n) || 0) * 100).toFixed(1)}%`;
