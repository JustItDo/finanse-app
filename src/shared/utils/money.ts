export function formatMinorUnits(amountMinor: number, currencyCode = 'PLN') {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function parseMoneyToMinorUnits(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function formatMinorUnitsInput(amountMinor: number | null | undefined) {
  if (amountMinor === null || amountMinor === undefined) {
    return '';
  }

  return (amountMinor / 100).toFixed(2).replace('.', ',');
}
