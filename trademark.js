/* ============================================================
   상표출원 우선심사 자동화 시스템 - trademark.js
   Version: 2.1
   기능명세서 v2.1 기반 완전 구현
   ============================================================ */

(function() {
  'use strict';

  // ============================================================
  // 1. 상태 관리
  // ============================================================
  const TM = {
    // 현재 프로젝트 상태
    currentProject: null,
    currentStep: 1,
    
    // 워크플로우 단계 정의
    steps: [
      { id: 1, name: '상표 정보', icon: '🏷️', key: 'trademark_info' },
      { id: 2, name: '지정상품', icon: '📦', key: 'designated_goods' },
      { id: 3, name: '선행상표 검색', icon: '🔍', key: 'prior_search' },
      { id: 4, name: '유사도 평가', icon: '⚖️', key: 'similarity' },
      { id: 5, name: '리스크 평가', icon: '📊', key: 'risk' },
      { id: 6, name: '비용 산출', icon: '💰', key: 'fee' },
      { id: 7, name: '우선심사', icon: '⚡', key: 'priority_exam' },
      { id: 8, name: '문서 출력', icon: '📄', key: 'output' }
    ],
    
    // 프로젝트 데이터 구조
    defaultProjectData: {
      // 상표 정보
      trademarkName: '',
      trademarkNameEn: '',
      trademarkType: 'text', // text, figure, combined, sound, color, 3d
      specimenUrl: null,
      specimenFile: null,
      
      // 출원인 정보
      applicant: {
        name: '',
        nameEn: '',
        type: 'individual', // individual, corporation, sme, mid
        address: '',
        bizNumber: '',
        customerNumber: '',
        reductionType: null, // sme, individual, veteran, age, disabled
        contactEmail: '',
        contactPhone: ''
      },
      
      // 지정상품
      designatedGoods: [], // [{classCode, className, goods: [{name, nameEn, gazetted, similarGroup}]}]
      gazettedOnly: true,
      
      // 검색 결과
      searchResults: {
        text: [],
        figure: [],
        viennaCodes: [],
        searchedAt: null
      },
      
      // 유사도 평가
      similarityEvaluations: [], // [{targetId, appearance, pronunciation, concept, overall, notes}]
      
      // 리스크 평가
      riskAssessment: {
        level: null, // high, medium, low
        conflictCount: 0,
        details: '',
        recommendation: ''
      },
      
      // 비용
      feeCalculation: {
        applicationFee: 0,
        classCount: 0,
        totalApplicationFee: 0,
        excessGoodsFee: 0,
        priorityExamFee: 0,
        reductionRate: 0,
        reductionAmount: 0,
        totalFee: 0,
        breakdown: []
      },
      
      // 우선심사
      priorityExam: {
        enabled: false,
        reason: '',
        evidences: [], // [{type, title, description, fileUrl}]
        generatedDocument: ''
      },
      
      // AI 분석 결과
      aiAnalysis: {
        businessAnalysis: '',
        recommendedClasses: [],
        viennaCodeSuggestion: [],
        similarityReport: ''
      }
    },
    
    // 캐시 (전처리된 데이터)
    cache: {
      gazettedGoods: null,
      kiprisApiSpec: null,
      niceClasses: null,
      loadedAt: null
    },
    
    // KIPRIS API 설정
    kiprisConfig: {
      baseUrl: 'http://plus.kipris.or.kr/kipo-api/kipi',
      apiKey: '', // 환경변수에서 로드
      rateLimit: 30, // 분당 호출 제한
      timeout: 10000
    },
    
    // 2026년 관납료 테이블
    feeTable: {
      applicationGazetted: 46000,    // 류당 (전자+고시명칭)
      applicationNonGazetted: 52000, // 류당 (전자+비고시명칭)
      applicationPaper: 10000,       // 서면 추가
      excessGoods: 2000,             // 10개 초과시 개당
      priorityExam: 160000,          // 류당 (감면 없음)
      registration10yr: 211000,      // 류당
      reductionRates: {
        sme: 0.70,        // 중소기업 70%
        individual: 0.70, // 개인 70%
        mid: 0.30,        // 중견기업 30%
        veteran: 1.00,    // 국가유공자 100%
        disabled: 1.00,   // 장애인 100%
        age: 0.85         // 19~30세 또는 65세+ 85%
      }
    },
    
    // NICE 분류 (45류)
    niceClasses: {
      '01': '공업용·과학용·사진용 화학제품',
      '02': '페인트, 니스, 래커',
      '03': '화장품, 세정제',
      '04': '공업용 오일, 윤활제',
      '05': '약제, 의료용 제제',
      '06': '비금속 일반, 금속제품',
      '07': '기계, 공작기계',
      '08': '수공구, 도검류',
      '09': '과학기기, 전기기기, 컴퓨터',
      '10': '의료기기',
      '11': '조명, 난방, 냉방장치',
      '12': '차량, 항공기, 선박',
      '13': '화기, 폭발물',
      '14': '귀금속, 시계',
      '15': '악기',
      '16': '종이, 인쇄물, 문방구',
      '17': '고무, 플라스틱 반제품',
      '18': '가죽, 가방, 우산',
      '19': '비금속 건축재료',
      '20': '가구, 거울, 액자',
      '21': '가정용 기구, 유리제품',
      '22': '로프, 텐트, 포대',
      '23': '방적용 사',
      '24': '직물, 침구류',
      '25': '의류, 신발, 모자',
      '26': '레이스, 자수, 리본',
      '27': '바닥재, 벽지',
      '28': '게임, 장난감, 운동기구',
      '29': '육류, 가공식품',
      '30': '커피, 차, 조미료',
      '31': '농산물, 원예, 사료',
      '32': '맥주, 음료',
      '33': '알코올 음료',
      '34': '담배, 흡연용품',
      '35': '광고, 사업관리',
      '36': '보험, 금융, 부동산',
      '37': '건설, 수리',
      '38': '통신',
      '39': '운송, 여행',
      '40': '재료처리',
      '41': '교육, 엔터테인먼트',
      '42': 'IT, 과학기술 서비스',
      '43': '음식/음료 제공, 숙박',
      '44': '의료, 미용, 농업',
      '45': '법률, 보안, 개인서비스'
    }
  };

  // ============================================================
  // 2. 초기화
  // ============================================================
  
  TM.init = async function() {
    console.log('[TM] 상표 모듈 초기화 시작');
    
    try {
      // 캐시 로드 (고시명칭, API 스펙)
      await TM.loadCaches();
      
      // 이벤트 리스너 등록
      TM.bindEvents();
      
      // 대시보드 렌더링
      TM.renderDashboard();
      
      console.log('[TM] 상표 모듈 초기화 완료');
    } catch (error) {
      console.error('[TM] 초기화 실패:', error);
      App.showToast('상표 모듈 초기화 실패', 'error');
    }
  };

  // ============================================================
  // 3. 캐시 로드 (전처리된 데이터)
  // ============================================================
  
  TM.loadCaches = async function() {
    console.log('[TM] 캐시 로드 시작');
    
    // Supabase에서 고시명칭 캐시 로드
    try {
      const { data: gazettedData, error: gazettedError } = await App.sb
        .from('gazetted_goods_cache')
        .select('*')
        .eq('version', 'NICE13')
        .limit(10000);
      
      if (gazettedError) {
        console.warn('[TM] 고시명칭 캐시 로드 실패, 빈 캐시 사용:', gazettedError);
        TM.cache.gazettedGoods = [];
      } else {
        TM.cache.gazettedGoods = gazettedData || [];
        console.log(`[TM] 고시명칭 ${TM.cache.gazettedGoods.length}건 로드`);
      }
    } catch (e) {
      console.warn('[TM] 고시명칭 캐시 로드 예외:', e);
      TM.cache.gazettedGoods = [];
    }
    
    // KIPRIS API 스펙 캐시 로드
    try {
      const { data: apiData, error: apiError } = await App.sb
        .from('kipris_api_cache')
        .select('*');
      
      if (apiError) {
        console.warn('[TM] KIPRIS API 캐시 로드 실패:', apiError);
        TM.cache.kiprisApiSpec = null;
      } else {
        TM.cache.kiprisApiSpec = apiData || [];
        console.log(`[TM] KIPRIS API 스펙 ${TM.cache.kiprisApiSpec.length}건 로드`);
      }
    } catch (e) {
      console.warn('[TM] KIPRIS API 캐시 로드 예외:', e);
      TM.cache.kiprisApiSpec = null;
    }
    
    TM.cache.loadedAt = new Date().toISOString();
  };

  // ============================================================
  // 4. 이벤트 바인딩
  // ============================================================
  
  TM.bindEvents = function() {
    // 탭 패널 내 이벤트 위임
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel) return;
    
    panel.addEventListener('click', TM.handleClick);
    panel.addEventListener('input', TM.handleInput);
    panel.addEventListener('change', TM.handleChange);
  };
  
  TM.handleClick = function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.dataset.action;
    const params = { ...target.dataset };
    
    switch (action) {
      // 프로젝트 관련
      case 'tm-new-project':
        TM.createNewProject();
        break;
      case 'tm-open-project':
        TM.openProject(params.id);
        break;
      case 'tm-delete-project':
        TM.deleteProject(params.id);
        break;
      case 'tm-save-project':
        TM.saveProject();
        break;
      case 'tm-back-to-list':
        TM.backToList();
        break;
        
      // 스텝 네비게이션
      case 'tm-goto-step':
        TM.goToStep(parseInt(params.step));
        break;
      case 'tm-next-step':
        TM.nextStep();
        break;
      case 'tm-prev-step':
        TM.prevStep();
        break;
        
      // 지정상품 관련
      case 'tm-add-class':
        TM.addClass(params.classCode);
        break;
      case 'tm-remove-class':
        TM.removeClass(params.classCode);
        break;
      case 'tm-add-goods':
        TM.addGoods(params.classCode);
        break;
      case 'tm-remove-goods':
        TM.removeGoods(params.classCode, params.goodsName);
        break;
      case 'tm-toggle-gazette-mode':
        TM.toggleGazetteMode();
        break;
        
      // 검색 관련
      case 'tm-search-text':
        TM.searchByText();
        break;
      case 'tm-search-figure':
        TM.searchByFigure();
        break;
      case 'tm-analyze-vienna':
        TM.analyzeViennaCode();
        break;
        
      // AI 분석
      case 'tm-analyze-business':
        TM.analyzeBusiness();
        break;
      case 'tm-evaluate-similarity':
        TM.evaluateSimilarity(params.targetId);
        break;
      case 'tm-assess-risk':
        TM.assessRisk();
        break;
      case 'tm-generate-priority-doc':
        TM.generatePriorityDocument();
        break;
        
      // 증거자료
      case 'tm-add-evidence':
        TM.addEvidence();
        break;
      case 'tm-remove-evidence':
        TM.removeEvidence(params.index);
        break;
        
      // 출력
      case 'tm-download-docx':
        TM.downloadDocx();
        break;
      case 'tm-download-hwp':
        TM.downloadHwp();
        break;
      case 'tm-preview-document':
        TM.previewDocument();
        break;
        
      // 비용 계산
      case 'tm-calc-fee':
        TM.calculateFee();
        break;
    }
  };
  
  TM.handleInput = function(e) {
    const target = e.target;
    if (!target.dataset.field) return;
    
    const field = target.dataset.field;
    const value = target.value;
    
    // 프로젝트 데이터 업데이트
    TM.updateField(field, value);
  };
  
  TM.handleChange = function(e) {
    const target = e.target;
    
    // 파일 업로드
    if (target.type === 'file' && target.dataset.field === 'specimen') {
      TM.handleSpecimenUpload(target.files[0]);
    }
    
    // 체크박스
    if (target.type === 'checkbox' && target.dataset.field) {
      TM.updateField(target.dataset.field, target.checked);
    }
    
    // 라디오
    if (target.type === 'radio' && target.dataset.field) {
      TM.updateField(target.dataset.field, target.value);
    }
  };

  // ============================================================
  // 5. 대시보드 (프로젝트 목록)
  // ============================================================
  
  TM.renderDashboard = async function() {
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel) return;
    
    panel.innerHTML = `
      <div class="trademark-dashboard">
        <div class="trademark-header">
          <h2>🏷️ 상표 출원 자동화</h2>
          <button class="btn btn-primary" data-action="tm-new-project">
            <span class="btn-icon">+</span>
            새 프로젝트
          </button>
        </div>
        
        <div class="tm-project-list" id="tm-project-list">
          <div class="tm-loading">
            <div class="tm-loading-spinner"></div>
            <p>프로젝트 목록 로딩 중...</p>
          </div>
        </div>
      </div>
    `;
    
    await TM.loadProjectList();
  };
  
  TM.loadProjectList = async function() {
    const listEl = document.getElementById('tm-project-list');
    if (!listEl) return;
    
    try {
      const { data: projects, error } = await App.sb
        .from('trademark_projects')
        .select('id, title, status, trademark_name, trademark_type, created_at, updated_at')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      if (!projects || projects.length === 0) {
        listEl.innerHTML = `
          <div class="tm-empty-state">
            <div class="icon">🏷️</div>
            <h4>상표 프로젝트가 없습니다</h4>
            <p>새 프로젝트를 만들어 상표 출원을 시작하세요.</p>
            <button class="btn btn-primary" data-action="tm-new-project">새 프로젝트 만들기</button>
          </div>
        `;
        return;
      }
      
      listEl.innerHTML = `
        <div class="tm-project-grid">
          ${projects.map(p => TM.renderProjectCard(p)).join('')}
        </div>
      `;
      
    } catch (error) {
      console.error('[TM] 프로젝트 목록 로드 실패:', error);
      listEl.innerHTML = `
        <div class="tm-empty-state">
          <div class="icon">⚠️</div>
          <h4>로드 실패</h4>
          <p>${error.message}</p>
        </div>
      `;
    }
  };
  
  TM.renderProjectCard = function(project) {
    const statusLabels = {
      draft: '작성 중',
      searching: '검색 중',
      documenting: '문서 작성',
      completed: '완료'
    };
    
    const typeLabels = {
      text: '문자',
      figure: '도형',
      combined: '결합',
      sound: '소리',
      color: '색채',
      '3d': '입체'
    };
    
    const updatedAt = new Date(project.updated_at).toLocaleDateString('ko-KR');
    
    return `
      <div class="tm-project-card" data-action="tm-open-project" data-id="${project.id}">
        <div class="tm-project-card-header">
          <div class="tm-project-title">${TM.escapeHtml(project.title)}</div>
          <span class="tm-project-status ${project.status}">${statusLabels[project.status] || project.status}</span>
        </div>
        <div class="tm-project-meta">
          ${typeLabels[project.trademark_type] || '문자'} 상표 · 수정일 ${updatedAt}
        </div>
        ${project.trademark_name ? `
          <div class="tm-project-trademark">
            <div class="tm-project-specimen">
              <span style="font-size: 20px;">🏷️</span>
            </div>
            <div>
              <div style="font-weight: 600;">${TM.escapeHtml(project.trademark_name)}</div>
            </div>
          </div>
        ` : ''}
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="btn btn-sm btn-secondary" data-action="tm-open-project" data-id="${project.id}">열기</button>
          <button class="btn btn-sm btn-ghost" data-action="tm-delete-project" data-id="${project.id}" onclick="event.stopPropagation()">삭제</button>
        </div>
      </div>
    `;
  };

  // ============================================================
  // 6. 프로젝트 CRUD
  // ============================================================
  
  TM.createNewProject = async function() {
    const title = prompt('프로젝트 이름을 입력하세요:', '새 상표 프로젝트');
    if (!title) return;
    
    try {
      App.showToast('프로젝트 생성 중...', 'info');
      
      const { data, error } = await App.sb
        .from('trademark_projects')
        .insert({
          owner_user_id: App.currentUser.id,
          title: title,
          status: 'draft',
          trademark_type: 'text',
          current_state_json: JSON.parse(JSON.stringify(TM.defaultProjectData))
        })
        .select()
        .single();
      
      if (error) throw error;
      
      App.showToast('프로젝트가 생성되었습니다.', 'success');
      TM.openProject(data.id);
      
    } catch (error) {
      console.error('[TM] 프로젝트 생성 실패:', error);
      App.showToast('프로젝트 생성 실패: ' + error.message, 'error');
    }
  };
  
  TM.openProject = async function(projectId) {
    try {
      App.showToast('프로젝트 로딩 중...', 'info');
      
      const { data, error } = await App.sb
        .from('trademark_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      
      // 프로젝트 상태 설정
      TM.currentProject = {
        id: data.id,
        title: data.title,
        status: data.status,
        ...TM.defaultProjectData,
        ...(data.current_state_json || {})
      };
      
      // 기존 필드 매핑
      if (data.trademark_name) TM.currentProject.trademarkName = data.trademark_name;
      if (data.trademark_name_en) TM.currentProject.trademarkNameEn = data.trademark_name_en;
      if (data.trademark_type) TM.currentProject.trademarkType = data.trademark_type;
      if (data.specimen_url) TM.currentProject.specimenUrl = data.specimen_url;
      if (data.applicant_info) TM.currentProject.applicant = { ...TM.currentProject.applicant, ...data.applicant_info };
      if (data.designated_goods) TM.currentProject.designatedGoods = data.designated_goods;
      if (data.search_results) TM.currentProject.searchResults = { ...TM.currentProject.searchResults, ...data.search_results };
      if (data.fee_calculation) TM.currentProject.feeCalculation = { ...TM.currentProject.feeCalculation, ...data.fee_calculation };
      if (data.priority_exam) TM.currentProject.priorityExam = { ...TM.currentProject.priorityExam, ...data.priority_exam };
      if (data.ai_analysis) TM.currentProject.aiAnalysis = { ...TM.currentProject.aiAnalysis, ...data.ai_analysis };
      
      TM.currentStep = 1;
      
      // 워크스페이스 렌더링
      TM.renderWorkspace();
      
      App.showToast('프로젝트를 불러왔습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 프로젝트 열기 실패:', error);
      App.showToast('프로젝트 열기 실패: ' + error.message, 'error');
    }
  };
  
  TM.saveProject = async function() {
    if (!TM.currentProject || !TM.currentProject.id) {
      App.showToast('저장할 프로젝트가 없습니다.', 'warning');
      return;
    }
    
    try {
      App.showToast('저장 중...', 'info');
      
      const updateData = {
        title: TM.currentProject.title,
        status: TM.currentProject.status,
        trademark_name: TM.currentProject.trademarkName,
        trademark_name_en: TM.currentProject.trademarkNameEn,
        trademark_type: TM.currentProject.trademarkType,
        specimen_url: TM.currentProject.specimenUrl,
        applicant_info: TM.currentProject.applicant,
        designated_goods: TM.currentProject.designatedGoods,
        search_results: TM.currentProject.searchResults,
        fee_calculation: TM.currentProject.feeCalculation,
        priority_exam: TM.currentProject.priorityExam,
        ai_analysis: TM.currentProject.aiAnalysis,
        current_state_json: {
          trademarkName: TM.currentProject.trademarkName,
          trademarkNameEn: TM.currentProject.trademarkNameEn,
          trademarkType: TM.currentProject.trademarkType,
          applicant: TM.currentProject.applicant,
          designatedGoods: TM.currentProject.designatedGoods,
          gazettedOnly: TM.currentProject.gazettedOnly,
          searchResults: TM.currentProject.searchResults,
          similarityEvaluations: TM.currentProject.similarityEvaluations,
          riskAssessment: TM.currentProject.riskAssessment,
          feeCalculation: TM.currentProject.feeCalculation,
          priorityExam: TM.currentProject.priorityExam,
          aiAnalysis: TM.currentProject.aiAnalysis
        }
      };
      
      const { error } = await App.sb
        .from('trademark_projects')
        .update(updateData)
        .eq('id', TM.currentProject.id);
      
      if (error) throw error;
      
      App.showToast('저장되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 저장 실패:', error);
      App.showToast('저장 실패: ' + error.message, 'error');
    }
  };
  
  TM.deleteProject = async function(projectId) {
    if (!confirm('이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      
      App.showToast('프로젝트가 삭제되었습니다.', 'success');
      
      // 현재 열린 프로젝트였다면 대시보드로
      if (TM.currentProject && TM.currentProject.id === projectId) {
        TM.currentProject = null;
        TM.renderDashboard();
      } else {
        TM.loadProjectList();
      }
      
    } catch (error) {
      console.error('[TM] 삭제 실패:', error);
      App.showToast('삭제 실패: ' + error.message, 'error');
    }
  };
  
  TM.backToList = function() {
    if (TM.currentProject) {
      if (!confirm('저장하지 않은 변경사항이 있을 수 있습니다. 목록으로 돌아가시겠습니까?')) {
        return;
      }
    }
    TM.currentProject = null;
    TM.renderDashboard();
  };

  // ============================================================
  // 7. 워크스페이스 렌더링
  // ============================================================
  
  TM.renderWorkspace = function() {
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel || !TM.currentProject) return;
    
    panel.innerHTML = `
      <div class="trademark-workspace">
        <!-- 헤더 -->
        <div class="tm-workspace-header">
          <div class="tm-workspace-title">
            <button class="btn btn-ghost btn-sm" data-action="tm-back-to-list">← 목록</button>
            <h3 id="tm-project-title">${TM.escapeHtml(TM.currentProject.title)}</h3>
            <span class="tm-project-status ${TM.currentProject.status}">${TM.getStatusLabel(TM.currentProject.status)}</span>
          </div>
          <div class="tm-workspace-actions">
            <button class="btn btn-secondary btn-sm" data-action="tm-save-project">💾 저장</button>
          </div>
        </div>
        
        <!-- 스텝 네비게이션 -->
        <nav class="tm-workflow-nav" id="tm-workflow-nav">
          ${TM.steps.map(step => `
            <button class="tm-step-tab ${step.id === TM.currentStep ? 'active' : ''} ${TM.isStepCompleted(step.id) ? 'completed' : ''}"
                    data-action="tm-goto-step" data-step="${step.id}">
              <span class="tm-step-number">${step.id}</span>
              <span>${step.icon} ${step.name}</span>
            </button>
          `).join('')}
        </nav>
        
        <!-- 스텝 컨텐츠 -->
        <div class="tm-step-contents" id="tm-step-contents">
          ${TM.steps.map(step => `
            <div class="tm-step-content ${step.id === TM.currentStep ? 'active' : ''}" id="tm-step-${step.id}">
              <!-- 각 스텝 컨텐츠는 동적으로 렌더링 -->
            </div>
          `).join('')}
        </div>
        
        <!-- 하단 네비게이션 -->
        <div class="tm-step-footer">
          <button class="btn btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
            ← 이전
          </button>
          <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
          <button class="btn btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
            다음 →
          </button>
        </div>
      </div>
    `;
    
    // 현재 스텝 컨텐츠 렌더링
    TM.renderCurrentStep();
  };
  
  TM.getStatusLabel = function(status) {
    const labels = {
      draft: '작성 중',
      searching: '검색 중',
      documenting: '문서 작성',
      completed: '완료'
    };
    return labels[status] || status;
  };
  
  TM.isStepCompleted = function(stepId) {
    if (!TM.currentProject) return false;
    
    switch (stepId) {
      case 1: // 상표 정보
        return !!(TM.currentProject.trademarkName);
      case 2: // 지정상품
        return TM.currentProject.designatedGoods && TM.currentProject.designatedGoods.length > 0;
      case 3: // 선행상표 검색
        return !!(TM.currentProject.searchResults.searchedAt);
      case 4: // 유사도 평가
        return TM.currentProject.similarityEvaluations && TM.currentProject.similarityEvaluations.length > 0;
      case 5: // 리스크 평가
        return !!(TM.currentProject.riskAssessment.level);
      case 6: // 비용 산출
        return TM.currentProject.feeCalculation.totalFee > 0;
      case 7: // 우선심사
        return !TM.currentProject.priorityExam.enabled || !!(TM.currentProject.priorityExam.generatedDocument);
      case 8: // 문서 출력
        return false; // 항상 미완료 (언제든 다운로드 가능)
      default:
        return false;
    }
  };
  
  TM.goToStep = function(stepNum) {
    if (stepNum < 1 || stepNum > TM.steps.length) return;
    TM.currentStep = stepNum;
    TM.updateStepUI();
    TM.renderCurrentStep();
  };
  
  TM.nextStep = function() {
    if (TM.currentStep < TM.steps.length) {
      TM.goToStep(TM.currentStep + 1);
    }
  };
  
  TM.prevStep = function() {
    if (TM.currentStep > 1) {
      TM.goToStep(TM.currentStep - 1);
    }
  };
  
  TM.updateStepUI = function() {
    // 탭 상태 업데이트
    const tabs = document.querySelectorAll('.tm-step-tab');
    tabs.forEach(tab => {
      const stepNum = parseInt(tab.dataset.step);
      tab.classList.toggle('active', stepNum === TM.currentStep);
      tab.classList.toggle('completed', TM.isStepCompleted(stepNum));
    });
    
    // 컨텐츠 표시 업데이트
    const contents = document.querySelectorAll('.tm-step-content');
    contents.forEach(content => {
      const stepNum = parseInt(content.id.replace('tm-step-', ''));
      content.classList.toggle('active', stepNum === TM.currentStep);
    });
    
    // 하단 버튼 상태
    const prevBtn = document.querySelector('[data-action="tm-prev-step"]');
    const nextBtn = document.querySelector('[data-action="tm-next-step"]');
    if (prevBtn) prevBtn.disabled = TM.currentStep === 1;
    if (nextBtn) nextBtn.disabled = TM.currentStep === TM.steps.length;
    
    // 인디케이터
    const indicator = document.querySelector('.tm-step-indicator');
    if (indicator) indicator.textContent = `${TM.currentStep} / ${TM.steps.length}`;
  };
  
  TM.renderCurrentStep = function() {
    const stepEl = document.getElementById(`tm-step-${TM.currentStep}`);
    if (!stepEl) return;
    
    switch (TM.currentStep) {
      case 1:
        TM.renderStep1_TrademarkInfo(stepEl);
        break;
      case 2:
        TM.renderStep2_DesignatedGoods(stepEl);
        break;
      case 3:
        TM.renderStep3_PriorSearch(stepEl);
        break;
      case 4:
        TM.renderStep4_Similarity(stepEl);
        break;
      case 5:
        TM.renderStep5_Risk(stepEl);
        break;
      case 6:
        TM.renderStep6_Fee(stepEl);
        break;
      case 7:
        TM.renderStep7_PriorityExam(stepEl);
        break;
      case 8:
        TM.renderStep8_Output(stepEl);
        break;
    }
  };

  // ============================================================
  // 8. 유틸리티 함수
  // ============================================================
  
  TM.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  TM.updateField = function(field, value) {
    if (!TM.currentProject) return;
    
    // 점 표기법 지원 (예: 'applicant.name')
    const parts = field.split('.');
    let obj = TM.currentProject;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    
    obj[parts[parts.length - 1]] = value;
  };
  
  TM.getField = function(field) {
    if (!TM.currentProject) return '';
    
    const parts = field.split('.');
    let obj = TM.currentProject;
    
    for (const part of parts) {
      if (obj === undefined || obj === null) return '';
      obj = obj[part];
    }
    
    return obj || '';
  };
  
  TM.formatNumber = function(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('ko-KR');
  };
  
  TM.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // 전역 노출
  window.TM = TM;
  
  // App.switchService에서 호출될 때 초기화
  if (window.App && App.currentUser) {
    // 이미 로그인된 상태면 바로 초기화하지 않음
    // switchService에서 호출됨
  }

})();
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
  // Step 1: 상표 정보 입력
  // ============================================================
  
  TM.renderStep1_TrademarkInfo = function(container) {
    const p = TM.currentProject;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>🏷️ 상표 정보 입력</h3>
        <p>출원할 상표의 기본 정보를 입력하세요.</p>
      </div>
      
      <div class="tm-form-section">
        <h4>상표 유형</h4>
        <div class="tm-type-selector">
          ${['text', 'figure', 'combined', 'sound', 'color', '3d'].map(type => `
            <label class="tm-type-option ${p.trademarkType === type ? 'selected' : ''}">
              <input type="radio" name="trademarkType" value="${type}" 
                     data-field="trademarkType" ${p.trademarkType === type ? 'checked' : ''}>
              <span class="tm-type-icon">${TM.getTypeIcon(type)}</span>
              <span class="tm-type-label">${TM.getTypeLabel(type)}</span>
            </label>
          `).join('')}
        </div>
      </div>
      
      <div class="tm-form-row">
        <div class="tm-form-section" style="flex: 1;">
          <h4>상표 명칭</h4>
          <div class="input-group">
            <label>한글 명칭 <span class="required">*</span></label>
            <input type="text" class="tm-input" data-field="trademarkName" 
                   value="${TM.escapeHtml(p.trademarkName)}" 
                   placeholder="예: 클로드">
          </div>
          <div class="input-group">
            <label>영문 명칭</label>
            <input type="text" class="tm-input" data-field="trademarkNameEn" 
                   value="${TM.escapeHtml(p.trademarkNameEn)}" 
                   placeholder="예: CLAUDE">
          </div>
        </div>
        
        <div class="tm-form-section">
          <h4>상표 견본</h4>
          <div class="tm-trademark-preview" id="tm-specimen-preview" onclick="document.getElementById('tm-specimen-input').click()">
            ${p.specimenUrl ? `
              <img src="${p.specimenUrl}" alt="견본 이미지">
            ` : `
              <div class="placeholder">
                <div class="icon">🖼️</div>
                <div>클릭하여 이미지 업로드</div>
                <div style="font-size: 12px; color: #8b95a1;">JPG, PNG (최대 5MB)</div>
              </div>
            `}
          </div>
          <input type="file" id="tm-specimen-input" data-field="specimen" 
                 accept="image/jpeg,image/png,image/gif" style="display: none;">
          ${p.specimenUrl ? `
            <button class="btn btn-sm btn-ghost" style="margin-top: 8px;" 
                    onclick="TM.removeSpecimen()">이미지 제거</button>
          ` : ''}
        </div>
      </div>
      
      <!-- 출원인 정보 (선택) -->
      <details class="tm-accordion">
        <summary>
          <span>👤 출원인 정보 (선택)</span>
          <span class="tm-accordion-badge">${p.applicant.name ? '입력됨' : '미입력'}</span>
        </summary>
        <div class="tm-accordion-content">
          <div class="tm-form-grid">
            <div class="input-group">
              <label>출원인 성명/상호</label>
              <input type="text" class="tm-input" data-field="applicant.name" 
                     value="${TM.escapeHtml(p.applicant.name)}" 
                     placeholder="홍길동 / (주)예시회사">
            </div>
            <div class="input-group">
              <label>영문 성명/상호</label>
              <input type="text" class="tm-input" data-field="applicant.nameEn" 
                     value="${TM.escapeHtml(p.applicant.nameEn)}" 
                     placeholder="Hong Gildong / Example Co., Ltd.">
            </div>
            <div class="input-group">
              <label>출원인 유형</label>
              <select class="tm-input" data-field="applicant.type">
                <option value="individual" ${p.applicant.type === 'individual' ? 'selected' : ''}>개인</option>
                <option value="corporation" ${p.applicant.type === 'corporation' ? 'selected' : ''}>법인 (대기업)</option>
                <option value="sme" ${p.applicant.type === 'sme' ? 'selected' : ''}>중소기업</option>
                <option value="mid" ${p.applicant.type === 'mid' ? 'selected' : ''}>중견기업</option>
              </select>
            </div>
            <div class="input-group">
              <label>감면 유형</label>
              <select class="tm-input" data-field="applicant.reductionType">
                <option value="" ${!p.applicant.reductionType ? 'selected' : ''}>해당 없음</option>
                <option value="sme" ${p.applicant.reductionType === 'sme' ? 'selected' : ''}>중소기업 (70%)</option>
                <option value="individual" ${p.applicant.reductionType === 'individual' ? 'selected' : ''}>개인 (70%)</option>
                <option value="mid" ${p.applicant.reductionType === 'mid' ? 'selected' : ''}>중견기업 (30%)</option>
                <option value="veteran" ${p.applicant.reductionType === 'veteran' ? 'selected' : ''}>국가유공자 (100%)</option>
                <option value="disabled" ${p.applicant.reductionType === 'disabled' ? 'selected' : ''}>장애인 (100%)</option>
                <option value="age" ${p.applicant.reductionType === 'age' ? 'selected' : ''}>19~30세/65세+ (85%)</option>
              </select>
            </div>
            <div class="input-group" style="grid-column: span 2;">
              <label>주소</label>
              <input type="text" class="tm-input" data-field="applicant.address" 
                     value="${TM.escapeHtml(p.applicant.address)}" 
                     placeholder="서울특별시 강남구...">
            </div>
            <div class="input-group">
              <label>사업자등록번호</label>
              <input type="text" class="tm-input" data-field="applicant.bizNumber" 
                     value="${TM.escapeHtml(p.applicant.bizNumber)}" 
                     placeholder="123-45-67890">
            </div>
            <div class="input-group">
              <label>특허고객번호</label>
              <input type="text" class="tm-input" data-field="applicant.customerNumber" 
                     value="${TM.escapeHtml(p.applicant.customerNumber)}" 
                     placeholder="9-2024-123456-7">
            </div>
          </div>
        </div>
      </details>
      
      <!-- AI 사업 분석 -->
      <div class="tm-form-section">
        <h4>🤖 AI 사업 분석</h4>
        <p class="tm-hint">사업자등록증이나 홈페이지 URL을 입력하면 AI가 관련 상품류를 추천합니다.</p>
        <div class="tm-business-input">
          <input type="text" class="tm-input" id="tm-business-url" 
                 placeholder="홈페이지 URL 또는 사업 내용 입력">
          <button class="btn btn-secondary" data-action="tm-analyze-business">
            AI 분석 🔍
          </button>
        </div>
        ${p.aiAnalysis.businessAnalysis ? `
          <div class="tm-ai-result">
            <h5>분석 결과</h5>
            <div class="tm-ai-content">${TM.escapeHtml(p.aiAnalysis.businessAnalysis)}</div>
            ${p.aiAnalysis.recommendedClasses.length > 0 ? `
              <div class="tm-recommended-classes">
                <strong>추천 상품류:</strong>
                ${p.aiAnalysis.recommendedClasses.map(c => `
                  <span class="tm-class-badge" data-action="tm-add-class" data-class-code="${c}">
                    제${c}류
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
    
    // 상표 유형 변경 이벤트
    container.querySelectorAll('input[name="trademarkType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        TM.updateField('trademarkType', e.target.value);
        container.querySelectorAll('.tm-type-option').forEach(opt => {
          opt.classList.toggle('selected', opt.querySelector('input').value === e.target.value);
        });
      });
    });
  };
  
  TM.getTypeIcon = function(type) {
    const icons = {
      text: '🔤',
      figure: '🎨',
      combined: '🔀',
      sound: '🔊',
      color: '🌈',
      '3d': '🎲'
    };
    return icons[type] || '🏷️';
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
  // Step 2: 지정상품 선택
  // ============================================================
  
  TM.renderStep2_DesignatedGoods = function(container) {
    const p = TM.currentProject;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>📦 지정상품 선택</h3>
        <p>출원할 상표가 사용될 상품/서비스 분류를 선택하세요.</p>
      </div>
      
      <!-- 고시명칭 토글 -->
      <div class="tm-gazette-toggle">
        <label>
          <input type="radio" name="gazettedMode" value="true" 
                 ${p.gazettedOnly ? 'checked' : ''} data-field="gazettedOnly">
          <span>고시명칭 Only</span>
          <span class="fee-badge">46,000원/류</span>
        </label>
        <label>
          <input type="radio" name="gazettedMode" value="false" 
                 ${!p.gazettedOnly ? 'checked' : ''} data-field="gazettedOnly">
          <span>고시명칭 외 허용</span>
          <span class="fee-badge">52,000원/류</span>
        </label>
      </div>
      
      <!-- 상품류 선택 -->
      <div class="tm-form-section">
        <h4>상품류 선택 (NICE 13판)</h4>
        <div class="tm-class-selector" id="tm-class-selector">
          ${Object.entries(TM.niceClasses).map(([code, name]) => {
            const isSelected = p.designatedGoods.some(g => g.classCode === code);
            return `
              <button class="tm-class-btn ${isSelected ? 'selected' : ''}" 
                      data-action="${isSelected ? 'tm-remove-class' : 'tm-add-class'}" 
                      data-class-code="${code}">
                <div class="class-num">${code}</div>
                <div class="class-label">${name.slice(0, 8)}...</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- 선택된 류별 지정상품 -->
      <div class="tm-selected-classes" id="tm-selected-classes">
        ${p.designatedGoods.length === 0 ? `
          <div class="tm-empty-state" style="padding: 40px;">
            <div class="icon">📦</div>
            <h4>선택된 상품류가 없습니다</h4>
            <p>위에서 상품류를 선택하세요.</p>
          </div>
        ` : p.designatedGoods.map(classData => TM.renderClassGoods(classData)).join('')}
      </div>
      
      <!-- 요약 -->
      ${p.designatedGoods.length > 0 ? `
        <div class="tm-goods-summary">
          <div class="summary-item">
            <span class="label">선택된 류</span>
            <span class="value">${p.designatedGoods.length}개</span>
          </div>
          <div class="summary-item">
            <span class="label">총 지정상품</span>
            <span class="value">${p.designatedGoods.reduce((sum, c) => sum + c.goods.length, 0)}개</span>
          </div>
          <div class="summary-item">
            <span class="label">비고시명칭</span>
            <span class="value ${p.designatedGoods.reduce((sum, c) => sum + (c.nonGazettedCount || 0), 0) > 0 ? 'warning' : ''}">
              ${p.designatedGoods.reduce((sum, c) => sum + (c.nonGazettedCount || 0), 0)}개
            </span>
          </div>
        </div>
      ` : ''}
    `;
    
    // 고시명칭 모드 변경 이벤트
    container.querySelectorAll('input[name="gazettedMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        TM.currentProject.gazettedOnly = e.target.value === 'true';
      });
    });
  };
  
  TM.renderClassGoods = function(classData) {
    return `
      <div class="tm-class-goods-card" data-class="${classData.classCode}">
        <div class="tm-class-goods-header">
          <div>
            <strong>제${classData.classCode}류</strong>
            <span class="tm-class-name">${TM.niceClasses[classData.classCode]}</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-action="tm-remove-class" data-class-code="${classData.classCode}">
            ✕ 제거
          </button>
        </div>
        
        <div class="tm-goods-input-area">
          <input type="text" class="tm-goods-input" 
                 id="tm-goods-input-${classData.classCode}"
                 placeholder="지정상품 입력 (자동완성 지원)"
                 data-class="${classData.classCode}">
          <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"></div>
        </div>
        
        <div class="tm-selected-goods">
          ${classData.goods.length === 0 ? `
            <div class="tm-hint">지정상품을 입력하세요.</div>
          ` : classData.goods.map(g => `
            <span class="tm-goods-tag ${g.gazetted === false ? 'non-gazetted' : ''}">
              ${TM.escapeHtml(g.name)}
              ${g.gazetted === false ? '<span class="badge warning">비고시</span>' : ''}
              <button class="remove-btn" data-action="tm-remove-goods" 
                      data-class-code="${classData.classCode}" 
                      data-goods-name="${TM.escapeHtml(g.name)}">×</button>
            </span>
          `).join('')}
        </div>
        
        <div class="tm-goods-count">
          ${classData.goods.length}개 선택
          ${classData.goods.length > 10 ? `<span class="warning">(10개 초과 ${classData.goods.length - 10}개 × 2,000원 추가)</span>` : ''}
        </div>
      </div>
    `;
  };
  
  TM.addClass = function(classCode) {
    if (!TM.currentProject) return;
    
    // 이미 선택되어 있으면 무시
    if (TM.currentProject.designatedGoods.some(g => g.classCode === classCode)) {
      return;
    }
    
    TM.currentProject.designatedGoods.push({
      classCode: classCode,
      className: TM.niceClasses[classCode],
      goods: [],
      goodsCount: 0,
      nonGazettedCount: 0
    });
    
    TM.renderCurrentStep();
    TM.initGoodsAutocomplete(classCode);
  };
  
  TM.removeClass = function(classCode) {
    if (!TM.currentProject) return;
    
    TM.currentProject.designatedGoods = TM.currentProject.designatedGoods.filter(
      g => g.classCode !== classCode
    );
    
    TM.renderCurrentStep();
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
    if (!TM.currentProject) return;
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) return;
    
    classItem.goods = classItem.goods.filter(g => g.name !== goodsName);
    classItem.goodsCount = classItem.goods.length;
    classItem.nonGazettedCount = classItem.goods.filter(g => !g.gazetted).length;
    
    TM.renderCurrentStep();
  };
  
  TM.initGoodsAutocomplete = function(classCode) {
    const input = document.getElementById(`tm-goods-input-${classCode}`);
    const autocomplete = document.getElementById(`tm-autocomplete-${classCode}`);
    if (!input || !autocomplete) return;
    
    const searchGoods = TM.debounce(async (query) => {
      if (query.length < 2) {
        autocomplete.classList.remove('show');
        return;
      }
      
      // 캐시에서 검색
      let results = [];
      if (TM.cache.gazettedGoods && TM.cache.gazettedGoods.length > 0) {
        results = TM.cache.gazettedGoods.filter(g => 
          g.class_code === classCode && 
          (g.goods_name.includes(query) || (g.goods_name_en && g.goods_name_en.toLowerCase().includes(query.toLowerCase())))
        ).slice(0, 10);
      }
      
      // Supabase에서 검색 (캐시에 없으면)
      if (results.length === 0) {
        try {
          const { data, error } = await App.sb.rpc('search_gazetted_goods', {
            p_query: query,
            p_class_code: classCode,
            p_limit: 10
          });
          
          if (!error && data) {
            results = data.map(d => ({
              goods_name: d.goods_name,
              goods_name_en: d.goods_name_en,
              similar_group_code: d.similar_group_code
            }));
          }
        } catch (e) {
          console.warn('[TM] 지정상품 검색 실패:', e);
        }
      }
      
      if (results.length === 0) {
        // 비고시명칭 허용 모드면 직접 입력 옵션 표시
        if (!TM.currentProject.gazettedOnly) {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" data-name="${TM.escapeHtml(query)}" data-gazetted="false">
              <div class="goods-name">"${TM.escapeHtml(query)}" 직접 입력</div>
              <div class="goods-meta">비고시명칭 (52,000원/류 적용)</div>
            </div>
          `;
          autocomplete.classList.add('show');
        } else {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" style="color: #8b95a1;">
              검색 결과가 없습니다. (고시명칭 모드)
            </div>
          `;
          autocomplete.classList.add('show');
        }
        return;
      }
      
      autocomplete.innerHTML = results.map(r => `
        <div class="tm-goods-autocomplete-item" 
             data-name="${TM.escapeHtml(r.goods_name)}" 
             data-name-en="${TM.escapeHtml(r.goods_name_en || '')}"
             data-similar-group="${r.similar_group_code || ''}"
             data-gazetted="true">
          <div class="goods-name">${TM.escapeHtml(r.goods_name)}</div>
          <div class="goods-meta">${r.goods_name_en || ''} · ${r.similar_group_code || ''}</div>
        </div>
      `).join('');
      
      autocomplete.classList.add('show');
    }, 300);
    
    input.addEventListener('input', (e) => searchGoods(e.target.value));
    
    input.addEventListener('blur', () => {
      setTimeout(() => autocomplete.classList.remove('show'), 200);
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
      autocomplete.classList.remove('show');
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
        autocomplete.classList.remove('show');
      }
    });
  };

  // ============================================================
  // Step 3: 선행상표 검색
  // ============================================================
  
  TM.renderStep3_PriorSearch = function(container) {
    const p = TM.currentProject;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>🔍 선행상표 검색</h3>
        <p>출원 전 유사 상표가 있는지 검색합니다.</p>
      </div>
      
      <!-- 검색 컨트롤 -->
      <div class="tm-search-section">
        <div class="tm-search-controls">
          <div class="tm-search-type-toggle">
            <button class="active" data-search-type="text" onclick="TM.setSearchType('text', this)">문자 검색</button>
            <button data-search-type="figure" onclick="TM.setSearchType('figure', this)">도형 검색</button>
          </div>
          <button class="btn btn-primary" data-action="tm-search-text">
            🔍 검색 실행
          </button>
        </div>
        
        <!-- 문자 검색 옵션 -->
        <div class="tm-search-options" id="tm-search-options-text">
          <div class="tm-form-grid">
            <div class="input-group">
              <label>검색어</label>
              <input type="text" class="tm-input" id="tm-search-keyword" 
                     value="${TM.escapeHtml(p.trademarkName)}" 
                     placeholder="상표명 입력">
            </div>
            <div class="input-group">
              <label>상태 필터</label>
              <select class="tm-input" id="tm-search-status">
                <option value="all">전체</option>
                <option value="registered" selected>등록/출원</option>
                <option value="registered_only">등록만</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- 도형 검색 옵션 -->
        <div class="tm-search-options" id="tm-search-options-figure" style="display: none;">
          <div class="tm-vienna-section">
            <h4>비엔나 도형 분류 코드</h4>
            <p class="tm-hint">상표 이미지를 분석하여 비엔나 코드를 추천받으세요.</p>
            <button class="btn btn-secondary" data-action="tm-analyze-vienna">
              🤖 AI 비엔나 코드 분석
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
  
  TM.renderSearchResults = function(results) {
    const textResults = results.text || [];
    const figureResults = results.figure || [];
    const allResults = [...textResults, ...figureResults];
    
    if (allResults.length === 0) {
      return `
        <div class="tm-empty-state" style="padding: 40px;">
          <div class="icon">🔍</div>
          <h4>검색 결과가 없습니다</h4>
          <p>검색을 실행하세요.</p>
        </div>
      `;
    }
    
    return allResults.map(r => `
      <div class="tm-search-result-item" data-id="${r.applicationNumber}">
        <div class="tm-result-image">
          ${r.drawing ? `<img src="${r.drawing}" alt="상표 이미지">` : '<span>🏷️</span>'}
        </div>
        <div class="tm-result-info">
          <div class="tm-result-title">${TM.escapeHtml(r.title || r.trademarkName || '(명칭없음)')}</div>
          <div class="tm-result-meta">
            출원번호: ${r.applicationNumber || '-'} · 
            출원일: ${r.applicationDate || '-'} · 
            ${r.applicantName || ''}
          </div>
          <span class="tm-result-status ${TM.getStatusClass(r.applicationStatus)}">
            ${r.applicationStatus || '-'}
          </span>
          ${r.classificationCode ? `
            <div class="tm-result-classes">
              지정상품류: ${r.classificationCode}
            </div>
          ` : ''}
        </div>
        <div class="tm-result-similarity">
          <button class="btn btn-sm btn-secondary" 
                  data-action="tm-evaluate-similarity" 
                  data-target-id="${r.applicationNumber}">
            유사도 평가
          </button>
        </div>
      </div>
    `).join('');
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
    
    const statusFilter = document.getElementById('tm-search-status')?.value || 'all';
    
    try {
      App.showToast('검색 중...', 'info');
      
      // KIPRIS API 호출 (또는 시뮬레이션)
      const results = await TM.callKiprisSearch('text', {
        trademarkName: keyword,
        application: statusFilter !== 'registered_only',
        registration: true,
        refused: statusFilter === 'all',
        numOfRows: 30
      });
      
      TM.currentProject.searchResults.text = results;
      TM.currentProject.searchResults.searchedAt = new Date().toISOString();
      
      // UI 업데이트
      const resultsEl = document.getElementById('tm-search-results');
      if (resultsEl) {
        resultsEl.innerHTML = TM.renderSearchResults(TM.currentProject.searchResults);
      }
      
      App.showToast(`${results.length}건의 검색 결과가 있습니다.`, 'success');
      
    } catch (error) {
      console.error('[TM] 검색 실패:', error);
      App.showToast('검색 실패: ' + error.message, 'error');
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
  
  // KIPRIS API 호출 (실제 구현 또는 시뮬레이션)
  TM.callKiprisSearch = async function(type, params) {
    // KIPRIS API Key가 없으면 시뮬레이션 데이터 반환
    if (!TM.kiprisConfig.apiKey) {
      console.warn('[TM] KIPRIS API Key가 설정되지 않았습니다. 시뮬레이션 모드로 실행합니다.');
      return TM.simulateSearchResults(type, params);
    }
    
    // 실제 KIPRIS API 호출
    const endpoint = type === 'text' 
      ? '/trademarkNameSearchInfo' 
      : '/viennaCodesearchInfo';
    
    const url = new URL(TM.kiprisConfig.baseUrl + endpoint);
    url.searchParams.set('ServiceKey', TM.kiprisConfig.apiKey);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    });
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`KIPRIS API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    return TM.parseKiprisResponse(data);
  };
  
  TM.parseKiprisResponse = function(data) {
    // KIPRIS 응답 파싱
    const items = data?.response?.body?.items?.item || [];
    if (!Array.isArray(items)) {
      return items ? [items] : [];
    }
    
    return items.map(item => ({
      applicationNumber: item.ApplicationNumber,
      applicationDate: item.ApplicationDate,
      registrationNumber: item.RegistrationNumber,
      title: item.Title,
      trademarkName: item.Title,
      applicationStatus: item.ApplicationStatus,
      classificationCode: item.ClassificationCode,
      viennaCode: item.ViennaCode,
      applicantName: item.ApplicantName,
      drawing: item.Drawing || item.BigDrawing
    }));
  };
  
  TM.simulateSearchResults = function(type, params) {
    // 시뮬레이션 데이터
    const keyword = params.trademarkName || params.viennaCode || '';
    
    return [
      {
        applicationNumber: '40-2024-0001234',
        applicationDate: '2024-01-15',
        registrationNumber: '40-1234567',
        title: keyword + ' (유사상표1)',
        applicationStatus: '등록',
        classificationCode: '09, 42',
        applicantName: '테스트회사',
        drawing: null
      },
      {
        applicationNumber: '40-2024-0005678',
        applicationDate: '2024-03-20',
        title: keyword + 'Plus',
        applicationStatus: '출원',
        classificationCode: '09',
        applicantName: '예시기업',
        drawing: null
      },
      {
        applicationNumber: '40-2023-0098765',
        applicationDate: '2023-11-10',
        registrationNumber: '40-9876543',
        title: '슈퍼' + keyword,
        applicationStatus: '등록',
        classificationCode: '35, 42',
        applicantName: '(주)마케팅',
        drawing: null
      }
    ];
  };

  // ============================================================
  // Step 4: 유사도 평가
  // ============================================================
  
  TM.renderStep4_Similarity = function(container) {
    const p = TM.currentProject;
    const evaluations = p.similarityEvaluations || [];
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>⚖️ 유사도 평가</h3>
        <p>AI가 선행상표와의 유사도를 외관, 호칭, 관념 기준으로 평가합니다.</p>
      </div>
      
      <!-- 출원상표 정보 -->
      <div class="tm-target-trademark">
        <h4>출원 상표</h4>
        <div class="tm-trademark-card">
          ${p.specimenUrl ? `<img src="${p.specimenUrl}" alt="출원상표">` : ''}
          <div class="tm-trademark-name">${TM.escapeHtml(p.trademarkName)}</div>
          ${p.trademarkNameEn ? `<div class="tm-trademark-name-en">${TM.escapeHtml(p.trademarkNameEn)}</div>` : ''}
        </div>
      </div>
      
      <!-- 평가 대상 선택 -->
      <div class="tm-evaluation-targets">
        <h4>평가 대상 선행상표</h4>
        ${(p.searchResults.text || []).length === 0 && (p.searchResults.figure || []).length === 0 ? `
          <div class="tm-hint">
            먼저 선행상표 검색을 실행하세요.
            <button class="btn btn-sm btn-secondary" data-action="tm-goto-step" data-step="3">
              검색하러 가기 →
            </button>
          </div>
        ` : `
          <div class="tm-target-list">
            ${[...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 10).map(r => {
              const evaluated = evaluations.find(e => e.targetId === r.applicationNumber);
              return `
                <div class="tm-target-item ${evaluated ? 'evaluated' : ''}">
                  <div class="tm-target-info">
                    <strong>${TM.escapeHtml(r.title || r.trademarkName)}</strong>
                    <span>${r.applicationNumber}</span>
                  </div>
                  ${evaluated ? `
                    <div class="tm-eval-summary">
                      <span class="tm-eval-badge ${evaluated.overall}">
                        ${TM.getSimilarityLabel(evaluated.overall)}
                      </span>
                    </div>
                  ` : `
                    <button class="btn btn-sm btn-secondary" 
                            data-action="tm-evaluate-similarity" 
                            data-target-id="${r.applicationNumber}">
                      평가하기
                    </button>
                  `}
                </div>
              `;
            }).join('')}
          </div>
          <button class="btn btn-primary" onclick="TM.evaluateAllSimilarity()" style="margin-top: 16px;">
            🤖 전체 AI 평가 실행
          </button>
        `}
      </div>
      
      <!-- 평가 결과 상세 -->
      ${evaluations.length > 0 ? `
        <div class="tm-evaluation-details">
          <h4>평가 결과 상세</h4>
          ${evaluations.map(e => TM.renderEvaluationDetail(e)).join('')}
        </div>
      ` : ''}
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
        <div class="tm-eval-header">
          <strong>${TM.escapeHtml(evaluation.targetName || evaluation.targetId)}</strong>
          <span class="tm-eval-badge ${evaluation.overall}">
            ${TM.getSimilarityLabel(evaluation.overall)}
          </span>
        </div>
        <div class="tm-eval-scores">
          <div class="tm-eval-score">
            <span class="label">외관</span>
            <span class="score ${evaluation.appearance}">${TM.getSimilarityLabel(evaluation.appearance)}</span>
          </div>
          <div class="tm-eval-score">
            <span class="label">호칭</span>
            <span class="score ${evaluation.pronunciation}">${TM.getSimilarityLabel(evaluation.pronunciation)}</span>
          </div>
          <div class="tm-eval-score">
            <span class="label">관념</span>
            <span class="score ${evaluation.concept}">${TM.getSimilarityLabel(evaluation.concept)}</span>
          </div>
        </div>
        ${evaluation.notes ? `
          <div class="tm-eval-notes">
            <strong>평가 근거:</strong>
            <p>${TM.escapeHtml(evaluation.notes)}</p>
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

      const response = await App.callClaude(prompt, 1000);
      
      // JSON 파싱
      const jsonMatch = response.match(/\{[\s\S]*\}/);
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
      App.showToast('유사도 평가가 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 유사도 평가 실패:', error);
      App.showToast('평가 실패: ' + error.message, 'error');
    }
  };
  
  TM.evaluateAllSimilarity = async function() {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 5);
    
    if (allResults.length === 0) {
      App.showToast('평가할 선행상표가 없습니다.', 'warning');
      return;
    }
    
    for (const target of allResults) {
      await TM.evaluateSimilarity(target.applicationNumber);
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    App.showToast('전체 유사도 평가가 완료되었습니다.', 'success');
  };

})();
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
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>📊 리스크 평가</h3>
        <p>선행상표 검색 및 유사도 평가 결과를 종합하여 등록 가능성을 평가합니다.</p>
      </div>
      
      <!-- 리스크 평가 실행 -->
      <div class="tm-risk-action">
        <button class="btn btn-primary btn-lg" data-action="tm-assess-risk">
          🤖 AI 리스크 종합 평가
        </button>
        <p class="tm-hint">유사도 평가 결과, 지정상품 중복 여부, 상표 유형 등을 종합 분석합니다.</p>
      </div>
      
      <!-- 리스크 평가 결과 -->
      ${risk.level ? `
        <div class="tm-risk-card ${risk.level}">
          <div class="tm-risk-header">
            <div>
              <span class="tm-risk-level">
                ${risk.level === 'high' ? '⚠️ 높은 위험' : risk.level === 'medium' ? '⚡ 주의 필요' : '✅ 낮은 위험'}
              </span>
              <span class="tm-risk-sublevel">등록 가능성: ${TM.getRiskProbability(risk.level)}</span>
            </div>
          </div>
          
          <div class="tm-risk-stats">
            <div class="tm-risk-stat">
              <div class="tm-risk-stat-value">${p.similarityEvaluations?.length || 0}</div>
              <div class="tm-risk-stat-label">검토 상표</div>
            </div>
            <div class="tm-risk-stat">
              <div class="tm-risk-stat-value">${risk.conflictCount || 0}</div>
              <div class="tm-risk-stat-label">충돌 우려</div>
            </div>
            <div class="tm-risk-stat">
              <div class="tm-risk-stat-value">${p.designatedGoods?.length || 0}</div>
              <div class="tm-risk-stat-label">지정상품류</div>
            </div>
          </div>
          
          ${risk.details ? `
            <div class="tm-risk-details">
              <h5>상세 분석</h5>
              <div class="tm-risk-content">${TM.formatRiskDetails(risk.details)}</div>
            </div>
          ` : ''}
          
          ${risk.recommendation ? `
            <div class="tm-risk-recommendation">
              <h5>💡 권고사항</h5>
              <div class="tm-risk-content">${TM.escapeHtml(risk.recommendation)}</div>
            </div>
          ` : ''}
        </div>
      ` : `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon">📊</div>
          <h4>리스크 평가가 필요합니다</h4>
          <p>위의 버튼을 클릭하여 AI 리스크 평가를 실행하세요.</p>
        </div>
      `}
      
      <!-- 평가 기준 안내 -->
      <details class="tm-accordion">
        <summary>
          <span>📋 리스크 평가 기준</span>
        </summary>
        <div class="tm-accordion-content">
          <table class="tm-info-table">
            <tr>
              <th>높은 위험 (High)</th>
              <td>동일/유사 상표가 동일/유사 상품류에 등록되어 있음. 거절 가능성 높음.</td>
            </tr>
            <tr>
              <th>중간 위험 (Medium)</th>
              <td>유사 상표가 있으나 상품류 차이 또는 부분적 차별성 존재. 의견제출 필요 가능성.</td>
            </tr>
            <tr>
              <th>낮은 위험 (Low)</th>
              <td>충돌 우려 상표 없음 또는 명확한 차별성 존재. 등록 가능성 높음.</td>
            </tr>
          </table>
        </div>
      </details>
    `;
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
    
    try {
      App.showToast('리스크 평가 중...', 'info');
      
      // 평가 데이터 수집
      const highSimilarity = (p.similarityEvaluations || []).filter(e => e.overall === 'high').length;
      const mediumSimilarity = (p.similarityEvaluations || []).filter(e => e.overall === 'medium').length;
      const totalSearched = (p.searchResults.text?.length || 0) + (p.searchResults.figure?.length || 0);
      
      const prompt = `당신은 상표 등록 리스크 평가 전문가입니다. 다음 정보를 바탕으로 종합적인 리스크 평가를 수행하세요.

[출원 상표 정보]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}
- 지정상품류: ${p.designatedGoods?.map(g => '제' + g.classCode + '류').join(', ') || '미선택'}
- 총 지정상품 수: ${p.designatedGoods?.reduce((sum, g) => sum + g.goods.length, 0) || 0}개

[검색 결과 요약]
- 검색된 선행상표: ${totalSearched}건
- 유사도 평가 완료: ${p.similarityEvaluations?.length || 0}건
  - 높은 유사도: ${highSimilarity}건
  - 중간 유사도: ${mediumSimilarity}건

[유사도 평가 상세]
${(p.similarityEvaluations || []).slice(0, 5).map(e => 
  `- ${e.targetName}: 외관(${e.appearance}), 호칭(${e.pronunciation}), 관념(${e.concept}) → 종합(${e.overall})`
).join('\n') || '평가 결과 없음'}

다음 항목을 분석하고 JSON 형식으로 응답하세요:

1. level: 전체 리스크 수준 ("high", "medium", "low")
2. conflictCount: 실질적 충돌 우려가 있는 상표 수
3. details: 상세 분석 내용 (2-3문단)
4. recommendation: 출원인에게 권고사항 (명확하고 실용적인 조언)

응답 형식:
{
  "level": "high|medium|low",
  "conflictCount": 0,
  "details": "상세 분석 내용...",
  "recommendation": "권고사항..."
}`;

      const response = await App.callClaude(prompt, 1500);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }
      
      const assessment = JSON.parse(jsonMatch[0]);
      assessment.assessedAt = new Date().toISOString();
      
      p.riskAssessment = assessment;
      
      // 프로젝트 상태 업데이트
      if (assessment.level === 'low') {
        p.status = 'documenting';
      }
      
      TM.renderCurrentStep();
      App.showToast('리스크 평가가 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 리스크 평가 실패:', error);
      App.showToast('평가 실패: ' + error.message, 'error');
    }
  };

  // ============================================================
  // Step 6: 비용 산출
  // ============================================================
  
  TM.renderStep6_Fee = function(container) {
    const p = TM.currentProject;
    const fee = p.feeCalculation || {};
    
    // 자동 계산
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>💰 비용 산출</h3>
        <p>2026년 기준 관납료 및 예상 비용을 계산합니다.</p>
      </div>
      
      <!-- 감면 유형 선택 -->
      <div class="tm-form-section">
        <h4>감면 적용</h4>
        <div class="tm-reduction-selector">
          <select class="tm-input" id="tm-reduction-type" onchange="TM.calculateFee()">
            <option value="" ${!p.applicant?.reductionType ? 'selected' : ''}>감면 없음</option>
            <option value="sme" ${p.applicant?.reductionType === 'sme' ? 'selected' : ''}>중소기업 (70%)</option>
            <option value="individual" ${p.applicant?.reductionType === 'individual' ? 'selected' : ''}>개인 (70%)</option>
            <option value="mid" ${p.applicant?.reductionType === 'mid' ? 'selected' : ''}>중견기업 (30%)</option>
            <option value="veteran" ${p.applicant?.reductionType === 'veteran' ? 'selected' : ''}>국가유공자 (100%)</option>
            <option value="disabled" ${p.applicant?.reductionType === 'disabled' ? 'selected' : ''}>장애인 (100%)</option>
            <option value="age" ${p.applicant?.reductionType === 'age' ? 'selected' : ''}>19~30세/65세+ (85%)</option>
          </select>
          <button class="btn btn-secondary" data-action="tm-calc-fee">재계산</button>
        </div>
      </div>
      
      <!-- 우선심사 여부 -->
      <div class="tm-form-section">
        <label class="tm-checkbox-label">
          <input type="checkbox" id="tm-priority-exam-enabled" 
                 ${p.priorityExam?.enabled ? 'checked' : ''}
                 onchange="TM.togglePriorityExam(this.checked)">
          <span>우선심사 신청 (류당 160,000원 추가, 감면 없음)</span>
        </label>
      </div>
      
      <!-- 비용 명세 -->
      <div class="tm-fee-section">
        <div class="tm-fee-header">
          <h4>비용 명세</h4>
          <div class="tm-fee-total">${TM.formatNumber(fee.totalFee || 0)}원</div>
        </div>
        
        <div class="tm-fee-breakdown">
          ${TM.renderFeeBreakdown(fee)}
        </div>
      </div>
      
      <!-- 비용 테이블 참고 -->
      <details class="tm-accordion">
        <summary>
          <span>📋 2026년 관납료 기준표</span>
        </summary>
        <div class="tm-accordion-content">
          <table class="tm-info-table">
            <tr><th>항목</th><th>금액</th><th>비고</th></tr>
            <tr><td>출원료 (전자+고시명칭)</td><td>46,000원/류</td><td>기본</td></tr>
            <tr><td>출원료 (전자+비고시명칭)</td><td>52,000원/류</td><td>+6,000원</td></tr>
            <tr><td>서면 출원 가산</td><td>10,000원</td><td>전자출원 권장</td></tr>
            <tr><td>지정상품 가산료</td><td>2,000원/개</td><td>류당 10개 초과시</td></tr>
            <tr><td>우선심사 신청료</td><td>160,000원/류</td><td>감면 없음</td></tr>
            <tr><td>등록료 (10년)</td><td>211,000원/류</td><td>참고</td></tr>
          </table>
          
          <h5 style="margin-top: 16px;">감면율</h5>
          <table class="tm-info-table">
            <tr><th>대상</th><th>감면율</th><th>연간한도</th></tr>
            <tr><td>중소기업</td><td>70%</td><td>-</td></tr>
            <tr><td>개인</td><td>70%</td><td>20건</td></tr>
            <tr><td>중견기업</td><td>30%</td><td>-</td></tr>
            <tr><td>국가유공자/장애인</td><td>100%</td><td>10건</td></tr>
            <tr><td>만 19~30세 또는 65세+</td><td>85%</td><td>20건</td></tr>
          </table>
        </div>
      </details>
    `;
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
    
    const reductionType = document.getElementById('tm-reduction-type')?.value || p.applicant?.reductionType;
    const reductionRate = reductionType ? TM.feeTable.reductionRates[reductionType] || 0 : 0;
    
    let breakdown = [];
    let subtotal = 0;
    
    // 류별 출원료 계산
    if (p.designatedGoods && p.designatedGoods.length > 0) {
      p.designatedGoods.forEach(classData => {
        const hasNonGazetted = classData.goods.some(g => !g.gazetted);
        const baseFee = hasNonGazetted ? TM.feeTable.applicationNonGazetted : TM.feeTable.applicationGazetted;
        
        breakdown.push({
          label: `제${classData.classCode}류 출원료 ${hasNonGazetted ? '(비고시)' : '(고시)'}`,
          amount: baseFee,
          type: 'application'
        });
        subtotal += baseFee;
        
        // 지정상품 가산료 (10개 초과)
        if (classData.goods.length > 10) {
          const excessCount = classData.goods.length - 10;
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
    if (p.priorityExam?.enabled && p.designatedGoods) {
      const priorityFee = p.designatedGoods.length * TM.feeTable.priorityExam;
      breakdown.push({
        label: `우선심사 신청료 (${p.designatedGoods.length}류)`,
        amount: priorityFee,
        type: 'priority'
      });
      // 우선심사는 감면 전에 더함
    }
    
    // 소계
    const applicationSubtotal = subtotal;
    
    // 감면 적용 (출원료에만, 우선심사는 제외)
    let reductionAmount = 0;
    if (reductionRate > 0) {
      reductionAmount = Math.round(applicationSubtotal * reductionRate);
      breakdown.push({
        label: `감면 (${Math.round(reductionRate * 100)}%)`,
        amount: reductionAmount,
        type: 'reduction'
      });
    }
    
    // 우선심사 추가 (감면 후)
    let priorityExamFee = 0;
    if (p.priorityExam?.enabled && p.designatedGoods) {
      priorityExamFee = p.designatedGoods.length * TM.feeTable.priorityExam;
    }
    
    // 총액
    const totalFee = subtotal - reductionAmount + priorityExamFee;
    breakdown.push({
      label: '총 납부액',
      amount: totalFee,
      type: 'total'
    });
    
    // 저장
    p.feeCalculation = {
      applicationFee: TM.feeTable.applicationGazetted,
      classCount: p.designatedGoods?.length || 0,
      totalApplicationFee: applicationSubtotal,
      excessGoodsFee: breakdown.filter(b => b.type === 'excess').reduce((sum, b) => sum + b.amount, 0),
      priorityExamFee: priorityExamFee,
      reductionRate: reductionRate,
      reductionAmount: reductionAmount,
      totalFee: totalFee,
      breakdown: breakdown
    };
    
    // UI 업데이트
    TM.renderCurrentStep();
  };
  
  TM.togglePriorityExam = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.calculateFee();
  };

  // ============================================================
  // Step 7: 우선심사
  // ============================================================
  
  TM.renderStep7_PriorityExam = function(container) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>⚡ 우선심사 신청</h3>
        <p>상표를 사용 중이거나 사용 준비 중인 경우 우선심사를 신청할 수 있습니다.</p>
      </div>
      
      <!-- 우선심사 활성화 -->
      <div class="tm-form-section">
        <label class="tm-checkbox-label">
          <input type="checkbox" id="tm-pe-enabled" 
                 ${pe.enabled ? 'checked' : ''}
                 onchange="TM.setPriorityExamEnabled(this.checked)">
          <span>우선심사 신청</span>
        </label>
        <p class="tm-hint">우선심사 신청시 심사 기간이 약 2~3개월로 단축됩니다. (일반: 12~14개월)</p>
      </div>
      
      ${pe.enabled ? `
        <!-- 우선심사 사유 -->
        <div class="tm-form-section">
          <h4>우선심사 신청 사유</h4>
          <select class="tm-input" id="tm-pe-reason" onchange="TM.updatePriorityReason(this.value)">
            <option value="" ${!pe.reason ? 'selected' : ''}>선택하세요</option>
            <option value="using" ${pe.reason === 'using' ? 'selected' : ''}>상표를 이미 사용 중</option>
            <option value="preparing" ${pe.reason === 'preparing' ? 'selected' : ''}>상표 사용 준비 중</option>
            <option value="infringement" ${pe.reason === 'infringement' ? 'selected' : ''}>제3자의 무단 사용</option>
            <option value="export" ${pe.reason === 'export' ? 'selected' : ''}>수출 관련 긴급성</option>
            <option value="other" ${pe.reason === 'other' ? 'selected' : ''}>기타</option>
          </select>
        </div>
        
        <!-- 증거자료 관리 -->
        <div class="tm-form-section">
          <h4>증거자료</h4>
          <p class="tm-hint">상표 사용 증거(사진, 광고물, 계약서 등)를 첨부하세요.</p>
          
          <div class="tm-evidence-grid" id="tm-evidence-grid">
            ${(pe.evidences || []).map((ev, idx) => `
              <div class="tm-evidence-card">
                <div class="tm-evidence-preview">
                  ${ev.fileUrl ? `<img src="${ev.fileUrl}" alt="${ev.title}">` : '<span style="font-size: 32px;">📎</span>'}
                </div>
                <div class="tm-evidence-info">
                  <div class="tm-evidence-title">${TM.escapeHtml(ev.title)}</div>
                  <div class="tm-evidence-type">${TM.getEvidenceTypeLabel(ev.type)}</div>
                </div>
                <button class="btn btn-sm btn-ghost" data-action="tm-remove-evidence" data-index="${idx}">삭제</button>
              </div>
            `).join('')}
            
            <div class="tm-evidence-upload" onclick="document.getElementById('tm-evidence-input').click()">
              <div style="font-size: 32px;">➕</div>
              <div>증거자료 추가</div>
            </div>
          </div>
          <input type="file" id="tm-evidence-input" style="display: none;" 
                 accept="image/*,.pdf,.doc,.docx" onchange="TM.handleEvidenceUpload(this.files)">
        </div>
        
        <!-- 우선심사 설명서 생성 -->
        <div class="tm-form-section">
          <h4>우선심사 설명서</h4>
          <button class="btn btn-primary" data-action="tm-generate-priority-doc">
            🤖 AI 설명서 자동 생성
          </button>
          
          ${pe.generatedDocument ? `
            <div class="tm-document-editor" style="margin-top: 16px;">
              <div class="tm-document-toolbar">
                <button onclick="TM.copyPriorityDoc()">📋 복사</button>
                <button onclick="TM.regeneratePriorityDoc()">🔄 재생성</button>
              </div>
              <div class="tm-document-content" id="tm-priority-doc-content" contenteditable="true">
                ${TM.formatPriorityDocument(pe.generatedDocument)}
              </div>
            </div>
          ` : `
            <div class="tm-hint" style="margin-top: 12px;">
              증거자료를 추가한 후 AI 설명서 생성 버튼을 클릭하세요.
            </div>
          `}
        </div>
      ` : `
        <div class="tm-info-box">
          <h4>💡 우선심사란?</h4>
          <p>상표를 이미 사용하고 있거나 사용 준비 중인 경우, 일반 심사보다 빠르게 심사를 받을 수 있는 제도입니다.</p>
          <ul>
            <li>일반 심사: 약 12~14개월</li>
            <li>우선심사: 약 2~3개월</li>
          </ul>
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
  
  TM.setPriorityExamEnabled = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.calculateFee(); // 비용 재계산
    TM.renderCurrentStep();
  };
  
  TM.updatePriorityReason = function(reason) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.reason = reason;
  };
  
  TM.handleEvidenceUpload = async function(files) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      App.showToast('파일 크기는 10MB 이하여야 합니다.', 'error');
      return;
    }
    
    try {
      App.showToast('업로드 중...', 'info');
      
      const fileName = `${TM.currentProject.id}_evidence_${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await App.sb.storage
        .from('trademark-evidences')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = App.sb.storage
        .from('trademark-evidences')
        .getPublicUrl(fileName);
      
      // 증거자료 추가
      const title = prompt('증거자료 제목을 입력하세요:', file.name);
      if (!title) return;
      
      const evidenceType = prompt('증거 유형을 선택하세요:\n1. 사용 사진\n2. 광고물\n3. 계약서\n4. 매출 자료\n5. 웹사이트\n6. 기타', '1');
      const types = ['usage_photo', 'advertisement', 'contract', 'sales_record', 'website', 'other'];
      const selectedType = types[parseInt(evidenceType) - 1] || 'other';
      
      if (!TM.currentProject.priorityExam.evidences) {
        TM.currentProject.priorityExam.evidences = [];
      }
      
      TM.currentProject.priorityExam.evidences.push({
        type: selectedType,
        title: title,
        description: '',
        fileUrl: urlData.publicUrl,
        fileName: fileName
      });
      
      TM.renderCurrentStep();
      App.showToast('증거자료가 추가되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 증거자료 업로드 실패:', error);
      App.showToast('업로드 실패: ' + error.message, 'error');
    }
  };
  
  TM.removeEvidence = async function(index) {
    if (!confirm('이 증거자료를 삭제하시겠습니까?')) return;
    
    const evidence = TM.currentProject.priorityExam.evidences[index];
    
    // Storage에서 파일 삭제
    if (evidence.fileName) {
      try {
        await App.sb.storage
          .from('trademark-evidences')
          .remove([evidence.fileName]);
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
      
      const reasonLabels = {
        using: '상표를 이미 사용 중인 경우',
        preparing: '상표 사용 준비 중인 경우',
        infringement: '제3자가 정당한 권한 없이 상표를 사용하고 있는 경우',
        export: '수출을 위해 긴급하게 상표 등록이 필요한 경우',
        other: '기타 긴급한 사유'
      };
      
      const prompt = `당신은 상표 우선심사 설명서 작성 전문가입니다. 다음 정보를 바탕으로 우선심사 설명서를 작성하세요.

[상표 정보]
- 상표명: ${p.trademarkName}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}
- 지정상품: ${p.designatedGoods?.map(g => '제' + g.classCode + '류 (' + g.goods.map(gg => gg.name).join(', ') + ')').join('; ') || '미선택'}

[출원인 정보]
- 출원인: ${p.applicant?.name || '(미입력)'}
- 유형: ${p.applicant?.type === 'corporation' ? '법인' : p.applicant?.type === 'sme' ? '중소기업' : '개인'}

[우선심사 사유]
- 선택된 사유: ${reasonLabels[pe.reason]}
- 첨부 증거: ${pe.evidences?.length || 0}건

[증거자료 목록]
${(pe.evidences || []).map((ev, i) => `${i + 1}. ${ev.title} (${TM.getEvidenceTypeLabel(ev.type)})`).join('\n') || '증거자료 없음'}

다음 구조로 우선심사 설명서를 작성하세요:

1. 출원상표의 개요
2. 우선심사 신청 사유
3. 상표 사용 현황 및 증거 설명
4. 결론 (우선심사 허여 요청)

한국 특허청 형식에 맞게 공식적이고 설득력 있는 문체로 작성하세요.`;

      const response = await App.callClaude(prompt, 2000);
      
      pe.generatedDocument = response;
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
    });
  };
  
  TM.regeneratePriorityDoc = function() {
    if (!confirm('설명서를 다시 생성하시겠습니까? 현재 내용은 사라집니다.')) return;
    TM.generatePriorityDocument();
  };

  // ============================================================
  // Step 8: 문서 출력
  // ============================================================
  
  TM.renderStep8_Output = function(container) {
    const p = TM.currentProject;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>📄 문서 출력</h3>
        <p>작성된 내용을 문서로 출력합니다.</p>
      </div>
      
      <!-- 프로젝트 요약 -->
      <div class="tm-output-summary">
        <h4>📋 프로젝트 요약</h4>
        <table class="tm-summary-table">
          <tr><th>상표명</th><td>${TM.escapeHtml(p.trademarkName) || '-'}</td></tr>
          <tr><th>상표 유형</th><td>${TM.getTypeLabel(p.trademarkType)}</td></tr>
          <tr><th>지정상품</th><td>${p.designatedGoods?.length || 0}개 류, ${p.designatedGoods?.reduce((sum, g) => sum + g.goods.length, 0) || 0}개 상품</td></tr>
          <tr><th>리스크 수준</th><td>${p.riskAssessment?.level ? TM.getRiskProbability(p.riskAssessment.level) : '미평가'}</td></tr>
          <tr><th>예상 비용</th><td>${TM.formatNumber(p.feeCalculation?.totalFee || 0)}원</td></tr>
          <tr><th>우선심사</th><td>${p.priorityExam?.enabled ? '신청' : '미신청'}</td></tr>
        </table>
      </div>
      
      <!-- 출력 옵션 -->
      <div class="tm-output-options">
        <h4>📥 다운로드</h4>
        <div class="tm-output-buttons">
          <button class="btn btn-lg btn-primary" data-action="tm-download-docx">
            📝 Word 문서 (.docx)
          </button>
          <button class="btn btn-lg btn-secondary" data-action="tm-preview-document">
            👁️ 미리보기
          </button>
        </div>
        
        <div class="tm-output-includes">
          <h5>포함 내용</h5>
          <div class="tm-checkbox-grid">
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-summary" checked>
              <span>프로젝트 요약</span>
            </label>
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-goods" checked>
              <span>지정상품 목록</span>
            </label>
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-search" checked>
              <span>선행상표 검색 결과</span>
            </label>
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-similarity" checked>
              <span>유사도 평가 결과</span>
            </label>
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-risk" checked>
              <span>리스크 평가</span>
            </label>
            <label class="tm-checkbox-label">
              <input type="checkbox" id="tm-include-fee" checked>
              <span>비용 명세</span>
            </label>
            ${p.priorityExam?.enabled ? `
              <label class="tm-checkbox-label">
                <input type="checkbox" id="tm-include-priority" checked>
                <span>우선심사 설명서</span>
              </label>
            ` : ''}
          </div>
        </div>
      </div>
      
      <!-- 미리보기 영역 -->
      <div class="tm-preview-area" id="tm-preview-area" style="display: none;">
        <div class="tm-preview-header">
          <h4>문서 미리보기</h4>
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('tm-preview-area').style.display='none'">닫기</button>
        </div>
        <div class="tm-preview-content" id="tm-preview-content">
          <!-- 미리보기 내용 -->
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
      App.showToast('Word 문서 생성 중...', 'info');
      
      const p = TM.currentProject;
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle } = window.docx;
      
      const children = [];
      
      // 제목
      children.push(new Paragraph({
        text: '상표 출원 검토 보고서',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER
      }));
      
      children.push(new Paragraph({
        text: `작성일: ${new Date().toLocaleDateString('ko-KR')}`,
        alignment: AlignmentType.CENTER
      }));
      
      children.push(new Paragraph({ text: '' }));
      
      // 개요
      children.push(new Paragraph({
        text: '1. 프로젝트 개요',
        heading: HeadingLevel.HEADING_1
      }));
      
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '상표명: ', bold: true }),
          new TextRun(p.trademarkName || '-')
        ]
      }));
      
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '상표 유형: ', bold: true }),
          new TextRun(TM.getTypeLabel(p.trademarkType))
        ]
      }));
      
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '출원인: ', bold: true }),
          new TextRun(p.applicant?.name || '-')
        ]
      }));
      
      // 지정상품
      if (p.designatedGoods?.length > 0) {
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({
          text: '2. 지정상품',
          heading: HeadingLevel.HEADING_1
        }));
        
        p.designatedGoods.forEach(classData => {
          children.push(new Paragraph({
            text: `제${classData.classCode}류 - ${classData.className}`,
            heading: HeadingLevel.HEADING_2
          }));
          
          classData.goods.forEach(g => {
            children.push(new Paragraph({
              text: `• ${g.name}${!g.gazetted ? ' (비고시)' : ''}`,
              bullet: { level: 0 }
            }));
          });
        });
      }
      
      // 리스크 평가
      if (p.riskAssessment?.level) {
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({
          text: '3. 리스크 평가',
          heading: HeadingLevel.HEADING_1
        }));
        
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '위험 수준: ', bold: true }),
            new TextRun(p.riskAssessment.level === 'high' ? '높음' : p.riskAssessment.level === 'medium' ? '중간' : '낮음')
          ]
        }));
        
        if (p.riskAssessment.recommendation) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '권고사항: ', bold: true }),
              new TextRun(p.riskAssessment.recommendation)
            ]
          }));
        }
      }
      
      // 비용 명세
      if (p.feeCalculation?.totalFee) {
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({
          text: '4. 비용 명세',
          heading: HeadingLevel.HEADING_1
        }));
        
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '총 납부액: ', bold: true }),
            new TextRun(`${TM.formatNumber(p.feeCalculation.totalFee)}원`)
          ]
        }));
      }
      
      // 우선심사 설명서
      if (p.priorityExam?.enabled && p.priorityExam?.generatedDocument) {
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({
          text: '5. 우선심사 설명서',
          heading: HeadingLevel.HEADING_1
        }));
        
        p.priorityExam.generatedDocument.split('\n').forEach(line => {
          children.push(new Paragraph({ text: line }));
        });
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `상표검토_${p.trademarkName || 'unnamed'}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      App.showToast('문서가 다운로드되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] Word 문서 생성 실패:', error);
      App.showToast('문서 생성 실패: ' + error.message, 'error');
    }
  };

})();
/* ============================================================
   상표출원 우선심사 자동화 시스템 - AI 분석 기능
   비즈니스 분석, 비엔나 코드 분석, 유사도 평가 등
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM AI] TM 모듈이 로드되지 않았습니다.');
    return;
  }

  // ============================================================
  // 1. 비즈니스 분석 (상품류 추천)
  // ============================================================
  
  TM.analyzeBusiness = async function() {
    const p = TM.currentProject;
    const businessInput = document.getElementById('tm-business-url')?.value?.trim();
    
    if (!businessInput && !p.trademarkName) {
      App.showToast('상표명 또는 사업 내용을 입력하세요.', 'warning');
      return;
    }
    
    try {
      App.showToast('AI 사업 분석 중...', 'info');
      
      const prompt = `당신은 상표 출원 전문가입니다. 다음 정보를 바탕으로 적합한 상품/서비스 분류를 분석하세요.

[입력 정보]
- 상표명: ${p.trademarkName || '(미입력)'}
- 사업 내용/URL: ${businessInput || '(미입력)'}

다음 항목을 분석하고 JSON 형식으로 응답하세요:

1. businessAnalysis: 사업 분야 분석 (2-3문장)
2. recommendedClasses: 추천 상품류 배열 (NICE 분류 기준, 최대 5개)
   - 각 류는 2자리 문자열로 (예: "09", "35", "42")
3. classReasons: 각 류 추천 이유 (객체)

NICE 분류 참고:
- 09류: 컴퓨터, 소프트웨어, 전자기기
- 35류: 광고, 사업관리, 온라인 쇼핑
- 42류: IT 서비스, 소프트웨어 개발
- 41류: 교육, 엔터테인먼트
- 38류: 통신 서비스
- 25류: 의류, 신발
- 30류: 식품 (커피, 과자 등)
- 43류: 음식점, 숙박

응답 형식:
{
  "businessAnalysis": "분석 내용...",
  "recommendedClasses": ["09", "35", "42"],
  "classReasons": {
    "09": "소프트웨어 제품 판매를 위해",
    "35": "온라인 마케팅 서비스를 위해",
    "42": "IT 서비스 제공을 위해"
  }
}`;

      const response = await App.callClaude(prompt, 1000);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      p.aiAnalysis.businessAnalysis = analysis.businessAnalysis;
      p.aiAnalysis.recommendedClasses = analysis.recommendedClasses || [];
      p.aiAnalysis.classReasons = analysis.classReasons || {};
      
      TM.renderCurrentStep();
      App.showToast('사업 분석이 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 사업 분석 실패:', error);
      App.showToast('분석 실패: ' + error.message, 'error');
    }
  };

  // ============================================================
  // 2. 비엔나 코드 분석 (도형 상표용)
  // ============================================================
  
  TM.analyzeViennaCode = async function() {
    const p = TM.currentProject;
    
    if (!p.specimenUrl && p.trademarkType !== 'figure' && p.trademarkType !== 'combined') {
      App.showToast('도형 상표 이미지를 먼저 업로드하세요.', 'warning');
      return;
    }
    
    try {
      App.showToast('비엔나 코드 분석 중...', 'info');
      
      // 이미지가 있으면 이미지 기반 분석, 없으면 상표명 기반
      let prompt;
      
      if (p.specimenUrl) {
        prompt = `당신은 상표 도형 분류 전문가입니다. 
이 상표 이미지를 분석하여 적절한 비엔나 도형 분류 코드를 추천하세요.

[상표 정보]
- 상표명: ${p.trademarkName || '(미입력)'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}
- 이미지 URL: ${p.specimenUrl}

비엔나 분류 체계의 주요 대분류:
- 01: 천체, 자연현상, 지도
- 02: 인체
- 03: 동물
- 04: 초자연적 존재, 환상적 존재
- 05: 식물
- 06: 풍경
- 07: 건축물, 광고 구축물
- 08: 식품
- 09: 섬유, 의복, 바느질 용품
- 10: 담배, 흡연 용구
- 11: 가정용품
- 12: 가구, 위생설비
- 13: 조명기구, 라디오, 컴퓨터
- 14: 보석류, 시계
- 15: 기계, 모터, 엔진
- 16: 전기통신, 음향
- 17: 사무용품, 문방구
- 18: 스포츠, 게임, 장난감
- 19: 여행용품, 용기
- 20: 문자, 숫자
- 21: 비문자적 기호
- 22: 화살표, 화살촉, 십자형
- 23: 다양한 모양의 물건
- 24: 문장(紋章), 동전, 휘장
- 25: 장식적 패턴, 장식적 표면, 배경
- 26: 기하학적 도형
- 27: 글씨체, 숫자
- 28: 색채

JSON 형식으로 응답하세요:
{
  "viennaCodeSuggestion": [
    {"code": "26.01.01", "description": "원, 타원", "confidence": "high"},
    {"code": "27.05.01", "description": "라틴문자 단어", "confidence": "medium"}
  ],
  "analysisNotes": "분석 설명..."
}`;
      } else {
        prompt = `상표명 "${p.trademarkName}"을 도형 상표로 디자인할 경우 적합한 비엔나 코드를 추천하세요.
일반적인 로고 디자인 패턴을 고려하여 JSON 형식으로 응답:
{
  "viennaCodeSuggestion": [
    {"code": "27.05.01", "description": "라틴문자 단어", "confidence": "high"}
  ],
  "analysisNotes": "상표명 기반 추천..."
}`;
      }
      
      const response = await App.callClaude(prompt, 800);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답을 파싱할 수 없습니다.');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      p.aiAnalysis.viennaCodeSuggestion = analysis.viennaCodeSuggestion || [];
      p.aiAnalysis.viennaAnalysisNotes = analysis.analysisNotes;
      
      TM.renderCurrentStep();
      App.showToast('비엔나 코드 분석이 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 비엔나 코드 분석 실패:', error);
      App.showToast('분석 실패: ' + error.message, 'error');
    }
  };

  // ============================================================
  // 3. 지정상품 추천 (류별)
  // ============================================================
  
  TM.recommendGoods = async function(classCode) {
    const p = TM.currentProject;
    
    try {
      App.showToast('지정상품 추천 중...', 'info');
      
      const prompt = `당신은 상표 출원 전문가입니다.
다음 상표에 대해 제${classCode}류에서 적합한 지정상품을 추천하세요.

[상표 정보]
- 상표명: ${p.trademarkName}
- 사업 분석: ${p.aiAnalysis.businessAnalysis || '(미분석)'}

제${classCode}류: ${TM.niceClasses[classCode]}

다음 조건을 준수하세요:
1. 한국 특허청 고시명칭 사용
2. 실제 사업과 관련된 상품 위주
3. 5~10개 추천

JSON 형식:
{
  "recommendedGoods": [
    {"name": "컴퓨터소프트웨어", "nameEn": "computer software", "reason": "추천 이유"},
    ...
  ]
}`;

      const response = await App.callClaude(prompt, 800);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.recommendedGoods || [];
      }
      
      return [];
      
    } catch (error) {
      console.error('[TM] 지정상품 추천 실패:', error);
      App.showToast('추천 실패: ' + error.message, 'error');
      return [];
    }
  };

  // ============================================================
  // 4. 상표 설명 자동 생성
  // ============================================================
  
  TM.generateTrademarkDescription = async function() {
    const p = TM.currentProject;
    
    if (!p.trademarkName) {
      App.showToast('상표명을 입력하세요.', 'warning');
      return null;
    }
    
    try {
      const prompt = `다음 상표에 대한 상표 설명을 작성하세요.

[상표 정보]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}

상표 설명 작성 규칙:
1. 문자 상표: 한글/영문 표기, 발음, 의미 설명
2. 도형 상표: 도형의 구성 요소 설명
3. 결합 상표: 문자와 도형의 결합 관계 설명
4. 간결하고 객관적인 문체
5. 2~3문장으로 작성

텍스트로만 응답하세요 (JSON 형식 불필요).`;

      const response = await App.callClaude(prompt, 300);
      return response.trim();
      
    } catch (error) {
      console.error('[TM] 상표 설명 생성 실패:', error);
      return null;
    }
  };

  // ============================================================
  // 5. 출원서 초안 생성
  // ============================================================
  
  TM.generateApplicationDraft = async function() {
    const p = TM.currentProject;
    
    if (!p.trademarkName || !p.designatedGoods || p.designatedGoods.length === 0) {
      App.showToast('상표명과 지정상품을 입력하세요.', 'warning');
      return null;
    }
    
    try {
      App.showToast('출원서 초안 생성 중...', 'info');
      
      const goodsList = p.designatedGoods.map(c => 
        `제${c.classCode}류: ${c.goods.map(g => g.name).join(', ')}`
      ).join('\n');
      
      const prompt = `다음 정보를 바탕으로 상표출원서 초안을 작성하세요.

[상표 정보]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}

[출원인]
- 성명/상호: ${p.applicant?.name || '(미입력)'}
- 주소: ${p.applicant?.address || '(미입력)'}

[지정상품]
${goodsList}

한국 특허청 출원서 양식에 맞춰 다음 항목을 작성하세요:
1. 상표의 설명
2. 지정상품(서비스업) 목록 (류별 정리)
3. 출원인 정보 요약

공식적이고 정확한 문체로 작성하세요.`;

      const response = await App.callClaude(prompt, 1500);
      return response;
      
    } catch (error) {
      console.error('[TM] 출원서 초안 생성 실패:', error);
      App.showToast('생성 실패: ' + error.message, 'error');
      return null;
    }
  };

  // ============================================================
  // 6. 종합 보고서 생성
  // ============================================================
  
  TM.generateFullReport = async function() {
    const p = TM.currentProject;
    
    try {
      App.showToast('종합 보고서 생성 중...', 'info');
      
      const prompt = `다음 상표 출원 프로젝트에 대한 종합 검토 보고서를 작성하세요.

[상표 정보]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표 유형: ${TM.getTypeLabel(p.trademarkType)}

[지정상품]
${p.designatedGoods?.map(c => `제${c.classCode}류: ${c.goods.length}개 상품`).join(', ') || '미선택'}

[리스크 평가]
- 위험 수준: ${p.riskAssessment?.level || '미평가'}
- 충돌 우려 상표: ${p.riskAssessment?.conflictCount || 0}건
- 평가 내용: ${p.riskAssessment?.details?.slice(0, 200) || '없음'}

[비용]
- 총 예상 비용: ${TM.formatNumber(p.feeCalculation?.totalFee || 0)}원
- 우선심사: ${p.priorityExam?.enabled ? '신청' : '미신청'}

다음 구조로 보고서를 작성하세요:
1. 요약 (Executive Summary)
2. 상표 분석
3. 리스크 평가 결과
4. 권고사항
5. 다음 단계

전문적이고 명확한 문체로 작성하세요.`;

      const response = await App.callClaude(prompt, 2000);
      
      p.aiAnalysis.fullReport = response;
      App.showToast('보고서가 생성되었습니다.', 'success');
      
      return response;
      
    } catch (error) {
      console.error('[TM] 보고서 생성 실패:', error);
      App.showToast('생성 실패: ' + error.message, 'error');
      return null;
    }
  };

})();
