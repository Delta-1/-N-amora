import type {State,Member} from './model';
export function activeLocations(locations:State['locations'],now=Date.now()){
 return locations.filter(p=>p.latitude.trim()!==''&&p.longitude.trim()!==''&&Number.isFinite(+p.latitude)&&Math.abs(+p.latitude)<=90&&Number.isFinite(+p.longitude)&&Math.abs(+p.longitude)<=180&&Number.isFinite(p.updatedAt)&&now-p.updatedAt<15*60000&&p.updatedAt<=now+60000);
}
export function memberColor(member?:Pick<Member,'slot'>){return member?.slot===2?'sage':'rose';}
