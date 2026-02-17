/* ============================================================
   ìƒí‘œì¶œì› ìš°ì„ ì‹¬ì‚¬ ìžë™í™” ì‹œìŠ¤í…œ - trademark.js
   Version: 2.1
   ê¸°ëŠ¥ëª…ì„¸ì„œ v2.1 ê¸°ë°˜ ì™„ì „ êµ¬í˜„
   ============================================================ */

(function() {
  'use strict';

  // ============================================================
  // 1. ìƒíƒœ ê´€ë¦¬
  // ============================================================
  const TM = {
    // í˜„ìž¬ í”„ë¡œì íŠ¸ ìƒíƒœ
    currentProject: null,
    currentStep: 1,
    
    // ì›Œí¬í”Œë¡œìš° ë‹¨ê³„ ì •ì˜
    steps: [
      { id: 1, name: 'ìƒí‘œ ì •ë³´', icon: 'ðŸ·ï¸', key: 'trademark_info' },
      { id: 2, name: 'ì§€ì •ìƒí’ˆ', icon: 'ðŸ“¦', key: 'designated_goods' },
      { id: 3, name: 'ì„ í–‰ìƒí‘œ ê²€ìƒ‰', icon: 'ðŸ”', key: 'prior_search' },
      { id: 4, name: 'ìœ ì‚¬ë„ í‰ê°€', icon: 'âš–ï¸', key: 'similarity' },
      { id: 5, name: 'ë¦¬ìŠ¤í¬ í‰ê°€', icon: 'ðŸ“Š', key: 'risk' },
      { id: 6, name: 'ìš°ì„ ì‹¬ì‚¬', icon: 'âš¡', key: 'priority_exam' },
      { id: 7, name: 'ì¢…í•© ìš”ì•½', icon: 'ðŸ“‹', key: 'summary' }
    ],
    
    // í”„ë¡œì íŠ¸ ë°ì´í„° êµ¬ì¡°
    defaultProjectData: {
      // ìƒí‘œ ì •ë³´
      trademarkName: '',
      trademarkNameEn: '',
      trademarkType: 'text', // text, figure, combined, sound, color, 3d
      specimenUrl: null,
      specimenFile: null,
      
      // ì¶œì›ì¸ ì •ë³´
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
      
      // ì§€ì •ìƒí’ˆ
      designatedGoods: [], // [{classCode, className, goods: [{name, nameEn, gazetted, similarGroup}]}]
      gazettedOnly: true,
      
      // ê²€ìƒ‰ ê²°ê³¼
      searchResults: {
        text: [],
        figure: [],
        viennaCodes: [],
        searchedAt: null
      },
      
      // ìœ ì‚¬ë„ í‰ê°€
      similarityEvaluations: [], // [{targetId, appearance, pronunciation, concept, overall, notes}]
      
      // ë¦¬ìŠ¤í¬ í‰ê°€
      riskAssessment: {
        level: null, // high, medium, low
        conflictCount: 0,
        details: '',
        recommendation: ''
      },
      
      // ë¹„ìš©
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
      
      // ìš°ì„ ì‹¬ì‚¬
      priorityExam: {
        enabled: false,
        reason: '',
        evidences: [], // [{type, title, description, fileUrl}]
        generatedDocument: ''
      },
      
      // AI ë¶„ì„ ê²°ê³¼
      aiAnalysis: {
        businessAnalysis: '',
        recommendedClasses: [],
        viennaCodeSuggestion: [],
        similarityReport: ''
      }
    },
    
    // ìºì‹œ (ì „ì²˜ë¦¬ëœ ë°ì´í„°)
    cache: {
      gazettedGoods: null,
      kiprisApiSpec: null,
      niceClasses: null,
      loadedAt: null
    },
    
    // KIPRIS API ì„¤ì •
    kiprisConfig: {
      baseUrl: 'https://plus.kipris.or.kr/kipo-api/kipi',
      apiKey: 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=', // ê¸°ë³¸ í‚¤ (TM.initì—ì„œ ê³„ì •ë³„ í‚¤ë¡œ êµì²´)
      rateLimit: 30, // ë¶„ë‹¹ í˜¸ì¶œ ì œí•œ
      timeout: 10000
    },
    
    // Supabase ì„¤ì •
    // Supabase: App.sb (common.js에서 초기화됨)
    
    // 2026ë…„ ê´€ë‚©ë£Œ í…Œì´ë¸”
    feeTable: {
      applicationGazetted: 46000,    // ë¥˜ë‹¹ (ì „ìž+ê³ ì‹œëª…ì¹­)
      applicationNonGazetted: 52000, // ë¥˜ë‹¹ (ì „ìž+ë¹„ê³ ì‹œëª…ì¹­)
      applicationPaper: 10000,       // ì„œë©´ ì¶”ê°€
      excessGoods: 2000,             // 10ê°œ ì´ˆê³¼ì‹œ ê°œë‹¹
      priorityExam: 160000,          // ë¥˜ë‹¹ (ê°ë©´ ì—†ìŒ)
      registration10yr: 211000,      // ë¥˜ë‹¹
      reductionRates: {
        sme: 0.70,        // ì¤‘ì†Œê¸°ì—… 70%
        individual: 0.70, // ê°œì¸ 70%
        mid: 0.30,        // ì¤‘ê²¬ê¸°ì—… 30%
        veteran: 1.00,    // êµ­ê°€ìœ ê³µìž 100%
        disabled: 1.00,   // ìž¥ì• ì¸ 100%
        age: 0.85         // 19~30ì„¸ ë˜ëŠ” 65ì„¸+ 85%
      }
    },
    
    // NICE ë¶„ë¥˜ (45ë¥˜)
    niceClasses: {
      '01': 'ê³µì—…ìš©Â·ê³¼í•™ìš©Â·ì‚¬ì§„ìš© í™”í•™ì œí’ˆ',
      '02': 'íŽ˜ì¸íŠ¸, ë‹ˆìŠ¤, ëž˜ì»¤',
      '03': 'í™”ìž¥í’ˆ, ì„¸ì •ì œ',
      '04': 'ê³µì—…ìš© ì˜¤ì¼, ìœ¤í™œì œ',
      '05': 'ì•½ì œ, ì˜ë£Œìš© ì œì œ',
      '06': 'ë¹„ê¸ˆì† ì¼ë°˜, ê¸ˆì†ì œí’ˆ',
      '07': 'ê¸°ê³„, ê³µìž‘ê¸°ê³„',
      '08': 'ìˆ˜ê³µêµ¬, ë„ê²€ë¥˜',
      '09': 'ê³¼í•™ê¸°ê¸°, ì „ê¸°ê¸°ê¸°, ì»´í“¨í„°',
      '10': 'ì˜ë£Œê¸°ê¸°',
      '11': 'ì¡°ëª…, ë‚œë°©, ëƒ‰ë°©ìž¥ì¹˜',
      '12': 'ì°¨ëŸ‰, í•­ê³µê¸°, ì„ ë°•',
      '13': 'í™”ê¸°, í­ë°œë¬¼',
      '14': 'ê·€ê¸ˆì†, ì‹œê³„',
      '15': 'ì•…ê¸°',
      '16': 'ì¢…ì´, ì¸ì‡„ë¬¼, ë¬¸ë°©êµ¬',
      '17': 'ê³ ë¬´, í”Œë¼ìŠ¤í‹± ë°˜ì œí’ˆ',
      '18': 'ê°€ì£½, ê°€ë°©, ìš°ì‚°',
      '19': 'ë¹„ê¸ˆì† ê±´ì¶•ìž¬ë£Œ',
      '20': 'ê°€êµ¬, ê±°ìš¸, ì•¡ìž',
      '21': 'ê°€ì •ìš© ê¸°êµ¬, ìœ ë¦¬ì œí’ˆ',
      '22': 'ë¡œí”„, í…íŠ¸, í¬ëŒ€',
      '23': 'ë°©ì ìš© ì‚¬',
      '24': 'ì§ë¬¼, ì¹¨êµ¬ë¥˜',
      '25': 'ì˜ë¥˜, ì‹ ë°œ, ëª¨ìž',
      '26': 'ë ˆì´ìŠ¤, ìžìˆ˜, ë¦¬ë³¸',
      '27': 'ë°”ë‹¥ìž¬, ë²½ì§€',
      '28': 'ê²Œìž„, ìž¥ë‚œê°, ìš´ë™ê¸°êµ¬',
      '29': 'ìœ¡ë¥˜, ê°€ê³µì‹í’ˆ',
      '30': 'ì»¤í”¼, ì°¨, ì¡°ë¯¸ë£Œ',
      '31': 'ë†ì‚°ë¬¼, ì›ì˜ˆ, ì‚¬ë£Œ',
      '32': 'ë§¥ì£¼, ìŒë£Œ',
      '33': 'ì•Œì½”ì˜¬ ìŒë£Œ',
      '34': 'ë‹´ë°°, í¡ì—°ìš©í’ˆ',
      '35': 'ê´‘ê³ , ì‚¬ì—…ê´€ë¦¬',
      '36': 'ë³´í—˜, ê¸ˆìœµ, ë¶€ë™ì‚°',
      '37': 'ê±´ì„¤, ìˆ˜ë¦¬',
      '38': 'í†µì‹ ',
      '39': 'ìš´ì†¡, ì—¬í–‰',
      '40': 'ìž¬ë£Œì²˜ë¦¬',
      '41': 'êµìœ¡, ì—”í„°í…Œì¸ë¨¼íŠ¸',
      '42': 'IT, ê³¼í•™ê¸°ìˆ  ì„œë¹„ìŠ¤',
      '43': 'ìŒì‹/ìŒë£Œ ì œê³µ, ìˆ™ë°•',
      '44': 'ì˜ë£Œ, ë¯¸ìš©, ë†ì—…',
      '45': 'ë²•ë¥ , ë³´ì•ˆ, ê°œì¸ì„œë¹„ìŠ¤'
    }
  };

  // ============================================================
  // 2. ì´ˆê¸°í™”
  // ============================================================
  
  TM.init = async function() {
    console.log('[TM] ìƒí‘œ ëª¨ë“ˆ ì´ˆê¸°í™” ì‹œìž‘');
    
    try {
      // â˜… ê³„ì •ë³„ KIPRIS API í‚¤ ë¡œë“œ
      TM.loadKiprisKeyFromProfile();
      
      // ìºì‹œ ë¡œë“œ (ê³ ì‹œëª…ì¹­, API ìŠ¤íŽ™)
      await TM.loadCaches();
      
      // ì´ë²¤íŠ¸ ë¦¬ìŠ¤ë„ˆ ë“±ë¡
      TM.bindEvents();
      
      // ëŒ€ì‹œë³´ë“œ ë Œë”ë§
      TM.renderDashboard();
      
      console.log('[TM] ìƒí‘œ ëª¨ë“ˆ ì´ˆê¸°í™” ì™„ë£Œ');
    } catch (error) {
      console.error('[TM] ì´ˆê¸°í™” ì‹¤íŒ¨:', error);
      App.showToast('ìƒí‘œ ëª¨ë“ˆ ì´ˆê¸°í™” ì‹¤íŒ¨', 'error');
    }
  };
  
  // ★ KIPRIS 키는 common.js apiKeys.kipris에서 통합 관리 (v5.4)
  TM.loadKiprisKeyFromProfile = function() {
    var key = App.apiKeys ? App.apiKeys.kipris : '';
    TM.kiprisConfig.apiKey = key || App.DEFAULT_KIPRIS_KEY || 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    console.log('[TM] KIPRIS API 키: ' + (key ? '계정 키 로드됨' : '기본값 사용'));
  };
  // ★ KIPRIS 키 저장: common.js의 apiKeys.kipris + Supabase 동기화 (v5.4)
  TM.saveKiprisKeyToProfile = async function(kiprisKey) {
    // common.js의 중앙 apiKeys 업데이트
    if (App.apiKeys) App.apiKeys.kipris = kiprisKey || '';
    TM.kiprisConfig.apiKey = kiprisKey || App.DEFAULT_KIPRIS_KEY || 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    // Supabase에 저장
    var userId = App.currentUser?.id;
    if (!userId) return;
    try {
      var data = {claude:App.apiKeys.claude||'',gpt:App.apiKeys.gpt||'',gemini:App.apiKeys.gemini||'',kipris:App.apiKeys.kipris||'',provider:App.getProvider()?.short?.toLowerCase()||'claude'};
      await App.sb.from('profiles').update({api_key_encrypted:JSON.stringify(data)}).eq('id',userId);
      if(App.currentProfile)App.currentProfile.api_key_encrypted=JSON.stringify(data);
      if(App._lsSet)App._lsSet('api_key_kipris',kiprisKey||'');
      console.log('[TM] KIPRIS API 키: Supabase 저장 완료');
    } catch(error) {
      console.error('[TM] KIPRIS API 키 저장 실패:', error);
    }
  };
// ============================================================
  // 3. ìºì‹œ ì´ˆê¸°í™” (ê³ ì‹œëª…ì¹­ì€ DBì—ì„œ ì§ì ‘ ê²€ìƒ‰)
  // ============================================================
  
  TM.loadCaches = async function() {
    console.log('[TM] ìºì‹œ ì´ˆê¸°í™”');
    
    // ê³ ì‹œëª…ì¹­ì€ 5ë§Œê±´ì´ë¯€ë¡œ í´ë¼ì´ì–¸íŠ¸ì— ë¡œë“œí•˜ì§€ ì•ŠìŒ
    // ê²€ìƒ‰ ì‹œ DBì—ì„œ ì§ì ‘ ì¿¼ë¦¬
    TM.cache.gazettedGoods = [];
    
    // DB ì—°ê²° í™•ì¸ (ê±´ìˆ˜ë§Œ ì²´í¬)
    try {
      const { count, error } = await App.sb
        .from('gazetted_goods_cache')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn('[TM] DB ì—°ê²° í™•ì¸ ì‹¤íŒ¨:', error);
      } else {
        console.log(`[TM] ê³ ì‹œëª…ì¹­ DB ì—°ê²° í™•ì¸: ${count?.toLocaleString()}ê±´`);
      }
    } catch (e) {
      console.warn('[TM] DB ì—°ê²° í™•ì¸ ì˜ˆì™¸:', e);
    }
    
    TM.cache.kiprisApiSpec = null;
    TM.cache.loadedAt = new Date().toISOString();
  };

  // ============================================================
  // 4. ì´ë²¤íŠ¸ ë°”ì¸ë”©
  // ============================================================
  
  TM.bindEvents = function() {
    // íƒ­ íŒ¨ë„ ë‚´ ì´ë²¤íŠ¸ ìœ„ìž„
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel) return;
    
    panel.addEventListener('click', TM.handleClick);
    panel.addEventListener('input', TM.handleInput);
    panel.addEventListener('change', TM.handleChange);
    
    // ë¸Œë¼ìš°ì € ë’¤ë¡œê°€ê¸°/ì•žìœ¼ë¡œê°€ê¸° ì²˜ë¦¬
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.tmModule) {
        if (e.state.view === 'dashboard') {
          // ëŒ€ì‹œë³´ë“œë¡œ ëŒì•„ê°€ê¸° (ì €ìž¥ ì—†ì´)
          TM.currentProject = null;
          TM.renderDashboard(true); // skipHistory = true
        } else if (e.state.view === 'project' && e.state.projectId) {
          // í”„ë¡œì íŠ¸ ì—´ê¸° (ì €ìž¥ ì—†ì´)
          TM.openProject(e.state.projectId, true); // skipHistory = true
        }
      }
    });
    
    // ì´ˆê¸° ìƒíƒœ ì„¤ì • (ëŒ€ì‹œë³´ë“œ)
    if (!history.state || !history.state.tmModule) {
      history.replaceState({ tmModule: true, view: 'dashboard' }, '', window.location.href);
    }
    
    // ë’¤ë¡œê°€ê¸°(Backspace) í‚¤ ì²˜ë¦¬ - ì´ì „ ìŠ¤í…ìœ¼ë¡œ ì´ë™
    document.addEventListener('keydown', (e) => {
      // input, textarea ë“±ì—ì„œëŠ” ë¬´ì‹œ
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Backspace í‚¤
      if (e.key === 'Backspace') {
        e.preventDefault();
        
        // í”„ë¡œì íŠ¸ê°€ ì—´ë ¤ìžˆê³  ìŠ¤í…ì´ 1ë³´ë‹¤ í¬ë©´ ì´ì „ ìŠ¤í…ìœ¼ë¡œ
        if (TM.currentProject && TM.currentProject.currentStep > 1) {
          TM.prevStep();
        } else if (TM.currentProject) {
          // ìŠ¤í… 1ì´ë©´ ëŒ€ì‹œë³´ë“œë¡œ
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
    
    // íŽ¸ì§‘/ì‚­ì œ/ì œê±° ë²„íŠ¼ì€ ì´ë²¤íŠ¸ ì „íŒŒ ì¤‘ì§€ (ì¹´ë“œ í´ë¦­ê³¼ ì¶©ëŒ ë°©ì§€)
    if (action === 'tm-edit-project' || action === 'tm-delete-project' || 
        action === 'tm-remove-goods' || action === 'tm-remove-class') {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // ì¹´ë“œ ë‚´ë¶€ì˜ ë²„íŠ¼ í´ë¦­ ì‹œ, ì¹´ë“œ ì´ë²¤íŠ¸ ë¬´ì‹œ
    if (target.tagName === 'BUTTON' && target.closest('.tm-project-card')) {
      // ë²„íŠ¼ í´ë¦­ì´ë©´ ì¹´ë“œì˜ open-project ì‹¤í–‰ ì•ˆ í•¨
      if (action !== 'tm-open-project') {
        e.stopPropagation();
      }
    }
    
    console.log('[TM] Click action:', action, params);
    
    switch (action) {
      // í”„ë¡œì íŠ¸ ê´€ë ¨
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
        // ë²„íŠ¼ì´ ì•„ë‹Œ ì¹´ë“œ í´ë¦­ì¸ ê²½ìš°ì—ë§Œ ì‹¤í–‰
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
        
      // ìŠ¤í… ë„¤ë¹„ê²Œì´ì…˜
      case 'tm-goto-step':
        TM.goToStep(parseInt(params.step));
        break;
      case 'tm-next-step':
        TM.nextStep();
        break;
      case 'tm-prev-step':
        TM.prevStep();
        break;
        
      // ì§€ì •ìƒí’ˆ ê´€ë ¨
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
        
      // ê²€ìƒ‰ ê´€ë ¨
      case 'tm-search-text':
        TM.searchByText();
        break;
      case 'tm-search-figure':
        TM.searchByFigure();
        break;
      case 'tm-analyze-vienna':
        TM.analyzeViennaCode();
        break;
        
      // AI ë¶„ì„
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
        
      // ì¦ê±°ìžë£Œ
      case 'tm-add-evidence':
        TM.addEvidence();
        break;
      case 'tm-remove-evidence':
        TM.removeEvidence(params.index);
        break;
        
      // ì¶œë ¥
      case 'tm-download-docx':
        TM.downloadDocx();
        break;
      case 'tm-download-hwp':
        TM.downloadHwp();
        break;
      case 'tm-preview-document':
        TM.previewDocument();
        break;
        
      // ë¹„ìš© ê³„ì‚°
      case 'tm-calc-fee':
        TM.calculateFee();
        break;
        
      // ë¹„ê³ ì‹œëª…ì¹­ ì²˜ë¦¬
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
    
    // í”„ë¡œì íŠ¸ ë°ì´í„° ì—…ë°ì´íŠ¸
    TM.updateField(field, value);
  };
  
  TM.handleChange = function(e) {
    const target = e.target;
    
    // íŒŒì¼ ì—…ë¡œë“œ
    if (target.type === 'file' && target.dataset.field === 'specimen') {
      TM.handleSpecimenUpload(target.files[0]);
    }
    
    // ì²´í¬ë°•ìŠ¤
    if (target.type === 'checkbox' && target.dataset.field) {
      TM.updateField(target.dataset.field, target.checked);
    }
    
    // ë¼ë””ì˜¤
    if (target.type === 'radio' && target.dataset.field) {
      TM.updateField(target.dataset.field, target.value);
    }
  };

  // ============================================================
  // 5. ëŒ€ì‹œë³´ë“œ (í”„ë¡œì íŠ¸ ëª©ë¡)
  // ============================================================
  
  TM.renderDashboard = async function(skipHistory = false) {
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel) return;
    
    // ížˆìŠ¤í† ë¦¬ ê´€ë¦¬ (ë¸Œë¼ìš°ì € ë’¤ë¡œê°€ê¸° ì§€ì›)
    if (!skipHistory && TM.currentProject) {
      // í”„ë¡œì íŠ¸ì—ì„œ ëŒ€ì‹œë³´ë“œë¡œ ì „í™˜í•  ë•Œë§Œ ížˆìŠ¤í† ë¦¬ ì¶”ê°€
      history.pushState({ tmModule: true, view: 'dashboard' }, '', window.location.href);
    }
    
    panel.innerHTML = `
      <div class="trademark-dashboard" style="max-width: 1400px; margin: 0 auto; padding: 40px 32px;">
        <!-- ì¢Œì¸¡: í—¤ë” + ë²„íŠ¼ / ìš°ì¸¡: í…Œì´ë¸” -->
        <div style="display: flex; gap: 40px; align-items: flex-start;">
          <!-- ì¢Œì¸¡ ì˜ì—­ -->
          <div style="flex-shrink: 0; width: 240px;">
            <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #1f2937;">ðŸ·ï¸ ìƒí‘œ ì¶œì› ê´€ë¦¬</h2>
            <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 13px; line-height: 1.5;">íŠ¹í—ˆê·¸ë£¹ ë””ë”¤ ìƒí‘œ ì¶œì› í”„ë¡œì íŠ¸ë¥¼ ê´€ë¦¬í•©ë‹ˆë‹¤.</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button class="btn btn-primary" onclick="window.TM.createNewProject(); return false;" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 10px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3); white-space: nowrap; cursor: pointer;">
                <span style="font-size: 18px;">+</span>
                ìƒˆ í”„ë¡œì íŠ¸
              </button>
              <button id="tm-settings-btn" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13px; font-weight: 500; border-radius: 8px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; white-space: nowrap; cursor: pointer;">
                <span style="font-size: 16px;">âš™ï¸</span>
                ì„¤ì •
              </button>
            </div>
            
            <!-- API ì•ˆë‚´ -->
            <div style="margin-top: 20px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #0369a1;">ðŸ’¡ KIPRIS API í‚¤ ì•ˆë‚´</p>
              <p style="margin: 0; font-size: 11px; color: #0c4a6e; line-height: 1.5;">
                ì„ í–‰ìƒí‘œ ê²€ìƒ‰ì„ ìœ„í•´ KIPRIS API í‚¤ê°€ í•„ìš”í•©ë‹ˆë‹¤.
                <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank" style="color: #2563eb; text-decoration: underline;">KIPRIS Plus</a>ì—ì„œ ë°œê¸‰ë°›ìœ¼ì„¸ìš”.
              </p>
            </div>
          </div>
          
          <!-- ìš°ì¸¡: í”„ë¡œì íŠ¸ ëª©ë¡ -->
          <div class="tm-project-list" id="tm-project-list" style="flex: 1; min-width: 0;">
            <div style="text-align: center; padding: 40px; color: #6b7280;">
              <div class="tm-loading-spinner" style="width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
              <p style="margin: 0;">í”„ë¡œì íŠ¸ ëª©ë¡ ë¡œë”© ì¤‘...</p>
            </div>
          </div>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    
    await TM.loadProjectList();
    
    // ì„¤ì • ë²„íŠ¼ ì´ë²¤íŠ¸ ë°”ì¸ë”©
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
  // ì„¤ì • ëª¨ë‹¬
  // ============================================================
  
  TM.openSettings = function() {
    // ★ v5.4: KIPRIS 키는 메인 계정설정에서 통합 관리
    const currentApiKey = TM.kiprisConfig.apiKey || '';
    const isDefault = !currentApiKey || currentApiKey === (App.DEFAULT_KIPRIS_KEY || 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=');
    
    const modal = document.createElement('div');
    modal.id = 'tm-settings-modal';
    modal.innerHTML = `
      <div class="tm-modal-overlay" onclick="TM.closeSettings()">
        <div class="tm-modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
          <div class="tm-modal-header">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">⚙️ 상표 출원 설정</h3>
            <button class="tm-modal-close" onclick="TM.closeSettings()">✕</button>
          </div>
          
          <div class="tm-modal-body" style="padding: 24px;">
            <!-- KIPRIS API 키 상태 -->
            <div class="tm-settings-section">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">
                🔑 KIPRIS API 키
              </h4>
              <div style="padding: 12px; background: ${isDefault ? '#fef3c7' : '#d1fae5'}; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-size: 13px; color: ${isDefault ? '#92400e' : '#065f46'}; font-weight: 500;">
                  ${isDefault ? '⚠️ 기본키 사용 중 — 개인 키를 설정하면 더 안정적입니다' : '✅ 개인 키 설정됨'}
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="TM.closeSettings();openProfileSettings();" style="width:100%;padding:10px;">
                🛠️ 메인 계정설정에서 KIPRIS 키 변경
              </button>
            </div>
            
            <!-- 자동 저장 설정 -->
            <div class="tm-settings-section" style="margin-top: 20px;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">
                💾 자동 저장
              </h4>
              <div style="font-size: 13px; color: #374151; line-height: 1.6;">
                <div>• 입력 후 3초 후 자동 저장</div>
                <div>• 15초마다 주기적 저장</div>
              </div>
            </div>
            
            <!-- 현재 상태 -->
            <div class="tm-settings-section" style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">
                ℹ️ 현재 상태
              </h4>
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                <div>• KIPRIS API 키: ${isDefault ? '⚠️ 기본키' : '✅ 설정됨'}</div>
                <div>• 자동 저장: ✅ 활성화됨</div>
              </div>
            </div>
          </div>
          
          <div class="tm-modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" onclick="TM.closeSettings()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
              확인
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };
TM.saveSettings = function() {
    // ★ v5.4: KIPRIS 키는 메인 계정설정에서만 관리
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
        listEl.innerHTML = `
          <div style="text-align: center; padding: 80px 20px; background: #f9fafb; border-radius: 16px; border: 2px dashed #d1d5db;">
            <div style="font-size: 56px; margin-bottom: 20px;">ðŸ·ï¸</div>
            <h4 style="margin: 0 0 12px; font-size: 20px; color: #374151;">ìƒí‘œ í”„ë¡œì íŠ¸ê°€ ì—†ìŠµë‹ˆë‹¤</h4>
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px;">ìƒˆ í”„ë¡œì íŠ¸ë¥¼ ë§Œë“¤ì–´ ìƒí‘œ ì¶œì›ì„ ì‹œìž‘í•˜ì„¸ìš”.</p>
            <button class="btn btn-primary" data-action="tm-new-project" style="padding: 14px 28px; font-size: 15px; border-radius: 10px;">+ ìƒˆ í”„ë¡œì íŠ¸ ë§Œë“¤ê¸°</button>
          </div>
        `;
        return;
      }
      
      // í…Œì´ë¸” í˜•ì‹ ëª©ë¡
      listEl.innerHTML = `
        <div style="background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 13px; white-space: nowrap;">ë””ë”¤ ê´€ë¦¬ë²ˆí˜¸</th>
                <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 13px; white-space: nowrap;">ìƒí‘œëª…</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 70px; white-space: nowrap;">ìœ í˜•</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 80px; white-space: nowrap;">ìƒíƒœ</th>
                <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 90px; white-space: nowrap;">ìˆ˜ì •ì¼</th>
                <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; width: 140px; white-space: nowrap;">ìž‘ì—…</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map(p => TM.renderProjectRow(p)).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 12px; text-align: right; color: #9ca3af; font-size: 12px;">
          ì´ ${projects.length}ê°œ í”„ë¡œì íŠ¸
        </div>
      `;
      
    } catch (error) {
      console.error('[TM] í”„ë¡œì íŠ¸ ëª©ë¡ ë¡œë“œ ì‹¤íŒ¨:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
          <div style="font-size: 32px; margin-bottom: 12px;">âš ï¸</div>
          <h4 style="margin: 0 0 8px; color: #991b1b;">ë¡œë“œ ì‹¤íŒ¨</h4>
          <p style="margin: 0; color: #dc2626;">${error.message}</p>
        </div>
      `;
    }
  };
  
  // í”„ë¡œì íŠ¸ í–‰ ë Œë”ë§ (í…Œì´ë¸”ìš©)
  TM.renderProjectRow = function(project) {
    const statusLabels = {
      draft: 'ìž‘ì„± ì¤‘',
      searching: 'ê²€ìƒ‰ ì¤‘',
      documenting: 'ë¬¸ì„œ ìž‘ì„±',
      completed: 'ì™„ë£Œ'
    };
    
    const statusColors = {
      draft: '#f59e0b',
      searching: '#3b82f6',
      documenting: '#8b5cf6',
      completed: '#10b981'
    };
    
    const typeLabels = {
      text: 'ë¬¸ìž',
      figure: 'ë„í˜•',
      combined: 'ê²°í•©',
      sound: 'ì†Œë¦¬',
      color: 'ìƒ‰ì±„',
      '3d': 'ìž…ì²´'
    };
    
    const updatedAt = new Date(project.updated_at).toLocaleDateString('ko-KR');
    const statusColor = statusColors[project.status] || '#6b7280';
    
    return `
      <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;" 
          onmouseover="this.style.background='#f9fafb'" 
          onmouseout="this.style.background='white'">
        <td style="padding: 12px 16px; white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">ðŸ“</span>
            <span style="font-weight: 600; color: #3b82f6; font-size: 13px; cursor: pointer;" 
                 onclick="TM.openProject('${project.id}')"
                 onmouseover="this.style.textDecoration='underline'" 
                 onmouseout="this.style.textDecoration='none'">${TM.escapeHtml(project.title || '(ë¯¸ì§€ì •)')}</span>
          </div>
        </td>
        <td style="padding: 12px 16px; white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">ðŸ·ï¸</span>
            <span style="font-weight: 500; color: #1f2937; font-size: 13px;">${TM.escapeHtml(project.trademark_name || '-')}</span>
          </div>
        </td>
        <td style="padding: 12px 12px; text-align: center; white-space: nowrap;">
          <span style="font-size: 12px; color: #6b7280;">${typeLabels[project.trademark_type] || 'ë¬¸ìž'}</span>
        </td>
        <td style="padding: 12px 12px; text-align: center; white-space: nowrap;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: ${statusColor}15; color: ${statusColor};">${statusLabels[project.status] || 'ìž‘ì„± ì¤‘'}</span>
        </td>
        <td style="padding: 12px 12px; text-align: center; font-size: 12px; color: #6b7280; white-space: nowrap;">
          ${updatedAt}
        </td>
        <td style="padding: 12px 16px; text-align: center; white-space: nowrap;">
          <div style="display: inline-flex; gap: 4px; align-items: center;">
            <button onclick="TM.openProject('${project.id}')" 
                    style="padding: 4px 8px; font-size: 11px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
                    onmouseover="this.style.background='#2563eb'" 
                    onmouseout="this.style.background='#3b82f6'">ì—´ê¸°</button>
            <button onclick="TM.editProject('${project.id}', '${TM.escapeHtml(project.title || '').replace(/'/g, "\\'")}')" 
                    style="padding: 4px 8px; font-size: 11px; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
                    onmouseover="this.style.background='#e5e7eb'" 
                    onmouseout="this.style.background='#f3f4f6'">íŽ¸ì§‘</button>
            <button onclick="TM.deleteProject('${project.id}')" 
                    style="padding: 4px 8px; font-size: 11px; background: #fef2f2; color: #dc2626; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
                    onmouseover="this.style.background='#fee2e2'" 
                    onmouseout="this.style.background='#fef2f2'">ì‚­ì œ</button>
          </div>
        </td>
      </tr>
    `;
  };

  // ============================================================
  // 6. í”„ë¡œì íŠ¸ CRUD
  // ============================================================
  
  TM.createNewProject = async function() {
    // ë…„ë„ ê¸°ë°˜ ê¸°ë³¸ê°’ ìƒì„± (26T í˜•ì‹)
    const year = String(new Date().getFullYear()).slice(-2); // 26
    const defaultNumber = `${year}T`;
    
    const managementNumber = prompt(
      'ë””ë”¤ ê´€ë¦¬ë²ˆí˜¸ë¥¼ ìž…ë ¥í•˜ì„¸ìš”:\n(íŠ¹í—ˆê·¸ë£¹ ë””ë”¤ ë‚´ë¶€ ì‚¬ê±´ ì‹ë³„ë²ˆí˜¸)\n\nì˜ˆ: 26T0001, 26T0002',
      defaultNumber
    );
    if (!managementNumber || !managementNumber.trim()) return;
    
    try {
      App.showToast('í”„ë¡œì íŠ¸ ìƒì„± ì¤‘...', 'info');
      
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
      
      App.showToast('í”„ë¡œì íŠ¸ê°€ ìƒì„±ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      TM.openProject(data.id);
      
    } catch (error) {
      console.error('[TM] í”„ë¡œì íŠ¸ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('í”„ë¡œì íŠ¸ ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  TM.openProject = async function(projectId, skipHistory = false) {
    try {
      App.showToast('í”„ë¡œì íŠ¸ ë¡œë”© ì¤‘...', 'info');
      
      const { data, error } = await App.sb
        .from('trademark_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      
      // í”„ë¡œì íŠ¸ ìƒíƒœ ì„¤ì •
      TM.currentProject = {
        id: data.id,
        title: data.title,
        status: data.status,
        ...TM.defaultProjectData,
        ...(data.current_state_json || {})
      };
      
      // ê¸°ì¡´ í•„ë“œ ë§¤í•‘
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
      
      // ížˆìŠ¤í† ë¦¬ ê´€ë¦¬ (ë¸Œë¼ìš°ì € ë’¤ë¡œê°€ê¸° ì§€ì›)
      if (!skipHistory) {
        history.pushState({ tmModule: true, view: 'project', projectId: projectId }, '', window.location.href);
      }
      
      // ì›Œí¬ìŠ¤íŽ˜ì´ìŠ¤ ë Œë”ë§
      TM.renderWorkspace();
      
      // ìžë™ ì €ìž¥ ì‹œìž‘
      TM.startAutoSave();
      
      App.showToast('í”„ë¡œì íŠ¸ë¥¼ ë¶ˆëŸ¬ì™”ìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] í”„ë¡œì íŠ¸ ì—´ê¸° ì‹¤íŒ¨:', error);
      App.showToast('í”„ë¡œì íŠ¸ ì—´ê¸° ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  TM.saveProject = async function(silent = false) {
    if (!TM.currentProject || !TM.currentProject.id) {
      if (!silent) App.showToast('ì €ìž¥í•  í”„ë¡œì íŠ¸ê°€ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    try {
      if (!silent) App.showToast('ì €ìž¥ ì¤‘...', 'info');
      
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
        },
        updated_at: new Date().toISOString()
      };
      
      const { error } = await App.sb
        .from('trademark_projects')
        .update(updateData)
        .eq('id', TM.currentProject.id);
      
      if (error) throw error;
      
      TM.hasUnsavedChanges = false;
      if (!silent) {
        App.showToast('ì €ìž¥ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      } else {
        console.log('[TM] ìžë™ ì €ìž¥ ì™„ë£Œ');
      }
      
    } catch (error) {
      console.error('[TM] ì €ìž¥ ì‹¤íŒ¨:', error);
      if (!silent) App.showToast('ì €ìž¥ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  TM.deleteProject = async function(projectId) {
    if (!confirm('ì´ í”„ë¡œì íŠ¸ë¥¼ ì‚­ì œí•˜ì‹œê² ìŠµë‹ˆê¹Œ? ì´ ìž‘ì—…ì€ ë˜ëŒë¦´ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.')) {
      return;
    }
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      
      App.showToast('í”„ë¡œì íŠ¸ê°€ ì‚­ì œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
      // í˜„ìž¬ ì—´ë¦° í”„ë¡œì íŠ¸ì˜€ë‹¤ë©´ ëŒ€ì‹œë³´ë“œë¡œ
      if (TM.currentProject && TM.currentProject.id === projectId) {
        TM.currentProject = null;
        TM.renderDashboard();
      } else {
        TM.loadProjectList();
      }
      
    } catch (error) {
      console.error('[TM] ì‚­ì œ ì‹¤íŒ¨:', error);
      App.showToast('ì‚­ì œ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // í”„ë¡œì íŠ¸ íŽ¸ì§‘ (ì´ë¦„ ë³€ê²½)
  TM.editProject = async function(projectId, currentTitle) {
    const newTitle = prompt('ë””ë”¤ ê´€ë¦¬ë²ˆí˜¸ë¥¼ ìˆ˜ì •í•˜ì„¸ìš”:\n\nì˜ˆ: 26T0001, 26T0002', currentTitle || '');
    if (!newTitle || newTitle === currentTitle) return;
    
    try {
      const { error } = await App.sb
        .from('trademark_projects')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', projectId);
      
      if (error) throw error;
      
      App.showToast('ê´€ë¦¬ë²ˆí˜¸ê°€ ë³€ê²½ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      TM.loadProjectList();
      
    } catch (error) {
      console.error('[TM] íŽ¸ì§‘ ì‹¤íŒ¨:', error);
      App.showToast('íŽ¸ì§‘ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // í”„ë¡œì íŠ¸ ì œëª©(ê´€ë¦¬ë²ˆí˜¸) ì—…ë°ì´íŠ¸ (ìƒí‘œ ì •ë³´ íƒ­ì—ì„œ í˜¸ì¶œ)
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
      
      // ì‚¬ì´ë“œë°” í”„ë¡œì íŠ¸ëª… ì—…ë°ì´íŠ¸
      const titleEl = document.querySelector('.tm-project-name');
      if (titleEl) titleEl.textContent = trimmedTitle;
      
    } catch (error) {
      console.error('[TM] ê´€ë¦¬ë²ˆí˜¸ ì—…ë°ì´íŠ¸ ì‹¤íŒ¨:', error);
    }
  };
  
  TM.backToList = async function() {
    // ìžë™ ì €ìž¥ íƒ€ì´ë¨¸ ì¤‘ì§€
    TM.stopAutoSave();
    
    if (TM.currentProject && TM.hasUnsavedChanges) {
      // ë³€ê²½ì‚¬í•­ì´ ìžˆìœ¼ë©´ ì €ìž¥
      try {
        App.showToast('ë³€ê²½ì‚¬í•­ ì €ìž¥ ì¤‘...', 'info');
        await TM.saveProject(false); // í† ìŠ¤íŠ¸ í‘œì‹œ
      } catch (error) {
        // ì €ìž¥ ì‹¤íŒ¨ ì‹œ í™•ì¸
        if (!confirm('ì €ìž¥ì— ì‹¤íŒ¨í–ˆìŠµë‹ˆë‹¤. ê·¸ëž˜ë„ ëª©ë¡ìœ¼ë¡œ ëŒì•„ê°€ì‹œê² ìŠµë‹ˆê¹Œ?\n(ë³€ê²½ì‚¬í•­ì´ ì†ì‹¤ë  ìˆ˜ ìžˆìŠµë‹ˆë‹¤)')) {
          TM.startAutoSave(); // ìžë™ ì €ìž¥ ìž¬ì‹œìž‘
          return;
        }
      }
    }
    
    TM.currentProject = null;
    TM.hasUnsavedChanges = false;
    TM.renderDashboard();
  };
  
  // ì£¼ê¸°ì  ìžë™ì €ìž¥ (15ì´ˆ)
  TM.startAutoSave = function() {
    TM.stopAutoSave();
    TM.autoSaveTimer = setInterval(async () => {
      if (TM.currentProject && TM.hasUnsavedChanges) {
        console.log('[TM] ì£¼ê¸°ì  ìžë™ ì €ìž¥ ì¤‘...');
        try {
          await TM.saveProject(true); // silent
        } catch (e) {
          console.warn('[TM] ì£¼ê¸°ì  ìžë™ ì €ìž¥ ì‹¤íŒ¨:', e);
        }
      }
    }, 15000); // 15ì´ˆ
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
  
  // ë””ë°”ìš´ìŠ¤ëœ ìžë™ ì €ìž¥ (ë³€ê²½ í›„ 3ì´ˆ í›„ ì €ìž¥)
  TM.debounceSave = function() {
    if (TM.debounceSaveTimer) {
      clearTimeout(TM.debounceSaveTimer);
    }
    TM.debounceSaveTimer = setTimeout(async () => {
      if (TM.currentProject && TM.hasUnsavedChanges) {
        console.log('[TM] ë””ë°”ìš´ìŠ¤ ìžë™ ì €ìž¥ ì¤‘...');
        try {
          await TM.saveProject(true); // silent
        } catch (e) {
          console.warn('[TM] ë””ë°”ìš´ìŠ¤ ìžë™ ì €ìž¥ ì‹¤íŒ¨:', e);
        }
      }
    }, 3000); // 3ì´ˆ
  };
  
  // ë³€ê²½ ê°ì§€ ë° ìžë™ ì €ìž¥ íŠ¸ë¦¬ê±°
  TM.markChanged = function() {
    TM.hasUnsavedChanges = true;
    TM.debounceSave();
  };
  
  // ë³€ê²½ ê°ì§€ í”Œëž˜ê·¸
  TM.hasUnsavedChanges = false;

  // ============================================================
  // 7. ì›Œí¬ìŠ¤íŽ˜ì´ìŠ¤ ë Œë”ë§ (ì¢Œì¸¡ ì‚¬ì´ë“œë°” + ìš°ì¸¡ ë©”ì¸)
  // ============================================================
  
  TM.renderWorkspace = function() {
    const panel = document.getElementById('trademark-dashboard-panel');
    if (!panel || !TM.currentProject) return;
    
    panel.innerHTML = `
      <div class="tm-app-layout">
        <!-- ì¢Œì¸¡ ì‚¬ì´ë“œë°” -->
        <aside class="tm-sidebar">
          <div class="tm-sidebar-header">
            <button class="tm-back-btn" data-action="tm-back-to-list">
              <span>â†</span> ëª©ë¡ìœ¼ë¡œ
            </button>
          </div>
          
          <div class="tm-sidebar-project">
            <div class="tm-project-icon">ðŸ·ï¸</div>
            <div class="tm-project-info">
              <h3 class="tm-project-name">${TM.escapeHtml(TM.currentProject.trademarkName || '(ìƒí‘œëª… ë¯¸ìž…ë ¥)')}</h3>
              <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
                ðŸ“ ${TM.escapeHtml(TM.currentProject.title || '(ê´€ë¦¬ë²ˆí˜¸ ë¯¸ì§€ì •)')}
              </div>
              <span class="tm-status-badge ${TM.currentProject.status}">${TM.getStatusLabel(TM.currentProject.status)}</span>
            </div>
          </div>
          
          <!-- ì €ìž¥ ë²„íŠ¼ ë³„ë„ ì˜ì—­ -->
          <div class="tm-sidebar-save">
            <button class="tm-save-btn-large" data-action="tm-save-project">
              ðŸ’¾ ì €ìž¥í•˜ê¸°
            </button>
          </div>
          
          <nav class="tm-step-nav">
            ${TM.steps.map(step => `
              <button class="tm-step-item ${step.id === TM.currentStep ? 'active' : ''} ${TM.isStepCompleted(step.id) ? 'completed' : ''}"
                      data-action="tm-goto-step" data-step="${step.id}">
                <span class="tm-step-num">${step.id}</span>
                <span class="tm-step-name">${step.name}</span>
                ${TM.isStepCompleted(step.id) ? '<span class="tm-step-check">âœ“</span>' : ''}
              </button>
            `).join('')}
          </nav>
          
          <div class="tm-sidebar-footer">
            <div class="tm-progress">
              <div class="tm-progress-bar" style="width: ${TM.getProgressPercent()}%"></div>
            </div>
            <span class="tm-progress-text">${TM.getCompletedSteps()}/${TM.steps.length} ì™„ë£Œ</span>
          </div>
        </aside>
        
        <!-- ìš°ì¸¡ ë©”ì¸ ì˜ì—­ -->
        <main class="tm-main">
          <div class="tm-main-header">
            <h2>${TM.steps[TM.currentStep - 1]?.icon || ''} ${TM.steps[TM.currentStep - 1]?.name || ''}</h2>
            <!-- í—¤ë”ì— ë„¤ë¹„ê²Œì´ì…˜ ë²„íŠ¼ ì¶”ê°€ -->
            <div class="tm-header-nav">
              <button class="btn btn-sm btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
                â† ì´ì „
              </button>
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
                ë‹¤ìŒ â†’
              </button>
            </div>
          </div>
          
          <!-- â˜… í”„ë¡œì íŠ¸ ì •ë³´ ìš”ì•½ (í•­ìƒ í‘œì‹œ) -->
          <div class="tm-project-summary" id="tm-project-summary" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">ðŸ·ï¸</span>
              <div>
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ìƒí‘œëª…</div>
                <div style="font-size: 14px; font-weight: 600; color: #0c4a6e;">${TM.escapeHtml(TM.currentProject.trademarkName || '(ë¯¸ìž…ë ¥)')}</div>
              </div>
            </div>
            
            ${TM.currentProject.aiAnalysis?.businessAnalysis ? `
              <div style="flex: 1; min-width: 200px; border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì‚¬ì—… ë‚´ìš©</div>
                <div style="font-size: 13px; color: #1e3a5f; line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(TM.currentProject.aiAnalysis.businessAnalysis.slice(0, 100))}${TM.currentProject.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
              </div>
            ` : ''}
            
            ${TM.currentProject.designatedGoods?.length > 0 ? `
              <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì§€ì •ìƒí’ˆ</div>
                <div style="font-size: 13px; color: #1e3a5f;">
                  <strong>${TM.currentProject.designatedGoods.length}</strong>ê°œ ë¥˜ / 
                  <strong>${TM.currentProject.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0)}</strong>ê°œ ìƒí’ˆ
                </div>
              </div>
            ` : ''}
            
            ${TM.currentProject.aiAnalysis?.classRecommendations?.core?.length > 0 ? `
              <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
                <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì¶”ì²œ ë¥˜</div>
                <div style="font-size: 12px; color: #1e3a5f;">
                  ${TM.currentProject.aiAnalysis.classRecommendations.core.map(c => 'ì œ' + c.class + 'ë¥˜').join(', ')}
                  ${TM.currentProject.aiAnalysis.classRecommendations.recommended?.length > 0 ? ' ì™¸ ' + TM.currentProject.aiAnalysis.classRecommendations.recommended.length + 'ê°œ' : ''}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="tm-main-content" id="tm-step-content">
            <!-- ìŠ¤í… ì»¨í…ì¸  ë™ì  ë Œë”ë§ -->
          </div>
          
          <!-- í•˜ë‹¨ ë„¤ë¹„ê²Œì´ì…˜ (ìŠ¤í¬ë¡¤ ì‹œì—ë„ ë³´ìž„) -->
          <div class="tm-main-footer">
            <button class="btn btn-secondary" data-action="tm-prev-step" ${TM.currentStep === 1 ? 'disabled' : ''}>
              â† ì´ì „ ë‹¨ê³„
            </button>
            <div class="tm-footer-center">
              <span class="tm-step-indicator">${TM.currentStep} / ${TM.steps.length}</span>
              <button class="btn btn-sm btn-ghost" data-action="tm-save-project">ðŸ’¾ ì €ìž¥</button>
            </div>
            <button class="btn btn-primary" data-action="tm-next-step" ${TM.currentStep === TM.steps.length ? 'disabled' : ''}>
              ë‹¤ìŒ ë‹¨ê³„ â†’
            </button>
          </div>
        </main>
      </div>
    `;
    
    // í˜„ìž¬ ìŠ¤í… ì»¨í…ì¸  ë Œë”ë§
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
      draft: 'ìž‘ì„± ì¤‘',
      searching: 'ê²€ìƒ‰ ì¤‘',
      documenting: 'ë¬¸ì„œ ìž‘ì„±',
      completed: 'ì™„ë£Œ'
    };
    return labels[status] || status;
  };
  
  TM.isStepCompleted = function(stepId) {
    if (!TM.currentProject) return false;
    
    switch (stepId) {
      case 1: // ìƒí‘œ ì •ë³´
        return !!(TM.currentProject.trademarkName);
      case 2: // ì§€ì •ìƒí’ˆ
        return TM.currentProject.designatedGoods && TM.currentProject.designatedGoods.length > 0;
      case 3: // ì„ í–‰ìƒí‘œ ê²€ìƒ‰
        return !!(TM.currentProject.searchResults.searchedAt);
      case 4: // ìœ ì‚¬ë„ í‰ê°€
        return TM.currentProject.similarityEvaluations && TM.currentProject.similarityEvaluations.length > 0;
      case 5: // ë¦¬ìŠ¤í¬ í‰ê°€
        return !!(TM.currentProject.riskAssessment.level);
      case 6: // ìš°ì„ ì‹¬ì‚¬ - ì‚¬ìš©ìžê°€ ëª…ì‹œì ìœ¼ë¡œ ì„ íƒ ì—¬ë¶€ë¥¼ ê²°ì •í•´ì•¼ ì™„ë£Œ
        return TM.currentProject.priorityExam.userConfirmed === true;
      case 7: // ì¢…í•© ìš”ì•½
        return false; // í•­ìƒ ë¯¸ì™„ë£Œ (ì–¸ì œë“  ì¶œë ¥ ê°€ëŠ¥)
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
    // ì‚¬ì´ë“œë°” ìŠ¤í… ìƒíƒœ ì—…ë°ì´íŠ¸
    const stepItems = document.querySelectorAll('.tm-step-item');
    stepItems.forEach(item => {
      const stepNum = parseInt(item.dataset.step);
      item.classList.toggle('active', stepNum === TM.currentStep);
      item.classList.toggle('completed', TM.isStepCompleted(stepNum));
    });
    
    // ë©”ì¸ í—¤ë” ì—…ë°ì´íŠ¸
    const mainHeader = document.querySelector('.tm-main-header h2');
    if (mainHeader) {
      const step = TM.steps[TM.currentStep - 1];
      mainHeader.textContent = `${step?.icon || ''} ${step?.name || ''}`;
    }
    
    // í•˜ë‹¨ ë²„íŠ¼ ìƒíƒœ
    const prevBtn = document.querySelector('[data-action="tm-prev-step"]');
    const nextBtn = document.querySelector('[data-action="tm-next-step"]');
    if (prevBtn) prevBtn.disabled = TM.currentStep === 1;
    if (nextBtn) nextBtn.disabled = TM.currentStep === TM.steps.length;
    
    // ì¸ë””ì¼€ì´í„°
    const indicator = document.querySelector('.tm-step-indicator');
    if (indicator) indicator.textContent = `${TM.currentStep} / ${TM.steps.length}`;
    
    // ì§„í–‰ë¥  ì—…ë°ì´íŠ¸
    const progressBar = document.querySelector('.tm-progress-bar');
    const progressText = document.querySelector('.tm-progress-text');
    if (progressBar) progressBar.style.width = `${TM.getProgressPercent()}%`;
    if (progressText) progressText.textContent = `${TM.getCompletedSteps()}/${TM.steps.length} ì™„ë£Œ`;
  };
  
  TM.renderCurrentStep = function() {
    const stepEl = document.getElementById('tm-step-content');
    if (!stepEl) return;
    
    // í”„ë¡œì íŠ¸ ìš”ì•½ ì •ë³´ ì—…ë°ì´íŠ¸
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
  
  // í”„ë¡œì íŠ¸ ìš”ì•½ ì •ë³´ ì—…ë°ì´íŠ¸
  TM.updateProjectSummary = function() {
    const summaryEl = document.getElementById('tm-project-summary');
    if (!summaryEl || !TM.currentProject) return;
    
    const p = TM.currentProject;
    
    let html = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">ðŸ·ï¸</span>
        <div>
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ìƒí‘œëª…</div>
          <div style="font-size: 14px; font-weight: 600; color: #0c4a6e;">${TM.escapeHtml(p.trademarkName || '(ë¯¸ìž…ë ¥)')}</div>
        </div>
      </div>
    `;
    
    if (p.aiAnalysis?.businessAnalysis) {
      html += `
        <div style="flex: 1; min-width: 200px; border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì‚¬ì—… ë‚´ìš©</div>
          <div style="font-size: 13px; color: #1e3a5f; line-height: 1.4; max-height: 40px; overflow: hidden;">${TM.escapeHtml(p.aiAnalysis.businessAnalysis.slice(0, 100))}${p.aiAnalysis.businessAnalysis.length > 100 ? '...' : ''}</div>
        </div>
      `;
    }
    
    if (p.designatedGoods?.length > 0) {
      const totalGoods = p.designatedGoods.reduce((sum, g) => sum + (g.goods?.length || 0), 0);
      html += `
        <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì§€ì •ìƒí’ˆ</div>
          <div style="font-size: 13px; color: #1e3a5f;">
            <strong>${p.designatedGoods.length}</strong>ê°œ ë¥˜ / 
            <strong>${totalGoods}</strong>ê°œ ìƒí’ˆ
          </div>
        </div>
      `;
    }
    
    if (p.aiAnalysis?.classRecommendations?.core?.length > 0) {
      const coreClasses = p.aiAnalysis.classRecommendations.core.map(c => 'ì œ' + c.class + 'ë¥˜').join(', ');
      const recCount = p.aiAnalysis.classRecommendations.recommended?.length || 0;
      html += `
        <div style="border-left: 2px solid #bae6fd; padding-left: 16px;">
          <div style="font-size: 11px; color: #0369a1; font-weight: 500;">ì¶”ì²œ ë¥˜</div>
          <div style="font-size: 12px; color: #1e3a5f;">
            ${coreClasses}${recCount > 0 ? ' ì™¸ ' + recCount + 'ê°œ' : ''}
          </div>
        </div>
      `;
    }
    
    summaryEl.innerHTML = html;
  };

  // ============================================================
  // 8. ìœ í‹¸ë¦¬í‹° í•¨ìˆ˜
  // ============================================================
  
  TM.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // AI ì‘ë‹µ JSON ì•ˆì „ íŒŒì‹±
  TM.safeJsonParse = function(text) {
    // JSON ë¸”ë¡ ì¶”ì¶œ
    let jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) {
      // JSONì´ ìž˜ë ¤ì„œ ë‹«ížˆì§€ ì•Šì€ ê²½ìš° ë³µêµ¬ ì‹œë„
      jsonStr = text.match(/\{[\s\S]*/)?.[0];
      if (jsonStr) {
        jsonStr = TM.repairTruncatedJson(jsonStr);
      } else {
        throw new Error('JSONì„ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.');
      }
    }
    
    // 1ì°¨ ì‹œë„: ê·¸ëŒ€ë¡œ íŒŒì‹±
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // 2ì°¨ ì‹œë„: ì •ë¦¬ í›„ íŒŒì‹±
    }
    
    // JSON ì •ë¦¬ (trailing comma, ì œì–´ë¬¸ìž ì œê±°)
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
      // 3ì°¨ ì‹œë„: ìž˜ë¦° JSON ë³µêµ¬
      try {
        const repaired = TM.repairTruncatedJson(jsonStr);
        return JSON.parse(repaired);
      } catch (e2) {
        console.error('[TM] JSON íŒŒì‹± ìµœì¢… ì‹¤íŒ¨:', jsonStr.slice(0, 300));
        throw new Error('AI ì‘ë‹µ í˜•ì‹ ì˜¤ë¥˜. ë‹¤ì‹œ ì‹œë„í•´ì£¼ì„¸ìš”.');
      }
    }
  };
  
  // ìž˜ë¦° JSON ë³µêµ¬ (max_tokens ì´ˆê³¼ë¡œ ì‘ë‹µì´ ìž˜ë ¸ì„ ë•Œ)
  TM.repairTruncatedJson = function(jsonStr) {
    // ì—´ë¦° ê´„í˜¸/ëŒ€ê´„í˜¸ ì¹´ìš´íŠ¸
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
    
    // ë¬¸ìžì—´ì´ ë‹«ížˆì§€ ì•Šì•˜ìœ¼ë©´ ë‹«ê¸°
    if (inString) jsonStr += '"';
    
    // ë§ˆì§€ë§‰ ë¶ˆì™„ì „í•œ í•­ëª© ì œê±° (trailing comma ì •ë¦¬)
    jsonStr = jsonStr.replace(/,\s*$/, '');
    
    // ë‹«ížˆì§€ ì•Šì€ ê´„í˜¸ ë‹«ê¸°
    while (brackets > 0) { jsonStr += ']'; brackets--; }
    while (braces > 0) { jsonStr += '}'; braces--; }
    
    return jsonStr;
  };
  
  TM.updateField = function(field, value) {
    if (!TM.currentProject) return;
    
    // ì  í‘œê¸°ë²• ì§€ì› (ì˜ˆ: 'applicant.name')
    const parts = field.split('.');
    let obj = TM.currentProject;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    
    obj[parts[parts.length - 1]] = value;
    
    // ë³€ê²½ ê°ì§€ ë° ìžë™ ì €ìž¥ íŠ¸ë¦¬ê±°
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

  // ì „ì—­ ë…¸ì¶œ
  window.TM = TM;
  
  // App.switchServiceì—ì„œ í˜¸ì¶œë  ë•Œ ì´ˆê¸°í™”
  if (window.App && App.currentUser) {
    // ì´ë¯¸ ë¡œê·¸ì¸ëœ ìƒíƒœë©´ ë°”ë¡œ ì´ˆê¸°í™”í•˜ì§€ ì•ŠìŒ
    // switchServiceì—ì„œ í˜¸ì¶œë¨
  }

})();
/* ============================================================
   ìƒí‘œì¶œì› ìš°ì„ ì‹¬ì‚¬ ìžë™í™” ì‹œìŠ¤í…œ - Step ë Œë”ë§ (Part 2)
   Step 1~4: ìƒí‘œì •ë³´, ì§€ì •ìƒí’ˆ, ì„ í–‰ê²€ìƒ‰, ìœ ì‚¬ë„í‰ê°€
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM Steps] TM ëª¨ë“ˆì´ ë¡œë“œë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.');
    return;
  }

  // ============================================================
  // Step 1: ìƒí‘œ ì •ë³´ ìž…ë ¥ (2-column ë ˆì´ì•„ì›ƒ)
  // ============================================================
  
  TM.renderStep1_TrademarkInfo = function(container) {
    const p = TM.currentProject;
    const hasAiResult = p.aiAnalysis.businessAnalysis;
    
    container.innerHTML = `
      <div class="tm-2col">
        <!-- ì¢Œì¸¡: ìž…ë ¥ ì˜ì—­ -->
        <div class="tm-col">
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3>ðŸ·ï¸ ìƒí‘œ ê¸°ë³¸ ì •ë³´</h3>
            </div>
            <div class="tm-panel-body">
              <!-- ìƒí‘œ ìœ í˜• -->
              <div class="tm-field">
                <label>ìƒí‘œ ìœ í˜•</label>
                <div class="tm-chips">
                  ${[
                    {type: 'text', label: 'ë¬¸ìž'},
                    {type: 'figure', label: 'ë„í˜•'},
                    {type: 'combined', label: 'ê²°í•©'},
                    {type: 'sound', label: 'ì†Œë¦¬'},
                    {type: 'color', label: 'ìƒ‰ì±„'},
                    {type: '3d', label: 'ìž…ì²´'}
                  ].map(t => `
                    <label class="tm-chip ${p.trademarkType === t.type ? 'active' : ''}">
                      <input type="radio" name="trademarkType" value="${t.type}" 
                             data-field="trademarkType" ${p.trademarkType === t.type ? 'checked' : ''}>
                      ${t.label}
                    </label>
                  `).join('')}
                </div>
              </div>
              
              <!-- ìƒí‘œëª… -->
              <div class="tm-field">
                <label>ìƒí‘œëª… <span class="required">*</span></label>
                <input type="text" class="tm-input tm-input-lg" data-field="trademarkName" 
                       value="${TM.escapeHtml(p.trademarkName)}" 
                       placeholder="í•œê¸€, ì˜ë¬¸, í•œìž ë“±">
              </div>
              
              <!-- ê²¬ë³¸ ì—…ë¡œë“œ (ê°œì„ ) -->
              <div class="tm-field">
                <label>ê²¬ë³¸ <span style="font-weight:400;color:#9ca3af;font-size:12px;">(ë„í˜•/ê²°í•© ìƒí‘œ ì‹œ í•„ìˆ˜)</span></label>
                <div class="tm-specimen-upload" id="tm-specimen-dropzone"
                     ondragover="TM.handleDragOver(event)"
                     ondragleave="TM.handleDragLeave(event)"
                     ondrop="TM.handleSpecimenDrop(event)"
                     onclick="document.getElementById('tm-specimen-input').click()">
                  ${p.specimenUrl ? `
                    <div class="tm-specimen-preview">
                      <img src="${p.specimenUrl}" alt="ê²¬ë³¸">
                      <div class="tm-specimen-overlay">
                        <span>í´ë¦­í•˜ì—¬ ë³€ê²½</span>
                      </div>
                    </div>
                  ` : `
                    <div class="tm-specimen-empty">
                      <span class="tm-specimen-icon">ðŸ–¼ï¸</span>
                      <span class="tm-specimen-text">í´ë¦­ ë˜ëŠ” ë“œëž˜ê·¸í•˜ì—¬ ì—…ë¡œë“œ</span>
                      <span class="tm-specimen-hint">JPG, PNG, GIF (ìµœëŒ€ 5MB)</span>
                    </div>
                  `}
                </div>
                <input type="file" id="tm-specimen-input" data-field="specimen" 
                       accept="image/jpeg,image/png,image/gif" style="display:none">
              </div>
            </div>
          </div>
          
          <!-- AI ë¶„ì„ ìž…ë ¥ -->
          <div class="tm-panel tm-panel-highlight">
            <div class="tm-panel-header">
              <h3>ðŸ¤– AI ì‚¬ì—… ë¶„ì„</h3>
              <span class="tm-badge tm-badge-primary">ì¶”ì²œ</span>
            </div>
            <div class="tm-panel-body">
              <p class="tm-hint">ì‚¬ì—… ë‚´ìš©ì„ ìž…ë ¥í•˜ë©´ AIê°€ ìƒí’ˆë¥˜ì™€ ì§€ì •ìƒí’ˆì„ ì¶”ì²œí•©ë‹ˆë‹¤.</p>
              <div class="tm-field" style="margin-bottom: 16px;">
                <input type="text" class="tm-input" id="tm-business-url" 
                       value="${TM.escapeHtml(p.businessDescription || '')}"
                       placeholder="ì˜ˆ: ì†Œí”„íŠ¸ì›¨ì–´ ê°œë°œ, íŠ¹í—ˆ ì¶œì› ëŒ€í–‰">
              </div>
              <button class="btn btn-primary btn-block" data-action="tm-analyze-business" style="padding: 12px;">ðŸ” ë¶„ì„</button>
            </div>
          </div>
          
          <!-- ì¶œì›ì¸ ì •ë³´ (í™•ìž¥) -->
          <details class="tm-panel" ${p.applicant.name ? 'open' : ''}>
            <summary class="tm-panel-header">
              <h3>ðŸ‘¤ ì¶œì›ì¸ ì •ë³´</h3>
              <span class="tm-badge tm-badge-gray">${p.applicant.name ? 'ìž…ë ¥ë¨' : 'ì„ íƒ'}</span>
            </summary>
            <div class="tm-panel-body">
              <div class="tm-field-grid tm-field-grid-3">
                <div class="tm-field">
                  <label>ë””ë”¤ ê´€ë¦¬ë²ˆí˜¸ <span style="font-weight:400;color:#9ca3af;font-size:11px;">(í”„ë¡œì íŠ¸ ì‹ë³„)</span></label>
                  <input type="text" class="tm-input" id="tm-project-title-input"
                         value="${TM.escapeHtml(TM.currentProject?.title || '')}" 
                         placeholder="ì˜ˆ: 26T0001"
                         onchange="TM.updateProjectTitle(this.value)">
                </div>
                <div class="tm-field">
                  <label>ì„±ëª…/ìƒí˜¸ <span class="required">*</span></label>
                  <input type="text" class="tm-input" data-field="applicant.name" 
                         value="${TM.escapeHtml(p.applicant.name)}" placeholder="í™ê¸¸ë™ / (ì£¼)ë””ë”¤">
                </div>
                <div class="tm-field">
                  <label>ì¶œì›ì¸ ìœ í˜•</label>
                  <select class="tm-input" data-field="applicant.type">
                    <option value="individual" ${p.applicant.type === 'individual' ? 'selected' : ''}>ê°œì¸</option>
                    <option value="corporation" ${p.applicant.type === 'corporation' ? 'selected' : ''}>ë²•ì¸</option>
                    <option value="sme" ${p.applicant.type === 'sme' ? 'selected' : ''}>ì¤‘ì†Œê¸°ì—…</option>
                  </select>
                </div>
                <div class="tm-field">
                  <label>ì‚¬ì—…ìž/ì£¼ë¯¼ë“±ë¡ë²ˆí˜¸</label>
                  <input type="text" class="tm-input" data-field="applicant.registrationNumber" 
                         value="${TM.escapeHtml(p.applicant.registrationNumber || '')}" placeholder="000-00-00000">
                </div>
                <div class="tm-field">
                  <label>ì—°ë½ì²˜</label>
                  <input type="text" class="tm-input" data-field="applicant.phone" 
                         value="${TM.escapeHtml(p.applicant.phone || '')}" placeholder="010-0000-0000">
                </div>
                <div class="tm-field">
                  <label>ì´ë©”ì¼</label>
                  <input type="text" class="tm-input" data-field="applicant.email" 
                         value="${TM.escapeHtml(p.applicant.email || '')}" placeholder="example@email.com">
                </div>
              </div>
              <div class="tm-field" style="margin-top: 12px;">
                <label>ì£¼ì†Œ</label>
                <input type="text" class="tm-input" data-field="applicant.address" 
                       value="${TM.escapeHtml(p.applicant.address || '')}" placeholder="ì„œìš¸ì‹œ ê°•ë‚¨êµ¬..."">
              </div>
            </div>
          </details>
        </div>
        
        <!-- ìš°ì¸¡: ê²°ê³¼ ì˜ì—­ -->
        <div class="tm-col">
          ${hasAiResult ? `
            <div class="tm-panel">
              <div class="tm-panel-header">
                <h3>ðŸ“‹ ë¶„ì„ ê²°ê³¼</h3>
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
                <h3>ðŸŽ¯ ì¶”ì²œ ìƒí’ˆë¥˜</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">âœ“ ì „ì²´ ì ìš©</button>
              </div>
              <div class="tm-panel-body">
                <p style="font-size: 13px; color: #6b7684; margin: 0 0 16px;">AIê°€ ë¶„ì„í•œ ê²°ê³¼, ì•„ëž˜ ìƒí’ˆë¥˜ê°€ ì‚¬ì—…ì— ì í•©í•©ë‹ˆë‹¤. <strong>ì ìš©</strong> ë²„íŠ¼ì„ í´ë¦­í•˜ë©´ ì§€ì •ìƒí’ˆì— ì¶”ê°€ë©ë‹ˆë‹¤.</p>
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
                          <div class="tm-rec-class">ì œ${code}ë¥˜ <span>${className}</span></div>
                          ${reason ? `<div class="tm-rec-desc">${TM.escapeHtml(reason)}</div>` : ''}
                          ${goods.length > 0 ? `
                            <div class="tm-rec-goods-label">ì¶”ì²œ ì§€ì •ìƒí’ˆ (${goods.length}ê°œ):</div>
                            <div class="tm-rec-tags">
                              ${goods.slice(0, 10).map(g => `<span>${g.name || g}</span>`).join('')}
                            </div>
                          ` : ''}
                        </div>
                        <div class="tm-rec-btn">
                          ${isAdded ? `<span class="applied">âœ“</span>` : 
                            `<button class="btn btn-primary" data-action="tm-apply-recommendation" data-class-code="${code}">+ ì ìš©</button>`}
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
                <div class="tm-empty-icon">ðŸ”</div>
                <h4>AI ë¶„ì„ì„ ì‹œìž‘í•˜ì„¸ìš”</h4>
                <p>ì‚¬ì—… ë‚´ìš©ì„ ìž…ë ¥í•˜ê³  ë¶„ì„ ë²„íŠ¼ì„ í´ë¦­í•˜ë©´<br>ì í•©í•œ ìƒí’ˆë¥˜ë¥¼ ì¶”ì²œë°›ì„ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.</p>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
    
    // ìƒí‘œ ìœ í˜• ë³€ê²½ ì´ë²¤íŠ¸
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
      text: 'ðŸ”¤',
      figure: 'ðŸŽ¨',
      combined: 'ðŸ”€',
      sound: 'ðŸ”Š',
      color: 'ðŸŒˆ',
      '3d': 'ðŸŽ²'
    };
    return icons[type] || 'ðŸ·ï¸';
  };
  
  TM.getTypeLabel = function(type) {
    const labels = {
      text: 'ë¬¸ìž',
      figure: 'ë„í˜•',
      combined: 'ê²°í•©',
      sound: 'ì†Œë¦¬',
      color: 'ìƒ‰ì±„',
      '3d': 'ìž…ì²´'
    };
    return labels[type] || type;
  };
  
  TM.handleSpecimenUpload = async function(file) {
    if (!file) return;
    
    // íŒŒì¼ í¬ê¸° ì²´í¬ (5MB)
    if (file.size > 5 * 1024 * 1024) {
      App.showToast('íŒŒì¼ í¬ê¸°ëŠ” 5MB ì´í•˜ì—¬ì•¼ í•©ë‹ˆë‹¤.', 'error');
      return;
    }
    
    // íŒŒì¼ í˜•ì‹ ì²´í¬
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      App.showToast('JPG, PNG, GIF í˜•ì‹ë§Œ ì§€ì›í•©ë‹ˆë‹¤.', 'error');
      return;
    }
    
    try {
      App.showToast('ì´ë¯¸ì§€ ì—…ë¡œë“œ ì¤‘...', 'info');
      
      // Supabase Storageì— ì—…ë¡œë“œ
      const fileName = `${TM.currentProject.id}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await App.sb.storage
        .from('trademark-specimens')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // ê³µê°œ URL ìƒì„±
      const { data: urlData } = App.sb.storage
        .from('trademark-specimens')
        .getPublicUrl(fileName);
      
      TM.currentProject.specimenUrl = urlData.publicUrl;
      TM.currentProject.specimenFile = fileName;
      
      // ë¯¸ë¦¬ë³´ê¸° ì—…ë°ì´íŠ¸
      const preview = document.getElementById('tm-specimen-preview');
      if (preview) {
        preview.innerHTML = `<img src="${urlData.publicUrl}" alt="ê²¬ë³¸ ì´ë¯¸ì§€">`;
      }
      
      App.showToast('ì´ë¯¸ì§€ê°€ ì—…ë¡œë“œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] ì´ë¯¸ì§€ ì—…ë¡œë“œ ì‹¤íŒ¨:', error);
      App.showToast('ì´ë¯¸ì§€ ì—…ë¡œë“œ ì‹¤íŒ¨: ' + error.message, 'error');
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
      
      App.showToast('ì´ë¯¸ì§€ê°€ ì œê±°ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
    } catch (error) {
      console.error('[TM] ì´ë¯¸ì§€ ì œê±° ì‹¤íŒ¨:', error);
    }
  };

  // ============================================================
  // Step 2: ì§€ì •ìƒí’ˆ ì„ íƒ (2-column ë ˆì´ì•„ì›ƒ)
  // ============================================================
  
  TM.renderStep2_DesignatedGoods = function(container) {
    const p = TM.currentProject;
    const hasAiRec = p.aiAnalysis?.recommendedClasses?.length > 0;
    const totalGoods = p.designatedGoods.reduce((sum, c) => sum + c.goods.length, 0);
    
    // ëª¨ë“  ìœ ì‚¬êµ° ì½”ë“œ ìˆ˜ì§‘
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
        <!-- ì¢Œì¸¡: ìƒí’ˆë¥˜ ì„ íƒ -->
        <div class="tm-col">
          <!-- ê³ ì‹œëª…ì¹­ í† ê¸€ -->
          <div class="tm-panel tm-panel-sm">
            <div class="tm-toggles">
              <label class="tm-toggle ${p.gazettedOnly ? 'active' : ''}">
                <input type="radio" name="gazettedMode" value="true" ${p.gazettedOnly ? 'checked' : ''}>
                ê³ ì‹œëª…ì¹­ Only <span class="fee">46,000ì›/ë¥˜</span>
              </label>
              <label class="tm-toggle ${!p.gazettedOnly ? 'active' : ''}">
                <input type="radio" name="gazettedMode" value="false" ${!p.gazettedOnly ? 'checked' : ''}>
                ë¹„ê³ ì‹œ í—ˆìš© <span class="fee">52,000ì›/ë¥˜</span>
              </label>
            </div>
          </div>
          
          ${hasAiRec ? `
            <!-- AI ì¶”ì²œ ìƒí’ˆë¥˜ (3ë‹¨ê³„: í•µì‹¬/ê¶Œìž¥/í™•ìž¥) -->
            <div class="tm-panel tm-panel-ai">
              <div class="tm-panel-header">
                <h3>ðŸ¤– AI ì¶”ì²œ ìƒí’ˆë¥˜</h3>
                <button class="btn btn-sm btn-primary" data-action="tm-apply-all-recommendations">âœ“ ì „ì²´ ì ìš©</button>
              </div>
              <div class="tm-ai-rec-desc" style="font-size: 12px; padding: 8px 12px; background: #f8f9fa; margin: 0 0 10px 0; border-radius: 4px;">
                ì‚¬ì—… ë¶„ì„ ê²°ê³¼ìž…ë‹ˆë‹¤. <strong style="color: #dc3545;">ðŸ”´ í•µì‹¬</strong>ì€ í•„ìˆ˜, 
                <strong style="color: #fd7e14;">ðŸŸ  ê¶Œìž¥</strong>ì€ ê¶Œë¦¬ ë³´í˜¸ìš©, 
                <strong style="color: #28a745;">ðŸŸ¢ í™•ìž¥</strong>ì€ ì‚¬ì—… í™•ìž¥ ì‹œ ê³ ë ¤í•˜ì„¸ìš”.
              </div>
              
              <div id="tm-ai-recommendations-container"></div>
              
              <!-- ì¶”ê°€ ì¶”ì²œ ìš”ì²­ ë²„íŠ¼ -->
              <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; text-align: center;">
                <button class="btn btn-outline btn-sm" data-action="tm-request-more-recommendations" style="font-size: 12px;">
                  ðŸ” ì¶”ê°€ ì¶”ì²œ ìš”ì²­
                </button>
              </div>
            </div>
          ` : ''}
          
          <!-- ì „ì²´ ìƒí’ˆë¥˜ ê·¸ë¦¬ë“œ -->
          <div class="tm-panel">
            <div class="tm-panel-header">
              <h3>ðŸ“‹ ì „ì²´ ìƒí’ˆë¥˜</h3>
              <span class="tm-badge">NICE 13íŒ (45ë¥˜)</span>
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
                <span><span class="dot selected"></span> ì„ íƒë¨</span>
                <span><span class="dot rec"></span> AIì¶”ì²œ</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- ìš°ì¸¡: ì„ íƒëœ ì§€ì •ìƒí’ˆ -->
        <div class="tm-col">
          <div class="tm-panel tm-panel-selected">
            <div class="tm-panel-header">
              <h3>âœ… ì„ íƒëœ ì§€ì •ìƒí’ˆ</h3>
              <div class="tm-selected-stats">
                <span class="tm-stat-item"><strong>${p.designatedGoods.length}</strong>ë¥˜</span>
                <span class="tm-stat-item"><strong>${totalGoods}</strong>ê°œ ìƒí’ˆ</span>
                <span class="tm-stat-item"><strong>${allSimilarGroups.size}</strong>ê°œ ìœ ì‚¬êµ°</span>
                ${totalGoods > 0 ? `<button class="btn btn-sm btn-outline" data-action="tm-copy-goods" title="ì§€ì •ìƒí’ˆ ë³µì‚¬">ðŸ“‹ ë³µì‚¬</button>` : ''}
              </div>
            </div>
            
            ${p.designatedGoods.length > 0 ? `
              <!-- ìœ ì‚¬êµ° ìš”ì•½ -->
              <div class="tm-similar-summary">
                <span class="label">ìœ ì‚¬êµ° ì½”ë“œ:</span>
                <div class="tm-similar-tags">
                  ${Array.from(allSimilarGroups).slice(0, 8).map(sg => `<span class="tm-similar-tag">${sg}</span>`).join('')}
                  ${allSimilarGroups.size > 8 ? `<span class="tm-similar-more">+${allSimilarGroups.size - 8}ê°œ</span>` : ''}
                </div>
              </div>
            ` : ''}
            
            <div class="tm-goods-container">
              ${p.designatedGoods.length === 0 ? `
                <div class="tm-empty-goods">
                  <div class="icon">ðŸ“¦</div>
                  <h4>ì§€ì •ìƒí’ˆì„ ì„ íƒí•˜ì„¸ìš”</h4>
                  <p>ì¢Œì¸¡ì—ì„œ ìƒí’ˆë¥˜ë¥¼ í´ë¦­í•˜ê±°ë‚˜<br>AI ì¶”ì²œì„ ì ìš©í•˜ì„¸ìš”.</p>
                </div>
              ` : p.designatedGoods.map(classData => TM.renderClassGoodsCard(classData)).join('')}
            </div>
          </div>
          
          <!-- ë¹„ê³ ì‹œëª…ì¹­ ì§ì ‘ ìž…ë ¥ ì„¹ì…˜ -->
          ${p.designatedGoods.length > 0 ? `
            <div class="tm-panel tm-panel-custom">
              <div class="tm-panel-header">
                <h3>âœï¸ ë¹„ê³ ì‹œëª…ì¹­ ì§ì ‘ ìž…ë ¥ <span class="optional">(ì„ íƒ)</span></h3>
              </div>
              <div class="tm-custom-term-info">
                <p>ê³ ì‹œëª…ì¹­ì— ì—†ëŠ” ìƒí’ˆ/ì„œë¹„ìŠ¤ëª…ì„ ì§ì ‘ ìž…ë ¥í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.</p>
                <p class="tm-custom-term-fee">ðŸ’° ë¹„ê³ ì‹œëª…ì¹­ ì‚¬ìš© ì‹œ ë¥˜ë‹¹ <strong>+6,000ì›</strong> (52,000ì›/ë¥˜)</p>
              </div>
              
              <div class="tm-custom-term-input">
                <select id="tm-custom-term-class" class="tm-select-sm">
                  ${p.designatedGoods.map(g => `<option value="${g.classCode}">ì œ${g.classCode}ë¥˜</option>`).join('')}
                </select>
                <input type="text" id="tm-custom-term-input" 
                       placeholder="ì˜ˆ: AI ê¸°ë°˜ ì§€ì›ì‚¬ì—… ë§¤ì¹­ ì„œë¹„ìŠ¤ì—…" 
                       class="tm-input-flex">
                <button class="btn btn-secondary btn-sm" data-action="tm-add-custom-term">
                  + ì¶”ê°€
                </button>
              </div>
              
              <!-- ë¹„ê³ ì‹œëª…ì¹­ ë¶„ì„ ê²°ê³¼ í‘œì‹œ ì˜ì—­ -->
              <div id="tm-custom-term-result" class="tm-custom-term-result" style="display:none;"></div>
              
              <!-- ì¶”ê°€ëœ ë¹„ê³ ì‹œëª…ì¹­ ëª©ë¡ -->
              ${TM.getCustomTermsHtml(p)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // ê³ ì‹œëª…ì¹­ ëª¨ë“œ ì´ë²¤íŠ¸
    container.querySelectorAll('input[name="gazettedMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        TM.currentProject.gazettedOnly = e.target.value === 'true';
        container.querySelectorAll('.tm-toggle').forEach(t => t.classList.remove('active'));
        e.target.closest('.tm-toggle').classList.add('active');
        TM.hasUnsavedChanges = true;
      });
    });
    
    // ë¹„ê³ ì‹œëª…ì¹­ ìž…ë ¥ ì´ë²¤íŠ¸
    const customInput = container.querySelector('#tm-custom-term-input');
    if (customInput) {
      // Enter í‚¤ë¡œ ì¶”ê°€
      customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          TM.handleAddCustomTerm();
        }
      });
      
      // ìž…ë ¥ ì¤‘ ì‹¤ì‹œê°„ ë¶„ì„ (ë””ë°”ìš´ìŠ¤)
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
    
    // â˜…â˜…â˜… ê° ìƒí’ˆë¥˜ì˜ ê²€ìƒ‰ ìžë™ì™„ì„± ì´ˆê¸°í™” â˜…â˜…â˜…
    setTimeout(() => {
      p.designatedGoods.forEach(classData => {
        TM.initGoodsAutocomplete(classData.classCode);
      });
    }, 100);
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ëª©ë¡ HTML ìƒì„±
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
          <span>ì¶”ê°€ëœ ë¹„ê³ ì‹œëª…ì¹­ (${customTerms.length}ê°œ)</span>
        </div>
        ${customTerms.map(term => `
          <div class="tm-custom-term-item ${term.riskLevel === 'high' ? 'high-risk' : ''}">
            <div class="tm-custom-term-main">
              <span class="class-badge-sm">ì œ${term.classCode}ë¥˜</span>
              <span class="term-name">${TM.escapeHtml(term.name)}</span>
              <span class="badge ${term.riskLevel === 'high' ? 'danger' : 'warning'}">ë¹„ê³ ì‹œ</span>
            </div>
            <div class="tm-custom-term-meta">
              <span>ì¶”ì • ìœ ì‚¬êµ°: ${term.similarGroup || '(ë¯¸í™•ì¸)'}</span>
              ${term.confidence ? `<span>ë§¤ì¹­ë„: ${Math.round(term.confidence * 100)}%</span>` : ''}
              ${term.riskLevel === 'high' ? '<span class="risk-warn">âš ï¸ ë³´ì • ê°€ëŠ¥ì„± ë†’ìŒ</span>' : ''}
            </div>
            ${term.mappingCandidates?.length > 0 ? `
              <div class="tm-custom-term-alts">
                <span class="label">í‘œì¤€ëª…ì¹­ ëŒ€ì²´ì•ˆ:</span>
                ${term.mappingCandidates.slice(0, 2).map(c => 
                  `<span class="alt-term" data-action="tm-replace-custom-term" 
                         data-class="${term.classCode}" 
                         data-old="${TM.escapeHtml(term.name)}" 
                         data-new="${TM.escapeHtml(c.goods_name)}"
                         title="í´ë¦­í•˜ì—¬ ëŒ€ì²´">${c.goods_name}</span>`
                ).join('')}
              </div>
            ` : ''}
            <button class="btn-icon-xs" data-action="tm-remove-custom-term" 
                    data-class="${term.classCode}" data-name="${TM.escapeHtml(term.name)}">âœ•</button>
          </div>
        `).join('')}
      </div>
    `;
    
    // AI ì¶”ì²œ ë Œë”ë§ (3ë‹¨ê³„ êµ¬ì¡°)
    setTimeout(() => TM.renderAiRecommendations(), 0);
  };
  
  // AI ì¶”ì²œ ìƒí’ˆë¥˜ ë Œë”ë§ (3ë‹¨ê³„: í•µì‹¬/ê¶Œìž¥/í™•ìž¥)
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
    
    // ê°œë³„ ì•„ì´í…œ ë Œë”ë§ í•¨ìˆ˜
    const renderClassItem = (item, category, emoji) => {
      const code = item.class;
      const isAdded = p.designatedGoods.some(g => g.classCode === code);
      const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
      const borderColor = category === 'core' ? '#dc3545' : category === 'recommended' ? '#fd7e14' : '#28a745';
      
      let goodsHtml = '';
      if (recGoods.length > 0) {
        // â˜… ì¶”ì²œ ì§€ì •ìƒí’ˆ ì „ì²´(10ê°œ) ë…¸ì¶œ
        const goodsTags = recGoods.map(g => {
          const name = g.name || g;
          const displayName = name.length > 20 ? name.slice(0, 20) + '..' : name;
          return '<span class="tag" style="padding: 2px 6px; background: #f0f4ff; border-radius: 3px; font-size: 11px; display: inline-block; margin: 1px 2px;">' + TM.escapeHtml(displayName) + '</span>';
        }).join('');
        goodsHtml = '<div class="tm-ai-rec-goods" style="margin-top: 6px; font-size: 11px; line-height: 1.8;">' +
          '<span class="label" style="margin-right: 4px; font-weight: 600; color: #555;">ì¶”ì²œ ì§€ì •ìƒí’ˆ(' + recGoods.length + '):</span>' +
          goodsTags + '</div>';
      }
      
      const actionHtml = isAdded 
        ? '<span class="applied" style="font-size: 11px; color: #28a745;">âœ“ì ìš©ë¨</span>'
        : '<button class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 11px;" data-action="tm-apply-recommendation" data-class-code="' + code + '">+ ì¶”ê°€</button>';
      
      return '<div class="tm-ai-rec-item ' + (isAdded ? 'added' : '') + '" data-category="' + category + '" style="padding: 10px; gap: 8px; border-left: 3px solid ' + borderColor + ';">' +
        '<div class="tm-ai-rec-content" style="flex: 1; min-width: 0;">' +
          '<div class="tm-ai-rec-class" style="font-size: 13px;">' +
            '<span style="margin-right: 4px;">' + emoji + '</span>' +
            '<strong>ì œ' + code + 'ë¥˜</strong> ' + (TM.niceClasses[code] || '') +
          '</div>' +
          '<div class="tm-ai-rec-reason" style="font-size: 11px; color: #666; margin-top: 2px;">' + TM.escapeHtml(item.reason || '') + '</div>' +
          goodsHtml +
        '</div>' +
        '<div class="tm-ai-rec-action">' + actionHtml + '</div>' +
      '</div>';
    };
    
    let html = '';
    
    // ðŸ”´ í•µì‹¬ ë¥˜
    if (coreClasses.length > 0) {
      html += '<div class="tm-rec-section">' +
        '<div class="tm-rec-section-header" style="background: #fff5f5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #dc3545; border-radius: 4px; margin-bottom: 6px;">' +
          'ðŸ”´ í•µì‹¬ (í•„ìˆ˜ ë“±ë¡) - ' + coreClasses.length + 'ê°œ ë¥˜' +
        '</div>' +
        '<div class="tm-ai-rec-list" style="gap: 6px; margin-bottom: 12px; display: flex; flex-direction: column;">' +
          coreClasses.map(item => renderClassItem(item, 'core', 'ðŸ”´')).join('') +
        '</div>' +
      '</div>';
    }
    
    // ðŸŸ  ê¶Œìž¥ ë¥˜
    if (recommendedClasses.length > 0) {
      html += '<div class="tm-rec-section">' +
        '<div class="tm-rec-section-header" style="background: #fff8f0; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #fd7e14; border-radius: 4px; margin-bottom: 6px;">' +
          'ðŸŸ  ê¶Œìž¥ (ê¶Œë¦¬ ë³´í˜¸) - ' + recommendedClasses.length + 'ê°œ ë¥˜' +
        '</div>' +
        '<div class="tm-ai-rec-list" style="gap: 6px; margin-bottom: 12px; display: flex; flex-direction: column;">' +
          recommendedClasses.map(item => renderClassItem(item, 'recommended', 'ðŸŸ ')).join('') +
        '</div>' +
      '</div>';
    }
    
    // ðŸŸ¢ í™•ìž¥ ë¥˜ (ì ‘ê¸°/íŽ¼ì¹˜ê¸°)
    if (expansionClasses.length > 0) {
      html += '<div class="tm-rec-section tm-rec-expansion">' +
        '<div class="tm-rec-section-header" style="background: #f0fff4; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #28a745; border-radius: 4px; margin-bottom: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" data-action="tm-toggle-expansion">' +
          '<span>ðŸŸ¢ í™•ìž¥ (ì‚¬ì—… í™•ìž¥ ì‹œ ê³ ë ¤) - ' + expansionClasses.length + 'ê°œ ë¥˜</span>' +
          '<span class="tm-expansion-toggle">â–¼ íŽ¼ì¹˜ê¸°</span>' +
        '</div>' +
        '<div class="tm-ai-rec-list tm-expansion-list" style="gap: 6px; display: none; flex-direction: column;">' +
          expansionClasses.map(item => renderClassItem(item, 'expansion', 'ðŸŸ¢')).join('') +
        '</div>' +
      '</div>';
    }
    
    // êµ¬ë²„ì „ í˜¸í™˜ (classRecommendationsê°€ ì—†ê³  recommendedClassesë§Œ ìžˆëŠ” ê²½ìš°)
    if (html === '' && p.aiAnalysis.recommendedClasses?.length > 0) {
      html = '<div class="tm-ai-rec-list" style="gap: 8px; display: flex; flex-direction: column;">';
      p.aiAnalysis.recommendedClasses.slice(0, 5).forEach((code, idx) => {
        const isAdded = p.designatedGoods.some(g => g.classCode === code);
        const reason = p.aiAnalysis.classReasons?.[code] || '';
        const recGoods = p.aiAnalysis.recommendedGoods?.[code] || [];
        
        let goodsHtml = '';
        if (recGoods.length > 0) {
          // â˜… ì¶”ì²œ ì§€ì •ìƒí’ˆ ì „ì²´(10ê°œ) ë…¸ì¶œ
          const goodsTags = recGoods.map(g => {
            const name = g.name || g;
            const displayName = name.length > 20 ? name.slice(0, 20) + '..' : name;
            return '<span class="tag" style="padding: 2px 6px; background: #f0f4ff; border-radius: 3px; font-size: 11px; display: inline-block; margin: 1px 2px;">' + TM.escapeHtml(displayName) + '</span>';
          }).join('');
          goodsHtml = '<div class="tm-ai-rec-goods" style="margin-top: 6px; font-size: 11px; line-height: 1.8;">' +
            '<span class="label" style="margin-right: 4px; font-weight: 600; color: #555;">ì¶”ì²œ ì§€ì •ìƒí’ˆ(' + recGoods.length + '):</span>' +
            goodsTags + '</div>';
        }
        
        const actionHtml = isAdded 
          ? '<span class="applied" style="font-size: 11px;">âœ“ì ìš©</span>'
          : '<button class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 11px;" data-action="tm-apply-recommendation" data-class-code="' + code + '">+ ì¶”ê°€</button>';
        
        html += '<div class="tm-ai-rec-item ' + (isAdded ? 'added' : '') + '" style="padding: 10px; gap: 8px;">' +
          '<div class="tm-ai-rec-num" style="width: 24px; height: 24px; font-size: 12px;">' + (idx + 1) + '</div>' +
          '<div class="tm-ai-rec-content" style="flex: 1; min-width: 0;">' +
            '<div class="tm-ai-rec-class" style="font-size: 13px;">' +
              '<strong>ì œ' + code + 'ë¥˜</strong> ' + (TM.niceClasses[code] || '') +
            '</div>' +
            (reason ? '<div class="tm-ai-rec-reason" style="font-size: 11px; line-height: 1.4; max-height: 36px; overflow: hidden;">' + TM.escapeHtml(reason.slice(0, 60)) + (reason.length > 60 ? '...' : '') + '</div>' : '') +
            goodsHtml +
          '</div>' +
          '<div class="tm-ai-rec-action">' + actionHtml + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    
    // ê²€ì¦ ê²°ê³¼ í‘œì‹œ
    if (p.aiAnalysis.validation) {
      const v = p.aiAnalysis.validation;
      const scoreColor = v.overallScore >= 80 ? '#10b981' : v.overallScore >= 60 ? '#f59e0b' : '#ef4444';
      const scoreEmoji = v.overallScore >= 80 ? 'âœ…' : v.overallScore >= 60 ? 'âš ï¸' : 'âŒ';
      const bgColor = v.overallScore >= 80 ? '#d1fae5' : v.overallScore >= 60 ? '#fef3c7' : '#fee2e2';
      const borderColor = v.overallScore >= 80 ? '#6ee7b7' : v.overallScore >= 60 ? '#fcd34d' : '#fca5a5';
      
      html += '<div style="margin-top: 16px; padding: 14px; background: ' + bgColor + '; border-radius: 10px; border: 1px solid ' + borderColor + ';">';
      
      // ê²€ì¦ í—¤ë”
      html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid ' + borderColor + ';">' +
        '<span style="font-weight: 700; font-size: 14px;">' + scoreEmoji + ' 3ë‹¨ê³„ ê²€ì¦ ê²°ê³¼</span>' +
        '<span style="font-size: 13px; color: ' + scoreColor + '; font-weight: 700; background: white; padding: 4px 10px; border-radius: 12px;">ì •í™•ë„ ' + v.overallScore + '%</span>' +
      '</div>';
      
      // ìš”ì•½
      if (v.summary) {
        html += '<div style="font-size: 13px; color: #374151; margin-bottom: 12px; font-weight: 500;">' + TM.escapeHtml(v.summary) + '</div>';
      }
      
      // ì œê±°ëœ ë¥˜ í‘œì‹œ
      if (v.invalidClasses?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-bottom: 6px;">âŒ ì œê±°ëœ ë¥˜ (' + v.invalidClasses.length + 'ê°œ)</div>';
        v.invalidClasses.forEach(c => {
          html += '<div style="font-size: 11px; color: #7f1d1d; padding: 6px 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #dc2626;">' +
            '<strong>ì œ' + c.class + 'ë¥˜</strong>: ' + TM.escapeHtml(c.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // ì œê±°ëœ ì§€ì •ìƒí’ˆ í‘œì‹œ
      if (v.invalidGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-bottom: 6px;">âŒ ì œê±°ëœ ì§€ì •ìƒí’ˆ (' + v.invalidGoods.length + 'ê°œ)</div>';
        v.invalidGoods.forEach(g => {
          const errorLabel = g.errorType === 'homonym' ? 'ðŸ”¤ ë™ìŒì´ì˜ì–´' : 
                            g.errorType === 'partial_match' ? 'ðŸ“ ë¶€ë¶„ë§¤ì¹­ ì˜¤ë¥˜' : 'âš ï¸ ê´€ë ¨ì„± ë¶€ì¡±';
          html += '<div style="font-size: 11px; color: #7f1d1d; padding: 6px 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #f87171;">' +
            '<span style="background: #fee2e2; padding: 1px 6px; border-radius: 4px; margin-right: 6px; font-size: 10px;">' + errorLabel + '</span>' +
            '<strong>ì œ' + g.classCode + 'ë¥˜</strong> "' + TM.escapeHtml(g.goodsName) + '": ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // ëŒ€ì²´ ì¶”ì²œëœ ìƒí’ˆ
      if (v.replacementGoods?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #059669; margin-bottom: 6px;">ðŸ”„ ëŒ€ì²´ ì¶”ì²œ (' + v.replacementGoods.length + 'ê°œ)</div>';
        v.replacementGoods.forEach(r => {
          html += '<div style="font-size: 11px; color: #065f46; padding: 6px 10px; background: #ecfdf5; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #10b981;">' +
            '<strong>ì œ' + r.classCode + 'ë¥˜</strong>: ' +
            '<span style="text-decoration: line-through; color: #9ca3af;">' + TM.escapeHtml(r.remove) + '</span> â†’ ' +
            '<strong>' + TM.escapeHtml(r.addInstead) + '</strong>' +
          '</div>';
        });
        html += '</div>';
      }
      
      // ê²½ê³  ì‚¬í•­
      if (v.warnings?.length > 0) {
        html += '<div style="margin-bottom: 10px;">' +
          '<div style="font-size: 11px; font-weight: 600; color: #d97706; margin-bottom: 6px;">âš ï¸ í™•ì¸ í•„ìš”</div>';
        v.warnings.forEach(w => {
          html += '<div style="font-size: 11px; color: #92400e; padding: 6px 10px; background: #fffbeb; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #f59e0b;">' +
            'ì œ' + w.class + 'ë¥˜: ' + TM.escapeHtml(w.message) +
          '</div>';
        });
        html += '</div>';
      }
      
      // ëˆ„ë½ëœ ë¥˜ ì¶”ê°€ ì œì•ˆ
      if (v.suggestions?.length > 0 || v.missingClasses?.length > 0) {
        const suggestions = v.suggestions || [];
        const addClassSuggestions = suggestions.filter(s => s.type === 'add_class');
        
        if (addClassSuggestions.length > 0) {
          html += '<div style="margin-bottom: 10px;">' +
            '<div style="font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 6px;">ðŸ’¡ ì¶”ê°€ ê¶Œìž¥ ë¥˜</div>';
          addClassSuggestions.forEach(s => {
            const priorityBadge = s.priority === 'í•µì‹¬' ? 'ðŸ”´' : s.priority === 'ê¶Œìž¥' ? 'ðŸŸ ' : 'ðŸŸ¢';
            const isAdded = p.designatedGoods.some(g => g.classCode === s.class);
            
            // â˜… í•´ë‹¹ ë¥˜ì˜ ì¶”ì²œ ì§€ì •ìƒí’ˆ í‘œì‹œ
            const recGoods = p.aiAnalysis?.recommendedGoods?.[s.class] || [];
            let goodsLine = '';
            if (recGoods.length > 0) {
              const tags = recGoods.map(g => {
                const name = g.name || g;
                const dn = name.length > 18 ? name.slice(0, 18) + '..' : name;
                return '<span style="padding: 1px 5px; background: #dbeafe; border-radius: 3px; font-size: 10px; display: inline-block; margin: 1px 1px;">' + TM.escapeHtml(dn) + '</span>';
              }).join('');
              goodsLine = '<div style="margin-top: 4px; line-height: 1.7;">' +
                '<span style="font-size: 10px; font-weight: 600; color: #3b82f6;">ì¶”ì²œ ì§€ì •ìƒí’ˆ(' + recGoods.length + '):</span> ' + tags + '</div>';
            }
            
            const actionBtn = isAdded
              ? '<span style="font-size: 10px; color: #28a745; white-space: nowrap;">âœ“ì ìš©ë¨</span>'
              : '<button class="btn btn-sm" style="padding: 3px 10px; font-size: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;" data-action="tm-add-class" data-class-code="' + s.class + '">+ ì¶”ê°€</button>';
            
            html += '<div style="font-size: 11px; color: #1e40af; padding: 8px 10px; background: #eff6ff; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #3b82f6;">' +
              '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span>' + priorityBadge + ' <strong>ì œ' + s.class + 'ë¥˜</strong>: ' + TM.escapeHtml(s.reason) + '</span>' +
                actionBtn +
              '</div>' +
              goodsLine +
            '</div>';
          });
          html += '</div>';
        }
      }
      
      // ëˆ„ë½ëœ ì§€ì •ìƒí’ˆ
      if (v.missingGoods?.length > 0) {
        html += '<div>' +
          '<div style="font-size: 11px; font-weight: 600; color: #7c3aed; margin-bottom: 6px;">ðŸ“¦ ì¶”ê°€ ê¶Œìž¥ ìƒí’ˆ</div>';
        v.missingGoods.forEach(g => {
          html += '<div style="font-size: 11px; color: #5b21b6; padding: 6px 10px; background: #f5f3ff; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #8b5cf6;">' +
            '<strong>ì œ' + g.classCode + 'ë¥˜</strong>: ' + TM.escapeHtml(g.goodsName) + ' - ' + TM.escapeHtml(g.reason) +
          '</div>';
        });
        html += '</div>';
      }
      
      // ìž¬ê²€ì¦ ë²„íŠ¼
      html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid ' + borderColor + '; text-align: center;">' +
        '<button class="btn btn-sm" style="padding: 6px 16px; font-size: 11px; background: white; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;" data-action="tm-revalidate">ðŸ”„ ë‹¤ì‹œ ê²€ì¦</button>' +
      '</div>';
      
      html += '</div>';
    }
    
    container.innerHTML = html;
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ì‹¤ì‹œê°„ ë¶„ì„ ë¯¸ë¦¬ë³´ê¸°
  TM.previewCustomTermAnalysis = async function(term) {
    const resultDiv = document.getElementById('tm-custom-term-result');
    const classSelect = document.getElementById('tm-custom-term-class');
    
    if (!resultDiv || !classSelect) return;
    
    const classCode = classSelect.value;
    
    resultDiv.innerHTML = '<div class="tm-loading-sm">ë¶„ì„ ì¤‘...</div>';
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
            <span class="confidence">ë§¤ì¹­ë„: ${Math.round(analysis.confidence * 100)}%</span>
          </div>
          
          ${analysis.estimatedSimilarGroup ? `
            <div class="tm-analysis-row">
              <span class="label">ì¶”ì • ìœ ì‚¬êµ°:</span>
              <span class="value">${analysis.estimatedSimilarGroup}</span>
            </div>
          ` : ''}
          
          ${analysis.mappingCandidates?.length > 0 ? `
            <div class="tm-analysis-row">
              <span class="label">í‘œì¤€ëª…ì¹­ ëŒ€ì²´ì•ˆ:</span>
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
              ${analysis.riskAnalysis.risks.map(r => `<span class="risk-item">âš ï¸ ${r}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
      
      // ëŒ€ì²´ì•ˆ í´ë¦­ ì‹œ ìž…ë ¥ëž€ì— ë°˜ì˜
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
      resultDiv.innerHTML = `<div class="tm-error-sm">ë¶„ì„ ì‹¤íŒ¨: ${err.message}</div>`;
    }
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ì¶”ê°€ í•¸ë“¤ëŸ¬
  TM.handleAddCustomTerm = async function() {
    const input = document.getElementById('tm-custom-term-input');
    const classSelect = document.getElementById('tm-custom-term-class');
    
    if (!input || !classSelect) return;
    
    const term = input.value.trim();
    const classCode = classSelect.value;
    
    if (term.length < 2) {
      App.showToast('ì§€ì •ìƒí’ˆëª…ì„ 2ìž ì´ìƒ ìž…ë ¥í•´ì£¼ì„¸ìš”.', 'warning');
      return;
    }
    
    try {
      App.showToast('ë¹„ê³ ì‹œëª…ì¹­ ë¶„ì„ ì¤‘...', 'info');
      
      const analysis = await TM.processCustomTerm(term, classCode);
      
      if (analysis.error) {
        App.showToast(analysis.error, 'error');
        return;
      }
      
      // í”„ë¡œì íŠ¸ì— ì¶”ê°€
      const success = await TM.addCustomTermToProject(classCode, analysis);
      
      if (success) {
        input.value = '';
        document.getElementById('tm-custom-term-result').style.display = 'none';
        
        App.showToast(`ë¹„ê³ ì‹œëª…ì¹­ "${analysis.normalizedTerm}" ì¶”ê°€ë¨ (ì œ${classCode}ë¥˜)`, 'success');
        
        // UI ìƒˆë¡œê³ ì¹¨
        TM.renderCurrentStep();
      }
    } catch (err) {
      App.showToast('ë¹„ê³ ì‹œëª…ì¹­ ì¶”ê°€ ì‹¤íŒ¨: ' + err.message, 'error');
    }
  };
  
  // ìƒí’ˆë¥˜ë³„ ì§€ì •ìƒí’ˆ ì¹´ë“œ (ê°œì„ ëœ ë²„ì „)
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
            <span class="class-badge">ì œ${classData.classCode}ë¥˜</span>
            <span class="class-name">${TM.niceClasses[classData.classCode] || ''}</span>
          </div>
          <button class="btn-icon-sm" data-action="tm-remove-class" data-class-code="${classData.classCode}" title="ì‚­ì œ">âœ•</button>
        </div>
        
        ${similarGroups.size > 0 ? `
          <div class="tm-goods-similar">
            <span class="label">ìœ ì‚¬êµ°:</span>
            ${Array.from(similarGroups).map(sg => `<span class="sg-tag">${sg}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="tm-goods-input-area" style="position: relative;">
          <input type="text" class="tm-goods-search-input" 
                 id="tm-goods-input-${classData.classCode}"
                 placeholder="ì§€ì •ìƒí’ˆëª… ê²€ìƒ‰ (ìžë™ì™„ì„±)"
                 data-class="${classData.classCode}"
                 autocomplete="off"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"
               style="position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: none;"></div>
        </div>
        
        <div class="tm-goods-chips">
          ${classData.goods.length === 0 ? 
            '<span class="tm-goods-empty">ì§€ì •ìƒí’ˆì„ ì¶”ê°€í•˜ì„¸ìš”</span>' : 
            classData.goods.map(g => `
              <span class="tm-goods-chip ${g.isCustom ? 'custom' : ''} ${g.riskLevel === 'high' ? 'high-risk' : ''}">
                ${TM.escapeHtml(g.name)}
                ${g.isCustom ? '<span class="chip-badge custom">ë¹„ê³ ì‹œ</span>' : ''}
                ${g.similarGroup ? `<small>(${g.similarGroup})</small>` : ''}
                <button class="remove" data-action="tm-remove-goods" data-class-code="${classData.classCode}" data-goods-name="${TM.escapeHtml(g.name)}">Ã—</button>
              </span>
            `).join('')
          }
        </div>
      </div>
    `;
  };
  
  TM.renderClassGoods = function(classData) {
    // ìœ ì‚¬êµ° ì½”ë“œë³„ ê·¸ë£¹í•‘
    const groupedBySimilar = {};
    classData.goods.forEach(g => {
      const sg = g.similarGroup || 'ë¯¸ë¶„ë¥˜';
      if (!groupedBySimilar[sg]) groupedBySimilar[sg] = [];
      groupedBySimilar[sg].push(g);
    });
    const similarGroups = Object.keys(groupedBySimilar).sort();
    
    return `
      <div class="tm-class-goods-card" data-class="${classData.classCode}">
        <div class="tm-class-goods-header">
          <div>
            <strong>ì œ${classData.classCode}ë¥˜</strong>
            <span class="tm-class-name">${TM.niceClasses[classData.classCode]}</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-action="tm-remove-class" data-class-code="${classData.classCode}">
            âœ• ì œê±°
          </button>
        </div>
        
        <!-- ê²€ìƒ‰ ì˜ì—­ -->
        <div class="tm-goods-search-area">
          <div class="tm-goods-input-row">
            <input type="text" class="tm-goods-input" 
                   id="tm-goods-input-${classData.classCode}"
                   placeholder="ì§€ì •ìƒí’ˆëª… ê²€ìƒ‰ (ìžë™ì™„ì„±)"
                   data-class="${classData.classCode}">
            <div class="tm-goods-autocomplete" id="tm-autocomplete-${classData.classCode}"></div>
          </div>
          <div class="tm-similar-search-row">
            <input type="text" class="tm-similar-input" 
                   id="tm-similar-input-${classData.classCode}"
                   placeholder="ìœ ì‚¬êµ° ì½”ë“œ (ì˜ˆ: G5001)"
                   data-class="${classData.classCode}">
            <button class="btn btn-sm btn-secondary" 
                    data-action="tm-search-similar" 
                    data-class-code="${classData.classCode}">
              ìœ ì‚¬êµ° ê²€ìƒ‰
            </button>
          </div>
        </div>
        
        <!-- ìœ ì‚¬êµ° ê²€ìƒ‰ ê²°ê³¼ (ë™ì ) -->
        <div class="tm-similar-results" id="tm-similar-results-${classData.classCode}" style="display:none;"></div>
        
        <!-- ì„ íƒëœ ì§€ì •ìƒí’ˆ (ìœ ì‚¬êµ°ë³„ ê·¸ë£¹í•‘) -->
        <div class="tm-selected-goods">
          ${classData.goods.length === 0 ? `
            <div class="tm-hint">ì§€ì •ìƒí’ˆì„ ìž…ë ¥í•˜ê±°ë‚˜ ìœ ì‚¬êµ° ì½”ë“œë¡œ ê²€ìƒ‰í•˜ì„¸ìš”.</div>
          ` : `
            ${similarGroups.map(sg => `
              <div class="tm-similar-group">
                <div class="tm-similar-group-header">
                  <span class="tm-similar-code">${sg}</span>
                  <span class="tm-similar-count">${groupedBySimilar[sg].length}ê°œ</span>
                </div>
                <div class="tm-goods-tags">
                  ${groupedBySimilar[sg].map(g => `
                    <span class="tm-goods-tag ${g.gazetted === false ? 'non-gazetted' : ''}">
                      ${TM.escapeHtml(g.name)}
                      ${g.gazetted === false ? '<span class="badge warning">ë¹„ê³ ì‹œ</span>' : ''}
                      <button class="remove-btn" data-action="tm-remove-goods" 
                              data-class-code="${classData.classCode}" 
                              data-goods-name="${TM.escapeHtml(g.name)}">Ã—</button>
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          `}
        </div>
        
        <div class="tm-goods-count">
          ${classData.goods.length}ê°œ ì„ íƒ
          ${classData.goods.length > 10 ? `<span class="warning">(10ê°œ ì´ˆê³¼ ${classData.goods.length - 10}ê°œ Ã— 2,000ì› ì¶”ê°€)</span>` : ''}
        </div>
      </div>
    `;
  };
  
  TM.addClass = async function(classCode) {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    
    // ì´ë¯¸ ì„ íƒë˜ì–´ ìžˆìœ¼ë©´ ë¬´ì‹œ
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      return;
    }
    
    // â˜… ì´ë¯¸ ì¶”ì²œëœ ì§€ì •ìƒí’ˆì´ ìžˆìœ¼ë©´ ê·¸ê²ƒì„ ì‚¬ìš©
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
      App.showToast(`ì œ${classCode}ë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (${existingGoods.length}ê°œ ìƒí’ˆ)`, 'success');
      return;
    }
    
    // â˜… ì¶”ì²œ ì§€ì •ìƒí’ˆì´ ì—†ìœ¼ë©´ ì‹¤ì‹œê°„ìœ¼ë¡œ 10ê°œ ì¶”ì²œ
    try {
      App.showToast(`ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ì¶”ì²œ ì¤‘...`, 'info');
      
      const paddedCode = classCode.padStart(2, '0');
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
      
      const candidates = await TM.fetchOptimalCandidates(paddedCode, allKeywords, analysis);
      let selectedGoods = [];
      
      if (candidates.length > 0) {
        selectedGoods = await TM.selectOptimalGoods(
          classCode, candidates,
          p.aiAnalysis?.businessAnalysis || '',
          analysis
        );
      }
      
      // â˜… 10ê°œ ë³´ìž¥
      selectedGoods = await TM.ensureMinGoods(classCode, selectedGoods, p.aiAnalysis?.businessAnalysis || '');
      
      // ì¶”ì²œ ê²°ê³¼ ì €ìž¥
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
      App.showToast(`ì œ${classCode}ë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (${selectedGoods.length}ê°œ ìƒí’ˆ)`, 'success');
      
    } catch (err) {
      console.error(`[TM] addClass ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ì¶”ì²œ ì‹¤íŒ¨:`, err);
      // â˜… ì‹¤íŒ¨í•´ë„ DBì—ì„œ 10ê°œ ì±„ìš°ê¸° ì‹œë„
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
      App.showToast(`ì œ${classCode}ë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (${fallbackGoods.length}ê°œ ìƒí’ˆ)`, fallbackGoods.length > 0 ? 'success' : 'warning');
    }
  };
  
  TM.removeClass = function(classCode) {
    if (!TM.currentProject) return;
    
    TM.currentProject.designatedGoods = TM.currentProject.designatedGoods.filter(
      g => g.classCode !== classCode
    );
    
    TM.renderCurrentStep();
  };
  
  // ë”ë³´ê¸° í† ê¸€
  TM.toggleMoreGoods = function(classCode) {
    const hiddenDiv = document.getElementById(`tm-hidden-goods-${classCode}`);
    const btn = document.querySelector(`[data-action="tm-toggle-more-goods"][data-class-code="${classCode}"]`);
    
    if (!hiddenDiv || !btn) return;
    
    if (hiddenDiv.style.display === 'none') {
      hiddenDiv.style.display = 'block';
      btn.textContent = 'ì ‘ê¸°';
    } else {
      hiddenDiv.style.display = 'none';
      const count = hiddenDiv.querySelectorAll('.tm-rec-goods-tag').length;
      btn.textContent = `+${count}ê°œ ë”ë³´ê¸°`;
    }
  };
  
  // AI ì¶”ì²œ ì ìš© í•¨ìˆ˜
  TM.applyRecommendation = function(classCode) {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    
    // ì´ë¯¸ ì„ íƒë˜ì–´ ìžˆìœ¼ë©´ ë¬´ì‹œ
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      App.showToast('ì´ë¯¸ ì¶”ê°€ëœ ìƒí’ˆë¥˜ìž…ë‹ˆë‹¤.', 'info');
      return;
    }
    
    // ì¶”ì²œ ì§€ì •ìƒí’ˆ ê°€ì ¸ì˜¤ê¸°
    const recommendedGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
    
    console.log(`[TM] applyRecommendation - ì œ${classCode}ë¥˜, ì¶”ì²œìƒí’ˆ ${recommendedGoods.length}ê°œ:`, recommendedGoods);
    
    // ìƒí’ˆë¥˜ ì¶”ê°€
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
    
    console.log(`[TM] ì¶”ê°€í•  í´ëž˜ìŠ¤:`, newClass);
    
    p.designatedGoods.push(newClass);
    TM.hasUnsavedChanges = true;
    
    TM.renderCurrentStep();
    App.showToast(`ì œ${classCode}ë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (${recommendedGoods.length}ê°œ ìƒí’ˆ)`, 'success');
  };
  
  // ì „ì²´ AI ì¶”ì²œ ì ìš© (í•µì‹¬ + ê¶Œìž¥ë§Œ, í™•ìž¥ì€ ì œì™¸)
  TM.applyAllRecommendations = function() {
    if (!TM.currentProject) return;
    
    const p = TM.currentProject;
    const classRec = p.aiAnalysis?.classRecommendations || {};
    
    // í•µì‹¬ + ê¶Œìž¥ ë¥˜ë§Œ ìžë™ ì ìš© (í™•ìž¥ì€ ì‚¬ìš©ìž ì„ íƒ)
    const classesToApply = [
      ...(classRec.core || []).map(c => c.class),
      ...(classRec.recommended || []).map(c => c.class)
    ];
    
    if (classesToApply.length === 0) {
      App.showToast('ì¶”ì²œ ìƒí’ˆë¥˜ê°€ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    let addedCount = 0;
    
    classesToApply.forEach(classCode => {
      if (!p.designatedGoods.some(g => g.classCode === classCode)) {
        const recommendedGoods = p.aiAnalysis?.recommendedGoods?.[classCode] || [];
        
        console.log(`[TM] applyAll - ì œ${classCode}ë¥˜, ì¶”ì²œìƒí’ˆ ${recommendedGoods.length}ê°œ`);
        
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
    App.showToast(`í•µì‹¬+ê¶Œìž¥ ${addedCount}ê°œ ìƒí’ˆë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (í™•ìž¥ ë¥˜ëŠ” ê°œë³„ ì¶”ê°€ ê°€ëŠ¥)`, 'success');
  };
  
  // ìž¬ê²€ì¦ ìš”ì²­
  TM.revalidateRecommendations = async function() {
    const p = TM.currentProject;
    if (!p || !p.aiAnalysis) {
      App.showToast('ë¨¼ì € ì‚¬ì—… ë¶„ì„ì„ ì§„í–‰í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    const businessInput = document.getElementById('tm-business-url')?.value?.trim() || 
                          p.aiAnalysis.businessAnalysis || '';
    
    if (!businessInput) {
      App.showToast('ì‚¬ì—… ë‚´ìš©ì´ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    try {
      App.showToast('ìž¬ê²€ì¦ ì¤‘...', 'info');
      
      const validationResult = await TM.validateRecommendations(businessInput, p.aiAnalysis);
      
      if (validationResult) {
        p.aiAnalysis.validation = validationResult;
        
        if (validationResult.hasIssues) {
          await TM.applyValidationResult(p.aiAnalysis, validationResult);
          App.showToast('ê²€ì¦ ì™„ë£Œ: ë¬¸ì œ í•­ëª©ì´ ìˆ˜ì •ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
        } else {
          App.showToast('ê²€ì¦ ì™„ë£Œ: ëª¨ë“  ì¶”ì²œì´ ì í•©í•©ë‹ˆë‹¤.', 'success');
        }
        
        TM.renderCurrentStep();
      }
      
    } catch (error) {
      console.error('[TM] ìž¬ê²€ì¦ ì‹¤íŒ¨:', error);
      App.showToast('ìž¬ê²€ì¦ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // ê²€ì¦ì—ì„œ ì œì•ˆëœ ë¥˜ ì¶”ê°€
  TM.addSuggestedClass = async function(classCode) {
    const p = TM.currentProject;
    if (!p) return;
    
    // ì´ë¯¸ ì¶”ê°€ëœ ê²½ìš°
    if (p.designatedGoods.some(g => g.classCode === classCode)) {
      App.showToast(`ì œ${classCode}ë¥˜ëŠ” ì´ë¯¸ ì¶”ê°€ë˜ì–´ ìžˆìŠµë‹ˆë‹¤.`, 'warning');
      return;
    }
    
    try {
      App.showToast(`ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ì¡°íšŒ ì¤‘...`, 'info');
      
      // DBì—ì„œ í•´ë‹¹ ë¥˜ì˜ ì¸ê¸° ìƒí’ˆ ì¡°íšŒ
      const businessInput = document.getElementById('tm-business-url')?.value?.trim() || 
                            p.aiAnalysis?.businessAnalysis || '';
      
      const keywords = TM.extractKeywordsFromInput(businessInput);
      
      // í‚¤ì›Œë“œë¡œ ê´€ë ¨ ìƒí’ˆ ê²€ìƒ‰
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
          // ë¬´ì‹œ
        }
      }
      
      // ë¶€ì¡±í•˜ë©´ í•´ë‹¹ ë¥˜ì—ì„œ ê¸°ë³¸ ìƒí’ˆ ì¡°íšŒ
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
      
      // ì¶”ê°€
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
      
      // classRecommendationsì—ë„ ì¶”ê°€ (ê¶Œìž¥ ë¥˜ë¡œ)
      if (!p.aiAnalysis) p.aiAnalysis = {};
      if (!p.aiAnalysis.classRecommendations) p.aiAnalysis.classRecommendations = { core: [], recommended: [], expansion: [] };
      if (!p.aiAnalysis.recommendedClasses) p.aiAnalysis.recommendedClasses = [];
      if (!p.aiAnalysis.recommendedGoods) p.aiAnalysis.recommendedGoods = {};
      
      p.aiAnalysis.recommendedClasses.push(classCode);
      p.aiAnalysis.classRecommendations.recommended.push({
        class: classCode,
        reason: 'ê²€ì¦ì—ì„œ ì¶”ê°€ ê¶Œìž¥ë¨',
        priority: 99
      });
      p.aiAnalysis.recommendedGoods[classCode] = recommendedGoods;
      
      TM.renderCurrentStep();
      App.showToast(`ì œ${classCode}ë¥˜ê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤. (${recommendedGoods.length}ê°œ ìƒí’ˆ)`, 'success');
      
    } catch (error) {
      console.error('[TM] ë¥˜ ì¶”ê°€ ì‹¤íŒ¨:', error);
      App.showToast('ì¶”ê°€ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // í™•ìž¥ ë¥˜ ì ‘ê¸°/íŽ¼ì¹˜ê¸°
  TM.toggleExpansionClasses = function(target) {
    const section = target.closest('.tm-rec-expansion');
    if (!section) return;
    
    const list = section.querySelector('.tm-expansion-list');
    const toggle = section.querySelector('.tm-expansion-toggle');
    
    if (list && toggle) {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? 'flex' : 'none';
      list.style.flexDirection = 'column';
      toggle.textContent = isHidden ? 'â–² ì ‘ê¸°' : 'â–¼ íŽ¼ì¹˜ê¸°';
    }
  };
  
  // ì¶”ê°€ ì¶”ì²œ ìš”ì²­
  TM.requestMoreRecommendations = async function() {
    const p = TM.currentProject;
    if (!p || !p.aiAnalysis) {
      App.showToast('ë¨¼ì € ì‚¬ì—… ë¶„ì„ì„ ì§„í–‰í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    const existingClasses = p.aiAnalysis.recommendedClasses || [];
    const businessInput = document.getElementById('tm-business-url')?.value?.trim() || '';
    
    try {
      App.showToast('ì¶”ê°€ ì¶”ì²œì„ ë¶„ì„ ì¤‘...', 'info');
      
      const additionalPrompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.

ã€ê³ ê° ì •ë³´ã€‘
- ìƒí‘œëª…: ${p.trademarkName || 'ë¯¸ì •'}
- ì‚¬ì—… ë‚´ìš©: ${businessInput || p.aiAnalysis.businessAnalysis}
- ì´ë¯¸ ì¶”ì²œëœ ë¥˜: ${existingClasses.join(', ')}ë¥˜

ã€ìš”ì²­ã€‘
ì´ë¯¸ ì¶”ì²œëœ ë¥˜ ì™¸ì—, ì¶”ê°€ë¡œ ê³ ë ¤í•  ë§Œí•œ ìƒí’ˆë¥˜ë¥¼ ì°¾ì•„ì£¼ì„¸ìš”.
- ë°©ì–´ì  ë“±ë¡ ê´€ì 
- ê²½ìŸì‚¬ê°€ ì¼ë°˜ì ìœ¼ë¡œ ë“±ë¡í•˜ëŠ” ë¥˜
- ë¸Œëžœë“œ í™•ìž¥ ì‹œ ìžì£¼ ì‚¬ìš©ë˜ëŠ” ë¥˜
- ìœ ì‚¬ ì—…ì¢…ì—ì„œ ë¶„ìŸì´ ë§Žì€ ë¥˜

ã€ì‘ë‹µ í˜•ì‹ - JSONë§Œã€‘
{
  "additionalClasses": [
    {"class": "14", "reason": "ì•¡ì„¸ì„œë¦¬ í™•ìž¥ - íŒ¨ì…˜ ë¸Œëžœë“œ ë°©ì–´ì  ë“±ë¡", "priority": 1},
    {"class": "26", "reason": "ìž¥ì‹í’ˆ - ì˜ë¥˜ ê´€ë ¨ ë¶€ìžìž¬ ë³´í˜¸", "priority": 2}
  ]
}`;

      const response = await App.callClaude(additionalPrompt, 2000);
      const text = response.text || '';
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('ì‘ë‹µ íŒŒì‹± ì‹¤íŒ¨');
      }
      
      const jsonStr = text.substring(startIdx, endIdx + 1)
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1');
      
      const result = JSON.parse(jsonStr);
      const additionalClasses = result.additionalClasses || [];
      
      if (additionalClasses.length === 0) {
        App.showToast('ì¶”ê°€ ì¶”ì²œí•  ìƒí’ˆë¥˜ê°€ ì—†ìŠµë‹ˆë‹¤.', 'info');
        return;
      }
      
      // ê¸°ì¡´ í™•ìž¥ ë¥˜ì— ì¶”ê°€
      if (!p.aiAnalysis.classRecommendations) {
        p.aiAnalysis.classRecommendations = { core: [], recommended: [], expansion: [] };
      }
      
      const existingExpansion = p.aiAnalysis.classRecommendations.expansion || [];
      const existingAllCodes = existingClasses;
      
      additionalClasses.forEach(item => {
        if (!existingAllCodes.includes(item.class)) {
          existingExpansion.push(item);
          p.aiAnalysis.recommendedClasses.push(item.class);
          p.aiAnalysis.classReasons[item.class] = `ðŸŸ¢ ì¶”ê°€ í™•ìž¥: ${item.reason}`;
        }
      });
      
      p.aiAnalysis.classRecommendations.expansion = existingExpansion;
      
      // â˜…â˜…â˜… ì¶”ê°€ëœ ë¥˜ì— ëŒ€í•´ ì§€ì •ìƒí’ˆ 10ê°œ ìžë™ ì¶”ì²œ â˜…â˜…â˜…
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
          const paddedCode = classCode.padStart(2, '0');
          try {
            App.showToast(`ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ì¶”ì²œ ì¤‘...`, 'info');
            
            // DBì—ì„œ ê³ ì‹œëª…ì¹­ í›„ë³´ ì¡°íšŒ
            const candidates = await TM.fetchOptimalCandidates(
              paddedCode,
              allKeywords,
              analysis
            );
            
            console.log(`[TM] ì¶”ê°€ ì¶”ì²œ ì œ${classCode}ë¥˜ í›„ë³´: ${candidates.length}ê±´`);
            
            let selectedGoods = [];
            if (candidates.length > 0) {
              // LLMì´ ìµœì  ìƒí’ˆ ì„ íƒ
              selectedGoods = await TM.selectOptimalGoods(
                classCode,
                candidates,
                businessInput || p.aiAnalysis.businessAnalysis,
                analysis
              );
            }
            
            // â˜… 10ê°œ ë³´ìž¥
            selectedGoods = await TM.ensureMinGoods(classCode, selectedGoods, businessInput || p.aiAnalysis.businessAnalysis || '');
            p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
            console.log(`[TM] ì¶”ê°€ ì¶”ì²œ ì œ${classCode}ë¥˜ ìµœì¢…: ${selectedGoods.length}ê±´`);
            
          } catch (classError) {
            console.error(`[TM] ì¶”ê°€ ì¶”ì²œ ì œ${classCode}ë¥˜ ì²˜ë¦¬ ì‹¤íŒ¨:`, classError);
            // â˜… ì—ëŸ¬ ì‹œì—ë„ ë³´ì¶© ì‹œë„
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
        ? ` (ê° ë¥˜ë‹¹ ì§€ì •ìƒí’ˆ ${newClassCodes.map(c => (p.aiAnalysis.recommendedGoods?.[c]?.length || 0) + 'ê°œ').join(', ')} ì¶”ì²œ)`
        : '';
      App.showToast(`${additionalClasses.length}ê°œ ì¶”ê°€ ë¥˜ê°€ í™•ìž¥ ëª©ë¡ì— ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤.${goodsCountMsg}`, 'success');
      
    } catch (err) {
      console.error('[TM] ì¶”ê°€ ì¶”ì²œ ìš”ì²­ ì‹¤íŒ¨:', err);
      App.showToast('ì¶”ê°€ ì¶”ì²œ ìš”ì²­ì— ì‹¤íŒ¨í–ˆìŠµë‹ˆë‹¤.', 'error');
    }
  };
  
  // ì§€ì •ìƒí’ˆ ë³µì‚¬ (ì½¤ë§ˆë¡œ ì—°ê²°, ìœ ì‚¬êµ°ì½”ë“œ ì œì™¸)
  TM.copyDesignatedGoods = function() {
    const p = TM.currentProject;
    if (!p || p.designatedGoods.length === 0) {
      App.showToast('ë³µì‚¬í•  ì§€ì •ìƒí’ˆì´ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    // ë¥˜ë³„ë¡œ ìƒí’ˆëª… ìˆ˜ì§‘
    const goodsByClass = {};
    p.designatedGoods.forEach(classData => {
      const classCode = classData.classCode;
      const goodsNames = (classData.goods || []).map(g => g.name);
      if (goodsNames.length > 0) {
        goodsByClass[classCode] = goodsNames;
      }
    });
    
    // í¬ë§· ì„ íƒ (ë¥˜ë³„ êµ¬ë¶„ vs ì „ì²´ í•©ì¹˜ê¸°)
    const classKeys = Object.keys(goodsByClass).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (classKeys.length === 0) {
      App.showToast('ë³µì‚¬í•  ì§€ì •ìƒí’ˆì´ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    // ë¥˜ë³„ë¡œ êµ¬ë¶„í•˜ì—¬ ë³µì‚¬
    const formattedText = classKeys.map(classCode => {
      const goods = goodsByClass[classCode];
      return `ã€ì œ${classCode}ë¥˜ã€‘ ${goods.join(', ')}`;
    }).join('\n\n');
    
    // í´ë¦½ë³´ë“œì— ë³µì‚¬
    navigator.clipboard.writeText(formattedText).then(() => {
      App.showToast(`${classKeys.length}ê°œ ë¥˜, ${Object.values(goodsByClass).flat().length}ê°œ ìƒí’ˆì´ ë³µì‚¬ë˜ì—ˆìŠµë‹ˆë‹¤.`, 'success');
    }).catch(err => {
      console.error('[TM] ë³µì‚¬ ì‹¤íŒ¨:', err);
      // í´ë°±: textarea ì‚¬ìš©
      const textarea = document.createElement('textarea');
      textarea.value = formattedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      App.showToast(`${classKeys.length}ê°œ ë¥˜ ì§€ì •ìƒí’ˆì´ ë³µì‚¬ë˜ì—ˆìŠµë‹ˆë‹¤.`, 'success');
    });
  };
  
  // ìœ ì‚¬êµ° ì½”ë“œë¡œ ì§€ì •ìƒí’ˆ ê²€ìƒ‰
  TM.searchBySimilarGroup = async function(classCode) {
    const input = document.getElementById(`tm-similar-input-${classCode}`);
    const resultsDiv = document.getElementById(`tm-similar-results-${classCode}`);
    
    if (!input || !resultsDiv) return;
    
    const similarCode = input.value.trim().toUpperCase();
    
    if (!similarCode) {
      App.showToast('ìœ ì‚¬êµ° ì½”ë“œë¥¼ ìž…ë ¥í•˜ì„¸ìš”. (ì˜ˆ: G5001)', 'warning');
      return;
    }
    
    try {
      // DBì—ì„œ ìœ ì‚¬êµ° ì½”ë“œë¡œ ê²€ìƒ‰
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
            ìœ ì‚¬êµ° ì½”ë“œ "${similarCode}"ì— í•´ë‹¹í•˜ëŠ” ì§€ì •ìƒí’ˆì´ ì—†ìŠµë‹ˆë‹¤.
          </div>
        `;
        resultsDiv.style.display = 'block';
        return;
      }
      
      // ì´ë¯¸ ì„ íƒëœ ìƒí’ˆ í•„í„°ë§
      const classItem = TM.currentProject?.designatedGoods.find(g => g.classCode === classCode);
      const existingNames = new Set(classItem?.goods.map(g => g.name) || []);
      
      resultsDiv.innerHTML = `
        <div class="tm-similar-result-header">
          <span>ìœ ì‚¬êµ° "${similarCode}" ê²€ìƒ‰ ê²°ê³¼: ${data.length}ê±´</span>
          <button class="btn btn-xs btn-ghost" onclick="document.getElementById('tm-similar-results-${classCode}').style.display='none'">ë‹«ê¸°</button>
        </div>
        <div class="tm-similar-result-list">
          ${data.map(g => {
            const isAdded = existingNames.has(g.goods_name);
            return `
              <div class="tm-similar-result-item ${isAdded ? 'added' : ''}">
                <span class="tm-similar-item-name">${TM.escapeHtml(g.goods_name)}</span>
                <span class="tm-similar-item-code">${g.similar_group_code}</span>
                ${isAdded ? `
                  <span class="tm-similar-added-badge">ì¶”ê°€ë¨</span>
                ` : `
                  <button class="btn btn-xs btn-primary" 
                          data-action="tm-add-from-similar" 
                          data-class-code="${classCode}"
                          data-goods-name="${TM.escapeHtml(g.goods_name)}"
                          data-similar-group="${g.similar_group_code}">
                    + ì¶”ê°€
                  </button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      `;
      resultsDiv.style.display = 'block';
      
    } catch (error) {
      console.error('[TM] ìœ ì‚¬êµ° ê²€ìƒ‰ ì‹¤íŒ¨:', error);
      App.showToast('ê²€ìƒ‰ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // ìœ ì‚¬êµ° ê²€ìƒ‰ ê²°ê³¼ì—ì„œ ì§€ì •ìƒí’ˆ ì¶”ê°€
  TM.addGoodsFromSimilar = function(classCode, goodsName, similarGroup) {
    if (!TM.currentProject) return;
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) {
      App.showToast('ë¨¼ì € ìƒí’ˆë¥˜ë¥¼ ì„ íƒí•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    // ì¤‘ë³µ ì²´í¬
    if (classItem.goods.some(g => g.name === goodsName)) {
      App.showToast('ì´ë¯¸ ì¶”ê°€ëœ ì§€ì •ìƒí’ˆìž…ë‹ˆë‹¤.', 'info');
      return;
    }
    
    classItem.goods.push({
      name: goodsName,
      similarGroup: similarGroup,
      gazetted: true
    });
    classItem.goodsCount = classItem.goods.length;
    
    // ê²€ìƒ‰ ê²°ê³¼ UI ì—…ë°ì´íŠ¸ (ì¶”ê°€ë¨ í‘œì‹œ)
    TM.renderCurrentStep();
    App.showToast(`"${goodsName}" ì¶”ê°€ë¨`, 'success');
  };
  
  TM.addGoods = function(classCode, goodsData) {
    if (!TM.currentProject) return;
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) return;
    
    // ì¤‘ë³µ ì²´í¬
    if (classItem.goods.some(g => g.name === goodsData.name)) {
      App.showToast('ì´ë¯¸ ì¶”ê°€ëœ ì§€ì •ìƒí’ˆìž…ë‹ˆë‹¤.', 'warning');
      return;
    }
    
    classItem.goods.push(goodsData);
    classItem.goodsCount = classItem.goods.length;
    classItem.nonGazettedCount = classItem.goods.filter(g => !g.gazetted).length;
    
    TM.renderCurrentStep();
    TM.initGoodsAutocomplete(classCode);
  };
  
  TM.removeGoods = function(classCode, goodsName) {
    console.log('[TM] removeGoods í˜¸ì¶œ:', classCode, goodsName);
    
    if (!TM.currentProject) {
      console.log('[TM] removeGoods: currentProject ì—†ìŒ');
      return;
    }
    
    const classItem = TM.currentProject.designatedGoods.find(g => g.classCode === classCode);
    if (!classItem) {
      console.log('[TM] removeGoods: classItem ì—†ìŒ', classCode);
      return;
    }
    
    const beforeCount = classItem.goods.length;
    classItem.goods = classItem.goods.filter(g => g.name !== goodsName);
    const afterCount = classItem.goods.length;
    
    console.log('[TM] removeGoods: ì‚­ì œ ê²°ê³¼', beforeCount, '->', afterCount);
    
    classItem.goodsCount = classItem.goods.length;
    classItem.nonGazettedCount = classItem.goods.filter(g => !g.gazetted).length;
    
    TM.renderCurrentStep();
    App.showToast(`"${goodsName}" ì‚­ì œë¨`, 'info');
  };
  
  TM.initGoodsAutocomplete = function(classCode) {
    console.log('[TM] initGoodsAutocomplete í˜¸ì¶œ:', classCode);
    
    const input = document.getElementById(`tm-goods-input-${classCode}`);
    const autocomplete = document.getElementById(`tm-autocomplete-${classCode}`);
    
    if (!input || !autocomplete) {
      console.log('[TM] initGoodsAutocomplete: ìš”ì†Œë¥¼ ì°¾ì„ ìˆ˜ ì—†ìŒ', {
        input: !!input,
        autocomplete: !!autocomplete,
        inputId: `tm-goods-input-${classCode}`,
        autocompleteId: `tm-autocomplete-${classCode}`
      });
      return;
    }
    
    console.log('[TM] initGoodsAutocomplete: ìš”ì†Œ ì°¾ìŒ, ì´ë²¤íŠ¸ ì—°ê²°');
    
    const searchGoods = TM.debounce(async (query) => {
      console.log('[TM] searchGoods í˜¸ì¶œ:', query);
      
      if (query.length < 2) {
        autocomplete.style.display = 'none';
        return;
      }
      
      // DBì—ì„œ ì§ì ‘ ê²€ìƒ‰ (ìºì‹œ ì‚¬ìš© ì•ˆí•¨)
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
        console.warn('[TM] ì§€ì •ìƒí’ˆ ê²€ìƒ‰ ì‹¤íŒ¨:', e);
      }
      
      if (results.length === 0) {
        // ë¹„ê³ ì‹œëª…ì¹­ í—ˆìš© ëª¨ë“œë©´ ì§ì ‘ ìž…ë ¥ ì˜µì…˜ í‘œì‹œ
        if (!TM.currentProject.gazettedOnly) {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" data-name="${TM.escapeHtml(query)}" data-gazetted="false"
                 style="padding: 8px 12px; cursor: pointer;"
                 onmouseover="this.style.backgroundColor='#f5f5f5'" 
                 onmouseout="this.style.backgroundColor='white'">
              <div class="goods-name" style="font-weight: 500;">"${TM.escapeHtml(query)}" ì§ì ‘ ìž…ë ¥</div>
              <div class="goods-meta" style="font-size: 11px; color: #888;">ë¹„ê³ ì‹œëª…ì¹­ (52,000ì›/ë¥˜ ì ìš©)</div>
            </div>
          `;
          autocomplete.style.display = 'block';
        } else {
          autocomplete.innerHTML = `
            <div class="tm-goods-autocomplete-item" style="padding: 8px 12px; color: #8b95a1;">
              ê²€ìƒ‰ ê²°ê³¼ê°€ ì—†ìŠµë‹ˆë‹¤. (ê³ ì‹œëª…ì¹­ ëª¨ë“œ)
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
          <div class="goods-meta" style="font-size: 11px; color: #888;">${r.goods_name_en || ''} Â· ${r.similar_group_code || ''}</div>
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
    
    // Enter í‚¤ë¡œ ì§ì ‘ ìž…ë ¥ (ë¹„ê³ ì‹œ ëª¨ë“œ)
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
  // Step 3: ì„ í–‰ìƒí‘œ ê²€ìƒ‰
  // ============================================================
  
  TM.renderStep3_PriorSearch = function(container) {
    const p = TM.currentProject;
    
    // ì„ íƒëœ ìœ ì‚¬êµ° ì½”ë“œ ìˆ˜ì§‘
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
    
    // ê²€ìƒ‰ í†µê³„
    const stats = p.searchResults.stats || {};
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>ðŸ” ì„ í–‰ìƒí‘œ ê²€ìƒ‰</h3>
        <p>ì¶œì› ì „ ìœ ì‚¬ ìƒí‘œê°€ ìžˆëŠ”ì§€ ê²€ìƒ‰í•©ë‹ˆë‹¤. <strong>2-Stage AI ê²€ìƒ‰ ì—”ì§„</strong>ì´ ë¬¸ìž+ë„í˜•ì„ ë³‘ë ¬ ë¶„ì„í•©ë‹ˆë‹¤.</p>
      </div>
      
      <!-- ì„ íƒëœ ì§€ì •ìƒí’ˆ ìš”ì•½ -->
      ${classList.length > 0 ? `
        <div class="tm-selected-summary">
          <div class="tm-summary-header">
            <span class="tm-summary-title">ðŸ“¦ ì„ íƒëœ ì§€ì •ìƒí’ˆ</span>
            <span class="tm-summary-count">${classList.length}ê°œ ë¥˜, ${similarGroupList.length}ê°œ ìœ ì‚¬êµ°</span>
          </div>
          <div class="tm-summary-classes">
            ${classList.map(c => `<span class="tm-class-badge">ì œ${c}ë¥˜</span>`).join('')}
          </div>
          <div class="tm-summary-similar-groups">
            <span class="tm-similar-label">ìœ ì‚¬êµ°:</span>
            ${similarGroupList.slice(0, 10).map(sg => `<span class="tm-similar-badge">${sg}</span>`).join('')}
            ${similarGroupList.length > 10 ? `<span class="tm-similar-more">+${similarGroupList.length - 10}ê°œ</span>` : ''}
          </div>
        </div>
      ` : `
        <div class="tm-warning-box">
          âš ï¸ ì§€ì •ìƒí’ˆì„ ë¨¼ì € ì„ íƒí•´ì£¼ì„¸ìš”. ìœ ì‚¬êµ° ì½”ë“œ ê¸°ë°˜ ê²€ìƒ‰ì´ ë” ì •í™•í•©ë‹ˆë‹¤.
        </div>
      `}
      
      <!-- ê²€ìƒ‰ ì»¨íŠ¸ë¡¤ -->
      <div class="tm-search-section">
        <div class="tm-search-controls">
          <div class="tm-search-type-toggle">
            <button class="active" data-search-type="text" onclick="TM.setSearchType('text', this)">ë¬¸ìž ê²€ìƒ‰</button>
            <button data-search-type="figure" onclick="TM.setSearchType('figure', this)">ë„í˜• ê²€ìƒ‰</button>
          </div>
        </div>
        
        <!-- ë¬¸ìž ê²€ìƒ‰ ì˜µì…˜ -->
        <div class="tm-search-options" id="tm-search-options-text">
          <div class="tm-search-form">
            <!-- 1í–‰: ìƒí‘œëª… + ìƒíƒœ í•„í„° -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 2;">
                <label>ìƒí‘œëª…</label>
                <input type="text" class="tm-input" id="tm-search-keyword" 
                       value="${TM.escapeHtml(p.trademarkName)}" 
                       placeholder="ê²€ìƒ‰í•  ìƒí‘œëª… ìž…ë ¥">
              </div>
              <div class="input-group" style="flex: 1;">
                <label>ìƒíƒœ í•„í„°</label>
                <select class="tm-input" id="tm-search-status">
                  <option value="all">ì „ì²´</option>
                  <option value="registered" selected>ë“±ë¡/ì¶œì›</option>
                  <option value="registered_only">ë“±ë¡ë§Œ</option>
                </select>
              </div>
            </div>
            
            <!-- 2í–‰: ìƒí’ˆë¥˜ í•„í„° -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 1;">
                <label>ìƒí’ˆë¥˜ í•„í„°</label>
                <div class="tm-class-filter">
                  <select class="tm-input" id="tm-search-class-mode" onchange="TM.toggleClassFilter(this.value)">
                    <option value="all">ì „ì²´ ìƒí’ˆë¥˜</option>
                    ${classList.length > 0 ? `<option value="selected" selected>ì„ íƒí•œ ë¥˜ë§Œ</option>` : ''}
                    <option value="custom">ì§ì ‘ ì„ íƒ</option>
                  </select>
                </div>
              </div>
              <div class="input-group tm-custom-class-input" id="tm-custom-class-group" style="flex: 1; ${classList.length > 0 ? 'display: none;' : ''}">
                <label>ìƒí’ˆë¥˜ ì§ì ‘ ìž…ë ¥</label>
                <input type="text" class="tm-input" id="tm-search-class-custom" 
                       placeholder="ì˜ˆ: 09, 35, 42 (ì‰¼í‘œë¡œ êµ¬ë¶„)">
              </div>
            </div>
            
            <!-- 3í–‰: ìœ ì‚¬êµ°ì½”ë“œ í•„í„° -->
            <div class="tm-search-row">
              <div class="input-group" style="flex: 1;">
                <label>ìœ ì‚¬êµ°ì½”ë“œ í•„í„° (ì„ íƒ)</label>
                <div class="tm-similarity-filter">
                  <select class="tm-input" id="tm-search-similarity-mode" onchange="TM.toggleSimilarityFilter(this.value)">
                    <option value="none">ì‚¬ìš© ì•ˆ í•¨</option>
                    ${similarGroupList.length > 0 ? `<option value="selected">ì„ íƒí•œ ìœ ì‚¬êµ°ë§Œ (${similarGroupList.length}ê°œ)</option>` : ''}
                    <option value="custom">ì§ì ‘ ìž…ë ¥</option>
                  </select>
                </div>
              </div>
              <div class="input-group tm-custom-similarity-input" id="tm-custom-similarity-group" style="flex: 1; display: none;">
                <label>ìœ ì‚¬êµ°ì½”ë“œ ì§ì ‘ ìž…ë ¥</label>
                <input type="text" class="tm-input" id="tm-search-similarity-custom" 
                       placeholder="ì˜ˆ: G390101, S120401 (ì‰¼í‘œë¡œ êµ¬ë¶„)">
              </div>
            </div>
            
            <!-- ì„ íƒëœ í•„í„° ë¯¸ë¦¬ë³´ê¸° -->
            <div class="tm-filter-preview" id="tm-filter-preview">
              ${classList.length > 0 ? `
                <div class="tm-preview-section">
                  <span class="tm-preview-label">ðŸ“¦ ìƒí’ˆë¥˜:</span>
                  <span class="tm-preview-values" id="tm-preview-classes">${classList.map(c => 'ì œ'+c+'ë¥˜').join(', ')}</span>
                </div>
              ` : ''}
              ${similarGroupList.length > 0 ? `
                <div class="tm-preview-section">
                  <span class="tm-preview-label">ðŸ·ï¸ ìœ ì‚¬êµ°:</span>
                  <span class="tm-preview-values" id="tm-preview-similarities">
                    ${similarGroupList.slice(0, 5).join(', ')}${similarGroupList.length > 5 ? ` ì™¸ ${similarGroupList.length - 5}ê°œ` : ''}
                  </span>
                </div>
              ` : ''}
            </div>
            
            <div class="tm-search-actions">
              <button class="btn btn-primary btn-lg" data-action="tm-search-text">
                ðŸ” ìƒí‘œ ê²€ìƒ‰
              </button>
            </div>
            
            <!-- ê²€ìƒ‰ ì§„í–‰ ìƒíƒœ -->
            <div class="tm-search-progress" id="tm-search-progress" style="display: none;">
              <div class="tm-progress-track">
                <div class="tm-progress-fill" id="tm-search-progress-fill" style="width: 0%"></div>
              </div>
              <div class="tm-progress-text" id="tm-search-progress-text">ì¤€ë¹„ ì¤‘...</div>
            </div>
          </div>
        </div>
        
        <!-- ë„í˜• ê²€ìƒ‰ ì˜µì…˜ -->
        <div class="tm-search-options" id="tm-search-options-figure" style="display: none;">
          <div class="tm-vienna-section">
            <h4>ë¹„ì—”ë‚˜ ë„í˜• ë¶„ë¥˜ ì½”ë“œ</h4>
            <p class="tm-hint">ìƒí‘œ ì´ë¯¸ì§€ë¥¼ ë¶„ì„í•˜ì—¬ ë¹„ì—”ë‚˜ ì½”ë“œë¥¼ ì¶”ì²œë°›ìœ¼ì„¸ìš”.</p>
            <button class="btn btn-secondary" data-action="tm-analyze-vienna">
              ðŸ¤– AI ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„
            </button>
            ${p.aiAnalysis.viennaCodeSuggestion && p.aiAnalysis.viennaCodeSuggestion.length > 0 ? `
              <div class="tm-vienna-suggestions">
                <strong>ì¶”ì²œ ì½”ë“œ:</strong>
                ${p.aiAnalysis.viennaCodeSuggestion.map(v => `
                  <span class="tm-vienna-badge">${v.code}: ${v.description}</span>
                `).join('')}
              </div>
            ` : ''}
            <div class="input-group" style="margin-top: 12px;">
              <label>ë¹„ì—”ë‚˜ ì½”ë“œ ì§ì ‘ ìž…ë ¥</label>
              <input type="text" class="tm-input" id="tm-vienna-code" 
                     placeholder="ì˜ˆ: 03.01.01">
            </div>
            <div class="tm-search-actions">
              <button class="btn btn-primary" data-action="tm-search-figure">
                ðŸ” ë„í˜• ê²€ìƒ‰
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- ê²€ìƒ‰ ê²°ê³¼ -->
      <div class="tm-search-results-section">
        <div class="tm-search-results-header">
          <h4>ê²€ìƒ‰ ê²°ê³¼</h4>
          ${p.searchResults.searchedAt ? `
            <span class="tm-search-time">
              ${new Date(p.searchResults.searchedAt).toLocaleString('ko-KR')} ê²€ìƒ‰
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
    
    // ë²„íŠ¼ ì•¡ì…˜ ë³€ê²½
    const searchBtn = document.querySelector('[data-action^="tm-search-"]');
    if (searchBtn) {
      searchBtn.dataset.action = type === 'text' ? 'tm-search-text' : 'tm-search-figure';
    }
  };
  
  // ìƒí’ˆë¥˜ í•„í„° í† ê¸€
  TM.toggleClassFilter = function(mode) {
    const customGroup = document.getElementById('tm-custom-class-group');
    const previewClasses = document.getElementById('tm-preview-classes');
    
    if (mode === 'custom') {
      if (customGroup) customGroup.style.display = 'block';
      if (previewClasses) previewClasses.textContent = 'ì§ì ‘ ìž…ë ¥';
    } else if (mode === 'all') {
      if (customGroup) customGroup.style.display = 'none';
      if (previewClasses) previewClasses.textContent = 'ì „ì²´';
    } else {
      if (customGroup) customGroup.style.display = 'none';
      // ì„ íƒëœ ìƒí’ˆë¥˜ í‘œì‹œ
      const p = TM.currentProject;
      if (p && previewClasses) {
        const classes = (p.designatedGoods || []).map(g => 'ì œ' + g.classCode + 'ë¥˜');
        previewClasses.textContent = classes.join(', ') || 'ì—†ìŒ';
      }
    }
  };
  
  // ìœ ì‚¬êµ°ì½”ë“œ í•„í„° í† ê¸€
  TM.toggleSimilarityFilter = function(mode) {
    const customGroup = document.getElementById('tm-custom-similarity-group');
    const previewSimilarities = document.getElementById('tm-preview-similarities');
    
    if (mode === 'custom') {
      if (customGroup) customGroup.style.display = 'block';
      if (previewSimilarities) previewSimilarities.textContent = 'ì§ì ‘ ìž…ë ¥';
    } else if (mode === 'none') {
      if (customGroup) customGroup.style.display = 'none';
      if (previewSimilarities) previewSimilarities.textContent = 'ì‚¬ìš© ì•ˆ í•¨';
    } else {
      if (customGroup) customGroup.style.display = 'none';
      // ì„ íƒëœ ìœ ì‚¬êµ° í‘œì‹œ
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
        previewSimilarities.textContent = groups.slice(0, 5).join(', ') + (groups.length > 5 ? ` ì™¸ ${groups.length - 5}ê°œ` : '') || 'ì—†ìŒ';
      }
    }
  };
  
  // í˜„ìž¬ ì„ íƒëœ í•„í„° ê°’ ê°€ì ¸ì˜¤ê¸°
  TM.getSearchFilters = function() {
    const p = TM.currentProject;
    
    // ìƒí’ˆë¥˜ í•„í„°
    const classMode = document.getElementById('tm-search-class-mode')?.value || 'all';
    let targetClasses = [];
    
    if (classMode === 'selected') {
      targetClasses = (p.designatedGoods || []).map(g => g.classCode);
    } else if (classMode === 'custom') {
      const customInput = document.getElementById('tm-search-class-custom')?.value || '';
      targetClasses = customInput.split(',').map(c => c.trim().replace(/[^0-9]/g, '')).filter(c => c);
    }
    
    // ìœ ì‚¬êµ°ì½”ë“œ í•„í„°
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
          <div class="icon">ðŸ”</div>
          <h4>ê²€ìƒ‰ ê²°ê³¼ê°€ ì—†ìŠµë‹ˆë‹¤</h4>
          <p>ê²€ìƒ‰ì„ ì‹¤í–‰í•˜ì„¸ìš”.</p>
        </div>
      `;
    }
    
    // â˜… ìœ ì‚¬êµ° ê¸°ë°˜ í†µê³„
    const groupOverlapCount = allResults.filter(r => r.hasGroupOverlap).length;
    const noOverlapCount = allResults.filter(r => !r.hasGroupOverlap).length;
    const highRiskCount = allResults.filter(r => r.isHighRisk || r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    const mediumRiskCount = allResults.filter(r => r.riskLevel === 'medium').length;
    
    return `
      <!-- ê²€ìƒ‰ ê²°ê³¼ ìš”ì•½ (ìœ ì‚¬êµ° ê¸°ì¤€) -->
      <div class="tm-search-summary">
        <div class="tm-summary-stat">
          <span class="tm-stat-num">${allResults.length}</span>
          <span class="tm-stat-label">ì´ ê²°ê³¼</span>
        </div>
        <div class="tm-summary-stat risk-overlap">
          <span class="tm-stat-num">${groupOverlapCount}</span>
          <span class="tm-stat-label">âš ï¸ ìœ ì‚¬êµ° ì¤‘ë³µ</span>
        </div>
        <div class="tm-summary-stat risk-safe">
          <span class="tm-stat-num">${noOverlapCount}</span>
          <span class="tm-stat-label">âœ… ë“±ë¡ê°€ëŠ¥</span>
        </div>
        ${highRiskCount > 0 ? `
          <div class="tm-summary-stat risk-high">
            <span class="tm-stat-num">${highRiskCount}</span>
            <span class="tm-stat-label">â›” ê³ ìœ„í—˜</span>
          </div>
        ` : ''}
      </div>
      
      <!-- ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ ì„¤ëª… -->
      <div class="tm-overlap-explanation">
        <span class="tm-explanation-icon">ðŸ’¡</span>
        <span class="tm-explanation-text">
          <strong>ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ = ë“±ë¡ ê°€ëŠ¥:</strong> ìƒí‘œëª…ì´ ë™ì¼í•˜ë”ë¼ë„ ìœ ì‚¬êµ°ì´ ë‹¤ë¥´ë©´ ì‹¬ì‚¬ ì‹œ ì¶©ëŒí•˜ì§€ ì•ŠìŠµë‹ˆë‹¤.
        </span>
      </div>
      
      <!-- ê²°ê³¼ ëª©ë¡ -->
      <div class="tm-results-list">
        ${allResults.map((r, idx) => TM.renderSearchResultItem(r, idx + 1)).join('')}
      </div>
    `;
  };
  
  // ê°œë³„ ê²€ìƒ‰ ê²°ê³¼ ì•„ì´í…œ ë Œë”ë§ (ìœ ì‚¬êµ° ì¤‘ì‹¬)
  TM.renderSearchResultItem = function(r, rank) {
    const score = r.similarityScore || 0;
    const hasGroupOverlap = r.hasGroupOverlap;
    
    // â˜… ìœ ì‚¬êµ° ê¸°ë°˜ ë¦¬ìŠ¤í¬ í´ëž˜ìŠ¤ ê²°ì •
    let riskClass = 'risk-safe';
    let riskBadge = 'ë“±ë¡ê°€ëŠ¥';
    let riskIcon = 'âœ…';
    
    if (hasGroupOverlap) {
      const riskLevel = r.riskLevel || 'medium';
      if (riskLevel === 'critical' || riskLevel === 'high') {
        riskClass = 'risk-high';
        riskBadge = 'ê³ ìœ„í—˜';
        riskIcon = 'â›”';
      } else if (riskLevel === 'medium') {
        riskClass = 'risk-medium';
        riskBadge = 'ì£¼ì˜';
        riskIcon = 'âš ï¸';
      } else {
        riskClass = 'risk-low';
        riskBadge = 'ì €ìœ„í—˜';
        riskIcon = 'ðŸ”¶';
      }
    }
    
    // ì¶œì›ì¼ í¬ë§·íŒ…
    const appDate = r.applicationDate || '';
    const formattedDate = appDate.length === 8 ? 
      `${appDate.slice(0,4)}-${appDate.slice(4,6)}-${appDate.slice(6,8)}` : appDate;
    
    // ìœ ì‚¬êµ° ì½”ë“œ ì¶”ì¶œ
    const similarGroups = r.similarGroupCodes || r.overlappingGroups || [];
    
    return `
      <div class="tm-search-result-item ${riskClass} ${hasGroupOverlap ? 'has-overlap' : 'no-overlap'}" data-id="${r.applicationNumber}">
        <!-- ì¢Œì¸¡: ìˆœìœ„ + ë¦¬ìŠ¤í¬ ë±ƒì§€ -->
        <div class="tm-result-left">
          <span class="tm-rank-num">${rank}</span>
          <span class="tm-risk-badge ${riskClass}">${riskIcon} ${riskBadge}</span>
        </div>
        
        <!-- ìƒí‘œ ì´ë¯¸ì§€ -->
        <div class="tm-result-image">
          ${r.drawing || r.drawingUrl ? 
            `<img src="${r.drawing || r.drawingUrl}" alt="ìƒí‘œ ì´ë¯¸ì§€" onerror="this.outerHTML='<span class=\"tm-img-placeholder\">ðŸ·ï¸</span>'">` : 
            '<span class="tm-img-placeholder">ðŸ·ï¸</span>'}
        </div>
        
        <!-- ìƒí‘œ ì •ë³´ (ë©”ì¸) -->
        <div class="tm-result-info">
          <div class="tm-result-title">${TM.escapeHtml(r.title || r.trademarkName || '(ëª…ì¹­ì—†ìŒ)')}</div>
          
          <div class="tm-result-details">
            <div class="tm-detail-row">
              <span class="tm-detail-item"><strong>ì¶œì›ë²ˆí˜¸</strong> ${r.applicationNumber || '-'}</span>
              <span class="tm-detail-item"><strong>ì¶œì›ì¼</strong> ${formattedDate || '-'}</span>
            </div>
            <div class="tm-detail-row">
              ${r.applicantName ? `<span class="tm-detail-item"><strong>ì¶œì›ì¸</strong> ${TM.escapeHtml(r.applicantName)}</span>` : ''}
              ${r.rightHolderName ? `<span class="tm-detail-item"><strong>ê¶Œë¦¬ìž</strong> ${TM.escapeHtml(r.rightHolderName)}</span>` : ''}
            </div>
            <div class="tm-detail-row">
              ${r.classificationCode ? `<span class="tm-detail-item"><strong>ì§€ì •ìƒí’ˆë¥˜</strong> ì œ${r.classificationCode}ë¥˜</span>` : ''}
              ${similarGroups.length > 0 ? `
                <span class="tm-detail-item"><strong>ìœ ì‚¬êµ°</strong> ${similarGroups.slice(0,3).join(', ')}${similarGroups.length > 3 ? '...' : ''}</span>
              ` : ''}
            </div>
            ${r.designatedGoods ? `
              <div class="tm-detail-row tm-goods-row">
                <span class="tm-detail-item tm-goods-detail"><strong>ì§€ì •ìƒí’ˆ</strong> ${TM.escapeHtml(r.designatedGoods.slice(0, 100))}${r.designatedGoods.length > 100 ? '...' : ''}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="tm-result-tags">
            <span class="tm-result-status ${TM.getStatusClass(r.applicationStatus)}">
              ${r.applicationStatus || '-'}
            </span>
            ${r.applicationNumber ? `
              <a href="http://kipris.or.kr/khome/main.jsp#702${r.applicationNumber.replace(/-/g, '')}" 
                 target="_blank" class="tm-kipris-link" title="KIPRISì—ì„œ ë³´ê¸°">
                ðŸ”— KIPRIS
              </a>
            ` : ''}
          </div>
        </div>
        
        <!-- ìœ ì‚¬ë„ ì ìˆ˜ -->
        <div class="tm-result-score">
          ${hasGroupOverlap ? `
            <div class="tm-score-circle ${riskClass}">
              <span class="tm-score-num">${score}</span>
              <span class="tm-score-label">ì </span>
            </div>
            <div class="tm-score-breakdown">
              <div class="tm-score-bar" title="ë¬¸ìž ${r.scoreBreakdown?.text || 0}%">
                <span class="tm-bar-label">ë¬¸ìž</span>
                <div class="tm-bar-track"><div class="tm-bar-fill" style="width: ${r.scoreBreakdown?.text || 0}%"></div></div>
              </div>
              <div class="tm-score-bar" title="ë„í˜• ${r.scoreBreakdown?.vienna || 0}%">
                <span class="tm-bar-label">ë„í˜•</span>
                <div class="tm-bar-track"><div class="tm-bar-fill" style="width: ${r.scoreBreakdown?.vienna || 0}%"></div></div>
              </div>
            </div>
          ` : `
            <div class="tm-safe-indicator">
              <span class="tm-safe-icon">âœ“</span>
              <span class="tm-safe-text">ìœ ì‚¬êµ°<br>ë¹„ì¤‘ë³µ</span>
            </div>
          `}
        </div>
        
        <!-- ìœ„í—˜ ì‚¬ìœ  -->
        <div class="tm-result-reason ${hasGroupOverlap ? '' : 'safe'}">
          <span class="tm-reason-text">${TM.escapeHtml(r.riskReason || (hasGroupOverlap ? 'ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œëª… ìœ ì‚¬ (ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ)' : 'ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ â†’ ë“±ë¡ ê°€ëŠ¥'))}</span>
        </div>
      </div>
    `;
  };
  
  TM.getStatusClass = function(status) {
    if (!status) return '';
    if (status.includes('ë“±ë¡')) return 'registered';
    if (status.includes('ì¶œì›')) return 'pending';
    if (status.includes('ê±°ì ˆ') || status.includes('ì†Œë©¸')) return 'refused';
    return '';
  };
  
  TM.searchByText = async function() {
    const keyword = document.getElementById('tm-search-keyword')?.value?.trim();
    if (!keyword) {
      App.showToast('ê²€ìƒ‰ì–´ë¥¼ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    const statusFilter = document.getElementById('tm-search-status')?.value || 'registered';
    const p = TM.currentProject;
    
    // ìƒˆ í•„í„° ì‹œìŠ¤í…œì—ì„œ ê°’ ê°€ì ¸ì˜¤ê¸°
    const { targetClasses, targetGroups, classMode, similarityMode } = TM.getSearchFilters();
    
    // í•„í„° ì •ë³´ ë¡œê¹…
    console.log('[TM] ê²€ìƒ‰ í•„í„°:', { 
      keyword, statusFilter, classMode, similarityMode,
      targetClasses, targetGroups 
    });
    
    try {
      // ê²€ìƒ‰ ë²„íŠ¼ ë¹„í™œì„±í™” & ë¡œë”© í‘œì‹œ
      const searchBtn = document.querySelector('[data-action="tm-search-text"]');
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = 'ðŸ”„ ê²€ìƒ‰ ì¤‘...';
      }
      
      // í”„ë¡œê·¸ë ˆìŠ¤ í‘œì‹œ
      const progressEl = document.getElementById('tm-search-progress');
      if (progressEl) progressEl.style.display = 'block';
      
      App.showToast('ì„ í–‰ìƒí‘œ ê²€ìƒ‰ ì¤‘... (ìµœëŒ€ 30ì´ˆ ì†Œìš”)', 'info');
      
      // 2-Stage ê²€ìƒ‰ ì—”ì§„ í˜¸ì¶œ
      const results = await TM.searchPriorMarks({
        trademark: keyword,
        viennaCodes: p.aiAnalysis.viennaCodeSuggestion?.map(v => v.code) || [],
        targetClasses: targetClasses,
        targetGroups: targetGroups,
        similarityCode: targetGroups.length > 0 ? targetGroups[0] : null, // KIPRIS APIìš©
        classification: targetClasses.length > 0 ? targetClasses[0] : null, // KIPRIS APIìš©
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
      
      // ê²°ê³¼ ì €ìž¥
      TM.currentProject.searchResults.text = results;
      TM.currentProject.searchResults.searchedAt = new Date().toISOString();
      TM.currentProject.searchResults.query = keyword;
      TM.currentProject.searchResults.stats = {
        total: results.length,
        highRisk: results.filter(r => r.isHighRisk).length,
        mediumRisk: results.filter(r => r.riskLevel === 'medium').length
      };
      
      // UI ì—…ë°ì´íŠ¸
      const resultsEl = document.getElementById('tm-search-results');
      if (resultsEl) {
        resultsEl.innerHTML = TM.renderSearchResults(TM.currentProject.searchResults);
      }
      
      // ê³ ìœ„í—˜ ê²½ê³ 
      const highRiskCount = results.filter(r => r.isHighRisk).length;
      if (highRiskCount > 0) {
        App.showToast(`âš ï¸ ${highRiskCount}ê±´ì˜ ê³ ìœ„í—˜ ìœ ì‚¬ìƒí‘œ ë°œê²¬!`, 'warning');
      } else {
        App.showToast(`âœ… ${results.length}ê±´ ê²€ìƒ‰ ì™„ë£Œ (ê³ ìœ„í—˜ ì—†ìŒ)`, 'success');
      }
      
    } catch (error) {
      console.error('[TM] ê²€ìƒ‰ ì‹¤íŒ¨:', error);
      App.showToast('ê²€ìƒ‰ ì‹¤íŒ¨: ' + error.message, 'error');
    } finally {
      // ë²„íŠ¼ ë³µêµ¬
      const searchBtn = document.querySelector('[data-action="tm-search-text"]');
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'ðŸ” ìƒí‘œ ê²€ìƒ‰';
      }
      
      // í”„ë¡œê·¸ë ˆìŠ¤ ìˆ¨ê¸°ê¸°
      const progressEl = document.getElementById('tm-search-progress');
      if (progressEl) progressEl.style.display = 'none';
    }
  };
  
  TM.searchByFigure = async function() {
    const viennaCode = document.getElementById('tm-vienna-code')?.value?.trim();
    if (!viennaCode) {
      App.showToast('ë¹„ì—”ë‚˜ ì½”ë“œë¥¼ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    try {
      App.showToast('ë„í˜• ê²€ìƒ‰ ì¤‘...', 'info');
      
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
      
      App.showToast(`${results.length}ê±´ì˜ ë„í˜• ê²€ìƒ‰ ê²°ê³¼ê°€ ìžˆìŠµë‹ˆë‹¤.`, 'success');
      
    } catch (error) {
      console.error('[TM] ë„í˜• ê²€ìƒ‰ ì‹¤íŒ¨:', error);
      App.showToast('ê²€ìƒ‰ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // ============================================================
  // KIPRIS ì„ í–‰ìƒí‘œ ê²€ìƒ‰ ì—”ì§„ (2-Stage Retrieval + Re-rank)
  // GPT ì•Œê³ ë¦¬ì¦˜ ê¸°ë°˜ ìµœì í™” êµ¬í˜„
  // ============================================================
  
  // ê²€ìƒ‰ ìºì‹œ (24ì‹œê°„ ìœ ì§€)
  TM.searchCache = {
    queries: new Map(), // query_hash -> results
    details: new Map(), // applicationNumber -> detail
    maxAge: 24 * 60 * 60 * 1000 // 24ì‹œê°„
  };
  
  // ìºì‹œ í•´ì‹œ ìƒì„±
  TM.getCacheKey = function(type, params) {
    const normalized = JSON.stringify({ type, ...params });
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `${type}_${hash}`;
  };
  
  // ìºì‹œ ì¡°íšŒ
  TM.getFromCache = function(key) {
    const cached = TM.searchCache.queries.get(key);
    if (cached && (Date.now() - cached.timestamp < TM.searchCache.maxAge)) {
      console.log('[KIPRIS] ìºì‹œ ížˆíŠ¸:', key);
      return cached.data;
    }
    return null;
  };
  
  // ìºì‹œ ì €ìž¥
  TM.setToCache = function(key, data) {
    TM.searchCache.queries.set(key, { data, timestamp: Date.now() });
  };
  
  // ====== í…ìŠ¤íŠ¸ ì •ê·œí™” í•¨ìˆ˜ë“¤ ======
  
  // í•œê¸€ ìžëª¨ ë¶„í•´
  TM.decomposeHangul = function(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return [char];
    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;
    const CHO = ['ã„±','ã„²','ã„´','ã„·','ã„¸','ã„¹','ã…','ã…‚','ã…ƒ','ã……','ã…†','ã…‡','ã…ˆ','ã…‰','ã…Š','ã…‹','ã…Œ','ã…','ã…Ž'];
    const JUNG = ['ã…','ã…','ã…‘','ã…’','ã…“','ã…”','ã…•','ã…–','ã…—','ã…˜','ã…™','ã…š','ã…›','ã…œ','ã…','ã…ž','ã…Ÿ','ã… ','ã…¡','ã…¢','ã…£'];
    const JONG = ['','ã„±','ã„²','ã„³','ã„´','ã„µ','ã„¶','ã„·','ã„¹','ã„º','ã„»','ã„¼','ã„½','ã„¾','ã„¿','ã…€','ã…','ã…‚','ã…„','ã……','ã…†','ã…‡','ã…ˆ','ã…Š','ã…‹','ã…Œ','ã…','ã…Ž'];
    return [CHO[cho], JUNG[jung], JONG[jong]].filter(x => x);
  };
  
  // ì´ˆì„± ì¶”ì¶œ
  TM.extractChosung = function(text) {
    const CHO = ['ã„±','ã„²','ã„´','ã„·','ã„¸','ã„¹','ã…','ã…‚','ã…ƒ','ã……','ã…†','ã…‡','ã…ˆ','ã…‰','ã…Š','ã…‹','ã…Œ','ã…','ã…Ž'];
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
  
  // í…ìŠ¤íŠ¸ ì •ê·œí™” (ê³µë°±/íŠ¹ìˆ˜ë¬¸ìž ì œê±°, ì†Œë¬¸ìž ë³€í™˜)
  TM.normalizeText = function(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[\s\-_\.Â·,;:'"!@#$%^&*()+=\[\]{}|\\/<>?~`]/g, '')
      .trim();
  };
  
  // ë ˆë²¤ìŠˆíƒ€ì¸ íŽ¸ì§‘ ê±°ë¦¬
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
  
  // ìžì¹´ë“œ ìœ ì‚¬ë„ (í† í° ê¸°ë°˜)
  TM.jaccardSimilarity = function(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };
  
  // ====== ë¬¸ìž ê²€ìƒ‰ ì¿¼ë¦¬ ë¹Œë” (ìµœëŒ€ 4íšŒ) ======
  
  TM.buildTextQueries = function(trademark, maxQueries = 4) {
    if (!trademark) return [];
    
    const queries = [];
    const added = new Set();
    
    // Q1: ì›ë¬¸
    const q1 = trademark.trim();
    if (q1 && !added.has(q1)) {
      queries.push({ type: 'exact', query: q1 });
      added.add(q1);
    }
    
    // Q2: ì •ê·œí™” (ê³µë°±/íŠ¹ìˆ˜ë¬¸ìž ì œê±°)
    const q2 = TM.normalizeText(trademark);
    if (q2 && !added.has(q2) && q2 !== q1) {
      queries.push({ type: 'normalized', query: q2 });
      added.add(q2);
    }
    
    // Q3: ì ‘ë‘ í™•ìž¥ (2~3ê¸€ìž + ì™€ì¼ë“œì¹´ë“œ)
    if (queries.length < maxQueries && q2.length >= 2) {
      const prefix = q2.slice(0, Math.min(3, q2.length));
      const q3 = prefix + '*';
      if (!added.has(q3)) {
        queries.push({ type: 'prefix', query: q3 });
        added.add(q3);
      }
    }
    
    // Q4: í•µì‹¬ í† í° (ë³µí•© ìƒí‘œ ëŒ€ì‘)
    if (queries.length < maxQueries) {
      // í•œê¸€/ì˜ë¬¸ ë¶„ë¦¬ ì¶”ì¶œ
      const korean = trademark.replace(/[^ê°€-íž£]/g, '');
      const english = trademark.replace(/[^a-zA-Z]/g, '').toLowerCase();
      
      if (korean.length >= 2 && !added.has(korean)) {
        queries.push({ type: 'korean', query: korean });
        added.add(korean);
      } else if (english.length >= 2 && !added.has(english)) {
        queries.push({ type: 'english', query: english });
        added.add(english);
      }
    }
    
    console.log('[KIPRIS] ë¬¸ìž ì¿¼ë¦¬ ìƒì„±:', queries.length, 'ê°œ');
    return queries.slice(0, maxQueries);
  };
  
  // ====== ë¹„ì—”ë‚˜ ì½”ë“œ ì¿¼ë¦¬ ë¹Œë” (ê³„ì¸µ í™•ìž¥) ======
  
  TM.buildViennaQueries = function(viennaCodes, maxQueries = 6) {
    if (!viennaCodes || viennaCodes.length === 0) return [];
    
    const queries = [];
    const added = new Set();
    
    // ìž…ë ¥ëœ ì½”ë“œë“¤ì„ ë°°ì—´ë¡œ ì •ê·œí™”
    const codes = Array.isArray(viennaCodes) ? viennaCodes : [viennaCodes];
    
    for (const code of codes) {
      if (queries.length >= maxQueries) break;
      
      const cleanCode = code.toString().trim();
      if (!cleanCode) continue;
      
      // 1. Exact (leaf) ì½”ë“œ ê²€ìƒ‰
      if (!added.has(cleanCode)) {
        queries.push({ type: 'exact', code: cleanCode });
        added.add(cleanCode);
      }
      
      // 2. ìƒìœ„ (prefix) ì½”ë“œ í™•ëŒ€
      const parts = cleanCode.split('.');
      if (parts.length >= 2 && queries.length < maxQueries) {
        const parentCode = parts.slice(0, -1).join('.');
        if (!added.has(parentCode)) {
          queries.push({ type: 'parent', code: parentCode });
          added.add(parentCode);
        }
      }
      
      // 3. ì„¹ì…˜ ì½”ë“œ (ì²« ë²ˆì§¸ ìˆ«ìžë§Œ)
      if (parts.length >= 1 && queries.length < maxQueries) {
        const sectionCode = parts[0];
        if (!added.has(sectionCode) && sectionCode !== cleanCode) {
          queries.push({ type: 'section', code: sectionCode });
          added.add(sectionCode);
        }
      }
    }
    
    console.log('[KIPRIS] ë¹„ì—”ë‚˜ ì¿¼ë¦¬ ìƒì„±:', queries.length, 'ê°œ');
    return queries.slice(0, maxQueries);
  };
  
  // ====== ë™ì‹œì„± ì œì–´ & ë°±ì˜¤í”„ ======
  
  TM.apiQueue = {
    running: 0,
    maxConcurrent: 3, // ë™ì‹œ ìš”ì²­ 3ê°œ ì œí•œ
    queue: [],
    retryDelays: [1000, 2000, 4000] // ì§€ìˆ˜ ë°±ì˜¤í”„
  };
  
  // ë™ì‹œì„± ì œí•œëœ API í˜¸ì¶œ
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
  
  // ì§€ìˆ˜ ë°±ì˜¤í”„ ìž¬ì‹œë„
  TM.withRetry = async function(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = TM.apiQueue.retryDelays[i] || 4000;
        console.log(`[KIPRIS] ìž¬ì‹œë„ ${i + 1}/${maxRetries} (${delay}ms í›„)`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  };
  
  // ====== ì‹œê°„ì°½ í•„í„° (ìµœê·¼ ì—°ë„ ìš°ì„ ) ======
  
  TM.getYearFilter = function(yearsBack = 5) {
    const now = new Date();
    const startYear = now.getFullYear() - yearsBack;
    return {
      startDate: `${startYear}0101`,
      endDate: `${now.getFullYear()}1231`
    };
  };
  
  // ====== KIPRIS API í˜¸ì¶œ (ë‹¨ì¼) ======
  
  TM.callKiprisAPI = async function(type, params, options = {}) {
    const { useRecent = false, recentYears = 5 } = options;
    
    // ì‹œê°„ì°½ í•„í„° ì ìš©
    if (useRecent) {
      const yearFilter = TM.getYearFilter(recentYears);
      params = { ...params, ...yearFilter };
    }
    
    const cacheKey = TM.getCacheKey(type, params);
    
    // ìºì‹œ í™•ì¸
    const cached = TM.getFromCache(cacheKey);
    if (cached) return cached;
    
    console.log('[KIPRIS] API í˜¸ì¶œ ì‹œìž‘:', type, JSON.stringify(params));
    
    try {
      // App.sb (Supabase) ì¡´ìž¬ ì—¬ë¶€ í™•ì¸
      if (!App.sb || !App.sb.functions) {
        console.warn('[KIPRIS] âš ï¸ Supabase í•¨ìˆ˜ ì—†ìŒ - ì‹œë®¬ë ˆì´ì…˜ ëª¨ë“œ');
        App.showToast('KIPRIS API ì—°ê²° ì•ˆë¨ (ì‹œë®¬ë ˆì´ì…˜ ëª¨ë“œ)', 'warning');
        return TM.simulateSearchResults(type, params);
      }
      
      // Edge Function ì—°ê²° í…ŒìŠ¤íŠ¸ (ì²« í˜¸ì¶œ ì‹œ)
      if (!TM._kiprisTestDone) {
        TM._kiprisTestDone = true;
        console.log('[KIPRIS] Edge Function ì—°ê²° í…ŒìŠ¤íŠ¸...');
        try {
          const testResult = await App.sb.functions.invoke('kipris-proxy', {
            body: { type: 'test', params: {}, apiKey: TM.kiprisConfig.apiKey }
          });
          console.log('[KIPRIS] Edge Function í…ŒìŠ¤íŠ¸ ê²°ê³¼:', testResult);
        } catch (testErr) {
          console.error('[KIPRIS] âŒ Edge Function ì—°ê²° ì‹¤íŒ¨:', testErr);
        }
      }
      
      // ë™ì‹œì„± ì œí•œ + ìž¬ì‹œë„ ì ìš©
      return await TM.throttledCall(() => TM.withRetry(async () => {
        const currentKey = TM.kiprisConfig.apiKey || '(ì—†ìŒ)';
        const defaultKey = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
        console.log('[KIPRIS] ðŸ“¡ Edge Function í˜¸ì¶œ...');
        console.log('[KIPRIS] ðŸ”‘ ì‚¬ìš© í‚¤:', currentKey === defaultKey ? 'âš ï¸ ê¸°ë³¸í‚¤' : 'âœ… ì‚¬ìš©ìží‚¤ (' + currentKey.slice(0,8) + '...)');
        
        const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
          body: { 
            type, 
            params,
            apiKey: TM.kiprisConfig.apiKey // API í‚¤ ì „ë‹¬
          }
        });
        
        console.log('[KIPRIS] ì‘ë‹µ:', { data, error });
        
        if (error) {
          console.error('[KIPRIS] âŒ Edge Function ì˜¤ë¥˜:', error);
          throw error;
        }
        
        if (!data) {
          console.warn('[KIPRIS] âš ï¸ ì‘ë‹µ ë°ì´í„° ì—†ìŒ');
          return TM.simulateSearchResults(type, params);
        }
        
        if (!data.success) {
          console.warn('[KIPRIS] âš ï¸ API ì‹¤íŒ¨:', data.error || 'Unknown error');
          // ì—ëŸ¬ ë©”ì‹œì§€ í‘œì‹œ
          if (data.error) {
            App.showToast(`KIPRIS: ${data.error}`, 'warning');
          }
          return TM.simulateSearchResults(type, params);
        }
        
        const results = data.results || [];
        
        // ìºì‹œ ì €ìž¥
        TM.setToCache(cacheKey, results);
        
        console.log(`[KIPRIS] âœ… ê²€ìƒ‰ ì„±ê³µ: ${results.length}ê±´ (ì´ ${data.totalCount || 0}ê±´)`);
        return results;
      }));
    } catch (error) {
      console.error('[KIPRIS] âŒ API í˜¸ì¶œ ì‹¤íŒ¨:', error);
      App.showToast('KIPRIS ê²€ìƒ‰ ì‹¤íŒ¨ - ì‹œë®¬ë ˆì´ì…˜ ê²°ê³¼ í‘œì‹œ', 'warning');
      return TM.simulateSearchResults(type, params);
    }
  };
  
  // ====== ìƒì„¸ ì¡°íšŒ (Stage B) ======
  
  TM.fetchDetailInfo = async function(applicationNumber) {
    // ìƒì„¸ ìºì‹œ í™•ì¸
    const cached = TM.searchCache.details.get(applicationNumber);
    if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) {
      return cached.data;
    }
    
    try {
      const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
        body: { 
          type: 'detail', 
          params: { applicationNumber },
          apiKey: TM.kiprisConfig.apiKey // API í‚¤ ì „ë‹¬
        }
      });
      
      if (error || !data.success) {
        console.warn('[KIPRIS] ìƒì„¸ ì¡°íšŒ ì‹¤íŒ¨:', applicationNumber);
        return null;
      }
      
      // ìƒì„¸ ìºì‹œ ì €ìž¥ (7ì¼)
      TM.searchCache.details.set(applicationNumber, {
        data: data.result,
        timestamp: Date.now()
      });
      
      return data.result;
    } catch (error) {
      console.error('[KIPRIS] ìƒì„¸ ì¡°íšŒ ì˜¤ë¥˜:', error);
      return null;
    }
  };
  
  // Top-K ìƒì„¸ ì¡°íšŒ (ë³‘ë ¬, ì œí•œì )
  TM.fetchDetailsForTopK = async function(results, topK = 30) {
    const top = results.slice(0, topK);
    console.log(`[KIPRIS] Top ${top.length}ê±´ ìƒì„¸ ì¡°íšŒ ì‹œìž‘`);
    
    const details = await Promise.all(
      top.map(r => TM.fetchDetailInfo(r.applicationNumber))
    );
    
    // ìƒì„¸ ì •ë³´ ë³‘í•©
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
    
    console.log(`[KIPRIS] ìƒì„¸ ì¡°íšŒ ì™„ë£Œ`);
    return top;
  };
  
  // ====== Stage A: í›„ë³´ íšŒìˆ˜ (Retrieval) ======
  
  TM.retrieveCandidates = async function(trademark, viennaCodes, targetClasses, options = {}) {
    const { 
      textBudget = 4, 
      viennaBudget = 6, 
      statusFilter = 'registered',
      classification = null,     // ìƒí’ˆë¥˜ í•„í„°
      similarityCode = null,     // ìœ ì‚¬êµ°ì½”ë“œ í•„í„°
      useRecentFirst = true,  // ìµœê·¼ ì—°ë„ ìš°ì„  ìŠ¤ìº”
      recentYears = 5
    } = options;
    
    const textResults = [];
    const viennaResults = [];
    const SUFFICIENT_THRESHOLD = 50;
    const VIENNA_THRESHOLD = 30;
    
    // ì§„í–‰ìƒí™© ì½œë°± (UI ì—…ë°ì´íŠ¸ìš©)
    const onProgress = options.onProgress || (() => {});
    let progressStep = 0;
    const totalSteps = textBudget + viennaBudget;
    
    // ===== A1) ë¬¸ìž ê²€ìƒ‰ (ì ì‘í˜• í™•ìž¥) =====
    if (trademark) {
      const textQueries = TM.buildTextQueries(trademark, textBudget);
      let totalTextHits = 0;
      
      // 1ë‹¨ê³„: ìµœê·¼ ì—°ë„ ìš°ì„  ìŠ¤ìº”
      if (useRecentFirst) {
        for (let i = 0; i < Math.min(2, textQueries.length); i++) {
          onProgress(++progressStep, totalSteps, `ë¬¸ìž ê²€ìƒ‰ (ìµœê·¼ ${recentYears}ë…„)...`);
          
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
          
          // ìƒí’ˆë¥˜/ìœ ì‚¬êµ°ì½”ë“œ í•„í„° ì¶”ê°€
          if (classification) apiParams.classification = classification;
          if (similarityCode) apiParams.similarityCode = similarityCode;
          
          const results = await TM.callKiprisAPI('text', apiParams);
          
          totalTextHits += results.length;
          textResults.push(...results);
        }
      }
      
      // 2ë‹¨ê³„: ë¶€ì¡±í•˜ë©´ ì „ì²´ ì—°ë„ í™•ìž¥
      if (totalTextHits < SUFFICIENT_THRESHOLD) {
        console.log('[KIPRIS] ìµœê·¼ ê²°ê³¼ ë¶€ì¡±, ì „ì²´ ì—°ë„ í™•ìž¥');
        
        for (let i = 0; i < textQueries.length; i++) {
          if (totalTextHits >= SUFFICIENT_THRESHOLD * 2) {
            console.log('[KIPRIS] ë¬¸ìž ê²€ìƒ‰ ì¶©ë¶„, ì¶”ê°€ ì¿¼ë¦¬ ìŠ¤í‚µ');
            break;
          }
          
          onProgress(++progressStep, totalSteps, `ë¬¸ìž ê²€ìƒ‰ Q${i + 1}...`);
          
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
          
          // ìƒí’ˆë¥˜/ìœ ì‚¬êµ°ì½”ë“œ í•„í„° ì¶”ê°€
          if (classification) apiParams.classification = classification;
          if (similarityCode) apiParams.similarityCode = similarityCode;
          
          const results = await TM.callKiprisAPI('text', apiParams);
          
          // ì¤‘ë³µ ì œê±°í•˜ë©° ì¶”ê°€
          for (const r of results) {
            if (!textResults.find(x => x.applicationNumber === r.applicationNumber)) {
              textResults.push(r);
              totalTextHits++;
            }
          }
        }
      }
      
      console.log(`[KIPRIS] ë¬¸ìž ê²€ìƒ‰ ì™„ë£Œ: ${textResults.length}ê±´`);
    }
    
    // ===== A2) ë¹„ì—”ë‚˜ ê²€ìƒ‰ (ê³„ì¸µí˜• í™•ìž¥) =====
    if (viennaCodes && viennaCodes.length > 0) {
      const viennaQueries = TM.buildViennaQueries(viennaCodes, viennaBudget);
      let exactHits = 0;
      let totalViennaHits = 0;
      
      for (let i = 0; i < viennaQueries.length; i++) {
        const q = viennaQueries[i];
        
        // exact ê²°ê³¼ê°€ ì¶©ë¶„í•˜ë©´ parent/section ìŠ¤í‚µ
        if (q.type !== 'exact' && exactHits >= VIENNA_THRESHOLD) {
          console.log('[KIPRIS] ë¹„ì—”ë‚˜ exact ì¶©ë¶„, ê³„ì¸µ í™•ìž¥ ìŠ¤í‚µ');
          break;
        }
        
        onProgress(++progressStep, totalSteps, `ë„í˜• ê²€ìƒ‰ (${q.code})...`);
        
        const results = await TM.callKiprisAPI('figure', {
          viennaCode: q.code,
          application: statusFilter !== 'registered_only',
          registration: true,
          numOfRows: 30
        });
        
        // ì¤‘ë³µ ì œê±°í•˜ë©° ì¶”ê°€
        for (const r of results) {
          if (!viennaResults.find(x => x.applicationNumber === r.applicationNumber)) {
            viennaResults.push(r);
            totalViennaHits++;
            if (q.type === 'exact') exactHits++;
          }
        }
      }
      
      console.log(`[KIPRIS] ë¹„ì—”ë‚˜ ê²€ìƒ‰ ì™„ë£Œ: ${viennaResults.length}ê±´`);
    }
    
    // ===== A3) í•©ì¹˜ê¸° & êµì§‘í•© íƒœê¹… =====
    const deduped = new Map();
    const textSet = new Set(textResults.map(r => r.applicationNumber));
    const viennaSet = new Set(viennaResults.map(r => r.applicationNumber));
    
    // ëª¨ë“  ê²°ê³¼ í•©ì¹˜ê¸°
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
    
    // ì¶œì²˜ íƒœê¹…
    for (const [key, r] of deduped) {
      if (textSet.has(key)) r._sources.push('text');
      if (viennaSet.has(key)) r._sources.push('vienna');
      r._isIntersection = r._sources.includes('text') && r._sources.includes('vienna');
    }
    
    // êµì§‘í•© í†µê³„
    const intersectionCount = Array.from(deduped.values()).filter(r => r._isIntersection).length;
    console.log(`[KIPRIS] Stage A ì™„ë£Œ: ${deduped.size}ê±´ (êµì§‘í•©: ${intersectionCount}ê±´)`);
    
    onProgress(totalSteps, totalSteps, 'ê²€ìƒ‰ ì™„ë£Œ');
    
    return Array.from(deduped.values());
  };
  
  // ====== ìœ ì‚¬ë„ ìŠ¤ì½”ì–´ë§ ======
  
  TM.calculateTextSimilarity = function(source, target) {
    if (!source || !target) return 0;
    
    const normSource = TM.normalizeText(source);
    const normTarget = TM.normalizeText(target);
    
    // ì™„ì „ ì¼ì¹˜
    if (normSource === normTarget) return 1.0;
    
    // íŽ¸ì§‘ ê±°ë¦¬ ê¸°ë°˜
    const maxLen = Math.max(normSource.length, normTarget.length);
    const editDist = TM.levenshteinDistance(normSource, normTarget);
    const editScore = maxLen > 0 ? 1 - (editDist / maxLen) : 0;
    
    // ìžì¹´ë“œ ìœ ì‚¬ë„
    const jaccardScore = TM.jaccardSimilarity(normSource, normTarget);
    
    // ì ‘ë‘/ì ‘ë¯¸ ì¼ì¹˜
    let prefixScore = 0;
    for (let i = 1; i <= Math.min(normSource.length, normTarget.length); i++) {
      if (normSource.slice(0, i) === normTarget.slice(0, i)) prefixScore = i / maxLen;
    }
    
    // ì´ˆì„± ìœ ì‚¬ë„ (í•œê¸€)
    let chosungScore = 0;
    const srcChosung = TM.extractChosung(source);
    const tgtChosung = TM.extractChosung(target);
    if (srcChosung && tgtChosung) {
      chosungScore = TM.jaccardSimilarity(srcChosung, tgtChosung);
    }
    
    // ê°€ì¤‘ í‰ê· 
    return (editScore * 0.4) + (jaccardScore * 0.25) + (prefixScore * 0.2) + (chosungScore * 0.15);
  };
  
  TM.calculateViennaSimilarity = function(sourceCodes, targetCode) {
    if (!sourceCodes || !targetCode) return 0;
    
    const sources = Array.isArray(sourceCodes) ? sourceCodes : [sourceCodes];
    let maxScore = 0;
    
    for (const src of sources) {
      const srcParts = src.toString().split('.');
      const tgtParts = targetCode.toString().split('.');
      
      // Exact ì¼ì¹˜
      if (src === targetCode) {
        maxScore = Math.max(maxScore, 1.0);
        continue;
      }
      
      // Prefix ì¼ì¹˜ (ìƒìœ„ ì½”ë“œ)
      let matchDepth = 0;
      for (let i = 0; i < Math.min(srcParts.length, tgtParts.length); i++) {
        if (srcParts[i] === tgtParts[i]) matchDepth++;
        else break;
      }
      
      if (matchDepth > 0) {
        const score = matchDepth / Math.max(srcParts.length, tgtParts.length);
        maxScore = Math.max(maxScore, score * 0.8); // prefixëŠ” 80% ê°€ì¤‘
      }
      
      // ê°™ì€ ì„¹ì…˜ (ì²« ë²ˆì§¸ ìˆ«ìžë§Œ ì¼ì¹˜)
      if (srcParts[0] === tgtParts[0]) {
        maxScore = Math.max(maxScore, 0.3);
      }
    }
    
    return maxScore;
  };
  
  TM.calculateScopeSimilarity = function(targetClasses, targetGroups, resultClasses, resultGroups) {
    let classScore = 0;
    let groupScore = 0;
    
    // ë‹ˆìŠ¤ë¥˜ êµì§‘í•©
    if (targetClasses && resultClasses) {
      const tgtSet = new Set(targetClasses.map(c => c.toString()));
      const resClasses = resultClasses.toString().split(/[,\s]+/).map(c => c.trim());
      const intersection = resClasses.filter(c => tgtSet.has(c));
      classScore = intersection.length > 0 ? Math.min(intersection.length / tgtSet.size, 1) : 0;
    }
    
    // ìœ ì‚¬êµ° ì½”ë“œ êµì§‘í•© (ìžˆìœ¼ë©´ ìµœëŒ€ ê°€ì‚°)
    if (targetGroups && targetGroups.length > 0 && resultGroups) {
      const tgtSet = new Set(targetGroups);
      const resGroups = Array.isArray(resultGroups) ? resultGroups : resultGroups.toString().split(/[,\s]+/);
      const intersection = resGroups.filter(g => tgtSet.has(g.trim()));
      groupScore = intersection.length > 0 ? Math.min(intersection.length / tgtSet.size, 1) : 0;
    }
    
    // ìœ ì‚¬êµ°ì´ ìžˆìœ¼ë©´ ê°€ì¤‘ì¹˜ ë†’ìž„
    return targetGroups && targetGroups.length > 0 
      ? (classScore * 0.3) + (groupScore * 0.7)
      : classScore;
  };
  
  // ============================================================
  // ìœ ì‚¬êµ° ì¤‘ë³µ ì²´í¬ (ìƒí‘œ ì‹¬ì‚¬ì˜ í•µì‹¬ íŒë‹¨ ê¸°ì¤€)
  // ìƒí‘œì˜ ìœ ì‚¬ ì—¬ë¶€ëŠ” "ë™ì¼ ìœ ì‚¬êµ° ì½”ë“œ" ë‚´ì—ì„œë§Œ íŒë‹¨ë¨
  // ============================================================
  
  TM.checkSimilarGroupOverlap = function(targetGroups, resultGroups) {
    // íƒ€ê²Ÿ ìœ ì‚¬êµ°ì´ ì—†ìœ¼ë©´ ìƒí’ˆë¥˜ ê¸°ì¤€ìœ¼ë¡œë§Œ íŒë‹¨ (ë³´ìˆ˜ì  ì ‘ê·¼)
    if (!targetGroups || targetGroups.length === 0) {
      return { hasOverlap: true, overlapType: 'unknown', overlappingGroups: [] };
    }
    
    // ê²°ê³¼ ìœ ì‚¬êµ°ì´ ì—†ìœ¼ë©´ (ì•„ì§ ìƒì„¸ ì •ë³´ ë¯¸ì¡°íšŒ)
    if (!resultGroups) {
      return { hasOverlap: true, overlapType: 'unknown', overlappingGroups: [] };
    }
    
    const tgtSet = new Set(targetGroups.map(g => g.trim().toUpperCase()));
    const resGroups = Array.isArray(resultGroups) 
      ? resultGroups.map(g => g.trim().toUpperCase())
      : resultGroups.toString().split(/[,\s]+/).map(g => g.trim().toUpperCase()).filter(g => g);
    
    // ì¤‘ë³µë˜ëŠ” ìœ ì‚¬êµ° ì°¾ê¸°
    const overlappingGroups = resGroups.filter(g => tgtSet.has(g));
    
    if (overlappingGroups.length > 0) {
      return { 
        hasOverlap: true, 
        overlapType: 'exact',  // ì •í™•ížˆ ì¼ì¹˜í•˜ëŠ” ìœ ì‚¬êµ° ìžˆìŒ
        overlappingGroups,
        overlapCount: overlappingGroups.length,
        totalTargetGroups: tgtSet.size
      };
    }
    
    return { 
      hasOverlap: false, 
      overlapType: 'none',  // ìœ ì‚¬êµ° ì¤‘ë³µ ì—†ìŒ = ì¶©ëŒ ì—†ìŒ
      overlappingGroups: [],
      overlapCount: 0,
      totalTargetGroups: tgtSet.size
    };
  };
  
  // ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ì— ë”°ë¥¸ ë¦¬ìŠ¤í¬ ë ˆë²¨ ê²°ì •
  TM.determineRiskLevel = function(hasGroupOverlap, textSimilarity, statusScore) {
    // â˜… í•µì‹¬ ì›ì¹™: ìœ ì‚¬êµ° ì¤‘ë³µì´ ì—†ìœ¼ë©´ ìƒí‘œëª…ì´ ë™ì¼í•´ë„ ë“±ë¡ ê°€ëŠ¥
    if (!hasGroupOverlap) {
      return {
        level: 'safe',      // ë“±ë¡ ê°€ëŠ¥
        isHighRisk: false,
        reason: 'ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ (ë“±ë¡ ê°€ëŠ¥)'
      };
    }
    
    // ìœ ì‚¬êµ° ì¤‘ë³µì´ ìžˆëŠ” ê²½ìš°ì—ë§Œ ìƒí‘œëª… ìœ ì‚¬ë„ë¡œ íŒë‹¨
    if (textSimilarity >= 0.85) {
      return {
        level: 'critical',  // ê±°ì ˆ í™•ì‹¤
        isHighRisk: true,
        reason: 'ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œëª… ë§¤ìš° ìœ ì‚¬ (ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ)'
      };
    }
    
    if (textSimilarity >= 0.70) {
      return {
        level: 'high',      // ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ
        isHighRisk: true,
        reason: 'ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œëª… ìœ ì‚¬ (ì£¼ì˜ í•„ìš”)'
      };
    }
    
    if (textSimilarity >= 0.50) {
      return {
        level: 'medium',    // ì‹¬ì‚¬ê´€ íŒë‹¨ì— ë”°ë¼ ë‹¤ë¦„
        isHighRisk: false,
        reason: 'ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œëª… ë‹¤ì†Œ ìœ ì‚¬ (ì‹¬ì‚¬ê´€ íŒë‹¨)'
      };
    }
    
    // ìœ ì‚¬êµ°ì€ ì¤‘ë³µë˜ì§€ë§Œ ìƒí‘œëª…ì´ ë§Žì´ ë‹¤ë¥¸ ê²½ìš°
    return {
      level: 'low',
      isHighRisk: false,
      reason: 'ìœ ì‚¬êµ° ì¤‘ë³µ ìžˆìœ¼ë‚˜ ìƒí‘œëª… ìƒì´'
    };
  };
  
  TM.calculateStatusScore = function(status) {
    if (!status) return 0.5;
    if (status.includes('ë“±ë¡')) return 1.0;
    if (status.includes('ì¶œì›')) return 0.8;
    if (status.includes('ê³µê³ ')) return 0.7;
    if (status.includes('ê±°ì ˆ') || status.includes('ì·¨í•˜') || status.includes('ì†Œë©¸')) return 0.2;
    return 0.5;
  };
  
  // ====== Stage B: ìƒì„¸ ê²€ì¦ & Re-rank ======
  
  TM.rankAndFilter = function(candidates, sourceText, viennaCodes, targetClasses, targetGroups, topK = 200) {
    // ============================================================
    // ìƒí‘œ ì‹¬ì‚¬ í•µì‹¬ ì›ì¹™: ìœ ì‚¬êµ° êµì§‘í•©ì´ ìžˆì–´ì•¼ë§Œ ìœ ì‚¬ íŒë‹¨
    // ìœ ì‚¬êµ° êµì§‘í•© ì—†ìŒ â†’ ìƒí‘œëª… ë™ì¼í•´ë„ ë“±ë¡ ê°€ëŠ¥
    // ============================================================
    
    for (const r of candidates) {
      // Step 1: ìœ ì‚¬êµ° êµì§‘í•© ì²´í¬ (ê°€ìž¥ ì¤‘ìš”!)
      const groupOverlap = TM.checkSimilarGroupOverlap(targetGroups, r.similarityGroup);
      r._groupOverlap = groupOverlap;
      r._hasGroupOverlap = groupOverlap.hasOverlap;
      r._overlappingGroups = groupOverlap.overlappingGroups || [];
      
      // Step 2: ë¬¸ìž ìœ ì‚¬ë„ ê³„ì‚° (í•­ìƒ ê³„ì‚° - í‘œì‹œìš©)
      r._scoreText = TM.calculateTextSimilarity(sourceText, r.title || r.trademarkName);
      
      // Step 3: ë„í˜• ìœ ì‚¬ë„ ê³„ì‚°
      r._scoreVienna = viennaCodes && r.viennaCode 
        ? TM.calculateViennaSimilarity(viennaCodes, r.viennaCode) 
        : 0;
      
      // Step 4: ìƒíƒœ ì ìˆ˜ (ë“±ë¡ìƒí‘œê°€ ë” ìœ„í—˜)
      r._scoreStatus = TM.calculateStatusScore(r.applicationStatus);
      
      // Step 5: ìµœì¢… ì ìˆ˜ ë° ë¦¬ìŠ¤í¬ ë ˆë²¨ ê²°ì •
      if (!r._hasGroupOverlap && groupOverlap.overlapType !== 'unknown') {
        // â˜… ìœ ì‚¬êµ° êµì§‘í•© ì—†ìŒ = ë“±ë¡ ê°€ëŠ¥ (Safe)
        r._totalScore = 0;
        r._riskLevel = 'safe';
        r._riskReason = 'ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ â†’ ë“±ë¡ ê°€ëŠ¥';
        r._isHighRisk = false;
      } else {
        // â˜… ìœ ì‚¬êµ° êµì§‘í•© ìžˆìŒ = ìƒí‘œëª…/ë„í˜• ìœ ì‚¬ë„ë¡œ íŒë‹¨
        // ê°€ì¤‘ì¹˜: ë¬¸ìž 45%, ë„í˜• 30%, ìƒíƒœ 25%
        const combinedScore = (r._scoreText * 0.45) + (r._scoreVienna * 0.30) + (r._scoreStatus * 0.25);
        r._totalScore = combinedScore;
        
        // êµì§‘í•© + ë¬¸ìž/ë„í˜• ëª¨ë‘ ìœ ì‚¬í•˜ë©´ ì¶”ê°€ ê°€ì¤‘
        if (r._isIntersection) {
          r._totalScore = Math.min(r._totalScore * 1.3, 1.0);
        }
        
        // ë¦¬ìŠ¤í¬ ë ˆë²¨ ê²°ì • (ìœ ì‚¬êµ° êµì§‘í•©ì´ ìžˆëŠ” ê²½ìš°ì—ë§Œ)
        const risk = TM.determineRiskLevel(true, r._scoreText, r._scoreStatus);
        r._riskLevel = risk.level;
        r._riskReason = risk.reason;
        r._isHighRisk = risk.isHighRisk;
        
        // ì¤‘ë³µ ìœ ì‚¬êµ° ì •ë³´ ì¶”ê°€
        if (r._overlappingGroups.length > 0) {
          r._riskReason += ` [ì¤‘ë³µ: ${r._overlappingGroups.join(', ')}]`;
        }
      }
      
      // ìƒí’ˆë¥˜ ì¤‘ë³µ ì²´í¬ (ë³´ì¡° ì •ë³´)
      r._scoreScope = TM.calculateScopeSimilarity(
        targetClasses, targetGroups, 
        r.classificationCode, r.similarityGroup
      );
    }
    
    // ì •ë ¬: ìœ ì‚¬êµ° ì¤‘ë³µ ìžˆëŠ” ê²ƒ ìš°ì„ , ê·¸ ë‹¤ìŒ ì ìˆ˜ìˆœ
    candidates.sort((a, b) => {
      // 1ì°¨: ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ (ì¤‘ë³µ ìžˆëŠ” ê²ƒ ìš°ì„ )
      if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
      if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
      // 2ì°¨: ì ìˆ˜ìˆœ
      return b._totalScore - a._totalScore;
    });
    
    console.log(`[KIPRIS] ëž­í‚¹ ì™„ë£Œ: Top ${Math.min(topK, candidates.length)}ê±´`);
    console.log(`[KIPRIS] ìœ ì‚¬êµ° ì¤‘ë³µ: ${candidates.filter(c => c._hasGroupOverlap).length}ê±´`);
    
    return candidates.slice(0, topK);
  };
  
  // ====== ë©”ì¸ ê²€ìƒ‰ í•¨ìˆ˜ (í†µí•© 2-Stage) ======
  
  TM.searchPriorMarks = async function(options = {}) {
    const {
      trademark,
      viennaCodes = [],
      targetClasses = [],
      targetGroups = [],
      classification = null,    // KIPRIS APIìš© ìƒí’ˆë¥˜
      similarityCode = null,    // KIPRIS APIìš© ìœ ì‚¬êµ°ì½”ë“œ
      statusFilter = 'registered',
      topK = 30,
      fetchDetails = true,  // Stage B ìƒì„¸ ì¡°íšŒ ì—¬ë¶€
      onProgress = null     // ì§„í–‰ìƒí™© ì½œë°±
    } = options;
    
    console.log('[KIPRIS] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('[KIPRIS] ì„ í–‰ìƒí‘œ ê²€ìƒ‰ ì‹œìž‘');
    console.log('[KIPRIS] ìž…ë ¥:', { trademark, viennaCodes, targetClasses: targetClasses.length, targetGroups: targetGroups.length, classification, similarityCode });
    console.log('[KIPRIS] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    
    try {
      // ===== Stage A: í›„ë³´ íšŒìˆ˜ =====
      const candidates = await TM.retrieveCandidates(
        trademark, viennaCodes, targetClasses,
        { 
          statusFilter,
          classification,      // ìƒí’ˆë¥˜ í•„í„° ì „ë‹¬
          similarityCode,      // ìœ ì‚¬êµ°ì½”ë“œ í•„í„° ì „ë‹¬
          onProgress: onProgress ? (step, total, msg) => onProgress(step, total + 2, msg) : null
        }
      );
      
      if (candidates.length === 0) {
        console.log('[KIPRIS] ê²€ìƒ‰ ê²°ê³¼ ì—†ìŒ');
        return [];
      }
      
      // ===== Stage B-1: 1ì°¨ ëž­í‚¹ (K0 = 200) =====
      onProgress?.(8, 10, 'ìœ ì‚¬ë„ ê³„ì‚° ì¤‘...');
      
      const ranked = TM.rankAndFilter(
        candidates, trademark, viennaCodes, 
        targetClasses, targetGroups,
        200 // K0
      );
      
      // êµì§‘í•© í›„ë³´ ìš°ì„  â†’ ìœ ì‚¬êµ° ì¤‘ë³µ ìš°ì„ ìœ¼ë¡œ ë³€ê²½
      ranked.sort((a, b) => {
        // 1ì°¨: ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ (ì¤‘ë³µ ìžˆëŠ” ê²ƒ ìš°ì„ )
        if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
        if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
        // 2ì°¨: ì ìˆ˜ìˆœ
        return b._totalScore - a._totalScore;
      });
      
      // ===== Stage B-2: ìƒì„¸ ì¡°íšŒ (K1 = 30) =====
      let detailedResults = ranked.slice(0, topK);
      
      if (fetchDetails && detailedResults.length > 0) {
        onProgress?.(9, 10, 'ìƒì„¸ ì •ë³´ ì¡°íšŒ ì¤‘...');
        detailedResults = await TM.fetchDetailsForTopK(detailedResults, topK);
        
        // â˜… ìƒì„¸ ì •ë³´ë¡œ ìœ ì‚¬êµ° êµì§‘í•© ìž¬ê³„ì‚° (í•µì‹¬!)
        for (const r of detailedResults) {
          if (r.similarityGroup) {
            // ìœ ì‚¬êµ° êµì§‘í•© ìž¬ì²´í¬
            const groupOverlap = TM.checkSimilarGroupOverlap(targetGroups, r.similarityGroup);
            r._groupOverlap = groupOverlap;
            r._hasGroupOverlap = groupOverlap.hasOverlap;
            r._overlappingGroups = groupOverlap.overlappingGroups || [];
            
            // ìœ ì‚¬êµ° êµì§‘í•© ì—¬ë¶€ì— ë”°ë¼ ì ìˆ˜ ìž¬ê³„ì‚°
            if (!r._hasGroupOverlap && groupOverlap.overlapType !== 'unknown') {
              // ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ â†’ Safe
              r._totalScore = 0;
              r._riskLevel = 'safe';
              r._riskReason = 'ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ â†’ ë“±ë¡ ê°€ëŠ¥';
              r._isHighRisk = false;
            } else {
              // ìœ ì‚¬êµ° ì¤‘ë³µ â†’ ìƒí‘œ ìœ ì‚¬ë„ë¡œ íŒë‹¨
              r._totalScore = (r._scoreText * 0.45) + (r._scoreVienna * 0.30) + (r._scoreStatus * 0.25);
              if (r._isIntersection) r._totalScore = Math.min(r._totalScore * 1.3, 1.0);
              
              const risk = TM.determineRiskLevel(true, r._scoreText, r._scoreStatus);
              r._riskLevel = risk.level;
              r._riskReason = risk.reason;
              r._isHighRisk = risk.isHighRisk;
              
              if (r._overlappingGroups.length > 0) {
                r._riskReason += ` [ì¤‘ë³µ: ${r._overlappingGroups.join(', ')}]`;
              }
            }
            
            r._scoreScope = TM.calculateScopeSimilarity(
              targetClasses, targetGroups,
              r.classificationCode, r.similarityGroup
            );
          }
        }
        
        // ìµœì¢… ìž¬ì •ë ¬ (ìœ ì‚¬êµ° ì¤‘ë³µ ìš°ì„ )
        detailedResults.sort((a, b) => {
          if (a._hasGroupOverlap && !b._hasGroupOverlap) return -1;
          if (!a._hasGroupOverlap && b._hasGroupOverlap) return 1;
          return b._totalScore - a._totalScore;
        });
      }
      
      // ===== ìµœì¢… ê²°ê³¼ í¬ë§·íŒ… (ìœ ì‚¬êµ° ê¸°ë°˜) =====
      onProgress?.(10, 10, 'ì™„ë£Œ');
      
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
        // â˜… ìœ ì‚¬êµ° ê¸°ë°˜ ë¦¬ìŠ¤í¬ ì •ë³´
        hasGroupOverlap: r._hasGroupOverlap,
        overlappingGroups: r._overlappingGroups || [],
        isHighRisk: r._isHighRisk || false,
        riskLevel: r._riskLevel || 'safe',
        riskReason: r._riskReason || TM.generateRiskReason(r, trademark, targetClasses, targetGroups)
      }));
      
      // í†µê³„ ë¡œê¹…
      const groupOverlapCount = results.filter(r => r.hasGroupOverlap).length;
      const highRiskCount = results.filter(r => r.isHighRisk).length;
      
      console.log('[KIPRIS] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
      console.log(`[KIPRIS] ìµœì¢… ê²°ê³¼: ${results.length}ê±´`);
      console.log(`[KIPRIS] ìœ ì‚¬êµ° ì¤‘ë³µ: ${groupOverlapCount}ê±´ (ì‹¤ì§ˆì  ì¶©ëŒ ê°€ëŠ¥)`);
      console.log(`[KIPRIS] ê³ ìœ„í—˜: ${highRiskCount}ê±´`);
      console.log(`[KIPRIS] ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ: ${results.length - groupOverlapCount}ê±´ (ë“±ë¡ ê°€ëŠ¥)`);
      console.log('[KIPRIS] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
      
      return results;
      
    } catch (error) {
      console.error('[KIPRIS] ê²€ìƒ‰ ì‹¤íŒ¨:', error);
      throw error;
    }
  };
  
  // ìœ„í—˜ ì‚¬ìœ  ìƒì„± (ìœ ì‚¬êµ° ì¤‘ì‹¬ - ìƒí‘œì‹¬ì‚¬ ì›ì¹™ ë°˜ì˜)
  TM.generateRiskReason = function(result, sourceMark, targetClasses, targetGroups) {
    // â˜… í•µì‹¬: ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ê°€ ê°€ìž¥ ì¤‘ìš”
    if (!result._hasGroupOverlap && result._groupOverlap?.overlapType !== 'unknown') {
      return 'âœ… ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ â†’ ë“±ë¡ ê°€ëŠ¥';
    }
    
    const reasons = [];
    
    // ìœ ì‚¬êµ° ì¤‘ë³µ ì •ë³´
    if (result._overlappingGroups && result._overlappingGroups.length > 0) {
      reasons.push(`âš ï¸ ìœ ì‚¬êµ° ì¤‘ë³µ: ${result._overlappingGroups.slice(0, 3).join(', ')}${result._overlappingGroups.length > 3 ? ' ì™¸' : ''}`);
    } else if (result._hasGroupOverlap) {
      reasons.push('âš ï¸ ìœ ì‚¬êµ° ì¤‘ë³µ');
    }
    
    // ë¬¸ìž ìœ ì‚¬ë„ (ìœ ì‚¬êµ° ì¤‘ë³µì´ ìžˆëŠ” ê²½ìš°ì—ë§Œ ì˜ë¯¸ìžˆìŒ)
    if (result._scoreText >= 0.85) {
      reasons.push('ìƒí‘œëª… ë§¤ìš° ìœ ì‚¬ (ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ)');
    } else if (result._scoreText >= 0.70) {
      reasons.push('ìƒí‘œëª… ìœ ì‚¬ (ì£¼ì˜ í•„ìš”)');
    } else if (result._scoreText >= 0.50) {
      reasons.push('ìƒí‘œëª… ë‹¤ì†Œ ìœ ì‚¬');
    }
    
    // ë„í˜• ìœ ì‚¬
    if (result._scoreVienna >= 0.7) {
      reasons.push('ë„í˜• ìœ ì‚¬');
    }
    
    // ìƒíƒœ
    if (result.applicationStatus?.includes('ë“±ë¡')) {
      reasons.push('ë“±ë¡ìƒí‘œ');
    } else if (result.applicationStatus?.includes('ì¶œì›')) {
      reasons.push('ì¶œì›ì¤‘');
    }
    
    if (reasons.length === 0) {
      return result._riskLevel === 'safe' ? 'ë“±ë¡ ê°€ëŠ¥' : 'ì‹¬ì‚¬ê´€ íŒë‹¨ í•„ìš”';
    }
    
    return reasons.join(' Â· ');
  };
  
  // ====== ë ˆê±°ì‹œ í˜¸í™˜ í•¨ìˆ˜ ======
  
  TM.callKiprisSearch = async function(type, params) {
    console.log('[KIPRIS] ë ˆê±°ì‹œ í˜¸ì¶œ:', type, params);
    
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
    
    // í´ë°±: ì§ì ‘ API í˜¸ì¶œ
    return TM.callKiprisAPI(type, params);
  };
  
  // ì‹œë®¬ë ˆì´ì…˜ ë°ì´í„° (API ì‹¤íŒ¨ ì‹œ)
  TM.simulateSearchResults = function(type, params) {
    const keyword = params.trademarkName || params.viennaCode || 'í…ŒìŠ¤íŠ¸';
    
    return [
      {
        applicationNumber: '40-2024-0001234',
        applicationDate: '2024-01-15',
        registrationNumber: '40-1234567',
        title: keyword + ' (ìœ ì‚¬ìƒí‘œ1)',
        applicationStatus: 'ë“±ë¡',
        classificationCode: '09, 42',
        viennaCode: '26.04.01',
        applicantName: 'í…ŒìŠ¤íŠ¸íšŒì‚¬',
        drawing: null,
        similarityScore: 85,
        isHighRisk: true
      },
      {
        applicationNumber: '40-2024-0005678',
        applicationDate: '2024-03-20',
        title: keyword + 'Plus',
        applicationStatus: 'ì¶œì›',
        classificationCode: '09',
        viennaCode: '26.04.02',
        applicantName: 'ì˜ˆì‹œê¸°ì—…',
        drawing: null,
        similarityScore: 72,
        isHighRisk: false
      },
      {
        applicationNumber: '40-2023-0098765',
        applicationDate: '2023-11-10',
        registrationNumber: '40-9876543',
        title: 'ìŠˆí¼' + keyword,
        applicationStatus: 'ë“±ë¡',
        classificationCode: '35, 42',
        viennaCode: '26.04.01',
        applicantName: '(ì£¼)ë§ˆì¼€íŒ…',
        drawing: null,
        similarityScore: 65,
        isHighRisk: false
      }
    ];
  };

  // ============================================================
  // Step 4: ìœ ì‚¬ë„ í‰ê°€
  // ============================================================
  
  TM.renderStep4_Similarity = function(container) {
    const p = TM.currentProject;
    const evaluations = p.similarityEvaluations || [];
    const allSearchResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 10);
    
    // KIPRIS API í‚¤ í™•ì¸
    const apiKey = TM.kiprisConfig?.apiKey || '';
    const defaultKey = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    const hasCustomApiKey = apiKey && apiKey !== defaultKey;
    
    const apiKeyWarning = !hasCustomApiKey ? `
      <div class="tm-api-warning" style="margin-bottom: 20px; padding: 16px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px;">âš ï¸</span>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e;">KIPRIS API í‚¤ê°€ ì„¤ì •ë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤</h4>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #a16207; line-height: 1.5;">
              ì„ í–‰ìƒí‘œ ê²€ìƒ‰ì„ ìœ„í•´ ê°œì¸ API í‚¤ê°€ í•„ìš”í•©ë‹ˆë‹¤. ê¸°ë³¸ í‚¤ëŠ” í˜¸ì¶œ ì œí•œì— ê±¸ë¦´ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.
            </p>
            <div style="display: flex; gap: 12px; align-items: center;">
              <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank" 
                 style="font-size: 12px; color: #d97706; text-decoration: underline;">
                ðŸ‘‰ KIPRIS Plusì—ì„œ ë¬´ë£Œ API í‚¤ ë°œê¸‰ë°›ê¸°
              </a>
              <button class="btn btn-sm" onclick="openProfileSettings()" 
                      style="padding: 4px 12px; font-size: 12px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ì„¤ì •ì—ì„œ ìž…ë ¥
              </button>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <div class="tm-api-ok" style="margin-bottom: 16px; padding: 10px 16px; background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
        <span>âœ…</span>
        <span style="font-size: 13px; color: #166534;">KIPRIS API í‚¤ ì„¤ì •ë¨</span>
      </div>
    `;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>âš–ï¸ ìœ ì‚¬ë„ í‰ê°€</h3>
      </div>
      
      ${apiKeyWarning}
      
      ${allSearchResults.length === 0 ? `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon">ðŸ”</div>
          <h4>ì„ í–‰ìƒí‘œ ê²€ìƒ‰ì´ í•„ìš”í•©ë‹ˆë‹¤</h4>
          <p>ë¨¼ì € ì„ í–‰ìƒí‘œ ê²€ìƒ‰ì„ ì‹¤í–‰í•œ í›„ ìœ ì‚¬ë„ë¥¼ í‰ê°€í•˜ì„¸ìš”.</p>
          <button class="btn btn-primary" data-action="tm-goto-step" data-step="3">
            ì„ í–‰ìƒí‘œ ê²€ìƒ‰ â†’
          </button>
        </div>
      ` : `
        <!-- AI í‰ê°€ ì»¨íŠ¸ë¡¤ -->
        <div class="tm-eval-control-panel">
          <div class="tm-eval-control-left">
            <button class="btn btn-primary btn-lg" id="tm-eval-all-btn" data-action="tm-evaluate-all-similarity">
              ðŸ¤– ì „ì²´ AI í‰ê°€ ì‹¤í–‰
            </button>
            <p class="tm-eval-hint">ì„ í–‰ìƒí‘œ ${allSearchResults.length}ê±´ì— ëŒ€í•´ ì™¸ê´€Â·í˜¸ì¹­Â·ê´€ë… ìœ ì‚¬ë„ë¥¼ AIê°€ ì¼ê´„ ë¶„ì„í•©ë‹ˆë‹¤.</p>
          </div>
          <div class="tm-eval-progress-wrap" id="tm-eval-progress" style="display: none;">
            <div class="tm-progress-bar">
              <div class="tm-progress-fill" id="tm-progress-fill"></div>
            </div>
            <div class="tm-progress-text" id="tm-progress-text">0 / ${allSearchResults.length}</div>
          </div>
        </div>
        
        <!-- ì„ í–‰ìƒí‘œ ê·¸ë¦¬ë“œ -->
        <div class="tm-eval-grid">
          ${allSearchResults.map((r, idx) => {
            const evaluated = evaluations.find(e => e.targetId === r.applicationNumber);
            return `
              <div class="tm-eval-card-mini ${evaluated ? 'evaluated ' + evaluated.overall : ''}">
                <div class="tm-eval-card-num">${idx + 1}</div>
                <div class="tm-eval-card-content">
                  <div class="tm-eval-card-name">${TM.escapeHtml(r.title || r.trademarkName || '(ëª…ì¹­ì—†ìŒ)')}</div>
                  <div class="tm-eval-card-appno">${r.applicationNumber}</div>
                  ${evaluated ? `
                    <div class="tm-eval-scores-mini">
                      <span class="tm-score-mini ${evaluated.appearance}">ì™¸ê´€</span>
                      <span class="tm-score-mini ${evaluated.pronunciation}">í˜¸ì¹­</span>
                      <span class="tm-score-mini ${evaluated.concept}">ê´€ë…</span>
                    </div>
                  ` : ''}
                </div>
                <div class="tm-eval-card-status">
                  ${evaluated ? `
                    <span class="tm-eval-result-badge ${evaluated.overall}">
                      ${evaluated.overall === 'high' ? 'ìœ ì‚¬' : evaluated.overall === 'medium' ? 'ì£¼ì˜' : 'ë¹„ìœ ì‚¬'}
                    </span>
                  ` : `
                    <button class="btn btn-sm btn-outline" 
                            data-action="tm-evaluate-similarity" 
                            data-target-id="${r.applicationNumber}">í‰ê°€</button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- í‰ê°€ ê²°ê³¼ ìƒì„¸ (ì•„ì½”ë””ì–¸) -->
        ${evaluations.length > 0 ? `
          <div class="tm-eval-detail-section">
            <h4>ðŸ“Š í‰ê°€ ê²°ê³¼ ìƒì„¸ <span class="tm-badge">${evaluations.length}ê±´</span></h4>
            <div class="tm-eval-details-list">
              ${evaluations.map(e => `
                <details class="tm-eval-detail-item ${e.overall}">
                  <summary>
                    <span class="tm-eval-detail-name">${TM.escapeHtml(e.targetName || e.targetId)}</span>
                    <span class="tm-eval-detail-badge ${e.overall}">
                      ${e.overall === 'high' ? 'ë†’ìŒ (ìœ ì‚¬)' : e.overall === 'medium' ? 'ì¤‘ê°„ (ì£¼ì˜)' : 'ë‚®ìŒ (ë¹„ìœ ì‚¬)'}
                    </span>
                  </summary>
                  <div class="tm-eval-detail-content">
                    <div class="tm-eval-scores-row">
                      <div class="tm-eval-score-box ${e.appearance}">
                        <div class="score-label">ì™¸ê´€</div>
                        <div class="score-value">${e.appearance === 'high' ? 'ìœ ì‚¬' : e.appearance === 'medium' ? 'ë³´í†µ' : 'ìƒì´'}</div>
                      </div>
                      <div class="tm-eval-score-box ${e.pronunciation}">
                        <div class="score-label">í˜¸ì¹­</div>
                        <div class="score-value">${e.pronunciation === 'high' ? 'ìœ ì‚¬' : e.pronunciation === 'medium' ? 'ë³´í†µ' : 'ìƒì´'}</div>
                      </div>
                      <div class="tm-eval-score-box ${e.concept}">
                        <div class="score-label">ê´€ë…</div>
                        <div class="score-value">${e.concept === 'high' ? 'ìœ ì‚¬' : e.concept === 'medium' ? 'ë³´í†µ' : 'ìƒì´'}</div>
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
      high: 'ë†’ìŒ (ìœ ì‚¬)',
      medium: 'ì¤‘ê°„ (ì£¼ì˜)',
      low: 'ë‚®ìŒ (ë¹„ìœ ì‚¬)'
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
            <div class="tm-score-label">ì™¸ê´€</div>
            <div class="tm-score-value ${evaluation.appearance}">${TM.getSimilarityLabel(evaluation.appearance)}</div>
          </div>
          <div class="tm-eval-score-item">
            <div class="tm-score-label">í˜¸ì¹­</div>
            <div class="tm-score-value ${evaluation.pronunciation}">${TM.getSimilarityLabel(evaluation.pronunciation)}</div>
          </div>
          <div class="tm-eval-score-item">
            <div class="tm-score-label">ê´€ë…</div>
            <div class="tm-score-value ${evaluation.concept}">${TM.getSimilarityLabel(evaluation.concept)}</div>
          </div>
        </div>
        
        ${evaluation.notes ? `
          <div class="tm-eval-notes-box">
            <div class="tm-notes-title">ðŸ’¡ í‰ê°€ ê·¼ê±°</div>
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
      App.showToast('í‰ê°€ ëŒ€ìƒì„ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.', 'error');
      return;
    }
    
    try {
      App.showToast('AI ìœ ì‚¬ë„ í‰ê°€ ì¤‘...', 'info');
      
      const prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ìœ ì‚¬ë„ í‰ê°€ ì „ë¬¸ê°€ìž…ë‹ˆë‹¤. ë‹¤ìŒ ë‘ ìƒí‘œì˜ ìœ ì‚¬ë„ë¥¼ í‰ê°€í•˜ì„¸ìš”.

[ì¶œì› ìƒí‘œ]
- ëª…ì¹­: ${p.trademarkName}
- ì˜ë¬¸: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}

[ì„ í–‰ ìƒí‘œ]
- ëª…ì¹­: ${target.title || target.trademarkName}
- ì¶œì›ë²ˆí˜¸: ${target.applicationNumber}
- ìƒíƒœ: ${target.applicationStatus}
- ì§€ì •ìƒí’ˆë¥˜: ${target.classificationCode || 'ë¯¸ìƒ'}

ë‹¤ìŒ í•­ëª©ì„ í‰ê°€í•˜ê³  JSON í˜•ì‹ìœ¼ë¡œ ì‘ë‹µí•˜ì„¸ìš”:

1. ì™¸ê´€ ìœ ì‚¬ë„ (appearance): ì‹œê°ì  ìœ ì‚¬ì„±
2. í˜¸ì¹­ ìœ ì‚¬ë„ (pronunciation): ë°œìŒì˜ ìœ ì‚¬ì„±
3. ê´€ë… ìœ ì‚¬ë„ (concept): ì˜ë¯¸ì  ìœ ì‚¬ì„±
4. ì¢…í•© íŒë‹¨ (overall): ì „ì²´ì ì¸ ìœ ì‚¬ ì—¬ë¶€

ê° í•­ëª©ì€ "high" (ìœ ì‚¬), "medium" (ì£¼ì˜ í•„ìš”), "low" (ë¹„ìœ ì‚¬) ì¤‘ í•˜ë‚˜ë¡œ í‰ê°€í•˜ì„¸ìš”.
ë˜í•œ í‰ê°€ ê·¼ê±°ë¥¼ ê°„ëžµížˆ ìž‘ì„±í•˜ì„¸ìš”.

ì‘ë‹µ í˜•ì‹:
{
  "appearance": "high|medium|low",
  "pronunciation": "high|medium|low", 
  "concept": "high|medium|low",
  "overall": "high|medium|low",
  "notes": "í‰ê°€ ê·¼ê±° ì„¤ëª…"
}`;

      const response = await App.callClaude(prompt, 1000);
      
      // JSON íŒŒì‹±
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI ì‘ë‹µì„ íŒŒì‹±í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.');
      }
      
      const evaluation = JSON.parse(jsonMatch[0]);
      evaluation.targetId = targetId;
      evaluation.targetName = target.title || target.trademarkName;
      evaluation.evaluatedAt = new Date().toISOString();
      
      // ê¸°ì¡´ í‰ê°€ ì—…ë°ì´íŠ¸ ë˜ëŠ” ì¶”ê°€
      const existingIndex = p.similarityEvaluations.findIndex(e => e.targetId === targetId);
      if (existingIndex >= 0) {
        p.similarityEvaluations[existingIndex] = evaluation;
      } else {
        p.similarityEvaluations.push(evaluation);
      }
      
      TM.renderCurrentStep();
      // ê°œë³„ í‰ê°€ ì‹œ í† ìŠ¤íŠ¸ ì œê±° (ì „ì²´ í‰ê°€ì—ì„œ ì¤‘ë³µ ë°©ì§€)
      
    } catch (error) {
      console.error('[TM] ìœ ì‚¬ë„ í‰ê°€ ì‹¤íŒ¨:', error);
      App.showToast('í‰ê°€ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  TM.evaluateAllSimilarity = async function() {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])].slice(0, 10);
    
    if (allResults.length === 0) {
      App.showToast('í‰ê°€í•  ì„ í–‰ìƒí‘œê°€ ì—†ìŠµë‹ˆë‹¤.', 'warning');
      return;
    }
    
    // UI ì—…ë°ì´íŠ¸ - í”„ë¡œê·¸ë ˆìŠ¤ ë°” í‘œì‹œ
    const btn = document.getElementById('tm-eval-all-btn');
    const progressEl = document.getElementById('tm-eval-progress');
    const progressFill = document.getElementById('tm-progress-fill');
    const progressText = document.getElementById('tm-progress-text');
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'â³ í‰ê°€ ì¤‘...';
    }
    if (progressEl) progressEl.style.display = 'flex';
    
    let completed = 0;
    const total = allResults.length;
    
    for (const target of allResults) {
      try {
        await TM.evaluateSimilarityQuiet(target.applicationNumber);
        completed++;
        
        // í”„ë¡œê·¸ë ˆìŠ¤ ì—…ë°ì´íŠ¸
        if (progressFill) progressFill.style.width = `${(completed / total) * 100}%`;
        if (progressText) progressText.textContent = `${completed} / ${total}`;
        
      } catch (error) {
        console.error('[TM] ê°œë³„ í‰ê°€ ì‹¤íŒ¨:', error);
      }
      // Rate limit ë°©ì§€
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // ì™„ë£Œ
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'ðŸ¤– ì „ì²´ AI í‰ê°€ ì‹¤í–‰';
    }
    if (progressEl) progressEl.style.display = 'none';
    
    TM.renderCurrentStep();
    App.showToast(`ì „ì²´ ${completed}ê±´ ìœ ì‚¬ë„ í‰ê°€ ì™„ë£Œ!`, 'success');
  };
  
  // í† ìŠ¤íŠ¸ ì—†ì´ ì¡°ìš©ížˆ í‰ê°€í•˜ëŠ” ë²„ì „
  TM.evaluateSimilarityQuiet = async function(targetId) {
    const p = TM.currentProject;
    const allResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])];
    const target = allResults.find(r => r.applicationNumber === targetId);
    
    if (!target) return;
    
    const prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ìœ ì‚¬ë„ í‰ê°€ ì „ë¬¸ê°€ìž…ë‹ˆë‹¤. ë‹¤ìŒ ë‘ ìƒí‘œì˜ ìœ ì‚¬ë„ë¥¼ í‰ê°€í•˜ì„¸ìš”.

[ì¶œì›ìƒí‘œ]
- ìƒí‘œëª…: ${p.trademarkName}
- ì˜ë¬¸ëª…: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìƒí‘œìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}

[ì„ í–‰ìƒí‘œ]
- ìƒí‘œëª…: ${target.title || target.trademarkName || ''}
- ì¶œì›ë²ˆí˜¸: ${target.applicationNumber}
- ìƒíƒœ: ${target.applicationStatus || ''}

ë‹¤ìŒ 3ê°€ì§€ ê¸°ì¤€ìœ¼ë¡œ í‰ê°€í•˜ê³  JSON í˜•ì‹ìœ¼ë¡œ ì‘ë‹µí•˜ì„¸ìš”:

1. appearance (ì™¸ê´€ ìœ ì‚¬ë„): ì‹œê°ì  êµ¬ì„±ìš”ì†Œ ë¹„êµ
2. pronunciation (í˜¸ì¹­ ìœ ì‚¬ë„): ë°œìŒì˜ ìœ ì‚¬ì„±
3. concept (ê´€ë… ìœ ì‚¬ë„): ì˜ë¯¸, ê°œë…ì˜ ìœ ì‚¬ì„±

ê° í•­ëª©ì€ "high" (ìœ ì‚¬), "medium" (ì£¼ì˜), "low" (ë¹„ìœ ì‚¬) ì¤‘ í•˜ë‚˜ë¡œ í‰ê°€.
overallì€ ì¢…í•© íŒë‹¨ ê²°ê³¼.
notesëŠ” í‰ê°€ ê·¼ê±°ë¥¼ 3-4ë¬¸ìž¥ìœ¼ë¡œ ì„œìˆ .

ì‘ë‹µ í˜•ì‹:
{
  "appearance": "high",
  "pronunciation": "high",
  "concept": "high",
  "overall": "high",
  "notes": "ì™¸ê´€: ... í˜¸ì¹­: ... ê´€ë…: ... ì¢…í•©íŒë‹¨: ..."
}`;

    const response = await App.callClaude(prompt, 1000);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI ì‘ë‹µ íŒŒì‹± ì‹¤íŒ¨');
    
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
   ìƒí‘œì¶œì› ìš°ì„ ì‹¬ì‚¬ ìžë™í™” ì‹œìŠ¤í…œ - Step ë Œë”ë§ (Part 3)
   Step 5~8: ë¦¬ìŠ¤í¬í‰ê°€, ë¹„ìš©ì‚°ì¶œ, ìš°ì„ ì‹¬ì‚¬, ë¬¸ì„œì¶œë ¥
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM Steps 5-8] TM ëª¨ë“ˆì´ ë¡œë“œë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.');
    return;
  }

  // ============================================================
  // Step 5: ë¦¬ìŠ¤í¬ í‰ê°€
  // ============================================================
  
  TM.renderStep5_Risk = function(container) {
    const p = TM.currentProject;
    const risk = p.riskAssessment || {};
    const fee = p.feeCalculation || {};
    
    // ë¹„ìš© ìžë™ ê³„ì‚°
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    // KIPRIS API í‚¤ í™•ì¸
    const apiKey = TM.kiprisConfig?.apiKey || '';
    const defaultKey = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
    const hasCustomApiKey = apiKey && apiKey !== defaultKey;
    
    const apiKeyWarning = !hasCustomApiKey ? `
      <div class="tm-api-warning" style="margin-bottom: 20px; padding: 16px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px;">âš ï¸</span>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e;">KIPRIS API í‚¤ê°€ ì„¤ì •ë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤</h4>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #a16207; line-height: 1.5;">
              ì •í™•í•œ ë¦¬ìŠ¤í¬ í‰ê°€ë¥¼ ìœ„í•´ ê°œì¸ API í‚¤ê°€ í•„ìš”í•©ë‹ˆë‹¤. ê¸°ë³¸ í‚¤ëŠ” í˜¸ì¶œ ì œí•œì— ê±¸ë¦´ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.
            </p>
            <div style="display: flex; gap: 12px; align-items: center;">
              <a href="https://plus.kipris.or.kr/portal/main.do" target="_blank" 
                 style="font-size: 12px; color: #d97706; text-decoration: underline;">
                ðŸ‘‰ KIPRIS Plusì—ì„œ ë¬´ë£Œ API í‚¤ ë°œê¸‰ë°›ê¸°
              </a>
              <button class="btn btn-onclick="openProfileSettings()"s()" 
                      style="padding: 4px 12px; font-size: 12px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ì„¤ì •ì—ì„œ ìž…ë ¥
              </button>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <div class="tm-api-ok" style="margin-bottom: 16px; padding: 10px 16px; background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
        <span>âœ…</span>
        <span style="font-size: 13px; color: #166534;">KIPRIS API í‚¤ ì„¤ì •ë¨</span>
      </div>
    `;
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>ðŸ“Š ë¦¬ìŠ¤í¬ í‰ê°€</h3>
      </div>
      
      ${apiKeyWarning}
      
      <!-- AI í‰ê°€ ë²„íŠ¼ -->
      <div class="tm-risk-action-panel">
        <button class="btn btn-primary btn-lg" id="tm-risk-btn" data-action="tm-assess-risk">
          ðŸ¤– AI ë¦¬ìŠ¤í¬ ì¢…í•© í‰ê°€
        </button>
        <div class="tm-risk-progress" id="tm-risk-progress" style="display: none;">
          <div class="tm-progress-bar">
            <div class="tm-progress-fill tm-progress-indeterminate"></div>
          </div>
          <span class="tm-progress-text">AIê°€ ì¢…í•© ë¶„ì„ ì¤‘ìž…ë‹ˆë‹¤...</span>
        </div>
      </div>
      
      ${risk.level ? `
        <!-- ë¦¬ìŠ¤í¬ ê²°ê³¼ ëŒ€ì‹œë³´ë“œ -->
        <div class="tm-risk-dashboard ${risk.level}">
          <!-- ë¦¬ìŠ¤í¬ ìˆ˜ì¤€ í‘œì‹œ -->
          <div class="tm-risk-level-display">
            <div class="tm-risk-icon">
              ${risk.level === 'high' ? 'âš ï¸' : risk.level === 'medium' ? 'âš¡' : 'âœ…'}
            </div>
            <div class="tm-risk-level-text">
              <div class="tm-risk-main-text">
                ${risk.level === 'high' ? 'ë†’ì€ ìœ„í—˜' : risk.level === 'medium' ? 'ì£¼ì˜ í•„ìš”' : 'ë‚®ì€ ìœ„í—˜'}
              </div>
              <div class="tm-risk-sub-text">ë“±ë¡ ê°€ëŠ¥ì„± ${TM.getRiskProbability(risk.level)}</div>
            </div>
          </div>
          
          <!-- í•µì‹¬ ì§€í‘œ -->
          <div class="tm-risk-metrics">
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${p.similarityEvaluations?.length || 0}</div>
              <div class="tm-metric-label">ê²€í†  ìƒí‘œ</div>
            </div>
            <div class="tm-risk-metric warning">
              <div class="tm-metric-value">${risk.conflictCount || 0}</div>
              <div class="tm-metric-label">ì¶©ëŒ ìš°ë ¤</div>
            </div>
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${p.designatedGoods?.length || 0}</div>
              <div class="tm-metric-label">ìƒí’ˆë¥˜</div>
            </div>
            <div class="tm-risk-metric">
              <div class="tm-metric-value">${TM.formatNumber(fee.totalFee || 0)}</div>
              <div class="tm-metric-label">ì˜ˆìƒ ë¹„ìš©(ì›)</div>
            </div>
          </div>
        </div>
        
        <!-- ìƒì„¸ ë¶„ì„ & ê¶Œê³ ì‚¬í•­ -->
        <div class="tm-risk-analysis">
          ${risk.details ? `
            <div class="tm-analysis-section">
              <h4>ðŸ“‹ ìƒì„¸ ë¶„ì„</h4>
              <div class="tm-analysis-content">${TM.formatRiskDetails(risk.details)}</div>
            </div>
          ` : ''}
          
          ${risk.recommendation ? `
            <div class="tm-analysis-section recommendation">
              <h4>ðŸ’¡ ê¶Œê³ ì‚¬í•­</h4>
              <div class="tm-analysis-content">${TM.formatRiskRecommendation(risk.recommendation)}</div>
            </div>
          ` : ''}
        </div>
        
        <!-- ë¹„ìš© ëª…ì„¸ (ì ‘íž˜) -->
        <details class="tm-fee-accordion" open>
          <summary>ðŸ’° ë¹„ìš© ëª…ì„¸</summary>
          <div class="tm-fee-content">
            <div class="tm-fee-list">
              ${TM.renderFeeBreakdown(fee)}
            </div>
          </div>
        </details>
      ` : `
        <div class="tm-empty-state" style="padding: 60px;">
          <div class="icon">ðŸ“Š</div>
          <h4>ë¦¬ìŠ¤í¬ í‰ê°€ë¥¼ ì‹¤í–‰í•˜ì„¸ìš”</h4>
          <p>ìœ ì‚¬ë„ í‰ê°€ ê²°ê³¼, ì§€ì •ìƒí’ˆ, ìƒí‘œ ìœ í˜• ë“±ì„ AIê°€ ì¢…í•© ë¶„ì„í•©ë‹ˆë‹¤.</p>
        </div>
      `}
      
      <!-- í‰ê°€ ê¸°ì¤€ -->
      <details class="tm-accordion">
        <summary>ðŸ“‹ í‰ê°€ ê¸°ì¤€ ì•ˆë‚´</summary>
        <div class="tm-accordion-content">
          <div class="tm-criteria-grid">
            <div class="tm-criteria-item high">
              <div class="tm-criteria-label">â›” ë†’ì€ ìœ„í—˜</div>
              <div class="tm-criteria-desc">ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬ â†’ ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ</div>
            </div>
            <div class="tm-criteria-item medium">
              <div class="tm-criteria-label">âš ï¸ ì¤‘ê°„ ìœ„í—˜</div>
              <div class="tm-criteria-desc">ìœ ì‚¬êµ° ì¤‘ë³µ, ìƒí‘œ ë‹¤ì†Œ ìœ ì‚¬ â†’ ì‹¬ì‚¬ê´€ íŒë‹¨</div>
            </div>
            <div class="tm-criteria-item low">
              <div class="tm-criteria-label">âœ… ë‚®ì€ ìœ„í—˜</div>
              <div class="tm-criteria-desc">ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ ë˜ëŠ” ìƒí‘œ ìƒì´ â†’ ë“±ë¡ ê°€ëŠ¥ì„± ë†’ìŒ</div>
            </div>
          </div>
        </div>
      </details>
    `;
  };
  
  // ë¦¬ìŠ¤í¬ ê¶Œê³ ì‚¬í•­ í¬ë§·íŒ…
  TM.formatRiskRecommendation = function(text) {
    if (!text) return '';
    // ë²ˆí˜¸ ë§¤ê¸°ê¸°ë‚˜ í•­ëª©ì„ í•˜ì´ë¼ì´íŠ¸
    return text
      .replace(/ì²«ì§¸,|ë‘˜ì§¸,|ì…‹ì§¸,|ë„·ì§¸,/g, '<strong>$&</strong>')
      .replace(/\n/g, '<br>');
  };
  
  TM.getRiskProbability = function(level) {
    const probs = {
      high: '30% ì´í•˜',
      medium: '50~70%',
      low: '80% ì´ìƒ'
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
      App.showToast('ìƒí‘œëª…ì„ ë¨¼ì € ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    // UI ì—…ë°ì´íŠ¸ - í”„ë¡œê·¸ë ˆìŠ¤ í‘œì‹œ
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
      // â˜… ìœ ì‚¬êµ° ê¸°ë°˜ í‰ê°€ ë°ì´í„° ìˆ˜ì§‘
      const searchResults = p.searchResults?.text || [];
      const totalSearched = searchResults.length;
      
      // ìœ ì‚¬êµ° ì¤‘ë³µ ìžˆëŠ” ìƒí‘œë§Œ ì¹´ìš´íŠ¸ (ì‹¤ì§ˆì  ì¶©ëŒ í›„ë³´)
      const groupOverlapResults = searchResults.filter(r => r.hasGroupOverlap);
      const noOverlapCount = searchResults.filter(r => !r.hasGroupOverlap).length;
      
      // ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬ë„ ë†’ì€ ê²ƒ = ê³ ìœ„í—˜
      const criticalResults = groupOverlapResults.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');
      const mediumResults = groupOverlapResults.filter(r => r.riskLevel === 'medium');
      const safeResults = groupOverlapResults.filter(r => r.riskLevel === 'low' || r.riskLevel === 'safe');
      
      // ìœ ì‚¬êµ° ëª©ë¡ ìˆ˜ì§‘
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
      
      const prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ë“±ë¡ ë¦¬ìŠ¤í¬ í‰ê°€ ì „ë¬¸ê°€ìž…ë‹ˆë‹¤. 
â˜… í•µì‹¬ ì›ì¹™: ìƒí‘œì˜ ìœ ì‚¬ ì—¬ë¶€ëŠ” "ë™ì¼ ìœ ì‚¬êµ° ì½”ë“œ" ë‚´ì—ì„œë§Œ íŒë‹¨ë©ë‹ˆë‹¤.
- ìœ ì‚¬êµ° ì¤‘ë³µ ì—†ìŒ â†’ ìƒí‘œëª…ì´ ë™ì¼í•´ë„ ë“±ë¡ ê°€ëŠ¥
- ìœ ì‚¬êµ° ì¤‘ë³µ ìžˆìŒ â†’ ìƒí‘œëª…/ë„í˜• ìœ ì‚¬ë„ì— ë”°ë¼ ê±°ì ˆ ê°€ëŠ¥ì„± íŒë‹¨

[ì¶œì› ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ì˜ë¬¸ëª…: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}
- ì§€ì •ìƒí’ˆë¥˜: ${p.designatedGoods?.map(g => 'ì œ' + g.classCode + 'ë¥˜').join(', ') || 'ë¯¸ì„ íƒ'}
- ì¶œì›ì¸ ìœ ì‚¬êµ°ì½”ë“œ: ${myGroups.slice(0, 10).join(', ') || 'ë¯¸í™•ì¸'}${myGroups.length > 10 ? ` ì™¸ ${myGroups.length - 10}ê°œ` : ''}

[ê²€ìƒ‰ ê²°ê³¼ ë¶„ì„ - ìœ ì‚¬êµ° ê¸°ì¤€]
- ì´ ê²€ìƒ‰ ê²°ê³¼: ${totalSearched}ê±´
- âœ… ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ (ë“±ë¡ ê°€ëŠ¥): ${noOverlapCount}ê±´
- âš ï¸ ìœ ì‚¬êµ° ì¤‘ë³µ (ì¶©ëŒ ê²€í†  í•„ìš”): ${groupOverlapResults.length}ê±´
  - â›” ê³ ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬): ${criticalResults.length}ê±´
  - âš ï¸ ì¤‘ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ë‹¤ì†Œ ìœ ì‚¬): ${mediumResults.length}ê±´
  - ðŸ”¶ ì €ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìƒì´): ${safeResults.length}ê±´

[ê³ ìœ„í—˜ ìƒí‘œ ìƒì„¸]
${criticalResults.slice(0, 5).map(r => 
  `- ${r.title || r.trademarkName}: ${r.applicationStatus || '-'} / ë¬¸ìžìœ ì‚¬ë„ ${r.scoreBreakdown?.text || 0}% / ì¤‘ë³µìœ ì‚¬êµ°: ${(r.overlappingGroups || []).join(', ') || 'ë¯¸í™•ì¸'}`
).join('\n') || 'ì—†ìŒ'}

ë‹¤ìŒ í•­ëª©ì„ ë¶„ì„í•˜ê³  JSON í˜•ì‹ìœ¼ë¡œ ì‘ë‹µí•˜ì„¸ìš”:

1. level: ì „ì²´ ë¦¬ìŠ¤í¬ ìˆ˜ì¤€ 
   - "high": ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬í•œ ë“±ë¡ìƒí‘œ ìžˆìŒ â†’ ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ
   - "medium": ìœ ì‚¬êµ° ì¤‘ë³µì€ ìžˆìœ¼ë‚˜ ìƒí‘œ ì°¨ë³„ì„± ìžˆìŒ â†’ ì‹¬ì‚¬ê´€ íŒë‹¨ í•„ìš”
   - "low": ìœ ì‚¬êµ° ì¤‘ë³µ ì—†ìŒ ë˜ëŠ” ìƒí‘œ ëª…í™•ížˆ ìƒì´ â†’ ë“±ë¡ ê°€ëŠ¥ì„± ë†’ìŒ
2. conflictCount: ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬í•œ ì‹¤ì§ˆì  ì¶©ëŒ ìƒí‘œ ìˆ˜
3. details: ìƒì„¸ ë¶„ì„ (ìœ ì‚¬êµ° ì¤‘ë³µ ì—¬ë¶€ë¥¼ í•µì‹¬ìœ¼ë¡œ ì„¤ëª…)
4. recommendation: ì¶œì›ì¸ ê¶Œê³ ì‚¬í•­

ì‘ë‹µ í˜•ì‹:
{
  "level": "high|medium|low",
  "conflictCount": 0,
  "details": "ìƒì„¸ ë¶„ì„ ë‚´ìš©...",
  "recommendation": "ê¶Œê³ ì‚¬í•­..."
}`;

      const response = await App.callClaude(prompt, 1500);
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI ì‘ë‹µì„ íŒŒì‹±í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.');
      }
      
      const assessment = JSON.parse(jsonMatch[0]);
      assessment.assessedAt = new Date().toISOString();
      
      p.riskAssessment = assessment;
      
      // í”„ë¡œì íŠ¸ ìƒíƒœ ì—…ë°ì´íŠ¸
      if (assessment.level === 'low') {
        p.status = 'documenting';
      }
      
      TM.renderCurrentStep();
      App.showToast('ë¦¬ìŠ¤í¬ í‰ê°€ê°€ ì™„ë£Œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] ë¦¬ìŠ¤í¬ í‰ê°€ ì‹¤íŒ¨:', error);
      App.showToast('í‰ê°€ ì‹¤íŒ¨: ' + error.message, 'error');
      
      // UI ë³µêµ¬
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
  // Step 6: ë¹„ìš© ì‚°ì¶œ
  // ============================================================
  
  TM.renderStep6_Fee = function(container) {
    const p = TM.currentProject;
    const fee = p.feeCalculation || {};
    
    // ìžë™ ê³„ì‚°
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>ðŸ’° ë¹„ìš© ì‚°ì¶œ</h3>
        <p>2026ë…„ ê¸°ì¤€ ê´€ë‚©ë£Œ ë° ì˜ˆìƒ ë¹„ìš©ì„ ê³„ì‚°í•©ë‹ˆë‹¤. (ìƒí‘œ ì¶œì›ë£ŒëŠ” ê°ë©´ ì—†ìŒ)</p>
      </div>
      
      <!-- ìš°ì„ ì‹¬ì‚¬ ì—¬ë¶€ -->
      <div class="tm-form-section">
        <label class="tm-checkbox-label">
          <input type="checkbox" id="tm-priority-exam-enabled" 
                 ${p.priorityExam?.enabled ? 'checked' : ''}
                 onchange="TM.togglePriorityExam(this.checked)">
          <span>ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ (ë¥˜ë‹¹ 160,000ì› ì¶”ê°€)</span>
        </label>
      </div>
      
      <!-- ë¹„ìš© ëª…ì„¸ -->
      <div class="tm-fee-section">
        <div class="tm-fee-header">
          <h4>ë¹„ìš© ëª…ì„¸</h4>
          <div class="tm-fee-total">${TM.formatNumber(fee.totalFee || 0)}ì›</div>
        </div>
        
        <div class="tm-fee-breakdown">
          ${TM.renderFeeBreakdown(fee)}
        </div>
      </div>
      
      <!-- ë¹„ìš© í…Œì´ë¸” ì°¸ê³  -->
      <details class="tm-accordion">
        <summary>
          <span>ðŸ“‹ 2026ë…„ ê´€ë‚©ë£Œ ê¸°ì¤€í‘œ</span>
        </summary>
        <div class="tm-accordion-content">
          <table class="tm-info-table">
            <tr><th>í•­ëª©</th><th>ê¸ˆì•¡</th><th>ë¹„ê³ </th></tr>
            <tr><td>ì¶œì›ë£Œ (ì „ìž+ê³ ì‹œëª…ì¹­)</td><td>46,000ì›/ë¥˜</td><td>ê¸°ë³¸</td></tr>
            <tr><td>ì¶œì›ë£Œ (ì „ìž+ë¹„ê³ ì‹œëª…ì¹­)</td><td>52,000ì›/ë¥˜</td><td>+6,000ì›</td></tr>
            <tr><td>ì„œë©´ ì¶œì› ê°€ì‚°</td><td>10,000ì›</td><td>ì „ìžì¶œì› ê¶Œìž¥</td></tr>
            <tr><td>ì§€ì •ìƒí’ˆ ê°€ì‚°ë£Œ</td><td>2,000ì›/ê°œ</td><td>ë¥˜ë‹¹ 10ê°œ ì´ˆê³¼ì‹œ</td></tr>
            <tr><td>ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ë£Œ</td><td>160,000ì›/ë¥˜</td><td>-</td></tr>
            <tr><td>ë“±ë¡ë£Œ (10ë…„)</td><td>211,000ì›/ë¥˜</td><td>ì°¸ê³ </td></tr>
          </table>
          <p style="margin-top: 12px; font-size: 13px; color: #6b7684;">â€» ìƒí‘œ ì¶œì›ë£ŒëŠ” íŠ¹í—ˆì™€ ë‹¬ë¦¬ ê°ë©´ ì œë„ê°€ ì—†ìŠµë‹ˆë‹¤.</p>
        </div>
      </details>
    `;
  };
  
  TM.renderFeeBreakdown = function(fee) {
    if (!fee || !fee.breakdown || fee.breakdown.length === 0) {
      return '<div class="tm-hint">ì§€ì •ìƒí’ˆì„ ì„ íƒí•˜ë©´ ë¹„ìš©ì´ ìžë™ ê³„ì‚°ë©ë‹ˆë‹¤.</div>';
    }
    
    return fee.breakdown.map(item => `
      <div class="tm-fee-row ${item.type === 'reduction' ? 'reduction' : ''} ${item.type === 'total' ? 'total' : ''}">
        <span class="tm-fee-label">${TM.escapeHtml(item.label)}</span>
        <span class="tm-fee-amount">${item.type === 'reduction' ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}ì›</span>
      </div>
    `).join('');
  };
  
  TM.calculateFee = function() {
    const p = TM.currentProject;
    if (!p) return;
    
    let breakdown = [];
    let subtotal = 0;
    
    // ë¥˜ë³„ ì¶œì›ë£Œ ê³„ì‚°
    if (p.designatedGoods && p.designatedGoods.length > 0) {
      p.designatedGoods.forEach(classData => {
        const hasNonGazetted = classData.goods.some(g => !g.gazetted);
        const baseFee = hasNonGazetted ? TM.feeTable.applicationNonGazetted : TM.feeTable.applicationGazetted;
        
        breakdown.push({
          label: `ì œ${classData.classCode}ë¥˜ ì¶œì›ë£Œ ${hasNonGazetted ? '(ë¹„ê³ ì‹œ)' : '(ê³ ì‹œ)'}`,
          amount: baseFee,
          type: 'application'
        });
        subtotal += baseFee;
        
        // ì§€ì •ìƒí’ˆ ê°€ì‚°ë£Œ (10ê°œ ì´ˆê³¼)
        if (classData.goods.length > 10) {
          const excessCount = classData.goods.length - 10;
          const excessFee = excessCount * TM.feeTable.excessGoods;
          breakdown.push({
            label: `  â”” ì œ${classData.classCode}ë¥˜ ì´ˆê³¼ìƒí’ˆ ${excessCount}ê°œ`,
            amount: excessFee,
            type: 'excess'
          });
          subtotal += excessFee;
        }
      });
    }
    
    // ìš°ì„ ì‹¬ì‚¬ ë¹„ìš©
    let priorityExamFee = 0;
    if (p.priorityExam?.enabled && p.designatedGoods) {
      priorityExamFee = p.designatedGoods.length * TM.feeTable.priorityExam;
      breakdown.push({
        label: `ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ë£Œ (${p.designatedGoods.length}ë¥˜)`,
        amount: priorityExamFee,
        type: 'priority'
      });
    }
    
    // ì´ì•¡ (ìƒí‘œ ì¶œì›ë£ŒëŠ” ê°ë©´ ì—†ìŒ)
    const totalFee = subtotal + priorityExamFee;
    breakdown.push({
      label: 'ì´ ë‚©ë¶€ì•¡',
      amount: totalFee,
      type: 'total'
    });
    
    // ì €ìž¥
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
    
    // UI ì—…ë°ì´íŠ¸
    TM.renderCurrentStep();
  };
  
  TM.togglePriorityExam = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.calculateFee();
  };

  // ============================================================
  // Step 7: ìš°ì„ ì‹¬ì‚¬
  // ============================================================
  
  TM.renderStep7_PriorityExam = function(container) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    const isConfirmed = pe.userConfirmed === true;
    
    // ì§€ì •ìƒí’ˆ ëª©ë¡ (ìœ ì‚¬êµ°ì½”ë“œ í¬í•¨)
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
        <h3>âš¡ ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì—¬ë¶€ ê²°ì •</h3>
        <p>ìƒí‘œë¥¼ ì‚¬ìš© ì¤‘ì´ê±°ë‚˜ ì‚¬ìš© ì¤€ë¹„ ì¤‘ì¸ ê²½ìš° ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.</p>
      </div>
      
      <!-- ì¶œì›ì„œ ì—…ë¡œë“œ (ì»´íŒ©íŠ¸) -->
      <div class="tm-form-section tm-upload-section-compact">
        <div class="tm-upload-header">
          <span>ðŸ“„ ì¶œì›ì„œ ì—…ë¡œë“œ (ì„ íƒ)</span>
          <span class="tm-hint-inline">ì¶œì›ì„œ(PDF)ë¥¼ ì—…ë¡œë“œí•˜ë©´ ì •ë³´ë¥¼ ìžë™ ì¶”ì¶œí•©ë‹ˆë‹¤</span>
        </div>
        
        <div class="tm-dropzone-compact" id="tm-application-dropzone"
             ondragover="TM.handleDragOver(event)" 
             ondragleave="TM.handleDragLeave(event)"
             ondrop="TM.handleApplicationDrop(event)"
             onclick="document.getElementById('tm-application-input').click()">
          <input type="file" id="tm-application-input" style="display: none;" 
                 accept=".pdf,image/*" multiple onchange="TM.handleApplicationUpload(this.files)">
          <span class="tm-dropzone-compact-icon">ðŸ“Ž</span>
          <span class="tm-dropzone-compact-text">íŒŒì¼ ì„ íƒ ë˜ëŠ” ë“œëž˜ê·¸</span>
          <span class="tm-dropzone-compact-formats">PDF, ì´ë¯¸ì§€</span>
        </div>
        
        ${pe.extractedFromApplication ? `
          <div class="tm-extracted-info-compact ${pe.editMode ? 'edit-mode' : ''}">
            <div class="tm-extracted-header-compact">
              <span>${pe.editMode ? 'ðŸ“ ì¶œì› ì •ë³´' : 'âœ… ì¶”ì¶œ ì™„ë£Œ'}</span>
              <div class="tm-extracted-actions-compact">
                ${pe.editMode ? `
                  <button class="btn btn-xs btn-primary" onclick="TM.confirmExtractedInfo()">í™•ì¸</button>
                ` : `
                  <button class="btn btn-xs btn-ghost" onclick="TM.editExtractedInfo()">ìˆ˜ì •</button>
                `}
                <button class="btn btn-xs btn-ghost" onclick="TM.clearExtractedInfo()">ì´ˆê¸°í™”</button>
              </div>
            </div>
            
            ${pe.editMode ? `
              <div class="tm-extracted-form-compact">
                <div class="tm-form-grid-compact">
                  <div class="tm-field-compact">
                    <label>ì¶œì›ë²ˆí˜¸ *</label>
                    <input type="text" id="tm-extract-applicationNumber" value="${pe.applicationNumber || ''}" placeholder="40-2024-0012345">
                  </div>
                  <div class="tm-field-compact">
                    <label>ì¶œì›ì¼ *</label>
                    <input type="text" id="tm-extract-applicationDate" value="${pe.applicationDate || ''}" placeholder="2024.03.15">
                  </div>
                  <div class="tm-field-compact">
                    <label>ì¶œì›ì¸ *</label>
                    <input type="text" id="tm-extract-applicantName" value="${pe.applicantName || ''}" placeholder="ì£¼ì‹íšŒì‚¬ OOO">
                  </div>
                  <div class="tm-field-compact">
                    <label>ìƒí‘œëª…</label>
                    <input type="text" id="tm-extract-trademarkNameFromApp" value="${pe.trademarkNameFromApp || ''}" placeholder="ìƒí‘œëª…">
                  </div>
                  <div class="tm-field-compact">
                    <label>ìƒí’ˆë¥˜</label>
                    <input type="text" id="tm-extract-classCode" value="${pe.classCode || ''}" placeholder="09">
                  </div>
                  <div class="tm-field-compact tm-field-wide">
                    <label>ì§€ì •ìƒí’ˆ</label>
                    <input type="text" id="tm-extract-designatedGoodsFromApp" value="${pe.designatedGoodsFromApp || ''}" placeholder="ì§€ì •ìƒí’ˆ ëª©ë¡">
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
      
      <!-- ìš°ì„ ì‹¬ì‚¬ ì„ íƒ (ì»´íŒ©íŠ¸) -->
      <div class="tm-priority-choice-compact">
        <span class="tm-choice-label">ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­</span>
        <div class="tm-choice-buttons">
          <button class="tm-choice-btn ${pe.enabled ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="true">
            âš¡ ì‹ ì²­ <small>(2~3ê°œì›”, +160,000ì›/ë¥˜)</small>
          </button>
          <button class="tm-choice-btn ${pe.enabled === false && isConfirmed ? 'selected' : ''}" data-action="tm-set-priority" data-enabled="false">
            ðŸ“‹ ì¼ë°˜ì‹¬ì‚¬ <small>(12~14ê°œì›”)</small>
          </button>
        </div>
        ${!isConfirmed ? '<span class="tm-choice-required">â† ì„ íƒ í•„ìš”</span>' : ''}
      </div>
      
      ${pe.enabled ? `
        <!-- ìš°ì„ ì‹¬ì‚¬ ì‚¬ìœ  (ì»´íŒ©íŠ¸) -->
        <div class="tm-section-compact">
          <div class="tm-section-header-compact">
            <span>ðŸ“‹ ì‹ ì²­ ì‚¬ìœ </span>
            <select class="tm-select-compact" id="tm-pe-reason" onchange="TM.updatePriorityReason(this.value)">
              <option value="" ${!pe.reason ? 'selected' : ''}>ì„ íƒ</option>
              <option value="using" ${pe.reason === 'using' ? 'selected' : ''}>ì‚¬ìš© ì¤‘ (ì‹œí–‰ë ¹ Â§12â‘ )</option>
              <option value="preparing" ${pe.reason === 'preparing' ? 'selected' : ''}>ì‚¬ìš© ì¤€ë¹„ ì¤‘ (ì‹œí–‰ë ¹ Â§12â‘ )</option>
              <option value="infringement" ${pe.reason === 'infringement' ? 'selected' : ''}>ì œ3ìž ë¬´ë‹¨ì‚¬ìš© (ì‹œí–‰ë ¹ Â§12â‘¡)</option>
              <option value="export" ${pe.reason === 'export' ? 'selected' : ''}>ìˆ˜ì¶œ ê¸´ê¸‰ (ì‹œí–‰ë ¹ Â§12â‘¢)</option>
            </select>
          </div>
          ${pe.reason ? `
            <textarea class="tm-textarea-compact" id="tm-pe-reason-detail" rows="2" 
                      placeholder="êµ¬ì²´ì ì¸ ì‚¬ìš© í˜„í™© ë˜ëŠ” ì¤€ë¹„ ìƒí™© (ì„ íƒ)"
                      onchange="TM.updatePriorityReasonDetail(this.value)">${pe.reasonDetail || ''}</textarea>
          ` : ''}
        </div>
        
        <!-- ì¦ê±°ìžë£Œ (ì»´íŒ©íŠ¸) -->
        <div class="tm-section-compact">
          <div class="tm-section-header-compact">
            <span>ðŸ“Ž ì¦ê±°ìžë£Œ</span>
            <div class="tm-evidence-upload-btn" onclick="document.getElementById('tm-evidence-input').click()">
              + íŒŒì¼ ì¶”ê°€
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
                  <button class="tm-evidence-delete" data-action="tm-remove-evidence" data-index="${idx}">âœ•</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="tm-evidence-empty" 
                 ondragover="TM.handleDragOver(event)"
                 ondragleave="TM.handleDragLeave(event)"
                 ondrop="TM.handleEvidenceDrop(event)"
                 onclick="document.getElementById('tm-evidence-input').click()">
              <span>ðŸ“ íŒŒì¼ì„ ë“œëž˜ê·¸í•˜ê±°ë‚˜ í´ë¦­í•˜ì—¬ ì—…ë¡œë“œ</span>
              <small>ì‚¬ì—…ìžë“±ë¡ì¦, ì œì•ˆì„œ, ê³„ì•½ì„œ ë“±</small>
            </div>
          `}
          
          <div class="tm-evidence-manual-compact">
            <input type="text" id="tm-evidence-title" placeholder="ìˆ˜ë™ ì¶”ê°€: ìžë£Œëª… ìž…ë ¥">
            <button class="tm-btn-add" onclick="TM.addEvidenceManual()">+</button>
          </div>
        </div>
        
        <!-- ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ ìƒì„± (ì»´íŒ©íŠ¸) -->
        <div class="tm-section-compact tm-doc-section">
          <div class="tm-section-header-compact">
            <span>ðŸ“ ì„¤ëª…ì„œ ìƒì„±</span>
          </div>
          
          ${TM.checkGoodsMismatch() ? `
            <div class="tm-goods-selector">
              <div class="tm-goods-selector-header">âš ï¸ ì§€ì •ìƒí’ˆ ì •ë³´ ë¶ˆì¼ì¹˜ - ì‚¬ìš©í•  ì •ë³´ ì„ íƒ:</div>
              <div class="tm-goods-selector-options">
                <label class="tm-goods-option-inline ${!pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(false)">
                  <input type="radio" name="goods-source" ${!pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label">ðŸ“‹ 2ë‹¨ê³„ ì§€ì •ìƒí’ˆ</span>
                  <span class="tm-option-value">${(p.designatedGoods || []).map(d => d.classCode).join(',')}ë¥˜</span>
                </label>
                <label class="tm-goods-option-inline ${pe.useExtractedGoods ? 'selected' : ''}" onclick="TM.selectGoodsSource(true)">
                  <input type="radio" name="goods-source" ${pe.useExtractedGoods ? 'checked' : ''}>
                  <span class="tm-option-label">ðŸ“„ ì¶œì›ì„œ ì¶”ì¶œ</span>
                  <span class="tm-option-value">${pe.classCode}ë¥˜</span>
                </label>
              </div>
            </div>
          ` : ''}
          
          <div class="tm-doc-actions-compact">
            <button class="tm-btn-generate" data-action="tm-generate-priority-doc">
              ðŸ“„ Word ìƒì„±
            </button>
            <button class="tm-btn-preview" onclick="TM.previewPriorityDoc()">
              ðŸ‘ï¸ ë¯¸ë¦¬ë³´ê¸°
            </button>
          </div>
          
          <!-- ë¯¸ë¦¬ë³´ê¸° ì˜ì—­ -->
          <div class="tm-doc-preview" id="tm-priority-doc-preview" style="display: none;">
            <div class="tm-doc-preview-header">
              <span>ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì„¤ëª…ì„œ ë¯¸ë¦¬ë³´ê¸°</span>
              <button class="btn btn-sm btn-ghost" onclick="document.getElementById('tm-priority-doc-preview').style.display='none'">ë‹«ê¸°</button>
            </div>
            <div class="tm-doc-preview-content" id="tm-priority-doc-content"></div>
          </div>
        </div>
      ` : `
        <div class="tm-info-box">
          <h4>ðŸ’¡ ìš°ì„ ì‹¬ì‚¬ëž€?</h4>
          <p>ìƒí‘œë¥¼ ì´ë¯¸ ì‚¬ìš©í•˜ê³  ìžˆê±°ë‚˜ ì‚¬ìš© ì¤€ë¹„ ì¤‘ì¸ ê²½ìš°, ì¼ë°˜ ì‹¬ì‚¬ë³´ë‹¤ ë¹ ë¥´ê²Œ ì‹¬ì‚¬ë¥¼ ë°›ì„ ìˆ˜ ìžˆëŠ” ì œë„ìž…ë‹ˆë‹¤.</p>
          <ul>
            <li>ì¼ë°˜ ì‹¬ì‚¬: ì•½ 12~14ê°œì›”</li>
            <li>ìš°ì„ ì‹¬ì‚¬: ì•½ 2~3ê°œì›”</li>
          </ul>
          <p><strong>ì‹ ì²­ ìš”ê±´ (ìƒí‘œë²• ì œ53ì¡° ì œ2í•­, ì‹œí–‰ë ¹ ì œ12ì¡°)</strong></p>
          <ol>
            <li>ìƒí‘œë¥¼ ì§€ì •ìƒí’ˆ ì „ë¶€ì— ì‚¬ìš© ì¤‘ì´ê±°ë‚˜ ì‚¬ìš© ì¤€ë¹„ ì¤‘ì¸ ê²½ìš°</li>
            <li>ì œ3ìžê°€ ì¶œì›ì¸ì˜ ìƒí‘œë¥¼ ë¬´ë‹¨ ì‚¬ìš© ì¤‘ì¸ ê²½ìš°</li>
            <li>ì¡°ì•½ì— ë”°ë¥¸ ìš°ì„ ê¶Œ ì£¼ìž¥ì´ ìžˆëŠ” ê²½ìš°</li>
          </ol>
          <p>ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì‹œ ë¥˜ë‹¹ 160,000ì›ì˜ ì¶”ê°€ ë¹„ìš©ì´ ë°œìƒí•©ë‹ˆë‹¤.</p>
        </div>
      `}
    `;
  };
  
  TM.getEvidenceTypeLabel = function(type) {
    const labels = {
      usage_photo: 'ì‚¬ìš© ì‚¬ì§„',
      advertisement: 'ê´‘ê³ ë¬¼',
      contract: 'ê³„ì•½ì„œ',
      sales_record: 'ë§¤ì¶œ ìžë£Œ',
      website: 'ì›¹ì‚¬ì´íŠ¸',
      packaging: 'í¬ìž¥ìž¬',
      signboard: 'ê°„íŒ',
      business_card: 'ëª…í•¨',
      other: 'ê¸°íƒ€'
    };
    return labels[type] || type;
  };
  
  TM.setPriorityExamEnabled = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.currentProject.priorityExam.userConfirmed = true; // ì‚¬ìš©ìžê°€ ëª…ì‹œì ìœ¼ë¡œ ì„ íƒ
    TM.hasUnsavedChanges = true;
    TM.calculateFee(); // ë¹„ìš© ìž¬ê³„ì‚°
    TM.renderCurrentStep();
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì„ íƒ ì¹´ë“œ í´ë¦­
  TM.setPriorityChoice = function(enabled) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.enabled = enabled;
    TM.currentProject.priorityExam.userConfirmed = true;
    TM.hasUnsavedChanges = true;
    TM.calculateFee();
    TM.renderCurrentStep();
    App.showToast(enabled ? 'ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ìœ¼ë¡œ ì„¤ì •ë˜ì—ˆìŠµë‹ˆë‹¤.' : 'ì¼ë°˜ ì‹¬ì‚¬ë¡œ ì„¤ì •ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
  };
  
  TM.updatePriorityReason = function(reason) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.reason = reason;
    TM.hasUnsavedChanges = true;
  };
  
  // ì¶œì›ì„œ ì—…ë¡œë“œë¡œ ì •ë³´ ì¶”ì¶œ (ì—¬ëŸ¬ íŒŒì¼ ì§€ì›)
  TM.handleApplicationUpload = async function(files) {
    if (!files || files.length === 0) return;
    
    const p = TM.currentProject;
    
    // ì—…ë¡œë“œ ì˜ì—­ì— ë¡œë”© í‘œì‹œ
    const dropzone = document.getElementById('tm-application-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <div class="tm-dropzone-loading">
          <div class="tm-spinner"></div>
          <div>ë¬¸ì„œ ë¶„ì„ ì¤‘... (${files.length}ê°œ íŒŒì¼)</div>
        </div>
      `;
    }
    
    try {
      // ê¸°ë³¸ê°’ ì„¤ì • (ì²« ì—…ë¡œë“œ ì‹œì—ë§Œ)
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
      
      // ì—¬ëŸ¬ íŒŒì¼ ìˆœì°¨ ì²˜ë¦¬
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // íŒŒì¼ í¬ê¸° ì²´í¬ (20MB)
        if (file.size > 20 * 1024 * 1024) {
          App.showToast(`${file.name}: íŒŒì¼ í¬ê¸° ì´ˆê³¼ (20MB ì´í•˜)`, 'warning');
          continue;
        }
        
        fileNames.push(file.name);
        
        // ì§„í–‰ ìƒíƒœ ì—…ë°ì´íŠ¸
        if (dropzone) {
          dropzone.innerHTML = `
            <div class="tm-dropzone-loading">
              <div class="tm-spinner"></div>
              <div>ë¶„ì„ ì¤‘... (${i + 1}/${files.length}) ${file.name}</div>
            </div>
          `;
        }
        
        // PDFì¸ ê²½ìš° í…ìŠ¤íŠ¸ ì¶”ì¶œ ì‹œë„
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const extracted = await TM.extractFromPDF(file);
            
            // ì¶”ì¶œëœ í•­ëª© ì ìš© (ë¹ˆ í•­ëª©ë§Œ ì±„ìš°ê¸°)
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
            // ìƒí’ˆë¥˜ì™€ ì§€ì •ìƒí’ˆì€ ì¶œì›ì„œì—ì„œ ì¶”ì¶œëœ ê°’ ìš°ì„  ì ìš©
            if (extracted.classCode) {
              p.priorityExam.classCode = extracted.classCode;
              totalExtracted++;
            }
            if (extracted.designatedGoods) {
              p.priorityExam.designatedGoodsFromApp = extracted.designatedGoods;
              totalExtracted++;
            }
            
          } catch (pdfError) {
            console.error(`[TM] ${file.name} ì¶”ì¶œ ì‹¤íŒ¨:`, pdfError);
          }
        }
      }
      
      p.priorityExam.uploadedFileName = fileNames.join(', ');
      
      // ì¶”ì¶œë˜ì§€ ì•Šì€ í•­ëª©ì€ ê¸°ì¡´ í”„ë¡œì íŠ¸ ì •ë³´ë¡œ ì±„ìš°ê¸°
      if (!p.priorityExam.classCode && p.designatedGoods && p.designatedGoods.length > 0) {
        p.priorityExam.classCode = p.designatedGoods.map(d => d.classCode).join(', ');
      }
      if (!p.priorityExam.designatedGoodsFromApp && p.designatedGoods && p.designatedGoods.length > 0) {
        p.priorityExam.designatedGoodsFromApp = p.designatedGoods.flatMap(d => (d.goods || []).map(g => g.name)).join(', ');
      }
      
      if (totalExtracted > 0) {
        App.showToast(`${totalExtracted}ê°œ í•­ëª©ì´ ì¶”ì¶œë˜ì—ˆìŠµë‹ˆë‹¤. í™•ì¸ í›„ ìˆ˜ì •í•˜ì„¸ìš”.`, 'success');
      } else {
        App.showToast('ìžë™ ì¶”ì¶œì— ì‹¤íŒ¨í–ˆìŠµë‹ˆë‹¤. ì§ì ‘ ìž…ë ¥í•´ì£¼ì„¸ìš”.', 'warning');
      }
      
      TM.renderCurrentStep();
      
    } catch (error) {
      console.error('[TM] ì¶œì›ì„œ ì—…ë¡œë“œ ì‹¤íŒ¨:', error);
      App.showToast('ì—…ë¡œë“œ ì‹¤íŒ¨: ' + error.message, 'error');
      TM.renderCurrentStep();
    }
  };
  
  // PDFì—ì„œ í…ìŠ¤íŠ¸ ì¶”ì¶œ ë° íŒŒì‹±
  TM.extractFromPDF = async function(file) {
    // PDF.js ë¡œë“œ
    if (!window.pdfjsLib) {
      console.log('[TM] PDF.js ë¡œë“œ ì¤‘...');
      await TM.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      console.log('[TM] PDF.js ë¡œë“œ ì™„ë£Œ');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    console.log('[TM] PDF íŒŒì¼ í¬ê¸°:', arrayBuffer.byteLength);
    
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('[TM] PDF íŽ˜ì´ì§€ ìˆ˜:', pdf.numPages);
    
    let fullText = '';
    
    // ëª¨ë“  íŽ˜ì´ì§€ì—ì„œ í…ìŠ¤íŠ¸ ì¶”ì¶œ
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      console.log('[TM] íŽ˜ì´ì§€', i, 'í…ìŠ¤íŠ¸ ì•„ì´í…œ ìˆ˜:', textContent.items.length);
      
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    // í…ìŠ¤íŠ¸ê°€ ê±°ì˜ ì—†ìœ¼ë©´ ì´ë¯¸ì§€ ê¸°ë°˜ PDF -> OCR ì‹œë„
    const cleanText = fullText.replace(/\s+/g, '').trim();
    console.log('[TM] ì¶”ì¶œëœ í…ìŠ¤íŠ¸ ê¸¸ì´:', cleanText.length);
    
    if (cleanText.length < 30) {
      console.log('[TM] ì´ë¯¸ì§€ ê¸°ë°˜ PDF ê°ì§€ - OCR ì‹œë„');
      App.showToast('ì´ë¯¸ì§€ PDF ê°ì§€. OCR ì²˜ë¦¬ ì¤‘...', 'info');
      fullText = await TM.ocrPDF(pdf);
    }
    
    console.log('[TM] ìµœì¢… í…ìŠ¤íŠ¸:', fullText.substring(0, 500));
    
    // Claude APIë¡œ ì •ë³´ ì¶”ì¶œ
    App.showToast('AIê°€ í…ìŠ¤íŠ¸ ë¶„ì„ ì¤‘...', 'info');
    return await TM.parseApplicationText(fullText);
  };
  
  // PDFë¥¼ ì´ë¯¸ì§€ë¡œ ë Œë”ë§ í›„ OCR
  TM.ocrPDF = async function(pdf) {
    // Tesseract.js ë¡œë“œ
    if (!window.Tesseract) {
      console.log('[TM] Tesseract.js ë¡œë“œ ì¤‘...');
      await TM.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
      console.log('[TM] Tesseract.js ë¡œë“œ ì™„ë£Œ');
    }
    
    let fullText = '';
    
    // ì²« íŽ˜ì´ì§€ë§Œ OCR (ì†ë„ ìœ„í•´)
    const page = await pdf.getPage(1);
    const scale = 2.0; // ê³ í•´ìƒë„ë¡œ ë Œë”ë§
    const viewport = page.getViewport({ scale });
    
    // Canvasì— ë Œë”ë§
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    console.log('[TM] PDF ì´ë¯¸ì§€ ë Œë”ë§ ì™„ë£Œ:', canvas.width, 'x', canvas.height);
    
    // OCR ì‹¤í–‰ (í•œêµ­ì–´)
    const result = await Tesseract.recognize(canvas, 'kor', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          console.log('[TM] OCR ì§„í–‰:', pct + '%');
        }
      }
    });
    
    fullText = result.data.text;
    console.log('[TM] OCR ê²°ê³¼:', fullText.substring(0, 500));
    
    return fullText;
  };
  
  // í…ìŠ¤íŠ¸ì—ì„œ ì¶œì› ì •ë³´ íŒŒì‹± (Claude API ì‚¬ìš©)
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
      console.log('[TM] í…ìŠ¤íŠ¸ê°€ ë„ˆë¬´ ì§§ìŒ');
      return result;
    }
    
    console.log('[TM] Claude APIë¡œ í…ìŠ¤íŠ¸ ë¶„ì„ ì‹œìž‘');
    console.log('[TM] ì›ë³¸ í…ìŠ¤íŠ¸:', text.substring(0, 800));
    
    try {
      const prompt = `ë‹¤ìŒì€ ìƒí‘œ ì¶œì›ë²ˆí˜¸í†µì§€ì„œ ë˜ëŠ” ì¶œì›ì„œë¥¼ OCRí•œ í…ìŠ¤íŠ¸ìž…ë‹ˆë‹¤. ë„ì–´ì“°ê¸°ê°€ ìž˜ëª»ë˜ì–´ ìžˆê±°ë‚˜ ê¸€ìžê°€ ëˆ„ë½ë˜ì—ˆì„ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.

ì•„ëž˜ ì •ë³´ë¥¼ ì¶”ì¶œí•´ì£¼ì„¸ìš”:
1. ì¶œì›ë²ˆí˜¸ (40-XXXX-XXXXXXX í˜•ì‹)
2. ì¶œì›ì¼ìž (YYYY.MM.DD í˜•ì‹)
3. ì¶œì›ì¸ ëª…ì¹­ (íšŒì‚¬ëª… ë˜ëŠ” ê°œì¸ëª…)
4. ìƒí’ˆë¥˜ (ìˆ«ìžë§Œ, ì˜ˆ: 09, 35, 42)
5. ì§€ì •ìƒí’ˆ (ì½¤ë§ˆë¡œ êµ¬ë¶„ëœ ëª©ë¡)

ã€OCR í…ìŠ¤íŠ¸ã€‘
${text.substring(0, 2000)}

ã€ì‘ë‹µ í˜•ì‹ - JSONë§Œã€‘
{"applicationNumber": "40-2025-0097799", "applicationDate": "2025.06.09", "applicantName": "ì‚¼ì¸ì‹œìŠ¤í…œ ì£¼ì‹íšŒì‚¬", "classCode": "09", "designatedGoods": "ì†Œí”„íŠ¸ì›¨ì–´, ì»´í“¨í„° í”„ë¡œê·¸ëž¨"}

ì°¾ì„ ìˆ˜ ì—†ëŠ” í•­ëª©ì€ ë¹ˆ ë¬¸ìžì—´("")ë¡œ ì„¤ì •í•˜ì„¸ìš”. JSONë§Œ ì‘ë‹µí•˜ì„¸ìš”.`;

      const response = await App.callClaude(prompt, 800);
      const responseText = response.text || '';
      
      console.log('[TM] Claude ì‘ë‹µ:', responseText);
      
      // JSON ì¶”ì¶œ
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
        
        console.log('[TM] Claude íŒŒì‹± ê²°ê³¼:', result);
        return result;
      }
    } catch (error) {
      console.error('[TM] Claude ë¶„ì„ ì‹¤íŒ¨, ì •ê·œì‹ í´ë°±:', error);
    }
    
    // ì •ê·œì‹ í´ë°±
    return TM.parseApplicationTextRegex(text);
  };
  
  // ì •ê·œì‹ ê¸°ë°˜ íŒŒì‹± (í´ë°±ìš©)
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
    
    console.log('[TM] ì •ê·œì‹ í´ë°± íŒŒì‹± ì‹œìž‘');
    
    // ì¶œì›ë²ˆí˜¸: 40-2025-0097799
    const appNumMatch = t.match(/(40-\d{4}-\d{6,7})/);
    if (appNumMatch) {
      result.applicationNumber = appNumMatch[1];
      console.log('[TM] ì¶œì›ë²ˆí˜¸:', result.applicationNumber);
    }
    
    // ì¶œì›ì¼ìž: 2025.06.09 ë˜ëŠ” 202506.09
    const dateMatch = t.match(/(\d{4})[.\s-]*(\d{2})[.\s-]*(\d{2})/);
    if (dateMatch) {
      result.applicationDate = `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
      console.log('[TM] ì¶œì›ì¼ìž:', result.applicationDate);
    }
    
    // ì¶œì›ì¸: í•œê¸€ ì‚¬ì´ ê³µë°± ì œê±°í•˜ì—¬ íšŒì‚¬ëª… ì¶”ì¶œ
    const companyMatch = t.match(/([ê°€-íž£\s]{2,20})\s*ì£¼\s*ì‹\s*íšŒ\s*ì‚¬|ì£¼\s*ì‹\s*íšŒ\s*ì‚¬\s*([ê°€-íž£\s]{2,20})/);
    if (companyMatch) {
      let name = (companyMatch[1] || companyMatch[2] || '').replace(/\s/g, '');
      if (name && name.length >= 2) {
        result.applicantName = name + ' ì£¼ì‹íšŒì‚¬';
        console.log('[TM] ì¶œì›ì¸:', result.applicantName);
      }
    }
    
    // ìƒí’ˆë¥˜: ì œ09ë¥˜, ì œ 09 ë¥˜, 09ë¥˜ ë“±
    const classMatch = t.match(/ì œ?\s*(\d{1,2})\s*ë¥˜/);
    if (classMatch) {
      result.classCode = classMatch[1].padStart(2, '0');
      console.log('[TM] ìƒí’ˆë¥˜:', result.classCode);
    }
    
    // ì§€ì •ìƒí’ˆ: ã€ì§€ì •ìƒí’ˆã€‘ ë˜ëŠ” ì§€ì •ìƒí’ˆ ë’¤ì˜ í…ìŠ¤íŠ¸
    const goodsMatch = t.match(/ì§€\s*ì •\s*ìƒ\s*í’ˆ[ã€‘\]\s:]*([\s\S]{10,500}?)(?=ã€|ì¶œì›ì¸|ìƒí‘œ|$)/i);
    if (goodsMatch) {
      let goods = goodsMatch[1].trim();
      // í•œê¸€ ì‚¬ì´ ë¶ˆí•„ìš”í•œ ê³µë°± ì œê±°
      goods = goods.replace(/([ê°€-íž£])\s+([ê°€-íž£])/g, '$1$2');
      goods = goods.replace(/([ê°€-íž£])\s+([ê°€-íž£])/g, '$1$2');
      goods = goods.substring(0, 300).trim();
      if (goods.length > 5) {
        result.designatedGoods = goods;
        console.log('[TM] ì§€ì •ìƒí’ˆ:', goods.substring(0, 80) + '...');
      }
    }
    
    console.log('[TM] ì •ê·œì‹ íŒŒì‹± ê²°ê³¼:', result);
    return result;
  };
  
  // ì¶”ì¶œ ì •ë³´ í•„ë“œ ì—…ë°ì´íŠ¸
  TM.updateExtractedField = function(field, value) {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam[field] = value;
    TM.hasUnsavedChanges = true;
  };
  
  // ì¶”ì¶œ ì •ë³´ ì €ìž¥ í™•ì •
  TM.confirmExtractedInfo = function() {
    const p = TM.currentProject;
    if (!p?.priorityExam) return;
    
    // ìž…ë ¥ í•„ë“œì—ì„œ ê°’ ì½ê¸°
    const fields = ['applicationNumber', 'applicationDate', 'trademarkNameFromApp', 'applicantName', 'classCode', 'designatedGoodsFromApp'];
    fields.forEach(field => {
      const input = document.getElementById(`tm-extract-${field}`);
      if (input) {
        p.priorityExam[field] = input.value.trim();
      }
    });
    
    p.priorityExam.editMode = false; // íŽ¸ì§‘ ëª¨ë“œ ì¢…ë£Œ
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast('ì¶œì› ì •ë³´ê°€ ì €ìž¥ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
  };
  
  // ë“œëž˜ê·¸ ì•¤ ë“œë¡­ í•¸ë“¤ëŸ¬
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
  
  // ê²¬ë³¸ ë“œëž˜ê·¸ì•¤ë“œë¡­
  TM.handleSpecimenDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        // íŒŒì¼ inputì— íŒŒì¼ ì„¤ì •í•˜ê³  ì²˜ë¦¬
        const input = document.getElementById('tm-specimen-input');
        if (input) {
          // DataTransferë¥¼ ì´ìš©í•´ inputì˜ files ì„¤ì •
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          // ë³€ê²½ ì´ë²¤íŠ¸ íŠ¸ë¦¬ê±°
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        App.showToast('ì´ë¯¸ì§€ íŒŒì¼ë§Œ ì—…ë¡œë“œ ê°€ëŠ¥í•©ë‹ˆë‹¤.', 'warning');
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
  
  // ì¶”ì¶œ ì •ë³´ ì´ˆê¸°í™”
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
    App.showToast('ì¶”ì¶œ ì •ë³´ê°€ ì´ˆê¸°í™”ë˜ì—ˆìŠµë‹ˆë‹¤.', 'info');
  };
  
  // íŽ¸ì§‘ ëª¨ë“œ ì „í™˜
  TM.editExtractedInfo = function() {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam.editMode = true;
    TM.renderCurrentStep();
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì‚¬ìœ  ìƒì„¸ ì—…ë°ì´íŠ¸
  TM.updatePriorityReasonDetail = function(detail) {
    if (!TM.currentProject) return;
    TM.currentProject.priorityExam.reasonDetail = detail;
    TM.hasUnsavedChanges = true;
  };
  
  // ì¦ê±°ìžë£Œ ìˆ˜ë™ ì¶”ê°€
  TM.addEvidenceManual = function() {
    const titleInput = document.getElementById('tm-evidence-title');
    const descInput = document.getElementById('tm-evidence-desc');
    
    const title = titleInput?.value?.trim();
    if (!title) {
      App.showToast('ì²¨ë¶€ìžë£Œ ì œëª©ì„ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
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
    App.showToast('ì²¨ë¶€ìžë£Œê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
  };
  
  // ì¦ê±°ìžë£Œ ë“œë¡­ í•¸ë“¤ëŸ¬
  TM.handleEvidenceDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      TM.handleEvidenceUpload(files);
    }
  };
  
  // ì¦ê±°ìžë£Œ íŒŒì¼ ì—…ë¡œë“œ ë° AI ë¶„ì„
  TM.handleEvidenceUpload = async function(files) {
    if (!files || files.length === 0) return;
    
    const p = TM.currentProject;
    if (!p.priorityExam) p.priorityExam = {};
    if (!p.priorityExam.evidences) p.priorityExam.evidences = [];
    
    const dropzone = document.getElementById('tm-evidence-dropzone');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // íŒŒì¼ í¬ê¸° ì²´í¬ (10MB)
      if (file.size > 10 * 1024 * 1024) {
        App.showToast(`${file.name}: íŒŒì¼ í¬ê¸° ì´ˆê³¼ (10MB ì´í•˜)`, 'warning');
        continue;
      }
      
      // ë¡œë”© í‘œì‹œ
      if (dropzone) {
        dropzone.innerHTML = `
          <div class="tm-dropzone-loading">
            <div class="tm-spinner"></div>
            <div>ì¦ê±°ìžë£Œ ë¶„ì„ ì¤‘... (${i + 1}/${files.length}) ${file.name}</div>
          </div>
        `;
      }
      
      try {
        // íŒŒì¼ íƒ€ìž…ì— ë”°ë¼ í…ìŠ¤íŠ¸ ì¶”ì¶œ
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
            // pptxëŠ” íŒŒì¼ëª… ê¸°ë°˜ìœ¼ë¡œ ì²˜ë¦¬ (í…ìŠ¤íŠ¸ ì¶”ì¶œ ë³µìž¡)
            fileContent = file.name;
          } else if (file.type.startsWith('image/')) {
            fileType = 'ì´ë¯¸ì§€';
            fileContent = await TM.extractTextFromImage(file);
          } else {
            fileType = 'íŒŒì¼';
            fileContent = file.name;
          }
        } catch (extractError) {
          console.warn('[TM] í…ìŠ¤íŠ¸ ì¶”ì¶œ ì‹¤íŒ¨, íŒŒì¼ëª…ë§Œ ì‚¬ìš©:', extractError.message);
          fileContent = file.name;
        }
        
        // AIë¡œ ì¦ë¹™ìžë£Œëª… ìƒì„± (ì‹¤íŒ¨ ì‹œ íŒŒì¼ëª… ê¸°ë°˜ ì¶”ì¸¡)
        let evidenceTitle;
        try {
          evidenceTitle = await TM.generateEvidenceTitle(file.name, fileContent, fileType);
        } catch (aiError) {
          console.warn('[TM] AI ë¶„ì„ ì‹¤íŒ¨, íŒŒì¼ëª… ê¸°ë°˜ ì¶”ì¸¡:', aiError.message);
          evidenceTitle = TM.guessEvidenceTitle(file.name);
        }
        
        p.priorityExam.evidences.push({
          title: evidenceTitle,
          fileName: file.name,
          fileType: fileType,
          description: `ì›ë³¸ íŒŒì¼: ${file.name}`,
          addedAt: new Date().toISOString()
        });
        
        console.log('[TM] ì¦ê±°ìžë£Œ ì¶”ê°€:', evidenceTitle);
        
      } catch (error) {
        console.error('[TM] ì¦ê±°ìžë£Œ ë¶„ì„ ì‹¤íŒ¨:', error);
        // ì‹¤íŒ¨í•´ë„ íŒŒì¼ëª…ìœ¼ë¡œ ì¶”ê°€
        p.priorityExam.evidences.push({
          title: TM.guessEvidenceTitle(file.name),
          fileName: file.name,
          description: `ì›ë³¸ íŒŒì¼: ${file.name}`,
          addedAt: new Date().toISOString()
        });
      }
    }
    
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
    App.showToast(`${files.length}ê°œ ì¦ê±°ìžë£Œê°€ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤.`, 'success');
  };
  
  // PDFì—ì„œ í…ìŠ¤íŠ¸ ì¶”ì¶œ (ì¦ê±°ìžë£Œìš©)
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
    
    // í…ìŠ¤íŠ¸ê°€ ì ìœ¼ë©´ OCR ì‹œë„
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
  
  // Wordì—ì„œ í…ìŠ¤íŠ¸ ì¶”ì¶œ
  TM.extractTextFromWord = async function(file) {
    // mammoth.js ë¡œë“œ
    if (!window.mammoth) {
      await TM.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.substring(0, 2000);
  };
  
  // ì´ë¯¸ì§€ì—ì„œ í…ìŠ¤íŠ¸ ì¶”ì¶œ (OCR)
  TM.extractTextFromImage = async function(file) {
    if (!window.Tesseract) {
      await TM.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
    }
    
    const result = await Tesseract.recognize(file, 'kor');
    return result.data.text.substring(0, 2000);
  };
  
  // íŒŒì¼ëª… ì •ë¦¬ í•¨ìˆ˜ (ê³µí†µ)
  TM.cleanFileName = function(fileName) {
    return fileName
      .replace(/^\d{3}-\d{4}-[ê°€-íž£a-zA-Z]+_/, '')  // "005-0001-ê¸°íƒ€ì²¨ë¶€ì„œë¥˜_" ì œê±°
      .replace(/^[A-Z]?\d+-\d+-/, '')               // "A001-0001-" í˜•ì‹ ì œê±°
      .replace(/_ì²¨ë¶€\.?/g, '')                      // "_ì²¨ë¶€" ì œê±°
      .replace(/ì²¨ë¶€$/, '')                          // ëì˜ "ì²¨ë¶€" ì œê±°
      .replace(/\.[^/.]+$/, '')                      // í™•ìž¥ìž ì œê±°
      .replace(/_/g, ' ')                            // ì–¸ë”ìŠ¤ì½”ì–´ë¥¼ ê³µë°±ìœ¼ë¡œ
      .trim();
  };
  
  // AIë¡œ ì¦ë¹™ìžë£Œëª… ìƒì„±
  TM.generateEvidenceTitle = async function(fileName, content, fileType) {
    const p = TM.currentProject;
    const trademarkName = p.trademarkName || '';
    const applicantName = p.applicantName || p.priorityExam?.applicantName || '';
    
    // íŒŒì¼ëª… ì •ë¦¬
    const cleanedFileName = TM.cleanFileName(fileName);
    
    try {
      const prompt = `ìƒí‘œ ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ìš© ì¦ê±°ìžë£Œì˜ ì¦ë¹™ìžë£Œëª…ì„ ìƒì„±í•˜ì„¸ìš”.

ã€ìƒí‘œ ì •ë³´ã€‘
- ìƒí‘œëª…: ${trademarkName}
- ì¶œì›ì¸: ${applicantName}

ã€íŒŒì¼ ì •ë³´ã€‘
- íŒŒì¼ëª…: ${cleanedFileName}
- íŒŒì¼íƒ€ìž…: ${fileType}

ã€íŒŒì¼ ë‚´ìš©ã€‘
${content.substring(0, 1200)}

ã€ì¢‹ì€ ì¦ë¹™ìžë£Œëª… ì˜ˆì‹œã€‘
- ì‚¬ì—…ìžë“±ë¡ì¦
- ê±´ë¬¼ê´€ë¦¬ì‹œìŠ¤í…œ ê¸°ìˆ ì„¤ëª…ì„œ
- ì¶œì›ì‚¬ì‹¤ì¦ëª…ì›
- ì†Œí”„íŠ¸ì›¨ì–´ ì œí’ˆ ì†Œê°œì„œ
- ì‹œìŠ¤í…œ ë‚©í’ˆ ê³„ì•½ì„œ
- ì„œë¹„ìŠ¤ ì´ìš© ì•½ê´€
- í™ˆíŽ˜ì´ì§€ ìº¡ì²˜í™”ë©´

íŒŒì¼ ë‚´ìš©ì„ ë¶„ì„í•˜ì—¬ ì ì ˆí•œ ì¦ë¹™ìžë£Œëª…ì„ í•œ ì¤„ë¡œ ì‘ë‹µí•˜ì„¸ìš”.
íŒŒì¼ë²ˆí˜¸ë‚˜ ì½”ë“œ(ì˜ˆ: 005-0001)ëŠ” ì œì™¸í•˜ê³  ë‚´ìš© ì¤‘ì‹¬ìœ¼ë¡œ ìž‘ì„±í•˜ì„¸ìš”.`;

      const response = await App.callClaude(prompt, 80);
      let title = (response.text || '').trim();
      
      // ì‘ë‹µ ì •ë¦¬
      title = title.replace(/^["']|["']$/g, '').trim();
      title = title.split('\n')[0].trim();
      // ë¶ˆí•„ìš”í•œ ì ‘ë‘ì‚¬ ë‹¤ì‹œ ì œê±°
      title = title.replace(/^\d{3}-\d{4}-[ê°€-íž£a-zA-Z_]+/, '').trim();
      
      if (title && title.length > 2 && title.length < 50) {
        return title;
      }
    } catch (error) {
      console.error('[TM] AI ì¦ë¹™ìžë£Œëª… ìƒì„± ì‹¤íŒ¨:', error);
    }
    
    // AI ì‹¤íŒ¨ ì‹œ íŒŒì¼ëª… ê¸°ë°˜ ì¶”ì¸¡
    return TM.guessEvidenceTitle(fileName);
  };
  
  // íŒŒì¼ëª…ìœ¼ë¡œ ì¦ë¹™ìžë£Œëª… ì¶”ì¸¡ (ê°œì„ ëœ ë²„ì „)
  TM.guessEvidenceTitle = function(fileName) {
    // íŒŒì¼ëª… ì •ë¦¬ - ë¶ˆí•„ìš”í•œ ì ‘ë‘ì‚¬ ì œê±°
    let cleanName = TM.cleanFileName(fileName);
    
    const name = cleanName.toLowerCase();
    const nameKor = cleanName;
    
    // íŠ¹ì • í‚¤ì›Œë“œ ë§¤ì¹­ (ìš°ì„ ìˆœìœ„ ìˆœ)
    const patterns = [
      // ì‚¬ì—…ìž ê´€ë ¨
      { keywords: ['ì‚¬ì—…ìžë“±ë¡ì¦', 'ì‚¬ì—…ìž ë“±ë¡ì¦'], title: 'ì‚¬ì—…ìžë“±ë¡ì¦' },
      { keywords: ['business registration', 'business license'], title: 'ì‚¬ì—…ìžë“±ë¡ì¦' },
      
      // ê¸°ìˆ  ë¬¸ì„œ
      { keywords: ['ê¸°ìˆ ì„¤ëª…ì„œ', 'ê¸°ìˆ  ì„¤ëª…ì„œ', 'ê¸°ìˆ ì†Œê°œì„œ'], title: 'ê¸°ìˆ ì„¤ëª…ì„œ' },
      { keywords: ['ë°œëª…ì„¤ëª…ì„œ', 'ë°œëª… ì„¤ëª…ì„œ'], title: 'ë°œëª…ì„¤ëª…ì„œ' },
      { keywords: ['ì‚¬ìš©ì„¤ëª…ì„œ', 'ì‚¬ìš© ì„¤ëª…ì„œ', 'ë§¤ë‰´ì–¼', 'manual'], title: 'ì‚¬ìš© ì„¤ëª…ì„œ' },
      
      // ì¶œì›/ì¦ëª… ê´€ë ¨
      { keywords: ['ì¶œì›ì‚¬ì‹¤ì¦ëª…ì›', 'ì¶œì›ì‚¬ì‹¤ ì¦ëª…ì›'], title: 'ì¶œì›ì‚¬ì‹¤ì¦ëª…ì›' },
      { keywords: ['ì¶œì›ì„œ', 'ì¶œì› ì„œë¥˜'], title: 'ì¶œì›ì„œ' },
      { keywords: ['ë“±ë¡ì¦', 'certificate'], title: 'ë“±ë¡ì¦' },
      { keywords: ['ì¦ëª…ì›', 'ì¦ëª…ì„œ'], title: 'ì¦ëª…ì›' },
      
      // ê³„ì•½/ê±°ëž˜ ê´€ë ¨
      { keywords: ['ì œì•ˆì„œ', 'proposal'], title: 'ì œì•ˆì„œ' },
      { keywords: ['ê³„ì•½ì„œ', 'contract', 'agreement'], title: 'ê³„ì•½ì„œ' },
      { keywords: ['ê²¬ì ì„œ', 'quotation', 'estimate'], title: 'ê²¬ì ì„œ' },
      { keywords: ['ê±°ëž˜ëª…ì„¸', 'invoice', 'ì„¸ê¸ˆê³„ì‚°ì„œ'], title: 'ê±°ëž˜ëª…ì„¸ì„œ' },
      { keywords: ['ë‚©í’ˆ', 'delivery', 'ì¸ìˆ˜ì¸ê³„'], title: 'ë‚©í’ˆí™•ì¸ì„œ' },
      
      // í™ë³´/ë§ˆì¼€íŒ…
      { keywords: ['ì¹´íƒˆë¡œê·¸', 'catalog', 'catalogue', 'ë¸Œë¡œìŠˆì–´', 'brochure'], title: 'ì œí’ˆ ì¹´íƒˆë¡œê·¸' },
      { keywords: ['í™ˆíŽ˜ì´ì§€', 'website', 'ìº¡ì²˜', 'screenshot'], title: 'í™ˆíŽ˜ì´ì§€ ìº¡ì²˜ í™”ë©´' },
      { keywords: ['ê´‘ê³ ', 'advertisement', 'ad', 'í™ë³´'], title: 'ê´‘ê³  ìžë£Œ' },
      
      // íŠ¹í—ˆ ê´€ë ¨
      { keywords: ['íŠ¹í—ˆ', 'patent'], title: 'íŠ¹í—ˆ ê´€ë ¨ ì„œë¥˜' },
      { keywords: ['ìƒí‘œ', 'trademark'], title: 'ìƒí‘œ ê´€ë ¨ ì„œë¥˜' },
      
      // ê¸°íƒ€
      { keywords: ['ppt', 'pptx', 'presentation', 'í”„ë ˆì  í…Œì´ì…˜'], title: 'ë°œí‘œìžë£Œ' },
      { keywords: ['report', 'ë³´ê³ ì„œ', 'ë¦¬í¬íŠ¸'], title: 'ë³´ê³ ì„œ' },
    ];
    
    // íŒ¨í„´ ë§¤ì¹­
    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (name.includes(keyword.toLowerCase()) || nameKor.includes(keyword)) {
          return pattern.title;
        }
      }
    }
    
    // ë§¤ì¹­ ì•ˆë˜ë©´ ì •ë¦¬ëœ íŒŒì¼ëª… ë°˜í™˜ (ë„ˆë¬´ ì§§ìœ¼ë©´ ì›ë³¸ ì‚¬ìš©)
    if (cleanName.length < 3) {
      cleanName = fileName.replace(/\.[^/.]+$/, '');
    }
    
    // ì–¸ë”ìŠ¤ì½”ì–´ë¥¼ ê³µë°±ìœ¼ë¡œ
    cleanName = cleanName.replace(/_/g, ' ').trim();
    
    return cleanName || 'ì²¨ë¶€ìžë£Œ';
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ ë¯¸ë¦¬ë³´ê¸°
  TM.previewPriorityDoc = function() {
    const previewEl = document.getElementById('tm-priority-doc-preview');
    const contentEl = document.getElementById('tm-priority-doc-content');
    
    if (!previewEl || !contentEl) return;
    
    // ì¸ë¼ì¸ ì„ íƒ ê°’ ì‚¬ìš©
    const pe = TM.currentProject?.priorityExam || {};
    const useExtracted = pe.useExtractedGoods || false;
    
    const docContent = TM.generatePriorityDocContent(useExtracted);
    contentEl.innerHTML = docContent;
    previewEl.style.display = 'block';
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ ë‚´ìš© ìƒì„±
  TM.generatePriorityDocContent = function(useExtracted = false) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    // ì¶œì›ì¸ ì •ë³´
    const applicantName = pe.applicantName || p.applicantName || '[ì¶œì›ì¸ëª…]';
    const applicationNumber = pe.applicationNumber || '[ì¶œì›ë²ˆí˜¸]';
    const applicationDate = pe.applicationDate || '[ì¶œì›ì¼]';
    const trademarkName = pe.trademarkNameFromApp || p.trademarkName || '[ìƒí‘œëª…]';
    
    // ì¸ë¼ì¸ ì„ íƒ ê°’ ì ìš©
    const hasExtracted = pe.classCode || pe.designatedGoodsFromApp;
    const finalUseExtracted = useExtracted || pe.useExtractedGoods || false;
    let classCodeStr, designatedGoodsStr, goodsWithGroups;
    
    if (finalUseExtracted && hasExtracted) {
      // ì¶”ì¶œ ì •ë³´ ì‚¬ìš©
      classCodeStr = pe.classCode ? `ì œ ${pe.classCode}ë¥˜` : '[ìƒí’ˆë¥˜]';
      designatedGoodsStr = pe.designatedGoodsFromApp || '[ì§€ì •ìƒí’ˆ]';
      goodsWithGroups = pe.designatedGoodsFromApp ? 
        pe.designatedGoodsFromApp.split(',').map(g => `ã€Ž${g.trim()}ã€`) : [];
    } else {
      // 2ë‹¨ê³„ ì •ë³´ ì‚¬ìš© (ê¸°ë³¸)
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
      classCodeStr = classCodeList.length > 0 ? classCodeList.map(c => 'ì œ ' + c + 'ë¥˜').join(', ') : '[ìƒí’ˆë¥˜]';
      
      const goodsList = [];
      Object.values(classGroups).forEach(goods => {
        goods.forEach(g => goodsList.push(g.name));
      });
      designatedGoodsStr = goodsList.length > 0 ? goodsList.join(', ') : '[ì§€ì •ìƒí’ˆ]';
      
      goodsWithGroups = [];
      Object.entries(classGroups).forEach(([classCode, goods]) => {
        goods.forEach(g => {
          if (g.similarGroup) {
            goodsWithGroups.push(`ã€Ž${g.similarGroup} ${g.name}ã€`);
          } else {
            goodsWithGroups.push(`ã€Ž${g.name}ã€`);
          }
        });
      });
    }
    
    // ì¦ê±°ìžë£Œ ëª©ë¡
    const evidences = pe.evidences || [];
    
    // ì²¨ë¶€ìžë£Œ ì°¸ì¡° ë¬¸ìžì—´ ìƒì„±
    const evidence1Ref = evidences.length > 0 ? `(ì²¨ë¶€ìžë£Œ 1: ${evidences[0].title})` : '';
    const evidence2Ref = evidences.length > 1 ? `(ì²¨ë¶€ìžë£Œ 2: ${evidences[1].title})` : '';
    
    // ì‹ ì²­ì´ìœ  ì„ íƒì— ë”°ë¥¸ ë²•ì¡°ë¬¸
    let reasonText = '';
    if (pe.reason === 'using' || pe.reason === 'preparing') {
      reasonText = `ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ1í˜¸ì˜ "ìƒí‘œë“±ë¡ì¶œì›ì¸ì´ ìƒí‘œë“±ë¡ì¶œì›í•œ ìƒí‘œë¥¼ ì§€ì •ìƒí’ˆ ì „ë¶€ì— ëŒ€í•˜ì—¬ ì‚¬ìš©í•˜ê³  ìžˆê±°ë‚˜ ì‚¬ìš©í•  ì¤€ë¹„ë¥¼ í•˜ê³  ìžˆìŒì´ ëª…ë°±í•œ ê²½ìš°"ì— í•´ë‹¹í•˜ëŠ” ìƒí‘œë“±ë¡ì¶œì›ìœ¼ë¡œì„œ, ê·¸ ì§€ì •ìƒí’ˆì— ì‚¬ìš© ì¤€ë¹„í•˜ê³  ìžˆëŠ” ê²ƒì´ ëª…ë°±í•˜ë¯€ë¡œ ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.`;
    } else if (pe.reason === 'infringement') {
      reasonText = `ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ2í˜¸ì˜ "ì¶œì›ì¸ì´ ì•„ë‹Œ ìžê°€ ì¶œì›ìƒí‘œì™€ ë™ì¼Â·ìœ ì‚¬í•œ ìƒí‘œë¥¼ ë™ì¼Â·ìœ ì‚¬í•œ ì§€ì •ìƒí’ˆì— ì •ë‹¹í•œ ì‚¬ìœ  ì—†ì´ ì‚¬ìš©í•˜ê³  ìžˆë‹¤ê³  ì¸ì •ë˜ëŠ” ê²½ìš°"ì— í•´ë‹¹í•˜ëŠ” ìƒí‘œë“±ë¡ì¶œì›ìœ¼ë¡œì„œ, ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.`;
    } else {
      reasonText = `ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ1í˜¸ì˜ ê·œì •ì— ë”°ë¼ ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.`;
    }
    
    // HTML í˜•ì‹ì˜ ë¯¸ë¦¬ë³´ê¸°
    return `
      <div class="tm-doc-preview-body">
        <h2 style="text-align: center; margin-bottom: 24px;">ìƒí‘œ ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì„¤ëª…ì„œ</h2>
        
        <div class="tm-doc-section">
          <h3>ã€ì„œì§€ì‚¬í•­ã€‘</h3>
          <table class="tm-doc-table">
            <tr><td width="150"><strong>ã€ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì¸ã€‘</strong></td><td>${applicantName}</td></tr>
            <tr><td><strong>ã€ì¶œì›ë²ˆí˜¸ã€‘</strong></td><td>${applicationNumber}</td></tr>
            <tr><td><strong>ã€ì¶œì›ì¼ã€‘</strong></td><td>${applicationDate}</td></tr>
          </table>
        </div>
        
        <div class="tm-doc-section">
          <h3>ã€ìƒí‘œê²¬ë³¸ã€‘</h3>
          <p style="font-size: 18px; font-weight: bold;">${trademarkName}</p>
        </div>
        
        <div class="tm-doc-section">
          <h3>ã€ìƒí’ˆë¥˜ã€‘</h3>
          <p>${classCodeStr || '[ìƒí’ˆë¥˜]'}</p>
        </div>
        
        <div class="tm-doc-section">
          <h3>ã€ì§€ì •ìƒí’ˆã€‘</h3>
          <p>${designatedGoodsStr || '[ì§€ì •ìƒí’ˆ]'}</p>
        </div>
        
        <div class="tm-doc-section">
          <h3>ã€ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì´ìœ ã€‘</h3>
          <p>${reasonText}</p>
          <p style="margin-top: 12px;">
            ë³¸ ì¶œì›ì¸ "${applicantName}"ëŠ” ë³¸ ì‹ ì²­ì„œì˜ ì²¨ë¶€ìžë£Œ${evidence1Ref}ì— ê¸°ìž¬ëœ ë°”ì™€ ê°™ì´, 
            ì´ê±´ ì¶œì›ìƒí‘œê°€ í‘œì‹œëœ ${goodsWithGroups.join(', ')}ì„ 
            ì‚¬ìš© ë° ì‚¬ìš© ì¤€ë¹„ ì¤‘ìž…ë‹ˆë‹¤.
          </p>
          <p style="margin-top: 12px;">
            ë”°ë¼ì„œ, ì´ê±´ ì¶œì›ìƒí‘œëŠ” ì•žì„œ ì„¤ëª…í•œ ë°”ì™€ ê°™ì´, ê·¸ ì§€ì •ìƒí’ˆ ì „ë¶€ì— ëŒ€í•˜ì—¬ ì‚¬ìš©ì˜ˆì • ì¤‘ì— ìžˆìŠµë‹ˆë‹¤.
          </p>
          <p style="margin-top: 12px;">
            ì´ê±´ ì¶œì›ì¸ "${applicantName}"${evidence2Ref}ì€ ì´ê±´ ì¶œì›ìƒí‘œë¥¼ í•´ë‹¹ ì§€ì •ìƒí’ˆì— ì‚¬ìš©í•  ê²ƒì´ ë”ìš± ë¶„ëª…í•©ë‹ˆë‹¤. 
            ë¶€ë”” ì´ì ì„ ì ê·¹ ê³ ë ¤í•˜ì‹œì–´ ì´ê±´ ì¶œì›ìƒí‘œì— ëŒ€í•˜ì—¬ ìš°ì„ ì‹¬ì‚¬ì‹ ì²­ì„ í—ˆì—¬í•´ ì£¼ì‹œê¸° ë°”ëžë‹ˆë‹¤.
          </p>
        </div>
        
        ${evidences.length > 0 ? `
          <div class="tm-doc-section">
            <h3>ã€ì¦ë¹™ìžë£Œã€‘</h3>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${evidences.map((ev, idx) => `<li>ì²¨ë¶€ìžë£Œ ${idx + 1} : ${ev.title}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ Word íŒŒì¼ ìƒì„±
  TM.generatePriorityDoc = async function(useExtracted = null) {
    const p = TM.currentProject;
    const pe = p.priorityExam || {};
    
    // í•„ìˆ˜ ì •ë³´ ì²´í¬
    if (!pe.applicationNumber && !p.trademarkName) {
      App.showToast('ì¶œì›ë²ˆí˜¸ ë˜ëŠ” ìƒí‘œëª…ì´ í•„ìš”í•©ë‹ˆë‹¤.', 'warning');
      return;
    }
    
    // 2ë‹¨ê³„ ì§€ì •ìƒí’ˆ ì •ë³´
    const step2ClassCodes = (p.designatedGoods || []).map(d => d.classCode).sort().join(',');
    const step2GoodsList = (p.designatedGoods || []).flatMap(d => (d.goods || []).map(g => g.name));
    const step2GoodsStr = step2GoodsList.join(', ');
    
    // 7ë‹¨ê³„ ì¶”ì¶œ ì§€ì •ìƒí’ˆ ì •ë³´
    const extractedClassCode = pe.classCode || '';
    const extractedGoodsStr = pe.designatedGoodsFromApp || '';
    
    // ë¶ˆì¼ì¹˜ ì‹œ ì¸ë¼ì¸ ì„ íƒ ê°’ ì‚¬ìš© (useExtracted íŒŒë¼ë¯¸í„°ê°€ nullì´ë©´ pe.useExtractedGoods ì‚¬ìš©)
    const hasExtracted = extractedClassCode || extractedGoodsStr;
    const finalUseExtracted = useExtracted !== null ? useExtracted : (pe.useExtractedGoods || false);
    
    try {
      App.showToast('Word ë¬¸ì„œ ìƒì„± ì¤‘...', 'info');
      
      // ì¶œì›ì¸ ì •ë³´
      const applicantName = pe.applicantName || p.applicantName || '[ì¶œì›ì¸ëª…]';
      const applicationNumber = pe.applicationNumber || '[ì¶œì›ë²ˆí˜¸]';
      const applicationDate = pe.applicationDate || '[ì¶œì›ì¼]';
      const trademarkName = pe.trademarkNameFromApp || p.trademarkName || '[ìƒí‘œëª…]';
      
      // ìƒí’ˆë¥˜ ë° ì§€ì •ìƒí’ˆ - ì„ íƒì— ë”°ë¼ ê²°ì •
      let classCodeStr, designatedGoodsStr, goodsWithGroups;
      
      if (finalUseExtracted && hasExtracted) {
        // 7ë‹¨ê³„ ì¶”ì¶œ ì •ë³´ ì‚¬ìš©
        classCodeStr = extractedClassCode ? `ì œ ${extractedClassCode}ë¥˜` : '[ìƒí’ˆë¥˜]';
        designatedGoodsStr = extractedGoodsStr || '[ì§€ì •ìƒí’ˆ]';
        goodsWithGroups = extractedGoodsStr ? extractedGoodsStr.split(',').map(g => `ã€Ž${g.trim()}ã€`) : [];
      } else {
        // 2ë‹¨ê³„ ì§€ì •ìƒí’ˆ ì •ë³´ ì‚¬ìš© (ê¸°ë³¸ê°’)
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
        classCodeStr = classCodeList.length > 0 ? classCodeList.map(c => 'ì œ ' + c + 'ë¥˜').join(', ') : '[ìƒí’ˆë¥˜]';
        
        const goodsList = [];
        Object.values(classGroups).forEach(goods => {
          goods.forEach(g => goodsList.push(g.name));
        });
        designatedGoodsStr = goodsList.length > 0 ? goodsList.join(', ') : '[ì§€ì •ìƒí’ˆ]';
        
        goodsWithGroups = [];
        Object.entries(classGroups).forEach(([classCode, goods]) => {
          goods.forEach(g => {
            if (g.similarGroup) {
              goodsWithGroups.push(`ã€Ž${g.similarGroup} ${g.name}ã€`);
            } else {
              goodsWithGroups.push(`ã€Ž${g.name}ã€`);
            }
          });
        });
      }
      
      // ì¦ê±°ìžë£Œ ëª©ë¡
      const evidences = pe.evidences || [];
      
      // ì‹ ì²­ì´ìœ  ì„ íƒì— ë”°ë¥¸ ë²•ì¡°ë¬¸
      let reasonText1 = '';
      if (pe.reason === 'using' || pe.reason === 'preparing') {
        reasonText1 = 'ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ1í˜¸ì˜ "ìƒí‘œë“±ë¡ì¶œì›ì¸ì´ ìƒí‘œë“±ë¡ì¶œì›í•œ ìƒí‘œë¥¼ ì§€ì •ìƒí’ˆ ì „ë¶€ì— ëŒ€í•˜ì—¬ ì‚¬ìš©í•˜ê³  ìžˆê±°ë‚˜ ì‚¬ìš©í•  ì¤€ë¹„ë¥¼ í•˜ê³  ìžˆìŒì´ ëª…ë°±í•œ ê²½ìš°"ì— í•´ë‹¹í•˜ëŠ” ìƒí‘œë“±ë¡ì¶œì›ìœ¼ë¡œì„œ, ê·¸ ì§€ì •ìƒí’ˆì— ì‚¬ìš© ì¤€ë¹„í•˜ê³  ìžˆëŠ” ê²ƒì´ ëª…ë°±í•˜ë¯€ë¡œ ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.';
      } else if (pe.reason === 'infringement') {
        reasonText1 = 'ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ2í˜¸ì˜ "ì¶œì›ì¸ì´ ì•„ë‹Œ ìžê°€ ì¶œì›ìƒí‘œì™€ ë™ì¼Â·ìœ ì‚¬í•œ ìƒí‘œë¥¼ ë™ì¼Â·ìœ ì‚¬í•œ ì§€ì •ìƒí’ˆì— ì •ë‹¹í•œ ì‚¬ìœ  ì—†ì´ ì‚¬ìš©í•˜ê³  ìžˆë‹¤ê³  ì¸ì •ë˜ëŠ” ê²½ìš°"ì— í•´ë‹¹í•˜ëŠ” ìƒí‘œë“±ë¡ì¶œì›ìœ¼ë¡œì„œ, ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.';
      } else {
        reasonText1 = 'ë³¸ ìƒí‘œëŠ” ìƒí‘œë²• ì œ53ì¡° ì œ2í•­ ì œ2í˜¸ ë° ìƒí‘œë²• ì‹œí–‰ë ¹ ì œ12ì¡° ì œ1í˜¸ì˜ ê·œì •ì— ë”°ë¼ ìš°ì„ ì‹¬ì‚¬ë¥¼ ì‹ ì²­í•©ë‹ˆë‹¤.';
      }
      
      // ì¦ê±°ìžë£Œ ì°¸ì¡° ë¬¸ìžì—´ ìƒì„± (ì²¨ë¶€ìžë£Œ 1, 2 ê°œë³„ ì°¸ì¡°)
      const evidence1Ref = evidences.length > 0 ? `(ì²¨ë¶€ìžë£Œ 1: ${evidences[0].title})` : '';
      const evidence2Ref = evidences.length > 1 ? `(ì²¨ë¶€ìžë£Œ 2: ${evidences[1].title})` : '';
      
      const reasonText2 = `ë³¸ ì¶œì›ì¸ "${applicantName}"ëŠ” ë³¸ ì‹ ì²­ì„œì˜ ì²¨ë¶€ìžë£Œ${evidence1Ref}ì— ê¸°ìž¬ëœ ë°”ì™€ ê°™ì´, ì´ê±´ ì¶œì›ìƒí‘œê°€ í‘œì‹œëœ ${goodsWithGroups.join(', ')}ì„ ì‚¬ìš© ë° ì‚¬ìš© ì¤€ë¹„ ì¤‘ìž…ë‹ˆë‹¤.`;
      
      const reasonText3 = 'ë”°ë¼ì„œ, ì´ê±´ ì¶œì›ìƒí‘œëŠ” ì•žì„œ ì„¤ëª…í•œ ë°”ì™€ ê°™ì´, ê·¸ ì§€ì •ìƒí’ˆ ì „ë¶€ì— ëŒ€í•˜ì—¬ ì‚¬ìš©ì˜ˆì • ì¤‘ì— ìžˆìŠµë‹ˆë‹¤.';
      
      const reasonText4 = `ì´ê±´ ì¶œì›ì¸ "${applicantName}"${evidence2Ref}ì€ ì´ê±´ ì¶œì›ìƒí‘œë¥¼ í•´ë‹¹ ì§€ì •ìƒí’ˆì— ì‚¬ìš©í•  ê²ƒì´ ë”ìš± ë¶„ëª…í•©ë‹ˆë‹¤. ë¶€ë”” ì´ì ì„ ì ê·¹ ê³ ë ¤í•˜ì‹œì–´ ì´ê±´ ì¶œì›ìƒí‘œì— ëŒ€í•˜ì—¬ ìš°ì„ ì‹¬ì‚¬ì‹ ì²­ì„ í—ˆì—¬í•´ ì£¼ì‹œê¸° ë°”ëžë‹ˆë‹¤.`;
      
      // Edge Functionìœ¼ë¡œ Word ìƒì„± ìš”ì²­
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
      
      // Supabase Edge Function í˜¸ì¶œ ë˜ëŠ” í´ë¼ì´ì–¸íŠ¸ ì‚¬ì´ë“œ ìƒì„±
      const blob = await TM.createPriorityDocBlob(docData);
      
      // ë‹¤ìš´ë¡œë“œ
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ìš°ì„ ì‹¬ì‚¬ì‹ ì²­ì„¤ëª…ì„œ_${applicationNumber.replace(/[^0-9]/g, '') || Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      App.showToast('ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œê°€ ë‹¤ìš´ë¡œë“œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('ë¬¸ì„œ ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };
  
  // ì§€ì •ìƒí’ˆ ë¶ˆì¼ì¹˜ ëª¨ë‹¬ í‘œì‹œ
  TM.showGoodsMismatchModal = function(step2Class, step2Goods, extractedClass, extractedGoods) {
    // ê¸°ì¡´ ëª¨ë‹¬ ì œê±°
    const existingModal = document.getElementById('tm-goods-mismatch-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'tm-goods-mismatch-modal';
    modal.className = 'tm-modal-overlay';
    modal.innerHTML = `
      <div class="tm-modal tm-goods-mismatch-modal">
        <div class="tm-modal-header">
          <h3>âš ï¸ ì§€ì •ìƒí’ˆ ì •ë³´ ë¶ˆì¼ì¹˜</h3>
          <button class="tm-modal-close" onclick="TM.closeGoodsMismatchModal()">âœ•</button>
        </div>
        <div class="tm-modal-body">
          <p class="tm-modal-desc">2ë‹¨ê³„ì—ì„œ ì§€ì •í•œ ìƒí’ˆ ì •ë³´ì™€ ì¶œì›ì„œì—ì„œ ì¶”ì¶œí•œ ì •ë³´ê°€ ë‹¤ë¦…ë‹ˆë‹¤.<br>ì–´ë–¤ ì •ë³´ë¡œ ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì„¤ëª…ì„œë¥¼ ìž‘ì„±í•˜ì‹œê² ìŠµë‹ˆê¹Œ?</p>
          
          <div class="tm-goods-compare">
            <div class="tm-goods-option" data-option="step2" onclick="TM.selectGoodsOption('step2')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-step2" checked>
                <label for="opt-step2"><strong>ðŸ“‹ 2ë‹¨ê³„ ì§€ì •ìƒí’ˆ</strong> (í”„ë¡œì íŠ¸ì— ì €ìž¥ëœ ì •ë³´)</label>
              </div>
              <div class="tm-goods-option-content">
                <div class="tm-goods-item"><span class="tm-label">ìƒí’ˆë¥˜:</span> <span>${step2Class || '-'}</span></div>
                <div class="tm-goods-item"><span class="tm-label">ì§€ì •ìƒí’ˆ:</span> <span class="tm-goods-text">${step2Goods.substring(0, 150)}${step2Goods.length > 150 ? '...' : ''}</span></div>
              </div>
            </div>
            
            <div class="tm-goods-option" data-option="extracted" onclick="TM.selectGoodsOption('extracted')">
              <div class="tm-goods-option-header">
                <input type="radio" name="goods-option" id="opt-extracted">
                <label for="opt-extracted"><strong>ðŸ“„ ì¶œì›ì„œ ì¶”ì¶œ ì •ë³´</strong> (PDFì—ì„œ ì¶”ì¶œí•œ ì •ë³´)</label>
              </div>
              <div class="tm-goods-option-content">
                <div class="tm-goods-item"><span class="tm-label">ìƒí’ˆë¥˜:</span> <span>ì œ ${extractedClass || '-'}ë¥˜</span></div>
                <div class="tm-goods-item"><span class="tm-label">ì§€ì •ìƒí’ˆ:</span> <span class="tm-goods-text">${extractedGoods.substring(0, 150)}${extractedGoods.length > 150 ? '...' : ''}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="btn btn-secondary" onclick="TM.closeGoodsMismatchModal()">ì·¨ì†Œ</button>
          <button class="btn btn-primary" onclick="TM.confirmGoodsSelection()">ì„ íƒí•œ ì •ë³´ë¡œ ìƒì„±</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // ê¸°ë³¸ ì„ íƒ
    TM.selectedGoodsOption = 'step2';
  };
  
  // ì§€ì •ìƒí’ˆ ì˜µì…˜ ì„ íƒ
  TM.selectGoodsOption = function(option) {
    TM.selectedGoodsOption = option;
    document.querySelectorAll('.tm-goods-option').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.tm-goods-option[data-option="${option}"]`).classList.add('selected');
    document.getElementById(option === 'step2' ? 'opt-step2' : 'opt-extracted').checked = true;
  };
  
  // ì§€ì •ìƒí’ˆ ì„ íƒ í™•ì¸
  TM.confirmGoodsSelection = function() {
    TM.closeGoodsMismatchModal();
    const useExtracted = TM.selectedGoodsOption === 'extracted';
    TM.generatePriorityDoc(useExtracted);
  };
  
  // ëª¨ë‹¬ ë‹«ê¸°
  TM.closeGoodsMismatchModal = function() {
    const modal = document.getElementById('tm-goods-mismatch-modal');
    if (modal) modal.remove();
  };
  
  // ì§€ì •ìƒí’ˆ ë¶ˆì¼ì¹˜ ì²´í¬
  TM.checkGoodsMismatch = function() {
    const p = TM.currentProject;
    if (!p) return false;
    
    const pe = p.priorityExam || {};
    
    // 2ë‹¨ê³„ ì§€ì •ìƒí’ˆ ì •ë³´
    const step2ClassCodes = (p.designatedGoods || []).map(d => d.classCode).sort().join(',');
    
    // 7ë‹¨ê³„ ì¶”ì¶œ ì§€ì •ìƒí’ˆ ì •ë³´
    const extractedClassCode = pe.classCode || '';
    
    // ë¶ˆì¼ì¹˜ ê°ì§€ (ì¶”ì¶œ ì •ë³´ê°€ ìžˆì„ ë•Œë§Œ)
    const hasExtracted = extractedClassCode || pe.designatedGoodsFromApp;
    const classCodeMismatch = hasExtracted && extractedClassCode && step2ClassCodes && extractedClassCode !== step2ClassCodes;
    
    return classCodeMismatch;
  };
  
  // ì§€ì •ìƒí’ˆ ì†ŒìŠ¤ ì„ íƒ
  TM.selectGoodsSource = function(useExtracted) {
    if (!TM.currentProject?.priorityExam) return;
    TM.currentProject.priorityExam.useExtractedGoods = useExtracted;
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
  };
  
  // ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ Blob ìƒì„± (í´ë¼ì´ì–¸íŠ¸ ì‚¬ì´ë“œ)
  TM.createPriorityDocBlob = async function(data) {
    // docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ (CDN) - UMD ë²„ì „ ì‚¬ìš©
    if (!window.docx) {
      console.log('[TM] docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì¤‘...');
      await TM.loadScript('https://unpkg.com/docx@8.2.2/build/index.umd.js');
      
      // ë¡œë“œ ëŒ€ê¸°
      let retries = 0;
      while (!window.docx && retries < 20) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }
      
      if (!window.docx) {
        throw new Error('docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì‹¤íŒ¨');
      }
      console.log('[TM] docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì™„ë£Œ');
    }
    
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
            AlignmentType, WidthType, BorderStyle, HeadingLevel } = window.docx;
    
    // í…Œì´ë¸” ìŠ¤íƒ€ì¼
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
    
    // ë¬¸ì„œ ìƒì„±
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'ë§‘ì€ ê³ ë”•', size: 22 }
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
          // ì œëª©
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: 'ìƒí‘œ ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì„¤ëª…ì„œ', bold: true, size: 32 })
            ]
          }),
          
          // ì„œì§€ì‚¬í•­
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'ã€ì„œì§€ì‚¬í•­ã€‘', bold: true, size: 24 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: `ã€ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì¸ã€‘ ${data.applicantName}`, size: 22 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: `ã€ì¶œì›ë²ˆí˜¸ã€‘ ${data.applicationNumber}`, size: 22 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: `ã€ì¶œì›ì¼ã€‘ ${data.applicationDate}`, size: 22 })]
          }),
          
          // ìƒí‘œê²¬ë³¸
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'ã€ìƒí‘œê²¬ë³¸ã€‘', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.trademarkName, bold: true, size: 28 })]
          }),
          
          // ìƒí’ˆë¥˜
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'ã€ìƒí’ˆë¥˜ã€‘', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.classCodeStr || '[ìƒí’ˆë¥˜]', size: 22 })]
          }),
          
          // ì§€ì •ìƒí’ˆ
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'ã€ì§€ì •ìƒí’ˆã€‘', bold: true, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: data.designatedGoodsStr || '[ì§€ì •ìƒí’ˆ]', size: 22 })]
          }),
          
          // ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì´ìœ 
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: 'ã€ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ì´ìœ ã€‘', bold: true, size: 24 })]
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
          
          // ì¦ë¹™ìžë£Œ
          ...(data.evidences.length > 0 ? [
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'ã€ì¦ë¹™ìžë£Œã€‘', bold: true, size: 24 })]
            }),
            ...data.evidences.map((ev, idx) => 
              new Paragraph({
                children: [new TextRun({ text: `ì²¨ë¶€ìžë£Œ ${idx + 1} : ${ev.title}`, size: 22 })]
              })
            )
          ] : [])
        ]
      }]
    });
    
    // Blobìœ¼ë¡œ ë³€í™˜
    const blob = await Packer.toBlob(doc);
    return blob;
  };
  
  // ìŠ¤í¬ë¦½íŠ¸ ë™ì  ë¡œë“œ
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
    if (!confirm('ì´ ì¦ê±°ìžë£Œë¥¼ ì‚­ì œí•˜ì‹œê² ìŠµë‹ˆê¹Œ?')) return;
    
    const evidence = TM.currentProject.priorityExam.evidences[index];
    
    // Storageì—ì„œ íŒŒì¼ ì‚­ì œ
    if (evidence.fileName) {
      try {
        await App.sb.storage
          .from('trademark-evidences')
          .remove([evidence.fileName]);
      } catch (e) {
        console.warn('[TM] íŒŒì¼ ì‚­ì œ ì‹¤íŒ¨:', e);
      }
    }
    
    TM.currentProject.priorityExam.evidences.splice(index, 1);
    TM.renderCurrentStep();
    App.showToast('ì¦ê±°ìžë£Œê°€ ì‚­ì œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
  };
  
  TM.generatePriorityDocument = async function() {
    const p = TM.currentProject;
    const pe = p.priorityExam;
    
    if (!pe.reason) {
      App.showToast('ìš°ì„ ì‹¬ì‚¬ ì‚¬ìœ ë¥¼ ì„ íƒí•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    try {
      App.showToast('ì„¤ëª…ì„œ ìƒì„± ì¤‘...', 'info');
      
      const reasonLabels = {
        using: 'ìƒí‘œë¥¼ ì´ë¯¸ ì‚¬ìš© ì¤‘ì¸ ê²½ìš°',
        preparing: 'ìƒí‘œ ì‚¬ìš© ì¤€ë¹„ ì¤‘ì¸ ê²½ìš°',
        infringement: 'ì œ3ìžê°€ ì •ë‹¹í•œ ê¶Œí•œ ì—†ì´ ìƒí‘œë¥¼ ì‚¬ìš©í•˜ê³  ìžˆëŠ” ê²½ìš°',
        export: 'ìˆ˜ì¶œì„ ìœ„í•´ ê¸´ê¸‰í•˜ê²Œ ìƒí‘œ ë“±ë¡ì´ í•„ìš”í•œ ê²½ìš°',
        other: 'ê¸°íƒ€ ê¸´ê¸‰í•œ ì‚¬ìœ '
      };
      
      const prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ ìž‘ì„± ì „ë¬¸ê°€ìž…ë‹ˆë‹¤. ë‹¤ìŒ ì •ë³´ë¥¼ ë°”íƒ•ìœ¼ë¡œ ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œë¥¼ ìž‘ì„±í•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}
- ì§€ì •ìƒí’ˆ: ${p.designatedGoods?.map(g => 'ì œ' + g.classCode + 'ë¥˜ (' + g.goods.map(gg => gg.name).join(', ') + ')').join('; ') || 'ë¯¸ì„ íƒ'}

[ì¶œì›ì¸ ì •ë³´]
- ì¶œì›ì¸: ${p.applicant?.name || '(ë¯¸ìž…ë ¥)'}
- ìœ í˜•: ${p.applicant?.type === 'corporation' ? 'ë²•ì¸' : p.applicant?.type === 'sme' ? 'ì¤‘ì†Œê¸°ì—…' : 'ê°œì¸'}

[ìš°ì„ ì‹¬ì‚¬ ì‚¬ìœ ]
- ì„ íƒëœ ì‚¬ìœ : ${reasonLabels[pe.reason]}
- ì²¨ë¶€ ì¦ê±°: ${pe.evidences?.length || 0}ê±´

[ì¦ê±°ìžë£Œ ëª©ë¡]
${(pe.evidences || []).map((ev, i) => `${i + 1}. ${ev.title} (${TM.getEvidenceTypeLabel(ev.type)})`).join('\n') || 'ì¦ê±°ìžë£Œ ì—†ìŒ'}

ë‹¤ìŒ êµ¬ì¡°ë¡œ ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œë¥¼ ìž‘ì„±í•˜ì„¸ìš”:

1. ì¶œì›ìƒí‘œì˜ ê°œìš”
2. ìš°ì„ ì‹¬ì‚¬ ì‹ ì²­ ì‚¬ìœ 
3. ìƒí‘œ ì‚¬ìš© í˜„í™© ë° ì¦ê±° ì„¤ëª…
4. ê²°ë¡  (ìš°ì„ ì‹¬ì‚¬ í—ˆì—¬ ìš”ì²­)

í•œêµ­ íŠ¹í—ˆì²­ í˜•ì‹ì— ë§žê²Œ ê³µì‹ì ì´ê³  ì„¤ë“ë ¥ ìžˆëŠ” ë¬¸ì²´ë¡œ ìž‘ì„±í•˜ì„¸ìš”.`;

      const response = await App.callClaude(prompt, 2000);
      
      pe.generatedDocument = response.text;
      TM.renderCurrentStep();
      
      App.showToast('ì„¤ëª…ì„œê°€ ìƒì„±ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] ì„¤ëª…ì„œ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
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
      App.showToast('í´ë¦½ë³´ë“œì— ë³µì‚¬ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
    });
  };
  
  TM.regeneratePriorityDoc = function() {
    if (!confirm('ì„¤ëª…ì„œë¥¼ ë‹¤ì‹œ ìƒì„±í•˜ì‹œê² ìŠµë‹ˆê¹Œ? í˜„ìž¬ ë‚´ìš©ì€ ì‚¬ë¼ì§‘ë‹ˆë‹¤.')) return;
    TM.generatePriorityDocument();
  };

  // ============================================================
  // Step 8: ë¬¸ì„œ ì¶œë ¥
  // ============================================================
  
  // Step 7: ì¢…í•© ìš”ì•½ (ëŒ€ì‹œë³´ë“œ)
  // ============================================================
  
  TM.renderStep7_Summary = function(container) {
    const p = TM.currentProject;
    const risk = p.riskAssessment || {};
    const fee = p.feeCalculation || {};
    const evaluations = p.similarityEvaluations || [];
    const allSearchResults = [...(p.searchResults.text || []), ...(p.searchResults.figure || [])];
    
    // ë¹„ìš© ê³„ì‚°
    if (p.designatedGoods?.length > 0 && !fee.totalFee) {
      TM.calculateFee();
    }
    
    container.innerHTML = `
      <div class="tm-step-header">
        <h3>ðŸ“‹ ì¢…í•© ìš”ì•½</h3>
      </div>
      
      <!-- ìš”ì•½ ëŒ€ì‹œë³´ë“œ -->
      <div class="tm-summary-dashboard">
        <!-- ìƒí‘œ ì •ë³´ ì¹´ë“œ -->
        <div class="tm-summary-card tm-card-trademark">
          <div class="tm-card-icon">ðŸ·ï¸</div>
          <div class="tm-card-content">
            <div class="tm-card-title">ìƒí‘œëª…</div>
            <div class="tm-card-value">${TM.escapeHtml(p.trademarkName) || '-'}</div>
            <div class="tm-card-sub">${TM.getTypeLabel(p.trademarkType)}</div>
          </div>
        </div>
        
        <!-- ì§€ì •ìƒí’ˆ ì¹´ë“œ -->
        <div class="tm-summary-card">
          <div class="tm-card-icon">ðŸ“¦</div>
          <div class="tm-card-content">
            <div class="tm-card-title">ì§€ì •ìƒí’ˆ</div>
            <div class="tm-card-value">${p.designatedGoods?.length || 0}ê°œ ë¥˜</div>
            <div class="tm-card-sub">${p.designatedGoods?.reduce((sum, g) => sum + g.goods.length, 0) || 0}ê°œ ìƒí’ˆ</div>
          </div>
        </div>
        
        <!-- ë¦¬ìŠ¤í¬ ì¹´ë“œ -->
        <div class="tm-summary-card tm-card-risk ${risk.level || ''}">
          <div class="tm-card-icon">${risk.level === 'high' ? 'âš ï¸' : risk.level === 'medium' ? 'âš¡' : risk.level === 'low' ? 'âœ…' : 'â“'}</div>
          <div class="tm-card-content">
            <div class="tm-card-title">ë¦¬ìŠ¤í¬</div>
            <div class="tm-card-value">${risk.level ? (risk.level === 'high' ? 'ë†’ìŒ' : risk.level === 'medium' ? 'ì£¼ì˜' : 'ë‚®ìŒ') : 'ë¯¸í‰ê°€'}</div>
            <div class="tm-card-sub">${risk.level ? 'ë“±ë¡ ê°€ëŠ¥ì„± ' + TM.getRiskProbability(risk.level) : '-'}</div>
          </div>
        </div>
        
        <!-- ë¹„ìš© ì¹´ë“œ -->
        <div class="tm-summary-card">
          <div class="tm-card-icon">ðŸ’°</div>
          <div class="tm-card-content">
            <div class="tm-card-title">ì˜ˆìƒ ë¹„ìš©</div>
            <div class="tm-card-value">${TM.formatNumber(fee.totalFee || 0)}ì›</div>
            <div class="tm-card-sub">${p.priorityExam?.enabled ? 'ìš°ì„ ì‹¬ì‚¬ í¬í•¨' : 'ì¼ë°˜ì‹¬ì‚¬'}</div>
          </div>
        </div>
      </div>
      
      <!-- ì„¸ë¶€ ì •ë³´ ì„¹ì…˜ë“¤ -->
      <div class="tm-summary-sections">
        <!-- ì¶œì›ì¸ ì •ë³´ -->
        ${p.applicant?.name ? `
          <div class="tm-summary-section">
            <h4>ðŸ‘¤ ì¶œì›ì¸</h4>
            <div class="tm-summary-info">
              <span>${TM.escapeHtml(p.applicant.name)}</span>
              ${p.managementNumber ? `<span class="tm-info-badge">ê´€ë¦¬ë²ˆí˜¸: ${TM.escapeHtml(p.managementNumber)}</span>` : 
                (TM.currentProject?.title ? `<span class="tm-info-badge">ê´€ë¦¬ë²ˆí˜¸: ${TM.escapeHtml(TM.currentProject.title)}</span>` : '')}
            </div>
          </div>
        ` : ''}
        
        <!-- ì§€ì •ìƒí’ˆ ìš”ì•½ -->
        ${p.designatedGoods?.length > 0 ? `
          <div class="tm-summary-section">
            <h4>ðŸ“¦ ì§€ì •ìƒí’ˆ ìš”ì•½</h4>
            <div class="tm-goods-summary-grid">
              ${p.designatedGoods.map(dg => `
                <div class="tm-goods-summary-item">
                  <span class="tm-class-badge">ì œ${dg.classCode}ë¥˜</span>
                  <span class="tm-goods-count">${dg.goods.length}ê°œ</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- ì„ í–‰ìƒí‘œ ê²€ìƒ‰ ê²°ê³¼ -->
        ${allSearchResults.length > 0 ? `
          <div class="tm-summary-section">
            <h4>ðŸ” ì„ í–‰ìƒí‘œ ê²€ìƒ‰</h4>
            <div class="tm-summary-stats">
              <span>ê²€ìƒ‰ ê²°ê³¼ ${allSearchResults.length}ê±´</span>
              <span>í‰ê°€ ì™„ë£Œ ${evaluations.length}ê±´</span>
              <span>ì¶©ëŒ ìš°ë ¤ ${risk.conflictCount || 0}ê±´</span>
            </div>
          </div>
        ` : ''}
        
        <!-- ë¹„ìš© ëª…ì„¸ -->
        ${fee.breakdown?.length > 0 ? `
          <div class="tm-summary-section">
            <h4>ðŸ’° ë¹„ìš© ëª…ì„¸</h4>
            <div class="tm-fee-summary">
              ${fee.breakdown.slice(0, 5).map(item => `
                <div class="tm-fee-item ${item.type === 'total' ? 'total' : ''}">
                  <span>${TM.escapeHtml(item.label)}</span>
                  <span>${TM.formatNumber(item.amount)}ì›</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      <!-- ë¬¸ì„œ ì¶œë ¥ -->
      <div class="tm-output-section">
        <h4>ðŸ“¥ ë¬¸ì„œ ë‹¤ìš´ë¡œë“œ</h4>
        <div class="tm-output-buttons">
          <button class="btn btn-primary" data-action="tm-download-docx">
            ðŸ“ ê²€í†  ë³´ê³ ì„œ (Word)
          </button>
          ${p.priorityExam?.enabled ? `
            <button class="btn btn-secondary" data-action="tm-generate-priority-doc">
              âš¡ ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ (Word)
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
        <h1>ìƒí‘œ ì¶œì› ê²€í†  ë³´ê³ ì„œ</h1>
        <p class="tm-doc-date">ìž‘ì„±ì¼: ${new Date().toLocaleDateString('ko-KR')}</p>
    `;
    
    if (includes.summary) {
      html += `
        <h2>1. í”„ë¡œì íŠ¸ ê°œìš”</h2>
        <table class="tm-doc-table">
          <tr><th>ìƒí‘œëª…</th><td>${TM.escapeHtml(p.trademarkName)}</td></tr>
          <tr><th>ì˜ë¬¸ëª…</th><td>${TM.escapeHtml(p.trademarkNameEn) || '-'}</td></tr>
          <tr><th>ìƒí‘œ ìœ í˜•</th><td>${TM.getTypeLabel(p.trademarkType)}</td></tr>
          <tr><th>ì¶œì›ì¸</th><td>${TM.escapeHtml(p.applicant?.name) || '-'}</td></tr>
        </table>
      `;
    }
    
    if (includes.goods && p.designatedGoods?.length > 0) {
      html += `<h2>2. ì§€ì •ìƒí’ˆ</h2>`;
      p.designatedGoods.forEach(classData => {
        html += `
          <h3>ì œ${classData.classCode}ë¥˜ - ${TM.escapeHtml(classData.className)}</h3>
          <ul>
            ${classData.goods.map(g => `<li>${TM.escapeHtml(g.name)} ${!g.gazetted ? '(ë¹„ê³ ì‹œ)' : ''}</li>`).join('')}
          </ul>
        `;
      });
    }
    
    if (includes.risk && p.riskAssessment?.level) {
      html += `
        <h2>3. ë¦¬ìŠ¤í¬ í‰ê°€</h2>
        <p><strong>ìœ„í—˜ ìˆ˜ì¤€:</strong> ${p.riskAssessment.level === 'high' ? 'ë†’ìŒ' : p.riskAssessment.level === 'medium' ? 'ì¤‘ê°„' : 'ë‚®ìŒ'}</p>
        <p><strong>ë“±ë¡ ê°€ëŠ¥ì„±:</strong> ${TM.getRiskProbability(p.riskAssessment.level)}</p>
        ${p.riskAssessment.details ? `<p>${TM.escapeHtml(p.riskAssessment.details)}</p>` : ''}
        ${p.riskAssessment.recommendation ? `<p><strong>ê¶Œê³ ì‚¬í•­:</strong> ${TM.escapeHtml(p.riskAssessment.recommendation)}</p>` : ''}
      `;
    }
    
    if (includes.fee && p.feeCalculation?.totalFee) {
      html += `
        <h2>4. ë¹„ìš© ëª…ì„¸</h2>
        <table class="tm-doc-table">
          ${p.feeCalculation.breakdown?.map(item => `
            <tr>
              <td>${TM.escapeHtml(item.label)}</td>
              <td style="text-align: right;">${item.type === 'reduction' ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}ì›</td>
            </tr>
          `).join('')}
        </table>
      `;
    }
    
    if (includes.priority && p.priorityExam?.enabled && p.priorityExam?.generatedDocument) {
      html += `
        <h2>5. ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ</h2>
        <div class="tm-doc-priority">${TM.formatPriorityDocument(p.priorityExam.generatedDocument)}</div>
      `;
    }
    
    html += `</div>`;
    
    return html;
  };
  
  TM.downloadDocx = async function() {
    try {
      App.showToast('ê²€í†  ë³´ê³ ì„œ ìƒì„± ì¤‘...', 'info');
      
      const p = TM.currentProject;
      if (!p || !p.trademarkName) {
        App.showToast('í”„ë¡œì íŠ¸ ì •ë³´ê°€ ì—†ìŠµë‹ˆë‹¤.', 'warning');
        return;
      }
      
      // docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ (CDN)
      if (!window.docx) {
        console.log('[TM] docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì¤‘...');
        await TM.loadScript('https://unpkg.com/docx@8.2.2/build/index.umd.js');
        let retries = 0;
        while (!window.docx && retries < 20) {
          await new Promise(r => setTimeout(r, 100));
          retries++;
        }
        if (!window.docx) {
          throw new Error('docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì‹¤íŒ¨. ë„¤íŠ¸ì›Œí¬ë¥¼ í™•ì¸í•˜ì„¸ìš”.');
        }
        console.log('[TM] docx ë¼ì´ë¸ŒëŸ¬ë¦¬ ë¡œë“œ ì™„ë£Œ');
      }
      
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, VerticalAlign, PageNumber, PageBreak
      } = window.docx;
      
      // â”€â”€â”€ ìƒ‰ìƒ â”€â”€â”€
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
      
      // â”€â”€â”€ ì…€ í—¬í¼ â”€â”€â”€
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
      
      // â”€â”€â”€ ë°ì´í„° ì¤€ë¹„ â”€â”€â”€
      const today = new Date();
      const dateStr = `${today.getFullYear()}ë…„ ${today.getMonth()+1}ì›” ${today.getDate()}ì¼`;
      const refNo = `TM-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}`;
      const firmName = TM.settings?.firmName || 'íŠ¹í—ˆë²•ë¥ ì‚¬ë¬´ì†Œ ë””ë”¤';
      const firmNameEn = TM.settings?.firmNameEn || 'PATENT GROUP DIDIM';
      const attorney = TM.settings?.attorneyName || p.applicant?.name || 'ë‹´ë‹¹ ë³€ë¦¬ì‚¬';
      
      const risk = p.riskAssessment || {};
      const fee = p.feeCalculation || {};
      const validation = p.aiAnalysis?.validation || {};
      const searchResults = p.searchResults || {};
      const designatedGoods = p.designatedGoods || [];
      const totalGoods = designatedGoods.reduce((s, g) => s + (g.goods?.length || 0), 0);
      
      // ê²€ìƒ‰ê²°ê³¼ ë¶„ì„
      const textResults = searchResults.text || [];
      const groupOverlap = textResults.filter(r => r.hasGroupOverlap);
      const noOverlap = textResults.filter(r => !r.hasGroupOverlap);
      const critical = groupOverlap.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');
      const medium = groupOverlap.filter(r => r.riskLevel === 'medium');
      const safe = groupOverlap.filter(r => r.riskLevel === 'low' || r.riskLevel === 'safe');
      
      const children = [];
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• í‘œì§€ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      children.push(gap(1200));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: firmName, font: 'Arial', size: 36, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
        children: [new TextRun({ text: firmNameEn, font: 'Arial', size: 22, color: C.gray400 })]
      }));
      children.push(gap(500));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
        children: [new TextRun({ text: 'ìƒí‘œ ì¶œì› ê²€í†  ë³´ê³ ì„œ', font: 'Arial', size: 48, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'Trademark Application Review Report', font: 'Arial', size: 22, color: C.gray400, italics: true })]
      }));
      children.push(gap(600));
      
      // í‘œì§€ í•˜ë‹¨ ì •ë³´
      const coverRows = [
        ['ë¬¸ì„œë²ˆí˜¸', refNo],
        ['ìž‘ ì„± ì¼', dateStr],
        ['ì¶œì›ìƒí‘œ', `${p.trademarkName || '-'}${p.trademarkNameEn ? ' / ' + p.trademarkNameEn : ''}`],
        ['ì¶œ ì› ì¸', p.applicant?.name || '-'],
        ['ë‹´ë‹¹ë³€ë¦¬ì‚¬', attorney],
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
        children: [new TextRun({ text: 'ë³¸ ë³´ê³ ì„œëŠ” ì˜ë¢°ì¸ì— ëŒ€í•œ ë²•ë¥  ê²€í†  ì˜ê²¬ìœ¼ë¡œì„œ ë¹„ë°€ ìœ ì§€ ëŒ€ìƒìž…ë‹ˆë‹¤.', font: 'Arial', size: 16, color: C.gray400, italics: true })]
      }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• I. ê²€í†  ìš”ì•½ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      children.push(secTitle('I', 'ê²€í†  ìš”ì•½ (Executive Summary)'));
      
      const riskLabel = risk.level === 'high' ? 'ë†’ìŒ (HIGH)' : risk.level === 'medium' ? 'ì¤‘ê°„ (MEDIUM)' : risk.level ? 'ë‚®ìŒ (LOW)' : 'ë¯¸í‰ê°€';
      const riskColor = risk.level === 'high' ? C.danger : risk.level === 'medium' ? C.warning : C.success;
      
      children.push(new Table({
        width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 7106],
        rows: [
          new TableRow({ children: [ lCell('ì¶œì›ìƒí‘œ', 2400), dCell(`${p.trademarkName || '-'}${p.trademarkNameEn ? ' (' + p.trademarkNameEn + ')' : ''}`, 7106, { bold: true }) ] }),
          new TableRow({ children: [ lCell('ìƒí‘œ ìœ í˜•', 2400), dCell(TM.getTypeLabel(p.trademarkType), 7106) ] }),
          new TableRow({ children: [ lCell('ì§€ì •ìƒí’ˆë¥˜', 2400), dCell(designatedGoods.map(g => `ì œ${g.classCode}ë¥˜(${g.className || TM.niceClasses?.[g.classCode] || ''})`).join(', ') || 'ë¯¸ì„ íƒ', 7106) ] }),
          new TableRow({ children: [ lCell('ì´ ì§€ì •ìƒí’ˆ ìˆ˜', 2400), dCell(`${totalGoods}ê°œ (${designatedGoods.length}ê°œ ë¥˜)`, 7106) ] }),
          new TableRow({ children: [ lCell('ë¦¬ìŠ¤í¬ ìˆ˜ì¤€', 2400), dCell(riskLabel, 7106, { bold: true, color: riskColor }) ] }),
          new TableRow({ children: [ lCell('ì¶©ëŒ ìš°ë ¤ ìƒí‘œ', 2400), dCell(`${risk.conflictCount || critical.length || 0}ê±´ (ìœ ì‚¬êµ° ì¤‘ë³µ ê¸°ì¤€)`, 7106, { color: C.danger }) ] }),
          ...(validation.overallScore ? [new TableRow({ children: [ lCell('AI ê²€ì¦ ì •í™•ë„', 2400), dCell(`${validation.overallScore}%${validation.summary ? ' â€” ' + validation.summary : ''}`, 7106) ] })] : []),
          ...(fee.totalFee ? [new TableRow({ children: [ lCell('ì˜ˆìƒ ì¶œì›ë¹„ìš©', 2400), dCell(`${TM.formatNumber(fee.totalFee)}ì›`, 7106, { bold: true }) ] })] : []),
          ...(risk.recommendation ? [new TableRow({ children: [ lCell('ì¢…í•© ì˜ê²¬', 2400), dCell(risk.recommendation.slice(0, 300), 7106) ] })] : []),
        ]
      }));
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• II. ì¶œì›ì¸ ì •ë³´ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      children.push(secTitle('II', 'ì¶œì›ì¸ ì •ë³´'));
      children.push(new Table({
        width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 2353, 2400, 2353],
        rows: [
          new TableRow({ children: [
            lCell('ì¶œì›ì¸ ëª…ì¹­', 2400), dCell(p.applicant?.name || '-', 2353),
            lCell('ëŒ€í‘œìž', 2400), dCell(p.applicant?.representative || '-', 2353)
          ] }),
          new TableRow({ children: [
            lCell('ì‚¬ì—…ìžë²ˆí˜¸', 2400), dCell(p.applicant?.bizNumber || '-', 2353),
            lCell('ì£¼ì†Œ', 2400), dCell(p.applicant?.address || '-', 2353)
          ] }),
        ]
      }));
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• III. ì‚¬ì—… ë¶„ì„ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (p.aiAnalysis?.businessAnalysis) {
        children.push(secTitle('III', 'ì‚¬ì—… ë¶„ì„ ê²°ê³¼'));
        children.push(bodyP('AI ì‚¬ì—… ë¶„ì„ ì‹œìŠ¤í…œì´ ì¶œì›ì¸ì˜ ì‚¬ì—… ë‚´ìš©ì„ ë¶„ì„í•œ ê²°ê³¼ëŠ” ì•„ëž˜ì™€ ê°™ìŠµë‹ˆë‹¤.'));
        
        const ana = p.aiAnalysis;
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 7106],
          rows: [
            new TableRow({ children: [ lCell('ì‚¬ì—… ë‚´ìš©', 2400), dCell(ana.businessAnalysis || '-', 7106) ] }),
            ...(ana.coreProducts?.length ? [new TableRow({ children: [ lCell('í•µì‹¬ ìƒí’ˆ', 2400), dCell(ana.coreProducts.join(', '), 7106) ] })] : []),
            ...(ana.coreServices?.length ? [new TableRow({ children: [ lCell('í•µì‹¬ ì„œë¹„ìŠ¤', 2400), dCell(ana.coreServices.join(', '), 7106) ] })] : []),
            ...(ana.businessTypes?.length ? [new TableRow({ children: [ lCell('ì‚¬ì—… ìœ í˜•', 2400), dCell(ana.businessTypes.join(', '), 7106) ] })] : []),
            ...(ana.expansionPotential?.length ? [new TableRow({ children: [ lCell('í™•ìž¥ ê°€ëŠ¥ ë¶„ì•¼', 2400), dCell(ana.expansionPotential.join(', '), 7106) ] })] : []),
          ]
        }));
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• IV. ì§€ì •ìƒí’ˆ ìƒì„¸ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (designatedGoods.length > 0) {
        children.push(secTitle('IV', 'ì§€ì •ìƒí’ˆ ìƒì„¸'));
        children.push(bodyP('ê° ìƒí’ˆë¥˜ë³„ ì§€ì •ìƒí’ˆ ë‚´ì—­ìž…ë‹ˆë‹¤. ëª¨ë“  ì§€ì •ìƒí’ˆì€ íŠ¹í—ˆì²­ ê³ ì‹œëª…ì¹­ ê¸°ì¤€ì´ë©°, ë¹„ê³ ì‹œëª…ì¹­ì€ ë³„ë„ í‘œê¸°í•˜ì˜€ìŠµë‹ˆë‹¤.'));
        children.push(gap(40));
        
        for (const classData of designatedGoods) {
          children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [
            new TextRun({ text: `ì œ${classData.classCode}ë¥˜`, font: 'Arial', size: 22, bold: true, color: C.accent }),
            new TextRun({ text: ` â€” ${classData.className || TM.niceClasses?.[classData.classCode] || ''}`, font: 'Arial', size: 22, color: C.primary }),
            new TextRun({ text: `  (${classData.goods?.length || 0}ê°œ)`, font: 'Arial', size: 18, color: C.gray400 }),
          ] }));
          
          const gRows = [new TableRow({ children: [
            hCell('No.', 600), hCell('ì§€ì •ìƒí’ˆ(ì„œë¹„ìŠ¤)ëª…', 5506), hCell('ìœ ì‚¬êµ°ì½”ë“œ', 1600), hCell('ê³ ì‹œì—¬ë¶€', 1800)
          ] })];
          
          (classData.goods || []).forEach((g, idx) => {
            const nonG = !g.gazetted;
            const bg = nonG ? C.lightYellow : (idx % 2 === 0 ? undefined : 'F8FAFC');
            gRows.push(new TableRow({ children: [
              dCell(String(idx + 1), 600, { align: AlignmentType.CENTER, bg }),
              dCell(g.name, 5506, { bg, color: nonG ? C.warning : C.black }),
              dCell(g.similarGroup || '-', 1600, { align: AlignmentType.CENTER, bg }),
              dCell(nonG ? 'ë¹„ê³ ì‹œ' : 'ê³ ì‹œëª…ì¹­', 1800, { align: AlignmentType.CENTER, bg, color: nonG ? C.danger : C.success }),
            ] }));
          });
          
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [600, 5506, 1600, 1800], rows: gRows }));
        }
        
        // ë¹„ê³ ì‹œ ê²½ê³ 
        const nonGazettedGoods = designatedGoods.flatMap(c => (c.goods || []).filter(g => !g.gazetted).map(g => `"${g.name}"(ì œ${c.classCode}ë¥˜)`));
        if (nonGazettedGoods.length > 0) {
          children.push(gap(60));
          children.push(noteBox(
            `${nonGazettedGoods.join(', ')}ì€(ëŠ”) ë¹„ê³ ì‹œëª…ì¹­ìž…ë‹ˆë‹¤. ì‹¬ì‚¬ê´€ íŒë‹¨ì— ë”°ë¼ ë³´ì • ìš”êµ¬ê°€ ìžˆì„ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.`,
            { prefix: 'âš  ìœ ì˜ì‚¬í•­: ' }
          ));
        }
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• V. AI 3ë‹¨ê³„ ê²€ì¦ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (validation.overallScore) {
        children.push(secTitle('V', 'AI 3ë‹¨ê³„ ê²€ì¦ ê²°ê³¼'));
        children.push(bodyP('AI ê²€ì¦ ì‹œìŠ¤í…œì´ ì¶”ì²œ ìƒí’ˆë¥˜ ë° ì§€ì •ìƒí’ˆì˜ ì í•©ì„±ì„ 3ë‹¨ê³„ë¡œ ê²€ì¦í•œ ê²°ê³¼ìž…ë‹ˆë‹¤.'));
        children.push(gap(40));
        
        // ê²€ì¦ ìš”ì•½ í…Œì´ë¸”
        const s1 = validation.stages?.classValidation;
        const s2 = validation.stages?.goodsValidation;
        const s3 = validation.stages?.missingReview;
        
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [2400, 2369, 2369, 2368],
          rows: [
            new TableRow({ children: [ hCell('ê²€ì¦ í•­ëª©', 2400), hCell('1ë‹¨ê³„: ë¥˜ ê²€ì¦', 2369), hCell('2ë‹¨ê³„: ìƒí’ˆ ê²€ì¦', 2369), hCell('3ë‹¨ê³„: ëˆ„ë½ ê²€í† ', 2368) ] }),
            new TableRow({ children: [
              lCell('ê²€ì¦ ë‚´ìš©', 2400),
              dCell('ì¶”ì²œ ë¥˜ê°€ ì‚¬ì—… ë‚´ìš©ì— ì í•©í•œì§€', 2369),
              dCell('ì§€ì •ìƒí’ˆì´ ì •í™•í•œ ê³ ì‹œëª…ì¹­ì¸ì§€', 2369),
              dCell('ëˆ„ë½ëœ ë¥˜ ë˜ëŠ” ìƒí’ˆì´ ìžˆëŠ”ì§€', 2368),
            ] }),
            new TableRow({ children: [
              lCell('ê²°ê³¼', 2400),
              dCell(validation.invalidClasses?.length ? `${validation.invalidClasses.length}ê±´ ë¶€ì í•©` : 'ì í•©', 2369, { color: validation.invalidClasses?.length ? C.danger : C.success }),
              dCell(validation.invalidGoods?.length ? `${validation.invalidGoods.length}ê±´ ë³´ì •` : 'ì í•©', 2369, { color: validation.invalidGoods?.length ? C.warning : C.success }),
              dCell(validation.missingClasses?.length ? `${validation.missingClasses.length}ê±´ ì¶”ê°€ ê¶Œìž¥` : 'ëˆ„ë½ ì—†ìŒ', 2368, { color: validation.missingClasses?.length ? C.accent : C.success }),
            ] }),
          ]
        }));
        
        children.push(gap(60));
        children.push(new Paragraph({ spacing: { before: 40, after: 100 }, children: [
          new TextRun({ text: 'ì¢…í•© ì •í™•ë„: ', font: 'Arial', size: 20, bold: true, color: C.primary }),
          new TextRun({ text: `${validation.overallScore}%`, font: 'Arial', size: 24, bold: true, color: C.success }),
        ] }));
        
        // ì œê±°ëœ ë¥˜
        if (validation.invalidClasses?.length > 0) {
          children.push(subHead('ì œê±°ëœ ìƒí’ˆë¥˜'));
          const icRows = [new TableRow({ children: [ hCell('ë¥˜', 1200), hCell('ì‚¬ìœ ', 8306) ] })];
          validation.invalidClasses.forEach(c => {
            icRows.push(new TableRow({ children: [ dCell(`ì œ${c.class}ë¥˜`, 1200, { align: AlignmentType.CENTER, bg: C.lightRed, bold: true }), dCell(c.reason, 8306, { bg: C.lightRed }) ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1200, 8306], rows: icRows }));
        }
        
        // ë³´ì • ë‚´ì—­
        if (validation.invalidGoods?.length > 0 || validation.replacementGoods?.length > 0) {
          children.push(subHead('ë³´ì • ë‚´ì—­'));
          const igRows = [new TableRow({ children: [ hCell('ë¥˜', 1000), hCell('ì œê±° ìƒí’ˆ', 3203), hCell('ëŒ€ì²´ ìƒí’ˆ', 3203), hCell('ì‚¬ìœ ', 2100) ] })];
          
          (validation.replacementGoods || []).forEach(r => {
            igRows.push(new TableRow({ children: [
              dCell(`ì œ${r.classCode}ë¥˜`, 1000, { align: AlignmentType.CENTER }),
              dCell(r.remove || r.goodsName || '-', 3203, { color: C.danger }),
              dCell(r.addInstead || '-', 3203, { color: C.success, bold: true }),
              dCell(r.reason || '-', 2100),
            ] }));
          });
          (validation.invalidGoods || []).filter(g => !(validation.replacementGoods || []).some(r => r.classCode === g.classCode && r.remove === g.goodsName)).forEach(g => {
            igRows.push(new TableRow({ children: [
              dCell(`ì œ${g.classCode}ë¥˜`, 1000, { align: AlignmentType.CENTER }),
              dCell(g.goodsName, 3203, { color: C.danger }),
              dCell('-', 3203),
              dCell(g.reason || '-', 2100),
            ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1000, 3203, 3203, 2100], rows: igRows }));
        }
        
        // ì¶”ê°€ ê¶Œìž¥ ë¥˜
        if (validation.missingClasses?.length > 0 || validation.suggestions?.filter(s => s.type === 'add_class')?.length > 0) {
          children.push(subHead('ì¶”ê°€ ê¶Œìž¥ ë¥˜'));
          const suggestions = validation.suggestions?.filter(s => s.type === 'add_class') || validation.missingClasses || [];
          const mcRows = [new TableRow({ children: [ hCell('ë¥˜', 1200), hCell('ìš°ì„ ìˆœìœ„', 1800), hCell('ì¶”ê°€ ê¶Œìž¥ ì‚¬ìœ ', 6506) ] })];
          suggestions.forEach(s => {
            mcRows.push(new TableRow({ children: [
              dCell(`ì œ${s.class}ë¥˜`, 1200, { align: AlignmentType.CENTER, bold: true }),
              dCell(s.priority || 'ê¶Œìž¥', 1800, { color: C.warning }),
              dCell(s.reason || '-', 6506),
            ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [1200, 1800, 6506], rows: mcRows }));
        }
        
        // ê²½ê³  ì‚¬í•­
        if (validation.warnings?.length > 0) {
          children.push(subHead('í™•ì¸ í•„ìš” ì‚¬í•­'));
          validation.warnings.forEach(w => {
            children.push(noteBox(
              `ì œ${w.class}ë¥˜: ${w.message}`,
              { prefix: 'âš  ', bg: C.lightYellow }
            ));
          });
        }
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• VI. ì„ í–‰ìƒí‘œ ì¡°ì‚¬ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (searchResults.searchedAt || textResults.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(secTitle('VI', 'ì„ í–‰ìƒí‘œ ì¡°ì‚¬ ê²°ê³¼'));
        children.push(bodyP('KIPRIS(í•œêµ­íŠ¹í—ˆì •ë³´ì›) ë°ì´í„°ë² ì´ìŠ¤ë¥¼ ê¸°ë°˜ìœ¼ë¡œ ì„ í–‰ìƒí‘œë¥¼ ì¡°ì‚¬í•œ ê²°ê³¼ìž…ë‹ˆë‹¤. ìœ ì‚¬êµ° ì½”ë“œ ì¤‘ë³µ ì—¬ë¶€ë¥¼ ê¸°ì¤€ìœ¼ë¡œ ì‹¤ì§ˆì  ì¶©ëŒ ìœ„í—˜ì„ ë¶„ì„í•˜ì˜€ìŠµë‹ˆë‹¤.'));
        children.push(gap(40));
        
        // ì¡°ì‚¬ ìš”ì•½
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3169, 3169, 3168],
          rows: [
            new TableRow({ children: [ hCell('êµ¬ë¶„', 3169), hCell('ê±´ìˆ˜', 3169), hCell('ë¹„ê³ ', 3168) ] }),
            new TableRow({ children: [ lCell('ì´ ê²€ìƒ‰ ê²°ê³¼', 3169), dCell(`${textResults.length}ê±´`, 3169, { align: AlignmentType.CENTER }), dCell('ë¬¸ìž + ë„í˜• ê²€ìƒ‰ í†µí•©', 3168) ] }),
            new TableRow({ children: [ dCell('ìœ ì‚¬êµ° ë¹„ì¤‘ë³µ (ì•ˆì „)', 3169, { color: C.success }), dCell(`${noOverlap.length}ê±´`, 3169, { align: AlignmentType.CENTER }), dCell('ìƒí‘œëª… ë™ì¼í•´ë„ ë“±ë¡ ê°€ëŠ¥', 3168) ] }),
            new TableRow({ children: [ dCell('ìœ ì‚¬êµ° ì¤‘ë³µ (ê²€í†  í•„ìš”)', 3169, { color: C.warning, bold: true }), dCell(`${groupOverlap.length}ê±´`, 3169, { align: AlignmentType.CENTER, bold: true }), dCell('ì•„ëž˜ ìƒì„¸ ë¶„ì„ ì°¸ì¡°', 3168) ] }),
          ]
        }));
        
        // ìœ„í—˜ë“±ê¸‰ë³„ ë¶„ë¥˜
        children.push(gap(40));
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3500, 1506, 4500],
          rows: [
            new TableRow({ children: [ hCell('ìœ„í—˜ ë“±ê¸‰', 3500), hCell('ê±´ìˆ˜', 1506), hCell('ì˜ë¯¸', 4500) ] }),
            new TableRow({ children: [ dCell('ê³ ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬)', 3500, { color: C.danger, bold: true, bg: C.lightRed }), dCell(`${critical.length}ê±´`, 1506, { align: AlignmentType.CENTER, bold: true, color: C.danger, bg: C.lightRed }), dCell('ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ, ì˜ê²¬ì„œ ì¤€ë¹„ í•„ìš”', 4500, { bg: C.lightRed }) ] }),
            new TableRow({ children: [ dCell('ì¤‘ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ë‹¤ì†Œ ìœ ì‚¬)', 3500, { color: C.warning, bg: C.lightYellow }), dCell(`${medium.length}ê±´`, 1506, { align: AlignmentType.CENTER, color: C.warning, bg: C.lightYellow }), dCell('ì‹¬ì‚¬ê´€ íŒë‹¨ í•„ìš”, ì°¨ë³„ì„± ë…¼ê±° ì¤€ë¹„', 4500, { bg: C.lightYellow }) ] }),
            new TableRow({ children: [ dCell('ì €ìœ„í—˜ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìƒì´)', 3500, { color: C.success, bg: C.lightGreen }), dCell(`${safe.length}ê±´`, 1506, { align: AlignmentType.CENTER, color: C.success, bg: C.lightGreen }), dCell('ë“±ë¡ ê°€ëŠ¥ì„± ë†’ìŒ', 4500, { bg: C.lightGreen }) ] }),
          ]
        }));
        
        // ì¶©ëŒ ìƒí‘œ ìƒì„¸
        const conflictAll = [...critical, ...medium].slice(0, 10);
        if (conflictAll.length > 0) {
          children.push(subHead('ì£¼ìš” ì¶©ëŒ ìš°ë ¤ ìƒí‘œ ìƒì„¸'));
          const cfRows = [new TableRow({ children: [
            hCell('No.', 500), hCell('ìœ„í—˜ë„', 1100), hCell('ìƒí‘œëª…', 2200), hCell('ì¶œì›ë²ˆí˜¸', 1806),
            hCell('ìƒíƒœ', 900), hCell('ìœ ì‚¬ë„', 1100), hCell('ì¤‘ë³µìœ ì‚¬êµ°', 1900)
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
              dCell(isCrit ? 'ê³ ìœ„í—˜' : 'ì¤‘ìœ„í—˜', 1100, { align: AlignmentType.CENTER, bg, color: isCrit ? C.danger : C.warning, bold: true }),
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
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• VII. ë¦¬ìŠ¤í¬ ì¢…í•© í‰ê°€ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (risk.level) {
        children.push(secTitle('VII', 'ë¦¬ìŠ¤í¬ ì¢…í•© í‰ê°€'));
        
        const rBg = risk.level === 'high' ? C.lightRed : risk.level === 'medium' ? C.lightYellow : C.lightGreen;
        const rLbl = risk.level === 'high' ? 'ë†’ìŒ (HIGH) â€” ê±°ì ˆ ê°€ëŠ¥ì„± ìƒë‹¹' :
                     risk.level === 'medium' ? 'ì¤‘ê°„ (MEDIUM) â€” ì‹¬ì‚¬ê´€ íŒë‹¨ì— ë”°ë¼ ë“±ë¡ ê°€ëŠ¥' : 'ë‚®ìŒ (LOW) â€” ë“±ë¡ ê°€ëŠ¥ì„± ë†’ìŒ';
        
        // ë¦¬ìŠ¤í¬ ë°°ë„ˆ
        children.push(new Table({
          width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [TABLE_W],
          rows: [new TableRow({ children: [new TableCell({
            borders, width: { size: TABLE_W, type: WidthType.DXA },
            shading: { fill: rBg, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
                children: [new TextRun({ text: 'ì¢…í•© ë¦¬ìŠ¤í¬ ë“±ê¸‰', font: 'Arial', size: 20, color: C.gray600 })]
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
            new TableRow({ children: [ lCell('ìƒì„¸ ë¶„ì„', 2400), dCell(risk.details || '-', 7106) ] }),
            new TableRow({ children: [ lCell('ì¶©ëŒ ìƒí‘œ ìˆ˜', 2400), dCell(`${risk.conflictCount || 0}ê±´ (ìœ ì‚¬êµ° ì¤‘ë³µ + ìƒí‘œ ìœ ì‚¬ ê¸°ì¤€)`, 7106, { bold: true, color: C.danger }) ] }),
          ]
        }));
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• VIII. ê¶Œê³ ì‚¬í•­ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (risk.recommendation) {
        children.push(secTitle('VIII', 'ê¶Œê³ ì‚¬í•­'));
        
        // ê¶Œê³ ì‚¬í•­ íŒŒì‹± (ë²ˆí˜¸ë³„ ë¶„ë¦¬ ì‹œë„)
        const recText = risk.recommendation;
        const recParts = recText.split(/\d+[\)\.]\s*/).filter(Boolean);
        
        if (recParts.length > 1) {
          const recRows = [new TableRow({ children: [ hCell('No.', 600), hCell('ê¶Œê³  ë‚´ìš©', 8906) ] })];
          recParts.forEach((part, idx) => {
            recRows.push(new TableRow({ children: [ dCell(String(idx + 1), 600, { align: AlignmentType.CENTER }), dCell(part.trim(), 8906) ] }));
          });
          children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [600, 8906], rows: recRows }));
        } else {
          children.push(bodyP(recText));
        }
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• IX. ë¹„ìš© ëª…ì„¸ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (fee.totalFee) {
        children.push(secTitle('IX', 'ë¹„ìš© ëª…ì„¸'));
        children.push(subHead('ì¶œì› ë¹„ìš©'));
        
        const fRows = [new TableRow({ children: [ hCell('í•­ëª©', 4700), hCell('ê¸ˆì•¡', 2403), hCell('ë¹„ê³ ', 2403) ] })];
        (fee.breakdown || []).forEach(item => {
          const isRed = item.type === 'reduction';
          fRows.push(new TableRow({ children: [
            dCell(item.label, 4700, { color: isRed ? C.success : C.black }),
            dCell(`${isRed ? '-' : ''}${TM.formatNumber(Math.abs(item.amount))}ì›`, 2403, { align: AlignmentType.RIGHT, color: isRed ? C.success : C.black, bold: isRed }),
            dCell(item.note || '', 2403),
          ] }));
        });
        
        // í•©ê³„
        fRows.push(new TableRow({ children: [
          new TableCell({ borders, width: { size: 4700, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ children: [new TextRun({ text: 'ì¶œì› í•©ê³„', font: 'Arial', size: 20, bold: true, color: C.primary })] })]
          }),
          new TableCell({ borders, width: { size: 2403, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${TM.formatNumber(fee.totalFee)}ì›`, font: 'Arial', size: 22, bold: true, color: C.primary })] })]
          }),
          new TableCell({ borders, width: { size: 2403, type: WidthType.DXA }, shading: { fill: C.lightBg, type: ShadingType.CLEAR }, margins: cellM,
            children: [new Paragraph({ children: [new TextRun({ text: 'ê°ë©´ ì ìš© í›„', font: 'Arial', size: 18, color: C.gray600 })] })]
          }),
        ] }));
        
        children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [4700, 2403, 2403], rows: fRows }));
        
        children.push(gap(40));
        children.push(noteBox(
          'ìƒê¸° ë¹„ìš©ì€ íŠ¹í—ˆì²­ ê´€ë‚©ë£Œ ê¸°ì¤€ì´ë©°, ëŒ€ë¦¬ì¸ ìˆ˜ìˆ˜ë£ŒëŠ” ë³„ë„ìž…ë‹ˆë‹¤. ë“±ë¡ë£ŒëŠ” ë“±ë¡ ê²°ì • ì‹œ ë‚©ë¶€í•˜ë©°, ë¶„ë‚©(5ë…„ë¶„)ë„ ê°€ëŠ¥í•©ë‹ˆë‹¤.',
          { prefix: 'â€» ì°¸ê³ : ', bg: C.lightBlue, prefixColor: C.accent }
        ));
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• X. í–¥í›„ ì ˆì°¨ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(secTitle('X', 'í–¥í›„ ì ˆì°¨ ë° ì¼ì •'));
      
      const procRows = [
        new TableRow({ children: [ hCell('ë‹¨ê³„', 600), hCell('ì ˆì°¨', 2400), hCell('ì˜ˆìƒ ì†Œìš” ê¸°ê°„', 3253), hCell('ë¹„ê³ ', 3253) ] }),
        ['1', 'ì¶œì›ì„œ ì œì¶œ', 'ì˜ë¢°ì¸ ìŠ¹ì¸ í›„ ì¦‰ì‹œ', 'ì „ìžì¶œì› (íŠ¹í—ˆë¡œ)'],
        ['2', 'ë°©ì‹ì‹¬ì‚¬', 'ì¶œì› í›„ ì•½ 1~2ì£¼', 'ì„œë¥˜ ë³´ì • ìš”êµ¬ ê°€ëŠ¥'],
        ['3', 'ì‹¤ì²´ì‹¬ì‚¬', 'ì¶œì› í›„ ì•½ 10~14ê°œì›”', 'ìš°ì„ ì‹¬ì‚¬ ì‹œ ì•½ 2~3ê°œì›”'],
        ['4', 'ê±°ì ˆì´ìœ í†µì§€ (ì˜ˆìƒ)', 'ì‹¬ì‚¬ ì¤‘ ë°œìƒ ì‹œ', 'ì˜ê²¬ì„œ ì œì¶œ ê¸°í•œ: 2ê°œì›”'],
        ['5', 'ë“±ë¡ê²°ì •', 'ì‹¬ì‚¬ ì™„ë£Œ í›„', 'ë“±ë¡ë£Œ ë‚©ë¶€ ê¸°í•œ: 2ê°œì›”'],
        ['6', 'ë“±ë¡ê³µê³ ', 'ë“±ë¡ í›„ ì•½ 1ê°œì›”', 'ì´ì˜ì‹ ì²­ ê¸°ê°„: ê³µê³ ì¼ë¡œë¶€í„° 2ê°œì›”'],
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
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ìš°ì„ ì‹¬ì‚¬ (ìžˆì„ ê²½ìš°) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (p.priorityExam?.enabled && p.priorityExam?.generatedDocument) {
        children.push(secTitle('XI', 'ìš°ì„ ì‹¬ì‚¬ ì„¤ëª…ì„œ'));
        const lines = p.priorityExam.generatedDocument.split('\n').filter(l => l.trim());
        lines.forEach(line => { children.push(bodyP(line)); });
      }
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ë©´ì±…ì¡°í•­ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      children.push(gap(300));
      children.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder, space: 12 } },
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: 'ë©´ì±…ì¡°í•­ (Disclaimer)', font: 'Arial', size: 20, bold: true, color: C.primary })]
      }));
      
      const disclaimers = [
        `1. ë³¸ ë³´ê³ ì„œëŠ” ${firmName}(ì´í•˜ "ë³¸ ì‚¬ë¬´ì†Œ")ì´ ì˜ë¢°ì¸ì˜ ìš”ì²­ì— ë”°ë¼ ìž‘ì„±í•œ ìƒí‘œ ì¶œì› ê²€í†  ì˜ê²¬ì„œë¡œì„œ, ìƒí‘œ ë“±ë¡ì˜ ì„±ê³µì„ ë³´ìž¥í•˜ëŠ” ë¬¸ì„œê°€ ì•„ë‹™ë‹ˆë‹¤.`,
        '2. ë³¸ ë³´ê³ ì„œì— í¬í•¨ëœ ë¦¬ìŠ¤í¬ í‰ê°€ ë° ë“±ë¡ ê°€ëŠ¥ì„± ë¶„ì„ì€ ë³¸ ì‚¬ë¬´ì†Œì˜ ì „ë¬¸ì  íŒë‹¨ê³¼ AI ë¶„ì„ ì‹œìŠ¤í…œì˜ ë³´ì¡°ì  ê²°ê³¼ë¥¼ ì¢…í•©í•œ ê²ƒì´ë©°, ìµœì¢… ì‹¬ì‚¬ ê²°ê³¼ëŠ” íŠ¹í—ˆì²­ ì‹¬ì‚¬ê´€ì˜ íŒë‹¨ì— ë”°ë¼ ë‹¬ë¼ì§ˆ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.',
        '3. AI ê¸°ë°˜ ë¶„ì„ ê²°ê³¼(ì‚¬ì—… ë¶„ì„, ìƒí’ˆë¥˜ ì¶”ì²œ, ìœ ì‚¬ë„ í‰ê°€ ë“±)ëŠ” ì°¸ê³  ëª©ì ì˜ ë³´ì¡° ìžë£Œì´ë©°, ë³€ë¦¬ì‚¬ì˜ ì „ë¬¸ ê²€í† ë¥¼ ê±°ì³ ìµœì¢… í™•ì •ë©ë‹ˆë‹¤.',
        '4. ì„ í–‰ìƒí‘œ ì¡°ì‚¬ëŠ” KIPRIS ë°ì´í„°ë² ì´ìŠ¤ë¥¼ ê¸°ë°˜ìœ¼ë¡œ ìˆ˜í–‰ë˜ì—ˆìœ¼ë©°, ì¡°ì‚¬ ì‹œì  ì´í›„ ì¶œì›/ë“±ë¡ëœ ìƒí‘œ ë˜ëŠ” ë¯¸ê³µê°œ ìƒí‘œëŠ” ë°˜ì˜ë˜ì§€ ì•Šì„ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.',
        '5. ë¹„ìš© ëª…ì„¸ëŠ” ë³´ê³ ì„œ ìž‘ì„±ì¼ ê¸°ì¤€ íŠ¹í—ˆì²­ ê´€ë‚©ë£Œì´ë©°, ë²•ë ¹ ê°œì •ì— ë”°ë¼ ë³€ê²½ë  ìˆ˜ ìžˆìŠµë‹ˆë‹¤. ëŒ€ë¦¬ì¸ ìˆ˜ìˆ˜ë£ŒëŠ” ë³„ë„ ì•ˆë‚´í•©ë‹ˆë‹¤.',
        '6. ë³¸ ë³´ê³ ì„œëŠ” ì˜ë¢°ì¸ê³¼ ë³¸ ì‚¬ë¬´ì†Œ ê°„ì˜ ë¹„ë°€ìœ ì§€ ëŒ€ìƒ ë¬¸ì„œì´ë©°, ì˜ë¢°ì¸ì˜ ì‚¬ì „ ë™ì˜ ì—†ì´ ì œ3ìžì—ê²Œ ê³µê°œí•˜ê±°ë‚˜ ë°°í¬í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.',
        '7. ë³¸ ë³´ê³ ì„œì˜ ë‚´ìš©ì€ ìž‘ì„±ì¼ ê¸°ì¤€ì˜ ë²•ë ¹, ì‹¬ì‚¬ê¸°ì¤€ ë° íŒë¡€ì— ê¸°ì´ˆí•˜ê³  ìžˆìœ¼ë©°, ì´í›„ ë³€ê²½ëœ ì‚¬í•­ì€ ë°˜ì˜ë˜ì§€ ì•Šì„ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.',
      ];
      disclaimers.forEach(text => {
        children.push(new Paragraph({ spacing: { before: 40, after: 40, line: 280 },
          children: [new TextRun({ text, font: 'Arial', size: 16, color: C.gray600 })]
        }));
      });
      
      // ì„œëª…ëž€
      children.push(gap(200));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: dateStr, font: 'Arial', size: 20, color: C.black })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 },
        children: [new TextRun({ text: firmName, font: 'Arial', size: 22, bold: true, color: C.primary })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 20 },
        children: [new TextRun({ text: `ë‹´ë‹¹ ë³€ë¦¬ì‚¬  ${attorney}`, font: 'Arial', size: 20, color: C.black })]
      }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: '(ì§ì¸ ìƒëžµ)', font: 'Arial', size: 16, color: C.gray400, italics: true })]
      }));
      
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ë¬¸ì„œ ì¡°ë¦½ â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
                children: [new TextRun({ text: `${firmName}  |  ìƒí‘œ ì¶œì› ê²€í†  ë³´ê³ ì„œ`, font: 'Arial', size: 14, color: C.gray400, italics: true })]
              })]
            })
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.tableBorder, space: 8 } },
                children: [
                  new TextRun({ text: `ë¬¸ì„œë²ˆí˜¸: ${refNo}  |  - `, font: 'Arial', size: 14, color: C.gray400 }),
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
      a.download = `ìƒí‘œê²€í† ë³´ê³ ì„œ_${p.trademarkName || 'unnamed'}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      App.showToast('ê²€í†  ë³´ê³ ì„œê°€ ë‹¤ìš´ë¡œë“œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] Word ë³´ê³ ì„œ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('ë³´ê³ ì„œ ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };

})();
/* ============================================================
   ìƒí‘œì¶œì› ìš°ì„ ì‹¬ì‚¬ ìžë™í™” ì‹œìŠ¤í…œ - AI ë¶„ì„ ê¸°ëŠ¥
   ë¹„ì¦ˆë‹ˆìŠ¤ ë¶„ì„, ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„, ìœ ì‚¬ë„ í‰ê°€ ë“±
   ============================================================ */

(function() {
  'use strict';
  
  const TM = window.TM;
  if (!TM) {
    console.error('[TM AI] TM ëª¨ë“ˆì´ ë¡œë“œë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.');
    return;
  }

  // ============================================================
  // ì‹¤ë¬´ ê°€ì´ë“œë¼ì¸ (LLM í”„ë¡¬í”„íŠ¸ì— í¬í•¨ë  ì°¸ê³  ì •ë³´)
  // - í•˜ë“œì½”ë”©ëœ ê·œì¹™ì´ ì•„ë‹Œ, LLMì´ ì°¸ê³ í•˜ëŠ” ì‹¤ë¬´ ì§€ì‹
  // ============================================================
  TM.PRACTICE_GUIDELINES = `
ã€ìƒí‘œì¶œì› ì§€ì •ìƒí’ˆ ì„ íƒ - ì¼ë°˜í™”ëœ íŒë‹¨ í”„ë ˆìž„ì›Œí¬ã€‘

â–  í•µì‹¬ ì›ì¹™
1. ìƒí’ˆ(1-34ë¥˜)ê³¼ ì„œë¹„ìŠ¤(35-45ë¥˜)ëŠ” ëª…í™•ížˆ ë¶„ë¦¬ëœ ê°œë…
2. ê°™ì€ ìž¥ì†Œ/ì‚¬ì—…ì²´ë¼ë„ ìƒí’ˆê³¼ ì„œë¹„ìŠ¤ëŠ” ë³„ë„ ë“±ë¡ í•„ìš”
3. ì‹¬ì‚¬ì™€ ì¹¨í•´íŒë‹¨ì˜ í•µì‹¬ ê¸°ì¤€ì€ "ìœ ì‚¬êµ°ì½”ë“œ"
4. 3ë…„ ì´ìƒ ë¯¸ì‚¬ìš© ì‹œ ë¶ˆì‚¬ìš©ì·¨ì†Œì‹¬íŒ ê°€ëŠ¥ â†’ ì‹¤ì œ ì‚¬ìš© ê°€ëŠ¥ì„± ê³ ë ¤

â–  ê° ìƒí’ˆë¥˜ íŒë‹¨ ê¸°ì¤€ (1-45ë¥˜)

ã€ìƒí’ˆë¥˜ 1-34ë¥˜ ê³µí†µã€‘
- í•´ë‹¹ ìƒí’ˆì„ ì§ì ‘ ì œì¡°/ìƒì‚°í•˜ë©´ â†’ í•´ë‹¹ ë¥˜ í•„ìš”
- í•´ë‹¹ ìƒí’ˆì„ êµ¬ë§¤í•´ì„œ íŒë§¤ë§Œ í•˜ë©´ â†’ í•´ë‹¹ ë¥˜ ë¶ˆí•„ìš”, 35ë¥˜ë§Œ í•„ìš”
- í•´ë‹¹ ìƒí’ˆì„ ì œì¡°+íŒë§¤í•˜ë©´ â†’ í•´ë‹¹ ë¥˜ + 35ë¥˜ ë‘˜ ë‹¤ í•„ìš”
- OEM/ODMìœ¼ë¡œ íƒ€ì‚¬ ë¸Œëžœë“œ ì œì¡°ë§Œ â†’ í•´ë‹¹ ë¥˜ë§Œ í•„ìš”, 35ë¥˜ ë¶ˆí•„ìš”

ã€1ë¥˜ - í™”í•™ì œí’ˆã€‘í•„ìš”: í™”í•™ì œí’ˆ ì œì¡°ì—… / ë¶ˆí•„ìš”: í™”í•™ì œí’ˆ ë‹¨ìˆœ ìœ í†µ
ã€2ë¥˜ - íŽ˜ì¸íŠ¸ã€‘í•„ìš”: ë„ë£Œ ì œì¡°ì—… / ë¶ˆí•„ìš”: íŽ˜ì¸íŠ¸ ì†Œë§¤ì 
ã€3ë¥˜ - í™”ìž¥í’ˆ/ì„¸ì œã€‘í•„ìš”: í™”ìž¥í’ˆ ì œì¡°, ìžì²´ ë¸Œëžœë“œ í™”ìž¥í’ˆ / ë¶ˆí•„ìš”: í™”ìž¥í’ˆ íŽ¸ì§‘ìƒµ(35ë¥˜ë§Œ)
ã€4ë¥˜ - ì—°ë£Œ/ìœ¤í™œìœ ã€‘í•„ìš”: ì •ìœ ì—…, ìœ¤í™œìœ  ì œì¡° / ë¶ˆí•„ìš”: ì£¼ìœ ì†Œ(ì„œë¹„ìŠ¤)
ã€5ë¥˜ - ì˜ì•½í’ˆã€‘í•„ìš”: ì œì•½íšŒì‚¬ / ë¶ˆí•„ìš”: ì•½êµ­(44ë¥˜ ì„œë¹„ìŠ¤)
ã€6ë¥˜ - ê¸ˆì†ìž¬ë£Œã€‘í•„ìš”: ê¸ˆì† ê°€ê³µì—… / ë¶ˆí•„ìš”: ì² ë¬¼ì (35ë¥˜ë§Œ)
ã€7ë¥˜ - ê¸°ê³„ã€‘í•„ìš”: ê¸°ê³„ ì œì¡°ì—… / ë¶ˆí•„ìš”: ê¸°ê³„ ìž„ëŒ€(39ë¥˜)
ã€8ë¥˜ - ìˆ˜ê³µêµ¬ã€‘í•„ìš”: ê³µêµ¬ ì œì¡° / ë¶ˆí•„ìš”: ê³µêµ¬ íŒë§¤ì (35ë¥˜ë§Œ)
ã€9ë¥˜ - ì „ìžê¸°ê¸°/ì†Œí”„íŠ¸ì›¨ì–´/ì•±ã€‘
  - í•„ìš”: ì•± ê°œë°œ+íŒë§¤, ì „ìžì œí’ˆ ì œì¡°, ì†Œí”„íŠ¸ì›¨ì–´ íŒ¨í‚¤ì§€ íŒë§¤
  - ë¶ˆí•„ìš”: ì†Œí”„íŠ¸ì›¨ì–´ ê°œë°œë§Œ(42ë¥˜), ì•± ì„œë¹„ìŠ¤ë§Œ ì œê³µ(42ë¥˜), ì „ìžì œí’ˆ íŒë§¤ì (35ë¥˜ë§Œ)
ã€10ë¥˜ - ì˜ë£Œê¸°ê¸°ã€‘í•„ìš”: ì˜ë£Œê¸°ê¸° ì œì¡° / ë¶ˆí•„ìš”: ì˜ë£Œê¸°ê¸° íŒë§¤ëŒ€ë¦¬ì (35ë¥˜ë§Œ)
ã€11ë¥˜ - ì¡°ëª…/ëƒ‰ë‚œë°©ã€‘í•„ìš”: ê°€ì „ì œí’ˆ ì œì¡° / ë¶ˆí•„ìš”: ê°€ì „ íŒë§¤ì (35ë¥˜ë§Œ), ì„¤ì¹˜(37ë¥˜)
ã€12ë¥˜ - ìš´ì†¡ê¸°ê¸°ã€‘í•„ìš”: ìžë™ì°¨/ìžì „ê±° ì œì¡° / ë¶ˆí•„ìš”: ìžë™ì°¨ ë”œëŸ¬(35ë¥˜), ìš´ì†¡ì—…(39ë¥˜)
ã€13ë¥˜ - ì´í¬/í™”ì•½ã€‘í•„ìš”: ë¬´ê¸°/í­ì£½ ì œì¡° / ë¶ˆí•„ìš”: íŒë§¤ì (35ë¥˜)
ã€14ë¥˜ - ê·€ê¸ˆì†/ì‹œê³„ã€‘í•„ìš”: ì¥¬ì–¼ë¦¬ ì œì¡°, ì‹œê³„ ë¸Œëžœë“œ / ë¶ˆí•„ìš”: ê·€ê¸ˆì† íŒë§¤ì (35ë¥˜ë§Œ)
ã€15ë¥˜ - ì•…ê¸°ã€‘í•„ìš”: ì•…ê¸° ì œì¡° / ë¶ˆí•„ìš”: ì•…ê¸° íŒë§¤ì (35ë¥˜ë§Œ), ìŒì•…êµìœ¡(41ë¥˜)
ã€16ë¥˜ - ì¸ì‡„ë¬¼/ë¬¸êµ¬ã€‘í•„ìš”: ì¶œíŒì‚¬, ë¬¸êµ¬ ì œì¡° / ë¶ˆí•„ìš”: ì„œì (35ë¥˜ë§Œ), ì¸ì‡„ì„œë¹„ìŠ¤(40ë¥˜)
ã€17ë¥˜ - ê³ ë¬´/í”Œë¼ìŠ¤í‹±ã€‘í•„ìš”: í”Œë¼ìŠ¤í‹± ì›ë£Œ ì œì¡° / ë¶ˆí•„ìš”: í¬ìž¥ìž¬ íŒë§¤(35ë¥˜)
ã€18ë¥˜ - ê°€ì£½/ê°€ë°©ã€‘í•„ìš”: ê°€ë°© ì œì¡°, íŒ¨ì…˜ ë¸Œëžœë“œ / ë¶ˆí•„ìš”: ê°€ë°© íŽ¸ì§‘ìƒµ(35ë¥˜ë§Œ)
ã€19ë¥˜ - ê±´ì¶•ìž¬ë£Œã€‘í•„ìš”: ê±´ìžìž¬ ì œì¡° / ë¶ˆí•„ìš”: ê±´ìžìž¬ ìœ í†µ(35ë¥˜), ê±´ì„¤(37ë¥˜)
ã€20ë¥˜ - ê°€êµ¬ã€‘í•„ìš”: ê°€êµ¬ ì œì¡° / ë¶ˆí•„ìš”: ê°€êµ¬ íŒë§¤ì (35ë¥˜ë§Œ), ì¸í…Œë¦¬ì–´(37ë¥˜)
ã€21ë¥˜ - ì£¼ë°©ìš©í’ˆã€‘í•„ìš”: ì£¼ë°©ìš©í’ˆ ì œì¡° / ë¶ˆí•„ìš”: ì£¼ë°©ìš©í’ˆ íŒë§¤(35ë¥˜ë§Œ)
ã€22ë¥˜ - ë¡œí”„/ì²œë§‰ã€‘í•„ìš”: ë¡œí”„ ì œì¡° / ë¶ˆí•„ìš”: ìº í•‘ìš©í’ˆ íŒë§¤(35ë¥˜ë§Œ)
ã€23ë¥˜ - ì‹¤ã€‘í•„ìš”: ë°©ì ì—… / ë¶ˆí•„ìš”: ìˆ˜ì˜ˆìš©í’ˆ íŒë§¤(35ë¥˜ë§Œ)
ã€24ë¥˜ - ì§ë¬¼/ì¹¨êµ¬ã€‘í•„ìš”: ì›ë‹¨ ì œì¡°, ì¹¨êµ¬ ë¸Œëžœë“œ / ë¶ˆí•„ìš”: ì¹¨êµ¬ íŒë§¤ì (35ë¥˜ë§Œ)
ã€25ë¥˜ - ì˜ë¥˜/ì‹ ë°œ/ëª¨ìžã€‘
  - í•„ìš”: ì˜ë¥˜ ë¸Œëžœë“œ, ì˜ë¥˜ ì œì¡°, ìžì²´ ë””ìžì¸ ì˜ë¥˜
  - ë¶ˆí•„ìš”: ì˜ë¥˜ íŽ¸ì§‘ìƒµ(35ë¥˜ë§Œ), ì˜ë¥˜ ìœ í†µì—…(35ë¥˜ë§Œ)
ã€26ë¥˜ - ë‹¨ì¶”/ë ˆì´ìŠ¤ã€‘í•„ìš”: ë¶€ìžìž¬ ì œì¡° / ë¶ˆí•„ìš”: ë¶€ìžìž¬ íŒë§¤(35ë¥˜ë§Œ)
ã€27ë¥˜ - ì¹´íŽ«/ë²½ì§€ã€‘í•„ìš”: ì¹´íŽ« ì œì¡° / ë¶ˆí•„ìš”: ì¸í…Œë¦¬ì–´ ìžìž¬ íŒë§¤(35ë¥˜), ì‹œê³µ(37ë¥˜)
ã€28ë¥˜ - ìž¥ë‚œê°/ê²Œìž„/ìŠ¤í¬ì¸ ìš©í’ˆã€‘í•„ìš”: ì™„êµ¬ ì œì¡°, ìŠ¤í¬ì¸ ìš©í’ˆ ë¸Œëžœë“œ / ë¶ˆí•„ìš”: ì™„êµ¬ì (35ë¥˜ë§Œ)
ã€29ë¥˜ - ê°€ê³µì‹í’ˆ(ìœ¡ë¥˜/ìœ ì œí’ˆ)ã€‘í•„ìš”: ì‹í’ˆ ì œì¡°, ì •ìœ¡ì—… / ë¶ˆí•„ìš”: ì‹ìžìž¬ ìœ í†µ(35ë¥˜ë§Œ)
ã€30ë¥˜ - ì»¤í”¼/ë¹µ/ê³¼ìž/ì¡°ë¯¸ë£Œã€‘
  - í•„ìš”: ì‹í’ˆ ì œì¡°ì—…, ë² ì´ì»¤ë¦¬ ìžì²´ ìƒí’ˆ, ì»¤í”¼ ë¡œìŠ¤íŒ…
  - ë¶ˆí•„ìš”: ì»¤í”¼ìˆ(43ë¥˜ë§Œ), ë² ì´ì»¤ë¦¬ ë§¤ìž¥ ì˜ì—…ë§Œ(43ë¥˜ë§Œ)
  - ì£¼ì˜: ì¹´íŽ˜ì—ì„œ ì›ë‘/ë¹µ í¬ìž¥íŒë§¤ ì‹œ â†’ 30ë¥˜+35ë¥˜ ì¶”ê°€ í•„ìš”
ã€31ë¥˜ - ë†ì‚°ë¬¼/ê½ƒã€‘í•„ìš”: ë†ì—…, í™”í›¼ì—… / ë¶ˆí•„ìš”: ê½ƒ ë°°ë‹¬(39ë¥˜), ê½ƒì§‘ ì†Œë§¤(35ë¥˜)
ã€32ë¥˜ - ìŒë£Œ/ë§¥ì£¼ã€‘í•„ìš”: ìŒë£Œ ì œì¡° / ë¶ˆí•„ìš”: ìŒë£Œ ìœ í†µ(35ë¥˜ë§Œ), ë°”/íŽ(43ë¥˜)
ã€33ë¥˜ - ì£¼ë¥˜ã€‘í•„ìš”: ì–‘ì¡°ì—…, ì£¼ë¥˜ ìˆ˜ìž…(ë¸Œëžœë“œ) / ë¶ˆí•„ìš”: ì£¼ë¥˜ ë„ë§¤(35ë¥˜), ë°”(43ë¥˜)
ã€34ë¥˜ - ë‹´ë°°ã€‘í•„ìš”: ë‹´ë°° ì œì¡° / ë¶ˆí•„ìš”: ë‹´ë°° íŒë§¤(35ë¥˜ë§Œ)

ã€ì„œë¹„ìŠ¤ë¥˜ 35-45ë¥˜ã€‘

ã€35ë¥˜ - ê´‘ê³ /ì‚¬ì—…ê´€ë¦¬/ë„ì†Œë§¤ã€‘
  - í•„ìš”í•œ ê²½ìš°:
    Â· ì˜¨ë¼ì¸ ì‡¼í•‘ëª° ìš´ì˜ (ìžì‚¬ëª°, ì˜¤í”ˆë§ˆì¼“, ìŠ¤ë§ˆíŠ¸ìŠ¤í† ì–´ ë“±)
    Â· íƒ€ì‚¬ ë¸Œëžœë“œ ìƒí’ˆ ìœ í†µ/íŽ¸ì§‘ìƒµ
    Â· í”„ëžœì°¨ì´ì¦ˆ ë³¸ë¶€
    Â· ê´‘ê³ ëŒ€í–‰ì—…
    Â· ê²½ì˜ì»¨ì„¤íŒ…
  - ë¶ˆí•„ìš”í•œ ê²½ìš°:
    Â· ìžì‚¬ ì œí’ˆë§Œ ì œì¡°í•˜ê³  B2B ë‚©í’ˆ (ìœ í†µ ì—†ìŒ)
    Â· ì„œë¹„ìŠ¤ë§Œ ì œê³µ (ìƒí’ˆ íŒë§¤ ì—†ìŒ)
    Â· ìžì‚¬ ë§¤ìž¥ì—ì„œ ìžì‚¬ ì œí’ˆë§Œ íŒë§¤ (ë…¼ìŸ ìžˆìŒ, ë°©ì–´ì  ë“±ë¡ ê¶Œìž¥)

ã€36ë¥˜ - ê¸ˆìœµ/ë³´í—˜/ë¶€ë™ì‚°ã€‘
  - í•„ìš”: ì€í–‰, ë³´í—˜ì‚¬, ì¦ê¶Œì‚¬, ë¶€ë™ì‚°ì¤‘ê°œ
  - ë¶ˆí•„ìš”: ë¶€ë™ì‚° ê°œë°œ(37ë¥˜), ìž¬ë¬´ ì»¨ì„¤íŒ…ë§Œ(35ë¥˜)

ã€37ë¥˜ - ê±´ì„¤/ìˆ˜ë¦¬/ì„¤ì¹˜ã€‘
  - í•„ìš”: ê±´ì„¤ì—…, ì¸í…Œë¦¬ì–´, ìˆ˜ë¦¬ì—…, ì„¤ì¹˜ì—…
  - ë¶ˆí•„ìš”: ê±´ìžìž¬ íŒë§¤(35ë¥˜), ê±´ì¶•ì„¤ê³„(42ë¥˜)

ã€38ë¥˜ - í†µì‹ /ë°©ì†¡ã€‘
  - í•„ìš”: í†µì‹ ì‚¬, ë°©ì†¡ì‚¬, ì¸í„°ë„·ì„œë¹„ìŠ¤ì œê³µ(ISP)
  - ë¶ˆí•„ìš”: í†µì‹ ê¸°ê¸° íŒë§¤(9ë¥˜+35ë¥˜), ì˜ìƒì œìž‘(41ë¥˜)

ã€39ë¥˜ - ìš´ì†¡/ì—¬í–‰/ë¬¼ë¥˜ã€‘
  - í•„ìš”: íƒë°°, ë¬¼ë¥˜, ì—¬í–‰ì‚¬, ì°½ê³ ì—…
  - ë¶ˆí•„ìš”: ì—¬í–‰ ì½˜í…ì¸ (41ë¥˜), ìš´ì†¡ê¸°ê¸° íŒë§¤(12ë¥˜+35ë¥˜)

ã€40ë¥˜ - ê°€ê³µ/ì²˜ë¦¬ã€‘
  - í•„ìš”: ì¸ì‡„ì†Œ, ì›ë‹¨ê°€ê³µ, ì‹í’ˆê°€ê³µ ì„œë¹„ìŠ¤
  - ë¶ˆí•„ìš”: ê°€ê³µëœ ì œí’ˆ íŒë§¤(í•´ë‹¹ ìƒí’ˆë¥˜+35ë¥˜)

ã€41ë¥˜ - êµìœ¡/ì—”í„°í…Œì¸ë¨¼íŠ¸/ìŠ¤í¬ì¸ ã€‘
  - í•„ìš”: í•™ì›, ì˜¨ë¼ì¸ê°•ì˜, ê³µì—°, ê²Œìž„ì„œë¹„ìŠ¤, ìœ íŠœë¸Œì±„ë„, ì¶œíŒ
  - ë¶ˆí•„ìš”: êµìž¬ íŒë§¤ë§Œ(16ë¥˜+35ë¥˜), ê²Œìž„ íŒë§¤ë§Œ(9ë¥˜+35ë¥˜)
  - ì£¼ì˜: êµìœ¡+êµìž¬íŒë§¤ ì‹œ â†’ 41ë¥˜+16ë¥˜+35ë¥˜ ëª¨ë‘ í•„ìš”

ã€42ë¥˜ - ITì„œë¹„ìŠ¤/ì—°êµ¬ê°œë°œ/ë””ìžì¸ã€‘
  - í•„ìš”: ì†Œí”„íŠ¸ì›¨ì–´ê°œë°œ ì„œë¹„ìŠ¤, ì›¹í˜¸ìŠ¤íŒ…, í´ë¼ìš°ë“œ, ë””ìžì¸ ì„œë¹„ìŠ¤, R&D
  - ë¶ˆí•„ìš”: ì†Œí”„íŠ¸ì›¨ì–´ íŒ¨í‚¤ì§€ íŒë§¤(9ë¥˜+35ë¥˜), ë””ìžì¸ ìƒí’ˆ íŒë§¤(í•´ë‹¹ ìƒí’ˆë¥˜)
  - ì£¼ì˜: SaaSëŠ” 42ë¥˜, íŒ¨í‚¤ì§€SW íŒë§¤ëŠ” 9ë¥˜

ã€43ë¥˜ - ìŒì‹ì /ìˆ™ë°•ã€‘
  - í•„ìš”: ë ˆìŠ¤í† ëž‘, ì¹´íŽ˜, í˜¸í…”, íŽœì…˜
  - ë¶ˆí•„ìš”: ì‹í’ˆ ì œì¡°íŒë§¤(29/30ë¥˜+35ë¥˜), ìŒì‹ ë°°ë‹¬ì„œë¹„ìŠ¤ë§Œ(39ë¥˜)
  - ì£¼ì˜: ì¹´íŽ˜+ì›ë‘íŒë§¤ ì‹œ â†’ 43ë¥˜+30ë¥˜+35ë¥˜

ã€44ë¥˜ - ì˜ë£Œ/ë¯¸ìš©/ë†ì—…ã€‘
  - í•„ìš”: ë³‘ì›, ë¯¸ìš©ì‹¤, ë„¤ì¼ìƒµ, ë™ë¬¼ë³‘ì›, ë†ì—…ì„œë¹„ìŠ¤
  - ë¶ˆí•„ìš”: ì˜ì•½í’ˆ íŒë§¤(5ë¥˜+35ë¥˜), í™”ìž¥í’ˆ íŒë§¤(3ë¥˜+35ë¥˜)

ã€45ë¥˜ - ë²•ë¥ /ë³´ì•ˆ/ê°œì¸ì„œë¹„ìŠ¤ã€‘
  - í•„ìš”: ë²•ë¥ ì‚¬ë¬´ì†Œ, ë³€ë¦¬ì‚¬, ê²½ë¹„ì—…, ê²°í˜¼ì¤‘ê°œ, ìž¥ë¡€ì„œë¹„ìŠ¤
  - ë¶ˆí•„ìš”: ë³´ì•ˆìž¥ë¹„ íŒë§¤(9ë¥˜+35ë¥˜)

â–  ë³µí•© ì‚¬ì—… íŒë‹¨ ì˜ˆì‹œ
1. "ì»¤í”¼ ë¡œìŠ¤í„°ë¦¬ ì¹´íŽ˜" â†’ 30ë¥˜(ì»¤í”¼ì›ë‘)+35ë¥˜(íŒë§¤)+43ë¥˜(ì¹´íŽ˜)
2. "ì˜¨ë¼ì¸ ì˜ë¥˜ ì‡¼í•‘ëª° + ìžì²´ ë¸Œëžœë“œ" â†’ 25ë¥˜(ì˜ë¥˜)+35ë¥˜(ì‡¼í•‘ëª°)
3. "ì•± ê°œë°œ + ì•± íŒë§¤" â†’ 9ë¥˜(ì•± ìƒí’ˆ)+42ë¥˜(ê°œë°œì„œë¹„ìŠ¤)+35ë¥˜(íŒë§¤)
4. "íŠ¹í—ˆ ì‚¬ë¬´ì†Œ" â†’ 45ë¥˜(ë²•ë¥ ì„œë¹„ìŠ¤), 35ë¥˜ëŠ” ë¶ˆí•„ìš”
5. "í•™ì› + ìžì²´ êµìž¬" â†’ 41ë¥˜(êµìœ¡)+16ë¥˜(êµìž¬)+35ë¥˜(êµìž¬íŒë§¤)
6. "ê°€êµ¬ ê³µë°© + íŒë§¤" â†’ 20ë¥˜(ê°€êµ¬)+35ë¥˜(íŒë§¤)
7. "ì˜ë¥˜ íŽ¸ì§‘ìƒµ (íƒ€ë¸Œëžœë“œë§Œ)" â†’ 35ë¥˜ë§Œ
8. "í™”ìž¥í’ˆ ë¸Œëžœë“œ + ì˜¨ë¼ì¸ëª°" â†’ 3ë¥˜(í™”ìž¥í’ˆ)+35ë¥˜(íŒë§¤)
9. "ìš”ì‹ì—… í”„ëžœì°¨ì´ì¦ˆ" â†’ 43ë¥˜(ìŒì‹ì )+35ë¥˜(í”„ëžœì°¨ì´ì¦ˆ)
10. "ê²Œìž„ ê°œë°œì‚¬ + ì•± ì¶œì‹œ" â†’ 9ë¥˜(ê²Œìž„ì•±)+41ë¥˜(ê²Œìž„ì„œë¹„ìŠ¤)+42ë¥˜(ê°œë°œ)
`;

  // ============================================================
  // 1. ë¹„ì¦ˆë‹ˆìŠ¤ ë¶„ì„ - ì „ë©´ ìž¬ì„¤ê³„ v4
  // ============================================================
  // í•µì‹¬ ì›ì¹™:
  // 1. ì‚¬ì—… ìœ í˜• ë¶„ë¥˜ â†’ í•„ìˆ˜ ìƒí’ˆë¥˜ ë„ì¶œ
  // 2. ìƒí’ˆë¥˜ ê°„ ì—°ê´€ ê´€ê³„ë¡œ í™•ìž¥
  // 3. ì‚¬ì—… í™•ìž¥ì„± ê³ ë ¤
  // 4. ê³ ì‹œëª…ì¹­ DBì—ì„œë§Œ ì¶”ì²œ
  // ============================================================
  
  TM.analyzeBusiness = async function() {
    const p = TM.currentProject;
    const businessInput = document.getElementById('tm-business-url')?.value?.trim();
    
    if (!businessInput && !p.trademarkName) {
      App.showToast('ìƒí‘œëª… ë˜ëŠ” ì‚¬ì—… ë‚´ìš©ì„ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    try {
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="tossface">â³</span> AI ë¶„ì„ ì¤‘...';
      }
      
      // â˜…â˜…â˜… ìƒˆ ë¶„ì„ ì‹œ ê¸°ì¡´ ì„ íƒ ì™„ì „ ì´ˆê¸°í™” â˜…â˜…â˜…
      p.classes = [];
      p.designatedGoods = [];
      p.aiAnalysis = null;
      console.log('[TM] ê¸°ì¡´ ì„ íƒ ì´ˆê¸°í™” ì™„ë£Œ');
      
      // ================================================================
      // LLM ê¸°ë°˜ ì‚¬ì—… ë¶„ì„ (ì‹¤ë¬´ ê°€ì´ë“œë¼ì¸ í¬í•¨)
      // - í•˜ë“œì½”ë”©ëœ ê·œì¹™ ëŒ€ì‹  LLMì´ ì‚¬ì—… íŠ¹ì„±ì„ ë¶„ì„í•˜ì—¬ íŒë‹¨
      // - ì‹¤ë¬´ ì§€ì‹ì„ í”„ë¡¬í”„íŠ¸ì— í¬í•¨í•˜ì—¬ ì •í™•ë„ í–¥ìƒ
      // ================================================================
      const analysisPrompt = `ë‹¹ì‹ ì€ 10ë…„ ì´ìƒ ê²½ë ¥ì˜ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.
ê³ ê°ì˜ ì‚¬ì—…ì„ ì‹¬ì¸µ ë¶„ì„í•˜ì—¬ ìµœì ì˜ ìƒí’ˆë¥˜ë¥¼ ì¶”ì²œí•˜ì„¸ìš”.

ã€ê³ ê° ì •ë³´ã€‘
- ìƒí‘œëª…: ${p.trademarkName || 'ë¯¸ì •'}
- ì‚¬ì—… ë‚´ìš©: ${businessInput || 'ë¯¸ìž…ë ¥'}

${TM.PRACTICE_GUIDELINES}

ã€ë¶„ì„ ì‹œ í•µì‹¬ ì›ì¹™ã€‘
â˜…â˜…â˜… ìœ„ ê°€ì´ë“œë¼ì¸ì˜ ê° ë¥˜ë³„ íŒë‹¨ ê¸°ì¤€ì„ ë°˜ë“œì‹œ ì°¸ê³ í•˜ì—¬ íŒë‹¨í•˜ì„¸ìš” â˜…â˜…â˜…

1. ìƒí’ˆ(1-34ë¥˜)ê³¼ ì„œë¹„ìŠ¤(35-45ë¥˜)ëŠ” ë³„ê°œ ê°œë…
   - ê°™ì€ ì‚¬ì—…ìž¥ì´ë¼ë„ ìƒí’ˆê³¼ ì„œë¹„ìŠ¤ëŠ” ë³„ë„ ë“±ë¡ í•„ìš”
   - ì˜ˆ: ì¹´íŽ˜ ìš´ì˜(43ë¥˜) + ì›ë‘ íŒë§¤(30ë¥˜+35ë¥˜) = 3ê°œ ë¥˜

2. ê° ë¥˜ë³„ "í•„ìš”/ë¶ˆí•„ìš”" íŒë‹¨
   - í•´ë‹¹ ìƒí’ˆì„ ì§ì ‘ ì œì¡°í•˜ëŠ”ê°€? â†’ í•´ë‹¹ ìƒí’ˆë¥˜ í•„ìš”
   - í•´ë‹¹ ìƒí’ˆì„ êµ¬ë§¤í•´ì„œ íŒë§¤ë§Œ í•˜ëŠ”ê°€? â†’ í•´ë‹¹ ìƒí’ˆë¥˜ ë¶ˆí•„ìš”, 35ë¥˜ë§Œ
   - í•´ë‹¹ ì„œë¹„ìŠ¤ë¥¼ ì§ì ‘ ì œê³µí•˜ëŠ”ê°€? â†’ í•´ë‹¹ ì„œë¹„ìŠ¤ë¥˜ í•„ìš”

3. 35ë¥˜ëŠ” "íŒë§¤ ì±„ë„"ì— ë”°ë¼ íŒë‹¨ (ë¬´ì¡°ê±´ ì¶”ê°€ ê¸ˆì§€)
   - ì˜¨ë¼ì¸ ì‡¼í•‘ëª°/ì˜¤í”ˆë§ˆì¼“ íŒë§¤ â†’ í•„ìš”
   - B2B ë‚©í’ˆë§Œ â†’ ë¶ˆí•„ìš”í•  ìˆ˜ ìžˆìŒ
   - ì„œë¹„ìŠ¤ë§Œ ì œê³µ (ìƒí’ˆ íŒë§¤ ì—†ìŒ) â†’ ë¶ˆí•„ìš”

4. 3ë…„ ì´ìƒ ë¯¸ì‚¬ìš© ì‹œ ë¶ˆì‚¬ìš©ì·¨ì†Œ ê°€ëŠ¥ â†’ ì‹¤ì œ ì‚¬ìš© ê°€ëŠ¥ì„± ê³ ë ¤

ã€ë¶„ì„ í•­ëª©ã€‘
1. ì‚¬ì—… ìœ í˜• ë¶„ë¥˜
2. í•µì‹¬ ìƒí’ˆ/ì„œë¹„ìŠ¤ ì‹ë³„
3. íŒë§¤/ìœ í†µ ì±„ë„ ë¶„ì„
4. ì‚¬ì—… í™•ìž¥ ê°€ëŠ¥ì„±
5. ìƒí’ˆë¥˜ ì¶”ì²œ (3ë‹¨ê³„ë¡œ êµ¬ë¶„)

ã€ìƒí’ˆë¥˜ ì¶”ì²œ 3ë‹¨ê³„ ê¸°ì¤€ã€‘
â–  í•µì‹¬ (core): í˜„ìž¬ ì‚¬ì—…ì— ë°˜ë“œì‹œ í•„ìš”, ì—†ìœ¼ë©´ ê¶Œë¦¬ ë³´í˜¸ ë¶ˆê°€
  - ì‹¤ì œë¡œ ì œì¡°/ì œê³µí•˜ëŠ” ìƒí’ˆ/ì„œë¹„ìŠ¤ì˜ ë¥˜
  - í˜„ìž¬ ì§„í–‰ ì¤‘ì¸ ì‚¬ì—…ì— ì§ì ‘ í•´ë‹¹

â–  ê¶Œìž¥ (recommended): ê¶Œë¦¬ ë³´í˜¸ë¥¼ ìœ„í•´ ê°•ë ¥ížˆ ê¶Œìž¥
  - íŒë§¤ ì±„ë„ ë³´í˜¸ (ì˜¨ë¼ì¸ íŒë§¤ â†’ 35ë¥˜ ë“±)
  - ê´€ë ¨ ì„œë¹„ìŠ¤ ë³´í˜¸ (ì œí’ˆ+A/S â†’ 37ë¥˜ ë“±)
  - ë¸Œëžœë“œ í™•ìž¥ì— í”ížˆ ì‚¬ìš©ë˜ëŠ” ë¥˜
  - ê²½ìŸì‚¬ê°€ ì¼ë°˜ì ìœ¼ë¡œ ë“±ë¡í•˜ëŠ” ë¥˜

â–  í™•ìž¥ (expansion): ì‚¬ì—… í™•ìž¥ ì‹œ ê³ ë ¤í•  ë¥˜
  - ìžì—°ìŠ¤ëŸ¬ìš´ ì‚¬ì—… í™•ìž¥ ë°©í–¥
  - ì‹œë„ˆì§€ ìžˆëŠ” ê´€ë ¨ ë¶„ì•¼
  - ë°©ì–´ì  ë“±ë¡ ê³ ë ¤ ëŒ€ìƒ

ã€ì‘ë‹µ í˜•ì‹ - JSONë§Œã€‘
{
  "businessSummary": "ì´ ì‚¬ì—…ì€ ... (2-3ë¬¸ìž¥ìœ¼ë¡œ êµ¬ì²´ì ìœ¼ë¡œ)",
  "businessTypes": ["PRODUCT", "RETAIL"],
  "coreProducts": ["ë°œë ˆ ì˜ë¥˜", "ëŒ„ìŠ¤ë³µ"],
  "coreServices": [],
  "salesChannels": {
    "online": true,
    "offline": false,
    "b2b": false,
    "b2c": true,
    "franchise": false,
    "details": "ì˜¨ë¼ì¸ ìžì‚¬ëª° ìš´ì˜"
  },
  "expansionPotential": ["ëŒ„ìŠ¤ ìš©í’ˆ", "ìŠ¤í¬ì¸  ì˜ë¥˜", "ëŒ„ìŠ¤ êµìœ¡"],
  "classRecommendations": {
    "core": [
      {"class": "25", "reason": "ë°œë ˆ ì˜ë¥˜, ëŒ„ìŠ¤ë³µ - í•µì‹¬ ìƒí’ˆ", "priority": 1}
    ],
    "recommended": [
      {"class": "35", "reason": "ì˜¨ë¼ì¸ ì‡¼í•‘ëª° ìš´ì˜ - ì†Œë§¤ì—… ë³´í˜¸ í•„ìˆ˜", "priority": 1},
      {"class": "18", "reason": "ê°€ë°©, íŒŒìš°ì¹˜ - ì˜ë¥˜ ë¸Œëžœë“œ í•„ìˆ˜ í™•ìž¥", "priority": 2}
    ],
    "expansion": [
      {"class": "28", "reason": "ëŒ„ìŠ¤ ìš©í’ˆ, ìŠ¤í¬ì¸  ìž¥ë¹„ - ìžì—°ìŠ¤ëŸ¬ìš´ í™•ìž¥", "priority": 1},
      {"class": "41", "reason": "ëŒ„ìŠ¤ êµìœ¡ ì„œë¹„ìŠ¤ - ì‹œë„ˆì§€ ì‚¬ì—…", "priority": 2},
      {"class": "9", "reason": "ëŒ„ìŠ¤ êµìœ¡ ì•±/ì˜ìƒ - ë””ì§€í„¸ í™•ìž¥", "priority": 3}
    ]
  },
  "searchKeywords": ["ë°œë ˆ", "ëŒ„ìŠ¤", "ì˜ë¥˜", "ë ˆì˜¤íƒ€ë“œ", "íŒë§¤"]
}`;

      if (btn) btn.innerHTML = '<span class="tossface">â³</span> ì‚¬ì—… ë¶„ì„ ì¤‘...';
      
      console.log('[TM] LLM ê¸°ë°˜ ì‚¬ì—… ë¶„ì„ ì‹œìž‘');
      const analysisResponse = await App.callClaude(analysisPrompt, 4000);
      const text = analysisResponse.text || '';
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('AI ì‘ë‹µ íŒŒì‹± ì‹¤íŒ¨');
      }
      
      const jsonStr = text.substring(startIdx, endIdx + 1)
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\n/g, ' ');
      
      const analysis = JSON.parse(jsonStr);
      
      // ================================================================
      // 3ë‹¨ê³„ ì¶”ì²œ êµ¬ì¡° ì²˜ë¦¬ (í•µì‹¬/ê¶Œìž¥/í™•ìž¥)
      // ================================================================
      const classRec = analysis.classRecommendations || {};
      const coreClasses = (classRec.core || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      const recommendedClasses = (classRec.recommended || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      const expansionClasses = (classRec.expansion || []).sort((a, b) => (a.priority || 99) - (b.priority || 99));
      
      console.log('[TM] â˜… ì‚¬ì—… ë¶„ì„ ì™„ë£Œ (3ë‹¨ê³„ ì¶”ì²œ)');
      console.log('[TM] - ì‚¬ì—… ìš”ì•½:', analysis.businessSummary);
      console.log('[TM] - í•µì‹¬ ë¥˜ (core):', coreClasses);
      console.log('[TM] - ê¶Œìž¥ ë¥˜ (recommended):', recommendedClasses);
      console.log('[TM] - í™•ìž¥ ë¥˜ (expansion):', expansionClasses);
      
      // ì „ì²´ ì¶”ì²œ ë¥˜ ëª©ë¡ (ì¤‘ë³µ ì œê±°)
      const allClassCodes = [...new Set([
        ...coreClasses.map(c => c.class),
        ...recommendedClasses.map(c => c.class),
        ...expansionClasses.map(c => c.class)
      ])];
      
      // classReasons êµ¬ì„± (í˜¸í™˜ì„± ìœ ì§€)
      const classReasons = {};
      coreClasses.forEach(c => { classReasons[c.class] = `ðŸ”´ í•µì‹¬: ${c.reason}`; });
      recommendedClasses.forEach(c => { classReasons[c.class] = `ðŸŸ  ê¶Œìž¥: ${c.reason}`; });
      expansionClasses.forEach(c => { classReasons[c.class] = `ðŸŸ¢ í™•ìž¥: ${c.reason}`; });
      
      console.log('[TM] ì „ì²´ ì¶”ì²œ ë¥˜:', allClassCodes);
      
      // ì‚¬ìš©ìž ìž…ë ¥ì—ì„œ í‚¤ì›Œë“œ ì¶”ì¶œ
      const userKeywords = TM.extractKeywordsFromInput(businessInput);
      const allKeywords = [...new Set([
        ...userKeywords,
        ...(analysis.searchKeywords || []),
        ...(analysis.coreProducts || []),
        ...(analysis.coreServices || [])
      ])];
      
      console.log('[TM] ê²€ìƒ‰ í‚¤ì›Œë“œ:', allKeywords);
      
      p.aiAnalysis = {
        businessAnalysis: analysis.businessSummary || '',
        businessTypes: analysis.businessTypes || [],
        coreProducts: analysis.coreProducts || [],
        coreServices: analysis.coreServices || [],
        salesChannels: analysis.salesChannels || {},
        expansionPotential: analysis.expansionPotential || [],
        coreActivity: (analysis.coreProducts?.[0] || '') + ' ' + (analysis.coreServices?.[0] || ''),
        // â˜… 3ë‹¨ê³„ ì¶”ì²œ êµ¬ì¡°
        classRecommendations: {
          core: coreClasses,
          recommended: recommendedClasses,
          expansion: expansionClasses
        },
        // â˜… í˜¸í™˜ì„±ì„ ìœ„í•œ ê¸°ì¡´ í•„ë“œ ìœ ì§€
        recommendedClasses: allClassCodes,
        classReasons: classReasons,
        searchKeywords: allKeywords,
        recommendedGoods: {},
        // â˜… í˜„ìž¬ ì„ íƒëœ ë¥˜ (ê¸°ë³¸: í•µì‹¬+ê¶Œìž¥ë§Œ ìžë™ ì„ íƒ)
        selectedCategories: ['core', 'recommended']
      };
      
      // ================================================================
      // â˜… ëª¨ë“  ì¶”ì²œ ë¥˜(í•µì‹¬+ê¶Œìž¥+í™•ìž¥)ì— ëŒ€í•´ ì§€ì •ìƒí’ˆ 10ê°œ ì„ íƒ
      // ================================================================
      const initialClasses = [
        ...coreClasses.map(c => c.class),
        ...recommendedClasses.map(c => c.class),
        ...expansionClasses.map(c => c.class)
      ];
      
      for (const classCode of initialClasses) {
        const paddedCode = classCode.padStart(2, '0');
        
        try {
          if (btn) btn.innerHTML = `<span class="tossface">â³</span> ì œ${classCode}ë¥˜ ë¶„ì„ ì¤‘...`;
          
          // 3-1. DBì—ì„œ ê³ ì‹œëª…ì¹­ ì¡°íšŒ
          const candidates = await TM.fetchOptimalCandidates(
            paddedCode,
            allKeywords,
            analysis
          );
          
          console.log(`[TM] ì œ${classCode}ë¥˜ í›„ë³´: ${candidates.length}ê±´`);
          
          if (candidates.length === 0) {
            // â˜… í›„ë³´ê°€ 0ê±´ì´ë©´ í•´ë‹¹ ë¥˜ ì „ì²´ì—ì„œ ì§ì ‘ ì¡°íšŒ ì‹œë„
            console.log(`[TM] ì œ${classCode}ë¥˜ í›„ë³´ 0ê±´ â†’ ë¥˜ ì „ì²´ ì¡°íšŒ`);
            try {
              const { data } = await App.sb
                .from('gazetted_goods_cache')
                .select('goods_name, similar_group_code')
                .eq('class_code', paddedCode)
                .limit(100);
              
              if (data?.length > 0) {
                data.forEach(item => {
                  candidates.push({
                    name: item.goods_name,
                    similarGroup: item.similar_group_code,
                    matchType: 'class',
                    priority: 3
                  });
                });
                console.log(`[TM] ì œ${classCode}ë¥˜ ì „ì²´ ì¡°íšŒ â†’ ${candidates.length}ê±´`);
              }
            } catch (e) {
              console.warn(`[TM] ì œ${classCode}ë¥˜ ì „ì²´ ì¡°íšŒ ì‹¤íŒ¨:`, e.message);
            }
          }
          
          if (candidates.length === 0) {
            // â˜… DBì—ë„ ì—†ìœ¼ë©´ LLMìœ¼ë¡œ ê³ ì‹œëª…ì¹­ 10ê°œ ì§ì ‘ ìƒì„±
            console.log(`[TM] ì œ${classCode}ë¥˜ DB í›„ë³´ ì—†ìŒ â†’ LLM ìƒì„±`);
            let llmGoods = [];
            try {
              const genPrompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.
ì œ${classCode}ë¥˜ì˜ ê³ ì‹œëª…ì¹­(ì§€ì •ìƒí’ˆ/ì„œë¹„ìŠ¤) ì¤‘ì—ì„œ ì•„ëž˜ ì‚¬ì—…ê³¼ ê´€ë ¨ëœ ê²ƒì„ ì •í™•ížˆ 10ê°œ ì¶”ì²œí•˜ì„¸ìš”.

ã€ì‚¬ì—… ë‚´ìš©ã€‘
"${businessInput}"

ã€ê·œì¹™ã€‘
- ë°˜ë“œì‹œ íŠ¹í—ˆì²­ ê³ ì‹œëª…ì¹­ì— í•´ë‹¹í•˜ëŠ” ì •í™•í•œ ëª…ì¹­ë§Œ ì‚¬ìš©
- í•´ë‹¹ ë¥˜ì— ì‹¤ì œ ì¡´ìž¬í•˜ëŠ” ì§€ì •ìƒí’ˆ/ì„œë¹„ìŠ¤ë§Œ ê¸°ìž¬
- JSON ë°°ì—´ë¡œë§Œ ì‘ë‹µ

["ìƒí’ˆëª…1", "ìƒí’ˆëª…2", ..., "ìƒí’ˆëª…10"]`;
              const genResponse = await App.callClaude(genPrompt, 500);
              const genText = (genResponse.text || '').trim();
              const nameArray = JSON.parse(genText.match(/\[[\s\S]*\]/)?.[0] || '[]');
              
              llmGoods = nameArray.slice(0, 10).map(name => ({
                name: name,
                similarGroup: '',
                isCore: false,
                isLlmGenerated: true
              }));
              console.log(`[TM] ì œ${classCode}ë¥˜ LLM ìƒì„±: ${llmGoods.length}ê°œ`);
            } catch (genErr) {
              console.warn(`[TM] ì œ${classCode}ë¥˜ LLM ìƒì„± ì‹¤íŒ¨:`, genErr.message);
            }
            
            // â˜… LLM ê²°ê³¼ë„ 10ê°œ ë¯¸ë§Œì´ë©´ ensureMinGoodsë¡œ ë³´ì¶©
            p.aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(classCode, llmGoods, businessInput);
            continue;
          }
          
          // 3-2. LLMì´ ìµœì  ìƒí’ˆ ì„ íƒ
          const selectedGoods = await TM.selectOptimalGoods(
            classCode,
            candidates,
            businessInput,
            analysis
          );
          
          p.aiAnalysis.recommendedGoods[classCode] = selectedGoods;
          
          // â˜… 10ê°œ ë³´ìž¥
          p.aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(
            classCode, p.aiAnalysis.recommendedGoods[classCode], businessInput
          );
          
          const finalCount = p.aiAnalysis.recommendedGoods[classCode].length;
          console.log(`[TM] ì œ${classCode}ë¥˜ ìµœì¢…: ${finalCount}ê±´`);
          if (finalCount > 0) {
            console.log(`[TM]   â†’ ${p.aiAnalysis.recommendedGoods[classCode].slice(0, 3).map(s => s.name).join(', ')}...`);
          }
          
        } catch (classError) {
          console.error(`[TM] ì œ${classCode}ë¥˜ ì²˜ë¦¬ ì‹¤íŒ¨:`, classError);
          // â˜… ì—ëŸ¬ ì‹œì—ë„ ensureMinGoodsë¡œ ìµœì†Œ 10ê°œ ì±„ìš°ê¸°
          try {
            p.aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(classCode, [], businessInput);
            console.log(`[TM] ì œ${classCode}ë¥˜ ì—ëŸ¬ ë³µêµ¬: ${p.aiAnalysis.recommendedGoods[classCode].length}ê°œ`);
          } catch (e) {
            p.aiAnalysis.recommendedGoods[classCode] = [];
          }
        }
      }
      
      // ================================================================
      // 4ë‹¨ê³„: ì¶”ì²œ ê²°ê³¼ 3ë‹¨ê³„ ê²€ì¦ (Validation)
      // ================================================================
      if (btn) btn.innerHTML = '<span class="tossface">ðŸ”</span> 1/3 ë¥˜ ê²€ì¦ ì¤‘...';
      
      const validationResult = await TM.validateRecommendations(businessInput, p.aiAnalysis);
      
      if (validationResult) {
        p.aiAnalysis.validation = validationResult;
        
        // ê²€ì¦ ê²°ê³¼ ì ìš© (ìž˜ëª»ëœ í•­ëª© ì œê±° + ëŒ€ì²´ ì¶”ì²œ)
        if (validationResult.hasIssues) {
          if (btn) btn.innerHTML = '<span class="tossface">ðŸ”§</span> ê²€ì¦ ê²°ê³¼ ì ìš© ì¤‘...';
          await TM.applyValidationResult(p.aiAnalysis, validationResult);
        }
        
        console.log('[TM] âœ… ê²€ì¦ ì™„ë£Œ');
      }
      
      TM.renderCurrentStep();
      App.showToast('ì‚¬ì—… ë¶„ì„ ì™„ë£Œ!', 'success');
      
    } catch (error) {
      console.error('[TM] ì‚¬ì—… ë¶„ì„ ì‹¤íŒ¨:', error);
      App.showToast('ë¶„ì„ ì‹¤íŒ¨: ' + error.message, 'error');
    } finally {
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'AI ë¶„ì„ ðŸ”';
      }
    }
  };
  
  // ================================================================
  // DBì—ì„œ ìµœì  í›„ë³´ ì¡°íšŒ (ì‚¬ì—… ë§¥ë½ ê³ ë ¤)
  // ================================================================
  TM.fetchOptimalCandidates = async function(classCode, keywords, analysis) {
    const results = [];
    const seen = new Set();
    
    console.log(`[TM] â•â•â•â• DB ê²€ìƒ‰: ì œ${classCode}ë¥˜ â•â•â•â•`);
    
    // ì‚¬ì—… ë§¥ë½ ì¶”ì¶œ (í•„í„°ë§ìš©)
    const businessContext = [
      ...(analysis.coreProducts || []),
      ...(analysis.coreServices || []),
      ...(analysis.expansionPotential || [])
    ].join(' ').toLowerCase();
    
    // í˜¼ë™ ë°©ì§€ìš© í•„í„° (ë™ìŒì´ì˜ì–´/ìœ ì‚¬ì–´ ì²˜ë¦¬)
    const confusionFilters = {
      'ìƒí™”': ['ìƒí™”í•™', 'ìƒí™”í•™ì '],  // ìƒí™”(ê½ƒ) vs ìƒí™”í•™
      'ê°€êµ¬': ['ê°€êµ¬ì›', 'í•œê°€êµ¬'],     // ê°€êµ¬(furniture) vs ê°€êµ¬(å®¶å£)
      'í™”ë¶„': ['í™”ë¶„ì¦'],               // í™”ë¶„(pot) vs í™”ë¶„(èŠ±ç²‰)
    };
    
    // í˜„ìž¬ ì‚¬ì—…ê³¼ ê´€ë ¨ ì—†ëŠ” í‚¤ì›Œë“œ ê°ì§€
    const getExcludePatterns = (keyword) => {
      const patterns = [];
      for (const [key, excludes] of Object.entries(confusionFilters)) {
        if (keyword.includes(key)) {
          patterns.push(...excludes);
        }
      }
      return patterns;
    };
    
    // 1. í•µì‹¬ ìƒí’ˆ/ì„œë¹„ìŠ¤ í‚¤ì›Œë“œë¡œ ê²€ìƒ‰ (ìµœìš°ì„ )
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
          console.log(`[TM] í•µì‹¬ í‚¤ì›Œë“œ "${term}" â†’ ${data.length}ê±´`);
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              // í˜¼ë™ í•„í„° ì ìš©
              const nameLower = item.goods_name.toLowerCase();
              const shouldExclude = excludePatterns.some(p => nameLower.includes(p));
              
              if (shouldExclude) {
                console.log(`[TM] ì œì™¸ (í˜¼ë™ë°©ì§€): ${item.goods_name}`);
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
        console.warn(`[TM] ê²€ìƒ‰ ì‹¤íŒ¨ (${term}):`, e.message);
      }
    }
    
    // 2. ì¼ë°˜ í‚¤ì›Œë“œë¡œ ê²€ìƒ‰
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
          console.log(`[TM] í‚¤ì›Œë“œ "${keyword}" â†’ ${data.length}ê±´`);
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              // í˜¼ë™ í•„í„° ì ìš©
              const nameLower = item.goods_name.toLowerCase();
              const shouldExclude = excludePatterns.some(p => nameLower.includes(p));
              
              if (shouldExclude) {
                console.log(`[TM] ì œì™¸ (í˜¼ë™ë°©ì§€): ${item.goods_name}`);
                return;
              }
              
              seen.add(item.goods_name);
              
              // ìš°ì„ ìˆœìœ„ ê³„ì‚°
              const kwLower = keyword.toLowerCase();
              let priority = 2;
              
              if (nameLower === kwLower || nameLower === kwLower + 'ì—…') {
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
        // ë¬´ì‹œ
      }
    }
    
    // 3. í›„ë³´ê°€ ë¶€ì¡±í•˜ë©´ í•´ë‹¹ ë¥˜ì—ì„œ ì¶”ê°€ ì¡°íšŒ
    if (results.length < 30) {
      try {
        console.log(`[TM] í›„ë³´ ë¶€ì¡± (${results.length}ê±´), ì¶”ê°€ ì¡°íšŒ...`);
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
        // ë¬´ì‹œ
      }
    }
    
    // ìš°ì„ ìˆœìœ„ìˆœ ì •ë ¬
    results.sort((a, b) => a.priority - b.priority);
    
    console.log(`[TM] ì´ í›„ë³´: ${results.length}ê±´`);
    if (results.length > 0) {
      console.log(`[TM] ìƒìœ„: ${results.slice(0, 5).map(r => r.name).join(', ')}`);
    }
    
    return results;
  };
  
  // ================================================================
  // ìµœì  ì§€ì •ìƒí’ˆ ì„ íƒ (ì‚¬ì—… ë§¥ë½ + í™•ìž¥ì„± ê³ ë ¤)
  // ================================================================
  TM.selectOptimalGoods = async function(classCode, candidates, businessText, analysis) {
    const MIN_GOODS = 10;
    const MAX_CORE_MATCH = 5;  // í•µì‹¬ í‚¤ì›Œë“œë‹¹ ìµœëŒ€ ë§¤ì¹­ ìˆ˜
    const selected = [];
    const usedNames = new Set();
    
    // 1. í•µì‹¬ í‚¤ì›Œë“œì™€ ì§ì ‘ ë§¤ì¹­ë˜ëŠ” ìƒí’ˆ ìžë™ í¬í•¨
    const coreTerms = [
      ...(analysis.coreProducts || []),
      ...(analysis.coreServices || [])
    ];
    
    for (const term of coreTerms) {
      const termLower = term.toLowerCase();
      let termMatchCount = 0;
      
      for (const c of candidates) {
        if (usedNames.has(c.name)) continue;
        if (termMatchCount >= MAX_CORE_MATCH) break;  // í‚¤ì›Œë“œë‹¹ ìµœëŒ€ 5ê°œ
        
        const nameLower = c.name.toLowerCase();
        
        // ì§ì ‘ ë§¤ì¹­
        if (nameLower.includes(termLower) || 
            nameLower === termLower + 'ì—…' ||
            nameLower === termLower + 'ì„œë¹„ìŠ¤ì—…') {
          
          console.log(`[TM] â˜… ì§ì ‘ ë§¤ì¹­: "${term}" â†’ "${c.name}"`);
          usedNames.add(c.name);
          selected.push({
            name: c.name,
            similarGroup: c.similarGroup,
            isCore: true,
            reason: `í•µì‹¬: "${term}"`
          });
          
          termMatchCount++;
        }
      }
    }
    
    console.log(`[TM] ì§ì ‘ ë§¤ì¹­ ê²°ê³¼: ${selected.length}ê°œ`);
    
    // 2. LLMì´ ë‚˜ë¨¸ì§€ ì„ íƒ (ê´€ë ¨ì„± ê²€ì¦ ê°•í™”)
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
        
        const selectPrompt = `ã€ì‚¬ì—… ì •ë³´ã€‘
- ì‚¬ì—… ë‚´ìš©: ${businessText}
- í•µì‹¬ ìƒí’ˆ: ${coreProducts || 'ì—†ìŒ'}
- í•µì‹¬ ì„œë¹„ìŠ¤: ${coreServices || 'ì—†ìŒ'}
- ì‚¬ì—… ìœ í˜•: ${businessTypes || 'ë¯¸ì •'}
- í™•ìž¥ ê°€ëŠ¥: ${expansion || 'ë¯¸ì •'}

ã€ì œ${classCode}ë¥˜ ê³ ì‹œëª…ì¹­ í›„ë³´ã€‘
${numberedList}

ã€ì„ íƒ ê¸°ì¤€ - ë§¤ìš° ì¤‘ìš”ã€‘
â˜…â˜…â˜… ë°˜ë“œì‹œ ì‚¬ì—… ë‚´ìš©ê³¼ ì§ì ‘ì ìœ¼ë¡œ ê´€ë ¨ ìžˆëŠ” ê²ƒë§Œ ì„ íƒí•˜ì„¸ìš” â˜…â˜…â˜…

1. "${businessText}"ì™€ ê´€ë ¨ëœ ìƒí’ˆ/ì„œë¹„ìŠ¤ë§Œ ì„ íƒ
2. ìœ ì‚¬í•œ ë°œìŒì´ë‚˜ ê¸€ìžê°€ í¬í•¨ë˜ì–´ë„ ì˜ë¯¸ê°€ ë‹¤ë¥´ë©´ ì œì™¸
   - ì˜ˆ: "ê½ƒ/ìƒí™”(èŠ±)" ì‚¬ì—…ì¸ë° "ìƒí™”í•™(åŒ–å­¸)" ê´€ë ¨ ìƒí’ˆì€ ì œì™¸
   - ì˜ˆ: "ê°€êµ¬" ì‚¬ì—…ì¸ë° "ê°€êµ¬(å®¶å£=ê°€ì¡±)" ê´€ë ¨ ìƒí’ˆì€ ì œì™¸
3. í•´ë‹¹ ì‚¬ì—…ì˜ ì‹¤ì œ íŒë§¤/ì œê³µ ëŒ€ìƒê³¼ ë§žëŠ” ê²ƒë§Œ ì„ íƒ

ì„ íƒí•  ê°œìˆ˜: ì •í™•ížˆ ${MIN_GOODS - selected.length}ê°œë¥¼ ì„ íƒí•˜ì„¸ìš”. ê´€ë ¨ì„±ì´ ë†’ì€ ìˆœìœ¼ë¡œ ì„ íƒí•˜ë˜, ë°˜ë“œì‹œ ${MIN_GOODS - selected.length}ê°œë¥¼ ì±„ìš°ì„¸ìš”.

ì‘ë‹µ: ìˆ«ìžë§Œ ì‰¼í‘œë¡œ (ì˜ˆ: 1,2,3)
ì„ íƒ:`;

        try {
          const response = await App.callClaude(selectPrompt, 200);
          const responseText = (response.text || '').trim();
          
          console.log(`[TM] LLM ì‘ë‹µ: "${responseText.substring(0, 80)}..."`);
          
          // ë²ˆí˜¸ íŒŒì‹± ("ì—†ìŒ" ì‘ë‹µë„ ë¬´ì‹œí•˜ê³  ë²ˆí˜¸ë§Œ ì¶”ì¶œ)
          const numbers = responseText
            .replace(/[^\d,\s]/g, '')
            .split(/[,\s]+/)
            .map(n => parseInt(n.trim()))
            .filter(n => !isNaN(n) && n >= 1 && n <= remainingCandidates.length);
          
          console.log(`[TM] íŒŒì‹±ëœ ë²ˆí˜¸: ${numbers.length}ê°œ`);
          
          // ë²ˆí˜¸ë¡œ ìƒí’ˆ ì¶”ê°€
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
        } catch (err) {
          console.warn('[TM] LLM ì„ íƒ ì‹¤íŒ¨:', err.message);
        }
      }
    }
    
    // 3. ë¶€ì¡±í•˜ë©´ core/keyword ë§¤ì¹­ëœ ê²ƒë§Œ ë³´ì¶© (class ë§¤ì¹­ì€ ì œì™¸)
    if (selected.length < MIN_GOODS) {
      console.log(`[TM] ${MIN_GOODS - selected.length}ê°œ ë³´ì¶© í•„ìš” (ê´€ë ¨ í•­ëª©ë§Œ)`);
      
      // core ë˜ëŠ” keyword ë§¤ì¹­ëœ ê²ƒë§Œ ë³´ì¶© (class ì „ì²´ ì¡°íšŒ ê²°ê³¼ëŠ” ì œì™¸)
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
      
      // â˜… 10ê°œ ë³´ìž¥: ê´€ë ¨ í›„ë³´ê°€ ë¶€ì¡±í•˜ë©´ í•´ë‹¹ ë¥˜ì˜ ì „ì²´ í›„ë³´ì—ì„œ ì±„ì›€
      if (selected.length < MIN_GOODS) {
        console.log(`[TM] ê´€ë ¨ í›„ë³´ ë¶€ì¡± (${selected.length}ê°œ), ${MIN_GOODS}ê°œê¹Œì§€ ì „ì²´ í›„ë³´ì—ì„œ ë³´ì¶©`);
        for (const c of candidates) {
          if (selected.length >= MIN_GOODS) break;
          if (usedNames.has(c.name)) continue;
          
          usedNames.add(c.name);
          selected.push({
            name: c.name,
            similarGroup: c.similarGroup,
            isCore: false
          });
        }
        console.log(`[TM] ë³´ì¶© í›„: ${selected.length}ê°œ`);
      }
    }
    
    console.log(`[TM] ì œ${classCode}ë¥˜ ìµœì¢…: ${selected.length}ê°œ`);
    
    return selected.slice(0, MIN_GOODS);
  };
  
  // ================================================================
  // â˜… ê³µí†µ: ì§€ì •ìƒí’ˆ 10ê°œ ë³´ìž¥ í•¨ìˆ˜ (DB ì¡°íšŒ + LLM ìƒì„± í´ë°±)
  // ================================================================
  TM.ensureMinGoods = async function(classCode, currentGoods, businessText) {
    const MIN = 10;
    if (currentGoods.length >= MIN) return currentGoods;
    
    const deficit = MIN - currentGoods.length;
    const existingNames = new Set(currentGoods.map(g => typeof g === 'string' ? g : g.name));
    const paddedCode = classCode.padStart(2, '0');
    
    console.log(`[TM] ensureMinGoods ì œ${classCode}ë¥˜: ${currentGoods.length}ê°œ â†’ ${deficit}ê°œ ë³´ì¶© í•„ìš”`);
    
    // 1ì°¨: DBì—ì„œ ë³´ì¶©
    try {
      const { data } = await App.sb
        .from('gazetted_goods_cache')
        .select('goods_name, similar_group_code')
        .eq('class_code', paddedCode)
        .limit(50);
      
      if (data) {
        for (const item of data) {
          if (currentGoods.length >= MIN) break;
          if (existingNames.has(item.goods_name)) continue;
          
          existingNames.add(item.goods_name);
          currentGoods.push({
            name: item.goods_name,
            similarGroup: item.similar_group_code,
            isCore: false,
            isRefill: true
          });
        }
      }
    } catch (e) {
      console.warn(`[TM] ensureMinGoods DB ë³´ì¶© ì‹¤íŒ¨:`, e.message);
    }
    
    // 2ì°¨: DBë¡œë„ ë¶€ì¡±í•˜ë©´ LLM ìƒì„±
    if (currentGoods.length < MIN) {
      try {
        const still = MIN - currentGoods.length;
        const existingList = currentGoods.map(g => typeof g === 'string' ? g : g.name).join(', ');
        const genPrompt = `ì œ${classCode}ë¥˜ ê³ ì‹œëª…ì¹­ ì¤‘ ì•„ëž˜ ì‚¬ì—…ê³¼ ê´€ë ¨ëœ ì§€ì •ìƒí’ˆ/ì„œë¹„ìŠ¤ë¥¼ ì •í™•ížˆ ${still}ê°œë§Œ ì¶”ì²œí•˜ì„¸ìš”.
ì‚¬ì—…: "${businessText}"
ì´ë¯¸ ì„ íƒë¨: ${existingList}
ìœ„ ëª©ë¡ê³¼ ì¤‘ë³µë˜ì§€ ì•ŠëŠ” ê²ƒë§Œ ì¶”ì²œ.
JSON ë°°ì—´ë¡œë§Œ ì‘ë‹µ: ["ìƒí’ˆëª…1", "ìƒí’ˆëª…2"]`;
        const resp = await App.callClaude(genPrompt, 300);
        const arr = JSON.parse((resp.text || '').match(/\[[\s\S]*\]/)?.[0] || '[]');
        for (const name of arr) {
          if (currentGoods.length >= MIN) break;
          if (existingNames.has(name)) continue;
          existingNames.add(name);
          currentGoods.push({ name, similarGroup: '', isCore: false, isLlmGenerated: true });
        }
      } catch (e) {
        console.warn(`[TM] ensureMinGoods LLM ë³´ì¶© ì‹¤íŒ¨:`, e.message);
      }
    }
    
    console.log(`[TM] ensureMinGoods ì œ${classCode}ë¥˜ ìµœì¢…: ${currentGoods.length}ê°œ`);
    return currentGoods.slice(0, MIN);
  };
  
  // ================================================================
  // ì¶”ì²œ ê²°ê³¼ ê²€ì¦ (Validation) - ê³ ë„í™” ë²„ì „
  // 3ë‹¨ê³„ ê²€ì¦: ë¥˜ ê²€ì¦ â†’ ì§€ì •ìƒí’ˆ ê²€ì¦ â†’ ëˆ„ë½ ê²€í† 
  // ================================================================
  TM.validateRecommendations = async function(businessInput, aiAnalysis) {
    if (!aiAnalysis || !aiAnalysis.recommendedClasses?.length) {
      return null;
    }
    
    console.log('[TM] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('[TM] ì¶”ì²œ ê²°ê³¼ 3ë‹¨ê³„ ê²€ì¦ ì‹œìž‘');
    console.log('[TM] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    
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
      replacementGoods: [],  // ëŒ€ì²´ ì¶”ì²œëœ ìƒí’ˆ
      warnings: [],
      suggestions: [],
      missingClasses: [],    // ëˆ„ë½ëœ ë¥˜
      missingGoods: []       // ëˆ„ë½ëœ ìƒí’ˆ
    };
    
    // ê²€ì¦ ë°ì´í„° ì¤€ë¹„
    const classRec = aiAnalysis.classRecommendations || {};
    const allClasses = [
      ...(classRec.core || []),
      ...(classRec.recommended || []),
      ...(classRec.expansion || [])
    ];
    
    // ==============================================
    // 1ë‹¨ê³„: ë¥˜ ì í•©ì„± ê²€ì¦
    // ==============================================
    console.log('[TM] â–¶ 1ë‹¨ê³„: ë¥˜ ì í•©ì„± ê²€ì¦');
    
    try {
      const classValidationPrompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.

ã€ì‚¬ì—… ë‚´ìš©ã€‘
"${businessInput}"

ã€ì¶”ì²œëœ ìƒí’ˆë¥˜ã€‘
${allClasses.map(c => `- ì œ${c.class}ë¥˜: ${c.reason}`).join('\n')}

ã€ê²€ì¦ ê³¼ì œã€‘
ê° ì¶”ì²œ ë¥˜ê°€ ìœ„ ì‚¬ì—…ê³¼ ì§ì ‘ì ìœ¼ë¡œ ê´€ë ¨ ìžˆëŠ”ì§€ ê²€ì¦í•˜ì„¸ìš”.

ê²€ì¦ ê¸°ì¤€:
1. í•´ë‹¹ ì‚¬ì—…ì—ì„œ ì‹¤ì œë¡œ íŒë§¤í•˜ê±°ë‚˜ ì œê³µí•˜ëŠ” ìƒí’ˆ/ì„œë¹„ìŠ¤ê°€ í¬í•¨ëœ ë¥˜ì¸ê°€?
2. í•´ë‹¹ ë¥˜ ì—†ì´ ì‚¬ì—…ì„ ì˜ìœ„í•  ìˆ˜ ì—†ëŠ”ê°€? (í•„ìˆ˜ì„±)
3. ì¶”ì²œ ì´ìœ ê°€ ì‚¬ì—… ë‚´ìš©ê³¼ ë…¼ë¦¬ì ìœ¼ë¡œ ì—°ê²°ë˜ëŠ”ê°€?

ã€JSONìœ¼ë¡œë§Œ ì‘ë‹µ â€” comment/reasonì€ 15ìž ì´ë‚´ë¡œ ê°„ê²°í•˜ê²Œã€‘
{
  "validClasses": [
    {"class": "31", "score": 95, "comment": "ê½ƒ ìž¬ë°° í•µì‹¬ ì‚¬ì—…"}
  ],
  "invalidClasses": [
    {"class": "42", "score": 20, "reason": "ITì„œë¹„ìŠ¤ ë¬´ê´€"}
  ],
  "classScoreAvg": 85
}`;

      const classResponse = await App.callClaude(classValidationPrompt, 2000);
      
      // max_tokens ì´ˆê³¼ ì‹œ ìž¬ì‹œë„ (ë” í° í† í°ìœ¼ë¡œ)
      let classText = classResponse.text;
      if (classResponse.stopReason === 'max_tokens') {
        console.warn('[TM] 1ë‹¨ê³„ ê²€ì¦ ì‘ë‹µ ìž˜ë¦¼, ìž¬ì‹œë„...');
        const retryResponse = await App.callClaude(classValidationPrompt + '\n\nâ˜… ë°˜ë“œì‹œ comment/reasonì„ 10ìž ì´ë‚´ë¡œ ê·¹ë„ë¡œ ê°„ê²°í•˜ê²Œ ìž‘ì„±í•˜ì„¸ìš”.', 3000);
        classText = retryResponse.text;
      }
      
      const classResult = TM.safeJsonParse(classText);
      
      validationResult.stages.classValidation = classResult;
      
      if (classResult.invalidClasses?.length > 0) {
        validationResult.hasIssues = true;
        validationResult.invalidClasses = classResult.invalidClasses;
        console.log(`[TM] ë¶€ì í•© ë¥˜ ë°œê²¬: ${classResult.invalidClasses.map(c => c.class).join(', ')}`);
      }
      
      console.log(`[TM] ë¥˜ ê²€ì¦ í‰ê·  ì ìˆ˜: ${classResult.classScoreAvg || 'N/A'}`);
      
    } catch (e) {
      console.warn('[TM] 1ë‹¨ê³„ ê²€ì¦ ì‹¤íŒ¨:', e.message);
    }
    
    // ==============================================
    // 2ë‹¨ê³„: ì§€ì •ìƒí’ˆë³„ ìƒì„¸ ê²€ì¦
    // ==============================================
    console.log('[TM] â–¶ 2ë‹¨ê³„: ì§€ì •ìƒí’ˆë³„ ìƒì„¸ ê²€ì¦');
    
    // ìœ íš¨í•œ ë¥˜ë§Œ ê²€ì¦ (1ë‹¨ê³„ì—ì„œ ë¬´íš¨ íŒì •ëœ ë¥˜ ì œì™¸)
    const invalidClassCodes = validationResult.invalidClasses.map(c => c.class);
    const validClassCodes = aiAnalysis.recommendedClasses.filter(c => !invalidClassCodes.includes(c));
    
    for (let ci = 0; ci < validClassCodes.length; ci++) {
      const classCode = validClassCodes[ci];
      const goods = aiAnalysis.recommendedGoods?.[classCode] || [];
      if (goods.length === 0) continue;
      
      // API rate limit ë°©ì§€ (ë¥˜ ê°„ 500ms ë”œë ˆì´)
      if (ci > 0) await new Promise(r => setTimeout(r, 500));
      
      try {
        const goodsValidationPrompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.

ã€ì‚¬ì—… ë‚´ìš©ã€‘
"${businessInput}"

ã€ì œ${classCode}ë¥˜ ì¶”ì²œ ì§€ì •ìƒí’ˆã€‘
${goods.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}

ã€ê²€ì¦ ê³¼ì œã€‘
ê° ì§€ì •ìƒí’ˆì´ ìœ„ ì‚¬ì—…ê³¼ ê´€ë ¨ ìžˆëŠ”ì§€ ê²€ì¦í•˜ì„¸ìš”.

â˜…â˜…â˜… íŠ¹ížˆ ì£¼ì˜í•  ì˜¤ë¥˜ ìœ í˜• â˜…â˜…â˜…
1. ë™ìŒì´ì˜ì–´: "ìƒí™”(ê½ƒ)"ì™€ "ìƒí™”í•™(í™”í•™)", "ê°€êµ¬(furniture)"ì™€ "ê°€êµ¬(å®¶å£)"
2. ë¶€ë¶„ ë¬¸ìžì—´ ë§¤ì¹­ ì˜¤ë¥˜: "ê½ƒ" ê²€ìƒ‰ ì‹œ "ê½ƒê²Œ", "ë¶ˆê½ƒ" ë“± ë¬´ê´€í•œ ìƒí’ˆ í¬í•¨
3. ì—…ì¢… ë¶ˆì¼ì¹˜: ì‚¬ì—… ë‚´ìš©ê³¼ ì „í˜€ ë‹¤ë¥¸ ë¶„ì•¼ì˜ ìƒí’ˆ
4. í™•ëŒ€ í•´ì„: ì‚¬ì—…ì—ì„œ ì‹¤ì œë¡œ ì·¨ê¸‰í•˜ì§€ ì•ŠëŠ” ìƒí’ˆ

ã€JSONìœ¼ë¡œë§Œ ì‘ë‹µ â€” comment/reasonì€ 15ìž ì´ë‚´ë¡œ ê°„ê²°í•˜ê²Œã€‘
{
  "validGoods": [
    {"name": "ìƒí™” ì†Œë§¤ì—…", "score": 95, "comment": "ê½ƒ íŒë§¤ ì§ì ‘ ê´€ë ¨"}
  ],
  "invalidGoods": [
    {"name": "ìƒí™”í•™ì  ì´‰ë§¤ ë„ë§¤ì—…", "score": 5, "reason": "ë™ìŒì´ì˜ì–´ ì˜¤ë¥˜", "errorType": "homonym"}
  ],
  "suggestedReplacements": [
    {"remove": "ìƒí™”í•™ì  ì´‰ë§¤ ë„ë§¤ì—…", "addInstead": "ì ˆí™” ì†Œë§¤ì—…", "reason": "ê½ƒ íŒë§¤ ì í•©"}
  ]
}`;

        const goodsResponse = await App.callClaude(goodsValidationPrompt, 2000);
        
        // max_tokens ì´ˆê³¼ ì‹œ ìž¬ì‹œë„
        let goodsText = goodsResponse.text;
        if (goodsResponse.stopReason === 'max_tokens') {
          console.warn(`[TM] ì œ${classCode}ë¥˜ ê²€ì¦ ì‘ë‹µ ìž˜ë¦¼, ìž¬ì‹œë„...`);
          const retryResponse = await App.callClaude(goodsValidationPrompt + '\n\nâ˜… ë°˜ë“œì‹œ comment/reasonì„ 10ìž ì´ë‚´ë¡œ ê·¹ë„ë¡œ ê°„ê²°í•˜ê²Œ ìž‘ì„±í•˜ì„¸ìš”. suggestedReplacementsëŠ” ìƒëžµ ê°€ëŠ¥.', 3000);
          goodsText = retryResponse.text;
        }
        
        const goodsResult = TM.safeJsonParse(goodsText);
        
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
          console.log(`[TM] ì œ${classCode}ë¥˜ ë¶€ì í•© ìƒí’ˆ: ${goodsResult.invalidGoods.map(g => g.name).join(', ')}`);
        }
        
        // ëŒ€ì²´ ì¶”ì²œ ì €ìž¥
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
        console.warn(`[TM] ì œ${classCode}ë¥˜ ê²€ì¦ ì‹¤íŒ¨:`, e.message);
      }
    }
    
    // ==============================================
    // 3ë‹¨ê³„: ëˆ„ë½ ê²€í†  (ë¹ ì§„ ë¥˜/ìƒí’ˆ í™•ì¸)
    // ==============================================
    console.log('[TM] â–¶ 3ë‹¨ê³„: ëˆ„ë½ ê²€í† ');
    
    try {
      const missingReviewPrompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ ë³€ë¦¬ì‚¬ìž…ë‹ˆë‹¤.

ã€ì‚¬ì—… ë‚´ìš©ã€‘
"${businessInput}"

ã€í˜„ìž¬ ì¶”ì²œëœ ë¥˜ã€‘
${allClasses.map(c => `ì œ${c.class}ë¥˜: ${c.reason}`).join('\n')}

ã€ê²€í†  ê³¼ì œã€‘
ìœ„ ì‚¬ì—…ì„ ì˜ìœ„í•˜ëŠ”ë° ë°˜ë“œì‹œ í•„ìš”í•˜ì§€ë§Œ ëˆ„ë½ëœ ìƒí’ˆë¥˜ê°€ ìžˆëŠ”ì§€ ê²€í† í•˜ì„¸ìš”.

ê²€í†  ê¸°ì¤€:
1. ì‚¬ì—…ì˜ í•µì‹¬ í™œë™ì„ ë³´í˜¸í•˜ê¸° ìœ„í•´ í•„ìˆ˜ì ì¸ ë¥˜ê°€ ë¹ ì¡ŒëŠ”ê°€?
2. íŒë§¤ ì±„ë„(ì˜¨ë¼ì¸/ì˜¤í”„ë¼ì¸)ì— ë”°ë¥¸ í•„ìˆ˜ ë¥˜ê°€ ìžˆëŠ”ê°€?
3. ê´€ë ¨ ì„œë¹„ìŠ¤(ìœ ì§€ë³´ìˆ˜, ì»¨ì„¤íŒ… ë“±)ì— í•„ìš”í•œ ë¥˜ê°€ ìžˆëŠ”ê°€?
4. ê²½ìŸì‚¬ê°€ ì¼ë°˜ì ìœ¼ë¡œ ë“±ë¡í•˜ëŠ” ë¥˜ ì¤‘ ë¹ ì§„ ê²ƒì´ ìžˆëŠ”ê°€?

ã€JSONìœ¼ë¡œë§Œ ì‘ë‹µã€‘
{
  "isSufficient": true/false,
  "missingClasses": [
    {"class": "44", "reason": "ê½ƒ ìž¥ì‹/ê½ƒê½‚ì´ ì„œë¹„ìŠ¤ëŠ” 44ë¥˜ì— í•´ë‹¹", "priority": "ê¶Œìž¥"}
  ],
  "missingGoods": [
    {"classCode": "31", "goodsName": "ë¶„ìž¬", "reason": "ì‹ë¬¼ íŒë§¤ ì‹œ ë¶„ìž¬ë„ í¬í•¨ ê¶Œìž¥"}
  ],
  "overallComment": "ì „ë°˜ì ì¸ ê²€í†  ì˜ê²¬"
}

ëˆ„ë½ì´ ì—†ìœ¼ë©´ isSufficient: true, missingClasses: [], missingGoods: []ë¡œ ì‘ë‹µí•˜ì„¸ìš”.
â˜… reason/commentëŠ” 15ìž ì´ë‚´ë¡œ ê°„ê²°í•˜ê²Œ ìž‘ì„±í•˜ì„¸ìš”.`;

      const missingResponse = await App.callClaude(missingReviewPrompt, 1500);
      
      // max_tokens ì´ˆê³¼ ì‹œ ìž¬ì‹œë„
      let missingText = missingResponse.text;
      if (missingResponse.stopReason === 'max_tokens') {
        console.warn('[TM] 3ë‹¨ê³„ ê²€ì¦ ì‘ë‹µ ìž˜ë¦¼, ìž¬ì‹œë„...');
        const retryResponse = await App.callClaude(missingReviewPrompt + '\n\nâ˜… ê·¹ë„ë¡œ ê°„ê²°í•˜ê²Œ ì‘ë‹µ. reason 10ìž ì´ë‚´.', 2500);
        missingText = retryResponse.text;
      }
      
      const missingResult = TM.safeJsonParse(missingText);
      
      validationResult.stages.missingReview = missingResult;
      
      if (missingResult.missingClasses?.length > 0) {
        validationResult.missingClasses = missingResult.missingClasses;
        validationResult.suggestions.push(...missingResult.missingClasses.map(c => ({
          type: 'add_class',
          class: c.class,
          reason: c.reason,
          priority: c.priority
        })));
        console.log(`[TM] ëˆ„ë½ëœ ë¥˜ ë°œê²¬: ${missingResult.missingClasses.map(c => c.class).join(', ')}`);
        
        // â˜… ëˆ„ë½ëœ ë¥˜ì— ëŒ€í•´ ì§€ì •ìƒí’ˆ 10ê°œ ë¯¸ë¦¬ ì¶”ì²œ
        const allKeywords = aiAnalysis.searchKeywords || [];
        const analysisCtx = {
          businessSummary: aiAnalysis.businessAnalysis,
          businessTypes: aiAnalysis.businessTypes,
          coreProducts: aiAnalysis.coreProducts,
          coreServices: aiAnalysis.coreServices,
          salesChannels: aiAnalysis.salesChannels,
          expansionPotential: aiAnalysis.expansionPotential,
          searchKeywords: allKeywords
        };
        
        for (const mc of missingResult.missingClasses) {
          const classCode = mc.class;
          if (aiAnalysis.recommendedGoods?.[classCode]?.length > 0) continue; // ì´ë¯¸ ìžˆìœ¼ë©´ ìŠ¤í‚µ
          
          try {
            const paddedCode = classCode.padStart(2, '0');
            const candidates = await TM.fetchOptimalCandidates(paddedCode, allKeywords, analysisCtx);
            let selectedGoods = [];
            if (candidates.length > 0) {
              selectedGoods = await TM.selectOptimalGoods(classCode, candidates, aiAnalysis.businessAnalysis || '', analysisCtx);
            }
            // â˜… 10ê°œ ë³´ìž¥
            selectedGoods = await TM.ensureMinGoods(classCode, selectedGoods, aiAnalysis.businessAnalysis || '');
            aiAnalysis.recommendedGoods[classCode] = selectedGoods;
            console.log(`[TM] ëˆ„ë½ ë¥˜ ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ${selectedGoods.length}ê°œ ì¶”ì²œ ì™„ë£Œ`);
          } catch (goodsErr) {
            console.warn(`[TM] ëˆ„ë½ ë¥˜ ì œ${classCode}ë¥˜ ì§€ì •ìƒí’ˆ ì¶”ì²œ ì‹¤íŒ¨:`, goodsErr);
            try {
              aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(classCode, [], '');
            } catch (e) {
              aiAnalysis.recommendedGoods[classCode] = [];
            }
          }
        }
      }
      
      if (missingResult.missingGoods?.length > 0) {
        validationResult.missingGoods = missingResult.missingGoods;
        console.log(`[TM] ëˆ„ë½ëœ ìƒí’ˆ ë°œê²¬: ${missingResult.missingGoods.map(g => g.goodsName).join(', ')}`);
      }
      
    } catch (e) {
      console.warn('[TM] 3ë‹¨ê³„ ê²€ì¦ ì‹¤íŒ¨:', e.message);
    }
    
    // ==============================================
    // ìµœì¢… ì ìˆ˜ ê³„ì‚° ë° ìš”ì•½
    // ==============================================
    const totalIssues = validationResult.invalidClasses.length + validationResult.invalidGoods.length;
    const totalItems = allClasses.length + aiAnalysis.recommendedClasses.reduce((sum, c) => 
      sum + (aiAnalysis.recommendedGoods?.[c]?.length || 0), 0);
    
    validationResult.overallScore = Math.max(0, Math.round(100 - (totalIssues / Math.max(totalItems, 1)) * 100));
    
    // ìš”ì•½ ìƒì„±
    if (totalIssues === 0 && validationResult.missingClasses.length === 0) {
      validationResult.summary = 'âœ… ëª¨ë“  ì¶”ì²œì´ ì‚¬ì—… ë‚´ìš©ê³¼ ì í•©í•©ë‹ˆë‹¤.';
    } else {
      const parts = [];
      if (validationResult.invalidClasses.length > 0) {
        parts.push(`ë¶€ì í•© ë¥˜ ${validationResult.invalidClasses.length}ê°œ ì œê±°ë¨`);
      }
      if (validationResult.invalidGoods.length > 0) {
        parts.push(`ë¶€ì í•© ìƒí’ˆ ${validationResult.invalidGoods.length}ê°œ ì œê±°ë¨`);
      }
      if (validationResult.missingClasses.length > 0) {
        parts.push(`ì¶”ê°€ ê¶Œìž¥ ë¥˜ ${validationResult.missingClasses.length}ê°œ`);
      }
      validationResult.summary = parts.join(', ');
    }
    
    console.log('[TM] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log(`[TM] ê²€ì¦ ì™„ë£Œ - ì ìˆ˜: ${validationResult.overallScore}ì `);
    console.log(`[TM] ìš”ì•½: ${validationResult.summary}`);
    console.log('[TM] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    
    return validationResult;
  };
  
  // ================================================================
  // ê²€ì¦ ê²°ê³¼ ì ìš© (ìž˜ëª»ëœ í•­ëª© ì œê±° + ëŒ€ì²´ ì¶”ì²œ)
  // ================================================================
  TM.applyValidationResult = async function(aiAnalysis, validationResult) {
    if (!validationResult || !validationResult.hasIssues) return;
    
    console.log('[TM] ê²€ì¦ ê²°ê³¼ ì ìš© ì‹œìž‘');
    
    // 1. ìž˜ëª»ëœ ë¥˜ ì œê±°
    if (validationResult.invalidClasses?.length > 0) {
      for (const invalidClass of validationResult.invalidClasses) {
        const classCode = invalidClass.class;
        
        // recommendedClassesì—ì„œ ì œê±°
        const idx = aiAnalysis.recommendedClasses.indexOf(classCode);
        if (idx > -1) {
          aiAnalysis.recommendedClasses.splice(idx, 1);
        }
        
        // classRecommendationsì—ì„œ ì œê±°
        ['core', 'recommended', 'expansion'].forEach(cat => {
          if (aiAnalysis.classRecommendations?.[cat]) {
            aiAnalysis.classRecommendations[cat] = 
              aiAnalysis.classRecommendations[cat].filter(c => c.class !== classCode);
          }
        });
        
        // ê´€ë ¨ ë°ì´í„° ì œê±°
        delete aiAnalysis.classReasons?.[classCode];
        delete aiAnalysis.recommendedGoods?.[classCode];
        
        console.log(`[TM] âœ— ì œ${classCode}ë¥˜ ì œê±°: ${invalidClass.reason}`);
      }
    }
    
    // 2. ìž˜ëª»ëœ ì§€ì •ìƒí’ˆ ì œê±°
    if (validationResult.invalidGoods?.length > 0) {
      for (const invalidGood of validationResult.invalidGoods) {
        const { classCode, goodsName } = invalidGood;
        
        if (aiAnalysis.recommendedGoods?.[classCode]) {
          const before = aiAnalysis.recommendedGoods[classCode].length;
          aiAnalysis.recommendedGoods[classCode] = 
            aiAnalysis.recommendedGoods[classCode].filter(g => g.name !== goodsName);
          const after = aiAnalysis.recommendedGoods[classCode].length;
          
          if (before !== after) {
            console.log(`[TM] âœ— ì œ${classCode}ë¥˜ "${goodsName}" ì œê±°: ${invalidGood.reason}`);
          }
        }
      }
    }
    
    // 3. ëŒ€ì²´ ìƒí’ˆ ì¶”ê°€ (DBì—ì„œ ì¡°íšŒ)
    if (validationResult.replacementGoods?.length > 0) {
      for (const replacement of validationResult.replacementGoods) {
        const { classCode, addInstead, reason } = replacement;
        
        // ì´ë¯¸ ìžˆëŠ”ì§€ í™•ì¸
        const existingGoods = aiAnalysis.recommendedGoods?.[classCode] || [];
        const alreadyExists = existingGoods.some(g => g.name === addInstead);
        
        if (!alreadyExists) {
          // DBì—ì„œ í•´ë‹¹ ìƒí’ˆ ì¡°íšŒ
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
              console.log(`[TM] âœ“ ì œ${classCode}ë¥˜ "${data[0].goods_name}" ëŒ€ì²´ ì¶”ê°€`);
            }
          } catch (e) {
            console.warn(`[TM] ëŒ€ì²´ ìƒí’ˆ ì¡°íšŒ ì‹¤íŒ¨: ${addInstead}`);
          }
        }
      }
    }
    
    console.log('[TM] ê²€ì¦ ê²°ê³¼ ì ìš© ì™„ë£Œ');
    
    // 4. â˜…â˜…â˜… ì œê±° í›„ 10ê°œ ë¯¸ë§Œì¸ ë¥˜ì— ëŒ€í•´ ë³´ì¶© â˜…â˜…â˜…
    const allKeywords = aiAnalysis.searchKeywords || [];
    const analysisCtx = {
      businessSummary: aiAnalysis.businessAnalysis,
      businessTypes: aiAnalysis.businessTypes,
      coreProducts: aiAnalysis.coreProducts,
      coreServices: aiAnalysis.coreServices,
      salesChannels: aiAnalysis.salesChannels,
      expansionPotential: aiAnalysis.expansionPotential,
      searchKeywords: allKeywords
    };
    
    for (const classCode of (aiAnalysis.recommendedClasses || [])) {
      const currentGoods = aiAnalysis.recommendedGoods?.[classCode] || [];
      if (currentGoods.length >= 10) continue;
      
      const deficit = 10 - currentGoods.length;
      console.log(`[TM] ì œ${classCode}ë¥˜ ê²€ì¦ í›„ ${currentGoods.length}ê°œ â†’ ${deficit}ê°œ ë³´ì¶© í•„ìš”`);
      
      try {
        const paddedCode = classCode.padStart(2, '0');
        const existingNames = new Set(currentGoods.map(g => g.name));
        
        // DBì—ì„œ ì¶”ê°€ í›„ë³´ ì¡°íšŒ
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', paddedCode)
          .limit(50);
        
        if (data) {
          let added = 0;
          for (const item of data) {
            if (added >= deficit) break;
            if (existingNames.has(item.goods_name)) continue;
            
            existingNames.add(item.goods_name);
            aiAnalysis.recommendedGoods[classCode].push({
              name: item.goods_name,
              similarGroup: item.similar_group_code,
              isCore: false,
              isRefill: true
            });
            added++;
          }
          console.log(`[TM] ì œ${classCode}ë¥˜ ${added}ê°œ ë³´ì¶© â†’ ì´ ${aiAnalysis.recommendedGoods[classCode].length}ê°œ`);
        }
      } catch (e) {
        console.warn(`[TM] ì œ${classCode}ë¥˜ ë³´ì¶© ì‹¤íŒ¨:`, e.message);
      }
    }
  };
  
  // ================================================================
  // ì‚¬ìš©ìž ìž…ë ¥ì—ì„œ í‚¤ì›Œë“œ ì¶”ì¶œ
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
    
    const words = input.replace(/[^\wê°€-íž£]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const suffixes = ['ì‚¬ì—…', 'ì—…', 'ì‚¬', 'ì„œë¹„ìŠ¤', 'íšŒì‚¬', 'ì—…ì²´'];
    
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
  // DBì—ì„œ ê³ ì‹œëª…ì¹­ ì¡°íšŒ (ì§ì ‘ ë§¤ì¹­ ìš°ì„ )
  // ================================================================
  TM.fetchCandidatesWithSimilarGroups = async function(classCode, coreSimilarGroups, keywords) {
    const results = [];
    const seen = new Set();
    
    console.log(`[TM] â•â•â•â• DB ê²€ìƒ‰: ì œ${classCode}ë¥˜ â•â•â•â•`);
    console.log(`[TM] ê²€ìƒ‰ í‚¤ì›Œë“œ:`, keywords.slice(0, 5));
    
    // 1. í‚¤ì›Œë“œ ê¸°ë°˜ ê²€ìƒ‰
    for (const keyword of keywords.slice(0, 15)) {
      try {
        const { data, error } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode)
          .ilike('goods_name', `%${keyword}%`)
          .limit(50);
        
        if (error) {
          console.warn(`[TM] í‚¤ì›Œë“œ ê²€ìƒ‰ ì˜¤ë¥˜ (${keyword}):`, error.message);
          continue;
        }
        
        if (data && data.length > 0) {
          console.log(`[TM] í‚¤ì›Œë“œ "${keyword}" â†’ ${data.length}ê±´`);
          
          data.forEach(item => {
            if (!seen.has(item.goods_name)) {
              seen.add(item.goods_name);
              
              const nameLower = item.goods_name.toLowerCase();
              const kwLower = keyword.toLowerCase();
              
              // ìš°ì„ ìˆœìœ„ ê³„ì‚°: ì§ì ‘ ë§¤ì¹­ > ì‹œìž‘ ë§¤ì¹­ > í¬í•¨ ë§¤ì¹­
              let priority = 3;
              if (nameLower === kwLower || nameLower === kwLower + 'ì—…') {
                priority = 0; // ìµœìš°ì„  (ë³€ë¦¬ â†’ ë³€ë¦¬ì—…)
              } else if (nameLower.startsWith(kwLower)) {
                priority = 1; // ì‹œìž‘ ë§¤ì¹­
              } else if (nameLower.includes(kwLower)) {
                priority = 2; // í¬í•¨ ë§¤ì¹­
              }
              
              // í•µì‹¬ ìœ ì‚¬êµ° ì—¬ë¶€
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
        console.warn(`[TM] í‚¤ì›Œë“œ ê²€ìƒ‰ ì‹¤íŒ¨ (${keyword}):`, err.message);
      }
    }
    
    console.log(`[TM] í‚¤ì›Œë“œ ê²€ìƒ‰ ê²°ê³¼: ${results.length}ê±´`);
    
    // 2. í•µì‹¬ ìœ ì‚¬êµ°ì½”ë“œë¡œ ì¶”ê°€ ê²€ìƒ‰
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
            console.log(`[TM] ìœ ì‚¬êµ° "${sgCode}" â†’ ${data.length}ê±´`);
            
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
          // ë¬´ì‹œ
        }
      }
    }
    
    // 3. í›„ë³´ê°€ ë¶€ì¡±í•˜ë©´ í•´ë‹¹ ë¥˜ ì „ì²´ì—ì„œ ì¶”ê°€
    if (results.length < 50) {
      try {
        console.log(`[TM] í›„ë³´ ë¶€ì¡± (${results.length}ê±´), ì¶”ê°€ ì¡°íšŒ...`);
        
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
        // ë¬´ì‹œ
      }
    }
    
    // â˜… ìš°ì„ ìˆœìœ„ìˆœ ì •ë ¬ (ì§ì ‘ ë§¤ì¹­ â†’ ì‹œìž‘ ë§¤ì¹­ â†’ í¬í•¨ ë§¤ì¹­ â†’ ê¸°íƒ€)
    results.sort((a, b) => a.priority - b.priority);
    
    console.log(`[TM] ì´ í›„ë³´: ${results.length}ê±´`);
    if (results.length > 0) {
      console.log(`[TM] ìƒìœ„ 5ê°œ: ${results.slice(0, 5).map(r => r.name).join(', ')}`);
    }
    
    return results;
  };
  
  // ================================================================
  // LLMì—ê²Œ ë²ˆí˜¸ë¡œë§Œ ì„ íƒí•˜ë„ë¡ ìš”ì²­ + ì§ì ‘ ë§¤ì¹­ ìƒí’ˆ ìžë™ í¬í•¨
  // ================================================================
  TM.selectGoodsWithLLM = async function(classCode, candidates, businessText, coreActivity) {
    const MIN_GOODS = 10;
    const selected = [];
    const usedNames = new Set();
    
    // â˜…â˜…â˜… 1. ì‚¬ìš©ìž ìž…ë ¥ê³¼ ì§ì ‘ ë§¤ì¹­ë˜ëŠ” ìƒí’ˆ ìžë™ í¬í•¨ (ìµœìš°ì„ ) â˜…â˜…â˜…
    const inputKeywords = TM.extractKeywordsFromInput(businessText);
    console.log(`[TM] ì§ì ‘ ë§¤ì¹­ ê²€ìƒ‰ í‚¤ì›Œë“œ:`, inputKeywords);
    
    for (const keyword of inputKeywords) {
      const kwLower = keyword.toLowerCase();
      
      for (const c of candidates) {
        if (usedNames.has(c.name)) continue;
        
        const nameLower = c.name.toLowerCase();
        
        // ì™„ì „ ì¼ì¹˜ ë˜ëŠ” "í‚¤ì›Œë“œ+ì—…" íŒ¨í„´ (ë³€ë¦¬ â†’ ë³€ë¦¬ì—…)
        if (nameLower === kwLower || 
            nameLower === kwLower + 'ì—…' ||
            nameLower === kwLower + 'ì‚¬ì—…' ||
            nameLower.startsWith(kwLower + ' ') ||
            nameLower.startsWith(kwLower + 'ì—…') ||
            (nameLower.includes(kwLower) && nameLower.length <= kwLower.length + 5)) {
          
          console.log(`[TM] â˜… ì§ì ‘ ë§¤ì¹­: "${keyword}" â†’ "${c.name}"`);
          usedNames.add(c.name);
          selected.push({
            name: c.name,
            similarGroup: c.similarGroup,
            isCore: true,
            reason: `"${keyword}" ì§ì ‘ ë§¤ì¹­`
          });
          break; // í‚¤ì›Œë“œë‹¹ 1ê°œë§Œ
        }
      }
    }
    
    console.log(`[TM] ì§ì ‘ ë§¤ì¹­ ê²°ê³¼: ${selected.length}ê°œ`);
    
    // ì´ë¯¸ 10ê°œë©´ ë°˜í™˜
    if (selected.length >= MIN_GOODS) {
      return selected.slice(0, MIN_GOODS);
    }
    
    // â˜…â˜…â˜… 2. LLM ì„ íƒ (ë²ˆí˜¸ë¡œë§Œ ì‘ë‹µ) â˜…â˜…â˜…
    const remainingCandidates = candidates.filter(c => !usedNames.has(c.name));
    
    if (remainingCandidates.length > 0) {
      const numberedList = remainingCandidates.slice(0, 50).map((c, i) => 
        `[${i + 1}] ${c.name} (${c.similarGroup || '?'})${c.fromCoreSG ? ' â˜…' : ''}`
      ).join('\n');
      
      const selectPrompt = `ì‚¬ì—…: ${businessText}

ã€ì œ${classCode}ë¥˜ ê³ ì‹œëª…ì¹­ã€‘
${numberedList}

ìœ„ ëª©ë¡ì—ì„œ ì‚¬ì—…ê³¼ ê´€ë ¨ëœ ${MIN_GOODS - selected.length}ê°œë¥¼ ì„ íƒí•˜ì„¸ìš”.
â˜… í‘œì‹œëŠ” í•µì‹¬ ìœ ì‚¬êµ°ìž…ë‹ˆë‹¤.

ì‘ë‹µ: ìˆ«ìžë§Œ ì‰¼í‘œë¡œ (ì˜ˆ: 1,2,3,4,5)
ì„ íƒ:`;

      try {
        const response = await App.callClaude(selectPrompt, 200);
        const responseText = (response.text || '').trim();
        
        console.log(`[TM] LLM ì‘ë‹µ: "${responseText.substring(0, 80)}..."`);
        
        // ë²ˆí˜¸ íŒŒì‹±
        const numbers = responseText
          .replace(/[^\d,\s]/g, '')
          .split(/[,\s]+/)
          .map(n => parseInt(n.trim()))
          .filter(n => !isNaN(n) && n >= 1 && n <= remainingCandidates.length);
        
        console.log(`[TM] íŒŒì‹±ëœ ë²ˆí˜¸: ${numbers.length}ê°œ`);
        
        // ë²ˆí˜¸ë¡œ ìƒí’ˆ ì¶”ê°€
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
        console.warn('[TM] LLM ì„ íƒ ì‹¤íŒ¨:', err.message);
      }
    }
    
    // â˜…â˜…â˜… 3. ë¶€ì¡±í•˜ë©´ ìš°ì„ ìˆœìœ„ìˆœ ë³´ì¶© â˜…â˜…â˜…
    if (selected.length < MIN_GOODS) {
      console.log(`[TM] ${MIN_GOODS - selected.length}ê°œ ë³´ì¶© í•„ìš”`);
      
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
    
    console.log(`[TM] ì œ${classCode}ë¥˜ ìµœì¢…: ${selected.length}ê°œ`);
    if (selected.length > 0) {
      console.log(`[TM]   â†’ ${selected.slice(0, 3).map(s => s.name).join(', ')}...`);
    }
    
    return selected.slice(0, MIN_GOODS);
  };
  
  // ìœ ì‚¬êµ°ì½”ë“œ ì»¤ë²„ë¦¬ì§€ ìµœì í™” ì„ íƒ
  TM.optimizeSimilarCodeCoverage = function(candidates, targetCount = 10, options = {}) {
    const { minPerCode = 1, maxPerCode = 2, priorityCodes = [] } = options;
    
    // 1. ìœ ì‚¬êµ°ì½”ë“œë³„ ê·¸ë£¹í•‘
    const groupedByCode = {};
    candidates.forEach(c => {
      const code = c.similar_group_code || 'UNKNOWN';
      if (!groupedByCode[code]) groupedByCode[code] = [];
      groupedByCode[code].push(c);
    });
    
    // 2. ìœ ì‚¬êµ°ì½”ë“œ ì •ë ¬ (ìš°ì„ ìˆœìœ„ ì½”ë“œ ë¨¼ì €, ê·¸ ë‹¤ìŒ ìµœê³ ì ìˆ˜ ìˆœ)
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
    
    // 3. ë¼ìš´ë“œ 1: ê° ìœ ì‚¬êµ°ì½”ë“œì—ì„œ ìµœì†Œ minPerCodeê°œ ì„ íƒ
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
          source: 'gazetted' // ê³ ì‹œëª…ì¹­
        });
        usedCodes.set(code, (usedCodes.get(code) || 0) + 1);
      }
    }
    
    // 4. ë¼ìš´ë“œ 2: ê³ ë“ì  í•­ëª© ì¶”ê°€ (targetCountê¹Œì§€)
    if (selectedGoods.length < targetCount) {
      const remaining = candidates
        .filter(c => !selectedGoods.some(s => s.name === c.goods_name))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      
      for (const c of remaining) {
        if (selectedGoods.length >= targetCount) break;
        
        const code = c.similar_group_code || 'UNKNOWN';
        const codeCount = usedCodes.get(code) || 0;
        
        // ê°™ì€ ì½”ë“œì—ì„œ maxPerCode ì´ˆê³¼ ì‹œ ìŠ¤í‚µ (ë‹¤ì–‘ì„± í™•ë³´)
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
    
    // 5. ì»¤ë²„ë¦¬ì§€ í†µê³„ ìƒì„±
    const coverageStats = {
      totalSelected: selectedGoods.length,
      uniqueCodes: usedCodes.size,
      codeDistribution: Object.fromEntries(usedCodes)
    };
    
    console.log(`[TM] ì»¤ë²„ë¦¬ì§€ ìµœì í™”: ${selectedGoods.length}ê°œ ì„ íƒ, ${usedCodes.size}ê°œ ìœ ì‚¬êµ° ì»¤ë²„`);
    
    return { selectedGoods, coverageStats };
  };
  
  // ============================================================
  // ë¹„ê³ ì‹œëª…ì¹­ ì²˜ë¦¬ (ì‚¬ìš©ìž ì§ì ‘ ìž…ë ¥)
  // - í‘œì¤€ëª…ì¹­ ë§¤í•‘
  // - ìœ ì‚¬êµ°ì½”ë“œ ì¶”ì •
  // - ë¦¬ìŠ¤í¬ ê²½ê³ 
  // ============================================================
  
  TM.processCustomTerm = async function(rawTerm, classCode) {
    if (!rawTerm || rawTerm.trim().length < 2) {
      return { error: 'ì§€ì •ìƒí’ˆëª…ì„ 2ìž ì´ìƒ ìž…ë ¥í•´ì£¼ì„¸ìš”.' };
    }
    
    const normalizedTerm = TM.normalizeCustomTerm(rawTerm);
    console.log(`[TM] ë¹„ê³ ì‹œëª…ì¹­ ì²˜ë¦¬: "${rawTerm}" â†’ "${normalizedTerm}"`);
    
    // 1. í‘œì¤€ëª…ì¹­(ê³ ì‹œëª…ì¹­) ë§¤í•‘ ê²€ìƒ‰
    const mappingResults = await TM.findSimilarGazettedTerms(normalizedTerm, classCode);
    
    // 2. ì‹ ë¢°ë„ ê³„ì‚°
    const confidence = mappingResults.length > 0 ? mappingResults[0].similarity : 0;
    
    // 3. ìœ ì‚¬êµ°ì½”ë“œ ì¶”ì •
    let estimatedSimilarGroup = null;
    if (mappingResults.length > 0 && mappingResults[0].similarity >= 0.5) {
      estimatedSimilarGroup = mappingResults[0].similar_group_code;
    }
    
    // 4. ë¦¬ìŠ¤í¬ ë¶„ì„
    const riskAnalysis = TM.analyzeCustomTermRisk(normalizedTerm, confidence);
    
    // 5. ì²˜ë¦¬ ê¶Œìž¥ì‚¬í•­ ê²°ì •
    let recommendation = '';
    let status = 'warning';
    
    if (confidence >= 0.80) {
      recommendation = `í‘œì¤€ëª…ì¹­ "${mappingResults[0].goods_name}"ìœ¼ë¡œ ëŒ€ì²´ë¥¼ ê°•ë ¥ ê¶Œìž¥í•©ë‹ˆë‹¤.`;
      status = 'replace_recommended';
    } else if (confidence >= 0.60) {
      recommendation = 'ë¹„ê³ ì‹œëª…ì¹­ ìœ ì§€ ê°€ëŠ¥í•˜ë‚˜, ë³´ì • ìš”ì²­ ê°€ëŠ¥ì„±ì´ ìžˆìŠµë‹ˆë‹¤. í‘œì¤€ëª…ì¹­ ë³‘ê¸°ë¥¼ ê¶Œìž¥í•©ë‹ˆë‹¤.';
      status = 'usable_with_warning';
    } else if (confidence >= 0.40) {
      recommendation = 'í‘œì¤€ëª…ì¹­ê³¼ ë§¤ì¹­ì´ ë‚®ìŠµë‹ˆë‹¤. ì‹¬ì‚¬ ì‹œ ê±°ì ˆ ë˜ëŠ” ë³´ì • ê°€ëŠ¥ì„±ì´ ë†’ìŠµë‹ˆë‹¤.';
      status = 'high_risk';
    } else {
      recommendation = 'ë§¤ì¹­ë˜ëŠ” í‘œì¤€ëª…ì¹­ì„ ì°¾ê¸° ì–´ë µìŠµë‹ˆë‹¤. ëª…ì¹­ ìž¬ê²€í† ë¥¼ ê¶Œìž¥í•©ë‹ˆë‹¤.';
      status = 'very_high_risk';
    }
    
    return {
      originalTerm: rawTerm,
      normalizedTerm: normalizedTerm,
      confidence: confidence,
      estimatedSimilarGroup: estimatedSimilarGroup,
      mappingCandidates: mappingResults.slice(0, 3), // ìƒìœ„ 3ê°œ
      riskAnalysis: riskAnalysis,
      recommendation: recommendation,
      status: status,
      isGazetted: false, // ë¹„ê³ ì‹œëª…ì¹­
      feeNote: 'ë¹„ê³ ì‹œëª…ì¹­ ì‚¬ìš© ì‹œ ë¥˜ë‹¹ +6,000ì› (52,000ì›/ë¥˜)'
    };
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ì •ê·œí™”
  TM.normalizeCustomTerm = function(rawTerm) {
    let term = rawTerm.trim();
    
    // 1. ë¶ˆí•„ìš”í•œ ë¬¸ìž ì œê±°
    term = term.replace(/[""'']/g, '');
    term = term.replace(/\s+/g, ' ');
    
    // 2. ì„œë¹„ìŠ¤ì—… í‘œê¸° í†µì¼
    if (!term.endsWith('ì—…') && !term.endsWith('í’ˆ') && !term.endsWith('ê¸°') && !term.endsWith('ê¸°ê¸°')) {
      // í–‰ìœ„ì„± ëª…ì‚¬ë¡œ ëë‚˜ë©´ 'ì—…' ì¶”ê°€ ê¶Œìž¥
      const serviceEndings = ['ì„œë¹„ìŠ¤', 'ì œê³µ', 'ì¤‘ê°œ', 'ëŒ€í–‰', 'ì»¨ì„¤íŒ…', 'êµìœ¡', 'íŒë§¤', 'ê°œë°œ'];
      for (const ending of serviceEndings) {
        if (term.endsWith(ending)) {
          term = term + 'ì—…';
          break;
        }
      }
    }
    
    return term;
  };
  
  // ìœ ì‚¬ ê³ ì‹œëª…ì¹­ ê²€ìƒ‰ (í…ìŠ¤íŠ¸ ìœ ì‚¬ë„ ê¸°ë°˜)
  TM.findSimilarGazettedTerms = async function(term, classCode) {
    const results = [];
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/[\s,/]+/).filter(w => w.length > 1);
    
    try {
      // 1. ë¶€ë¶„ ì¼ì¹˜ ê²€ìƒ‰
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
              
              // ìœ ì‚¬ë„ ê³„ì‚° (ë‹¨ìˆœ ë‹¨ì–´ ê²¹ì¹¨ ê¸°ë°˜)
              const gazettedLower = item.goods_name.toLowerCase();
              const gazettedWords = gazettedLower.split(/[\s,/]+/).filter(w => w.length > 1);
              
              // Jaccard ìœ ì‚¬ë„ + ë¶€ë¶„ ì¼ì¹˜ ë³´ë„ˆìŠ¤
              const intersection = termWords.filter(w => 
                gazettedWords.some(gw => gw.includes(w) || w.includes(gw))
              ).length;
              const union = new Set([...termWords, ...gazettedWords]).size;
              let similarity = union > 0 ? intersection / union : 0;
              
              // ì™„ì „ í¬í•¨ ë³´ë„ˆìŠ¤
              if (gazettedLower.includes(termLower) || termLower.includes(gazettedLower)) {
                similarity += 0.3;
              }
              
              // ì‹œìž‘ ì¼ì¹˜ ë³´ë„ˆìŠ¤
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
      
      // 2. ìœ ì‚¬ë„ ìˆœ ì •ë ¬
      results.sort((a, b) => b.similarity - a.similarity);
      
    } catch (err) {
      console.error('[TM] ìœ ì‚¬ ëª…ì¹­ ê²€ìƒ‰ ì‹¤íŒ¨:', err);
    }
    
    return results.slice(0, 10);
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ë¦¬ìŠ¤í¬ ë¶„ì„
  TM.analyzeCustomTermRisk = function(term, confidence) {
    const risks = [];
    const warnings = [];
    
    // 1. ê³¼í¬ê´„ ìš©ì–´ ì²´í¬
    const broadTerms = ['ì¼ë°˜', 'ì¢…í•©', 'ì „ë°˜', 'ëª¨ë“ ', 'ê°ì¢…', 'ê¸°íƒ€'];
    broadTerms.forEach(bt => {
      if (term.includes(bt)) {
        risks.push(`"${bt}" - ê³¼í¬ê´„ ìš©ì–´ë¡œ ë³´ì • ìš”ì²­ ê°€ëŠ¥ì„±`);
      }
    });
    
    // 2. ë¶ˆëª…í™• í‘œí˜„ ì²´í¬
    const vagueTerms = ['ë“±', 'ë°', 'ê´€ë ¨', 'ê¸°ë°˜'];
    vagueTerms.forEach(vt => {
      if (term.includes(vt) && term.split(vt).length > 2) {
        warnings.push(`"${vt}" ë‹¤ìˆ˜ ì‚¬ìš© - ëª…í™•ì„± ê²€í†  í•„ìš”`);
      }
    });
    
    // 3. ì„œë¹„ìŠ¤/ìƒí’ˆ êµ¬ë¶„ ì²´í¬
    const isService = term.endsWith('ì—…') || term.endsWith('ì„œë¹„ìŠ¤');
    const isGoods = term.endsWith('í’ˆ') || term.endsWith('ê¸°') || term.endsWith('ê¸°ê¸°') || term.endsWith('ìž¥ì¹˜');
    
    if (!isService && !isGoods) {
      warnings.push('ì„œë¹„ìŠ¤ì—…(~ì—…)ì¸ì§€ ìƒí’ˆ(~í’ˆ, ~ê¸°)ì¸ì§€ ëª…í™•ížˆ í‘œê¸° ê¶Œìž¥');
    }
    
    // 4. ì˜ë¬¸ í˜¼ìš© ì²´í¬
    if (/[a-zA-Z]/.test(term) && /[ê°€-íž£]/.test(term)) {
      warnings.push('í•œê¸€/ì˜ë¬¸ í˜¼ìš© - ì‹¬ì‚¬ ì‹œ ëª…í™•ì„± ì´ìŠˆ ê°€ëŠ¥');
    }
    
    // 5. ê¸¸ì´ ì²´í¬
    if (term.length > 30) {
      warnings.push('ëª…ì¹­ì´ ê¸¸ì–´ ì‹¬ì‚¬ ì‹œ ì¶•ì•½ ìš”ì²­ ê°€ëŠ¥ì„±');
    }
    
    // 6. ì‹ ë¢°ë„ ê¸°ë°˜ ì¶”ê°€ ë¦¬ìŠ¤í¬
    if (confidence < 0.40) {
      risks.push('í‘œì¤€ëª…ì¹­ê³¼ ë§¤ì¹­ë„ ë‚®ìŒ - ê±°ì ˆ ê°€ëŠ¥ì„± ë†’ìŒ');
    }
    
    return {
      riskLevel: risks.length > 0 ? 'high' : (warnings.length > 0 ? 'medium' : 'low'),
      risks: risks,
      warnings: warnings
    };
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ì„ í”„ë¡œì íŠ¸ì— ì¶”ê°€
  TM.addCustomTermToProject = async function(classCode, customTermResult) {
    const p = TM.currentProject;
    
    // í•´ë‹¹ ë¥˜ì˜ ì§€ì •ìƒí’ˆ ë°°ì—´ ì°¾ê¸°
    let classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) {
      // í•´ë‹¹ ë¥˜ê°€ ì—†ìœ¼ë©´ ì¶”ê°€
      classData = {
        classCode: classCode,
        goods: [],
        goodsCount: 0
      };
      p.designatedGoods.push(classData);
    }
    
    // ì¤‘ë³µ ì²´í¬
    if (classData.goods.some(g => g.name === customTermResult.normalizedTerm)) {
      App.showToast('ì´ë¯¸ ì¶”ê°€ëœ ì§€ì •ìƒí’ˆìž…ë‹ˆë‹¤.', 'warning');
      return false;
    }
    
    // ë¹„ê³ ì‹œëª…ì¹­ ì¶”ê°€
    classData.goods.push({
      name: customTermResult.normalizedTerm,
      similarGroup: customTermResult.estimatedSimilarGroup || '(ì¶”ì •í•„ìš”)',
      isGazetted: false,
      isCustom: true, // ì‚¬ìš©ìž ì§ì ‘ ìž…ë ¥ í‘œì‹œ
      confidence: customTermResult.confidence,
      mappingCandidates: customTermResult.mappingCandidates,
      riskLevel: customTermResult.riskAnalysis.riskLevel
    });
    
    classData.goodsCount = classData.goods.length;
    
    // ë¹„ê³ ì‹œëª…ì¹­ ì‚¬ìš© ì‹œ gazettedOnly í•´ì œ
    if (p.gazettedOnly) {
      p.gazettedOnly = false;
      App.showToast('ë¹„ê³ ì‹œëª…ì¹­ ì¶”ê°€ë¡œ "ë¹„ê³ ì‹œ í—ˆìš©" ëª¨ë“œë¡œ ë³€ê²½ë˜ì—ˆìŠµë‹ˆë‹¤.', 'info');
    }
    
    TM.hasUnsavedChanges = true;
    
    return true;
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ ì‚­ì œ
  TM.removeCustomTerm = function(classCode, termName) {
    const p = TM.currentProject;
    const classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) return;
    
    const idx = classData.goods.findIndex(g => g.name === termName && g.isCustom);
    if (idx !== -1) {
      classData.goods.splice(idx, 1);
      classData.goodsCount = classData.goods.length;
      TM.hasUnsavedChanges = true;
      
      App.showToast(`ë¹„ê³ ì‹œëª…ì¹­ "${termName}" ì‚­ì œë¨`, 'info');
      TM.renderCurrentStep();
    }
  };
  
  // ë¹„ê³ ì‹œëª…ì¹­ì„ í‘œì¤€ëª…ì¹­ìœ¼ë¡œ ëŒ€ì²´
  TM.replaceCustomTerm = async function(classCode, oldTerm, newTerm) {
    const p = TM.currentProject;
    const classData = p.designatedGoods.find(g => g.classCode === classCode);
    
    if (!classData) return;
    
    // ê¸°ì¡´ ë¹„ê³ ì‹œëª…ì¹­ ì°¾ê¸°
    const idx = classData.goods.findIndex(g => g.name === oldTerm && g.isCustom);
    if (idx === -1) return;
    
    // ìƒˆ í‘œì¤€ëª…ì¹­ì´ ì´ë¯¸ ìžˆëŠ”ì§€ í™•ì¸
    if (classData.goods.some(g => g.name === newTerm)) {
      // ê¸°ì¡´ ë¹„ê³ ì‹œëª…ì¹­ë§Œ ì‚­ì œ
      classData.goods.splice(idx, 1);
      App.showToast(`"${oldTerm}" ì‚­ì œë¨ (í‘œì¤€ëª…ì¹­ "${newTerm}"ì´ ì´ë¯¸ ìžˆìŒ)`, 'info');
    } else {
      // DBì—ì„œ í‘œì¤€ëª…ì¹­ ì •ë³´ ì¡°íšŒ
      try {
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code')
          .eq('class_code', classCode.padStart(2, '0'))
          .eq('goods_name', newTerm)
          .limit(1);
        
        if (data && data.length > 0) {
          // í‘œì¤€ëª…ì¹­ìœ¼ë¡œ ëŒ€ì²´
          classData.goods[idx] = {
            name: data[0].goods_name,
            similarGroup: data[0].similar_group_code,
            isGazetted: true,
            isCustom: false
          };
          App.showToast(`"${oldTerm}" â†’ "${newTerm}" ëŒ€ì²´ë¨ (í‘œì¤€ëª…ì¹­)`, 'success');
        } else {
          // DBì— ì—†ìœ¼ë©´ ê·¸ëƒ¥ ì´ë¦„ë§Œ ë³€ê²½
          classData.goods[idx].name = newTerm;
          classData.goods[idx].isCustom = false;
          App.showToast(`"${oldTerm}" â†’ "${newTerm}" ë³€ê²½ë¨`, 'info');
        }
      } catch (err) {
        console.error('[TM] í‘œì¤€ëª…ì¹­ ì¡°íšŒ ì‹¤íŒ¨:', err);
        classData.goods[idx].name = newTerm;
      }
    }
    
    classData.goodsCount = classData.goods.length;
    TM.hasUnsavedChanges = true;
    TM.renderCurrentStep();
  };

  // ============================================================
  // 2. ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„ (ë„í˜• ìƒí‘œìš©)
  // ============================================================
  
  TM.analyzeViennaCode = async function() {
    const p = TM.currentProject;
    
    if (!p.specimenUrl && p.trademarkType !== 'figure' && p.trademarkType !== 'combined') {
      App.showToast('ë„í˜• ìƒí‘œ ì´ë¯¸ì§€ë¥¼ ë¨¼ì € ì—…ë¡œë“œí•˜ì„¸ìš”.', 'warning');
      return;
    }
    
    try {
      App.showToast('ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„ ì¤‘...', 'info');
      
      // ì´ë¯¸ì§€ê°€ ìžˆìœ¼ë©´ ì´ë¯¸ì§€ ê¸°ë°˜ ë¶„ì„, ì—†ìœ¼ë©´ ìƒí‘œëª… ê¸°ë°˜
      let prompt;
      
      if (p.specimenUrl) {
        prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ë„í˜• ë¶„ë¥˜ ì „ë¬¸ê°€ìž…ë‹ˆë‹¤. 
ì´ ìƒí‘œ ì´ë¯¸ì§€ë¥¼ ë¶„ì„í•˜ì—¬ ì ì ˆí•œ ë¹„ì—”ë‚˜ ë„í˜• ë¶„ë¥˜ ì½”ë“œë¥¼ ì¶”ì²œí•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName || '(ë¯¸ìž…ë ¥)'}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}
- ì´ë¯¸ì§€ URL: ${p.specimenUrl}

ë¹„ì—”ë‚˜ ë¶„ë¥˜ ì²´ê³„ì˜ ì£¼ìš” ëŒ€ë¶„ë¥˜:
- 01: ì²œì²´, ìžì—°í˜„ìƒ, ì§€ë„
- 02: ì¸ì²´
- 03: ë™ë¬¼
- 04: ì´ˆìžì—°ì  ì¡´ìž¬, í™˜ìƒì  ì¡´ìž¬
- 05: ì‹ë¬¼
- 06: í’ê²½
- 07: ê±´ì¶•ë¬¼, ê´‘ê³  êµ¬ì¶•ë¬¼
- 08: ì‹í’ˆ
- 09: ì„¬ìœ , ì˜ë³µ, ë°”ëŠì§ˆ ìš©í’ˆ
- 10: ë‹´ë°°, í¡ì—° ìš©êµ¬
- 11: ê°€ì •ìš©í’ˆ
- 12: ê°€êµ¬, ìœ„ìƒì„¤ë¹„
- 13: ì¡°ëª…ê¸°êµ¬, ë¼ë””ì˜¤, ì»´í“¨í„°
- 14: ë³´ì„ë¥˜, ì‹œê³„
- 15: ê¸°ê³„, ëª¨í„°, ì—”ì§„
- 16: ì „ê¸°í†µì‹ , ìŒí–¥
- 17: ì‚¬ë¬´ìš©í’ˆ, ë¬¸ë°©êµ¬
- 18: ìŠ¤í¬ì¸ , ê²Œìž„, ìž¥ë‚œê°
- 19: ì—¬í–‰ìš©í’ˆ, ìš©ê¸°
- 20: ë¬¸ìž, ìˆ«ìž
- 21: ë¹„ë¬¸ìžì  ê¸°í˜¸
- 22: í™”ì‚´í‘œ, í™”ì‚´ì´‰, ì‹­ìží˜•
- 23: ë‹¤ì–‘í•œ ëª¨ì–‘ì˜ ë¬¼ê±´
- 24: ë¬¸ìž¥(ç´‹ç« ), ë™ì „, íœ˜ìž¥
- 25: ìž¥ì‹ì  íŒ¨í„´, ìž¥ì‹ì  í‘œë©´, ë°°ê²½
- 26: ê¸°í•˜í•™ì  ë„í˜•
- 27: ê¸€ì”¨ì²´, ìˆ«ìž
- 28: ìƒ‰ì±„

JSON í˜•ì‹ìœ¼ë¡œ ì‘ë‹µí•˜ì„¸ìš”:
{
  "viennaCodeSuggestion": [
    {"code": "26.01.01", "description": "ì›, íƒ€ì›", "confidence": "high"},
    {"code": "27.05.01", "description": "ë¼í‹´ë¬¸ìž ë‹¨ì–´", "confidence": "medium"}
  ],
  "analysisNotes": "ë¶„ì„ ì„¤ëª…..."
}`;
      } else {
        prompt = `ìƒí‘œëª… "${p.trademarkName}"ì„ ë„í˜• ìƒí‘œë¡œ ë””ìžì¸í•  ê²½ìš° ì í•©í•œ ë¹„ì—”ë‚˜ ì½”ë“œë¥¼ ì¶”ì²œí•˜ì„¸ìš”.
ì¼ë°˜ì ì¸ ë¡œê³  ë””ìžì¸ íŒ¨í„´ì„ ê³ ë ¤í•˜ì—¬ JSON í˜•ì‹ìœ¼ë¡œ ì‘ë‹µ:
{
  "viennaCodeSuggestion": [
    {"code": "27.05.01", "description": "ë¼í‹´ë¬¸ìž ë‹¨ì–´", "confidence": "high"}
  ],
  "analysisNotes": "ìƒí‘œëª… ê¸°ë°˜ ì¶”ì²œ..."
}`;
      }
      
      const response = await App.callClaude(prompt, 800);
      
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI ì‘ë‹µì„ íŒŒì‹±í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      p.aiAnalysis.viennaCodeSuggestion = analysis.viennaCodeSuggestion || [];
      p.aiAnalysis.viennaAnalysisNotes = analysis.analysisNotes;
      
      TM.renderCurrentStep();
      App.showToast('ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„ì´ ì™„ë£Œë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
    } catch (error) {
      console.error('[TM] ë¹„ì—”ë‚˜ ì½”ë“œ ë¶„ì„ ì‹¤íŒ¨:', error);
      App.showToast('ë¶„ì„ ì‹¤íŒ¨: ' + error.message, 'error');
    }
  };

  // ============================================================
  // 3. ì§€ì •ìƒí’ˆ ì¶”ì²œ (ë¥˜ë³„)
  // ============================================================
  
  TM.recommendGoods = async function(classCode) {
    const p = TM.currentProject;
    
    try {
      App.showToast('ì§€ì •ìƒí’ˆ ì¶”ì²œ ì¤‘...', 'info');
      
      const prompt = `ë‹¹ì‹ ì€ ìƒí‘œ ì¶œì› ì „ë¬¸ê°€ìž…ë‹ˆë‹¤.
ë‹¤ìŒ ìƒí‘œì— ëŒ€í•´ ì œ${classCode}ë¥˜ì—ì„œ ì í•©í•œ ì§€ì •ìƒí’ˆì„ ì¶”ì²œí•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ì‚¬ì—… ë¶„ì„: ${p.aiAnalysis.businessAnalysis || '(ë¯¸ë¶„ì„)'}

ì œ${classCode}ë¥˜: ${TM.niceClasses[classCode]}

ë‹¤ìŒ ì¡°ê±´ì„ ì¤€ìˆ˜í•˜ì„¸ìš”:
1. í•œêµ­ íŠ¹í—ˆì²­ ê³ ì‹œëª…ì¹­ ì‚¬ìš©
2. ì‹¤ì œ ì‚¬ì—…ê³¼ ê´€ë ¨ëœ ìƒí’ˆ ìœ„ì£¼
3. 5~10ê°œ ì¶”ì²œ

JSON í˜•ì‹:
{
  "recommendedGoods": [
    {"name": "ì»´í“¨í„°ì†Œí”„íŠ¸ì›¨ì–´", "nameEn": "computer software", "reason": "ì¶”ì²œ ì´ìœ "},
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
      console.error('[TM] ì§€ì •ìƒí’ˆ ì¶”ì²œ ì‹¤íŒ¨:', error);
      App.showToast('ì¶”ì²œ ì‹¤íŒ¨: ' + error.message, 'error');
      return [];
    }
  };

  // ============================================================
  // 4. ìƒí‘œ ì„¤ëª… ìžë™ ìƒì„±
  // ============================================================
  
  TM.generateTrademarkDescription = async function() {
    const p = TM.currentProject;
    
    if (!p.trademarkName) {
      App.showToast('ìƒí‘œëª…ì„ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return null;
    }
    
    try {
      const prompt = `ë‹¤ìŒ ìƒí‘œì— ëŒ€í•œ ìƒí‘œ ì„¤ëª…ì„ ìž‘ì„±í•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ì˜ë¬¸ëª…: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}

ìƒí‘œ ì„¤ëª… ìž‘ì„± ê·œì¹™:
1. ë¬¸ìž ìƒí‘œ: í•œê¸€/ì˜ë¬¸ í‘œê¸°, ë°œìŒ, ì˜ë¯¸ ì„¤ëª…
2. ë„í˜• ìƒí‘œ: ë„í˜•ì˜ êµ¬ì„± ìš”ì†Œ ì„¤ëª…
3. ê²°í•© ìƒí‘œ: ë¬¸ìžì™€ ë„í˜•ì˜ ê²°í•© ê´€ê³„ ì„¤ëª…
4. ê°„ê²°í•˜ê³  ê°ê´€ì ì¸ ë¬¸ì²´
5. 2~3ë¬¸ìž¥ìœ¼ë¡œ ìž‘ì„±

í…ìŠ¤íŠ¸ë¡œë§Œ ì‘ë‹µí•˜ì„¸ìš” (JSON í˜•ì‹ ë¶ˆí•„ìš”).`;

      const response = await App.callClaude(prompt, 300);
      return response.text.trim();
      
    } catch (error) {
      console.error('[TM] ìƒí‘œ ì„¤ëª… ìƒì„± ì‹¤íŒ¨:', error);
      return null;
    }
  };

  // ============================================================
  // 5. ì¶œì›ì„œ ì´ˆì•ˆ ìƒì„±
  // ============================================================
  
  TM.generateApplicationDraft = async function() {
    const p = TM.currentProject;
    
    if (!p.trademarkName || !p.designatedGoods || p.designatedGoods.length === 0) {
      App.showToast('ìƒí‘œëª…ê³¼ ì§€ì •ìƒí’ˆì„ ìž…ë ¥í•˜ì„¸ìš”.', 'warning');
      return null;
    }
    
    try {
      App.showToast('ì¶œì›ì„œ ì´ˆì•ˆ ìƒì„± ì¤‘...', 'info');
      
      const goodsList = p.designatedGoods.map(c => 
        `ì œ${c.classCode}ë¥˜: ${c.goods.map(g => g.name).join(', ')}`
      ).join('\n');
      
      const prompt = `ë‹¤ìŒ ì •ë³´ë¥¼ ë°”íƒ•ìœ¼ë¡œ ìƒí‘œì¶œì›ì„œ ì´ˆì•ˆì„ ìž‘ì„±í•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ì˜ë¬¸ëª…: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}

[ì¶œì›ì¸]
- ì„±ëª…/ìƒí˜¸: ${p.applicant?.name || '(ë¯¸ìž…ë ¥)'}
- ì£¼ì†Œ: ${p.applicant?.address || '(ë¯¸ìž…ë ¥)'}

[ì§€ì •ìƒí’ˆ]
${goodsList}

í•œêµ­ íŠ¹í—ˆì²­ ì¶œì›ì„œ ì–‘ì‹ì— ë§žì¶° ë‹¤ìŒ í•­ëª©ì„ ìž‘ì„±í•˜ì„¸ìš”:
1. ìƒí‘œì˜ ì„¤ëª…
2. ì§€ì •ìƒí’ˆ(ì„œë¹„ìŠ¤ì—…) ëª©ë¡ (ë¥˜ë³„ ì •ë¦¬)
3. ì¶œì›ì¸ ì •ë³´ ìš”ì•½

ê³µì‹ì ì´ê³  ì •í™•í•œ ë¬¸ì²´ë¡œ ìž‘ì„±í•˜ì„¸ìš”.`;

      const response = await App.callClaude(prompt, 1500);
      return response;
      
    } catch (error) {
      console.error('[TM] ì¶œì›ì„œ ì´ˆì•ˆ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
      return null;
    }
  };

  // ============================================================
  // 6. ì¢…í•© ë³´ê³ ì„œ ìƒì„±
  // ============================================================
  
  TM.generateFullReport = async function() {
    const p = TM.currentProject;
    
    try {
      App.showToast('ì¢…í•© ë³´ê³ ì„œ ìƒì„± ì¤‘...', 'info');
      
      const prompt = `ë‹¤ìŒ ìƒí‘œ ì¶œì› í”„ë¡œì íŠ¸ì— ëŒ€í•œ ì¢…í•© ê²€í†  ë³´ê³ ì„œë¥¼ ìž‘ì„±í•˜ì„¸ìš”.

[ìƒí‘œ ì •ë³´]
- ìƒí‘œëª…: ${p.trademarkName}
- ì˜ë¬¸ëª…: ${p.trademarkNameEn || 'ì—†ìŒ'}
- ìƒí‘œ ìœ í˜•: ${TM.getTypeLabel(p.trademarkType)}

[ì§€ì •ìƒí’ˆ]
${p.designatedGoods?.map(c => `ì œ${c.classCode}ë¥˜: ${c.goods.length}ê°œ ìƒí’ˆ`).join(', ') || 'ë¯¸ì„ íƒ'}

[ë¦¬ìŠ¤í¬ í‰ê°€]
- ìœ„í—˜ ìˆ˜ì¤€: ${p.riskAssessment?.level || 'ë¯¸í‰ê°€'}
- ì¶©ëŒ ìš°ë ¤ ìƒí‘œ: ${p.riskAssessment?.conflictCount || 0}ê±´
- í‰ê°€ ë‚´ìš©: ${p.riskAssessment?.details?.slice(0, 200) || 'ì—†ìŒ'}

[ë¹„ìš©]
- ì´ ì˜ˆìƒ ë¹„ìš©: ${TM.formatNumber(p.feeCalculation?.totalFee || 0)}ì›
- ìš°ì„ ì‹¬ì‚¬: ${p.priorityExam?.enabled ? 'ì‹ ì²­' : 'ë¯¸ì‹ ì²­'}

ë‹¤ìŒ êµ¬ì¡°ë¡œ ë³´ê³ ì„œë¥¼ ìž‘ì„±í•˜ì„¸ìš”:
1. ìš”ì•½ (Executive Summary)
2. ìƒí‘œ ë¶„ì„
3. ë¦¬ìŠ¤í¬ í‰ê°€ ê²°ê³¼
4. ê¶Œê³ ì‚¬í•­
5. ë‹¤ìŒ ë‹¨ê³„

ì „ë¬¸ì ì´ê³  ëª…í™•í•œ ë¬¸ì²´ë¡œ ìž‘ì„±í•˜ì„¸ìš”.`;

      const response = await App.callClaude(prompt, 2000);
      
      p.aiAnalysis.fullReport = response.text;
      App.showToast('ë³´ê³ ì„œê°€ ìƒì„±ë˜ì—ˆìŠµë‹ˆë‹¤.', 'success');
      
      return response;
      
    } catch (error) {
      console.error('[TM] ë³´ê³ ì„œ ìƒì„± ì‹¤íŒ¨:', error);
      App.showToast('ìƒì„± ì‹¤íŒ¨: ' + error.message, 'error');
      return null;
    }
  };

})();
