import fs from 'node:fs'; import path from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export const PUBLIC = path.resolve('public');
/** fetchGLTF para Node: lee el GLB de /public y lo parsea con GLTFLoader (cuenta las lecturas). */
export function nodeFetcher(counter = { n: 0, urls: [] }) {
  const fn = (url) => { counter.n++; counter.urls.push(url); const clean = url.replace(/^\.\//, ''); const buf = fs.readFileSync(path.join(PUBLIC, clean)); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej)); };
  fn.counter = counter; return fn;
}
