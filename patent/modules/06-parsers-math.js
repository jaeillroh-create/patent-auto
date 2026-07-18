// ═══════════ PARSERS ═══════════
function parseTitleCandidates(t){const c=[];let m;const re=/\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;while((m=re.exec(t))!==null)c.push({num:m[1],korean:m[2].trim(),english:m[3].trim()});return c;}
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/(?:청구항|제)\s*\d+\s*(?:항\s*)?에\s*(?:있어서|따른|의한)/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:_sanitizeMathFormula(m[2].trim())});return b;}

// v10.3: 수학식 FORMULA 오염 제거 — LLM이 원문 텍스트를 FORMULA에 포함시키는 문제
// 【수학식 N】 + 수식 + "여기서," 설명 + "예를 들어," 예시까지만 보존
function _sanitizeMathFormula(formula){
  if(!formula)return formula;
  const lines=formula.split('\n');
  const cleanLines=[];
  let foundExample=false; // "예를 들어" 라인 도달 여부
  let exampleDone=false;  // 예시 문장 종료 여부
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const trimmed=line.trim();
    
    // 수학식 종료 후 원문 오염 감지
    if(exampleDone){
      // 빈 줄은 허용 (수학식 블록 종료 마커)
      if(!trimmed){cleanLines.push(line);continue;}
      // 원문 텍스트 패턴 감지 — 수학식이 아닌 일반 서술문
      // 쉼표로 시작하는 문장 잔해 (", 경고 상태로 판정된 경우...")
      if(trimmed.startsWith(',')||trimmed.startsWith('.')){
        console.warn(`[_sanitizeMathFormula] 원문 오염 제거: "${trimmed.slice(0,50)}..."`);
        break; // 이후 모든 라인 폐기
      }
      // 한국어 서술문 패턴 (구성요소, 동작 설명)
      if(/^[가-힣]/.test(trimmed)&&!trimmed.startsWith('【수학식')&&
         !trimmed.startsWith('여기서')&&!trimmed.startsWith('예를 들어')&&
         !trimmed.startsWith('일 예로')&&!trimmed.startsWith('구체적')&&
         !/^[A-Z_a-z(]/.test(trimmed)&&
         (trimmed.includes('하고,')||trimmed.includes('하며,')||trimmed.includes('한다.')||
          trimmed.includes('된다.')||trimmed.includes('있다.')||trimmed.includes('이다.'))){
        console.warn(`[_sanitizeMathFormula] 원문 서술문 감지, 이후 폐기: "${trimmed.slice(0,50)}..."`);
        break;
      }
      cleanLines.push(line);
      continue;
    }
    
    // 예를 들어 라인 감지
    if(!foundExample&&(trimmed.startsWith('예를 들어')||trimmed.startsWith('일 예로')||trimmed.startsWith('구체적 예시'))){
      foundExample=true;
    }
    
    // 예를 들어 라인 이후 마침표로 끝나면 예시 완료
    if(foundExample&&trimmed.length>5&&/[.다]$/.test(trimmed)){
      exampleDone=true;
    }
    
    cleanLines.push(line);
  }
  
  // 끝부분 빈 줄 정리
  while(cleanLines.length>0&&!cleanLines[cleanLines.length-1].trim())cleanLines.pop();
  return cleanLines.join('\n');
}
function stripMathBlocks(text){
  if(!text)return '';
  // 회귀 방지 케이스 (반드시 PASS):
  // [IN]  "【수학식 1】\nF=ma\n여기서 F는 힘이다.\n\n예를 들어 자동차는 가속한다."
  // [OUT] "예를 들어 자동차는 가속한다."   ← 수학식+여기서절은 제거, 일반서술 보존
  // [IN]  "본 발명은, 예를 들어 다음과 같다."
  // [OUT] "본 발명은, 예를 들어 다음과 같다."   ← 수학식 없으면 무손실
  // [IN]  "【수학식 1】\nE=mc²\n\n【수학식 2】\nF=ma"
  // [OUT] ""   ← 연속 수학식 모두 제거 (빈 줄로 잘리지 않음)
  // [IN]  "【수학식 1】\nA=B\n여기서 A는 면적,\nB는 폭이다."
  // [OUT] ""   ← "여기서" 절이 줄바꿈 포함해도 끝까지 따라감
  //
  // 호출처: insertMathBlocks(line ~6471, step_09 수학식 삽입 시 기존 블록 제거)
  //
  // 원리: 【수학식 N】 블록 전체를 단일 패턴으로 제거 (4개 독립 패턴 → 1개 통합)
  // 수학식 블록 = 【수학식 N】 + 수식 + 여기서 + 예를 들어 (하나의 단위)
  // 종결 조건: (1) \n + 서술 키워드, (2) \n\n + 비수학 시작, (3) 문자열 끝
  // 수학 연속(MC) 패턴: "여기서", "예를 들어"는 단독 키워드만으로는 부족 —
  // 일반 서술도 흔히 쓰는 표현이므로 "예를 들어"는 같은 줄에 수식기호(=,×,÷,∑,±) 동반시만 인식
  const MC='여기서|예를 들어[^\\n]*?[=×÷∑±]|예시 대입|일 예로[^\\n]*?[=×÷∑±]|구체적\\s*예시|예컨대[^\\n]*?[=×÷∑±]|다음은[^\\n]*?[=×÷∑±]|예:[^\\n]*?[=×÷∑±]|[A-Z_][A-Za-z_\\d]*\\s*[=:]';
  const DK='도\\s|이때|또한|한편|다음(?!은)|구체적으로|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\\s]|[가-힣]{2,}(?:서버|시스템|장치|단말)';
  const term=`\\n(?:${DK}|\\n(?!\\s*(?:${MC})))|$`;
  let r=text.replace(new RegExp(`\\n*【수학식\\s*\\d+】[\\s\\S]*?(?=${term})`,'g'),'');
  // 잔여 독립 헤더 정리
  r=r.replace(/\n*【수학식\s*\d+】[^\n]*\n/g,'\n');
  // 다중 줄바꿈 정리
  r=r.replace(/\n{3,}/g,'\n\n');
  return r.trim();
}
// ★ [cleanup D2] 중복 제거용 정규화 공유 헬퍼 — stripMathBlocks(수학식 제거) + 공백 전제거.
//   기존 3중복(_normForDedup 03·_n 05·norm 08)을 이 하나로 통일. (_normForAnchor 는 구두점 기반이라 별개)
function _stripMathNorm(s){ return stripMathBlocks(String(s||'')).replace(/\s+/g,''); }
// v10.2: 수학식 번호 순차 재정렬 (헤더 + 본문 교차참조 모두 갱신)
function renumberMathBlocks(text){
  if(!text)return text;
  
  // 1단계: 모든 【수학식 N】 헤더 수집 → 위→아래 출현 순서대로 매핑 구축
  const headerRe=/【수학식\s*(\d+)】/g;
  const oldToNew={};  // {oldNum: newNum}
  let m,newNum=0;
  while((m=headerRe.exec(text))!==null){
    const oldN=m[1];
    if(!(oldN in oldToNew)){newNum++;oldToNew[oldN]=String(newNum);}
  }
  if(!newNum)return text;
  
  // 이미 순차적이면 변경 불필요
  const needsRename=Object.entries(oldToNew).some(([o,n])=>o!==n);
  if(!needsRename)return text;
  
  // 2단계: 2-pass 치환 (충돌 방지: old→임시→최종)
  let r=text;
  // 큰 번호부터 치환 (수학식 10 → 수학식 1 부분매칭 방지)
  const sortedOld=Object.keys(oldToNew).sort((a,b)=>parseInt(b)-parseInt(a));
  for(const oldN of sortedOld){
    // 【수학식 N】 헤더 + 본문 "수학식 N" 참조 모두 매칭
    // 후행 문자: 】, 한국어 조사(에,을,의,은,는,이,과,와), 공백, 구두점
    const re=new RegExp(`수학식\\s*${oldN}(?=】|에|을|를|의|은|는|이|과|와|로|\\s|,|\\.|;|:|$)`,'g');
    r=r.replace(re,`수학식__RENUM_${oldToNew[oldN]}__`);
  }
  // 임시 → 최종
  r=r.replace(/수학식__RENUM_(\d+)__/g,'수학식 $1');
  return r;
}
// v10.2: 기존 수학식 블록 추출 (원문에서 수학식+설명 전체를 보존)
function extractExistingMathBlocks(text){
  if(!text)return[];
  const blocks=[];
  const re=/\n*(【수학식\s*\d+】[\s\S]*?)(?=\n\n(?:도\s|이때|또한|한편|다음|구체적|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\s]|[가-힣]{2,}(?:서버|시스템|장치|단말))|\n\n\n|$)/g;
  let m;
  while((m=re.exec(text))!==null){
    const formula=m[1].trim();
    const before=text.substring(Math.max(0,m.index-200),m.index);
    // 소수점(3.14 등)을 보호한 후 문장 분리 — 소수점에서 잘리는 앵커 방지
    const _safeBefore=before.replace(/(\d)\.(\d)/g,'$1�$2');
    const sentences=_safeBefore.split(/[.。]\s*/);
    // 마지막 비어있지 않은 완전한 문장을 앵커로 사용 (마지막 요소는 불완전 조각일 수 있음)
    let anchor='';
    for(let si=sentences.length-1;si>=0;si--){
      const s=sentences[si].replace(/�/g,'.').trim();
      if(s.length>=10){anchor=s;break;}
    }
    if(anchor.length>=10)blocks.push({anchor,formula});
  }
  return blocks;
}
// ═══ A3 fix: 유사도 기반 앵커 매칭 (v5.5, v10.2: 독립 함수 추출) ═══
function fuzzyFindAnchor(text,anchor){
  if(!text||!anchor||anchor.length<5)return -1;
  // 1차: 정확 매칭
  const exact=text.indexOf(anchor);
  if(exact>=0)return exact;
  // 2차: 정규화 + 정확한 위치 역매핑 (ratio 방식 폐기 — v10.3)
  const isPunct=c=>'.,;:!?·…'.includes(c);
  const normAnchor=_normForAnchor(anchor);
  if(normAnchor.length<5)return -1;
  
  // 원문의 각 문자 → 정규화 문자열에서의 인덱스 매핑 구축
  const normChars=[];
  const normToOrig=[]; // normToOrig[i] = 정규화 i번째 문자의 원문 위치
  let prevSp=true;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(isPunct(c))continue;
    if(/\s/.test(c)){
      if(!prevSp&&normChars.length>0){normChars.push(' ');normToOrig.push(i);prevSp=true;}
    }else{normChars.push(c);normToOrig.push(i);prevSp=false;}
  }
  const normText=normChars.join('');
  const normIdx=normText.indexOf(normAnchor);
  if(normIdx>=0&&normIdx<normToOrig.length){
    return normToOrig[normIdx]; // ★ 정확한 원문 위치 반환 ★
  }
  // 3차: 앵커의 핵심 키워드(3단어 이상) 연속 매칭
  const words=anchor.replace(/[.,;:!?·…]/g,'').split(/\s+/).filter(w=>w.length>=2);
  if(words.length>=3){
    const escaped=words.slice(0,Math.min(5,words.length)).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const keyPhrase=escaped.join('\\s*[.,;:!?·…]*\\s*'); // v10.3: 구두점 허용
    try{
      const re=new RegExp(keyPhrase);
      const km=text.match(re);
      if(km&&km.index!=null)return km.index;
    }catch(e){/* regex 실패 시 4차로 */}
  }
  // ★ FIX-B: 4·5차(부분 20자 매칭)는 반복 문형에서 오매칭·오프셋 어긋남 위험 → 반환 직전 사후 검증.
  //   후보 위치의 anchor.length 창을 정규화하여 anchor 와 bigram Dice 유사도 측정, 임계 미만이면 무효화.
  //   (1~3차는 신뢰도 높아 게이트 제외. 임계 보수적 — 오탐 시 삽입 실패가 오염보다 안전.)
  const _aNorm=_normForAnchor(anchor);
  // 4차: 앵커 앞 20자로 부분 매칭
  if(anchor.length>=20){
    const partial=anchor.slice(0,20);
    const pi=text.indexOf(partial);
    if(pi>=0 && _anchorBigramDice(_aNorm,_normForAnchor(text.slice(pi,pi+anchor.length)))>=0.5)return pi;
  }
  // 5차: 앵커 뒤 20자로 부분 매칭 (AI 검토로 앞부분이 변경된 경우)
  if(anchor.length>=20){
    const tail=anchor.slice(-20);
    const ti=text.indexOf(tail);
    if(ti>=0){
      const est=Math.max(0,ti-(anchor.length-20));
      if(_anchorBigramDice(_aNorm,_normForAnchor(text.slice(est,est+anchor.length)))>=0.5)return est;
    }
  }
  // 6차: 핵심 키워드 후방 3단어 연속 매칭
  if(words&&words.length>=3){
    const tailWords=words.slice(-Math.min(4,words.length));
    const escaped2=tailWords.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const tailPhrase=escaped2.join('\\s*[.,;:!?·…]*\\s*');
    try{
      const re2=new RegExp(tailPhrase);
      const km2=text.match(re2);
      if(km2&&km2.index!=null){
        // ★ FIX-B 확장: 6차도 사후검증(4·5차 동형). 매칭된 꼬리(km2.index) 위치에서 앵커 시작을 역추정한
        //   anchor.length 창(꼬리 끝에 정렬)을 Dice 검증 — 임계 미만이면 무효(오매칭 위치 반환 차단, return -1).
        const _est=Math.max(0,km2.index-(anchor.length-km2[0].length));
        if(_anchorBigramDice(_aNorm,_normForAnchor(text.slice(_est,km2.index+km2[0].length)))>=0.5)return km2.index;
      }
    }catch(e){/* 무시 */}
  }
  return -1;
}

// 앵커 정규화 헬퍼 (공백 정리 + 구두점 제거)
function _normForAnchor(s){
  const isPunct=c=>'.,;:!?·…'.includes(c);
  let r='',prev=true;
  for(const c of s){
    if(isPunct(c))continue;
    if(/\s/.test(c)){if(!prev&&r.length){r+=' ';prev=true;}}
    else{r+=c;prev=false;}
  }
  return r.trim();
}
// ★ FIX-B: bigram Dice 유사도(0~1) — 후보 창이 앵커와 실질 동일 구절인지 사후 검증용.
//   앞부분 편집(5차)에도 대부분 bigram이 공유되므로 부분편집엔 관대, 우연 20자 일치(오매칭)엔 엄격.
function _anchorBigramDice(a,b){
  if(!a||!b||a.length<2||b.length<2)return 0;
  const bg=s=>{const set=new Set();for(let i=0;i<s.length-1;i++)set.add(s.slice(i,i+2));return set;};
  const A=bg(a),B=bg(b); let inter=0; A.forEach(x=>{if(B.has(x))inter++;});
  return (2*inter)/(A.size+B.size);
}

// v10.3: 앵커 위치에서 문장 끝(마침표) 찾기
// 핵심: 한국어 문장 종결어미(~다.) 뒤의 마침표만 문장 끝으로 인정
// "생성하고," 같은 쉼표 절은 건너뛰고 "생성할 수 있다." 같은 종결어미 뒤 마침표까지 이동
function findSentenceEndAfterAnchor(text,anchorStart,anchor){
  // Step 1: 앵커의 실제 끝 위치를 원문에서 정확히 추적
  const normEnd=_normForAnchor(anchor).slice(-15);
  let actualEnd=Math.min(anchorStart+anchor.length,text.length);
  
  if(normEnd&&normEnd.length>=5){
    const searchEnd=Math.min(anchorStart+anchor.length*2+100,text.length);
    const region=text.slice(anchorStart,searchEnd);
    const normRegion=_normForAnchor(region);
    const tailIdx=normRegion.indexOf(normEnd);
    if(tailIdx>=0){
      const isPunct=c=>'.,;:!?·…'.includes(c);
      let normPos=0,origPos=0,prevSp=true;
      const target=tailIdx+normEnd.length;
      for(origPos=0;origPos<region.length&&normPos<target;origPos++){
        const c=region[origPos];
        if(isPunct(c))continue;
        if(/\s/.test(c)){if(!prevSp){normPos++;prevSp=true;}}
        else{normPos++;prevSp=false;}
      }
      actualEnd=anchorStart+origPos;
    }
  }

  // v10.5: actualEnd가 단어 중간이면 보정 — 앞쪽 단어 경계(공백/마침표)로 이동
  if(actualEnd>0&&actualEnd<text.length&&
     /[가-힣]/.test(text[actualEnd-1]||'')&&/[가-힣]/.test(text[actualEnd]||'')){
    // 앵커 끝이 단어 중간 → 뒤쪽으로 단어 끝까지 진행
    let wordEnd=actualEnd;
    while(wordEnd<text.length&&/[가-힣]/.test(text[wordEnd])&&text[wordEnd]!=='.')wordEnd++;
    actualEnd=wordEnd;
  }

  // Step 1.5: actualEnd 직전(~6자)에 문장 종결 마침표가 있으면 그것을 사용
  // (정규화 오차로 actualEnd가 마침표 직후를 넘어간 경우 보정)
  for(let pos=Math.min(actualEnd,text.length-1);pos>=Math.max(0,actualEnd-6);pos--){
    if(text[pos]==='.'){
      const _b4=text.slice(Math.max(0,pos-4),pos);
      const _pc=pos>0?text[pos-1]:'';
      const _nx=pos+1<text.length?text[pos+1]:'';
      if(/\d/.test(_pc)&&/\d/.test(_nx))continue;
      if(/(?:한다|된다|있다|이다|같다|높다|낮다|않다|크다|작다|많다|적다|좋다|짧다|보다|온다|간다|준다|난다|진다|낸다|넓다|깊다|길다|는다)$/.test(_b4))return pos+1;
      if((!_nx||_nx===' '||_nx==='\n'||_nx==='\r')&&/[가-힣)]/.test(_pc))return pos+1;
      // v10.4: 한글.한글 — 띄어쓰기 누락된 문장 경계 (소수점은 위에서 이미 제외됨)
      if(/[가-힣)]/.test(_pc)&&/[가-힣(]/.test(_nx))return pos+1;
    }
  }

  // Step 2: actualEnd부터 한국어 문장 종결 패턴(~다.) 찾기
  for(let pos=actualEnd;pos<text.length;pos++){
    if(text[pos]==='.'){
      const before=text.slice(Math.max(0,pos-4),pos);
      const next=pos+1<text.length?text[pos+1]:'';

      // "0.5" 같은 소수점은 건너뜀
      const prevChar=pos>0?text[pos-1]:'';
      if(/\d/.test(prevChar)&&/\d/.test(next))continue;

      // 한국어 문장 종결 패턴
      const isKoreanSentEnd=/(?:한다|된다|있다|이다|같다|높다|낮다|않다|크다|작다|많다|적다|좋다|짧다|보다|온다|간다|준다|난다|진다|낸다|넓다|깊다|길다|는다)$/.test(before);
      // "~수 있다." "~할 수 있다." 패턴
      const isCanPattern=/있다$/.test(before)&&/수\s*있다/.test(text.slice(Math.max(0,pos-10),pos));

      if(isKoreanSentEnd||isCanPattern){
        return pos+1;
      }

      // 마침표 다음이 공백/줄바꿈/EOF이고, 앞 글자가 한글이면 문장 끝 가능
      if((!next||next===' '||next==='\n'||next==='\r')&&/[가-힣)]/.test(prevChar)){
        return pos+1;
      }

      // v10.4: 한글.한글 — 띄어쓰기 누락된 문장 경계 (소수점은 위에서 이미 제외됨)
      if(/[가-힣)]/.test(prevChar)&&/[가-힣(]/.test(next)){
        return pos+1;
      }
    }
  }
  
  // 마침표 없으면 줄바꿈 찾기
  const nlIdx=text.indexOf('\n',actualEnd);
  if(nlIdx>=0)return nlIdx;
  
  return text.length;
}

// v10.5: 삽입 지점이 단어/문장 중간이 아닌지 검증 + 보정
function _validateInsertionPoint(text,ip){
  if(ip<=0||ip>=text.length)return ip;
  const before=text[ip-1]||'';
  const after=text[ip]||'';
  // 이미 마침표 뒤이거나 줄바꿈이면 OK
  if(before==='.'||before==='\n'||after==='\n'||after===' ')return ip;
  // 한글+한글 연속 = 단어 중간 → 가장 가까운 마침표+공백 또는 줄바꿈을 찾아 보정
  if(/[가-힣]/.test(before)&&/[가-힣]/.test(after)){
    // 뒤쪽으로 마침표 찾기 (최대 80자)
    for(let p=ip;p<Math.min(ip+80,text.length);p++){
      if(text[p]==='.'){
        const pc=p>0?text[p-1]:'';
        const nc=p+1<text.length?text[p+1]:'';
        if(/\d/.test(pc)&&/\d/.test(nc))continue;
        if(/[가-힣)]/.test(pc))return p+1;
      }
      if(text[p]==='\n')return p;
    }
    // 앞쪽으로 마침표 찾기 (최대 40자)
    for(let p=ip-1;p>=Math.max(0,ip-40);p--){
      if(text[p]==='.'){
        const pc=p>0?text[p-1]:'';
        const nc=p+1<text.length?text[p+1]:'';
        if(/\d/.test(pc)&&/\d/.test(nc))continue;
        if(/[가-힣)]/.test(pc))return p+1;
      }
    }
  }
  return ip;
}

// v10.3: 수학식 삽입 후 문장/절 중복 감지/제거
// 패턴 1: 마침표 문장 중복 (수학식 블록 사이에 같은 문장)
// 패턴 2: 쉼표 절 중복 (긴 문장의 일부 절이 수학식 앞/뒤에 중복)
function _deduplicateSentences(text){
  if(!text)return text;
  let result=text;
  let removedCount=0;
  
  // ═══ 패턴 1: 50자 이상 동일 텍스트 조각이 2회 이상 등장 ═══
  // 수학식 블록 앞/뒤에서만 제거 (다른 도면의 정상 반복은 보존)
  const mathBlockPositions=[];
  const mathRe=/【수학식\s*\d+】/g;
  let mm;
  while((mm=mathRe.exec(result))!==null)mathBlockPositions.push(mm.index);
  
  if(mathBlockPositions.length>0){
    // 50자 이상 연속 텍스트 조각으로 중복 검사
    // 쉼표 절(, ~하고) 또는 마침표 문장 단위로 분리
    const clauseRe=/([^,.\n]{20,}(?:하고|하며|한다|된다|있다|이다|같다|높다|낮다|크다|작다|많다|적다)[,.])/g;
    let cm;
    const clauses=[];
    while((cm=clauseRe.exec(result))!==null){
      clauses.push({text:cm[1].trim(),start:cm.index,end:cm.index+cm[0].length});
    }
    
    // 동일 절 그룹화
    const clauseMap=new Map();
    for(const c of clauses){
      const key=c.text.replace(/\s+/g,' ');
      if(key.length<25)continue;
      if(!clauseMap.has(key))clauseMap.set(key,[]);
      clauseMap.get(key).push(c);
    }
    
    const toRemove=[];
    for(const [key,occurrences] of clauseMap){
      if(occurrences.length<2)continue;
      // 수학식이 두 등장 사이에 있는 경우만 제거
      const hasMathBetween=occurrences.some((o,i)=>{
        if(i===0)return false;
        const between=result.slice(occurrences[i-1].end,o.start);
        return between.includes('【수학식');
      });
      if(hasMathBetween){
        for(let i=1;i<occurrences.length;i++){
          toRemove.push(occurrences[i]);
        }
      }
    }
    
    // ═══ 패턴 2: 마침표 기준 긴 문장 중복 ═══
    const sentRe=/([^.\n]{40,}\.)/g;
    let sm2;
    const sentences=[];
    while((sm2=sentRe.exec(result))!==null){
      sentences.push({text:sm2[1].trim(),start:sm2.index,end:sm2.index+sm2[0].length});
    }
    
    const sentMap=new Map();
    for(const s of sentences){
      const key=s.text.replace(/\s+/g,' ');
      if(key.length<40)continue;
      if(!sentMap.has(key))sentMap.set(key,[]);
      sentMap.get(key).push(s);
    }
    
    for(const [key,occurrences] of sentMap){
      if(occurrences.length<2)continue;
      const hasMathBetween=occurrences.some((o,i)=>{
        if(i===0)return false;
        const between=result.slice(occurrences[i-1].end,o.start);
        return between.includes('【수학식');
      });
      if(hasMathBetween){
        for(let i=1;i<occurrences.length;i++){
          // 이미 제거 대상이 아닌 경우만 추가
          if(!toRemove.some(r=>r.start===occurrences[i].start))
            toRemove.push(occurrences[i]);
        }
      }
    }
    
    // 역순 제거 (겹치는 범위만 병합)
    // ★ 수정: 내림차순 정렬 기준 겹침은 (앞범위 시작 < 뒷범위 끝). 기존 조건은
    //   겹치지 않는 범위도 항상 병합하여 중복 사이의 수학식·본문을 통째로 삭제했음.
    toRemove.sort((a,b)=>b.start-a.start);
    for(let i=toRemove.length-1;i>0;i--){
      if(toRemove[i-1].start<toRemove[i].end){
        toRemove[i-1]={start:Math.min(toRemove[i-1].start,toRemove[i].start),end:Math.max(toRemove[i-1].end,toRemove[i].end),text:toRemove[i-1].text};
        toRemove.splice(i,1);
      }
    }
    for(const rm of toRemove){
      let start=rm.start;
      let end=rm.end;
      // v10.5: 단어 중간 절단 방지 — 제거 범위가 한글 단어를 자르는지 확인
      if(start>0&&/[가-힣]/.test(result[start-1])&&/[가-힣]/.test(result[start])){
        // 제거 범위 시작이 단어 중간 → 앞쪽 마침표/공백까지 확장
        while(start>0&&/[가-힣]/.test(result[start-1])&&result[start-1]!=='.')start--;
      }
      // 앞뒤 공백 정리 (쉼표는 문장 구조이므로 보존)
      while(start>0&&' \n'.includes(result[start-1]))start--;
      while(end<result.length&&' \n'.includes(result[end]))end++;
      // 제거 후 앞뒤 글자가 한글+한글이면 공백 삽입
      const bChar=start>0?result[start-1]:'';
      const aChar=end<result.length?result[end]:'';
      const needSpace=/[가-힣)]/.test(bChar)&&/[가-힣(]/.test(aChar);
      result=result.slice(0,start)+(needSpace?' ':'')+result.slice(end);
      removedCount++;
      console.log(`[_deduplicateSentences] 중복 제거: "${rm.text.slice(0,50)}..."`);
    }
  }
  
  if(removedCount>0){
    result=result.replace(/\n{3,}/g,'\n\n');
    console.log(`[_deduplicateSentences] 총 ${removedCount}개 중복 제거`);
  }
  return result;
}

function insertMathBlocks(s08,s09){
  // First strip any existing math blocks from base text to prevent duplication
  let r=stripMathBlocks(s08);
  const b=parseMathBlocks(s09);
  if(!b.length)return r;
  // Track inserted positions to avoid double-insertion
  const inserted=new Set();
  let successCount=0,failCount=0;
  const failed=[];

  for(const x of b.reverse()){
    const i=fuzzyFindAnchor(r,x.anchor);
    if(i>=0 && !inserted.has(x.anchor)){
      inserted.add(x.anchor);
      const ip=findSentenceEndAfterAnchor(r,i,x.anchor);
      const validIp=_validateInsertionPoint(r,ip);
      r=r.slice(0,validIp)+'\n\n'+x.formula+'\n\n'+r.slice(validIp);
      successCount++;
    }else{
      failCount++;
      failed.push(x);
      console.warn(`수학식 삽입 실패 — ANCHOR 매칭 불가: "${x.anchor.slice(0,50)}..."`);
    }
  }
  // 폴백 1단계: 실패한 수학식을 키워드 기반으로 관련 문단 뒤에 삽입
  let stillFailed=[];
  if(failed.length>0){
    for(const x of failed){
      const kws=(x.formula.match(/[가-힣]{3,}/g)||[]).filter(w=>!['수학식','여기서','예를','들어','이상','이하','경우','하한','상한','값이다','범위'].includes(w));
      let bestIdx=-1,bestScore=0;
      if(kws.length){
        const paras=r.split(/\n\n+/);
        for(let pi=0;pi<paras.length;pi++){
          if(/^【수학식/.test(paras[pi].trim()))continue;
          let score=0;
          for(const kw of kws)if(paras[pi].includes(kw))score++;
          if(score>bestScore){bestScore=score;bestIdx=pi;}
        }
      }
      if(bestIdx>=0&&bestScore>=2){
        const paras=r.split(/\n\n+/);
        r=paras.slice(0,bestIdx+1).join('\n\n')+'\n\n'+x.formula+'\n\n'+paras.slice(bestIdx+1).join('\n\n');
        successCount++;failCount--;
        console.log(`수학식 폴백 삽입: 키워드 ${bestScore}개 매칭 (문단 ${bestIdx})`);
      }else{
        stillFailed.push(x);
      }
    }
  }
  // ★ Bug3 수정: 폴백 2단계(보장 배치) — ANCHOR/키워드 모두 실패해도 드롭하지 않고
  //   수식이 없는 가장 긴 문단들에 분산 삽입하여 생성된 수학식을 모두 반영한다.
  if(stillFailed.length>0){
    const usedIdx=new Set();
    for(const x of stillFailed){
      const paras=r.split(/\n\n+/);
      let bestIdx=-1,bestLen=-1;
      for(let pi=0;pi<paras.length;pi++){
        const p=paras[pi].trim();
        if(/^【수학식/.test(p))continue;        // 수식 문단 제외
        if(p.length<40)continue;                  // 너무 짧은 문단 제외
        if(usedIdx.has(pi))continue;              // 이미 사용한 문단 제외(분산)
        if(p.length>bestLen){bestLen=p.length;bestIdx=pi;}
      }
      // 미사용 적합 문단이 없으면(전부 사용) 가장 긴 비수식 문단 재사용
      if(bestIdx<0){
        for(let pi=0;pi<paras.length;pi++){
          const p=paras[pi].trim();
          if(/^【수학식/.test(p)||p.length<40)continue;
          if(p.length>bestLen){bestLen=p.length;bestIdx=pi;}
        }
      }
      if(bestIdx>=0){
        usedIdx.add(bestIdx);
        r=paras.slice(0,bestIdx+1).join('\n\n')+'\n\n'+x.formula+'\n\n'+paras.slice(bestIdx+1).join('\n\n');
        successCount++;failCount--;
        console.log(`수학식 보장 배치: 문단 ${bestIdx}(${bestLen}자) 뒤 삽입`);
      }else{
        console.warn(`수학식 보장 배치 실패 — 적합 문단 없음: "${x.anchor.slice(0,30)}..."`);
      }
    }
  }
  if(failCount>0){
    App.showToast(`수학식 삽입: ${successCount}개 성공, ${failCount}개 미삽입(적합 위치 없음)`,'warning');
  }else if(successCount>0){
    App.showToast(`수학식 ${successCount}개 삽입 완료`);
  }
  // v10.3: 삽입 후 문장 중복 감지 및 제거
  r=_deduplicateSentences(r);
  // v10.2: 수학식 번호 순차 재정렬 (삽입 순서와 무관하게 위→아래 순서 보장)
  r=renumberMathBlocks(r);
  return r;
}

function buildMermaidPrompt(sid){
  const src=outputs[sid]||'';
  if(!src||src.trim().length<20){
    console.error('[buildMermaidPrompt] 도면 설계 텍스트가 비었음, sid=',sid,'length=',src.length);
    return '도면 설계 텍스트가 비어있어 Mermaid 변환 불가. "장치 도면 설계" 버튼을 다시 눌러주세요.';
  }
  const isDevice=sid==='step_07';
  const isMethod=sid==='step_11';
  
  let rules=`
═══ Mermaid 문법 규칙 (필수!) ═══
graph TD 사용
노드ID는 영문 (A, B, C 또는 server, client 등)
노드 라벨은 대괄호 안에: A["${getDeviceSubject()}(100)"]

★★★ 올바른 Mermaid 문법 예시 ★★★
\`\`\`mermaid
graph TD
    A["${getDeviceSubject()}(100)"]
    B["사용자 단말(200)"]
    C["네트워크(300)"]
    D["데이터베이스(400)"]
    A --> B
    A --> C
    A --> D
\`\`\`

⛔ 잘못된 문법 (절대 금지):
- A["${getDeviceSubject()}(100)"] <--> B["사용자 단말(200)"]  ← <--> 사용 금지!
- 한 줄에 노드 정의와 연결을 함께 쓰지 말 것

✅ 올바른 문법:
- 노드 정의를 먼저, 연결은 나중에
- 연결은 --> 만 사용 (양방향은 A --> B와 B --> A 두 줄로)

★★★ 노드 정의 순서 = 렌더링 배치에 직접 영향 ★★★
- 같은 처리 단계의 노드는 연속 정의하라
- 연결 방향: 데이터/정보 흐름 방향과 일치시키라
  수집부→분석부→결정부→전송부 순이면 A-->B-->C-->D
- 순환 연결(A→B→C→A) 금지 — 단방향 데이터 흐름만 표현
`;
  
  if(isDevice){
    rules+=`
═══ 장치 도면 규칙 ═══
- 노드 라벨에 반드시 참조번호 포함: A["통신부(110)"]
- 참조번호는 숫자만 (100, 110, 120...)
- "~단계", "S숫자" 표현 금지
- "~모듈" 금지 → "~부"로 통일

⛔⛔ 참조번호 중복 절대 금지 ⛔⛔
- 서로 다른 노드가 동일한 참조번호를 가지면 안 된다
- 예: 통신부(110)와 외부(110) → 110 중복! → 오류
- "외부", "외부 서버", "외부 장치" 등 외부 엔티티는 도면 내부에 포함하지 마라
- 도 2 이후의 내부 블록도에서는 해당 장치의 하위 구성요소만 표현
- 외부 연결 대상은 노드로 생성하지 말고, 연결선의 끝점으로만 표현하라

★★ 도면별 계층 규칙 ★★
- 도 1: L1(100, 200, 300...) 장치만
- 도 2 (L1 상세화): L1(100)과 그 L2 하위(110,120,130) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=100, 내부 박스=110,120,130 (100은 프레임으로만)
- 도 3+ (L2 상세화): L2(110)와 그 L3 하위(111,112,113) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=110, 내부 박스=111,112,113 (110은 프레임으로만)
- L4 (L3 상세화): L3(121)과 그 L4 하위(1211,1212) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=121, 내부 박스=1211,1212 (121은 프레임으로만)

★★ 연결관계 규칙 ★★
- 데이터/정보 도면(~정보, ~데이터): 정보 항목은 ${getDeviceSubject()} 입력 데이터 → 상호 화살표 연결 부적절 → 연결선 없이 병렬 배치 (노드 정의만, A --> B 금지)
- 장치 블록도: 데이터 흐름이 있는 구성요소만 --> 연결
- 상위 구성(110)과 하위 구성(111,112,113)을 같은 레벨에 표현 금지
- ★ 순환 연결(A-->B-->C-->A) 절대 금지 — 단방향 흐름만

★★★ 공간배치 → Mermaid 변환 규칙 ★★★
도면 설계에 "데이터흐름" 또는 "공간배치" 섹션이 있으면:
1. 도 1: "허브"로 지정된 노드의 ID를 가장 먼저 정의하라
2. 도 2+: 입력측(데이터 흐름의 시작점) 노드를 가장 먼저 정의하라
3. 데이터 흐름 순서대로 노드를 정의하라 (입력→처리→출력)
4. 같은 행 노드 간 연결이 있으면 반드시 별도 행으로 분리 (겹침 방지)

예시 (허브=서버(100), 행1=서버, 행2=단말+DB):
\`\`\`mermaid
graph TD
    A["서버(100)"]
    B["단말(200)"]
    C["DB(300)"]
    A --> B
    A --> C
\`\`\`

★ 모든 구성요소를 빠짐없이 노드로 포함! ★`;
  } else if(isMethod){
    rules+=`
═══ 방법 도면 규칙 (흐름도) ═══
★★ 핵심 규칙 ★★
① 최외곽 프레임 박스 절대 없음 — 흐름도는 단계 나열이므로 감싸는 박스 불필요
② 단방향 화살표(-->)만 사용 — 양방향(<-->) 절대 금지
③ "시작"과 "종료" 노드 필수 — 첫 단계 앞에 START, 마지막 단계 뒤에 END
④ 숫자만 있는 참조번호(100, 110) 절대 사용 금지

★★ 노드 형식 ★★
- 시작/종료: START(["시작"]), END(["종료"]) — 둥근 사각형
- 단계 노드: A["단계명(S번호)"] — 예: A["데이터 수신 단계(S901)"]
- 조건 분기: D{"조건?"} — 다이아몬드(마름모)

★★ 조건 분기(Decision) 표현 규칙 ★★
- 판단이 필요한 단계는 반드시 다이아몬드 노드로 표현
  예: D{"타겟팅 스코어가 임계값 이상인가?"}
- "예" 분기: D -->|예| E["후속 단계(S번호)"]
- "아니오" 분기: D -->|아니오| F["대안 단계(S번호)"]
- 각 분기는 최종적으로 END에 도달해야 함
- 분기 노드의 ID는 DEC1, DEC2... 사용 권장

★★ 연결 형식 ★★
- START --> A (시작에서 첫 단계)
- A --> B --> C (단계 순서)
- D -->|예| E (조건 분기 — 예)
- D -->|아니오| F (조건 분기 — 아니오)
- Z --> END (마지막 단계에서 종료)
- 모든 화살표는 --> (단방향만)`;
  }
  
  // v10.3: 설계 텍스트에서 실제 도면 번호 추출
  const designFigNums=[];
  const dfRe=/^도\s*(\d+)\s*[:：]/gm;
  let dfm;
  while((dfm=dfRe.exec(src))!==null)designFigNums.push(parseInt(dfm[1]));
  const uniqueDesignFigs=[...new Set(designFigNums)].sort((a,b)=>a-b);
  
  // [C1-3] Layer 1 가드: invention_scope 주입 (Mermaid)
  return `아래 도면 설계를 Mermaid flowchart 코드로 변환하라. 각 도면당 \`\`\`mermaid 블록 1개.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 도면 설계에 기재된 도면: ${uniqueDesignFigs.length}개 (${uniqueDesignFigs.map(n=>'도 '+n).join(', ')})
- mermaid 블록을 정확히 ${uniqueDesignFigs.length}개만 생성하라.
- 도면 설계에 없는 도면의 mermaid 코드를 절대 생성하지 마라.
- 도면 설계에 있는 모든 도면을 빠짐없이 변환하라.

★★★ 구성요소 정합: 도면 설계의 구성요소 명칭과 참조번호를 그대로 사용하라. 임의 변경 금지. ★★★

${rules}

═══ 출력 형식 ═══
각 도면마다 (${uniqueDesignFigs.map(n=>'도 '+n).join(' → ')} 순서):
\`\`\`mermaid
graph TD
    노드정의들...
    연결들...
\`\`\`

${src}${_maybeScopeGuard(sid+'_mermaid','mermaid')}`;
}

// ═══ 전역 도면 헬퍼 함수 (v5.5 — 3중 복제 제거, 단일 정의) ═══
function _extractRefNum(label,fallback){
  const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
  return match?match[1]:(fallback||'');
}
// ★ 안전한 라벨 정리: 참조번호 제거 후 빈 문자열/1글자 방지 ★
function _safeCleanLabel(label){
  if(!label)return '';
  const cleaned=label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
  if(cleaned.length<=1&&label.length>1)return label.replace(/[()]/g,'').trim();
  return cleaned||label;
}

function _shortenFig1Label(label){
  if(!label)return '';
  const clean=_safeCleanLabel(label);
  if(clean.length<=6)return clean;

  const typeSuffixes=[
    '서버 장치','센서 장치','조명 장치','촬영 장치','통신 장치','제어 장치','단말 장치',
    '사용자 단말','클라이언트 단말','모바일 단말','휴대 단말','관리 서버','인증 서버',
    '데이터베이스','네트워크','클라우드','스토리지','게이트웨이','라우터',
    '서버','단말','장치','모듈','시스템','센서','카메라','스피커','안테나','모니터','디스플레이'
  ];

  for(const sfx of typeSuffixes){
    if(clean.endsWith(sfx)){
      const words=clean.split(/\s+/);
      const sfxWords=sfx.split(/\s+/);
      if(sfxWords.length>=2)return sfx;
      if(words.length>=2){
        const last2=words.slice(-2).join(' ');
        if(last2.length<=10)return last2;
      }
      return sfx;
    }
  }

  const words=clean.split(/\s+/);
  if(words.length>=3){
    const last2=words.slice(-2).join(' ');
    if(last2.length<=10)return last2;
    return words[words.length-1];
  }
  if(words.length===2&&clean.length>10){
    return words[words.length-1];
  }
  return clean;
}
function _isL1RefNum(ref){
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
function _findImmediateParent(refNums){
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

// ═══ Diagram Icon Shape System v3.0 ═══
const DIAGRAM_ICON_REGISTRY=[
  {type:'database',keywords:['데이터베이스','데이터 베이스','db','저장소','스토리지','레포지토리']},
  {type:'cloud',keywords:['네트워크','통신망','인터넷','클라우드','통신 네트워크','네트워크 망']},
  {type:'monitor',keywords:['사용자 단말','단말기','단말 장치','클라이언트 단말','모바일 단말','스마트폰','디바이스','디스플레이 장치','휴대 단말']},
  {type:'server',keywords:['서버','서버 장치','처리 서버','컴퓨팅 장치','컴퓨팅 서버']},
  {type:'sensor',keywords:['센서','감지 장치','센싱','감지 센서','측정 장치','센서 모듈']},
  {type:'antenna',keywords:['안테나','rf 모듈']},
  {type:'document',keywords:[]}, // document는 별도 로직으로 판별 (아래 matchIconShape 참고)
  {type:'camera',keywords:['카메라','촬영 장치','영상 촬영','이미지 센서','촬영 모듈','비전','영상 획득','렌즈']},
  {type:'speaker',keywords:['스피커','음향 출력','오디오 출력','사운드','음성 출력','부저']},
];

// ═══ Shape 매칭 v2.0: 구성요소 vs 정보 분리 ═══
// 핵심 규칙:
// 1. "~부/~장치/~모듈/~유닛" 접미사 → 항상 구성요소 → box (server/sensor 등 예외 있음)
// 2. document shape → "정보 그 자체"일 때만 (수집된 정보, 데이터 항목 등)
//    예: "위치 정보(D1)", "사용자 데이터", "환경 정보" → document
//    반례: "정보수집부(110)", "데이터 처리부", "수집부" → box (구성요소)
const COMPONENT_SUFFIXES=['부','장치','모듈','유닛','기','체','센터','서버','시스템','플랫폼','허브','노드','게이트웨이','컨트롤러','엔진','프로세서','메모리','터미널','스위치'];
const DATA_KEYWORDS=['정보','데이터','로그','리포트','문서','기록','메시지','신호','이력','통계','프로파일','인덱스','맵','테이블','목록','리스트'];

function _shapeKeywordMatch(text,keyword){
  // 2글자 이하 키워드는 단어 경계 체크 (부분 문자열 오매칭 방지)
  // 예: "비전" in "소비전력" → false (경계 체크)
  // 예: "서버" in "GPU 서버" → true
  if(keyword.length<=2){
    const idx=text.indexOf(keyword);
    if(idx<0)return false;
    // 키워드 앞: 시작이거나 공백/특수문자
    const before=idx===0||/[\s\(\)\[\]\/,·]/.test(text[idx-1]);
    // 키워드 뒤: 끝이거나 공백/특수문자/숫자/접미사
    const afterIdx=idx+keyword.length;
    const after=afterIdx>=text.length||/[\s\(\)\[\]\/,·0-9]/.test(text[afterIdx])||COMPONENT_SUFFIXES.some(s=>text.slice(afterIdx).startsWith(s));
    return before&&after;
  }
  return text.includes(keyword);
}

function matchIconShape(label){
  const c=label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
  const cl=c.toLowerCase();
  
  // Step 1: 구성요소 접미사 체크 ("~부", "~장치", "~모듈" 등)
  const isComponent=COMPONENT_SUFFIXES.some(sfx=>c.endsWith(sfx));
  
  // Step 2: 구성요소라도 특정 shape이 명확한 것은 허용
  if(isComponent){
    // 서버, 단말, 카메라 등은 접미사가 있어도 shape 적용 (document 제외)
    for(const s of DIAGRAM_ICON_REGISTRY){
      if(s.type==='document')continue;
      for(const k of s.keywords){if(_shapeKeywordMatch(cl,k))return s.type;}
    }
    return 'box'; // 구성요소는 기본 box
  }
  
  // Step 3: 구성요소가 아닌 경우 → 일반 shape 매칭
  for(const s of DIAGRAM_ICON_REGISTRY){
    if(s.type==='document')continue;
    for(const k of s.keywords){if(_shapeKeywordMatch(cl,k))return s.type;}
  }
  
  // Step 4: document shape 판별 — "정보 그 자체"인 경우에만
  // 조건: 데이터/정보 키워드 포함 + 구성요소 접미사 없음
  if(DATA_KEYWORDS.some(dk=>cl.includes(dk))){
    return 'document';
  }
  
  return 'box';
}

// ── Cloud SVG path generator ──
function _cloudPathD(x,y,w,h){
  return `M${x+w*0.2},${y+h*0.82} `+
    `C${x+w*0.02},${y+h*0.84} ${x},${y+h*0.44} ${x+w*0.18},${y+h*0.36} `+
    `C${x+w*0.1},${y+h*0.08} ${x+w*0.35},${y} ${x+w*0.48},${y+h*0.16} `+
    `C${x+w*0.58},${y-h*0.01} ${x+w*0.82},${y+h*0.06} ${x+w*0.8},${y+h*0.34} `+
    `C${x+w*0.98},${y+h*0.32} ${x+w},${y+h*0.82} ${x+w*0.8},${y+h*0.82} Z`;
}

// ── Shape shadow SVG ──
function _drawShapeShadow(type,x,y,w,h){
  switch(type){
    case 'database':{
      const ry=Math.min(h*0.18,w*0.15,22);
      return `<ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" fill="#000"/>`+
        `<rect x="${x}" y="${y+ry}" width="${w}" height="${h-2*ry}" fill="#000"/>`+
        `<ellipse cx="${x+w/2}" cy="${y+h-ry}" rx="${w/2}" ry="${ry}" fill="#000"/>`;
    }
    case 'cloud':return `<path d="${_cloudPathD(x,y,w,h)}" fill="#000"/>`;
    case 'server':return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000"/>`;
    case 'monitor':{
      const sh=h*0.72;
      return `<rect x="${x}" y="${y}" width="${w}" height="${sh}" rx="2" fill="#000"/>`+
        `<rect x="${x+w/2-w*0.06}" y="${y+sh}" width="${w*0.12}" height="${h*0.16}" fill="#000"/>`;
    }
    case 'sensor':{
      const cr=Math.min(w*0.28,h*0.38);
      return `<circle cx="${x+w*0.32}" cy="${y+h*0.50}" r="${cr}" fill="#000"/>`;
    }
    case 'antenna':{
      const bw=w*0.20,bh=h*0.12;
      return `<rect x="${x+w/2-bw/2}" y="${y+h-bh}" width="${bw}" height="${bh}" fill="#000"/>`+
        `<line x1="${x+w*0.50}" y1="${y+h*0.18}" x2="${x+w*0.50}" y2="${y+h-bh}" stroke="#000" stroke-width="4"/>`;
    }
    case 'document':{
      const fold=w*0.22;
      return `<path d="M${x},${y} L${x+w-fold},${y} L${x+w},${y+fold} L${x+w},${y+h} L${x},${y+h} Z" fill="#000"/>`;
    }
    case 'camera':{
      return `<rect x="${x}" y="${y+h*0.15}" width="${w*0.85}" height="${h*0.70}" rx="4" fill="#000"/>`;
    }
    case 'speaker':{
      return `<path d="M${x+w*0.10},${y+h*0.30} L${x+w*0.30},${y+h*0.30} L${x+w*0.60},${y+h*0.08} L${x+w*0.60},${y+h*0.92} L${x+w*0.30},${y+h*0.70} L${x+w*0.10},${y+h*0.70} Z" fill="#000"/>`;
    }
    default:return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000"/>`;
  }
}

// ── Shape body SVG ──
function _drawShapeBody(type,x,y,w,h,sw){
  sw=sw||1.5;
  switch(type){
    case 'database':{
      const ry=Math.min(h*0.18,w*0.15,22);
      return `<ellipse cx="${x+w/2}" cy="${y+h-ry}" rx="${w/2}" ry="${ry}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`+
        `<rect x="${x}" y="${y+ry}" width="${w}" height="${h-2*ry}" fill="#fff" stroke="none"/>`+
        `<line x1="${x}" y1="${y+ry}" x2="${x}" y2="${y+h-ry}" stroke="#000" stroke-width="${sw}"/>`+
        `<line x1="${x+w}" y1="${y+ry}" x2="${x+w}" y2="${y+h-ry}" stroke="#000" stroke-width="${sw}"/>`+
        `<ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
    }
    case 'cloud':return `<path d="${_cloudPathD(x,y,w,h)}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
    case 'server':{
      const h3=h/3,dotR=Math.min(3,h*0.07);
      // ★ v10.4: 서버 shape — 텍스트 영역(중앙)에 흰색 배경, 점은 우측에만 ★
      let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      s+=`<line x1="${x}" y1="${y+h3}" x2="${x+w}" y2="${y+h3}" stroke="#000" stroke-width="${sw*0.55}"/>`;
      s+=`<line x1="${x}" y1="${y+2*h3}" x2="${x+w}" y2="${y+2*h3}" stroke="#000" stroke-width="${sw*0.55}"/>`;
      // 점을 오른쪽 상단 모서리에 배치 (텍스트와 겹치지 않도록)
      [0.5,1.5,2.5].forEach(m=>{
        s+=`<circle cx="${x+w-dotR*3}" cy="${y+h3*m}" r="${dotR}" fill="#000"/>`;
      });
      return s;
    }
    case 'monitor':{
      const sh=h*0.72,standW=w*0.12,standH=h*0.14,baseW=w*0.25,baseH=h*0.05;
      const sTop=y+sh+h*0.02,bTop=sTop+standH;
      return `<rect x="${x}" y="${y}" width="${w}" height="${sh}" rx="3" fill="#fff" stroke="#000" stroke-width="${sw}"/>`+
        `<rect x="${x+w/2-standW/2}" y="${sTop}" width="${standW}" height="${standH}" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`+
        `<rect x="${x+w/2-baseW/2}" y="${bTop}" width="${baseW}" height="${baseH}" rx="1" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`;
    }
    case 'sensor':{
      // Circle body (left) + wave arcs (right)
      const cr=Math.min(w*0.28,h*0.38);
      const cx=x+w*0.32, cy=y+h*0.50;
      let s=`<circle cx="${cx}" cy="${cy}" r="${cr}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Inner dot
      s+=`<circle cx="${cx}" cy="${cy}" r="${cr*0.25}" fill="#000"/>`;
      // Wave arcs emanating right
      const arcR=[cr*1.55,cr*2.10,cr*2.65];
      arcR.forEach(r=>{
        const a1=-Math.PI*0.35, a2=Math.PI*0.35;
        const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
        const x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw*0.7}"/>`;
      });
      return s;
    }
    case 'antenna':{
      // Vertical pole + top ball + wave arcs + base
      const poleX=x+w*0.38, topY=y+h*0.18, baseY=y+h*0.82;
      const bw=w*0.22, bh=h*0.10;
      const ballR=Math.min(w*0.04,h*0.04);
      let s='';
      // Base
      s+=`<rect x="${poleX-bw/2}" y="${baseY}" width="${bw}" height="${bh}" rx="2" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Pole
      s+=`<line x1="${poleX}" y1="${topY+ballR}" x2="${poleX}" y2="${baseY}" stroke="#000" stroke-width="${sw*1.2}"/>`;
      // Top ball
      s+=`<circle cx="${poleX}" cy="${topY}" r="${ballR}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Wave arcs (emanating upper-right)
      const arcR=[h*0.16,h*0.26,h*0.36];
      arcR.forEach(r=>{
        const a1=-Math.PI*0.55, a2=-Math.PI*0.05;
        const x1=poleX+r*Math.cos(a1), y1=topY+r*Math.sin(a1);
        const x2=poleX+r*Math.cos(a2), y2=topY+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw*0.7}"/>`;
      });
      return s;
    }
    case 'document':{
      // Page with folded top-right corner
      const fold=w*0.22;
      let s=`<path d="M${x},${y} L${x+w-fold},${y} L${x+w},${y+fold} L${x+w},${y+h} L${x},${y+h} Z" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Fold triangle
      s+=`<path d="M${x+w-fold},${y} L${x+w-fold},${y+fold} L${x+w},${y+fold}" fill="#eee" stroke="#000" stroke-width="${sw*0.6}"/>`;
      // Text lines (decorative)
      const lx1=x+w*0.15, lx2=x+w*0.75, ly0=y+h*0.30, gap=h*0.12;
      for(let i=0;i<3;i++){
        s+=`<line x1="${lx1}" y1="${ly0+gap*i}" x2="${lx2-(i===2?w*0.20:0)}" y2="${ly0+gap*i}" stroke="#bbb" stroke-width="${sw*0.4}"/>`;
      }
      return s;
    }
    case 'camera':{
      // Camera body + lens + viewfinder
      const bx=x+w*0.05, by2=y+h*0.18, bw=w*0.80, bh=h*0.65;
      const lensR=Math.min(bw,bh)*0.32;
      const lcx=bx+bw*0.50, lcy=by2+bh*0.52;
      let s=`<rect x="${bx}" y="${by2}" width="${bw}" height="${bh}" rx="4" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Viewfinder bump
      s+=`<rect x="${bx+bw*0.30}" y="${by2-h*0.10}" width="${bw*0.25}" height="${h*0.12}" rx="2" fill="#fff" stroke="#000" stroke-width="${sw*0.7}"/>`;
      // Lens outer
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Lens inner
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR*0.55}" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`;
      // Lens center dot
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR*0.15}" fill="#000"/>`;
      return s;
    }
    case 'speaker':{
      // Speaker cone + sound wave arcs
      const sw2=sw;
      // Speaker body (trapezoid)
      let s=`<path d="M${x+w*0.10},${y+h*0.30} L${x+w*0.28},${y+h*0.30} L${x+w*0.55},${y+h*0.08} L${x+w*0.55},${y+h*0.92} L${x+w*0.28},${y+h*0.70} L${x+w*0.10},${y+h*0.70} Z" fill="#fff" stroke="#000" stroke-width="${sw2}"/>`;
      // Divider between driver and cone
      s+=`<line x1="${x+w*0.28}" y1="${y+h*0.30}" x2="${x+w*0.28}" y2="${y+h*0.70}" stroke="#000" stroke-width="${sw2*0.6}"/>`;
      // Sound wave arcs
      const waveCx=x+w*0.55, waveCy=y+h*0.50;
      [h*0.22,h*0.34,h*0.46].forEach(r=>{
        const a1=-Math.PI*0.30, a2=Math.PI*0.30;
        const x1=waveCx+r*Math.cos(a1), y1=waveCy+r*Math.sin(a1);
        const x2=waveCx+r*Math.cos(a2), y2=waveCy+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw2*0.7}"/>`;
      });
      return s;
    }
    // [C2-3] container shape: 점선 프레임 (subgraph 부모 노드용)
    case 'container':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#666" stroke-width="${sw}" stroke-dasharray="6,3" rx="4"/>`;
    default:return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
  }
}

function _shapeTextCy(type,y,h){
  // ★ v10.4: 아이콘 shape는 텍스트를 아이콘 아래에 배치 ★
  // 아이콘 shape: 시각적 형상이 전체 영역을 차지 → 텍스트가 겹침
  switch(type){
    case 'sensor':return y+h+12;   // 아이콘 하단 아래
    case 'antenna':return y+h+12;
    case 'camera':return y+h+12;
    case 'speaker':return y+h+12;
    case 'cloud':return y+h*0.50;  // 내부 중앙 (cloud는 내부 공간 충분)
    case 'database':return y+h*0.55;
    case 'monitor':return y+h*0.72*0.45;
    case 'document':return y+h*0.62;
    case 'server':return y+h/2;    // 서버 3분할 중앙
    default:return y+h/2;
  }
}

// ★ v10.4: 아이콘 shape 여부 판별 — 텍스트를 아이콘 아래에 배치해야 하는 shape ★
function _isIconShape(type){
  return type==='sensor'||type==='antenna'||type==='camera'||type==='speaker';
}

// [C2-8a] 박스형 노드의 부호 위치 결정 — 연결선 없는 면 찾기
// 우선순위: top > bottom > right > left (모두 점유되면 bottom 폴백)
function _findEmptySide(nodeId, edges, grid){
  const myPos = grid[nodeId];
  if(!myPos) return 'bottom';
  const sides = { top: true, bottom: true, left: true, right: true };
  edges.forEach(e => {
    if(e.from !== nodeId && e.to !== nodeId) return;
    const otherId = e.from === nodeId ? e.to : e.from;
    const otherPos = grid[otherId];
    if(!otherPos) return;
    // 상대 노드의 상대적 위치로 연결선이 향하는 면 판단
    const dr = otherPos.row - myPos.row;
    const dc = otherPos.col - myPos.col;
    if(Math.abs(dr) >= Math.abs(dc)){
      if(dr < 0) sides.top = false;
      else if(dr > 0) sides.bottom = false;
    } else {
      if(dc < 0) sides.left = false;
      else if(dc > 0) sides.right = false;
    }
  });
  if(sides.top) return 'top';
  if(sides.bottom) return 'bottom';
  if(sides.right) return 'right';
  if(sides.left) return 'left';
  return 'bottom';
}

// ── Shape right edge X for leader line ──
function _shapeLeaderX(type,x,w){
  switch(type){
    case 'cloud':return x+w*0.93;
    case 'sensor':return x+w*0.92;
    case 'antenna':return x+w*0.88;
    case 'speaker':return x+w*0.95;
    case 'monitor':return x+w;
    default:return x+w;
  }
}

// ── v9.1: Shape 시각적 경계 (bounding box ≠ visual bounds) ──
// 연결선 앵커, leader line 시작점에 사용
// [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP=12)
const _ICON_ARROW_GAP=12;
function _shapeVisualBounds(type,x,y,w,h){
  // ★ v10.4: cx/cy는 항상 기하학적 중심점 (라우팅 대칭성 보장) ★
  // 아이콘 shape는 하단에 라벨 영역(~20px) 포함
  const iconTextH=_isIconShape(type)?22:0;
  switch(type){
    case 'cloud':
      return{top:y+h*0.10, bottom:y+h*0.82, left:x+w*0.08, right:x+w*0.92, cx:x+w/2, cy:y+h*0.45};
    case 'database':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'monitor':{
      // [C2-9-fix] monitor visual cy 보정 (server와 일치)
      // bottom을 y+h로 확장하여 _vCy=h/2가 server/box 등 다른 박스형과 동일
      // → 같은 row에서 monitor↔server/box 화살표 직선화 (꺾임 0)
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    }
    case 'server':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'sensor':{
      // [C2-8a-fix-3] 파형 호 실제 렌더 범위 반영 — 호 각도 ±0.35π, R_max=cr*2.65
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const cr=Math.min(w*0.28,h*0.38);
      const waveCx=x+w*0.32, waveCy=y+h*0.50;
      const Rmax=cr*2.65;
      const sinA=Math.sin(Math.PI*0.35);
      return{top:waveCy-Rmax*sinA-_ICON_ARROW_GAP, bottom:waveCy+Rmax*sinA,
        left:waveCx-cr, right:waveCx+Rmax,
        cx:x+w/2, cy:y+h/2};
    }
    case 'antenna':{
      // [C2-8a-fix-3] 호 apex at -π/2, bottom에서 라벨 패딩 제거
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const aTopY=y+h*0.18;
      const outerArc=h*0.36;
      const waveTop=aTopY-outerArc;
      const waveRight=x+w*0.38+outerArc*Math.cos(-Math.PI*0.05);
      return{top:Math.min(y+h*0.18,waveTop)-_ICON_ARROW_GAP, bottom:y+h*0.92, left:x+w*0.16, right:Math.max(x+w*0.62,waveRight),
        cx:x+w*0.43, cy:y+h/2};
    }
    case 'document':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'camera':
      // [C2-8a-fix-3] bottom에서 라벨 패딩 제거
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      return{top:y+h*0.08-_ICON_ARROW_GAP, bottom:y+h*0.83, left:x+w*0.05, right:x+w*0.85,
        cx:x+w*0.45, cy:y+h/2};
    case 'speaker':{
      // [C2-8a-fix-3] bottom에서 라벨 패딩 제거, right를 호 최대값(angle 0)으로
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const spWaveRight=x+w*0.55+h*0.46;
      return{top:y+h*0.08-_ICON_ARROW_GAP, bottom:y+h*0.92, left:x+w*0.10, right:Math.max(x+w*0.55,spWaveRight),
        cx:x+w*0.35, cy:y+h/2};
    }
    default:
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
  }
}

// ═══ v10.1: Shape precise anchor points ═══
// Returns exact {px, py} where a leader line or arrow should touch the shape.
// Unlike _shapeVisualBounds (axis-aligned bounding box), this accounts for
// the actual shape curve at the specific connection direction.
function _shapeAnchor(type,x,y,w,h,dir){
  // ★ v10.4: 모든 shape 앵커를 각 변의 정확한 중앙으로 통일 ★
  // 사용자 요구: "화살표 등 연결 선은 구성의 중앙(가로든 세로든)에 접점을 형성"
  // 원칙: left/right → py = y+h/2 (수직 중앙), top/bottom → px = x+w/2 (수평 중앙)
  // edge 좌표는 shape의 실제 시각적 경계
  
  switch(type){
    case 'cloud':{
      const cy=y+h*0.45; // cloud 수직 중앙은 약간 위
      switch(dir){
        case 'bottom':return{px:x+w/2,   py:y+h*0.82};
        case 'top':   return{px:x+w/2,   py:y+h*0.08};
        case 'left':  return{px:x+w*0.10, py:cy};
        case 'right': return{px:x+w*0.90, py:cy};
      }
      break;
    }
    case 'sensor':{
      // ★ v10.4: 센서 하단 앵커 = 텍스트+참조번호 아래 (겹침 방지) ★
      const cy=y+h/2;
      const cr=Math.min(w*0.28,h*0.38);
      const waveCx=x+w*0.32;
      const waveRight=waveCx+cr*2.65; // 파동호 최외곽
      const leftEdge=waveCx-cr;       // 원 좌측
      const sensorFullBottom=y+h*0.88+42; // 아이콘+라벨+참조번호 전체 하단
      switch(dir){
        case 'bottom':return{px:x+w/2, py:sensorFullBottom};
        case 'top':   return{px:x+w/2, py:y+h*0.12};
        case 'left':  return{px:leftEdge, py:cy};
        case 'right': return{px:Math.min(waveRight, x+w*0.92), py:cy};
      }
      break;
    }
    case 'antenna':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.92};
        case 'top':   return{px:x+w/2, py:y+h*0.10};
        case 'left':  return{px:x+w*0.16, py:cy};
        case 'right': return{px:x+w*0.70, py:cy};
      }
      break;
    }
    case 'camera':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.83};
        case 'top':   return{px:x+w/2, py:y+h*0.08};
        case 'left':  return{px:x+w*0.05, py:cy};
        case 'right': return{px:x+w*0.85, py:cy};
      }
      break;
    }
    case 'speaker':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.92};
        case 'top':   return{px:x+w/2, py:y+h*0.08};
        case 'left':  return{px:x+w*0.10, py:cy};
        case 'right': return{px:x+w*0.55, py:cy};
      }
      break;
    }
    // 사각형 계열: 정확한 변 중앙
    case 'database':
    case 'server':
    case 'document':
    case 'monitor':
    default:{
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h};
        case 'top':   return{px:x+w/2, py:y};
        case 'left':  return{px:x,     py:y+h/2};
        case 'right': return{px:x+w,   py:y+h/2};
      }
    }
  }
  return{px:x+w/2,py:y+h}; // fallback
}

// ── Shape natural proportion metrics ──
// ★ v13: 모든 shape를 균일 크기로 정규화 — 아이콘은 장식, 크기는 동일 ★
// 원칙: 어떤 shape도 boxH의 115%를 초과하지 않는다
// 기존: server=boxW*0.85(너비)×sw*0.80(높이) → boxH의 5배 가능 → 심각한 비율 불균형
// v13: 모든 shape의 높이를 boxH 기준 1.0~1.15배로 통일
function _shapeMetrics(type,boxW,boxH){
  const SHAPE_W=boxW*0.80;   // v19: 셀 너비의 80% (기존 65% → Fig 1/Fig 2+ 크기 통일)
  const MAX_SH=boxH*1.15;    // 셀 높이의 최대 115%
  switch(type){
    case 'database':{
      const sw=SHAPE_W*0.80;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.90));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'cloud':{
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.50));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'server':{
      // v13: 서버 높이를 boxH 기준으로 제한 (기존: sw*0.80 → boxH의 5배 가능)
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.45));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'monitor':{
      // v13: 모니터 높이를 boxH 기준으로 제한 (기존: sw*0.70 → boxH의 4배 가능)
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.48));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'sensor':{
      // v13: 센서 크기 정규화 (기존: boxH*1.35×1.70 → 과도한 크기)
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.85));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'antenna':{
      const sw=SHAPE_W*0.70;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*1.10));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'document':{
      const sw=SHAPE_W*0.75;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.85));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'camera':{
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.75));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'speaker':{
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.75));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    default:return{sw:boxW,sh:boxH,dx:0};
  }
}

// v10.3: 텍스트 너비 추정 (한글=폰트크기, 영문=폰트크기*0.6, 공백=폰트크기*0.3)
function _estimateTextWidth(text,fontSize){
  if(!text)return 0;
  let w=0;
  for(let i=0;i<text.length;i++){
    const c=text.charCodeAt(i);
    if(c>=0xAC00&&c<=0xD7AF||c>=0x4E00&&c<=0x9FFF)w+=fontSize; // 한글/한자
    else if(c===32)w+=fontSize*0.3; // 공백
    else w+=fontSize*0.65; // 영문/숫자
  }
  return w;
}

// ★ v10.4: SVG/Canvas 멀티라인 라벨 렌더링 헬퍼 (잘림 완전 제거) ★
function _fitLabelLines(label, maxWidth, baseFontSize, minFontSize){
  // 전체 라벨을 maxWidth 안에 맞추기 위해 폰트 축소 → 줄바꿈 순으로 시도
  // Returns: {lines: string[], fontSize: number}
  if(!label) return {lines:[''],fontSize:baseFontSize};
  const minFS=minFontSize||7;
  
  // 1단계: 폰트 축소만으로 1줄에 맞는지 시도
  let fs=baseFontSize;
  let tw=_estimateTextWidth(label,fs);
  if(tw<=maxWidth) return {lines:[label],fontSize:fs};
  
  // 폰트를 minFS까지 축소해봄
  while(fs>minFS&&tw>maxWidth){fs--;tw=_estimateTextWidth(label,fs);}
  if(tw<=maxWidth) return {lines:[label],fontSize:fs};
  
  // 2단계: 2줄로 분할
  fs=Math.max(baseFontSize-1,minFS);
  const words=label.split(/\s+/);
  
  // 최적 2줄 분할 (양쪽 길이 균형)
  let bestSplit2=_findBestSplit(words,2,fs,maxWidth);
  if(bestSplit2.fits) return {lines:bestSplit2.lines, fontSize:bestSplit2.fontSize};
  
  // 2줄에서 폰트 축소 시도
  for(let tryFs=fs-1;tryFs>=minFS;tryFs--){
    bestSplit2=_findBestSplit(words,2,tryFs,maxWidth);
    if(bestSplit2.fits) return {lines:bestSplit2.lines, fontSize:bestSplit2.fontSize};
  }
  
  // 3단계: 3줄로 분할 (매우 긴 서버명 등)
  fs=Math.max(baseFontSize-1,minFS);
  let bestSplit3=_findBestSplit(words,3,fs,maxWidth);
  if(bestSplit3.fits) return {lines:bestSplit3.lines, fontSize:bestSplit3.fontSize};
  
  // 3줄에서 폰트 축소 시도
  for(let tryFs=fs-1;tryFs>=minFS;tryFs--){
    bestSplit3=_findBestSplit(words,3,tryFs,maxWidth);
    if(bestSplit3.fits) return {lines:bestSplit3.lines, fontSize:bestSplit3.fontSize};
  }
  
  // 4단계: 최소 폰트에서 강제 2줄 분할 (중간점)
  fs=minFS;
  const mid=Math.ceil(label.length/2);
  let splitIdx=label.lastIndexOf(' ',mid);
  if(splitIdx<=0||splitIdx>=label.length-1)splitIdx=mid;
  return {lines:[label.slice(0,splitIdx).trim(),label.slice(splitIdx).trim()],fontSize:fs};
}

// ★ v10.4: 단어 단위 최적 분할 ★
function _findBestSplit(words,numLines,fontSize,maxWidth){
  if(words.length<numLines){
    // 단어 수 < 줄 수 → 글자 단위 분할
    const label=words.join(' ');
    const charsPerLine=Math.ceil(label.length/numLines);
    const lines=[];
    for(let i=0;i<numLines;i++){
      const start=i*charsPerLine;
      const end=Math.min(start+charsPerLine,label.length);
      if(start<label.length)lines.push(label.slice(start,end).trim());
    }
    const maxW=Math.max(...lines.map(l=>_estimateTextWidth(l,fontSize)));
    return{lines:lines.filter(l=>l.length>0), fontSize, fits:maxW<=maxWidth};
  }
  
  // 단어 단위로 줄 수 맞춰 분할 — 각 줄 길이 균형
  if(numLines===2){
    let bestLines=null, bestDiff=Infinity;
    for(let i=1;i<words.length;i++){
      const l1=words.slice(0,i).join(' ');
      const l2=words.slice(i).join(' ');
      const w1=_estimateTextWidth(l1,fontSize);
      const w2=_estimateTextWidth(l2,fontSize);
      const maxW=Math.max(w1,w2);
      const diff=Math.abs(w1-w2);
      if(maxW<=maxWidth&&diff<bestDiff){bestDiff=diff;bestLines=[l1,l2];}
    }
    if(bestLines)return{lines:bestLines, fontSize, fits:true};
    // 못 맞추면 최소 maxW 분할 반환
    let minMaxW=Infinity, fallbackLines=null;
    for(let i=1;i<words.length;i++){
      const l1=words.slice(0,i).join(' ');
      const l2=words.slice(i).join(' ');
      const maxW=Math.max(_estimateTextWidth(l1,fontSize),_estimateTextWidth(l2,fontSize));
      if(maxW<minMaxW){minMaxW=maxW;fallbackLines=[l1,l2];}
    }
    return{lines:fallbackLines||[words.join(' ')], fontSize, fits:false};
  }
  
  if(numLines===3){
    let bestLines=null, bestMaxW=Infinity;
    for(let i=1;i<words.length-1;i++){
      for(let j=i+1;j<words.length;j++){
        const l1=words.slice(0,i).join(' ');
        const l2=words.slice(i,j).join(' ');
        const l3=words.slice(j).join(' ');
        const maxW=Math.max(_estimateTextWidth(l1,fontSize),_estimateTextWidth(l2,fontSize),_estimateTextWidth(l3,fontSize));
        if(maxW<bestMaxW){bestMaxW=maxW;bestLines=[l1,l2,l3];}
      }
    }
    if(bestLines)return{lines:bestLines, fontSize, fits:bestMaxW<=maxWidth};
    return{lines:[words.join(' ')], fontSize, fits:false};
  }
  
  return{lines:[words.join(' ')], fontSize, fits:false};
}

function _svgMultiLineLabel(cx, baseY, label, maxWidth, baseFontSize, options){
  // SVG <text> 요소들 반환 (중앙정렬)
  const opt=options||{};
  const fill=opt.fill||'#000';
  const ff=opt.fontFamily||'맑은 고딕,Arial,sans-serif';
  const minFS=opt.minFontSize||7;
  const {lines,fontSize}=_fitLabelLines(label,maxWidth,baseFontSize,minFS);
  
  let svg='';
  const lineH=fontSize+2;
  // 전체 텍스트 블록의 수직 중앙 맞춤
  const totalH=lines.length*lineH;
  const startY=baseY-(totalH/2)+lineH*0.75; // baseline 보정
  lines.forEach((line,i)=>{
    svg+=`<text x="${cx}" y="${startY+i*lineH}" text-anchor="middle" font-size="${fontSize}" font-family="${ff}" fill="${fill}">${App.escapeHtml(line)}</text>`;
  });
  return {svg,fontSize,lineCount:lines.length};
}

function _canvasMultiLineLabel(ctx, cx, cy, label, maxWidth, baseFontSize, options){
  // Canvas에 멀티라인 텍스트 그리기 (중앙정렬)
  const opt=options||{};
  const fill=opt.fill||'#000000';
  const ff=opt.fontFamily||'"맑은 고딕", sans-serif';
  const minFS=opt.minFontSize||7;
  const {lines,fontSize}=_fitLabelLines(label,maxWidth,baseFontSize,minFS);
  
  ctx.fillStyle=fill;
  ctx.font=`${fontSize}px ${ff}`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  
  if(lines.length===1){
    ctx.fillText(lines[0],cx,cy);
  }else{
    const lineH=fontSize+2;
    const totalH=lines.length*lineH;
    const startY=cy-(totalH/2)+lineH/2;
    lines.forEach((line,i)=>{
      ctx.fillText(line,cx,startY+i*lineH);
    });
  }
  return {fontSize,lineCount:lines.length};
}

// ═══ 도면 규칙 위반 시 자동 재생성 ═══
async function regenerateDiagramWithFeedback(sid){
  if(globalProcessing){App.showToast('다른 작업 진행 중...','error');return;}
  const stepId=sid==='step_07'?'step_07':'step_11';
  const btnId=sid==='step_07'?'btnStep07':'btnStep11';
  
  // 기존 도면 설계 가져오기
  const prevDesign=outputs[stepId]||'';
  if(!prevDesign){
    App.showToast('재생성할 도면 설계가 없습니다.','error');
    return;
  }
  
  // ★ v18: 검증이 안 됐으면 자동 실행 후 에러 수집 ★
  if(!window._diagramErrors||window._diagramErrors.sid!==sid){
    const data=diagramData[sid];
    if(data&&data.length){
      const autoFigNums=getAutoFigNums(sid);
      const designText=outputs[sid]||'';
      const autoErrors=[];
      data.forEach(({nodes,edges},idx)=>{
        const figNum=autoFigNums[idx]||(idx+1);
        const issues=validateDiagramRules(nodes,figNum,designText,edges);
        issues.filter(i=>i.severity==='ERROR'||i.severity==='WARNING').forEach(i=>{
          autoErrors.push(`도 ${figNum}: [${i.rule}] ${i.message}`);
        });
      });
      if(autoErrors.length){
        window._diagramErrors={sid, errors:autoErrors.join('\n')};
      }
    }
  }
  const errors=window._diagramErrors&&window._diagramErrors.sid===sid?window._diagramErrors.errors:'사용자 요청에 의한 재생성';
  const aiReview=window._aiDiagramReview&&window._aiDiagramReview.sid===sid?window._aiDiagramReview.review:'';
  
  // 방법/장치 분기
  const isMethod=stepId==='step_11';
  
  // ★ v15: 에러 유형별 타겟 피드백 생성 ★
  const errStr=typeof errors==='string'?errors:JSON.stringify(errors);
  const hasRefNumErr=/부호|참조번호|계층|L[1-4]|R[1-6]/.test(errStr);
  const hasConnectionErr=/연결|화살표|순환|방향|교차/.test(errStr);
  const hasLayoutErr=/배치|레이아웃|겹침|위치|overlap/i.test(errStr);
  const hasFigCountErr=/도면\s*수|불일치|count/.test(errStr);

  // ★ Bug2 수정: 재생성 시 도면 수가 줄어드는 문제 — 명시적 개수/번호 지시 + 이전 설계 충분히 제공
  let _figCountBlock='';
  if(stepId==='step_07'){
    const _tf=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const _gc=Math.max(_tf-requiredFigures.length,0);
    const _en=computeFigNums(_gc,0).device;
    _figCountBlock=`\n═══ 도면 수 (절대 준수 — 누락/추가 금지) ═══\n- 정확히 ${_gc}개의 도면을 생성하라: ${_en.map(n=>'도 '+n).join(', ')}\n- 위 번호의 도면을 하나도 빠뜨리지 말고 모두 생성하라. ${_gc}개보다 적게 생성하지 마라.\n`;
  }else if(stepId==='step_11'){
    const _mc=parseInt(document.getElementById('optMethodFigures')?.value||2);
    const _dc=diagramData.step_07?.length||0;
    const _en=computeFigNums(_dc,_mc,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides()).method;
    _figCountBlock=`\n═══ 도면 수 (절대 준수 — 누락/추가 금지) ═══\n- 정확히 ${_mc}개의 방법 도면을 생성하라: ${_en.map(n=>'도 '+n).join(', ')}\n- 위 번호의 도면을 하나도 빠뜨리지 말고 모두 생성하라. ${_mc}개보다 적게 생성하지 마라.\n`;
  }

  // 피드백 프롬프트 생성
  const feedbackPrompt=`이전에 생성한 ${isMethod?'방법':'장치'} 도면 설계에 규칙 위반이 발견되었습니다. 아래 오류를 수정하여 다시 생성하세요.
${_figCountBlock}
═══ 발견된 오류 ═══
${errors}
${aiReview?`\n═══ AI 연결관계 검증 결과 ═══\n${aiReview}\n`:''}
═══ 핵심 규칙 리마인더 ═══
${isMethod?`[방법 도면 규칙]
- 흐름도 형식: 시작 → 단계들 → 종료
- 참조번호: S301, S302... (S+숫자)
- 단방향 화살표만 사용
- 최외곽 박스 없음
- 시작/종료 노드 필수`:`[장치 도면 규칙]
[R1] 도면부호 계층: L1(X00), L2(XY0), L3(XYZ), L4(XYZW)
[R5] 도 1: L1 장치만 허용 (100, 200, 300...). L2/L3(110, 111...) 절대 금지
[R6] 도 2+: 하나의 상위 장치만 상세화
     - 내부가 L2(110,120,130)이면 최외곽은 L1(100)
     - 내부가 L3(111,112,113)이면 최외곽은 L2(110)
     - 내부가 L4(1211,1212)이면 최외곽은 L3(121)`}

★★ 연결관계 규칙 ★★
- 데이터/정보 도면: 정보 항목은 ${getDeviceSubject()} 입력용이므로 상호 간 화살표 연결 부적절 → 병렬 배치
- 장치 블록도: 기술적 데이터 흐름이 있으면 화살표 연결
- 상위+하위 구성이 같은 레벨에 표현 금지 → 하위는 상위 내부에 포함
- ★ 순환 연결(A→B→C→A) 금지 — 데이터 흐름은 단방향이어야 함
- ★ 도 2+: 데이터 흐름의 입력측→처리→출력측 순서로 구성요소를 배치하라
${hasConnectionErr?`
★★ [연결관계 오류 집중 수정 지침] ★★
- 각 구성요소 간 데이터 흐름 방향을 재검토하라
- 양방향 화살표가 있으면 주(主) 데이터 흐름 방향만 남겨라
- 허브 노드(가장 많은 연결)는 중앙에 배치하여 교차를 줄여라
- 구성요소 간 관계가 없으면 화살표를 제거하라 (병렬 배치)`:''}
${hasRefNumErr?`
★★ [참조번호/계층 오류 집중 수정 지침] ★★
- 각 도면의 구성요소 참조번호가 올바른 계층에 있는지 재확인하라
- 도 1은 반드시 L1(100,200,300...) 장치만 포함
- 도 2+는 하나의 상위 장치를 상세화: 상위 L1 → 내부 L2(110,120,...)`:''}
${hasLayoutErr?`
★★ [배치 최적화 지침] ★★
- 연결이 많은 구성요소를 중앙에 배치하라
- 연결된 구성요소끼리 인접하게 배치하라
- 데이터 흐름: 왼쪽→오른쪽 또는 위→아래 방향으로 자연스럽게 배치`:''}

═══ 이전 도면 설계 (오류 포함 — 도면 수는 유지하고 오류만 수정) ═══
${prevDesign.slice(0,8000)}

위 오류를 모두 수정하여 도면 설계를 다시 출력하세요. ★ 도면 개수는 위 "도면 수" 지시를 절대 준수하라.
${isMethod?'방법 흐름도는 시작/종료 노드를 반드시 포함!':'도 1에는 반드시 L1 장치만 포함해야 합니다!'}
${!isMethod?_buildClaimComponentHierarchy(outputs.step_06||''):''}
[장치 청구범위] ${(outputs.step_06||'').slice(0,2000)}`;

  setGlobalProcessing(true);
  const btnEl=document.getElementById(btnId);
  if(btnEl)App.setButtonLoading(btnId,true);
  
  try{
    const r1=await App.callClaude(feedbackPrompt);
    let regenDesign=r1.text;
    
    // ★ Bug2 수정: 재생성 후 도면 수 검증 — 부족 시 1회 재요청(누락 명시), 초과 시 트림 ★
    if(stepId==='step_07'){
      const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _genCount=Math.max(totalFig-requiredFigures.length,0);
      const _expectedNums=computeFigNums(_genCount,0).device;
      let _actual=_extractFigureNumbersFromDesign(regenDesign);
      if(_actual.length<_genCount){
        const missing=_expectedNums.filter(n=>!_actual.includes(n));
        const reReq=`방금 생성한 도면 설계에 도면이 누락되었습니다(${_actual.length}/${_genCount}개). 반드시 ${_genCount}개 도면(${_expectedNums.map(n=>'도 '+n).join(', ')})을 모두 포함하여 전체 도면 설계를 다시 출력하세요. 누락된 ${missing.map(n=>'도 '+n).join(', ')}을 빠뜨리지 마세요.\n\n[기존 설계]\n${regenDesign.slice(0,8000)}`;
        try{const rr=await App.callClaude(reReq);if(_extractFigureNumbersFromDesign(rr.text).length>_actual.length){regenDesign=rr.text;_actual=_extractFigureNumbersFromDesign(regenDesign);}}catch(e){console.warn('[regenDiagram] 도면 보충 재요청 실패',e);}
      }
      const postIssues=validateDiagramDesignText(regenDesign,_genCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치')))regenDesign=_trimDesignTextToExpectedFigures(regenDesign,_expectedNums);
      if(_extractFigureNumbersFromDesign(regenDesign).length<_genCount)App.showToast(`⚠ 도면이 ${_genCount}개보다 적게 생성됨 — 다시 시도해 주세요`,'warning');
    }else if(stepId==='step_11'){
      const _methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
      const _devCount=diagramData.step_07?.length||0;
      const _expectedNums=computeFigNums(_devCount,_methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides()).method;
      let _actual=_extractFigureNumbersFromDesign(regenDesign);
      if(_actual.length<_methFigCount){
        const missing=_expectedNums.filter(n=>!_actual.includes(n));
        const reReq=`방금 생성한 방법 도면 설계에 도면이 누락되었습니다(${_actual.length}/${_methFigCount}개). 반드시 ${_methFigCount}개 도면(${_expectedNums.map(n=>'도 '+n).join(', ')})을 모두 포함하여 다시 출력하세요. 누락된 ${missing.map(n=>'도 '+n).join(', ')}을 빠뜨리지 마세요.\n\n[기존 설계]\n${regenDesign.slice(0,8000)}`;
        try{const rr=await App.callClaude(reReq);if(_extractFigureNumbersFromDesign(rr.text).length>_actual.length){regenDesign=rr.text;_actual=_extractFigureNumbersFromDesign(regenDesign);}}catch(e){console.warn('[regenDiagram] 방법도면 보충 재요청 실패',e);}
      }
      const postIssues=validateDiagramDesignText(regenDesign,_methFigCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치')))regenDesign=_trimDesignTextToExpectedFigures(regenDesign,_expectedNums);
    }
    
    pushOutputHistory(stepId,'llm','regenerateDiagramWithFeedback');
    outputs[stepId]=regenDesign;
    const resEl=document.getElementById(stepId==='step_07'?'resStep07':'resStep11');
    if(resEl)resEl.value=regenDesign;
    saveProject(true);
    
    // Mermaid 변환
    const mermaidPrompt=buildMermaidPrompt(stepId);
    const r2=await App.callClaude(mermaidPrompt);
    pushOutputHistory(stepId+'_mermaid','llm','regenerateDiagramWithFeedback.mermaid');
    outputs[stepId+'_mermaid']=r2.text;
    renderDiagrams(stepId,r2.text);
    
    App.showToast('도면이 규칙에 맞게 재생성되었습니다.');
  }catch(e){
    App.showToast('재생성 실패: '+e.message,'error');
  }finally{
    if(btnEl)App.setButtonLoading(btnId,false);
    setGlobalProcessing(false);
  }
}

// ═══ 도면 설계 텍스트 사전 검증 ═══
function validateDiagramDesignText(text,expectedCount,expectedNums){
  const issues=[];
  
  // 1. 도면 수 검증 — 설계 텍스트에서 실제 도면 수 추출
  const figHeaders=(text.match(/^도\s*(\d+)\s*[:：]/gm)||[]);
  const actualFigNums=figHeaders.map(h=>parseInt(h.match(/\d+/)[0]));
  const uniqueFigNums=[...new Set(actualFigNums)].sort((a,b)=>a-b);
  
  if(expectedCount&&uniqueFigNums.length!==expectedCount){
    issues.push({
      severity:'ERROR',
      message:`도면 수 불일치: 설계 ${uniqueFigNums.length}개 (${uniqueFigNums.map(n=>'도 '+n).join(', ')}) ≠ 예상 ${expectedCount}개${expectedNums?' ('+expectedNums.map(n=>'도 '+n).join(', ')+')':''}`
    });
  }
  
  // 2. 도면 번호 검증 — 예상 번호와 일치하는지
  if(expectedNums&&expectedNums.length>0){
    const missing=expectedNums.filter(n=>!uniqueFigNums.includes(n));
    const extra=uniqueFigNums.filter(n=>!expectedNums.includes(n));
    if(missing.length>0){
      issues.push({
        severity:'ERROR',
        message:`누락된 도면: ${missing.map(n=>'도 '+n).join(', ')}. 이 도면 번호를 반드시 포함하라.`
      });
    }
    if(extra.length>0){
      issues.push({
        severity:'ERROR',
        message:`초과 생성된 도면: ${extra.map(n=>'도 '+n).join(', ')}. 예상 도면(${expectedNums.map(n=>'도 '+n).join(', ')})만 생성하라.`
      });
    }
  }
  
  // 3. 도면별 검증
  const figPattern=/도\s*(\d+)\s*[:：]\s*(.*?)(?=\n도\s*\d+\s*[:：]|---BRIEF|$)/gs;
  let match;
  
  while((match=figPattern.exec(text))!==null){
    const figNum=parseInt(match[1]);
    const content=match[2];
    
    // 참조번호 추출
    const refs=(content.match(/\((\d+)\)/g)||[]).map(r=>parseInt(r.replace(/[()]/g,'')));
    
    if(figNum===1||(expectedNums&&expectedNums[0]===figNum)){
      // 도 1 (또는 첫 번째 도면) 검증: L1만 허용
      const nonL1=refs.filter(r=>r%100!==0);
      if(nonL1.length>0){
        issues.push({
          severity:'ERROR',
          message:`도 ${figNum} (시스템 구성도)에 L2/L3 참조번호 포함: ${nonL1.join(', ')}. 도 ${figNum}은 L1(X00)만 허용.`
        });
      }
    }
    
    // ~모듈 사용 검증
    if(content.includes('모듈')){
      issues.push({
        severity:'WARNING',
        message:`도 ${figNum} 설계에 "~모듈" 사용. "~부"로 변경 필요.`
      });
    }
    
    // 도 2+ 내부 구성요소 최소 3개 검증
    if(figNum>1||(!expectedNums||expectedNums[0]!==figNum)){
      const innerRefs=refs.filter(r=>r%100!==0);
      if(innerRefs.length>0&&innerRefs.length<3){
        issues.push({
          severity:'WARNING',
          message:`도 ${figNum} 내부 구성요소 ${innerRefs.length}개(최소 3개 권장). 청구항에서 추가 구성요소를 포함하거나 기능 분리를 고려하라.`
        });
      }
    }
  }
  
  // 4. BRIEF_DESCRIPTIONS 존재 검증
  if(!text.includes('---BRIEF_DESCRIPTIONS---')){
    issues.push({
      severity:'WARNING',
      message:'도면의 간단한 설명(---BRIEF_DESCRIPTIONS---) 섹션이 누락됨.'
    });
  }
  
  // 5. ★ 청구항 ↔ 도면 구성요소 교차검증 ★
  const claimText=outputs.step_06||'';
  if(claimText){
    const claimComps=_extractStructuredComponents(claimText);
    const designComps=_extractStructuredComponents(text);
    
    if(claimComps.length>0&&designComps.length>0){
      // 5a. 청구항에 있는데 도면에 없는 구성요소 (참조번호 기준)
      const designRefNums=new Set(designComps.map(c=>c.refNum));
      const missingInDesign=claimComps.filter(c=>!designRefNums.has(c.refNum)&&c.refNum%100!==0);
      // L1(X00)은 도 1에 이미 있으므로 제외, L2/L3만 체크
      if(missingInDesign.length>0){
        issues.push({
          severity:'WARNING',
          message:`청구항 구성요소 중 도면에 누락: ${missingInDesign.map(c=>c.name+'('+c.refNum+')').join(', ')}. 도면에 반영 필요.`
        });
      }
      
      // 5b. 도면에 있는데 청구항에 없는 구성요소 (L2/L3, 도 1 외부장치 제외)
      const claimRefNums=new Set(claimComps.map(c=>c.refNum));
      const extraInDesign=designComps.filter(c=>!claimRefNums.has(c.refNum)&&c.refNum%100!==0);
      if(extraInDesign.length>0){
        // L1 외부장치(200,300,400)는 도 1에서 허용되므로 제외
        const trueExtras=extraInDesign.filter(c=>!(c.refNum>=200&&c.refNum%100===0));
        if(trueExtras.length>0){
          issues.push({
            severity:'WARNING',
            message:`도면에 청구항에 없는 구성요소: ${trueExtras.map(c=>c.name+'('+c.refNum+')').join(', ')}. 청구항과 일치시킬 것.`
          });
        }
      }
      
      // 5c. 참조번호는 같은데 이름이 다른 구성요소
      const claimMap=new Map(claimComps.map(c=>[c.refNum,c.name]));
      const nameMismatches=[];
      for(const dc of designComps){
        const claimName=claimMap.get(dc.refNum);
        if(claimName&&claimName!==dc.name){
          // 이름이 완전히 다른 경우만 (부분 포함 제외)
          if(!claimName.includes(dc.name)&&!dc.name.includes(claimName)){
            nameMismatches.push({refNum:dc.refNum,claim:claimName,design:dc.name});
          }
        }
      }
      if(nameMismatches.length>0){
        issues.push({
          severity:'ERROR',
          message:`구성요소 명칭 불일치: ${nameMismatches.map(m=>`(${m.refNum}) 청구항="${m.claim}" ≠ 도면="${m.design}"`).join(', ')}. 청구항 명칭을 사용하라.`
        });
      }
    }
  }
  
  return issues;
}

// ★ 구조적 구성요소 추출 (청구항/도면 텍스트 공용) ★
function _extractStructuredComponents(text){
  if(!text)return [];
  const comps=[];
  const seen=new Set();
  const re=/([가-힣A-Za-z]*(?:부|모듈|유닛|서버|장치|단말|센서|프로세서|메모리|인터페이스|엔진|매니저|시스템|플랫폼|컨트롤러|네트워크|데이터베이스|스토리지|게이트웨이))\s*\((\d{2,4})\)/g;
  let m;
  while((m=re.exec(text))!==null){
    const name=m[1].trim();
    const refNum=parseInt(m[2]);
    const key=`${name}_${refNum}`;
    if(!seen.has(key)){
      seen.add(key);
      comps.push({name,refNum});
    }
  }
  return comps;
}

