import Amora from './Berry';
export default function Orb({small=false,speaking=false}:{small?:boolean;speaking?:boolean}){return <span role="img" aria-label={speaking?'Lilith falando':'Lilith'} className={`lilith-orb cat-orb ${small?'small':''} ${speaking?'speaking':''}`}><Amora small={small} pulse={speaking}/></span>;}
