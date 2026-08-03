/**
 * review-engine/__tests__/patent-length-target.test.js
 *
 * ★ 지시2 — 상세설명 분량 목표 준수(선택 분량대로 안 나오고 짧게 나오는 문제).
 *   프롬프트 프레이밍을 "기준"(상한 뉘앙스) → "이상/최소 목표"(하한)으로 전환. standard/custom extra 상세 보강.
 *   ★ 동어반복 금지(Q3 간결성 가드)는 유지 — "반복 없이 내용을 충분히"의 균형.
 *   (자동 보충 로직(지시2-B)은 미채택 — 열린 결정. 본 PR은 프롬프트 프레이밍(A)만.)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

// ─────────── 장치 상세설명 분량 프레이밍 ───────────

test('장치 ★ 총 분량 "이상을 목표로" + "미달하지 않도록"(하한) 프레이밍', () => {
  assert.match(PATENT_SRC, /총 분량 \$\{dlCfg\.total\}\(공백 포함\) 이상을 목표로 하며, 목표에 현저히 미달하지 않도록/, '★ 총 분량 하한 프레이밍');
  assert.match(PATENT_SRC, /도면 1개당 \$\{dlCfg\.charPerFig\}\(공백 포함\) 이상을 최소 목표로/, '★ 도면당 하한');
  assert.match(PATENT_SRC, /선택한 분량을 반드시 채울 것/, '★ 선택 분량 준수 명시');
});

test('장치 ★ 동어반복 금지(간결성 가드) 유지 — Q3 회귀 방지', () => {
  assert.match(PATENT_SRC, /불필요한 반복\/나열·동어반복으로 분량을 늘리지 마라/, '★ 동어반복 금지 유지');
  assert.match(PATENT_SRC, /반복 없이 내용을 충분히/, '★ "반복 없이 충분히" 균형');
});

test('장치 ★ standard/custom extra — 상세 지시·미달 방지 보강(과소생성 취약 해소)', () => {
  assert.match(PATENT_SRC, /standard:\{charPerFig:'약 1,500자 이상'[\s\S]*?미달하지 않도록 각 구성요소를 빠짐없이 기술/, '★ standard 보강');
  assert.match(PATENT_SRC, /custom:\{charPerFig:'약 '\+customDetailChars\+'자 이상'[\s\S]*?미달하지 않도록 기술/, '★ custom 보강');
});

// ─────────── 방법 상세설명 분량 프레이밍 ───────────

test('방법 ★ methodDetailGuide standard/custom → "이상을 목표로"(하한) 전환', () => {
  assert.match(PATENT_SRC, /dl==='standard'\?'약 1,200자\(공백 포함\) 이상을 목표로/, '★ 방법 standard 하한');
  assert.match(PATENT_SRC, /dl==='custom'\?`약 \$\{Math\.round\(\(customDetailChars\|\|1200\)\*0\.7\)\}자\(공백 포함\) 이상을 목표로`/, '★ 방법 custom 하한');
});

// ─────────── 회귀: 기존 정합 불변 ───────────

test('회귀 ★ maximal(#232) 방법 8,000자·detailed 2,000자 이상 불변', () => {
  assert.match(PATENT_SRC, /dl==='maximal'\?'약 8,000자\(공백 포함\) 이상으로/, '★ 방법 maximal 불변');
  assert.match(PATENT_SRC, /dl==='detailed'\?'약 2,000자\(공백 포함\) 이상으로 상세하게'/, '★ 방법 detailed 불변');
});

test('회귀 ★ 장치 maximal dlCfg total(22,000~25,000) 불변', () => {
  assert.match(PATENT_SRC, /maximal:\{charPerFig:'약 3,000자 이상',total:'약 22,000~25,000자'/, '★ 장치 maximal 불변');
});
