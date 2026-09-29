// Explicit live test: creates two temporary guest identities, then leaves their room.
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
const url=process.env.BASE_URL||'https://mindraft.yoosung.dev';
const clients=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(100);}throw Error('Public state synchronization timed out');}
async function client(name){
  const response=await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({name})});assert.equal(response.status,200);
  const {token,profile}=await response.json();const socket=io(url,{transports:['websocket'],auth:{token},extraHeaders:{Origin:url},reconnection:false});
  const c={socket,profile};clients.push(c);for(const event of['lobby','room','match','invite'])socket.on(event,data=>c[event]=data);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  c.send=(event,data={})=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));await until(()=>c.lobby);return c;
}
try{
  const health=await(await fetch(url+'/api/health')).json();assert.equal(health.ok,true);
  const a=await client('연결 확인 A'),b=await client('연결 확인 B');
  await until(()=>a.lobby.users.some(p=>p.id===b.profile.id));
  const created=await a.send('room:create',{name:'외부 통신 검증',game:'crisis',mode:'coop'});assert.equal(created.ok,true);
  assert.equal((await a.send('room:invite',{id:b.profile.id})).ok,true);await until(()=>b.invite);
  assert.equal((await b.send('room:join',{id:b.invite.roomId})).ok,true);
  await b.send('room:ready');assert.equal((await a.send('match:start')).ok,true);await until(()=>a.match&&b.match);
  assert.deepEqual(a.match.task,b.match.task);await wait(Math.max(0,a.match.startAt-Date.now())+100);
  const urgency=a.match.task.incidents.map(v=>v.severity/v.minutes),answer=urgency.indexOf(Math.max(...urgency));
  assert.equal((await a.send('match:answer',{matchId:a.match.id,index:0,answer})).ok,true);
  await until(()=>b.match.players.find(p=>p.id===a.profile.id).score>0);
  await a.send('room:leave');await b.send('room:leave');
  console.log('PASS HTTPS, authenticated WSS, presence, invite, join, readiness, shared start, server score, peer synchronization, cleanup');
}finally{for(const c of clients){if(c.socket.connected&&c.send)await c.send('room:leave').catch(()=>{});c.socket.disconnect();}}
