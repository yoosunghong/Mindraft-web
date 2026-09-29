import { randomInt } from 'node:crypto';

export const STATS = ['분석', '탐구', '창의', '전략', '실행', '소통'];
export const MEDALS = ['패턴의 눈', '호기심의 나침반', '가능성의 설계자', '한 수 앞의 전략가', '위기의 해결사', '마음을 잇는 다리'];
export const GAMES = [
  { id: 'workshop', title: '고장 난 작업실', subtitle: '숨겨진 규칙을 발견하는 순간', icon: '⚙', color: 'mint', tag: '탐구 · 분석', weights: [.3,.7,0,0,0,0], mode: '규칙 추리', description: '기계의 입출력 기록을 읽고, 직접 실험하며 숨겨진 규칙을 찾아보세요.' },
  { id: 'bridge', title: '다리 건축가', subtitle: '다른 길을 만드는 상상력', icon: '⌁', color: 'peach', tag: '창의 · 분석', weights: [.4,0,.6,0,0,0], mode: '조건 설계', description: '예산과 하중을 고려해 세 구간의 다리를 설계하세요. 효율적인 여러 해법이 있습니다.' },
  { id: 'shop', title: '하루 상점', subtitle: '오늘의 선택, 내일의 가능성', icon: '▱', color: 'yellow', tag: '전략 · 탐구', weights: [0,.15,0,.7,.15,0], mode: '수요 판단', description: '날씨와 손님 예측을 읽고 재고를 주문하세요. 남는 재고까지 계산하는 선택이 중요해요.' },
  { id: 'crisis', title: '위기 대응 센터', subtitle: '중요한 순간, 함께하는 판단', icon: 'ϟ', color: 'blue', tag: '실행 · 전략', weights: [0,0,0,.3,.7,0], mode: '우선순위 · 협동', description: '위험도와 남은 시간을 비교해 가장 시급한 현장으로 출동하세요.' },
  { id: 'mediation', title: '마을 중재소', subtitle: '서로의 마음을 잇는 해결책', icon: '♧', color: 'lavender', tag: '소통 · 전략', weights: [0,0,0,.3,0,.7], mode: '합의 찾기', description: '주민들의 서로 다른 요구를 살펴보고 누구도 소외되지 않는 합의를 찾아보세요.' }
];
const choose = a => a[randomInt(a.length)];
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]];} return a; };
export const clamp = (n,a=0,b=1) => Math.min(b,Math.max(a,n));

export function makeTasks(game, count=5) {
  return Array.from({length:count}, (_, i) => {
    if(game==='workshop') {
      const a=randomInt(2,7), b=randomInt(1,10), x=randomInt(7,15), correct=a*x+b;
      return { kind:game, title:`장치 ${i+1}의 비밀`, text:'같은 규칙으로 작동하는 기계입니다. 마지막 출력값을 찾아주세요.', examples:[{x:1,y:a+b},{x:3,y:3*a+b}], x, options:shuffle([correct,correct+a,correct-b,correct+2*b]), a,b,correct };
    }
    if(game==='bridge') {
      const loads=Array.from({length:3},()=>randomInt(2,6)), budget=loads.reduce((s,n)=>s+(n<=2?2:n<=4?4:6),0)+2;
      return { kind:game,title:`강을 잇는 다리 ${i+1}`,text:'각 구간의 하중을 버티면서 예산 안에 들어오는 다리를 만드세요.',loads,budget, materials:[{name:'목재',cost:2,strength:2},{name:'트러스',cost:4,strength:4},{name:'강철',cost:6,strength:6}] };
    }
    if(game==='shop') {
      const demand=randomInt(3,10), price=randomInt(5,9),cost=3,weather=choose(['맑음','비','축제']);
      return {kind:game,title:`상점 영업 ${i+1}일차`,text:'팔리지 않은 재고는 다음 날 사용할 수 없어요. 수요에 맞춰 가장 이익이 큰 주문량을 결정하세요.',weather,demand,price,cost,budget:30,options:[2,4,6,8,10]};
    }
    if(game==='crisis') {
      const names=shuffle(['도서관 연기','다리 균열','상점 정전','길 잃은 주민','급수관 누수','산책로 낙석']);
      const incidents=names.slice(0,4).map(name=>({name,severity:randomInt(1,6),minutes:randomInt(1,7)}));
      const urgency=incidents.map(v=>v.severity/v.minutes), max=Math.max(...urgency);
      return {kind:game,title:`긴급 출동 ${i+1}`,text:'우선순위 = 위험도 ÷ 남은 시간. 지금 가장 시급한 한 곳을 선택하세요.',incidents,correct:urgency.map((v,j)=>v===max?j:-1).filter(j=>j>=0)};
    }
    const scenarios=[['광장 축제의 약속',['상인: 행사 수익','주민: 조용한 저녁','청년: 공연 기회']],['공유 정원의 미래',['가족: 놀이 공간','정원사: 식물 보호','주민: 휴식 공간']],['마을 도서관 운영',['학생: 공부 시간','아이: 이야기 시간','사서: 운영 부담']],['새로운 자전거길',['상인: 가게 접근','주민: 보행 안전','학생: 통학 편의']],['마을 예산 회의',['주민: 생활 시설','예술가: 문화 공간','청년: 배움 기회']]];
    const [title,people]=scenarios[i%scenarios.length];
    const labels=[['밤늦게까지 대규모 공연','시간을 나누고 방음 구역 운영','축제를 전면 취소','상점만 할인 행사'],['정원 전체를 놀이터로','놀이·보호·휴식 구역을 분리','방문객 출입 금지','휴식 공간만 확장'],['하루 종일 정숙 운영','정숙실과 이야기 시간을 분리','이야기 행사만 운영','모든 공간을 예약제로'],['상점 앞 도로만 확장','보행 분리와 배송 시간 조정','자전거 통행 전면 금지','자전거 전용으로 전환'],['시설 보수에 전액 사용','시설·문화·교육 예산 분담','문화 행사에 전액 사용','교육 지원에 전액 사용']];
    const options=shuffle(labels[i%5].map((label,j)=>({label,satisfaction:j===1?[randomInt(70,91),randomInt(70,91),randomInt(70,91)]:j===0?[95,20,45]:j===2?[20,95,25]:[55,35,90]})));
    return {kind:game,title,text:'세 주민의 만족도 중 가장 낮은 값을 최대한 높이는 합의를 선택하세요.',people,options};
  });
}

export function publicTask(task) {
  if(!task) return null;
  const {a,b,correct,...safe}=task;
  return safe;
}

export function evaluate(task, answer, elapsed, probes=0, previous=null) {
  let quality=0, behavior=0, explanation='';
  if(task.kind==='bridge') {
    if(!Array.isArray(answer)||answer.length!==3||answer.some(v=>!Number.isInteger(v)||v<0||v>2)) throw new Error('세 구간의 재료를 선택해주세요.');
    const cost=answer.reduce((s,v)=>s+task.materials[v].cost,0), supported=answer.filter((v,i)=>task.materials[v].strength>=task.loads[i]).length;
    quality=cost>task.budget?0:supported/3;
    const efficiency=clamp(1-(cost-task.loads.reduce((s,n)=>s+(n<=2?2:n<=4?4:6),0))/10);
    const diversity=new Set(answer).size/3;
    behavior=quality*(.65*efficiency+.35*diversity);
    explanation=`${supported}/3 구간 하중 충족 · 비용 ${cost}/${task.budget} · 재료 ${new Set(answer).size}종 활용`;
  } else {
    const count=task.kind==='crisis'?4:task.options.length;
    if(!Number.isInteger(answer)||answer<0||answer>=count) throw new Error('유효한 답을 선택해주세요.');
    if(task.kind==='workshop') {
      quality=task.options[answer]===task.correct?1:0;
      behavior=quality*.7+Math.min(probes,2)*.15;
      explanation=`규칙은 입력 × ${task.a} + ${task.b}. 정답 ${task.correct} · 추가 실험 ${probes}회`;
    }
    if(task.kind==='shop') {
      const profit=q=>Math.min(q,task.demand)*task.price-q*task.cost;
      const best=Math.max(...task.options.map(profit)),actual=profit(task.options[answer]);
      quality=clamp(actual/best); behavior=quality;
      explanation=`주문 ${task.options[answer]}개 · 판매 ${Math.min(task.options[answer],task.demand)}개 · 이익 ${actual}코인 (최적 ${best})`;
    }
    if(task.kind==='crisis') {
      quality=task.correct.includes(answer)?1:0;behavior=quality;
      explanation=`최우선 현장: ${task.correct.map(i=>task.incidents[i].name).join(', ')} · 위험도/시간 기준`;
    }
    if(task.kind==='mediation') {
      const min=task.options.map(o=>Math.min(...o.satisfaction)),best=Math.max(...min);
      quality=min[answer]/best;behavior=quality;
      explanation=`가장 낮은 주민 만족도 ${min[answer]}점 (최선 ${best}점) · 선택한 합의: ${task.options[answer].label}`;
    }
  }
  const speed=clamp(1-elapsed/25000);
  return {quality,behavior:clamp(behavior),score:Math.round(quality*800+quality*speed*200),elapsed,probes,explanation,revision:previous?.quality<.5&&quality>=.8};
}

export function reward(profile, game, answers) {
  const def=GAMES.find(g=>g.id===game),n=answers.length;
  if(!n) return {xp:Array(6).fill(0),medals:[],observations:['응답 기록이 없어 능력치가 부여되지 않았어요.']};
  const behavior=answers.reduce((s,a)=>s+a.behavior,0)/5, performance=answers.reduce((s,a)=>s+a.quality,0)/5;
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
  return {xp,medals,observations:[`5문제 기준 해결 품질 ${Math.round(performance*100)}% · 행동 근거 ${Math.round(behavior*100)}%`,`반복 보상 계수 ${factor.toFixed(2)} · 다른 게임의 관찰 결과와 함께 능력치를 계산했어요.`,answers.at(-1).explanation]};
}

// 탐색 모드 재도전용 힌트. 정답이나 최적값을 드러내지 않는다.
export function hintFor(task, answer) {
  if(task.kind==='workshop') return '선택한 값은 규칙과 맞지 않아요. 입력이 1 늘 때 출력이 얼마나 늘어나는지 실험해 보세요.';
  if(task.kind==='bridge') return `${answer.explanation}. 하중보다 약한 구간이나 예산 초과가 있는지 확인해 보세요.`;
  if(task.kind==='shop') return '주문이 수요보다 많으면 남는 재고가 손해가 되고, 적으면 팔 기회를 놓쳐요. 예측 수요를 다시 확인해 보세요.';
  if(task.kind==='crisis') return '위험도 ÷ 남은 시간을 네 현장 모두 다시 비교해 보세요.';
  const min=Math.min(...task.options.find(o=>answer.explanation.includes(o.label)).satisfaction);
  return `선택한 합의에서 가장 낮은 만족도는 ${min}점이에요. 가장 낮은 점수를 더 끌어올릴 수 있는 안이 있을까요?`;
}
