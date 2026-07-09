/* ═══════════════════════════════════════════════════════════
   의견서 대응 자동화 v2.0 — opinion.js
   3대 거절이유: A(진보성) / B(기재불비) / C(일부거절)
   namespace: window.Opinion  |  DB: opinion_*  |  CSS: opinion-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Opinion = window.Opinion || {};

// ═══ Constants ═══
Opinion.TYPES = {
  inventive_step:         { code:'A', label:'진보성/신규성 위반',    icon: '<span class="ico" data-icon="scales"></span>', css:'type-a',       law:'§29①②' },
  description_deficiency: { code:'B', label:'기재불비 위반',         icon: '<span class="ico" data-icon="edit"></span>', css:'type-b',       law:'§42② / §42④' },
  partial_rejection:      { code:'C', label:'일부 청구항 거절',      icon: '<span class="ico" data-icon="clipboard"></span>', css:'type-c',       law:'§29 등' },
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
Opinion.state = { projects:[], current:null, view:'list', viewStep:null, files:[], analysis:null, draftResult:null, validation:null, opinionDraft:null, typeResult:null, gateDecisions:{}, refText:'', customTemplate:null, _secondary_warned:false, _mixed_mode:false, _mixed_primary:null, _mixed_secondary:null, _templateForbiddenSpans:[], drafting:false, draftError:null };

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
  Opinion.state.parsedDoc         = null;   // ★ DB-backed parsed_data 캐시(진실원천) — 프로젝트 전환 시 교차오염 방지
  Opinion.state.analysis          = null;
  Opinion.state.draftResult       = null;
  Opinion.state._pendingRewrite   = null;   // D2a: 승인 방향 splice 재작성 보류본(확정 전 draftResult 미변경)
  Opinion.state.validation        = null;
  Opinion.state.opinionDraft      = null;
  Opinion.state.typeResult        = null;
  Opinion.state._strategies       = null;
  Opinion.state.selectedStrategy  = null;
  Opinion.state.selectedStrategyIndex = null;
  Opinion.state._typeNeedsManual  = false; // Cycle 1 플래그
  Opinion.state._secondary_warned = false; // Cycle 3 혼합 거절 확인 플래그
  Opinion.state._mixed_mode       = false; // Cycle 5 혼합 모드 플래그
  Opinion.state._mixed_primary    = null;  // Cycle 5 주 거절 유형 (스냅샷)
  Opinion.state._mixed_secondary  = null;  // Cycle 5 부 거절 유형 (스냅샷)
  Opinion.state._templateForbiddenSpans = []; // Cycle 7 양식 금지 구간 캐시
  Opinion.state.drafting          = false; // Cycle 8 의견서 작성 진행 플래그 (loading 결정용)
  Opinion.state.draftError        = null;  // Cycle 8 의견서 작성 에러 ({kind, message})
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

// 청구항 텍스트에서 인용 번호 추출
// (1) "제 N항 내지 제 M항" → N~M 범위 전체 (다중종속)
// (2) "제 N항", "청구항 N" → 단일 인용
Opinion._extractClaimReferences = function(text) {
  if (!text) return [];
  var refs = {};

  // (1) 범위 인용: "제 N항 내지 제 M항"
  var rangeRe = /제\s*(\d+)\s*항\s*내지\s*제\s*(\d+)\s*항/g;
  var rm;
  while ((rm = rangeRe.exec(text)) !== null) {
    var start = parseInt(rm[1], 10);
    var end   = parseInt(rm[2], 10);
    // 상한 50 방어: 비정상적 범위("제1항 내지 제999항")로 인한 루프 폭주 차단
    if (start > 0 && end >= start && (end - start) <= 50) {
      for (var i = start; i <= end; i++) refs[i] = true;
    }
  }

  // (2) 단일/또는 인용: "제 N항", "청구항 N"
  var singleRe = /제\s*(\d+)\s*항|청구항\s*(?:제\s*)?(\d+)/g;
  var sm;
  while ((sm = singleRe.exec(text)) !== null) {
    var n = parseInt(sm[1] || sm[2], 10);
    if (n > 0) refs[n] = true;
  }

  return Object.keys(refs).map(function(s){ return parseInt(s, 10); }).sort(function(a, b){ return a - b; });
};

// ═══════════════════════════════════════════════════════════════════
// [T6] WriterModule 연동 — 통합 리뷰 엔진(review-engine)과의 계약 2함수.
//   기존 작성·자기검토 로직은 일절 변경하지 않는다(추가만).
//   simulate/rollback은 opinion.js에 넣지 않는다(SIMULATE_MODE 옵션 B):
//   단조성용 simulate는 리뷰 엔진이 ReviewState deepClone 사본에서 처리한다.
// ═══════════════════════════════════════════════════════════════════

// _resolveParsedDoc — ★ 단일 진실원천(공유 헬퍼). 게이트·exportSnapshot 이 모두 이걸 읽는다.
//   실제 파싱결과(claims·cited_references·rejection_reasons·application_no)는 state.parsed(유령필드)가
//   아니라 DB(opinion_parsed_documents.parsed_data)에 산다 → _loadParsedDoc 가 캐시한 state.parsedDoc 를 본다.
//   동기 함수: 캐시 미적재면 {} (호출측이 _loadParsedDoc 로 선적재). 레거시 픽스처 호환 위해 state.parsed 폴백.
Opinion._resolveParsedDoc = function() {
  var s = Opinion.state || {};
  return s.parsedDoc || s.parsed || {};
};

// _loadParsedDoc — DB재조회로 parsed_data 를 state.parsedDoc 에 1회 캐시(이후 동기 접근 가능).
//   기존 소비처(:1575/:2552/:3454)와 동일 쿼리. 파싱·저장 로직은 불변(읽기 캐시만 추가).
Opinion._loadParsedDoc = async function() {
  var s = Opinion.state || {};
  if (s.parsedDoc) return s.parsedDoc;            // 캐시 히트
  var cur = s.current;
  if (!cur || !cur.id) return null;
  try {
    var { data: pd } = await sb.from('opinion_parsed_documents').select('parsed_data')
      .eq('project_id', cur.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (pd && pd.parsed_data) { Opinion.state.parsedDoc = pd.parsed_data; return pd.parsed_data; }
  } catch (_e) {}
  return Opinion.state.parsedDoc || null;
};

// exportSnapshot — 원본(Opinion.state) 변형 없이 깊은 복사본 반환(I-1, 읽기전용).
//   반환 형상은 profiles/opinion/adapter.js: adaptSnapshot 입력과 정합.
//   parsed 는 _resolveParsedDoc(단일 진실원천)에서 — runReviewEngine 이 호출 전 _loadParsedDoc 로 선적재.
Opinion.exportSnapshot = function() {
  var s = Opinion.state || {};
  var parsed = Opinion._resolveParsedDoc();
  var cur = s.current || null;
  var projection = {
    caseId: parsed.application_no || (cur && cur.application_no) || '',
    reviewId: cur ? ('rev_' + (cur.id || parsed.application_no || 'opinion')) : undefined,
    parsed: parsed,
    typeResult: s.typeResult || null,
    draftResult: s.draftResult || null,
    refText: s.refText || '',
    analysis: s.analysis || null,
    validation: s.validation || null
  };
  // 깊은 복사로 원본과 완전 격리(I-1). structuredClone 우선, 폴백 JSON.
  try { return structuredClone(projection); }
  catch (e) { return JSON.parse(JSON.stringify(projection)); }
};

// applyAmendments — 사람 승인 PatchPlan만 실(實)반영(구조적) + 정합성 재검증(§7⑤).
//   ★ I-2/E-19: accepted !== true 가 하나라도 있으면 throw(미승인 미반영).
//   ★ 산문 청구항 텍스트는 재작성하지 않는다(op.content=보정 "방향", attorney_author 계약).
//     승인된 방향을 amended_claims[].review_amendments[] 에 구조적으로 기록하고 정합성을 재검증한다.
//   ★ 원자성(E-27): 작업 사본에 적용→검증→커밋(commit-at-end). 예외 시 Opinion.state 불변.
Opinion.applyAmendments = function(acceptedPlans) {
  if (!Array.isArray(acceptedPlans)) throw new Error('applyAmendments: plans 배열 필요');
  acceptedPlans.forEach(function(pl) {
    if (!pl || pl.accepted !== true) {
      throw new Error('applyAmendments: 미승인 plan 반영 불가 (I-2/E-19) — ' + (pl && pl.id));
    }
  });

  var s = Opinion.state || {};
  // 작업 사본(원본 격리) — 예외 시 원본 보존.
  var working;
  try { working = structuredClone(s.draftResult || {}); }
  catch (e) { working = JSON.parse(JSON.stringify(s.draftResult || {})); }
  var amended = working.amended_claims || working.corrected_claims || (working.merged_claim ? [working.merged_claim] : []);
  var byNo = {};
  amended.forEach(function(ac) { if (ac && ac.claim_no != null) byNo[String(ac.claim_no)] = ac; });

  // 승인 op를 대상 청구항에 구조적으로 기록(문언 날조 금지 — 대상 보정 청구항 없으면 skip).
  var applied = [];
  acceptedPlans.forEach(function(pl) {
    (pl.ops || []).forEach(function(op) {
      var no = String(op.target || '').replace(/^claim_/, '');
      var ac = byNo[no];
      if (!ac) return;
      ac.review_amendments = ac.review_amendments || [];
      ac.review_amendments.push({
        op: op.op, direction: op.content || '',
        reason: op.reason || (pl.addressesIssues || [])[0] || '', planId: pl.id,
        approvedBy: (typeof App !== 'undefined' && App.currentUser && App.currentUser.email) || 'human'
      });
      applied.push({ planId: pl.id, claim_no: no, op: op.op });
    });
  });

  // 정합성 재검증(§7⑤) — 기존 _validate* 재사용(동작 불변).
  var parsed = s.parsed || {};
  var rejectedNos = [];
  (parsed.rejection_reasons || []).forEach(function(r) {
    (r.claim_nos || r.target_claims || []).forEach(function(n) { rejectedNos.push(n); });
  });
  var finalClaims = (parsed.claims || []).map(function(c) {
    var ac = byNo[String(c.no)];
    return { no: c.no, text: ac ? (ac.amended || c.text) : c.text };
  });
  var consistency = {
    specBasis: Opinion._validateSpecBasis(amended, s.refText || ''),
    preservation: Opinion._validateClaimPreservation(parsed.claims || [], working, rejectedNos),
    references: Opinion._validateClaimReferences(finalClaims)
  };

  // 커밋-앳-엔드(원자성): 검증 완료된 working 을 원본에 반영(유일 커밋 지점).
  working.amended_claims = amended;
  working._review_applied = applied;
  working._review_consistency = consistency;
  Opinion.state.draftResult = working;

  return { applied: applied, consistency: consistency, count: applied.length };
};

// _collectApprovedDirections — D1: AI 검증에서 "승인된" 보정 방향만 수집(read-only).
//   applyAmendments 가 accepted plan 의 op.content(방향)만 amended_claims[].review_amendments 에 기록하므로,
//   여기서 모이는 것은 승인분뿐이다(미승인 0 — I-2/E-19 구조 보장). 완성 문언이 아닌 "방향"이며
//   ac.amended(청구항 문언)는 변경하지 않는다(attorney 계약). 방향이 없으면 빈 배열.
//   반환: [{ claim_no, directions:[비어있지 않은 방향 문자열...] }]
Opinion._collectApprovedDirections = function(draftResult) {
  var dr = draftResult || {};
  var arr = dr.amended_claims || dr.corrected_claims || (dr.merged_claim ? [dr.merged_claim] : []);
  var out = [];
  (arr || []).forEach(function(ac) {
    if (!ac) return;
    var dirs = (Array.isArray(ac.review_amendments) ? ac.review_amendments : [])
      .map(function(ra) { return ra && ra.direction ? String(ra.direction) : ''; })
      .filter(function(d) { return d.trim(); });
    if (dirs.length) out.push({ claim_no: ac.claim_no, directions: dirs });
  });
  return out;
};

// applyDirectionRewrite — D2a(옵션 B splice): 승인된 보정 "방향"을 ★대상 청구항만★ LLM 으로 재작성하고,
//   나머지 청구항은 직전 draftResult 문언을 그대로 복사(byte-identical)한다.
//   ─ ★ 범위제어가 프롬프트 부탁이 아니라 코드(splice)로 보장된다: 비대상 청구항은 LLM 에 보내지도, 건드리지도
//     않는다(structuredClone 후 대상 ac 의 문언/근거 필드만 교체). → 비대상 drift 구조적 불가.
//   ─ ★ 결과는 즉시 적용하지 않고 state._pendingRewrite 에 "보류"한다(자동적용 금지 — D2c 변리사 확정에서 커밋).
//     draftResult 를 변경하지 않으므로 review_amendments(D1 입력)도 보존된다.
//   ─ ★ 승인(onChange/AC-T1)이 이 함수를 자동 호출하지 않는다 — 별도 명시 액션(버튼)으로만 호출(D2c 배선).
//   ─ client-side LLM(callForJSON→App.callClaude) — edge wall-clock 무관. 대상 청구항 1건씩 호출(비용↓·격리).
//   @param {{claimNos?:(number|string)[]}} [opts]  특정 대상만(생략 시 승인된 방향 전체)
//   @returns {Promise<object|null>} state._pendingRewrite(보류본) 또는 null
Opinion.applyDirectionRewrite = async function(opts) {
  opts = opts || {};
  var p = Opinion.state.current; if (!p) return null;
  var dr = Opinion.state.draftResult;
  if (!dr) { showToast('보정 청구항 데이터가 없습니다', 'error'); return null; }

  // 1) 승인 방향 수집(승인분만). opts.claimNos 주어지면 그 교집합만.
  var approved = Opinion._collectApprovedDirections(dr);
  if (Array.isArray(opts.claimNos) && opts.claimNos.length) {
    var want = opts.claimNos.map(String);
    approved = approved.filter(function(e) { return want.indexOf(String(e.claim_no)) >= 0; });
  }
  if (!approved.length) { showToast('반영할 승인 보정 방향이 없습니다', 'info'); return null; }

  // 2) ★ splice 토대: draftResult 깊은 복제(원본 불변 → review_amendments 보존). 비대상은 이 복제본 그대로 유지.
  var pending = structuredClone(dr);
  var pendingArr = pending.amended_claims || pending.corrected_claims || (pending.merged_claim ? [pending.merged_claim] : []);
  var byNo = {}; pendingArr.forEach(function(ac) { if (ac && ac.claim_no != null) byNo[String(ac.claim_no)] = ac; });

  // 3) 명세서 근거(뒷받침·신규사항 방지). 프롬프트는 30K head+tail 트림, 게이트(D2b)는 full 사용.
  var specFull = '';
  try { specFull = (await Opinion.extractSpecificationText(p.id)) || ''; } catch (_e) {}
  var specBlock = specFull;
  if (specBlock.length > 30000) specBlock = specBlock.slice(0, 20000) + '\n...[중략]...\n' + specBlock.slice(-10000);

  // 4) ★ 대상 청구항만 1건씩 재작성 → 해당 ac 의 문언/근거 필드만 교체(나머지 필드·비대상 청구항 불변).
  var rewritten = [], failed = [], before = {}, after = {};
  for (var i = 0; i < approved.length; i++) {
    var tgt = approved[i];
    var ac = byNo[String(tgt.claim_no)];
    if (!ac) { failed.push({ claim_no: tgt.claim_no, reason: 'draft에 대상 청구항 없음' }); continue; }
    var origText = ac.amended || ac.corrected || ac.text || ac.original || '';
    var prompt = Opinion.SYS_PROMPT + '\n\n'
      + '[대상 청구항 ' + tgt.claim_no + ' — 오직 이 청구항 하나만 보정한다. 다른 청구항은 출력하지 마라]\n'
      + '현재 문언:\n' + origText + '\n\n'
      + '[반영할 승인 보정 방향(AI 검증 통과·변리사 승인)]\n' + tgt.directions.map(function(d) { return '· ' + d; }).join('\n') + '\n\n'
      + (specBlock ? '[출원 명세서 원문 — 뒷받침 근거]\n' + specBlock + '\n\n'
                   : '[⚠️ 명세서 원문 미제공 — spec_basis 신뢰성 낮음, 변리사 확인 필수]\n\n')
      + '★ 규칙:\n'
      + '1. 위 "승인 보정 방향"을 청구항 ' + tgt.claim_no + ' 문언에 반영한다.\n'
      + '2. 방향과 무관한 부분은 현재 문언을 최대한 유지한다(불필요한 재서술·과축소 금지).\n'
      + '3. 모든 보정 구성은 명세서 기재 범위 내에서만(신규사항 추가 금지 §47, 인용발명 유래 용어 금지).\n'
      + '4. 근거 단락을 spec_basis 에 【0000】 형식으로 명시한다.\n'
      + '5. 청구항 ' + tgt.claim_no + ' 한 항만 출력한다.\n\n'
      + 'JSON: {"claim_no":' + tgt.claim_no + ',"amended":"보정후 청구항 전문","amendments_summary":"보정 요약","amendment_methods":[{"method":"한정|부가|구체화","target":"보정 대상 구성","spec_paragraph":"【0035】","description":"명세서 근거 보정 내용"}],"spec_basis":["【0035】"]}';
    var out = null;
    try { out = await Opinion.callForJSON(prompt, '{"claim_no":1,"amended":"...","spec_basis":["【0001】"]}'); }
    catch (e) { failed.push({ claim_no: tgt.claim_no, reason: 'LLM 호출 실패: ' + ((e && e.message) || e) }); continue; }
    if (!out || out._parse_failed || !out.amended || !String(out.amended).trim()) {
      failed.push({ claim_no: tgt.claim_no, reason: '재작성 응답 파싱 실패/빈 문언' }); continue;
    }
    // ★ splice: 이 대상 ac 의 문언·근거만 교체. claim_no·original·per_cited_ref_diff·review_amendments 등은 보존.
    before[String(tgt.claim_no)] = origText;
    after[String(tgt.claim_no)] = String(out.amended);
    ac.amended = String(out.amended);
    if (Array.isArray(out.spec_basis)) ac.spec_basis = out.spec_basis;
    if (Array.isArray(out.amendment_methods)) ac.amendment_methods = out.amendment_methods;
    if (out.amendments_summary) ac.amendments_summary = String(out.amendments_summary);
    ac._d2_rewritten = true;              // D2 반영 표시(D2d 공존 라벨용)
    ac._d2_directions = tgt.directions;   // 반영한 승인 방향(추적)
    rewritten.push(tgt.claim_no);
  }

  if (!rewritten.length) { showToast('재작성 실패 — ' + (failed[0] ? failed[0].reason : '대상 없음'), 'error'); return null; }

  // ── D2b: 재작성본(pending) 검증 게이트 재실행(부수효과 방어) — pending 에만 적용, draftResult 불변. ──
  var parsedClaims = [], rejectedNos = [];
  try {
    var{data:_pd}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (_pd && _pd.parsed_data) {
      parsedClaims = _pd.parsed_data.claims || [];
      (_pd.parsed_data.rejection_reasons || []).forEach(function(rr){ (rr.claim_nos||[]).forEach(function(n){ if (rejectedNos.indexOf(n)<0) rejectedNos.push(n); }); });
    }
  } catch (_e) {}
  var gates = Opinion._gatePendingRewrite(pending, dr, { targetClaimNos: rewritten, parsedClaims: parsedClaims, rejectedNos: rejectedNos, specText: specFull });

  // 5) ★ 보류(자동적용 금지): draftResult 는 그대로 두고 후보만 state._pendingRewrite 에. D2c 확정에서 커밋.
  Opinion.state._pendingRewrite = {
    draftResult: pending,         // 확정 시 state.draftResult 로 커밋할 후보
    targetClaimNos: rewritten,    // 재작성된 claim_no
    failed: failed,               // 실패 대상(있으면)
    before: before, after: after, // D2c 비교 diff용 (재작성 전/후 문언)
    gates: gates,                 // D2b: 게이트 결과(blockers/warnings/canConfirm) — D2c 가 표시·차단에 사용
    createdAt: new Date().toISOString(),
  };
  // CRITICAL(비대상 불변 위반)만 확정 차단, 나머지(spec_basis/뒷받침/참조)는 경고(변리사 판단 여지).
  if (!gates.canConfirm) showToast('⚠️ 재작성 무결성 위반(비대상 청구항 변경 감지) — 확정 차단, 변리사 확인 필요', 'error');
  else if (gates.warnings.length) showToast('재작성 완료(청구항 ' + rewritten.join(', ') + ') — 경고 ' + gates.warnings.length + '건, 변리사 확정 검토', 'info');
  else showToast('승인 방향 반영(재작성) 완료 — 청구항 ' + rewritten.join(', ') + ' · 변리사 확정 대기', 'success');
  return Opinion.state._pendingRewrite;
};

// _gatePendingRewrite — D2b: 재작성 보류본(pending)에 검증 게이트를 재실행(부수효과 방어). 순수 함수(DB·LLM 없음).
//   ★ baseline(직전 draftResult) 대비 "비대상 청구항 불변" 단언(신규) + 기존 게이트 3종 재사용(재구현 0).
//   차단 정책: 비대상 불변 위반(splice 무결성)만 CRITICAL → 확정 차단(canConfirm=false). spec_basis/뒷받침/참조
//     위반은 경고(변리사 판단 — 차단 안 함). ※ 게이트는 read-only, draftResult·pending 을 변경하지 않는다.
//   @param {object} pending  재작성 보류본 draftResult
//   @param {object} baseline 직전 draftResult(비대상 불변 비교 기준)
//   @param {{targetClaimNos:(number|string)[], parsedClaims:Array, rejectedNos:number[], specText:string}} opts
//   @returns {{invariance,specBasis,preservation,references,blockers:string[],warnings:string[],canConfirm:boolean}}
Opinion._gatePendingRewrite = function(pending, baseline, opts) {
  opts = opts || {};
  var arrOf = function(d){ return d ? (d.amended_claims || d.corrected_claims || (d.merged_claim ? [d.merged_claim] : [])) : []; };
  var pendingArr = arrOf(pending), baseArr = arrOf(baseline);
  var targetSet = {}; (opts.targetClaimNos || []).forEach(function(n){ targetSet[String(n)] = true; });

  // ── [신규 게이트] 비대상 불변(splice 무결성) — CRITICAL ──
  var baseByNo = {}; baseArr.forEach(function(ac){ if (ac && ac.claim_no != null) baseByNo[String(ac.claim_no)] = ac; });
  var drift = [];
  pendingArr.forEach(function(ac){
    if (!ac || ac.claim_no == null) return;
    var no = String(ac.claim_no);
    if (targetSet[no]) return;                       // 대상은 변경 허용
    var b = baseByNo[no];
    if (!b) { drift.push({ claim_no: ac.claim_no, reason: '비대상인데 baseline 에 없음' }); return; }
    if (JSON.stringify(ac) !== JSON.stringify(b)) drift.push({ claim_no: ac.claim_no, reason: '비대상 청구항이 변경됨(byte 불일치)' });
  });
  baseArr.forEach(function(b){                        // 비대상 누락 검출
    if (!b || b.claim_no == null) return;
    var no = String(b.claim_no);
    if (targetSet[no]) return;
    if (!pendingArr.some(function(ac){ return ac && String(ac.claim_no) === no; })) drift.push({ claim_no: b.claim_no, reason: '비대상 청구항 누락' });
  });
  var invariance = { check: 'non_target_invariance', severity: 'CRITICAL', ok: drift.length === 0, drift: drift };

  // ── [기존 게이트 재사용] spec_basis · preservation · references ──
  var specBasis = Opinion._validateSpecBasis(pendingArr, opts.specText || '');
  var preservation = Opinion._validateClaimPreservation(opts.parsedClaims || [], pending, opts.rejectedNos || []);
  var finalClaims = [];
  pendingArr.forEach(function(ac){ finalClaims.push({ no: ac.claim_no, text: ac.amended || ac.corrected || ac.text || '' }); });
  var unchangedNos = Array.isArray(pending && pending.unchanged_claims) ? pending.unchanged_claims
    : (Array.isArray(pending && pending.remaining_claims) ? pending.remaining_claims.map(function(rc){ return rc.new_no || rc.old_no; }) : []);
  unchangedNos.forEach(function(n){
    var oc = (opts.parsedClaims || []).filter(function(x){ return x.no === n; })[0];
    if (oc && !finalClaims.some(function(fc){ return fc.no === n; })) finalClaims.push({ no: n, text: oc.text });
  });
  var references = Opinion._validateClaimReferences(finalClaims);

  // ── 종합: CRITICAL(invariance)만 차단, 나머지는 경고(변리사 판단). ──
  var blockers = [];
  if (!invariance.ok) blockers.push('non_target_invariance');
  var warnings = [];
  if (specBasis.ok === false) warnings.push('spec_basis');
  if (preservation.ok === false) warnings.push('preservation');
  if (references.ok === false) warnings.push('references');

  return {
    invariance: invariance, specBasis: specBasis, preservation: preservation, references: references,
    blockers: blockers, warnings: warnings, canConfirm: blockers.length === 0,
  };
};

// ═══ D2c: 승인 방향 반영 — 비교 확정 UI(사람 방어선) ═══
// startDirectionRewrite — "승인 방향 반영" 버튼 핸들러(★명시 액션). applyDirectionRewrite(D2a splice + D2b gates) → 비교 모달.
//   ★ 승인(onChange/AC-T1)이 자동 호출하지 않는다 — 변리사가 명시적으로 누른다(자동적용 금지).
Opinion.startDirectionRewrite = async function() {
  try { if (typeof setButtonLoading === 'function') setButtonLoading('btnDirectionRewrite', true); } catch (_e) {}
  try {
    var pend = await Opinion.applyDirectionRewrite();   // state._pendingRewrite 생성(보류 — draftResult 불변)
    if (pend) Opinion.showRewriteConfirmModal();
  } catch (e) { showToast('재작성 실패: ' + ((e && e.message) || e), 'error'); }
  finally { try { if (typeof setButtonLoading === 'function') setButtonLoading('btnDirectionRewrite', false); } catch (_e) {} }
};

// _buildRewriteDiffHtml — 보류본 보정 전/후 비교 + 비대상 "변경 없음"(splice 가시화) + 게이트 배너. 순수(HTML 문자열).
Opinion._buildRewriteDiffHtml = function(pend) {
  if (!pend || !pend.draftResult) return '<p style="font-size:13px;color:var(--color-text-secondary)">재작성 보류본이 없습니다.</p>';
  var g = pend.gates || {};
  var tset = {}; (pend.targetClaimNos || []).forEach(function(n){ tset[String(n)] = true; });
  var arr = pend.draftResult.amended_claims || pend.draftResult.corrected_claims || (pend.draftResult.merged_claim ? [pend.draftResult.merged_claim] : []);
  var h = '';
  // 게이트 배너: CRITICAL 차단 / 경고(확정 가능) / 통과
  if (g.canConfirm === false) {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#FDECEC;border-left:3px solid var(--color-error,#D32F2F);color:#9A1C1C;font-size:12px;margin-bottom:12px">⛔ 무결성 위반(비대상 청구항 변경 감지) — 확정 불가. [취소] 후 다시 시도하세요.</div>';
  } else if (g.warnings && g.warnings.length) {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#FEF4E6;border-left:3px solid var(--color-warning,#ED6C02);color:#7A4100;font-size:12px;margin-bottom:12px">⚠️ 경고 ' + g.warnings.length + '건 (' + escapeHtml(g.warnings.join(', ')) + ') — 변리사 검토 후 확정하세요(확정은 가능).</div>';
  } else {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#EAF7EE;border-left:3px solid var(--color-success,#2E7D32);color:#1B5E20;font-size:12px;margin-bottom:12px">✅ 게이트 통과 — 비대상 청구항 불변 확인.</div>';
  }
  // 청구항별: 대상=전/후 diff, 비대상=변경 없음
  arr.forEach(function(ac){
    if (!ac || ac.claim_no == null) return;
    var no = String(ac.claim_no);
    if (tset[no]) {
      var b = (pend.before && pend.before[no]) || '';
      var a = (pend.after && pend.after[no]) || ac.amended || '';
      h += '<div style="border:1px solid var(--color-border,#E0E0E0);border-radius:8px;padding:12px;margin-bottom:10px">'
        + '<div style="font-weight:600;font-size:13px;margin-bottom:6px">청구항 ' + escapeHtml(no) + ' <span style="color:var(--color-primary);font-size:11px">[재작성]</span></div>'
        + '<div style="font-size:12px;color:#9A1C1C;background:#FDECEC;border-radius:6px;padding:8px;margin-bottom:6px"><b>보정 전</b><br>' + escapeHtml(b).replace(/\n/g, '<br>') + '</div>'
        + '<div style="font-size:12px;color:#1B5E20;background:#EAF7EE;border-radius:6px;padding:8px"><b>보정 후</b><br>' + escapeHtml(a).replace(/\n/g, '<br>') + '</div>'
        + '</div>';
    } else {
      h += '<div style="font-size:12px;color:var(--color-text-tertiary);padding:6px 12px">청구항 ' + escapeHtml(no) + ' — <b>변경 없음</b> (splice 보존)</div>';
    }
  });
  return h;
};

// showRewriteConfirmModal — 비교 확정 모달(showRevisionModal 패턴 재사용). CRITICAL 차단 시 [확정] 비활성.
Opinion.showRewriteConfirmModal = function() {
  var pend = Opinion.state._pendingRewrite;
  if (!pend) { showToast('재작성 보류본이 없습니다', 'error'); return; }
  var existing = document.getElementById('opinionRewriteModal'); if (existing) existing.remove();
  var blocked = !!(pend.gates && pend.gates.canConfirm === false);
  var modal = document.createElement('div');
  modal.id = 'opinionRewriteModal'; modal.className = 'modal-overlay'; modal.style.display = 'flex';
  modal.innerHTML = '<div class="modal-content" style="max-width:760px;padding:24px;max-height:82vh;overflow:auto">'
    + '<div class="modal-title" style="font-size:16px;margin-bottom:4px"><span class="ico" data-icon="edit"></span> 승인 방향 반영 — 보정 전/후 비교</div>'
    + '<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:14px">대상 청구항만 재작성됩니다. 비대상 청구항은 변경되지 않습니다(코드 보장). 확정 전에는 기존 보정안이 유지됩니다.</p>'
    + Opinion._buildRewriteDiffHtml(pend)
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    + '<button class="btn btn-ghost" style="flex:1;padding:10px" onclick="Opinion.cancelRewrite()">취소 (폐기)</button>'
    + '<button class="btn btn-primary" style="flex:1;padding:10px" id="btnRewriteConfirm" onclick="Opinion._confirmRewriteClick()"' + (blocked ? ' disabled title="무결성 위반 — 확정 불가"' : '') + '><span class="ico" data-icon="check"></span> 확정 (보정서 반영)</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); }); // 외부 클릭 닫기
  // ★ A-1: [확정] 은 인라인 onclick(Opinion._confirmRewriteClick)으로 [취소]와 배선 통일 — addEventListener 의존 제거(클릭 무반응 방지).
};

// confirmRewrite — ★ 확정: 보류본 → draftResult 커밋(이전까지 불변). CRITICAL 차단 시 거부. review_amendments "반영됨" 마킹.
//   커밋 후 보정서 "보정 후"가 ac.amended 를 자동 렌더(별도 작업 0).
Opinion.confirmRewrite = async function() {
  var pend = Opinion.state._pendingRewrite;
  if (!pend) { showToast('확정할 재작성 보류본이 없습니다', 'error'); return false; }
  if (pend.gates && pend.gates.canConfirm === false) {
    showToast('⚠️ 무결성 위반(비대상 청구항 변경)으로 확정할 수 없습니다 — 취소 후 다시 시도하세요', 'error'); return false;
  }
  var p = Opinion.state.current; if (!p) return false;
  var committed = pend.draftResult;
  // review_amendments 에 "반영됨" 마킹(재작성된 대상 청구항) — D2d 공존 라벨용.
  var arr = committed.amended_claims || committed.corrected_claims || (committed.merged_claim ? [committed.merged_claim] : []);
  var tset = {}; (pend.targetClaimNos || []).forEach(function(n){ tset[String(n)] = true; });
  var stamp = new Date().toISOString();
  arr.forEach(function(ac){
    if (ac && tset[String(ac.claim_no)] && Array.isArray(ac.review_amendments)) {
      ac.review_amendments.forEach(function(ra){ ra.applied = true; ra.appliedAt = stamp; });
    }
  });
  Opinion.state.draftResult = committed;      // ★ 이제서야 커밋
  Opinion.state._pendingRewrite = null;        // 보류 해제
  // B-2: DB 영속 실패를 조용히 삼키지 않고 경고(커밋은 in-memory 로 됐으나 새로고침/재오픈 시 소실 가능 인지).
  try {
    var _ins = await sb.from('opinion_draft_claims').insert({ project_id: p.id, draft_type: p.rejection_type, draft_data: committed, status: 'draft' });
    if (_ins && _ins.error) showToast('⚠️ 재작성은 반영됐으나 저장 실패 — 새로고침 전 보정서를 다운로드하세요', 'error');
  } catch (_e) { showToast('⚠️ 재작성은 반영됐으나 저장 실패 — 새로고침 전 보정서를 다운로드하세요', 'error'); }
  showToast('재작성 확정 — 보정서·의견서에 반영됩니다 (청구항 ' + (pend.targetClaimNos || []).join(', ') + ')', 'success');
  try { if (typeof Opinion.renderDetail === 'function') Opinion.renderDetail(); } catch (_e) {}
  return true;
};

// _confirmRewriteClick — [확정] 버튼 인라인 onclick 핸들러([취소]와 배선 통일, A-1). confirmRewrite(async) 호출 후
//   성공 시 모달 닫음. ★ addEventListener 의존 제거로 "클릭 무반응" 차단. 반환=Promise(테스트 await용; onclick 은 무시).
Opinion._confirmRewriteClick = function() {
  return Opinion.confirmRewrite().then(function(ok){
    if (ok) { try { var m = document.getElementById('opinionRewriteModal'); if (m) m.remove(); } catch (_e) {} }
  });
};

// cancelRewrite — 보류 폐기. draftResult 불변(기존 보정안 유지).
Opinion.cancelRewrite = function() {
  Opinion.state._pendingRewrite = null;
  try { var m = document.getElementById('opinionRewriteModal'); if (m) m.remove(); } catch (_e) {}
  showToast('재작성 취소됨 — 기존 보정안 유지', 'info');
};

// runReviewEngine — [B1] 리뷰 엔진 검증 트리거(클라).
//   토글 게이트(E-21): window.ReviewUI.isEnabled() 가 true 일 때만 동작. OFF면 무동작.
//   흐름: exportSnapshot → runner(prod=edge invoke / test=주입) → reviewState 설정 → renderDetail.
//   runner 는 snapshot 을 받아 { issues, patchPlans, phase, rounds, budget, consensus } 를 반환한다.
Opinion.runReviewEngine = async function(runner, opts) {
  opts = opts || {};
  if (!(typeof window !== 'undefined' && window.ReviewUI && typeof window.ReviewUI.isEnabled === 'function' && window.ReviewUI.isEnabled('opinion'))) {
    return null; // 토글 OFF(마스터 또는 opinion 모듈) → 무동작(기존 동작 불변)
  }
  // ★ 진실원천 선적재 — parsed_data(DB)를 캐시하여 게이트·exportSnapshot 이 동기 접근하게 한다.
  try { await Opinion._loadParsedDoc(); } catch (_e) {}
  // 검증 가능 게이트(보정안 존재) — 미충족 시 안내 후 미발화.
  var gate = Opinion._reviewGate();
  if (!gate.ok) {
    try { showToast(gate.missing.join(', ') + '을(를) 먼저 완료하세요', 'info'); } catch (_e) {}
    return null;
  }
  // 비용·시간 확인(명시 동의 시에만 발화). recheck 재트리거는 동의 세션의 후속이라 재확인 생략.
  if (!opts.recheck && !Opinion._confirmReviewCost(Opinion._reviewCostEstimate())) return null;

  var run = runner || Opinion._reviewRunner || Opinion._defaultReviewRunner;
  if (typeof run !== 'function') return null;
  Opinion._reviewRunner = run; // recheck 재트리거용 보존
  var snapshot = Opinion.exportSnapshot();
  try { setButtonLoading && setButtonLoading('btnOpinionReview', true); } catch (_e) {}
  var result = null;
  try { result = await run(snapshot); }
  finally { try { setButtonLoading && setButtonLoading('btnOpinionReview', false); } catch (_e) {} }
  if (!result) return null;
  Opinion.state.reviewState = result; // 마운트 발화 조건(renderOutput)
  try { if (typeof Opinion.renderDetail === 'function') Opinion.renderDetail(); } catch (_e) {} // 렌더는 best-effort(데이터 흐름 우선)
  try { Opinion.openReviewModal(); } catch (_e) {} // 검증 완료 → 넓은 공유 모달 자동 오픈(2a)
  return result;
};

// _reviewGate — 검증 발화 가능 게이트(보정안 존재). 검증할 청구항·보정이 있어야 의미.
Opinion._reviewGate = function() {
  var s = Opinion.state || {};
  var parsed = Opinion._resolveParsedDoc();   // ★ exportSnapshot 과 동일 진실원천(한 곳만 고치면 둘 다 맞음)
  var dr = s.draftResult || {};
  var hasClaims = !!(parsed.claims && parsed.claims.length);
  var hasAmend = !!(dr.amended_claims && dr.amended_claims.length) || !!(dr.corrected_claims && dr.corrected_claims.length) || !!dr.merged_claim;
  var missing = [];
  if (!hasClaims) missing.push('청구항 파싱');
  if (!hasAmend) missing.push('보정안 작성');
  return { ok: missing.length === 0, missing: missing };
};

// _reviewCostEstimate — 예상 비용·시간. capUsd/maxRounds 는 ReviewUI.policy('opinion') 에서 읽음(하드코딩 0).
Opinion._reviewCostEstimate = function() {
  var pol = null;
  try { if (window.ReviewUI && typeof window.ReviewUI.policy === 'function') pol = window.ReviewUI.policy('opinion'); } catch (_e) {}
  var cap = (pol && pol.capUsd) || 5;
  var rounds = (pol && pol.maxRounds) || 12;
  var minutes = Math.max(1, Math.ceil(rounds * 0.7));
  return { capUsd: cap, maxRounds: rounds, minutes: minutes };
};

// _confirmReviewCost — 비용·시간 사전고지 + 명시 동의(오발화 방지). 테스트에서 override 가능.
Opinion._confirmReviewCost = function(est) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
  var msg = '의견서 AI 검증을 시작합니다.\n\n'
    + '· 예상 최대 비용: 약 $' + est.capUsd + '\n'
    + '· 예상 소요: 최대 약 ' + est.minutes + '분 (최대 ' + est.maxRounds + '라운드)\n\n'
    + '진행하시겠습니까?';
  return window.confirm(msg);
};

// _updateReviewGate — 최종 확인 화면 검증 버튼 활성/비활성 + 안내(renderOutput 에서 호출).
Opinion._updateReviewGate = function() {
  var btn = document.getElementById('btnOpinionReview');
  if (!btn) return;
  var gate = Opinion._reviewGate();
  var msgEl = document.getElementById('opinionReviewGateMsg');
  if (!gate.ok) { btn.disabled = true; if (msgEl) msgEl.textContent = gate.missing.join(', ') + '을(를) 먼저 완료하세요.'; }
  else { btn.disabled = false; if (msgEl) msgEl.textContent = ''; }
};

// _mountReviewResult — 검증 결과를 같은 화면(최종 확인)에 마운트. reviewState 없으면 no-op.
//   승인(Human Gate) → onChange → applyAmendments(승인분, 인메모리) + 결정 빠른 영속. ★ 자동 풀 재검증 제거(AC-T1).
// 결과 모달 옵션(actor + 승인/거부 처리). 자동오픈·재오픈이 공유.
Opinion._reviewModalOpts = function() {
  return {
    actor: (App.currentUser && App.currentUser.email) || '',
    onChange: function(rs){
      var acc = (rs.patchPlans || []).filter(function(pp){ return pp.accepted === true; });
      if (acc.length) { try { Opinion.applyAmendments(acc); } catch (_e) {} }   // 승인분 인메모리 구조 반영(유지)
      // ★ AC-T1: 자동 runReviewEngine(recheck) 제거 — 승인 한 번이 discover부터 풀 재검증을 재실행해 타임아웃하던 버그.
      //   승인/거부는 결정 상태만 빠르게 영속. 재검증은 '의견서 검증 시작' 버튼으로 사용자가 명시적으로.
      try { Opinion._persistReviewDecision(rs); } catch (_e) {}
      // ★ 승인 후 화면 재렌더(클라 렌더 — edge 재검증 아님, AC-T1 보존). renderOutput 이 승인 상태(review_amendments)를
      //   다시 읽어 "승인 방향 반영" 등 조건부 UI 를 갱신한다. ⛔ 풀 재검증(runReviewEngine) 트리거는 그대로 금지.
      try { if (typeof Opinion.renderDetail === 'function') Opinion.renderDetail(); } catch (_e) {}
    }
  };
};
// _persistReviewDecision — 승인/거부 결정 빠른 영속(풀 재검증 아님): review_runs.result 의 patchPlans 상태만 UPDATE.
//   reviewRunId 없으면(동기 폴백 등) 로컬 상태(reviewState)로만 유지하고 영속 생략. best-effort(블로킹 0).
Opinion._persistReviewDecision = function(reviewState) {
  var runId = Opinion.state && Opinion.state.reviewRunId;
  if (!runId || !reviewState) return;
  try { App.sb.from('review_runs').update({ result: reviewState, updated_at: new Date().toISOString() }).eq('id', runId); } catch (_e) {}
};
Opinion.openReviewModal = function() {
  try { if (window.ReviewUI && window.ReviewUI.openModal && Opinion.state.reviewState) window.ReviewUI.openModal(Opinion.state.reviewState, Opinion._reviewModalOpts()); } catch (_e) {}
};
Opinion._mountReviewResult = function() {
  try {
    if (!(window.ReviewUI && Opinion.state.reviewState)) return;
    var _rm = document.getElementById('opinionReviewMount');
    if (!_rm) return;
    // 결과는 넓은 공유 모달(2a)에 표시 — 카드에는 재오픈 버튼만(닫아도 세션 내 reviewState 유지).
    var n = ((Opinion.state.reviewState.issues) || []).length;
    _rm.innerHTML = '<button class="btn btn-outline btn-full" onclick="Opinion.openReviewModal()"><span class="ico" data-icon="shield"></span> 검증 결과 보기' + (n ? ' (' + n + '건)' : '') + '</button>';
  } catch (_e) {}
};

// prod 기본 runner — Supabase Edge Function(review-orchestrate) 호출. 클라는 트리거·구독만(spec §14).
//   ★ B-T3 비동기: review_runs INSERT(run id) → invoke(reviewRunId 동봉 → B-T2 dual-mode 202) → 폴링 → 결과.
//     reviewRunId 없으면(테이블/RLS 불가) 기존 동기 폴백(후방호환).
Opinion._defaultReviewRunner = async function(snapshot) {
  // 사용자 LLM 키·역할배정 동봉(L-T3) — getReviewAuth 가 "1키 전역" 규칙 적용한 keys/assignments 산출.
  //   ★ keys 는 HTTPS body 로 자기 Edge 에만 전달, 절대 로깅 금지(키 노출 방지).
  var auth = (App.getReviewAuth && App.getReviewAuth()) || { keys: {}, assignments: {} };
  // 1) review_runs INSERT(RLS own) → reviewRunId. 실패 시 null → 동기 폴백.
  var reviewRunId = null;
  try {
    var proj = Opinion.state.current || {};
    var uid = (App.currentUser && App.currentUser.id) || null;
    var ins = await App.sb.from('review_runs').insert({ user_id: uid, project_id: String(proj.id || (snapshot && snapshot.caseId) || ''), module: 'opinion', status: 'running' }).select('id').single();
    reviewRunId = ins && ins.data && ins.data.id;
    Opinion.state.reviewRunId = reviewRunId; // 승인/거부 결정 빠른 영속(AC-T1)용
  } catch (_e) {}
  // 2) invoke — reviewRunId 동봉 시 Edge 가 202(비동기) 반환. 미동봉/구 Edge 면 동기 결과.
  var res = await App.sb.functions.invoke('review-orchestrate', { body: { snapshot: snapshot, caseId: snapshot && snapshot.caseId, keys: auth.keys, assignments: auth.assignments, reviewRunId: reviewRunId || undefined } });
  var d = res && res.data;
  if (!reviewRunId) return d || null;                 // 동기 폴백(테이블 없음 등)
  if (d && d.status !== 'running') return d;          // 구 Edge 가 동기로 결과를 준 경우
  // 3) 폴링(progressClient 재사용) — 모달에 "검증 중…" 표시 → done이면 result, failed/타임아웃이면 null.
  try { if (window.ReviewUI && window.ReviewUI.openModalMessage) window.ReviewUI.openModalMessage('검증 중… 잠시만 기다려 주세요'); } catch (_e) {}
  return await Opinion._pollReviewRun(reviewRunId);
};

// _pollReviewRun — review_runs 폴링(progressClient.subscribePolling 재사용). done→result, failed→null,
//   ★ 180s 'running' 고착 → 강제 종료(failed) — worker(백그라운드) 사망 방어.
Opinion._pollReviewRun = function(reviewRunId) {
  return new Promise(function(resolve) {
    if (!(window.ReviewUI && window.ReviewUI.subscribePolling)) { resolve(null); return; }
    var done = false, sub = null;
    function finish(result, msg) {
      if (done) return; done = true;
      try { if (sub && sub.stop) sub.stop(); } catch (_e) {}
      if (msg) { try { window.ReviewUI.openModalMessage(msg); } catch (_e) {} }
      resolve(result);
    }
    var killer = setTimeout(function(){
      // ③ 고착 정리(보조): worker 사망 추정 → 이 run 을 DB 에서도 failed 로 즉시 정리(사용자 즉시 인지).
      //   RLS 로 본인 행만 update, status='running' 인 행만(막 done 된 행 덮어쓰기 방지). 실패해도 무해(pg_cron 백업).
      //   fire-and-forget(await 안 함) — finish 로 UX 는 즉시 종료.
      try {
        App.sb.from('review_runs')
          .update({ status: 'failed', error: 'wall-clock timeout (client killer — worker 사망 추정)' })
          .eq('id', reviewRunId).eq('status', 'running');
      } catch (_e) {}
      finish(null, '검증 시간 초과 — 다시 시도해 주세요');
    }, 180000); // worker 사망 방어
    sub = window.ReviewUI.subscribePolling({
      intervalMs: 2000,
      fetchState: async function() {
        var r = await App.sb.from('review_runs').select('status,phase,result,error').eq('id', reviewRunId).single();
        return (r && r.data) || {};
      },
      isDone: function(s) { return !!(s && (s.status === 'done' || s.status === 'failed')); },
      onTick: function(s) {
        if (done) return;
        if (s && s.status === 'done') { clearTimeout(killer); finish(s.result || null); return; }
        if (s && s.status === 'failed') { clearTimeout(killer); finish(null, '검증 실패: ' + ((s && s.error) || '알 수 없는 오류')); return; }
        try { if (window.ReviewUI.openModalMessage) window.ReviewUI.openModalMessage('검증 중… (' + ((s && s.status) || 'running') + ')'); } catch (_e) {}
      },
    });
  });
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
  // 유형별 템플릿 로드 (partial_rejection 포함 3종)
  var types = ['inventive_step','description_deficiency','partial_rejection'];
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
    h += '<div style="margin-bottom:8px;padding:6px 8px;background:#F7FBFF;border-radius:6px;border-left:3px solid var(--color-primary)">'
      +'<div style="font-size:11px;color:var(--color-primary);font-weight:600"><span class="ico" data-icon="scales"></span> 진보성/신규성</div>'
      +'<div style="font-size:10px;color:var(--color-text-tertiary)">'+escapeHtml(invTpl.name||'커스텀')+' ('+Math.round((invTpl.text||'').length/1000)+'K자)</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="Opinion.clearTemplate(\'inventive_step\')" style="font-size:10px;color:var(--color-error);padding:2px 6px;margin-top:2px"><span class="ico" data-icon="x"></span> 제거</button></div>';
  }

  // 기재불비 템플릿
  var defTpl = templates.description_deficiency;
  if (defTpl) {
    h += '<div style="margin-bottom:8px;padding:6px 8px;background:#FEF4E6;border-radius:6px;border-left:3px solid var(--color-warning)">'
      +'<div style="font-size:11px;color:#663A00;font-weight:600"><span class="ico" data-icon="edit"></span> 기재불비</div>'
      +'<div style="font-size:10px;color:var(--color-text-tertiary)">'+escapeHtml(defTpl.name||'커스텀')+' ('+Math.round((defTpl.text||'').length/1000)+'K자)</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="Opinion.clearTemplate(\'description_deficiency\')" style="font-size:10px;color:var(--color-error);padding:2px 6px;margin-top:2px"><span class="ico" data-icon="x"></span> 제거</button></div>';
  }

  if (!invTpl && !defTpl) {
    h = '<span style="color:var(--color-primary)"><span class="ico" data-icon="clipboard"></span> 기본 양식 사용 중</span>'
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
// sanitizeTemplate()의 {sanitized, forbiddenSpans} 중 sanitized를 반환하고
// forbiddenSpans를 Opinion.state._templateForbiddenSpans에 누적한다.
Opinion.getActiveTemplate = function(type) {
  var templates = Opinion.state.templates || {};
  var sanitized;
  if (templates[type] && templates[type].text) {
    var r = Opinion.sanitizeTemplate(templates[type].text, type);
    sanitized = r.sanitized;
    Opinion.state._templateForbiddenSpans = (Opinion.state._templateForbiddenSpans || []).concat(r.forbiddenSpans);
    return sanitized;
  }
  if (Opinion.state.customTemplate && Opinion.state.customTemplate.text) {
    var r2 = Opinion.sanitizeTemplate(Opinion.state.customTemplate.text, type);
    sanitized = r2.sanitized;
    Opinion.state._templateForbiddenSpans = (Opinion.state._templateForbiddenSpans || []).concat(r2.forbiddenSpans);
    return sanitized;
  }
  var def = Opinion.DEFAULT_TEMPLATES[type] || Opinion.DEFAULT_TEMPLATES.inventive_step;
  return '[의견서 작성 양식]\n구조:\n' + def.structure + '\n\n작성 지침: ' + def.style_notes;
};

// ─── 한국 특허 정형 문구 화이트리스트 ───
// 어느 사건 의견서에나 등장하는 일반적 표현 — 템플릿 오염 false-positive 방지
//
// 검증 예시: "상기 적어도 하나의 프로세서가 복수의 동작을 수행하도록 지시하는 명령어들을 저장하는 메모리를 포함하고"
//   분류 경로: HIGH_RE(청구항번호·인용번호·단락번호·출원번호) 불일치
//             → sanitizeTemplate의 forbiddenSpans에 미추가 → 검증 대상 자체 제외 → 경보 없음 (정상)
//   (KOREAN_PATENT_BOILERPLATE whitelist는 HIGH_RE가 우연히 적중하지만 보일러플레이트인 경우를 위한 2차 보호
//    예: "특허법 제29조 제2항 ... 제3항" — /제\s*\d+\s*항/ 매칭 → 보일러플레이트로 LOW 분류)
var KOREAN_PATENT_BOILERPLATE = [
  '상기 적어도 하나의 프로세서가',      // SW 특허 청구항 정형문
  '복수의 동작을 수행하도록 지시하는 명령어', // SW 특허 청구항 정형문
  '명령어들을 저장하는 메모리를 포함하고',   // SW 특허 청구항 정형문
  '비일시적 컴퓨터 판독 가능 기록매체',      // SW 특허 기록매체 청구항
  '하나 이상의 프로세서에 의해 실행될 때',   // SW 특허 정형문
  '컴퓨터로 읽을 수 있는 기록매체에 저장',   // SW 특허 기록매체
  '수행하도록 구성된 적어도 하나의 프로세서', // SW 특허 정형문
  '데이터를 처리하도록 구성된',             // SW 특허 정형문
  '의견제출통지서를 수령하였기에',           // 의견서 서두 정형문
  '이하와 같이 의견을 제출합니다',           // 의견서 서두 정형문
  '이상과 같이 본원발명은',                 // 의견서 결론 정형문
  '특허등록되어야 마땅합니다',              // 의견서 결론 정형문
  '귀청의 혜량을 바라는 바입니다',          // 의견서 결론 정형문
  '명세서에 기재된 범위 내에서',            // 보정 적법성 정형문
  '신규사항에 해당하지 않습니다',           // 보정 적법성 정형문
  '특허법 제29조 제2항',                   // 법조문 인용
  '특허법 제42조 제4항',                   // 법조문 인용
  '특허법 제47조 제2항',                   // 법조문 인용
  '인용발명에 개시되어 있지 않',            // 진보성 논거 정형문
  '결합의 동기나 암시가 없',               // 진보성 논거 정형문
  '통상의 기술자가 용이하게',              // 진보성 표준 문언
];

// ─── 정형(보일러플레이트) vs 사건고유 판별 — 추출·검증 공유 헬퍼 ───
// ★ 핵심: `제N항` 은 "청구항 제N항(사건고유)" 과 "특허법 제N조 제M항(정형 조문)" 을 구분 못 해
//   정형 서두·조문이 forbiddenSpan→high 로 오검출되던 버그(DIAG-contam-false-positive)를 바로잡는다.
//   추출(sanitizeTemplate)·검증(validateNoTemplateContamination) 양쪽이 ★동일 헬퍼★를 써 기준 불일치를 차단한다.

// 법조 인용 패턴(정형) — 조문의 제N조/제M항/제K호는 사건고유가 아니다(모든 의견서 공통).
//   특허법 제N조 [제M항] [제K호] / 동조 [제M항] [제K호] / 단독 제N호 를 한 토큰으로 본다(띄어쓰기·번호 변형 허용).
var STATUTE_RE = /(?:특허법|실용신안법|디자인보호법|상표법|법)\s*제\s*\d+\s*조(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?|동\s*조(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?|제\s*\d+\s*호/g;

// 한 문장에서 "진짜 사건고유 마커"만 추출(법조 문맥 제거 후 판정). 반환: ['claim'|'cited'|'para'|'appno'...] (없으면 []).
//   ★ 법조(특허법 제N조 제M항)·동조·제N호 는 먼저 제거 → 조문의 제M항이 청구항 마커로 오검출되지 않는다.
Opinion._caseSpecificMarkers = function(sentence) {
  var s = String(sentence || '');
  var stripped = s.replace(STATUTE_RE, ' '); // 1) 법조 인용 선제거(조문 제M항/제K호의 오인 차단)
  var markers = [];                          // 2) 잔여에서 진짜 사건고유 마커 탐지
  if (/청구항\s*제?\s*\d+\s*항?/.test(stripped) || /제\s*\d+\s*항/.test(stripped)) markers.push('claim');
  if (/(?:인용문헌|선행발명|비교대상발명|인용발명|선행문헌)\s*\d+/.test(stripped)) markers.push('cited');
  if (/【\s*\d{1,4}\s*】/.test(stripped)) markers.push('para');
  if (/\d{4}-\d{6,}/.test(stripped)) markers.push('appno');
  return markers;
};

// 문장이 "정형(보일러플레이트)" 인지 — 법조 인용/표준 서두·결어/일자 신호가 있고 ★사건고유 마커가 없을 때★ true.
//   혼합 문장(조문 + 청구항/인용 등 고유 마커 동시)은 고유 우선(false) → 진짜 누수 보존.
Opinion._isBoilerplateSentence = function(sentence) {
  var s = String(sentence || '');
  if (Opinion._caseSpecificMarkers(s).length > 0) return false; // 고유 마커 있으면 정형 아님(누수 보존)
  var BOILER_RE = [
    /(?:특허법|실용신안법|디자인보호법|상표법|법)\s*제\s*\d+\s*조/, // 법조 인용(번호·띄어쓰기 무관)
    /동\s*조\s*제\s*\d+\s*항/,                                    // "동조 제N항"
    /의견제출통지서/, /귀\s*청/, /의견서를?\s*제출/,              // 표준 서두·결어
    /\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}/,                        // 통지/기준 일자(2026.04.10. 등)
  ];
  if (BOILER_RE.some(function(re){ return re.test(s); })) return true;
  return KOREAN_PATENT_BOILERPLATE.some(function(bp){ return s.indexOf(bp) >= 0; }); // 기존 exact 화이트리스트 유지(보강)
};

// ★ 참고 양식 정제 — 6가지 스타일 패턴 추출, 사건 내용 제거 ★
// 반환: { sanitized: string (LLM 학습용), forbiddenSpans: string[] (검증용 실제 사건 문구) }
Opinion.sanitizeTemplate = function(rawText, type) {
  // ─── 사건 특유 내용 마스킹 (식별자 + ★4 기술 prose) — 문체는 보존, 기술내용 누출 0 우선 ───
  //   ★4: 식별자(청구항/인용/단락/출원번호)에 더해 수치·단위·영문약어·기술 구성명사·낫표 용어까지 [*]로 가린다.
  //   어투·종결어미·호칭·연결어·강조어구는 마스킹 대상이 아니므로 그대로 남아 "문체"만 학습된다.
  function _maskCaseSpecific(str) {
    return String(str || '')
      // ① 식별자
      .replace(/제\s*\d+\s*항/g, '[청구항*]')
      .replace(/청구항\s*\d+/g, '[청구항*]')
      .replace(/(인용문헌|선행발명|비교대상발명|인용발명|선행문헌)\s*\d+/g, '[인용*]')
      .replace(/【\s*\d{1,4}\s*】/g, '[단락*]')
      .replace(/\d{4}-\d{6,}/g, '[출원번호*]')
      // ② ★4 수치·단위 (구체 수치·측정값 누출 차단)
      .replace(/\d+(?:\.\d+)?\s*(?:℃|°C|°|㎛|㎜|μm|nm|mm|cm|kg|mg|kHz|MHz|GHz|Hz|kW|mA|dB|bar|Pa|mol|％|%|초|분|시간|배|개|회|차|도|V|A|W|J|m|g)/g, '[수치*]')
      // ③ ★4 영문·약어·화학식·모델명·코드 (기술 식별 토큰; 2자 이상 영숫자)
      .replace(/[A-Za-z][A-Za-z0-9._\-\/]*[A-Za-z0-9]/g, '[기술*]')
      // ④ ★4 기술 구성 명사(기술 접미사 결합어) — 발명 고유 구성요소명. 일반 2자어(전부·일부·내부…)는 길이상 제외.
      .replace(/[가-힣]{2,12}(?:모듈|유닛|소자|회로|센서|엔진|알고리즘|프로세서|디바이스|메커니즘|어셈블리|하우징|유로|챔버|전극|기판|박막|레이어|코어|로직|버퍼|컨트롤러|액추에이터)/g, '[구성*]')
      // ⓑ 연결어 보호: '…로부터'·'…부분' 의 '부' 는 구성명사가 아니므로 마스킹 제외(부 뒤 터/분 부정탐색).
      .replace(/[가-힣]{2,12}부(?![터분])/g, '[구성*]')
      // ⑤ ★4 낫표·따옴표 안 고유 용어
      .replace(/[「『][^」』\n]{1,40}[」』]/g, '[용어*]');
  }

  // ── ②(오염 0) + ⓐ(서두 문체 보존): "사건고유 마커" 문장만 통째 제거하고, "정형(서두·조문)" 문장은 보존한다.
  //   ★ #190 헬퍼 정합: _caseSpecificMarkers(법조 제외 진짜 마커: 청구항+기술·인용번호·【단락】·출원번호)가 있으면
  //     그 문장에 도메인/사건 내용이 실리므로 [사건특유 문장 생략]으로 제거(소셜미디어·식자재 등 누출 차단).
  //   ★ 정형 서두("귀청께서는 …의견제출통지서를 …")·조문("특허법 제N조 제M항")은 _caseSpecificMarkers=[] 이므로
  //     redact 하지 않고 보존 → 직후 _maskCaseSpecific 가 식별자·조문번호만 [*]로 가린다(어투·호칭·결어 문체 생존).
  //   (이전: 모든 제N항 문장 통째 삭제 → 표준 서두/결어 문체가 LLM 예시에서 사라지던 문제 해소. DIAG-template-tone-tracing)
  function _redactMarkerSentences(str) {
    // 마침표·줄바꿈을 보존하며 분할(캡처 그룹). 짝수 인덱스=본문 segment, 홀수=구분자.
    var parts = String(str || '').split(/([.。\n])/);
    for (var i = 0; i < parts.length; i += 2) {
      // 진짜 사건고유 마커(법조 제외)가 있는 문장만 제거. 정형(서두·조문)·문체 문장은 보존(이후 마스킹).
      if (parts[i] && Opinion._caseSpecificMarkers(parts[i]).length > 0) parts[i] = ' [사건특유 문장 생략] ';
    }
    // 연속 생략 표시는 1개로 축약.
    return parts.join('').replace(/(\[사건특유 문장 생략\]\s*){2,}/g, '[사건특유 문장 생략] ');
  }

  // ★1 마스킹 전문 주입 — 조각 추출 대신 양식 전문을 마스킹해 문체(어투·종결어미·호칭·문단 호흡)를 그대로 학습시킨다.
  //   ②: 마커 문장 제거(도메인 주제어 차단) 후 잔여 식별자·수치·영문·구성명사를 _maskCaseSpecific 으로 가린다(2겹).
  //   기술내용·구조 차용 금지는 styleGuide + tpl[t](섹션 강제)가 담당. 길이 캡 25K(프롬프트 방어).
  var maskedFull = _maskCaseSpecific(_redactMarkerSentences(rawText));
  if (maskedFull.length > 25000) maskedFull = maskedFull.slice(0, 25000) + '\n…[양식 후략]';
  var result = '[★ 본 사무소 표준 의견서 양식 — 문체·어투 학습 자료 (마스킹됨)]\n'
    + '※ 아래는 사건 식별자·기술용어·수치를 [*]로 가린 본 사무소 실제 의견서다. 어투·종결어미·호칭·강조표현·문단 호흡만 학습하라.\n'
    + '※ 기술내용·논증·섹션 구조는 차용하지 마라(구조는 본문 지시의 ## 섹션 순서를 따른다).\n\n'
    + maskedFull + '\n';

  // ─── forbiddenSpans 추출 ───
  // 원본 양식에서 진짜 사건 특유 문구만 추출 (★ 공유 헬퍼 _caseSpecificMarkers/_isBoilerplateSentence 사용)
  // validateNoTemplateContamination()에서 이 목록만 검사 → 정형(조문·서두) false-positive 차단
  var forbiddenSpans = [];
  rawText.split(/[.\n]/).forEach(function(s) {
    var t = s.trim();
    if (t.length < 25 || t.length > 200) return;
    // ★ 정형(법조·서두) → 제외. 법조 문맥의 제N항은 사건고유로 치지 않는다(조문 ≠ 청구항).
    if (Opinion._isBoilerplateSentence(t)) return;
    // ★ 진짜 사건고유 마커(청구항·인용·단락·출원번호; 법조 제외)가 없으면 제외.
    if (Opinion._caseSpecificMarkers(t).length === 0) return;
    forbiddenSpans.push(t.slice(0, 80));
  });

  return { sanitized: result, forbiddenSpans: forbiddenSpans };
};

// ★ 양식 내용 오염 검증 — 의견서 생성 후 실행 ★
// forbiddenSpans(사건 특유 문구)만 검사 → 보일러플레이트 false-positive 차단
// severity:
//   'high'   = 차단급 — 다른 사건의 청구항 번호·인용번호·단락번호·출원번호 혼입
//   'medium' = 경고급 — 출처 불명 중간 길이 매치 (보일러플레이트 아님)
//   'low'    = 콘솔만 — KOREAN_PATENT_BOILERPLATE 적중 (일반 정형 문구이므로 정상)
Opinion.validateNoTemplateContamination = function(opinionText, contextType) {
  // 템플릿이 없거나 forbiddenSpans가 없으면 검사 불필요
  var spans = Opinion.state._templateForbiddenSpans || [];
  if (spans.length === 0) return { clean: true, warnings: [], severity: 'low' };

  var warnings = [];

  spans.forEach(function(span) {
    var trimmed = span.trim();
    if (trimmed.length < 20) return;

    // ★ 추출과 동일한 공유 헬퍼로 판정(기준 일치) — 정형(조문·서두)은 low, 진짜 사건고유 마커만 high.
    var isBoilerplate = Opinion._isBoilerplateSentence(trimmed);
    var isHighRisk = Opinion._caseSpecificMarkers(trimmed).length > 0;

    for (var len = 20; len <= Math.min(trimmed.length, 50); len++) {
      var chunk = trimmed.slice(0, len);
      if (opinionText.indexOf(chunk) >= 0) {
        var sev;
        if (isBoilerplate) {
          sev = 'low'; // 정형 문구 — 정상이므로 UI 미표시
        } else if (isHighRisk) {
          sev = 'high'; // 다른 사건의 청구항 번호 등 — 차단
        } else {
          sev = 'medium'; // 출처 불명 매치 — 경고
        }
        warnings.push({
          type: isHighRisk ? 'case_specific_leak' : (isBoilerplate ? 'boilerplate' : 'content_leak'),
          severity: sev,
          template_fragment: trimmed.slice(0, 60) + '...',
          match_length: len
        });
        break;
      }
    }
  });

  // low-only 항목은 warnings에 포함하되 UI에는 미표시 (renderOpinion 참고)
  var highWarn = warnings.filter(function(w) { return w.severity === 'high'; });
  var medWarn  = warnings.filter(function(w) { return w.severity === 'medium'; });
  var overallSeverity = highWarn.length > 0 ? 'high' : (medWarn.length > 0 ? 'medium' : 'low');

  return {
    clean: highWarn.length === 0 && medWarn.length === 0,
    warnings: warnings,
    severity: overallSeverity
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
