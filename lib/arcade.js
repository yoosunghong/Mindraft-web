import { randomInt } from 'node:crypto';
import { circuit, cargoBoard, rotateCells, signalTargets } from '../public/puzzles.js';
export const ARCADE_GAMES=[
 {id:'robot',title:'고장 난 로봇을 구해라!',subtitle:'작은 회로, 커다란 가능성',icon:'⚡',color:'mint',tag:'논리적 문제해결력',weights:[.6,.2,0,.2,0,0],mode:'회로 회전 · 경로 최적화',description:'회로를 돌려 로봇에게 전력을 전달하세요. 전력 예산과 필수 장치를 함께 고려해요.'},
 {id:'cargo',title:'우주 택배 정리왕',subtitle:'빈틈없이 채우는 나만의 전략',icon:'▦',color:'lavender',tag:'공간지각력 · 공간 계획',weights:[.3,0,.3,.4,0,0],mode:'공간 배치 퍼즐',description:'택배를 회전하고 옮겨 우주선 화물칸을 채워요. 서두르기보다 다음 자리를 생각해 보세요.'},
 {id:'signal',title:'반딧불이 신호 연구소',subtitle:'작은 빛에 귀 기울이는 시간',icon:'✦',color:'blue',tag:'순서 기억력 · 선택적 주의',weights:[.5,.3,0,0,.2,0],mode:'순서 기억 · 리듬',description:'빛나는 신호를 기억하고 순서대로 입력하세요. 방해 신호와 바뀌는 규칙에 주의해요.'},
 {id:'cafe',title:'오늘은 내가 가게 사장!',subtitle:'정확한 한 잔, 기분 좋은 하루',icon:'☕',color:'peach',tag:'수량 판단 · 우선순위',weights:[.4,0,0,.4,.2,0],mode:'주문 처리 · 재고 판단',description:'주문에 맞춰 상품과 수량을 준비해요. 한정된 재고와 급한 주문도 살펴보세요.'}
];
const levels=['하','중','상'];
export function makeArcadeTasks(game){return levels.map((difficulty,level)=>{
 const base={kind:game,id:`${game}-${level+1}-${randomInt(100000)}`,difficulty,level,title:`${difficulty} 난이도 · ${ARCADE_GAMES.find(g=>g.id===game).mode}`,text:ARCADE_GAMES.find(g=>g.id===game).description};
 if(game==='robot'){
  const tiles=[{ports:[1,2],cost:1},{ports:[1,3],cost:1},{ports:[1,3],cost:2,broken:level===2},{ports:[2,3],cost:1},{ports:[0,1,3],cost:1},{ports:[1,3],cost:level+2,label:'배터리'},{ports:[1,3],cost:level+2,label:'냉각'},{ports:[0,1,3],cost:1}];
  const t={...base,size:4,tiles,source:4,goal:7,budget:[9,13,17][level],required:level===0?[]:level===1?[5]:[5,6],rotations:tiles.map(()=>randomInt(4))};
  const analysis=solveCircuit(t);return {...t,...analysis};
 }
 if(game==='cargo'){
  const size=level+4,obstacles=level===2?[0,size*size-1]:[];
  // Partition the entire usable board into irregular strips; retain a constructive solution.
  const groups=Array.from({length:level+3},()=>[]);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){if(obstacles.includes(y*size+x))continue;const bounds=Array.from({length:groups.length+1},(_,i)=>i===groups.length?size:i>=groups.length-1?i+1:i);if(y%2)bounds[groups.length-2]++;const group=groups.findIndex((_,i)=>x>=bounds[i]&&x<bounds[i+1]);groups[group].push([x,y]);}
  const solution=[];const pieces=groups.map((cells,i)=>{const x=Math.min(...cells.map(p=>p[0])),y=Math.min(...cells.map(p=>p[1]));const shape=cells.map(([a,b])=>[a-x,b-y]),r=(i+level)%4;solution.push({x,y,r:(4-r)%4});return {symbol:['★','◆','●','▲','✚'][i],cells:rotateCells(shape,r)};});
  return {...base,size,obstacles,pieces,solution,moves:level===0?99:level===1?6:7,optimal:size*size-obstacles.length};
 }
 if(game==='signal'){
  const sequence=[];for(let i=0;i<[3,5,7][level];i++){const key=randomInt(4);if(level&&i===1)sequence.push({key:(key+1)%4,decoy:true});sequence.push({key,ignore:level===2&&i>=3?2:null});}
  return {...base,sequence,beat:[900,750,650][level],switchAt:level===2?4:null};
 }
 const products=['아메리카노','크루아상','딸기 라떼','토스트'];
 const orders=Array.from({length:level+1},(_,i)=>({id:i,name:['민서','하준','서윤'][i],items:products.map((_,j)=>j<level+2?1+(i+j+level)%2:0),priority:level===2?[2,0,1][i]:i,deadline:level===2?[90,45,65][i]:180}));
 return {...base,products,orders,stock:products.map((_,j)=>orders.reduce((s,o)=>s+o.items[j],0)),priorityOrder:orders.toSorted((a,b)=>a.priority-b.priority).map(o=>o.id)};
});}
const circuitCache=new Map();
export function solveCircuit(task){
 const key=JSON.stringify([task.tiles,task.required,task.rotations]);if(circuitCache.has(key))return circuitCache.get(key);
 let optimal=Infinity,minRotations=Infinity,alternatives=0,solution=null;
 const r=Array(task.tiles.length).fill(0);
 function visit(i){if(i===r.length){const s=circuit(task,r);if(!s.success)return;alternatives++;const turns=r.reduce((sum,v,j)=>sum+(v-task.rotations[j]+4)%4,0);if(s.power<optimal){optimal=s.power;solution=[...r];}minRotations=Math.min(minRotations,turns);return;}for(let j=0;j<4;j++){r[i]=j;visit(i+1);}}
 visit(0);if(!solution)throw Error('Unsolvable circuit');const result={optimal,minRotations,alternatives,solution};circuitCache.set(key,result);if(circuitCache.size>50)circuitCache.delete(circuitCache.keys().next().value);return result;
}
export function arcadePublic(task){const {solution,minRotations,alternatives,priorityOrder,...safe}=task;return safe;}
export function evaluateArcade(t,a,elapsed){
 let quality=0,explanation='',metrics={};
 if(t.kind==='robot'){
  if(!Array.isArray(a)||a.length!==t.tiles.length||a.some(r=>!Number.isInteger(r)||r<0||r>3))throw Error('회로 방향이 올바르지 않아요.');
  const s=circuit(t,a);quality=s.success?1:0;metrics={...s,optimal:t.optimal,minRotations:t.minRotations};explanation=`${s.connected?'연결 성공':'연결이 끊어졌어요'} · 전력 ${s.power}/${t.budget}W · ${s.required?'필수 장치 충족':'필수 장치를 연결하세요'}`;
 }else if(t.kind==='cargo'){
  if(!Array.isArray(a)||a.length!==t.pieces.length)throw Error('모든 택배의 위치를 확인해주세요.');const board=cargoBoard(t,a);if(!board)throw Error('택배가 겹치거나 화물칸을 벗어났어요.');
  const filled=board.filter(i=>i>=0).length;quality=filled/t.optimal;metrics={filled,empty:board.filter(i=>i===-1).length,optimal:t.optimal};explanation=`공간 활용률 ${Math.round(quality*100)}% · 남은 빈칸 ${metrics.empty}개`;
 }else if(t.kind==='signal'){
  if(!a||!['memory','rhythm'].includes(a.mode)||!Array.isArray(a.inputs)||a.inputs.length>12||a.inputs.some(s=>!Number.isInteger(s.key)||s.key<0||s.key>3||!Number.isFinite(s.at)||s.at<0||s.at>elapsed+2000))throw Error('신호 입력이 올바르지 않아요.');
  const targets=signalTargets(t),matches=a.inputs.filter((s,i)=>s.key===targets[i]?.key).length,accuracy=matches/Math.max(targets.length,a.inputs.length,1);
  const errors=a.inputs.slice(1).map((s,i)=>Math.abs(s.at-a.inputs[i].at-t.beat));const rhythmError=errors.length?errors.reduce((x,y)=>x+y,0)/errors.length:0;
  quality=accuracy;metrics={mode:a.mode,sequenceAccuracy:accuracy,omissions:Math.max(0,targets.length-a.inputs.length),extra:Math.max(0,a.inputs.length-targets.length),rhythmError:a.mode==='rhythm'?Math.round(rhythmError):null};explanation=`순서 정확도 ${Math.round(accuracy*100)}%${a.mode==='rhythm'?` · 박자 간격 오차 ${Math.round(rhythmError)}ms (별도 관찰)`:''}`;
 }else{
  if(!a||!Array.isArray(a.served)||a.served.length>t.orders.length||new Set(a.served.map(o=>o.id)).size!==a.served.length||a.served.some(o=>!Number.isInteger(o.id)||!t.orders[o.id]||!Array.isArray(o.items)||o.items.length!==4||o.items.some(n=>!Number.isInteger(n)||n<0||n>20)||!Number.isFinite(o.at)||o.at<0||o.at>elapsed+2000))throw Error('주문 수량을 확인해주세요.');
  if(t.stock.some((n,j)=>a.served.reduce((s,o)=>s+o.items[j],0)>n))throw Error('보유 재고를 초과했어요.');
  const exact=a.served.filter(o=>o.items.every((n,j)=>n===t.orders[o.id].items[j])).length,priority=t.level<2||a.served.every((o,i)=>o.id===t.priorityOrder[i]),deadlines=a.served.filter(o=>o.at<=t.orders[o.id].deadline*1000).length;
  quality=exact/t.orders.length*(priority?1:.7)*(t.level===2?deadlines/t.orders.length:1);metrics={exact,priority,deadlines,total:t.orders.length};explanation=`정확한 주문 ${exact}/${t.orders.length} · ${priority?'우선순위 충족':'마감이 빠른 주문부터 처리해 보세요'} · 기한 내 ${deadlines}건`;
 }
 return {quality,behavior:quality,score:Math.round(quality*1000),elapsed,probes:0,explanation,metrics,problemId:t.id,difficulty:t.difficulty};
}
