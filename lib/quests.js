// REAL QUEST: 게임 밖에서 실제 직무를 작게 경험하는 미션. MVP는 개발자 직무를 2단계로 깊게 구현한다.
import { JOBS } from './insight.js';

const clean = (s, max = 600) => typeof s === 'string' ? s.trim().replace(/[\x00-\x09\x0b-\x1f<>]/g, '').slice(0, max) : '';

export const DEV_BUG = {
  html: '<button id="save-btn">저장하기</button>\n<p id="status">저장 전</p>',
  js: ["const button = document.querySelector('#save-button');", "button.addEventListener('click', () => {", "  document.querySelector('#status').textContent = '저장 완료!';", '});'],
  error: "Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')",
  causes: ['버튼 글자가 한글이라서 브라우저가 인식하지 못한다', "선택자 '#save-button'이 실제 버튼 id 'save-btn'과 달라 버튼을 찾지 못한다", "textContent 대신 innerHTML을 써야 글자가 바뀐다", "클릭 이벤트 이름은 'click'이 아니라 'press'여야 한다"],
  cause: 1
};

export const QUESTS = {
  'dev-1': { job: 'developer', level: 1, title: '웹사이트의 문제를 찾아보세요', minutes: 20, behaviors: ['문제 기록·재현', '원인 추적'],
    intro: '개발자는 기능을 만드는 시간만큼 "무엇이 왜 불편한지"를 정확히 찾고 설명하는 데 시간을 씁니다.',
    steps: ['자주 쓰는 웹사이트나 앱 하나를 고르세요. (개인정보가 보이는 화면은 적지 마세요)', '불편하거나 이상하게 작동하는 부분을 하나 찾으세요.', '어떤 순서로 하면 그 문제가 다시 생기는지(재현 단계) 적어 보세요.', '어떻게 고치면 좋을지 한 가지 아이디어를 적어 보세요.'],
    fields: [['site', '어떤 서비스인가요? (종류만 적어도 돼요)', 60, 2], ['symptom', '무엇이 불편하거나 이상했나요?', 400, 10], ['steps', '어떻게 하면 다시 생기나요? (재현 단계)', 600, 15], ['idea', '어떻게 고치면 좋을까요?', 400, 10]] },
  'dev-2': { job: 'developer', level: 2, title: '작동하지 않는 버튼의 원인을 찾아 고치세요', minutes: 15, behaviors: ['원인 추적', '가설 실험', '반복 개선'],
    intro: '실제 개발 업무의 상당 부분은 오류 메시지를 읽고, 가설을 세우고, 코드 한 줄을 고쳐 확인하는 반복입니다.',
    steps: ['미리보기에서 버튼을 눌러 증상을 확인하세요.', '콘솔 오류 메시지를 읽고 원인을 골라 보세요.', '코드 한 줄을 고쳐 버튼이 동작하게 만드세요.'] }
};

// 모든 직업에 제공하는 기본 탐색 퀘스트(규칙 기반). AI 사용 시 사용자 기록을 반영한 문장으로 대체된다.
export function exploreQuest(jobId) {
  const job = JOBS.find(j => j.id === jobId); if (!job) return null;
  return { id: `explore-${job.id}`, job: job.id, level: 0, title: `${job.name}의 하루를 조사해 보세요`, minutes: 20, behaviors: ['정보 탐색'],
    intro: `${job.name}는 ${job.work}`,
    steps: [`고용24 직업정보나 커리어넷 직업백과에서 '${job.name}'를 검색해 하는 일 3가지를 읽어 보세요.`, '그중 내가 게임에서 해 본 행동과 비슷한 일을 하나 고르세요.', '현직자에게 묻고 싶은 질문 2개를 적어 보세요.'],
    fields: [['similar', '게임에서 해 본 행동과 비슷한 일은?', 400, 10], ['questions', '현직자에게 묻고 싶은 질문 2개', 400, 10]] };
}

export function questDef(id) { return QUESTS[id] || (id?.startsWith('explore-') ? exploreQuest(id.slice(8)) : null); }

// 서술형 퀘스트 제출 검증 → 근거 보관함 기록
export function submitWritten(id, values) {
  const q = questDef(id); if (!q?.fields) throw new Error('제출할 수 없는 퀘스트입니다.');
  const data = {};
  for (const [key, label, max, min] of q.fields) { const v = clean(values?.[key], max); if (v.length < min) throw new Error(`'${label}'을 ${min}자 이상 적어주세요.`); data[key] = v; }
  const summary = id === 'dev-1' ? `개발자 REAL QUEST Lv.1 완료 — '${data.site}'의 문제를 재현 단계(${data.steps.split(/\n|→|->|,/).filter(s => s.trim()).length}단계)와 함께 기록하고 개선 아이디어를 제안했어요.` : `${JOBS.find(j => j.id === q.job).name} 탐색 퀘스트 완료 — 실제 업무를 조사하고 현직자에게 물을 질문을 정리했어요.`;
  return { type: 'quest', quest: id, at: Date.now(), summary, data };
}

// 개발자 Lv.2: 원인 가설 → 코드 수정 두 단계를 서버에서 검증
export function checkBug(step, value) {
  if (step === 'cause') return { ok: value === DEV_BUG.cause, hint: value === DEV_BUG.cause ? '맞아요. querySelector가 버튼을 찾지 못해 null을 돌려준 거예요.' : '오류 메시지의 "null"은 무엇을 찾지 못했다는 뜻일까요? HTML의 id를 다시 확인해 보세요.' };
  if (step === 'fix') {
    const line = clean(value, 200).replace(/\s+/g, '').replace(/"/g, "'");
    const ok = /^(const|let|var)button=document\.(querySelector\('#save-btn'\)|getElementById\('save-btn'\));?$/.test(line);
    return { ok, hint: ok ? '버튼이 동작해요! 원인을 찾고, 고치고, 다시 확인하는 것이 디버깅의 한 사이클입니다.' : "첫 줄만 고쳐 보세요. 버튼의 실제 id는 'save-btn'입니다." };
  }
  throw new Error('알 수 없는 단계입니다.');
}
