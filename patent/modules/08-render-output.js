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
  // 다중인용(2 이상 항 인용: 또는/내지/및) 공용 정규식 — 독립/종속 판별·금지 검출에 함께 사용.
  //   "제N항 내지 제M항 중 어느 한 항에 있어서"도 이 패턴에 포섭 → 종속으로 정확 분류(F-Q5 해소).
  const _MULTI=/(?:제\s*\d+\s*항|청구항\s*\d+)\s*(?:또는|내지|및)\s*(?:제\s*\d+\s*항|청구항\s*\d+)/;

  // 독립항 판별: 단일 인용("N항에 있어서")도 다중인용도 아닌 청구항 = 독립항
  const independentClaims=claimNums.filter(n=>{
    const ct=claims[n];
    return !/청구항\s*\d+\s*에\s*있어서/.test(ct)&&!/제\s*\d+\s*항에\s*있어서/.test(ct)&&!_MULTI.test(ct);
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
    // 다중인용 감지(_MULTI 공용): "제N항 {또는|내지|및} 제M항" — 및 포함(전면 금지 정책). "내지 … 중 어느 한 항"도 포섭.
    if(_MULTI.test(ct)){
      claimRefs[n].isMultiCite=true;
    }
  });
  
  Object.entries(claims).forEach(([num,ct])=>{const n=parseInt(num);
    // 종속항 판별: "N항에 있어서" 존재 여부
    const isDependent=/청구항\s*\d+에\s*있어서/.test(ct)||/제\s*\d+\s*항에\s*있어서/.test(ct)||_MULTI.test(ct);   // 다중인용도 종속으로 분류(F-Q5)
    if(isDependent){const rm=ct.match(/청구항\s*(\d+)에\s*있어서/)||ct.match(/제\s*(\d+)\s*항에\s*있어서/),rn=rm?parseInt(rm[1]):firstClaimNum;
      if(rm){if(!claims[rn])iss.push({severity:'HIGH',message:`청구항 ${num}: 참조 청구항 ${rn} 없음`});if(rn>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 자기/후행 청구항 참조`});}
      
      // ★ 대통령령 종속항 규칙 검증 ★
      const refs=claimRefs[n];
      if(refs){
        // ④ 번호 역전 금지: 인용 항은 자신보다 앞번호여야 함
        refs.cites.forEach(c=>{
          if(c>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 청구항 ${c}를 인용하나 뒤에 위치 (번호 역전 금지)`});
        });
        // ★ [정책 변경] 다중인용(2 이상 항 인용) 절대 금지 — 또는/내지/및 전 형태. 단일 항 인용만 허용(기본은 독립항).
        //   종전 "택일 강제(CHK-5)·다중인용의 다중인용 금지"를 상위 단일 규칙으로 통합 — 이중계상 방지.
        if(refs.isMultiCite){
          iss.push({severity:'HIGH',check:'multi_dependent_forbidden',message:`청구항 ${num}: 다중인용(2 이상 항 인용) 금지 — 단일 항 인용으로 변경(기본은 독립항 인용, 필요 시 직전 단일 종속항)`});
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
    // ★ [Item5] 젭슨(Jepson) 형식 기계검증 — 독립항 대상. 전환부 "~에 있어서," + 종결부 "~특징으로 하는" 존재·순서.
    //   젭슨은 선택 양식이므로 위반은 MEDIUM(강제 아님). 둘 다 없으면 젭슨 미채택 → 미검출. 하나만 있으면 불완전 → MEDIUM.
    if(!isDependent){
      const _tIdx=ct.search(/에\s*있어서\s*,/), _cIdx=ct.search(/(?:것을\s*)?특징으로\s*하는/);
      const _hasT=_tIdx>=0, _hasC=_cIdx>=0;
      if(_hasT!==_hasC)iss.push({severity:'MEDIUM',check:'jepson_form',message:`청구항 ${num}: 젭슨 형식 불완전 — ${_hasT?'전환부("~에 있어서,")만 있고 종결부("~특징으로 하는")가 없음':'종결부("~특징으로 하는")만 있고 전환부("~에 있어서,")가 없음'}`});
      else if(_hasT&&_hasC&&_tIdx>_cIdx)iss.push({severity:'MEDIUM',check:'jepson_form',message:`청구항 ${num}: 젭슨 형식 순서 오류 — 전환부("~에 있어서,")가 종결부보다 뒤에 위치`});
    }
    // ★ [Item5] 앵커/종속항 최소 검증 — 인용은 있으나 실질적 부가 한정이 없는 빈 종속항(앵커는 구체적 기술수단 부가 필요).
    //   기존 참조 무결성(존재·번호역전)과 중복 아님(부가 내용 유무만 봄). raw 길이 기준으로 오탐 최소화(MEDIUM).
    if(isDependent){
      const _after=ct.replace(/^[\s\S]*?에\s*있어서\s*,?/,'').trim();
      if(_after.replace(/\s+/g,'').length<8)iss.push({severity:'MEDIUM',check:'anchor_no_limitation',message:`청구항 ${num}: 종속항에 실질적 부가 한정이 없음(앵커 구성 미기재 의심)`});
    }
    // ★ [정책 변경] 종전 CHK-5(및→택일 강제)는 상위 multi_dependent_forbidden(다중인용 전면 금지)에 통합됨.
    //   "제N항 및 제M항"은 isMultiCite(및 포함)로 감지되어 위에서 HIGH 방출 — 별도 및-검사 제거(이중계상 방지).
    KILLER_WORDS.forEach(kw=>{if(kw.pattern.test(ct))iss.push({severity:'HIGH',message:`청구항 ${num}: ${kw.msg}`});});
  });return iss;
}
// ═══════════════════════════════════════════════════════════════════
// [Item 2] validateSpecification — 완성 명세서(buildSpecification 산출물)의 결정적 무결성 검사.
//   ★ 역할 분담(중복 구현 금지):
//     · validateClaims(위): 청구항 "내부" 규칙 — 파싱·독립항·참조 무결성·다중인용(CHK-5 및/택일).
//     · validateSpecification(여기): "본문·구조" 규칙 — 표제(CHK-1)·종결어미(CHK-2)·단위파손(CHK-3)
//       ·도면부호 병기 본문↔부호의설명 대조(CHK-4)·문단블록 중복(CHK-6)·문장 절단(CHK-7)·수학식 변수정의(CHK-8).
//   순수 함수(DOM 무접촉). 반환: [{severity:'CRITICAL'|'HIGH'|'MEDIUM', check, message, detail}]
//   근거: 진단 — 수학식 삽입 시 문단 중복·문장 절단이 "완성 본문 결정적 검사 부재"로 통과(26P1036 실증).
// ═══════════════════════════════════════════════════════════════════
const SPEC_SECTION_ORDER=['발명의 설명','발명의 명칭','기술분야','발명의 배경이 되는 기술','선행기술문헌','발명의 내용','해결하고자 하는 과제','과제의 해결 수단','발명의 효과','도면의 간단한 설명','발명을 실시하기 위한 구체적인 내용','부호의 설명','청구범위','요약서'];
const MATH_FUNC_WORDS=new Set(['min','max','log','ln','exp','sin','cos','tan','cot','sec','csc','sqrt','sum','prod','abs','mod','floor','ceil','round','argmax','argmin','lim','det','if','then','else','where','clip','clamp','sign','relu','sigmoid','softmax','tanh','norm']);
function validateSpecification(specText){
  const iss=[];
  if(!specText||!String(specText).trim())return iss;
  specText=String(specText);
  const norm=_stripMathNorm;   // ★ [cleanup D2] 공유 헬퍼(06) — stripMathBlocks(수학식 제거)+공백 전제거. 3중복(03·05·08) 통일
  const bodyNoMath=stripMathBlocks(specText);   // 수학식 블록 제거 — 수식 내 그리스문자·파편의 CHK-2/3/7 오탐 방지

  // ── CHK-1: 표제 완전성·순서 ── (【청구항 N】·【수학식 N】은 섹션표제 아님 → 캐논 표제만 대상)
  const seenOrder=[]; let hm; const headerRe=/【\s*([^】]+?)\s*】/g;
  while((hm=headerRe.exec(specText))!==null){ const h=hm[1].replace(/\s+/g,' ').trim(); if(SPEC_SECTION_ORDER.includes(h))seenOrder.push(h); }
  SPEC_SECTION_ORDER.forEach(h=>{ if(!seenOrder.includes(h))iss.push({severity:'HIGH',check:'heading_missing',message:`표제 누락: 【${h}】`,detail:'표준 명세서 표제가 완성본에 없음'}); });
  let oi=0,badH='';
  for(const h of seenOrder){ const p=SPEC_SECTION_ORDER.indexOf(h,oi); if(p<0){ const anyPos=SPEC_SECTION_ORDER.indexOf(h); if(anyPos>=0&&anyPos<oi){badH=h;break;} } else oi=p+1; }
  if(badH)iss.push({severity:'HIGH',check:'heading_order',message:`표제 순서 오류: 【${badH}】가 표준 순서를 벗어남(중복/역순)`,detail:'표제가 표준 명세서 순서와 다름'});

  // ── CHK-2: 종결어미 통일 (평서체 "~다." vs 경어체 혼재) ──
  const politeEnd=(bodyNoMath.match(/(?:습니다|합니다|입니다|됩니다|세요|해요|어요|아요|예요)\./g)||[]);
  const plainEnd=(bodyNoMath.match(/[가-힣]다\.(?!\d)/g)||[]);
  if(politeEnd.length>0&&plainEnd.length>0)iss.push({severity:'MEDIUM',check:'sentence_ending',message:`종결어미 혼재 — 경어체 ${politeEnd.length}건(명세서는 평서체 "~다." 통일)`,detail:`예: ${[...new Set(politeEnd)].slice(0,3).join(', ')}`});

  // ── CHK-3: 단위/인코딩 파손 ──
  if(/�/.test(specText))iss.push({severity:'HIGH',check:'unit_corruption',message:'인코딩 파손 문자(U+FFFD) 포함',detail:'치환문자(�) 검출 — 단위·특수문자 파손 의심'});
  const mojibake=(bodyNoMath.match(/\d\s*[Α-Ω]{1,2}[a-zA-Z]/g)||[]);   // 숫자+그리스대문자+라틴 (㎛→"ΜM" 모지바케)
  if(mojibake.length)iss.push({severity:'MEDIUM',check:'unit_corruption',message:`단위 표기 파손 의심 ${mojibake.length}건(그리스문자 혼입)`,detail:`예: ${[...new Set(mojibake)].slice(0,3).join(', ')} (㎛ 등 단위기호 유니코드 파손 가능)`});

  // ── CHK-4: 도면부호 병기 (본문 ↔ 부호의 설명 대조) ──
  const refSecM=specText.match(/【\s*부호의 설명\s*】([\s\S]*?)(?:\n【|$)/);
  if(refSecM){
    const refSec=refSecM[1];
    // ★ 명칭에 박힌 숫자(예: "제1 통신부", "S410")를 정의 부호로 오인하지 않도록 "홀로 선 숫자"만 수집.
    //   (기존 \b\d{1,4}\b 는 한글이 비단어문자라 "제1"의 1을 경계로 오탐 → refnum_consistency 거짓 발생)
    const defined=new Set((refSec.match(/(?<![0-9A-Za-z가-힣])\d{1,4}(?![0-9A-Za-z가-힣])/g)||[]).map(Number).filter(n=>n>=1&&n<=9999));
    const body=specText.replace(refSec,' ');
    const used=new Set((body.match(/\(\d{1,4}\)/g)||[]).map(s=>parseInt(s.replace(/[()]/g,''),10)).filter(n=>n>=1&&n<=9999));
    const usedNotDef=[...used].filter(n=>!defined.has(n)).sort((a,b)=>a-b);
    const defNotUsed=[...defined].filter(n=>!used.has(n)).sort((a,b)=>a-b);
    if(usedNotDef.length)iss.push({severity:'MEDIUM',check:'refnum_consistency',message:`본문 사용 부호 ${usedNotDef.length}개가 부호의 설명에 미정의`,detail:`미정의: ${usedNotDef.slice(0,10).join(', ')}${usedNotDef.length>10?' 외':''}`});
    if(defNotUsed.length)iss.push({severity:'MEDIUM',check:'refnum_consistency',message:`부호의 설명 정의 ${defNotUsed.length}개가 본문에 미사용`,detail:`미사용: ${defNotUsed.slice(0,10).join(', ')}${defNotUsed.length>10?' 외':''}`});
  }

  // ── CHK-6: 문단·블록 중복 (CRITICAL) ── (26P1036 5문단 연속 중복 직격)
  const paras=specText.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);   // ★ CHK-7(b)용 전체 문단(무변경)
  // ★ 중복 검사 소스에서 청구범위·요약서 제외 — 청구항/요약이 상세설명 문구를 반복하는 것은 §42④ 뒷받침상
  //   "정당 반복"이므로 중복(6a CRITICAL·6b HIGH)으로 오탐하면 안 됨. buildSpecification 순서상 청구범위·요약서는
  //   말미 → 둘 중 먼저 나오는 위치부터 잘라냄(순서 무관 방어). CHK-9 섹션 슬라이스 방식과 동형.
  const _iC=specText.search(/【\s*청구범위\s*】/), _iA=specText.search(/【\s*요약서\s*】/);
  const _cuts=[_iC,_iA].filter(i=>i>=0);
  const _bodyBeforeClaims=_cuts.length?specText.slice(0,Math.min(..._cuts)):specText;
  // ★ [§6-4b] 도면의 간단한 설명 섹션도 중복 소스에서 제외 — "도 N은 ~이다" 도입문이 상세설명 도입부에 동일 반복
  //   (프롬프트가 "이후 도면의 간단한 설명에서도 동일하게 사용"하라 지시)되므로 정당 반복이며 중복(6a/6b) 오탐 금지.
  const _briefM=_bodyBeforeClaims.match(/【\s*도면의 간단한 설명\s*】[\s\S]*?(?=\n【|$)/);
  const _bodyForDup=_briefM?_bodyBeforeClaims.replace(_briefM[0],' '):_bodyBeforeClaims;
  const parasForDup=_bodyForDup.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
  const paraKey={};
  //  ★ 표제 인접 중복 승격: 문단 앞머리 표제(【…】) 접두 제거 후 키 생성 → "【표제】\n<중복문단>"(첫 사본)과
  //    맨 본문 "<중복문단>"이 동일 키가 되어 CHK-6(a) CRITICAL 로 포착(표제로 키가 갈려 HIGH로 강등되던 결함 해소).
  parasForDup.forEach((p,i)=>{ const pBody=p.replace(/^【[^】]+】\s*\n?/,''); const k=norm(pBody); if(k.length<50)return; (paraKey[k]=paraKey[k]||[]).push(i); });
  let hasParaDup=false;
  Object.values(paraKey).forEach(idxs=>{ if(idxs.length>=2){ hasParaDup=true; iss.push({severity:'CRITICAL',check:'paragraph_duplicate',message:`문단 중복 ${idxs.length}회 (문단 #${idxs.join(', #')})`,detail:`"${parasForDup[idxs[0]].slice(0,60)}…"`}); } });
  // 문장 단위 — 문단중복으로 이미 잡혔으면 생략(중복 노이즈 방지).
  //   ★ spec의 "첫 40자 키"는 경계 부근 절단(첫 사본 끝 163자 탈락형)을 놓친다(40자 안에서 분기하면 미그룹).
  //     → 첫10·끝10 coarse 키로 후보만 모으고(값 판정 아님, 저비용 prefilter), 접두+접미가 짧은 쪽 전체를
  //       덮으면(=완전일치 또는 중간 탈락 복제) 확정. 같은 서두를 공유하는 상이 문장은 접미가 짧아 p+s<len → 오탐 아님.
  if(!hasParaDup){
    const sents=stripMathBlocks(_bodyForDup).split(/(?<=\.)\s+|\n+/).map(s=>s.trim()).filter(s=>norm(s).length>=40);   // ★ 청구범위·요약서·도면의 간단한 설명 제외(정당 반복 오탐 방지 §6-4b)
    const groups={};
    sents.forEach(s=>{ const k=norm(s); groups['p'+k.slice(0,10)]=(groups['p'+k.slice(0,10)]||[]).concat([s]); groups['s'+k.slice(-10)]=(groups['s'+k.slice(-10)]||[]).concat([s]); });
    const reported=new Set();
    Object.values(groups).forEach(arr=>{ if(arr.length<2)return;
      for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
        const a=norm(arr[i]),b=norm(arr[j]),lo=a.length<=b.length?a:b,hi=a.length<=b.length?b:a;
        let p=0; while(p<lo.length&&lo[p]===hi[p])p++;
        let s=0; while(s<lo.length-p&&lo[lo.length-1-s]===hi[hi.length-1-s])s++;
        const key=arr[i]<arr[j]?arr[i]+' '+arr[j]:arr[j]+' '+arr[i];
        if(p+s>=lo.length&&!reported.has(key)){ reported.add(key);
          iss.push({severity:'HIGH',check:'sentence_duplicate',message:'문장 중복/절단복제 의심(정규화 첫40·끝40 키 일치)',detail:`"${arr[i].slice(0,60)}…"`}); }
      }
    });
  }

  // ── CHK-7: 문장 절단 ── ★ 전체 specText 스캔(수학식 "여기서" 절 내부 절단도 검출 — 26P1036 λ정의 절단이 수학식 안이므로) ★
  //   수식엔 한글이 없어 "[가-힣]다\.숫자/한글" 패턴이 formula로 오탐되지 않음.
  (specText.match(/[가-힣]다\.\d/g)||[]).forEach(m=>iss.push({severity:'HIGH',check:'sentence_truncation',message:'문장 절단 의심 — 마침표 직후 숫자 붙음',detail:`"…${m}…" (종결 후 공백 없이 숫자 시작)`}));   // (a) "무차원량이다.2"
  (specText.match(/[가-힣](?:다|음|함|됨)\.[가-힣]/g)||[]).forEach(m=>iss.push({severity:'HIGH',check:'sentence_truncation',message:'문장 절단 의심 — 마침표 직후 한글 붙음',detail:`"…${m}…" (종결 후 공백 없이 이어짐)`}));   // (c)
  paras.forEach((p,i)=>{ if(/^\s*\d+(?:\.\d+)?\s*(?:이상|이하|내지|초과|미만)/.test(p))iss.push({severity:'HIGH',check:'sentence_truncation',message:`문단 #${i} 첫머리가 무주어 숫자범위로 시작 — 앞문장 절단 의심`,detail:`"${p.slice(0,40)}…"`}); });   // (b)

  // ── CHK-8: 수학식 변수 정의 완전성 ── 【수학식 N】 수식부 변수 ↔ "여기서" 절 정의 대조
  const blocks=specText.split(/(?=【\s*수학식)/).filter(b=>/^【\s*수학식/.test(b.trim()));
  blocks.forEach(b=>{
    const nm=b.match(/【\s*수학식\s*(\d+)\s*】/); const no=nm?nm[1]:'?';
    const afterHeader=b.replace(/^[\s\S]*?】/,'');
    const hereIdx=afterHeader.search(/여기서/);
    const formulaPart=(hereIdx>=0?afterHeader.slice(0,hereIdx):afterHeader.split(/\n\n/)[0])||'';
    let defPart=hereIdx>=0?afterHeader.slice(hereIdx):'';
    defPart=defPart.split(/\n\n|\n【|【/)[0];   // "여기서" 절 한 문단으로 한정(먼 곳 우연일치 방지)
    // ★ [§6-4a] 아래첨자(wᵢ 등) 유니코드도 변수 토큰에 포함해 온전히 추출(토큰화 실패 오탐 방지).
    const vars=[...new Set((formulaPart.match(/[A-Za-zΑ-ω_][A-Za-z0-9_₀-ₜᵢ-ᵪ]*/g)||[]))].filter(v=>!MATH_FUNC_WORDS.has(v.toLowerCase()));
    // ★ [§6-4a] 그룹 정의 인정 — "wc, wa, wr, we, wg는 …가중치" 처럼 쉼표 나열 뒤 는/은(또는 콜론·등호) 정의를
    //   각 변수에 대해 정의로 인정(개별 "X는"만 찾던 종전 로직이 나열 앞 변수를 미정의로 오탐하던 것 해소).
    const _dcl='[A-Za-zΑ-ω0-9_\\u2080-\\u209c\\u1d62-\\u1d6a]';
    // ★ [§1.5] "X 함수는/함수로/함수를" 형태도 정의로 인정(함수형 토큰 원천 오탐 차단).
    const undef=vars.filter(v=>{ const esc=v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return !new RegExp(esc+'(?:\\s*[,、·/]\\s*'+_dcl+'+)*\\s*(?:는|은|:|=|함수)').test(defPart); });
    if(undef.length)iss.push({severity:'HIGH',check:'math_var_undefined',message:`수학식 ${no}: 변수 ${undef.length}개 정의 없음`,detail:`미정의: ${undef.join(', ')} ("여기서" 절에 정의 필요)`});
  });

  // ── CHK-9 [Item 4]: 예시 규율 — 상세설명(실시내용) 구성요소 설명 문단에 예시/실시예 마커가 없으면 보충 권장 ──
  //   ★ 리포트만(MEDIUM) — 자동 보충 안 함. 오탐 최소화: 실시내용 섹션 내 & 참조번호(구성요소) 포함 & 40자↑ 문단만.
  //   청구범위·요약서·배경기술·표제·수학식·정형문(참조번호 없는 문단)은 대상 제외.
  const _implM=specText.match(/【\s*발명을 실시하기 위한 구체적인 내용\s*】([\s\S]*?)(?:\n【|$)/);
  if(_implM){
    const _EX=/(예를\s*들어|예컨대|일\s*예로|실시예로서|구체적으로|이를테면|가령)/;
    const _missing=_implM[1].split(/\n{2,}/).map(p=>p.trim()).filter(p=>
      p && !/^【/.test(p) && !/【수학식/.test(p) && /\(\d{2,4}\)/.test(p) && norm(p).length>=40 && !_EX.test(p));
    if(_missing.length)iss.push({severity:'MEDIUM',check:'example_missing',message:`상세설명에 예시/실시예 없는 구성요소 문단 ${_missing.length}개 — 예시 보충 권장(리포트)`,detail:`예: "${_missing[0].slice(0,40)}…"`});
  }

  // ── CHK-10 [§6-3b·§2.2]: 부호 이중 배정 — 부호의 설명 canonical(부호→전체명칭)을 기준축으로 ──
  //   ★ [§2.2 R1] 교차결합 캡처 제거: b-경로 캡처를 "(부호) 직전 인접 무공백 run 그대로"로(구성접미 요구 삭제).
  //     '부'-접미 요구가 비-부 명칭(메모리·프로세서)에서 캡처엔진을 gap 건너 앞 '부'토큰으로 밀어내던 오결합 차단.
  //     → 저장부·레지스트리부·메모리가 canonical과 접미관계 성립해 FP 전멸, 진성(재정렬부·품질검증부)만 잔존.
  //   ★ [§2.2 R2] c-경로 키를 절단 토큰이 아닌 "정규화 전체명칭"으로: canonical 있으면 그 명칭, 없으면 직전 인접
  //     run에서 앞쪽 한글 어절 최대 4개 흡수(조사·동사·표제 경계 정지)한 확장 명칭.
  //   ★ [§2.4 D1] 동일명칭 판정의 비교 키(완전일치든 공통접미든) 길이 ≥5자 미만이면 미발화(generic 3자 '저장부' 완전일치 오탐 소거).
  //   ★ [§2.4 D2] 확장 정지어에서 '이/가' 제거 — 내용어("자가"→'가')를 조사로 오인해 절단하던 결함 수정("자가 보완부"→자가보완부 확보).
  //   ★ [§2.4 D3(i)] 동일명칭 ≥3개 연속(간격 1 이내)번호 = 도면요소 generic 시리즈 → dupassign(HIGH) 대신 refnum_generic_series(MEDIUM) 1건으로 압축.
  //   ★ [§2.2] (b) 동일부호·상이명칭  (c) 동일명칭·상이부호  (d) b·c 이중보고 dedupe  (R3) detail 양측 명칭 표기.
  {
    const _bodyRN=refSecM?specText.replace(refSecM[1],' '):specText;
    const _sufAlt='부|서버|단말|모듈|장치|시스템|데이터베이스|수단|엔진|유닛|저장소|메모리|매핑|레지스트리';
    const _sufEnd=new RegExp('(?:'+_sufAlt+')$');
    // canonical: 부호의 설명 "명칭 : 번호"(또는 "번호 : 명칭") → 부호→정규화 전체명칭
    const _canonMap=new Map();
    if(refSecM){ refSecM[1].split(/\n/).forEach(line=>{
      const _lm=line.trim().match(/^(.+?)\s*[:：]\s*(.+)$/); if(!_lm)return;
      let a=_lm[1].trim(), b=_lm[2].trim(), num, name;
      if(/^\d{1,4}$/.test(b)){num=b;name=a;} else if(/^\d{1,4}$/.test(a)){num=a;name=b;} else return;
      name=name.replace(/\s+/g,'').replace(/^상기/,'').replace(/[.,;()]+$/,'');
      if(_sufEnd.test(name))_canonMap.set(num,name);
    }); }
    // body: (부호) 직전 인접 무공백 run(raw, 구성접미 요구 없음) + 앞쪽 확장 전체명칭(full, canonical 없을 때 c-경로용)
    //   ★ [§2.4 D2] 정지어에서 단음절 주격 '이/가' 제외 — "자가"·"추가"·"차이" 등 내용어가 조사로 오인돼 확장이 끊기던 결함 차단.
    const _STOP=/(하는|되는|하며|되며|하고|되고|하여|되어|된|및|또는|의|를|을|은|는|에서|으로|와|과|에|로|한)$/;   // 조사·동사 어절 정지(이/가 제외)
    const _rnRe=/([가-힣A-Za-z·]+)\((\d{2,4})\)/g; let _rm2;
    const _pairs=[];
    while((_rm2=_rnRe.exec(_bodyRN))!==null){
      const raw=_rm2[1].replace(/^상기/,''); const ref=_rm2[2]; if(raw.length<2)continue;
      let full=raw; const pre=_bodyRN.slice(Math.max(0,_rm2.index-40),_rm2.index).split(/\s+/);
      for(let k=pre.length-1,cnt=0;k>=0&&cnt<4;k--){ const w=pre[k]; if(!w)continue;
        if(_STOP.test(w)||/^(상기|그|본|해당|각)$/.test(w)||!/^[가-힣A-Za-z·]+$/.test(w))break;   // 표제·구두점·조사 어절에서 정지
        full=w+full; cnt++; }
      _pairs.push({raw, ref, full:(_canonMap.get(ref)||full.replace(/^상기/,''))});
    }
    const _sufRel=(x,y)=>x===y||x.endsWith(y)||y.endsWith(x);                                     // (b) 접미관계(길이 무관)
    const _nameSame=(x,y)=>{ const s=x.length<=y.length?x:y, l=x.length<=y.length?y:x; return l.endsWith(s)&&s.length>=5; };   // (c) [§2.4 D1] 완전일치·공통접미 모두 ≥5자 요구
    const _atoms=new Set();   // (d) dedupe 원자: "명칭|부호"
    // (b) 동일부호·상이명칭 — raw 인접 토큰을 canonical과 접미관계 대조(canonical 없으면 body 내부 클러스터링)
    const _byRef=new Map(); _pairs.forEach(p=>{ if(!_byRef.has(p.ref))_byRef.set(p.ref,new Set()); _byRef.get(p.ref).add(p.raw); });
    _byRef.forEach((set,ref)=>{
      const C=_canonMap.get(ref);
      const cand=C?[...set].filter(t=>!_sufRel(t,C)):[...set];          // canonical과 접미관계 아닌 것(없으면 body 전체)
      const cl=[]; cand.forEach(t=>{ if(!cl.some(c=>_sufRel(c,t)))cl.push(t); });   // 상호 접미동일은 1개 클러스터로 축약
      const fire=C?cl.length>=1:cl.length>=2;                           // canonical 있으면 정의 불일치 1개도 발화, 없으면 내부 상충 ≥2
      if(fire){ cl.forEach(t=>_atoms.add(t+'|'+ref));
        iss.push({severity:'HIGH',check:'refnum_dupassign',
          message:C?`부호 (${ref})에 부호의 설명 정의("${C}")와 다른 구성요소 명칭 배정`:`부호 (${ref})에 서로 다른 구성요소 명칭 ${cl.length}개 배정`,
          detail:C?`canonical="${C}" ↔ body="${cl.slice(0,3).join(', ')}"`:cl.slice(0,3).join(' / ')}); }   // (R3) 양측 표기
    });
    // (c) 동일명칭·상이부호 — 전체명칭(full) 그룹핑(≥5 접미 병합)
    const _names=[...new Set(_pairs.map(p=>p.full))];
    const _groups=[]; _names.forEach(n=>{ let g=_groups.find(gr=>_nameSame(gr.rep,n)); if(!g){g={rep:n,mem:new Set(),refs:new Set()};_groups.push(g);} g.mem.add(n); });
    _pairs.forEach(p=>{ const g=_groups.find(gr=>gr.mem.has(p.full)); if(g)g.refs.add(p.ref); });
    _groups.forEach(g=>{ if(g.refs.size<2||g.rep.length<5)return;   // [§2.4 D1] 비교 키(rep) <5자면 미발화 — generic 3자 완전일치 소거
      const _rs=[...g.refs].map(Number).sort((a,b)=>a-b);
      // [§2.4 D3(i)] 동일명칭 ≥3개 연속(간격 1 이내)번호 = 도면요소 generic 시리즈 → dupassign 대신 MEDIUM 1건으로 압축 보고
      if(_rs.length>=3 && (_rs[_rs.length-1]-_rs[0])<=_rs.length){
        iss.push({severity:'MEDIUM',check:'refnum_generic_series',message:`동일 명칭 "${g.rep}"이 연속 부호 ${_rs.length}개(${_rs[0]}~${_rs[_rs.length-1]})에 시리즈 배정`,detail:'도면요소 generic 시리즈 — 구성요소별 개별 명명 권고(리포트)'}); return;
      }
      if([...g.mem].every(m=>_rs.every(r=>_atoms.has(m+'|'+r))))return;   // (d) b에서 전부 보고된 원자면 생략
      iss.push({severity:'HIGH',check:'refnum_dupassign',message:`동일 명칭 "${g.rep}"에 부호 ${_rs.length}개 배정`,detail:_rs.join(', ')});
    });
  }

  // ── CHK-11 [§6-3a]: 수학식 참조 정합 — "다음의/상기 수학식 N"의 존재·방향 ──
  {
    const _mh=[]; let _m; const _mhRe=/【\s*수학식\s*(\d+)\s*】/g; while((_m=_mhRe.exec(specText))!==null)_mh.push({no:_m[1],pos:_m.index});
    const _refRe=/(다음의|하기의|아래의|상기|전술한)?\s*수학식\s*(\d+)/g; let _r;
    while((_r=_refRe.exec(specText))!==null){ const dir=_r[1]||'', no=_r[2], pos=_r.index;
      if(_mh.some(h=>Math.abs(h.pos-pos)<=1))continue;   // 【수학식 N】 헤더 자체는 참조 아님
      const head=_mh.find(h=>h.no===no);
      if(!head){ iss.push({severity:'MEDIUM',check:'math_ref_mismatch',message:`수학식 ${no} 참조가 있으나 해당 수학식이 명세서에 부재`,detail:`"…수학식 ${no}…"`}); continue; }
      if((dir==='다음의'||dir==='하기의'||dir==='아래의')&&head.pos<pos)iss.push({severity:'MEDIUM',check:'math_ref_mismatch',message:`"${dir} 수학식 ${no}"이나 해당 수식이 참조보다 앞에 위치(방향 불일치)`,detail:`뒤에 나올 수식을 가리키는데 실제로는 앞에 있음`});
      if((dir==='상기'||dir==='전술한')&&head.pos>pos)iss.push({severity:'MEDIUM',check:'math_ref_mismatch',message:`"${dir} 수학식 ${no}"이나 해당 수식이 참조보다 뒤에 위치(방향 불일치)`,detail:`앞에 나온 수식을 가리키는데 실제로는 뒤에 있음`});
    }
  }

  // ── CHK-12 [§6-3c]: 청구항 구성요소 명칭의 상세설명 문언 존재(뒷받침 1차 근사) ──
  {
    // ★ 청구범위는 【청구항 N】 하위표제를 포함(그 앞에서 잘리지 않게), 상세설명은 【수학식 N】 블록을 포함(그 앞에서 잘리지 않게).
    const _clM=specText.match(/【\s*청구범위\s*】([\s\S]*?)(?:\n【(?!\s*청구항)|$)/);
    const _imM=specText.match(/【\s*발명을 실시하기 위한 구체적인 내용\s*】([\s\S]*?)(?:\n【(?!\s*수학식)|$)/);
    if(_clM&&_imM){
      const _compSuf=/(부|수단|모듈|엔진)$/; const _comp=new Set();
      // ★ [§2.1] 무공백 구성명사 head 토큰만(수식어 절 배제, 무공백 run이라 앞 절이 안 붙음) + '로부터'의 '부' 절단 방지((?!터)).
      //   ★ [§2.2] 지시관형사(상기) 접두 제거 후 청구항 구성요소 토큰 확정. 청구범위 전체(독립·종속항) 캡처하므로
      //     종속항의 "…하는 X부" 구성요소도 추출 대상이다.
      const _cnRe=/([가-힣]{2,15}?(?:부|수단|모듈|엔진))(?!터)/g; let _cn;
      while((_cn=_cnRe.exec(_clM[1]))!==null){ const nn=_cn[1].replace(/^상기/,''); if(nn.length>=3&&_compSuf.test(nn))_comp.add(nn); }
      const _imNorm=_imM[1].replace(/\s+/g,'');
      // ★ [§2.2] 뒷받침 판정은 "정규화 부분문자열 그대로 존재"만 인정(접미관계 금지) — 청구항 토큰 "재정렬부"가
      //   상세설명에 그대로 있어야 present. "정렬부"⊂"재정렬부"로 존재 처리하지 않는다(정확 부분문자열 검사).
      const _miss=[..._comp].filter(n=>!_imNorm.includes(n));
      if(_miss.length)iss.push({severity:'MEDIUM',check:'claim_support_missing',message:`청구항 구성요소 ${_miss.length}개가 상세설명에 동일 문언 부재(뒷받침 확인 필요)`,detail:_miss.slice(0,5).join(', ')});
    }
  }

  // ── CHK-13 [§6-1]: 용어 세대 불일치 — staleTerms(구세대 명칭 diff청크)가 완성본에 잔존 ──
  //   ★ 명칭/구성 확정 후 재생성되지 않은 구세대 산출물(도면설명·부호표 등)이 완성본에 혼입되면 §42④ 명확성 위험.
  //   ★ [보강4 스텝 귀속] staleTerm이 등장하는 섹션(표제)을 지목. [결정 b] HIGH.
  const _tgClaimed=new Set();   // [배치5 ②] CHK-13이 지목한 (정규화 용어|섹션) — CHK-14 동일건 선점 억제용
  try{
    const _stale=(typeof _activeStaleTerms==='function')?_activeStaleTerms():[];
    if(_stale && _stale.length){
      const _specNorm=specText.replace(/\s+/g,'');
      const _secRe=/【\s*([^】]+?)\s*】/g; const _secs=[]; let _sm;
      while((_sm=_secRe.exec(specText))!==null)_secs.push({name:_sm[1].replace(/\s+/g,' ').trim(),pos:_sm.index});
      const _secAt=_p=>{ let _s='(본문)'; for(let i=_secs.length-1;i>=0;i--){ if(_secs[i].pos<=_p){ _s=_secs[i].name; break; } } return _s; };
      _stale.forEach(term=>{
        if(!term||term.length<5)return;
        if(_specNorm.indexOf(term)<0)return;
        // ★ [3.1a] 용어가 등장하는 각 섹션마다 1건(같은 섹션 중복은 1건) — 재생성 대상 스텝을 섹션별로 지목.
        const _flex=term.split('').map(ch=>ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s*');
        let _re; try{ _re=new RegExp(_flex,'g'); }catch(_e){ return; }
        const _hitSecs=new Set(); let _mm;
        while((_mm=_re.exec(specText))!==null){
          const _sec=_secAt(_mm.index);
          if(!_hitSecs.has(_sec)){ _hitSecs.add(_sec); _tgClaimed.add(term+'|'+_sec);   // [배치5 ②] 선점 기록
            iss.push({severity:'HIGH',check:'term_generation_mismatch',message:`구세대 용어 "${term}"이 완성본에 잔존(섹션: ${_sec}) — 해당 스텝 재생성 필요`,detail:'명칭 확정 후 재생성되지 않은 구세대 산출물 혼입 의심(§42④ 명확성 위험) — 자동 치환 금지, 스텝 재생성 권장'});
          }
          if(_mm.index===_re.lastIndex)_re.lastIndex++;   // zero-width 방어
        }
      });
    }
  }catch(_e){}

  // ── CHK-14 [§6-1 소급]: title_generation_suspect — 변경 이력 없는 기존 혼입 프로젝트 대비 휴리스틱(MEDIUM) ──
  //   ★ CHK-13은 이 세션의 명칭 변경 이력(staleTerms)에 의존한다. 그 사각(기존 혼입·부호표까지 구세대라 dupassign도
  //     동세대 정합으로 침묵)을 메우려, 【발명의 명칭】 확정 명칭 vs 도면의 간단한 설명·부호의 설명에서 추출한 명칭구
  //     (…서버/시스템/장치/방법, ≥8자)를 [3.1a] diff로 대조해 old-only 청크(≥5자)가 있으면 발화. 휴리스틱이라 MEDIUM.
  try{
    // ★ [3.2] 다행 캡처 — 구형 내보내기의 명칭 문단은 내부 개행("CAD\n…서버 및 방법{Server…}")을 포함하므로
    //   단일행 캡처는 첫 줄만 잡아 title 어절이 비어 전 명칭구가 old-only로 오탐된다. 다음 표제 전까지 통째 캡처 후 정규화.
    const _tM=specText.match(/【\s*발명의 명칭\s*】\s*([\s\S]*?)(?=\n\s*【|$)/);
    if(_tM && typeof _termDiffChunks==='function' && typeof _extractTitlePhrases==='function'){
      const _title=_tM[1].replace(/\{[^}]*\}/g,'').replace(/\s+/g,' ').trim(); const _seenTS=new Set();   // {영문} 병기 제거 → 공백 접기 → trim
      // ★ [배치5 ③] 공유어절 게이트 — 명칭구가 확정 명칭과 어절(길이≥2) ≥1개를 공유할 때만 diff 대상.
      //   비제목 정당 언급("클라우드 저장 시스템", 공유 0)은 차단하고, 세대 변형("…적응형 모델 라우팅 시스템",
      //   '라우팅' 공유)은 통과시킨다. (접미군{서버,방법} 게이트는 docA 도1 시스템-접미 진성을 소실시켜 기각 — 실측 근거.)
      const _tiW=new Set(_title.split(/\s+/).filter(w=>w.length>=2));
      ['도면의 간단한 설명','부호의 설명'].forEach(tn=>{
        const _m=specText.match(new RegExp('【\\s*'+tn+'\\s*】([\\s\\S]*?)(?:\\n【|$)'));
        if(!_m)return;
        _extractTitlePhrases(_m[1]).forEach(ph=>{
          if(!ph.split(/\s+/).some(w=>w.length>=2&&_tiW.has(w)))return;   // [배치5 ③] 공유어절 0 → 비제목 명칭구로 보고 제외
          _termDiffChunks(ph, _title).forEach(c=>{ const _k=c+'|'+tn; if(_seenTS.has(_k))return; _seenTS.add(_k);
            if(_tgClaimed.has(_k))return;   // [배치5 ②] CHK-13이 같은 (용어,섹션)을 이미 지목 → HIGH 1건만 잔존(이중 표출 억제)
            iss.push({severity:'MEDIUM',check:'title_generation_suspect',message:`구세대 명칭 조각 "${c}"이 ${tn}의 명칭구에 잔존(확정 명칭과 diff) — 세대 혼입 의심`,detail:'변경 이력 없는 소급 검출(휴리스틱) — 해당 섹션을 현재 발명의 명칭 세대로 재생성 권장'}); });
        });
      });
    }
  }catch(_e){}

  return iss;
}

// ═══ [기계검증↔Step13 통합] ═══
// 완성-조립 시점에만 판정 가능한 검사(표제 완전성/순서, 부호의 설명 대조, 용어 세대 불일치)는 Step 13(상세설명 단계)에서
//   볼 수 없거나 전 스텝 스캔이 필요하다.
//   → Step13 주입·자동수정 대상에서 제외하고, 완성본 패널이 담당한다(CHK-13은 '자동 치환 금지 — 스텝 재생성 유도').
// ★ [배치5 ①] 부호계(dupassign·generic_series)도 제외 — Step13 주입은 "수정 지시"로 소비되고 applyReview가 본문에만
//   적용하므로(부호표 step_18·도면 step_07 미동기), 부호 결함이 주입되면 본문-단독 치환으로 불일치를 재생산한다(감사 §1).
//   claim_support_missing은 desc-only 소스에서 구조적 미주입(청구범위 부재)이던 죽은 필터 — 의미 정합상 함께 이동.
//   CHK-6 중복·CHK-8 수식변수·CHK-11 math_ref는 상세설명 내 자기완결 수정이 가능하므로 주입 유지.
const _FINAL_ONLY_CHECKS = new Set(['heading_missing','heading_order','refnum_consistency','term_generation_mismatch','title_generation_suspect','refnum_dupassign','refnum_generic_series','claim_support_missing']);
// 완성본 패널에서 'AI로 수정'으로 자동 보정 가능한 검사(표제 누락/순서는 스텝 재실행 사안이라 제외).
const FIXABLE_CHECKS = new Set(['paragraph_duplicate','sentence_duplicate','sentence_truncation','sentence_ending','unit_corruption','math_var_undefined','example_missing','refnum_consistency']);

// [Part1] Step 13(AI 검토) 강화 — 결정론적 기계검증 결과를 검토 프롬프트에 주입한다.
//   Step 13이 보는 범위(상세설명·수학식)에 존재하는 결함만 필터(완성-단계 전용 검사 제외) → AI가 [5] 보완/수정 제안에 반영.
function machineFindingsForReview(){
  try{
    const desc=(typeof getLatestDescription==='function'?getLatestDescription():'')||'';
    const md=(typeof getLatestMethodDescription==='function'?getLatestMethodDescription():'')||'';
    const src=[desc,md].filter(Boolean).join('\n\n');
    if(!src.trim())return '';
    const iss=validateSpecification(src).filter(i=>!_FINAL_ONLY_CHECKS.has(i.check));
    if(!iss.length)return '';
    const lines=iss.slice(0,15).map(i=>`- [${i.severity}·${i.check}] ${i.message}${i.detail?` (${i.detail})`:''}`);
    if(iss.length>15)lines.push(`- 외 ${iss.length-15}건`);
    return lines.join('\n');
  }catch(_e){return '';}
}
// [Item 2] 완성본 기계검증 패널 렌더 — 산출물 탭(page4) 미리보기 진입 시 자동 실행. severity 색은 인라인(patent.css 무변경).
function renderSpecValidation(){
  const el=document.getElementById('specValidateResult'); if(!el)return;
  const spec=buildSpecification();
  if(!spec.trim()){el.innerHTML='<div class="issue-item issue-pass"><span class="ico" data-icon="check-circle"></span>검증할 완성 명세서가 없어요</div>';return;}
  const iss=validateSpecification(spec);
  const crit=iss.filter(i=>i.severity==='CRITICAL').length, high=iss.filter(i=>i.severity==='HIGH').length, med=iss.filter(i=>i.severity==='MEDIUM').length;
  let h=`<div class="stat-row" style="margin-bottom:10px"><div class="stat-card stat-card-cost"><div class="stat-card-value">${crit}</div><div class="stat-card-label">CRITICAL</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${high}</div><div class="stat-card-label">HIGH</div></div><div class="stat-card stat-card-steps"><div class="stat-card-value">${med}</div><div class="stat-card-label">MEDIUM</div></div></div>`;
  if(!iss.length){h+='<div class="issue-item issue-pass" style="border-left:3px solid var(--color-success,#3DAE7A);padding:8px 10px;border-radius:6px;background:rgba(61,174,122,0.08)"><span class="ico" data-icon="check-circle"></span> 완성본 기계검증 통과 — 표제·중복·절단·수학식 이상 없음</div>';}
  else{h+=iss.map(i=>{
    const col=i.severity==='CRITICAL'?'var(--color-error,#D94A4A)':(i.severity==='HIGH'?'var(--color-warning,#E8A33D)':'var(--dt-g400,#B0B0B0)');
    const cls=i.severity==='CRITICAL'?'issue-critical':'issue-high';
    return `<div class="issue-item ${cls}" style="border-left:3px solid ${col};padding:8px 10px;margin:4px 0;border-radius:6px;background:rgba(0,0,0,0.02)"><b>[${i.severity}·${App.escapeHtml(i.check)}]</b> ${App.escapeHtml(i.message)}${i.detail?`<br><span style="font-size:11px;color:var(--color-text-tertiary)">${App.escapeHtml(i.detail)}</span>`:''}</div>`;
  }).join('');}
  // [Part2] 'AI로 수정' — 자동 보정 가능한 검사(중복·절단·수식변수·예시·부호정합)가 있을 때만 노출.
  const _fixN=iss.filter(i=>FIXABLE_CHECKS.has(i.check)).length;
  if(_fixN)h+=`<button class="btn btn-primary btn-full" id="btnFixSpecValidate" style="margin-top:10px" onclick="fixSpecValidationIssues()"><span class="ico" data-icon="settings"></span> AI로 수정 (${_fixN}건 자동 보정)</button><p style="font-size:11px;color:var(--color-text-tertiary);margin-top:6px">중복 사본 제거·문장 절단·수학식 변수 정의·예시 보충·부호정합을 상세설명/부호의 설명에 반영합니다. 표제 누락·순서는 해당 스텝 재실행이 필요합니다.</p><div id="progressFixSpecValidate"></div>`;
  el.innerHTML=h;
}
// [Item 2] 다운로드/복사 직전 CRITICAL 경고(차단 아님 — division 선례 B: 경고+진행). 열린 결정은 PR 본문 참조.
function _warnSpecValidation(){ try{ const sv=validateSpecification(buildSpecification()); const c=sv.filter(i=>i.severity==='CRITICAL').length; if(c)App.showToast(`⚠️ 완성본 검증 CRITICAL ${c}건(문단 중복/절단 의심) — 산출물 탭 검증 패널 확인 권장`,'warning'); }catch(_e){} }
// [§6-2] 다운로드 게이트 — CRITICAL 결함이 있으면 명시적 확인을 요구하고, 취소 시 다운로드를 차단한다(HIGH 이하는 경고만/현행).
//   근거: 경고 체제에서 CRITICAL 3건이 실제 다운로드까지 나간 실증(문서B). 하드 차단이 아니라 "그래도 다운로드" 명시 클릭.
function _downloadGate(_spec){
  try{
    const sv=validateSpecification(_spec||buildSpecification());
    const crit=sv.filter(i=>i.severity==='CRITICAL');
    if(crit.length){
      const _list=crit.slice(0,3).map(i=>'· '+(i.message||i.check)).join('\n');
      const _msg=`완성본 검증에서 CRITICAL 결함 ${crit.length}건이 검출되었습니다.\n${_list}${crit.length>3?'\n  …':''}\n\n그래도 다운로드하시겠습니까?\n(취소하면 중단하고 산출물 탭 검증 패널에서 확인·수정할 수 있습니다)`;
      const _proceed=(typeof confirm==='function')?confirm(_msg):true;   // headless/테스트 환경은 통과
      if(!_proceed){ try{App.showToast('CRITICAL 결함으로 다운로드를 취소했습니다 — 검증 패널에서 수정하세요','info');}catch(_e){} return false; }
    }
  }catch(_e){}
  return true;
}

// ═══ [Part2] 완성본 기계검증 'AI로 수정' ═══
// 결정론적 문단 중복 제거 — 검증기 CHK-6 중복 판정 하한(norm-body ≥40자)과 정합, 첫 사본 보존.
//   전체-문단 완전일치만 제거(삭제형이라 코드로 안전). 문단 내부 부분 중복은 (C)/수동 소관.
function _dedupParagraphs(text){
  if(!text)return {text:text,removed:0};
  const norm=(typeof _stripMathNorm==='function')?_stripMathNorm:(s=>String(s||'').replace(/\s+/g,''));
  const paras=String(text).split(/\n{2,}/);
  const seen=new Set(); let removed=0;
  const kept=paras.filter(p=>{ const body=p.replace(/^【[^】]+】\s*\n?/,''); const k=norm(body); if(k.length<40)return true; if(seen.has(k)){removed++;return false;} seen.add(k); return true; });
  return {text:kept.join('\n\n'), removed:removed};
}
// 본문 "명칭(부호)" 쌍 수집(부호의 설명 재생성용). 부호별 최빈 명칭 채택. 부호의 설명 섹션은 제외.
function _collectBodyRefPairs(){
  const spec=buildSpecification();
  const refM=spec.match(/【\s*부호의 설명\s*】([\s\S]*?)(?:\n【|$)/);
  const body=refM?spec.replace(refM[1],' '):spec;
  const map=new Map();
  const re=/([가-힣A-Za-z][가-힣A-Za-z\s]{0,12}?)\s*\((\d{1,4})\)/g; let m;
  while((m=re.exec(body))!==null){ const name=m[1].replace(/^상기\s*/,'').trim(); const ref=parseInt(m[2],10); if(!(ref>=1&&ref<=9999))continue; if(!map.has(ref))map.set(ref,new Map()); if(name.length>=2){ const nm=map.get(ref); nm.set(name,(nm.get(name)||0)+1); } }
  let b; const bare=/\((\d{1,4})\)/g; while((b=bare.exec(body))!==null){ const ref=parseInt(b[1],10); if(ref>=1&&ref<=9999&&!map.has(ref))map.set(ref,new Map()); }
  return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(function(e){ const ref=e[0],nm=e[1]; let best='',bc=0; nm.forEach(function(c,n){ if(c>bc){bc=c;best=n;} }); return {ref:ref,name:best}; });
}
// [통합생성] 부호의 설명(step_18) 결정적 직렬화 — 완성 본문에서 실제 사용된 모든 장치부호(NN)를 전수 정의(usedNotDef=0),
//   본문 미사용 부호는 제외(defNotUsed=0) → refnum_consistency 구조적 0. 명칭은 REFTABLE(refMap) 우선, 없으면 본문 최빈 명칭.
//   ★ device/method 뿐 아니라 효과·과제 등 기존 섹션의 (NN)까지 전수 커버(완성본 기준) → 부분 재생성에도 부호정합 성립.
function _deriveSignDescription(refMap){
  const pairs=_collectBodyRefPairs();   // [{ref:number, name}] — 완성 본문(부호의설명 섹션 제외) 전수
  const devLines=pairs.map(function(p){ const key=String(p.ref); const nm=(refMap&&typeof refMap.get==='function'&&refMap.get(key))||p.name||'구성요소'; return nm+' : '+p.ref; });
  let out=devLines.join('\n');
  const met=refMap?[...refMap].filter(function(e){return String(e[0]).startsWith('S');}).sort(function(a,b){return parseInt(String(a[0]).slice(1),10)-parseInt(String(b[0]).slice(1),10);}):[];
  if(met.length)out+=(out?'\n\n[방법 단계]\n':'')+met.map(function(e){return e[1]+' : '+e[0];}).join('\n');
  return out;
}
// 'AI로 수정' 진입점 — (A)중복 제거(코드) → (B)부호의 설명 재생성(LLM) → (C)상세설명 의미 보정(편집지시 LLM) → 재조립·재검증.
async function fixSpecValidationIssues(){
  if(typeof globalProcessing!=='undefined'&&globalProcessing){App.showToast('처리 중입니다','info');return;}
  const spec0=buildSpecification();
  if(!spec0.trim()){App.showToast('완성 명세서가 없어요','error');return;}
  const iss=validateSpecification(spec0).filter(function(i){return FIXABLE_CHECKS.has(i.check);});
  if(!iss.length){App.showToast('자동 수정 가능한 이슈가 없어요','info');return;}
  const has=function(c){return iss.some(function(i){return i.check===c;});};
  if(typeof setGlobalProcessing==='function')setGlobalProcessing(true);
  const btn=document.getElementById('btnFixSpecValidate'); if(btn)btn.disabled=true;
  const done=[];
  try{
    // ── (A) 문단 중복 사본 제거 — 코드 결정론적(장치/방법 상세설명) ──
    if(has('paragraph_duplicate')||has('sentence_duplicate')){
      App.showProgress('progressFixSpecValidate','중복 사본 제거 중...',1,3);
      let rm=0;
      const dev=getLatestDescription();
      if(dev){ const r=_dedupParagraphs(dev); if(r.removed){ pushOutputHistory('step_13_applied','fix','fixSpecValidation'); outputs.step_13_applied=r.text; markOutputTimestamp('step_13_applied'); rm+=r.removed; } }
      if(outputs.step_12){ const md=getLatestMethodDescription(); const r2=_dedupParagraphs(md); if(r2.removed){ pushOutputHistory('step_13_applied_method','fix','fixSpecValidation'); outputs.step_13_applied_method=r2.text; markOutputTimestamp('step_13_applied_method'); rm+=r2.removed; } }
      if(rm)done.push(`중복 문단 ${rm}개 제거`);
    }
    // ── (B) 부호의 설명(step_18) 재생성 — 본문 사용 부호 전수 정의(1:1 정합) ──
    if(has('refnum_consistency')){
      App.showProgress('progressFixSpecValidate','부호의 설명 정합 보정 중...',2,3);
      const pairs=_collectBodyRefPairs();
      if(pairs.length){
        const listTxt=pairs.map(function(p){return p.ref+': '+(p.name||'(명칭 미상)');}).join('\n');
        const r=await App.callClaude(`아래는 특허 명세서 본문에서 실제 사용된 도면부호와 그 명칭이다. 【부호의 설명】 목록을 작성하라.\n\n[규칙]\n- 아래 목록의 모든 부호를 빠짐없이 포함하라(본문 사용 = 부호의 설명 정의, 1:1 정합).\n- 형식: "명칭 : 번호" 한 줄에 하나, 번호 오름차순.\n- (명칭 미상) 부호는 본문 문맥에 맞는 구성요소 명칭을 부여하라.\n- ⛔ 표제(【부호의 설명】) 줄·설명 문장 금지. "명칭 : 번호" 목록만 출력.\n\n[본문 사용 부호]\n${listTxt}`,4096);
        const cleaned=String(r.text||'').replace(/^\s*【[^】]*】\s*/,'').trim();
        if(cleaned){ pushOutputHistory('step_18','fix','fixSpecValidation'); outputs.step_18=cleaned; markOutputTimestamp('step_18'); done.push('부호의 설명 정합'); }
      }
    }
    // ── (C) 상세설명 의미 보정 — 절단·수식변수 미정의·예시 누락(편집지시 LLM, 삭제 없음) ──
    const semIss=iss.filter(function(i){return ['sentence_truncation','math_var_undefined','example_missing'].indexOf(i.check)>=0;});
    if(semIss.length){
      App.showProgress('progressFixSpecValidate','상세설명 의미 보정 중...',3,3);
      const cur=getLatestDescription();
      if(cur){
        const issueTxt=semIss.map(function(i){return `- [${i.check}] ${i.message}${i.detail?' ('+i.detail+')':''}`;}).join('\n');
        const ei=await App.callClaude(`아래 [기계검증 결함]을 반영하기 위한 편집 지시만 생성하라. 상세설명 전체를 다시 쓰지 마라.\n\n[편집 지시 형식]\n---EDIT_1---\nANCHOR: (수정할 위치의 기존 문장 정확히 복사. 20자 이상)\nACTION: ADD_AFTER 또는 MODIFY 또는 ADD_BEFORE\nCONTENT: (추가/수정할 순수 특허 문장. 특허문체(~한다). 구성요소(참조번호) 형태.)\nREASON: (반영하는 결함)\n\n[규칙]\n- ANCHOR는 [현재 상세설명]에 실제 존재하는 문장.\n- 문장 절단 → 절단 문장을 완결 문장으로 MODIFY.\n- 수학식 변수 미정의 → 해당 수식 근처 문장 뒤에 "여기서, X는 …이다." 정의를 ADD_AFTER.\n- 예시 누락 → 해당 구성요소 문단 뒤에 "예를 들어, …" 실시예를 ADD_AFTER.\n- ⛔ 【청구항 N】·청구항 번호·【수학식 N】 블록 생성 금지. ⛔ 문장 삭제 금지(ADD/MODIFY만).\n- ⛔ CONTENT에 "현재:"·"수정:"·"→"·"✅"·"⚠️" 등 검토 메타 금지 — 순수 명세서 문장만.\n- 최대 12개.\n\n[기계검증 결함]\n${issueTxt}\n[현재 상세설명]\n${cur}`,8192);
        const edits=(typeof parseEditInstructions==='function')?parseEditInstructions(ei.text):[];
        if(edits.length){
          const fixed=applyEditInstructions(cur,edits);   // ADD/MODIFY만 — 삭제 없음. 방법혼입 sanitize 미적용(예시도 삭제 회귀 방지·생성경로 무관 유지)
          pushOutputHistory('step_13_applied','fix','fixSpecValidation'); outputs.step_13_applied=fixed; markOutputTimestamp('step_13_applied'); done.push(`상세설명 보정(${edits.length}건)`);
        }
      }
    }
    if(typeof saveProject==='function')saveProject(true);
    try{renderPreview();}catch(_e){}
    renderSpecValidation();
    App.clearProgress('progressFixSpecValidate');
    App.showToast(done.length?`AI 수정 완료 — ${done.join(', ')}. 재검증 결과를 확인하세요.`:'적용된 수정이 없어요(수동 확인 권장)', done.length?'success':'info');
  }catch(e){ App.clearProgress('progressFixSpecValidate'); App.showToast('AI 수정 실패: '+(e&&e.message||e),'error'); }
  finally{ if(typeof setGlobalProcessing==='function')setGlobalProcessing(false); const b=document.getElementById('btnFixSpecValidate'); if(b)b.disabled=false; }
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

  // 3. (P2 일원화) "본문 사용 부호 ↔ 부호의 설명 미정의" 검사는 CHK-4(validateSpecification, 완성본 기준)로 단일화.
  //    ★ 여기서 중복 방출하면 청구항 탭·산출물 탭에 같은 결함이 다른 문구로 이중 표출(신호 혼란).
  //    또한 청구항 탭 시점엔 step_18(부호의 설명)이 미생성일 수 있어 전 부호가 "미정의"로 조기 오탐되므로 제거.
  //    bodyRefs 는 아래 4번(도면 미정의, 고유 검사)에서 사용하므로 수집만 유지.
  const bodyRefs=new Set();
  refNameMap.forEach((_,ref)=>bodyRefs.add(ref));

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
  try { renderSpecValidation(); } catch (_e) {}   // [Item 2] 완성본 기계검증 패널 자동 갱신(미리보기 진입 시)
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
let _claimWarnAt=0;   // [배치5 ⑤] D-1 청구항 번호 경고 스로틀 타임스탬프(1클릭 3중 호출 → toast 1회화)
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
  //   ★ [배치5 ⑤] 경고 스로틀 — 다운로드 1클릭이 buildSpecification을 3회 호출(본문+게이트+스탬프)해 같은 toast가
  //     3회 중복되던 것을 1.5초 윈도우로 1회화(감사 §6). 판정 로직은 매 호출 그대로 수행(표시만 억제).
  const claimNums=[...allClaims.matchAll(/【청구항\s*(\d+)】/g)].map(m=>parseInt(m[1]));
  if(claimNums.length>0){
    const _cwNow=Date.now(); const _cwShow=(_cwNow-_claimWarnAt)>1500; let _cwFired=false;
    const sorted=[...claimNums].sort((a,b)=>a-b);
    for(let i=0;i<sorted.length;i++){
      if(sorted[i]!==i+1){ if(_cwShow){App.showToast(`⚠️ 청구항 번호 불연속: 청구항 ${i+1} 누락`,'warning');_cwFired=true;} break;}
    }
    const dupes=claimNums.filter((n,i)=>claimNums.indexOf(n)!==i);
    if(dupes.length>0&&_cwShow){App.showToast(`⚠️ 청구항 번호 중복: ${[...new Set(dupes)].join(', ')}`,'warning');_cwFired=true;}
    if(_cwFired)_claimWarnAt=_cwNow;
  }
  // Include step_14 (alternative claims) if available
  let extras='';
  if(outputs.step_14)extras+='\n\n[참고: 대안 청구항]\n'+outputs.step_14;
  if(outputs.step_15)extras+='\n\n[참고: 특허성 검토]\n'+outputs.step_15;
  return['【발명의 설명】',`【발명의 명칭】\n${titleLine}`,`【기술분야】\n${_stripDupHeader(outputs.step_02||'','기술분야')}`,`【발명의 배경이 되는 기술】\n${_stripDupHeader(outputs.step_03||'','발명의 배경이 되는 기술')}`,`【선행기술문헌】\n${_stripDupHeader(outputs.step_04||'','선행기술문헌')}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${_stripDupHeader(outputs.step_05||'','해결하고자 하는 과제')}`,`【과제의 해결 수단】\n${_stripDupHeader(outputs.step_17||'','과제의 해결 수단')}`,`【발명의 효과】\n${_stripDupHeader(outputs.step_16||'','발명의 효과')}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${buildImplementationBody()}`,`【부호의 설명】\n${_stripDupHeader(outputs.step_18||'','부호의 설명')}`,`【청구범위】\n${allClaims}`,`【요약서】\n${_stripDupHeader(outputs.step_19||'','요약서')}`].filter(Boolean).join('\n\n')+extras;
}
// ★ [Task1] ④ 미생성(예시도 있는데 step_08c 비었음) 경고 — 출력 직전 1회(누락 사실 안내, 차단은 안 함).
function _warnConceptDescMissing(){ if(_conceptDescMissing())App.showToast('⚠️ 예시도 상세설명 미생성 — 예시도 설명이 명세서에서 빠집니다. Step 8 "상세설명 생성(장치+예시도)"을 실행하면 예시도 설명도 함께 생성됩니다','warning'); }
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}_warnConceptDescMissing();_warnSpecValidation();navigator.clipboard.writeText(t).then(()=>App.showToast('복사 완료')).catch(()=>App.showToast('클립보드 접근 불가','error'));}
// [§6-7] 다운로드 파일명 스탬프 — 생성시각(YYYYMMDD-HHMMSS) + 완성본 내용 지문(해시). 같은 내용 재다운로드 시 지문이 동일해
//   "모드 전환 후 미갱신/실패로 이전 결과가 다시 받아진 것"을 즉시 식별 가능(§6-7). 다운로드는 항상 현재 outputs(=buildSpecification)를 직렬화한다.
function _specStamp(){ let content=''; try{content=buildSpecification();}catch(_e){} const d=new Date(); const p=n=>String(n).padStart(2,'0'); const ts=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; let h=0; for(let i=0;i<content.length;i++){h=(h*31+content.charCodeAt(i))>>>0;} return ts+'_'+h.toString(36); }
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}_warnConceptDescMissing();if(!_downloadGate())return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${_specStamp()}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function downloadAsWord(){
  _warnConceptDescMissing();   // ★ [Task1] ④ 미생성 경고
  if(!_downloadGate())return;  // [§6-2] CRITICAL 결함 시 확인 게이트(취소 시 차단)
  const brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  const allClaims=[outputs.step_06,outputs.step_10,outputs.step_20].filter(Boolean).join('\n\n');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:buildImplementationBody()},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:allClaims},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:normal;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;const body=_stripDupHeader(s.b,s.h);if(!body)return hd;return hd+body.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${App.escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const userFigHtml=buildUserFiguresHtml({word:true}); // ★ T4: 사용자 도면 이미지(base64) 삽입 — 도 번호 순
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}${userFigHtml}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${_specStamp()}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);App.showToast('Word 다운로드 완료');
}


// ★ KIPRIS 키 설정은 common.js saveProfileSettings()에서 통합 관리 (v5.4)


// ═══════════════════════════════════════════════════════════════════
// [T8] WriterModule 연동 — 통합 리뷰 엔진(review-engine)과의 계약 2함수 (opinion T6와 동형).
//   기존 작성·자기검토 로직은 일절 변경하지 않는다(추가만). simulate/rollback은 patent.js에 안 넣음(옵션 B).
//   ★ patent 특수: applyAmendments 반영 후 3경로(SVG/PPTX/Canvas) 렌더 정합 재검증(E-11) — 공유 소스인
//     도면(mermaid) 부호 ↔ 부호의 설명(step_18) 교차 정합. 불일치 시 커밋하지 않고 롤백 + 렌더회귀 반환.
// ═══════════════════════════════════════════════════════════════════
