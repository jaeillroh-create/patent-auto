// ═══════════ [P-C1] INVENTION SCOPE ═══════════
function _parseJSONSafe(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch(e) {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1].trim()); } catch(e) {}
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) try { return JSON.parse(braceMatch[0]); } catch(e) {}
  return null;
}

// [C1-3] Layer 1 가드: invention_scope 주입 블록 생성
function buildScopeGuardBlock(sid, variant) {
  if (!inventionScope || !inventionScope.locked_at) return '';
  const bl = inventionScope.baseline;
  if (!bl || !Array.isArray(bl.core_components)) return '';
  const exp = inventionScope.approved_expansions || [];
  const themes = (anchorThemeMode === 'manual' ? selectedAnchorThemes : [])
    .map(k => ANCHOR_THEMES.find(t => t.key === k))
    .filter(Boolean);

  if (variant === 'text') {
    return [
      '',
      '[발명 범위 준수 지침]',
      '아래 invention_scope는 이 발명의 확정된 기준선이다.',
      '이 범위를 벗어나는 신규 기술요소를 임의로 추가하지 말라.',
      '',
      '<baseline_components>',
      bl.core_components.map(c =>
        `- ${c.name}${c.aliases && c.aliases.length ? ' (별칭: '+c.aliases.join(', ')+')' : ''}`
      ).join('\n'),
      '</baseline_components>',
      '',
      '<baseline_functions>',
      (bl.core_functions || []).map(f => `- ${f.desc}`).join('\n'),
      '</baseline_functions>',
      '',
      exp.length ? '<approved_expansions>\n' +
        exp.map(e => `- ${e.component} (${e.type})`).join('\n') +
        '\n</approved_expansions>\n' : '',
      themes.length ? '<active_anchor_themes>\n' +
        themes.map(t => `- ${t.label}: ${t.desc}`).join('\n') +
        '\n</active_anchor_themes>\n' : '',
      '허용 규칙:',
      '1. 위 baseline/approved_expansions에 포함된 요소 자유 사용',
      '2. 자명한 하위개념 구체화 허용 (예: "딥러닝"→"CNN")',
      '3. 활성 앵커 테마에 따른 전략적 확장 허용',
      '4. 위 3가지에 해당하지 않는 신규 기술요소 추가 시, 해당 부분을',
      '   [[NOVEL: 요소명]] 마크업으로 명시적 표시',
      '5. 사용자 명시적 확장 지시가 있는 경우 [[NOVEL:]] 마크업 후 생성',
      '',
      // [C1-7] negative_constraints 제외 지시
      ..._buildNegativeConstraintsBlock()
    ].join('\n');
  }

  if (variant === 'mermaid') {
    return [
      '',
      '[도면 구성요소 제한]',
      '아래 허용 구성요소 목록을 참고하여 Mermaid 도면을 구성하라.',
      '각 노드의 레이블은 목록의 정확한 명칭을 사용하라.',
      '',
      '<allowed_components>',
      bl.core_components.map(c => `- ${c.name}`).join('\n'),
      exp.length ? exp.map(e => `- ${e.component} (확장)`).join('\n') : '',
      '</allowed_components>',
      '',
      themes.length ? '<active_anchor_themes>\n' +
        themes.map(t => `- ${t.label}`).join('\n') +
        '\n</active_anchor_themes>\n' : '',
      '허용 규칙:',
      '1. 위 목록의 구성요소를 자유롭게 배치',
      '2. 앵커 테마에 따른 새 노드 추가 시 실제 기술명 사용 (태깅 불필요)',
      '3. Mermaid 문법 유지 (주석/마크업으로 문법을 깨지 말 것)',
      '',
      // [C1-7] negative_constraints 제외 지시
      ..._buildNegativeConstraintsBlock()
    ].join('\n');
  }

  return '';
}
// [C1-7] negative_constraints → 제외 지시 블록 생성
function _buildNegativeConstraintsBlock() {
  const negList = (inventionScope && inventionScope.negative_constraints) || [];
  if (negList.length === 0) return [];
  return [
    '',
    '<rejected_components>',
    '다음 구성요소들은 이전 검증에서 범위 이탈로 판정되어',
    '변리사가 명시적으로 제외 지시한 요소들이다.',
    '이번 응답에서 사용하지 말 것:',
    ...negList.map(n => `- ${n.component}${n.reason ? ' (사유: ' + n.reason + ')' : ''}`),
    '</rejected_components>',
    ''
  ];
}
function _maybeScopeGuard(sid, variant) {
  if (variant === 'text' && !SCOPE_GUARDED_TEXT_STEPS.includes(sid)) return '';
  if (variant === 'mermaid' && !SCOPE_GUARDED_MERMAID_STEPS.includes(sid)) return '';
  return buildScopeGuardBlock(sid, variant);
}

// ═══════════ [C1-4] LAYER 2: EXTRACTOR + DIFF ═══════════

function extractNovelMarkers(text) {
  const pattern = /\[\[NOVEL:\s*([^\]]+?)\s*\]\]/g;
  const results = [];
  let m;
  while ((m = pattern.exec(text)) !== null) results.push(m[1].trim());
  return results;
}

function extractMermaidNodes(mermaidText) {
  const results = [];
  // ID["이름(참조번호)"] — 장치 도면
  const p1 = /\w+\["([^"]+?)\((\d+)\)"\]/g;
  // ID["단계명(S번호)"] — 방법 도면
  const p2 = /\w+\["([^"]+?)\((S\d+)\)"\]/g;
  // ID{"조건"} — 조건 분기
  const p3 = /\w+\{"([^}]+)"\}/g;
  // ID(["라벨"]) — 시작/종료
  const p4 = /\w+\(\["([^"]+)"\]\)/g;
  // ID["라벨"] — 참조번호 없는 일반 노드
  const p5 = /\w+\["([^"]+)"\]/g;
  let mm;
  while ((mm = p1.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: mm[2], source: 'device_node' });
  while ((mm = p2.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: mm[2], source: 'method_node' });
  while ((mm = p3.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: null, source: 'decision' });
  while ((mm = p4.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: null, source: 'terminal' });
  // p5 fallback: 참조번호 없는 라벨 (p1/p2에서 이미 캡처된 것과 중복 가능)
  const captured = new Set(results.map(r => r.name));
  while ((mm = p5.exec(mermaidText)) !== null) {
    const name = mm[1].trim();
    if (!captured.has(name) && !/\(\d+\)/.test(name) && !/\(S\d+\)/.test(name)) {
      results.push({ name, ref: null, source: 'label_only' });
      captured.add(name);
    }
  }
  // 중복 제거 (name+ref 기준, 첫 등장 유지)
  const seen = new Set();
  return results.filter(n => {
    const key = `${n.ref||''}:${n.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SCOPE_EXTRACT_SYSTEM_PROMPT = `당신은 특허 명세서 분석 전문가이다.
입력된 특허 문서에서 등장하는 기술적 구성요소를 추출한다.
원칙: 텍스트에 명시된 구성요소만 추출. 추론·추측·상식 추가 금지.
같은 개념의 다른 표현도 별도 요소로 기록. 일반 접속사·동사 제외.`;

const SCOPE_EXTRACT_SCHEMA = `응답은 순수 JSON. 설명·prefix·코드블록 금지.
{"components":[{"name":"구성요소명","context":"등장 문맥 50자 이내"}]}`;

async function extractComponentsFromText(sid, text) {
  if (!text || text.trim().length < 30) return { status: 'skipped_empty', components: [] };
  const prompt = `${SCOPE_EXTRACT_SCHEMA}\n\n<patent_text>\n${text.slice(0, 20000)}\n</patent_text>`;
  try {
    const resp = await App.callClaudeSonnet(prompt, 4096);
    const parsed = _parseJSONSafe(resp.text);
    if (!parsed || !Array.isArray(parsed.components)) return { status: 'llm_failed_partial', components: [] };
    return {
      status: 'ok',
      components: parsed.components.map(c => ({ name: c.name, context: c.context || '', source: 'llm' }))
    };
  } catch (e) {
    console.warn('[C1-4] extractComponentsFromText failed:', e.message);
    return { status: 'llm_failed_partial', components: [] };
  }
}

function matchComponentToScope(componentName) {
  if (!inventionScope || !inventionScope.baseline) return null;
  const normalize = s => s.toLowerCase().replace(/\s+/g, '').trim();
  const target = normalize(componentName);
  if (!target) return null;
  for (const c of inventionScope.baseline.core_components || []) {
    if (normalize(c.name) === target) return { via: 'baseline:' + (c.id || c.name) };
    for (const alias of (c.aliases || [])) {
      if (normalize(alias) === target) return { via: 'alias:' + alias };
    }
  }
  for (const e of inventionScope.approved_expansions || []) {
    if (normalize(e.component) === target) return { via: 'expansion:' + e.component };
  }
  return null;
}

async function runScopeCheck_text(sid) {
  if (!inventionScope?.locked_at) return;
  if (!outputs[sid]) return;
  const text = outputs[sid];
  const novelMarkers = extractNovelMarkers(text);
  const llmResult = await extractComponentsFromText(sid, text);
  const allComponents = [];
  const seen = new Set();
  const addComp = (name, context, source) => {
    const key = name.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); allComponents.push({ name, context, source }); }
  };
  novelMarkers.forEach(n => addComp(n, '', 'novel_marker'));
  llmResult.components.forEach(c => addComp(c.name, c.context, c.source));
  const matched = [], novel = [];
  for (const comp of allComponents) {
    const m = matchComponentToScope(comp.name);
    if (m) matched.push({ name: comp.name, matched_via: m.via });
    else {
      const idx = text.indexOf(comp.name);
      novel.push({
        name: comp.name,
        context_snippet: comp.context || (idx >= 0 ? text.slice(Math.max(0, idx - 80), idx + 80) : ''),
        discovered_via: comp.source === 'novel_marker' ? 'novel_marker' : 'llm_extraction'
      });
    }
  }
  scopeCheckResults[sid] = {
    sid,
    extracted_at: new Date().toISOString(),
    source_type: 'text',
    extraction_method: llmResult.status === 'ok' ? 'hybrid' : 'partial',
    extraction_status: llmResult.status,
    all_components: allComponents,
    matched_to_scope: matched,
    novel_components: novel,
    conflicts: []
  };
  saveProject(true);
  return scopeCheckResults[sid];
}

async function runScopeCheck_mermaid(sid) {
  if (!inventionScope?.locked_at) return;
  if (!outputs[sid]) return;
  const nodes = extractMermaidNodes(outputs[sid]);
  const matched = [], novel = [];
  for (const node of nodes) {
    const m = matchComponentToScope(node.name);
    if (m) matched.push({ name: node.name, ref: node.ref, matched_via: m.via });
    else novel.push({ name: node.name, ref: node.ref, context_snippet: 'Mermaid node ' + (node.ref || node.name), discovered_via: 'mermaid_extraction' });
  }
  scopeCheckResults[sid] = {
    sid,
    extracted_at: new Date().toISOString(),
    source_type: 'mermaid',
    extraction_method: 'regex',
    extraction_status: 'ok',
    all_components: nodes.map(n => ({ name: n.name, ref: n.ref, source: n.source })),
    matched_to_scope: matched,
    novel_components: novel,
    conflicts: []
  };
  saveProject(true);
  return scopeCheckResults[sid];
}

function detectMermaidRefConflicts() {
  const mermaidSids = SCOPE_GUARDED_MERMAID_STEPS.filter(sid => outputs[sid]);
  if (mermaidSids.length < 2) return;
  const refMap = {};
  for (const sid of mermaidSids) {
    const nodes = extractMermaidNodes(outputs[sid]);
    for (const n of nodes) {
      if (!n.ref) continue;
      if (!refMap[n.ref]) refMap[n.ref] = [];
      refMap[n.ref].push({ sid, name: n.name });
    }
  }
  const conflicts = {};
  for (const [ref, occurrences] of Object.entries(refMap)) {
    const uniqueNames = new Set(occurrences.map(o => o.name));
    if (uniqueNames.size > 1) {
      for (const occ of occurrences) {
        if (!conflicts[occ.sid]) conflicts[occ.sid] = [];
        conflicts[occ.sid].push({ ref, names: [...uniqueNames], occurrences });
      }
    }
  }
  for (const sid of mermaidSids) {
    if (scopeCheckResults[sid]) scopeCheckResults[sid].conflicts = conflicts[sid] || [];
  }
}

// [C1-4] Layer 2 공개 API
async function runScopeCheck(sid) {
  if (!inventionScope?.locked_at) { App.showToast('발명 범위가 확정되지 않았습니다', 'info'); return null; }
  let result = null;
  if (SCOPE_GUARDED_TEXT_STEPS.includes(sid)) {
    result = await runScopeCheck_text(sid);
  } else if (SCOPE_GUARDED_MERMAID_STEPS.includes(sid)) {
    result = await runScopeCheck_mermaid(sid);
    detectMermaidRefConflicts();
  }
  // [C1-5] 자동 판정 연쇄
  if (result && result.novel_components && result.novel_components.length > 0) {
    try { await runScopeJudgment(sid); } catch (e) {
      console.warn('[C1-5] runScopeJudgment failed for', sid, e.message);
    }
  }
  return result;
}
async function runScopeCheckAll() {
  const allSids = [...SCOPE_GUARDED_TEXT_STEPS, ...SCOPE_GUARDED_MERMAID_STEPS];
  const results = {};
  for (const sid of allSids) { if (outputs[sid]) results[sid] = await runScopeCheck(sid); }
  return results;
}

// ═══════════ [C1-5] LAYER 3: SONNET 판정 시스템 ═══════════

const SONNET_INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const SONNET_OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const JUDGMENT_SYSTEM_PROMPT = `당신은 특허 명세서 심사 변리사이다.
발명의 기준선(invention_scope) 대비 새로 등장한 기술 요소를 3종으로 분류한다.

판정 기준:

1. strategic_anchor: 선택된 앵커 테마(예: 신뢰도 가중치, 임계값 적응 등)에 따른 전략적 확장. 출원인의 의도적 확장 가능성 높음.

2. elaboration: baseline 구성요소의 자명한 하위개념 또는 기술상식상 자명한 부속구성. 원 발명의 범위 내 구체화. 예: "딥러닝 모델" → "CNN 분류기", "무선 통신" → "BLE 모듈".

3. drift: baseline에도 없고 앵커 테마와도 무관하며 자명한 하위개념도 아닌 신규 기술 요소. 원 발명 범위 이탈 가능성. 예: 센서 기반 발명에 갑자기 "블록체인 검증" 등장.

confidence는 0.0~1.0 사이 소수. 0.85 이상이면 확신.

응답은 순수 JSON. 설명/prefix/코드블록 금지.
{"verdict":"strategic_anchor|elaboration|drift","confidence":0.0~1.0,"reason":"판정 근거 50자 이내","matched_anchor":"해당 anchor key 또는 null"}`;

function _contextHash(text) {
  const snippet = (text || '').substring(0, 150);
  let h = 2166136261;
  for (let i = 0; i < snippet.length; i++) {
    h ^= snippet.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function _buildJudgmentPrompt_direct(component, contextSnippet) {
  if (!inventionScope?.baseline) return null;
  const bl = inventionScope.baseline;
  const exp = inventionScope.approved_expansions || [];
  const themes = (anchorThemeMode === 'manual' ? selectedAnchorThemes : [])
    .map(k => ANCHOR_THEMES.find(t => t.key === k))
    .filter(Boolean);

  return `<baseline>
핵심 구성: ${(bl.core_components||[]).map(c => c.name).join(', ')}
핵심 기능: ${(bl.core_functions || []).map(f => f.desc).join('; ')}
문제: ${bl.problem_space || ''}
해결: ${bl.solution_space || ''}
</baseline>

<approved_expansions>
${exp.length ? exp.map(e => `- ${e.component} (${e.type})`).join('\n') : '(없음)'}
</approved_expansions>

<anchor_themes>
${themes.length ? themes.map(t => `- ${t.key}: ${t.label} - ${t.desc}`).join('\n') : '(없음)'}
</anchor_themes>

<novel_component>
이름: ${component.name}
맥락: ${contextSnippet || ''}
</novel_component>

위 novel_component를 strategic_anchor / elaboration / drift 중 어느 것인지 판정하라.`;
}

function _buildJudgmentPrompt_postReview(component, contextSnippet, originalText) {
  const direct = _buildJudgmentPrompt_direct(component, contextSnippet);
  if (!direct) return null;

  return `${direct}

<review_context>
이 novel_component는 AI 검토(step_13) 과정에서 원본 상세설명에 추가되었다.

검토 지시 의도: 명확성 개선, 실시예 보강, 기재불비 방지 등
검토 전 원본: ${(originalText || '').substring(0, 1500)}
</review_context>

참고: 검토 과정에서 추가된 요소가 검토 지시 의도(명확성 개선 등)에 부합하면 elaboration 가능성 높음. 의도와 무관하게 추가된 신규 기술은 drift.`;
}

function _checkCostThresholds() {
  if (!_costTracking.warned_50 && _costTracking.judgment_calls >= 50) {
    _costTracking.warned_50 = true;
    App.showToast(
      `검증 판정 ${_costTracking.judgment_calls}회, 누적 비용 약 $${_costTracking.estimated_cost_usd.toFixed(2)}`,
      'warning'
    );
  }
  if (!_costTracking.stopped_100 && _costTracking.judgment_calls >= 100) {
    _costTracking.stopped_100 = true;
    const proceed = confirm(
      `판정 호출이 ${_costTracking.judgment_calls}회에 도달했습니다. ` +
      `누적 비용 약 $${_costTracking.estimated_cost_usd.toFixed(2)}.\n\n` +
      `계속 진행하시겠습니까? 취소하면 이후 판정은 중단되고 undetermined로 표시됩니다.`
    );
    if (proceed) {
      _costTracking.stopped_100 = false;
    }
  }
}

async function classifyNovelComponent(component, contextSnippet) {
  const ctxHash = _contextHash(contextSnippet);
  const cacheKey = `${component.name}||${ctxHash}`;

  if (_judgmentCache.has(cacheKey)) {
    return { ..._judgmentCache.get(cacheKey), from_cache: true };
  }

  if (_costTracking.stopped_100) {
    return { verdict: 'undetermined', confidence: 0, reason: '비용 상한 도달로 판정 중단', from_cache: false, judged_at: new Date().toISOString() };
  }

  const prompt = _buildJudgmentPrompt_direct(component, contextSnippet);
  if (!prompt) {
    return { verdict: 'undetermined', confidence: 0, reason: 'invention_scope 없음', from_cache: false, judged_at: new Date().toISOString() };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const beforeIt = usage.inputTokens, beforeOt = usage.outputTokens;
      const resp = await App.callClaudeSonnet(`${JUDGMENT_SYSTEM_PROMPT}\n\n${prompt}`, 512);
      const deltaIt = usage.inputTokens - beforeIt;
      const deltaOt = usage.outputTokens - beforeOt;

      _costTracking.judgment_calls++;
      _costTracking.total_input_tokens += deltaIt;
      _costTracking.total_output_tokens += deltaOt;
      _costTracking.estimated_cost_usd =
        _costTracking.total_input_tokens * SONNET_INPUT_COST_PER_TOKEN +
        _costTracking.total_output_tokens * SONNET_OUTPUT_COST_PER_TOKEN;
      _checkCostThresholds();

      const parsed = _parseJSONSafe(resp.text);
      if (!parsed || !parsed.verdict) throw new Error('JSON 파싱 실패 또는 verdict 누락');

      const result = {
        verdict: parsed.verdict,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason || '',
        matched_anchor: parsed.matched_anchor || null,
        from_cache: false,
        judged_at: new Date().toISOString()
      };
      _judgmentCache.set(cacheKey, result);
      return result;

    } catch (e) {
      lastError = e;
      console.warn(`[C1-5] classifyNovelComponent attempt ${attempt} failed:`, e.message);
      if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { verdict: 'undetermined', confidence: 0, reason: `Sonnet 판정 실패: ${lastError?.message || 'unknown'}`, from_cache: false, judged_at: new Date().toISOString() };
}

async function classifyNovelComponent_postReview(component, contextSnippet, originalText) {
  const ctxHash = _contextHash(contextSnippet);
  const cacheKey = `${component.name}||${ctxHash}||postReview`;

  if (_judgmentCache.has(cacheKey)) {
    return { ..._judgmentCache.get(cacheKey), from_cache: true };
  }

  if (_costTracking.stopped_100) {
    return { verdict: 'undetermined', confidence: 0, reason: '비용 상한 도달', is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
  }

  const prompt = _buildJudgmentPrompt_postReview(component, contextSnippet, originalText);
  if (!prompt) {
    return { verdict: 'undetermined', confidence: 0, reason: 'invention_scope 없음', is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const beforeIt = usage.inputTokens, beforeOt = usage.outputTokens;
      const resp = await App.callClaudeSonnet(`${JUDGMENT_SYSTEM_PROMPT}\n\n${prompt}`, 512);
      const deltaIt = usage.inputTokens - beforeIt;
      const deltaOt = usage.outputTokens - beforeOt;

      _costTracking.judgment_calls++;
      _costTracking.total_input_tokens += deltaIt;
      _costTracking.total_output_tokens += deltaOt;
      _costTracking.estimated_cost_usd =
        _costTracking.total_input_tokens * SONNET_INPUT_COST_PER_TOKEN +
        _costTracking.total_output_tokens * SONNET_OUTPUT_COST_PER_TOKEN;
      _checkCostThresholds();

      const parsed = _parseJSONSafe(resp.text);
      if (!parsed || !parsed.verdict) throw new Error('JSON 파싱 실패');

      const result = {
        verdict: parsed.verdict,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason || '',
        matched_anchor: parsed.matched_anchor || null,
        is_post_review: true,
        from_cache: false,
        judged_at: new Date().toISOString()
      };
      _judgmentCache.set(cacheKey, result);
      return result;

    } catch (e) {
      lastError = e;
      console.warn(`[C1-5] classifyPostReview attempt ${attempt} failed:`, e.message);
      if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { verdict: 'undetermined', confidence: 0, reason: `Sonnet 판정 실패: ${lastError?.message || 'unknown'}`, is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
}

function _autoApproveIfEligible(component, verdict, sid) {
  if (verdict.verdict !== 'elaboration') return false;
  if (verdict.confidence < 0.85) return false;
  const exists = (inventionScope.approved_expansions || []).some(e => e.component === component.name);
  if (exists) return false;
  if (!inventionScope.approved_expansions) inventionScope.approved_expansions = [];
  const expansion = {
    type: 'elaboration', component: component.name, anchor_theme: null,
    approved_at: new Date().toISOString(), approved_by: 'auto',
    approval_reason: verdict.reason, originating_step: sid, confidence: verdict.confidence
  };
  inventionScope.approved_expansions.push(expansion);
  _appendAuditLog('expansion_auto_approved', expansion);
  return true;
}

async function runScopeJudgment(sid) {
  const result = scopeCheckResults[sid];
  if (!result) return null;
  if (!result.novel_components || result.novel_components.length === 0) {
    result.verdicts = [];
    result.judgment_status = 'no_novel';
    return result;
  }

  const verdicts = [];
  const isPostReview = sid === 'step_13_applied' || sid === 'step_13_applied_method';
  const originalText = isPostReview
    ? (sid === 'step_13_applied' ? outputs.step_08 : outputs.step_12)
    : null;

  for (const comp of result.novel_components) {
    let v;
    if (isPostReview) {
      v = await classifyNovelComponent_postReview(comp, comp.context_snippet, originalText);
    } else {
      v = await classifyNovelComponent(comp, comp.context_snippet);
    }
    v.component = comp.name;
    verdicts.push(v);
    const approved = _autoApproveIfEligible(comp, v, sid);
    v.auto_approved = approved;
  }

  result.verdicts = verdicts;
  result.judgment_status = 'ok';
  result.judgment_at = new Date().toISOString();
  result.cost_tracking_snapshot = { ..._costTracking };
  saveProject(true);
  return result;
}

async function runAllJudgments() {
  if (!inventionScope?.locked_at) {
    App.showToast('발명 범위가 확정되지 않았습니다', 'warning');
    return;
  }
  const sids = Object.keys(scopeCheckResults);
  const totalBefore = _costTracking.judgment_calls;
  for (const sid of sids) {
    if (_costTracking.stopped_100) break;
    await runScopeJudgment(sid);
  }
  const delta = _costTracking.judgment_calls - totalBefore;
  App.showToast(
    `판정 완료: ${delta}회 추가 호출 (누적 $${_costTracking.estimated_cost_usd.toFixed(3)})`,
    'success'
  );
}

async function extractInventionScope() {
  const input = document.getElementById('projectInput')?.value || '';
  const trimmed = input.trim();
  if (trimmed.length < 10) {
    App.showToast('발명 설명을 입력해주세요 (최소 10자)', 'error');
    return;
  }
  if (trimmed.length < 50) {
    App.showToast('발명 설명이 짧습니다 (권장 50자 이상). 추출 결과가 부실할 수 있습니다.', 'warning');
  }
  if (globalProcessing) return;
  setGlobalProcessing(true);
  try {
    const prompt = `${INVENTION_SCOPE_SCHEMA_INSTRUCTION}\n\n<invention_description>\n${input}\n</invention_description>`;
    let resp = await App.callClaudeSonnet(prompt, 8192);
    let parsed = _parseJSONSafe(resp.text);
    if (!parsed || !parsed.core_components) {
      // 1차 실패 시 스키마 준수 강화 지시로 1회 재시도(모델 JSON 미준수는 흔히 재시도로 해소)
      resp = await App.callClaudeSonnet(prompt + '\n\n★ 반드시 위 스키마의 순수 JSON 객체만 출력하라. 코드펜스·설명·주석 금지. { 로 시작해 } 로 끝내라.', 8192);
      parsed = _parseJSONSafe(resp.text);
    }
    if (!parsed || !parsed.core_components) {
      const raw = (resp && typeof resp.text === 'string') ? resp.text : '';
      console.error('[발명 범위] 파싱 실패 · stopReason=', resp && resp.stopReason, '· len=', raw.length, '· raw(앞 800자)=', raw.slice(0, 800));
      let msg = '발명 범위 추출 실패: ';
      if (!raw.trim()) msg += '모델 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.';
      else if (resp && resp.stopReason === 'max_tokens') msg += '응답이 잘렸습니다(분량 초과). 발명 설명을 더 간결히 정리한 뒤 다시 시도해주세요.';
      else msg += 'JSON 형식이 아닙니다. 다시 시도하거나 브라우저 콘솔(F12)에서 원문을 확인해주세요.';
      App.showToast(msg, 'error');
      return;
    }
    // [§6-1] 구성 명칭 세대 변경 추적 — 구 baseline 구성명 → 신 parsed 구성명 diff
    const _oldComps = ((inventionScope && inventionScope.baseline && inventionScope.baseline.core_components) || []).map(c => c && c.name).filter(Boolean);
    inventionScope = {
      locked_at: new Date().toISOString(),
      locked_by: App.currentUser?.id || 'unknown',
      source_text_hash: input.length + '_' + input.slice(0, 20),
      baseline: parsed,
      approved_expansions: [],
      audit_log: [],
      _previous_versions: inventionScope?._previous_versions || []
    };
    try{ if(typeof _onComponentsChanged==='function')_onComponentsChanged(_oldComps, (parsed.core_components||[]).map(c=>c&&c.name).filter(Boolean)); }catch(_e){}
    saveProject(true);
    renderInventionScopePanel();
    App.showToast('발명 범위가 확정되었습니다', 'success');
  } catch (e) {
    App.showToast('발명 범위 추출 실패: ' + e.message, 'error');
  } finally {
    setGlobalProcessing(false);
  }
}

function unlockInventionScope() {
  if (!inventionScope) return;
  if (!confirm('발명 범위를 재확정하시겠습니까? 이전 범위 이력은 보관됩니다.')) return;
  inventionScope._previous_versions = inventionScope._previous_versions || [];
  const archived = Object.assign({}, inventionScope, { archived_at: new Date().toISOString() });
  delete archived._previous_versions;
  inventionScope._previous_versions.push(archived);
  inventionScope.locked_at = null;
  inventionScope.baseline = null;
  saveProject(true);
  renderInventionScopePanel();
}

function renderInventionScopePanel() {
  const panel = document.getElementById('invention-scope-panel');
  if (!panel) return;
  if (!inventionScope || !inventionScope.locked_at) {
    panel.className = 'scope-panel';
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
      <div><span class="ico" data-icon="search"></span> <strong style="font-size:13px">발명 범위</strong>
      <span style="font-size:11px;color:var(--dt-g500);margin-left:6px">범위를 확정하면 이후 스텝에서 범위 초과 여부를 검증합니다.</span></div>
      <button class="btn btn-outline btn-sm" onclick="extractInventionScope()">범위 확정</button>
    </div>`;
    return;
  }
  const b = inventionScope.baseline;
  const lockedDate = new Date(inventionScope.locked_at).toLocaleDateString('ko-KR');
  const prevCount = (inventionScope._previous_versions || []).length;
  const prevBadge = prevCount ? `<span class="badge badge-neutral" style="margin-left:6px;font-size:10px">이전 ${prevCount}건</span>` : '';

  // [C1-6a] 구성요소 칩 (편집 가능)
  const comps = (b.core_components || []).map(c => {
    const cid = App.escapeHtml(c.id || c.name);
    return `<span class="scope-chip" onclick="editComponent('${cid.replace(/'/g,"\\'")}')">${App.escapeHtml(c.name)}<span style="color:var(--dt-g500);margin-left:4px;font-size:10px">${App.escapeHtml(c.role||'')}</span><span class="chip-edit-icon">✎</span></span>`;
  }).join('');

  // 핵심 기능
  const funcs = (b.core_functions || []).map(f =>
    `<li style="font-size:12px;margin-bottom:2px">${App.escapeHtml(f.desc)} <span style="color:var(--dt-g500)">[${(f.component_refs||[]).join(',')}]</span></li>`
  ).join('');
  const nonscope = (b.explicit_nonscope || []).length
    ? `<div style="margin-top:6px;font-size:11px;color:var(--dt-g500)">제외: ${b.explicit_nonscope.map(n => App.escapeHtml(n)).join(', ')}</div>` : '';

  // [C1-6a] 승인된 확장
  const expansions = inventionScope.approved_expansions || [];
  const expansionHtml = expansions.length === 0
    ? `<p class="scope-empty">청구항 생성 후 검증이 실행되면 여기에 승인된 확장 요소가 표시됩니다.</p>`
    : expansions.map(e =>
        `<span class="scope-chip" style="background:var(--dt-brand-light)">${App.escapeHtml(e.component)} <small style="color:var(--dt-g500)">(${App.escapeHtml(e.type||'')})</small> <button onclick="removeExpansion('${App.escapeHtml(e.component).replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--dt-g500);padding:0;margin-left:2px">×</button></span>`
      ).join('');

  panel.className = 'scope-panel locked';
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div><span class="ico" data-icon="lock"></span> <strong style="font-size:13px">발명 범위 확정됨</strong>
    <span style="font-size:11px;color:var(--dt-g500);margin-left:6px">${lockedDate}</span>${prevBadge}</div>
    <button class="btn btn-ghost btn-sm" onclick="unlockInventionScope()">재확정</button>
  </div>
  <div class="scope-section">
    <div class="scope-section-title clickable" onclick="editProblemSpace()">과제 <span class="edit-icon">✎</span></div>
    <div class="scope-section-content">${App.escapeHtml(b.problem_space || '')}</div>
  </div>
  <div class="scope-section">
    <div class="scope-section-title clickable" onclick="editSolutionSpace()">해결 <span class="edit-icon">✎</span></div>
    <div class="scope-section-content">${App.escapeHtml(b.solution_space || '')}</div>
  </div>
  <div class="scope-section">
    <div class="scope-section-title">핵심 구성 (${(b.core_components||[]).length}) <button class="scope-add-btn" onclick="addComponent()">+ 추가</button></div>
    <div class="scope-components">${comps}</div>
  </div>
  <details class="scope-section">
    <summary class="scope-section-title" style="cursor:pointer">핵심 기능 (${(b.core_functions||[]).length}건)</summary>
    <ul style="margin:4px 0 0 16px;padding:0">${funcs}</ul>
    ${nonscope}
  </details>
  <details class="scope-section">
    <summary class="scope-section-title" style="cursor:pointer">승인된 확장 (${expansions.length})</summary>
    <div class="scope-components" style="margin-top:4px">${expansionHtml}</div>
  </details>`;
}

// ═══════════ [C1-6a] BASELINE 편집 UI ═══════════

function _appendAuditLog(action, data) {
  if (!inventionScope) return;
  if (!inventionScope.audit_log) inventionScope.audit_log = [];
  inventionScope.audit_log.push({
    action,
    data,
    timestamp: new Date().toISOString(),
    user: App.currentUser?.id || 'unknown'
  });
}

function editComponent(componentId) {
  if (!inventionScope?.baseline) return;
  const comp = inventionScope.baseline.core_components.find(c =>
    (c.id || c.name) === componentId);
  if (!comp) return;
  _editingComponentId = componentId;
  document.getElementById('scopeComponentModalTitle').textContent = '구성요소 편집';
  document.getElementById('scope-comp-name').value = comp.name || '';
  document.getElementById('scope-comp-role').value = comp.role || '';
  document.getElementById('scope-comp-delete-btn').style.display = '';
  renderAliasesInModal(comp.aliases || []);
  setupAliasInputHandler();
  document.getElementById('scopeComponentModal').style.display = 'flex';
  document.getElementById('scope-comp-name').focus();
}

function addComponent() {
  if (!inventionScope?.baseline) return;
  _editingComponentId = null;
  document.getElementById('scopeComponentModalTitle').textContent = '구성요소 추가';
  document.getElementById('scope-comp-name').value = '';
  document.getElementById('scope-comp-role').value = '';
  document.getElementById('scope-comp-delete-btn').style.display = 'none';
  renderAliasesInModal([]);
  setupAliasInputHandler();
  document.getElementById('scopeComponentModal').style.display = 'flex';
  document.getElementById('scope-comp-name').focus();
}

function closeScopeComponentModal() {
  document.getElementById('scopeComponentModal').style.display = 'none';
  _editingComponentId = null;
}

function renderAliasesInModal(aliases) {
  _modalAliases = [...aliases];
  const container = document.getElementById('scope-aliases-container');
  if (!container) return;
  container.innerHTML = _modalAliases.map((a, i) =>
    `<span class="alias-tag">${App.escapeHtml(a)}<button onclick="removeAliasAt(${i})">×</button></span>`
  ).join('');
}

function removeAliasAt(index) {
  _modalAliases.splice(index, 1);
  renderAliasesInModal(_modalAliases);
}

function setupAliasInputHandler() {
  const input = document.getElementById('scope-alias-input');
  if (!input || input._bound) return;
  input._bound = true;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !_modalAliases.includes(val)) {
        _modalAliases.push(val);
        renderAliasesInModal(_modalAliases);
      }
      input.value = '';
    }
  });
}

function saveComponent() {
  const name = document.getElementById('scope-comp-name').value.trim();
  const role = document.getElementById('scope-comp-role').value.trim();
  if (!name) { App.showToast('이름은 필수입니다', 'error'); return; }
  if (!inventionScope?.baseline) return;
  if (!Array.isArray(inventionScope.baseline.core_components)) {
    inventionScope.baseline.core_components = [];
  }
  const components = inventionScope.baseline.core_components;

  if (_editingComponentId === null) {
    const newId = 'c' + Date.now();
    components.push({ id: newId, name, role: role || undefined, aliases: [..._modalAliases] });
    _appendAuditLog('component_added', { id: newId, name });
  } else {
    const idx = components.findIndex(c => (c.id || c.name) === _editingComponentId);
    if (idx === -1) { App.showToast('구성요소를 찾을 수 없습니다', 'error'); closeScopeComponentModal(); return; }
    const prev = Object.assign({}, components[idx]);
    components[idx].name = name;
    components[idx].role = role || undefined;
    components[idx].aliases = [..._modalAliases];
    _appendAuditLog('component_edited', { id: _editingComponentId, before: prev, after: components[idx] });
  }
  saveProject(true);
  renderInventionScopePanel();
  closeScopeComponentModal();
  App.showToast(_editingComponentId ? '구성요소가 수정되었습니다' : '구성요소가 추가되었습니다', 'success');
}

function deleteComponent() {
  if (_editingComponentId === null) return;
  if (!inventionScope?.baseline) return;
  const components = inventionScope.baseline.core_components;
  const idx = components.findIndex(c => (c.id || c.name) === _editingComponentId);
  if (idx === -1) return;
  const comp = components[idx];
  if (!confirm(`"${comp.name}" 구성요소를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
  const removed = components.splice(idx, 1)[0];
  _appendAuditLog('component_deleted', { id: _editingComponentId, data: removed });
  saveProject(true);
  renderInventionScopePanel();
  closeScopeComponentModal();
  App.showToast('구성요소가 삭제되었습니다', 'success');
}

function editProblemSpace() {
  if (!inventionScope?.baseline) return;
  const current = inventionScope.baseline.problem_space || '';
  const newVal = prompt('과제 설명을 입력하세요:', current);
  if (newVal === null) return;
  const trimmed = newVal.slice(0, 300);
  _appendAuditLog('problem_space_edited', { before: current, after: trimmed });
  inventionScope.baseline.problem_space = trimmed;
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('과제가 수정되었습니다', 'success');
}

function editSolutionSpace() {
  if (!inventionScope?.baseline) return;
  const current = inventionScope.baseline.solution_space || '';
  const newVal = prompt('해결 방법을 입력하세요:', current);
  if (newVal === null) return;
  const trimmed = newVal.slice(0, 300);
  _appendAuditLog('solution_space_edited', { before: current, after: trimmed });
  inventionScope.baseline.solution_space = trimmed;
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('해결 방법이 수정되었습니다', 'success');
}

function removeExpansion(componentName) {
  if (!inventionScope?.approved_expansions) return;
  if (!confirm(`"${componentName}" 승인을 해제하시겠습니까?`)) return;
  const idx = inventionScope.approved_expansions.findIndex(e => e.component === componentName);
  if (idx === -1) return;
  const removed = inventionScope.approved_expansions.splice(idx, 1)[0];
  _appendAuditLog('expansion_removed', removed);
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('확장 승인이 해제되었습니다', 'success');
}

// ═══════════ [C1-6b] 판정 결과 UI ═══════════

function _verdictLabel(verdict) {
  return { elaboration: '범위 내 구체화', strategic_anchor: '전략적 확장', drift: '범위 이탈', undetermined: '판정 보류' }[verdict] || verdict;
}
function _verdictBadgeClass(verdict) {
  return { elaboration: 'verdict-elaboration', strategic_anchor: 'verdict-anchor', drift: 'verdict-drift', undetermined: 'verdict-undetermined' }[verdict] || '';
}
function _verdictIcon(verdict) {
  return { elaboration: '✓', strategic_anchor: '↗', drift: '!', undetermined: '?' }[verdict] || '·';
}

function renderScopeBadgeSummary(sid) {
  const result = scopeCheckResults[sid];
  if (!result || !result.verdicts || result.verdicts.length === 0) return '';
  const verdicts = result.verdicts;
  const driftCount = verdicts.filter(v => v.verdict === 'drift').length;
  const undetCount = verdicts.filter(v => v.verdict === 'undetermined').length;
  const total = verdicts.length;
  let summary;
  if (driftCount > 0) {
    summary = `<span class="scope-badge verdict-drift" onclick="openScopeDetailPanel('${sid}')">! 범위 이탈 ${driftCount}건 / 전체 ${total}건</span>`;
  } else if (undetCount > 0) {
    summary = `<span class="scope-badge verdict-undetermined" onclick="openScopeDetailPanel('${sid}')">? 판정 보류 ${undetCount}건</span>`;
  } else {
    summary = `<span class="scope-badge verdict-elaboration" onclick="openScopeDetailPanel('${sid}')">✓ 범위 내 ${total}건 전부 확인됨</span>`;
  }
  return `<div class="scope-badge-wrapper">${summary}</div>`;
}

function renderScopeVerificationSection() {
  const summaryEl = document.getElementById('scope-verification-summary');
  const detailsEl = document.getElementById('scope-verification-details');
  if (!summaryEl || !detailsEl) return;
  // ── [G5] 통합 리뷰 엔진 마운트는 page4(renderPreview)로 이전됨(트리거·결과 동일 위치).
  if (!inventionScope?.locked_at) {
    summaryEl.innerHTML = `<div class="scope-notice">발명 범위가 확정되지 않았습니다. ① 발명 파악 단계에서 "범위 확정"을 먼저 진행하세요.</div>`;
    detailsEl.innerHTML = '';
    return;
  }
  const allSids = [...SCOPE_GUARDED_TEXT_STEPS, ...SCOPE_GUARDED_MERMAID_STEPS];
  const checkedSids = allSids.filter(sid => scopeCheckResults[sid]);
  if (checkedSids.length === 0) {
    summaryEl.innerHTML = `<div class="scope-notice">아직 검증된 스텝이 없습니다. 청구항·상세설명을 생성하면 자동으로 검증됩니다.</div>`;
    detailsEl.innerHTML = '';
    return;
  }
  let totalVerdicts = 0, totalDrift = 0, totalUndet = 0, totalElabor = 0, totalAnchor = 0, allConflicts = 0, totalCost = 0;
  for (const sid of checkedSids) {
    const r = scopeCheckResults[sid];
    if (r.verdicts) {
      totalVerdicts += r.verdicts.length;
      totalDrift += r.verdicts.filter(v => v.verdict === 'drift').length;
      totalUndet += r.verdicts.filter(v => v.verdict === 'undetermined').length;
      totalElabor += r.verdicts.filter(v => v.verdict === 'elaboration').length;
      totalAnchor += r.verdicts.filter(v => v.verdict === 'strategic_anchor').length;
    }
    if (r.conflicts) allConflicts += r.conflicts.length;
    if (r.cost_tracking_snapshot) totalCost = Math.max(totalCost, r.cost_tracking_snapshot.estimated_cost_usd || 0);
  }
  summaryEl.innerHTML = `
    <div class="scope-summary-cards">
      <div class="summary-card"><div class="summary-num">${totalVerdicts}</div><div class="summary-label">전체 판정</div></div>
      <div class="summary-card verdict-elaboration"><div class="summary-num">${totalElabor}</div><div class="summary-label">범위 내 구체화</div></div>
      <div class="summary-card verdict-anchor"><div class="summary-num">${totalAnchor}</div><div class="summary-label">전략적 확장</div></div>
      <div class="summary-card verdict-drift"><div class="summary-num">${totalDrift}</div><div class="summary-label">범위 이탈</div></div>
      <div class="summary-card verdict-undetermined"><div class="summary-num">${totalUndet}</div><div class="summary-label">판정 보류</div></div>
      ${allConflicts > 0 ? `<div class="summary-card verdict-drift"><div class="summary-num">${allConflicts}</div><div class="summary-label">도면 부호 충돌</div></div>` : ''}
    </div>
    <div class="scope-cost-info">
      누적 판정 비용: 약 $${totalCost.toFixed(3)}
      <button class="btn-small" onclick="runAllJudgments().then(renderScopeVerificationSection)">전체 재판정</button>
    </div>`;
  detailsEl.innerHTML = checkedSids.map(sid => renderSidVerificationCard(sid)).join('');
}

function renderSidVerificationCard(sid) {
  const r = scopeCheckResults[sid];
  if (!r) return '';
  const stepLabel = STEP_NAMES[sid] || sid;
  const verdicts = r.verdicts || [];
  const conflicts = r.conflicts || [];
  if (verdicts.length === 0 && conflicts.length === 0) {
    return `<div class="sid-verification-card"><div class="sid-card-header"><span class="sid-name">${App.escapeHtml(stepLabel)}</span><span class="sid-status">확인됨 · 신규 요소 없음</span></div></div>`;
  }
  const driftCount = verdicts.filter(v => v.verdict === 'drift').length;
  const undetCount = verdicts.filter(v => v.verdict === 'undetermined').length;
  let cardClass = 'sid-verification-card';
  if (driftCount > 0 || conflicts.length > 0) cardClass += ' has-drift';
  else if (undetCount > 0) cardClass += ' has-undetermined';
  return `<div class="${cardClass}">
    <div class="sid-card-header" onclick="toggleSidCard('${sid}')">
      <span class="sid-name">${App.escapeHtml(stepLabel)}</span>
      <span class="sid-counts">${verdicts.length > 0 ? `판정 ${verdicts.length}건` : ''}${conflicts.length > 0 ? ` · 도면 충돌 ${conflicts.length}건` : ''}</span>
      <span class="sid-toggle">▼</span>
    </div>
    <div class="sid-card-body" id="sid-card-body-${sid}" style="display:none">
      ${verdicts.map((v, i) => renderVerdictRow(sid, v, i)).join('')}
      ${conflicts.length > 0 ? renderConflictsSection(conflicts) : ''}
    </div>
  </div>`;
}

function toggleSidCard(sid) {
  const body = document.getElementById('sid-card-body-' + sid);
  if (!body) return;
  body.style.display = body.style.display !== 'none' ? 'none' : 'block';
}

function renderVerdictRow(sid, verdict, index) {
  const v = verdict.verdict;
  const badgeClass = _verdictBadgeClass(v);
  const label = _verdictLabel(v);
  const icon = _verdictIcon(v);
  const confidence = Math.round((verdict.confidence || 0) * 100);
  let statusText = '';
  if (verdict.auto_approved) statusText = '<span class="status-approved">자동 승인됨</span>';
  else if (verdict.manual_verdict === 'approved') statusText = '<span class="status-approved">수동 승인됨</span>';
  else if (verdict.manual_verdict === 'rejected') statusText = '<span class="status-rejected">거부됨</span>';
  else if (verdict.manual_verdict === 'regenerate_requested') statusText = '<span class="status-regenerating">재생성 요청됨</span>';
  let actions = '';
  if (v === 'drift' && !verdict.manual_verdict) {
    actions = `<div class="verdict-actions">
      <button class="btn-small btn-approve" onclick="approveDriftComponent('${sid}',${index})">승인 (범위 확장)</button>
      <button class="btn-small btn-reject" onclick="rejectDriftComponent('${sid}',${index})">거부 (사유 기록)</button>
      <button class="btn-small btn-regenerate" onclick="proposeRegeneration('${sid}',${index})">재생성 제안</button>
    </div>`;
  }
  return `<div class="verdict-row">
    <div class="verdict-main">
      <span class="scope-badge ${badgeClass}">${icon} ${label}</span>
      <span class="verdict-component">${App.escapeHtml(verdict.component || '')}</span>
      <span class="verdict-confidence">신뢰도 ${confidence}%</span>
      ${statusText}
    </div>
    ${verdict.reason ? `<div class="verdict-reason">${App.escapeHtml(verdict.reason)}</div>` : ''}
    ${actions}
  </div>`;
}

function renderConflictsSection(conflicts) {
  return `<div class="conflicts-section">
    <div class="conflicts-header">도면 간 참조부호 충돌</div>
    ${conflicts.map(c => `<div class="conflict-row">
      <span class="conflict-ref">부호 ${App.escapeHtml(String(c.ref || ''))}</span>
      <span>${(c.occurrences || []).map(o => `${o.sid}에서 "${App.escapeHtml(o.name)}"`).join(' ↔ ')}</span>
    </div>`).join('')}
  </div>`;
}

function approveDriftComponent(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result?.verdicts?.[verdictIndex]) return;
  const verdict = result.verdicts[verdictIndex];
  if (verdict.verdict !== 'drift' || verdict.manual_verdict) return;
  if (!inventionScope.approved_expansions) inventionScope.approved_expansions = [];
  const exists = inventionScope.approved_expansions.some(e => e.component === verdict.component);
  if (!exists) {
    inventionScope.approved_expansions.push({
      type: 'manual_drift_approved', component: verdict.component, anchor_theme: null,
      approved_at: new Date().toISOString(), approved_by: App.currentUser?.id || 'manual',
      approval_reason: '변리사 수동 승인 (drift → 확장으로 편입)',
      originating_step: sid, confidence: verdict.confidence, original_verdict: 'drift'
    });
  }
  verdict.manual_verdict = 'approved';
  verdict.manual_verdict_at = new Date().toISOString();
  _appendAuditLog('drift_manual_approved', { sid, component: verdict.component, confidence: verdict.confidence, reason: verdict.reason });
  saveProject(true);
  renderScopeVerificationSection();
  renderInventionScopePanel();
  App.showToast(`"${verdict.component}"을(를) 범위 확장으로 승인했습니다`, 'success');
}

function rejectDriftComponent(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result?.verdicts?.[verdictIndex]) return;
  const verdict = result.verdicts[verdictIndex];
  if (verdict.verdict !== 'drift' || verdict.manual_verdict) return;
  const reason = prompt(`"${verdict.component}"을(를) 범위 이탈로 거부합니다.\n거부 사유를 입력하세요:`, '');
  if (reason === null) return;
  verdict.manual_verdict = 'rejected';
  verdict.manual_verdict_at = new Date().toISOString();
  verdict.manual_verdict_reason = reason || '(사유 미기재)';
  _appendAuditLog('drift_manual_rejected', { sid, component: verdict.component, confidence: verdict.confidence, verdict_reason: verdict.reason, rejection_reason: reason || '(사유 미기재)' });
  saveProject(true);
  renderScopeVerificationSection();
  App.showToast(`"${verdict.component}" 거부 기록됨`, 'info');
}

function openScopeDetailPanel(sid) {
  switchTab(3);
  renderScopeVerificationSection();
  setTimeout(() => {
    const body = document.getElementById('sid-card-body-' + sid);
    if (body) { body.style.display = 'block'; body.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 100);
}

// ═══════════ [C1-7] DRIFT 재생성 제안 ═══════════
let _regenerationContext = null;

function proposeRegeneration(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result || !result.verdicts || !result.verdicts[verdictIndex]) return;
  const targetVerdict = result.verdicts[verdictIndex];
  if (targetVerdict.verdict !== 'drift') return;
  if (targetVerdict.manual_verdict) {
    App.showToast('이미 처리된 항목입니다', 'info');
    return;
  }
  const allDrifts = result.verdicts
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.verdict === 'drift' && !v.manual_verdict);
  _regenerationContext = {
    sid,
    primaryVerdictIndex: verdictIndex,
    driftOptions: allDrifts.map(({ v, i }) => ({
      index: i,
      component: v.component,
      reason: v.reason,
      confidence: v.confidence,
      selected: true
    }))
  };
  renderRegenerationModal();
  document.getElementById('regenerationProposalModal').style.display = 'flex';
}

function renderRegenerationModal() {
  if (!_regenerationContext) return;
  const ctx = _regenerationContext;
  const stepLabel = STEP_NAMES[ctx.sid] || ctx.sid;
  const targetHtml = `
    <div class="regeneration-target">
      <div class="target-label">재생성 대상 스텝</div>
      <div class="target-name">${App.escapeHtml(ctx.sid)} · ${App.escapeHtml(stepLabel)}</div>
    </div>
    <div class="regeneration-drift-list">
      <div class="drift-list-label">제외할 범위 이탈 요소 (체크하여 선택)</div>
      ${ctx.driftOptions.map(opt => `
        <label class="drift-option">
          <input type="checkbox" ${opt.selected ? 'checked' : ''} onchange="toggleDriftOption(${opt.index})" />
          <span class="drift-option-name">${App.escapeHtml(opt.component)}</span>
          <span class="drift-option-confidence">신뢰도 ${Math.round(opt.confidence * 100)}%</span>
          <div class="drift-option-reason">${App.escapeHtml(opt.reason || '')}</div>
        </label>
      `).join('')}
    </div>`;
  document.getElementById('regeneration-target-info').innerHTML = targetHtml;
  const downstreamSids = _getDownstreamSids(ctx.sid);
  const downstreamHtml = downstreamSids.length === 0
    ? '<p class="no-downstream">영향받는 이후 단계가 없습니다.</p>'
    : `<div class="downstream-label">무효화될 이후 단계 (${downstreamSids.length}개)</div>
      <ul class="downstream-list">
        ${downstreamSids.map(s => {
          const label = STEP_NAMES[s] || s;
          const hasOutput = outputs[s] ? '✓ 작성됨' : '(미작성)';
          return `<li>${App.escapeHtml(s)} · ${App.escapeHtml(label)} <span class="downstream-status">${hasOutput}</span></li>`;
        }).join('')}
      </ul>`;
  document.getElementById('regeneration-downstream-list').innerHTML = downstreamHtml;
}

function toggleDriftOption(index) {
  if (!_regenerationContext) return;
  const opt = _regenerationContext.driftOptions.find(o => o.index === index);
  if (opt) opt.selected = !opt.selected;
  const btn = document.getElementById('regenerationExecuteBtn');
  const anySelected = _regenerationContext.driftOptions.some(o => o.selected);
  if (btn) {
    btn.disabled = !anySelected;
    btn.style.opacity = anySelected ? '1' : '0.5';
  }
}

function closeRegenerationModal() {
  document.getElementById('regenerationProposalModal').style.display = 'none';
  _regenerationContext = null;
}

function _getDownstreamSids(sid) {
  const visited = new Set();
  const queue = [sid];
  visited.add(sid);
  while (queue.length > 0) {
    const current = queue.shift();
    const deps = STEP_DEPENDENCIES[current];
    if (!deps) continue;
    const children = [...(deps.MUST || []), ...(deps.SHOULD || [])];
    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  visited.delete(sid);
  return [...visited];
}

async function executeRegeneration() {
  if (!_regenerationContext) return;
  const ctx = _regenerationContext;
  const selectedDrifts = ctx.driftOptions.filter(o => o.selected);
  if (selectedDrifts.length === 0) {
    App.showToast('제외할 요소를 하나 이상 선택하세요', 'info');
    return;
  }
  if (!inventionScope.negative_constraints) {
    inventionScope.negative_constraints = [];
  }
  const now = new Date().toISOString();
  for (const opt of selectedDrifts) {
    const existingIdx = inventionScope.negative_constraints.findIndex(
      n => n.component === opt.component
    );
    const entry = {
      component: opt.component,
      rejected_at: now,
      rejected_from_sid: ctx.sid,
      reason: 'drift 판정 재생성 - ' + (opt.reason || '변리사 명시적 제외'),
      regenerated_at: null
    };
    if (existingIdx === -1) {
      inventionScope.negative_constraints.push(entry);
    } else {
      inventionScope.negative_constraints[existingIdx] = entry;
    }
    const verdict = scopeCheckResults[ctx.sid].verdicts[opt.index];
    verdict.manual_verdict = 'regenerate_requested';
    verdict.manual_verdict_at = now;
  }
  _appendAuditLog('regeneration_proposed', {
    sid: ctx.sid,
    rejected_components: selectedDrifts.map(o => o.component)
  });
  const downstreamSids = _getDownstreamSids(ctx.sid);
  for (const dsid of downstreamSids) {
    if (outputs[dsid]) {
      delete outputs[dsid];
      delete outputTimestamps[dsid];
    }
    delete scopeCheckResults[dsid];
  }
  delete outputs[ctx.sid];
  delete outputTimestamps[ctx.sid];
  delete scopeCheckResults[ctx.sid];
  saveProject(true);
  closeRegenerationModal();
  const targetTab = _getTabForSid(ctx.sid);
  if (typeof switchTab === 'function' && targetTab !== null) {
    switchTab(targetTab);
  }
  renderScopeVerificationSection();
  renderInventionScopePanel();
  App.showToast('재생성 준비 완료. 해당 스텝을 다시 실행하세요.', 'success');
}

function _getTabForSid(sid) {
  const map = {
    step_06: 1, step_10: 1, step_20: 1,
    step_07_mermaid: 2, step_11_mermaid: 2,
    step_08: 2, step_12: 2, step_09: 2,
    step_13_applied: 3, step_13_applied_method: 3
  };
  return typeof map[sid] !== 'undefined' ? map[sid] : null;
}

