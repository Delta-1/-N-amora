import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..','public','pdfjs');
await mkdir(root,{recursive:true});
for(const [name,source] of [['pdf.min.mjs','build/pdf.min.mjs'],['pdf.worker.min.mjs','build/pdf.worker.min.mjs'],['LICENSE','LICENSE']]){
 const response=await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/'+source,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Unable to package pinned PDF.js '+name);
 await writeFile(path.join(root,name),new Uint8Array(await response.arrayBuffer()));
}
console.log('Pinned PDF.js 5.4.624 packaged locally for private in-app reading.');
