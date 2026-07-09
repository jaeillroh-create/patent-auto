/* ============================================================
   상표출원 우선심사 자동화 시스템 - Step 렌더링 (Part 2)
   Step 1~4: 상표정보, 지정상품, 선행검색, 유사도평가
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM Steps] TM 모듈이 로드되지 않았습니다.');
    return;
  }

  // ============================================================
  // Step 1: 상표 정보 입력 (2-column 레이아웃)
  // ============================================================
  
  TM.renderStep1_TrademarkInfo = function(container) {
    const p = TM.currentProject;
    const hasAiResult = p.aiAnalysis?.businessAnalysis;
    
    container.innerHTML = `
      <div class="tm-2col">
        <!-- 좌측: 입력 영역 -->
        <div class="tm-col">
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3><span class="ico" data-icon="tag"></span> 상표 기본 정보</h3>
            </div>
            <div class="tm-panel-body">
              <!-- 상표 유형 -->
              <div class="tm-field">
                <label>상표 유형</label>
                <div class="tm-chips">
                  ${[
                    {type: 'text', label: '문자'},
                    {type: 'figure', label: '도형'},
                    {type: 'combined', label: '결합'},
                    {type: 'sound', label: '소리'},
                    {type: 'color', label: '색채'},
                    {type: '3d', label: '입체'}
                  ].map(t => `
                    <label class="tm-chip ${p.trademarkType === t.type ? 'active' : ''}">
                      <input type="radio" name="trademarkType" value="${t.type}" 
                             data-field="trademarkType" ${p.trademarkType === t.type ? 'checked' : ''}>
                      ${t.label}
                    </label>
                  `).join('')}
                </div>
              </div>
              
              <!-- 상표명 -->
              <div class="tm-field">
                <label>상표명 <span class="required">*</span></label>
                <input type="text" class="tm-input tm-input-lg" data-field="trademarkName" 
                       value="${TM.escapeHtml(p.trademarkName)}" 
                       placeholder="한글, 영문, 한자 등">
              </div>
              
              <!-- 견본 업로드 (개선) -->
              <div class="tm-field">
                <label>견본 <span style="font-weight:400;color:var(--dt-g400);font-size:12px;">(도형/결합 상표 시 필수)</span></label>
                <div class="tm-specimen-upload" id="tm-specimen-dropzone"
                     ondragover="TM.handleDragOver(event)"
                     ondragleave="TM.handleDragLeave(event)"
                     ondrop="TM.handleSpecimenDrop(event)"
                     onclick="document.getElementById('tm-specimen-input').click()">
                  ${p.specimenUrl ? `
                    <div class="tm-specimen-preview">
                      <img src="${p.specimenUrl}" alt="견본">
                      <div class="tm-specimen-overlay">
                        <span>클릭하여 변경</span>
                      </div>
                    </div>
                  ` : `
                    <div class="tm-specimen-empty">
                      <span class="tm-specimen-icon"><span class="ico" data-icon="image"></span></span>
                      <span class="tm-specimen-text">클릭 또는 드래그하여 업로드</span>
                      <span class="tm-specimen-hint">JPG, PNG, GIF (최대 5MB)</span>
                    </div>
                  `}
                </div>
                <input type="file" id="tm-specimen-input" data-field="specimen" 
                       accept="image/jpeg,image/png,image/gif" style="display:none">
              </div>
            </div>
          </div>
          
          <!-- AI 분석 입력 -->
          <div class="tm-panel tm-panel-highlight">
            <div class="tm-panel-header">
              <h3><span class="ico" data-icon="robot"></span> AI 사업 분석</h3>
              <span class="tm-badge tm-badge-primary">추천</span>
            </div>
            <div class="tm-panel-body">
              <p class="tm-hint">사업 내용을 입력하거나 파일을 업로드하면 AI가 상품류와 지정상품을 추천합니다.</p>
              <div class="tm-field" style="margin-bottom: 12px;">
                <input type="text" class="tm-input" id="tm-business-url"
                       value="${TM.escapeHtml(p.businessDescription || '')}"
                       placeholder="예: 소프트웨어 개발, 특허 출원 대행">
              </div>
              <!-- 사업 분석 파일 업로드 -->
              <div class="tm-business-file-area" style="margin-bottom: 16px;">
                <div class="tm-dropzone-compact tm-business-dropzone" id="tm-business-dropzone"
                     onclick="document.getElementById('tm-business-file-input').click()"
                     ondragover="event.preventDefault(); this.classList.add('dragover')"
                     ondragleave="this.classList.remove('dragover')"
                     ondrop="event.preventDefault(); this.classList.remove('dragover'); TM.handleBusinessFileUpload(event.dataTransfer.files)">
                  <span class="tm-dropzone-compact-icon">📎</span>
                  <span class="tm-dropzone-compact-text">사업 관련 파일 업로드 <strong>(클릭 또는 드래그)</strong></span>
                  <span class="tm-dropzone-compact-formats">PDF, DOCX, XLSX, TXT, HWP 등</span>
                </div>
                <input type="file" id="tm-business-file-input"
                       accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.rtf,.xlsx,.xls,.pptx,.hwp,.hwpx"
                       multiple style="display:none"
                       onchange="TM.handleBusinessFileUpload(this.files); this.value=''">
                ${(p.businessFiles && p.businessFiles.length > 0) ? `
                <div class="tm-business-file-list" id="tm-business-file-list">
                  ${p.businessFiles.map((f, i) => `
                    <div class="tm-business-file-item">
                      <span class="tm-business-file-icon">${TM.getFileIcon(f.name)}</span>
                      <span class="tm-business-file-name" title="${TM.escapeHtml(f.name)}">${TM.escapeHtml(f.name)}</span>
                      <span class="tm-business-file-size">${TM.formatFileSize(f.size)}</span>
                      <button class="tm-business-file-remove" onclick="TM.removeBusinessFile(${i})" title="삭제"><span class="ico" data-icon="x"></span></button>
                    </div>
                  `).join('')}
                </div>
                ` : ''}
              </div>
              <button class="btn btn-primary btn-block" data-action="tm-analyze-business" style="padding: 12px;"><span class="ico" data-icon="search"></span> 분석</button>
            </div>
          </div>
          
          <!-- 출원인 정보 (확장) -->
          <details class="tm-panel" ${p.applicant.name ? 'open' : ''}>
            <summary class="tm-panel-header">
              <h3><span class="ico" data-icon="user"></span> 출원인 정보</h3>
              <span class="tm-badge tm-badge-gray">${p.applicant.name ? '입력됨' : '선택'}</span>
            </summary>
            <div class="tm-panel-body">
              <div class="tm-field-grid tm-field-grid-3">
                <div class="tm-field">
                  <label>디딤 관리번호 <span style="font-weight:400;color:var(--dt-g400);font-size:11px;">(프로젝트 식별)</span></label>
                  <input type="text" class="tm-input" id="tm-project-title-input"
                         value="${TM.escapeHtml(TM.currentProject?.title || '')}" 
                         placeholder="예: 26T0001"
                         onchange="TM.updateProjectTitle(this.value)">
                </div>
                <div class="tm-field">
                  <label>성명/상호 <span class="required">*</span></label>
                  <input type="text" class="tm-input" data-field="applicant.name" 
                         value="${TM.escapeHtml(p.applicant.name)}" placeholder="홍길동 / (주)디딤">
                </div>
                <div class="tm-field">
                  <label>출원인 유형</label>
                  <select class="tm-input" data-field="applicant.type">
                    <option value="individual" ${p.applicant.type === 'individual' ? 'selected' : ''}>개인</option>
                    <option value="corporation" ${p.applicant.type === 'corporation' ? 'selected' : ''}>법인</option>
                    <option value="sme" ${p.applicant.type === 'sme' ? 'selected' : ''}>중소기업</option>
                  </select>
                </div>
                <div class="tm-field">
                  <label>사업자/주민등록번호</label>
                  <input type="text" class="tm-input" data-field="applicant.registrationNumber" 
                         value="${TM.escapeHtml(p.applicant.registrationNumber || '')}" placeholder="000-00-00000">
                </div>
                <div class="tm-field">
                  <label>연락처</label>
                  <input type="text" class="tm-input" data-field="applicant.phone" 
                         value="${TM.escapeHtml(p.applicant.phone || '')}" placeholder="010-0000-0000">
                </div>
                <div class="tm-field">
                  <label>이메일</label>
                  <input type="text" class="tm-input" data-field="applicant.email" 
                         value="${TM.escapeHtml(p.applicant.email || '')}" placeholder="example@email.com">
                </div>
              </div>
              <div class="tm-field" style="margin-top: 12px;">
                <label>주소</label>
                <input type="text" class="tm-input" data-field="applicant.address" 
                       value="${TM.escapeHtml(p.applicant.address || '')}" placeholder="서울시 강남구..."">
              </div>
            </div>
          </details>
        </div>
        
        <!-- 우측: 결과 영역 -->
        <div class="tm-col">
          ${hasAiResult ? `
            <div class="tm-panel">
              <div class="tm-panel-header">
                <h3><span class="ico" data-icon="clipboard"></span> 분석 결과</h3>
              </div>
              <div class="tm-panel-body">
                <div class="tm-summary">${TM.escapeHtml(p.aiAnalysis.businessAnalysis)}</div>
                ${p.aiAnalysis.searchKeywords?.length > 0 ? `
                  <div class="tm-keywords">
                    ${p.aiAnalysis.searchKeywords.slice(0, 6).map(k => `<span class="tm-kw">${k}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>

            ${p.aiAnalysis.fileAnalysisInsights ? `
            <div class="tm-panel tm-strategy-panel">
              <div class="tm-panel-header">
                <h3><span class="ico" data-icon="doc"></span> 문서 분석 전략</h3>
                <span class="tm-badge tm-badge-info">파일 기반</span>
              </div>
              <div class="tm-panel-body">
                ${p.aiAnalysis.fileAnalysisInsights.documentTypes?.length > 0 ? `
                <div class="tm-strategy-section">
                  <div class="tm-strategy-label">분석 문서</div>
                  <div class="tm-strategy-tags">
                    ${p.aiAnalysis.fileAnalysisInsights.documentTypes.map(t => `<span class="tm-strategy-tag">${TM.escapeHtml(t)}</span>`).join('')}
                  </div>
                </div>
                ` : ''}
                ${p.aiAnalysis.fileAnalysisInsights.keyFindings?.length > 0 ? `
                <div class="tm-strategy-section">
                  <div class="tm-strategy-label">핵심 발견사항</div>
                  <ul class="tm-strategy-findings">
                    ${p.aiAnalysis.fileAnalysisInsights.keyFindings.map(f => `<li>${TM.escapeHtml(f)}</li>`).join('')}
                  </ul>
                </div>
                ` : ''}
                ${p.aiAnalysis.fileAnalysisInsights.goodsSearchStrategy ? `
                <div class="tm-strategy-section">
                  <div class="tm-strategy-label">지정상품 탐색 전략</div>
                  <div class="tm-strategy-text">${TM.escapeHtml(p.aiAnalysis.fileAnalysisInsights.goodsSearchStrategy)}</div>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <div class="tm-panel">
              <div class="tm-panel-header">
                <h3><span class="ico" data-icon="flag"></span> 추천 상품류</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">✓ 전체 적용</button>
              </div>
              <div class="tm-panel-body">
                <p style="font-size: 13px; color: var(--dt-g500); margin: 0 0 16px;">AI가 분석한 결과, 아래 상품류가 사업에 적합합니다. <strong>적용</strong> 버튼을 클릭하면 지정상품에 추가됩니다.</p>
                <div class="tm-rec-list">
                  ${p.aiAnalysis.recommendedClasses.map((code, idx) => {
                    const className = TM.niceClasses[code] || '';
                    const reason = p.aiAnalysis.classReasons?.[code] || '';
                    const goods = p.aiAnalysis.recommendedGoods?.[code] || [];
                    const isAdded = p.designatedGoods.some(g => g.classCode === code);
                    
                    return `
                      <div class="tm-rec-item ${isAdded ? 'added' : ''}">
                        <div class="tm-rec-num">${idx + 1}</div>
                        <div class="tm-rec-info">
                          <div class="tm-rec-class">제${code}류 <span>${className}</span></div>
                          ${reason ? `<div class="tm-rec-desc">${TM.escapeHtml(reason)}</div>` : ''}
                          ${goods.length > 0 ? `
                            <div class="tm-rec-goods-label">추천 지정상품 (${goods.length}개):</div>
                            <div class="tm-rec-tags">
                              ${goods.slice(0, 10).map(g => `<span>${g.name || g}</span>`).join('')}
                            </div>
                          ` : ''}
                        </div>
                        <div class="tm-rec-btn">
                          ${isAdded ? `<span class="applied">✓</span>` : 
                            `<button class="btn btn-primary" data-action="tm-apply-recommendation" data-class-code="${code}">+ 적용</button>`}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          ` : `
            <div class="tm-panel tm-panel-empty">
              <div class="tm-empty">
                <div class="tm-empty-icon"><span class="ico" data-icon="search"></span></div>
                <h4>AI 분석을 시작하세요</h4>
                <p>사업 내용을 입력하고 분석 버튼을 클릭하면<br>적합한 상품류를 추천받을 수 있습니다.</p>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
    
    // 상표 유형 변경 이벤트
    container.querySelectorAll('input[name="trademarkType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        TM.updateField('trademarkType', e.target.value);
        container.querySelectorAll('.tm-chip').forEach(opt => {
          opt.classList.toggle('active', opt.querySelector('input').value === e.target.value);
        });
      });
    });
  };
  
  TM.getTypeIcon = function(type) {
    const icons = {
      text:     '<span class="ico" data-icon="tag"></span>',
      figure:   '<span class="ico" data-icon="image"></span>',
      combined: '<span class="ico" data-icon="split"></span>',
      sound:    '<span class="ico" data-icon="bell"></span>',
      color:    '<span class="ico" data-icon="image"></span>',
      '3d':     '<span class="ico" data-icon="box"></span>'
    };
    return icons[type] || '<span class="ico" data-icon="tag"></span>';
  };
  
  TM.getTypeLabel = function(type) {
    const labels = {
      text: '문자',
      figure: '도형',
      combined: '결합',
      sound: '소리',
      color: '색채',
      '3d': '입체'
    };
    return labels[type] || type;
  };
  
  TM.handleSpecimenUpload = async function(file) {
    if (!file) return;
    
    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      App.showToast('파일 크기는 5MB 이하여야 합니다.', 'error');
      return;
    }
    
    // 파일 형식 체크
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      App.showToast('JPG, PNG, GIF 형식만 지원합니다.', 'error');
      return;
    }
    
    try {
      App.showToast('이미지 업로드 중...', 'info');
      
      // Supabase Storage에 업로드
      const fileName = `${TM.currentProject.id}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await App.sb.storage
        .from('trademark-specimens')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // 공개 URL 생성
      const { data: urlData } = App.sb.storage
        .from('trademark-specimens')
        .getPublicUrl(fileName);
      
      TM.currentProject.specimenUrl = urlData.publicUrl;
      TM.currentProject.specimenFile = fileName;
      
      // 미리보기 업데이트
      const preview = document.getElementById('tm-specimen-preview');
      if (preview) {
        preview.innerHTML = `<img src="${urlData.publicUrl}" alt="견본 이미지">`;
      }
      
      App.showToast('이미지가 업로드되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 이미지 업로드 실패:', error);
      App.showToast('이미지 업로드 실패: ' + error.message, 'error');
    }
  };
  
  TM.removeSpecimen = async function() {
    if (!TM.currentProject.specimenFile) {
      TM.currentProject.specimenUrl = null;
      TM.renderCurrentStep();
      return;
    }
    
    try {
      await App.sb.storage
        .from('trademark-specimens')
        .remove([TM.currentProject.specimenFile]);
      
      TM.currentProject.specimenUrl = null;
      TM.currentProject.specimenFile = null;
      TM.renderCurrentStep();
      
      App.showToast('이미지가 제거되었습니다.', 'success');
    } catch (error) {
      console.error('[TM] 이미지 제거 실패:', error);
    }
  };

  // ============================================================
  // Step 2: 지정상품 선택 (2-column 레이아웃)
  // ============================================================
  
  TM.renderStep2_DesignatedGoods = function(container) {
    const p = TM.currentProject;
    const hasAiRec = p.aiAnalysis?.recommendedClasses?.length > 0;
    const totalGoods = p.designatedGoods.reduce((sum, c) => sum + c.goods.length, 0);
    
    // 모든 유사군 코드 수집
    const allSimilarGroups = new Set();
    p.designatedGoods.forEach(classData => {
      classData.goods?.forEach(g => {
        if (g.similarGroup) {
          g.similarGroup.split(',').forEach(sg => allSimilarGroups.add(sg.trim()));
        }
      });
    });
    
    container.innerHTML = `
      <div class="tm-2col">
        <!-- 좌측: 상품류 선택 -->
        <div class="tm-col">
          <!-- 고시명칭 토글 -->
          <div class="tm-panel tm-panel-sm">
            <div class="tm-toggles">
              <label class="tm-toggle ${p.gazettedOnly ? 'active' : ''}">
                <input type="radio" name="gazettedMode" value="true" ${p.gazettedOnly ? 'checked' : ''}>
                고시명칭 Only <span class="fee">46,000원/류</span>
              </label>
              <label class="tm-toggle ${!p.gazettedOnly ? 'active' : ''}">
                <input type="radio" name="gazettedMode" value="false" ${!p.gazettedOnly ? 'checked' : ''}>
                비고시 허용 <span class="fee">52,000원/류</span>
              </label>
            </div>
          </div>
          
          ${hasAiRec ? `
            <!-- AI 추천 상품류 (3단계: 핵심/권장/확장) -->
            <div class="tm-panel tm-panel-ai">
              <div class="tm-panel-header">
                <h3><span class="ico" data-icon="robot"></span> AI 추천 상품류</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">✓ 전체 적용</button>
              </div>
              <div class="tm-ai-rec-desc" style="font-size: 12px; padding: 8px 12px; background: var(--dt-g50); margin: 0 0 10px 0; border-radius: 4px;">
                사업 분석 결과입니다. <strong style="color: var(--dt-danger);"><span class="status-dot negative"></span> 핵심</strong>은 필수, 
                <strong style="color: var(--dt-warning);"><span class="status-dot cautionary"></span> 권장</strong>은 권리 보호용, 
                <strong style="color: var(--dt-success);"><span class="status-dot positive"></span> 확장</strong>은 사업 확장 시 고려하세요.
              </div>
              
              <div id="tm-ai-recommendations-container"></div>
              
              <!-- 추가 추천 요청 버튼 -->
              <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dt-g100); text-align: center;">
                <button class="btn btn-outline btn-sm" data-action="tm-request-more-recommendations" style="font-size: 12px;">
                  <span class="ico" data-icon="search"></span> 추가 추천 요청
                </button>
              </div>
            </div>
          ` : ''}
          
          <!-- 전체 상품류 그리드 -->
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3><span class="ico" data-icon="clipboard"></span> 전체 상품류</h3>
              <span class="tm-badge">NICE 13판 (45류)</span>
            </div>
            <div class="tm-panel-body">
              <div class="tm-class-grid">
                ${Object.keys(TM.niceClasses).sort((a, b) => parseInt(a) - parseInt(b)).map(code => {
                  const isSelected = p.designatedGoods.some(g => g.classCode === code);
                  const isRec = p.aiAnalysis?.recommendedClasses?.includes(code);
                  return `
                    <button class="tm-class-btn ${isSelected ? 'selected' : ''} ${isRec ? 'rec' : ''}" 
                            data-action="${isSelected ? 'tm-remove-class' : 'tm-add-class'}" 
                            data-class-code="${code}" title="${TM.niceClasses[code]}">
                      ${code}
                    </button>
                  `;
                }).join('')}
              </div>
              <div class="tm-grid-legend">
                <span><span class="dot selected"></span> 선택됨</span>
                <span><span class="dot rec"></span> AI추천</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 우측: 선택된 지정상품 -->
        <div class="tm-col">
          <div class="tm-panel tm-panel-selected">
            <div class="tm-panel-header">
              <h3><span class="ico" data-icon="check-circle"></span> 선택된 지정상품</h3>
              <div class="tm-selected-stats">
                <span class="tm-stat-item"><strong>${p.designatedGoods.length}</strong>류</span>
                <span class="tm-stat-item"><strong>${totalGoods}</strong>개 상품</span>
                <span class="tm-stat-item"><strong>${allSimilarGroups.size}</strong>개 유사군</span>
                ${totalGoods > 0 ? `<button class="btn btn-sm btn-outline" data-action="tm-copy-goods" title="지정상품 복사"><span class="ico" data-icon="clipboard"></span> 복사</button>` : ''}
              </div>
            </div>
            
            ${p.designatedGoods.length > 0 ? `
              <!-- 유사군 요약 -->
              <div class="tm-similar-summary">
                <span class="label">유사군 코드:</span>
                <div class="tm-similar-tags">
                  ${Array.from(allSimilarGroups).slice(0, 8).map(sg => `<span class="tm-similar-tag">${sg}</span>`).join('')}
                  ${allSimilarGroups.size > 8 ? `<span class="tm-similar-more">+${allSimilarGroups.size - 8}개</span>` : ''}
                </div>
              </div>
            ` : ''}
            
            <div class="tm-goods-container">
              ${p.designatedGoods.length === 0 ? `
                <div class="tm-empty-goods">
                  <div class="icon"><span class="ico" data-icon="box"></span></div>
                  <h4>지정상품을 선택하세요</h4>
                  <p>좌측에서 상품류를 클릭하거나<br>AI 추천을 적용하세요.</p>
                </div>
              ` : p.designatedGoods.map(classData => TM.renderClassGoodsCard(classData)).join('')}
            </div>
          </div>
          
          <!-- 비고시명칭 직접 입력 섹션 -->
          ${p.designatedGoods.length > 0 ? `
            <div class="tm-panel tm-panel-custom">
              <div class="tm-panel-header">
                <h3><span class="ico" data-icon="edit"></span> 비고시명칭 직접 입력 <span class="optional">(선택)</span></h3>
              </div>
              <div class="tm-custom-term-info">
                <p>고시명칭에 없는 상품/서비스명을 직접 입력할 수 있습니다.</p>
                <p class="tm-custom-term-fee"><span class="ico" data-icon="money"></span> 비고시명칭 사용 시 류당 <strong>+6,000원</strong> (52,000원/류)</p>
              </div>
              
              <div class="tm-custom-term-input">
                <select id="tm-custom-term-class" class="tm-select-sm">
                  ${p.designatedGoods.map(g => `<option value="${g.classCode}">제${g.classCode}류</option>`).join('')}
                </select>
                <input type="text" id="tm-custom-term-input" 
                       placeholder="예: AI 기반 지원사업 매칭 서비스업" 
                       class="tm-input-flex">
                <button class="btn btn-secondary btn-sm" data-action="tm-add-custom-term">
                  + 추가
                </button>
              </div>
              
              <!-- 비고시명칭 분석 결과 표시 영역 -->
              <div id="tm-custom-term-result" class="tm-custom-term-result" style="display:none;"></div>
              
              <!-- 추가된 비고시명칭 목록 -->
              ${TM.getCustomTermsHtml(p)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // 고시명칭 모드 이벤트
    container.querySelectorAll('input[name="gazettedMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        TM.currentProject.gazettedOnly = e.target.value === 'true';
        container.querySelectorAll('.tm-toggle').forEach(t => t.classList.remove('active'));
        e.target.closest('.tm-toggle').classList.add('active');
        TM.hasUnsavedChanges = true;
      });
    });
    
    // 비고시명칭 입력 이벤트
    const customInput = container.querySelector('#tm-custom-term-input');
    if (customInput) {
      // Enter 키로 추가
      customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          TM.handleAddCustomTerm();
        }
      });
      
      // 입력 중 실시간 분석 (디바운스)
      let debounceTimer;
      customInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const value = customInput.value.trim();
          if (value.length >= 3) {
            TM.previewCustomTermAnalysis(value);
          } else {
            document.getElementById('tm-custom-term-result').style.display = 'none';
          }
        }, 500);
      });
    }
    
    // ★★★ 각 상품류의 검색 자동완성 초기화 ★★★
    setTimeout(() => {
      p.designatedGoods.forEach(classData => {
        TM.initGoodsAutocomplete(classData.classCode);
      });
    }, 100);
  };
  
  // 비고시명칭 목록 HTML 생성
  TM.getCustomTermsHtml = function(p) {
    const customTerms = [];
    p.designatedGoods.forEach(classData => {
      classData.goods?.filter(g => g.isCustom).forEach(g => {
        customTerms.push({ ...g, classCode: classData.classCode });
      });
    });
    
    if (customTerms.length === 0) return '';
    
    return `
      <div class="tm-custom-terms-list">
        <div class="tm-custom-terms-header">
          <span>추가된 비고시명칭 (${customTerms.length}개)</span>
        </div>
        ${customTerms.map(term => `
          <div class="tm-custom-term-item ${term.riskLevel === 'high' ? 'high-risk' : ''}">
            <div class="tm-custom-term-main">
              <span class="class-badge-sm">제${term.classCode}류</span>
              <span class="term-name">${TM.escapeHtml(term.name)}</span>
              <span class="badge ${term.riskLevel === 'high' ? 'danger' : 'warning'}">비고시</span>
            </div>
            <div class="tm-custom-term-meta">
              <span>추정 유사군: ${term.similarGroup || '(미확인)'}</span>
              ${term.confidence ? `<span>매칭도: ${Math.round(term.confidence * 100)}%</span>` : ''}
              ${term.riskLevel === 'high' ? '<span class="risk-warn"><span class="ico" data-icon="warning"></span> 보정 가능성 높음</span>' : ''}
            </div>
            ${term.mappingCandidates?.length > 0 ? `
              <div class="tm-custom-term-alts">
                <span class="label">표준명칭 대체안:</span>
                ${term.mappingCandidates.slice(0, 2).map(c => 
                  `<span class="alt-term" data-action="tm-replace-custom-term" 
                         data-class="${term.classCode}" 
                         data-old="${TM.escapeHtml(term.name)}" 
                         data-new="${TM.escapeHtml(c.goods_name)}"
                         title="클릭하여 대체">${c.goods_name}</span>`
                ).join('')}
              </div>
            ` : ''}
            <button class="btn-icon-xs" data-action="tm-remove-custom-term" 
                    data-class="${term.classCode}" data-name="${TM.escapeHtml(term.name)}"><span class="ico" data-icon="x"></span></button>
          </div>
        `).join('')}
      </div>
    `;
    
    // AI 추천 렌더링 (3단계 구조)
    setTimeout(() => TM.renderAiRecommendations(), 0);
  };
  
  // AI 추천 상품류 렌더링 (3단계: 핵심/권장/확장)
  TM.renderAiRecommendations = function() {
    const container = document.getElementById('tm-ai-recommendations-container');
    if (!container) return;
    
    const p = TM.currentProject;
    if (!p || !p.aiAnalysis || !p.aiAnalysis.classRecommendations) {
      container.innerHTML = '';
      return;
    }
    
    const classRec = p.aiAnalysis.classRecommendations;
    const coreClasses = classRec.core || [];
    const recommendedClasses = classRec.recommended || [];
    const expansionClasses = classRec.expansion || [];
    
    // 개별 아이템 렌더링 함수
    const renderClassItem = (item, category, _emoji) => {
      const code = item.class;
      const isAdded = p.designatedGoods.some(g => g.classCode === code);
      const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
      const statusClass = category === 'core' ? 'negative' : category === 'recommended' ? 'cautionary' : 'positive';

      let goodsHtml = '';
      if (recGoods.length > 0) {
        // ★ 추천 지정상품 전체(10개) 노출 — Wanted 톤 neutral 칩
        const goodsTags = recGoods.map(g => {
          const name = g.name || g;
          const displayName = name.length > 20 ? name.slice(0, 20) + '..' : name;
          return '<span class="tag">' + TM.escapeHtml(displayName) + '</span>';
        }).join('');
        goodsHtml = '<div class="tm-ai-rec-goods">' +
          '<span class="label">추천 지정상품 (' + recGoods.length + ')</span>' +
          goodsTags + '</div>';
      }

      const actionHtml = isAdded
        ? '<span class="applied"><span class="ico" data-icon="check-circle" data-size="12"></span> 적용됨</span>'
        : '<button class="btn btn-primary btn-sm" data-action="tm-apply-recommendation" data-class-code="' + code + '"><span class="ico" data-icon="plus" data-size="12"></span> 추가</button>';

      return '<div class="tm-ai-rec-item ' + (isAdded ? 'added' : '') + '" data-category="' + category + '">' +
        '<div class="tm-ai-rec-content">' +
          '<div class="tm-ai-rec-class">' +
            '<span class="status-dot ' + statusClass + '"></span>' +
            '<strong>제' + code + '류</strong> ' + (TM.niceClasses[code] || '') +
          '</div>' +
          '<div class="tm-ai-rec-reason">' + TM.escapeHtml(item.reason || '') + '</div>' +
          goodsHtml +
        '</div>' +
        '<div class="tm-ai-rec-action">' + actionHtml + '</div>' +
      '</div>';
    };
    
    let html = '';
    
    // 핵심 류
    if (coreClasses.length > 0) {
      html += '<div class="tm-rec-section" data-cat="core">' +
        '<div class="tm-rec-section-header">' +
          '<span class="status-dot negative"></span> 핵심 (필수 등록) · ' + coreClasses.length + '개 류' +
        '</div>' +
        '<div class="tm-ai-rec-list">' +
          coreClasses.map(item => renderClassItem(item, 'core')).join('') +
        '</div>' +
      '</div>';
    }

    // 권장 류
    if (recommendedClasses.length > 0) {
      html += '<div class="tm-rec-section" data-cat="recommended">' +
        '<div class="tm-rec-section-header">' +
          '<span class="status-dot cautionary"></span> 권장 (권리 보호) · ' + recommendedClasses.length + '개 류' +
        '</div>' +
        '<div class="tm-ai-rec-list">' +
          recommendedClasses.map(item => renderClassItem(item, 'recommended')).join('') +
        '</div>' +
      '</div>';
    }

    // 확장 류 (접기/펼치기)
    if (expansionClasses.length > 0) {
      html += '<div class="tm-rec-section tm-rec-expansion" data-cat="expansion">' +
        '<div class="tm-rec-section-header tm-rec-section-toggle" data-action="tm-toggle-expansion">' +
          '<span><span class="status-dot positive"></span> 확장 (사업 확장 시 고려) · ' + expansionClasses.length + '개 류</span>' +
          '<span class="tm-expansion-toggle"><span class="ico" data-icon="chevron-down" data-size="12"></span> 펼치기</span>' +
        '</div>' +
        '<div class="tm-ai-rec-list tm-expansion-list" style="display: none;">' +
          expansionClasses.map(item => renderClassItem(item, 'expansion')).join('') +
        '</div>' +
      '</div>';
    }
    
    // 구버전 호환 (classRecommendations가 없고 recommendedClasses만 있는 경우)
    if (html === '' && p.aiAnalysis.recommendedClasses?.length > 0) {
      html = '<div class="tm-ai-rec-list" style="gap: 8px; display: flex; flex-direction: column;">';
      p.aiAnalysis.recommendedClasses.slice(0, 5).forEach((code, idx) => {
        const isAdded = p.designatedGoods.some(g => g.classCode === code);
        const reason = p.aiAnalysis.classReasons?.[code] || '';
        const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
        
        let goodsHtml = '';
        if (recGoods.length > 0) {
          // ★ 추천 지정상품 전체(10개) 노출
          const goodsTags = recGoods.map(g => {
            const name = g.name || g;
            const displayName = name.length > 20 ? name.slice(0, 20) + '..' : name;
            return '<span class="tag" style="padding: 2px 6px; background: var(--dt-brand-pale); border-radius: 3px; font-size: 11px; display: inline-block; margin: 1px 2px;">' + TM.escapeHtml(displayName) + '</span>';
          }).join('');
          goodsHtml = '<div class="tm-ai-rec-goods" style="margin-top: 6px; font-size: 11px; line-height: 1.8;">' +
            '<span class="label" style="margin-right: 4px; font-weight: 600; color: var(--dt-g600);">추천 지정상품(' + recGoods.length + '):</span>' +
            goodsTags + '</div>';
        }
        
        const actionHtml = isAdded 
          ? '<span class="applied" style="font-size: 11px;">✓적용</span>'
          : '<button class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 11px;" data-action="tm-apply-recommendation" data-class-code="' + code + '">+ 추가</button>';
        
        html += '<div class="tm-ai-rec-item ' + (isAdded ? 'added' : '') + '" style="padding: 10px; gap: 8px;">' +
          '<div class="tm-ai-rec-num" style="width: 24px; height: 24px; font-size: 12px;">' + (idx + 1) + '</div>' +
          '<div class="tm-ai-rec-content" style="flex: 1; min-width: 0;">' +
            '<div class="tm-ai-rec-class" style="font-size: 13px;">' +
              '<strong>제' + code + '류</strong> ' + (TM.niceClasses[code] || '') +
            '</div>' +
            (reason ? '<div class="tm-ai-rec-reason" style="font-size: 11px; line-height: 1.4; max-height: 36px; overflow: hidden;">' + TM.escapeHtml(reason.slice(0, 60)) + (reason.length > 60 ? '...' : '') + '</div>' : '') +
            goodsHtml +
          '</div>' +
          '<div class="tm-ai-rec-action">' + actionHtml + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    
    // 검증 결과 표시
    if (p.aiAnalysis.validation) {
      const v = p.aiAnalysis.validation;
      const scoreColor = v.overallScore >= 80 ? 'var(--dt-success)' : v.overallScore >= 60 ? 'var(--dt-warning)' : 'var(--dt-danger)';
      const scoreEmoji = v.overallScore >= 80 ? '✅' : v.overallScore >= 60 ? '⚠️' : '❌';
      const bgColor = v.overallScore >= 80 ? 'var(--dt-success-light)' : v.overallScore >= 60 ? 'var(--dt-warning-light)' : 'var(--dt-danger-light)';
      const borderColor = v.overallScore >= 80 ? 'var(--dt-success)' : v.overallScore >= 60 ? 'var(--dt-warning)' : 'var(--dt-danger)';
      
      html += '<div style="margin-top: 16px; padding: 14px; background: ' + bgColor + '; border-radius: 10px; border: 1px solid ' + borderColor + ';">';
      
      // 검증 헤더
      html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid ' + borderColor + ';">' +
        '<span style="font-weight: 700; font-size: 14px;">' + scoreEmoji + ' 3단계 검증 결과</span>' +
        '<span style="font-size: 13px; color: ' + scoreColor + '; font-weight: 700; background: white; padding: 4px 10px; border-radius: 12px;">정확도 ' + v.overallScore + '%</span>' +
      '</div>';
      
      // 요약
      if (v.summary) {
        html += '<div style="font-size: 13px; color: var(--dt-g700); margin-bottom: 12px; font-weight: 500;">' + TM.escapeHtml(v.summary) + '</div>';
      }
      
      // 제거된 류 표시
      if (v.invalidClasses?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: var(--dt-danger); margin-bottom: 6px;"><span class="ico" data-icon="x"></span> 제거된 류 (' + v.invalidClasses.length + '개)</div>';
        v.invalidClasses.forEach(c => {
          html += '<div style="font-size: 11px; color: var(--dt-danger); padding: 6px 10px; background: var(--dt-danger-light); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid var(--dt-danger);">' +
            '<strong>제' + c.class + '류</strong>: ' + TM.escapeHtml(c.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 제거된 지정상품 표시
      if (v.invalidGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: var(--dt-danger); margin-bottom: 6px;"><span class="ico" data-icon="x"></span> 제거된 지정상품 (' + v.invalidGoods.length + '개)</div>';
        v.invalidGoods.forEach(g => {
          const errorLabel = g.errorType === 'homonym' ? '🔤 동음이의어' : 
                            g.errorType === 'partial_match' ? '<span class="ico" data-icon="edit"></span> 부분매칭 오류' : '⚠️ 관련성 부족';
          html += '<div style="font-size: 11px; color: var(--dt-danger); padding: 6px 10px; background: var(--dt-danger-light); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid var(--dt-danger);">' +
            '<span style="background: var(--dt-danger-light); padding: 1px 6px; border-radius: 4px; margin-right: 6px; font-size: 10px;">' + errorLabel + '</span>' +
            '<strong>제' + g.classCode + '류</strong> "' + TM.escapeHtml(g.goodsName) + '": ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 대체 추천된 상품
      if (v.replacementGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: var(--dt-success); margin-bottom: 6px;"><span class="ico" data-icon="refresh"></span> 대체 추천 (' + v.replacementGoods.length + '개)</div>';
        v.replacementGoods.forEach(r => {
          html += '<div style="font-size: 11px; color: var(--dt-success); padding: 6px 10px; background: var(--dt-success-light); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid var(--dt-success);">' +
            '<strong>제' + r.classCode + '류</strong>: ' +
            '<span style="text-decoration: line-through; color: var(--dt-g400);">' + TM.escapeHtml(r.remove) + '</span> → ' +
            '<strong>' + TM.escapeHtml(r.addInstead) + '</strong>' +
          '</div>';
        });
        html += '</div>';
      }
      
      // 경고 사항
      if (v.warnings?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: var(--dt-warning); margin-bottom: 6px;"><span class="ico" data-icon="warning"></span> 확인 필요</div>';
        v.warnings.forEach(w => {
          html += '<div style="font-size: 11px; color: var(--dt-warning); padding: 6px 10px; background: var(--dt-warning-light); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid var(--dt-warning);">' +
            '제' + w.class + '류: ' + TM.escapeHtml(w.message) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 누락된 류 추가 제안
      if (v.suggestions?.length > 0 || v.missingClasses?.length > 0) {
        const suggestions = v.suggestions || [];
        const addClassSuggestions = suggestions.filter(s => s.type === 'add_class');
        
        if (addClassSuggestions.length > 0) {
          html += '<div style="margin-bottom: 10px;">' +
            '<div style="font-size: 11px; font-weight: 600; color: var(--dt-brand-hover); margin-bottom: 6px;"><span class="ico" data-icon="lightbulb"></span> 추가 권장 류</div>';
          addClassSuggestions.forEach(s => {
            const priorityBadge = s.priority === '핵심' ? '🔴' : s.priority === '권장' ? '🟠' : '🟢';
            const isAdded = p.designatedGoods.some(g => g.classCode === s.class);
            
            // ★ 해당 류의 추천 지정상품 표시
            const recGoods = p.aiAnalysis?.recommendedGoods?.[s.class] || [];
            let goodsLine = '';
            if (recGoods.length > 0) {
              const tags = recGoods.map(g => {
                const name = g.name || g;
                const dn = name.length > 18 ? name.slice(0, 18) + '..' : name;
                return '<span style="padding: 1px 5px; background: var(--dt-brand-light); border-radius: 3px; font-size: 10px; display: inline-block; margin: 1px 1px;">' + TM.escapeHtml(dn) + '</span>';
              }).join('');
              goodsLine = '<div style="margin-top: 4px; line-height: 1.7;">' +
                '<span style="font-size: 10px; font-weight: 600; color: var(--dt-brand);">추천 지정상품(' + recGoods.length + '):</span> ' + tags + '</div>';
            }
            
            const actionBtn = isAdded
              ? '<span style="font-size: 10px; color: var(--dt-success); white-space: nowrap;">✓적용됨</span>'
              : '<button class="btn btn-sm" style="padding: 3px 10px; font-size: 10px; background: var(--dt-brand); color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;" data-action="tm-add-class" data-class-code="' + s.class + '">+ 추가</button>';
            
            html += '<div style="font-size: 11px; color: var(--dt-brand-deep); padding: 8px 10px; background: var(--dt-brand-pale); border-radius: 6px; margin-bottom: 6px; border-left: 3px solid var(--dt-brand);">' +
              '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span>' + priorityBadge + ' <strong>제' + s.class + '류</strong>: ' + TM.escapeHtml(s.reason) + '</span>' +
                actionBtn +
              '</div>' +
              goodsLine +
            '</div>';
          });
          html += '</div>';
        }
      }
      
      // 누락된 지정상품
      if (v.missingGoods?.length > 0) {
        html += '<div>' +
          '<div style="font-size: 11px; font-weight: 600; color: var(--color-violet-50,var(--dt-grade-s)); margin-bottom: 6px;"><span class="ico" data-icon="box"></span> 추가 권장 상품</div>';
        v.missingGoods.forEach(g => {
          html += '<div style="font-size: 11px; color: var(--dt-grade-s); padding: 6px 10px; background: var(--dt-grade-s-bg); border-radius: 6px; margin-bottom: 4px; border-left: 3px solid var(--color-violet-50,var(--dt-grade-s));">' +
            '<strong>제' + g.classCode + '류</strong>: ' + TM.escapeHtml(g.goodsName) + ' - ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 재검증 버튼
      html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid ' + borderColor + '; text-align: center;">' +
        '<button class="btn btn-sm" style="padding: 6px 16px; font-size: 11px; background: white; border: 1px solid var(--dt-g300); border-radius: 6px; cursor: pointer;" data-action="tm-revalidate"><span class="ico" data-icon="refresh"></span> 다시 검증</button>' +
      '</div>';
      
      html += '</div>';
    }
    
    container.innerHTML = html;
  };
  
  // 비고시명칭 실시간 분석 미리보기
  TM.previewCustomTermAnalysis = async function(term) {
    const resultDiv = document.getElementById('tm-custom-term-result');
    const classSelect = document.getElementById('tm-custom-term-class');
    
    if (!resultDiv || !classSelect) return;
    
    const classCode = classSelect.value;
    
    resultDiv.innerHTML = '<div class="tm-loading-sm">분석 중...</div>';
    resultDiv.style.display = 'block';
    
    try {
      const analysis = await TM.processCustomTerm(term, classCode);
      
      if (analysis.error) {
        resultDiv.innerHTML = `<div class="tm-error-sm">${analysis.error}</div>`;
        return;
      }
      
      const statusClass = {
        'replace_recommended': 'status-info',
        'usable_with_warning': 'status-warning',
        'high_risk': 'status-danger',
        'very_high_risk': 'status-danger'
      }[analysis.status] || 'status-warning';
      
      resultDiv.innerHTML = `
        <div class="tm-custom-analysis ${statusClass}">
          <div class="tm-analysis-header">
            <strong>"${TM.escapeHtml(analysis.normalizedTerm)}"</strong>
            <span class="confidence">매칭도: ${Math.round(analysis.confidence * 100)}%</span>
          </div>
          
          ${analysis.estimatedSimilarGroup ? `
            <div class="tm-analysis-row">
              <span class="label">추정 유사군:</span>
              <span class="value">${analysis.estimatedSimilarGroup}</span>
            </div>
          ` : ''}
          
          ${analysis.mappingCandidates?.length > 0 ? `
            <div class="tm-analysis-row">
              <span class="label">표준명칭 대체안:</span>
              <div class="tm-alt-terms">
                ${analysis.mappingCandidates.map((c, i) => `
                  <span class="alt-option" data-term="${TM.escapeHtml(c.goods_name)}">
                    ${i + 1}. ${c.goods_name} <small>(${Math.round(c.similarity * 100)}%)</small>
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <div class="tm-analysis-recommendation">
            ${analysis.recommendation}
          </div>
          
          ${analysis.riskAnalysis?.risks?.length > 0 ? `
            <div class="tm-analysis-risks">
              ${analysis.riskAnalysis.risks.map(r => `<span class="risk-item"><span class="ico" data-icon="warning"></span> ${r}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
      
      // 대체안 클릭 시 입력란에 반영
      resultDiv.querySelectorAll('.alt-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const input = document.getElementById('tm-custom-term-input');
          if (input) {
            input.value = opt.dataset.term;
            TM.previewCustomTermAnalysis(opt.dataset.term);
          }
        });
      });
      
    } catch (err) {
      resultDiv.innerHTML = `<div class="tm-error-sm">분석 실패: ${err.message}</div>`;
    }
  };
  
  // 비고시명칭 추가 핸들러
  TM.handleAddCustomTerm = async function() {
    const input = document.getElementById('tm-custom-term-input');
    const classSelect = document.getElementById('tm-custom-term-class');
    
    if (!input || !classSelect) return;
    
    const term = input.value.trim();
    const classCode = classSelect.value;
    
    if (term.length < 2) {
      App.showToast('지정상품명을 2자 이상 입력해주세요.', 'warning');
      return;
    }
    
    try {
      App.showToast('비고시명칭 분석 중...', 'info');
      
      const analysis = await TM.processCustomTerm(term, classCode);
      
      if (analysis.error) {
        App.showToast(analysis.error, 'error');
        return;
      }
      
      // 프로젝트에 추가
      const success = await TM.addCustomTermToProject(classCode, analysis);
      
      if (success) {
        input.value = '';
        document.getElementById('tm-custom-term-result').style.display = 'none';
        
        App.showToast(`비고시명칭 "${analysis.normalizedTerm}" 추가됨 (제${classCode}류)`, 'success');
        
        // UI 새로고침
        TM.renderCurrentStep();
      }
    } catch (err) {
      App.showToast('비고시명칭 추가 실패: ' + err.message, 'error');
    }
  };
  
  // 상품류별 지정상품 카드 (개선된 버전)
  TM.renderClassGoodsCard = function(classData) {
    const similarGroups = new Set();
    classData.goods?.forEach(g => {
      if (g.similarGroup) {
        g.similarGroup.split(',').forEach(sg => similarGroups.add(sg.trim()));
      }
    });
    
    return `
      <div class="tm-goods-card" data-class="${classData.classCode}">
        <div class="tm-goods-card-header">
          <div class="tm-goods-card-title">
            <span class="class-badge">제${classData.classCode}류</span>
            <span class="class-name">${TM.niceClasses[classData.classCode] || ''}</span>
          </div>
          <button class="btn-icon-sm" data-action="tm-remove-class" data-class-code="${classData.classCode}" title="삭제"><span class="ico" data-icon="x"></span></button>
        </div>
        
        ${similarGroups.size > 0 ? `
          <div class="tm-goods-similar">
            <span class="label">유사군:</span>
            ${Array.from(similarGroups).map(sg => `<span class="sg-tag">${sg}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="tm-goods-input-area" style="position: relative;">
          <input type="text" class="tm-goods-search-input" 
                 id="tm-goods-input-${classData.classCode}"
                 placeholder="지정상품명 검색 (자동완성)"
                 data-class="${classData.classCode}"
                 autocomplete="off"
                 style="width: 100%; padding: 8px; border: 1px solid var(--dt-g200); border-radius: 4px; font-size: 13px;">
          <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"
               style="position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid var(--dt-g200); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: none;"></div>
        </div>
        
        <div class="tm-goods-chips">
          ${classData.goods.length === 0 ? 
            '<span class="tm-goods-empty">지정상품을 추가하세요</span>' : 
            classData.goods.map(g => `
              <span class="tm-goods-chip ${g.isCustom ? 'custom' : ''} ${g.riskLevel === 'high' ? 'high-risk' : ''}">
                ${TM.escapeHtml(g.name)}
                ${g.isCustom ? '<span class="chip-badge custom">비고시</span>' : ''}
                ${g.similarGroup ? `<small>(${g.similarGroup})</small>` : ''}
                <button class="remove" data-action="tm-remove-goods" data-class-code="${classData.classCode}" data-goods-name="${TM.escapeHtml(g.name)}">×</button>
              </span>
            `).join('')
          }
        </div>
      </div>
    `;
  };
  
  TM.renderClassGoods = function(classData) {
    // 유사군 코드별 그룹핑
    const groupedBySimilar = {};
    classData.goods.forEach(g => {
      const sg = g.similarGroup || '미분류';
      if (!groupedBySimilar[sg]) groupedBySimilar[sg] = [];
      groupedBySimilar[sg].push(g);
    });
    const similarGroups = Object.keys(groupedBySimilar).sort();
    
    return `
      <div class="tm-class-goods-card" data-class="${classData.classCode}">
        <div class="tm-class-goods-header">
          <div>
            <strong>제${classData.classCode}류</strong>
            <span class="tm-class-name">${TM.niceClasses[classData.classCode]}</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-action="tm-remove-class" data-class-code="${classData.classCode}">
            <span class="ico" data-icon="x"></span> 제거
          </button>
        </div>
        
        <!-- 검색 영역 -->
        <div class="tm-goods-search-area">
          <div class="tm-goods-input-row">
            <input type="text" class="tm-goods-input" 
                   id="tm-goods-input-${classData.classCode}"
                   placeholder="지정상품명 검색 (자동완성)"
                   data-class="${classData.classCode}">
            <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"></div>
          </div>
          <div class="tm-similar-search-row">
            <input type="text" class="tm-similar-input" 
                   id="tm-similar-input-${classData.classCode}"
                   placeholder="유사군 코드 (예: G5001)"
                   data-class="${classData.classCode}">
            <button class="btn btn-sm btn-secondary" 
                    data-action="tm-search-similar" 
                    data-class-code="${classData.classCode}">
              유사군 검색
            </button>
          </div>
        </div>
        
        <!-- 유사군 검색 결과 (동적) -->
        <div class="tm-similar-results" id="tm-similar-results-${classData.classCode}" style="display:none;"></div>
        
        <!-- 선택된 지정상품 (유사군별 그룹핑) -->
        <div class="tm-selected-goods">
          ${classData.goods.length === 0 ? `
            <div class="tm-hint">지정상품을 입력하거나 유사군 코드로 검색하세요.</div>
          ` : `
            ${similarGroups.map(sg => `
              <div class="tm-similar-group">
                <div class="tm-similar-group-header">
                  <span class="tm-similar-code">${sg}</span>
                  <span class="tm-similar-count">${groupedBySimilar[sg].length}개</span>
                </div>
                <div class="tm-goods-tags">
                  ${groupedBySimilar[sg].map(g => `
                    <span class="tm-goods-tag ${g.gazetted === false ? 'non-gazetted' : ''}">
                      ${TM.escapeHtml(g.name)}
                      ${g.gazetted === false ? '<span class="badge warning">비고시</span>' : ''}
                      <button class="remove-btn" data-action="tm-remove-goods" 
                              data-class-code="${classData.classCode}" 
                              data-goods-name="${TM.escapeHtml(g.name)}">×</button>
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          `}
        </div>
        
        <div class="tm-goods-count">
          ${classData.goods.length}개 선택
          ${classData.goods.length > 10 ? `<span class="warning">(10개 초과 ${classData.goods.length - 10}개 × 2,000원 추가)</span>` : ''}
        </div>
      </div>
    `;
  };
  
  TM.addClass = async function(classCode) {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    
    // 이미 선택되어 있으면 무시
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      return;
    }
    
    // ★ 이미 추천된 지정상품이 있으면 그것을 사용
    const existingGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
    
    if (existingGoods.length > 0) {
      p.designatedGoods.push({
        classCode: classCode,
        className: TM.niceClasses[classCode],
        goods: existingGoods.map(g => ({
          name: typeof g === 'string' ? g : (g.name || g),
          similarGroup: typeof g === 'string' ? '' : (g.similarGroup || ''),
          gazetted: true
        })),
        goodsCount: existingGoods.length,
        nonGazettedCount: 0
      });
      TM.hasUnsavedChanges = true;
      TM.renderCurrentStep();
      App.showToast(`제${classCode}류가 추가되었습니다. (${existingGoods.length}개 상품)`, 'success');
      return;
    }
    
    // ★ 추천 지정상품이 없으면 실시간으로 10개 추천
    try {
      App.showToast(`제${classCode}류 지정상품 추천 중...`, 'info');
      
      const paddedCode = String(classCode).padStart(2, '0');
      const allKeywords = p.aiAnalysis?.searchKeywords || [];
      const analysis = {
        businessSummary: p.aiAnalysis?.businessAnalysis || '',
        businessTypes: p.aiAnalysis?.businessTypes || [],
        coreProducts: p.aiAnalysis?.coreProducts || [],
        coreServices: p.aiAnalysis?.coreServices || [],
        salesChannels: p.aiAnalysis?.salesChannels || {},
        expansionPotential: p.aiAnalysis?.expansionPotential || [],
        searchKeywords: allKeywords
      };
      
      // ★ 개선: 원샷 방식 시도 → fallback
      const businessCtx = {
        summary: p.aiAnalysis?.businessAnalysis || '',
        coreProducts: p.aiAnalysis?.coreProducts || [],
        coreServices: p.aiAnalysis?.coreServices || [],
        salesChannels: p.aiAnalysis?.salesChannels || {},
        expansionPotential: p.aiAnalysis?.expansionPotential || [],
        searchKeywords: allKeywords
      };
      
      const selectedGoods = await TM.selectGoodsTwoStage(classCode, businessCtx);
      
      // 추천 결과 저장
      if (p.aiAnalysis) {
        if (!p.aiAnalysis.recommendedGoods) p.aiAnalysis.recommendedGoods = {};
        p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
      }
      
      p.designatedGoods.push({
        classCode: classCode,
        className: TM.niceClasses[classCode],
        goods: selectedGoods.map(g => ({
          name: typeof g === 'string' ? g : (g.name || g),
          similarGroup: typeof g === 'string' ? '' : (g.similarGroup || ''),
          gazetted: true
        })),
        goodsCount: selectedGoods.length,
        nonGazettedCount: 0
      });
      
      TM.hasUnsavedChanges = true;
      TM.renderCurrentStep();
      TM.initGoodsAutocomplete(classCode);
      App.showToast(`제${classCode}류가 추가되었습니다. (${selectedGoods.length}개 상품)`, 'success');
      
    } catch (err) {
      console.error(`[TM] addClass 제${classCode}류 지정상품 추천 실패:`, err);
      // ★ 실패해도 DB에서 10개 채우기 시도
      let fallbackGoods = [];
      try {
        fallbackGoods = await TM.ensureMinGoods(classCode, [], '');
      } catch (e) { /* ignore */ }
      
      p.designatedGoods.push({
        classCode: classCode,
        className: TM.niceClasses[classCode],
        goods: fallbackGoods.map(g => ({
          name: typeof g === 'string' ? g : (g.name || g),
          similarGroup: typeof g === 'string' ? '' : (g.similarGroup || ''),
          gazetted: true
        })),
        goodsCount: fallbackGoods.length,
        nonGazettedCount: 0
      });
      TM.hasUnsavedChanges = true;
      TM.renderCurrentStep();
      TM.initGoodsAutocomplete(classCode);
      App.showToast(`제${classCode}류가 추가되었습니다. (${fallbackGoods.length}개 상품)`, fallbackGoods.length > 0 ? 'success' : 'warning');
    }
  };
  
  TM.removeClass = function(classCode) {
    if (!TM.currentProject) return;
    
    TM.currentProject.designatedGoods = TM.currentProject.designatedGoods.filter(
      g => g.classCode !== classCode
    );
    
    TM.renderCurrentStep();
  };
  
  // 더보기 토글
  TM.toggleMoreGoods = function(classCode) {
    const hiddenDiv = document.getElementById(`tm-hidden-goods-${classCode}`);
    const btn = document.querySelector(`[data-action="tm-toggle-more-goods"][data-class-code="${classCode}"]`);
    
    if (!hiddenDiv || !btn) return;
    
    if (hiddenDiv.style.display === 'none') {
      hiddenDiv.style.display = 'block';
      btn.textContent = '접기';
    } else {
      hiddenDiv.style.display = 'none';
      const count = hiddenDiv.querySelectorAll('.tm-rec-goods-tag').length;
      btn.textContent = `+${count}개 더보기`;
    }
  };
  
  // AI 추천 적용 함수
  TM.applyRecommendation = function(classCode) {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    
    // 이미 선택되어 있으면 무시
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      App.showToast('이미 추가된 상품류입니다.', 'info');
      return;
    }
    
    // 추천 지정상품 가져오기
    const recommendedGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
    
    console.log(`[TM] applyRecommendation - 제${classCode}류, 추천상품 ${recommendedGoods.length}개:`, recommendedGoods);
    
    // 상품류 추가
    const newClass = {
      classCode: classCode,
      className: TM.niceClasses[classCode],
      goods: recommendedGoods.map(g => ({
        name: typeof g === 'string' ? g : (g.name || g),
        similarGroup: typeof g === 'string' ? '' : (g.similarGroup || ''),
        gazetted: true
      })),
      goodsCount: recommendedGoods.length,
      nonGazettedCount: 0
    };
    
    console.log(`[TM] 추가할 클래스:`, newClass);
    
    p.designatedGoods.push(newClass);
    TM.hasUnsavedChanges = true;
    
    TM.renderCurrentStep();
    App.showToast(`제${classCode}류가 추가되었습니다. (${recommendedGoods.length}개 상품)`, 'success');
  };
  
  // 전체 AI 추천 적용 (핵심 + 권장만, 확장은 제외)
  TM.applyAllRecommendations = function() {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    const classRec = p.aiAnalysis?.classRecommendations || {};
    
    // 핵심 + 권장 류만 자동 적용 (확장은 사용자 선택)
    const classesToApply = [
      ...(classRec.core || []).map(c => c.class),
      ...(classRec.recommended || []).map(c => c.class)
    ];
    
    if (classesToApply.length === 0) {
      App.showToast('추천 상품류가 없습니다.', 'warning');
      return;
    }
    
    let addedCount = 0;
    
    classesToApply.forEach(classCode => {
      if (!p.designatedGoods.some(g => g.classCode === classCode)) {
        const recommendedGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
        
        console.log(`[TM] applyAll - 제${classCode}류, 추천상품 ${recommendedGoods.length}개`);
        
        p.designatedGoods.push({
          classCode: classCode,
          className: TM.niceClasses[classCode],
          goods: recommendedGoods.map(g => ({
            name: typeof g === 'string' ? g : (g.name || g),
            similarGroup: typeof g === 'string' ? '' : (g.similarGroup || ''),
            gazetted: true
          })),
          goodsCount: recommendedGoods.length,
          nonGazettedCount: 0
        });
        
        addedCount++;
      }
    });
    
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast(`핵심+권장 ${addedCount}개 상품류가 추가되었습니다. (확장 류는 개별 추가 가능)`, 'success');
  };
  
  // 재검증 요청
  TM.revalidateRecommendations = async function() {
    const p = TM.currentProject;
    if (!p || !p.aiAnalysis) {
      App.showToast('먼저 사업 분석을 진행하세요.', 'warning');
      return;
    }
    
    const businessInput = document.getElementById('tm-business-url')?.value?.trim() || 
                          p.aiAnalysis.businessAnalysis || '';
    
    if (!businessInput) {
      App.showToast('사업 내용이 없습니다.', 'warning');
      return;
    }
    
    try {
      App.showToast('재검증 중...', 'info');
      
      const validationResult = await TM.validateRecommendationsV2(businessInput, p.aiAnalysis);
      
      if (validationResult) {
        p.aiAnalysis.validation = validationResult;
        
        if (validationResult.hasIssues) {
          await TM.applyValidationResult(p.aiAnalysis, validationResult);
          App.showToast('검증 완료: 문제 항목이 수정되었습니다.', 'success');
        } else {
          App.showToast('검증 완료: 모든 추천이 적합합니다.', 'success');
        }
        
        TM.renderCurrentStep();
      }
      
    } catch (error) {
      console.error('[TM] 재검증 실패:', error);
      App.showToast('재검증 실패: ' + error.message, 'error');
    }
  };
  
  // 검증에서 제안된 류 추가
  TM.addSuggestedClass = async function(classCode) {
    const p = TM.currentProject;
    if (!p) return;
    
    // 이미 추가된 경우
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      App.showToast(`제${classCode}류는 이미 추가되어 있습니다.`, 'warning');
      return;
    }
    
    try {
      App.showToast(`제${classCode}류 지정상품 조회 중...`, 'info');
      
      // DB에서 해당 류의 인기 상품 조회
      const businessInput = document.getElementById('tm-business-url')?.value?.trim() || 
                            p.aiAnalysis?.businessAnalysis || '';
      
      const keywords = TM.extractKeywordsFromInput(businessInput);
      
      // 키워드로 관련 상품 검색
      let recommendedGoods = [];
      
      for (const keyword of keywords.slice(0, 5)) {
        try {
          const { data } = await App.sb
            .from('gazetted_goods_cache')
            .select('goods_name, similar_group_code')
            .eq('class_code', String(classCode).padStart(2, '0'))
            .ilike('goods_name', `%${keyword}%`)
            .limit(5);
          
          if (data) {
            data.forEach(item => {
              if (!recommendedGoods.some(g => g.name === item.goods_name)) {
                recommendedGoods.push({
                  name: item.goods_name,
                  similarGroup: item.similar_group_code
                });
              }
            });
          }
        } catch (e) {
          // 무시
        }
      }
      
      // 부족하면 해당 류에서 기본 상품 조회
      if (recommendedGoods.length < 5) {
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', String(classCode).padStart(2, '0'))
          .limit(10);
        
        if (data) {
          data.forEach(item => {
            if (recommendedGoods.length < 10 && !recommendedGoods.some(g => g.name === item.goods_name)) {
              recommendedGoods.push({
                name: item.goods_name,
                similarGroup: item.similar_group_code
              });
            }
          });
        }
      }
      
      // 추가
      p.designatedGoods.push({
        classCode: classCode,
        className: TM.niceClasses[classCode],
        goods: recommendedGoods.map(g => ({
          name: g.name,
          similarGroup: g.similarGroup,
          gazetted: true
        })),
        goodsCount: recommendedGoods.length,
        nonGazettedCount: 0
      });
      
      // classRecommendations에도 추가 (권장 류로)
      if (!p.aiAnalysis) p.aiAnalysis = {};
      if (!p.aiAnalysis.classRecommendations) p.aiAnalysis.classRecommendations = { core: [], recommended: [], expansion: [] };
      if (!p.aiAnalysis.recommendedClasses) p.aiAnalysis.recommendedClasses = [];
      if (!p.aiAnalysis.recommendedGoods) p.aiAnalysis.recommendedGoods = {};
      
      p.aiAnalysis.recommendedClasses.push(classCode);
      p.aiAnalysis.classRecommendations.recommended.push({
        class: classCode,
        reason: '검증에서 추가 권장됨',
        priority: 99
      });
      p.aiAnalysis.recommendedGoods[classCode] = recommendedGoods;
      
      TM.renderCurrentStep();
      App.showToast(`제${classCode}류가 추가되었습니다. (${recommendedGoods.length}개 상품)`, 'success');
      
    } catch (error) {
      console.error('[TM] 류 추가 실패:', error);
      App.showToast('추가 실패: ' + error.message, 'error');
    }
  };
  
  // 확장 류 접기/펼치기
  TM.toggleExpansionClasses = function(target) {
    const section = target.closest('.tm-rec-expansion');
    if (!section) return;
    
    const list = section.querySelector('.tm-expansion-list');
    const toggle = section.querySelector('.tm-expansion-toggle');
    
    if (list && toggle) {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? 'flex' : 'none';
      list.style.flexDirection = 'column';
      toggle.textContent = isHidden ? '▲ 접기' : '▼ 펼치기';
    }
  };
  
  // 추가 추천 요청
  TM.requestMoreRecommendations = async function() {
    const p = TM.currentProject;
    if (!p || !p.aiAnalysis) {
      App.showToast('먼저 사업 분석을 진행하세요.', 'warning');
      return;
    }
    
    const existingClasses = p.aiAnalysis.recommendedClasses || [];
    const businessInput = document.getElementById('tm-business-url')?.value?.trim() || '';
    
    try {
      App.showToast('추가 추천을 분석 중...', 'info');
      
      const additionalPrompt = `당신은 상표 출원 전문 변리사입니다.

【고객 정보】
- 상표명: ${p.trademarkName || '미정'}
- 사업 내용: ${businessInput || p.aiAnalysis.businessAnalysis}
- 이미 추천된 류: ${existingClasses.join(', ')}류

【요청】
이미 추천된 류 외에, 추가로 고려할 만한 상품류를 찾아주세요.
- 방어적 등록 관점
- 경쟁사가 일반적으로 등록하는 류
- 브랜드 확장 시 자주 사용되는 류
- 유사 업종에서 분쟁이 많은 류

【응답 형식 - JSON만】
{
  "additionalClasses": [
    {"class": "14", "reason": "액세서리 확장 - 패션 브랜드 방어적 등록", "priority": 1},
    {"class": "26", "reason": "장식품 - 의류 관련 부자재 보호", "priority": 2}
  ]
}`;

      const response = await App.callClaudeSonnet(additionalPrompt, 2000);
      const text = response.text || '';
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('응답 파싱 실패');
      }
      
      const jsonStr = text.substring(startIdx, endIdx + 1)
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1');
      
      const result = JSON.parse(jsonStr);
      const additionalClasses = result.additionalClasses || [];
      
      if (additionalClasses.length === 0) {
        App.showToast('추가 추천할 상품류가 없습니다.', 'info');
        return;
      }
      
      // 기존 확장 류에 추가
      if (!p.aiAnalysis.classRecommendations) {
        p.aiAnalysis.classRecommendations = { core: [], recommended: [], expansion: [] };
      }
      
      const existingExpansion = p.aiAnalysis.classRecommendations.expansion || [];
      const existingAllCodes = existingClasses;
      
      additionalClasses.forEach(item => {
        if (!existingAllCodes.includes(item.class)) {
          existingExpansion.push(item);
          p.aiAnalysis.recommendedClasses.push(item.class);
          p.aiAnalysis.classReasons[item.class] = `<span class="status-dot positive"></span> 추가 확장: ${item.reason}`;
        }
      });
      
      p.aiAnalysis.classRecommendations.expansion = existingExpansion;
      
      // ★★★ 추가된 류에 대해 지정상품 10개 자동 추천 ★★★
      const newClassCodes = additionalClasses
        .filter(item => !existingAllCodes.includes(item.class))
        .map(item => item.class);
      
      if (newClassCodes.length > 0) {
        const allKeywords = p.aiAnalysis.searchKeywords || [];
        const analysis = {
          businessSummary: p.aiAnalysis.businessAnalysis,
          businessTypes: p.aiAnalysis.businessTypes,
          coreProducts: p.aiAnalysis.coreProducts,
          coreServices: p.aiAnalysis.coreServices,
          salesChannels: p.aiAnalysis.salesChannels,
          expansionPotential: p.aiAnalysis.expansionPotential,
          searchKeywords: allKeywords
        };
        
        for (const classCode of newClassCodes) {
          const paddedCode = String(classCode).padStart(2, '0');
          try {
            App.showToast(`제${classCode}류 지정상품 추천 중...`, 'info');
            
            // DB에서 고시명칭 후보 조회
            // ★ 개선: 원샷 방식 시도 → fallback
            const businessCtx2 = {
              summary: businessInput || p.aiAnalysis.businessAnalysis || '',
              coreProducts: p.aiAnalysis.coreProducts || [],
              coreServices: p.aiAnalysis.coreServices || [],
              salesChannels: p.aiAnalysis.salesChannels || {},
              expansionPotential: p.aiAnalysis.expansionPotential || [],
              searchKeywords: allKeywords
            };
            
            let selectedGoods = await TM.selectGoodsTwoStage(classCode, businessCtx2);
            p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
            console.log(`[TM] 추가 추천 제${classCode}류 최종: ${selectedGoods.length}건`);
            
          } catch (classError) {
            console.error(`[TM] 추가 추천 제${classCode}류 처리 실패:`, classError);
            // ★ 에러 시에도 보충 시도
            try {
              p.aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(classCode, [], '');
            } catch (e) {
              p.aiAnalysis.recommendedGoods[classCode] = [];
            }
          }
        }
      }
      
      TM.renderCurrentStep();
      const goodsCountMsg = newClassCodes.length > 0 
        ? ` (각 류당 지정상품 ${newClassCodes.map(c => (p.aiAnalysis.recommendedGoods?.[c]?.length || 0) + '개').join(', ')} 추천)`
        : '';
      App.showToast(`${additionalClasses.length}개 추가 류가 확장 목록에 추가되었습니다.${goodsCountMsg}`, 'success');
      
    } catch (err) {
      console.error('[TM] 추가 추천 요청 실패:', err);
      App.showToast('추가 추천 요청에 실패했습니다.', 'error');
    }
  };
  
  // 지정상품 복사 (콤마로 연결, 유사군코드 제외)
  TM.copyDesignatedGoods = function() {
    const p = TM.currentProject;
    if (!p || p.designatedGoods.length === 0) {
      App.showToast('복사할 지정상품이 없습니다.', 'warning');
      return;
    }
    
    // 류별로 상품명 수집
    const goodsByClass = {};
    p.designatedGoods.forEach(classData => {
      const classCode = classData.classCode;
      const goodsNames = (classData.goods || []).map(g => g.name);
      if (goodsNames.length > 0) {
        goodsByClass[classCode] = goodsNames;
      }
    });
    
    // 포맷 선택 (류별 구분 vs 전체 합치기)
    const classKeys = Object.keys(goodsByClass).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (classKeys.length === 0) {
      App.showToast('복사할 지정상품이 없습니다.', 'warning');
      return;
    }
    
    // 류별로 구분하여 복사
    const formattedText = classKeys.map(classCode => {
      const goods = goodsByClass[classCode];
      return `【제${classCode}류】 ${goods.join(', ')}`;
    }).join('\n\n');
    
    // 클립보드에 복사
    navigator.clipboard.writeText(formattedText).then(() => {
      App.showToast(`${classKeys.length}개 류, ${Object.values(goodsByClass).flat().length}개 상품이 복사되었습니다.`, 'success');
    }).catch(err => {
      console.error('[TM] 복사 실패:', err);
      // 폴백: textarea 사용
      const textarea = document.createElement('textarea');
      textarea.value = formattedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      App.showToast(`${classKeys.length}개 류 지정상품이 복사되었습니다.`, 'success');
    });
  };
  
  // 유사군 코드로 지정상품 검색
  TM.searchBySimilarGroup = async function(classCode) {
    const input = document.getElementById(`tm-similar-input-${classCode}`);
    const resultsDiv = document.getElementById(`tm-similar-results-${classCode}`);
    
    if (!input || !resultsDiv) return;
    
    const similarCode = input.value.trim().toUpperCase();
    
    if (!similarCode) {
      App.showToast('유사군 코드를 입력하세요. (예: G5001)', 'warning');
      return;
    }
    
    try {
      // DB에서 유사군 코드로 검색
      const { data, error } = await App.sb
        .from('gazetted_goods_cache')
        .select('goods_name, similar_group_code')
        .eq('class_code', String(classCode).padStart(2, '0'))
        .ilike('similar_group_code', `%${similarCode}%`)
        .limit(50);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        resultsDiv.innerHTML = `
          <div class="tm-similar-no-result">
            유사군 코드 "${similarCode}"에 해당하는 지정상품이 없습니다.
          </div>
        `;
        resultsDiv.style.display = 'block';
        return;
      }
      
      // 이미 선택된 상품 필터링
      const classItem = TM.currentProject?.designatedGoods.find(g => g.classCode === classCode);
      const existingNames = new Set(classItem?.goods.map(g => g.name) || []);
      
      resultsDiv.innerHTML = `
        <div class="tm-similar-result-header">
          <span>유사군 "${similarCode}" 검색 결과: ${data.length}건</span>
          <button class="btn btn-xs btn-ghost" onclick="document.getElementById('tm-similar-results-${classCode}').style.display='none'">닫기</button>
        </div>
        <div class="tm-similar-result-list">
          ${data.map(g => {
            const isAdded = existingNames.has(g.goods_name);
            return `
              <div class="tm-similar-result-item ${isAdded ? 'added' : ''}">
                <span class="tm-similar-item-name">${TM.escapeHtml(g.goods_name)}</span>
                <span class="tm-similar-item-code">${g.similar_group_code}</span>
                ${isAdded ? `
                  <span class="tm-similar-added-badge">추가됨</span>
                ` : `
                  <button class="btn btn-xs btn-primary" 
                          data-action="tm-add-from-similar" 
                          data-class-code="${classCode}"
                          data-goods-name="${TM.escapeHtml(g.goods_name)}"
                          data-similar-group="${g.similar_group_code}">
                    + 추가
                  </button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      `;
      resultsDiv.style.display = 'block';
      
    } catch (error) {
      console.error('[TM] 유사군 검색 실패:', error);
      App.showToast('검색 실패: ' + error.message, 'error');
    }
  };
  
  // 유사군 검색 결과에서 지정상품 추가
  TM.addGoodsFromSimilar = function(classCode, goodsName, similarGroup) {
    if (!TM.currentProject) return;
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) {
      App.showToast('먼저 상품류를 선택하세요.', 'warning');
      return;
    }
    
    // 중복 체크
    if (classItem.goods.some(g => g.name === goodsName)) {
      App.showToast('이미 추가된 지정상품입니다.', 'info');
      return;
    }
    
    classItem.goods.push({
      name: goodsName,
      similarGroup: similarGroup,
      gazetted: true
    });
    classItem.goodsCount = classItem.goods.length;
    
    // 검색 결과 UI 업데이트 (추가됨 표시)
    TM.renderCurrentStep();
    App.showToast(`"${goodsName}" 추가됨`, 'success');
  };
  
  TM.addGoods = function(classCode, goodsData) {
    if (!TM.currentProject) return;
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) return;
    
    // 중복 체크
    if (classItem.goods.some(g => g.name === goodsData.name)) {
      App.showToast('이미 추가된 지정상품입니다.', 'warning');
      return;
    }
    
    classItem.goods.push(goodsData);
    classItem.goodsCount = classItem.goods.length;
    classItem.nonGazettedCount = classItem.goods.filter(g => !g.gazetted).length;
    
    TM.renderCurrentStep();
    TM.initGoodsAutocomplete(classCode);
  };
  
  TM.removeGoods = function(classCode, goodsName) {
    console.log('[TM] removeGoods 호출:', classCode, goodsName);
    
    if (!TM.currentProject) {
      console.log('[TM] removeGoods: currentProject 없음');
      return;
    }
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) {
      console.log('[TM] removeGoods: classItem 없음', classCode);
      return;
    }
    
    const beforeCount = classItem.goods.length;
    classItem.goods = classItem.goods.filter(g => g.name !== goodsName);
    const afterCount = classItem.goods.length;
    
    console.log('[TM] removeGoods: 삭제 결과', beforeCount, '->', afterCount);
    
    classItem.goodsCount = classItem.goods.length;
    classItem.nonGazettedCount = classItem.goods.filter(g => !g.gazetted).length;
    
    TM.renderCurrentStep();
    App.showToast(`"${goodsName}" 삭제됨`, 'info');
  };
  
  TM.initGoodsAutocomplete = function(classCode) {
    console.log('[TM] initGoodsAutocomplete 호출:', classCode);
    
    const input = document.getElementById(`tm-goods-input-${classCode}`);
    const autocomplete = document.getElementById(`tm-autocomplete-${classCode}`);
    
    if (!input || !autocomplete) {
      console.log('[TM] initGoodsAutocomplete: 요소를 찾을 수 없음', {
        input: !!input,
        autocomplete: !!autocomplete,
        inputId: `tm-goods-input-${classCode}`,
        autocompleteId: `tm-autocomplete-${classCode}`
      });
      return;
    }
    
    console.log('[TM] initGoodsAutocomplete: 요소 찾음, 이벤트 연결');
    
    const searchGoods = TM.debounce(async (query) => {
      console.log('[TM] searchGoods 호출:', query);
      
      if (query.length < 2) {
        autocomplete.style.display = 'none';
        return;
      }
      
      // DB에서 직접 검색 (캐시 사용 안함)
      let results = [];
      try {
        const { data, error } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, goods_name_en, similar_group_code')
          .eq('class_code', String(classCode).padStart(2, '0'))
          .ilike('goods_name', `%${query}%`)
          .limit(10);
        
        if (!error && data) {
          results = data;
        }
      } catch (e) {
        console.warn('[TM] 지정상품 검색 실패:', e);
      }
      
      if (results.length === 0) {
        // 비고시명칭 허용 모드면 직접 입력 옵션 표시
        if (!TM.currentProject.gazettedOnly) {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" data-name="${TM.escapeHtml(query)}" data-gazetted="false"
                 style="padding: 8px 12px; cursor: pointer;"
                 onmouseover="this.style.backgroundColor='var(--dt-g100)'" 
                 onmouseout="this.style.backgroundColor='white'">
              <div class="goods-name" style="font-weight: 500;">"${TM.escapeHtml(query)}" 직접 입력</div>
              <div class="goods-meta" style="font-size: 11px; color: var(--dt-g400);">비고시명칭 (52,000원/류 적용)</div>
            </div>
          `;
          autocomplete.style.display = 'block';
        } else {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" style="padding: 8px 12px; color: var(--dt-g400);">
              검색 결과가 없습니다. (고시명칭 모드)
            </div>
          `;
          autocomplete.style.display = 'block';
        }
        return;
      }
      
      autocomplete.innerHTML = results.map(r => `
        <div class="tm-goods-autocomplete-item" 
             data-name="${TM.escapeHtml(r.goods_name)}" 
             data-name-en="${TM.escapeHtml(r.goods_name_en || '')}"
             data-similar-group="${r.similar_group_code || ''}"
             data-gazetted="true"
             style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--dt-g100);"
             onmouseover="this.style.backgroundColor='var(--dt-g100)'" 
             onmouseout="this.style.backgroundColor='white'">
          <div class="goods-name" style="font-weight: 500;">${TM.escapeHtml(r.goods_name)}</div>
          <div class="goods-meta" style="font-size: 11px; color: var(--dt-g400);">${r.goods_name_en || ''} · ${r.similar_group_code || ''}</div>
        </div>
      `).join('');
      
      autocomplete.style.display = 'block';
    }, 300);
    
    input.addEventListener('input', (e) => searchGoods(e.target.value));
    
    input.addEventListener('blur', () => {
      setTimeout(() => { autocomplete.style.display = 'none'; }, 200);
    });
    
    autocomplete.addEventListener('click', (e) => {
      const item = e.target.closest('.tm-goods-autocomplete-item');
      if (!item || !item.dataset.name) return;
      
      TM.addGoods(classCode, {
        name: item.dataset.name,
        nameEn: item.dataset.nameEn || '',
        gazetted: item.dataset.gazetted === 'true',
        similarGroup: item.dataset.similarGroup || ''
      });
      
      input.value = '';
      autocomplete.style.display = 'none';
    });
    
    // Enter 키로 직접 입력 (비고시 모드)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim() && !TM.currentProject.gazettedOnly) {
        TM.addGoods(classCode, {
          name: input.value.trim(),
          nameEn: '',
          gazetted: false,
          similarGroup: ''
        });
        input.value = '';
        autocomplete.style.display = 'none';
      }
    });
  };

  // ============================================================
  // Step 3: 선행상표 검색
  // ============================================================
  
  TM.renderStep3_PriorSearch = function(container) {
    const p = TM.currentProject;
    
    // 선택된 유사군 코드 수집
    const selectedSimilarGroups = new Set();
    const selectedClasses = new Set();
    p.designatedGoods?.forEach(classData => {
      selectedClasses.add(classData.classCode);
      classData.goods?.forEach(g => {
        if (g.similarGroup) {
          g.similarGroup.split(',').forEach(sg => selectedSimilarGroups.add(sg.trim()));
        }
      });
    });
    const similarGroupList = Array.from(selectedSimilarGroups).sort();
    const classList = Array.from(selectedClasses).sort((a,b) => parseInt(a) - parseInt(b));
    
    // 검색 통계
    const stats = p.searchResults.stats || {};
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3><span class="ico" data-icon="search"></span> 선행상표 검색</h3>
        <p>출원 전 유사 상표가 있는지 검색합니다. <strong>2-Stage AI 검색 엔진</strong>이 문자+도형을 병렬 분석합니다.</p>
      </div>
      
      <!-- 선택된 지정상품 요약 -->
      ${classList.length > 0 ? `
        <div class="tm-selected-summary">
          <div class="tm-summary-header">
            <span class="tm-summary-title"><span class="ico" data-icon="box"></span> 선택된 지정상품</span>
            <span class="tm-summary-count">${classList.length}개 류, ${similarGroupList.length}개 유사군</span>
          </div>
          <div class="tm-summary-classes">
            ${classList.map(c => `<span class="tm-class-badge">제${c}류</span>`).join('')}
          </div>
          <div class="tm-summary-similar-groups">
            <span class="tm-similar-label">유사군:</span>
            ${similarGroupList.slice(0, 10).map(sg => `<span class="tm-similar-badge">${sg}</span>`).join('')}
            ${similarGroupList.length > 10 ? `<span class="tm-similar-more">+${similarGroupList.length - 10}개</span>` : ''}
          </div>
        </div>
      ` : `
        <div class="tm-warning-box">
          <span class="ico" data-icon="warning"></span> 지정상품을 먼저 선택해주세요. 유사군 코드 기반 검색이 더 정확합니다.
        </div>
      `}
      
      <!-- 검색 컨트롤 -->
      <div class="tm-search-section">
        <div class="tm-search-controls">
          <div class="tm-search-type-toggle">
            <button class="active" data-search-type="text" onclick="TM.setSearchType('text', this)">문자 검색</button>
            <button data-search-type="figure" onclick="TM.setSearchType('figure', this)">도형 검색</button>
          </div>
        </div>
        
        <!-- 문자 검색 옵션 -->
        <div class="tm-search-options" id="tm-search-options-text">
          <div class="tm-search-form">
            <!-- 1행: 상표명 + 상태 필터 -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 2;">
                <label>상표명</label>
                <input type="text" class="tm-input" id="tm-search-keyword" 
                       value="${TM.escapeHtml(p.trademarkName)}" 
                       placeholder="검색할 상표명 입력">
              </div>
              <div class="input-group" style="flex: 1;">
                <label>상태 필터</label>
                <select class="tm-input" id="tm-search-status">
                  <option value="all">전체</option>
                  <option value="registered" selected>등록/출원</option>
                  <option value="registered_only">등록만</option>
                </select>
              </div>
            </div>
            
            <!-- 2행: 상품류 필터 -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 1;">
                <label>상품류 필터</label>
                <div class="tm-class-filter">
                  <select class="tm-input" id="tm-search-class-mode" onchange="TM.toggleClassFilter(this.value)">
                    <option value="all">전체 상품류</option>
                    ${classList.length > 0 ? `<option value="selected" selected>선택한 류만</option>` : ''}
                    <option value="custom">직접 선택</option>
                  </select>
                </div>
              </div>
              <div class="input-group tm-custom-class-input" id="tm-custom-class-group" style="flex: 1; ${classList.length > 0 ? 'display: none;' : ''}">
                <label>상품류 직접 입력</label>
                <input type="text" class="tm-input" id="tm-search-class-custom" 
                       placeholder="예: 09, 35, 42 (쉼표로 구분)">
              </div>
            </div>
            
            <!-- 3행: 유사군코드 필터 -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 1;">
                <label>유사군코드 필터 (선택)</label>
                <div class="tm-similarity-filter">
                  <select class="tm-input" id="tm-search-similarity-mode" onchange="TM.toggleSimilarityFilter(this.value)">
                    <option value="none">사용 안 함</option>
                    ${similarGroupList.length > 0 ? `<option value="selected">선택한 유사군만 (${similarGroupList.length}개)</option>` : ''}
                    <option value="custom">직접 입력</option>
                  </select>
                </div>
              </div>
              <div class="input-group tm-custom-similarity-input" id="tm-custom-similarity-group" style="flex: 1; display: none;">
                <label>유사군코드 직접 입력</label>
                <input type="text" class="tm-input" id="tm-search-similarity-custom" 
                       placeholder="예: G390101, S120401 (쉼표로 구분)">
              </div>
            </div>
            
            <!-- 선택된 필터 미리보기 -->
            <div class="tm-filter-preview" id="tm-filter-preview">
              ${classList.length > 0 ? `
                <div class="tm-preview-section">
                  <span class="tm-preview-label"><span class="ico" data-icon="box"></span> 상품류:</span>
                  <span class="tm-preview-values" id="tm-preview-classes">${classList.map(c => '제'+c+'류').join(', ')}</span>
                </div>
              ` : ''}
              ${similarGroupList.length > 0 ? `
                <div class="tm-preview-section">
                  <span class="tm-preview-label"><span class="ico" data-icon="tag"></span> 유사군:</span>
                  <span class="tm-preview-values" id="tm-preview-similarities">
                    ${similarGroupList.slice(0, 5).join(', ')}${similarGroupList.length > 5 ? ` 외 ${similarGroupList.length - 5}개` : ''}
                  </span>
                </div>
              ` : ''}
            </div>
            
            <div class="tm-search-actions">
              <button class="btn btn-primary btn-lg" data-action="tm-search-text">
                <span class="ico" data-icon="search"></span> 상표 검색
              </button>
            </div>
            
            <!-- 검색 진행 상태 -->
            <div class="tm-search-progress" id="tm-search-progress" style="display: none;">
              <div class="tm-progress-track">
                <div class="tm-progress-fill" id="tm-search-progress-fill" style="width: 0%"></div>
              </div>
              <div class="tm-progress-text" id="tm-search-progress-text">준비 중...</div>
            </div>
          </div>
        </div>
        
        <!-- 도형 검색 옵션 -->
        <div class="tm-search-options" id="tm-search-options-figure" style="display: none;">
          <div class="tm-vienna-section">
            <h4>비엔나 도형 분류 코드</h4>
            <p class="tm-hint">상표 이미지를 분석하여 비엔나 코드를 추천받으세요.</p>
            <button class="btn btn-secondary" data-action="tm-analyze-vienna">
              <span class="ico" data-icon="robot"></span> AI 비엔나 코드 분석
            </button>
            ${p.aiAnalysis.viennaCodeSuggestion && p.aiAnalysis.viennaCodeSuggestion.length > 0 ? `
              <div class="tm-vienna-suggestions">
                <strong>추천 코드:</strong>
                ${p.aiAnalysis.viennaCodeSuggestion.map(v => `
                  <span class="tm-vienna-badge">${v.code}: ${v.description}</span>
                `).join('')}
              </div>
            ` : ''}
            <div class="input-group" style="margin-top: 12px;">
              <label>비엔나 코드 직접 입력</label>
              <input type="text" class="tm-input" id="tm-vienna-code" 
                     placeholder="예: 03.01.01">
            </div>
            <div class="tm-search-actions">
              <button class="btn btn-primary" data-action="tm-search-figure">
                <span class="ico" data-icon="search"></span> 도형 검색
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 검색 결과 -->
      <div class="tm-search-results-section">
        <div class="tm-search-results-header">
          <h4>검색 결과</h4>
          ${p.searchResults.searchedAt ? `
            <span class="tm-search-time">
              ${new Date(p.searchResults.searchedAt).toLocaleString('ko-KR')} 검색
            </span>
          ` : ''}
        </div>
        
        <div class="tm-search-results" id="tm-search-results">
          ${TM.renderSearchResults(p.searchResults)}
        </div>
      </div>
    `;
  };
  
  TM.setSearchType = function(type, btn) {
    document.querySelectorAll('.tm-search-type-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById('tm-search-options-text').style.display = type === 'text' ? 'block' : 'none';
    document.getElementById('tm-search-options-figure').style.display = type === 'figure' ? 'block' : 'none';
    
    // 버튼 액션 변경
    const searchBtn = document.querySelector('[data-action^="tm-search-"]');
    if (searchBtn) {
      searchBtn.dataset.action = type === 'text' ? 'tm-search-text' : 'tm-search-figure';
    }
  };
  
  // 상품류 필터 토글
  TM.toggleClassFilter = function(mode) {
    const customGroup = document.getElementById('tm-custom-class-group');
    const previewClasses = document.getElementById('tm-preview-classes');
    
    if (mode === 'custom') {
      if (customGroup) customGroup.style.display = 'block';
      if (previewClasses) previewClasses.textContent = '직접 입력';
    } else if (mode === 'all') {
      if (customGroup) customGroup.style.display = 'none';
      if (previewClasses) previewClasses.textContent = '전체';
    } else {
      if (customGroup) customGroup.style.display = 'none';
      // 선택된 상품류 표시
      const p = TM.currentProject;
      if (p && previewClasses) {
        const classes = (p.designatedGoods || []).map(g => '제' + g.classCode + '류');
        previewClasses.textContent = classes.join(', ') || '없음';
      }
    }
  };
  
  // 유사군코드 필터 토글
  TM.toggleSimilarityFilter = function(mode) {
    const customGroup = document.getElementById('tm-custom-similarity-group');
    const previewSimilarities = document.getElementById('tm-preview-similarities');
    
    if (mode === 'custom') {
      if (customGroup) customGroup.style.display = 'block';
      if (previewSimilarities) previewSimilarities.textContent = '직접 입력';
    } else if (mode === 'none') {
      if (customGroup) customGroup.style.display = 'none';
      if (previewSimilarities) previewSimilarities.textContent = '사용 안 함';
    } else {
      if (customGroup) customGroup.style.display = 'none';
      // 선택된 유사군 표시
      const p = TM.currentProject;
      if (p && previewSimilarities) {
        const groups = [];
        (p.designatedGoods || []).forEach(classData => {
          (classData.goods || []).forEach(g => {
            if (g.similarGroup) {
              g.similarGroup.split(',').forEach(sg => {
                const trimmed = sg.trim();
                if (trimmed && !groups.includes(trimmed)) groups.push(trimmed);
              });
            }
          });
        });
        previewSimilarities.textContent = groups.slice(0, 5).join(', ') + (groups.length > 5 ? ` 외 ${groups.length - 5}개` : '') || '없음';
      }
    }
  };
  
  // 현재 선택된 필터 값 가져오기
  TM.getSearchFilters = function() {
    const p = TM.currentProject;
    
    // 상품류 필터
    const classMode = document.getElementById('tm-search-class-mode')?.value || 'all';
    let targetClasses = [];
    
    if (classMode === 'selected') {
      targetClasses = (p.designatedGoods || []).map(g => g.classCode);
    } else if (classMode === 'custom') {
      const customInput = document.getElementById('tm-search-class-custom')?.value || '';
      targetClasses = customInput.split(',').map(c => c.trim().replace(/[^0-9]/g, '')).filter(c => c);
    }
    
    // 유사군코드 필터
    const similarityMode = document.getElementById('tm-search-similarity-mode')?.value || 'none';
    let targetGroups = [];
    
    if (similarityMode === 'selected') {
      (p.designatedGoods || []).forEach(classData => {
        (classData.goods || []).forEach(g => {
          if (g.similarGroup) {
            g.similarGroup.split(',').forEach(sg => {
              const trimmed = sg.trim();
              if (trimmed && !targetGroups.includes(trimmed)) targetGroups.push(trimmed);
            });
          }
        });
      });
    } else if (similarityMode === 'custom') {
      const customInput = document.getElementById('tm-search-similarity-custom')?.value || '';
      targetGroups = customInput.split(',').map(sg => sg.trim()).filter(sg => sg);
    }
    
    return { targetClasses, targetGroups, classMode, similarityMode };
  };
  
  TM.renderSearchResults = function(results) {
    const textResults = results.text || [];
    const figureResults = results.figure || [];
    const allResults = [...textResults, ...figureResults];
    
    if (allResults.length === 0) {
      return `
        <div class="tm-empty-state" style="padding: 40px;">
          <div class="icon"><span class="ico" data-icon="search"></span></div>
          <h4>검색 결과가 없습니다</h4>
          <p>검색을 실행하세요.</p>
        </div>
      `;
    }
    
    // ★ 유사군 기반 통계
    const groupOverlapCount = allResults.filter(r => r.hasGroupOverlap).length;
    const noOverlapCount = allResults.filter(r => !r.hasGroupOverlap).length;
    const highRiskCount = allResults.filter(r => r.isHighRisk || r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    const mediumRiskCount = allResults.filter(r => r.riskLevel === 'medium').length;
    
    return `
      <!-- 검색 결과 요약 (유사군 기준) -->
      <div class="tm-search-summary">
        <div class="tm-summary-stat">
          <span class="tm-stat-num">${allResults.length}</span>
          <span class="tm-stat-label">총 결과</span>
        </div>
        <div class="tm-summary-stat risk-overlap">
          <span class="tm-stat-num">${groupOverlapCount}</span>
          <span class="tm-stat-label"><span class="ico" data-icon="warning"></span> 유사군 중복</span>
        </div>
        <div class="tm-summary-stat risk-safe">
          <span class="tm-stat-num">${noOverlapCount}</span>
          <span class="tm-stat-label"><span class="ico" data-icon="check-circle"></span> 등록가능</span>
        </div>
        ${highRiskCount > 0 ? `
          <div class="tm-summary-stat risk-high">
            <span class="tm-stat-num">${highRiskCount}</span>
            <span class="tm-stat-label">⛔ 고위험</span>
          </div>
        ` : ''}
      </div>
      
      <!-- 유사군 중복 여부 설명 -->
      <div class="tm-overlap-explanation">
        <span class="tm-explanation-icon"><span class="ico" data-icon="lightbulb"></span></span>
        <span class="tm-explanation-text">
          <strong>유사군 비중복 = 등록 가능:</strong> 상표명이 동일하더라도 유사군이 다르면 심사 시 충돌하지 않습니다.
        </span>
      </div>
      
      <!-- 결과 목록 -->
      <div class="tm-results-list">
        ${allResults.map((r, idx) => TM.renderSearchResultItem(r, idx + 1)).join('')}
      </div>
    `;
  };
  
  // 개별 검색 결과 아이템 렌더링 (유사군 중심)
  TM.renderSearchResultItem = function(r, rank) {
    const score = r.similarityScore || 0;
    const hasGroupOverlap = r.hasGroupOverlap;
    
    // ★ 유사군 기반 리스크 클래스 결정
    let riskClass = 'risk-safe';
    let riskBadge = '등록가능';
    let riskIcon = '✅';
    
    if (hasGroupOverlap) {
      const riskLevel = r.riskLevel || 'medium';
      if (riskLevel === 'critical' || riskLevel === 'high') {
        riskClass = 'risk-high';
        riskBadge = '고위험';
        riskIcon = '⛔';
      } else if (riskLevel === 'medium') {
        riskClass = 'risk-medium';
        riskBadge = '주의';
        riskIcon = '⚠️';
      } else {
        riskClass = 'risk-low';
        riskBadge = '저위험';
        riskIcon = '🔶';
      }
    }
    
    // 출원일 포맷팅
    const appDate = r.applicationDate || '';
    const formattedDate = appDate.length === 8 ? 
      `${appDate.slice(0,4)}-${appDate.slice(4,6)}-${appDate.slice(6,8)}` : appDate;
    
    // 유사군 코드 추출
    const similarGroups = r.similarGroupCodes || r.overlappingGroups || [];
    
    return `
      <div class="tm-search-result-item ${riskClass} ${hasGroupOverlap ? 'has-overlap' : 'no-overlap'}" data-id="${r.applicationNumber}">
        <!-- 좌측: 순위 + 리스크 뱃지 -->
        <div class="tm-result-left">
          <span class="tm-rank-num">${rank}</span>
          <span class="tm-risk-badge ${riskClass}">${riskIcon} ${riskBadge}</span>
        </div>
        
        <!-- 상표 이미지 -->
        <div class="tm-result-image">
          ${r.drawing || r.drawingUrl ? 
            `<img src="${r.drawing || r.drawingUrl}" alt="상표 이미지" onerror="this.outerHTML='<span class=\"tm-img-placeholder\"><span class="ico" data-icon="tag"></span></span>'">` : 
            '<span class="tm-img-placeholder"><span class="ico" data-icon="tag"></span></span>'}
        </div>
        
        <!-- 상표 정보 (메인) -->
        <div class="tm-result-info">
          <div class="tm-result-title">${TM.escapeHtml(r.title || r.trademarkName || '(명칭없음)')}</div>
          
          <div class="tm-result-details">
            <div class="tm-detail-row">
              <span class="tm-detail-item"><strong>출원번호</strong> ${r.applicationNumber || '-'}</span>
              <span class="tm-detail-item"><strong>출원일</strong> ${formattedDate || '-'}</span>
            </div>
            <div class="tm-detail-row">
              ${r.applicantName ? `<span class="tm-detail-item"><strong>출원인</strong> ${TM.escapeHtml(r.applicantName)}</span>` : ''}
              ${r.rightHolderName ? `<span class="tm-detail-item"><strong>권리자</strong> ${TM.escapeHtml(r.rightHolderName)}</span>` : ''}
            </div>
            <div class="tm-detail-row">
              ${r.classificationCode ? `<span class="tm-detail-item"><strong>지정상품류</strong> 제${r.classificationCode}류</span>` : ''}
              ${similarGroups.length > 0 ? `
                <span class="tm-detail-item"><strong>유사군</strong> ${similarGroups.slice(0,3).join(', ')}${similarGroups.length > 3 ? '...' : ''}</span>
              ` : ''}
            </div>
            ${r.designatedGoods ? `
              <div class="tm-detail-row tm-goods-row">
                <span class="tm-detail-item tm-goods-detail"><strong>지정상품</strong> ${TM.escapeHtml(r.designatedGoods.slice(0, 100))}${r.designatedGoods.length > 100 ? '...' : ''}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="tm-result-tags">
            <span class="tm-result-status ${TM.getStatusClass(r.applicationStatus)}">
              ${r.applicationStatus || '-'}
            </span>
            ${r.applicationNumber ? `
              <a href="https://kipris.or.kr/khome/main.jsp#702${r.applicationNumber.replace(/-/g, '')}" 
                 target="_blank" class="tm-kipris-link" title="KIPRIS에서 보기">
                🔗 KIPRIS
              </a>
            ` : ''}
          </div>
        </div>
        
        <!-- 유사도 점수 -->
        <div class="tm-result-score">
          ${hasGroupOverlap ? `
            <div class="tm-score-circle ${riskClass}">
              <span class="tm-score-num">${score}</span>
              <span class="tm-score-label">점</span>
            </div>
            <div class="tm-score-breakdown">
              <div class="tm-score-bar" title="문자 ${r.scoreBreakdown?.text || 0}%">
                <span class="tm-bar-label">문자</span>
                <div class="tm-bar-track"><div class="tm-bar-fill" style="width: ${r.scoreBreakdown?.text || 0}%"></div></div>
              </div>
              <div class="tm-score-bar" title="도형 ${r.scoreBreakdown?.vienna || 0}%">
                <span class="tm-bar-label">도형</span>
                <div class="tm-bar-track"><div class="tm-bar-fill" style="width: ${r.scoreBreakdown?.vienna || 0}%"></div></div>
              </div>
            </div>
          ` : `
            <div class="tm-safe-indicator">
              <span class="tm-safe-icon">✓</span>
              <span class="tm-safe-text">유사군<br>비중복</span>
            </div>
          `}
        </div>
        
        <!-- 위험 사유 -->
        <div class="tm-result-reason ${hasGroupOverlap ? '' : 'safe'}">
          <span class="tm-reason-text">${TM.escapeHtml(r.riskReason || (hasGroupOverlap ? '유사군 중복 + 상표명 유사 (거절 가능성 높음)' : '유사군 비중복 → 등록 가능'))}</span>
        </div>
      </div>
    `;
  };
  
  TM.getStatusClass = function(status) {
    if (!status) return '';
    if (status.includes('등록')) return 'registered';
    if (status.includes('출원')) return 'pending';
    if (status.includes('거절') || status.includes('소멸')) return 'refused';
    return '';
  };
  
  TM.searchByText = async function() {
    const keyword = document.getElementById('tm-search-keyword')?.value?.trim();
    if (!keyword) {
      App.showToast('검색어를 입력하세요.', 'warning');
      return;
    }
    
    const statusFilter = document.getElementById('tm-search-status')?.value || 'registered';
    const p = TM.currentProject;
    
    // 새 필터 시스템에서 값 가져오기
    const { targetClasses, targetGroups, classMode, similarityMode } = TM.getSearchFilters();
    
    // 필터 정보 로깅
    console.log('[TM] 검색 필터:', { 
      keyword, statusFilter, classMode, similarityMode,
      targetClasses, targetGroups 
    });
    
    try {
      // 검색 버튼 비활성화 & 로딩 표시
      const searchBtn = document.querySelector('[data-action="tm-search-text"]');
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<span class="ico" data-icon="refresh"></span> 검색 중...';
      }
      
      // 프로그레스 표시
      const progressEl = document.getElementById('tm-search-progress');
      if (progressEl) progressEl.style.display = 'block';
      
      App.showToast('선행상표 검색 중... (최대 30초 소요)', 'info');
      
      // 2-Stage 검색 엔진 호출
      const results = await TM.searchPriorMarks({
        trademark: keyword,
        viennaCodes: p.aiAnalysis.viennaCodeSuggestion?.map(v => v.code) || [],
        targetClasses: targetClasses,
        targetGroups: targetGroups,
        similarityCode: targetGroups.length > 0 ? targetGroups[0] : null, // KIPRIS API용
        classification: targetClasses.length > 0 ? targetClasses[0] : null, // KIPRIS API용
        statusFilter: statusFilter,
        topK: 30,
        fetchDetails: true,
        onProgress: (step, total, msg) => {
          const pct = Math.round((step / total) * 100);
          const fillEl = document.getElementById('tm-search-progress-fill');
          const textEl = document.getElementById('tm-search-progress-text');
          if (fillEl) fillEl.style.width = pct + '%';
          if (textEl) textEl.textContent = msg || `${pct}%`;
        }
      });
      
      // 결과 저장
      TM.currentProject.searchResults.text = results;
      TM.currentProject.searchResults.searchedAt = new Date().toISOString();
      TM.currentProject.searchResults.query = keyword;
      TM.currentProject.searchResults.stats = {
        total: results.length,
        highRisk: results.filter(r => r.isHighRisk).length,
        mediumRisk: results.filter(r => r.riskLevel === 'medium').length
      };
      
      // UI 업데이트
      const resultsEl = document.getElementById('tm-search-results');
      if (resultsEl) {
        resultsEl.innerHTML = TM.renderSearchResults(TM.currentProject.searchResults);
      }
      
      // 고위험 경고
      const highRiskCount = results.filter(r => r.isHighRisk).length;
      if (highRiskCount > 0) {
        App.showToast(`⚠️ ${highRiskCount}건의 고위험 유사상표 발견!`, 'warning');
      } else {
        App.showToast(`✅ ${results.length}건 검색 완료 (고위험 없음)`, 'success');
      }
      
    } catch (error) {
      console.error('[TM] 검색 실패:', error);
      App.showToast('검색 실패: ' + error.message, 'error');
    } finally {
      // 버튼 복구
      const searchBtn = document.querySelector('[data-action="tm-search-text"]');
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<span class="ico" data-icon="search"></span> 상표 검색';
      }
      
      // 프로그레스 숨기기
      const progressEl = document.getElementById('tm-search-progress');
      if (progressEl) progressEl.style.display = 'none';
    }
  };
  
  TM.searchByFigure = async function() {
    const viennaCode = document.getElementById('tm-vienna-code')?.value?.trim();
    if (!viennaCode) {
      App.showToast('비엔나 코드를 입력하세요.', 'warning');
      return;
    }
    
    try {
      App.showToast('도형 검색 중...', 'info');
      
      const results = await TM.callKiprisSearch('figure', {
        viennaCode: viennaCode,
        application: true,
        registration: true,
        numOfRows: 30
      });
      
      TM.currentProject.searchResults.figure = results;
      TM.currentProject.searchResults.searchedAt = new Date().toISOString();
      
      const resultsEl = document.getElementById('tm-search-results');
      if (resultsEl) {
        resultsEl.innerHTML = TM.renderSearchResults(TM.currentProject.searchResults);
      }
      
      App.showToast(`${results.length}건의 도형 검색 결과가 있습니다.`, 'success');
      
    } catch (error) {
      console.error('[TM] 도형 검색 실패:', error);
      App.showToast('검색 실패: ' + error.message, 'error');
    }
  };
  
  // ============================================================
  // KIPRIS 선행상표 검색 엔진 (2-Stage Retrieval + Re-rank)
  // GPT 알고리즘 기반 최적화 구현
  // ============================================================
  
  // 검색 캐시 (24시간 유지)
  TM.searchCache = {
    queries: new Map(), // query_hash -> results
    details: new Map(), // applicationNumber -> detail
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  };
  
  // 캐시 해시 생성
  TM.getCacheKey = function(type, params) {
    const normalized = JSON.stringify({ type, ...params });
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `${type}_${hash}`;
  };
  
  // 캐시 조회
  TM.getFromCache = function(key) {
    const cached = TM.searchCache.queries.get(key);
    if (cached && (Date.now() - cached.timestamp < TM.searchCache.maxAge)) {
      console.log('[KIPRIS] 캐시 히트:', key);
      return cached.data;
    }
    return null;
  };
  
  // 캐시 저장
  TM.setToCache = function(key, data) {
    TM.searchCache.queries.set(key, { data, timestamp: Date.now() });
  };
  
  // ====== 텍스트 정규화 함수들 ======
  
  // 한글 자모 분해
  TM.decomposeHangul = function(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return [char];
    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;
    const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
    const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return [CHO[cho], JUNG[jung], JONG[jong]].filter(x => x);
  };
  
  // 초성 추출
  TM.extractChosung = function(text) {
    const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    let result = '';
    for (const char of text) {
      const code = char.charCodeAt(0) - 0xAC00;
      if (code >= 0 && code <= 11171) {
        result += CHO[Math.floor(code / 588)];
      } else {
        result += char;
      }
    }
    return result;
  };
  
  // 텍스트 정규화 (공백/특수문자 제거, 소문자 변환)
  TM.normalizeText = function(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[\s\-_\.·,;:'"!@#$%^&*()+=\[\]{}|\\/<>?~`]/g, '')
      .trim();
  };
  
  // 레벤슈타인 편집 거리
  TM.levenshteinDistance = function(a, b) {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i-1] === a[j-1]) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  
  // 자카드 유사도 (토큰 기반)
  TM.jaccardSimilarity = function(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };
  
  // ====== 문자 검색 쿼리 빌더 (최대 4회) ======
  
  TM.buildTextQueries = function(trademark, maxQueries = 4) {
    if (!trademark) return [];
    
    const queries = [];
    const added = new Set();
    
    // Q1: 원문
    const q1 = trademark.trim();
    if (q1 && !added.has(q1)) {
      queries.push({ type: 'exact', query: q1 });
      added.add(q1);
    }
    
    // Q2: 정규화 (공백/특수문자 제거)
    const q2 = TM.normalizeText(trademark);
    if (q2 && !added.has(q2) && q2 !== q1) {
      queries.push({ type: 'normalized', query: q2 });
      added.add(q2);
    }
    
    // Q3: 접두 확장 (2~3글자 + 와일드카드)
    if (queries.length < maxQueries && q2.length >= 2) {
      const prefix = q2.slice(0, Math.min(3, q2.length));
      const q3 = prefix + '*';
      if (!added.has(q3)) {
        queries.push({ type: 'prefix', query: q3 });
        added.add(q3);
      }
    }
    
    // Q4: 핵심 토큰 (복합 상표 대응)
    if (queries.length < maxQueries) {
      // 한글/영문 분리 추출
      const korean = trademark.replace(/[^가-힣]/g, '');
      const english = trademark.replace(/[^a-zA-Z]/g, '').toLowerCase();
      
      if (korean.length >= 2 && !added.has(korean)) {
        queries.push({ type: 'korean', query: korean });
        added.add(korean);
      } else if (english.length >= 2 && !added.has(english)) {
        queries.push({ type: 'english', query: english });
        added.add(english);
      }
    }
    
    console.log('[KIPRIS] 문자 쿼리 생성:', queries.length, '개');
    return queries.slice(0, maxQueries);
  };
  
  // ====== 비엔나 코드 쿼리 빌더 (계층 확장) ======
  
  TM.buildViennaQueries = function(viennaCodes, maxQueries = 6) {
    if (!viennaCodes || viennaCodes.length === 0) return [];
    
    const queries = [];
    const added = new Set();
    
    // 입력된 코드들을 배열로 정규화
    const codes = Array.isArray(viennaCodes) ? viennaCodes : [viennaCodes];
    
    for (const code of codes) {
      if (queries.length >= maxQueries) break;
      
      const cleanCode = code.toString().trim();
      if (!cleanCode) continue;
      
      // 1. Exact (leaf) 코드 검색
      if (!added.has(cleanCode)) {
        queries.push({ type: 'exact', code: cleanCode });
        added.add(cleanCode);
      }
      
      // 2. 상위 (prefix) 코드 확대
      const parts = cleanCode.split('.');
      if (parts.length >= 2 && queries.length < maxQueries) {
        const parentCode = parts.slice(0, -1).join('.');
        if (!added.has(parentCode)) {
          queries.push({ type: 'parent', code: parentCode });
          added.add(parentCode);
        }
      }
      
      // 3. 섹션 코드 (첫 번째 숫자만)
      if (parts.length >= 1 && queries.length < maxQueries) {
        const sectionCode = parts[0];
        if (!added.has(sectionCode) && sectionCode !== cleanCode) {
          queries.push({ type: 'section', code: sectionCode });
          added.add(sectionCode);
        }
      }
    }
    
    console.log('[KIPRIS] 비엔나 쿼리 생성:', queries.length, '개');
    return queries.slice(0, maxQueries);
  };
  
  // ====== 동시성 제어 & 백오프 ======
  
  TM.apiQueue = {
    running: 0,
    maxConcurrent: 3, // 동시 요청 3개 제한
    queue: [],
    retryDelays: [1000, 2000, 4000] // 지수 백오프
  };
  
  // 동시성 제한된 API 호출
  TM.throttledCall = async function(fn) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        TM.apiQueue.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          TM.apiQueue.running--;
          if (TM.apiQueue.queue.length > 0) {
            const next = TM.apiQueue.queue.shift();
            next();
          }
        }
      };
      
      if (TM.apiQueue.running < TM.apiQueue.maxConcurrent) {
        execute();
      } else {
        TM.apiQueue.queue.push(execute);
      }
    });
  };
  
  // 지수 백오프 재시도
  TM.withRetry = async function(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = TM.apiQueue.retryDelays[i] || 4000;
        console.log(`[KIPRIS] 재시도 ${i + 1}/${maxRetries} (${delay}ms 후)`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  };
  
  // ====== 시간창 필터 (최근 연도 우선) ======
  
  TM.getYearFilter = function(yearsBack = 5) {
    const now = new Date();
    const startYear = now.getFullYear() - yearsBack;
    return {
      startDate: `${startYear}0101`,
      endDate: `${now.getFullYear()}1231`
    };
  };
  
  // ====== KIPRIS API 호출 (단일) ======
  
  TM.callKiprisAPI = async function(type, params, options = {}) {
    const { useRecent = false, recentYears = 5 } = options;
    
    // 시간창 필터 적용
    if (useRecent) {
      const yearFilter = TM.getYearFilter(recentYears);
      params = { ...params, ...yearFilter };
    }
    
    const cacheKey = TM.getCacheKey(type, params);
    
    // 캐시 확인
    const cached = TM.getFromCache(cacheKey);
    if (cached) return cached;
    
    console.log('[KIPRIS] API 호출 시작:', type, JSON.stringify(params));
    
    try {
      // App.sb (Supabase) 존재 여부 확인
      if (!App.sb || !App.sb.functions) {
        console.warn('[KIPRIS] ⚠️ Supabase 함수 없음 - 시뮬레이션 모드');
        App.showToast('KIPRIS API 연결 안됨 (시뮬레이션 모드)', 'warning');
        return TM.simulateSearchResults(type, params);
      }
      
      // Edge Function 연결 테스트 (첫 호출 시)
      if (!TM._kiprisTestDone) {
        TM._kiprisTestDone = true;
        console.log('[KIPRIS] Edge Function 연결 테스트...');
        try {
          const testResult = await App.sb.functions.invoke('kipris-proxy', {
            body: { type: 'test', params: {}, apiKey: TM.kiprisConfig.apiKey }
          });
          console.log('[KIPRIS] Edge Function 테스트 결과:', testResult);
        } catch (testErr) {
          console.error('[KIPRIS] ❌ Edge Function 연결 실패:', testErr);
        }
      }
      
      // 동시성 제한 + 재시도 적용
      return await TM.throttledCall(() => TM.withRetry(async () => {
        const currentKey = TM.kiprisConfig.apiKey || '(없음)';
        const defaultKey = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
        console.log('[KIPRIS] 📡 Edge Function 호출...');
        console.log('[KIPRIS] 🔑 사용 키:', currentKey === defaultKey ? '⚠️ 기본키' : '<span class="ico" data-icon="check-circle"></span> 사용자키 (' + currentKey.slice(0,8) + '...)');
        
        const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
          body: { 
            type, 
            params,
            apiKey: TM.kiprisConfig.apiKey // API 키 전달
          }
        });
        
        console.log('[KIPRIS] 응답:', { data, error });
        
        if (error) {
          console.error('[KIPRIS] ❌ Edge Function 오류:', error);
          throw error;
        }
        
        if (!data) {
          console.warn('[KIPRIS] ⚠️ 응답 데이터 없음');
          return TM.simulateSearchResults(type, params);
        }
        
        if (!data.success) {
          console.warn('[KIPRIS] ⚠️ API 실패:', data.error || 'Unknown error');
          // 에러 메시지 표시
          if (data.error) {
            App.showToast(`KIPRIS: ${data.error}`, 'warning');
          }
          return TM.simulateSearchResults(type, params);
        }
        
        const results = data.results || [];
        
        // 캐시 저장
        TM.setToCache(cacheKey, results);
        
        console.log(`[KIPRIS] ✅ 검색 성공: ${results.length}건 (총 ${data.totalCount || 0}건)`);
        return results;
      }));
    } catch (error) {
      console.error('[KIPRIS] ❌ API 호출 실패:', error);
      App.showToast('KIPRIS 검색 실패 - 시뮬레이션 결과 표시', 'warning');
      return TM.simulateSearchResults(type, params);
    }
  };
  
  // ====== 상세 조회 (Stage B) ======
  
  TM.fetchDetailInfo = async function(applicationNumber) {
    // 상세 캐시 확인
    const cached = TM.searchCache.details.get(applicationNumber);
    if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) {
      return cached.data;
    }
    
    try {
      const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
        body: { 
          type: 'detail', 
          params: { applicationNumber },
          apiKey: TM.kiprisConfig.apiKey // API 키 전달
        }
      });
      
      if (error || !data.success) {
        console.warn('[KIPRIS] 상세 조회 실패:', applicationNumber);
        return null;
      }
      
      // 상세 캐시 저장 (7일)
      TM.searchCache.details.set(applicationNumber, {
        data: data.result,
        timestamp: Date.now()
      });
      
      return data.result;
    } catch (error) {
      console.error('[KIPRIS] 상세 조회 오류:', error);
      return null;
    }
  };
  
  // Top-K 상세 조회 (병렬, 제한적)
  TM.fetchDetailsForTopK = async function(results, topK = 30) {
    const top = results.slice(0, topK);
    console.log(`[KIPRIS] Top ${top.length}건 상세 조회 시작`);
    
    const details = await Promise.all(
      top.map(r => TM.fetchDetailInfo(r.applicationNumber))
    );
    
    // 상세 정보 병합
    top.forEach((r, i) => {
      if (details[i]) {
        Object.assign(r, {
          similarityGroup: details[i].similarityGroup,
          designatedGoods: details[i].designatedGoods,
          drawingUrl: details[i].drawingUrl,
          applicantAddress: details[i].applicantAddress
        });
      }
    });
    
    console.log(`[KIPRIS] 상세 조회 완료`);
    return top;
  };
  
  // ====== Stage A: 후보 회수 (Retrieval) ======
  
  TM.retrieveCandidates = async function(trademark, viennaCodes, targetClasses, options = {}) {
    const { 
      textBudget = 4, 
      viennaBudget = 6, 
      statusFilter = 'registered',
      classification = null,     // 상품류 필터
      similarityCode = null,     // 유사군코드 필터
      useRecentFirst = true,  // 최근 연도 우선 스캔
      recentYears = 5
    } = options;
    
    const textResults = [];
    const viennaResults = [];
    const SUFFICIENT_THRESHOLD = 50;
    const VIENNA_THRESHOLD = 30;
    
    // 진행상황 콜백 (UI 업데이트용)
    const onProgress = options.onProgress || (() => {});
    let progressStep = 0;
    const totalSteps = textBudget + viennaBudget;
    
    // ===== A1) 문자 검색 (적응형 확장) =====
    if (trademark) {
      const textQueries = TM.buildTextQueries(trademark, textBudget);
      let totalTextHits = 0;
      
      // 1단계: 최근 연도 우선 스캔
      if (useRecentFirst) {
        for (let i = 0; i < Math.min(2, textQueries.length); i++) {
          onProgress(++progressStep, totalSteps, `문자 검색 (최근 ${recentYears}년)...`);
          
          const q = textQueries[i];
          const apiParams = {
            trademarkName: q.query,
            application: statusFilter !== 'registered_only',
            registration: true,
            refused: statusFilter === 'all',
            expiration: false,
            withdrawal: false,
            publication: false,
            cancel: false,
            abandonment: false,
            trademark: true,
            serviceMark: true,
            character: true,
            figure: true,
            compositionCharacter: true,
            figureComposition: true,
            numOfRows: 50,
            pageNo: 1
          };
          
          // 상품류/유사군코드 필터 추가
          if (classification) apiParams.classification = classification;
          if (similarityCode) apiParams.similarityCode = similarityCode;
          
          const results = await TM.callKiprisAPI('text', apiParams);
          
          totalTextHits += results.length;
          textResults.push(...results);
        }
      }
      
      // 2단계: 부족하면 전체 연도 확장
      if (totalTextHits < SUFFICIENT_THRESHOLD) {
        console.log('[KIPRIS] 최근 결과 부족, 전체 연도 확장');
        
        for (let i = 0; i < textQueries.length; i++) {
          if (totalTextHits >= SUFFICIENT_THRESHOLD * 2) {
            console.log('[KIPRIS] 문자 검색 충분, 추가 쿼리 스킵');
            break;
          }
          
          onProgress(++progressStep, totalSteps, `문자 검색 Q${i + 1}...`);
          
          const q = textQueries[i];
          const apiParams = {
            trademarkName: q.query,
            application: statusFilter !== 'registered_only',
            registration: true,
            refused: statusFilter === 'all',
            expiration: false,
            withdrawal: false,
            publication: false,
            cancel: false,
            abandonment: false,
            trademark: true,
            serviceMark: true,
            character: true,
            figure: true,
            compositionCharacter: true,
            figureComposition: true,
            numOfRows: 50,
            pageNo: 1
          };
          
          // 상품류/유사군코드 필터 추가
          if (classification) apiParams.classification = classification;
          if (similarityCode) apiParams.similarityCode = similarityCode;
          
          const results = await TM.callKiprisAPI('text', apiParams);
          
          // 중복 제거하며 추가
          for (const r of results) {
            if (!textResults.find(x => x.applicationNumber === r.applicationNumber)) {
              textResults.push(r);
              totalTextHits++;
            }
          }
        }
      }
      
      console.log(`[KIPRIS] 문자 검색 완료: ${textResults.length}건`);
    }
    
    // ===== A2) 비엔나 검색 (계층형 확장) =====
    if (viennaCodes && viennaCodes.length > 0) {
      const viennaQueries = TM.buildViennaQueries(viennaCodes, viennaBudget);
      let exactHits = 0;
      let totalViennaHits = 0;
      
      for (let i = 0; i < viennaQueries.length; i++) {
        const q = viennaQueries[i];
        
        // exact 결과가 충분하면 parent/section 스킵
        if (q.type !== 'exact' && exactHits >= VIENNA_THRESHOLD) {
          console.log('[KIPRIS] 비엔나 exact 충분, 계층 확장 스킵');
          break;
        }
        
        onProgress(++progressStep, totalSteps, `도형 검색 (${q.code})...`);
        
        const results = await TM.callKiprisAPI('figure', {
          viennaCode: q.code,
          application: statusFilter !== 'registered_only',
          registration: true,
          numOfRows: 30
        });
        
        // 중복 제거하며 추가
        for (const r of results) {
          if (!viennaResults.find(x => x.applicationNumber === r.applicationNumber)) {
            viennaResults.push(r);
            totalViennaHits++;
            if (q.type === 'exact') exactHits++;
          }
        }
      }
      
      console.log(`[KIPRIS] 비엔나 검색 완료: ${viennaResults.length}건`);
    }
    
    // ===== A3) 합치기 & 교집합 태깅 =====
    const deduped = new Map();
    const textSet = new Set(textResults.map(r => r.applicationNumber));
    const viennaSet = new Set(viennaResults.map(r => r.applicationNumber));
    
    // 모든 결과 합치기
    for (const r of [...textResults, ...viennaResults]) {
      const key = r.applicationNumber;
      if (!deduped.has(key)) {
        deduped.set(key, {
          ...r,
          _sources: [],
          _isIntersection: false
        });
      }
    }
    
    // 출처 태깅
    for (const [key, r] of deduped) {
      if (textSet.has(key)) r._sources.push('text');
      if (viennaSet.has(key)) r._sources.push('vienna');
      r._isIntersection = r._sources.includes('text') && r._sources.includes('vienna');
    }
    
    // 교집합 통계
    const intersectionCount = Array.from(deduped.values()).filter(r => r._isIntersection).length;
    console.log(`[KIPRIS] Stage A 완료: ${deduped.size}건 (교집합: ${intersectionCount}건)`);
    
    onProgress(totalSteps, totalSteps, '검색 완료');
    
    return Array.from(deduped.values());
  };
  
  // ====== 유사도 스코어링 ======
  
  TM.calculateTextSimilarity = function(source, target) {
    if (!source || !target) return 0;
    
    const normSource = TM.normalizeText(source);
    const normTarget = TM.normalizeText(target);
    
    // 완전 일치
    if (normSource === normTarget) return 1.0;
    
    // 편집 거리 기반
    const maxLen = Math.max(normSource.length, normTarget.length);
    const editDist = TM.levenshteinDistance(normSource, normTarget);
    const editScore = maxLen > 0 ? 1 - (editDist / maxLen) : 0;
    
    // 자카드 유사도
    const jaccardScore = TM.jaccardSimilarity(normSource, normTarget);
    
    // 접두/접미 일치
    let prefixScore = 0;
    for (let i = 1; i <= Math.min(normSource.length, normTarget.length); i++) {
      if (normSource.slice(0, i) === normTarget.slice(0, i)) prefixScore = i / maxLen;
    }
    
    // 초성 유사도 (한글)
    let chosungScore = 0;
    const srcChosung = TM.extractChosung(source);
    const tgtChosung = TM.extractChosung(target);
    if (srcChosung && tgtChosung) {
      chosungScore = TM.jaccardSimilarity(srcChosung, tgtChosung);
    }
    
    // 가중 평균
    return (editScore * 0.4) + (jaccardScore * 0.25) + (prefixScore * 0.2) + (chosungScore * 0.15);
  };
  
  TM.calculateViennaSimilarity = function(sourceCodes, targetCode) {
    if (!sourceCodes || !targetCode) return 0;
    
    const sources = Array.isArray(sourceCodes) ? sourceCodes : [sourceCodes];
    let maxScore = 0;
    
    for (const src of sources) {
      const srcParts = src.toString().split('.');
      const tgtParts = targetCode.toString().split('.');
      
      // Exact 일치
      if (src === targetCode) {
        maxScore = Math.max(maxScore, 1.0);
        continue;
      }
      
      // Prefix 일치 (상위 코드)
      let matchDepth = 0;
      for (let i = 0; i < Math.min(srcParts.length, tgtParts.length); i++) {
        if (srcParts[i] === tgtParts[i]) matchDepth++;
        else break;
      }
      
      if (matchDepth > 0) {
        const score = matchDepth / Math.max(srcParts.length, tgtParts.length);
        maxScore = Math.max(maxScore, score * 0.8); // prefix는 80% 가중
      }
      
      // 같은 섹션 (첫 번째 숫자만 일치)
      if (srcParts[0] === tgtParts[0]) {
        maxScore = Math.max(maxScore, 0.3);
      }
    }
    
    return maxScore;
  };
  
  TM.calculateScopeSimilarity = function(targetClasses, targetGroups, resultClasses, resultGroups) {
    let classScore = 0;
    let groupScore = 0;
    
    // 니스류 교집합
    if (targetClasses && resultClasses) {
      const tgtSet = new Set(targetClasses.map(c => c.toString()));
      const resClasses = resultClasses.toString().split(/[,\s]+/).map(c => c.trim());
      const intersection = resClasses.filter(c => tgtSet.has(c));
      classScore = intersection.length > 0 ? Math.min(intersection.length / tgtSet.size, 1) : 0;
    }
    
    // 유사군 코드 교집합 (있으면 최대 가산)
    if (targetGroups && targetGroups.length > 0 && resultGroups) {
      const tgtSet = new Set(targetGroups);
      const resGroups = Array.isArray(resultGroups) ? resultGroups : resultGroups.toString().split(/[,\s]+/);
      const intersection = resGroups.filter(g => tgtSet.has(g.trim()));
      groupScore = intersection.length > 0 ? Math.min(intersection.length / tgtSet.size, 1) : 0;
    }
    
    // 유사군이 있으면 가중치 높임
    return targetGroups && targetGroups.length > 0 
      ? (classScore * 0.3) + (groupScore * 0.7)
      : classScore;
  };
  
  // ============================================================
  // 유사군 중복 체크 (상표 심사의 핵심 판단 기준)
  // 상표의 유사 여부는 "동일 유사군 코드" 내에서만 판단됨
  // ============================================================
  
  TM.checkSimilarGroupOverlap = function(targetGroups, resultGroups) {
    // 타겟 유사군이 없으면 상품류 기준으로만 판단 (보수적 접근)
    if (!targetGroups || targetGroups.length === 0) {
      return { hasOverlap: true, overlapType: 'unknown', overlappingGroups: [] };
    }
    
    // 결과 유사군이 없으면 (아직 상세 정보 미조회)
    if (!resultGroups) {
      return { hasOverlap: true, overlapType: 'unknown', overlappingGroups: [] };
    }
    
    const tgtSet = new Set(targetGroups.map(g => g.trim().toUpperCase()));
    const resGroups = Array.isArray(resultGroups) 
      ? resultGroups.map(g => g.trim().toUpperCase())
      : resultGroups.toString().split(/[,\s]+/).map(g => g.trim().toUpperCase()).filter(g => g);
    
    // 중복되는 유사군 찾기
    const overlappingGroups = resGroups.filter(g => tgtSet.has(g));
    
    if (overlappingGroups.length > 0) {
      return { 
        hasOverlap: true, 
        overlapType: 'exact',  // 정확히 일치하는 유사군 있음
        overlappingGroups,
        overlapCount: overlappingGroups.length,
        totalTargetGroups: tgtSet.size
      };
    }
    
    return { 
      hasOverlap: false, 
      overlapType: 'none',  // 유사군 중복 없음 = 충돌 없음
      overlappingGroups: [],
      overlapCount: 0,
      totalTargetGroups: tgtSet.size
    };
  };
  
  // 유사군 중복 여부에 따른 리스크 레벨 결정
  TM.determineRiskLevel = function(hasGroupOverlap, textSimilarity, statusScore) {
    // ★ 핵심 원칙: 유사군 중복이 없으면 상표명이 동일해도 등록 가능
    if (!hasGroupOverlap) {
      return {
        level: 'safe',      // 등록 가능
        isHighRisk: false,
        reason: '유사군 비중복 (등록 가능)'
      };
    }
    
    // 유사군 중복이 있는 경우에만 상표명 유사도로 판단
    if (textSimilarity >= 0.85) {
      return {
        level: 'critical',  // 거절 확실
        isHighRisk: true,
        reason: '유사군 중복 + 상표명 매우 유사 (거절 가능성 높음)'
      };
    }
    
    if (textSimilarity >= 0.70) {
      return {
        level: 'high',      // 거절 가능성 높음
        isHighRisk: true,
        reason: '유사군 중복 + 상표명 유사 (주의 필요)'
      };
    }
    
    if (textSimilarity >= 0.50) {
      return {
        level: 'medium',    // 심사관 판단에 따라 다름
        isHighRisk: false,
        reason: '유사군 중복 + 상표명 다소 유사 (심사관 판단)'
      };
    }
    
    // 유사군은 중복되지만 상표명이 많이 다른 경우
    return {
      level: 'low',
      isHighRisk: false,
      reason: '유사군 중복 있으나 상표명 상이'
    };
  };
  
  TM.calculateStatusScore = function(status) {
    if (!status) return 0.5;
    if (status.includes('등록')) return 1.0;
    if (status.includes('출원')) return 0.8;
    if (status.includes('공고')) return 0.7;
    if (status.includes('거절') || status.includes('취하') || status.includes('소멸')) return 0.2;
    return 0.5;
  };
  
  // ====== Stage B: 상세 검증 & Re-rank ======
  
  TM.rankAndFilter = function(candidates, sourceText, viennaCodes, targetClasses, targetGroups) {
    // ============================================================
    // 상표 심사 핵심 원칙: 유사군 교집합이 있어야만 유사 판단
    // 유사군 교집합 없음 → 상표명 동일해도 등록 가능
    // ============================================================
    
    for (const r of candidates) {
      // Step 1: 유사군 교집합 체크 (가장 중요!)
      const groupOverlap = TM.checkSimilarGroupOverlap(targetGroups, r.similarityGroup);
      r._groupOverlap = groupOverlap;
      r._hasGroupOverlap = groupOverlap.hasOverlap;
      r._overlappingGroups = groupOverlap.overlappingGroups || [];
      
      // Step 2: 문자 유사도 계산 (항상 계산 - 표시용)
      r._scoreText = TM.calculateTextSimilarity(sourceText, r.title || r.trademarkName);
      
      // Step 3: 도형 유사도 계산
      r._scoreVienna = viennaCodes && r.viennaCode 
        ? TM.calculateViennaSimilarity(viennaCodes, r.viennaCode) 
        : 0;
      
      // Step 4: 상태 점수 (등록상표가 더 위험)
      r._scoreStatus = TM.calculateStatusScore(r.applicationStatus);
      
      // Step 5: 최종 점수 및 리스크 레벨 결정
      if (!r._hasGroupOverlap && groupOverlap.overlapType !== 'unknown') {
        // ★ 유사군 교집합 없음 = 등록 가능 (Safe)
        r._totalScore = 0;
        r._riskLevel = 'safe';
        r._riskReason = '유사군 비중복 → 등록 가능';
        r._isHighRisk = false;
      } else {
        // ★ 유사군 교집합 있음 = 상표명/도형 유사도로 판단
        // 가중치: 문자 45%, 도형 30%, 상태 25%
        const combinedScore = (r._scoreText * 0.45) + (r._scoreVienna * 0.30) + (r._scoreStatus * 0.25);
        r._totalScore = combinedScore;
        
        // 교집합 + 문자/도형 모두 유사하면 추가 가중
        if (r._isIntersection) {
          r._totalScore = Math.min(r._totalScore * 1.3, 1.0);
        }
        
        // 리스크 레벨 결정 (유사군 교집합이 있는 경우에만)
        const risk = TM.determineRiskLevel(true, r._scoreText, r._scoreStatus);
        r._riskLevel = risk.level;
        r._riskReason = risk.reason;
        r._isHighRisk = risk.isHighRisk;
        
        // 중복 유사군 정보 추가
        if (r._overlappingGroups.length > 0) {
          r._riskReason += ` [중복: ${r._overlappingGroups.join(', ')}]`;
        }
      }
      
      // 상품류 중복 체크 (보조 정보)
      r._scoreScope = TM.calculateScopeSimilarity(
        targetClasses, targetGroups, 
        r.classificationCode, r.similarityGroup
      );
    }
    
    // 정렬: 유사군 중복 있는 것 우선, 그 다음 점수순
    candidates.sort((a, b) => {
      // 1차: 유사군 중복 여부 (중복 있는 것 우선)
      if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
      if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
      // 2차: 점수순
      return b._totalScore - a._totalScore;
    });
    
    console.log(`[KIPRIS] 랭킹 완료: 전체 ${candidates.length}건 (유사군 중복: ${candidates.filter(c => c._hasGroupOverlap).length}건)`);
    
    return candidates; // 전체 후보 유지 (메모리 연산이므로 성능 영향 없음)
  };
  
  // ====== 메인 검색 함수 (통합 2-Stage) ======
  
  TM.searchPriorMarks = async function(options = {}) {
    const {
      trademark,
      viennaCodes = [],
      targetClasses = [],
      targetGroups = [],
      classification = null,    // KIPRIS API용 상품류
      similarityCode = null,    // KIPRIS API용 유사군코드
      statusFilter = 'registered',
      topK = 30,
      fetchDetails = true,  // Stage B 상세 조회 여부
      onProgress = null     // 진행상황 콜백
    } = options;
    
    console.log('[KIPRIS] ═══════════════════════════════════════');
    console.log('[KIPRIS] 선행상표 검색 시작');
    console.log('[KIPRIS] 입력:', { trademark, viennaCodes, targetClasses: targetClasses.length, targetGroups: targetGroups.length, classification, similarityCode });
    console.log('[KIPRIS] ═══════════════════════════════════════');
    
    try {
      // ===== Stage A: 후보 회수 =====
      const candidates = await TM.retrieveCandidates(
        trademark, viennaCodes, targetClasses,
        { 
          statusFilter,
          classification,      // 상품류 필터 전달
          similarityCode,      // 유사군코드 필터 전달
          onProgress: onProgress ? (step, total, msg) => onProgress(step, total + 2, msg) : null
        }
      );
      
      if (candidates.length === 0) {
        console.log('[KIPRIS] 검색 결과 없음');
        return [];
      }
      
      // ===== Stage B-1: 1차 랭킹 (전체 후보 유지) =====
      onProgress?.(8, 10, '유사도 계산 중...');
      
      const ranked = TM.rankAndFilter(
        candidates, trademark, viennaCodes, 
        targetClasses, targetGroups
      );
      
      // 교집합 후보 우선 → 유사군 중복 우선으로 변경
      ranked.sort((a, b) => {
        // 1차: 유사군 중복 여부 (중복 있는 것 우선)
        if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
        if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
        // 2차: 점수순
        return b._totalScore - a._totalScore;
      });
      
      // ===== Stage B-2: 상세 조회 (K1 = 30) =====
      let detailedResults = ranked.slice(0, topK);
      
      if (fetchDetails && detailedResults.length > 0) {
        onProgress?.(9, 10, '상세 정보 조회 중...');
        detailedResults = await TM.fetchDetailsForTopK(detailedResults, topK);
        
        // ★ 상세 정보로 유사군 교집합 재계산 (핵심!)
        for (const r of detailedResults) {
          if (r.similarityGroup) {
            // 유사군 교집합 재체크
            const groupOverlap = TM.checkSimilarGroupOverlap(targetGroups, r.similarityGroup);
            r._groupOverlap = groupOverlap;
            r._hasGroupOverlap = groupOverlap.hasOverlap;
            r._overlappingGroups = groupOverlap.overlappingGroups || [];
            
            // 유사군 교집합 여부에 따라 점수 재계산
            if (!r._hasGroupOverlap && groupOverlap.overlapType !== 'unknown') {
              // 유사군 비중복 → Safe
              r._totalScore = 0;
              r._riskLevel = 'safe';
              r._riskReason = '유사군 비중복 → 등록 가능';
              r._isHighRisk = false;
            } else {
              // 유사군 중복 → 상표 유사도로 판단
              r._totalScore = (r._scoreText * 0.45) + (r._scoreVienna * 0.30) + (r._scoreStatus * 0.25);
              if (r._isIntersection) r._totalScore = Math.min(r._totalScore * 1.3, 1.0);
              
              const risk = TM.determineRiskLevel(true, r._scoreText, r._scoreStatus);
              r._riskLevel = risk.level;
              r._riskReason = risk.reason;
              r._isHighRisk = risk.isHighRisk;
              
              if (r._overlappingGroups.length > 0) {
                r._riskReason += ` [중복: ${r._overlappingGroups.join(', ')}]`;
              }
            }
            
            r._scoreScope = TM.calculateScopeSimilarity(
              targetClasses, targetGroups,
              r.classificationCode, r.similarityGroup
            );
          }
        }
        
        // 최종 재정렬 (유사군 중복 우선)
        detailedResults.sort((a, b) => {
          if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
          if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
          return b._totalScore - a._totalScore;
        });
      }
      
      // ===== 최종 결과 포맷팅 (유사군 기반) =====
      onProgress?.(10, 10, '완료');
      
      const results = detailedResults.map((r, idx) => ({
        ...r,
        rank: idx + 1,
        similarityScore: Math.round(r._totalScore * 100),
        scoreBreakdown: {
          text: Math.round((r._scoreText || 0) * 100),
          vienna: Math.round((r._scoreVienna || 0) * 100),
          scope: Math.round((r._scoreScope || 0) * 100),
          status: Math.round((r._scoreStatus || 0) * 100)
        },
        // ★ 유사군 기반 리스크 정보
        hasGroupOverlap: r._hasGroupOverlap,
        overlappingGroups: r._overlappingGroups || [],
        isHighRisk: r._isHighRisk || false,
        riskLevel: r._riskLevel || 'safe',
        riskReason: r._riskReason || TM.generateRiskReason(r, trademark, targetClasses, targetGroups)
      }));
      
      // 통계 로깅
      const groupOverlapCount = results.filter(r => r.hasGroupOverlap).length;
      const highRiskCount = results.filter(r => r.isHighRisk).length;
      
      console.log('[KIPRIS] ═══════════════════════════════════════');
      console.log(`[KIPRIS] 최종 결과: ${results.length}건`);
      console.log(`[KIPRIS] 유사군 중복: ${groupOverlapCount}건 (실질적 충돌 가능)`);
      console.log(`[KIPRIS] 고위험: ${highRiskCount}건`);
      console.log(`[KIPRIS] 유사군 비중복: ${results.length - groupOverlapCount}건 (등록 가능)`);
      console.log('[KIPRIS] ═══════════════════════════════════════');
      
      return results;
      
    } catch (error) {
      console.error('[KIPRIS] 검색 실패:', error);
      throw error;
    }
  };
  
  // 위험 사유 생성 (유사군 중심 - 상표심사 원칙 반영)
  TM.generateRiskReason = function(result, sourceMark, targetClasses, targetGroups) {
    // ★ 핵심: 유사군 중복 여부가 가장 중요
    if (!result._hasGroupOverlap && result._groupOverlap?.overlapType !== 'unknown') {
      return '<span class="ico" data-icon="check-circle"></span> 유사군 비중복 → 등록 가능';
    }
    
    const reasons = [];
    
    // 유사군 중복 정보
    if (result._overlappingGroups && result._overlappingGroups.length > 0) {
      reasons.push(`⚠️ 유사군 중복: ${result._overlappingGroups.slice(0, 3).join(', ')}${result._overlappingGroups.length > 3 ? ' 외' : ''}`);
    } else if (result._hasGroupOverlap) {
      reasons.push('⚠️ 유사군 중복');
    }
    
    // 문자 유사도 (유사군 중복이 있는 경우에만 의미있음)
    if (result._scoreText >= 0.85) {
      reasons.push('상표명 매우 유사 (거절 가능성 높음)');
    } else if (result._scoreText >= 0.70) {
      reasons.push('상표명 유사 (주의 필요)');
    } else if (result._scoreText >= 0.50) {
      reasons.push('상표명 다소 유사');
    }
    
    // 도형 유사
    if (result._scoreVienna >= 0.7) {
      reasons.push('도형 유사');
    }
    
    // 상태
    if (result.applicationStatus?.includes('등록')) {
      reasons.push('등록상표');
    } else if (result.applicationStatus?.includes('출원')) {
      reasons.push('출원중');
    }
    
    if (reasons.length === 0) {
      return result._riskLevel === 'safe' ? '등록 가능' : '심사관 판단 필요';
    }
    
    return reasons.join(' · ');
  };
  
  // ====== 레거시 호환 함수 ======
  
  TM.callKiprisSearch = async function(type, params) {
    console.log('[KIPRIS] 레거시 호출:', type, params);
    
    if (type === 'text') {
      const results = await TM.searchPriorMarks({
        trademark: params.trademarkName || params.searchString,
        targetClasses: params.classificationCode ? [params.classificationCode] : [],
        statusFilter: params.registration ? 'registered' : 'all',
        topK: params.numOfRows || 30
      });
      return results;
    }
    
    if (type === 'figure') {
      const results = await TM.searchPriorMarks({
        viennaCodes: [params.viennaCode],
        statusFilter: params.registration ? 'registered' : 'all',
        topK: params.numOfRows || 30
      });
      return results;
    }
    
    // 폴백: 직접 API 호출
    return TM.callKiprisAPI(type, params);
  };
  
  // 시뮬레이션 데이터 (API 실패 시)
  TM.simulateSearchResults = function(type, params) {
    const keyword = params.trademarkName || params.viennaCode || '테스트';
    
    return [
      {
        applicationNumber: '40-2024-0001234',
        applicationDate: '2024-01-15',
        registrationNumber: '40-1234567',
        title: keyword + ' (유사상표1)',
        applicationStatus: '등록',
        classificationCode: '09, 42',
        viennaCode: '26.04.01',
        applicantName: '테스트회사',
        drawing: null,
        similarityScore: 85,
        isHighRisk: true
      },
      {
        applicationNumber: '40-2024-0005678',
        applicationDate: '2024-03-20',
        title: keyword + 'Plus',
        applicationStatus: '출원',
        classificationCode: '09',
        viennaCode: '26.04.02',
        applicantName: '예시기업',
        drawing: null,
        similarityScore: 72,
        isHighRisk: false
      },
      {
        applicationNumber: '40-2023-0098765',
        applicationDate: '2023-11-10',
        registrationNumber: '40-9876543',
        title: '슈퍼' + keyword,
        applicationStatus: '등록',
        classificationCode: '35, 42',
        viennaCode: '26.04.01',
        applicantName: '(주)마케팅',
        drawing: null,
        similarityScore: 65,
        isHighRisk: false
      }
    ];
  };

  // ============================================================
  // Step 4: 유사도 평가
  // ============================================================
  
  TM.renderStep4_Similarity = function(container) {
    const p = TM.currentProject;
    const evaluations = p.similarityEvaluations || [];
    const allSearchResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 10);
    
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
              선행상표 검색을 위해 개인 API 키가 필요합니다. 기본 키는 호출 제한에 걸릴 수 있습니다.
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
        <h3><span class="ico" data-icon="scales"></span> 유사도 평가</h3>
      </div>
      
      ${apiKeyWarning}
      
      ${allSearchResults.length === 0 ? `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon"><span class="ico" data-icon="search"></span></div>
          <h4>선행상표 검색이 필요합니다</h4>
          <p>먼저 선행상표 검색을 실행한 후 유사도를 평가하세요.</p>
          <button class="btn btn-primary" data-action="tm-goto-step" data-step="3">
            선행상표 검색 →
          </button>
        </div>
      ` : `
        <!-- AI 평가 컨트롤 -->
        <div class="tm-eval-control-panel">
          <div class="tm-eval-control-left">
            <button class="btn btn-primary btn-lg" id="tm-eval-all-btn" data-action="tm-evaluate-all-similarity">
              <span class="ico" data-icon="robot"></span> 전체 AI 평가 실행
            </button>
            <p class="tm-eval-hint">선행상표 ${allSearchResults.length}건에 대해 외관·호칭·관념 유사도를 AI가 일괄 분석합니다.</p>
          </div>
          <div class="tm-eval-progress-wrap" id="tm-eval-progress" style="display: none;">
            <div class="tm-progress-bar">
              <div class="tm-progress-fill" id="tm-progress-fill"></div>
            </div>
            <div class="tm-progress-text" id="tm-progress-text">0 / ${allSearchResults.length}</div>
          </div>
        </div>
        
        <!-- 선행상표 그리드 -->
        <div class="tm-eval-grid">
          ${allSearchResults.map((r, idx) => {
            const evaluated = evaluations.find(e => e.targetId === r.applicationNumber);
            return `
              <div class="tm-eval-card-mini ${evaluated ? 'evaluated ' + evaluated.overall : ''}">
                <div class="tm-eval-card-num">${idx + 1}</div>
                <div class="tm-eval-card-content">
                  <div class="tm-eval-card-name">${TM.escapeHtml(r.title || r.trademarkName || '(명칭없음)')}</div>
                  <div class="tm-eval-card-appno">${r.applicationNumber}</div>
                  ${evaluated ? `
                    <div class="tm-eval-scores-mini">
                      <span class="tm-score-mini ${evaluated.appearance}">외관</span>
                      <span class="tm-score-mini ${evaluated.pronunciation}">호칭</span>
                      <span class="tm-score-mini ${evaluated.concept}">관념</span>
                    </div>
                  ` : ''}
                </div>
                <div class="tm-eval-card-status">
                  ${evaluated ? `
                    <span class="tm-eval-result-badge ${evaluated.overall}">
                      ${evaluated.overall === 'high' ? '유사' : evaluated.overall === 'medium' ? '주의' : '비유사'}
                    </span>
                  ` : `
                    <button class="btn btn-sm btn-outline" 
                            data-action="tm-evaluate-similarity" 
                            data-target-id="${r.applicationNumber}">평가</button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- 평가 결과 상세 (아코디언) -->
        ${evaluations.length > 0 ? `
          <div class="tm-eval-detail-section">
            <h4><span class="ico" data-icon="chart"></span> 평가 결과 상세 <span class="tm-badge">${evaluations.length}건</span></h4>
            <div class="tm-eval-details-list">
              ${evaluations.map(e => `
                <details class="tm-eval-detail-item ${e.overall}">
                  <summary>
                    <span class="tm-eval-detail-name">${TM.escapeHtml(e.targetName || e.targetId)}</span>
                    <span class="tm-eval-detail-badge ${e.overall}">
                      ${e.overall === 'high' ? '높음 (유사)' : e.overall === 'medium' ? '중간 (주의)' : '낮음 (비유사)'}
                    </span>
                  </summary>
                  <div class="tm-eval-detail-content">
                    <div class="tm-eval-scores-row">
                      <div class="tm-eval-score-box ${e.appearance}">
                        <div class="score-label">외관</div>
                        <div class="score-value">${e.appearance === 'high' ? '유사' : e.appearance === 'medium' ? '보통' : '상이'}</div>
                      </div>
                      <div class="tm-eval-score-box ${e.pronunciation}">
                        <div class="score-label">호칭</div>
                        <div class="score-value">${e.pronunciation === 'high' ? '유사' : e.pronunciation === 'medium' ? '보통' : '상이'}</div>
                      </div>
                      <div class="tm-eval-score-box ${e.concept}">
                        <div class="score-label">관념</div>
                        <div class="score-value">${e.concept === 'high' ? '유사' : e.concept === 'medium' ? '보통' : '상이'}</div>
                      </div>
                    </div>
                    ${e.notes ? `<div class="tm-eval-notes">${TM.escapeHtml(e.notes)}</div>` : ''}
                  </div>
                </details>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `}
    `;
  };
  
  TM.getSimilarityLabel = function(level) {
    const labels = {
      high: '높음 (유사)',
      medium: '중간 (주의)',
      low: '낮음 (비유사)'
    };
    return labels[level] || level;
  };
  
  TM.renderEvaluationDetail = function(evaluation) {
    return `
      <div class="tm-eval-card">
        <div class="tm-eval-card-header">
          <div class="tm-eval-card-title">
            <strong>${TM.escapeHtml(evaluation.targetName || evaluation.targetId)}</strong>
            <span class="tm-eval-app-no">${evaluation.targetId}</span>
          </div>
          <span class="tm-eval-badge ${evaluation.overall}">
            ${TM.getSimilarityLabel(evaluation.overall)}
          </span>
        </div>
        
        <div class="tm-eval-scores-grid">
          <div class="tm-eval-score-item">
            <div class="tm-score-label">외관</div>
            <div class="tm-score-value ${evaluation.appearance}">${TM.getSimilarityLabel(evaluation.appearance)}</div>
          </div>
          <div class="tm-eval-score-item">
            <div class="tm-score-label">호칭</div>
            <div class="tm-score-value ${evaluation.pronunciation}">${TM.getSimilarityLabel(evaluation.pronunciation)}</div>
          </div>
          <div class="tm-eval-score-item">
            <div class="tm-score-label">관념</div>
            <div class="tm-score-value ${evaluation.concept}">${TM.getSimilarityLabel(evaluation.concept)}</div>
          </div>
        </div>
        
        ${evaluation.notes ? `
          <div class="tm-eval-notes-box">
            <div class="tm-notes-title"><span class="ico" data-icon="lightbulb"></span> 평가 근거</div>
            <p class="tm-notes-content">${TM.escapeHtml(evaluation.notes)}</p>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  TM.evaluateSimilarity = async function(targetId) {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])];
    const target = allResults.find(r => r.applicationNumber === targetId);
    
    if (!target) {
      App.showToast('평가 대상을 찾을 수 없습니다.', 'error');
      return;
    }
    
    try {
      App.showToast('AI 유사도 평가 중...', 'info');
      
      const prompt = `당신은 상표 유사도 평가 전문가입니다. 다음 두 상표의 유사도를 평가하세요.

[출원 상표]
- 명칭: ${p.trademarkName}
- 영문: ${p.trademarkNameEn || '없음'}
- 유형: ${TM.getTypeLabel(p.trademarkType)}

[선행 상표]
- 명칭: ${target.title || target.trademarkName}
- 출원번호: ${target.applicationNumber}
- 상태: ${target.applicationStatus}
- 지정상품류: ${target.classificationCode || '미상'}

다음 항목을 평가하고 JSON 형식으로 응답하세요:

1. 외관 유사도 (appearance): 시각적 유사성
2. 호칭 유사도 (pronunciation): 발음의 유사성
3. 관념 유사도 (concept): 의미적 유사성
4. 종합 판단 (overall): 전체적인 유사 여부

각 항목은 "high" (유사), "medium" (주의 필요), "low" (비유사) 중 하나로 평가하세요.
또한 평가 근거를 간략히 작성하세요.

응답 형식:
{
  "appearance": "high|medium|low",
  "pronunciation": "high|medium|low", 
  "concept": "high|medium|low",
  "overall": "high|medium|low",
  "notes": "평가 근거 설명"
}`;

      const response = await App.callClaudeSonnet(prompt, 1000);
      
      // JSON 파싱
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }
      
      const evaluation = JSON.parse(jsonMatch[0]);
      evaluation.targetId = targetId;
      evaluation.targetName = target.title || target.trademarkName;
      evaluation.evaluatedAt = new Date().toISOString();
      
      // 기존 평가 업데이트 또는 추가
      const existingIndex = p.similarityEvaluations.findIndex(e => e.targetId === targetId);
      if (existingIndex >= 0) {
        p.similarityEvaluations[existingIndex] = evaluation;
      } else {
        p.similarityEvaluations.push(evaluation);
      }
      
      TM.renderCurrentStep();
      // 개별 평가 시 토스트 제거 (전체 평가에서 중복 방지)
      
    } catch (error) {
      console.error('[TM] 유사도 평가 실패:', error);
      App.showToast('평가 실패: ' + error.message, 'error');
    }
  };
  
  TM.evaluateAllSimilarity = async function() {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 10);
    
    if (allResults.length === 0) {
      App.showToast('평가할 선행상표가 없습니다.', 'warning');
      return;
    }
    
    // UI 업데이트 - 프로그레스 바 표시
    const btn = document.getElementById('tm-eval-all-btn');
    const progressEl = document.getElementById('tm-eval-progress');
    const progressFill = document.getElementById('tm-progress-fill');
    const progressText = document.getElementById('tm-progress-text');
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="ico" data-icon="history"></span> 평가 중...';
    }
    if (progressEl) progressEl.style.display = 'flex';
    
    let completed = 0;
    const total = allResults.length;
    
    // ★ 배치 방식: 5건씩 2배치 (실패 시 개별 fallback)
    const BATCH_SIZE = 5;
    for (let i = 0; i < allResults.length; i += BATCH_SIZE) {
      const batch = allResults.slice(i, i + BATCH_SIZE);
      
      try {
        const batchCount = await TM.evaluateSimilarityBatch(batch);
        completed += batchCount;
        console.log(`[TM] 배치 평가 완료: ${batchCount}건`);
      } catch (batchErr) {
        console.warn(`[TM] 배치 평가 실패, 개별 fallback:`, batchErr.message);
        // fallback: 해당 배치를 개별 호출
        for (const target of batch) {
          try {
            await TM.evaluateSimilarityQuiet(target.applicationNumber);
            completed++;
          } catch (error) {
            console.error('[TM] 개별 평가 실패:', error);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 프로그레스 업데이트
      if (progressFill) progressFill.style.width = `${(completed / total) * 100}%`;
      if (progressText) progressText.textContent = `${completed} / ${total}`;
      
      // 배치 간 딜레이
      if (i + BATCH_SIZE < allResults.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 완료
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="ico" data-icon="robot"></span> 전체 AI 평가 실행';
    }
    if (progressEl) progressEl.style.display = 'none';
    
    TM.renderCurrentStep();
    App.showToast(`전체 ${completed}건 유사도 평가 완료!`, 'success');
  };
  
  // 토스트 없이 조용히 평가하는 버전
  TM.evaluateSimilarityQuiet = async function(targetId) {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])];
    const target = allResults.find(r => r.applicationNumber === targetId);
    
    if (!target) return;
    
    const prompt = `당신은 상표 유사도 평가 전문가입니다. 다음 두 상표의 유사도를 평가하세요.

[출원상표]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표유형: ${TM.getTypeLabel(p.trademarkType)}

[선행상표]
- 상표명: ${target.title || target.trademarkName || ''}
- 출원번호: ${target.applicationNumber}
- 상태: ${target.applicationStatus || ''}

다음 3가지 기준으로 평가하고 JSON 형식으로 응답하세요:

1. appearance (외관 유사도): 시각적 구성요소 비교
2. pronunciation (호칭 유사도): 발음의 유사성
3. concept (관념 유사도): 의미, 개념의 유사성

각 항목은 "high" (유사), "medium" (주의), "low" (비유사) 중 하나로 평가.
overall은 종합 판단 결과.
notes는 평가 근거를 3-4문장으로 서술.

응답 형식:
{
  "appearance": "high",
  "pronunciation": "high",
  "concept": "high",
  "overall": "high",
  "notes": "외관: ... 호칭: ... 관념: ... 종합판단: ..."
}`;

    const response = await App.callClaudeSonnet(prompt, 1000);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답 파싱 실패');
    
    const evaluation = JSON.parse(jsonMatch[0]);
    evaluation.targetId = targetId;
    evaluation.targetName = target.title || target.trademarkName;
    evaluation.evaluatedAt = new Date().toISOString();
    
    const existingIndex = p.similarityEvaluations.findIndex(e => e.targetId === targetId);
    if (existingIndex >= 0) {
      p.similarityEvaluations[existingIndex] = evaluation;
    } else {
      p.similarityEvaluations.push(evaluation);
    }
  };

})();
