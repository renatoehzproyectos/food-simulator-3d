export function erf(z) { // Simpson sobre e^{-t²}
  const n = 400, h = z / n; let s = 1 + Math.exp(-z * z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * Math.exp(-((i * h) ** 2));
  return 2 / Math.sqrt(Math.PI) * s * h / 3;
}
export const fill = (n, v) => new Float64Array(n).fill(v);
export const maxAbs = (a, f) => Math.max(...Array.from(a, (v, i) => Math.abs(v - f(i))));
