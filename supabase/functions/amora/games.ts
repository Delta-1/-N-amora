export type GameKind = 'tic'|'chess'|'checkers';
export type GameState = { cells:number[]; turn:number; winner:number|null; forced?:number; fen?:string; pgn?:string; last?:string };
export function initialGame(kind:GameKind):GameState {
 if(kind==='tic') return {cells:Array(9).fill(0),turn:1,winner:null};
 if(kind==='chess') return {cells:[],turn:1,winner:null,fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',pgn:''};
 return {cells:Array.from({length:64},(_,i)=>((Math.floor(i/8)+i%8)%2===1?(i<24?2:i>=40?1:0):0)),turn:1,winner:null};
}
function checkMoves(s:GameState,from:number,captureOnly=false):{from:number;to:number;over?:number}[]{
 const v=s.cells[from];if(!v||v%10!==s.turn||s.forced!==undefined&&s.forced!==from)return [];
 const row=Math.floor(from/8),col=from%8;const dirs=v>10?[-1,1]:s.turn===1?[-1]:[1];const out:{from:number;to:number;over?:number}[]=[];
 for(const dy of dirs)for(const dx of [-1,1]){const y=row+dy,x=col+dx;if(y<0||y>7||x<0||x>7)continue;const to=y*8+x;
 if(!s.cells[to]&&!captureOnly&&s.forced===undefined)out.push({from,to});
 if(s.cells[to]&&s.cells[to]%10!==s.turn){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<8&&xx>=0&&xx<8&&!s.cells[yy*8+xx])out.push({from,to:yy*8+xx,over:to});}}
 return out;
}
export function legalCheckers(s:GameState){const all=s.cells.flatMap((_,i)=>checkMoves(s,i));const captures=all.filter(m=>m.over!==undefined);return captures.length?captures:all;}
export function moveGame(kind:Exclude<GameKind,'chess'>,s:GameState,slot:number,from:number,to:number):GameState {
 if(s.winner!==null)throw Error('A partida terminou. Comecem outra rodada.');if(slot!==s.turn)throw Error('Espere a vez do seu amor.');
 if(kind==='tic') {if(!Number.isInteger(to)||to<0||to>8||s.cells[to])throw Error('Escolha uma casa vazia.');const cells=[...s.cells];cells[to]=slot;
 const win=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(a=>a.every(i=>cells[i]===slot));return {cells,turn:3-slot,winner:win?slot:cells.every(Boolean)?0:null};}
 const move=legalCheckers(s).find(m=>m.from===from&&m.to===to);if(!move)throw Error('Movimento inválido. Capturas são obrigatórias.');
 const cells=[...s.cells];const v=cells[from];cells[from]=0;cells[to]=v;if(move.over!==undefined)cells[move.over]=0;
 const crowned=(slot===1&&to<8||slot===2&&to>=56)&&v<10;if(crowned)cells[to]=v+10;
 const next:GameState={cells,turn:slot,winner:null};if(move.over!==undefined&&!crowned&&checkMoves({...next,forced:to},to,true).length){next.forced=to;return next;}
 next.turn=3-slot;if(!legalCheckers(next).length)next.winner=slot;return next;
}
