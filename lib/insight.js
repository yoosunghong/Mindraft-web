// 플레이 행동 기록 → CAN·LIKE·TRY·AVOID 분리 → 근거 보관함 → 직무 행동 기반 직업 탐색
import { GAMES } from './games.js';

export const BEHAVIORS = [
  {id:'sequence',name:'순서 기억',desc:'신호의 순서를 기억하고 재현하는 행동'},
  {id:'attention',name:'선택적 주의',desc:'방해 신호를 구분하고 바뀐 규칙에 적응하는 행동'},
  {id:'quantity',name:'수량 판단',desc:'주문 수량과 재고를 대조하는 행동'},
  { id: 'trace', name: '원인 추적', desc: '결과를 보고 거꾸로 원인을 찾아가는 행동' },
  { id: 'experiment', name: '가설 실험', desc: '직접 값을 바꿔 보며 규칙을 확인하는 행동' },
  { id: 'constraint', name: '조건 분석', desc: '여러 제약 조건을 동시에 따져 보는 행동' },
  { id: 'design', name: '설계·구성', desc: '부품과 재료를 조합해 구조를 만드는 행동' },
  { id: 'efficiency', name: '비용 효율 판단', desc: '같은 목표를 더 적은 자원으로 달성하는 행동' },
  { id: 'forecast', name: '수요 예측', desc: '정보를 근거로 앞으로의 상황을 가늠하는 행동' },
  { id: 'priority', name: '우선순위 판단', desc: '급한 일과 중요한 일을 비교해 순서를 정하는 행동' },
  { id: 'action', name: '신속한 실행', desc: '제한된 시간 안에 결정하고 움직이는 행동' },
  { id: 'coordinate', name: '이해관계 조율', desc: '서로 다른 요구를 듣고 균형을 맞추는 행동' },
  { id: 'fairness', name: '공정한 합의 설계', desc: '누구도 크게 소외되지 않는 선택을 찾는 행동' },
  { id: 'iterate', name: '반복 개선', desc: '실패 후 방법을 바꿔 다시 시도하는 행동' },
  { id: 'teamwork', name: '협업', desc: '다른 사람과 목표를 나누어 함께 해결하는 행동' },
  { id: 'record', name: '문제 기록·재현', desc: '문제가 언제 어떻게 생기는지 정리해 전달하는 행동' }
];
export const GAME_BEHAVIORS = {
  robot: ['trace', 'experiment', 'constraint'], cargo: ['design', 'constraint', 'efficiency'], signal: ['sequence', 'attention'], cafe: ['quantity', 'priority', 'efficiency']
};
// MVP 샘플 직업군. 직무 설명은 요약이며 운영 단계에서 고용24 직업정보·커리어넷 직업백과 API로 대체한다.
export const JOBS = [
  { id: 'developer', name: '소프트웨어 개발자', behaviors: ['trace', 'experiment', 'iterate', 'record', 'design'], work: '서비스를 설계·구현하고, 오류의 원인을 찾아 고치며 기능을 반복 개선합니다.', quest: true },
  { id: 'qa', name: '소프트웨어 테스터(QA)', behaviors: ['record', 'trace', 'constraint'], work: '서비스를 다양한 상황에서 사용해 보고 문제를 재현·기록해 개발팀에 전달합니다.' },
  { id: 'data', name: '데이터 분석가', behaviors: ['experiment', 'forecast', 'trace'], work: '데이터에서 패턴을 찾고 가설을 검증해 의사결정 근거를 만듭니다.' },
  { id: 'mechanic', name: '설비·기계 정비원', behaviors: ['trace', 'experiment', 'action'], work: '고장 증상을 점검해 원인을 찾고 부품을 수리·교체합니다.' },
  { id: 'civil', name: '건축·토목 설계 기술자', behaviors: ['design', 'constraint', 'efficiency'], work: '하중·예산·법규 조건을 만족하는 구조물을 설계합니다.' },
  { id: 'md', name: '상품기획자(MD)', behaviors: ['forecast', 'efficiency', 'constraint'], work: '수요를 예측해 상품 구성과 발주량을 결정하고 판매 결과를 분석합니다.' },
  { id: 'logistics', name: '물류·재고 관리자', behaviors: ['forecast', 'priority', 'efficiency'], work: '입출고 흐름을 관리하고 재고가 부족하거나 남지 않도록 조정합니다.' },
  { id: 'safety', name: '재난안전 관리자', behaviors: ['priority', 'action', 'teamwork'], work: '위험 상황을 평가해 대응 순서를 정하고 관계 기관과 함께 대응합니다.' },
  { id: 'social', name: '사회복지사', behaviors: ['coordinate', 'fairness', 'priority'], work: '도움이 필요한 사람의 상황을 파악해 필요한 자원과 서비스를 연결합니다.' },
  { id: 'cs', name: '고객상담·민원 코디네이터', behaviors: ['coordinate', 'record', 'action'], work: '고객·시민의 요구를 듣고 정리해 해결 방법을 안내하거나 담당 부서에 연결합니다.' },
  { id: 'pm', name: '프로젝트 매니저', behaviors: ['priority', 'coordinate', 'teamwork', 'iterate'], work: '일정과 자원, 이해관계자를 조율하며 프로젝트를 목표까지 이끕니다.' },
  { id: 'planner', name: '공공정책·행정 기획자', behaviors: ['fairness', 'coordinate', 'constraint'], work: '여러 이해관계를 고려해 공공 서비스와 제도를 기획·운영합니다.' }
];

const title = id => GAMES.find(g => g.id === id)?.title || id;
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const pct = v => `${Math.round(v * 100)}%`;
const day = t => new Date(t).toISOString().slice(0, 10);

// 매치 종료 시 한 플레이어의 과정 데이터를 한 줄 기록으로 요약한다.
export function playRecord({ matchId, game, mode, answers, abandoned = false, teammates = 0 }) {
  const n = answers.length, solved = answers.filter(a => a.quality >= .8);
  return {
    type: 'play', id: matchId, game, mode, at: Date.now(), abandoned, teammates,
    answered: n, total: 3,
    rounds: answers.map(a=>({problemId:a.problemId,problem:a.problem,difficulty:a.difficulty,at:a.at,elapsed:a.elapsed,metrics:a.metrics,events:a.events||[],attemptHistory:a.attemptHistory||[],submission:a.submission,quality:a.quality,explanation:a.explanation})),
    quality: n ? mean(answers.map(a => a.quality)) : 0,
    firstTry: n ? answers.filter(a => (a.firstQuality ?? a.quality) >= .8).length / n : 0,
    retries: answers.reduce((s, a) => s + Math.max(0, (a.attempts || 1) - 1), 0),
    recovered: answers.filter(a => (a.firstQuality ?? a.quality) < .8 && a.quality >= .8).length,
    revisions: answers.filter(a => a.revision).length,
    skipped: answers.filter(a => a.skipped).length,
    probes: answers.reduce((s, a) => s + (a.probes || 0), 0),
    changes: answers.reduce((s, a) => s + (a.changes || 0), 0),
    seconds: n ? Math.round(mean(answers.map(a => a.elapsed)) / 1000) : 0,
    solved: solved.length, again: null, burden: null
  };
}

// 게임별 CAN(잘 수행) · LIKE(좋아함) · TRY(계속 시도) · AVOID(부담·회피)를 분리한다.
export function analyze(profile) {
  const log = profile.log || [], plays = log.filter(r => r.type === 'play'), quests = log.filter(r => r.type === 'quest');
  const games = {}, evidence = [];
  for (const g of GAMES) {
    const rs = plays.filter(r => r.game === g.id); if (!rs.length) continue;
    const done = rs.filter(r => !r.abandoned && r.answered), rated = rs.filter(r => r.again != null), burdened = rs.filter(r => r.burden != null);
    const q = mean(done.map(r => r.quality)), again = rated.length ? mean(rated.map(r => r.again)) : null, burden = burdened.length ? mean(burdened.map(r => r.burden)) : null;
    const retries = rs.reduce((s, r) => s + r.retries, 0), recovered = rs.reduce((s, r) => s + r.recovered, 0), probes = rs.reduce((s, r) => s + r.probes, 0), changes = rs.reduce((s, r) => s + r.changes, 0);
    const replayAfterStruggle = rs.some((r, i) => i < rs.length - 1 && r.quality < .6);
    const abandoned = rs.filter(r => r.abandoned).length;
    const can = done.length > 0 && q >= .75;
    const like = (again != null && again >= 4) || rs.length >= 3;
    const tryIt = recovered >= 1 || retries >= 2 || probes >= 4 || replayAfterStruggle;
    const avoid = (again != null && again <= 2) || (burden != null && burden >= 4) || (abandoned > 0 && rs.at(-1).abandoned);
    games[g.id] = { plays: rs.length, quality: q, again, burden, retries, recovered, probes, changes, abandoned, can, like, try: tryIt, avoid };
    const last = rs.at(-1).at;
    if (can) evidence.push({ type: 'CAN', game: g.id, at: last, text: `${g.title}에서 ${done.length}회 플레이 평균 해결 품질 ${pct(q)} — 조건을 충족하는 해결이 반복적으로 관찰됐어요.` });
    if (tryIt) {
      const main = recovered ? `처음 틀린 문제 ${recovered}개를 다시 시도해 해결했어요` : replayAfterStruggle ? '어려웠던 판 이후에도 다시 도전했어요' : probes >= 4 ? '답을 고르기 전에 직접 실험하며 규칙을 확인했어요' : '방법을 바꿔 가며 여러 번 시도했어요';
      const details = [retries && `재도전 ${retries}회`, probes && `직접 실험 ${probes}회`].filter(Boolean);
      evidence.push({ type: 'TRY', game: g.id, at: last, text: `${g.title}에서 ${main}${details.length ? ` (${details.join(' · ')})` : ''}.` });
    }
    if (like) evidence.push({ type: 'LIKE', game: g.id, at: last, text: `${g.title}${again != null ? `에 '다시 해보고 싶다' ${again.toFixed(1)}점으로 응답했어요` : `을 스스로 ${rs.length}번 선택했어요`}.` });
    if (avoid) evidence.push({ type: 'AVOID', game: g.id, at: last, text: `${g.title}${burden != null && burden >= 4 ? `에서 부담감을 ${burden.toFixed(1)}점으로 표시했어요` : abandoned ? '을 중간에 멈춘 기록이 있어요' : `의 재플레이 의향이 낮았어요(${again?.toFixed(1)}점)`}. 억지로 맞출 필요는 없어요 — 덜 끌리는 방식을 아는 것도 자기이해예요.` });
  }
  for (const r of quests) evidence.push({ type: 'QUEST', game: r.quest, at: r.at, text: r.summary });
  // 직무 행동 점수: 계속 해보고 싶은 것(LIKE·TRY)을 잘하는 것(CAN)보다 무겁게, 부담(AVOID)은 감점
  const behavior = Object.fromEntries(BEHAVIORS.map(b => [b.id, 0]));
  for (const [gid, v] of Object.entries(games)) for (const b of GAME_BEHAVIORS[gid]) behavior[b] += (v.like ? 1 : 0) + (v.try ? 1 : 0) + (v.can ? .6 : 0) - (v.avoid ? 1 : 0) + .2;
  const totalTries = Object.values(games).reduce((s, v) => s + v.retries + v.recovered, 0);
  behavior.iterate += Math.min(2, totalTries * .3) + quests.length * .5;
  behavior.teamwork += Math.min(1.5, plays.filter(r => r.teammates > 0 && r.mode === 'coop').length * .5);
  behavior.record += quests.filter(r => r.quest === 'dev-1').length;
  behavior.trace += quests.filter(r => r.quest === 'dev-2').length;
  const quadrant = k => Object.entries(games).filter(([, v]) => v[k]).map(([id]) => id);
  const summary = { CAN: quadrant('can'), LIKE: quadrant('like'), TRY: quadrant('try'), AVOID: quadrant('avoid') };
  const gaps = Object.entries(games).filter(([, v]) => v.can && !v.like && v.again != null).map(([id]) => id)
    .concat(Object.entries(games).filter(([, v]) => v.try && !v.can).map(([id]) => id));
  return { games, summary, evidence: evidence.sort((a, b) => b.at - a.at), behavior, gaps: [...new Set(gaps)], plays: plays.length, quests: quests.length };
}

// 적합도 %를 매기지 않는다. 관찰된 행동이 업무에 쓰이는 직업을 '탐색 후보'로만 제시한다.
export function exploreJobs(insight, limit = 5) {
  if (!insight.plays) return [];
  return JOBS.map(j => ({ ...j, matched: j.behaviors.filter(b => insight.behavior[b] >= 1), score: j.behaviors.reduce((s, b) => s + Math.max(0, insight.behavior[b]), 0) / Math.sqrt(j.behaviors.length) }))
    .filter(j => j.matched.length).sort((a, b) => b.score - a.score).slice(0, limit)
    .map(({ score, ...j }) => ({ ...j, matched: j.matched.map(b => BEHAVIORS.find(v => v.id === b).name) }));
}

// AI 입력용 가명 요약. 닉네임·토큰·기기 정보는 포함하지 않는다.
export function aiInput(profile, insight) {
  return {
    plays: insight.plays, quests: insight.quests, summary: Object.fromEntries(Object.entries(insight.summary).map(([k, v]) => [k, v.map(title)])),
    games: Object.fromEntries(Object.entries(insight.games).map(([id, v]) => [title(id), { 플레이: v.plays, 해결품질: pct(v.quality), 재도전: v.retries, 다시해결: v.recovered, 직접실험: v.probes, 선택변경: v.changes, 중단: v.abandoned, 재플레이의향: v.again?.toFixed(1) ?? '미응답', 부담감: v.burden?.toFixed(1) ?? '미응답' }])),
    behaviors: Object.fromEntries(BEHAVIORS.map(b => [b.name, Number(insight.behavior[b.id].toFixed(1))])),
    evidence: insight.evidence.slice(0, 12).map(e => `[${e.type}] ${e.text} (${day(e.at)})`),
    jobs: exploreJobs(insight).map(j => `${j.name}: ${j.matched.join(', ')}`)
  };
}

// AI를 사용할 수 없을 때의 규칙 기반 자기이해 리포트
export function ruleReport(insight) {
  const s = insight.summary, names = ids => ids.map(title).join(', ');
  if (!insight.plays) return '아직 관찰된 플레이가 없어요. 혼자 탐색 모드로 한 판을 끝내면 첫 번째 근거가 쌓입니다.';
  const lines = [];
  lines.push(`지금까지 ${insight.plays}번의 플레이${insight.quests ? `와 ${insight.quests}개의 REAL QUEST` : ''}에서 행동 근거를 모았어요.`);
  if (s.CAN.length) lines.push(`잘 수행한 것(CAN): ${names(s.CAN)}. 조건을 충족하는 해결이 반복적으로 나타났어요.`);
  if (s.TRY.length) lines.push(`계속 시도한 것(TRY): ${names(s.TRY)}. 한 번에 풀리지 않아도 방법을 바꿔 다시 도전한 기록이 있어요.`);
  if (s.LIKE.length) lines.push(`좋아한 것(LIKE): ${names(s.LIKE)}. 직접 '다시 해보고 싶다'고 답했거나 스스로 여러 번 선택했어요.`);
  if (s.AVOID.length) lines.push(`덜 끌린 것(AVOID): ${names(s.AVOID)}. 부담을 느낀 방식을 아는 것도 중요한 자기이해예요.`);
  if (insight.gaps.length) lines.push(`눈여겨볼 차이: ${names(insight.gaps)}에서는 '잘하는 것'과 '계속 해보고 싶은 것'이 서로 달랐어요. 잘하는 것 ≠ 좋아하는 것 ≠ 계속 시도하는 것.`);
  const top = Object.entries(insight.behavior).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, v]) => v >= 1).map(([id]) => BEHAVIORS.find(b => b.id === id).name);
  if (top.length) lines.push(`가장 자주 관찰된 직무 행동은 ${top.join(', ')}이에요. 이 행동이 쓰이는 직업을 '직업 탐색'에서 살펴볼 수 있어요.`);
  lines.push('이 기록은 진단이나 적성 판정이 아니라, 게임 속 행동을 정리한 탐색 자료예요. 판단은 언제나 당신이 합니다.');
  return lines.join('\n\n');
}
