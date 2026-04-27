/* ═══════════════════════════════════════════════════════════
   의견서 대응 자동화 v2.0 — opinion.js
   3대 거절이유: A(진보성) / B(기재불비) / C(일부거절)
   namespace: window.Opinion  |  DB: opinion_*  |  CSS: opinion-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Opinion = window.Opinion || {};

// ═══ Constants ═══
Opinion.TYPES = {
  inventive_step:         { code:'A', label:'진보성/신규성 위반',    icon:'⚖️', css:'type-a',       law:'§29①②' },
  description_deficiency: { code:'B', label:'기재불비 위반',         icon:'📝', css:'type-b',       law:'§42② / §42④' },
  partial_rejection:      { code:'C', label:'일부 청구항 거절',      icon:'📋', css:'type-c',       law:'§29 등' },
  unsupported_type:       { code:'X', label:'수동 처리 필요',        icon:'⚠️', css:'type-unknown', law:'§32/§33/§36/§45 등' }
};
Opinion.STATUS = {
  // init 단계 (upload → parse → type)
  created:{label:'생성됨',css:'status-created',g:'init'},parsing:{label:'파싱 중',css:'status-parsing',g:'init'},parsed:{label:'파싱 완료',css:'status-analyzing',g:'init'},parse_failed:{label:'파싱 실패',css:'status-failed',g:'init'},type_determined:{label:'유형 판별됨',css:'status-analyzing',g:'init'},
  // strategy 단계 (쟁점 분석 + 전략 수립 — 기존 analyze+gate1 병합)
  analyzing:{label:'분석 중',css:'status-analyzing',g:'strategy'},analyzed:{label:'분석 완료',css:'status-gate',g:'strategy'},strategy_confirmed:{label:'전략 확정',css:'status-drafting',g:'strategy'},
  deficiency_analyzed:{label:'지적분석 완료',css:'status-gate',g:'strategy'},correction_confirmed:{label:'수정방향 확정',css:'status-drafting',g:'strategy'},
  allowable_identified:{label:'등록가능 식별',css:'status-gate',g:'strategy'},merge_confirmed:{label:'병합 확정',css:'status-drafting',g:'strategy'},
  // draft 단계 (청구항 보정 + 뒷받침 검증 — 기존 draft+validate 병합)
  drafting_claims:{label:'청구항 작성 중',css:'status-drafting',g:'draft'},claims_drafted:{label:'청구항 초안',css:'status-validating',g:'draft'},
  drafting_corrections:{label:'수정 작성 중',css:'status-drafting',g:'draft'},corrections_drafted:{label:'수정 완료',css:'status-validating',g:'draft'},
  drafting_merge:{label:'병합 작성 중',css:'status-drafting',g:'draft'},merge_drafted:{label:'병합 완료',css:'status-validating',g:'draft'},
  validating:{label:'검증 중',css:'status-validating',g:'draft'},validated:{label:'검증 완료',css:'status-gate',g:'draft'},correction_validated:{label:'범위검증 완료',css:'status-gate',g:'draft'},merge_validated:{label:'병합검증 완료',css:'status-gate',g:'draft'},
  // opinion 단계 (의견서 작성 — 기존 gate2+opinion 병합)
  claims_confirmed:{label:'청구항 확정',css:'status-drafting',g:'opinion'},drafting_opinion:{label:'의견서 작성 중',css:'status-drafting',g:'opinion'},opinion_drafted:{label:'의견서 초안',css:'status-gate',g:'opinion'},
  // output 단계 (최종 확인 + 출력 — 기존 gate3+output 병합)
  approved:{label:'최종 승인',css:'status-approved',g:'output'},generating_docs:{label:'문서 생성 중',css:'status-drafting',g:'output'},completed:{label:'완료',css:'status-completed',g:'output'}
};
Opinion.PIPELINE = {
  common_entry:[{key:'upload',label:'파일 업로드'},{key:'parse',label:'파싱'},{key:'type',label:'유형 판별'}],
  inventive_step:[{key:'strategy',label:'쟁점 분석'},{key:'draft',label:'청구항 보정'},{key:'opinion',label:'의견서 작성'}],
  description_deficiency:[{key:'strategy',label:'지적사항 분석'},{key:'draft',label:'청구항 수정'},{key:'opinion',label:'의견서 작성'}],
  partial_rejection:[{key:'strategy',label:'등록가능 식별'},{key:'draft',label:'병합 청구항'},{key:'opinion',label:'의견서 작성'}],
  common_exit:[{key:'output',label:'최종 확인'}]
};
Opinion.SYS_PROMPT = '너는 대한민국 특허청(KIPO) 의견제출통지서 대응 실무에 정통한 15년 차 수석 변리사이다.\n원칙:\n1. 한국 특허법 조항(§29, §42 등)에 근거하여 판단\n2. 특허청 표준 서식과 문체\n3. 명세서 뒷받침(신규사항 추가 금지) 최우선\n4. 인용발명 유래 용어 금지\n5. 구조화된 JSON 반환';

// ═══ 심사관+변리사 토론 형식 시스템 프롬프트 ═══
Opinion.DISCUSSION_SYS = '당신은 두 전문가 역할을 동시에 수행합니다:\n\n'
  +'👨‍⚖️ [심사관] (특허청 파트장, 20년 경력): 거절이유의 관점에서 엄격하게 검토합니다. 심사기준에 따라 출원의 약점을 지적하고, 인용발명과의 유사성을 분석합니다.\n\n'
  +'👨‍💼 [변리사] (수석 변리사, 20년 경력): 출원인의 관점에서 보정 전략을 수립합니다. 명세서 뒷받침을 확인하고, 인용발명과의 차이를 극대화하는 논리를 구성합니다.\n\n'
  +'두 전문가가 번갈아 대화하는 형식으로 분석하되, 최종 결론은 합의된 전략을 우선순위/추천순위에 따라 나열하세요.\n'
  +'대화 형식: [심사관] ... / [변리사] ... 으로 구분하세요.\n\n'
  +'원칙:\n1. 한국 특허법 조항(§29, §42 등)에 근거\n2. 명세서 뒷받침(신규사항 추가 금지) 최우선\n3. 인용발명 유래 용어 사용 금지\n4. 최종 합의된 결과는 구조화된 JSON으로 반환';

// ═══ 기본 의견서 양식 (코드 하드코딩 — 항상 존재) ═══
Opinion.DEFAULT_TEMPLATES = {
  inventive_step: {
    name: '진보성 위반 기본 양식',
    structure: '【의견내용】\n\n'
      +'서두: "상기 출원에 대한 의견제출통지서(발송일: YYYY.MM.DD)를 수령하였기에 아래와 같이 의견을 제출합니다."\n\n'
      +'1. 보정내용\n'
      +'  - 보정 개요 (어떤 청구항을 어떻게 보정했는지 요약)\n'
      +'  - 보정 청구항 전문\n\n'
      +'2. 보정의 적법성\n'
      +'  - 각 보정사항별 명세서 근거 단락 (【0001】형식으로 인용)\n'
      +'  - "상기 보정사항은 출원 시 명세서에 기재된 범위 내의 것으로 신규사항에 해당하지 않습니다"\n\n'
      +'3. 구체적 의견내용\n'
      +'  (1) 본원발명의 기술적 요지\n'
      +'  (2) 인용발명들의 기술적 요지 (인용발명별로 구분)\n'
      +'  (3) 본원발명과 인용발명의 대비\n'
      +'    가. 구성요소 ❶ [명칭] — 차이점 상세 논증\n'
      +'    나. 구성요소 ❷ [명칭] — 차이점 상세 논증\n'
      +'    ...\n'
      +'  (4) 결합의 용이성에 대한 반박\n'
      +'    ① 결합 동기 부재: "인용발명 1과 인용발명 2를 결합할 동기가 없음"\n'
      +'    ② 기술 분야의 상이: "인용발명들은 상이한 기술 분야에 속함"\n'
      +'    ③ 현저한 효과: "본원발명은 인용발명들로부터 예측할 수 없는 효과를 가짐"\n'
      +'  (5) 소결\n\n'
      +'4. 결론\n'
      +'  "이상과 같이 본원발명은 인용발명들로부터 당업자가 용이하게 발명할 수 없으므로, 특허등록되어야 합니다."',
    style_notes: '문체: ~합니다 경어체. 명세서 단락은 【0001】형식으로 인용. 구성요소는 ❶❷❸ 번호 사용. 각 논증은 3~5문장 이상으로 구체적으로.'
  },
  description_deficiency: {
    name: '기재불비 위반 기본 양식',
    structure: '【의견내용】\n\n'
      +'서두\n\n'
      +'1. 보정내용\n'
      +'  - 수정 전·후 대비표 형태로 기재\n\n'
      +'2. 보정의 적법성\n'
      +'  - 최초 명세서 범위 내 확인\n\n'
      +'3. 구체적 의견내용\n'
      +'  (1) 지적사항별 수정 내용\n'
      +'    가. "[지적1]"에 대하여 → 수정 내용 + 근거\n'
      +'    나. "[지적2]"에 대하여 → 수정 내용 + 근거\n'
      +'  (2) 수정에 의한 거절이유 해소 설명\n\n'
      +'4. 결론',
    style_notes: '문체: ~합니다 경어체. 지적사항 원문을 인용 후 수정 내용 설명.'
  },
  partial_rejection: {
    name: '일부 청구항 거절(병합) 기본 양식',
    structure: '【의견내용】\n\n'
      +'서두\n\n'
      +'1. 보정내용\n'
      +'  (1) 청구항 1은 청구항 N을 기초로 한정 보정\n'
      +'  (2) 청구항 N은 상기 병합에 따라 삭제\n'
      +'  (3) 종속항 번호 재정리\n\n'
      +'2. 보정의 적법성\n'
      +'  - 종속항 병합은 신규사항에 해당하지 않음\n\n'
      +'3. 구체적 의견내용\n'
      +'  (1) 본원발명의 기술적 요지\n'
      +'  (2) 인용발명의 기술적 요지\n'
      +'  (3) 병합된 구성의 차이점 논증\n'
      +'  (4) 소결\n\n'
      +'4. 결론',
    style_notes: '문체: ~합니다 경어체. 병합 사실을 명확히 기재. 등록가능 종속항의 구성이 인용발명에 없음을 논증.'
  }
};

// ═══ State ═══
Opinion.state = { projects:[], current:null, view:'list', viewStep:null, files:[], analysis:null, draftResult:null, validation:null, opinionDraft:null, typeResult:null, gateDecisions:{}, refText:'', customTemplate:null, _secondary_warned:false };

// ═══ 파이프라인 레벨 취소 토큰 (P2 #24) ═══
Opinion._currentRun = null; // AbortController instance

// ═══ localStorage 키 헬퍼 — user_id 격리 (P2 #25) ═══
Opinion._getTemplateKey = function(type) {
  var uid = (App.currentUser && App.currentUser.id) || 'anon';
  return 'opinion_user_' + uid + '_template_' + type;
};

// 구 키(user_id 미포함) → 신 키로 1회 마이그레이션 (P2 #25)
Opinion._migrateTemplateKeys = function() {
  var legacyTypes = ['inventive_step', 'description_deficiency'];
  var migrated = 0;
  legacyTypes.forEach(function(t) {
    var oldKey = 'opinion_template_' + t;
    var val = null;
    try { val = localStorage.getItem(oldKey); } catch(e) {}
    if (val) {
      var newKey = Opinion._getTemplateKey(t);
      try { localStorage.setItem(newKey, val); localStorage.removeItem(oldKey); migrated++; } catch(e) {}
    }
  });
  // 구 단일 커스텀 템플릿 → inventive_step 신 키로 이전 (이미 신 키가 없을 때만)
  var oldCustom = null;
  try { oldCustom = localStorage.getItem('opinion_custom_template'); } catch(e) {}
  if (oldCustom) {
    var newKey = Opinion._getTemplateKey('inventive_step');
    var existing = null;
    try { existing = localStorage.getItem(newKey); } catch(e) {}
    if (!existing) {
      try { localStorage.setItem(newKey, oldCustom); migrated++; } catch(e) {}
    }
    try { localStorage.removeItem('opinion_custom_template'); } catch(e) {}
  }
  if (migrated > 0) {
    console.log('[Opinion.migrate] localStorage keys migrated: ' + migrated + ' items');
    showToast('템플릿이 사용자별 저장소로 이전되었습니다', 'info');
  }
};

// ═══ 프로젝트 라이프사이클 초기화 (P1 #23 + P2 #7 + 추가관찰) ═══
// keepProjectId:true 이면 state.current 유지 (재분석 등 동일 프로젝트 내 재실행 시)
Opinion.resetState = function(opts) {
  opts = opts || {};
  var keepProjectId = opts.keepProjectId === true;

  // 진행 중인 파이프라인 취소 (P2 #24)
  if (Opinion._currentRun) {
    Opinion._currentRun.abort();
    Opinion._currentRun = null;
  }

  // 파이프라인 결과 상태 초기화
  Opinion.state.files             = [];
  Opinion.state.parsed            = null;
  Opinion.state.analysis          = null;
  Opinion.state.draftResult       = null;
  Opinion.state.validation        = null;
  Opinion.state.opinionDraft      = null;
  Opinion.state.typeResult        = null;
  Opinion.state._strategies       = null;
  Opinion.state.selectedStrategy  = null;
  Opinion.state.selectedStrategyIndex = null;
  Opinion.state._typeNeedsManual  = false; // Cycle 1 플래그
  Opinion.state._secondary_warned = false; // Cycle 3 혼합 거절 확인 플래그
  Opinion.state.parseFailDetail   = null;
  Opinion.state.lastRevisionNote  = '';
  Opinion.state.gateDecisions     = {};
  Opinion.state.viewStep          = null;
  if (!keepProjectId) Opinion.state.current = null;

  // API 사용량 리셋
  Opinion.usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

  console.log('[Opinion.reset] cleared state, files, usage');
};

// ═══ 명세서 원문 추출 (DB raw_text 또는 state.files에서) — 사이클 2 ═══
// raw_text는 startParsing에서 '=== [📑 출원 명세서: ...] ===' 구분자로 섹션화되어 저장됨
Opinion.extractSpecificationText = async function(projectId) {
  try {
    var{data:pd}=await sb.from('opinion_parsed_documents').select('raw_text').eq('project_id',projectId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (!pd || !pd.raw_text) return '';
    var raw = pd.raw_text;
    // '=== [📑 출원 명세서: ...] ===' 다음 섹션부터 다음 '===' 또는 '##########'까지
    var specStart = raw.search(/===\s*\[📑\s*출원\s*명세서[^\]]*\]\s*===/);
    if (specStart < 0) {
      // 폴백: '명세서' 키워드만으로 찾기
      specStart = raw.search(/===\s*\[[^\]]*명세서[^\]]*\]\s*===/);
    }
    if (specStart < 0) return ''; // 명세서 미발견
    var afterHeader = raw.slice(specStart).replace(/^===\s*\[[^\]]+\]\s*===\s*/, '');
    // 다음 구분자까지 잘라냄
    var nextDelim = afterHeader.search(/(===\s*\[|##########)/);
    return nextDelim > 0 ? afterHeader.slice(0, nextDelim).trim() : afterHeader.trim();
  } catch(e) { console.warn('[Opinion] extractSpecificationText failed:', e); return ''; }
};

// ═══ spec_basis 명세서 원문 cross-check (P0 #17) ═══
// amendedClaims: [{claim_no, spec_basis: ["【0010】","【0065】"] | "..."}]
// specRawText: 명세서 원문 string
// 반환: { ok: true|false|null, missing: [{claim_no, missing_paragraphs}], reason? }
Opinion._validateSpecBasis = function(amendedClaims, specRawText) {
  if (!specRawText || specRawText.length < 50) {
    return { ok: null, reason: 'specification_missing', missing: [] };
  }
  if (!Array.isArray(amendedClaims) || !amendedClaims.length) {
    return { ok: true, missing: [] };
  }
  var missing = [];
  // 단락번호 정규화 헬퍼: 【0010】, [0010], 0010 모두 4자리 숫자로 통일
  function _normalize(p) {
    var m = String(p).match(/(\d{1,4})/);
    if (!m) return null;
    return ('0000' + m[1]).slice(-4); // 4자리 패딩
  }
  // 명세서 원문에서 등장하는 모든 단락번호를 수집
  var specParagraphsSet = {};
  var pat = /[【\[]\s*(\d{1,4})\s*[】\]]/g;
  var sm;
  while ((sm = pat.exec(specRawText)) !== null) {
    specParagraphsSet[_normalize(sm[1])] = true;
  }

  amendedClaims.forEach(function(ac) {
    var basisRaw = ac.spec_basis || ac.spec_paragraphs || [];
    var basisList = Array.isArray(basisRaw) ? basisRaw : String(basisRaw).split(/[,，]/);
    var miss = [];
    basisList.forEach(function(b) {
      var norm = _normalize(b);
      if (!norm) return; // 번호가 없으면 검증 대상 아님
      if (!specParagraphsSet[norm]) {
        miss.push('【' + norm + '】');
      }
    });
    if (miss.length) {
      missing.push({ claim_no: ac.claim_no, missing_paragraphs: miss });
    }
  });
  return { ok: missing.length === 0, missing: missing };
};

// ═══ 청구항 보존 검증 (Cycle 4 P1 #21) ═══
// 미거절 청구항이 amended_claims에 임의로 변경/누락됐는지 검증.
// inputs:
//   originalClaims: parsed.claims = [{no, text}]
//   draftResult: {amended_claims, corrected_claims, merged_claim, unchanged_claims, remaining_claims, deleted_claims}
//   rejectedNos: [N,...] (parsed.rejection_reasons에서 평탄화)
// returns: { ok: bool, issues: [{type, claim_no, detail}] }
Opinion._validateClaimPreservation = function(originalClaims, draftResult, rejectedNos) {
  var issues = [];
  if (!originalClaims || !originalClaims.length) return { ok: null, issues: [], reason: 'no_original_claims' };
  var dr = draftResult || {};
  var rejSet = {}; (rejectedNos || []).forEach(function(n){ rejSet[n] = true; });

  // 보정 결과의 청구항 번호 집합
  var amendedSet = {};
  var amendedArr = dr.amended_claims || dr.corrected_claims || (dr.merged_claim ? [dr.merged_claim] : []);
  amendedArr.forEach(function(ac){ if (ac && ac.claim_no != null) amendedSet[ac.claim_no] = ac; });

  // unchanged_claims 또는 remaining_claims에서 보존 청구항 추출
  var unchangedNos = [];
  if (Array.isArray(dr.unchanged_claims)) unchangedNos = dr.unchanged_claims.slice();
  else if (Array.isArray(dr.remaining_claims)) unchangedNos = dr.remaining_claims.filter(function(rc){ return rc && rc.changed === false; }).map(function(rc){ return rc.new_no || rc.old_no; });

  // [검증 1] 미거절 청구항이 amended_claims에 포함되어 있는지 (LLM이 임의 수정한 의심)
  Object.keys(amendedSet).forEach(function(noStr){
    var no = parseInt(noStr, 10);
    if (!rejSet[no]) {
      issues.push({ type: 'unrejected_claim_amended', claim_no: no, detail: '미거절 청구항 ' + no + '이 보정 결과에 포함됨' });
    }
  });

  // [검증 2] 거절되지 않은 원 청구항이 unchanged_claims에서도 누락됐는지 (보존 누락)
  var unchangedSet = {}; unchangedNos.forEach(function(n){ unchangedSet[n] = true; });
  originalClaims.forEach(function(oc){
    var no = oc.no;
    if (!rejSet[no] && !amendedSet[no] && !unchangedSet[no]) {
      issues.push({ type: 'unchanged_claim_missing', claim_no: no, detail: '미거절 청구항 ' + no + '이 보정 결과에 누락됨 (unchanged_claims에도 없음)' });
    }
  });

  return { ok: issues.length === 0, issues: issues };
};

// ═══ 청구항 인용관계 검증 (Cycle 4 P1 #22) ═══
// 종속항이 인용하는 청구항 번호가 실제 존재하는지 + 자기/순환 인용 검출.
// inputs: finalClaims = [{no, text}]
// returns: { ok: bool, issues: [{claim_no, references_to, problem}] }
Opinion._validateClaimReferences = function(finalClaims) {
  var issues = [];
  if (!finalClaims || !finalClaims.length) return { ok: null, issues: [], reason: 'no_claims' };
  var noSet = {}; finalClaims.forEach(function(c){ if (c && c.no != null) noSet[c.no] = true; });
  // 인용 그래프
  var graph = {};
  finalClaims.forEach(function(c){
    if (!c || !c.text) return;
    var refs = Opinion._extractClaimReferences(c.text);
    graph[c.no] = refs;
    refs.forEach(function(r){
      if (r === c.no) {
        issues.push({ claim_no: c.no, references_to: r, problem: 'self' });
      } else if (!noSet[r]) {
        issues.push({ claim_no: c.no, references_to: r, problem: 'missing' });
      }
    });
  });
  // 순환 인용 검출 (간단 DFS)
  function detectCycle(start) {
    var stack = [[start, [start]]];
    var visited = {};
    while (stack.length) {
      var pair = stack.pop(); var n = pair[0]; var path = pair[1];
      if (visited[n]) continue;
      var refs = graph[n] || [];
      for (var i = 0; i < refs.length; i++) {
        var r = refs[i];
        if (path.indexOf(r) >= 0) {
          issues.push({ claim_no: start, references_to: r, problem: 'circular' });
          return;
        }
        stack.push([r, path.concat(r)]);
      }
      visited[n] = true;
    }
  }
  Object.keys(graph).forEach(function(k){ detectCycle(parseInt(k, 10)); });

  return { ok: issues.length === 0, issues: issues };
};

// 청구항 텍스트에서 "제 N항", "청구항 N", "청구항 제 N항" 패턴 추출
Opinion._extractClaimReferences = function(text) {
  if (!text) return [];
  var refs = {};
  var re = /제\s*(\d+)\s*항|청구항\s*(?:제\s*)?(\d+)/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var n = parseInt(m[1] || m[2], 10);
    if (n > 0) refs[n] = true;
  }
  return Object.keys(refs).map(function(s){ return parseInt(s, 10); });
};

// ═══ Init ═══
Opinion.init = function(){
  console.log('[Opinion] init');
  Opinion._migrateTemplateKeys(); // 구 키 → 신 키 1회 마이그레이션
  Opinion.loadProjects();
  Opinion.loadSavedTemplate();
};

// ═══ Template Management (유형별 템플릿 지원) ═══
Opinion.loadSavedTemplate = async function() {
  // 유형별 템플릿 로드
  var types = ['inventive_step','description_deficiency'];
  if (!Opinion.state.templates) Opinion.state.templates = {};

  for (var i = 0; i < types.length; i++) {
    var tKey = 'template_' + types[i];
    var loaded = false;

    // 1차: Supabase DB
    try {
      var {data} = await sb.from('opinion_user_settings')
        .select('setting_value')
        .eq('user_id', currentUser.id)
        .eq('setting_key', tKey)
        .maybeSingle();
      if (data && data.setting_value && data.setting_value.text) {
        Opinion.state.templates[types[i]] = data.setting_value;
        loaded = true;
        try { localStorage.setItem(Opinion._getTemplateKey(types[i]), JSON.stringify(data.setting_value)); } catch(e){}
      }
    } catch(e) {}

    // 2차: localStorage (신 키 우선)
    if (!loaded) {
      try {
        var saved = localStorage.getItem(Opinion._getTemplateKey(types[i]));
        if (saved) {
          var parsed = JSON.parse(saved);
          if (parsed && parsed.text) {
            Opinion.state.templates[types[i]] = parsed;
            loaded = true;
          }
        }
      } catch(le) {}
    }
  }

  // 하위 호환: 기존 단일 custom_template이 있으면 inventive_step으로 매핑
  if (!Opinion.state.templates.inventive_step) {
    try {
      var {data:old} = await sb.from('opinion_user_settings')
        .select('setting_value').eq('user_id', currentUser.id)
        .eq('setting_key', 'custom_template').maybeSingle();
      if (old && old.setting_value && old.setting_value.text) {
        Opinion.state.templates.inventive_step = old.setting_value;
        Opinion.state.customTemplate = old.setting_value;
        Opinion.state.refText = old.setting_value.text || '';
      }
    } catch(e) {}
    if (!Opinion.state.templates.inventive_step) {
      try {
        var oldLocal = localStorage.getItem('opinion_custom_template');
        if (oldLocal) {
          var p = JSON.parse(oldLocal);
          if (p && p.text) { Opinion.state.templates.inventive_step = p; Opinion.state.customTemplate = p; Opinion.state.refText = p.text; }
        }
      } catch(e){}
    }
  }

  // 하위 호환 state 유지
  if (Opinion.state.templates.inventive_step) {
    Opinion.state.customTemplate = Opinion.state.templates.inventive_step;
    Opinion.state.refText = Opinion.state.templates.inventive_step.text || '';
  }

  Opinion.updateTemplateStatus();
};

Opinion.saveTemplate = async function(name, text, type) {
  type = type || 'inventive_step';
  var template = { name: name, text: text, saved_at: new Date().toISOString(), type: type };
  var tKey = 'template_' + type;

  try { localStorage.setItem(Opinion._getTemplateKey(type), JSON.stringify(template)); } catch(e){}

  try {
    await sb.from('opinion_user_settings').upsert({
      user_id: currentUser.id,
      setting_key: tKey,
      setting_value: template
    }, { onConflict: 'user_id,setting_key' });
  } catch(e) {
    console.warn('[Opinion] DB save failed (localStorage OK):', e.message);
  }

  if (!Opinion.state.templates) Opinion.state.templates = {};
  Opinion.state.templates[type] = template;

  // 하위 호환
  if (type === 'inventive_step') {
    Opinion.state.customTemplate = template;
    Opinion.state.refText = text;
  }
  Opinion.updateTemplateStatus();
  var typeLabel = type === 'inventive_step' ? '진보성/신규성' : '기재불비';
  showToast(typeLabel + ' 양식이 저장되었습니다.');
};

Opinion.clearTemplate = async function(type) {
  type = type || 'inventive_step';
  var tKey = 'template_' + type;
  try { await sb.from('opinion_user_settings').delete().eq('user_id', currentUser.id).eq('setting_key', tKey); } catch(e) {}
  try { localStorage.removeItem(Opinion._getTemplateKey(type)); } catch(e) {}
  if (Opinion.state.templates) delete Opinion.state.templates[type];
  if (type === 'inventive_step') { Opinion.state.customTemplate = null; Opinion.state.refText = ''; }
  Opinion.updateTemplateStatus();
  showToast('양식이 제거되었습니다. 기본 양식이 사용됩니다.');
};

Opinion.updateTemplateStatus = function() {
  var el = document.getElementById('opinionTemplateStatus');
  if (!el) return;
  var templates = Opinion.state.templates || {};
  var h = '';

  // 진보성/신규성 템플릿
  var invTpl = templates.inventive_step;
  if (invTpl) {
    h += '<div style="margin-bottom:8px;padding:6px 8px;background:#eff6ff;border-radius:6px;border-left:3px solid var(--color-primary)">'
      +'<div style="font-size:11px;color:var(--color-primary);font-weight:600">⚖️ 진보성/신규성</div>'
      +'<div style="font-size:10px;color:var(--color-text-tertiary)">'+escapeHtml(invTpl.name||'커스텀')+' ('+Math.round((invTpl.text||'').length/1000)+'K자)</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="Opinion.clearTemplate(\'inventive_step\')" style="font-size:10px;color:var(--color-error);padding:2px 6px;margin-top:2px">✕ 제거</button></div>';
  }

  // 기재불비 템플릿
  var defTpl = templates.description_deficiency;
  if (defTpl) {
    h += '<div style="margin-bottom:8px;padding:6px 8px;background:#fef3c7;border-radius:6px;border-left:3px solid var(--color-warning)">'
      +'<div style="font-size:11px;color:#92400e;font-weight:600">📝 기재불비</div>'
      +'<div style="font-size:10px;color:var(--color-text-tertiary)">'+escapeHtml(defTpl.name||'커스텀')+' ('+Math.round((defTpl.text||'').length/1000)+'K자)</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="Opinion.clearTemplate(\'description_deficiency\')" style="font-size:10px;color:var(--color-error);padding:2px 6px;margin-top:2px">✕ 제거</button></div>';
  }

  if (!invTpl && !defTpl) {
    h = '<span style="color:var(--color-primary)">📋 기본 양식 사용 중</span>'
      + '<br><span style="font-size:10px;color:var(--color-text-tertiary)">유형별 표준 구조가 자동 적용됩니다</span>';
  }

  el.innerHTML = h;
};

Opinion.handleRefUpload = async function(event, type) {
  var file = event.target.files[0];
  if (!file) return;
  type = type || 'inventive_step';
  try {
    var text = await extractTextFromFile(file);
    if (!text || text.length < 50) { showToast('파일에서 텍스트를 충분히 추출할 수 없습니다', 'error'); return; }
    await Opinion.saveTemplate(file.name, text, type);
  } catch(e) { showToast('파일 읽기 실패: ' + e.message, 'error'); }
  event.target.value = '';
};

// 현재 활성 양식 텍스트 가져오기 (유형별 커스텀 > 기본)
Opinion.getActiveTemplate = function(type) {
  var templates = Opinion.state.templates || {};
  // 유형별 템플릿이 있으면 해당 유형 사용
  if (templates[type] && templates[type].text) {
    return Opinion.sanitizeTemplate(templates[type].text, type);
  }
  // 하위 호환: 기존 단일 커스텀 템플릿
  if (Opinion.state.customTemplate && Opinion.state.customTemplate.text) {
    return Opinion.sanitizeTemplate(Opinion.state.customTemplate.text, type);
  }
  var def = Opinion.DEFAULT_TEMPLATES[type] || Opinion.DEFAULT_TEMPLATES.inventive_step;
  return '[의견서 작성 양식]\n구조:\n' + def.structure + '\n\n작성 지침: ' + def.style_notes;
};

// ★ 참고 양식 정제 — 톤/구조/문장패턴만 추출, 사건 내용 제거 ★
Opinion.sanitizeTemplate = function(rawText, type) {
  var def = Opinion.DEFAULT_TEMPLATES[type] || Opinion.DEFAULT_TEMPLATES.inventive_step;

  // 1단계: 구조 패턴 추출 (섹션 제목, 번호 체계)
  var lines = rawText.split('\n');
  var structurePatterns = [];
  var styleExamples = [];
  var headingPattern = /^(\s*)([\d\.\(\)가-힣①-⑳❶-❿]+[\.\)]\s*.{2,40})$/;
  var kwPattern = /^(\s*)(【[^】]+】|서두|보정내용|적법성|의견내용|결론|소결)/;

  lines.forEach(function(line) {
    var trimmed = line.trim();
    // 섹션 제목/번호 구조
    if (headingPattern.test(trimmed) || kwPattern.test(trimmed)) {
      structurePatterns.push(trimmed);
    }
    // 문체 패턴 (짧은 연결어/관용구만 — 실질 내용 제외)
    else if (trimmed.length > 10 && trimmed.length < 80) {
      if (/^(이상과 같이|상기|따라서|그러므로|살펴보면|검토하면|대비하면|종합하면|결론적으로|이에|아래와 같이|상기 출원|수령하였기에)/.test(trimmed)) {
        styleExamples.push(trimmed.slice(0, 60));
      }
    }
  });

  // 2단계: 조립 — 실제 사건 내용은 절대 포함하지 않음
  var result = '[참고 의견서 양식 — 톤/구조만 참고, 내용 사용 금지]\n\n';
  result += '기본 구조:\n' + def.structure + '\n\n';

  if (structurePatterns.length > 0) {
    result += '참고 양식의 섹션 구조:\n' + structurePatterns.slice(0, 20).join('\n') + '\n\n';
  }

  if (styleExamples.length > 0) {
    result += '참고 양식의 문체 패턴 (톤 참고용):\n' + styleExamples.slice(0, 10).join('\n') + '\n\n';
  }

  result += '작성 지침: ' + def.style_notes;

  return result;
};

// ★ 양식 내용 오염 검증 — 의견서 생성 후 실행 ★
Opinion.validateNoTemplateContamination = function(opinionText) {
  if (!Opinion.state.customTemplate || !Opinion.state.customTemplate.text) return { clean: true, warnings: [] };

  var templateText = Opinion.state.customTemplate.text;
  var warnings = [];

  // 참고 양식에서 5단어 이상 연속 일치하는 구절 검출
  // (구조적 관용구는 제외: 서두, 결론 등)
  var SAFE_PHRASES = [
    '의견을 제출합니다','특허등록되어야','신규사항에 해당하지','보정의 적법성',
    '보정내용','구체적 의견내용','결론','서두','소결','기술적 요지',
    '인용발명','본원발명','구성요소','결합의 용이성','명세서에 기재된 범위'
  ];

  // 참고 양식에서 30자 이상 의미 있는 문장 추출
  var templateSentences = templateText.split(/[.\n]/).filter(function(s) {
    var t = s.trim();
    return t.length >= 30 && !/^[\s\d\.\(\)【】가-힣①-⑳❶-❿:]+$/.test(t);
  });

  templateSentences.forEach(function(sentence) {
    var trimmed = sentence.trim().slice(0, 80);
    // 안전 구절이면 스킵
    var isSafe = SAFE_PHRASES.some(function(sp) { return trimmed.indexOf(sp) >= 0; });
    if (isSafe) return;

    // 의견서에 유사 구절이 있는지 검사 (20자 이상 연속 일치)
    for (var len = 20; len <= Math.min(trimmed.length, 50); len++) {
      var chunk = trimmed.slice(0, len);
      if (opinionText.indexOf(chunk) >= 0) {
        warnings.push({
          type: 'content_leak',
          template_fragment: trimmed.slice(0, 60) + '...',
          match_length: len
        });
        break;
      }
    }
  });

  return {
    clean: warnings.length === 0,
    warnings: warnings
  };
};

// ═══ Sub-Tab ═══
App.switchPatentSubTab = function(sub){
  document.querySelectorAll('.patent-sub-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.subtab===sub); });
  document.querySelectorAll('.patent-sub-panel').forEach(function(p){ p.classList.remove('active'); });
  var el=document.getElementById('patent-sub-'+sub); if(el) el.classList.add('active');
  if(sub==='opinion') Opinion.init();
  if(sub==='division' && window.Division) Division.init();
  history.replaceState(null,'','#patent-'+sub);
};

// ═══════════════════════════════════════════
// 1. 프로젝트 목록
// ═══════════════════════════════════════════
Opinion.loadProjects = async function(){
  var el=document.getElementById('opinionProjectList'); if(!el)return;
  try {
    var {data,error}=await sb.from('opinion_projects').select('*').eq('created_by',currentUser.id).order('updated_at',{ascending:false});
    if(error)throw error;
    Opinion.state.projects=data||[];
  } catch(e){ console.error('[Opinion] load:',e); Opinion.state.projects=[]; }
  Opinion.renderList();
};

Opinion.renderList = function(){
  var el=document.getElementById('opinionProjectList'), cnt=document.getElementById('opinionProjectCount');
  if(!el)return;
  var ps=Opinion.state.projects;
  if(cnt) cnt.textContent='총 '+ps.length+'건';
  if(!ps.length){ el.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px"><div style="font-size:32px;margin-bottom:8px"><span class="tf">📭</span></div>의견서 대응 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 의견제출통지서에 대응하세요.</span></td></tr>'; return; }
  el.innerHTML=ps.map(function(p){
    var t=Opinion.TYPES[p.rejection_type]||{code:'?',label:'미정',css:'type-unknown',icon:'❓'};
    var s=Opinion.STATUS[p.status]||{label:p.status,css:'status-created'};
    var d=p.updated_at?new Date(p.updated_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'-';
    var dl=p.deadline_date?new Date(p.deadline_date).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'-';
    return '<tr style="border-bottom:1px solid var(--color-divider);cursor:pointer" onclick="Opinion.open(\''+p.id+'\')">'
      +'<td style="padding:10px 12px;font-weight:600;font-size:12px;color:var(--color-primary)">'+escapeHtml(p.application_no||'-')+'</td>'
      +'<td style="padding:10px 12px"><div style="font-size:13px;font-weight:500">'+escapeHtml(p.title||'무제')+'</div><div style="margin-top:3px"><span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span></div></td>'
      +'<td style="padding:10px 12px;text-align:center"><span class="opinion-status-badge '+s.css+'">'+s.label+'</span></td>'
      +'<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-secondary)">'+dl+'</td>'
      +'<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-tertiary)">'+d+'</td>'
      +'<td style="padding:10px 12px;text-align:center"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Opinion.del(\''+p.id+'\')" style="font-size:11px;color:var(--color-error)">삭제</button></td></tr>';
  }).join('');
};

// ═══════════════════════════════════════════
// 2. 생성 / 삭제
// ═══════════════════════════════════════════
Opinion.openCreateModal = function(){ document.getElementById('opinionCreateModal').style.display='flex'; };
Opinion.closeCreateModal = function(){ document.getElementById('opinionCreateModal').style.display='none'; };

Opinion.create = async function(){
  var title=(document.getElementById('opinionNewTitle').value||'').trim();
  var appNo=(document.getElementById('opinionNewAppNo').value||'').trim();
  var deadline=(document.getElementById('opinionNewDeadline').value||'').trim();
  if(!title){showToast('사건명을 입력해 주세요','error');return;}
  try{
    var {data,error}=await sb.from('opinion_projects').insert({title:title,application_no:appNo||'',status:'created',rejection_type:'inventive_step',deadline_date:deadline||null,created_by:currentUser.id,expert_id:currentUser.id}).select().single();
    if(error)throw error;
    showToast('프로젝트가 생성되었습니다');
    Opinion.closeCreateModal();
    Opinion.state.projects.unshift(data);
    Opinion.renderList();
    Opinion.open(data.id);
  }catch(e){showToast('생성 실패: '+e.message,'error');}
};

Opinion.del = async function(id){
  if(!confirm('이 프로젝트를 삭제하시겠습니까?'))return;
  try{ await sb.from('opinion_projects').delete().eq('id',id);
    Opinion.state.projects=Opinion.state.projects.filter(function(p){return p.id!==id;});
    Opinion.renderList(); showToast('삭제됨');
  }catch(e){showToast('삭제 실패','error');}
};

// ═══════════════════════════════════════════
// 3. 프로젝트 상세
// ═══════════════════════════════════════════
Opinion.open = async function(id){
  // 이전 프로젝트 메모리·파일·usage 초기화 + 진행 중 비동기 작업 취소 (P1 #23, P2 #7, #24)
  Opinion.resetState({ keepProjectId: false });

  var p=Opinion.state.projects.find(function(x){return x.id===id;});
  if(!p){showToast('프로젝트를 찾을 수 없습니다','error');return;}
  Opinion.state.current=p; Opinion.state.view='detail'; Opinion.state.viewStep=null;

  // 새 파이프라인 실행 토큰 발급 (P2 #24)
  Opinion._currentRun = new AbortController();

  document.getElementById('opinionListView').style.display='none';
  document.getElementById('opinionDetailView').style.display='block';
  Opinion.renderDetail();
  await Opinion.loadData(id);
};

Opinion.backToList = function(){
  // 이전 프로젝트 상태·진행 중 작업 모두 초기화 (P1 #23, P2 #24)
  Opinion.resetState({ keepProjectId: false });
  Opinion.state.view='list';
  document.getElementById('opinionDetailView').style.display='none';
  document.getElementById('opinionListView').style.display='block';
  Opinion.loadProjects();
};

Opinion.renderDetail = function(){
  var p=Opinion.state.current; if(!p)return;
  var t=Opinion.TYPES[p.rejection_type]||{code:'?',label:'미정',css:'type-unknown',icon:'❓'};
  var s=Opinion.STATUS[p.status]||{label:p.status,css:'status-created'};
  document.getElementById('opinionDetailTitle').textContent=p.title||'무제';
  document.getElementById('opinionDetailAppNo').textContent=p.application_no||'-';
  document.getElementById('opinionDetailType').innerHTML='<span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span>';
  document.getElementById('opinionDetailStatus').innerHTML='<span class="opinion-status-badge '+s.css+'">'+s.label+'</span> <span id="opinionUsage" style="font-size:11px;color:var(--color-text-tertiary);margin-left:8px"></span>';
  Opinion.updateUsageDisplay();
  Opinion.renderPipeline(p);
  Opinion.renderMain(p);
};

// ═══ Step ↔ Status 매핑 (7단계 파이프라인) ═══
Opinion.STEP_GROUP = {upload:0,parse:0,type:0,strategy:1,draft:2,opinion:3,output:4};
Opinion.GROUP_ORDER = ['init','strategy','draft','opinion','output'];

// step key → 해당 단계의 "완료" 상태 (뷰 전환용)
Opinion.STEP_TO_VIEW_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'parsed', type:'type_determined',
    strategy: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    draft: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    opinion:'opinion_drafted', output:'completed'
  };
  return map[stepKey] || 'created';
};

// step key → 해당 단계의 "시작" 상태 (되돌리기용)
Opinion.STEP_TO_RESET_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'created', type:'parsed',
    strategy:'type_determined',
    draft: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    opinion: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    output:'opinion_drafted'
  };
  return map[stepKey] || 'created';
};

Opinion.renderPipeline = function(p){
  var el=document.getElementById('opinionPipeline'); if(!el)return;
  var type=p.rejection_type||'inventive_step';
  var steps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var viewStep=Opinion.state.viewStep;
  var h='';
  steps.forEach(function(step,i){
    var si=Opinion.STEP_GROUP[step.key]!==undefined?Opinion.STEP_GROUP[step.key]:-1;
    var st=si<ci?'done':si===ci?'active':'pending';
    var isViewing = viewStep===step.key;
    var clickable = st==='done' || st==='active';
    if(i>0) h+='<div class="opinion-step-connector '+(st==='done'?'done':'')+'"></div>';
    h+='<div class="opinion-step '+st+(isViewing?' viewing':'')+'"'
      +(clickable?' onclick="Opinion.goToStep(\''+step.key+'\')" style="cursor:pointer"':'')+'>'
      +'<div class="opinion-step-dot">'+(st==='done'?'✓':String(i+1))+'</div>'
      +'<span class="opinion-step-label">'+step.label+'</span>'
      +'</div>';
  });
  el.innerHTML=h;
};

// ═══ 파이프라인 스텝 클릭 → 해당 단계 뷰 전환 ═══
Opinion.goToStep = function(stepKey) {
  var p=Opinion.state.current; if(!p)return;
  var type=p.rejection_type||'inventive_step';
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var si=Opinion.STEP_GROUP[stepKey]!==undefined?Opinion.STEP_GROUP[stepKey]:-1;

  // 현재 단계이거나 미래 단계 → viewStep 해제 (현재 상태 그대로 표시)
  if(si>=ci) { Opinion.state.viewStep=null; Opinion.renderDetail(); return; }

  // 과거 단계 → viewStep 설정하여 과거 뷰 표시
  Opinion.state.viewStep=stepKey;
  Opinion.renderDetail();
};

// ═══ 현재 단계로 돌아가기 ═══
Opinion.goToCurrent = function() {
  Opinion.state.viewStep=null;
  Opinion.renderDetail();
};

// ═══ 이전 단계로 되돌리기 (상태 롤백) ═══
Opinion.rollbackToStep = async function(stepKey) {
  var p=Opinion.state.current; if(!p)return;
  var type=p.rejection_type||'inventive_step';
  var targetStatus = Opinion.STEP_TO_RESET_STATUS(stepKey, type);
  var stepLabel = '';
  var allSteps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  allSteps.forEach(function(s){ if(s.key===stepKey) stepLabel=s.label; });

  if(!confirm('프로젝트를 "'+stepLabel+'" 단계로 되돌리시겠습니까?\n해당 단계 이후의 진행 상태가 초기화됩니다.'))return;

  try{
    await Opinion.setStatus(p.id, targetStatus);
    Opinion.state.viewStep=null;
    showToast('"'+stepLabel+'" 단계로 되돌렸습니다');
    Opinion.renderDetail();
  }catch(e){showToast('되돌리기 실패','error');}
};

// ═══ 네비게이션 바 HTML 생성 (각 화면 상단에 삽입) ═══
Opinion.renderNavBar = function(currentStepKey) {
  var p=Opinion.state.current; if(!p) return '';
  var type=p.rejection_type||'inventive_step';
  var allSteps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var si=Opinion.STEP_GROUP[currentStepKey]!==undefined?Opinion.STEP_GROUP[currentStepKey]:-1;
  var isViewingPast = Opinion.state.viewStep !== null;

  // 이전/다음 스텝 찾기
  var currentIdx=-1;
  allSteps.forEach(function(s,i){ if(s.key===currentStepKey) currentIdx=i; });
  var prevStep = currentIdx>0 ? allSteps[currentIdx-1] : null;
  var prevClickable = prevStep && (Opinion.STEP_GROUP[prevStep.key]<ci);

  var h='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';

  // 이전 단계 보기
  if(prevClickable) {
    h+='<button class="btn btn-ghost btn-sm" onclick="Opinion.goToStep(\''+prevStep.key+'\')" style="font-size:12px">'
      +'<span class="tf">←</span> '+prevStep.label+'</button>';
  }

  // 현재 단계로 돌아가기 (과거 뷰일 때만)
  if(isViewingPast) {
    h+='<button class="btn btn-primary btn-sm" onclick="Opinion.goToCurrent()" style="font-size:12px">'
      +'<span class="tf">▶</span> 현재 단계로</button>';
  }

  // 이 단계로 되돌리기 (과거 뷰일 때, 해당 단계부터 다시 시작)
  if(isViewingPast && si < ci) {
    h+='<button class="btn btn-outline btn-sm" onclick="Opinion.rollbackToStep(\''+currentStepKey+'\')" style="font-size:12px;color:var(--color-warning);border-color:var(--color-warning)">'
      +'<span class="tf">↩️</span> 여기서 다시 시작</button>';
  }

  // 파일 추가 (어느 단계에서든 파일 업로드 단계로 되돌릴 수 있음)
  if(!isViewingPast && currentStepKey !== 'upload' && si > 0) {
    h+='<button class="btn btn-ghost btn-sm" onclick="Opinion.rollbackToStep(\'upload\')" style="font-size:11px;margin-left:auto">'
      +'<span class="tf">📎</span> 파일 추가/재업로드</button>';
  }

  h+='</div>';
  return h;
};

// ═══════════════════════════════════════════
// 4. 상태별 메인 콘텐츠 (viewStep 오버라이드 지원)
// ═══════════════════════════════════════════
Opinion.renderMain = function(p){
  var L=document.getElementById('opinionDetailLeft'), R=document.getElementById('opinionDetailRight');
  if(!L||!R)return;

  // viewStep이 설정되어 있으면 해당 단계의 뷰를 표시
  var viewStep=Opinion.state.viewStep;
  var s = viewStep ? Opinion.STEP_TO_VIEW_STATUS(viewStep, p.rejection_type) : p.status;

  if(s==='created') return Opinion.renderUpload(L,R);
  if(s==='parsing') return Opinion.renderLoading(L,R,'문서 파싱 중...','PDF에서 텍스트를 추출하고 있습니다');
  if(s==='parsed') return Opinion.renderParsed(L,R);
  if(s==='parse_failed') return Opinion.renderFailed(L,R);
  if(s==='type_determined') return Opinion.renderTypeView(L,R);
  // strategy 단계 (쟁점 분석 + 전략 수립)
  if(['analyzing','analyzed','deficiency_analyzed','allowable_identified','strategy_confirmed','correction_confirmed','merge_confirmed'].indexOf(s)>=0) return Opinion.renderStrategy(L,R,s);
  // draft 단계 (청구항 보정 + 검증 일체)
  if(['drafting_claims','drafting_corrections','drafting_merge','claims_drafted','corrections_drafted','merge_drafted','validating','validated','correction_validated','merge_validated'].indexOf(s)>=0) return Opinion.renderDraft(L,R,s);
  // opinion 단계 (의견서 작성)
  if(['claims_confirmed','drafting_opinion','opinion_drafted'].indexOf(s)>=0) return Opinion.renderOpinion(L,R,s);
  // output 단계 (최종 확인 + 출력)
  if(['approved','generating_docs','completed'].indexOf(s)>=0) return Opinion.renderOutput(L,R,s);
  Opinion.renderUpload(L,R);
};

Opinion.renderLoading = function(L,R,title,desc){
  L.innerHTML='<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">'+title+'</div><p style="font-size:12px;color:var(--color-text-tertiary);margin-top:6px">'+desc+'</p></div>';
  R.innerHTML='';
};

// ═══════════════════════════════════════════
// 5. 파일 업로드 + 수동 텍스트 입력
// ═══════════════════════════════════════════
Opinion.renderUpload = function(L,R){
  if(!Opinion.state.files) Opinion.state.files=[];
  // 기존 파일 유지 (재진입 시 초기화 방지)

  L.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tf">📁</span> 파일 업로드</div></div>'
    +'<div class="opinion-upload-zone" id="opinionUploadZone" onclick="document.getElementById(\'opinionFileInput\').click()" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');Opinion.handleDrop(event)">'
    +'<div style="font-size:36px;margin-bottom:8px"><span class="tf">📎</span></div>'
    +'<div style="font-size:13px;color:var(--color-text-secondary)">클릭 또는 드래그하여 파일 업로드<br><span style="font-size:11px;color:var(--color-text-tertiary)">PDF, DOCX, TXT (HWP는 텍스트 복사 후 붙여넣기)</span></div></div>'
    +'<input type="file" id="opinionFileInput" multiple accept=".pdf,.docx,.doc,.txt" style="display:none" onchange="Opinion.handleFiles(event)" />'
    +'<div id="opinionFileList" class="opinion-file-list"></div>'

    // 수동 텍스트 입력 (PDF 인식 실패 시)
    +'<div style="margin-top:12px;border-top:1px solid var(--color-border);padding-top:12px">'
    +'<details id="opinionManualInput"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-text-secondary)"><span class="tf">✏️</span> PDF 인식이 안 될 때: 직접 텍스트 붙여넣기</summary>'
    +'<div style="margin-top:8px">'
    +'<textarea class="textarea-field" id="opinionManualText" rows="8" placeholder="의견제출통지서, 명세서 등의 텍스트를 직접 붙여넣으세요.&#10;&#10;예: 특허출원 제10-2025-0128349호에 대하여 다음과 같이 의견제출통지합니다..." style="font-size:12px;line-height:1.6"></textarea>'
    +'<p style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">💡 PDF를 열어서 전체 선택(Ctrl+A) → 복사(Ctrl+C) → 여기 붙여넣기(Ctrl+V)</p>'
    +'</div></details></div>'

    +'</div>' // card 닫기

    +'<div class="card"><div class="card-header"><div class="card-title"><span class="tf">ℹ️</span> 필수 파일 (역할 지정 필수)</div></div>'
    +'<div style="font-size:12px;line-height:1.7;color:var(--color-text-secondary)">'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid #ef4444;background:#fff5f5;border-radius:0 6px 6px 0"><b>📋 의견제출통지서</b> — 심사관이 보낸 통지서 (필수)</div>'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid #3182f6;background:#eff6ff;border-radius:0 6px 6px 0"><b>📑 출원 명세서</b> — 우리 특허 (본원발명) (필수)</div>'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid #f59e0b;background:#fffbeb;border-radius:0 6px 6px 0"><b>📄 인용발명</b> — 심사관이 인용한 선행기술 (다른 특허)</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--color-error);margin-top:8px;padding:8px;background:var(--color-error-light);border-radius:6px;line-height:1.5">'
    +'⚠️ <b>본원 명세서와 인용발명을 반드시 올바르게 지정해 주세요.</b> 잘못 지정하면 분석·의견서 전체가 틀어집니다.'
    +'</div></div>'
    +'<div id="opinionParseProgress" style="margin-top:8px"></div>'
    +'<button class="btn btn-primary btn-full" id="btnOpinionParse" onclick="Opinion.startParsing()" disabled><span class="tf">🔍</span> 문서 파싱 시작</button>';

  R.innerHTML='<div class="card" style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:12px"><span class="tf">📋</span></div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">의견제출통지서를 업로드하세요</h3><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;max-width:400px;margin:0 auto">통지서를 업로드하면 AI가 자동으로 거절이유를 분석하고,<br>보정 전략 → 청구항 초안 → 검증 → 의견서 생성까지 안내합니다.</p>'
    +'<div style="margin-top:20px;padding:14px;background:var(--color-bg-tertiary);border-radius:8px;text-align:left;font-size:12px;color:var(--color-text-secondary);line-height:1.6">'
    +'<b>💡 팁:</b> PDF에서 텍스트가 추출되지 않으면(이미지 스캔본),<br>왼쪽 "직접 텍스트 붙여넣기"를 이용하세요.'
    +'</div></div>';

  // 이미 파일이 있으면 렌더
  if(Opinion.state.files.length) Opinion.renderFiles();
  Opinion.updateParseButton();
};

// 파일 있거나 수동 텍스트 있으면 버튼 활성화
Opinion.updateParseButton = function() {
  var btn=document.getElementById('btnOpinionParse');
  if(!btn) return;
  var hasFiles = Opinion.state.files && Opinion.state.files.length > 0;
  var manualEl = document.getElementById('opinionManualText');
  var hasManual = manualEl && manualEl.value.trim().length > 30;
  btn.disabled = !hasFiles && !hasManual;
};

Opinion.handleFiles=function(e){Array.from(e.target.files||[]).forEach(function(f){Opinion.addFile(f);});e.target.value='';};
Opinion.handleDrop=function(e){Array.from(e.dataTransfer.files||[]).forEach(function(f){Opinion.addFile(f);});};
// ═══ 검증 항목 한글 라벨 ═══
Opinion.CHECK_TYPE_LABELS = {
  term_existence: '용어 존재 여부',
  context_match: '문맥 일치 여부',
  combination_check: '조합 기재 여부',
  cited_ref_origin: '인용발명 유래 여부',
  spec_support: '명세서 뒷받침 여부 (§42② 4호 / §42④ 2호)',
  within_scope: '최초 명세서 범위 내',
  within_original_scope: '최초 명세서 범위 내',
  resolved: '지적사항 해소 여부',
  deficiency_resolved: '지적사항 해소 여부',
  merge_accuracy: '병합 정확성',
  dependency: '인용관계 정합성',
  dependency_integrity: '인용관계 정합성',
  new_matter: '신규사항 추가 여부',
  no_new_matter: '신규사항 추가 여부',
  scope: '권리범위 일치',
  scope_consistency: '권리범위 일치'
};

Opinion.getCheckLabel = function(checkType) {
  return Opinion.CHECK_TYPE_LABELS[checkType] || checkType;
};

Opinion.RESULT_LABELS = { pass: '통과', warn: '주의', fail: '실패' };
Opinion.usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

// updateUsageDisplay는 callForJSON 내부에서 호출됨 (line 1909+)

Opinion.updateUsageDisplay = function() {
  var el = document.getElementById('opinionUsage');
  if (!el) return;
  el.innerHTML = '<span class="tf">🔢</span> API: ' + Opinion.usage.calls + '회';
};

// ═══ 파일 역할 상수 ═══
Opinion.FILE_ROLES = {
  notification: { label: '📋 의견제출통지서', color: '#ef4444' },
  specification: { label: '📑 출원 명세서', color: '#3182f6' },
  cited_ref: { label: '📄 인용발명', color: '#f59e0b' },
  other: { label: '📎 기타', color: '#6b7684' }
};

Opinion.addFile=function(f){
  var ext='.'+f.name.split('.').pop().toLowerCase();
  if(['.pdf','.docx','.doc','.txt'].indexOf(ext)<0){
    if(ext==='.hwp'||ext==='.hwpx'){showToast('HWP는 브라우저에서 읽을 수 없습니다. 한글에서 열어 텍스트를 복사한 뒤 "직접 텍스트 붙여넣기"를 이용해 주세요.','error');return;}
    showToast('지원하지 않는 형식: '+ext,'error');return;
  }
  if(Opinion.state.files.some(function(x){return x.name===f.name;})){return;}
  // 파일명으로 역할 자동 추측 (인용문헌 우선 판별 — '의견제출통지서_인용문헌1' 같은 패턴 대응)
  var role = 'other';
  var n = f.name.toLowerCase();
  // 인용문헌 키워드가 있으면 최우선 (통지서 파일명에 '인용문헌' 이 포함될 수 있음)
  if(n.includes('인용문헌') || n.includes('인용발명') || n.includes('cited') || n.match(/ref\d/) || n.match(/문헌\d/)) role='cited_ref';
  else if(n.includes('통지') || n.includes('notification') || n.includes('의견제출')) role='notification';
  else if(n.includes('명세') || n.includes('출원') || n.includes('spec') || n.includes('특허출원서')) role='specification';
  else if(n.includes('인용') || n.includes('문헌')) role='cited_ref';
  f._role = role;
  Opinion.state.files.push(f); Opinion.renderFiles();
  Opinion.updateParseButton();
};
Opinion.removeFile=function(i){Opinion.state.files.splice(i,1);Opinion.renderFiles();Opinion.updateParseButton();};
Opinion.setFileRole=function(i,role){if(Opinion.state.files[i])Opinion.state.files[i]._role=role;Opinion.renderFiles();};

Opinion.renderFiles=function(){
  var el=document.getElementById('opinionFileList'); if(!el)return;
  el.innerHTML=Opinion.state.files.map(function(f,i){
    var ext=f.name.split('.').pop().toUpperCase();
    var sz=f.size<1048576?Math.round(f.size/1024)+'KB':(f.size/1048576).toFixed(1)+'MB';
    var role=f._role||'other';
    var roleInfo=Opinion.FILE_ROLES[role]||Opinion.FILE_ROLES.other;
    return '<div class="opinion-file-item" style="border-left:3px solid '+roleInfo.color+'">'
      +'<span class="file-name">'+escapeHtml(f.name)+'</span>'
      +'<select onchange="Opinion.setFileRole('+i+',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--color-border);border-radius:4px;background:#fff;color:var(--color-text-secondary)">'
      +'<option value="notification"'+(role==='notification'?' selected':'')+'>📋 통지서</option>'
      +'<option value="specification"'+(role==='specification'?' selected':'')+'>📑 명세서</option>'
      +'<option value="cited_ref"'+(role==='cited_ref'?' selected':'')+'>📄 인용발명</option>'
      +'<option value="other"'+(role==='other'?' selected':'')+'>📎 기타</option>'
      +'</select>'
      +'<span class="file-type">'+ext+' · '+sz+'</span>'
      +'<button class="file-remove" onclick="Opinion.removeFile('+i+')">✕</button></div>';
  }).join('');
};

// ═══════════════════════════════════════════
// 6. 파싱 (Phase 1)
// ═══════════════════════════════════════════
// 텍스트 추출 — common.js의 App.extractTextFromFile 활용
Opinion.extractFileText = async function(file) {
  try {
    return await extractTextFromFile(file);
  } catch (e) {
    console.warn('[Opinion] Extract failed:', file.name, e);
    return '[텍스트 추출 실패: ' + file.name + ']';
  }
};

Opinion.startParsing = async function(){
  var p=Opinion.state.current; if(!p) return;
  var run = Opinion._currentRun; // 파이프라인 취소 토큰 캡처 (P2 #24)

  // 수동 텍스트 확인
  var manualEl = document.getElementById('opinionManualText');
  var manualText = manualEl ? manualEl.value.trim() : '';
  var hasFiles = Opinion.state.files && Opinion.state.files.length > 0;

  if(!hasFiles && manualText.length < 30) {
    showToast('파일을 업로드하거나 텍스트를 붙여넣어 주세요', 'error'); return;
  }

  setButtonLoading('btnOpinionParse',true);
  await Opinion.setStatus(p.id,'parsing');
  Opinion.renderDetail();

  try{
    // 1. 파일 메타 DB 저장
    for(var i=0;i<(Opinion.state.files||[]).length;i++){
      var f=Opinion.state.files[i];
      try { await sb.from('opinion_project_files').insert({
        project_id:p.id, file_name:f.name, file_path:f.name, file_size:f.size
      }); } catch(dbErr) { /* skip duplicates */ }
    }

    // 2. 텍스트 추출 + 품질 검사 + 역할별 분리
    var textByRole = { notification:'', specification:'', cited_ref:'', other:'' };
    var citedRefFiles = []; // 인용문헌 파일 목록 (개별 추적)
    var allText = '';
    var fileResults = [];
    var totalFiles = (Opinion.state.files||[]).length;

    for(var j=0;j<totalFiles;j++){
      var ff=Opinion.state.files[j];
      showProgress('opinionParseProgress', ff.name+' 추출 중...', j+1, totalFiles + (manualText?1:0));
      var fileText = await Opinion.extractFileText(ff);
      var cleanText = fileText.replace(/[\s\n\r]+/g,' ').trim();
      var quality = cleanText.length < 30 ? 'empty' : cleanText.length < 200 ? 'low' : 'good';
      var role = ff._role || 'other';
      fileResults.push({ name: ff.name, quality: quality, length: cleanText.length, role: role });

      if(quality !== 'empty') {
        var roleLabel = (Opinion.FILE_ROLES[role]||{}).label || role;
        // 인용문헌은 파일별로 번호를 부여하여 명확히 구분
        if(role === 'cited_ref') {
          citedRefFiles.push({ name: ff.name, text: fileText, index: citedRefFiles.length + 1 });
          var section = '\n\n########## 인용문헌 ' + citedRefFiles.length + ' [파일: ' + ff.name + '] ##########\n' + fileText + '\n########## 인용문헌 ' + citedRefFiles.length + ' 끝 ##########\n\n';
        } else {
          var section = '=== [' + roleLabel + ': ' + ff.name + '] ===\n' + fileText + '\n\n';
        }
        textByRole[role] += section;
        allText += section;
      }
    }

    if(manualText) {
      fileResults.push({ name: '수동 입력', quality: 'good', length: manualText.length, role: 'other' });
    }

    var effectiveText = allText.replace(/===\s*\[.*?\]\s*===/g,'').replace(/##########[^#]*##########/g,'').trim();
    var failedFiles = fileResults.filter(function(r){ return r.quality==='empty'; });

    if(effectiveText.length < 100) {
      // 전체 텍스트 부족 → 실패 처리 + 안내
      var failMsg = '텍스트 추출 결과가 부족합니다.\n\n';
      fileResults.forEach(function(r){
        var icon = r.quality==='good'?'✅':r.quality==='low'?'⚠️':'❌';
        failMsg += icon + ' ' + r.name + ' (' + r.length + '자)\n';
      });
      failMsg += '\nPDF가 이미지 스캔본일 수 있습니다.\n"직접 텍스트 붙여넣기"를 이용해 주세요.';
      await Opinion.setStatus(p.id,'parse_failed');
      Opinion.state.parseFailDetail = failMsg;
      Opinion.renderDetail();
      showToast('텍스트 추출 부족 — 수동 입력을 이용하세요', 'error');
      return;
    }

    // 일부 파일만 실패한 경우 경고
    if(failedFiles.length > 0 && failedFiles.length < fileResults.length) {
      var warnNames = failedFiles.map(function(r){return r.name;}).join(', ');
      showToast(warnNames + ' 텍스트 추출 실패 (나머지 파일로 진행)', 'info');
    }

    // 3. LLM 파싱 — 역할별 우선순위 배치 (통지서→인용문헌→명세서→기타)
    // 통지서(거절이유)가 가장 중요하고, 인용문헌이 다음으로 중요
    var orderedText = (textByRole.notification || '') + (textByRole.cited_ref || '') + (textByRole.specification || '') + (textByRole.other || '');
    if(manualText) orderedText += '=== [수동 입력 텍스트] ===\n' + manualText + '\n\n';

    // 인용문헌 파일 목록 안내 생성
    var citedRefGuide = '';
    if(citedRefFiles.length > 0) {
      citedRefGuide = '\n\n⚠️ 인용문헌은 총 ' + citedRefFiles.length + '건이 업로드되었습니다. 각각 별도의 인용발명입니다:\n';
      citedRefFiles.forEach(function(cr) {
        citedRefGuide += '  - 인용문헌 ' + cr.index + ': ' + cr.name + '\n';
      });
      citedRefGuide += 'cited_references 배열에 반드시 ' + citedRefFiles.length + '개 항목을 포함하세요. 하나로 합치지 마세요.\n';
    }

    if (run && run.signal.aborted) return; // 파일 추출 완료 후 이탈 체크
    showProgress('opinionParseProgress', 'AI 분석 중...', totalFiles+(manualText?1:0), totalFiles+(manualText?1:0));
    var parsed = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n아래 문서들을 분석하여 구조화해 주세요.\n'
      +'⚠️ 중요: 각 문서는 [📋 의견제출통지서], [📑 출원 명세서], [📄 인용발명] 으로 구분되어 있습니다.\n'
      +'출원 명세서 = 본원발명(우리 특허). 인용발명 = 심사관이 인용한 선행기술(다른 특허). 이 둘을 절대 혼동하지 마세요.\n'
      +citedRefGuide+'\n'
      +'추출할 항목:\n'
      +'1. application_no: 본원 출원번호\n'
      +'2. applicant: 본원 출원인\n'
      +'3. invention_title: 본원 발명의 명칭\n'
      +'4. rejection_reasons: 거절이유별로 아래 3종 형식 중 해당하는 것을 사용하라.\n'
      +'   §29 계열: {claim_nos:[1], article:"§29②", reason:"진보성 위반", cited_refs:["인용문헌1","인용문헌2"]}\n'
      +'   §42 명확성: {claim_nos:[1,2,3], article:"§42② 1호 또는 §42④ 1호", reason:"명확성 흠결 또는 발명의 설명 기재불비", cited_refs:[]}\n'
      +'   §42 뒷받침: {claim_nos:[2], article:"§42② 4호 또는 §42④ 2호", reason:"청구항 뒷받침 흠결", cited_refs:[]}\n'
      +'   ★ §42 계열 거절은 cited_refs가 빈 배열이다. 빈 배열 그대로 출력. 가짜 인용문헌 생성 금지.\n'
      +'   ★ 통지서에 기재된 조문 표기를 그대로 유지하라. §29를 §42로, §42를 §29로 변환 금지.\n'
      +'5. cited_references: 인용문헌별 개별 항목 [{ref_no:N, title:"인용발명 제목", publication_no:"공개번호"}] — 파일별로 반드시 별도 항목\n'
      +'6. claims: 본원 청구항 [{no:N, text:"..."}]\n'
      +'7. comparison_table: 심사관 대비표 [{element_no:N, applicant_feature:"본원 구성", cited_feature:"인용발명 구성", cited_ref_no:N}]\n\n'
      +'---\n'+orderedText.slice(0,30000),
      '{"application_no":"10-...","applicant":"...","invention_title":"...","rejection_reasons":[{"claim_nos":[1],"article":"§29②","reason":"진보성 위반","cited_refs":["인용문헌1"]},{"claim_nos":[2,3],"article":"§42④ 2호","reason":"뒷받침 흠결","cited_refs":[]}],"cited_references":[{"ref_no":1,"title":"...","publication_no":"..."}],"claims":[...]}'
    );
    // 추출 품질 메타 저장
    parsed._file_results = fileResults;
    parsed._total_text_length = effectiveText.length;

    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at startParsing');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }

    // 인용문헌 수 검증: 업로드 파일 수 vs LLM 파싱 결과 수 비교
    var parsedCitedCount = (parsed.cited_references || []).length;
    if(citedRefFiles.length > 0 && parsedCitedCount < citedRefFiles.length) {
      console.warn('[Opinion] 인용문헌 수 불일치: 업로드 ' + citedRefFiles.length + '건, 파싱 ' + parsedCitedCount + '건');
      showToast('인용문헌 ' + citedRefFiles.length + '건 중 ' + parsedCitedCount + '건만 인식됨 — 파싱 결과를 확인하세요', 'info');
    }

    await sb.from('opinion_parsed_documents').insert({project_id:p.id, raw_text:orderedText.slice(0,100000), parsed_data:parsed});
    clearProgress('opinionParseProgress');
    await Opinion.setStatus(p.id,'parsed');
    showToast('파싱 완료 ('+Math.round(effectiveText.length/1000)+'K자 추출)');
    Opinion.renderDetail();
  }catch(e){
    console.error('[Opinion] parse:',e);
    clearProgress('opinionParseProgress');
    await Opinion.setStatus(p.id,'parse_failed');
    Opinion.state.parseFailDetail = e.message;
    showToast('파싱 실패: '+e.message,'error');
    Opinion.renderDetail();
  }
  finally{setButtonLoading('btnOpinionParse',false);}
};

// ═══════════════════════════════════════════
// 7. 유형 판별 (Phase 2)
// ═══════════════════════════════════════════
Opinion.renderParsed = function(L,R){
  L.innerHTML=Opinion.renderNavBar('parse')+'<div class="card"><div class="card-header"><div class="card-title"><span class="tf">✅</span> 파싱 완료</div></div><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6">문서 파싱이 완료되었습니다.<br>결과를 확인한 후 유형을 판별합니다.</p><button class="btn btn-primary btn-full" id="btnOpinionType" onclick="Opinion.determineType()" style="margin-top:12px"><span class="tf">🔍</span> 유형 판별 시작</button></div>';
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tf">📋</span> 파싱 결과</div></div><div id="opinionParsedContent" style="font-size:13px;color:var(--color-text-secondary);padding:4px 0">로딩 중...</div></div>';
  Opinion.loadParsed();
};
Opinion.loadParsed = async function(){
  var p=Opinion.state.current,el=document.getElementById('opinionParsedContent');if(!p||!el)return;
  try{var{data}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    if(data&&data.parsed_data){ Opinion.renderParsedUI(el, data.parsed_data); }
    else { el.textContent='파싱 데이터가 없습니다.'; }
  }catch(e){el.textContent='데이터를 불러올 수 없습니다.';}
};

// 파싱 결과 구조화 렌더링
Opinion.renderParsedUI = function(el, pd) {
  if(pd.raw_text && !pd.application_no) {
    // LLM이 구조화 실패 → raw_text만 있는 경우
    el.innerHTML='<div style="padding:12px;background:var(--color-warning-light);border-radius:8px;border-left:3px solid var(--color-warning);margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:#92400e;margin-bottom:4px">⚠️ 자동 구조화에 실패했습니다</div><div style="font-size:12px;color:#92400e">PDF 내용이 이미지 스캔본이거나 형식이 비표준일 수 있습니다. 유형 판별은 원문 기준으로 진행됩니다.</div></div>'
      +'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-text-secondary)">원문 텍스트 보기</summary>'
      +'<pre style="white-space:pre-wrap;font-size:11px;background:var(--color-bg-tertiary);padding:12px;border-radius:8px;max-height:300px;overflow-y:auto;margin-top:8px">'+escapeHtml(pd.raw_text.slice(0,3000))+'</pre></details>';
    return;
  }

  var h='';

  // 기본 정보
  if(pd.application_no||pd.invention_title||pd.applicant) {
    h+='<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;padding:14px;background:var(--color-bg-tertiary);border-radius:8px;margin-bottom:14px;font-size:13px">';
    if(pd.application_no) h+='<span style="font-weight:600;color:var(--color-text-secondary)">출원번호</span><span>'+escapeHtml(pd.application_no)+'</span>';
    if(pd.invention_title) h+='<span style="font-weight:600;color:var(--color-text-secondary)">발명의 명칭</span><span>'+escapeHtml(pd.invention_title)+'</span>';
    if(pd.applicant) h+='<span style="font-weight:600;color:var(--color-text-secondary)">출원인</span><span>'+escapeHtml(pd.applicant)+'</span>';
    h+='</div>';
  }

  // 거절이유
  if(pd.rejection_reasons&&pd.rejection_reasons.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tf">⚠️</span> 거절이유</div>';
    pd.rejection_reasons.forEach(function(rr) {
      h+='<div style="padding:10px 14px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:6px;background:#fff">'
        +'<div style="font-size:13px;font-weight:600;color:var(--color-error)">'+escapeHtml(rr.article||'')+'<span style="font-weight:400;color:var(--color-text-secondary);margin-left:8px">'+escapeHtml(rr.reason||'')+'</span></div>'
        +(rr.claim_nos?'<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:4px">대상 청구항: '+rr.claim_nos.join(', ')+'</div>':'')
        +(rr.cited_refs?'<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">인용문헌: '+rr.cited_refs.join(', ')+'</div>':'')
        +'</div>';
    });
    h+='</div>';
  }

  // 인용문헌
  if(pd.cited_references&&pd.cited_references.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tf">📄</span> 인용문헌</div>';
    pd.cited_references.forEach(function(ref) {
      h+='<div style="padding:8px 12px;background:var(--color-bg-tertiary);border-radius:6px;margin-bottom:4px;font-size:12px">'
        +'<span style="font-weight:600">'+escapeHtml('인용문헌 '+(ref.ref_no||''))+'</span> '
        +escapeHtml(ref.title||ref.publication_no||'')
        +'</div>';
    });
    h+='</div>';
  }

  // 청구항
  if(pd.claims&&pd.claims.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tf">📑</span> 청구항 ('+pd.claims.length+'개)</div>';
    h+='<details><summary style="cursor:pointer;font-size:12px;color:var(--color-primary);font-weight:500">청구항 펼치기</summary><div style="margin-top:8px">';
    pd.claims.forEach(function(c) {
      h+='<div style="padding:8px 12px;border-left:3px solid var(--color-primary-light);margin-bottom:6px;font-size:12px;line-height:1.6;background:var(--color-bg-tertiary);border-radius:0 6px 6px 0">'
        +'<span style="font-weight:600;color:var(--color-primary)">【청구항 '+c.no+'】</span> '
        +escapeHtml((c.text||'').slice(0,200))+(c.text&&c.text.length>200?'...':'')
        +'</div>';
    });
    h+='</div></details></div>';
  }

  // 대비표
  if(pd.comparison_table&&pd.comparison_table.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tf">⚖️</span> 구성요소 대비표</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--color-bg-tertiary)"><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">구성요소</th><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">본원</th><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">인용발명</th></tr></thead><tbody>';
    pd.comparison_table.forEach(function(row) {
      h+='<tr><td style="padding:6px 8px;border-bottom:1px solid var(--color-divider);font-weight:600">❶ '+(row.element_no||'')+'</td>'
        +'<td style="padding:6px 8px;border-bottom:1px solid var(--color-divider)">'+escapeHtml(row.applicant_feature||'-')+'</td>'
        +'<td style="padding:6px 8px;border-bottom:1px solid var(--color-divider)">'+escapeHtml(row.cited_feature||'-')+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }

  el.innerHTML = h || '<p style="color:var(--color-text-tertiary)">파싱 데이터가 비어 있습니다.</p>';
};

Opinion.determineType = async function(){
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  setButtonLoading('btnOpinionType',true);
  try{
    var{data:pd}=await sb.from('opinion_parsed_documents').select('parsed_data,raw_text').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    if (run && run.signal.aborted) return;
    // 유형 판별은 의견제출통지서만으로 충분 — 통지서 텍스트만 추출
    var ctx = '';
    if (pd && pd.parsed_data) {
      // parsed_data에서 notification 관련 필드만 추출
      var pData = pd.parsed_data;
      var notifData = {};
      if (pData.rejection_reasons) notifData.rejection_reasons = pData.rejection_reasons;
      if (pData.rejected_claims) notifData.rejected_claims = pData.rejected_claims;
      if (pData.application_no) notifData.application_no = pData.application_no;
      if (pData.invention_title) notifData.invention_title = pData.invention_title;
      if (pData.notification_text) notifData.notification_text = pData.notification_text;
      if (pData.claims) notifData.claims = pData.claims;
      ctx = JSON.stringify(Object.keys(notifData).length ? notifData : pData).slice(0,8000);
    }
    // raw_text에서 통지서 부분만 추출 (구분자로 분리된 경우)
    if (pd && pd.raw_text) {
      var rawNotif = '';
      var rawText = pd.raw_text;
      var notifStart = rawText.indexOf('[의견제출통지서]');
      var notifEnd = rawText.indexOf('[출원 명세서]');
      if (notifStart >= 0) {
        rawNotif = rawText.slice(notifStart, notifEnd > notifStart ? notifEnd : notifStart + 6000);
      } else {
        rawNotif = rawText.slice(0, 6000);
      }
      ctx += '\n\n[통지서 원문]\n' + rawNotif;
    }
    var tr = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n유형 판별 (의견제출통지서만으로 판단):\n'
        +'A. inventive_step — 신규성 위반(§29①) 또는 진보성 위반(§29②)\n'
        +'B. description_deficiency — 기재불비(§42② 또는 §42④ — 구체 조항은 통지서에 따름)\n'
        +'C. partial_rejection — 일부 청구항만 거절 (등록가능 청구항 존재)\n'
        +'X. unsupported_type — §32(불특허발명)/§33(무권리자)/§36(선출원)/§45(단일성) 등 위 A·B·C에 해당하지 않는 거절\n\n'
        +'규칙:\n'
        +'1. 통지서에 §29·§42가 동시에 있으면 primary_type에 주된 유형, secondary_type에 나머지 유형을 기재하라.\n'
        +'2. §32/§33/§36/§45 등 A·B·C 외 거절은 반드시 primary_type:"unsupported_type"으로 출력하고 reasoning에 조문과 사유를 명시하라.\n'
        +'3. primary_type은 반드시 inventive_step / description_deficiency / partial_rejection / unsupported_type 중 하나만 출력하라.\n'
        +'---\n'+ctx,
      '{"primary_type":"inventive_step","confidence":0.85,"reasoning":"...","secondary_type":null,"claim_summary":{"total_claims":N,"rejected_claims":[1,2],"no_rejection_claims":[3]}}'
    );

    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at determineType');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }

    // ─── _parse_failed / 알 수 없는 유형 → silent fallback 없이 수동 선택 강제 ───
    var validTypes = Object.keys(Opinion.TYPES);
    var typeOk = !tr._parse_failed && tr.primary_type && validTypes.indexOf(tr.primary_type) >= 0;

    // 진단용 행은 항상 저장 (실패 시에도 raw_text 보존)
    await sb.from('opinion_type_determinations').insert({
      project_id: p.id,
      determined_type: typeOk ? tr.primary_type : null,
      confidence: typeOk ? (tr.confidence || 0.5) : 0,
      reasoning: tr._parse_failed ? ('[파싱실패] ' + (tr.raw_text || '').slice(0, 500)) : (tr.reasoning || ''),
      user_confirmed: false
    });

    if (!typeOk) {
      // 헤더·본문 모순의 원인 차단 — inventive_step 무음 fallback 제거
      console.warn('[Opinion] 유형 판별 실패 (raw):', tr._parse_failed ? tr.raw_text : JSON.stringify(tr));
      Opinion.state.typeResult = tr;
      Opinion.state._typeNeedsManual = true; // renderTypeView에서 override 패널 자동 펼침
      Opinion.renderDetail();
      showToast('유형 자동 판별 실패 — 직접 선택해 주세요', 'error');
      return;
    }

    // unsupported_type: 안내 화면 표시 후 파이프라인 중단
    if (tr.primary_type === 'unsupported_type') {
      await sb.from('opinion_projects').update({rejection_type:'unsupported_type', secondary_rejection_type:tr.secondary_type||null, status:'type_determined'}).eq('id',p.id);
      p.rejection_type = 'unsupported_type'; p.status = 'type_determined';
      Opinion.state.typeResult = tr;
      Opinion.renderDetail();
      showToast('미지원 거절유형 — 변리사 직접 작성 또는 유형 수동 선택 필요', 'info');
      return;
    }

    // 정상 경로: DB 저장 + status 변경 + 다음 단계
    await sb.from('opinion_projects').update({rejection_type:tr.primary_type, secondary_rejection_type:tr.secondary_type||null, status:'type_determined'}).eq('id',p.id);
    p.rejection_type = tr.primary_type; p.secondary_rejection_type = tr.secondary_type||null; p.status = 'type_determined';
    // 혼합 거절 감지 (Cycle 3 P0 #1): secondary가 TYPES에 등록된 유형이면 로그 + 경고 플래그
    if (tr.secondary_type && Opinion.TYPES[tr.secondary_type] && tr.secondary_type !== 'unsupported_type') {
      Opinion.state._secondary_warned = false; // 아직 안내 미확인
      console.log('[Opinion.type] mixed rejection detected: primary='+tr.primary_type+', secondary='+tr.secondary_type);
    }
    Opinion.state.typeResult = tr; Opinion.renderDetail(); showToast('유형 판별 완료');
  }catch(e){showToast('유형 판별 실패: '+e.message,'error');}
  finally{setButtonLoading('btnOpinionType',false);}
};

Opinion.renderTypeView = function(L,R){
  var p=Opinion.state.current, tr=Opinion.state.typeResult||{};

  // _typeNeedsManual 플래그: override 패널 자동 펼침 후 초기화
  var autoOpen = !!Opinion.state._typeNeedsManual;
  if (autoOpen) Opinion.state._typeNeedsManual = false;

  // ── unsupported_type 전용 안내 화면 ──
  if (p.rejection_type === 'unsupported_type') {
    L.innerHTML = Opinion.renderNavBar('type')+'<div class="card"><div class="card-header"><div class="card-title"><span class="tf">⚠️</span> 수동 처리 필요</div></div>'
      +'<div style="padding:16px">'
      +'<div style="color:var(--color-error);font-weight:600;font-size:14px;margin-bottom:10px">본 거절이유는 현재 자동 처리를 지원하지 않습니다.</div>'
      +'<p style="font-size:13px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:12px">§32(불특허발명) / §33(무권리자) / §36(선출원) / §45(단일성) 등 특수 거절이유는 사건별 개별 판단이 필요합니다.<br>변리사가 직접 의견서를 작성하시거나, 아래에서 유사 유형을 수동 선택하여 참고용으로 진행하실 수 있습니다.</p>'
      +(tr.reasoning?'<div style="font-size:12px;background:var(--color-bg-tertiary);padding:10px;border-radius:8px;margin-bottom:16px;line-height:1.6">'+escapeHtml(tr.reasoning)+'</div>':'')
      +'<div style="font-size:13px;font-weight:600;margin-bottom:8px">유형 수동 선택 (참고용)</div>'
      +'<div class="opinion-type-selector">'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'inventive_step\')">⚖️ A. 진보성</div>'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'description_deficiency\')">📝 B. 기재불비</div>'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'partial_rejection\')">📋 C. 일부거절</div>'
      +'</div><button class="btn btn-primary btn-full" style="margin-top:10px" onclick="Opinion.confirmType()">선택한 유형으로 진행</button>'
      +'</div></div>';
    R.innerHTML = '';
    return;
  }

  // ── 정상 + 판별실패(autoOpen) 공통 화면 ──
  var t = Opinion.TYPES[p.rejection_type] || Opinion.TYPES.inventive_step;
  var conf = Math.round((tr.confidence||0.5)*100);

  // ── 혼합 거절 노란 배너 (Cycle 3 P2 #20) ──
  var secType = p.secondary_rejection_type || (Opinion.state.typeResult && Opinion.state.typeResult.secondary_type) || null;
  var secInfo = secType ? Opinion.TYPES[secType] : null;
  var priInfo = Opinion.TYPES[p.rejection_type] || Opinion.TYPES.inventive_step;
  var secondaryBannerHtml = '';
  if (secType && secInfo && !Opinion.state._secondary_warned) {
    var isSecUnsupported = secType === 'unsupported_type';
    if (isSecUnsupported) {
      secondaryBannerHtml = '<div id="opinionMixedBanner" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:12px">'
        +'<div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:6px">⚠️ 부 거절이유 — 수동 처리 필요</div>'
        +'<p style="font-size:12px;color:#78350f;line-height:1.7;margin-bottom:10px">'
        +'부 거절(<b>'+escapeHtml(secInfo.label)+'</b>)은 시스템이 자동 처리하지 않는 유형입니다.<br>'
        +'해당 거절이유는 변리사가 직접 검토하고 수동으로 처리하시기 바랍니다.'
        +'</p>'
        +'<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="Opinion.acknowledgeMixed()">이해했습니다 — 주 거절로 진행</button>'
        +'</div>';
    } else {
      secondaryBannerHtml = '<div id="opinionMixedBanner" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:12px">'
        +'<div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:8px">⚠️ 본 통지서는 두 종류의 거절이유를 포함합니다</div>'
        +'<div style="font-size:12px;color:#78350f;line-height:1.8;margin-bottom:10px">'
        +'· 주 거절: <b>'+escapeHtml(priInfo.icon+' '+priInfo.code+'. '+priInfo.label)+'</b><br>'
        +'· 부 거절: <b>'+escapeHtml(secInfo.icon+' '+secInfo.code+'. '+secInfo.label)+'</b><br><br>'
        +'현재 시스템은 한 거절이유를 단독 처리합니다. 두 거절이유 모두 대응하려면:<br>'
        +'1) 본 프로젝트는 <b>'+escapeHtml(priInfo.label)+'</b> 경로로 진행<br>'
        +'2) 동일 통지서로 별도 프로젝트를 생성하여 <b>'+escapeHtml(secInfo.label)+'</b> 경로로 진행<br>'
        +'3) 두 의견서를 합본하여 KIPO 제출'
        +'</div>'
        +'<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="Opinion.acknowledgeMixed()">이해했습니다 — 주 거절로 진행</button>'
        +'</div>';
    }
  } else if (secType && secInfo && Opinion.state._secondary_warned) {
    secondaryBannerHtml = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534">✅ 혼합 거절 안내 확인 완료 — 주 거절 경로로 진행 중</div>';
  }

  L.innerHTML=Opinion.renderNavBar('type')+secondaryBannerHtml+'<div class="card"><div class="card-header"><div class="card-title"><span class="tf">🔍</span> 유형 판별 결과</div></div>'
    +'<div class="opinion-type-result"><div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px">AI 분석 결과</div>'
    +'<div class="opinion-type-determined '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</div>'
    +'<div style="font-size:12px;color:var(--color-text-tertiary)">신뢰도: '+conf+'% <div class="opinion-confidence-bar"><div class="opinion-confidence-fill" style="width:'+conf+'%"></div></div></div>'
    +(tr.reasoning?'<p style="font-size:12px;color:var(--color-text-secondary);text-align:left;line-height:1.6;margin-top:12px;padding:10px;background:var(--color-bg-tertiary);border-radius:8px">'+escapeHtml(tr.reasoning)+'</p>':'')
    +'</div><div style="margin-top:16px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">이 판별이 맞습니까?</div>'
    +'<div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="Opinion.confirmType()"><span class="tf">✅</span> 맞습니다</button><button class="btn btn-outline" style="flex:1" onclick="document.getElementById(\'opinionTypeOverride\').style.display=\'block\'"><span class="tf">✏️</span> 유형 변경</button></div>'
    +'<div id="opinionTypeOverride" style="'+(autoOpen?'':'display:none;')+'margin-top:12px">'
    +(autoOpen?'<div style="color:var(--color-error);font-size:12px;font-weight:600;padding:8px;background:var(--color-error-bg,#fef2f2);border-radius:6px;margin-bottom:8px">⚠️ AI가 유형을 자동 판별하지 못했습니다. 직접 선택해 주세요.</div>':'')
    +'<div class="opinion-type-selector">'
    +'<div class="opinion-type-option'+(p.rejection_type==='inventive_step'?' selected':'')+'" onclick="Opinion.selectType(this,\'inventive_step\')">⚖️ A. 진보성</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='description_deficiency'?' selected':'')+'" onclick="Opinion.selectType(this,\'description_deficiency\')">📝 B. 기재불비</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='partial_rejection'?' selected':'')+'" onclick="Opinion.selectType(this,\'partial_rejection\')">📋 C. 일부거절</div>'
    +'</div><button class="btn btn-primary btn-full" style="margin-top:10px" onclick="Opinion.confirmType()">변경 후 진행</button></div></div></div>';

  var cs=tr.claim_summary||{}, tot=cs.total_claims||0, rej=cs.rejected_claims||[], alw=cs.no_rejection_claims||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tf">📊</span> 청구항별 현황</div></div>'
    +(tot>0?Array.from({length:tot},function(_,i){var n=i+1,isR=rej.indexOf(n)>=0,isA=alw.indexOf(n)>=0;return '<div class="opinion-claim-row '+(isA?'allowable':isR?'rejected':'')+'"><span class="claim-no">청구항 '+n+'</span><span>'+(isA?'✅':isR?'❌':'⬜')+'</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+(isA?'등록가능 후보':isR?'거절':'미확인')+'</span></div>';}).join(''):'<p style="padding:20px;text-align:center;color:var(--color-text-tertiary)">청구항 정보 없음</p>')+'</div>';
};
Opinion.selectType=function(el,type){document.querySelectorAll('.opinion-type-option').forEach(function(o){o.classList.remove('selected');});el.classList.add('selected');Opinion.state.current.rejection_type=type;};

// ── 혼합 거절 안내 확인 버튼 핸들러 (Cycle 3 P2 #20) ──
Opinion.acknowledgeMixed = async function() {
  var p = Opinion.state.current; if (!p) return;
  Opinion.state._secondary_warned = true;
  var secType = p.secondary_rejection_type || (Opinion.state.typeResult && Opinion.state.typeResult.secondary_type) || null;
  try {
    await sb.from('opinion_gate_decisions').insert({
      project_id: p.id, gate_no: 0, decision: 'mixed_acknowledged',
      decided_by: currentUser.id,
      revision_note: JSON.stringify({primary: p.rejection_type, secondary: secType})
    });
  } catch(e) { console.warn('[Opinion.acknowledgeMixed] gate_decisions insert failed:', e); }
  // 배너를 "확인 완료" 상태로 교체
  var banner = document.getElementById('opinionMixedBanner');
  if (banner) {
    banner.outerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534">✅ 혼합 거절 안내 확인 완료 — 주 거절 경로로 진행 중</div>';
  }
};

Opinion.confirmType=async function(){
  var p=Opinion.state.current;if(!p)return;

  // ── Gate 0: 혼합 거절 안내 미확인 시 차단 (Cycle 3 P0 #1 단기) ──
  var secType = p.secondary_rejection_type || (Opinion.state.typeResult && Opinion.state.typeResult.secondary_type) || null;
  var secInfo = secType ? Opinion.TYPES[secType] : null;
  if (secInfo && !Opinion.state._secondary_warned) {
    showToast('혼합 거절 안내를 확인해 주세요', 'error');
    var banner = document.getElementById('opinionMixedBanner');
    if (banner) banner.scrollIntoView({behavior:'smooth', block:'center'});
    // gate_decisions에 blocked 기록
    try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:0,decision:'blocked',decided_by:currentUser.id,revision_note:'mixed_unacknowledged'}); } catch(_){}
    return;
  }

  try{
    // typeResult.id가 있으면 특정 레코드만 업데이트 (동일 프로젝트에 여러 판정이 있을 수 있음)
    var typeUpdateQuery = sb.from('opinion_type_determinations').update({user_confirmed:true,user_override:p.rejection_type});
    if(Opinion.state.typeResult && Opinion.state.typeResult.id) typeUpdateQuery = typeUpdateQuery.eq('id',Opinion.state.typeResult.id);
    else typeUpdateQuery = typeUpdateQuery.eq('project_id',p.id);
    await typeUpdateQuery;
    // 프로젝트 테이블에도 사용자가 확정한 유형 반영 (새로고침 시에도 유지)
    await sb.from('opinion_projects').update({rejection_type:p.rejection_type}).eq('id',p.id);
    await Opinion.startAnalysis();
  }catch(e){showToast('유형 확정 실패','error');}
};

// ═══════════════════════════════════════════
// 8. 토론 형식 렌더링 헬퍼
// ═══════════════════════════════════════════
Opinion.renderDiscussion = function(discussionArr) {
  if (!discussionArr || !discussionArr.length) return '';
  var h = '<div class="opinion-discussion">';
  discussionArr.forEach(function(d) {
    var isExaminer = d.role === '심사관';
    var icon = isExaminer ? '👨‍⚖️' : '👨‍💼';
    var label = isExaminer ? '심사관' : '변리사';
    var cls = isExaminer ? 'examiner' : 'attorney';
    h += '<div class="opinion-chat-bubble '+cls+'">'
      +'<div class="opinion-chat-role"><span class="tossface">'+icon+'</span> <b>'+label+'</b></div>'
      +'<div class="opinion-chat-text">'+escapeHtml(d.text||'').replace(/\n/g,'<br>')+'</div>'
      +'</div>';
  });
  h += '</div>';
  return h;
};

// ═══════════════════════════════════════════
// 9. 쟁점 분석 + 전략 수립 (기존 analyze+gate1 병합)
// ═══════════════════════════════════════════
Opinion.retryAnalysis = async function() {
  var p=Opinion.state.current;if(!p)return;
  showToast('재분석 중...');
  await Opinion.setStatus(p.id,'type_determined');
  await Opinion.startAnalysis();
};

Opinion.startAnalysis = async function(){
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  var type=p.rejection_type, next=type==='description_deficiency'?'deficiency_analyzed':type==='partial_rejection'?'allowable_identified':'analyzed';
  await Opinion.setStatus(p.id,'analyzing'); Opinion.renderDetail();
  try{
    var{data:pd}=await sb.from('opinion_parsed_documents').select('parsed_data,raw_text').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    if (run && run.signal.aborted) return;
    var ctx='';
    if(pd) {
      if(pd.parsed_data && pd.parsed_data.application_no) ctx+='[파싱 결과]\n'+JSON.stringify(pd.parsed_data,null,1).slice(0,5000)+'\n\n';
      if(pd.raw_text) ctx+='[원문]\n'+pd.raw_text.slice(0,20000)+'\n\n';
    }
    var prompts={
      inventive_step:'위 의견제출통지서와 명세서를 분석하여 구성요소별 차이점과 보정 전략을 도출해 주세요.\n\n'
        +'⚠️ 본원 명세서(출원인 특허) ≠ 인용발명(심사관이 인용한 선행기술). 이 둘을 절대 혼동하지 마세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 분석하세요.\n'
        +'- 심사관은 거절이유의 핵심을 설명하고 출원의 약점을 지적합니다.\n'
        +'- 변리사는 본원 명세서 근거를 찾아 차이점을 반박하고 보정 전략을 제안합니다.\n'
        +'- 토론 결과를 "discussion" 배열에 기록하세요.\n\n'
        +'[구성요소별 분석]\n'
        +'심사관이 대비한 각 구성요소에 대해:\n'
        +'- 각 구성요소가 어떤 인용문헌(cited_ref)과 대비되는지 명시하세요.\n'
        +'- 본원 명세서의 실제 내용과 인용발명의 실제 내용을 비교하여 구체적 차이점을 서술하세요. 추상적 placeholder 금지.\n'
        +'- 인용발명이 여러 건이면 각 인용문헌별로 별도 구성요소 항목(E1, E2, ...)을 생성하세요.\n\n'
        +'[보정 전략 — 추천순위로 나열]\n'
        +'- 독립 청구항 1항을 보정하여 모든 인용발명들과의 차이를 확보하는 전략을 2~3개 추천순위로 제시하세요.\n'
        +'- 각 전략에서 target_elements로 해당 전략이 활용하는 구성요소(E1, E2 등)를 명시하세요.\n'
        +'- 보정 근거가 되는 명세서 단락번호(【0001】형식)를 spec_paragraphs로 제시하세요.\n'
        +'- 종속항 병합이 필요한 경우 merge_claims에 해당 종속항 번호를 명시하세요.\n'
        +'- 독립항 1항이 보정되면 종속항은 신규성/진보성이 인정되므로, 종속항 보정은 최소화하세요.\n\n'
        +'JSON:\n{"discussion":[\n  {"role":"심사관","text":"거절이유 핵심 설명..."},\n  {"role":"변리사","text":"반박 및 전략 제안..."}\n],\n"elements":[\n  {"element_id":"E1","claim_element":"실제 청구항 구성요소 문언","cited_ref":"인용문헌 N","cited_disclosure":"인용발명에 개시된 실제 내용","difference":"본원과의 구체적 차이점","strength":"strong|medium|weak","non_obviousness_argument":"진보성 주장 근거"}\n],\n"strategies":[\n  {"id":"S1","name":"전략명 (예: 종속항3 병합 + 감정엔진 구체화)","rationale":"이 전략의 근거와 기대 효과를 2~3문장으로","target_elements":["E3","E5"],"merge_claims":[3],"spec_paragraphs":["【0029】","【0035】"],"scope_impact":"narrow|moderate|broad","risk":"low|medium|high","recommendation_rank":1}\n],\n"cited_references":[\n  {"ref_no":1,"title":"인용문헌 제목","key_features":"핵심 기술 요약"}\n]}',
      description_deficiency:'위 의견제출통지서의 기재불비 지적사항을 분석하세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 분석하세요.\n'
        +'각 지적에 대해 실제 심사관 지적 내용과 명세서에서 대응 기재를 찾아 구체적 수정 방향을 제시하세요.\n\n'
        +'★ §42 조문 5종 분류 (deficiency_type 키 + article 정확 표기):\n'
        +'  1) clarity            — §42② 1호 (청구항 표현 명확성)              → 청구항 문언 명확화. 권리범위 보존 가능\n'
        +'  2) support            — §42② 4호 (청구항이 발명의 설명에 의해 뒷받침) → 청구항을 명세서 기재 범위로 축소\n'
        +'  3) description_lack   — §42④ 1호 (발명의 설명 기재불비, 당업자 실시) → 명세서 보정 필요 (의견서 단독 곤란)\n'
        +'  4) description_support — §42④ 2호 (발명의 설명에 청구항이 뒷받침 안 됨) → 청구항 축소 + 명세서 근거 단락 명시\n'
        +'  5) inconsistent       — §42②/④ 일반 (청구항 간/명세서와 불일치)     → 용어 통일 또는 청구항 정리\n\n'
        +'★★★ 절대 규칙:\n'
        +'1. 통지서 본문의 조문 표기를 그대로 따르라. 통지서가 §42② 4호라면 deficiency_type="support", article="§42② 4호"로 출력.\n'
        +'2. 통지서가 §42④ 2호라면 deficiency_type="description_support", article="§42④ 2호"로 출력. §42②와 §42④를 임의 변환 금지.\n'
        +'3. 위 5개 키 외의 값(unclear, unsupported 등 구 분류) 출력 금지.\n'
        +'4. 통지서에 명시되지 않은 조문은 추측하지 마라. 가장 근접한 키 1개를 선택하고 article에는 통지서 원문 표기 사용.\n\n'
        +'JSON:\n{"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n"items":[{"claim_no":N,"deficiency_type":"clarity|support|description_lack|description_support|inconsistent","article":"§42② 1호 | §42② 4호 | §42④ 1호 | §42④ 2호 | §42② 또는 §42④","examiner_comment":"심사관 지적 원문","spec_reference":"【0001】등 관련 단락","suggested_correction":"구체적 수정 문언 제안"}]}',
      partial_rejection:'위 의견제출통지서에서 청구항별 거절 상태를 분석하고 등록가능 청구항을 식별하세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 분석하세요.\n\n'
        +'JSON:\n{"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n"rejected_claims":[{"claim_no":N,"reason":"진보성 위반 등 구체적 이유"}],"allowable_claims":[{"claim_no":N,"basis":"거절이유 미지적 등 근거"}],"merge_suggestion":{"target":1,"source":N,"rationale":"병합 이유와 기대 효과"}}'
    };
    var ar = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n'+ctx+'\n'+prompts[type],
      type==='inventive_step' ? '{"elements":[{"element_id":"E1","claim_element":"...","difference":"...","strength":"strong"}],"strategies":[{"name":"...","rationale":"...","risk":"low"}]}'
      : type==='description_deficiency' ? '{"items":[{"claim_no":1,"deficiency_type":"support","article":"§42② 4호","examiner_comment":"...","spec_reference":"【0010】","suggested_correction":"..."}]}'
      : '{"rejected_claims":[...],"allowable_claims":[...],"merge_suggestion":{...}}'
    );
    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at startAnalysis');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }
    await sb.from('opinion_issue_analyses').insert({project_id:p.id,analysis_type:type,result_data:ar});
    Opinion.state.analysis=ar; await Opinion.setStatus(p.id,next); Opinion.renderDetail(); showToast('분석 완료');
  }catch(e){showToast('분석 실패: '+e.message,'error');await Opinion.setStatus(p.id,'type_determined');Opinion.renderDetail();}
};

// ═══ 유연한 분석 데이터 추출 — LLM 응답 형식이 다양해도 처리 ═══
Opinion.extractAnalysisFields = function(rawData) {
  var result = { elements: [], strategies: [], cited_references: [] };
  if (!rawData || typeof rawData !== 'object') return result;

  // _parse_failed인 경우 raw_text에서 JSON 재시도
  if (rawData._parse_failed && rawData.raw_text) {
    // raw_text 안에 JSON 조각이 있을 수 있음
    var text = rawData.raw_text;
    // "elements" 키워드 주변의 배열 추출 시도
    var elMatch = text.match(/"elements"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (elMatch) { try { result.elements = JSON.parse(elMatch[1]); } catch(e) {} }
    var stMatch = text.match(/"strategies"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (stMatch) { try { result.strategies = JSON.parse(stMatch[1]); } catch(e) {} }
    if (result.elements.length || result.strategies.length) return result;
    // 못 찾으면 아래 일반 로직으로 fallthrough
  }

  // 일반 객체 탐색
  var data = rawData._parse_failed ? {} : rawData;

  // elements 찾기 (다양한 키명 대응)
  var elKeys = ['elements','element','구성요소','comparison','comparisons','claim_elements'];
  for (var i = 0; i < elKeys.length; i++) {
    if (data[elKeys[i]] && Array.isArray(data[elKeys[i]]) && data[elKeys[i]].length) {
      result.elements = data[elKeys[i]]; break;
    }
  }
  // 중첩 객체 탐색
  if (!result.elements.length) {
    Object.keys(data).forEach(function(k) {
      var v = data[k];
      if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object' &&
          (v[0].element_id || v[0].claim_element || v[0].difference || v[0].cited_ref || v[0].cited_disclosure)) {
        result.elements = v;
      }
    });
  }

  // strategies 찾기
  var stKeys = ['strategies','strategy','전략','amendment_strategies','보정전략'];
  for (var j = 0; j < stKeys.length; j++) {
    if (data[stKeys[j]] && Array.isArray(data[stKeys[j]]) && data[stKeys[j]].length) {
      result.strategies = data[stKeys[j]]; break;
    }
  }
  if (!result.strategies.length) {
    Object.keys(data).forEach(function(k) {
      var v = data[k];
      if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object' &&
          (v[0].name || v[0].rationale || v[0].strategy_name || v[0].risk) &&
          v !== result.elements) {
        result.strategies = v;
      }
    });
  }

  // cited_references 찾기
  var refKeys = ['cited_references','references','인용문헌','cited_refs'];
  for (var r = 0; r < refKeys.length; r++) {
    if (data[refKeys[r]] && Array.isArray(data[refKeys[r]])) {
      result.cited_references = data[refKeys[r]]; break;
    }
  }

  return result;
};

// ═══ 수정 지시 모달 (prompt() 대체) ═══
Opinion.showRevisionModal = function(gateNo, callback) {
  var existing = document.getElementById('opinionRevisionModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'opinionRevisionModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = '<div class="modal-content" style="max-width:500px;padding:24px">'
    +'<div class="modal-title" style="font-size:16px;margin-bottom:4px"><span class="tf">✏️</span> Gate '+gateNo+' 수정 요청</div>'
    +'<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:16px">수정이 필요한 부분을 구체적으로 작성해 주세요. AI가 이 지시에 따라 해당 단계를 재실행합니다.</p>'
    +'<textarea id="opinionRevisionText" class="textarea-field" rows="5" placeholder="예: 구성요소 ❸의 차이점 논증을 더 강화해 주세요. 【0088】의 구체적 예시를 인용하세요." style="font-size:13px;line-height:1.6"></textarea>'
    +'<div style="display:flex;gap:12px;margin-top:4px;font-size:11px;color:var(--color-text-tertiary);flex-wrap:wrap">'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'논증을 더 강화해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px">💡 논증 강화</span>'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'명세서 단락을 더 구체적으로 인용해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px">💡 단락 인용</span>'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'권리범위를 더 넓게 유지해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px">💡 범위 확대</span>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn btn-ghost" style="flex:1;padding:10px" onclick="document.getElementById(\'opinionRevisionModal\').remove()">취소</button>'
    +'<button class="btn btn-primary" style="flex:1;padding:10px" id="btnRevisionSubmit"><span class="tf">✏️</span> 수정 요청</button>'
    +'</div></div>';
  document.body.appendChild(modal);

  // 외부 클릭 닫기
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

  // 제출
  document.getElementById('btnRevisionSubmit').addEventListener('click', function() {
    var text = document.getElementById('opinionRevisionText').value.trim();
    if (!text) { showToast('수정 지시 내용을 입력해 주세요', 'error'); return; }
    modal.remove();
    callback(text);
  });

  // 포커스
  setTimeout(function() { document.getElementById('opinionRevisionText').focus(); }, 100);
};

// ═══ renderStrategy: 쟁점 분석 + 전략 수립 (분석+Gate1 병합) ═══
Opinion.renderStrategy = function(L,R,status){
  var p=Opinion.state.current, type=p.rejection_type, done=['analyzed','deficiency_analyzed','allowable_identified','strategy_confirmed','correction_confirmed','merge_confirmed'].indexOf(status)>=0;
  if(!done){Opinion.renderLoading(L,R,'분석 중...','심사관과 변리사가 쟁점을 협의하고 있습니다');return;}
  var a=Opinion.state.analysis||{};
  var extracted = Opinion.extractAnalysisFields(a);
  var strategies = extracted.strategies;
  var gLabel=type==='inventive_step'?'전략 결정':type==='description_deficiency'?'수정 방향 확인':'병합 대상 확정';

  // 전략 목록을 state에 캐시
  Opinion.state._strategies = strategies;

  // 왼쪽: 토론 + 전략 선택
  var stratHtml = '';
  if (type==='inventive_step' && strategies.length) {
    stratHtml = '<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">추천순위별 전략 (1순위가 최우선)</div>' + strategies.map(function(s,i){
      var name = s.name || s.strategy_name || ('전략 ' + (i+1));
      var rationale = s.rationale || s.description || s.설명 || '';
      var risk = s.risk || s.위험도 || 'medium';
      var rank = s.recommendation_rank || (i+1);
      var riskColor = risk==='low'?'var(--color-success)':risk==='high'?'var(--color-error)':'var(--color-warning)';
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:14px;border:2px solid var(--color-border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:border-color 0.15s" onmouseover="this.style.borderColor=\'var(--color-primary)\'" onmouseout="this.style.borderColor=\'var(--color-border)\'">'
        +'<input type="radio" name="opinionStrategy" value="'+i+'" '+(i===0?'checked':'')+' style="margin-top:4px" onchange="Opinion.highlightStrategyElements('+i+')" />'
        +'<div style="flex:1">'
        +'<div style="display:flex;align-items:center;gap:8px"><span style="background:var(--color-primary);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">'+rank+'</span>'
        +'<span style="font-size:14px;font-weight:600;color:var(--color-primary)">'+escapeHtml(name)+'</span></div>'
        +(rationale?'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;line-height:1.6">'+escapeHtml(rationale)+'</div>':'')
        +'<div style="display:flex;gap:8px;margin-top:8px;font-size:11px;flex-wrap:wrap">'
        +'<span style="padding:2px 8px;border-radius:10px;background:'+riskColor+'15;color:'+riskColor+'">위험: '+escapeHtml(risk)+'</span>'
        +(s.scope_impact?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">범위: '+escapeHtml(s.scope_impact)+'</span>':'')
        +(s.target_elements&&s.target_elements.length?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">대상: '+s.target_elements.join(', ')+'</span>':'')
        +(s.merge_claims&&s.merge_claims.length?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">병합: 청구항 '+s.merge_claims.join(', ')+'</span>':'')
        +(s.spec_paragraphs&&s.spec_paragraphs.length?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">근거: '+s.spec_paragraphs.join(', ')+'</span>':'')
        +'</div></div></label>';
    }).join('') + '</div>';
  } else {
    stratHtml = '<p style="margin-top:12px;font-size:13px;color:var(--color-text-secondary)">오른쪽 분석 결과를 검토 후 확정해 주세요.</p>';
  }

  L.innerHTML=Opinion.renderNavBar('strategy')
    +'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">⚖️</span> 쟁점 분석 + '+gLabel+'</div>'
    +'<p style="font-size:13px;color:var(--color-text-secondary)">심사관과 변리사의 토론 결과를 검토하고 전략을 확정해 주세요.</p>'
    +stratHtml
    +'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.backToList()">나중에</button><button class="btn btn-primary" id="btnGate1Approve" onclick="Opinion.approveGate(1)"><span class="tf">✅</span> 확정</button></div></div>';

  // 오른쪽: 토론 내용 + 분석 결과
  var discussionHtml = '';
  if (a.discussion && a.discussion.length) {
    discussionHtml = '<div class="card" style="margin-bottom:12px"><div class="card-header"><div class="card-title"><span class="tossface">💬</span> 심사관·변리사 협의</div></div>'
      + Opinion.renderDiscussion(a.discussion) + '</div>';
  }
  R.innerHTML = discussionHtml + Opinion.renderAnalysisUI(type, a, extracted);

  if (type==='inventive_step' && strategies.length) {
    Opinion.highlightStrategyElements(0);
  }
};

// 전략 선택 시 해당 전략의 대상 구성요소를 하이라이트
Opinion.highlightStrategyElements = function(strategyIndex) {
  var strategies = Opinion.state._strategies;
  if(!strategies || !strategies[strategyIndex]) return;
  var targets = strategies[strategyIndex].target_elements || [];

  document.querySelectorAll('.opinion-element-card').forEach(function(card) {
    var eid = card.getAttribute('data-element-id');
    if(targets.length === 0 || targets.indexOf(eid) >= 0) {
      // 해당 전략의 대상 구성요소: 강조
      card.style.borderColor = 'var(--color-primary)';
      card.style.boxShadow = '0 0 0 1px var(--color-primary)';
      card.style.opacity = '1';
    } else {
      // 비대상 구성요소: 흐리게
      card.style.borderColor = 'var(--color-border)';
      card.style.boxShadow = 'none';
      card.style.opacity = '0.5';
    }
  });
};

// 분석 결과 구조화 렌더링
Opinion.renderAnalysisUI = function(type, a, extracted) {
  if (!extracted) extracted = Opinion.extractAnalysisFields(a);
  var h = '<div class="card"><div class="card-header"><div class="card-title"><span class="tf">📊</span> 분석 결과</div></div>';
  var hasContent = false;

  if (type === 'inventive_step') {
    var elements = extracted.elements;
    if (elements.length) {
      hasContent = true;
      h += '<div style="margin-bottom:16px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">구성요소별 대비 ('+elements.length+'개)</div>';
      elements.forEach(function(el) {
        var strength = el.strength || el.차이강도 || 'medium';
        var strengthColor = strength==='strong'?'var(--color-success)':strength==='weak'?'var(--color-error)':'var(--color-warning)';
        var strengthLabel = strength==='strong'?'강함':strength==='weak'?'약함':'보통';
        var elName = el.element_id || el.claim_element || el.구성요소 || '';
        var diff = el.difference || el.차이점 || '';
        var cited = el.cited_disclosure || el.cited_ref_disclosure || el.인용발명내용 || '';
        var arg = el.non_obviousness_argument || el.진보성근거 || '';

        h += '<div class="opinion-element-card" data-element-id="'+escapeHtml(elName)+'" style="padding:14px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px;transition:border-color 0.2s,box-shadow 0.2s">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          +'<span style="font-weight:600;font-size:13px">'+escapeHtml(elName)+'</span>'
          +'<span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:12px;background:'+strengthColor+'15;color:'+strengthColor+'">차이 '+strengthLabel+'</span></div>';

        if (el.claim_element && el.claim_element !== elName)
          h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6;margin-bottom:6px;padding:6px 10px;border-left:3px solid var(--color-primary);background:#fafcff;border-radius:0 6px 6px 0"><b style="color:var(--color-primary)">청구항:</b> '+escapeHtml(el.claim_element)+'</div>';
        if (cited)
          h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6;margin-bottom:6px;padding:6px 10px;border-left:3px solid var(--color-error);background:#fff5f5;border-radius:0 6px 6px 0"><b style="color:var(--color-error)">인용발명:</b> '+escapeHtml(cited)+'</div>';
        if (diff)
          h += '<div style="font-size:12px;padding:8px 10px;background:var(--color-success-light);border-radius:6px;margin-bottom:6px;border-left:3px solid var(--color-success)"><b style="color:#065f46">★ 차이점:</b> '+escapeHtml(diff)+'</div>';
        if (arg)
          h += '<div style="font-size:11px;color:var(--color-primary);line-height:1.5">💡 '+escapeHtml(arg)+'</div>';
        h += '</div>';
      });
      h += '</div>';
    }

    var strategies = extracted.strategies;
    if (strategies.length) {
      hasContent = true;
      h += '<div style="margin-bottom:16px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">보정 전략 대안 ('+strategies.length+'개)</div>';
      strategies.forEach(function(s, i) {
        var name = s.name || s.strategy_name || ('전략 '+(i+1));
        var rationale = s.rationale || s.description || '';
        h += '<div style="padding:10px 14px;border:1px solid var(--color-primary-light);border-radius:8px;margin-bottom:6px;background:#fafcff">'
          +'<div style="font-weight:600;font-size:13px;color:var(--color-primary)">'+escapeHtml(name)+'</div>'
          +(rationale?'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;line-height:1.6">'+escapeHtml(rationale)+'</div>':'')
          +'</div>';
      });
      h += '</div>';
    }

    var refs = extracted.cited_references;
    if (refs.length) {
      hasContent = true;
      h += '<div><div style="font-weight:600;font-size:13px;margin-bottom:8px">인용문헌 ('+refs.length+'건)</div>';
      refs.forEach(function(r) {
        h += '<div style="padding:6px 12px;background:var(--color-bg-tertiary);border-radius:6px;margin-bottom:4px;font-size:12px">'
          +'<b>'+escapeHtml(r.ref_no?'인용문헌 '+r.ref_no:'')+'</b> '+escapeHtml(r.title||r.key_features||'')+'</div>';
      });
      h += '</div>';
    }
  } else if (type === 'description_deficiency') {
    var items = Array.isArray(a) ? a : (a.deficiency_items || a.items || []);
    if (items.length) {
      hasContent = true;
      h += '<div style="font-weight:600;font-size:13px;margin-bottom:10px">지적사항 ('+items.length+'건)</div>';
      items.forEach(function(item, i) {
        h += '<div style="padding:12px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px">'
          +'<div style="font-weight:600;font-size:13px">청구항 '+(item.claim_no||(i+1))+'</div>'
          +'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;line-height:1.6">'+escapeHtml(item.examiner_comment||'')+'</div>'
          +(item.suggested_correction?'<div style="margin-top:6px;padding:8px;background:var(--color-primary-light);border-radius:6px;border-left:3px solid var(--color-primary);font-size:12px"><b>수정 방향:</b> '+escapeHtml(item.suggested_correction)+'</div>':'')
          +'</div>';
      });
    }
  } else if (type === 'partial_rejection') {
    var rej = a.rejected_claims || [];
    var alw = a.allowable_claims || [];
    if (rej.length || alw.length) {
      hasContent = true;
      h += '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">청구항 현황</div>';
      rej.forEach(function(r) { h += '<div class="opinion-claim-row rejected"><span class="claim-no">청구항 '+r.claim_no+'</span><span>❌</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+escapeHtml(r.reason||'거절')+'</span></div>'; });
      alw.forEach(function(a) { h += '<div class="opinion-claim-row allowable"><span class="claim-no">청구항 '+a.claim_no+'</span><span>✅</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+escapeHtml(a.basis||'등록가능')+'</span></div>'; });
      h += '</div>';
    }
    if (a.merge_suggestion) {
      hasContent = true;
      var mg = a.merge_suggestion;
      h += '<div style="padding:14px;background:var(--color-primary-light);border-radius:8px;border-left:3px solid var(--color-primary)">'
        +'<div style="font-weight:600;font-size:13px;color:var(--color-primary);margin-bottom:6px">💡 병합 제안</div>'
        +'<div style="font-size:12px;line-height:1.6">청구항 '+(mg.source||'?')+' → 청구항 '+(mg.target||'?')+' 병합</div>'
        +(mg.rationale?'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">'+escapeHtml(mg.rationale)+'</div>':'')
        +'</div>';
    }
  }

  // 구조화된 데이터가 하나도 없으면 원본 표시 + 재분석 버튼
  if (!hasContent) {
    h += '<div style="padding:16px;background:var(--color-warning-light);border-radius:8px;margin-bottom:12px;border-left:3px solid var(--color-warning)">'
      +'<div style="font-weight:600;font-size:12px;color:#92400e;margin-bottom:6px">⚠️ 분석 결과를 구조화하지 못했습니다</div>'
      +'<div style="font-size:12px;color:#92400e;line-height:1.5">AI가 서술형으로 응답했습니다. 재분석하면 구조화된 결과를 얻을 수 있습니다.</div>'
      +'<button class="btn btn-outline btn-sm" onclick="Opinion.retryAnalysis()" style="margin-top:8px;font-size:12px"><span class="tf">🔄</span> 재분석</button>'
      +'</div>';
    h += '<details><summary style="cursor:pointer;font-size:12px;font-weight:500;color:var(--color-text-secondary)">원본 데이터 보기</summary>'
      +'<pre style="white-space:pre-wrap;word-break:break-all;font-size:11px;background:var(--color-bg-tertiary);padding:12px;border-radius:8px;max-height:400px;overflow-y:auto;margin-top:8px;line-height:1.5">'
      +escapeHtml(typeof a === 'object' ? (a.raw_text || JSON.stringify(a,null,2)) : String(a)).slice(0,5000)+'</pre></details>';
  }

  h += '</div>';
  return h;
};

Opinion.approveGate = async function(gn){
  var p=Opinion.state.current;if(!p)return;var type=p.rejection_type,next;

  // ─── Gate 1 차단: 전략 미선택 (Cycle 3 P1 #6) ───
  if (gn === 1 && type === 'inventive_step') {
    var radioEl = document.querySelector('input[name="opinionStrategy"]:checked');
    if (!radioEl) {
      showToast('보정 전략을 선택해 주세요', 'error');
      var strategyArea = document.querySelector('.opinion-strategy-list, [name="opinionStrategy"]');
      if (strategyArea) strategyArea.closest('.card, .opinion-gate-card') && strategyArea.closest('.card, .opinion-gate-card').scrollIntoView({behavior:'smooth',block:'center'});
      try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:1,decision:'blocked',decided_by:currentUser.id,revision_note:'strategy_not_selected'}); } catch(_){}
      return;
    }
  }
  if (gn === 1 && type === 'description_deficiency') {
    var items = (Opinion.state.analysis && (Opinion.state.analysis.items || Opinion.state.analysis.deficiencies)) || [];
    if (!items.length) {
      showToast('분석 결과가 없습니다. 재분석 후 진행해 주세요', 'error');
      try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:1,decision:'blocked',decided_by:currentUser.id,revision_note:'no_analysis_items'}); } catch(_){}
      return;
    }
  }

  // ─── Gate 2 차단: 다중 사유 통합 (Cycle 2 + Cycle 3 + Cycle 4) ───
  // 차단 사유를 모두 수집한 뒤 단일 confirm 모달로 표시. 변리사가 한 번의 override로 모두 통과 가능.
  if (gn === 2) {
    var dr = Opinion.state.draftResult;
    var amendedClaims = dr && (dr.amended_claims || dr.corrected_claims || (dr.merged_claim ? [dr.merged_claim] : []) || (dr.draft_data && dr.draft_data.amended_claims)) || [];

    // [1] 강제 차단 사유 (override 불가): 보정 청구항 빈 배열
    if (!amendedClaims.length) {
      showToast('보정 청구항이 없습니다. 보정안을 먼저 작성해 주세요', 'error');
      try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:2,decision:'blocked',decided_by:currentUser.id,revision_note:'no_amended_claims'}); } catch(_){}
      return;
    }

    // [2] override 가능 차단 사유 — 다중 수집
    var blockReasons = [];
    var blockTags = [];

    var sbc = dr && dr._spec_basis_check;
    if (sbc && sbc.ok === false) {
      var sbDetail = (sbc.missing || []).map(function(m){
        return '청구항 ' + m.claim_no + ': ' + (m.missing_paragraphs || []).join(', ');
      }).join('\n');
      blockReasons.push('• 보정 근거 단락이 명세서에 없음 (§47② 위반 위험)\n' + sbDetail);
      blockTags.push('spec_basis_fail');
    }

    var preserv = dr && dr._claim_preservation_check;
    if (preserv && preserv.ok === false) {
      var prDetail = (preserv.issues || []).slice(0, 3).map(function(i){ return '  - ' + i.detail; }).join('\n');
      blockReasons.push('• 미거절 청구항 변경/누락 (P1 #21)\n' + prDetail);
      blockTags.push('claim_preservation_fail');
    }

    var refChk = dr && dr._claim_reference_check;
    if (refChk && refChk.ok === false) {
      var refDetail = (refChk.issues || []).slice(0, 3).map(function(i){
        return '  - 청구항 ' + i.claim_no + ' → 청구항 ' + i.references_to + ' (' + i.problem + ')';
      }).join('\n');
      blockReasons.push('• 청구항 인용관계 오류 (P1 #22)\n' + refDetail);
      blockTags.push('claim_reference_fail');
    }

    var v = Opinion.state.validation;
    var valItems = v && (v.elements || v.results) || [];
    var failCount = valItems.filter(function(e){ return (e.overall_result||e.result) === 'fail'; }).length;
    if (failCount > 0) {
      blockReasons.push('• 검증 항목 ' + failCount + '건 실패');
      blockTags.push('validation_fail_' + failCount);
    }

    // 통합 confirm 모달 — 다중 사유 한 번에 표시
    if (blockReasons.length > 0) {
      var msg = '⚠️ Gate 2 — ' + blockReasons.length + '건의 검증 사유가 발견됐습니다:\n\n'
              + blockReasons.join('\n\n') + '\n\n'
              + '변리사 책임 하에 의견서 작성을 진행하시겠습니까?';
      if (!confirm(msg)) {
        showToast('Gate 2 차단됨 — ' + blockReasons.length + '건 사유', 'error');
        try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:2,decision:'blocked',decided_by:currentUser.id,revision_note:'multi:'+blockTags.join(',')}); } catch(_){}
        return;
      }
      // 통합 override 기록
      try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:2,decision:'override',decided_by:currentUser.id,revision_note:'multi_override:'+blockTags.join(',')}); } catch(_){}
    }
  }

  // ─── Gate 3 차단: 빈 의견서 강제 차단 (Cycle 3 P1 #6) ───
  if (gn === 3) {
    var o = Opinion.state.opinionDraft;
    var secs = o && o.sections || [];
    var totalLen = secs.reduce(function(acc, s){ return acc + (s.content||'').length; }, 0);
    if (!secs.length || totalLen < 100) {
      showToast('의견서가 비어 있습니다. 다시 생성해 주세요', 'error');
      // 재생성 버튼 활성화 힌트 (렌더링에 이미 있지만 스크롤로 강조)
      var gateCard = document.querySelector('.opinion-gate-card');
      if (gateCard) gateCard.scrollIntoView({behavior:'smooth', block:'start'});
      try { await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:3,decision:'blocked',decided_by:currentUser.id,revision_note:'empty_opinion_len_'+totalLen}); } catch(_){}
      return;
    }
  }

  if(gn===1){
    // 전략 확정 → 바로 청구항 보정 시작
    next=type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed';
    var radioEl2 = document.querySelector('input[name="opinionStrategy"]:checked');
    if(radioEl2 && type==='inventive_step') {
      var idx = parseInt(radioEl2.value,10);
      var extracted = Opinion.extractAnalysisFields(Opinion.state.analysis);
      Opinion.state.selectedStrategy = extracted.strategies[idx] || null;
      Opinion.state.selectedStrategyIndex = idx;
    }
  }
  else if(gn===2){
    // 청구항 확정 → 바로 의견서 작성 시작
    next='claims_confirmed';
  }
  else if(gn===3){
    // 의견서 확정 → 바로 출력
    next='approved';
  }
  var btnId = gn===1?'btnGate1Approve':gn===2?'btnGate2Approve':'btnGate3Approve';
  setButtonLoading(btnId,true);
  try{
    await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:gn,decision:'approve',decided_by:currentUser.id});
    await Opinion.setStatus(p.id,next);
    if(gn===1)await Opinion.startDraft();else if(gn===2)await Opinion.startOpinionDraft();else if(gn===3)await Opinion.startOutput();
    Opinion.renderDetail();showToast(gn===1?'전략 확정':gn===2?'청구항 확정':'최종 승인');
  }catch(e){showToast('처리 실패: '+e.message,'error');}
  finally{setButtonLoading(btnId,false);}
};

Opinion.reviseGate = async function(gn){
  var p=Opinion.state.current;if(!p)return;
  var gateLabel = gn===2?'청구항 보정':gn===3?'의견서':'분석';
  Opinion.showRevisionModal(gn, async function(note) {
    var type=p.rejection_type,rb=gn===2?(type==='description_deficiency'?'drafting_corrections':type==='partial_rejection'?'drafting_merge':'drafting_claims'):'drafting_opinion';
    try{
      await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:gn,decision:'revise',revision_note:note,decided_by:currentUser.id});
      await Opinion.setStatus(p.id,rb);
      Opinion.renderDetail();
      showToast('수정 요청이 접수되었습니다. '+gateLabel+' 단계를 재실행합니다.');
      Opinion.state.lastRevisionNote = note;
      if(gn===2) await Opinion.startDraft();
      else if(gn===3) await Opinion.startOpinionDraft();
    }catch(e){showToast('수정 요청 실패','error');}
  });
};

// ═══ Context Builder — 이전 단계 데이터를 LLM에 전달 ═══
Opinion.getContext = async function(sections) {
  var p=Opinion.state.current; if(!p) return '';
  var ctx='';
  try {
    if(sections.indexOf('parsed')>=0) {
      var{data:pd}=await sb.from('opinion_parsed_documents').select('raw_text,parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(pd) {
        if(pd.parsed_data && pd.parsed_data.application_no) ctx+='[파싱 결과]\n'+JSON.stringify(pd.parsed_data,null,1).slice(0,6000)+'\n\n';
        if(pd.raw_text) ctx+='[원문 (발췌)]\n'+pd.raw_text.slice(0,8000)+'\n\n';
      }
    }
    if(sections.indexOf('analysis')>=0 && Opinion.state.analysis) {
      ctx+='[분석 결과]\n'+JSON.stringify(Opinion.state.analysis,null,1).slice(0,4000)+'\n\n';
      // 사용자가 선택한 전략 정보 추가
      if(Opinion.state.selectedStrategy) {
        ctx+='[사용자 선택 전략]\n'+JSON.stringify(Opinion.state.selectedStrategy,null,1)+'\n⚠️ 위 전략에 따라 보정안을 작성하세요. 다른 전략은 무시하세요.\n\n';
      }
    }
    if(sections.indexOf('draft')>=0) {
      var{data:dr}=await sb.from('opinion_draft_claims').select('draft_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(dr) ctx+='[보정 청구항 초안]\n'+JSON.stringify(dr.draft_data,null,1).slice(0,4000)+'\n\n';
    }
    if(sections.indexOf('validation')>=0 && Opinion.state.validation) {
      ctx+='[검증 결과]\n'+JSON.stringify(Opinion.state.validation,null,1).slice(0,3000)+'\n\n';
    }
    if(sections.indexOf('ref')>=0) {
      var templateText = Opinion.getActiveTemplate(Opinion.state.current ? Opinion.state.current.rejection_type : 'inventive_step');
      if(templateText) ctx += templateText + '\n\n';
    }
  } catch(e) { console.warn('[Opinion] getContext:', e); }
  return ctx;
};

// ═══ Draft (분리 실행 — UI 업데이트 후 자동으로 검증 시작) ═══
Opinion.startDraft=async function(){
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  var t=p.rejection_type;
  var ds=t==='description_deficiency'?'drafting_corrections':t==='partial_rejection'?'drafting_merge':'drafting_claims';
  var dd=t==='description_deficiency'?'corrections_drafted':t==='partial_rejection'?'merge_drafted':'claims_drafted';
  await Opinion.setStatus(p.id,ds);
  Opinion.renderDetail(); // 로딩 표시

  try{
    var ctx = await Opinion.getContext(['parsed','analysis']);
    if (run && run.signal.aborted) return;
    var revNote = Opinion.state.lastRevisionNote || '';
    var revCtx = revNote ? '\n\n[사용자 수정 지시]\n'+revNote+'\n이 지시를 반드시 반영하여 작성하세요.\n' : '';
    Opinion.state.lastRevisionNote = ''; // 사용 후 초기화

    // ─── 거절된 독립항 모두 추출 (Cycle 4 P1 #13) ───
    // parsed.claims에서 종속·독립 판별 → 거절된 독립항 번호 리스트
    var parsedData = null;
    try {
      var{data:_pd}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (_pd) parsedData = _pd.parsed_data;
    } catch(_) {}
    var allClaims = (parsedData && parsedData.claims) || [];
    var rejReasons = (parsedData && parsedData.rejection_reasons) || [];
    var rejectedClaimNos = [];
    rejReasons.forEach(function(rr){ (rr.claim_nos||[]).forEach(function(n){ if (rejectedClaimNos.indexOf(n)<0) rejectedClaimNos.push(n); }); });
    var rejectedIndependentNos = [];
    allClaims.forEach(function(c){
      if (!c || c.no == null) return;
      if (rejectedClaimNos.indexOf(c.no) < 0) return;
      var refs = Opinion._extractClaimReferences(c.text || '');
      if (!refs.length) rejectedIndependentNos.push(c.no); // 독립항 = 다른 청구항 인용 없음
    });
    if (!rejectedIndependentNos.length) rejectedIndependentNos = [1]; // 폴백
    var targetClaimsCtx = '\n[보정 대상 청구항] 거절된 독립항 번호: ' + rejectedIndependentNos.join(', ') + '\n각 독립항에 대해 amended_claims 배열에 별도 원소로 보정 결과를 출력하세요.\n';

    var prompts = {
      inventive_step: '[사용자 선택 전략]에 따라 보정 청구항을 생성하고 뒷받침 검증까지 수행해 주세요.'+revCtx+targetClaimsCtx+'\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 검토하세요.\n'
        +'- 변리사가 보정안을 제시하면, 심사관이 인용발명 1~3 및 이들 조합으로 진보성을 극복할 수 있는지 재검토합니다.\n'
        +'- 변리사는 기재불비(특히 출원서에 기재된 사항에 의한 명확한 뒷받침) 여부도 검토합니다.\n'
        +'- 토론 결과를 "discussion" 배열에 기록하세요.\n\n'
        +'★ 보정 원칙 (핵심 — 반드시 준수):\n'
        +'1. 거절된 모든 독립 청구항을 보정하세요 (위 [보정 대상 청구항] 참조). 독립항이 보정되면 그 종속항은 당연히 신규성/진보성이 인정됩니다.\n'
        +'2. 단, 종속항 중 거절이유에서 별도로 지적된 것이 있으면 그것도 추가 보정하세요.\n'
        +'3. 각 독립항의 보정후 문언은 명확하고 간결하게, 모든 인용발명과의 차이가 분명하도록 작성하세요.\n\n'
        +'★★★ 보정 방법 (절대 규칙 — 단순 병합 금지):\n'
        +'보정은 단순히 기존 종속항의 문언을 독립항에 병합하는 것이 아닙니다.\n'
        +'반드시 아래 3가지 방법 중 하나 이상을 사용하여 보정하세요:\n'
        +'  (1) 한정(限定): 명세서에 기재된 구체적 구성으로 기존 청구항의 상위 개념을 좁히는 것\n'
        +'      예: "프로세서" → "명세서 【0035】에 기재된 바와 같이, 감정 분석 모듈과 추천 엔진을 포함하는 프로세서"\n'
        +'  (2) 부가(附加): 명세서에 기재되어 있으나 기존 청구항에는 없던 구성요소를 추가하는 것\n'
        +'      예: 명세서 【0042】에 기재된 "실시간 피드백 루프" 구성을 청구항에 새로 추가\n'
        +'  (3) 구체화(具體化): 명세서에 기재된 구체적 실시예/수치/방법으로 추상적 표현을 구체화하는 것\n'
        +'      예: "데이터를 처리하는 단계" → "명세서 【0058】에 기재된 바와 같이, N-gram 기반으로 텍스트를 토큰화하고 TF-IDF 가중치를 산출하는 단계"\n\n'
        +'⚠️ 보정에 사용하는 모든 구성은 반드시 출원 명세서의 특정 단락에 기재된 것이어야 합니다.\n'
        +'⚠️ 명세서에 없는 구성을 새로 창작하거나, 인용발명에만 있는 구성을 차용하면 기재불비(§42② 4호 청구항 뒷받침 / §42④ 2호 발명의 설명에 의한 뒷받침) 위반입니다.\n'
        +'⚠️ 기재불비 위반은 절대 허용되지 않습니다. 보정안의 모든 문언이 명세서에 의해 뒷받침되는지 반드시 확인하세요.\n\n'
        +'★ 명세서 뒷받침 교차검증 (자동 수행 — 기재불비 방지):\n'
        +'1. 보정에 사용하는 모든 용어·구성은 반드시 출원 명세서에 기재된 것만 사용하세요.\n'
        +'2. 인용발명에만 있는 용어(인용발명 고유 표현)는 절대 보정에 사용하지 마세요.\n'
        +'3. 각 보정 문언에 대해 근거가 되는 명세서 단락번호(【0001】형식)를 spec_basis에 반드시 명시하세요.\n'
        +'4. 여러 구성요소를 조합하는 경우, 해당 조합이 명세서의 동일 단락 또는 관련 단락에 기재되어 있는지 확인하세요.\n'
        +'5. 명세서에 기재되지 않은 구성을 보정에 사용하면 기재불비(§42② 4호 / §42④ 2호 — 청구항 뒷받침 결여) 위반이므로 절대 금지합니다.\n\n'
        +'★ 인용발명 극복 검토 (청구항 1항 보정 후):\n'
        +'1. 보정후 청구항 1항이 각 인용발명(전체)과 어떤 차이가 있는지 per_cited_ref_diff에 인용문헌별로 기재하세요.\n'
        +'2. 인용발명들의 결합에 의해서도 도달할 수 없는 구성을 포함하도록 하세요.\n'
        +'3. 인용발명 1, 2, 3 각각과의 대비, 그리고 이들의 조합(1+2, 1+3, 2+3, 1+2+3)에 대해 진보성을 극복할 수 있는지 기술적으로 검토하세요.\n\n'
        +'★ 뒷받침 검증 결과도 함께 반환:\n'
        +'각 보정 구성요소에 대해 5중 검증:\n'
        +'  1. term_existence(용어존재) — 보정 문언의 용어가 명세서에 존재하는지\n'
        +'  2. context_match(문맥일치) — 해당 맥락에서 명세서와 동일하게 사용되는지\n'
        +'  3. combination_check(결합체크) — 조합된 구성이 명세서에서 함께 기재되어 있는지\n'
        +'  4. cited_ref_origin(인용발명 유래) — 인용발명에서만 나오는 용어를 차용하지 않았는지\n'
        +'  5. spec_support(명세서 뒷받침) — 보정된 각 구성이 명세서의 구체적 단락에 의해 명확히 뒷받침되는지 (기재불비 §42② 4호 / §42④ 2호 위반 여부 최종 확인)\n\n'
        +'JSON: {"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n"amended_claims":[{"claim_no":1,"original":"원본 청구항 전문","amended":"보정후 청구항 전문","amendments_summary":"보정 사항 요약","amendment_methods":[{"method":"한정|부가|구체화","target":"보정 대상 구성","spec_paragraph":"【0035】","description":"명세서 기재에 근거한 구체적 보정 내용"}],"spec_basis":["【0029】","【0035】"],"per_cited_ref_diff":[{"ref_no":1,"ref_title":"인용문헌1 제목","difference":"이 인용발명과의 구체적 차이점"}]}],\n"unchanged_claims":[2,3,4],"strategy_name":"적용된 전략명",\n"validation":{"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"보정된 문언","checks":[{"check_type":"term_existence|context_match|combination_check|cited_ref_origin|spec_support","result":"pass|warn|fail","detail":"구체적 근거"}],"overall_result":"pass|warn|fail"}]}}',
      description_deficiency: '위 분석 결과의 각 지적사항을 반영한 수정 청구항을 생성하고 검증해 주세요.'+revCtx+'\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 검토하세요.\n'
        +'⚠️ 수정 문언은 반드시 최초 명세서 범위 내에서만 작성. 각 수정에 명세서 근거 단락을 명시.\n'
        +'★ 뒷받침 검증(출원서 기재 사항에 의한 명확한 뒷받침 여부)도 함께 수행하세요.\n\n'
        +'JSON: {"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n"corrected_claims":[{"claim_no":N,"original":"원문","corrected":"수정문","spec_basis":["【0001】"],"changes":[{"type":"...","detail":"..."}]}],\n"validation":{"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"...","checks":[{"check_type":"within_scope|resolved","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}]}}',
      partial_rejection: '위 분석 결과를 기반으로 등록가능 종속항을 독립항에 병합한 청구항을 생성하고 검증해 주세요.'+revCtx+'\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 검토하세요.\n'
        +'⚠️ 병합 시 종속항의 문언을 그대로 독립항에 통합. 새로운 표현 추가 금지.\n'
        +'★ 병합 적법성 검증도 함께 수행하세요.\n\n'
        +'JSON: {"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n"merged_claim":{"claim_no":1,"text":"병합된 전문","spec_basis":["【0001】"]},"remaining_claims":[{"old_no":N,"new_no":N,"text":"...","changed":bool}],"deleted_claims":[N],\n"validation":{"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"...","checks":[{"check_type":"merge_accuracy|dependency|new_matter|scope","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}}}'
    };
    var schemaHints = {
      inventive_step: '{"amended_claims":[{"claim_no":1,"original":"...","amended":"...","amendments_summary":"...","amendment_methods":[{"method":"한정","target":"...","spec_paragraph":"【0035】","description":"..."}],"spec_basis":["【0029】"],"per_cited_ref_diff":[{"ref_no":1,"difference":"..."}]}],"unchanged_claims":[2,3],"strategy_name":"..."}',
      description_deficiency: '{"corrected_claims":[{"claim_no":1,"original":"...","corrected":"...","spec_basis":["【0001】"]}]}',
      partial_rejection: '{"merged_claim":{"claim_no":1,"text":"...","spec_basis":["【0001】"]},"remaining_claims":[...]}'
    };
    var dr = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n'+ctx+prompts[t],
      schemaHints[t] || '{}'
    );
    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at startDraft');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }

    // ─── spec_basis 명세서 원문 cross-check (P0 #17 사이클 2) ───
    // 보정/수정/병합 청구항의 spec_basis 단락번호가 명세서에 실제 존재하는지 검증
    var specText = await Opinion.extractSpecificationText(p.id);
    var claimsToCheck = dr.amended_claims || dr.corrected_claims || (dr.merged_claim ? [dr.merged_claim] : []);
    var specCheck = Opinion._validateSpecBasis(claimsToCheck, specText);
    dr._spec_basis_check = specCheck;
    if (specCheck.ok === false) {
      console.warn('[Opinion] spec_basis 환각 감지:', specCheck.missing);
      showToast('⚠️ 보정 근거 단락이 명세서에 없음 — 변리사 검토 필요', 'error');
    } else if (specCheck.ok === null) {
      console.warn('[Opinion] spec_basis 검증 skip:', specCheck.reason);
    }

    // ─── 청구항 보존 검증 (Cycle 4 P1 #21) ───
    var preservCheck = Opinion._validateClaimPreservation(allClaims, dr, rejectedClaimNos);
    dr._claim_preservation_check = preservCheck;
    if (preservCheck.ok === false) {
      console.warn('[Opinion] 청구항 보존 위반:', preservCheck.issues);
      showToast('⚠️ 미거절 청구항 변경/누락 감지 — 변리사 확인 필요', 'error');
    }

    // ─── 거절된 모든 독립항 보정 누락 검증 (Cycle 4 P1 #13) ───
    var amendedArr = dr.amended_claims || dr.corrected_claims || (dr.merged_claim ? [dr.merged_claim] : []);
    if (t === 'inventive_step' && rejectedIndependentNos.length > 1) {
      var amendedNos = amendedArr.map(function(ac){ return ac.claim_no; });
      var missingTargets = rejectedIndependentNos.filter(function(n){ return amendedNos.indexOf(n) < 0; });
      if (missingTargets.length) {
        showToast('⚠️ 보정 청구항 ' + rejectedIndependentNos.length + '건 중 ' + amendedArr.length + '건만 생성됨. 변리사 수동 확인 필요.', 'error');
        dr._missing_amendment_targets = missingTargets;
      }
    }

    // ─── 청구항 인용관계 검증 (Cycle 4 P1 #22) ───
    // 보정 후 최종 청구항 집합 = (amended 또는 corrected/merged) ∪ (unchanged_claims에 해당하는 원문)
    var finalClaims = [];
    amendedArr.forEach(function(ac){
      finalClaims.push({ no: ac.claim_no, text: ac.amended || ac.corrected || ac.text || '' });
    });
    var unchangedNosList = Array.isArray(dr.unchanged_claims) ? dr.unchanged_claims
      : (Array.isArray(dr.remaining_claims) ? dr.remaining_claims.map(function(rc){ return rc.new_no || rc.old_no; }) : []);
    unchangedNosList.forEach(function(n){
      var oc = allClaims.filter(function(x){ return x.no === n; })[0];
      if (oc) finalClaims.push({ no: n, text: oc.text });
    });
    var refCheck = Opinion._validateClaimReferences(finalClaims);
    dr._claim_reference_check = refCheck;
    if (refCheck.ok === false) {
      console.warn('[Opinion] 청구항 인용관계 오류:', refCheck.issues);
      var firstIssue = refCheck.issues[0];
      showToast('⚠️ 청구항 ' + firstIssue.claim_no + '의 인용관계 오류 (' + firstIssue.problem + ')', 'error');
    }

    // 검증 결과가 draft 응답에 포함된 경우 자동 추출
    if (dr.validation) {
      Opinion.state.validation = dr.validation;
      await sb.from('opinion_validation_results').insert({project_id:p.id,validation_type:t,result_data:dr.validation,summary:dr.validation.summary||{}});
    }

    await sb.from('opinion_draft_claims').insert({project_id:p.id,draft_type:t,draft_data:dr,status:'draft'});
    Opinion.state.draftResult=dr;

    // 검증이 포함되었으면 바로 검증 완료 상태로, 아니면 별도 검증 실행
    if (dr.validation) {
      var vs=t==='description_deficiency'?'correction_validated':t==='partial_rejection'?'merge_validated':'validated';
      await Opinion.setStatus(p.id,vs);
      Opinion.renderDetail();
      showToast('청구항 보정 + 검증 완료');
    } else {
      await Opinion.setStatus(p.id,dd);
      Opinion.renderDetail();
      showToast('청구항 초안 완료 — 검증을 시작합니다');
      await new Promise(function(resolve){ requestAnimationFrame(function(){ requestAnimationFrame(resolve); }); });
      await Opinion.startValidation();
    }

  }catch(e){
    console.error('[Opinion] Draft error:', e);
    showToast('청구항 초안 실패: '+e.message,'error');
    // 이전 단계로 복구
    await Opinion.setStatus(p.id, t==='description_deficiency'?'correction_confirmed':t==='partial_rejection'?'merge_confirmed':'strategy_confirmed');
    Opinion.renderDetail();
  }
};

// ═══ Validate (파싱 원문 + 분석 + 초안 컨텍스트 전달) ═══
Opinion.startValidation=async function(){
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  var t=p.rejection_type;
  var vs=t==='description_deficiency'?'correction_validated':t==='partial_rejection'?'merge_validated':'validated';
  await Opinion.setStatus(p.id,'validating');
  try{
    var ctx = await Opinion.getContext(['parsed','analysis','draft']);
    if (run && run.signal.aborted) return;

    // ─── 명세서 원문을 ctx에 직접 주입 (P1 #5 사이클 2) ───
    // getContext의 raw_text 8K로는 명세서 보장 안 됨 → 별도 추출
    var specText = await Opinion.extractSpecificationText(p.id);
    if (run && run.signal.aborted) return;
    var specWarn = false;
    if (specText && specText.length >= 100) {
      // 30K 초과 시 head + tail 분할
      var specBlock = specText;
      if (specText.length > 30000) {
        specBlock = specText.slice(0, 20000) + '\n... [중간 생략 ' + (specText.length - 30000) + '자] ...\n' + specText.slice(-10000);
      }
      ctx += '\n[출원 명세서 원문 — 보정 검증 기준]\n' + specBlock + '\n\n';
    } else {
      specWarn = true;
      ctx += '\n[⚠️ 출원 명세서 원문 미제공]\n명세서 파일이 업로드되지 않았거나 텍스트 추출에 실패했다. spec_basis 단락 검증 결과는 LLM이 명세서를 직접 보지 않은 상태에서 생성된 것이므로 신뢰성이 낮다. 변리사 수동 확인 필수.\n\n';
    }

    var prompts = {
      inventive_step: '위 보정 청구항 초안을 명세서 원문과 대조하여 4중 뒷받침 검증을 수행해 주세요.\n\n각 보정된 구성요소에 대해:\n1. term_existence: 보정 문언의 용어가 명세서에 존재하는지\n2. context_match: 해당 맥락에서 사용되는지\n3. combination_check: 조합이 명세서 단일 단락에 기재되는지\n4. cited_ref_origin: 인용발명 유래 용어가 아닌지\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"보정된 문언","checks":[{"check_type":"term_existence","result":"pass|warn|fail","detail":"구체적 근거"}],"overall_result":"pass|warn|fail"}]}',
      description_deficiency: '위 수정 청구항이 보정 범위(최초 명세서 범위) 내에 있는지 검증해 주세요.\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"수정 사항","checks":[{"check_type":"within_scope|resolved","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}]}',
      partial_rejection: '위 병합 청구항의 적법성을 검증해 주세요.\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"검증 항목","checks":[{"check_type":"merge_accuracy|dependency|new_matter|scope","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}]}'
    };
    var vr = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n'+ctx+prompts[t],
      '{"summary":{"total":4,"pass":2,"warn":1,"fail":1},"elements":[{"element_no":1,"element_text":"...","checks":[{"check_type":"term_existence","result":"pass","detail":"..."}],"overall_result":"pass"}]}'
    );
    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at startValidation');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }
    if (specWarn) {
      vr._spec_unverified = true; // 사이클 2: 명세서 미제공 검증 경고 플래그
      showToast('명세서 원문 미제공 — 검증 결과 신뢰성 낮음. 변리사 수동 확인 필수', 'info');
    }
    await sb.from('opinion_validation_results').insert({project_id:p.id,validation_type:t,result_data:vr,summary:vr.summary||{}});
    Opinion.state.validation=vr;
    await Opinion.setStatus(p.id,vs);
    Opinion.renderDetail();
    showToast('검증 완료');
  }catch(e){
    console.error('[Opinion] Validation error:', e);
    showToast('검증 실패: '+e.message,'error');
    // 검증 실패 시 이전 상태로 복구 (Gate 2에서 재시도 가능)
    var fallback=t==='description_deficiency'?'corrections_drafted':t==='partial_rejection'?'merge_drafted':'claims_drafted';
    await Opinion.setStatus(p.id,fallback);
    Opinion.renderDetail();
  }
};

// ═══ renderDraft: 청구항 보정 + 검증 통합 뷰 (기존 draft+validate+gate2 병합) ═══
Opinion.renderDraft=function(L,R,status){
  var p=Opinion.state.current,v=Opinion.state.validation||{},sm=v.summary||{};
  var draftReady=['claims_drafted','corrections_drafted','merge_drafted'].indexOf(status)>=0;
  var ready=['validated','correction_validated','merge_validated'].indexOf(status)>=0;
  var loading=['drafting_claims','drafting_corrections','drafting_merge','validating'].indexOf(status)>=0;

  if(loading && !draftReady && !ready){
    var msg=status==='validating'?'검증 중...':'청구항 보정 중...';
    var desc=status==='validating'?'심사관과 변리사가 뒷받침 검증을 수행하고 있습니다':'심사관과 변리사가 보정안을 협의하고 있습니다';
    Opinion.renderLoading(L,R,msg,desc);return;
  }

  var nav=Opinion.renderNavBar('draft');

  // 왼쪽: 토론 + 검증 요약 + 확정 버튼
  var draftData = Opinion.state.draftResult||{};
  var discussionHtml = '';
  if (draftData.discussion && draftData.discussion.length) {
    discussionHtml = '<div style="margin-bottom:12px">'+Opinion.renderDiscussion(draftData.discussion)+'</div>';
  }

  // ─── spec_basis 검증 실패 / 명세서 미제공 빨간 배너 (P0 #17 사이클 2) ───
  var specBasisHtml = '';
  var sbc = draftData._spec_basis_check;
  if (sbc && sbc.ok === false) {
    var missingDetail = (sbc.missing || []).map(function(m){
      return '<li>청구항 ' + m.claim_no + ': ' + escapeHtml((m.missing_paragraphs || []).join(', ')) + '</li>';
    }).join('');
    specBasisHtml = '<div style="margin-top:12px;padding:12px;background:var(--color-error-light,#fef2f2);border-radius:8px;border-left:3px solid var(--color-error,#ef4444)">'
      +'<div style="font-weight:600;font-size:13px;color:var(--color-error,#ef4444);margin-bottom:6px">⚠️ 보정 근거 단락이 명세서에 없음 — §47② 신규사항 추가 위험</div>'
      +'<ul style="font-size:12px;color:var(--color-error,#ef4444);line-height:1.7;margin:6px 0 6px 18px">'+missingDetail+'</ul>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">변리사가 명세서 원문과 직접 대조 확인 후 Gate 2 진행 시 우회 가능합니다.</p>'
      +'</div>';
  } else if (sbc && sbc.ok === null) {
    specBasisHtml = '<div style="margin-top:12px;padding:10px;background:var(--color-warning-light,#fef3c7);border-radius:8px;border-left:3px solid var(--color-warning,#f59e0b)">'
      +'<div style="font-size:12px;color:#92400e;font-weight:600">📄 명세서 원문 미제공 — spec_basis 검증 skip</div>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">명세서 파일을 업로드하시면 보정 근거 단락이 자동 검증됩니다.</p>'
      +'</div>';
  }

  var valHtml = '';
  if (ready && sm.total) {
    valHtml = '<div style="margin-top:12px;margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:8px"><span class="tossface">🔬</span> 뒷받침 검증</div>'
      +'<div class="opinion-val-summary"><div class="opinion-val-stat pass">✅ 통과 '+(sm.pass||0)+'</div><div class="opinion-val-stat warn">⚠️ 주의 '+(sm.warn||0)+'</div><div class="opinion-val-stat fail">❌ 실패 '+(sm.fail||0)+'</div></div>';
    if (v._spec_unverified) {
      valHtml += '<div style="margin-top:6px;font-size:11px;color:#92400e;background:var(--color-warning-light,#fef3c7);padding:6px 8px;border-radius:6px">⚠️ 명세서 원문 미제공 — LLM이 명세서 없이 검증한 결과. 변리사 수동 확인 필수.</div>';
    }
    valHtml += '</div>';
  }

  L.innerHTML=nav+'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">📝</span> 청구항 보정 + 검증</div>'
    +'<p style="font-size:13px;color:var(--color-text-secondary)">심사관과 변리사가 보정안을 검토하고 뒷받침 검증까지 완료했습니다.</p>'
    +specBasisHtml+discussionHtml+valHtml
    +(ready?'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(2)"><span class="tossface">✏️</span> 수정</button><button class="btn btn-primary" id="btnGate2Approve" onclick="Opinion.approveGate(2)"><span class="tossface">✅</span> 확정</button></div>':'')
    +'</div>';

  // 오른쪽: 검증 보고서 항목
  var items=v.elements||v.results||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tf">🔬</span> 검증 보고서</div></div>'
    +(items.length?items.map(function(e,i){
      var r=e.overall_result||e.result||'pass';
      var checks=e.checks||[];
      return '<div class="opinion-val-item '+r+'" onclick="this.classList.toggle(\'expanded\')">'
        +'<div class="opinion-val-item-header">'
        +'<div class="el-no">'+(e.element_no||(i+1))+'</div>'
        +'<div class="el-label" style="line-height:1.5">'+escapeHtml(e.element_text||e.detail||'항목 '+(i+1))+'</div>'
        +'<div class="el-result">'+(r==='pass'?'✅ 통과':r==='warn'?'⚠️ 주의':'❌ 실패')+'</div>'
        +'</div>'
        +'<div class="opinion-val-item-body">'
        +(checks.length?checks.map(function(c){
          var ci=c.result==='pass'?'✅':c.result==='warn'?'⚠️':'❌';
          return '<div style="display:flex;gap:8px;padding:6px 0;align-items:flex-start">'
            +'<span>'+ci+'</span>'
            +'<div><b>'+escapeHtml(Opinion.getCheckLabel(c.check_type||''))+'</b>: '+escapeHtml(c.detail||'')+'</div>'
            +'</div>';
        }).join(''):'<div>'+escapeHtml(e.detail||JSON.stringify(e,null,2))+'</div>')
        +'</div></div>';
    }).join(''):'<p style="padding:20px;text-align:center;color:var(--color-text-tertiary)">검증 결과 없음</p>')
    +'</div>';
};

// ═══ Opinion Draft (전체 컨텍스트 + 참고 양식 전달) ═══
Opinion.TEMPLATE_GUARD = '\n\n⚠️ 중요 규칙: [참고 의견서 양식]은 톤·구조·문장 패턴만 참고하세요. 양식에 포함된 구체적 사건 내용(출원번호, 발명 명칭, 구성요소 설명, 인용발명 내용, 청구항 문언 등)을 절대 사용하지 마세요. 모든 내용은 반드시 [파싱 결과]와 [분석 결과]의 현재 대상 사건 정보로만 작성하세요.';

Opinion.startOpinionDraft=async function(){
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  await Opinion.setStatus(p.id,'drafting_opinion');
  Opinion.renderDetail();
  try{
    var t=p.rejection_type;
    var ctx = await Opinion.getContext(['parsed','analysis','draft','validation','ref']);
    if (run && run.signal.aborted) return;
    var revNote = Opinion.state.lastRevisionNote || '';
    var revCtx = revNote ? '\n\n[사용자 수정 지시]\n'+revNote+'\n이 지시를 반드시 반영하여 의견서를 작성하세요.\n' : '';
    Opinion.state.lastRevisionNote = '';

    // ★ 토론 형식 + 섹션 마커 방식으로 생성 ★
    var tpl={
      inventive_step: '위 자료를 기반으로 진보성 위반(§29②) 의견서를 작성해 주세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 의견서를 작성하세요.\n'
        +'- 변리사가 각 섹션 초안을 제시하면, 심사관이 약점을 지적합니다.\n'
        +'- 변리사가 지적 사항을 보완하여 최종안을 작성합니다.\n'
        +'- 인용발명과의 차이에 대해 더 구체적으로 기술적 예시를 포함하여 작성하세요.\n'
        +'- 보정내용에는 반드시 명세서 문단 번호(【0001】형식)를 표기하세요.\n\n'
        +'의견서 양식 템플릿의 형식을 따르되, 아래 섹션 구분자(## 제목)를 반드시 사용하세요.\n'
        +'각 섹션은 구체적이고 상세하게, 명세서 단락번호(【0001】형식)를 인용하여 작성하세요.\n'
        +'JSON 형식이 아닌 일반 텍스트로 작성하세요.\n\n'
        +'## 서두\n(통지서 수령 확인. "상기 출원에 대한 의견제출통지서를 수령하였기에...")\n\n'
        +'## 1. 보정내용\n(보정 개요 + 보정 청구항 전문. 각 보정사항에 명세서 문단 번호 【0000】 표기 필수)\n\n'
        +'## 2. 보정의 적법성\n(각 보정사항별 명세서 근거 단락. "상기 보정은 명세서 【0000】에 기재된 범위 내...")\n\n'
        +'## 3. 구체적 의견내용\n\n'
        +'### (1) 본원발명의 기술적 요지\n(본원 발명의 핵심 기술 요약)\n\n'
        +'### (2) 인용발명들의 기술적 요지\n(인용발명별 핵심 기술 요약)\n\n'
        +'### (3) 본원발명과 인용발명의 대비\n(구성요소별 구체적 차이점 논증. 기술적 예시를 들어 구체적으로. 가. 구성요소 ❶... 나. 구성요소 ❷...)\n\n'
        +'### (4) 결합의 용이성에 대한 반박\n'
        +'(아래 4가지 논거 중 사안에 적용 가능한 것을 모두 채택. 가능하면 2개 이상 결합)\n'
        +'  ① 결합의 동기·시사·암시 부재 — 인용발명들에 본원의 결합 방향을 시사하는 기재가 있는지 검토. 없으면 명시.\n'
        +'  ② 사후적 고찰(hindsight)의 위험성 — 심사관의 결합 판단이 본원 발명의 구성을 알고 인용발명들을 재해석한 결과론적 판단인지 검토.\n'
        +'     대법원 판례: 통상의 기술자가 본원의 출원시점으로 돌아가서도 동일한 결합을 시도할 동기가 있는지 기준으로 판단해야 함.\n'
        +'     ★ 인용발명 2건 이상의 결합 거절 케이스에서는 반드시 이 논거를 포함하라. 단, 단독 인용 케이스는 생략 가능.\n'
        +'  ③ 현저한 효과 — 본원이 인용발명들로부터 예측 불가능한 정량적·정성적 효과를 갖는지 명세서 단락 인용으로 도출.\n'
        +'  ④ 부정적 시사(teach away) — 인용발명이 본원의 결합 방향과 반대를 시사하는지 검토. 적용 가능하면 강력한 논거.\n\n'
        +'### (5) 소결\n\n'
        +'## 4. 결론\n("이상과 같이 본원발명은... 특허등록되어야 합니다.")',

      description_deficiency: '위 자료를 기반으로 기재불비 위반(§42② / §42④ — 통지서의 구체 조항에 따름) 의견서를 작성해 주세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 의견서를 작성하세요.\n'
        +'아래 섹션 구분자(## 제목)를 사용하여 작성. JSON이 아닌 일반 텍스트.\n'
        +'보정내용에는 반드시 명세서 문단 번호(【0001】형식)를 표기하세요.\n\n'
        +'★★★ §42 분리 섹션 규칙 (분석 결과의 deficiency_type 별로 분리):\n'
        +'아래 1)~5) 중 분석 결과(items[].deficiency_type)에 등장한 키만 해당 섹션을 생성하라.\n'
        +'  - clarity            → "## 5. 청구항 명확성에 대하여 (§42② 1호)"\n'
        +'  - support            → "## 6. 발명의 설명에 의한 뒷받침에 대하여 (§42② 4호)"\n'
        +'  - description_lack   → "## 7. 발명의 설명 기재불비에 대하여 (§42④ 1호)"\n'
        +'  - description_support → "## 8. 청구항이 발명의 설명에 의해 뒷받침되지 않는 점에 대하여 (§42④ 2호)"\n'
        +'  - inconsistent       → "## 9. 청구항 기재의 일관성에 대하여 (§42②/④ 일반)"\n'
        +'★ 분석 결과에 없는 키의 섹션은 절대 생성하지 마라. 빈 섹션을 만들면 의견서가 부풀려진다.\n'
        +'★ 각 분리 섹션 내부 구조: (1) 심사관 지적 요지 1~2줄 → (2) 변리사 의견(보정 내용 또는 반박) → (3) 결어. 두 섹션이 같은 보정으로 해소되면 cross-reference 사용.\n'
        +'★ description_lack(§42④ 1호) 섹션에는 "본 사안은 명세서 보정이 필요한 사안으로, 본 의견서와 함께 명세서 보정서를 별도 제출합니다" 안내를 반드시 포함.\n\n'
        +'[기본 구조]\n'
        +'## 서두\n(통지서 수령 확인)\n\n'
        +'## 1. 보정내용\n(수정 전·후 대비. 각 수정에 명세서 단락번호 표기)\n\n'
        +'## 2. 보정의 적법성\n(최초 명세서 범위 내 / 신규사항 없음)\n\n'
        +'## 3. 구체적 의견내용\n(아래 §42 분리 섹션의 도입부 1~2줄. 상세 논변은 분리 섹션에 둠)\n\n'
        +'## 4. 결론\n("이상과 같이 거절이유는 모두 해소되었으므로, 특허등록되어야 합니다.")\n\n'
        +'[§42 분리 섹션 — 분석 결과에 등장한 키만 생성]\n'
        +'(여기에 위 5종 키 중 해당하는 것만 ## 헤더로 추가. 헤더 번호는 5번부터 시작.)',

      partial_rejection: '위 자료를 기반으로 일부 청구항 거절 의견서를 작성해 주세요.\n\n'
        +'★ 토론 형식: 특허청 파트장 심사관과 20년차 수석 변리사가 번갈아 대화하면서 의견서를 작성하세요.\n'
        +'의견서 양식 템플릿의 형식을 따르되, 아래 섹션 구분자(## 제목)를 사용하여 작성. JSON이 아닌 일반 텍스트.\n'
        +'보정내용에는 반드시 명세서 문단 번호 표기.\n\n'
        +'## 서두\n\n## 1. 보정내용\n(병합 사실 + 삭제, 문단 번호 표기)\n\n'
        +'## 2. 보정의 적법성\n(종속항 병합=신규사항 아님)\n\n'
        +'## 3. 구체적 의견내용\n(병합된 구성의 차이점 논증 — 기술적 예시 포함)\n\n## 4. 결론'
    };

    var prompt = Opinion.SYS_PROMPT + Opinion.TEMPLATE_GUARD + '\n\n' + ctx + revCtx + tpl[t];
    var r = await App.callClaude(prompt);
    Opinion.usage.calls++;  // callForJSON이 아닌 직접 호출이므로 수동 카운트
    Opinion.updateUsageDisplay();

    // LLM 응답 도착 후 이탈 체크 — DB 저장 전 (P2 #24)
    if (run && run.signal.aborted) {
      console.log('[Opinion.run] aborted at startOpinionDraft');
      showToast('이전 작업이 취소되었습니다', 'info');
      return;
    }

    // ★ 섹션 마커 기반 파싱 (JSON 불필요) ★
    var od = Opinion.parseOpinionSections(r.text);

    // 양식 내용 오염 검증
    var fullText = od.sections.map(function(s){return s.content;}).join('\n');
    var check = Opinion.validateNoTemplateContamination(fullText);
    if (!check.clean) {
      console.warn('[Opinion] Template contamination:', check.warnings.length, 'items');
      od._contamination_warnings = check.warnings;
    }

    // ─── 사후적 고찰(hindsight) 키워드 검증 (Cycle 4 P1 #14) ───
    // inventive_step에서 인용발명 2건 이상 결합 거절일 때 사후적 고찰 논거가 등장했는지 코드 레벨 체크
    if (t === 'inventive_step') {
      var hindsightKw = /사후적|hindsight|결합의\s*동기|teach\s*away|부정적\s*시사/i;
      if (!hindsightKw.test(fullText)) {
        console.warn('[Opinion.opinion] 사후적 고찰 논거 미검출 — prompt 강도 검토 필요');
        od._hindsight_missing = true;
      }
    }

    await sb.from('opinion_opinion_drafts').insert({project_id:p.id,opinion_type:t,content:od,status:'draft'});
    Opinion.state.opinionDraft=od;
    await Opinion.setStatus(p.id,'opinion_drafted');
    Opinion.renderDetail();
    showToast('의견서 초안 생성 완료 (' + od.sections.length + '개 섹션)');
  }catch(e){
    console.error('[Opinion] Opinion draft error:', e);
    showToast('의견서 생성 실패: '+e.message,'error');
    await Opinion.setStatus(p.id,'claims_confirmed');
    Opinion.renderDetail();
  }
};

// ★ 의견서 텍스트를 ## 섹션으로 분리하는 파서 ★
Opinion.parseOpinionSections = function(text) {
  if (!text) return { title: '의견서', sections: [] };

  var sections = [];
  // ## 또는 ### 로 시작하는 라인을 섹션 구분자로
  var lines = text.split('\n');
  var currentHeading = '';
  var currentContent = [];
  var foundAnySection = false;

  lines.forEach(function(line) {
    var headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      // 이전 섹션 저장
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading || '(서문)',
          content: currentContent.join('\n').trim()
        });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
      foundAnySection = true;
    } else {
      currentContent.push(line);
    }
  });

  // 마지막 섹션 저장
  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading || (foundAnySection ? '(후문)' : '의견서'),
      content: currentContent.join('\n').trim()
    });
  }

  // 섹션이 1개도 안 만들어졌으면 전체를 하나의 섹션으로
  if (sections.length === 0) {
    sections.push({ heading: '의견서', content: text.trim() });
  }

  // 제목에서 ## 마커 제거, 빈 content 섹션 필터
  sections = sections.filter(function(s) { return s.content.length > 0; });

  return { title: '의견서', sections: sections };
};

Opinion.renderOpinion=function(L,R,status){
  var ready=status==='opinion_drafted';
  var loading=status==='drafting_opinion'||status==='claims_confirmed';
  var nav=Opinion.renderNavBar('opinion');
  var o=Opinion.state.opinionDraft||{};

  if(loading && !ready){
    Opinion.renderLoading(L,R,'의견서 작성 중...','심사관과 변리사가 의견서를 협의하고 있습니다');return;
  }

  var contamWarnings = o._contamination_warnings || [];
  var contamHtml = '';
  if (contamWarnings.length > 0) {
    contamHtml = '<div style="margin-top:12px;padding:12px;background:var(--color-error-light);border-radius:8px;border-left:3px solid var(--color-error)">'
      +'<div style="font-weight:600;font-size:12px;color:var(--color-error);margin-bottom:6px">⚠️ 참고 양식 내용 혼입 의심 ('+contamWarnings.length+'건)</div>'
      +'<div style="font-size:11px;color:var(--color-error);line-height:1.6">'
      +contamWarnings.map(function(w){return '• "'+escapeHtml(w.template_fragment)+'" ('+w.match_length+'자 일치)';}).join('<br>')
      +'</div>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:6px">의견서 내용이 현재 사건이 아닌 참고 양식의 사건 정보를 포함할 수 있습니다. 해당 부분을 확인해 주세요.</p>'
      +'</div>';
  }
  L.innerHTML=nav+(ready?'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">📝</span> 의견서 작성 완료</div><p style="font-size:13px;color:var(--color-text-secondary)">의견서를 검토하고 승인하면 최종 출력물이 생성됩니다.</p>'
    +contamHtml
    +'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(3)"><span class="tf">✏️</span> 수정</button><button class="btn btn-primary" id="btnGate3Approve" onclick="Opinion.approveGate(3)"><span class="tf">✅</span> 승인</button></div></div>':'<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">의견서 작성 중...</div></div>');
  var secs=o.sections||[];
  var opinionHtml = '';
  if (secs.length) {
    opinionHtml = secs.map(function(s) {
      var content = escapeHtml(s.content || '');
      // 핵심 용어 강조
      content = content.replace(/(【\d+】)/g, '<span style="color:var(--color-primary);font-weight:600">$1</span>');
      content = content.replace(/(청구항\s*(?:제?\s*)?\d+(?:\s*항)?)/g, '<span style="font-weight:600">$1</span>');
      content = content.replace(/(인용발명\s*\d*|인용문헌\s*\d*)/g, '<span style="color:var(--color-error);font-weight:500">$1</span>');
      content = content.replace(/(본원발명|본원)/g, '<span style="color:var(--color-primary);font-weight:500">$1</span>');
      content = content.replace(/\n/g, '<br>');
      return '<div class="opinion-section">'
        + '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:var(--color-text-primary);border-bottom:1px solid var(--color-divider);padding-bottom:6px">' + escapeHtml(s.heading || '') + '</div>'
        + '<div style="line-height:1.9;color:var(--color-text-secondary)">' + content + '</div></div>';
    }).join('');
  } else {
    opinionHtml = '<p style="color:var(--color-text-tertiary);text-align:center;padding:40px">의견서 미생성</p>';
  }
  R.innerHTML='<div class="opinion-preview"><div class="opinion-preview-header"><span style="font-weight:600"><span class="tf">📝</span> '+escapeHtml(o.title||'의견서')+'</span></div><div class="opinion-preview-body">'+opinionHtml+'</div></div>';
};

// ═══ Output + DOCX Download ═══
Opinion.startOutput=async function(){var p=Opinion.state.current;if(!p)return;await Opinion.setStatus(p.id,'completed');Opinion.renderDetail();showToast('의견서 대응 완료 — 다운로드해 주세요');};

// ═══ renderOutput: 최종 확인 + 출력 (기존 gate3+output 병합) ═══
Opinion.renderOutput=function(L,R,status){
  var done=status==='completed' || status==='approved';
  var nav=Opinion.renderNavBar('output');

  // 왼쪽: 출력물 다운로드
  var amendDisabled = !done;
  var amendTip = done ? '' : ' title="Gate 3 승인 후 활성화"';
  L.innerHTML=nav+'<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📥</span> 최종 확인 + 출력</div></div>'
    +'<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">의견서 대응이 완료되었습니다. 다운로드하여 특허로에 제출하세요.</p>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.downloadOpinionDocx()"'+(done?'':' disabled')+'><span class="tossface">📝</span> 의견서 (Word)</button>'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.downloadAmendmentDocx()"'+(amendDisabled?' disabled':'')+amendTip+'><span class="tossface">📄</span> 보정서 (Word, 별지 제13호)</button>'
    +'<button class="btn btn-outline btn-full" onclick="Opinion.downloadDocx(\'all\')"'+(done?'':' disabled')+'><span class="tossface">📋</span> 전체 (의견서+검증보고서)</button>'
    +'<button class="btn btn-ghost btn-full" onclick="Opinion.copyOpinionText()"'+(done?'':' disabled')+'><span class="tossface">📋</span> 텍스트 복사</button>'
    +'</div></div>';

  // 오른쪽: 의견서 미리보기 (기존 gate3의 미리보기)
  var o=Opinion.state.opinionDraft||{};
  var secs=o.sections||[];
  var opinionHtml = '';
  if (secs.length) {
    opinionHtml = secs.map(function(s) {
      var content = escapeHtml(s.content || '');
      content = content.replace(/(【\d+】)/g, '<span style="color:var(--color-primary);font-weight:600">$1</span>');
      content = content.replace(/(청구항\s*(?:제?\s*)?\d+(?:\s*항)?)/g, '<span style="font-weight:600">$1</span>');
      content = content.replace(/(인용발명\s*\d*|인용문헌\s*\d*)/g, '<span style="color:var(--color-error);font-weight:500">$1</span>');
      content = content.replace(/(본원발명|본원)/g, '<span style="color:var(--color-primary);font-weight:500">$1</span>');
      content = content.replace(/\n/g, '<br>');
      return '<div class="opinion-section">'
        + '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:var(--color-text-primary);border-bottom:1px solid var(--color-divider);padding-bottom:6px">' + escapeHtml(s.heading || '') + '</div>'
        + '<div style="line-height:1.9;color:var(--color-text-secondary)">' + content + '</div></div>';
    }).join('');
  } else {
    opinionHtml = done?'<div style="text-align:center;padding:40px"><div style="font-size:48px;margin-bottom:12px"><span class="tossface">🎉</span></div><h3 style="font-size:18px;font-weight:700;color:var(--color-success);margin-bottom:8px">의견서 대응 완료!</h3></div>':'<p style="color:var(--color-text-tertiary);text-align:center;padding:40px">의견서 미생성</p>';
  }
  R.innerHTML='<div class="opinion-preview"><div class="opinion-preview-header"><span style="font-weight:600"><span class="tossface">📝</span> '+escapeHtml(o.title||'의견서')+' 미리보기</span></div><div class="opinion-preview-body">'+opinionHtml+'</div></div>';
};

// 의견서 텍스트 조합 (JSON sections 형식 + raw string 형식 모두 지원)
Opinion.getOpinionFullText = function() {
  var o=Opinion.state.opinionDraft;
  if(!o) return '';

  // sections 배열이 있는 경우
  if(o.sections && o.sections.length) {
    return o.sections.map(function(s){ return (s.heading?'## '+s.heading+'\n\n':'')+s.content; }).join('\n\n');
  }

  // raw_text가 있는 경우 (JSON 파싱 실패했던 케이스)
  if(o.raw_text) return o.raw_text;

  // string인 경우
  if(typeof o === 'string') return o;

  return '';
};

// 클립보드 복사
Opinion.copyOpinionText = function() {
  var text = Opinion.getOpinionFullText();
  if(!text){showToast('복사할 의견서가 없습니다','error');return;}
  navigator.clipboard.writeText(text).then(function(){showToast('의견서 텍스트가 복사되었습니다');}).catch(function(){
    var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('복사됨');
  });
};

// 의견서 단독 다운로드 (Cycle 4 P0 #15 — 라우터)
Opinion.downloadOpinionDocx = function() { return Opinion.downloadDocx('opinion'); };

// ─── 보정서 다운로드 (KIPO 별지 제13호 양식, Cycle 4 P0 #15) ───
Opinion.downloadAmendmentDocx = async function() {
  var p = Opinion.state.current; if (!p) return;
  // Gate 3 승인 후에만 가능
  var status = (p.status || '').toLowerCase();
  if (status !== 'completed' && status !== 'approved') {
    showToast('Gate 3 승인 후 다운로드 가능합니다', 'error');
    return;
  }
  // draftResult / parsed 확보
  var dr = Opinion.state.draftResult;
  if (!dr) {
    try {
      var{data:d}=await sb.from('opinion_draft_claims').select('draft_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (d && d.draft_data) { dr = d.draft_data; Opinion.state.draftResult = dr; }
    } catch(_) {}
  }
  if (!dr) { showToast('보정 청구항 데이터가 없습니다', 'error'); return; }

  var parsedData = null;
  try {
    var{data:pd}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (pd) parsedData = pd.parsed_data;
  } catch(_) {}

  var html = Opinion._buildAmendmentDocxHtml(p, dr, parsedData || {});
  var fullHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    +'<head><meta charset="utf-8"><style>body{font-family:"맑은 고딕",sans-serif;font-size:11pt;line-height:1.7}h1{font-size:18pt;text-align:center}h2{font-size:13pt;margin-top:16pt;border-bottom:1px solid #999;padding-bottom:4pt}h3{font-size:12pt;margin-top:10pt}.amend-claim{border:1px solid #ccc;padding:10pt;margin:8pt 0;background:#fafafa}.amend-old{color:#666;text-decoration:line-through}.amend-new{font-weight:600;color:#000}.amend-reason{font-size:10pt;color:#444;margin-top:6pt}</style></head>'
    +'<body>'+html+'</body></html>';
  var blob = new Blob(['﻿'+fullHtml], {type:'application/msword'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var datestr = new Date().toISOString().slice(0,10);
  a.href = url; a.download = '보정서_' + (p.application_no||p.title||'output') + '_' + datestr + '.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('보정서 다운로드 완료');
};

// 보정서 HTML 본문 빌더 (KIPO 별지 제13호 구조)
Opinion._buildAmendmentDocxHtml = function(project, draftResult, parsedData) {
  var t = project.rejection_type;
  var appNo = parsedData.application_no || project.application_no || '';
  var applicant = parsedData.applicant || '';
  var inventionTitle = parsedData.invention_title || project.title || '';

  var amendedArr = draftResult.amended_claims || draftResult.corrected_claims || (draftResult.merged_claim ? [draftResult.merged_claim] : []);
  var origClaims = (parsedData.claims || []);
  var origByNo = {}; origClaims.forEach(function(c){ origByNo[c.no] = c; });

  var html = '';
  html += '<h1>보 정 서</h1>';
  html += '<h2>【사건의 표시】</h2>';
  html += '<p>출원번호: ' + escapeHtml(appNo) + '</p>';
  if (applicant) html += '<p>출원인: ' + escapeHtml(applicant) + '</p>';
  if (inventionTitle) html += '<p>발명의 명칭: ' + escapeHtml(inventionTitle) + '</p>';

  html += '<h2>【보정의 대상】</h2>';
  html += '<p>□ 명세서 &nbsp;&nbsp; □ 도면 &nbsp;&nbsp; ☑ 청구범위</p>';

  html += '<h2>【보정의 내용】</h2>';

  // 가. 보정 전
  html += '<h3>가. 보정 전</h3>';
  if (!amendedArr.length) {
    html += '<p>(보정 대상 청구항 없음)</p>';
  } else {
    amendedArr.forEach(function(ac){
      var origText = ac.original || (origByNo[ac.claim_no] && origByNo[ac.claim_no].text) || '';
      html += '<div class="amend-claim"><div><b>【청구항 ' + escapeHtml(String(ac.claim_no)) + '】</b></div>'
            + '<div class="amend-old">' + escapeHtml(origText).replace(/\n/g,'<br>') + '</div></div>';
    });
  }

  // 나. 보정 후
  html += '<h3>나. 보정 후</h3>';
  amendedArr.forEach(function(ac){
    var newText = ac.amended || ac.corrected || ac.text || '';
    html += '<div class="amend-claim"><div><b>【청구항 ' + escapeHtml(String(ac.claim_no)) + '】</b></div>'
          + '<div class="amend-new">' + escapeHtml(newText).replace(/\n/g,'<br>') + '</div></div>';
  });
  // partial_rejection의 deleted_claims도 표시
  if (Array.isArray(draftResult.deleted_claims) && draftResult.deleted_claims.length) {
    html += '<p style="color:#900"><b>삭제된 청구항:</b> ' + draftResult.deleted_claims.map(function(n){ return '【청구항 '+n+'】'; }).join(', ') + '</p>';
  }

  // 다. 보정 사유
  html += '<h3>다. 보정 사유</h3>';
  amendedArr.forEach(function(ac){
    var basis = ac.spec_basis;
    var basisStr = '';
    if (Array.isArray(basis)) basisStr = basis.join(', ');
    else if (typeof basis === 'string') basisStr = basis;
    var summary = ac.amendments_summary || (ac.changes ? ac.changes.map(function(ch){ return ch.detail||ch.type; }).join('; ') : '');
    html += '<div class="amend-reason"><b>청구항 ' + escapeHtml(String(ac.claim_no)) + ':</b> '
          + escapeHtml(summary || '명세서 기재 범위 내에서 보정.')
          + (basisStr ? ' <i>(근거 단락: ' + escapeHtml(basisStr) + ')</i>' : '')
          + '</div>';
  });

  // §47② 신규사항 추가 금지 적시
  html += '<p style="margin-top:12pt;font-size:10pt;color:#444">※ 본 보정은 특허법 제47조 제2항에 따라 최초 명세서 또는 도면에 기재된 사항의 범위 내에서 이루어졌습니다.</p>';

  // description_lack 케이스 안내
  if (t === 'description_deficiency') {
    var items = (Opinion.state.analysis && (Opinion.state.analysis.items || [])) || [];
    var hasDescLack = items.some(function(it){ return it && it.deficiency_type === 'description_lack'; });
    if (hasDescLack) {
      html += '<p style="margin-top:8pt;font-size:10pt;color:#900;background:#fff8e1;padding:8pt;border-left:3px solid #f59e0b">'
            + '※ 본 보정서는 청구범위 보정만 포함합니다. 명세서 보정은 별첨 명세서 보정서를 참조하여 변리사가 수동 작성합니다.'
            + '</p>';
    }
  }

  return html;
};

// Word 다운로드 (HTML→Word 방식)
Opinion.downloadDocx = async function(type) {
  var p=Opinion.state.current; if(!p) return;

  // 데이터가 없으면 DB에서 로드 + 정규화
  if (!Opinion.state.opinionDraft || !(Opinion.state.opinionDraft.sections||[]).length) {
    try {
      var{data:o}=await sb.from('opinion_opinion_drafts').select('content').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(o && o.content) {
        var c = o.content;
        if (typeof c === 'string') {
          Opinion.state.opinionDraft = Opinion.parseOpinionSections(c);
        } else if (c.raw_text) {
          Opinion.state.opinionDraft = Opinion.parseOpinionSections(c.raw_text);
        } else {
          Opinion.state.opinionDraft = c;
        }
      }
    } catch(e){}
  }
  // 그래도 없으면 전체 텍스트로 시도
  if (!Opinion.state.opinionDraft || !(Opinion.state.opinionDraft.sections||[]).length) {
    var ft = Opinion.getOpinionFullText();
    if (ft) {
      Opinion.state.opinionDraft = Opinion.parseOpinionSections(ft);
    }
  }
  if (!Opinion.state.validation) {
    try {
      var{data:v}=await sb.from('opinion_validation_results').select('result_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(v && v.result_data) Opinion.state.validation = v.result_data;
    } catch(e){}
  }
  var content='';
  var fileName='';

  if(type==='opinion'||type==='all') {
    var o=Opinion.state.opinionDraft||{};
    var secs=o.sections||[];
    content+='<h1 style="text-align:center;font-size:18pt">의 견 서</h1>\n';
    content+='<p style="text-align:right">출원번호: '+escapeHtml(p.application_no||'')+'</p>\n';
    content+='<p style="text-align:right">사건명: '+escapeHtml(p.title||'')+'</p>\n<hr>\n';
    secs.forEach(function(s){
      content+='<h2 style="font-size:14pt;margin-top:20pt">'+escapeHtml(s.heading||'')+'</h2>\n';
      content+='<p style="font-size:11pt;line-height:1.8;text-align:justify">'+escapeHtml(s.content||'').replace(/\n/g,'<br>')+'</p>\n';
    });
    fileName='의견서_'+escapeHtml(p.application_no||p.title||'output');
  }

  if(type==='all') {
    var v=Opinion.state.validation||{};
    var items=v.elements||v.results||[];
    if(items.length) {
      content+='<div style="page-break-before:always"></div>\n';
      content+='<h1 style="text-align:center;font-size:18pt">검증 보고서</h1>\n';
      var sm=v.summary||{};
      content+='<p>통과: '+(sm.pass||0)+' / 주의: '+(sm.warn||0)+' / 실패: '+(sm.fail||0)+'</p>\n';
      items.forEach(function(e,i){
        var r=e.overall_result||e.result||'pass';
        var icon=r==='pass'?'✅':r==='warn'?'⚠️':'❌';
        content+='<h3>'+icon+' '+(e.element_no||(i+1))+'. '+escapeHtml(e.element_text||e.detail||'')+'</h3>\n';
        (e.checks||[]).forEach(function(c){
          var ci=c.result==='pass'?'✅':c.result==='warn'?'⚠️':'❌';
          content+='<p>'+ci+' <b>'+escapeHtml(Opinion.getCheckLabel(c.check_type||''))+'</b>: '+escapeHtml(c.detail||'')+'</p>\n';
        });
      });
      fileName='의견서+검증보고서_'+escapeHtml(p.application_no||p.title||'output');
    }
  }

  if(!content){showToast('다운로드할 내용이 없습니다','error');return;}

  // HTML → Word blob
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    +'<head><meta charset="utf-8"><style>body{font-family:"맑은 고딕",sans-serif;font-size:11pt;line-height:1.6}h1{font-size:18pt}h2{font-size:14pt;margin-top:16pt}h3{font-size:12pt}p{margin:4pt 0;text-align:justify}</style></head>'
    +'<body>'+content+'</body></html>';

  var blob=new Blob(['\ufeff'+html],{type:'application/msword'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=fileName+'.doc';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('다운로드 완료');
};

Opinion.renderFailed=function(L,R){
  var detail = Opinion.state.parseFailDetail || '파일에서 텍스트를 추출할 수 없었습니다.';
  L.innerHTML='<div class="card" style="padding:24px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span class="tf" style="font-size:32px">⚠️</span><div><h3 style="font-size:16px;font-weight:600;color:var(--color-error);margin-bottom:2px">파싱 실패</h3><p style="font-size:12px;color:var(--color-text-secondary)">텍스트 추출에 문제가 있습니다</p></div></div>'
    +'<pre style="white-space:pre-wrap;font-size:12px;background:var(--color-bg-tertiary);padding:14px;border-radius:8px;line-height:1.6;color:var(--color-text-secondary);max-height:200px;overflow-y:auto">'+escapeHtml(detail)+'</pre>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.resetToUpload()"><span class="tf">📁</span> 파일 추가/변경 후 재시도</button>'
    +'<button class="btn btn-outline btn-full" onclick="Opinion.resetToUploadWithManual()"><span class="tf">✏️</span> 직접 텍스트 입력으로 전환</button>'
    +'</div></div>';
  R.innerHTML='<div class="card" style="padding:24px"><div style="font-weight:600;font-size:13px;margin-bottom:12px"><span class="tf">💡</span> PDF 인식이 안 되는 경우</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.8">'
    +'<p><b>원인 1: 이미지 스캔 PDF</b><br>특허청에서 발송한 PDF가 텍스트가 아닌 이미지로 된 경우입니다. Adobe Acrobat이나 한글 뷰어에서 열어 텍스트를 복사해서 붙여넣어 주세요.</p>'
    +'<p style="margin-top:10px"><b>원인 2: 암호화된 PDF</b><br>비밀번호가 걸린 PDF는 텍스트 추출이 불가능합니다. PDF 비밀번호를 해제한 후 다시 업로드하세요.</p>'
    +'<p style="margin-top:10px"><b>원인 3: HWP 파일</b><br>HWP는 브라우저에서 직접 읽을 수 없습니다. 한글에서 열어 텍스트를 복사해서 붙여넣어 주세요.</p>'
    +'</div></div>';
};
Opinion.resetToUpload=async function(){
  var p=Opinion.state.current;
  if(p){ await Opinion.setStatus(p.id,'created'); /* 파일 목록 유지 */ Opinion.renderDetail(); }
};
Opinion.resetToUploadWithManual=async function(){
  var p=Opinion.state.current;
  if(p){
    await Opinion.setStatus(p.id,'created');
    Opinion.renderDetail();
    // 수동 입력 자동 펼침
    setTimeout(function(){
      var det=document.getElementById('opinionManualInput');
      if(det) det.open=true;
      var ta=document.getElementById('opinionManualText');
      if(ta) ta.focus();
    }, 100);
  }
};

// ═══ Utilities ═══
Opinion.setStatus=async function(id,s){try{await sb.from('opinion_projects').update({status:s,updated_at:new Date().toISOString()}).eq('id',id);var p=Opinion.state.current;if(p&&p.id===id)p.status=s;Opinion.state.projects.forEach(function(x){if(x.id===id)x.status=s;});}catch(e){console.error('[Opinion] status:',e);}};
Opinion.loadData=async function(id){try{
  // 5개 독립 쿼리를 병렬 실행
  var results = await Promise.all([
    sb.from('opinion_issue_analyses').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_draft_claims').select('draft_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_validation_results').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_opinion_drafts').select('content').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_type_determinations').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  var a=results[0].data, d=results[1].data, v=results[2].data, o=results[3].data, t=results[4].data;

  if(a && a.result_data) {
    var ad = a.result_data;
    if (ad._parse_failed && ad.raw_text) {
      var reparsed = Opinion.parseJSON(ad.raw_text);
      Opinion.state.analysis = reparsed._parse_failed ? ad : reparsed;
    } else {
      Opinion.state.analysis = ad;
    }
  }
  if(d && d.draft_data) {
    var dd = d.draft_data;
    if (dd._parse_failed && dd.raw_text) {
      var reparsed2 = Opinion.parseJSON(dd.raw_text);
      Opinion.state.draftResult = reparsed2._parse_failed ? dd : reparsed2;
    } else {
      Opinion.state.draftResult = dd;
    }
  }
  if(v) Opinion.state.validation=v.result_data;
  if(o && o.content) {
    var c = o.content;
    if (typeof c === 'string') {
      Opinion.state.opinionDraft = Opinion.parseOpinionSections(c);
    } else if (c.sections && c.sections.length) {
      Opinion.state.opinionDraft = c;
    } else if (c.raw_text) {
      Opinion.state.opinionDraft = Opinion.parseOpinionSections(c.raw_text);
    } else {
      Opinion.state.opinionDraft = c;
    }
  }
  if(t) Opinion.state.typeResult=t;
}catch(e){console.warn('[Opinion] loadData:',e);}Opinion.renderDetail();};
// ═══ 강화된 JSON 파서 (5단계 추출 시도) ═══
Opinion.parseJSON = function(text) {
  if (!text) return {};

  // 전략 1: ```json ... ``` 블록
  var m = text.match(/```json\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch(e) {} }

  // 전략 2: ``` ... ``` 블록 (언어 미지정)
  m = text.match(/```\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch(e) {} }

  // 전략 3: 첫 번째 { ... 마지막 } 추출 (가장 큰 JSON 객체)
  var firstBrace = text.indexOf('{');
  var lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch(e) {}
  }

  // 전략 4: 첫 번째 [ ... 마지막 ] 추출 (배열)
  var firstBracket = text.indexOf('[');
  var lastBracket = text.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket && (firstBrace < 0 || firstBracket < firstBrace)) {
    try { return JSON.parse(text.slice(firstBracket, lastBracket + 1)); } catch(e) {}
  }

  // 전략 5: 줄바꿈 기준 각 줄에서 JSON 시도
  var lines = text.split('\n');
  var jsonStart = -1;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim();
    if (l.startsWith('{') || l.startsWith('[')) { jsonStart = i; break; }
  }
  if (jsonStart >= 0) {
    var candidate = lines.slice(jsonStart).join('\n');
    var end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (end > 0) {
      try { return JSON.parse(candidate.slice(0, end + 1)); } catch(e) {}
    }
  }

  // 모두 실패 → raw_text로 반환 (재파싱 시도 대상)
  console.warn('[Opinion] JSON parse failed, returning raw_text (' + text.length + ' chars)');
  return { _parse_failed: true, raw_text: text };
};

// ═══ JSON 추출 실패 시 LLM 재호출로 변환 ═══
Opinion.ensureJSON = async function(data, schemaHint) {
  // 이미 유효한 JSON이면 그대로
  if (!data._parse_failed) return data;

  console.log('[Opinion] Retrying JSON extraction...');
  try {
    var retryPrompt = '아래 텍스트에서 데이터를 추출하여 반드시 유효한 JSON만 반환하세요.\n'
      + '설명, 인사말, 마크다운 없이 순수 JSON만.\n\n'
      + '요구 형식:\n' + schemaHint + '\n\n'
      + '---\n' + (data.raw_text || '').slice(0, 12000);
    var r = await App.callClaude(retryPrompt);
    var parsed = Opinion.parseJSON(r.text);
    if (!parsed._parse_failed) {
      console.log('[Opinion] JSON retry succeeded');
      return parsed;
    }
  } catch(e) {
    console.warn('[Opinion] JSON retry failed:', e);
  }
  // 그래도 실패하면 원본 반환
  return data;
};

// ═══ LLM 호출 + JSON 보장 래퍼 (usage 추적 포함) ═══
Opinion.callForJSON = async function(prompt, schemaHint) {
  var jsonPrompt = prompt + '\n\n⚠️ 반드시 유효한 JSON만 출력하세요. 설명, 인사말, 마크다운(```) 없이 { 또는 [ 로 시작하여 } 또는 ] 로 끝나는 순수 JSON만.';
  var r = await App.callClaude(jsonPrompt);
  Opinion.usage.calls++;
  Opinion.updateUsageDisplay();
  var parsed = Opinion.parseJSON(r.text);
  if (parsed._parse_failed && schemaHint) {
    parsed = await Opinion.ensureJSON(parsed, schemaHint);
  }
  return parsed;
};

console.log('[Opinion] Module loaded (v2.0)');
