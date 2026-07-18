// ═══════════ UNIFIED DIAGRAM ENGINE ═══════════

// ═══════════════════════════════════════════════════════════════
// ★★★ v14: 도면 JSON 아키텍처 (Option B) ★★★
// LLM이 JSON 좌표 직접 출력 → 경량 렌더러가 SVG+PPTX 생성
// 파싱 실패 시 기존 Mermaid 파이프라인으로 자동 폴백
// ═══════════════════════════════════════════════════════════════

function parseDesignJSON(responseText){
  const jsonMatch=responseText.match(/```json\n([\s\S]*?)```/);
  if(!jsonMatch)return{success:false,fallback:'mermaid',error:'JSON block not found'};
  try{
    const parsed=JSON.parse(jsonMatch[1]);
    const figures=parsed.figures||[parsed];
    if(!figures.length)return{success:false,fallback:'mermaid',error:'empty figures'};
    const PW=8.27,PH=11.69,M=0.6;
    for(const fig of figures){
      if(!fig.blocks||!Array.isArray(fig.blocks))return{success:false,fallback:'mermaid',error:'no blocks'};
      for(const b of fig.blocks){
        if(typeof b.x!=='number')b.x=M; if(typeof b.y!=='number')b.y=M;
        if(typeof b.w!=='number')b.w=1.8; if(typeof b.h!=='number')b.h=0.7;
        b.x=Math.max(M,Math.min(b.x,PW-b.w-M));
        b.y=Math.max(M,Math.min(b.y,PH-b.h-M));
      }
      fig.blocks=_autoCorrectOverlaps(fig.blocks);
      if(!fig.connections)fig.connections=[];
      fig.connections.forEach(c=>{
        if(!c.route||!c.route.length){
          const fb=fig.blocks.find(bl=>bl.id===c.from),tb=fig.blocks.find(bl=>bl.id===c.to);
          if(fb&&tb)c.route=_autoRouteJSON(fb,tb);
        }
        if(!c.arrow)c.arrow='end';
      });
    }
    return{success:true,data:{figures}};
  }catch(e){return{success:false,fallback:'mermaid',error:e.message};}
}

function _autoCorrectOverlaps(blocks){
  const PAD=0.15;
  for(let iter=0;iter<10;iter++){
    let any=false;
    for(let i=0;i<blocks.length;i++){
      for(let j=i+1;j<blocks.length;j++){
        const a=blocks[i],b=blocks[j];
        if(a.x<b.x+b.w+PAD&&a.x+a.w+PAD>b.x&&a.y<b.y+b.h+PAD&&a.y+a.h+PAD>b.y){
          const dx=(a.x+a.w+PAD)-b.x,dy=(a.y+a.h+PAD)-b.y;
          if(Math.abs(dx)<Math.abs(dy))b.x+=dx+0.1; else b.y+=dy+0.1;
          any=true;
        }
      }
    }
    if(!any)break;
  }
  return blocks;
}

function _autoRouteJSON(fb,tb){
  const fcx=fb.x+fb.w/2,fcy=fb.y+fb.h/2,tcx=tb.x+tb.w/2,tcy=tb.y+tb.h/2;
  const dx=tcx-fcx,dy=tcy-fcy,isH=Math.abs(dx)>=Math.abs(dy);
  let s,e;
  if(isH){s={x:dx>0?fb.x+fb.w:fb.x,y:fcy};e={x:dx>0?tb.x:tb.x+tb.w,y:tcy};}
  else{s={x:fcx,y:dy>0?fb.y+fb.h:fb.y};e={x:tcx,y:dy>0?tb.y:tb.y+tb.h};}
  if(Math.abs(s.x-e.x)<0.05||Math.abs(s.y-e.y)<0.05)return[s,e];
  if(isH){const m=(s.x+e.x)/2;return[s,{x:m,y:s.y},{x:m,y:e.y},e];}
  else{const m=(s.y+e.y)/2;return[s,{x:s.x,y:m},{x:e.x,y:m},e];}
}

function renderDiagramFromJSON(containerId,figData,figNum){
  const PX=72,PW=(figData.pageSize?.w||8.27)*PX,PH=(figData.pageSize?.h||11.69)*PX;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" style="background:#fff;border:1px solid #ddd;max-width:100%;height:auto">`;
  svg+=`<text x="${PW/2}" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">【도 ${figNum}】</text>`;
  if(figData.frame){const f=figData.frame;svg+=`<rect x="${f.x*PX}" y="${f.y*PX}" width="${f.w*PX}" height="${f.h*PX}" fill="none" stroke="#000" stroke-width="2" rx="4"/>`;svg+=`<text x="${(f.x+f.w/2)*PX}" y="${(f.y-0.08)*PX}" text-anchor="middle" font-size="12" fill="#000">${f.label||''}</text>`;}
  (figData.connections||[]).forEach(conn=>{if(!conn.route||conn.route.length<2)return;const pts=conn.route.map(p=>`${p.x*PX},${p.y*PX}`).join(' ');const mid=`arr_${figNum}_${conn.from}_${conn.to}`;svg+=`<defs><marker id="${mid}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#000"/></marker></defs>`;let ma='';if(conn.arrow==='end'||conn.arrow==='both')ma+=` marker-end="url(#${mid})"`;if(conn.arrow==='start'||conn.arrow==='both')ma+=` marker-start="url(#${mid})"`;svg+=`<polyline points="${pts}" fill="none" stroke="#000" stroke-width="1.2"${ma}/>`; });
  (figData.blocks||[]).forEach(block=>{const bx=block.x*PX,by=block.y*PX,bw=block.w*PX,bh=block.h*PX;if(block.shape==='diamond'){const cx=bx+bw/2,cy=by+bh/2;svg+=`<polygon points="${cx},${by} ${bx+bw},${cy} ${cx},${by+bh} ${bx},${cy}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;}else if(block.shape==='stadium'){svg+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh/2}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;}else{svg+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#fff" stroke="#000" stroke-width="1.5" rx="3"/>`;}const label=block.label||'';const fs=Math.min(12,Math.max(8,(bw-10)/Math.max(label.length,1)*1.5));svg+=`<text x="${bx+bw/2}" y="${by+bh/2+4}" text-anchor="middle" font-size="${fs}" fill="#000">${label}</text>`;if(block.refNum){let rl=block.refLeader;const pos=block.refNumPos||'right';if(!rl){if(pos==='right')rl={startX:block.x+block.w,startY:block.y+block.h/2,endX:block.x+block.w+0.4,endY:block.y+block.h/2};else if(pos==='left')rl={startX:block.x,startY:block.y+block.h/2,endX:block.x-0.4,endY:block.y+block.h/2};else if(pos==='top')rl={startX:block.x+block.w/2,startY:block.y,endX:block.x+block.w/2,endY:block.y-0.3};else rl={startX:block.x+block.w/2,startY:block.y+block.h,endX:block.x+block.w/2,endY:block.y+block.h+0.3};}svg+=`<line x1="${rl.startX*PX}" y1="${rl.startY*PX}" x2="${rl.endX*PX}" y2="${rl.endY*PX}" stroke="#000" stroke-width="0.8"/>`;const anc=pos==='left'?'end':'start';const rdx=pos==='left'?-4:4;svg+=`<text x="${rl.endX*PX+rdx}" y="${rl.endY*PX+4}" text-anchor="${anc}" font-size="${REF_NUM_FONT_SIZE}" fill="#000">${block.refNum}</text>`;}});
  svg+=`</svg>`;
  const el=document.getElementById(containerId);if(el)el.innerHTML+=`<div style="margin:12px 0">${svg}</div>`;
  return svg;
}

function generatePptxFromJSON(figDataArray,fileName){
  if(typeof PptxGenJS==='undefined'){App.showToast('PPTX 라이브러리 로드 안됨','error');return;}
  const pptx=new PptxGenJS();pptx.defineLayout({name:'A4P',width:8.27,height:11.69});pptx.layout='A4P';
  figDataArray.forEach((fig,idx)=>{
    const slide=pptx.addSlide();const fn=fig.figNum||(idx+1);
    slide.addText('【도 '+fn+'】',{x:0.5,y:0.2,w:7.27,h:0.4,fontSize:14,bold:true,align:'center',fontFace:'맑은 고딕'});
    if(fig.frame){const f=fig.frame;slide.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:f.x,y:f.y,w:f.w,h:f.h,fill:{color:'FFFFFF'},line:{color:'000000',width:2},rectRadius:0.05});slide.addText(f.label||'',{x:f.x,y:f.y-0.25,w:f.w,h:0.25,fontSize:11,align:'center',fontFace:'맑은 고딕'});}
    (fig.connections||[]).forEach(conn=>{if(!conn.route||conn.route.length<2)return;for(let ri=0;ri<conn.route.length-1;ri++){const p1=conn.route[ri],p2=conn.route[ri+1];const lo={color:'000000',width:1.0};if(ri===conn.route.length-2&&(conn.arrow==='end'||conn.arrow==='both'))lo.endArrowType='triangle';if(ri===0&&(conn.arrow==='start'||conn.arrow==='both'))lo.beginArrowType='triangle';slide.addShape(pptx.shapes.LINE,{x:Math.min(p1.x,p2.x),y:Math.min(p1.y,p2.y),w:Math.max(0.001,Math.abs(p2.x-p1.x)||0.001),h:Math.max(0.001,Math.abs(p2.y-p1.y)||0.001),line:lo});}});
    (fig.blocks||[]).forEach(block=>{const st=block.shape==='diamond'?pptx.shapes.DIAMOND:block.shape==='circle'?pptx.shapes.OVAL:pptx.shapes.ROUNDED_RECTANGLE;slide.addShape(st,{x:block.x,y:block.y,w:block.w,h:block.h,fill:{color:'FFFFFF'},line:{color:'000000',width:1.5},rectRadius:block.shape==='stadium'?0.35:0.05});slide.addText(block.label||'',{x:block.x+0.04,y:block.y,w:block.w-0.08,h:block.h,fontSize:Math.min(11,Math.max(7,block.w*5)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});if(block.refNum){let rl=block.refLeader;const pos=block.refNumPos||'right';if(!rl){if(pos==='right')rl={startX:block.x+block.w,startY:block.y+block.h/2,endX:block.x+block.w+0.35,endY:block.y+block.h/2};else if(pos==='left')rl={startX:block.x,startY:block.y+block.h/2,endX:block.x-0.35,endY:block.y+block.h/2};else if(pos==='top')rl={startX:block.x+block.w/2,startY:block.y,endX:block.x+block.w/2,endY:block.y-0.25};else rl={startX:block.x+block.w/2,startY:block.y+block.h,endX:block.x+block.w/2,endY:block.y+block.h+0.25};}slide.addShape(pptx.shapes.LINE,{x:Math.min(rl.startX,rl.endX),y:Math.min(rl.startY,rl.endY),w:Math.max(0.001,Math.abs(rl.endX-rl.startX)||0.001),h:Math.max(0.001,Math.abs(rl.endY-rl.startY)||0.001),line:{color:'000000',width:0.75}});slide.addText(block.refNum,{x:pos==='left'?rl.endX-0.4:rl.endX,y:rl.endY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:pos==='left'?'right':'left'});}});
  });
  pptx.writeFile({fileName:fileName||'patent_diagram_v14.pptx'});App.showToast('PPTX 다운로드 완료');
}

function renderDiagramsV14(sid,responseText){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11';
  const el=document.getElementById(cid);if(el)el.innerHTML='';
  const jr=parseDesignJSON(responseText);
  if(jr.success){
    console.log('[v14] JSON 도면 렌더링');
    const figs=jr.data.figures;
    diagramData[sid]=figs.map(f=>({_version:2,json:f}));
    const autoNums=getAutoFigNums(sid);
    figs.forEach((fig,i)=>renderDiagramFromJSON(cid,fig,fig.figNum||autoNums[i]||(i+1)));
    const dl=document.getElementById(sid==='step_07'?'diagramDownload07':'diagramDownload11');if(dl)dl.style.display='block';
    return true;
  }
  console.warn('[v14] JSON 실패:',jr.error,'<span class="ico" data-icon="arrow-right"></span> Mermaid 폴백');
  renderDiagrams(sid,responseText);
  return false;
}

function downloadPptxV14(sid){
  const data=diagramData[sid];
  if(data&&data.length&&data[0]._version===2){
    generatePptxFromJSON(data.map(d=>d.json),sid==='step_07'?'장치도면.pptx':'방법도면.pptx');
    return;
  }
  downloadPptx(sid);
}

function parseMermaidGraph(code){
  const nodes={},edges=[];
  
  // ★ 다양한 Mermaid 노드 형태 지원 ★
  // 1. A["label"] - 사각형 (rect)
  // 2. A(["label"]) - 스타디움 (stadium) - 시작/종료
  // 3. A("label") - 둥근 사각형 (round)
  // 4. A{"label"} - 다이아몬드 (diamond) - 조건 분기
  // 5. A[/"label"/] - 평행사변형
  // 6. A(("label")) - 원형
  
  // 먼저 줄 단위로 노드 정의 추출
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef'))return;
    // [C2-1] subgraph 부모 컨테이너 노드 생성
    if(l.startsWith('subgraph')){
      const sgm=l.match(/^subgraph\s+(\w+)(?:\s*\[["']?(.+?)["']?\])?/);
      if(sgm){const[,id,label]=sgm;if(!nodes[id])nodes[id]={id,label:(label||id).trim(),shape:'container',isContainer:true};}
      return;
    }
    
    // 노드 정의 패턴들 (순서 중요: 더 복잡한 패턴 먼저)
    const patterns=[
      {re:/(\w+)\s*\(\[\s*["']?([^\]"']+?)["']?\s*\]\)/g, shape:'stadium'},
      {re:/(\w+)\s*\(\(\s*["']?([^)"']+?)["']?\s*\)\)/g, shape:'circle'},
      {re:/(\w+)\s*\{\s*["']?([^}"']+?)["']?\s*\}/g, shape:'diamond'},
      {re:/(\w+)\s*\(\s*["']?([^)"']+?)["']?\s*\)/g, shape:'round'},
      {re:/(\w+)\s*\[\s*["']?([^\]"']+?)["']?\s*\]/g, shape:'rect'},
    ];
    
    patterns.forEach(({re,shape})=>{
      re.lastIndex=0;
      let nm;
      while((nm=re.exec(l))!==null){
        const[,id,label]=nm;
        if(label.includes('-->')||label.includes('<--')||label.includes('---'))continue;
        if(!nodes[id])nodes[id]={id,label:label.trim(),shape};
      }
    });
  });
  
  // 연결선 추출 (v15: 인라인 라벨/체인 대응 토큰 파서)
  // 기존 정규식은 화살표 왼쪽이 \w로 끝나야 매칭되어, A["라벨"] --> B["라벨"] 처럼
  // 노드가 인라인 라벨을 가지면 엣지를 통째로 누락했다. 또한 A --> B --> C 체인도
  // 첫 엣지만 잡혔다. → 인라인 라벨/클래스지정을 제거한 골격에서 토큰 단위로 파싱.
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef')||l.startsWith('subgraph'))return;
    // 노드 인라인 라벨(([..]),((..)),[/../],[..],{..},(..)) 및 클래스지정(:::) 제거 → "id 화살표 id" 골격만 남김
    const skel=l.replace(/\(\[[\s\S]*?\]\)|\(\([\s\S]*?\)\)|\[\/[\s\S]*?\/\]|\[[\s\S]*?\]|\{[\s\S]*?\}|\([\s\S]*?\)/g,' ').replace(/:::\w+/g,' ');
    // 토큰: 화살표(<--> 우선) | 엣지라벨(|..|) | 노드ID
    const toks=skel.match(/<-->|-->|---|\|[^|]*\||\w+/g);
    if(!toks)return;
    let prevId=null,arrow=null,elabel='';
    for(const t of toks){
      if(t==='-->'||t==='<-->'||t==='---'){arrow=t;elabel='';}
      else if(t[0]==='|'){elabel=t.slice(1,-1).trim();}
      else{ // 노드 ID
        if(prevId&&arrow){
          if(!nodes[prevId])nodes[prevId]={id:prevId,label:prevId};
          if(!nodes[t])nodes[t]={id:t,label:t};
          edges.push({from:prevId,to:t,label:elabel||'',bidirectional:arrow==='<-->'});
        }
        prevId=t;arrow=null;elabel='';
      }
    }
  });
  
  // ═══ v9.0: 참조번호 중복 노드 정리 (외부/중복 노드 제거) ═══
  const refMap={}; // refNum → [nodeId, ...]
  Object.values(nodes).forEach(nd=>{
    const ref=_extractRefNum(nd.label,'');
    if(ref&&!/^S/i.test(ref)){
      if(!refMap[ref])refMap[ref]=[];
      refMap[ref].push(nd.id);
    }
  });
  
  // 중복 참조번호가 있는 경우 처리
  Object.entries(refMap).forEach(([ref,ids])=>{
    if(ids.length<=1)return;
    // "외부" 또는 연결 대상이 아닌 노드를 제거 대상으로
    const toRemove=[];
    ids.forEach(id=>{
      const nd=nodes[id];
      const label=nd.label.replace(/[\s(]\d+[)\s]*$/,'').trim();
      // "외부", "외부 서버", "외부 시스템", "외부 장치" 등
      if(/^외부/.test(label)){
        toRemove.push(id);
      }
    });
    // 모두 제거 대상이면 첫 번째만 남김
    if(toRemove.length===ids.length)toRemove.shift();
    toRemove.forEach(id=>{
      // 이 노드에 연결된 엣지를 원본 노드로 리다이렉트
      const origId=ids.find(i=>!toRemove.includes(i));
      if(origId){
        edges.forEach(e=>{
          if(e.from===id)e.from=origId;
          if(e.to===id)e.to=origId;
        });
      }
      const removedLabel=nodes[id]?.label||id;
      delete nodes[id];
      console.warn(`[v9.0] 중복 참조번호(${ref}) 노드 제거: "${removedLabel}" → 원본 "${nodes[origId]?.label||origId}"로 리다이렉트`);
    });
  });
  
  // 자기 자신을 참조하는 엣지 제거 (리다이렉트 후 발생 가능)
  const cleanEdges=edges.filter(e=>e.from!==e.to);
  // 중복 엣지 제거
  const edgeSet=new Set();
  const uniqueEdges=cleanEdges.filter(e=>{
    const key=e.from+'→'+e.to;
    const keyRev=e.to+'→'+e.from;
    if(edgeSet.has(key)||edgeSet.has(keyRev))return false;
    edgeSet.add(key);
    return true;
  });
  
  const result={nodes:Object.values(nodes),edges:uniqueEdges};
  return result;
}
function layoutGraph(nodes,edges){
  // [C2-2] container 노드 분리 — 일반 레이아웃에서 제외 후 bounding box로 확장
  const containers=nodes.filter(n=>n.isContainer);
  const regular=nodes.filter(n=>!n.isContainer);
  const layoutNodes=regular.length>0?regular:nodes;

  const adj={};edges.forEach(e=>{if(!adj[e.from])adj[e.from]=[];adj[e.from].push(e.to);});
  const targets=new Set(edges.map(e=>e.to));const roots=layoutNodes.filter(n=>!targets.has(n.id));
  if(!roots.length&&layoutNodes.length)roots.push(layoutNodes[0]);
  const levels={},visited=new Set();const queue=roots.map(r=>({id:r.id,level:0}));
  while(queue.length){const{id,level}=queue.shift();if(visited.has(id))continue;visited.add(id);levels[id]=level;(adj[id]||[]).forEach(tid=>{if(!visited.has(tid))queue.push({id:tid,level:level+1});});}
  layoutNodes.forEach(n=>{if(!(n.id in levels))levels[n.id]=0;});
  const groups={};layoutNodes.forEach(n=>{const lv=levels[n.id];if(!groups[lv])groups[lv]=[];groups[lv].push(n);});
  const NW=2.5,NH=0.65,HG=0.8,VG=1.2,SW=13.33,startY=0.7;const positions={};
  Object.entries(groups).forEach(([lv,grp])=>{const totalW=grp.length*NW+(grp.length-1)*HG;const sx=(SW-totalW)/2;grp.forEach((node,i)=>{const x=sx+i*(NW+HG),y=startY+parseInt(lv)*(NH+VG);positions[node.id]={x,y,w:NW,h:NH,cx:x+NW/2,cy:y+NH/2};});});

  // [C2-2] container → 자식 노드의 bounding box + padding
  const CPD=0.4,CLH=0.3;
  containers.forEach(cn=>{
    const cRef=parseInt((_extractRefNum(cn.label,'')||'').replace(/\D/g,''));
    const children=regular.filter(n=>{
      const nRef=parseInt((_extractRefNum(n.label,'')||'').replace(/\D/g,''));
      if(isNaN(cRef)||isNaN(nRef))return true;
      return Math.floor(nRef/100)===Math.floor(cRef/100)&&nRef!==cRef;
    });
    const childPos=children.map(c=>positions[c.id]).filter(Boolean);
    if(childPos.length===0){
      positions[cn.id]={x:0,y:startY,w:NW,h:NH,cx:NW/2,cy:startY+NH/2};
      return;
    }
    let minX=Infinity,minY=Infinity,maxR=-Infinity,maxB=-Infinity;
    childPos.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxR=Math.max(maxR,p.x+p.w);maxB=Math.max(maxB,p.y+p.h);});
    const w=(maxR-minX)+CPD*2,h=(maxB-minY)+CPD*2+CLH;
    const x=minX-CPD,y=minY-CPD-CLH;
    positions[cn.id]={x,y,w,h,cx:x+w/2,cy:y+h/2};
  });
  return positions;
}
function computeEdgeRoutes(edges,positions){
  return edges.map((e,ei)=>{const fp=positions[e.from],tp=positions[e.to];if(!fp||!tp)return null;const sx=fp.cx,sy=fp.y+fp.h,tx=tp.cx,ty=tp.y;const segments=[];let labelPos=null;
    if(Math.abs(sx-tx)<0.05){segments.push({type:'line',x1:sx,y1:sy,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:sx+0.15,y:(sy+ty)/2-0.12};}
    else{const baseM=(sy+ty)/2,offset=(ei%3-1)*0.12,midY=baseM+offset;segments.push({type:'line',x1:sx,y1:sy,x2:sx,y2:midY,arrow:false});segments.push({type:'line',x1:sx,y1:midY,x2:tx,y2:midY,arrow:false});segments.push({type:'line',x1:tx,y1:midY,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:Math.max(sx,tx)+0.15,y:midY-0.12};}
    return{segments,label:e.label,labelPos};
  }).filter(Boolean);
}

// ═══ 2D Layout Engine v4.0: Hub-Centered + 제약 기반 배치 ═══
// 원칙 1: 허브는 반드시 중앙 열
// 원칙 2: 허브 이웃은 허브와 같은 행 또는 같은 열
// 원칙 3: 고립 노드는 별도 행 (다른 노드 자리 침범 금지)
// 원칙 4: 행 너비 통일 (null 슬롯으로 균형)

// [C2-9] shapeicon 판별 (layout 단계에서 사용)
// 파형/전파 등 수직 공간을 추가로 점유하는 shape을 박스형과 분리 배치하기 위함
function _isShapeiconLabel(label){
  const t=matchIconShape(label||'');
  return t==='sensor'||t==='antenna'||t==='camera'||t==='speaker';
}

// [C2-9] Fig 1 전용 shapeicon 인식 배치
// 허브+자식 토폴로지에서 shapeicon을 박스와 다른 행에 분리하여
// 꺾임 최소화 + 화살표-shape 겹침 방지. figNum===1에서만 동작.
// 반환: null(폴백) 또는 {grid, maxCols, numRows, uniqueEdges, layers, biDirPairs}
function _tryC29ShapeAwareLayout(nodes, adj, uniqueEdges, biDirPairs, n){
  // 허브 판별: maxDeg >= 2
  const degs={};
  nodes.forEach(nd=>{degs[nd.id]=(adj[nd.id]||new Set()).size;});
  const degVals=Object.values(degs);
  const maxDeg=degVals.length>0?Math.max(...degVals):0;
  if(maxDeg<2)return null;

  const refNum=id=>{
    const nd=nodes.find(x=>x.id===id);
    return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
  };
  const hubCands=nodes.filter(nd=>degs[nd.id]===maxDeg);
  const hub=hubCands.slice().sort((a,b)=>refNum(a.id)-refNum(b.id))[0];
  const childIds=[...(adj[hub.id]||new Set())];

  // 완전 허브형(고립 노드 없음, 자식 2~4개)만 처리
  if(childIds.length!==n-1)return null;
  if(childIds.length<2||childIds.length>4)return null;

  const childNodes=childIds.map(id=>nodes.find(x=>x.id===id)).filter(Boolean);
  const boxChildren=childNodes.filter(nd=>!_isShapeiconLabel(nd.label))
    .sort((a,b)=>refNum(a.id)-refNum(b.id));
  const iconChildren=childNodes.filter(nd=>_isShapeiconLabel(nd.label))
    .sort((a,b)=>refNum(a.id)-refNum(b.id));

  let layers;
  let strategy;

  if(iconChildren.length===0){
    // HUB_HORIZONTAL: 박스만, 허브 중앙, 1행
    strategy='HUB_HORIZONTAL';
    const total=1+boxChildren.length;
    const hubCol=Math.floor(total/2);
    const row=[];
    let bi=0;
    for(let i=0;i<total;i++){
      if(i===hubCol)row.push(hub.id);
      else row.push(boxChildren[bi++].id);
    }
    layers=[row];
  }else if(boxChildren.length===0){
    // ICON_VERTICAL: 아이콘만, 수직 1열
    strategy='ICON_VERTICAL';
    layers=[[hub.id], ...iconChildren.map(ic=>[ic.id])];
  }else{
    // HYBRID: 상단 [박스들 + 허브], 하단 [아이콘들 수직, 허브 col 정렬]
    strategy='HYBRID';
    const topWidth=1+boxChildren.length;
    const hubCol=Math.floor(topWidth/2);
    const topRow=[];
    let bi=0;
    for(let i=0;i<topWidth;i++){
      if(i===hubCol)topRow.push(hub.id);
      else topRow.push(boxChildren[bi++].id);
    }
    const iconLayers=iconChildren.map(ic=>{
      const r=new Array(topWidth).fill(null);
      r[hubCol]=ic.id;
      return r;
    });
    layers=[topRow, ...iconLayers];
  }

  // layers → grid 생성 (null 슬롯은 col 인덱스 유지하며 스킵)
  const grid={};
  let maxCols=1;
  layers.forEach((layer,ri)=>{
    maxCols=Math.max(maxCols,layer.length);
    layer.forEach((id,ci)=>{
      if(id===null)return;
      grid[id]={row:ri,col:ci,layerSize:layer.length};
    });
  });

  console.log(`[Layout C2-9] figNum=1 n=${n} strategy=${strategy} hub=${hub.id} boxes=${boxChildren.length} icons=${iconChildren.length} rows=${layers.length} maxCols=${maxCols}`);

  return{grid, maxCols, numRows:layers.length, uniqueEdges, layers, biDirPairs};
}

function computeDeviceLayout2D(nodes,edges,figNum){
  const n=nodes.length;
  console.log(`[Layout] input: n=${n}, edges=${edges.length}, figNum=${figNum}`);
  console.log(`[Layout] nodes:`,nodes.map(nd=>nd.id+':'+nd.label.slice(0,20)));
  console.log(`[Layout] edges:`,edges.map(e=>e.from+'→'+e.to));
  if(n===0)return{grid:{},maxCols:1,numRows:0,uniqueEdges:[],biDirPairs:[]};
  if(n===1)return{grid:{[nodes[0].id]:{row:0,col:0,layerSize:1}},maxCols:1,numRows:1,uniqueEdges:[],biDirPairs:[]};
  const MAX_COLS=3;
  figNum=figNum||1;
  // ★ P2-FIX: self-loop 제거 (동일 노드 연결은 도면에 표현 불가) ★
  edges=edges.filter(e=>e.from!==e.to);
  
  // ═══ v15 FIX-B: 양방향 edge 단방향화 전처리 ═══
  // A-->B와 B-->A가 동시에 있으면 참조번호 작은 쪽→큰 쪽으로 정규화
  // → 가짜 순환 제거 → TOPOLOGICAL 전략 정상 적용
  const _nodeRefNum=id=>{
    const nd=nodes.find(n=>n.id===id);
    return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
  };
  const edgePairSet=new Set();
  const deduplicatedEdges=[];
  const biDirPairs=[]; // ★ FIX-3: 양방향 엣지 쌍 추적 ★
  edges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(edgePairSet.has(k2)){
      // 역방향이 이미 등록됨 → 중복 양방향 제거
      // ★ FIX-3: 양방향 쌍 기록 (참조번호 작은 쪽 → 큰 쪽) ★
      const[k2f,k2t]=k2.split('|');
      biDirPairs.push(_nodeRefNum(k2f)<=_nodeRefNum(k2t)?{a:k2f,b:k2t}:{a:k2t,b:k2f});
      return;
    }
    edgePairSet.add(k1);
    // 참조번호 기준으로 방향 정규화 (작은 → 큰)
    if(_nodeRefNum(e.from)>_nodeRefNum(e.to)){
      deduplicatedEdges.push({from:e.to,to:e.from,label:e.label});
    }else{
      deduplicatedEdges.push(e);
    }
  });

  // ═══ 공통: 인접 리스트 + 방향 그래프 구축 ═══
  const adj={};        // 양방향 (탐색용)
  const dirAdj={};     // 단방향 (위상 정렬용)
  const dirAdjRev={};  // 역방향
  nodes.forEach(nd=>{adj[nd.id]=new Set();dirAdj[nd.id]=new Set();dirAdjRev[nd.id]=new Set();});
  const edgeSet=new Set();
  // ★ 단방향화된 deduplicatedEdges로 그래프 구축 ★
  deduplicatedEdges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(!edgeSet.has(k1)&&!edgeSet.has(k2))edgeSet.add(k1);
    if(adj[e.from])adj[e.from].add(e.to);
    if(adj[e.to])adj[e.to].add(e.from);
    if(dirAdj[e.from])dirAdj[e.from].add(e.to);
    if(dirAdjRev[e.to])dirAdjRev[e.to].add(e.from);
  });
  // ★ uniqueEdges는 원본 edges 기반 — 렌더링 시 모든 연결 표시 ★
  // ★ v16 FIX-E: _wasBidirectional 플래그로 양방향 화살표 정보 보존 ★
  const biDirPairSet=new Set(biDirPairs.map(p=>[p.a,p.b].sort().join('|')));
  const origEdgeSet=new Set();
  edges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(!origEdgeSet.has(k1)&&!origEdgeSet.has(k2))origEdgeSet.add(k1);
  });
  const uniqueEdges=[...origEdgeSet].map(k=>{
    const[f,t]=k.split('|');
    const sortedKey=[f,t].sort().join('|');
    return{from:f,to:t,_wasBidirectional:biDirPairSet.has(sortedKey)};
  });
  const allIds=nodes.map(nd=>nd.id);
  
  // ═══ edge 없음 → 참조번호 오름차순 그리드 ═══
  if(edges.length===0){
    const sorted=[...nodes].sort((a,b)=>{
      const ra=parseInt((a.label.match(/\((\d+)\)/)||[])[1])||9999;
      const rb=parseInt((b.label.match(/\((\d+)\)/)||[])[1])||9999;
      return ra-rb;
    });
    const grid={};const rows=[];
    for(let i=0;i<n;i+=MAX_COLS){rows.push(sorted.slice(i,Math.min(i+MAX_COLS,n)).map(nd=>nd.id));}
    rows.forEach((row,ri)=>{row.forEach((id,ci)=>{grid[id]={row:ri,col:ci,layerSize:row.length};});});
    return{grid,maxCols:Math.min(n,MAX_COLS),numRows:rows.length,uniqueEdges:[],layers:rows,biDirPairs:[]};
  }

  // [C2-9] Fig 1 전용 shapeicon 인식 배치 (P4-FIX 및 전략 선택 이전)
  // 허브 + 자식 2~4개 토폴로지에서 박스/shapeicon 분리 배치로 꺾임·겹침 최소화
  if(figNum===1&&n>=3&&n<=5){
    const _c29=_tryC29ShapeAwareLayout(nodes,adj,uniqueEdges,biDirPairs,n);
    if(_c29)return _c29;
  }

  // ★ P4-FIX: 3개 이하 노드는 무조건 1행 가로 배치 ★
  if(n<=MAX_COLS&&n>=2){
    const sorted=[...nodes].sort((a,b)=>{
      const ra=parseInt((a.label.match(/\((\d+)\)/)||[])[1])||9999;
      const rb=parseInt((b.label.match(/\((\d+)\)/)||[])[1])||9999;
      return ra-rb;
    });
    // 허브가 있으면 중앙에 배치 (CK-8)
    const _adjLocal={};
    nodes.forEach(nd=>{_adjLocal[nd.id]=new Set();});
    deduplicatedEdges.forEach(e=>{
      if(_adjLocal[e.from])_adjLocal[e.from].add(e.to);
      if(_adjLocal[e.to])_adjLocal[e.to].add(e.from);
    });
    const _degLocal={};
    sorted.forEach(nd=>{_degLocal[nd.id]=(_adjLocal[nd.id]||new Set()).size;});
    const _maxDegLocal=Math.max(...Object.values(_degLocal),0);
    if(_maxDegLocal>=2){
      const hubIdx=sorted.findIndex(nd=>_degLocal[nd.id]===_maxDegLocal);
      if(hubIdx>=0){
        const hub=sorted.splice(hubIdx,1)[0];
        const center=Math.floor(sorted.length/2);
        sorted.splice(center,0,hub);
      }
    }
    const grid={};
    sorted.forEach((nd,ci)=>{grid[nd.id]={row:0,col:ci,layerSize:n};});
    return{grid,maxCols:n,numRows:1,uniqueEdges,layers:[sorted.map(nd=>nd.id)],biDirPairs};
  }

  // ═══ 순환 검출 (Kahn's algorithm) ═══
  function _detectCycle(){
    const inDeg={};
    allIds.forEach(id=>{inDeg[id]=0;});
    allIds.forEach(id=>{(dirAdj[id]||new Set()).forEach(to=>{inDeg[to]=(inDeg[to]||0)+1;});});
    const q=allIds.filter(id=>inDeg[id]===0);
    let visited=0;
    while(q.length>0){
      const cur=q.shift();visited++;
      (dirAdj[cur]||new Set()).forEach(next=>{inDeg[next]--;if(inDeg[next]===0)q.push(next);});
    }
    return visited<n; // true = 순환 있음
  }
  const hasCycle=_detectCycle();
  
  // ═══ 그래프 유형 분류 (v17 — 허브 중심 통합) ═══
  const degrees={};
  allIds.forEach(id=>{degrees[id]=(adj[id]||new Set()).size;});
  const degreeValues=Object.values(degrees);
  const maxDeg=Math.max(...degreeValues, 0);
  const isolatedNodes=allIds.filter(id=>degrees[id]===0);
  const connectedNodes=allIds.filter(id=>degrees[id]>0);

  // 허브: 연결된 노드 중 가장 많이 연결된 노드
  const hubCandidates=connectedNodes.filter(id=>degrees[id]===maxDeg);
  // 허브 판정: max degree ≥ 2 AND (전체 edge의 40% 이상 차지 OR degree ≥ 3)
  const hubEdgeRatio=maxDeg/Math.max(deduplicatedEdges.length,1);
  const hasStrongHub=maxDeg>=2&&(hubEdgeRatio>=0.4||maxDeg>=3);

  let strategy;
  if(hasStrongHub){
    strategy='HUB_CENTERED';     // 허브 강함 → 도 번호 무관 허브 중심
  }else if(deduplicatedEdges.length===0||connectedNodes.length<=1){
    strategy='SIMPLE_GRID';      // edge 없음/연결 1개 → 단순 격자
  }else if(!hasCycle){
    strategy='TOPOLOGICAL';      // DAG → 위상 정렬
  }else{
    strategy='CHAIN_FIRST';      // 순환 → 체인 기반 폴백
  }

  console.log(`[Layout v17] figNum=${figNum}, n=${n}, strategy=${strategy}, maxDeg=${maxDeg}, hubRatio=${hubEdgeRatio.toFixed(2)}, isolated=${isolatedNodes.length}`);
  
  // ═══ 전략별 레이어 생성 ═══
  let layers=[];
  const alignCol={};
  let _hubId=null; // ★ v16: 허브 ID — 전략 블록 밖에서 접근 가능 ★

  if(strategy==='TOPOLOGICAL'){
    // ── 위상 정렬: 입력→출력 방향 배치 ──
    // ★ v17: 고립 노드를 먼저 분리 → 끝에 별도 행 ★
    const connectedForTopo=allIds.filter(id=>degrees[id]>0);
    const isolatedForTopo=allIds.filter(id=>degrees[id]===0);

    const nodeMap=new Map(nodes.map(nd=>[nd.id,nd]));
    const _refNum=id=>{return parseInt((nodeMap.get(id)?.label.match(/\((\d+)\)/)||[])[1])||9999;};
    const inDeg={};
    connectedForTopo.forEach(id=>{inDeg[id]=0;});
    connectedForTopo.forEach(id=>{(dirAdj[id]||new Set()).forEach(to=>{if(inDeg[to]!==undefined)inDeg[to]=(inDeg[to]||0)+1;});});

    const q=connectedForTopo.filter(id=>inDeg[id]===0);
    q.sort((a,b)=>_refNum(a)-_refNum(b));

    const topoOrder=[];
    const visited=new Set();
    while(q.length>0){
      const cur=q.shift();
      if(visited.has(cur))continue;
      visited.add(cur);
      topoOrder.push(cur);
      const nexts=[...(dirAdj[cur]||new Set())].filter(id=>inDeg[id]!==undefined).sort((a,b)=>_refNum(a)-_refNum(b));
      nexts.forEach(next=>{
        inDeg[next]--;
        if(inDeg[next]===0)q.push(next);
      });
    }
    // 위상 정렬에서 빠진 연결 노드 추가
    connectedForTopo.forEach(id=>{if(!visited.has(id))topoOrder.push(id);});

    // 위상 순서를 MAX_COLS씩 스네이크 배치
    for(let i=0;i<topoOrder.length;i+=MAX_COLS){
      const chunk=topoOrder.slice(i,Math.min(i+MAX_COLS,topoOrder.length));
      const rowIdx=Math.floor(i/MAX_COLS);
      if(rowIdx%2===1)chunk.reverse();
      layers.push(chunk);
    }

    // 고립 노드를 별도 행으로 추가 (마지막)
    if(isolatedForTopo.length>0){
      isolatedForTopo.sort((a,b)=>_refNum(a)-_refNum(b));
      for(let ii=0;ii<isolatedForTopo.length;ii+=MAX_COLS){
        layers.push(isolatedForTopo.slice(ii,ii+MAX_COLS));
      }
    }

  }else if(strategy==='HUB_CENTERED'){
    // ── ★ v17: 허브 중심 제약 기반 배치 ★ ──
    // 원칙 1: 허브는 반드시 중앙 열
    // 원칙 2: 허브 이웃은 허브와 같은 행 또는 같은 열
    // 원칙 3: 고립 노드는 별도 행 (다른 노드 자리 침범 금지)
    // 원칙 4: 행 너비는 통일 (null 슬롯으로 균형)
    const _refNum=id=>{
      const nd=nodes.find(n=>n.id===id);
      return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
    };
    // 허브 선택: maxDeg 중 참조번호 최소
    const hubId=hubCandidates.sort((a,b)=>_refNum(a)-_refNum(b))[0];
    _hubId=hubId;
    const hubNbrs=[...(adj[hubId]||new Set())].sort((a,b)=>_refNum(a)-_refNum(b));
    const hubRef=_refNum(hubId);

    // ━━━ 이웃을 upstream(위)/downstream(아래)로 분류 ━━━
    // 우선순위: edge 방향 > 참조번호
    const upstream=[];    // 허브 위쪽 (입력)
    const downstream=[];  // 허브 아래쪽 (출력)
    hubNbrs.forEach(nid=>{
      const ref=_refNum(nid);
      const hasIncoming=(dirAdj[nid]||new Set()).has(hubId); // nid→hub
      const hasOutgoing=(dirAdj[hubId]||new Set()).has(nid); // hub→nid
      if(hasIncoming&&!hasOutgoing)upstream.push(nid);
      else if(hasOutgoing&&!hasIncoming)downstream.push(nid);
      else if(ref<hubRef)upstream.push(nid);
      else downstream.push(nid);
    });

    // ━━━ 균형 조정: 한쪽이 너무 많으면 반대쪽으로 ━━━
    while(upstream.length>3&&downstream.length<upstream.length-1){
      downstream.unshift(upstream.pop());
    }
    while(downstream.length>3&&upstream.length<downstream.length-1){
      upstream.push(downstream.shift());
    }

    // ━━━ 헬퍼: 행을 지정 너비로 중앙 정렬 (null 패딩) ━━━
    function _padRowCentered(items, targetWidth){
      if(items.length>=targetWidth)return items.slice(0, targetWidth);
      const padding=targetWidth-items.length;
      const leftPad=Math.floor(padding/2);
      const row=[];
      for(let i=0;i<leftPad;i++)row.push(null);
      items.forEach(it=>row.push(it));
      while(row.length<targetWidth)row.push(null);
      return row;
    }

    // ━━━ 특수 케이스: upstream ≤ 1 AND downstream ≥ 2 ━━━
    // → 허브와 downstream을 같은 행에 수평 배치 (꺾임 최소화)
    if(upstream.length<=1&&downstream.length>=2&&downstream.length<=MAX_COLS-1){
      const hubRowWidth=1+downstream.length; // 허브 + downstream
      // upstream 행 (있으면)
      if(upstream.length===1){
        const upRow=new Array(hubRowWidth).fill(null);
        // upstream을 허브 예정 위치와 같은 열에 배치
        const hubColIdx=Math.floor(hubRowWidth/2);
        upRow[hubColIdx]=upstream[0];
        layers.push(upRow);
      }
      // 허브 + downstream 같은 행
      // 허브를 중앙에 배치, downstream을 좌우에
      const hubDsRow=[];
      const hubPos=Math.floor(hubRowWidth/2);
      for(let ci=0;ci<hubRowWidth;ci++){
        if(ci===hubPos)hubDsRow.push(hubId);
        else hubDsRow.push(null);
      }
      // downstream을 빈 슬롯에 채움
      let dsIdx=0;
      for(let ci=0;ci<hubDsRow.length;ci++){
        if(hubDsRow[ci]===null&&dsIdx<downstream.length){
          hubDsRow[ci]=downstream[dsIdx++];
        }
      }
      layers.push(hubDsRow);
    }else{
      // ━━━ 일반 케이스: upstream / hub / downstream 3행 구조 ━━━
      const rowWidth=Math.max(upstream.length, downstream.length, 1);

      if(upstream.length>0){
        layers.push(_padRowCentered(upstream, rowWidth));
      }
      // 허브 행: 중앙에 허브, 나머지 null
      const hubRow=new Array(rowWidth).fill(null);
      hubRow[Math.floor(rowWidth/2)]=hubId;
      layers.push(hubRow);

      if(downstream.length>0){
        layers.push(_padRowCentered(downstream, rowWidth));
      }
    }

    // ━━━ 2차 이웃 + 고립 노드 배치 ━━━
    const placed=new Set([hubId, ...hubNbrs]);
    const remaining=allIds.filter(id=>!placed.has(id));
    const secondary=[];
    const isolatedRemaining=[];
    remaining.forEach(id=>{
      const nbrs=[...(adj[id]||new Set())];
      if(nbrs.some(nb=>placed.has(nb)))secondary.push(id);
      else isolatedRemaining.push(id);
    });

    // 2차 이웃: 연결된 허브 이웃의 행 기준으로 새 행 추가
    const hubRowIdx=layers.findIndex(r=>r.indexOf(hubId)>=0);
    secondary.sort((a,b)=>_refNum(a)-_refNum(b));
    secondary.forEach(id=>{
      const nbrs=[...(adj[id]||new Set())];
      const parentNbr=nbrs.find(nb=>placed.has(nb)&&nb!==hubId)||nbrs.find(nb=>placed.has(nb));
      if(!parentNbr){isolatedRemaining.push(id);return;}
      let parentRow=-1;
      for(let ri=0;ri<layers.length;ri++){
        if(layers[ri].indexOf(parentNbr)>=0){parentRow=ri;break;}
      }
      if(parentRow<0){isolatedRemaining.push(id);return;}
      const isAbove=parentRow<hubRowIdx;
      const targetRow=isAbove?0:layers.length;
      if(targetRow>=layers.length)layers.push([]);
      else if(targetRow===0)layers.unshift([]);
      const tRow=targetRow===0?0:layers.length-1;
      const nullIdx=layers[tRow].indexOf(null);
      if(nullIdx>=0)layers[tRow][nullIdx]=id;
      else layers[tRow].push(id);
      placed.add(id);
    });

    // 고립 노드는 마지막에 별도 행 (원칙 3)
    if(isolatedRemaining.length>0){
      isolatedRemaining.sort((a,b)=>_refNum(a)-_refNum(b));
      for(let ii=0;ii<isolatedRemaining.length;ii+=MAX_COLS){
        layers.push(isolatedRemaining.slice(ii, ii+MAX_COLS));
      }
    }

  }else if(strategy==='SIMPLE_GRID'){
    // ── ★ v17: 단순 격자 (edge 없음/연결 1개) ★ ──
    const _refNum=id=>{
      const nd=nodes.find(n=>n.id===id);
      return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
    };
    const sorted=allIds.slice().sort((a,b)=>_refNum(a)-_refNum(b));
    for(let i=0;i<sorted.length;i+=MAX_COLS){
      layers.push(sorted.slice(i, i+MAX_COLS));
    }

  }else{
    // ── 체인 기반 (기존 v10.6 알고리즘) ──
    // ★ v17: 고립 노드를 먼저 분리 → 끝에 별도 행 ★
    const connectedForChain=allIds.filter(id=>degrees[id]>0);
    const isolatedForChain=allIds.filter(id=>degrees[id]===0);

    let longestPath=[];
    const leaves=connectedForChain.filter(id=>(adj[id]||new Set()).size<=1);
    const startNodes=leaves.length>0?leaves:connectedForChain;

    // BFS 기반 최장경로 (O(V+E) — 지수시간 탐색 방지)
    for(const startId of startNodes){
      const dist={};const prev={};
      dist[startId]=0;prev[startId]=null;
      const bfsQ=[startId];const bfsVisited=new Set([startId]);
      while(bfsQ.length>0){
        const cur=bfsQ.shift();
        (adj[cur]||new Set()).forEach(next=>{
          if(!bfsVisited.has(next)){
            bfsVisited.add(next);
            dist[next]=(dist[cur]||0)+1;
            prev[next]=cur;
            bfsQ.push(next);
          }
        });
      }
      let farthest=startId,maxDist2=0;
      for(const[nid,d]of Object.entries(dist)){if(d>maxDist2){maxDist2=d;farthest=nid;}}
      if(maxDist2+1>longestPath.length){
        const p=[];let c=farthest;while(c!==null){p.unshift(c);c=prev[c];}
        longestPath=p;
      }
    }

    for(let i=0;i<longestPath.length;i+=MAX_COLS){
      const chunk=longestPath.slice(i,Math.min(i+MAX_COLS,longestPath.length));
      const rowIdx=Math.floor(i/MAX_COLS);
      if(rowIdx%2===1)chunk.reverse();
      layers.push(chunk);
    }

    // 나머지 연결 노드 배치
    const placed=new Set(longestPath);
    const remaining=connectedForChain.filter(id=>!placed.has(id));
    const remQueue=[...remaining];
    let remIter=0;
    while(remQueue.length>0&&remIter<remaining.length*3){
      remIter++;
      const id=remQueue.shift();
      const nbrs=[...(adj[id]||new Set())];
      let bestPlaced=false;
      for(const nbr of nbrs){
        if(!placed.has(nbr))continue;
        let nbrRow=-1;
        for(let ri=0;ri<layers.length;ri++){if(layers[ri].indexOf(nbr)>=0){nbrRow=ri;break;}}
        if(nbrRow<0)continue;
        if(layers[nbrRow].length<MAX_COLS){layers[nbrRow].push(id);placed.add(id);bestPlaced=true;break;}
        const targetRow=nbrRow+1;
        while(layers.length<=targetRow)layers.push([]);
        if(layers[targetRow].length<MAX_COLS){layers[targetRow].push(id);placed.add(id);bestPlaced=true;break;}
      }
      if(!bestPlaced){
        if(nbrs.some(nb=>!placed.has(nb))&&remIter<remaining.length*2){remQueue.push(id);continue;}
        let added=false;
        for(let li=0;li<layers.length;li++){if(layers[li].length<MAX_COLS){layers[li].push(id);placed.add(id);added=true;break;}}
        if(!added){layers.push([id]);placed.add(id);}
      }
    }

    // 고립 노드를 별도 행으로 추가 (마지막)
    if(isolatedForChain.length>0){
      const _refNumC=id=>{const nd=nodes.find(n=>n.id===id);return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;};
      isolatedForChain.sort((a,b)=>_refNumC(a)-_refNumC(b));
      for(let ii=0;ii<isolatedForChain.length;ii+=MAX_COLS){
        layers.push(isolatedForChain.slice(ii,ii+MAX_COLS));
      }
    }
  }
  
  // ═══ 공통 후처리: 빈 행 제거 + 꺾임·교차 최소화 ═══
  console.log(`[Layout] layers before optimize:`,layers.map((r,i)=>'행'+i+':'+JSON.stringify(r)));
  layers=layers.filter(r=>r.length>0);

  // ★ v15: 엣지 교차 카운트 함수 ★
  function countCrossings(lyrs){
    // 인접 행 쌍 간 엣지 교차 수 계산 (Sugiyama 스타일)
    let crossings=0;
    for(let ri=0;ri<lyrs.length-1;ri++){
      const upper=lyrs[ri], lower=lyrs[ri+1];
      // 이 두 행을 연결하는 엣지 수집
      const interEdges=[];
      uniqueEdges.forEach(e=>{
        const ui=upper.indexOf(e.from), li=lower.indexOf(e.to);
        if(ui>=0&&li>=0){interEdges.push({u:ui,l:li});return;}
        const ui2=upper.indexOf(e.to), li2=lower.indexOf(e.from);
        if(ui2>=0&&li2>=0){interEdges.push({u:ui2,l:li2});}
      });
      // 교차 카운트: 두 엣지 (u1,l1), (u2,l2)가 교차 ⟺ (u1-u2)*(l1-l2)<0
      for(let i=0;i<interEdges.length;i++){
        for(let j=i+1;j<interEdges.length;j++){
          if((interEdges[i].u-interEdges[j].u)*(interEdges[i].l-interEdges[j].l)<0)crossings++;
        }
      }
    }
    return crossings;
  }

  // ★ v15: Barycenter 순서 + 인접 스왑으로 교차 최소화 ★
  function barycenterOrder(lyrs,ri,fixedRi){
    // fixedRi 행을 기준으로 ri 행 노드를 barycenter 순으로 정렬
    const fixed=lyrs[fixedRi];
    const movable=[...lyrs[ri]];
    const bary={};
    movable.forEach(nid=>{
      const nbrs=[...(adj[nid]||new Set())];
      const positions=nbrs.map(nb=>fixed.indexOf(nb)).filter(i=>i>=0);
      bary[nid]=positions.length>0?(positions.reduce((s,v)=>s+v,0)/positions.length):fixed.length/2;
    });
    movable.sort((a,b)=>bary[a]-bary[b]);
    return movable;
  }

  // ★ v17: HUB_CENTERED는 이미 제약 기반 배치 → 최적화 스킵 ★
  if(strategy!=='HUB_CENTERED'){
  // Phase 1: Barycenter ordering (2-pass sweep)
  for(let pass=0;pass<2;pass++){
    // 하향 스윕
    for(let ri=1;ri<layers.length;ri++){
      if(layers[ri].length<=1)continue;
      layers[ri]=barycenterOrder(layers,ri,ri-1);
    }
    // 상향 스윕
    for(let ri=layers.length-2;ri>=0;ri--){
      if(layers[ri].length<=1)continue;
      layers[ri]=barycenterOrder(layers,ri,ri+1);
    }
  }

  // Phase 2: Adjacent swap (교차 수 감소할 때까지 반복)
  let improved=true;
  let swapRounds=0;
  while(improved&&swapRounds<5){
    improved=false;
    swapRounds++;
    for(let ri=0;ri<layers.length;ri++){
      if(layers[ri].length<=2)continue;
      const row=layers[ri];
      for(let ci=0;ci<row.length-1;ci++){
        const before=countCrossings(layers);
        [row[ci],row[ci+1]]=[row[ci+1],row[ci]];
        const after=countCrossings(layers);
        if(after<before){improved=true;}
        else{[row[ci],row[ci+1]]=[row[ci+1],row[ci]];}
      }
    }
  }
  } // end HUB_CENTERED guard
  
  // 꺾임 수 계산 함수 (v17: null 슬롯 안전)
  function countBends(lyrs,ac){
    let bends=0;
    uniqueEdges.forEach(e=>{
      let fr=-1,fc=-1,tr=-1,tc=-1;
      for(let ri=0;ri<lyrs.length;ri++){
        const fi=lyrs[ri].indexOf(e.from);
        if(fi>=0){fr=ri;fc=ac[e.from]?ac[e.from].col:fi;}
        const ti=lyrs[ri].indexOf(e.to);
        if(ti>=0){tr=ri;tc=ac[e.to]?ac[e.to].col:ti;}
      }
      if(fr<0||tr<0)return;
      // 같은 행이거나 같은 열이면 꺾임 없음 (직선)
      if(fr===tr||fc===tc)return;
      bends++;
    });
    return bends;
  }
  
  // 수직 연결 열 정렬 재계산
  function _recalcAlignCol(){
    Object.keys(alignCol).forEach(k=>delete alignCol[k]);
    for(let ri=0;ri<layers.length-1;ri++){
      const curRow=layers[ri];
      const nextRow=layers[ri+1];
      nextRow.forEach(nid=>{
        if(nid===null)return; // ★ v17: null 슬롯 건너뛰기 ★
        const nbrs=[...(adj[nid]||new Set())];
        for(const nbr of nbrs){
          const nbrCI=curRow.indexOf(nbr);
          if(nbrCI>=0){alignCol[nid]={col:nbrCI,layerSize:Math.max(curRow.length,nextRow.length)};break;}
        }
      });
    }
  }

  // ★ v17: HUB_CENTERED는 순열 탐색·수직 정렬 최적화 스킵 ★
  if(strategy!=='HUB_CENTERED'){
  // 행 내 순서 최적화 — 순열 탐색 + 교차·꺾임 통합 비용
  for(let ri=0;ri<layers.length;ri++){
    if(layers[ri].length<=1)continue;
    if(layers[ri].indexOf(null)>=0)continue; // null 행 스킵
    const row=layers[ri];
    let perms;
    if(row.length===2)perms=[row,[row[1],row[0]]];
    else if(row.length===3)perms=[[row[0],row[1],row[2]],[row[0],row[2],row[1]],[row[1],row[0],row[2]],[row[1],row[2],row[0]],[row[2],row[0],row[1]],[row[2],row[1],row[0]]];
    else if(row.length===4){
      perms=[];
      for(let a=0;a<4;a++)for(let b=0;b<4;b++){if(b===a)continue;
        for(let c=0;c<4;c++){if(c===a||c===b)continue;
          const d=6-a-b-c; perms.push([row[a],row[b],row[c],row[d]]);
        }
      }
    }else{perms=[row];}
    let bestPerm=[...row];
    let bestCost=countCrossings(layers)*3+countBends(layers,alignCol);
    for(const perm of perms){
      layers[ri]=perm;
      const cost=countCrossings(layers)*3+countBends(layers,{...alignCol});
      if(cost<bestCost){bestCost=cost;bestPerm=[...perm];}
    }
    layers[ri]=bestPerm;
  }

  _recalcAlignCol();

  // 수직 정렬 최적화 — countBends 검증 기반 행 내 스왑
  let vAlignImproved=true;
  let vAlignRounds=0;
  while(vAlignImproved&&vAlignRounds<3){
    vAlignImproved=false;
    vAlignRounds++;
    for(let ri=0;ri<layers.length;ri++){
      const row=layers[ri];
      if(row.length<=1)continue;
      if(row.indexOf(null)>=0)continue; // null 행 스킵
      for(let ci=0;ci<row.length;ci++){
        for(let cj=ci+1;cj<row.length;cj++){
          const beforeBends=countBends(layers,alignCol);
          const beforeCross=countCrossings(layers);
          const beforeCost=beforeCross*3+beforeBends;
          [row[ci],row[cj]]=[row[cj],row[ci]];
          _recalcAlignCol();
          const afterBends=countBends(layers,alignCol);
          const afterCross=countCrossings(layers);
          const afterCost=afterCross*3+afterBends;
          if(afterCost<beforeCost){
            vAlignImproved=true;
          }else{
            [row[ci],row[cj]]=[row[cj],row[ci]];
            _recalcAlignCol();
          }
        }
      }
    }
  }
  } // end HUB_CENTERED guard for permutation/vertical alignment

  _recalcAlignCol();

  const finalBends=countBends(layers,alignCol);
  const finalCrossings=countCrossings(layers);

  console.log(`[Layout v17] ${n}nodes → ${layers.length}rows, strategy=${strategy}, bends=${finalBends}, crossings=${finalCrossings}${_hubId?', hub='+_hubId:''}`);

  // Grid 생성
  const grid={};let maxCols=1;
  layers.forEach((layer,rowIdx)=>{
    maxCols=Math.max(maxCols,layer.length);
    layer.forEach((id,colIdx)=>{
      if(id===null)return; // ★ FIX-D: null 슬롯 건너뛰기 (열 인덱스 유지) ★
      if(alignCol[id]){
        grid[id]={row:rowIdx,col:alignCol[id].col,layerSize:alignCol[id].layerSize};
        maxCols=Math.max(maxCols,alignCol[id].layerSize);
      }else{
        grid[id]={row:rowIdx,col:colIdx,layerSize:layer.length};
      }
    });
  });
  
  return{grid,maxCols:Math.min(maxCols,MAX_COLS),numRows:layers.length,uniqueEdges,layers,biDirPairs};
}

// ── Strict Orthogonal Router v4.0 ──
// 모든 세그먼트가 수평(H) 또는 수직(V)만 허용. 사선 절대 불가.
// ★ 핵심 변경: 모든 경로(직선 포함)에 충돌 검사 적용 + Z-shape 우회 ★
const ROUTE_PAD=15; // 연결선↔박스 최소 간격 (px)

function getOrthogonalRoute(fromBox,toBox,allBoxes,routePad){
  const pad=(routePad!==undefined)?routePad:ROUTE_PAD;
  const dx=toBox.cx-fromBox.cx, dy=toBox.cy-fromBox.cy;
  if(Math.abs(dx)<(pad*0.05)&&Math.abs(dy)<(pad*0.05))return null;
  
  const excludeIds=new Set([fromBox.id,toBox.id].filter(Boolean));
  const obstacles=(allBoxes||[]).filter(b=>!excludeIds.has(b.id));
  
  // ── 후보 경로 생성 ──
  const candidates=[];
  
  // 1) 같은 열 (수직 정렬) → 수직 직선
  if(Math.abs(dx)<Math.max(fromBox.w,toBox.w)*0.4){
    const midX=(fromBox.cx+toBox.cx)/2;
    if(dy>0)candidates.push({route:[{x:midX,y:fromBox.y+fromBox.h},{x:midX,y:toBox.y}],type:'straight-v'});
    else candidates.push({route:[{x:midX,y:fromBox.y},{x:midX,y:toBox.y+toBox.h}],type:'straight-v'});
  }
  
  // 2) 같은 행 (수평 정렬) → 수평 직선
  if(Math.abs(dy)<Math.max(fromBox.h,toBox.h)*0.4){
    const midY=(fromBox.cy+toBox.cy)/2;
    if(dx>0)candidates.push({route:[{x:fromBox.x+fromBox.w,y:midY},{x:toBox.x,y:midY}],type:'straight-h'});
    else candidates.push({route:[{x:fromBox.x,y:midY},{x:toBox.x+toBox.w,y:midY}],type:'straight-h'});
  }
  
  // 3) L-shape 후보 2개
  candidates.push({route:_buildLRoute_VH(fromBox,toBox,dy,dx),type:'L-vh'});
  candidates.push({route:_buildLRoute_HV(fromBox,toBox,dy,dx),type:'L-hv'});
  
  // ── 충돌 검사 & 최적 경로 선택 ──
  if(!obstacles.length){
    return candidates[0].route; // 장애물 없으면 첫 번째 후보
  }
  
  let bestRoute=null, bestHits=Infinity;
  candidates.forEach(c=>{
    const hits=_countRouteCollisions(c.route,obstacles,excludeIds,pad);
    if(hits<bestHits){bestHits=hits;bestRoute=c.route;}
  });
  
  // 충돌 0이면 바로 반환
  if(bestHits===0)return bestRoute;
  
  // ── Z-shape 우회 경로 시도 ──
  // 충돌하는 박스를 피해 바깥으로 우회
  const zRoutes=_buildZRoutes(fromBox,toBox,obstacles,dx,dy,pad);
  zRoutes.forEach(zr=>{
    const hits=_countRouteCollisions(zr,obstacles,excludeIds,pad);
    if(hits<bestHits){bestHits=hits;bestRoute=zr;}
  });
  
  return bestRoute;
}

// L-shape: 수직(V) 먼저 → 수평(H)
function _buildLRoute_VH(from,to,dy,dx){
  const exitX=from.cx;
  const exitY=dy>0?from.y+from.h:from.y;
  const entryY=to.cy;
  const entryX=dx>0?to.x:to.x+to.w;
  return[{x:exitX,y:exitY},{x:exitX,y:entryY},{x:entryX,y:entryY}];
}

// L-shape: 수평(H) 먼저 → 수직(V)
function _buildLRoute_HV(from,to,dy,dx){
  const exitY=from.cy;
  const exitX=dx>0?from.x+from.w:from.x;
  const entryX=to.cx;
  const entryY=dy>0?to.y:to.y+to.h;
  return[{x:exitX,y:exitY},{x:entryX,y:exitY},{x:entryX,y:entryY}];
}

// ★ Z-shape 우회 경로 생성 (장애물 회피의 핵심) ★
// 4방향으로 우회하는 5점 경로를 생성
function _buildZRoutes(from,to,obstacles,dx,dy,routePad){
  const routes=[];
  const PAD=(routePad!==undefined?routePad:ROUTE_PAD)+8*(routePad!==undefined?routePad/ROUTE_PAD:1);
  
  // 모든 장애물의 바운딩 박스 경계 수집
  let globalMinX=Infinity,globalMinY=Infinity,globalMaxX=-Infinity,globalMaxY=-Infinity;
  [from,to,...obstacles].forEach(b=>{
    globalMinX=Math.min(globalMinX,b.x);
    globalMinY=Math.min(globalMinY,b.y);
    globalMaxX=Math.max(globalMaxX,b.x+b.w);
    globalMaxY=Math.max(globalMaxY,b.y+b.h);
  });
  
  // Z-route 1: 위쪽 우회 (from 위→수평→to 위)
  const topY=globalMinY-PAD;
  routes.push([
    {x:from.cx, y:from.y},
    {x:from.cx, y:topY},
    {x:to.cx, y:topY},
    {x:to.cx, y:to.y}
  ]);
  
  // Z-route 2: 아래쪽 우회
  const bottomY=globalMaxY+PAD;
  routes.push([
    {x:from.cx, y:from.y+from.h},
    {x:from.cx, y:bottomY},
    {x:to.cx, y:bottomY},
    {x:to.cx, y:to.y+to.h}
  ]);
  
  // Z-route 3: 왼쪽 우회
  const leftX=globalMinX-PAD;
  routes.push([
    {x:from.x, y:from.cy},
    {x:leftX, y:from.cy},
    {x:leftX, y:to.cy},
    {x:to.x, y:to.cy}
  ]);
  
  // Z-route 4: 오른쪽 우회
  const rightX=globalMaxX+PAD;
  routes.push([
    {x:from.x+from.w, y:from.cy},
    {x:rightX, y:from.cy},
    {x:rightX, y:to.cy},
    {x:to.x+to.w, y:to.cy}
  ]);
  
  return routes;
}

// 경로가 박스를 관통하는지 검사
// ★ v11.1: pad 파라미터 추가 — PPTX(inch) vs SVG(px) 단위 대응 ★
function _countRouteCollisions(route,allBoxes,excludeIds,pad){
  let hits=0;
  const usePad=(pad!==undefined)?pad:ROUTE_PAD;
  for(let i=0;i<route.length-1;i++){
    const p1=route[i],p2=route[i+1];
    allBoxes.forEach(box=>{
      if(excludeIds&&excludeIds.has(box.id))return;
      if(_segmentIntersectsBox(p1,p2,box,usePad))hits++;
    });
  }
  return hits;
}

// H/V 세그먼트가 박스와 교차하는지
// ★ v12 FIX: 좌표계 독립 — px(SVG) / inch(PPTX) 모두 정확 ★
function _segmentIntersectsBox(p1,p2,box,pad){
  if(pad===undefined)pad=ROUTE_PAD;
  const bx1=box.x-pad,by1=box.y-pad,bx2=box.x+box.w+pad,by2=box.y+box.h+pad;
  // ★ v12: 절대 임계값(1) 대신 상대 비교 — PPTX(inch)에서 수직선 오판 방지 ★
  if(Math.abs(p1.y-p2.y)<=Math.abs(p1.x-p2.x)){
    // 수평 세그먼트 (또는 점)
    const y=(p1.y+p2.y)/2;
    if(y<by1||y>by2)return false;
    const minX=Math.min(p1.x,p2.x),maxX=Math.max(p1.x,p2.x);
    return maxX>bx1&&minX<bx2;
  }else{
    // 수직 세그먼트
    const x=(p1.x+p2.x)/2;
    if(x<bx1||x>bx2)return false;
    const minY=Math.min(p1.y,p2.y),maxY=Math.max(p1.y,p2.y);
    return maxY>by1&&minY<by2;
  }
}

// SVG orthogonal path renderer (H/V 세그먼트만 허용)
// ★ v16 FIX-E: bidir 파라미터 — true이면 양방향 화살표, false이면 단방향 ★
function svgOrthogonalEdge(route,mkId,bidir){
  if(!route||route.length<2)return'';
  const startMarker=bidir?` marker-start="url(#${mkId})"`:''  ;
  // ★ 안전 검증: 2점 경로에서 X,Y 모두 다르면 L-shape로 변환 ★
  if(route.length===2){
    const p0=route[0],p1=route[1];
    if(Math.abs(p0.x-p1.x)>1&&Math.abs(p0.y-p1.y)>1){
      // 사선 방지: L-shape로 변환 (수평→수직)
      route=[p0,{x:p1.x,y:p0.y},p1];
    }
  }
  if(route.length===2){
    return`<line x1="${route[0].x}" y1="${route[0].y}" x2="${route[1].x}" y2="${route[1].y}" stroke="#000" stroke-width="1"${startMarker} marker-end="url(#${mkId})"/>`;
  }
  let d=`M${route[0].x},${route[0].y}`;
  for(let i=1;i<route.length;i++)d+=` L${route[i].x},${route[i].y}`;
  return`<path d="${d}" fill="none" stroke="#000" stroke-width="1"${startMarker} marker-end="url(#${mkId})"/>`;
}

// Stagger leader line Y-positions to prevent reference number overlap
// Enhanced v2: same-row aware + bidirectional spread + minimum gap enforcement
function staggerLeaderYPositions(leaderEntries,minGap){
  if(!leaderEntries.length)return;
  minGap=minGap||18;
  
  // Phase 1: 같은 Y 그룹 감지 → 열 기반 사전 오프셋
  const yGroups={};
  leaderEntries.forEach(le=>{
    const roundedY=Math.round(le.y*10)/10; // 소수점 1자리 반올림
    let matched=false;
    for(const gy of Object.keys(yGroups)){
      if(Math.abs(parseFloat(gy)-roundedY)<minGap*0.8){
        yGroups[gy].push(le);
        matched=true;
        break; // 첫 매칭 그룹에만 추가
      }
    }
    if(!matched)yGroups[roundedY]=[le];
  });
  
  // 같은 Y 그룹 내에서 중앙 기준 양방향 분산
  Object.values(yGroups).forEach(group=>{
    if(group.length<=1)return;
    const centerY=group.reduce((s,le)=>s+le.y,0)/group.length;
    const spread=minGap*1.2; // 각 항목 간 간격
    const totalSpread=(group.length-1)*spread;
    const startY=centerY-totalSpread/2;
    // 참조번호 순서로 정렬 (작은 번호 위)
    group.sort((a,b)=>{
      const na=parseInt(String(a.refNum).replace(/\D/g,''))||0;
      const nb=parseInt(String(b.refNum).replace(/\D/g,''))||0;
      return na-nb;
    });
    group.forEach((le,i)=>{
      le.y=startY+i*spread;
    });
  });
  
  // Phase 2: 전체 정렬 후 최소 간격 강제
  leaderEntries.sort((a,b)=>a.y-b.y);
  for(let i=1;i<leaderEntries.length;i++){
    if(leaderEntries[i].y-leaderEntries[i-1].y<minGap){
      leaderEntries[i].y=leaderEntries[i-1].y+minGap;
    }
  }
}

// Backward-compat: returns {x1,y1,x2,y2} for PPTX/Canvas L-shape routing
function getConnectionPoints(fromBox,toBox){
  const dx=toBox.cx-fromBox.cx, dy=toBox.cy-fromBox.cy;
  // ★ v12 CRITICAL FIX: 하드코딩 <1 → 박스 크기의 5% 상대 임계값 ★
  // 기존: PPTX(inch)에서 0.5인치 거리 노드도 "동일점" 판정 → edge 누락
  const minDim=Math.min(fromBox.w||1,fromBox.h||1,toBox.w||1,toBox.h||1);
  const threshold=Math.max(minDim*0.05, 0.01); // 최소 0.01 (inch/px 모두 안전)
  if(Math.abs(dx)<threshold&&Math.abs(dy)<threshold)return null;
  // ★ v10.2: _shapeAnchor 기반 연결점 (shape 경계 정확 반영) ★
  let fromDir,toDir;
  if(Math.abs(dy)>=Math.abs(dx)){
    fromDir=dy>0?'bottom':'top'; toDir=dy>0?'top':'bottom';
  }else{
    fromDir=dx>0?'right':'left'; toDir=dx>0?'left':'right';
  }
  const fSt=fromBox._shapeType||'box', tSt=toBox._shapeType||'box';
  const fSx=fromBox._sx!=null?fromBox._sx:fromBox.x, fSy=fromBox._sy!=null?fromBox._sy:fromBox.y;
  const fSw=fromBox._sw||fromBox.w, fSh=fromBox._sh||fromBox.h;
  const tSx=toBox._sx!=null?toBox._sx:toBox.x, tSy=toBox._sy!=null?toBox._sy:toBox.y;
  const tSw=toBox._sw||toBox.w, tSh=toBox._sh||toBox.h;
  const fAnc=_shapeAnchor(fSt,fSx,fSy,fSw,fSh,fromDir);
  const tAnc=_shapeAnchor(tSt,tSx,tSy,tSw,tSh,toDir);
  return{x1:fAnc.px,y1:fAnc.py,x2:tAnc.px,y2:tAnc.py};
}

// ═══ v8.0: 객체 기반 충돌 방지 레이아웃 엔진 (공통) ═══
// 모든 렌더러(SVG, Canvas, PPTX)가 공유하는 레이아웃 계산기
function computeFig2Layout(displayNodes, edges, innerGrid, innerMaxCols, innerNumRows, innerUniqueEdges, frameRefNum, opts){
  const{boxBaseW, boxBaseH, colGap, rowGap, framePad, shadowSize, scale}=opts;
  // scale: SVG=72(PX), Canvas=1(px), PPTX=1(inch)

  // ★ v19: 전체 열 영역 너비 사전 계산 — 프레임 너비 통일 기준 ★
  const totalAreaW=innerMaxCols*boxBaseW+(innerMaxCols-1)*colGap;

  // Phase 1: 각 노드를 객체(Rect)로 변환
  const objects=[];
  displayNodes.forEach(nd=>{
    const gp=innerGrid[nd.id];
    if(!gp)return;
    // 행 내 노드 수에 따른 중앙 정렬
    const rowNodeAreaW=gp.layerSize*boxBaseW+(gp.layerSize-1)*colGap;
    const rowOffsetX=(totalAreaW-rowNodeAreaW)/2;
    const localX=rowOffsetX+gp.col*(boxBaseW+colGap);
    const localY=gp.row*(boxBaseH+rowGap);
    const fallbackRef=frameRefNum+10*(parseInt(nd.id.replace(/\D/g,''))||1);
    objects.push({
      id:nd.id, type:'box',
      x:localX, y:localY,
      w:boxBaseW, h:boxBaseH,
      label:nd.label, fallbackRef
    });
  });
  
  // ★ v20: Phase 1.5 — 행별 중앙 정렬 (gp.layerSize 보정) ★
  // computeDeviceLayout2D가 alignCol에서 layerSize를 인접 행 최대치로 설정하므로
  // 노드 수가 적은 행이 좌측에 치우침 → 실제 노드 수 기준으로 재중앙 정렬
  const _rowGroups={};
  objects.forEach(o=>{
    const gp=innerGrid[o.id];
    if(!gp)return;
    if(!_rowGroups[gp.row])_rowGroups[gp.row]=[];
    _rowGroups[gp.row].push(o);
  });
  Object.values(_rowGroups).forEach(rowObjs=>{
    if(rowObjs.length>0&&rowObjs.length<innerMaxCols){
      const minRX=Math.min(...rowObjs.map(o=>o.x));
      const maxRX=Math.max(...rowObjs.map(o=>o.x+o.w));
      const rowW=maxRX-minRX;
      const shift=(totalAreaW-rowW)/2-minRX;
      rowObjs.forEach(o=>{o.x+=shift;});
    }
  });

  // Phase 2: 충돌 감지 & 자동 보정 (최대 20라운드)
  // v9.0: 연결선 라우팅 공간을 확보하기 위해 MIN_SEP 대폭 증가
  // ★ v12 CRITICAL FIX: ROUTE_PAD(15px) → opts.routePad로 좌표계 독립화 ★
  // 기존: PPTX(inch)에서 MIN_SEP=15.16인치 → 객체 15인치씩 밀림 → 슬라이드 이탈
  const _rpad=(opts&&opts.routePad!==undefined)?opts.routePad:ROUTE_PAD;
  const MIN_SEP=Math.max(colGap*0.5, rowGap*0.4, shadowSize*4+_rpad);
  for(let round=0;round<20;round++){
    let anyFixed=false;
    for(let i=0;i<objects.length;i++){
      for(let j=i+1;j<objects.length;j++){
        const a=objects[i], b=objects[j];
        const gapX=(a.x<b.x)?(b.x-(a.x+a.w)):(a.x-(b.x+b.w));
        const gapY=(a.y<b.y)?(b.y-(a.y+a.h)):(a.y-(b.y+b.h));
        // 둘 다 음수면 겹침
        if(gapX<MIN_SEP && gapY<MIN_SEP){
          const pushX=MIN_SEP-gapX;
          const pushY=MIN_SEP-gapY;
          // 더 적은 이동으로 해결되는 방향 선택
          if(pushX<=pushY && pushX>0){
            if(b.x>=a.x){b.x+=pushX;}else{a.x+=pushX;}
            anyFixed=true;
          }else if(pushY>0){
            if(b.y>=a.y){b.y+=pushY;}else{a.y+=pushY;}
            anyFixed=true;
          }
        }
      }
    }
    if(!anyFixed)break;
  }
  
  // Phase 3: 바운딩 박스 계산 (v8.1: 그림자 공간 포함)
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  objects.forEach(o=>{
    minX=Math.min(minX,o.x);
    minY=Math.min(minY,o.y);
    maxX=Math.max(maxX,o.x+o.w+shadowSize+2);
    maxY=Math.max(maxY,o.y+o.h+shadowSize+2);
  });
  if(!objects.length){minX=0;minY=0;maxX=boxBaseW;maxY=boxBaseH;}
  const actualContentW=maxX-minX;
  const contentH=maxY-minY;
  // ★ v19: 프레임 너비를 전체 열 영역 기준으로 통일 — 1열도 3열과 동일 폭 ★
  const minContentW=totalAreaW+shadowSize+2;
  const contentW=Math.max(actualContentW, minContentW);

  // Phase 4: 프레임 좌표 (content + padding)
  const frameW=contentW+framePad*2;
  const frameH=contentH+framePad*2;

  // Phase 5: 객체 좌표를 프레임 내부 좌표로 재배치 (원점 보정 + 중앙 정렬)
  const extraW=contentW-actualContentW;
  const offsetX=framePad-minX+extraW/2;
  const offsetY=framePad-minY;
  objects.forEach(o=>{o.x+=offsetX;o.y+=offsetY;});
  
  // Phase 6: 프레임 경계 침범 최종 검증 (v8.1: 그림자 공간 확보)
  const shadowPad=shadowSize+2;
  objects.forEach(o=>{
    if(o.x<framePad)o.x=framePad;
    if(o.y<framePad)o.y=framePad;
    if(o.x+o.w+shadowPad>frameW-framePad)o.x=frameW-framePad-o.w-shadowPad;
    if(o.y+o.h+shadowPad>frameH-framePad)o.y=frameH-framePad-o.h-shadowPad;
  });
  
  return{objects, frameW, frameH, contentW, contentH};
}

// ═══ S3(skill §8.2): 두 박스가 마주보는 변의 좌표 범위가 겹치면 → 연결선을 겹침밴드 중앙에 직선으로 접속 ═══
// 반환: {axis:'h'|'v', fromDir, toDir, center} (겹침 없거나 대각 배치면 null)
function _facingOverlapBand(fromBox,toBox){
  const fx=fromBox._sx||fromBox.x, fy=fromBox._sy||fromBox.y, fw=fromBox._sw||fromBox.w, fh=fromBox._sh||fromBox.h;
  const tx=toBox._sx||toBox.x, ty=toBox._sy||toBox.y, tw=toBox._sw||toBox.w, th=toBox._sh||toBox.h;
  const yTop=Math.max(fy,ty), yBot=Math.min(fy+fh,ty+th);
  const xLeft=Math.max(fx,tx), xRight=Math.min(fx+fw,tx+tw);
  const yOv=yBot-yTop, xOv=xRight-xLeft;
  if(fx+fw<=tx && yOv>0) return {axis:'h', fromDir:'right', toDir:'left',  center:(yTop+yBot)/2};
  if(tx+tw<=fx && yOv>0) return {axis:'h', fromDir:'left',  toDir:'right', center:(yTop+yBot)/2};
  if(fy+fh<=ty && xOv>0) return {axis:'v', fromDir:'bottom',toDir:'top',   center:(xLeft+xRight)/2};
  if(ty+th<=fy && xOv>0) return {axis:'v', fromDir:'top',   toDir:'bottom',center:(xLeft+xRight)/2};
  return null;
}

// ═══ v10.2: 연결선 끝점을 Shape 곡면 경계에 정확히 스냅 ═══
// getOrthogonalRoute는 직사각형 nodeBox 기반이라 cloud/database/monitor 등
// 곡면 shape에서 연결선이 shape 밖에서 시작/끝하는 문제를 수정
// 핵심: 직교(orthogonal) 속성 유지 + 경계 좌표만 조정
function _snapRouteToShapeAnchors(route,fromBox,toBox,offF,offT,allBoxes,coordTol){
  if(!route||route.length<2)return route;
  const r=[...route.map(p=>({...p}))]; // deep copy
  const _ct=(coordTol!==undefined&&coordTol>0)?coordTol:1; // ★ v12: 좌표계 독립 임계값 (SVG:1=px, PPTX:≈0.005=inch) ★
  
  // ★ v10.4: 각 shape의 정확한 변 중앙에서 연결 (직교 유지) ★
  // 원칙: 화살표는 반드시 구성의 중앙(가로든 세로든)에 접점을 형성
  
  // 1) 시작점(from) exit 방향 결정
  const seg0dx=r[1].x-r[0].x, seg0dy=r[1].y-r[0].y;
  let fromDir;
  if(Math.abs(seg0dy)>Math.abs(seg0dx)){fromDir=seg0dy>0?'bottom':'top';}
  else{fromDir=seg0dx>0?'right':'left';}
  
  // 2) 끝점(to) entry 방향 결정 — ★ 진입 방향은 세그먼트 반대 ★
  const last=r.length-1;
  const segLdx=r[last].x-r[last-1].x, segLdy=r[last].y-r[last-1].y;
  let toDir;
  // 화살표가 오른쪽으로 이동하며 도착 → 왼쪽에서 진입(left)
  // 화살표가 아래로 이동하며 도착 → 위에서 진입(top)
  if(Math.abs(segLdy)>Math.abs(segLdx)){toDir=segLdy>0?'top':'bottom';}
  else{toDir=segLdx>0?'left':'right';}
  
  // 3) 시작점 shape anchor 계산
  const fromST=fromBox._shapeType||'box';
  const fromAnc=_shapeAnchor(fromST,fromBox._sx||fromBox.x,fromBox._sy||fromBox.y,
    fromBox._sw||fromBox.w,fromBox._sh||fromBox.h,fromDir);
  const fromAncX=fromAnc.px, fromAncY=fromAnc.py;
  
  // 4) 끝점 shape anchor 계산
  const toST=toBox._shapeType||'box';
  const toAnc=_shapeAnchor(toST,toBox._sx||toBox.x,toBox._sy||toBox.y,
    toBox._sw||toBox.w,toBox._sh||toBox.h,toDir);
  const toAncX=toAnc.px, toAncY=toAnc.py;

  // ★ S3(skill §8.2): 직사각형 박스끼리 마주보는 변이 겹치면 → 겹침밴드 중앙에 직선으로 접속 ★
  // 조건: (a) 양쪽 다 box 형(곡면 shape 제외) (b) 겹침밴드 존재 (c) 직선이 비퇴화(non-degenerate)
  //       (d) 다른 박스를 관통하지 않음(_segmentIntersectsBox 로 장애물 가드)
  if((fromBox._shapeType||'box')==='box' && (toBox._shapeType||'box')==='box'){
    const _band=_facingOverlapBand(fromBox,toBox);
    if(_band){
      const _fa=_shapeAnchor(fromST,fromBox._sx||fromBox.x,fromBox._sy||fromBox.y,fromBox._sw||fromBox.w,fromBox._sh||fromBox.h,_band.fromDir);
      const _ta=_shapeAnchor(toST,toBox._sx||toBox.x,toBox._sy||toBox.y,toBox._sw||toBox.w,toBox._sh||toBox.h,_band.toDir);
      let sfx=_fa.px, sfy=_fa.py, stx=_ta.px, sty=_ta.py;
      if(_band.axis==='h'){ sfy=_band.center; sty=_band.center; }
      else { sfx=_band.center; stx=_band.center; }
      if(Math.abs(sfx-stx)+Math.abs(sfy-sty) > _ct){
        // ★ 장애물 가드: from/to 박스 자신은 제외(라우팅 박스 좌표 동일성으로 견고하게 식별 — 호출부가 id 없는 raw box 를 넘겨도 안전) ★
        const _isEnd=(b)=>(b===fromBox||b===toBox||(b.x===fromBox.x&&b.y===fromBox.y&&b.w===fromBox.w&&b.h===fromBox.h)||(b.x===toBox.x&&b.y===toBox.y&&b.w===toBox.w&&b.h===toBox.h));
        const _others=(allBoxes||[]).filter(b=>!_isEnd(b));
        if(_others.every(b=>!_segmentIntersectsBox({x:sfx,y:sfy},{x:stx,y:sty},b,_ct))){
          return [{x:sfx,y:sfy},{x:stx,y:sty}];
        }
      }
    }
  }

  // 5) 시작점 스냅
  r[0].x=fromAncX;
  r[0].y=fromAncY;
  
  // 6) 끝점 스냅
  r[r.length-1].x=toAncX;
  r[r.length-1].y=toAncY;
  
  // 7) 직교성 복원 — 중간점들을 조정하여 모든 세그먼트가 수평/수직이 되도록
  if(r.length===2){
    // 직선 경로 — 시작/끝 Y가 다르면 L-shape로 변환
    if(Math.abs(fromAncY-toAncY)>2*_ct){
      if(fromDir==='right'||fromDir==='left'){
        // 수평 출발 → 중간에서 꺾임
        const midX=(fromAncX+toAncX)/2;
        r.splice(1,0,{x:midX,y:fromAncY},{x:midX,y:toAncY});
      }else{
        // 수직 출발 → 중간에서 꺾임
        const midY=(fromAncY+toAncY)/2;
        r.splice(1,0,{x:fromAncX,y:midY},{x:toAncX,y:midY});
      }
    }else if(Math.abs(fromAncX-toAncX)>2*_ct&&(fromDir==='top'||fromDir==='bottom')){
      const midY=(fromAncY+toAncY)/2;
      r.splice(1,0,{x:fromAncX,y:midY},{x:toAncX,y:midY});
    }
  }else if(r.length>=3){
    // 다점 경로 — 첫 번째/마지막 세그먼트만 정렬
    // 첫 번째 세그먼트: r[0] → r[1]
    if(fromDir==='right'||fromDir==='left'){
      r[1].y=fromAncY; // 수평 출발이면 r[1]의 Y를 맞춤
    }else{
      r[1].x=fromAncX; // 수직 출발이면 r[1]의 X를 맞춤
    }
    // 마지막 세그먼트: r[last-1] → r[last]
    const lastIdx=r.length-1;
    if(toDir==='right'||toDir==='left'){
      r[lastIdx-1].y=toAncY;
    }else{
      r[lastIdx-1].x=toAncX;
    }
  }
  
  // 8) ★ v10.4: 경로 단순화 — 불필요한 꺾임 제거 (장애물 인식) ★
  return _simplifyRoute(r, allBoxes||[], fromBox, toBox, _ct);
}

// ★ v10.4: 직교 경로 단순화 — 불필요한 웨이포인트 제거 (장애물 인식) ★
// ★ v12: coordTol 파라미터 추가 — SVG(px)와 PPTX(inch) 좌표계 모두 정확 ★
function _simplifyRoute(route, obstacles, fromBox, toBox, coordTol){
  if(!route||route.length<3)return route;
  let r=[...route.map(p=>({...p}))];
  const _ct=(coordTol!==undefined&&coordTol>0)?coordTol:1; // SVG:1(px), PPTX:≈0.005(inch)
  const excludeIds=new Set();
  if(fromBox&&fromBox.id)excludeIds.add(fromBox.id);
  if(toBox&&toBox.id)excludeIds.add(toBox.id);
  const obs=(obstacles||[]).filter(b=>!excludeIds.has(b.id));
  
  // Pass 1: 동일선상(collinear) 중간점 제거
  // 3개 연속 점이 모두 같은 X 또는 같은 Y이면 중간점 불필요
  let changed=true;
  while(changed){
    changed=false;
    for(let i=1;i<r.length-1;i++){
      const prev=r[i-1], cur=r[i], next=r[i+1];
      const sameX=Math.abs(prev.x-cur.x)<_ct&&Math.abs(cur.x-next.x)<_ct;
      const sameY=Math.abs(prev.y-cur.y)<_ct&&Math.abs(cur.y-next.y)<_ct;
      if(sameX||sameY){
        r.splice(i,1);
        changed=true;
        break;
      }
    }
  }
  
  // Pass 2: 제로 길이 세그먼트 제거 (두 점이 거의 같은 위치)
  changed=true;
  while(changed&&r.length>2){
    changed=false;
    for(let i=0;i<r.length-1;i++){
      if(Math.abs(r[i].x-r[i+1].x)<_ct&&Math.abs(r[i].y-r[i+1].y)<_ct){
        r.splice(i+1,1);
        changed=true;
        break;
      }
    }
  }
  
  // Pass 3: U-turn 제거 — 연속 3개 세그먼트가 같은 축을 따라 왔다가 돌아가면 직선으로 대체
  // 예: →↑→를 →로 단순화 (시작/끝 Y가 같으면)
  if(r.length>=4){
    const simplified=[];
    simplified.push(r[0]);
    for(let i=1;i<r.length-1;i++){
      const prev=simplified[simplified.length-1];
      const cur=r[i];
      const next=r[i+1];
      // prev→cur→next가 되돌아가는 패턴인지 확인
      // 수평으로 가다가 수직으로 가다가 다시 수평: prev.y==cur.y, cur.x==next.x는 정상 L-turn
      // 하지만 prev.y==next.y이고 중간에 불필요한 detour면 건너뜀
      const skipable=
        (Math.abs(prev.y-next.y)<2*_ct&&Math.abs(prev.y-cur.y)<2*_ct) || // 3점 모두 같은 Y → 중간점 불필요 (already handled)
        (Math.abs(prev.x-next.x)<2*_ct&&Math.abs(prev.x-cur.x)<2*_ct);  // 3점 모두 같은 X
      if(!skipable){
        simplified.push(cur);
      }
    }
    simplified.push(r[r.length-1]);
    r=simplified;
  }
  
  // Pass 4: 시작/끝이 직선 가능하고 중간에 장애물이 없는 경우만 직선화
  // ★ 장애물이 직선 경로에 있으면 우회점 보존 ★
  // ★ v12: _ct 적용 + _countRouteCollisions에 pad 전달 ★
  if(r.length>2){
    const first=r[0], last=r[r.length-1];
    const tolerance=8*_ct;
    let canStraighten=false;
    // ★ v12: _ct 기반 pad를 역산하여 충돌 검사에 전달 ★
    const _pad=(_ct<0.1)?(_ct*15):undefined; // PPTX면 인치 pad, SVG면 기본값
    
    if(Math.abs(first.x-last.x)<3*_ct){
      const allNearX=r.slice(1,-1).every(p=>Math.abs(p.x-first.x)<tolerance);
      if(allNearX){
        // 직선 경로가 장애물을 관통하는지 확인
        const straightHits=_countRouteCollisions([first, last], obs, excludeIds, _pad);
        if(straightHits===0) canStraighten=true;
      }
    }else if(Math.abs(first.y-last.y)<3*_ct){
      const allNearY=r.slice(1,-1).every(p=>Math.abs(p.y-first.y)<tolerance);
      if(allNearY){
        const straightHits=_countRouteCollisions([first, last], obs, excludeIds, _pad);
        if(straightHits===0) canStraighten=true;
      }
    }
    
    if(canStraighten) r=[r[0], r[r.length-1]];
  }
  
  return r;
}

function renderDiagramSvg(containerId,nodes,edges,positions,figNum,adjustments,globalMaxInnerCols){
  // ═══ KIPO 특허 도면 규칙 v4.1 (직계 부모 일치) ═══
  // ★ v10.4: adjustments 파라미터 — 포스트 렌더 검증 실패 시 재렌더링용 ★
  // adjustments: {spacingMult:1.0, fontOffset:0, boxWidthMult:1.0, boxHeightMult:1.0}
  const adj=adjustments||{};
  const _sm=adj.spacingMult||1.0;  // 간격 배율 (1.0=기본, 1.2=20% 확대)
  const _fo=adj.fontOffset||0;     // 폰트 크기 오프셋 (-1=1px 축소)
  const _bwm=adj.boxWidthMult||1.0;  // 박스 너비 배율
  const _bhm=adj.boxHeightMult||1.0; // 박스 높이 배율
  
  const PX=72;
  const SHADOW_OFFSET=2.5; // v8.0: 축소 (4→2.5)
  
  // 노드 라벨에서 참조번호 추출 함수
  function extractRefNum(label,fallback){
    const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
    return match?match[1]:fallback;
  }
  
  
  // L1 여부 판별 (X00 형식인지)
  function isL1RefNum(ref){
    if(!ref||String(ref).startsWith('S'))return false;
    const s=String(ref);
    // D접두사: D2→최상위, D21→하위
    if(s.startsWith('D')){const n=parseInt(s.slice(1));return !isNaN(n)&&n<10;}
    const num=parseInt(s);
    if(isNaN(num))return false;
    // 소수(1~9): 최상위
    if(num<10)return true;
    // 2자리(10~99): 하위
    if(num<100)return false;
    // 3자리: L1=X00
    if(num<1000)return num%100===0;
    // 4자리: L4이므로 아님
    return false;
  }
  
  // ★ 직계 부모 찾기 함수 v6.0 (L4 + 소수 지원) ★
  function findImmediateParent(refNums){
    const nums=refNums.filter(r=>r&&!String(r).startsWith('S')).map(r=>{const s=String(r);return s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);}).filter(n=>!isNaN(n)&&n>0);
    if(!nums.length)return null;
    
    const l1s=nums.filter(n=>n>=100&&n<1000&&n%100===0);
    const l2s=nums.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
    const l3s=nums.filter(n=>n>=100&&n<1000&&n%10!==0);
    const l4s=nums.filter(n=>n>=1000&&n<10000);
    const smalls=nums.filter(n=>n<100);
    
    console.log('findImmediateParent v6:', {nums,l1s,l2s,l3s,l4s,smalls});
    
    // ── L4 포함 ──
    if(l4s.length>0){
      if(l3s.length===1&&l2s.length===0&&l1s.length===0){
        const theL3=l3s[0];
        if(l4s.every(n=>Math.floor(n/10)===theL3))return theL3;
      }
      if(l3s.length===0&&l2s.length===0&&l1s.length===0&&smalls.length===0){
        const parents=[...new Set(l4s.map(n=>Math.floor(n/10)))];
        if(parents.length===1)return parents[0];
      }
      return null;
    }
    // ── L1 포함 ──
    if(l1s.length>0){
      if(l1s.length===1&&(l2s.length>0||l3s.length>0)){
        const t=l1s[0];
        if(l2s.every(n=>Math.floor(n/100)*100===t)&&l3s.every(n=>Math.floor(n/100)*100===t))return t;
      }
      return null;
    }
    // ── L2만 ──
    if(l2s.length>0&&l3s.length===0){
      const p=[...new Set(l2s.map(n=>Math.floor(n/100)*100))];
      return p.length===1?p[0]:null;
    }
    // ── L2+L3 ──
    if(l2s.length>0&&l3s.length>0){
      if(l2s.length===1&&l3s.every(n=>Math.floor(n/10)*10===l2s[0]))return l2s[0];
      const p=[...new Set([...l2s,...l3s].map(n=>Math.floor(n/100)*100))];
      return p.length===1?p[0]:null;
    }
    // ── L3만 ──
    if(l3s.length>0){
      const l2p=[...new Set(l3s.map(n=>Math.floor(n/10)*10))];
      if(l2p.length===1)return l2p[0];
      const l1p=[...new Set(l2p.map(p=>Math.floor(p/100)*100))];
      return l1p.length===1?l1p[0]:null;
    }
    // ── 소수 (<100): 데이터/정보 참조번호 ──
    if(smalls.length>0){
      const singles=smalls.filter(n=>n<10);
      const doubles=smalls.filter(n=>n>=10);
      if(singles.length===1&&doubles.length>0){
        if(doubles.every(n=>Math.floor(n/10)===singles[0]))return singles[0];
      }
      if(singles.length===0&&doubles.length>0){
        const p=[...new Set(doubles.map(n=>Math.floor(n/10)))];
        if(p.length===1)return p[0];
      }
    }
    return null;
  }
  
  // 화살표 표시 여부 (edges가 없으면 병렬 배치)
  const hasEdges=edges&&edges.length>0;
  
  // ★ 방법 도면 판별: S접두사 참조번호 또는 "시작"/"종료" 노드 존재 ★
  const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
  const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
    nodes.some(n=>/시작|종료|START|END/i.test(n.label));
  
  if(isMethodDiagram){
    // ═══ 방법 도면: 흐름도 v6.0 (다이아몬드 분기 지원) ═══
    const boxH=0.7*PX*_bhm, boxGap=0.8*PX*_sm, diamondH=1.0*PX*_bhm;
    const normalBoxW=5.0*PX*_bwm;
    const startEndBoxW=2.0*PX*_bwm;
    const diamondW=5.5*PX*_bwm;
    const boxStartY=0.5*PX;
    // 분기 여부 판단
    const hasBranching=edges.some(e=>e.label);
    const branchOffset=hasBranching?2.8*PX*_sm:0;
    const centerX=0.5*PX+normalBoxW/2+branchOffset/2;
    const svgW=normalBoxW+2.5*PX+branchOffset;
    
    // 노드 위치 계산 (토폴로지 기반)
    const nodeMap={};nodes.forEach(n=>nodeMap[n.id]=n);
    const adjList={};edges.forEach(e=>{if(!adjList[e.from])adjList[e.from]=[];adjList[e.from].push(e);});
    // 간단한 순서: nodes 배열 순서 사용 (이미 파싱 순서)
    const nodePositions={};
    let curY=boxStartY;
    nodes.forEach((n,i)=>{
      const isDiamond=n.shape==='diamond';
      const isStartEnd=/시작|종료|START|END/i.test(n.label);
      const h=isDiamond?diamondH:boxH;
      nodePositions[n.id]={x:centerX,y:curY,h,idx:i,isDiamond,isStartEnd};
      curY+=h+boxGap;
    });
    const svgH=curY+0.5*PX;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${hasBranching?650:550}px;background:white;border-radius:8px">`;
    
    const mkId=`ah_${containerId}`;
    svg+=`<defs>
      <marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#000"/>
      </marker>
    </defs>`;
    
    // 노드 렌더링
    nodes.forEach((n,i)=>{
      const pos=nodePositions[n.id];
      const refNum=extractRefNum(n.label,'');
      const displayLabel=n.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').replace(/\?$/, '').trim();
      const isDiamond=n.shape==='diamond';
      const isStartEnd=pos.isStartEnd;
      const SO=3;
      
      if(isDiamond){
        // ★ 다이아몬드(마름모) 렌더링 ★
        const cx=centerX, cy=pos.y+diamondH/2;
        const dw=diamondW/2, dh=diamondH/2;
        // 그림자
        svg+=`<polygon points="${cx+SO},${cy-dh+SO} ${cx+dw+SO},${cy+SO} ${cx+SO},${cy+dh+SO} ${cx-dw+SO},${cy+SO}" fill="#000"/>`;
        // 본체
        svg+=`<polygon points="${cx},${cy-dh} ${cx+dw},${cy} ${cx},${cy+dh} ${cx-dw},${cy}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;
        // 텍스트 (v10.6 FIX: 마름모 가용폭 기반 동적 줄바꿈 — 고정 maxChars 제거)
        const _diamUsableW=diamondW*0.70; // 마름모 중앙부 가용 너비 (~70%)
        const _dtw=_estimateTextWidth(displayLabel,11);
        if(_dtw>_diamUsableW){
          const _dfs=_dtw>_diamUsableW*2?9:11; // 2줄로도 넘치면 폰트 축소
          const mid=Math.ceil(displayLabel.length/2);
          const sp=displayLabel.lastIndexOf(' ',mid);
          const bp=sp>0?sp:mid;
          svg+=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="${_dfs}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(0,bp))}</text>`;
          svg+=`<text x="${cx}" y="${cy+_dfs-1}" text-anchor="middle" font-size="${_dfs}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(bp).trim())}</text>`;
        }else{
          svg+=`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
        }
        // 리더라인 + 부호
        if(refNum){
          const leaderEndX=centerX+normalBoxW/2+0.3*PX+branchOffset/2;
          svg+=`<line x1="${cx+dw}" y1="${cy}" x2="${leaderEndX}" y2="${cy}" stroke="#000" stroke-width="1"/>`;
          svg+=`<text x="${leaderEndX+8}" y="${cy+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        }
      }else{
        // 사각형/스타디움 렌더링 (기존 코드)
        const boxW=isStartEnd?startEndBoxW:normalBoxW;
        const bx=centerX-boxW/2;
        const by=pos.y;
        const rx=isStartEnd?boxH/2:0;
        svg+=`<rect x="${bx+SO}" y="${by+SO}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#000"/>`;
        svg+=`<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#fff" stroke="#000" stroke-width="${isStartEnd?2:1.5}"/>`;
        svg+=`<text x="${centerX}" y="${by+boxH/2+4}" text-anchor="middle" font-size="13" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
        if(refNum&&!isStartEnd){
          const leaderEndX=centerX+normalBoxW/2+0.3*PX+branchOffset/2;
          const leaderY=by+boxH/2;
          svg+=`<line x1="${bx+boxW}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="#000" stroke-width="1"/>`;
          svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        }
      }
    });
    
    // 화살표 렌더링 (에지 기반)
    if(edges.length>0){
      const drawnEdges=new Set();
      edges.forEach(e=>{
        const fp=nodePositions[e.from],tp=nodePositions[e.to];
        if(!fp||!tp)return;
        const key=e.from+'->'+e.to;
        if(drawnEdges.has(key))return;
        drawnEdges.add(key);
        const fromDiamond=nodeMap[e.from]?.shape==='diamond';
        const isNoLabel=e.label&&/^(아니오|아니요|No|N)$/i.test(e.label.trim());
        const isYesLabel=e.label&&/^(예|Yes|Y)$/i.test(e.label.trim());
        
        if(fromDiamond&&isNoLabel){
          // "아니오" 분기: 오른쪽으로 꺾어서 연결
          const fromCy=fp.y+fp.h/2;
          const toCy=tp.y+(tp.isDiamond?tp.h/2:boxH/2);
          const branchX=centerX+normalBoxW/2+0.5*PX;
          // 다이아몬드 우측에서 출발
          svg+=`<line x1="${centerX+diamondW/2}" y1="${fromCy}" x2="${branchX}" y2="${fromCy}" stroke="#000" stroke-width="1"/>`;
          svg+=`<line x1="${branchX}" y1="${fromCy}" x2="${branchX}" y2="${tp.y-2}" stroke="#000" stroke-width="1"/>`;
          svg+=`<line x1="${branchX}" y1="${tp.y-2}" x2="${centerX}" y2="${tp.y-2}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
          // 라벨
          svg+=`<text x="${centerX+diamondW/2+8}" y="${fromCy-5}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
        }else{
          // 직선 연결 (예 분기 또는 일반)
          const sy=fp.y+fp.h+2;
          const ty=tp.y-2;
          svg+=`<line x1="${centerX}" y1="${sy}" x2="${centerX}" y2="${ty}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
          if(e.label&&isYesLabel){
            svg+=`<text x="${centerX+8}" y="${(sy+ty)/2+4}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
          }else if(e.label){
            svg+=`<text x="${centerX+8}" y="${(sy+ty)/2+4}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
          }
        }
      });
    }else{
      // 에지 정보 없으면 순차 연결 (폴백)
      nodes.forEach((n,i)=>{
        if(i<nodes.length-1){
          const fp=nodePositions[n.id],tp=nodePositions[nodes[i+1].id];
          const sy=fp.y+fp.h+2;
          const ty=tp.y-2;
          svg+=`<line x1="${centerX}" y1="${sy}" x2="${centerX}" y2="${ty}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
        }
      });
    }
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
    return;
  }
  
  // 모든 노드가 L1인지 확인 (도 1 판별)
  const allL1=nodes.every(n=>{
    const ref=extractRefNum(n.label,'');
    return isL1RefNum(ref);
  });
  
  // 도 1인 경우 (figNum===1 또는 모든 노드가 L1)
  const isFig1=figNum===1||allL1;
  
  // ★ 최외곽 박스 참조번호 = 직계 부모 ★
  const allRefsForFrame=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
  let frameRefNum=findImmediateParent(allRefsForFrame);
  if(!frameRefNum&&allRefsForFrame.length>0){
    // 폴백 개선: 첫 번째 참조번호의 L1 부모 사용
    const firstRef=parseInt(allRefs[0])||100;
    frameRefNum=Math.floor(firstRef/100)*100;
  }
  if(!frameRefNum)frameRefNum=100; // 최종 폴백
  
  const boxW=5.0*PX, boxH=0.7*PX, boxGap=0.8*PX;
  const boxH2=0.9*PX; // 도 2+ 내부 박스: 2줄(라벨+참조번호) 수용
  
  if(isFig1){
    // ═══ 도 1: 2D 토폴로지 블록도 v10.0 ═══
    // 렌더 순서: ①연결선 → ②Shape(위에 덮음) → ③참조번호(Shape 아래)
    // [C2-4] all-L1 평면 구조 감지
    const _isAllL1Flat=allL1&&nodes.length>0&&nodes.every(n=>!n.isContainer);
    if(_isAllL1Flat)console.log(`[C2-4] Fig ${figNum}: all-L1 평면 구조 (${nodes.length}개 노드)`);
    // [C2-2] container 노드 분리 — 일반 레이아웃에서 제외
    const _fig1Containers=nodes.filter(n=>n.isContainer);
    const _fig1LayoutNodes=_fig1Containers.length>0?nodes.filter(n=>!n.isContainer):nodes;
    const layout=computeDeviceLayout2D(_fig1LayoutNodes,edges,figNum);
    const{grid:_rawGrid,maxCols,numRows,uniqueEdges,biDirPairs}=layout;
    // [C2-5] layers 기반 grid col 재구축 — alignCol 오염 보정
    const _layers=layout.layers;
    const grid={};
    if(_layers&&_layers.length>0){
      _layers.forEach((layer,ri)=>{
        layer.forEach((id,ci)=>{
          if(id===null)return;
          grid[id]={row:ri,col:ci,layerSize:layer.length};
        });
      });
    }else{
      Object.assign(grid,_rawGrid);
    }
    
    // 열 수에 따른 박스 크기 조정
    // ★ v20: 간격 축소 — svgW 감소 → 컨테이너 내 1:1 표시 비율 확보 ★
    const colGap=0.65*PX*_sm;
    const boxW2D=(maxCols<=1?5.0*PX:maxCols===2?3.5*PX:3.0*PX)*_bwm;
    const maxNodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
    const marginX=0.5*PX*_sm;
    const marginY=0.6*PX*_sm;
    const refNumH=30*_sm;
    const rowGapBase=0.7*PX*_sm;

    // [C2-8a-fix] visual bounds 기반 bbox 크기 — shape의 실제 시각 영역 (파형/전파 등 돌출 포함)
    //   기존 metrics.sh는 shape 내부 기본 영역 → sensor/antenna 파형이 bbox 외부로 돌출
    //   _shapeVisualBounds는 실제 렌더되는 전체 영역 반환
    let _maxVisualW=0, _maxVisualH=0;
    _fig1LayoutNodes.forEach(nd=>{
      const st=matchIconShape(nd.label);
      const sm=_shapeMetrics(st,boxW2D,boxH);
      const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);
      const visualW=vb.right-vb.left;
      const visualH=vb.bottom-vb.top;
      if(visualW>_maxVisualW)_maxVisualW=visualW;
      if(visualH>_maxVisualH)_maxVisualH=visualH;
    });
    const _bboxPad=8;
    const _bboxW=Math.round(_maxVisualW+_bboxPad);
    const _bboxH=Math.round(_maxVisualH+_bboxPad);
    // shapeicon 하단 외부 라벨+부호 영역 (박스형은 내부)
    const _bboxExtLabelGap=12;  // bbox 하단 → 라벨 간격
    const _bboxExtRefGap=26;    // bbox 하단 → 부호 간격 (라벨 아래 14)
    const _bboxExtH=_bboxExtRefGap+12; // shapeicon: 외부 라벨+부호 총 높이
    // 박스형 전용: 부호를 상/좌/우 면에 배치할 때 여유 공간
    const _bboxRefMargin=16; // bbox 외곽 → 부호까지 거리

    // ═══ v17: 전역 행 높이 통일 — bbox + 외부 라벨/부호 포함 (shapeicon 기준) ═══
    let globalRowH=_bboxH+_bboxExtH;
    let globalShapeH=_bboxH-_bboxPad;

    // 행별 Y시작 좌표 — 모든 행 동일 높이
    const rowY={};
    let accY=marginY;
    for(let r=0;r<numRows;r++){
      rowY[r]=accY;
      accY+=globalRowH+rowGapBase;
    }
    // [C2-7] bbox + 외부 라벨 하단 기반 viewBox 높이
    let maxNodeBottom=0;
    nodes.forEach(nd=>{
      const gp=grid[nd.id];if(!gp)return;
      const by=rowY[gp.row];
      const bottom=by+_bboxH+_bboxExtH+10;
      if(bottom>maxNodeBottom)maxNodeBottom=bottom;
    });
    const totalH=maxNodeBottom+marginY*0.5;

    const leaderMargin=0.3*PX;
    const svgW=marginX+maxNodeAreaW+leaderMargin;
    const svgH=totalH;
    // ★ v20: maxW=svgW — 인위적 축소 제거, 컨테이너가 자연스럽게 제약 ★
    const maxW=svgW;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // ══════════════════════════════════════════════════════════════
    // ★★★ v10.5: Phase 1~2 전면 재설계 — 균일 box + 실제 앵커 라우팅 ★★★
    // ══════════════════════════════════════════════════════════════
    
    // ── Phase 1: 위치 계산 — [C2-6 bbox] 통일 바운딩박스 시스템 ──
    // 모든 노드: 동일 크기 bbox (_bboxW × _bboxH) 내부에 배치
    // 라우팅(nodeBoxes): bbox 경계 기반 → 동일 cy → 직선 연결
    // 렌더링(nodeData): bbox 상부에 shape, 하부에 label + refnum
    const nodeBoxes={};   // bbox 기반 — 라우팅용
    const nodeData=[];    // shape 기반 — 렌더링용
    // [C2-8a-fix-2] anchor 영역 재계산 헬퍼 — sy 변경 후 _sx/_sy/_sw/_sh 갱신
    const _refreshAnchor=(ndId,shapeType,sx,sy,sw,sh)=>{
      if(_isIconShape(shapeType)){
        const vbAbs=_shapeVisualBounds(shapeType,sx,sy,sw,sh);
        nodeBoxes[ndId]._sx=vbAbs.left;
        nodeBoxes[ndId]._sy=vbAbs.top;
        nodeBoxes[ndId]._sw=vbAbs.right-vbAbs.left;
        nodeBoxes[ndId]._sh=vbAbs.bottom-vbAbs.top;
      } else {
        nodeBoxes[ndId]._sx=sx;
        nodeBoxes[ndId]._sy=sy;
        nodeBoxes[ndId]._sw=sw;
        nodeBoxes[ndId]._sh=sh;
      }
    };
    nodes.forEach(nd=>{
      const gp=grid[nd.id];
      if(!gp)return;
      const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
      const rowStartX=marginX+(maxNodeAreaW-rowW)/2;
      const bx=rowStartX+gp.col*(boxW2D+colGap);
      const by=rowY[gp.row];
      const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
      const displayLabel=_shortenFig1Label(nd.label);

      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,boxW2D,boxH);
      const fontSize=_computeDiagramFontSize(boxW2D,boxH,displayLabel.length);
      const textW=_estimateTextWidth(displayLabel,fontSize);
      const minShapeW=textW+20;
      if(sm.sw<minShapeW){
        sm.sw=Math.min(minShapeW,boxW2D*0.90);
        sm.dx=(boxW2D-sm.sw)/2;
      }
      // [C2-8a-fix] shape visual 중심을 bbox 중앙에 정렬
      //   sensor/antenna 등은 sm 기준점과 visual 중심이 다름 (파형이 한쪽에 치우침)
      //   visual 중심을 bbox 중앙에 맞추면 돌출 방향 없이 균형 배치
      const _bbxCenter=bx+(boxW2D)/2;  // bbox 수평 중심 (x)
      const _byCenter=by+_bboxH/2;     // bbox 수직 중심 (y)
      const _vb=_shapeVisualBounds(shapeType,0,0,sm.sw,sm.sh);
      const _vCx=(_vb.left+_vb.right)/2;  // shape 로컬 좌표 visual 중심 x
      const _vCy=(_vb.top+_vb.bottom)/2;  // shape 로컬 좌표 visual 중심 y
      const cappedSw=sm.sw;
      const cappedSh=sm.sh;
      const sx=_bbxCenter-_vCx;
      const sy=_byCenter-_vCy;

      // [C2-8a-fix-2] 라우팅용 nodeBox — 노드 유형별 anchor 영역 정밀화
      //   박스형: shape 실제 경계(sx,sy,sw,sh)를 anchor로 → 화살표가 박스에 정확히 닿음
      //              + _shapeType=actual → monitor/server 등 정밀 anchor 사용
      //   shapeicon: visual bounds(파형 포함 영역)를 anchor로 → 연결선이 파형과 겹침 없음
      //              + _shapeType='box' → visual rect 변 중앙 anchor (단순/안정)
      //   cx/cy/x/y/w/h(layout용)는 모든 노드 공통 (_bboxH 기준) — 행 정렬 일관성 유지
      const _bbx=bx+(boxW2D-_bboxW)/2;
      const _isIcon=_isIconShape(shapeType);
      let _ax, _ay, _aw, _ah, _anchorType;
      if(_isIcon){
        // shapeicon: visual bounds (파형/전파까지 포함, 하단 라벨 패딩 포함)
        const vbAbs=_shapeVisualBounds(shapeType,sx,sy,cappedSw,cappedSh);
        _ax=vbAbs.left; _ay=vbAbs.top;
        _aw=vbAbs.right-vbAbs.left; _ah=vbAbs.bottom-vbAbs.top;
        _anchorType='box';
      } else {
        // 박스형: shape 실제 경계 + 정밀 anchor
        _ax=sx; _ay=sy; _aw=cappedSw; _ah=cappedSh;
        _anchorType=shapeType;
      }
      nodeBoxes[nd.id]={
        x:_bbx, y:by, w:_bboxW, h:_bboxH,
        cx:bx+boxW2D/2, cy:by+_bboxH/2,
        _shapeType:_anchorType, _sx:_ax, _sy:_ay, _sw:_aw, _sh:_ah,
        _isIcon
      };
      nodeData.push({id:nd.id, sx, sy, sw:cappedSw, sh:cappedSh,
        shapeType, displayLabel, refNum, bx, boxW2D,
        row:gp.row, col:gp.col});
    });
    
    // ── Phase 1.5: 겹침 검증 (bbox 높이 기반) ──
    const REF_PADDING=6;
    const MIN_GAP=12;
    let correctionApplied=true;
    let correctionRounds=0;
    while(correctionApplied&&correctionRounds<10){
      correctionApplied=false;
      correctionRounds++;
      for(let i=0;i<nodeData.length;i++){
        const a=nodeData[i];
        const aBottom=nodeBoxes[a.id].y+_bboxH+_bboxExtH;
        for(let j=0;j<nodeData.length;j++){
          if(i===j)continue;
          const b=nodeData[j];
          if(a.row===b.row)continue;
          const hOverlap=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
          if(hOverlap&&nodeBoxes[b.id].y<aBottom+MIN_GAP&&nodeBoxes[b.id].y>=nodeBoxes[a.id].y){
            const push=aBottom+MIN_GAP-nodeBoxes[b.id].y;
            if(push>0){
              b.sy+=push;
              nodeBoxes[b.id].y+=push;
              nodeBoxes[b.id].cy=nodeBoxes[b.id].y+_bboxH/2;
              _refreshAnchor(b.id,b.shapeType,b.sx,b.sy,b.sw,b.sh);
              correctionApplied=true;
            }
          }
        }
      }
    }
    
    // ── Phase 1.7: 양방향 엣지 동일행 강제 ── ★ FIX-3 ★
    // 양방향으로 연결된 노드 쌍이 다른 행에 있으면 한쪽을 이동하여 같은 행으로 맞춤
    if(biDirPairs&&biDirPairs.length>0){
      biDirPairs.forEach(pair=>{
        const nbA=nodeBoxes[pair.a], nbB=nodeBoxes[pair.b];
        if(!nbA||!nbB)return;
        const ndA=nodeData.find(d=>d.id===pair.a);
        const ndB=nodeData.find(d=>d.id===pair.b);
        if(!ndA||!ndB||ndA.row===ndB.row)return; // 이미 같은 행
        // 연결 수가 적은 쪽을 이동 대상으로 선택
        const degA=uniqueEdges.filter(e=>e.from===pair.a||e.to===pair.a).length;
        const degB=uniqueEdges.filter(e=>e.from===pair.b||e.to===pair.b).length;
        const[mover,target]=degA<=degB?[ndA,ndB]:[ndB,ndA];
        const moverBox=nodeBoxes[mover.id], targetBox=nodeBoxes[target.id];
        // mover를 target의 Y 위치로 이동
        const dy=targetBox.y-moverBox.y;
        moverBox.y+=dy; moverBox.cy+=dy;
        mover.sy+=dy;
        _refreshAnchor(mover.id,mover.shapeType,mover.sx,mover.sy,mover.sw,mover.sh);
        mover.row=target.row;
        console.log(`[FIX-3] 양방향 엣지: ${mover.id}→${target.id} 동일행 강제 (dy=${dy.toFixed(1)})`);
      });
      // 겹침 재검증
      let biOverlapFix=true;
      let biOverlapRounds=0;
      while(biOverlapFix&&biOverlapRounds<5){
        biOverlapFix=false;
        biOverlapRounds++;
        for(let i=0;i<nodeData.length;i++){
          const a=nodeData[i];
          for(let j=i+1;j<nodeData.length;j++){
            const b=nodeData[j];
            const hOverlap=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
            const vOverlap=!(a.sy+a.sh+REF_PADDING+MIN_GAP<b.sy||b.sy+b.sh+REF_PADDING+MIN_GAP<a.sy);
            if(hOverlap&&vOverlap){
              // 수직으로 분리: 위쪽 노드는 유지, 아래쪽을 밀어냄
              const upper=a.sy<=b.sy?a:b;
              const lower=a.sy<=b.sy?b:a;
              const push=upper.sy+upper.sh+REF_PADDING+MIN_GAP-lower.sy;
              if(push>0){
                lower.sy+=push;
                nodeBoxes[lower.id].y+=push;
                nodeBoxes[lower.id].cy=nodeBoxes[lower.id].y+nodeBoxes[lower.id].h/2;
                _refreshAnchor(lower.id,lower.shapeType,lower.sx,lower.sy,lower.sw,lower.sh);
                biOverlapFix=true;
              }
            }
          }
        }
      }
    }

    // ═══ FIX-2: 겹침 보정 후 행 간격 균등화 재적용 (bbox 기반) ═══
    //   [C2-8a-fix] sy는 visual 중심 기준 재계산 (shape마다 visual 중심 오프셋 다름)
    nodeData.forEach(nd=>{
      const expectedY=rowY[nd.row];
      if(Math.abs(nodeBoxes[nd.id].y-expectedY)>2){
        const vb2=_shapeVisualBounds(nd.shapeType,0,0,nd.sw,nd.sh);
        const vCy2=(vb2.top+vb2.bottom)/2;
        nodeBoxes[nd.id].y=expectedY;
        nodeBoxes[nd.id].cy=expectedY+_bboxH/2;
        nd.sy=expectedY+_bboxH/2-vCy2;
        _refreshAnchor(nd.id,nd.shapeType,nd.sx,nd.sy,nd.sw,nd.sh);
      }
    });
    let reEqRounds=0;
    while(reEqRounds<3){
      let hasOverlap=false;
      for(let i=0;i<nodeData.length&&!hasOverlap;i++){
        const a=nodeData[i];
        for(let j=i+1;j<nodeData.length;j++){
          const b=nodeData[j];
          if(a.row===b.row)continue;
          const hOvl=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
          const aBot=nodeBoxes[a.id].y+_bboxH+_bboxExtH+MIN_GAP;
          const bBot=nodeBoxes[b.id].y+_bboxH+_bboxExtH+MIN_GAP;
          if(hOvl&&((nodeBoxes[b.id].y<aBot&&nodeBoxes[b.id].y>=nodeBoxes[a.id].y)||(nodeBoxes[a.id].y<bBot&&nodeBoxes[a.id].y>=nodeBoxes[b.id].y))){
            hasOverlap=true;break;
          }
        }
      }
      if(!hasOverlap)break;
      globalRowH+=20;
      let reAccY=marginY;
      for(let r=0;r<numRows;r++){
        rowY[r]=reAccY;
        reAccY+=globalRowH+rowGapBase;
      }
      nodeData.forEach(nd=>{
        const ey=rowY[nd.row];
        // [C2-8a-fix] visual 중심 기반 sy 재계산
        const vb3=_shapeVisualBounds(nd.shapeType,0,0,nd.sw,nd.sh);
        const vCy3=(vb3.top+vb3.bottom)/2;
        nd.sy=ey+_bboxH/2-vCy3;
        nodeBoxes[nd.id].y=ey;
        nodeBoxes[nd.id].cy=ey+_bboxH/2;
        _refreshAnchor(nd.id,nd.shapeType,nd.sx,nd.sy,nd.sw,nd.sh);
      });
      reEqRounds++;
    }

    // ═══ FIX-3: 최종 bbox + 외부 라벨 기반 정확한 viewBox ═══
    let maxBottom=0;
    nodeData.forEach(nd=>{
      const bottom=nodeBoxes[nd.id].y+_bboxH+_bboxExtH+10;
      if(bottom>maxBottom)maxBottom=bottom;
    });
    const correctedSvgH=Math.max(svgH,maxBottom+marginY);
    svg=svg.replace(/viewBox="0 0 [^"]*"/,`viewBox="0 0 ${svgW} ${correctedSvgH}"`);

    // ── Phase 2: 연결선 — ★ 실제 shape anchor 기반 라우팅 ★ ──
    // 원칙: 모든 연결은 각 shape의 실제 변 중앙(edge center)에서 시작/끝
    // box shape → 균일 높이 → 같은 행 = 같은 cy → 자연스러운 직선 연결
    const svgEdgesToDraw=(uniqueEdges.length>0?uniqueEdges:
      (nodes.length>1?nodes.slice(0,-1).map((nd,i)=>({from:nd.id,to:nodes[i+1].id})):[]))
      .filter(e=>e.from!==e.to); // ★ P2-FIX: self-loop 제거 ★

    // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (SVG Fig1) ★
    const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
    // ★ v10.6 FIX: 허브 노드 다중 엣지 앵커 offset (같은 면 출구 분산) ★
    const _exitCounts={};
    svgEdgesToDraw.forEach(e=>{
      const _fb=nodeBoxes[e.from],_tb=nodeBoxes[e.to];
      if(!_fb||!_tb)return;
      const _dx=_tb.cx-_fb.cx,_dy=_tb.cy-_fb.cy;
      const _isH=Math.abs(_dx)>=Math.abs(_dy);
      const _fDir=_isH?(_dx>0?'R':'L'):(_dy>0?'B':'T');
      const _tDir=_isH?(_dx>0?'L':'R'):(_dy>0?'T':'B');
      const _fk=e.from+'_'+_fDir,_tk=e.to+'_'+_tDir;
      if(!_exitCounts[_fk])_exitCounts[_fk]={total:0,idx:0};
      if(!_exitCounts[_tk])_exitCounts[_tk]={total:0,idx:0};
      _exitCounts[_fk].total++;
      _exitCounts[_tk].total++;
    });
    svgEdgesToDraw.forEach(e=>{
      const fb=nodeBoxes[e.from], tb=nodeBoxes[e.to];
      if(!fb||!tb)return;
      
      // 두 shape의 상대 위치로 연결 방향 결정
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      const isHorizontal=Math.abs(dx)>=Math.abs(dy);
      
      let route;
      
      if(isHorizontal){
        // 수평 연결: from의 right/left → to의 left/right
        const goRight=dx>0;
        const _hfk=e.from+'_'+(goRight?'R':'L');
        const _htk=e.to+'_'+(goRight?'L':'R');
        const _hfOff=_exitCounts[_hfk]&&_exitCounts[_hfk].total>1?(_exitCounts[_hfk].idx++-(_exitCounts[_hfk].total-1)/2)*8:0;
        const _htOff=_exitCounts[_htk]&&_exitCounts[_htk].total>1?(_exitCounts[_htk].idx++-(_exitCounts[_htk].total-1)/2)*8:0;
        const fromAnc={
          x: goRight ? fb.x+fb.w : fb.x,
          y: fb.cy+_hfOff
        };
        const toAnc={
          x: goRight ? tb.x : tb.x+tb.w,
          y: tb.cy+_htOff
        };
        
        if(Math.abs(fromAnc.y-toAnc.y)<3){
          // 같은 Y → 완벽한 수평 직선
          route=[fromAnc, toAnc];
        }else{
          // Y 다름 → L-shape 라우팅
          const midX=(fromAnc.x+toAnc.x)/2;
          route=[fromAnc, {x:midX, y:fromAnc.y}, {x:midX, y:toAnc.y}, toAnc];
        }
      }else{
        // 수직 연결: from의 bottom/top → to의 top/bottom
        const goDown=dy>0;
        const _vfk=e.from+'_'+(goDown?'B':'T');
        const _vtk=e.to+'_'+(goDown?'T':'B');
        const _vfOff=_exitCounts[_vfk]&&_exitCounts[_vfk].total>1?(_exitCounts[_vfk].idx++-(_exitCounts[_vfk].total-1)/2)*8:0;
        const _vtOff=_exitCounts[_vtk]&&_exitCounts[_vtk].total>1?(_exitCounts[_vtk].idx++-(_exitCounts[_vtk].total-1)/2)*8:0;
        const fromAnc={
          x: fb.cx+_vfOff,
          y: goDown ? fb.y+fb.h : fb.y
        };
        const toAnc={
          x: tb.cx+_vtOff,
          y: goDown ? tb.y : tb.y+tb.h
        };
        
        if(Math.abs(fromAnc.x-toAnc.x)<3){
          // 같은 X → 완벽한 수직 직선
          route=[fromAnc, toAnc];
        }else{
          // X 다름 → L-shape 라우팅
          const midY=(fromAnc.y+toAnc.y)/2;
          route=[fromAnc, {x:fromAnc.x, y:midY}, {x:toAnc.x, y:midY}, toAnc];
        }
      }
      
      // ★ 충돌 검사: route가 다른 shape을 관통하면 우회 ★
      const excludeIds=new Set([e.from, e.to]);
      const collisions=_countRouteCollisions(route, allBoxArr, excludeIds);

      if(collisions>0){
        const fbA={...fb, id:e.from};
        const tbA={...tb, id:e.to};
        const altRoute=getOrthogonalRoute(fbA, tbA, allBoxArr);
        if(altRoute){
          const snapped=_snapRouteToShapeAnchors(altRoute, fb, tb, 0, 0, allBoxArr);
          if(_countRouteCollisions(snapped, allBoxArr, excludeIds)===0){
            route=snapped;
          }else{
            // ★ v18: 직교 라우터도 관통 → 외곽 우회 ★
            const allLeft=Math.min(...allBoxArr.map(b=>b.x))-25;
            const allRight=Math.max(...allBoxArr.map(b=>b.x+b.w))+25;
            const fromAnc2=route[0], toAnc2=route[route.length-1];
            const detourX=Math.abs(fromAnc2.x-allLeft)<Math.abs(fromAnc2.x-allRight)?allLeft:allRight;
            const extRoute=[
              fromAnc2,
              {x:fromAnc2.x,y:fromAnc2.y+10},
              {x:detourX,y:fromAnc2.y+10},
              {x:detourX,y:toAnc2.y-10},
              {x:toAnc2.x,y:toAnc2.y-10},
              toAnc2
            ];
            if(_countRouteCollisions(extRoute,allBoxArr,excludeIds)<_countRouteCollisions(snapped,allBoxArr,excludeIds)){
              route=extRoute;
            }else{
              route=snapped;
            }
          }
        }
      }else{
        // ★ v20: 충돌 없어도 shape 앵커에 스냅 — 라우팅 박스가 아닌 실제 shape 경계에 연결 ★
        route=_snapRouteToShapeAnchors(route, fb, tb, 0, 0, allBoxArr);
      }
      
      if(route)svg+=svgOrthogonalEdge(route,mkId,!!e._wasBidirectional);
    });
    // ── Phase 3: Shape + 지능형 참조번호 배치 (연결 방향 회피) ──
    // 3a. 각 노드의 연결 방향 분석
    const nodeConnDir={};
    nodeData.forEach(nd=>{nodeConnDir[nd.id]={top:false,bottom:false,left:false,right:false};});
    svgEdgesToDraw.forEach(e=>{
      const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];
      if(!fb||!tb)return;
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      if(Math.abs(dy)>=Math.abs(dx)){
        // 수직 연결
        if(dy>0){nodeConnDir[e.from].bottom=true;nodeConnDir[e.to].top=true;}
        else{nodeConnDir[e.from].top=true;nodeConnDir[e.to].bottom=true;}
      }else{
        // 수평 연결
        if(dx>0){nodeConnDir[e.from].right=true;nodeConnDir[e.to].left=true;}
        else{nodeConnDir[e.from].left=true;nodeConnDir[e.to].right=true;}
      }
    });
    
    // 3b. Shape 렌더 + 참조번호를 연결 없는 쪽에 배치
    // ★ v10.4: 도면 내 균일 폰트 크기 — 전체 shape 중 최소 높이 기준 ★
    const baseFontSize=Math.max(7,(maxCols>2?10:maxCols>1?11:12)+_fo);
    // 비-아이콘 shape 중 최소 높이를 기준으로 폰트 크기 결정
    const nonIconHeights=nodeData.filter(nd=>!_isIconShape(nd.shapeType)).map(nd=>nd.sh);
    const minShapeH=nonIconHeights.length>0?Math.min(...nonIconHeights):boxH;
    const uniformHeightFont=Math.floor(minShapeH*0.22);
    const figFontSize=Math.max(baseFontSize, Math.min(uniformHeightFont, 14)); // 14px cap — 도면 내 통일

    // [C2-8a] 노드 유형별 렌더 — 박스형(명칭 내부+부호 empty side) / shapeicon(명칭+부호 하단 외부)
    nodeData.forEach(nd=>{
      const{id,sx,sy,sw,sh,shapeType,displayLabel,refNum}=nd;
      const _bx=nodeBoxes[id].x; // bbox 좌측 x
      const _by=nodeBoxes[id].y; // bbox 상단 y
      const _bcx=_bx+_bboxW/2;   // bbox 중앙 x
      const _bcy=_by+_bboxH/2;   // bbox 중앙 y
      const isIcon=_isIconShape(shapeType);

      // shape 렌더 (박스형/shapeicon 공통)
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sw,sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sw,sh,2);
      const fontSize=figFontSize;

      if(isIcon){
        // [C2-8a] shapeicon: 명칭 bbox 외부 하단, 부호 명칭 바로 아래 (연속 배치)
        const labelMaxW=_bboxW*0.95;
        const _labelY=_by+_bboxH+_bboxExtLabelGap;
        const {svg:lSvg}=_svgMultiLineLabel(_bcx, _labelY, displayLabel, labelMaxW, fontSize, {minFontSize:7});
        svg+=lSvg;
        const _refY=_by+_bboxH+_bboxExtRefGap;
        svg+=`<text x="${_bcx}" y="${_refY}" text-anchor="middle" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      } else {
        // [C2-8a] 박스형: 명칭 shape 내부 중앙, 부호 연결선 없는 면
        const labelMaxW=sw*0.85;
        const _textCy=_shapeTextCy(shapeType,sy,sh);
        const {svg:lSvg}=_svgMultiLineLabel(sx+sw/2, _textCy, displayLabel, labelMaxW, fontSize, {minFontSize:7});
        svg+=lSvg;

        // [C2-8a] 부호 위치 — 연결선 없는 면
        const emptySide=_findEmptySide(id, svgEdgesToDraw, grid);
        let refX, refY, refAnchor='middle';
        switch(emptySide){
          case 'top':    refX=_bcx;             refY=_by-_bboxRefMargin/2-4;  refAnchor='middle'; break;
          case 'bottom': refX=_bcx;             refY=_by+_bboxH+_bboxRefMargin; refAnchor='middle'; break;
          case 'left':   refX=_bx-4;            refY=_bcy+4;                  refAnchor='end'; break;
          case 'right':  refX=_bx+_bboxW+4;     refY=_bcy+4;                  refAnchor='start'; break;
          default:       refX=_bcx;             refY=_by+_bboxH+_bboxRefMargin; refAnchor='middle';
        }
        svg+=`<text x="${refX}" y="${refY}" text-anchor="${refAnchor}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }
    });

    // [C2-4] all-L1 렌더 검증 — grid 누락 노드 강제 복구
    if(_isAllL1Flat&&nodeData.length<_fig1LayoutNodes.length){
      console.warn(`[C2-4] 렌더 누락 감지: ${nodeData.length}/${_fig1LayoutNodes.length}개 렌더됨 — 누락 노드 복구`);
      let _recovY=marginY;
      if(nodeData.length>0)_recovY=Math.max(...nodeData.map(nd=>nd.sy+nd.sh))+rowGapBase+refNumH;
      let _recovIdx=0;
      _fig1LayoutNodes.forEach(nd=>{
        if(nodeBoxes[nd.id])return;
        const rx=marginX+_recovIdx*(boxW2D+colGap);
        const ry=_recovY;
        const refNum=extractRefNum(nd.label,'');
        const displayLabel=_shortenFig1Label(nd.label);
        svg+=_drawShapeShadow('box',rx+SHADOW_OFFSET,ry+SHADOW_OFFSET,boxW2D,boxH,1);
        svg+=_drawShapeBody('box',rx,ry,boxW2D,boxH,2);
        const{svg:lSvg}=_svgMultiLineLabel(rx+boxW2D/2,ry+boxH/2,displayLabel,boxW2D*0.9,11,{minFontSize:7});
        svg+=lSvg;
        if(refNum)svg+=`<text x="${rx+boxW2D/2}" y="${ry+boxH+16}" text-anchor="middle" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        nodeBoxes[nd.id]={x:rx,y:ry,w:_bboxW,h:_bboxH,cx:rx+boxW2D/2,cy:ry+_bboxH/2,_sx:rx,_sy:ry,_sw:Math.min(boxW2D,_bboxW),_sh:Math.min(boxH,_bboxH-8),_shapeType:'box'};
        _recovIdx++;
      });
      // [C2-4] viewBox 재확장 — 복구 노드 포함
      let _recovMaxBottom=0;
      Object.values(nodeBoxes).forEach(b=>{
        const bot=(b._sy||b.y)+(b._sh||b.h)+_bboxExtH+10;
        if(bot>_recovMaxBottom)_recovMaxBottom=bot;
      });
      const _recovSvgH=Math.max(correctedSvgH,_recovMaxBottom+marginY);
      if(_recovSvgH>correctedSvgH){
        svg=svg.replace(/viewBox="0 0 [^"]*"/,`viewBox="0 0 ${svgW} ${_recovSvgH}"`);
      }
    }

    // [C2-2] container 프레임 렌더 — 일반 노드 위에 점선 프레임 오버레이
    _fig1Containers.forEach(cn=>{
      const cRef=parseInt((extractRefNum(cn.label,'')||'').replace(/\D/g,''));
      const childBoxArr=Object.entries(nodeBoxes).filter(([id])=>{
        if(isNaN(cRef))return true;
        const nd=_fig1LayoutNodes.find(n=>n.id===id);
        if(!nd)return false;
        const nRef=parseInt((extractRefNum(nd.label,'')||'').replace(/\D/g,''));
        return !isNaN(nRef)&&Math.floor(nRef/100)===Math.floor(cRef/100);
      }).map(([,b])=>b);
      if(childBoxArr.length===0)return;
      let cMinX=Infinity,cMinY=Infinity,cMaxX=-Infinity,cMaxY=-Infinity;
      childBoxArr.forEach(b=>{
        cMinX=Math.min(cMinX,b._sx);cMinY=Math.min(cMinY,b._sy);
        cMaxX=Math.max(cMaxX,b._sx+b._sw);cMaxY=Math.max(cMaxY,b._sy+b._sh+30);
      });
      const cPad=10,cLblH=16;
      const cfx=cMinX-cPad,cfy=cMinY-cPad-cLblH;
      const cfw=(cMaxX-cMinX)+cPad*2,cfh=(cMaxY-cMinY)+cPad*2+cLblH;
      svg+=`<rect x="${cfx}" y="${cfy}" width="${cfw}" height="${cfh}" fill="none" stroke="#666" stroke-width="1.5" stroke-dasharray="6,3" rx="4"/>`;
      const cLabel=_safeCleanLabel(cn.label);
      svg+=`<text x="${cfx+6}" y="${cfy+12}" font-size="10" font-weight="bold" font-family="맑은 고딕,Arial,sans-serif" fill="#555">${App.escapeHtml(cLabel)}</text>`;
    });

    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  } else {
    // ═══ 도 2+: 객체 기반 충돌 방지 레이아웃 v8.0 ═══
    
    // ★ 프레임 자신 + 다른 L1 노드 모두 제외 (L1끼리 프레임 안에 포함 방지) ★
    const innerNodes=nodes.filter(n=>{
      const ref=extractRefNum(n.label,'');
      if(!ref)return true;
      const refNum=parseInt(ref);
      if(refNum===frameRefNum)return false; // 프레임 자신
      if(isL1RefNum(ref))return false; // 다른 L1 노드 (200, 300 등)
      return true;
    });
    const frameNode=nodes.find(n=>{
      const ref=extractRefNum(n.label,'');
      return ref&&parseInt(ref)===frameRefNum;
    });
    const frameLabel=frameNode?frameNode.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim():'';
    
    // ★ v10.4: L2/L3 계층 감지 — L2 부모를 서브 프레임으로 변환 ★
    // L2 부모 노드가 L3 자식을 가지면, L2는 표시 노드에서 제거하고 서브 프레임으로 렌더링
    const l2Parents={}; // {l2RefNum: {node, children:[L3 nodes]}}
    innerNodes.forEach(n=>{
      const ref=extractRefNum(n.label,'');
      if(!ref)return;
      const num=parseInt(ref);
      if(isNaN(num))return;
      // L2 판별: x10 단위 (110, 120 등)
      if(num>=100&&num<1000&&num%10===0&&num%100!==0){
        if(!l2Parents[num])l2Parents[num]={node:n, children:[]};
        else l2Parents[num].node=n;
      }
      // L3 판별: x1 단위 (111, 112 등) → 부모 L2 계산
      if(num>=100&&num<1000&&num%10!==0){
        const parentL2=Math.floor(num/10)*10;
        if(!l2Parents[parentL2])l2Parents[parentL2]={node:null, children:[]};
        l2Parents[parentL2].children.push(n);
      }
    });
    
    // L3 자식이 있는 L2 부모는 서브 프레임으로 전환 (표시 노드에서 제거)
    const l2SubFrames={}; // L2 부모 중 자식이 있는 것만
    const l2ParentIdsToRemove=new Set();
    Object.entries(l2Parents).forEach(([ref,info])=>{
      if(info.node&&info.children.length>0){
        l2SubFrames[ref]=info;
        l2ParentIdsToRemove.add(info.node.id);
      }
    });
    
    // L2 부모를 제거한 표시 노드 목록
    const displayNodesFiltered=innerNodes.filter(n=>!l2ParentIdsToRemove.has(n.id));
    const displayNodes=displayNodesFiltered.length>0?displayNodesFiltered:(innerNodes.length>0?innerNodes:nodes);
    
    // 내부 노드 2D 레이아웃 계산
    const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
    const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;

    // ═══ v19: 전체 도면 세트 기준 블록 크기 통일 (정규화) ═══
    const _effectiveCols=Math.max(innerMaxCols, globalMaxInnerCols||innerMaxCols);
    const _rawInnerBoxW=(_effectiveCols===2?3.2:2.4)*PX*_bwm;
    const innerBoxW=Math.min(_rawInnerBoxW, 3.5*PX*_bwm);
    console.log(`[v19] 도 ${figNum}: effCols=${_effectiveCols} inner=${innerMaxCols} global=${globalMaxInnerCols} boxW=${innerBoxW.toFixed(0)}`);
    const boxH2=(_effectiveCols===2?0.95:1.05)*PX*_bhm;
    // ★ v20: 간격 축소 — svgW 감소 → 도면 간 표시 크기 통일 ★
    const _fig2ColGap=0.8*PX*_sm;
    const _fig2RowGap=1.0*PX*_sm;
    const _fig2FramePad=0.7*PX*_sm;
    const fig2Layout=computeFig2Layout(displayNodes,edges,innerGrid,_effectiveCols,innerNumRows,innerUniqueEdges,frameRefNum,{
      boxBaseW:innerBoxW, boxBaseH:boxH2,
      colGap:_fig2ColGap,
      rowGap:_fig2RowGap,
      framePad:_fig2FramePad,
      shadowSize:SHADOW_OFFSET,
      scale:PX
    });

    const frameX=0.5*PX, frameY=0.5*PX;
    const frameW=fig2Layout.frameW;
    const frameH=fig2Layout.frameH;
    const leaderMargin=0.6*PX;
    const svgW=frameX+frameW+leaderMargin;
    const svgH=frameY+frameH+0.5*PX;
    // ★ v20: maxW=svgW — 인위적 축소 제거, 도면 간 블록 크기 통일 ★
    const maxW=svgW;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // 1. 최외곽 프레임 (그림자 + 본체)
    svg+=`<rect x="${frameX+SHADOW_OFFSET}" y="${frameY+SHADOW_OFFSET}" width="${frameW}" height="${frameH}" fill="#000" opacity="0.15"/>`;
    svg+=`<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#fff" stroke="#000" stroke-width="2.25"/>`;
    
    // 2. 내부 노드 렌더링 — 레이아웃 엔진에서 계산된 좌표 사용
    // ★ v10.4: 도면 내 균일 폰트 크기 — 전체 shape 중 최소 높이 기준 ★
    const fig2BaseFontSize=Math.max(7,(_effectiveCols>2?9:_effectiveCols>1?10:11)+_fo);
    const fig2ShapeHeights=fig2Layout.objects.map(obj=>{
      const nd=displayNodes.find(n=>n.id===obj.id);
      if(!nd)return obj.h;
      const st=matchIconShape(nd.label);
      const sm=_shapeMetrics(st,obj.w,obj.h);
      return sm.sh;
    });
    const fig2MinH=fig2ShapeHeights.length>0?Math.min(...fig2ShapeHeights):boxH2;
    const fig2HeightFont=Math.floor(fig2MinH*0.22);
    const fig2FontSize=Math.max(fig2BaseFontSize, Math.min(fig2HeightFont, 13)); // 13px cap — 도 2+ 통일
    
    const innerNodeBoxes={};
    fig2Layout.objects.forEach(obj=>{
      const bx=frameX+obj.x;
      const by=frameY+obj.y;
      const nd=displayNodes.find(n=>n.id===obj.id);
      if(!nd)return;
      const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,obj.w,obj.h);
      // v10.3: 텍스트 너비 기반 최소 shape 너비 (도 2+ SVG)
      const cleanLabel=_safeCleanLabel(nd.label);
      // ★ v10.4: 잘림("…") 완전 제거 — 전체 라벨 표시 ★
      const displayLabel=cleanLabel;
      const fontSize2=_effectiveCols>2?9:_effectiveCols>1?10:11;
      const textW2=_estimateTextWidth(displayLabel,fontSize2);
      const minSw2=textW2+16;
      if(sm.sw<minSw2&&shapeType!=='box'){
        sm.sw=Math.min(minSw2,obj.w*0.90);
        sm.dx=(obj.w-sm.sw)/2;
      }
      const sx=bx+(obj.w-sm.sw)/2, sy=by;
      
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sm.sw,sm.sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sm.sw,sm.sh,1.5);
      const textCy=_shapeTextCy(shapeType,sy,sm.sh);
      const fontSize2Final=fig2FontSize; // ★ v10.4: 도면 내 균일 폰트 ★
      
      // 박스 내부 2줄: 라벨 + (참조번호) — v10.4: 멀티라인 지원 + 비례 폰트
      const labelMaxW=sm.sw*0.90;
      const labelFit=_fitLabelLines(displayLabel,labelMaxW,fontSize2Final,7);
      const labelYOffset=labelFit.lines.length>1?-4:0;
      const {svg:lSvg}=_svgMultiLineLabel(
        sx+sm.sw/2, textCy+labelYOffset-2, displayLabel, labelMaxW, fontSize2Final, {minFontSize:7}
      );
      svg+=lSvg;
      const refFontSize=Math.max(fontSize2Final-1,8);
      const refY=labelFit.lines.length>1?textCy+labelFit.fontSize+6:textCy+fontSize2Final+2;
      svg+=`<text x="${sx+sm.sw/2}" y="${refY}" text-anchor="middle" font-size="${refFontSize}" font-family="맑은 고딕,Arial,sans-serif" fill="#444">(${refNum})</text>`;
      
      innerNodeBoxes[nd.id]={x:sx,y:sy,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:sy+sm.sh/2,
        _shapeType:shapeType,_sx:sx,_sy:sy,_sw:sm.sw,_sh:sm.sh};
    });
    
    // ★ v10.4: L2 서브 프레임 렌더링 — L2 부모의 L3 자식들을 시각적으로 그룹화 ★
    Object.entries(l2SubFrames).forEach(([l2Ref,info])=>{
      if(!info.node||info.children.length===0)return;
      // L3 자식 노드들의 경계 계산
      const childBoxes=info.children.map(c=>{
        const box=innerNodeBoxes[c.id];
        return box;
      }).filter(Boolean);
      if(childBoxes.length===0)return;
      
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      childBoxes.forEach(b=>{
        minX=Math.min(minX, b.x);
        minY=Math.min(minY, b.y);
        maxX=Math.max(maxX, b.x+b.w);
        maxY=Math.max(maxY, b.y+b.h);
      });
      
      // 패딩 추가
      const sfPad=12;
      let sfX=minX-sfPad;
      let sfY=minY-sfPad-16; // 상단에 라벨 공간
      let sfW=(maxX-minX)+sfPad*2;
      let sfH=(maxY-minY)+sfPad*2+16;

      // ★ v20: 서브 프레임이 외곽 프레임과 겹치지 않도록 최소 간격 확보 ★
      const sfMinGap=6;
      const sfFrameL=frameX+sfMinGap, sfFrameT=frameY+sfMinGap;
      const sfFrameR=frameX+frameW-sfMinGap, sfFrameB=frameY+frameH-sfMinGap;
      if(sfX<sfFrameL){sfW-=(sfFrameL-sfX);sfX=sfFrameL;}
      if(sfY<sfFrameT){sfH-=(sfFrameT-sfY);sfY=sfFrameT;}
      if(sfX+sfW>sfFrameR){sfW=sfFrameR-sfX;}
      if(sfY+sfH>sfFrameB){sfH=sfFrameB-sfY;}

      // 서브 프레임 그리기 (점선)
      svg+=`<rect x="${sfX}" y="${sfY}" width="${sfW}" height="${sfH}" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="6,3" rx="3"/>`;
      
      // L2 부모 라벨 + 참조번호
      const l2Label=_safeCleanLabel(info.node.label);
      svg+=`<text x="${sfX+6}" y="${sfY+11}" font-size="9" font-family="맑은 고딕,Arial,sans-serif" fill="#666">${App.escapeHtml(l2Label)} (${l2Ref})</text>`;
    });
    
    // 3. 프레임 참조번호 외부 리더라인
    const frameLeaderEndX=frameX+frameW+0.3*PX;
    const frameLeaderY=frameY+frameH/2;
    svg+=`<line x1="${frameX+frameW}" y1="${frameLeaderY}" x2="${frameLeaderEndX}" y2="${frameLeaderY}" stroke="#000" stroke-width="1"/>`;
    svg+=`<text x="${frameLeaderEndX+8}" y="${frameLeaderY+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${frameRefNum}</text>`;
    
    // 4. ★★ v10.5: 실제 앵커 기반 연결선 + 충돌 검사 (Fig 2+) ★★
    const innerEdgesToDraw2=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
    
    // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (PPTX A6과 동일 수정) ★
    const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
    innerEdgesToDraw2.forEach(e=>{
      const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
      if(!fb||!tb)return;
      
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      const isH=Math.abs(dx)>=Math.abs(dy);
      
      let route;
      if(isH){
        const goR=dx>0;
        const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
        const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
        if(Math.abs(fromAnc.y-toAnc.y)<3){
          route=[fromAnc, toAnc];
        }else{
          const midX=(fromAnc.x+toAnc.x)/2;
          route=[fromAnc, {x:midX,y:fromAnc.y}, {x:midX,y:toAnc.y}, toAnc];
        }
      }else{
        const goD=dy>0;
        const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
        const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
        if(Math.abs(fromAnc.x-toAnc.x)<3){
          route=[fromAnc, toAnc];
        }else{
          const midY=(fromAnc.y+toAnc.y)/2;
          route=[fromAnc, {x:fromAnc.x,y:midY}, {x:toAnc.x,y:midY}, toAnc];
        }
      }
      
      // ★ 충돌 검사: 다른 shape을 관통하면 우회 ★
      // ★ v13.0: allBoxArr는 루프 밖에서 1회 생성 ★
      const excludeIds=new Set([e.from, e.to]);
      if(_countRouteCollisions(route, allBoxArr, excludeIds)>0){
        // 관통 시 직교 라우터로 폴백
        const fbA={...fb, id:e.from};
        const tbA={...tb, id:e.to};
        const altRoute=getOrthogonalRoute(fbA, tbA, allBoxArr);
        if(altRoute){
          route=_snapRouteToShapeAnchors(altRoute, fb, tb, 0, 0, allBoxArr);
          // 2차 충돌 검사 — 직교 라우터도 관통하면 직접 우회 경로 생성
          if(_countRouteCollisions(route, allBoxArr, excludeIds)>0){
            // 장애물을 돌아가는 경로 강제 생성
            const fromAnc2=isH?{x:dx>0?fb.x+fb.w:fb.x, y:fb.cy}:{x:fb.cx, y:dy>0?fb.y+fb.h:fb.y};
            const toAnc2=isH?{x:dx>0?tb.x:tb.x+tb.w, y:tb.cy}:{x:tb.cx, y:dy>0?tb.y:tb.y+tb.h};
            // 장애물 위/아래로 우회
            let bestDetour=null, bestHits=Infinity;
            const obstacles=allBoxArr.filter(b=>!excludeIds.has(b.id));
            for(const obs of obstacles){
              // 위 우회
              const topY=obs.y-12;
              const detourTop=[fromAnc2,{x:fromAnc2.x,y:topY},{x:toAnc2.x,y:topY},toAnc2];
              const hitsTop=_countRouteCollisions(detourTop,allBoxArr,excludeIds);
              if(hitsTop<bestHits){bestHits=hitsTop;bestDetour=detourTop;}
              // 아래 우회
              const botY=obs.y+obs.h+12;
              const detourBot=[fromAnc2,{x:fromAnc2.x,y:botY},{x:toAnc2.x,y:botY},toAnc2];
              const hitsBot=_countRouteCollisions(detourBot,allBoxArr,excludeIds);
              if(hitsBot<bestHits){bestHits=hitsBot;bestDetour=detourBot;}
              // 왼쪽 우회
              const leftX=obs.x-12;
              const detourL=[fromAnc2,{x:leftX,y:fromAnc2.y},{x:leftX,y:toAnc2.y},toAnc2];
              const hitsL=_countRouteCollisions(detourL,allBoxArr,excludeIds);
              if(hitsL<bestHits){bestHits=hitsL;bestDetour=detourL;}
              // 오른쪽 우회
              const rightX=obs.x+obs.w+12;
              const detourR=[fromAnc2,{x:rightX,y:fromAnc2.y},{x:rightX,y:toAnc2.y},toAnc2];
              const hitsR=_countRouteCollisions(detourR,allBoxArr,excludeIds);
              if(hitsR<bestHits){bestHits=hitsR;bestDetour=detourR;}
            }
            if(bestDetour){
              route=bestDetour;
              // ★ v18: 3차 — 개별 장애물 우회도 관통하면 전체 외곽 우회 ★
              if(bestHits>0){
                const allLeft=Math.min(...allBoxArr.map(b=>b.x))-25;
                const allRight=Math.max(...allBoxArr.map(b=>b.x+b.w))+25;
                const detourX=Math.abs(fromAnc2.x-allLeft)<Math.abs(fromAnc2.x-allRight)?allLeft:allRight;
                const extRoute=[
                  fromAnc2,
                  {x:fromAnc2.x,y:fromAnc2.y+(dy>0?10:-10)},
                  {x:detourX,y:fromAnc2.y+(dy>0?10:-10)},
                  {x:detourX,y:toAnc2.y+(dy>0?-10:10)},
                  {x:toAnc2.x,y:toAnc2.y+(dy>0?-10:10)},
                  toAnc2
                ];
                if(_countRouteCollisions(extRoute,allBoxArr,excludeIds)<bestHits){
                  route=extRoute;
                }
              }
            }
          }
        }
      }
      if(route)svg+=svgOrthogonalEdge(route,mkId,!!e._wasBidirectional);
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  }
}

// ═══ v10.4: 포스트 렌더 검증 시스템 — SVG DOM 기반 겹침/잘림/연결 검증 ═══
// 렌더링된 SVG를 실제 DOM에서 분석하여 시각적 문제를 자동 감지 + 보정

function _postRenderValidateSvg(containerId, figNum){
  // ★ v10.4 Enhanced: 철저한 SVG DOM 기반 시각적 검증 ★
  const container=document.getElementById(containerId);
  if(!container)return{issues:[],pass:true};
  const svgEl=container.querySelector('svg');
  if(!svgEl)return{issues:[],pass:true};
  
  const issues=[];
  
  // viewBox 파싱
  const vb=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
  const svgW=vb[2]||800, svgH=vb[3]||600;
  
  // ── 1단계: 모든 요소 수집 ──
  
  // 1a. 텍스트 요소
  const textEls=svgEl.querySelectorAll('text');
  const textBoxes=[];
  textEls.forEach(t=>{
    try{
      const bbox=t.getBBox();
      if(bbox.width>0&&bbox.height>0){
        textBoxes.push({
          el:t, x:bbox.x, y:bbox.y, w:bbox.width, h:bbox.height,
          text:t.textContent||'', 
          fontSize:parseFloat(t.getAttribute('font-size'))||11
        });
      }
    }catch(e){}
  });
  
  // 1b. Shape 요소 (그림자/배경 제외)
  const shapeBoxes=[];
  const shadowFills=['#000','black'];
  svgEl.querySelectorAll('rect,circle,ellipse,polygon,path').forEach(el=>{
    try{
      const fill=el.getAttribute('fill')||'';
      const stroke=el.getAttribute('stroke')||'';
      const opacity=parseFloat(el.getAttribute('opacity')||'1');
      // 그림자 제외 (fill="#000" + opacity<1, 또는 stroke 없이 fill="#000")
      if(shadowFills.includes(fill)&&(opacity<1||!stroke))return;
      // 흰색 배경 rect 제외 (텍스트 배경용)
      if(fill==='#fff'&&!stroke&&el.tagName==='rect')return;
      // 마커(arrowhead) 내부 요소 제외
      if(el.closest('marker'))return;
      
      const bbox=el.getBBox();
      if(bbox.width<5||bbox.height<5)return; // 너무 작은 장식 요소 제외
      
      shapeBoxes.push({el, x:bbox.x,y:bbox.y,w:bbox.width,h:bbox.height, 
        type:el.tagName, fill, stroke});
    }catch(e){}
  });
  
  // 1c. 연결선 요소 (polyline with marker)
  const connectionLines=[];
  svgEl.querySelectorAll('polyline[marker-end],line[marker-end],path[marker-end]').forEach(el=>{
    try{
      const bbox=el.getBBox();
      // 연결선의 시작/끝점 추출
      if(el.tagName==='polyline'){
        const pts=(el.getAttribute('points')||'').trim().split(/\s+/).map(p=>{
          const [x,y]=p.split(',').map(Number);
          return{x,y};
        }).filter(p=>!isNaN(p.x)&&!isNaN(p.y));
        if(pts.length>=2){
          connectionLines.push({el, start:pts[0], end:pts[pts.length-1], points:pts});
        }
      }else if(el.tagName==='path'){
        // path 요소의 d 속성에서 좌표 추출
        const d=el.getAttribute('d')||'';
        const coords=[];
        const re=/[ML]\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/gi;
        let m;while((m=re.exec(d))!==null)coords.push({x:parseFloat(m[1]),y:parseFloat(m[2])});
        if(coords.length>=2){
          connectionLines.push({el, start:coords[0], end:coords[coords.length-1], points:coords});
        }
      }
    }catch(e){}
  });
  
  // ── 검사 A: 텍스트-텍스트 겹침 (감도 향상) ──
  for(let i=0;i<textBoxes.length;i++){
    for(let j=i+1;j<textBoxes.length;j++){
      const a=textBoxes[i], b=textBoxes[j];
      const overlapX=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
      const overlapY=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      const overlapArea=overlapX*overlapY;
      const minArea=Math.min(a.w*a.h,b.w*b.h);
      // ★ 10% 이상 겹침이면 감지 (기존 15% → 10%) ★
      if(overlapArea>minArea*0.10&&overlapArea>20){
        issues.push({
          type:'TEXT_OVERLAP', severity:'ERROR',
          msg:`텍스트 겹침: "${a.text.slice(0,15)}" ↔ "${b.text.slice(0,15)}" (${Math.round(overlapArea)}px²)`,
          elements:[a,b], overlapArea
        });
      }
    }
  }
  
  // ── 검사 B: 텍스트가 SVG 경계 밖으로 잘림 ──
  textBoxes.forEach(tb=>{
    const margin=svgW*0.02; // 2% 마진 허용
    const clipRight=tb.x+tb.w-(svgW-margin);
    const clipBottom=tb.y+tb.h-(svgH-margin);
    const clipLeft=margin-tb.x;
    const clipTop=margin-tb.y;
    if(clipRight>2||clipBottom>2||clipLeft>2||clipTop>2){
      issues.push({
        type:'TEXT_CLIPPED', severity:'WARNING',
        msg:`텍스트 잘림: "${tb.text.slice(0,12)}" (R:${Math.round(clipRight)} B:${Math.round(clipBottom)})`,
        element:tb, clip:{right:clipRight,bottom:clipBottom,left:clipLeft,top:clipTop}
      });
    }
  });
  
  // ── 검사 C: 텍스트-Shape 겹침 (라벨이 다른 shape 위에 올라감) ──
  textBoxes.forEach(tb=>{
    if(/^\(?\d+\)?$/.test(tb.text.trim()))return; // 참조번호 제외
    if(tb.text.trim().length<=1)return;
    
    const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
    
    shapeBoxes.forEach(sb=>{
      // 프레임(가장 큰 shape) 제외
      if(sb.w>svgW*0.5)return;
      
      const scx=sb.x+sb.w/2, scy=sb.y+sb.h/2;
      // 텍스트가 이 shape의 내부 라벨인지 확인 (중앙 간 거리로 판정)
      const isOwnLabel=Math.abs(tcx-scx)<sb.w*0.6&&Math.abs(tcy-scy)<sb.h*0.8;
      if(isOwnLabel)return; // 자기 shape 라벨은 정상
      
      // 다른 shape의 영역에 텍스트가 겹침?
      const overlapX=Math.max(0,Math.min(tb.x+tb.w,sb.x+sb.w)-Math.max(tb.x,sb.x));
      const overlapY=Math.max(0,Math.min(tb.y+tb.h,sb.y+sb.h)-Math.max(tb.y,sb.y));
      if(overlapX>5&&overlapY>5){
        issues.push({
          type:'TEXT_SHAPE_CROSS', severity:'ERROR',
          msg:`텍스트 "${tb.text.slice(0,12)}" 다른 shape 영역 침범 (${Math.round(overlapX)}×${Math.round(overlapY)}px)`,
          element:tb, shape:sb
        });
      }
    });
  });
  
  // ── 검사 D: shape-shape 겹침 ──
  for(let i=0;i<shapeBoxes.length;i++){
    for(let j=i+1;j<shapeBoxes.length;j++){
      const a=shapeBoxes[i], b=shapeBoxes[j];
      if(a.w>svgW*0.5||b.w>svgW*0.5)continue; // 프레임 제외
      // 같은 shape 내부 요소 (ex: circle inside rect) 제외
      if(a.el.contains(b.el)||b.el.contains(a.el))continue;
      // circle/ellipse(아이콘 장식) vs rect 겹침은 완화
      if(a.type!==b.type)continue;
      
      const overlapX=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
      const overlapY=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      const overlapArea=overlapX*overlapY;
      const minArea=Math.min(a.w*a.h,b.w*b.h);
      if(overlapArea>minArea*0.08&&overlapArea>100){
        issues.push({
          type:'SHAPE_OVERLAP', severity:'ERROR',
          msg:`Shape 겹침: ${Math.round(overlapArea)}px² (${Math.round(overlapArea/minArea*100)}%)`,
          elements:[a,b]
        });
      }
    }
  }
  
  // ── 검사 E: 연결선 접점 중앙 정렬 검증 ──
  connectionLines.forEach(cl=>{
    // 시작점/끝점이 가장 가까운 shape의 변 중앙에 있는지 확인
    [cl.start,cl.end].forEach((pt,ptIdx)=>{
      let closestShape=null, minDist=Infinity;
      shapeBoxes.forEach(sb=>{
        if(sb.w>svgW*0.5)return; // 프레임 제외
        // shape 경계까지의 최소 거리
        const cx=sb.x+sb.w/2, cy=sb.y+sb.h/2;
        const d=Math.hypot(pt.x-cx,pt.y-cy);
        if(d<minDist){minDist=d;closestShape=sb;}
      });
      
      if(closestShape){
        const sb=closestShape;
        const cx=sb.x+sb.w/2, cy=sb.y+sb.h/2;
        // 접점이 shape의 어느 변에 가장 가까운지 판정
        const distLeft=Math.abs(pt.x-sb.x);
        const distRight=Math.abs(pt.x-(sb.x+sb.w));
        const distTop=Math.abs(pt.y-sb.y);
        const distBottom=Math.abs(pt.y-(sb.y+sb.h));
        const minEdgeDist=Math.min(distLeft,distRight,distTop,distBottom);
        
        // 변에 닿는 점이면 → 해당 변의 중앙에 있는지 확인
        if(minEdgeDist<8){ // 8px 이내가 "변에 닿음"
          const tolerance=Math.max(8, Math.min(sb.w,sb.h)*0.15); // 15% 또는 8px
          let offCenter=0;
          if(distLeft<=minEdgeDist+2||distRight<=minEdgeDist+2){
            // 좌/우 변에 닿음 → py가 수직 중앙(cy)인지 확인
            offCenter=Math.abs(pt.y-cy);
          }else{
            // 상/하 변에 닿음 → px가 수평 중앙(cx)인지 확인
            offCenter=Math.abs(pt.x-cx);
          }
          
          if(offCenter>tolerance){
            issues.push({
              type:'CONN_OFF_CENTER', severity:'WARNING',
              msg:`연결선 접점 중앙 미정렬: ${ptIdx===0?'시작':'끝'}점 (오차 ${Math.round(offCenter)}px, 허용 ${Math.round(tolerance)}px)`,
              point:pt, shape:closestShape
            });
          }
        }
      }
    });
  });
  
  // ── 검사 F: 빈 라벨 shape (텍스트 없는 박스) ──
  shapeBoxes.filter(sb=>sb.w>30&&sb.h>20&&sb.w<svgW*0.5&&sb.stroke).forEach(sb=>{
    const hasLabel=textBoxes.some(tb=>{
      const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
      return tcx>sb.x&&tcx<sb.x+sb.w&&tcy>sb.y-sb.h*0.5&&tcy<sb.y+sb.h*1.5;
    });
    if(!hasLabel&&sb.type==='rect'){
      // rect에 라벨이 없으면 경고 (서버 내부 섹션선 등은 제외)
      // 너비가 50px 이상이고 높이가 20px 이상인 의미있는 shape만
      if(sb.w>80&&sb.h>40){
        issues.push({
          type:'EMPTY_SHAPE', severity:'INFO',
          msg:`Shape에 라벨 없음 (${Math.round(sb.w)}×${Math.round(sb.h)}px @ ${Math.round(sb.x)},${Math.round(sb.y)})`,
          shape:sb
        });
      }
    }
  });
  
  // ── 검사 G: 글자 크기 대비 박스 크기 비율 검증 ──
  // 라벨 텍스트가 shape 면적의 합리적 비율을 차지하는지 확인
  textBoxes.forEach(tb=>{
    if(/^\(?\d+\)?$/.test(tb.text.trim()))return; // 참조번호 제외
    if(/^[SD]\d+$/i.test(tb.text.trim()))return;
    if(tb.text.trim().length<=1)return;
    
    // 가장 가까운 shape 찾기
    const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
    let closest=null, closestDist=Infinity;
    shapeBoxes.forEach(sb=>{
      if(sb.w>svgW*0.5)return; // 프레임 제외
      const scx=sb.x+sb.w/2, scy=sb.y+sb.h/2;
      const d=Math.hypot(tcx-scx,tcy-scy);
      if(d<closestDist){closestDist=d;closest=sb;}
    });
    
    if(closest){
      // 텍스트 높이 대비 shape 높이 비율
      const textRatioH=tb.h/closest.h;
      // 텍스트 너비 대비 shape 너비 비율
      const textRatioW=tb.w/closest.w;
      
      // 텍스트가 shape 높이의 12% 미만이면 글자가 너무 작음
      if(textRatioH<0.12&&closest.h>40){
        issues.push({
          type:'FONT_TOO_SMALL', severity:'WARNING',
          msg:`글자 크기 부족: "${tb.text.slice(0,12)}" 높이비 ${Math.round(textRatioH*100)}% (shape ${Math.round(closest.w)}×${Math.round(closest.h)}px, font ${tb.fontSize}px)`,
          element:tb, shape:closest, ratio:textRatioH
        });
      }
      // 텍스트가 shape 너비의 15% 미만이면 글자가 너무 작음
      if(textRatioW<0.15&&closest.w>60&&tb.text.length>2){
        issues.push({
          type:'FONT_TOO_SMALL', severity:'WARNING',
          msg:`글자 너비 부족: "${tb.text.slice(0,12)}" 너비비 ${Math.round(textRatioW*100)}% (shape ${Math.round(closest.w)}px, font ${tb.fontSize}px)`,
          element:tb, shape:closest, ratio:textRatioW
        });
      }
    }
  });
  
  // ── 검사 H: 연결선 불필요한 꺾임 검증 ──
  connectionLines.forEach(cl=>{
    if(cl.points.length<=2)return; // 직선은 OK
    
    const start=cl.points[0], end=cl.points[cl.points.length-1];
    const totalBends=cl.points.length-2; // 중간 웨이포인트 수 = 꺾임 수
    
    // 시작/끝이 같은 X(수직) 또는 같은 Y(수평)인데 중간에 꺾임이 있으면 불필요
    const couldBeStraightV=Math.abs(start.x-end.x)<5;
    const couldBeStraightH=Math.abs(start.y-end.y)<5;
    
    if((couldBeStraightV||couldBeStraightH)&&totalBends>0){
      issues.push({
        type:'UNNECESSARY_BEND', severity:'WARNING',
        msg:`불필요한 꺾임: 직선 가능한데 ${totalBends}번 꺾임 (${Math.round(start.x)},${Math.round(start.y)} → ${Math.round(end.x)},${Math.round(end.y)})`,
        line:cl, bendCount:totalBends
      });
    }
    
    // L-shape (1 꺾임)이면 OK, 2+꺾임이면 최적화 필요 경고
    if(totalBends>=3){
      issues.push({
        type:'EXCESSIVE_BENDS', severity:'WARNING',
        msg:`과도한 꺾임: ${totalBends}번 꺾임 (시작 ${Math.round(start.x)},${Math.round(start.y)} → 끝 ${Math.round(end.x)},${Math.round(end.y)})`,
        line:cl, bendCount:totalBends
      });
    }
  });
  
  // ── 검사 I: 연결선이 shape 관통 (ROUTE_PIERCE) ──
  connectionLines.forEach(cl=>{
    if(!cl.points||cl.points.length<2)return;
    for(let i=0;i<cl.points.length-1;i++){
      const p1=cl.points[i], p2=cl.points[i+1];
      shapeBoxes.forEach(sb=>{
        if(sb.w>svgW*0.5)return; // 프레임 제외
        // 세그먼트가 shape 내부를 관통하는지 확인
        const pad=3;
        const bx1=sb.x+pad, by1=sb.y+pad, bx2=sb.x+sb.w-pad, by2=sb.y+sb.h-pad;
        let intersects=false;
        if(Math.abs(p1.y-p2.y)<2){
          // 수평 세그먼트
          if(p1.y>by1&&p1.y<by2){
            const minX=Math.min(p1.x,p2.x), maxX=Math.max(p1.x,p2.x);
            if(maxX>bx1&&minX<bx2)intersects=true;
          }
        }else if(Math.abs(p1.x-p2.x)<2){
          // 수직 세그먼트
          if(p1.x>bx1&&p1.x<bx2){
            const minY=Math.min(p1.y,p2.y), maxY=Math.max(p1.y,p2.y);
            if(maxY>by1&&minY<by2)intersects=true;
          }
        }
        // 세그먼트 끝점이 shape 가장자리에 있는 건 정상 (연결)
        if(intersects){
          const startAtEdge=(i===0&&Math.hypot(p1.x-sb.x-sb.w/2,p1.y-sb.y-sb.h/2)<Math.max(sb.w,sb.h)*0.6);
          const endAtEdge=(i===cl.points.length-2&&Math.hypot(p2.x-sb.x-sb.w/2,p2.y-sb.y-sb.h/2)<Math.max(sb.w,sb.h)*0.6);
          if(!startAtEdge&&!endAtEdge){
            issues.push({
              type:'ROUTE_PIERCE', severity:'ERROR',
              msg:`연결선 shape 관통: seg${i} (${Math.round(p1.x)},${Math.round(p1.y)}→${Math.round(p2.x)},${Math.round(p2.y)}) through shape at (${Math.round(sb.x)},${Math.round(sb.y)})`,
              line:cl, shape:sb, segIndex:i
            });
          }
        }
      });
    }
  });
  
  // ── 검사 J: 동일 도면 내 글자 크기 불일치 ──
  // 라벨 텍스트(참조번호 제외)의 폰트 크기가 2px 이상 차이나면 경고
  const labelFontSizes=textBoxes
    .filter(tb=>!/^\(?\d+\)?$/.test(tb.text.trim())&&tb.text.trim().length>1)
    .map(tb=>tb.fontSize)
    .filter(fs=>fs>0);
  if(labelFontSizes.length>1){
    const maxFs=Math.max(...labelFontSizes);
    const minFs=Math.min(...labelFontSizes);
    if(maxFs-minFs>=3){
      issues.push({
        type:'FONT_INCONSISTENT', severity:'WARNING',
        msg:`글자 크기 불일치: ${minFs}px ~ ${maxFs}px (차이 ${maxFs-minFs}px)`,
        minFontSize:minFs, maxFontSize:maxFs
      });
    }
  }
  
  const errorCount=issues.filter(i=>i.severity==='ERROR').length;
  const pass=errorCount===0;
  
  // 콘솔 리포트
  if(issues.length>0){
    console.log(`[PostRender] 도 ${figNum}: ${errorCount} ERR, ${issues.filter(i=>i.severity==='WARNING').length} WARN, ${issues.filter(i=>i.severity==='INFO').length} INFO`);
    issues.forEach(i=>console.log(`  [${i.severity}] ${i.type}: ${i.msg}`));
  }
  
  return{issues, pass, textBoxes, shapeBoxes, connectionLines};
}

function _autoFixRenderedSvg(containerId, issues, attempt){
  // ★ v10.4 Enhanced: 렌더링된 SVG DOM 직접 수정으로 문제 해결 ★
  const container=document.getElementById(containerId);
  if(!container)return 0;
  const svgEl=container.querySelector('svg');
  if(!svgEl)return 0;
  
  let fixCount=0;
  
  issues.forEach(issue=>{
    switch(issue.type){
      case 'TEXT_OVERLAP':{
        const [a,b]=issue.elements;
        const lowerEl=a.y>b.y?a:b;
        const upperEl=a.y>b.y?b:a;
        const gapNeeded=(upperEl.y+upperEl.h+2)-lowerEl.y;
        if(gapNeeded>0){
          const curY=parseFloat(lowerEl.el.getAttribute('y'))||0;
          lowerEl.el.setAttribute('y',String(curY+gapNeeded+4));
          fixCount++;
        }
        if(attempt>=1){
          [a,b].forEach(tb=>{
            const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
            if(fs>7){tb.el.setAttribute('font-size',String(Math.max(7,fs-1)));fixCount++;}
          });
        }
        break;
      }
      
      case 'TEXT_SHAPE_CROSS':{
        // 다른 shape에 겹친 텍스트 → 폰트 축소 + 위치 이동
        const tb=issue.element;
        const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
        if(fs>7){tb.el.setAttribute('font-size',String(Math.max(7,fs-1)));fixCount++;}
        break;
      }
      
      case 'TEXT_CLIPPED':{
        const clip=issue.clip;
        const vbArr=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
        let changed=false;
        if(clip.right>2){vbArr[2]+=clip.right+15;changed=true;}
        if(clip.bottom>2){vbArr[3]+=clip.bottom+15;changed=true;}
        if(clip.left>2){vbArr[0]-=(clip.left+15);vbArr[2]+=(clip.left+15);changed=true;}
        if(clip.top>2){vbArr[1]-=(clip.top+15);vbArr[3]+=(clip.top+15);changed=true;}
        if(changed){svgEl.setAttribute('viewBox',vbArr.join(' '));fixCount++;}
        break;
      }
      
      case 'SHAPE_OVERLAP':{
        // ★ v14 FIX: 겹침 방향으로 viewBox 확장 + 재렌더링 간격 배율 산출 ★
        const [ovA,ovB]=issue.elements;
        if(!ovA||!ovB)break;
        const overlapX=Math.max(0,Math.min(ovA.x+ovA.w,ovB.x+ovB.w)-Math.max(ovA.x,ovB.x));
        const overlapY=Math.max(0,Math.min(ovA.y+ovA.h,ovB.y+ovB.h)-Math.max(ovA.y,ovB.y));
        // viewBox 확장: 겹침 방향에 여유 공간 추가
        const ovVb=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
        if(ovVb.length===4){
          if(overlapY>=overlapX){ovVb[3]+=overlapY+20;}
          else{ovVb[2]+=overlapX+20;}
          svgEl.setAttribute('viewBox',ovVb.join(' '));
        }
        // 재렌더링 시 필요한 간격 배율 저장 (최대 겹침 기준)
        const curOvMult=parseFloat(svgEl.dataset.overlapSpacingMult||'1');
        const maxOvDim=Math.max(overlapX,overlapY);
        const newOvMult=1+maxOvDim/(Math.max(ovVb[2]||600,ovVb[3]||400))*2;
        svgEl.dataset.overlapSpacingMult=String(Math.max(curOvMult,newOvMult).toFixed(2));
        fixCount++;
        break;
      }

      case 'CONN_OFF_CENTER':{
        // ★ v14 FIX: 연결선 접점을 shape 변 중앙으로 스냅 시도 ★
        const cPt=issue.point, cSb=issue.shape;
        if(!cPt||!cSb)break;
        const sCx=cSb.x+cSb.w/2, sCy=cSb.y+cSb.h/2;
        // 접점이 어느 변에 가까운지 판정
        const dL=Math.abs(cPt.x-cSb.x), dR=Math.abs(cPt.x-(cSb.x+cSb.w));
        const dT=Math.abs(cPt.y-cSb.y), dB=Math.abs(cPt.y-(cSb.y+cSb.h));
        const minD=Math.min(dL,dR,dT,dB);
        // 가장 가까운 변의 중앙 좌표 계산
        let snapX=cPt.x, snapY=cPt.y;
        if(dL<=minD+1||dR<=minD+1){snapY=sCy;} // 좌/우 변 → Y를 중앙으로
        else{snapX=sCx;} // 상/하 변 → X를 중앙으로
        // SVG 내 모든 polyline/line 요소에서 해당 점 찾아서 스냅
        const tolerance=3;
        svgEl.querySelectorAll('polyline').forEach(pl=>{
          const pts=pl.getAttribute('points');if(!pts)return;
          const parsed=pts.split(/\s+/).map(p=>{const[x,y]=p.split(',').map(Number);return{x,y};});
          let changed=false;
          [0,parsed.length-1].forEach(idx=>{
            if(Math.abs(parsed[idx].x-cPt.x)<tolerance&&Math.abs(parsed[idx].y-cPt.y)<tolerance){
              parsed[idx].x=snapX;parsed[idx].y=snapY;changed=true;
            }
          });
          if(changed){pl.setAttribute('points',parsed.map(p=>`${p.x},${p.y}`).join(' '));fixCount++;}
        });
        break;
      }
      
      case 'FONT_TOO_SMALL':{
        // 박스 대비 글자가 너무 작음 → 폰트 크기 증가
        const tb=issue.element;
        const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
        const targetFs=Math.min(fs+2, 16); // 최대 16px까지 증가
        if(targetFs>fs){
          tb.el.setAttribute('font-size',String(targetFs));
          fixCount++;
        }
        break;
      }
      
      case 'UNNECESSARY_BEND':
      case 'EXCESSIVE_BENDS':{
        // 불필요한 꺾임 — DOM에서 polyline points 수정
        const cl=issue.line;
        if(!cl||!cl.el)break;
        const pts=cl.points;
        const start=pts[0], end=pts[pts.length-1];
        // 직선 가능하면 직선화
        if(Math.abs(start.x-end.x)<5){
          cl.el.setAttribute('points',`${start.x},${start.y} ${start.x},${end.y}`);
          fixCount++;
        }else if(Math.abs(start.y-end.y)<5){
          cl.el.setAttribute('points',`${start.x},${start.y} ${end.x},${start.y}`);
          fixCount++;
        }else if(pts.length>3){
          // L-shape로 단순화
          const midPt=Math.abs(start.x-end.x)>Math.abs(start.y-end.y)?
            `${start.x},${start.y} ${end.x},${start.y} ${end.x},${end.y}`:
            `${start.x},${start.y} ${start.x},${end.y} ${end.x},${end.y}`;
          cl.el.setAttribute('points',midPt);
          fixCount++;
        }
        break;
      }
      
      case 'ROUTE_PIERCE':{
        // 연결선이 shape를 관통 — DOM에서 경로 수정 (우회)
        const cl=issue.line;
        const sb=issue.shape;
        if(!cl||!cl.el||!sb)break;
        const pts=cl.points;
        const start=pts[0], end=pts[pts.length-1];
        // 관통 shape를 피해 L-shape 또는 Z-shape로 우회
        const shapeRight=sb.x+sb.w+15;
        const shapeLeft=sb.x-15;
        const shapeBottom=sb.y+sb.h+15;
        const shapeTop=sb.y-15;
        // 가장 짧은 우회 경로 선택
        let newPoints;
        if(Math.abs(start.y-end.y)<Math.abs(start.x-end.x)){
          // 주로 수평 이동 → 위/아래로 우회
          const detourY=Math.abs(start.y-shapeTop)<Math.abs(start.y-shapeBottom)?shapeTop:shapeBottom;
          newPoints=`${start.x},${start.y} ${start.x},${detourY} ${end.x},${detourY} ${end.x},${end.y}`;
        }else{
          // 주로 수직 이동 → 좌/우로 우회
          const detourX=Math.abs(start.x-shapeLeft)<Math.abs(start.x-shapeRight)?shapeLeft:shapeRight;
          newPoints=`${start.x},${start.y} ${detourX},${start.y} ${detourX},${end.y} ${end.x},${end.y}`;
        }
        cl.el.setAttribute('points',newPoints);
        fixCount++;
        break;
      }
      
      case 'FONT_INCONSISTENT':{
        // 폰트 크기 불일치 → 모든 라벨 텍스트를 최소 크기+1로 통일
        const targetFs=Math.max(issue.minFontSize, Math.min(issue.minFontSize+1, 12));
        const allTexts=svgEl.querySelectorAll('text');
        allTexts.forEach(t=>{
          const txt=t.textContent.trim();
          if(/^\(?\d+\)?$/.test(txt))return; // 참조번호 제외
          if(txt.length<=1)return;
          const curFs=parseFloat(t.getAttribute('font-size'))||11;
          if(Math.abs(curFs-targetFs)>=2){
            t.setAttribute('font-size', String(targetFs));
            fixCount++;
          }
        });
        break;
      }
    }
  });
  
  return fixCount;
}

function _postRenderValidationLoop(containerId, figNum, maxAttempts, renderInfo){
  // ★ v10.4: 2단계 보정 루프 ★
  // 1단계: DOM 수정 (폰트 축소, 위치 조정, viewBox 확장)
  // 2단계: 파라미터 조정 후 재렌더링 (간격 확대, 박스 축소)
  const MAX=maxAttempts||3;
  let lastResult=null;
  
  // ── 1단계: DOM 기반 보정 (2회) ──
  for(let attempt=0;attempt<Math.min(MAX,2);attempt++){
    const result=_postRenderValidateSvg(containerId, figNum);
    lastResult=result;
    
    if(result.pass){
      if(attempt>0)console.log(`[PostRender] 도 ${figNum}: DOM 보정 ${attempt}회 후 통과 <span class="ico" data-icon="check-circle"></span>`);
      return result;
    }
    
    const errors=result.issues.filter(i=>i.severity==='ERROR');
    const warnings=result.issues.filter(i=>i.severity==='WARNING');
    console.warn(`[PostRender] 도 ${figNum}: DOM 보정 ${attempt+1} — ERROR ${errors.length}, WARNING ${warnings.length}`);
    
    const fixCount=_autoFixRenderedSvg(containerId, result.issues, attempt);
    if(fixCount===0)break;
  }
  
  // ── 2단계: 재렌더링 보정 (ERROR 또는 심각한 WARNING이 남아있을 때) ──
  if(lastResult&&renderInfo){
    const hasErrors=!lastResult.pass;
    const hasBends=lastResult.issues.filter(i=>i.type==='UNNECESSARY_BEND'||i.type==='EXCESSIVE_BENDS').length;
    const hasPierce=lastResult.issues.filter(i=>i.type==='ROUTE_PIERCE').length;
    const hasFontIssue=lastResult.issues.filter(i=>i.type==='FONT_INCONSISTENT'||i.type==='FONT_TOO_SMALL').length;
    // ★ v14 FIX: SHAPE_OVERLAP, CONN_OFF_CENTER도 재렌더링 트리거에 포함 ★
    const hasOverlap=lastResult.issues.filter(i=>i.type==='SHAPE_OVERLAP').length;
    const hasOffCenter=lastResult.issues.filter(i=>i.type==='CONN_OFF_CENTER').length;
    const needsRerender=hasErrors||hasPierce>0||hasBends>1||hasFontIssue>0||hasOverlap>0||hasOffCenter>1;

    if(needsRerender){
      console.warn(`[PostRender] 도 ${figNum}: DOM 보정 불충분 → 재렌더링 시도 (ERR:${hasErrors?'Y':'N'} BEND:${hasBends} PIERCE:${hasPierce} FONT:${hasFontIssue} OVERLAP:${hasOverlap} OFFCENTER:${hasOffCenter})`);

      // ★ v14 FIX: 1단계 DOM 보정에서 산출한 overlapSpacingMult 반영 ★
      const container=document.getElementById(containerId);
      const svgEl=container?.querySelector('svg');
      const overlapMult=parseFloat(svgEl?.dataset?.overlapSpacingMult||'1');

      // 간격 확대 + 폰트 조정으로 재렌더링
      const baseSpacing=hasPierce>0?1.25:hasOverlap>0?1.20:1.15;
      const adjustments={
        spacingMult: Math.max(baseSpacing, overlapMult),
        fontOffset: hasFontIssue>0?1:-1,
        boxWidthMult: hasOverlap>0?1.08:1.05,
        boxHeightMult: hasOverlap>0?1.10:1.05
      };

      try{
        renderDiagramSvg(containerId, renderInfo.nodes, renderInfo.edges,
          renderInfo.positions, figNum, adjustments);

        // 재렌더링 후 검증
        const result2=_postRenderValidateSvg(containerId, figNum);
        lastResult=result2;

        if(result2.pass){
          console.log(`[PostRender] 도 ${figNum}: 재렌더링 후 통과 <span class="ico" data-icon="check-circle"></span>`);
        }else{
          // 한 번 더 시도 — 더 큰 조정
          console.warn(`[PostRender] 도 ${figNum}: 재렌더링 후에도 ${result2.issues.length}개 문제 → 2차 재렌더링`);
          const adj2={spacingMult:Math.max(1.30,overlapMult*1.15), fontOffset:-2, boxWidthMult:1.10, boxHeightMult:1.12};
          renderDiagramSvg(containerId, renderInfo.nodes, renderInfo.edges,
            renderInfo.positions, figNum, adj2);
          lastResult=_postRenderValidateSvg(containerId, figNum);

          if(lastResult.pass){
            console.log(`[PostRender] 도 ${figNum}: 2차 재렌더링 후 통과 <span class="ico" data-icon="check-circle"></span>`);
          }else{
            // DOM 보정 마지막 시도
            _autoFixRenderedSvg(containerId, lastResult.issues, 2);
            lastResult=_postRenderValidateSvg(containerId, figNum);
          }
        }
      }catch(e){
        console.error(`[PostRender] 도 ${figNum}: 재렌더링 오류:`,e);
      }
    }
  }
  
  return lastResult;
}

// ═══ 전체 도면 렌더링 후 일괄 포스트 검증 ═══
function _runPostRenderValidation(sid, figNums){
  const data=diagramData[sid];
  if(!data||!data.length)return;
  
  let totalIssues=0;
  const reports=[];
  
  data.forEach((d,i)=>{
    const containerId=`diagram_${sid}_${i}`;
    const figNum=figNums[i]||(i+1);
    // ★ v10.4: renderInfo 전달 — 재렌더링 지원 ★
    const renderInfo={nodes:d.nodes, edges:d.edges, positions:d.positions};
    const result=_postRenderValidationLoop(containerId, figNum, 3, renderInfo);
    if(result&&result.issues.length>0){
      totalIssues+=result.issues.length;
      reports.push({figNum, issues:result.issues});
    }
  });
  
  // 검증 결과 표시
  const resultEl=document.getElementById(`validationResult_${sid}`);
  if(resultEl){
    if(totalIssues===0){
      resultEl.innerHTML='<span style="color:var(--dt-success)"><span class="ico" data-icon="check-circle"></span> 포스트 렌더 검증 통과</span>';
    }else{
      const errCount=reports.reduce((sum,r)=>sum+r.issues.filter(i=>i.severity==='ERROR').length,0);
      const warnCount=reports.reduce((sum,r)=>sum+r.issues.filter(i=>i.severity==='WARNING').length,0);
      let msg=`⚠️ 포스트 렌더: `;
      if(errCount>0)msg+=`ERROR ${errCount}개 `;
      if(warnCount>0)msg+=`WARNING ${warnCount}개`;
      resultEl.innerHTML=`<span style="color:${errCount>0?'var(--dt-danger)':'var(--dt-warning)'}">${msg}</span>`;
      
      // 상세 리포트 (콘솔)
      reports.forEach(r=>{
        console.log(`[PostRender Report] 도 ${r.figNum}:`);
        r.issues.forEach(i=>console.log(`  [${i.severity}] ${i.type}: ${i.msg}`));
      });
    }
  }
  
  return{totalIssues, reports};
}

// ═══ 도면 규칙 검증 함수 (v5.0 - 통합 검증) ═══
function validateDiagramRules(nodes,figNum,designText,edges){
  const issues=[];
  
  function extractRef(label){
    const m=(label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
    return m?m[1]:null;
  }
  function isL1(ref){return ref&&!ref.startsWith('S')&&parseInt(ref)>=100&&parseInt(ref)%100===0;}
  
  // ═══ R0. 파싱 실패 ═══
  if(!nodes||nodes.length===0){
    issues.push({severity:'ERROR',rule:'R0',message:`도 ${figNum}: Mermaid 파싱 실패 - 노드 없음`});
    return issues;
  }
  
  // ═══ R1. 라벨 오류 (Mermaid 코드 잔재) ═══
  const isFlowchartNode=lb=>/^(시작|종료|START|END|S|E)$/i.test(lb.trim());
  nodes.forEach(n=>{
    const lb=n.label||'';
    if(lb.includes('"]')||lb.includes('<-->')||lb.includes('-->')){
      issues.push({severity:'ERROR',rule:'R1',message:`도 ${figNum}: 파싱 오류 - "${lb.slice(0,30)}..."`});
    }
    if(lb===n.id&&!/^\d+$/.test(lb)&&!isFlowchartNode(lb)){
      issues.push({severity:'WARNING',rule:'R1',message:`도 ${figNum}: 노드 "${n.id}" 라벨 추출 실패`});
    }
  });
  
  // ═══ R2. ~모듈 금지 ═══
  nodes.forEach(n=>{
    if(n.label.includes('모듈')){
      issues.push({severity:'WARNING',rule:'R2',message:`"${n.label}" → "~부"로 변경 필요`});
    }
  });
  
  // ═══ R3. 참조번호 존재 여부 (시작/종료 노드 제외) ═══
  nodes.forEach(n=>{
    if(isFlowchartNode(n.label))return; // 시작/종료 노드는 참조번호 불필요
    if(!extractRef(n.label)){
      issues.push({severity:'WARNING',rule:'R3',message:`"${n.label}" - 참조번호 없음`});
    }
  });
  
  // ═══ R4. 참조번호 중복 ═══
  const allRefs=nodes.map(n=>extractRef(n.label)).filter(Boolean);
  const dupRefs=allRefs.filter((r,i)=>allRefs.indexOf(r)!==i);
  if(dupRefs.length){
    issues.push({severity:'ERROR',rule:'R4',message:`참조번호 중복: ${[...new Set(dupRefs)].join(', ')}`});
  }

  // ═══ R13a. 명칭 중복 — 같은 이름에 다른 참조번호 (기재불비) ═══
  const labelToRefs={};
  nodes.forEach(n=>{
    const ref=extractRef(n.label);
    if(!ref)return;
    const clean=(_safeCleanLabel(n.label)||'').trim();
    if(!clean||clean.length<2)return;
    if(!labelToRefs[clean])labelToRefs[clean]=[];
    labelToRefs[clean].push(ref);
  });
  Object.entries(labelToRefs).forEach(([label,refs])=>{
    if(refs.length>1){
      const uniqueRefs=[...new Set(refs)];
      if(uniqueRefs.length>1){
        issues.push({
          severity:'ERROR',
          rule:'R13a',
          message:`명칭 "${label}"이 서로 다른 참조번호(${uniqueRefs.join(', ')})로 중복 사용 — 기재불비(特42조④)`
        });
      }
    }
  });

  // ═══ R13b. 참조번호 중복 — 같은 번호에 다른 명칭 (기재불비) ═══
  const refToLabels={};
  nodes.forEach(n=>{
    const ref=extractRef(n.label);
    if(!ref)return;
    const clean=(_safeCleanLabel(n.label)||'').trim();
    if(!clean||clean.length<2)return;
    if(!refToLabels[ref])refToLabels[ref]=[];
    if(!refToLabels[ref].includes(clean))refToLabels[ref].push(clean);
  });
  Object.entries(refToLabels).forEach(([ref,labels])=>{
    if(labels.length>1){
      issues.push({
        severity:'ERROR',
        rule:'R13b',
        message:`참조번호 ${ref}에 서로 다른 명칭("${labels.join('", "')}") — 기재불비(特42조④)`
      });
    }
  });


  const numRefs=allRefs.filter(r=>!r.startsWith('S')&&!r.startsWith('D')).map(r=>parseInt(r)).filter(n=>!isNaN(n));
  const dRefs=allRefs.filter(r=>r.startsWith('D')).map(r=>({full:r,num:parseInt(r.slice(1))}));
  const l1Refs=numRefs.filter(n=>n>=100&&n<1000&&n%100===0);
  const l2Refs=numRefs.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
  const l3Refs=numRefs.filter(n=>n>=100&&n<1000&&n%10!==0);
  const l4Refs=numRefs.filter(n=>n>=1000&&n<10000);
  const smallRefs=numRefs.filter(n=>n<100);
  
  // ★ 방법 도면 판별: S참조번호 또는 시작/종료 노드 ★
  const sRefCount=allRefs.filter(r=>String(r).startsWith('S')).length;
  const hasFlowchartNodes=nodes.some(n=>/^(시작|종료|START|END)$/i.test(n.label.trim()));
  const isMethodFig=sRefCount>0||hasFlowchartNodes;
  
  // ═══ R5~R7: 장치 도면 전용 규칙 (방법 도면은 건너뜀) ═══
  if(!isMethodFig){
  
  // ═══ R5. 도 1 규칙: L1만 허용 ═══
  if(figNum===1){
    nodes.forEach(n=>{
      const ref=extractRef(n.label);
      if(ref&&!isL1(ref)&&!ref.startsWith('S')){
        issues.push({severity:'ERROR',rule:'R5',message:`도 1에 하위 "${n.label}" 불가. L1(X00)만 허용.`});
      }
    });
  }
  
  // ═══ R6. 도 2+ 계층 규칙 ═══
  if(figNum>1){
    // R6a. 여러 L1 혼합 금지
    if(l1Refs.length>1){
      issues.push({severity:'ERROR',rule:'R6a',message:`도 ${figNum}: 여러 L1(${l1Refs.join(',')}) 혼합 불가`});
    }
    
    // R6b. L1+하위 혼합 시 계층 검증
    if(l1Refs.length===1){
      const theL1=l1Refs[0];
      const badL2=l2Refs.filter(n=>Math.floor(n/100)*100!==theL1);
      const badL3=l3Refs.filter(n=>Math.floor(n/100)*100!==theL1);
      if(badL2.length) issues.push({severity:'ERROR',rule:'R6b',message:`도 ${figNum}: L2(${badL2.join(',')})가 L1(${theL1})의 하위 아님`});
      if(badL3.length) issues.push({severity:'ERROR',rule:'R6b',message:`도 ${figNum}: L3(${badL3.join(',')})가 L1(${theL1})의 하위 아님`});
      
      // ★ v18.2: L2+L3 혼합 — 서브 프레임 중첩 허용 ★
      if(l2Refs.length>0&&l3Refs.length>0){
        const l3ParentL2s=[...new Set(l3Refs.map(n=>Math.floor(n/10)*10))];
        const allParentsPresent=l3ParentL2s.every(p=>l2Refs.includes(p));
        const singleParent=l3ParentL2s.length===1;

        if(allParentsPresent&&singleParent){
          const parentL2=l3ParentL2s[0];
          const otherL2=l2Refs.filter(r=>r!==parentL2);
          issues.push({severity:'INFO',rule:'R6b',
            message:`도 ${figNum}: 중첩 블록도 — ${parentL2}이 서브 프레임(내부 L3: ${l3Refs.join(',')}), 독립 L2: ${otherL2.join(',')||'없음'}`});
        }else if(allParentsPresent&&!singleParent){
          issues.push({severity:'WARNING',rule:'R6b',
            message:`도 ${figNum}: 복수 L2(${l3ParentL2s.join(',')}) 서브 프레임 — 도면 분할 권장`});
        }else{
          const orphanL3=l3Refs.filter(n=>!l2Refs.includes(Math.floor(n/10)*10));
          issues.push({severity:'ERROR',rule:'R6b',
            message:`도 ${figNum}: L3(${orphanL3.join(',')})의 부모 L2가 이 도면에 없음 — 레벨 혼합 오류`});
        }
      }else if(!badL2.length&&!badL3.length&&(l2Refs.length>0||l3Refs.length>0)){
        issues.push({severity:'INFO',rule:'R6b',message:`도 ${figNum} 최외곽: ${theL1} (L1 자체가 프레임)`});
      }
    }
    
    // R6c. L2만 있는 경우 직계 부모 INFO
    if(l1Refs.length===0&&l2Refs.length>0&&l3Refs.length===0){
      const parents=[...new Set(l2Refs.map(n=>Math.floor(n/100)*100))];
      if(parents.length===1){
        issues.push({severity:'INFO',rule:'R6c',message:`도 ${figNum} 최외곽: ${parents[0]} (직계 부모)`});
      }
    }
    
    // R6d. L3만 있는 경우 직계 부모 INFO
    if(l1Refs.length===0&&l2Refs.length===0&&l3Refs.length>0){
      const l2Parents=[...new Set(l3Refs.map(n=>Math.floor(n/10)*10))];
      if(l2Parents.length===1){
        issues.push({severity:'INFO',rule:'R6d',message:`도 ${figNum} 최외곽: ${l2Parents[0]} (직계 부모)`});
      }
    }
    
    // R6e. L2+L3 혼합: L2가 L3의 직계 부모인지 검증 ★신규★
    if(l1Refs.length===0&&l2Refs.length>0&&l3Refs.length>0){
      if(l2Refs.length===1){
        const theL2=l2Refs[0];
        const allL3BelongToL2=l3Refs.every(n=>Math.floor(n/10)*10===theL2);
        if(allL3BelongToL2){
          issues.push({severity:'INFO',rule:'R6e',message:`도 ${figNum} 최외곽: ${theL2} (L2 자체가 프레임, 내부 L3: ${l3Refs.join(',')})`});
        }else{
          const badL3=l3Refs.filter(n=>Math.floor(n/10)*10!==theL2);
          issues.push({severity:'ERROR',rule:'R6e',message:`도 ${figNum}: L3(${badL3.join(',')})가 L2(${theL2})의 하위가 아님`});
        }
      }else{
        // 여러 L2가 있으면 경고
        issues.push({severity:'WARNING',rule:'R6e',message:`도 ${figNum}: L2(${l2Refs.join(',')})와 L3(${l3Refs.join(',')}) 혼합 - 계층 확인 필요`});
      }
    }
    
    // R6f. L4 포함 시: L3가 직계 부모인지 검증
    if(l4Refs.length>0){
      if(l3Refs.length===1){
        const theL3=l3Refs[0];
        const allL4Belong=l4Refs.every(n=>Math.floor(n/10)===theL3);
        if(allL4Belong){
          issues.push({severity:'INFO',rule:'R6f',message:`도 ${figNum} 최외곽: ${theL3} (L3 프레임, 내부 L4: ${l4Refs.join(',')})`});
        }else{
          const bad=l4Refs.filter(n=>Math.floor(n/10)!==theL3);
          issues.push({severity:'ERROR',rule:'R6f',message:`도 ${figNum}: L4(${bad.join(',')})가 L3(${theL3})의 하위가 아님`});
        }
      }else if(l3Refs.length===0){
        const parents=[...new Set(l4Refs.map(n=>Math.floor(n/10)))];
        if(parents.length===1){
          issues.push({severity:'INFO',rule:'R6f',message:`도 ${figNum} 최외곽: ${parents[0]} (L4 직계부모)`});
        }
      }
    }
    
    // R6g. 데이터 참조번호 (D접두사 또는 소수)
    if(dRefs.length>0||smallRefs.length>0){
      const topD=dRefs.filter(d=>d.num<10);
      const subD=dRefs.filter(d=>d.num>=10);
      if(topD.length===1&&subD.length>0){
        issues.push({severity:'INFO',rule:'R6g',message:`도 ${figNum} 최외곽: ${topD[0].full} (데이터 프레임)`});
      }
    }
  }
  
  // ═══ R7. 도면 설계 텍스트와 노드 수 비교 ═══
  if(designText){
    // 도면 설계에서 해당 도면의 구성요소 개수 추출
    const figPattern=new RegExp(`도\\s*${figNum}[^]*?구성요소[^:：]*[：:]\\s*([^\\n]+)`,'i');
    const figMatch=designText.match(figPattern);
    if(figMatch){
      const designRefs=(figMatch[1].match(/\((\d+)\)/g)||[]).map(r=>r.replace(/[()]/g,''));
      // L1 포함 케이스: 설계에 L1이 있으면 렌더링에서 제외되므로 보정
      const hasDesignL1=designRefs.some(r=>parseInt(r)%100===0);
      const expectedCount=hasDesignL1?designRefs.length-1:designRefs.length;
      const actualInnerCount=l1Refs.length>0?nodes.length-l1Refs.length:nodes.length;
      
      if(expectedCount>0&&actualInnerCount<expectedCount){
        issues.push({severity:'WARNING',rule:'R7',message:`도 ${figNum}: 설계상 내부 구성요소 ${expectedCount}개인데 ${actualInnerCount}개만 파싱됨 (노드 누락 가능)`});
      }
    }
  }
  
  } // end if(!isMethodFig) — 장치 도면 전용 규칙 끝
  
  // ═══ R8. 방법 도면 검증 ═══
  const sRefs=allRefs.filter(r=>String(r).startsWith('S'));
  if(sRefs.length>0){
    // R8a. 방법 도면에 숫자 참조번호 혼입
    const numericInMethod=allRefs.filter(r=>!String(r).startsWith('S')&&!String(r).startsWith('D'));
    if(numericInMethod.length>0){
      issues.push({severity:'ERROR',rule:'R8a',message:`도 ${figNum}: 방법 도면에 장치 참조번호(${numericInMethod.join(',')}) 혼입`});
    }
    // R8b. 시작/종료 노드 확인
    const hasStart=nodes.some(n=>/시작|START/i.test(n.label));
    const hasEnd=nodes.some(n=>/종료|END/i.test(n.label));
    if(!hasStart)issues.push({severity:'WARNING',rule:'R8b',message:`도 ${figNum}: 흐름도에 "시작" 노드 없음`});
    if(!hasEnd)issues.push({severity:'WARNING',rule:'R8b',message:`도 ${figNum}: 흐름도에 "종료" 노드 없음`});
  }
  
  // ═══ R9. 배치 적절성 검증 (2D 레이아웃 품질) ═══
  if(!isMethodFig&&nodes.length>=3){
    const edgeList=edges||[];
    
    // R9a. 도 1에서 edge 없으면 세로 일렬 폴백 경고
    if(figNum===1&&nodes.length>=4&&edgeList.length===0){
      issues.push({severity:'WARNING',rule:'R9a',message:`도 ${figNum}: 연결관계(edge) 없음 — 구성요소가 세로 일렬 배치됨. Mermaid에서 A --> B 연결 추가 권장`});
    }
    
    // R9b. 허브 노드 감지 (degree ≥ 3) → 2D 배치 적용 안내
    if(edgeList.length>0){
      const adj={};
      nodes.forEach(n=>{adj[n.id]=0;});
      edgeList.forEach(e=>{if(adj[e.from]!==undefined)adj[e.from]++;if(adj[e.to]!==undefined)adj[e.to]++;});
      const hubNodes=Object.entries(adj).filter(([,deg])=>deg>=3);
      if(hubNodes.length>0&&figNum===1){
        const hubLabels=hubNodes.map(([id])=>{const nd=nodes.find(n=>n.id===id);return nd?_safeCleanLabel(nd.label):id;});
        issues.push({severity:'INFO',rule:'R9b',message:`도 ${figNum}: 허브 노드(${hubLabels.join(',')}) 감지 → BFS 기반 2D 배치 적용`});
      }
    }
    
    // R9c. 네트워크/통신 노드 중앙 허브 배치 확인
    const networkNodes=nodes.filter(n=>/네트워크|통신망|인터넷|클라우드/.test(n.label));
    if(networkNodes.length>0&&figNum===1){
      issues.push({severity:'INFO',rule:'R9c',message:`도 ${figNum}: 네트워크 노드(${networkNodes.length}개) 존재 → 허브 중심 배치 활성`});
    }
    
    // R9d. 순차 연결만 있는 경우 (A→B→C→D) 세로 배치 적절
    if(edgeList.length===nodes.length-1&&figNum===1){
      const adj2={};nodes.forEach(n=>{adj2[n.id]=0;});
      edgeList.forEach(e=>{if(adj2[e.from]!==undefined)adj2[e.from]++;if(adj2[e.to]!==undefined)adj2[e.to]++;});
      const maxDeg=Math.max(...Object.values(adj2));
      if(maxDeg<=2){
        issues.push({severity:'INFO',rule:'R9d',message:`도 ${figNum}: 순차 연결 토폴로지 → 세로 배치 적용 (적절)`});
      }
    }
    
    // R10. 도면 품질 검증
    // R10a는 R12와 중복되어 제거 (R12가 더 정확한 extractRef/isL1 사용)

    // R10b. 같은 행에 4개 이상 노드 검증
    if(edgeList.length>0){
      const layout=computeDeviceLayout2D(nodes,edgeList,figNum);
      if(layout.layers){
        layout.layers.forEach((layer,rowIdx)=>{
          const _realLen=layer.filter(x=>x!==null).length; // null 슬롯 제외
          if(_realLen>3){
            issues.push({severity:'WARNING',rule:'R10b',message:`도 ${figNum}: 행${rowIdx+1}에 ${_realLen}개 노드 — 최대 3개 권장 (겹침 위험)`});
          }
        });
      }
    }
  }
  
  // ═══ R11. 순환 참조 검출 (위상 정렬 전제 조건) ═══
  // ★ v12 FIX: edgeList 스코프 버그 — edges 파라미터 직접 사용 ★
  const _r11Edges=edges||[];
  if(_r11Edges.length>0&&figNum>1){
    const _adj2={};
    nodes.forEach(nd=>{_adj2[nd.id]=new Set();});
    _r11Edges.forEach(e=>{if(_adj2[e.from])_adj2[e.from].add(e.to);});
    const _inDeg={};
    nodes.forEach(nd=>{_inDeg[nd.id]=0;});
    _r11Edges.forEach(e=>{_inDeg[e.to]=(_inDeg[e.to]||0)+1;});
    const _q=nodes.map(nd=>nd.id).filter(id=>_inDeg[id]===0);
    let _visited=0;
    const _q2=[..._q];
    while(_q2.length>0){
      const cur=_q2.shift();_visited++;
      (_adj2[cur]||new Set()).forEach(next=>{_inDeg[next]--;if(_inDeg[next]===0)_q2.push(next);});
    }
    if(_visited<nodes.length){
      issues.push({severity:'WARNING',rule:'R11',message:`도 ${figNum}: 순환 참조 감지 — 데이터 흐름이 단방향이 되도록 연결 방향을 수정하라`});
    }
  }
  
  // ═══ R12. 도 2+ 내부 구성요소 수량 제한 (3~5개) ═══ [v13.0]
  // 프롬프트 규칙(L2123-2128)의 코드 측 강제 검증
  if(figNum>1&&!isMethodFig){
    const _innerNodes=nodes.filter(n=>{
      const ref=extractRef(n.label);
      if(!ref)return true;
      return !isL1(ref); // L1(프레임) 제외
    });
    const _innerCount=_innerNodes.length;
    if(_innerCount>5){
      issues.push({severity:'ERROR',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 ${_innerCount}개 (최대 5개 초과). 핵심 3~5개만 남기고 나머지는 다음 도면으로 분리 필요.`});
    }else if(_innerCount===1){
      issues.push({severity:'ERROR',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 1개 — 최소 3개 필요. 다른 도면과 병합하라.`});
    }else if(_innerCount===2){
      issues.push({severity:'WARNING',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 2개 (최소 3개 권장). 기능 분리하여 확장 권장.`});
    }
  }
  
  return issues;
}

// ═══ 렌더링 후 시각 검증 (새 기능) ═══
function postRenderValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length)return[];
  
  const autoFigNums=getAutoFigNums(sid);
  const allIssues=[];
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const numRefs=nodes.map(n=>{
      const m=(n.label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      if(!m)return null;
      const val=m[1];
      if(val.startsWith('S')||val.startsWith('s'))return null; // S-접두사 방법 참조는 별도 처리
      return parseInt(val);
    }).filter(n=>n!==null&&!isNaN(n));
    
    const l1s=numRefs.filter(n=>n%100===0);
    const nonL1=numRefs.filter(n=>n%100!==0);
    
    // 검증 V1: L1이 최외곽이 되는 경우, 내부에 L1이 중복 표시되면 안 됨
    if(figNum>1&&l1s.length>1){
      allIssues.push({
        figNum,severity:'WARN',
        message:`도 ${figNum}: L1 노드 ${l1s.length}개 감지(${l1s.join(',')}). 프레임 1개만 사용, 나머지 L1은 내부 표시에서 제외됨`
      });
    }
    
    // 검증 V2: 도 1에 L2/L3가 있으면 안 됨
    if(figNum===1&&nonL1.length>0){
      allIssues.push({
        figNum,severity:'ERROR',
        message:`도 1에 L2/L3 참조번호(${nonL1.join(',')}) 포함`
      });
    }
    
    // 검증 V3: 너무 짧은 라벨 (노드 ID일 가능성)
    nodes.forEach(n=>{
      const cleaned=_safeCleanLabel(n.label||'');
      if(cleaned.length<=2&&!/\d/.test(cleaned)){
        allIssues.push({
          figNum,severity:'WARN',
          message:`도 ${figNum}: 노드 "${n.id}" 라벨이 너무 짧음 ("${cleaned}") — 노드 ID가 라벨로 사용되었을 수 있음`
        });
      }
    });
    
    // 검증 V4: 중복 참조번호
    const refCounts={};
    numRefs.forEach(r=>{refCounts[r]=(refCounts[r]||0)+1;});
    Object.entries(refCounts).forEach(([ref,cnt])=>{
      if(cnt>1){
        allIssues.push({
          figNum,severity:'WARN',
          message:`도 ${figNum}: 참조번호 ${ref}이(가) ${cnt}개 노드에 중복 사용됨`
        });
      }
    });
  });
  
  return allIssues;
}

function renderDiagrams(sid,mt){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11';
  const el=document.getElementById(cid);
  if(!el){console.warn(`[renderDiagrams] DOM element not found: ${cid}`);return;}
  let blocks=extractMermaidBlocks(mt);
  if(!blocks.length){
    el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${App.escapeHtml(mt)}</pre></div>`;
    return;
  }
  
  // v10.3: 도면 수 강제 제한 — 설계 텍스트 또는 UI 설정값 기준
  let expectedCount;
  if(sid==='step_07'){
    const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const fromUI=totalFig-requiredFigures.length;
    // 설계 텍스트에서 실제 도면 수도 확인
    const fromDesign=_extractFigureNumbersFromDesign(outputs[sid]||'').length;
    expectedCount=fromDesign>0?Math.min(fromUI,fromDesign):fromUI;
  }else{
    expectedCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
  }
  if(blocks.length>expectedCount&&expectedCount>0){
    console.warn(`[renderDiagrams] ${sid}: mermaid 블록 ${blocks.length}개 > 예상 ${expectedCount}개 → 초과분 제거`);
    App.showToast(`도면 ${blocks.length}개 생성됨 → ${expectedCount}개로 조정`,'warning');
    blocks=blocks.slice(0,expectedCount);
  }
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  diagramData[sid]=[];
  
  // v10.0: 사용자 도면 스킵 반영 — 블록 수 기반 도면 번호 미리 계산
  const _devC=sid==='step_07'?blocks.length:(diagramData.step_07?.length||0);
  const _methC=sid==='step_11'?blocks.length:0;
  const _cfn=computeFigNums(_devC,_methC,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
  const autoFigNums=sid==='step_07'?_cfn.device:_cfn.method;
  
  // 도면 설계 텍스트 (R7 검증용)
  const designText=outputs[sid]||'';
  
  let html='';
  let allIssues=[];
  let hasErrors=false;
  
  blocks.forEach((code,i)=>{
    const figNum=autoFigNums[i]||(figOffset+i+1);
    const{nodes,edges}=parseMermaidGraph(code);
    const positions=layoutGraph(nodes,edges);
    diagramData[sid].push({nodes,edges,positions});
    
    // 검증 실행 (설계 텍스트 포함)
    const issues=validateDiagramRules(nodes,figNum,designText,edges);
    allIssues.push({figNum,issues});
    if(issues.some(iss=>iss.severity==='ERROR'))hasErrors=true;
    
    // 검증 결과 HTML
    let issuesHtml='';
    const visibleIssues=issues.filter(iss=>iss.severity!=='CHECK');
    if(visibleIssues.length){
      issuesHtml='<div style="margin-bottom:8px">';
      visibleIssues.forEach(iss=>{
        const bg=iss.severity==='ERROR'?'#fee':iss.severity==='WARNING'?'#fff8e1':'#e3f2fd';
        const fg=iss.severity==='ERROR'?'#c62828':iss.severity==='WARNING'?'#f57c00':'#1565c0';
        issuesHtml+=`<div style="font-size:11px;padding:4px 8px;margin:2px 0;border-radius:4px;background:${bg};color:${fg}"><b>${iss.severity}</b> [${iss.rule}]: ${App.escapeHtml(iss.message)}</div>`;
      });
      issuesHtml+='</div>';
    }
    
    html+=`<div class="diagram-container">
      <div class="diagram-label">도 ${figNum}</div>
      ${issuesHtml}
      <div id="diagram_${sid}_${i}" style="background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;overflow-x:auto"></div>
      <details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">Mermaid 코드 보기</summary><pre style="font-size:11px;margin-top:4px;padding:8px;background:var(--color-bg-tertiary);border-radius:8px;overflow-x:auto">${App.escapeHtml(code)}</pre></details>
    </div>`;
  });
  
  // 에러 발견 시 재생성 버튼
  if(hasErrors){
    const errorSummary=allIssues.filter(ai=>ai.issues.some(iss=>iss.severity==='ERROR'))
      .map(ai=>`도 ${ai.figNum}: ${ai.issues.filter(iss=>iss.severity==='ERROR').map(iss=>`[${iss.rule}] ${iss.message}`).join('; ')}`)
      .join('\n');
    window._diagramErrors={sid,errors:errorSummary};
    html=`<div style="background:#FEECEC;border:1px solid #FF6363;border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="color:var(--dt-danger);font-weight:600;margin-bottom:8px"><span class="ico" data-icon="warning"></span> 도면 규칙 위반 발견</div>
      <div style="font-size:12px;color:#b71c1c;margin-bottom:12px;white-space:pre-line">${App.escapeHtml(errorSummary)}</div>
      <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:var(--dt-brand-hover);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px"><span class="ico" data-icon="refresh"></span> 규칙에 맞게 재생성</button>
    </div>`+html;
  }
  
  html+=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-secondary);border-radius:8px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button onclick="runDiagramValidation('${sid}')" style="background:var(--dt-success);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="R0~R14 규칙 검증 + 시각적 겹침/잘림 검사"><span class="ico" data-icon="check-circle"></span> 검증</button>
      <span style="color:var(--color-text-tertiary);font-size:11px">\u2192</span>
      <button onclick="runAIDiagramReview('${sid}')" style="background:#7b1fa2;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="AI가 연결관계의 기술적 적절성을 평가"><span class="ico" data-icon="robot"></span> AI 검증</button>
      <span style="color:var(--color-text-tertiary);font-size:11px">\u2192</span>
      <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:var(--dt-brand-hover);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="검증 결과를 반영하여 도면 재생성 (검증 미실행 시 자동 실행)"><span class="ico" data-icon="refresh"></span> 재생성</button>
      <span id="validationResult_${sid}" style="font-size:12px;color:var(--color-text-secondary);margin-left:4px"></span>
    </div>
    <div id="aiReviewResult_${sid}" style="margin-top:8px"></div>
  </div>`;
  
  el.innerHTML=html;

  // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 — 블록 크기 통일 ★
  let globalMaxInnerCols=1;
  blocks.forEach((code,i)=>{
    const figNum=autoFigNums[i]||(figOffset+i+1);
    const{nodes,edges}=diagramData[sid][i];
    const allL1=nodes.every(n=>_sharedIsL1RefNum(_sharedExtractRefNum(n.label,'')));
    const isFig1=figNum===1||allL1;
    if(isFig1)return;
    const allRefsPC=nodes.map(n=>_sharedExtractRefNum(n.label,'')).filter(Boolean);
    let pcFrameRef=_sharedFindImmediateParent(allRefsPC);
    if(!pcFrameRef&&allRefsPC.length>0){const fr=parseInt(allRefsPC[0])||100;pcFrameRef=Math.floor(fr/100)*100;}
    if(!pcFrameRef)pcFrameRef=100;
    const innerNodes=nodes.filter(n=>{
      const ref=_sharedExtractRefNum(n.label,'');
      if(!ref)return true;
      const num=parseInt(ref);
      if(isNaN(num))return true;
      if(num===pcFrameRef)return false;
      if(_sharedIsL1RefNum(ref))return false;
      return true;
    });
    if(innerNodes.length===0)return;
    const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
    if(layout.maxCols>globalMaxInnerCols)globalMaxInnerCols=layout.maxCols;
  });
  console.log(`[v18.2] globalMaxInnerCols=${globalMaxInnerCols}`);

  // SVG 렌더링
  blocks.forEach((code,i)=>{
    const{nodes,edges,positions}=diagramData[sid][i];
    renderDiagramSvg(`diagram_${sid}_${i}`,nodes,edges,positions,autoFigNums[i]||(figOffset+i+1),null,globalMaxInnerCols);
  });
  
  // ★ v10.4: 포스트 렌더 검증 — SVG DOM 기반 겹침/잘림/연결 자동 검증+보정 ★
  // requestAnimationFrame으로 DOM paint 완료 후 실행
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      try{
        _runPostRenderValidation(sid, autoFigNums);
      }catch(e){
        console.error('[PostRender] 검증 오류:',e);
      }
    },50); // 브라우저 레이아웃 안정 대기
  });
}

// ═══ 도면 검증 실행 함수 ═══
function runDiagramValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length){
    App.showToast('검증할 도면이 없습니다.','error');
    return;
  }
  
  const autoFigNums=getAutoFigNums(sid);
  const designText=outputs[sid]||'';
  let totalErrors=0,totalWarnings=0;
  let reportHtml='';
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const issues=validateDiagramRules(nodes,figNum,designText,edges);
    const errors=issues.filter(i=>i.severity==='ERROR');
    const warnings=issues.filter(i=>i.severity==='WARNING');
    const infos=issues.filter(i=>i.severity==='INFO');
    totalErrors+=errors.length;
    totalWarnings+=warnings.length;
    
    if(errors.length||warnings.length){
      reportHtml+=`<div style="margin:4px 0"><b>도 ${figNum}:</b> `;
      errors.forEach(e=>reportHtml+=`<span style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> [${e.rule}] ${e.message} </span>`);
      warnings.forEach(w=>reportHtml+=`<span style="color:var(--dt-warning);font-size:11px"><span class="ico" data-icon="warning"></span> [${w.rule}] ${w.message} </span>`);
      reportHtml+='</div>';
    }else{
      reportHtml+=`<div style="margin:4px 0;color:var(--dt-success)"><b>도 ${figNum}:</b> <span class="ico" data-icon="check-circle"></span>  통과 ${infos.map(i=>`(${i.message})`).join(' ')}</div>`;
    }
  });

  // ═══ R14. 레벨 건너뛰기(L2-skip) — 전체 도면 세트 교차 검증 ═══
  {
    const _extractRef=label=>{
      const m=(label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      return m?m[1]:null;
    };
    const _refLevel=r=>{
      if(!r||String(r).startsWith('S'))return null;
      const s=String(r);
      const n=s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);
      if(isNaN(n))return null;
      if(n<100)return 'small';
      if(n%100===0)return 'L1';
      if(n%10===0)return 'L2';
      if(n<1000)return 'L3';
      return 'L4';
    };
    data.forEach(({nodes},idx)=>{
      const figNum=autoFigNums[idx]||(idx+1);
      if(figNum===1)return;
      const innerNodes=nodes.filter(n=>{
        const ref=_extractRef(n.label);
        if(!ref)return false;
        if(String(ref).startsWith('S'))return false;
        return !_isL1RefNum(ref);
      });
      const levels=new Set();
      innerNodes.forEach(n=>{
        const ref=_extractRef(n.label);
        const lv=_refLevel(ref);
        if(lv&&lv!=='small')levels.add(lv);
      });
      if(levels.size>1){
        const mixed=[...levels].sort().join('+');
        totalErrors++;
        reportHtml+=`<div style="margin:4px 0"><b>도 ${figNum}:</b> <span style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> [R14] 레벨 혼재(${mixed}) — 한 도면 내부는 동일 레벨이어야 함</span></div>`;
      }
    });
  }

  const resultEl=document.getElementById(`validationResult_${sid}`);
  if(resultEl){
    if(totalErrors===0&&totalWarnings===0){
      resultEl.innerHTML=`<span style="color:var(--dt-success);font-weight:600"><span class="ico" data-icon="check-circle"></span> 전체 검증 통과 (${data.length}개 도면)</span>`;
    }else{
      resultEl.innerHTML=`<div>
        <span style="color:var(--dt-danger);font-weight:600"><span class="ico" data-icon="x"></span> 오류 ${totalErrors}건</span>,
        <span style="color:var(--dt-warning)"><span class="ico" data-icon="warning"></span> 경고 ${totalWarnings}건</span>
        <div style="margin-top:6px;font-size:11px">${reportHtml}</div>
      </div>`;
    }
  }

  if(totalErrors>0){
    App.showToast(`도면 검증: 오류 ${totalErrors}건 발견. 재생성 권장.`,'error');
  }else if(totalWarnings>0){
    App.showToast(`도면 검증: 경고 ${totalWarnings}건 (수정 권장)`);
  }else{
    App.showToast(`도면 검증 통과 ✅ (${data.length}개 도면)`);
  }
  
  // ★ v10.4: 포스트 렌더 검증도 실행 (시각적 겹침/잘림 검사) ★
  try{
    const prResult=_runPostRenderValidation(sid, autoFigNums);
    if(prResult&&prResult.totalIssues>0){
      const prErrors=prResult.reports.reduce((s,r)=>s+r.issues.filter(i=>i.severity==='ERROR').length,0);
      const prWarns=prResult.reports.reduce((s,r)=>s+r.issues.filter(i=>i.severity==='WARNING').length,0);
      if(prErrors>0||prWarns>0){
        reportHtml+=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee"><b><span class="ico" data-icon="search"></span> 시각적 검증:</b> `;
        if(prErrors>0)reportHtml+=`<span style="color:var(--dt-danger)">겹침 ${prErrors}건 </span>`;
        if(prWarns>0)reportHtml+=`<span style="color:var(--dt-warning)">잘림/넘침 ${prWarns}건 </span>`;
        prResult.reports.forEach(r=>{
          r.issues.forEach(i=>{
            const c=i.severity==='ERROR'?'#c62828':'#f57c00';
            reportHtml+=`<div style="font-size:10px;color:${c};margin-left:12px">[${i.type}] ${i.msg}</div>`;
          });
        });
        reportHtml+='</div>';
        if(resultEl)resultEl.innerHTML=resultEl.innerHTML.replace('</div>',reportHtml+'</div>');
      }
    }
  }catch(e){console.error('[PostRender validation error]',e);}

  // ★ v18: 검증 결과를 window._diagramErrors에 저장 — 재생성 시 참조 ★
  if(totalErrors>0||totalWarnings>0){
    const allErrorSummary=[];
    data.forEach(({nodes,edges},idx)=>{
      const figNum=autoFigNums[idx]||(idx+1);
      const issues=validateDiagramRules(nodes,figNum,designText,edges);
      issues.filter(i=>i.severity==='ERROR'||i.severity==='WARNING').forEach(i=>{
        allErrorSummary.push(`도 ${figNum}: [${i.rule}] ${i.message}`);
      });
    });
    try{
      const prResult=_runPostRenderValidation(sid, autoFigNums);
      if(prResult){
        prResult.reports.forEach(r=>{
          r.issues.filter(i=>i.severity==='ERROR').forEach(i=>{
            allErrorSummary.push(`도 ${r.figNum}: [시각적] ${i.msg}`);
          });
        });
      }
    }catch(e){}
    window._diagramErrors={sid, errors:allErrorSummary.join('\n')};
  }else{
    if(window._diagramErrors&&window._diagramErrors.sid===sid){
      window._diagramErrors=null;
    }
  }
}

// ═══ AI 정성적 도면 검증 (연결관계 적절성 평가) ═══
async function runAIDiagramReview(sid){
  const data=diagramData[sid];
  if(!data||!data.length){
    App.showToast('검증할 도면이 없습니다.','error');
    return;
  }

  const resultEl=document.getElementById(`aiReviewResult_${sid}`);
  if(resultEl)resultEl.innerHTML='<div style="padding:12px;background:#f3e5f5;border-radius:8px;font-size:12px;color:#6a1b9a"><span class="ico" data-icon="robot"></span> AI 연결관계 검증 중...</div>';

  const autoFigNums=getAutoFigNums(sid);
  const designText=outputs[sid]||'';

  // ★ v15: 각 도면의 구조 정보 + 레이아웃 통계 수집 ★
  let diagramSummary='';
  const figStats=[];
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const nodeList=nodes.map(n=>{
      const ref=_extractRefNum(n.label,'?');
      const clean=_safeCleanLabel(n.label);
      return `${clean}(${ref})`;
    }).join(', ');
    const edgeList=(edges||[]).map(e=>{
      const fromLabel=nodes.find(n=>n.id===e.from)?.label||e.from;
      const toLabel=nodes.find(n=>n.id===e.to)?.label||e.to;
      return `${_safeCleanLabel(fromLabel)} → ${_safeCleanLabel(toLabel)}`;
    }).join(', ');
    // 연결 통계
    const degreeMap={};
    nodes.forEach(n=>{degreeMap[n.id]=0;});
    (edges||[]).forEach(e=>{degreeMap[e.from]=(degreeMap[e.from]||0)+1;degreeMap[e.to]=(degreeMap[e.to]||0)+1;});
    const maxDeg=Math.max(0,...Object.values(degreeMap));
    const hubNode=nodes.find(n=>degreeMap[n.id]===maxDeg);
    const isolatedNodes=nodes.filter(n=>degreeMap[n.id]===0);
    // 순환 감지
    const hasCycle=(()=>{
      const visited=new Set(),inStack=new Set();
      const adjMap={};
      (edges||[]).forEach(e=>{if(!adjMap[e.from])adjMap[e.from]=[];adjMap[e.from].push(e.to);});
      function dfs(nid){
        if(inStack.has(nid))return true;
        if(visited.has(nid))return false;
        visited.add(nid);inStack.add(nid);
        for(const next of(adjMap[nid]||[])){if(dfs(next))return true;}
        inStack.delete(nid);return false;
      }
      return nodes.some(n=>dfs(n.id));
    })();
    figStats.push({figNum,nodeCount:nodes.length,edgeCount:(edges||[]).length,maxDeg,hubNode:hubNode?_safeCleanLabel(hubNode.label):'',isolatedCount:isolatedNodes.length,hasCycle});
    diagramSummary+=`\n도 ${figNum}: (노드 ${nodes.length}개, 엣지 ${(edges||[]).length}개${hasCycle?', ⚠️순환감지':''}${isolatedNodes.length>0?`, 고립노드 ${isolatedNodes.length}개`:''})\n  구성요소: ${nodeList}\n  연결관계: ${edgeList||'없음 (병렬 배치)'}\n  허브: ${hubNode?_safeCleanLabel(hubNode.label)+'(연결 '+maxDeg+')':'-'}\n`;
  });

  const prompt=`당신은 15년 경력의 한국 특허 도면 전문가입니다. 아래 도면의 연결관계가 기술적으로 적절한지 평가하고 구체적 개선안을 제시하세요.

═══ 평가 기준 ═══
1. **데이터/정보 도면**: 정보 항목(~정보, ~데이터)은 ${getDeviceSubject()}로 입력되는 것이므로 상호 간 화살표 연결 부적절 → 병렬 배치 적절
2. **장치 블록도**: 하드웨어 구성요소 간 데이터 흐름이 있으면 화살표 연결 적절. 메모리/저장부 같은 수동적 구성은 다른 구성에서 접근하는 방향만 적절
3. **계층 일관성**: 상위+하위 구성이 같은 레벨에 표현 금지 → 하위는 상위 내부에 포함
4. **방법 흐름도**: 단계 간 순서가 논리적이어야 함
5. **연결 효율성**: 불필요한 연결이 많으면 교차가 증가하여 가독성 저하. 핵심 데이터 흐름만 연결
6. **순환 금지**: A→B→C→A 같은 순환 연결은 데이터 흐름이 아님
7. **고립 노드**: 연결 없는 구성요소가 있으면 연결 누락인지 병렬 배치가 맞는지 판단

═══ 도면 설계 ═══
${designText.slice(0,3000)}

═══ 실제 도면 구조 ═══
${diagramSummary}

═══ 출력 형식 (반드시 준수) ═══
각 도면에 대해 아래 형식으로:

[도 N]
판정: ✅ 적절 / ⚠️ 부적절
사유: (구체적 이유)
${'{'}개선안${'}'}:
- (수정할 연결: "A → B 연결 제거" 또는 "A → B 연결 추가" 형식)
- (배치 변경: "A를 중앙 허브로 배치" 형식)

[전체 요약]
(전체 도면의 연결관계 적절성 한 줄 요약)`;

  try{
    const r=await App.callClaude(prompt);
    const reviewText=r.text||'';

    // ★ v15: 구조화된 결과 파싱 ★
    const figResults=[];
    const figBlocks=reviewText.split(/\[도\s*(\d+)\]/g);
    for(let i=1;i<figBlocks.length;i+=2){
      const figNum=parseInt(figBlocks[i]);
      const block=figBlocks[i+1]||'';
      const isOk=/적절/.test(block)&&!/부적절/.test(block);
      const reason=(block.match(/사유[:：]\s*(.+)/)||[])[1]||'';
      // 개선안 추출
      const suggestions=[];
      const sugMatch=block.match(/개선안[\s\S]*?(?=\[도|\[전체|$)/);
      if(sugMatch){
        sugMatch[0].split('\n').forEach(line=>{
          const trimmed=line.replace(/^[-•*]\s*/,'').trim();
          if(trimmed&&!/개선안/.test(trimmed))suggestions.push(trimmed);
        });
      }
      figResults.push({figNum,pass:isOk,reason,suggestions});
    }

    // 결과 표시
    if(resultEl){
      let html='<div style="padding:12px;background:#f3e5f5;border:1px solid #ce93d8;border-radius:8px;margin-top:8px">';
      html+='<div style="font-weight:600;color:#6a1b9a;margin-bottom:8px"><span class="ico" data-icon="robot"></span> AI 연결관계 검증 결과</div>';
      if(figResults.length>0){
        figResults.forEach(fr=>{
          const icon=fr.pass?'✅':'⚠️';
          html+=`<div style="margin-bottom:8px;padding:8px;background:${fr.pass?'#e8f5e9':'#FEF4E6'};border-radius:6px">`;
          html+=`<div style="font-weight:600;font-size:13px">${icon} 도 ${fr.figNum}</div>`;
          if(fr.reason)html+=`<div style="font-size:12px;color:#555;margin-top:2px">${App.escapeHtml(fr.reason)}</div>`;
          if(fr.suggestions.length>0){
            html+='<div style="font-size:11px;color:#6a1b9a;margin-top:4px">';
            fr.suggestions.forEach(s=>{html+=`<div><span class="ico" data-icon="arrow-right"></span> ${App.escapeHtml(s)}</div>`;});
            html+='</div>';
          }
          html+='</div>';
        });
      }else{
        html+=`<pre style="font-size:12px;white-space:pre-wrap;margin:0;color:#4a148c;line-height:1.6">${App.escapeHtml(reviewText)}</pre>`;
      }
      html+='</div>';
      resultEl.innerHTML=html;
    }

    // ★ v15: 부적절 항목 감지 — 구조화된 파싱 우선, 폴백으로 키워드 매칭 ★
    const hasIssues=figResults.length>0?figResults.some(fr=>!fr.pass):(reviewText.includes('부적절')||reviewText.includes('⚠️'));
    if(hasIssues){
      // 개선안을 포함한 상세 리뷰 저장
      const issueDetails=figResults.filter(fr=>!fr.pass).map(fr=>`도 ${fr.figNum}: ${fr.reason}${fr.suggestions.length>0?'\n  '+fr.suggestions.join('\n  '):''}`).join('\n');
      window._aiDiagramReview={sid,review:issueDetails||reviewText,figResults};
      App.showToast('AI 검증: 일부 도면 연결관계 수정 권장','warning');
    }else{
      window._aiDiagramReview=null;
      App.showToast('AI 검증: 모든 도면 연결관계 적절 <span class="ico" data-icon="check-circle"></span>');
    }
  }catch(e){
    if(resultEl)resultEl.innerHTML=`<div style="padding:8px;background:#FEECEC;border-radius:8px;font-size:12px;color:var(--dt-danger)">AI 검증 실패: ${e.message}</div>`;
    App.showToast('AI 검증 실패: '+e.message,'error');
  }
}

function downloadPptx(sid){
  // 라이브러리 체크
  if(typeof PptxGenJS==='undefined'){
    App.showToast('PPTX 라이브러리 로드 안됨. 페이지 새로고침 후 다시 시도해주세요.','error');
    console.error('PptxGenJS not loaded');
    return;
  }
  
  const data=diagramData[sid];
  if(!data||!data.length){
    const mt=outputs[sid+'_mermaid'];
    if(!mt){App.showToast('도면 없음','error');return;}
    const blocks=extractMermaidBlocks(mt);
    if(!blocks.length){App.showToast('Mermaid 코드 없음','error');return;}
    diagramData[sid]=blocks.map(code=>{
      const{nodes,edges}=parseMermaidGraph(code);
      return{nodes,edges,positions:layoutGraph(nodes,edges)};
    });
    return downloadPptx(sid);
  }
  
  App.showToast('PPTX 생성 중...');
  
  try{
    // ═══ KIPO 특허 도면 규칙 v4.1 ═══
    const pptx=new PptxGenJS();
    pptx.defineLayout({name:'A4_PORTRAIT',width:8.27,height:11.69});
    pptx.layout='A4_PORTRAIT';
    
    const autoFigNums=getAutoFigNums(sid);
    const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
    
    const LINE_FRAME=2.0,LINE_BOX=1.5,LINE_ARROW=1.0,SHADOW_OFFSET=0.04;
    const PAGE_MARGIN=0.6,PAGE_W=8.27-PAGE_MARGIN*2,PAGE_H=11.69-PAGE_MARGIN*2;
    const TITLE_H=0.5,AVAILABLE_H=PAGE_H-TITLE_H-0.3;
    
    const extractRefNum=_sharedExtractRefNum;
    const isL1RefNum=_sharedIsL1RefNum;
    const findImmediateParent=_sharedFindImmediateParent;

    // ═══ PPTX Icon Shape Helper ═══
    function addPptxIconShape(slide,type,x,y,w,h,lineW){
      const SO=SHADOW_OFFSET;
      switch(type){
        case 'database':{
          const shp=pptx.shapes.CAN||pptx.shapes.RECTANGLE;
          slide.addShape(shp,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(shp,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'cloud':{
          const shp=pptx.shapes.CLOUD||pptx.shapes.OVAL;
          slide.addShape(shp,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(shp,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'server':{
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          const h3=h/3;
          slide.addShape(pptx.shapes.LINE,{x,y:y+h3,w,h:0,line:{color:'000000',width:lineW*0.5}});
          slide.addShape(pptx.shapes.LINE,{x,y:y+2*h3,w,h:0,line:{color:'000000',width:lineW*0.5}});
          [0.5,1.5,2.5].forEach(m=>{
            slide.addShape(pptx.shapes.OVAL,{x:x+w-0.15,y:y+h3*m-0.04,w:0.08,h:0.08,fill:{color:'000000'},line:{width:0}});
          });
          break;
        }
        case 'monitor':{
          const sh=h*0.75;
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h:sh,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h:sh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW},rectRadius:2});
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w/2-w*0.06,y:y+sh,w:w*0.12,h:h*0.15,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.5}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w/2-w*0.13,y:y+sh+h*0.15,w:w*0.26,h:h*0.05,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.5}});
          break;
        }
        case 'sensor':{
          // Circle body + simplified arc representation
          const cr=Math.min(w*0.28,h*0.38);
          const cx=x+w*0.32-cr, cy=y+h*0.50-cr;
          slide.addShape(pptx.shapes.OVAL,{x:cx+SO,y:cy+SO,w:cr*2,h:cr*2,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.OVAL,{x:cx,y:cy,w:cr*2,h:cr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Inner dot
          const dr=cr*0.25;
          slide.addShape(pptx.shapes.OVAL,{x:x+w*0.32-dr,y:y+h*0.50-dr,w:dr*2,h:dr*2,fill:{color:'000000'},line:{width:0}});
          // Wave arcs (approximate with thin ovals)
          [1.55,2.10,2.65].forEach(m=>{
            const ar=cr*m;
            slide.addShape(pptx.shapes.ARC||pptx.shapes.OVAL,{x:x+w*0.32-ar,y:y+h*0.50-ar,w:ar*2,h:ar*2,fill:{type:'none'},line:{color:'000000',width:lineW*0.5}});
          });
          break;
        }
        case 'antenna':{
          // Pole + base + top ball (simplified)
          const poleX=x+w*0.38;
          const bw=w*0.22,bh=h*0.10;
          // Base
          slide.addShape(pptx.shapes.RECTANGLE,{x:poleX-bw/2,y:y+h*0.82,w:bw,h:bh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Pole
          slide.addShape(pptx.shapes.LINE,{x:poleX,y:y+h*0.18,w:0,h:h*0.64,line:{color:'000000',width:lineW*1.2}});
          // Top ball
          const br=Math.min(w*0.04,h*0.04);
          slide.addShape(pptx.shapes.OVAL,{x:poleX-br,y:y+h*0.18-br,w:br*2,h:br*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'document':{
          // Page with folded corner (simplified as rectangle)
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Fold triangle (approximate with small rectangle at corner)
          const fold=w*0.22;
          slide.addShape(pptx.shapes.RIGHT_TRIANGLE||pptx.shapes.RECTANGLE,{x:x+w-fold,y:y,w:fold,h:fold,fill:{color:'EEEEEE'},line:{color:'000000',width:lineW*0.5},rotate:90});
          break;
        }
        case 'camera':{
          // Camera body + lens (simplified)
          const cbx=x+w*0.05,cby=y+h*0.18,cbw=w*0.80,cbh=h*0.65;
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx+SO,y:cby+SO,w:cbw,h:cbh,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx,y:cby,w:cbw,h:cbh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW},rectRadius:3});
          // Viewfinder
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx+cbw*0.30,y:cby-h*0.10,w:cbw*0.25,h:h*0.12,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.6}});
          // Lens
          const lr=Math.min(cbw,cbh)*0.30;
          slide.addShape(pptx.shapes.OVAL,{x:cbx+cbw*0.50-lr,y:cby+cbh*0.52-lr,w:lr*2,h:lr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'speaker':{
          // Speaker (simplified as rectangles + small driver)
          const sph=h*0.40, spw=w*0.18;
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w*0.10,y:y+h*0.30,w:spw,h:sph,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Cone (larger rect)
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w*0.28,y:y+h*0.12,w:w*0.28,h:h*0.76,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        default:
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
      }
    }
    
    // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 (PPTX) ★
    let _pptxGlobalMaxCols=1;
    data.forEach(({nodes,edges},idx)=>{
      const figNum=autoFigNums[idx]||(figOffset+idx+1);
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      if(figNum===1||allL1)return;
      const pRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      let pFrameRef=findImmediateParent(pRefs);
      if(!pFrameRef&&pRefs.length>0){const fr=parseInt(pRefs[0])||100;pFrameRef=Math.floor(fr/100)*100;}
      if(!pFrameRef)pFrameRef=100;
      const innerNodes=nodes.filter(n=>{const ref=extractRefNum(n.label,'');if(!ref)return true;const num=parseInt(ref);if(num===pFrameRef)return false;if(isL1RefNum(ref))return false;return true;});
      if(!innerNodes.length)return;
      const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
      if(layout.maxCols>_pptxGlobalMaxCols)_pptxGlobalMaxCols=layout.maxCols;
    });

    data.forEach(({nodes,edges},idx)=>{
      const slide=pptx.addSlide({bkgd:'FFFFFF'});
      const figNum=autoFigNums[idx]||(figOffset+idx+1);
      const hasEdges=edges&&edges.length>0;

      slide.addText(`도 ${figNum}`,{
        x:PAGE_MARGIN,y:PAGE_MARGIN,w:2,h:TITLE_H,
        fontSize:14,bold:true,fontFace:'맑은 고딕',color:'000000'
      });
      
      if(!nodes.length)return;
      
      const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
        nodes.some(n=>/시작|종료|START|END/i.test(n.label));
      
      if(isMethodDiagram){
        // ═══ 방법 도면 PPTX v5.4: 중앙선 정렬 + 직선 화살표 ═══
        const boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const normalBoxW=PAGE_W-1.2;
        const startEndBoxW=normalBoxW*0.35;
        const centerX=PAGE_MARGIN+0.3+normalBoxW/2;  // 중앙선
        const nodeCount=nodes.length;
        const boxH=Math.min(0.55,AVAILABLE_H/nodeCount-0.15);
        const boxGap=Math.min(0.4,(AVAILABLE_H-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        
        nodes.forEach((n,i)=>{
          const refNum=extractRefNum(n.label,'');
          const cleanLabel=_safeCleanLabel(n.label);
          const isStartEnd=/시작|종료|START|END/i.test(n.label);
          
          const boxW=isStartEnd?startEndBoxW:normalBoxW;
          const bx=centerX-boxW/2;  // 중앙선 기준 배치
          const by=boxStartY+i*(boxH+boxGap);
          
          // 그림자
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SHADOW_OFFSET,y:by+SHADOW_OFFSET,w:boxW,h:boxH,fill:{color:'000000'},line:{width:0}});
          
          // 박스 (완전 흑백)
          const opts={x:bx,y:by,w:boxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:isStartEnd?LINE_FRAME:LINE_BOX}};
          if(isStartEnd)opts.rectRadius=boxH*0.5*72;
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE||pptx.shapes.RECTANGLE,opts);
          slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:isStartEnd?10:_computeDiagramFontSize(boxW*72,boxH*72,cleanLabel.length),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          // 리더라인 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            const leaderEndX=PAGE_MARGIN+0.3+normalBoxW;
            slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:leaderEndX-(bx+boxW)+0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(refNum),{x:leaderEndX+0.35,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          }
          
          // ★ 화살표: 중앙선 직선 ★
          if(i<nodes.length-1){
            const arrowY1=by+boxH;
            const arrowY2=boxStartY+(i+1)*(boxH+boxGap);
            if(arrowY2>arrowY1+0.05){
              slide.addShape(pptx.shapes.LINE,{x:centerX,y:arrowY1,w:0,h:arrowY2-arrowY1,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle'}});
            }
          }
        });
        return;
      }
      
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      const isFig1=figNum===1||allL1;
      let frameRefNum=findImmediateParent(allRefs);
      if(!frameRefNum&&allRefs.length>0){
        const firstRef=parseInt(allRefs[0])||100;
        frameRefNum=firstRef<100?Math.floor(firstRef/10):Math.floor(firstRef/100)*100;
      }
      if(!frameRefNum)frameRefNum=100;
      const nodeCount=nodes.length;
      
      if(isFig1){
        // ═══ 도 1: 2D 토폴로지 블록도 v13.0 (행별 높이 기반 겹침 방지) ═══
        const layout=computeDeviceLayout2D(nodes,edges,figNum);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=0.35;
        const boxW2D=maxCols<=1?PAGE_W-2.0:maxCols===2?(PAGE_W-2.0-colGap)/2:(PAGE_W-2.0-colGap*2)/3;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=PAGE_MARGIN+0.3;
        const boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const boxH=Math.min(0.55,(AVAILABLE_H-0.15*(numRows-1))/numRows);
        const refNumH=0.25;
        const rowGapBase=0.25;
        
        // ═══ v17: 전역 행 높이 통일 (PPTX) ═══
        let globalRowH=boxH+refNumH;
        const rowMaxShapeH={};
        nodes.forEach(n=>{const gp=grid[n.id];if(!gp)return;const st=matchIconShape(n.label);const sm=_shapeMetrics(st,boxW2D,boxH);const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);const h=Math.max(vb.bottom,boxH)+refNumH;if(h>globalRowH)globalRowH=h;const shapeH=Math.max(sm.sh,boxH);if(!rowMaxShapeH[gp.row]||shapeH>rowMaxShapeH[gp.row])rowMaxShapeH[gp.row]=shapeH;});
        globalRowH=Math.min(globalRowH,(boxH+refNumH)*1.3);
        let globalShapeH=boxH;
        Object.values(rowMaxShapeH).forEach(h=>{if(h>globalShapeH)globalShapeH=h;});
        globalShapeH=Math.min(globalShapeH,boxH*1.3);
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=globalRowH+rowGapBase;}

        // ★ v10.5: 이중 좌표 — 셀 기반 라우팅 + 실제 shape 렌더링 (PPTX) ★
        const nodeBoxes={};
        nodes.forEach(n=>{
          const gp=grid[n.id];
          if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row];
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const pptxDisplayLabel=isFig1?_shortenFig1Label(n.label):_safeCleanLabel(n.label);
          // 실제 shape 복원
          const shapeType=matchIconShape(n.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          // ★ v17: 전역 통일 shape 높이 (PPTX) ★
          const _rowCellH=globalShapeH;
          const sx=bx+sm.dx;
          const sy=by+Math.max(0,(_rowCellH-sm.sh)/2);

          addPptxIconShape(slide,shapeType,sx,sy,sm.sw,sm.sh,LINE_FRAME);
          const fontSize=_computeDiagramFontSize(sm.sw*72,sm.sh*72,pptxDisplayLabel.length);
          // ★ v13.0 FIX: 아이콘 shape 텍스트를 아이콘 하단 아래에 배치 (SVG와 동일 로직) ★
          if(_isIconShape(shapeType)){
            // sensor/antenna/camera/speaker: 아이콘이 전체 영역 차지 → 텍스트를 아이콘 아래에
            const iconBottomY=sy+sm.sh;
            slide.addText(pptxDisplayLabel,{x:sx,y:iconBottomY+0.03,w:sm.sw,h:0.25,fontSize:Math.max(fontSize-1,8),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'top'});
          }else{
            const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
            slide.addText(pptxDisplayLabel,{x:sx+0.04,y:sy,w:sm.sw-0.08,h:textH,fontSize,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          }

          // ★ v14 FIX: 라우팅 nodeBox — 행별 실제 shape 높이 반영 (PPTX) ★
          nodeBoxes[n.id]={x:bx, y:by, w:boxW2D, h:_rowCellH, cx:bx+boxW2D/2, cy:by+_rowCellH/2,
            _sx:sx, _sy:sy, _sw:sm.sw, _sh:sm.sh, _shapeType:shapeType};
        });
        
        // refNum 데이터 수집 — ★ v14 FIX: 실제 shape 위치 기반 ★
        const pptxRefData=[];
        nodes.forEach(n=>{
          const gp=grid[n.id];if(!gp)return;
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const nb=nodeBoxes[n.id];if(!nb)return;
          pptxRefData.push({id:n.id,refNum,sx:nb._sx,by:nb._sy,sw:nb._sw,sh:nb._sh});
        });
        
        // ★ v10.5: Phase 2 — 실제 앵커 기반 edge 라우팅 (PPTX) ★
        // ★ v11.1: PPTX는 인치 좌표 → px용 ROUTE_PAD(15) 대신 인치용 패딩 사용 ★
        const PPTX_PAD=0.08; // 인치: 연결선↔박스 최소 간격
        const edgesToDraw=uniqueEdges.length>0?uniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
        // ★ v12 FIX: allBoxArr 루프 밖 호이스트 ★
        const pAllBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
        
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];
          if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          
          // ★ v11: route 계산 → 충돌 검사 → 우회 ★
          let route;
          if(isH){
            const goR=dx>0;
            const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            if(Math.abs(fromAnc.y-toAnc.y)<0.02){
              route=[fromAnc, toAnc];
            }else{
              const midX=(fromAnc.x+toAnc.x)/2;
              route=[fromAnc,{x:midX,y:fromAnc.y},{x:midX,y:toAnc.y},toAnc];
            }
          }else{
            const goD=dy>0;
            const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            if(Math.abs(fromAnc.x-toAnc.x)<0.02){
              route=[fromAnc, toAnc];
            }else{
              const midY=(fromAnc.y+toAnc.y)/2;
              route=[fromAnc,{x:fromAnc.x,y:midY},{x:toAnc.x,y:midY},toAnc];
            }
          }
          
          // 충돌 검사 (PPTX — 인치 좌표)
          const pExclude=new Set([e.from, e.to]);
          if(_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD)>0){
            const fbA={...fb,id:e.from}, tbA={...tb,id:e.to};
            const altRoute=getOrthogonalRoute(fbA,tbA,pAllBoxArr,PPTX_PAD);
            if(altRoute){
              route=_snapRouteToShapeAnchors(altRoute,fb,tb,0,0,pAllBoxArr,PPTX_PAD/ROUTE_PAD);
              // ★ v12 FIX: 4방향 우회 (상/하/좌/우) — SVG와 동일 ★
              if(_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD)>0){
                const obstacles=pAllBoxArr.filter(b=>!pExclude.has(b.id));
                let bestDetour=null, bestHits=Infinity;
                for(const obs of obstacles){
                  const topY=obs.y-0.15;
                  const botY=obs.y+obs.h+0.15;
                  const leftX=obs.x-0.15;
                  const rightX=obs.x+obs.w+0.15;
                  const fa2=route[0], ta2=route[route.length-1];
                  [
                    [fa2,{x:fa2.x,y:topY},{x:ta2.x,y:topY},ta2],
                    [fa2,{x:fa2.x,y:botY},{x:ta2.x,y:botY},ta2],
                    [fa2,{x:leftX,y:fa2.y},{x:leftX,y:ta2.y},ta2],
                    [fa2,{x:rightX,y:fa2.y},{x:rightX,y:ta2.y},ta2]
                  ].forEach(dt=>{
                    const h=_countRouteCollisions(dt,pAllBoxArr,pExclude,PPTX_PAD);
                    if(h<bestHits){bestHits=h;bestDetour=dt;}
                  });
                }
                if(bestDetour&&bestHits<_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD))route=bestDetour;
              }
            }
          }
          
          // PPTX 라인 그리기 (route 세그먼트별)
          // ★ v12: 화살표 방향 수정 + 바운딩 박스 클램핑 ★
          for(let ri=0;ri<route.length-1;ri++){
            const p1=route[ri], p2=route[ri+1];
            const isLast=ri===route.length-2;
            const isFirst=ri===0;
            const dx12=p2.x-p1.x, dy12=p2.y-p1.y;
            const isHoriz=Math.abs(dx12)>Math.abs(dy12);
            const goPositive=isHoriz?(dx12>=0):(dy12>=0);
            
            const lineOpts={color:'000000',width:LINE_ARROW};
            // 화살표는 route의 양 끝단에만 배치 — 방향 보정
            // PptxGenJS: beginArrow at (x,y), endArrow at (x+w,y+h)
            // Math.min 정규화: (x,y)=작은값 쪽, (x+w,y+h)=큰값 쪽
            if(isFirst){
              if(goPositive)lineOpts.beginArrowType='triangle'; // p1이 작은값 쪽
              else lineOpts.endArrowType='triangle';            // p1이 큰값 쪽
            }
            if(isLast){
              if(goPositive)lineOpts.endArrowType='triangle';   // p2가 큰값 쪽
              else lineOpts.beginArrowType='triangle';           // p2가 작은값 쪽
            }
            // 바운딩 클램핑 (슬라이드 영역 내)
            const cx1=Math.max(0.1,Math.min(p1.x,p2.x));
            const cy1=Math.max(0.1,Math.min(p1.y,p2.y));
            const cw=Math.max(0.001, Math.min(Math.abs(dx12)||0.001, PAGE_W+PAGE_MARGIN*2-cx1-0.1));
            const ch=Math.max(0.001, Math.min(Math.abs(dy12)||0.001, PAGE_H+PAGE_MARGIN*2-cy1-0.1));
            slide.addShape(pptx.shapes.LINE,{x:cx1,y:cy1,w:cw,h:ch,line:lineOpts});
          }
        });
        
        // Phase 3: 지능형 참조번호 배치 (연결 방향 회피)
        const pNodeConnDir={};
        (pptxRefData||[]).forEach(r=>{pNodeConnDir[r.id]={top:false,bottom:false,left:false,right:false};});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          if(!pNodeConnDir[e.from]||!pNodeConnDir[e.to])return;
          const dx=tb.cx-fb.cx,dy=tb.cy-fb.cy;
          if(Math.abs(dy)>=Math.abs(dx)){
            if(dy>0){pNodeConnDir[e.from].bottom=true;pNodeConnDir[e.to].top=true;}
            else{pNodeConnDir[e.from].top=true;pNodeConnDir[e.to].bottom=true;}
          }else{
            if(dx>0){pNodeConnDir[e.from].right=true;pNodeConnDir[e.to].left=true;}
            else{pNodeConnDir[e.from].left=true;pNodeConnDir[e.to].right=true;}
          }
        });
        (pptxRefData||[]).forEach(r=>{
          const dir=pNodeConnDir[r.id]||{};
          const nb=nodeBoxes[r.id];
          // ★ v10.2: _shapeAnchor 기반 정확한 leader line 시작점 ★
          const st=nb?nb._shapeType:'box';
          const _sx=nb?nb._sx:r.sx, _sy=nb?nb._sy:r.by, _sw=nb?nb._sw:r.sw, _sh=nb?nb._sh:r.sh;
          if(!dir.bottom){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'bottom');
            slide.addShape(pptx.shapes.LINE,{x:anc.px,y:anc.py,w:0,h:0.12,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px-0.3,y:anc.py+0.12,w:0.6,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'top'});
          }else if(!dir.right){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'right');
            slide.addShape(pptx.shapes.LINE,{x:anc.px,y:anc.py,w:0.15,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px+0.15,y:anc.py-0.1,w:0.5,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          }else if(!dir.left){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'left');
            slide.addShape(pptx.shapes.LINE,{x:anc.px-0.15,y:anc.py,w:0.15,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px-0.65,y:anc.py-0.1,w:0.5,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'right',valign:'middle'});
          }else{
            // 모든 방향 사용 중 → 내부 표시는 slide.addText로 2줄
            slide.addText('('+r.refNum+')',{x:_sx,y:_sy+_sh*0.55,w:_sw,h:0.2,fontSize:9,fontFace:'맑은 고딕',color:'444444',align:'center',valign:'top'});
          }
        });
      }else{
        // 도 2+: 공통 레이아웃 엔진 사용 (v8.0)
        const PPTX_PAD=0.08; // 인치: 연결선↔박스 최소 간격 (v11)
        
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          if(parseInt(ref)===frameRefNum)return false;
          if(isL1RefNum(ref))return false;
          return true;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        const dCount=displayNodes.length;
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;
        // ★ v19: 전체 도면 세트 기준 블록 크기 통일 (PPTX, 정규화) ★
        const _pEffCols=Math.max(innerMaxCols, _pptxGlobalMaxCols);
        const _rawPptxInnerBoxW=_pEffCols===2?(PAGE_W-1.6-0.35)/2:(PAGE_W-1.6-0.35*2)/3;
        const innerBoxW=Math.min(_rawPptxInnerBoxW, 2.8);
        const pBoxH=Math.min(0.65,(AVAILABLE_H-0.7-0.30*(innerNumRows-1))/innerNumRows);

        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,_pEffCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:innerBoxW, boxBaseH:pBoxH,
          colGap:0.55, rowGap:0.50, framePad:0.55,
          shadowSize:SHADOW_OFFSET, scale:1,
          routePad:PPTX_PAD
        });
        
        const frameX=PAGE_MARGIN,frameY=PAGE_MARGIN+TITLE_H;
        const frameW=fig2L.frameW;
        const frameH=fig2L.frameH;
        const refLabelX=frameX+frameW+0.1;
        
        // 외곽 프레임 (테두리만)
        slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
        
        const innerNodeBoxes={};
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const cleanLabel=_safeCleanLabel(nd.label);
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          
          addPptxIconShape(slide,shapeType,sx,by,sm.sw,sm.sh,LINE_BOX);
          const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
          const fontSize=_computeDiagramFontSize(sm.sw*72,sm.sh*72,cleanLabel.length);
          slide.addText([{text:cleanLabel,options:{fontSize,breakType:'none'}},{text:'\n('+refNum+')',options:{fontSize:Math.max(fontSize-1,7),color:'444444'}}],{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2,
            _shapeType:shapeType,_sx:sx,_sy:by,_sw:sm.sw,_sh:sm.sh};
        });
        
        const frameLeaderY=frameY+frameH/2;
        slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:frameLeaderY,w:0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
        slide.addText(String(frameRefNum),{x:refLabelX+0.3,y:frameLeaderY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
        
        // ★ Edge 기반 연결선 (fan 오프셋 겹침 방지) ★
        const innerEdgesToDraw=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        const pInnerFan={};const pInnerOff={};
        innerEdgesToDraw.forEach(e=>{['from','to'].forEach(k=>{const nid=e[k];if(!pInnerFan[nid])pInnerFan[nid]=0;const key=e.from+'_'+e.to;if(!pInnerOff[key])pInnerOff[key]={};pInnerOff[key][k+'Idx']=pInnerFan[nid];pInnerFan[nid]++;});});
        // ★ v12 FIX HIGH-3: allBoxArr를 루프 밖으로 호이스트 ★
        const pAllInnerBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
        innerEdgesToDraw.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const key=e.from+'_'+e.to;
          const fanF=pInnerFan[e.from]||1,fanT=pInnerFan[e.to]||1;
          const iF=pInnerOff[key]?.fromIdx||0,iT=pInnerOff[key]?.toIdx||0;
          const offF=fanF>1?(iF-((fanF-1)/2))*0.08:0;
          const offT=fanT>1?(iT-((fanT-1)/2))*0.08:0;
          // ★ v11: 충돌 검사 기반 라우팅 ★
          const fbA={...fb};const tbA={...tb};
          const pts=getConnectionPoints(fbA,tbA);
          if(!pts)return;
          
          let route;
          const dx2=pts.x2-pts.x1,dy2=pts.y2-pts.y1;
          if(Math.abs(dx2)<0.01){
            route=[{x:pts.x1,y:pts.y1},{x:pts.x2,y:pts.y2}];
          }else if(Math.abs(dy2)<0.01){
            route=[{x:pts.x1,y:pts.y1},{x:pts.x2,y:pts.y2}];
          }else{
            const midY=(pts.y1+pts.y2)/2;
            route=[{x:pts.x1,y:pts.y1},{x:pts.x1,y:midY},{x:pts.x2,y:midY},{x:pts.x2,y:pts.y2}];
          }
          
          // 충돌 검사
          const pExclude2=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD)>0){
            const alt=getOrthogonalRoute({...fb,id:e.from},{...tb,id:e.to},pAllInnerBoxArr,PPTX_PAD);
            if(alt){
              // ★ v12 FIX HIGH-2: fan offset 실제 적용 ★
              route=_snapRouteToShapeAnchors(alt,fb,tb,offF,offT,pAllInnerBoxArr,PPTX_PAD/ROUTE_PAD);
              if(_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD)>0){
                const obstacles=pAllInnerBoxArr.filter(b=>!pExclude2.has(b.id));
                let bestDet=null,bestH=Infinity;
                // ★ v12 FIX HIGH-1: 4방향 우회 (상/하/좌/우) — SVG와 동일 ★
                for(const obs of obstacles){
                  const tY=obs.y-0.15,bY=obs.y+obs.h+0.15;
                  const lX=obs.x-0.15,rX=obs.x+obs.w+0.15;
                  const fa=route[0],ta=route[route.length-1];
                  [
                    [fa,{x:fa.x,y:tY},{x:ta.x,y:tY},ta],       // 위 우회
                    [fa,{x:fa.x,y:bY},{x:ta.x,y:bY},ta],       // 아래 우회
                    [fa,{x:lX,y:fa.y},{x:lX,y:ta.y},ta],        // 왼쪽 우회
                    [fa,{x:rX,y:fa.y},{x:rX,y:ta.y},ta]         // 오른쪽 우회
                  ].forEach(dt=>{
                    const h2=_countRouteCollisions(dt,pAllInnerBoxArr,pExclude2,PPTX_PAD);
                    if(h2<bestH){bestH=h2;bestDet=dt;}
                  });
                }
                if(bestDet&&bestH<_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD))route=bestDet;
              }
            }
          }
          
          // PPTX 라인 그리기
          // ★ v12: 화살표 방향 수정 + 바운딩 박스 클램핑 ★
          for(let ri=0;ri<route.length-1;ri++){
            const p1=route[ri],p2=route[ri+1];
            const isLast=ri===route.length-2, isFirst=ri===0;
            const dx12=p2.x-p1.x, dy12=p2.y-p1.y;
            const isHoriz=Math.abs(dx12)>Math.abs(dy12);
            const goPositive=isHoriz?(dx12>=0):(dy12>=0);
            
            const lineOpts={color:'000000',width:LINE_ARROW};
            if(isFirst){
              if(goPositive)lineOpts.beginArrowType='triangle';
              else lineOpts.endArrowType='triangle';
            }
            if(isLast){
              if(goPositive)lineOpts.endArrowType='triangle';
              else lineOpts.beginArrowType='triangle';
            }
            const cx1=Math.max(0.1,Math.min(p1.x,p2.x));
            const cy1=Math.max(0.1,Math.min(p1.y,p2.y));
            const cw=Math.max(0.001, Math.min(Math.abs(dx12)||0.001, PAGE_W+PAGE_MARGIN*2-cx1-0.1));
            const ch=Math.max(0.001, Math.min(Math.abs(dy12)||0.001, PAGE_H+PAGE_MARGIN*2-cy1-0.1));
            slide.addShape(pptx.shapes.LINE,{x:cx1,y:cy1,w:cw,h:ch,line:lineOpts});
          }
        });
      }
    });
    
    // ★ T4: 사용자 도면(이미지) 슬라이드 추가 — 장치 도면(step_07) PPTX 에만(중복 방지). base64 fileDataUrl 재사용(비전 불필요).
    if(sid==='step_07'){try{_appendUserFigureSlides(pptx);}catch(_uf){console.warn('user figure slides skip:',_uf);}}
    const fileName=selectedTitle||selectedTitleEn||'도면';
    pptx.writeFile({fileName:`${fileName}_도면_${new Date().toISOString().slice(0,10)}.pptx`})
      .then(()=>App.showToast('PPTX 다운로드 완료'))
      .catch(err=>{
        console.error('PPTX 저장 실패:',err);
        App.showToast('PPTX 저장 실패: '+err.message,'error');
      });
  }catch(e){
    console.error('PPTX 생성 실패:',e);
    App.showToast('PPTX 생성 실패: '+e.message,'error');
  }
}

// ═══ 이미지 다운로드 (KIPO 규격 JPEG/TIF) ═══
// [고해상도] 800×1000 / 1360×1000 → 3배 확대 (2400×3000 / 4080×3000)
//   ctx.scale(SCALE,SCALE)로 좌표계 보존 → 기존 그리기 코드 무수정
const _IMG_DL_SCALE=3;

// Canvas → 진짜 TIFF Blob 변환 (UTIF v3.1.0)
//   기존: TIF 요청 시 PNG로 저장 (확장자만 .png) — 가짜 TIFF
//   수정: UTIF.encodeImage로 진짜 TIFF (image/tiff)
function _canvasToTiffBlob(canvas){
  if(typeof UTIF==='undefined'){console.warn('[TIFF] UTIF 라이브러리 없음 — 출력 생략');return null;}
  try{
    const ctx=canvas.getContext('2d');
    const w=canvas.width, h=canvas.height;
    const imgData=ctx.getImageData(0,0,w,h);
    const tiffArr=UTIF.encodeImage(imgData.data.buffer,w,h);
    return new Blob([tiffArr],{type:'image/tiff'});
  }catch(e){console.error('[TIFF] 인코딩 실패:',e);return null;}
}

function downloadDiagramImages(sid, format='jpeg'){
  console.log('downloadDiagramImages called:', sid, format);
  
  let data=diagramData[sid];
  if(!data||!data.length){
    const mt=outputs[sid+'_mermaid'];
    if(!mt){App.showToast('도면 없음','error');return;}
    const blocks=extractMermaidBlocks(mt);
    if(!blocks.length){App.showToast('Mermaid 코드 없음','error');return;}
    diagramData[sid]=blocks.map(code=>{
      const{nodes,edges}=parseMermaidGraph(code);
      return{nodes,edges,positions:layoutGraph(nodes,edges)};
    });
    data=diagramData[sid];
  }
  
  const autoFigNums=getAutoFigNums(sid);
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const caseNum=selectedTitle||'도면';
  
  const extractRefNum=_sharedExtractRefNum;
  const isL1RefNum=_sharedIsL1RefNum;
  const findImmediateParent=_sharedFindImmediateParent;

  App.showToast(`도면 이미지 생성 중... (${data.length}개)`);

  // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 (Canvas) ★
  let _canvasGlobalMaxCols=1;
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(figOffset+idx+1);
    const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
    if(figNum===1||allL1)return;
    const cRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
    let cFrameRef=findImmediateParent(cRefs);
    if(!cFrameRef&&cRefs.length>0){const fr=parseInt(cRefs[0])||100;cFrameRef=Math.floor(fr/100)*100;}
    if(!cFrameRef)cFrameRef=100;
    const innerNodes=nodes.filter(n=>{const ref=extractRefNum(n.label,'');if(!ref)return true;const num=parseInt(ref);if(num===cFrameRef)return false;if(isL1RefNum(ref))return false;return true;});
    if(!innerNodes.length)return;
    const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
    if(layout.maxCols>_canvasGlobalMaxCols)_canvasGlobalMaxCols=layout.maxCols;
  });

  // ★ ZIP 일괄 다운로드 ★
  const zip=typeof JSZip!=='undefined'?new JSZip():null;
  const imageFiles=[];
  let currentIdx=0;
  
  function processNext(){
    if(currentIdx>=data.length){
      // 모든 이미지 생성 완료 → ZIP 다운로드
      if(zip&&imageFiles.length>0){
        imageFiles.forEach(f=>zip.file(f.name,f.blob));
        zip.generateAsync({type:'blob'}).then(blob=>{
          const link=document.createElement('a');
          link.download=`${caseNum}_도면_${format==='tif'?'png':format}.zip`;
          link.href=URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          App.showToast(`도면 ${imageFiles.length}개 ZIP 다운로드 완료`);
        }).catch(e=>{
          App.showToast('ZIP 생성 실패: '+e.message,'error');
          // 폴백: 개별 다운로드
          fallbackIndividualDownload();
        });
      }else{
        // JSZip 없으면 개별 다운로드
        fallbackIndividualDownload();
      }
      return;
    }
    
    const{nodes,edges}=data[currentIdx];
    const figNum=autoFigNums[currentIdx]||(figOffset+currentIdx+1);
    const hasEdges=edges&&edges.length>0;
    
    // 캔버스 생성 — [고해상도] 3배 확대, ctx.scale로 좌표계는 800×1000 유지
    const canvas=document.createElement('canvas');
    const W=800,H=1000;
    canvas.width=W*_IMG_DL_SCALE;
    canvas.height=H*_IMG_DL_SCALE;
    const ctx=canvas.getContext('2d');
    ctx.scale(_IMG_DL_SCALE,_IMG_DL_SCALE);
    
    // 배경 흰색
    ctx.fillStyle='#FFFFFF';
    ctx.fillRect(0,0,W,H);
    
    // 도면 번호
    ctx.fillStyle='#000000';
    ctx.font='bold 16px "맑은 고딕", sans-serif';
    ctx.fillText(`도 ${figNum}`,30,35);
    
    if(nodes.length){
      const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
        nodes.some(n=>/시작|종료|START|END/i.test(n.label));
      
      if(isMethodDiagram){
        // ═══ 방법 도면: 흐름도 (SVG와 동일 스타일) ═══
        const nodeCount=nodes.length;
        const normalBoxW=620;
        const startEndBoxW=248; // 620*0.4, matching SVG ratio 2.0/5.0
        const boxStartX=30,boxStartY=50;
        const centerX=boxStartX+normalBoxW/2; // 340
        const boxH=Math.min(55,(850-10*(nodeCount-1))/nodeCount);
        const boxGap=Math.min(40,(900-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        const SHADOW=3;
        
        nodes.forEach((n,i)=>{
          const refNum=extractRefNum(n.label,'');
          const cleanLabel=_safeCleanLabel(n.label);
          const isStartEnd=/시작|종료|START|END/i.test(n.label);
          
          // ★ 시작/종료는 축소 폭, 모든 박스 중앙 정렬 ★
          const curBoxW=isStartEnd?startEndBoxW:normalBoxW;
          const bx=centerX-curBoxW/2;
          const by=boxStartY+i*(boxH+boxGap);
          
          // 그림자 (시작/종료는 둥근 그림자)
          ctx.fillStyle='#000000';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+SHADOW+r,by+SHADOW);ctx.lineTo(bx+SHADOW+curBoxW-r,by+SHADOW);ctx.quadraticCurveTo(bx+SHADOW+curBoxW,by+SHADOW,bx+SHADOW+curBoxW,by+SHADOW+r);
            ctx.lineTo(bx+SHADOW+curBoxW,by+SHADOW+boxH-r);ctx.quadraticCurveTo(bx+SHADOW+curBoxW,by+SHADOW+boxH,bx+SHADOW+curBoxW-r,by+SHADOW+boxH);
            ctx.lineTo(bx+SHADOW+r,by+SHADOW+boxH);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW+boxH,bx+SHADOW,by+SHADOW+boxH-r);
            ctx.lineTo(bx+SHADOW,by+SHADOW+r);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW,bx+SHADOW+r,by+SHADOW);
            ctx.closePath();ctx.fill();
          }else{
            ctx.fillRect(bx+SHADOW,by+SHADOW,curBoxW,boxH);
          }
          
          // ★ 시작/종료도 흰색 배경 (SVG와 일치) ★
          ctx.fillStyle='#FFFFFF';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+r,by);ctx.lineTo(bx+curBoxW-r,by);ctx.quadraticCurveTo(bx+curBoxW,by,bx+curBoxW,by+r);
            ctx.lineTo(bx+curBoxW,by+boxH-r);ctx.quadraticCurveTo(bx+curBoxW,by+boxH,bx+curBoxW-r,by+boxH);
            ctx.lineTo(bx+r,by+boxH);ctx.quadraticCurveTo(bx,by+boxH,bx,by+boxH-r);
            ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);
            ctx.closePath();ctx.fill();ctx.strokeStyle='#000000';ctx.lineWidth=2;ctx.stroke();
          }else{
            ctx.fillRect(bx,by,curBoxW,boxH);
            ctx.strokeStyle='#000000';ctx.lineWidth=1.5;ctx.strokeRect(bx,by,curBoxW,boxH);
          }
          
          ctx.fillStyle='#000000';
          ctx.font='13px "맑은 고딕", sans-serif';
          ctx.textAlign='center';
          ctx.fillText(cleanLabel,centerX,by+boxH/2+4);
          
          // 리더라인 + 부호 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            const leaderEndX=boxStartX+normalBoxW+20;
            ctx.textAlign='left';
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(bx+curBoxW,by+boxH/2);ctx.lineTo(leaderEndX,by+boxH/2);ctx.stroke();
            ctx.font='11px "맑은 고딕", sans-serif';
            ctx.fillText(String(refNum),leaderEndX+10,by+boxH/2+4);
          }
          
          // ★ 단방향 화살표: 항상 중앙선 직선 ★
          if(i<nodes.length-1){
            const arrowY1=by+boxH+2,arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
            if(arrowY2>arrowY1){
              ctx.beginPath();ctx.moveTo(centerX,arrowY1);ctx.lineTo(centerX,arrowY2);ctx.lineWidth=1;ctx.stroke();
              // 아래쪽 화살촉만 (단방향)
              ctx.beginPath();ctx.moveTo(centerX-4,arrowY2-8);ctx.lineTo(centerX,arrowY2);ctx.lineTo(centerX+4,arrowY2-8);ctx.stroke();
            }
          }
        });
      }else{
      // 기존 장치 도면 로직
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      const isFig1=figNum===1||allL1;
      let frameRefNum=findImmediateParent(allRefs);
      if(!frameRefNum&&allRefs.length>0){
        const firstRef=parseInt(allRefs[0])||100;
        frameRefNum=firstRef<100?Math.floor(firstRef/10):Math.floor(firstRef/100)*100;
      }
      if(!frameRefNum)frameRefNum=100;
      const nodeCount=nodes.length;
      const SHADOW=4; // SVG와 일치
      
      // ── Canvas Shape Drawing Helper ──
      function drawCanvasShape(ctx,type,x,y,w,h,shadowOff,strokeW){
        ctx.strokeStyle='#000000';
        switch(type){
          case 'database':{
            const ry=Math.min(h*0.18,w*0.15,22);
            // Shadow
            ctx.fillStyle='#000000';
            ctx.beginPath();ctx.ellipse(x+w/2+shadowOff,y+ry+shadowOff,w/2,ry,0,0,Math.PI*2);ctx.fill();
            ctx.fillRect(x+shadowOff,y+ry+shadowOff,w,h-2*ry);
            ctx.beginPath();ctx.ellipse(x+w/2+shadowOff,y+h-ry+shadowOff,w/2,ry,0,0,Math.PI*2);ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';
            ctx.beginPath();ctx.ellipse(x+w/2,y+h-ry,w/2,ry,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            ctx.fillRect(x,y+ry,w,h-2*ry);
            ctx.beginPath();ctx.moveTo(x,y+ry);ctx.lineTo(x,y+h-ry);ctx.lineWidth=strokeW;ctx.stroke();
            ctx.beginPath();ctx.moveTo(x+w,y+ry);ctx.lineTo(x+w,y+h-ry);ctx.lineWidth=strokeW;ctx.stroke();
            ctx.beginPath();ctx.ellipse(x+w/2,y+ry,w/2,ry,0,0,Math.PI*2);ctx.fillStyle='#FFFFFF';ctx.fill();ctx.stroke();
            break;
          }
          case 'cloud':{
            function cloudPath(ox,oy){
              ctx.beginPath();
              ctx.moveTo(ox+w*0.2,oy+h*0.82);
              ctx.bezierCurveTo(ox+w*0.02,oy+h*0.84,ox,oy+h*0.44,ox+w*0.18,oy+h*0.36);
              ctx.bezierCurveTo(ox+w*0.1,oy+h*0.08,ox+w*0.35,oy,ox+w*0.48,oy+h*0.16);
              ctx.bezierCurveTo(ox+w*0.58,oy-h*0.01,ox+w*0.82,oy+h*0.06,ox+w*0.8,oy+h*0.34);
              ctx.bezierCurveTo(ox+w*0.98,oy+h*0.32,ox+w,oy+h*0.82,ox+w*0.8,oy+h*0.82);
              ctx.closePath();
            }
            // Shadow
            cloudPath(x+shadowOff,y+shadowOff);
            ctx.fillStyle='#000000';ctx.fill();
            // Body
            cloudPath(x,y);
            ctx.fillStyle='#FFFFFF';ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            break;
          }
          case 'server':{
            const h3=h/3,dotR=Math.min(3,h*0.07);
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,h);
            // Body
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,h);
            ctx.lineWidth=strokeW*0.55;
            ctx.beginPath();ctx.moveTo(x,y+h3);ctx.lineTo(x+w,y+h3);ctx.stroke();
            ctx.beginPath();ctx.moveTo(x,y+2*h3);ctx.lineTo(x+w,y+2*h3);ctx.stroke();
            [0.5,1.5,2.5].forEach(m=>{
              ctx.beginPath();ctx.arc(x+w-dotR*4,y+h3*m,dotR,0,Math.PI*2);ctx.fillStyle='#000000';ctx.fill();
            });
            break;
          }
          case 'monitor':{
            const sh=h*0.72,standW=w*0.12,standH=h*0.14,baseW=w*0.25,baseH=h*0.05;
            const sTop=y+sh+h*0.02,bTop=sTop+standH;
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,sh);
            // Screen
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,sh);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,sh);
            // Stand
            ctx.fillRect(x+w/2-standW/2,sTop,standW,standH);ctx.lineWidth=strokeW*0.6;ctx.strokeRect(x+w/2-standW/2,sTop,standW,standH);
            ctx.fillRect(x+w/2-baseW/2,bTop,baseW,baseH);ctx.strokeRect(x+w/2-baseW/2,bTop,baseW,baseH);
            break;
          }
          case 'sensor':{
            const cr=Math.min(w*0.28,h*0.38);
            const scx=x+w*0.32, scy=y+h*0.50;
            // Shadow
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(scx+shadowOff,scy+shadowOff,cr,0,Math.PI*2);ctx.fill();
            // Circle body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(scx,scy,cr,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Inner dot
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(scx,scy,cr*0.25,0,Math.PI*2);ctx.fill();
            // Wave arcs
            ctx.lineWidth=strokeW*0.7;
            [1.55,2.10,2.65].forEach(m=>{
              const ar=cr*m;
              ctx.beginPath();ctx.arc(scx,scy,ar,-Math.PI*0.35,Math.PI*0.35);ctx.stroke();
            });
            break;
          }
          case 'antenna':{
            const poleX=x+w*0.38, topY=y+h*0.18, baseY=y+h*0.82;
            const baw=w*0.22, bah=h*0.10;
            const ballR=Math.min(w*0.04,h*0.04);
            // Base
            ctx.fillStyle='#FFFFFF';ctx.fillRect(poleX-baw/2,baseY,baw,bah);ctx.lineWidth=strokeW;ctx.strokeRect(poleX-baw/2,baseY,baw,bah);
            // Pole
            ctx.lineWidth=strokeW*1.2;ctx.beginPath();ctx.moveTo(poleX,topY+ballR);ctx.lineTo(poleX,baseY);ctx.stroke();
            // Top ball
            ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(poleX,topY,ballR,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Wave arcs
            ctx.lineWidth=strokeW*0.7;
            [0.16,0.26,0.36].forEach(m=>{
              const ar=h*m;
              ctx.beginPath();ctx.arc(poleX,topY,ar,-Math.PI*0.55,-Math.PI*0.05);ctx.stroke();
            });
            break;
          }
          case 'document':{
            const fold=w*0.22;
            // Shadow
            ctx.fillStyle='#000000';ctx.beginPath();
            ctx.moveTo(x+shadowOff,y+shadowOff);ctx.lineTo(x+w-fold+shadowOff,y+shadowOff);ctx.lineTo(x+w+shadowOff,y+fold+shadowOff);ctx.lineTo(x+w+shadowOff,y+h+shadowOff);ctx.lineTo(x+shadowOff,y+h+shadowOff);ctx.closePath();ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();
            ctx.moveTo(x,y);ctx.lineTo(x+w-fold,y);ctx.lineTo(x+w,y+fold);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Fold triangle
            ctx.fillStyle='#EEEEEE';ctx.beginPath();
            ctx.moveTo(x+w-fold,y);ctx.lineTo(x+w-fold,y+fold);ctx.lineTo(x+w,y+fold);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Text lines
            ctx.strokeStyle='#BBBBBB';ctx.lineWidth=strokeW*0.4;
            const lx1=x+w*0.15,lx2=x+w*0.75,ly0=y+h*0.30,gap=h*0.12;
            for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(lx1,ly0+gap*j);ctx.lineTo(lx2-(j===2?w*0.20:0),ly0+gap*j);ctx.stroke();}
            ctx.strokeStyle='#000000';
            break;
          }
          case 'camera':{
            const cbx=x+w*0.05,cby=y+h*0.18,cbw=w*0.80,cbh=h*0.65;
            const lensR=Math.min(cbw,cbh)*0.32;
            const lcx=cbx+cbw*0.50,lcy=cby+cbh*0.52;
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(cbx+shadowOff,cby+shadowOff,cbw,cbh);
            // Body
            ctx.fillStyle='#FFFFFF';
            ctx.beginPath();ctx.roundRect(cbx,cby,cbw,cbh,[4]);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Viewfinder
            ctx.fillRect(cbx+cbw*0.30,cby-h*0.10,cbw*0.25,h*0.12);ctx.lineWidth=strokeW*0.7;ctx.strokeRect(cbx+cbw*0.30,cby-h*0.10,cbw*0.25,h*0.12);
            // Lens outer
            ctx.beginPath();ctx.arc(lcx,lcy,lensR,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Lens inner
            ctx.beginPath();ctx.arc(lcx,lcy,lensR*0.55,0,Math.PI*2);ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Center dot
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(lcx,lcy,lensR*0.15,0,Math.PI*2);ctx.fill();
            break;
          }
          case 'speaker':{
            // Speaker body
            ctx.fillStyle='#000000';ctx.beginPath();
            ctx.moveTo(x+w*0.10+shadowOff,y+h*0.30+shadowOff);ctx.lineTo(x+w*0.28+shadowOff,y+h*0.30+shadowOff);ctx.lineTo(x+w*0.55+shadowOff,y+h*0.08+shadowOff);ctx.lineTo(x+w*0.55+shadowOff,y+h*0.92+shadowOff);ctx.lineTo(x+w*0.28+shadowOff,y+h*0.70+shadowOff);ctx.lineTo(x+w*0.10+shadowOff,y+h*0.70+shadowOff);ctx.closePath();ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();
            ctx.moveTo(x+w*0.10,y+h*0.30);ctx.lineTo(x+w*0.28,y+h*0.30);ctx.lineTo(x+w*0.55,y+h*0.08);ctx.lineTo(x+w*0.55,y+h*0.92);ctx.lineTo(x+w*0.28,y+h*0.70);ctx.lineTo(x+w*0.10,y+h*0.70);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Divider
            ctx.beginPath();ctx.moveTo(x+w*0.28,y+h*0.30);ctx.lineTo(x+w*0.28,y+h*0.70);ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Wave arcs
            const wcx=x+w*0.55,wcy=y+h*0.50;
            ctx.lineWidth=strokeW*0.7;
            [0.22,0.34,0.46].forEach(m=>{const ar=h*m;ctx.beginPath();ctx.arc(wcx,wcy,ar,-Math.PI*0.30,Math.PI*0.30);ctx.stroke();});
            break;
          }
          default:
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,h);
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,h);
        }
      }
      
      if(isFig1){
        // ═══ 도 1: 2D 토폴로지 v13.0 (행별 높이 기반 겹침 방지) ═══
        const layout=computeDeviceLayout2D(nodes,edges,figNum);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=25;
        // v10.3: 셀 너비 확대 (한글 텍스트 수용)
        const boxW2D=maxCols<=1?520:maxCols===2?340:230;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=30;
        const boxStartY=50;
        const boxH=Math.min(55,(850-10*(numRows-1))/numRows);
        const refNumH=22;
        const rowGapBase=25;
        
        // ═══ v17: 전역 행 높이 통일 (Canvas) ═══
        let globalRowH=boxH+refNumH;
        const rowMaxShapeH={};
        nodes.forEach(nd=>{const gp=grid[nd.id];if(!gp)return;const st=matchIconShape(nd.label);const sm=_shapeMetrics(st,boxW2D,boxH);const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);const h=Math.max(vb.bottom,boxH)+refNumH;if(h>globalRowH)globalRowH=h;const shapeH=Math.max(sm.sh,boxH);if(!rowMaxShapeH[gp.row]||shapeH>rowMaxShapeH[gp.row])rowMaxShapeH[gp.row]=shapeH;});
        globalRowH=Math.min(globalRowH,(boxH+refNumH)*1.3);
        let globalShapeH=boxH;
        Object.values(rowMaxShapeH).forEach(h=>{if(h>globalShapeH)globalShapeH=h;});
        globalShapeH=Math.min(globalShapeH,boxH*1.3);
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=globalRowH+rowGapBase;}

        // ★ v10.5: Phase 1 — 이중 좌표: 셀 기반 라우팅 + 실제 shape 렌더링 ★
        const nodeBoxes={};
        const nodeData=[];
        nodes.forEach(nd=>{
          const gp=grid[nd.id];if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row];
          const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
          const cleanLabel=_safeCleanLabel(nd.label);
          const cDisplayLabel=isFig1?_shortenFig1Label(nd.label):cleanLabel;
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          // ★ v17: 전역 통일 shape 높이 (Canvas) ★
          const _rowCellH=globalShapeH;
          const sx=bx+sm.dx;
          const sy=by+Math.max(0,(_rowCellH-sm.sh)/2);
          // 라우팅 nodeBox — 행별 실제 shape 높이 반영
          nodeBoxes[nd.id]={x:bx, y:by, w:boxW2D, h:_rowCellH,
            cx:bx+boxW2D/2, cy:by+_rowCellH/2,
            _shapeType:shapeType, _sx:sx, _sy:sy, _sw:sm.sw, _sh:sm.sh};
          nodeData.push({id:nd.id, sx, sy, sw:sm.sw, sh:sm.sh,
            shapeType, cleanLabel:cDisplayLabel, refNum, row:gp.row, col:gp.col});
        });
        
        // Phase 1.5: 겹침 검증 (실제 shape 높이 기반)
        const REF_PAD=refNumH+4, MIN_GAP=6;
        let fixApplied=true, fixRounds=0;
        while(fixApplied&&fixRounds<10){fixApplied=false;fixRounds++;
          for(let i=0;i<nodeData.length;i++){const a=nodeData[i];const aBot=a.sy+a.sh+REF_PAD;
            for(let j=0;j<nodeData.length;j++){if(i===j)continue;const b=nodeData[j];
              if(a.row===b.row)continue;
              const hOvl=!(a.sx+a.sw+6<b.sx||b.sx+b.sw+6<a.sx);
              if(hOvl&&b.sy<aBot+MIN_GAP&&b.sy>=a.sy){const push=aBot+MIN_GAP-b.sy;
                // ★ v14 FIX: 셀 y도 동일 push 이동 (centering offset 유지) ★
                if(push>0){b.sy+=push;nodeBoxes[b.id].y+=push;nodeBoxes[b.id].cy=nodeBoxes[b.id].y+nodeBoxes[b.id].h/2;nodeBoxes[b.id]._sy=b.sy;fixApplied=true;}}
        }}}
        
        // Phase 2: 연결선 — 실제 shape anchor 기반 라우팅
        function drawCanvasOrthogonalEdge(ctx,route,aLen){
          if(!route||route.length<2)return;
          ctx.lineWidth=1;ctx.strokeStyle='#000000';
          ctx.beginPath();ctx.moveTo(route[0].x,route[0].y);
          for(let i=1;i<route.length;i++)ctx.lineTo(route[i].x,route[i].y);
          ctx.stroke();
          const al=aLen||6;
          [[route[route.length-1],route[route.length-2]],[route[0],route[1]]].forEach(([tip,prev])=>{
            const a=Math.atan2(tip.y-prev.y,tip.x-prev.x);
            ctx.beginPath();ctx.moveTo(tip.x,tip.y);
            ctx.lineTo(tip.x-al*Math.cos(a-0.4),tip.y-al*Math.sin(a-0.4));
            ctx.lineTo(tip.x-al*Math.cos(a+0.4),tip.y-al*Math.sin(a+0.4));
            ctx.closePath();ctx.fillStyle='#000000';ctx.fill();
          });
        }
        
        const edgesToDraw=uniqueEdges.length>0?uniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
        // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (Canvas Fig1) ★
        const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          let route;
          if(isH){
            const goR=dx>0;
            const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            if(Math.abs(fromAnc.y-toAnc.y)<3)route=[fromAnc,toAnc];
            else{const midX=(fromAnc.x+toAnc.x)/2;route=[fromAnc,{x:midX,y:fromAnc.y},{x:midX,y:toAnc.y},toAnc];}
          }else{
            const goD=dy>0;
            const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            if(Math.abs(fromAnc.x-toAnc.x)<3)route=[fromAnc,toAnc];
            else{const midY=(fromAnc.y+toAnc.y)/2;route=[fromAnc,{x:fromAnc.x,y:midY},{x:toAnc.x,y:midY},toAnc];}
          }
          // 충돌 검사
          const excludeIds=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,allBoxArr,excludeIds)>0){
            const fbA={...fb,id:e.from};const tbA={...tb,id:e.to};
            const alt=getOrthogonalRoute(fbA,tbA,allBoxArr);
            if(alt)route=_snapRouteToShapeAnchors(alt,fb,tb,0,0,allBoxArr);
          }
          if(route)drawCanvasOrthogonalEdge(ctx,route,6);
        });
        
        // Phase 3: Shape + 지능형 참조번호 배치 (연결 방향 회피)
        // 3a. 연결 방향 분석
        const nodeConnDir={};
        nodeData.forEach(nd=>{nodeConnDir[nd.id]={top:false,bottom:false,left:false,right:false};});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const dx=tb.cx-fb.cx,dy=tb.cy-fb.cy;
          if(Math.abs(dy)>=Math.abs(dx)){
            if(dy>0){nodeConnDir[e.from].bottom=true;nodeConnDir[e.to].top=true;}
            else{nodeConnDir[e.from].top=true;nodeConnDir[e.to].bottom=true;}
          }else{
            if(dx>0){nodeConnDir[e.from].right=true;nodeConnDir[e.to].left=true;}
            else{nodeConnDir[e.from].left=true;nodeConnDir[e.to].right=true;}
          }
        });
        // 3b. Shape + 참조번호
        nodeData.forEach(nd=>{
          const{id,sx,sy,sw,sh,shapeType,cleanLabel,refNum}=nd;
          drawCanvasShape(ctx,shapeType,sx,sy,sw,sh,SHADOW,2);
          // ★ v10.4: 도 1은 축약 라벨 사용 ★
          const displayLabel=isFig1?_shortenFig1Label(nd.label||cleanLabel):cleanLabel;
          let fontSize=_computeDiagramFontSize(sw,sh,displayLabel.length);
          const cDir=nodeConnDir[id]||{};
          const cRefInside=cDir.top&&cDir.bottom&&cDir.left&&cDir.right;
          const cLabelMaxW=sw*0.90;
          const cLabelCy=cRefInside?_shapeTextCy(shapeType,sy,sh)-4:_shapeTextCy(shapeType,sy,sh);
          const cResult=_canvasMultiLineLabel(ctx,sx+sw/2,cLabelCy,displayLabel,cLabelMaxW,fontSize,{minFontSize:7});
          fontSize=cResult.fontSize;
          // ★ 참조번호: 연결 없는 쪽에 배치 (v10.2: _shapeAnchor 기반) ★
          const dir=nodeConnDir[id]||{};
          ctx.strokeStyle='#000000';ctx.lineWidth=1;ctx.font='11px "맑은 고딕", sans-serif';
          if(!dir.bottom){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'bottom');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px,anc.py+12);ctx.stroke();
            ctx.fillText(String(refNum),anc.px,anc.py+24);
          }else if(!dir.right){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'right');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px+15,anc.py);ctx.stroke();
            ctx.textAlign='left';ctx.fillText(String(refNum),anc.px+17,anc.py+1);
          }else if(!dir.left){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'left');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px-15,anc.py);ctx.stroke();
            ctx.textAlign='right';ctx.fillText(String(refNum),anc.px-17,anc.py+1);
          }else{
            // 모든 방향 사용 중 → Shape 내부에 (참조번호) 표시
            ctx.fillStyle='#444444';ctx.font=`${Math.max(fontSize-1,8)}px "맑은 고딕", sans-serif`;
            ctx.fillText('('+refNum+')',sx+sw/2,_shapeTextCy(shapeType,sy,sh)+fontSize+2);
          }
          ctx.textAlign='left';ctx.textBaseline='alphabetic';
        });
      }else{
        // ═══ 도 2+: 공통 레이아웃 엔진 사용 (v8.0) ═══
        
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          if(parseInt(ref)===frameRefNum)return false;
          if(isL1RefNum(ref))return false;
          return true;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;

        const SHADOW_PX=2;
        const LEADER_W=35, REF_LABEL_W=50;
        // ★ v19: 전체 도면 세트 기준 블록 크기 통일 (Canvas, 정규화) ★
        const _cEffCols=Math.max(innerMaxCols, _canvasGlobalMaxCols);
        const _rawCInnerBoxW=_cEffCols===2?210:155;
        const cInnerBoxW=Math.min(_rawCInnerBoxW, 250);
        const cBoxH=Math.min(55,Math.max(40,(750-60)/Math.max(innerNumRows,1)));

        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,_cEffCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:cInnerBoxW, boxBaseH:cBoxH,
          colGap:60, rowGap:60, framePad:60,
          shadowSize:SHADOW_PX, scale:1
        });
        
        const frameX=30, frameY=50;
        const frameW=fig2L.frameW;
        const frameH=fig2L.frameH;

        // 프레임 렌더링
        ctx.fillStyle='#000000';ctx.fillRect(frameX+SHADOW_PX,frameY+SHADOW_PX,frameW,frameH);
        ctx.fillStyle='#FFFFFF';ctx.fillRect(frameX,frameY,frameW,frameH);
        ctx.strokeStyle='#000000';ctx.lineWidth=2.25;ctx.strokeRect(frameX,frameY,frameW,frameH);
        
        // 연결선 (박스 아래 레이어)
        const innerNodeBoxes={};
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2,
            _shapeType:shapeType,_sx:sx,_sy:by,_sw:sm.sw,_sh:sm.sh};
        });
        
        const innerEdges=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (Canvas Fig2) ★
        const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
        innerEdges.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          let route;
          if(isH){
            const goR=dx>0;
            const fa={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const ta={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            route=Math.abs(fa.y-ta.y)<3?[fa,ta]:[fa,{x:(fa.x+ta.x)/2,y:fa.y},{x:(fa.x+ta.x)/2,y:ta.y},ta];
          }else{
            const goD=dy>0;
            const fa={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const ta={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            route=Math.abs(fa.x-ta.x)<3?[fa,ta]:[fa,{x:fa.x,y:(fa.y+ta.y)/2},{x:ta.x,y:(fa.y+ta.y)/2},ta];
          }
          // 충돌 검사 — ★ v13.0: allBoxArr는 루프 밖에서 1회 생성 ★
          const excludeIds=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,allBoxArr,excludeIds)>0){
            const fbA={...fb,id:e.from};const tbA={...tb,id:e.to};
            const alt=getOrthogonalRoute(fbA,tbA,allBoxArr);
            if(alt)route=_snapRouteToShapeAnchors(alt,fb,tb,0,0,allBoxArr);
          }
          if(!route||route.length<2)return;
          ctx.lineWidth=1;ctx.strokeStyle='#000000';
          ctx.beginPath();ctx.moveTo(route[0].x,route[0].y);
          for(let ri=1;ri<route.length;ri++)ctx.lineTo(route[ri].x,route[ri].y);
          ctx.stroke();
          [[route[route.length-1],route[route.length-2]],[route[0],route[1]]].forEach(([tip,prev])=>{
            const a=Math.atan2(tip.y-prev.y,tip.x-prev.x);
            ctx.beginPath();ctx.moveTo(tip.x,tip.y);
            ctx.lineTo(tip.x-5*Math.cos(a-0.4),tip.y-5*Math.sin(a-0.4));
            ctx.lineTo(tip.x-5*Math.cos(a+0.4),tip.y-5*Math.sin(a+0.4));
            ctx.closePath();ctx.fillStyle='#000000';ctx.fill();
          });
        });

        // 구성요소 박스 렌더링
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const cleanLabel=_safeCleanLabel(nd.label);
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          
          drawCanvasShape(ctx,shapeType,sx,by,sm.sw,sm.sh,SHADOW_PX,1.5);
          // ★ v10.4: 잘림("…") 완전 제거 — 전체 라벨 멀티라인 표시 ★
          const displayLabel=cleanLabel;
          const fontSize=innerMaxCols>2?9:innerMaxCols>1?10:11;
          const textCy=_shapeTextCy(shapeType,by,sm.sh);
          const cLabelMaxW2=sm.sw*0.90;
          const cFit2=_fitLabelLines(displayLabel,cLabelMaxW2,fontSize,7);
          const cLabelYOff2=cFit2.lines.length>1?-6:0;
          _canvasMultiLineLabel(ctx,sx+sm.sw/2,textCy+cLabelYOff2,displayLabel,cLabelMaxW2,fontSize,{minFontSize:7});
          ctx.fillStyle='#444444';ctx.font=`${Math.max(fontSize-1,8)}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';ctx.textBaseline='middle';
          const cRefY2=cFit2.lines.length>1?textCy+cFit2.fontSize+4:textCy+8;
          ctx.fillText('('+refNum+')',sx+sm.sw/2,cRefY2);
          ctx.textAlign='left';ctx.textBaseline='alphabetic';
        });
        
        // 프레임 참조번호
        const frameLeaderEndX=frameX+frameW+LEADER_W;
        const frameLeaderY=frameY+frameH/2;
        ctx.strokeStyle='#000000';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(frameX+frameW,frameLeaderY);ctx.lineTo(frameLeaderEndX,frameLeaderY);ctx.stroke();
        ctx.fillStyle='#000000';ctx.font='11px "맑은 고딕", sans-serif';ctx.textAlign='left';
        ctx.fillText(String(frameRefNum),frameLeaderEndX+6,frameLeaderY+4);
      }
    } // end else (장치 도면)
    } // end if(nodes.length)
    
    // 이미지를 ZIP에 추가 — [진짜 TIFF] tif/tiff 시 UTIF로 인코딩, .tif 확장자
    try{
      const isTiff=(format==='tif'||format==='tiff');
      const ext=isTiff?'tif':(format==='jpeg'?'jpg':format);
      const fileName=`${caseNum}_도${figNum}.${ext}`;

      if(isTiff){
        const blob=_canvasToTiffBlob(canvas);
        if(blob)imageFiles.push({name:fileName,blob:blob});
        currentIdx++;
        setTimeout(processNext,50);
      } else {
        const mimeType=`image/${format==='jpeg'?'jpeg':'png'}`;
        const quality=format==='jpeg'?0.95:undefined;
        canvas.toBlob(blob=>{
          if(blob){
            imageFiles.push({name:fileName,blob:blob});
          }
          currentIdx++;
          setTimeout(processNext,50);
        },mimeType,quality);
      }
    }catch(e){
      console.error('이미지 생성 실패:',e);
      currentIdx++;
      setTimeout(processNext,50);
    }
  }
  
  // 폴백: JSZip 없을 때 개별 다운로드
  function fallbackIndividualDownload(){
    imageFiles.forEach((f,i)=>{
      setTimeout(()=>{
        const link=document.createElement('a');
        link.download=f.name;
        link.href=URL.createObjectURL(f.blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      },i*500);
    });
    App.showToast(`도면 ${imageFiles.length}개 개별 다운로드`);
  }
  
  processNext();
}

// 특허 도면용 레이아웃 계산 (A4 세로)
function layoutGraphForPatent(nodes,edges){
  const positions={};
  const boxW=5.0, boxH=0.7, boxGap=1.0;
  const startX=1.25, startY=1.3;
  
  nodes.forEach((n,i)=>{
    positions[n.id]={
      x:startX,
      y:startY+i*(boxH+boxGap),
      w:boxW,
      h:boxH,
      cx:startX+boxW/2,
      cy:startY+i*(boxH+boxGap)+boxH/2
    };
  });
  return positions;
}
function downloadPptxAll(){if(diagramData.step_07||outputs.step_07_mermaid)downloadPptx('step_07');else App.showToast('도면 없음','error');}

// ═══ v11.0: 예시도/개념도 PPTX 다운로드 ═══
function downloadConceptPptx(){
  const generated=conceptDiagramTypes.filter(ct=>ct.svgContent);
  if(!generated.length){App.showToast('예시도 없음','error');return;}
  if(typeof PptxGenJS==='undefined'){App.showToast('PptxGenJS 미로드','error');return;}
  const cFigNums=getAutoFigNums('step_07c');
  const caseNum=selectedTitle||'도면';
  const pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';

  let completed=0;
  const total=generated.length;

  function processSlide(idx){
    if(idx>=total){
      pptx.writeFile({fileName:`${caseNum}_예시도.pptx`}).then(()=>{
        App.showToast(`예시도 PPTX 다운로드 완료 (${total}슬라이드)`);
      }).catch(e=>App.showToast('PPTX 생성 실패: '+e.message,'error'));
      return;
    }
    const ct=generated[idx];
    const figNum=cFigNums[conceptDiagramTypes.indexOf(ct)]||idx+1;
    const svgStr=_conceptSvgForDisplay(ct, figNum); // ★ ① 다운로드 제목(SoT)+식별번호(도 번호 기반) 동기화

    // SVG→Canvas→PNG base64→PPTX slide
    const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=1360;canvas.height=1000;
      const ctx2=canvas.getContext('2d');
      ctx2.fillStyle='#FFFFFF';ctx2.fillRect(0,0,1360,1000);
      ctx2.drawImage(img,0,0,1360,1000);
      const dataUrl=canvas.toDataURL('image/png');
      const slide=pptx.addSlide();
      slide.addText(`도 ${figNum}`,{x:0.3,y:0.15,fontSize:18,fontFace:'맑은 고딕',bold:true});
      slide.addImage({data:dataUrl,x:0.5,y:0.6,w:12.33,h:6.5});
      URL.revokeObjectURL(url);
      processSlide(idx+1);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);processSlide(idx+1);};
    img.src=url;
  }
  processSlide(0);
}

// ═══ v11.0: 예시도/개념도 이미지 다운로드 ═══
function downloadConceptImages(format='jpeg'){
  const generated=conceptDiagramTypes.filter(ct=>ct.svgContent);
  if(!generated.length){App.showToast('예시도 없음','error');return;}
  const cFigNums=getAutoFigNums('step_07c');
  const caseNum=selectedTitle||'도면';
  const zip=typeof JSZip!=='undefined'?new JSZip():null;
  const images=[];
  let idx=0;

  function processNext(){
    if(idx>=generated.length){
      if(zip&&images.length){
        images.forEach(f=>zip.file(f.name,f.blob));
        zip.generateAsync({type:'blob'}).then(blob=>{
          const a=document.createElement('a');
          a.download=`${caseNum}_예시도_${format}.zip`;
          a.href=URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
          App.showToast(`예시도 ${images.length}개 ZIP 다운로드 완료`);
        });
      }
      return;
    }
    const ct=generated[idx];
    const figNum=cFigNums[conceptDiagramTypes.indexOf(ct)]||idx+1;
    // SVG→Canvas→Image
    const svgStr=_conceptSvgForDisplay(ct, figNum); // ★ ① 다운로드 제목(SoT)+식별번호(도 번호 기반) 동기화
    const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      // [고해상도] 1360×1000 → 4080×3000, ctx.scale로 SVG 재래스터화 시 고해상도 출력
      const canvas=document.createElement('canvas');
      canvas.width=1360*_IMG_DL_SCALE;canvas.height=1000*_IMG_DL_SCALE;
      const ctx2=canvas.getContext('2d');
      ctx2.scale(_IMG_DL_SCALE,_IMG_DL_SCALE);
      ctx2.fillStyle='#FFFFFF';ctx2.fillRect(0,0,1360,1000);
      ctx2.drawImage(img,0,0,1360,1000);

      // [진짜 TIFF] tif 시 UTIF 사용, 확장자도 .tif
      const isTiff=(format==='tif'||format==='tiff');
      const ext=isTiff?'tif':format;
      const handleBlob=(b)=>{
        if(b){
          const fname=`도${figNum}_예시도.${ext}`;
          if(zip)images.push({name:fname,blob:b});
          else{const a=document.createElement('a');a.download=fname;a.href=URL.createObjectURL(b);a.click();URL.revokeObjectURL(a.href);}
        }
        URL.revokeObjectURL(url);
        idx++;
        processNext();
      };

      if(isTiff){
        handleBlob(_canvasToTiffBlob(canvas));
      } else {
        canvas.toBlob(handleBlob,`image/${format}`,0.95);
      }
    };
    img.onerror=()=>{URL.revokeObjectURL(url);idx++;processNext();};
    img.src=url;
  }
  processNext();
}

