/* ══════════════════════════════════════════
   pdf-layout-v2.js — 前端 PDF 生成主入口（版面二版）
   職責：生成「現代電子合約式」版面的契約 PDF
   ──────────────────────────────────────────
   版面依據：「犬、貓美容服務定型化契約 (版本四：現代電子合約式).docx」
   依範本調整，但條文採 KV 22 條完整全文（非範本摘要版），
   emoji 圖示不印（NotoSansTC 無 emoji 字形，會變空框）。
   ──────────────────────────────────────────
   與舊版（pdf-client.js）差異：
   - 基本資料：框線表格（甲方／乙方／寵物三列），取代底線欄位
   - 條文分四部分大標（第一部分＝基本資料表格）
   - 簽署區：甲乙雙欄並排
   - 乙方資料完整印出（含營業時間、聯絡電話、預設獸醫）
   ──────────────────────────────────────────
   依賴：pdf-utils.js（PageManager 等）、pdf-table.js（drawInfoTable）、
        pdf-lib + fontkit（CDN）、fonts/NotoSansTC-Regular.ttf
   ──────────────────────────────────────────
   舊版回退方式：index.html 換回載入 pdf-client.js、
   submit-flow.js 改回呼叫 generatePDF()
══════════════════════════════════════════ */

/* ════════════════════════════════════════
   版面設定（A4：595 × 842 點）
════════════════════════════════════════ */
const PDF_CONFIG_V2 = {
  pageWidth: 595,
  pageHeight: 842,
  marginLeft: 65,
  marginRight: 65,
  marginTop: 70,
  marginBottom: 70,
  contentWidth: 465,
  sizeTitle: 17,        // 文件主標題
  sizePartTitle: 14,    // 部分大標（第一部分～第四部分）
  sizeClauseTitle: 12,  // 條文標題
  sizeBody: 11,         // 內文
  sizeSmall: 10,        // 小字
  lineHeightTitle: 24,
  lineHeightBody: 20,
  lineHeightSmall: 18,
  clauseIndent: 24,     // 條文內容縮排量
};

/* 部分大標：畫到「key 對應之條文 id」前插入
   注意：依 default-clauses.js 的 22 條 id 對應，若未來條文增刪需同步調整 */
const PART_HEADERS_V2 = {
  1:  '第二部分：服務內容與照護義務',
  7:  '第三部分：費用與解約退費規定',
  16: '第四部分：爭議與其他約定',
};

// 字型快取（獨立於 pdf-client.js，避免全域名稱衝突）
let cachedFontBytesV2 = null;

/**
 * 生成契約 PDF（版面二版主入口）
 * 由 submit-flow.js 呼叫，參數與舊版 generatePDF 完全相同
 * @returns {Promise<Uint8Array>} PDF 二進位資料
 */
async function generatePDFv2(formData, signatureDataUrl, signatureDataUrlB, clauses, shop) {
  const { PDFDocument } = PDFLib;

  const fontBytes = await loadFontV2();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  // subset: false = 完整嵌入，TTF 格式必須如此，否則中文字消失
  const font = await pdfDoc.embedFont(fontBytes, { subset: false });

  const pm = new PageManager(pdfDoc, font, PDF_CONFIG_V2);

  drawHeaderV2(pm, shop);
  drawInfoTableSectionV2(pm, formData, shop);
  drawClausesV2(pm, clauses);
  await drawSignatureSectionV2(pm, pdfDoc, formData, signatureDataUrl, signatureDataUrlB, shop);

  return await pdfDoc.save();
}

/** 載入中文字型（有快取，避免重複下載） */
async function loadFontV2() {
  if (cachedFontBytesV2) return cachedFontBytesV2;
  const response = await fetch('fonts/NotoSansTC-Regular.ttf');
  if (!response.ok) throw new Error('字型載入失敗，請重新整理頁面');
  cachedFontBytesV2 = await response.arrayBuffer();
  return cachedFontBytesV2;
}

/* ════════════════════════════════════════
   標題區：主標題（置中）＋店家名稱＋審閱行
════════════════════════════════════════ */
function drawHeaderV2(pm, shop) {
  const cfg = pm.config;

  pm.ensureSpace(120);

  // 主標題（置中）
  drawCenteredText(pm, '犬、貓美容服務定型化契約', cfg.sizeTitle);
  pm.moveDown(cfg.lineHeightTitle + 6);

  // 店家名稱（置中、灰字）
  const shopName = (shop && shop.company_name) || '';
  if (shopName) {
    drawCenteredText(pm, `（店家名稱：${shopName}）`, cfg.sizeSmall, '#555555');
    pm.moveDown(cfg.lineHeightSmall + 10);
  }

  pm.drawDivider({ thickness: 1, color: '#333333' });
  pm.moveDown(18);

  // 審閱行與同意行
  pm.drawText('本契約於中華民國　　　年　　　月　　　日由甲方攜回審閱。', {
    size: cfg.sizeBody,
  });
  pm.moveDown(cfg.lineHeightBody);
  pm.drawText('甲乙雙方同意就本契約所載條款及附件內容辦理：', {
    size: cfg.sizeBody,
  });
  pm.moveDown(cfg.lineHeightBody + 14);
}

/** 置中繪製單行文字（用 measureText 量寬） */
function drawCenteredText(pm, text, size, color) {
  const cfg = pm.config;
  const width = measureText(text, size, pm.font);
  const x = cfg.marginLeft + (cfg.contentWidth - width) / 2;
  pm.drawText(text, { size, x, color: color || '#1a1a1a' });
}

/** 部分大標（第一部分～第四部分） */
function drawPartHeaderV2(pm, text) {
  const cfg = pm.config;
  pm.ensureSpace(70);
  pm.drawText(text, { size: cfg.sizePartTitle });
  pm.moveDown(8);
  pm.drawDivider({ thickness: 0.8, color: '#888888' });
  pm.moveDown(16);
}

/* ════════════════════════════════════════
   第一部分：雙方與寵物基本資料（框線表格）
════════════════════════════════════════ */
function drawInfoTableSectionV2(pm, formData, shop) {
  drawPartHeaderV2(pm, '第一部分：雙方與寵物基本資料');

  // 註：Email 僅記錄於 KV（版本5寄信預留），非官方契約欄位，不印入 PDF
  const rows = [
    {
      category: '甲方（消費者）',
      lines: [
        `姓名：${formData.ownerName || ''}`,
        `身分證統一編號／居留證號碼：${formData.ownerId || ''}`,
        `通訊地址：${formData.ownerAddress || ''}`,
        `聯絡電話：${formData.ownerPhone || ''}`,
        `緊急聯絡人：${formData.emergencyName || ''}（電話：${formData.emergencyPhone || ''}）`,
        `指定獸醫診療場所：${formData.vetName || ''}`,
      ],
    },
    {
      category: '乙方（企業經營者）',
      lines: [
        `公司或商號名稱：${shop.company_name || ''}`,
        `代表人：${shop.owner_name || ''}`,
        `營業地址：${shop.address || ''}`,
        `營業時間：${shop.business_hours || ''}`,
        `聯絡電話：${shop.phone || ''}`,
        `如無指定，送交之獸醫診療場所：${shop.default_vet || ''}`,
      ],
    },
    {
      category: '寵物資料',
      lines: [
        `寵物姓名：${formData.petName || ''}`,
        `寵物品種：${formData.petBreed || ''}`,
        `寵物性別：${formData.petSex || ''}`,
        `寵物生日：${formData.petBirth || ''}`,
        `體重（公斤）：${formData.petWeight || ''}`,
        `寵物登記晶片號碼：${formData.petChip || ''}`,
        `其他事項：${formData.otherNotes || ''}`,
      ],
    },
  ];

  drawInfoTable(pm, rows);   // pdf-table.js
  pm.moveDown(24);
}

/* ════════════════════════════════════════
   第二～四部分：條文（完整全文＋部分大標分組）
════════════════════════════════════════ */
function drawClausesV2(pm, clauses) {
  const cfg = pm.config;

  clauses.forEach(clause => {
    // 遇到分組起始條文，先畫部分大標；
    // id 不在對照表內的條文照常繪製（不影響輸出）
    const partHeader = PART_HEADERS_V2[clause.id];
    if (partHeader) {
      pm.moveDown(6);
      drawPartHeaderV2(pm, partHeader);
    }

    pm.ensureSpace(60);

    pm.drawText(clause.title, { size: cfg.sizeClauseTitle });
    pm.moveDown(cfg.lineHeightBody + 6);

    const content = getClauseTextV2(clause);
    if (content) {
      pm.drawParagraph(content, {
        size: cfg.sizeBody,
        indent: cfg.clauseIndent,
        lineHeight: cfg.lineHeightBody,
      });
    }

    pm.moveDown(14);
  });
}

/**
 * 取得條文要顯示的文字內容
 * 邏輯與 clause-renderer.js 相同，PDF 端獨立實作
 */
function getClauseTextV2(clause) {
  if (clause.type === 'fixed') return clause.content || '';
  if (clause.type === 'selectable') {
    if (!clause.options || !clause.selected) return '';
    const opt = clause.options.find(o => o.key === clause.selected);
    return opt ? opt.content : '';
  }
  if (clause.type === 'editable') return clause.content || '';
  return '';
}

/* ════════════════════════════════════════
   簽署與確認（甲乙雙欄並排）
════════════════════════════════════════ */
async function drawSignatureSectionV2(pm, pdfDoc, formData, signatureDataUrl, signatureDataUrlB, shop) {
  const cfg = pm.config;
  const gap = 24;
  const colWidth = (cfg.contentWidth - gap) / 2;
  const leftX = cfg.marginLeft;
  const rightX = cfg.marginLeft + colWidth + gap;
  const sigHeight = 70;

  // 整個簽署區一次確保空間，避免簽名與姓名被拆到兩頁
  pm.ensureSpace(40 + sigHeight + 90);

  pm.moveDown(6);
  drawPartHeaderV2(pm, '簽署與確認');

  // 欄位標題（同一行，左右並排）
  pm.drawText('甲方（消費者）簽名', { size: cfg.sizeClauseTitle, x: leftX });
  pm.drawText('乙方（企業經營者）簽名', { size: cfg.sizeClauseTitle, x: rightX });
  pm.moveDown(cfg.lineHeightBody + 10);

  // 簽名圖（左右並排，同一個 Y 起點）
  const sigTopY = pm.currentY;
  await drawSignatureImageV2(pm, pdfDoc, signatureDataUrl, leftX, sigTopY, colWidth, sigHeight);
  await drawSignatureImageV2(pm, pdfDoc, signatureDataUrlB, rightX, sigTopY, colWidth, sigHeight);
  pm.moveDown(sigHeight + 14);

  // 姓名／店名（含底線）
  drawColumnFieldV2(pm, leftX, colWidth, '甲方：', formData.ownerName || '');
  drawColumnFieldV2(pm, rightX, colWidth, '乙方：', (shop && shop.company_name) || '');
  pm.moveDown(cfg.lineHeightBody + 6);

  // 日期（雙欄同值）
  const signDate = formData.signDate || '';
  drawColumnFieldV2(pm, leftX, colWidth, '日期：', signDate);
  drawColumnFieldV2(pm, rightX, colWidth, '日期：', signDate);
  pm.moveDown(cfg.lineHeightBody);
}

/**
 * 嵌入一張簽名圖片，畫在指定欄位範圍內
 * 高度固定，寬度等比縮放且不超出欄寬；失敗時不中斷流程
 */
async function drawSignatureImageV2(pm, pdfDoc, dataUrl, x, topY, maxWidth, height) {
  try {
    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const signatureImage = await pdfDoc.embedPng(bytes);
    const imgDims = signatureImage.scale(1);
    const displayWidth = Math.min((imgDims.width / imgDims.height) * height, maxWidth);

    pm.currentPage.drawImage(signatureImage, {
      x,
      y: topY - height,
      width: displayWidth,
      height,
    });
  } catch (err) {
    console.error('[pdf-layout-v2] 簽名圖片嵌入失敗：', err);
  }
}

/**
 * 在指定欄位範圍內繪製「標籤＋值＋底線」（雙欄簽署區用）
 * 不移動 Y 座標，由呼叫端統一 moveDown
 */
function drawColumnFieldV2(pm, x, width, label, value) {
  const cfg = pm.config;
  const size = cfg.sizeBody;
  const textColor = hexToRgb('#1a1a1a');
  const labelWidth = measureText(label, size, pm.font) + 6;

  pm.currentPage.drawText(label, {
    x,
    y: pm.currentY,
    size,
    font: pm.font,
    color: PDFLib.rgb(textColor.r, textColor.g, textColor.b),
  });

  if (value && value.trim()) {
    pm.currentPage.drawText(value, {
      x: x + labelWidth,
      y: pm.currentY,
      size,
      font: pm.font,
      color: PDFLib.rgb(textColor.r, textColor.g, textColor.b),
    });
  }

  pm.currentPage.drawLine({
    start: { x: x + labelWidth, y: pm.currentY - 3 },
    end: { x: x + width, y: pm.currentY - 3 },
    thickness: 0.5,
    color: PDFLib.rgb(0.4, 0.4, 0.4),
  });
}
