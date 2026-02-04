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
      baseUrl: 'https://plus.kipris.or.kr/kipo-api/kipi',
      apiKey: 'OhEw2v=FGMxkbJw7e7=8gUyhRk9ai=M83hR=c8soGRE=', // KIPRIS OpenAPI 인증키
      rateLimit: 30, // 분당 호출 제한
      timeout: 10000
    },
    
    // Supabase 설정
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMTcyNjMsImV4cCI6MjA1Mzg5MzI2M30.2-0MUEC8EfRpwjYXxMfTOOFNz5e59sI0-6Mmzx13oUo',
    
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
  // 3. 캐시 초기화 (고시명칭은 DB에서 직접 검색)
  // ============================================================
  
  TM.loadCaches = async function() {
    console.log('[TM] 캐시 초기화');
    
    // 고시명칭은 5만건이므로 클라이언트에 로드하지 않음
    // 검색 시 DB에서 직접 쿼리
    TM.cache.gazettedGoods = [];
    
    // DB 연결 확인 (건수만 체크)
    try {
      const { count, error } = await App.sb
        .from('gazetted_goods_cache')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn('[TM] DB 연결 확인 실패:', error);
      } else {
        console.log(`[TM] 고시명칭 DB 연결 확인: ${count?.toLocaleString()}건`);
      }
    } catch (e) {
      console.warn('[TM] DB 연결 확인 예외:', e);
    }
    
    TM.cache.kiprisApiSpec = null;
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
      case 'tm-edit-project':
        TM.editProject(params.id, params.title);
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
      case 'tm-search-similar':
        TM.searchBySimilarGroup(params.classCode);
        break;
      case 'tm-add-from-similar':
        TM.addGoodsFromSimilar(params.classCode, params.goodsName, params.similarGroup);
        break;
      case 'tm-toggle-more-goods':
        TM.toggleMoreGoods(params.classCode);
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
      case 'tm-apply-recommendation':
        TM.applyRecommendation(params.classCode);
        break;
      case 'tm-apply-all-recommendations':
        TM.applyAllRecommendations();
        break;
      case 'tm-evaluate-similarity':
        TM.evaluateSimilarity(params.targetId);
        break;
      case 'tm-evaluate-all-similarity':
        TM.evaluateAllSimilarity();
        break;
      case 'tm-assess-risk':
        TM.assessRisk();
        break;
      case 'tm-set-priority':
        TM.setPriorityChoice(params.enabled === 'true');
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
        
      // 비고시명칭 처리
      case 'tm-add-custom-term':
        TM.handleAddCustomTerm();
        break;
      case 'tm-remove-custom-term':
        TM.removeCustomTerm(params.class, params.name);
        break;
      case 'tm-replace-custom-term':
        TM.replaceCustomTerm(params.class, params.old, params.new);
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
        <div class="tm-card-icon">🏷️</div>
        <div class="tm-card-content">
          <h4 class="tm-card-title">${TM.escapeHtml(project.trademark_name || project.title || '새 상표')}</h4>
          <div class="tm-card-meta">
            <span class="tm-card-type">${typeLabels[project.trademark_type] || '문자'} 상표</span>
            <span class="tm-card-date">수정: ${updatedAt}</span>
          </div>
          <span class="tm-card-status ${project.status}">${statusLabels[project.status] || '작성 중'}</span>
        </div>
        <div class="tm-card-actions">
          <button class="btn btn-primary btn-sm" data-action="tm-open-project" data-id="${project.id}">
            📂 열기
          </button>
          <button class="btn btn-secondary btn-sm" data-action="tm-edit-project" data-id="${project.id}" data-title="${TM.escapeHtml(project.title || '')}" onclick="event.stopPropagation()">
            ✏️ 편집
          </button>
          <button class="btn btn-ghost btn-sm tm-delete-btn" data-action="tm-delete-project" data-id="${project.id}" onclick="event.stopPropagation()">
            🗑️
          </button>
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
  
  // 프로젝트 편집 (이름 변경)
  TM.editProject = async function(projectId, currentTitle) {
    const newTitle = prompt('프로젝트 이름을 입력하세요:', currentTitle || '새 상표 프로젝트');
    if (!newTitle || newTitle === currentTitle) return;
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', projectId);
      
      if (error) throw error;
      
      App.showToast('프로젝트 이름이 변경되었습니다.', 'success');
      TM.loadProjectList();
      
    } catch (error) {
      console.error('[TM] 편집 실패:', error);
      App.showToast('편집 실패: ' + error.message, 'error');
    }
  };
  
  TM.backToList = async function() {
    if (TM.currentProject) {
      // 먼저 자동 저장 시도
      try {
        App.showToast('변경사항 저장 중...', 'info');
        await TM.saveProject();
        App.showToast('저장 완료! 목록으로 이동합니다.', 'success');
      } catch (error) {
        // 저장 실패 시 확인
        if (!confirm('저장에 실패했습니다. 그래도 목록으로 돌아가시겠습니까?\n(변경사항이 손실될 수 있습니다)')) {
          return;
        }
      }
    }
    TM.currentProject = null;
    TM.renderDashboard();
  };
  
  // 주기적 자동저장 (30초)
  TM.startAutoSave = function() {
    if (TM.autoSaveTimer) clearInterval(TM.autoSaveTimer);
    TM.autoSaveTimer = setInterval(async () => {
      if (TM.currentProject && TM.hasUnsavedChanges) {
        console.log('[TM] 자동 저장 중...');
        try {
          await TM.saveProject();
          TM.hasUnsavedChanges = false;
          console.log('[TM] 자동 저장 완료');
        } catch (e) {
          console.warn('[TM] 자동 저장 실패:', e);
        }
      }
    }, 30000);
  };
  
  TM.stopAutoSave = function() {
    if (TM.autoSaveTimer) {
      clearInterval(TM.autoSaveTimer);
      TM.autoSaveTimer = null;
    }
  };
  
  // 변경 감지 플래그
  TM.hasUnsavedChanges = false;

  // ============================================================
  // 7. 워크스페이스 렌더링 (좌측 사이드바 + 우측 메인)
  // ============================================================
  
  TM.renderWorkspace = function() {
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel || !TM.currentProject) return;
    
    panel.innerHTML = `
      <div class="tm-app-layout">
        <!-- 좌측 사이드바 -->
        <aside class="tm-sidebar">
          <div class="tm-sidebar-header">
            <button class="tm-back-btn" data-action="tm-back-to-list">
              <span>←</span> 목록으로
            </button>
          </div>
          
          <div class="tm-sidebar-project">
            <div class="tm-project-icon">🏷️</div>
            <div class="tm-project-info">
              <h3 id="tm-project-title">${TM.escapeHtml(TM.currentProject.trademarkName || TM.currentProject.title || '새 상표')}</h3>
              <span class="tm-status-badge ${TM.currentProject.status}">${TM.getStatusLabel(TM.currentProject.status)}</span>
            </div>
          </div>
          
          <!-- 저장 버튼 별도 영역 -->
          <div class="tm-sidebar-save">
            <button class="tm-save-btn-large" data-action="tm-save-project">
              💾 저장하기
            </button>
          </div>
          
          <nav class="tm-step-nav">
            ${TM.steps.map(step => `
              <button class="tm-step-item ${step.id === TM.currentStep ? 'active' : ''} ${TM.isStepCompleted(step.id) ? 'completed' : ''}"
                      data-action="tm-goto-step" data-step="${step.id}">
                <span class="tm-step-num">${step.id}</span>
                <span class="tm-step-name">${step.name}</span>
                ${TM.isStepCompleted(step.id) ? '<span class="tm-step-check">✓</span>' : ''}
              </button>
            `).join('')}
          </nav>
          
          <div class="tm-sidebar-footer">
            <div class="tm-progress">
              <div class="tm-progress-bar" style="width: ${TM.getProgressPercent()}%"></div>
            </div>
            <span class="tm-progress-text">${TM.getCompletedSteps()}/${TM.steps.length} 완료</span>
          </div>
        </aside>
        
        <!-- 우측 메인 영역 -->
        <main class="tm-main">
          <div class="tm-main-header">
            <h2>${TM.steps[TM.currentStep - 1]?.icon || ''} ${TM.steps[TM.currentStep - 1]?.name || ''}</h2>
            <!-- 헤더에 네비게이션 버튼 추가 -->
            <div class="tm-header-nav">
              <button class="btn btn-sm btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
                ← 이전
              </button>
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
                다음 →
              </button>
            </div>
          </div>
          
          <div class="tm-main-content" id="tm-step-content">
            <!-- 스텝 컨텐츠 동적 렌더링 -->
          </div>
          
          <!-- 하단 네비게이션 (스크롤 시에도 보임) -->
          <div class="tm-main-footer">
            <button class="btn btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
              ← 이전 단계
            </button>
            <div class="tm-footer-center">
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-ghost" data-action="tm-save-project">💾 저장</button>
            </div>
            <button class="btn btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
              다음 단계 →
            </button>
          </div>
        </main>
      </div>
    `;
    
    // 현재 스텝 컨텐츠 렌더링
    TM.renderCurrentStep();
  };
  
  TM.getProgressPercent = function() {
    return Math.round((TM.getCompletedSteps() / TM.steps.length) * 100);
  };
  
  TM.getCompletedSteps = function() {
    let count = 0;
    TM.steps.forEach(step => {
      if (TM.isStepCompleted(step.id)) count++;
    });
    return count;
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
      case 7: // 우선심사 - 사용자가 명시적으로 선택 여부를 결정해야 완료
        return TM.currentProject.priorityExam.userConfirmed === true;
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
    // 사이드바 스텝 상태 업데이트
    const stepItems = document.querySelectorAll('.tm-step-item');
    stepItems.forEach(item => {
      const stepNum = parseInt(item.dataset.step);
      item.classList.toggle('active', stepNum === TM.currentStep);
      item.classList.toggle('completed', TM.isStepCompleted(stepNum));
    });
    
    // 메인 헤더 업데이트
    const mainHeader = document.querySelector('.tm-main-header h2');
    if (mainHeader) {
      const step = TM.steps[TM.currentStep - 1];
      mainHeader.textContent = `${step?.icon || ''} ${step?.name || ''}`;
    }
    
    // 하단 버튼 상태
    const prevBtn = document.querySelector('[data-action="tm-prev-step"]');
    const nextBtn = document.querySelector('[data-action="tm-next-step"]');
    if (prevBtn) prevBtn.disabled = TM.currentStep === 1;
    if (nextBtn) nextBtn.disabled = TM.currentStep === TM.steps.length;
    
    // 인디케이터
    const indicator = document.querySelector('.tm-step-indicator');
    if (indicator) indicator.textContent = `${TM.currentStep} / ${TM.steps.length}`;
    
    // 진행률 업데이트
    const progressBar = document.querySelector('.tm-progress-bar');
    const progressText = document.querySelector('.tm-progress-text');
    if (progressBar) progressBar.style.width = `${TM.getProgressPercent()}%`;
    if (progressText) progressText.textContent = `${TM.getCompletedSteps()}/${TM.steps.length} 완료`;
  };
  
  TM.renderCurrentStep = function() {
    const stepEl = document.getElementById('tm-step-content');
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
  
  // AI 응답 JSON 안전 파싱
  TM.safeJsonParse = function(text) {
    // JSON 블록 추출
    let jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) {
      throw new Error('JSON을 찾을 수 없습니다.');
    }
    
    // 1차 시도: 그대로 파싱
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // 2차 시도: 정리 후 파싱
    }
    
    // JSON 정리 (trailing comma, 제어문자 제거)
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ');
    
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('[TM] JSON 파싱 최종 실패:', jsonStr.slice(0, 300));
      throw new Error('AI 응답 형식 오류. 다시 시도해주세요.');
    }
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
    
    // 변경 플래그 설정
    TM.hasUnsavedChanges = true;
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
  // Step 1: 상표 정보 입력 (2-column 레이아웃)
  // ============================================================
  
  TM.renderStep1_TrademarkInfo = function(container) {
    const p = TM.currentProject;
    const hasAiResult = p.aiAnalysis.businessAnalysis;
    
    container.innerHTML = `
      <div class="tm-2col">
        <!-- 좌측: 입력 영역 -->
        <div class="tm-col">
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3>🏷️ 상표 기본 정보</h3>
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
              
              <!-- 상표명 + 견본 -->
              <div class="tm-field-row">
                <div class="tm-field" style="flex:3">
                  <label>상표명 <span class="required">*</span></label>
                  <input type="text" class="tm-input tm-input-lg" data-field="trademarkName" 
                         value="${TM.escapeHtml(p.trademarkName)}" 
                         placeholder="한글, 영문, 한자 등">
                </div>
                <div class="tm-field" style="flex:1">
                  <label>견본</label>
                  <div class="tm-specimen" onclick="document.getElementById('tm-specimen-input').click()">
                    ${p.specimenUrl ? `<img src="${p.specimenUrl}" alt="견본">` : `<span style="font-size:24px">🖼️</span>`}
                  </div>
                  <input type="file" id="tm-specimen-input" data-field="specimen" 
                         accept="image/jpeg,image/png,image/gif" style="display:none">
                </div>
              </div>
            </div>
          </div>
          
          <!-- AI 분석 입력 -->
          <div class="tm-panel tm-panel-highlight">
            <div class="tm-panel-header">
              <h3>🤖 AI 사업 분석</h3>
              <span class="tm-badge tm-badge-primary">추천</span>
            </div>
            <div class="tm-panel-body">
              <p class="tm-hint">사업 내용을 입력하면 AI가 상품류와 지정상품을 추천합니다.</p>
              <div class="tm-ai-input">
                <input type="text" class="tm-input" id="tm-business-url" 
                       value="${TM.escapeHtml(p.businessDescription || '')}"
                       placeholder="예: 소프트웨어 개발, 특허 출원 대행">
                <button class="btn btn-primary" data-action="tm-analyze-business">🔍 분석</button>
              </div>
            </div>
          </div>
          
          <!-- 출원인 정보 -->
          <details class="tm-panel">
            <summary class="tm-panel-header">
              <h3>👤 출원인 정보</h3>
              <span class="tm-badge tm-badge-gray">${p.applicant.name ? '입력됨' : '선택'}</span>
            </summary>
            <div class="tm-panel-body">
              <div class="tm-field-grid">
                <div class="tm-field">
                  <label>성명/상호</label>
                  <input type="text" class="tm-input" data-field="applicant.name" 
                         value="${TM.escapeHtml(p.applicant.name)}" placeholder="홍길동">
                </div>
                <div class="tm-field">
                  <label>유형</label>
                  <select class="tm-input" data-field="applicant.type">
                    <option value="individual" ${p.applicant.type === 'individual' ? 'selected' : ''}>개인</option>
                    <option value="corporation" ${p.applicant.type === 'corporation' ? 'selected' : ''}>법인</option>
                    <option value="sme" ${p.applicant.type === 'sme' ? 'selected' : ''}>중소기업</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </div>
        
        <!-- 우측: 결과 영역 -->
        <div class="tm-col">
          ${hasAiResult ? `
            <div class="tm-panel">
              <div class="tm-panel-header">
                <h3>📋 분석 결과</h3>
              </div>
              <div class="tm-panel-body">
                <div class="tm-summary">${TM.escapeHtml(p.aiAnalysis.businessAnalysis)}</div>
                ${p.aiAnalysis.coreKeywords?.length > 0 ? `
                  <div class="tm-keywords">
                    ${p.aiAnalysis.coreKeywords.slice(0, 6).map(k => `<span class="tm-kw">${k}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
            
            <div class="tm-panel">
              <div class="tm-panel-header">
                <h3>🎯 추천 상품류</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">✓ 전체 적용</button>
              </div>
              <div class="tm-panel-body">
                <p style="font-size: 13px; color: #6b7684; margin: 0 0 16px;">AI가 분석한 결과, 아래 상품류가 사업에 적합합니다. <strong>적용</strong> 버튼을 클릭하면 지정상품에 추가됩니다.</p>
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
                            <div class="tm-rec-goods-label">추천 지정상품:</div>
                            <div class="tm-rec-tags">
                              ${goods.slice(0, 4).map(g => `<span>${g.name || g}</span>`).join('')}
                              ${goods.length > 4 ? `<span class="more">+${goods.length - 4}개 더</span>` : ''}
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
                <div class="tm-empty-icon">🔍</div>
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
            <!-- AI 추천 상품류 (상세 표시) -->
            <div class="tm-panel tm-panel-ai">
              <div class="tm-panel-header">
                <h3>🤖 AI 추천 상품류</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">✓ 전체 적용</button>
              </div>
              <div class="tm-ai-rec-desc">
                사업 분석 결과, 아래 상품류가 적합합니다. <strong>+</strong> 버튼을 클릭하면 추가됩니다.
              </div>
              <div class="tm-ai-rec-list">
                ${p.aiAnalysis.recommendedClasses.slice(0, 5).map((code, idx) => {
                  const isAdded = p.designatedGoods.some(g => g.classCode === code);
                  const reason = p.aiAnalysis.classReasons?.[code] || '';
                  const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
                  
                  return `
                    <div class="tm-ai-rec-item ${isAdded ? 'added' : ''}">
                      <div class="tm-ai-rec-num">${idx + 1}</div>
                      <div class="tm-ai-rec-content">
                        <div class="tm-ai-rec-class">
                          <strong>제${code}류</strong> ${TM.niceClasses[code] || ''}
                        </div>
                        ${reason ? `<div class="tm-ai-rec-reason">${TM.escapeHtml(reason.slice(0, 80))}${reason.length > 80 ? '...' : ''}</div>` : ''}
                        ${recGoods.length > 0 ? `
                          <div class="tm-ai-rec-goods">
                            <span class="label">추천 지정상품:</span>
                            ${recGoods.slice(0, 3).map(g => `<span class="tag">${g.name || g}</span>`).join('')}
                            ${recGoods.length > 3 ? `<span class="more">+${recGoods.length - 3}</span>` : ''}
                          </div>
                        ` : ''}
                      </div>
                      <div class="tm-ai-rec-action">
                        ${isAdded ? '<span class="applied">✓ 적용됨</span>' : 
                          `<button class="btn btn-primary btn-sm" data-action="tm-apply-recommendation" data-class-code="${code}">+ 추가</button>`}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- 전체 상품류 그리드 -->
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3>📋 전체 상품류</h3>
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
              <h3>✅ 선택된 지정상품</h3>
              <div class="tm-selected-stats">
                <span class="tm-stat-item"><strong>${p.designatedGoods.length}</strong>류</span>
                <span class="tm-stat-item"><strong>${totalGoods}</strong>개 상품</span>
                <span class="tm-stat-item"><strong>${allSimilarGroups.size}</strong>개 유사군</span>
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
                  <div class="icon">📦</div>
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
                <h3>✏️ 비고시명칭 직접 입력 <span class="optional">(선택)</span></h3>
              </div>
              <div class="tm-custom-term-info">
                <p>고시명칭에 없는 상품/서비스명을 직접 입력할 수 있습니다.</p>
                <p class="tm-custom-term-fee">💰 비고시명칭 사용 시 류당 <strong>+6,000원</strong> (52,000원/류)</p>
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
              ${term.riskLevel === 'high' ? '<span class="risk-warn">⚠️ 보정 가능성 높음</span>' : ''}
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
                    data-class="${term.classCode}" data-name="${TM.escapeHtml(term.name)}">✕</button>
          </div>
        `).join('')}
      </div>
    `;
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
              ${analysis.riskAnalysis.risks.map(r => `<span class="risk-item">⚠️ ${r}</span>`).join('')}
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
          <button class="btn-icon-sm" data-action="tm-remove-class" data-class-code="${classData.classCode}" title="삭제">✕</button>
        </div>
        
        ${similarGroups.size > 0 ? `
          <div class="tm-goods-similar">
            <span class="label">유사군:</span>
            ${Array.from(similarGroups).map(sg => `<span class="sg-tag">${sg}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="tm-goods-input-area">
          <input type="text" class="tm-goods-search-input" 
                 placeholder="지정상품명 검색 (자동완성)"
                 data-class="${classData.classCode}">
        </div>
        
        <div class="tm-goods-chips">
          ${classData.goods.length === 0 ? 
            '<span class="tm-goods-empty">지정상품을 추가하세요</span>' : 
            classData.goods.map(g => `
              <span class="tm-goods-chip ${g.isCustom ? 'custom' : ''} ${g.riskLevel === 'high' ? 'high-risk' : ''}">
                ${TM.escapeHtml(g.name)}
                ${g.isCustom ? '<span class="chip-badge custom">비고시</span>' : ''}
                ${g.similarGroup ? `<small>(${g.similarGroup})</small>` : ''}
                <button class="remove" data-action="${g.isCustom ? 'tm-remove-custom-term' : 'tm-remove-good'}" data-class="${classData.classCode}" data-name="${TM.escapeHtml(g.name)}">×</button>
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
            ✕ 제거
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
    
    // 상품류 추가
    const newClass = {
      classCode: classCode,
      className: TM.niceClasses[classCode],
      goods: recommendedGoods.map(g => ({
        name: g.name,
        similarGroup: g.similarGroup,
        gazetted: true
      })),
      goodsCount: recommendedGoods.length,
      nonGazettedCount: 0
    };
    
    p.designatedGoods.push(newClass);
    
    TM.renderCurrentStep();
    App.showToast(`제${classCode}류가 추가되었습니다.`, 'success');
  };
  
  // 전체 AI 추천 적용
  TM.applyAllRecommendations = function() {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    const recommendedClasses = p.aiAnalysis?.recommendedClasses || [];
    
    if (recommendedClasses.length === 0) {
      App.showToast('추천 상품류가 없습니다.', 'warning');
      return;
    }
    
    let addedCount = 0;
    
    recommendedClasses.forEach(classCode => {
      if (!p.designatedGoods.some(g => g.classCode === classCode)) {
        const recommendedGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
        
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
        
        addedCount++;
      }
    });
    
    TM.renderCurrentStep();
    App.showToast(`${addedCount}개 상품류가 추가되었습니다.`, 'success');
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
        .eq('class_code', classCode.padStart(2, '0'))
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
      
      // DB에서 직접 검색 (캐시 사용 안함)
      let results = [];
      try {
        const { data, error } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, goods_name_en, similar_group_code')
          .eq('class_code', classCode)
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
        <h3>🔍 선행상표 검색</h3>
        <p>출원 전 유사 상표가 있는지 검색합니다. <strong>2-Stage AI 검색 엔진</strong>이 문자+도형을 병렬 분석합니다.</p>
      </div>
      
      <!-- 선택된 지정상품 요약 -->
      ${classList.length > 0 ? `
        <div class="tm-selected-summary">
          <div class="tm-summary-header">
            <span class="tm-summary-title">📦 선택된 지정상품</span>
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
          ⚠️ 지정상품을 먼저 선택해주세요. 유사군 코드 기반 검색이 더 정확합니다.
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
            ${classList.length > 0 ? `
              <div class="tm-search-row">
                <div class="input-group" style="flex: 1;">
                  <label>검색 범위</label>
                  <select class="tm-input" id="tm-search-scope">
                    <option value="all">전체 상품류</option>
                    <option value="selected" selected>선택한 류만 (${classList.map(c => '제'+c+'류').join(', ')})</option>
                  </select>
                </div>
              </div>
            ` : ''}
            
            <div class="tm-search-actions">
              <button class="btn btn-primary btn-lg" data-action="tm-search-text">
                🔍 상표 검색
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
            <div class="tm-search-actions">
              <button class="btn btn-primary" data-action="tm-search-figure">
                🔍 도형 검색
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
    
    // 결과 요약 통계
    const highRiskCount = allResults.filter(r => r.isHighRisk || r.riskLevel === 'high').length;
    const mediumRiskCount = allResults.filter(r => r.riskLevel === 'medium').length;
    
    return `
      <!-- 검색 결과 요약 -->
      <div class="tm-search-summary">
        <div class="tm-summary-stat">
          <span class="tm-stat-num">${allResults.length}</span>
          <span class="tm-stat-label">총 결과</span>
        </div>
        ${highRiskCount > 0 ? `
          <div class="tm-summary-stat risk-high">
            <span class="tm-stat-num">${highRiskCount}</span>
            <span class="tm-stat-label">⚠️ 고위험</span>
          </div>
        ` : ''}
        ${mediumRiskCount > 0 ? `
          <div class="tm-summary-stat risk-medium">
            <span class="tm-stat-num">${mediumRiskCount}</span>
            <span class="tm-stat-label">주의</span>
          </div>
        ` : ''}
      </div>
      
      <!-- 결과 목록 -->
      <div class="tm-results-list">
        ${allResults.map((r, idx) => TM.renderSearchResultItem(r, idx + 1)).join('')}
      </div>
    `;
  };
  
  // 개별 검색 결과 아이템 렌더링
  TM.renderSearchResultItem = function(r, rank) {
    const score = r.similarityScore || 0;
    const riskLevel = r.riskLevel || (score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low');
    const riskClass = riskLevel === 'high' ? 'risk-high' : riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
    
    return `
      <div class="tm-search-result-item ${riskClass}" data-id="${r.applicationNumber}">
        <!-- 순위 & 위험도 -->
        <div class="tm-result-rank">
          <span class="tm-rank-num">${rank}</span>
          ${r.isHighRisk || riskLevel === 'high' ? '<span class="tm-risk-icon">⚠️</span>' : ''}
        </div>
        
        <!-- 상표 이미지 -->
        <div class="tm-result-image">
          ${r.drawing || r.drawingUrl ? 
            `<img src="${r.drawing || r.drawingUrl}" alt="상표 이미지" onerror="this.outerHTML='<span>🏷️</span>'">` : 
            '<span>🏷️</span>'}
        </div>
        
        <!-- 상표 정보 -->
        <div class="tm-result-info">
          <div class="tm-result-title">${TM.escapeHtml(r.title || r.trademarkName || '(명칭없음)')}</div>
          <div class="tm-result-meta">
            <span class="tm-meta-item">📋 ${r.applicationNumber || '-'}</span>
            <span class="tm-meta-item">📅 ${r.applicationDate || '-'}</span>
            ${r.applicantName ? `<span class="tm-meta-item">👤 ${TM.escapeHtml(r.applicantName)}</span>` : ''}
          </div>
          <div class="tm-result-tags">
            <span class="tm-result-status ${TM.getStatusClass(r.applicationStatus)}">
              ${r.applicationStatus || '-'}
            </span>
            ${r.classificationCode ? `
              <span class="tm-result-class">제${r.classificationCode}류</span>
            ` : ''}
            ${r._isIntersection ? '<span class="tm-result-intersection">문자+도형</span>' : ''}
          </div>
        </div>
        
        <!-- 유사도 점수 -->
        <div class="tm-result-score">
          ${score > 0 ? `
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
              <div class="tm-score-bar" title="범위 ${r.scoreBreakdown?.scope || 0}%">
                <span class="tm-bar-label">범위</span>
                <div class="tm-bar-track"><div class="tm-bar-fill" style="width: ${r.scoreBreakdown?.scope || 0}%"></div></div>
              </div>
            </div>
          ` : `
            <button class="btn btn-sm btn-secondary" 
                    data-action="tm-evaluate-similarity" 
                    data-target-id="${r.applicationNumber}">
              유사도 평가
            </button>
          `}
        </div>
        
        <!-- 위험 사유 -->
        ${r.riskReason ? `
          <div class="tm-result-reason">
            <span class="tm-reason-text">${TM.escapeHtml(r.riskReason)}</span>
          </div>
        ` : ''}
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
    const searchScope = document.getElementById('tm-search-scope')?.value || 'all';
    const p = TM.currentProject;
    
    // 선택된 상품류와 유사군 수집
    const targetClasses = [];
    const targetGroups = [];
    p.designatedGoods?.forEach(classData => {
      targetClasses.push(classData.classCode);
      classData.goods?.forEach(g => {
        if (g.similarGroup) {
          g.similarGroup.split(',').forEach(sg => targetGroups.push(sg.trim()));
        }
      });
    });
    
    try {
      // 검색 버튼 비활성화 & 로딩 표시
      const searchBtn = document.querySelector('[data-action="tm-search-text"]');
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '🔄 검색 중...';
      }
      
      // 프로그레스 표시
      const progressEl = document.getElementById('tm-search-progress');
      if (progressEl) progressEl.style.display = 'block';
      
      App.showToast('선행상표 검색 중... (최대 30초 소요)', 'info');
      
      // 2-Stage 검색 엔진 호출
      const results = await TM.searchPriorMarks({
        trademark: keyword,
        viennaCodes: p.aiAnalysis.viennaCodeSuggestion?.map(v => v.code) || [],
        targetClasses: searchScope === 'selected' ? targetClasses : [],
        targetGroups: targetGroups,
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
        searchBtn.innerHTML = '🔍 상표 검색';
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
            body: { type: 'test', params: {} }
          });
          console.log('[KIPRIS] Edge Function 테스트 결과:', testResult);
        } catch (testErr) {
          console.error('[KIPRIS] ❌ Edge Function 연결 실패:', testErr);
        }
      }
      
      // 동시성 제한 + 재시도 적용
      return await TM.throttledCall(() => TM.withRetry(async () => {
        console.log('[KIPRIS] 📡 Edge Function 호출...');
        
        const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
          body: { type, params }
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
          params: { applicationNumber } 
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
          const results = await TM.callKiprisAPI('text', {
            searchString: q.query,
            application: statusFilter !== 'registered_only',
            registration: true,
            refused: statusFilter === 'all',
            numOfRows: 50
          }, { useRecent: true, recentYears });
          
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
          const results = await TM.callKiprisAPI('text', {
            searchString: q.query,
            application: statusFilter !== 'registered_only',
            registration: true,
            refused: statusFilter === 'all',
            numOfRows: 50
          });
          
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
  
  TM.calculateStatusScore = function(status) {
    if (!status) return 0.5;
    if (status.includes('등록')) return 1.0;
    if (status.includes('출원')) return 0.8;
    if (status.includes('공고')) return 0.7;
    if (status.includes('거절') || status.includes('취하') || status.includes('소멸')) return 0.2;
    return 0.5;
  };
  
  // ====== Stage B: 상세 검증 & Re-rank ======
  
  TM.rankAndFilter = function(candidates, sourceText, viennaCodes, targetClasses, targetGroups, topK = 200) {
    // 점수 계산
    for (const r of candidates) {
      // S_text (문자 유사도): 0.38
      r._scoreText = TM.calculateTextSimilarity(sourceText, r.title || r.trademarkName);
      
      // S_logo (도형 유사도): 0.32
      r._scoreVienna = viennaCodes && r.viennaCode 
        ? TM.calculateViennaSimilarity(viennaCodes, r.viennaCode) 
        : 0;
      
      // S_scope (범위 유사도): 0.25
      r._scoreScope = TM.calculateScopeSimilarity(
        targetClasses, targetGroups, 
        r.classificationCode, r.similarityGroup
      );
      
      // S_status (상태): 0.05
      r._scoreStatus = TM.calculateStatusScore(r.applicationStatus);
      
      // 최종 점수
      r._totalScore = (r._scoreText * 0.38) + 
                      (r._scoreVienna * 0.32) + 
                      (r._scoreScope * 0.25) + 
                      (r._scoreStatus * 0.05);
      
      // 교집합 후보 부스트
      if (r._isIntersection) {
        r._totalScore *= 1.2;
      }
    }
    
    // 정렬 및 상위 K개 반환
    candidates.sort((a, b) => b._totalScore - a._totalScore);
    
    console.log(`[KIPRIS] 랭킹 완료: Top ${Math.min(topK, candidates.length)}건 반환`);
    
    return candidates.slice(0, topK);
  };
  
  // ====== 메인 검색 함수 (통합 2-Stage) ======
  
  TM.searchPriorMarks = async function(options = {}) {
    const {
      trademark,
      viennaCodes = [],
      targetClasses = [],
      targetGroups = [],
      statusFilter = 'registered',
      topK = 30,
      fetchDetails = true,  // Stage B 상세 조회 여부
      onProgress = null     // 진행상황 콜백
    } = options;
    
    console.log('[KIPRIS] ═══════════════════════════════════════');
    console.log('[KIPRIS] 선행상표 검색 시작');
    console.log('[KIPRIS] 입력:', { trademark, viennaCodes, targetClasses: targetClasses.length, targetGroups: targetGroups.length });
    console.log('[KIPRIS] ═══════════════════════════════════════');
    
    try {
      // ===== Stage A: 후보 회수 =====
      const candidates = await TM.retrieveCandidates(
        trademark, viennaCodes, targetClasses,
        { 
          statusFilter,
          onProgress: onProgress ? (step, total, msg) => onProgress(step, total + 2, msg) : null
        }
      );
      
      if (candidates.length === 0) {
        console.log('[KIPRIS] 검색 결과 없음');
        return [];
      }
      
      // ===== Stage B-1: 1차 랭킹 (K0 = 200) =====
      onProgress?.(8, 10, '유사도 계산 중...');
      
      const ranked = TM.rankAndFilter(
        candidates, trademark, viennaCodes, 
        targetClasses, targetGroups,
        200 // K0
      );
      
      // 교집합 후보 우선 정렬
      ranked.sort((a, b) => {
        // 교집합 최우선
        if (a._isIntersection && !b._isIntersection) return -1;
        if (!a._isIntersection && b._isIntersection) return 1;
        // 그 다음 점수순
        return b._totalScore - a._totalScore;
      });
      
      // ===== Stage B-2: 상세 조회 (K1 = 30) =====
      let detailedResults = ranked.slice(0, topK);
      
      if (fetchDetails && detailedResults.length > 0) {
        onProgress?.(9, 10, '상세 정보 조회 중...');
        detailedResults = await TM.fetchDetailsForTopK(detailedResults, topK);
        
        // 상세 정보로 재계산 (유사군 코드가 추가됨)
        for (const r of detailedResults) {
          if (r.similarityGroup) {
            r._scoreScope = TM.calculateScopeSimilarity(
              targetClasses, targetGroups,
              r.classificationCode, r.similarityGroup
            );
            r._totalScore = (r._scoreText * 0.38) + 
                            (r._scoreVienna * 0.32) + 
                            (r._scoreScope * 0.25) + 
                            (r._scoreStatus * 0.05);
            if (r._isIntersection) r._totalScore *= 1.2;
          }
        }
        
        // 최종 재정렬
        detailedResults.sort((a, b) => b._totalScore - a._totalScore);
      }
      
      // ===== 최종 결과 포맷팅 =====
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
        isHighRisk: r._isIntersection || r._totalScore >= 0.7,
        riskLevel: r._totalScore >= 0.8 ? 'high' : 
                   r._totalScore >= 0.5 ? 'medium' : 'low',
        riskReason: TM.generateRiskReason(r, trademark, targetClasses)
      }));
      
      console.log('[KIPRIS] ═══════════════════════════════════════');
      console.log(`[KIPRIS] 최종 결과: ${results.length}건`);
      console.log('[KIPRIS] 고위험:', results.filter(r => r.isHighRisk).length, '건');
      console.log('[KIPRIS] ═══════════════════════════════════════');
      
      return results;
      
    } catch (error) {
      console.error('[KIPRIS] 검색 실패:', error);
      throw error;
    }
  };
  
  // 위험 사유 생성 (LLM 없이 규칙 기반)
  TM.generateRiskReason = function(result, sourceMark, targetClasses) {
    const reasons = [];
    
    // 교집합 (문자+도형 모두 유사)
    if (result._isIntersection) {
      reasons.push('문자와 도형이 모두 유사');
    }
    
    // 문자 유사도
    if (result._scoreText >= 0.8) {
      reasons.push('상표명 매우 유사');
    } else if (result._scoreText >= 0.6) {
      reasons.push('상표명 유사');
    }
    
    // 범위 유사도
    if (result._scoreScope >= 0.7) {
      reasons.push('지정상품 범위 중복');
    }
    
    // 상태
    if (result.applicationStatus?.includes('등록')) {
      reasons.push('등록상표');
    }
    
    if (reasons.length === 0) {
      return result.riskLevel === 'low' ? '유사도 낮음' : '주의 필요';
    }
    
    return reasons.join(', ');
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
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>⚖️ 유사도 평가</h3>
        <p>AI가 선행상표와의 유사도를 외관, 호칭, 관념 기준으로 평가합니다.</p>
      </div>
      
      <!-- 출원상표 정보 -->
      <div class="tm-similarity-info-card">
        <div class="tm-sim-source">
          <div class="tm-sim-label">출원 상표</div>
          <div class="tm-sim-trademark">
            ${p.specimenUrl ? `<img src="${p.specimenUrl}" alt="출원상표" class="tm-sim-img">` : ''}
            <span class="tm-sim-name">${TM.escapeHtml(p.trademarkName || '(미입력)')}</span>
          </div>
        </div>
      </div>
      
      <!-- 평가 대상 선택 -->
      <div class="tm-form-section">
        <div class="tm-section-header">
          <h4>📋 평가 대상 선행상표</h4>
          <span class="tm-badge">${allSearchResults.length}건</span>
        </div>
        
        ${allSearchResults.length === 0 ? `
          <div class="tm-empty-state" style="padding: 32px;">
            <div class="icon">🔍</div>
            <h4>선행상표 검색이 필요합니다</h4>
            <p>먼저 선행상표 검색을 실행한 후 유사도를 평가하세요.</p>
            <button class="btn btn-primary" data-action="tm-goto-step" data-step="3">
              선행상표 검색 →
            </button>
          </div>
        ` : `
          <!-- 전체 평가 버튼 & 프로그레스 -->
          <div class="tm-eval-control">
            <button class="btn btn-primary" id="tm-eval-all-btn" data-action="tm-evaluate-all-similarity">
              🤖 전체 AI 평가 실행
            </button>
            <div class="tm-eval-progress" id="tm-eval-progress" style="display: none;">
              <div class="tm-progress-bar">
                <div class="tm-progress-fill" id="tm-progress-fill"></div>
              </div>
              <div class="tm-progress-text" id="tm-progress-text">0 / ${allSearchResults.length}</div>
            </div>
          </div>
          
          <!-- 선행상표 목록 (간결한 표시) -->
          <div class="tm-target-list-compact">
            ${allSearchResults.map((r, idx) => {
              const evaluated = evaluations.find(e => e.targetId === r.applicationNumber);
              return `
                <div class="tm-target-row ${evaluated ? 'evaluated' : ''}">
                  <div class="tm-target-num">${idx + 1}</div>
                  <div class="tm-target-main">
                    <span class="tm-target-name">${TM.escapeHtml(r.title || r.trademarkName || '(명칭없음)')}</span>
                    <span class="tm-target-app-no">${r.applicationNumber}</span>
                  </div>
                  <div class="tm-target-action">
                    ${evaluated ? `
                      <span class="tm-eval-badge-sm ${evaluated.overall}">
                        ${TM.getSimilarityLabel(evaluated.overall)}
                      </span>
                    ` : `
                      <button class="btn btn-sm btn-ghost" 
                              data-action="tm-evaluate-similarity" 
                              data-target-id="${r.applicationNumber}">
                        평가
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
      
      <!-- 평가 결과 상세 -->
      ${evaluations.length > 0 ? `
        <div class="tm-form-section">
          <div class="tm-section-header">
            <h4>📊 평가 결과 상세</h4>
            <span class="tm-badge">${evaluations.length}건 완료</span>
          </div>
          <div class="tm-eval-results">
            ${evaluations.map(e => TM.renderEvaluationDetail(e)).join('')}
          </div>
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
            <div class="tm-notes-title">💡 평가 근거</div>
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

      const response = await App.callClaude(prompt, 1000);
      
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
      btn.innerHTML = '⏳ 평가 중...';
    }
    if (progressEl) progressEl.style.display = 'flex';
    
    let completed = 0;
    const total = allResults.length;
    
    for (const target of allResults) {
      try {
        await TM.evaluateSimilarityQuiet(target.applicationNumber);
        completed++;
        
        // 프로그레스 업데이트
        if (progressFill) progressFill.style.width = `${(completed / total) * 100}%`;
        if (progressText) progressText.textContent = `${completed} / ${total}`;
        
      } catch (error) {
        console.error('[TM] 개별 평가 실패:', error);
      }
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 완료
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🤖 전체 AI 평가 실행';
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

    const response = await App.callClaude(prompt, 1000);
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
        <button class="btn btn-primary btn-lg" id="tm-risk-btn" data-action="tm-assess-risk">
          🤖 AI 리스크 종합 평가
        </button>
        <div class="tm-risk-progress" id="tm-risk-progress" style="display: none;">
          <div class="tm-progress-bar">
            <div class="tm-progress-fill tm-progress-indeterminate"></div>
          </div>
          <span class="tm-progress-text">AI가 종합 분석 중입니다...</span>
        </div>
        <p class="tm-hint" id="tm-risk-hint">유사도 평가 결과, 지정상품 중복 여부, 상표 유형 등을 종합 분석합니다.</p>
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
              <h5>📋 상세 분석</h5>
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
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
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
        <p>2026년 기준 관납료 및 예상 비용을 계산합니다. (상표 출원료는 감면 없음)</p>
      </div>
      
      <!-- 우선심사 여부 -->
      <div class="tm-form-section">
        <label class="tm-checkbox-label">
          <input type="checkbox" id="tm-priority-exam-enabled" 
                 ${p.priorityExam?.enabled ? 'checked' : ''}
                 onchange="TM.togglePriorityExam(this.checked)">
          <span>우선심사 신청 (류당 160,000원 추가)</span>
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
            <tr><td>우선심사 신청료</td><td>160,000원/류</td><td>-</td></tr>
            <tr><td>등록료 (10년)</td><td>211,000원/류</td><td>참고</td></tr>
          </table>
          <p style="margin-top: 12px; font-size: 13px; color: #6b7684;">※ 상표 출원료는 특허와 달리 감면 제도가 없습니다.</p>
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
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>⚡ 우선심사 신청 여부 결정</h3>
        <p>상표를 사용 중이거나 사용 준비 중인 경우 우선심사를 신청할 수 있습니다.</p>
      </div>
      
      <!-- 우선심사 선택 -->
      <div class="tm-form-section tm-priority-choice">
        <h4>우선심사 신청 여부를 선택해주세요</h4>
        
        <div class="tm-choice-cards">
          <div class="tm-choice-card ${pe.enabled ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="true">
            <div class="tm-choice-icon">⚡</div>
            <div class="tm-choice-title">우선심사 신청</div>
            <div class="tm-choice-desc">
              심사 기간: <strong>2~3개월</strong><br>
              추가 비용: 160,000원/류
            </div>
            ${pe.enabled ? '<div class="tm-choice-check">✓</div>' : ''}
          </div>
          
          <div class="tm-choice-card ${pe.enabled === false && isConfirmed ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="false">
            <div class="tm-choice-icon">📋</div>
            <div class="tm-choice-title">일반 심사</div>
            <div class="tm-choice-desc">
              심사 기간: <strong>12~14개월</strong><br>
              추가 비용: 없음
            </div>
            ${pe.enabled === false && isConfirmed ? '<div class="tm-choice-check">✓</div>' : ''}
          </div>
        </div>
        
        ${!isConfirmed ? `
          <div class="tm-choice-hint">
            ⚠️ 우선심사 신청 여부를 선택해야 다음 단계로 진행할 수 있습니다.
          </div>
        ` : ''}
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
    TM.currentProject.priorityExam.userConfirmed = true; // 사용자가 명시적으로 선택
    TM.hasUnsavedChanges = true;
    TM.calculateFee(); // 비용 재계산
    TM.renderCurrentStep();
  };
  
  // 우선심사 선택 카드 클릭
  TM.setPriorityChoice = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.currentProject.priorityExam.userConfirmed = true;
    TM.hasUnsavedChanges = true;
    TM.calculateFee();
    TM.renderCurrentStep();
    App.showToast(enabled ? '우선심사 신청으로 설정되었습니다.' : '일반 심사로 설정되었습니다.', 'success');
  };
  
  TM.updatePriorityReason = function(reason) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.reason = reason;
    TM.hasUnsavedChanges = true;
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
      
      pe.generatedDocument = response.text;
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
  // 1. 비즈니스 분석 (상품류 + 지정상품 추천) - 완전 재설계 v3
  // ============================================================
  // 핵심 원칙:
  // 1. 사업의 핵심 유사군코드를 먼저 파악
  // 2. 해당 유사군코드의 고시명칭을 우선 추천
  // 3. LLM은 번호로만 선택 (자체 생성 금지)
  // ============================================================
  
  TM.analyzeBusiness = async function() {
    const p = TM.currentProject;
    const businessInput = document.getElementById('tm-business-url')?.value?.trim();
    
    if (!businessInput && !p.trademarkName) {
      App.showToast('상표명 또는 사업 내용을 입력하세요.', 'warning');
      return;
    }
    
    try {
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="tossface">⏳</span> AI 분석 중...';
      }
      
      // ================================================================
      // 1단계: 사업 내용 분석 + 핵심 유사군코드 추정
      // ================================================================
      const analysisPrompt = `당신은 상표 출원 전문 변리사입니다. 고객의 사업을 분석하고 적합한 상품류와 유사군코드를 추천하세요.

【고객 정보】
- 상표명: ${p.trademarkName || '미정'}
- 사업 내용: ${businessInput || '미입력'}

【분석 요청】
1. 이 사업의 핵심이 무엇인지 파악하세요
2. 상표 출원 시 반드시 포함해야 할 핵심 유사군코드를 추정하세요

【유사군코드 참고 - 서비스업 예시】
- S1204: 법률서비스 (S120401: 법무, S120402: 변리, 특허대리)
- S1205: 컨설팅 (S120503: 지식재산권 컨설팅)
- G39: 소프트웨어, G42: 기술서비스
- S0601: 온라인서비스, S1213: 정보제공

【응답 형식 - JSON만】
{
  "businessSummary": "이 사업은 ... (핵심을 1문장으로)",
  "coreActivity": "주된 활동 (예: 특허출원대행, 소프트웨어개발, 교육서비스)",
  "recommendedClasses": ["45", "42", "35", "41", "09"],
  "classReasons": {
    "45": "추천 이유"
  },
  "coreSimilarGroups": ["S120402", "S120401", "S120503"],
  "searchKeywords": ["변리", "특허", "상표", "출원", "지식재산권"]
}`;

      if (btn) btn.innerHTML = '<span class="tossface">⏳</span> 사업 분석 중...';
      
      const analysisResponse = await App.callClaude(analysisPrompt, 2000);
      const text = analysisResponse.text || '';
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('AI 응답 파싱 실패');
      }
      
      const jsonStr = text.substring(startIdx, endIdx + 1)
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\n/g, ' ');
      
      const analysis = JSON.parse(jsonStr);
      
      // 사용자 입력에서 키워드 추출
      const userKeywords = TM.extractKeywordsFromInput(businessInput);
      const allKeywords = [...new Set([...userKeywords, ...(analysis.searchKeywords || [])])];
      
      console.log('[TM] ★ 사업 분석 완료');
      console.log('[TM] - 핵심 활동:', analysis.coreActivity);
      console.log('[TM] - 핵심 유사군:', analysis.coreSimilarGroups);
      console.log('[TM] - 검색 키워드:', allKeywords);
      
      p.aiAnalysis = {
        businessAnalysis: analysis.businessSummary || '',
        coreActivity: analysis.coreActivity || '',
        recommendedClasses: analysis.recommendedClasses || [],
        classReasons: analysis.classReasons || {},
        coreSimilarGroups: analysis.coreSimilarGroups || [],
        searchKeywords: allKeywords,
        recommendedGoods: {}
      };
      
      // ================================================================
      // 2단계: 각 류별 고시명칭 조회 + LLM 선택
      // ================================================================
      for (const classCode of p.aiAnalysis.recommendedClasses.slice(0, 5)) {
        const paddedCode = classCode.padStart(2, '0');
        
        try {
          if (btn) btn.innerHTML = `<span class="tossface">⏳</span> 제${classCode}류 분석 중...`;
          
          // 2-1. DB에서 고시명칭 조회 (유사군코드 우선)
          const candidates = await TM.fetchCandidatesWithSimilarGroups(
            paddedCode,
            p.aiAnalysis.coreSimilarGroups,
            allKeywords
          );
          
          console.log(`[TM] 제${classCode}류 후보: ${candidates.length}건`);
          
          if (candidates.length === 0) {
            p.aiAnalysis.recommendedGoods[classCode] = [];
            continue;
          }
          
          // 2-2. LLM에게 번호로 선택하도록 요청
          const selectedGoods = await TM.selectGoodsWithLLM(
            classCode,
            candidates,
            businessInput,
            analysis.coreActivity
          );
          
          p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
          
          console.log(`[TM] 제${classCode}류 최종: ${selectedGoods.length}건`);
          
        } catch (classError) {
          console.error(`[TM] 제${classCode}류 처리 실패:`, classError);
          p.aiAnalysis.recommendedGoods[classCode] = [];
        }
      }
      
      TM.renderCurrentStep();
      App.showToast('사업 분석 완료!', 'success');
      
    } catch (error) {
      console.error('[TM] 사업 분석 실패:', error);
      App.showToast('분석 실패: ' + error.message, 'error');
    } finally {
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'AI 분석 🔍';
      }
    }
  };
  
  // ================================================================
  // 사용자 입력에서 키워드 추출
  // ================================================================
  TM.extractKeywordsFromInput = function(input) {
    if (!input) return [];
    
    const keywords = [];
    const seen = new Set();
    
    const trimmed = input.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      keywords.push(trimmed);
      seen.add(trimmed.toLowerCase());
    }
    
    const words = input.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const suffixes = ['사업', '업', '사', '서비스', '회사', '업체'];
    
    words.forEach(word => {
      if (!seen.has(word.toLowerCase())) {
        keywords.push(word);
        seen.add(word.toLowerCase());
      }
      
      for (const suffix of suffixes) {
        if (word.endsWith(suffix) && word.length > suffix.length + 1) {
          const stem = word.slice(0, -suffix.length);
          if (stem.length >= 2 && !seen.has(stem.toLowerCase())) {
            keywords.push(stem);
            seen.add(stem.toLowerCase());
          }
        }
      }
    });
    
    return keywords.slice(0, 20);
  };
  
  // ================================================================
  // DB에서 고시명칭 조회 (직접 매칭 우선)
  // ================================================================
  TM.fetchCandidatesWithSimilarGroups = async function(classCode, coreSimilarGroups, keywords) {
    const results = [];
    const seen = new Set();
    
    console.log(`[TM] ════ DB 검색: 제${classCode}류 ════`);
    console.log(`[TM] 검색 키워드:`, keywords.slice(0, 5));
    
    // 1. 키워드 기반 검색
    for (const keyword of keywords.slice(0, 15)) {
      try {
        const { data, error } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode)
          .ilike('goods_name', `%${keyword}%`)
          .limit(50);
        
        if (error) {
          console.warn(`[TM] 키워드 검색 오류 (${keyword}):`, error.message);
          continue;
        }
        
        if (data && data.length > 0) {
          console.log(`[TM] 키워드 "${keyword}" → ${data.length}건`);
          
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              seen.add(item.goods_name);
              
              const nameLower = item.goods_name.toLowerCase();
              const kwLower = keyword.toLowerCase();
              
              // 우선순위 계산: 직접 매칭 > 시작 매칭 > 포함 매칭
              let priority = 3;
              if (nameLower === kwLower || nameLower === kwLower + '업') {
                priority = 0; // 최우선 (변리 → 변리업)
              } else if (nameLower.startsWith(kwLower)) {
                priority = 1; // 시작 매칭
              } else if (nameLower.includes(kwLower)) {
                priority = 2; // 포함 매칭
              }
              
              // 핵심 유사군 여부
              const isCoreSG = coreSimilarGroups?.some(sg => 
                item.similar_group_code?.includes(sg) || sg?.includes(item.similar_group_code)
              );
              if (isCoreSG) priority = Math.max(0, priority - 0.5);
              
              results.push({
                name: item.goods_name,
                similarGroup: item.similar_group_code,
                matchedKeyword: keyword,
                fromCoreSG: isCoreSG,
                priority: priority
              });
            }
          });
        }
      } catch (err) {
        console.warn(`[TM] 키워드 검색 실패 (${keyword}):`, err.message);
      }
    }
    
    console.log(`[TM] 키워드 검색 결과: ${results.length}건`);
    
    // 2. 핵심 유사군코드로 추가 검색
    if (coreSimilarGroups && coreSimilarGroups.length > 0) {
      for (const sgCode of coreSimilarGroups) {
        try {
          const { data } = await App.sb
            .from('gazetted_goods_cache')
            .select('goods_name, similar_group_code')
            .eq('class_code', classCode)
            .ilike('similar_group_code', `%${sgCode}%`)
            .limit(30);
          
          if (data && data.length > 0) {
            console.log(`[TM] 유사군 "${sgCode}" → ${data.length}건`);
            
            data.forEach(item => {
              if (!seen.has(item.goods_name)) {
                seen.add(item.goods_name);
                results.push({
                  name: item.goods_name,
                  similarGroup: item.similar_group_code,
                  fromCoreSG: true,
                  priority: 1.5
                });
              }
            });
          }
        } catch (err) {
          // 무시
        }
      }
    }
    
    // 3. 후보가 부족하면 해당 류 전체에서 추가
    if (results.length < 50) {
      try {
        console.log(`[TM] 후보 부족 (${results.length}건), 추가 조회...`);
        
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode)
          .limit(100);
        
        if (data) {
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              seen.add(item.goods_name);
              results.push({
                name: item.goods_name,
                similarGroup: item.similar_group_code,
                fromCoreSG: false,
                priority: 4
              });
            }
          });
        }
      } catch (err) {
        // 무시
      }
    }
    
    // ★ 우선순위순 정렬 (직접 매칭 → 시작 매칭 → 포함 매칭 → 기타)
    results.sort((a, b) => a.priority - b.priority);
    
    console.log(`[TM] 총 후보: ${results.length}건`);
    if (results.length > 0) {
      console.log(`[TM] 상위 5개: ${results.slice(0, 5).map(r => r.name).join(', ')}`);
    }
    
    return results;
  };
  
  // ================================================================
  // LLM에게 번호로만 선택하도록 요청 + 직접 매칭 상품 자동 포함
  // ================================================================
  TM.selectGoodsWithLLM = async function(classCode, candidates, businessText, coreActivity) {
    const MIN_GOODS = 10;
    const selected = [];
    const usedNames = new Set();
    
    // ★★★ 1. 사용자 입력과 직접 매칭되는 상품 자동 포함 (최우선) ★★★
    const inputKeywords = TM.extractKeywordsFromInput(businessText);
    console.log(`[TM] 직접 매칭 검색 키워드:`, inputKeywords);
    
    for (const keyword of inputKeywords) {
      const kwLower = keyword.toLowerCase();
      
      for (const c of candidates) {
        if (usedNames.has(c.name)) continue;
        
        const nameLower = c.name.toLowerCase();
        
        // 완전 일치 또는 "키워드+업" 패턴 (변리 → 변리업)
        if (nameLower === kwLower || 
            nameLower === kwLower + '업' ||
            nameLower === kwLower + '사업' ||
            nameLower.startsWith(kwLower + ' ') ||
            nameLower.startsWith(kwLower + '업') ||
            (nameLower.includes(kwLower) && nameLower.length <= kwLower.length + 5)) {
          
          console.log(`[TM] ★ 직접 매칭: "${keyword}" → "${c.name}"`);
          usedNames.add(c.name);
          selected.push({
            name: c.name,
            similarGroup: c.similarGroup,
            isCore: true,
            reason: `"${keyword}" 직접 매칭`
          });
          break; // 키워드당 1개만
        }
      }
    }
    
    console.log(`[TM] 직접 매칭 결과: ${selected.length}개`);
    
    // 이미 10개면 반환
    if (selected.length >= MIN_GOODS) {
      return selected.slice(0, MIN_GOODS);
    }
    
    // ★★★ 2. LLM 선택 (번호로만 응답) ★★★
    const remainingCandidates = candidates.filter(c => !usedNames.has(c.name));
    
    if (remainingCandidates.length > 0) {
      const numberedList = remainingCandidates.slice(0, 50).map((c, i) => 
        `[${i + 1}] ${c.name} (${c.similarGroup || '?'})${c.fromCoreSG ? ' ★' : ''}`
      ).join('\n');
      
      const selectPrompt = `사업: ${businessText}

【제${classCode}류 고시명칭】
${numberedList}

위 목록에서 사업과 관련된 ${MIN_GOODS - selected.length}개를 선택하세요.
★ 표시는 핵심 유사군입니다.

응답: 숫자만 쉼표로 (예: 1,2,3,4,5)
선택:`;

      try {
        const response = await App.callClaude(selectPrompt, 200);
        const responseText = (response.text || '').trim();
        
        console.log(`[TM] LLM 응답: "${responseText.substring(0, 80)}..."`);
        
        // 번호 파싱
        const numbers = responseText
          .replace(/[^\d,\s]/g, '')
          .split(/[,\s]+/)
          .map(n => parseInt(n.trim()))
          .filter(n => !isNaN(n) && n >= 1 && n <= remainingCandidates.length);
        
        console.log(`[TM] 파싱된 번호: ${numbers.length}개`);
        
        // 번호로 상품 추가
        const usedIndices = new Set();
        for (const num of numbers) {
          if (selected.length >= MIN_GOODS) break;
          if (usedIndices.has(num)) continue;
          
          usedIndices.add(num);
          const item = remainingCandidates[num - 1];
          if (!usedNames.has(item.name)) {
            usedNames.add(item.name);
            selected.push({
              name: item.name,
              similarGroup: item.similarGroup,
              isCore: item.fromCoreSG || false
            });
          }
        }
      } catch (err) {
        console.warn('[TM] LLM 선택 실패:', err.message);
      }
    }
    
    // ★★★ 3. 부족하면 우선순위순 보충 ★★★
    if (selected.length < MIN_GOODS) {
      console.log(`[TM] ${MIN_GOODS - selected.length}개 보충 필요`);
      
      for (const c of candidates) {
        if (selected.length >= MIN_GOODS) break;
        if (usedNames.has(c.name)) continue;
        
        usedNames.add(c.name);
        selected.push({
          name: c.name,
          similarGroup: c.similarGroup,
          isCore: c.fromCoreSG || false
        });
      }
    }
    
    console.log(`[TM] 제${classCode}류 최종: ${selected.length}개`);
    if (selected.length > 0) {
      console.log(`[TM]   → ${selected.slice(0, 3).map(s => s.name).join(', ')}...`);
    }
    
    return selected.slice(0, MIN_GOODS);
  };
  
  // 유사군코드 커버리지 최적화 선택
  TM.optimizeSimilarCodeCoverage = function(candidates, targetCount = 10, options = {}) {
    const { minPerCode = 1, maxPerCode = 2, priorityCodes = [] } = options;
    
    // 1. 유사군코드별 그룹핑
    const groupedByCode = {};
    candidates.forEach(c => {
      const code = c.similar_group_code || 'UNKNOWN';
      if (!groupedByCode[code]) groupedByCode[code] = [];
      groupedByCode[code].push(c);
    });
    
    // 2. 유사군코드 정렬 (우선순위 코드 먼저, 그 다음 최고점수 순)
    const codeList = Object.keys(groupedByCode).sort((a, b) => {
      const aPriority = priorityCodes.includes(a) ? 1 : 0;
      const bPriority = priorityCodes.includes(b) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      const scoreA = Math.max(...groupedByCode[a].map(g => g.score || 0));
      const scoreB = Math.max(...groupedByCode[b].map(g => g.score || 0));
      return scoreB - scoreA;
    });
    
    const selectedGoods = [];
    const usedCodes = new Map(); // code -> count
    
    // 3. 라운드 1: 각 유사군코드에서 최소 minPerCode개 선택
    for (const code of codeList) {
      if (selectedGoods.length >= targetCount) break;
      
      const sorted = groupedByCode[code].sort((a, b) => (b.score || 0) - (a.score || 0));
      const toSelect = Math.min(minPerCode, sorted.length);
      
      for (let i = 0; i < toSelect && selectedGoods.length < targetCount; i++) {
        selectedGoods.push({
          name: sorted[i].goods_name,
          similarGroup: sorted[i].similar_group_code,
          score: sorted[i].score,
          fitScore: sorted[i].fitScore,
          isCore: priorityCodes.includes(code) || sorted[i].score > 2,
          source: 'gazetted' // 고시명칭
        });
        usedCodes.set(code, (usedCodes.get(code) || 0) + 1);
      }
    }
    
    // 4. 라운드 2: 고득점 항목 추가 (targetCount까지)
    if (selectedGoods.length < targetCount) {
      const remaining = candidates
        .filter(c => !selectedGoods.some(s => s.name === c.goods_name))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      
      for (const c of remaining) {
        if (selectedGoods.length >= targetCount) break;
        
        const code = c.similar_group_code || 'UNKNOWN';
        const codeCount = usedCodes.get(code) || 0;
        
        // 같은 코드에서 maxPerCode 초과 시 스킵 (다양성 확보)
        if (codeCount >= maxPerCode) continue;
        
        selectedGoods.push({
          name: c.goods_name,
          similarGroup: c.similar_group_code,
          score: c.score,
          fitScore: c.fitScore,
          isCore: false,
          source: 'gazetted'
        });
        usedCodes.set(code, codeCount + 1);
      }
    }
    
    // 5. 커버리지 통계 생성
    const coverageStats = {
      totalSelected: selectedGoods.length,
      uniqueCodes: usedCodes.size,
      codeDistribution: Object.fromEntries(usedCodes)
    };
    
    console.log(`[TM] 커버리지 최적화: ${selectedGoods.length}개 선택, ${usedCodes.size}개 유사군 커버`);
    
    return { selectedGoods, coverageStats };
  };
  
  // ============================================================
  // 비고시명칭 처리 (사용자 직접 입력)
  // - 표준명칭 매핑
  // - 유사군코드 추정
  // - 리스크 경고
  // ============================================================
  
  TM.processCustomTerm = async function(rawTerm, classCode) {
    if (!rawTerm || rawTerm.trim().length < 2) {
      return { error: '지정상품명을 2자 이상 입력해주세요.' };
    }
    
    const normalizedTerm = TM.normalizeCustomTerm(rawTerm);
    console.log(`[TM] 비고시명칭 처리: "${rawTerm}" → "${normalizedTerm}"`);
    
    // 1. 표준명칭(고시명칭) 매핑 검색
    const mappingResults = await TM.findSimilarGazettedTerms(normalizedTerm, classCode);
    
    // 2. 신뢰도 계산
    const confidence = mappingResults.length > 0 ? mappingResults[0].similarity : 0;
    
    // 3. 유사군코드 추정
    let estimatedSimilarGroup = null;
    if (mappingResults.length > 0 && mappingResults[0].similarity >= 0.5) {
      estimatedSimilarGroup = mappingResults[0].similar_group_code;
    }
    
    // 4. 리스크 분석
    const riskAnalysis = TM.analyzeCustomTermRisk(normalizedTerm, confidence);
    
    // 5. 처리 권장사항 결정
    let recommendation = '';
    let status = 'warning';
    
    if (confidence >= 0.80) {
      recommendation = `표준명칭 "${mappingResults[0].goods_name}"으로 대체를 강력 권장합니다.`;
      status = 'replace_recommended';
    } else if (confidence >= 0.60) {
      recommendation = '비고시명칭 유지 가능하나, 보정 요청 가능성이 있습니다. 표준명칭 병기를 권장합니다.';
      status = 'usable_with_warning';
    } else if (confidence >= 0.40) {
      recommendation = '표준명칭과 매칭이 낮습니다. 심사 시 거절 또는 보정 가능성이 높습니다.';
      status = 'high_risk';
    } else {
      recommendation = '매칭되는 표준명칭을 찾기 어렵습니다. 명칭 재검토를 권장합니다.';
      status = 'very_high_risk';
    }
    
    return {
      originalTerm: rawTerm,
      normalizedTerm: normalizedTerm,
      confidence: confidence,
      estimatedSimilarGroup: estimatedSimilarGroup,
      mappingCandidates: mappingResults.slice(0, 3), // 상위 3개
      riskAnalysis: riskAnalysis,
      recommendation: recommendation,
      status: status,
      isGazetted: false, // 비고시명칭
      feeNote: '비고시명칭 사용 시 류당 +6,000원 (52,000원/류)'
    };
  };
  
  // 비고시명칭 정규화
  TM.normalizeCustomTerm = function(rawTerm) {
    let term = rawTerm.trim();
    
    // 1. 불필요한 문자 제거
    term = term.replace(/[""'']/g, '');
    term = term.replace(/\s+/g, ' ');
    
    // 2. 서비스업 표기 통일
    if (!term.endsWith('업') && !term.endsWith('품') && !term.endsWith('기') && !term.endsWith('기기')) {
      // 행위성 명사로 끝나면 '업' 추가 권장
      const serviceEndings = ['서비스', '제공', '중개', '대행', '컨설팅', '교육', '판매', '개발'];
      for (const ending of serviceEndings) {
        if (term.endsWith(ending)) {
          term = term + '업';
          break;
        }
      }
    }
    
    return term;
  };
  
  // 유사 고시명칭 검색 (텍스트 유사도 기반)
  TM.findSimilarGazettedTerms = async function(term, classCode) {
    const results = [];
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/[\s,/]+/).filter(w => w.length > 1);
    
    try {
      // 1. 부분 일치 검색
      const searchPromises = termWords.slice(0, 5).map(word =>
        App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode.padStart(2, '0'))
          .ilike('goods_name', `%${word}%`)
          .limit(20)
      );
      
      const searchResults = await Promise.all(searchPromises);
      const seen = new Set();
      
      searchResults.forEach(({ data }) => {
        if (data) {
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              seen.add(item.goods_name);
              
              // 유사도 계산 (단순 단어 겹침 기반)
              const gazettedLower = item.goods_name.toLowerCase();
              const gazettedWords = gazettedLower.split(/[\s,/]+/).filter(w => w.length > 1);
              
              // Jaccard 유사도 + 부분 일치 보너스
              const intersection = termWords.filter(w => 
                gazettedWords.some(gw => gw.includes(w) || w.includes(gw))
              ).length;
              const union = new Set([...termWords, ...gazettedWords]).size;
              let similarity = union > 0 ? intersection / union : 0;
              
              // 완전 포함 보너스
              if (gazettedLower.includes(termLower) || termLower.includes(gazettedLower)) {
                similarity += 0.3;
              }
              
              // 시작 일치 보너스
              if (gazettedLower.startsWith(termLower.substring(0, 3))) {
                similarity += 0.1;
              }
              
              similarity = Math.min(1, similarity);
              
              results.push({
                goods_name: item.goods_name,
                similar_group_code: item.similar_group_code,
                similarity: similarity
              });
            }
          });
        }
      });
      
      // 2. 유사도 순 정렬
      results.sort((a, b) => b.similarity - a.similarity);
      
    } catch (err) {
      console.error('[TM] 유사 명칭 검색 실패:', err);
    }
    
    return results.slice(0, 10);
  };
  
  // 비고시명칭 리스크 분석
  TM.analyzeCustomTermRisk = function(term, confidence) {
    const risks = [];
    const warnings = [];
    
    // 1. 과포괄 용어 체크
    const broadTerms = ['일반', '종합', '전반', '모든', '각종', '기타'];
    broadTerms.forEach(bt => {
      if (term.includes(bt)) {
        risks.push(`"${bt}" - 과포괄 용어로 보정 요청 가능성`);
      }
    });
    
    // 2. 불명확 표현 체크
    const vagueTerms = ['등', '및', '관련', '기반'];
    vagueTerms.forEach(vt => {
      if (term.includes(vt) && term.split(vt).length > 2) {
        warnings.push(`"${vt}" 다수 사용 - 명확성 검토 필요`);
      }
    });
    
    // 3. 서비스/상품 구분 체크
    const isService = term.endsWith('업') || term.endsWith('서비스');
    const isGoods = term.endsWith('품') || term.endsWith('기') || term.endsWith('기기') || term.endsWith('장치');
    
    if (!isService && !isGoods) {
      warnings.push('서비스업(~업)인지 상품(~품, ~기)인지 명확히 표기 권장');
    }
    
    // 4. 영문 혼용 체크
    if (/[a-zA-Z]/.test(term) && /[가-힣]/.test(term)) {
      warnings.push('한글/영문 혼용 - 심사 시 명확성 이슈 가능');
    }
    
    // 5. 길이 체크
    if (term.length > 30) {
      warnings.push('명칭이 길어 심사 시 축약 요청 가능성');
    }
    
    // 6. 신뢰도 기반 추가 리스크
    if (confidence < 0.40) {
      risks.push('표준명칭과 매칭도 낮음 - 거절 가능성 높음');
    }
    
    return {
      riskLevel: risks.length > 0 ? 'high' : (warnings.length > 0 ? 'medium' : 'low'),
      risks: risks,
      warnings: warnings
    };
  };
  
  // 비고시명칭을 프로젝트에 추가
  TM.addCustomTermToProject = async function(classCode, customTermResult) {
    const p = TM.currentProject;
    
    // 해당 류의 지정상품 배열 찾기
    let classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) {
      // 해당 류가 없으면 추가
      classData = {
        classCode: classCode,
        goods: [],
        goodsCount: 0
      };
      p.designatedGoods.push(classData);
    }
    
    // 중복 체크
    if (classData.goods.some(g => g.name === customTermResult.normalizedTerm)) {
      App.showToast('이미 추가된 지정상품입니다.', 'warning');
      return false;
    }
    
    // 비고시명칭 추가
    classData.goods.push({
      name: customTermResult.normalizedTerm,
      similarGroup: customTermResult.estimatedSimilarGroup || '(추정필요)',
      isGazetted: false,
      isCustom: true, // 사용자 직접 입력 표시
      confidence: customTermResult.confidence,
      mappingCandidates: customTermResult.mappingCandidates,
      riskLevel: customTermResult.riskAnalysis.riskLevel
    });
    
    classData.goodsCount = classData.goods.length;
    
    // 비고시명칭 사용 시 gazettedOnly 해제
    if (p.gazettedOnly) {
      p.gazettedOnly = false;
      App.showToast('비고시명칭 추가로 "비고시 허용" 모드로 변경되었습니다.', 'info');
    }
    
    TM.hasUnsavedChanges = true;
    
    return true;
  };
  
  // 비고시명칭 삭제
  TM.removeCustomTerm = function(classCode, termName) {
    const p = TM.currentProject;
    const classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) return;
    
    const idx = classData.goods.findIndex(g => g.name === termName && g.isCustom);
    if (idx !== -1) {
      classData.goods.splice(idx, 1);
      classData.goodsCount = classData.goods.length;
      TM.hasUnsavedChanges = true;
      
      App.showToast(`비고시명칭 "${termName}" 삭제됨`, 'info');
      TM.renderCurrentStep();
    }
  };
  
  // 비고시명칭을 표준명칭으로 대체
  TM.replaceCustomTerm = async function(classCode, oldTerm, newTerm) {
    const p = TM.currentProject;
    const classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) return;
    
    // 기존 비고시명칭 찾기
    const idx = classData.goods.findIndex(g => g.name === oldTerm && g.isCustom);
    if (idx === -1) return;
    
    // 새 표준명칭이 이미 있는지 확인
    if (classData.goods.some(g => g.name === newTerm)) {
      // 기존 비고시명칭만 삭제
      classData.goods.splice(idx, 1);
      App.showToast(`"${oldTerm}" 삭제됨 (표준명칭 "${newTerm}"이 이미 있음)`, 'info');
    } else {
      // DB에서 표준명칭 정보 조회
      try {
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode.padStart(2, '0'))
          .eq('goods_name', newTerm)
          .limit(1);
        
        if (data && data.length > 0) {
          // 표준명칭으로 대체
          classData.goods[idx] = {
            name: data[0].goods_name,
            similarGroup: data[0].similar_group_code,
            isGazetted: true,
            isCustom: false
          };
          App.showToast(`"${oldTerm}" → "${newTerm}" 대체됨 (표준명칭)`, 'success');
        } else {
          // DB에 없으면 그냥 이름만 변경
          classData.goods[idx].name = newTerm;
          classData.goods[idx].isCustom = false;
          App.showToast(`"${oldTerm}" → "${newTerm}" 변경됨`, 'info');
        }
      } catch (err) {
        console.error('[TM] 표준명칭 조회 실패:', err);
        classData.goods[idx].name = newTerm;
      }
    }
    
    classData.goodsCount = classData.goods.length;
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
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
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
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
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
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
      return response.text.trim();
      
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
      
      p.aiAnalysis.fullReport = response.text;
      App.showToast('보고서가 생성되었습니다.', 'success');
      
      return response;
      
    } catch (error) {
      console.error('[TM] 보고서 생성 실패:', error);
      App.showToast('생성 실패: ' + error.message, 'error');
      return null;
    }
  };

})();
