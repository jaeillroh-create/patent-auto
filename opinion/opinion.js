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
      .replace(/[가-힣]{2,12}부/g, '[구성*]')
      // ⑤ ★4 낫표·따옴표 안 고유 용어
      .replace(/[「『][^」』\n]{1,40}[」』]/g, '[용어*]');
  }

  // ── ②(오염 0): HIGH_RE 마커(제N항/인용N/단락/출원번호) 포함 "문장"을 통째로 제거한다.
  //   접미사 마스킹으로 못 잡는 도메인 주제어(소셜미디어·콘텐츠·식자재·컨셉 등)는 대부분 이런 마커 문장에
  //   들어있으므로(사건특유 = forbiddenSpans 와 동일 집합), 문장 자체를 [사건특유 문장 생략]으로 치환 →
  //   프롬프트에 도메인 어구가 원천적으로 안 들어간다. 문체(호칭·종결어미·연결어·결어)는 마커 없는 일반
  //   문장에 있으므로 보존된다. ★ 접미사 확장(whack-a-mole)이 아니라 마커 문장 제거가 근본.
  function _redactMarkerSentences(str) {
    var HIGH_SENT = /제\s*\d+\s*항|청구항\s*\d+|인용문헌\s*\d+|선행발명\s*\d+|비교대상발명\s*\d+|인용발명\s*\d+|선행문헌\s*\d+|【\s*\d{1,4}\s*】|\d{4}-\d{6,}/;
    // 마침표·줄바꿈을 보존하며 분할(캡처 그룹). 짝수 인덱스=본문 segment, 홀수=구분자.
    var parts = String(str || '').split(/([.。\n])/);
    for (var i = 0; i < parts.length; i += 2) {
      if (parts[i] && HIGH_SENT.test(parts[i])) parts[i] = ' [사건특유 문장 생략] ';
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
  if(!ps.length){ el.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px"><div style="font-size:32px;margin-bottom:8px"><span class="ico" data-icon="mail"></span></div>의견서 대응 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 의견제출통지서에 대응하세요.</span></td></tr>'; return; }
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
  // ── Cycle 5: 혼합 모드 헤더 chip ──
  var mixedChip = '';
  if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary) {
    var sInfo = Opinion.TYPES[Opinion.state._mixed_secondary] || {};
    mixedChip = ' <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#e3f2fd;border-radius:10px;font-size:10px;font-weight:600;color:var(--dt-brand-hover);margin-left:4px">+ 부 거절: §'+(sInfo.code||'')+'</span>';
  }
  document.getElementById('opinionDetailType').innerHTML='<span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span>'+mixedChip;
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
      +'<span class="ico" data-icon="arrow-left"></span> '+prevStep.label+'</button>';
  }

  // 현재 단계로 돌아가기 (과거 뷰일 때만)
  if(isViewingPast) {
    h+='<button class="btn btn-primary btn-sm" onclick="Opinion.goToCurrent()" style="font-size:12px">'
      +'<span class="ico" data-icon="arrow-right"></span> 현재 단계로</button>';
  }

  // 이 단계로 되돌리기 (과거 뷰일 때, 해당 단계부터 다시 시작)
  if(isViewingPast && si < ci) {
    h+='<button class="btn btn-outline btn-sm" onclick="Opinion.rollbackToStep(\''+currentStepKey+'\')" style="font-size:12px;color:var(--color-warning);border-color:var(--color-warning)">'
      +'<span class="ico" data-icon="refresh"></span> 여기서 다시 시작</button>';
  }

  // 파일 추가 (어느 단계에서든 파일 업로드 단계로 되돌릴 수 있음)
  if(!isViewingPast && currentStepKey !== 'upload' && si > 0) {
    h+='<button class="btn btn-ghost btn-sm" onclick="Opinion.rollbackToStep(\'upload\')" style="font-size:11px;margin-left:auto">'
      +'<span class="ico" data-icon="link"></span> 파일 추가/재업로드</button>';
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

  L.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="folder"></span> 파일 업로드</div></div>'
    +'<div class="opinion-upload-zone" id="opinionUploadZone" onclick="document.getElementById(\'opinionFileInput\').click()" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');Opinion.handleDrop(event)">'
    +'<div style="font-size:36px;margin-bottom:8px"><span class="ico" data-icon="link"></span></div>'
    +'<div style="font-size:13px;color:var(--color-text-secondary)">클릭 또는 드래그하여 파일 업로드<br><span style="font-size:11px;color:var(--color-text-tertiary)">PDF, DOCX, TXT (HWP는 텍스트 복사 후 붙여넣기)</span></div></div>'
    +'<input type="file" id="opinionFileInput" multiple accept=".pdf,.docx,.doc,.txt" style="display:none" onchange="Opinion.handleFiles(event)" />'
    +'<div id="opinionFileList" class="opinion-file-list"></div>'

    // 수동 텍스트 입력 (PDF 인식 실패 시)
    +'<div style="margin-top:12px;border-top:1px solid var(--color-border);padding-top:12px">'
    +'<details id="opinionManualInput"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-text-secondary)"><span class="ico" data-icon="edit"></span> PDF 인식이 안 될 때: 직접 텍스트 붙여넣기</summary>'
    +'<div style="margin-top:8px">'
    +'<textarea class="textarea-field" id="opinionManualText" rows="8" placeholder="의견제출통지서, 명세서 등의 텍스트를 직접 붙여넣으세요.&#10;&#10;예: 특허출원 제10-2025-0128349호에 대하여 다음과 같이 의견제출통지합니다..." style="font-size:12px;line-height:1.6"></textarea>'
    +'<p style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px"><span class="ico" data-icon="lightbulb"></span> PDF를 열어서 전체 선택(Ctrl+A) → 복사(Ctrl+C) → 여기 붙여넣기(Ctrl+V)</p>'
    +'</div></details></div>'

    +'</div>' // card 닫기

    +'<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="info"></span> 필수 파일 (역할 지정 필수)</div></div>'
    +'<div style="font-size:12px;line-height:1.7;color:var(--color-text-secondary)">'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid var(--dt-danger);background:#fff5f5;border-radius:0 6px 6px 0"><b><span class="ico" data-icon="clipboard"></span> 의견제출통지서</b> — 심사관이 보낸 통지서 (필수)</div>'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid var(--dt-brand);background:#F7FBFF;border-radius:0 6px 6px 0"><b><span class="ico" data-icon="doc"></span> 출원 명세서</b> — 우리 특허 (본원발명) (필수)</div>'
    +'<div style="margin-bottom:6px;padding:6px 10px;border-left:3px solid var(--dt-warning);background:#fffbeb;border-radius:0 6px 6px 0"><b><span class="ico" data-icon="doc"></span> 인용발명</b> — 심사관이 인용한 선행기술 (다른 특허)</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--color-error);margin-top:8px;padding:8px;background:var(--color-error-light);border-radius:6px;line-height:1.5">'
    +'⚠️ <b>본원 명세서와 인용발명을 반드시 올바르게 지정해 주세요.</b> 잘못 지정하면 분석·의견서 전체가 틀어집니다.'
    +'</div></div>'
    +'<div id="opinionParseProgress" style="margin-top:8px"></div>'
    +'<button class="btn btn-primary btn-full" id="btnOpinionParse" onclick="Opinion.startParsing()" disabled><span class="ico" data-icon="search"></span> 문서 파싱 시작</button>';

  R.innerHTML='<div class="card" style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:12px"><span class="ico" data-icon="clipboard"></span></div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">의견제출통지서를 업로드하세요</h3><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;max-width:400px;margin:0 auto">통지서를 업로드하면 AI가 자동으로 거절이유를 분석하고,<br>보정 전략 → 청구항 초안 → 검증 → 의견서 생성까지 안내합니다.</p>'
    +'<div style="margin-top:20px;padding:14px;background:var(--color-bg-tertiary);border-radius:8px;text-align:left;font-size:12px;color:var(--color-text-secondary);line-height:1.6">'
    +'<b><span class="ico" data-icon="lightbulb"></span> 팁:</b> PDF에서 텍스트가 추출되지 않으면(이미지 스캔본),<br>왼쪽 "직접 텍스트 붙여넣기"를 이용하세요.'
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
  el.innerHTML = '<span class="ico" data-icon="chart"></span> API: ' + Opinion.usage.calls + '회';
};

// ═══ 파일 역할 상수 ═══
Opinion.FILE_ROLES = {
  notification: { label: '<span class="ico" data-icon="clipboard"></span> 의견제출통지서', color: '#ef4444' },
  specification: { label: '<span class="ico" data-icon="doc"></span> 출원 명세서', color: '#3182f6' },
  cited_ref: { label: '<span class="ico" data-icon="doc"></span> 인용발명', color: '#f59e0b' },
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
      +'<option value="notification"'+(role==='notification'?' selected':'')+'><span class="ico" data-icon="clipboard"></span> 통지서</option>'
      +'<option value="specification"'+(role==='specification'?' selected':'')+'><span class="ico" data-icon="doc"></span> 명세서</option>'
      +'<option value="cited_ref"'+(role==='cited_ref'?' selected':'')+'><span class="ico" data-icon="doc"></span> 인용발명</option>'
      +'<option value="other"'+(role==='other'?' selected':'')+'>📎 기타</option>'
      +'</select>'
      +'<span class="file-type">'+ext+' · '+sz+'</span>'
      +'<button class="file-remove" onclick="Opinion.removeFile('+i+')"><span class="ico" data-icon="x"></span></button></div>';
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
  L.innerHTML=Opinion.renderNavBar('parse')+'<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="check-circle"></span> 파싱 완료</div></div><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6">문서 파싱이 완료되었습니다.<br>결과를 확인한 후 유형을 판별합니다.</p><button class="btn btn-primary btn-full" id="btnOpinionType" onclick="Opinion.determineType()" style="margin-top:12px"><span class="ico" data-icon="search"></span> 유형 판별 시작</button></div>';
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="clipboard"></span> 파싱 결과</div></div><div id="opinionParsedContent" style="font-size:13px;color:var(--color-text-secondary);padding:4px 0">로딩 중...</div></div>';
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
    el.innerHTML='<div style="padding:12px;background:var(--color-warning-light);border-radius:8px;border-left:3px solid var(--color-warning);margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:var(--dt-warning);margin-bottom:4px"><span class="ico" data-icon="warning" data-size="14"></span> 자동 구조화에 실패했습니다</div><div style="font-size:12px;color:var(--dt-warning)">PDF 내용이 이미지 스캔본이거나 형식이 비표준일 수 있습니다. 유형 판별은 원문 기준으로 진행됩니다.</div></div>'
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
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="ico" data-icon="warning"></span> 거절이유</div>';
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
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="ico" data-icon="doc"></span> 인용문헌</div>';
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
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="ico" data-icon="doc"></span> 청구항 ('+pd.claims.length+'개)</div>';
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
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="ico" data-icon="scales"></span> 구성요소 대비표</div>';
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
    L.innerHTML = Opinion.renderNavBar('type')+'<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="warning"></span> 수동 처리 필요</div></div>'
      +'<div style="padding:16px">'
      +'<div style="color:var(--color-error);font-weight:600;font-size:14px;margin-bottom:10px">본 거절이유는 현재 자동 처리를 지원하지 않습니다.</div>'
      +'<p style="font-size:13px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:12px">§32(불특허발명) / §33(무권리자) / §36(선출원) / §45(단일성) 등 특수 거절이유는 사건별 개별 판단이 필요합니다.<br>변리사가 직접 의견서를 작성하시거나, 아래에서 유사 유형을 수동 선택하여 참고용으로 진행하실 수 있습니다.</p>'
      +(tr.reasoning?'<div style="font-size:12px;background:var(--color-bg-tertiary);padding:10px;border-radius:8px;margin-bottom:16px;line-height:1.6">'+escapeHtml(tr.reasoning)+'</div>':'')
      +'<div style="font-size:13px;font-weight:600;margin-bottom:8px">유형 수동 선택 (참고용)</div>'
      +'<div class="opinion-type-selector">'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'inventive_step\')"><span class="ico" data-icon="scales"></span> A. 진보성</div>'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'description_deficiency\')"><span class="ico" data-icon="edit"></span> B. 기재불비</div>'
      +'<div class="opinion-type-option" onclick="Opinion.selectType(this,\'partial_rejection\')"><span class="ico" data-icon="clipboard"></span> C. 일부거절</div>'
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
      secondaryBannerHtml = '<div id="opinionMixedBanner" style="background:#FEF4E6;border:1px solid var(--dt-warning);border-radius:8px;padding:14px 16px;margin-bottom:12px">'
        +'<div style="font-weight:700;font-size:13px;color:#663A00;margin-bottom:6px"><span class="ico" data-icon="warning"></span> 부 거절이유 — 수동 처리 필요</div>'
        +'<p style="font-size:12px;color:#663A00;line-height:1.7;margin-bottom:10px">'
        +'부 거절(<b>'+escapeHtml(secInfo.label)+'</b>)은 시스템이 자동 처리하지 않는 유형입니다.<br>'
        +'해당 거절이유는 변리사가 직접 검토하고 수동으로 처리하시기 바랍니다.'
        +'</p>'
        +'<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="Opinion.acknowledgeMixed()">이해했습니다 — 주 거절로 진행</button>'
        +'</div>';
    } else {
      secondaryBannerHtml = '<div id="opinionMixedBanner" style="background:#FEF4E6;border:1px solid var(--dt-warning);border-radius:8px;padding:14px 16px;margin-bottom:12px">'
        +'<div style="font-weight:700;font-size:13px;color:#663A00;margin-bottom:8px"><span class="ico" data-icon="warning"></span> 본 통지서는 두 종류의 거절이유를 포함합니다</div>'
        +'<div style="font-size:12px;color:#663A00;line-height:1.8;margin-bottom:10px">'
        +'· 주 거절: <b>'+escapeHtml(priInfo.icon+' '+priInfo.code+'. '+priInfo.label)+'</b><br>'
        +'· 부 거절: <b>'+escapeHtml(secInfo.icon+' '+secInfo.code+'. '+secInfo.label)+'</b><br><br>'
        +'본 시스템은 두 거절이유를 <b>한 의견서·보정서에서 통합 처리</b>합니다.<br>'
        +'· 의견서: 거절이유별 분리 섹션 (4.1 주 거절 / 4.2 부 거절)<br>'
        +'· 보정서: 통합 형식 (각 청구항에 적용된 거절이유 명시)'
        +'</div>'
        +'<button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="Opinion.acknowledgeMixed()">이해했습니다 — 통합 진행</button>'
        +'</div>';
    }
  } else if (secType && secInfo && Opinion.state._secondary_warned) {
    var modeLabel = (secType === 'unsupported_type')
      ? '주 거절 경로로 진행 중'
      : '두 거절이유 통합 처리 중 (§'+escapeHtml(priInfo.code||'')+' + §'+escapeHtml(secInfo.code||'')+')';
    secondaryBannerHtml = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#006E25"><span class="ico" data-icon="check-circle"></span> 혼합 거절 안내 확인 완료 — '+modeLabel+'</div>';
  }

  L.innerHTML=Opinion.renderNavBar('type')+secondaryBannerHtml+'<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="search"></span> 유형 판별 결과</div></div>'
    +'<div class="opinion-type-result"><div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px">AI 분석 결과</div>'
    +'<div class="opinion-type-determined '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</div>'
    +'<div style="font-size:12px;color:var(--color-text-tertiary)">신뢰도: '+conf+'% <div class="opinion-confidence-bar"><div class="opinion-confidence-fill" style="width:'+conf+'%"></div></div></div>'
    +(tr.reasoning?'<p style="font-size:12px;color:var(--color-text-secondary);text-align:left;line-height:1.6;margin-top:12px;padding:10px;background:var(--color-bg-tertiary);border-radius:8px">'+escapeHtml(tr.reasoning)+'</p>':'')
    +'</div><div style="margin-top:16px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">이 판별이 맞습니까?</div>'
    +'<div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="Opinion.confirmType()"><span class="ico" data-icon="check-circle"></span> 맞습니다</button><button class="btn btn-outline" style="flex:1" onclick="document.getElementById(\'opinionTypeOverride\').style.display=\'block\'"><span class="ico" data-icon="edit"></span> 유형 변경</button></div>'
    +'<div id="opinionTypeOverride" style="'+(autoOpen?'':'display:none;')+'margin-top:12px">'
    +(autoOpen?'<div style="color:var(--color-error);font-size:12px;font-weight:600;padding:8px;background:var(--color-error-bg,#FEECEC);border-radius:6px;margin-bottom:8px"><span class="ico" data-icon="warning"></span> AI가 유형을 자동 판별하지 못했습니다. 직접 선택해 주세요.</div>':'')
    +'<div class="opinion-type-selector">'
    +'<div class="opinion-type-option'+(p.rejection_type==='inventive_step'?' selected':'')+'" onclick="Opinion.selectType(this,\'inventive_step\')"><span class="ico" data-icon="scales"></span> A. 진보성</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='description_deficiency'?' selected':'')+'" onclick="Opinion.selectType(this,\'description_deficiency\')"><span class="ico" data-icon="edit"></span> B. 기재불비</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='partial_rejection'?' selected':'')+'" onclick="Opinion.selectType(this,\'partial_rejection\')"><span class="ico" data-icon="clipboard"></span> C. 일부거절</div>'
    +'</div><button class="btn btn-primary btn-full" style="margin-top:10px" onclick="Opinion.confirmType()">변경 후 진행</button></div></div></div>';

  var cs=tr.claim_summary||{}, tot=cs.total_claims||0, rej=cs.rejected_claims||[], alw=cs.no_rejection_claims||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="chart"></span> 청구항별 현황</div></div>'
    +(tot>0?Array.from({length:tot},function(_,i){var n=i+1,isR=rej.indexOf(n)>=0,isA=alw.indexOf(n)>=0;return '<div class="opinion-claim-row '+(isA?'allowable':isR?'rejected':'')+'"><span class="claim-no">청구항 '+n+'</span><span>'+(isA?'✅':isR?'❌':'⬜')+'</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+(isA?'등록가능 후보':isR?'거절':'미확인')+'</span></div>';}).join(''):'<p style="padding:20px;text-align:center;color:var(--color-text-tertiary)">청구항 정보 없음</p>')+'</div>';
};
Opinion.selectType=function(el,type){document.querySelectorAll('.opinion-type-option').forEach(function(o){o.classList.remove('selected');});el.classList.add('selected');Opinion.state.current.rejection_type=type;};

// ── 혼합 거절 안내 확인 버튼 핸들러 (Cycle 3 P2 #20 + Cycle 5 통합 모드) ──
Opinion.acknowledgeMixed = async function() {
  var p = Opinion.state.current; if (!p) return;
  Opinion.state._secondary_warned = true;
  var secType = p.secondary_rejection_type || (Opinion.state.typeResult && Opinion.state.typeResult.secondary_type) || null;
  // ── Cycle 5: secondary가 정상 유형이면 _mixed_mode 진입 ──
  var secInfo = secType ? Opinion.TYPES[secType] : null;
  var isSecUnsupported = secType === 'unsupported_type';
  if (secInfo && !isSecUnsupported) {
    Opinion.state._mixed_mode      = true;
    Opinion.state._mixed_primary   = p.rejection_type;
    Opinion.state._mixed_secondary = secType;
    console.log('[Opinion.acknowledgeMixed] mixed mode ENABLED: '+p.rejection_type+' + '+secType);
  } else {
    Opinion.state._mixed_mode = false;
    Opinion.state._mixed_primary = null;
    Opinion.state._mixed_secondary = null;
  }
  try {
    await sb.from('opinion_gate_decisions').insert({
      project_id: p.id, gate_no: 0, decision: 'mixed_acknowledged',
      decided_by: currentUser.id,
      revision_note: JSON.stringify({primary: p.rejection_type, secondary: secType, mixed_mode: Opinion.state._mixed_mode})
    });
  } catch(e) { console.warn('[Opinion.acknowledgeMixed] gate_decisions insert failed:', e); }
  // 배너를 "확인 완료" 상태로 교체
  var banner = document.getElementById('opinionMixedBanner');
  if (banner) {
    var priInfo = Opinion.TYPES[p.rejection_type] || Opinion.TYPES.inventive_step;
    var modeLabel = isSecUnsupported
      ? '주 거절 경로로 진행 중'
      : '두 거절이유 통합 처리 중 (§'+(priInfo.code||'')+' + §'+(secInfo.code||'')+')';
    banner.outerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#006E25"><span class="ico" data-icon="check-circle"></span> 혼합 거절 안내 확인 완료 — '+modeLabel+'</div>';
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
    var icon = isExaminer ? '<span class="ico" data-icon="scales" data-size="14"></span>' : '<span class="ico" data-icon="user" data-size="14"></span>';
    var label = isExaminer ? '심사관' : '변리사';
    var cls = isExaminer ? 'examiner' : 'attorney';
    h += '<div class="opinion-chat-bubble '+cls+'">'
      +'<div class="opinion-chat-role">'+icon+' <b>'+label+'</b></div>'
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
    // ── Cycle 5: 혼합 모드일 때 secondary 분석 지시 추가 ──
    var mixedDirective = '';
    if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary && Opinion.state._mixed_secondary !== type) {
      var secKey = Opinion.state._mixed_secondary;
      var secInfoCtx = Opinion.TYPES[secKey] || {};
      mixedDirective = '\n\n[혼합 거절 — 부 거절이유 추가 분석]\n'
        +'본 통지서에는 주 거절이유('+type+') 외에 부 거절이유('+secKey+', §'+(secInfoCtx.code||'')+' '+(secInfoCtx.label||'')+')도 포함됩니다.\n'
        +'parsed.rejection_reasons 배열에서 부 거절이유에 해당하는 항목들을 별도 분석하라.\n'
        +'주 거절 분석은 위 지시를 그대로 따르되, 출력 JSON에 다음 키를 추가하라:\n\n'
        +'"secondary_analysis": {\n'
        +'  "type": "'+secKey+'",\n'
        +'  "items": [/* secondary 유형 표준 항목 — '
        +(secKey==='inventive_step' ? 'elements/strategies 구조' : secKey==='description_deficiency' ? 'items 배열 (claim_no, deficiency_type, article, examiner_comment, spec_reference, suggested_correction)' : 'rejected_claims/allowable_claims/merge_suggestion 구조')
        +' */],\n'
        +'  "rejected_claims_secondary": [N, ...]  // 부 거절이유로 거절된 청구항 번호\n'
        +'}\n\n'
        +'⚠️ secondary_analysis는 주 거절 분석과 분리하여 작성하라. 두 거절이유를 혼동하지 마라.\n';
    }
    var ar = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n'+ctx+'\n'+prompts[type]+mixedDirective,
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
    // ── Cycle 5: secondary_analysis를 메모리에도 보관 (UI 렌더용) ──
    if (ar && ar.secondary_analysis) {
      Opinion.state.analysis = ar;
      Opinion.state.analysis._secondary = ar.secondary_analysis;
    } else {
      Opinion.state.analysis = ar;
    }
    await sb.from('opinion_issue_analyses').insert({project_id:p.id,analysis_type:type,result_data:ar});
    await Opinion.setStatus(p.id,next); Opinion.renderDetail(); showToast('분석 완료');
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
    +'<div class="modal-title" style="font-size:16px;margin-bottom:4px"><span class="ico" data-icon="edit"></span> Gate '+gateNo+' 수정 요청</div>'
    +'<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:16px">수정이 필요한 부분을 구체적으로 작성해 주세요. AI가 이 지시에 따라 해당 단계를 재실행합니다.</p>'
    +'<textarea id="opinionRevisionText" class="textarea-field" rows="5" placeholder="예: 구성요소 ❸의 차이점 논증을 더 강화해 주세요. 【0088】의 구체적 예시를 인용하세요." style="font-size:13px;line-height:1.6"></textarea>'
    +'<div style="display:flex;gap:12px;margin-top:4px;font-size:11px;color:var(--color-text-tertiary);flex-wrap:wrap">'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'논증을 더 강화해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px"><span class="ico" data-icon="lightbulb"></span> 논증 강화</span>'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'명세서 단락을 더 구체적으로 인용해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px"><span class="ico" data-icon="lightbulb"></span> 단락 인용</span>'
    +'<span onclick="document.getElementById(\'opinionRevisionText\').value+=\'권리범위를 더 넓게 유지해 주세요. \'" style="cursor:pointer;padding:2px 8px;background:var(--color-bg-tertiary);border-radius:10px"><span class="ico" data-icon="lightbulb"></span> 범위 확대</span>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn btn-ghost" style="flex:1;padding:10px" onclick="document.getElementById(\'opinionRevisionModal\').remove()">취소</button>'
    +'<button class="btn btn-primary" style="flex:1;padding:10px" id="btnRevisionSubmit"><span class="ico" data-icon="edit"></span> 수정 요청</button>'
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
    +'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="ico" data-icon="scales"></span> 쟁점 분석 + '+gLabel+'</div>'
    +'<p style="font-size:13px;color:var(--color-text-secondary)">심사관과 변리사의 토론 결과를 검토하고 전략을 확정해 주세요.</p>'
    +stratHtml
    +'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.backToList()">나중에</button><button class="btn btn-primary" id="btnGate1Approve" onclick="Opinion.approveGate(1)"><span class="ico" data-icon="check-circle"></span> 확정</button></div></div>';

  // 오른쪽: 토론 내용 + 분석 결과
  var discussionHtml = '';
  if (a.discussion && a.discussion.length) {
    discussionHtml = '<div class="card" style="margin-bottom:12px"><div class="card-header"><div class="card-title"><span class="ico" data-icon="comment"></span> 심사관·변리사 협의</div></div>'
      + Opinion.renderDiscussion(a.discussion) + '</div>';
  }
  // ── Cycle 6 P2 §2.4: secondary 카드 — 혼합 모드일 때 노란 보더 카드 추가 ──
  var secondaryCardHtml = '';
  var secAnaData = (a && a._secondary) || (a && a.secondary_analysis) || null;
  if (Opinion.state._mixed_mode && secAnaData) {
    var secKey4 = Opinion.state._mixed_secondary || '';
    var secInfo4 = Opinion.TYPES[secKey4] || {};
    secondaryCardHtml = '<div class="opinion-analysis-card-secondary" style="margin-top:12px;border-left:4px solid var(--dt-warning);background:#fffbeb;border-radius:8px;padding:14px">'
      +'<div style="font-weight:700;font-size:13px;color:#663A00;margin-bottom:8px"><span class="ico" data-icon="clipboard"></span> 부 거절이유 분석 — §'+escapeHtml(secInfo4.code||'')+' '+escapeHtml(secInfo4.label||'')+'</div>'
      +(secAnaData.items && secAnaData.items.length
        ? secAnaData.items.map(function(it) {
            return '<div style="padding:8px;border:1px solid #fcd34d;border-radius:6px;margin-bottom:6px;background:#fef9c3">'
              +'<div style="font-size:12px;font-weight:600">청구항 '+(it.claim_no||'?')+'</div>'
              +'<div style="font-size:12px;color:#663A00;margin-top:3px">'+escapeHtml(it.examiner_comment||it.reason||'')+'</div>'
              +(it.suggested_correction?'<div style="font-size:11px;margin-top:4px;color:#451a03"><span class="ico" data-icon="arrow-right"></span> '+escapeHtml(it.suggested_correction)+'</div>':'')
              +'</div>';
          }).join('')
        : '<div style="font-size:12px;color:#663A00">'+escapeHtml(JSON.stringify(secAnaData).slice(0,300))+'</div>')
      +'</div>';
  }
  R.innerHTML = discussionHtml + Opinion.renderAnalysisUI(type, a, extracted) + secondaryCardHtml;

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
  var h = '<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="chart"></span> 분석 결과</div></div>';
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
          h += '<div style="font-size:12px;padding:8px 10px;background:var(--color-success-light);border-radius:6px;margin-bottom:6px;border-left:3px solid var(--color-success)"><b style="color:#006E25">★ 차이점:</b> '+escapeHtml(diff)+'</div>';
        if (arg)
          h += '<div style="font-size:11px;color:var(--color-primary);line-height:1.5"><span class="ico" data-icon="lightbulb"></span> '+escapeHtml(arg)+'</div>';
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
      rej.forEach(function(r) { h += '<div class="opinion-claim-row rejected"><span class="claim-no">청구항 '+r.claim_no+'</span><span><span class="ico" data-icon="x"></span></span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+escapeHtml(r.reason||'거절')+'</span></div>'; });
      alw.forEach(function(a) { h += '<div class="opinion-claim-row allowable"><span class="claim-no">청구항 '+a.claim_no+'</span><span><span class="ico" data-icon="check-circle"></span></span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+escapeHtml(a.basis||'등록가능')+'</span></div>'; });
      h += '</div>';
    }
    if (a.merge_suggestion) {
      hasContent = true;
      var mg = a.merge_suggestion;
      h += '<div style="padding:14px;background:var(--color-primary-light);border-radius:8px;border-left:3px solid var(--color-primary)">'
        +'<div style="font-weight:600;font-size:13px;color:var(--color-primary);margin-bottom:6px"><span class="ico" data-icon="lightbulb"></span> 병합 제안</div>'
        +'<div style="font-size:12px;line-height:1.6">청구항 '+(mg.source||'?')+' → 청구항 '+(mg.target||'?')+' 병합</div>'
        +(mg.rationale?'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">'+escapeHtml(mg.rationale)+'</div>':'')
        +'</div>';
    }
  }

  // 구조화된 데이터가 하나도 없으면 원본 표시 + 재분석 버튼
  if (!hasContent) {
    h += '<div style="padding:16px;background:var(--color-warning-light);border-radius:8px;margin-bottom:12px;border-left:3px solid var(--color-warning)">'
      +'<div style="font-weight:600;font-size:12px;color:#663A00;margin-bottom:6px"><span class="ico" data-icon="warning"></span> 분석 결과를 구조화하지 못했습니다</div>'
      +'<div style="font-size:12px;color:#663A00;line-height:1.5">AI가 서술형으로 응답했습니다. 재분석하면 구조화된 결과를 얻을 수 있습니다.</div>'
      +'<button class="btn btn-outline btn-sm" onclick="Opinion.retryAnalysis()" style="margin-top:8px;font-size:12px"><span class="ico" data-icon="refresh"></span> 재분석</button>'
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
      // ★ D1: AI 검증에서 승인된 보정 "방향"(권고)을 의견서 작성 컨텍스트에 첨부(read-only — 청구항 문언 미변경).
      //   승인분만(_collectApprovedDirections), 완성 문언이 아닌 방향이며 신규사항 금지 원칙은 그대로.
      var _apprDirs = Opinion._collectApprovedDirections(Opinion.state.draftResult);
      if (_apprDirs.length) {
        ctx += '[AI 검증 승인 보정 권고 — 방향]\n'
             + '※ 아래는 AI 검증에서 변리사가 승인한 보정 "방향"입니다. 의견서의 보정내용·보정의 적법성 설명에 참고하되, 완성 문언은 명세서 기재 범위 내에서 작성하세요(신규사항 금지).\n'
             + _apprDirs.map(function(e){ return '· 청구항 ' + e.claim_no + ': ' + e.directions.join(' / '); }).join('\n')
             + '\n\n';
      }
    }
    if(sections.indexOf('validation')>=0 && Opinion.state.validation) {
      ctx+='[검증 결과]\n'+JSON.stringify(Opinion.state.validation,null,1).slice(0,3000)+'\n\n';
    }
    if(sections.indexOf('ref')>=0) {
      var templateText = Opinion.getActiveTemplate(Opinion.state.current ? Opinion.state.current.rejection_type : 'inventive_step');
      if(templateText) ctx += '[★ 본 사무소 표준 의견서 양식 시작 — 이 양식의 스타일·문체를 반드시 따를 것]\n' + templateText + '\n[★ 본 사무소 표준 의견서 양식 끝]\n\n';
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
    // ── Cycle 5: 혼합 모드일 때 보정 통합 지시 추가 ──
    var mixedDraftDirective = '';
    if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary && Opinion.state._mixed_secondary !== t) {
      var secKey2 = Opinion.state._mixed_secondary;
      var secInfo2 = Opinion.TYPES[secKey2] || {};
      var priInfo2 = Opinion.TYPES[t] || {};
      var secAna = (Opinion.state.analysis && Opinion.state.analysis._secondary) || (Opinion.state.analysis && Opinion.state.analysis.secondary_analysis) || null;
      var secRejNos = (secAna && (secAna.rejected_claims_secondary || (secAna.items||[]).map(function(it){ return it.claim_no; }).filter(Boolean))) || [];
      mixedDraftDirective = '\n\n[혼합 거절 — 보정 통합 지시]\n'
        +'본 보정은 두 거절이유를 동시에 해소해야 한다:\n'
        +'  · 주 거절('+t+', §'+(priInfo2.code||'')+' '+(priInfo2.label||'')+') 청구항: '+rejectedIndependentNos.join(', ')+'\n'
        +'  · 부 거절('+secKey2+', §'+(secInfo2.code||'')+' '+(secInfo2.label||'')+') 청구항: '+(secRejNos.length?secRejNos.join(', '):'(secondary_analysis 참조)')+'\n\n'
        +'각 청구항을 다음 원칙으로 보정하라:\n'
        +'  - 청구항이 주 거절이유에만 해당 → 주 거절이유 보정 전략 적용\n'
        +'  - 청구항이 부 거절이유에만 해당 → 부 거절이유 보정 전략 적용 (예: §42 명확화·청구항 축소·용어 통일)\n'
        +'  - 청구항이 둘 다에 해당 → 부 거절이유(명확성 등)를 먼저 해소한 뒤 주 거절이유(진보성 등) 차이점 추가\n\n'
        +'⚠️ 출력 amended_claims 배열의 각 항목에 다음 키를 반드시 포함:\n'
        +'  "applied_rejections": ["§'+(priInfo2.code||'')+'"] 또는 ["§'+(secInfo2.code||'')+'"] 또는 ["§'+(priInfo2.code||'')+'", "§'+(secInfo2.code||'')+'"]\n'
        +'  - 어느 거절이유를 해소하는 보정인지 명시. KIPO 심사관이 보정 의도를 추적할 수 있어야 한다.\n';
    }
    var dr = await Opinion.callForJSON(
      Opinion.SYS_PROMPT+'\n\n'+ctx+prompts[t]+mixedDraftDirective,
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
    specBasisHtml = '<div style="margin-top:12px;padding:12px;background:var(--color-error-light,#FEECEC);border-radius:8px;border-left:3px solid var(--color-error,var(--dt-danger))">'
      +'<div style="font-weight:600;font-size:13px;color:var(--color-error,var(--dt-danger));margin-bottom:6px"><span class="ico" data-icon="warning"></span> 보정 근거 단락이 명세서에 없음 — §47② 신규사항 추가 위험</div>'
      +'<ul style="font-size:12px;color:var(--color-error,var(--dt-danger));line-height:1.7;margin:6px 0 6px 18px">'+missingDetail+'</ul>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">변리사가 명세서 원문과 직접 대조 확인 후 Gate 2 진행 시 우회 가능합니다.</p>'
      +'</div>';
  } else if (sbc && sbc.ok === null) {
    specBasisHtml = '<div style="margin-top:12px;padding:10px;background:var(--color-warning-light,#FEF4E6);border-radius:8px;border-left:3px solid var(--color-warning,var(--dt-warning))">'
      +'<div style="font-size:12px;color:#663A00;font-weight:600"><span class="ico" data-icon="doc"></span> 명세서 원문 미제공 — spec_basis 검증 skip</div>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">명세서 파일을 업로드하시면 보정 근거 단락이 자동 검증됩니다.</p>'
      +'</div>';
  }

  var valHtml = '';
  if (ready && sm.total) {
    valHtml = '<div style="margin-top:12px;margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:8px"><span class="ico" data-icon="search"></span> 뒷받침 검증</div>'
      +'<div class="opinion-val-summary"><div class="opinion-val-stat pass"><span class="ico" data-icon="check-circle"></span> 통과 '+(sm.pass||0)+'</div><div class="opinion-val-stat warn"><span class="ico" data-icon="warning"></span> 주의 '+(sm.warn||0)+'</div><div class="opinion-val-stat fail"><span class="ico" data-icon="x"></span> 실패 '+(sm.fail||0)+'</div></div>';
    if (v._spec_unverified) {
      valHtml += '<div style="margin-top:6px;font-size:11px;color:#663A00;background:var(--color-warning-light,#FEF4E6);padding:6px 8px;border-radius:6px"><span class="ico" data-icon="warning"></span> 명세서 원문 미제공 — LLM이 명세서 없이 검증한 결과. 변리사 수동 확인 필수.</div>';
    }
    valHtml += '</div>';
  }

  L.innerHTML=nav+'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="ico" data-icon="edit"></span> 청구항 보정 + 검증</div>'
    +'<p style="font-size:13px;color:var(--color-text-secondary)">심사관과 변리사가 보정안을 검토하고 뒷받침 검증까지 완료했습니다.</p>'
    +specBasisHtml+discussionHtml+valHtml
    +(ready?'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(2)"><span class="ico" data-icon="edit"></span> 수정</button><button class="btn btn-primary" id="btnGate2Approve" onclick="Opinion.approveGate(2)"><span class="ico" data-icon="check-circle"></span> 확정</button></div>':'')
    +'</div>';

  // 오른쪽: 검증 보고서 항목
  var items=v.elements||v.results||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="search"></span> 검증 보고서</div></div>'
    +(items.length?items.map(function(e,i){
      var r=e.overall_result||e.result||'pass';
      var checks=e.checks||[];
      return '<div class="opinion-val-item '+r+'" onclick="this.classList.toggle(\'expanded\')">'
        +'<div class="opinion-val-item-header">'
        +'<div class="el-no">'+(e.element_no||(i+1))+'</div>'
        +'<div class="el-label" style="line-height:1.5">'+escapeHtml(e.element_text||e.detail||'항목 '+(i+1))+'</div>'
        +'<div class="el-result">'+(r==='pass'?'<span class="ico" data-icon="check-circle"></span> 통과':r==='warn'?'⚠️ 주의':'<span class="ico" data-icon="x"></span> 실패')+'</div>'
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

  // 리뷰 엔진 마운트는 "최종 확인(renderOutput)" 화면으로 이전됨(트리거 버튼과 동일 위치). 여기선 no-op.
};

// ═══ Opinion Draft (전체 컨텍스트 + 참고 양식 전달) ═══
// TEMPLATE_GUARD: 양식 오염 방지 지시 — 긍정(스타일 모방) + 부정(금지 문구 명시)
Opinion.getTemplateGuard = function() {
  var positive = '\n\n⚠️ 중요 규칙: [참고 의견서 양식]은 톤·구조·문장 패턴만 참고하세요.'
    + ' 양식에 포함된 구체적 사건 내용(출원번호, 발명 명칭, 구성요소 설명, 인용발명 내용, 청구항 문언 등)을 절대 사용하지 마세요.'
    + ' 모든 내용은 반드시 [파싱 결과]와 [분석 결과]의 현재 대상 사건 정보로만 작성하세요.'
    + ' 특히 §29/§42 등 조문 번호는 [분석 결과]의 article 필드를 절대 우선으로 사용하고, 양식의 조문 표기는 무시하세요.';
  // 부정(negative): 실제 금지 문구가 있으면 명시하여 LLM이 복사하지 않도록 강제
  var spans = Opinion.state._templateForbiddenSpans || [];
  if (spans.length > 0) {
    positive += '\n\n[절대 복사 금지 — 아래 문구는 양식의 특정 사건 정보이므로 어떤 형태로도 사용하지 마세요]\n'
      + spans.slice(0, 8).map(function(s) { return '× ' + s; }).join('\n');
  }
  return positive;
};

// opts: { skipTemplate: bool, ignoreContaminationCheck: bool }
//   - skipTemplate: getActiveTemplate() 호출 안 함 (양식 무시 재시도)
//   - ignoreContaminationCheck: validateNoTemplateContamination() 결과 무시 (강제 진행)
Opinion.startOpinionDraft=async function(opts){
  opts = opts || {};
  var p=Opinion.state.current;if(!p)return;
  var run = Opinion._currentRun; // P2 #24
  // ── Cycle 8: 진행 플래그 + 에러 초기화 (finally가 책임지고 해제) ──
  Opinion.state.drafting = true;
  Opinion.state.draftError = null;
  // getActiveTemplate()을 호출하기 전에 forbiddenSpans 초기화 (새 실행마다 리셋)
  Opinion.state._templateForbiddenSpans = [];
  try{
    await Opinion.setStatus(p.id,'drafting_opinion');
    Opinion.renderDetail();
    var t=p.rejection_type;
    // ── skipTemplate: ref 컨텍스트(양식 텍스트) 미주입 ──
    var ctxSections = opts.skipTemplate ? ['parsed','analysis','draft','validation'] : ['parsed','analysis','draft','validation','ref'];
    var ctx = await Opinion.getContext(ctxSections);
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

    // ─── §3.2 스타일 지시 블록 (톤앤매너 강화) ───
    // ── Cycle 5: 혼합 모드일 때 두 템플릿 모두 로드 ──
    // ── Cycle 8: skipTemplate 옵션이 true이면 양식 미적용 ──
    var activeTemplObj = (!opts.skipTemplate) && Opinion.state.templates && Opinion.state.templates[t];
    // B-1: 사건 유형(t)에 업로드된 양식이 없는데 다른 유형 양식은 존재하면 유형 불일치 → 기본 문체로 생성됨을 알린다.
    //   (partial_rejection 등은 양식 슬롯이 없어 항상 기본 문체. inventive_step/description_deficiency 만 양식 슬롯.)
    Opinion.state._templateTypeMismatch = !!(!opts.skipTemplate && !activeTemplObj && Opinion.state.templates
      && Object.keys(Opinion.state.templates).filter(function(k){ return Opinion.state.templates[k] && Opinion.state.templates[k].text; }).length);
    if (Opinion.state._templateTypeMismatch) {
      console.warn('[Opinion] 양식 미적용 — 사건 유형(' + t + ')에 업로드된 양식 없음(다른 유형 양식만 존재) → 기본 문체로 생성.');
      try { showToast('이 사건 유형(' + t + ')에 업로드된 양식이 없어 기본 문체로 생성됩니다', 'info'); } catch (_e) {}
    }
    var secTemplObj = null;
    var secTemplKey = null;
    if (!opts.skipTemplate && Opinion.state._mixed_mode && Opinion.state._mixed_secondary && Opinion.state._mixed_secondary !== t) {
      secTemplKey = Opinion.state._mixed_secondary;
      secTemplObj = Opinion.state.templates && Opinion.state.templates[secTemplKey];
    }
    var styleGuide = '';
    if (activeTemplObj && activeTemplObj.text) {
      // ── Cycle 5: secondary 템플릿이 있으면 ref 컨텍스트에 추가 주입 ──
      if (secTemplObj && secTemplObj.text) {
        var secTplText = Opinion.getActiveTemplate(secTemplKey);
        if (secTplText) {
          ctx += '[★ 본 사무소 표준 의견서 양식 — 부 거절('+secTemplKey+') 시작]\n' + secTplText + '\n[★ 본 사무소 표준 의견서 양식 — 부 거절 끝]\n\n';
        }
      }
      styleGuide = '\n\n★★★ 문체·톤 준수 지시 (최우선 적용) ★★★\n'
        + '위 컨텍스트의 [★ 본 사무소 표준 의견서 양식]은 본 사무소의 실제 의견서다(기술용어·수치·식별자는 [*]로 마스킹됨). ★ 어투·문체만 학습 대상이며, [*] 마스킹 부분·기술내용·논증은 절대 차용하지 마라.\n'
        + (secTemplObj && secTemplObj.text ? '⚠️ 혼합 거절 모드: 주 거절('+t+') 양식과 부 거절('+secTemplKey+') 양식 두 개가 모두 제공되었다. 두 양식의 톤앤매너 패턴을 조합하라. 충돌 시 주 거절 양식을 우선하라.\n' : '')
        + '의견서를 작성하기 전에 아래 6가지 스타일 요소를 반드시 분석하고 동일하게 적용하라:\n'
        + '  ① 호칭: 출원인·귀청·심사관을 부르는 방식 → 양식과 동일하게 사용\n'
        + '  ② 명칭(본원·인용발명): 양식에서 가장 빈번한 본원 명칭(예: "본원발명"/"본 출원의 발명"/"본 발명")과 인용발명 명칭(예: "선행발명 1"/"인용문헌 1"/"비교대상발명 1")을 추출하여 동일하게 사용. LLM 기본 표현으로 변형하지 마라.\n'
        + '  ③ 종결어미: 합니다체·습니다체·드립니다체 혼용 여부 → 동일 체계 유지\n'
        + '  ④ 강조어구: 특정 단어나 구절의 반복 패턴 (강조하여 주장합니다, 명백히 등) → 재현\n'
        + '  ⑤ 단락 구조: 번호·기호 체계 (가. 나. / ① ② / (1) (2) / 가목·나목 등) → 동일 체계\n'
        + '  ⑥ 결어: 섹션 끝맺음 표현 ("이상과 같이", "따라서", "이에" 등) → 재현\n'
        + '⚠️ 차단 규칙: [본 사무소 표준 의견서 양식]에 없는 문체 표현(외래어 투, 영어 혼용, 딱딱한 번역체)은 자제하라.\n'
        + '⚠️ ★ 내용·구조 차용 절대 금지(오염 방지): (a) 양식의 [*] 마스킹 부분·기술내용·논증·구체 표현은 차용 금지 — 현재 사건의 실제 내용으로만 채운다. (b) 섹션 구조(순서·제목)는 양식이 아니라 아래 본문 지시의 ## 섹션을 그대로 따른다(양식 구조 차용 금지). 양식에서 가져오는 것은 오직 어투·종결어미·호칭·강조·연결어 등 "문체"뿐이다.\n'
        + '⚠️ §42 조문 보호: 의견서에 등장하는 §42 조항 표기(§42② 1호, §42④ 2호 등)는 반드시 [분석 결과]의 article 필드 값만 사용하라. 양식에 다른 조문 번호가 있어도 무시하라. 조문 표기는 스타일 적용 대상이 아니다.\n';
    }

    // ── Cycle 5: 혼합 모드일 때 의견서 통합 작성 지시 (4.1·4.2 분리 섹션) ──
    var mixedOpinionDirective = '';
    if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary && Opinion.state._mixed_secondary !== t) {
      var secKey3 = Opinion.state._mixed_secondary;
      var secInfo3 = Opinion.TYPES[secKey3] || {};
      var priInfo3 = Opinion.TYPES[t] || {};
      mixedOpinionDirective = '\n\n★★★ 혼합 거절 — 의견서 통합 작성 지시 (최우선 적용) ★★★\n'
        + '본 사건은 두 거절이유가 함께 통지된 혼합 거절이다. 위에 제공된 기본 구조 대신, 아래 통합 구조로 작성하라:\n\n'
        + '## 1. 사건의 표시\n(출원번호, 출원인 등)\n\n'
        + '## 2. 거절이유의 요지\n'
        + '- 주 거절이유: §'+(priInfo3.code||'')+' '+(priInfo3.label||t)+' (해당 청구항 명시)\n'
        + '- 부 거절이유: §'+(secInfo3.code||'')+' '+(secInfo3.label||secKey3)+' (해당 청구항 명시)\n\n'
        + '## 3. 보정의 요지\n(보정된 청구항을 거절이유별로 분류 요약. 각 보정에 적용된 거절이유 명시.)\n\n'
        + '## 4. 거절이유에 대한 의견\n'
        + '## 4.1 주 거절이유에 대하여 (§'+(priInfo3.code||'')+' '+(priInfo3.label||t)+')\n'
        + '(주 거절이유에 대한 의견 본문 — 위 기본 구조의 "구체적 의견내용" 단계 적용)\n\n'
        + '## 4.2 부 거절이유에 대하여 (§'+(secInfo3.code||'')+' '+(secInfo3.label||secKey3)+')\n'
        + '(부 거절이유에 대한 의견 본문 — secondary_analysis 결과를 바탕으로 작성)\n\n'
        + '## 5. 결어\n("이상과 같이 두 거절이유는 모두 해소되었으므로...")\n\n'
        + '⚠️ 4.1·4.2는 반드시 "## " 두 글자 헤더로 작성하라(### 3-level 금지). 두 거절이유의 가시성을 동등하게 유지해야 한다.\n'
        + '⚠️ 두 섹션 사이 cross-reference는 자유. 같은 보정으로 두 거절을 동시 해소한 경우 명시하라.\n'
        + '⚠️ 위 기본 구조(tpl[t])의 섹션 번호와 충돌하면 본 통합 구조를 우선하라.\n';
    }

    var prompt = Opinion.SYS_PROMPT + Opinion.getTemplateGuard() + '\n\n' + ctx + revCtx + styleGuide + mixedOpinionDirective + tpl[t];
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

    // ─── §3.4 스타일 적용 가시성 플래그 ───
    od._style_applied = !!(activeTemplObj && activeTemplObj.text);
    // ─── Cycle 5: 혼합 모드 가시성 플래그 ───
    if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary) {
      od._mixed_mode = true;
      od._mixed_primary = Opinion.state._mixed_primary || t;
      od._mixed_secondary = Opinion.state._mixed_secondary;
      od._mixed_templates = {
        primary: !!(activeTemplObj && activeTemplObj.text),
        secondary: !!(secTemplObj && secTemplObj.text)
      };
    }

    // 양식 내용 오염 검증 (Cycle 6 P2#9 — severity 3단계)
    var fullText = od.sections.map(function(s){return s.content;}).join('\n');
    var check = opts.ignoreContaminationCheck
      ? { clean: true, warnings: [], severity: 'low' }
      : Opinion.validateNoTemplateContamination(fullText);
    if (!check.clean) {
      console.warn('[Opinion] Template contamination:', check.warnings.length, 'items, severity:', check.severity);
      od._contamination_warnings = check.warnings;
      od._contamination_severity = check.severity;
      if (check.severity === 'high') {
        // ── Cycle 8: HIGH 디버그 로깅 강화 (forbiddenSpan 원문 + 위치 컨텍스트 + 사건 cross-check) ──
        var actualAppNo = p.application_no || '(미설정)';
        var actualTitle = p.title || '(미설정)';
        console.warn('[Opinion.contam HIGH] current case appNo:', actualAppNo, '| title:', actualTitle);
        check.warnings.filter(function(w){return w.severity==='high';}).forEach(function(w, i) {
          var frag = (w.template_fragment || '').replace(/\.\.\.$/, '');
          var probe = frag.slice(0, Math.min(w.match_length || 20, frag.length));
          var idx = probe ? fullText.indexOf(probe) : -1;
          var ctx30 = idx >= 0
            ? '...' + fullText.slice(Math.max(0, idx-30), idx + (w.match_length||20) + 30) + '...'
            : '(매치 위치 재확인 실패)';
          console.warn('[Opinion.contam HIGH #' + (i+1) + '] forbiddenSpan:', w.template_fragment);
          console.warn('[Opinion.contam HIGH #' + (i+1) + '] match context (앞뒤 30자):', ctx30);
        });
        od._blocked_by_contamination = true;
        // DB 저장은 best-effort. 실패해도 차단은 진행.
        try {
          var blockPayload = {project_id:p.id, opinion_type:t, content:od, status:'contamination_blocked'};
          console.log('[Opinion.DB] opinion_opinion_drafts INSERT (blocked) payload:', blockPayload);
          var blockRes = await sb.from('opinion_opinion_drafts').insert(blockPayload).select();
          if (blockRes && blockRes.error) {
            console.error('[Opinion.DB] block-insert error:', blockRes.error.message, '| details:', blockRes.error.details, '| hint:', blockRes.error.hint, '| code:', blockRes.error.code);
          }
        } catch (be) {
          console.error('[Opinion.DB] block-insert exception:', be);
        }
        Opinion.state.opinionDraft = od;
        // 차단을 catch 블록의 통합 처리로 위임 (finally가 로딩을 풀고 에러 카드 표시)
        var hiCnt = check.warnings.filter(function(w){return w.severity==='high';}).length;
        var ce = new Error(hiCnt + '건 사건 특유 문구 혼입 의심 — 양식 점검 또는 양식 없이 재시도하세요');
        ce.kind = 'contamination';
        throw ce;
      }
      // medium: 콘솔 경고 + 헤더에 표시하되 생성 진행
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

    // ── Cycle 8: DB INSERT 에러 추적 강화 ──
    var draftPayload = {project_id:p.id, opinion_type:t, content:od, status:'draft'};
    console.log('[Opinion.DB] opinion_opinion_drafts INSERT (draft) payload keys:', Object.keys(draftPayload), '| project_id:', p.id, '| opinion_type:', t, '| status:', 'draft');
    var insRes = await sb.from('opinion_opinion_drafts').insert(draftPayload).select();
    if (insRes && insRes.error) {
      console.error('[Opinion.DB] INSERT error:', insRes.error.message, '| details:', insRes.error.details, '| hint:', insRes.error.hint, '| code:', insRes.error.code);
      var de = new Error('opinion_opinion_drafts INSERT 실패: ' + insRes.error.message + (insRes.error.details ? ' / '+insRes.error.details : ''));
      de.kind = 'db';
      throw de;
    }
    Opinion.state.opinionDraft=od;
    await Opinion.setStatus(p.id,'opinion_drafted');
    showToast('의견서 초안 생성 완료 (' + od.sections.length + '개 섹션)');
  }catch(e){
    // ── Cycle 8: 에러 종류별 분류 + state.draftError에 저장 (renderOpinion이 카드 표시) ──
    console.error('[Opinion] Opinion draft error:', e);
    var kind = e && e.kind ? e.kind : 'unknown';
    var msg = (e && e.message) ? e.message : String(e);
    if (kind === 'unknown') {
      if (/INSERT|INSERT 실패|400/i.test(msg)) kind = 'db';
      else if (/오염|혼입|contamination/i.test(msg)) kind = 'contamination';
    }
    Opinion.state.draftError = { kind: kind, message: msg };
    try { await Opinion.setStatus(p.id,'claims_confirmed'); } catch(se) { console.warn('[Opinion] rollback setStatus failed:', se); }
    var toastMsg = kind === 'contamination' ? '양식의 다른 사건 정보가 출력에 포함됨'
                 : kind === 'db' ? '초안 저장 실패: '+msg
                 : '의견서 생성 실패: '+msg;
    showToast(toastMsg, 'error');
  } finally {
    // ── Cycle 8: finally — 어떤 경로(성공/예외/contamination/DB)로 끝나든 로딩 해제 ──
    // Case A (contamination HIGH) / Case B (DB 400) / Case C (정상) 모두 이 finally를 거친다.
    Opinion.state.drafting = false;
    Opinion.renderDetail();
  }
};

// ── Cycle 8: 의견서 작성 재시도 헬퍼 — 에러 카드 버튼에서 호출 ──
Opinion.retryDraft = function() {
  Opinion.state.draftError = null;
  return Opinion.startOpinionDraft();
};
Opinion.retryDraftWithoutTemplate = function() {
  Opinion.state.draftError = null;
  return Opinion.startOpinionDraft({ skipTemplate: true });
};
Opinion.forceDraftIgnoringContamination = function() {
  if (!confirm('검증에서 사건 특유 문구 혼입이 감지되었습니다. 검증 결과를 무시하고 강제로 초안을 사용하시겠습니까?\n(이후 변리사 직접 확인 필수)')) return;
  Opinion.state.draftError = null;
  return Opinion.startOpinionDraft({ ignoreContaminationCheck: true });
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
  // ── Cycle 8: drafting flag가 false이면 status가 claims_confirmed/drafting_opinion이라도 로딩 미표시 ──
  // (finally가 drafting=false 처리 후 에러 카드 또는 ready 화면으로 진입)
  var loading=(status==='drafting_opinion'||status==='claims_confirmed') && Opinion.state.drafting === true;
  var nav=Opinion.renderNavBar('opinion');
  var o=Opinion.state.opinionDraft||{};

  // ── Cycle 8: 우선순위 1 — 에러 카드 (인라인, alert 금지) ──
  // contamination HIGH 또는 DB 400/저장 실패 시 startOpinionDraft가 state.draftError를 설정하고 finally에서 여기로 진입
  if (Opinion.state.draftError && !ready) {
    var err = Opinion.state.draftError;
    var headLine, helpLine;
    if (err.kind === 'contamination') {
      headLine = '<span class="status-dot negative"></span> 양식의 다른 사건 정보가 출력에 포함됨';
      helpLine = '양식을 점검하거나 양식 없이 다시 시도하세요. 콘솔 로그에서 어떤 forbiddenSpan이 매치되었는지 확인할 수 있습니다.';
    } else if (err.kind === 'db') {
      headLine = '<span class="status-dot negative"></span> 초안 저장 실패';
      helpLine = '데이터베이스 INSERT가 거부되었습니다. 콘솔 로그의 details/hint/code를 확인 후 다시 시도하세요.';
    } else {
      headLine = '<span class="status-dot negative"></span> 의견서 생성 실패';
      helpLine = '예상치 못한 오류가 발생했습니다. 콘솔 로그를 확인 후 다시 시도하세요.';
    }
    var btnRetry = '<button class="btn btn-primary" onclick="Opinion.retryDraft()" style="flex:1"><span class="ico" data-icon="refresh"></span> 다시 시도</button>';
    var btnNoTpl = '<button class="btn btn-outline" onclick="Opinion.retryDraftWithoutTemplate()" style="flex:1"><span class="ico" data-icon="clipboard"></span> 양식 제거 후 다시 시도</button>';
    var btnForce = err.kind === 'contamination'
      ? '<button class="btn btn-outline" onclick="Opinion.forceDraftIgnoringContamination()" style="flex:1;color:#b45309;border-color:var(--dt-warning)"><span class="ico" data-icon="warning"></span> 양식 강제 적용 (검증 무시)</button>'
      : '';
    L.innerHTML = nav
      + '<div class="opinion-gate-card" style="border-color:var(--color-error);background:linear-gradient(135deg,#FEECEC 0%,#fff 100%)">'
      + '<div class="opinion-gate-title" style="color:var(--color-error)"><span class="ico" data-icon="warning"></span> ' + headLine + '</div>'
      + '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px">' + escapeHtml(err.message || '') + '</div>'
      + '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:14px">' + helpLine + '</div>'
      + '<div class="opinion-gate-actions" style="flex-wrap:wrap;gap:8px">' + btnRetry + btnNoTpl + btnForce + '</div>'
      + '</div>';
    R.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--color-text-tertiary);font-size:13px">의견서가 생성되지 않았습니다.<br><span style="font-size:11px">왼쪽 패널의 버튼으로 재시도하세요.</span></div>';
    return;
  }

  if(loading && !ready){
    Opinion.renderLoading(L,R,'의견서 작성 중...','심사관과 변리사가 의견서를 협의하고 있습니다');return;
  }

  var contamWarnings = o._contamination_warnings || [];
  var contamHtml = '';
  var highWarns  = contamWarnings.filter(function(w){ return w.severity === 'high'; });
  var medWarns   = contamWarnings.filter(function(w){ return w.severity === 'medium'; });
  // low severity는 UI 미표시 (KOREAN_PATENT_BOILERPLATE 정형 문구 — 정상)
  if (highWarns.length > 0) {
    contamHtml += '<div style="margin-top:12px;padding:12px;background:var(--color-error-light);border-radius:8px;border-left:3px solid var(--color-error)">'
      +'<div style="font-weight:600;font-size:12px;color:var(--color-error);margin-bottom:6px"><span class="status-dot negative"></span> 다른 사건 정보 혼입 의심 ('+highWarns.length+'건) — 변리사 직접 확인 필수</div>'
      +'<div style="font-size:11px;color:var(--color-error);line-height:1.6">'
      +highWarns.map(function(w){return '• "'+escapeHtml(w.template_fragment)+'" ('+w.match_length+'자 일치)';}).join('<br>')
      +'</div>'
      +'<p style="font-size:11px;color:var(--color-text-secondary);margin-top:6px">청구항 번호·인용발명 번호·단락번호 등 참고 양식의 사건 특유 내용이 의견서에 혼입되었을 수 있습니다.</p>'
      +'</div>';
  }
  if (medWarns.length > 0) {
    contamHtml += '<div style="margin-top:8px;padding:10px 12px;background:#fffbeb;border-radius:8px;border-left:3px solid var(--dt-warning)">'
      +'<div style="font-weight:600;font-size:12px;color:#663A00;margin-bottom:4px"><span class="status-dot cautionary"></span> 스타일 문구 유사 확인 권장 ('+medWarns.length+'건)</div>'
      +'<div style="font-size:11px;color:#663A00;line-height:1.6">'
      +medWarns.map(function(w){return '• "'+escapeHtml(w.template_fragment)+'" ('+w.match_length+'자 일치)';}).join('<br>')
      +'</div>'
      +'</div>';
  }

  // ─── §3.4 스타일 적용 가시성 배지 ───
  var styleBadge = '';
  if (o._style_applied === true) {
    if (highWarns.length > 0) {
      styleBadge = '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#FEF4E6;border-radius:12px;font-size:11px;font-weight:600;color:#f57f17;margin-top:8px;margin-bottom:2px"><span class="ico" data-icon="warning"></span> 부분 적용 — 본 사무소 스타일 (다른 사건 정보 혼입 의심 — 확인 필요)</div>';
    } else {
      // ── Cycle 5: 두 템플릿 결합 표시 ──
      var styleSuffix = '';
      if (o._mixed_mode && o._mixed_templates && o._mixed_templates.primary && o._mixed_templates.secondary) {
        styleSuffix = ' (' + (o._mixed_primary || '') + '·' + (o._mixed_secondary || '') + ' 템플릿 결합)';
      } else if (o._mixed_mode && o._mixed_templates && (o._mixed_templates.primary || o._mixed_templates.secondary)) {
        var onlyKey = o._mixed_templates.primary ? (o._mixed_primary || '') : (o._mixed_secondary || '');
        styleSuffix = ' (' + onlyKey + ' 템플릿만 적용)';
      }
      styleBadge = '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#e8f5e9;border-radius:12px;font-size:11px;font-weight:600;color:var(--dt-success);margin-top:8px;margin-bottom:2px"><span class="ico" data-icon="image"></span> 본 사무소 스타일 적용됨'+escapeHtml(styleSuffix)+'</div>';
    }
  } else if (o._style_applied === false) {
    styleBadge = '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--color-bg-secondary);border-radius:12px;font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-top:8px;margin-bottom:2px"><span class="ico" data-icon="info"></span> 기본 스타일</div>';
  }

  // ─── Cycle 5: 혼합 모드 배지 ───
  var mixedBadge = '';
  if (o._mixed_mode && o._mixed_secondary) {
    var pInfoR = Opinion.TYPES[o._mixed_primary || ''] || {};
    var sInfoR = Opinion.TYPES[o._mixed_secondary || ''] || {};
    mixedBadge = '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#e3f2fd;border-radius:12px;font-size:11px;font-weight:600;color:var(--dt-brand-hover);margin-top:8px;margin-left:6px;margin-bottom:2px"><span class="ico" data-icon="split"></span> 혼합 거절 통합 모드 — §'+escapeHtml(pInfoR.code||'')+' + §'+escapeHtml(sInfoR.code||'')+'</div>';
  }

  L.innerHTML=nav+(ready?'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="ico" data-icon="edit"></span> 의견서 작성 완료</div><p style="font-size:13px;color:var(--color-text-secondary)">의견서를 검토하고 승인하면 최종 출력물이 생성됩니다.</p>'
    +styleBadge
    +mixedBadge
    +contamHtml
    +'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(3)"><span class="ico" data-icon="edit"></span> 수정</button><button class="btn btn-primary" id="btnGate3Approve" onclick="Opinion.approveGate(3)"><span class="ico" data-icon="check-circle"></span> 승인</button></div></div>':'<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">의견서 작성 중...</div></div>');
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
  R.innerHTML='<div class="opinion-preview"><div class="opinion-preview-header"><span style="font-weight:600"><span class="ico" data-icon="edit"></span> '+escapeHtml(o.title||'의견서')+'</span></div><div class="opinion-preview-body">'+opinionHtml+'</div></div>';
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
  L.innerHTML=nav+'<div class="card"><div class="card-header"><div class="card-title"><span class="ico" data-icon="download"></span> 최종 확인 + 출력</div></div>'
    +'<div style="padding:6px 10px;background:#F7FBFF;border-radius:6px;margin-bottom:10px;font-size:11px;color:#003E9C"><span class="ico" data-icon="info"></span> 베타 단계 — 의견서·보정서는 변리사 검토 후 제출하세요</div>'
    +'<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">의견서 대응이 완료되었습니다. 다운로드하여 특허로에 제출하세요.</p>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.downloadOpinionDocx()"'+(done?'':' disabled')+'><span class="ico" data-icon="edit"></span> 의견서 (Word)</button>'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.downloadAmendmentDocx()"'+(amendDisabled?' disabled':'')+amendTip+'><span class="ico" data-icon="doc"></span> 보정서 (Word, 별지 제13호)</button>'
    +'<button class="btn btn-outline btn-full" onclick="Opinion.downloadDocx(\'all\')"'+(done?'':' disabled')+'><span class="ico" data-icon="clipboard"></span> 전체 (의견서+검증보고서)</button>'
    +'<button class="btn btn-ghost btn-full" onclick="Opinion.copyOpinionText()"'+(done?'':' disabled')+'><span class="ico" data-icon="clipboard"></span> 텍스트 복사</button>'
    +'</div></div>'
    // AI 검증(통합 리뷰 엔진) — 토글 OFF면 무동작(E-21). 보정안 미작성 시 비활성(게이트). 결과도 같은 화면 마운트.
    +'<div class="card" id="opinionReviewCard"><div class="card-header"><div class="card-title"><span class="ico" data-icon="shield"></span> AI 검증</div></div>'
    +'<p style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:10px">심사관단·변리사 AI가 보정안의 거절위험(진보성·기재불비 등)을 검증합니다.</p>'
    +'<button class="btn btn-primary btn-full" id="btnOpinionReview" onclick="Opinion.runReviewEngine()"><span class="ico" data-icon="shield"></span> 의견서 검증 시작</button>'
    +'<div id="opinionReviewGateMsg" style="font-size:12px;color:var(--color-text-tertiary);margin-top:8px"></div>'
    +'<div id="opinionReviewMount" style="margin-top:12px"></div>'
    // D2c: "승인 방향 반영"(청구항 자동 재작성) 버튼 — ★ 상시 렌더(렌더 타이밍 의존 구조적 제거). 승인된 방향이
    //   없으면 클릭 시 applyDirectionRewrite 가드 토스트("반영할 승인 보정 방향이 없습니다")로 안전 처리. 명시 액션(승인 자동트리거 아님).
    +'<button class="btn btn-outline btn-full" id="btnDirectionRewrite" style="margin-top:10px" onclick="Opinion.startDirectionRewrite()"><span class="ico" data-icon="edit"></span> 승인 방향 반영 — 청구항 자동 재작성(변리사 확정)</button>'
    +'</div>';

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
    opinionHtml = done?'<div style="text-align:center;padding:40px"><div style="font-size:48px;margin-bottom:12px"><span class="ico" data-icon="check-circle"></span></div><h3 style="font-size:18px;font-weight:700;color:var(--color-success);margin-bottom:8px">의견서 대응 완료!</h3></div>':'<p style="color:var(--color-text-tertiary);text-align:center;padding:40px">의견서 미생성</p>';
  }
  R.innerHTML='<div class="opinion-preview"><div class="opinion-preview-header"><span style="font-weight:600"><span class="ico" data-icon="edit"></span> '+escapeHtml(o.title||'의견서')+' 미리보기</span></div><div class="opinion-preview-body">'+opinionHtml+'</div></div>';

  // 검증 버튼 게이트 갱신 + 결과 마운트(트리거·결과 동일 화면).
  try { Opinion._updateReviewGate(); } catch (_e) {}                                  // 캐시 있으면 즉시 반영
  try { Opinion._loadParsedDoc().then(function(){ Opinion._updateReviewGate(); }); } catch (_e) {} // DB재조회 후 버튼 활성화
  try { Opinion._mountReviewResult(); } catch (_e) {}
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
  // CSS class 불사용 — 모든 스타일 inline 처리됨. Word/Hancom/LibreOffice 호환성 강화
  var fullHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    +'<head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><meta name="Originator" content="Microsoft Word 15"><style>'
    +'body{font-family:"맑은 고딕","Malgun Gothic",sans-serif;font-size:11pt;line-height:1.7;mso-fareast-font-family:"맑은 고딕";}'
    +'h1{font-size:18pt;text-align:center;mso-outline-level:1;}'
    +'h2{font-size:13pt;margin-top:16pt;border-bottom:1px solid #999;padding-bottom:4pt;mso-outline-level:2;}'
    +'h3{font-size:12pt;margin-top:10pt;mso-outline-level:3;}'
    +'p{margin:0 0 6pt 0;mso-margin-top-alt:auto;mso-margin-bottom-alt:auto;}'
    +'</style></head>'
    +'<body>'+html+'</body></html>';
  var blob = new Blob(['﻿'+fullHtml], {type:'application/msword'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  // B-1: 파일명에 날짜+시각(HHMMSS) — 같은 날 재다운로드 시 구버전(확정 전) 파일 혼동 방지.
  var _dt = new Date();
  var datestr = _dt.toISOString().slice(0,10) + '_' + _dt.toTimeString().slice(0,8).replace(/:/g,'');
  a.href = url; a.download = '보정서_' + (p.application_no||p.title||'output') + '_' + datestr + '.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  // Cycle 6 §2.5 — Word 호환성 수동 검증 안내 토스트
  showToast('<span class="ico" data-icon="check-circle"></span> 보정서 다운로드 완료 — KIPO 제출 전 Word/Hancom에서 표·취소선·한글 인코딩 정상 여부를 확인해 주세요', 'info');
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

  // ── inline style 상수 (Word mso 속성 포함) ──
  var S_BLOCK = 'style="border:1px solid #ccc;border-collapse:collapse;padding:10pt;margin:8pt 0;background:var(--dt-g50);mso-border-alt:solid #ccc .5pt;display:block;"';
  var S_OLD   = 'style="color:#888;text-decoration:line-through;mso-text-strike:on;display:block;margin-top:4pt;"';
  var S_NEW   = 'style="font-weight:600;color:#000;display:block;margin-top:4pt;"';
  var S_REASON= 'style="font-size:10pt;color:#444;margin-top:6pt;display:block;"';

  // ── Cycle 5: 혼합 모드 정보 ──
  var isMixed = !!(Opinion.state._mixed_mode && Opinion.state._mixed_secondary);
  var mixedPrimaryInfo = isMixed ? (Opinion.TYPES[Opinion.state._mixed_primary || t] || {}) : {};
  var mixedSecondaryInfo = isMixed ? (Opinion.TYPES[Opinion.state._mixed_secondary] || {}) : {};

  var html = '';
  html += '<h1>보 정 서</h1>';
  html += '<h2>【사건의 표시】</h2>';
  html += '<p>출원번호: ' + escapeHtml(appNo) + '</p>';
  if (applicant) html += '<p>출원인: ' + escapeHtml(applicant) + '</p>';
  if (inventionTitle) html += '<p>발명의 명칭: ' + escapeHtml(inventionTitle) + '</p>';
  if (isMixed) {
    html += '<p style="font-size:10pt;color:#444;margin-top:6pt;">'
          + '※ 본 보정서는 두 거절이유(§' + escapeHtml(mixedPrimaryInfo.code||'') + ' ' + escapeHtml(mixedPrimaryInfo.label||'')
          + ' + §' + escapeHtml(mixedSecondaryInfo.code||'') + ' ' + escapeHtml(mixedSecondaryInfo.label||'') + ')에 대응하는 통합 보정서입니다.</p>';
  }

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
      html += '<div ' + S_BLOCK + '><div><b>【청구항 ' + escapeHtml(String(ac.claim_no)) + '】</b></div>'
            + '<div ' + S_OLD + '>' + escapeHtml(origText).replace(/\n/g,'<br>') + '</div></div>';
    });
  }

  // 나. 보정 후
  html += '<h3>나. 보정 후</h3>';
  amendedArr.forEach(function(ac){
    var newText = ac.amended || ac.corrected || ac.text || '';
    html += '<div ' + S_BLOCK + '><div><b>【청구항 ' + escapeHtml(String(ac.claim_no)) + '】</b></div>'
          + '<div ' + S_NEW + '>' + escapeHtml(newText).replace(/\n/g,'<br>') + '</div></div>';
  });
  // partial_rejection의 deleted_claims도 표시
  if (Array.isArray(draftResult.deleted_claims) && draftResult.deleted_claims.length) {
    html += '<p style="color:#900;"><b>삭제된 청구항:</b> ' + draftResult.deleted_claims.map(function(n){ return '【청구항 '+n+'】'; }).join(', ') + '</p>';
  }

  // 다. 보정 사유
  html += '<h3>다. 보정 사유</h3>';
  amendedArr.forEach(function(ac){
    var basis = ac.spec_basis;
    var basisStr = '';
    if (Array.isArray(basis)) basisStr = basis.join(', ');
    else if (typeof basis === 'string') basisStr = basis;
    var summary = ac.amendments_summary || (ac.changes ? ac.changes.map(function(ch){ return ch.detail||ch.type; }).join('; ') : '');
    // ── Cycle 5: 혼합 모드 — applied_rejections 라벨 ──
    var rejLabel = '';
    if (isMixed) {
      var ar = ac.applied_rejections;
      if (Array.isArray(ar) && ar.length) {
        rejLabel = ' <span style="font-size:9pt;color:var(--dt-brand-hover);font-weight:600">[' + escapeHtml(ar.join(' + ')) + ']</span>';
      }
    }
    html += '<div ' + S_REASON + '><b>청구항 ' + escapeHtml(String(ac.claim_no)) + ':</b>' + rejLabel + ' '
          + escapeHtml(summary || '명세서 기재 범위 내에서 보정.')
          + (basisStr ? ' <i>(근거 단락: ' + escapeHtml(basisStr) + ')</i>' : '')
          + '</div>';
    // ★ D1+D2d: AI 검증 승인 보정 권고(방향)를 read-only 로 렌더. ac.review_amendments 를 직접 읽어
    //   각 방향의 applied(=D2c 확정으로 청구항 문언에 반영됨) 여부를 "(반영됨)" 라벨로 공존 표시한다.
    //   ★ D1(텍스트 권고)과 D2(문언 반영)는 공존 — D2가 D1 을 대체하지 않는다(미반영은 기존대로 권고만). write 0.
    var _revAmds = (Array.isArray(ac.review_amendments) ? ac.review_amendments : [])
      .filter(function(ra){ return ra && ra.direction && String(ra.direction).trim(); });
    if (_revAmds.length) {
      var _anyApplied = _revAmds.some(function(ra){ return ra.applied === true; });
      html += '<div ' + S_REASON + '><b>청구항 ' + escapeHtml(String(ac.claim_no)) + ' — [AI 검증 보정 권고]</b>'
            + ' <span style="font-size:9pt;color:#666;">※ AI 검증에서 승인된 보정 방향입니다. '
            + (_anyApplied ? '<b style="color:#1B5E20">(반영됨)</b>은 청구항 문언에 반영 완료, 그 외는 변리사가 확정하세요.'
                           : '완성 문언은 변리사가 확정하세요(자동 변경되지 않음).')
            + '</span>'
            + _revAmds.map(function(ra){
                return '<div style="margin-top:2pt;">· ' + escapeHtml(String(ra.direction))
                     + (ra.applied === true ? ' <b style="color:#1B5E20;font-size:9pt;">(반영됨)</b>' : '') + '</div>';
              }).join('')
            + '</div>';
    }
  });

  // §47② 신규사항 추가 금지 적시
  html += '<p style="margin-top:12pt;font-size:10pt;color:#444;mso-margin-top-alt:9.0pt;">※ 본 보정은 특허법 제47조 제2항에 따라 최초 명세서 또는 도면에 기재된 사항의 범위 내에서 이루어졌습니다.</p>';

  // description_lack 케이스 안내
  if (t === 'description_deficiency') {
    var items = (Opinion.state.analysis && (Opinion.state.analysis.items || [])) || [];
    var hasDescLack = items.some(function(it){ return it && it.deficiency_type === 'description_lack'; });
    if (hasDescLack) {
      html += '<p style="margin-top:8pt;font-size:10pt;color:#900;background:#FEF4E6;padding:8pt;border-left:3px solid var(--dt-warning)">'
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
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span class="ico" data-icon="warning" data-size="32"></span><div><h3 style="font-size:16px;font-weight:600;color:var(--color-error);margin-bottom:2px">파싱 실패</h3><p style="font-size:12px;color:var(--color-text-secondary)">텍스트 추출에 문제가 있습니다</p></div></div>'
    +'<pre style="white-space:pre-wrap;font-size:12px;background:var(--color-bg-tertiary);padding:14px;border-radius:8px;line-height:1.6;color:var(--color-text-secondary);max-height:200px;overflow-y:auto">'+escapeHtml(detail)+'</pre>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.resetToUpload()"><span class="ico" data-icon="folder"></span> 파일 추가/변경 후 재시도</button>'
    +'<button class="btn btn-outline btn-full" onclick="Opinion.resetToUploadWithManual()"><span class="ico" data-icon="edit"></span> 직접 텍스트 입력으로 전환</button>'
    +'</div></div>';
  R.innerHTML='<div class="card" style="padding:24px"><div style="font-weight:600;font-size:13px;margin-bottom:12px"><span class="ico" data-icon="lightbulb"></span> PDF 인식이 안 되는 경우</div>'
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
Opinion.setStatus=async function(id,s){
  try{
    var res=await sb.from('opinion_projects').update({status:s,updated_at:new Date().toISOString()}).eq('id',id);
    if(res.error) throw res.error;
    var p=Opinion.state.current;if(p&&p.id===id)p.status=s;
    Opinion.state.projects.forEach(function(x){if(x.id===id)x.status=s;});
    return {ok:true};
  }catch(e){
    console.error('[Opinion.setStatus] DB 실패 (status='+s+'):', e);
    showToast('상태 저장 실패 — 새로고침 후 재시도해 주세요', 'error');
    // 메모리 status 변경 않음 → DB와 일치 유지
    return {ok:false, error:e.message||String(e)};
  }
};
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
