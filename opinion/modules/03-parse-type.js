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
