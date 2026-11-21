// REQ: regla de capas (sec. 2). core/physics/chemistry/food/numerical no importan three ni DOM.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import path from 'node:path';
const PURE = ['core', 'physics', 'chemistry', 'food', 'numerical'];
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const FORBIDDEN = [/from\s+['"]three/, /import\s*\(\s*['"]three/, /\bdocument\./, /\bwindow\./, /Math\.random\(/];
describe('capas', () => {
  for (const layer of PURE) it(`${layer}/ no usa three, DOM ni Math.random`, () => {
    for (const f of walk(path.join('src', layer)).filter((x) => x.endsWith('.js')))
      for (const re of FORBIDDEN) expect(fs.readFileSync(f, 'utf8'), `${f} ${re}`).not.toMatch(re);
  });
  it('el detector funciona (detecta un import de three)', () => { expect(FORBIDDEN[0].test("import * as T from 'three'")).toBe(true); });
});
