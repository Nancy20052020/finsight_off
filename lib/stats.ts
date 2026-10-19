export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function populationStd(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const square = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(square / values.length);
}

/** Pandas `Series.std` default (`ddof=1`). */
export function sampleStd(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const square = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(square / (values.length - 1));
}

export function truncTowardZero(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

/** Python 3 `round` (half to even) then `int`. */
export function pythonRoundInt(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const fraction = abs - floor;
  let magnitude: number;
  if (Math.abs(fraction - 0.5) < 1e-9) magnitude = floor % 2 === 0 ? floor : floor + 1;
  else magnitude = Math.round(abs);
  return sign * magnitude;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
}

export function solveLinear(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    let best = Math.abs(rows[col][col]);
    for (let row = col + 1; row < size; row += 1) {
      const value = Math.abs(rows[row][col]);
      if (value > best) {
        best = value;
        pivot = row;
      }
    }
    if (best < 1e-12) throw new Error("Variable-spend regression is singular");
    if (pivot !== col) {
      const swap = rows[col];
      rows[col] = rows[pivot];
      rows[pivot] = swap;
    }
    const divisor = rows[col][col];
    for (let column = col; column <= size; column += 1) rows[col][column] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      if (factor === 0) continue;
      for (let column = col; column <= size; column += 1) {
        rows[row][column] -= factor * rows[col][column];
      }
    }
  }
  return rows.map((row) => row[size]);
}

export function fitRidge(features: number[][], targets: number[], alpha: number): {
  coef: number[];
  intercept: number;
} {
  const samples = features.length;
  const width = features[0].length;
  const meanX = Array(width).fill(0);
  for (const row of features) {
    for (let column = 0; column < width; column += 1) meanX[column] += row[column];
  }
  for (let column = 0; column < width; column += 1) meanX[column] /= samples;
  const meanY = targets.reduce((sum, value) => sum + value, 0) / samples;
  const gram = Array.from({ length: width }, () => Array(width).fill(0));
  const right = Array(width).fill(0);
  for (let sample = 0; sample < samples; sample += 1) {
    const centered = features[sample].map((value, column) => value - meanX[column]);
    const centeredY = targets[sample] - meanY;
    for (let column = 0; column < width; column += 1) {
      right[column] += centered[column] * centeredY;
      for (let other = 0; other < width; other += 1) {
        gram[column][other] += centered[column] * centered[other];
      }
    }
  }
  for (let column = 0; column < width; column += 1) gram[column][column] += alpha;
  const coef = solveLinear(gram, right);
  let intercept = meanY;
  for (let column = 0; column < width; column += 1) intercept -= meanX[column] * coef[column];
  return { coef, intercept };
}

export function predictRidge(
  model: { coef: number[]; intercept: number },
  features: number[],
): number {
  let value = model.intercept;
  for (let column = 0; column < features.length; column += 1) {
    value += model.coef[column] * features[column];
  }
  return value;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function standardNormal(rng: () => number): number {
  let uniformA = rng();
  let uniformB = rng();
  if (uniformA < 1e-12) uniformA = 1e-12;
  return Math.sqrt(-2 * Math.log(uniformA)) * Math.cos(2 * Math.PI * uniformB);
}
