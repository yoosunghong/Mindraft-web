import { ARCADE_GAMES, makeArcadeTasks, arcadePublic, evaluateArcade } from './arcade.js';
export const STATS = ['분석', '탐구', '창의', '전략', '실행', '소통'];
export const MEDALS = ['패턴의 눈', '호기심의 나침반', '가능성의 설계자', '한 수 앞의 전략가', '위기의 해결사', '마음을 잇는 다리'];
export const GAMES=ARCADE_GAMES;
export const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
export const makeTasks=makeArcadeTasks;
export const publicTask=t=>t?arcadePublic(t):null;
export const evaluate=evaluateArcade;
export const hintFor=(t,a)=>a.explanation;
export function reward(profile, game, answers) {
  const def=GAMES.find(g=>g.id===game),n=answers.length;
  if(!n) return {xp:Array(6).fill(0),medals:[],observations:['응답 기록이 없어 능력치가 부여되지 않았어요.']};
  const behavior=answers.reduce((s,a)=>s+a.behavior,0)/3, performance=answers.reduce((s,a)=>s+a.quality,0)/3;
  const repeats=profile.plays[game]||0, factor=Math.max(.4,1/(1+.3*repeats));
  const xp=def.weights.map((w,i)=>{
    if(!w) return 0;
    const others=Object.entries(profile.evidence).filter(([g])=>g!==game).filter(([g])=>GAMES.find(d=>d.id===g)?.weights[i]>0).map(([,e])=>e.mean);
    const consistency=others.length?Math.min(behavior,others.reduce((a,b)=>a+b,0)/others.length):behavior*.5;
    return Math.round(100*w*(.7*behavior+.2*consistency+.1*performance)*factor);
  });
  xp.forEach((v,i)=>profile.xp[i]+=v);
  const old=profile.evidence[game]||{mean:0,count:0};
  profile.evidence[game]={mean:(old.mean*old.count+behavior)/(old.count+1),count:old.count+1};
  profile.plays[game]=repeats+1;profile.sessions++;
  const medals=[];
  def.weights.forEach((w,i)=>{if(w>=.3&&behavior>=.65){profile.medals[i]=(profile.medals[i]||0)+1;medals.push(i);}});
  return {xp,medals,observations:[`3라운드 기준 해결 품질 ${Math.round(performance*100)}% · 행동 근거 ${Math.round(behavior*100)}%`,`반복 보상 계수 ${factor.toFixed(2)} · 다른 게임의 관찰 결과와 함께 능력치를 계산했어요.`,answers.at(-1).explanation]};
}
