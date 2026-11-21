// Inventario de assets VRChef (Fase 0). Uso: node tools/inventory-assets.mjs <dir> <salida.json>
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = process.argv[2], out = process.argv[3] ?? 'assets/metadata/inventory.json';
const walk = d => fs.readdirSync(d,{withFileTypes:true}).flatMap(e => e.isDirectory()? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
const cat = (rel) => { const p = rel.toLowerCase();
  if (p.includes('sounds')) return ['audio','sonido'];
  if (p.includes('/food/')||p.includes('\\food\\')) return ['alimento','alimento/ingrediente'];
  if (p.includes('kitchenequipment')) return ['recipiente/utensilio','equipo'];
  if (p.includes('kitchenfurniture')) return ['entorno/fuente de calor','mobiliario'];
  return ['otro','otro']; };
function glbInfo(f){ try{ const b=fs.readFileSync(f); if(b.readUInt32LE(0)!==0x46546C67) return {};
  const len=b.readUInt32LE(12); const j=JSON.parse(b.slice(20,20+len).toString());
  let min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
  for(const m of j.meshes??[]) for(const pr of m.primitives){ const a=j.accessors[pr.attributes.POSITION]; if(a?.min&&a?.max) for(let i=0;i<3;i++){min[i]=Math.min(min[i],a.min[i]);max[i]=Math.max(max[i],a.max[i]);}}
  return { bbox_size: max.map((v,i)=>+(v-min[i]).toFixed(4)), meshes:(j.meshes??[]).length, materials:(j.materials??[]).length,
           textures:(j.images??[]).length, animations:(j.animations??[]).length, skins:(j.skins??[]).length }; }catch{return {};} }
const items = walk(root).map(f => { const rel=path.relative(root,f).replaceAll('\\','/'); const ext=path.extname(f).slice(1).toLowerCase(); const st=fs.statSync(f);
  const [category,fn]=cat('/'+rel+'/'); const hash=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  return { name:path.basename(f), path:rel, format:ext, sizeBytes:st.size, ...(ext==='glb'?glbInfo(f):{}), function:fn, category, hash }; });
const byHash = {}; items.forEach(i => (byHash[i.hash] ??= []).push(i.path));
const duplicates = Object.values(byHash).filter(a=>a.length>1);
const byFormat = items.reduce((a,i)=>(a[i.format]=(a[i.format]??0)+1,a),{});
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out, JSON.stringify({ generated:new Date().toISOString(), total:items.length, totalBytes:items.reduce((s,i)=>s+i.sizeBytes,0), byFormat, duplicates, items },null,1));
console.log({ total:items.length, byFormat, duplicateGroups:duplicates.length });
