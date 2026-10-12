import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { createApp } from '../server.js';
import { solveCircuit } from '../lib/arcade.js';
import { solveCargo } from './solutions.js';
import { signalTargets } from '../public/puzzles.js';
import { GAMES, makeTasks, publicTask, evaluate, reward } from '../lib/games.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep(10);}throw Error('Timed out waiting for state');}
async function fixture(t,options={}) {
  const server=createApp({dataDir:mkdtempSync(path.join(tmpdir(),'mindraft-test-')),countdown:0,duration:5000,disconnectGrace:60,...options});
  await new Promise(r=>server.http.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.http.address().port}`,clients=[];
  t.after(async()=>{clients.forEach(c=>c.socket.disconnect());await server.close();});
  async function client(name,token){
    const response=await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,token,consent:true})});assert.equal(response.status,200);const data=await response.json();
    const socket=io(url,{auth:{token:data.token},transports:['websocket'],forceNew:true});
    const c={socket,...data};clients.push(c);for(const event of ['lobby','room','match','invite','profile:update'])socket.on(event,v=>c[event]=v);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});await until(()=>c.lobby);
    c.send=(event,d={})=>new Promise((resolve,reject)=>socket.timeout(1500).emit(event,d,(err,r)=>err?reject(err):resolve(r)));
    return c;
  }
  return {server,url,client};
}
async function create(c,game='robot',mode='versus'){const r=await c.send('room:create',{name:'테스트 탐험방',game,mode});assert.equal(r.ok,true);return r.roomId;}
async function join(c,id){assert.equal((await c.send('room:join',{id})).ok,true);}
function answerFor(t){if(t.kind==='robot')return solveCircuit(t).solution;if(t.kind==='cargo')return cargoSolution(t);if(t.kind==='signal')return {mode:'memory',inputs:signalTargets(t).map(s=>({key:s.key,at:0}))};return {served:[...t.orders].sort((a,b)=>a.priority-b.priority).map(o=>({id:o.id,items:o.items,at:0}))};}
function cargoSolution(t){return t.solution||solveCargo(t);}

test('모든 접속자가 목록에 보이고 방 초대와 수락이 동기화된다',async t=>{const {client}=await fixture(t),a=await client('호스트'),b=await client('친구');await until(()=>a.lobby.users.length===2);const id=await create(a);assert.equal((await a.send('room:invite',{id:b.profile.id})).ok,true);await until(()=>b.invite);assert.equal(b.invite.roomId,id);await join(b,id);await until(()=>a.room.members.length===2);assert.equal(a.lobby.users.find(p=>p.id===b.profile.id).roomId,id);});
test('호스트 권한, 준비 상태, 방 정원을 서버에서 검증한다',async t=>{const {client}=await fixture(t);const a=await client('A'),b=await client('B'),c=await client('C'),d=await client('D'),e=await client('E');const id=await create(a);await join(b,id);await join(c,id);await join(d,id);assert.equal((await e.send('room:join',{id})).ok,false);assert.equal((await b.send('match:start')).ok,false);assert.equal((await b.send('room:configure',{game:'cafe'})).ok,false);assert.equal((await a.send('match:start')).ok,false);for(const p of[b,c,d])await p.send('room:ready');assert.equal((await a.send('match:start')).ok,true);assert.equal((await a.send('room:configure',{game:'cafe'})).ok,false);});
test('호스트 퇴장 시 남은 플레이어에게 권한이 넘어간다',async t=>{const {client}=await fixture(t),a=await client('A'),b=await client('B');const id=await create(a);await join(b,id);await a.send('room:leave');await until(()=>b.room.host===b.profile.id);assert.equal((await b.send('room:configure',{game:'cargo'})).ok,true);await b.send('room:leave');await until(()=>b.lobby.rooms.length===0);});
test('같은 세션의 여러 탭은 한 명으로 표시되며 재접속 시 방을 복구한다',async t=>{const {client}=await fixture(t,{disconnectGrace:1000}),a=await client('A');const id=await create(a);const second=await client('ignored',a.token);assert.equal(second.profile.id,a.profile.id);assert.equal(second.lobby.users.length,1);await until(()=>second.room?.id===id);a.socket.disconnect();assert.equal(second.socket.connected,true);second.socket.disconnect();const third=await client('ignored',a.token);await until(()=>third.room?.id===id);assert.equal(third.room.members.length,1);});
test('연결 복구 시간 후 유령 접속자가 제거되고 호스트가 이양된다',async t=>{const {client}=await fixture(t),a=await client('A'),b=await client('B');const id=await create(a);await join(b,id);a.socket.disconnect();await until(()=>b.room.members.length===1);assert.equal(b.room.host,b.profile.id);assert.equal(b.lobby.users.length,1);});
test('잘못된 인증 토큰은 소켓 접속이 거부된다',async t=>{const {url}=await fixture(t);const s=io(url,{auth:{token:'not-a-token'},reconnection:false});const err=await new Promise(r=>s.on('connect_error',r));assert.match(err.message,/입장/);s.disconnect();});
test('카운트다운 이전 제출과 중복 제출 및 점수 위조를 거부한다',async t=>{const {client}=await fixture(t,{countdown:80}),a=await client('A');await create(a);await a.send('match:start');await until(()=>a.match);const d={matchId:a.match.id,index:0,answer:answerFor(a.match.task),score:999999};assert.equal((await a.send('match:answer',d)).ok,false);await sleep(90);assert.equal((await a.send('match:answer',d)).ok,true);assert.equal((await a.send('match:answer',d)).ok,false);await until(()=>a.match.index===1);assert.ok(a.match.players[0].score<=1000);assert.equal('correct' in a.match.task,false);assert.equal('a' in a.match.task,false);assert.equal((await a.send('match:answer',{...d,index:1,answer:999})).ok,false);});
for(const g of GAMES)for(const mode of ['versus','coop'])test(`${g.title} (${mode}): 2인 완주 → 결과·능력치·재경기·프로필 복원`,async t=>{const {client}=await fixture(t),a=await client('A'),b=await client('B');const id=await create(a,g.id,mode);await join(b,id);await b.send('room:ready');await a.send('match:start');await until(()=>a.match&&b.match);assert.deepEqual(a.match.task,b.match.task);for(let i=0;i<3;i++){for(const p of[a,b]){await until(()=>p.match.index===i);const d={matchId:p.match.id,index:i,answer:answerFor(p.match.task)};assert.equal((await p.send('match:answer',d)).ok,true);}}
await until(()=>a.match.results);assert.equal(a.match.results.length,2);const result=a.match.results.find(r=>r.id===a.profile.id);assert.equal(result.accuracy,100);assert.ok(result.xp.some(x=>x>0));assert.ok(result.medals.length>0);assert.ok(a.match.results.every(r=>r.score<=3000));assert.equal(a.match.results.reduce((s,r)=>s+r.contribution,0),100);const restored=await client('ignored',a.token);assert.equal(restored.profile.sessions,1);assert.deepEqual(restored.profile.xp,result.xp);await a.send('room:reset');await until(()=>b.room.status==='waiting');assert.equal(b.room.members.find(p=>p.id===b.profile.id).ready,false);});
test('서버 제한 시간이 끝나면 미응답 플레이어도 종료하고 근거 없는 XP는 주지 않는다',async t=>{const {client}=await fixture(t,{duration:90}),a=await client('A');await create(a);await a.send('match:start');await until(()=>a.match?.results);assert.equal(a.match.results[0].score,0);assert.deepEqual(a.match.results[0].xp,[0,0,0,0,0,0]);assert.equal((await a.send('match:answer',{matchId:a.match.id,index:0,answer:0})).ok,false);});
test('반복 플레이 보상은 감소하고 서버 해법은 공개되지 않는다',()=>{const p={xp:[0,0,0,0,0,0],plays:{},evidence:{},medals:[0,0,0,0,0,0],sessions:0},tasks=makeTasks('robot');const answers=tasks.map(t=>evaluate(t,t.solution,1000));const first=reward(p,'robot',answers),second=reward(p,'robot',answers);assert.ok(second.xp[0]<first.xp[0]);assert.equal(publicTask(tasks[0]).solution,undefined);});

test('조작 로그와 실패 후 수정 이력이 문제 ID·난이도·시간과 함께 보존된다',async t=>{
 const {client}=await fixture(t),a=await client('기록 검증');await create(a,'robot','explore');await a.send('match:start');await until(()=>a.match?.task);
 const d={matchId:a.match.id,index:0};assert.equal((await a.send('match:event',{...d,type:'rotate',value:4})).ok,true);
 assert.equal((await a.send('match:answer',{...d,answer:Array(8).fill(1),changes:1})).retry,true);
 assert.equal((await a.send('match:event',{...d,type:'rotate',value:5})).ok,true);
 assert.equal((await a.send('match:answer',{...d,answer:answerFor(a.match.task),changes:1})).ok,true);
 for(let i=1;i<3;i++){await until(()=>a.match.index===i);await a.send('match:skip',{matchId:a.match.id,index:i});}
 await until(()=>a.match.results);const restored=await client('unused',a.token),rec=restored.profile.log[0],round=rec.rounds[0];
 assert.equal(round.difficulty,'하');assert.ok(round.problemId.startsWith('robot-1-'));assert.equal(round.events[0].type,'rotate');assert.equal(round.attemptHistory[0].events[0].value,4);assert.ok(round.at>0);assert.equal(rec.total,3);
});
