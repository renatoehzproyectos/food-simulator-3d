import { solveODE } from './numerical/ode.js';
const k = 0.5;
const r = solveODE((t, y) => [-k * y[0]], [0, 10], [1], { method: 'auto', events: (t, y) => y[0] - 0.5 });
document.getElementById('out').textContent =
  `y(10) = ${r.y[0].at(-1).toExponential(4)} (exacto ${Math.exp(-k * 10).toExponential(4)})\n` +
  `y = 0.5 en t = ${r.events[0].t[0].toFixed(5)} s (exacto ${(Math.LN2 / k).toFixed(5)})\nmétodo: ${r.method}`;
