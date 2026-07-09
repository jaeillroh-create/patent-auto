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
        + '★ 서두·결어 문체 우선 학습: 양식의 도입부(예: "귀청께서는 …의견제출통지서를 …하였는바") 와 맺음부(예: "이상과 같이 …할 것입니다" / "…앙망하는 바입니다")의 어투·호칭·종결을 그대로 재현하라. 단 식별자·조문번호([청구항*]/[*])는 현재 사건의 실제 값(분석 결과)으로 교체한다.\n'
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
    // ★ setStatus 결과 표면화: opinion_projects.status 가 'opinion_drafted' 를 거부(조용한 {ok:false})하면
    //   상태가 '작성 중'에 묶여 무증상 멈춤(본문은 있는데 7단계 안 열림) → db 에러로 승격해 에러 카드+재시도로
    //   표면화한다. setStatus 자체는 불변(다른 호출처 영향 없음) — 여기서만 결과를 검사한다.
    var stRes = await Opinion.setStatus(p.id,'opinion_drafted');
    if (stRes && stRes.ok === false) {
      var stErr = new Error('상태 전환 실패(opinion_drafted): ' + (stRes.error || 'opinion_projects.status 거부') + ' — DB status 제약 확인 필요');
      stErr.kind = 'db';
      throw stErr;
    }
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

