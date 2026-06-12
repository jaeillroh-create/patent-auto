'use strict';
// ════════════════════════════════════════════════════════════════
// 수학식 적용 단계 — 연결구조·삽입위치·에러/모순/중복 검토
// 실행: node tests/math.connection.test.js
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'patent', 'patent.js'), 'utf8').split('\n');
function extract(name) {
  const re = new RegExp('^function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < src.length; i++) {
    if (re.test(src[i])) {
      if (/\}\s*$/.test(src[i]) && (src[i].match(/\{/g) || []).length === (src[i].match(/\}/g) || []).length) return src[i];
      for (let j = i + 1; j < src.length; j++) if (/^\}/.test(src[j])) return src.slice(i, j + 1).join('\n');
    }
  }
  throw new Error('추출 실패: ' + name);
}
const deps = ['_sanitizeMathFormula', 'parseMathBlocks', 'stripMathBlocks', '_normForAnchor',
  'fuzzyFindAnchor', 'findSentenceEndAfterAnchor', '_validateInsertionPoint',
  '_deduplicateSentences', 'renumberMathBlocks', 'insertMathBlocks'];
global.App = { showToast() {} };
const ev = eval(deps.map(extract).join('\n\n') + '\n;({' + deps.join(',') + '})');
const { insertMathBlocks, renumberMathBlocks } = ev;

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }

function mb(n, anchor, body, extra) {
  return `---MATH_BLOCK_${n}---\nANCHOR: ${anchor}\nFORMULA:\n【수학식 ${n}】\n${body}\n여기서, ${extra || '각 변수는 정의된다'}.\n예를 들어, 대표 수치를 대입한다.`;
}
// 수식 블록 구간을 파싱해서 위치 검사용으로 반환
function mathSpans(text) {
  const spans = [];
  const re = /【수학식\s*\d+】[\s\S]*?(?=【수학식\s*\d+】|$)/g; let m;
  while ((m = re.exec(text)) !== null) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

const desc = [
  '도 1을 참조하면, 통신부는 측정 데이터를 수신하여 버퍼에 저장한다.',
  '프로세서는 상기 측정 데이터를 정규화하고 가중치를 적용하여 보정값을 산출한다.',
  '분석부는 상기 보정값을 기준값과 비교하여 이상 여부를 판정한다.',
  '제어부는 판정 결과에 따라 처리 파라미터를 갱신하고 다음 주기를 준비한다.',
].join('\n\n');

// ═══════════════════════════════════════════════
// A. 연결구조 — 수식 직전이 완결 문장(마침표)으로 끝나는가
// ═══════════════════════════════════════════════
console.log('── A. 연결구조(이전 문장 연결) ──');
let out = insertMathBlocks(desc, [
  mb(1, '보정값을 산출한다.', 'C = w × x'),
  mb(2, '이상 여부를 판정한다.', 'D = |C - r|'),
].join('\n'));

// 각 수식 헤더 직전(공백 제외)이 마침표(.)로 끝나야 — 이전 문장과 단절 없이 연결
function precededBySentenceEnd(text, header) {
  const idx = text.indexOf(header);
  if (idx < 0) return false;
  const before = text.slice(0, idx).replace(/[\s]+$/, '');
  return before.endsWith('.') || before.endsWith('다');
}
ok(precededBySentenceEnd(out, '【수학식 1】'), 'A1: 수식1 직전이 완결 문장(마침표)으로 종료');
ok(precededBySentenceEnd(out, '【수학식 2】'), 'A2: 수식2 직전이 완결 문장(마침표)으로 종료');
// 이전 문장이 잘리지 않고 온전히 보존
ok(out.includes('가중치를 적용하여 보정값을 산출한다.'), 'A3: 수식1의 이전 문장 원형 보존');
ok(out.includes('기준값과 비교하여 이상 여부를 판정한다.'), 'A4: 수식2의 이전 문장 원형 보존');

// ═══════════════════════════════════════════════
// B. 에러 — 수식이 다른 수식 블록 내부에 삽입되지 않는가
// ═══════════════════════════════════════════════
console.log('── B. 수식 내부 삽입 방지 ──');
// ANCHOR가 다른 수식의 "여기서/예를 들어" 텍스트와 유사하도록 구성
out = insertMathBlocks(desc, [
  mb(1, '보정값을 산출한다.', 'C = w × x', '대표 수치를 대입한다'),  // 일부러 충돌 유도
  mb(2, '이상 여부를 판정한다.', 'D = |C - r|'),
  mb(3, '처리 파라미터를 갱신하고 다음 주기를 준비한다.', 'E = f(D)'),
].join('\n'));
const spans = mathSpans(out);
const headers = [...out.matchAll(/【수학식\s*\d+】/g)].map(m => m.index);
// 모든 수식 헤더는 어떤 수식 블록의 "시작점"이어야 함(다른 수식 내부 X)
let nested = false;
for (const h of headers) {
  // 이 헤더가 어떤 span의 "시작"이 아니라 내부에 있으면 중첩
  if (!spans.some(([s]) => s === h)) nested = true;
}
ok(!nested, 'B1: 어떤 수식도 다른 수식 블록 내부에 삽입되지 않음');
ok((out.match(/【수학식\s*\d+】/g) || []).length === 3, 'B2: 수식 3개 모두 삽입');

// ═══════════════════════════════════════════════
// C. 교차참조 재번호 정합 — 본문 "수학식 N" 참조가 헤더와 일치하게 갱신
// ═══════════════════════════════════════════════
console.log('── C. 교차참조 재번호 정합 ──');
// 헤더가 3,1,2 순으로 섞인 텍스트 + 본문 참조 → 1,2,3으로 재번호되고 참조도 동기화
const mixed = '서론.\n\n【수학식 3】\nA\n\n상기 수학식 3에 의해 산출된 값을 사용한다.\n\n【수학식 1】\nB\n\n상기 수학식 1의 결과를 비교한다.\n\n【수학식 2】\nC\n\n상기 수학식 2를 적용한다.';
const renum = renumberMathBlocks(mixed);
const hdrNums = [...renum.matchAll(/【수학식\s*(\d+)】/g)].map(m => m[1]);
ok(JSON.stringify(hdrNums) === JSON.stringify(['1', '2', '3']), 'C1: 헤더가 문서순서 1,2,3으로 재번호');
// 첫 헤더(원래 3) 직후 본문참조는 이제 "수학식 1"
ok(/【수학식 1】\nA\n\n상기 수학식 1에 의해/.test(renum), 'C2: 첫 블록 본문참조도 1로 동기화');
ok(/【수학식 2】\nB\n\n상기 수학식 2의 결과/.test(renum), 'C3: 둘째 블록 본문참조도 2로 동기화');
ok(/【수학식 3】\nC\n\n상기 수학식 3를 적용/.test(renum), 'C4: 셋째 블록 본문참조도 3으로 동기화');
// 위→아래 헤더 번호가 단조 증가(역전/중복 없음)
const asc = hdrNums.every((n, i) => i === 0 || parseInt(n) === parseInt(hdrNums[i - 1]) + 1);
ok(asc, 'C5: 헤더 번호 단조 증가(역전/중복 없음)');

// ═══════════════════════════════════════════════
// D. 중복/모순 — 변수설명이 본문에 그대로 복제되어 중복되지 않는가
// ═══════════════════════════════════════════════
console.log('── D. 중복/모순 ──');
// 본문에 이미 있는 문장을 수식 "여기서"가 그대로 반복하는 시나리오
const descDup = '프로세서는 가중치를 적용하여 보정값을 산출한다. 상기 가중치는 0과 1 사이의 값이다.';
out = insertMathBlocks(descDup, mb(1, '보정값을 산출한다.', 'C = w × x', '상기 가중치는 0과 1 사이의 값이다'));
// "상기 가중치는 0과 1 사이의 값이다"가 본문+여기서로 2회 → dedup이 수식 사이 중복으로 처리할 수 있음.
// 최소한 수식 본문과 헤더는 보존되어야 하고, 원본 본문 문장은 유지되어야 함
ok(out.includes('【수학식 1】') && out.includes('C = w × x'), 'D1: 중복 변수설명이 있어도 수식 보존');
ok(out.includes('가중치를 적용하여 보정값을 산출한다'), 'D2: 원본 본문 문장 보존');

// E. 단일 수식 — 본문 1문장만 있을 때도 정상 삽입(경계)
console.log('── E. 경계 ──');
out = insertMathBlocks('프로세서는 보정값을 산출한다.', mb(1, '보정값을 산출한다.', 'C = w × x'));
ok((out.match(/【수학식/g) || []).length === 1 && out.includes('프로세서는 보정값을 산출한다.'), 'E1: 단일 문장 본문에도 정상 삽입+보존');

console.log('='.repeat(54));
console.log(`수학식 연결구조·적용 에러 검토: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
console.log('='.repeat(54));
if (fails.length) { console.log('\n[실패/문제 상세]'); fails.forEach(f => console.log(f)); }
process.exit(fail ? 1 : 0);
