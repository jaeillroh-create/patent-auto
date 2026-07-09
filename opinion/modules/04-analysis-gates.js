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
