'use strict';
// ════════════════════════════════════════════════════════════════
// patent.js 도형 생성 핵심 순수 함수 회귀 테스트
// 실행: node tests/diagram.test.js
// patent.js에서 함수 소스를 "이름 기반"으로 추출하여 실제 코드를 검증한다.
// (라인번호 의존이 아니므로 patent.js 편집에 견고함)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const PATENT_JS = path.join(__dirname, '..', 'patent', 'patent.js');
const src = fs.readFileSync(PATENT_JS, 'utf8');
const lines = src.split('\n');

// 함수명으로 소스 추출: `function NAME(`을 찾아, 한 줄짜리면 그 줄을,
// 여러 줄이면 다음 `^}`(컬럼0 닫는 중괄호)까지 추출한다.
// (이 파일의 모든 최상위 함수는 컬럼0의 `}`로 종료하는 컨벤션을 따른다)
function extract(name) {
  const startRe = new RegExp('^function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) {
      // 한 줄 정의 (중괄호가 같은 줄에서 닫힘)
      if (/\}\s*$/.test(lines[i]) && lines[i].indexOf('{') !== -1 &&
          (lines[i].match(/\{/g) || []).length === (lines[i].match(/\}/g) || []).length) {
        return lines[i];
      }
      // 여러 줄: 다음 `^}` 까지
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\}/.test(lines[j])) return lines.slice(i, j + 1).join('\n');
      }
    }
  }
  throw new Error('함수 추출 실패: ' + name);
}

const NAMES = [
  'getLastFigureNumber', '_extractFigureNumbersFromDesign', 'computeFigNums',
  '_extractRefNum', '_extractStructuredComponents', 'parseDesignJSON',
  '_autoCorrectOverlaps', '_autoRouteJSON', 'parseMermaidGraph',
];

// 모듈 전역 스텁 (computeFigNums가 참조)
let requiredFigures = [];
const harness = NAMES.map(extract).join('\n\n') + '\n;({' + NAMES.join(',') + '})';
const F = eval(harness);
const { getLastFigureNumber, _extractFigureNumbersFromDesign, computeFigNums,
  _extractRefNum, _extractStructuredComponents, parseDesignJSON,
  _autoCorrectOverlaps, _autoRouteJSON, parseMermaidGraph } = F;

// ── 러너 ──
let pass = 0, fail = 0; const fails = [];
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else { fail++; fails.push(`✗ ${name}\n    기대: ${e}\n    실제: ${a}`); }
}
function ok(cond, name) { if (cond) pass++; else { fail++; fails.push(`✗ ${name}`); } }

// 1. computeFigNums — 도면 번호 산출 (사용자 도면 스킵)
requiredFigures = [];
eq(computeFigNums(4, 0, 0).device, [1,2,3,4], 'computeFigNums: 장치4 → [1,2,3,4]');
eq(computeFigNums(4, 0, 0).lastFig, 4, 'computeFigNums: lastFig=4');
let r = computeFigNums(3, 2, 0);
eq(r.device, [1,2,3], 'computeFigNums: 장치3+방법2 → device[1,2,3]');
eq(r.method, [4,5], 'computeFigNums: → method[4,5]');
eq(r.lastDeviceFig, 3, 'computeFigNums: lastDeviceFig=3');
r = computeFigNums(2, 1, 1);
eq(r.device, [1,2], 'computeFigNums: 개념도 포함 → device[1,2]');
eq(r.concept, [3], 'computeFigNums: → concept[3]');
eq(r.method, [4], 'computeFigNums: → method[4]');
eq(r.lastDeviceFig, 3, 'computeFigNums: 개념도가 lastDeviceFig 갱신 → 3');
requiredFigures = [{num:2}];
eq(computeFigNums(3, 0, 0).device, [1,3,4], 'computeFigNums: 사용자 도2 스킵 → device[1,3,4]');
requiredFigures = [{num:1},{num:3}];
r = computeFigNums(2, 1, 0);
eq(r.device, [2,4], 'computeFigNums: 사용자 도1,3 스킵 → device[2,4]');
eq(r.method, [5], 'computeFigNums: 스킵 후 method[5]');
requiredFigures = [];

// 2. _extractFigureNumbersFromDesign — 헤더 기반 추출
eq(_extractFigureNumbersFromDesign('도 1: 블록도\n도 2: 흐름도\n본문에서 도 5를 참조하면'),
   [1,2], '_extractFigNums: 헤더(도 N:)만, 본문 "도 5 참조" 제외');
eq(_extractFigureNumbersFromDesign('도 1: 블록도\n도 1: 중복헤더\n도 3：전각콜론'),
   [1,3], '_extractFigNums: 중복제거 + 전각 콜론(：)');
eq(_extractFigureNumbersFromDesign(''), [], '_extractFigNums: 빈 입력');
eq(_extractFigureNumbersFromDesign('도 10: 십번\n도 2: 이번'), [2,10], '_extractFigNums: 숫자 정렬');

// 3. getLastFigureNumber
eq(getLastFigureNumber('도 1 ... 도 10 ... 도 3'), 10, 'getLastFigNum: 최대값');
eq(getLastFigureNumber('도면 없음'), 0, 'getLastFigNum: 없으면 0');

// 4. _extractRefNum
eq(_extractRefNum('통신부(110)', ''), '110', '_extractRefNum: 110');
eq(_extractRefNum('데이터 수신 단계(S100)', ''), 'S100', '_extractRefNum: S100');
eq(_extractRefNum('라벨없음', 'XX'), 'XX', '_extractRefNum: fallback');

// 5. _extractStructuredComponents
let comps = _extractStructuredComponents('통신부(110), 프로세서(120), 메모리(130)');
eq(comps.length, 3, '_extractComps: 3개');
eq(comps[0], {name:'통신부', refNum:110}, '_extractComps: 통신부(110)');
comps = _extractStructuredComponents('통신부(110) ... 통신부(110) 재등장');
eq(comps.length, 1, '_extractComps: 중복제거');
comps = _extractStructuredComponents('데이터 분석부(140)');
eq(comps[0] && comps[0].name, '분석부', '_extractComps: 공백 다단어 → 접미 토큰만');

// 6. parseMermaidGraph — 기본
let g = parseMermaidGraph('graph TD\nA["통신부(110)"] --> B["프로세서(120)"]\nB --> C{"이상 판단(130)"}');
eq(g.nodes.length, 3, 'parseMermaid: 노드 3개');
eq(g.edges.length, 2, 'parseMermaid: 엣지 2개');
ok(g.nodes.find(n=>n.id==='C')?.shape==='diamond', 'parseMermaid: C diamond');
ok(g.nodes.find(n=>n.id==='A')?.shape==='rect', 'parseMermaid: A rect');
g = parseMermaidGraph('graph LR\nA["송신부(111)"] -->|데이터 전송| B["수신부(112)"]');
ok(g.edges[0]?.label==='데이터 전송', 'parseMermaid: 엣지 라벨');
g = parseMermaidGraph('graph TD\nA["서버(100)"] --> B["통신부(110)"]\nC["서버(100)"] --> A');
ok(g.nodes.filter(n=>/100/.test(n.label)).length===2, 'parseMermaid: 일반 중복은 병합 안 함');
g = parseMermaidGraph('flowchart TD\nS(["시작(S100)"]) --> P["처리(S110)"]');
ok(g.nodes.find(n=>n.id==='S')?.shape==='stadium', 'parseMermaid: 스타디움');

// ── v15 회귀: 인라인 라벨 엣지 누락 버그 ──
g = parseMermaidGraph('graph TD\nA["통신부(110)"] --> B["프로세서(120)"]');
eq(g.edges.length, 1, 'v15: 인라인 라벨 양쪽 → 엣지 1개 (회귀)');
ok(g.edges[0]?.from==='A' && g.edges[0]?.to==='B', 'v15: 엣지 방향 A→B');
g = parseMermaidGraph('graph LR\nA["송신부(111)"] -->|데이터 전송| B["수신부(112)"]');
eq(g.edges.length, 1, 'v15: 인라인+엣지라벨 → 1개');
eq(g.edges[0]?.label, '데이터 전송', 'v15: 인라인 노드 사이 엣지라벨');
g = parseMermaidGraph('graph TD\nA["입력부(110)"] --> B["처리부(120)"] --> C["출력부(130)"]');
eq(g.edges.length, 2, 'v15: 체인 → 엣지 2개');
ok(g.edges.some(e=>e.from==='A'&&e.to==='B') && g.edges.some(e=>e.from==='B'&&e.to==='C'),
   'v15: 체인 엣지 둘 다');
g = parseMermaidGraph('graph TD\nA["단말(200)"] <--> B["서버(100)"]');
eq(g.edges.length, 1, 'v15: 양방향 엣지 1개');
ok(g.edges[0]?.bidirectional===true, 'v15: bidirectional 플래그');
g = parseMermaidGraph('graph TD\nA["판단부(110)"] --> D{"이상?(120)"}\nD -->|예| B["경보부(130)"]\nD -->|아니오| C["대기부(140)"]');
eq(g.edges.length, 3, 'v15: 조건분기 3엣지');
ok(g.nodes.find(n=>n.id==='D')?.shape==='diamond', 'v15: D diamond');
g = parseMermaidGraph('graph TD\nA["통합 서버(100)"] --> B["통신부(110)"]\nC["외부 서버(100)"] --> A');
eq(g.nodes.filter(n=>/100/.test(n.label)).length, 1, 'v15: "외부" 중복 참조번호 병합');
g = parseMermaidGraph('graph TD\nA["통신부(110)"]\nB["프로세서(120)"]\nA --> B');
eq(g.edges.length, 1, 'v15: 분리정의 후 바 ID 연결 유지');

// 7. parseDesignJSON — JSON 좌표 도면
const vj = '```json\n' + JSON.stringify({figures:[{blocks:[
  {id:'b1',label:'통신부',x:1,y:1,w:1.8,h:0.7,refNum:'110'},
  {id:'b2',label:'프로세서',x:4,y:1,w:1.8,h:0.7,refNum:'120'}],connections:[{from:'b1',to:'b2'}]}]}) + '\n```';
let pj = parseDesignJSON(vj);
ok(pj.success===true, 'parseDesignJSON: 유효 JSON → success');
ok(pj.data.figures[0].connections[0].route?.length>=2, 'parseDesignJSON: route 자동생성');
ok(pj.data.figures[0].connections[0].arrow==='end', 'parseDesignJSON: arrow 기본값 end');
pj = parseDesignJSON('```json\n' + JSON.stringify({blocks:[{id:'x',label:'밖',x:100,y:100,w:1.8,h:0.7}]}) + '\n```');
const cb = pj.data.figures[0].blocks[0];
ok(cb.x<=8.27 && cb.y<=11.69 && cb.x>=0.6 && cb.y>=0.6, 'parseDesignJSON: 좌표 클램핑');
pj = parseDesignJSON('```json\n' + JSON.stringify({blocks:[{id:'a',label:'A',x:1,y:1}]}) + '\n```');
ok(pj.data.figures[0].blocks[0].w===1.8 && pj.data.figures[0].blocks[0].h===0.7, 'parseDesignJSON: w/h 기본값');
pj = parseDesignJSON('그냥 텍스트 응답, JSON 없음');
ok(pj.success===false && pj.fallback==='mermaid', 'parseDesignJSON: JSON 없으면 폴백');
pj = parseDesignJSON('```json\n{"figures":[{"foo":1}]}\n```');
ok(pj.success===false, 'parseDesignJSON: blocks 없으면 폴백');

// 8. _autoCorrectOverlaps
let blocks = [{x:1,y:1,w:2,h:1},{x:1.5,y:1.2,w:2,h:1}];
_autoCorrectOverlaps(blocks);
const a = blocks[0], b = blocks[1];
ok(!(a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y), '_autoCorrectOverlaps: 겹침 해소');

// 9. _autoRouteJSON
let route = _autoRouteJSON({x:0,y:0,w:1,h:1},{x:5,y:0,w:1,h:1});
ok(route.length>=2, '_autoRouteJSON: 수평 경로');
ok(route[0].x===1 && route[route.length-1].x===5, '_autoRouteJSON: 우변→좌변');
route = _autoRouteJSON({x:0,y:0,w:1,h:1},{x:0,y:5,w:1,h:1});
ok(route[0].y===1 && route[route.length-1].y===5, '_autoRouteJSON: 수직 상하');

// ── 결과 ──
console.log('='.repeat(50));
console.log(`도형 생성 구조 테스트: ${pass} 통과 / ${fail} 실패 (총 ${pass+fail})`);
console.log('='.repeat(50));
if (fails.length) { console.log('\n[실패 상세]'); fails.forEach(f => console.log(f)); }
process.exit(fail ? 1 : 0);
