Docket._escapeXml = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

// 숫자 → 한글 (예: 5857600 → "오백팔십오만칠천육백")
Docket.toKorean = function(num) {
  if (num === 0 || !num) return '영';
  num = Math.round(num);
  var d = ['','일','이','삼','사','오','육','칠','팔','구'];
  var u = ['','만','억','조'];
  var s = ['','십','백','천'];
  var r = '', neg = num < 0;
  if (neg) num = -num;
  var ui = 0;
  while (num > 0) {
    var chunk = num % 10000;
    if (chunk > 0) {
      var cs = '';
      for (var i = 0; chunk > 0; i++) {
        var dd = chunk % 10;
        if (dd > 0) cs = (dd === 1 && i > 0 ? '' : d[dd]) + s[i] + cs;
        chunk = Math.floor(chunk / 10);
      }
      r = cs + u[ui] + r;
    }
    num = Math.floor(num / 10000);
    ui++;
  }
  return (neg ? '마이너스 ' : '') + r;
};

// 행 XML에서 특정 컬럼 셀의 값을 숫자로 설정 (inlineStr → t="n" 변환)
Docket._setCellNum = function(rowXml, col, value) {
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)');
  return rowXml.replace(re, function(match) {
    var openRe = /^<c r="([A-Z]+\d+)"([^\/>]*)/;
    var m = openRe.exec(match);
    if (!m) return match;
    var ref = m[1];
    var attrs = (m[2] || '').replace(/\s*t="[^"]*"/g, '');
    return '<c r="' + ref + '"' + attrs + ' t="n"><v>' + value + '</v></c>';
  });
};

// 행 XML에서 특정 컬럼 셀의 값을 inlineStr로 설정
Docket._setCellStr = function(rowXml, col, value) {
  var escaped = Docket._escapeXml(value);
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)');
  return rowXml.replace(re, function(match) {
    var openRe = /^<c r="([A-Z]+\d+)"([^\/>]*)/;
    var m = openRe.exec(match);
    if (!m) return match;
    var ref = m[1];
    var attrs = (m[2] || '').replace(/\s*t="[^"]*"/g, '');
    return '<c r="' + ref + '"' + attrs + ' t="inlineStr"><is><t>' + escaped + '</t></is></c>';
  });
};

// 행 XML 복제 시 row/cell 번호 이동 (oldNum → newNum)
Docket._shiftRowXml = function(rowXml, oldNum, newNum) {
  var oldStr = String(oldNum), newStr = String(newNum);
  var out = rowXml.replace(new RegExp('(<row r=")' + oldStr + '(")'), '$1' + newStr + '$2');
  out = out.replace(new RegExp('(<c r="[A-Z]+)' + oldStr + '(")', 'g'), '$1' + newStr + '$2');
  return out;
};

// 행 XML의 <row ...> 열기 태그에 ht/customHeight 속성 설정 (기존 값 있으면 교체)
// 주의: \s+ (0이 아닌 1+ 공백)를 요구해야 customHeight="1" 내부의 ht="1" 부분문자열과
//       충돌하지 않음 (\s*는 0공백도 허용 → customHeig[ht="1"] 파편 발생)
Docket._setRowHeight = function(rowXml, heightPt) {
  return rowXml.replace(/^<row r="(\d+)"([^>]*)>/, function(match, num, attrs) {
    var cleaned = attrs
      .replace(/\s+ht="[^"]*"/g, '')
      .replace(/\s+customHeight="[^"]*"/g, '');
    return '<row r="' + num + '" ht="' + heightPt + '" customHeight="1"' + cleaned + '>';
  });
};

// 행 XML의 <row ...> 열기 태그에 hidden="1" 속성 설정
Docket._setRowHidden = function(rowXml) {
  return rowXml.replace(/^<row r="(\d+)"([^>]*)>/, function(match, num, attrs) {
    var cleaned = attrs.replace(/\s+hidden="[^"]*"/g, '');
    return '<row r="' + num + '" hidden="1"' + cleaned + '>';
  });
};

// drawing1.xml의 <row>N</row> 앵커 참조를 shifts 배열에 따라 보정
//   shifts = [{ threshold, amount }, ...] — 원본 행 번호 기준
//   각 앵커 row에 대해, original >= threshold인 모든 shift의 amount를 합산하여 이동
//   이로써 행 삽입 시 푸터/로고 이미지가 올바른 위치로 따라가고 세로 stretch 방지
Docket._shiftDrawingRows = function(drawingXml, shifts) {
  if (!shifts || shifts.length === 0) return drawingXml;
  return drawingXml.replace(/<row>(\d+)<\/row>/g, function(match, numStr) {
    var num = parseInt(numStr);
    var newNum = num;
    shifts.forEach(function(s) {
      if (num >= s.threshold) newNum += s.amount;
    });
    return '<row>' + newNum + '</row>';
  });
};

// 특정 컬럼의 셀 s(style) 속성 값을 새 인덱스로 교체
Docket._setCellStyleInRow = function(rowXml, col, styleIdx) {
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*>');
  return rowXml.replace(re, function(match) {
    if (/\ss="[^"]*"/.test(match)) {
      return match.replace(/\ss="[^"]*"/, ' s="' + styleIdx + '"');
    }
    return match.replace(/(\/?>)$/, ' s="' + styleIdx + '"$1');
  });
};

// 특정 텍스트를 포함한 행을 찾아 { rowNum, startIdx, endIdx, xml } 반환
Docket._findRowWithText = function(xml, searchText) {
  var mIdx = xml.indexOf(searchText);
  if (mIdx < 0) return null;
  var rowStart = xml.lastIndexOf('<row ', mIdx);
  if (rowStart < 0) return null;
  var rowEnd = xml.indexOf('</row>', mIdx);
  if (rowEnd < 0) return null;
  rowEnd += '</row>'.length;
  var rowXml = xml.substring(rowStart, rowEnd);
  var numMatch = rowXml.match(/^<row r="(\d+)"/);
  if (!numMatch) return null;
  return { rowNum: parseInt(numMatch[1]), startIdx: rowStart, endIdx: rowEnd, xml: rowXml };
};

// 지정된 행 범위의 B~J열 셀에 full thin border를 적용.
//   - 각 셀의 현재 xf를 복제하여 borderId만 full-thin으로 교체 (font/alignment/fill 보존)
//   - 동일한 xf가 여러 번 나타나면 캐시 재사용
//   - styles.xml에 full-thin border가 없으면 새로 추가
//   - skipRows: 건너뛸 행 번호 배열 (얇은 spacer row 등)
// 반환: 수정된 sheetXml
Docket._applyTableBorders = async function(zip, sheetXml, startRow, endRow, skipRows) {
  var stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) return sheetXml;
  var stylesXml = await stylesFile.async('string');

  // 1) full thin border 찾기 또는 추가
  var bordersRe = /<borders count="(\d+)">([\s\S]*?)<\/borders>/;
  var bMatch = bordersRe.exec(stylesXml);
  if (!bMatch) return sheetXml;
  var borderCount = parseInt(bMatch[1]);
  var borderBody = bMatch[2];
  var borders = [];
  var borderIterRe = /<border\b[^>]*?(?:\/>|>[\s\S]*?<\/border>)/g;
  var bm;
  while ((bm = borderIterRe.exec(borderBody)) !== null) {
    borders.push(bm[0]);
  }

  var fullThinBorderId = -1;
  for (var i = 0; i < borders.length; i++) {
    var b = borders[i];
    if (/<left[^/]*style="thin"/.test(b) && /<right[^/]*style="thin"/.test(b) &&
        /<top[^/]*style="thin"/.test(b) && /<bottom[^/]*style="thin"/.test(b)) {
      fullThinBorderId = i;
      break;
    }
  }

  if (fullThinBorderId < 0) {
    var newBorder = '<border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>';
    fullThinBorderId = borderCount;
    stylesXml = stylesXml.replace(bordersRe, '<borders count="' + (borderCount + 1) + '">' + borderBody + newBorder + '</borders>');
  }

  // 2) cellXfs 파싱
  var cellXfsRe = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/;
  var cMatch = cellXfsRe.exec(stylesXml);
  if (!cMatch) { zip.file('xl/styles.xml', stylesXml); return sheetXml; }
  var xfCount = parseInt(cMatch[1]);
  var xfBody = cMatch[2];
  var xfs = [];
  var xfIterRe = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
  var xm;
  while ((xm = xfIterRe.exec(xfBody)) !== null) {
    xfs.push(xm[0]);
  }

  // 3) 캐시: old xf idx → new xf idx (borderId를 full thin으로 교체)
  var xfCloneMap = {};
  var newXfsToAppend = [];
  function getBorderedXfIdx(oldIdx) {
    if (xfCloneMap[oldIdx] != null) return xfCloneMap[oldIdx];
    if (oldIdx >= xfs.length) return oldIdx;
    var oldXf = xfs[oldIdx];
    var newXf;
    if (/borderId="\d+"/.test(oldXf)) {
      newXf = oldXf.replace(/borderId="\d+"/, 'borderId="' + fullThinBorderId + '"');
    } else {
      newXf = oldXf.replace(/<xf\b/, '<xf borderId="' + fullThinBorderId + '"');
    }
    if (!/applyBorder="1"/.test(newXf)) {
      newXf = newXf.replace(/<xf\b/, '<xf applyBorder="1"');
    }
    var newIdx = xfCount + newXfsToAppend.length;
    newXfsToAppend.push(newXf);
    xfCloneMap[oldIdx] = newIdx;
    return newIdx;
  }

  // 4) 대상 범위의 각 행에 대해 B~J 셀의 s 속성 업데이트
  var skipSet = {};
  (skipRows || []).forEach(function(r) { skipSet[r] = true; });
  for (var rn = startRow; rn <= endRow; rn++) {
    if (skipSet[rn]) continue;
    var rowRe = new RegExp('<row r="' + rn + '"[^>]*>[\\s\\S]*?<\\/row>');
    sheetXml = sheetXml.replace(rowRe, function(rowMatch) {
      return rowMatch.replace(/<c r="([A-Z]+)(\d+)"([^>]*?)(\/?)>/g, function(cellMatch, col, rr, attrs, selfClose) {
        if (col < 'B' || col > 'J') return cellMatch;
        if (parseInt(rr) !== rn) return cellMatch;
        var sMatch = attrs.match(/s="(\d+)"/);
        if (!sMatch) return cellMatch;
        var oldIdx = parseInt(sMatch[1]);
        var newIdx = getBorderedXfIdx(oldIdx);
        if (newIdx === oldIdx) return cellMatch;
        var newAttrs = attrs.replace(/s="\d+"/, 's="' + newIdx + '"');
        return '<c r="' + col + rr + '"' + newAttrs + selfClose + '>';
      });
    });
  }

  // 5) 새 xfs append + cellXfs count 갱신 + 저장
  if (newXfsToAppend.length > 0) {
    var newXfCount = xfCount + newXfsToAppend.length;
    stylesXml = stylesXml.replace(cellXfsRe, '<cellXfs count="' + newXfCount + '">' + xfBody + newXfsToAppend.join('') + '</cellXfs>');
  }
  zip.file('xl/styles.xml', stylesXml);
  return sheetXml;
};

// styles.xml에 wrapText 속성이 있는 새 xf(cellXf)를 추가하고 그 인덱스를 반환
// cloneXfIdx가 지정되면 해당 xf를 복제해서 alignment만 수정 (font/border 유지)
Docket._addWrapTextXf = async function(zip, cloneXfIdx) {
  var stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) return null;
  var xml = await stylesFile.async('string');

  var cellXfsRe = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/;
  var match = cellXfsRe.exec(xml);
  if (!match) return null;

  var count = parseInt(match[1]);
  var body = match[2];

  // Parse existing xf elements (self-closing + nested 모두 지원)
  var xfRe = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
  var xfs = [];
  var xm;
  while ((xm = xfRe.exec(body)) !== null) {
    xfs.push(xm[0]);
  }

  // 복제 대상 xf (지정 인덱스 또는 기본값)
  var srcXf = (cloneXfIdx != null && xfs[cloneXfIdx]) ? xfs[cloneXfIdx] :
              '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1" xfId="0"><alignment vertical="top"/></xf>';

  // applyAlignment="1" 속성 보장
  if (!/applyAlignment="1"/.test(srcXf)) {
    srcXf = srcXf.replace(/<xf\b/, '<xf applyAlignment="1"');
  }

  var newXf = srcXf;
  // alignment 속성 수정: vertical="top" + wrapText="1"
  if (/<alignment[^>]*\/>/.test(newXf)) {
    newXf = newXf.replace(/<alignment([^>]*)\/>/, function(m, attrs) {
      var cleaned = attrs.replace(/\s*wrapText="[^"]*"/g, '').replace(/\s*vertical="[^"]*"/g, '');
      return '<alignment' + cleaned + ' vertical="top" wrapText="1"/>';
    });
  } else if (/<alignment[^>]*>/.test(newXf)) {
    newXf = newXf.replace(/<alignment([^>]*)>/, function(m, attrs) {
      var cleaned = attrs.replace(/\s*wrapText="[^"]*"/g, '').replace(/\s*vertical="[^"]*"/g, '');
      return '<alignment' + cleaned + ' vertical="top" wrapText="1">';
    });
  } else {
    // alignment 엘리먼트 없음 → 추가
    if (/<\/xf>$/.test(newXf)) {
      newXf = newXf.replace(/<\/xf>$/, '<alignment vertical="top" wrapText="1"/></xf>');
    } else if (/\/>$/.test(newXf)) {
      newXf = newXf.replace(/\/>$/, '><alignment vertical="top" wrapText="1"/></xf>');
    }
  }

  // cellXfs 뒤에 추가 + count 갱신
  var newIndex = count;
  xml = xml.replace(cellXfsRe, '<cellXfs count="' + (count + 1) + '">' + body + newXf + '</cellXfs>');
  zip.file('xl/styles.xml', xml);
  return newIndex;
};

// XML 내의 모든 row/cell/merge 참조를 threshold 이상이면 amount만큼 이동
// 병합 셀은 span/shift를 적절히 처리 (앞쪽 경계는 유지, 뒤쪽만 증가 → vertical merge 확장)
Docket._shiftXmlRefs = function(xml, threshold, amount) {
  // <row r="N">
  var out = xml.replace(/(<row r=")(\d+)(")/g, function(m, pre, n, post) {
    var num = parseInt(n);
    return num >= threshold ? pre + (num + amount) + post : m;
  });
  // <c r="ColN">
  out = out.replace(/(<c r=")([A-Z]+)(\d+)(")/g, function(m, pre, col, n, post) {
    var num = parseInt(n);
    return num >= threshold ? pre + col + (num + amount) + post : m;
  });
  // <mergeCell ref="C1R1:C2R2"/>
  out = out.replace(/(<mergeCell ref=")([A-Z]+)(\d+)(:)([A-Z]+)(\d+)(")/g, function(m, p1, c1, r1, sep, c2, r2, p2) {
    var rn1 = parseInt(r1), rn2 = parseInt(r2);
    var nr1 = rn1 >= threshold ? rn1 + amount : rn1;
    var nr2 = rn2 >= threshold ? rn2 + amount : rn2;
    return p1 + c1 + nr1 + sep + c2 + nr2 + p2;
  });
  // <dimension ref="C1R1:C2R2"/> — 하단만 확장
  out = out.replace(/(<dimension ref=")([A-Z]+)(\d+)(:)([A-Z]+)(\d+)(")/g, function(m, p1, c1, r1, sep, c2, r2, p2) {
    var rn2 = parseInt(r2);
    var nr2 = rn2 >= threshold ? rn2 + amount : rn2;
    return p1 + c1 + r1 + sep + c2 + nr2 + p2;
  });
  return out;
};

// 마커 이름을 포함한 행을 찾아 { rowNum, startIdx, endIdx, xml } 반환
Docket._findRowWithMarker = function(xml, markerName) {
  var mIdx = xml.search(new RegExp('\\{\\{' + markerName + '\\}\\}'));
  if (mIdx < 0) return null;
  var rowStart = xml.lastIndexOf('<row ', mIdx);
  if (rowStart < 0) return null;
  var rowEnd = xml.indexOf('</row>', mIdx);
  if (rowEnd < 0) return null;
  rowEnd += '</row>'.length;
  var rowXml = xml.substring(rowStart, rowEnd);
  var numMatch = rowXml.match(/^<row r="(\d+)"/);
  if (!numMatch) return null;
  return { rowNum: parseInt(numMatch[1]), startIdx: rowStart, endIdx: rowEnd, xml: rowXml };
};

// 범위 확장: source 행을 items.length번 복제하고 각 복제본에 item 데이터를 채움
// 이후 뒤쪽 행/셀/병합 참조를 shift만큼 이동하고 source 행의 horizontal merge를 복제
Docket._expandRange = function(xml, markerName, items, fillFn) {
  if (!items || items.length === 0) return xml;
  var src = Docket._findRowWithMarker(xml, markerName);
  if (!src) return xml;

  var sourceRow = src.rowNum;
  var shift = items.length - 1;

  // 복제된 행 XML 생성
  var newRows = '';
  for (var i = 0; i < items.length; i++) {
    var rowXml = src.xml;
    if (i > 0) rowXml = Docket._shiftRowXml(rowXml, sourceRow, sourceRow + i);
    rowXml = fillFn(rowXml, items[i], i);
    newRows += rowXml;
  }

  // 원본 행의 horizontal merge 수집 (복제된 행들에 복사해야 함)
  var horizontalMerges = [];
  var mRe = /<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g;
  var mm;
  while ((mm = mRe.exec(xml)) !== null) {
    var r1 = parseInt(mm[2]), r2 = parseInt(mm[4]);
    if (r1 === sourceRow && r2 === sourceRow) {
      horizontalMerges.push({ c1: mm[1], c2: mm[3] });
    }
  }

  // 원본 행을 newRows로 치환
  xml = xml.substring(0, src.startIdx) + newRows + xml.substring(src.endIdx);

  // 뒤쪽 섹션을 shift만큼 이동 (병합 참조 포함)
  if (shift > 0) {
    var afterStart = src.startIdx + newRows.length;
    var before = xml.substring(0, afterStart);
    var after = xml.substring(afterStart);
    after = Docket._shiftXmlRefs(after, sourceRow + 1, shift);
    xml = before + after;

    // 복제된 행들에 새 horizontal merge 생성
    if (horizontalMerges.length > 0) {
      var newMergeXml = '';
      horizontalMerges.forEach(function(hm) {
        for (var k = 1; k <= shift; k++) {
          newMergeXml += '<mergeCell ref="' + hm.c1 + (sourceRow + k) + ':' + hm.c2 + (sourceRow + k) + '"/>';
        }
      });
      xml = xml.replace('</mergeCells>', newMergeXml + '</mergeCells>');
      // mergeCells count 갱신
      var newCount = (xml.match(/<mergeCell /g) || []).length;
      xml = xml.replace(/<mergeCells count="\d+"/, '<mergeCells count="' + newCount + '"');
    }
  }

  return xml;
};

// sheet1.xml 전체 처리 (범위 확장 + 단순 마커 치환)
Docket._processSheetXml = function(xml, data) {
  // 0) NOTES source 행에 B:J 병합 주입 (템플릿에 없으면 추가)
  //    wrapText가 효과를 발휘하려면 노트 셀이 B~J열 전체 폭으로 병합되어야 함.
  //    _expandRange의 horizontal merge 복제 로직이 이 병합을 각 복제 행에 자동 반영.
  var noteSrcForMerge = Docket._findRowWithMarker(xml, 'NOTE_TEXT');
  if (noteSrcForMerge) {
    var r = noteSrcForMerge.rowNum;
    var newMerge = '<mergeCell ref="B' + r + ':J' + r + '"/>';
    if (xml.indexOf(newMerge) < 0) {
      xml = xml.replace('</mergeCells>', newMerge + '</mergeCells>');
      var newCount = (xml.match(/<mergeCell /g) || []).length;
      xml = xml.replace(/<mergeCells count="\d+"/, '<mergeCells count="' + newCount + '"');
    }
  }

  // 1) 범위 확장: NOTES → GOV → FEE (bottom-up)
  //    NOTES 셀에 wrapText 스타일 적용 + 텍스트 길이에 따라 행 높이 자동 조정
  //    B~J 병합 셀 폭 기준 한 줄 약 85자, 줄당 15pt, 최소 15pt
  var wrapIdx = data._wrapStyleIdx;
  xml = Docket._expandRange(xml, 'NOTE_TEXT', (data.notes || []).map(function(n){return {text:n};}),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{NOTES_START\}\}/g, '');
      rowXml = rowXml.replace(/\{\{NOTE_TEXT\}\}/g, Docket._escapeXml(item.text));
      // wrapText 스타일 적용 (B 셀이 B:J 병합의 top-left)
      if (wrapIdx != null) {
        rowXml = Docket._setCellStyleInRow(rowXml, 'B', wrapIdx);
      }
      // 행 높이: 85자 기준, 줄당 15pt, 최소 15pt
      var txt = item.text || '';
      var height = Math.max(15, Math.ceil(txt.length / 85) * 15);
      rowXml = Docket._setRowHeight(rowXml, height);
      return rowXml;
    });

  // 1-2) "3. 상세" 제목 행 높이를 15pt로 고정 (템플릿 기본 4.5pt는 너무 작음)
  //      XML 내 인코딩: "3. &#49345;&#49464;"
  var detailTitleInfo = Docket._findRowWithText(xml, '3. &#49345;&#49464;');
  if (detailTitleInfo) {
    var titleRow = Docket._setRowHeight(detailTitleInfo.xml, 15);
    xml = xml.substring(0, detailTitleInfo.startIdx) + titleRow + xml.substring(detailTitleInfo.endIdx);
  }

  xml = Docket._expandRange(xml, 'GOV_ITEM_NAME', (data.govItems || []),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{GOV_START\}\}/g, '');
      rowXml = Docket._setCellStr(rowXml, 'C', item.name);
      rowXml = Docket._setCellNum(rowXml, 'D', item.unitPrice);
      rowXml = Docket._setCellNum(rowXml, 'E', item.qty);
      rowXml = Docket._setCellNum(rowXml, 'G', item.unitPrice * item.qty);
      return rowXml;
    });

  xml = Docket._expandRange(xml, 'FEE_ITEM_NAME', (data.feeItems || []),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{FEE_START\}\}/g, '');
      rowXml = Docket._setCellStr(rowXml, 'C', item.name);
      rowXml = Docket._setCellNum(rowXml, 'D', item.unitPrice);
      rowXml = Docket._setCellNum(rowXml, 'E', item.qty);
      rowXml = Docket._setCellNum(rowXml, 'G', item.unitPrice * item.qty);
      return rowXml;
    });

  // 2) FEE_END (할인 행) 처리 — FEE 확장 후 아래로 밀려 있음
  //    할인 금액이 0이면 행을 숨김 처리 (실제 청구금액 미입력 시)
  var feeEndInfo = Docket._findRowWithMarker(xml, 'FEE_END');
  if (feeEndInfo) {
    var discRow = feeEndInfo.xml;
    discRow = discRow.replace(/\{\{FEE_END\}\}/g, '');
    var dAmt = data.discountAmount || 0;
    var dQty = data.discountQty || 1;

    if (dAmt !== 0) {
      // 할인 있음 → 값 주입
      discRow = Docket._setCellNum(discRow, 'D', dAmt);
      discRow = Docket._setCellNum(discRow, 'E', dQty);
      discRow = Docket._setCellNum(discRow, 'G', dAmt * dQty);
    } else {
      // 할인 없음 → 행 숨김 (hidden="1"); 셀 값은 건드리지 않음
      discRow = Docket._setRowHidden(discRow);
    }

    xml = xml.substring(0, feeEndInfo.startIdx) + discRow + xml.substring(feeEndInfo.endIdx);
  }

  // 3) 잔여 NOTES_END / GOV_END 마커 클린업
  xml = xml.replace(/\{\{NOTES_END\}\}/g, '');
  xml = xml.replace(/\{\{GOV_END\}\}/g, '');

  // 4) 단순 마커
  var grand = data.grand || 0;

  // 텍스트 마커: {{MARKER}} → 값 (셀 구조 유지)
  var textMarkers = {
    CASE_NUMBER:  data.caseNumber || '',
    DATE:         data.date || '',
    CLIENT_NAME:  data.clientName || '',
    SUBJECT:      data.subject || '',
    CASE_TITLE:   data.caseTitle || '',
    TOTAL_KOREAN: Docket.toKorean(grand) + ' 원정',
  };
  Object.keys(textMarkers).forEach(function(key) {
    var val = Docket._escapeXml(textMarkers[key]);
    xml = xml.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val);
  });

  // 숫자 마커: <c ... t="inlineStr"><is><t>{{MARKER}}</t></is></c> → <c ... t="n"><v>숫자</v></c>
  var numMarkers = {
    TOTAL_AMOUNT:  grand,
    FEE_SUBTOTAL:  data.actualFee || 0,
    VAT:           data.vat || 0,
    FEE_WITH_VAT:  data.feeSub || 0,
    GOV_SUBTOTAL:  data.govTotal || 0,
    GRAND_TOTAL:   grand,
  };
  Object.keys(numMarkers).forEach(function(key) {
    var re = new RegExp('<c([^>]*?)\\s*t="inlineStr"([^>]*?)>\\s*<is>\\s*<t[^>]*>\\{\\{' + key + '\\}\\}</t>\\s*</is>\\s*</c>', 'g');
    xml = xml.replace(re, function(match, before, after) {
      var combined = (before + after).replace(/\s+/g, ' ').replace(/\s*$/, '');
      return '<c' + combined + ' t="n"><v>' + numMarkers[key] + '</v></c>';
    });
  });

  return xml;
};

// 템플릿 기반 견적서 엑셀 생성 (JSZip 직접 조작)
// 반환: ArrayBuffer
