/* ══════════════════════════════════════════
   pdf-table.js — PDF 框線表格繪製工具
   職責：繪製「基本資料」框線表格（類別欄 + 內容欄）
   ──────────────────────────────────────────
   被 pdf-layout-v2.js 使用。
   依賴：pdf-utils.js（wrapText、measureText、hexToRgb、PageManager）
   ──────────────────────────────────────────
   設計說明：
   - 每一列（row）獨立繪製四邊框線，相鄰列的框線重疊不影響視覺
   - 列與列之間可分頁（ensureSpace 以「整列高度」判斷），
     單一列內容不跨頁（目前最多約 8 行，遠小於一頁高度）
══════════════════════════════════════════ */

/**
 * 繪製框線資料表格
 * @param {PageManager} pm - 分頁管理器（pdf-utils.js）
 * @param {Array} rows - [{ category: '甲方（消費者）', lines: ['姓名：王小明', ...] }]
 * @param {Object} options - col1Width, padding, size, lineHeight
 */
function drawInfoTable(pm, rows, options = {}) {
  const cfg = pm.config;
  // 124 = 讓最長類別「乙方（企業經營者）」（9 全形字 × 11pt = 99pt）單行放得下
  const col1Width = options.col1Width || 124;
  const padding = options.padding || 8;
  const size = options.size || cfg.sizeBody;
  const lineHeight = options.lineHeight || cfg.lineHeightBody;

  const tableLeft = cfg.marginLeft;
  const tableRight = cfg.marginLeft + cfg.contentWidth;
  const dividerX = tableLeft + col1Width;
  const col2TextX = dividerX + padding;
  const col2MaxWidth = tableRight - col2TextX - padding;
  const col1MaxWidth = col1Width - padding * 2;

  rows.forEach(row => {
    // 先把兩欄文字換行，算出整列高度
    const categoryLines = wrapText(row.category, size, col1MaxWidth, pm.font);
    const contentLines = [];
    row.lines.forEach(line => {
      wrapText(line, size, col2MaxWidth, pm.font).forEach(l => contentLines.push(l));
    });

    const maxLines = Math.max(categoryLines.length, contentLines.length, 1);
    const rowHeight = maxLines * lineHeight + padding * 2;

    // 整列放不下就換頁（列本身不跨頁）
    pm.ensureSpace(rowHeight);

    const topY = pm.currentY;
    const bottomY = topY - rowHeight;

    // 四邊框線 + 中間直線
    drawTableBorders(pm, tableLeft, tableRight, dividerX, topY, bottomY);

    // 類別欄文字（左欄）
    drawCellLines(pm, categoryLines, tableLeft + padding, topY, padding, size, lineHeight);

    // 內容欄文字（右欄）
    drawCellLines(pm, contentLines, col2TextX, topY, padding, size, lineHeight);

    pm.moveDown(rowHeight);
  });
}

/**
 * 繪製單一列的框線（上、下、左、右、中間分隔線）
 */
function drawTableBorders(pm, left, right, dividerX, topY, bottomY) {
  const color = PDFLib.rgb(0.3, 0.3, 0.3);
  const thickness = 0.7;
  const lines = [
    [{ x: left, y: topY }, { x: right, y: topY }],           // 上
    [{ x: left, y: bottomY }, { x: right, y: bottomY }],     // 下
    [{ x: left, y: topY }, { x: left, y: bottomY }],         // 左
    [{ x: right, y: topY }, { x: right, y: bottomY }],       // 右
    [{ x: dividerX, y: topY }, { x: dividerX, y: bottomY }], // 中間分隔
  ];
  lines.forEach(([start, end]) => {
    pm.currentPage.drawLine({ start, end, thickness, color });
  });
}

/**
 * 在儲存格內繪製多行文字（頂端對齊）
 * @param {number} cellTopY - 儲存格上緣 Y 座標
 */
function drawCellLines(pm, lines, x, cellTopY, padding, size, lineHeight) {
  const textColor = hexToRgb('#1a1a1a');
  lines.forEach((line, i) => {
    // 第一行基線 = 上緣 - padding - 字高；之後逐行往下
    const y = cellTopY - padding - size - i * lineHeight;
    pm.currentPage.drawText(line, {
      x,
      y,
      size,
      font: pm.font,
      color: PDFLib.rgb(textColor.r, textColor.g, textColor.b),
    });
  });
}
