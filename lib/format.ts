/** Round half to even, matching Python's format rounding. */
export function roundTo(value: number, decimals = 0): number {
  const sign = value < 0 ? -1 : 1;
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  const floor = Math.floor(scaled + 1e-10);
  const fraction = scaled - floor;
  let magnitude: number;
  if (fraction > 0.5 + 1e-8) magnitude = floor + 1;
  else if (fraction < 0.5 - 1e-8) magnitude = floor;
  else magnitude = floor % 2 === 0 ? floor : floor + 1;
  return (sign * magnitude) / factor;
}

function grouped(value: number, decimals: number): string {
  const fixed = Math.abs(roundTo(value, decimals)).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals > 0 ? `${withCommas}.${fraction}` : withCommas;
}

export function money(value: number): string {
  const negative = roundTo(value, 0) < 0;
  return `${negative ? "-" : ""}$${grouped(value, 0)}`;
}

export function signedMoney(value: number): string {
  if (roundTo(value, 0) > 0) return `+${money(value)}`;
  return money(value);
}

export function percent(value: number): string {
  return `${roundTo(value * 100, 0).toFixed(0)}%`;
}

export function oneDecimal(value: number): string {
  return roundTo(value, 1).toFixed(1);
}
