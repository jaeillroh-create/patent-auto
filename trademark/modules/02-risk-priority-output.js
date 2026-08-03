/* ============================================================
   상표출원 우선심사 자동화 시스템 - Step 렌더링 (Part 3)
   Step 5~8: 리스크평가, 비용산출, 우선심사, 문서출력
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM Steps 5-8] TM 모듈이 로드되지 않았습니다.');
    return;
  }

  // ============================================================
  // Step 5: 리스크 평가
  // ============================================================
  
  TM.renderStep5_Risk = function(container) {
    const p = TM.currentProject;
    const risk = p.riskAssessment || {};
    const fee = p.feeCalculation || {};
    
    // 비용 자동 계산
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    // KIPRIS API 키 확인
    const apiKey = TM.kiprisConfig?.apiKey || '';
    const defaultKey = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    const hasCustomApiKey = apiKey && apiKey !== defaultKey;
    
    const apiKeyWarning = !hasCustomApiKey ? `
      <div class="tm-api-warning" style="margin-bottom: 20px; padding: 16px; background: var(--dt-warning-light); border: 1px solid var(--dt-warning); border-radius: 10px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: var(--dt-warning);">KIPRIS API 키가 설정되지 않았습니다</h4>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: var(--dt-warning); line-height: 1.5;">
              정확한 리스크 평가를 위해 개인 API 키가 필요합니다. 기본 키는 호출 제한에 걸릴 수 있습니다.
            </p>
            <div style="display: flex; gap: 12px; align-items: center;">
              <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank" 
                 style="font-size: 12px; color: var(--dt-warning); text-decoration: underline;">
                👉 KIPRIS Plus에서 무료 API 키 발급받기
              </a>
              <button class="btn btn-sm" onclick="TM.openSettings()" 
                      style="padding: 4px 12px; font-size: 12px; background: var(--dt-warning); color: white; border: none; border-radius: 4px; cursor: pointer;">
                설정에서 입력
              </button>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <div class="tm-api-ok" style="margin-bottom: 16px; padding: 10px 16px; background: var(--dt-success-light); border: 1px solid var(--dt-success); border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
        <span><span class="ico" data-icon="check-circle"></span></span>
        <span style="font-size: 13px; color: var(--dt-success);">KIPRIS API 키 설정됨</span>
      </div>
    `;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3><span class="ico" data-icon="chart"></span> 리스크 평가</h3>
      </div>
      
      ${apiKeyWarning}
      
      <!-- AI 평가 버튼 -->
      <div class="tm-risk-action-panel">
        <button class="btn btn-primary btn-lg" id="tm-risk-btn" data-action="tm-assess-risk">
          <span class="ico" data-icon="robot"></span> AI 리스크 종합 평가
        </button>
        <div class="tm-risk-progress" id="tm-risk-progress" style="display: none;">
          <div class="tm-progress-bar">
            <div class="tm-progress-fill tm-progress-indeterminate"></div>
          </div>
          <span class="tm-progress-text">AI가 종합 분석 중입니다...</span>
        </div>
      </div>
      
      ${risk.level ? `
        <!-- 리스크 결과 대시보드 -->
        <div class="tm-risk-dashboard ${risk.level}">
          <!-- 리스크 수준 표시 -->
          <div class="tm-risk-level-display">
            <div class="tm-risk-icon">
              ${risk.level === 'high' ? '⚠️' : risk.level === 'medium' ? '⚡' : '✅'}
            </div>
            <div class="tm-risk-level-text">
              <div class="tm-risk-main-text">
                ${risk.level === 'high' ? '높은 위험' : risk.level === 'medium' ? '주의 필요' : '낮은 위험'}
              </div>
              <div class="tm-risk-sub-text">등록 가능성 ${TM.getRiskProbability(risk.level)}</div>
            </div>
          </div>
          
          <!-- 핵심 지표 -->
          <div class="tm-risk-metrics">
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${p.similarityEvaluations?.length || 0}</div>
              <div class="tm-metric-label">검토 상표</div>
            </div>
            <div class="tm-risk-metric warning">
              <div class="tm-metric-value">${risk.conflictCount || 0}</div>
              <div class="tm-metric-label">충돌 우려</div>
            </div>
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${p.designatedGoods?.length || 0}</div>
              <div class="tm-metric-label">상품류</div>
            </div>
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${TM.formatNumber(fee.totalFee || 0)}</div>
              <div class="tm-metric-label">예상 비용(원)</div>
            </div>
          </div>
        </div>
        
        <!-- 상세 분석 & 권고사항 -->
        <div class="tm-risk-analysis">
          ${risk.details ? `
            <div class="tm-analysis-section">
              <h4><span class="ico" data-icon="clipboard"></span> 상세 분석</h4>
              <div class="tm-analysis-content">${TM.formatRiskDetails(risk.details)}</div>
            </div>
          ` : ''}
          
          ${risk.recommendation ? `
            <div class="tm-analysis-section recommendation">
              <h4><span class="ico" data-icon="lightbulb"></span> 권고사항</h4>
              <div class="tm-analysis-content">${TM.formatRiskRecommendation(risk.recommendation)}</div>
            </div>
          ` : ''}
        </div>
        
        <!-- 비용 명세 (접힘) -->
        <details class="tm-fee-accordion" open>
          <summary><span class="ico" data-icon="money"></span> 비용 명세</summary>
          <div class="tm-fee-content">
            <div class="tm-fee-list">
              ${TM.renderFeeBreakdown(fee)}
            </div>
          </div>
        </details>
      ` : `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon"><span class="ico" data-icon="chart"></span></div>
          <h4>리스크 평가를 실행하세요</h4>
          <p>유사도 평가 결과, 지정상품, 상표 유형 등을 AI가 종합 분석합니다.</p>
        </div>
      `}
      
      <!-- 평가 기준 -->
      <details class="tm-accordion">
        <summary><span class="ico" data-icon="clipboard"></span> 평가 기준 안내</summary>
        <div class="tm-accordion-content">
          <div class="tm-criteria-grid">
            <div class="tm-criteria-item high">
              <div class="tm-criteria-label">⛔ 높은 위험</div>
              <div class="tm-criteria-desc">유사군 중복 + 상표 유사 → 거절 가능성 높음</div>
            </div>
            <div class="tm-criteria-item medium">
              <div class="tm-criteria-label"><span class="ico" data-icon="warning"></span> 중간 위험</div>
              <div class="tm-criteria-desc">유사군 중복, 상표 다소 유사 → 심사관 판단</div>
            </div>
            <div class="tm-criteria-item low">
              <div class="tm-criteria-label"><span class="ico" data-icon="check-circle"></span> 낮은 위험</div>
              <div class="tm-criteria-desc">유사군 비중복 또는 상표 상이 → 등록 가능성 높음</div>
            </div>
          </div>
        </div>
      </details>
    `;
  };
  
  // 리스크 권고사항 포맷팅
  TM.formatRiskRecommendation = function(text) {
    if (!text) return '';
    // 번호 매기기나 항목을 하이라이트
    return text
      .replace(/첫째,|둘째,|셋째,|넷째,/g, '<strong>$&</strong>')
      .replace(/\n/g, '<br>');
  };
  
  TM.getRiskProbability = function(level) {
    const probs = {
      high: '30% 이하',
      medium: '50~70%',
      low: '80% 이상'
    };
    return probs[level] || '-';
  };
  
  TM.formatRiskDetails = function(details) {
    if (!details) return '';
    return TM.escapeHtml(details).replace(/\n/g, '<br>');
  };
  
  TM.assessRisk = async function() {
    const p = TM.currentProject;
    
    if (!p.trademarkName) {
      App.showToast('상표명을 먼저 입력하세요.', 'warning');
      return;
    }
    
    // UI 업데이트 - 프로그레스 표시
    const btn = document.getElementById('tm-risk-btn');
    const progress = document.getElementById('tm-risk-progress');
    const hint = document.getElementById('tm-risk-hint');
    
    if (btn) {
      btn.disabled = true;
      btn.style.display = 'none';
    }
    if (progress) progress.style.display = 'flex';
    if (hint) hint.style.display = 'none';
    
    try {
      // ★ 유사군 기반 평가 데이터 수집
      const searchResults = p.searchResults?.text || [];
      const totalSearched = searchResults.length;
      
      // 유사군 중복 있는 상표만 카운트 (실질적 충돌 후보)
      const groupOverlapResults = searchResults.filter(r => r.hasGroupOverlap);
      const noOverlapCount = searchResults.filter(r => !r.hasGroupOverlap).length;
      
      // 유사군 중복 + 상표 유사도 높은 것 = 고위험
      const criticalResults = groupOverlapResults.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');
      const mediumResults = groupOverlapResults.filter(r => r.riskLevel === 'medium');
      const safeResults = groupOverlapResults.filter(r => r.riskLevel === 'low' || r.riskLevel === 'safe');
      
      // 유사군 목록 수집
      const myGroups = [];
      (p.designatedGoods || []).forEach(classData => {
        (classData.goods || []).forEach(g => {
          if (g.similarGroup) {
            g.similarGroup.split(',').forEach(sg => {
              const trimmed = sg.trim();
              if (trimmed && !myGroups.includes(trimmed)) myGroups.push(trimmed);
            });
          }
        });
      });
      
      const prompt = `당신은 상표 등록 리스크 평가 전문가입니다. 
★ 핵심 원칙: 상표의 유사 여부는 "동일 유사군 코드" 내에서만 판단됩니다.
- 유사군 중복 없음 → 상표명이 동일해도 등록 가능
- 유사군 중복 있음 → 상표명/도형 유사도에 따라 거절 가능성 판단

[출원 상표 정보]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}
- 지정상품류: ${p.designatedGoods?.map(g => '제' + g.classCode + '류').join(', ') || '미선택'}
- 출원인 유사군코드: ${myGroups.slice(0, 10).join(', ') || '미확인'}${myGroups.length > 10 ? ` 외 ${myGroups.length - 10}개` : ''}

[검색 결과 분석 - 유사군 기준]
- 총 검색 결과: ${totalSearched}건
- ✅ 유사군 비중복 (등록 가능): ${noOverlapCount}건
- ⚠️ 유사군 중복 (충돌 검토 필요): ${groupOverlapResults.length}건
  - ⛔ 고위험 (유사군 중복 + 상표 유사): ${criticalResults.length}건
  - ⚠️ 중위험 (유사군 중복 + 상표 다소 유사): ${mediumResults.length}건
  - 🔶 저위험 (유사군 중복 + 상표 상이): ${safeResults.length}건

[고위험 상표 상세]
${criticalResults.slice(0, 5).map(r => 
  `- ${r.title || r.trademarkName}: ${r.applicationStatus || '-'} / 문자유사도 ${r.scoreBreakdown?.text || 0}% / 중복유사군: ${(r.overlappingGroups || []).join(', ') || '미확인'}`
).join('\n') || '없음'}

다음 항목을 분석하고 JSON 형식으로 응답하세요:

1. level: 전체 리스크 수준 
   - "high": 유사군 중복 + 상표 유사한 등록상표 있음 → 거절 가능성 높음
   - "medium": 유사군 중복은 있으나 상표 차별성 있음 → 심사관 판단 필요
   - "low": 유사군 중복 없음 또는 상표 명확히 상이 → 등록 가능성 높음
2. conflictCount: 유사군 중복 + 상표 유사한 실질적 충돌 상표 수
3. details: 상세 분석 (유사군 중복 여부를 핵심으로 설명)
4. recommendation: 출원인 권고사항

응답 형식:
{
  "level": "high|medium|low",
  "conflictCount": 0,
  "details": "상세 분석 내용...",
  "recommendation": "권고사항..."
}`;

      const response = await App.callClaudeSonnet(prompt, 1500);
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      assessment.assessedAt = new Date().toISOString();

      p.riskAssessment = assessment;

      // 프로젝트 상태 업데이트
      p.status = 'documenting';
      
      TM.renderCurrentStep();
      App.showToast('리스크 평가가 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 리스크 평가 실패:', error);
      App.showToast('평가 실패: ' + error.message, 'error');
      
      // UI 복구
      const btn = document.getElementById('tm-risk-btn');
      const progress = document.getElementById('tm-risk-progress');
      const hint = document.getElementById('tm-risk-hint');
      
      if (btn) {
        btn.disabled = false;
        btn.style.display = 'block';
      }
      if (progress) progress.style.display = 'none';
      if (hint) hint.style.display = 'block';
    }
  };

  TM.renderFeeBreakdown = function(fee) {
    if (!fee || !fee.breakdown || fee.breakdown.length === 0) {
      return '<div class="tm-hint">지정상품을 선택하면 비용이 자동 계산됩니다.</div>';
    }
    
    return fee.breakdown.map(item => `
      <div class="tm-fee-row ${item.type === 'reduction' ? 'reduction' : ''} ${item.type === 'total' ? 'total' : ''}">
        <span class="tm-fee-label">${TM.escapeHtml(item.label)}</span>
        <span class="tm-fee-amount">${item.type === 'reduction' ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}원</span>
      </div>
    `).join('');
  };
  
  TM.calculateFee = function() {
    const p = TM.currentProject;
    if (!p) return;
    
    let breakdown = [];
    let subtotal = 0;
    
    // 류별 출원료 계산
    if (p.designatedGoods && p.designatedGoods.length > 0) {
      p.designatedGoods.forEach(classData => {
        const hasNonGazetted = (classData.goods || []).some(g => !g.gazetted);
        const baseFee = hasNonGazetted ? TM.feeTable.applicationNonGazetted : TM.feeTable.applicationGazetted;
        
        breakdown.push({
          label: `제${classData.classCode}류 출원료 ${hasNonGazetted ? '(비고시)' : '(고시)'}`,
          amount: baseFee,
          type: 'application'
        });
        subtotal += baseFee;
        
        // 지정상품 가산료 (10개 초과)
        if ((classData.goods || []).length > 10) {
          const excessCount = (classData.goods || []).length - 10;
          const excessFee = excessCount * TM.feeTable.excessGoods;
          breakdown.push({
            label: `  └ 제${classData.classCode}류 초과상품 ${excessCount}개`,
            amount: excessFee,
            type: 'excess'
          });
          subtotal += excessFee;
        }
      });
    }
    
    // 우선심사 비용
    let priorityExamFee = 0;
    if (p.priorityExam?.enabled && p.designatedGoods) {
      priorityExamFee = p.designatedGoods.length * TM.feeTable.priorityExam;
      breakdown.push({
        label: `우선심사 신청료 (${p.designatedGoods.length}류)`,
        amount: priorityExamFee,
        type: 'priority'
      });
    }
    
    // 총액 (상표 출원료는 감면 없음)
    const totalFee = subtotal + priorityExamFee;
    breakdown.push({
      label: '총 납부액',
      amount: totalFee,
      type: 'total'
    });
    
    // 저장
    p.feeCalculation = {
      applicationFee: TM.feeTable.applicationGazetted,
      classCount: p.designatedGoods?.length || 0,
      totalApplicationFee: subtotal,
      excessGoodsFee: breakdown.filter(b => b.type === 'excess').reduce((sum, b) => sum + b.amount, 0),
      priorityExamFee: priorityExamFee,
      reductionRate: 0,
      reductionAmount: 0,
      totalFee: totalFee,
      breakdown: breakdown
    };
    
    // UI 업데이트
    TM.renderCurrentStep();
  };
  
  TM.togglePriorityExam = function(enabled) {
    if (!TM.currentProject) return;
    if (!TM.currentProject.priorityExam) TM.currentProject.priorityExam = {};
    TM.currentProject.priorityExam.enabled = enabled;
    TM.calculateFee();
  };

  // ============================================================
  // Step 7: 우선심사
  // ============================================================
  
  TM.renderStep7_PriorityExam = function(container) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    const isConfirmed = pe.userConfirmed === true;
    
    // 지정상품 목록 (유사군코드 포함)
    const designatedGoodsList = [];
    (p.designatedGoods || []).forEach(classData => {
      (classData.goods || []).forEach(g => {
        designatedGoodsList.push({
          name: g.name,
          classCode: classData.classCode,
          similarGroup: g.similarGroup || ''
        });
      });
    });
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3><span class="ico" data-icon="bolt"></span> 우선심사 신청 여부 결정</h3>
        <p>상표를 사용 중이거나 사용 준비 중인 경우 우선심사를 신청할 수 있습니다.</p>
      </div>
      
      <!-- 출원서 업로드 (컴팩트) -->
      <div class="tm-form-section tm-upload-section-compact">
        <div class="tm-upload-header">
          <span><span class="ico" data-icon="doc"></span> 출원서 업로드 (선택)</span>
          <span class="tm-hint-inline">출원서(PDF)를 업로드하면 정보를 자동 추출합니다</span>
        </div>
        
        <div class="tm-dropzone-compact" id="tm-application-dropzone"
             ondragover="TM.handleDragOver(event)" 
             ondragleave="TM.handleDragLeave(event)"
             ondrop="TM.handleApplicationDrop(event)"
             onclick="document.getElementById('tm-application-input').click()">
          <input type="file" id="tm-application-input" style="display: none;" 
                 accept=".pdf,image/*" multiple onchange="TM.handleApplicationUpload(this.files)">
          <span class="tm-dropzone-compact-icon">📎</span>
          <span class="tm-dropzone-compact-text">파일 선택 또는 드래그</span>
          <span class="tm-dropzone-compact-formats">PDF, 이미지</span>
        </div>
        
        ${pe.extractedFromApplication ? `
          <div class="tm-extracted-info-compact ${pe.editMode ? 'edit-mode' : ''}">
            <div class="tm-extracted-header-compact">
              <span>${pe.editMode ? '<span class="ico" data-icon="edit"></span> 출원 정보' : '<span class="ico" data-icon="check-circle"></span> 추출 완료'}</span>
              <div class="tm-extracted-actions-compact">
                ${pe.editMode ? `
                  <button class="btn btn-xs btn-primary" onclick="TM.confirmExtractedInfo()">확인</button>
                ` : `
                  <button class="btn btn-xs btn-ghost" onclick="TM.editExtractedInfo()">수정</button>
                `}
                <button class="btn btn-xs btn-ghost" onclick="TM.clearExtractedInfo()">초기화</button>
              </div>
            </div>
            
            ${pe.editMode ? `
              <div class="tm-extracted-form-compact">
                <div class="tm-form-grid-compact">
                  <div class="tm-field-compact">
                    <label>출원번호 *</label>
                    <input type="text" id="tm-extract-applicationNumber" value="${TM.escapeHtml(pe.applicationNumber || '')}" placeholder="40-2024-0012345">
                  </div>
                  <div class="tm-field-compact">
                    <label>출원일 *</label>
                    <input type="text" id="tm-extract-applicationDate" value="${TM.escapeHtml(pe.applicationDate || '')}" placeholder="2024.03.15">
                  </div>
                  <div class="tm-field-compact">
                    <label>출원인 *</label>
                    <input type="text" id="tm-extract-applicantName" value="${TM.escapeHtml(pe.applicantName || '')}" placeholder="주식회사 OOO">
                  </div>
                  <div class="tm-field-compact">
                    <label>상표명</label>
                    <input type="text" id="tm-extract-trademarkNameFromApp" value="${TM.escapeHtml(pe.trademarkNameFromApp || '')}" placeholder="상표명">
                  </div>
                  <div class="tm-field-compact">
                    <label>상품류</label>
                    <input type="text" id="tm-extract-classCode" value="${TM.escapeHtml(pe.classCode || '')}" placeholder="09">
                  </div>
                  <div class="tm-field-compact tm-field-wide">
                    <label>지정상품</label>
                    <input type="text" id="tm-extract-designatedGoodsFromApp" value="${TM.escapeHtml(pe.designatedGoodsFromApp || '')}" placeholder="지정상품 목록">
                  </div>
                </div>
                ${pe.specimenImageDataUrl ? `
                  <div style="margin-top: 10px; padding: 8px; background: var(--dt-g50); border: 1px solid var(--dt-g150); border-radius: 8px;">
                    <label style="font-size: 11px; color: var(--dt-g500); font-weight: 600; display: block; margin-bottom: 6px;">상표견본 (추출됨)</label>
                    <img src="${pe.specimenImageDataUrl}" alt="상표견본" style="max-width: 200px; max-height: 120px; border: 1px solid var(--dt-g300); border-radius: 4px; display: block;">
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="tm-extracted-summary">
                <span><strong>${pe.applicationNumber || '-'}</strong> | ${pe.applicationDate || '-'} | ${pe.applicantName || '-'}</span>
                ${pe.specimenImageDataUrl ? `<img src="${pe.specimenImageDataUrl}" alt="상표견본" style="max-width: 80px; max-height: 50px; vertical-align: middle; margin-left: 8px; border: 1px solid var(--dt-g300); border-radius: 3px;">` : ''}
              </div>
            `}
          </div>
        ` : ''}
      </div>
      
      <!-- 우선심사 선택 (컴팩트) -->
      <div class="tm-priority-choice-compact">
        <span class="tm-choice-label">우선심사 신청</span>
        <div class="tm-choice-buttons">
          <button class="tm-choice-btn ${pe.enabled ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="true">
            <span class="ico" data-icon="bolt"></span> 신청 <small>(2~3개월, +160,000원/류)</small>
          </button>
          <button class="tm-choice-btn ${pe.enabled === false && isConfirmed ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="false">
            <span class="ico" data-icon="clipboard"></span> 일반심사 <small>(12~14개월)</small>
          </button>
        </div>
        ${!isConfirmed ? '<span class="tm-choice-required"><span class="ico" data-icon="arrow-left"></span> 선택 필요</span>' : ''}
      </div>
      
      ${pe.enabled ? `
        <!-- 우선심사 사유 (컴팩트) -->
        <div class="tm-section-compact">
          <div class="tm-section-header-compact">
            <span><span class="ico" data-icon="clipboard"></span> 신청 사유</span>
            <select class="tm-select-compact" id="tm-pe-reason" onchange="TM.updatePriorityReason(this.value)">
              <option value="" ${!pe.reason ? 'selected' : ''}>선택</option>
              <option value="using" ${pe.reason === 'using' ? 'selected' : ''}>사용 중 (시행령 §12①)</option>
              <option value="preparing" ${pe.reason === 'preparing' ? 'selected' : ''}>사용 준비 중 (시행령 §12①)</option>
              <option value="infringement" ${pe.reason === 'infringement' ? 'selected' : ''}>제3자 무단사용 (시행령 §12②)</option>
              <option value="export" ${pe.reason === 'export' ? 'selected' : ''}>수출 긴급 (시행령 §12③)</option>
            </select>
          </div>
          ${pe.reason ? `
            <textarea class="tm-textarea-compact" id="tm-pe-reason-detail" rows="2" 
                      placeholder="구체적인 사용 현황 또는 준비 상황 (선택)"
                      onchange="TM.updatePriorityReasonDetail(this.value)">${pe.reasonDetail || ''}</textarea>
          ` : ''}
        </div>
        
        <!-- 증거자료 (컴팩트) -->
        <div class="tm-section-compact">
          <div class="tm-section-header-compact">
            <span>📎 증거자료</span>
            <div class="tm-evidence-upload-btn" onclick="document.getElementById('tm-evidence-input').click()">
              + 파일 추가
            </div>
            <input type="file" id="tm-evidence-input" style="display: none;" 
                   accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,image/*" multiple 
                   onchange="TM.handleEvidenceUpload(this.files)">
          </div>
          
          ${(pe.evidences || []).length > 0 ? `
            <div class="tm-evidence-list-compact">
              ${(pe.evidences || []).map((ev, idx) => `
                <div class="tm-evidence-item-compact">
                  <span class="tm-evidence-badge">${idx + 1}</span>
                  <div class="tm-evidence-info-compact">
                    <span class="tm-evidence-title-compact">${TM.escapeHtml(ev.title)}</span>
                    <span class="tm-evidence-file-compact">${TM.escapeHtml(ev.fileName || '')}</span>
                  </div>
                  <button class="tm-evidence-delete" data-action="tm-remove-evidence" data-index="${idx}"><span class="ico" data-icon="x"></span></button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="tm-evidence-empty" id="tm-evidence-dropzone"
                 ondragover="TM.handleDragOver(event)"
                 ondragleave="TM.handleDragLeave(event)"
                 ondrop="TM.handleEvidenceDrop(event)"
                 onclick="document.getElementById('tm-evidence-input').click()">
              <span><span class="ico" data-icon="folder"></span> 파일을 드래그하거나 클릭하여 업로드</span>
              <small>사업자등록증, 제안서, 계약서 등</small>
            </div>
          `}
          
          <div class="tm-evidence-manual-compact">
            <input type="text" id="tm-evidence-title" placeholder="수동 추가: 자료명 입력">
            <button class="tm-btn-add" onclick="TM.addEvidenceManual()">+</button>
          </div>
        </div>
        
        <!-- 우선심사 설명서 생성 (컴팩트) -->
        <div class="tm-section-compact tm-doc-section">
          <div class="tm-section-header-compact">
            <span><span class="ico" data-icon="edit"></span> 설명서 생성</span>
          </div>
          
          ${TM.checkGoodsMismatch() ? `
            <div class="tm-goods-selector">
              <div class="tm-goods-selector-header"><span class="ico" data-icon="warning"></span> 지정상품 정보 불일치 - 사용할 정보 선택:</div>
              <div class="tm-goods-selector-options">
                <label class="tm-goods-option-inline ${!pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(false)">
                  <input type="radio" name="goods-source" ${!pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label"><span class="ico" data-icon="clipboard"></span> 2단계 지정상품</span>
                  <span class="tm-option-value">${(p.designatedGoods || []).map(d => d.classCode).join(',')}류</span>
                </label>
                <label class="tm-goods-option-inline ${pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(true)">
                  <input type="radio" name="goods-source" ${pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label"><span class="ico" data-icon="doc"></span> 출원서 추출</span>
                  <span class="tm-option-value">${pe.classCode}류</span>
                </label>
              </div>
            </div>
          ` : ''}
          
          <div class="tm-doc-actions-compact">
            <button class="tm-btn-generate" data-action="tm-generate-priority-doc">
              <span class="ico" data-icon="doc"></span> Word 생성
            </button>
            <button class="tm-btn-preview" onclick="TM.previewPriorityDoc()">
              <span class="ico" data-icon="eye"></span> 미리보기
            </button>
          </div>
          
          <!-- 미리보기 영역 -->
          <div class="tm-doc-preview" id="tm-priority-doc-preview" style="display: none;">
            <div class="tm-doc-preview-header">
              <span>우선심사 신청 설명서 미리보기</span>
              <button class="btn btn-sm btn-ghost" onclick="document.getElementById('tm-priority-doc-preview').style.display='none'">닫기</button>
            </div>
            <div class="tm-doc-preview-content" id="tm-priority-doc-content"></div>
          </div>
        </div>
      ` : `
        <div class="tm-info-box">
          <h4><span class="ico" data-icon="lightbulb"></span> 우선심사란?</h4>
          <p>상표를 이미 사용하고 있거나 사용 준비 중인 경우, 일반 심사보다 빠르게 심사를 받을 수 있는 제도입니다.</p>
          <ul>
            <li>일반 심사: 약 12~14개월</li>
            <li>우선심사: 약 2~3개월</li>
          </ul>
          <p><strong>신청 요건 (상표법 제53조 제2항, 시행령 제12조)</strong></p>
          <ol>
            <li>상표를 지정상품 전부에 사용 중이거나 사용 준비 중인 경우</li>
            <li>제3자가 출원인의 상표를 무단 사용 중인 경우</li>
            <li>조약에 따른 우선권 주장이 있는 경우</li>
          </ol>
          <p>우선심사 신청시 류당 160,000원의 추가 비용이 발생합니다.</p>
        </div>
      `}
    `;
  };
  
  TM.getEvidenceTypeLabel = function(type) {
    const labels = {
      usage_photo: '사용 사진',
      advertisement: '광고물',
      contract: '계약서',
      sales_record: '매출 자료',
      website: '웹사이트',
      packaging: '포장재',
      signboard: '간판',
      business_card: '명함',
      other: '기타'
    };
    return labels[type] || type;
  };
  
  // 우선심사 선택 카드 클릭
  TM.setPriorityChoice = function(enabled) {
    if (!TM.currentProject) return;
    if (!TM.currentProject.priorityExam) TM.currentProject.priorityExam = {};
    TM.currentProject.priorityExam.enabled = enabled;
    TM.currentProject.priorityExam.userConfirmed = true;
    TM.hasUnsavedChanges = true;
    TM.calculateFee();
    TM.renderCurrentStep();
    App.showToast(enabled ? '우선심사 신청으로 설정되었습니다.' : '일반 심사로 설정되었습니다.', 'success');
  };
  
  TM.updatePriorityReason = function(reason) {
    if (!TM.currentProject) return;
    if (!TM.currentProject.priorityExam) TM.currentProject.priorityExam = {};
    TM.currentProject.priorityExam.reason = reason;
    TM.hasUnsavedChanges = true;
  };
  
  // 출원서 업로드로 정보 추출 (여러 파일 지원)
  TM.handleApplicationUpload = async function(files) {
    if (!files || files.length === 0) return;
    
    const p = TM.currentProject;
    
    // 업로드 영역에 로딩 표시
    const dropzone = document.getElementById('tm-application-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <div class="tm-dropzone-loading">
          <div class="tm-spinner"></div>
          <div>문서 분석 중... (${files.length}개 파일)</div>
        </div>
      `;
    }
    
    try {
      // 기본값 설정 (첫 업로드 시에만)
      if (!p.priorityExam) p.priorityExam = {};
      if (!p.priorityExam.extractedFromApplication) {
        p.priorityExam.applicationNumber = '';
        p.priorityExam.applicationDate = '';
        p.priorityExam.trademarkNameFromApp = p.trademarkName || '';
        p.priorityExam.applicantName = p.applicantName || '';
        p.priorityExam.classCode = '';
        p.priorityExam.designatedGoodsFromApp = '';
      }
      
      p.priorityExam.extractedFromApplication = true;
      p.priorityExam.editMode = true;
      
      let totalExtracted = 0;
      const fileNames = [];
      
      // 여러 파일 순차 처리
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 파일 크기 체크 (20MB)
        if (file.size > 20 * 1024 * 1024) {
          App.showToast(`${file.name}: 파일 크기 초과 (20MB 이하)`, 'warning');
          continue;
        }
        
        fileNames.push(file.name);
        
        // 진행 상태 업데이트
        if (dropzone) {
          dropzone.innerHTML = `
            <div class="tm-dropzone-loading">
              <div class="tm-spinner"></div>
              <div>분석 중... (${i + 1}/${files.length}) ${file.name}</div>
            </div>
          `;
        }
        
        // PDF인 경우 텍스트 추출 시도
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const extracted = await TM.extractFromPDF(file);
            
            // 추출된 항목 적용 (빈 항목만 채우기)
            if (!p.priorityExam.applicationNumber && extracted.applicationNumber) {
              p.priorityExam.applicationNumber = extracted.applicationNumber;
              totalExtracted++;
            }
            if (!p.priorityExam.applicationDate && extracted.applicationDate) {
              p.priorityExam.applicationDate = extracted.applicationDate;
              totalExtracted++;
            }
            if (!p.priorityExam.applicantName && extracted.applicantName) {
              p.priorityExam.applicantName = extracted.applicantName;
              totalExtracted++;
            }
            if (!p.priorityExam.trademarkNameFromApp && extracted.trademarkName) {
              p.priorityExam.trademarkNameFromApp = extracted.trademarkName;
              p.trademarkName = extracted.trademarkName; // 상위 프로젝트에도 반영
              totalExtracted++;
            }
            // 상품류와 지정상품은 출원서에서 추출된 값 우선 적용
            if (extracted.classCode) {
              p.priorityExam.classCode = extracted.classCode;
              totalExtracted++;
            }
            if (extracted.designatedGoods) {
              p.priorityExam.designatedGoodsFromApp = extracted.designatedGoods;
              totalExtracted++;
            }
            // 상표견본 이미지 (출원서에서 추출된 경우 항상 갱신)
            if (extracted.specimenImage) {
              p.priorityExam.specimenImageDataUrl = extracted.specimenImage;
              totalExtracted++;
              console.log('[TM] 상표견본 이미지 추출 완료');
            }

          } catch (pdfError) {
            console.error(`[TM] ${file.name} 추출 실패:`, pdfError);
          }
        }
      }
      
      p.priorityExam.uploadedFileName = fileNames.join(', ');
      
      // 추출되지 않은 항목은 기존 프로젝트 정보로 채우기
      if (!p.priorityExam.classCode && p.designatedGoods && p.designatedGoods.length > 0) {
        p.priorityExam.classCode = p.designatedGoods.map(d => d.classCode).join(', ');
      }
      if (!p.priorityExam.designatedGoodsFromApp && p.designatedGoods && p.designatedGoods.length > 0) {
        p.priorityExam.designatedGoodsFromApp = p.designatedGoods.flatMap(d => (d.goods || []).map(g => g.name)).join(', ');
      }
      
      if (totalExtracted > 0) {
        App.showToast(`${totalExtracted}개 항목이 추출되었습니다. 확인 후 수정하세요.`, 'success');
      } else {
        App.showToast('자동 추출에 실패했습니다. 직접 입력해주세요.', 'warning');
      }
      
      TM.renderCurrentStep();
      
    } catch (error) {
      console.error('[TM] 출원서 업로드 실패:', error);
      App.showToast('업로드 실패: ' + error.message, 'error');
      TM.renderCurrentStep();
    }
  };
  
  // PDF에서 텍스트 추출 및 파싱
  TM.extractFromPDF = async function(file) {
    // PDF.js 로드
    if (!window.pdfjsLib) {
      console.log('[TM] PDF.js 로드 중...');
      await TM.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      console.log('[TM] PDF.js 로드 완료');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    console.log('[TM] PDF 파일 크기:', arrayBuffer.byteLength);
    
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('[TM] PDF 페이지 수:', pdf.numPages);
    
    let fullText = '';
    
    // 모든 페이지에서 텍스트 추출
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      console.log('[TM] 페이지', i, '텍스트 아이템 수:', textContent.items.length);
      
      const pageText = textContent.items.map(item => item.str).join(' ');
      // KIPO 출원서 꼬리말 제거: 쪽번호(3-1), 날짜(2026-03-24) 등
      const cleanedPageText = pageText
        .replace(/\s+\d{1,2}-\d{1,2}\s+/g, ' ')           // 쪽번호 (3-1, 3-2 등)
        .replace(/\s+\d{4}-\d{2}-\d{2}\s*/g, ' ')          // 날짜 (2026-03-24 등)
        .replace(/\s+\d{4}\.\d{2}\.\d{2}\s*/g, ' ')        // 날짜 (2026.03.24 등)
        .replace(/\s{2,}/g, ' ')                            // 연속 공백 정리
        .trim();
      fullText += cleanedPageText + '\n';
    }
    
    // 텍스트가 거의 없으면 이미지 기반 PDF -> OCR 시도
    const cleanText = fullText.replace(/\s+/g, '').trim();
    console.log('[TM] 추출된 텍스트 길이:', cleanText.length);
    
    if (cleanText.length < 30) {
      console.log('[TM] 이미지 기반 PDF 감지 - OCR 시도');
      App.showToast('이미지 PDF 감지. OCR 처리 중...', 'info');
      fullText = await TM.ocrPDF(pdf);
    }
    
    console.log('[TM] 최종 텍스트:', fullText.substring(0, 500));
    
    // Claude API로 정보 추출
    App.showToast('AI가 텍스트 분석 중...', 'info');
    const parsed = await TM.parseApplicationText(fullText);

    // 상표견본 이미지 추출 시도
    try {
      App.showToast('상표견본 이미지 추출 중...', 'info');
      parsed.specimenImage = await TM.extractSpecimenImage(pdf);
    } catch (imgErr) {
      console.warn('[TM] 상표견본 이미지 추출 실패:', imgErr);
    }

    return parsed;
  };
  
  // PDF에서 상표견본 이미지 추출 — 임베딩된 이미지 객체를 직접 추출 (페이지 래스터라이즈 없음)
  // PyMuPDF의 page.get_images() + fitz.Pixmap(doc, xref)와 동일한 접근:
  // PDF.js의 getOperatorList()로 paintImageXObject 오퍼레이션을 찾고,
  // page.objs.get()으로 실제 이미지 데이터를 직접 추출
  TM.extractSpecimenImage = async function(pdf) {
    // 1단계: 【상표견본】텍스트가 있는 페이지 찾기 (마지막부터 역순)
    let targetPageNum = -1;
    for (let pageNum = pdf.numPages; pageNum >= 1; pageNum--) {
      const page = await pdf.getPage(pageNum);
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (item.str.replace(/\s/g, '').includes('상표견본')) {
          targetPageNum = pageNum;
          break;
        }
      }
      if (targetPageNum > 0) break;
    }
    if (targetPageNum < 0) {
      console.log('[TM] 【상표견본】 텍스트를 찾을 수 없음');
      return null;
    }

    console.log('[TM] 【상표견본】 페이지:', targetPageNum);
    const page = await pdf.getPage(targetPageNum);

    // 2단계: operator list에서 임베딩된 이미지 객체 참조 추출
    const opList = await page.getOperatorList();
    const imageRefs = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      // paintImageXObject(85): 디코딩된 픽셀 데이터 이미지
      // paintJpegImageXObject(82): JPEG 이미지 (HTMLImageElement)
      // paintImageMaskXObject(83): 마스크 이미지
      if (fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintJpegImageXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject) {
        const name = opList.argsArray[i][0];
        if (!imageRefs.some(r => r.name === name)) {
          imageRefs.push({ name, op: fn });
        }
      }
    }

    console.log('[TM] 임베딩 이미지 참조:', imageRefs.length, '개');

    if (imageRefs.length === 0) {
      console.warn('[TM] 임베딩 이미지 없음 → 렌더링 폴백');
      return await TM.extractSpecimenByRendering(pdf, targetPageNum);
    }

    // 3단계: 각 이미지 객체 로드 → 가장 큰 이미지 선택
    let bestCanvas = null;
    let bestArea = 0;

    for (const ref of imageRefs) {
      try {
        const imgObj = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
          page.objs.get(ref.name, (obj) => {
            clearTimeout(timeout);
            resolve(obj);
          });
        });

        if (!imgObj) continue;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (imgObj.bitmap && typeof imgObj.bitmap.width === 'number') {
          // {bitmap: ImageBitmap} 래퍼
          canvas.width = imgObj.bitmap.width;
          canvas.height = imgObj.bitmap.height;
          ctx.drawImage(imgObj.bitmap, 0, 0);
        } else if (imgObj instanceof HTMLCanvasElement) {
          // HTMLCanvasElement 직접
          canvas.width = imgObj.width;
          canvas.height = imgObj.height;
          ctx.drawImage(imgObj, 0, 0);
        } else if (imgObj.canvas instanceof HTMLCanvasElement) {
          // {canvas: HTMLCanvasElement} 래퍼
          canvas.width = imgObj.canvas.width;
          canvas.height = imgObj.canvas.height;
          ctx.drawImage(imgObj.canvas, 0, 0);
        } else if (imgObj instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && imgObj instanceof ImageBitmap)) {
          // JPEG 이미지 (브라우저가 디코딩)
          canvas.width = imgObj.width;
          canvas.height = imgObj.height;
          ctx.drawImage(imgObj, 0, 0);
        } else if (imgObj.data) {
          // Raw 픽셀 데이터
          const w = imgObj.width;
          const h = imgObj.height;
          if (!w || !h) continue;
          canvas.width = w;
          canvas.height = h;

          const pixelCount = w * h;
          const kind = imgObj.kind || 0;

          if (kind === 3 || imgObj.data.length === pixelCount * 4) {
            // RGBA (32bpp)
            const clamped = (imgObj.data instanceof Uint8ClampedArray)
              ? imgObj.data
              : new Uint8ClampedArray(imgObj.data.buffer ? imgObj.data.buffer : imgObj.data);
            const imgData = new ImageData(clamped, w, h);
            ctx.putImageData(imgData, 0, 0);
          } else if (kind === 2 || imgObj.data.length === pixelCount * 3) {
            // RGB (24bpp) → RGBA 변환
            const imgData = ctx.createImageData(w, h);
            const src = imgObj.data, dst = imgData.data;
            for (let s = 0, d = 0; s < src.length; s += 3, d += 4) {
              dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
          } else if (kind === 1 || imgObj.data.length === pixelCount) {
            // Grayscale (8bpp) → RGBA 변환
            const imgData = ctx.createImageData(w, h);
            const src = imgObj.data, dst = imgData.data;
            for (let i = 0; i < src.length; i++) {
              const d = i * 4;
              dst[d] = src[i]; dst[d + 1] = src[i]; dst[d + 2] = src[i]; dst[d + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
          } else if (imgObj.data.length === Math.ceil(pixelCount / 8)) {
            // 1bpp 마스크 → RGBA 변환
            const imgData = ctx.createImageData(w, h);
            const src = imgObj.data, dst = imgData.data;
            for (let i = 0; i < pixelCount; i++) {
              const byteIdx = Math.floor(i / 8);
              const bitIdx = 7 - (i % 8);
              const bit = (src[byteIdx] >> bitIdx) & 1;
              const d = i * 4;
              const v = bit ? 0 : 255; // 1=검정, 0=흰색
              dst[d] = v; dst[d + 1] = v; dst[d + 2] = v; dst[d + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
          } else {
            console.warn('[TM] 알 수 없는 이미지 포맷:', ref.name, 'kind:', kind, 'dataLen:', imgObj.data.length, 'expected:', pixelCount);
            continue;
          }
        } else if (imgObj.src) {
          // src 속성이 있는 이미지 객체
          const img = new Image();
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imgObj.src; });
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        } else {
          console.warn('[TM] 이미지 객체 형식 미지원:', ref.name, typeof imgObj);
          continue;
        }

        const area = canvas.width * canvas.height;
        console.log('[TM] 이미지:', ref.name, canvas.width, 'x', canvas.height, '(' + area + 'px)');

        // 너무 작은 이미지 (아이콘, 도장 등) 무시 — 최소 30x30
        if (canvas.width < 30 || canvas.height < 30) continue;

        if (area > bestArea) {
          bestArea = area;
          bestCanvas = canvas;
        }
      } catch (e) {
        console.warn('[TM] 이미지 로드 실패:', ref.name, e.message);
      }
    }

    if (bestCanvas) {
      console.log('[TM] 최종 선택 이미지:', bestCanvas.width, 'x', bestCanvas.height);
      return TM.autoCropCanvas(bestCanvas);
    }

    // 임베딩 이미지 추출 실패 시 렌더링 폴백
    console.warn('[TM] 이미지 객체 추출 실패 → 렌더링 폴백');
    return await TM.extractSpecimenByRendering(pdf, targetPageNum);
  };

  // 폴백: 페이지 렌더링 후 텍스트 gap 기반 크롭
  TM.extractSpecimenByRendering = async function(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    const scale = 3.0;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'var(--dt-white)';
    ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const tc = await page.getTextContent();
    const texts = [];
    for (const item of tc.items) {
      if (item.str.trim().length === 0) continue;
      const [cx, cy] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
      const fs = Math.abs(item.transform[0]);
      texts.push({ str: item.str.trim(), cy, fs });
    }
    texts.sort((a, b) => a.cy - b.cy);

    // 텍스트 사이 가장 큰 gap 찾기
    let gapTop = 0, gapBottom = vp.height, biggestGap = 0;
    if (texts.length >= 2) {
      for (let i = 0; i < texts.length - 1; i++) {
        const curBottom = texts[i].cy + texts[i].fs * scale * 0.5;
        const nextTop = texts[i + 1].cy - texts[i + 1].fs * scale * 1.2;
        const gap = nextTop - curBottom;
        if (gap > biggestGap) { biggestGap = gap; gapTop = curBottom; gapBottom = nextTop; }
      }
      const lastBottom = texts[texts.length - 1].cy + texts[texts.length - 1].fs * scale;
      if (vp.height - lastBottom > biggestGap) { biggestGap = vp.height - lastBottom; gapTop = lastBottom; gapBottom = vp.height; }
    }

    if (biggestGap > 50) {
      const m = 15;
      const cropTop = Math.max(0, Math.floor(gapTop - m));
      const cropBottom = Math.min(vp.height, Math.ceil(gapBottom + m));
      const cropH = cropBottom - cropTop;
      if (cropH > 30) {
        const gapCanvas = document.createElement('canvas');
        gapCanvas.width = vp.width;
        gapCanvas.height = cropH;
        gapCanvas.getContext('2d').drawImage(canvas, 0, cropTop, vp.width, cropH, 0, 0, vp.width, cropH);
        return TM.autoCropCanvas(gapCanvas);
      }
    }

    return TM.autoCropCanvas(canvas);
  };

  // 캔버스 자동 크롭 — 흰색 여백 제거
  TM.autoCropCanvas = function(srcCanvas) {
    const ctx = srcCanvas.getContext('2d');
    const w = srcCanvas.width, h = srcCanvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    const isWhite = (r, g, b) => r > 250 && g > 250 && b > 250;
    let top = 0, bottom = h - 1, left = 0, right = w - 1;

    // 상단
    outer1: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!isWhite(data[i], data[i+1], data[i+2])) { top = y; break outer1; }
      }
    }
    // 하단 (하위 5%는 꼬리말 영역으로 제외)
    const bottomLimit = Math.floor(h * 0.95);
    outer2: for (let y = bottomLimit; y >= top; y--) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!isWhite(data[i], data[i+1], data[i+2])) { bottom = y; break outer2; }
      }
    }
    // 좌측
    outer3: for (let x = 0; x < w; x++) {
      for (let y = top; y <= bottom; y++) {
        const i = (y * w + x) * 4;
        if (!isWhite(data[i], data[i+1], data[i+2])) { left = x; break outer3; }
      }
    }
    // 우측
    outer4: for (let x = w - 1; x >= left; x--) {
      for (let y = top; y <= bottom; y++) {
        const i = (y * w + x) * 4;
        if (!isWhite(data[i], data[i+1], data[i+2])) { right = x; break outer4; }
      }
    }

    // 여유 패딩 (5px)
    const pad = 5;
    top = Math.max(0, top - pad);
    bottom = Math.min(h - 1, bottom + pad);
    left = Math.max(0, left - pad);
    right = Math.min(w - 1, right + pad);

    const cw = right - left + 1;
    const ch = bottom - top + 1;
    if (cw < 10 || ch < 10) return srcCanvas.toDataURL('image/png');

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cw;
    cropCanvas.height = ch;
    cropCanvas.getContext('2d').drawImage(srcCanvas, left, top, cw, ch, 0, 0, cw, ch);
    return cropCanvas.toDataURL('image/png');
  };

  // PDF를 이미지로 렌더링 후 OCR
  TM.ocrPDF = async function(pdf) {
    // Tesseract.js 로드
    if (!window.Tesseract) {
      console.log('[TM] Tesseract.js 로드 중...');
      await TM.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
      console.log('[TM] Tesseract.js 로드 완료');
    }
    
    let fullText = '';
    
    // 첫 페이지만 OCR (속도 위해)
    const page = await pdf.getPage(1);
    const scale = 2.0; // 고해상도로 렌더링
    const viewport = page.getViewport({ scale });
    
    // Canvas에 렌더링
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    console.log('[TM] PDF 이미지 렌더링 완료:', canvas.width, 'x', canvas.height);
    
    // OCR 실행 (한국어)
    const result = await Tesseract.recognize(canvas, 'kor', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          console.log('[TM] OCR 진행:', pct + '%');
        }
      }
    });
    
    fullText = result.data.text;
    console.log('[TM] OCR 결과:', fullText.substring(0, 500));
    
    return fullText;
  };
  
  // 텍스트에서 출원 정보 파싱 (Claude API 사용)
  TM.parseApplicationText = async function(text) {
    if (!text || text.trim().length < 10) {
      console.log('[TM] 텍스트가 너무 짧음');
      return { applicationNumber: '', applicationDate: '', applicantName: '', trademarkName: '', classCode: '', designatedGoods: '' };
    }

    console.log('[TM] 원본 텍스트:', text.substring(0, 800));

    // 정규식 우선 실행 — 출원서는 형식이 정해져 있으므로 대부분 충분
    const regexResult = TM.parseApplicationTextRegex(text);
    // ★ [출원일 오추출 수정] 출원일도 핵심 필드에 포함 — 종전엔 출원번호·상품류만 보고 즉시 반환해서
    //   날짜가 비었거나 틀려도 AI 보완 기회가 없었다(출원번호통지서는 이 둘이 항상 있어 사실상 항상 조기 반환).
    const hasEssentials = regexResult.applicationNumber && regexResult.classCode && regexResult.applicationDate;
    if (hasEssentials) {
      console.log('[TM] 정규식만으로 핵심 필드 추출 완료:', regexResult);
      return regexResult;
    }

    // 핵심 필드 부족 시에만 Claude API 호출
    console.log('[TM] 정규식 부족 (applicationNumber:', regexResult.applicationNumber, ', classCode:', regexResult.classCode, ', applicationDate:', regexResult.applicationDate, ') → Claude API 보완');
    try {
      const prompt = `다음은 상표 출원번호통지서 또는 출원서를 OCR한 텍스트입니다. 띄어쓰기가 잘못되어 있거나 글자가 누락되었을 수 있습니다.

아래 정보를 추출해주세요:
1. 출원번호 (40-XXXX-XXXXXXX 형식)
2. 출원일자 (YYYY.MM.DD 형식)
3. 출원인 명칭 (회사명 또는 개인명)
4. 상품류 (숫자만, 예: 09, 35, 42)
5. 지정상품 (콤마로 구분된 목록)

【OCR 텍스트】
${text.substring(0, 2000)}

【응답 형식 - JSON만】
{"applicationNumber": "40-2025-0097799", "applicationDate": "2025.06.09", "applicantName": "삼인시스템 주식회사", "classCode": "09", "designatedGoods": "소프트웨어, 컴퓨터 프로그램"}

찾을 수 없는 항목은 빈 문자열("")로 설정하세요. JSON만 응답하세요.`;

      const response = await App.callClaudeSonnet(prompt, 800);
      const responseText = response.text || '';
      console.log('[TM] Claude 응답:', responseText);

      const startIdx = responseText.indexOf('{');
      const endIdx = responseText.lastIndexOf('}');

      if (startIdx !== -1 && endIdx > startIdx) {
        const parsed = JSON.parse(responseText.substring(startIdx, endIdx + 1));
        // 정규식 결과에 Claude 결과를 병합 (정규식 값 우선, 빈 값만 Claude로 보완)
        const merged = { ...regexResult };
        for (const key of ['applicationNumber', 'applicationDate', 'applicantName', 'trademarkName', 'classCode', 'designatedGoods']) {
          if (!merged[key] && parsed[key]) merged[key] = parsed[key];
        }
        // ★ [출원일 오추출 수정] AI 가 보완한 출원일도 유효성 검증 후 정규화(YYYY.MM.DD) — 무효면 채택하지 않는다.
        if (merged.applicationDate) {
          const _dm = String(merged.applicationDate).match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
          const _norm = _dm ? TM.normalizeDateParts(_dm[1], _dm[2], _dm[3]) : '';
          if (_norm) merged.applicationDate = _norm;
          else { console.warn('[TM] AI 출원일 무효 — 폐기:', merged.applicationDate); merged.applicationDate = ''; }
        }
        console.log('[TM] 병합 결과:', merged);
        return merged;
      }
    } catch (error) {
      console.error('[TM] Claude 분석 실패:', error);
    }

    // Claude도 실패 시 정규식 결과 반환
    return regexResult;
  };
  
  // ★ [출원일 오추출 수정] 날짜 유효성 검증 — 연 1900~2099 · 월 1~12 · 일 1~31 + 실재 날짜(2025.02.30 배제).
  //   종전엔 검증이 없어 "2025.00.97"(출원번호에서 오추출) 같은 불가능한 날짜가 그대로 통과했다.
  TM.normalizeDateParts = function(y, m, d) {
    const Y = parseInt(y, 10), M = parseInt(m, 10), D = parseInt(d, 10);
    if (!(Y >= 1900 && Y <= 2099)) return '';
    if (!(M >= 1 && M <= 12)) return '';
    if (!(D >= 1 && D <= 31)) return '';
    const dt = new Date(Y, M - 1, D);
    if (dt.getFullYear() !== Y || dt.getMonth() !== M - 1 || dt.getDate() !== D) return '';
    return Y + '.' + String(M).padStart(2, '0') + '.' + String(D).padStart(2, '0');
  };

  // 문자열에서 "첫 번째 유효한 날짜"만 채택(무효 후보는 건너뛴다). YYYY.M.D / YYYY-M-D / YYYY년 M월 D일 지원.
  TM._firstValidDate = function(s) {
    const re = /(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/g;
    let m;
    while ((m = re.exec(String(s || ''))) !== null) {
      const v = TM.normalizeDateParts(m[1], m[2], m[3]);
      if (v) return v;
    }
    return '';
  };

  // 번호류 마스킹 — 출원번호(40-2025-0097799)·접수번호(1-1-2025-0612345-01)는 날짜가 아니다.
  //   종전 무맥락 정규식이 이 숫자열에서 "2025.00.97"·"2025.06.12" 를 날짜로 오추출하던 근본 원인.
  //   단, 하이픈 날짜(2025-06-09)는 3그룹·유효성 통과 시 보존한다.
  TM._maskNumberRuns = function(s) {
    return String(s || '').replace(/\d+(?:\s*-\s*\d+)+/g, function(run) {
      const g = run.split(/\s*-\s*/);
      if (g.length === 3 && /^\d{4}$/.test(g[0]) && g[1].length <= 2 && g[2].length <= 2 && TM.normalizeDateParts(g[0], g[1], g[2])) return run;
      return ' '.repeat(run.length);
    });
  };

  // ★ 출원일 추출 — (1)번호류 마스킹 → (2)「출원일(자)」 라벨 앵커 → (3)유효 날짜 폴백.
  //   KIPO 출원번호통지서는 출원번호가 출원일자보다 먼저 나오므로, 라벨 앵커 없이 첫 숫자열을 잡으면 항상 틀린다.
  TM.extractApplicationDate = function(text) {
    if (!text) return '';
    const t = String(text).replace(/\s+/g, ' ');
    const masked = TM._maskNumberRuns(t);
    // 1순위: 「출원일」/「출원일자」 라벨 뒤 40자 이내(OCR 공백 붕괴 "출 원 일 자" 대응)
    const labelRe = /출\s*원\s*일\s*(?:자)?/g;
    let lm;
    while ((lm = labelRe.exec(masked)) !== null) {
      const from = lm.index + lm[0].length;
      const v = TM._firstValidDate(masked.slice(from, from + 40));
      if (v) return v;
    }
    // 2순위: 전체에서 첫 유효 날짜(번호 마스킹·유효성 통과분만)
    return TM._firstValidDate(masked);
  };

  // 정규식 기반 파싱 (폴백용)
  TM.parseApplicationTextRegex = function(text) {
    const result = {
      applicationNumber: '',
      applicationDate: '',
      applicantName: '',
      trademarkName: '',
      classCode: '',
      designatedGoods: ''
    };
    
    let t = text
      .replace(/\d{1,2}-\d{1,2}\s+\d{4}[-./]\d{2}[-./]\d{2}/g, ' ')  // 쪽번호+날짜 연속 패턴
      .replace(/\s+/g, ' ');
    
    console.log('[TM] 정규식 폴백 파싱 시작');
    
    // 출원번호: 40-2025-0097799
    const appNumMatch = t.match(/(40-\d{4}-\d{6,7})/);
    if (appNumMatch) {
      result.applicationNumber = appNumMatch[1];
      console.log('[TM] 출원번호:', result.applicationNumber);
    }
    
    // ★ [출원일 오추출 수정] 출원일자 — 라벨 앵커 + 번호류 마스킹 + 유효성 검증(TM.extractApplicationDate).
    //   종전 /(\d{4})[.\s-]*(\d{2})[.\s-]*(\d{2})/ 는 무맥락 첫 매칭이라 출원번호 "40-2025-0097799"에서
    //   "2025.00.97", 접수번호 "1-1-2025-0612345-01"에서 "2025.06.12" 를 날짜로 오추출했다(실증 3/4건 오류).
    //   ※ 원문(text) 기준으로 추출한다 — 전처리 t 는 쪽번호+날짜 패턴을 지워 정상 출원일까지 유실될 수 있다.
    result.applicationDate = TM.extractApplicationDate(text);
    if (result.applicationDate) {
      console.log('[TM] 출원일자:', result.applicationDate);
    } else {
      console.warn('[TM] 출원일자 추출 실패 — 유효한 날짜 없음(AI 보완 또는 수동 입력 필요)');
    }
    
    // 출원인: 1순위 【명칭】필드 직접 파싱, 2순위 "주식회사" 전후 매칭
    const nameFieldMatch = t.match(/명\s*칭[】\]\s]+([가-힣A-Za-z\s()（）]{2,30}?)(?=\s*【|\s*특허고객|\s*대리인|\s*$)/);
    if (nameFieldMatch) {
      result.applicantName = nameFieldMatch[1].replace(/\s+/g, ' ').trim();
      console.log('[TM] 출원인(명칭필드):', result.applicantName);
    } else {
      const corpAfter = t.match(/주\s*식\s*회\s*사\s+([가-힣A-Za-z]{2,15})/);
      if (corpAfter) {
        result.applicantName = '주식회사 ' + corpAfter[1].replace(/\s/g, '');
        console.log('[TM] 출원인(주식회사+):', result.applicantName);
      } else {
        const corpBefore = t.match(/([가-힣]{2,15})\s*주\s*식\s*회\s*사/);
        if (corpBefore) {
          const name = corpBefore[1].replace(/\s/g, '');
          if (!['명칭', '출원인', '신청인', '권리자'].includes(name)) {
            result.applicantName = name + ' 주식회사';
            console.log('[TM] 출원인(+주식회사):', result.applicantName);
          }
        }
      }
    }
    
    // 상품류: 제09류, 제 09 류, 09류 등
    const classMatch = t.match(/제?\s*(\d{1,2})\s*류/);
    if (classMatch) {
      result.classCode = classMatch[1].padStart(2, '0');
      console.log('[TM] 상품류:', result.classCode);
    }
    
    // 지정상품: 【지정상품】 또는 지정상품 뒤의 텍스트
    const goodsMatch = t.match(/지\s*정\s*상\s*품[】\]\s:]*([\s\S]{10,500}?)(?=【|출원인|상표|$)/i);
    if (goodsMatch) {
      let goods = goodsMatch[1].trim();
      // 한글 사이 불필요한 공백 제거
      goods = goods.replace(/([가-힣])\s+([가-힣])/g, '$1$2');
      goods = goods.replace(/([가-힣])\s+([가-힣])/g, '$1$2');
      goods = goods.substring(0, 300).trim();
      if (goods.length > 5) {
        result.designatedGoods = goods;
        console.log('[TM] 지정상품:', goods.substring(0, 80) + '...');
      }
    }
    
    console.log('[TM] 정규식 파싱 결과:', result);
    return result;
  };
  
  // 추출 정보 필드 업데이트
  TM.updateExtractedField = function(field, value) {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam[field] = value;
    TM.hasUnsavedChanges = true;
  };
  
  // 추출 정보 저장 확정
  TM.confirmExtractedInfo = function() {
    const p = TM.currentProject;
    if (!p?.priorityExam) return;
    
    // 입력 필드에서 값 읽기
    const fields = ['applicationNumber', 'applicationDate', 'trademarkNameFromApp', 'applicantName', 'classCode', 'designatedGoodsFromApp'];
    fields.forEach(field => {
      const input = document.getElementById(`tm-extract-${field}`);
      if (input) {
        p.priorityExam[field] = input.value.trim();
      }
    });
    
    p.priorityExam.editMode = false; // 편집 모드 종료
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast('출원 정보가 저장되었습니다.', 'success');
  };
  
  // 드래그 앤 드롭 핸들러
  TM.handleDragOver = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
  };
  
  TM.handleDragLeave = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
  };
  
  // 견본 드래그앤드롭
  TM.handleSpecimenDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        // 파일 input에 파일 설정하고 처리
        const input = document.getElementById('tm-specimen-input');
        if (input) {
          // DataTransfer를 이용해 input의 files 설정
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          // 변경 이벤트 트리거
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        App.showToast('이미지 파일만 업로드 가능합니다.', 'warning');
      }
    }
  };
  
  TM.handleApplicationDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      TM.handleApplicationUpload(files);
    }
  };
  
  // 추출 정보 초기화
  TM.clearExtractedInfo = function() {
    if (!TM.currentProject) return;
    if (!TM.currentProject.priorityExam) TM.currentProject.priorityExam = {};
    TM.currentProject.priorityExam.extractedFromApplication = false;
    TM.currentProject.priorityExam.editMode = false;
    TM.currentProject.priorityExam.applicationNumber = null;
    TM.currentProject.priorityExam.applicationDate = null;
    TM.currentProject.priorityExam.trademarkNameFromApp = null;
    TM.currentProject.priorityExam.applicantName = null;
    TM.currentProject.priorityExam.trademarkImage = null;
    TM.currentProject.priorityExam.classCode = null;
    TM.currentProject.priorityExam.designatedGoodsFromApp = null;
    TM.renderCurrentStep();
    App.showToast('추출 정보가 초기화되었습니다.', 'info');
  };
  
  // 편집 모드 전환
  TM.editExtractedInfo = function() {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam.editMode = true;
    TM.renderCurrentStep();
  };
  
  // 우선심사 사유 상세 업데이트
  TM.updatePriorityReasonDetail = function(detail) {
    if (!TM.currentProject) return;
    if (!TM.currentProject.priorityExam) TM.currentProject.priorityExam = {};
    TM.currentProject.priorityExam.reasonDetail = detail;
    TM.hasUnsavedChanges = true;
  };
  
  // 증거자료 수동 추가
  TM.addEvidenceManual = function() {
    const titleInput = document.getElementById('tm-evidence-title');

    const title = titleInput?.value?.trim();
    if (!title) {
      App.showToast('첨부자료 제목을 입력하세요.', 'warning');
      return;
    }

    if (!TM.currentProject.priorityExam.evidences) {
      TM.currentProject.priorityExam.evidences = [];
    }

    TM.currentProject.priorityExam.evidences.push({
      title: title,
      description: '',
      addedAt: new Date().toISOString()
    });
    
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast('첨부자료가 추가되었습니다.', 'success');
  };
  
  // 증거자료 드롭 핸들러
  TM.handleEvidenceDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      TM.handleEvidenceUpload(files);
    }
  };
  
  // 증거자료 파일 업로드 및 AI 분석
  TM.handleEvidenceUpload = async function(files) {
    if (!files || files.length === 0) return;
    
    const p = TM.currentProject;
    if (!p.priorityExam) p.priorityExam = {};
    if (!p.priorityExam.evidences) p.priorityExam.evidences = [];
    
    const dropzone = document.getElementById('tm-evidence-dropzone');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 파일 크기 체크 (10MB)
      if (file.size > 30 * 1024 * 1024) {
        App.showToast(`${file.name}: 파일 크기 초과 (30MB 이하)`, 'warning');
        continue;
      }
      
      // 로딩 표시
      if (dropzone) {
        dropzone.innerHTML = `
          <div class="tm-dropzone-loading">
            <div class="tm-spinner"></div>
            <div>증거자료 분석 중... (${i + 1}/${files.length}) ${file.name}</div>
          </div>
        `;
      }
      
      try {
        // 파일 타입에 따라 텍스트 추출
        let fileContent = '';
        let fileType = '';
        
        try {
          const ext = file.name.toLowerCase().split('.').pop();
          
          if (file.type === 'application/pdf' || ext === 'pdf') {
            fileType = 'PDF';
            fileContent = await TM.extractTextFromPDF(file);
          } else if (ext === 'doc' || ext === 'docx') {
            fileType = 'Word';
            fileContent = await TM.extractTextFromWord(file);
          } else if (ext === 'ppt' || ext === 'pptx') {
            fileType = 'PowerPoint';
            // pptx는 파일명 기반으로 처리 (텍스트 추출 복잡)
            fileContent = file.name;
          } else if (file.type.startsWith('image/')) {
            fileType = '이미지';
            fileContent = await TM.extractTextFromImage(file);
          } else {
            fileType = '파일';
            fileContent = file.name;
          }
        } catch (extractError) {
          console.warn('[TM] 텍스트 추출 실패, 파일명만 사용:', extractError.message);
          fileContent = file.name;
        }
        
        // AI로 증빙자료명 생성 (실패 시 파일명 기반 추측)
        let evidenceTitle;
        try {
          evidenceTitle = await TM.generateEvidenceTitle(file.name, fileContent, fileType);
        } catch (aiError) {
          console.warn('[TM] AI 분석 실패, 파일명 기반 추측:', aiError.message);
          evidenceTitle = TM.guessEvidenceTitle(file.name);
        }
        
        p.priorityExam.evidences.push({
          title: evidenceTitle,
          fileName: file.name,
          fileType: fileType,
          description: `원본 파일: ${file.name}`,
          addedAt: new Date().toISOString()
        });
        
        console.log('[TM] 증거자료 추가:', evidenceTitle);
        
      } catch (error) {
        console.error('[TM] 증거자료 분석 실패:', error);
        // 실패해도 파일명으로 추가
        p.priorityExam.evidences.push({
          title: TM.guessEvidenceTitle(file.name),
          fileName: file.name,
          description: `원본 파일: ${file.name}`,
          addedAt: new Date().toISOString()
        });
      }
    }
    
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast(`${files.length}개 증거자료가 추가되었습니다.`, 'success');
  };

  // ============================================================
  // 사업 분석용 파일 업로드 처리
  // ============================================================

  TM.getFileIcon = function(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const icons = { pdf: '📕', doc: '📘', docx: '📘', hwp: '📗', hwpx: '📗', xls: '📊', xlsx: '📊', pptx: '📙', ppt: '📙', txt: '📄', csv: '📄', md: '📄', json: '📄' };
    return icons[ext] || '📎';
  };

  TM.formatFileSize = function(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  TM.handleBusinessFileUpload = async function(files) {
    if (!files || files.length === 0) return;

    const p = TM.currentProject;
    if (!p.businessFiles) p.businessFiles = [];
    if (!p.businessFileTexts) p.businessFileTexts = [];

    const dropzone = document.getElementById('tm-business-dropzone');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 파일 크기 체크 (30MB)
      if (file.size > 30 * 1024 * 1024) {
        App.showToast(`${file.name}: 파일 크기 초과 (30MB 이하)`, 'warning');
        continue;
      }

      // 로딩 표시
      if (dropzone) {
        dropzone.innerHTML = `
          <div class="tm-dropzone-loading">
            <div class="tm-spinner"></div>
            <div>파일 분석 중... (${i + 1}/${files.length}) ${file.name}</div>
          </div>
        `;
      }

      try {
        // App.extractTextFromFile로 텍스트 추출
        let extractedText = '';
        try {
          extractedText = await App.extractTextFromFile(file);
        } catch (extractError) {
          console.warn('[TM] 사업분석 파일 텍스트 추출 실패:', extractError.message);
          // 폴백: trademark.js 내부 추출 함수 시도
          const ext = file.name.toLowerCase().split('.').pop();
          try {
            if (ext === 'pdf') {
              extractedText = await TM.extractTextFromPDF(file);
            } else if (ext === 'doc' || ext === 'docx') {
              extractedText = await TM.extractTextFromWord(file);
            }
          } catch (fallbackError) {
            console.warn('[TM] 폴백 추출도 실패:', fallbackError.message);
          }
        }

        if (!extractedText || extractedText.trim().length < 10) {
          App.showToast(`${file.name}: 텍스트를 추출할 수 없습니다. 다른 형식으로 시도해주세요.`, 'warning');
          continue;
        }

        // 파일 정보 + 추출된 텍스트 저장
        p.businessFiles.push({
          name: file.name,
          size: file.size,
          type: file.type || file.name.split('.').pop(),
          addedAt: new Date().toISOString()
        });
        p.businessFileTexts.push({
          name: file.name,
          text: extractedText.substring(0, 50000) // 최대 5만자
        });

        console.log(`[TM] 사업분석 파일 추가: ${file.name} (${extractedText.length}자 추출)`);

      } catch (error) {
        console.error('[TM] 사업분석 파일 처리 실패:', error);
        App.showToast(`${file.name}: 파일 처리 실패`, 'error');
      }
    }

    // 드롭존 원상복구
    if (dropzone) {
      dropzone.innerHTML = `
        <span class="tm-dropzone-compact-icon">📎</span>
        <span class="tm-dropzone-compact-text">사업 관련 파일 업로드 <strong>(클릭 또는 드래그)</strong></span>
        <span class="tm-dropzone-compact-formats">PDF, DOCX, XLSX, TXT, HWP 등</span>
      `;
    }

    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();

    if (p.businessFiles.length > 0) {
      App.showToast(`${files.length}개 파일이 추가되었습니다. 분석 버튼을 눌러주세요.`, 'success');
    }
  };

  TM.removeBusinessFile = function(index) {
    const p = TM.currentProject;
    if (!p.businessFiles) return;

    const removed = p.businessFiles.splice(index, 1);
    if (p.businessFileTexts) p.businessFileTexts.splice(index, 1);

    console.log('[TM] 사업분석 파일 제거:', removed[0]?.name);
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
  };

  // PDF에서 텍스트 추출 (증거자료용)
  TM.extractTextFromPDF = async function(file) {
    if (!window.pdfjsLib) {
      await TM.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    
    // 텍스트가 적으면 OCR 시도
    if (text.replace(/\s/g, '').length < 50) {
      const page = await pdf.getPage(1);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
      
      if (window.Tesseract) {
        const result = await Tesseract.recognize(canvas, 'kor');
        text = result.data.text;
      }
    }
    
    return text.substring(0, 2000);
  };
  
  // Word에서 텍스트 추출
  TM.extractTextFromWord = async function(file) {
    // mammoth.js 로드
    if (!window.mammoth) {
      await TM.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.substring(0, 2000);
  };
  
  // 이미지에서 텍스트 추출 (OCR)
  TM.extractTextFromImage = async function(file) {
    if (!window.Tesseract) {
      await TM.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
    }
    
    const result = await Tesseract.recognize(file, 'kor');
    return result.data.text.substring(0, 2000);
  };
  
  // 파일명 정리 함수 (공통)
  TM.cleanFileName = function(fileName) {
    return fileName
      .replace(/^\d{3}-\d{4}-[가-힣a-zA-Z]+_/, '')  // "005-0001-기타첨부서류_" 제거
      .replace(/^[A-Z]?\d+-\d+-/, '')               // "A001-0001-" 형식 제거
      .replace(/_첨부\.?/g, '')                      // "_첨부" 제거
      .replace(/첨부$/, '')                          // 끝의 "첨부" 제거
      .replace(/\.[^/.]+$/, '')                      // 확장자 제거
      .replace(/_/g, ' ')                            // 언더스코어를 공백으로
      .trim();
  };
  
  // AI로 증빙자료명 생성
  TM.generateEvidenceTitle = async function(fileName, content, fileType) {
    const p = TM.currentProject;
    const trademarkName = p.trademarkName || '';
    const applicantName = p.applicantName || p.priorityExam?.applicantName || '';
    
    // 파일명 정리
    const cleanedFileName = TM.cleanFileName(fileName);
    
    try {
      const prompt = `상표 우선심사 신청용 증거자료의 증빙자료명을 생성하세요.

【상표 정보】
- 상표명: ${trademarkName}
- 출원인: ${applicantName}

【파일 정보】
- 파일명: ${cleanedFileName}
- 파일타입: ${fileType}

【파일 내용】
${content.substring(0, 1200)}

【좋은 증빙자료명 예시】
- 사업자등록증
- 건물관리시스템 기술설명서
- 출원사실증명원
- 소프트웨어 제품 소개서
- 시스템 납품 계약서
- 서비스 이용 약관
- 홈페이지 캡처화면

파일 내용을 분석하여 적절한 증빙자료명을 한 줄로 응답하세요.
파일번호나 코드(예: 005-0001)는 제외하고 내용 중심으로 작성하세요.`;

      const response = await App.callClaudeSonnet(prompt, 80);
      let title = (response.text || '').trim();
      
      // 응답 정리
      title = title.replace(/^["']|["']$/g, '').trim();
      title = title.split('\n')[0].trim();
      // 불필요한 접두사 다시 제거
      title = title.replace(/^\d{3}-\d{4}-[가-힣a-zA-Z_]+/, '').trim();
      
      if (title && title.length > 2 && title.length < 50) {
        return title;
      }
    } catch (error) {
      console.error('[TM] AI 증빙자료명 생성 실패:', error);
    }
    
    // AI 실패 시 파일명 기반 추측
    return TM.guessEvidenceTitle(fileName);
  };
  
  // 파일명으로 증빙자료명 추측 (개선된 버전)
  TM.guessEvidenceTitle = function(fileName) {
    // 파일명 정리 - 불필요한 접두사 제거
    let cleanName = TM.cleanFileName(fileName);
    
    const name = cleanName.toLowerCase();
    const nameKor = cleanName;
    
    // 특정 키워드 매칭 (우선순위 순)
    const patterns = [
      // 사업자 관련
      { keywords: ['사업자등록증', '사업자 등록증'], title: '사업자등록증' },
      { keywords: ['business registration', 'business license'], title: '사업자등록증' },
      
      // 기술 문서
      { keywords: ['기술설명서', '기술 설명서', '기술소개서'], title: '기술설명서' },
      { keywords: ['발명설명서', '발명 설명서'], title: '발명설명서' },
      { keywords: ['사용설명서', '사용 설명서', '매뉴얼', 'manual'], title: '사용 설명서' },
      
      // 출원/증명 관련
      { keywords: ['출원사실증명원', '출원사실 증명원'], title: '출원사실증명원' },
      { keywords: ['출원서', '출원 서류'], title: '출원서' },
      { keywords: ['등록증', 'certificate'], title: '등록증' },
      { keywords: ['증명원', '증명서'], title: '증명원' },
      
      // 계약/거래 관련
      { keywords: ['제안서', 'proposal'], title: '제안서' },
      { keywords: ['계약서', 'contract', 'agreement'], title: '계약서' },
      { keywords: ['견적서', 'quotation', 'estimate'], title: '견적서' },
      { keywords: ['거래명세', 'invoice', '세금계산서'], title: '거래명세서' },
      { keywords: ['납품', 'delivery', '인수인계'], title: '납품확인서' },
      
      // 홍보/마케팅
      { keywords: ['카탈로그', 'catalog', 'catalogue', '브로슈어', 'brochure'], title: '제품 카탈로그' },
      { keywords: ['홈페이지', 'website', '캡처', 'screenshot'], title: '홈페이지 캡처 화면' },
      { keywords: ['광고', 'advertisement', 'ad', '홍보'], title: '광고 자료' },
      
      // 특허 관련
      { keywords: ['특허', 'patent'], title: '특허 관련 서류' },
      { keywords: ['상표', 'trademark'], title: '상표 관련 서류' },
      
      // 기타
      { keywords: ['ppt', 'pptx', 'presentation', '프레젠테이션'], title: '발표자료' },
      { keywords: ['report', '보고서', '리포트'], title: '보고서' },
    ];
    
    // 패턴 매칭
    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (name.includes(keyword.toLowerCase()) || nameKor.includes(keyword)) {
          return pattern.title;
        }
      }
    }
    
    // 매칭 안되면 정리된 파일명 반환 (너무 짧으면 원본 사용)
    if (cleanName.length < 3) {
      cleanName = fileName.replace(/\.[^/.]+$/, '');
    }
    
    // 언더스코어를 공백으로
    cleanName = cleanName.replace(/_/g, ' ').trim();
    
    return cleanName || '첨부자료';
  };
  
  // 우선심사 설명서 미리보기
  TM.previewPriorityDoc = function() {
    const previewEl = document.getElementById('tm-priority-doc-preview');
    const contentEl = document.getElementById('tm-priority-doc-content');
    
    if (!previewEl || !contentEl) return;
    
    // 인라인 선택 값 사용
    const pe = TM.currentProject?.priorityExam || {};
    const useExtracted = pe.useExtractedGoods || false;
    
    const docContent = TM.generatePriorityDocContent(useExtracted);
    contentEl.innerHTML = docContent;
    previewEl.style.display = 'block';
  };
  
  // 증거자료 제목에 따른 도입 표현 차별화
  TM.getEvidenceIntroPhrase = function(title) {
    const t = (title || '').toLowerCase();
    const mappings = [
      [['사업자등록', '사업자'], '사업자등록 정보에서 확인되는 바와 같이,'],
      [['계약서', '계약', '협약', 'mou', '양해각서'], '계약 내용에서 확인되는 바와 같이,'],
      [['홈페이지', '웹사이트', 'url', '도메인', '블로그', 'sns', '인스타', '유튜브', '네이버'], '온라인 사용 현황에서 확인되는 바와 같이,'],
      [['광고', '마케팅', '홍보', '프로모션', '캠페인', '전단', '배너', '리플렛'], '광고·홍보 자료에서 확인되는 바와 같이,'],
      [['매출', '거래', '세금계산서', '영수증', '인보이스', '매입', '결제', '정산'], '거래 실적에서 확인되는 바와 같이,'],
      [['사진', '간판', '포장', '패키지', '제품', '라벨', '스티커', '명함'], '실제 사용 모습에서 확인되는 바와 같이,'],
      [['검색', '검색결과', '포털', '구글', '키워드'], '검색 결과에서 확인되는 바와 같이,'],
      [['사업계획', '사업계획서', 'ir', '투자', '제안서', '기획서'], '사업 계획 내용에서 확인되는 바와 같이,'],
      [['사업수행', '수행계획', '과제', '연구', 'r&d', '개발'], '사업 수행 내용에서 확인되는 바와 같이,'],
      [['발표', '프레젠테이션', 'pt', '슬라이드', 'ppt'], '발표 자료에서 확인되는 바와 같이,'],
      [['카탈로그', '브로슈어', '소개서', '회사소개'], '소개 자료에서 확인되는 바와 같이,'],
      [['특허', '출원', '등록', '인증', '허가', '신고'], '관련 등록·인증 내용에서 확인되는 바와 같이,'],
      [['기사', '보도', '뉴스', '언론', '미디어'], '보도 내용에서 확인되는 바와 같이,'],
      [['앱', '어플', '애플리케이션', '스토어', '플레이스토어', '앱스토어'], '앱 서비스 현황에서 확인되는 바와 같이,'],
    ];
    for (const [keywords, phrase] of mappings) {
      if (keywords.some(kw => t.includes(kw))) return phrase;
    }
    return '에서 직접 확인할 수 있는 바와 같이,';
  };

  // 신청이유에 따른 법조문 텍스트 반환
  TM.buildReasonClause = function(reason) {
    if (reason === 'using') {
      return '상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 "상표등록출원인이 상표등록출원한 상표를 지정상품 전부에 대하여 사용하고 있거나 사용할 준비를 하고 있음이 명백한 경우"에 해당하는 상표등록출원으로서, 그 지정상품에 사용하고 있는 것이 명백하므로';
    } else if (reason === 'preparing') {
      return '상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 "상표등록출원인이 상표등록출원한 상표를 지정상품 전부에 대하여 사용하고 있거나 사용할 준비를 하고 있음이 명백한 경우"에 해당하는 상표등록출원으로서, 그 지정상품에 사용 준비하고 있는 것이 명백하므로';
    } else if (reason === 'infringement') {
      return '상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제2호의 "출원인이 아닌 자가 출원상표와 동일·유사한 상표를 동일·유사한 지정상품에 정당한 사유 없이 사용하고 있다고 인정되는 경우"에 해당하는 상표등록출원으로서, 제3자의 무단사용을 저지하기 위해';
    } else if (reason === 'export') {
      return '상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제3호의 "조약에 따른 우선권주장의 기초가 되는 출원에 관한 경우"에 해당하는 상표등록출원으로서, 수출을 위해 긴급하게 상표등록이 필요하므로';
    }
    return '상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 규정에 따라';
  };

  // 사용/사용준비 표현 반환
  TM.buildUsageText = function(reason) {
    return reason === 'using' ? '사용 중' : '사용 및 사용 준비 중';
  };

  // 증거자료 문단 배열 생성 (미리보기/Word 공용)
  TM.buildEvidenceParagraphs = function({ applicantName, goodsListStr, usageText, usageStatus, evidences }) {
    const paragraphs = [];

    if (evidences.length === 0) {
      paragraphs.push(`본 출원인 "${applicantName}"는 이건 출원상표가 표시된 ${goodsListStr}을 ${usageText}입니다.`);
      paragraphs.push(`따라서, 이건 출원상표는 앞서 설명한 바와 같이, 그 지정상품 전부에 대하여 ${usageStatus} 중에 있습니다.`);
      paragraphs.push(`이건 출원인 "${applicantName}"는 이건 출원상표를 해당 지정상품에 사용할 것이 더욱 분명합니다. 부디 이점을 적극 고려하시어 이건 출원상표에 대하여 우선심사신청을 허여해 주시기 바랍니다.`);
    } else if (evidences.length === 1) {
      const evRef = `첨부자료 1(${evidences[0].title})`;
      paragraphs.push(`본 출원인 "${applicantName}"는 본 신청서의 ${evRef}에 기재된 바와 같이, 이건 출원상표가 표시된 ${goodsListStr}을 ${usageText}입니다.`);
      paragraphs.push(`따라서, 이건 출원상표는 앞서 설명한 바와 같이, 그 지정상품 전부에 대하여 ${usageStatus} 중에 있습니다.`);
      paragraphs.push(`부디 이점을 적극 고려하시어 이건 출원상표에 대하여 우선심사신청을 허여해 주시기 바랍니다.`);
    } else {
      const firstRef = `첨부자료 1(${evidences[0].title})`;
      paragraphs.push(`본 출원인 "${applicantName}"는 본 신청서의 ${firstRef}에 기재된 바와 같이, 이건 출원상표가 표시된 ${goodsListStr}을 ${usageText}입니다.`);
      paragraphs.push(`따라서, 이건 출원상표는 앞서 설명한 바와 같이, 그 지정상품 전부에 대하여 ${usageStatus} 중에 있습니다.`);
      for (let i = 1; i < evidences.length; i++) {
        const evRef = `첨부자료 ${i + 1}(${evidences[i].title})`;
        const introPhrase = TM.getEvidenceIntroPhrase(evidences[i].title);
        paragraphs.push(`또한, ${evRef}의 ${introPhrase} 이건 출원인 "${applicantName}"는 이건 출원상표를 해당 지정상품에 실제 사용하고 있습니다.`);
      }
      paragraphs.push(`이상과 같이, 이건 출원인 "${applicantName}"는 이건 출원상표를 해당 지정상품에 사용할 것이 더욱 분명합니다. 부디 이점을 적극 고려하시어 이건 출원상표에 대하여 우선심사신청을 허여해 주시기 바랍니다.`);
    }

    return paragraphs;
  };

  // 우선심사 설명서 내용 생성
  TM.generatePriorityDocContent = function(useExtracted = false) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    // 출원인 정보 (HTML 이스케이프 적용)
    const applicantName = TM.escapeHtml(pe.applicantName || p.applicantName || '[출원인명]');
    const applicationNumber = TM.escapeHtml(pe.applicationNumber || '[출원번호]');
    const applicationDate = TM.escapeHtml(pe.applicationDate || '[출원일]');
    const trademarkName = TM.escapeHtml(pe.trademarkNameFromApp || p.trademarkName || '[상표명]');
    
    // 인라인 선택 값 적용
    const hasExtracted = pe.classCode || pe.designatedGoodsFromApp;
    const finalUseExtracted = useExtracted || pe.useExtractedGoods || false;
    let classCodeStr, designatedGoodsStr, goodsWithGroups;
    
    // 2단계 정보 확인
    const classGroups = {};
    (p.designatedGoods || []).forEach(classData => {
      if (!classGroups[classData.classCode]) {
        classGroups[classData.classCode] = [];
      }
      (classData.goods || []).forEach(g => {
        classGroups[classData.classCode].push({
          name: g.name,
          similarGroup: g.similarGroup || ''
        });
      });
    });
    const hasStep2Goods = Object.keys(classGroups).length > 0;

    if ((finalUseExtracted || !hasStep2Goods) && hasExtracted) {
      // 추출 정보 사용 (명시적 선택 또는 2단계 정보 없을 때 폴백)
      classCodeStr = pe.classCode ? `제 ${pe.classCode}류` : '[상품류]';
      designatedGoodsStr = pe.designatedGoodsFromApp || '[지정상품]';
      goodsWithGroups = pe.designatedGoodsFromApp ?
        pe.designatedGoodsFromApp.split(',').map(g => `『${g.trim()}』`) : [];
    } else if (hasStep2Goods) {
      // 2단계 정보 사용 (기본)
      const classCodeList = Object.keys(classGroups).sort((a, b) => parseInt(a) - parseInt(b));
      classCodeStr = classCodeList.map(c => '제 ' + c + '류').join(', ');

      const goodsList = [];
      Object.values(classGroups).forEach(goods => {
        goods.forEach(g => goodsList.push(g.name));
      });
      designatedGoodsStr = goodsList.join(', ');

      goodsWithGroups = [];
      Object.entries(classGroups).forEach(([classCode, goods]) => {
        goods.forEach(g => {
          if (g.similarGroup) {
            goodsWithGroups.push(`『${g.similarGroup} ${g.name}』`);
          } else {
            goodsWithGroups.push(`『${g.name}』`);
          }
        });
      });
    } else {
      // 둘 다 없는 경우
      classCodeStr = '[상품류]';
      designatedGoodsStr = '[지정상품]';
      goodsWithGroups = [];
    }
    
    const reasonClause = TM.buildReasonClause(pe.reason);
    const evidences = pe.evidences || [];
    const usageText = TM.buildUsageText(pe.reason);
    const goodsListStr = goodsWithGroups.length > 0 ? goodsWithGroups.join(', ') : '[지정상품]';
    const usageStatus = pe.reason === 'using' ? '사용' : '사용예정';

    const evidenceParagraphs = TM.buildEvidenceParagraphs({ applicantName, goodsListStr, usageText, usageStatus, evidences });
    const buildEvidenceParagraphsHtml = () => evidenceParagraphs.map(p => `
          <p style="margin-top: 12px;">${p}</p>`).join('');

    // HTML 형식의 미리보기
    return `
      <div class="tm-doc-preview-body">
        <h2 style="text-align: center; margin-bottom: 24px;">상표 우선심사 신청 설명서</h2>

        <div class="tm-doc-section">
          <h3>【서지사항】</h3>
          <table class="tm-doc-table">
            <tr><td width="150"><strong>【우선심사 신청인】</strong></td><td>${applicantName}</td></tr>
            <tr><td><strong>【출원번호】</strong></td><td>${applicationNumber}</td></tr>
            <tr><td><strong>【출원일】</strong></td><td>${applicationDate}</td></tr>
          </table>
        </div>

        <div class="tm-doc-section">
          <h3>【상표견본】</h3>
          ${pe.specimenImageDataUrl
            ? `<img src="${pe.specimenImageDataUrl}" alt="상표견본" style="max-width: 280px; max-height: 180px; border: 1px solid var(--dt-g300); display: block;">`
            : `<p style="font-size: 18px; font-weight: bold;">${trademarkName}</p>`
          }
        </div>

        <div class="tm-doc-section">
          <h3>【상품류】</h3>
          <p>${classCodeStr || '[상품류]'}</p>
        </div>

        <div class="tm-doc-section">
          <h3>【지정상품】</h3>
          <p>${designatedGoodsStr || '[지정상품]'}</p>
        </div>

        <div class="tm-doc-section">
          <h3>【우선심사 신청이유】</h3>
          <p>본 상표는 ${reasonClause} 우선심사를 신청합니다.</p>
          ${buildEvidenceParagraphsHtml()}
        </div>

        ${evidences.length > 0 ? `
          <div class="tm-doc-section">
            <h3>【증빙자료】</h3>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${evidences.map((ev, idx) => `<li>첨부자료 ${idx + 1} : ${TM.escapeHtml(ev.title)}${ev.description ? ' — ' + TM.escapeHtml(ev.description) : ''}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  // 우선심사 설명서 Word 파일 생성
  TM.generatePriorityDoc = async function(useExtracted = null) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    // 필수 정보 체크
    if (!pe.applicationNumber && !p.trademarkName) {
      App.showToast('출원번호 또는 상표명이 필요합니다.', 'warning');
      return;
    }
    
    // 2단계 지정상품 정보
    const step2ClassCodes = (p.designatedGoods || []).map(d => d.classCode).sort().join(',');
    const step2GoodsList = (p.designatedGoods || []).flatMap(d => (d.goods || []).map(g => g.name));
    const step2GoodsStr = step2GoodsList.join(', ');
    
    // 7단계 추출 지정상품 정보
    const extractedClassCode = pe.classCode || '';
    const extractedGoodsStr = pe.designatedGoodsFromApp || '';
    
    // 불일치 시 인라인 선택 값 사용 (useExtracted 파라미터가 null이면 pe.useExtractedGoods 사용)
    const hasExtracted = extractedClassCode || extractedGoodsStr;
    const finalUseExtracted = useExtracted !== null ? useExtracted : (pe.useExtractedGoods || false);
    
    try {
      App.showToast('Word 문서 생성 중...', 'info');
      
      // 출원인 정보
      const applicantName = pe.applicantName || p.applicantName || '[출원인명]';
      const applicationNumber = pe.applicationNumber || '[출원번호]';
      const applicationDate = pe.applicationDate || '[출원일]';
      const trademarkName = pe.trademarkNameFromApp || p.trademarkName || '[상표명]';
      
      // 상품류 및 지정상품 - 선택에 따라 결정
      let classCodeStr, designatedGoodsStr, goodsWithGroups;

      // 2단계 정보 확인
      const classGroups = {};
      (p.designatedGoods || []).forEach(classData => {
        if (!classGroups[classData.classCode]) {
          classGroups[classData.classCode] = [];
        }
        (classData.goods || []).forEach(g => {
          classGroups[classData.classCode].push({
            name: g.name,
            similarGroup: g.similarGroup || ''
          });
        });
      });
      const hasStep2Goods = Object.keys(classGroups).length > 0;

      if ((finalUseExtracted || !hasStep2Goods) && hasExtracted) {
        // 추출 정보 사용 (명시적 선택 또는 2단계 정보 없을 때 폴백)
        classCodeStr = extractedClassCode ? `제 ${extractedClassCode}류` : '[상품류]';
        designatedGoodsStr = extractedGoodsStr || '[지정상품]';
        goodsWithGroups = extractedGoodsStr ? extractedGoodsStr.split(',').map(g => `『${g.trim()}』`) : [];
      } else if (hasStep2Goods) {
        // 2단계 지정상품 정보 사용 (기본값)
        const classCodeList = Object.keys(classGroups).sort((a, b) => parseInt(a) - parseInt(b));
        classCodeStr = classCodeList.map(c => '제 ' + c + '류').join(', ');

        const goodsList = [];
        Object.values(classGroups).forEach(goods => {
          goods.forEach(g => goodsList.push(g.name));
        });
        designatedGoodsStr = goodsList.join(', ');

        goodsWithGroups = [];
        Object.entries(classGroups).forEach(([classCode, goods]) => {
          goods.forEach(g => {
            if (g.similarGroup) {
              goodsWithGroups.push(`『${g.similarGroup} ${g.name}』`);
            } else {
              goodsWithGroups.push(`『${g.name}』`);
            }
          });
        });
      } else {
        classCodeStr = '[상품류]';
        designatedGoodsStr = '[지정상품]';
        goodsWithGroups = [];
      }

      const evidences = pe.evidences || [];
      const reasonClause = TM.buildReasonClause(pe.reason);
      const usageText = TM.buildUsageText(pe.reason);
      const goodsListStr = goodsWithGroups.length > 0 ? goodsWithGroups.join(', ') : '[지정상품]';
      const usageStatus = pe.reason === 'using' ? '사용' : '사용예정';

      const reasonText1 = `본 상표는 ${reasonClause} 우선심사를 신청합니다.`;
      const reasonParagraphs = TM.buildEvidenceParagraphs({ applicantName, goodsListStr, usageText, usageStatus, evidences });
      
      // Edge Function으로 Word 생성 요청
      const docData = {
        type: 'priority_exam_doc',
        applicantName,
        applicationNumber,
        applicationDate,
        trademarkName,
        classCodeStr,
        designatedGoodsStr,
        goodsWithGroups,
        evidences,
        reasonText1,
        reasonParagraphs,
        specimenImageDataUrl: pe.specimenImageDataUrl || null
      };
      
      // 상표견본 이미지를 ArrayBuffer로 변환 (Word용)
      if (docData.specimenImageDataUrl) {
        try {
          const dataUrl = docData.specimenImageDataUrl;
          const base64 = dataUrl.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          docData._specimenImageBuffer = bytes.buffer;
          // 이미지 크기 계산 (원본 비율 유지, 최대 200px 너비)
          const img = new Image();
          await new Promise((resolve) => { img.onload = resolve; img.src = dataUrl; });
          const maxW = 200;
          const ratio = Math.min(maxW / img.width, 1);
          docData._specimenImgWidth = Math.round(img.width * ratio);
          docData._specimenImgHeight = Math.round(img.height * ratio);
        } catch (imgErr) {
          console.warn('[TM] Word 이미지 변환 실패:', imgErr);
        }
      }

      // Supabase Edge Function 호출 또는 클라이언트 사이드 생성
      const blob = await TM.createPriorityDocBlob(docData);
      
      // 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `우선심사신청설명서_${applicationNumber.replace(/[^0-9]/g, '') || Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      App.showToast('우선심사 설명서가 다운로드되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 우선심사 설명서 생성 실패:', error);
      App.showToast('문서 생성 실패: ' + error.message, 'error');
    }
  };
  
  // 지정상품 불일치 모달 표시
  TM.showGoodsMismatchModal = function(step2Class, step2Goods, extractedClass, extractedGoods) {
    // 기존 모달 제거
    const existingModal = document.getElementById('tm-goods-mismatch-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'tm-goods-mismatch-modal';
    modal.className = 'tm-modal-overlay';
    modal.innerHTML = `
      <div class="tm-modal tm-goods-mismatch-modal">
        <div class="tm-modal-header">
          <h3><span class="ico" data-icon="warning"></span> 지정상품 정보 불일치</h3>
          <button class="tm-modal-close" onclick="TM.closeGoodsMismatchModal()"><span class="ico" data-icon="x"></span></button>
        </div>
        <div class="tm-modal-body">
          <p class="tm-modal-desc">2단계에서 지정한 상품 정보와 출원서에서 추출한 정보가 다릅니다.<br>어떤 정보로 우선심사 신청 설명서를 작성하시겠습니까?</p>
          
          <div class="tm-goods-compare">
            <div class="tm-goods-option" data-option="step2" onclick="TM.selectGoodsOption('step2')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-step2" checked>
                <label for="opt-step2"><strong><span class="ico" data-icon="clipboard"></span> 2단계 지정상품</strong> (프로젝트에 저장된 정보)</label>
              </div>
              <div class="tm-goods-option-content">
                <div class="tm-goods-item"><span class="tm-label">상품류:</span> <span>${step2Class || '-'}</span></div>
                <div class="tm-goods-item"><span class="tm-label">지정상품:</span> <span class="tm-goods-text">${step2Goods.substring(0, 150)}${step2Goods.length > 150 ? '...' : ''}</span></div>
              </div>
            </div>
            
            <div class="tm-goods-option" data-option="extracted" onclick="TM.selectGoodsOption('extracted')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-extracted">
                <label for="opt-extracted"><strong><span class="ico" data-icon="doc"></span> 출원서 추출 정보</strong> (PDF에서 추출한 정보)</label>
              </div>
              <div class="tm-goods-option-content">
                <div class="tm-goods-item"><span class="tm-label">상품류:</span> <span>제 ${extractedClass || '-'}류</span></div>
                <div class="tm-goods-item"><span class="tm-label">지정상품:</span> <span class="tm-goods-text">${extractedGoods.substring(0, 150)}${extractedGoods.length > 150 ? '...' : ''}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="btn btn-secondary" onclick="TM.closeGoodsMismatchModal()">취소</button>
          <button class="btn btn-primary" onclick="TM.confirmGoodsSelection()">선택한 정보로 생성</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 기본 선택
    TM.selectedGoodsOption = 'step2';
  };
  
  // 지정상품 옵션 선택
  TM.selectGoodsOption = function(option) {
    TM.selectedGoodsOption = option;
    document.querySelectorAll('.tm-goods-option').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.tm-goods-option[data-option="${option}"]`).classList.add('selected');
    document.getElementById(option === 'step2' ? 'opt-step2' : 'opt-extracted').checked = true;
  };
  
  // 지정상품 선택 확인
  TM.confirmGoodsSelection = function() {
    TM.closeGoodsMismatchModal();
    const useExtracted = TM.selectedGoodsOption === 'extracted';
    TM.generatePriorityDoc(useExtracted);
  };
  
  // 모달 닫기
  TM.closeGoodsMismatchModal = function() {
    const modal = document.getElementById('tm-goods-mismatch-modal');
    if (modal) modal.remove();
  };
  
  // 지정상품 불일치 체크
  TM.checkGoodsMismatch = function() {
    const p = TM.currentProject;
    if (!p) return false;
    
    const pe = p.priorityExam || {};
    
    // 2단계 지정상품 정보
    const step2ClassCodes = (p.designatedGoods || []).map(d => d.classCode).sort().join(',');
    
    // 7단계 추출 지정상품 정보
    const extractedClassCode = pe.classCode || '';
    
    // 불일치 감지 (추출 정보가 있을 때만)
    const hasExtracted = extractedClassCode || pe.designatedGoodsFromApp;
    const classCodeMismatch = hasExtracted && extractedClassCode && step2ClassCodes && extractedClassCode !== step2ClassCodes;
    
    return classCodeMismatch;
  };
  
  // 지정상품 소스 선택
  TM.selectGoodsSource = function(useExtracted) {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam.useExtractedGoods = useExtracted;
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
  };
  
  // 우선심사 설명서 Blob 생성 (클라이언트 사이드)
  TM.createPriorityDocBlob = async function(data) {
    // docx 라이브러리 로드 (CDN) - UMD 버전 사용
    if (!window.docx) {
      console.log('[TM] docx 라이브러리 로드 중...');
      await TM.loadScript('https://unpkg.com/docx@8.2.2/build/index.umd.js');
      
      // 로드 대기
      let retries = 0;
      while (!window.docx && retries < 20) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }
      
      if (!window.docx) {
        throw new Error('docx 라이브러리 로드 실패');
      }
      console.log('[TM] docx 라이브러리 로드 완료');
    }
    
    const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
            AlignmentType, WidthType, BorderStyle, HeadingLevel } = window.docx;
    
    // 테이블 스타일
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
    
    // 문서 생성
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: '맑은 고딕', size: 22 }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: [
          // 제목
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: '상표 우선심사 신청 설명서', bold: true, size: 32 })
            ]
          }),
          
          // 서지사항
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '【서지사항】', bold: true, size: 24 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: `【우선심사 신청인】 ${data.applicantName}`, size: 22 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: `【출원번호】 ${data.applicationNumber}`, size: 22 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: `【출원일】 ${data.applicationDate}`, size: 22 })]
          }),
          
          // 상표견본
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '【상표견본】', bold: true, size: 24 })]
          }),
          ...(data._specimenImageBuffer ? [
            new Paragraph({
              spacing: { after: 200 },
              children: [new ImageRun({
                data: data._specimenImageBuffer,
                transformation: { width: data._specimenImgWidth || 200, height: data._specimenImgHeight || 100 }
              })]
            })
          ] : [
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: data.trademarkName, bold: true, size: 28 })]
            })
          ]),

          // 상품류
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '【상품류】', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.classCodeStr || '[상품류]', size: 22 })]
          }),
          
          // 지정상품
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '【지정상품】', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.designatedGoodsStr || '[지정상품]', size: 22 })]
          }),
          
          // 우선심사 신청이유
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '【우선심사 신청이유】', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [new TextRun({ text: data.reasonText1, size: 22 })]
          }),
          ...(data.reasonParagraphs || []).map((text, i, arr) =>
            new Paragraph({
              spacing: { after: i === arr.length - 1 ? 200 : 150 },
              children: [new TextRun({ text: text, size: 22 })]
            })
          ),
          
          // 증빙자료
          ...(data.evidences.length > 0 ? [
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: '【증빙자료】', bold: true, size: 24 })]
            }),
            ...data.evidences.map((ev, idx) => 
              new Paragraph({
                children: [new TextRun({ text: `첨부자료 ${idx + 1} : ${ev.title}`, size: 22 })]
              })
            )
          ] : [])
        ]
      }]
    });
    
    // Blob으로 변환
    const blob = await Packer.toBlob(doc);
    return blob;
  };
  
  // 스크립트 동적 로드 (중복 로드 방지)
  TM._loadingScripts = {};
  TM.loadScript = function(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
      return Promise.resolve();
    }
    if (TM._loadingScripts[src]) {
      return TM._loadingScripts[src];
    }
    TM._loadingScripts[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => { delete TM._loadingScripts[src]; resolve(); };
      script.onerror = (e) => { delete TM._loadingScripts[src]; reject(e); };
      document.head.appendChild(script);
    });
    return TM._loadingScripts[src];
  };
  
  TM.removeEvidence = async function(index) {
    if (!confirm('이 증거자료를 삭제하시겠습니까?')) return;
    
    const evidence = TM.currentProject.priorityExam.evidences[index];
    
    // Storage에서 파일 삭제 (storagePath가 있는 경우만)
    if (evidence.storagePath) {
      try {
        await App.sb.storage
          .from('trademark-evidences')
          .remove([evidence.storagePath]);
      } catch (e) {
        console.warn('[TM] 파일 삭제 실패:', e);
      }
    }

    TM.currentProject.priorityExam.evidences.splice(index, 1);
    TM.renderCurrentStep();
    App.showToast('증거자료가 삭제되었습니다.', 'success');
  };
  
  TM.generatePriorityDocument = async function() {
    const p = TM.currentProject;
    const pe = p.priorityExam;

    if (!pe.reason) {
      App.showToast('우선심사 사유를 선택하세요.', 'warning');
      return;
    }

    try {
      App.showToast('설명서 생성 중...', 'info');

      // 미리보기와 동일한 고정 양식 텍스트 생성 (LLM 불필요)
      const docContent = TM.generatePriorityDocContent(pe.useExtractedGoods || false);

      // HTML → 텍스트 변환
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = docContent;
      pe.generatedDocument = tempDiv.innerText || tempDiv.textContent || '';

      TM.renderCurrentStep();
      App.showToast('설명서가 생성되었습니다.', 'success');

    } catch (error) {
      console.error('[TM] 설명서 생성 실패:', error);
      App.showToast('생성 실패: ' + error.message, 'error');
    }
  };
  
  TM.formatPriorityDocument = function(doc) {
    if (!doc) return '';
    return TM.escapeHtml(doc).replace(/\n/g, '<br>').replace(/#{1,4}\s*(.+)/g, '<h4>$1</h4>');
  };
  
  TM.copyPriorityDoc = function() {
    const content = document.getElementById('tm-priority-doc-content');
    if (!content) return;
    
    const text = content.innerText;
    navigator.clipboard.writeText(text).then(() => {
      App.showToast('클립보드에 복사되었습니다.', 'success');
    }).catch(() => {
      App.showToast('클립보드 복사에 실패했습니다.', 'error');
    });
  };
  
  TM.regeneratePriorityDoc = function() {
    if (!confirm('설명서를 다시 생성하시겠습니까? 현재 내용은 사라집니다.')) return;
    TM.generatePriorityDocument();
  };

  // ============================================================
  // Step 8: 문서 출력
  // ============================================================
  
  // Step 7: 종합 요약 (대시보드)
  // ============================================================
  
  TM.renderStep7_Summary = function(container) {
    const p = TM.currentProject;
    const risk = p.riskAssessment || {};
    const fee = p.feeCalculation || {};
    const evaluations = p.similarityEvaluations || [];
    const allSearchResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])];
    
    // 비용 계산
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3><span class="ico" data-icon="clipboard"></span> 종합 요약</h3>
      </div>
      
      <!-- 요약 대시보드 -->
      <div class="tm-summary-dashboard">
        <!-- 상표 정보 카드 -->
        <div class="tm-summary-card tm-card-trademark">
          <div class="tm-card-icon"><span class="ico" data-icon="tag"></span></div>
          <div class="tm-card-content">
            <div class="tm-card-title">상표명</div>
            <div class="tm-card-value">${TM.escapeHtml(p.trademarkName) || '-'}</div>
            <div class="tm-card-sub">${TM.getTypeLabel(p.trademarkType)}</div>
          </div>
        </div>
        
        <!-- 지정상품 카드 -->
        <div class="tm-summary-card">
          <div class="tm-card-icon"><span class="ico" data-icon="box"></span></div>
          <div class="tm-card-content">
            <div class="tm-card-title">지정상품</div>
            <div class="tm-card-value">${p.designatedGoods?.length || 0}개 류</div>
            <div class="tm-card-sub">${p.designatedGoods?.reduce((sum, g) => sum + g.goods.length, 0) || 0}개 상품</div>
          </div>
        </div>
        
        <!-- 리스크 카드 -->
        <div class="tm-summary-card tm-card-risk ${risk.level || ''}">
          <div class="tm-card-icon">${risk.level === 'high' ? '⚠️' : risk.level === 'medium' ? '⚡' : risk.level === 'low' ? '✅' : '❓'}</div>
          <div class="tm-card-content">
            <div class="tm-card-title">리스크</div>
            <div class="tm-card-value">${risk.level ? (risk.level === 'high' ? '높음' : risk.level === 'medium' ? '주의' : '낮음') : '미평가'}</div>
            <div class="tm-card-sub">${risk.level ? '등록 가능성 ' + TM.getRiskProbability(risk.level) : '-'}</div>
          </div>
        </div>
        
        <!-- 비용 카드 -->
        <div class="tm-summary-card">
          <div class="tm-card-icon"><span class="ico" data-icon="money"></span></div>
          <div class="tm-card-content">
            <div class="tm-card-title">예상 비용</div>
            <div class="tm-card-value">${TM.formatNumber(fee.totalFee || 0)}원</div>
            <div class="tm-card-sub">${p.priorityExam?.enabled ? '우선심사 포함' : '일반심사'}</div>
          </div>
        </div>
      </div>
      
      <!-- 세부 정보 섹션들 -->
      <div class="tm-summary-sections">
        <!-- 출원인 정보 -->
        ${p.applicant?.name ? `
          <div class="tm-summary-section">
            <h4><span class="ico" data-icon="user"></span> 출원인</h4>
            <div class="tm-summary-info">
              <span>${TM.escapeHtml(p.applicant.name)}</span>
              ${p.managementNumber ? `<span class="tm-info-badge">관리번호: ${TM.escapeHtml(p.managementNumber)}</span>` : 
                (TM.currentProject?.title ? `<span class="tm-info-badge">관리번호: ${TM.escapeHtml(TM.currentProject.title)}</span>` : '')}
            </div>
          </div>
        ` : ''}
        
        <!-- 지정상품 요약 -->
        ${p.designatedGoods?.length > 0 ? `
          <div class="tm-summary-section">
            <h4><span class="ico" data-icon="box"></span> 지정상품 요약</h4>
            <div class="tm-goods-summary-grid">
              ${p.designatedGoods.map(dg => `
                <div class="tm-goods-summary-item">
                  <span class="tm-class-badge">제${dg.classCode}류</span>
                  <span class="tm-goods-count">${dg.goods.length}개</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- 선행상표 검색 결과 -->
        ${allSearchResults.length > 0 ? `
          <div class="tm-summary-section">
            <h4><span class="ico" data-icon="search"></span> 선행상표 검색</h4>
            <div class="tm-summary-stats">
              <span>검색 결과 ${allSearchResults.length}건</span>
              <span>평가 완료 ${evaluations.length}건</span>
              <span>충돌 우려 ${risk.conflictCount || 0}건</span>
            </div>
          </div>
        ` : ''}
        
        <!-- 비용 명세 -->
        ${fee.breakdown?.length > 0 ? `
          <div class="tm-summary-section">
            <h4><span class="ico" data-icon="money"></span> 비용 명세</h4>
            <div class="tm-fee-summary">
              ${fee.breakdown.slice(0, 5).map(item => `
                <div class="tm-fee-item ${item.type === 'total' ? 'total' : ''}">
                  <span>${TM.escapeHtml(item.label)}</span>
                  <span>${TM.formatNumber(item.amount)}원</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      <!-- 문서 출력 -->
      <div class="tm-output-section">
        <h4><span class="ico" data-icon="download"></span> 문서 다운로드</h4>
        <div class="tm-output-buttons">
          <button class="btn btn-primary" data-action="tm-download-docx">
            <span class="ico" data-icon="edit"></span> 검토 보고서 (Word)
          </button>
          ${p.priorityExam?.enabled ? `
            <button class="btn btn-secondary" data-action="tm-generate-priority-doc">
              <span class="ico" data-icon="bolt"></span> 우선심사 설명서 (Word)
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };
  
  TM.previewDocument = function() {
    const previewArea = document.getElementById('tm-preview-area');
    const previewContent = document.getElementById('tm-preview-content');
    if (!previewArea || !previewContent) return;
    
    previewContent.innerHTML = TM.generateDocumentHTML();
    previewArea.style.display = 'block';
    previewArea.scrollIntoView({ behavior: 'smooth' });
  };
  
  TM.generateDocumentHTML = function() {
    const p = TM.currentProject;
    const includes = {
      summary: document.getElementById('tm-include-summary')?.checked ?? true,
      goods: document.getElementById('tm-include-goods')?.checked ?? true,
      search: document.getElementById('tm-include-search')?.checked ?? true,
      similarity: document.getElementById('tm-include-similarity')?.checked ?? true,
      risk: document.getElementById('tm-include-risk')?.checked ?? true,
      fee: document.getElementById('tm-include-fee')?.checked ?? true,
      priority: document.getElementById('tm-include-priority')?.checked ?? true
    };
    
    let html = `
      <div class="tm-doc">
        <h1>상표 출원 검토 보고서</h1>
        <p class="tm-doc-date">작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
    `;
    
    if (includes.summary) {
      html += `
        <h2>1. 프로젝트 개요</h2>
        <table class="tm-doc-table">
          <tr><th>상표명</th><td>${TM.escapeHtml(p.trademarkName)}</td></tr>
          <tr><th>영문명</th><td>${TM.escapeHtml(p.trademarkNameEn) || '-'}</td></tr>
          <tr><th>상표 유형</th><td>${TM.getTypeLabel(p.trademarkType)}</td></tr>
          <tr><th>출원인</th><td>${TM.escapeHtml(p.applicant?.name) || '-'}</td></tr>
        </table>
      `;
    }
    
    if (includes.goods && p.designatedGoods?.length > 0) {
      html += `<h2>2. 지정상품</h2>`;
      p.designatedGoods.forEach(classData => {
        html += `
          <h3>제${classData.classCode}류 - ${TM.escapeHtml(classData.className)}</h3>
          <ul>
            ${classData.goods.map(g => `<li>${TM.escapeHtml(g.name)} ${!g.gazetted ? '(비고시)' : ''}</li>`).join('')}
          </ul>
        `;
      });
    }
    
    if (includes.risk && p.riskAssessment?.level) {
      html += `
        <h2>3. 리스크 평가</h2>
        <p><strong>위험 수준:</strong> ${p.riskAssessment.level === 'high' ? '높음' : p.riskAssessment.level === 'medium' ? '중간' : '낮음'}</p>
        <p><strong>등록 가능성:</strong> ${TM.getRiskProbability(p.riskAssessment.level)}</p>
        ${p.riskAssessment.details ? `<p>${TM.escapeHtml(p.riskAssessment.details)}</p>` : ''}
        ${p.riskAssessment.recommendation ? `<p><strong>권고사항:</strong> ${TM.escapeHtml(p.riskAssessment.recommendation)}</p>` : ''}
      `;
    }
    
    if (includes.fee && p.feeCalculation?.totalFee) {
      html += `
        <h2>4. 비용 명세</h2>
        <table class="tm-doc-table">
          ${p.feeCalculation.breakdown?.map(item => `
            <tr>
              <td>${TM.escapeHtml(item.label)}</td>
              <td style="text-align: right;">${item.type === 'reduction' ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}원</td>
            </tr>
          `).join('')}
        </table>
      `;
    }
    
    if (includes.priority && p.priorityExam?.enabled && p.priorityExam?.generatedDocument) {
      html += `
        <h2>5. 우선심사 설명서</h2>
        <div class="tm-doc-priority">${TM.formatPriorityDocument(p.priorityExam.generatedDocument)}</div>
      `;
    }
    
    html += `</div>`;
    
    return html;
  };
  
  TM.downloadDocx = async function() {
    try {
      App.showToast('검토 보고서 생성 중...', 'info');
      
      const p = TM.currentProject;
      if (!p || !p.trademarkName) {
        App.showToast('프로젝트 정보가 없습니다.', 'warning');
        return;
      }
      
      // docx 라이브러리 로드 (CDN)
      if (!window.docx) {
        console.log('[TM] docx 라이브러리 로드 중...');
        await TM.loadScript('https://unpkg.com/docx@8.2.2/build/index.umd.js');
        let retries = 0;
        while (!window.docx && retries < 20) {
          await new Promise(r => setTimeout(r, 100));
          retries++;
        }
        if (!window.docx) {
          throw new Error('docx 라이브러리 로드 실패. 네트워크를 확인하세요.');
        }
        console.log('[TM] docx 라이브러리 로드 완료');
      }
      
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, VerticalAlign, PageNumber, PageBreak
      } = window.docx;
      
      // ─── 색상 ───
      const C = {
        primary: '1B3A5C', accent: '2563EB', danger: 'DC2626', warning: 'D97706',
        success: '059669', lightBg: 'F0F4F8', headerBg: '1B3A5C', headerText: 'FFFFFF',
        tableBorder: 'CBD5E1', lightGreen: 'ECFDF5', lightRed: 'FEF2F2',
        lightYellow: 'FFFBEB', lightBlue: 'EFF6FF', gray600: '475569', gray400: '94A3B8', black: '000000'
      };
      
      const border = { style: BorderStyle.SINGLE, size: 1, color: C.tableBorder };
      const borders = { top: border, bottom: border, left: border, right: border };
      const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
      const cellM = { top: 60, bottom: 60, left: 100, right: 100 };
      const TABLE_W = 9506; // A4 - margins
      
      // ─── 셀 헬퍼 ───
      function hCell(text, w, opts = {}) {
        return new TableCell({
          borders, width: { size: w, type: WidthType.DXA },
          shading: { fill: C.headerBg, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER, margins: cellM,
          children: [new Paragraph({ alignment: opts.align || AlignmentType.CENTER, spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: String(text), bold: true, font: 'Arial', size: 18, color: C.headerText })]
          })]
        });
      }
      function dCell(text, w, opts = {}) {
        return new TableCell({
          borders, width: { size: w, type: WidthType.DXA },
          shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
          verticalAlign: VerticalAlign.CENTER, margins: cellM, columnSpan: opts.colSpan || 1,
          children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: String(text || '-'), bold: opts.bold || false, font: 'Arial', size: 18, color: opts.color || C.black })]
          })]
        });
      }
      function lCell(text, w) {
        return new TableCell({
          borders, width: { size: w, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER, margins: cellM,
          children: [new Paragraph({ spacing: { before: 20, after: 20 },
            children: [new TextRun({ text, bold: true, font: 'Arial', size: 18, color: C.primary })]
          })]
        });
      }
      function secTitle(num, title) {
        return new Paragraph({
          spacing: { before: 360, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.primary, space: 8 } },
          children: [
            new TextRun({ text: `${num}. `, font: 'Arial', size: 26, bold: true, color: C.accent }),
            new TextRun({ text: title, font: 'Arial', size: 26, bold: true, color: C.primary })
          ]
        });
      }
      function bodyP(text, opts = {}) {
        return new Paragraph({
          spacing: { before: opts.before || 80, after: opts.after || 80, line: 320 },
          children: [new TextRun({ text, font: 'Arial', size: 20, color: opts.color || C.black, bold: opts.bold || false })]
        });
      }
      function gap(h = 100) { return new Paragraph({ spacing: { before: h, after: 0 }, children: [] }); }
      function subHead(text) {
        return new Paragraph({ spacing: { before: 200, after: 80 },
          children: [new TextRun({ text, font: 'Arial', size: 20, bold: true, color: C.primary })]
        });
      }
      function noteBox(text, opts = {}) {
        return new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [TABLE_W],
          rows: [new TableRow({ children: [new TableCell({
            borders, width: { size: TABLE_W, type: WidthType.DXA },
            shading: { fill: opts.bg || C.lightYellow, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 140, right: 140 },
            children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [
              new TextRun({ text: opts.prefix || '', font: 'Arial', size: 17, bold: true, color: opts.prefixColor || C.warning }),
              new TextRun({ text, font: 'Arial', size: 17, color: opts.textColor || C.black })
            ]})]
          })] })]
        });
      }
      
      // ─── 데이터 준비 ───
      const today = new Date();
      const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
      const refNo = `TM-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}`;
      const firmName = TM.settings?.firmName || '특허법률사무소 디딤';
      const firmNameEn = TM.settings?.firmNameEn || 'PATENT GROUP DIDIM';
      const attorney = TM.settings?.attorneyName || p.applicant?.name || '담당 변리사';
      
      const risk = p.riskAssessment || {};
      const fee = p.feeCalculation || {};
      const validation = p.aiAnalysis?.validation || {};
      const searchResults = p.searchResults || {};
      const designatedGoods = p.designatedGoods || [];
      const totalGoods = designatedGoods.reduce((s, g) => s + (g.goods?.length || 0), 0);
      
      // 검색결과 분석
      const textResults = searchResults.text || [];
      const groupOverlap = textResults.filter(r => r.hasGroupOverlap);
      const noOverlap = textResults.filter(r => !r.hasGroupOverlap);
      const critical = groupOverlap.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');
      const medium = groupOverlap.filter(r => r.riskLevel === 'medium');
      const safe = groupOverlap.filter(r => r.riskLevel === 'low' || r.riskLevel === 'safe');
      
      const children = [];
      
      // ═══════════════ 표지 ═══════════════
      children.push(gap(1200));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: firmName, font: 'Arial', size: 36, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
        children: [new TextRun({ text: firmNameEn, font: 'Arial', size: 22, color: C.gray400 })]
      }));
      children.push(gap(500));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
        children: [new TextRun({ text: '상표 출원 검토 보고서', font: 'Arial', size: 48, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'Trademark Application Review Report', font: 'Arial', size: 22, color: C.gray400, italics: true })]
      }));
      children.push(gap(600));
      
      // 표지 하단 정보
      const coverRows = [
        ['문서번호', refNo],
        ['작 성 일', dateStr],
        ['출원상표', `${p.trademarkName || '-'}${p.trademarkNameEn ? ' / ' + p.trademarkNameEn : ''}`],
        ['출 원 인', p.applicant?.name || '-'],
        ['담당변리사', attorney],
      ];
      children.push(new Table({
        width: { size: 5400, type: WidthType.DXA }, columnWidths: [2000, 3400],
        alignment: AlignmentType.CENTER,
        rows: coverRows.map(([l, v]) => new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 2000, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: l, font: 'Arial', size: 20, bold: true, color: C.primary })]
            })]
          }),
          new TableCell({ borders: noBorders, width: { size: 3400, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({
              children: [new TextRun({ text: v, font: 'Arial', size: 20, color: C.black })]
            })]
          })
        ]}))
      }));
      children.push(gap(500));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '본 보고서는 의뢰인에 대한 법률 검토 의견으로서 비밀 유지 대상입니다.', font: 'Arial', size: 16, color: C.gray400, italics: true })]
      }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
      
      // ═══════════════ I. 검토 요약 ═══════════════
      children.push(secTitle('I', '검토 요약 (Executive Summary)'));
      
      const riskLabel = risk.level === 'high' ? '높음 (HIGH)' : risk.level === 'medium' ? '중간 (MEDIUM)' : risk.level ? '낮음 (LOW)' : '미평가';
      const riskColor = risk.level === 'high' ? C.danger : risk.level === 'medium' ? C.warning : C.success;
      
      children.push(new Table({
        width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 7106],
        rows: [
          new TableRow({ children: [ lCell('출원상표', 2400), dCell(`${p.trademarkName || '-'}${p.trademarkNameEn ? ' (' + p.trademarkNameEn + ')' : ''}`, 7106, { bold: true }) ] }),
          new TableRow({ children: [ lCell('상표 유형', 2400), dCell(TM.getTypeLabel(p.trademarkType), 7106) ] }),
          new TableRow({ children: [ lCell('지정상품류', 2400), dCell(designatedGoods.map(g => `제${g.classCode}류(${g.className || TM.niceClasses?.[g.classCode] || ''})`).join(', ') || '미선택', 7106) ] }),
          new TableRow({ children: [ lCell('총 지정상품 수', 2400), dCell(`${totalGoods}개 (${designatedGoods.length}개 류)`, 7106) ] }),
          new TableRow({ children: [ lCell('리스크 수준', 2400), dCell(riskLabel, 7106, { bold: true, color: riskColor }) ] }),
          new TableRow({ children: [ lCell('충돌 우려 상표', 2400), dCell(`${risk.conflictCount || critical.length || 0}건 (유사군 중복 기준)`, 7106, { color: C.danger }) ] }),
          ...(validation.overallScore ? [new TableRow({ children: [ lCell('AI 검증 정확도', 2400), dCell(`${validation.overallScore}%${validation.summary ? ' — ' + validation.summary : ''}`, 7106) ] })] : []),
          ...(fee.totalFee ? [new TableRow({ children: [ lCell('예상 출원비용', 2400), dCell(`${TM.formatNumber(fee.totalFee)}원`, 7106, { bold: true }) ] })] : []),
          ...(risk.recommendation ? [new TableRow({ children: [ lCell('종합 의견', 2400), dCell(risk.recommendation.slice(0, 300), 7106) ] })] : []),
        ]
      }));
      
      // ═══════════════ II. 출원인 정보 ═══════════════
      children.push(secTitle('II', '출원인 정보'));
      children.push(new Table({
        width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 2353, 2400, 2353],
        rows: [
          new TableRow({ children: [
            lCell('출원인 명칭', 2400), dCell(p.applicant?.name || '-', 2353),
            lCell('대표자', 2400), dCell(p.applicant?.representative || '-', 2353)
          ] }),
          new TableRow({ children: [
            lCell('사업자번호', 2400), dCell(p.applicant?.bizNumber || '-', 2353),
            lCell('주소', 2400), dCell(p.applicant?.address || '-', 2353)
          ] }),
        ]
      }));
      
      // ═══════════════ III. 사업 분석 ═══════════════
      if (p.aiAnalysis?.businessAnalysis) {
        children.push(secTitle('III', '사업 분석 결과'));
        children.push(bodyP('AI 사업 분석 시스템이 출원인의 사업 내용을 분석한 결과는 아래와 같습니다.'));
        
        const ana = p.aiAnalysis;
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 7106],
          rows: [
            new TableRow({ children: [ lCell('사업 내용', 2400), dCell(ana.businessAnalysis || '-', 7106) ] }),
            ...(ana.coreProducts?.length ? [new TableRow({ children: [ lCell('핵심 상품', 2400), dCell(ana.coreProducts.join(', '), 7106) ] })] : []),
            ...(ana.coreServices?.length ? [new TableRow({ children: [ lCell('핵심 서비스', 2400), dCell(ana.coreServices.join(', '), 7106) ] })] : []),
            ...(ana.businessTypes?.length ? [new TableRow({ children: [ lCell('사업 유형', 2400), dCell(ana.businessTypes.join(', '), 7106) ] })] : []),
            ...(ana.expansionPotential?.length ? [new TableRow({ children: [ lCell('확장 가능 분야', 2400), dCell(ana.expansionPotential.join(', '), 7106) ] })] : []),
          ]
        }));
      }
      
      // ═══════════════ IV. 지정상품 상세 ═══════════════
      if (designatedGoods.length > 0) {
        children.push(secTitle('IV', '지정상품 상세'));
        children.push(bodyP('각 상품류별 지정상품 내역입니다. 모든 지정상품은 특허청 고시명칭 기준이며, 비고시명칭은 별도 표기하였습니다.'));
        children.push(gap(40));
        
        for (const classData of designatedGoods) {
          children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [
            new TextRun({ text: `제${classData.classCode}류`, font: 'Arial', size: 22, bold: true, color: C.accent }),
            new TextRun({ text: ` — ${classData.className || TM.niceClasses?.[classData.classCode] || ''}`, font: 'Arial', size: 22, color: C.primary }),
            new TextRun({ text: `  (${classData.goods?.length || 0}개)`, font: 'Arial', size: 18, color: C.gray400 }),
          ] }));
          
          const gRows = [new TableRow({ children: [
            hCell('No.', 600), hCell('지정상품(서비스)명', 5506), hCell('유사군코드', 1600), hCell('고시여부', 1800)
          ] })];
          
          (classData.goods || []).forEach((g, idx) => {
            const nonG = !g.gazetted;
            const bg = nonG ? C.lightYellow : (idx % 2 === 0 ? undefined : 'F8FAFC');
            gRows.push(new TableRow({ children: [
              dCell(String(idx + 1), 600, { align: AlignmentType.CENTER, bg }),
              dCell(g.name, 5506, { bg, color: nonG ? C.warning : C.black }),
              dCell(g.similarGroup || '-', 1600, { align: AlignmentType.CENTER, bg }),
              dCell(nonG ? '비고시' : '고시명칭', 1800, { align: AlignmentType.CENTER, bg, color: nonG ? C.danger : C.success }),
            ] }));
          });
          
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [600, 5506, 1600, 1800], rows: gRows }));
        }
        
        // 비고시 경고
        const nonGazettedGoods = designatedGoods.flatMap(c => (c.goods || []).filter(g => !g.gazetted).map(g => `"${g.name}"(제${c.classCode}류)`));
        if (nonGazettedGoods.length > 0) {
          children.push(gap(60));
          children.push(noteBox(
            `${nonGazettedGoods.join(', ')}은(는) 비고시명칭입니다. 심사관 판단에 따라 보정 요구가 있을 수 있습니다.`,
            { prefix: '⚠ 유의사항: ' }
          ));
        }
      }
      
      // ═══════════════ V. AI 3단계 검증 ═══════════════
      if (validation.overallScore) {
        children.push(secTitle('V', 'AI 3단계 검증 결과'));
        children.push(bodyP('AI 검증 시스템이 추천 상품류 및 지정상품의 적합성을 3단계로 검증한 결과입니다.'));
        children.push(gap(40));
        
        // 검증 요약 테이블
        const s1 = validation.stages?.classValidation;
        const s2 = validation.stages?.goodsValidation;
        const s3 = validation.stages?.missingReview;
        
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 2369, 2369, 2368],
          rows: [
            new TableRow({ children: [ hCell('검증 항목', 2400), hCell('1단계: 류 검증', 2369), hCell('2단계: 상품 검증', 2369), hCell('3단계: 누락 검토', 2368) ] }),
            new TableRow({ children: [
              lCell('검증 내용', 2400),
              dCell('추천 류가 사업 내용에 적합한지', 2369),
              dCell('지정상품이 정확한 고시명칭인지', 2369),
              dCell('누락된 류 또는 상품이 있는지', 2368),
            ] }),
            new TableRow({ children: [
              lCell('결과', 2400),
              dCell(validation.invalidClasses?.length ? `${validation.invalidClasses.length}건 부적합` : '적합', 2369, { color: validation.invalidClasses?.length ? C.danger : C.success }),
              dCell(validation.invalidGoods?.length ? `${validation.invalidGoods.length}건 보정` : '적합', 2369, { color: validation.invalidGoods?.length ? C.warning : C.success }),
              dCell(validation.missingClasses?.length ? `${validation.missingClasses.length}건 추가 권장` : '누락 없음', 2368, { color: validation.missingClasses?.length ? C.accent : C.success }),
            ] }),
          ]
        }));
        
        children.push(gap(60));
        children.push(new Paragraph({ spacing: { before: 40, after: 100 }, children: [
          new TextRun({ text: '종합 정확도: ', font: 'Arial', size: 20, bold: true, color: C.primary }),
          new TextRun({ text: `${validation.overallScore}%`, font: 'Arial', size: 24, bold: true, color: C.success }),
        ] }));
        
        // 제거된 류
        if (validation.invalidClasses?.length > 0) {
          children.push(subHead('제거된 상품류'));
          const icRows = [new TableRow({ children: [ hCell('류', 1200), hCell('사유', 8306) ] })];
          validation.invalidClasses.forEach(c => {
            icRows.push(new TableRow({ children: [ dCell(`제${c.class}류`, 1200, { align: AlignmentType.CENTER, bg: C.lightRed, bold: true }), dCell(c.reason, 8306, { bg: C.lightRed }) ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1200, 8306], rows: icRows }));
        }
        
        // 보정 내역
        if (validation.invalidGoods?.length > 0 || validation.replacementGoods?.length > 0) {
          children.push(subHead('보정 내역'));
          const igRows = [new TableRow({ children: [ hCell('류', 1000), hCell('제거 상품', 3203), hCell('대체 상품', 3203), hCell('사유', 2100) ] })];
          
          (validation.replacementGoods || []).forEach(r => {
            igRows.push(new TableRow({ children: [
              dCell(`제${r.classCode}류`, 1000, { align: AlignmentType.CENTER }),
              dCell(r.remove || r.goodsName || '-', 3203, { color: C.danger }),
              dCell(r.addInstead || '-', 3203, { color: C.success, bold: true }),
              dCell(r.reason || '-', 2100),
            ] }));
          });
          (validation.invalidGoods || []).filter(g => !(validation.replacementGoods || []).some(r => r.classCode === g.classCode && r.remove === g.goodsName)).forEach(g => {
            igRows.push(new TableRow({ children: [
              dCell(`제${g.classCode}류`, 1000, { align: AlignmentType.CENTER }),
              dCell(g.goodsName, 3203, { color: C.danger }),
              dCell('-', 3203),
              dCell(g.reason || '-', 2100),
            ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1000, 3203, 3203, 2100], rows: igRows }));
        }
        
        // 추가 권장 류
        if (validation.missingClasses?.length > 0 || validation.suggestions?.filter(s => s.type === 'add_class')?.length > 0) {
          children.push(subHead('추가 권장 류'));
          const suggestions = validation.suggestions?.filter(s => s.type === 'add_class') || validation.missingClasses || [];
          const mcRows = [new TableRow({ children: [ hCell('류', 1200), hCell('우선순위', 1800), hCell('추가 권장 사유', 6506) ] })];
          suggestions.forEach(s => {
            mcRows.push(new TableRow({ children: [
              dCell(`제${s.class}류`, 1200, { align: AlignmentType.CENTER, bold: true }),
              dCell(s.priority || '권장', 1800, { color: C.warning }),
              dCell(s.reason || '-', 6506),
            ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1200, 1800, 6506], rows: mcRows }));
        }
        
        // 경고 사항
        if (validation.warnings?.length > 0) {
          children.push(subHead('확인 필요 사항'));
          validation.warnings.forEach(w => {
            children.push(noteBox(
              `제${w.class}류: ${w.message}`,
              { prefix: '⚠ ', bg: C.lightYellow }
            ));
          });
        }
      }
      
      // ═══════════════ VI. 선행상표 조사 ═══════════════
      if (searchResults.searchedAt || textResults.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(secTitle('VI', '선행상표 조사 결과'));
        children.push(bodyP('KIPRIS(한국특허정보원) 데이터베이스를 기반으로 선행상표를 조사한 결과입니다. 유사군 코드 중복 여부를 기준으로 실질적 충돌 위험을 분석하였습니다.'));
        children.push(gap(40));
        
        // 조사 요약
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3169, 3169, 3168],
          rows: [
            new TableRow({ children: [ hCell('구분', 3169), hCell('건수', 3169), hCell('비고', 3168) ] }),
            new TableRow({ children: [ lCell('총 검색 결과', 3169), dCell(`${textResults.length}건`, 3169, { align: AlignmentType.CENTER }), dCell('문자 + 도형 검색 통합', 3168) ] }),
            new TableRow({ children: [ dCell('유사군 비중복 (안전)', 3169, { color: C.success }), dCell(`${noOverlap.length}건`, 3169, { align: AlignmentType.CENTER }), dCell('상표명 동일해도 등록 가능', 3168) ] }),
            new TableRow({ children: [ dCell('유사군 중복 (검토 필요)', 3169, { color: C.warning, bold: true }), dCell(`${groupOverlap.length}건`, 3169, { align: AlignmentType.CENTER, bold: true }), dCell('아래 상세 분석 참조', 3168) ] }),
          ]
        }));
        
        // 위험등급별 분류
        children.push(gap(40));
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3500, 1506, 4500],
          rows: [
            new TableRow({ children: [ hCell('위험 등급', 3500), hCell('건수', 1506), hCell('의미', 4500) ] }),
            new TableRow({ children: [ dCell('고위험 (유사군 중복 + 상표 유사)', 3500, { color: C.danger, bold: true, bg: C.lightRed }), dCell(`${critical.length}건`, 1506, { align: AlignmentType.CENTER, bold: true, color: C.danger, bg: C.lightRed }), dCell('거절 가능성 높음, 의견서 준비 필요', 4500, { bg: C.lightRed }) ] }),
            new TableRow({ children: [ dCell('중위험 (유사군 중복 + 다소 유사)', 3500, { color: C.warning, bg: C.lightYellow }), dCell(`${medium.length}건`, 1506, { align: AlignmentType.CENTER, color: C.warning, bg: C.lightYellow }), dCell('심사관 판단 필요, 차별성 논거 준비', 4500, { bg: C.lightYellow }) ] }),
            new TableRow({ children: [ dCell('저위험 (유사군 중복 + 상표 상이)', 3500, { color: C.success, bg: C.lightGreen }), dCell(`${safe.length}건`, 1506, { align: AlignmentType.CENTER, color: C.success, bg: C.lightGreen }), dCell('등록 가능성 높음', 4500, { bg: C.lightGreen }) ] }),
          ]
        }));
        
        // 충돌 상표 상세
        const conflictAll = [...critical, ...medium].slice(0, 10);
        if (conflictAll.length > 0) {
          children.push(subHead('주요 충돌 우려 상표 상세'));
          const cfRows = [new TableRow({ children: [
            hCell('No.', 500), hCell('위험도', 1100), hCell('상표명', 2200), hCell('출원번호', 1806),
            hCell('상태', 900), hCell('유사도', 1100), hCell('중복유사군', 1900)
          ] })];
          
          conflictAll.forEach((r, idx) => {
            const isCrit = idx < critical.length;
            const bg = isCrit ? C.lightRed : C.lightYellow;
            const tmName = r.title || r.trademarkName || r.name || '-';
            const appNo = r.applicationNumber || r.appNo || '-';
            const status = r.applicationStatus || r.status || '-';
            const sim = r.scoreBreakdown?.text || r.textSim || '-';
            const overlap = (r.overlappingGroups || []).join(', ') || r.groupOverlap || '-';
            
            cfRows.push(new TableRow({ children: [
              dCell(String(idx + 1), 500, { align: AlignmentType.CENTER, bg }),
              dCell(isCrit ? '고위험' : '중위험', 1100, { align: AlignmentType.CENTER, bg, color: isCrit ? C.danger : C.warning, bold: true }),
              dCell(tmName, 2200, { bold: true, bg }),
              dCell(appNo, 1806, { bg }),
              dCell(status, 900, { align: AlignmentType.CENTER, bg }),
              dCell(typeof sim === 'number' ? `${sim}%` : String(sim), 1100, { align: AlignmentType.CENTER, bg }),
              dCell(overlap, 1900, { align: AlignmentType.CENTER, bg }),
            ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [500, 1100, 2200, 1806, 900, 1100, 1900], rows: cfRows }));
        }
      }
      
      // ═══════════════ VII. 리스크 종합 평가 ═══════════════
      if (risk.level) {
        children.push(secTitle('VII', '리스크 종합 평가'));
        
        const rBg = risk.level === 'high' ? C.lightRed : risk.level === 'medium' ? C.lightYellow : C.lightGreen;
        const rLbl = risk.level === 'high' ? '높음 (HIGH) — 거절 가능성 상당' :
                     risk.level === 'medium' ? '중간 (MEDIUM) — 심사관 판단에 따라 등록 가능' : '낮음 (LOW) — 등록 가능성 높음';
        
        // 리스크 배너
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [TABLE_W],
          rows: [new TableRow({ children: [new TableCell({
            borders, width: { size: TABLE_W, type: WidthType.DXA },
            shading: { fill: rBg, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
                children: [new TextRun({ text: '종합 리스크 등급', font: 'Arial', size: 20, color: C.gray600 })]
              }),
              new Paragraph({ alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: rLbl, font: 'Arial', size: 28, bold: true, color: riskColor })]
              }),
            ]
          })] })]
        }));
        
        children.push(gap(60));
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 7106],
          rows: [
            new TableRow({ children: [ lCell('상세 분석', 2400), dCell(risk.details || '-', 7106) ] }),
            new TableRow({ children: [ lCell('충돌 상표 수', 2400), dCell(`${risk.conflictCount || 0}건 (유사군 중복 + 상표 유사 기준)`, 7106, { bold: true, color: C.danger }) ] }),
          ]
        }));
      }
      
      // ═══════════════ VIII. 권고사항 ═══════════════
      if (risk.recommendation) {
        children.push(secTitle('VIII', '권고사항'));
        
        // 권고사항 파싱 (번호별 분리 시도)
        const recText = risk.recommendation;
        const recParts = recText.split(/\d+[\)\.]\s*/).filter(Boolean);
        
        if (recParts.length > 1) {
          const recRows = [new TableRow({ children: [ hCell('No.', 600), hCell('권고 내용', 8906) ] })];
          recParts.forEach((part, idx) => {
            recRows.push(new TableRow({ children: [ dCell(String(idx + 1), 600, { align: AlignmentType.CENTER }), dCell(part.trim(), 8906) ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [600, 8906], rows: recRows }));
        } else {
          children.push(bodyP(recText));
        }
      }
      
      // ═══════════════ IX. 비용 명세 ═══════════════
      if (fee.totalFee) {
        children.push(secTitle('IX', '비용 명세'));
        children.push(subHead('출원 비용'));
        
        const fRows = [new TableRow({ children: [ hCell('항목', 4700), hCell('금액', 2403), hCell('비고', 2403) ] })];
        (fee.breakdown || []).forEach(item => {
          const isRed = item.type === 'reduction';
          fRows.push(new TableRow({ children: [
            dCell(item.label, 4700, { color: isRed ? C.success : C.black }),
            dCell(`${isRed ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}원`, 2403, { align: AlignmentType.RIGHT, color: isRed ? C.success : C.black, bold: isRed }),
            dCell(item.note || '', 2403),
          ] }));
        });
        
        // 합계
        fRows.push(new TableRow({ children: [
          new TableCell({ borders, width: { size: 4700, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ children: [new TextRun({ text: '출원 합계', font: 'Arial', size: 20, bold: true, color: C.primary })] })]
          }),
          new TableCell({ borders, width: { size: 2403, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${TM.formatNumber(fee.totalFee)}원`, font: 'Arial', size: 22, bold: true, color: C.primary })] })]
          }),
          new TableCell({ borders, width: { size: 2403, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ children: [new TextRun({ text: '감면 적용 후', font: 'Arial', size: 18, color: C.gray600 })] })]
          }),
        ] }));
        
        children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [4700, 2403, 2403], rows: fRows }));
        
        children.push(gap(40));
        children.push(noteBox(
          '상기 비용은 특허청 관납료 기준이며, 대리인 수수료는 별도입니다. 등록료는 등록 결정 시 납부하며, 분납(5년분)도 가능합니다.',
          { prefix: '※ 참고: ', bg: C.lightBlue, prefixColor: C.accent }
        ));
      }
      
      // ═══════════════ X. 향후 절차 ═══════════════
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(secTitle('X', '향후 절차 및 일정'));
      
      const procRows = [
        new TableRow({ children: [ hCell('단계', 600), hCell('절차', 2400), hCell('예상 소요 기간', 3253), hCell('비고', 3253) ] }),
        ['1', '출원서 제출', '의뢰인 승인 후 즉시', '전자출원 (특허로)'],
        ['2', '방식심사', '출원 후 약 1~2주', '서류 보정 요구 가능'],
        ['3', '실체심사', '출원 후 약 10~14개월', '우선심사 시 약 2~3개월'],
        ['4', '거절이유통지 (예상)', '심사 중 발생 시', '의견서 제출 기한: 2개월'],
        ['5', '등록결정', '심사 완료 후', '등록료 납부 기한: 2개월'],
        ['6', '등록공고', '등록 후 약 1개월', '이의신청 기간: 공고일로부터 2개월'],
      ].map(row => {
        if (row instanceof TableRow) return row;
        return new TableRow({ children: [
          dCell(row[0], 600, { align: AlignmentType.CENTER }),
          dCell(row[1], 2400, { bold: row[0] === '5' }),
          dCell(row[2], 3253),
          dCell(row[3], 3253),
        ] });
      });
      children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [600, 2400, 3253, 3253], rows: procRows }));
      
      // ═══════════════ 우선심사 (있을 경우) ═══════════════
      if (p.priorityExam?.enabled && p.priorityExam?.generatedDocument) {
        children.push(secTitle('XI', '우선심사 설명서'));
        const lines = p.priorityExam.generatedDocument.split('\n').filter(l => l.trim());
        lines.forEach(line => { children.push(bodyP(line)); });
      }
      
      // ═══════════════ 면책조항 ═══════════════
      children.push(gap(300));
      children.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder, space: 12 } },
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: '면책조항 (Disclaimer)', font: 'Arial', size: 20, bold: true, color: C.primary })]
      }));
      
      const disclaimers = [
        `1. 본 보고서는 ${firmName}(이하 "본 사무소")이 의뢰인의 요청에 따라 작성한 상표 출원 검토 의견서로서, 상표 등록의 성공을 보장하는 문서가 아닙니다.`,
        '2. 본 보고서에 포함된 리스크 평가 및 등록 가능성 분석은 본 사무소의 전문적 판단과 AI 분석 시스템의 보조적 결과를 종합한 것이며, 최종 심사 결과는 특허청 심사관의 판단에 따라 달라질 수 있습니다.',
        '3. AI 기반 분석 결과(사업 분석, 상품류 추천, 유사도 평가 등)는 참고 목적의 보조 자료이며, 변리사의 전문 검토를 거쳐 최종 확정됩니다.',
        '4. 선행상표 조사는 KIPRIS 데이터베이스를 기반으로 수행되었으며, 조사 시점 이후 출원/등록된 상표 또는 미공개 상표는 반영되지 않을 수 있습니다.',
        '5. 비용 명세는 보고서 작성일 기준 특허청 관납료이며, 법령 개정에 따라 변경될 수 있습니다. 대리인 수수료는 별도 안내합니다.',
        '6. 본 보고서는 의뢰인과 본 사무소 간의 비밀유지 대상 문서이며, 의뢰인의 사전 동의 없이 제3자에게 공개하거나 배포할 수 없습니다.',
        '7. 본 보고서의 내용은 작성일 기준의 법령, 심사기준 및 판례에 기초하고 있으며, 이후 변경된 사항은 반영되지 않을 수 있습니다.',
      ];
      disclaimers.forEach(text => {
        children.push(new Paragraph({ spacing: { before: 40, after: 40, line: 280 },
          children: [new TextRun({ text, font: 'Arial', size: 16, color: C.gray600 })]
        }));
      });
      
      // 서명란
      children.push(gap(200));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: dateStr, font: 'Arial', size: 20, color: C.black })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 },
        children: [new TextRun({ text: firmName, font: 'Arial', size: 22, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 20 },
        children: [new TextRun({ text: `담당 변리사  ${attorney}`, font: 'Arial', size: 20, color: C.black })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: '(직인 생략)', font: 'Arial', size: 16, color: C.gray400, italics: true })]
      }));
      
      // ═══════════════ 문서 조립 ═══════════════
      const doc = new Document({
        styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }
            }
          },
          headers: {
            default: new Header({
              children: [new Paragraph({ alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `${firmName}  |  상표 출원 검토 보고서`, font: 'Arial', size: 14, color: C.gray400, italics: true })]
              })]
            })
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.tableBorder, space: 8 } },
                children: [
                  new TextRun({ text: `문서번호: ${refNo}  |  - `, font: 'Arial', size: 14, color: C.gray400 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: C.gray400 }),
                  new TextRun({ text: ' -  |  CONFIDENTIAL', font: 'Arial', size: 14, color: C.gray400, italics: true }),
                ]
              })]
            })
          },
          children: children
        }]
      });
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `상표검토보고서_${p.trademarkName || 'unnamed'}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      App.showToast('검토 보고서가 다운로드되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] Word 보고서 생성 실패:', error);
      App.showToast('보고서 생성 실패: ' + error.message, 'error');
    }
  };

})();
