// Punto de entrada del Worker (solo cableado; la lógica está en worker-core.js).
import { createWorkerHandler } from './worker-core.js';
const handler = createWorkerHandler({ post: (m, tr) => self.postMessage(m, tr ?? []) });
self.onmessage = (e) => handler(e.data);
