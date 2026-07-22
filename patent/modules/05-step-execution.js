// ═══════════ STEP EXECUTION ═══════════
let globalProcessing = false;
function setGlobalProcessing(on){
  globalProcessing=on;
  // Disable/enable ALL generation buttons when any task is running
  const allBtns=['btnStep01','btnBatch25','btnStep06','btnStep10','btnStep14','btnStep15','btnStep07','btnStep08','btnStep09','btnStep11','btnStep12','btnStep13','btnStep20','btnApplyReview','btnBatchFinish','btnProvisionalGen','btnInsertBoilerplate'];
  allBtns.forEach(bid=>{const b=document.getElementById(bid);if(b){if(on){b.dataset.prevDisabled=b.disabled;b.disabled=true;b.style.opacity='0.5';}else{b.disabled=b.dataset.prevDisabled==='true';b.style.opacity='';delete b.dataset.prevDisabled;}}});
  // Also disable validation button and tab switches during processing
  document.querySelectorAll('.tab-item').forEach(t=>{if(on){t.style.pointerEvents='none';t.style.opacity='0.7';}else{t.style.pointerEvents='';t.style.opacity='';}});
}
function checkDependency(s){
  const inv=document.getElementById('projectInput').value.trim();
  // v5.6: 방법 청구항 비활성 시 관련 스텝 차단
  const methodSteps=['step_10','step_11','step_12','step_20'];
  if(!includeMethodClaims&&methodSteps.includes(s)){return '방법 청구항이 비활성화되어 있습니다';}
  // ★ [배치15B-A7] 필수 입력 가드 — 프롬프트가 명칭·청구항·상세설명을 "이미 확정된 입력"으로 참조하는 스텝은
  //   그 입력이 비면 실행 차단(LLM 대화형 메타 응답 저장=가짜 성공 방지, docE 실증: 과제 섹션). 안내는 ①/③/④ 지목.
  const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',
    step_02:()=>selectedTitle?null:'먼저 ①에서 발명의 명칭을 확정하세요(기술분야는 명칭 기반)',
    step_03:()=>selectedTitle?null:'먼저 ①에서 발명의 명칭을 확정하세요(배경기술은 명칭 기반)',
    step_04:()=>selectedTitle?null:'먼저 ①에서 발명의 명칭을 확정하세요(선행기술 검색은 명칭 기반)',
    step_05:()=>outputs.step_06?null:'먼저 ③에서 청구항을 생성하세요 — 과제는 청구항·해결수단을 역설계하여 작성됩니다',
    step_06:()=>selectedTitle?null:'먼저 ①에서 발명의 명칭을 확정하세요',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_08c:()=>outputs.step_08?null:'장치 상세설명(Step 8) 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저',
    step_16:()=>outputs.step_06?null:'먼저 ③에서 청구항을 생성하세요 — 발명의 효과는 청구항 기반으로 작성됩니다',
    step_17:()=>outputs.step_06?null:'먼저 ③에서 청구항을 생성하세요 — 과제의 해결 수단은 청구항 기반으로 작성됩니다',
    step_18:()=>outputs.step_08?null:'먼저 ④에서 상세설명을 생성하세요 — 부호의 설명은 상세설명 기반입니다',
    step_19:()=>outputs.step_06?null:'먼저 ③에서 청구항을 생성하세요 — 요약서는 청구항 기반으로 작성됩니다',
    step_20:()=>outputs.step_10?null:'방법 청구항 먼저'};return d[s]?d[s]():null;
}
// ═══ [Item 3] FIX 품질 게이팅 — B/C군(도면·상세설명·수학식)은 선행 청구항이 validateClaims 를 통과해야 진행 ═══
//   장치계(07/08/09/08c): step_06 검사 / 방법계(11/12): step_06 컨텍스트 합산 + step_10 검사(05:81 패턴 재사용).
const _CLAIM_GATE_STEPS={step_07:'device',step_08:'device',step_09:'device',step_08c:'device',step_11:'method',step_12:'method'};
function _claimGateStatus(sid){
  const kind=_CLAIM_GATE_STEPS[sid];
  if(!kind)return {critical:0,high:0,issues:[]};   // B/C군 아님 → 통과(D·F군·청구항 자체는 게이트 대상 아님)
  const issues = kind==='method'
    ? validateClaims((outputs.step_06||'')+'\n'+(outputs.step_10||''))   // 방법: 장치 청구항 컨텍스트 합산(상기 선행기재 해소)
    : validateClaims(outputs.step_06||'');
  return { critical:issues.filter(i=>i.severity==='CRITICAL').length, high:issues.filter(i=>i.severity==='HIGH').length, issues };
}
// 게이트 판정: CRITICAL>0 → 하드 차단(false). HIGH>0 → 확인 모달(진행 true/취소 false). 0 → 통과. bulk=true면 모달 생략(CRITICAL만 차단).
async function _claimGatePass(sid,bulk){
  const g=_claimGateStatus(sid);
  if(g.critical>0){ App.showToast(`⚠️ 청구항 검증 CRITICAL ${g.critical}건 — 청구항(③ 골격 탭)을 먼저 보정하세요. ${STEP_NAMES[sid]||sid} 중단`,'error'); return false; }
  if(g.high>0 && !bulk){
    const ok=(typeof window==='undefined'||typeof window.confirm!=='function') ? true
      : window.confirm(`청구항에 HIGH 경고 ${g.high}건이 있습니다.\n\n이대로 ${STEP_NAMES[sid]||sid}을(를) 진행하시겠습니까?\n(취소 후 청구항을 먼저 보정하는 것을 권장합니다.)`);
    if(!ok)return false;
  }
  return true;
}
async function runStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13',step_14:'btnStep14',step_15:'btnStep15',step_20:'btnStep20'},bid=bm[sid];setGlobalProcessing(true);loadingState[sid]=true;if(bid)App.setButtonLoading(bid,true);
  try{
    // v6.0: 부분 수정 모드 표시
    const _hasCmd=!!getStepUserCommand(sid);
    const _hasOut=!!outputs[sid];
    if(_hasCmd&&_hasOut)App.showToast('<span class="ico" data-icon="edit"></span> 기존 내용 부분 수정 모드','info');
    
    // Step 04: KIPRIS API 실시간 검색
    if(sid==='step_04'){
      const sr=await searchPriorArt(selectedTitle);
      pushOutputHistory('step_04','llm','runStep');
      if(sr){outputs.step_04=sr.formatted;renderOutput('step_04',sr.formatted);}
      else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderOutput('step_04',outputs.step_04);}
      markOutputTimestamp('step_04');
      onStepCompleted('step_04');saveProject(true);App.showToast('선행기술문헌 검색 완료');
      return;
    }
    // Step 13: use continuation for long review
    let r;
    pushOutputHistory(sid,'llm','runStep');
    if(sid==='step_13'){
      App.showProgress('progressStep13','AI 검토 생성 중...',0,1);
      const text=await App.callClaudeWithContinuation(buildPrompt(sid),'progressStep13');
      r={text};outputs[sid]=text;markOutputTimestamp(sid);
    } else {
      r=await App.callClaude(buildPrompt(sid));outputs[sid]=r.text;markOutputTimestamp(sid);
    }
    renderOutput(sid,r.text||outputs[sid]);
    // ★ A4 fix: 후속 스텝 무효화 경고 (v5.5) ★
    // step_06/step_10은 교정 완료 후 자체 호출하므로 여기서 제외
    if(sid !== 'step_06' && sid !== 'step_10') invalidateDownstream(sid);
    // Step 6: auto-validation + multi-round correction (v5.2)
    if(sid==='step_06'){
      let corrected=outputs[sid];
      let correctionRound=0;const maxRounds=3;
      for(correctionRound=0;correctionRound<maxRounds;correctionRound++){
        App.showProgress('progressStep06',`기재불비 검증 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+1,maxRounds*2+1);
        const issues=validateClaims(corrected);
        if(issues.length===0)break;
        App.showProgress('progressStep06',`기재불비 수정 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+2,maxRounds*2+1);
        const issueText=issues.map(i=>i.message).join('\n');
        const fixPrompt=`아래 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n수정 규칙:\n- 【청구항 N】형식 유지\n- \"상기\" 선행기재 누락: 참조하는 상위항(독립항 포함)에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 종속항에서 새로운 용어를 \"상기\"로 참조하려면, 반드시 해당 용어가 상위항에 먼저 기재되어야 한다\n- 상위항에 추가할 때는 독립항의 범위가 과도하게 좁아지지 않도록 주의\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n- 종속항 대통령령: ①인용항 번호 기재 ②다중인용시 택일적 기재 ③다중인용의 다중인용 금지 ④번호 역전 금지\n\n[지적사항]\n${issueText}\n\n[원본 청구범위]\n${corrected}`;
        const fixR=await App.callClaude(fixPrompt);corrected=fixR.text;
      }
      pushOutputHistory(sid,'llm','runStep.step_06_correction');
      outputs[sid]=corrected;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,corrected);
      const finalIssues=validateClaims(corrected);
      App.showProgress('progressStep06',`완료 (수정 ${correctionRound}회)`,maxRounds*2+1,maxRounds*2+1);
      setTimeout(()=>App.clearProgress('progressStep06'),2000);
      if(finalIssues.length===0)App.showToast(`장치 청구항 완료 (기재불비 없음, ${correctionRound}회 수정)`);
      else App.showToast(`장치 청구항 완료 (${correctionRound}회 수정, ${finalIssues.length}건 잔여 — 경미한 사항)`, 'info');
      // v11.0: 예시도 자동 감지
      if(!conceptDiagramTypes.length)autoDetectConceptDiagrams();
    }
    // Step 10: auto-validation + multi-round correction (v5.2)
    else if(sid==='step_10'){
      let corrected=outputs[sid];
      let correctionRound=0;const maxRounds=3;
      // ★ 방법 청구항 검증 시 장치 청구항도 참조 컨텍스트로 제공 ★
      const deviceClaimsCtx=outputs.step_06||'';
      for(correctionRound=0;correctionRound<maxRounds;correctionRound++){
        App.showProgress('progressStep10',`기재불비 검증 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+1,maxRounds*2+1);
        // 방법 청구항 검증 시 장치 청구항 컨텍스트도 참조
        const issues=validateClaims(deviceClaimsCtx+'\n'+corrected);
        if(issues.length===0)break;
        App.showProgress('progressStep10',`기재불비 수정 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+2,maxRounds*2+1);
        const issueText=issues.map(i=>i.message).join('\n');
        const firstClaimNum=corrected.match(/【청구항\s*(\d+)】/)?.[1]||'?';
        const fixPrompt=`아래 방법 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n⛔⛔ 절대 금지: 청구항 번호를 변경하지 마라! 방법 독립항은 반드시 【청구항 ${firstClaimNum}】을 유지해야 한다. 절대로 【청구항 1】로 변경 금지! ⛔⛔\n\n수정 규칙:\n- 【청구항 N】형식 유지 — 번호 변경 금지\n- \"상기\" 선행기재 누락: 방법 독립항(청구항 ${firstClaimNum}) 내에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 종속항에서 새로운 용어를 \"상기\"로 참조하려면, 반드시 해당 용어가 상위항에 먼저 기재되어야 한다\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n- 종속항 대통령령: ①인용항 번호 기재 ②다중인용시 택일적 기재 ③다중인용의 다중인용 금지 ④번호 역전 금지\n\n[지적사항]\n${issueText}\n\n[원본 청구범위 — 번호 유지!]\n${corrected}`;
        const fixR=await App.callClaude(fixPrompt);corrected=fixR.text;
      }
      pushOutputHistory(sid,'llm','runStep.step_10_correction');
      outputs[sid]=corrected;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,corrected);
      const finalIssues=validateClaims(corrected);
      App.showProgress('progressStep10',`완료 (수정 ${correctionRound}회)`,maxRounds*2+1,maxRounds*2+1);
      setTimeout(()=>App.clearProgress('progressStep10'),2000);
      if(finalIssues.length===0)App.showToast(`방법 청구항 완료 (기재불비 없음, ${correctionRound}회 수정)`);
      else App.showToast(`방법 청구항 완료 (${correctionRound}회 수정, ${finalIssues.length}건 잔여 — 경미한 사항)`, 'info');
    }
    else{
      if(sid==='step_13')document.getElementById('btnApplyReview').style.display='block';
      App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    }
    onStepCompleted(sid);saveProject(true);
    // [C1 자동 연쇄] SCOPE_GUARDED 스텝 생성 후 자동 검증
    if(inventionScope?.locked_at&&(SCOPE_GUARDED_TEXT_STEPS.includes(sid)||SCOPE_GUARDED_MERMAID_STEPS.includes(sid))){try{await runScopeCheck(sid);}catch(e2){console.warn('[C1] runScopeCheck 자동 실행 실패:',sid,e2.message);}}
  }catch(e){try{_lastGenError=(e&&e.message)||String(e);}catch(_e){}App.showToast(e.message,'error');}finally{loadingState[sid]=false;if(bid)App.setButtonLoading(bid,false);setGlobalProcessing(false);}}
async function runLongStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}if(!(await _claimGatePass(sid)))return;setGlobalProcessing(true);try{await _longStepCore(sid);}finally{setGlobalProcessing(false);}}
// ★ [T1] 가드/globalProcessing 없는 실행 코어 — 통합 핸들러(runImplementationDesc)가 device→concept 순차 호출 시 중첩 early-return 방지(진단 경고 반영).
async function _longStepCore(sid){const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';loadingState[sid]=true;App.setButtonLoading(bid,true);
  // v6.0: 부분 수정 모드 표시
  const _hasCmd=!!getStepUserCommand(sid),_hasOut=!!outputs[sid];
  const _modeLabel=(_hasCmd&&_hasOut)?'부분 수정':'생성';
  App.showProgress(pid,`${STEP_NAMES[sid]} ${_modeLabel} 중...`,0,1);
  try{let t=await App.callClaudeWithContinuation(buildPrompt(sid),pid);
    // v8.1: step_08 도면 범위 초과 자동 교정
    if(sid==='step_08')t=sanitizeDescFigureRefs(t,'device');
    if(sid==='step_12')t=sanitizeDescFigureRefs(t,'method');
    // v5.6: step_08 글자수 초과 검증 — 사용자 설정 대비 실제 분량 경고
    if(sid==='step_08'){
      const _bodyText=t.replace(/^[\s\S]*?(?=도 1)/,'').replace(/\n{2,}/g,'\n');
      const _charCount=_bodyText.length;
      // v10.5: 실제 도면 수 기준 (UI 값 변경 시에도 정확한 경고)
      const _actualFigCount=_extractFigureNumbersFromDesign(outputs.step_07||'').length||parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _dlCfg={compact:1000,standard:1500,detailed:2000,maximal:3000,custom:customDetailChars||2000}[detailLevel]||1500;
      const _targetTotal=_dlCfg*_actualFigCount;
      const _ratio=_charCount/_targetTotal;
      if(_ratio>1.5){
        App.showToast(`⚠️ 상세설명 ${_charCount.toLocaleString()}자 (목표 ${_targetTotal.toLocaleString()}자의 ${Math.round(_ratio*100)}%) — 과다 생성됨`,'warning');
        console.warn(`[step_08] 글자수 초과: ${_charCount}자 / 목표 ${_targetTotal}자 (${Math.round(_ratio*100)}%)`);
      }else if(_ratio<0.5){
        App.showToast(`⚠️ 상세설명 ${_charCount.toLocaleString()}자 (목표 ${_targetTotal.toLocaleString()}자의 ${Math.round(_ratio*100)}%) — 과소 생성됨`,'warning');
      }
    }
    pushOutputHistory(sid,'llm','runLongStep');
    outputs[sid]=t;markOutputTimestamp(sid);
    if(sid==='step_08')outputs.step08_device=t;   // ★ [T1] device-only 스냅샷(합본 재구성·concept-gen 입력의 원천 — 멱등)
    invalidateDownstream(sid);onStepCompleted(sid);renderOutput(sid,t);
    if(sid==='step_08')_mergeConceptIntoStep08();   // ★ [T1] 기존 예시도(step_08c)가 있으면 합본 반영(없으면 no-op)
    saveProject(true);App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    // [C1 자동 연쇄] SCOPE_GUARDED 스텝 생성 후 자동 검증
    if(inventionScope?.locked_at&&(SCOPE_GUARDED_TEXT_STEPS.includes(sid)||SCOPE_GUARDED_MERMAID_STEPS.includes(sid))){try{await runScopeCheck(sid);}catch(e2){console.warn('[C1] runScopeCheck 자동 실행 실패:',sid,e2.message);}}
  }catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;App.setButtonLoading(bid,false);App.clearProgress(pid);}}
// ★ 예시도 상세설명(step_08c) 전용 생성 — runLongStep 패턴 미러(방법 step_12 선례). 장치 메가룰 없는 focused 호출 → 예시도 누락 구조 차단.
//   ★ 장치(step_08)·방법 sanitizer(sanitizeMethodFromDevice/DescFigureRefs)는 호출하지 않는다(예시도 도 번호가 deviceMax 초과라 삭제됨 — #213).
// ★ 예시도 상세설명(step_08c) — 보조 버튼(btnStep08c) 직접 실행. ★ [T2] 장치 상세설명(step_08) 선행 요구(전제: 예시도가 장치 구성에 의해 동작·구현됨을 기술).
async function runConceptDescStep(){
  if(globalProcessing)return;
  if(!conceptDiagramTypes.some(ct=>ct.svgContent)){App.showToast('먼저 예시도(Step 7c)를 생성하세요','error');return;}
  if(!outputs.step_06){App.showToast('장치 청구항(Step 6)을 먼저 생성하세요','error');return;}
  if(!outputs.step_08){App.showToast('장치 상세설명(Step 8)을 먼저 생성하세요 — 예시도 설명은 장치 설명을 전제로 합니다','error');return;}   // ★ [T2] 순서 강제(장치→예시)
  if(!(await _claimGatePass('step_08c')))return;   // [Item 3] 품질 게이트
  setGlobalProcessing(true);
  try{await _conceptDescCore();}finally{setGlobalProcessing(false);}
}
// ★ [T1] 가드/globalProcessing 없는 실행 코어 — runImplementationDesc 가 장치 직후 순차 호출(중첩 early-return 방지).
async function _conceptDescCore(){
  loadingState.step_08c=true;App.setButtonLoading('btnStep08c',true);
  const pid='progressStep08c';
  try{
    let t=await App.callClaudeWithContinuation(buildPrompt('step_08c'),pid);
    pushOutputHistory('step_08c','llm','runConceptDescStep');
    outputs.step_08c=t;markOutputTimestamp('step_08c');_updateConceptDescBtn();   // ★ [Task1] 생성 후 버튼 강조 해제
    invalidateDownstream('step_08c');               // → 부호의 설명(step_18) stale
    _mergeConceptIntoStep08();                       // ★ [T1] 장치 상세설명(step_08) 본문에 합본 → 후속 단계 자동 공유. (별도 renderOutput('step_08c') 제거 — 합본본을 Step 8 결과에 표시)
    onStepCompleted('step_08c');
    saveProject(true);
    App.showToast(`예시도 상세설명 완료 [${App.getModelConfig().label}]`);
  }catch(e){App.showToast(e.message,'error');}
  finally{loadingState.step_08c=false;App.setButtonLoading('btnStep08c',false);App.clearProgress(pid);}
}
// ★ [T1] 통합 상세설명 핸들러 — "상세설명 생성" 한 버튼: 장치(step_08) 완결 → 예시도(step_08c) 순차(전제 기반).
//   예시도(step_07c svgContent) 없으면 장치(step_08)만. globalProcessing 1회 점유(코어는 미점유 → 중첩 안 막힘).
async function runImplementationDesc(){
  if(globalProcessing)return;
  const dep=checkDependency('step_08');if(dep){App.showToast(dep,'error');return;}
  setGlobalProcessing(true);
  try{
    await _longStepCore('step_08');                                                  // ① 장치 상세설명 완결
    if(outputs.step_08 && outputs.step_06 && conceptDiagramTypes.some(ct=>ct.svgContent)){
      await _conceptDescCore();                                                       // ② 예시도 상세설명(장치 전제)
    }
  }finally{setGlobalProcessing(false);}
}
async function runMathInsertion(){if(globalProcessing)return;const dep=checkDependency('step_09');if(dep){App.showToast(dep,'error');return;}if(!(await _claimGatePass('step_09')))return;setGlobalProcessing(true);loadingState.step_09=true;App.setButtonLoading('btnStep09',true);try{
  const TARGET_MATH_COUNT=5;
  let r=await App.callClaude(buildPrompt('step_09'));
  // 수학식 블록 개수 검증
  const mathBlocks=parseMathBlocks(r.text);
  if(mathBlocks.length<TARGET_MATH_COUNT){
    // 부족하면 추가 생성 요청
    const missing=TARGET_MATH_COUNT-mathBlocks.length;
    console.warn(`[step_09] 수학식 ${mathBlocks.length}개 생성됨 (목표 ${TARGET_MATH_COUNT}개) → ${missing}개 추가 생성`);
    const addPrompt=`상세설명에 수학식 ${missing}개를 추가로 생성하라. 기존 수학식 번호(1~${mathBlocks.length})와 겹치지 않게 수학식 ${mathBlocks.length+1}번부터 시작하라.\n기존에 삽입된 수학식의 ANCHOR는 사용하지 마라.\n동일한 규칙을 따르되, 기존 수학식과 다른 알고리즘/계산 로직에 대해 작성하라.\n\n${buildPrompt('step_09')}`;
    const r2=await App.callClaude(addPrompt);
    r={text:r.text+'\n'+r2.text};
    App.showToast(`수학식 ${mathBlocks.length}개→추가 생성 시도`,'info');
  }
  const baseDesc=getLatestDescription()||'';
  pushOutputHistory('step_09','llm','runMathInsertion');
  outputs.step_09=insertMathBlocks(baseDesc,r.text);
  // 삽입 후 실제 수학식 개수 검증
  const insertedCount=(outputs.step_09.match(/【수학식\s*\d+】/g)||[]).length;
  markOutputTimestamp('step_09');invalidateDownstream('step_09');renderOutput('step_09',outputs.step_09);onStepCompleted('step_09');saveProject(true);
  if(insertedCount<TARGET_MATH_COUNT){
    App.showToast(`⚠️ 수학식 ${insertedCount}/${TARGET_MATH_COUNT}개 삽입됨 (${TARGET_MATH_COUNT-insertedCount}개 ANCHOR 매칭 실패)`,'warning');
  }else{
    App.showToast(`수학식 ${insertedCount}개 삽입 완료`);
  }
}catch(e){App.showToast(e.message,'error');}finally{loadingState.step_09=false;App.setButtonLoading('btnStep09',false);setGlobalProcessing(false);}}

// v10.2: 검토 결과를 장치/방법 범위로 필터링
function filterReviewForScope(reviewText,scope){
  if(!reviewText)return '';
  if(scope==='all')return reviewText;
  
  const lines=reviewText.split('\n');
  const filtered=[];
  
  // 방법 관련 키워드 (장치 범위에서 제외할 대상)
  const methodKeywords=/방법\s*청구항|방법\s*상세설명|방법\s*도면|방법\s*앵커|순서도|흐름도|~하는\s*단계|S\d{3}|단계\s*[:(]S|방법\s*독립항|방법\s*종속항/;
  // 장치 관련 키워드 (방법 범위에서 제외할 대상)
  const deviceKeywords=/장치\s*청구항|장치\s*상세설명|장치\s*도면|장치\s*앵커|블록도|구성도|장치\s*독립항|장치\s*종속항/;
  
  const excludeRe=scope==='device'?methodKeywords:deviceKeywords;
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    
    // 검토 항목 헤더 ([1]~[11]) → 항상 포함
    if(/^\[(\d{1,2})\]\s/.test(line)){filtered.push(line);continue;}
    
    // ✅/⚠️ 판정 라인 → 항상 포함
    if(/^[✅⚠️]/.test(line.trim())){filtered.push(line);continue;}
    
    // 전체 요약/우선순위 → 항상 포함
    if(/전체\s*요약|보완\s*우선순위/.test(line)){filtered.push(line);continue;}
    
    // 빈 줄 → 항상 포함
    if(line.trim()===''){filtered.push(line);continue;}
    
    // 해당 scope와 반대되는 키워드가 포함된 라인 검사
    if(excludeRe.test(line)){
      // "장치 및 방법" 같이 양쪽 다 언급하면 포함
      const bothScopes=/장치\s*및\s*방법|장치와\s*방법|장치,\s*방법/.test(line);
      if(!bothScopes)continue;  // 이 라인만 skip (다음 라인은 독립 판단)
    }
    
    filtered.push(line);
  }
  
  // 연속 빈줄 정리
  return filtered.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

// v10.2: 장치 도면 목록 요약 (LLM에 명시적으로 어떤 도면만 존재하는지 전달)
function extractDeviceFigSummary(){
  const design=outputs.step_07||'';
  if(!design)return '';
  const figs=[...design.matchAll(/도\s+(\d+)[은는]\s*([^\n]+)/g)].map(m=>`도 ${m[1]}: ${m[2].replace(/이다\.\s*$/,'').trim()}`);
  if(!figs.length)return '';
  const deviceMax=getLastFigureNumber(design)||parseInt(document.getElementById('optDeviceFigures')?.value||4);
  return `\n\n★★★ 현재 존재하는 장치 도면 (이 도면만 참조 가능) ★★★\n${figs.join('\n')}\n총 ${figs.length}개 도면 (도 1 ~ 도 ${deviceMax})\n⛔ 위 목록에 없는 도면은 존재하지 않는다. 순서도, 흐름도, 방법도면은 장치 도면에 포함되지 않는다.\n⛔ 새로운 도면(도 ${deviceMax+1} 이상)을 추가하거나 참조하지 마라.`;
}

// v10.2: 장치 상세설명에서 방법/순서도/흐름도 관련 내용 제거 (후처리 안전망)
function sanitizeMethodFromDevice(text){
  if(!text)return text;
  
  // 1단계: 장치 도면 최대 번호 확인
  const deviceMax=getLastFigureNumber(outputs.step_07||'')||parseInt(document.getElementById('optDeviceFigures')?.value||4);
  // ★ 예시도(step_07c) 도 번호 — 방법 도면이 아니므로 분류에서 제외(검토 반영 시 예시도 단락 오삭제 방지). getAutoFigNums=SoT(③ override 반영).
  const conceptFigNums=new Set(getAutoFigNums('step_07c'));

  // 2단계: 순서도/흐름도 도면 번호 수집 (소개문에서 추출)
  const methodFigNums=new Set();
  const introRe=/도\s+(\d+)[은는]\s*[^\n]*(?:순서도|흐름도|방법|절차)[^\n]*(?:이다|나타낸다|도시한다)/g;
  let m;
  while((m=introRe.exec(text))!==null)methodFigNums.add(parseInt(m[1]));
  // 장치 도면 범위 밖의 도면도 방법으로 간주
  const allFigRefs=[...text.matchAll(/도\s+(\d+)/g)].map(x=>parseInt(x[1]));
  allFigRefs.forEach(n=>{if(n>deviceMax)methodFigNums.add(n);});
  // ★ 예시도 도 번호는 방법에서 제외 — deviceMax 초과여도(또는 "방법" 단어 포함이어도) 예시도는 삭제 대상이 아니다.
  conceptFigNums.forEach(n=>methodFigNums.delete(n));
  
  if(!methodFigNums.size){
    // 방법 도면이 없으면 단독 S단계 문장만 제거
    // ★ P3: 단계 문맥(단계 S### / S### …단계 / S###에서)일 때만 제거 — "S123 파라미터" 등 비단계 S###는 보존(과삭제 방지)
    return text.replace(/^[^\n]*(?:단계\s*S\d{3}|S\d{3}[^\n]{0,15}단계|S\d{3}\s*에서)[^\n]*$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
  }
  
  console.log(`[sanitizeMethodFromDevice] 방법 도면 번호 감지: 도 ${[...methodFigNums].sort((a,b)=>a-b).join(', ')} (장치 도면: ~도 ${deviceMax})`);
  
  // 3단계: 방법 도면 관련 단락 제거
  const lines=text.split('\n');
  const cleaned=[];
  let skipParagraph=false;
  
  // 방법 도면 번호 패턴 생성
  const methodFigPattern=new RegExp(`도\\s+(${[...methodFigNums].join('|')})[^0-9]`);
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const trimmed=line.trim();
    
    // 빈 줄 → 단락 리셋
    if(!trimmed){skipParagraph=false;cleaned.push(line);continue;}
    
    if(skipParagraph)continue;
    
    // 방법 도면 소개문: "도 N은 ~순서도/흐름도이다"
    if(methodFigPattern.test(trimmed)&&/도\s+\d+[은는을를]\s*/.test(trimmed)){
      skipParagraph=true;
      console.warn(`[sanitizeMethodFromDevice] 방법 도면 단락 제거: "${trimmed.slice(0,80)}..."`);
      continue;
    }
    
    // 단독 S단계 문장 — ★ P3: 단계 문맥(단계 S### / S###…단계 / S###에서)일 때만. 비단계 S###(수치·식별자) 보존
    if(/단계\s*S\d{3}|S\d{3}[^\n]{0,15}단계|S\d{3}\s*에서/.test(trimmed)){
      console.warn(`[sanitizeMethodFromDevice] S단계 문장 제거: "${trimmed.slice(0,80)}..."`);
      continue;
    }
    
    cleaned.push(line);
  }
  
  return cleaned.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

// v10.3: 편집 지시 파서 — LLM이 출력한 EDIT 블록을 구조화
function parseEditInstructions(text){
  if(!text)return[];
  const edits=[];
  const re=/---EDIT_\d+---\s*\nANCHOR:\s*(.+)\s*\nACTION:\s*(ADD_AFTER|ADD_BEFORE|MODIFY)\s*\nCONTENT:\s*([\s\S]*?)(?:\nREASON:\s*([\s\S]*?))?(?=---EDIT_\d+---|$)/g;
  let m;
  while((m=re.exec(text))!==null){
    const anchor=m[1].trim();
    const action=m[2].trim();
    let content=m[3].trim();
    const reason=(m[4]||'').trim();
    // CONTENT에서 다음 EDIT 또는 끝까지의 불필요한 텍스트 제거
    content=content.replace(/\n---EDIT_\d+---[\s\S]*/,'').trim();
    // v10.4: CONTENT에서 검토 형식 텍스트 제거 (LLM이 검토 메타데이터를 혼입하는 문제 방지)
    content=_sanitizeEditContent(content);
    if(anchor.length>=10&&content.length>=5){
      edits.push({anchor,action,content,reason});
    }
  }
  return edits;
}

// v10.4: CONTENT에서 검토 형식 메타데이터 제거
function _sanitizeEditContent(content){
  if(!content)return content;
  let c=content;
  // 패턴 1: "현재: ... 수정: ..." 형태 → 수정 부분만 추출
  const curModMatch=c.match(/현재\s*:\s*[\s\S]*?수정\s*:\s*["']?([\s\S]+?)["']?\s*$/);
  if(curModMatch){
    c=curModMatch[1].trim();
    console.log(`[_sanitizeEditContent] 현재/수정 형식 감지 → 수정 부분만 추출`);
  }else{
    // 패턴 2: "현재: ..." 단독 (수정 없이 현재 문장만 있는 경우 → 검토 설명이므로 제거)
    if(/^현재\s*:/.test(c)){
      c=c.replace(/^현재\s*:\s*/,'').trim();
      console.log(`[_sanitizeEditContent] "현재:" 접두사 제거`);
    }
    // 패턴 3: "수정: ..." 단독 → 접두사만 제거
    if(/^수정\s*:/.test(c)){
      c=c.replace(/^수정\s*:\s*["']?/,'').replace(/["']\s*$/,'').trim();
      console.log(`[_sanitizeEditContent] "수정:" 접두사 제거`);
    }
  }
  // 패턴 4: "[위치: ...]" 접두사 제거
  c=c.replace(/^\[위치\s*:\s*[^\]]*\]\s*/,'').trim();
  // 패턴 5: "기재 누락 →" 또는 "해당 없음 →" 접두사 제거
  c=c.replace(/^(?:기재\s*누락|해당\s*없음)\s*→?\s*/,'').trim();
  // 패턴 6: 인라인 "현재 문장 → 수정 문장" 형태 (화살표 기준 분리)
  const arrowMatch=c.match(/^(.+?)\s*→\s*(.+)$/s);
  if(arrowMatch){
    const before=arrowMatch[1].trim();
    const after=arrowMatch[2].trim();
    // 화살표 앞이 검토 설명이고 뒤가 실제 특허 문장인 경우
    if(/부재|누락|불일치|미흡|부족|모호/.test(before)&&after.length>before.length*0.5){
      c=after.replace(/^["']|["']$/g,'').trim();
      console.log(`[_sanitizeEditContent] 검토→수정 화살표 형식 감지 → 수정 부분만 추출`);
    }
  }
  // 패턴 7: 감싸는 큰따옴표/작은따옴표 제거 (전체를 감싸는 경우만)
  if((c.startsWith('"')&&c.endsWith('"'))||(c.startsWith("'")&&c.endsWith("'"))){
    c=c.slice(1,-1).trim();
  }
  return c;
}

// v10.3: 편집 지시를 원문에 적용 — 원본 구조 100% 보존
function applyEditInstructions(originalText,edits){
  if(!edits||!edits.length)return originalText;
  let result=originalText;
  let appliedCount=0;
  
  // 역순으로 적용 (뒤→앞) — 인덱스 변위 방지
  // 먼저 각 편집의 위치를 찾아서 정렬
  const located=[];
  for(const edit of edits){
    const idx=fuzzyFindAnchor(result,edit.anchor);
    if(idx>=0){
      located.push({...edit,index:idx});
    }else{
      console.warn(`[applyEditInstructions] 앵커 매칭 실패: "${edit.anchor.slice(0,40)}..." → 건너뜀`);
    }
  }
  
  // 위치 내림차순 정렬 (뒤→앞)
  located.sort((a,b)=>b.index-a.index);
  
  for(const edit of located){
    // v10.3: 앵커 위치에서 정확한 문장 끝 찾기
    const anchorStart=edit.index;
    const sentenceEnd=findSentenceEndAfterAnchor(result,anchorStart,edit.anchor);
    
    // 정확 매칭 시 앵커 텍스트 위치 확인 (MODIFY용)
    const exactIdx=result.indexOf(edit.anchor,Math.max(0,anchorStart-50));
    
    // 청구항 헤더가 CONTENT에 혼입되지 않았는지 확인
    if(/【청구항|청구항\s*\d+|제\s*\d+\s*항|【발명|【기술분야|【배경기술/.test(edit.content)){   // ★ '제N항' 형태도 드롭(청구항 번호 본문 누수 차단)
      console.warn(`[applyEditInstructions] 청구항/섹션 헤더 감지 → 건너뜀: "${edit.content.slice(0,40)}..."`);
      continue;
    }

    // v10.4: 검토 형식 텍스트가 CONTENT에 잔존하는지 최종 검증
    if(/(?:^|\n)\s*(?:현재\s*:|수정\s*:|→\s*["']|\[위치\s*:)/.test(edit.content)){
      console.warn(`[applyEditInstructions] 검토 형식 잔존 감지 → 재정제: "${edit.content.slice(0,50)}..."`);
      edit.content=_sanitizeEditContent(edit.content);
      if(edit.content.length<5){console.warn(`[applyEditInstructions] 재정제 후 내용 부족 → 건너뜀`);continue;}
    }
    
    // ★ FIX-A: 중복 삽입 방지 전역화 — 국소 창(±500·첫50자 exact)은 26P1036형 문단블록 재서술을 놓침
    //   (원본이 창 밖이거나 첫 50자 한 글자만 달라도 dedup 실패 → 앵커 뒤 사본 삽입).
    //   _normForDedup(03:1159) 규칙(stripMathBlocks+공백 전제거)으로 result 전체를 정규화 검색.
    if(edit.action!=='MODIFY'){
      const _n=_stripMathNorm;   // [cleanup D2] 공유 헬퍼(06)
      const _nResult=_n(result), _nContent=_n(edit.content);
      // (1) 정규화 첫 60자 키가 result 전체에 이미 존재 → 중복(창 밖 원본도 포착)
      if(_nContent.length>=20 && _nResult.includes(_nContent.slice(0,60))){
        console.warn(`[applyEditInstructions] 중복(전역 정규화) 감지 → 건너뜀: "${edit.content.slice(0,30)}..."`);
        continue;
      }
      // (2) 장문 CONTENT(문장 3개↑): 문장 과반이 이미 result에 정규화 포함 → 블록 재서술 차단
      const _sents=String(edit.content).split(/(?<=[.。])\s+|\n+/).map(s=>_n(s)).filter(s=>s.length>=15);
      if(_sents.length>=3){
        const _dup=_sents.filter(s=>_nResult.includes(s)).length;
        if(_dup*2>_sents.length){
          console.warn(`[applyEditInstructions] 장문 CONTENT 과반 중복(${_dup}/${_sents.length}) → 건너뜀`);
          continue;
        }
      }
    }

    switch(edit.action){
      case 'ADD_AFTER':{
        const _afterChar=result[sentenceEnd]||'';
        const _trailSep=/[\s\n]/.test(_afterChar)?'':' ';
        result=result.slice(0,sentenceEnd)+' '+edit.content+_trailSep+result.slice(sentenceEnd);
        appliedCount++;
        console.log(`[applyEditInstructions] ADD_AFTER 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." 뒤에 ${edit.content.length}자 추가`);
        break;}
      case 'ADD_BEFORE':{
        const _beforeChar=anchorStart>0?result[anchorStart-1]:'';
        const _leadSep=/[\s\n]/.test(_beforeChar)?'':' ';
        result=result.slice(0,anchorStart)+_leadSep+edit.content+' '+result.slice(anchorStart);
        appliedCount++;
        console.log(`[applyEditInstructions] ADD_BEFORE 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." 앞에 ${edit.content.length}자 추가`);
        break;}
      case 'MODIFY':
        if(exactIdx>=0){
          // v10.5: MODIFY 후 결합 부위 검증 — 마침표/공백 보정
          let _finalContent=edit.content;
          let _afterMod=result.slice(exactIdx+edit.anchor.length);
          // (1) 콘텐츠 끝에 마침표가 없는데 앵커는 마침표로 끝났다면 → 마침표 복원
          if(/[.。]$/.test(edit.anchor.trim())&&!/[.。]$/.test(_finalContent.trim())){
            _finalContent=_finalContent.trimEnd()+'.';
          }
          // (2) 콘텐츠가 마침표로 끝나고, 뒤에도 마침표로 시작하면 → 이중 마침표 방지
          if(/[.。]$/.test(_finalContent.trim())&&/^\s*[.。]/.test(_afterMod)){
            _afterMod=_afterMod.replace(/^\s*[.。]\s*/,' ');
          }
          // (3) 콘텐츠가 마침표로 끝나고 뒤에 한글이 바로 오면 공백 보장
          const _nxt=_afterMod[0]||'';
          if(/[.。]$/.test(_finalContent.trimEnd())&&/[가-힣(]/.test(_nxt)){
            _finalContent=_finalContent.trimEnd()+' ';
            _afterMod=_afterMod.replace(/^\s+/,'');
          }
          // (4) 콘텐츠가 마침표 없이 끝나고 뒤에 한글이 바로 오면 (마침표도 없고 공백도 없음) → 공백 보장
          if(!/[.。\s]$/.test(_finalContent)&&/^[가-힣(]/.test(_afterMod)){
            _finalContent=_finalContent+' ';
          }
          result=result.slice(0,exactIdx)+_finalContent+_afterMod;
          appliedCount++;
          console.log(`[applyEditInstructions] MODIFY 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." → "${_finalContent.slice(0,30)}..."`);
        }
        break;
    }
  }

  // v10.4: 전체 편집 완료 후 — 마침표 뒤 띄어쓰기 누락 교정
  // "한다.이러한" → "한다. 이러한" (한글.한글 패턴, 소수점 제외)
  result=result.replace(/([가-힣)\]])\.[ \t]*([가-힣(【])/g,(m,p,n)=>{
    return p+'. '+n;
  });

  console.log(`[applyEditInstructions] 총 ${edits.length}개 중 ${appliedCount}개 적용 완료`);
  return result;
}

// v10.3: 청구범위에서 구성요소 목록만 추출 (청구항 전문 대신 핵심 정보만)
function extractClaimComponents(claimText){
  if(!claimText)return '';
  // 구성요소(참조번호) 패턴 추출
  const components=new Set();
  const re=/([가-힣]*(?:부|모듈|유닛|서버|장치|단말|센서|프로세서|메모리|인터페이스|엔진|매니저))\s*\((\d+[a-z]?)\)/g;
  let m;
  while((m=re.exec(claimText))!==null){
    components.add(`${m[1]}(${m[2]})`);
  }
  if(!components.size){
    // 참조번호 없는 경우 구성요소명만 추출
    const nameRe=/([가-힣]{2,}(?:부|모듈|유닛))/g;
    while((m=nameRe.exec(claimText))!==null)components.add(m[1]);
  }
  return components.size?`구성요소 목록: ${[...components].join(', ')}`:'(구성요소 목록 없음)';
}

// ★ 청구항에서 구성요소 계층 구조를 추출하여 도면 설계 프롬프트에 포함할 텍스트 생성 ★
function _buildClaimComponentHierarchy(claimText){
  if(!claimText)return '';
  const comps=_extractStructuredComponents(claimText);
  if(!comps.length)return '';
  
  // 레벨 분류
  const l1=[],l2=[],l3=[],l4=[];
  for(const c of comps){
    const n=c.refNum;
    if(n>=1000)l4.push(c);
    else if(n>=100&&n%100===0)l1.push(c);
    else if(n>=100&&n%10===0)l2.push(c);
    else if(n>=100)l3.push(c);
  }
  
  // 계층 구조 문자열 생성
  let result=`⛔⛔⛔ 청구항 구성요소 목록 (이 명칭과 참조번호를 그대로 사용하라) ⛔⛔⛔\n`;
  
  if(l1.length){
    result+=`■ L1 (최상위 장치, X00): ${l1.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
    for(const parent of l1){
      const children=l2.filter(c=>Math.floor(c.refNum/100)*100===parent.refNum);
      if(children.length){
        result+=`  └ ${parent.name}(${parent.refNum}) 하위 L2: ${children.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
        for(const child of children){
          const grandchildren=l3.filter(c=>Math.floor(c.refNum/10)*10===child.refNum);
          if(grandchildren.length){
            result+=`    └ ${child.name}(${child.refNum}) 하위 L3: ${grandchildren.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
          }
        }
      }
    }
  }
  
  if(l2.length){
    const orphanL2=l2.filter(c=>!l1.some(p=>Math.floor(c.refNum/100)*100===p.refNum));
    if(orphanL2.length)result+=`■ L2 (추가): ${orphanL2.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
  }
  
  result+=`\n★ 위 목록의 구성요소 명칭과 참조번호를 반드시 그대로 사용하라. 임의 변경/추가 금지.\n`;
  result+=`★ 도 2 이후의 내부 구성요소는 위 목록에서만 선택하라.\n`;
  return result;
}

async function applyReview(){
  if(globalProcessing)return;if(!outputs.step_13){App.showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){App.showToast('상세설명 없음','error');return;}
  const hasMethodDesc=!!(outputs.step_12&&includeMethodClaims);
  const totalSteps=hasMethodDesc?3:2;
  pushOutputHistory('step_08','pre_review','applyReview');
  if(outputs.step_12)pushOutputHistory('step_12','pre_review','applyReview');
  setGlobalProcessing(true);loadingState.applyReview=true;App.setButtonLoading('btnApplyReview',true);
  try{
    // ═══════════════════════════════════════════════════════════════
    // v10.3: 편집 지시 기반 아키텍처 (전문 재작성 → 편집 지시 + 코드 적용)
    // ═══════════════════════════════════════════════════════════════
    // [기존 문제] LLM에게 전문 재작성 요청 → 청구항 구조로 변질
    // [해결] LLM은 "어디에 무엇을 추가/수정할지"만 출력 → 코드가 원문에 적용
    // ═══════════════════════════════════════════════════════════════

    // ═══ [1] 장치 상세설명 — 편집 지시 생성 + 적용 ═══
    App.showProgress('progressApplyReview',`[1/${totalSteps}] 장치 상세설명 편집 지시 생성 중...`,1,totalSteps);
    const baseDesc=stripMathBlocks(cur);
    const editInstructions=await App.callClaude(`아래 [검토 결과]의 지적사항을 반영하기 위한 편집 지시를 생성하라.

★★★ 중요: 상세설명 전체를 다시 작성하지 마라. 편집 지시만 출력하라. ★★★

[편집 지시 형식]
각 편집은 아래 형식으로 출력한다:

---EDIT_1---
ANCHOR: (수정할 위치의 기존 문장을 정확히 복사. 20자 이상)
ACTION: ADD_AFTER 또는 MODIFY 또는 ADD_BEFORE
CONTENT: (추가하거나 수정할 문장. 특허문체(~한다). 구성요소(참조번호) 형태.)
REASON: (어떤 검토 항목의 지적을 반영하는지)

---EDIT_2---
ANCHOR: ...
ACTION: ...
CONTENT: ...
REASON: ...

[ACTION 설명]
- ADD_AFTER: ANCHOR 문장 바로 뒤에 CONTENT를 삽입
- ADD_BEFORE: ANCHOR 문장 바로 앞에 CONTENT를 삽입
- MODIFY: ANCHOR 문장을 CONTENT로 교체 (용어 수정 등)

[규칙]
- ANCHOR는 [현재 상세설명]에 실제로 존재하는 문장을 정확히 복사하라 (부분 문장 가능, 20자 이상).
- CONTENT에는 특허문체로 작성. 구성요소(참조번호) 형태 사용.
- ⛔ 【청구항 N】, 청구항 1 등 청구항 헤더/번호/구조 절대 금지.
- ⛔ CONTENT에 "청구항 N"·"제N항"·"청구항 3 및 청구항 5에 관련하여" 등 ★청구항 번호 직접 언급 금지★ (명세서 부적절). 검토가 "청구항 3의 뒷받침 부족"을 지적해도, CONTENT에는 청구항을 가리키지 말고 그 구성요소(참조번호)로 구체 기술하라(예: "통신부(110)는 …한다").
- ⛔ 【수학식 N】 블록, 수학식 번호 참조 금지 (수학식은 별도 처리).
- ⛔ "~하는 단계", "S100" 등 방법 표현 금지. 장치 구성요소(~부)의 동작만.
- ⛔ 기존 문장을 삭제하는 편집 금지. 추가(ADD)와 수정(MODIFY)만 가능.
- ⛔⛔⛔ CONTENT에 검토 형식 텍스트를 절대 포함하지 마라:
  "현재:", "수정:", "[위치:", "→", "✅", "⚠️", "기재 누락", "해당 없음" 등 검토 메타데이터 금지.
  CONTENT에는 오직 상세설명에 실제로 삽입/교체될 순수 특허 문장만 작성하라.
  검토의 "수정:" 뒤에 제안된 문장만 참고하여 CONTENT를 작성하되, "수정:" 접두사 자체는 제외하라.
- "뒷받침 부족" → 해당 구성요소 설명 뒤에 동작 원리를 ADD_AFTER
- "앵커 종속항 보완" → 해당 구성요소 뒤에 (1) 동작 상세 (2) 기술적 효과 ADD_AFTER
- "용어 불일치" → 해당 문장을 올바른 용어로 MODIFY
- "기재 누락" → 가장 가까운 관련 문장을 ANCHOR로 사용하고 ADD_AFTER로 새 문장 추가
- 검토에서 지적되지 않은 부분은 편집하지 마라.
- 최대 15개 이내로 핵심 지적만 반영하라.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${filterReviewForScope(outputs.step_13,'device')}
[청구항 구성요소 참조] ${extractClaimComponents(outputs.step_06||'')}
⛔ 이것은 ★장치★ 상세설명 편집이다. 예시도(도 N, 별도 부호) 단락을 장치 상세설명에 추가하지 마라 — 예시도 설명은 별도 단계(예시도 상세설명)가 담당한다. 검토가 예시도 설명/부호 누락을 지적해도, 장치 본문에 "도 N을 참조하면, …" 예시도 단락을 끼워넣는 편집(ADD_AFTER 등)을 생성하지 마라(짧은 stub 끼워넣기 금지).
[현재 상세설명]
${baseDesc}${_maybeScopeGuard('step_13_applied','text')}`);

    // 편집 지시 파싱
    const edits=parseEditInstructions(editInstructions.text);
    console.log(`[applyReview] 편집 지시 ${edits.length}개 파싱 완료`);

    // 편집 적용 (원문 기반)
    let finalDesc=applyEditInstructions(baseDesc,edits);
    console.log(`[applyReview] 편집 적용 완료: ${baseDesc.length}자 → ${finalDesc.length}자`);

    // 후처리: 방법 혼입 제거 + 도면 범위 교정
    finalDesc=sanitizeMethodFromDevice(finalDesc);
    finalDesc=sanitizeDescFigureRefs(finalDesc,'device');

    // 분량 감소 경고 (편집 지시 방식에선 거의 발생하지 않음)
    if(finalDesc.length<baseDesc.length*0.95){
      console.warn(`[applyReview] ⚠️ 분량 감소: ${baseDesc.length}자 → ${finalDesc.length}자`);
      App.showToast(`⚠️ 검토 반영 후 분량 감소 감지 — 확인 필요`,'warning');
    }

    // ═══ [2] 수학식 재삽입 ═══
    if(outputs.step_09){
      App.showProgress('progressApplyReview',`[2/${totalSteps}] 수학식 재삽입 중...`,2,totalSteps);
      const existingMath=extractExistingMathBlocks(cur);
      if(existingMath.length>0){
        console.log(`[applyReview] 기존 수학식 ${existingMath.length}개 보존 재삽입`);
        const inserted=new Set();
        let successCount=0;
        for(const x of [...existingMath].reverse()){
          const i=fuzzyFindAnchor(finalDesc,x.anchor);
          if(i>=0&&!inserted.has(x.anchor)){
            inserted.add(x.anchor);
            const ip=findSentenceEndAfterAnchor(finalDesc,i,x.anchor);
            // v10.5: 삽입 지점 검증 — 단어 중간이면 가장 가까운 문장 경계로 보정
            const validIp=_validateInsertionPoint(finalDesc,ip);
            finalDesc=finalDesc.slice(0,validIp)+'\n\n'+x.formula+'\n\n'+finalDesc.slice(validIp);
            successCount++;
          }
        }
        if(successCount<existingMath.length){
          console.log(`[applyReview] 보존 실패 ${existingMath.length-successCount}개 → 새로 생성`);
          const mathR=await App.callClaude(buildMathPrompt(`${existingMath.length-successCount}개`, finalDesc));
          finalDesc=insertMathBlocks(finalDesc,mathR.text);
        }
        finalDesc=_deduplicateSentences(finalDesc); // v10.3: 수학식 재삽입 후 중복 제거
        finalDesc=renumberMathBlocks(finalDesc);
      }else{
        const mathR=await App.callClaude(buildMathPrompt('5개 내외', finalDesc));
        finalDesc=insertMathBlocks(finalDesc,mathR.text);
      }
    }
    // v10.5: 최종 띄어쓰기 보정 — 수학식 재삽입/중복제거 후 "한다.이러한" 패턴 교정
    // 줄바꿈은 보존 (수학식 블록 구조 보호), 같은 줄의 띄어쓰기만 교정
    finalDesc=finalDesc.replace(/([가-힣)\]])\.[ \t]*([가-힣(])/g,(m,p,n)=>{
      return p+'. '+n;
    });
    pushOutputHistory('step_13_applied','llm','applyReview');
    outputs.step_13_applied=finalDesc;
    markOutputTimestamp('step_13_applied');

    // ═══ [3] 방법 상세설명 — 편집 지시 생성 + 적용 ═══
    if(hasMethodDesc){
      App.showProgress('progressApplyReview',`[3/${totalSteps}] 방법 상세설명 편집 지시 생성 중...`,3,totalSteps);
      const baseMethod=getLatestMethodDescription()||'';
      const methodEditInstructions=await App.callClaude(`아래 [검토 결과]의 방법 관련 지적사항을 반영하기 위한 편집 지시를 생성하라.

★★★ 중요: 상세설명 전체를 다시 작성하지 마라. 편집 지시만 출력하라. ★★★

[편집 지시 형식]
---EDIT_1---
ANCHOR: (수정할 위치의 기존 문장 정확히 복사. 20자 이상)
ACTION: ADD_AFTER 또는 MODIFY 또는 ADD_BEFORE
CONTENT: (추가/수정할 문장. 특허문체.)
REASON: (검토 항목)

[규칙]
- ANCHOR는 [현재 방법 상세설명]에 실제 존재하는 문장.
- ⛔ 【청구항 N】, 청구항 번호/구조 절대 금지.
- ⛔⛔⛔ CONTENT에 검토 형식 텍스트 절대 금지: "현재:", "수정:", "[위치:", "→", "✅", "⚠️", "기재 누락" 등.
  CONTENT에는 오직 삽입/교체될 순수 특허 문장만 작성하라.
- 방법 상세설명만 편집. 장치 블록도 내용 금지.
- 수행 주체: "${getDeviceSubject()}". 최대 10개 편집.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${filterReviewForScope(outputs.step_13,'method')}
[현재 방법 상세설명]
${baseMethod}${_maybeScopeGuard('step_13_applied_method','text')}`);

      const methodEdits=parseEditInstructions(methodEditInstructions.text);
      console.log(`[applyReview] 방법 편집 지시 ${methodEdits.length}개 파싱`);
      const improvedMethod=applyEditInstructions(baseMethod,methodEdits);
      pushOutputHistory('step_13_applied_method','llm','applyReview');
      outputs.step_13_applied_method=improvedMethod;
      markOutputTimestamp('step_13_applied_method');
    }

    // ═══ 완료 ═══
    App.showProgress('progressApplyReview',`[${totalSteps}/${totalSteps}] 완료`,totalSteps,totalSteps);
    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>App.clearProgress('progressApplyReview'),2000);
    saveProject(true);
    App.showToast(`검토 반영 완료${hasMethodDesc?' (장치+방법)':''} — 최종 명세서에 자동 반영됩니다`);
    // [Item 2] 반영 직후 1회 완성본 기계검증 — 오염(문단 중복/문장 절단) 생산 지점 즉시 검출(토스트 요약만).
    try{ const _sv=validateSpecification(buildSpecification()); const _c=_sv.filter(i=>i.severity==='CRITICAL').length, _h=_sv.filter(i=>i.severity==='HIGH').length; if(_c||_h)App.showToast(`⚠️ 완성본 검증: CRITICAL ${_c}·HIGH ${_h} — ⑤ 검증·출원 탭에서 확인`,'warning'); }catch(_e){}
  }catch(e){App.showToast(e.message,'error');}finally{loadingState.applyReview=false;App.setButtonLoading('btnApplyReview',false);setGlobalProcessing(false);}
}
function showReviewDiff(mode){
  const area=document.getElementById('reviewDiffArea'),bb=document.getElementById('btnDiffBefore'),ba=document.getElementById('btnDiffAfter');if(!area)return;
  const _preReview08=getLastHistoryByOrigin('step_08','pre_review');
  const _preReviewText=_preReview08?_preReview08.value:'(없음)';
  if(mode==='before'){
    const text=_preReviewText;
    area.value=text;
    if(bb)bb.className='btn btn-primary btn-sm';if(ba)ba.className='btn btn-outline btn-sm';
    if(bb)bb.innerHTML=`반영 전 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${text.length.toLocaleString()}자</span>`;
    if(ba){
      let afterText=outputs.step_13_applied||'(없음)';
      if(outputs.step_13_applied_method)afterText+='\n\n'+outputs.step_13_applied_method;
      ba.innerHTML=`반영 후 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${afterText.length.toLocaleString()}자</span>`;
    }
  }
  else{
    let afterText=outputs.step_13_applied||'(없음)';
    if(outputs.step_13_applied_method){
      afterText+='\n\n═══ [방법 상세설명 검토 반영본] ═══\n\n'+outputs.step_13_applied_method;
    }
    area.value=afterText;
    if(bb)bb.className='btn btn-outline btn-sm';if(ba)ba.className='btn btn-primary btn-sm';
    const beforeText=_preReviewText;
    if(bb)bb.innerHTML=`반영 전 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${beforeText.length.toLocaleString()}자</span>`;
    if(ba)ba.innerHTML=`반영 후 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${afterText.length.toLocaleString()}자</span>`;
    // v10.2: 분량 변화 안내
    const diff=afterText.length-beforeText.length;
    const diffLabel=diff>=0?`+${diff.toLocaleString()}`:`${diff.toLocaleString()}`;
    const diffColor=diff>=0?'#2e7d32':'#c62828';
    const countEl=document.getElementById('reviewDiffCount');
    if(countEl)countEl.innerHTML=`<span style="color:${diffColor};font-size:12px;font-weight:600">${diffLabel}자 (${diff>=0?'증가':'감소'})</span>`;
    else{
      const newEl=document.createElement('span');newEl.id='reviewDiffCount';
      newEl.innerHTML=`<span style="color:${diffColor};font-size:12px;font-weight:600">${diffLabel}자 (${diff>=0?'증가':'감소'})</span>`;
      ba.parentElement?.appendChild(newEl);
    }
  }
}
async function runDiagramStep(sid){
  if(globalProcessing)return;
  const dep=checkDependency(sid);
  if(dep){App.showToast(dep,'error');return;}
  if(!(await _claimGatePass(sid)))return;   // [Item 3] 품질 게이트
  const bid=sid==='step_07'?'btnStep07':'btnStep11';
  setGlobalProcessing(true);
  loadingState[sid]=true;
  App.setButtonLoading(bid,true);
  
  try{
    console.log('[runDiagramStep] sid=',sid,'starting...');
    // 1. 도면 설계 생성
    let prompt;
    try{
      prompt=buildPrompt(sid);
      console.log('[runDiagramStep] prompt built OK, length=',prompt.length);
    }catch(promptErr){
      console.error('[runDiagramStep] buildPrompt ERROR:',promptErr);
      App.showToast('프롬프트 생성 오류: '+promptErr.message,'error');
      return;
    }
    let r=await App.callClaude(prompt);
    let designText=r.text;

    // ★ 방어: 빈 응답 감지 ★
    if(!designText||designText.trim().length<50){
      console.error('[runDiagramStep] AI returned empty/short response:',designText);
      App.showToast('도면 설계 생성 실패 — AI 응답이 비었습니다. 다시 시도해 주세요.','error');
      throw new Error('도면 설계 AI 응답 비어있음 ('+(designText?designText.length:0)+'자)');
    }
    
    // 2. 도면 설계 텍스트 사전 검증 (도면 수 + 규칙 검증)
    if(sid==='step_07'){
      const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _genCount=totalFig-requiredFigures.length;
      const _figNums=computeFigNums(Math.max(_genCount,0),0);
      const _expectedNums=_figNums.device;
      
      const preIssues=validateDiagramDesignText(designText,_genCount,_expectedNums);
      const hasPreErrors=preIssues.some(iss=>iss.severity==='ERROR');
      
      if(hasPreErrors){
        console.log('[runDiagramStep] 도면 설계 규칙 위반 발견:',preIssues.map(i=>i.message).join('; '));
        
        const feedbackPrompt=`이전 도면 설계에 규칙 위반이 있습니다. 아래 오류를 모두 수정하여 다시 생성하세요.

═══ 발견된 오류 ═══
${preIssues.filter(i=>i.severity==='ERROR').map(i=>'⛔ '+i.message).join('\n')}
${preIssues.filter(i=>i.severity==='WARNING').map(i=>'⚠ '+i.message).join('\n')}

═══ 핵심 수정사항 ═══
- 도면을 정확히 ${_genCount}개만 생성하라: ${_expectedNums.map(n=>'도 '+n).join(', ')}
- 구성요소 명칭과 참조번호는 【장치 청구범위】에서 가져와 사용하라
[R3] 도 1: L1 장치만 허용 (100, 200, 300...). L2/L3(110, 111...) 절대 금지!
[R5] 도 2+: 내부가 L2(110,120)면 최외곽=L1(100), 내부가 L3(111,112)면 최외곽=L2(110)

원래 요청: ${buildPrompt(sid).slice(0,1500)}

위 오류를 수정하여 도면 설계를 다시 출력하세요.`;

        r=await App.callClaude(feedbackPrompt);
        designText=r.text;
        App.showToast('도면 규칙 위반 감지, 자동 재생성됨','warning');
      }
      
      // ★ 2차 검증 — 재생성 후에도 도면 수 불일치이면 강제 트림 ★
      const postIssues=validateDiagramDesignText(designText,_genCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        console.warn('[runDiagramStep] 재생성 후에도 도면 수 불일치 — 초과분 수동 제거');
        designText=_trimDesignTextToExpectedFigures(designText,_expectedNums);
        App.showToast(`도면 수 강제 조정: ${_genCount}개로 트림`,'warning');
      }
    }
    
    if(sid==='step_11'){
      const _methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
      const _devCount=diagramData.step_07?.length||0;
      const _figNums=computeFigNums(_devCount,_methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
      const _expectedNums=_figNums.method;

      const preIssues=validateDiagramDesignText(designText,_methFigCount,_expectedNums);
      if(preIssues.some(i=>i.severity==='ERROR')){
        const fb=`도면 설계 오류:\n${preIssues.map(i=>i.message).join('\n')}\n도면을 정확히 ${_methFigCount}개만 생성하라: ${_expectedNums.map(n=>'도 '+n).join(', ')}\n원래 요청: ${buildPrompt(sid).slice(0,1500)}`;
        r=await App.callClaude(fb);
        designText=r.text;
      }
      
      const postIssues=validateDiagramDesignText(designText,_methFigCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        designText=_trimDesignTextToExpectedFigures(designText,_expectedNums);
      }
    }
    
    pushOutputHistory(sid,'llm','runDiagramStep');
    outputs[sid]=designText;markOutputTimestamp(sid);invalidateDownstream(sid);onStepCompleted(sid);
    renderOutput(sid,designText);
    
    // 3. Mermaid 변환
    const mermaidPrompt=buildMermaidPrompt(sid);
    console.log('[runDiagramStep] mermaid prompt length=',mermaidPrompt.length);
    const mr=await App.callClaude(mermaidPrompt,4096);
    if(!mr.text||mr.text.trim().length<10){
      console.error('[runDiagramStep] Mermaid 변환 실패 — 빈 응답');
      App.showToast('Mermaid 변환 실패 — 다시 시도해 주세요.','error');
      throw new Error('Mermaid 변환 AI 응답 비어있음');
    }
    pushOutputHistory(sid+'_mermaid','llm','runDiagramStep.mermaid');
    outputs[sid+'_mermaid']=mr.text;
    
    // 4. 렌더링 + 최종 검증
    renderDiagrams(sid,mr.text);

    // ★ v18: R6b/R6e/R12/R13a/R13b/R14 오류 시 자동 재생성 1회 시도 ★
    if(window._diagramErrors&&window._diagramErrors.sid===sid
       &&/\[R(?:6[be]|1[234][ab]?)\]/.test(window._diagramErrors.errors)
       &&!window._r13AutoRetried){
      window._r13AutoRetried=true;
      App.showToast('도면 규칙 위반 감지 — 자동 재생성','warning');
      try{
        await regenerateDiagramWithFeedback(sid);
      }catch(e2){
        console.warn('[runDiagramStep] 도면 규칙 위반 자동 재생성 실패:',e2);
      }
    }else if(!window._diagramErrors||window._diagramErrors.sid!==sid){
      window._r13AutoRetried=false; // 오류 없으면 플래그 리셋
    }

    const dlId=sid==='step_07'?'diagramDownload07':'diagramDownload11';
    const dlEl=document.getElementById(dlId);
    if(dlEl)dlEl.style.display='block';

    saveProject(true);
    App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    // [C1 자동 연쇄] SCOPE_GUARDED_MERMAID 스텝 생성 후 자동 검증
    const mermaidSid=sid+'_mermaid';
    if(inventionScope?.locked_at&&SCOPE_GUARDED_MERMAID_STEPS.includes(mermaidSid)){try{await runScopeCheck(mermaidSid);}catch(e2){console.warn('[C1] runDiagramStep 후 runScopeCheck 자동 실행 실패:',mermaidSid,e2.message);}}
  }catch(e){
    try{_lastGenError=(e&&e.message)||String(e);}catch(_e){}
    App.showToast(e.message,'error');
  }finally{
    loadingState[sid]=false;
    App.setButtonLoading(bid,false);
    setGlobalProcessing(false);
  }
}
// ═══ v11.0: 예시도/개념도 자동 감지 ═══
function autoDetectConceptDiagrams(){
  const claims=outputs.step_06||'';
  if(!claims)return;
  const detected=[];
  // UI/화면 관련 키워드
  if(/디스플레이|표시부|화면|인터페이스|터치\s*스크린|GUI|사용자\s*인터페이스/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='ui_screen'))
    detected.push('ui_screen');
  // 시나리오 키워드
  if(/사용자|단말|클라이언트|요청|응답|전송|수신/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='user_scenario'))
    detected.push('user_scenario');
  // 데이터 구조 키워드
  if(/데이터베이스|테이블|스키마|레코드|필드|저장부|DB|메모리/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='data_structure'))
    detected.push('data_structure');
  if(detected.length>0){
    detected.forEach(typeKey=>{
      const typeDef=CONCEPT_DIAGRAM_TYPES[typeKey];
      conceptDiagramTypes.push({type:typeKey,title:typeDef.label,figNum:0,figNumOverride:0,svgContent:'',refNums:[]});  // ③ figNumOverride:0=자동(순서 지정 시 도 번호)
    });
    conceptDiagramCount=conceptDiagramTypes.length;
    renderConceptDiagramTypesList();
    App.showToast(`예시도 ${detected.length}종 자동 추천: ${detected.map(k=>CONCEPT_DIAGRAM_TYPES[k].label).join(', ')}`,'info');
  }
}

// ═══ v11.0: 예시도/개념도 AI 생성 ═══
async function runConceptDiagramStep(){
  if(!conceptDiagramTypes.length){App.showToast('예시도 유형을 추가하세요','error');return;}
  if(!outputs.step_06){App.showToast('장치 청구항(Step 6)을 먼저 생성하세요','error');return;}
  if(globalProcessing)return;
  setGlobalProcessing(true);
  const bid='btnStep07c';
  loadingState.step_07c=true;App.setButtonLoading(bid,true);

  try{
    const cFigNums=getAutoFigNums('step_07c');
    const count=conceptDiagramTypes.length;
    const figNums=cFigNums.slice(0,count);
    const typeDescs=conceptDiagramTypes.map((ct,i)=>{
      const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
      return `도 ${figNums[i]||'?'}: ${td.label}`;
    }).join(', ');

    App.showProgress('progressStep07c','예시도 생성 중...',1,2);

    const prompt=`특허 도면 전문가로서, 아래 발명의 예시도/개념도를 SVG 코드로 직접 생성하라.

${CONCEPT_PURPOSE_RULES}

⛔⛔⛔ 절대 금지 사항 (위반 시 도면 전체 거부) ⛔⛔⛔
1. 박스(사각형) + 화살표로 구성된 블록도/플로우차트 형태 절대 금지
2. "~부", "~모듈", "~엔진" 같은 기능 구성요소명을 박스 라벨로 사용 금지
3. 색상 사용 금지 — 오직 흑색 선(stroke="#000" 또는 "#333")만 허용
4. 영문자 접미사가 붙은 참조번호(83a, 92b 등) 금지
5. 장치 블록도(도 1~N)와 동일한 구성을 반복 금지

✅ 예시도가 반드시 가져야 할 요소 (유형별)
- 화면 구성도: 실제 모바일/PC 화면 모양(둥근 모서리 사각형에 UI 요소들)
- 사용 시나리오도: 스틱 피겨(사람), 말풍선, 손 제스처, 물리적 장면
- 장치 외관도: 디바이스의 물리적 외형(스마트폰, 웨어러블, 센서 등)
- 동작 설명도: 물리적 메타포(깔때기, 저울, 바구니, 타임라인 등)
- 데이터 구조도: 테이블 형식(행/열), 필드명과 예시값

═══ 시각적 어휘 (반드시 이 중에서 선택) ═══
□ 사람: 원(머리) + 선(몸/팔/다리)으로 스틱 피겨
□ 화면: 둥근 사각형(rx=8) + 내부 UI 요소(버튼, 리스트, 입력창)
□ 말풍선: 둥근 사각형 + 삼각형 꼬리
□ 디바이스: 스마트폰(세로 둥근 사각형), 스피커(원통), 센서(작은 원)
□ 데이터 테이블: 격자(행+열), 헤더 강조
□ 화살표: 동작의 방향이나 데이터 이동 (최소 사용)
□ 아이콘: 원 안의 간단한 기호 (♪, ♡, ⚙, 📷 등의 기하학적 표현)

═══ SVG 기술 규칙 ═══
1. viewBox="0 0 680 500" (너비 680 고정)
2. 배경 투명, stroke="#000" fill="none" (필요시 fill="#fff" 허용)
3. stroke-width: 본체 0.8~1.5, 리더라인 0.5
4. 폰트: font-family="Malgun Gothic,sans-serif"
5. 텍스트: 제목 14px, 라벨 12px, 참조번호 11px
6. 참조번호 표기: 리더라인(얇은 선) + 숫자 (예시도 전용: 31~99 범위)
7. ★ 제목(【도 N】)은 코드가 자동으로 삽입하므로 ★SVG에 도면 제목 텍스트를 넣지 마라★ (넣어도 코드가 올바른 번호로 교체한다). 상단은 도면 내용을 위해 비워 둬라.
8. 마커(화살표)는 최소한만 사용 — 시각적 장면이 핵심

${CONCEPT_OVERLAP_RULES}

═══ 유형별 구체 지시 ═══

[화면 구성도 선택 시]
- 스마트폰 외곽(세로 둥근 사각형 320×500 등) 그리고 내부에 화면 구성
- 상단바, 앱 타이틀, 메인 콘텐츠 영역, 하단 탭바 등
- 버튼/입력창/리스트는 실제 UI처럼 그려라
- 블록도처럼 "기능 박스"를 나열하지 마라

[사용 시나리오도 선택 시]
- 스틱 피겨 사용자 1~2명
- 디바이스(스마트폰/스피커 등)
- 말풍선이나 동작 표현(점선 화살표, 파동선)
- 장면이 하나의 "순간"을 보여줘야 함

[데이터 구조도 선택 시]
- 격자 형태의 테이블
- 헤더: "필드명" / 바디: "예시값"
- 여러 레코드 예시 표시

═══ 발명 정보 ═══
발명의 명칭: ${selectedTitle}

═══ 도면 요청 ═══
도면 수: ${count}개 (${figNums.map(n=>'도 '+n).join(', ')})
유형: ${typeDescs}

═══ 청구범위 (★ 이 예시도가 시각화할 구성을 특정해 도면에 반드시 담아라 — 블록도 복제만 금지) ═══
${outputs.step_06?.slice(0,2000)||''}

═══ 출력 형식 (정확히 따르라 — 각 도면: SVG + 간단설명 + 요소맵) ═══
---CONCEPT_FIG_${figNums[0]}---
<svg viewBox="0 0 680 500" xmlns="http://www.w3.org/2000/svg">
  <!-- 절대 블록+화살표 구조 금지, 시각적 장면 그려라 -->
</svg>
---BRIEF_DESC---
도 ${figNums[0]}은 ...를 나타내는 예시도이다.
---REF_MAP---
31: 에피소드 노드
32: 사용자 프로필 카드
${figNums.length>1?figNums.slice(1).map(n=>'\n---CONCEPT_FIG_'+n+'---\n<svg>...</svg>\n---BRIEF_DESC---\n도 '+n+'은 ...를 나타내는 예시도이다.\n---REF_MAP---\n31: 에피소드 노드\n32: 사용자 프로필 카드').join(''):''}
★ REF_MAP 필수(§6-6): 각 참조번호(31~99)가 도면에서 실제로 가리키는 구체적 요소의 "고유 한국어 이름"을 "번호: 이름"으로 빠짐없이 적어라(부호의 설명·상세설명이 이 이름을 그대로 사용한다).
⛔ "데이터 구조 요소"·"UI 화면 요소" 같은 유형 총칭을 번호마다 반복하지 마라 — 각 요소의 개별 명칭(예: 에피소드 노드, 사용자 프로필 카드, 추천 랭킹표)을 서로 다르게 써라(총칭 나열은 부호↔명칭 대응을 상실시킨다).
⛔ 서수(제1/제2/제N)+총칭 조합도 금지("제1 UI 화면 요소" 등 — 총칭 반복의 우회일 뿐이다). 각 번호는 요소의 실제 내용을 나타내는 고유 명칭(예: 대본 입력 패널, 라우팅 결과 카드, 승인 버튼)이어야 하며, 실명을 특정할 수 없으면 해당 번호의 라벨을 비워 두라(빈 라벨은 시스템이 처리한다).

⛔ 자체 검증 — SVG 출력 전 아래를 확인하라:
1. stroke에 "#" 뒤에 0, 3 이외의 숫자가 있는가? → 있으면 흑백으로 수정
2. <rect>가 5개 이상이고 텍스트가 "~부"로 끝나는가? → 블록도임, 다시 그려라
3. 참조번호에 a, b, c, d, e가 포함되는가? → 제거하고 순수 숫자만 사용
4. 이 도면이 step_07 블록도와 차별화되는가? → 아니면 다시 그려라
5. ★ 부호 리더선/연결선이 다른 박스·텍스트·선과 겹치거나 가로지르는가? 요소·텍스트가 서로 겹치는가? → 있으면 경로·좌표를 수정해 겹침을 제거하고 다시 그려라`;

    const r=await App.callClaude(prompt,16384);
    const fullText=r.text||'';

    App.showProgress('progressStep07c','예시도 파싱 중...',2,2);

    // ★ P2/P3 공유 파서 — 마커별 SVG/BRIEF/REF_MAP(번호↔이름) 추출, 참조번호 31~99 통일(메인·캐스케이드 일관).
    _parseConceptResult(fullText, conceptDiagramTypes, figNums);
    _syncConceptRefNums();   // ★ 식별번호 도 번호 연동(도 N → N0번대) — refMap·SVG·step_07c 정합

    // 결과 저장 — refMap 의 "이름(번호)" 포함(부호의 설명·상세설명 정밀 참조).
    pushOutputHistory('step_07c','llm','runConceptDiagramStep');
    outputs.step_07c=_buildConceptOutputText(conceptDiagramTypes, figNums);
    markOutputTimestamp('step_07c');
    // ★ [A] 예시도 생성 = 명세서 반영 의사 → 발명의 설명·부호의 설명에 자동 반영(APPEND, 기존 본문 보존).
    //   (종전: invalidateDownstream 으로 stale 배지만 띄움 → 수동 옵트인이라 도4·5 누락. 이제 생성 즉시 자동 반영.)
    const _refl=reflectConceptsToSpec();   // ★ [B2] 부호의 설명(step_18)만 보강(발명의 설명 APPEND 은퇴 — 예시도 설명은 step_08c 담당)
    if(outputs.step_18)renderOutput('step_18',outputs.step_18);
    onStepCompleted('step_07c');
    if(_refl.ref)App.showToast(`예시도 부호 ${_refl.ref}건 부호의 설명에 반영`,'info');

    renderConceptDiagramCards();
    saveProject(true);
    // ★ [C] 생성 직후 비전 자동 정련 1회(겹침 안전망) — App.callVision 있을 때만(가드), 1회만(비용·루프 제한).
    try{ if(App&&typeof App.callVision==='function'){ App.showProgress('progressStep07c','겹침 자동 정련 중...',2,2); await Patent.refineAllConceptDiagrams({maxRounds:1}); } }catch(_e){}
    App.clearProgress('progressStep07c');
    App.showToast(`예시도 ${conceptDiagramTypes.length}종 생성 완료`);
  }catch(e){
    App.showToast(e.message,'error');
  }finally{
    loadingState.step_07c=false;
    App.setButtonLoading(bid,false);
    setGlobalProcessing(false);
  }
}

async function runBatch25(){
  if(globalProcessing)return;
  if(!selectedTitle){App.showToast('명칭 먼저 확정','error');return;}
  setGlobalProcessing(true);loadingState.batch25=true;App.setButtonLoading('btnBatch25',true);
  document.getElementById('resultsBatch25').innerHTML='';
  
  try{
    // ═══ API 효율화: step_02/03/04 병렬 실행 (v5.5) ═══
    App.showProgress('progressBatch','기본 항목 병렬 생성 중 (1/2)',1,2);
    
    const [r02,r03,r04]=await Promise.all([
      App.callClaude(buildPrompt('step_02')),
      App.callClaude(buildPrompt('step_03')),
      searchPriorArt(selectedTitle)
    ]);
    
    pushOutputHistory('step_02','llm','runBatch25');
    outputs.step_02=r02.text;markOutputTimestamp('step_02');
    renderBatchResult('resultsBatch25','step_02',r02.text);

    pushOutputHistory('step_03','llm','runBatch25');
    outputs.step_03=r03.text;markOutputTimestamp('step_03');
    renderBatchResult('resultsBatch25','step_03',r03.text);

    pushOutputHistory('step_04','llm','runBatch25');
    if(r04){outputs.step_04=r04.formatted;renderBatchResult('resultsBatch25','step_04',r04.formatted);}
    else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderBatchResult('resultsBatch25','step_04',outputs.step_04);}
    markOutputTimestamp('step_04');

    // step_05는 step_03에 의존하므로 순차 실행
    App.showProgress('progressBatch','해결하고자 하는 과제 (2/2)',2,2);
    const r05=await App.callClaude(buildPrompt('step_05'));
    pushOutputHistory('step_05','llm','runBatch25');
    outputs.step_05=r05.text;markOutputTimestamp('step_05');
    renderBatchResult('resultsBatch25','step_05',r05.text);
    
    App.clearProgress('progressBatch');
    saveProject(true);App.showToast('기본 항목 완료 (병렬 처리)');
  }catch(e){App.clearProgress('progressBatch');App.showToast(e.message,'error');}
  finally{loadingState.batch25=false;App.setButtonLoading('btnBatch25',false);setGlobalProcessing(false);}
}
// ★ Bug1 수정: "마무리 일괄생성"이 후반부 전체를 역설계 의존 순서로 생성.
//   기존: [16,17,18,19]만 생성 → 02/03/04/05 누락 + 효과(16)가 해결수단(17)보다 먼저 생성되어 맥락 부실.
//   수정: 해결수단(17)→과제(05)→효과(16)/배경(03)→기술분야(02)→부호(18)→요약(19) + 선행기술(04) 검색.
//   각 단계는 _cascadeRender로 올바른 컨테이너(resultsBatch25/resultsBatchFinish)에 자동 라우팅.
async function runBatchFinish(){
  if(globalProcessing)return;
  if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}
  setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);
  // 의존 순서: 해결수단→과제→효과→배경→기술분야→부호→요약
  const steps=['step_17','step_05','step_16','step_03','step_02','step_18','step_19'];
  const total=steps.length+1; // +선행기술 검색
  try{
    // 선행기술(04)이 비어 있으면 KIPRIS 검색으로 보충
    if(!outputs.step_04&&selectedTitle){
      App.showProgress('progressBatchFinish','선행기술 검색 중 (1/'+total+')',1,total);
      try{const sr=await searchPriorArt(selectedTitle);outputs.step_04=sr?sr.formatted:'【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';pushOutputHistory('step_04','llm','runBatchFinish');markOutputTimestamp('step_04');_cascadeRender('step_04',outputs.step_04);}catch(e){console.warn('[runBatchFinish] 선행기술 검색 실패',e);}
    }
    for(let i=0;i<steps.length;i++){
      const sid=steps[i];
      App.showProgress('progressBatchFinish',`${STEP_NAMES[sid]} (${i+2}/${total})`,i+2,total);
      const prompt=buildPrompt(sid);
      if(!prompt)continue;
      const r=await App.callClaude(prompt);
      pushOutputHistory(sid,'llm','runBatchFinish');
      outputs[sid]=r.text;markOutputTimestamp(sid);
      _cascadeRender(sid,r.text);
    }
    App.clearProgress('progressBatchFinish');saveProject(true);
    App.showToast('마무리 완료 (해결수단→과제→효과→배경→기술분야→부호→요약)');
  }catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}
  finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}
}

// ═══ v14: Phase 기반 배치 실행 (역설계 체인) ═══

// Phase D: 역설계 체인 (해결수단→과제→효과→배경기술→기술분야)
async function runPhaseD(){
  if(globalProcessing)return;
  if(!outputs.step_06){App.showToast('장치 청구항(A2)을 먼저 작성하세요','error');return;}
  setGlobalProcessing(true);
  const btn=document.getElementById('btnPhaseD');
  if(btn){btn.disabled=true;btn.textContent='<span class="ico" data-icon="history"></span> 역설계 진행 중...';}
  const container=document.getElementById('resultsPhaseDChain');
  if(container)container.innerHTML='';
  
  // ★ Bug1 수정: 역설계 의존 순서 — 해결수단(17)이 과제(05)·효과(16)보다 먼저 생성돼야 맥락이 맞음
  const steps=['step_17','step_05','step_16','step_03','step_02'];
  const stepLabels={step_17:'D1. 해결 수단',step_05:'D2. 과제',step_16:'D3. 효과',step_03:'D4. 배경기술',step_02:'D5. 기술분야'};
  
  try{
    for(let i=0;i<steps.length;i++){
      const sid=steps[i];
      App.showProgress('progressPhaseD',`${stepLabels[sid]} (${i+1}/${steps.length})`,i+1,steps.length);
      const r=await App.callClaude(buildPrompt(sid));
      pushOutputHistory(sid,'llm','runPhaseD');
      outputs[sid]=r.text;
      markOutputTimestamp(sid);
      if(container)renderBatchResult('resultsPhaseDChain',sid,r.text);
    }
    App.clearProgress('progressPhaseD');
    saveProject(true);
    App.showToast('<span class="ico" data-icon="check-circle"></span> 역설계 체인 완료 (효과→과제→해결수단→배경→기술분야)');
  }catch(e){
    App.clearProgress('progressPhaseD');
    App.showToast(e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='<span class="ico" data-icon="refresh"></span> 역설계 체인 일괄 생성';}
    setGlobalProcessing(false);
  }
}

// Phase F: 마무리 (부호+요약서)
async function runPhaseF(){
  if(globalProcessing)return;
  if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}
  setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);
  document.getElementById('resultsBatchFinish').innerHTML='';
  const steps=['step_18','step_19'];
  try{
    for(let i=0;i<steps.length;i++){
      App.showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/${steps.length})`,i+1,steps.length);
      const r=await App.callClaude(buildPrompt(steps[i]));
      pushOutputHistory(steps[i],'llm','runPhaseF');
      outputs[steps[i]]=r.text;markOutputTimestamp(steps[i]);
      renderBatchResult('resultsBatchFinish',steps[i],r.text);
    }
    App.clearProgress('progressBatchFinish');
    saveProject(true);App.showToast('<span class="ico" data-icon="check-circle"></span> 마무리 완료 (F1→F2)');
  }catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}
  finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}
}


// ═══════════ PROVISIONAL APPLICATION (가출원) ═══════════
async function openProvisionalModal(){
  document.getElementById('provisionalInput').value='';
  // 다음 사건번호 자동 생성 (가출원)
  const numInput=document.getElementById('provisionalProjectNumber');
  if(numInput){
    try{
      const{data}=await App.sb.from('projects').select('project_number').eq('owner_user_id',currentUser.id).not('project_number','is',null).order('created_at',{ascending:false}).limit(50);
      let nextNum=1;
      if(data?.length){
        const nums=data.map(p=>{
          const pn=p.project_number||'';
          const match=pn.match(/^26P(\d{4})$/);
          return match?parseInt(match[1],10):0;
        }).filter(n=>n>0);
        if(nums.length)nextNum=Math.max(...nums)+1;
      }
      numInput.value=String(nextNum).padStart(4,'0');
    }catch(e){numInput.value='0001';}
  }
  document.getElementById('provisionalModal').style.display='flex';
}
function closeProvisionalModal(){document.getElementById('provisionalModal').style.display='none';}
async function runProvisionalApplication(){
  const inv=document.getElementById('provisionalInput').value.trim();
  if(!inv){App.showToast('발명 내용을 입력해 주세요','error');return;}
  if(!App.ensureApiKey()){App.openProfileSettings();return;}
  if(globalProcessing)return;
  setGlobalProcessing(true);App.setButtonLoading('btnProvisionalGen',true);
  try{
    App.showProgress('progressProvisional','가출원 명세서 생성 중... (1/3)',1,3);
    const r1=await App.callClaudeSonnet(`가출원 명세서를 작성하라. 전체 문서가 4000단어를 넘지 않도록 간결하게 작성하라.

[구성]
1. 발명의 명칭: 국문 1개 + 영문 1개 ("~${getDeviceSubject()}" 형태)
2. 기술분야: 1문장
3. 해결하고자 하는 과제: 2~3문장
4. 과제의 해결 수단: 3~5문장
5. 독립항 1개: 핵심 구성요소만 포함한 ${getDeviceSubject()} 청구항
6. 도면 1개: 시스템 블록도 (구성요소+참조번호+연결관계)
7. 상세설명: 도면 참조하여 각 구성요소 기능 설명 (2000자 이내)
8. 발명의 효과: 2~3문장
9. 요약서: 100단어

[규칙]
- 표준문체(~한다), 글머리/마크다운 금지
- 구성요소(참조번호) 형태
- SW명 대신 알고리즘
- 제한성 표현 금지
- 총 4000단어 이내로 간결하게

[도면 참조번호 규칙 — 필수 준수]
- L1 (최상위): X00 형식 — ${getDeviceSubject()}(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400)
- L2 (하위 구성): XY0 형식 — 통신부(110), 프로세서(120), 메모리(130)...
- L3 (하위 요소): XYZ 형식 — 수신부(111), 송신부(112)...
- 부모 접두(prefix) 유지: 자식은 부모의 앞자리를 반드시 유지
- "~단계", "S숫자" 등 방법 표현은 도면에 포함 금지 (이것은 장치 도면)

[출력 형식]
===명칭===
(국문 명칭)
===영문명칭===
(영문 명칭)
===기술분야===
(내용)
===과제===
(내용)
===해결수단===
(내용)
===청구항===
【청구항 1】
(내용)
===도면설계===
(도면 설명: 구성요소, 참조번호, 연결 관계 포함)
===상세설명===
(내용)
===효과===
(내용)
===요약===
(내용)

[발명 내용]
${inv}`,8192);

    App.showProgress('progressProvisional','도면 Mermaid 변환 중... (2/3)',2,3);
    const text=r1.text;
    const getSection=(key)=>{const re=new RegExp('==='+key+'===\\s*\\n([\\s\\S]*?)(?====|$)');const m=text.match(re);return m?m[1].trim():'';};
    const title=getSection('명칭');const titleEn=getSection('영문명칭');
    const techField=getSection('기술분야');
    const problem=getSection('과제');const solution=getSection('해결수단');
    const claim=getSection('청구항');const diagram=getSection('도면설계');
    const desc=getSection('상세설명');const effect=getSection('효과');
    const abstract=getSection('요약');

    // Generate Mermaid code for PPTX diagram
    let provisionalDiagramData=null;
    try{
      const mermaidR=await App.callClaudeSonnet(`아래 도면 설계를 Mermaid flowchart 코드로 변환하라. \`\`\`mermaid 블록 1개.
규칙: graph TD, 한글 라벨, 노드ID 영문. 서브그래프 사용 가능. style/linkStyle 금지.

⛔ 장치 도면 규칙:
- 노드 라벨에 반드시 참조번호 포함: "통신부(110)", "프로세서(120)"
- 참조번호는 숫자만 사용 (100, 110, 120...)
- "~단계", "S숫자" 표현 절대 금지
- 구성요소명은 반드시 "~부" 형태만 사용 ("~모듈", "~유닛" 절대 금지)

${diagram}`,4096);
      const blocks=extractMermaidBlocks(mermaidR.text);
      if(blocks.length){
        provisionalDiagramData=blocks.map(code=>{const{nodes,edges}=parseMermaidGraph(code);return{nodes,edges,positions:layoutGraph(nodes,edges)};});
      }
    }catch(e){/* PPTX generation is optional */}

    App.showProgress('progressProvisional','Word + PPTX 생성 및 저장 중... (3/3)',3,3);

    // v4.9: Save provisional to DB with project_number
    const numInput=document.getElementById('provisionalProjectNumber');
    const numVal=numInput?numInput.value.trim():'';
    const projectNumber=numVal&&/^\d{4}$/.test(numVal)?'26P'+numVal:null;
    
    const provisionalData={title,titleEn,techField,problem,solution,claim,diagram,desc,effect,abstract};
    try{
      await App.sb.from('projects').insert({
        owner_user_id:currentUser.id,
        title:`[가출원] ${title||'초안'}`,
        project_number:projectNumber,
        invention_content:inv,
        current_state_json:{type:'provisional',provisionalData,usage:{calls:usage.calls,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,cost:usage.cost}}
      });
    }catch(e){console.error('Provisional save error:',e);}

    // Generate Word with English title
    const titleLine=titleEn?`${title}{${titleEn}}`:(title||'');
    const secs=[
      {h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:techField},
      {h:'발명의 내용'},{h:'해결하고자 하는 과제',b:problem},
      {h:'과제의 해결 수단',b:solution},{h:'발명의 효과',b:effect},
      {h:'도면의 간단한 설명',b:diagram?`도 1은 ${title}의 구성을 나타내는 블록도이다.`:''},
      {h:'발명을 실시하기 위한 구체적인 내용',b:desc},
      {h:'청구범위',b:claim},
      {h:'요약서',b:abstract?`【요약】\n${abstract}\n\n【대표도】\n도 1`:''},
    ];
    const html=secs.map(s=>{
      const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;
      const body=_stripDupHeader(s.b,s.h);
      if(!body)return hd;
      return hd+body.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${App.escapeHtml(l.trim())}</p>`).join('');
    }).join('');
    const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));
    a.download=`가출원_${title||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();

    // Generate PPTX diagram — KIPO 규칙 v2.1 - 페이지 내 맞춤
    let pptxGenerated=false;
    if(provisionalDiagramData&&provisionalDiagramData.length){
      try{
        const pptx=new PptxGenJS();
        pptx.defineLayout({name:'A4_PORTRAIT',width:8.27,height:11.69});
        pptx.layout='A4_PORTRAIT';
        
        // 선 굵기 상수 (KIPO 기준)
        const LINE_FRAME=2.0, LINE_BOX=1.5, LINE_ARROW=1.0, SHADOW_OFFSET=0.025;
        const PAGE_MARGIN=0.6;
        const PAGE_W=8.27-PAGE_MARGIN*2;
        const PAGE_H=11.69-PAGE_MARGIN*2;
        const TITLE_H=0.5;
        const AVAILABLE_H=PAGE_H-TITLE_H-0.3;
        
        provisionalDiagramData.forEach(({nodes,edges,positions},idx)=>{
          const slide=pptx.addSlide({bkgd:'FFFFFF'});
          const figNum=idx+1;
          
          // 도면 번호
          slide.addText(`도 ${figNum}`,{x:PAGE_MARGIN,y:PAGE_MARGIN,w:2,h:TITLE_H,fontSize:14,bold:true,fontFace:'맑은 고딕',color:'000000'});
          if(!nodes.length)return;
          
          // 노드 수에 따라 동적 스케일링
          const nodeCount=nodes.length;
          const frameX=PAGE_MARGIN;
          const frameY=PAGE_MARGIN+TITLE_H;
          const frameW=PAGE_W-0.8;
          // 참조번호 추출 함수
          function extractRefNum(label,fallback){
            const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
            return match?match[1]:fallback;
          }
          
          // 외곽 프레임 참조번호 추출
          let frameRefNum=figNum*100;
          if(nodes.length>0){
            const firstRef=extractRefNum(nodes[0].label,'');
            if(firstRef&&!firstRef.startsWith('S')){
              const num=parseInt(firstRef);
              if(num>=100) frameRefNum=Math.floor(num/100)*100;
            }
          }
          
          // ★ 2D 레이아웃 적용 (L1 노드 제외) ★
          const batchInnerNodes=nodes.filter(n=>{
            const ref=extractRefNum(n.label,'');
            if(!ref)return true;
            if(parseInt(ref)===frameRefNum)return false;
            if(_isL1RefNum(ref))return false;
            return true;
          });
          const batchDisplayNodes=batchInnerNodes.length>0?batchInnerNodes:nodes;
          const batchLayout=computeDeviceLayout2D(batchDisplayNodes,edges,figNum);
          const{grid:batchGrid,maxCols:batchMaxCols,numRows:batchNumRows,uniqueEdges:batchUniqueEdges}=batchLayout;
          
          // ═══ v8.0: 충돌 방지 기반 레이아웃 상수 ═══
          const PPTX_FRAME_PAD_X=0.45; // 인치: 프레임↔박스 여백
          const PPTX_FRAME_PAD_Y=0.35;
          const PPTX_BOX_GAP_X=0.35;   // 박스 간 수평 간격
          const PPTX_BOX_GAP_Y=0.30;   // 박스 간 수직 간격
          const PPTX_LEADER_W=0.35;    // 리더라인 공간
          
          const pptxContentW=frameW-PPTX_FRAME_PAD_X*2;
          const batchBoxW=batchMaxCols<=1?Math.min(pptxContentW,4.0):
            batchMaxCols===2?(pptxContentW-PPTX_BOX_GAP_X)/2:
            (pptxContentW-PPTX_BOX_GAP_X*2)/3;
          const batchNodeAreaW=batchMaxCols*batchBoxW+(batchMaxCols-1)*PPTX_BOX_GAP_X;
          const boxH=Math.min(0.65,(AVAILABLE_H-PPTX_FRAME_PAD_Y*2-PPTX_BOX_GAP_Y*(batchNumRows-1))/batchNumRows);
          // v8.0: tight-fit frame height (선언 후 계산)
          const frameH=batchNumRows*boxH+(batchNumRows>1?(batchNumRows-1)*PPTX_BOX_GAP_Y:0)+PPTX_FRAME_PAD_Y*2;
          const boxStartX=frameX+PPTX_FRAME_PAD_X;
          const boxStartY=frameY+PPTX_FRAME_PAD_Y;
          const batchColGap=PPTX_BOX_GAP_X;
          const refLabelX=frameX+frameW+0.1;
          
          // 외곽 프레임 (테두리만)
          slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
          // 프레임 리더라인은 내부 노드와 함께 겹침 보정 후 렌더링
          
          // 내부 구성요소 박스들 (2D 배치)
          const batchNodeBoxes={};
          batchDisplayNodes.forEach((n,i)=>{
            const gp=batchGrid[n.id];
            if(!gp)return;
            const rowW=gp.layerSize*batchBoxW+(gp.layerSize-1)*batchColGap;
            const rowStartX=boxStartX+(batchNodeAreaW-rowW)/2;
            const bx=rowStartX+gp.col*(batchBoxW+batchColGap);
            const by=boxStartY+gp.row*(boxH+PPTX_BOX_GAP_Y);
            // 참조번호 추출
            const fallbackRef=frameRefNum+10*(i+1);
            const refNum=extractRefNum(n.label,String(fallbackRef));
            const cleanLabel=n.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
            const shapeType=matchIconShape(n.label);
            const sm=_shapeMetrics(shapeType,batchBoxW,boxH);
            // v10.3: 텍스트 너비 기반 최소 shape 너비 (PPTX batch - 인치)
            const _bfs=Math.min(11,Math.max(8,13-nodes.length*0.35));
            const _btw=cleanLabel.length*(_bfs/72)*0.65;
            const _bmsw=_btw+0.25;
            if(sm.sw<_bmsw&&shapeType!=='box'){
              sm.sw=Math.min(_bmsw,batchBoxW*0.85);
              sm.dx=(batchBoxW-sm.sw)/2;
            }
            const SO=SHADOW_OFFSET;
            const sx=bx+sm.dx;
            // Shape-aware 렌더링 (natural proportions)
            switch(shapeType){
              case 'database':{
                const shp=pptx.shapes.CAN||pptx.shapes.RECTANGLE;
                slide.addShape(shp,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(shp,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'cloud':{
                const shp=pptx.shapes.CLOUD||pptx.shapes.OVAL;
                slide.addShape(shp,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(shp,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'server':{
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                const h3=sm.sh/3;
                slide.addShape(pptx.shapes.LINE,{x:sx,y:by+h3,w:sm.sw,h:0,line:{color:'000000',width:LINE_BOX*0.5}});
                slide.addShape(pptx.shapes.LINE,{x:sx,y:by+2*h3,w:sm.sw,h:0,line:{color:'000000',width:LINE_BOX*0.5}});
                break;
              }
              case 'monitor':{
                const msh=sm.sh*0.75;
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:msh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:msh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX},rectRadius:2});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw/2-sm.sw*0.06,y:by+msh,w:sm.sw*0.12,h:sm.sh*0.15,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.5}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw/2-sm.sw*0.13,y:by+msh+sm.sh*0.15,w:sm.sw*0.26,h:sm.sh*0.05,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.5}});
                break;
              }
              case 'sensor':{
                const scr=Math.min(sm.sw*0.28,sm.sh*0.38);
                const scx=sx+sm.sw*0.32-scr, scy=by+sm.sh*0.50-scr;
                slide.addShape(pptx.shapes.OVAL,{x:scx+SO,y:scy+SO,w:scr*2,h:scr*2,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.OVAL,{x:scx,y:scy,w:scr*2,h:scr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                const sdr=scr*0.25;
                slide.addShape(pptx.shapes.OVAL,{x:sx+sm.sw*0.32-sdr,y:by+sm.sh*0.50-sdr,w:sdr*2,h:sdr*2,fill:{color:'000000'},line:{width:0}});
                break;
              }
              case 'antenna':{
                const apoleX=sx+sm.sw*0.38;
                const abw=sm.sw*0.22, abh=sm.sh*0.10;
                slide.addShape(pptx.shapes.RECTANGLE,{x:apoleX-abw/2,y:by+sm.sh*0.82,w:abw,h:abh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.LINE,{x:apoleX,y:by+sm.sh*0.18,w:0,h:sm.sh*0.64,line:{color:'000000',width:LINE_BOX*1.2}});
                const abr=Math.min(sm.sw*0.04,sm.sh*0.04);
                slide.addShape(pptx.shapes.OVAL,{x:apoleX-abr,y:by+sm.sh*0.18-abr,w:abr*2,h:abr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'document':{
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'camera':{
                const ccbx=sx+sm.sw*0.05,ccby=by+sm.sh*0.18,ccbw=sm.sw*0.80,ccbh=sm.sh*0.65;
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx+SO,y:ccby+SO,w:ccbw,h:ccbh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx,y:ccby,w:ccbw,h:ccbh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx+ccbw*0.30,y:ccby-sm.sh*0.10,w:ccbw*0.25,h:sm.sh*0.12,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.6}});
                const clr=Math.min(ccbw,ccbh)*0.30;
                slide.addShape(pptx.shapes.OVAL,{x:ccbx+ccbw*0.50-clr,y:ccby+ccbh*0.52-clr,w:clr*2,h:clr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'speaker':{
                const bspw=sm.sw*0.18,bsph=sm.sh*0.40;
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw*0.10,y:by+sm.sh*0.30,w:bspw,h:bsph,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw*0.28,y:by+sm.sh*0.12,w:sm.sw*0.28,h:sm.sh*0.76,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              default:
                slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SO,y:by+SO,w:batchBoxW,h:boxH,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:bx,y:by,w:batchBoxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
            }
            // 박스 텍스트 + 참조번호 (내부 2줄)
            const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
            const bFontSize=Math.min(batchMaxCols>1?9:11,Math.max(8,12-nodeCount*0.3));
            slide.addText([{text:cleanLabel,options:{fontSize:bFontSize,breakType:'none'}},{text:'\n('+refNum+')',options:{fontSize:Math.max(bFontSize-1,7),color:'444444'}}],{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
            
            batchNodeBoxes[n.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
          });
          
          // ★ 프레임 참조번호만 외부 리더라인으로 표시 ★
          const batchFrameLeaderY=frameY+frameH/2;
          slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:batchFrameLeaderY,w:0.25,h:0,line:{color:'000000',width:LINE_ARROW}});
          slide.addText(String(frameRefNum),{x:refLabelX+0.25,y:batchFrameLeaderY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
          // ★ Edge 기반 연결선 ★
          const batchEdges=batchUniqueEdges.length>0?batchUniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
          batchEdges.forEach(e=>{
            const fb=batchNodeBoxes[e.from],tb=batchNodeBoxes[e.to];
            if(!fb||!tb)return;
            const pts=getConnectionPoints(fb,tb);
            if(!pts)return;
            const dx=pts.x2-pts.x1,dy=pts.y2-pts.y1;
            if(Math.abs(dx)<0.01){
              slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,pts.y2),w:0,h:Math.abs(dy),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }else if(Math.abs(dy)<0.01){
              slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:pts.y1,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }else{
              const midY=(pts.y1+pts.y2)/2;
              slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,midY),w:0,h:Math.abs(pts.y1-midY),line:{color:'000000',width:LINE_ARROW}});
              slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:midY,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW}});
              slide.addShape(pptx.shapes.LINE,{x:pts.x2,y:Math.min(midY,pts.y2),w:0,h:Math.abs(pts.y2-midY),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }
          });
        });
        const caseNum=selectedTitle||title||'가출원';
        await pptx.writeFile({fileName:`${caseNum}_도면_${new Date().toISOString().slice(0,10)}.pptx`});
        pptxGenerated=true;
      }catch(e){console.error('PPTX generation error:',e);}
    }

    App.clearProgress('progressProvisional');
    closeProvisionalModal();
    App.showToast(`가출원 명세서 저장 + Word 다운로드 완료${pptxGenerated?' + 도면 PPTX':''}: ${title}`);
    loadDashboardProjects(); // Refresh list to show new provisional
  }catch(e){App.clearProgress('progressProvisional');App.showToast(e.message,'error');}
  finally{App.setButtonLoading('btnProvisionalGen',false);setGlobalProcessing(false);}
}

// ═══════════════ [단일 풀컨텍스트 생성] 상세설명 + 부호 응집 생성 ═══════════════
// 장치 상세설명·방법 상세설명·부호의 설명을 "한 번의 컨텍스트"로 생성해 도면부호·용어 정합을 구조적으로 보장.
// 기존 20단계 흐름은 그대로 두고 A/B 대안으로 제공(비파괴 — 게이트 미통과·실패 시 기존 outputs 무손상).
// 센티넬 3블록(REFTABLE/DEVICE_DESC/METHOD_DESC) 파싱 + 결정론 커밋 게이트.
function parseCohesiveBundle(raw){
  const norm=String(raw||'').replace(/\r\n/g,'\n');
  // ★ [배치6 N1b] 파서 위생 — 추출된 내용 내부에 LLM이 에코한 센티넬 마커(<<<DEVICE_DESC>>> 등)를 결정론적으로 제거.
  //   마커는 구조(프로토콜) 토큰이라 정당한 본문일 수 없음 → 안전한 제거(내용 치환이 아니라 토큰 제거 — 자동치환 금지 원칙과 상충 없음).
  //   ⚠ 완전형 <<<[A-Z_]+>>> 만 제거 — 맨 END_ 토큰(END_TO_END 류 정당 영문 가능성)은 제거하지 않고 CHK-0(placeholder_residue)이 리포트.
  const _stripMk=function(s){ if(s==null)return null; return s.replace(/[ \t]*<<<[A-Z_]+>>>[ \t]*/g,' ').replace(/ {2,}/g,' ').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim(); };
  const grab=function(name){ const m=norm.match(new RegExp('^[ \\t]*<<<'+name+'>>>[ \\t]*$([\\s\\S]*?)^[ \\t]*<<<END_'+name+'>>>[ \\t]*$','m')); return m?_stripMk(m[1].trim()):null; };   // 마커 줄 선/후행 공백 허용(LLM 흔한 삽입 tolerance)
  const refBlock=grab('REFTABLE'), device=grab('DEVICE_DESC'), method=grab('METHOD_DESC');
  // ★ [배치9 D3] 마무리 흡수 — 효과·해결수단·요약을 동일 컨텍스트에서 수확(선택 블록 — 없으면 null, 게이트 무관).
  //   신규 마커도 grab→_stripMk 동일 위생 경로 통과(에코 마커 제거) + CHK-0(placeholder_residue) 안전망 적용.
  const solution=grab('SOLUTION'), effects=grab('EFFECTS'), abstractTxt=grab('ABSTRACT');
  const refMap=new Map(); const dupNums=[];
  (refBlock||'').split('\n').forEach(function(line){ const t=line.trim(); if(!t)return;
    if(/^\[장치부호\]/.test(t)||/^\[방법단계\]/.test(t))return;
    // ★ [배치7 N3] REF 범위 검증 — 장치 부호는 계약(C3)대로 2~4자리만 수용. 1자리 generic("(1) 시스템"~"(5) 저장 영역",
    //   docD 실측)은 refMap에 진입 못하게 결정론 차단 → step_18 직렬화·본문 대조에서 원천 배제(본문이 쓰면 notInTable 게이트).
    const mm=t.match(/^\(\s*(S\d{1,4}|\d{2,4})\s*\)\s*(.+?)\s*$/);
    if(mm){ const name=mm[2].replace(/^상기\s*/,'').replace(/^[:\s]+/,'').trim(); if(name.length>=2){ const num=mm[1]; if(refMap.has(num))dupNums.push(num); else refMap.set(num,name); } }
  });
  const bodyNums=new Set();
  [device,method].filter(Boolean).forEach(function(t){ let mm; const re=/\((\d{1,4})\)/g; while((mm=re.exec(t))!==null)bodyNums.add(mm[1]); });
  const defDevice=[...refMap.keys()].filter(function(n){return !n.startsWith('S');});
  const notInTable=[...bodyNums].filter(function(n){return !refMap.has(n);}).sort(function(a,b){return a-b;});
  const unusedRef=defDevice.filter(function(n){return !bodyNums.has(n);}).sort(function(a,b){return a-b;});
  // ★ deviceLeak: "단계적/단계별/단계에서/단계 없이" 형태론적 오탐 배제 — "하는 단계"+조사/문말 또는 "제N단계"·S### 만 방법누출로 판정. S 자릿수 1~4 확대.
  const deviceLeak=/하는\s*단계(?:이|가|를|은|는|와|과|;|,|\.|\s*$|\s+S\d)|제\s*\d+\s*단계|\bS\d{1,4}\b/.test(device||'');
  // ★ methodOk: "하는 단계" 단일 리터럴 강제 완화 — 단계/과정/스텝 어휘군 또는 S### 단계식별자 중 하나면 방법 극성 인정.
  const methodOk=method?(/하는\s*(?:단계|과정|스텝)/.test(method)||/\bS\d{1,4}\b/.test(method)):true;
  let dupCount=0; try{ if(typeof _dedupParagraphs==='function')dupCount=_dedupParagraphs((device||'')+'\n\n'+(method||'')).removed; }catch(_e){}
  return { device:device, method:method, refMap:refMap, solution:solution, effects:effects, abstract:abstractTxt,
    ok:{ hasRef:!!refBlock&&refMap.size>0, hasDevice:!!device, hasMethod:method!=null },
    report:{ notInTable:notInTable, unusedRef:unusedRef, dupNums:dupNums, deviceLeak:deviceLeak, methodOk:methodOk, dupCount:dupCount } };
}
// 완성본 검증기 지표 스냅샷(A/B 대조용).
function _specIssueCounts(){
  try{ const iss=validateSpecification(buildSpecification());
    return { refnum:iss.filter(function(i){return i.check==='refnum_consistency';}).length,
             dup:iss.filter(function(i){return i.check==='paragraph_duplicate'||i.check==='sentence_duplicate';}).length }; }
  catch(_e){ return {refnum:0,dup:0}; }
}
// ★ [배치15B-A6] 부호표(REFTABLE)만 지정 재요청 프롬프트 — 본문 수정 없이 부호 사전 블록 하나만 재생성.
function _buildRefTableRetryPrompt(deviceText, methodText){
  return `아래 상세설명 본문에 실제로 등장하는 모든 도면부호 (NN)에 대한 "부호 사전"만 출력하라. 본문은 절대 수정·재출력하지 마라.

[출력 형식 — 이 블록 하나만, 다른 텍스트 금지]
<<<REFTABLE>>>
[장치부호]
(100) 고유명칭
(110) 고유명칭
[방법단계]
(S100) 단계명
<<<END_REFTABLE>>>

[규칙]
- 본문에 실제 등장하는 (NN)만 포함(등장하지 않는 번호 금지, 등장하는데 누락 금지).
- 각 번호에 서로 다른 고유한 한국어 명칭(총칭·중복 금지). 하나의 번호=하나의 명칭.
- 장치부호는 2~4자리 숫자, 방법단계는 S+숫자. 번호·명칭 중복 금지.
- 방법 본문이 없으면 [방법단계] 구획을 생략하라.

[장치 상세설명]
${deviceText||''}

[방법 상세설명]
${methodText||'(없음)'}`;
}
async function runUnifiedCohesionGen(opts){
  if(!(opts&&opts.chained)&&typeof globalProcessing!=='undefined'&&globalProcessing){App.showToast('처리 중입니다','info');return;}
  if(!outputs.step_06){App.showToast('먼저 장치 청구항(A2)을 생성하세요','error');return;}
  if(!outputs.step_07){App.showToast('먼저 장치 도면(B1)을 생성하세요 — 도면부호 정합의 기준입니다','error');return;}
  const before=_specIssueCounts(); const hadMath=!!outputs.step_09;   // ★ 수학식(step_09) 존재 시 커밋 후 재삽입 필요 경고
  // ★ [배치9 D1] 수학식 인라인 모드 — 토글 on이면 프롬프트가 본문에 【수학식】을 직접 포함(C9 전환).
  const _mathInline=!!(typeof document!=='undefined'&&document.getElementById('chkUnifiedMath')?.checked);
  setGlobalProcessing(true); if(App.setButtonLoading)App.setButtonLoading('btnUnifiedGen',true);
  App.showProgress('progressUnifiedGen','통합 생성 중(단일 컨텍스트)... 긴 출력은 자동 이어쓰기됩니다',0,1);
  try{
    const raw=await App.callClaudeWithContinuation(buildPrompt('unified_cohesion'),'progressUnifiedGen');
    let r=parseCohesiveBundle(raw);
    // ★ [배치15B-A6] 필수 블록 누락 침묵 금지 — DEVICE_DESC는 있는데 REFTABLE(부호표)만 누락이면,
    //   전체 재생성이 아니라 "부호표만" 1회 지정 재요청 → 원 raw에 합성 후 재파싱(본문 보존). docE: 부호의 설명 공백→본문 26개 미정의.
    if(!r.ok.hasRef&&r.ok.hasDevice){
      App.showToast('부호표(REFTABLE) 누락 — 부호표만 지정 재요청합니다(본문 보존, 1회)','warning');
      try{
        const retry=await App.callClaudeWithContinuation(_buildRefTableRetryPrompt(r.device||'', r.method||''),'progressUnifiedGen');
        const merged=(retry||'')+'\n'+raw;   // 재요청 REFTABLE 블록을 앞에 → grab이 최초 매칭
        const r2=parseCohesiveBundle(merged);
        if(r2.ok.hasRef&&r2.ok.hasDevice)r=r2;   // 재요청 성공 → 진행
      }catch(e){ console.warn('[unified] reftable retry',e); }
    }
    if(!r.ok.hasRef||!r.ok.hasDevice){
      const _refMiss=(r.ok.hasDevice&&!r.ok.hasRef);
      try{_lastGenError=_refMiss?'부호표 누락 — ④ 재생성 필요':'REFTABLE/장치 상세설명 블록 누락';}catch(_e){}
      App.clearProgress('progressUnifiedGen');
      App.showToast(_refMiss?'부호표 재요청 실패 — ④ 본문 통합 재생성이 필요합니다(본문 보존)':'통합 생성 실패: REFTABLE/장치 상세설명 블록 누락 — 기존 내용 보존, 다시 시도하세요','error');
      console.warn('[unified] block missing',r.ok); return;
    }
    const rep=r.report, gate=[];
    if(rep.notInTable.length)gate.push('본문 미정의 부호 '+rep.notInTable.length+'개('+rep.notInTable.slice(0,6).join(', ')+')');
    if(rep.dupNums.length)gate.push('부호표 번호 중복 '+rep.dupNums.length+'개');
    if(rep.deviceLeak)gate.push('장치 상세설명에 방법표현 누출');
    if(!rep.methodOk)gate.push('방법 상세설명 극성 미충족');
    if(gate.length){ try{_lastGenError='게이트 미통과 — '+gate.join(' · ');}catch(_e){} App.clearProgress('progressUnifiedGen'); App.showToast('통합 생성 게이트 미통과(기존 내용 보존): '+gate.join(' · '),'error'); console.warn('[unified] gate fail',rep); return; }
    if(!(opts&&opts.chained)&&!confirm('통합 생성 결과로 장치 상세설명·방법 상세설명·부호의 설명을 대체합니다. 계속할까요?\n(이전 내용은 이력에 보존됩니다)')){ App.clearProgress('progressUnifiedGen'); return; }
    // ── 원자 커밋(3슬롯) ──
    pushOutputHistory('step_08','unified','runUnifiedCohesionGen');
    if(r.method&&outputs.step_10)pushOutputHistory('step_12','unified','runUnifiedCohesionGen');
    pushOutputHistory('step_18','unified','runUnifiedCohesionGen');
    let dev=r.device; try{if(typeof sanitizeDescFigureRefs==='function')dev=sanitizeDescFigureRefs(dev,'device');}catch(_e){}
    outputs.step_08=dev; outputs.step08_device=dev; markOutputTimestamp('step_08');
    if(r.method&&outputs.step_10){ let m=r.method; try{if(typeof sanitizeDescFigureRefs==='function')m=sanitizeDescFigureRefs(m,'method');}catch(_e){} outputs.step_12=m; markOutputTimestamp('step_12'); }
    outputs.step_18=_deriveSignDescription(r.refMap); markOutputTimestamp('step_18');   // 완성 본문 기준 결정적 직렬화(refMap 명칭 우선)
    // ★ [배치9 D3] 마무리 흡수 커밋 — 동일 컨텍스트 산출(효과·해결수단·요약)이 있으면 원자 커밋(없으면 기존 유지·비파괴)
    if(r.solution){ pushOutputHistory('step_17','unified','runUnifiedCohesionGen'); outputs.step_17=r.solution; markOutputTimestamp('step_17'); }
    if(r.effects){ pushOutputHistory('step_16','unified','runUnifiedCohesionGen'); outputs.step_16=r.effects; markOutputTimestamp('step_16'); }
    if(r.abstract){ pushOutputHistory('step_19','unified','runUnifiedCohesionGen'); outputs.step_19=r.abstract; markOutputTimestamp('step_19'); }
    // ★ [배치9 D1] 인라인 수식 모드 — 구 step_09(수식 병합 구본)는 getLatestDescription 우선순위상 새 본문을 가리는
    //   섀도잉 소스이므로 이력 보존 후 제거(인라인 수식이 본문에 이미 포함됨).
    if(_mathInline&&outputs.step_09){ pushOutputHistory('step_09','unified','runUnifiedCohesionGen'); delete outputs.step_09; try{delete outputTimestamps.step_09;}catch(_e){} }
    try{ if(typeof _snapshotGenParams==='function')_snapshotGenParams('stage4'); }catch(_e){}   // [배치12 C] 본문 생성 시점 설계 스냅샷(수학식·분량 대조 기준)
    try{if(typeof _mergeConceptIntoStep08==='function')_mergeConceptIntoStep08();}catch(_e){}   // 예시도(step_08c) 합본(있을 때만)
    try{if(typeof reflectConceptsToSpec==='function')reflectConceptsToSpec();}catch(_e){}       // 예시도 부호 step_18 반영(있을 때만)
    try{if(typeof invalidateDownstream==='function')invalidateDownstream('step_08');}catch(_e){}
    // 함께 재생성한 step_12 는 stale 아님 — invalidateDownstream 의 false-stale 배지 제거(방법 브랜치 실행 시)
    try{if(r.method&&outputs.step_10&&typeof document!=='undefined')document.querySelectorAll('.stale-warning[data-step="step_12"]').forEach(function(w){w.remove();});}catch(_e){}
    if(typeof saveProject==='function')saveProject(true);
    try{renderPreview();}catch(_e){}
    try{renderSpecValidation();}catch(_e){}
    App.clearProgress('progressUnifiedGen');
    const after=_specIssueCounts();
    const soft=rep.unusedRef.length?(' · 도면 미사용 부호 '+rep.unusedRef.length+'개 자동 제외'):'';
    App.showToast('통합 생성 완료 · 부호불일치 '+before.refnum+'→'+after.refnum+', 중복 '+before.dup+'→'+after.dup+soft,'success');
    if(hadMath&&!_mathInline)App.showToast('⚠️ 기존 수학식(Step 9)은 새 상세설명에 재삽입이 필요합니다 — 미리보기·다운로드에 수학식이 빠져 있습니다','warning');   // [배치9 D1] 인라인 모드에선 구 step_09를 이력 보존 후 제거했으므로 미해당
  }catch(e){ try{_lastGenError=(e&&e.message)||String(e);}catch(_e){} App.clearProgress('progressUnifiedGen'); App.showToast('통합 생성 실패: '+(e&&e.message||e),'error'); console.error('[unified]',e); }
  finally{ setGlobalProcessing(false); if(App.setButtonLoading)App.setButtonLoading('btnUnifiedGen',false); }
}

// ═══ [B] 발명자료 → 핵심 명세서 통합 생성 (원클릭 체인) ═══
// 명칭 → 청구항(장치[+방법]) → 도면(장치[+방법]) → 상세설명+부호(통합) 를 한 번의 클릭으로 순차 생성.

// ★ [배치7 N1] 전체 재생성 — 체인 산출 계열(명칭후보·청구항·도면·상세설명·부호·수학식·검토/반영본) 초기화.
//   step_09·step_13_applied(_method)는 getLatestDescription 우선순위상 구본이 새 step_08을 가리는(섀도잉) 원인이라 반드시 함께 제거.
//   selectedTitle(확정 명칭)은 보존 — 명칭 변경은 사용자 결정 사안(변경 시 세대 훅이 별도 추적).
function _resetUnifiedChainOutputs(){
  // [배치11 A] step_01(명칭후보)·확정명칭은 초기화하지 않는다 — 유형·명칭은 통합 생성의 "입력"(산출물 아님).
  ['step_06','step_10','step_07','step_11','step_08','step08_device','step_09','step_12','step_18','step_13','step_13_applied','step_13_applied_method'].forEach(function(k){
    if(typeof outputs==='object'&&outputs&&outputs[k]!==undefined)delete outputs[k];
    try{ if(typeof outputTimestamps==='object'&&outputTimestamps&&outputTimestamps[k]!==undefined)delete outputTimestamps[k]; }catch(_e){}
  });
}
// 각 단계는 기존 검증된 생성기(runStep/runDiagramStep/runUnifiedCohesionGen)를 재사용 — 오케스트레이션만 추가.
// 체인은 globalProcessing 을 직접 잡지 않는다(각 하위 생성기가 잡고 finally 로 해제하므로, 잡으면 하위가 early-return). 재진입은 _unifiedChainRunning 플래그로 차단.
// 비파괴/그레이스풀: 어느 단계가 실패하면 그 지점에서 중단하고 지금까지 생성분은 보존.
let _unifiedChainRunning=false;
let _lastGenError='';   // [배치15A-1] 직전 생성기(runStep/runDiagramStep/cohesion) 실패 사유 — 체인이 phase ✗·배너에 노출(침묵 catch 제거)
async function runUnifiedFullChain(_wizOpts){
  if(_unifiedChainRunning){App.showToast('통합 생성이 이미 진행 중입니다','info');return;}
  if(typeof globalProcessing!=='undefined'&&globalProcessing){App.showToast('다른 작업이 진행 중입니다','info');return;}
  const inv=((typeof document!=='undefined'&&document.getElementById('projectInput')?.value)||'').trim();
  if(inv.length<20){App.showToast('발명 자료를 먼저 입력하세요(최소 20자)','error');return;}
  if(typeof currentProjectId!=='undefined'&&!currentProjectId){App.showToast('프로젝트를 먼저 저장하세요','error');return;}
  // ★ [배치11 B] 위저드 경유 — 직접 클릭이면 오버레이(유형→설계→재실행)를 열고, 위저드가 opts와 함께 재호출한다.
  if(!_wizOpts&&typeof openUnifiedWizard==='function'&&typeof document!=='undefined'&&document.getElementById('wfWizard')){ openUnifiedWizard(); return; }
  if(!selectedTitleType){App.showToast('먼저 발명 유형을 선택하세요','error');return;}
  // ★ [배치11 A] 재실행 판정 — "산출물 계열"만 본다(명칭·범위확정·참고자료는 통합 생성의 입력이지 산출물이 아님).
  //   실측 버그: 명칭 확정만 한 새 프로젝트에서 step_01 존재로 재실행 모달이 떴음 → step_01 제외.
  const _hasPrev=['step_06','step_07','step_08','step_10','step_11','step_12'].some(function(k){return !!outputs[k];});
  let resume=false;   // [배치15A-1] 이어하기 — 산출물 있는 단계는 건너뛰고 빈 단계만 생성(재개 버튼 경로 공유)
  if(_hasPrev){
    const _full=!!(_wizOpts&&_wizOpts.mode==='full');
    if(_full)_resetUnifiedChainOutputs();
    else { resume=true; App.showToast('이어하기 — 빈 단계만 생성합니다(기존 산출물 재사용, 완성 후 검증 패널 확인)','info'); }
  }
  const wantMethod=!!includeMethodClaims;
  const _mathOn=!!(typeof document!=='undefined'&&document.getElementById('chkUnifiedMath')?.checked);
  // ★ [배치9 D1] 수학식 토글은 cohesion 인라인 파라미터(C9)로만 소비([4/4] 안에서 수식 포함 생성). Step 9 수동 경로는 고급에 존치.
  const TOTAL=4;
  _unifiedChainRunning=true; try{_wfRunning=0;}catch(_e){}
  const btn=(typeof document!=='undefined')?document.getElementById('btnUnifiedFullChain'):null; if(btn)btn.disabled=true;
  const P=function(msg,cur){App.showProgress('progressUnifiedFullChain',msg,cur,TOTAL);try{const w=document.getElementById('wizProgressText');if(w)w.textContent=msg;}catch(_e){}};   // [배치11 B] 위저드 진행 미러
  const _rail=function(n){ try{_wfRunning=n; if(typeof renderWorkflowRail==='function')renderWorkflowRail();}catch(_e){} };   // [배치15A-2] 레일 running 배지(스피너)
  const _phase=function(id,st,detail){ try{ if(typeof _wizPhaseSet==='function')_wizPhaseSet(id,st,detail); }catch(_e){} };   // [배치15A-2] 오버레이 체크리스트
  let stopInfo=null;   // [배치15A-1] 중단 사유 — 종료 훅이 배너·요약·재개 버튼에 노출
  try{
    // ── [1/4] 발명의 명칭 ──
    _phase('title','running'); _rail(1); P('[1/4] 발명의 명칭 생성...',0);
    if(!outputs.step_01){ _lastGenError=''; await runStep('step_01'); }
    if(!selectedTitle){
      const cands=(typeof parseTitleCandidates==='function')?parseTitleCandidates(outputs.step_01||''):[];
      if(cands.length){
        try{ if(typeof _onTitleChanged==='function')_onTitleChanged(selectedTitle, cands[0].korean||''); }catch(_e){}   // [배치5 ④] 명칭 세대 훅 경유(감사 §3 — prune 미실행 오탐 경로 차단)
        selectedTitle=cands[0].korean||''; selectedTitleEn=cands[0].english||''; if(typeof markOutputTimestamp==='function')markOutputTimestamp('step_01'); }
    }
    if(!selectedTitle){ stopInfo={label:'명칭',cause:(_lastGenError||'명칭 생성 실패 — 발명 자료를 확인 후 다시 시도')}; _phase('title','fail',stopInfo.cause); App.showToast('통합 생성 중단 — 명칭: '+stopInfo.cause,'error'); return; }
    _phase('title','done','확정: '+selectedTitle);
    // ── [배치15B-2] 기초(기술분야·배경기술) — 명칭 확정 직후·청구항 이전. 부수사항이므로 실패해도 체인 중단 안 함(비블로킹). ──
    _phase('basis','running'); _rail(1); P('[기초] 기술분야·배경기술 생성...',0);
    if(!(resume&&outputs.step_02)){ _lastGenError=''; try{ await runStep('step_02'); }catch(_e){} }
    if(!(resume&&outputs.step_03)){ _lastGenError=''; try{ await runStep('step_03'); }catch(_e){} }
    // 결과를 ④ 우측 기초 결과 카드(resultsBatch25)에 렌더(runStep의 renderOutput은 개별 resultStepNN 대상이라 no-op)
    try{ if(typeof renderBatchResult==='function'){ const _rb=(typeof document!=='undefined')&&document.getElementById('resultsBatch25'); if(_rb)_rb.innerHTML=''; if(outputs.step_02)renderBatchResult('resultsBatch25','step_02',outputs.step_02); if(outputs.step_03)renderBatchResult('resultsBatch25','step_03',outputs.step_03); } }catch(_e){}
    if(outputs.step_02||outputs.step_03)_phase('basis','done','기술분야'+(outputs.step_02&&outputs.step_03?'·배경기술':''));
    else _phase('basis','fail',(_lastGenError||'기초 생성 실패 — 청구항은 계속 진행(부수사항)'));
    // ── [2/4] 청구항 ──
    _phase('claims','running'); _rail(3); P('[2/4] 청구항 생성(장치'+(wantMethod?'+방법':'')+')...',1);
    if(!(resume&&outputs.step_06)){ _lastGenError=''; await runStep('step_06'); }
    if(!outputs.step_06){ stopInfo={label:'청구항',cause:(_lastGenError||'장치 청구항 생성 실패')}; _phase('claims','fail',stopInfo.cause); App.showToast('통합 생성 중단 — 청구항: '+stopInfo.cause,'error'); return; }
    if(wantMethod&&!(resume&&outputs.step_10)){ _lastGenError=''; await runStep('step_10'); }
    _phase('claims','done','장치'+(wantMethod&&outputs.step_10?'+방법':'')+' 청구항');
    // ── [3/4] 도면 ──
    _phase('figures','running'); _rail(3); P('[3/4] 도면 생성(Mermaid)...',2);
    if(!(resume&&outputs.step_07)){ _lastGenError=''; await runDiagramStep('step_07'); }
    if(!outputs.step_07){ stopInfo={label:'도면',cause:(_lastGenError||'장치 도면 생성 실패')}; _phase('figures','fail',stopInfo.cause); App.showToast('통합 생성 중단 — 도면: '+stopInfo.cause,'error'); return; }
    if(wantMethod&&outputs.step_10&&!(resume&&outputs.step_11)){ _lastGenError=''; await runDiagramStep('step_11'); }
    // ── [배치15B-1c] 예시도(step_07c) — ② "예시도 포함" 시 목표 개수만큼 생성(제외 시 스킵) ──
    let _conceptN=0;
    if(typeof conceptDiagramEnabled!=='undefined'&&conceptDiagramEnabled){
      try{
        if(typeof autoDetectConceptDiagrams==='function'&&(!conceptDiagramTypes||!conceptDiagramTypes.length))autoDetectConceptDiagrams();
        if(typeof _trimConceptTypesToTarget==='function')_trimConceptTypesToTarget();
        if(conceptDiagramTypes&&conceptDiagramTypes.length&&typeof _cascadeRunConceptDiagram==='function'&&!(resume&&outputs.step_07c)){ P('[3/4] 예시도 생성(SVG)...',2); await _cascadeRunConceptDiagram(); }
        _conceptN=(conceptDiagramTypes||[]).filter(function(ct){return ct&&ct.svgContent;}).length;
      }catch(_e){ try{_lastGenError='예시도 생성 실패: '+(_e&&_e.message||_e);}catch(_e2){} console.warn('[unifiedChain] concept',_e); }
    }
    try{ if(typeof _snapshotGenParams==='function')_snapshotGenParams('stage3'); }catch(_e){}   // [배치12 C] 체인 골격 스냅샷(적용값 대조 기준)
    _phase('figures','done','장치'+(wantMethod&&outputs.step_11?'+방법':'')+' 도면'+(_conceptN?('+예시도'+_conceptN):''));
    // ── [4/4] 상세설명+부호 통합 ──
    _phase('body','running'); _rail(4); P('[4/4] 상세설명+부호 통합 생성...',3);
    const _beforeDesc=outputs.step_08||''; _lastGenError='';
    await runUnifiedCohesionGen({chained:true});
    if((outputs.step_08||'')===_beforeDesc){ stopInfo={label:'본문',cause:(_lastGenError||'상세설명·부호 통합 게이트 미통과/실패 — 산출물(F) 탭에서 재시도')}; _phase('body','fail',stopInfo.cause); App.showToast('통합 생성 중단 — 본문: '+stopInfo.cause,'error'); return; }
    // ([배치9 D1] 수학식은 토글 on 시 [4/4] cohesion 안에서 인라인 생성됨 — 별도 [5/5] 없음)
    _phase('body','done','상세설명·부호'+(_mathOn?'·수학식':''));
    App.showProgress('progressUnifiedFullChain','완료',TOTAL,TOTAL);
    setTimeout(function(){App.clearProgress('progressUnifiedFullChain');},2500);
    App.showToast('통합 생성 완료 — 명칭·청구항·도면·상세설명·부호 생성됨. 산출물(F) 탭에서 확인하세요','success');
  }catch(e){ stopInfo={label:(stopInfo&&stopInfo.label)||'예외',cause:(e&&e.message||String(e))}; try{App.clearProgress('progressUnifiedFullChain');}catch(_e){} App.showToast('통합 생성 중단: '+(e&&e.message||e),'error'); console.error('[unifiedChain]',e); }
  finally{
    _unifiedChainRunning=false; try{_wfRunning=0;}catch(_e){}
    const b=(typeof document!=='undefined')?document.getElementById('btnUnifiedFullChain'):null; if(b)b.disabled=false;
    // [배치15A-4] 종료(완료·중단 공통) — 영속 + ② 보드/레일/검증바 재렌더(D3 "미생성" 수정) + 완료/중단 배너·요약
    try{ if(typeof saveProject==='function')saveProject(true); }catch(_e){ try{App.showToast('저장 실패: '+(_e&&_e.message||_e),'error');}catch(_e2){} }
    try{
      const info={stopped:!!stopInfo, stopLabel:stopInfo?stopInfo.label:'', cause:stopInfo?stopInfo.cause:'', at:(typeof Date!=='undefined'?Date.now():0), gen:null, warn:null};
      if(typeof _wizFinishSummary==='function')_wizFinishSummary(info);
      else { try{ if(typeof renderWorkflowRail==='function')renderWorkflowRail(); if(typeof renderWfValidationBar==='function')renderWfValidationBar(); if(typeof renderDesignBoard==='function')renderDesignBoard(); }catch(_e){} }
    }catch(_e){}
  }
}

