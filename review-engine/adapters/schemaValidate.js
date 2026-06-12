/**
 * review-engine/adapters/schemaValidate.js
 * ─────────────────────────────────────────────────────────────
 * 의존성 없는 최소 JSON-Schema(draft-07 부분집합) 검증기 — spec §4.3 출력 스키마 강제용.
 * 지원: type(object/array/string/boolean), required, properties, items, enum,
 *       additionalProperties:false(여분 키 차단 — RebuttalSet 계약: 완성문언 필드 금지).
 * IssueList/Verdict/RebuttalSet 검증에 충분. 범용 검증기 대체가 아니다.
 * @module review-engine/adapters/schemaValidate
 */

function checkNode(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  const t = schema.type;
  if (t === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${path}: object 기대, 실제 ${Array.isArray(value) ? 'array' : typeof value}`);
      return;
    }
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${path}.${req}: 필수 필드 누락`);
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in props)) errors.push(`${path}.${k}: 허용되지 않은 추가 필드(additionalProperties:false)`);
      }
    }
    for (const [k, sub] of Object.entries(props)) {
      if (k in value) checkNode(sub, value[k], `${path}.${k}`, errors);
    }
    return;
  }
  if (t === 'array') {
    if (!Array.isArray(value)) { errors.push(`${path}: array 기대, 실제 ${typeof value}`); return; }
    if (schema.items) value.forEach((it, i) => checkNode(schema.items, it, `${path}[${i}]`, errors));
    return;
  }
  if (t === 'string') {
    if (typeof value !== 'string') { errors.push(`${path}: string 기대, 실제 ${typeof value}`); return; }
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum 위반(${value} ∉ ${schema.enum.join('|')})`);
    return;
  }
  if (t === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${path}: boolean 기대, 실제 ${typeof value}`);
  }
}

/**
 * @param {Object} schema  draft-07 부분집합
 * @param {*} data
 * @returns {{ ok:boolean, errors:string[] }}
 */
export function validate(schema, data) {
  const errors = [];
  checkNode(schema, data, '$', errors);
  return { ok: errors.length === 0, errors };
}

export default { validate };
