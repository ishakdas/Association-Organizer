import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Transaction {
  id: string;
  description: string | null;
  amountInKurus: number;
  type: 'INCOME' | 'EXPENSE';
  transactionDate: string;
  category?: { name: string } | null;
}

interface ReportItem {
  categoryName: string;
  type: 'INCOME' | 'EXPENSE';
  totalAmountKurus: number;
  transactionCount: number;
}

export function exportToExcel(
  transactions: Transaction[],
  filename: string,
) {
  const data = transactions.map((tx) => ({
    'Tarih': new Date(tx.transactionDate).toLocaleDateString('tr-TR'),
    'Açıklama': tx.description || '-',
    'Kategori': tx.category?.name || '-',
    'Tip': tx.type === 'INCOME' ? 'Gelir' : 'Gider',
    'Tutar (TL)': (tx.amountInKurus / 100).toFixed(2),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'İşlemler');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportReportToExcel(
  report: ReportItem[],
  filename: string,
) {
  const data = report.map((item) => ({
    'Kategori': item.categoryName,
    'Tip': item.type === 'INCOME' ? 'Gelir' : 'Gider',
    'Toplam Tutar (TL)': (item.totalAmountKurus / 100).toFixed(2),
    'İşlem Sayısı': item.transactionCount,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  elementId: string,
  filename: string,
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const pageHeight = 295;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}
