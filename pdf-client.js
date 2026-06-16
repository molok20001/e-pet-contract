/* ══════════════════════════════════════════
   pdf-client.js — 前端 PDF 生成副程式
   職責：在瀏覽器內使用 pdf-lib 生成契約 PDF
   ──────────────────────────────────────────
   依賴：
   - pdf-lib（從 CDN 載入）
   - @pdf-lib/fontkit（從 CDN 載入）
   - fonts/SourceHanSansTW-Regular.otf（字型檔）
   ──────────────────────────────────────────
   提供的函式：
   - generatePDF(formData, signatureDataUrl, clauses, shop)
     → 回傳 Uint8Array（PDF 的二進位資料）
══════════════════════════════════════════ */

/* ════════════════════════════════════════
   PDF 版面設定
   A4 尺寸：595 × 842 點（1 點 = 1/72 英寸）
════════════════════════════════════════ */
const PDF_CONFIG = {
  pageWidth: 595,
  pageHeight: 842,
  marginLeft: 50,
  marginRight: 50,
  marginTop: 60,
  marginBottom: 60,
  fontSizeTitle: 16,    // 契約標題字級
  fontSizeH2: 13,       // 區塊標題字級
  fontSizeBody: 11,     // 內文字級
  fontSizeSmall: 9,     // 小字（條文內容）
  lineHeight: 18,       // 行高
};

// 字型快取（避免每次生成都重新下載字型）
let cachedFontBytes = null;

/**
 * 生成契約 PDF
 * @param {Object} formData     - 表單資料（ownerName, ownerId 等）
 * @param {string} signatureDataUrl - 簽名圖片 base64 字串
 * @param {Array}  clauses      - 條文資料陣列
 * @param {Object} shop         - 店家基本資料
 * @returns {Promise<Uint8Array>} PDF 二進位資料
 */
async function generatePDF(formData, signatureDataUrl, clauses, shop) {
  // ── 步驟一：載入 pdf-lib 和 fontkit ──
  // 從全域變數取得（由 index.html 引入的 CDN script 提供）
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  // ── 步驟二：載入中文字型 ──
  const fontBytes = await loadFont();

  // ── 步驟三：建立 PDF 文件 ──
  const pdfDoc = await PDFDocument.create();

  // 註冊 fontkit（讓 pdf-lib 支援自訂字型子集化）
  pdfDoc.registerFontkit(fontkit);

  // 嵌入中文字型（subset: true = 只嵌入用到的字元，大幅縮小檔案）
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  // ── 步驟四：建立第一頁 ──
  const page = pdfDoc.addPage([PDF_CONFIG.pageWidth, PDF_CONFIG.pageHeight]);

  // 建立繪圖輔助物件（封裝座標管理）
  const ctx = createDrawContext(page, font, PDF_CONFIG);

  // ── 步驟五：繪製各區塊 ──
  drawTitle(ctx, shop);
  drawPartyInfo(ctx, formData, shop);
  drawClauses(ctx, pdfDoc, clauses);
  await drawSignature(ctx, pdfDoc, formData, signatureDataUrl);

  // ── 步驟六：輸出 PDF ──
  return await pdfDoc.save();
}

/**
 * 載入中文字型（有快取機制）
 * @returns {Promise<ArrayBuffer>}
 */
async function loadFont() {
  if (cachedFontBytes) return cachedFontBytes;

  // 從靜態檔案載入字型
  const response = await fetch('fonts/SourceHanSansTW-Regular.otf');
  if (!response.ok) {
    throw new Error('字型載入失敗，請重新整理頁面');
  }
  cachedFontBytes = await response.arrayBuffer();
  return cachedFontBytes;
}

/**
 * 建立繪圖輔助物件
 * 封裝目前 Y 座標，提供 drawText 和換行功能
 */
function createDrawContext(page, font, config) {
  // 目前繪圖的 Y 座標（從頁面上方開始往下）
  // PDF 座標系統是從左下角為原點，Y 往上增加
  // 所以頁面頂部的 Y = pageHeight - marginTop
  let currentY = config.pageHeight - config.marginTop;
  const contentWidth = config.pageWidth - config.marginLeft - config.marginRight;

  return {
    page,
    font,
    config,
    contentWidth,

    // 取得目前 Y 座標
    get y() { return currentY; },

    // 往下移動指定距離
    moveDown(amount) { currentY -= amount; },

    // 在目前位置繪製文字
    drawText(text, options = {}) {
      const size = options.size || config.fontSizeBody;
      const x = options.x !== undefined ? options.x : config.marginLeft;
      const color = options.color || { r: 0.18, g: 0.12, b: 0.11 };

      page.drawText(text, {
        x,
        y: currentY,
        size,
        font,
        color: rgb(color.r, color.g, color.b),
        maxWidth: options.maxWidth || contentWidth,
      });
    },

    // 繪製分隔線
    drawDivider() {
      page.drawLine({
        start: { x: config.marginLeft, y: currentY },
        end: { x: config.pageWidth - config.marginRight, y: currentY },
        thickness: 0.5,
        color: rgb(0.8, 0.78, 0.75),
      });
    }
  };
}

/**
 * 繪製契約標題
 */
function drawTitle(ctx, shop) {
  // 店家名稱
  ctx.drawText(shop.company_name, {
    size: ctx.config.fontSizeSmall,
    color: { r: 0.5, g: 0.42, b: 0.37 }
  });
  ctx.moveDown(20);

  // 契約主標題
  ctx.drawText('犬、貓美容服務定型化契約', {
    size: ctx.config.fontSizeTitle,
    color: { r: 0.29, g: 0.22, b: 0.17 }
  });
  ctx.moveDown(8);

  // 分隔線
  ctx.drawDivider();
  ctx.moveDown(20);
}

/**
 * 繪製甲乙方基本資料
 */
function drawPartyInfo(ctx, formData, shop) {
  const labelColor = { r: 0.29, g: 0.22, b: 0.17 };
  const valueColor = { r: 0.18, g: 0.12, b: 0.11 };
  const size = ctx.config.fontSizeBody;
  const lineH = ctx.config.lineHeight;

  // 區塊標題
  ctx.drawText('甲方（飼主）資料', {
    size: ctx.config.fontSizeH2,
    color: labelColor
  });
  ctx.moveDown(lineH + 4);

  // 繪製每個欄位
  const fields = [
    ['姓名', formData.ownerName],
    ['身分證號／居留證號碼', formData.ownerId],
    ['通訊地址', formData.ownerAddress],
    ['聯絡電話', formData.ownerPhone],
    ['緊急聯絡人', `${formData.emergencyName}　${formData.emergencyPhone}`],
    ['指定獸醫診療場所', formData.vetName || '（依店家預設）'],
    ['寵物晶片號碼／辨識資訊', formData.petChip],
    ['簽約日期', formData.signDate],
  ];

  fields.forEach(([label, value]) => {
    ctx.drawText(`${label}：${value}`, { size, color: valueColor });
    ctx.moveDown(lineH);
  });

  ctx.moveDown(8);
  ctx.drawDivider();
  ctx.moveDown(20);
}

/**
 * 繪製條文內容
 * 注意：條文較多時可能需要新增頁面（目前暫時一頁處理）
 */
function drawClauses(ctx, pdfDoc, clauses) {
  ctx.drawText('契約條款', {
    size: ctx.config.fontSizeH2,
    color: { r: 0.29, g: 0.22, b: 0.17 }
  });
  ctx.moveDown(ctx.config.lineHeight + 4);

  clauses.forEach(clause => {
    // 條文標題
    ctx.drawText(clause.title, {
      size: ctx.config.fontSizeBody,
      color: { r: 0.29, g: 0.22, b: 0.17 }
    });
    ctx.moveDown(ctx.config.lineHeight);

    // 條文內容
    const content = getClauseContent(clause);
    ctx.drawText(content, {
      size: ctx.config.fontSizeSmall,
      color: { r: 0.35, g: 0.28, b: 0.24 },
      maxWidth: ctx.contentWidth
    });
    ctx.moveDown(ctx.config.lineHeight + 4);
  });

  ctx.drawDivider();
  ctx.moveDown(20);
}

/**
 * 繪製簽名區
 * @param {Object} ctx
 * @param {PDFDocument} pdfDoc
 * @param {Object} formData
 * @param {string} signatureDataUrl - base64 PNG
 */
async function drawSignature(ctx, pdfDoc, formData, signatureDataUrl) {
  ctx.drawText('甲方簽名', {
    size: ctx.config.fontSizeH2,
    color: { r: 0.29, g: 0.22, b: 0.17 }
  });
  ctx.moveDown(ctx.config.lineHeight + 8);

  // 嵌入簽名圖片
  try {
    // 把 base64 字串轉成二進位資料
    const base64Data = signatureDataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const signatureImage = await pdfDoc.embedPng(bytes);

    // 計算簽名圖片的顯示大小（寬度固定，高度等比縮放）
    const imgWidth = 200;
    const imgHeight = 80;

    ctx.page.drawImage(signatureImage, {
      x: ctx.config.marginLeft,
      y: ctx.y - imgHeight,
      width: imgWidth,
      height: imgHeight,
    });
    ctx.moveDown(imgHeight + 8);
  } catch (err) {
    console.error('[pdf-client] 簽名圖片嵌入失敗：', err);
    ctx.drawText('（簽名圖片嵌入失敗）', {
      size: ctx.config.fontSizeSmall,
      color: { r: 0.8, g: 0.2, b: 0.2 }
    });
    ctx.moveDown(ctx.config.lineHeight);
  }

  // 簽名人姓名
  ctx.drawText(`甲方：${formData.ownerName}`, {
    size: ctx.config.fontSizeBody
  });
}
