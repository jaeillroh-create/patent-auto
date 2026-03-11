/* ═══════════════════════════════════════════════════════════════
   DIDIM IP Center — 컴포넌트 라이브러리 (바닐라 JS, 12종)
   ★ TDS 컴포넌트 클론 + DIDIM 커스텀 디자인
   ★ Tossface 이모지 통일 적용
   ★ 모든 컴포넌트는 design-tokens.css 참조
   ═══════════════════════════════════════════════════════════════ */

window.DT = (function () {
  'use strict';

  /* ─────────────────────────────────────────
     SVG 아이콘 라이브러리
  ───────────────────────────────────────── */
  const ICON_PATHS = {
    check:      '<polyline points="20 6 9 17 4 12"/>',
    x:          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevDown:   '<polyline points="6 9 12 15 18 9"/>',
    chevRight:  '<polyline points="9 18 15 12 9 6"/>',
    search:     '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    upload:     '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>',
    file:       '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    bell:       '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
    heart:      '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
    link:       '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
    star:       '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    external:   '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
    building:   '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="4" y1="7" x2="20" y2="7"/>',
    money:      '<circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a2.5 2.5 0 010 5H9v3"/>',
    edit:       '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
    copy:       '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    download:   '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus:      '<line x1="5" y1="12" x2="19" y2="12"/>',
    info:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    logout:     '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  };

  /**
   * SVG 아이콘 생성
   * @param {string} name - 아이콘 이름
   * @param {number} [size=14] - 크기 (px)
   * @param {string} [color='currentColor'] - 색상
   * @returns {string} SVG HTML 문자열
   */
  function icon(name, size, color) {
    size = size || 14;
    color = color || 'currentColor';
    const path = ICON_PATHS[name];
    if (!path) return '';
    return '<svg class="dt-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  /* ─────────────────────────────────────────
     Tossface 이모지 헬퍼
     — 시스템 이모지 대신 Tossface 폰트로 렌더링
  ───────────────────────────────────────── */
  /**
   * Tossface 이모지 span 생성
   * @param {string} emoji - 이모지 문자
   * @param {number} [size] - 폰트 크기 (px)
   * @returns {string} HTML 문자열
   */
  function tf(emoji, size) {
    const sizeAttr = size ? ' style="font-size:' + size + 'px"' : '';
    return '<span class="tf"' + sizeAttr + '>' + emoji + '</span>';
  }

  /* ─────────────────────────────────────────
     1. Button
     — 4 variant × 4 size + disabled + icon + loading
  ───────────────────────────────────────── */
  /**
   * 버튼 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.variant='primary'] - primary|secondary|ghost|danger
   * @param {string} [opts.size='md'] - sm|md|lg|xl
   * @param {boolean} [opts.disabled=false]
   * @param {boolean} [opts.loading=false]
   * @param {boolean} [opts.full=false] - 전체 너비
   * @param {string} [opts.icon] - 아이콘 이름
   * @param {string} [opts.text] - 버튼 텍스트
   * @param {string} [opts.onclick] - onclick 핸들러 문자열
   * @param {string} [opts.id] - 버튼 ID
   * @param {string} [opts.cls] - 추가 CSS 클래스
   * @param {string} [opts.style] - 인라인 스타일
   * @returns {string} HTML 문자열
   */
  function button(opts) {
    opts = opts || {};
    const v = opts.variant || 'primary';
    const s = opts.size || 'md';
    const iconSizes = { sm: 12, md: 14, lg: 16, xl: 16 };
    const iconColor = (v === 'ghost') ? 'var(--dt-g600)' : (v === 'secondary') ? 'var(--dt-brand)' : 'var(--dt-white)';

    let cls = 'dt-btn dt-btn-' + v + ' dt-btn-' + s;
    if (opts.full) cls += ' dt-btn-full';
    if (opts.loading) cls += ' dt-btn-loading';
    if (opts.cls) cls += ' ' + opts.cls;

    let attrs = '';
    if (opts.disabled) attrs += ' disabled';
    if (opts.onclick) attrs += ' onclick="' + opts.onclick + '"';
    if (opts.id) attrs += ' id="' + opts.id + '"';
    if (opts.style) attrs += ' style="' + opts.style + '"';

    let content = '';
    if (opts.icon) content += icon(opts.icon, iconSizes[s], opts.disabled ? 'var(--dt-g300)' : iconColor);
    if (opts.text) content += opts.text;

    return '<button class="' + cls + '"' + attrs + '>' + content + '</button>';
  }

  /* ─────────────────────────────────────────
     2. Badge
     — 5 variant + icon
  ───────────────────────────────────────── */
  /**
   * 뱃지 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.variant='brand'] - brand|success|warning|danger|neutral
   * @param {string} [opts.icon] - Tossface 이모지 (선택)
   * @param {string} opts.text
   * @returns {string} HTML 문자열
   */
  function badge(opts) {
    opts = opts || {};
    const v = opts.variant || 'brand';
    let html = '<span class="dt-badge dt-badge-' + v + '">';
    if (opts.icon) html += '<span class="dt-badge-icon tf">' + opts.icon + '</span>';
    html += opts.text + '</span>';
    return html;
  }

  /* ─────────────────────────────────────────
     3. SectionCard
     — icon + title + action 헤더 + body
  ───────────────────────────────────────── */
  /**
   * 섹션 카드 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.icon] - Tossface 이모지
   * @param {string} [opts.iconBg] - 아이콘 배경색
   * @param {string} [opts.title] - 제목
   * @param {string} [opts.action] - 우측 액션 텍스트/HTML
   * @param {string} [opts.badge] - 뱃지 HTML
   * @param {string} [opts.body] - 본문 HTML
   * @param {string} [opts.bodyPad] - none|compact|spacious (기본: default)
   * @param {string} [opts.id] - 카드 ID
   * @returns {string} HTML 문자열
   */
  function sectionCard(opts) {
    opts = opts || {};
    const padClass = opts.bodyPad === 'none' ? ' dt-scard-body--none'
      : opts.bodyPad === 'compact' ? ' dt-scard-body--compact'
      : opts.bodyPad === 'spacious' ? ' dt-scard-body--spacious'
      : '';
    const idAttr = opts.id ? ' id="' + opts.id + '"' : '';

    let html = '<div class="dt-scard"' + idAttr + '>';

    if (opts.title) {
      html += '<div class="dt-scard-head">';
      html += '<div class="dt-scard-head-left">';
      if (opts.icon) {
        const bg = opts.iconBg || 'var(--dt-brand-light)';
        html += '<div class="dt-scard-icon" style="background:' + bg + '">' + tf(opts.icon) + '</div>';
      }
      html += '<span class="dt-scard-title">' + opts.title + '</span>';
      if (opts.badge) html += opts.badge;
      html += '</div>';
      if (opts.action) html += '<div class="dt-scard-action">' + opts.action + '</div>';
      html += '</div>';
    }

    html += '<div class="dt-scard-body' + padClass + '">' + (opts.body || '') + '</div>';
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     4. StatCard
     — label + value + unit + sub
  ───────────────────────────────────────── */
  /**
   * 통계 카드 HTML 생성
   * @param {Object} opts
   * @param {string} opts.label
   * @param {string|number} opts.value
   * @param {string} [opts.unit]
   * @param {string} [opts.sub]
   * @param {string} [opts.color] - 값 색상
   * @returns {string} HTML 문자열
   */
  function statCard(opts) {
    opts = opts || {};
    const color = opts.color || 'var(--dt-g900)';
    let html = '<div class="dt-stat">';
    html += '<div class="dt-stat-label">' + opts.label + '</div>';
    html += '<div class="dt-stat-value" style="color:' + color + '">' + opts.value;
    if (opts.unit) html += '<span class="dt-stat-unit">' + opts.unit + '</span>';
    html += '</div>';
    if (opts.sub) html += '<div class="dt-stat-sub">' + opts.sub + '</div>';
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     5. Input
     — 36h / focus ring / icon / error / disabled
  ───────────────────────────────────────── */
  /**
   * 인풋 필드 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.placeholder]
   * @param {string} [opts.icon] - 좌측 아이콘 이름
   * @param {boolean} [opts.error=false]
   * @param {boolean} [opts.disabled=false]
   * @param {string} [opts.value]
   * @param {string} [opts.id]
   * @param {string} [opts.onchange] - oninput 핸들러 문자열
   * @param {string} [opts.size] - 'lg' for 44px height
   * @param {string} [opts.style] - 인라인 스타일
   * @param {string} [opts.type] - input type (text, email, password 등)
   * @returns {string} HTML 문자열
   */
  function input(opts) {
    opts = opts || {};
    let cls = 'dt-input-wrap';
    if (opts.error) cls += ' dt-input-wrap--error';
    if (opts.disabled) cls += ' dt-input-wrap--disabled';
    if (opts.size === 'lg') cls += ' dt-input-wrap--lg';

    const styleAttr = opts.style ? ' style="' + opts.style + '"' : '';

    let html = '<div class="' + cls + '"' + styleAttr + '>';
    if (opts.icon) html += icon(opts.icon, 14, 'var(--dt-g400)');
    html += '<input type="' + (opts.type || 'text') + '"';
    if (opts.placeholder) html += ' placeholder="' + opts.placeholder + '"';
    if (opts.disabled) html += ' disabled';
    if (opts.value != null) html += ' value="' + opts.value + '"';
    if (opts.id) html += ' id="' + opts.id + '"';
    if (opts.onchange) html += ' oninput="' + opts.onchange + '"';
    html += ' />';
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     6. Tag / Chip
     — 필터용 on/off + count + removable
  ───────────────────────────────────────── */
  /**
   * 태그/칩 HTML 생성
   * @param {Object} opts
   * @param {boolean} [opts.active=false]
   * @param {boolean} [opts.removable=false]
   * @param {number} [opts.count]
   * @param {string} opts.text
   * @param {string} [opts.onclick]
   * @returns {string} HTML 문자열
   */
  function tag(opts) {
    opts = opts || {};
    let cls = 'dt-tag';
    if (opts.active) cls += ' dt-tag--active';

    const clickAttr = opts.onclick ? ' onclick="' + opts.onclick + '"' : '';

    let html = '<span class="' + cls + '"' + clickAttr + '>';
    html += opts.text;
    if (opts.count != null) html += '<span class="dt-tag-count">' + opts.count + '</span>';
    if (opts.removable) html += '<span class="dt-tag-remove">✕</span>';
    html += '</span>';
    return html;
  }

  /* ─────────────────────────────────────────
     7. Progress
     — label + bar + percentage
  ───────────────────────────────────────── */
  /**
   * 프로그레스 바 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.label]
   * @param {number} [opts.value=0]
   * @param {number} [opts.max=100]
   * @param {string} [opts.color] - 바 색상
   * @param {boolean} [opts.showLabel=true]
   * @param {string} [opts.id] - fill 요소 ID (동적 업데이트용)
   * @returns {string} HTML 문자열
   */
  function progress(opts) {
    opts = opts || {};
    const value = opts.value || 0;
    const max = opts.max || 100;
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const color = opts.color || 'var(--dt-brand)';
    const showLabel = opts.showLabel !== false;

    let html = '<div class="dt-progress">';
    if (showLabel) {
      html += '<div class="dt-progress-head">';
      html += '<span class="dt-progress-label">' + (opts.label || '') + '</span>';
      html += '<span class="dt-progress-pct">' + pct + '%</span>';
      html += '</div>';
    }
    html += '<div class="dt-progress-track">';
    const idAttr = opts.id ? ' id="' + opts.id + '"' : '';
    html += '<div class="dt-progress-fill"' + idAttr + ' style="width:' + pct + '%;background:' + color + '"></div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * 프로그레스 바 값 업데이트
   * @param {string} fillId - fill 요소 ID
   * @param {number} value
   * @param {number} [max=100]
   */
  function updateProgress(fillId, value, max) {
    max = max || 100;
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const el = document.getElementById(fillId);
    if (el) {
      el.style.width = pct + '%';
      // 라벨 업데이트
      const parent = el.closest('.dt-progress');
      if (parent) {
        const pctEl = parent.querySelector('.dt-progress-pct');
        if (pctEl) pctEl.textContent = pct + '%';
      }
    }
  }

  /* ─────────────────────────────────────────
     8. Checklist
     — done/active/wait 3상태
  ───────────────────────────────────────── */
  const CHECK_STATUS_LABELS = { done: '완료', active: '진행중', wait: '대기' };

  /**
   * 체크리스트 HTML 생성
   * @param {Array<{label:string, status:string}>} items - status: done|active|wait
   * @returns {string} HTML 문자열
   */
  function checklist(items) {
    items = items || [];
    let html = '<div class="dt-checklist">';
    items.forEach(function (item) {
      const st = item.status || 'wait';
      const dotContent = st === 'done' ? icon('check', 9, 'var(--dt-white)') : '';
      html += '<div class="dt-check-item">';
      html += '<div class="dt-check-item-left">';
      html += '<div class="dt-check-dot dt-check-dot--' + st + '">' + dotContent + '</div>';
      html += '<span class="dt-check-label dt-check-label--' + st + '">' + item.label + '</span>';
      html += '</div>';
      html += '<span class="dt-check-status dt-check-status--' + st + '">' + CHECK_STATUS_LABELS[st] + '</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     9. DocRow
     — ok/warn/empty 3상태 + left border
  ───────────────────────────────────────── */
  const DOC_STATUS_MAP = {
    ok:    { emoji: '📄', btnVariant: 'ghost', btnText: '보기' },
    warn:  { emoji: '⚠️', btnVariant: 'ghost', btnText: '갱신' },
    empty: { emoji: '📋', btnVariant: 'primary', btnText: '업로드' },
  };

  /**
   * 문서 행 HTML 생성
   * @param {Object} opts
   * @param {string} opts.name - 서류명
   * @param {string} [opts.status='empty'] - ok|warn|empty
   * @param {string} [opts.fileName] - 파일명
   * @param {string} [opts.hint] - 힌트 텍스트
   * @param {boolean} [opts.required=false]
   * @param {string} [opts.onclick] - 버튼 onclick
   * @returns {string} HTML 문자열
   */
  function docRow(opts) {
    opts = opts || {};
    const st = opts.status || 'empty';
    const cfg = DOC_STATUS_MAP[st] || DOC_STATUS_MAP.empty;

    let html = '<div class="dt-docrow dt-docrow--' + st + '">';

    // 아이콘
    html += '<div class="dt-docrow-icon">' + tf(cfg.emoji) + '</div>';

    // 본문
    html += '<div class="dt-docrow-body">';
    html += '<div class="dt-docrow-name-row">';
    html += '<span class="dt-docrow-name">' + opts.name + '</span>';
    if (opts.required && st !== 'ok') html += '<span class="dt-docrow-required">필수</span>';
    if (st === 'ok') html += badge({ variant: 'success', text: '완료' });
    html += '</div>';
    if (opts.fileName) html += '<div class="dt-docrow-file">' + opts.fileName + '</div>';
    if (opts.hint) html += '<div class="dt-docrow-hint">' + tf('✦') + ' ' + opts.hint + '</div>';
    html += '</div>';

    // 액션 버튼
    const btnIcon = st === 'empty' ? 'upload' : undefined;
    html += button({
      variant: cfg.btnVariant,
      size: 'sm',
      icon: btnIcon,
      text: cfg.btnText,
      onclick: opts.onclick || '',
    });

    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     10. Accordion
     — open/close + accent bar + count
  ───────────────────────────────────────── */
  /**
   * 아코디언 HTML 생성
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string} [opts.sub]
   * @param {{done:number, total:number}} [opts.count]
   * @param {string} [opts.accent] - 좌측 액센트 바 색상
   * @param {boolean} [opts.open=false]
   * @param {string} opts.id - 고유 ID (토글에 필요)
   * @param {string} [opts.extra] - 우측 추가 HTML
   * @param {string} [opts.body] - 내부 HTML
   * @returns {string} HTML 문자열
   */
  function accordion(opts) {
    opts = opts || {};
    const open = opts.open || false;

    // 카운트 뱃지 색상 결정
    let countHtml = '';
    if (opts.count) {
      const c = opts.count;
      let countColor, countBg;
      if (c.done === c.total && c.total > 0) {
        countColor = 'var(--dt-success)';
        countBg = 'var(--dt-success-light)';
      } else if (c.done > 0) {
        countColor = 'var(--dt-brand)';
        countBg = 'var(--dt-brand-light)';
      } else {
        countColor = 'var(--dt-g400)';
        countBg = 'var(--dt-g100)';
      }
      countHtml = '<span class="dt-accordion-count" style="color:' + countColor + ';background:' + countBg + '">' + c.done + '/' + c.total + '</span>';
    }

    let html = '<div class="dt-accordion" id="' + opts.id + '">';

    // 헤더
    html += '<div class="dt-accordion-head' + (open ? ' dt-accordion-head--open' : '') + '" onclick="DT.toggleAccordion(\'' + opts.id + '\')">';
    html += '<div class="dt-accordion-left">';
    if (opts.accent) html += '<div class="dt-accordion-accent" style="background:' + opts.accent + '"></div>';
    html += '<div class="dt-accordion-info">';
    html += '<div class="dt-accordion-title-row">';
    html += '<span class="dt-accordion-title">' + opts.title + '</span>';
    html += countHtml;
    html += '</div>';
    if (opts.sub) html += '<p class="dt-accordion-sub">' + opts.sub + '</p>';
    html += '</div></div>';
    html += '<div class="dt-accordion-right">';
    if (opts.extra) html += opts.extra;
    html += '<div class="dt-accordion-chevron' + (open ? ' dt-accordion-chevron--open' : '') + '">' + icon('chevDown', 16) + '</div>';
    html += '</div></div>';

    // 본문
    html += '<div class="dt-accordion-body' + (open ? ' dt-accordion-body--open' : '') + '">';
    html += '<div class="dt-accordion-body-inner">' + (opts.body || '') + '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /**
   * 아코디언 토글
   * @param {string} id
   */
  function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const head = el.querySelector('.dt-accordion-head');
    const body = el.querySelector('.dt-accordion-body');
    const chevron = el.querySelector('.dt-accordion-chevron');
    if (!head || !body) return;

    const isOpen = body.classList.contains('dt-accordion-body--open');
    if (isOpen) {
      body.classList.remove('dt-accordion-body--open');
      head.classList.remove('dt-accordion-head--open');
      if (chevron) chevron.classList.remove('dt-accordion-chevron--open');
    } else {
      body.classList.add('dt-accordion-body--open');
      head.classList.add('dt-accordion-head--open');
      if (chevron) chevron.classList.add('dt-accordion-chevron--open');
    }
  }

  /* ─────────────────────────────────────────
     11. AnchorNav
     — 스크롤 기반 섹션 이동 탭
  ───────────────────────────────────────── */
  /**
   * 앵커 네비게이션 HTML 생성
   * @param {Object} opts
   * @param {Array<{id:string, label:string, icon?:string, errCount?:number}>} opts.items
   * @param {string} [opts.active] - 현재 활성 탭 ID
   * @param {string} [opts.onSelect] - 선택 핸들러 함수명 (인자로 id 전달)
   * @returns {string} HTML 문자열
   */
  function anchorNav(opts) {
    opts = opts || {};
    let html = '<div class="dt-anchornav">';
    (opts.items || []).forEach(function (item) {
      const isActive = item.id === opts.active;
      const cls = 'dt-anchornav-item' + (isActive ? ' dt-anchornav-item--active' : '');
      const clickAttr = opts.onSelect ? ' onclick="' + opts.onSelect + '(\'' + item.id + '\')"' : '';

      html += '<button class="' + cls + '"' + clickAttr + '>';
      if (item.icon) html += icon(item.icon, 13);
      html += item.label;
      if (item.errCount > 0) html += '<span class="dt-anchornav-err">' + item.errCount + '</span>';
      html += '</button>';
    });
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     12. GlobalNav
     — 전 페이지 공통 최상단 네비게이션
  ───────────────────────────────────────── */
  /**
   * 글로벌 네비게이션 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.activePage] - 현재 활성 메뉴
   * @param {Array<string>} [opts.menus] - 메뉴 항목 (기본: 특허/상표 관련)
   * @param {string} [opts.logoText='DIDIM IP'] - 로고 텍스트
   * @param {string} [opts.logoHref] - 로고 클릭 URL
   * @param {string} [opts.userName] - 사용자 이름
   * @param {string} [opts.rightHtml] - 우측 커스텀 HTML
   * @returns {string} HTML 문자열
   */
  function globalNav(opts) {
    opts = opts || {};
    const menus = opts.menus || ['특허 명세서', '상표 출원', '의견서 대응', '분할출원'];
    const logoText = opts.logoText || 'DIDIM IP';

    let html = '<div class="dt-gnav">';
    html += '<div class="dt-gnav-inner">';

    // 로고
    html += '<a class="dt-gnav-logo"' + (opts.logoHref ? ' href="' + opts.logoHref + '"' : '') + '>';
    html += '<div class="dt-gnav-logo-circle"><div class="dt-gnav-logo-dot"></div></div>';
    html += '<span class="dt-gnav-logo-text">' + logoText + '</span>';
    html += '</a>';

    // 메뉴
    html += '<div class="dt-gnav-menu">';
    menus.forEach(function (m) {
      const isActive = m === opts.activePage;
      const cls = 'dt-gnav-link' + (isActive ? ' dt-gnav-link--active' : '');
      html += '<button class="' + cls + '">' + m + '</button>';
    });
    html += '</div>';

    html += '<div class="dt-gnav-spacer"></div>';

    // 우측 영역
    html += '<div class="dt-gnav-right">';
    if (opts.rightHtml) {
      html += opts.rightHtml;
    } else if (opts.userName) {
      html += '<div class="dt-gnav-bell">' + icon('bell', 18) + '</div>';
      html += '<div class="dt-gnav-avatar">' + opts.userName.charAt(0) + '</div>';
    }
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  /* ─────────────────────────────────────────
     PromoBar (보너스)
     — Nav 상단 조건부 프로모션 바
  ───────────────────────────────────────── */
  /**
   * 프로모 바 HTML 생성
   * @param {Object} opts
   * @param {string} [opts.badge] - 뱃지 텍스트
   * @param {string} opts.text - 메인 텍스트
   * @param {string} [opts.cta] - CTA 버튼 텍스트
   * @param {string} [opts.onCtaClick] - CTA onclick
   * @param {string} [opts.onClose] - 닫기 onclick
   * @param {string} [opts.id]
   * @returns {string} HTML 문자열
   */
  function promoBar(opts) {
    opts = opts || {};
    const idAttr = opts.id ? ' id="' + opts.id + '"' : '';
    let html = '<div class="dt-promo" style="position:relative"' + idAttr + '>';
    if (opts.badge) html += '<span class="dt-promo-badge">' + opts.badge + '</span>';
    html += '<span>' + opts.text + '</span>';
    if (opts.cta) {
      const ctaClick = opts.onCtaClick ? ' onclick="' + opts.onCtaClick + '"' : '';
      html += '<button class="dt-promo-cta"' + ctaClick + '>' + opts.cta + '</button>';
    }
    if (opts.onClose) html += '<button class="dt-promo-close" onclick="' + opts.onClose + '">✕</button>';
    html += '</div>';
    return html;
  }

  /* ─────────────────────────────────────────
     Toast (기존 showToast와 호환)
     — DT 스타일의 토스트 알림
  ───────────────────────────────────────── */
  const TOAST_ICONS = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  /**
   * 토스트 알림 표시
   * @param {string} message - 메시지
   * @param {string} [type='info'] - success|error|info|warning
   * @param {number} [duration=3000] - 표시 시간 (ms)
   */
  function toast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    let container = document.getElementById('dtToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dtToastContainer';
      container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;gap:8px;pointer-events:none';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:var(--dt-r-md);background:var(--dt-g900);color:var(--dt-white);font-size:var(--dt-f-md);font-weight:var(--dt-w-medium);box-shadow:var(--dt-sh-lg);animation:toastIn 0.3s ease;pointer-events:auto;max-width:400px;font-family:var(--dt-font)';

    el.innerHTML = '<span class="tf">' + (TOAST_ICONS[type] || 'ℹ️') + '</span>' + message;
    container.appendChild(el);

    setTimeout(function () {
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, duration);
  }

  /* ─────────────────────────────────────────
     유틸리티 함수
  ───────────────────────────────────────── */
  /**
   * 컨테이너에 HTML 렌더링
   * @param {string} containerId - 대상 요소 ID
   * @param {string} html - HTML 문자열
   */
  function render(containerId, html) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = html;
  }

  /**
   * 컨테이너에 HTML 추가
   * @param {string} containerId
   * @param {string} html
   */
  function append(containerId, html) {
    const el = document.getElementById(containerId);
    if (el) el.insertAdjacentHTML('beforeend', html);
  }

  /* ─────────────────────────────────────────
     Public API
  ───────────────────────────────────────── */
  return {
    // 아이콘
    icon: icon,
    tf: tf,

    // 컴포넌트 (12종)
    button: button,
    badge: badge,
    sectionCard: sectionCard,
    statCard: statCard,
    input: input,
    tag: tag,
    progress: progress,
    updateProgress: updateProgress,
    checklist: checklist,
    docRow: docRow,
    accordion: accordion,
    toggleAccordion: toggleAccordion,
    anchorNav: anchorNav,
    globalNav: globalNav,

    // 보너스
    promoBar: promoBar,
    toast: toast,

    // 유틸
    render: render,
    append: append,

    // 아이콘 목록 (확장용)
    ICON_PATHS: ICON_PATHS,
  };
})();
