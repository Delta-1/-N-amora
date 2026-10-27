import {appIds,type AppId,type AppPreferences} from './mobile-model';
export const ROTARY_STEP=30;
export const wrapIndex=(index:number,count:number)=>count>0?((index%count)+count)%count:0;
export const angleDifference=(next:number,previous:number)=>((next-previous+540)%360)-180;
export const snapRotary=(degrees:number)=>-Math.round(Math.max(-90,Math.min(90,degrees))/ROTARY_STEP);
export function rotaryOrder(prefs:AppPreferences,admin:boolean):AppId[]{
 return [...new Set<AppId>(['map','lilith','community',...prefs.dock,...prefs.order])].filter(id=>appIds.includes(id)&&!prefs.hidden.includes(id)&&(admin||!['admin','studio'].includes(id)));
}
export function rotaryPoint(degrees:number){const angle=degrees*Math.PI/180;return {left:(100-87.5*Math.cos(angle))+'%',top:(100-87.5*Math.sin(angle))+'%'};}
