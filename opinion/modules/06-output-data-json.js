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
  // 6개 독립 쿼리를 병렬 실행 (★ review_runs = 검증 결과 재수화)
  var results = await Promise.all([
    sb.from('opinion_issue_analyses').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_draft_claims').select('draft_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_validation_results').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_opinion_drafts').select('content').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('opinion_type_determinations').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    // ★ 검증 결과 재수화 — review_runs 최신 done. _persistReviewDecision 가 result=reviewState(accepted 포함) 저장 →
    //   issues+보정안+승인상태 동시 복원. 없으면 null → 기존 "의견서 검증 시작" 버튼. RLS·인덱스 기존(20260616).
    sb.from('review_runs').select('result').eq('project_id',String(id)).eq('module','opinion').eq('status','done').order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  var a=results[0].data, d=results[1].data, v=results[2].data, o=results[3].data, t=results[4].data, rr=results[5].data;
  // ★ 검증 결과 메모리 복원(있으면) — 끝의 renderDetail 이 _mountReviewResult 카드 발화. resetState 가 이미 비웠으므로 결과 있을 때만 설정.
  if (rr && rr.result) Opinion.state.reviewState = rr.result;

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
