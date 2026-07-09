// 10. Checkpoint 2: 분석
// ═══════════════════════════════════════════
Division.runAnalyze = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  var right = document.getElementById('divisionDetailRight');
  right.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;margin-bottom:12px"><span class="ico" data-icon="search"></span></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">분석 진행 중...</div><div id="divisionAnalyzeProgress"></div></div>';
  try {
    App.showProgress('divisionAnalyzeProgress','구성요소 분해 중...',1,4);
    var {data:paragraphs} = await sb.from('division_spec_paragraphs').select('*').eq('project_id',p.id).order('paragraph_number');
    Division.state.specParagraphs = paragraphs || [];
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    if(!basisClaim){
      // 폴백: 독립항 중 첫 번째를 basis로 사용
      basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });
    }
    if(!basisClaim){
      showToast('독립항을 찾을 수 없습니다. 청구항을 확인해 주세요.','error'); return;
    }
    App.showProgress('divisionAnalyzeProgress','미활용 구성 탐색 중...',2,4);
    var specText = await Division._loadSpecText(p, paragraphs);
    var excludedClaims = claims.filter(function(c){ return c.division_role==='excluded'; });
    var excludedText = excludedClaims.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text); }).join('\n');
    var analyzePrompt = Division._buildAnalyzePrompt(basisClaim, specText, excludedText, claims);

    // 디버그: 분석 입력 상태 로깅
    Division._log('[Division] ── 분석 프롬프트 디버그 ──');
    Division._log('[Division] specText 출처:', p.spec_full_text ? 'spec_full_text (DB)' : (paragraphs && paragraphs.length ? 'DB 단락 폴백' : '없음'));
    Division._log('[Division] specText 길이:', specText.length, '글자');
    Division._log('[Division] specText 앞 300자:', specText.substring(0, 300));
    Division._log('[Division] basisClaim:', basisClaim.claim_number, '— 길이:', (basisClaim.amended_text||basisClaim.original_text||'').length);
    Division._log('[Division] 전체 청구항:', claims.length, '건, 제외:', excludedClaims.length, '건');
    Division._log('[Division] 분석 프롬프트 전체 길이:', analyzePrompt.length, '글자');
    Division._log('[Division] 프롬프트 앞 500자:', analyzePrompt.substring(0, 500));

    var result = await Division.callAI(analyzePrompt);
    // max_tokens 잘림 시 이어쓰기 시도
    if(result.stopReason === 'max_tokens'){
      console.warn('[Division] 분석 응답 max_tokens 잘림, 이어쓰기 시도');
      showToast('응답이 잘려 이어쓰기 중...', 'info');
      var contPrompt = '이전 응답이 잘렸다. 아래 JSON을 이어서 완성하라. 중복 없이 잘린 지점부터 이어쓰라.\n\n' + result.text.substring(result.text.length - 500);
      var cont = await Division.callAI(contPrompt);
      result.text = result.text + (cont.text || '');
      Division._log('[Division] 이어쓰기 후 총 길이:', result.text.length);
    }
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 분석 중 프로젝트 전환됨 — 결과 폐기'); App.clearProgress('divisionAnalyzeProgress'); return; }

    // 디버그: LLM 응답 로깅
    Division._log('[Division] ── LLM 응답 디버그 ──');
    Division._log('[Division] 응답 전체 길이:', result.text ? result.text.length : 0, '글자');
    Division._log('[Division] stopReason:', result.stopReason);
    Division._log('[Division] 응답 앞 1000자:', (result.text||'').substring(0, 1000));

    App.showProgress('divisionAnalyzeProgress','결과 저장 중...',3,4);
    var analyzed;
    try { analyzed = Division._extractJSON(result.text); }
    catch(e) { showToast('분석 결과 해석 실패: ' + e.message.substring(0,80),'error'); return; }

    // 디버그: 파싱된 JSON 구조 로깅
    Division._log('[Division] ── 파싱 결과 디버그 ──');
    Division._log('[Division] 파싱된 키:', Object.keys(analyzed));
    Division._log('[Division] unused_components 수:', analyzed.unused_components ? analyzed.unused_components.length : '키 없음');
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      Division._log('[Division] 첫 번째 구성 샘플:', JSON.stringify(analyzed.unused_components[0]).substring(0, 500));
    } else {
      Division._log('[Division] ⚠️ unused_components가 비어 있음! 전체 파싱 결과:', JSON.stringify(analyzed).substring(0, 2000));
    }
    if(analyzed.themes) Division._log('[Division] themes 수:', analyzed.themes.length);

    // unused_components 저장 (enum 정제)
    var VALID_LIM = ['structural','material','shape','arrangement','functional'];
    var VALID_RISK = ['safe','caution','danger'];
    var sEnum = Division._sanitizeEnum;

    // T8: 코드 레벨 교차 검증 자동 실행 — LLM 결과를 기존 청구항·명세서와 대조
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      var crossVerifySpec = p.spec_full_text || specText || '';
      analyzed.unused_components = Division.validateUnusedComponents(analyzed.unused_components, claims, crossVerifySpec);
      Division._log('[Division] T8 교차검증 완료:', analyzed.unused_components.length, '건');
    }

    await sb.from('division_unused_components').delete().eq('project_id',p.id);
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      var compRows = analyzed.unused_components.map(function(uc){
        // risk_flags: 배열이 아니면 빈 배열로
        var flags = uc.risk_flags;
        if(!Array.isArray(flags)) flags = flags ? [String(flags)] : [];
        var row = {
          project_id: p.id,
          paragraph_number: String(uc.paragraph_number||'0000').substring(0,20),
          content: String(uc.content||'').substring(0,50000),
          related_element: String(uc.related_element||'').substring(0,200),
          limitation_type: sEnum(uc.limitation_type, VALID_LIM, 'functional'),
          risk_level: sEnum(uc.risk_level, VALID_RISK, 'safe'),
          risk_flags: flags, // JSONB — 배열 직접 전달 (stringify 금지)
          insertion_point: String(uc.insertion_point||'').substring(0,5000),
          suggestion: String(uc.suggestion||'').substring(0,5000),
          user_selection: 'pending'
        };
        // T4/T8 메타데이터는 메모리에만 보관 (UI 렌더링용)
        row._meta = {
          spec_source_text: String(uc.spec_source_text||'').substring(0,5000),
          overlap_warning: !!uc.overlap_warning,
          overlap_detail: String(uc.overlap_detail||'').substring(0,500),
          registration_strategy: String(uc.registration_strategy||'').substring(0,2000)
        };
        return row;
      });
      // _meta → DB component_data 저장 시도, 실패 시 메모리 폴백
      var metaMap = {};
      compRows.forEach(function(r){ metaMap[r.paragraph_number + ':' + (r.content||'').substring(0,50)] = r._meta; });

      // 1차: component_data 포함 INSERT 시도
      var dbRows = compRows.map(function(r){
        var copy = {}; Object.keys(r).forEach(function(k){ if(k !== '_meta') copy[k] = r[k]; });
        copy.component_data = r._meta || {};
        return copy;
      });
      var {error:compErr} = await sb.from('division_unused_components').insert(dbRows);
      if(compErr && compErr.message && compErr.message.indexOf('component_data') >= 0){
        // component_data 컬럼 미존재 → 제거 후 재시도
        console.warn('[Division] component_data 컬럼 없음, 제거 후 재시도');
        var fallbackRows = dbRows.map(function(r){ var c={}; Object.keys(r).forEach(function(k){if(k!=='component_data')c[k]=r[k];}); return c; });
        var {error:compErr2} = await sb.from('division_unused_components').insert(fallbackRows);
        if(compErr2){
          console.error('[Division] 미활용 구성 저장 실패:', compErr2.message||compErr2.details);
          var saved=0;
          for(var ci=0;ci<fallbackRows.length;ci++){
            var {error:re}=await sb.from('division_unused_components').insert(fallbackRows[ci]);
            if(re) console.warn('[Division] 구성 행 '+ci+' 실패:', re.message);
            else saved++;
          }
          if(saved>0) Division._log('[Division] 미활용 구성 '+saved+'/'+fallbackRows.length+'건 저장');
        }
      } else if(compErr){
        console.error('[Division] 미활용 구성 저장 실패:', compErr.message||compErr.details);
        var saved=0;
        for(var ci=0;ci<dbRows.length;ci++){
          var {error:re}=await sb.from('division_unused_components').insert(dbRows[ci]);
          if(re) console.warn('[Division] 구성 행 '+ci+' 실패:', re.message);
          else saved++;
        }
        if(saved>0) Division._log('[Division] 미활용 구성 '+saved+'/'+dbRows.length+'건 저장');
      }
      // 메모리에도 보관 (UI 렌더링 폴백)
      Division.state._componentMeta = metaMap;
    }

    // 프로젝트 상태 + analysis_meta 저장
    var projUpdate = { status:'analyzed', updated_at:new Date().toISOString() };
    // analysis_meta는 컬럼이 없을 수 있으므로 별도 시도
    var metaData = analyzed.themes ? {themes:analyzed.themes} : analyzed.original_category ? {original_category:analyzed.original_category, target_category:analyzed.target_category} : null;

    var {error:projErr} = await sb.from('division_projects').update(projUpdate).eq('id',p.id);
    if(projErr){ console.error('[Division] 프로젝트 상태 업데이트 실패:', projErr.message); }

    if(metaData){
      var {error:metaErr} = await sb.from('division_projects').update({analysis_meta:metaData}).eq('id',p.id);
      if(metaErr){
        console.warn('[Division] analysis_meta 저장 실패 (컬럼 미존재?):', metaErr.message);
        // 메모리에는 유지
      }
      p.analysis_meta = metaData;
    }
    p.status = 'analyzed';
    App.clearProgress('divisionAnalyzeProgress');
    var toastMsg = p.division_type==='strategic' ? '분석 완료! 테마를 선택해 주세요.' : p.division_type==='category_change' ? '분석 완료! 변환 구성을 확인해 주세요.' : '분석 완료! 부가 구성을 선택해 주세요.';
    showToast(toastMsg);
    Division.state.currentStepKey = 'analyze'; // 분석 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAnalyzeProgress'); showToast('분석 실패: '+e.message,'error'); }
};

// ═══ T7: 코드 레벨 교차 검증 — LCS 유사도 + 키워드 기반 ═══
Division._lcsTokens = function(a, b){
  // LCS (Longest Common Subsequence) of token arrays
  var m = a.length, n = b.length;
  if(m === 0 || n === 0) return [];
  // 메모리 최적화: 2행만 유지
  var prev = new Array(n+1).fill(0), curr = new Array(n+1).fill(0);
  for(var i = 1; i <= m; i++){
    for(var j = 1; j <= n; j++){
      if(a[i-1] === b[j-1]) curr[j] = prev[j-1] + 1;
      else curr[j] = Math.max(prev[j], curr[j-1]);
    }
    var tmp = prev; prev = curr; curr = tmp;
    curr.fill(0);
  }
  // backtrack 생략 — 길이만 반환
  return { length: prev[n] };
};

Division._lcsRatio = function(a, b){
  if(!a || !b) return 0;
  var tokA = a.replace(/[^가-힣a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
  var tokB = b.replace(/[^가-힣a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
  if(!tokA.length || !tokB.length) return 0;
  var lcsLen = Division._lcsTokens(tokA, tokB).length;
  return lcsLen / Math.max(tokA.length, tokB.length);
};

/**
 * 명세서 전문 로드 유틸리티 — 메모리 → DB → PDF → 단락 폴백
 * @param {object} project - 현재 프로젝트 객체 (spec_full_text 캐시용)
 * @param {Array} [fallbackParagraphs] - 단락 배열 (이미 로드된 경우)
 * @returns {string} specText
 */
Division._loadSpecText = async function(project, fallbackParagraphs){
  var specText = project.spec_full_text || '';
  // 1) DB에서 spec_full_text 조회
  if(!specText || specText.length < 500){
    try {
      var {data:projSpec} = await sb.from('division_projects').select('spec_full_text').eq('id', project.id).single();
      specText = (projSpec && projSpec.spec_full_text) || '';
      if(specText) project.spec_full_text = specText;
    } catch(e){ /* spec_full_text 컬럼 미존재 무시 */ }
  }
  // 2) PDF 재추출 폴백
  if(!specText || specText.length < 500){
    var appFile = (Division.state.files || []).find(function(f){ return f.file_type === 'application'; });
    if(appFile){
      try {
        var {data:blob, error:dlErr} = await sb.storage.from('division-files').download(appFile.storage_path);
        if(!dlErr && blob){
          var buf = await blob.arrayBuffer();
          specText = await App.extractPdfText(buf);
        }
      } catch(e){ /* PDF 추출 실패 무시 */ }
    }
  }
  // 3) DB 단락 폴백
  if(!specText || specText.length < 500){
    var paragraphs = fallbackParagraphs;
    if(!paragraphs || !paragraphs.length){
      try {
        var {data:paras} = await sb.from('division_spec_paragraphs').select('*').eq('project_id', project.id);
        paragraphs = paras || [];
      } catch(e){ paragraphs = []; }
    }
    specText = paragraphs.map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
  }
  return specText;
};

/**
 * T7: 분석 결과 교차 검증 — LLM 출력의 unused_components를 기존 청구항과 대조
 * @param {Array} components - LLM이 추출한 unused_components
 * @param {Array} allClaims - 원출원 전체 청구항
 * @param {string} specFullText - 명세서 전문
 * @returns {Array} 검증된 components (overlap_warning, risk_level 보정 적용)
 */
Division.validateUnusedComponents = function(components, allClaims, specFullText){
  if(!components || !components.length) return components;
  var stopwords = Division.STOPWORDS;

  components.forEach(function(comp){
    // [검증 1] 기존 청구항과 유사도 검사 → overlap_warning
    var maxSim = 0, overlapClaim = null;
    allClaims.forEach(function(c){
      var cText = c.amended_text || c.original_text || '';
      var sim = Division._lcsRatio(comp.content || '', cText);
      if(sim > maxSim){ maxSim = sim; overlapClaim = c.claim_number; }
    });
    if(maxSim > Division.THRESHOLDS.OVERLAP_WARNING){
      comp.overlap_warning = true;
      comp.overlap_detail = '기존 청구항 ' + overlapClaim + '에 ' + Math.round(maxSim*100) + '% 유사 구성';
      if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
      if(comp.risk_flags.indexOf('이중특허 위험') < 0) comp.risk_flags.push('이중특허 위험');
    } else {
      if(comp.overlap_warning === undefined) comp.overlap_warning = false;
    }

    // [검증 2] 명세서 키워드 존재 검사 → 신규사항 위험 감지 (조사/어미 무시 + 중복 제거)
    if(specFullText && comp.content){
      var keywords = (comp.content.match(/[가-힣]{2,}/g) || []);
      var meaningfulSet = {};
      keywords.forEach(function(kw){
        if(stopwords.indexOf(kw) >= 0 || kw.length < 3) return;
        var stem = Division._stripKoreanSuffix(kw);
        if(stem.length < 2 || stopwords.indexOf(stem) >= 0) return;
        meaningfulSet[stem] = true;
      });
      var meaningful = Object.keys(meaningfulSet);
      var missing = meaningful.filter(function(kw){ return !Division._isKeywordInSpec(kw, specFullText); });
      if(missing.length > Division.THRESHOLDS.COMPONENT_MISSING_KW){
        // 명세서 미발견 키워드 다수 → risk_level 상향
        if(missing.length > Division.THRESHOLDS.COMPONENT_DANGER_KW){
          comp.risk_level = 'danger';
        } else if(comp.risk_level === 'safe'){
          comp.risk_level = 'caution';
        }
        if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
        if(comp.risk_flags.indexOf('신규사항 위험') < 0) comp.risk_flags.push('신규사항 위험');
      }
    }

    // [검증 3] spec_source_text 존재 확인 — 없으면 risk 상향
    if(!comp.spec_source_text || comp.spec_source_text.length < 5){
      if(comp.risk_level === 'safe') comp.risk_level = 'caution';
      if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
      if(comp.risk_flags.indexOf('명세서 원문 인용 없음') < 0) comp.risk_flags.push('명세서 원문 인용 없음');
    }
  });

  return components;
};

Division._buildAnalyzePrompt = function(basisClaim, specText, excludedText, allClaims){
  var basisText = basisClaim ? (basisClaim.amended_text||basisClaim.original_text||'') : '(기초 청구항 없음)';
  var allClaimsText = allClaims.map(function(c){ return '제'+c.claim_number+'항: '+((c.amended_text||c.original_text||'').substring(0,500)); }).join('\n');
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';

  // T3: 공통 원칙 주입 + 공통 입력 데이터 블록
  var principles = Division.DIVISION_PRINCIPLES;
  var inputBlock = '\n\n[등록 청구항 (basis)]\n'+basisText+'\n\n[전체 청구항]\n'+allClaimsText+'\n\n[명세서 전문]\n'+specText.substring(0,40000);

  // T3: 공통 출력 스키마 — spec_source_text, overlap_warning 필드 추가
  var commonOutputFields = '"paragraph_number":"0098","content":"구성 내용","related_element":"원 구성요소명",' +
    '"limitation_type":"structural|material|shape|arrangement|functional",' +
    '"risk_level":"safe|caution|danger","risk_flags":[],' +
    '"insertion_point":"삽입 위치 설명","suggestion":"예상 기재 형태",' +
    '"spec_source_text":"명세서 원문 인용 (해당 단락에서 직접 발췌한 문장)",' +
    '"overlap_warning":false,"overlap_detail":"","registration_strategy":"바로 등록 전략 근거"';

  // T5: 카테고리변경형
  if(divType === 'category_change'){
    return principles +
      '\n\n이것은 "카테고리 변경형" 분할출원이다.\n' +
      '목적: 등록 청구항의 기술적 내용(A+B+C)을 보존하면서, 방법↔장치 카테고리를\n' +
      '전환하고, 명세서 기재 사항 내에서 변환에 필요한 구성을 추출한다.\n' +
      '방향: 변환 시 명세서에 없는 구성요소명(~부, ~수단 등)을 임의 생성하지 마라.\n' +
      '      명세서에 명시적으로 기재된 구성요소명만 사용하라.\n' +
      inputBlock +
      '\n\n분석 규칙:\n' +
      '1. 등록 청구항이 "방법" 청구항인지 "장치" 청구항인지 판별\n' +
      '2. 방법 청구항이면 → 장치 청구항으로 변환할 구성요소 매핑 도출\n' +
      '   - 각 방법 단계를 수행하는 구성요소를 명세서에서 찾아라\n' +
      '   - ★ 명세서에 "~부","~모듈","~수단"이 없으면 임의로 생성하지 마라\n' +
      '   - 명세서에서 해당 구성요소의 구조적 뒷받침 단락 매핑\n' +
      '3. 장치 청구항이면 → 방법 청구항으로 변환할 단계 매핑 도출\n' +
      '   - 각 구성요소가 수행하는 동작/기능을 "~하는 단계" 형태로 변환\n' +
      '4. 변환 시 명세서 뒷받침 존재 여부 확인\n' +
      '5. 리스크 평가: 변환이 자연스러운지, 추상적 표현이 발생하는지\n' +
      '6. ★★★ 각 구성에 spec_source_text(명세서 원문 직접 인용)를 반드시 포함하라\n' +
      '7. ★★★ 변환된 구성요소명이 명세서에 실제 기재되어 있는지 확인하라\n' +
      '\n출력 JSON:\n{"original_category":"method|apparatus","target_category":"apparatus|method",' +
      '"unused_components":[{' + commonOutputFields + '}]}\n\nJSON만 출력하라.';
  }

  // T6: 전략형
  if(divType === 'strategic'){
    return principles +
      '\n\n이것은 "전략형" 분할출원이다.\n' +
      '목적: 등록 청구항과 다른 관점의 새로운 독립항을 명세서 범위 내에서 작성한다.\n' +
      '방향: 신규사항 추가 위험이 가장 높은 유형이다.\n' +
      '      각 테마의 핵심 구성은 반드시 명세서 단락번호와 1:1 대응이 있어야 한다.\n' +
      '      명세서에 단 한 문장도 근거가 없는 테마는 제안하지 마라.\n' +
      '      출력의 모든 구성에 spec_source_text(명세서 원문 인용)를 반드시 포함하라.\n' +
      inputBlock +
      '\n\n[제외 대상 청구항]\n'+(excludedText||'(없음)') +
      '\n\n분석 규칙:\n' +
      '1. 명세서에서 기존 청구항과 다른 관점/테마의 발명 개념을 식별\n' +
      '2. 각 테마에 대해:\n' +
      '   - 독립항을 구성할 수 있는 핵심 구성요소 나열\n' +
      '   - 명세서 뒷받침 단락 매핑 (★ 1개 이상 필수)\n' +
      '   - 기존 등록 청구항과의 차별점\n' +
      '   - 등록 가능성 평가 (safe/caution/danger)\n' +
      '3. ★★★ spec_paragraphs가 빈 테마는 절대 제안하지 마라\n' +
      '4. 각 테마의 구성요소가 명세서에 충분히 뒷받침되는지 확인\n' +
      '\n출력 JSON:\n{"themes":[{"theme_id":"T1","theme_name":"테마명","description":"테마 설명",' +
      '"key_elements":["구성요소1","구성요소2"],"spec_paragraphs":["0098","0102"],' +
      '"differentiation":"기존 청구항과의 차별점","risk_level":"safe|caution|danger","risk_flags":[]}],' +
      '"unused_components":[{' + commonOutputFields + '}]}\n\nJSON만 출력하라.';
  }

  // T4: 병합형 (기본) — 기존 등록 청구항을 구체화/한정/부가하는 구성만 탐색
  return principles +
    '\n\n이것은 "병합형" 분할출원이다.\n' +
    '목적: 등록 청구항(A+B+C)을 그대로 유지하면서, 명세서에만 있고 기존 어떤\n' +
    '청구항에도 없었던 구성(D)을 추가하여 A+B+C+D로 출원한다.\n' +
    '방향: 구체화·한정·부가만 허용. 카테고리 변경 제안 절대 금지.\n' +
    inputBlock +
    '\n\n[제외 대상 (삭제된 청구항)]\n'+(excludedText||'(없음)') +
    '\n\n추출 규칙:\n' +
    '1. 등록 청구항의 각 구성요소에 대해, 명세서에서 해당 구성요소를 더 구체적으로 설명하는 내용을 찾아라\n' +
    '   예: "장치 하우징" → 명세서에 "원통 형상의 장치 하우징"이라 기재 → content:"원통 형상의", insertion_point:"장치 하우징 앞에 형용구 삽입"\n' +
    '2. 명세서에 기재되어 있지만 어떤 청구항에도 포함되지 않은 구조적 구성을 추출\n' +
    '3. 기존 종속항(미지적 항)의 내용 중 독립항에 병합 가능한 한정 사항\n' +
    '4. limitation_type 분류:\n' +
    '   - structural: 형상·구조 한정 (가장 안전, 우선 추출)\n' +
    '   - material: 재질·소재 한정\n' +
    '   - shape: 형태·치수 한정\n' +
    '   - arrangement: 배치·위치 관계 한정\n' +
    '   - functional: 기능·동작 한정 (기능적 기재 위험 주의)\n' +
    '5. risk_level 판단:\n' +
    '   - safe: 명세서에 명확히 기재, 구조적 한정, 추상적 표현 없음\n' +
    '   - caution: 명세서 뒷받침이 간접적, 또는 기능적 표현 포함\n' +
    '   - danger: 명세서에 뒷받침 부족, 추상적 표현, 신규사항 추가 위험\n' +
    '6. risk_flags: ["추상적 표현","기능적 기재","뒷받침 부족","신규사항"] 등 해당 항목\n' +
    '7. ★ 카테고리 변경 제안 금지: "방법→장치", "장치→방법" 등의 전환 제안을 하지 마라\n' +
    '8. ★ 원 청구항의 구성요소 명칭을 그대로 사용하여 insertion_point를 기재\n' +
    '9. ★★★ 각 구성에 spec_source_text(명세서 해당 단락 원문 직접 인용)를 반드시 포함하라\n' +
    '10. ★★★ 기존 청구항과 70% 이상 유사한 구성은 overlap_warning:true로 표시하라\n' +
    '\n출력 JSON:\n{"unused_components":[{' + commonOutputFields + '}]}\n\n★★★ JSON만 출력. ★★★';
};

// ═══════════════════════════════════════════
// 11. Checkpoint 2 화면: 구성 선택
// ═══════════════════════════════════════════
Division.renderAnalyze = function(left, right, p){
  var unused = Division.state.unusedComponents;
  var claims = Division.state.claims;
  var divType = p.division_type;
  var groups = { safe:[], caution:[], danger:[] };
  unused.forEach(function(uc){ (groups[uc.risk_level]||groups.safe).push(uc); });

  var h = '';

  // === 공통: 원출원 등록 청구항 + 구체화 포인트 ===
  var basisClaim = claims.find(function(c){ return c.division_role==='basis'; }) || claims.find(function(c){ return c.claim_type==='independent'; });
  if(basisClaim){
    var basisText = basisClaim.amended_text || basisClaim.original_text || '';
    var sectionTitle = divType==='merge' ? '원출원 등록 청구항 → 구체화·한정·부가 포인트'
      : divType==='category_change' ? '원출원 등록 청구항 → 카테고리 변환 대상'
      : '원출원 등록 청구항 → 전략 분할 기준';
    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:10px"><span class="ico" data-icon="doc"></span> ' + sectionTitle + '</div>';

    // 구체화 포인트 매핑: 미활용 구성의 insertion_point → 원 청구항의 어떤 구성요소에 삽입되는지
    var insertionMap = [];
    unused.forEach(function(uc){
      if(!uc.insertion_point) return;
      var isSelected = uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe');
      insertionMap.push({ target:uc.related_element, content:uc.content, paragraph:'【'+uc.paragraph_number+'】', type:uc.limitation_type, selected:isSelected, riskLevel:uc.risk_level });
    });

    // 청구항 텍스트에서 구성요소명을 하이라이트 (플레이스홀더 치환으로 이중 치환 방지)
    var annotatedHtml = escapeHtml(Division._formatClaimText(basisText));
    var placeholders = [];
    insertionMap.forEach(function(im, imIdx){
      if(!im.target) return;
      var escaped = escapeHtml(im.target);
      var color = im.selected ? (im.riskLevel==='safe'?'#059669':'#d97706') : '#9ca3af';
      var marker = '<span style="background:' + (im.selected?'#F2FFF6':'var(--dt-g50)') + ';border-bottom:2px solid ' + color + ';padding:0 2px" title="' + escapeHtml(im.content) + '">' + escaped + ' <sup style="font-size:9px;color:' + color + '">+</sup></span>';
      var placeholder = '\x00PH' + imIdx + '\x00';
      placeholders.push({ placeholder:placeholder, marker:marker });
      // 첫 번째 매치만 치환하여 중복 방지
      annotatedHtml = annotatedHtml.replace(new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), placeholder);
    });
    // 플레이스홀더를 실제 마커로 복원
    placeholders.forEach(function(ph){
      annotatedHtml = annotatedHtml.replace(ph.placeholder, ph.marker);
    });

    h += '<div style="font-size:13px;line-height:2;white-space:pre-wrap;max-height:200px;overflow-y:auto;padding:10px;background:#fafbfc;border:1px solid var(--color-border);border-radius:var(--radius-sm)">' + annotatedHtml + '</div>';

    // 삽입 포인트 범례 (접기/펼치기 + 스크롤 제한)
    if(insertionMap.length > 0){
      var pointTitle = divType==='merge' ? '구체화·한정·부가 포인트' : divType==='category_change' ? '변환 대상 구성요소' : '활용 구성 포인트';
      var pointSelectedCount = insertionMap.filter(function(im){return im.selected;}).length;
      h += '<details style="margin-top:10px;font-size:11px;color:var(--color-text-tertiary)">';
      h += '<summary style="font-weight:600;cursor:pointer;padding:6px 0;user-select:none"><span class="ico" data-icon="flag"></span> ' + pointTitle + ' (' + pointSelectedCount + '/' + insertionMap.length + '건 선택) ▾</summary>';
      h += '<div style="max-height:250px;overflow-y:auto;padding:4px 0">';
      insertionMap.forEach(function(im){
        var icon = im.selected ? (im.riskLevel==='safe'?'🟢':'🟡') : '⚪';
        var typeLabel = {structural:'구조한정',material:'재질한정',shape:'형상한정',arrangement:'배치한정',functional:'기능한정'}[im.type] || im.type;
        h += '<div style="padding:3px 0">' + icon + ' <strong>' + escapeHtml(im.target) + '</strong>';
        h += ' <span style="color:var(--color-primary);font-size:10px">['+typeLabel+']</span>';
        h += ' ← ' + escapeHtml(im.content.substring(0,80)) + (im.content.length>80?'...':'');
        h += ' <span style="color:var(--color-text-disabled)">' + im.paragraph + '</span></div>';
      });
      h += '</div></details>';
    }
    h += '</div>';
  }

  // === 카테고리 변경형: 변환 방향 표시 ===
  if(divType === 'category_change'){
    var meta = p.analysis_meta || {};
    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="refresh"></span> 카테고리 변환</div>';
    h += '<div class="division-info-box" style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;text-align:center">';
    h += '<span style="color:var(--color-primary)">' + (meta.original_category==='method'?'방법 청구항':'장치 청구항') + '</span>';
    h += ' <span class="ico" data-icon="arrow-right" data-size="18"></span> ';
    h += '<span style="color:var(--color-success)">' + (meta.target_category==='apparatus'?'장치 청구항':'방법 청구항') + '</span>';
    h += '</div></div></div>';
  }

  // === 전략적 분할: 테마 목록 + 등록 청구항 대비 diff ===
  if(divType === 'strategic'){
    var themes = (p.analysis_meta && p.analysis_meta.themes) || [];
    // basisClaim, basisText는 상위 스코프에서 이미 선언됨 — 재사용
    var strategicBasisText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';

    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="flag"></span> 독립항 테마 후보</div>';
    if(!themes.length){ h += '<div style="font-size:13px;color:var(--color-text-tertiary);padding:8px">테마 후보가 없습니다.</div>'; }
    else { themes.forEach(function(t, tidx){
      var riskInfo = Division.RISK_LABELS[t.risk_level] || Division.RISK_LABELS.safe;
      h += '<div class="division-theme-card ' + riskInfo.css + '">';
      h += '<label class="checkbox-label" style="flex:1;align-items:flex-start"><input type="checkbox" checked data-theme-id="' + t.theme_id + '" style="margin-top:4px" /><div style="flex:1">';

      // 제목
      h += '<div style="font-weight:700;font-size:14px;margin-bottom:6px">' + riskInfo.icon + ' ' + escapeHtml(t.theme_name) + '</div>';

      // 설명 (줄바꿈 포함)
      h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:8px">' + escapeHtml(t.description||'').replace(/\n/g,'<br>') + '</div>';

      // 핵심 구성요소 태그
      if(t.key_elements && t.key_elements.length){
        h += '<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">';
        t.key_elements.forEach(function(el){ h += '<span class="division-element-tag">' + escapeHtml(el) + '</span>'; });
        h += '</div>';
      }

      // 예상 청구항 미리보기 (스크롤 가능)
      h += '<div class="division-claim-preview-scroll">';
      h += '<div style="font-size:11px;font-weight:600;color:var(--color-primary);margin-bottom:4px"><span class="ico" data-icon="edit"></span> 예상 독립항 (청구항 ' + (tidx+1) + ')</div>';
      if(t.key_elements && t.key_elements.length){
        var previewText = t.key_elements.map(function(el, i){
          return (i === 0 ? '' : '상기 ') + escapeHtml(el) + ';';
        }).join('\n');
        previewText += '\n을 포함하는 ' + escapeHtml(t.theme_name) + '.';
        h += '<div style="white-space:pre-wrap;font-size:12px;line-height:1.8">' + previewText + '</div>';
      } else {
        h += '<div style="font-size:12px;color:var(--color-text-tertiary)">(핵심 구성 기반 독립항이 조립됩니다)</div>';
      }
      h += '</div>';

      // 등록 청구항과 비교 diff (토글)
      if(strategicBasisText && t.key_elements && t.key_elements.length){
        var proposedText = t.key_elements.map(function(el,elIdx){ return (elIdx===0?'':'상기 ') + el + ';'; }).join(' ') + ' 을 포함하는 ' + t.theme_name + '.';
        var diffResult = Division._wordDiff(strategicBasisText, proposedText);

        h += '<details class="division-diff-details">';
        h += '<summary style="font-size:11px;color:var(--color-primary);cursor:pointer;margin-top:6px;font-weight:600">';
        h += '<span class="ico" data-icon="scales"></span> 등록 청구항과 비교 (추가 ' + diffResult.addedCount + ' / 삭제 ' + diffResult.removedCount + ')';
        h += '</summary>';
        h += '<div class="division-diff-box">';
        h += '<div style="font-size:10px;margin-bottom:6px;color:var(--color-text-tertiary)"><span class="division-diff-added" style="padding:0 4px">추가</span> <span class="division-diff-removed" style="padding:0 4px">삭제</span> 동일</div>';
        h += '<div style="font-size:12px;line-height:1.8;white-space:pre-wrap">' + diffResult.html + '</div>';
        h += '</div></details>';
      }

      // 근거/차별점
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--color-divider)">';
      h += '<div style="font-size:11px;color:var(--color-text-tertiary)">근거: ' + (t.spec_paragraphs||[]).map(function(s){return '【'+s+'】';}).join(' ') + '</div>';
      if(t.differentiation) h += '<div style="font-size:11px;color:var(--color-primary);margin-top:2px"><span class="ico" data-icon="lightbulb"></span> ' + escapeHtml(t.differentiation) + '</div>';
      var tFlags = Division._toArray(t.risk_flags);
      if(tFlags.length) h += '<div style="font-size:11px;color:var(--color-warning);margin-top:2px"><span class="ico" data-icon="warning"></span> ' + escapeHtml(tFlags.join(', ')) + '</div>';
      h += '</div>';

      h += '</div></label></div>';
    }); }
    h += '</div>';
  }

  // ═══ 공통: 명칭 미리보기 + 구성 목록 (모든 유형) ═══
  var compTitle = divType==='category_change' ? '변환 구성 후보' : divType==='strategic' ? '활용 가능 구성' : '구체화·한정·부가 구성 후보';
  var totalComps = unused.length;
  var selectedCount0 = unused.filter(function(uc){ return uc.user_selection==='selected'; }).length;

  // 1. 명칭 미리보기 (선택된 구성 키워드 기반 자동 생성)
  h += '<div class="card" style="padding:14px;margin-top:12px" id="divisionTitlePreview">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:8px"><span class="ico" data-icon="tag"></span> 명칭 미리보기</div>';
  h += '<div id="divisionTitlePreviewText" style="font-size:13px;line-height:1.6;padding:8px 10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);color:var(--color-text-tertiary)">구성을 선택하면 명칭이 자동 생성됩니다</div>';
  h += '</div>';

  // 2. 선택 요약 바 (sticky)
  if(totalComps > 0){
    h += '<div class="division-comp-toolbar">';
    h += '<span style="font-size:13px;font-weight:600"><span id="divisionSelectedCount2">'+selectedCount0+'</span>/'+totalComps+'건 선택</span>';
    h += '<span style="margin-left:auto;display:flex;gap:6px">';
    h += '<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="Division.bulkSelect(\'all\')">전체 선택</button>';
    h += '<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="Division.bulkSelect(\'none\')">전체 해제</button>';
    h += '<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--color-success)" onclick="Division.bulkSelect(\'safe\')"><span class="ico" data-icon="check-circle"></span> safe만</button>';
    h += '<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="Division.toggleAllCards(true)">펼치기</button>';
    h += '<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="Division.toggleAllCards(false)">접기</button>';
    h += '</span></div>';
  }

  // 3. 구성 카드 목록 (스크롤 영역, risk별 그룹핑: safe→caution→danger)
  h += '<div class="division-comp-scroll">';
  ['safe','caution','danger'].forEach(function(level){
    var items = groups[level]; var info = Division.RISK_LABELS[level]; if(!items.length) return;
    h += '<div style="padding:8px 0 4px;font-size:12px;font-weight:700;color:var(--color-text-secondary)">'+info.icon+' '+info.label+' ('+items.length+'건)</div>';
    items.forEach(function(uc){
      var isChecked = uc.user_selection==='selected';
      var cd = uc.component_data || {};
      if(!cd.spec_source_text && Division.state._componentMeta){
        var metaKey = uc.paragraph_number + ':' + (uc.content||'').substring(0,50);
        cd = Division.state._componentMeta[metaKey] || cd;
      }
      // 카드: 기본 접힘, danger/overlap만 기본 펼침
      var hasDanger = level==='danger' || cd.overlap_warning;
      h += '<div class="division-component-card '+info.css+(hasDanger?' expanded':'')+'" onclick="this.classList.toggle(\'expanded\')">';
      // 헤더 (항상 표시)
      h += '<div class="division-component-card-header">';
      h += '<input type="checkbox" class="division-comp-checkbox" '+(isChecked?'checked':'')+' data-component-id="'+uc.id+'" data-risk-level="'+level+'" data-related="'+escapeHtml(uc.related_element||'')+'" onclick="event.stopPropagation()" onchange="Division.toggleComponent(this)" />';
      h += '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
      h += '<span style="font-weight:600;font-size:13px">'+escapeHtml(uc.content.substring(0,60))+(uc.content.length>60?'...':'')+'</span>';
      var limLabels = {structural:'구조',material:'재질',shape:'형상',arrangement:'배치',functional:'기능'};
      h += '<span class="division-element-tag" style="font-size:10px">'+(limLabels[uc.limitation_type]||uc.limitation_type)+'</span>';
      if(cd.overlap_warning) h += '<span style="font-size:10px;color:var(--color-error);font-weight:600"><span class="status-dot negative"></span> overlap</span>';
      h += '</div>';
      h += '<span style="font-size:18px;color:var(--color-text-disabled);transition:transform 0.2s" class="division-card-chevron">▾</span>';
      h += '</div>';
      // 상세 (접힌 상태에서 숨김)
      h += '<div class="division-card-body">';
      h += '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">';
      h += '<span class="division-element-tag">【'+uc.paragraph_number+'】</span>';
      h += '<span class="division-element-tag"><span class="ico" data-icon="arrow-right"></span> '+escapeHtml(uc.related_element)+'</span>';
      h += '</div>';
      if(cd.spec_source_text){
        h += '<div class="division-source-citation">';
        h += '<span class="ico" data-icon="doc"></span> 근거: 【'+uc.paragraph_number+'】';
        h += '<div class="citation-text">"'+escapeHtml(cd.spec_source_text.substring(0,200))+(cd.spec_source_text.length>200?'...':'')+'"</div>';
        h += '</div>';
      }
      if(uc.insertion_point){
        h += '<div style="margin-top:6px;padding:6px 10px;background:#f0f7ff;border-radius:4px;font-size:11px;color:var(--color-primary)"><span class="ico" data-icon="flag"></span> 삽입: '+escapeHtml(uc.insertion_point)+'</div>';
      }
      if(cd.overlap_warning){
        h += '<div class="division-overlap-warning"><span class="status-dot negative"></span> '+escapeHtml(cd.overlap_detail||'기존 청구항과 유사')+'</div>';
      } else if(cd.spec_source_text){
        h += '<div class="division-no-overlap"><span class="ico" data-icon="check-circle"></span> 기존 청구항 미포함</div>';
      }
      if(cd.registration_strategy) h += '<div class="division-reg-strategy"><span class="ico" data-icon="lightbulb"></span> '+escapeHtml(cd.registration_strategy.substring(0,150))+'</div>';
      var ucFlags = Division._toArray(uc.risk_flags);
      if(ucFlags.length) h += '<div style="font-size:11px;color:var(--color-warning);margin-top:4px"><span class="ico" data-icon="warning"></span> '+escapeHtml(ucFlags.join(', '))+'</div>';
      if(uc.suggestion) h += '<div style="font-size:11px;color:var(--color-success);margin-top:2px"><span class="ico" data-icon="lightbulb"></span> '+escapeHtml(uc.suggestion)+'</div>';
      h += '</div>'; // card-body
      h += '</div>'; // card
    });
  });
  h += '</div>'; // scroll
  left.innerHTML = h;
  // 명칭 미리보기 초기 갱신
  Division._updateTitlePreview();

  // 오른쪽: 유형 전환 + 요약
  var selectedCount = unused.filter(function(uc){ return uc.user_selection==='selected'; }).length;
  var rh = Division._renderTypeSwitch(p.division_type);
  rh += '<div class="card" style="padding:20px"><div style="font-size:16px;font-weight:700;margin-bottom:16px"><span class="ico" data-icon="clipboard"></span> 구성 요약</div>';
  rh += '<div class="division-summary-grid">';
  if(divType === 'strategic'){
    var summaryThemes = (p.analysis_meta && p.analysis_meta.themes) || [];
    rh += '<div class="division-summary-item"><div class="division-summary-num">'+summaryThemes.length+'</div><div class="division-summary-label">테마 후보</div></div>';
  }
  rh += '<div class="division-summary-item"><div class="division-summary-num" id="divisionSelectedCount">'+selectedCount+'</div><div class="division-summary-label">선택된 구성</div></div>';
  rh += '</div></div>';

  // 청구항 구성 설정
  rh += '<div class="card" style="padding:16px;margin-top:12px">';
  rh += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="settings"></span> 청구항 구성</div>';

  // 독립항 수
  rh += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  rh += '<span style="font-size:13px;font-weight:500;min-width:80px">독립항 수</span>';
  rh += '<div class="division-claim-count-group" id="divisionIndepCount">';
  [1,2,3].forEach(function(n){
    var active = (Division.state.indepCount||1) === n;
    rh += '<button class="division-count-btn' + (active?' active':'') + '" onclick="Division.setIndepCount('+n+')">' + n + '</button>';
  });
  rh += '</div>';
  rh += '<span style="font-size:11px;color:var(--color-text-tertiary)">기본 1개</span>';
  rh += '</div>';

  // 종속항 수 (독립항당)
  rh += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  rh += '<span style="font-size:13px;font-weight:500;min-width:80px">종속항 수</span>';
  rh += '<div class="division-claim-count-group" id="divisionDepCount">';
  [0,2,4,6,'자동'].forEach(function(n){
    var val = n === '자동' ? -1 : n;
    var active = (Division.state.depCount === undefined ? -1 : Division.state.depCount) === val;
    rh += '<button class="division-count-btn' + (active?' active':'') + '" onclick="Division.setDepCount('+val+')">' + (n === '자동' ? '자동' : n+'개') + '</button>';
  });
  rh += '</div>';
  rh += '</div>';

  // 예상 청구항 구성 요약
  var ic = Division.state.indepCount || 1;
  var dc = Division.state.depCount === undefined ? -1 : Division.state.depCount;
  var totalEst = dc === -1 ? ic + '+ (AI 자동)' : (ic + ic*dc) + '항';
  rh += '<div style="padding:10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);font-size:12px;color:var(--color-text-secondary);text-align:center">';
  rh += '예상: 독립항 ' + ic + '개';
  if(dc === -1) rh += ' + 종속항 자동 구성';
  else if(dc > 0) rh += ' × 종속항 ' + dc + '개 = 총 ' + totalEst;
  else rh += ' (종속항 없음)';
  rh += '</div>';
  rh += '</div>';

  rh += '<div id="divisionAssembleProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.rerunAnalyze()" style="flex:1;padding:12px"><span class="ico" data-icon="refresh"></span> 재분석</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionAssemble" onclick="Division.runAssemble()" style="flex:1;padding:12px"><span class="ico" data-icon="settings"></span> 조립 실행</button></div>';
  right.innerHTML = rh;
};

Division.toggleComponent = async function(cb){
  var id=cb.dataset.componentId, val=cb.checked?'selected':'excluded';
  try { await sb.from('division_unused_components').update({user_selection:val}).eq('id',id);
    var c=Division.state.unusedComponents.find(function(x){return x.id===id;}); if(c) c.user_selection=val;
    Division._updateSelectedCount();
    Division._updateTitlePreview();
  } catch(e) { showToast('변경 실패','error'); }
};

// 선택 카운트 + 명칭 미리보기 실시간 갱신
Division._updateSelectedCount = function(){
  var checked = document.querySelectorAll('.division-comp-checkbox:checked').length;
  var el = document.getElementById('divisionSelectedCount');
  if(el) el.textContent = checked;
  var el2 = document.getElementById('divisionSelectedCount2');
  if(el2) el2.textContent = checked;
};

// 명칭 미리보기: 선택된 구성의 키워드 + 등록 청구항 카테고리 기반 자동 생성
Division._updateTitlePreview = function(){
  var el = document.getElementById('divisionTitlePreviewText');
  if(!el) return;
  var p = Division.state.current;

  // 선택된 체크박스에서 related_element 키워드 추출
  var keywords = [];
  var cbs = document.querySelectorAll('.division-comp-checkbox:checked');
  cbs.forEach(function(cb){
    var rel = (cb.dataset.related || '').trim();
    if(rel && keywords.indexOf(rel) < 0) keywords.push(rel);
  });

  // 원출원 명칭 (original_title_ko)
  var origTitle = (p && p.original_title_ko) || '';

  if(!origTitle){
    el.innerHTML = '<span style="color:var(--color-error)"><span class="ico" data-icon="warning" data-size="14"></span> 원출원 명칭을 추출할 수 없습니다. 파싱을 다시 실행해 주세요.</span>';
    Division.state.suggestedTitles = [];
    return;
  }

  if(keywords.length === 0){
    el.textContent = origTitle;
    el.style.color = 'var(--color-text-primary)';
    Division.state.suggestedTitles = [];
    return;
  }

  // D 키워드 조합 (최대 3개)
  var kws = keywords.slice(0, 3);
  var dPrefix = kws.join(' 및 ') + ' 기반의 ';
  var preview;

  if(origTitle){
    // 원출원 명칭 앞에 D 키워드 삽입 — 말미 형태 보존
    preview = dPrefix + origTitle;
  } else {
    // 원출원 명칭 없으면 등록 청구항 카테고리에서 말미 추론
    var basisClaim = (Division.state.claims || []).find(function(c){ return c.division_role==='basis'; }) ||
      (Division.state.claims || []).find(function(c){ return c.claim_type==='independent'; });
    var basisText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';
    var suffix = '장치';
    if(basisText.indexOf('방법') >= 0 && basisText.indexOf('단계') >= 0) suffix = '방법';
    else if(basisText.indexOf('시스템') >= 0) suffix = '시스템';
    else if(basisText.indexOf('서버') >= 0) suffix = '서버';
    preview = dPrefix + suffix;
  }

  el.textContent = preview;
  el.style.color = 'var(--color-text-primary)';

  // suggestedTitles에 저장
  Division.state.suggestedTitles = [{ ko: preview, en: '', reason: '구성 선택 기반: ' + kws.join(', ') }];
};

// 카드 전체 펼치기/접기
Division.toggleAllCards = function(expand){
  var cards = document.querySelectorAll('.division-component-card');
  cards.forEach(function(card){
    if(expand) card.classList.add('expanded');
    else card.classList.remove('expanded');
  });
};

// 일괄 선택: 'all' | 'none' | 'safe'
Division.bulkSelect = async function(mode){
  var checkboxes = document.querySelectorAll('.division-comp-checkbox');
  var updates = [];
  checkboxes.forEach(function(cb){
    var shouldCheck = mode==='all' || (mode==='safe' && cb.dataset.riskLevel==='safe');
    cb.checked = shouldCheck;
    var id = cb.dataset.componentId;
    var val = shouldCheck ? 'selected' : 'excluded';
    var c = Division.state.unusedComponents.find(function(x){return x.id===id;});
    if(c) c.user_selection = val;
    updates.push({ id:id, val:val });
  });
  Division._updateSelectedCount();
  Division._updateTitlePreview();
  // DB 일괄 반영 (순차)
  for(var i=0;i<updates.length;i++){
    try { await sb.from('division_unused_components').update({user_selection:updates[i].val}).eq('id',updates[i].id); }
    catch(e){ console.warn('[Division] 일괄 선택 DB 반영 실패:', updates[i].id); }
  }
  showToast(mode==='all'?'전체 선택됨':mode==='none'?'전체 해제됨':'safe 구성만 선택됨','info');
};

Division.rerunAnalyze = function(){ Division.runAnalyze(); };

// 청구항 개수 설정 + DB 영속화
Division.setIndepCount = async function(n){
  Division.state.indepCount = n;
  var p = Division.state.current;
  if(p){
    var meta = p.analysis_meta || {};
    meta.indep_count = n;
    await sb.from('division_projects').update({ analysis_meta: meta }).eq('id', p.id);
    p.analysis_meta = meta;
  }
  Division.renderStay();
};
Division.setDepCount = async function(n){
  Division.state.depCount = n;
  var p = Division.state.current;
  if(p){
    var meta = p.analysis_meta || {};
    meta.dep_count = n;
    await sb.from('division_projects').update({ analysis_meta: meta }).eq('id', p.id);
    p.analysis_meta = meta;
  }
  Division.renderStay();
};

// ═══════════════════════════════════════════
