/* ══════════════════════════════════════════
   pdf-client.js — 前端 PDF 生成副程式（主入口）
   職責：生成符合農業部範本樣式的契約 PDF
   ──────────────────────────────────────────
   依賴：
   - pdf-utils.js（PageManager、wrapText 等工具）
   - pdf-lib + fontkit（CDN）
   - fonts/SourceHanSansTW-Regular.otf
   ──────────────────────────────────────────
   樣式特徵：
   - 白底黑字，素雅正式
   - 條文標題粗體
   - 條文內容縮排
   - 欄位底線格式
   - 自動多頁分頁
══════════════════════════════════════════ */

/* ════════════════════════════════════════
   版面設定（A4：595 × 842 點）
════════════════════════════════════════ */
const PDF_CONFIG = {
  pageWidth: 595,
  pageHeight: 842,
  marginLeft: 65,
  marginRight: 65,
  marginTop: 70,
  marginBottom: 70,
  contentWidth: 465,    // 595 - 65 - 65
  sizeTitle: 16,        // 文件主標題
  sizeClauseTitle: 13,  // 條文標題
  sizeBody: 11,         // 內文
  sizeSmall: 10,        // 小字
  lineHeightTitle: 24,
  lineHeightBody: 20,
  lineHeightSmall: 18,
  clauseIndent: 30,     // 條文內容縮排量
};

// 字型快取
let cachedFontBytes = null;

/**
 * 生成契約 PDF（主入口）
 * 由 app.js 的 handleSubmit() 呼叫
 * @param {Object} formData        - 表單資料
 * @param {string} signatureDataUrl - 簽名圖片 base64
 * @param {Array}  clauses         - 條文資料陣列
 * @param {Object} shop            - 店家基本資料
 * @returns {Promise<Uint8Array>}  PDF 二進位資料
 */
async function generatePDF(formData, signatureDataUrl, clauses, shop) {
  const { PDFDocument } = PDFLib;

  // 載入字型
  const fontBytes = await loadFont();

  // 建立 PDF 文件
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
// 關閉子集化，完整嵌入思源黑體，確保所有動態文字、條文、罕見字都能完美顯示
const font = await pdfDoc.embedFont(fontBytes, { subset: false });

  // 建立分頁管理器（pdf-utils.js）
  const pm = new PageManager(pdfDoc, font, PDF_CONFIG);

  // 依序繪製各區塊
  drawCoverInfo(pm, formData, shop);
  drawClauses(pm, clauses);
  await drawSignatureSection(pm, pdfDoc, formData, signatureDataUrl);

  return await pdfDoc.save();
}

/**
 * 載入中文字型（有快取，避免重複下載）
 */
async function loadFont() {
  if (cachedFontBytes) return cachedFontBytes;
  const response = await fetch('fonts/SourceHanSansTW-Regular.otf');
  if (!response.ok) throw new Error('字型載入失敗，請重新整理頁面');
  cachedFontBytes = await response.arrayBuffer();
  return cachedFontBytes;
}

/* ════════════════════════════════════════
   各區塊繪製函式
════════════════════════════════════════ */

/**
 * 繪製封面資料
 * 包含：主標題、審閱日期行、甲方欄位、乙方欄位
 */
function drawCoverInfo(pm, formData, shop) {
  const cfg = pm.config;

  // 主標題
  pm.ensureSpace(40);
  pm.drawText('犬、貓美容服務定型化契約', {
    size: cfg.sizeTitle,
    x: cfg.marginLeft,
  });
  pm.moveDown(cfg.lineHeightTitle + 4);

  // 店家名稱
  pm.drawText(shop.company_name || '', {
    size: cfg.sizeSmall,
    color: '#555555',
    x: cfg.marginLeft,
  });
  pm.moveDown(cfg.lineHeightSmall + 12);

  pm.drawDivider({ thickness: 1, color: '#333333' });
  pm.moveDown(16);

  // 審閱日期行
  pm.drawText('本契約於中華民國　　　年　　　月　　　日由甲方攜回審閱。', {
    size: cfg.sizeBody,
  });
  pm.moveDown(cfg.lineHeightBody);
  pm.drawText('甲乙雙方同意就本契約所載條款及附件內容辦理：', {
    size: cfg.sizeBody,
  });
  pm.moveDown(cfg.lineHeightBody + 16);

  // 立契約書人標題
  pm.drawText('立契約書人', {
    size: cfg.sizeClauseTitle,
  });
  pm.moveDown(cfg.lineHeightTitle + 4);

  // 甲方欄位（底線格式）
  const fields = [
    ['消費者姓名', formData.ownerName || ''],
    ['身分證統一編號／居留證號碼', formData.ownerId || ''],
    ['通訊地址', formData.ownerAddress || ''],
    ['聯絡電話', formData.ownerPhone || ''],
    ['緊急聯絡人', formData.emergencyName || ''],
    ['緊急聯絡人電話', formData.emergencyPhone || ''],
    ['指定獸醫診療場所', formData.vetName || shop.default_vet || ''],
    ['寵物晶片號碼', formData.petChip || ''],
    ['簽約日期', formData.signDate || ''],
  ];

  fields.forEach(([label, value]) => {
    pm.drawField(label, value);
  });

  pm.moveDown(12);

  // 乙方欄位
  pm.drawField('企業經營者', shop.company_name || '');
  pm.drawField('代表人', shop.owner_name || '');
  pm.drawField('營業地址', shop.address || '');

  pm.moveDown(20);
  pm.drawDivider();
  pm.moveDown(16);
}

/**
 * 繪製所有條文
 * 條文標題：粗體（較大字級模擬），內容縮排
 */
function drawClauses(pm, clauses) {
  const cfg = pm.config;

  clauses.forEach(clause => {
    pm.ensureSpace(60);

    // 條文標題
    pm.drawText(clause.title, {
      size: cfg.sizeClauseTitle,
    });
    pm.moveDown(cfg.lineHeightTitle + 4);

    // 條文內容（縮排）
    const content = getClauseContent(clause);
    if (content) {
      pm.drawParagraph(content, {
        size: cfg.sizeBody,
        indent: cfg.clauseIndent,
        lineHeight: cfg.lineHeightBody,
      });
    }

    pm.moveDown(12);
  });
}

/**
 * 繪製簽名區
 * 包含：甲方手寫簽名圖片、姓名、日期
 */
async function drawSignatureSection(pm, pdfDoc, formData, signatureDataUrl) {
  const cfg = pm.config;

  pm.ensureSpace(200);
  pm.drawDivider();
  pm.moveDown(16);

  pm.drawText('甲方簽名', { size: cfg.sizeClauseTitle });
  pm.moveDown(cfg.lineHeightTitle + 8);

  // 嵌入簽名圖片
  try {
    const base64Data = signatureDataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const signatureImage = await pdfDoc.embedPng(bytes);
    const imgDims = signatureImage.scale(1);

    // 高度固定 80，寬度等比縮放
    const displayHeight = 80;
    const displayWidth = Math.min(
      (imgDims.width / imgDims.height) * displayHeight,
      cfg.contentWidth
    );

    pm.ensureSpace(displayHeight + 16);

    pm.currentPage.drawImage(signatureImage, {
      x: cfg.marginLeft,
      y: pm.currentY - displayHeight,
      width: displayWidth,
      height: displayHeight,
    });
    pm.moveDown(displayHeight + 12);

  } catch (err) {
    console.error('[pdf-client] 簽名圖片嵌入失敗：', err);
    pm.moveDown(80);
  }

  // 姓名與日期
  pm.drawField('甲方：', formData.ownerName || '');
  pm.moveDown(8);
  pm.drawField('日期：', formData.signDate || '');
}

/**
 * 取得條文要顯示的文字內容
 * 邏輯與 clause-renderer.js 相同，PDF 端獨立實作
 */
function getClauseContent(clause) {
  if (clause.type === 'fixed') return clause.content || '';
  if (clause.type === 'selectable') {
    if (!clause.options || !clause.selected) return '';
    const opt = clause.options.find(o => o.key === clause.selected);
    return opt ? opt.content : '';
  }
  if (clause.type === 'editable') return clause.content || '';
  return '';
}
