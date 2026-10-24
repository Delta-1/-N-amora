export const WEB_APP='https://delta-1.github.io/-N-amora/docs/';
export function cleanInvite(value:string){const s=value.replace(/[\s-]/g,'').toUpperCase();return /^(?:[A-F0-9]{10}|[A-F0-9]{16})$/.test(s)?s:'';}
export function inviteLink(code:string){const clean=cleanInvite(code);if(!clean)throw Error('Convite inválido');return WEB_APP+'?invite='+clean;}
export function incomingInvite(){const code=cleanInvite(new URLSearchParams(location.search).get('invite')||'');if(code){sessionStorage.setItem('amora.invite',code);const url=new URL(location.href);url.searchParams.delete('invite');history.replaceState(history.state,'',url);}return code||cleanInvite(sessionStorage.getItem('amora.invite')||'');}
