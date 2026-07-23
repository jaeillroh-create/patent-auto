// ═══════════ RENDERERS ═══════════
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10'||sid==='step_20')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);
}
function renderTitleCards(c,text){
  const cs=parseTitleCandidates(text);
  if(!cs.length){
    c.innerHTML=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${App.escapeHtml(text)}</div>`;
    document.getElementById('titleConfirmArea').style.display='block';
    return;
  }
  // 세로 리스트 형태로 표시
  c.innerHTML='<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'+cs.map(x=>`<div class="title-candidate-row" onclick="selectTitle(this,\`${x.korean.replace(/\`/g,'')}\`,\`${x.english.replace(/\`/g,'')}\`)" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid var(--color-border);border-radius:10px;cursor:pointer;transition:all 0.15s;background:#fff" onmouseover="this.style.borderColor='var(--color-primary)';this.style.background='var(--color-primary-light)'" onmouseout="if(!this.classList.contains('selected')){this.style.borderColor='var(--color-border)';this.style.background='#fff'}"><div style="width:28px;height:28px;border-radius:50%;background:var(--color-primary-light);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${x.num}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:var(--color-text-primary)">${App.escapeHtml(x.korean)}</div><div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">${App.escapeHtml(x.english)}</div></div></div>`).join('')+'</div>';
  document.getElementById('titleConfirmArea').style.display='block';
}
function renderClaimResult(c,sid,text){const st=parseClaimStats(text),iss=validateClaims(text);let h=renderScopeBadgeSummary(sid);h+=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="status-dot ${i.severity==='CRITICAL'?'negative':'cautionary'}"></span>${App.escapeHtml(i.message)}</div>`).join('');else h+='<div class="issue-item issue-pass"><span class="ico" data-icon="check-circle"></span>모든 검증 통과</div>';h+=`<textarea class="result-textarea" rows="14" onchange="pushOutputHistory('${sid}','user_edit','renderClaimResult');outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea>`;c.innerHTML=h;}
function renderEditableResult(c,sid,text){c.innerHTML=renderScopeBadgeSummary(sid)+`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral" id="charCount_${sid}">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="pushOutputHistory('${sid}','user_edit','renderEditableResult');outputs['${sid}']=this.value;markOutputTimestamp('${sid}');saveProject(true);document.getElementById('charCount_${sid}').textContent=this.value.length.toLocaleString()+'자'" oninput="outputs['${sid}']=this.value;document.getElementById('charCount_${sid}').textContent=this.value.length.toLocaleString()+'자'">${App.escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){
  const container=document.getElementById(cid);if(!container)return;
  // v15: 멱등 렌더 — 동일 단계 항목이 있으면 교체(채팅 단독 수정 시 중복 방지)
  const html=`<div class="batch-item" data-batch-step="${sid}"><div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="ico" data-icon="check-circle"></span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow"><span class="ico" data-icon="chevron-down" data-size="12"></span></span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="pushOutputHistory('${sid}','user_edit','renderBatchResult');outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea><div class="chat-mount" id="chatMount_${sid}"></div></div></div>`;
  const existing=container.querySelector(`[data-batch-step="${sid}"]`);
  if(existing){const tmp=document.createElement('div');tmp.innerHTML=html;existing.replaceWith(tmp.firstElementChild);}
  else container.insertAdjacentHTML('beforeend',html);
  if(window.PatentChat)PatentChat.mount(sid);
}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}

// ═══════════ VALIDATION (v4.9 — full claim chain + relaxed matching) ═══════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적 표현'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적 표현'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적 표현'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적 표현'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적 표현'},{pattern:/무조건/,msg:'"무조건" — 제한적 표현'},{pattern:/오직/,msg:'"오직" — 제한적 표현'}];
// v4.9: Get full text of claim chain (claim N → references → parent → ... → independent)
// v5.1: Get ONLY cited claim chain text (follows "청구항 N에 있어서" references upward)
// Does NOT include unrelated claims — only the direct citation path
function getCitedChainText(claimNum, claims){
  const ct=claims[claimNum];
  if(!ct)return '';
  const rm=ct.match(/(?:청구항|제)\s*(\d+)\s*(?:항\s*)?에\s*있어서/);
  if(!rm)return '';
  let text='',current=parseInt(rm[1]);const visited=new Set();
  while(current&&!visited.has(current)){
    visited.add(current);
    if(claims[current])text+=' '+claims[current];
    const rm2=claims[current]?.match(/(?:청구항|제)\s*(\d+)\s*(?:항\s*)?에\s*있어서/);
    current=rm2?parseInt(rm2[1]):null;
  }
  return text;
}
function validateClaims(text){
  const iss=[];if(!text)return iss;const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,claims={};let m;
  while((m=cp.exec(text))!==null)claims[parseInt(m[1])]=m[2].trim();
  if(!Object.keys(claims).length){iss.push({severity:'HIGH',message:'청구항 파싱 실패'});return iss;}
  
  // ★ 동적 독립항 감지: 가장 작은 번호가 독립항 ★
  const claimNums=Object.keys(claims).map(Number).sort((a,b)=>a-b);
  const firstClaimNum=claimNums[0];
  
  // 독립항 판별: "N항에 있어서"가 없는 청구항 = 독립항
  const independentClaims=claimNums.filter(n=>{
    const ct=claims[n];
    return !/청구항\s*\d+\s*에\s*있어서/.test(ct)&&!/제\s*\d+\s*항에\s*있어서/.test(ct);
  });
  
  if(independentClaims.length===0){
    iss.push({severity:'CRITICAL',message:'독립항 없음 (모든 청구항이 종속항)'});
  }
  
  // 각 청구항의 인용 정보 수집 (다중인용 검증용)
  const claimRefs={};
  Object.entries(claims).forEach(([num,ct])=>{
    const n=parseInt(num);
    const allCites=[];
    // "청구항 N에 있어서" 또는 "제N항 또는 제M항에 있어서" 등
    const citeMatches=ct.match(/(?:청구항|제)\s*(\d+)\s*(?:항)?/g)||[];
    citeMatches.forEach(cm=>{const nm=cm.match(/(\d+)/);if(nm)allCites.push(parseInt(nm[1]));});
    claimRefs[n]={cites:[...new Set(allCites)].filter(c=>c!==n),isMultiCite:false};
    // 다중인용 감지: "제N항 또는 제M항" 또는 "청구항 N 또는 청구항 M"
    if(/(?:제\s*\d+\s*항|청구항\s*\d+)\s*(?:또는|내지)\s*(?:제\s*\d+\s*항|청구항\s*\d+)/.test(ct)){
      claimRefs[n].isMultiCite=true;
    }
  });
  
  Object.entries(claims).forEach(([num,ct])=>{const n=parseInt(num);
    // 종속항 판별: "N항에 있어서" 존재 여부
    const isDependent=/청구항\s*\d+에\s*있어서/.test(ct)||/제\s*\d+\s*항에\s*있어서/.test(ct);
    if(isDependent){const rm=ct.match(/청구항\s*(\d+)에\s*있어서/)||ct.match(/제\s*(\d+)\s*항에\s*있어서/),rn=rm?parseInt(rm[1]):firstClaimNum;
      if(rm){if(!claims[rn])iss.push({severity:'HIGH',message:`청구항 ${num}: 참조 청구항 ${rn} 없음`});if(rn>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 자기/후행 청구항 참조`});}
      
      // ★ 대통령령 종속항 규칙 검증 ★
      const refs=claimRefs[n];
      if(refs){
        // ④ 번호 역전 금지: 인용 항은 자신보다 앞번호여야 함
        refs.cites.forEach(c=>{
          if(c>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 청구항 ${c}를 인용하나 뒤에 위치 (번호 역전 금지)`});
        });
        // ③ 다중인용의 다중인용 금지
        if(refs.isMultiCite){
          refs.cites.forEach(c=>{
            if(claimRefs[c]&&claimRefs[c].isMultiCite){
              iss.push({severity:'HIGH',message:`청구항 ${num}: 다중인용 종속항(청구항 ${c})을 다시 다중인용 — 대통령령 위반`});
            }
          });
        }
      }
      
      // v5.1: 2-step validation — "인용하는 청구항만 검토"
      const citedText=getCitedChainText(n, claims);
      // selfClean: 현재 청구항에서 "상기 ..." 구문을 통째로 제거 → 독립 정의 용어만 남김
      const selfClean=ct.replace(/상기\s+[가-힣]+(?:\s[가-힣]+){0,3}/g,' ');
      const srefs=ct.match(/상기\s+([가-힣]+(?:\s[가-힣]+){0,3})/g)||[];
      srefs.forEach(ref=>{const raw=ref.replace(/^상기\s+/,''),cw=raw.split(/\s+/).slice(0,2).map(stripKoreanParticles).filter(w=>w.length>=2&&w!=='상기');if(!cw.length)return;
        // Step 1: 인용 청구항 체인에서 키워드 검색
        const inCited=cw.filter(w=>citedText.includes(w)).length;
        if(inCited>0)return;
        // Step 2: 현재 청구항 내 독립 정의 확인 (상기 구문 제거 후)
        const inSelf=cw.filter(w=>selfClean.includes(w)).length;
        if(inSelf>0)return;
        // 양쪽 모두 없음 → 기재불비
        iss.push({severity:'HIGH',message:`청구항 ${num}: "상기 ${raw}" — 인용 청구항 체인에 "${cw.join(', ')}" 선행기재 없음`});
      });}
    KILLER_WORDS.forEach(kw=>{if(kw.pattern.test(ct))iss.push({severity:'HIGH',message:`청구항 ${num}: ${kw.msg}`});});
  });return iss;
}
function runValidation(){
  const all=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');
  if(!all){App.showToast('검증할 청구항이 없어요','error');return;}
  const iss=validateClaims(all);
  // v5.6: 참조번호 일관성 검증 추가
  const refIssues=validateRefNumberConsistency();
  const allIssues=[...iss,...refIssues];
  const el=document.getElementById('validationResults');
  if(!allIssues.length){el.innerHTML='<div class="issue-item issue-pass"><span class="ico" data-icon="check-circle"></span>모든 검증 통과</div>';return;}
  el.innerHTML=allIssues.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':i.severity==='HIGH'?'issue-high':'issue-warning'}"><span class="status-dot ${i.severity==='CRITICAL'?'negative':i.severity==='HIGH'?'cautionary':'cautionary'}"></span> ${App.escapeHtml(i.message)}</div>`).join('');
}

// ═══ v5.6: 참조번호 일관성 검증 (명칭 불일치, 도면 미정의, 혼용) ═══
function validateRefNumberConsistency(){
  const issues=[];
  const desc=getLatestDescription()||'';
  const methodDesc=getLatestMethodDescription()||'';
  const claims=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');
  const allText=desc+'\n'+methodDesc+'\n'+claims;
  const signTable=outputs.step_18||'';

  // 1. 본문에서 "명칭(참조번호)" 수집 → 참조번호별 명칭 빈도
  const refNameMap=new Map(); // ref → Map<name, count>
  const refRe=/([가-힣a-zA-Z][가-힣a-zA-Z\s]{0,12}?)\s*\((\d{2,4}|S\d{2,4})\)/g;
  let m;while((m=refRe.exec(allText))!==null){
    const name=m[1].replace(/^상기\s*/,'').trim();
    const ref=m[2];
    if(name.length<2)continue;
    if(!refNameMap.has(ref))refNameMap.set(ref,new Map());
    const nmap=refNameMap.get(ref);
    nmap.set(name,(nmap.get(name)||0)+1);
  }

  // 2. 명칭 불일치 검출 (하나의 참조번호에 여러 명칭)
  refNameMap.forEach((nmap,ref)=>{
    if(nmap.size<=1)return;
    const entries=[...nmap.entries()].sort((a,b)=>b[1]-a[1]);
    const primary=entries[0];
    const others=entries.slice(1).filter(e=>e[1]>=3); // 3회 이상 사용된 이름만
    if(others.length>0){
      issues.push({severity:'HIGH',message:`참조번호 ${ref} 명칭 불일치: "${primary[0]}"(${primary[1]}회) vs ${others.map(e=>`"${e[0]}"(${e[1]}회)`).join(', ')} — 명칭 통일 필요`});
    }
  });

  // 3. 부호의 설명 대비 본문 참조번호 누락 검출
  const signRefs=new Set();
  const signRe=/:\s*(\d{2,4}|S\d{2,4})\s*$/gm;
  let sm;while((sm=signRe.exec(signTable))!==null)signRefs.add(sm[1]);
  const bodyRefs=new Set();
  refNameMap.forEach((_,ref)=>bodyRefs.add(ref));
  // 본문에서 사용되지만 부호의 설명에 없는 참조번호
  bodyRefs.forEach(ref=>{
    if(!signRefs.has(ref)){
      const names=refNameMap.get(ref);
      const primary=names?[...names.entries()].sort((a,b)=>b[1]-a[1])[0][0]:'?';
      issues.push({severity:'MEDIUM',message:`부호의 설명 누락: ${primary}(${ref}) — 본문에서 사용되지만 부호의 설명에 미기재`});
    }
  });

  // 4. 도면에 정의되지 않은 참조번호가 본문에 사용되는지 검출
  const diagramRefs=new Set();
  const diagramTexts=[outputs.step_07,outputs.step_11].filter(Boolean).join('\n');
  const dRefRe=/\((\d{2,4}|S\d{2,4})\)/g;
  let dm;while((dm=dRefRe.exec(diagramTexts))!==null)diagramRefs.add(dm[1]);
  if(diagramRefs.size>0){
    bodyRefs.forEach(ref=>{
      if(!diagramRefs.has(ref)&&!ref.startsWith('S')){
        const names=refNameMap.get(ref);
        const primary=names?[...names.entries()].sort((a,b)=>b[1]-a[1])[0][0]:'?';
        const count=[...names.values()].reduce((a,b)=>a+b,0);
        if(count>=3){
          issues.push({severity:'HIGH',message:`도면 미정의 참조번호: ${primary}(${ref}) — 본문에서 ${count}회 사용되지만 도면에 없음`});
        }
      }
    });
  }

  return issues;
}

// ═══════════ OUTPUT ═══════════
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;const totalSteps=conceptDiagramTypes.length>0?21:20;document.getElementById('statCompleted').textContent=`${c}/${totalSteps}`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${(usage.cost||0).toFixed(2)}`;}
// ═══ [T4] 사용자 도면 출력 반영 — 기존 base64(fileDataUrl) 이미지를 미리보기·Word·PPTX 에 삽입(비전 불필요) ═══
// buildUserFiguresHtml — 사용자 도면 이미지 블록 HTML(미리보기·Word 공유). fileDataUrl 있는 도면만, 도 번호 순.
//   ★ 자동 도면(mermaid)과 별개로 사용자가 올린 실제 이미지를 출력에 삽입. 텍스트 명세(buildSpecification)는 불변(.txt/clipboard 보존).
function buildUserFiguresHtml(opts){
  opts=opts||{};
  var figs=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).filter(function(f){return f&&f.fileDataUrl;}).sort(function(a,b){return a.num-b.num;});
  if(!figs.length)return '';
  var esc=(typeof App!=='undefined'&&App.escapeHtml)?App.escapeHtml:function(s){return String(s==null?'':s);};
  var blocks=figs.map(function(f){
    var cap='도 '+f.num+(f.description?' — '+esc(f.description):'');
    if(opts.word){
      return '<div style="margin:18pt 0;text-align:center;page-break-inside:avoid">'
        +'<img src="'+f.fileDataUrl+'" style="max-width:15cm;height:auto" />'
        +'<p style="font-size:11pt;margin:6pt 0 0;text-align:center;font-family:\'바탕체\',BatangChe,serif">'+cap+'</p></div>';
    }
    return '<div style="margin:14px 0;text-align:center">'
      +'<img src="'+f.fileDataUrl+'" style="max-width:100%;height:auto;border:1px solid var(--color-border,#ddd);border-radius:6px" />'
      +'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:6px">'+cap+'</div></div>';
  }).join('');
  if(opts.word){
    return '<h2 style="font-size:12pt;font-weight:normal;font-family:\'바탕체\',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【도면】</h2>'+blocks;
  }
  return '<div style="margin-top:12px;border-top:1px solid var(--color-border,#eee);padding-top:12px">'
    +'<div style="font-weight:600;font-size:13px;margin-bottom:8px"><span class="ico" data-icon="image"></span> 【도면】 사용자 도면 '+figs.length+'건</div>'
    +blocks+'</div>';
}
// _appendUserFigureSlides — 사용자 도면(이미지)을 PPTX 슬라이드로 추가(addImage, base64 재사용). 도 번호 순.
function _appendUserFigureSlides(pptx){
  var figs=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).filter(function(f){return f&&f.fileDataUrl;}).sort(function(a,b){return a.num-b.num;});
  figs.forEach(function(f){
    var sl=pptx.addSlide({bkgd:'FFFFFF'});
    sl.addText('도 '+f.num,{x:0.6,y:0.4,w:7.07,h:0.4,fontSize:14,bold:true,fontFace:'바탕체',align:'center'});
    sl.addImage({data:f.fileDataUrl,x:0.6,y:1.0,w:7.07,h:8.5,sizing:{type:'contain',w:7.07,h:8.5}});
    if(f.description)sl.addText(f.description,{x:0.6,y:9.7,w:7.07,h:0.6,fontSize:10,fontFace:'바탕체',align:'center'});
  });
}

function renderPreview(){
  // ── [G4/G5] page4 진입 시 검증 게이트 갱신 + 리뷰 결과 마운트(트리거·결과 동일 위치).
  try { if (Patent._updateReviewGate) Patent._updateReviewGate(); } catch (_e) {}
  // [T8 훅 이전] 통합 리뷰 엔진 결과 표시(window.ReviewUI). __patentReviewState 없으면 no-op(기존 동작 불변).
  //   승인(Human Gate) → onChange → Patent.applyAmendments(승인분만, 3경로 정합 재검증) → recheck 재트리거.
  try {
    if (window.ReviewUI && window.__patentReviewState) {
      var _card = document.getElementById('resultCardPatentReview'); if (_card) _card.style.display = '';
      var _pm = document.getElementById('patent-review-mount');
      if (_pm) {
        // 결과는 넓은 공유 모달(2a)에 표시 — 카드에는 재오픈 버튼만(닫아도 세션 내 __patentReviewState 유지).
        var _n = ((window.__patentReviewState.issues) || []).length;
        // 검증 결과 보기 + [반영하기](승인 방향 → 상세설명 뒷받침 추가, 변리사 확정). 반영 버튼은 상시 렌더 —
        //   승인 add_spec_support 가 없으면 클릭 시 가드 토스트(applyDirectionRewrite)로 안전 처리(렌더 타이밍 의존 제거).
        _pm.innerHTML = '<button class="btn btn-outline btn-full" onclick="Patent.openReviewModal()"><span class="ico" data-icon="shield"></span> 검증 결과 보기' + (_n ? ' (' + _n + '건)' : '') + '</button>'
          + '<button class="btn btn-primary btn-full" id="btnPatentDirectionRewrite" style="margin-top:8px" onclick="Patent.startDirectionRewrite()"><span class="ico" data-icon="edit"></span> 승인 방향 반영 — 상세설명 뒷받침 추가(변리사 확정)</button>';
      }
    }
  } catch (_e) {}
  const el=document.getElementById('previewArea'),spec=buildSpecification();const _userFigs=buildUserFiguresHtml({});
  // ★ [Task1] ④ 미생성 인라인 배너 — 예시도 있는데 예시도 상세설명(step_08c) 비면 명세서에서 누락됨을 미리보기 상단에 안내.
  const _cdBanner=_conceptDescMissing()?'<div style="padding:10px 12px;border-radius:8px;background:#FFF4E5;border-left:3px solid var(--color-warning,#E8A33D);color:#7A4B00;font-size:12px;margin-bottom:12px">⚠️ 예시도 상세설명 미생성 — 예시도 설명이 명세서에서 빠집니다. Step 8 “상세설명 생성(장치+예시도)”을 실행하면 예시도 설명도 함께 생성됩니다.</div>':'';
  if(!spec.trim()){el.innerHTML=_cdBanner+'<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>'+_userFigs;return;}el.innerHTML=_cdBanner+spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${App.escapeHtml(h[1])}】</span><span class="arrow"><span class="ico" data-icon="chevron-down" data-size="12"></span></span></div><div class="accordion-body">${App.escapeHtml(s)}</div>`;}).join('')+_userFigs;}
// 출력 시 항목 헤더 중복 방지: 본문 첫 줄이 해당 항목 헤더(【h】, 공백 변형 포함)면 제거.
// 항목명이 정확히 일치할 때만 제거하므로 청구범위의 "【청구항 1】" 등은 보존됨.
function _stripDupHeader(body,h){
  if(!body||!h)return body;
  const esc=h.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  return body.replace(new RegExp('^\\s*【\\s*'+esc+'\\s*】[ \\t]*\\r?\\n?'),'');
}
function buildSpecification(){
  const brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  // Claims: use the latest version (after auto-correction from validation)
  const deviceClaims=outputs.step_06||'';
  const methodClaims=outputs.step_10||'';
  const mediaClaims=outputs.step_20||''; // v5.5: 기록매체/프로그램 청구항
  const allClaims=[deviceClaims,methodClaims,mediaClaims].filter(Boolean).join('\n\n');
  // ═══ D-1 fix: 청구항 번호 연속성 최종 검증 (v5.5) ═══
  const claimNums=[...allClaims.matchAll(/【청구항\s*(\d+)】/g)].map(m=>parseInt(m[1]));
  if(claimNums.length>0){
    const sorted=[...claimNums].sort((a,b)=>a-b);
    for(let i=0;i<sorted.length;i++){
      if(sorted[i]!==i+1){App.showToast(`⚠️ 청구항 번호 불연속: 청구항 ${i+1} 누락`,'warning');break;}
    }
    const dupes=claimNums.filter((n,i)=>claimNums.indexOf(n)!==i);
    if(dupes.length>0)App.showToast(`⚠️ 청구항 번호 중복: ${[...new Set(dupes)].join(', ')}`,'warning');
  }
  // Include step_14 (alternative claims) if available
  let extras='';
  if(outputs.step_14)extras+='\n\n[참고: 대안 청구항]\n'+outputs.step_14;
  if(outputs.step_15)extras+='\n\n[참고: 특허성 검토]\n'+outputs.step_15;
  return['【발명의 설명】',`【발명의 명칭】\n${titleLine}`,`【기술분야】\n${_stripDupHeader(outputs.step_02||'','기술분야')}`,`【발명의 배경이 되는 기술】\n${_stripDupHeader(outputs.step_03||'','발명의 배경이 되는 기술')}`,`【선행기술문헌】\n${_stripDupHeader(outputs.step_04||'','선행기술문헌')}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${_stripDupHeader(outputs.step_05||'','해결하고자 하는 과제')}`,`【과제의 해결 수단】\n${_stripDupHeader(outputs.step_17||'','과제의 해결 수단')}`,`【발명의 효과】\n${_stripDupHeader(outputs.step_16||'','발명의 효과')}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${buildImplementationBody()}`,`【부호의 설명】\n${_stripDupHeader(outputs.step_18||'','부호의 설명')}`,`【청구범위】\n${allClaims}`,`【요약서】\n${_stripDupHeader(outputs.step_19||'','요약서')}`].filter(Boolean).join('\n\n')+extras;
}
// ★ [Task1] ④ 미생성(예시도 있는데 step_08c 비었음) 경고 — 출력 직전 1회(누락 사실 안내, 차단은 안 함).
function _warnConceptDescMissing(){ if(_conceptDescMissing())App.showToast('⚠️ 예시도 상세설명 미생성 — 예시도 설명이 명세서에서 빠집니다. Step 8 "상세설명 생성(장치+예시도)"을 실행하면 예시도 설명도 함께 생성됩니다','warning'); }
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}_warnConceptDescMissing();navigator.clipboard.writeText(t).then(()=>App.showToast('복사 완료')).catch(()=>App.showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}_warnConceptDescMissing();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function downloadAsWord(){
  _warnConceptDescMissing();   // ★ [Task1] ④ 미생성 경고
  const brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  const allClaims=[outputs.step_06,outputs.step_10,outputs.step_20].filter(Boolean).join('\n\n');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:buildImplementationBody()},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:allClaims},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:normal;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;const body=_stripDupHeader(s.b,s.h);if(!body)return hd;return hd+body.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${App.escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const userFigHtml=buildUserFiguresHtml({word:true}); // ★ T4: 사용자 도면 이미지(base64) 삽입 — 도 번호 순
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}${userFigHtml}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);App.showToast('Word 다운로드 완료');
}


// ★ KIPRIS 키 설정은 common.js saveProfileSettings()에서 통합 관리 (v5.4)


// ═══════════════════════════════════════════════════════════════════
// [T8] WriterModule 연동 — 통합 리뷰 엔진(review-engine)과의 계약 2함수 (opinion T6와 동형).
//   기존 작성·자기검토 로직은 일절 변경하지 않는다(추가만). simulate/rollback은 patent.js에 안 넣음(옵션 B).
//   ★ patent 특수: applyAmendments 반영 후 3경로(SVG/PPTX/Canvas) 렌더 정합 재검증(E-11) — 공유 소스인
//     도면(mermaid) 부호 ↔ 부호의 설명(step_18) 교차 정합. 불일치 시 커밋하지 않고 롤백 + 렌더회귀 반환.
// ═══════════════════════════════════════════════════════════════════
