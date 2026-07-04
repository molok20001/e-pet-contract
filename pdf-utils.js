/* ══════════════════════════════════════════
   pdf-utils.js — PDF 生成工具函式
   職責：提供 pdf-client.js 使用的工具類別與函式
   ──────────────────────────────────────────
   包含：
   - PageManager：分頁管理器（自動分頁、繪圖輔助）
   - wrapText：文字自動換行
   - measureText：量測文字寬度
   - hexToRgb：色碼轉換
══════════════════════════════════════════ */

/* ════════════════════════════════════════
   PageManager — 分頁管理器
   自動追蹤目前 Y 座標，超出頁面時新增頁面
════════════════════════════════════════ */
class PageManager {
  constructor(pdfDoc, font, config) {
    this.pdfDoc = pdfDoc;
    this.font = font;
    this.config = config;
    this.currentPage = null;
    this.currentY = 0;
    // 建立第一頁
    this.newPage();
  }

  /** 新增一頁，重設 Y 座標 */
  newPage() {
    this.currentPage = this.pdfDoc.addPage([
      this.config.pageWidth,
      this.config.pageHeight
    ]);
    // Y 從頁面頂部開始（PDF 座標原點在左下角）
    this.currentY = this.config.pageHeight - this.config.marginTop;
  }

  /** 檢查剩餘空間是否足夠，不夠就新增頁面 */
  ensureSpace(needed) {
    if (this.currentY - needed < this.config.marginBottom) {
      this.newPage();
    }
  }

  /** 往下移動 */
  moveDown(amount) {
    this.currentY -= amount;
  }

  /** 取得目前可用寬度 */
  get contentWidth() {
    return this.config.contentWidth;
  }

  /**
   * 繪製單行文字
   * @param {string} text
   * @param {Object} options - x, size, color(hex), indent
   */
  drawText(text, options = {}) {
    const size = options.size || this.config.sizeBody;
    const x = options.x !== undefined
      ? options.x
      : this.config.marginLeft + (options.indent || 0);
    const hexColor = options.color || '#1a1a1a';
    const color = hexToRgb(hexColor);

    this.currentPage.drawText(text, {
      x,
      y: this.currentY,
      size,
      font: this.font,
      color: PDFLib.rgb(color.r, color.g, color.b),
    });
  }

  /**
   * 繪製自動換行的段落文字
   * @param {string} text - 完整段落文字
   * @param {Object} options - size, indent, lineHeight
   */
  drawParagraph(text, options = {}) {
    const size = options.size || this.config.sizeBody;
    const indent = options.indent || 0;
    const lineHeight = options.lineHeight || this.config.lineHeightBody;
    const maxWidth = this.contentWidth - indent;
    const x = this.config.marginLeft + indent;
    const hexColor = options.color || '#1a1a1a';
    const color = hexToRgb(hexColor);

    // 把文字分成多行
    const lines = wrapText(text, size, maxWidth, this.font);

    lines.forEach(line => {
      this.ensureSpace(lineHeight);
      this.currentPage.drawText(line, {
        x,
        y: this.currentY,
        size,
        font: this.font,
        color: PDFLib.rgb(color.r, color.g, color.b),
      });
      this.moveDown(lineHeight);
    });
  }

  /**
   * 繪製底線欄位（標籤 + 底線 + 值）
   * @param {string} label - 欄位名稱
   * @param {string} value - 填入的值
   * @param {Object} options
   */
  drawField(label, value, options = {}) {
    const size = options.size || this.config.sizeBody;
    const lineHeight = options.lineHeight || this.config.lineHeightBody;
    const indent = options.indent || 0;
    const x = this.config.marginLeft + indent;

    this.ensureSpace(lineHeight + 8);

    // 繪製標籤
    const textColor = hexToRgb('#1a1a1a');

    // 標籤寬度：用 measureText 實際量測（字型已是 subset:false 完整嵌入，
    // 量測跟實際畫字用同一份字型資料，量出來的寬度是準的）
    // 舊寫法用「字數 × 固定比例」估算，中文長標籤會低估寬度，
    // 導致值文字疊到標籤尾巴上（例如「指定獸醫診療場所」7字的情況）
    const labelWidth = measureText(label, size, this.font) + 8;

    this.currentPage.drawText(label, {
      x,
      y: this.currentY,
      size,
      font: this.font,
      color: PDFLib.rgb(textColor.r, textColor.g, textColor.b),
    });

    // 繪製值文字（如果有）
    const valueX = x + labelWidth;
    const lineEndX = this.config.pageWidth - this.config.marginRight;

    if (value && value.trim()) {
      this.currentPage.drawText(value, {
        x: valueX,
        y: this.currentY,
        size,
        font: this.font,
        color: PDFLib.rgb(textColor.r, textColor.g, textColor.b),
      });
    }

    // 底線
    const lineY = this.currentY - 3;
    this.currentPage.drawLine({
      start: { x: valueX, y: lineY },
      end: { x: lineEndX, y: lineY },
      thickness: 0.5,
      color: PDFLib.rgb(0.4, 0.4, 0.4),
    });

    this.moveDown(lineHeight);
  }

  /** 繪製水平分隔線 */
  drawDivider(options = {}) {
    const y = this.currentY;
    const thickness = options.thickness || 0.5;
    const color = hexToRgb(options.color || '#cccccc');

    this.currentPage.drawLine({
      start: { x: this.config.marginLeft, y },
      end: { x: this.config.pageWidth - this.config.marginRight, y },
      thickness,
      color: PDFLib.rgb(color.r, color.g, color.b),
    });
  }
}

/* ════════════════════════════════════════
   工具函式
════════════════════════════════════════ */

/**
 * 將文字分成多行（依照可用寬度自動換行）
 * pdf-lib 的 drawText 不自動換行，需要手動處理
 */
function wrapText(text, fontSize, maxWidth, font) {
  const lines = [];
  const paragraphs = text.split('\n');

  paragraphs.forEach(paragraph => {
    if (!paragraph.trim()) {
      lines.push('');
      return;
    }

    let currentLine = '';

    // 逐字處理（中文每個字都可能是換行點）
    for (let i = 0; i < paragraph.length; i++) {
      const char = paragraph[i];
      const testLine = currentLine + char;
      const width = measureText(testLine, fontSize, font);

      if (width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
  });

  return lines;
}

/**
 * 量測文字寬度（點）
 */
function measureText(text, fontSize, font) {
  try {
    return font.widthOfTextAtSize(text, fontSize);
  } catch {
    return text.length * fontSize * 0.6;
  }
}

/**
 * 16 進位色碼轉 rgb（0-1 範圍）
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0, g: 0, b: 0 };
}
