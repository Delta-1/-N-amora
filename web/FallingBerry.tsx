import {useState,type CSSProperties} from 'react';
import Berry from './Berry';

export default function FallingBerry(){
 const [falling,setFalling]=useState(false);
 const [drop,setDrop]=useState(55);
 return <button type="button" className="falling-berry" aria-label="Brincar com a gatinha Amora" title="Toque na Amora 😸" onClick={e=>{
  if(falling)return;
  const button=e.currentTarget,card=button.closest('.daily-card,.onboard-brand');
  const space=card?card.getBoundingClientRect().bottom-button.getBoundingClientRect().bottom-12:55;
  setDrop(Math.max(35,Math.min(110,space)));
  setFalling(true);
 }}>
  <span className={'berry-drop-sprite'+(falling?' is-falling':'')} style={{'--berry-drop':drop+'px'} as CSSProperties} onAnimationEnd={e=>{if(e.target===e.currentTarget)setFalling(false);}}><Berry/></span>
 </button>;
}
