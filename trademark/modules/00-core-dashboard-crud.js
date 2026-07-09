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
    
    // 워크플로우 단계 정의 (6단계 — 우선심사는 별도 서브탭으로 분리)
    steps: [
      { id: 1, name: '상표 정보', icon: '<span class="ico" data-icon="tag"></span>', key: 'trademark_info' },
      { id: 2, name: '지정상품', icon: '<span class="ico" data-icon="box"></span>', key: 'designated_goods' },
      { id: 3, name: '선행상표 검색', icon: '<span class="ico" data-icon="search"></span>', key: 'prior_search' },
      { id: 4, name: '유사도 평가', icon: '<span class="ico" data-icon="scales"></span>', key: 'similarity' },
      { id: 5, name: '리스크 평가', icon: '<span class="ico" data-icon="chart"></span>', key: 'risk' },
      { id: 6, name: '종합 요약', icon: '<span class="ico" data-icon="clipboard"></span>', key: 'summary' }
    ],

    // 우선심사 서브탭 상태
    priorityTab: {
      currentProject: null,  // 현재 열린 우선심사 프로젝트
      initialized: false
    },
    
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
      apiKey: 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=', // 기본 키 (TM.init에서 계정별 키로 교체)
      rateLimit: 30, // 분당 호출 제한
      timeout: 10000
    },
    
    // Supabase 설정
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk',
    
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
      if (TM._initialized) {
        TM.renderDashboard();
        return;
      }
      if (TM._initializing) return;
      TM._initializing = true;

      // ★ 계정별 KIPRIS API 키 로드
      TM.loadKiprisKeyFromProfile();
      
      // 캐시 로드 (고시명칭, API 스펙)
      await TM.loadCaches();
      
      // 이벤트 리스너 등록
      TM.bindEvents();
      
      // 대시보드 렌더링
      TM.renderDashboard();
      TM._initialized = true;
      TM._initializing = false;
      
      console.log('[TM] 상표 모듈 초기화 완료');
    } catch (error) {
      TM._initializing = false;
      console.error('[TM] 초기화 실패:', error);
      App.showToast('상표 모듈 초기화 실패', 'error');
    }
  };
  
  // ★ 계정별 KIPRIS API 키 로드 (common.js 통합 관리와 동기화)
  TM.loadKiprisKeyFromProfile = function() {
    // common.js의 중앙 KIPRIS 키를 우선 참조
    if (typeof App.getKiprisKey === 'function') {
      var centralKey = App.getKiprisKey();
      if (centralKey) {
        TM.kiprisConfig.apiKey = centralKey;
        console.log('[TM] KIPRIS API 키: common.js 중앙 관리에서 동기화됨');
        return;
      }
    }
    
    // common.js 미로드 시 자체 로드 (폴백)
    const DEFAULT_KEY = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    const userId = App.currentUser?.id;
    
    // 1순위: 프로필 JSON에서 로드
    try {
      const rawKey = App.currentProfile?.api_key_encrypted || '';
      const pk = JSON.parse(rawKey);
      if (pk.kipris) {
        TM.kiprisConfig.apiKey = pk.kipris;
        console.log('[TM] KIPRIS API 키: 프로필에서 로드됨');
        if (userId) {
          try { localStorage.setItem('kipris_api_key_' + userId, pk.kipris); } catch(e) {}
          try { localStorage.setItem('tm_kipris_api_key_' + userId, pk.kipris); } catch(e) {}
        }
        return;
      }
    } catch(e) {}
    
    // 2순위: 계정별 localStorage 캐시 (통합 키 → tm_ 레거시 순)
    if (userId) {
      try {
        var cached = localStorage.getItem('kipris_api_key_' + userId) || localStorage.getItem('tm_kipris_api_key_' + userId);
        if (cached) {
          TM.kiprisConfig.apiKey = cached;
          console.log('[TM] KIPRIS API 키: localStorage 캐시에서 로드됨');
          return;
        }
      } catch(e) {}
    }
    
    // 3순위: 레거시 localStorage (계정 구분 없던 기존 키 → 마이그레이션)
    try {
      const legacyKey = localStorage.getItem('tm_kipris_api_key');
      if (legacyKey && legacyKey !== DEFAULT_KEY) {
        TM.kiprisConfig.apiKey = legacyKey;
        console.log('[TM] KIPRIS API 키: 레거시 localStorage에서 마이그레이션');
        TM.saveKiprisKeyToProfile(legacyKey).then(() => {
          try { localStorage.removeItem('tm_kipris_api_key'); } catch(e) {}
        });
        return;
      }
    } catch(e) {}
    
    // 4순위: 기본값
    TM.kiprisConfig.apiKey = DEFAULT_KEY;
    console.log('[TM] KIPRIS API 키: 기본값 사용');
  };
  
  // ★ KIPRIS API 키를 프로필(Supabase)에 저장 + common.js 동기화
  TM.saveKiprisKeyToProfile = async function(kiprisKey) {
    // common.js 중앙 관리에 동기화
    if (typeof App.saveKiprisKey === 'function') {
      await App.saveKiprisKey(kiprisKey);
      console.log('[TM] KIPRIS API 키: common.js 중앙 관리에 동기화 저장됨');
      return;
    }
    
    // common.js 미로드 시 자체 저장 (폴백)
    const userId = App.currentUser?.id;
    if (!userId) return;
    
    try {
      let existing = {};
      try { existing = JSON.parse(App.currentProfile?.api_key_encrypted || '{}'); } catch(e) {}
      existing.kipris = kiprisKey;
      
      await App.sb.from('profiles').update({
        api_key_encrypted: JSON.stringify(existing)
      }).eq('id', userId);
      
      if (App.currentProfile) {
        App.currentProfile.api_key_encrypted = JSON.stringify(existing);
      }
      
      // localStorage 캐시 (통합 + TM 호환)
      if (kiprisKey) {
        try { localStorage.setItem('kipris_api_key_' + userId, kiprisKey); } catch(e) {}
        try { localStorage.setItem('tm_kipris_api_key_' + userId, kiprisKey); } catch(e) {}
      } else {
        try { localStorage.removeItem('kipris_api_key_' + userId); } catch(e) {}
        try { localStorage.removeItem('tm_kipris_api_key_' + userId); } catch(e) {}
      }
      
      console.log('[TM] KIPRIS API 키: 프로필에 저장 완료');
    } catch(error) {
      console.error('[TM] KIPRIS API 키 프로필 저장 실패:', error);
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
    if (TM._eventsBound) return;
    TM._eventsBound = true;
    
    panel.addEventListener('click', TM.handleClick);
    panel.addEventListener('input', TM.handleInput);
    panel.addEventListener('change', TM.handleChange);
    
    // 브라우저 뒤로가기/앞으로가기 처리
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.tmModule) {
        if (e.state.view === 'dashboard') {
          // 대시보드로 돌아가기 (저장 없이)
          TM.currentProject = null;
          TM.renderDashboard(true); // skipHistory = true
        } else if (e.state.view === 'project' && e.state.projectId) {
          // 프로젝트 열기 (저장 없이)
          TM.openProject(e.state.projectId, true); // skipHistory = true
        }
      }
    });
    
    // 초기 상태 설정 (대시보드)
    if (!history.state || !history.state.tmModule) {
      history.replaceState({ tmModule: true, view: 'dashboard' }, '', window.location.href);
    }
    
    // 뒤로가기(Backspace) 키 처리 - 이전 스텝으로 이동
    document.addEventListener('keydown', (e) => {
      // input, textarea 등에서는 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Backspace 키
      if (e.key === 'Backspace') {
        e.preventDefault();
        
        // 프로젝트가 열려있고 스텝이 1보다 크면 이전 스텝으로
        if (TM.currentProject && TM.currentProject.currentStep > 1) {
          TM.prevStep();
        } else if (TM.currentProject) {
          // 스텝 1이면 대시보드로
          TM.backToList();
        }
      }
    });
  };
  
  TM.handleClick = function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.dataset.action;
    const params = { ...target.dataset };
    
    // 편집/삭제/제거 버튼은 이벤트 전파 중지 (카드 클릭과 충돌 방지)
    if (action === 'tm-edit-project' || action === 'tm-delete-project' || 
        action === 'tm-remove-goods' || action === 'tm-remove-class') {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // 카드 내부의 버튼 클릭 시, 카드 이벤트 무시
    if (target.tagName === 'BUTTON' && target.closest('.tm-project-card')) {
      // 버튼 클릭이면 카드의 open-project 실행 안 함
      if (action !== 'tm-open-project') {
        e.stopPropagation();
      }
    }
    
    console.log('[TM] Click action:', action, params);
    
    switch (action) {
      // 프로젝트 관련
      case 'tm-new-project':
        TM.createNewProject();
        break;
      case 'tm-open-settings':
        TM.openSettings();
        break;
      case 'tm-save-settings':
        TM.saveSettings();
        break;
      case 'tm-close-settings':
        TM.closeSettings();
        break;
      case 'tm-open-project':
        // 버튼이 아닌 카드 클릭인 경우에만 실행
        if (target.classList.contains('tm-project-card') || target.tagName === 'BUTTON') {
          TM.openProject(params.id);
        }
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
      case 'tm-toggle-expansion':
        TM.toggleExpansionClasses(e.target);
        break;
      case 'tm-request-more-recommendations':
        TM.requestMoreRecommendations();
        break;
      case 'tm-revalidate':
        TM.revalidateRecommendations();
        break;
      case 'tm-add-class':
        TM.addSuggestedClass(params.classCode);
        break;
      case 'tm-copy-goods':
        TM.copyDesignatedGoods();
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
        TM.generatePriorityDoc();
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

      // ─── 우선심사 서브탭 액션 ───
      case 'tm-pe-new-from-project':
        TM.showProjectImportModal();
        break;
      case 'tm-pe-new-from-upload':
        TM.createPriorityFromUpload();
        break;
      case 'tm-pe-import-select':
        TM.createPriorityFromProject(params.id);
        break;
      case 'tm-pe-open':
        TM.openPriorityProject(params.id);
        break;
      case 'tm-pe-delete':
        TM.deletePriorityProject(params.id);
        break;
      case 'tm-pe-back-to-list':
        TM.renderPriorityDashboard();
        break;
      case 'tm-pe-save':
        TM.savePriorityProject();
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
  
  TM.renderDashboard = async function(skipHistory = false) {
    const panel = document.getElementById('trademark-sub-application');
    if (!panel) return;

    // 서브탭 네비게이션 표시 복원
    TM.showSubTabNav(true);

    // 히스토리 관리 (브라우저 뒤로가기 지원)
    if (!skipHistory && TM.currentProject) {
      // 프로젝트에서 대시보드로 전환할 때만 히스토리 추가
      history.pushState({ tmModule: true, view: 'dashboard' }, '', window.location.href);
    }

    // 프로젝트 상태 초기화
    TM.currentProject = null;

    panel.innerHTML = `
      <div class="trademark-dashboard" style="max-width: var(--dt-max-w); margin: 0 auto; padding: 32px;">

        <!-- 통계 4카드 (실제 status enum: draft/searching/documenting/completed) -->
        <div class="tmd-stat-grid">
          <div class="tmd-stat-card">
            <div class="tmd-stat-label">전체</div>
            <div class="tmd-stat-value"><span id="tm-stat-total">0</span><span class="unit">건</span></div>
          </div>
          <div class="tmd-stat-card accent-brand">
            <div class="tmd-stat-label">작성 중</div>
            <div class="tmd-stat-value"><span id="tm-stat-draft">0</span><span class="unit">건</span></div>
          </div>
          <div class="tmd-stat-card accent-warning">
            <div class="tmd-stat-label">진행 중</div>
            <div class="tmd-stat-value"><span id="tm-stat-progress">0</span><span class="unit">건</span></div>
          </div>
          <div class="tmd-stat-card accent-success">
            <div class="tmd-stat-label">완료</div>
            <div class="tmd-stat-value"><span id="tm-stat-done">0</span><span class="unit">건</span></div>
          </div>
        </div>

        <div class="tmd-work-row">
          <!-- 좌측: 액션 컬럼 -->
          <aside class="tmd-action-col">
            <div>
              <h2 class="tmd-panel-title"><span class="ico" data-icon="tag"></span> 상표 출원 관리</h2>
              <p class="tmd-panel-desc">특허그룹 디딤 상표 출원 프로젝트를 관리합니다.</p>
            </div>
            <button class="btn btn-primary btn-full" onclick="window.TM.createNewProject(); return false;"><span class="ico" data-icon="plus"></span> 새 프로젝트</button>
            <button id="tm-settings-btn" class="btn btn-outline btn-full"><span class="ico" data-icon="settings" data-size="16"></span> 설정</button>

            <div class="tmd-kipris-note">
              <p class="tmd-kipris-title"><span class="ico" data-icon="lightbulb"></span> KIPRIS API 키 안내</p>
              <p class="tmd-kipris-body">선행상표 검색을 위해 KIPRIS API 키가 필요합니다. <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank">KIPRIS Plus</a>에서 발급받으세요.</p>
            </div>
          </aside>

          <!-- 우측: 프로젝트 목록 -->
          <main class="tmd-main-col">
            <div class="tmd-list-head">
              <h3>프로젝트 목록</h3>
              <div class="tmd-list-count" id="tm-project-count">총 0개</div>
            </div>
            <div class="tm-project-list" id="tm-project-list">
              <div style="text-align: center; padding: 40px; color: var(--dt-g500);">
                <div class="tm-loading-spinner" style="width: 32px; height: 32px; border: 3px solid var(--dt-g150); border-top-color: var(--dt-brand); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
                <p style="margin: 0;">프로젝트 목록 로딩 중...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    
    await TM.loadProjectList();
    
    // 설정 버튼 이벤트 바인딩
    const settingsBtn = document.getElementById('tm-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        TM.openSettings();
      });
    }
  };
  
  // ============================================================
  // 서브탭 네비게이션 표시/숨김
  // ============================================================

  TM.showSubTabNav = function(show) {
    const nav = document.querySelector('.trademark-sub-tab-nav');
    if (nav) nav.style.display = show ? '' : 'none';
  };

  // ============================================================
  // 우선심사 서브탭 (Priority Exam Sub-Tab)
  // ============================================================

  TM.initPriorityTab = function() {
    if (!TM.priorityTab) TM.priorityTab = { currentProject: null, initialized: false };
    TM.renderPriorityDashboard();
    TM.priorityTab.initialized = true;
  };

  // 우선심사 대시보드 렌더링
  TM.renderPriorityDashboard = async function() {
    const panel = document.getElementById('trademark-sub-priority');
    if (!panel) return;

    // 서브탭 네비게이션 표시 복원
    TM.showSubTabNav(true);

    // 우선심사 프로젝트 상태 초기화
    TM.priorityTab.currentProject = null;

    panel.innerHTML = `
      <div class="trademark-dashboard" style="max-width: var(--dt-max-w); margin: 0 auto; padding: 40px 32px;">
        <div style="display: flex; gap: 40px; align-items: flex-start;">
          <!-- 좌측 영역 -->
          <div style="flex-shrink: 0; width: 260px;">
            <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: var(--dt-g900);"><span class="ico" data-icon="bolt"></span> 우선심사 관리</h2>
            <p style="margin: 0 0 24px 0; color: var(--dt-g500); font-size: 13px; line-height: 1.5;">
              상표 우선심사 신청서를 작성합니다.<br>
              기존 사건에서 정보를 불러오거나,<br>출원서를 직접 업로드할 수 있습니다.
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button class="btn btn-primary" data-action="tm-pe-new-from-project"
                      style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; font-size: 14px; font-weight: 600; border-radius: 10px; box-shadow: var(--dt-sh-sm); white-space: nowrap; cursor: pointer;">
                <span class="ico" data-icon="folder" data-size="16"></span>
                기존 사건에서 불러오기
              </button>
              <button class="btn btn-secondary" data-action="tm-pe-new-from-upload"
                      style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13px; font-weight: 500; border-radius: 8px; background: var(--dt-g100); color: var(--dt-g700); border: 1px solid var(--dt-g150); white-space: nowrap; cursor: pointer;">
                <span class="ico" data-icon="doc" data-size="16"></span>
                출원서 업로드로 시작
              </button>
            </div>

            <!-- 안내 -->
            <div style="margin-top: 20px; padding: 12px; background: var(--dt-warning-light); border: 1px solid var(--dt-warning-light); border-radius: 8px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: var(--dt-warning);"><span class="ico" data-icon="lightbulb"></span> 우선심사란?</p>
              <p style="margin: 0; font-size: 11px; color: var(--dt-warning); line-height: 1.5;">
                일반 심사(12~14개월) 대비 2~3개월 내 심사가 진행됩니다.
                류당 160,000원의 추가 비용이 발생합니다.
              </p>
            </div>
          </div>

          <!-- 우측: 우선심사 프로젝트 목록 -->
          <div class="tm-project-list" id="tm-pe-project-list" style="flex: 1; min-width: 0;">
            <div style="text-align: center; padding: 40px; color: var(--dt-g500);">
              <div class="tm-loading-spinner" style="width: 32px; height: 32px; border: 3px solid var(--dt-g150); border-top-color: var(--dt-brand); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
              <p style="margin: 0;">우선심사 목록 로딩 중...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    await TM.loadPriorityProjectList();
  };

  // 우선심사 프로젝트 목록 로드 (trademark_projects에서 priorityExam.enabled = true이거나 pe_source_type 존재)
  TM.loadPriorityProjectList = async function() {
    const listEl = document.getElementById('tm-pe-project-list');
    if (!listEl) return;

    try {
      const { data: projects, error } = await App.sb
        .from('trademark_projects')
        .select('id, title, status, trademark_name, trademark_type, current_state_json, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // 우선심사 관련 프로젝트만 필터 (pe_source_type이 있는 것)
      const peProjects = (projects || []).filter(p => {
        const csj = p.current_state_json || {};
        return csj.pe_source_type;
      });

      if (peProjects.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 80px 20px; background: var(--dt-g50); border-radius: 16px; border: 2px dashed var(--dt-g300);">
            <div style="font-size: 56px; margin-bottom: 20px;"><span class="ico" data-icon="bolt" data-size="56"></span></div>
            <h4 style="margin: 0 0 12px; font-size: 20px; color: var(--dt-g700);">우선심사 프로젝트가 없습니다</h4>
            <p style="margin: 0 0 24px; color: var(--dt-g500); font-size: 15px;">기존 사건에서 불러오거나 출원서를 업로드하여 시작하세요.</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button class="btn btn-primary" data-action="tm-pe-new-from-project" style="padding: 12px 24px; font-size: 14px; border-radius: 10px;"><span class="ico" data-icon="folder"></span> 기존 사건에서 불러오기</button>
              <button class="btn btn-secondary" data-action="tm-pe-new-from-upload" style="padding: 12px 24px; font-size: 14px; border-radius: 10px;"><span class="ico" data-icon="doc"></span> 출원서 업로드</button>
            </div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="background: white; border-radius: 16px; border: 1px solid var(--dt-g150); overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="background: var(--dt-g50); border-bottom: 2px solid var(--dt-g150);">
                <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: var(--dt-g700); font-size: 13px;">관리번호</th>
                <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: var(--dt-g700); font-size: 13px;">상표명</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: var(--dt-g700); font-size: 13px; width: 90px;">소스</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: var(--dt-g700); font-size: 13px; width: 90px;">수정일</th>
                <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: var(--dt-g700); font-size: 13px; width: 120px;">작업</th>
              </tr>
            </thead>
            <tbody>
              ${peProjects.map(p => {
                const csj = p.current_state_json || {};
                const sourceLabel = csj.pe_source_type === 'project' ? '<span class="ico" data-icon="folder"></span> 사건연동' : '<span class="ico" data-icon="doc"></span> 업로드';
                const updatedAt = new Date(p.updated_at).toLocaleDateString('ko-KR');
                return `
                  <tr style="border-bottom: 1px solid var(--dt-g100); transition: background 0.15s;"
                      onmouseover="this.style.background='var(--dt-g50)'" onmouseout="this.style.background='white'">
                    <td style="padding: 12px 16px; font-size: 13px; color: var(--dt-g500);">${TM.escapeHtml(p.title || '-')}</td>
                    <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: var(--dt-g900);">${TM.escapeHtml(p.trademark_name || '-')}</td>
                    <td style="padding: 12px; text-align: center; font-size: 12px;">${sourceLabel}</td>
                    <td style="padding: 12px; text-align: center; font-size: 12px; color: var(--dt-g400);">${updatedAt}</td>
                    <td style="padding: 12px 16px; text-align: center;">
                      <button class="btn btn-sm btn-primary" data-action="tm-pe-open" data-id="${p.id}" style="padding: 6px 14px; font-size: 12px; border-radius: 6px;">열기</button>
                      <button class="btn btn-sm btn-ghost" data-action="tm-pe-delete" data-id="${p.id}" style="padding: 6px 10px; font-size: 12px; color: var(--dt-danger);">삭제</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 12px; text-align: right; color: var(--dt-g400); font-size: 12px;">총 ${peProjects.length}개 프로젝트</div>
      `;
    } catch (error) {
      console.error('[TM] 우선심사 목록 로드 실패:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--dt-danger-light); border-radius: 12px; border: 1px solid var(--dt-danger-light);">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <p style="margin: 0; color: var(--dt-danger);">${error.message}</p>
        </div>
      `;
    }
  };

  // 기존 사건에서 우선심사 프로젝트 생성 — 사건 선택 모달
  TM.showProjectImportModal = async function() {
    try {
      const { data: projects, error } = await App.sb
        .from('trademark_projects')
        .select('id, title, trademark_name, trademark_type, current_state_json, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // 이미 우선심사인 프로젝트는 제외하되, 일반 상표 출원 프로젝트만 표시
      const sourceProjects = (projects || []).filter(p => {
        const csj = p.current_state_json || {};
        return !csj.pe_source_type; // 우선심사 전용이 아닌 것만
      });

      if (sourceProjects.length === 0) {
        App.showToast('불러올 수 있는 상표 출원 사건이 없습니다. 먼저 상표 출원 탭에서 사건을 생성하세요.', 'warning');
        return;
      }

      const modal = document.createElement('div');
      modal.id = 'tm-pe-import-modal';
      modal.innerHTML = `
        <div class="tm-modal-overlay" onclick="document.getElementById('tm-pe-import-modal')?.remove()">
          <div class="tm-modal-content" onclick="event.stopPropagation()" style="max-width: 680px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="tm-modal-header">
              <h3 style="margin: 0; font-size: 18px; font-weight: 600;"><span class="ico" data-icon="folder"></span> 기존 사건에서 불러오기</h3>
              <button class="tm-modal-close" onclick="document.getElementById('tm-pe-import-modal')?.remove()"><span class="ico" data-icon="x"></span></button>
            </div>
            <div class="tm-modal-body" style="padding: 16px 24px; overflow-y: auto; flex: 1;">
              <p style="margin: 0 0 16px; font-size: 13px; color: var(--dt-g500);">
                아래 사건을 선택하면 상표명, 출원인, 지정상품 정보가 자동으로 입력됩니다.
              </p>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${sourceProjects.map(p => {
                  const goods = p.current_state_json?.designatedGoods || [];
                  const goodsCount = goods.reduce((sum, g) => sum + (g.goods?.length || 0), 0);
                  const classCount = goods.length;
                  return `
                    <div class="tm-pe-import-item" data-action="tm-pe-import-select" data-id="${p.id}"
                         style="display: flex; align-items: center; gap: 16px; padding: 14px 16px; border: 1px solid var(--dt-g150); border-radius: 10px; cursor: pointer; transition: all 0.15s;"
                         onmouseover="this.style.borderColor='var(--dt-brand)'; this.style.background='var(--dt-brand-pale)'"
                         onmouseout="this.style.borderColor='var(--dt-g150)'; this.style.background='white'">
                      <div style="flex-shrink: 0; width: 40px; height: 40px; background: var(--dt-brand-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;"><span class="ico" data-icon="tag" data-size="18"></span></div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 15px; font-weight: 600; color: var(--dt-g900);">${TM.escapeHtml(p.trademark_name || '(상표명 미입력)')}</div>
                        <div style="font-size: 12px; color: var(--dt-g500); margin-top: 2px;">
                          ${TM.escapeHtml(p.title || '(관리번호 없음)')}
                          ${classCount > 0 ? ` · 제${goods.map(g => g.classCode).join(',')}류 · ${goodsCount}개 상품` : ''}
                        </div>
                      </div>
                      <div style="flex-shrink: 0; font-size: 12px; color: var(--dt-g400);">${new Date(p.updated_at).toLocaleDateString('ko-KR')}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch(error) {
      console.error('[TM] 사건 목록 로드 실패:', error);
      App.showToast('사건 목록을 불러올 수 없습니다.', 'error');
    }
  };

  // 사건 선택 → 우선심사 프로젝트 생성
  TM.createPriorityFromProject = async function(sourceProjectId) {
    try {
      // 소스 프로젝트 로드
      const { data: source, error: loadErr } = await App.sb
        .from('trademark_projects')
        .select('*')
        .eq('id', sourceProjectId)
        .single();

      if (loadErr) throw loadErr;

      // current_state_json 또는 개별 컬럼에서 소스 데이터 읽기
      const stateJson = source.current_state_json || {};
      const srcTmName = stateJson.trademarkName || source.trademark_name || '';
      const srcTmNameEn = stateJson.trademarkNameEn || source.trademark_name_en || '';
      const srcTmType = stateJson.trademarkType || source.trademark_type || 'text';
      const srcGoods = stateJson.designatedGoods || [];
      const srcApplicant = stateJson.applicant || {};

      // 우선심사 프로젝트 데이터 구성
      const peData = JSON.parse(JSON.stringify(TM.defaultProjectData));
      peData.pe_source_type = 'project';
      peData.pe_source_project_id = sourceProjectId;

      // 소스에서 정보 복사
      peData.trademarkName = srcTmName;
      peData.trademarkNameEn = srcTmNameEn;
      peData.trademarkType = srcTmType;
      peData.designatedGoods = srcGoods;
      peData.applicant = srcApplicant;

      // priorityExam 초기화 (소스에서 출원인/상표 정보 매핑)
      peData.priorityExam = {
        enabled: true,
        userConfirmed: true,
        reason: '',
        reasonDetail: '',
        applicationNumber: '',
        applicationDate: '',
        applicantName: srcApplicant.name || '',
        trademarkNameFromApp: srcTmName,
        classCode: srcGoods.map(g => g.classCode).join(', '),
        designatedGoodsFromApp: srcGoods.flatMap(g => (g.goods || []).map(item => item.name)).join(', '),
        extractedFromApplication: false,
        editMode: false,
        useExtractedGoods: false,
        evidences: [],
        generatedDocument: ''
      };

      // DB에 새 프로젝트 생성
      const title = source.title ? `26T${source.title}` : `26T`;
      const { data: newProject, error: insertErr } = await App.sb
        .from('trademark_projects')
        .insert({
          owner_user_id: App.currentUser.id,
          title: title,
          trademark_name: peData.trademarkName,
          trademark_type: peData.trademarkType,
          status: 'documenting',
          current_state_json: peData
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 모달 닫기
      document.getElementById('tm-pe-import-modal')?.remove();

      App.showToast(`우선심사 프로젝트가 생성되었습니다: ${TM.escapeHtml(peData.trademarkName)}`, 'success');

      // 프로젝트 열기
      TM.openPriorityProject(newProject.id);
    } catch(error) {
      console.error('[TM] 우선심사 프로젝트 생성 실패:', error);
      App.showToast('프로젝트 생성 실패: ' + error.message, 'error');
    }
  };

  // 업로드 기반 우선심사 프로젝트 생성
  TM.createPriorityFromUpload = async function() {
    try {
      const peData = JSON.parse(JSON.stringify(TM.defaultProjectData));
      peData.pe_source_type = 'upload';

      peData.priorityExam = {
        enabled: true,
        userConfirmed: true,
        reason: '',
        reasonDetail: '',
        applicationNumber: '',
        applicationDate: '',
        applicantName: '',
        trademarkNameFromApp: '',
        classCode: '',
        designatedGoodsFromApp: '',
        extractedFromApplication: false,
        editMode: false,
        useExtractedGoods: false,
        evidences: [],
        generatedDocument: ''
      };

      const title = `26T`;
      const { data: newProject, error } = await App.sb
        .from('trademark_projects')
        .insert({
          owner_user_id: App.currentUser.id,
          title: title,
          trademark_name: '',
          trademark_type: 'text',
          status: 'documenting',
          current_state_json: peData
        })
        .select()
        .single();

      if (error) throw error;

      App.showToast('우선심사 프로젝트가 생성되었습니다. 출원서를 업로드하세요.', 'success');
      TM.openPriorityProject(newProject.id);
    } catch(error) {
      console.error('[TM] 우선심사 프로젝트 생성 실패:', error);
      App.showToast('프로젝트 생성 실패: ' + error.message, 'error');
    }
  };

  // 우선심사 프로젝트 열기
  TM.openPriorityProject = async function(projectId) {
    try {
      const { data, error } = await App.sb
        .from('trademark_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      // openProject와 동일한 로딩 패턴
      const merged = {
        id: data.id,
        title: data.title,
        status: data.status,
        ...JSON.parse(JSON.stringify(TM.defaultProjectData)),
        ...(data.current_state_json || {})
      };

      // 기존 필드 매핑
      if (data.trademark_name) merged.trademarkName = data.trademark_name;
      if (data.trademark_name_en) merged.trademarkNameEn = data.trademark_name_en;
      if (data.trademark_type) merged.trademarkType = data.trademark_type;
      if (data.applicant_info) merged.applicant = { ...merged.applicant, ...data.applicant_info };
      if (data.designated_goods) merged.designatedGoods = data.designated_goods;
      if (data.search_results) merged.searchResults = { ...merged.searchResults, ...data.search_results };
      if (data.fee_calculation) merged.feeCalculation = { ...merged.feeCalculation, ...data.fee_calculation };
      if (data.priority_exam) merged.priorityExam = { ...merged.priorityExam, ...data.priority_exam };
      if (data.ai_analysis) merged.aiAnalysis = { ...merged.aiAnalysis, ...data.ai_analysis };

      TM.priorityTab.currentProject = merged;

      // 서브탭 네비게이션 숨김
      TM.showSubTabNav(false);

      // 워크스페이스 렌더링
      TM.renderPriorityWorkspace();
    } catch(error) {
      console.error('[TM] 우선심사 프로젝트 열기 실패:', error);
      App.showToast('프로젝트 열기 실패: ' + error.message, 'error');
    }
  };

  // 우선심사 워크스페이스 렌더링
  TM.renderPriorityWorkspace = function() {
    const panel = document.getElementById('trademark-sub-priority');
    if (!panel || !TM.priorityTab.currentProject) return;

    const p = TM.priorityTab.currentProject;
    const pe = p.priorityExam || {};
    const sourceLabel = p.pe_source_type === 'project' ? '<span class="ico" data-icon="folder"></span> 기존 사건 연동' : '<span class="ico" data-icon="doc"></span> 출원서 업로드';

    panel.innerHTML = `
      <div class="tm-pe-workspace" style="max-width: 1000px; margin: 0 auto; padding: 32px 24px;">
        <!-- 헤더 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-ghost" data-action="tm-pe-back-to-list" style="padding: 8px 12px; font-size: 13px;"><span class="ico" data-icon="arrow-left"></span> 목록으로</button>
            <div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: var(--dt-g900);"><span class="ico" data-icon="bolt"></span> 우선심사 신청서</h2>
              <div style="font-size: 12px; color: var(--dt-g500); margin-top: 2px;">
                ${TM.escapeHtml(p.title || '')} · ${sourceLabel}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" data-action="tm-pe-save" style="padding: 8px 16px; font-size: 13px;"><span class="ico" data-icon="save"></span> 저장</button>
          </div>
        </div>

        <!-- 기본 정보 입력 -->
        <div style="background: linear-gradient(135deg, var(--dt-warning-light) 0%, var(--dt-warning-light) 100%); border: 1px solid var(--dt-warning); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1.5; min-width: 180px;">
              <label style="font-size: 11px; color: var(--dt-warning); font-weight: 600; display: block; margin-bottom: 4px;"><span class="ico" data-icon="tag"></span> 상표명</label>
              <input type="text" id="tm-pe-trademark-name"
                     value="${TM.escapeHtml(pe.trademarkNameFromApp || p.trademarkName || '')}"
                     placeholder="상표명을 입력하세요"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--dt-warning); border-radius: 6px; font-size: 14px; font-weight: 600; color: var(--dt-warning); background: rgba(255,255,255,0.7); box-sizing: border-box;">
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="font-size: 11px; color: var(--dt-warning); font-weight: 600; display: block; margin-bottom: 4px;"><span class="ico" data-icon="clipboard"></span> 출원번호</label>
              <input type="text" id="tm-pe-application-number"
                     value="${TM.escapeHtml(pe.applicationNumber || '')}"
                     placeholder="예: 40-2025-0012345"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--dt-warning); border-radius: 6px; font-size: 13px; color: var(--dt-warning); background: rgba(255,255,255,0.7); box-sizing: border-box;">
            </div>
            <div style="flex: 1; min-width: 150px;">
              <label style="font-size: 11px; color: var(--dt-warning); font-weight: 600; display: block; margin-bottom: 4px;"><span class="ico" data-icon="folder"></span> 사건번호</label>
              <input type="text" id="tm-pe-case-number"
                     value="${TM.escapeHtml(pe.caseNumber || p.title || '')}"
                     placeholder="예: 26T0001"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--dt-warning); border-radius: 6px; font-size: 13px; color: var(--dt-warning); background: rgba(255,255,255,0.7); box-sizing: border-box;">
            </div>
          </div>
        </div>

        <!-- 메인 컨텐츠 -->
        <div id="tm-pe-content">
          <!-- renderStep7_PriorityExam이 여기에 렌더링 -->
        </div>
      </div>
    `;

    // currentProject를 우선심사 프로젝트로 설정하여 기존 함수들이 동작하도록 함
    TM.currentProject = TM.priorityTab.currentProject;

    // 우선심사 컨텐츠 렌더링 (기존 renderStep7_PriorityExam 재사용)
    const contentEl = document.getElementById('tm-pe-content');
    if (contentEl) {
      TM.renderStep7_PriorityExam(contentEl);
    }

    // 기본 정보 입력 필드 이벤트 바인딩
    TM.bindPriorityInfoInputs();
  };

  // 우선심사 기본 정보 입력 필드 이벤트 바인딩
  TM.bindPriorityInfoInputs = function() {
    const nameInput = document.getElementById('tm-pe-trademark-name');
    const appNumInput = document.getElementById('tm-pe-application-number');
    const caseNumInput = document.getElementById('tm-pe-case-number');
    const p = TM.priorityTab.currentProject;
    if (!p) return;

    if (nameInput) {
      nameInput.addEventListener('input', function() {
        const val = this.value.trim();
        p.trademarkName = val;
        if (!p.priorityExam) p.priorityExam = {};
        p.priorityExam.trademarkNameFromApp = val;
        // 사이드바 상표명도 갱신
        const sidebarName = document.querySelector('.tm-project-name');
        if (sidebarName) sidebarName.textContent = val || '(상표명 미입력)';
        TM.debounceSave();
      });
    }

    if (appNumInput) {
      appNumInput.addEventListener('input', function() {
        if (!p.priorityExam) p.priorityExam = {};
        p.priorityExam.applicationNumber = this.value.trim();
        TM.debounceSave();
      });
    }

    if (caseNumInput) {
      caseNumInput.addEventListener('input', function() {
        p.title = this.value.trim();
        if (!p.priorityExam) p.priorityExam = {};
        p.priorityExam.caseNumber = this.value.trim();
        TM.debounceSave();
      });
    }
  };

  // 우선심사 정보 요약 배지 갱신
  TM.updatePrioritySummaryBadge = function() {
    // 워크스페이스 전체를 다시 그리지 않고, 입력 필드 값만 갱신
    const p = TM.priorityTab.currentProject || TM.currentProject;
    if (!p) return;
    const pe = p.priorityExam || {};

    const nameInput = document.getElementById('tm-pe-trademark-name');
    const appNumInput = document.getElementById('tm-pe-application-number');
    const caseNumInput = document.getElementById('tm-pe-case-number');

    if (nameInput && !nameInput.matches(':focus')) {
      nameInput.value = pe.trademarkNameFromApp || p.trademarkName || '';
    }
    if (appNumInput && !appNumInput.matches(':focus')) {
      appNumInput.value = pe.applicationNumber || '';
    }
    if (caseNumInput && !caseNumInput.matches(':focus')) {
      caseNumInput.value = pe.caseNumber || p.title || '';
    }
  };

  // 우선심사 프로젝트 저장 (공통 saveProject 위임)
  TM.savePriorityProject = async function() {
    if (!TM.priorityTab.currentProject) return;
    // currentProject가 이미 priorityTab.currentProject를 가리키므로 saveProject 재사용
    await TM.saveProject(false);
  };

  // 우선심사 프로젝트 삭제
  TM.deletePriorityProject = async function(projectId) {
    if (!confirm('이 우선심사 프로젝트를 삭제하시겠습니까?')) return;

    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      App.showToast('삭제되었습니다.', 'success');
      TM.renderPriorityDashboard();
    } catch(error) {
      console.error('[TM] 우선심사 프로젝트 삭제 실패:', error);
      App.showToast('삭제 실패: ' + error.message, 'error');
    }
  };

  // ============================================================
  // 설정 모달
  // ============================================================

  TM.openSettings = function() {
    const currentApiKey = TM.kiprisConfig.apiKey || '';
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'tm-settings-modal';
    modal.innerHTML = `
      <div class="tm-modal-overlay" onclick="TM.closeSettings()">
        <div class="tm-modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
          <div class="tm-modal-header">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600;"><span class="ico" data-icon="settings"></span> 상표 출원 설정</h3>
            <button class="tm-modal-close" onclick="TM.closeSettings()"><span class="ico" data-icon="x"></span></button>
          </div>
          
          <div class="tm-modal-body" style="padding: 24px;">
            <!-- KIPRIS API 키 설정 -->
            <div class="tm-settings-section">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: var(--dt-g700);">
                <span class="ico" data-icon="lock"></span> KIPRIS API 키
              </h4>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--dt-g500); line-height: 1.5;">
                선행상표 검색을 위해 KIPRIS OpenAPI 인증키가 필요합니다.<br>
                <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank" style="color: var(--dt-brand); text-decoration: underline;">
                  👉 KIPRIS Plus에서 무료 발급받기
                </a>
              </p>
              <input type="text" id="tm-settings-kipris-key" class="tm-input" 
                     value="${TM.escapeHtml(currentApiKey)}"
                     placeholder="API 키를 입력하세요"
                     style="width: 100%; font-size: 13px; padding: 10px 12px; border: 1px solid var(--dt-g300); border-radius: 6px;">
            </div>
            
            <!-- 자동 저장 설정 -->
            <div class="tm-settings-section" style="margin-top: 20px;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: var(--dt-g700);">
                <span class="ico" data-icon="save"></span> 자동 저장
              </h4>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--dt-g500); line-height: 1.5;">
                변경사항이 있을 경우 자동으로 저장됩니다.
              </p>
              <div style="font-size: 13px; color: var(--dt-g700); line-height: 1.6;">
                <div>• 입력 후 3초 후 자동 저장</div>
                <div>• 15초마다 주기적 저장</div>
              </div>
            </div>
            
            <!-- 현재 상태 -->
            <div class="tm-settings-section" style="margin-top: 20px; padding: 12px; background: var(--dt-g50); border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--dt-g700);">
                <span class="ico" data-icon="info"></span> 현재 상태
              </h4>
              <div style="font-size: 12px; color: var(--dt-g500); line-height: 1.6;">
                <div>• KIPRIS API 키: ${currentApiKey ? '<span class="ico" data-icon="check-circle"></span> 설정됨' : '<span class="ico" data-icon="x"></span> 미설정'}</div>
                <div>• 자동 저장: <span class="ico" data-icon="check-circle"></span> 활성화됨</div>
              </div>
            </div>
          </div>
          
          <div class="tm-modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--dt-g150); display: flex; justify-content: flex-end; gap: 12px;">
            <button class="btn btn-secondary" onclick="TM.closeSettings()" style="padding: 10px 20px; background: var(--dt-g100); color: var(--dt-g700); border: 1px solid var(--dt-g300); border-radius: 6px; cursor: pointer;">
              취소
            </button>
            <button class="btn btn-primary" onclick="TM.saveSettings()" style="padding: 10px 20px; background: var(--dt-brand); color: white; border: none; border-radius: 6px; cursor: pointer;">
              저장
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };
  
  TM.saveSettings = function() {
    const keyInput = document.getElementById('tm-settings-kipris-key');
    if (!keyInput) return;
    
    const newApiKey = keyInput.value.trim();
    const DEFAULT_KEY = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    
    if (newApiKey) {
      TM.kiprisConfig.apiKey = newApiKey;
      console.log('[TM] KIPRIS 키 저장:', newApiKey.slice(0,8) + '... → TM.kiprisConfig에 반영됨');
      
      // ★ 프로필(Supabase)에 계정별 저장 + common.js 동기화
      TM.saveKiprisKeyToProfile(newApiKey);
      
      App.showToast('KIPRIS API 키가 저장되었습니다.', 'success');
    } else {
      TM.kiprisConfig.apiKey = DEFAULT_KEY;
      
      // ★ 프로필에서도 삭제 + common.js 동기화
      TM.saveKiprisKeyToProfile('');
      
      App.showToast('기본 API 키로 복원되었습니다.', 'info');
    }
    
    TM.closeSettings();
  };
  
  TM.closeSettings = function() {
    const modal = document.getElementById('tm-settings-modal');
    if (modal) {
      modal.remove();
    }
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
        const _z=(id)=>{const e=document.getElementById(id);if(e)e.textContent='0';};
        _z('tm-stat-total');_z('tm-stat-draft');_z('tm-stat-progress');_z('tm-stat-done');
        const _pc0=document.getElementById('tm-project-count');if(_pc0)_pc0.textContent='총 0개';
        listEl.innerHTML = `
          <div style="text-align: center; padding: 80px 20px; background: var(--dt-g50); border-radius: 16px; border: 2px dashed var(--dt-g300);">
            <div style="font-size: 56px; margin-bottom: 20px;"><span class="ico" data-icon="tag" data-size="56"></span></div>
            <h4 style="margin: 0 0 12px; font-size: 20px; color: var(--dt-g700);">상표 프로젝트가 없습니다</h4>
            <p style="margin: 0 0 24px; color: var(--dt-g500); font-size: 15px;">새 프로젝트를 만들어 상표 출원을 시작하세요.</p>
            <button class="btn btn-primary" data-action="tm-new-project" style="padding: 14px 28px; font-size: 15px; border-radius: 10px;">+ 새 프로젝트 만들기</button>
          </div>
        `;
        return;
      }
      
      // 통계 4카드 — 실제 status enum 기준, 기존 배열 재사용 (신규 API 호출·하드코딩 숫자 없음)
      const _setStat=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      _setStat('tm-stat-total',projects.length);
      _setStat('tm-stat-draft',projects.filter(p=>p.status==='draft').length);
      _setStat('tm-stat-progress',projects.filter(p=>p.status==='searching'||p.status==='documenting').length);
      _setStat('tm-stat-done',projects.filter(p=>p.status==='completed').length);
      _setStat('tm-project-count','총 '+projects.length+'개');

      // 테이블 형식 목록
      listEl.innerHTML = `
        <div class="tmd-card" style="overflow: hidden;">
          <table class="tmd-table">
            <colgroup>
              <col style="width:16%"><col style="width:34%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:16%">
            </colgroup>
            <thead>
              <tr>
                <th>디딤 관리번호</th>
                <th>상표명</th>
                <th class="tmd-c">유형</th>
                <th class="tmd-c">상태</th>
                <th class="tmd-c">수정일</th>
                <th class="tmd-c">작업</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map(p => TM.renderProjectRow(p)).join('')}
            </tbody>
          </table>
        </div>
      `;
      
    } catch (error) {
      console.error('[TM] 프로젝트 목록 로드 실패:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--dt-danger-light); border-radius: 12px; border: 1px solid var(--dt-danger);">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <h4 style="margin: 0 0 8px; color: var(--dt-danger);">로드 실패</h4>
          <p style="margin: 0; color: var(--dt-danger);">${error.message}</p>
        </div>
      `;
    }
  };
  
  // 프로젝트 행 렌더링 (테이블용)
  TM.renderProjectRow = function(project) {
    const statusLabels = {
      draft: '작성 중',
      searching: '검색 중',
      documenting: '문서 작성',
      completed: '완료'
    };
    
    const statusClass = {
      draft: 's-draft',
      searching: 's-searching',
      documenting: 's-documenting',
      completed: 's-completed'
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
    const sCls = statusClass[project.status] || 's-draft';

    return `
      <tr class="tmd-case-row" onclick="TM.openProject('${project.id}')">
        <td><span class="tmd-case-no">${TM.escapeHtml(project.title || '(미지정)')}</span></td>
        <td><div class="tmd-case-name">${TM.escapeHtml(project.trademark_name || '-')}</div></td>
        <td class="tmd-c"><span class="tmd-case-type">${typeLabels[project.trademark_type] || '문자'}</span></td>
        <td class="tmd-c"><span class="tmd-badge ${sCls}"><span class="dot"></span>${statusLabels[project.status] || '작성 중'}</span></td>
        <td class="tmd-c"><span class="tmd-case-date">${updatedAt}</span></td>
        <td class="tmd-c" onclick="event.stopPropagation()">
          <div class="tmd-row-actions">
            <button class="btn btn-outline btn-sm" onclick="TM.openProject('${project.id}')">열기</button>
            <button class="btn btn-outline btn-sm" onclick="TM.editProject('${project.id}', '${TM.escapeHtml(project.title || '').replace(/'/g, "\\'")}')">편집</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="TM.deleteProject('${project.id}')">삭제</button>
          </div>
        </td>
      </tr>
    `;
  };

  // ============================================================
  // 6. 프로젝트 CRUD
  // ============================================================
  
  TM.createNewProject = async function() {
    // 년도 기반 기본값 생성 (26T 형식)
    const year = String(new Date().getFullYear()).slice(-2); // 26
    const defaultNumber = `${year}T`;
    
    const managementNumber = prompt(
      '디딤 관리번호를 입력하세요:\n(특허그룹 디딤 내부 사건 식별번호)\n\n예: 26T0001, 26T0002',
      defaultNumber
    );
    if (!managementNumber || !managementNumber.trim()) return;
    
    try {
      App.showToast('프로젝트 생성 중...', 'info');
      
      const { data, error } = await App.sb
        .from('trademark_projects')
        .insert({
          owner_user_id: App.currentUser.id,
          title: managementNumber.trim(),
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
  
  TM.openProject = async function(projectId, skipHistory = false) {
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
      TM.hasUnsavedChanges = false;
      
      // 히스토리 관리 (브라우저 뒤로가기 지원)
      if (!skipHistory) {
        history.pushState({ tmModule: true, view: 'project', projectId: projectId }, '', window.location.href);
      }
      
      // 워크스페이스 렌더링
      TM.renderWorkspace();
      
      // 자동 저장 시작
      TM.startAutoSave();
      
      App.showToast('프로젝트를 불러왔습니다.', 'success');
      
    } catch (error) {
      console.error('[TM] 프로젝트 열기 실패:', error);
      App.showToast('프로젝트 열기 실패: ' + error.message, 'error');
    }
  };
  
  TM.saveProject = async function(silent = false) {
    if (!TM.currentProject || !TM.currentProject.id) {
      if (!silent) App.showToast('저장할 프로젝트가 없습니다.', 'warning');
      return;
    }
    
    try {
      if (!silent) App.showToast('저장 중...', 'info');
      
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
        priority_exam: (() => {
          const pe = TM.currentProject.priorityExam;
          if (pe && pe.specimenImageDataUrl) { const copy = { ...pe }; delete copy.specimenImageDataUrl; return copy; }
          return pe;
        })(),
        ai_analysis: TM.currentProject.aiAnalysis,
        current_state_json: (() => {
          // specimenImageDataUrl은 큰 base64이므로 DB 저장에서 제외
          const pe = TM.currentProject.priorityExam;
          let peForSave = pe;
          if (pe && pe.specimenImageDataUrl) {
            peForSave = { ...pe };
            delete peForSave.specimenImageDataUrl;
          }
          return {
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
            priorityExam: peForSave,
            aiAnalysis: TM.currentProject.aiAnalysis,
            businessFiles: TM.currentProject.businessFiles,
            businessFileTexts: TM.currentProject.businessFileTexts
          };
        })(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await App.sb
        .from('trademark_projects')
        .update(updateData)
        .eq('id', TM.currentProject.id);
      
      if (error) throw error;
      
      TM.hasUnsavedChanges = false;
      if (!silent) {
        App.showToast('저장되었습니다.', 'success');
      } else {
        console.log('[TM] 자동 저장 완료');
      }
      
    } catch (error) {
      console.error('[TM] 저장 실패:', error);
      if (!silent) App.showToast('저장 실패: ' + error.message, 'error');
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
    const newTitle = prompt('디딤 관리번호를 수정하세요:\n\n예: 26T0001, 26T0002', currentTitle || '');
    if (!newTitle || newTitle === currentTitle) return;
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', projectId);
      
      if (error) throw error;
      
      App.showToast('관리번호가 변경되었습니다.', 'success');
      TM.loadProjectList();
      
    } catch (error) {
      console.error('[TM] 편집 실패:', error);
      App.showToast('편집 실패: ' + error.message, 'error');
    }
  };
  
  // 프로젝트 제목(관리번호) 업데이트 (상표 정보 탭에서 호출)
  TM.updateProjectTitle = async function(newTitle) {
    if (!TM.currentProject || !newTitle?.trim()) return;
    
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle === TM.currentProject.title) return;
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .update({ title: trimmedTitle, updated_at: new Date().toISOString() })
        .eq('id', TM.currentProject.id);
      
      if (error) throw error;
      
      TM.currentProject.title = trimmedTitle;
      TM.hasUnsavedChanges = true;
      
      // 사이드바 프로젝트명 업데이트
      const titleEl = document.querySelector('.tm-project-name');
      if (titleEl) titleEl.textContent = trimmedTitle;
      
    } catch (error) {
      console.error('[TM] 관리번호 업데이트 실패:', error);
    }
  };
  
  TM.backToList = async function() {
    // 자동 저장 타이머 중지
    TM.stopAutoSave();
    
    if (TM.currentProject && TM.hasUnsavedChanges) {
      // 변경사항이 있으면 저장
      try {
        App.showToast('변경사항 저장 중...', 'info');
        await TM.saveProject(false); // 토스트 표시
      } catch (error) {
        // 저장 실패 시 확인
        if (!confirm('저장에 실패했습니다. 그래도 목록으로 돌아가시겠습니까?\n(변경사항이 손실될 수 있습니다)')) {
          TM.startAutoSave(); // 자동 저장 재시작
          return;
        }
      }
    }
    
    TM.currentProject = null;
    TM.hasUnsavedChanges = false;
    TM.renderDashboard();
  };
  
  // 주기적 자동저장 (15초)
  TM.startAutoSave = function() {
    TM.stopAutoSave();
    TM.autoSaveTimer = setInterval(async () => {
      if (TM.currentProject && TM.hasUnsavedChanges) {
        console.log('[TM] 주기적 자동 저장 중...');
        try {
          await TM.saveProject(true); // silent
        } catch (e) {
          console.warn('[TM] 주기적 자동 저장 실패:', e);
        }
      }
    }, 15000); // 15초
  };
  
  TM.stopAutoSave = function() {
    if (TM.autoSaveTimer) {
      clearInterval(TM.autoSaveTimer);
      TM.autoSaveTimer = null;
    }
    if (TM.debounceSaveTimer) {
      clearTimeout(TM.debounceSaveTimer);
      TM.debounceSaveTimer = null;
    }
  };
  
  // 디바운스된 자동 저장 (변경 후 3초 후 저장)
  TM.debounceSave = function() {
    if (TM.debounceSaveTimer) {
      clearTimeout(TM.debounceSaveTimer);
    }
    TM.debounceSaveTimer = setTimeout(async () => {
      if (TM.currentProject && TM.hasUnsavedChanges) {
        console.log('[TM] 디바운스 자동 저장 중...');
        try {
          await TM.saveProject(true); // silent
        } catch (e) {
          console.warn('[TM] 디바운스 자동 저장 실패:', e);
        }
      }
    }, 3000); // 3초
  };
  
  // 변경 감지 및 자동 저장 트리거
  TM.markChanged = function() {
    TM.hasUnsavedChanges = true;
    TM.debounceSave();
  };
  
  // 변경 감지 플래그
  TM.hasUnsavedChanges = false;

  // ============================================================
  // 7. 워크스페이스 렌더링 (좌측 사이드바 + 우측 메인)
  // ============================================================
  
  TM.renderWorkspace = function() {
    const panel = document.getElementById('trademark-sub-application');
    if (!panel || !TM.currentProject) return;

    // 프로젝트 편집 시 서브탭 네비게이션 숨김
    TM.showSubTabNav(false);
    
    panel.innerHTML = `
      <div class="tm-app-layout">
        <!-- 좌측 사이드바 -->
        <aside class="tm-sidebar">
          <div class="tm-sidebar-header">
            <button class="tm-back-btn" data-action="tm-back-to-list">
              <span><span class="ico" data-icon="arrow-left"></span></span> 목록으로
            </button>
          </div>
          
          <div class="tm-sidebar-project">
            <div class="tm-project-icon"><span class="ico" data-icon="tag"></span></div>
            <div class="tm-project-info">
              <h3 class="tm-project-name">${TM.escapeHtml(TM.currentProject.trademarkName || '(상표명 미입력)')}</h3>
              <div style="font-size: 11px; color: var(--dt-g400); margin-top: 2px;">
                <span class="ico" data-icon="folder"></span> ${TM.escapeHtml(TM.currentProject.title || '(관리번호 미지정)')}
              </div>
              <span class="tm-status-badge ${TM.currentProject.status}">${TM.getStatusLabel(TM.currentProject.status)}</span>
            </div>
          </div>
          
          <!-- 저장 버튼 별도 영역 -->
          <div class="tm-sidebar-save">
            <button class="tm-save-btn-large" data-action="tm-save-project">
              <span class="ico" data-icon="save"></span> 저장하기
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
                <span class="ico" data-icon="arrow-left"></span> 이전
              </button>
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
                다음 →
              </button>
            </div>
          </div>
          
          <!-- ★ 프로젝트 정보 요약 (항상 표시) -->
          <div class="tm-project-summary" id="tm-project-summary" style="background: linear-gradient(135deg, var(--dt-brand-pale) 0%, var(--dt-brand-light) 100%); border: 1px solid var(--dt-brand-mid); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ico" data-icon="tag" data-size="20"></span>
              <div>
                <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">상표명</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--dt-brand-deep);">${TM.escapeHtml(TM.currentProject.trademarkName || '(미입력)')}</div>
              </div>
            </div>
            
            ${TM.currentProject.aiAnalysis?.businessAnalysis ? `
              <div style="flex: 1; min-width: 200px; border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
                <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">사업 내용</div>
                <div style="font-size: 13px; color: var(--dt-brand-deep); line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(TM.currentProject.aiAnalysis.businessAnalysis.slice(0, 100))}${TM.currentProject.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
              </div>
            ` : ''}
            
            ${TM.currentProject.designatedGoods?.length > 0 ? `
              <div style="border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
                <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">지정상품</div>
                <div style="font-size: 13px; color: var(--dt-brand-deep);">
                  <strong>${TM.currentProject.designatedGoods.length}</strong>개 류 / 
                  <strong>${TM.currentProject.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0)}</strong>개 상품
                </div>
              </div>
            ` : ''}
            
            ${TM.currentProject.aiAnalysis?.classRecommendations?.core?.length > 0 ? `
              <div style="border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
                <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">추천 류</div>
                <div style="font-size: 12px; color: var(--dt-brand-deep);">
                  ${TM.currentProject.aiAnalysis.classRecommendations.core.map(c => '제' + c.class + '류').join(', ')}
                  ${TM.currentProject.aiAnalysis.classRecommendations.recommended?.length > 0 ? ' 외 ' + TM.currentProject.aiAnalysis.classRecommendations.recommended.length + '개' : ''}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="tm-main-content" id="tm-step-content">
            <!-- 스텝 컨텐츠 동적 렌더링 -->
          </div>
          
          <!-- 하단 네비게이션 (스크롤 시에도 보임) -->
          <div class="tm-main-footer">
            <button class="btn btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
              <span class="ico" data-icon="arrow-left"></span> 이전 단계
            </button>
            <div class="tm-footer-center">
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-ghost" data-action="tm-save-project"><span class="ico" data-icon="save"></span> 저장</button>
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
      case 6: // 종합 요약
        return false; // 항상 미완료 (언제든 출력 가능)
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
      mainHeader.innerHTML = `${step?.icon || ''} ${step?.name || ''}`;
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
    // 우선심사 서브탭 컨텍스트에서 호출된 경우, 우선심사 워크스페이스 갱신
    const peContent = document.getElementById('tm-pe-content');
    if (peContent && TM.priorityTab.currentProject && TM.currentProject === TM.priorityTab.currentProject) {
      TM.renderStep7_PriorityExam(peContent);
      // 요약 배지도 갱신
      TM.updatePrioritySummaryBadge();
      return;
    }

    const stepEl = document.getElementById('tm-step-content');
    if (!stepEl) return;
    
    // 프로젝트 요약 정보 업데이트
    TM.updateProjectSummary();
    
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
        TM.renderStep7_Summary(stepEl);
        break;
    }
  };
  
  // 프로젝트 요약 정보 업데이트
  TM.updateProjectSummary = function() {
    const summaryEl = document.getElementById('tm-project-summary');
    if (!summaryEl || !TM.currentProject) return;
    
    const p = TM.currentProject;
    
    let html = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="ico" data-icon="tag" data-size="20"></span>
        <div>
          <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">상표명</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--dt-brand-deep);">${TM.escapeHtml(p.trademarkName || '(미입력)')}</div>
        </div>
      </div>
    `;
    
    if (p.aiAnalysis?.businessAnalysis) {
      html += `
        <div style="flex: 1; min-width: 200px; border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
          <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">사업 내용</div>
          <div style="font-size: 13px; color: var(--dt-brand-deep); line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(p.aiAnalysis.businessAnalysis.slice(0, 100))}${p.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
        </div>
      `;
    }
    
    if (p.designatedGoods?.length > 0) {
      const totalGoods = p.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0);
      html += `
        <div style="border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
          <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">지정상품</div>
          <div style="font-size: 13px; color: var(--dt-brand-deep);">
            <strong>${p.designatedGoods.length}</strong>개 류 / 
            <strong>${totalGoods}</strong>개 상품
          </div>
        </div>
      `;
    }
    
    if (p.aiAnalysis?.classRecommendations?.core?.length > 0) {
      const coreClasses = p.aiAnalysis.classRecommendations.core.map(c => '제' + c.class + '류').join(', ');
      const recCount = p.aiAnalysis.classRecommendations.recommended?.length || 0;
      html += `
        <div style="border-left: 2px solid var(--dt-brand-mid); padding-left: 16px;">
          <div style="font-size: 11px; color: var(--dt-brand); font-weight: 500;">추천 류</div>
          <div style="font-size: 12px; color: var(--dt-brand-deep);">
            ${coreClasses}${recCount > 0 ? ' 외 ' + recCount + '개' : ''}
          </div>
        </div>
      `;
    }
    
    summaryEl.innerHTML = html;
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
      // JSON이 잘려서 닫히지 않은 경우 복구 시도
      jsonStr = text.match(/\{[\s\S]*/)?.[0];
      if (jsonStr) {
        jsonStr = TM.repairTruncatedJson(jsonStr);
      } else {
        throw new Error('JSON을 찾을 수 없습니다.');
      }
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
      // 3차 시도: 잘린 JSON 복구
      try {
        const repaired = TM.repairTruncatedJson(jsonStr);
        return JSON.parse(repaired);
      } catch (e2) {
        console.error('[TM] JSON 파싱 최종 실패:', jsonStr.slice(0, 300));
        throw new Error('AI 응답 형식 오류. 다시 시도해주세요.');
      }
    }
  };
  
  // 잘린 JSON 복구 (max_tokens 초과로 응답이 잘렸을 때)
  TM.repairTruncatedJson = function(jsonStr) {
    // 열린 괄호/대괄호 카운트
    let braces = 0, brackets = 0, inString = false, escaped = false;
    for (let i = 0; i < jsonStr.length; i++) {
      const ch = jsonStr[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    
    // 문자열이 닫히지 않았으면 닫기
    if (inString) jsonStr += '"';
    
    // 마지막 불완전한 항목 제거 (trailing comma 정리)
    jsonStr = jsonStr.replace(/,\s*$/, '');
    
    // 닫히지 않은 괄호 닫기
    while (brackets > 0) { jsonStr += ']'; brackets--; }
    while (braces > 0) { jsonStr += '}'; braces--; }
    
    return jsonStr;
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
    
    // 변경 감지 및 자동 저장 트리거
    TM.markChanged();
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
