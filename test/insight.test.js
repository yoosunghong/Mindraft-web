process.env.AI_PROVIDER='rules';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { createApp } from '../server.js';
import { analyze, exploreJobs, aiInput, ruleReport, playRecord } from '../lib/insight.js';
import { solveCircuit } from '../lib/arcade.js';
import { checkBug, submitWritten } from '../lib/quests.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await sleep(10);}throw Error('Timed out waiting for state');}
async function fixture(t){
  const server=createApp({dataDir:mkdtempSync(path.join(tmpdir(),'mindraft-insight-')),countdown:0,duration:5000,exploreDuration:5000,disconnectGrace:60});
  await new Promise(r=>server.http.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.http.address().port}`,clients=[];
  t.after(async()=>{clients.forEach(c=>c.socket.disconnect());await server.close();});
  async function client(name){
    const data=await(await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,consent:true})})).json();
    const socket=io(url,{auth:{token:data.token},transports:['websocket'],forceNew:true});
    const c={socket,...data};clients.push(c);for(const event of ['lobby','room','match','profile:update'])socket.on(event,v=>c[event]=v);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});await until(()=>c.lobby);
    c.send=(event,d={})=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,d,(err,r)=>err?reject(err):resolve(r)));
    c.me=()=>c['profile:update']?.profile;
    return c;
  }
  return {url,client,server};
}
const correct=t=>solveCircuit(t).solution;

test('기록 활용 동의 없이는 프로필을 만들 수 없다',async t=>{const {url}=await fixture(t);const r=await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A'})});assert.equal(r.status,400);});

test('혼자 탐색: 재도전 힌트는 정답을 숨기고, 다시 해결한 과정이 TRY 근거와 리포트로 남는다',async t=>{
  const {client}=await fixture(t),a=await client('A'),b=await client('B');
  const {roomId}=await a.send('room:create',{game:'robot',mode:'explore'});
  assert.equal((await b.send('room:join',{id:roomId})).ok,false);
  assert.equal((await a.send('match:start')).ok,true);await until(()=>a.match?.task);
  for(let i=0;i<3;i++){
    await until(()=>a.match.index===i&&a.match.task);const task=a.match.task,right=correct(task),wrong=task.tiles.map(()=>1);
    if(i<2){const r=await a.send('match:answer',{matchId:a.match.id,index:i,answer:wrong,changes:1});assert.equal(r.retry,true);assert.ok(r.hint.length>0);await until(()=>a.match.pending?.attempt===1);assert.equal(a.match.index,i);}
    if(i===2){assert.equal((await a.send('match:skip',{matchId:a.match.id,index:i})).ok,true);continue;}
    assert.equal((await a.send('match:answer',{matchId:a.match.id,index:i,answer:right})).ok,true);
  }
  await until(()=>a.match.results);const mine=a.match.results[0];assert.equal(mine.retries,2);
  await until(()=>a.me()?.log?.length===1);const rec=a.me().log[0];assert.equal(rec.recovered,2);assert.equal(rec.skipped,1);assert.equal(rec.changes,2);assert.equal(rec.mode,'explore');
  assert.ok(a.me().insight.summary.TRY.includes('robot'));
  assert.equal((await a.send('match:reflect',{matchId:a.match.id,again:6,burden:1})).ok,false);
  assert.equal((await a.send('match:reflect',{matchId:a.match.id,again:5,burden:2})).ok,true);
  assert.equal((await a.send('match:reflect',{matchId:a.match.id,again:5,burden:2})).ok,false);
  await until(()=>a.me().log[0].again===5);assert.ok(a.me().insight.summary.LIKE.includes('robot'));
  const report=await a.send('report:generate');assert.equal(report.ok,true);assert.equal(report.report.source,'rules');assert.match(report.report.text,/TRY/);
  assert.ok(a.me().jobs.some(j=>j.id==='developer'));
  assert.equal((await b.send('report:generate')).ok,false);
});

test('중간에 나가면 중단 기록이 남고 AVOID 근거가 된다',async t=>{const {client}=await fixture(t),a=await client('A');await a.send('room:create',{game:'cafe',mode:'explore'});await a.send('match:start');await until(()=>a.match?.task);await a.send('room:leave');await until(()=>a.me()?.log?.length===1);assert.equal(a.me().log[0].abandoned,true);assert.ok(a.me().insight.summary.AVOID.includes('cafe'));});

test('개발자 REAL QUEST: Lv.1 서술 검증 → Lv.2 원인·수정 검증 → 근거 보관함 기록',async t=>{
  const {client}=await fixture(t),a=await client('A');
  assert.equal((await a.send('quest:check',{step:'cause',value:1})).ok,false);
  assert.equal((await a.send('quest:submit',{id:'dev-1',values:{site:'쇼핑몰',symptom:'짧음',steps:'x',idea:'y'}})).ok,false);
  assert.equal((await a.send('quest:submit',{id:'dev-1',values:{site:'쇼핑몰 앱',symptom:'장바구니 수량을 바꾸면 합계가 그대로예요',steps:'상품 담기 → 수량 2로 변경 → 합계 확인',idea:'수량 변경 시 합계를 다시 계산해요'}})).ok,true);
  assert.equal((await a.send('quest:check',{step:'fix',value:"const button=document.querySelector('#save-btn');"})).ok,false);
  assert.equal((await a.send('quest:check',{step:'cause',value:0})).correct,false);
  const cause=await a.send('quest:check',{step:'cause',value:1});assert.equal(cause.correct,true);
  const fix=await a.send('quest:check',{step:'fix',value:'const button = document.getElementById("save-btn");'});assert.equal(fix.correct,true);
  await until(()=>a.me()?.quests['dev-2']?.done);assert.equal(a.me().insight.quests,2);assert.ok(a.me().insight.evidence.some(e=>e.type==='QUEST'&&e.text.includes('Lv.2')));
  const plan=await a.send('quest:plan',{job:'qa'});assert.equal(plan.ok,true);assert.equal(plan.plan.source,'rules');
  assert.equal((await a.send('quest:submit',{id:'explore-qa',values:{similar:'문제를 재현 단계로 기록하는 일',questions:'하루에 몇 건을 테스트하나요? 자동화는 어디까지?'}})).ok,true);
});

test('기록 삭제 후에는 같은 토큰으로 접속할 수 없다',async t=>{const {client,url}=await fixture(t),a=await client('A');assert.equal((await a.send('profile:delete')).ok,true);const r=await(await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:a.token})})).json();assert.notEqual(r.token,a.token);});

test('잘하는 것과 좋아하는 것의 차이를 찾아내고, 적합도 대신 행동 근거로 직업을 제시한다',()=>{
  const ans=(q,extra={})=>Array.from({length:3},()=>({quality:q,elapsed:5000,probes:0,...extra}));
  const bridge={...playRecord({matchId:'1',game:'cargo',mode:'explore',answers:ans(1)}),again:1,burden:4};
  const workshop={...playRecord({matchId:'2',game:'robot',mode:'explore',answers:ans(1,{attempts:2,firstQuality:0,probes:2})}),again:5,burden:2};
  const p={log:[bridge,workshop]},ins=analyze(p);
  assert.ok(ins.summary.CAN.includes('cargo')&&ins.summary.AVOID.includes('cargo')&&!ins.summary.LIKE.includes('cargo'));
  assert.ok(ins.summary.TRY.includes('robot')&&ins.summary.LIKE.includes('robot'));
  assert.ok(ins.gaps.includes('cargo'));
  const jobs=exploreJobs(ins);assert.equal(jobs[0].id,'developer');assert.ok(jobs.every(j=>!('score' in j)));
  const input=JSON.stringify(aiInput({name:'실명홍길동',...p},ins));assert.equal(input.includes('실명홍길동'),false);
  assert.match(ruleReport(ins),/진단이나 적성 판정이 아니라/);
  assert.equal(checkBug('fix',"let button = document.querySelector('#save-btn')").ok,true);
  assert.throws(()=>submitWritten('dev-1',{site:'a'}));
});
