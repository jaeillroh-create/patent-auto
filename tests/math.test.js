'use strict';
// ════════════════════════════════════════════════════════════════
// Bug3 검증: insertMathBlocks 보장 배치 — ANCHOR/키워드 매칭 실패해도
// 생성된 수학식을 드롭하지 않고 모두 삽입하는지 실제 코드로 검증.
// 실행: node tests/math.test.js
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
const bundle = deps.map(extract).join('\n\n') + '\n;({insertMathBlocks})';
const { insertMathBlocks } = eval(bundle);

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }
function countMath(t) { return (t.match(/【수학식\s*\d+】/g) || []).length; }

// 충분히 긴(≥40자) 비수식 문단 6개로 구성된 상세설명
const desc = [
  '도 1을 참조하면, 본 발명의 통신부는 외부 단말로부터 데이터를 수신하여 내부 버퍼에 일시 저장하는 기능을 수행한다.',
  '프로세서는 상기 수신된 데이터에 대하여 전처리 연산을 적용하고 특징값을 추출하여 분석 모듈로 전달하도록 구성된다.',
  '분석 모듈은 추출된 특징값을 기준값과 비교하여 이상 여부를 판정하고 그 결과를 제어부로 출력하는 동작을 수행한다.',
  '제어부는 판정 결과에 따라 보정 계수를 갱신하고 다음 주기의 처리 파라미터를 조정하여 시스템 안정성을 확보한다.',
  '저장부는 처리 이력과 갱신된 파라미터를 누적 기록하여 추후 분석 및 감사 추적이 가능하도록 데이터를 보관한다.',
  '출력부는 최종 산출된 결과를 사용자 단말로 전송하며 시각화에 필요한 메타데이터를 함께 제공하도록 구성된다.',
].join('\n\n');

function mb(n, anchor, formulaBody) {
  return `---MATH_BLOCK_${n}---\nANCHOR: ${anchor}\nFORMULA:\n【수학식 ${n}】\n${formulaBody}\n여기서, 각 변수는 해당 수식 내에서 정의된다.\n예를 들어, 대표 수치를 대입한다.`;
}

// 1) ANCHOR/키워드 모두 매칭 실패 → 보장 배치로 전부 삽입
const noMatch = [
  mb(1, '전혀존재하지아니하는앵커문장하나입니다끝.', 'A = α × β'),
  mb(2, '또다른존재하지아니하는앵커둘입니다종료.', 'B = γ ÷ δ'),
  mb(3, '세번째매칭불가앵커삼입니다완결.', 'C = Σ ε'),
].join('\n');
let out = insertMathBlocks(desc, noMatch);
ok(countMath(out) === 3, `보장배치: ANCHOR 전부 불일치라도 3개 모두 삽입 (실제 ${countMath(out)})`);

// 2) ANCHOR 정확 일치 → 해당 위치 부근 삽입 + 전체 개수 유지
const exact = [
  mb(1, '시스템 안정성을 확보한다.', 'D = a × b'),       // desc 4번째 문단 끝과 일치
  mb(2, '데이터를 보관한다.', 'E = c ÷ d'),               // desc 5번째 문단 끝과 일치
  mb(3, '존재하지않는앵커삼입니다끝.', 'F = e + f'),       // 불일치 → 보장 배치
].join('\n');
out = insertMathBlocks(desc, exact);
ok(countMath(out) === 3, `혼합(일치2+불일치1): 3개 모두 삽입 (실제 ${countMath(out)})`);

// 3) 목표 5개 — 일부만 매칭되어도 5개 전부 삽입
const five = [
  mb(1, '내부 버퍼에 일시 저장하는 기능을 수행한다.', 'G1 = x1'),
  mb(2, '없는앵커A입니다끝.', 'G2 = x2'),
  mb(3, '없는앵커B입니다끝.', 'G3 = x3'),
  mb(4, '없는앵커C입니다끝.', 'G4 = x4'),
  mb(5, '없는앵커D입니다끝.', 'G5 = x5'),
].join('\n');
out = insertMathBlocks(desc, five);
ok(countMath(out) === 5, `목표5: 일부 불일치라도 5개 전부 삽입 (실제 ${countMath(out)})`);

// 4) 동일 ANCHOR 중복 → 둘 다 삽입(하나는 ANCHOR, 하나는 보장 배치)
const dup = [
  mb(1, '시스템 안정성을 확보한다.', 'H1 = p'),
  mb(2, '시스템 안정성을 확보한다.', 'H2 = q'),
].join('\n');
out = insertMathBlocks(desc, dup);
ok(countMath(out) === 2, `중복앵커: 2개 모두 삽입(드롭 없음) (실제 ${countMath(out)})`);

// 5) 빈 입력 안전
ok(countMath(insertMathBlocks(desc, '')) === 0, '빈 수학식 입력: 0개');

console.log('='.repeat(54));
console.log(`수학식 보장 배치 테스트: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
console.log('='.repeat(54));
if (fails.length) { console.log('\n[실패 상세]'); fails.forEach(f => console.log(f)); }
process.exit(fail ? 1 : 0);
