const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function prevYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}

export function todayStr(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function fmt(n: number): string {
  return (
    n.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}

export function fmtInput(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function parseAmt(value: string): number {
  const str = value.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!str) return NaN;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    return str.lastIndexOf(',') > str.lastIndexOf('.')
      ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
      : parseFloat(str.replace(/,/g, ''));
  }
  if (hasComma) {
    const afterComma = str.length - str.indexOf(',') - 1;
    return afterComma === 3
      ? parseFloat(str.replace(',', ''))   // thousands separator
      : parseFloat(str.replace(',', '.'));
  }
  if (hasDot) {
    const afterDot = str.length - str.indexOf('.') - 1;
    return afterDot === 3
      ? parseFloat(str.replace('.', ''))   // thousands separator
      : parseFloat(str);
  }
  return parseFloat(str);
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
