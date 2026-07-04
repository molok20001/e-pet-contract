/* ══════════════════════════════════════════
   signature.js — 簽名板副程式（工廠模式）
   職責：Canvas 手寫簽名功能
   支援：滑鼠（電腦）、觸控（手機/平板）
   ──────────────────────────────────────────
   版本6改為甲乙雙方各一塊簽名板，
   故從單例改為工廠：每呼叫一次 createSignaturePad()
   產生一個獨立實例（各自的 Canvas、狀態、方法）。
   ──────────────────────────────────────────
   用法（app.js）：
   const pad = createSignaturePad({
     canvasId:  'signature-canvas',
     clearBtnId:'clear-signature',
     wrapperId: 'signature-wrapper',
   });
   pad.isEmpty()     檢查是否空白
   pad.getDataUrl()  取得簽名圖（base64 PNG）
   pad.clear()       清除簽名
   pad.resize()      重新量測畫布尺寸
                     （區塊從 hidden 變顯示時必須呼叫一次，
                     否則 hidden 期間量到的尺寸是 0×0，
                     簽名區會變成畫不上去的空框）
══════════════════════════════════════════ */

/**
 * 建立一塊簽名板
 * @param {Object} ids
 * @param {string} ids.canvasId   - Canvas 元素 id
 * @param {string} ids.clearBtnId - 清除按鈕 id
 * @param {string} ids.wrapperId  - 外框容器 id（驗證錯誤紅框用）
 * @returns {{ clear: Function, isEmpty: Function, getDataUrl: Function }|null}
 */
function createSignaturePad({ canvasId, clearBtnId, wrapperId }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`[signature] 找不到 #${canvasId}`);
    return null;
  }

  const ctx = canvas.getContext('2d');

  // 每個實例自己的繪圖狀態
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  /** 設定畫筆樣式（初始化與 resize 後都要重設） */
  function applyPenStyle() {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /**
   * 調整 Canvas 實際像素大小
   * 解決高 DPI 螢幕（Retina）模糊問題
   */
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    applyPenStyle();
  }

  /** 取得滑鼠在 Canvas 上的座標 */
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** 取得觸控點在 Canvas 上的座標 */
  function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  /** 畫一條線段 */
  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // ── 滑鼠事件 ──

  function onMouseDown(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
    // 起始點畫一個點（防止只點一下沒有墨水）
    ctx.beginPath();
    ctx.arc(lastX, lastY, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  }

  function onMouseMove(e) {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x;
    lastY = pos.y;
  }

  function onMouseUp() {
    isDrawing = false;
  }

  // ── 觸控事件 ──

  function onTouchStart(e) {
    e.preventDefault(); // 防止觸控時頁面跟著滾動
    isDrawing = true;
    const pos = getTouchPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getTouchPos(e);
    drawLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x;
    lastY = pos.y;
  }

  function onTouchEnd() {
    isDrawing = false;
  }

  /** 清除整個簽名板 */
  function clear() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // 清除驗證錯誤樣式
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) wrapper.classList.remove('error');
  }

  /**
   * 檢查簽名板是否為空白
   * 讀取所有像素，只要有任何非透明像素就不是空白
   * @returns {boolean} true = 空白
   */
  function isEmpty() {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // 每 4 個值代表一個像素（R, G, B, A），檢查 alpha
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) return false;
    }
    return true;
  }

  /**
   * 取得簽名圖片的 base64 字串
   * @returns {string} base64 PNG
   */
  function getDataUrl() {
    return canvas.toDataURL('image/png');
  }

  // ── 初始化 ──
  resizeCanvas();

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) clearBtn.addEventListener('click', clear);

  // 視窗大小改變時重新調整（注意：resize 會清空 Canvas 內容，
  // 這是原本單例版本就有的行為，維持不變）
  window.addEventListener('resize', resizeCanvas);

  return { clear, isEmpty, getDataUrl, resize: resizeCanvas };
}
