/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v4 — Main Script
   ═══════════════════════════════════════════════════════════ */

// ── Supabase Config ──
const SUPABASE_URL = 'https://uvrzwhfjtzqujawmscca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── AI Config ──
const MODEL = 'claude-opus-4-5-20251101';
const SYSTEM_PROMPT = '너는 20년 경력의 한국 변리사이다. 원칙: 1.표준문체(~한다) 2.글머리/마크다운 절대금지 3.SW명 대신 알고리즘 4.구성요소명(참조번호) 형태 5.명세서에 바로 붙여넣을 순수텍스트 6.제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지';

// ── State ──
let API_KEY = '';
let currentUser = null;
let currentProfile = null;
let currentProjectId = null;
let outputs = {};
let selectedTitle = '';
let selectedTitleType = '';
let includeMethodClaims = true;
let usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
let loadingState = {};

const STEP_NAMES = {
  step_01: '발명의 명칭', step_02: '기술분야', step_03: '배경기술',
  step_04: '선행기술문헌', step_05: '해결하고자 하는 과제',
  step_06: '장치 청구항', step_07: '도면 설계', step_08: '장치 상세설명',
  step_09: '수학식', step_10: '방법 청구항', step_11: '방법 도면',
  step_12: '방법 상세설명', step_13: '검토', step_14: '대안 청구항',
  step_15: '기재불비', step_16: '발명의 효과', step_17: '과제의 해결 수단',
  step_18: '도면 부호', step_19: '요약서'
};

// ══════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════

function escapeHtml(t) {
  if (!t) return '';
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'success') {
  const c = document.getElementById('toastContainer');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="tossface">${icon}</span> ${escapeHtml(message)}`;
  c.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showProgress(containerId, label, current, total) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pct = Math.round((current / total) * 100);
  el.innerHTML = `<div class="progress-container">
    <div class="progress-label"><div class="progress-dot"></div>${escapeHtml(label)}</div>
    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <div class="progress-info"><span>${current} / ${total}</span><span>${pct}%</span></div>
  </div>`;
}

function clearProgress(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) { btn.classList.add('btn-loading'); btn.disabled = true; }
  else { btn.classList.remove('btn-loading'); btn.disabled = false; }
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (name === 'auth') document.getElementById('screenAuth').classList.add('active');
  else if (name === 'tos') document.getElementById('screenTos').classList.add('active');
  else if (name === 'pending') document.getElementById('screenPending').classList.add('active');
  else if (name === 'main') {
    document.getElementById('screenMain').style.display = 'block';
    document.getElementById('screenMain').classList.add('active');
    document.getElementById('adminPanel').style.display = 'none';
  }
  else if (name === 'admin') {
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('adminPanel').classList.add('active');
    document.getElementById('screenMain').classList.remove('active');
    loadAdminUsers();
  }
}

// ══════════════════════════════════════════════
//  AUTH & SESSION
// ══════════════════════════════════════════════

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'login') {
    document.querySelector('.auth-tab:first-child').classList.add('active');
    document.getElementById('authLogin').style.display = 'block';
    document.getElementById('authSignup').style.display = 'none';
  } else {
    document.querySelector('.auth-tab:last-child').classList.add('active');
    document.getElementById('authLogin').style.display = 'none';
    document.getElementById('authSignup').style.display = 'block';
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('이메일과 비밀번호를 입력해 주세요', 'error'); return; }
  setButtonLoading('btnLogin', true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  setButtonLoading('btnLogin', false);
  if (error) { showToast(error.message, 'error'); return; }
  await onAuthSuccess(data.user);
}

async function handleSignup() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const name = document.getElementById('signupName').value.trim();
  if (!email || !password) { showToast('이메일과 비밀번호를 입력해 주세요', 'error'); return; }
  if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 해요', 'error'); return; }
  setButtonLoading('btnSignup', true);
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { display_name: name || email } }
  });
  setButtonLoading('btnSignup', false);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('회원가입 완료! 이메일을 확인해 주세요.', 'success');
  if (data.user) await onAuthSuccess(data.user);
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showScreen('auth');
}

async function onAuthSuccess(user) {
  currentUser = user;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = profile;

  if (!profile) { showToast('프로필을 불러올 수 없어요', 'error'); return; }

  if (!profile.tos_accepted) { showScreen('tos'); return; }
  if (profile.status === 'pending') { showScreen('pending'); return; }
  if (profile.status === 'suspended') { showToast('계정이 정지되었어요', 'error'); return; }

  // Approved → show main
  document.getElementById('headerUserName').textContent = profile.display_name || user.email;
  if (profile.role === 'admin') {
    document.getElementById('btnAdmin').style.display = 'inline-flex';
  }

  showScreen('main');

  // Check API Key
  API_KEY = sessionStorage.getItem('pk') || '';
  if (!API_KEY) document.getElementById('apiKeyModal').style.display = 'flex';

  loadProjects();
}

async function handleTosAccept() {
  const c1 = document.getElementById('tosCheck1').checked;
  const c2 = document.getElementById('tosCheck2').checked;
  if (!c1 || !c2) { showToast('모든 항목에 동의해 주세요', 'error'); return; }

  await sb.from('profiles').update({
    tos_accepted: true, tos_accepted_at: new Date().toISOString()
  }).eq('id', currentUser.id);

  currentProfile.tos_accepted = true;
  if (currentProfile.status === 'pending') { showScreen('pending'); }
  else { await onAuthSuccess(currentUser); }
}

async function checkApprovalStatus() {
  const { data } = await sb.from('profiles').select('status').eq('id', currentUser.id).single();
  if (data?.status === 'approved') { await onAuthSuccess(currentUser); }
  else { showToast('아직 승인 대기 중이에요', 'info'); }
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { showToast('API Key를 입력해 주세요', 'error'); return; }
  API_KEY = key;
  sessionStorage.setItem('pk', key);
  document.getElementById('apiKeyModal').style.display = 'none';
  showToast('API Key가 설정되었어요', 'success');
}

// ══════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════

async function loadAdminUsers() {
  const { data: users } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  const el = document.getElementById('adminUserList');
  if (!users || !users.length) { el.innerHTML = '<p style="color:var(--color-text-tertiary);font-size:13px">사용자가 없어요</p>'; return; }
  el.innerHTML = users.map(u => `
    <div class="admin-user-item">
      <div class="admin-user-info">
        <div class="admin-user-name">${escapeHtml(u.display_name || u.id)}</div>
        <div class="admin-user-status">
          <span class="badge ${u.status === 'approved' ? 'badge-success' : u.status === 'pending' ? 'badge-warning' : 'badge-error'}">
            ${u.status}
          </span>
          <span class="badge badge-neutral">${u.role}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px">
        ${u.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="adminApprove('${u.id}')">승인</button>` : ''}
        ${u.status === 'approved' ? `<button class="btn btn-outline btn-sm" onclick="adminSuspend('${u.id}')">정지</button>` : ''}
        ${u.status === 'suspended' ? `<button class="btn btn-outline btn-sm" onclick="adminApprove('${u.id}')">해제</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function adminApprove(userId) {
  await sb.from('profiles').update({ status: 'approved' }).eq('id', userId);
  showToast('승인되었어요', 'success');
  loadAdminUsers();
}

async function adminSuspend(userId) {
  await sb.from('profiles').update({ status: 'suspended' }).eq('id', userId);
  showToast('정지되었어요', 'success');
  loadAdminUsers();
}

// ══════════════════════════════════════════════
//  PROJECT MANAGEMENT
// ══════════════════════════════════════════════

async function loadProjects() {
  const { data } = await sb.from('projects').select('id, title, updated_at').order('updated_at', { ascending: false });
  const el = document.getElementById('projectList');
  if (!data || !data.length) {
    el.innerHTML = '<p style="color:var(--color-text-tertiary);font-size:13px;padding:8px 0">저장된 프로젝트가 없어요</p>';
    return;
  }
  el.innerHTML = data.map(p => {
    const date = new Date(p.updated_at).toLocaleDateString('ko-KR');
    return `<div class="project-item ${p.id === currentProjectId ? 'active' : ''}" onclick="loadProject('${p.id}')">
      <span class="project-item-title">${escapeHtml(p.title)}</span>
      <span class="project-item-date">${date}</span>
    </div>`;
  }).join('');
}

async function saveProject() {
  const title = selectedTitle || document.getElementById('projectInput').value.slice(0, 30) || '새 프로젝트';
  const stateJson = {
    outputs, selectedTitle, selectedTitleType, includeMethodClaims, usage,
    claimConfig: {
      device: { independent: +document.getElementById('optDeviceIndep').value, dependent: +document.getElementById('optDeviceDep').value },
      method: { independent: +document.getElementById('optMethodIndep').value, dependent: +document.getElementById('optMethodDep').value }
    }
  };

  if (currentProjectId) {
    await sb.from('projects').update({
      title,
      invention_content: document.getElementById('projectInput').value,
      current_state_json: stateJson
    }).eq('id', currentProjectId);
  } else {
    const { data } = await sb.from('projects').insert({
      owner_user_id: currentUser.id,
      title,
      invention_content: document.getElementById('projectInput').value,
      current_state_json: stateJson
    }).select('id').single();
    if (data) currentProjectId = data.id;
  }
  showToast('저장되었어요', 'success');
  loadProjects();
}

async function loadProject(projectId) {
  const { data } = await sb.from('projects').select('*').eq('id', projectId).single();
  if (!data) { showToast('프로젝트를 불러올 수 없어요', 'error'); return; }

  currentProjectId = data.id;
  document.getElementById('projectInput').value = data.invention_content || '';

  const state = data.current_state_json || {};
  outputs = state.outputs || {};
  selectedTitle = state.selectedTitle || '';
  selectedTitleType = state.selectedTitleType || '';
  includeMethodClaims = state.includeMethodClaims !== false;
  usage = state.usage || { calls: 0, inputTokens: 0, outputTokens: 0 };

  if (state.claimConfig) {
    document.getElementById('optDeviceIndep').value = state.claimConfig.device?.independent ?? 1;
    document.getElementById('optDeviceDep').value = state.claimConfig.device?.dependent ?? 9;
    document.getElementById('optMethodIndep').value = state.claimConfig.method?.independent ?? 1;
    document.getElementById('optMethodDep').value = state.claimConfig.method?.dependent ?? 9;
  }

  document.getElementById('methodToggle').checked = includeMethodClaims;
  toggleMethod();

  // Restore UI
  if (selectedTitle) {
    document.getElementById('titleInput').value = selectedTitle;
    document.getElementById('titleConfirmArea').style.display = 'block';
    document.getElementById('titleConfirmMsg').style.display = 'block';
    document.getElementById('batchArea').style.display = 'block';
  }

  // Re-render outputs
  Object.keys(outputs).forEach(stepId => {
    if (outputs[stepId]) renderOutput(stepId, outputs[stepId]);
  });

  updateStats();
  loadProjects();
  showToast('프로젝트를 불러왔어요', 'success');
}

function createNewProject() {
  currentProjectId = null;
  outputs = {};
  selectedTitle = '';
  selectedTitleType = '';
  usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  document.getElementById('projectInput').value = '';
  document.getElementById('titleInput').value = '';
  document.getElementById('titleConfirmArea').style.display = 'none';
  document.getElementById('batchArea').style.display = 'none';

  // Clear all result areas
  for (let i = 1; i <= 19; i++) {
    const el = document.getElementById(`resultStep${String(i).padStart(2, '0')}`);
    if (el) el.innerHTML = '';
  }
  document.getElementById('resultsBatch25').innerHTML = '';
  document.getElementById('resultsBatchFinish').innerHTML = '';
  document.getElementById('validationResults').innerHTML = '';
  document.getElementById('previewArea').innerHTML = '';
  document.getElementById('diagramsStep07').innerHTML = '';
  document.getElementById('diagramsStep11').innerHTML = '';

  updateStats();
  loadProjects();
  showToast('새 프로젝트를 시작해요', 'success');
}

// ══════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════

function switchTab(index) {
  document.querySelectorAll('.tab-item').forEach((t, i) => {
    t.classList.toggle('active', i === index);
    t.setAttribute('aria-selected', i === index);
  });
  document.querySelectorAll('.page').forEach((p, i) => p.classList.toggle('active', i === index));

  if (index === 4) renderPreview();
}

function toggleMethod() {
  includeMethodClaims = document.getElementById('methodToggle').checked;
  const methodCards = ['methodClaimsCard', 'methodDiagramCard', 'methodDescCard'];
  methodCards.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('card-disabled', !includeMethodClaims);
  });
}

// ══════════════════════════════════════════════
//  TITLE SELECTION (Step 01)
// ══════════════════════════════════════════════

function selectTitleType(el, type) {
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTitleType = type;
  document.getElementById('btnStep01').disabled = false;
}

function selectTitle(el, korean, english) {
  document.querySelectorAll('#resultStep01 .selection-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTitle = korean;
  document.getElementById('titleInput').value = korean;
  document.getElementById('titleConfirmArea').style.display = 'block';
  document.getElementById('titleConfirmMsg').style.display = 'block';
  document.getElementById('batchArea').style.display = 'block';
}

function onTitleInput() {
  const v = document.getElementById('titleInput').value.trim();
  document.querySelectorAll('#resultStep01 .selection-card').forEach(c => c.classList.remove('selected'));
  selectedTitle = v;
  document.getElementById('titleConfirmMsg').style.display = v ? 'block' : 'none';
  document.getElementById('batchArea').style.display = v ? 'block' : 'none';
}

// ══════════════════════════════════════════════
//  API COMMUNICATION
// ══════════════════════════════════════════════

async function callClaude(prompt, maxTokens = 8192) {
  if (!API_KEY) { document.getElementById('apiKeyModal').style.display = 'flex'; throw new Error('API Key 필요'); }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (response.status === 401) {
    sessionStorage.removeItem('pk');
    API_KEY = '';
    document.getElementById('apiKeyModal').style.display = 'flex';
    throw new Error('API Key가 유효하지 않아요');
  }
  if (response.status === 429) throw new Error('요청이 너무 많아요. 30초 후 다시 시도해 주세요');
  if (response.status >= 500) throw new Error('서버 오류가 발생했어요. 다시 시도해 주세요');

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  usage.calls++;
  usage.inputTokens += (data.usage?.input_tokens || 0);
  usage.outputTokens += (data.usage?.output_tokens || 0);
  updateStats();

  return { text: data.content[0].text, stopReason: data.stop_reason };
}

async function callClaudeWithContinuation(prompt, progressId) {
  let fullText = '';
  let response = await callClaude(prompt);
  fullText = response.text;
  let attempt = 0;

  while (attempt < 4 && response.stopReason === 'max_tokens') {
    attempt++;
    showProgress(progressId, `이어서 작성 중... (${attempt}/4)`, attempt, 4);
    response = await callClaude(
      `아래 특허명세서의 뒷부분을 이어서 작성하라. 앞부분 반복 금지. 마지막 문장 다음부터 이어서. 동일 문체 유지.\n\n[마지막부분]\n${fullText.slice(-2000)}`
    );
    fullText += '\n' + response.text;
  }
  clearProgress(progressId);
  return fullText;
}

// ══════════════════════════════════════════════
//  PROMPT TEMPLATES
// ══════════════════════════════════════════════

function buildPrompt(stepId) {
  const inv = document.getElementById('projectInput').value;
  const T = selectedTitle;

  switch (stepId) {
    case 'step_01':
      return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.
형태: "~${selectedTitleType}"
각 후보에 국문+영문.

출력형식:
[1] 국문: (명칭) / 영문: (명칭)
[2] 국문: (명칭) / 영문: (명칭)
[3] 국문: (명칭) / 영문: (명칭)
[4] 국문: (명칭) / 영문: (명칭)
[5] 국문: (명칭) / 영문: (명칭)

[프로젝트]
${inv}`;

    case 'step_02':
      return `기술분야. 20단어내외 한문장. "본 발명은"~"~에 관한 것이다." 명칭포함.\n${T}`;

    case 'step_03':
      return `배경기술 3문단: (1)기존문제 (2)최근동향 (3)필요성. 각 150단어. 번호없이문단만.\n${T}\n[프로젝트] ${inv}`;

    case 'step_04':
      return `선행기술문헌.\n【특허문헌】\n(특허문헌 1) 한국등록특허 제__________호 (추후 보완)\n${T}`;

    case 'step_05':
      return `해결과제. "본 발명은"~"~을 제공하는 것을 목적으로 한다."
마지막: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다."
${T}\n[배경기술] ${outputs.step_03 || ''}`;

    case 'step_06': {
      const indep = document.getElementById('optDeviceIndep').value;
      const dep = document.getElementById('optDeviceDep').value;
      return `장치 청구범위. 독립항 ${indep}개 + 종속항 ${dep}개.
종속항은 "청구항 N에 있어서,"로 시작. 【청구항 1】형식.
SW명(특정 제품/서비스명) 사용 금지. 알고리즘/기능으로 기술.
제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.
${T}\n[프로젝트] ${inv}`;
    }

    case 'step_07': {
      const figs = document.getElementById('optDeviceFigures').value;
      return `청구범위 도면 ${figs}개 설계. 각 도면: 제목/유형,구성요소+참조번호,연결관계,간단한설명.
참조번호 체계: 서버100번대,단말200번대,외부300번대.
${T}\n[청구범위] ${outputs.step_06 || ''}`;
    }

    case 'step_08':
      return `상세설명을 빠짐없이 완전하게 작성하라. 하나의 구성요소도 절대 생략하지 마라.
서버(100)를 주어로 사용. "구성요소(참조번호)" 형태.
도면별 "도 N을 참조하면," 형태로 시작.
특허문체(~한다). 글머리 기호/마크다운 절대 금지.
청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
각 핵심 구성요소에 대해 최소 1개의 변형 실시예를 포함하라.
제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.
${T}\n[청구범위] ${outputs.step_06 || ''}\n[도면] ${outputs.step_07 || ''}\n[프로젝트] ${(inv || '').slice(0, 3000)}`;

    case 'step_09':
      return `아래 상세설명을 분석하여 핵심 알고리즘에 대한 수학식 5개 내외를 생성하라.

출력 규칙:
1. 수학식과 삽입 위치(앵커)만 출력하라. 상세설명 전체를 다시 출력하지 마라.
2. 수학식은 워드에서 '수식'으로 바로 변환 가능하게 작성 (첨자 사용 금지).
3. 각 수학식은 해당 구성요소 설명 직후에 삽입될 위치를 지정하라.

출력 형식:
---MATH_BLOCK_1---
ANCHOR: (삽입 위치를 특정하는 상세설명의 고유 문장 또는 구절. 20자 이상)
FORMULA:
【수학식 1】
(수식, 첨자 사용 금지)
여기서, (파라미터 정의)
예시 대입: (구체적 수치 예시)

${T}\n[현재 상세설명] ${outputs.step_08 || ''}`;

    case 'step_10': {
      const indep = document.getElementById('optMethodIndep').value;
      const dep = document.getElementById('optMethodDep').value;
      const startNum = getLastClaimNumber(outputs.step_06 || '') + 1;
      return `방법 청구항. 독립항 ${indep}개 + 종속항 ${dep}개.
"~단계"로 기술. 장치 청구항 번호에 이어서 【청구항 ${startNum}】부터 시작.
장치 청구항과 1:1 대응. 종속항은 "청구항 N에 있어서,"로 시작.
제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.
${T}\n[장치 청구항] ${outputs.step_06 || ''}\n[상세설명] ${(outputs.step_08 || '').slice(0, 3000)}`;
    }

    case 'step_11': {
      const mfigs = document.getElementById('optMethodFigures').value;
      return `방법 흐름도 ${mfigs}개. S100,S200... 단계:번호,내용,연결. 간단한설명.\n${T}\n[방법 청구항] ${outputs.step_10 || ''}`;
    }

    case 'step_12':
      return `방법 상세설명을 빠짐없이 작성하라.
단계 순서대로 장치 동작과 1:1 대응. 특허문체(~한다). 글머리 금지.
시작: "이하에서는 앞서 설명한 서버의 구성 및 동작을 참조하여 방법을 설명한다."
모든 단계를 빠짐없이 기술하라. 절대 생략 금지.
제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.
${T}\n[방법 청구항] ${outputs.step_10 || ''}\n[방법 도면] ${outputs.step_11 || ''}\n[장치 상세설명] ${(outputs.step_08 || '').slice(0, 3000)}`;

    case 'step_13':
      return `아래 청구범위와 상세설명에 대해 다음 항목을 검토하라:

[검토 항목]
1. 청구항 뒷받침 검증: 청구항의 모든 기술적 특징이 상세설명에서 충분히 뒷받침되는지 확인
2. 기술적 비약 검증: 상세설명에서 논리적 비약이나 설명 없는 기술적 도약이 있는지 확인
3. 수학식 정합성 검증: 수학식이 삽입된 후 전체 내용의 왜곡이 없는지 확인
4. 반복 실시 가능성: 당업자가 명세서만으로 발명을 반복 실시할 수 있을 정도로 구체적인지 검증

각 항목에 대해 결과와 보완 방안을 제시하라.
${T}\n[청구범위] ${outputs.step_06 || ''}\n${outputs.step_10 || ''}\n[상세설명] ${(outputs.step_08 || '').slice(0, 6000)}`;

    case 'step_14':
      return `대안 청구항. 핵심유지 표현달리. 【청구항 N】.\n${T}\n[장치] ${outputs.step_06 || ''}\n[방법] ${outputs.step_10 || '(없음)'}`;

    case 'step_15':
      return `기재불비 검토. 아래 항목을 확인하고 수정안을 제안하라:
(a) 상기 선행기재: 종속항에서 "상기 OOO"로 참조하는 용어가 해당 독립항에 먼저 기재되었는지
(b) 용어: 동일 구성요소를 서로 다른 명칭으로 지칭하는지
(c) 대응: 청구항 구성요소와 상세설명 구성요소가 1:1 대응하는지
(d) 누락: 상세설명에서 핵심적으로 기술된 구성요소가 청구항에서 누락되었는지
(e) 용어 뒷받침: 청구항의 모든 기술용어가 명세서(상세설명)에서 충분히 설명되고 뒷받침되는지
${T}\n[전체] ${outputs.step_06 || ''}\n${outputs.step_10 || ''}\n${outputs.step_14 || ''}`;

    case 'step_16':
      return `발명의 효과를 작성하라. "본 발명에 따르면," 으로 시작. 50단어 이내로 간결하게 작성.
마지막: "본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다."
${T}\n[과제] ${outputs.step_05 || ''}\n[상세설명] ${(outputs.step_08 || '').slice(0, 2000)}`;

    case 'step_17':
      return `과제의 해결 수단. "본 발명의 일 실시예에 따른" 으로 시작.
마지막: "본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다."
${T}\n[장치] ${outputs.step_06 || ''}\n[방법] ${outputs.step_10 || '(없음)'}`;

    case 'step_18':
      return `도면의 주요 부분에 대한 부호의 설명. "구성요소 : 참조번호" 형태. 참조번호 오름차순 정렬.\n${T}\n[도면] ${outputs.step_07 || ''}\n[방법도면] ${outputs.step_11 || ''}`;

    case 'step_19':
      return `요약서. 청구항 1 기준 약 150단어. 목적/구성/효과 순서. "본 발명은" 으로 시작.

출력형식:
【요약서】
【요약】
(요약 본문)

【대표도】
도 1

${T}\n[청구항1] ${(outputs.step_06 || '').slice(0, 1500)}`;

    default:
      return '';
  }
}

function buildMermaidPrompt(stepId) {
  const src = stepId === 'step_07' ? outputs.step_07 : outputs.step_11;
  return `아래 도면 설계를 Mermaid.js로 변환. 각 도면별 \`\`\`mermaid 코드블록.
규칙: 블록도=graph TD/LR, 흐름도=flowchart TD, 한글노드 큰따옴표: A["서버(100)"], subgraph그룹.
[도면] ${src}`;
}

// ══════════════════════════════════════════════
//  STEP EXECUTION
// ══════════════════════════════════════════════

function checkDependency(stepId) {
  const inv = document.getElementById('projectInput').value.trim();
  const deps = {
    step_01: () => inv ? null : '발명 내용을 먼저 입력해 주세요',
    step_06: () => selectedTitle ? null : '명칭을 먼저 확정해 주세요',
    step_07: () => outputs.step_06 ? null : '장치 청구항을 먼저 생성해 주세요',
    step_08: () => (outputs.step_06 && outputs.step_07) ? null : '도면 설계를 먼저 생성해 주세요',
    step_09: () => outputs.step_08 ? null : '상세설명을 먼저 생성해 주세요',
    step_10: () => outputs.step_06 ? null : '장치 청구항을 먼저 생성해 주세요',
    step_11: () => outputs.step_10 ? null : '방법 청구항을 먼저 생성해 주세요',
    step_12: () => (outputs.step_10 && outputs.step_11) ? null : '방법 도면을 먼저 생성해 주세요',
    step_13: () => (outputs.step_06 && outputs.step_08) ? null : '청구항과 상세설명을 먼저 생성해 주세요',
    step_14: () => outputs.step_06 ? null : '장치 청구항을 먼저 생성해 주세요',
    step_15: () => outputs.step_06 ? null : '장치 청구항을 먼저 생성해 주세요',
  };
  const check = deps[stepId];
  return check ? check() : null;
}

async function runStep(stepId) {
  if (loadingState[stepId]) return;
  const depError = checkDependency(stepId);
  if (depError) { showToast(depError, 'error'); return; }

  const btnId = `btn${stepId.charAt(0).toUpperCase() + stepId.slice(1).replace('_', '')}`;
  loadingState[stepId] = true;
  setButtonLoading(btnId, true);

  try {
    const prompt = buildPrompt(stepId);
    const result = await callClaude(prompt);
    outputs[stepId] = result.text;
    renderOutput(stepId, result.text);
    showToast(`${STEP_NAMES[stepId]} 생성 완료`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    loadingState[stepId] = false;
    setButtonLoading(btnId, false);
  }
}

async function runLongStep(stepId) {
  if (loadingState[stepId]) return;
  const depError = checkDependency(stepId);
  if (depError) { showToast(depError, 'error'); return; }

  const btnId = stepId === 'step_08' ? 'btnStep08' : 'btnStep12';
  const progressId = stepId === 'step_08' ? 'progressStep08' : 'progressStep12';
  loadingState[stepId] = true;
  setButtonLoading(btnId, true);
  showProgress(progressId, `${STEP_NAMES[stepId]} 생성 중...`, 0, 1);

  try {
    const prompt = buildPrompt(stepId);
    const text = await callClaudeWithContinuation(prompt, progressId);
    outputs[stepId] = text;
    renderOutput(stepId, text);
    showToast(`${STEP_NAMES[stepId]} 생성 완료`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    loadingState[stepId] = false;
    setButtonLoading(btnId, false);
    clearProgress(progressId);
  }
}

async function runMathInsertion() {
  if (loadingState.step_09) return;
  const depError = checkDependency('step_09');
  if (depError) { showToast(depError, 'error'); return; }

  loadingState.step_09 = true;
  setButtonLoading('btnStep09', true);

  try {
    const prompt = buildPrompt('step_09');
    const result = await callClaude(prompt);
    const merged = insertMathBlocks(outputs.step_08, result.text);
    outputs.step_09 = merged;
    renderOutput('step_09', merged);
    showToast('수학식 삽입 완료', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    loadingState.step_09 = false;
    setButtonLoading('btnStep09', false);
  }
}

async function runDiagramStep(stepId) {
  if (loadingState[stepId]) return;
  const depError = checkDependency(stepId);
  if (depError) { showToast(depError, 'error'); return; }

  const btnId = stepId === 'step_07' ? 'btnStep07' : 'btnStep11';
  loadingState[stepId] = true;
  setButtonLoading(btnId, true);

  try {
    // Phase 1: Text design
    const prompt = buildPrompt(stepId);
    const result = await callClaude(prompt);
    outputs[stepId] = result.text;
    renderOutput(stepId, result.text);

    // Phase 2: Mermaid conversion
    const mermaidPrompt = buildMermaidPrompt(stepId);
    const mermaidResult = await callClaude(mermaidPrompt, 4096);
    const mermaidKey = stepId + '_mermaid';
    outputs[mermaidKey] = mermaidResult.text;
    renderDiagrams(stepId, mermaidResult.text);

    if (stepId === 'step_07') document.getElementById('btnPptx07').style.display = 'block';
    showToast(`${STEP_NAMES[stepId]} 생성 완료`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    loadingState[stepId] = false;
    setButtonLoading(btnId, false);
  }
}

async function runBatch25() {
  if (loadingState.batch25) return;
  if (!selectedTitle) { showToast('명칭을 먼저 확정해 주세요', 'error'); return; }

  loadingState.batch25 = true;
  setButtonLoading('btnBatch25', true);
  const steps = ['step_02', 'step_03', 'step_04', 'step_05'];

  try {
    for (let i = 0; i < steps.length; i++) {
      showProgress('progressBatch', `${STEP_NAMES[steps[i]]} 생성 중... (${i + 1}/4)`, i + 1, 4);
      const prompt = buildPrompt(steps[i]);
      const result = await callClaude(prompt);
      outputs[steps[i]] = result.text;
      renderBatchResult('resultsBatch25', steps[i], result.text);
    }
    clearProgress('progressBatch');
    showToast('기본 항목 일괄 생성 완료', 'success');
  } catch (e) {
    clearProgress('progressBatch');
    showToast(e.message, 'error');
  } finally {
    loadingState.batch25 = false;
    setButtonLoading('btnBatch25', false);
  }
}

async function runBatchFinish() {
  if (loadingState.batchFinish) return;
  if (!outputs.step_06 || !outputs.step_08) {
    showToast('청구항과 상세설명을 먼저 생성해 주세요', 'error'); return;
  }

  loadingState.batchFinish = true;
  setButtonLoading('btnBatchFinish', true);
  const steps = ['step_16', 'step_17', 'step_18', 'step_19'];

  try {
    for (let i = 0; i < steps.length; i++) {
      showProgress('progressBatchFinish', `${STEP_NAMES[steps[i]]} 생성 중... (${i + 1}/4)`, i + 1, 4);
      const prompt = buildPrompt(steps[i]);
      const result = await callClaude(prompt);
      outputs[steps[i]] = result.text;
      renderBatchResult('resultsBatchFinish', steps[i], result.text);
    }
    clearProgress('progressBatchFinish');
    showToast('마무리 일괄 생성 완료', 'success');
  } catch (e) {
    clearProgress('progressBatchFinish');
    showToast(e.message, 'error');
  } finally {
    loadingState.batchFinish = false;
    setButtonLoading('btnBatchFinish', false);
  }
}

// ══════════════════════════════════════════════
//  PARSERS
// ══════════════════════════════════════════════

function parseTitleCandidates(text) {
  const candidates = [];
  const regex = /\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    candidates.push({ num: m[1], korean: m[1 + 1].trim(), english: m[3].trim() });
  }
  return candidates;
}

function getLastClaimNumber(text) {
  const matches = text.match(/【청구항\s*(\d+)】/g);
  if (!matches) return 0;
  return Math.max(...matches.map(m => parseInt(m.match(/(\d+)/)[1])));
}

function parseClaimStats(text) {
  const claimPattern = /【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g;
  const claims = {};
  let m;
  while ((m = claimPattern.exec(text)) !== null) claims[parseInt(m[1])] = m[2].trim();
  const total = Object.keys(claims).length;
  let dep = 0;
  Object.values(claims).forEach(t => { if (/있어서|따른/.test(t)) dep++; });
  return { total, independent: total - dep, dependent: dep, claims };
}

function extractMermaidBlocks(text) {
  const blocks = text.match(/```mermaid\n([\s\S]*?)```/g) || [];
  return blocks.map(b => b.replace(/```mermaid\n/, '').replace(/```/, '').trim());
}

function parseMathBlocks(text) {
  const blocks = [];
  const regex = /---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    blocks.push({ anchor: m[1].trim(), formula: m[2].trim() });
  }
  return blocks;
}

function insertMathBlocks(step08Text, step09Output) {
  let result = step08Text;
  const blocks = parseMathBlocks(step09Output);
  for (const block of blocks.reverse()) {
    const idx = result.indexOf(block.anchor);
    if (idx >= 0) {
      const searchStart = idx + block.anchor.length;
      const periodIdx = result.indexOf('.', searchStart);
      const insertPos = (periodIdx >= 0 && periodIdx - searchStart < 100) ? periodIdx + 1 : searchStart;
      result = result.slice(0, insertPos) + '\n\n' + block.formula + '\n\n' + result.slice(insertPos);
    }
  }
  return result;
}

// ══════════════════════════════════════════════
//  RENDERERS
// ══════════════════════════════════════════════

function renderOutput(stepId, text) {
  const containerId = `result${stepId.charAt(0).toUpperCase() + stepId.slice(1).replace('_', '')}`;
  const el = document.getElementById(containerId);
  if (!el) return;

  if (stepId === 'step_01') {
    renderTitleCards(el, text);
  } else if (stepId === 'step_06' || stepId === 'step_10') {
    renderClaimResult(el, stepId, text);
  } else {
    renderEditableResult(el, stepId, text);
  }
}

function renderTitleCards(container, text) {
  const candidates = parseTitleCandidates(text);
  if (!candidates.length) {
    container.innerHTML = `<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</div>`;
    document.getElementById('titleConfirmArea').style.display = 'block';
    return;
  }
  container.innerHTML = '<div class="selection-cards" style="margin-top:12px">' +
    candidates.map(c => `<div class="selection-card" onclick="selectTitle(this,'${escapeHtml(c.korean)}','${escapeHtml(c.english)}')">
      <div class="selection-card-category">${c.num}</div>
      <div class="selection-card-title">${escapeHtml(c.korean)}</div>
      <div class="selection-card-subtitle">${escapeHtml(c.english)}</div>
    </div>`).join('') + '</div>';
  document.getElementById('titleConfirmArea').style.display = 'block';
}

function renderClaimResult(container, stepId, text) {
  const stats = parseClaimStats(text);
  const issues = validateClaims(text);

  let html = `<div class="stat-row" style="margin-top:12px">
    <div class="stat-card stat-card-steps"><div class="stat-card-value">${stats.total}</div><div class="stat-card-label">총 청구항</div></div>
    <div class="stat-card stat-card-api"><div class="stat-card-value">${stats.independent}</div><div class="stat-card-label">독립항</div></div>
    <div class="stat-card stat-card-cost"><div class="stat-card-value">${stats.dependent}</div><div class="stat-card-label">종속항</div></div>
  </div>`;

  if (issues.length) {
    html += issues.map(iss => {
      const cls = iss.severity === 'CRITICAL' ? 'issue-critical' : iss.severity === 'HIGH' ? 'issue-high' : 'issue-pass';
      const icon = iss.severity === 'CRITICAL' ? '🔴' : iss.severity === 'HIGH' ? '🟠' : '✅';
      return `<div class="issue-item ${cls}"><span class="tossface">${icon}</span>${escapeHtml(iss.message)}</div>`;
    }).join('');
  } else {
    html += '<div class="issue-item issue-pass"><span class="tossface">✅</span>모든 검증 통과</div>';
  }

  html += `<textarea class="result-textarea" rows="14" onchange="outputs['${stepId}']=this.value">${escapeHtml(text)}</textarea>`;
  container.innerHTML = html;
}

function renderEditableResult(container, stepId, text) {
  const charCount = text.length;
  container.innerHTML = `<div style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span class="badge badge-primary">${STEP_NAMES[stepId]}</span>
      <span class="badge badge-neutral">${charCount.toLocaleString()}자</span>
    </div>
    <textarea class="result-textarea" rows="10" onchange="outputs['${stepId}']=this.value">${escapeHtml(text)}</textarea>
  </div>`;
}

function renderBatchResult(containerId, stepId, text) {
  const el = document.getElementById(containerId);
  const charCount = text.length;
  el.innerHTML += `<div class="accordion-header" onclick="toggleAccordion(this)">
    <span><span class="tossface">✅</span> ${STEP_NAMES[stepId]} <span class="badge badge-neutral">${charCount.toLocaleString()}자</span></span>
    <span class="arrow">▶</span>
  </div>
  <div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="outputs['${stepId}']=this.value">${escapeHtml(text)}</textarea></div>`;
}

function toggleAccordion(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  if (body) body.classList.toggle('open');
}

function renderDiagrams(stepId, mermaidText) {
  const containerId = stepId === 'step_07' ? 'diagramsStep07' : 'diagramsStep11';
  const el = document.getElementById(containerId);
  const blocks = extractMermaidBlocks(mermaidText);

  if (!blocks.length) {
    el.innerHTML = `<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(mermaidText)}</pre></div>`;
    return;
  }

  el.innerHTML = blocks.map((code, i) =>
    `<div class="diagram-container">
      <div class="diagram-label">도 ${i + 1}</div>
      <div class="mermaid-render" id="mermaid_${stepId}_${i}">${escapeHtml(code)}</div>
    </div>`
  ).join('');

  // Render mermaid
  setTimeout(() => {
    blocks.forEach((code, i) => {
      try {
        const elId = `mermaid_${stepId}_${i}`;
        const target = document.getElementById(elId);
        if (target) {
          mermaid.render(`svg_${stepId}_${i}`, code).then(result => {
            target.innerHTML = result.svg;
          }).catch(() => {
            target.innerHTML = `<pre style="font-size:11px;color:var(--color-error)">[렌더링 실패]\n${escapeHtml(code)}</pre>`;
          });
        }
      } catch (e) { /* fallback already in place */ }
    });
  }, 100);
}

// ══════════════════════════════════════════════
//  VALIDATION ENGINE
// ══════════════════════════════════════════════

const KILLER_WORDS = [
  { pattern: /만\s/, msg: '"만" — 제한적 표현' },
  { pattern: /반드시/, msg: '"반드시" — 제한적 표현' },
  { pattern: /에 한하여/, msg: '"~에 한하여" — 제한적 표현' },
  { pattern: /에 한정/, msg: '"~에 한정" — 제한적 표현' },
  { pattern: /에 제한/, msg: '"~에 제한" — 제한적 표현' },
  { pattern: /필수적으로/, msg: '"필수적으로" — 제한적 표현' },
  { pattern: /항상/, msg: '"항상" — 제한적 표현' },
];

function validateClaims(text) {
  const issues = [];
  if (!text) return issues;

  const claimPattern = /【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g;
  const claims = {};
  let m;
  while ((m = claimPattern.exec(text)) !== null) claims[parseInt(m[1])] = m[2].trim();

  if (!Object.keys(claims).length) {
    issues.push({ severity: 'HIGH', message: '청구항 파싱에 실패했어요' });
    return issues;
  }

  // Check claim 1 exists
  if (!claims[1]) {
    issues.push({ severity: 'CRITICAL', message: '독립항(청구항 1)이 없어요' });
  }

  // Check each claim
  Object.entries(claims).forEach(([num, claimText]) => {
    const n = parseInt(num);

    // Prior description check
    if (n > 1) {
      const refs = claimText.match(/상기\s+([가-힣a-zA-Z]+(?:\s[가-힣a-zA-Z]+){0,3})/g) || [];
      refs.forEach(ref => {
        const term = ref.replace(/^상기\s+/, '');
        const refMatch = claimText.match(/청구항\s*(\d+)에\s*있어서/);
        const refNum = refMatch ? parseInt(refMatch[1]) : 1;
        if (claims[refNum] && !claims[refNum].includes(term)) {
          issues.push({ severity: 'CRITICAL', message: `청구항 ${num}: "상기 ${term}" — 청구항 ${refNum}에 선행기재 없음` });
        }
      });

      // Reference claim range check
      const refMatch = claimText.match(/청구항\s*(\d+)에\s*있어서/);
      if (refMatch) {
        const refNum = parseInt(refMatch[1]);
        if (!claims[refNum]) {
          issues.push({ severity: 'HIGH', message: `청구항 ${num}: 참조하는 청구항 ${refNum}이 존재하지 않아요` });
        }
        if (refNum >= n) {
          issues.push({ severity: 'HIGH', message: `청구항 ${num}: 자기 자신 또는 후행 청구항을 참조해요` });
        }
      }
    }

    // Killer words check
    KILLER_WORDS.forEach(kw => {
      if (kw.pattern.test(claimText)) {
        issues.push({ severity: 'HIGH', message: `청구항 ${num}: ${kw.msg}` });
      }
    });
  });

  return issues;
}

function runValidation() {
  const allText = [outputs.step_06, outputs.step_10].filter(Boolean).join('\n');
  if (!allText) { showToast('검증할 청구항이 없어요', 'error'); return; }

  const issues = validateClaims(allText);
  const el = document.getElementById('validationResults');

  if (!issues.length) {
    el.innerHTML = '<div class="issue-item issue-pass"><span class="tossface">🎉</span>모든 검증을 통과했어요</div>';
    return;
  }

  el.innerHTML = issues.map(iss => {
    const cls = iss.severity === 'CRITICAL' ? 'issue-critical' : iss.severity === 'HIGH' ? 'issue-high' : 'issue-medium';
    const icon = iss.severity === 'CRITICAL' ? '🔴' : '🟠';
    return `<div class="issue-item ${cls}"><span class="tossface">${icon}</span>${escapeHtml(iss.message)}</div>`;
  }).join('');
}

// ══════════════════════════════════════════════
//  PREVIEW & STATS
// ══════════════════════════════════════════════

function updateStats() {
  const completed = Object.keys(outputs).filter(k => outputs[k] && k.startsWith('step_')).length;
  document.getElementById('statCompleted').textContent = `${completed}/19`;
  document.getElementById('statApiCalls').textContent = usage.calls;
  const cost = (usage.inputTokens * 15 / 1e6) + (usage.outputTokens * 75 / 1e6);
  document.getElementById('statCost').textContent = `$${cost.toFixed(2)}`;
}

function renderPreview() {
  const el = document.getElementById('previewArea');
  const spec = buildSpecification();
  if (!spec.trim()) {
    el.innerHTML = '<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">아직 생성된 항목이 없어요</p>';
    return;
  }
  const sections = spec.split(/(?=【)/);
  el.innerHTML = sections.map(s => {
    const heading = s.match(/【(.+?)】/);
    if (!heading) return '';
    return `<div class="accordion-header" onclick="toggleAccordion(this)">
      <span>【${escapeHtml(heading[1])}】</span><span class="arrow">▶</span>
    </div>
    <div class="accordion-body">${escapeHtml(s)}</div>`;
  }).join('');
}

// ══════════════════════════════════════════════
//  OUTPUT GENERATION
// ══════════════════════════════════════════════

function buildSpecification() {
  const desc08 = outputs.step_09 || outputs.step_08 || '';
  const sections = [
    '【발명의 설명】',
    `【발명의 명칭】\n${selectedTitle}`,
    `【기술분야】\n${outputs.step_02 || ''}`,
    `【발명의 배경이 되는 기술】\n${outputs.step_03 || ''}`,
    `【선행기술문헌】\n${outputs.step_04 || ''}`,
    '【발명의 내용】',
    `【해결하고자 하는 과제】\n${outputs.step_05 || ''}`,
    `【과제의 해결 수단】\n${outputs.step_17 || ''}`,
    `【발명의 효과】\n${outputs.step_16 || ''}`,
    `【도면의 간단한 설명】\n${outputs.step_07 || ''}`,
    `【발명을 실시하기 위한 구체적인 내용】\n${desc08}${outputs.step_12 ? '\n\n' + outputs.step_12 : ''}`,
    `【도면의 주요 부분에 대한 부호의 설명】\n${outputs.step_18 || ''}`,
    `【청구범위】\n${outputs.step_06 || ''}${outputs.step_10 ? '\n\n' + outputs.step_10 : ''}`,
    outputs.step_19 || '',
  ];
  return sections.filter(Boolean).join('\n\n');
}

function copyToClipboard() {
  const text = buildSpecification();
  if (!text.trim()) { showToast('복사할 내용이 없어요', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => showToast('복사되었어요', 'success'))
    .catch(() => showToast('클립보드 접근 불가. 직접 복사해 주세요', 'error'));
}

function downloadAsTxt() {
  const text = buildSpecification();
  if (!text.trim()) { showToast('다운로드할 내용이 없어요', 'error'); return; }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `특허명세서_${selectedTitle || '초안'}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
}

function downloadAsDocx() {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, convertInchesToTwip } = docx;

  const desc08 = outputs.step_09 || outputs.step_08 || '';

  const sections = [
    { heading: '발명의 설명', body: null },
    { heading: '발명의 명칭', body: selectedTitle },
    { heading: '기술분야', body: outputs.step_02 },
    { heading: '발명의 배경이 되는 기술', body: outputs.step_03 },
    { heading: '선행기술문헌', body: outputs.step_04 },
    { heading: '발명의 내용', body: null },
    { heading: '해결하고자 하는 과제', body: outputs.step_05 },
    { heading: '과제의 해결 수단', body: outputs.step_17 },
    { heading: '발명의 효과', body: outputs.step_16 },
    { heading: '도면의 간단한 설명', body: outputs.step_07 },
    { heading: '발명을 실시하기 위한 구체적인 내용', body: [desc08, outputs.step_12].filter(Boolean).join('\n\n') },
    { heading: '도면의 주요 부분에 대한 부호의 설명', body: outputs.step_18 },
    { heading: '청구범위', body: [outputs.step_06, outputs.step_10].filter(Boolean).join('\n\n') },
    { heading: '요약서', body: outputs.step_19 },
  ];

  const children = [];

  sections.forEach(sec => {
    // Heading paragraph: 【heading】, bold, no indent
    children.push(new Paragraph({
      children: [new TextRun({ text: `【${sec.heading}】`, bold: true, font: 'Batang', size: 24 })],
      spacing: { before: 240, after: 120, line: 480 },
      alignment: AlignmentType.LEFT,
    }));

    if (sec.body) {
      const lines = sec.body.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const isMath = /【수학식\s*\d+】/.test(line);
        const isReviewNeeded = /추후 보완|보충 필요/.test(line);

        children.push(new Paragraph({
          children: [new TextRun({
            text: line,
            font: 'Batang',
            size: 24,
            highlight: (isMath || isReviewNeeded) ? 'yellow' : undefined,
          })],
          spacing: { line: 480 },
          indent: { firstLine: convertInchesToTwip(0.555) }, // 1.41cm ≈ 0.555 inch
          alignment: AlignmentType.JUSTIFIED,
        }));
      });
    }
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      default: {
        document: {
          run: { font: 'Batang', size: 24 },
          paragraph: { spacing: { line: 480 } },
        },
      },
    },
  });

  Packer.toBlob(doc).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `특허명세서_${selectedTitle || '초안'}_${new Date().toISOString().slice(0, 10)}.docx`;
    a.click();
    showToast('Word 파일 다운로드 완료', 'success');
  });
}

function downloadPptx(stepId) {
  const mermaidKey = stepId + '_mermaid';
  const mermaidText = outputs[mermaidKey];
  if (!mermaidText) { showToast('도면 데이터가 없어요', 'error'); return; }

  const pptx = new PptxGenJS();
  const blocks = extractMermaidBlocks(mermaidText);

  if (!blocks.length) { showToast('Mermaid 코드를 찾을 수 없어요', 'error'); return; }

  // For each diagram, get SVG from rendered diagrams and add to slide
  blocks.forEach((code, i) => {
    const slide = pptx.addSlide();
    slide.addText(`도 ${i + 1}`, { x: 0.5, y: 0.3, fontSize: 18, bold: true });

    // Get rendered SVG
    const svgEl = document.querySelector(`#mermaid_${stepId}_${i} svg`);
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const encoded = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      slide.addImage({ data: encoded, x: 0.5, y: 1, w: 9, h: 5 });
    } else {
      slide.addText(code, { x: 0.5, y: 1, fontSize: 10, w: 9, h: 5 });
    }
  });

  pptx.writeFile({ fileName: `도면_${selectedTitle || '초안'}_${new Date().toISOString().slice(0, 10)}.pptx` });
  showToast('PPTX 다운로드 완료', 'success');
}

function downloadPptxAll() {
  if (outputs.step_07_mermaid) downloadPptx('step_07');
  else showToast('도면 데이터가 없어요', 'error');
}

// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════

async function init() {
  // Initialize Mermaid
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

  // Check existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await onAuthSuccess(session.user);
  } else {
    showScreen('auth');
  }

  // Listen for auth changes
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showScreen('auth');
    }
  });
}

// Start
init();
