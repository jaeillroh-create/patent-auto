import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// â˜… ê¸°ë³¸ API í‚¤ (í´ë¼ì´ì–¸íŠ¸ì—ì„œ ë³„ë„ í‚¤ë¥¼ ë³´ë‚´ë©´ ê·¸ê²ƒì„ ìš°ì„  ì‚¬ìš©)
const DEFAULT_API_KEY = 'zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
const BASE_URL = 'https://plus.kipris.or.kr/kipo-api/kipi';

function parseXML(xml: string): any {
  const result: any = {};
  const totalCountMatch = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  result.totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : 0;
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const item: any = {};
    // ìƒí‘œ + íŠ¹í—ˆ ê³µí†µ í•„ë“œ
    const fields = ['applicationNumber','applicationDate','registrationNumber','registrationDate',
      'title','trademarkName','applicationStatus','classificationCode','similarityCode',
      'viennaCode','applicantName','drawing','bigDrawing',
      // íŠ¹í—ˆ ì „ìš© í•„ë“œ
      'inventionTitle','registerNumber','registerDate','registerStatus',
      'ipcNumber','openDate','openNumber','publicationDate','publicationNumber',
      'astrtCont','indexNo'];
    for (const f of fields) {
      const m = itemXml.match(new RegExp(`<${f}>([^<]*)</${f}>`));
      if (m) item[f] = m[1].trim();
    }
    if (Object.keys(item).length > 0) items.push(item);
  }
  result.items = items;
  return result;
}

// ====== íŠ¹í—ˆ ê²€ìƒ‰ ======
async function searchPatentByWord(params: any, API_KEY: string): Promise<any> {
  const { word, numOfRows = 10, pageNo = 1, patent = true, utility = true } = params;
  if (!word) throw new Error('word required');
  
  let url = `${BASE_URL}/patUtiModInfoSearchSevice/getWordSearch?ServiceKey=${encodeURIComponent(API_KEY)}&word=${encodeURIComponent(word)}&numOfRows=${numOfRows}&pageNo=${pageNo}`;
  if (patent !== undefined) url += `&patent=${patent}`;
  if (utility !== undefined) url += `&utility=${utility}`;
  
  console.log('[KIPRIS] Patent search:', word);
  const res = await fetch(url);
  const xml = await res.text();
  
  // ì—ëŸ¬ ì²´í¬
  if (xml.includes('<resultCode>') && !xml.includes('<resultCode>00</resultCode>')) {
    const msgMatch = xml.match(/<resultMsg>([^<]+)<\/resultMsg>/);
    throw new Error(`KIPRIS Error: ${msgMatch ? msgMatch[1] : 'unknown'}`);
  }
  
  const parsed = parseXML(xml);
  return { success: true, totalCount: parsed.totalCount, results: parsed.items };
}

async function searchByText(params: any, API_KEY: string): Promise<any> {
  const { searchString, trademarkName, numOfRows = 50, pageNo = 1, application = true, registration = true } = params;
  const query = searchString || trademarkName;
  if (!query) throw new Error('searchString required');
  
  const url_base = `${BASE_URL}/trademarkInfoSearchService/getWordSearch?ServiceKey=${encodeURIComponent(API_KEY)}&searchString=${encodeURIComponent(query)}&numOfRows=${numOfRows}&pageNo=${pageNo}`;
  
  // ì¶”ê°€ íŒŒë¼ë¯¸í„° ì „ë‹¬ (application, registration, classification ë“±)
  const passthrough = ['application','registration','refused','expiration','withdrawal',
    'publication','cancel','abandonment','trademark','serviceMark','character','figure',
    'compositionCharacter','figureComposition','classification'];
  let extraParams = '';
  for (const key of passthrough) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      extraParams += `&${key}=${encodeURIComponent(String(params[key]))}`;
    }
  }
  // similarityCode â†’ similarCode ë§¤í•‘ (í´ë¼ì´ì–¸íŠ¸ì™€ KIPRIS API íŒŒë¼ë¯¸í„°ëª… ë‹¤ë¦„)
  const simCode = params.similarCode || params.similarityCode;
  if (simCode) {
    extraParams += `&similarCode=${encodeURIComponent(String(simCode))}`;
  }
  const url = url_base + extraParams;
  
  console.log('[KIPRIS] Search:', query, '| Key prefix:', API_KEY.substring(0, 4) + '***');
  
  const res = await fetch(url);
  const xml = await res.text();
  console.log('[KIPRIS] Response length:', xml.length, '| Preview:', xml.substring(0, 200));
  
  // ì—ëŸ¬ ì²´í¬
  if (xml.includes('<resultCode>') && !xml.includes('<resultCode>00</resultCode>')) {
    const codeMatch = xml.match(/<resultCode>([^<]+)<\/resultCode>/);
    const msgMatch = xml.match(/<resultMsg>([^<]+)<\/resultMsg>/);
    const errCode = codeMatch ? codeMatch[1] : 'unknown';
    const errMsg = msgMatch ? msgMatch[1] : 'unknown error';
    throw new Error(`KIPRIS Error: ${errCode} - ${errMsg}`);
  }
  
  const parsed = parseXML(xml);
  return { success: true, totalCount: parsed.totalCount, results: parsed.items };
}

async function searchByFigure(params: any, API_KEY: string): Promise<any> {
  const { viennaCode, numOfRows = 30, pageNo = 1, application = true, registration = true } = params;
  if (!viennaCode) throw new Error('viennaCode required');
  const url = `${BASE_URL}/trademarkInfoSearchService/getFigureSearch?ServiceKey=${encodeURIComponent(API_KEY)}&figurativeCd=${encodeURIComponent(viennaCode)}&numOfRows=${numOfRows}&pageNo=${pageNo}&application=${application}&registration=${registration}`;
  console.log('[KIPRIS] Figure search:', viennaCode);
  const res = await fetch(url);
  const xml = await res.text();
  const parsed = parseXML(xml);
  return { success: true, totalCount: parsed.totalCount, results: parsed.items };
}

async function getDetail(params: any, API_KEY: string): Promise<any> {
  const { applicationNumber } = params;
  if (!applicationNumber) throw new Error('applicationNumber required');
  const url = `${BASE_URL}/trademarkInfoSearchService/getApplicationNumberSearch?ServiceKey=${encodeURIComponent(API_KEY)}&applicationNumber=${applicationNumber.replace(/-/g, '')}`;
  console.log('[KIPRIS] Detail:', applicationNumber);
  const res = await fetch(url);
  const xml = await res.text();
  const parsed = parseXML(xml);
  return { success: true, result: parsed.items[0] || null };
}

async function searchBySimilarGroup(params: any, API_KEY: string): Promise<any> {
  const { similarGroups, searchString, trademarkName, numOfRows = 50, application = true, registration = true } = params;
  const query = searchString || trademarkName;
  const allResults: any[] = [];
  const seen = new Set();
  
  // ìœ ì‚¬êµ°ì½”ë“œë³„ ê²€ìƒ‰
  const groups = Array.isArray(similarGroups) ? similarGroups : (similarGroups ? [similarGroups] : []);
  for (const sg of groups) {
    try {
      const url = `${BASE_URL}/trademarkInfoSearchService/getWordSearch?ServiceKey=${encodeURIComponent(API_KEY)}&similarCode=${encodeURIComponent(sg)}&numOfRows=${numOfRows}&application=${application}&registration=${registration}`;
      console.log('[KIPRIS] SimilarGroup search:', sg);
      const res = await fetch(url);
      const xml = await res.text();
      const parsed = parseXML(xml);
      for (const item of parsed.items) {
        if (!seen.has(item.applicationNumber)) {
          seen.add(item.applicationNumber);
          allResults.push(item);
        }
      }
    } catch (e: any) {
      console.error(`[KIPRIS] Error for ${sg}:`, e.message);
    }
  }
  
  // ë¬¸ìž ê²€ìƒ‰ë„ ë³´ì¶©
  if (query && groups.length === 0) {
    const textResult = await searchByText({ searchString: query, numOfRows, application, registration }, API_KEY);
    for (const item of textResult.results) {
      if (!seen.has(item.applicationNumber)) {
        seen.add(item.applicationNumber);
        allResults.push(item);
      }
    }
  }
  
  return { success: true, totalCount: allResults.length, results: allResults };
}

async function searchCombined(params: any, API_KEY: string): Promise<any> {
  const { searchString, trademarkName, similarGroups, viennaCode, numOfRows = 50, application = true, registration = true } = params;
  const query = searchString || trademarkName;
  const allResults: any[] = [];
  const seen = new Set();
  
  // 1. ë¬¸ìž ê²€ìƒ‰
  if (query) {
    try {
      const textResult = await searchByText({ searchString: query, numOfRows, application, registration }, API_KEY);
      for (const item of textResult.results) {
        if (!seen.has(item.applicationNumber)) {
          seen.add(item.applicationNumber);
          allResults.push(item);
        }
      }
    } catch (e: any) {
      console.error('[KIPRIS] Text search error:', e.message);
    }
  }
  
  // 2. ìœ ì‚¬êµ° ê²€ìƒ‰
  if (similarGroups?.length > 0) {
    try {
      const sgResult = await searchBySimilarGroup({ similarGroups, numOfRows: 30, application, registration }, API_KEY);
      for (const item of sgResult.results) {
        if (!seen.has(item.applicationNumber)) {
          seen.add(item.applicationNumber);
          allResults.push(item);
        }
      }
    } catch (e: any) {
      console.error('[KIPRIS] SimilarGroup search error:', e.message);
    }
  }
  
  // 3. ë¹„ì—”ë‚˜ ì½”ë“œ ê²€ìƒ‰
  if (viennaCode) {
    try {
      const vResult = await searchByFigure({ viennaCode, numOfRows: 30, application, registration }, API_KEY);
      for (const item of vResult.results) {
        if (!seen.has(item.applicationNumber)) {
          seen.add(item.applicationNumber);
          allResults.push(item);
        }
      }
    } catch (e: any) {
      console.error('[KIPRIS] Vienna search error:', e.message);
    }
  }
  
  return { success: true, totalCount: allResults.length, results: allResults };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const { type, params, apiKey } = await req.json();
    // í´ë¼ì´ì–¸íŠ¸ì—ì„œ ë³´ë‚¸ í‚¤ê°€ ìžˆìœ¼ë©´ ìš°ì„  ì‚¬ìš©, ì—†ìœ¼ë©´ ê¸°ë³¸í‚¤
    const API_KEY = apiKey || DEFAULT_API_KEY;
    console.log('[KIPRIS-PROXY] Request:', type, JSON.stringify(params).substring(0, 100), '| Key:', API_KEY.substring(0, 4) + '***');
    
    let result;
    switch (type) {
      case 'text': result = await searchByText(params, API_KEY); break;
      case 'figure': result = await searchByFigure(params, API_KEY); break;
      case 'detail': result = await getDetail(params, API_KEY); break;
      case 'similar': case 'similarGroup': result = await searchBySimilarGroup(params, API_KEY); break;
      case 'combined': result = await searchCombined(params, API_KEY); break;
      case 'patent_word': result = await searchPatentByWord(params, API_KEY); break;
      case 'test': result = { 
        success: true, 
        message: 'KIPRIS Proxy OK', 
        timestamp: new Date().toISOString() 
      }; break;
      default: throw new Error(`Unknown type: ${type}`);
    }
    
    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    console.error('[KIPRIS-PROXY] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // 200 ë°˜í™˜í•˜ì—¬ CORS ë¬¸ì œ ë°©ì§€
    });
  }
});