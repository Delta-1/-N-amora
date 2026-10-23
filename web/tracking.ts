import {getClient,getBackendConfig} from './supabase';
import {native} from './native';
export type Place={id:string;name:string;latitude:number;longitude:number;radius:number};
export type SafetyEvent={id:number;user_id:string;kind:'arrival'|'sos';body:string;created_at:string};
export type TrackingState={enabled:boolean;steps_enabled:boolean;places:Place[];events:SafetyEvent[];steps:{user_id:string;steps:number}[]};
export async function trackingCall(payload:Record<string,unknown>={}){const c=getClient();if(!c)throw Error('Entre na sua conta.');const r=await c.rpc('namora_track',{payload});if(r.error)throw Error(r.error.message);return r.data as TrackingState;}
export async function syncNativeTracking(){const c=getClient();if(!c||!native()?.configureTracking)return;const {data:{session}}=await c.auth.getSession();if(session)native()!.configureTracking!(JSON.stringify({access:session.access_token,refresh:session.refresh_token,expires:session.expires_at,user:session.user.id,key:getBackendConfig()?.supabasePublishableKey}));}
export async function startTracking(steps:boolean){await trackingCall({action:'consent',enabled:true,steps_enabled:steps});await syncNativeTracking();native()?.tracking?.(true,steps);}
export async function stopTracking(){native()?.tracking?.(false,false);await trackingCall({action:'consent',enabled:false,steps_enabled:false});}
