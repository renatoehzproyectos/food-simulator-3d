// REQ: regla de capas (sec. 2). core/physics/chemistry/food/numerical no importan three ni DOM.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import path from 'node:path';
const PURE = ['core', 'physics', 'chemistry', 'food', 'numerical', 'output'];
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const FORBIDDEN = [/from\s+['"]three/, /import\s*\(\s*['"]three/, /\bdocument\./, /\bwindow\./, /Math\.random\(/];
describe('capas', () => {
  for (const layer of PURE) it(`${layer}/ no usa three, DOM ni Math.random`, () => {
    for (const f of walk(path.join('src', layer)).filter((x) => x.endsWith('.js')))
      for (const re of FORBIDDEN) expect(fs.readFileSync(f, 'utf8'), `${f} ${re}`).not.toMatch(re);
  });
  it('engine3d no importa la física/química/alimentos (solo core/prng y output/adapter)', () => {
    for (const f of walk(path.join('src', 'engine3d')).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(f, 'utf8'); expect(src, f).not.toMatch(/from\s+['"]\.\.\/(physics|chemistry|food|numerical)\//);
    }
  });
  it('interaction-logic.js (comandos) no importa three', () => { expect(fs.readFileSync('src/engine3d/interaction-logic.js', 'utf8')).not.toMatch(/from\s+['"]three/); });
  it('el detector funciona (detecta un import de three)', () => { expect(FORBIDDEN[0].test("import * as T from 'three'")).toBe(true); });
});
