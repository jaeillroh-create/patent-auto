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
      { id: 6, name: '우선심사', icon: '⚡', key: 'priority_exam' },
      { id: 7, name: '종합 요약', icon: '📋', key: 'summary' }
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
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel) return;
    
    // 히스토리 관리 (브라우저 뒤로가기 지원)
    if (!skipHistory && TM.currentProject) {
      // 프로젝트에서 대시보드로 전환할 때만 히스토리 추가
      history.pushState({ tmModule: true, view: 'dashboard' }, '', window.location.href);
    }
    
    panel.innerHTML = `
      <div class="trademark-dashboard" style="max-width: 1400px; margin: 0 auto; padding: 40px 32px;">
        <!-- 헤더 영역 -->
        <div class="trademark-header" style="margin-bottom: 40px;">
          <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #1f2937;">🏷️ 상표 출원 관리</h2>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">특허그룹 디딤 상표 출원 프로젝트를 관리합니다.</p>
        </div>
        
        <!-- 새 프로젝트 버튼 -->
        <div style="margin-bottom: 24px;">
          <button class="btn btn-primary" data-action="tm-new-project" style="display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; font-size: 15px; font-weight: 600; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
            <span style="font-size: 20px;">+</span>
            새 프로젝트
          </button>
        </div>
        
        <!-- 프로젝트 목록 -->
        <div class="tm-project-list" id="tm-project-list">
          <div style="text-align: center; padding: 40px; color: #6b7280;">
            <div class="tm-loading-spinner" style="width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
            <p style="margin: 0;">프로젝트 목록 로딩 중...</p>
          </div>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
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
          <div style="text-align: center; padding: 80px 20px; background: #f9fafb; border-radius: 16px; border: 2px dashed #d1d5db;">
            <div style="font-size: 56px; margin-bottom: 20px;">🏷️</div>
            <h4 style="margin: 0 0 12px; font-size: 20px; color: #374151;">상표 프로젝트가 없습니다</h4>
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px;">새 프로젝트를 만들어 상표 출원을 시작하세요.</p>
            <button class="btn btn-primary" data-action="tm-new-project" style="padding: 14px 28px; font-size: 15px; border-radius: 10px;">+ 새 프로젝트 만들기</button>
          </div>
        `;
        return;
      }
      
      // 테이블 형식 목록
      listEl.innerHTML = `
        <div style="background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 16px 20px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">디딤 관리번호</th>
                <th style="padding: 16px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">상표명</th>
                <th style="padding: 16px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 80px;">유형</th>
                <th style="padding: 16px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 90px;">상태</th>
                <th style="padding: 16px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 100px;">수정일</th>
                <th style="padding: 16px 20px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 150px;">작업</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map(p => TM.renderProjectRow(p)).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 16px; text-align: right; color: #6b7280; font-size: 13px;">
          총 ${projects.length}개 프로젝트
        </div>
      `;
      
    } catch (error) {
      console.error('[TM] 프로젝트 목록 로드 실패:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <h4 style="margin: 0 0 8px; color: #991b1b;">로드 실패</h4>
          <p style="margin: 0; color: #dc2626;">${error.message}</p>
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
    
    const statusColors = {
      draft: '#f59e0b',
      searching: '#3b82f6',
      documenting: '#8b5cf6',
      completed: '#10b981'
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
    const statusColor = statusColors[project.status] || '#6b7280';
    
    return `
      <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;" 
          onmouseover="this.style.background='#f9fafb'" 
          onmouseout="this.style.background='white'">
        <td style="padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📁</span>
            <div style="font-weight: 600; color: #3b82f6; font-size: 13px; cursor: pointer; font-family: monospace;" 
                 onclick="TM.openProject('${project.id}')"
                 onmouseover="this.style.textDecoration='underline'" 
                 onmouseout="this.style.textDecoration='none'">
              ${TM.escapeHtml(project.title || '(미지정)')}
            </div>
          </div>
        </td>
        <td style="padding: 16px 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏷️</span>
            <span style="font-weight: 500; color: #1f2937; font-size: 14px;">
              ${TM.escapeHtml(project.trademark_name || '-')}
            </span>
          </div>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <span style="font-size: 12px; color: #6b7280;">${typeLabels[project.trademark_type] || '문자'}</span>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusColor}15; color: ${statusColor};">
            ${statusLabels[project.status] || '작성 중'}
          </span>
        </td>
        <td style="padding: 14px 12px; text-align: center; font-size: 12px; color: #6b7280;">
          ${updatedAt}
        </td>
        <td style="padding: 14px 20px; text-align: center;">
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            <button onclick="TM.openProject('${project.id}')" 
                    style="padding: 5px 10px; font-size: 11px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; white-space: nowrap;"
                    onmouseover="this.style.background='#2563eb'" 
                    onmouseout="this.style.background='#3b82f6'">열기</button>
            <button onclick="TM.editProject('${project.id}', '${TM.escapeHtml(project.title || '').replace(/'/g, "\\'")}')" 
                    style="padding: 5px 10px; font-size: 11px; background: #f3f4f6; color: #374151; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; white-space: nowrap;"
                    onmouseover="this.style.background='#e5e7eb'" 
                    onmouseout="this.style.background='#f3f4f6'">편집</button>
            <button onclick="TM.deleteProject('${project.id}')" 
                    style="padding: 5px 10px; font-size: 11px; background: #fef2f2; color: #dc2626; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; white-space: nowrap;"
                    onmouseover="this.style.background='#fee2e2'" 
                    onmouseout="this.style.background='#fef2f2'">삭제</button>
          </div>
        </td>
      </tr>
    `;
  };

  // ============================================================
  // 6. 프로젝트 CRUD
  // ============================================================
  
  TM.createNewProject = async function() {
    // 년도 기반 기본값 생성
    const year = new Date().getFullYear();
    const defaultNumber = `TM-${year}-`;
    
    const managementNumber = prompt(
      '디딤 관리번호를 입력하세요:\n(특허그룹 디딤 내부 사건 식별번호)\n\n예: TM-2026-001, 디딤-상표-001',
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
      
      // 히스토리 관리 (브라우저 뒤로가기 지원)
      if (!skipHistory) {
        history.pushState({ tmModule: true, view: 'project', projectId: projectId }, '', window.location.href);
      }
      
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
    const newTitle = prompt('디딤 관리번호를 수정하세요:', currentTitle || '');
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
              <h3 class="tm-project-name">${TM.escapeHtml(TM.currentProject.trademarkName || '(상표명 미입력)')}</h3>
              <div style="font-size: 11px; color: #9ca3af; margin-top: 2px; font-family: monospace;">
                ${TM.escapeHtml(TM.currentProject.title || '')}
              </div>
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
          
          <!-- ★ 프로젝트 정보 요약 (항상 표시) -->
          <div class="tm-project-summary" id="tm-project-summary" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏷️</span>
              <div>
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">상표명</div>
                <div style="font-size: 14px; font-weight: 600; color: #0c4a6e;">${TM.escapeHtml(TM.currentProject.trademarkName || '(미입력)')}</div>
              </div>
            </div>
            
            ${TM.currentProject.aiAnalysis?.businessAnalysis ? `
              <div style="flex: 1; min-width: 200px; border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">사업 내용</div>
                <div style="font-size: 13px; color: #1e3a5f; line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(TM.currentProject.aiAnalysis.businessAnalysis.slice(0, 100))}${TM.currentProject.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
              </div>
            ` : ''}
            
            ${TM.currentProject.designatedGoods?.length > 0 ? `
              <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">지정상품</div>
                <div style="font-size: 13px; color: #1e3a5f;">
                  <strong>${TM.currentProject.designatedGoods.length}</strong>개 류 / 
                  <strong>${TM.currentProject.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0)}</strong>개 상품
                </div>
              </div>
            ` : ''}
            
            ${TM.currentProject.aiAnalysis?.classRecommendations?.core?.length > 0 ? `
              <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">추천 류</div>
                <div style="font-size: 12px; color: #1e3a5f;">
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
      case 6: // 우선심사 - 사용자가 명시적으로 선택 여부를 결정해야 완료
        return TM.currentProject.priorityExam.userConfirmed === true;
      case 7: // 종합 요약
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
        TM.renderStep7_PriorityExam(stepEl);
        break;
      case 7:
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
        <span style="font-size: 20px;">🏷️</span>
        <div>
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">상표명</div>
          <div style="font-size: 14px; font-weight: 600; color: #0c4a6e;">${TM.escapeHtml(p.trademarkName || '(미입력)')}</div>
        </div>
      </div>
    `;
    
    if (p.aiAnalysis?.businessAnalysis) {
      html += `
        <div style="flex: 1; min-width: 200px; border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">사업 내용</div>
          <div style="font-size: 13px; color: #1e3a5f; line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(p.aiAnalysis.businessAnalysis.slice(0, 100))}${p.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
        </div>
      `;
    }
    
    if (p.designatedGoods?.length > 0) {
      const totalGoods = p.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0);
      html += `
        <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">지정상품</div>
          <div style="font-size: 13px; color: #1e3a5f;">
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
        <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">추천 류</div>
          <div style="font-size: 12px; color: #1e3a5f;">
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
              
              <!-- 상표명 -->
              <div class="tm-field">
                <label>상표명 <span class="required">*</span></label>
                <input type="text" class="tm-input tm-input-lg" data-field="trademarkName" 
                       value="${TM.escapeHtml(p.trademarkName)}" 
                       placeholder="한글, 영문, 한자 등">
              </div>
              
              <!-- 견본 업로드 (개선) -->
              <div class="tm-field">
                <label>견본 <span style="font-weight:400;color:#9ca3af;font-size:12px;">(도형/결합 상표 시 필수)</span></label>
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
                      <span class="tm-specimen-icon">🖼️</span>
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
              <h3>🤖 AI 사업 분석</h3>
              <span class="tm-badge tm-badge-primary">추천</span>
            </div>
            <div class="tm-panel-body">
              <p class="tm-hint">사업 내용을 입력하면 AI가 상품류와 지정상품을 추천합니다.</p>
              <div class="tm-field" style="margin-bottom: 16px;">
                <input type="text" class="tm-input" id="tm-business-url" 
                       value="${TM.escapeHtml(p.businessDescription || '')}"
                       placeholder="예: 소프트웨어 개발, 특허 출원 대행">
              </div>
              <button class="btn btn-primary btn-block" data-action="tm-analyze-business" style="padding: 12px;">🔍 분석</button>
            </div>
          </div>
          
          <!-- 출원인 정보 (확장) -->
          <details class="tm-panel" ${p.applicant.name ? 'open' : ''}>
            <summary class="tm-panel-header">
              <h3>👤 출원인 정보</h3>
              <span class="tm-badge tm-badge-gray">${p.applicant.name ? '입력됨' : '선택'}</span>
            </summary>
            <div class="tm-panel-body">
              <div class="tm-field-grid tm-field-grid-3">
                <div class="tm-field">
                  <label>디딤 관리번호 <span style="font-weight:400;color:#9ca3af;font-size:11px;">(프로젝트 식별)</span></label>
                  <input type="text" class="tm-input" id="tm-project-title-input"
                         value="${TM.escapeHtml(TM.currentProject?.title || '')}" 
                         placeholder="예: TM-2026-001"
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
            <!-- AI 추천 상품류 (3단계: 핵심/권장/확장) -->
            <div class="tm-panel tm-panel-ai">
              <div class="tm-panel-header">
                <h3>🤖 AI 추천 상품류</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">✓ 전체 적용</button>
              </div>
              <div class="tm-ai-rec-desc" style="font-size: 12px; padding: 8px 12px; background: #f8f9fa; margin: 0 0 10px 0; border-radius: 4px;">
                사업 분석 결과입니다. <strong style="color: #dc3545;">🔴 핵심</strong>은 필수, 
                <strong style="color: #fd7e14;">🟠 권장</strong>은 권리 보호용, 
                <strong style="color: #28a745;">🟢 확장</strong>은 사업 확장 시 고려하세요.
              </div>
              
              <div id="tm-ai-recommendations-container"></div>
              
              <!-- 추가 추천 요청 버튼 -->
              <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; text-align: center;">
                <button class="btn btn-outline btn-sm" data-action="tm-request-more-recommendations" style="font-size: 12px;">
                  🔍 추가 추천 요청
                </button>
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
                ${totalGoods > 0 ? `<button class="btn btn-sm btn-outline" data-action="tm-copy-goods" title="지정상품 복사">📋 복사</button>` : ''}
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
    const renderClassItem = (item, category, emoji) => {
      const code = item.class;
      const isAdded = p.designatedGoods.some(g => g.classCode === code);
      const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
      const borderColor = category === 'core' ? '#dc3545' : category === 'recommended' ? '#fd7e14' : '#28a745';
      
      let goodsHtml = '';
      if (recGoods.length > 0) {
        const goodsTags = recGoods.slice(0, 3).map(g => {
          const name = g.name || g;
          const displayName = name.length > 15 ? name.slice(0, 15) + '..' : name;
          return '<span class="tag" style="padding: 1px 4px;">' + TM.escapeHtml(displayName) + '</span>';
        }).join('');
        const moreCount = recGoods.length > 3 ? '<span class="more">+' + (recGoods.length - 3) + '</span>' : '';
        goodsHtml = '<div class="tm-ai-rec-goods" style="margin-top: 4px; font-size: 11px;">' +
          '<span class="label" style="margin-right: 4px;">추천 지정상품:</span>' +
          goodsTags + moreCount + '</div>';
      }
      
      const actionHtml = isAdded 
        ? '<span class="applied" style="font-size: 11px; color: #28a745;">✓적용됨</span>'
        : '<button class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 11px;" data-action="tm-apply-recommendation" data-class-code="' + code + '">+ 추가</button>';
      
      return '<div class="tm-ai-rec-item ' + (isAdded ? 'added' : '') + '" data-category="' + category + '" style="padding: 10px; gap: 8px; border-left: 3px solid ' + borderColor + ';">' +
        '<div class="tm-ai-rec-content" style="flex: 1; min-width: 0;">' +
          '<div class="tm-ai-rec-class" style="font-size: 13px;">' +
            '<span style="margin-right: 4px;">' + emoji + '</span>' +
            '<strong>제' + code + '류</strong> ' + (TM.niceClasses[code] || '') +
          '</div>' +
          '<div class="tm-ai-rec-reason" style="font-size: 11px; color: #666; margin-top: 2px;">' + TM.escapeHtml(item.reason || '') + '</div>' +
          goodsHtml +
        '</div>' +
        '<div class="tm-ai-rec-action">' + actionHtml + '</div>' +
      '</div>';
    };
    
    let html = '';
    
    // 🔴 핵심 류
    if (coreClasses.length > 0) {
      html += '<div class="tm-rec-section">' +
        '<div class="tm-rec-section-header" style="background: #fff5f5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #dc3545; border-radius: 4px; margin-bottom: 6px;">' +
          '🔴 핵심 (필수 등록) - ' + coreClasses.length + '개 류' +
        '</div>' +
        '<div class="tm-ai-rec-list" style="gap: 6px; margin-bottom: 12px; display: flex; flex-direction: column;">' +
          coreClasses.map(item => renderClassItem(item, 'core', '🔴')).join('') +
        '</div>' +
      '</div>';
    }
    
    // 🟠 권장 류
    if (recommendedClasses.length > 0) {
      html += '<div class="tm-rec-section">' +
        '<div class="tm-rec-section-header" style="background: #fff8f0; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #fd7e14; border-radius: 4px; margin-bottom: 6px;">' +
          '🟠 권장 (권리 보호) - ' + recommendedClasses.length + '개 류' +
        '</div>' +
        '<div class="tm-ai-rec-list" style="gap: 6px; margin-bottom: 12px; display: flex; flex-direction: column;">' +
          recommendedClasses.map(item => renderClassItem(item, 'recommended', '🟠')).join('') +
        '</div>' +
      '</div>';
    }
    
    // 🟢 확장 류 (접기/펼치기)
    if (expansionClasses.length > 0) {
      html += '<div class="tm-rec-section tm-rec-expansion">' +
        '<div class="tm-rec-section-header" style="background: #f0fff4; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #28a745; border-radius: 4px; margin-bottom: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" data-action="tm-toggle-expansion">' +
          '<span>🟢 확장 (사업 확장 시 고려) - ' + expansionClasses.length + '개 류</span>' +
          '<span class="tm-expansion-toggle">▼ 펼치기</span>' +
        '</div>' +
        '<div class="tm-ai-rec-list tm-expansion-list" style="gap: 6px; display: none; flex-direction: column;">' +
          expansionClasses.map(item => renderClassItem(item, 'expansion', '🟢')).join('') +
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
          const goodsTags = recGoods.slice(0, 2).map(g => {
            const name = g.name || g;
            const displayName = name.length > 12 ? name.slice(0, 12) + '..' : name;
            return '<span class="tag" style="padding: 1px 4px;">' + TM.escapeHtml(displayName) + '</span>';
          }).join('');
          const moreCount = recGoods.length > 2 ? '<span class="more">+' + (recGoods.length - 2) + '</span>' : '';
          goodsHtml = '<div class="tm-ai-rec-goods" style="margin-top: 4px; font-size: 11px;">' +
            '<span class="label" style="margin-right: 4px;">추천 지정상품:</span>' +
            goodsTags + moreCount + '</div>';
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
      const scoreColor = v.overallScore >= 80 ? '#10b981' : v.overallScore >= 60 ? '#f59e0b' : '#ef4444';
      const scoreEmoji = v.overallScore >= 80 ? '✅' : v.overallScore >= 60 ? '⚠️' : '❌';
      const bgColor = v.overallScore >= 80 ? '#d1fae5' : v.overallScore >= 60 ? '#fef3c7' : '#fee2e2';
      const borderColor = v.overallScore >= 80 ? '#6ee7b7' : v.overallScore >= 60 ? '#fcd34d' : '#fca5a5';
      
      html += '<div style="margin-top: 16px; padding: 14px; background: ' + bgColor + '; border-radius: 10px; border: 1px solid ' + borderColor + ';">';
      
      // 검증 헤더
      html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid ' + borderColor + ';">' +
        '<span style="font-weight: 700; font-size: 14px;">' + scoreEmoji + ' 3단계 검증 결과</span>' +
        '<span style="font-size: 13px; color: ' + scoreColor + '; font-weight: 700; background: white; padding: 4px 10px; border-radius: 12px;">정확도 ' + v.overallScore + '%</span>' +
      '</div>';
      
      // 요약
      if (v.summary) {
        html += '<div style="font-size: 13px; color: #374151; margin-bottom: 12px; font-weight: 500;">' + TM.escapeHtml(v.summary) + '</div>';
      }
      
      // 제거된 류 표시
      if (v.invalidClasses?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-bottom: 6px;">❌ 제거된 류 (' + v.invalidClasses.length + '개)</div>';
        v.invalidClasses.forEach(c => {
          html += '<div style="font-size: 11px; color: #7f1d1d; padding: 6px 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #dc2626;">' +
            '<strong>제' + c.class + '류</strong>: ' + TM.escapeHtml(c.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 제거된 지정상품 표시
      if (v.invalidGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-bottom: 6px;">❌ 제거된 지정상품 (' + v.invalidGoods.length + '개)</div>';
        v.invalidGoods.forEach(g => {
          const errorLabel = g.errorType === 'homonym' ? '🔤 동음이의어' : 
                            g.errorType === 'partial_match' ? '📝 부분매칭 오류' : '⚠️ 관련성 부족';
          html += '<div style="font-size: 11px; color: #7f1d1d; padding: 6px 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #f87171;">' +
            '<span style="background: #fee2e2; padding: 1px 6px; border-radius: 4px; margin-right: 6px; font-size: 10px;">' + errorLabel + '</span>' +
            '<strong>제' + g.classCode + '류</strong> "' + TM.escapeHtml(g.goodsName) + '": ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 대체 추천된 상품
      if (v.replacementGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #059669; margin-bottom: 6px;">🔄 대체 추천 (' + v.replacementGoods.length + '개)</div>';
        v.replacementGoods.forEach(r => {
          html += '<div style="font-size: 11px; color: #065f46; padding: 6px 10px; background: #ecfdf5; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #10b981;">' +
            '<strong>제' + r.classCode + '류</strong>: ' +
            '<span style="text-decoration: line-through; color: #9ca3af;">' + TM.escapeHtml(r.remove) + '</span> → ' +
            '<strong>' + TM.escapeHtml(r.addInstead) + '</strong>' +
          '</div>';
        });
        html += '</div>';
      }
      
      // 경고 사항
      if (v.warnings?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #d97706; margin-bottom: 6px;">⚠️ 확인 필요</div>';
        v.warnings.forEach(w => {
          html += '<div style="font-size: 11px; color: #92400e; padding: 6px 10px; background: #fffbeb; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #f59e0b;">' +
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
            '<div style="font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 6px;">💡 추가 권장 류</div>';
          addClassSuggestions.forEach(s => {
            const priorityBadge = s.priority === '핵심' ? '🔴' : s.priority === '권장' ? '🟠' : '🟢';
            html += '<div style="font-size: 11px; color: #1e40af; padding: 6px 10px; background: #eff6ff; border-radius: 6px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #3b82f6;">' +
              '<span>' + priorityBadge + ' <strong>제' + s.class + '류</strong>: ' + TM.escapeHtml(s.reason) + '</span>' +
              '<button class="btn btn-sm" style="padding: 3px 10px; font-size: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;" data-action="tm-add-class" data-class-code="' + s.class + '">+ 추가</button>' +
            '</div>';
          });
          html += '</div>';
        }
      }
      
      // 누락된 지정상품
      if (v.missingGoods?.length > 0) {
        html += '<div>' +
          '<div style="font-size: 11px; font-weight: 600; color: #7c3aed; margin-bottom: 6px;">📦 추가 권장 상품</div>';
        v.missingGoods.forEach(g => {
          html += '<div style="font-size: 11px; color: #5b21b6; padding: 6px 10px; background: #f5f3ff; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #8b5cf6;">' +
            '<strong>제' + g.classCode + '류</strong>: ' + TM.escapeHtml(g.goodsName) + ' - ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // 재검증 버튼
      html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid ' + borderColor + '; text-align: center;">' +
        '<button class="btn btn-sm" style="padding: 6px 16px; font-size: 11px; background: white; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" data-action="tm-revalidate">🔄 다시 검증</button>' +
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
        
        <div class="tm-goods-input-area" style="position: relative;">
          <input type="text" class="tm-goods-search-input" 
                 id="tm-goods-input-${classData.classCode}"
                 placeholder="지정상품명 검색 (자동완성)"
                 data-class="${classData.classCode}"
                 autocomplete="off"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"
               style="position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: none;"></div>
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
      
      const validationResult = await TM.validateRecommendations(businessInput, p.aiAnalysis);
      
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
            .eq('class_code', classCode)
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
          .eq('class_code', classCode)
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

      const response = await App.callClaude(additionalPrompt, 2000);
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
          p.aiAnalysis.classReasons[item.class] = `🟢 추가 확장: ${item.reason}`;
        }
      });
      
      p.aiAnalysis.classRecommendations.expansion = existingExpansion;
      
      TM.renderCurrentStep();
      App.showToast(`${additionalClasses.length}개 추가 류가 확장 목록에 추가되었습니다.`, 'success');
      
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
            <div class="tm-goods-autocomplete-item" data-name="${TM.escapeHtml(query)}" data-gazetted="false"
                 style="padding: 8px 12px; cursor: pointer;"
                 onmouseover="this.style.backgroundColor='#f5f5f5'" 
                 onmouseout="this.style.backgroundColor='white'">
              <div class="goods-name" style="font-weight: 500;">"${TM.escapeHtml(query)}" 직접 입력</div>
              <div class="goods-meta" style="font-size: 11px; color: #888;">비고시명칭 (52,000원/류 적용)</div>
            </div>
          `;
          autocomplete.style.display = 'block';
        } else {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" style="padding: 8px 12px; color: #8b95a1;">
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
             style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;"
             onmouseover="this.style.backgroundColor='#f5f5f5'" 
             onmouseout="this.style.backgroundColor='white'">
          <div class="goods-name" style="font-weight: 500;">${TM.escapeHtml(r.goods_name)}</div>
          <div class="goods-meta" style="font-size: 11px; color: #888;">${r.goods_name_en || ''} · ${r.similar_group_code || ''}</div>
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
                  <span class="tm-preview-label">📦 상품류:</span>
                  <span class="tm-preview-values" id="tm-preview-classes">${classList.map(c => '제'+c+'류').join(', ')}</span>
                </div>
              ` : ''}
              ${similarGroupList.length > 0 ? `
                <div class="tm-preview-section">
                  <span class="tm-preview-label">🏷️ 유사군:</span>
                  <span class="tm-preview-values" id="tm-preview-similarities">
                    ${similarGroupList.slice(0, 5).join(', ')}${similarGroupList.length > 5 ? ` 외 ${similarGroupList.length - 5}개` : ''}
                  </span>
                </div>
              ` : ''}
            </div>
            
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
          <div class="icon">🔍</div>
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
          <span class="tm-stat-label">⚠️ 유사군 중복</span>
        </div>
        <div class="tm-summary-stat risk-safe">
          <span class="tm-stat-num">${noOverlapCount}</span>
          <span class="tm-stat-label">✅ 등록가능</span>
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
        <span class="tm-explanation-icon">💡</span>
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
    let riskBadge = '✅ 등록가능';
    
    if (hasGroupOverlap) {
      const riskLevel = r.riskLevel || 'medium';
      if (riskLevel === 'critical' || riskLevel === 'high') {
        riskClass = 'risk-high';
        riskBadge = '⛔ 고위험';
      } else if (riskLevel === 'medium') {
        riskClass = 'risk-medium';
        riskBadge = '⚠️ 주의';
      } else {
        riskClass = 'risk-low';
        riskBadge = '🔶 저위험';
      }
    }
    
    return `
      <div class="tm-search-result-item ${riskClass} ${hasGroupOverlap ? 'has-overlap' : 'no-overlap'}" data-id="${r.applicationNumber}">
        <!-- 순위 & 유사군 중복 표시 -->
        <div class="tm-result-rank">
          <span class="tm-rank-num">${rank}</span>
          <span class="tm-overlap-badge ${hasGroupOverlap ? 'overlap' : 'safe'}">${riskBadge}</span>
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
            ${r.overlappingGroups && r.overlappingGroups.length > 0 ? `
              <span class="tm-overlap-groups">중복: ${r.overlappingGroups.slice(0, 2).join(', ')}${r.overlappingGroups.length > 2 ? '...' : ''}</span>
            ` : ''}
            ${r.applicationNumber ? `
              <a href="http://kipris.or.kr/khome/main.jsp#702${r.applicationNumber.replace(/-/g, '')}" 
                 target="_blank" class="tm-kipris-link" title="KIPRIS에서 보기">
                🔗 KIPRIS
              </a>
            ` : ''}
          </div>
        </div>
        
        <!-- 유사도 점수 (유사군 중복 시에만 의미있음) -->
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
              <span class="tm-safe-text">유사군 다름</span>
            </div>
          `}
        </div>
        
        <!-- 위험 사유 -->
        <div class="tm-result-reason ${hasGroupOverlap ? '' : 'safe'}">
          <span class="tm-reason-text">${TM.escapeHtml(r.riskReason || (hasGroupOverlap ? '심사관 판단 필요' : '유사군 비중복 → 등록 가능'))}</span>
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
  
  TM.rankAndFilter = function(candidates, sourceText, viennaCodes, targetClasses, targetGroups, topK = 200) {
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
    
    console.log(`[KIPRIS] 랭킹 완료: Top ${Math.min(topK, candidates.length)}건`);
    console.log(`[KIPRIS] 유사군 중복: ${candidates.filter(c => c._hasGroupOverlap).length}건`);
    
    return candidates.slice(0, topK);
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
      
      // ===== Stage B-1: 1차 랭킹 (K0 = 200) =====
      onProgress?.(8, 10, '유사도 계산 중...');
      
      const ranked = TM.rankAndFilter(
        candidates, trademark, viennaCodes, 
        targetClasses, targetGroups,
        200 // K0
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
      return '✅ 유사군 비중복 → 등록 가능';
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
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>⚖️ 유사도 평가</h3>
      </div>
      
      ${allSearchResults.length === 0 ? `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon">🔍</div>
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
              🤖 전체 AI 평가 실행
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
            <h4>📊 평가 결과 상세 <span class="tm-badge">${evaluations.length}건</span></h4>
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
    const fee = p.feeCalculation || {};
    
    // 비용 자동 계산
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>📊 리스크 평가</h3>
      </div>
      
      <!-- AI 평가 버튼 -->
      <div class="tm-risk-action-panel">
        <button class="btn btn-primary btn-lg" id="tm-risk-btn" data-action="tm-assess-risk">
          🤖 AI 리스크 종합 평가
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
              <h4>📋 상세 분석</h4>
              <div class="tm-analysis-content">${TM.formatRiskDetails(risk.details)}</div>
            </div>
          ` : ''}
          
          ${risk.recommendation ? `
            <div class="tm-analysis-section recommendation">
              <h4>💡 권고사항</h4>
              <div class="tm-analysis-content">${TM.formatRiskRecommendation(risk.recommendation)}</div>
            </div>
          ` : ''}
        </div>
        
        <!-- 비용 명세 (접힘) -->
        <details class="tm-fee-accordion" open>
          <summary>💰 비용 명세</summary>
          <div class="tm-fee-content">
            <div class="tm-fee-list">
              ${TM.renderFeeBreakdown(fee)}
            </div>
          </div>
        </details>
      ` : `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon">📊</div>
          <h4>리스크 평가를 실행하세요</h4>
          <p>유사도 평가 결과, 지정상품, 상표 유형 등을 AI가 종합 분석합니다.</p>
        </div>
      `}
      
      <!-- 평가 기준 -->
      <details class="tm-accordion">
        <summary>📋 평가 기준 안내</summary>
        <div class="tm-accordion-content">
          <div class="tm-criteria-grid">
            <div class="tm-criteria-item high">
              <div class="tm-criteria-label">⛔ 높은 위험</div>
              <div class="tm-criteria-desc">유사군 중복 + 상표 유사 → 거절 가능성 높음</div>
            </div>
            <div class="tm-criteria-item medium">
              <div class="tm-criteria-label">⚠️ 중간 위험</div>
              <div class="tm-criteria-desc">유사군 중복, 상표 다소 유사 → 심사관 판단</div>
            </div>
            <div class="tm-criteria-item low">
              <div class="tm-criteria-label">✅ 낮은 위험</div>
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
        <h3>⚡ 우선심사 신청 여부 결정</h3>
        <p>상표를 사용 중이거나 사용 준비 중인 경우 우선심사를 신청할 수 있습니다.</p>
      </div>
      
      <!-- 출원서 업로드 (컴팩트) -->
      <div class="tm-form-section tm-upload-section-compact">
        <div class="tm-upload-header">
          <span>📄 출원서 업로드 (선택)</span>
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
              <span>${pe.editMode ? '📝 출원 정보' : '✅ 추출 완료'}</span>
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
                    <input type="text" id="tm-extract-applicationNumber" value="${pe.applicationNumber || ''}" placeholder="40-2024-0012345">
                  </div>
                  <div class="tm-field-compact">
                    <label>출원일 *</label>
                    <input type="text" id="tm-extract-applicationDate" value="${pe.applicationDate || ''}" placeholder="2024.03.15">
                  </div>
                  <div class="tm-field-compact">
                    <label>출원인 *</label>
                    <input type="text" id="tm-extract-applicantName" value="${pe.applicantName || ''}" placeholder="주식회사 OOO">
                  </div>
                  <div class="tm-field-compact">
                    <label>상표명</label>
                    <input type="text" id="tm-extract-trademarkNameFromApp" value="${pe.trademarkNameFromApp || ''}" placeholder="상표명">
                  </div>
                  <div class="tm-field-compact">
                    <label>상품류</label>
                    <input type="text" id="tm-extract-classCode" value="${pe.classCode || ''}" placeholder="09">
                  </div>
                  <div class="tm-field-compact tm-field-wide">
                    <label>지정상품</label>
                    <input type="text" id="tm-extract-designatedGoodsFromApp" value="${pe.designatedGoodsFromApp || ''}" placeholder="지정상품 목록">
                  </div>
                </div>
              </div>
            ` : `
              <div class="tm-extracted-summary">
                <span><strong>${pe.applicationNumber || '-'}</strong> | ${pe.applicationDate || '-'} | ${pe.applicantName || '-'}</span>
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
            ⚡ 신청 <small>(2~3개월, +160,000원/류)</small>
          </button>
          <button class="tm-choice-btn ${pe.enabled === false && isConfirmed ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="false">
            📋 일반심사 <small>(12~14개월)</small>
          </button>
        </div>
        ${!isConfirmed ? '<span class="tm-choice-required">← 선택 필요</span>' : ''}
      </div>
      
      ${pe.enabled ? `
        <!-- 우선심사 사유 (컴팩트) -->
        <div class="tm-section-compact">
          <div class="tm-section-header-compact">
            <span>📋 신청 사유</span>
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
                  <button class="tm-evidence-delete" data-action="tm-remove-evidence" data-index="${idx}">✕</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="tm-evidence-empty" 
                 ondragover="TM.handleDragOver(event)"
                 ondragleave="TM.handleDragLeave(event)"
                 ondrop="TM.handleEvidenceDrop(event)"
                 onclick="document.getElementById('tm-evidence-input').click()">
              <span>📁 파일을 드래그하거나 클릭하여 업로드</span>
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
            <span>📝 설명서 생성</span>
          </div>
          
          ${TM.checkGoodsMismatch() ? `
            <div class="tm-goods-selector">
              <div class="tm-goods-selector-header">⚠️ 지정상품 정보 불일치 - 사용할 정보 선택:</div>
              <div class="tm-goods-selector-options">
                <label class="tm-goods-option-inline ${!pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(false)">
                  <input type="radio" name="goods-source" ${!pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label">📋 2단계 지정상품</span>
                  <span class="tm-option-value">${(p.designatedGoods || []).map(d => d.classCode).join(',')}류</span>
                </label>
                <label class="tm-goods-option-inline ${pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(true)">
                  <input type="radio" name="goods-source" ${pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label">📄 출원서 추출</span>
                  <span class="tm-option-value">${pe.classCode}류</span>
                </label>
              </div>
            </div>
          ` : ''}
          
          <div class="tm-doc-actions-compact">
            <button class="tm-btn-generate" data-action="tm-generate-priority-doc">
              📄 Word 생성
            </button>
            <button class="tm-btn-preview" onclick="TM.previewPriorityDoc()">
              👁️ 미리보기
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
          <h4>💡 우선심사란?</h4>
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
      fullText += pageText + '\n';
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
    return await TM.parseApplicationText(fullText);
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
    const result = {
      applicationNumber: '',
      applicationDate: '',
      applicantName: '',
      trademarkName: '',
      classCode: '',
      designatedGoods: ''
    };
    
    if (!text || text.trim().length < 10) {
      console.log('[TM] 텍스트가 너무 짧음');
      return result;
    }
    
    console.log('[TM] Claude API로 텍스트 분석 시작');
    console.log('[TM] 원본 텍스트:', text.substring(0, 800));
    
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

      const response = await App.callClaude(prompt, 800);
      const responseText = response.text || '';
      
      console.log('[TM] Claude 응답:', responseText);
      
      // JSON 추출
      const startIdx = responseText.indexOf('{');
      const endIdx = responseText.lastIndexOf('}');
      
      if (startIdx !== -1 && endIdx > startIdx) {
        const jsonStr = responseText.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.applicationNumber) result.applicationNumber = parsed.applicationNumber;
        if (parsed.applicationDate) result.applicationDate = parsed.applicationDate;
        if (parsed.applicantName) result.applicantName = parsed.applicantName;
        if (parsed.trademarkName) result.trademarkName = parsed.trademarkName;
        if (parsed.classCode) result.classCode = parsed.classCode;
        if (parsed.designatedGoods) result.designatedGoods = parsed.designatedGoods;
        
        console.log('[TM] Claude 파싱 결과:', result);
        return result;
      }
    } catch (error) {
      console.error('[TM] Claude 분석 실패, 정규식 폴백:', error);
    }
    
    // 정규식 폴백
    return TM.parseApplicationTextRegex(text);
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
    
    let t = text.replace(/\s+/g, ' ');
    
    console.log('[TM] 정규식 폴백 파싱 시작');
    
    // 출원번호: 40-2025-0097799
    const appNumMatch = t.match(/(40-\d{4}-\d{6,7})/);
    if (appNumMatch) {
      result.applicationNumber = appNumMatch[1];
      console.log('[TM] 출원번호:', result.applicationNumber);
    }
    
    // 출원일자: 2025.06.09 또는 202506.09
    const dateMatch = t.match(/(\d{4})[.\s-]*(\d{2})[.\s-]*(\d{2})/);
    if (dateMatch) {
      result.applicationDate = `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
      console.log('[TM] 출원일자:', result.applicationDate);
    }
    
    // 출원인: 한글 사이 공백 제거하여 회사명 추출
    const companyMatch = t.match(/([가-힣\s]{2,20})\s*주\s*식\s*회\s*사|주\s*식\s*회\s*사\s*([가-힣\s]{2,20})/);
    if (companyMatch) {
      let name = (companyMatch[1] || companyMatch[2] || '').replace(/\s/g, '');
      if (name && name.length >= 2) {
        result.applicantName = name + ' 주식회사';
        console.log('[TM] 출원인:', result.applicantName);
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
    TM.currentProject.priorityExam.reasonDetail = detail;
    TM.hasUnsavedChanges = true;
  };
  
  // 증거자료 수동 추가
  TM.addEvidenceManual = function() {
    const titleInput = document.getElementById('tm-evidence-title');
    const descInput = document.getElementById('tm-evidence-desc');
    
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
      description: descInput?.value?.trim() || '',
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
      if (file.size > 10 * 1024 * 1024) {
        App.showToast(`${file.name}: 파일 크기 초과 (10MB 이하)`, 'warning');
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

      const response = await App.callClaude(prompt, 80);
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
  
  // 우선심사 설명서 내용 생성
  TM.generatePriorityDocContent = function(useExtracted = false) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    // 출원인 정보
    const applicantName = pe.applicantName || p.applicantName || '[출원인명]';
    const applicationNumber = pe.applicationNumber || '[출원번호]';
    const applicationDate = pe.applicationDate || '[출원일]';
    const trademarkName = pe.trademarkNameFromApp || p.trademarkName || '[상표명]';
    
    // 인라인 선택 값 적용
    const hasExtracted = pe.classCode || pe.designatedGoodsFromApp;
    const finalUseExtracted = useExtracted || pe.useExtractedGoods || false;
    let classCodeStr, designatedGoodsStr, goodsWithGroups;
    
    if (finalUseExtracted && hasExtracted) {
      // 추출 정보 사용
      classCodeStr = pe.classCode ? `제 ${pe.classCode}류` : '[상품류]';
      designatedGoodsStr = pe.designatedGoodsFromApp || '[지정상품]';
      goodsWithGroups = pe.designatedGoodsFromApp ? 
        pe.designatedGoodsFromApp.split(',').map(g => `『${g.trim()}』`) : [];
    } else {
      // 2단계 정보 사용 (기본)
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
      
      const classCodeList = Object.keys(classGroups).sort((a, b) => parseInt(a) - parseInt(b));
      classCodeStr = classCodeList.length > 0 ? classCodeList.map(c => '제 ' + c + '류').join(', ') : '[상품류]';
      
      const goodsList = [];
      Object.values(classGroups).forEach(goods => {
        goods.forEach(g => goodsList.push(g.name));
      });
      designatedGoodsStr = goodsList.length > 0 ? goodsList.join(', ') : '[지정상품]';
      
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
    }
    
    // 증거자료 목록
    const evidences = pe.evidences || [];
    
    // 첨부자료 참조 문자열 생성
    const evidence1Ref = evidences.length > 0 ? `(첨부자료 1: ${evidences[0].title})` : '';
    const evidence2Ref = evidences.length > 1 ? `(첨부자료 2: ${evidences[1].title})` : '';
    
    // 신청이유 선택에 따른 법조문
    let reasonText = '';
    if (pe.reason === 'using' || pe.reason === 'preparing') {
      reasonText = `본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 "상표등록출원인이 상표등록출원한 상표를 지정상품 전부에 대하여 사용하고 있거나 사용할 준비를 하고 있음이 명백한 경우"에 해당하는 상표등록출원으로서, 그 지정상품에 사용 준비하고 있는 것이 명백하므로 우선심사를 신청합니다.`;
    } else if (pe.reason === 'infringement') {
      reasonText = `본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제2호의 "출원인이 아닌 자가 출원상표와 동일·유사한 상표를 동일·유사한 지정상품에 정당한 사유 없이 사용하고 있다고 인정되는 경우"에 해당하는 상표등록출원으로서, 우선심사를 신청합니다.`;
    } else {
      reasonText = `본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 규정에 따라 우선심사를 신청합니다.`;
    }
    
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
          <p style="font-size: 18px; font-weight: bold;">${trademarkName}</p>
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
          <p>${reasonText}</p>
          <p style="margin-top: 12px;">
            본 출원인 "${applicantName}"는 본 신청서의 첨부자료${evidence1Ref}에 기재된 바와 같이, 
            이건 출원상표가 표시된 ${goodsWithGroups.join(', ')}을 
            사용 및 사용 준비 중입니다.
          </p>
          <p style="margin-top: 12px;">
            따라서, 이건 출원상표는 앞서 설명한 바와 같이, 그 지정상품 전부에 대하여 사용예정 중에 있습니다.
          </p>
          <p style="margin-top: 12px;">
            이건 출원인 "${applicantName}"${evidence2Ref}은 이건 출원상표를 해당 지정상품에 사용할 것이 더욱 분명합니다. 
            부디 이점을 적극 고려하시어 이건 출원상표에 대하여 우선심사신청을 허여해 주시기 바랍니다.
          </p>
        </div>
        
        ${evidences.length > 0 ? `
          <div class="tm-doc-section">
            <h3>【증빙자료】</h3>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${evidences.map((ev, idx) => `<li>첨부자료 ${idx + 1} : ${ev.title}</li>`).join('')}
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
      
      if (finalUseExtracted && hasExtracted) {
        // 7단계 추출 정보 사용
        classCodeStr = extractedClassCode ? `제 ${extractedClassCode}류` : '[상품류]';
        designatedGoodsStr = extractedGoodsStr || '[지정상품]';
        goodsWithGroups = extractedGoodsStr ? extractedGoodsStr.split(',').map(g => `『${g.trim()}』`) : [];
      } else {
        // 2단계 지정상품 정보 사용 (기본값)
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
        
        const classCodeList = Object.keys(classGroups).sort((a, b) => parseInt(a) - parseInt(b));
        classCodeStr = classCodeList.length > 0 ? classCodeList.map(c => '제 ' + c + '류').join(', ') : '[상품류]';
        
        const goodsList = [];
        Object.values(classGroups).forEach(goods => {
          goods.forEach(g => goodsList.push(g.name));
        });
        designatedGoodsStr = goodsList.length > 0 ? goodsList.join(', ') : '[지정상품]';
        
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
      }
      
      // 증거자료 목록
      const evidences = pe.evidences || [];
      
      // 신청이유 선택에 따른 법조문
      let reasonText1 = '';
      if (pe.reason === 'using' || pe.reason === 'preparing') {
        reasonText1 = '본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 "상표등록출원인이 상표등록출원한 상표를 지정상품 전부에 대하여 사용하고 있거나 사용할 준비를 하고 있음이 명백한 경우"에 해당하는 상표등록출원으로서, 그 지정상품에 사용 준비하고 있는 것이 명백하므로 우선심사를 신청합니다.';
      } else if (pe.reason === 'infringement') {
        reasonText1 = '본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제2호의 "출원인이 아닌 자가 출원상표와 동일·유사한 상표를 동일·유사한 지정상품에 정당한 사유 없이 사용하고 있다고 인정되는 경우"에 해당하는 상표등록출원으로서, 우선심사를 신청합니다.';
      } else {
        reasonText1 = '본 상표는 상표법 제53조 제2항 제2호 및 상표법 시행령 제12조 제1호의 규정에 따라 우선심사를 신청합니다.';
      }
      
      // 증거자료 참조 문자열 생성 (첨부자료 1, 2 개별 참조)
      const evidence1Ref = evidences.length > 0 ? `(첨부자료 1: ${evidences[0].title})` : '';
      const evidence2Ref = evidences.length > 1 ? `(첨부자료 2: ${evidences[1].title})` : '';
      
      const reasonText2 = `본 출원인 "${applicantName}"는 본 신청서의 첨부자료${evidence1Ref}에 기재된 바와 같이, 이건 출원상표가 표시된 ${goodsWithGroups.join(', ')}을 사용 및 사용 준비 중입니다.`;
      
      const reasonText3 = '따라서, 이건 출원상표는 앞서 설명한 바와 같이, 그 지정상품 전부에 대하여 사용예정 중에 있습니다.';
      
      const reasonText4 = `이건 출원인 "${applicantName}"${evidence2Ref}은 이건 출원상표를 해당 지정상품에 사용할 것이 더욱 분명합니다. 부디 이점을 적극 고려하시어 이건 출원상표에 대하여 우선심사신청을 허여해 주시기 바랍니다.`;
      
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
        reasonText2,
        reasonText3,
        reasonText4
      };
      
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
          <h3>⚠️ 지정상품 정보 불일치</h3>
          <button class="tm-modal-close" onclick="TM.closeGoodsMismatchModal()">✕</button>
        </div>
        <div class="tm-modal-body">
          <p class="tm-modal-desc">2단계에서 지정한 상품 정보와 출원서에서 추출한 정보가 다릅니다.<br>어떤 정보로 우선심사 신청 설명서를 작성하시겠습니까?</p>
          
          <div class="tm-goods-compare">
            <div class="tm-goods-option" data-option="step2" onclick="TM.selectGoodsOption('step2')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-step2" checked>
                <label for="opt-step2"><strong>📋 2단계 지정상품</strong> (프로젝트에 저장된 정보)</label>
              </div>
              <div class="tm-goods-option-content">
                <div class="tm-goods-item"><span class="tm-label">상품류:</span> <span>${step2Class || '-'}</span></div>
                <div class="tm-goods-item"><span class="tm-label">지정상품:</span> <span class="tm-goods-text">${step2Goods.substring(0, 150)}${step2Goods.length > 150 ? '...' : ''}</span></div>
              </div>
            </div>
            
            <div class="tm-goods-option" data-option="extracted" onclick="TM.selectGoodsOption('extracted')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-extracted">
                <label for="opt-extracted"><strong>📄 출원서 추출 정보</strong> (PDF에서 추출한 정보)</label>
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
    
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
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
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.trademarkName, bold: true, size: 28 })]
          }),
          
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
          new Paragraph({
            spacing: { after: 150 },
            children: [new TextRun({ text: data.reasonText2, size: 22 })]
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [new TextRun({ text: data.reasonText3, size: 22 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.reasonText4, size: 22 })]
          }),
          
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
  
  // 스크립트 동적 로드
  TM.loadScript = function(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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
        <h3>📋 종합 요약</h3>
      </div>
      
      <!-- 요약 대시보드 -->
      <div class="tm-summary-dashboard">
        <!-- 상표 정보 카드 -->
        <div class="tm-summary-card tm-card-trademark">
          <div class="tm-card-icon">🏷️</div>
          <div class="tm-card-content">
            <div class="tm-card-title">상표명</div>
            <div class="tm-card-value">${TM.escapeHtml(p.trademarkName) || '-'}</div>
            <div class="tm-card-sub">${TM.getTypeLabel(p.trademarkType)}</div>
          </div>
        </div>
        
        <!-- 지정상품 카드 -->
        <div class="tm-summary-card">
          <div class="tm-card-icon">📦</div>
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
          <div class="tm-card-icon">💰</div>
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
            <h4>👤 출원인</h4>
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
            <h4>📦 지정상품 요약</h4>
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
            <h4>🔍 선행상표 검색</h4>
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
            <h4>💰 비용 명세</h4>
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
        <h4>📥 문서 다운로드</h4>
        <div class="tm-output-buttons">
          <button class="btn btn-primary" data-action="tm-download-docx">
            📝 검토 보고서 (Word)
          </button>
          ${p.priorityExam?.enabled ? `
            <button class="btn btn-secondary" data-action="tm-generate-priority-doc">
              ⚡ 우선심사 설명서 (Word)
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
  // 실무 가이드라인 (LLM 프롬프트에 포함될 참고 정보)
  // - 하드코딩된 규칙이 아닌, LLM이 참고하는 실무 지식
  // ============================================================
  TM.PRACTICE_GUIDELINES = `
【상표출원 지정상품 선택 - 일반화된 판단 프레임워크】

■ 핵심 원칙
1. 상품(1-34류)과 서비스(35-45류)는 명확히 분리된 개념
2. 같은 장소/사업체라도 상품과 서비스는 별도 등록 필요
3. 심사와 침해판단의 핵심 기준은 "유사군코드"
4. 3년 이상 미사용 시 불사용취소심판 가능 → 실제 사용 가능성 고려

■ 각 상품류 판단 기준 (1-45류)

【상품류 1-34류 공통】
- 해당 상품을 직접 제조/생산하면 → 해당 류 필요
- 해당 상품을 구매해서 판매만 하면 → 해당 류 불필요, 35류만 필요
- 해당 상품을 제조+판매하면 → 해당 류 + 35류 둘 다 필요
- OEM/ODM으로 타사 브랜드 제조만 → 해당 류만 필요, 35류 불필요

【1류 - 화학제품】필요: 화학제품 제조업 / 불필요: 화학제품 단순 유통
【2류 - 페인트】필요: 도료 제조업 / 불필요: 페인트 소매점
【3류 - 화장품/세제】필요: 화장품 제조, 자체 브랜드 화장품 / 불필요: 화장품 편집샵(35류만)
【4류 - 연료/윤활유】필요: 정유업, 윤활유 제조 / 불필요: 주유소(서비스)
【5류 - 의약품】필요: 제약회사 / 불필요: 약국(44류 서비스)
【6류 - 금속재료】필요: 금속 가공업 / 불필요: 철물점(35류만)
【7류 - 기계】필요: 기계 제조업 / 불필요: 기계 임대(39류)
【8류 - 수공구】필요: 공구 제조 / 불필요: 공구 판매점(35류만)
【9류 - 전자기기/소프트웨어/앱】
  - 필요: 앱 개발+판매, 전자제품 제조, 소프트웨어 패키지 판매
  - 불필요: 소프트웨어 개발만(42류), 앱 서비스만 제공(42류), 전자제품 판매점(35류만)
【10류 - 의료기기】필요: 의료기기 제조 / 불필요: 의료기기 판매대리점(35류만)
【11류 - 조명/냉난방】필요: 가전제품 제조 / 불필요: 가전 판매점(35류만), 설치(37류)
【12류 - 운송기기】필요: 자동차/자전거 제조 / 불필요: 자동차 딜러(35류), 운송업(39류)
【13류 - 총포/화약】필요: 무기/폭죽 제조 / 불필요: 판매점(35류)
【14류 - 귀금속/시계】필요: 쥬얼리 제조, 시계 브랜드 / 불필요: 귀금속 판매점(35류만)
【15류 - 악기】필요: 악기 제조 / 불필요: 악기 판매점(35류만), 음악교육(41류)
【16류 - 인쇄물/문구】필요: 출판사, 문구 제조 / 불필요: 서점(35류만), 인쇄서비스(40류)
【17류 - 고무/플라스틱】필요: 플라스틱 원료 제조 / 불필요: 포장재 판매(35류)
【18류 - 가죽/가방】필요: 가방 제조, 패션 브랜드 / 불필요: 가방 편집샵(35류만)
【19류 - 건축재료】필요: 건자재 제조 / 불필요: 건자재 유통(35류), 건설(37류)
【20류 - 가구】필요: 가구 제조 / 불필요: 가구 판매점(35류만), 인테리어(37류)
【21류 - 주방용품】필요: 주방용품 제조 / 불필요: 주방용품 판매(35류만)
【22류 - 로프/천막】필요: 로프 제조 / 불필요: 캠핑용품 판매(35류만)
【23류 - 실】필요: 방적업 / 불필요: 수예용품 판매(35류만)
【24류 - 직물/침구】필요: 원단 제조, 침구 브랜드 / 불필요: 침구 판매점(35류만)
【25류 - 의류/신발/모자】
  - 필요: 의류 브랜드, 의류 제조, 자체 디자인 의류
  - 불필요: 의류 편집샵(35류만), 의류 유통업(35류만)
【26류 - 단추/레이스】필요: 부자재 제조 / 불필요: 부자재 판매(35류만)
【27류 - 카펫/벽지】필요: 카펫 제조 / 불필요: 인테리어 자재 판매(35류), 시공(37류)
【28류 - 장난감/게임/스포츠용품】필요: 완구 제조, 스포츠용품 브랜드 / 불필요: 완구점(35류만)
【29류 - 가공식품(육류/유제품)】필요: 식품 제조, 정육업 / 불필요: 식자재 유통(35류만)
【30류 - 커피/빵/과자/조미료】
  - 필요: 식품 제조업, 베이커리 자체 상품, 커피 로스팅
  - 불필요: 커피숍(43류만), 베이커리 매장 영업만(43류만)
  - 주의: 카페에서 원두/빵 포장판매 시 → 30류+35류 추가 필요
【31류 - 농산물/꽃】필요: 농업, 화훼업 / 불필요: 꽃 배달(39류), 꽃집 소매(35류)
【32류 - 음료/맥주】필요: 음료 제조 / 불필요: 음료 유통(35류만), 바/펍(43류)
【33류 - 주류】필요: 양조업, 주류 수입(브랜드) / 불필요: 주류 도매(35류), 바(43류)
【34류 - 담배】필요: 담배 제조 / 불필요: 담배 판매(35류만)

【서비스류 35-45류】

【35류 - 광고/사업관리/도소매】
  - 필요한 경우:
    · 온라인 쇼핑몰 운영 (자사몰, 오픈마켓, 스마트스토어 등)
    · 타사 브랜드 상품 유통/편집샵
    · 프랜차이즈 본부
    · 광고대행업
    · 경영컨설팅
  - 불필요한 경우:
    · 자사 제품만 제조하고 B2B 납품 (유통 없음)
    · 서비스만 제공 (상품 판매 없음)
    · 자사 매장에서 자사 제품만 판매 (논쟁 있음, 방어적 등록 권장)

【36류 - 금융/보험/부동산】
  - 필요: 은행, 보험사, 증권사, 부동산중개
  - 불필요: 부동산 개발(37류), 재무 컨설팅만(35류)

【37류 - 건설/수리/설치】
  - 필요: 건설업, 인테리어, 수리업, 설치업
  - 불필요: 건자재 판매(35류), 건축설계(42류)

【38류 - 통신/방송】
  - 필요: 통신사, 방송사, 인터넷서비스제공(ISP)
  - 불필요: 통신기기 판매(9류+35류), 영상제작(41류)

【39류 - 운송/여행/물류】
  - 필요: 택배, 물류, 여행사, 창고업
  - 불필요: 여행 콘텐츠(41류), 운송기기 판매(12류+35류)

【40류 - 가공/처리】
  - 필요: 인쇄소, 원단가공, 식품가공 서비스
  - 불필요: 가공된 제품 판매(해당 상품류+35류)

【41류 - 교육/엔터테인먼트/스포츠】
  - 필요: 학원, 온라인강의, 공연, 게임서비스, 유튜브채널, 출판
  - 불필요: 교재 판매만(16류+35류), 게임 판매만(9류+35류)
  - 주의: 교육+교재판매 시 → 41류+16류+35류 모두 필요

【42류 - IT서비스/연구개발/디자인】
  - 필요: 소프트웨어개발 서비스, 웹호스팅, 클라우드, 디자인 서비스, R&D
  - 불필요: 소프트웨어 패키지 판매(9류+35류), 디자인 상품 판매(해당 상품류)
  - 주의: SaaS는 42류, 패키지SW 판매는 9류

【43류 - 음식점/숙박】
  - 필요: 레스토랑, 카페, 호텔, 펜션
  - 불필요: 식품 제조판매(29/30류+35류), 음식 배달서비스만(39류)
  - 주의: 카페+원두판매 시 → 43류+30류+35류

【44류 - 의료/미용/농업】
  - 필요: 병원, 미용실, 네일샵, 동물병원, 농업서비스
  - 불필요: 의약품 판매(5류+35류), 화장품 판매(3류+35류)

【45류 - 법률/보안/개인서비스】
  - 필요: 법률사무소, 변리사, 경비업, 결혼중개, 장례서비스
  - 불필요: 보안장비 판매(9류+35류)

■ 복합 사업 판단 예시
1. "커피 로스터리 카페" → 30류(커피원두)+35류(판매)+43류(카페)
2. "온라인 의류 쇼핑몰 + 자체 브랜드" → 25류(의류)+35류(쇼핑몰)
3. "앱 개발 + 앱 판매" → 9류(앱 상품)+42류(개발서비스)+35류(판매)
4. "특허 사무소" → 45류(법률서비스), 35류는 불필요
5. "학원 + 자체 교재" → 41류(교육)+16류(교재)+35류(교재판매)
6. "가구 공방 + 판매" → 20류(가구)+35류(판매)
7. "의류 편집샵 (타브랜드만)" → 35류만
8. "화장품 브랜드 + 온라인몰" → 3류(화장품)+35류(판매)
9. "요식업 프랜차이즈" → 43류(음식점)+35류(프랜차이즈)
10. "게임 개발사 + 앱 출시" → 9류(게임앱)+41류(게임서비스)+42류(개발)
`;

  // ============================================================
  // 1. 비즈니스 분석 - 전면 재설계 v4
  // ============================================================
  // 핵심 원칙:
  // 1. 사업 유형 분류 → 필수 상품류 도출
  // 2. 상품류 간 연관 관계로 확장
  // 3. 사업 확장성 고려
  // 4. 고시명칭 DB에서만 추천
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
      
      // ★★★ 새 분석 시 기존 선택 완전 초기화 ★★★
      p.classes = [];
      p.designatedGoods = [];
      p.aiAnalysis = null;
      console.log('[TM] 기존 선택 초기화 완료');
      
      // ================================================================
      // LLM 기반 사업 분석 (실무 가이드라인 포함)
      // - 하드코딩된 규칙 대신 LLM이 사업 특성을 분석하여 판단
      // - 실무 지식을 프롬프트에 포함하여 정확도 향상
      // ================================================================
      const analysisPrompt = `당신은 10년 이상 경력의 상표 출원 전문 변리사입니다.
고객의 사업을 심층 분석하여 최적의 상품류를 추천하세요.

【고객 정보】
- 상표명: ${p.trademarkName || '미정'}
- 사업 내용: ${businessInput || '미입력'}

${TM.PRACTICE_GUIDELINES}

【분석 시 핵심 원칙】
★★★ 위 가이드라인의 각 류별 판단 기준을 반드시 참고하여 판단하세요 ★★★

1. 상품(1-34류)과 서비스(35-45류)는 별개 개념
   - 같은 사업장이라도 상품과 서비스는 별도 등록 필요
   - 예: 카페 운영(43류) + 원두 판매(30류+35류) = 3개 류

2. 각 류별 "필요/불필요" 판단
   - 해당 상품을 직접 제조하는가? → 해당 상품류 필요
   - 해당 상품을 구매해서 판매만 하는가? → 해당 상품류 불필요, 35류만
   - 해당 서비스를 직접 제공하는가? → 해당 서비스류 필요

3. 35류는 "판매 채널"에 따라 판단 (무조건 추가 금지)
   - 온라인 쇼핑몰/오픈마켓 판매 → 필요
   - B2B 납품만 → 불필요할 수 있음
   - 서비스만 제공 (상품 판매 없음) → 불필요

4. 3년 이상 미사용 시 불사용취소 가능 → 실제 사용 가능성 고려

【분석 항목】
1. 사업 유형 분류
2. 핵심 상품/서비스 식별
3. 판매/유통 채널 분석
4. 사업 확장 가능성
5. 상품류 추천 (3단계로 구분)

【상품류 추천 3단계 기준】
■ 핵심 (core): 현재 사업에 반드시 필요, 없으면 권리 보호 불가
  - 실제로 제조/제공하는 상품/서비스의 류
  - 현재 진행 중인 사업에 직접 해당

■ 권장 (recommended): 권리 보호를 위해 강력히 권장
  - 판매 채널 보호 (온라인 판매 → 35류 등)
  - 관련 서비스 보호 (제품+A/S → 37류 등)
  - 브랜드 확장에 흔히 사용되는 류
  - 경쟁사가 일반적으로 등록하는 류

■ 확장 (expansion): 사업 확장 시 고려할 류
  - 자연스러운 사업 확장 방향
  - 시너지 있는 관련 분야
  - 방어적 등록 고려 대상

【응답 형식 - JSON만】
{
  "businessSummary": "이 사업은 ... (2-3문장으로 구체적으로)",
  "businessTypes": ["PRODUCT", "RETAIL"],
  "coreProducts": ["발레 의류", "댄스복"],
  "coreServices": [],
  "salesChannels": {
    "online": true,
    "offline": false,
    "b2b": false,
    "b2c": true,
    "franchise": false,
    "details": "온라인 자사몰 운영"
  },
  "expansionPotential": ["댄스 용품", "스포츠 의류", "댄스 교육"],
  "classRecommendations": {
    "core": [
      {"class": "25", "reason": "발레 의류, 댄스복 - 핵심 상품", "priority": 1}
    ],
    "recommended": [
      {"class": "35", "reason": "온라인 쇼핑몰 운영 - 소매업 보호 필수", "priority": 1},
      {"class": "18", "reason": "가방, 파우치 - 의류 브랜드 필수 확장", "priority": 2}
    ],
    "expansion": [
      {"class": "28", "reason": "댄스 용품, 스포츠 장비 - 자연스러운 확장", "priority": 1},
      {"class": "41", "reason": "댄스 교육 서비스 - 시너지 사업", "priority": 2},
      {"class": "9", "reason": "댄스 교육 앱/영상 - 디지털 확장", "priority": 3}
    ]
  },
  "searchKeywords": ["발레", "댄스", "의류", "레오타드", "판매"]
}`;

      if (btn) btn.innerHTML = '<span class="tossface">⏳</span> 사업 분석 중...';
      
      console.log('[TM] LLM 기반 사업 분석 시작');
      const analysisResponse = await App.callClaude(analysisPrompt, 4000);
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
      
      // ================================================================
      // 3단계 추천 구조 처리 (핵심/권장/확장)
      // ================================================================
      const classRec = analysis.classRecommendations || {};
      const coreClasses = (classRec.core || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      const recommendedClasses = (classRec.recommended || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      const expansionClasses = (classRec.expansion || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      
      console.log('[TM] ★ 사업 분석 완료 (3단계 추천)');
      console.log('[TM] - 사업 요약:', analysis.businessSummary);
      console.log('[TM] - 핵심 류 (core):', coreClasses);
      console.log('[TM] - 권장 류 (recommended):', recommendedClasses);
      console.log('[TM] - 확장 류 (expansion):', expansionClasses);
      
      // 전체 추천 류 목록 (중복 제거)
      const allClassCodes = [...new Set([
        ...coreClasses.map(c => c.class),
        ...recommendedClasses.map(c => c.class),
        ...expansionClasses.map(c => c.class)
      ])];
      
      // classReasons 구성 (호환성 유지)
      const classReasons = {};
      coreClasses.forEach(c => { classReasons[c.class] = `🔴 핵심: ${c.reason}`; });
      recommendedClasses.forEach(c => { classReasons[c.class] = `🟠 권장: ${c.reason}`; });
      expansionClasses.forEach(c => { classReasons[c.class] = `🟢 확장: ${c.reason}`; });
      
      console.log('[TM] 전체 추천 류:', allClassCodes);
      
      // 사용자 입력에서 키워드 추출
      const userKeywords = TM.extractKeywordsFromInput(businessInput);
      const allKeywords = [...new Set([
        ...userKeywords,
        ...(analysis.searchKeywords || []),
        ...(analysis.coreProducts || []),
        ...(analysis.coreServices || [])
      ])];
      
      console.log('[TM] 검색 키워드:', allKeywords);
      
      p.aiAnalysis = {
        businessAnalysis: analysis.businessSummary || '',
        businessTypes: analysis.businessTypes || [],
        coreProducts: analysis.coreProducts || [],
        coreServices: analysis.coreServices || [],
        salesChannels: analysis.salesChannels || {},
        expansionPotential: analysis.expansionPotential || [],
        coreActivity: (analysis.coreProducts?.[0] || '') + ' ' + (analysis.coreServices?.[0] || ''),
        // ★ 3단계 추천 구조
        classRecommendations: {
          core: coreClasses,
          recommended: recommendedClasses,
          expansion: expansionClasses
        },
        // ★ 호환성을 위한 기존 필드 유지
        recommendedClasses: allClassCodes,
        classReasons: classReasons,
        searchKeywords: allKeywords,
        recommendedGoods: {},
        // ★ 현재 선택된 류 (기본: 핵심+권장만 자동 선택)
        selectedCategories: ['core', 'recommended']
      };
      
      // ================================================================
      // 핵심+권장 류에 대해서만 지정상품 선택 (확장은 사용자 요청 시)
      // ================================================================
      const initialClasses = [
        ...coreClasses.map(c => c.class),
        ...recommendedClasses.map(c => c.class)
      ];
      
      for (const classCode of initialClasses) {
        const paddedCode = classCode.padStart(2, '0');
        
        try {
          if (btn) btn.innerHTML = `<span class="tossface">⏳</span> 제${classCode}류 분석 중...`;
          
          // 3-1. DB에서 고시명칭 조회
          const candidates = await TM.fetchOptimalCandidates(
            paddedCode,
            allKeywords,
            analysis
          );
          
          console.log(`[TM] 제${classCode}류 후보: ${candidates.length}건`);
          
          if (candidates.length === 0) {
            p.aiAnalysis.recommendedGoods[classCode] = [];
            continue;
          }
          
          // 3-2. LLM이 최적 상품 선택
          const selectedGoods = await TM.selectOptimalGoods(
            classCode,
            candidates,
            businessInput,
            analysis
          );
          
          p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
          
          console.log(`[TM] 제${classCode}류 최종: ${selectedGoods.length}건`);
          if (selectedGoods.length > 0) {
            console.log(`[TM]   → ${selectedGoods.slice(0, 3).map(s => s.name).join(', ')}...`);
          }
          
        } catch (classError) {
          console.error(`[TM] 제${classCode}류 처리 실패:`, classError);
          p.aiAnalysis.recommendedGoods[classCode] = [];
        }
      }
      
      // ================================================================
      // 4단계: 추천 결과 3단계 검증 (Validation)
      // ================================================================
      if (btn) btn.innerHTML = '<span class="tossface">🔍</span> 1/3 류 검증 중...';
      
      const validationResult = await TM.validateRecommendations(businessInput, p.aiAnalysis);
      
      if (validationResult) {
        p.aiAnalysis.validation = validationResult;
        
        // 검증 결과 적용 (잘못된 항목 제거 + 대체 추천)
        if (validationResult.hasIssues) {
          if (btn) btn.innerHTML = '<span class="tossface">🔧</span> 검증 결과 적용 중...';
          await TM.applyValidationResult(p.aiAnalysis, validationResult);
        }
        
        console.log('[TM] ✅ 검증 완료');
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
  // DB에서 최적 후보 조회 (사업 맥락 고려)
  // ================================================================
  TM.fetchOptimalCandidates = async function(classCode, keywords, analysis) {
    const results = [];
    const seen = new Set();
    
    console.log(`[TM] ════ DB 검색: 제${classCode}류 ════`);
    
    // 사업 맥락 추출 (필터링용)
    const businessContext = [
      ...(analysis.coreProducts || []),
      ...(analysis.coreServices || []),
      ...(analysis.expansionPotential || [])
    ].join(' ').toLowerCase();
    
    // 혼동 방지용 필터 (동음이의어/유사어 처리)
    const confusionFilters = {
      '생화': ['생화학', '생화학적'],  // 생화(꽃) vs 생화학
      '가구': ['가구원', '한가구'],     // 가구(furniture) vs 가구(家口)
      '화분': ['화분증'],               // 화분(pot) vs 화분(花粉)
    };
    
    // 현재 사업과 관련 없는 키워드 감지
    const getExcludePatterns = (keyword) => {
      const patterns = [];
      for (const [key, excludes] of Object.entries(confusionFilters)) {
        if (keyword.includes(key)) {
          patterns.push(...excludes);
        }
      }
      return patterns;
    };
    
    // 1. 핵심 상품/서비스 키워드로 검색 (최우선)
    const coreTerms = [
      ...(analysis.coreProducts || []),
      ...(analysis.coreServices || [])
    ];
    
    for (const term of coreTerms) {
      const excludePatterns = getExcludePatterns(term);
      
      try {
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode)
          .ilike('goods_name', `%${term}%`)
          .limit(30);
        
        if (data?.length > 0) {
          console.log(`[TM] 핵심 키워드 "${term}" → ${data.length}건`);
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              // 혼동 필터 적용
              const nameLower = item.goods_name.toLowerCase();
              const shouldExclude = excludePatterns.some(p => nameLower.includes(p));
              
              if (shouldExclude) {
                console.log(`[TM] 제외 (혼동방지): ${item.goods_name}`);
                return;
              }
              
              seen.add(item.goods_name);
              results.push({
                name: item.goods_name,
                similarGroup: item.similar_group_code,
                matchType: 'core',
                matchedKeyword: term,
                priority: 0
              });
            }
          });
        }
      } catch (e) {
        console.warn(`[TM] 검색 실패 (${term}):`, e.message);
      }
    }
    
    // 2. 일반 키워드로 검색
    for (const keyword of keywords.slice(0, 15)) {
      if (coreTerms.includes(keyword)) continue;
      
      const excludePatterns = getExcludePatterns(keyword);
      
      try {
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode)
          .ilike('goods_name', `%${keyword}%`)
          .limit(20);
        
        if (data?.length > 0) {
          console.log(`[TM] 키워드 "${keyword}" → ${data.length}건`);
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              // 혼동 필터 적용
              const nameLower = item.goods_name.toLowerCase();
              const shouldExclude = excludePatterns.some(p => nameLower.includes(p));
              
              if (shouldExclude) {
                console.log(`[TM] 제외 (혼동방지): ${item.goods_name}`);
                return;
              }
              
              seen.add(item.goods_name);
              
              // 우선순위 계산
              const kwLower = keyword.toLowerCase();
              let priority = 2;
              
              if (nameLower === kwLower || nameLower === kwLower + '업') {
                priority = 0;
              } else if (nameLower.startsWith(kwLower)) {
                priority = 1;
              }
              
              results.push({
                name: item.goods_name,
                similarGroup: item.similar_group_code,
                matchType: 'keyword',
                matchedKeyword: keyword,
                priority: priority
              });
            }
          });
        }
      } catch (e) {
        // 무시
      }
    }
    
    // 3. 후보가 부족하면 해당 류에서 추가 조회
    if (results.length < 30) {
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
                matchType: 'class',
                priority: 3
              });
            }
          });
        }
      } catch (e) {
        // 무시
      }
    }
    
    // 우선순위순 정렬
    results.sort((a, b) => a.priority - b.priority);
    
    console.log(`[TM] 총 후보: ${results.length}건`);
    if (results.length > 0) {
      console.log(`[TM] 상위: ${results.slice(0, 5).map(r => r.name).join(', ')}`);
    }
    
    return results;
  };
  
  // ================================================================
  // 최적 지정상품 선택 (사업 맥락 + 확장성 고려)
  // ================================================================
  TM.selectOptimalGoods = async function(classCode, candidates, businessText, analysis) {
    const MIN_GOODS = 10;
    const MAX_CORE_MATCH = 5;  // 핵심 키워드당 최대 매칭 수
    const selected = [];
    const usedNames = new Set();
    
    // 1. 핵심 키워드와 직접 매칭되는 상품 자동 포함
    const coreTerms = [
      ...(analysis.coreProducts || []),
      ...(analysis.coreServices || [])
    ];
    
    for (const term of coreTerms) {
      const termLower = term.toLowerCase();
      let termMatchCount = 0;
      
      for (const c of candidates) {
        if (usedNames.has(c.name)) continue;
        if (termMatchCount >= MAX_CORE_MATCH) break;  // 키워드당 최대 5개
        
        const nameLower = c.name.toLowerCase();
        
        // 직접 매칭
        if (nameLower.includes(termLower) || 
            nameLower === termLower + '업' ||
            nameLower === termLower + '서비스업') {
          
          console.log(`[TM] ★ 직접 매칭: "${term}" → "${c.name}"`);
          usedNames.add(c.name);
          selected.push({
            name: c.name,
            similarGroup: c.similarGroup,
            isCore: true,
            reason: `핵심: "${term}"`
          });
          
          termMatchCount++;
        }
      }
    }
    
    console.log(`[TM] 직접 매칭 결과: ${selected.length}개`);
    
    // 2. LLM이 나머지 선택 (관련성 검증 강화)
    if (selected.length < MIN_GOODS && candidates.length > selected.length) {
      const remainingCandidates = candidates.filter(c => !usedNames.has(c.name));
      
      if (remainingCandidates.length > 0) {
        const numberedList = remainingCandidates.slice(0, 40).map((c, i) => 
          `[${i + 1}] ${c.name} (${c.similarGroup || '?'})`
        ).join('\n');
        
        const businessTypes = analysis.businessTypes?.join(', ') || '';
        const expansion = analysis.expansionPotential?.join(', ') || '';
        const coreProducts = analysis.coreProducts?.join(', ') || '';
        const coreServices = analysis.coreServices?.join(', ') || '';
        
        const selectPrompt = `【사업 정보】
- 사업 내용: ${businessText}
- 핵심 상품: ${coreProducts || '없음'}
- 핵심 서비스: ${coreServices || '없음'}
- 사업 유형: ${businessTypes || '미정'}
- 확장 가능: ${expansion || '미정'}

【제${classCode}류 고시명칭 후보】
${numberedList}

【선택 기준 - 매우 중요】
★★★ 반드시 사업 내용과 직접적으로 관련 있는 것만 선택하세요 ★★★

1. "${businessText}"와 관련된 상품/서비스만 선택
2. 유사한 발음이나 글자가 포함되어도 의미가 다르면 제외
   - 예: "꽃/생화(花)" 사업인데 "생화학(化學)" 관련 상품은 제외
   - 예: "가구" 사업인데 "가구(家口=가족)" 관련 상품은 제외
3. 해당 사업의 실제 판매/제공 대상과 맞는 것만 선택

선택할 개수: ${MIN_GOODS - selected.length}개 이하 (관련 있는 것이 없으면 0개도 가능)

응답: 숫자만 쉼표로 (예: 1,2,3) 또는 관련 없으면 "없음"
선택:`;

        try {
          const response = await App.callClaude(selectPrompt, 200);
          const responseText = (response.text || '').trim();
          
          console.log(`[TM] LLM 응답: "${responseText.substring(0, 80)}..."`);
          
          // "없음" 응답 처리
          if (responseText.includes('없음') || responseText.includes('0개') || responseText.includes('해당없음')) {
            console.log('[TM] LLM: 관련 상품 없음');
          } else {
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
                  isCore: false
                });
              }
            }
          }
        } catch (err) {
          console.warn('[TM] LLM 선택 실패:', err.message);
        }
      }
    }
    
    // 3. 부족하면 core/keyword 매칭된 것만 보충 (class 매칭은 제외)
    if (selected.length < MIN_GOODS) {
      console.log(`[TM] ${MIN_GOODS - selected.length}개 보충 필요 (관련 항목만)`);
      
      // core 또는 keyword 매칭된 것만 보충 (class 전체 조회 결과는 제외)
      const relatedCandidates = candidates.filter(c => 
        c.matchType === 'core' || c.matchType === 'keyword'
      );
      
      for (const c of relatedCandidates) {
        if (selected.length >= MIN_GOODS) break;
        if (usedNames.has(c.name)) continue;
        
        usedNames.add(c.name);
        selected.push({
          name: c.name,
          similarGroup: c.similarGroup,
          isCore: false
        });
      }
      
      // 여전히 부족하면 최소 5개만 채움 (관련 없는 것으로 채우지 않음)
      if (selected.length < 5) {
        console.log(`[TM] 관련 후보 부족, ${selected.length}개만 반환`);
      }
    }
    
    console.log(`[TM] 제${classCode}류 최종: ${selected.length}개`);
    
    return selected.slice(0, MIN_GOODS);
  };
  
  // ================================================================
  // 추천 결과 검증 (Validation) - 고도화 버전
  // 3단계 검증: 류 검증 → 지정상품 검증 → 누락 검토
  // ================================================================
  TM.validateRecommendations = async function(businessInput, aiAnalysis) {
    if (!aiAnalysis || !aiAnalysis.recommendedClasses?.length) {
      return null;
    }
    
    console.log('[TM] ════════════════════════════════════');
    console.log('[TM] 추천 결과 3단계 검증 시작');
    console.log('[TM] ════════════════════════════════════');
    
    const validationResult = {
      hasIssues: false,
      overallScore: 100,
      summary: '',
      stages: {
        classValidation: null,
        goodsValidation: null,
        missingReview: null
      },
      invalidClasses: [],
      invalidGoods: [],
      replacementGoods: [],  // 대체 추천된 상품
      warnings: [],
      suggestions: [],
      missingClasses: [],    // 누락된 류
      missingGoods: []       // 누락된 상품
    };
    
    // 검증 데이터 준비
    const classRec = aiAnalysis.classRecommendations || {};
    const allClasses = [
      ...(classRec.core || []),
      ...(classRec.recommended || []),
      ...(classRec.expansion || [])
    ];
    
    // ==============================================
    // 1단계: 류 적합성 검증
    // ==============================================
    console.log('[TM] ▶ 1단계: 류 적합성 검증');
    
    try {
      const classValidationPrompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】
"${businessInput}"

【추천된 상품류】
${allClasses.map(c => `- 제${c.class}류: ${c.reason}`).join('\n')}

【검증 과제】
각 추천 류가 위 사업과 직접적으로 관련 있는지 검증하세요.

검증 기준:
1. 해당 사업에서 실제로 판매하거나 제공하는 상품/서비스가 포함된 류인가?
2. 해당 류 없이 사업을 영위할 수 없는가? (필수성)
3. 추천 이유가 사업 내용과 논리적으로 연결되는가?

【JSON으로만 응답】
{
  "validClasses": [
    {"class": "31", "score": 95, "comment": "꽃 재배 - 핵심 사업과 직접 연결"}
  ],
  "invalidClasses": [
    {"class": "42", "score": 20, "reason": "IT/연구개발 서비스는 이 사업과 무관"}
  ],
  "classScoreAvg": 85
}`;

      const classResponse = await App.callClaude(classValidationPrompt, 1000);
      const classResult = TM.safeJsonParse(classResponse.text);
      
      validationResult.stages.classValidation = classResult;
      
      if (classResult.invalidClasses?.length > 0) {
        validationResult.hasIssues = true;
        validationResult.invalidClasses = classResult.invalidClasses;
        console.log(`[TM] 부적합 류 발견: ${classResult.invalidClasses.map(c => c.class).join(', ')}`);
      }
      
      console.log(`[TM] 류 검증 평균 점수: ${classResult.classScoreAvg || 'N/A'}`);
      
    } catch (e) {
      console.warn('[TM] 1단계 검증 실패:', e.message);
    }
    
    // ==============================================
    // 2단계: 지정상품별 상세 검증
    // ==============================================
    console.log('[TM] ▶ 2단계: 지정상품별 상세 검증');
    
    // 유효한 류만 검증 (1단계에서 무효 판정된 류 제외)
    const invalidClassCodes = validationResult.invalidClasses.map(c => c.class);
    const validClassCodes = aiAnalysis.recommendedClasses.filter(c => !invalidClassCodes.includes(c));
    
    for (const classCode of validClassCodes) {
      const goods = aiAnalysis.recommendedGoods?.[classCode] || [];
      if (goods.length === 0) continue;
      
      try {
        const goodsValidationPrompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】
"${businessInput}"

【제${classCode}류 추천 지정상품】
${goods.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}

【검증 과제】
각 지정상품이 위 사업과 관련 있는지 검증하세요.

★★★ 특히 주의할 오류 유형 ★★★
1. 동음이의어: "생화(꽃)"와 "생화학(화학)", "가구(furniture)"와 "가구(家口)"
2. 부분 문자열 매칭 오류: "꽃" 검색 시 "꽃게", "불꽃" 등 무관한 상품 포함
3. 업종 불일치: 사업 내용과 전혀 다른 분야의 상품
4. 확대 해석: 사업에서 실제로 취급하지 않는 상품

【JSON으로만 응답】
{
  "validGoods": [
    {"name": "생화 소매업", "score": 95, "comment": "꽃 판매와 직접 관련"}
  ],
  "invalidGoods": [
    {"name": "생화학적 촉매 도매업", "score": 5, "reason": "동음이의어 오류 - 생화(꽃)와 생화학(화학) 혼동", "errorType": "homonym"}
  ],
  "suggestedReplacements": [
    {"remove": "생화학적 촉매 도매업", "addInstead": "절화 소매업", "reason": "꽃 판매에 적합"}
  ]
}`;

        const goodsResponse = await App.callClaude(goodsValidationPrompt, 1200);
        const goodsResult = TM.safeJsonParse(goodsResponse.text);
        
        if (goodsResult.invalidGoods?.length > 0) {
          validationResult.hasIssues = true;
          goodsResult.invalidGoods.forEach(g => {
            validationResult.invalidGoods.push({
              classCode: classCode,
              goodsName: g.name,
              reason: g.reason,
              errorType: g.errorType || 'relevance',
              score: g.score
            });
          });
          console.log(`[TM] 제${classCode}류 부적합 상품: ${goodsResult.invalidGoods.map(g => g.name).join(', ')}`);
        }
        
        // 대체 추천 저장
        if (goodsResult.suggestedReplacements?.length > 0) {
          goodsResult.suggestedReplacements.forEach(r => {
            validationResult.replacementGoods.push({
              classCode: classCode,
              remove: r.remove,
              addInstead: r.addInstead,
              reason: r.reason
            });
          });
        }
        
      } catch (e) {
        console.warn(`[TM] 제${classCode}류 검증 실패:`, e.message);
      }
    }
    
    // ==============================================
    // 3단계: 누락 검토 (빠진 류/상품 확인)
    // ==============================================
    console.log('[TM] ▶ 3단계: 누락 검토');
    
    try {
      const missingReviewPrompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】
"${businessInput}"

【현재 추천된 류】
${allClasses.map(c => `제${c.class}류: ${c.reason}`).join('\n')}

【검토 과제】
위 사업을 영위하는데 반드시 필요하지만 누락된 상품류가 있는지 검토하세요.

검토 기준:
1. 사업의 핵심 활동을 보호하기 위해 필수적인 류가 빠졌는가?
2. 판매 채널(온라인/오프라인)에 따른 필수 류가 있는가?
3. 관련 서비스(유지보수, 컨설팅 등)에 필요한 류가 있는가?
4. 경쟁사가 일반적으로 등록하는 류 중 빠진 것이 있는가?

【JSON으로만 응답】
{
  "isSufficient": true/false,
  "missingClasses": [
    {"class": "44", "reason": "꽃 장식/꽃꽂이 서비스는 44류에 해당", "priority": "권장"}
  ],
  "missingGoods": [
    {"classCode": "31", "goodsName": "분재", "reason": "식물 판매 시 분재도 포함 권장"}
  ],
  "overallComment": "전반적인 검토 의견"
}

누락이 없으면 isSufficient: true, missingClasses: [], missingGoods: []로 응답하세요.`;

      const missingResponse = await App.callClaude(missingReviewPrompt, 1000);
      const missingResult = TM.safeJsonParse(missingResponse.text);
      
      validationResult.stages.missingReview = missingResult;
      
      if (missingResult.missingClasses?.length > 0) {
        validationResult.missingClasses = missingResult.missingClasses;
        validationResult.suggestions.push(...missingResult.missingClasses.map(c => ({
          type: 'add_class',
          class: c.class,
          reason: c.reason,
          priority: c.priority
        })));
        console.log(`[TM] 누락된 류 발견: ${missingResult.missingClasses.map(c => c.class).join(', ')}`);
      }
      
      if (missingResult.missingGoods?.length > 0) {
        validationResult.missingGoods = missingResult.missingGoods;
        console.log(`[TM] 누락된 상품 발견: ${missingResult.missingGoods.map(g => g.goodsName).join(', ')}`);
      }
      
    } catch (e) {
      console.warn('[TM] 3단계 검증 실패:', e.message);
    }
    
    // ==============================================
    // 최종 점수 계산 및 요약
    // ==============================================
    const totalIssues = validationResult.invalidClasses.length + validationResult.invalidGoods.length;
    const totalItems = allClasses.length + aiAnalysis.recommendedClasses.reduce((sum, c) => 
      sum + (aiAnalysis.recommendedGoods?.[c]?.length || 0), 0);
    
    validationResult.overallScore = Math.max(0, Math.round(100 - (totalIssues / Math.max(totalItems, 1)) * 100));
    
    // 요약 생성
    if (totalIssues === 0 && validationResult.missingClasses.length === 0) {
      validationResult.summary = '✅ 모든 추천이 사업 내용과 적합합니다.';
    } else {
      const parts = [];
      if (validationResult.invalidClasses.length > 0) {
        parts.push(`부적합 류 ${validationResult.invalidClasses.length}개 제거됨`);
      }
      if (validationResult.invalidGoods.length > 0) {
        parts.push(`부적합 상품 ${validationResult.invalidGoods.length}개 제거됨`);
      }
      if (validationResult.missingClasses.length > 0) {
        parts.push(`추가 권장 류 ${validationResult.missingClasses.length}개`);
      }
      validationResult.summary = parts.join(', ');
    }
    
    console.log('[TM] ════════════════════════════════════');
    console.log(`[TM] 검증 완료 - 점수: ${validationResult.overallScore}점`);
    console.log(`[TM] 요약: ${validationResult.summary}`);
    console.log('[TM] ════════════════════════════════════');
    
    return validationResult;
  };
  
  // ================================================================
  // 검증 결과 적용 (잘못된 항목 제거 + 대체 추천)
  // ================================================================
  TM.applyValidationResult = async function(aiAnalysis, validationResult) {
    if (!validationResult || !validationResult.hasIssues) return;
    
    console.log('[TM] 검증 결과 적용 시작');
    
    // 1. 잘못된 류 제거
    if (validationResult.invalidClasses?.length > 0) {
      for (const invalidClass of validationResult.invalidClasses) {
        const classCode = invalidClass.class;
        
        // recommendedClasses에서 제거
        const idx = aiAnalysis.recommendedClasses.indexOf(classCode);
        if (idx > -1) {
          aiAnalysis.recommendedClasses.splice(idx, 1);
        }
        
        // classRecommendations에서 제거
        ['core', 'recommended', 'expansion'].forEach(cat => {
          if (aiAnalysis.classRecommendations?.[cat]) {
            aiAnalysis.classRecommendations[cat] = 
              aiAnalysis.classRecommendations[cat].filter(c => c.class !== classCode);
          }
        });
        
        // 관련 데이터 제거
        delete aiAnalysis.classReasons?.[classCode];
        delete aiAnalysis.recommendedGoods?.[classCode];
        
        console.log(`[TM] ✗ 제${classCode}류 제거: ${invalidClass.reason}`);
      }
    }
    
    // 2. 잘못된 지정상품 제거
    if (validationResult.invalidGoods?.length > 0) {
      for (const invalidGood of validationResult.invalidGoods) {
        const { classCode, goodsName } = invalidGood;
        
        if (aiAnalysis.recommendedGoods?.[classCode]) {
          const before = aiAnalysis.recommendedGoods[classCode].length;
          aiAnalysis.recommendedGoods[classCode] = 
            aiAnalysis.recommendedGoods[classCode].filter(g => g.name !== goodsName);
          const after = aiAnalysis.recommendedGoods[classCode].length;
          
          if (before !== after) {
            console.log(`[TM] ✗ 제${classCode}류 "${goodsName}" 제거: ${invalidGood.reason}`);
          }
        }
      }
    }
    
    // 3. 대체 상품 추가 (DB에서 조회)
    if (validationResult.replacementGoods?.length > 0) {
      for (const replacement of validationResult.replacementGoods) {
        const { classCode, addInstead, reason } = replacement;
        
        // 이미 있는지 확인
        const existingGoods = aiAnalysis.recommendedGoods?.[classCode] || [];
        const alreadyExists = existingGoods.some(g => g.name === addInstead);
        
        if (!alreadyExists) {
          // DB에서 해당 상품 조회
          try {
            const { data } = await App.sb
              .from('gazetted_goods_cache')
              .select('goods_name, similar_group_code')
              .eq('class_code', classCode)
              .ilike('goods_name', `%${addInstead}%`)
              .limit(1);
            
            if (data?.length > 0) {
              if (!aiAnalysis.recommendedGoods[classCode]) {
                aiAnalysis.recommendedGoods[classCode] = [];
              }
              aiAnalysis.recommendedGoods[classCode].push({
                name: data[0].goods_name,
                similarGroup: data[0].similar_group_code,
                isReplacement: true,
                reason: reason
              });
              console.log(`[TM] ✓ 제${classCode}류 "${data[0].goods_name}" 대체 추가`);
            }
          } catch (e) {
            console.warn(`[TM] 대체 상품 조회 실패: ${addInstead}`);
          }
        }
      }
    }
    
    console.log('[TM] 검증 결과 적용 완료');
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
