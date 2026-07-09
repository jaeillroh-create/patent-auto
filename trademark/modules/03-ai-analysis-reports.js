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
    // ★ 중복 실행 방지 (경합 조건 차단)
    if (TM._analyzingBusiness) {
      App.showToast('분석이 이미 진행 중입니다.', 'warning');
      return;
    }
    TM._analyzingBusiness = true;

    const p = TM.currentProject;
    const businessInput = document.getElementById('tm-business-url')?.value?.trim();

    // 업로드된 파일 텍스트 결합
    const fileTexts = (p.businessFileTexts || []).map(f => f.text).filter(Boolean);
    const hasFileContent = fileTexts.length > 0;

    if (!businessInput && !hasFileContent && !p.trademarkName) {
      TM._analyzingBusiness = false;
      App.showToast('상표명, 사업 내용 또는 파일을 입력하세요.', 'warning');
      return;
    }
    
    const prevAiAnalysis = p.aiAnalysis;  // 에러 시 복원용 백업
    
    try {
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="ico" data-icon="history"></span> AI 분석 중...';
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
      // 파일 내용을 프롬프트에 포함 (최대 30,000자로 제한)
      let fileContentSection = '';
      if (hasFileContent) {
        let combinedFileText = fileTexts.join('\n\n---\n\n');
        if (combinedFileText.length > 30000) {
          combinedFileText = combinedFileText.substring(0, 30000) + '\n... (이하 생략)';
        }
        const fileNames = (p.businessFiles || []).map(f => f.name).join(', ');
        fileContentSection = `\n\n【업로드된 사업 관련 문서】\n파일: ${fileNames}\n\n${combinedFileText}\n\n★ 위 문서 내용을 정밀하게 분석하여 사업의 핵심 제품/서비스, 판매 채널, 사업 모델을 파악하세요.\n★ 문서에 나타난 구체적인 상품/서비스를 기반으로 상품류를 추천하세요.`;
      }

      const analysisPrompt = `당신은 10년 이상 경력의 상표 출원 전문 변리사입니다.
고객의 사업을 심층 분석하여 최적의 상품류를 추천하세요.

【고객 정보】
- 상표명: ${p.trademarkName || '미정'}
- 사업 내용: ${businessInput || '미입력'}${fileContentSection}

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
  "fileAnalysisInsights": {
    "documentTypes": ["사업계획서", "제품 카탈로그"],
    "keyFindings": ["주요 발견사항 1", "주요 발견사항 2", "주요 발견사항 3"],
    "goodsSearchStrategy": "이 문서에서 확인된 핵심 제품/서비스를 기반으로 ... 전략으로 지정상품을 탐색합니다"
  },
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
}
★ fileAnalysisInsights는 업로드된 문서가 있을 때만 포함. 없으면 생략.
  - documentTypes: 문서의 종류 (사업계획서, IR자료, 제품 카탈로그, 계약서, 홈페이지 등)
  - keyFindings: 문서에서 파악한 핵심 사업 정보 (제품/서비스, 타겟 시장, 수익 모델 등) 3~5개
  - goodsSearchStrategy: 이 문서 분석을 바탕으로 어떤 전략으로 지정상품을 찾을 것인지 2~3문장`;

      if (btn) btn.innerHTML = '<span class="ico" data-icon="history"></span> 사업 분석 중...';
      
      console.log('[TM] LLM 기반 사업 분석 시작');
      // ★ Sonnet 직접 호출 (WithFallback은 Opus→Sonnet 이중 호출로 529 악화)
      const analysisResponse = await App.callClaudeSonnet(analysisPrompt, 4000);
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
      
      // 전체 추천 류 목록 (중복 제거, String 보장)
      const allClassCodes = [...new Set([
        ...coreClasses.map(c => String(c.class)),
        ...recommendedClasses.map(c => String(c.class)),
        ...expansionClasses.map(c => String(c.class))
      ])];
      
      // classReasons 구성 (호환성 유지)
      const classReasons = {};
      coreClasses.forEach(c => { classReasons[c.class] = `<span class="status-dot negative"></span> 핵심: ${c.reason}`; });
      recommendedClasses.forEach(c => { classReasons[c.class] = `<span class="status-dot cautionary"></span> 권장: ${c.reason}`; });
      expansionClasses.forEach(c => { classReasons[c.class] = `<span class="status-dot positive"></span> 확장: ${c.reason}`; });
      
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
        // ★ 파일 분석 전략 (파일 업로드 시에만)
        fileAnalysisInsights: analysis.fileAnalysisInsights || null,
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
      // ★ 모든 추천 류(핵심+권장+확장)에 대해 지정상품 10개 선택
      // ================================================================
      const initialClasses = [...new Set([
        ...coreClasses.map(c => String(c.class)),
        ...recommendedClasses.map(c => String(c.class)),
        ...expansionClasses.map(c => String(c.class))
      ])];
      
      for (const classCode of initialClasses) {
        if (!p.aiAnalysis) { console.error('[TM] aiAnalysis가 null — 루프 중단'); break; }
        // ★ 류 간 1.5초 딜레이 (API 부하 분산)
        if (initialClasses.indexOf(classCode) > 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
        const paddedCode = String(classCode).padStart(2, '0');
        
        try {
          if (btn) btn.innerHTML = `<span class="ico" data-icon="history"></span> 제${classCode}류 분석 중...`;
          
          // ★★★ 핵심 개선: 류당 API 1회만 호출 ★★★
          // 1. DB에서 후보 조회 (API 호출 X)
          const businessCtx = {
            summary: businessInput || analysis.businessSummary || '',
            coreProducts: analysis.coreProducts || [],
            coreServices: analysis.coreServices || [],
            salesChannels: analysis.salesChannels || {},
            expansionPotential: analysis.expansionPotential || [],
            searchKeywords: allKeywords
          };
          
          const selectedGoods = await TM.selectGoodsTwoStage(classCode, businessCtx);
          
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
      // ★ 검증은 자동 실행하지 않음 (API 호출 절약)
      // → 사용자가 Step 2에서 "검증" 버튼으로 수동 실행
      // ================================================================
      console.log('[TM] ✅ 분석 완료 (검증은 Step 2에서 수동 실행)');
      
      TM.renderCurrentStep();
      App.showToast('사업 분석 완료!', 'success');
      
    } catch (error) {
      console.error('[TM] 사업 분석 실패:', error);
      App.showToast('분석 실패: ' + error.message, 'error');
      // API 실패 시 이전 분석 결과 복원 (null 방지)
      if (!p.aiAnalysis && prevAiAnalysis) {
        p.aiAnalysis = prevAiAnalysis;
      }
      if (!p.aiAnalysis) p.aiAnalysis = {};
    } finally {
      TM._analyzingBusiness = false;  // ★ 잠금 해제
      const btn = document.querySelector('[data-action="tm-analyze-business"]');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="ico" data-icon="search" data-size="14"></span> AI 분석';
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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

선택할 개수: 정확히 ${MIN_GOODS - selected.length}개를 선택하세요. 관련성이 높은 순으로 선택하되, 반드시 ${MIN_GOODS - selected.length}개를 채우세요.

응답: 숫자만 쉼표로 (예: 1,2,3)
선택:`;

        try {
          const response = await App.callClaudeSonnet(selectPrompt, 200);
          const responseText = (response.text || '').trim();
          
          console.log(`[TM] LLM 응답: "${responseText.substring(0, 80)}..."`);
          
          // 번호 파싱 ("없음" 응답도 무시하고 번호만 추출)
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
      
      // ★ 10개 보장: 관련 후보가 부족하면 해당 류의 전체 후보에서 채움
      if (selected.length < MIN_GOODS) {
        console.log(`[TM] 관련 후보 부족 (${selected.length}개), ${MIN_GOODS}개까지 전체 후보에서 보충`);
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
        console.log(`[TM] 보충 후: ${selected.length}개`);
      }
    }
    
    console.log(`[TM] 제${classCode}류 최종: ${selected.length}개`);
    
    return selected.slice(0, MIN_GOODS);
  };
  
  // ================================================================
  // ★ 공통: 지정상품 10개 보장 함수 (DB 조회 + LLM 생성 폴백)
  // ================================================================
  TM.ensureMinGoods = async function(classCode, currentGoods, businessText) {
    const MIN = 10;
    if (currentGoods.length >= MIN) return currentGoods;
    
    const deficit = MIN - currentGoods.length;
    const existingNames = new Set(currentGoods.map(g => typeof g === 'string' ? g : g.name));
    const paddedCode = String(classCode).padStart(2, '0');
    
    console.log(`[TM] ensureMinGoods 제${classCode}류: ${currentGoods.length}개 → ${deficit}개 보충 필요`);
    
    // 1차: DB에서 보충
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
      console.warn(`[TM] ensureMinGoods DB 보충 실패:`, e.message);
    }
    
    // 2차: DB로도 부족하면 LLM 생성
    if (currentGoods.length < MIN) {
      try {
        const still = MIN - currentGoods.length;
        const existingList = currentGoods.map(g => typeof g === 'string' ? g : g.name).join(', ');
        const genPrompt = `제${classCode}류 고시명칭 중 아래 사업과 관련된 지정상품/서비스를 정확히 ${still}개만 추천하세요.
사업: "${businessText}"
이미 선택됨: ${existingList}
위 목록과 중복되지 않는 것만 추천.
JSON 배열로만 응답: ["상품명1", "상품명2"]`;
        const resp = await App.callClaudeSonnet(genPrompt, 300);
        const arr = JSON.parse((resp.text || '').match(/\[[\s\S]*\]/)?.[0] || '[]');
        for (const name of arr) {
          if (currentGoods.length >= MIN) break;
          if (existingNames.has(name)) continue;
          existingNames.add(name);
          currentGoods.push({ name, similarGroup: '', isCore: false, isLlmGenerated: true });
        }
      } catch (e) {
        console.warn(`[TM] ensureMinGoods LLM 보충 실패:`, e.message);
      }
    }
    
    console.log(`[TM] ensureMinGoods 제${classCode}류 최종: ${currentGoods.length}개`);
    return currentGoods.slice(0, MIN);
  };

  // ================================================================
  // ★ Phase 2: 유사군 기반 2단계 + 교차검증 + 보충 루프
  // ================================================================

  // 유사군 목록 조회
  TM.fetchSimilarGroups = async function(classCode) {
    const paddedCode = String(classCode).padStart(2, '0');

    // DB 직접 조회 후 JS 그룹핑
    const { data, error } = await App.sb
      .from('gazetted_goods_cache')
      .select('similar_group_code, similar_group_name')
      .eq('class_code', paddedCode)
      .order('similar_group_code');

    if (error) throw error;

    const groupMap = new Map();
    for (const item of data) {
      const code = item.similar_group_code;
      if (!groupMap.has(code)) {
        groupMap.set(code, { code, name: item.similar_group_name || '', count: 0 });
      }
      groupMap.get(code).count++;
    }

    const groups = Array.from(groupMap.values());
    console.log(`[TM] 제${classCode}류 유사군: ${groups.length}개 (JS)`);
    return groups;
  };

  // LLM이 관련 유사군 선택
  TM.selectRelevantGroups = async function(classCode, groups, businessContext) {
    const groupList = groups.map(g => `${g.code} | ${g.name} | ${g.count}건`).join('\n');

    const prompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】${businessContext.summary}
【핵심 상품】${(businessContext.coreProducts || []).join(', ') || '없음'}
【핵심 서비스】${(businessContext.coreServices || []).join(', ') || '없음'}
【판매 채널】${businessContext.salesChannels?.details || '미정'}
【확장 가능성】${(businessContext.expansionPotential || []).join(', ') || '미정'}

【제${classCode}류 유사군 목록 (${groups.length}개)】
유사군코드 | 유사군명 | 상품수
${groupList}

위 사업과 관련 있는 유사군을 모두 선택하세요.

★★★ 핵심 원칙: 누락 방지 최우선.
- 이 사업에 필수적인 상품/서비스가 속한 유사군은 반드시 포함
- 과소 선택(누락)보다 과다 선택이 훨씬 낫다
- 사업과 완전히 무관한 유사군만 제외

【JSON으로만 응답】
{"selected":["G3501","G3504","G3509"]}`;

    const response = await App.callClaudeSonnet(prompt, 1000);
    const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('유사군 선택 파싱 실패');

    const result = JSON.parse(jsonMatch[0]);
    const selectedCodes = result.selected || [];
    console.log(`[TM] 제${classCode}류 관련 유사군: ${selectedCodes.length}개 / ${groups.length}개`);
    return selectedCodes;
  };

  // 선택된 유사군의 상품 조회 — 500건 이하 전체 포함, 초과 시 LLM 페이지 스캔
  TM.fetchGoodsInGroups = async function(classCode, groupCodes, businessContext) {
    const paddedCode = String(classCode).padStart(2, '0');
    const PAGE_LIMIT = 500;
    let allGoods = [];

    for (const groupCode of groupCodes) {
      const { count } = await App.sb
        .from('gazetted_goods_cache')
        .select('*', { count: 'exact', head: true })
        .eq('class_code', paddedCode)
        .eq('similar_group_code', groupCode);

      if (count <= PAGE_LIMIT) {
        let groupGoods = [];
        const PAGE_SIZE = 1000;
        for (let offset = 0; offset < count; offset += PAGE_SIZE) {
          const { data } = await App.sb
            .from('gazetted_goods_cache')
            .select('goods_name, similar_group_code, similar_group_name')
            .eq('class_code', paddedCode)
            .eq('similar_group_code', groupCode)
            .order('goods_name')
            .range(offset, Math.min(offset + PAGE_SIZE - 1, count - 1));
          if (data) groupGoods.push(...data);
        }
        allGoods.push(...groupGoods);
        console.log(`[TM] ${groupCode}: ${count}건 전체 포함`);
      } else {
        console.log(`[TM] ${groupCode}: ${count}건 → 페이지별 LLM 스캔`);
        const pickedGoods = await TM.scanLargeGroup(classCode, paddedCode, groupCode, count, businessContext);
        allGoods.push(...pickedGoods);
        console.log(`[TM] ${groupCode}: ${count}건 중 ${pickedGoods.length}건 LLM 선택`);
      }
    }

    console.log(`[TM] 제${classCode}류 총 후보: ${allGoods.length}건 (유사군 ${groupCodes.length}개)`);
    return allGoods;
  };

  // 대형 유사군(500건 초과) 페이지별 LLM 전수 스캔
  TM.scanLargeGroup = async function(classCode, paddedCode, groupCode, totalCount, businessContext) {
    const PAGE_SIZE = 500;
    const allPicked = [];
    const seen = new Set();

    const coreProducts = (businessContext.coreProducts || []).join(', ');
    const coreServices = (businessContext.coreServices || []).join(', ');
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    for (let page = 0; page < totalPages; page++) {
      const offset = page * PAGE_SIZE;

      const { data, error } = await App.sb
        .from('gazetted_goods_cache')
        .select('goods_name, similar_group_code, similar_group_name')
        .eq('class_code', paddedCode)
        .eq('similar_group_code', groupCode)
        .order('goods_name')
        .range(offset, Math.min(offset + PAGE_SIZE - 1, totalCount - 1));

      if (error || !data || data.length === 0) continue;

      const numberedList = data.map((item, i) => `[${i+1}] ${item.goods_name}`).join('\n');

      const prompt = `아래 상품 목록에서 이 사업과 관련 있는 상품의 번호만 선택하세요.
관련 없는 상품은 무시. 관련 있는 상품이 없으면 빈 배열.

【사업 내용】${businessContext.summary}
【핵심 상품】${coreProducts || '없음'}
【핵심 서비스】${coreServices || '없음'}

【상품 목록 (${data.length}건, 페이지 ${page+1}/${totalPages})】
${numberedList}

【JSON으로만 응답】
{"picks":[1,5,12,23]}`;

      try {
        const response = await App.callClaudeSonnet(prompt, 500);
        const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          const picks = result.picks || [];
          for (const no of picks) {
            if (no >= 1 && no <= data.length) {
              const item = data[no - 1];
              if (!seen.has(item.goods_name)) {
                seen.add(item.goods_name);
                allPicked.push(item);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[TM] ${groupCode} 페이지 ${page+1} 스캔 실패:`, e.message);
      }

      if (page < totalPages - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    return allPicked;
  };

  // LLM이 10개 선택
  TM.selectInitialGoods = async function(classCode, goods, businessContext) {
    const TARGET_COUNT = 10;

    // 유사군별 그룹핑
    const groupedMap = new Map();
    for (const g of goods) {
      const code = g.similar_group_code || 'UNKNOWN';
      if (!groupedMap.has(code)) groupedMap.set(code, []);
      groupedMap.get(code).push(g);
    }

    let numberedList = '';
    let globalIdx = 0;
    for (const [code, items] of groupedMap) {
      const groupName = items[0]?.similar_group_name || '';
      numberedList += `\n── ${code} ${groupName} (${items.length}건) ──\n`;
      for (const item of items) {
        globalIdx++;
        numberedList += `[${globalIdx}] ${item.goods_name}\n`;
      }
    }

    const coreProducts = (businessContext.coreProducts || []).join(', ');
    const coreServices = (businessContext.coreServices || []).join(', ');

    const prompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】${businessContext.summary}
【핵심 상품】${coreProducts || '없음'}
【핵심 서비스】${coreServices || '없음'}
【판매 채널】${businessContext.salesChannels?.details || '미정'}

【제${classCode}류 후보 (유사군별 정리, 총 ${goods.length}건)】
${numberedList}

정확히 ${TARGET_COUNT}개를 선택하세요.

【선택 기준】
1. ★★★ 필수 상품 포함 최우선: 이 사업을 영위하는 데 반드시 필요한 지정상품을 빠짐없이 포함
   핵심 상품 [${coreProducts}] 각각에 대응하는 지정상품 최소 1개씩
   핵심 서비스 [${coreServices}] 각각에 대응하는 지정상품 최소 1개씩
2. 상위 개념 상품 우선 (더 넓은 보호 범위)
3. 유사군코드 분산은 보조적 기준 — 필수 상품이 한 유사군에 집중되어도 무방
4. 혼동 방지: 동음이의어, 부분 문자열 매칭으로 무관한 상품 제외

【JSON으로만 응답 — 정확히 ${TARGET_COUNT}개】
{"selected":[{"no":1,"name":"상품명","group":"유사군코드","reason":"선택이유"}]}`;

    const response = await App.callClaudeSonnet(prompt, 2000);
    const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('상품 선택 파싱 실패');

    const cleaned = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\n/g, ' ');
    const result = JSON.parse(cleaned);

    const selectedItems = result.selected || [];
    const finalGoods = [];
    const usedNames = new Set();

    for (const item of selectedItems) {
      let matched = null;
      if (item.no >= 1 && item.no <= goods.length) {
        matched = goods[item.no - 1];
      }
      if (!matched && item.name) {
        matched = goods.find(g => g.goods_name === item.name);
      }
      if (matched && !usedNames.has(matched.goods_name)) {
        usedNames.add(matched.goods_name);
        finalGoods.push({
          name: matched.goods_name,
          similarGroup: matched.similar_group_code || '',
          reason: item.reason || ''
        });
      }
    }

    console.log(`[TM] 제${classCode}류 초기 선택: ${finalGoods.length}개`);
    return finalGoods;
  };

  // 교차검증
  TM.crossValidateGoods = async function(classCode, selectedGoods, allCandidates, businessContext) {
    const goodsList = selectedGoods.map((g, i) =>
      `${i+1}. ${g.name} (${g.similarGroup}) — ${g.reason}`
    ).join('\n');

    const coreProducts = (businessContext.coreProducts || []).join(', ');
    const coreServices = (businessContext.coreServices || []).join(', ');

    const prompt = `당신은 상표 출원 품질 검증 전문가입니다. (선택한 변리사와 다른 사람)
다른 변리사가 선택한 지정상품을 독립적으로 검증하세요.

【사업 내용】${businessContext.summary}
【핵심 상품】${coreProducts || '없음'}
【핵심 서비스】${coreServices || '없음'}
【판매 채널】${businessContext.salesChannels?.details || '미정'}

【제${classCode}류에서 선택된 지정상품 ${selectedGoods.length}개】
${goodsList}

【검증 과제】
1. 부적합 상품 식별: 이 사업과 실제로 관련 없는 상품이 포함되었는가?
   - 동음이의어 오류
   - 업종 불일치
   - 과도한 확대 해석

2. 누락 영역 식별: 이 사업에 필수적인데 대응하는 지정상품이 빠진 영역이 있는가?
   - 핵심 상품 [${coreProducts}] 각각 커버 여부
   - 핵심 서비스 [${coreServices}] 각각 커버 여부
   - 판매 채널 커버 여부

【JSON으로만 응답】
{
  "inappropriate": [
    {"index": 3, "name": "부적합상품명", "reason": "무관한 이유"}
  ],
  "missing": [
    {"businessArea": "누락된 사업 영역", "suggestedKeyword": "검색 키워드"}
  ],
  "score": 85,
  "comment": "전체 평가"
}
inappropriate/missing이 없으면 빈 배열 [].`;

    const response = await App.callClaudeSonnet(prompt, 1500);
    const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('검증 파싱 실패');

    const cleaned = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\n/g, ' ');

    const result = JSON.parse(cleaned);
    console.log(`[TM] 제${classCode}류 교차검증: 점수=${result.score}, 부적합=${(result.inappropriate||[]).length}건, 누락=${(result.missing||[]).length}건`);
    return result;
  };

  // 부적합 제거 + 보충 루프
  TM.fillMissingGoods = async function(classCode, currentGoods, validation, allCandidates, businessContext) {
    const TARGET_COUNT = 10;
    let goods = [...currentGoods];
    const usedNames = new Set(goods.map(g => g.name));

    // 1. 부적합 상품 제거
    const inappropriate = validation.inappropriate || [];
    if (inappropriate.length > 0) {
      const removeNames = new Set(inappropriate.map(item => item.name));
      goods = goods.filter(g => !removeNames.has(g.name));
      console.log(`[TM] 제${classCode}류 부적합 ${inappropriate.length}개 제거 → ${goods.length}개`);
      usedNames.clear();
      goods.forEach(g => usedNames.add(g.name));
    }

    // 2. 이미 10개 이상이면 완료
    if (goods.length >= TARGET_COUNT) {
      return goods.slice(0, TARGET_COUNT);
    }

    // 3. 보충 루프 (최대 3회)
    const missing = validation.missing || [];
    console.log(`[TM] 제${classCode}류 보충 필요: ${TARGET_COUNT - goods.length}개 (누락 영역: ${missing.length}개)`);

    let loopCount = 0;
    const MAX_LOOPS = 3;

    while (goods.length < TARGET_COUNT && loopCount < MAX_LOOPS) {
      loopCount++;
      console.log(`[TM] 제${classCode}류 보충 루프 ${loopCount}/${MAX_LOOPS}`);

      const currentList = goods.map((g, i) => `${i+1}. ${g.name} (${g.similarGroup})`).join('\n');
      const missingInfo = missing.length > 0
        ? missing.map(m => `- ${m.businessArea}: "${m.suggestedKeyword}" 관련`).join('\n')
        : '- 사업 전반에서 추가 커버 필요';

      const remaining = allCandidates.filter(c => !usedNames.has(c.goods_name));

      // 유사군별 그룹핑
      const groupedMap = new Map();
      for (const g of remaining) {
        const code = g.similar_group_code || 'UNKNOWN';
        if (!groupedMap.has(code)) groupedMap.set(code, []);
        groupedMap.get(code).push(g);
      }

      let remainingList = '';
      const remainingFlat = [];
      let idx = 0;
      for (const [code, items] of groupedMap) {
        remainingList += `\n── ${code} ${items[0]?.similar_group_name || ''} ──\n`;
        for (const item of items.slice(0, 30)) {
          idx++;
          remainingList += `[${idx}] ${item.goods_name}\n`;
          remainingFlat.push(item);
        }
      }

      const need = TARGET_COUNT - goods.length;

      const prompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】${businessContext.summary}

【현재 선택된 지정상품 ${goods.length}개】
${currentList}

【누락된 사업 영역】
${missingInfo}

【제${classCode}류 남은 후보 상품】
${remainingList}

${need}개를 추가 선택하세요.
누락된 사업 영역을 우선 커버하고, 이 사업에 필수적인 상품을 선택하세요.

【JSON으로만 응답 — 정확히 ${need}개】
{"fill":[{"no":1,"name":"상품명","group":"유사군코드","reason":"보충 이유"}]}`;

      try {
        const response = await App.callClaudeSonnet(prompt, 1500);
        const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
        if (!jsonMatch) break;

        const cleaned = jsonMatch[0]
          .replace(/[\x00-\x1F\x7F]/g, ' ')
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\n/g, ' ');
        const result = JSON.parse(cleaned);
        const fillItems = result.fill || [];

        for (const item of fillItems) {
          if (goods.length >= TARGET_COUNT) break;
          let matched = null;
          if (item.no >= 1 && item.no <= remainingFlat.length) {
            matched = remainingFlat[item.no - 1];
          }
          if (!matched && item.name) {
            matched = remaining.find(c => c.goods_name === item.name);
          }
          if (matched && !usedNames.has(matched.goods_name)) {
            usedNames.add(matched.goods_name);
            goods.push({
              name: matched.goods_name,
              similarGroup: matched.similar_group_code || '',
              reason: item.reason || '보충'
            });
          }
        }

        console.log(`[TM] 보충 루프 ${loopCount} → ${goods.length}개`);
      } catch (e) {
        console.error(`[TM] 보충 루프 ${loopCount} 실패:`, e.message);
        break;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    // 4. 그래도 부족하면 DB 후보에서 자동 패딩
    if (goods.length < TARGET_COUNT) {
      console.log(`[TM] 제${classCode}류 LLM 보충 후에도 ${goods.length}개 — DB 자동 패딩`);
      for (const c of allCandidates) {
        if (goods.length >= TARGET_COUNT) break;
        if (!usedNames.has(c.goods_name)) {
          usedNames.add(c.goods_name);
          goods.push({
            name: c.goods_name,
            similarGroup: c.similar_group_code || '',
            reason: '자동 보충'
          });
        }
      }
    }

    return goods.slice(0, TARGET_COUNT);
  };

  // 통합 함수: 2단계 상품 선택
  TM.selectGoodsTwoStage = async function(classCode, businessContext) {
    const TARGET_COUNT = 10;
    console.log(`[TM] ════ 2단계 상품 선택: 제${classCode}류 ════`);

    try {
      // Step 1: 유사군 목록 (DB)
      const groups = await TM.fetchSimilarGroups(classCode);
      if (!groups || groups.length === 0) return [];

      // Step 2: 관련 유사군 선택 (API 1회)
      const selectedGroupCodes = await TM.selectRelevantGroups(classCode, groups, businessContext);
      if (!selectedGroupCodes || selectedGroupCodes.length === 0) return [];

      // Step 3: 해당 유사군 상품 조회 (DB)
      const allCandidates = await TM.fetchGoodsInGroups(classCode, selectedGroupCodes, businessContext);
      if (!allCandidates || allCandidates.length === 0) return [];

      // Step 4: 초기 10개 선택 (API 1회)
      let selectedGoods = await TM.selectInitialGoods(classCode, allCandidates, businessContext);

      // Step 5: 교차검증 (API 1회)
      const validation = await TM.crossValidateGoods(classCode, selectedGoods, allCandidates, businessContext);

      // Step 6: 부적합 제거 + 보충 루프 (10개 보장)
      if ((validation.inappropriate?.length > 0) || selectedGoods.length < TARGET_COUNT) {
        selectedGoods = await TM.fillMissingGoods(classCode, selectedGoods, validation, allCandidates, businessContext);
      }

      // isCore 플래그
      selectedGoods.forEach((g, i) => { g.isCore = i < 3; });

      console.log(`[TM] ════ 완료: 제${classCode}류 → ${selectedGoods.length}개 ════`);
      return selectedGoods;

    } catch (e) {
      console.error(`[TM] 2단계 실패 (제${classCode}류):`, e.message);
      console.log(`[TM] 기존 방식으로 폴백`);
      try {
        const fetchResult = await TM.fetchAllCandidates(classCode, businessContext);
        if (fetchResult && fetchResult.candidates.length > 0) {
          return await TM.selectGoodsOneshot(classCode, fetchResult.candidates, businessContext) || [];
        }
      } catch (fe) {
        console.error(`[TM] 폴백도 실패:`, fe.message);
      }
      return [];
    }
  };

  // ================================================================
  // ★ Phase 1: 개선된 상품 선택 — 원샷 방식 (모수 극대화) [폴백용 유지]
  // ================================================================

  // DB에서 후보 전체 조회 또는 필터링 조회
  TM.fetchAllCandidates = async function(classCode, businessContext) {
    const ONESHOT_LIMIT = 3500;
    const paddedCode = String(classCode).padStart(2, '0');
    
    console.log(`[TM] ════ 원샷 DB 조회: 제${classCode}류 ════`);
    
    try {
      const { count, error: countErr } = await App.sb
        .from('gazetted_goods_cache')
        .select('*', { count: 'exact', head: true })
        .eq('class_code', paddedCode);
      
      if (countErr) throw countErr;
      console.log(`[TM] 제${classCode}류 총 ${count}건`);
      
      if (count <= ONESHOT_LIMIT) {
        console.log(`[TM] Tier A: 전체 조회 (${count}건)`);
        // ★ BUG-1 FIX: Supabase 1000행 기본 제한 → 페이지네이션
        let allData = [];
        const PAGE_SIZE = 1000;
        for (let offset = 0; offset < count; offset += PAGE_SIZE) {
          const { data: page, error: pageErr } = await App.sb
            .from('gazetted_goods_cache')
            .select('goods_name, similar_group_code, similar_group_name')
            .eq('class_code', paddedCode)
            .order('similar_group_code')
            .range(offset, Math.min(offset + PAGE_SIZE - 1, count - 1));
          
          if (pageErr) throw pageErr;
          if (page) allData.push(...page);
        }
        console.log(`[TM] 전체 조회 완료: ${allData.length}건 (페이지: ${Math.ceil(count / PAGE_SIZE)})`);
        return { candidates: allData, totalInClass: count, strategy: 'full' };
      } else {
        console.log(`[TM] Tier B: 필터링 필요 (${count}건 > ${ONESHOT_LIMIT})`);
        return await TM.fetchFilteredCandidates(paddedCode, businessContext);
      }
    } catch (e) {
      console.error(`[TM] fetchAllCandidates 실패:`, e.message);
      return null;
    }
  };

  // ★ LLM 키워드 확장: 사업 맥락으로 DB 검색용 키워드 50개 생성
  TM.generateExpandedKeywords = async function(classCode, businessContext) {
    const businessSummary = businessContext.summary || '';
    const coreProducts = (businessContext.coreProducts || []).join(', ');
    const coreServices = (businessContext.coreServices || []).join(', ');
    const expansion = (businessContext.expansionPotential || []).join(', ');
    
    const prompt = `당신은 상표 출원 전문가입니다. 아래 사업 내용을 보고, 제${classCode}류 고시명칭 DB에서 관련 상품을 빠짐없이 찾기 위한 **검색 키워드**를 생성하세요.

【사업 내용】${businessSummary}
【핵심 상품】${coreProducts || '없음'}
【핵심 서비스】${coreServices || '없음'}
【확장 가능성】${expansion || '없음'}

【규칙】
1. 고시명칭 DB의 상품명에 포함될 법한 **한글 단어** 위주로 생성
2. 동의어, 유의어, 상위/하위 개념, 원재료, 관련 기술 등 폭넓게 커버
3. 1~3글자 짧은 단어 권장 (DB ilike 검색에 유리)
4. 너무 일반적인 단어(제품, 상품, 물품 등)는 제외
5. 이 사업과 무관한 키워드는 절대 포함하지 않음

【JSON으로만 응답 — 다른 텍스트 없이】
{"keywords":["키워드1","키워드2",...]}`;
    
    try {
      const response = await App.callClaudeSonnet(prompt, 500);
      const text = (response.text || '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');
      const result = JSON.parse(jsonMatch[0]);
      const keywords = result.keywords || [];
      console.log(`[TM] 🔑 LLM 키워드 확장: ${keywords.length}개 생성`);
      console.log(`[TM]   키워드: ${keywords.join(', ')}`);
      return keywords;
    } catch (e) {
      console.error('[TM] 키워드 확장 실패:', e.message);
      // 폴백: 기존 사업분석 키워드 사용
      return [
        ...(businessContext.coreProducts || []),
        ...(businessContext.coreServices || []),
        ...(businessContext.searchKeywords || []),
        ...(businessContext.expansionPotential || [])
      ];
    }
  };

  // 대형 류(09류, 35류) 전용 필터링 조회 — LLM 키워드 확장 방식
  TM.fetchFilteredCandidates = async function(paddedCode, businessContext) {
    const seen = new Set();
    const allResults = [];
    const classCode = parseInt(paddedCode, 10);
    
    console.log(`[TM] ════ Tier B: LLM 키워드 확장 조회 시작 (제${classCode}류) ════`);
    
    // ★ Pass 1: LLM으로 검색 키워드 50개 생성
    const expandedKeywords = await TM.generateExpandedKeywords(classCode, businessContext);
    
    // 기존 사업분석 키워드도 병합 (누락 방지)
    const baseKeywords = [
      ...(businessContext.coreProducts || []),
      ...(businessContext.coreServices || []),
      ...(businessContext.searchKeywords || []),
      ...(businessContext.expansionPotential || [])
    ];
    const allKeywords = [...new Set([...baseKeywords, ...expandedKeywords])];
    console.log(`[TM] 검색 키워드 총 ${allKeywords.length}개 (기존 ${baseKeywords.length} + LLM ${expandedKeywords.length}, 중복 제거)`);
    
    // ★ Pass 2: 전체 키워드로 DB ilike 검색 (제한 없이 수집)
    for (const kw of allKeywords) {
      if (!kw || kw.length < 1) continue;
      try {
        // 상품명 검색
        const { data } = await App.sb
          .from('gazetted_goods_cache')
          .select('goods_name, similar_group_code, similar_group_name')
          .eq('class_code', paddedCode)
          .ilike('goods_name', `%${kw}%`)
          .limit(500);
        if (data) {
          for (const item of data) {
            if (!seen.has(item.goods_name)) {
              seen.add(item.goods_name);
              allResults.push(item);
            }
          }
        }
      } catch (e) { /* continue */ }
      
      // 유사군명으로도 검색 (2글자 이상 키워드만)
      if (kw.length >= 2) {
        try {
          const { data: data2 } = await App.sb
            .from('gazetted_goods_cache')
            .select('goods_name, similar_group_code, similar_group_name')
            .eq('class_code', paddedCode)
            .ilike('similar_group_name', `%${kw}%`)
            .limit(300);
          if (data2) {
            for (const item of data2) {
              if (!seen.has(item.goods_name)) {
                seen.add(item.goods_name);
                allResults.push(item);
              }
            }
          }
        } catch (e) { /* continue */ }
      }
    }
    
    console.log(`[TM] 필터링 완료: 키워드 ${allKeywords.length}개 → 후보 ${allResults.length}건 수집 (Tier B)`);
    
    return {
      candidates: allResults,
      totalInClass: allResults.length,
      strategy: 'filtered-expanded'
    };
  };

  // ★ 원샷 상품 선택 (callClaudeSonnet 사용)
  TM.selectGoodsOneshot = async function(classCode, allCandidates, businessContext) {
    const MIN_GOODS = 10;
    
    // 후보 전체를 LLM에 전달 (키워드 확장으로 이미 관련성 있는 후보만 수집됨)
    let candidates = allCandidates;
    console.log(`[TM] 원샷 선택: 제${classCode}류 후보 ${candidates.length}건 → LLM 전달`);
    
    const numberedList = candidates.map((c, i) =>
      `[${i + 1}] ${c.goods_name} (${c.similar_group_code || '?'})`
    ).join('\n');
    
    const businessSummary = businessContext.summary || '';
    const coreProducts = (businessContext.coreProducts || []).join(', ');
    const coreServices = (businessContext.coreServices || []).join(', ');
    const salesInfo = businessContext.salesChannels
      ? (businessContext.salesChannels.online ? '온라인' : '') +
        (businessContext.salesChannels.offline ? '/오프라인' : '') +
        (businessContext.salesChannels.details ? ` (${businessContext.salesChannels.details})` : '')
      : '';
    const expansion = (businessContext.expansionPotential || []).join(', ');
    
    const prompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】${businessSummary}
【핵심 상품】${coreProducts || '없음'}
【핵심 서비스】${coreServices || '없음'}
【판매 채널】${salesInfo || '미정'}
【확장 가능성】${expansion || '미정'}

【제${classCode}류 고시명칭 후보 ${candidates.length}건】
${numberedList}

위 사업과 직접 관련 있는 지정상품 ${MIN_GOODS}개를 선택하세요.

【선택 기준 — 반드시 순서대로 적용】
1. ★★★ 사업 영역 전체 커버: 핵심 상품·서비스 각각에 대해 최소 1개씩 대응하는 지정상품을 선택하세요.
   - 예: 핵심 상품이 "커피, 케이크, 쿠키"이면 → 커피 관련 + 케이크 관련 + 쿠키 관련 모두 포함해야 합니다.
   - 특정 영역에만 편중되면 안 됩니다.
2. 유사군코드(괄호 안 코드)가 다양하도록 분산 선택
3. 핵심 사업 → 부수 사업 → 확장 가능 순서로 우선순위

★ 혼동 방지 (반드시 확인 후 제외):
- 동음이의어: "생화(꽃)" 사업에서 "생화학적" = 다른 의미 → 제외
- 부분 문자열: "꽃" 사업에서 "꽃게", "불꽃놀이" = 무관 → 제외
- 업종 불일치: "가구(家具)" 사업에서 "1인가구(家口)" = 다른 뜻 → 제외
- 확대 해석: 실제 취급하지 않는 상품 → 제외

【JSON으로만 응답 — 정확히 ${MIN_GOODS}개】
{"selected":[{"no":1,"name":"볶은 커피","group":"G290301","reason":"커피 판매 핵심"}]}`;
    
    try {
      const response = await App.callClaudeSonnet(prompt, 2000);  // BUG-6 FIX: 잘림 방지
      const text = (response.text || '').trim();
      console.log(`[TM] 원샷 LLM 응답: ${text.substring(0, 100)}...`);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');
      
      const cleaned = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\n/g, ' ');
      
      const result = JSON.parse(cleaned);
      const selectedItems = result.selected || [];
      if (selectedItems.length === 0) throw new Error('선택 결과 없음');
      
      const goods = [];
      const usedNames = new Set();
      
      for (const item of selectedItems) {
        if (goods.length >= MIN_GOODS) break;
        
        let matched = null;
        if (item.no && item.no >= 1 && item.no <= candidates.length) {
          matched = candidates[item.no - 1];
        }
        if (!matched && item.name) {
          // ★ BUG-3 FIX: 엄격 매칭 (includes 오매칭 방지)
          matched = candidates.find(c => c.goods_name === item.name);
        }
        
        if (matched && !usedNames.has(matched.goods_name)) {
          usedNames.add(matched.goods_name);
          goods.push({
            name: matched.goods_name,
            similarGroup: matched.similar_group_code || '',
            isCore: goods.length < 3,
            reason: item.reason || ''
          });
        }
      }
      
      console.log(`[TM] 원샷 선택 완료: ${goods.length}개`);
      return goods;
      
    } catch (e) {
      console.error(`[TM] selectGoodsOneshot 실패:`, e.message);
      return null;
    }
  };


  // ================================================================
  // ★ Phase 2: 개선된 검증 — 2단계 통합 (5~10회 → 2회)
  // ================================================================

  TM.validateRecommendationsV2 = async function(businessInput, aiAnalysis) {
    if (!aiAnalysis || !aiAnalysis.recommendedClasses?.length) {
      return null;
    }
    
    console.log('[TM] ════════════════════════════════════');
    console.log('[TM] 추천 결과 2단계 통합 검증 시작');
    console.log('[TM] ════════════════════════════════════');
    
    const validationResult = {
      hasIssues: false,
      overallScore: 100,
      summary: '',
      stages: { classValidation: null, goodsValidation: null, missingReview: null },
      invalidClasses: [],
      invalidGoods: [],
      replacementGoods: [],
      warnings: [],
      suggestions: [],
      missingClasses: [],
      missingGoods: []
    };
    
    const classRec = aiAnalysis.classRecommendations || {};
    const allClasses = [
      ...(classRec.core || []),
      ...(classRec.recommended || []),
      ...(classRec.expansion || [])
    ];
    
    // ==============================================
    // A단계: 류 적합성 + 누락 검토 통합 (기존 1+3단계)
    // ==============================================
    console.log('[TM] ▶ A단계: 류 적합성 + 누락 검토 통합');
    
    try {
      const classPrompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】
"${businessInput}"

【추천된 상품류】
${allClasses.map(c => `- 제${c.class}류: ${c.reason}`).join('\n')}

【과제 1: 류 적합성 검증】
각 추천 류가 위 사업과 직접적으로 관련 있는지 검증하세요.
- 해당 사업에서 실제로 판매/제공하는 상품·서비스가 포함된 류인가?
- 추천 이유가 사업 내용과 논리적으로 연결되는가?

【과제 2: 누락 검토】
위 사업을 영위하는데 반드시 필요하지만 누락된 상품류가 있는지 검토하세요.
- 판매 채널(온라인/오프라인)에 따른 필수 류
- 경쟁사가 일반적으로 등록하는 류

【JSON으로만 응답 — comment/reason은 15자 이내】
{
  "validClasses": [{"class": "31", "score": 95, "comment": "꽃 재배 핵심"}],
  "invalidClasses": [{"class": "42", "score": 20, "reason": "IT서비스 무관"}],
  "missingClasses": [{"class": "44", "reason": "꽃꽂이 서비스 필수", "priority": "권장"}],
  "classScoreAvg": 85
}
누락이 없으면 missingClasses: []로 응답.`;

      const classResponse = await App.callClaudeSonnet(classPrompt, 3000);
      const classResult = TM.safeJsonParse(classResponse.text);
      
      validationResult.stages.classValidation = classResult;
      validationResult.stages.missingReview = classResult;
      
      if (classResult.invalidClasses?.length > 0) {
        validationResult.hasIssues = true;
        validationResult.invalidClasses = classResult.invalidClasses;
        console.log(`[TM] 부적합 류: ${classResult.invalidClasses.map(c => c.class).join(', ')}`);
      }
      
      if (classResult.missingClasses?.length > 0) {
        validationResult.missingClasses = classResult.missingClasses;
        validationResult.suggestions.push(...classResult.missingClasses.map(c => ({
          type: 'add_class', class: c.class, reason: c.reason, priority: c.priority
        })));
        console.log(`[TM] 누락 류: ${classResult.missingClasses.map(c => c.class).join(', ')}`);
      }
      
      console.log(`[TM] A단계 완료 (점수: ${classResult.classScoreAvg || 'N/A'})`);
      
    } catch (e) {
      // ★ 529 과부하 시 fallback도 건너뜀 (추가 요청 방지)
      const is529 = /과부하|529|overload/i.test(e.message);
      if (is529) {
        console.warn('[TM] A단계 실패 (529 과부하) — fallback 건너뜀');
        validationResult.warnings.push({
          class: 'ALL', message: 'API 과부하로 류 검증 생략. 수동 확인 권장.'
        });
        validationResult.summary = '류 적합성 검증 생략 (API 과부하)';
      } else {
        console.warn('[TM] A단계 실패, 기존 방식 fallback:', e.message);
        try {
          const fallbackResult = await TM.validateRecommendations(businessInput, aiAnalysis);
          return fallbackResult;
        } catch (fe) {
          console.warn('[TM] fallback도 실패:', fe.message);
          // ★ BUG-2 FIX: 류 검증 완전 실패 시 경고 추가
          validationResult.warnings.push({
            class: 'ALL', message: '류 적합성 자동 검증 실패. 수동 확인 권장.'
          });
          validationResult.summary = '류 적합성 검증 실패 — 수동 확인 필요';
        }
      }
    }
    
    // ==============================================
    // B단계: 전 류 상품 통합 검증 (기존 2단계 류별 → 한번에)
    // ==============================================
    // ★ API 과부하 감지 시 B단계 건너뜀
    if (typeof App.isCircuitOpen === 'function' && App.isCircuitOpen()) {
      console.warn('[TM] API 서킷 브레이커 열림 — B단계 건너뜀');
      validationResult.warnings.push({
        class: 'ALL', message: 'API 과부하로 상품 검증 생략. 수동 확인 권장.'
      });
    } else {
    console.log('[TM] ▶ B단계: 전 류 상품 통합 검증');
    
    const invalidClassCodes = validationResult.invalidClasses.map(c => String(c.class));
    const validClassCodes = aiAnalysis.recommendedClasses.filter(c => !invalidClassCodes.includes(String(c)));
    
    const allGoodsList = validClassCodes.map(cc => {
      const goods = aiAnalysis.recommendedGoods?.[cc] || [];
      if (goods.length === 0) return '';
      return `[제${cc}류]\n${goods.map((g, i) => `  ${i + 1}. ${g.name}`).join('\n')}`;
    }).filter(s => s).join('\n');
    
    if (allGoodsList) {
      try {
        // ★ 사업 분석 구조화 데이터 추출 (커버리지 체크용)
        const coreProducts = (aiAnalysis.coreProducts || []).join(', ');
        const coreServices = (aiAnalysis.coreServices || []).join(', ');
        const expansionAreas = (aiAnalysis.expansionPotential || []).join(', ');
        
        const goodsPrompt = `당신은 상표 출원 전문 변리사입니다.

【사업 내용】
"${businessInput}"

【사업 분석 결과 — 커버해야 할 영역】
- 핵심 상품: ${coreProducts || '(없음)'}
- 핵심 서비스: ${coreServices || '(없음)'}
- 확장 가능성: ${expansionAreas || '(없음)'}

【추천 지정상품 전체】
${allGoodsList}

【과제 1: 개별 적합성 검증】
각 상품이 위 사업과 관련 있는지 검증하세요.
★ 주의: 동음이의어, 부분 문자열, 업종 불일치, 확대 해석

【과제 2: 사업 영역 커버리지 검증 ★★★】
위 "핵심 상품"과 "핵심 서비스" 각각에 대해, 추천 상품 중 해당 영역을 커버하는 것이 있는지 확인하세요.
- 커버되지 않는 사업 영역이 있으면 uncoveredAreas에 기재
- 해당 영역을 커버할 수 있는 대체 상품을 suggestedReplacements에 제안

【JSON으로만 응답 — reason 15자 이내】
{
  "validGoods": [{"class":"25","name":"티셔츠","score":95,"comment":"의류 핵심"}],
  "invalidGoods": [{"class":"35","name":"생화학 도매","score":5,"reason":"동음이의어","errorType":"homonym"}],
  "suggestedReplacements": [{"class":"35","remove":"생화학 도매","addInstead":"절화 소매업","reason":"꽃 판매 적합"}],
  "uncoveredAreas": [{"area":"케이크","class":"30","suggestedGoods":["케이크","빵류"]}]
}
모두 적합하고 누락 없으면 invalidGoods: [], uncoveredAreas: []로 응답.`;

        const goodsResponse = await App.callClaudeSonnet(goodsPrompt, 4000);
        const goodsResult = TM.safeJsonParse(goodsResponse.text);
        
        validationResult.stages.goodsValidation = goodsResult;
        
        if (goodsResult.invalidGoods?.length > 0) {
          validationResult.hasIssues = true;
          goodsResult.invalidGoods.forEach(g => {
            validationResult.invalidGoods.push({
              classCode: g.class || '',
              goodsName: g.name,
              reason: g.reason,
              errorType: g.errorType || 'relevance',
              score: g.score
            });
          });
          console.log(`[TM] 부적합 상품: ${goodsResult.invalidGoods.map(g => g.name).join(', ')}`);
        }
        
        if (goodsResult.suggestedReplacements?.length > 0) {
          goodsResult.suggestedReplacements.forEach(r => {
            validationResult.replacementGoods.push({
              classCode: r.class || '',
              remove: r.remove,
              addInstead: r.addInstead,
              reason: r.reason
            });
          });
        }
        
        // ★ 커버리지 검증 결과 처리
        if (goodsResult.uncoveredAreas?.length > 0) {
          validationResult.hasIssues = true;
          validationResult.uncoveredAreas = goodsResult.uncoveredAreas;
          console.log(`[TM] 미커버 영역: ${goodsResult.uncoveredAreas.map(a => a.area).join(', ')}`);
          
          // 미커버 영역을 warnings에도 추가
          goodsResult.uncoveredAreas.forEach(area => {
            validationResult.warnings.push({
              class: area.class || 'ALL',
              message: `"${area.area}" 영역 미커버. 추천: ${(area.suggestedGoods || []).join(', ')}`
            });
          });
        }
        
        console.log('[TM] B단계 완료');
        
      } catch (e) {
        // ★ 529 과부하 시 류별 개별 호출 fallback 금지 (역효과 방지)
        const is529 = /과부하|529|overload/i.test(e.message);
        if (is529) {
          console.warn('[TM] B단계 실패 (529 과부하) — 개별 검증 건너뜀 (추가 요청 방지)');
          validationResult.warnings.push({
            class: 'ALL', message: 'API 과부하로 상품 검증 생략. 수동 확인 권장.'
          });
        } else {
          console.warn('[TM] B단계 실패, 류별 개별 검증 fallback:', e.message);
        for (const classCode of validClassCodes) {
          const goods = aiAnalysis.recommendedGoods?.[classCode] || [];
          if (goods.length === 0) continue;
          
          try {
            const indivPrompt = `당신은 상표 출원 전문 변리사입니다.
【사업 내용】"${businessInput}"
【제${classCode}류 추천 지정상품】
${goods.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}
각 상품이 사업과 관련 있는지 검증. 동음이의어·부분문자열·업종불일치 주의.
【JSON으로만 응답 — 15자 이내】
{"validGoods":[{"name":"...","score":95,"comment":"..."}],"invalidGoods":[{"name":"...","score":5,"reason":"...","errorType":"homonym"}],"suggestedReplacements":[]}`;
            
            const resp = await App.callClaudeSonnet(indivPrompt, 2000);
            const result = TM.safeJsonParse(resp.text);
            if (result.invalidGoods?.length > 0) {
              validationResult.hasIssues = true;
              result.invalidGoods.forEach(g => {
                validationResult.invalidGoods.push({
                  classCode, goodsName: g.name, reason: g.reason,
                  errorType: g.errorType || 'relevance', score: g.score
                });
              });
            }
            if (result.suggestedReplacements?.length > 0) {
              result.suggestedReplacements.forEach(r => {
                validationResult.replacementGoods.push({
                  classCode, remove: r.remove, addInstead: r.addInstead, reason: r.reason
                });
              });
            }
          } catch (ie) {
            console.warn(`[TM] 제${classCode}류 개별 검증 실패:`, ie.message);
          }
          await new Promise(r => setTimeout(r, 500));
        }
        } // close else
      }
    }
    } // close circuit breaker else
    
    // ★ 누락된 류에 대해 지정상품 추천
    if (validationResult.missingClasses?.length > 0) {
      const allKeywords = aiAnalysis.searchKeywords || [];
      
      for (const mc of validationResult.missingClasses) {
        const classCode = mc.class;
        if (aiAnalysis.recommendedGoods?.[classCode]?.length > 0) continue;
        
        try {
          const businessCtx = {
            summary: aiAnalysis.businessAnalysis || '',
            coreProducts: aiAnalysis.coreProducts || [],
            coreServices: aiAnalysis.coreServices || [],
            salesChannels: aiAnalysis.salesChannels || {},
            expansionPotential: aiAnalysis.expansionPotential || [],
            searchKeywords: allKeywords
          };
          
          let selectedGoods = await TM.selectGoodsTwoStage(classCode, businessCtx);
          
          // ★ BUG-5 FIX: undefined 방어
          if (!aiAnalysis.recommendedGoods) aiAnalysis.recommendedGoods = {};
          aiAnalysis.recommendedGoods[classCode] = selectedGoods;
          console.log(`[TM] 누락 류 제${classCode}류 지정상품 ${selectedGoods.length}개 완료`);
        } catch (goodsErr) {
          console.warn(`[TM] 누락 류 제${classCode}류 추천 실패:`, goodsErr);
          try {
            aiAnalysis.recommendedGoods[classCode] = await TM.ensureMinGoods(classCode, [], '');
          } catch (e) {
            aiAnalysis.recommendedGoods[classCode] = [];
          }
        }
      }
    }
    
    // 점수 계산
    if (validationResult.invalidClasses.length > 0 || validationResult.invalidGoods.length > 0) {
      validationResult.overallScore -= validationResult.invalidClasses.length * 15;
      validationResult.overallScore -= validationResult.invalidGoods.length * 5;
      validationResult.overallScore = Math.max(0, validationResult.overallScore);
    }
    
    validationResult.summary = validationResult.hasIssues
      ? `부적합 류 ${validationResult.invalidClasses.length}개, 부적합 상품 ${validationResult.invalidGoods.length}개 발견`
      : '모든 추천이 적합합니다.';
    
    console.log(`[TM] 검증 완료: ${validationResult.summary} (점수: ${validationResult.overallScore})`);
    return validationResult;
  };

  // ================================================================
  // ★ Phase 3: 유사도 배치 평가 (10회 → 2회)
  // ================================================================

  TM.evaluateSimilarityBatch = async function(targets) {
    const p = TM.currentProject;
    
    const targetList = targets.map((t, i) =>
      `[${i + 1}] 상표명: ${t.title || t.trademarkName || '미상'}\n     출원번호: ${t.applicationNumber} / 상태: ${t.applicationStatus || '미상'}`
    ).join('\n');
    
    const prompt = `당신은 상표 유사도 평가 전문가입니다.

[출원 상표]
- 상표명: ${p.trademarkName}
- 영문명: ${p.trademarkNameEn || '없음'}
- 상표유형: ${TM.getTypeLabel(p.trademarkType)}

[선행 상표 ${targets.length}건]
${targetList}

각 선행상표에 대해 외관·호칭·관념 유사도를 평가하세요.
- "high" (유사), "medium" (주의), "low" (비유사)
- notes는 핵심 근거 2~3문장

【JSON 배열로 응답 — 정확히 ${targets.length}개】
[
  {"no":1,"appearance":"high","pronunciation":"medium","concept":"low","overall":"medium","notes":"외관: ... 호칭: ... 관념: ..."},
  ...
]`;

    const response = await App.callClaudeSonnet(prompt, 3000);
    const text = (response.text || '').trim();
    
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('배치 JSON 파싱 실패');
    
    const cleaned = arrayMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/,(\s*[}\]])/g, '$1');
    
    const evaluations = JSON.parse(cleaned);
    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      throw new Error('배치 결과 비어있음');
    }
    
    for (let i = 0; i < Math.min(evaluations.length, targets.length); i++) {
      const ev = evaluations[i];
      // ★ BUG-4 FIX: no 필드로 매핑 (순서 의존 제거)
      const targetIdx = (ev.no && ev.no >= 1 && ev.no <= targets.length) ? ev.no - 1 : i;
      const target = targets[targetIdx];
      
      const evaluation = {
        appearance: ev.appearance || 'low',
        pronunciation: ev.pronunciation || 'low',
        concept: ev.concept || 'low',
        overall: ev.overall || 'low',
        notes: ev.notes || '',
        targetId: target.applicationNumber,
        targetName: target.title || target.trademarkName,
        evaluatedAt: new Date().toISOString()
      };
      
      const existingIndex = p.similarityEvaluations.findIndex(e => e.targetId === target.applicationNumber);
      if (existingIndex >= 0) {
        p.similarityEvaluations[existingIndex] = evaluation;
      } else {
        p.similarityEvaluations.push(evaluation);
      }
    }
    
    return evaluations.length;
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

【JSON으로만 응답 — comment/reason은 15자 이내로 간결하게】
{
  "validClasses": [
    {"class": "31", "score": 95, "comment": "꽃 재배 핵심 사업"}
  ],
  "invalidClasses": [
    {"class": "42", "score": 20, "reason": "IT서비스 무관"}
  ],
  "classScoreAvg": 85
}`;

      const classResponse = await App.callClaudeSonnet(classValidationPrompt, 2000);
      
      // max_tokens 초과 시 재시도 (더 큰 토큰으로)
      let classText = classResponse.text;
      if (classResponse.stopReason === 'max_tokens') {
        console.warn('[TM] 1단계 검증 응답 잘림, 재시도...');
        const retryResponse = await App.callClaudeSonnet(classValidationPrompt + '\n\n★ 반드시 comment/reason을 10자 이내로 극도로 간결하게 작성하세요.', 3000);
        classText = retryResponse.text;
      }
      
      const classResult = TM.safeJsonParse(classText);
      
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
    const invalidClassCodes = validationResult.invalidClasses.map(c => String(c.class));
    const validClassCodes = aiAnalysis.recommendedClasses.filter(c => !invalidClassCodes.includes(String(c)));
    
    for (let ci = 0; ci < validClassCodes.length; ci++) {
      const classCode = validClassCodes[ci];
      const goods = aiAnalysis.recommendedGoods?.[classCode] || [];
      if (goods.length === 0) continue;
      
      // API rate limit 방지 (류 간 500ms 딜레이)
      if (ci > 0) await new Promise(r => setTimeout(r, 500));
      
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

【JSON으로만 응답 — comment/reason은 15자 이내로 간결하게】
{
  "validGoods": [
    {"name": "생화 소매업", "score": 95, "comment": "꽃 판매 직접 관련"}
  ],
  "invalidGoods": [
    {"name": "생화학적 촉매 도매업", "score": 5, "reason": "동음이의어 오류", "errorType": "homonym"}
  ],
  "suggestedReplacements": [
    {"remove": "생화학적 촉매 도매업", "addInstead": "절화 소매업", "reason": "꽃 판매 적합"}
  ]
}`;

        const goodsResponse = await App.callClaudeSonnet(goodsValidationPrompt, 2000);
        
        // max_tokens 초과 시 재시도
        let goodsText = goodsResponse.text;
        if (goodsResponse.stopReason === 'max_tokens') {
          console.warn(`[TM] 제${classCode}류 검증 응답 잘림, 재시도...`);
          const retryResponse = await App.callClaudeSonnet(goodsValidationPrompt + '\n\n★ 반드시 comment/reason을 10자 이내로 극도로 간결하게 작성하세요. suggestedReplacements는 생략 가능.', 3000);
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

누락이 없으면 isSufficient: true, missingClasses: [], missingGoods: []로 응답하세요.
★ reason/comment는 15자 이내로 간결하게 작성하세요.`;

      const missingResponse = await App.callClaudeSonnet(missingReviewPrompt, 1500);
      
      // max_tokens 초과 시 재시도
      let missingText = missingResponse.text;
      if (missingResponse.stopReason === 'max_tokens') {
        console.warn('[TM] 3단계 검증 응답 잘림, 재시도...');
        const retryResponse = await App.callClaudeSonnet(missingReviewPrompt + '\n\n★ 극도로 간결하게 응답. reason 10자 이내.', 2500);
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
        console.log(`[TM] 누락된 류 발견: ${missingResult.missingClasses.map(c => c.class).join(', ')}`);
        
        // ★ 누락된 류에 대해 지정상품 10개 미리 추천
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
          if (aiAnalysis.recommendedGoods?.[classCode]?.length > 0) continue; // 이미 있으면 스킵
          
          try {
            const paddedCode = String(classCode).padStart(2, '0');
            const candidates = await TM.fetchOptimalCandidates(paddedCode, allKeywords, analysisCtx);
            let selectedGoods = [];
            if (candidates.length > 0) {
              selectedGoods = await TM.selectOptimalGoods(classCode, candidates, aiAnalysis.businessAnalysis || '', analysisCtx);
            }
            // ★ 10개 보장
            selectedGoods = await TM.ensureMinGoods(classCode, selectedGoods, aiAnalysis.businessAnalysis || '');
            aiAnalysis.recommendedGoods[classCode] = selectedGoods;
            console.log(`[TM] 누락 류 제${classCode}류 지정상품 ${selectedGoods.length}개 추천 완료`);
          } catch (goodsErr) {
            console.warn(`[TM] 누락 류 제${classCode}류 지정상품 추천 실패:`, goodsErr);
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
      validationResult.summary = '<span class="ico" data-icon="check-circle"></span> 모든 추천이 사업 내용과 적합합니다.';
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
        const classCode = String(invalidClass.class);
        
        // recommendedClasses에서 제거
        const idx = aiAnalysis.recommendedClasses.indexOf(classCode);
        if (idx > -1) {
          aiAnalysis.recommendedClasses.splice(idx, 1);
        }
        
        // classRecommendations에서 제거
        ['core', 'recommended', 'expansion'].forEach(cat => {
          if (aiAnalysis.classRecommendations?.[cat]) {
            aiAnalysis.classRecommendations[cat] = 
              aiAnalysis.classRecommendations[cat].filter(c => String(c.class) !== classCode);
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
              .eq('class_code', String(classCode).padStart(2, '0'))
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
    
    // 4. ★★★ 제거 후 10개 미만인 류에 대해 보충 ★★★
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
      console.log(`[TM] 제${classCode}류 검증 후 ${currentGoods.length}개 → ${deficit}개 보충 필요`);
      
      try {
        const paddedCode = String(classCode).padStart(2, '0');
        const existingNames = new Set(currentGoods.map(g => g.name));
        
        // DB에서 추가 후보 조회
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
          console.log(`[TM] 제${classCode}류 ${added}개 보충 → 총 ${aiAnalysis.recommendedGoods[classCode].length}개`);
        }
      } catch (e) {
        console.warn(`[TM] 제${classCode}류 보충 실패:`, e.message);
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
            .eq('class_code', String(classCode).padStart(2, '0'))
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
        const response = await App.callClaudeSonnet(selectPrompt, 200);
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
          .eq('class_code', String(classCode).padStart(2, '0'))
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
      
      const response = await App.callClaudeSonnet(prompt, 800);
      
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

      const response = await App.callClaudeSonnet(prompt, 800);
      
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

      const response = await App.callClaudeSonnet(prompt, 300);
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

      const response = await App.callClaudeSonnet(prompt, 1500);
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

      const response = await App.callClaudeSonnet(prompt, 2000);
      
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
