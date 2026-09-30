import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, STATS, MEDALS, makeTasks, publicTask, evaluate, reward, hintFor } from './lib/games.js';
import { BEHAVIORS, JOBS, playRecord, analyze, exploreJobs, aiInput, ruleReport } from './lib/insight.js';
import { QUESTS, DEV_BUG, questDef, exploreQuest, submitWritten, checkBug } from './lib/quests.js';
import { aiReport, aiQuest, aiEnabled } from './lib/ai.js';
import { createCloudStore } from './lib/cloud.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const hash=t=>createHash('sha256').update(t).digest('hex');
const clean=(s,max=20)=>typeof s==='string'?s.trim().replace(/[\x00-\x1f<>]/g,'').slice(0,max):'';
const scale=v=>Number.isInteger(v)&&v>=1&&v<=5?v:null;
const LOG_LIMIT=300;
export function createApp({dataDir=process.env.DATA_DIR||path.join(root,'data'),duration=90000,exploreDuration=600000,countdown=3000,disconnectGrace=20000,origins=process.env.ALLOWED_ORIGINS}={}) {
  const cloud=process.env.DATA_BACKEND==='firestore'?createCloudStore(process.env.GOOGLE_CLOUD_PROJECT):null;
  if(!cloud)mkdirSync(dataDir,{recursive:true});
  const file=path.join(dataDir,'profiles.json');
  const profiles=new Map(!cloud&&existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[]);
  const initializeProfile=p=>{p.log||=[];p.quests||={};p.questPlans||={};p.report||=null;return p;};
  const mergeGuest=(target,guest)=>{
    for(let i=0;i<6;i++){target.xp[i]+=(guest.xp[i]||0);target.medals[i]+=(guest.medals[i]||0);}
    target.sessions+=guest.sessions||0;target.wins+=guest.wins||0;
    for(const [game,count] of Object.entries(guest.plays||{}))target.plays[game]=(target.plays[game]||0)+count;
    for(const [game,entry] of Object.entries(guest.evidence||{})){
      const old=target.evidence[game]||{mean:0,count:0},count=old.count+entry.count;
      target.evidence[game]={mean:count?(old.mean*old.count+entry.mean*entry.count)/count:0,count};
    }
    target.log=[...target.log,...guest.log].sort((a,b)=>a.at-b.at).slice(-LOG_LIMIT);
    target.quests={...guest.quests,...target.quests};target.questPlans={...guest.questPlans,...target.questPlans};
    if(guest.log.length)target.report=null;
  };
  for(const p of profiles.values())initializeProfile(p);
  const ready=cloud?cloud.loadProfiles().then(loaded=>{for(const [key,profile] of loaded)profiles.set(key,initializeProfile(profile));}):Promise.resolve();
  const online=new Map(),rooms=new Map(),invites=new Map(),ipLimits=new Map(),disconnectTimers=new Map(),aiLimits=new Map();
  const app=express(), http=createServer(app);
  const allowed=new Set(['http://localhost:3210','http://127.0.0.1:3210','https://mindraft.yoosung.dev',...(origins?origins.split(',').map(s=>s.trim()).filter(Boolean):[])]);
  const originAllowed=req=>!req.headers.origin||allowed.has(req.headers.origin)||req.headers.origin===`https://${req.headers.host}`||req.headers.origin===`http://${req.headers.host}`;
  const io=new Server(http,{maxHttpBufferSize:16384,allowRequest:(req,cb)=>cb(null,originAllowed(req))});
  let pendingPersist=Promise.resolve();
  const persist=()=>{
    if(cloud){pendingPersist=cloud.saveProfiles(profiles);pendingPersist.catch(error=>console.error('[firestore] profile write failed',error));return pendingPersist;}
    writeFileSync(file+'.tmp',JSON.stringify([...profiles]));renameSync(file+'.tmp',file);return Promise.resolve();
  };
  const pub=p=>({id:p.id,name:p.name,avatar:p.avatar,xp:p.xp,medals:p.medals,sessions:p.sessions,wins:p.wins});
  // 본인에게만 보내는 상세 기록(다른 사용자에게는 pub만 공개)
  const self=p=>{const insight=analyze(p);return {...pub(p),evidence:p.evidence,insight,jobs:exploreJobs(insight),quests:p.quests,questPlans:p.questPlans,report:p.report,log:p.log.filter(r=>r.type==='play').slice(-30).reverse(),account:!!p.uid,aiRemaining:p.uid?Math.max(0,10-(p.aiUsed||0)):null};};
  const getProfile=id=>[...profiles.values()].find(p=>p.id===id);
  const tokenOf=id=>[...profiles.entries()].find(([,p])=>p.id===id)?.[0];
  const addLog=(p,record)=>{p.log.push(record);if(p.log.length>LOG_LIMIT)p.log.splice(0,p.log.length-LOG_LIMIT);};
  const playerRoom=id=>[...rooms.values()].find(r=>r.members.includes(id));
  const brief=r=>({id:r.id,name:r.name,game:r.game,mode:r.mode,host:r.host,members:r.members.map(id=>({...pub(getProfile(id)),online:online.has(id),ready:r.ready.has(id)})),status:r.status,capacity:r.mode==='explore'?1:4});
  const lobby=()=>({users:[...online.keys()].map(id=>({...pub(getProfile(id)),roomId:playerRoom(id)?.id||null})),rooms:[...rooms.values()].filter(r=>r.mode!=='explore').map(brief),leaderboard:[...profiles.values()].filter(p=>p.sessions>0).sort((a,b)=>b.medals.reduce((s,n)=>s+n,0)-a.medals.reduce((s,n)=>s+n,0)).slice(0,30).map(pub)});
  function broadcast(){io.emit('lobby',lobby());for(const r of rooms.values())io.to(r.id).emit('room',brief(r));}
  function emitSelf(id){const p=getProfile(id),e=online.get(id);if(p&&e)for(const sid of e.sockets)io.to(sid).emit('profile:update',{id,profile:self(p)});}
  function matchView(r,id){
    const m=r.match,p=m.players[id];
    return {id:m.id,game:r.game,mode:r.mode,startAt:m.startAt,endAt:m.endAt,serverNow:Date.now(),index:p?.answers.length||0,total:5,task:p&&!p.done?publicTask(m.tasks[p.answers.length]):null,probes:p?.probes||[],attempt:p?.attempts.length||0,pending:p?.attempts.length?{attempt:p.attempts.length,hint:p.attempts.at(-1).hint}:null,feedback:p?.answers.at(-1)||null,target:r.members.length*2500,players:Object.entries(m.players).map(([pid,v])=>({id:pid,name:getProfile(pid)?.name,avatar:getProfile(pid)?.avatar,score:v.score,answered:v.answers.length,done:v.done,online:online.has(pid)})),results:m.results||null};
  }
  function emitMatch(r){for(const id of r.members){const entry=online.get(id);if(entry)for(const sid of entry.sockets)io.to(sid).emit('match',matchView(r,id));}}
  function finish(r){
    if(r.status!=='playing')return;
    clearTimeout(r.timer);r.status='results';
    const m=r.match,ranking=Object.entries(m.players).sort((a,b)=>b[1].score-a[1].score),top=ranking[0]?.[1].score||0,total=ranking.reduce((s,[,p])=>s+p.score,0),size=ranking.length;
    m.results=ranking.map(([id,p])=>{const profile=getProfile(id);if(!profile)return null;const awards=reward(profile,r.game,p.answers);const winner=top>0&&p.score===top;if(winner&&size>1)profile.wins++;if(!p.abandoned)addLog(profile,playRecord({matchId:m.id,game:r.game,mode:r.mode,answers:p.answers,teammates:size-1}));return {id,name:profile.name,avatar:profile.avatar,rank:ranking.filter(([,v])=>v.score>p.score).length+1,score:p.score,accuracy:p.answers.length?Math.round(p.answers.reduce((s,a)=>s+a.quality,0)/5*100):0,retries:p.answers.reduce((s,a)=>s+Math.max(0,(a.attempts||1)-1),0),contribution:total?Math.round(p.score/total*100):0,winner,...awards};}).filter(Boolean);
    persist();emitMatch(r);broadcast();for(const id of r.members)emitSelf(id);
  }
  function leave(id){
    const r=playerRoom(id);if(!r)return;
    for(const sid of online.get(id)?.sockets||[])io.sockets.sockets.get(sid)?.leave(r.id);
    r.members=r.members.filter(v=>v!==id);r.ready.delete(id);
    if(r.status==='playing'){const v=r.match.players[id],p=getProfile(id);if(v&&!v.done&&p){v.abandoned=true;addLog(p,playRecord({matchId:r.match.id,game:r.game,mode:r.mode,answers:v.answers,abandoned:true,teammates:Object.keys(r.match.players).length-1}));persist();emitSelf(id);}if(v)v.done=true;}
    if(!r.members.length){clearTimeout(r.timer);rooms.delete(r.id);}else{
      if(r.host===id){r.host=r.members[0];r.ready.add(r.host);}
      if(r.status==='playing'){if(r.members.every(pid=>r.match.players[pid].done))finish(r);else emitMatch(r);}
    }
    broadcast();
  }
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com; frame-src https://accounts.google.com https://apis.google.com https://*.firebaseapp.com https://content.googleapis.com; frame-ancestors 'none'; base-uri 'none'"});next();});
  app.use(express.json({limit:'4kb'}));
  app.get('/api/health',async(_,res)=>res.json({ok:true,online:online.size,rooms:rooms.size,ai:await aiEnabled()}));
  app.get('/api/firebase-config',(_,res)=>res.json(process.env.FIREBASE_API_KEY&&process.env.FIREBASE_APP_ID&&process.env.GOOGLE_CLOUD_PROJECT?{
    apiKey:process.env.FIREBASE_API_KEY,
    authDomain:process.env.FIREBASE_AUTH_DOMAIN||`${process.env.GOOGLE_CLOUD_PROJECT}.firebaseapp.com`,
    projectId:process.env.GOOGLE_CLOUD_PROJECT,
    appId:process.env.FIREBASE_APP_ID
  }:{enabled:false}));
  app.get('/api/catalog',(_,res)=>{const {cause,...bug}=DEV_BUG;res.json({games:GAMES,stats:STATS,medals:MEDALS,behaviors:BEHAVIORS,jobs:JOBS,quests:QUESTS,bug});});
  app.post('/api/session',async(req,res)=>{
    try{
    if(!originAllowed(req))return res.status(403).json({error:'허용되지 않은 출처입니다.'});
    const {token,name,avatar,consent}=req.body||{};
    if(typeof token==='string'&&token.length<=128&&profiles.has(hash(token)))return res.json({token,profile:self(profiles.get(hash(token)))});
    const ip=req.socket.remoteAddress,now=Date.now(),limit=ipLimits.get(ip)||{count:0,at:now};
    if(now-limit.at>60000){limit.count=0;limit.at=now;}ipLimits.set(ip,limit);
    if(++limit.count>30)return res.status(429).json({error:'잠시 후 다시 입장해주세요.'});
    const n=clean(name,16);if(!n)return res.status(400).json({error:'닉네임을 입력해주세요.'});
    if(consent!==true)return res.status(400).json({error:'플레이 기록 활용 안내에 동의해야 시작할 수 있어요.'});
    const t=randomBytes(32).toString('hex'),p={id:randomUUID(),name:n,avatar:Number.isInteger(avatar)?Math.max(0,Math.min(5,avatar)):0,xp:[0,0,0,0,0,0],medals:[0,0,0,0,0,0],plays:{},evidence:{},sessions:0,wins:0,log:[],quests:{},questPlans:{},report:null,consentAt:now};
    profiles.set(hash(t),p);await persist();res.json({token:t,profile:self(p)});
    }catch(e){console.error('[session]',e);res.status(500).json({error:'프로필을 저장할 수 없어요. 잠시 후 다시 시도해주세요.'});}
  });
  app.post('/api/account/session',async(req,res)=>{
    if(!originAllowed(req))return res.status(403).json({error:'허용되지 않은 출처입니다.'});
    if(!cloud)return res.status(503).json({error:'Google 로그인이 아직 설정되지 않았어요.'});
    try{
      const idToken=req.body?.idToken;
      if(typeof idToken!=='string'||idToken.length>8192)return res.status(400).json({error:'로그인 정보가 올바르지 않아요.'});
      const user=await cloud.verifyIdToken(idToken);
      if(user.firebase?.sign_in_provider!=='google.com')return res.status(403).json({error:'Google 계정으로 로그인해주세요.'});
      const key=`user:${user.uid}`;
      let p=profiles.get(key);
      const guestToken=req.body?.guestToken;
      const guestKey=typeof guestToken==='string'&&guestToken.length<=128?hash(guestToken):null;
      const guest=guestKey?profiles.get(guestKey):null;
      if(!p&&!guest)return res.status(409).json({error:'먼저 닉네임으로 입장한 뒤 Google 계정을 연결해주세요.'});
      if(guest){
        if(p){
          leave(guest.id);
          for(const sid of online.get(guest.id)?.sockets||[])io.sockets.sockets.get(sid)?.disconnect(true);
          online.delete(guest.id);
          mergeGuest(p,guest);
        }else{p=guest;p.uid=user.uid;profiles.set(key,p);}
        profiles.delete(guestKey);
        await persist();
      }
      p.aiUsed=await cloud.aiUsed(user.uid);
      res.json({profile:self(p)});
    }catch(e){console.error('[account session]',e);res.status(401).json({error:'Google 로그인을 확인하지 못했어요. 다시 시도해주세요.'});}
  });
  app.use(express.static(path.join(root,'public'),{maxAge:0}));
  io.use(async(socket,next)=>{try{
    const {token,idToken}=socket.handshake.auth||{};
    let p=typeof token==='string'&&token.length<=128?profiles.get(hash(token)):null;
    if(!p&&cloud&&typeof idToken==='string'&&idToken.length<=8192){const user=await cloud.verifyIdToken(idToken);if(user.firebase?.sign_in_provider==='google.com')p=profiles.get(`user:${user.uid}`);}
    if(!p)return next(new Error('다시 입장해주세요.'));
    socket.data.profile=p;next();
  }catch{next(new Error('로그인을 다시 확인해주세요.'));}});
  io.on('connection',socket=>{
    const p=socket.data.profile,id=p.id;
    clearTimeout(disconnectTimers.get(id));disconnectTimers.delete(id);
    let entry=online.get(id);if(!entry){entry={sockets:new Set()};online.set(id,entry);}entry.sockets.add(socket.id);
    const room=playerRoom(id);if(room){socket.join(room.id);socket.emit('room',brief(room));if(room.match)socket.emit('match',matchView(room,id));}
    socket.emit('profile:update',{id,profile:self(p)});broadcast();
    let actions=0,windowAt=Date.now();
    function on(event,fn){socket.on(event,async(data,ack)=>{try{if(Date.now()-windowAt>1000){windowAt=Date.now();actions=0;}if(++actions>20)throw new Error('조금 천천히 진행해주세요.');const result=await fn(data||{});await pendingPersist;if(typeof ack==='function')ack({ok:true,...result});}catch(e){if(typeof ack==='function')ack({ok:false,error:e.message});}});}
    function requireRoom(host=false){const r=playerRoom(id);if(!r)throw new Error('먼저 방에 입장해주세요.');if(host&&r.host!==id)throw new Error('호스트만 변경할 수 있어요.');return r;}
    function aiGate(){const last=aiLimits.get(id)||0;if(Date.now()-last<15000)throw new Error('AI 분석은 15초에 한 번 요청할 수 있어요.');aiLimits.set(id,Date.now());}
    async function withAiQuota(generate){
      if(!cloud||!(await aiEnabled()))return generate();
      if(!p.uid)throw new Error('AI 기능을 사용하려면 Google 계정을 연결해주세요.');
      p.aiUsed=await cloud.reserveAiCall(p.uid,10);
      let result;
      try{result=await generate();}catch(e){p.aiUsed=await cloud.refundAiCall(p.uid);throw e;}
      if(result.source!=='ai')p.aiUsed=await cloud.refundAiCall(p.uid);
      else p.aiUsed=await cloud.aiUsed(p.uid);
      return result;
    }
    const modeFor=(mode,game)=>mode==='explore'?'explore':mode==='coop'&&game==='crisis'?'coop':'versus';
    on('room:create',d=>{if(playerRoom(id))throw new Error('현재 방을 먼저 나가주세요.');if(rooms.size>=100)throw new Error('방이 가득 찼어요.');const game=GAMES.some(g=>g.id===d.game)?d.game:'workshop';let rid;do{rid=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(rid));const mode=modeFor(d.mode,game);const r={id:rid,name:clean(d.name,32)||`${p.name}의 ${mode==='explore'?'탐색':'탐험방'}`,game,mode,host:id,members:[id],ready:new Set([id]),status:'waiting'};rooms.set(rid,r);for(const sid of entry.sockets)io.sockets.sockets.get(sid)?.join(rid);broadcast();return {roomId:rid};});
    on('room:join',d=>{if(playerRoom(id))throw new Error('현재 방을 먼저 나가주세요.');const r=rooms.get(clean(d.id,6).toUpperCase());if(!r)throw new Error('방을 찾을 수 없어요.');if(r.mode==='explore')throw new Error('혼자 탐색 중인 방이에요.');if(r.status!=='waiting')throw new Error('진행 중인 방입니다.');if(r.members.length>=4)throw new Error('방이 가득 찼어요.');r.members.push(id);for(const sid of entry.sockets)io.sockets.sockets.get(sid)?.join(r.id);broadcast();return {roomId:r.id};});
    on('room:leave',()=>{leave(id);for(const sid of entry.sockets)io.to(sid).emit('room',null);});
    on('room:configure',d=>{const r=requireRoom(true);if(r.status!=='waiting')throw new Error('대기 중에만 변경할 수 있어요.');if(!GAMES.some(g=>g.id===d.game))throw new Error('게임을 선택해주세요.');const mode=modeFor(d.mode,d.game);if(mode==='explore'&&r.members.length>1)throw new Error('혼자 탐색은 1인일 때만 선택할 수 있어요.');r.game=d.game;r.mode=mode;r.ready=new Set([r.host]);broadcast();});
    on('room:ready',()=>{const r=requireRoom();if(r.status!=='waiting')throw new Error('대기 중에만 준비할 수 있어요.');if(id!==r.host){if(r.ready.has(id))r.ready.delete(id);else r.ready.add(id);}broadcast();});
    on('room:invite',d=>{const r=requireRoom();if(r.mode==='explore')throw new Error('함께하려면 먼저 모드를 바꿔주세요.');if(r.status!=='waiting')throw new Error('대기 중에 초대할 수 있어요.');if(d.id===id||!online.has(d.id)||playerRoom(d.id))throw new Error('로비에 있는 플레이어를 초대해주세요.');const key=`${id}:${d.id}`,last=invites.get(key);if(last&&Date.now()-last<10000)throw new Error('이미 초대했어요. 잠시 기다려주세요.');invites.set(key,Date.now());for(const sid of online.get(d.id).sockets)io.to(sid).emit('invite',{from:p.name,roomId:r.id,roomName:r.name,expiresAt:Date.now()+60000});});
    on('match:start',()=>{const r=requireRoom(true);if(r.status!=='waiting')throw new Error('이미 시작한 게임입니다.');if(!r.members.every(pid=>r.ready.has(pid)&&online.has(pid)))throw new Error('모두 접속해서 준비를 완료해야 해요.');const now=Date.now(),length=r.mode==='explore'?exploreDuration:duration;r.status='playing';r.match={id:randomUUID(),startAt:now+countdown,endAt:now+countdown+length,tasks:makeTasks(r.game),players:Object.fromEntries(r.members.map(pid=>[pid,{score:0,answers:[],probes:[],attempts:[],changes:0,done:false,questionAt:now+countdown}]))};r.timer=setTimeout(()=>finish(r),countdown+length);broadcast();emitMatch(r);});
    function active(d){const r=requireRoom();if(r.status!=='playing'||!r.match)throw new Error('진행 중인 게임이 없어요.');const m=r.match,v=m.players[id];if(Date.now()<m.startAt)throw new Error('곧 시작해요!');if(Date.now()>=m.endAt){finish(r);throw new Error('시간이 끝났어요.');}if(v.done||d.index!==v.answers.length||d.matchId!==m.id)throw new Error('이미 처리된 문제입니다.');return {r,m,v,task:m.tasks[v.answers.length]};}
    // 문제 하나의 최종 결과를 확정한다. 재시도 기록(attempts)과 선택 변경 횟수를 함께 남긴다.
    function settle(r,m,v,answer){const first=v.attempts[0]||answer;Object.assign(answer,{attempts:answer.skipped?v.attempts.length:v.attempts.length+1,firstQuality:first.quality,changes:v.changes});v.answers.push(answer);v.score+=answer.score;v.probes=[];v.attempts=[];v.changes=0;v.questionAt=Date.now();v.done=v.answers.length>=5;if(r.members.every(pid=>m.players[pid].done))finish(r);else emitMatch(r);}
    on('match:probe',d=>{const {r,v,task}=active(d);if(task.kind!=='workshop')throw new Error('실험할 수 없는 게임입니다.');if(v.probes.length>=2)throw new Error('문제당 실험은 2회 가능해요.');if(!Number.isInteger(d.value)||d.value<0||d.value>20)throw new Error('0~20 사이 정수를 입력해주세요.');if(v.probes.some(p=>p.x===d.value))throw new Error('이미 실험한 값입니다.');v.probes.push({x:d.value,y:d.value*task.a+task.b});emitMatch(r);});
    on('match:answer',d=>{const {r,m,v,task}=active(d);if(Number.isInteger(d.changes))v.changes+=Math.max(0,Math.min(50,d.changes));const answer=evaluate(task,d.answer,Date.now()-v.questionAt,v.probes.length,v.answers.at(-1));
      if(r.mode==='explore'&&answer.quality<.8&&v.attempts.length<2){answer.hint=hintFor(task,answer);v.attempts.push(answer);emitMatch(r);return {retry:true,hint:answer.hint};}
      if(r.mode==='explore'&&v.attempts.length)answer.score=Math.round(answer.score/(v.attempts.length+1));
      settle(r,m,v,answer);return {feedback:answer};});
    on('match:skip',d=>{const {r,m,v}=active(d);if(r.mode!=='explore')throw new Error('탐색 모드에서만 넘어갈 수 있어요.');const last=v.attempts.at(-1);const answer=last?{...last,score:0,skipped:true}:{quality:0,behavior:0,score:0,elapsed:Date.now()-v.questionAt,probes:v.probes.length,explanation:'이 문제는 넘어갔어요.',skipped:true};settle(r,m,v,answer);return {};});
    on('match:reflect',d=>{const record=p.log.find(x=>x.type==='play'&&x.id===d.matchId);if(!record)throw new Error('기록을 찾을 수 없어요.');if(record.again!=null)throw new Error('이미 응답했어요.');const again=scale(d.again),burden=scale(d.burden);if(!again||!burden)throw new Error('1~5 사이에서 골라주세요.');record.again=again;record.burden=burden;persist();emitSelf(id);return {};});
    on('report:generate',async()=>{const insight=analyze(p);if(!insight.plays)throw new Error('먼저 한 판 이상 플레이해주세요.');const basis=`${p.log.length}:${p.log.filter(r=>r.again!=null).length}`;if(p.report?.basis===basis)return {report:p.report};aiGate();const result=await withAiQuota(()=>aiReport(aiInput(p,insight),ruleReport(insight)));p.report={...result,basis,at:Date.now()};persist();emitSelf(id);return {report:p.report};});
    on('quest:plan',async d=>{const job=JOBS.find(j=>j.id===d.job);if(!job)throw new Error('직업을 찾을 수 없어요.');if(p.questPlans[job.id])return {plan:p.questPlans[job.id]};const base=exploreQuest(job.id),insight=analyze(p);if(!insight.plays){p.questPlans[job.id]={...base,source:'rules'};}else{aiGate();p.questPlans[job.id]=await withAiQuota(()=>aiQuest(aiInput(p,insight),job,base));}persist();emitSelf(id);return {plan:p.questPlans[job.id]};});
    on('quest:submit',d=>{const q=questDef(d.id);if(!q?.fields)throw new Error('제출할 수 없는 퀘스트입니다.');if(p.quests[d.id]?.done)throw new Error('이미 완료한 퀘스트예요.');const record=submitWritten(d.id,d.values);addLog(p,record);p.quests[d.id]={done:true,at:record.at};persist();emitSelf(id);return {summary:record.summary};});
    on('quest:check',d=>{if(!p.quests['dev-1']?.done)throw new Error('Lv.1을 먼저 완료해주세요.');const state=p.quests['dev-2']||={attempts:0,cause:false,fix:false};if(state.done)throw new Error('이미 완료한 퀘스트예요.');if(d.step==='fix'&&!state.cause)throw new Error('원인을 먼저 찾아주세요.');const result=checkBug(d.step,d.step==='cause'?d.value:String(d.value||''));state.attempts++;if(result.ok)state[d.step]=true;if(state.cause&&state.fix){state.done=true;state.at=Date.now();addLog(p,{type:'quest',quest:'dev-2',at:state.at,summary:`개발자 REAL QUEST Lv.2 완료 — 오류 메시지를 읽고 원인을 찾아 코드 한 줄을 고쳤어요 (시도 ${state.attempts}회).`});}persist();emitSelf(id);return {correct:result.ok,hint:result.hint};});
    on('profile:delete',()=>{leave(id);const key=tokenOf(id);if(key)profiles.delete(key);persist();online.delete(id);broadcast();setTimeout(()=>{for(const sid of entry.sockets)io.sockets.sockets.get(sid)?.disconnect(true);},50);return {};});
    on('room:reset',()=>{const r=requireRoom(true);if(r.status!=='results')throw new Error('결과 화면에서 다시 시작해주세요.');r.status='waiting';r.match=null;r.ready=new Set([id]);broadcast();});
    socket.on('disconnect',()=>{entry.sockets.delete(socket.id);if(entry.sockets.size)return;online.delete(id);broadcast();disconnectTimers.set(id,setTimeout(()=>{disconnectTimers.delete(id);if(!online.has(id))leave(id);},disconnectGrace));});
  });
  const cleanup=setInterval(()=>{const now=Date.now();for(const [k,v]of invites)if(now-v>60000)invites.delete(k);for(const [k,v]of ipLimits)if(now-v.at>60000)ipLimits.delete(k);},60000);cleanup.unref();
  return {app,http,io,rooms,profiles,ready,close:()=>new Promise(resolve=>{clearInterval(cleanup);for(const r of rooms.values())clearTimeout(r.timer);io.close(()=>{for(const timer of disconnectTimers.values())clearTimeout(timer);http.close(async()=>{if(cloud)await cloud.flush();resolve();});});})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const service=createApp();const port=Number(process.env.PORT)||3210,host=process.env.HOST||'127.0.0.1';
  service.ready.then(()=>service.http.listen(port,host,()=>console.log(`Mindraft running at http://${host==='0.0.0.0'?'localhost':host}:${port}`))).catch(error=>{console.error('[startup]',error);process.exitCode=1;});
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{service.close().finally(()=>process.exit(0));});
}
