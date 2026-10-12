// AI 자기이해 리포트 / 개인화 REAL QUEST 생성.
// GEMINI_API_KEY가 있으면 Gemini, 그 외에는 기존 Claude 설정 또는 규칙 기반 결과를 사용한다.
// 입력은 aiInput()이 만든 가명 요약뿐이며 닉네임·토큰은 전달하지 않는다.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const CLAUDE_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
let clientPromise = null;
let geminiPromise = null;

async function client() {
  if (process.env.AI_PROVIDER === 'rules' || !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return null;
  clientPromise ||= import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ timeout: 45000, maxRetries: 1 })).catch(() => null);
  return clientPromise;
}

async function gemini() {
  if (process.env.AI_PROVIDER === 'rules' || !process.env.GEMINI_API_KEY) return null;
  geminiPromise ||= import('@google/genai').then(({ GoogleGenAI }) =>
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  );
  return geminiPromise;
}

const SYSTEM = `당신은 청년의 진로 탐색을 돕는 Tallo의 기록 해설자입니다. 사용자는 사회와의 연결이 느슨해졌거나 진로를 잠시 멈춘 청년일 수 있습니다.
규칙:
- 진단·판정·점수·적합도(%)·순위를 말하지 않습니다. "당신은 ○○형"처럼 규정하지 않습니다.
- 반드시 입력에 있는 행동 근거(게임명, 횟수, 응답)를 인용해 설명합니다. 입력에 없는 사실을 만들지 않습니다.
- CAN(잘 수행), LIKE(좋아함), TRY(계속 시도), AVOID(부담·회피)의 차이를 보여 주고, 서로 다를 때 그 차이를 짚습니다.
- AVOID는 약점이 아니라 선호 정보로 다룹니다. 비난·훈계·과장된 칭찬을 하지 않습니다.
- 직업은 "추천"이 아니라 "더 알아볼 만한 후보"로만 언급하고, 판단은 사용자에게 맡깁니다.
- 따뜻하고 담백한 존댓말, 한국어, 4~6개의 짧은 문단, 900자 이내. 마크다운 제목 없이 문단만 씁니다.
- 마지막 문단은 오늘 바로 해볼 수 있는 아주 작은 행동 하나를 제안합니다.`;

async function ask(system, payload, maxTokens = 1200) {
  try {
    const g = await gemini();
    if (g) {
      const response = await g.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify(payload),
        config: { systemInstruction: system, maxOutputTokens: maxTokens }
      });
      return response.text?.trim() || null;
    }
    const c = await client(); if (!c) return null;
    const res = await c.beta.messages.create({
      model: CLAUDE_MODEL, max_tokens: maxTokens, system,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      messages: [{ role: 'user', content: JSON.stringify(payload) }]
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return text || null;
  } catch (e) {
    console.error('[ai]', e?.status || '', e?.message || e);
    return null;
  }
}

export async function aiReport(input, fallback) {
  const text = await ask(SYSTEM, input);
  return text ? { text: text.slice(0, 2000), source: 'ai', model: process.env.GEMINI_API_KEY ? GEMINI_MODEL : CLAUDE_MODEL } : { text: fallback, source: 'rules' };
}

const QUEST_SYSTEM = `당신은 청년이 직업 세계를 작게 체험하도록 돕는 Tallo의 REAL QUEST 설계자입니다.
입력의 행동 근거와 직업 정보를 바탕으로, 집에서 혼자 20분 안에 할 수 있고 비용·개인정보 제공·외부 가입이 필요 없는 현실 미션 1개를 만드세요.
사용자가 TRY나 LIKE를 보인 행동을 활용하고, AVOID로 나타난 방식은 피합니다. 진단이나 적합도는 말하지 않습니다.
출력은 JSON 한 개만: {"title": "20자 이내", "why": "이 사용자에게 이 미션을 제안하는 근거 1문장(입력의 기록 인용)", "steps": ["단계1","단계2","단계3"]}`;

export async function aiQuest(input, job, fallback) {
  const text = await ask(QUEST_SYSTEM, { ...input, job: { name: job.name, work: job.work, behaviors: job.behaviors } }, 500);
  try {
    const q = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (typeof q.title === 'string' && typeof q.why === 'string' && Array.isArray(q.steps) && q.steps.length >= 2)
      return { ...fallback, title: q.title.slice(0, 40), why: q.why.slice(0, 200), steps: q.steps.slice(0, 4).map(s => String(s).slice(0, 160)), source: 'ai' };
  } catch {}
  return { ...fallback, source: 'rules' };
}

export const aiEnabled = async () => !!(await gemini() || await client());
