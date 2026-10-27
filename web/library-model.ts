import type {CoupleFile} from './media';
export const photoYear=(file:Pick<CoupleFile,'created_at'|'taken_at'>)=>{const d=new Date(file.taken_at||file.created_at);return Number.isNaN(d.getTime())?'Sem data':String(d.getFullYear());};
export function groupPhotos<T extends Pick<CoupleFile,'created_at'|'taken_at'>>(files:T[]){const groups=new Map<string,T[]>();for(const f of files){const year=photoYear(f);if(!groups.has(year))groups.set(year,[]);groups.get(year)!.push(f);}return [...groups].sort(([a],[b])=>b.localeCompare(a));}
export const readablePdf=(f:Pick<CoupleFile,'mime'|'name'>)=>f.mime==='application/pdf'||/\.pdf$/i.test(f.name);
