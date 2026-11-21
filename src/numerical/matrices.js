// @ts-check
// Álgebra mínima sobre Float64Array (REQ-NUM-002). numjs descartado (ver DEPENDENCIES.md).

/**
 * Algoritmo de Thomas para sistemas tridiagonales. a: sub (a[0] ignorado), b: diagonal, c: super (c[n-1] ignorado).
 * No modifica las entradas.
 * @returns {Float64Array} x
 */
export function solveTridiagonal(a, b, c, d) {
  const n = b.length;
  const cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
  if (b[0] === 0) throw new Error('solveTridiagonal: pivote nulo');
  cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    if (m === 0) throw new Error('solveTridiagonal: pivote nulo');
    cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function dot(u, v) { let s = 0; for (let i = 0; i < u.length; i++) s += u[i] * v[i]; return s; }

/**
 * Gradiente conjugado para A simétrica definida positiva. matvec(x, out) escribe A·x en out.
 * @returns {{x:Float64Array, iterations:number, residual:number}}
 */
export function conjugateGradient(matvec, b, { x0, tol = 1e-10, maxIter = 1000 } = {}) {
  const n = b.length;
  const x = x0 ? Float64Array.from(x0) : new Float64Array(n);
  const r = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n);
  matvec(x, Ap);
  for (let i = 0; i < n; i++) { r[i] = b[i] - Ap[i]; p[i] = r[i]; }
  let rs = dot(r, r); const bn = Math.sqrt(dot(b, b)) || 1;
  let it = 0;
  while (it < maxIter && Math.sqrt(rs) / bn > tol) {
    matvec(p, Ap);
    const alpha = rs / dot(p, Ap);
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; }
    const rsNew = dot(r, r);
    const beta = rsNew / rs; rs = rsNew;
    for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i];
    it++;
  }
  return { x, iterations: it, residual: Math.sqrt(rs) / bn };
}
