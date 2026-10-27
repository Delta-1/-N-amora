import {useState} from 'react';
import {BookOpen,Images,Folder,Cloud} from 'lucide-react';
import FilesApp from './Files';
import {DriveSettings} from './IntegrationSettings';
export default function Library({cid,uid,demo,notify,onCamera}:{cid:string;uid:string;demo:boolean;notify:(s:string)=>void;onCamera:()=>void}){
 const [tab,setTab]=useState<'books'|'album'|'files'|'drive'>('books');
 return <section className="library-app"><header className="library-heading"><span className="library-mark"><BookOpen/></span><div><small>O QUE A GENTE GUARDA, VIRA HISTÓRIA</small><h1>Biblioteca</h1><p>Livros para dividir. Fotos para lembrar. Um acervo só de vocês.</p></div></header><nav className="library-tabs" aria-label="Seções da biblioteca">{([{id:'books',label:'Livros',icon:BookOpen},{id:'album',label:'Álbuns',icon:Images},{id:'files',label:'Arquivos',icon:Folder},{id:'drive',label:'Google Drive',icon:Cloud}] as const).map(t=><button key={t.id} className={tab===t.id?'active':''} aria-current={tab===t.id?'page':undefined} onClick={()=>setTab(t.id)}><t.icon size={18}/>{t.label}</button>)}</nav>{tab==='drive'?<DriveSettings linked={!demo&&!!cid} notify={notify}/>:<FilesApp key={tab} cid={cid} uid={uid} demo={demo} view={tab} notify={notify} onCamera={onCamera}/>}</section>;
}
