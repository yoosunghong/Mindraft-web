// Explicit deployment verification. Uses only newly created QA profiles and removes them afterward.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { io } from 'socket.io-client';
import { solveCircuit } from '../lib/arcade.js';
import { signalTargets } from '../public/puzzles.js';
import { solveCargo } from '../test/solutions.js';

const base=process.env.BASE_URL;
if(!base)throw Error('Set BASE_URL explicitly to the deployment to verify.');
const clients=[],results=[],assets=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let n=0;n<150;n++){if(fn())return;await pause(100);}throw Error('Timed out waiting for synchronized state');}
async function fetchOK(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,`${url}: HTTP ${r.status}`);return r;}
async function client(label){
 const session=await (await fetchOK(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:label,consent:true})})).json();
 const socket=io(base,{auth:{token:session.token},transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:{Origin:base}});
 const c={socket,id:session.profile.id};clients.push(c);
 for(const event of ['room','match','invite','profile:update','lobby'])socket.on(event,value=>c[event]=value);
 c.send=(event,data={})=>new Promise((resolve,reject)=>socket.timeout(15000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});await until(()=>c.lobby);return c;
}
function answer(t){
 if(t.kind==='robot')return solveCircuit(t).solution;
 if(t.kind==='cargo')return solveCargo(t);
 if(t.kind==='signal')return {mode:'memory',inputs:signalTargets(t).map(v=>({key:v.key,at:0}))};
 return {served:t.orders.toSorted((a,b)=>a.priority-b.priority).map(o=>({id:o.id,items:o.items,at:0}))};
}
try{
 assert.equal((await (await fetchOK(base+'/api/health')).json()).ok,true);
 const catalog=await (await fetchOK(base+'/api/catalog')).json();
 assert.deepEqual(catalog.games.map(g=>g.id),['robot','cargo','signal','cafe']);
 const paths=['index.html','app.js','arcade.js','puzzles.js','tallo.css','firebase-auth.js','favicon.svg','art/tallo/hero.png','art/tallo/worlds.png','art/tallo/products.png'];
 for(const path of paths){const route=path==='index.html'?'/':'/'+path;const remote=Buffer.from(await (await fetchOK(base+route)).arrayBuffer()),local=readFileSync(new URL('../public/'+path,import.meta.url));const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(remote),hash(local),`Deployment asset differs: ${path}`);assets.push(path);}
 console.log('PASS public homepage and 10 deployed assets match local source');
 const a=await client('Tallo 배포검증 A'),b=await client('Tallo 배포검증 B');
 for(const game of catalog.games)for(const mode of ['versus','coop']){
  const created=await a.send('room:create',{game:game.id,mode,name:'배포 자동검증 · '+game.id});assert.equal(created.ok,true);
  if(!results.length){assert.equal((await a.send('room:invite',{id:b.id})).ok,true);await until(()=>b.invite?.roomId===created.roomId);}
  assert.equal((await b.send('room:join',{id:created.roomId})).ok,true);await until(()=>a.room?.members.length===2);
  assert.equal((await b.send('room:ready')).ok,true);assert.equal((await a.send('match:start')).ok,true);
  await until(()=>a.match?.game===game.id&&b.match?.id===a.match.id&&a.match.mode===mode);
  const matchId=a.match.id;assert.equal(a.match.startAt,b.match.startAt);assert.deepEqual(a.match.task,b.match.task);
  await pause(Math.max(0,a.match.startAt-a.match.serverNow)+150);
  for(let index=0;index<3;index++){
   await until(()=>a.match.index===index&&b.match.index===index);
   assert.deepEqual(a.match.task,b.match.task);
   for(const c of [a,b]){
    assert.equal((await c.send('match:event',{matchId,index,type:'select',value:index})).ok,true);
    const r=await c.send('match:answer',{matchId,index,answer:answer(c.match.task)});assert.equal(r.ok,true,JSON.stringify(r));
   }
  }
  await until(()=>a.match.results&&b.match.results);
  assert.deepEqual(a.match.results,b.match.results);assert.equal(a.match.results.length,2);
  for(const c of [a,b]){const r=c.match.results.find(r=>r.id===c.id);assert.equal(r.accuracy,100);assert.equal(r.score,3000);await until(()=>c['profile:update']?.profile.log.some(v=>v.id===matchId));const record=c['profile:update'].profile.log.find(v=>v.id===matchId);assert.equal(record.rounds.length,3);assert.ok(record.rounds.every(v=>v.events.length===1));}
  results.push({game:game.id,mode,players:2,rounds:3,accuracy:100,scorePerPlayer:3000});
  console.log(`PASS ${game.id} ${mode}: shared start, 3 rounds, peer scores, results and persisted event logs`);
  assert.equal((await a.send('room:leave')).ok,true);assert.equal((await b.send('room:leave')).ok,true);
  await until(()=>a.room===null&&b.room===null);a.match=null;b.match=null;
 }
}finally{
 for(const c of clients){if(c.socket.connected){const r=await c.send('profile:delete');assert.equal(r.ok,true,'QA profile cleanup');}c.socket.disconnect();}
}
mkdirSync(new URL('../.runtime/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.runtime/production-verification.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),base,assets,results,qaProfilesRemoved:true},null,2));
console.log(`PASS ${results.length} live multiplayer matches; QA profiles removed`);
