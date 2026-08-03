/**
 * review-engine/__tests__/cachebust-consistency.test.js
 * ★ 캐시버스트 토큰 일관성 — 배포본이 "구/신 파일 뒤섞임"으로 깨지는 사고를 차단한다.
 *
 * 실제 사고(2026-08-03): develop→main 머지가 index.html 의 ?v= 토큰을 되돌리면서
 *   - shared/common.js 는 토큰이 그대로(20260723a)인데 내용만 바뀌어 브라우저가 캐시된 구버전을 계속 사용
 *   - patent/patent.js 는 토큰이 20260723-scope-retry → 20260722-b63 으로 후퇴
 *   결과적으로 사용자 브라우저에 구버전 common.js + 신버전 patent 모듈이 섞여 로드됐다.
 *
 * 이 테스트는 개별 토큰 값을 고정하지 않는다(릴리스마다 bump 되므로).
 * 대신 "모든 1st-party 토큰이 서로 같고, 분리 로더의 내부 version 도 그 토큰과 같다"만 강제한다.
 * → 일부만 bump 하거나 일부만 되돌리는 변경이 있으면 실패한다.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const HTML = readFileSync(path.join(REPO, 'index.html'), 'utf8');

// index.html 의 1st-party ?v= 토큰 전부 (CDN 은 ?v= 를 쓰지 않는다)
function htmlTokens() {
  const out = [];
  const re = /(?:src|href)="((?:patent|shared|opinion|division|docket|review-engine)[^"?]*)\?v=([^"]+)"/g;
  let m;
  while ((m = re.exec(HTML)) !== null) out.push({ file: m[1], token: m[2] });
  return out;
}

test('★ index.html 의 모든 1st-party ?v= 토큰이 동일해야 한다', () => {
  const toks = htmlTokens();
  assert.ok(toks.length >= 5, `1st-party ?v= 토큰이 최소 5개 있어야 함 (실제 ${toks.length})`);
  const uniq = [...new Set(toks.map((t) => t.token))];
  assert.strictEqual(
    uniq.length, 1,
    `★ 토큰 불일치 — 일부만 bump 되면 구/신 파일이 섞여 로드된다:\n` +
      toks.map((t) => `    ${t.file} → ${t.token}`).join('\n')
  );
});

test('★ 분리 로더의 내부 version 이 index.html 토큰과 일치해야 한다', () => {
  const token = htmlTokens()[0].token;
  // 각 로더는 이 version 으로 modules/*.js URL 을 만든다 — 여기가 어긋나면 모듈만 구버전이 로드된다.
  for (const loader of ['patent/patent.js', 'opinion/opinion.js', 'division/division.js', 'trademark/trademark.js']) {
    const src = readFileSync(path.join(REPO, loader), 'utf8');
    const m = src.match(/var version = '([^']+)'/);
    assert.ok(m, `${loader} 에 var version 선언이 있어야 함`);
    assert.strictEqual(m[1], token, `★ ${loader} 내부 version(${m[1]}) ≠ index.html 토큰(${token})`);
  }
});

test('★ trademark 조건부 로드의 _cv 가 index.html 토큰과 일치해야 한다', () => {
  const token = htmlTokens()[0].token;
  // trademark.js 는 fetch HEAD 후 동적 삽입되므로 _cv 가 별도 관리된다 — 누락되기 쉬운 지점.
  const m = HTML.match(/var _cv='\?v=([^']+)';/);
  assert.ok(m, 'index.html 에 _cv 선언이 있어야 함');
  assert.strictEqual(m[1], token, `★ _cv(${m[1]}) ≠ index.html 토큰(${token})`);
});
