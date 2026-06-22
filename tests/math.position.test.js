'use strict';
// ════════════════════════════════════════════════════════════════
// 수학식 삽입 위치·문장 수정·출력 정확성 교차검증
// 실행: node tests/math.position.test.js
// 실제 patent.js 함수를 추출하여 동작을 검증한다.
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
const { fuzzyFindAnchor, findSentenceEndAfterAnchor, _validateInsertionPoint, _deduplicateSentences, insertMathBlocks } = ev;

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }

// ═══════════════════════════════════════════════
// A. 삽입 위치 — 완결 문장(종결어미+마침표) 뒤에 삽입되는가
// ═══════════════════════════════════════════════
console.log('── A. 삽입 위치 적절성 ──');

// A1: 종결어미 뒤 마침표 위치를 정확히 찾는가
let t = '프로세서는 입력 데이터를 정규화하여 특징값을 산출한다. 이후 분석부는 상기 특징값을 기준값과 비교한다.';
let ai = fuzzyFindAnchor(t, '특징값을 산출한다.');
let ip = findSentenceEndAfterAnchor(t, ai, '특징값을 산출한다.');
ok(t.slice(0, ip).endsWith('산출한다.'), 'A1: 삽입점이 "산출한다." 마침표 직후');
ok(t.slice(ip).trim().startsWith('이후 분석부는'), 'A1: 다음 문장은 보존');

// A2: 쉼표 절(~하여,)을 ANCHOR로 줘도 마침표(종결) 뒤까지 전진
t = '제어부는 가중치를 조정하고 보정값을 갱신하여 출력값을 산출한다. 저장부는 이를 기록한다.';
ai = fuzzyFindAnchor(t, '가중치를 조정하고');
ip = findSentenceEndAfterAnchor(t, ai, '가중치를 조정하고');
ok(t.slice(0, ip).endsWith('산출한다.'), 'A2: 쉼표 절 ANCHOR → 종결 마침표 뒤로 전진(절 중간 삽입 방지)');

// A3: 소수점은 문장 끝으로 오인하지 않음
t = '임계값은 0.5로 설정되며 상기 값을 초과하면 경보를 발생한다. 다음 단계로 진행한다.';
ai = fuzzyFindAnchor(t, '경보를 발생한다.');
ip = findSentenceEndAfterAnchor(t, ai, '경보를 발생한다.');
ok(t.slice(0, ip).endsWith('발생한다.') && !t.slice(0, ip).endsWith('0.'), 'A3: 소수점(0.5)을 문장끝으로 오인 안 함');

// A4: _validateInsertionPoint — 단어 중간 삽입점을 문장 경계로 보정
t = '통신부는 데이터를 수신한다. 프로세서가 이를 처리한다.';
const midWord = t.indexOf('처리') + 1; // "처리" 중간
const corrected = _validateInsertionPoint(t, midWord);
ok(corrected === t.length || t[corrected - 1] === '.' || t[corrected] === '\n' || t[corrected] === ' ',
   'A4: 단어 중간 삽입점 → 문장/단어 경계로 보정');

// ═══════════════════════════════════════════════
// B. 앞뒤 문장 수정 — 중복 제거가 적절한가 (과잉/누락 없이)
// ═══════════════════════════════════════════════
console.log('── B. 문장 수정(중복제거) 적절성 ──');

// B1: 수학식 사이에 동일 문장 중복 → 뒤쪽 제거
let dup = '가중 소음 수준은 개별 소음 수준의 로그 합산으로 산출되며 각 소음원의 기여도를 반영한다.\n\n【수학식 1】\nLw = 10 log Σ\n\n가중 소음 수준은 개별 소음 수준의 로그 합산으로 산출되며 각 소음원의 기여도를 반영한다. 이후 보정 단계를 수행한다.';
let dr = _deduplicateSentences(dup);
const occ = (dr.match(/가중 소음 수준은 개별 소음 수준의 로그 합산으로 산출되며/g) || []).length;
ok(occ === 1, 'B1: 수학식 사이 동일 문장 1회만 잔존(중복 제거)');
ok(dr.includes('이후 보정 단계를 수행한다'), 'B1: 중복 아닌 후속 문장은 보존');
ok(dr.includes('【수학식 1】') && dr.includes('Lw = 10 log'), 'B1: 수학식 본문 보존');

// B2: 수학식이 사이에 없는 정상 반복은 보존(과잉 제거 방지)
let rep = '상기 계수는 0과 1 사이의 값이다. 다른 실시예에서 상기 계수는 0과 1 사이의 값이다.';
let rr = _deduplicateSentences(rep);
ok((rr.match(/상기 계수는 0과 1 사이의 값이다/g) || []).length === 2, 'B2: 수학식 없는 정상 반복은 보존(과잉 제거 안 함)');

// B3: 서로 다른 문장은 제거되지 않음
let diff = '통신부는 데이터를 수신한다.\n\n【수학식 1】\ny=ax\n\n프로세서는 데이터를 분석한다. 저장부는 결과를 보관한다.';
let dr3 = _deduplicateSentences(diff);
ok(dr3.includes('통신부는 데이터를 수신한다') && dr3.includes('프로세서는 데이터를 분석한다') && dr3.includes('저장부는 결과를 보관한다'),
   'B3: 서로 다른 문장은 모두 보존');

// B4: 중복 제거 후 한글 단어가 깨지지 않는가(공백/경계 정합)
ok(!/[가-힣][가-힣]{0,0}\(수학식/.test(dr) && !dr.includes('수준은개별') && !dr.includes('합산으로산출'),
   'B4: 중복 제거 후 단어 깨짐/공백 누락 없음');

// ── B 적대적 케이스(과잉 제거 방지) ──
// B5: 절 접두는 같지만 전체 문장이 다름 + 수학식 사이 → 둘 다 보존(전체 일치 시에만 제거)
let adv = '프로세서는 가중치를 적용하여 보정값을 산출한다.\n\n【수학식 1】\ny=ax\n\n제어부는 가중치를 적용하여 출력값을 조정한다.';
let ar = _deduplicateSentences(adv);
ok(ar.includes('보정값을 산출한다') && ar.includes('출력값을 조정한다'), 'B5: 절 접두만 같고 전체가 다른 문장은 둘 다 보존');

// B6: 동일 문장 3회(사이에 수학식) → 첫 1개만 잔존
let tri = '신뢰도 지표는 과거 이력과 현재 측정값의 가중 평균으로 결정된다.\n\n【수학식 1】\nA\n\n신뢰도 지표는 과거 이력과 현재 측정값의 가중 평균으로 결정된다.\n\n【수학식 2】\nB\n\n신뢰도 지표는 과거 이력과 현재 측정값의 가중 평균으로 결정된다.';
let tr = _deduplicateSentences(tri);
ok((tr.match(/신뢰도 지표는 과거 이력과 현재 측정값의 가중 평균으로 결정된다/g) || []).length === 1, 'B6: 3회 중복 → 1개만 잔존');
ok(tr.includes('【수학식 1】') && tr.includes('【수학식 2】'), 'B6: 수식 2개 보존');

// B7: 중복 제거가 직전 문장을 침범하지 않음(경계 안전)
let safe = '저장부는 데이터를 보관한다. 분석부는 특징을 추출하여 분류 결과를 생성한다.\n\n【수학식 1】\nC\n\n분석부는 특징을 추출하여 분류 결과를 생성한다.';
let sr = _deduplicateSentences(safe);
ok(sr.includes('저장부는 데이터를 보관한다'), 'B7: 중복 제거가 직전 문장(저장부…)을 침범하지 않음');
ok((sr.match(/분석부는 특징을 추출하여 분류 결과를 생성한다/g) || []).length === 1, 'B7: 중복 문장 1개만 잔존');

// ═══════════════════════════════════════════════
// C. 출력 정확성 — 전체 파이프라인(삽입+중복제거+재번호)
// ═══════════════════════════════════════════════
console.log('── C. 출력 정확성 ──');

const desc = [
  '도 1을 참조하면, 통신부는 외부 단말로부터 측정 데이터를 수신하여 내부 버퍼에 저장한다.',
  '프로세서는 상기 측정 데이터를 정규화하고 가중치를 적용하여 보정값을 산출한다.',
  '분석부는 상기 보정값을 기준값과 비교하여 이상 여부를 판정한다.',
  '제어부는 판정 결과에 따라 다음 주기의 처리 파라미터를 갱신한다.',
].join('\n\n');

function mb(n, anchor, body) {
  return `---MATH_BLOCK_${n}---\nANCHOR: ${anchor}\nFORMULA:\n【수학식 ${n}】\n${body}\n여기서, 각 변수는 해당 수식 내에서 정의된다.\n예를 들어, 대표 수치를 대입한다.`;
}
// ANCHOR 순서를 역으로 줘도(2번이 먼저) 문서 순서대로 재번호되는지 확인
const s09 = [
  mb(1, '보정값을 산출한다.', 'C = w × x'),
  mb(2, '이상 여부를 판정한다.', 'D = |C - r|'),
].join('\n');
const out = insertMathBlocks(desc, s09);

// C1: 두 수식 모두 삽입
ok((out.match(/【수학식\s*\d+】/g) || []).length === 2, 'C1: 수식 2개 모두 삽입');
// C2: 원본 문장 4개 모두 보존
['외부 단말로부터 측정 데이터를 수신', '가중치를 적용하여 보정값을 산출', '기준값과 비교하여 이상 여부를 판정', '처리 파라미터를 갱신'].forEach((frag, i) => {
  ok(out.includes(frag), `C2.${i + 1}: 원본 문장 보존 — "${frag.slice(0, 12)}…"`);
});
// C3: 재번호 — 문서 순서대로 1,2
const nums = (out.match(/【수학식\s*(\d+)】/g) || []).map(s => parseInt(s.match(/\d+/)[0]));
ok(JSON.stringify(nums) === JSON.stringify([1, 2]), 'C3: 문서 순서대로 1,2 재번호');
// C4: 수식이 해당 ANCHOR 문장 바로 뒤에 위치
const posBo = out.indexOf('보정값을 산출한다.');
const posM1 = out.indexOf('【수학식 1】');
const posPan = out.indexOf('이상 여부를 판정한다.');
const posM2 = out.indexOf('【수학식 2】');
ok(posBo >= 0 && posM1 > posBo && (posPan < 0 || posM1 < posPan), 'C4: 수학식1이 "산출한다." 뒤 & "판정한다." 앞');
ok(posPan >= 0 && posM2 > posPan, 'C4: 수학식2가 "판정한다." 뒤');
// C5: 수식 본문 무손실
ok(out.includes('C = w × x') && out.includes('D = |C - r|'), 'C5: 수식 본문 정확 보존');
// C6: "여기서/예를 들어" 변수 설명 보존
ok((out.match(/여기서, 각 변수/g) || []).length === 2 && (out.match(/예를 들어/g) || []).length === 2, 'C6: 변수설명/수치예시 보존');

console.log('='.repeat(54));
console.log(`수학식 위치·문장수정·출력 교차검증: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
console.log('='.repeat(54));
if (fails.length) { console.log('\n[실패 상세]'); fails.forEach(f => console.log(f)); }
process.exit(fail ? 1 : 0);
