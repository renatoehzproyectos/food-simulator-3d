// REQ-TEST-001: datos experimentales de referencia. Sin datos verificables → `todo`, nunca valores inventados.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const ref = JSON.parse(fs.readFileSync(new URL('./reference-data/rice-references.json', import.meta.url), 'utf8'));

describe('datos de referencia', () => {
  it('toda entrada con valor tiene fuente; las pendientes no llevan valor', () => {
    for (const e of ref.entries) {
      if (e.status === 'todo') expect(e.value, e.id).toBeUndefined();
      else { expect(e.value, e.id).toBeDefined(); expect(String(e.source ?? '').length, `${e.id} sin fuente`).toBeGreaterThan(10); }
    }
  });
  for (const e of ref.entries.filter((x) => x.status === 'todo')) it.todo(`comparar con datos publicados: ${e.id} — ${e.required}`);
});
