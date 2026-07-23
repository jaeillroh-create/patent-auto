// ═══════════ FILE UPLOAD ═══════════
// 공유 파일 처리 함수
async function _processUploadedFiles(files){
  const listEl=document.getElementById('fileList');
  for(const file of files){
    if(uploadedFiles.find(f=>f.name===file.name)){App.showToast(`"${file.name}" 이미 추가됨`,'info');continue;}
    const item=document.createElement('div');item.className='file-upload-item';item.id=`file_${uploadedFiles.length}`;
    item.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML=`<span class="ico" data-icon="doc"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-neutral">${App.formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    if(listEl)listEl.appendChild(item);
    try{
      const text=await App.extractTextFromFile(file);
      if(text&&text.trim()){
        uploadedFiles.push({name:file.name,text:text.trim(),size:file.size});
        const ta=document.getElementById('projectInput');const separator=ta.value.trim()?'\n\n':'';
        ta.value+=`${separator}[첨부: ${file.name}]\n${text.trim()}`;
        item.innerHTML=`<span class="ico" data-icon="check-circle"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-success">${App.formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length-1},'${App.escapeHtml(file.name).replace(/'/g, "\\'")}')">\u2715</button>`;
        App.showToast(`"${file.name}" 추출 완료`);
      }else{
        item.innerHTML=`<span class="ico" data-icon="warning"></span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-warning">추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
      }
    }catch(e){
      item.innerHTML=`<span class="ico" data-icon="x"></span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
    }
  }
  if(uploadedFiles.length>0)debouncedGenerateInventionSummary();
}
async function handleFileUpload(event) {
  const files = Array.from(event.target.files);if (!files.length) return;
  await _processUploadedFiles(files);
  event.target.value = '';
}
function removeUploadedFile(idx, name) {
  const f = uploadedFiles.find(f=>f.name===name) || uploadedFiles[idx];if (!f) return;
  const ta = document.getElementById('projectInput');const marker = `[첨부: ${f.name}]`;const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();}
  const realIdx = uploadedFiles.indexOf(f);
  if (realIdx >= 0) uploadedFiles.splice(realIdx, 1);
  const el = document.getElementById(`file_${idx}`);if (el) el.remove();App.showToast(`"${name}" 제거됨`);
}
// (File extraction functions are in common.js — App.extractTextFromFile, App.formatFileSize)

// ═══ Drag & Drop 파일 업로드 지원 ═══
function setupDragDrop(){
  const projectArea=document.getElementById('projectInput');
  if(!projectArea)return;
  const wrapper=projectArea.closest('.card')||projectArea.parentElement;
  if(!wrapper)return;
  // 드래그인드롭 영역 스타일링
  const overlay=document.createElement('div');
  overlay.id='dragOverlay';
  overlay.style.cssText='display:none;position:absolute;inset:0;background:rgba(79,70,229,0.08);border:2px dashed var(--color-primary);border-radius:12px;z-index:10;pointer-events:none;align-items:center;justify-content:center';
  overlay.innerHTML='<div style="text-align:center;color:var(--color-primary);font-weight:600"><span class="ico" data-icon="link" data-size="32"></span><br>파일을 여기에 놓으세요<br><span style="font-size:12px;font-weight:normal;color:var(--color-text-secondary)">Word, PDF, PPT, 이미지 등</span></div>';
  wrapper.style.position='relative';
  wrapper.appendChild(overlay);
  let dragCounter=0;
  wrapper.addEventListener('dragenter',e=>{e.preventDefault();e.stopPropagation();dragCounter++;overlay.style.display='flex';});
  wrapper.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  wrapper.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();dragCounter--;if(dragCounter<=0){dragCounter=0;overlay.style.display='none';}});
  wrapper.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();dragCounter=0;overlay.style.display='none';
    const files=Array.from(e.dataTransfer.files);if(!files.length)return;
    // 파일 입력 핸들러 재사용
    await handleDroppedFiles(files);
  });
  // 파일 input accept 속성 설정
  const fileInput=document.querySelector('input[type="file"][onchange*="handleFileUpload"]')||document.querySelector('#fileUploadInput');
  if(fileInput){
    fileInput.setAttribute('accept','.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.hwp,.hwpx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.csv');
    if(!fileInput.hasAttribute('multiple'))fileInput.setAttribute('multiple','');
  }
}
async function handleDroppedFiles(files){
  await _processUploadedFiles(files);
}

// ═══ C5: 파일 업로드 자동 요약 디바운스 (v5.5) ═══
let _summaryDebounceTimer=null;
function debouncedGenerateInventionSummary(){
  if(_summaryDebounceTimer)clearTimeout(_summaryDebounceTimer);
  _summaryDebounceTimer=setTimeout(()=>{generateInventionSummary();},1500);
}

// ═══ Task 2: 업로드 파일 자동 요약 (발명 내용 요약 표시) ═══
async function generateInventionSummary(){
  const inv=document.getElementById('projectInput').value.trim();
  if(!inv||inv.length<100)return;
  let summaryEl=document.getElementById('inventionSummary');
  if(!summaryEl){
    const ta=document.getElementById('projectInput');
    if(!ta)return;
    summaryEl=document.createElement('div');
    summaryEl.id='inventionSummary';
    summaryEl.style.cssText='margin-top:8px;padding:12px 16px;background:var(--color-bg-secondary);border-radius:10px;border-left:3px solid var(--color-primary);font-size:13px;line-height:1.6;color:var(--color-text-secondary)';
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
    ta.parentElement.insertBefore(summaryEl,ta.nextSibling);
  }else{
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
  }
  try{
    const r=await App.callClaude(`아래 발명 내용을 300자 이내로 핵심만 요약하라. 기술분야, 핵심 구성요소, 주요 기능을 포함. 마크다운/글머리 없이 자연스러운 문장으로.\n\n${inv.slice(0,5000)}`);
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br>${App.escapeHtml(r.text)}`;
  }catch(e){
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-text-tertiary)">요약 생성 실패</span>`;
  }
}

// ═══════════ PROMPTS (v4.7 — Claim System Redesign) ═══════════
// Style reference: project-level overrides global-level
function getStyleRef(){
  const ref=projectRefStyleText||globalRefStyleText;
  if(!ref)return '';
  return '\n\n[참고 문체 — 아래 문서의 문장 형태, 단락 구조, 작성 방식만 참고하라. 내용은 절대 참조하지 마라. 발명의 내용과 무관하다.]\n'+ref.slice(0,3000);
}
function getFullInvention(opts){
  const inv=document.getElementById('projectInput').value;
  let text=inv;
  // opts.stripMeta: 청구범위/작성요청 등 메타 섹션 제거 (step_08, step_12 등 상세설명용)
  if(opts&&opts.stripMeta){
    text=text.replace(/\[청구범위\][\s\S]*?(?=\[(?!청구범위)|$)/gi,'')
             .replace(/\[작성\s*요청\][\s\S]*?(?=\[(?!작성)|$)/gi,'')
             .replace(/\[청구항\s*구성\][\s\S]*?(?=\[(?!청구항)|$)/gi,'')
             .trim();
  }
  // opts.deviceOnly: 장치 상세설명 전용 — 방법 관련 문장 제거
  if(opts&&opts.deviceOnly){
    text=text.split('\n').filter(line=>{
      const l=line.trim();
      if(!l)return true; // 빈 줄 유지
      // 방법 단계 정의 줄 제거 (S100, S200, S110 등으로 시작)
      if(/^S\d{2,4}/i.test(l))return false;
      // "단계 S110" 또는 "S110 단계" 패턴 포함 줄
      if(/단계\s*S\d|S\d{2,4}\s*단계/i.test(l))return false;
      // "S110:" 등으로 시작하는 줄
      if(/^S\d{2,4}\s*[:：]/i.test(l))return false;
      // "S110 내지 S150" 등 방법 범위 표현
      if(/S\d{2,4}\s*내지\s*S\d/i.test(l))return false;
      // "~하는 단계" + S참조 혼합
      if(/하는\s*단계.*S\d|S\d.*하는\s*단계/i.test(l))return false;
      return true;
    }).join('\n');
    return '\n\n★★★ [발명 내용 — 아래 내용에서 장치 구성(~부)에 관련된 기술적 요소만 참고하라. 방법/단계(S+숫자)는 무시하라] ★★★\n'+text;
  }
  // opts.methodOnly: 방법 상세설명 전용
  if(opts&&opts.methodOnly){
    return '\n\n★★★ [발명 내용 — 아래 내용에서 방법/절차/단계에 관련된 기술적 요소만 참고하라] ★★★\n'+text;
  }
  return '\n\n★★★ [발명 내용 — 아래 내용의 기술적 요소를 빠짐없이 반영하라] ★★★\n'+text;
}
function getRequiredFiguresInstruction(){
  if(!requiredFigures.length)return '';
  const list=requiredFigures.map(f=>`- 도 ${f.num}: ${f.description}`).join('\n');
  return `\n\n[사용자 도면 — 아래 도면은 사용자가 이미 보유하고 있다. 이 번호들은 건너뛰고 나머지 도면만 새로 생성하라. 단, 도면의 간단한 설명에는 사용자 도면도 모두 포함하라.]\n${list}`;
}
// ═══ v10.0/v11.0/③: 사용자 도면·예시도 지정 번호 스킵 — 자동 도면 번호 산출 ═══
// devCount/methCount/conceptCount: 자동 생성할 장치/방법/개념도 도면 수. conceptOverrides: 예시도별 지정 도 번호(figNumOverride, 0=자동).
//   ★ ③: requiredFigures.num(사용자 업로드)에 더해 예시도 figNumOverride 도 예약 → 지정 위치에 예시도, 자동 도면은 밀림(삽입 밀림).
function computeFigNums(devCount,methCount,conceptCount,conceptOverrides){
  conceptCount=conceptCount||0;
  conceptOverrides=Array.isArray(conceptOverrides)?conceptOverrides:[];
  // 예약 집합 = 사용자 업로드 번호 ∪ 예시도 지정 번호(figNumOverride)
  const reserved=new Set(requiredFigures.map(f=>f.num));
  conceptOverrides.forEach(n=>{const v=parseInt(n);if(v>0)reserved.add(v);});
  const devNums=[],conceptNums=[],methNums=[];
  let c=1;
  for(let i=0;i<devCount;i++){while(reserved.has(c))c++;devNums.push(c);c++;}
  for(let i=0;i<conceptCount;i++){
    const ov=parseInt(conceptOverrides[i]);
    if(ov>0){conceptNums.push(ov);}                                  // ★ 지정 번호(이미 예약)
    else{while(reserved.has(c))c++;conceptNums.push(c);c++;}          // 자동(예약 skip)
  }
  for(let i=0;i<methCount;i++){while(reserved.has(c))c++;methNums.push(c);c++;}
  const _max=arr=>arr.length?Math.max.apply(null,arr):0;
  const lastDeviceFig=conceptNums.length?_max(conceptNums):_max(devNums);  // 방법 앞 최고 번호(override 대비 max)
  const lastFig=Math.max(_max(devNums),_max(conceptNums),_max(methNums));  // override 가 자동 범위 밖이어도 정확
  return{device:devNums,concept:conceptNums,method:methNums,lastDeviceFig,lastFig};
}
// 렌더링용: diagramData 기반 자동 도면 번호 (★ ③ 예시도 figNumOverride 반영)
function getAutoFigNums(sid){
  const devCount=diagramData.step_07?.length||0;
  const methCount=diagramData.step_11?.length||0;
  const concepts=conceptDiagramTypes.filter(ct=>ct.svgContent);
  const cOverrides=concepts.map(ct=>ct.figNumOverride||0);
  const r=computeFigNums(devCount,methCount,concepts.length,cOverrides);
  return sid==='step_07'?r.device:sid==='step_07c'?r.concept:r.method;
}
// ③ 생성된(svgContent) 예시도들의 지정 도 번호 배열 — computeFigNums 4번째 인자용(figNumOverride 일관 주입)
function _placedConceptOverrides(){
  return conceptDiagramTypes.filter(ct=>ct.svgContent).map(ct=>ct.figNumOverride||0);
}
// 사용자 도면 설명을 Step 8/12 프롬프트에 삽입하는 헬퍼
function getUserFiguresPromptBlock(){
  if(!requiredFigures.length)return '';
  return '\n\n[사용자 도면 — 아래 도면은 사용자가 제공한 것이며, 상세설명에서 해당 도면 번호를 참조하여 설명을 포함하라. 발명 내용과 정합되도록 기술하라.]\n'+
    requiredFigures.map(f=>`도 ${f.num}: ${f.description}`).join('\n');
}
function buildAnchorThemeInstruction(mode,themes,count){
  if(mode==='fixed'&&themes.length){
    const labels=themes.map(k=>{const t=ANCHOR_THEMES.find(a=>a.key===k);return t?`${t.label}(${t.key})`:k;});
    return `지정된 앵커 테마: ${labels.join(', ')} 순서대로 배정하라.`;
  }
  return `발명 내용에서 키워드를 추출하고 아래 매핑에 따라 ${count}개 테마를 선택하라 (중복 최소화):
- OCR/문서추출/파싱/데이터 품질 → reliability_weighting 또는 cross_validation
- 임계값/스코어/등급/랭킹/추천 → threshold_adaptation 또는 explainability_trace
- 외부 API/연동/실패/오류/재시도 → fallback_retry
- 근거/설명/기여도/추적/로그 → explainability_trace
- 정규화/전처리/스케일/편향 → bias_normalization
- 피드백/재학습/가중치 재조정 → feedback_reweighting
- 권한/마스킹/암호화/감사 → privacy_audit
- 시계열/시간/윈도우/감쇠/이력 → temporal_windowing
- 캐싱/인덱싱/중간결과/조회속도 → caching_indexing
- 앙상블/다중모델/투표/합의/비교 → ensemble_arbitration`;
}
function getCategoryEnding(cat){return CATEGORY_ENDINGS[cat]||CATEGORY_ENDINGS.server;}
function autoDetectCategoryFromTitle(){
  const t=selectedTitle||'';const ty=selectedTitleType||'';
  if(/서버/.test(ty)||/서버/.test(t))return 'server';
  if(/시스템/.test(ty)||/시스템/.test(t))return 'system';
  if(/장치/.test(ty)||/장치/.test(t))return 'apparatus';
  if(/단말|전자/.test(ty)||/단말|전자/.test(t))return 'electronic_device';
  return 'server';
}
// ★ 발명 명칭에서 장치 주체명 추출 (서버/시스템/장치/단말 등) ★
function getDeviceSubject(){
  const ty=selectedTitleType||'';
  if(/서버/.test(ty))return '서버';
  if(/시스템/.test(ty))return '시스템';
  if(/장치/.test(ty))return '장치';
  if(/단말/.test(ty))return '단말';
  const t=selectedTitle||'';
  const m=t.match(/(서버|시스템|장치|단말)\s*$/);
  if(m)return m[1];
  return '서버';
}

// ═══ 젭슨(Jepson) 청구항 지원 (v5.4) ═══
// 발명 명칭 말미를 분석하여 독립항의 Jepson 프리앰블을 생성
function parseJepsonSubjects(){
  const title=selectedTitle||'';
  const ty=selectedTitleType||'';
  // "및" 또는 "과" 로 분리된 복수 카테고리 감지 (예: "Z 서버 및 방법", "X 장치 및 방법")
  const conjMatch=title.match(/^(.+?)\s*(서버|시스템|장치|단말|전자\s*장치)\s*(및|과|,)\s*(방법)\s*$/);
  if(conjMatch){
    const core=conjMatch[1].trim();
    const devWord=conjMatch[2].trim();
    return {
      device:`${core} ${devWord}`,  // "Z 서버"
      method:`${core} 방법`,         // "Z 방법"
      hasDevice:true, hasMethod:true
    };
  }
  // 단일 카테고리
  const devMatch=title.match(/(서버|시스템|장치|단말|전자\s*장치)\s*$/);
  const methMatch=title.match(/방법\s*$/);
  if(devMatch&&!methMatch) return {device:title,method:'',hasDevice:true,hasMethod:false};
  if(methMatch&&!devMatch) return {device:'',method:title,hasDevice:false,hasMethod:true};
  // 타입 정보로 판단
  if(/서버|시스템|장치|단말/.test(ty))return {device:title,method:'',hasDevice:true,hasMethod:false};
  if(/방법/.test(ty))return {device:'',method:title,hasDevice:false,hasMethod:true};
  // 기본: 장치로 간주
  return {device:title,method:'',hasDevice:true,hasMethod:false};
}

function getJepsonInstruction(claimType){
  const subj=parseJepsonSubjects();
  const target=claimType==='method'?subj.method:subj.device;
  if(!target)return '';
  return `
★★★ 젭슨(Jepson) 청구항 형식 — 독립항 필수 적용 ★★★
독립항은 반드시 아래 젭슨(Jepson Claim) 구조를 따르라:

[구조]
(1) 전환부(Transition): "${target}에 있어서," ← 독립항의 첫 줄에 반드시 이 문구가 온다
(2) 전제부(Preamble): 공지 구성요소 또는 종래 기술 요소를 나열 (구성 간 세미콜론(;)으로 구분, 구성마다 줄바꿈)
(3) 특징부(Body): 본 발명의 신규하고 특징적인 구성요소를 기술 (구성 간 세미콜론(;)으로 구분, 구성마다 줄바꿈)
(4) 종결부(Closing): "~을 특징으로 하는 ${target}."

★ 서식 핵심 규칙 ★
- "~에 있어서,"가 독립항의 가장 첫 문장이다. 그 앞에 구성요소를 기재하지 마라.
- 구성요소 또는 단계가 달라질 때마다 세미콜론(;)으로 구분하고 줄바꿈한다.
- 마지막 구성요소 직전에는 "; 및"을 사용하고 줄바꿈한다.
- 마지막 구성요소 뒤에도 세미콜론(;)을 붙이고, 줄바꿈 없이 바로 종결부("를 포함하는 것을 특징으로 하는")를 이어 쓴다.
- 전제부와 특징부 사이는 "를 포함하고," 또는 "를 포함하며,"로 연결한다.

[작성 예시 — ${claimType==='method'?'방법':'장치'} 독립항]
【청구항 N】
${claimType==='method'
?`${target}에 있어서,
상기 방법은,
데이터를 수집하는 단계;
상기 수집된 데이터를 분석하는 단계; 및
상기 매칭 결과를 제공하는 단계;를 포함하는 것을 특징으로 하는 ${target}.`
:`${target}에 있어서,
프로세서; 및
메모리;를 포함하고,
상기 프로세서는,
데이터를 수집하도록 구성되는 수집부;
상기 수집된 데이터를 분석하도록 구성되는 분석부; 및
분석 결과에 기초하여 매칭을 수행하도록 구성되는 매칭부;를 포함하는 것을 특징으로 하는 ${target}.`}

⛔ "프로세서; 및 메모리를 포함하는 ${target}에 있어서," ← 이렇게 쓰면 안 된다! "~에 있어서,"가 먼저 와야 한다.
⛔ 독립항에서 "~에 있어서," 전환부를 빠뜨리면 젭슨 형식 위반이다.
⛔ 종속항은 기존 형식 유지: "제N항에 있어서, ~" (젭슨 적용 안 함)
`;
}

// ═══ KIPRIS 선행기술 검색 ═══
// Edge Function이 KIPRIS Plus API (plus.kipris.or.kr) 호출
// KIPRIS Plus API 키 (localStorage에서 사용자 설정 가능)
function getKiprisKey(){
  if(App.apiKeys?.kipris)return App.apiKeys.kipris;
  try{const p=JSON.parse(App.currentProfile?.api_key_encrypted||'{}');if(p.kipris){if(App.apiKeys)App.apiKeys.kipris=p.kipris;return p.kipris;}}catch(e){}
  return '';// Edge Function이 자체 DEFAULT_API_KEY 사용
}

// ═══ 통일된 폰트 크기 계산 (v14) ═══
// 모든 도면 렌더링(SVG/PPTX/Canvas)에서 동일한 폰트 크기 반환
function _computeDiagramFontSize(boxW,boxH,labelLength){
  const safeWidth=boxW*0.85;
  const charWidthFactor=0.58;
  const maxByWidth=Math.floor(safeWidth/(Math.max(labelLength,2)*charWidthFactor));
  const maxByHeight=Math.floor(boxH*0.35);
  return Math.max(10,Math.min(13,maxByWidth,maxByHeight));
}
const REF_NUM_FONT_SIZE=11;

// ═══ 공유 도면 유틸리티 함수 (downloadPptx / downloadDiagramImages 공용) ═══
function _sharedExtractRefNum(label,fallback){
  const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
  return match?match[1]:fallback;
}
function _sharedIsL1RefNum(ref){
  if(!ref||String(ref).startsWith('S'))return false;
  const s=String(ref);
  if(s.startsWith('D')){const n=parseInt(s.slice(1));return !isNaN(n)&&n<10;}
  const num=parseInt(s);
  if(isNaN(num))return false;
  if(num<10)return true;
  if(num<100)return false;
  if(num<1000)return num%100===0;
  return false;
}
function _sharedFindImmediateParent(refNums){
  const nums=refNums.filter(r=>r&&!String(r).startsWith('S')).map(r=>{const s=String(r);return s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);}).filter(n=>!isNaN(n)&&n>0);
  if(!nums.length)return null;
  const l1s=nums.filter(n=>n>=100&&n<1000&&n%100===0);
  const l2s=nums.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
  const l3s=nums.filter(n=>n>=100&&n<1000&&n%10!==0);
  const l4s=nums.filter(n=>n>=1000&&n<10000);
  const smalls=nums.filter(n=>n<100);
  if(l4s.length>0){
    if(l3s.length===1&&l2s.length===0&&l1s.length===0){if(l4s.every(n=>Math.floor(n/10)===l3s[0]))return l3s[0];}
    if(l3s.length===0&&l2s.length===0&&l1s.length===0&&smalls.length===0){const p=[...new Set(l4s.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
    return null;
  }
  if(l1s.length>0){
    if(l1s.length===1&&(l2s.length>0||l3s.length>0)){const t=l1s[0];if(l2s.every(n=>Math.floor(n/100)*100===t)&&l3s.every(n=>Math.floor(n/100)*100===t))return t;}
    return null;
  }
  if(l2s.length>0&&l3s.length===0){const p=[...new Set(l2s.map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;}
  if(l2s.length>0&&l3s.length>0){
    if(l2s.length===1&&l3s.every(n=>Math.floor(n/10)*10===l2s[0]))return l2s[0];
    const p=[...new Set([...l2s,...l3s].map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;
  }
  if(l3s.length>0){const l2p=[...new Set(l3s.map(n=>Math.floor(n/10)*10))];if(l2p.length===1)return l2p[0];const l1p=[...new Set(l2p.map(p=>Math.floor(p/100)*100))];return l1p.length===1?l1p[0]:null;}
  if(smalls.length>0){
    const singles=smalls.filter(n=>n<10),doubles=smalls.filter(n=>n>=10);
    if(singles.length===1&&doubles.length>0&&doubles.every(n=>Math.floor(n/10)===singles[0]))return singles[0];
    if(singles.length===0&&doubles.length>0){const p=[...new Set(doubles.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
  }
  return null;
}

// 등록번호 포맷: 1020XXXXXXX → 10-20XXXXX
function formatRegNumber(regNum){
  if(!regNum)return '';
  const cleaned=String(regNum).replace(/[^0-9]/g,'');
  if(!cleaned)return regNum;
  if(cleaned.length>=10){
    let core=cleaned;
    if(core.length===13)core=core.slice(0,-4);
    if(core.startsWith('10'))return'10-'+core.substring(2);
    if(core.startsWith('20'))return'20-'+core.substring(2);
  }
  return regNum;
}

// 한국어 조사 제거 → 핵심 키워드 추출
function extractPatentKeywords(title){
  return title
    .replace(/[및과와]/g,' ')
    .replace(/\s+/g,' ').trim()
    .split(' ')
    .map(w=>stripKoreanParticles(w))
    .filter(w=>w.length>=2)
    .slice(0,4)
    .join(' ');
}

// KIPRIS 검색 (Supabase Edge Function → 공공데이터포털 API)
async function searchKiprisPlus(query,maxResults=5){
  try{
    if(!App.sb?.functions){console.warn('[KIPRIS] Supabase 미연결');return[];}
    console.log(`[KIPRIS] 🔍 특허 검색: "${query}"`);
    const {data,error}=await App.sb.functions.invoke('kipris-proxy',{
      body:{
        type:'patent_word',
        params:{word:query,numOfRows:maxResults,patent:true,utility:true},
        apiKey:getKiprisKey()
      }
    });
    if(error){console.error('[KIPRIS] Edge Function error:',error);return[];}
    if(!data||!data.success){console.warn('[KIPRIS] API 실패:',data?.error);return[];}
    console.log(`[KIPRIS] ✅ ${(data.results||[]).length}건 (총 ${data.totalCount||0}건)`);
    if(data.results?.length){console.log('[KIPRIS] 첫 결과 필드:', Object.keys(data.results[0]).join(', '));}
    return data.results||[];
  }catch(e){console.error('[KIPRIS] 검색 실패:',e);return[];}
}

// Claude AI 폴백 (KIPRIS 실패 시)
async function searchPriorArtViaClaude(title,invention){
  try{
    const invSlice=(invention||'').slice(0,2000);
    const prompt=`너는 한국 특허 데이터베이스 전문가이다. 아래 발명과 기술적으로 가장 관련성이 높은 한국 등록특허 1건을 추천하라.

[발명의 명칭] ${title}
${invSlice?`[발명 요약] ${invSlice}`:''}

[필수 규칙]
1. 실제 존재할 가능성이 높은 한국 등록특허만 제시. 불확실하면 "NONE" 출력.
2. 등록번호(10-XXXXXXX), 발명의 명칭, 출원인을 기재.
3. 기술 분야가 유사한 특허를 우선 선택.
4. 아래 JSON 형식만 출력. 설명/부연 금지.

[출력 형식]
{"regNumber":"10-XXXXXXX","title":"발명의 명칭","assignee":"출원인"}
또는
NONE`;
    const r=await App.callClaude(prompt);
    const text=(r.text||'').trim();
    if(!text||text==='NONE'||text.includes('NONE'))return[];
    const jsonMatch=text.match(/\{[^}]+\}/);
    if(!jsonMatch)return[];
    const parsed=JSON.parse(jsonMatch[0]);
    if(!parsed.regNumber||!parsed.title)return[];
    return[{
      registerNumber:parsed.regNumber.replace(/-/g,''),
      inventionTitle:parsed.title,
      applicantName:parsed.assignee||'',
      applicationNumber:'',applicationDate:'',registerDate:'',
      ipcNumber:'',openNumber:'',publicationNumber:'',astrtCont:'',
      source:'claude'
    }];
  }catch(e){console.error('Claude prior art search failed:',e);return[];}
}

async function searchPriorArt(title){
  const inv=document.getElementById('projectInput')?.value||'';
  let results=[];

  // 1차: 발명의 명칭 그대로 검색
  results=await searchKiprisPlus(title,5);

  // 2차: 키워드 추출하여 재검색
  if(!results.length){
    const kw=extractPatentKeywords(title);
    if(kw&&kw!==title)results=await searchKiprisPlus(kw,5);
  }

  // 3차: Claude AI 폴백
  if(!results.length){
    results=await searchPriorArtViaClaude(title,inv);
  }

  if(!results.length)return null;

  // 필드명 정규화 (KIPRIS API 버전에 따라 필드명이 다를 수 있음)
  results=results.map(r=>({
    ...r,
    _regNum: r.registerNumber || r.registrationNumber || r.registerNum || '',
    _title: r.inventionTitle || r.title || '',
    _appNum: r.applicationNumber || '',
    _applicant: r.applicantName || r.assignee || ''
  }));

  console.log('[KIPRIS] 정규화 결과:', results.map(r=>({reg:r._regNum, title:r._title?.slice(0,30), app:r._appNum})));

  // 등록번호 있는 건 우선 → 출원번호 있는 건 차선
  const sorted=results.sort((a,b)=>{
    const aReg=a._regNum?2:(a._appNum?1:0);
    const bReg=b._regNum?2:(b._appNum?1:0);
    return bReg-aReg;
  });
  const best=sorted[0];

  // 번호 결정: 등록번호 > 출원번호
  const hasRegNum=!!best._regNum;
  const numToUse=best._regNum||best._appNum;
  if(!numToUse&&!best._title){
    console.warn('[KIPRIS] 선별 실패: 유효한 번호/명칭 없음',best);
    return null;
  }

  const fmtNum=hasRegNum?formatRegNumber(best._regNum):formatRegNumber(best._appNum);
  const docType=hasRegNum?'한국등록특허':'한국공개특허';
  // v10.2: 특허번호만 표시 — 발명의 명칭 및 AI 추천 문구 제거
  return{
    formatted:`【특허문헌】\n(특허문헌 1) ${docType} 제${fmtNum||'미확인'}호`,
    patent:{
      publicationNumber:best._regNum||best._appNum,
      title:best._title,
      assignee:best._applicant,
      applicationNumber:best._appNum,
      registerDate:best.registerDate||best.registrationDate||'',
      ipcNumber:best.ipcNumber||'',
      source:best.source||'kipris'
    },
    sourceNote:'',
    src:best.source==='claude'?'AI':'KIPRIS'
  };
}

// ★ 수학식 생성 프롬프트 — 단일 소스(분산 제거). step_09 작성·_cascadeRunMath·runMathInsertion·applyReview 재삽입이 전부 이걸 사용.
//   [배경] 이전엔 같은 수학식 프롬프트가 3곳(case step_09 / applyReview 보존실패 재생성 / applyReview 신규생성)에 흩어져
//          곱셈 기호 규칙이 갈렸다 — step_09 는 "× 또는 ·" 허용(혼용), 나머지 2곳은 기호 규칙 자체가 누락. → 단일화로 근본 해결.
//   ★ 곱셈은 "×"(U+00D7) 하나로 통일. 내적은 "·"(U+00B7), 소수점은 "."로 ★구분 보존★(곱셈만 ×).
//   @param {string} countText 생성 개수 문구("5개 내외" 또는 "3개")  @param {string} descText 현재 상세설명  @param {string} [extraTail] 추가 컨텍스트(옵션)
function buildMathPrompt(countText, descText, extraTail){
  return `상세설명의 핵심 알고리즘에 수학식 ${countText}.

★★★ 수학식 변수 정의 완전성 규칙 (기재불비 방지 — 핵심) ★★★
- 모든 수학식의 모든 변수는 반드시 아래 항목을 포함하여 정의하라:
  (1) 변수명과 물리적 의미 (예: "S는 생체 리듬 상태 지표이다")
  (2) 값 유형 (스칼라/벡터/분류값)
  (3) 값 범위 또는 예시적 범위 (예: "0 이상 1 이하의 정규화값이다")
  (4) 단위가 있으면 단위 명시
- 같은 변수가 복수 수학식에 등장하면, 정의가 모순되지 않게 하라.
  → 수학식 1의 출력이 수학식 2의 입력이면, 변수명·정의·범위가 완전 일치해야 한다.

★★★ 수학식 간 정합성 규칙 (핵심) ★★★
- 동일 목적의 수학식이 2개 이상 있으면(예: 보정 공식이 2가지 방식), 반드시:
  (1) 두 식의 관계를 명시하라 ("수학식 3은 수학식 4의 단순화 형태이다" 또는 "수학식 3과 수학식 4는 각각 초기 보정과 장기 보정에 적용된다")
  (2) 변수 간 대응관계를 정리하라 (예: "C = S_post - S_target에서 C는 (Sd - Sa)와 부호가 반대이다")
  (3) 부호/방향이 일관되는지 검증하라
- 수치 예시 계산 시, 부호와 방향이 본문 설명과 일치하는지 반드시 검산하라:
  → "음량 감소 폭이 증가한다"고 서술했으면, 계산 결과도 절대값이 더 커야 한다
  → "각성 수준이 하강한다"고 서술했으면, 수치도 더 작아야 한다

★★★ 보정/학습 변수 규칙 ★★★
- alpha, beta 등 학습률/보정 계수에는 반드시:
  (1) 부호 의미: 양수일 때 어느 방향으로 보정되는가
  (2) 값 범위: 예시적 범위 (예: 0.01~0.5)
  (3) 과도 누적 방지: 보정 횟수 상한, 누적 보정량 상한, 또는 점감 조건
  (4) 초기값과 갱신 여부
규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.
★ 수치 예시는 "예를 들어,", "일 예로,", "구체적 예시로," 등 자연스러운 표현 사용 ("예시 대입:" 금지)

★★★ 수학 기호 규칙 (필수 — 곱셈은 × 로 통일) ★★★
- ★ 곱셈(스칼라·일반 곱) 연산자는 반드시 "×" (U+00D7) 하나로 통일하라.
- ❌ 금지: ASCII 알파벳 "x" 또는 "X"를 곱셈 기호로 사용 (변수명 x와 혼동)
- ❌ 금지: ASCII 별표 "*"를 곱셈 기호로 사용 (코드 표기, 특허 명세서 부적합)
- ❌ 금지: 가운데점 "·"를 곱셈 기호로 사용 (내적과 혼동 — 곱셈은 반드시 ×)
- ✅ 곱셈 올바른 예: "a × b", "2 × π × r", "α × β", "3 × 10⁻⁶"
- ❌ 곱셈 잘못된 예: "a x b", "a * b", "a · b", "alpha*beta"
- ★ 가운데점 "·" (U+00B7)은 ★벡터 내적(dot product)에만★ 사용하라 (예: "u · v" 는 벡터 u와 v의 내적). 곱셈과 구분한다.
- ★ 소수점은 마침표 "." 를 사용하라 (예: "0.5", "1.2 × 10³"). 소수점에 가운데점(·)을 쓰지 마라.
- 변수 인접 곱셈은 기호 생략 가능 (예: "ab", "2πr").
- 나눗셈은 "÷" 또는 분수 표기, 부등호는 "≤", "≥", "≠" 사용
- 그리스 문자는 유니코드 사용 (α, β, γ, π, σ, μ, λ — "alpha", "beta" 등 영어 표기 금지)
- "여기서," 변수 설명, "예를 들어," 수치 예시에서도 동일 규칙 적용

⛔⛔⛔ 수학식 간 교차참조 금지 (핵심!) ⛔⛔⛔
- 수학식의 "여기서," 설명에서 다른 수학식을 번호로 참조하지 마라.
- ❌ 금지: "수학식 1에 의해 산출된 Lw", "수학식 2의 결과를 이용하여"
- ✅ 허용: "상기 산출된 가중 소음 수준 Lw", "상기 개별 소음 수준 Li를 이용하여"
- 각 수학식의 변수 설명은 해당 수학식 내에서 자체 완결적으로 작성하라.
- 변수가 다른 수학식에서도 사용되는 경우, 변수의 의미만 재서술하라 (번호 참조 금지).

⛔⛔ ANCHOR 규칙 ⛔⛔
- ANCHOR는 반드시 마침표(다.)로 끝나는 완전한 문장의 끝부분을 사용하라.
- ❌ 금지: 쉼표(,) 또는 접속어(~하고, ~하며)로 끝나는 절 중간을 ANCHOR로 사용
- ❌ 금지: "예를 들어" 블록 내부를 ANCHOR로 사용
- ✅ 올바른 ANCHOR 예: "~을 산출한다." "~을 포함한다." "~으로 구성된다."

⛔⛔ FORMULA 규칙 ⛔⛔
- FORMULA에는 【수학식 N】 + 수식 + "여기서," + "예를 들어," 만 포함.
- ⛔ FORMULA 안에 상세설명 원문 텍스트를 절대 포함하지 마라.
- FORMULA는 "예를 들어," 예시 문장의 마침표(다.)로 종료하라.
- FORMULA 종료 후 추가 텍스트 금지.

출력:
---MATH_BLOCK_1---
ANCHOR: (이 수식이 산출·정의하는 값을 직접 서술하며 상세설명에 정확히 1회만 등장하는 고유 문장의 끝부분 20자 이상, 반드시 "다."로 종료 — 수식과 무관한 문장·중복 문장 금지)
FORMULA:
【수학식 1】
(수식)
여기서, (각 변수는 상세설명에 이미 등장한 파라미터·구성을 구체화하는 것이어야 함 — 본문에 없는 새 개념 도입 금지, 다른 수학식 번호 참조 금지, 변수명으로만 설명)
예를 들어, (수치 대입 설명)

${selectedTitle}
[현재 상세설명] ${descText}${extraTail||''}`;
}

function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  const styleRef=getStyleRef();
  const prompt=_buildPromptCore(stepId,inv,T,styleRef);
  if(!prompt)return prompt;
  
  // v6.0: 기존 내용 존재 시 부분 수정 모드
  const userCmd=getStepUserCommand(stepId);
  if(userCmd&&outputs[stepId]){
    // v10.5 fix: step_08/step_12 부분 수정 시 도면 범위 제약 명시 (재실행 시 없는 도면 참조 방지)
    let _pmFigConstraint='';
    if(stepId==='step_08'){
      const _pmDesign=outputs.step_07||'';
      const _pmActual=_extractFigureNumbersFromDesign(_pmDesign);
      const _pmCFN=getAutoFigNums('step_07c').filter((_,i)=>conceptDiagramTypes[i]?.svgContent);
      const _pmAll=[...new Set([..._pmActual,...requiredFigures.map(f=>f.num),..._pmCFN])].sort((a,b)=>a-b);
      if(_pmAll.length>0){
        const _pmMax=Math.max(..._pmAll);
        _pmFigConstraint=`\n⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔\n- 이 발명의 장치 도면: ${_pmAll.map(n=>'도 '+n).join(', ')} (총 ${_pmAll.length}개)\n- 위 목록에 없는 도면 번호를 절대 참조하지 마라.\n- 도 ${_pmMax+1} 이후 도면 참조/설명 금지.\n`;
      }
    }else if(stepId==='step_12'){
      const _pmMeth=_extractFigureNumbersFromDesign(outputs.step_11||'');
      if(_pmMeth.length>0){
        const _pmMax=Math.max(..._pmMeth);
        _pmFigConstraint=`\n⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔\n- 이 발명의 방법 도면: ${_pmMeth.map(n=>'도 '+n).join(', ')} (총 ${_pmMeth.length}개)\n- 위 목록에 없는 방법 도면 번호를 절대 참조하지 마라.\n- 도 ${_pmMax+1} 이후 도면 참조/설명 금지.\n`;
      }
    }
    // 기존 내용 + 추가 지시 → 부분 수정 프롬프트
    // [C1-3] Layer 1 가드: invention_scope 주입
    return `아래 [기존 작성 내용]을 바탕으로, [수정 지시사항]에 해당하는 부분만 수정하고 나머지는 그대로 유지하여 전체 내용을 출력하라.
수정 지시와 무관한 부분은 원문 그대로 유지해야 한다. 전체 재작성 금지.
${_pmFigConstraint}
[수정 지시사항]
${userCmd}

[기존 작성 내용]
${outputs[stepId]}

[참고: 원래 작성 기준]
${prompt}${_maybeScopeGuard(stepId,'text')}`;
  }

  // 기존 내용 없음 → 전체 신규 작성 + 추가 지시사항
  // [C1-3] Layer 1 가드: invention_scope 주입
  return prompt+buildUserCommandSuffix(stepId)+_maybeScopeGuard(stepId,'text');
}
function _buildPromptCore(stepId,inv,T,styleRef){
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: \"~${selectedTitleType}\"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. "본 발명은 ${T}에 관한 것이다." 이 한 문장만 출력하라. 발명의 명칭을 축약하거나 변경하지 마라. 다른 항목 포함 금지. 헤더 금지.${styleRef}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성.\n\n★ 역설계 작성 원칙 ★\n아래 [과제]에서 제기한 문제가 왜 존재하는지, 종래 기술의 한계를 설명하라.\n과제에서 "A가 문제다"라고 했으면, 배경기술에서는 "종래 기술은 A를 해결하지 못했다"를 논거로 전개.\n\n3문단(기존문제/최근동향/필요성), 각 450자. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[과제] ${outputs.step_05||''}\n[장치 청구항 요약] ${(outputs.step_06||'').slice(0,1500)}\n[프로젝트] ${inv}${styleRef}`;
    case 'step_04':return null; // KIPRIS API 실시간 검색으로 대체
    case 'step_05':return `【해결하고자 하는 과제】를 역설계 방식으로 작성하라.\n\n★ 역설계 원칙 ★\n아래 [과제의 해결 수단]은 이미 확정된 청구항의 요약이다.\n이 해결 수단이 "해결하는 문제가 무엇인지"를 역으로 추론하여 과제를 작성하라.\n\n패턴: 해결수단이 "A를 제공한다" → 과제는 "종래에는 A가 없어서 B 문제가 있었다"\n패턴: 해결수단이 "X부를 포함하는 장치" → 과제는 "종래 X 처리가 비효율적이었다"\n\n"본 발명은 ~을 제공하는 것을 목적으로 한다." 150자 이내.\n마지막: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다." 헤더 금지.\n\n발명의 명칭: ${T}\n[과제의 해결 수단] ${outputs.step_17||''}\n[장치 청구항 요약] ${(outputs.step_06||'').slice(0,2000)}${styleRef}`;

    // ═══ Step 6: 장치 청구항 (v4.7 완전 재작성) ═══
    case 'step_06':{
      // v4.9: Auto-select category from title type if set to 'auto'
      const effectiveCat=(deviceCategory==='auto')?autoDetectCategoryFromTitle():deviceCategory;
      const catLabel=effectiveCat;
      // ★ [배치15B-1a] 다중 독립항 지원 — 독립항 N개면 번호 체계 자동 시프트(일반·앵커 종속항 시작 번호 재계산).
      const _indepN=Math.max(1,parseInt(deviceIndepCount)||1);
      const _genStart=_indepN+1, _genEnd=_indepN+deviceGeneralDep;
      const _ankStart=(_indepN>1)?(_indepN+deviceGeneralDep+1):deviceAnchorStart;
      const anchorEnd=_ankStart+deviceAnchorDep-1;
      const themeInst=buildAnchorThemeInstruction(anchorThemeMode,selectedAnchorThemes,deviceAnchorDep);
      return `장치 청구범위를 작성하라.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: ${_indepN}개 (청구항 1${_indepN>1?'~'+_indepN:''})${_indepN>1?` — ★ 각 독립항은 상이한 권리 관점(장치 구성 축 분리)으로 작성하라. 서로 다른 발명 구성 축을 독립적으로 보호하되, 동일 발명의 단일성(§45) 범위를 벗어나지 마라(독립항 간 구성이 부분적으로 겹칠 수 있으나 보호 관점·축이 달라야 한다). 각 독립항은 자체 완결된 젭슨 구조를 갖춘다.`:''}
- 일반 종속항: ${deviceGeneralDep}개${deviceGeneralDep>0?' (청구항 '+_genStart+'~'+_genEnd+')':''}
- 등록 앵커 종속항: ${deviceAnchorDep}개${deviceAnchorDep>0?' (청구항 '+_ankStart+'~'+anchorEnd+')':''}${_indepN>1?`\n- ★ 종속항 인용: 각 종속항은 독립항(제1~${_indepN}항) 중 관련 권리 관점의 항 하나를 인용하라(단일 항 인용 유지).`:''}
- 종결어: ${getCategoryEnding(deviceCategory==='auto'?'server':deviceCategory)}

[필수 작성 규칙]
(R1) 독립항 최소화 + 상위개념화
- 발명 성립에 필요한 최소 필수 구성요소만 포함
- UI/특정 솔루션명/구체 수치/구체 수식은 독립항에서 배제
- 구성요소 간 입력→처리→출력 흐름의 유기적 결합 반드시 포함 (단순 나열 금지)

(R2) 용어 일관성: 동일 개체는 동일 명칭 반복. \"상기\"는 혼동 방지에 필요한 범위에서만.

(R3) Killer Words 금지: \"반드시/무조건/오직/필수적으로/만\" 절대 금지. \"~하도록 구성되는\", \"~하는\", \"~을 포함하는\" 사용.

(R4) 일반 종속항: 상위항 인용하여 구체화·확장. ★ 발명의 본질(핵심 구성요소·핵심 기능)을 각 일반 종속항이 분담하여 빠짐없이 한정하라 — 발명의 본질적 기능 중 어느 하나라도 종속항 어디에도 구체화되지 않고 누락되는 일이 없도록 하라(일반 종속항은 발명충실항으로서 발명의 본질을 충실히 반영해야 한다). 수치/수식은 과도하게 고정하지 않고, 후속 Step 8/9/13에서 상세화 가능하도록 문장 구성.

★★ 종속항 작성 규칙 (대통령령 — 위반 시 기재불비) ★★
① ★ 종속항은 반드시 "단일 항"만 인용하라 (예: "제1항에 있어서"). 기본은 독립항(제1항) 인용이며, 필수적으로 연계된 기능을 나누는 경우에만 직전 단일 종속항을 인용한다.
② ★★ 다중인용(2 이상의 항을 인용) 절대 금지 — "제N항 또는 제M항에 있어서", "제N항 및 제M항에 있어서", "제N항 내지 제M항 중 어느 한 항에 있어서" 등 2 이상 항을 인용하는 형태를 절대 생성하지 마라.
④ 종속항은 인용하는 독립항 또는 종속항보다 뒤에 기재 (번호 역전 금지)

${deviceAnchorDep>0?`(R5) 등록 앵커 종속항 (청구항 ${_ankStart}부터):
- 신규성/진보성 방어용 "창의적·구체적 기술수단" 포함
- 수치·수식·기호 과다 기재 금지 (후속 단계에서 정량화)
- 아래 A~C 중 최소 2개 포함:
  A) 다단계 처리(2단계 이상): 전처리→산출→보정 등
  B) 조정 가능한 기준값/가중치/신뢰도/품질지표 사용
  C) 검증/보정/피드백/폴백/재시도 중 하나 이상의 루프 또는 조건부 분기
- 발명 내용에 근거가 있는 요소/처리/효과만으로 구성
`:''}
⛔ (R6) 장치/방법 구분 — 절대 준수
- 이것은 "장치" 청구항이다. "방법"이 아니다.
- "~하는 단계", "S100", "S200" 등 방법 표현 절대 금지
- "~부" 형태의 장치 구성요소 명칭만 사용 ("~모듈", "~유닛" 절대 금지)
- 동작은 "~하도록 구성되는", "~을 수행하는" 형태로 표현
- 발명 내용이 "방법" 형태로 기재되어 있더라도, 장치(~부) 관점으로 재구성하여 작성하라

${deviceAnchorDep>0?`[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}
`:''}[출력 형식]
【청구항 1】형식. 청구항만 출력. 테마/키워드/점검 내용 출력 금지.
종속항은 \"제N항에 있어서,\" 시작. SW명 금지. 제한성 표현 금지.
${getJepsonInstruction('device')}
★★★ 발명 내용의 모든 기술적 요소를 장치 구성요소(~부)로 변환하여 빠짐없이 반영하라. 방법/단계 표현은 장치 동작으로 재구성. ★★★

${T}${getFullInvention()}${styleRef}`;}

    // ═══ Step 7: 도면 설계 (도면 규칙 v4.0) ═══
    case 'step_07':{
      console.log('[buildPrompt step_07] outputs.step_06 length=',(outputs.step_06||'').length);
      const f=document.getElementById('optDeviceFigures')?.value||'4';
      const totalFig=parseInt(f)||4;
      const reqInst=getRequiredFiguresInstruction();
      const genCount=totalFig-requiredFigures.length;
      const figNums=computeFigNums(Math.max(genCount,0),0);
      const autoNums=figNums.device;
      return `【장치 청구범위】에 대한 도면을 설계하라.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 자동 생성할 도면: 정확히 ${genCount}개 (${autoNums.map(n=>'도 '+n).join(', ')})
- ★★★ 도면을 ${genCount}개보다 많이 생성하지 마라. ${genCount}개보다 적게 생성하지 마라. ★★★
${requiredFigures.length?`- 사용자 도면: ${requiredFigures.map(rf=>'도 '+rf.num+' ('+rf.description+')').join(', ')} — 이미 보유. 생성 금지.\n- 총 도면 수: ${totalFig}개 (자동 ${genCount}개 + 사용자 ${requiredFigures.length}개)`:`- 총 도면 수: ${totalFig}개`}

★★★ 청구항 구성요소 정합 규칙 (핵심) ★★★
- 도면에 사용하는 구성요소 명칭과 참조번호는 반드시 【장치 청구범위】와 일치해야 한다.
- 청구항에 "통신부(110)"가 있으면 도면에서도 "통신부(110)"으로 표기하라.
- 청구항에 없는 구성요소를 도면에 임의로 추가하지 마라.
- 단, 도 1의 L1 외부 장치(사용자 단말, 네트워크 등)는 청구항에 명시적으로 없더라도 시스템 구성상 필요하면 추가 가능.
- 도 2 이후의 내부 구성요소는 반드시 청구항에 기재된 것만 사용하라.

${_buildClaimComponentHierarchy(outputs.step_06||'')}

════════════════════════════════════════════════════════════════
★★★ 특허 도면 생성 규칙 v4.0 ★★★
════════════════════════════════════════════════════════════════

⛔⛔⛔ 절대 금지 사항 ⛔⛔⛔
- "~단계", "S100", "S200" 등 방법 표현 금지
- "~모듈" 표현 금지 → 반드시 "~부"로 통일 (예: 송신부, 수신부, 제어부)
- 이 도면은 오직 "장치의 구성요소"만 표현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R1] 도면부호 계층 체계 (레벨별 번호 단위 고정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ L1 (최상위 장치): X00 형식 — 100 단위
  ${getDeviceSubject()}(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400), 네트워크(500)

■ L2 (L1 하위 구성): XY0 형식 — 10 단위
  ${getDeviceSubject()}(100) 하위: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
  사용자 단말(200) 하위: 입력부(210), 출력부(220), 제어부(230)

■ L3 (L2 하위 요소): XYZ 형식 — 1 단위
  통신부(110) 하위: 송신부(111), 수신부(112), 암호화부(113)
  프로세서(120) 하위: 연산부(121), 캐시부(122)

■ 핵심 원칙
  - 부모 접두(prefix) 유지: 130의 하위는 131, 132...
  - 동일 도면세트 내 번호 중복 금지
  - 레벨 혼합 금지: L2에 111 같은 번호 사용 금지

⛔⛔⛔ 명칭 고유성 규칙 (기재불비 — 절대 위반 금지) ⛔⛔⛔
- 서로 다른 참조번호에는 반드시 서로 다른 명칭을 사용하라.
  <span class="ico" data-icon="x"></span> 금지: 서버(100)와 서버(300) — 같은 이름에 다른 번호
  <span class="ico" data-icon="check-circle"></span> 올바른: 통합 서버(100)와 벤더 서버(300) — 구별 가능한 이름
- 서로 같은 참조번호에는 반드시 동일한 명칭을 사용하라.
  <span class="ico" data-icon="x"></span> 금지: 도 1에서 "처리부(110)", 도 2에서 "분석부(110)"
  <span class="ico" data-icon="check-circle"></span> 올바른: 모든 도면에서 "처리부(110)"으로 통일
- L1 장치명은 발명 명칭에서 유래하거나, 역할이 명확히 구분되는 명칭을 사용하라.
  예: "기업용 인공지능 통합 서버(100)", "사용자 단말(200)", "벤더 서버(300)"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R2] 박스 소속(Ownership) 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 박스 = 해당 장치의 "구비/보유" 범위
  "A가 X를 구비한다" → X는 반드시 A 박스 내부에 배치

■ 소속 위반 금지
  ${getDeviceSubject()}(100)가 프로세서(110)를 구비 → 110은 100 박스 내부에만 존재
  110이 200 박스 안에 들어가면 오류

■ 공통 구성 표현
  ${getDeviceSubject()}와 단말 모두 프로세서 보유 시:
  - ${getDeviceSubject()} 프로세서: 프로세서(110)
  - 단말 프로세서: 프로세서(210)
  각자 자기 박스 내부에 배치 (번호 분리)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R3] 도면별 표현 레벨 ★핵심★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: 전체 시스템 구성도 (System Overview)
  <span class="ico" data-icon="check-circle"></span> 허용: L1 장치 박스만 — 100, 200, 300, 400...
  <span class="ico" data-icon="check-circle"></span> 허용: L1 장치 박스들 간의 연결선만
  ⛔ 금지: L2/L3 하위 구성요소(110, 120, 111...) 표시 금지
  ⛔ 금지: 최외곽 박스 생성 금지 (L1만 있으므로 외곽 불필요)
  ★ 최소 L1 구성요소: 2개 이상 (1개만 있으면 도 1 불필요)

■ 도 2 이후: 세부 블록도 (Detailed Block Diagram)
  ⛔⛔ 핵심: 한 도면에는 반드시 "한 레벨"만 표시 ⛔⛔
  최외곽 박스 = 상위 장치
  내부 박스 = 그 상위 장치의 직계 자식 레벨만
  단, 서브 프레임을 사용한 중첩은 허용:
  <span class="ico" data-icon="check-circle"></span> 허용: 100 프레임 → L2(110 서브프레임[111,112,113 내부] + 120 독립블록)
     → 110이 서브 프레임(점선)으로 그려지고 내부에 L3이 포함된 구조
  ⛔ 금지: 100 프레임 → 110 + 120 + 111 + 112 (서브 프레임 없이 L2·L3 혼합 나열)
  
  ⛔⛔⛔ 내부 구성요소 수량 규칙 (절대 준수) ⛔⛔⛔
  ★★ 최소: 3개 이상 (2개만으로는 도면이 빈약) ★★
  ★★ 최대: 5개 이하 (6개 이상이면 반드시 도면을 분할하라) ★★
  <span class="ico" data-icon="arrow-right"></span> 청구항에 하위 구성요소가 6개 이상이면, 핵심 3~5개만 골라 이 도면에 넣고 나머지는 다음 도면에서 다루라.
  <span class="ico" data-icon="arrow-right"></span> 청구항에 하위 구성요소가 2개뿐이면, 기능적으로 분리하여 3~4개로 확장하라.
  <span class="ico" data-icon="arrow-right"></span> 구성요소를 억지로 세분화하여 수를 늘리지 마라. 청구항에 명시된 핵심 구성만 사용하라.
  ⛔ 절대 금지: 하나의 도면에 6개 이상의 내부 블록을 배치하는 것

  ★★★ 동일 프레임 반복 최소화 규칙 ★★★
  - 동일 참조번호의 프레임이 2개 이상 도면에 반복되는 것은 최소화하라.
  - 하위 구성요소가 5개를 초과하여 분할하는 경우에만 허용한다.
  - 분할 시, 첫 도면에 5개(상한), 다음 도면에 나머지를 넣어라.
    <span class="ico" data-icon="x"></span> 잘못된 분할: 도 2에 4개 + 도 3에 3개 + 도 4에 1개 (3개 도면)
    <span class="ico" data-icon="check-circle"></span> 올바른 분할: 도 2에 5개 + 도 3에 3개 (2개 도면으로 충분)
  - 한 도면에 1~2개만 남으면, 이전 도면에 병합하여 도면 수를 줄여라.
    ⛔ 내부 구성요소 1개인 도면 = 절대 금지 (R12 위반)
  - 도면 수를 줄이는 것이 빈약한 도면을 만드는 것보다 낫다.

  <span class="ico" data-icon="check-circle"></span> 올바른 예 (도 2: ${getDeviceSubject()} 상세):
  최외곽=${getDeviceSubject()}(100), 내부=L2 4개: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
  → 4개 구성요소가 프레임 안에 2행 배치, 참조번호가 겹치지 않음
  
  ⛔ 잘못된 예 (내부 구성 2개만):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110), 메모리(120)
  → 2개만으로 도면이 빈약하고, 참조번호 100과 120이 겹칠 위험
  
  ⛔ 잘못된 예 (내부 구성 7개 — 과잉):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110)+메모리(120)+통신부(130)+저장부(140)+제어부(150)+분석부(160)+검증부(170)
  → 7개는 과잉! 연결선 교차, 도면 가독성 저하 → 핵심 4~5개만 선택하고 나머지는 다음 도면에서 다루라
  
  ⛔ 잘못된 예 (L2+L3 혼합):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110)+연산부(111)+캐시부(112)+메모리(120)
  → 110은 L2, 111/112는 L3 → 레벨 혼합 오류!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R4] 연결(연동) 및 배치 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: L1 박스 ↔ L1 박스 연결만
  ${getDeviceSubject()}(100) ↔ 사용자 단말(200) 연결선 허용
  하위 요소(110, 210) 간 연결선 금지

★★★ 도 1 연결관계 설계 규칙 (논리적 결합) ★★★
  - 단순히 모든 L1 박스를 일렬 연결하지 마라
  - 각 L1 구성요소의 역할과 기능을 분석하여 논리적 결합 관계를 결정하라
  - 예시 1 (중앙 허브형): 서버(100)가 중심이고 단말(200), DB(400)가 각각 서버에 연결 → 100↔200, 100↔400 (200↔400 직접 연결 없음)
  - 예시 2 (순차형): 클라이언트→서버→DB 순서 → 200→100→400
  - 예시 3 (메시형): 모든 구성요소가 상호 통신 → 100↔200, 100↔300, 200↔300
  - 연결의 근거: 청구항에서 어떤 구성요소가 어떤 구성요소와 데이터를 주고받는지 분석
  - 네트워크(300) 같은 매개체가 있으면 중간에 배치

■ 도 2+: 내부 구성요소 간 연결 — 반드시 포함
  ★ 모든 내부 구성요소에 최소 1개 이상 연결이 있어야 함
  ★ "허브" 구성요소(가장 많은 연결)를 반드시 식별
  예: 통신부(110) ↔ 프로세서(120) ↔ 메모리(130), 프로세서(120) ↔ 저장부(140)
  <span class="ico" data-icon="arrow-right"></span> 프로세서(120)가 허브 (3개 연결)

★★★ 배치 품질 규칙 (렌더링 겹침 방지) ★★★
  ⛔ 한 행에 3개 초과 금지 → 한 행에는 최대 3개까지 배치
  <span class="ico" data-icon="check-circle"></span> 도 2 이후 내부 블록도: 데이터 흐름 방향에 따라 입력측→처리→출력측 순서로 배치
  <span class="ico" data-icon="check-circle"></span> 흐름 방향이 명확하지 않으면 참조번호 오름차순으로 배치

⛔⛔⛔ 점진적 구체화 원칙 (한 단계씩만 깊어진다 — 절대 규칙) ⛔⛔⛔

  ■ 레벨 정의
    L1 = 100,200,300… (100의 자리, 끝 2자리가 00)
    L2 = 110,120,130… (10의 자리, 끝 1자리가 0)
    L3 = 111,112,121… (1의 자리)
    L4 = 1111,1112…   (4자리)

  ■ 도 1 → L1만 사용 (장치 간 관계)
  ■ 도 2 → 가장 핵심인 L1 장치를 선택 → 그 내부를 L2로만 상세화
    ⛔ 도 2에서 L3(111,112…)를 쓰면 "레벨 건너뛰기" 위반
  ■ 도 3 → 도 2에서 가장 중요한 L2를 선택 → 그 내부를 L3으로만 상세화
    ⛔ 도 3에서 L4(1111,1112…)를 쓰면 위반
  ■ 도 4+ → 다른 L1 장치의 L2 상세화 또는, 도 3에서 남은 L2 상세화

  ■ 위반 패턴 예시
    <span class="ico" data-icon="x"></span> 도 2 내부에 프로세서(120) + 정보수신부(121) + 알림산출부(122)
       → 120은 L2, 121/122는 L3 → 같은 도면에 L2+L3 혼재 → NG
    <span class="ico" data-icon="check-circle"></span> 도 2 내부에 프로세서(120) + 메모리(130) + 통신부(110)
       <span class="ico" data-icon="arrow-right"></span> 모두 L2 → OK
    <span class="ico" data-icon="check-circle"></span> 도 3 최외곽 프로세서(120) 내부에 정보수신부(121) + 알림산출부(122)
       <span class="ico" data-icon="arrow-right"></span> 모두 L3 → OK

  ■ 검증 공식: 한 도면 내부 참조번호의 "레벨"이 모두 동일해야 한다
    level(ref) = ref < 100 ? 'small' : ref%100===0 ? 'L1' : ref%10===0 ? 'L2' : ref<1000 ? 'L3' : 'L4'
    ⛔ 내부 노드 중 level이 2종류 이상이면 레벨 건너뛰기 위반

⛔⛔⛔ 참조번호 고유성 규칙 (절대 위반 금지) ⛔⛔⛔
  - 모든 참조번호는 전체 도면세트 내에서 고유해야 한다. 동일 번호 재사용 불가.
  - "외부", "외부 서버", "외부 장치", "네트워크" 등은 도 2 이후의 내부 블록도에 포함하지 마라.
  - 도 2 이후의 세부 블록도에는 해당 장치의 하위 구성요소(~부)만 배치한다.
  - 외부 연결 대상이 필요하면 도 1에서만 L1 레벨(200, 300)로 표현한다.

■ 연결선 의미
  실선: 통신/데이터 링크
  양방향 화살표: 상호 데이터 교환

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R5] 직계 부모 일치 규칙 (세대 점프 금지) ★★★핵심★★★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 최외곽 박스 = 내부 구성요소들의 "직계 부모(Immediate Parent)"
  ⛔ 조부모(Grandparent)로 건너뛰기 금지

■ 예시 (계층 구조)
  ${getDeviceSubject()}(100)
    └─ 프로세서(110)
         └─ 정보수신부(111), 알림산출부(112), 전송부(113)

■ 올바른 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: 프로세서(110) ✅ (직계 부모)

■ 잘못된 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: ${getDeviceSubject()}(100) ❌ (세대 점프 - 조부모)

■ 직계 부모 계산법
  - L3 구성요소(111,112,113) → 직계 부모 = L2(110)
  - L2 구성요소(110,120,130) → 직계 부모 = L1(100)
  - 공식: 마지막 자리를 0으로 변환

════════════════════════════════════════════════════════════════

[파트1: 도면 설계 출력 형식]

★★★ 반드시 아래 형식을 정확히 따르라. 공간배치를 반드시 명시하라 ★★★
★★★ 도면을 정확히 ${genCount}개만 설계하라: ${autoNums.map(n=>'도 '+n).join(', ')} ★★★
★★★ 구성요소 명칭과 참조번호는 【장치 청구범위】에서 그대로 가져와 사용하라 ★★★

각 도면의 출력 형식 (모든 도면에 동일 적용):

도 N: [도면 제목]
유형: 블록도 (도 1은 최외곽 박스 없음 / 도 2+는 최외곽 = 직계 부모)
구성요소: [해당 레벨 구성요소 나열 — 청구항에서 추출]
- [구성요소명(참조번호)]
- [구성요소명(참조번호)]
- ...
연결관계: [구성요소 간 데이터 흐름 분석]
공간배치:
  데이터흐름: [입력측 구성요소 → 처리 구성요소 → 출력측 구성요소]
  도 1은 허브중심배치, 도 2+는 흐름방향배치
  행1: [노드들]
  행2: [노드들]

★ 도면 설계 흐름 ★
① 도 ${autoNums[0]||1}: 전체 시스템 구성도 — L1 장치(X00)만 표시, 최외곽 박스 없음
${genCount>=2?`② 도 ${autoNums[1]||2}: ${getDeviceSubject()}(100) 상세 블록도 — 최외곽=${getDeviceSubject()}(100), 내부=청구항의 L2 구성요소(XY0)`:''}
${genCount>=3?`③ 도 ${autoNums[2]||3}: 핵심 L2 구성요소의 상세 블록도 — 최외곽=해당 L2, 내부=청구항의 L3 구성요소(XYZ)`:''}
${genCount>=4?`④ 도 ${autoNums[3]||4}: 추가 상세화 대상의 블록도 (다른 L2 상세 또는 L3 상세)`:''}
${genCount>=5?autoNums.slice(4).map((n,i)=>`⑤ 도 ${n}: 추가 상세화 블록도`).join('\n'):''}

★★★ 공간배치 규칙 ★★★
1. "허브" = 가장 많은 연결을 가진 노드 (반드시 1개 지정)
2. "행N" = 위에서 아래로 배치할 행 (같은 행에 2~3개까지 가능)
3. 허브는 연결 대상들 사이 행에 위치해야 함
4. 같은 행의 노드들은 서로 직접 연결이 없어야 함 (있으면 다른 행으로)
5. 연결된 노드는 인접 행에 배치 (2행 이상 떨어지지 않게)

★★★ 참조번호 순서 규칙 (도면 설계 + 상세설명 연계) ★★★
- 구성요소 나열 시 참조번호 오름차순으로 정렬하라: 110→120→130→140
- 도면 내 행 배치도 가능한 한 번호 순서를 존중하라 (작은 번호가 위쪽/왼쪽)
- 이 순서는 상세설명(Step 8)에서 "도 N을 참조하면" 설명 순서의 기준이 된다

[파트2: 도면의 간단한 설명]
★★★ 생성한 도면(${autoNums.map(n=>'도 '+n).join(', ')})과 사용자 도면 모두에 대해 빠짐없이 간단한 설명을 작성하라 ★★★
---BRIEF_DESCRIPTIONS---
${requiredFigures.map(rf=>`도 ${rf.num}${figParticle(rf.num)} ${rf.description}${josaEulReul(rf.description)} 나타내는 도면이다.`).join('\n')}
(각 도면에 대해 "도 N은 [대상]의 [내용]을 나타내는 블록도이다." 형식으로 작성)

⛔⛔⛔ 최종 점검 ⛔⛔⛔
- 도면 수가 정확히 ${genCount}개인가? (${autoNums.map(n=>'도 '+n).join(', ')})
- 모든 구성요소 명칭과 참조번호가 【장치 청구범위】와 일치하는가?
- 도 1은 L1(X00) 장치만 포함하는가?
- 도 2+의 내부 구성요소는 청구항에 있는 것만 사용했는가?
- ★★ 도 2+의 내부 구성요소가 5개를 초과하지 않는가? (6개 이상이면 분할!) ★★
- "~모듈" 대신 "~부"를 사용했는가?
- 최외곽 박스가 직계 부모인가? (세대 점프 없는가?)

★★★ "~모듈" 절대 금지 → "~부"로 통일 ★★★
★★★ 도 1은 L1(100,200,300,400) 장치만, 최외곽 박스 없음 ★★★
★★★ 도 2+: 최외곽 = 직계 부모 (세대 점프 금지!) ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[발명 요약] ${inv.slice(0,1500)}`;}

    case 'step_08':{
      const deviceFigCount=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자 이상',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 충분히 상세하게 설명하고 주요 구성요소마다 변형 실시예를 포함하라. 선택한 목표 분량에 미달하지 않도록 각 구성요소를 빠짐없이 기술하라.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        maximal:{charPerFig:'약 3,000자 이상',total:'약 22,000~25,000자',extra:'각 도면마다 구성요소의 기능·동작 원리·데이터 흐름·상호 연동·변형 실시예를 최대한 상세히 기술하라. 각 구성요소마다 예를 들어 형식의 실시예를 반드시 포함하고, 정량적 근거와 기술적 효과를 충분히 부연하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자 이상',total:null,extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 충분히 상세하게 설명하고 변형 실시예를 포함하라. 선택한 목표 분량에 미달하지 않도록 기술하라.'}
      }[detailLevel];
      
      // v10.3: 실제 도면 설계 텍스트에서 도면 번호 목록 추출
      const designText=outputs.step_07||'';
      const actualFigNums=_extractFigureNumbersFromDesign(designText);
      // ★ [B1] 장치 상세설명은 장치+사용자 도면만(예시도는 step_08c 가 별도 기술 — step_08 장치 전용 환원, 과부하 해소).
      const allFigNumsRaw=[...new Set([...actualFigNums,...requiredFigures.map(f=>f.num)])].sort((a,b)=>a-b);
      // ★ v10.5 fix: 실제 도면 데이터가 있으면 그대로 사용 (UI 값 변경으로 인한 도면 누락/초과 방지) ★
      // step_07 미생성 시에만 computeFigNums 폴백 사용
      const expectedTotalFig=deviceFigCount;
      const allFigNums=allFigNumsRaw.length>0?allFigNumsRaw:computeFigNums(Math.max(deviceFigCount-requiredFigures.length,0),0).device.concat(requiredFigures.map(f=>f.num)).sort((a,b)=>a-b).slice(0,expectedTotalFig);
      // v10.5: custom 모드 총 분량을 실제 도면 수 기준으로 산출
      if(!dlCfg.total)dlCfg.total='약 '+(customDetailChars*allFigNums.length)+'자';
      const lastDeviceFig=allFigNums.length>0?Math.max(...allFigNums):1;
      const figListStr=allFigNums.map(n=>'도 '+n).join(', ');
      
      // ★ 도면 설계에서 구성요소 목록 추출 (Step 8에 도면과 동일한 구성요소 사용 강제) ★
      const _designComponents=_extractStructuredComponents(designText);
      const _designCompStr=_designComponents.length>0?
        `\n★★★ 도면 구성요소 목록 (이 명칭과 참조번호만 사용하라) ★★★\n${_designComponents.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`:'';
      
      
      const hasMethodClaims=!!outputs.step_10;
      const _userFigBlock=getUserFiguresPromptBlock();
      return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】의 본문만 작성하라.

⛔ 이것은 "장치" 상세설명이다. 방법(~하는 단계, S100 등)은 포함하지 마라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.

★★★ 용어 통일 규칙 (기재불비 방지 — 핵심) ★★★
- 명세서 전체에서 동일 개념을 가리키는 용어는 반드시 하나의 기준 용어로 통일하라.
- 청구항에서 사용한 용어가 기준이다. 상세설명에서 다른 표현으로 바꾸지 마라.
  예: 청구항이 "사용자 단말"이면 본문에서 "단말", "디바이스", "장치"로 바꾸지 말고 "사용자 단말(200)" 유지.
- 유사 개념의 위계를 명확히 정리하라:
  → "~값", "~수준", "~지표", "~계수", "~파라미터"가 서로 다른 것인지, 같은 것의 다른 표현인지 명시하라.
  <span class="ico" data-icon="arrow-right"></span> 상위 개념과 하위 개념이 있으면 "A는 B를 포함하며" 또는 "B는 A의 일 유형으로서" 형태로 관계를 서술하라.
- ⛔ 같은 것을 다른 이름으로 부르는 것을 절대 금지: "음량 조절 값" = "목표 음량 수준" = "최종 음량"처럼 혼용하면 기재불비.

★★★ 파라미터/변수 명세 규칙 (실시 가능성 보강) ★★★
- 핵심 알고리즘에 사용되는 모든 파라미터에 대해 다음을 서술하라:
  (1) 정의: 무엇을 나타내는 값인가
  (2) 값 유형: 스칼라값인지, 벡터인지, 복수 특징값의 조합 결과인지
  (3) 값 범위: 예시적 범위 (예: 0~1 정규화값, 0~100 퍼센트 등)
  (4) 초기값: 시스템 최초 실행 시의 기본값 (예: 초기값 1.0)
  (5) 갱신 방식: 어떤 조건에서 어떻게 갱신되는가
  (6) 제한 조건: 상한/하한, 클램핑, 과도 변화 방지 조건
- 보정/학습 계수(alpha, beta 등)에는 반드시 부호 의미, 값 범위, 과도 누적 방지 조건을 포함하라.
- "기정의된"이라고만 쓰지 말고, 예시적 값 또는 값 범위를 반드시 한 번은 제시하라.

★★★ 서버-단말 인터페이스 규칙 (데이터 흐름 명시) ★★★
- 서버와 단말 간 데이터 교환이 있는 구성에서는, 다음 3단계 흐름을 명시적으로 기술하라:
  (1) 단말 → 서버: 어떤 데이터를 어떤 주기로 전송하는가
  (2) 서버 내부: 수신한 데이터를 어떻게 처리/산출하는가
  (3) 서버 → 단말: 산출 결과를 어떤 형태로 단말에 전달하고, 단말이 어떻게 적용하는가
- 통신 프로토콜, 데이터 포맷, 전송 주기 등을 1회 이상 구체적으로 서술하라.
- ${getDeviceSubject()}(100)를 주어로 사용. \"구성요소(참조번호)\" 형태 — 예: 통신부(110), 프로세서(120).
- 도면별 \"도 N을 참조하면,\" 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 등록 앵커 종속항(창의적·구체적 기술수단 포함)의 다단계 처리, 기준값/가중치 동작 원리, 검증/보정 루프를 구체적으로 설명하라.
- 각 핵심 구성요소에 대해 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔
- 이 발명의 장치 도면: ${figListStr} (총 ${allFigNums.length}개)
- 위 도면만 "도 N을 참조하면," 형태로 설명하라. 위 목록에 없는 도면 번호를 절대 참조하지 마라.
- 도 ${lastDeviceFig+1} 이후의 도면을 참조하거나 "도 ${lastDeviceFig+1}을 참조하면" 등의 표현을 절대 사용하지 마라.
- [장치 도면]에 기재된 구성요소 명칭과 참조번호를 그대로 사용하라. 임의 변경/추가 금지.
${!hasMethodClaims?`- 방법 청구항이 생성되지 않았으므로, 방법 도면(흐름도) 및 방법 설명이 존재하지 않는다.
- 방법 관련 내용(S+숫자, ~하는 단계, 흐름도 참조)을 절대 포함하지 마라.`:''}

★★★ 설명 순서 규칙 ★★★
- 도 1 → 도 2 → 도 3 → ... 순서로 진행하라 (도면 간 순서는 반드시 번호순).
- 각 도면 내에서는 데이터/정보 흐름 순서에 따라 설명하라:
  <span class="ico" data-icon="arrow-right"></span> 입력측 구성요소부터 시작하여 처리→출력 순서로 기술
  <span class="ico" data-icon="arrow-right"></span> 예) 통신부(110)에서 데이터를 수신하면, 프로세서(120)가 분석하고, 저장부(140)에 저장한다
- 흐름 방향이 불분명하면 참조번호 오름차순: 예) 110→120→130→140.
- 같은 L2 구성요소 내의 L3 하위 요소도 흐름순 또는 오름차순: 예) 121→122→123.

⛔⛔⛔ 방법 표현 절대 금지 (위반 시 전체 무효) ⛔⛔⛔
- \"~하는 단계\", \"~하는 단계이다\" 표현 절대 금지
- \"S100\", \"S200\", \"S401\", \"S810\" 등 S+숫자 형태의 단계번호 절대 금지
- \"단계(S숫자)\" 형태 절대 금지
- 방법/흐름도/순서도/프로세스 설명 포함 금지
- 발명 내용에 방법 관련 기재가 있더라도, 이 상세설명에서는 장치 구성요소(~부)의 기능과 동작만 서술하라
- 방법 상세설명은 Step 12에서 별도 작성됨 — 여기서 선취하지 마라

⛔ 출력 금지 항목:
- [청구범위], [작성 요청], [청구항 구성] 등 메타 섹션을 출력에 포함하지 마라
- 청구항 원문을 그대로 출력하지 마라 — 상세설명 본문만 작성하라
- ★ 발명의 설명 본문에 "청구항 N", "제N항", "청구항 3 및 청구항 5에 관련하여" 등 ★청구항 번호를 직접 언급하지 마라★ (명세서 부적절 표현). 청구항에 기재된 구성을 설명할 때는 청구항을 가리키지 말고, 그 구성요소(참조번호) 형태(예: 통신부(110), 프로세서(120))로 구체적으로 기술하라.
- 발명 내용 원문을 에코하지 마라

⛔⛔⛔ 수학식 포함 절대 금지 ⛔⛔⛔
- 【수학식 1】, 【수학식 2】 등 수학식 블록을 절대 포함하지 마라.
- 수식, 수학 공식, 변수 정의 등을 본문에 삽입하지 마라.
- 수학식은 별도 단계(Step 9)에서 선택적으로 삽입되므로, 이 단계에서는 알고리즘의 동작 원리를 자연어로만 설명하라.
- "수학식 N에 따르면", "상기 수식에 의해" 등 수학식을 참조하는 표현도 금지.

★★★ 도면 소개 규칙 (필수) ★★★
- 각 도면을 설명하기 전에, 먼저 해당 도면의 명칭을 한 문장으로 소개한 후, 바로 이어서 "도 N을 참조하면," 으로 시작하여 설명하라.
- 형식 예시:
  도 1은 [발명의 명칭]의 전체 구성을 나타내는 예시적 블록도이다. 도 1을 참조하면, ...
  도 2는 [구성요소]의 내부 구조를 나타내는 예시도이다. 도 2를 참조하면, ...
  도 3은 [구성요소]의 하드웨어 구조를 나타내는 예시도이다. 도 3을 참조하면, ...
- 이 도면 소개문은 이후 【도면의 간단한 설명】에서도 동일하게 사용되므로, 정확하고 일관되게 작성하라.
- "도 N" 뒤의 조사 "은/는"은 한국어 문법에 맞게 선택하라:
  받침 있는 숫자 뒤 → "은" (예: 도 1은, 도 3은, 도 6은, 도 7은, 도 8은, 도 10은)
  받침 없는 숫자 뒤 → "는" (예: 도 2는, 도 4는, 도 5는, 도 9는)

⛔⛔⛔ 분량 규칙 (앵커 뒷받침 우선) ⛔⛔⛔
- ★ 도면 1개당 ${dlCfg.charPerFig}(공백 포함) 이상을 최소 목표로 한다(상한이 아니라 하한). 앵커 종속항 뒷받침·정량적 근거 기술을 위해서는 이를 초과해도 무방하다.
- ★ 총 분량 ${dlCfg.total}(공백 포함) 이상을 목표로 하며, 목표에 현저히 미달하지 않도록 각 구성요소를 충분히 상세하게 기술하라(선택한 분량을 반드시 채울 것). 본문 전후 정형문 글자수 제외.
- ${dlCfg.extra}
- ⛔ 단, 불필요한 반복/나열·동어반복으로 분량을 늘리지 마라. 목표 분량은 각 구성요소의 기능·동작 원리·데이터 흐름·상호 연동·변형 실시예를 빠짐없이 기술하여 채우되(반복 없이 내용을 충분히), 억지로 늘리지 마라.

${deviceAnchorDep>0?`★★ 앵커 종속항 뒷받침 규칙 (등록 핵심 — 42조 4항) ★★
- 앵커 종속항(청구항 ${_deviceAnkStart()}~${_deviceAnkStart()+deviceAnchorDep-1})은 진보성 방어의 핵심이다. ★ 심사관이 별도 보정 없이 곧바로 등록을 인정할 수 있는 수준으로, 일반 종속항보다 2배 이상 상세하고 정량적 근거가 명확하게 기술하라.
- 각 앵커 종속항의 기술적 구성에 대해:
  (1) 동작 원리를 단계별(입력→처리→출력)로 설명하라
  (2) "이러한 구성에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) ★ 기준값/임계값/가중치/계수는 구체적 수치 예시 또는 수치 범위와 함께, 그 값을 어떻게 도출·설정하는지의 산출 근거(계산 과정·결정 원리)와 값 조정 시 거동 변화를 정량적으로 설명하라 (예: "일 예로 상기 가중치는 0.7로 설정되며, 이는 ~의 비율로부터 산출된다")
  (4) 다단계 처리가 있으면, 각 단계의 입력·처리·출력과 단계 간 정량적 관계(비율·임계·조건)를 명시하라
  (5) 조건 분기가 있으면, 각 분기의 판단 기준(구체적 조건식·임계값)과 분기 후 처리를 설명하라
  (6) ★ 위 정량적 근거는 발명 내용에 기재된 사실에 부합해야 한다. 명세서에 없는 수치를 임의로 창작하지 마라(신규사항·허위기재 금지). 발명 내용에 수치 근거가 없으면 "일 예로/대략" 등 예시임이 드러나는 표현으로 기술하라.
`:''}★ 변형 실시예 규칙:
- 독립항의 상위 개념 용어마다: "한편, 다른 실시예에서 상기 [용어]는 [구체적 대안]일 수 있다" 형태로 기술
- 앵커 종속항의 핵심 처리에 대해 1개 이상의 대안적 구현을 기술
- 변형 실시예는 독립항의 보호범위를 뒷받침하는 방향이어야 한다

★★★ 장치 도면(${figListStr})에 포함된 구성요소(참조번호 100~)를 빠짐없이 설명하라. 단, 장치 도면 설계에 정의되지 않은 참조번호를 임의로 창작하지 마라. (예시도(별도 부호 — 도 번호 기반)는 이 단계에서 다루지 않는다 — 별도 단계에서 기술됨.) ★★★
★★★ 참조번호 명칭 통일 규칙 (기재불비 방지 — 핵심) ★★★
- 하나의 참조번호에는 반드시 하나의 명칭만 사용하라. 동의어/약칭을 혼용하지 마라.
  <span class="ico" data-icon="arrow-right"></span> 예: "추천부(114)"와 "추천 생성부(114)"를 혼용하면 기재불비. 하나로 통일하라.
  <span class="ico" data-icon="arrow-right"></span> 예: "메모리(120)"와 "데이터베이스(120)"를 혼용하면 기재불비. 다른 구성요소이면 별도 참조번호를 부여하라.
- 도면 설계에서 정의된 명칭을 우선으로 사용하라.
- 청구항에서 사용한 명칭과 상세설명의 명칭이 일치해야 한다.
${_designCompStr}
${_userFigBlock?`\n${_userFigBlock}\n★ 사용자 도면도 "도 N을 참조하면," 형태로 도면 번호 순서에 맞게 설명을 포함하라.\n★ 사용자 도면의 설명은 발명 내용 및 청구범위와 정합되도록, 위 도면 설명을 기초로 기술적 의미를 보완하여 작성하라.`:''}

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[장치 도면 설계] ${outputs.step_07||''}${(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_08||0))?'\\n\\n[특허성 검토 결과 — 아래 지적사항을 상세설명에 반영하여 보완하라]\\n'+outputs.step_15.slice(0,2000):''}${getFullInvention({stripMeta:true,deviceOnly:true})}${styleRef}`;}

    // ═══ Step 8c: 예시도(개념도) 상세설명 — 장치(step_08)·방법(step_12)과 분리된 전용 단계(과부하 방지) ═══
    case 'step_08c':{
      const _cFig=getAutoFigNums('step_07c');
      const _concepts=conceptDiagramTypes.filter(ct=>ct.svgContent);
      // ★ [검증 반영·배치15F-4 정합] 빈 라벨(실명 없는) 예시도 부호는 프롬프트 참조번호 목록에서 제외 — 부호의 설명(step_18)이
      //   15F-4로 빈 라벨을 등재하지 않으므로, 본문에도 그 부호를 "이름(번호)"로 쓰게 하면 "본문 사용 but 부호표 미정의"(CHK-4)가 된다.
      const _cList=_concepts.map((ct,fi)=>{const fn=_cFig[fi]||'?';const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};const refs=(ct.refMap||[]).filter(r=>r.label&&String(r.label).trim()).map(r=>`${r.signNumber}(${r.label})`).join(', ')||'미정';return `도 ${fn}: ${td.label} (참조번호: ${refs})`;}).join('\n');
      const _figStr=_concepts.map((ct,fi)=>'도 '+(_cFig[fi]||'?')).join(', ');
      return `아래 예시도(개념도)에 대한 상세설명 본문만 작성하라. 이 본문은 명세서의 【발명을 실시하기 위한 구체적인 내용】에서 ★장치 상세설명 뒤, 방법 상세설명 앞★에 합쳐진다.

⛔ 이것은 "예시도(개념도)" 전용 상세설명이다. 장치 도면(도 1~)·방법(흐름도)을 새로 설명하지 마라 — 예시도(${_figStr}) ${_concepts.length}개만 기술한다.

★★★ 작성 규칙 ★★★
- 각 예시도를 "도 N을 참조하면, …" 형태로 시작하여 ${_concepts.length}개 모두 빠짐없이 기술하라(예시도 누락 금지).
- ★★ 예시도의 각 요소(예시도 부호 — 위 [예시도 설계]에 명시)가 [장치 도면 설계]의 어느 구성(100~, ★반드시 위 [장치 도면 설계]에 실제 정의된 구성요소 명칭·번호만 사용)에 의해 ★어떻게 동작·구현되는지★ 를 기술하라. 소프트웨어적 구성이 하드웨어(장치 구성)에 의해 구체적으로 동작·구현됨을 명확히 하여(§42 실시가능성 — 최상위 구성에 의해 동작되는 식으로), 외형(화면·장면) 나열이 아니라 ★실질적·예시적 시나리오(동작 흐름)★로 기술하라.
  ★ [배치15K] 일반 하드웨어 상용구(프로세서·메모리·통신부 등)에 번호를 붙이지 마라 — 번호는 [장치 도면 설계]의 구체 구성요소 명칭에만 부여한다(총칭어+번호는 dupassign 유발).
  예: "도 5를 참조하면, 검색창(51)은 [장치 도면 설계에 정의된 상위 구성요소(NN)]에 의해 표시 영역에 렌더링되고, 상기 구성요소가 수신한 데이터를 결과목록(52)으로 표시한다."
- ★ 장치 구성요소(100~)의 명칭·참조번호는 [장치 상세설명]·[장치 도면 설계]와 ★동일하게★ 사용하라(혼용 금지). 예시도 부호는 ★도 번호 기반★(도 N → N1,N2… / 요소 9개 초과·도10~ 는 N01,N02…)이며, 위 [예시도 설계]에 명시된 번호를 "이름(번호)" 형태로 ★그대로★ 기재하라(SVG·부호의 설명과 일치). 예시도 부호는 장치 부호(100~)와 구분된다.
- 특허문체(~한다). 글머리 기호·마크다운 금지. ★ 본문에 "청구항 N"·"제N항" 등 청구항 번호를 직접 언급하지 마라(구성요소(참조번호)로 기술).
- [장치 도면 설계]·[예시도 설계]에 정의되지 않은 참조번호를 임의로 창작하지 마라.

[예시도 설계 — 식별번호는 도 번호 기반(도 N → N0번대, 예: 도 5 → 51~)]
${_cList}
${(outputs.step_07c||'').slice(0,2000)}

${T}\n[장치 청구범위] ${(outputs.step_06||'').slice(0,1500)}\n[장치 도면 설계] ${(outputs.step_07||'').slice(0,2000)}\n[장치 상세설명 — 참고: 동일 명칭·참조번호 사용] ${(outputs.step08_device||getLatestDescription()||'').slice(0,3000)}${styleRef}`;
    }

    case 'step_09':return buildMathPrompt('5개 내외', stripMathBlocks(getLatestDescription()||outputs.step_08||''), (outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_09||0))?'\\n\\n[특허성 검토 결과 — 수학식으로 보완 가능한 지적사항을 반영하라]\\n'+outputs.step_15.slice(0,1500):'');

    // ═══ Step 10: 방법 청구항 (장치와 완전 분리) ═══
    case 'step_10':{
      const s=getLastClaimNumber(outputs.step_06||'')+1;
      const mAnchorStart=s+methodGeneralDep+1;
      const catLabel=methodCategory==='auto'?'발명에 가장 적합한 카테고리를 선택하라':methodCategory;
      const themeInst=buildAnchorThemeInstruction(methodAnchorThemeMode,selectedMethodAnchorThemes,methodAnchorDep);
      return `방법 청구항을 작성하라.

⛔ 이것은 "방법" 청구항이다. "장치"가 아니다.
- 모든 단계는 "~하는 단계"로 표현
- 장치 구성요소(통신부, 프로세서 등)가 아닌 "동작/처리 단계"로 기술

[핵심 규칙]
- 장치 청구항(제1 독립항 그룹)에서 가장 중요한 구성을 선별하여 방법 청구항으로 작성하라.
- 장치 청구항의 여러 종속항을 하나의 방법 단계로 병합할 수 있다.
- 방법 청구항의 개수는 장치 청구항과 다를 수 있다.

★★ 장치 청구항과의 차별화 규칙 ★★
- 장치 청구항의 "~부"를 단순히 "~하는 단계"로 치환하지 마라.
- 방법 청구항은 시간적 순서와 조건 분기를 명시하라: "~한 후", "~하는 경우", "~에 응답하여"
- 장치에 없는 전처리/후처리/판단 단계를 추가하여 방법만의 기술적 특징을 확보하라.
- 방법 독립항은 장치 독립항과 다른 관점(프로세스 관점)에서 발명을 기술하라.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: 1개 (【청구항 ${s}】)
- 일반 종속항: ${methodGeneralDep}개${methodGeneralDep>0?' (청구항 '+(s+1)+'~'+(s+methodGeneralDep)+')':''}
- 등록 앵커 종속항: ${methodAnchorDep}개${methodAnchorDep>0?' (청구항 '+mAnchorStart+'~'+(mAnchorStart+methodAnchorDep-1)+')':''}
- 종결어: ${getCategoryEnding(methodCategory==='auto'?'method':methodCategory)}
- \"~하는 단계\"를 포함하는 방법 형식

★★ 청구항 번호 규칙 (필수) ★★
- 장치 청구항의 마지막 번호가 ${s-1}이므로, 방법 독립항은 반드시 【청구항 ${s}】부터 시작
- 방법 종속항은 반드시 방법 독립항(청구항 ${s}) 또는 방법 종속항만 인용
- 장치 청구항(청구항 1~${s-1})을 인용해서는 안 됨

★★ 종속항 작성 규칙 (대통령령 — 위반 시 기재불비) ★★
① ★ 종속항은 반드시 \"단일 항\"만 인용하라 (예: \"제1항에 있어서\"). 기본은 독립항(제1항) 인용이며, 필수적으로 연계된 기능을 나누는 경우에만 직전 단일 종속항을 인용한다.
② ★★ 다중인용(2 이상의 항을 인용) 절대 금지 — \"제N항 또는 제M항에 있어서\", \"제N항 및 제M항에 있어서\", \"제N항 내지 제M항 중 어느 한 항에 있어서\" 등 2 이상 항을 인용하는 형태를 절대 생성하지 마라.
④ 종속항은 인용하는 독립항 또는 종속항보다 뒤에 기재 (번호 역전 금지)

[필수 작성 규칙] R1~R4 장치 청구항과 동일하게 적용.
${methodAnchorDep>0?`앵커 종속항은 (R5) 규칙 동일 적용: A~C 중 최소 2개 포함.

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}
`:''}[출력 형식] 【청구항 ${s}】부터. 청구항만 출력. 제한성 표현 금지.
${getJepsonInstruction('method')}
★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[장치 청구항 — 참고용] ${outputs.step_06||''}\n[장치 상세설명 — 참고용] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;}

    // ═══ Step 11: 방법 도면 (S+숫자 단계번호 체계) ═══
    case 'step_11':{
      const f=document.getElementById('optMethodFigures').value;
      const methCount=parseInt(f);
      // v10.0: 사용자 도면 스킵 반영한 방법 도면 번호 계산
      const devAutoCount=Math.max((parseInt(document.getElementById('optDeviceFigures')?.value||4))-requiredFigures.length,0);
      const _mfn=computeFigNums(devAutoCount,methCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
      const lf=_mfn.lastDeviceFig||getLastFigureNumber(outputs.step_07||'');
      const methAutoNums=_mfn.method;
      const firstMeth=methAutoNums[0]||(lf+1);
      return `【방법 청구범위】에 대한 흐름도를 설계하라.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 생성할 흐름도: 정확히 ${f}개 (${methAutoNums.map(n=>'도 '+n).join(', ')})
- ★★★ 흐름도를 ${f}개보다 많이 생성하지 마라. ${f}개보다 적게 생성하지 마라. ★★★
${requiredFigures.length?`- 사용자 도면(${requiredFigures.map(rf=>'도 '+rf.num).join(', ')})은 이미 사용 중. 건너뛰라.`:''}

★★★ 방법 청구항 정합 규칙 ★★★
- 흐름도의 단계명과 S번호는 반드시 【방법 청구범위】와 일치해야 한다.
- 청구항에 없는 단계를 임의로 추가하지 마라.

⛔⛔⛔ 절대 금지 사항 (위반 시 도면 전체 무효) ⛔⛔⛔
- 장치 구성요소(통신부, 프로세서, ~부 등) 포함 금지
- 숫자만 있는 참조번호(100, 110, 200 등) 사용 금지
- 이 도면은 오직 "방법의 단계"만 표현한다

★★★ 흐름도 필수 규칙 ★★★
① 최외곽 박스 없음 — 흐름도는 장치가 아니므로 감싸는 프레임 박스 불필요
② 단방향 화살표(→)만 사용 — 순서의 흐름을 나타내므로 양방향(↔) 금지
③ "시작"과 "종료" 노드 필수 포함 — 첫 단계 전에 "시작", 마지막 단계 후에 "종료"
④ 조건 분기가 있으면 다이아몬드(마름모) 노드 사용

★★★ 조건 분기(Decision) 규칙 — 핵심 ★★★
⑤ 방법 청구항에서 논리적 판단을 요구하는 단계를 식별하라:
  - 임계값 비교 (예: "스코어가 임계값 이상인 경우")
  - 조건 충족 판단 (예: "유효성 검증 결과가 적합한 경우")
  - 분류/분기 (예: "카테고리가 A인 경우와 B인 경우")
⑥ 조건 분기 단계는 마름모(다이아몬드) 형태로 표시
  - 노드 형식: D{조건 질문?} (예: D{"타겟팅 스코어가 임계값 이상인가?"})
  - "예(Y)" 방향과 "아니오(N)" 방향으로 분기
  - 각 분기 후 적절한 후속 단계로 연결
⑦ 분기 논리 검증 단계:
  - 각 분기가 논리적으로 타당한지 자체 검증하라
  - "예" 경로와 "아니오" 경로가 모두 최종적으로 종료 노드에 도달하는지 확인
  - 무한 루프가 발생하지 않는지 확인
  - 분기 조건이 방법 청구항의 기재와 일치하는지 확인

[방법 단계번호 체계 — 필수 준수]

■ 단계번호 형식: S + 숫자
- 도면 번호 기반: S${firstMeth}01, S${firstMeth}02, S${firstMeth}03...
- 예시 (도 ${firstMeth}): S${firstMeth}01(첫 번째 단계), S${firstMeth}02(두 번째 단계)...

■ 단계명 형식
- 반드시 "~단계" 또는 "~하는 단계"로 끝나야 함
- 예: "데이터 수신 단계(S${firstMeth}01)", "패턴 분석 단계(S${firstMeth}02)"

■ 핵심 규칙
- 각 단계명에 단계번호를 반드시 포함: "사용자 인증 단계(S${firstMeth}01)"
- 장치 도면(Step 7)의 구성요소는 참조하되, 도면에 직접 포함하지 마라
- 방법 청구항의 모든 단계를 빠짐없이 반영

[파트1: 도면 설계]
각 도면별로 아래 형식 출력:
---
도 ${firstMeth}: (방법 이름) 흐름도
유형: 순서도 (최외곽 박스 없음)
단계 목록:
- 시작
- (단계명)(S${firstMeth}01)
- (단계명)(S${firstMeth}02)
- [판단] (조건 질문?)(S${firstMeth}03) → 예: (다음 단계), 아니오: (대안 단계)
- ...
- 종료
흐름: 시작 → S${firstMeth}01 → S${firstMeth}02 → S${firstMeth}03{판단} →(예) S${firstMeth}04, (아니오) S${firstMeth}05 → ... → 종료 (단방향)
---

[분기 논리 검증]
각 분기에 대해 다음을 확인하고 출력:
- 분기 조건: (조건 설명)
- "예" 경로: (어떤 단계로 진행)
- "아니오" 경로: (어떤 단계로 진행)
- 논리적 타당성: (방법 청구항과 일치하는지, 무한 루프 없는지 확인)

[파트2: 도면의 간단한 설명]
★★★ 모든 방법 도면에 대해 빠짐없이 간단한 설명을 작성하라 ★★★
---BRIEF_DESCRIPTIONS---
도 ${firstMeth}은 ${selectedTitle||'본 발명'}의 (방법 이름)을 나타내는 순서도이다.
(방법 도면이 여러 개이면 모두 작성)

★★★ 방법 청구항의 모든 단계를 빠짐없이 흐름도에 반영하라 ★★★
★★★ 최외곽 프레임 박스 절대 금지 — 흐름도는 프레임 없이 단계만 나열 ★★★
★★★ 장치 구성요소(100, 110 등)는 절대 포함 금지 — S로 시작하는 단계번호만 사용 ★★★

${T}\n[방법 청구범위] ${outputs.step_10||''}\n[발명 요약] ${inv.slice(0,1500)}`;}

    case 'step_12':{
      // ═══ B1 fix: 분량 제어 추가 (v5.5) ═══
      const dl=detailLevel;
      const methodDetailGuide=dl==='compact'?'약 800자(공백 포함) 이내로 핵심만 간결하게':dl==='standard'?'약 1,200자(공백 포함) 이상을 목표로 균형 있게 (선택 분량을 채울 것)':dl==='detailed'?'약 2,000자(공백 포함) 이상으로 상세하게':dl==='maximal'?'약 8,000자(공백 포함) 이상으로 각 단계의 처리 내용·데이터 흐름·변형 실시예를 최대한 상세히 기술하되 절대 축약하지 말고':dl==='custom'?`약 ${Math.round((customDetailChars||1200)*0.7)}자(공백 포함) 이상을 목표로`:'약 1,200자(공백 포함) 내외로';
      // ═══ B3 fix: step_15 순환참조 — 타임스탬프 비교 (v5.5 BUG-4 수정) ═══
      const step15Ref=(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_12||0))?`\n\n[특허성 검토 결과 — 아래 지적사항을 방법 상세설명에 반영하여 보완하라]\n${outputs.step_15.slice(0,2000)}`:'';
      return `방법 상세설명. 단계순서에 따라 장치 동작을 참조하여 설명하라. 특허문체. 글머리 금지. 시작: "이하에서는 앞서 설명한 ${getDeviceSubject()}의 구성 및 동작을 참조하여 ${getDeviceSubject()}에 의해 수행되는 방법을 설명한다." 생략 금지. 제한성 표현 금지.

★ 분량 지침: ${methodDetailGuide} 작성하라. (단, 앵커 종속항 뒷받침·정량적 근거 기술을 위해서는 위 분량 기준을 적정 범위 초과해도 무방하다. 초과분은 앵커 뒷받침에만 사용하고, 일반 설명은 기준을 준수하라.)
★ 방법의 수행 주체: "${getDeviceSubject()}"로 일관되게 서술하라.

${methodAnchorDep>0?`★★ 방법 앵커 종속항 뒷받침 규칙 (등록 핵심) ★★
- 방법 앵커 종속항은 등록 핵심이다. ★ 심사관이 별도 보정 없이 곧바로 등록을 인정할 수 있는 수준으로, 일반 종속항보다 2배 이상 상세하고 정량적 근거가 명확하게 기술하라.
- 방법 앵커 종속항의 각 기술적 구성(다단계 처리, 조건 분기, 기준값 등)을:
  (1) 단계별 처리 흐름으로 설명하라
  (2) "이러한 단계에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) 조건 분기의 판단 기준(구체적 조건식·임계값)과 각 분기의 후속 처리를 명시하라
  (4) ★ 기준값/임계값/가중치/계수는 구체적 수치 예시 또는 범위와 그 산출·설정 근거를 정량적으로 설명하라. 단, 발명 내용에 없는 수치를 임의로 창작하지 마라(신규사항 금지) — 근거가 없으면 "일 예로" 등 예시임이 드러나게 기술하라.
`:''}
★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[방법 청구항] ${outputs.step_10||''}\n[방법 도면] ${outputs.step_11||''}\n[장치 상세설명] ${(outputs.step_08||'').slice(0,3000)}${step15Ref}${getFullInvention({stripMeta:true})}${styleRef}`;}
    case 'unified_cohesion':{
      // ★ 단일 풀컨텍스트 생성 — 장치 상세설명 + 방법 상세설명 + 부호 SSOT 를 한 번에 생성해 도면부호·용어 정합을 구조적으로 보장.
      //   부호의 설명(step_18)은 LLM이 직접 쓰지 않고 코드가 REFTABLE+본문 사용부호로 결정적으로 직렬화한다.
      const deviceSubject=getDeviceSubject();
      const _uDevFig=[...new Set([..._extractFigureNumbersFromDesign(outputs.step_07||''),...requiredFigures.map(f=>f.num)])].sort((a,b)=>a-b);
      const _uMethFig=_extractFigureNumbersFromDesign(outputs.step_11||'').sort((a,b)=>a-b);
      const deviceFigList=_uDevFig.length?_uDevFig.map(n=>'도 '+n).join(', '):'(장치 도면 없음)';
      const methodFigList=_uMethFig.length?_uMethFig.map(n=>'도 '+n).join(', '):'(방법 도면 없음)';
      // ★ [배치6 N3c] 분량을 단계별(step_08)과 동일한 dlCfg로 소비 — 도면당 하한 + 총 하한 + extra(#235 하한 프레이밍).
      //   (docC 실측: 통합 상세설명 16.8k = 단계별 대비 -30% — 총량 프리셋만으로는 하한이 약해 도면당 하한을 병기.)
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자 이상',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 충분히 상세하게 설명하고 주요 구성요소마다 변형 실시예를 포함하라. 선택한 목표 분량에 미달하지 않도록 각 구성요소를 빠짐없이 기술하라.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        maximal:{charPerFig:'약 3,000자 이상',total:'약 22,000~25,000자',extra:'각 도면마다 구성요소의 기능·동작 원리·데이터 흐름·상호 연동·변형 실시예를 최대한 상세히 기술하라. 각 구성요소마다 예를 들어 형식의 실시예를 반드시 포함하고, 정량적 근거와 기술적 효과를 충분히 부연하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자 이상',total:null,extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 충분히 상세하게 설명하고 변형 실시예를 포함하라. 선택한 목표 분량에 미달하지 않도록 기술하라.'}
      }[detailLevel]||{charPerFig:'약 1,500자 이상',total:'약 5,000~7,000자',extra:'각 구성요소를 충분히 상세하게 기술하라.'};
      if(!dlCfg.total)dlCfg.total='약 '+(customDetailChars*Math.max(_uDevFig.length,1))+'자';
      const methodLengthPreset=detailLevel==='compact'?'약 800자':detailLevel==='detailed'?'약 2,000자 이상':detailLevel==='maximal'?'약 8,000자 이상':detailLevel==='custom'?('약 '+Math.round((customDetailChars||1200)*0.7)+'자'):'약 1,200자 이상';
      const anchorGuide=deviceAnchorDep>0?('청구항 '+_deviceAnkStart()+'~'+(_deviceAnkStart()+deviceAnchorDep-1)):'(앵커 없음)';
      const designComponents=(_extractStructuredComponents(outputs.step_07||'')||[]).map(c=>c.name+'('+c.refNum+')').join(', ')||'(도면 구성요소 목록 없음)';
      const deviceClaims=outputs.step_06||'';
      // ★ [배치15H-2] 방법 OFF면 METHOD_DESC 블록 자체를 요구하지 않는다(방법 청구항이 없으면 방법 상세설명·방법 부호도 없어야).
      //   step_10이 구세대로 남아 있어도 includeMethodClaims=false면 방법 없음으로 처리(방법 S부호 게이트 미발동으로 이어짐).
      const _wantMethod=(typeof includeMethodClaims==='undefined')?false:!!includeMethodClaims;
      const methodClaims=(_wantMethod&&outputs.step_10)?outputs.step_10:'(방법 청구항 없음 — <<<METHOD_DESC>>> 블록도 생략하라)';
      // ★ [배치9 D1] 수학식 토글 = 인라인 파라미터 — on이면 C9가 금지 대신 "인라인 수식 계약"으로 전환(CHK-8·math_ref 규칙 선반영).
      const _mathOn=(typeof _mathModeActive==='function')?_mathModeActive():!!(typeof document!=='undefined'&&document.getElementById('chkUnifiedMath')?.checked);   // ★ [배치16.1-2] 토글 OR 본문 수식 존재(재작성 시 수식 계약 유지)
      const _mathN=Math.max(1,Math.min(5,parseInt(mathBlockCount)||3));   // [배치15B-1b] 수학식 개수 계약
      const deviceFigDesign=outputs.step_07||'';
      const methodFigDesign=(_wantMethod&&outputs.step_11)?outputs.step_11:'(방법 도면 없음)';   // [배치15H-2] 방법 OFF → 방법 도면 참조 제외
      // ★ [배치16-1] 기계검증 결함 주입 — _pendingFixTargets(구조화된 지시문) 있으면 FIX_TARGETS 블록으로 주입("반드시 모두 해소, 나머지 유지").
      //   이것이 있어야 "재생성=결함 해소"가 사실이 된다(종전엔 검증 결과가 프롬프트에 전혀 주입되지 않아 재생성해도 기계검증 0 불가).
      const _fixTargets=(typeof _pendingFixTargets!=='undefined'&&_pendingFixTargets)?String(_pendingFixTargets).slice(0,10000):'';
      const _fixInject=_fixTargets?('\n\n★★★ [기계검증 결함 반영(배치16) — 최우선] 아래 <<<FIX_TARGETS>>>의 각 항목을 이번 재작성에서 반드시 모두 해소하라. 나머지 내용·구조·용어·참조번호는 그대로 유지한다(지적과 무관한 부분의 재설계 금지).\n<<<FIX_TARGETS>>>\n'+_fixTargets+'\n<<<END_FIX_TARGETS>>>'):'';
      // ★ [배치15L-2] AI 진단(step_13) 지적 반영 재작성 — _pendingReviewNotes 있으면 REVIEW_NOTES 블록으로 주입("지적 해소, 나머지 유지").
      const _reviewNotes=(typeof _pendingReviewNotes!=='undefined'&&_pendingReviewNotes)?String(_pendingReviewNotes).slice(0,8000):'';
      const _reviewInject=_reviewNotes?('\n\n★★★ [검토 반영 지시(배치15L) — 최우선] 아래 <<<REVIEW_NOTES>>> 의 지적사항을 이번 재작성에서 반드시 해소하라. 단, 지적과 무관한 나머지 구조·용어·참조번호는 그대로 유지한다(전면 재설계 금지 — 지적 해소에 필요한 최소 수정).\n<<<REVIEW_NOTES>>>\n'+_reviewNotes+'\n<<<END_REVIEW_NOTES>>>'):'';
      // ★ [배치17-2] 확정 부호표(refPlan) 주입 — 부호 사전은 코드가 청구항에서 확정한다. LLM 은 아래 표를 "고정 입력"으로 받아
      //   REFTABLE 에 그대로 옮기고 본문은 이 번호만 쓴다(새 번호·다른 명칭·동일구성 이중번호 금지). 부호 결함군 원천 차단의 핵심.
      const _refPlanBlk=(typeof refPlan!=='undefined'&&refPlan&&refPlan.length&&typeof _buildRefPlanBlock==='function')?_buildRefPlanBlock(refPlan):'';
      const _refPlanDirective=_refPlanBlk?('\n\n★★★ [확정 부호표 — 코드가 청구항에서 확정함. 절대 기준] ★★★\n아래 [확정 부호표]의 명칭·번호 쌍만 도면부호로 사용하라. ⛔ 새 번호를 만들거나, 같은 구성에 다른 번호를 붙이거나, 표의 명칭과 다르게(예: 하드웨어 상용어로) 지칭하지 마라. <<<REFTABLE>>> 블록에는 아래 표를 그대로 옮겨 적고, 본문의 모든 (NN)은 아래 표의 번호만 사용한다.\n[확정 부호표]\n'+_refPlanBlk+'\n'):'';
      return `아래 발명에 대해 【발명을 실시하기 위한 구체적인 내용】의 (가) 장치 상세설명과 (나) 방법 상세설명을, 그리고 이들이 사용할 도면부호 사전을 한 번에 작성하라. 세 산출물의 도면부호가 서로·부호의 설명과 완전히 정합해야 한다.

■ 출력 계약 — 한 글자도 어기지 마라 (위반 시 출력 전체 폐기)
[C1] 출력은 아래 블록만으로 구성한다. 각 블록은 지정된 센티넬 마커 쌍으로 감싼다. 마커는 각각 독립된 줄에 두고, 마커 앞뒤에 설명·인사말·코드펜스·마크다운을 붙이지 마라. 블록 바깥에 어떤 텍스트도 출력하지 마라.

<<<REFTABLE>>>
(여기에 도면부호 사전)
<<<END_REFTABLE>>>
<<<DEVICE_DESC>>>
(여기에 장치 상세설명 본문)
<<<END_DEVICE_DESC>>>
<<<METHOD_DESC>>>
(여기에 방법 상세설명 본문 — 방법 청구항이 없으면 이 블록 생략)
<<<END_METHOD_DESC>>>
<<<TASK>>>
(여기에 해결하고자 하는 과제 — 청구항 역설계, 순수 서술문, 메타 표현 금지)
<<<END_TASK>>>
<<<SOLUTION>>>
(여기에 과제의 해결 수단)
<<<END_SOLUTION>>>
<<<EFFECTS>>>
(여기에 발명의 효과)
<<<END_EFFECTS>>>
<<<ABSTRACT>>>
(여기에 요약서)
<<<END_ABSTRACT>>>

[C2] ⛔ 본문(DEVICE_DESC·METHOD_DESC) 안에서 <<< 또는 >>> 문자열을 절대 쓰지 마라(블록 경계 오분할 방지). 각 마커는 반드시 줄 맨 앞에서 시작한다.
  ⛔ 마커 문자열(<<<REFTABLE>>>·<<<DEVICE_DESC>>>·<<<METHOD_DESC>>>·<<<END_…>>>)은 구획 경계로만 쓰고, 본문 문장 안에 절대 포함하지 마라. 각 마커는 전체 출력에서 정확히 1회씩만 등장한다(본문 중간 재등장 금지 — 발견 시 그 문장은 폐기된다).${_refPlanDirective}

[C3] 【도면부호 단일 진실원천(SSOT) — 최우선】 ${_refPlanBlk?'위 [확정 부호표]가 유일한 부호 사전이다. REFTABLE 블록에 그 표를 그대로 옮겨 적고, 본문은 그 번호만 사용한다(표에 없는 새 부호를 만들지 마라).':'먼저 REFTABLE 블록에 이 명세서가 사용할 모든 도면부호를 아래 형식으로 확정하라. 이 표가 유일한 부호 사전이며, 본문은 이 표에 있는 부호만 사용한다.'}
  형식(한 줄=한 부호, 번호 오름차순):
  [장치부호]
  (100) 명칭
  (110) 명칭
  [방법단계]
  (S410) 명칭
  - 번호는 반드시 소괄호로 감싸고(장치=2~4자리 숫자, 방법=S+숫자), 그 뒤 공백 한 칸 후 명칭.
  - 부호·명칭은 아래 [장치 도면]·[방법 도면]에 이미 부여된 부호를 그대로 옮겨라. 도면에 없는 새 번호 창작 금지.
  - ★ [신규 구성 번호 규칙] 부득이 REFTABLE에 없는 새 구성요소를 도입할 경우, 기존 번호를 절대 재사용하지 말고 어느 곳에도 쓰이지 않은 미사용 새 번호를 부여하며, 그 부호를 REFTABLE에도 반드시 추가하라(표에 없는 부호를 본문에만 쓰는 것 금지 — 한 번호가 두 구성요소를 가리키면 그 출력은 폐기된다).
  - 명칭은 청구범위 구성요소 용어 기준으로 통일. 한 번호=하나의 명칭(동의어·약칭 금지), 번호 중복 금지.
  - 방법청구항이 없으면 [방법단계] 구획 자체를 생략하라.
  ※ 【부호의 설명】은 네가 쓰지 않는다 — 시스템이 이 표에서 자동 생성한다. 표를 정확·완전하게 채우는 데만 집중하라.

[C4] 【1:1 정합 강제】 본문에 등장하는 모든 괄호숫자 (NN)은 REFTABLE에 정의된 것이어야 하고, REFTABLE의 모든 장치부호는 본문에 최소 1회 실제 사용되어야 한다. 본문에서 소괄호는 오직 도면부호 표기에만 쓰고 부연·예시·열거 용도로 쓰지 마라. 구성요소는 항상 "명칭(NN)" 형태로 최초 등장시키고, 청구항 번호("제N항"·"청구항 N")를 직접 언급하지 마라 — 구성요소(참조번호)로만 기술하라.

[C5] 【용어 통일 — 기재불비 방지】 동일 개념은 청구항 용어를 기준으로 REFTABLE·장치본문·방법본문 세 곳에서 문자 그대로 동일 명칭으로만 지칭하라(조사·띄어쓰기 외 표기 변형 금지). ★ **하나의 참조번호=하나의 명칭, 그리고 하나의 명칭=하나의 참조번호**(양방향 1:1). 동일한 구성 명칭(예: "…구조화부")에 서로 다른 부호를 두 개 이상 배정하지 마라 — 같은 구성은 처음 부여한 단일 부호로만 일관되게 지칭하고, REFTABLE에도 그 명칭을 한 번만(단일 번호로) 등재하라.

[C5b] ★★★ 【일반 하드웨어 상용구 참조번호 금지 — dupassign 주범 차단(배치15K)】 "프로세서·메모리·통신부·저장부·제어부·관리부·입력부·출력부·인터페이스·버스·서버·데이터베이스·CPU·RAM·ROM·GPU·모듈" 같은 **일반 하드웨어 상용구 명칭에 참조번호(NN)를 붙이지 마라.** 이런 총칭어는 서로 다른 위치·문맥에서 여러 번호로 반복 배정되어 "하나의 명칭에 복수 부호"(dupassign) 결함을 유발한다.
  - 참조번호는 오직 **청구항에 등장하는 구체적 발명 구성요소 명칭**(예: "대사 보존형 서사 구조화부", "멀티모달 제작자원 라우팅부")에만 부여한다.
  - 일반 하드웨어를 언급할 필요가 있으면 **참조번호 없이** 서술하라(예: "상기 각 구성부는 프로세서에 의해 실행되는 소프트웨어 모듈로 구현될 수 있다" — 여기서 '프로세서'에 (NN)를 붙이지 않는다).
  - 구체적 발명 구성요소가 우연히 위 총칭어와 같은 이름이면(예: 청구항에 실제 "통신부"가 있으면) 그 하나의 번호로만 일관되게 쓰되, 다른 총칭 문맥에서 같은 이름을 다른 번호로 재사용하지 마라.

[C6] 【문체 극성 분리 — 위반 시 무효】
  - DEVICE_DESC: 특허문체 "~한다" 서술만. "~하는 단계", "S100" 등 단계번호, 흐름도/순서도 표현 절대 금지. ${deviceSubject}를 주어로, 각 도면을 "도 N을 참조하면," 형태로 시작하여 구성요소의 기능·동작·데이터 흐름을 기술하라.
  - METHOD_DESC: 반대로 "~하는 단계"와 단계식별자 S### 로만 서술하라. 시작문: "이하에서는 앞서 설명한 ${deviceSubject}의 구성 및 동작을 참조하여 ${deviceSubject}에 의해 수행되는 방법을 설명한다."
  - 장치부호(100~)와 방법단계(S###)가 서로의 본문에 섞이지 않게 하라.

[C7] 【중복 금지 — 결정론 검증 대상】 40자 이상 문단/문장을 두 본문 간 또는 본문 내에서 그대로 복사하지 마라. 방법 본문이 장치 동작을 재언급할 때는 문장을 복제하지 말고 "앞서 설명한 …를 참조하여" 형태로 대체하라. 분량은 반복이 아니라 각 구성요소·단계의 기능·동작 원리·데이터 흐름·상호 연동·변형 실시예를 빠짐없이 기술하여 채워라.

[C8] 【도면 범위 제한】 도면 참조는 "도 N을 참조하면," 형태로만 하고, 아래 목록에 없는 도면 번호를 절대 참조하지 마라.
  - 장치 도면: ${deviceFigList}
  - 방법 도면: ${methodFigList}
  예시도/개념도는 이 단계에서 다루지 않는다 — 예시도 부호를 REFTABLE·본문에 넣지 마라.

${_mathOn?`[C9] 【수학식 인라인 — 정확히 ${_mathN}개의 【수학식】 블록】 상세설명 내 알고리즘 핵심 위치에 **정확히 ${_mathN}개**의 【수학식 N】 블록(N=1부터 등장 순서, 마지막은 ${_mathN})과 각 블록 직후 "여기서, …" 정의 절을 포함하라 — ${_mathN}개보다 많거나 적게 생성하지 마라(개수 계약 엄수).
★ 변수 자기검증(R3) — 기재불비 방지 핵심: 각 수식의 **좌변·우변에 등장하는 모든 기호**를 "여기서" 절에서 빠짐없이 정의하라. 대상은 **모든 변수·계수·상수·아래첨자·위첨자, 그리스문자(α, β, γ, θ, λ, μ, σ, Σ 등)와 합·곱 기호(Σ, ∏)의 인덱스(i, n 등)·범위, 함수형 표기(rank(·), softmax, argmax 등)의 인자**를 포함한다(하나라도 정의 누락 금지). 개별 또는 그룹("a, b, c는 …")으로 정의하되, 각 정의는 상세설명에 이미 등장한 파라미터·구성을 구체화해야 하며 본문에 없는 새 개념을 수식으로 도입하지 마라. 같은 변수가 복수 수식에 등장하면 정의·범위가 모순되지 않게 하라. 출력 직전 스스로 "이 수식의 좌·우변 모든 기호가 여기서 절에 정의되었는가"를 수식마다 점검하라.
본문에서 이미 나온 수식을 참조할 때는 "상기 수학식 N", 수식이 바로 뒤따르는 위치에서만 "다음의 수학식 N"을 쓰라(존재하지 않는 번호 참조 금지, 수식의 변수 설명에서 다른 수학식 번호를 인용하는 교차참조 금지).`:`[C9] 【수학식 금지】 【수학식 N】 블록·수식·"수학식 N에 따르면" 참조를 본문에 삽입하지 마라(별도 단계 소관). 알고리즘은 자연어로만 설명하라.`}

[C10] 【파라미터 명세 — 실시가능성】 핵심 알고리즘의 모든 파라미터에 대해 (1)정의 (2)값 유형 (3)값 범위(예: 0~1) (4)초기값(예: 초기값 1.0) (5)갱신 방식 (6)제한조건(상/하한·클램핑)을 서술하라. 보정/학습 계수(alpha, beta 등)에는 부호 의미·값 범위·과도 누적 방지 조건을 포함하라. "기정의된"만 쓰지 말고 예시적 값 또는 범위를 반드시 한 번은 제시하라.

[C11] 【분량·앵커 뒷받침】
  - ★★★ [1차 제약 — 총량 우선(배치15K)] 장치 상세설명 **총 분량 ${dlCfg.total}(공백 포함) 이상**이 최우선 목표다. 도면당 하한(아래)은 최소 기준일 뿐이며, 도면당 하한만 채우고 총량에 미달하는 것을 절대 허용하지 않는다. 총량에 도달할 때까지 각 도면 설명을 계속 확장하라(구성요소별 동작 원리·데이터 흐름·정량적 근거·변형 실시예를 추가). **총량 미달 = 출력 미완성**으로 간주한다.
  - ★ (보조 하한) 장치 상세설명은 도면 1개당 ${dlCfg.charPerFig}(공백 포함) 이상(상한이 아니라 하한). 앵커 종속항 뒷받침·정량적 근거 기술을 위해서는 이를 초과해도 무방하다 — 단, 위 총량이 우선이므로 도면당 하한 달성 후에도 총량 미달이면 계속 확장하라.
  - ★ 청구항의 모든 구성요소를 빠짐없이 포함하고 각 핵심 구성요소마다 변형 실시예("한편, 다른 실시예에서 상기 [용어]는 [대안]일 수 있다")를 기술하라.
  - ${dlCfg.extra}
  - 방법 상세설명: ${methodLengthPreset} 목표로 각 단계의 처리·데이터 흐름을 기술하라.
  - 앵커 종속항 대응 구성(${anchorGuide})은 일반 종속항의 2배 이상 분량으로, 심사관이 별도 보정 없이 등록을 인정할 수준으로: (1)동작 원리를 입력→처리→출력 단계로 (2)"이러한 구성에 의하면 ~한 기술적 효과를 얻을 수 있다" 문장 포함 (3)기준값/임계값/가중치/계수는 구체적 수치 예시 또는 범위와 그 산출·설정 근거·값 조정 시 거동 변화를 정량적으로 (4)다단계 처리·조건 분기는 각 단계 입력·처리·출력과 판단 기준(조건식·임계값)을 명시하라.
  - ★ 정량적 근거는 발명 내용에 부합해야 한다. 명세서에 없는 수치를 임의 창작하지 마라(신규사항·허위기재 금지). 근거가 없으면 "일 예로/대략" 등 예시임이 드러나게 기술하라.

[C12] 【출력 직전 자기검증】 (a) 본문의 모든 (NN)이 REFTABLE에 있는가 (b) REFTABLE의 모든 장치부호가 본문에 사용되었는가 (c) 번호·명칭 중복이 없는가 (d) 40자+ 문단/문장이 어디서도 완전 중복되지 않는가 (e) 장치=~한다·방법=~하는 단계 극성이 뒤바뀌지 않았는가 (f) 소괄호가 부호 표기 외 용도로 쓰이지 않았는가 (g) ★ 동일한 구성 명칭에 서로 다른 부호가 두 개 이상 배정되지 않았는가(하나의 명칭=하나의 부호 — 같은 명칭이 REFTABLE·본문에서 서로 다른 (NN)으로 나타나면 하나로 통일) (g2) ★ [배치15K] 일반 하드웨어 상용구(프로세서·메모리·통신부·서버 등)에 참조번호를 붙이지 않았는가(총칭어+번호는 dupassign 유발 — 번호는 청구항 구성요소 명칭에만) (h) ★ 모든 문단이 종결어미("~다.")로 끝나는가(문장이 중간에 끊긴 절단 문단이 없는가)${_mathOn?' (i) ★★ [배치15K-6] 각 수학식마다 좌변·우변에 등장하는 모든 기호(변수·계수·상수·아래첨자·위첨자·그리스문자·Σ/∏의 인덱스·함수 인자)를 하나씩 열거하여 그 수식 직후 "여기서" 절의 정의 목록과 1:1로 대조하라 — 정의 목록에 없는 기호가 좌·우변에 하나라도 있으면 그 기호의 정의를 "여기서" 절에 추가한 뒤 출력하라(전 기호 정의 완료 전 출력 금지). 또한 수학식 참조 방향(상기/다음의)이 실제 위치와 일치하는가':''}. 하나라도 어긋나면 그 부분만 고쳐 정합시킨 뒤 출력하라.

[C13] 【마무리 산출 — 동일 컨텍스트 흡수】 위 본문과 완전히 정합하는 네 블록을 이어서 출력하라(용어·부호는 REFTABLE 기준, 본문과 표기 동일).
  - TASK(해결하고자 하는 과제): ★ 이미 확정된 청구항(SOLUTION)을 "역설계"하여, 그 해결수단이 해결하는 종래 문제를 순수 서술문으로 작성하라. "본 발명은 ~을 제공(해결)하는 것을 목적으로 한다." 형태 150~400자, 헤더 금지. 마지막 문장: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다." ⛔ 절대 금지: "정보가 필요/부족", "입력되지 않", "제공해 주시", "작성하여 제공하겠", "청구항을 알려" 등 대화형·요청형 메타 표현(청구항·해결수단은 위에 이미 있으므로 그것만으로 역설계하라 — 추가 정보 요청 금지).
  - SOLUTION(과제의 해결 수단): 독립 청구항의 구성을 문장형으로 서술하라(청구항 번호 직접 언급 금지, "본 발명의 일 실시예에 따른 ~는 …를 포함한다" 형태).
  - EFFECTS(발명의 효과): 핵심 구성별로 "이러한 구성에 의하면 ~한 기술적 효과를 얻을 수 있다" 인과형 문단으로 기술하라(근거 없는 수치·과장 금지).
  - ABSTRACT(요약서): 발명의 요지 1문단(400~600자) — 핵심 구성요소를 참조번호 병기("명칭(NN)")로 포함하라.

■ 입력 데이터
[발명 내용 전문]
${inv}

[장치 청구범위]
${deviceClaims}

[방법 청구범위]
${methodClaims}

[장치 도면 — 부호 명칭(SSOT 원천)]
${deviceFigDesign}

[방법 도면]
${methodFigDesign}

[도면 구성요소 목록 — 이 명칭·참조번호만 사용]
${designComponents}${_fixInject}${_reviewInject}

지금부터 위 출력 계약(C1~C13)을 지켜 <<<REFTABLE>>> 블록부터 순서대로 출력하라.`;
    }
    case 'step_13':{
      const _mf=(typeof machineFindingsForReview==='function')?machineFindingsForReview():'';
      const _c=(typeof _step13Compact!=='undefined'&&_step13Compact);   // ★ [배치16.1-3] 축약 진단(대형 문서 타임아웃 재시도) — 입력 대폭 축소
      return `아래 청구범위와 상세설명을 전문적으로 검토하라.
${_mf?`\n═══ ★ 기계검증이 발견한 결정론적 결함 (최우선 반영) ═══\n아래는 기계(정규식) 검증이 현재 상세설명에서 실제로 검출한 결함이다. 각 항목을 반드시 아래 [5] 보완/수정 제안에 포함하여 구체적 수정 문장을 제시하라(문단/문장 중복 → 중복 사본 제거 지시, 문장 절단 → 문장 복원, 수학식 변수 미정의 → "여기서" 절에 변수 정의 추가, 예시 누락 → 실시예 보충).\n${_mf}\n`:''}
═══ 검토 항목 및 기준 ═══

[1] 청구항 뒷받침 검토 (특허법 제42조 제4항 제1호)
- 각 독립항의 모든 구성요소가 상세설명에서 충분히 설명되어 있는지 확인
- 종속항의 추가 한정 사항이 상세설명에 뒷받침되는지 확인
- 미흡한 경우: 보완이 필요한 구체적 문장을 제시하라

[2] 기술적 비약 검토
- 상세설명에서 청구항의 기술적 효과로 직접 연결되지 않는 논리적 비약이 있는지 확인
- "~할 수 있다"로 끝나는 모호한 효과 서술이 없는지 확인
- 미흡한 경우: 구체적 보완 문장을 제시하라

[3] 수학식 정합성 검토
- 수학식의 변수가 상세설명에서 모두 정의되어 있는지 확인
- 수학식이 청구항의 기술적 구성과 대응되는지 확인
- ★ 수학식 간 교차참조 정확성: 본문에서 "수학식 N에 의해 산출된 X"라고 기재된 경우, 실제로 수학식 N이 X를 산출하는 수식인지 확인. 번호 오기(誤記)가 있으면 반드시 지적하라.
- ★ 수학식 번호 순서: 상세설명에서 수학식이 처음 등장하는 순서가 【수학식 1】→【수학식 2】→... 순차적인지 확인
- 수학식이 없는 경우 이 항목은 "해당 없음"으로 표기

[4] 반복실시 가능성 (특허법 제42조 제3항 제1호)
- 당업자가 상세설명만으로 발명을 실시할 수 있을 만큼 구체적인지 확인
- 핵심 알고리즘/처리 로직의 단계별 설명이 충분한지 확인
- 입력/출력 데이터의 구조와 형식이 명확한지 확인

[5] 보완/수정 제안
- 위 1~4 및 8~12에서 발견된 문제에 대한 구체적 수정 문장을 제시하라
- 형식: [위치] 현재 문장 → 수정 문장
- ★ 기재 누락(해당 구성요소 설명이 없는 경우)에도 반드시 추가할 문장을 제시하라. "해당 없음"만 쓰고 수정 문장을 생략하지 마라.
  형식: [추가 위치] 기재 누락 → (추가할 문장: 해당 구성요소의 동작 원리, 입출력, 기술적 효과 포함)

[5-A] ★ 용어 통일 검토 (v14 신규) ★
- 명세서 전체에서 동일 개념에 다른 용어를 사용한 곳을 모두 찾아 지적하라
- 예: "단말"/"사용자 단말" 혼용, "음량 조절 값"/"목표 음량"/"최종 음량" 혼용
- 각 발견에 대해: [혼용 용어들] → [채택 기준 용어] / [통일 사유] 형식으로 제시

[5-B] ★ 수학식-변수 정합성 심화 검토 (v14 신규) ★
- 동일 목적의 수학식이 복수 존재하면, 변수 대응관계와 부호 방향이 일치하는지 확인
- 보정/학습 계수(alpha 등)의 값 범위, 초기값, 과도 누적 방지 조건이 명시되어 있는지 확인
- 핵심 파라미터에 대해 정의/값범위/초기값/갱신방식/제한조건이 모두 기술되어 있는지 확인
- "기정의된"만 쓰고 구체적 값이나 범위를 전혀 제시하지 않은 곳을 지적
- 수치 예시 계산 결과가 본문 서술 방향(증가/감소)과 모순되지 않는지 검산

${(deviceAnchorDep>0||methodAnchorDep>0)?`[6] 앵커 종속항 뒷받침 집중 검토 (등록 핵심)
${deviceAnchorDep>0?`- 장치 앵커 종속항(청구항 ${_deviceAnkStart()}~)의 각 기술적 구성이 상세설명에서:
  ① 동작 원리가 단계별(입력→처리→출력)로 설명되어 있는가?
  ② "이러한 구성에 의하면, ~" 형태의 기술적 효과가 명시되어 있는가?
  ③ 기준값/임계값/가중치의 의의가 설명되어 있는가?
  ④ 변형 실시예가 최소 1개 존재하는가?
- 미흡한 앵커가 있으면 해당 청구항 번호와 함께 구체적 보완 문장을 제시하라`:''}
${(includeMethodClaims&&methodAnchorDep>0)?`\n- 방법 앵커 종속항도 동일 기준으로 검토하라. 장치 앵커와 대응되는 방법 앵커의 뒷받침이 방법 상세설명에 충분한지 확인하라.`:''}
`:''}

[7] 발명 내용 반영 완전성
- 원본 발명 내용의 핵심 기술 요소가 청구항과 상세설명에 모두 포함되어 있는지 확인
- 누락된 기술 요소가 있으면 구체적으로 지적하라

[8] 청구항 명확성 검토 (특허법 제42조 제4항 제2호)
- 각 청구항이 발명의 구성을 명확하게 기재하고 있는지 확인
- 불명확한 표현 검출: "적절한", "필요에 따라", "바람직하게는", "소정의", "대략" 등 불확정 용어
- 청구항의 기술적 범위가 모호하거나 과도하게 광범위하지 않은지 확인
- 독립항에 불필요한 방법적 표현(장치 청구항에 "~하는 단계")이 혼입되지 않았는지 확인
- 미흡한 경우: 해당 청구항 번호와 불명확 표현을 지적하고 수정안을 제시하라

[9] 용어 일관성 검토
- 청구항에 사용된 구성요소 명칭과 상세설명의 구성요소 명칭이 동일한지 확인
- 예: 청구항에서 "분석부"라고 기재했으나 상세설명에서 "분석 모듈"로 기재된 경우 불일치
- 참조번호 대응 확인: 동일 구성요소에 서로 다른 참조번호가 부여되지 않았는지 확인
- 약어·전문용어가 상세설명에서 정의 없이 사용되지 않았는지 확인
- 불일치가 있으면 구체적으로 지적하라 (청구항 표현 vs 상세설명 표현)

[10] 도면 부호 정합성 검토
- 상세설명에 언급된 참조번호(예: 100, 110, 120)가 도면 설계에 실제로 존재하는지 확인
- 도면에 존재하는 구성요소가 상세설명에서 설명 없이 누락되지 않았는지 확인
- 참조번호 계층 일관성: L1(X00) → L2(XY0) → L3(XYZ) 체계가 혼란 없이 사용되는지 확인
- 불일치가 있으면 "상세설명의 참조번호 OOO(OOO)은 도면에 존재하지 않음" 형식으로 지적하라
- ★ 참조번호 명칭 혼용 검토: 하나의 참조번호에 2개 이상의 명칭이 사용되고 있으면 반드시 지적하라
  <span class="ico" data-icon="arrow-right"></span> 예: "추천부(114)" vs "추천 생성부(114)" 혼용, "메모리(120)" vs "데이터베이스(120)" 혼용
  <span class="ico" data-icon="arrow-right"></span> 가장 빈도 높은 명칭으로 통일할 것을 제안하라
- ★ 도면 미정의 참조번호 사용 검토: 도면에 정의되지 않은(존재하지 않는) 참조번호가 상세설명에서 사용되면 지적하라
- ★ 예시도 부호 구분: 예시도 부호(도 번호 기반 — 도 N → N0번대, 예: 도 5 → 51~)는 [예시도/개념도 설계]에 정의된 별개 부호다. 장치 도면(100~)에 없다고 "도면 미정의"로 오인하지 마라. 예시도 부호의 정합은 [예시도/개념도 설계]를 기준으로 판단하라.

[11] 청구항 형식 검토
- 독립항이 젭슨(Jepson) 형식("~에 있어서," 전환부 + "~을 특징으로 하는" 종결부)을 올바르게 따르는지 확인
- 종속항의 인용관계가 올바른지 확인: 인용된 청구항 번호가 실제로 존재하는지, 순환 인용이 없는지
- 다중종속항이 다른 다중종속항을 인용하지 않는지 확인 (특허법 시행령 제5조 제6항)
- 종속항이 독립항의 구성요소를 실질적으로 한정·추가하고 있는지 확인 (형식적 종속항 검출)
- 형식 오류가 있으면 해당 청구항 번호와 구체적 문제점을 지적하라

[12] ★ 예시도/개념도 정합 검토 (v15 — 예시도 lifecycle)
- [예시도/개념도 설계]가 제공된 경우에만 검토하라(없으면 "해당 없음"으로 표기).
- 각 예시도(도 N, 참조번호 31~99)가 ★[예시도 상세설명]★에 "도 N을 참조하면, …" 형태로 기술되어 있는지 확인하라(예시도 설명은 [상세설명](장치)이 아니라 별도 [예시도 상세설명]이 담당한다). 누락·부실 시 지적하되, ⛔ 예시도 단락을 [상세설명](장치)에 추가하라고 제안하지 마라 — 장치 상세설명에 예시도를 끼워넣는 것은 금지이며, 예시도 보완은 별도 단계(예시도 상세설명) 소관이다.
- 예시도 참조번호(도 번호 기반)가 부호의 설명에 "명칭 : 번호"로 빠짐없이 기재되어 있는지 확인하라. 누락 시 지적하라.
- 예시도 부호의 명칭이 상세설명·부호의 설명에서 동일하게 일관되는지 확인하라(혼용 지적).

[13] ★ 특허성 검토 (신규성·진보성 — v16, Step 15 통합) ★
- [특허성] 신규성·진보성 관점에서 청구항 1(독립항)의 "차별 구성"(선행기술 대비 새로운 구성)과 "자명성 리스크"(통상의 기술자가 인용발명으로부터 용이하게 도출 가능한지)를 검토하라.
- 진보성이 취약한 구성이 있으면, 어느 종속항의 한정을 독립항에 상신(上申)하거나 어떤 구성을 보강해야 하는지 "보완 방향"을 제시하라(⛔ 구체적 청구항 완성 문언 수술 금지 — 방향만).
- [선행기술]이 제공되면 그 개시 내용 대비로 판단하고, 없으면 발명 내용 기준으로 일반적 자명성 리스크를 평가하라(인용발명 없는 진보성 단정은 피하고 "확인 필요"로 표기).

═══ 출력 형식 ═══
각 항목별로:
✅ 적합 또는 ⚠️ 보완 필요
- (구체적 지적사항 및 수정 제안)

★ [13] 특허성 검토 결과는 반드시 "[특허성]" 소제목으로 구분하여 (차별 구성 / 자명성 리스크 / 보완 방향) 순으로 기술하라.
마지막에 전체 요약 (보완 우선순위 포함)

${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}${outputs.step_18?'\n[부호의 설명] '+outputs.step_18.slice(0,_c?1200:2000):''}\n[상세설명] ${(getLatestDescription()||'').slice(0,_c?2500:6000)}${getLatestMethodDescription()?'\n[방법 상세설명] '+getLatestMethodDescription().slice(0,_c?1200:3000):''}\n[도면 설계] ${(outputs.step_07||'').slice(0,_c?800:2000)}${(!_c&&outputs.step_07c)?'\n[예시도/개념도 설계 — 참조번호 31~99, 장치(100~)와 별개] '+outputs.step_07c.slice(0,1500):''}${(!_c&&outputs.step_08c)?'\n[예시도 상세설명 — 도 N별 본문(별도 단계에서 작성됨, 31~99 기준)] '+outputs.step_08c.slice(0,3000):''}${(!_c&&outputs.step_04)?'\n[선행기술 — 특허성 검토용] '+outputs.step_04.slice(0,2000):''}\n[원본 발명 내용] ${inv.slice(0,_c?1200:3000)}${_c?'\n\n※ 문서가 커서 상세설명을 축약 제공했습니다 — 청구항 뒷받침·특허성 중심으로 핵심만 진단하라.':''}`;}

    case 'step_14':return `대안 청구항을 작성하라. 원본 청구항의 핵심 기술적 구성은 그대로 유지하되, 표현을 달리하라.

★ 작성 규칙:
- 독립항은 반드시 젭슨(Jepson) 형식 유지: "~에 있어서," 전환부 + "~을 특징으로 하는" 종결부
- 표현 변경의 목적: 심사관의 거절 시 대응용 대안 확보
- 구성요소 명칭, 동작 서술 방식, 문장 구조를 변경하되 기술적 의미는 동일하게 유지
- 상세설명과 발명 내용을 참고하여, 표현 변경 시 기술적 정확성을 확보하라
- 【청구항 N】 형식

\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}\n[상세설명 — 참고용] ${(getLatestDescription()||'').slice(0,2000)}${getFullInvention()}${styleRef}`;
    case 'step_15':return `특허성 검토: 아래 청구범위와 상세설명에 대해 다음 항목을 검토하라.

(1) 신규성: 청구항의 구성요소 조합이 선행기술과 구별되는지
(2) 진보성: 기술적 특징이 당업자에게 자명하지 않은 수준인지, 특히 앵커 종속항의 창의성
(3) 명확성: 청구항 표현이 명확하고 뒷받침되는지
(4) 산업상 이용가능성: 실제 구현 가능한 기술인지
(5) 보호범위 최적화: 독립항이 과도하게 좁거나 넓지 않은지, 개선 제안

각 항목별로 평가 결과와 개선 제안을 작성하라.

${T}\n[전체 청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명 요약] ${(getLatestDescription()||'').slice(0,3000)}\n[발명 내용] ${inv.slice(0,2000)}`;
    case 'step_16':{
      const hasTask=!!outputs.step_05;
      return `발명의 효과를 작성하라. "본 발명에 따르면,"으로 시작. 각 효과를 문단 단위로 기술하되, 총 3~5개 효과 항목을 서술하라.

${hasTask?`★ 과제-효과 1:1 대응 원칙 ★
아래 [과제]에서 제기한 각 문제에 대해 1:1로 대응하는 효과를 기술하라.
과제에서 "A가 문제"라고 했으면, 효과에서는 "A를 해결하여 B 이점이 있다"로 대응.`:`★ 청구항 기반 효과 도출 원칙 ★
아래 [독립항]의 핵심 구성요소가 해결하는 기술적 과제를 파악하고, 각 구성요소가 제공하는 기술적 효과를 3~5개 기술하라.
각 효과는 "본 발명에 따르면," 또는 "또한, 본 발명에 따르면,"으로 시작하라.`}

마지막: "본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다."
${T}
${hasTask?`[과제] ${outputs.step_05}`:''}
[독립항] ${(outputs.step_06||'').match(/【청구항 1】[\s\S]*?(?=【청구항 2】|$)/)?.[0]||''}
[상세설명] ${(getLatestDescription()||'').slice(0,2000)}${styleRef}`;
    }
    case 'step_17':return `아래 [장치]/[방법] 청구항을 요약하여 【과제의 해결 수단】 항목의 본문을 작성하라. 각 독립항 카테고리별로 요약한다.
⛔ "과제의 해결 수단"이라는 제목/머리말을 출력하지 마라. 본문 문장만 출력하라.

★ 용어 규칙: 청구항에서 사용한 구성요소 명칭, 참조번호, 기술 용어를 그대로 사용하라. 동의어로 바꾸지 마라.
형식:
"본 발명의 일 실시예에 따른 ${getDeviceSubject()}는, ..." (장치 독립항 요약)
${includeMethodClaims?'"본 발명의 일 실시예에 따른 방법은, ..." (방법 독립항 요약)':''}
${outputs.step_20?'"본 발명의 일 실시예에 따른 컴퓨터 판독 가능 기록매체는, ..." (기록매체 독립항 요약)\n"본 발명의 일 실시예에 따른 컴퓨터 프로그램은, ..." (프로그램 독립항 요약)':''}
마지막: "본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다."
\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}${outputs.step_20?'\n[기록매체/프로그램] '+outputs.step_20:''}${styleRef}`;
    case 'step_18':{
      const hasMethod=includeMethodClaims&&outputs.step_11;
      // 본문·청구항·도면에서 참조번호(명칭) 전수 수집
      const _refSources=[outputs.step_06,outputs.step_08,outputs.step_08c,outputs.step_09,outputs.step_10,outputs.step_12,outputs.step_07,outputs.step_11,outputs.step_07c].filter(Boolean).join('\n');
      const _refMap=new Map();
      // "명칭(참조번호)" 또는 "명칭 (참조번호)" 패턴 수집
      const _refRe=/([가-힣a-zA-Z][가-힣a-zA-Z\s]{0,15}?)\s*\((\d{2,4}|S\d{2,4})\)/g;
      let _rm;while((_rm=_refRe.exec(_refSources))!==null){
        const name=_rm[1].replace(/^상기\s*/,'').trim();const num=_rm[2];
        if(name.length>=2&&!_refMap.has(num))_refMap.set(num,name);
      }
      const _collectedRefs=[..._refMap.entries()].sort((a,b)=>{
        const na=a[0].startsWith('S')?parseInt(a[0].slice(1))+10000:parseInt(a[0]);
        const nb=b[0].startsWith('S')?parseInt(b[0].slice(1))+10000:parseInt(b[0]);
        return na-nb;
      }).map(([num,name])=>`${name} : ${num}`).join('\n');
      return `【부호의 설명】을 작성하라.

형식: "구성요소 : 참조번호" (콜론 사용)
정렬: 참조번호 오름차순

★★★ 핵심 규칙: 본문에서 사용된 모든 참조번호를 빠짐없이 포함하라 ★★★
- 본문(상세설명, 청구항, 도면설명)에서 "구성요소(XXX)" 형태로 사용된 모든 참조번호를 누락 없이 기재하라.
- 하나의 참조번호에는 반드시 하나의 명칭만 사용하라 (동의어/약칭 혼용 금지).
- 본문에서 가장 많이 사용된 명칭을 채택하라.

[장치 구성요소 — 숫자만 사용]
- 형식: 100, 110, 111, 200, 210...
- 계층적 체계: L1(X00) → L2(XY0) → L3(XYZ)

${hasMethod?`[방법 단계 — S+숫자 사용]
- 형식: S401, S402, S403...

⚠️ 장치 구성요소(숫자)와 방법 단계(S숫자)를 반드시 구분하여 별도 섹션으로 작성하라.`:`⚠️ 장치 구성요소만 작성하라. 방법 단계(S100 등)는 포함하지 마라.`}

[본문에서 수집된 참조번호 목록 — 아래 목록의 모든 항목을 반드시 포함하라]
${_collectedRefs||'(수집된 참조번호 없음 — 도면 및 청구항에서 직접 추출하라)'}

${T}\n[장치 도면] ${outputs.step_07||''}${hasMethod?`\n[방법 도면] ${outputs.step_11||''}`:''}\n[장치 상세설명 발췌] ${(getLatestDescription()||'').slice(0,3000)}\n[장치 청구항] ${(outputs.step_06||'').slice(0,2000)}`}
    case 'step_19':return `요약서. 청구항1 기준 450자. \"본 발명은\"시작.\n출력:\n【요약】\n(본문)\n\n【대표도】\n도 1\n\n위 형식만.\n${T}\n[청구항1] ${(outputs.step_06||'').slice(0,1500)}${styleRef}`;

    // ═══ Step 20: 기록매체 / 컴퓨터 프로그램 독립항 (v5.5 신규) ═══
    case 'step_20':{
      const lastNum=getLastClaimNumber([outputs.step_06||'',outputs.step_10||''].join('\n'));
      const mediaStart=lastNum+1;
      const progStart=lastNum+2;
      return `아래 방법 청구항을 기반으로 기록매체 독립항 1개와 컴퓨터 프로그램 독립항 1개를 작성하라.

═══ 작성 규칙 ═══

[1] 컴퓨터 판독 가능 기록매체 독립항 (【청구항 ${mediaStart}】)
- 형식: "프로세서에 의해 실행되면, ~방법을 수행하는 프로그램이 기록된 컴퓨터 판독 가능 기록매체."
- 방법 독립항의 모든 단계를 빠짐없이 포함
- "~하는 단계;" 형태로 단계를 나열
- 마지막: "을 수행하는 프로그램이 기록된 컴퓨터 판독 가능 기록매체."

[2] 컴퓨터 프로그램 독립항 (【청구항 ${progStart}】)
- 형식: "하드웨어인 컴퓨터와 결합되어, ~방법을 수행시키기 위해 컴퓨터 판독 가능 기록매체에 저장된 컴퓨터 프로그램."
- 방법 독립항의 모든 단계를 빠짐없이 포함
- 마지막: "을 수행시키기 위해 컴퓨터 판독 가능 기록매체에 저장된 컴퓨터 프로그램."

═══ 핵심 주의사항 ═══
- 방법 독립항의 단계를 그대로 인용하되, "프로세서가" 또는 "컴퓨터가" 수행하는 형태로 서술
- 장치 구성요소(~부, 참조번호)는 포함하지 마라 — 방법의 단계만 기술
- 젭슨(Jepson) 형식 불필요 — 기록매체/프로그램은 전체가 신규 구성이므로
- 【청구항 N】 형식 준수, 번호는 ${mediaStart}부터

${T}\n[방법 청구항] ${outputs.step_10||''}\n[장치 독립항 — 참고용] ${(outputs.step_06||'').slice(0,2000)}`;}

    default:return '';
  }
}

