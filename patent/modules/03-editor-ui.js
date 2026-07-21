// ═══════════ TAB & TOGGLES & CLAIM UI (v4.7) ═══════════
function switchTab(i){document.querySelectorAll('.tab-item').forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-selected',j===i);});document.querySelectorAll('.page').forEach((p,j)=>p.classList.toggle('active',j===i));if(i===3)renderScopeVerificationSection();if(i===4)renderPreview();}
function toggleMethod(){
  includeMethodClaims=document.getElementById('methodToggle').checked;
  ['methodClaimsCard','methodDiagramCard','methodDescCard'].forEach(id=>{
    const e=document.getElementById(id);
    if(e){
      e.classList.toggle('card-disabled',!includeMethodClaims);
      e.style.opacity=includeMethodClaims?'1':'0.4';
      e.style.pointerEvents=includeMethodClaims?'':'none';
    }
  });
}
function selectDetailLevel(el,level){
  document.querySelectorAll('#detailLevelCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');detailLevel=level;
  const ci=document.getElementById('customDetailInput');
  if(ci) ci.style.display = level==='custom' ? 'block' : 'none';
  // 사용자 지정 모드일 때 입력값 동기화
  if(level==='custom'){
    const inp=document.getElementById('customDetailChars');
    if(inp) inp.onchange=function(){customDetailChars=parseInt(this.value)||2000;};
  }
}

// Claim config update handlers
function updateDeviceCategory(v){deviceCategory=v;}
function updateDeviceGeneralDep(v){deviceGeneralDep=parseInt(v)||0;autoCalcDeviceAnchorStart();updateDeviceClaimTotal();updateMethodClaimTotal();}
function updateDeviceAnchorDep(v){deviceAnchorDep=parseInt(v)||0;autoCalcDeviceAnchorStart();updateDeviceClaimTotal();updateMethodClaimTotal();}
function updateDeviceAnchorStart(v){deviceAnchorStart=parseInt(v)||2;updateDeviceClaimTotal();}
function autoCalcDeviceAnchorStart(){
  // Anchor claims start right after general claims
  deviceAnchorStart=1+deviceGeneralDep+1; // independent(1) + general deps + 1
  const el=document.getElementById('inpDeviceAnchorStart');if(el)el.value=deviceAnchorStart;
}
function updateDeviceClaimTotal(){
  const total=1+deviceGeneralDep+deviceAnchorDep;
  const genStart=2, genEnd=1+deviceGeneralDep;
  const anchorEnd=deviceAnchorStart+deviceAnchorDep-1;
  const el=document.getElementById('deviceClaimTotal');
  // Validate: anchor start should be genEnd+1
  const expectedAnchorStart=genEnd+1;
  let warn='';
  if(deviceAnchorDep>0 && deviceAnchorStart!==expectedAnchorStart){
    warn=` ⚠️ 앵커 시작번호 보정: ${deviceAnchorStart}→${expectedAnchorStart}`;
    deviceAnchorStart=expectedAnchorStart;
    const das=document.getElementById('inpDeviceAnchorStart');if(das)das.value=deviceAnchorStart;
  }
  if(el){
    let txt=`독립항 1 (청구항 1)`;
    if(deviceGeneralDep>0) txt+=` + 일반 ${deviceGeneralDep} (청구항 ${genStart}~${genEnd})`;
    if(deviceAnchorDep>0) txt+=` + 앵커 ${deviceAnchorDep} (청구항 ${deviceAnchorStart}~${deviceAnchorStart+deviceAnchorDep-1})`;
    txt+=` = 총 ${total}개${warn}`;
    el.textContent=txt;
  }
}
function toggleDeviceAnchorThemes(mode){
  anchorThemeMode=mode;
  const el=document.getElementById('deviceThemeList');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleDeviceTheme(key,checked){
  if(checked&&!selectedAnchorThemes.includes(key))selectedAnchorThemes.push(key);
  else selectedAnchorThemes=selectedAnchorThemes.filter(k=>k!==key);
}

function updateMethodCategory(v){methodCategory=v;}
function updateMethodGeneralDep(v){methodGeneralDep=parseInt(v)||0;updateMethodClaimTotal();}
function updateMethodAnchorDep(v){methodAnchorDep=parseInt(v)||0;updateMethodClaimTotal();}
function autoCalcMethodAnchorStart(){
  const devTotal=1+deviceGeneralDep+deviceAnchorDep;
  const methodIndep=devTotal+1;
  // Anchor starts right after method general deps
  methodAnchorStart=methodIndep+methodGeneralDep+1;
}
function updateMethodClaimTotal(){
  const devTotal=1+deviceGeneralDep+deviceAnchorDep;
  const methodIndep=devTotal+1;
  const genStart=methodIndep+1;
  const genEnd=methodIndep+methodGeneralDep;
  autoCalcMethodAnchorStart();
  const anchorEnd=methodAnchorStart+methodAnchorDep-1;
  const total=1+methodGeneralDep+methodAnchorDep;
  const el=document.getElementById('methodClaimTotal');
  if(el){
    let txt=`독립항 1 (청구항 ${methodIndep})`;
    if(methodGeneralDep>0) txt+=` + 일반 ${methodGeneralDep} (청구항 ${genStart}~${genEnd})`;
    if(methodAnchorDep>0) txt+=` + 앵커 ${methodAnchorDep} (청구항 ${methodAnchorStart}~${anchorEnd})`;
    txt+=` = 총 ${total}개`;
    el.textContent=txt;
  }
}
function toggleMethodAnchorThemes(mode){
  methodAnchorThemeMode=mode;
  const el=document.getElementById('methodThemeList');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleMethodTheme(key,checked){
  if(checked&&!selectedMethodAnchorThemes.includes(key))selectedMethodAnchorThemes.push(key);
  else selectedMethodAnchorThemes=selectedMethodAnchorThemes.filter(k=>k!==key);
}

// ═══ 사용자 도면 (v10.0) ═══
function initUserFiguresUI(){
  // 카드 제목 업데이트
  const card=document.getElementById('requiredFiguresList')?.closest('.card');
  if(!card)return;
  const hdr=card.querySelector('.card-title');
  if(hdr)hdr.innerHTML='<span class="ico" data-icon="image"></span> 사용자 도면 추가';
  // 기존 입력폼 교체 (파일 업로드 추가)
  const formArea=card.querySelector('div[style*="display:flex"]');
  if(formArea){
    formArea.outerHTML=`<div id="userFigFormArea">
      <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
        <div><label style="font-size:11px;color:var(--color-text-tertiary)">도면 번호</label>
          <input type="number" class="input-field" id="inpRequiredFigNum" min="1" max="30" placeholder="3" style="width:60px;margin-top:2px" /></div>
        <div style="flex:1"><label style="font-size:11px;color:var(--color-text-tertiary)">도면 설명 <span style="color:var(--dt-danger)">*필수</span></label>
          <input type="text" class="input-field" id="inpRequiredFigDesc" placeholder="예: 본 발명의 실험 결과를 나타내는 그래프" style="margin-top:2px" /></div>
        <button class="btn btn-primary btn-sm" onclick="addRequiredFigure()" title="도면 추가">＋ 추가</button>
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:11px;color:var(--color-text-tertiary)">도면 파일 (선택)</label>
        <input type="file" id="inpRequiredFigFile" accept="image/*,.pdf" style="font-size:12px;margin-top:2px" />
      </div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px;padding:6px 8px;background:var(--color-bg-secondary);border-radius:6px">
        <span class="ico" data-icon="lightbulb"></span> 사용자 도면의 번호는 자동 생성 도면과 충돌하지 않도록 번호가 밀립니다. 예: 도 3을 추가하면, 자동 도면은 도 1, 2, 4, 5... 순으로 생성됩니다.
      </div>
    </div>`;
  }
  // 기존 등록 도면 복원
  renderRequiredFiguresList();
}
function addRequiredFigure(){
  const numEl=document.getElementById('inpRequiredFigNum'),descEl=document.getElementById('inpRequiredFigDesc');
  const fileEl=document.getElementById('inpRequiredFigFile');
  const num=parseInt(numEl?.value);const desc=descEl?.value?.trim();
  if(!num||num<1){App.showToast('도면 번호를 입력하세요','error');return;}
  if(!desc){App.showToast('도면 설명을 입력하세요 (필수)','error');descEl?.focus();return;}
  if(requiredFigures.find(f=>f.num===num)){App.showToast(`도 ${num}은 이미 등록됨`,'error');return;}
  const figData={num,description:desc};
  // Handle file upload if present
  const addAndRender=()=>{
    requiredFigures.push(figData);
    requiredFigures.sort((a,b)=>a.num-b.num);
    if(numEl){numEl.value='';}if(descEl)descEl.value='';if(fileEl)fileEl.value='';
    renderRequiredFiguresList();
    if(typeof renderConceptDiagramTypesList==='function')renderConceptDiagramTypesList();  // ③ 사용자 도면이 예시도 번호도 밀림 + ③-3 통합 뷰
    if(typeof renderConceptDiagramCards==='function')renderConceptDiagramCards();
    invalidateFigureDependents();  // ④ 사용자 도면 추가 → 자동 도 번호 밀림 → 발명의 설명·부호 무효화
    saveProject(true);
    App.showToast(`도 ${num} 사용자 도면 등록${figData.fileName?' (📎 '+figData.fileName+')':''}`);
    // 다음 빈 번호 자동 제안
    suggestNextFigNum();
  };
  if(fileEl?.files?.[0]){
    const file=fileEl.files[0];
    figData.fileName=file.name;
    figData.fileSize=file.size;
    if(file.type.startsWith('image/')){
      const reader=new FileReader();
      reader.onload=e=>{figData.fileDataUrl=e.target.result;addAndRender();};
      reader.readAsDataURL(file);
      return;
    }
  }
  addAndRender();
}
function suggestNextFigNum(){
  const numEl=document.getElementById('inpRequiredFigNum');
  if(!numEl)return;
  const used=new Set(requiredFigures.map(f=>f.num));
  for(let i=1;i<=30;i++){if(!used.has(i)){numEl.value=i;break;}}
}
function removeRequiredFigure(num){
  requiredFigures=requiredFigures.filter(f=>f.num!==num);
  renderRequiredFiguresList();
  if(typeof renderConceptDiagramTypesList==='function')renderConceptDiagramTypesList();  // ③ 자동 번호 재배치 반영 + ③-3 통합 뷰
  if(typeof renderConceptDiagramCards==='function')renderConceptDiagramCards();
  invalidateFigureDependents();  // ④ 사용자 도면 삭제 → 자동 도 번호 당겨짐 → 발명의 설명·부호 무효화
  saveProject(true);
}
function renderRequiredFiguresList(){
  const el=document.getElementById('requiredFiguresList');if(!el)return;
  if(!requiredFigures.length){el.innerHTML='<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:12px">등록된 사용자 도면이 없습니다</div>';return;}
  el.innerHTML=requiredFigures.map(f=>{
    const preview=f.fileDataUrl?`<img src="${f.fileDataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--color-border)" title="${App.escapeHtml(f.fileName||'')}" />`:'';
    const analyzed=!!(f.analysis&&(f.analysis.elements||[]).length);
    const statusBadge=analyzed?`<span class="badge badge-primary" style="font-size:10px" title="비전 분석됨 — T3 정합 입력">분석 ${(f.analysis.elements||[]).length}요소</span>`:'';
    const analyzeBtn=f.fileDataUrl?`<button class="btn btn-ghost btn-sm" onclick="Patent.analyzeUserFigureByNum(${f.num}${analyzed?',true':''})" title="${analyzed?'AI 재분석':'AI 도면 분석(구성요소·부호 추출)'}"><span class="ico" data-icon="${analyzed?'refresh':'search'}" data-size="12"></span></button>`:'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px">
      ${preview}
      <span class="badge badge-primary" style="min-width:40px;text-align:center">도 ${f.num}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${App.escapeHtml(f.description)}">${App.escapeHtml(f.description)}</span>
      ${statusBadge}
      ${f.fileName?`<span class="badge badge-success" title="${App.escapeHtml(f.fileName)}"><span class="ico" data-icon="link" data-size="12"></span></span>`:''}
      ${analyzeBtn}
      <button class="btn btn-ghost btn-sm" onclick="removeRequiredFigure(${f.num})" title="삭제"><span class="ico" data-icon="x"></span></button>
    </div>`;
  }).join('');
}

// ═══ v11.0: 예시도/개념도 UI 관리 ═══
function addConceptDiagramType(){
  const sel=document.getElementById('selConceptType');
  const typeKey=sel?.value;
  if(!typeKey){App.showToast('유형을 선택하세요','error');return;}
  if(conceptDiagramTypes.find(t=>t.type===typeKey)){App.showToast('이미 추가된 유형입니다','error');return;}
  const typeDef=CONCEPT_DIAGRAM_TYPES[typeKey];
  if(!typeDef)return;
  conceptDiagramTypes.push({type:typeKey,title:typeDef.label,figNum:0,figNumOverride:0,svgContent:'',refNums:[]});  // ③ figNumOverride:0=자동(순서 지정 시 도 번호)
  conceptDiagramCount=conceptDiagramTypes.length;
  sel.value='';
  renderConceptDiagramTypesList();  // ③-3 통합 순서 뷰 동기화 포함
  saveProject(true);
  App.showToast(`${typeDef.label} 예시도 추가됨`);
}
function removeConceptDiagramType(typeKey){
  conceptDiagramTypes=conceptDiagramTypes.filter(t=>t.type!==typeKey);
  conceptDiagramCount=conceptDiagramTypes.length;
  renderConceptDiagramTypesList();  // ③-3 통합 순서 뷰 동기화 포함
  invalidateFigureDependents();  // ④ 예시도 삭제 → 자동 번호 당겨짐 → 발명의 설명·부호 무효화
  saveProject(true);
}
function renderConceptDiagramTypesList(){
  const el=document.getElementById('conceptDiagramTypesList');
  if(!el){renderUnifiedFigureOrder();return;}  // ③-3 통합 뷰는 자체 DOM 가드 보유
  if(!conceptDiagramTypes.length){
    el.innerHTML='<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:8px">추가된 예시도가 없습니다</div>';
    renderUnifiedFigureOrder();  // ③-3 예시도 없어도 장치/방법/사용자 도면 순서 표시
    return;
  }
  const cFigNums=getAutoFigNums('step_07c');
  el.innerHTML=conceptDiagramTypes.map((ct,i)=>{
    const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type,desc:''};
    const figNum=cFigNums[i]||'?';
    const ov=parseInt(ct.figNumOverride)||0;   // ③ 지정 도 번호(0=자동)
    const statusBadge=ct.svgContent?'<span class="badge badge-success">생성됨</span>':'<span class="badge" style="background:var(--color-bg-tertiary)">대기</span>';
    // ③ 도 번호 지정 입력: 비우면 자동(순서 밀림), 값 지정 시 해당 위치에 삽입(자동 도면 밀림)
    const ovInput=`<input type="number" class="input-field" min="1" max="30" value="${ov>0?ov:''}" placeholder="${figNum}" onchange="setConceptFigOverride('${ct.type}',this.value)" title="도 번호 지정(비우면 자동). 지정 시 자동 도면이 밀립니다" style="width:52px;font-size:12px;padding:3px 5px;text-align:center" />`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px">
      <span class="badge badge-primary" style="min-width:40px;text-align:center" title="${ov>0?'지정 도 번호':'자동 도 번호'}">도 ${figNum}</span>
      <span style="flex:1">${App.escapeHtml(typeDef.label)} <span style="color:var(--color-text-tertiary);font-size:11px">${App.escapeHtml(typeDef.desc)}</span></span>
      ${ovInput}
      ${statusBadge}
      <button class="btn btn-ghost btn-sm" onclick="removeConceptDiagramType('${ct.type}')" title="삭제"><span class="ico" data-icon="x"></span></button>
    </div>`;
  }).join('');
  renderUnifiedFigureOrder();  // ③-3 통합 순서 뷰 동기화(SoT 단일 추종)
}
// ═══ ③: 예시도 도 번호 지정(figNumOverride) — 충돌 검증(③-5) + 무효화(③-4) ═══
//   비우거나 0 → 자동(순서 밀림). 값 지정 → 해당 도 번호에 예시도 삽입, 자동 도면(장치/방법) 밀림.
//   ★ 변경 시 step_08·step_18 무효화 → 발명의 설명/부호의 설명이 새 번호 추종(④).
function setConceptFigOverride(typeKey,val){
  const ct=conceptDiagramTypes.find(t=>t.type===typeKey);
  if(!ct)return;
  const raw=String(val==null?'':val).trim();
  const prev=parseInt(ct.figNumOverride)||0;
  // 빈값/0 → 자동 복귀
  if(raw===''){ if(prev!==0){ct.figNumOverride=0;_afterConceptFigOverrideChange();} return; }
  const num=parseInt(raw);
  // ③-5 충돌 검증 — 범위, 사용자 도면 번호, 다른 예시도 지정 번호와 중복 금지
  const total=(diagramData.step_07?.length||0)+conceptDiagramTypes.filter(c=>c.svgContent).length+(diagramData.step_11?.length||0)+requiredFigures.length;
  const maxFig=Math.max(total,30);
  if(!num||num<1||num>maxFig){App.showToast(`도 번호는 1~${maxFig} 범위로 입력하세요`,'error');renderConceptDiagramTypesList();return;}
  if(requiredFigures.find(f=>f.num===num)){App.showToast(`도 ${num}은 사용자 도면이 사용 중입니다`,'error');renderConceptDiagramTypesList();return;}
  const dupConcept=conceptDiagramTypes.find(c=>c.type!==typeKey&&(parseInt(c.figNumOverride)||0)===num);
  if(dupConcept){App.showToast(`도 ${num}은 다른 예시도가 지정했습니다`,'error');renderConceptDiagramTypesList();return;}
  if(num===prev){return;}
  ct.figNumOverride=num;
  _afterConceptFigOverrideChange();
  App.showToast(`예시도를 도 ${num}에 지정 — 자동 도면이 밀립니다`);
}
// ④ 도 번호 재배치 → 발명의 설명·부호의 설명이 새 번호 추종(무효화). 장치/방법/예시도 번호가 모두 밀릴 수 있으므로 양 도면 체인 무효화.
function invalidateFigureDependents(){
  invalidateDownstream('step_07c');           // → step_08(장치 상세설명), step_18(부호의 설명)
  invalidateDownstream('step_11');            // → step_12(방법 상세설명), step_18 (방법 도면 번호도 밀림)
}
// 예시도 순서(번호) 변경 후처리: 무효화(④) + 재렌더 + 저장
function _afterConceptFigOverrideChange(){
  invalidateFigureDependents();                // ④ step_08·step_12·step_18 무효화 → 새 번호 추종
  _syncConceptRefNums();                       // ★ ③ override: 식별번호도 새 도 번호 추종(refMap·SVG·step_07c 재번호, 멱등)
  renderConceptDiagramTypesList();             // 입력 카드 갱신(밀린 자동 번호 반영) + ③-3 통합 뷰
  renderConceptDiagramCards();                 // ① 제목·라벨 즉시 갱신(SoT 추종)
  if(typeof renderRequiredFiguresList==='function')renderRequiredFiguresList();
  saveProject(true);                           // figNumOverride 영속(payload 포함)
}
// ③-3: 통합 도면 순서 계획 — 장치/예시도/방법/사용자 도면을 도 번호순으로.
//   ★ step_08 설명 빌더와 동일한 카운트·override 로 computeFigNums 호출 → 번호 불일치(divergence) 0.
function _plannedFigureLayout(){
  const devGen=diagramData.step_07?.length||0;
  const devCount=devGen||Math.max(parseInt(document.getElementById('optDeviceFigures')?.value||4)-requiredFigures.length,0);
  const hasMeth=!!(diagramData.step_11?.length||outputs.step_11||includeMethodClaims);
  const methGen=diagramData.step_11?.length||0;
  const methCount=methGen||(hasMeth?parseInt(document.getElementById('optMethodFigures')?.value||2):0);
  const placed=conceptDiagramTypes.filter(ct=>ct.svgContent);   // 생성된(=번호 확정) 예시도
  const cOverrides=placed.map(ct=>ct.figNumOverride||0);
  const r=computeFigNums(devCount,methCount,placed.length,cOverrides);
  const rows=[];
  r.device.forEach(n=>rows.push({num:n,tag:'장치',cls:'badge-primary'}));
  placed.forEach((ct,i)=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};rows.push({num:r.concept[i],tag:'예시도',sub:td.label,cls:'badge-success',ov:(parseInt(ct.figNumOverride)||0)>0});});
  r.method.forEach(n=>rows.push({num:n,tag:'방법',cls:'badge-warning'}));
  requiredFigures.forEach(rf=>rows.push({num:rf.num,tag:'사용자',sub:rf.description,cls:'badge-neutral'}));
  rows.sort((a,b)=>(a.num||0)-(b.num||0));
  const pending=conceptDiagramTypes.filter(ct=>!ct.svgContent);  // 미생성 예시도(대기)
  return{rows,pending};
}
function renderUnifiedFigureOrder(){
  const el=document.getElementById('unifiedFigureOrder');if(!el)return;
  const {rows,pending}=_plannedFigureLayout();
  if(!rows.length&&!pending.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  const rowHtml=rows.map(r=>{
    const sub=r.sub?` <span style="color:var(--color-text-tertiary);font-size:11px">${App.escapeHtml(String(r.sub).slice(0,40))}</span>`:'';
    const ovMark=r.ov?' <span class="badge badge-primary" style="font-size:9px">지정</span>':'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;border-bottom:1px solid var(--color-border)">
      <span class="badge ${r.cls}" style="min-width:38px;text-align:center">도 ${r.num||'?'}</span>
      <span style="flex:1">${r.tag}${sub}${ovMark}</span>
    </div>`;
  }).join('');
  const pendHtml=pending.length?`<div style="font-size:11px;color:var(--color-text-tertiary);padding:6px 8px">대기(미생성): ${pending.map(ct=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};const ov=parseInt(ct.figNumOverride)||0;return App.escapeHtml(td.label)+(ov>0?` → 도 ${ov} 예정`:'');}).join(', ')}</div>`:'';
  el.innerHTML=`<div style="border:1px solid var(--color-border);border-radius:8px;overflow:hidden">
    <div style="font-size:11px;font-weight:600;padding:6px 8px;background:var(--color-bg-secondary);color:var(--color-text-secondary)"><span class="ico" data-icon="list" data-size="12"></span> 통합 도면 순서</div>
    ${rowHtml}${pendHtml}
  </div>`;
}
function renderConceptDiagramCards(){
  const area=document.getElementById('conceptDiagramsArea');if(!area)return;
  const card=document.getElementById('resultCard07c');
  if(!conceptDiagramTypes.length||!conceptDiagramTypes.some(ct=>ct.svgContent)){
    if(card)card.style.display='none';
    area.innerHTML='';
    return;
  }
  if(card)card.style.display='';
  const cFigNums=getAutoFigNums('step_07c');
  area.innerHTML=conceptDiagramTypes.map((ct,i)=>{
    if(!ct.svgContent)return '';
    const figNum=cFigNums[i]||'?';
    const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    return `<div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
        <span>도 ${figNum} — ${App.escapeHtml(typeDef.label)}</span>
        <button class="btn btn-ghost btn-sm" onclick="Patent.refineConceptDiagramByNum(${figNum})" title="비전 정련 — 선 겹침/배치 개선(청구 구성·부호 내용 유지)"><span class="ico" data-icon="wand" data-size="12"></span> 정련</button>
      </div>
      <div style="border:1px solid var(--color-border);border-radius:8px;padding:12px;background:#fff;overflow:auto;max-height:500px">${_conceptSvgForDisplay(ct, figNum)}</div>
    </div>`;
  }).filter(Boolean).join('');
  const dl=document.getElementById('conceptDiagramDownload');
  if(dl)dl.style.display=conceptDiagramTypes.some(ct=>ct.svgContent)?'':'none';
  renderConceptDiagramTypesList();
  if(typeof _updateConceptDescBtn==='function')_updateConceptDescBtn();   // ★ [Task1] 예시도 생성/복원 후 예시도 상세설명 버튼 강조 갱신
}

// ═══ Project Reference Document ═══
async function handleProjectRefUpload(event){
  const file=event.target.files[0];if(!file)return;
  const st=document.getElementById('projectRefStatus');
  st.textContent='추출 중...';st.style.color='var(--color-primary)';
  try{
    const text=await App.extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      projectRefStyleText=text.trim().slice(0,5000);
      st.innerHTML=`<span class="ico" data-icon="check-circle"></span> ${App.escapeHtml(file.name)} (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px"><span class="ico" data-icon="x"></span></button>`;
      st.style.color='var(--color-success)';
      App.showToast('이 프로젝트 전용 참고 문서 등록 (공통 참고 문서 대신 사용)');
    }else{st.textContent='추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류';st.style.color='var(--color-error)';}
  event.target.value='';
}
function clearProjectRef(){projectRefStyleText='';const st=document.getElementById('projectRefStatus');if(st){st.textContent='없음 (공통 참고 문서 사용)';st.style.color='var(--color-text-tertiary)';}App.showToast('프로젝트 참고 문서 제거됨');}

function selectTitleType(el,type){document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitleType=type;const ci=document.getElementById('customTitleType');if(ci)ci.value=type;document.getElementById('btnStep01').disabled=false;autoSetDeviceCategoryFromType(type);App.showToast(`발명 유형: ~${type}`);}
function onCustomTitleType(val){const v=val.trim();if(v){selectedTitleType=v;document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));document.getElementById('btnStep01').disabled=false;autoSetDeviceCategoryFromType(v);}else{selectedTitleType='';document.getElementById('btnStep01').disabled=true;}}
function selectTitle(el,kr,en){
  // 모든 후보의 선택 해제
  document.querySelectorAll('#resultStep01 .title-candidate-row').forEach(c=>{
    c.classList.remove('selected');
    c.style.borderColor='var(--color-border)';
    c.style.background='#fff';
  });
  // 선택된 항목 강조
  el.classList.add('selected');
  el.style.borderColor='var(--color-primary)';
  el.style.background='var(--color-primary-light)';
  
  // [§6-1] 명칭 세대 추적 — 구 selectedTitle→신 kr diff청크를 staleTerms에 적재(outputs 존재 시)
  try{ if(typeof _onTitleChanged==='function')_onTitleChanged(selectedTitle, kr); }catch(_e){}
  selectedTitle=kr;
  selectedTitleEn=en||'';
  document.getElementById('titleInput').value=kr;
  const enInp=document.getElementById('titleInputEn');
  if(enInp)enInp.value=en||'';
  document.getElementById('titleConfirmArea').style.display='block';
  document.getElementById('titleConfirmMsg').style.display='block';
  document.getElementById('batchArea').style.display='block';
  autoSetDeviceCategoryFromTitle(kr);
  // v7.0: 명칭 변경 시 하류 무효화
  invalidateDownstream('step_01');
}
function onTitleInput(){
  const v=document.getElementById('titleInput').value.trim();
  // 후보 행 선택 해제 — selectTitle()과 동일하게 inline style까지 초기화
  document.querySelectorAll('#resultStep01 .title-candidate-row').forEach(c=>{
    c.classList.remove('selected');
    c.style.borderColor='var(--color-border)';
    c.style.background='#fff';
  });
  const prev=selectedTitle;
  selectedTitle=v;
  document.getElementById('titleConfirmMsg').style.display=v?'block':'none';
  document.getElementById('batchArea').style.display=v?'block':'none';
  if(v)autoSetDeviceCategoryFromTitle(v);
  // prev 유무와 무관하게 변경 시 하류 무효화 (selectTitle과 동일 동작)
  if(prev!==v){ invalidateDownstream('step_01'); try{ if(typeof _onTitleChanged==='function')_onTitleChanged(prev, v); }catch(_e){} }   // [§6-1] 명칭 세대 추적
  // 직접 입력한 명칭이 저장되도록 디바운스 저장 (1.5초 후)
  if(currentProjectId)_debouncedSaveTitle();
}
function onTitleEnInput(){selectedTitleEn=document.getElementById('titleInputEn')?.value?.trim()||'';}

// ═══ Auto Device Category from Title/Type (v5.2) ═══
function autoSetDeviceCategoryFromType(type){
  if(!type)return;
  let devCat='server';
  if(/서버/.test(type))devCat='server';
  else if(/시스템/.test(type))devCat='system';
  else if(/장치/.test(type))devCat='apparatus';
  else if(/단말|전자/.test(type))devCat='electronic_device';
  deviceCategory=devCat;
  const sel=document.getElementById('selDeviceCategory');if(sel)sel.value=devCat;
  // Also set method category
  if(/방법/.test(type)){methodCategory='method';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='method';}
  if(/기록매체/.test(type)){methodCategory='recording_medium';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='recording_medium';}
  if(/컴퓨터\s*프로그램/.test(type)){methodCategory='computer_program_product';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='computer_program_product';}
}
function autoSetDeviceCategoryFromTitle(title){
  if(!title)return;
  // Extract category from title ending
  if(/서버\s*$/.test(title))autoSetDeviceCategoryFromType('서버');
  else if(/시스템\s*$/.test(title))autoSetDeviceCategoryFromType('시스템');
  else if(/장치\s*$/.test(title))autoSetDeviceCategoryFromType('장치');
  else if(/(단말|단말기)\s*$/.test(title))autoSetDeviceCategoryFromType('전자단말');
  else if(/방법\s*$/.test(title))autoSetDeviceCategoryFromType('방법');
  // Compound: "서버 및 방법"
  if(/서버\s*(및|와|,)\s*방법/.test(title)){autoSetDeviceCategoryFromType('서버 및 방법');}
}

// ═══════════ HELPERS ═══════════

// ═══ v5.5: 스텝별 사용자 명령어 시스템 ═══
function getStepUserCommand(sid){
  // DOM 입력 필드에서 실시간 읽기 (있으면), 없으면 저장된 값
  const el=document.getElementById(`userCmd_${sid}`);
  const cmd=el?el.value.trim():(stepUserCommands[sid]||'');
  if(cmd)stepUserCommands[sid]=cmd;
  return cmd;
}
function setStepUserCommand(sid,val){
  stepUserCommands[sid]=(val||'').trim();
  const el=document.getElementById(`userCmd_${sid}`);
  if(el)el.value=stepUserCommands[sid];
}
function buildUserCommandSuffix(sid){
  const cmd=getStepUserCommand(sid);
  if(!cmd)return '';
  return `\n\n═══ 사용자 추가 지시사항 ═══\n아래 지시사항을 위의 기본 지침 범위 내에서 최우선으로 반영하라. 단, "지침 무시"라는 표현이 포함된 경우에는 기본 지침보다 아래 지시사항을 우선한다.\n${cmd}`;
}
// 스텝별 명령어 입력 UI를 동적으로 삽입하는 함수
function injectUserCommandUI(sid,containerSelector){
  const container=typeof containerSelector==='string'?document.querySelector(containerSelector):containerSelector;
  if(!container)return;
  // BUG-A fix: 이미 존재하면 값만 갱신
  const existing=container.querySelector('.user-cmd-area');
  if(existing){
    const ta=existing.querySelector(`#userCmd_${sid}`);
    if(ta)ta.value=stepUserCommands[sid]||'';
    return;
  }
  const area=document.createElement('div');
  area.className='user-cmd-area';
  area.style.cssText='margin:8px 0';
  area.innerHTML=`<details style="margin:0"><summary style="font-size:11px;color:var(--color-text-secondary);cursor:pointer;user-select:none;padding:4px 0"><span class="ico" data-icon="edit"></span> 추가 지시사항 (선택)</summary><textarea id="userCmd_${sid}" class="result-textarea" rows="2" placeholder="예: 독립항을 더 넓게 작성해 주세요 / 앵커에 캐싱 로직을 반드시 포함해 주세요" style="margin-top:6px;font-size:12px;min-height:48px;resize:vertical" oninput="stepUserCommands['${sid}']=this.value.trim()">${App.escapeHtml(stepUserCommands[sid]||'')}</textarea></details>`;
  // 버튼 바로 앞에 삽입
  const btn=container.querySelector('button[id^="btn"]');
  if(btn)container.insertBefore(area,btn);
  else container.appendChild(area);
}
function injectAllUserCommandUIs(){
  // 주요 생성 스텝에 사용자 명령어 UI 삽입
  const stepMap={
    step_06:'btnStep06',step_07:'btnStep07',step_08:'btnStep08',
    step_09:'btnStep09',step_10:'btnStep10',step_11:'btnStep11',
    step_12:'btnStep12',step_13:'btnStep13',step_14:'btnStep14',
    step_15:'btnStep15',step_20:'btnStep20'
  };
  Object.entries(stepMap).forEach(([sid,bid])=>{
    const btn=document.getElementById(bid);
    if(btn&&btn.parentElement)injectUserCommandUI(sid,btn.parentElement);
  });
}

// ═══ A4 fix: Step 의존성 무효화 시스템 (v5.5) ═══
// ═══ v7.0: 완전 의존성 맵 (MUST=필수/SHOULD=권장) ═══
const STEP_DEPENDENCIES={
  // ═══ v14: 역설계 체인 반영 ═══
  step_01:{MUST:['step_06'],SHOULD:['step_02','step_03','step_04','step_05']}, // 명칭 → 청구항 + 하위 스텝
  step_06:{MUST:['step_10','step_07','step_07c','step_17'],SHOULD:['step_08','step_11','step_14','step_15','step_19','step_20']}, // 장치청구 → 방법,도면,개념도,해결수단
  step_10:{MUST:['step_11','step_12','step_17','step_20'],SHOULD:['step_14','step_15','step_18']}, // 방법청구 → 방법도면,상세,해결수단,기록매체
  step_07:{MUST:['step_08','step_18'],SHOULD:['step_09','step_13']},     // 장치도면 → 상세설명, 부호
  step_07c:{MUST:['step_08','step_08c','step_18'],SHOULD:[]},            // 예시도 → 장치상세, 예시도상세, 부호
  step_08:{MUST:['step_08c','step_09','step_13'],SHOULD:['step_12','step_14','step_15']}, // ★ [T2] 상세설명 → 예시도상세(전제 순서: 장치→예시), 수학식, 검토
  step_08c:{MUST:[],SHOULD:['step_18']},                                 // ★ 예시도 상세설명(분리) → 부호의 설명
  step_09:{MUST:[],SHOULD:['step_13']},                    // 수학식 → 검토
  step_11:{MUST:['step_12','step_18'],SHOULD:['step_13']},  // 방법도면 → 방법상세, 부호
  step_12:{MUST:['step_13'],SHOULD:[]},                    // 방법상세 → 검토
  step_17:{MUST:['step_05'],SHOULD:[]},                    // ★ 역설계: 해결수단 → 과제
  step_05:{MUST:['step_16','step_03'],SHOULD:[]},           // ★ 역설계: 과제 → 효과, 배경기술
  step_16:{MUST:[],SHOULD:[]},                             // 효과 (종단)
  step_03:{MUST:[],SHOULD:['step_02']},                    // 배경기술 → 기술분야
  step_02:{MUST:[],SHOULD:[]},                             // 기술분야 (종단)
  step_13:{MUST:[],SHOULD:['step_15','step_04']},           // 검토 → 특허성, 선행기술
  step_04:{MUST:[],SHOULD:['step_15']},                    // 선행기술 → 특허성
  step_15:{MUST:[],SHOULD:['step_14','step_08','step_09','step_12']}, // 특허성 → 대안, 보완
  step_20:{MUST:['step_17'],SHOULD:[]},                    // 기록매체 → 해결수단
  step_14:{MUST:[],SHOULD:[]},                             // 대안청구 (종단)
  step_18:{MUST:[],SHOULD:[]},                             // 부호 (종단)
  step_19:{MUST:[],SHOULD:[]},                             // 요약서 (종단)
};

// 각 step의 실행 함수 매핑 (연쇄 재생성용)
const STEP_RUNNERS={
  step_01:'runStep',step_02:'runStep',step_03:'runStep',step_04:'runStep',step_05:'runStep',
  step_06:'runStep',step_07:'runDiagramStep',step_07c:'runConceptDiagramStep',step_08:'runLongStep',step_08c:'runConceptDescStep',step_09:'runMathInsertion',
  step_10:'runStep',step_11:'runDiagramStep',step_12:'runLongStep',step_13:'runStep',
  step_14:'runStep',step_15:'runStep',step_16:'runStep',step_17:'runStep',
  step_18:'runStep',step_19:'runStep',step_20:'runStep',
};

function invalidateDownstream(changedStep){
  const depObj=STEP_DEPENDENCIES[changedStep];
  if(!depObj)return;
  const mustDeps=(depObj.MUST||[]).filter(d=>d!=='step_13_applied'&&d!=='step_13_applied_method'&&outputs[d]);
  const shouldDeps=(depObj.SHOULD||[]).filter(d=>d!=='step_13_applied'&&d!=='step_13_applied_method'&&outputs[d]);
  
  // ★ v9.1: 원본 step 재생성 시 검토 반영본 무효화 ★
  // step_08, step_09, step_13 변경 → 장치 검토 반영본 무효화
  if(changedStep==='step_08'||changedStep==='step_09'||changedStep==='step_13'){
    if(outputs.step_13_applied){
      delete outputs.step_13_applied;
      delete outputTimestamps.step_13_applied;
      console.log(`[v9.1] ${changedStep} 재생성 → step_13_applied 무효화`);
    }
    if(changedStep==='step_13'&&outputs.step_13_applied_method){
      delete outputs.step_13_applied_method;
      delete outputTimestamps.step_13_applied_method;
      console.log(`[v9.1] step_13 재생성 → step_13_applied_method 무효화`);
    }
  }
  // step_12 변경 → 방법 검토 반영본 무효화
  if(changedStep==='step_12'){
    if(outputs.step_13_applied_method){
      delete outputs.step_13_applied_method;
      delete outputTimestamps.step_13_applied_method;
      console.log(`[v9.1] step_12 재생성 → step_13_applied_method 무효화`);
    }
  }
  
  if(!mustDeps.length&&!shouldDeps.length)return;

  // ★ v10.0 fix: changedStep의 하류 배지만 제거 (다른 step의 배지 보존) ★
  [...mustDeps,...shouldDeps].forEach(d=>{
    document.querySelectorAll(`.stale-warning[data-step="${d}"]`).forEach(w=>w.remove());
  });

  // v7.0: step→실제 element ID 매핑 (배치 렌더링 step 포함)
  const STEP_RESULT_EL={
    step_02:'resultsBatch25',step_03:'resultsBatch25',step_04:'resultsBatch25',step_05:'resultsBatch25',
    step_16:'resultsBatchFinish',step_17:'resultsBatchFinish',step_18:'resultsBatchFinish',step_19:'resultsBatchFinish',
  };

  // 각 영향받는 step에 경고 배지 표시
  [...mustDeps,...shouldDeps].forEach(d=>{
    const isMust=mustDeps.includes(d);
    const elId=STEP_RESULT_EL[d]||`result${d.charAt(0).toUpperCase()+d.slice(1).replace('_','')}`;
    const el=document.getElementById(elId);
    if(el){
      // 같은 step에 대한 기존 경고가 있으면 skip
      if(el.querySelector(`.stale-warning[data-step="${d}"]`))return;
      const w=document.createElement('div');
      w.className='stale-warning';
      w.dataset.step=d;
      w.dataset.staleLevel=isMust?'must':'should';
      w.style.cssText=isMust
        ?'background:#ffebee;border:1px solid #ef5350;border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:11px;color:#c62828;display:flex;align-items:center;gap:6px'
        :'background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:11px;color:#e65100;display:flex;align-items:center;gap:6px';
      w.innerHTML=`<span class="status-dot ${isMust?'negative':'cautionary'}"></span> ${STEP_NAMES[d]} — ${STEP_NAMES[changedStep]} 변경으로 ${isMust?'재생성 필수':'재생성 권장'}`;
      el.prepend(w);
    }
  });

  // ★ 연쇄 수정 패널 표시 ★
  showCascadePanel(changedStep,mustDeps,shouldDeps);
}

// ═══ 산출물 미리보기 디바운스 (cascade 재생성 시 과도 호출 방지) ═══
let _previewDebounceTimer=null;
function _debouncedRenderPreview(){if(_previewDebounceTimer)clearTimeout(_previewDebounceTimer);_previewDebounceTimer=setTimeout(()=>{_previewDebounceTimer=null;renderPreview();},500);}
// ═══ 확정명칭 직접 입력 시 저장 디바운스 ═══
let _titleSaveTimer=null;
function _debouncedSaveTitle(){if(_titleSaveTimer)clearTimeout(_titleSaveTimer);_titleSaveTimer=setTimeout(()=>{_titleSaveTimer=null;saveProject(true);},1500);}

// ═══ v10.1: Step 완료 시 stale 배지 + cascade 패널 갱신 ═══
function onStepCompleted(sid){
  // 1. 해당 step의 stale-warning 배지 제거
  document.querySelectorAll(`.stale-warning[data-step="${sid}"]`).forEach(w=>w.remove());
  // 2. cascade 패널 업데이트
  _updateCascadePanelItem(sid,'done');
  // 3. v10.2: 산출물 미리보기 자동 갱신 (디바운스 적용)
  const previewTab=document.querySelector('.tab-item:nth-child(5)');
  if(previewTab&&previewTab.classList.contains('active'))_debouncedRenderPreview();
  // v15: 단계별 채팅 수정 패널 마운트(모든 생성/재생성 완료의 공통 훅)
  if(window.PatentChat)PatentChat.mountAll();
}
function _updateCascadePanelItem(sid,status){
  const panel=document.getElementById('cascadePanel');
  if(!panel)return;
  const cb=panel.querySelector(`.cascade-cb[data-step="${sid}"]`);
  if(!cb)return;
  cb.checked=false;cb.disabled=true;
  const label=cb.closest('label');
  if(label){
    if(status==='done'){
      label.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;opacity:0.5;text-decoration:line-through;pointer-events:none';
      const span=label.querySelector('span');
      if(span){span.innerHTML=`<span class="ico" data-icon="check-circle" data-size="12"></span> ${App.escapeHtml(STEP_NAMES[sid]||sid)}`;if(window.Icons&&Icons.renderAll)Icons.renderAll(span);}
    }else if(status==='fail'){
      label.style.opacity='0.7';
      const span=label.querySelector('span');
      if(span){span.innerHTML=`<span class="ico" data-icon="x-circle" data-size="12"></span> ${App.escapeHtml(STEP_NAMES[sid]||sid)}`;if(window.Icons&&Icons.renderAll)Icons.renderAll(span);}
    }
  }
  // 모든 항목 완료 시 패널 자동 닫기
  const remaining=panel.querySelectorAll('.cascade-cb:not(:disabled)');
  if(remaining.length===0){
    const btn=panel.querySelector('#btnCascadeRun');
    if(btn){btn.textContent='<span class="ico" data-icon="check-circle"></span> 모두 완료';btn.style.background='#4caf50';btn.disabled=true;}
    setTimeout(()=>{const p=document.getElementById('cascadePanel');if(p)p.remove();},3000);
  }
}

// ═══ 연쇄 수정 패널 UI (v10.1: merge 지원) ═══
function showCascadePanel(changedStep,mustDeps,shouldDeps){
  const existing=document.getElementById('cascadePanel');
  
  // 기존 패널이 있으면 새 항목만 병합
  if(existing){
    _mergeCascadeItems(existing,changedStep,mustDeps,shouldDeps);
    return;
  }

  // 새 패널 생성
  const panel=document.createElement('div');
  panel.id='cascadePanel';
  panel.style.cssText='position:fixed;bottom:20px;right:20px;width:380px;max-height:70vh;overflow-y:auto;background:#fff;border:2px solid #1976d2;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;font-family:"맑은 고딕",sans-serif';

  let html=`<div style="background:var(--dt-brand-hover);color:#fff;padding:12px 16px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:600"><span class="ico" data-icon="refresh"></span> ${STEP_NAMES[changedStep]} 변경 — 연쇄 수정</span>
    <button onclick="document.getElementById('cascadePanel').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px"><span class="ico" data-icon="x"></span></button>
  </div>
  <div style="padding:12px 16px">`;

  // MUST 항목
  if(mustDeps.length){
    html+=`<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--dt-danger);margin-bottom:6px"><span class="status-dot negative"></span> 필수 재생성 (${mustDeps.length}건)</div>`;
    mustDeps.forEach(d=>{
      html+=`<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer">
        <input type="checkbox" class="cascade-cb" data-step="${d}" data-level="must" checked style="accent-color:var(--dt-danger)">
        <span>${STEP_NAMES[d]||d}</span>
      </label>`;
    });
    html+=`</div>`;
  }

  // SHOULD 항목
  if(shouldDeps.length){
    html+=`<details style="margin-bottom:10px"${mustDeps.length?'':' open'}>
      <summary style="font-size:11px;font-weight:700;color:#e65100;cursor:pointer;padding:4px 0"><span class="status-dot cautionary"></span> 권장 재생성 (${shouldDeps.length}건)</summary>`;
    shouldDeps.forEach(d=>{
      html+=`<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer;margin-left:4px">
        <input type="checkbox" class="cascade-cb" data-step="${d}" data-level="should" style="accent-color:#ff9800">
        <span>${STEP_NAMES[d]||d}</span>
      </label>`;
    });
    html+=`</details>`;
  }

  // 전체선택/해제 + 실행 버튼
  html+=`<div style="display:flex;gap:8px;margin-top:10px">
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=true)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:var(--dt-g100);cursor:pointer">전체 선택</button>
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=false)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:var(--dt-g100);cursor:pointer">전체 해제</button>
  </div>
  <button id="btnCascadeRun" onclick="runCascadeRegeneration('${changedStep}')" style="width:100%;margin-top:10px;padding:10px;font-size:13px;font-weight:600;color:#fff;background:var(--dt-brand-hover);border:none;border-radius:8px;cursor:pointer">
    ✨ 선택 항목 자동 재생성
  </button>
  <div id="cascadeProgress" style="margin-top:8px;font-size:11px;color:#666"></div>
  </div>`;

  panel.innerHTML=html;
  document.body.appendChild(panel);
}
// ═══ v10.1: 기존 패널에 새 항목 병합 ═══
function _mergeCascadeItems(panel,changedStep,mustDeps,shouldDeps){
  const existingSteps=new Set([...panel.querySelectorAll('.cascade-cb')].map(cb=>cb.dataset.step));
  let added=0;
  // 필수 항목 영역 찾기/생성
  const mustContainer=panel.querySelector('[data-cascade-must]');
  const shouldContainer=panel.querySelector('[data-cascade-should]');
  
  mustDeps.forEach(d=>{
    if(existingSteps.has(d))return;
    // 기존 MUST 영역에 추가하거나, 없으면 새로 만들기
    const target=mustContainer||panel.querySelector('.cascade-cb[data-level="must"]')?.closest('div');
    if(target){
      const lbl=document.createElement('label');
      lbl.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer';
      lbl.innerHTML=`<input type="checkbox" class="cascade-cb" data-step="${d}" data-level="must" checked style="accent-color:var(--dt-danger)"><span>${STEP_NAMES[d]||d}</span>`;
      target.appendChild(lbl);
      added++;
    }
  });
  shouldDeps.forEach(d=>{
    if(existingSteps.has(d))return;
    const target=shouldContainer||panel.querySelector('.cascade-cb[data-level="should"]')?.closest('details');
    if(target){
      const lbl=document.createElement('label');
      lbl.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer;margin-left:4px';
      lbl.innerHTML=`<input type="checkbox" class="cascade-cb" data-step="${d}" data-level="should" style="accent-color:#ff9800"><span>${STEP_NAMES[d]||d}</span>`;
      target.appendChild(lbl);
      added++;
    }
  });
  // 헤더 텍스트에 변경 원인 추가
  if(added>0){
    const hdr=panel.querySelector('span[style*="font-weight:600"]');
    if(hdr&&!hdr.textContent.includes(STEP_NAMES[changedStep])){
      hdr.textContent+=` + ${STEP_NAMES[changedStep]}`;
    }
  }
}

// ═══ 위상정렬: 의존성 순서 보장 (step_20→step_17 등) ═══
function topologicalSort(steps,sourceStep){
  // 선택된 steps 내에서의 의존 그래프 구축
  const stepSet=new Set(steps);
  const inDeg={};const adj={};
  steps.forEach(s=>{inDeg[s]=0;adj[s]=[];});
  // sourceStep의 하류 + 각 step 간 의존 관계 반영
  steps.forEach(s=>{
    const deps=STEP_DEPENDENCIES[s];
    if(!deps)return;
    [...deps.MUST,...deps.SHOULD].forEach(tgt=>{
      if(stepSet.has(tgt)&&tgt!==s){
        // s가 변경되면 tgt 재생성 필요 → s가 tgt보다 먼저
        adj[s]=adj[s]||[];adj[s].push(tgt);
        inDeg[tgt]=(inDeg[tgt]||0)+1;
      }
    });
  });
  // 또한 sourceStep → 모든 직접 하류가 먼저 실행되게
  // (sourceStep 자체는 이미 실행 완료된 상태)
  
  // Kahn's algorithm
  const queue=steps.filter(s=>inDeg[s]===0);
  const result=[];
  while(queue.length){
    // 같은 inDeg=0 중에서는 기본 순서 유지
    queue.sort((a,b)=>{
      const ai=parseInt(a.replace('step_',''));
      const bi=parseInt(b.replace('step_',''));
      return ai-bi;
    });
    const cur=queue.shift();
    result.push(cur);
    (adj[cur]||[]).forEach(nxt=>{
      inDeg[nxt]--;
      if(inDeg[nxt]===0)queue.push(nxt);
    });
  }
  // 순환 감지 — 순환 시 나머지를 번호 순으로 추가
  if(result.length<steps.length){
    const missing=steps.filter(s=>!result.includes(s));
    missing.sort((a,b)=>parseInt(a.replace('step_',''))-parseInt(b.replace('step_','')));
    result.push(...missing);
  }
  return result;
}

// ═══ 연쇄 재생성 실행 ═══
async function runCascadeRegeneration(sourceStep){
  const checkboxes=[...document.querySelectorAll('.cascade-cb:checked')];
  if(!checkboxes.length){App.showToast('재생성할 항목을 선택하세요','error');return;}
  if(globalProcessing){App.showToast('이미 처리 중입니다','error');return;}

  const steps=checkboxes.map(cb=>cb.dataset.step);
  // step_13_applied, step_13_applied_method는 건너뛰기 (applyReview 전용)
  const validSteps=steps.filter(s=>s!=='step_13_applied'&&s!=='step_13_applied_method'&&STEP_NAMES[s]);

  // ★ v7.0: 위상정렬 (step_20→step_17 등 역방향 의존 해결)
  const sorted=topologicalSort(validSteps,sourceStep);
  if(!sorted.length){App.showToast('정렬 실패','error');return;}

  // BUG-3 fix: globalProcessing 설정
  setGlobalProcessing(true);

  const btn=document.getElementById('btnCascadeRun');
  const prog=document.getElementById('cascadeProgress');
  if(btn){btn.disabled=true;btn.textContent='<span class="ico" data-icon="history"></span> 재생성 진행 중...';}

  let completed=0;
  const total=sorted.length;

  for(const sid of sorted){
    // ★ [Item 3] 품질 게이트 — 일괄 재생성도 청구항 CRITICAL이면 해당 스텝에서 중단(어느 스텝인지 표시)
    const _cg=(typeof _claimGateStatus==='function')?_claimGateStatus(sid):{critical:0};
    if(_cg.critical>0){
      if(prog)prog.innerHTML+=`<div style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> 청구항 CRITICAL ${_cg.critical}건 — ${STEP_NAMES[sid]} 재생성 중단(청구항 먼저 보정)</div>`;
      App.showToast(`청구항 검증 CRITICAL — ${STEP_NAMES[sid]} 이후 재생성 중단`,'error');
      break;
    }
    if(prog)prog.innerHTML=`<div style="margin-bottom:4px">진행: ${completed+1}/${total} — <b>${STEP_NAMES[sid]}</b> 재생성 중...</div>
      <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:var(--dt-brand-hover);border-radius:4px;height:6px;width:${Math.round(completed/total*100)}%;transition:width .3s"></div></div>`;

    try{
      // step별 적절한 runner 호출
      const runner=STEP_RUNNERS[sid];
      if(runner==='runLongStep')await _cascadeRunLong(sid);
      else if(runner==='runDiagramStep')await _cascadeRunDiagram(sid);
      else if(runner==='runMathInsertion')await _cascadeRunMath();
      else if(runner==='runConceptDiagramStep'){if(conceptDiagramTypes.length)await _cascadeRunConceptDiagram();}
      else if(runner==='runConceptDescStep'){if(conceptDiagramTypes.some(ct=>ct.svgContent)&&outputs.step_08)await _conceptDescCore();}   // ★ [T4] step_08c 전용 경로(장치 전제) — 종전 _cascadeRunShort 폴백 갭 해소(T2 간선으로 step_08 선행 보장)
      else await _cascadeRunShort(sid);

      completed++;
      // v10.1: 통합 완료 처리 (배지 + 패널 갱신)
      onStepCompleted(sid);
    }catch(e){
      console.error(`Cascade ${sid} 실패:`,e);
      if(prog)prog.innerHTML+=`<div style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> ${STEP_NAMES[sid]} 실패: ${e.message}</div>`;
    }
  }

  if(prog)prog.innerHTML=`<div style="color:var(--dt-success);font-weight:600"><span class="ico" data-icon="check-circle"></span> ${completed}/${total} 완료</div>
    <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:var(--dt-success);border-radius:4px;height:6px;width:100%"></div></div>`;
  if(btn){btn.textContent='<span class="ico" data-icon="check-circle"></span> 완료';btn.style.background='#4caf50';}
  // BUG-3 fix: globalProcessing 해제
  setGlobalProcessing(false);
  setTimeout(()=>{const p=document.getElementById('cascadePanel');if(p)p.remove();},3000);
  saveProject(true);
  App.showToast(`연쇄 재생성 완료: ${completed}/${total}건 성공`);
}

// v7.0: 배치 step 여부 판별 + 적절한 렌더링
const BATCH_STEPS={step_02:'resultsBatch25',step_03:'resultsBatch25',step_04:'resultsBatch25',step_05:'resultsBatch25',step_16:'resultsBatchFinish',step_17:'resultsBatchFinish',step_18:'resultsBatchFinish',step_19:'resultsBatchFinish'};
function _cascadeRender(sid,text){
  if(BATCH_STEPS[sid]){
    renderBatchResult(BATCH_STEPS[sid],sid,text);
  }else{
    renderOutput(sid,text);
  }
}

// ═══ 연쇄용 내부 실행 함수 ═══
async function _cascadeRunShort(sid){
  // step_04는 KIPRIS API 검색 (buildPrompt 없음)
  if(sid==='step_04'){
    const sr=await searchPriorArt(selectedTitle);
    pushOutputHistory('step_04','cascade','_cascadeRunShort');
    outputs.step_04=sr?sr.formatted:'【특허문헌】\n(관련 선행특허��� 검색하지 못하였습니다)';
    markOutputTimestamp('step_04');_cascadeRender('step_04',outputs.step_04);
    return;
  }
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  pushOutputHistory(sid,'cascade','_cascadeRunShort');
  if(sid==='step_13'){
    const text=await App.callClaudeWithContinuation(prompt,'progressStep13');
    outputs[sid]=text;
  }else{
    const r=await App.callClaude(prompt);
    outputs[sid]=r.text;
  }
  markOutputTimestamp(sid);_cascadeRender(sid,outputs[sid]);
  // step_06, step_10: 기재불비 자동 교정 (최대 2회)
  if(sid==='step_06'||sid==='step_10'){
    let corrected=outputs[sid];
    for(let round=0;round<2;round++){
      const issues=validateClaims(corrected);
      if(!issues.length)break;
      const issueText=issues.map(i=>i.message).join('\n');
      const fixR=await App.callClaude(`청구범위 기재불비를 수정하라.\n[지적사항]\n${issueText}\n[원본]\n${corrected}`);
      corrected=fixR.text;
    }
    pushOutputHistory(sid,'cascade','_cascadeRunShort.correction');
    outputs[sid]=corrected;markOutputTimestamp(sid);_cascadeRender(sid,corrected);
  }
}
async function _cascadeRunLong(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  let t=await App.callClaudeWithContinuation(prompt);
  // v8.1: 도면 범위 초과 자동 교정
  if(sid==='step_08')t=sanitizeDescFigureRefs(t,'device');
  if(sid==='step_12')t=sanitizeDescFigureRefs(t,'method');
  pushOutputHistory(sid,'cascade','_cascadeRunLong');
  outputs[sid]=t;markOutputTimestamp(sid);
  if(sid==='step_08')outputs.step08_device=t;   // ★ [T1] cascade 도 device 스냅샷 + 합본(예시도 기존재 시)
  _cascadeRender(sid,t);
  if(sid==='step_08')_mergeConceptIntoStep08();
}
async function _cascadeRunDiagram(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  let r=await App.callClaude(prompt);
  let designText=r.text;
  
  // v10.3: 도면 설계 검증 — 도면 수, 도면 번호, 청구항 정합성
  if(sid==='step_07'){
    const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const genCount=totalFig-requiredFigures.length;
    const figNums=computeFigNums(Math.max(genCount,0),0);
    const expectedNums=figNums.device;
    
    const preIssues=validateDiagramDesignText(designText,genCount,expectedNums);
    const hasError=preIssues.some(i=>i.severity==='ERROR');
    
    if(hasError){
      console.warn('[_cascadeRunDiagram] 도면 설계 검증 실패:',preIssues.map(i=>i.message).join('; '));
      // 오류 메시지를 포함하여 재생성 요청
      const fb=`이전 도면 설계에 규칙 위반이 있습니다. 아래 오류를 모두 수정하여 다시 생성하세요.

[오류 목록]
${preIssues.filter(i=>i.severity==='ERROR').map(i=>'⛔ '+i.message).join('\n')}
${preIssues.filter(i=>i.severity==='WARNING').map(i=>'⚠ '+i.message).join('\n')}

★★★ 핵심 수정사항 ★★★
- 도면을 정확히 ${genCount}개만 생성하라: ${expectedNums.map(n=>'도 '+n).join(', ')}
- 구성요소 명칭과 참조번호는 【장치 청구범위】에서 가져와 사용하라

원래 요청:
${prompt.slice(0,2000)}`;
      r=await App.callClaude(fb);
      designText=r.text;
      
      // 재생성 후 2차 검증 — 도면 수만 확인
      const postIssues=validateDiagramDesignText(designText,genCount,expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        console.warn('[_cascadeRunDiagram] 2차 검증도 도면 수 불일치 — 초과분 수동 제거 시도');
        // 설계 텍스트에서 초과 도면 제거
        designText=_trimDesignTextToExpectedFigures(designText,expectedNums);
      }
    }
  }
  
  if(sid==='step_11'){
    const methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
    const devCount=diagramData.step_07?.length||0;
    const figNums=computeFigNums(devCount,methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
    const expectedNums=figNums.method;
    
    const preIssues=validateDiagramDesignText(designText,methFigCount,expectedNums);
    if(preIssues.some(i=>i.severity==='ERROR')){
      const fb=`도면 설계 오류:\n${preIssues.map(i=>i.message).join('\n')}\n도면을 정확히 ${methFigCount}개만 생성하라: ${expectedNums.map(n=>'도 '+n).join(', ')}\n원래 요청: ${prompt.slice(0,1500)}`;
      r=await App.callClaude(fb);designText=r.text;
    }
    // ★ 2차 검증: 도면 수 강제 트림 ★
    const postIssues=validateDiagramDesignText(designText,methFigCount,expectedNums);
    if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
      designText=_trimDesignTextToExpectedFigures(designText,expectedNums);
    }
  }
  
  pushOutputHistory(sid,'cascade','_cascadeRunDiagram');
  outputs[sid]=designText;markOutputTimestamp(sid);_cascadeRender(sid,designText);
  const mr=await App.callClaude(buildMermaidPrompt(sid),4096);
  pushOutputHistory(sid+'_mermaid','cascade','_cascadeRunDiagram.mermaid');
  outputs[sid+'_mermaid']=mr.text;
  renderDiagramsV14(sid,mr.text);
}

// v11.0: 연쇄 재생성용 예시도 실행
async function _cascadeRunConceptDiagram(){
  const cFigNums=getAutoFigNums('step_07c');
  const count=conceptDiagramTypes.length;
  const figNums=cFigNums.slice(0,count);
  const typeDescs=conceptDiagramTypes.map((ct,i)=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};return `도 ${figNums[i]||'?'}: ${td.label}`;}).join(', ');

  const prompt=`특허 도면 전문가로서, 아래 발명의 예시도/개념도를 SVG 코드로 직접 생성하라.

${CONCEPT_PURPOSE_RULES}

⛔ 블록도/플로우차트 형태 절대 금지. "~부" 박스 라벨 금지. 흑색 선만 사용.
✅ 시각적 장면: 스틱 피겨, UI 화면, 테이블, 디바이스 외관 등
SVG 규칙: viewBox="0 0 680 500", stroke="#000", fill="none"(필요시 "#fff"), font-family="Malgun Gothic,sans-serif", 참조번호 31~99.
${CONCEPT_OVERLAP_RULES}
★ 출력 전: 부호 리더선/연결선이 다른 요소와 겹치거나 교차하는지, 요소·텍스트가 겹치는지 점검하고, 겹치면 경로·좌표를 수정해 제거하라.
발명의 명칭: ${selectedTitle}
도면: ${count}개 (${figNums.map(n=>'도 '+n).join(', ')}), 유형: ${typeDescs}
청구범위(★ 이 예시도가 시각화할 구성을 특정해 도면에 반드시 담아라 — 블록도 복제만 금지): ${outputs.step_06?.slice(0,1500)||''}
출력 형식(각 도면마다 SVG·간단설명·요소맵): ${figNums.map(n=>'---CONCEPT_FIG_'+n+'---\\n<svg>...</svg>\\n---BRIEF_DESC---\\n도 '+n+'은 ...를 나타내는 예시도이다.\\n---REF_MAP---\\n31: 에피소드 노드\\n32: 사용자 프로필 카드').join('\\n')}
★ REF_MAP 필수(§6-6): 각 참조번호(31~99)가 도면에서 실제로 가리키는 구체적 요소의 "고유 한국어 이름"을 "번호: 이름"으로 빠짐없이 적어라.
⛔ "데이터 구조 요소"·"UI 화면 요소"·"프로세스 장면" 같은 유형 총칭을 번호마다 반복하지 마라 — 각 박스/노드/화면요소가 나타내는 개별 명칭(예: 에피소드 노드, 사용자 프로필 카드, 추천 랭킹표, 진행률 표시줄)을 서로 다르게 써라. 이 이름이 그대로 【부호의 설명】에 채워지므로, 총칭 나열은 부호↔명칭 대응을 상실시킨다.
⛔ 서수(제1/제2/제N)+총칭 조합도 금지("제1 UI 화면 요소" 등 — 총칭 반복의 우회일 뿐이다). 각 번호는 화면·요소의 실제 내용을 나타내는 고유 명칭(예: 대본 입력 패널, 라우팅 결과 카드, 승인 버튼)이어야 하며, 실명을 특정할 수 없으면 해당 번호의 라벨을 비워 두라(빈 라벨은 시스템이 처리한다).`;

  const r=await App.callClaude(prompt,16384);
  const fullText=r.text||'';

  // ★ P2/P3 공유 파서 — SVG/BRIEF/REF_MAP(번호↔이름) 추출, 참조번호 31~99 통일.
  _parseConceptResult(fullText, conceptDiagramTypes, figNums);
  _syncConceptRefNums();   // ★ 식별번호 도 번호 연동(도 N → N0번대) — refMap·SVG·step_07c 정합
  pushOutputHistory('step_07c','cascade','_cascadeRunConceptDiagram');
  outputs.step_07c=_buildConceptOutputText(conceptDiagramTypes, figNums);
  markOutputTimestamp('step_07c');
  reflectConceptsToSpec();   // ★ [B2] 부호의 설명(step_18)만 보강(발명의 설명 APPEND 은퇴 — 예시도 설명은 step_08c 담당)
  renderConceptDiagramCards();
  // ★ [C] 연쇄 재생성 직후에도 비전 자동 정련 1회(겹침 안전망) — callVision 있을 때만(가드), 1회만.
  try{ if(App&&typeof App.callVision==='function'){ await Patent.refineAllConceptDiagrams({maxRounds:1}); } }catch(_e){}
}

// v10.3: 설계 텍스트에서 초과 도면 제거
function _trimDesignTextToExpectedFigures(text,expectedNums){
  if(!expectedNums||!expectedNums.length)return text;
  const expectedSet=new Set(expectedNums);
  
  // BRIEF_DESCRIPTIONS 섹션 분리
  const briefIdx=text.indexOf('---BRIEF_DESCRIPTIONS---');
  let designPart=briefIdx>=0?text.slice(0,briefIdx):text;
  let briefPart=briefIdx>=0?text.slice(briefIdx):'';
  
  // 도면별 분리
  const figSections=[];
  const figRe=/(?:^|\n)(도\s*(\d+)\s*[:：])/g;
  let m;
  const starts=[];
  while((m=figRe.exec(designPart))!==null){
    starts.push({pos:m.index,num:parseInt(m[2])});
  }
  
  let result='';
  for(let i=0;i<starts.length;i++){
    const end=i+1<starts.length?starts[i+1].pos:designPart.length;
    if(expectedSet.has(starts[i].num)){
      result+=designPart.slice(starts[i].pos,end);
    }else{
      console.log(`[_trimDesignText] 초과 도면 제거: 도 ${starts[i].num}`);
    }
  }
  
  // BRIEF_DESCRIPTIONS에서도 초과 도면 라인 제거
  if(briefPart){
    const lines=briefPart.split('\n');
    briefPart=lines.filter(l=>{
      const fm=l.match(/도\s*(\d+)/);
      if(!fm)return true;
      const fnum=parseInt(fm[1]);
      // 사용자 도면이나 예상 도면이면 유지
      return expectedSet.has(fnum)||requiredFigures.some(rf=>rf.num===fnum);
    }).join('\n');
  }
  
  return (result+'\n\n'+briefPart).replace(/\n{3,}/g,'\n\n').trim();
}
async function _cascadeRunMath(){
  const r=await App.callClaude(buildPrompt('step_09'));
  const baseDesc=getLatestDescription()||'';
  pushOutputHistory('step_09','cascade','_cascadeRunMath');
  outputs.step_09=insertMathBlocks(baseDesc,r.text);
  markOutputTimestamp('step_09');_cascadeRender('step_09',outputs.step_09);
}

// ═══ A1 fix: getLatestDescription — 타임스탬프 기반 최신본 (v5.5) ═══
function markOutputTimestamp(sid){outputTimestamps[sid]=Date.now();try{_warnIfStaleInStep(sid);}catch(_e){}}
// [§6-1 결정 c] 스텝 출력 저장 직후 — 구세대 용어 혼입 시 경고만(차단 아님)
function _warnIfStaleInStep(sid){
  const _stale=(typeof _activeStaleTerms==='function')?_activeStaleTerms():[]; if(!_stale.length)return;
  const _txt=String((typeof outputs==='object'&&outputs&&outputs[sid])||'').replace(/\s+/g,''); if(!_txt)return;
  const _hit=_stale.filter(t=>t&&t.length>=5&&_txt.indexOf(t)>=0);
  if(_hit.length&&App&&typeof App.showToast==='function')App.showToast(`구세대 용어(${_hit.slice(0,2).join(', ')}) 혼입 — 이 스텝 재생성 권장`,'warning');
}
function getLatestDescription(){
  // v9.1: 장치 상세설명 우선순위: step_13_applied > step_09 > step_08
  // 단, 하위 step이 더 최신이면(사용자가 재생성) 하위 step 우선
  const ts08=outputTimestamps.step_08||0;
  const ts09=outputTimestamps.step_09||0;
  const ts13a=outputTimestamps.step_13_applied||0;
  // step_08이 step_09/step_13_applied보다 나중이면 step_08이 최신본 (사용자가 Step 8 재생성)
  if(outputs.step_08&&ts08>ts09&&ts08>ts13a)return outputs.step_08;
  // step_09가 step_13_applied보다 나중이면 step_09 우선 (사용자가 Step 9 재생성)
  if(outputs.step_09&&ts09>ts13a)return outputs.step_09;
  // 기존 우선순위
  return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';
}
// v9.1: 방법 상세설명 최신본 반환
function getLatestMethodDescription(){
  // 우선순위: step_13_applied_method > step_12
  // 단, step_12가 더 최신이면(사용자가 Step 12 재생성) step_12 우선
  const ts12=outputTimestamps.step_12||0;
  const ts13m=outputTimestamps.step_13_applied_method||0;
  if(outputs.step_12&&ts12>ts13m)return outputs.step_12;
  return outputs.step_13_applied_method||outputs.step_12||'';
}
// ★ 예시도 상세설명(step_08c, 분리) 최신본 — 장치(step_08)·방법(step_12)과 동급. 검토 반영 계층은 추후(step_08c 직접).
function getLatestConceptDescription(){
  return outputs.step_08c||'';
}
// ★ [T1] 예시도 상세설명(step_08c)을 장치 상세설명(step_08) 본문에 합본 — "생성 분리 + 저장 합본".
//   생성은 분리(_longStepCore/_conceptDescCore) 유지(LLM 재호출 0). 합본은 device-only 스냅샷(step08_device)에서
//   재구성하는 텍스트 병합 → 멱등(재생성 중복 0). 합본 후 getLatestDescription 체인이 예시도를 품어
//   후속 단계(수학식·특허성·대안·검토반영)가 자동 공유한다(호출부 무수정).
//   ※ step08_device 는 'step_'(언더스코어) 미일치 → 진행도/렌더 루프(outputs[k].startsWith('step_'))에서 제외, saveProject 로 영속.
function _mergeConceptIntoStep08(){
  const dev=(outputs.step08_device||outputs.step_08||'').replace(/\s*$/,'');
  if(!dev) return;
  const concept=(outputs.step_08c||'').trim();
  const merged=concept?(dev+'\n\n'+concept):dev;
  if(merged===outputs.step_08) return;   // 멱등: 변화 없으면 no-op
  outputs.step_08=merged;
  markOutputTimestamp('step_08');         // 합본본을 device 체인 최신으로 → getLatestDescription 이 예시도 포함분 반환
  // 합본으로 step_08 본문 변경 → 검토반영본(step_13_applied) 무효화(예시도 반영 위해 재생성 유도). step_08c(source)는 stale 처리 안 함.
  if(outputs.step_13_applied){delete outputs.step_13_applied;delete outputTimestamps.step_13_applied;}
  renderOutput('step_08',outputs.step_08);
}
// ★ [Task1] 예시도(step_07c svgContent)는 있는데 예시도 상세설명(step_08c)이 비었나 → ④ 미생성(명세서에서 예시도 설명 누락).
function _conceptDescMissing(){
  return conceptDiagramTypes.some(ct=>ct.svgContent) && !(outputs.step_08c && String(outputs.step_08c).trim());
}
// ★ [T2] 보조 버튼 강등 — 통합 "상세설명 생성(장치+예시도)"이 예시도까지 자동 생성하므로, btnStep08c 는 강조(btn-primary) 없이
//   조용한 보조("예시도 상세설명만 재생성")로 유지. 라벨을 정적 HTML과 일관(런타임 덮어쓰기로 인한 "생성" 복귀 방지).
function _updateConceptDescBtn(){
  const b=document.getElementById('btnStep08c'); if(!b) return;
  b.classList.remove('btn-primary'); b.classList.add('btn-outline');
  b.innerHTML='<span class="ico" data-icon="edit"></span> 예시도 상세설명만 재생성';
  if(window.Icons&&Icons.renderAll)try{Icons.renderAll(b);}catch(_e){}
}
// 정형문 수동 삽입: 현재 Step 8 결과에 정형문을 전후에 삽입
function insertBoilerplate(){
  const cur=outputs.step_08||'';
  if(!cur){App.showToast('상세설명이 없습니다. 먼저 Step 8을 생성하세요.','error');return;}
  // Check if already has boilerplate
  if(hasBoilerplate(cur)){App.showToast('이미 정형문이 삽입되어 있습니다.','info');return;}
  pushOutputHistory('step_08','llm','insertBoilerplate');
  outputs.step_08=STEP8_PREFIX+'\n\n'+cur+'\n\n'+STEP8_SUFFIX;
  renderOutput('step_08',outputs.step_08);
  // Also update step_09 and step_13_applied if they exist
  if(outputs.step_09&&!hasBoilerplate(outputs.step_09)){outputs.step_09=STEP8_PREFIX+'\n\n'+outputs.step_09+'\n\n'+STEP8_SUFFIX;markOutputTimestamp('step_09');}
  if(outputs.step_13_applied&&!hasBoilerplate(outputs.step_13_applied)){outputs.step_13_applied=STEP8_PREFIX+'\n\n'+outputs.step_13_applied+'\n\n'+STEP8_SUFFIX;markOutputTimestamp('step_13_applied');}
  App.showToast('정형문 삽입 완료 (본문 전후에 자동 삽입됨)');
}
function hasBoilerplate(text){
  return text&&text.includes('이하, 본 발명의 실시예를 첨부된 도면을');
}
function getFullDescription(){
  const body=getLatestDescription();
  if(!body)return '';
  // If boilerplate already inserted manually, don't double-insert
  if(hasBoilerplate(body))return body;
  return STEP8_PREFIX+'\n'+body+'\n'+STEP8_SUFFIX;
}
// ★ [Task2] 발명을 실시하기 위한 구체적인 내용 본문 — 여는 정형문 + [장치+예시도(step_08c)+방법] + ★닫는 정형문(SUFFIX)을 섹션 맨 끝★.
//   종전: getFullDescription 이 장치만 PREFIX/SUFFIX 로 감싸 닫는 정형문이 예시·방법 앞에 끼던 문제 해소(방법 선존재 문제도 동시 해소).
function buildImplementationBody(){
  const device=getLatestDescription()||'';
  const concept=getLatestConceptDescription()||'';
  const method=getLatestMethodDescription()||'';
  // ★ [T3/math-dup] 합본 중복 제거 — 예시도가 device(step_08 합본)에 이미 있으면 별도 추가 금지(중복 0).
  //   없으면(구 사건·미합본) 보강하여 예시도 누락 방지. 합본 정본은 device, step_08c 는 source.
  //   ★ 견고화: 단순 slice(0,40) 연속 매칭은 수학식(step_09)이 예시도 시작부에 【수학식】을 끼우면 깨져
  //     conceptIn=false → 예시도 중복. stripMathBlocks(수학식 제거)+공백 전부 제거 후 첫 N자 비교로 연속성 복원.
  const _normForDedup = _stripMathNorm;   // [cleanup D2] 공유 헬퍼(06) — stripMathBlocks+공백 전제거
  const _devN=_normForDedup(device), _conN=_normForDedup(concept);
  const conceptIn = _conN.length>0 && _devN.indexOf(_conN.slice(0,30))>=0;
  const core=[device, conceptIn?'':concept, method].filter(Boolean).join('\n\n');
  if(!core)return '';
  if(hasBoilerplate(core))return core;   // 수동 정형문 삽입 케이스 → 이중 삽입 방지(그대로)
  return STEP8_PREFIX+'\n'+core+'\n'+STEP8_SUFFIX;   // ★ 닫는 정형문이 장치+예시+방법 뒤(섹션 끝)
}
function getLastClaimNumber(t){const m=t.match(/【청구항\s*(\d+)】/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function getLastFigureNumber(t){const m=t.match(/도\s*(\d+)/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}

// v10.3: 도면 설계 텍스트에서 정확한 도면 번호 목록 추출 (헤더 기반)
function _extractFigureNumbersFromDesign(text){
  if(!text)return [];
  const nums=[];
  const re=/^\s*도\s*(\d+)\s*[:：]/gm;
  let m;
  while((m=re.exec(text))!==null)nums.push(parseInt(m[1]));
  return[...new Set(nums)].sort((a,b)=>a-b);
}

// ═══ v9.0: 상세설명 후처리 (safety net — 근본 수정은 callClaudeWithContinuation 오버라이드) ═══
// type: 'device' → step_08 (장치), 'method' → step_12 (방법)
function sanitizeDescFigureRefs(text,type){
  if(!text)return text;
  
  // ★ v10.2: Step 8 수학식 제거 (수학식은 Step 9에서만 삽입) ★
  if(type==='device'){
    // ★ FIX-C: crude 정규식(【수학식】 이후 특정 키워드로 시작 안 하는 모든 줄을 삼켜 일반 문단
    //   "…저장부(133)는…"까지 소실)을 정교판 stripMathBlocks(06)로 통일 — 중복 구현 제거.
    //   stripMathBlocks 는 "[가-힣]{2,}부(" 등 구성요소 문단에서 종결하므로 일반 문단을 보존.
    //   (호출부는 모두 런타임 — 03:902/05:114/05:637 — 로 06 로드 후 실행. 03:1159 도 이미 stripMathBlocks 사용.)
    text=stripMathBlocks(text).trim();
    // v10.5: "수학식 N" 참조 제거 — 【수학식 N】 헤더 잔여만 제거 (본문 참조 문장은 보존)
    text=text.replace(/^\s*【?수학식\s*\d+】?\s*$/gm,'').trim();
    text=text.replace(/\n{3,}/g,'\n\n');
  }
  
  // ★ Safety net A: v10.2 — 도면 소개문은 유지 (Step 8에서 의도적으로 포함) ★
  // "도 N은 ~블록도이다" 형태는 이제 Step 8 필수 출력이므로 제거하지 않음
  if(type==='device'||type==='method'){
    
    // ★ Safety net B: 중복 출력 감지 & 제거 ★
    // 근본 원인(이어쓰기)이 수정되어도, 예외적으로 발생할 수 있는 중복 대비
    const fig1Refs=[...text.matchAll(/도\s+1[을를]\s*참조하면/g)];
    if(fig1Refs.length>=2){
      // v10.2: "도 1을 참조하면"의 마지막 출현 위치 → 그 앞의 도면 소개문도 보존
      const lastIdx=fig1Refs[fig1Refs.length-1].index;
      // 도면 소개문("도 1은 ~이다") 탐색: lastIdx 앞 300자 이내에서 "도 1은" 패턴 찾기
      const searchStart=Math.max(0,lastIdx-300);
      const introMatch=text.substring(searchStart,lastIdx).match(/도\s+1[은는]\s+[^\n]*(?:블록도|예시도|구성도|개념도)[^\n]*\.\s*/);
      const cutIdx=introMatch?searchStart+introMatch.index:lastIdx;
      const removed=text.substring(0,cutIdx).trim();
      text=text.substring(cutIdx).trim();
      console.warn(`[v9.0] ${type} 상세설명: 중복 출력 감지 — "도 1을 참조하면" ${fig1Refs.length}회 발견, 마지막 본 사용 (${removed.length}자 제거)`);
    } else {
      // v10.2: 도면 소개문("도 1은 ~이다")이 "도 1을 참조하면" 앞에 올 수 있으므로
      // 프리앰블 제거 로직을 비활성화 (의도된 콘텐츠 보호)
    }
  }
  // 허용 도면 범위 결정
  // v10.5 fix: getLastFigureNumber 대신 _extractFigureNumbersFromDesign 사용
  // (getLastFigureNumber는 "도 N" 패턴을 텍스트 전체에서 매칭하여, 교차참조/비도면 숫자도 잡아 maxAllowed를 과대 산정)
  let maxAllowed;
  if(type==='device'){
    const deviceFigCount=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const _headerFigs=_extractFigureNumbersFromDesign(outputs.step_07||'');
    const _userFigMax=requiredFigures.length>0?Math.max(...requiredFigures.map(f=>f.num)):0;
    const _devMax=_headerFigs.length>0?Math.max(Math.max(..._headerFigs),_userFigMax):(getLastFigureNumber(outputs.step_07||'')||deviceFigCount);
    const _concCount=conceptDiagramTypes.filter(ct=>ct.svgContent).length;
    maxAllowed=_devMax+_concCount;
  }else{
    // 방법: 장치 마지막 도면 + 방법 도면
    const _devHeaders=_extractFigureNumbersFromDesign(outputs.step_07||'');
    const _devUserMax=requiredFigures.length>0?Math.max(...requiredFigures.map(f=>f.num)):0;
    const deviceMax=_devHeaders.length>0?Math.max(Math.max(..._devHeaders),_devUserMax):(getLastFigureNumber(outputs.step_07||'')||parseInt(document.getElementById('optDeviceFigures')?.value||4));
    const _methHeaders=_extractFigureNumbersFromDesign(outputs.step_11||'');
    const methodMax=_methHeaders.length>0?Math.max(..._methHeaders):getLastFigureNumber(outputs.step_11||'');
    const _concCount=conceptDiagramTypes.filter(ct=>ct.svgContent).length;
    maxAllowed=methodMax||(deviceMax+_concCount+parseInt(document.getElementById('optMethodFigures')?.value||2));
  }
  
  // 모든 "도 N" 참조 추출
  const figRefs=[...text.matchAll(/도\s+(\d+)/g)].map(m=>parseInt(m[1]));
  const outOfRange=figRefs.filter(n=>n>maxAllowed);
  if(!outOfRange.length)return text;
  
  // 초과 도면 번호 (중복 제거)
  const badNums=[...new Set(outOfRange)].sort((a,b)=>a-b);
  console.warn(`[v8.1] ${type} 상세설명: 범위 초과 도면 발견 — 도 ${badNums.join(', ')} (허용: ~도 ${maxAllowed})`);
  
  // 자동 교정: 초과 도면 참조 문단 제거
  let cleaned=text;
  const lines=cleaned.split('\n');
  const filteredLines=[];
  let skipSection=false;
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    // "도 N을 참조하면," or "도 N은 ~" 로 시작하는 줄이 초과 도면이면 해당 섹션 스킵
    const figStartMatch=line.match(/^\s*도\s+(\d+)\s*[을를은는]/);
    if(figStartMatch){
      const figN=parseInt(figStartMatch[1]);
      if(figN>maxAllowed){
        skipSection=true;
        continue;
      }else{
        skipSection=false;
      }
    }
    // 새로운 "도 N을 참조하면" 패턴이 나오면 스킵 해제 판단
    if(skipSection){
      const newFigStart=line.match(/^\s*도\s+(\d+)\s*[을를은는]/);
      if(newFigStart){
        const n=parseInt(newFigStart[1]);
        if(n<=maxAllowed){skipSection=false;}
        else continue;
      }else{
        // 빈 줄 2개 연속이면 섹션 끝으로 간주
        if(line.trim()===''&&i+1<lines.length&&lines[i+1].trim()===''){
          skipSection=false;
        }
        if(skipSection)continue;
      }
    }
    
    // 개별 문장 내 초과 도면 참조 제거 (문단 중간에 삽입된 경우)
    let safeLine=line;
    badNums.forEach(n=>{
      // "도 N에서는 ~." 형태의 완전한 문장 제거
      safeLine=safeLine.replace(new RegExp(`도\\s*${n}[을를은는에]서?[^.。]*[.。]\\s*`,'g'),'');
      // "도 N을 참조하면, ~." 형태
      safeLine=safeLine.replace(new RegExp(`도\\s*${n}[을를]\\s*참조하면[^.。]*[.。]\\s*`,'g'),'');
    });
    filteredLines.push(safeLine);
  }
  
  cleaned=filteredLines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  
  // 토스트 알림
  if(cleaned!==text){
    const removed=text.length-cleaned.length;
    App.showToast(`⚠️ 범위 초과 도면(도 ${badNums.join(',')}) 참조 자동 제거 (${removed}자)`,'error');
  }
  
  return cleaned;
}
// v10.2: 한국어 "은/는" 조사 선택 — 도면 번호 기준
function figParticle(n){
  // 받침 있는 숫자: 1(일),3(삼),6(육),7(칠),8(팔)
  // 받침 없는 숫자: 2(이),4(사),5(오),9(구),0(영)
  // 10의 배수: 십→받침→은
  const lastDigit=n%10;
  if(lastDigit===0)return n>=10?'은':'는'; // 10,20,30...→십(받침), 0→영(무받침)
  if([1,3,6,7,8].includes(lastDigit))return '은';
  return '는'; // 2,4,5,9
}
// ★ [§6-5] 목적어 조사 을/를 — 라벨 마지막 글자의 받침 유무. 받침 있으면 '을', 없으면(모음 종성) '를'.
//   기존 `${label}을` 하드코딩(모음 라벨 "사용자 시나리오"→"시나리오을" 오류)을 이 헬퍼로 교체.
function josaEulReul(word){ const s=String(word||''); if(!s)return '을'; const c=s.charCodeAt(s.length-1); if(c<0xAC00||c>0xD7A3)return '을'; return ((c-0xAC00)%28>0)?'을':'를'; }
function extractBriefDescriptions(s07,s11){
  const d=[],seen=new Set();
  // v10.2: 0. Step 8 상세설명에서 도면 소개문 우선 추출
  const latestDesc=getLatestDescription();
  if(latestDesc){
    latestDesc.split('\n').forEach(l=>{
      // "도 N은 ~블록도이다." 또는 "도 N은 ~예시도이다. 도 N을 참조하면,~" (같은 줄)
      const m=l.trim().match(/^(도\s*(\d+)\s*[은는]\s+.+?(?:블록도|예시도|구성도|개념도|순서도|흐름도|도면)[^.]*이다\.)/);
      if(m&&!seen.has(m[2])){seen.add(m[2]);d.push(m[1]);}
    });
  }
  // 1. AI 출력에서 간단한 설명 추출 (Step 8에서 이미 추출된 것은 건너뜀)
  [s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');
    if(i>=0){
      // 마커 이후: 도 N으로 시작하는 줄 추출
      t.slice(i+24).trim().split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }else{
      // 마커 없을 때: "도 N은/는 ~이다." 형식만 추출 (파트1 디자인 줄 제외)
      t.split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())&&/이다\.\s*$/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }
  });
  // 1b. v10.0: 사용자 도면 간단한 설명 추가
  requiredFigures.forEach(rf=>{
    const fn=String(rf.num);const n=parseInt(fn);
    if(!seen.has(fn)){
      d.push(`도 ${fn}${figParticle(n)} ${rf.description}${josaEulReul(rf.description)} 나타내는 도면이다.`);
      seen.add(fn);
    }
  });
  // 2. 누락 도면 보완: diagramData 기반 폴백 생성 (v10.0: getAutoFigNums 사용)
  const title=selectedTitle||'본 발명';
  const devSubject=getDeviceSubject();
  const devData=diagramData.step_07||[];
  const methodData=diagramData.step_11||[];
  const devAutoNums=getAutoFigNums('step_07');
  const methAutoNums=getAutoFigNums('step_11');
  // 2a. 장치 도면 폴백
  devData.forEach((dd,i)=>{const fn=String(devAutoNums[i]||(i+1));if(seen.has(fn))return;
    const n=parseInt(fn);const pp=figParticle(n);
    function exRef(lab){const m=lab.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);return m?m[1]:'';}
    const allL1=dd.nodes.every(n=>{const r=exRef(n.label);if(!r)return false;const num=parseInt(r);return(num>0&&num<10)||(num>=100&&num<1000&&num%100===0);});
    if(i===0||allL1){d.push(`도 ${fn}${pp} ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{const refs=dd.nodes.map(n=>exRef(n.label)).filter(Boolean).map(Number).filter(n=>n>=100&&n<1000&&n%100===0);
      const pRef=refs.length?refs[0]:100;const pNode=dd.nodes.find(n=>{const r=exRef(n.label);return r&&parseInt(r)===pRef;});
      const pName=pNode?pNode.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim():devSubject;
      d.push(`도 ${fn}${pp} ${pName}(${pRef})의 내부 구성을 나타내는 블록도이다.`);}
    seen.add(fn);});
  // 2b. 방법 도면 폴백
  methodData.forEach((md,i)=>{const fn=String(methAutoNums[i]||(devData.length+i+1));if(seen.has(fn))return;
    const n=parseInt(fn);d.push(`도 ${fn}${figParticle(n)} ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});
  // 2b-2. v11.0: 예시도/개념도 간단한 설명 추가 (실제 생성된 것만)
  const conceptAutoNums=getAutoFigNums('step_07c');
  conceptDiagramTypes.forEach((ct,i)=>{
    if(!ct.svgContent)return;
    const fn=String(conceptAutoNums[i]||'?');if(seen.has(fn))return;
    const n=parseInt(fn);const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    d.push(`도 ${fn}${figParticle(n)} ${title}의 ${typeDef.label}${josaEulReul(typeDef.label)} 나타내는 예시도이다.`);
    seen.add(fn);
  });
  // 2c. diagramData 없을 때 텍스트 기반 폴백
  if(!devData.length&&s07){const figs=s07.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];const n=parseInt(fn);
    if(fn==='1'){d.push(`도 1${figParticle(1)} ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{d.push(`도 ${fn}${figParticle(n)} ${title}의 세부 구성을 나타내는 블록도이다.`);}seen.add(fn);});}
  if(!methodData.length&&s11){const figs=s11.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];const n=parseInt(fn);
    d.push(`도 ${fn}${figParticle(n)} ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});}
  // 2d. 실제 도면 번호 기준 필터 — UI 설정값 + 생성 여부 기반
  const _uiDevCount=Math.max(parseInt(document.getElementById('optDeviceFigures')?.value||4)-requiredFigures.length,0);
  const _hasMeth=!!(methodData.length||outputs.step_11);
  const _uiMethCount=_hasMeth?parseInt(document.getElementById('optMethodFigures')?.value||2):0;
  const _uiConcepts=conceptDiagramTypes.filter(ct=>ct.svgContent);
  const _uiConcCount=_uiConcepts.length;
  const _uiConcOverrides=_uiConcepts.map(ct=>ct.figNumOverride||0);  // ③ 예시도 지정 번호 반영
  const _uiFigNums=computeFigNums(_uiDevCount,_uiMethCount,_uiConcCount,_uiConcOverrides);
  const validFigNums=new Set();
  _uiFigNums.device.forEach(n=>validFigNums.add(String(n)));
  _uiFigNums.method.forEach(n=>validFigNums.add(String(n)));
  _uiFigNums.concept.forEach(n=>validFigNums.add(String(n)));
  requiredFigures.forEach(rf=>validFigNums.add(String(rf.num)));
  if(validFigNums.size>0){for(let i=d.length-1;i>=0;i--){const fm=d[i].match(/도\s*(\d+)/);if(fm&&!validFigNums.has(fm[1]))d.splice(i,1);}}
  // 3. 정렬
  d.sort((a,b)=>{const na=parseInt(a.match(/도\s*(\d+)/)?.[1]||0),nb=parseInt(b.match(/도\s*(\d+)/)?.[1]||0);return na-nb;});
  return d.join('\n');
}
function stripKoreanParticles(w){if(!w||w.length<2)return w;const ps=['에서는','으로써','에서','으로','에게','부터','까지','에는','하는','되는','된','하여','있는','없는','같은','통하여','위한','대한','의한','를','을','이','가','은','는','에','의','와','과','로','도','든','인','적','로서'];for(const p of ps){if(w.endsWith(p)&&w.length>p.length+1)return w.slice(0,-p.length);}return w;}

