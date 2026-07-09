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
