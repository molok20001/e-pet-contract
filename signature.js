/* ══════════════════════════════════════════
   signature.js — 簽名板副程式
   職責：Canvas 手寫簽名功能
   支援：滑鼠（電腦）、觸控（手機/平板）
   ──────────────────────────────────────────
   提供的函式：
   - initSignature()   初始化簽名板
   - clearSignature()  清除簽名
   - isSignatureEmpty() 檢查是否為空白
   - getSignatureDataUrl() 取得簽名圖片（base64）
══════════════════════════════════════════ */

// 儲存 Canvas 相關的狀態
let signatureCanvas = null;   // Canvas DOM 元素
let signatureCtx = null;      // Canvas 2D 繪圖上下文
let isDrawing = false;        // 是否正在畫線
let lastX = 0;                // 上一個點的 X 座標
let lastY = 0;                // 上一個點的 Y 座標

/**
 * 初始化簽名板
 * 綁定滑鼠和觸控事件，設定畫筆樣式
 * 由 app.js 在頁面載入後呼叫
 */
function initSignature() {
  signatureCanvas = document.getElementById('signature-canvas');
  if (!signatureCanvas) {
    console.error('[signature] 找不到 #signature-canvas');
    return;
  }

  signatureCtx = signatureCanvas.getContext('2d');

  // 讓 Canvas 的實際像素大小等於顯示大小（防止模糊）
  resizeCanvas();

  // ── 設定畫筆樣式 ──
  signatureCtx.strokeStyle = '#1a1a1a';  // 畫筆顏色：接近黑色
  signatureCtx.lineWidth = 2.5;          // 畫筆粗細
  signatureCtx.lineCap = 'round';        // 線條端點：圓形（看起來更自然）
  signatureCtx.lineJoin = 'round';       // 線條轉折：圓形

  // ── 綁定滑鼠事件（電腦用）──
  signatureCanvas.addEventListener('mousedown', onMouseDown);
  signatureCanvas.addEventListener('mousemove', onMouseMove);
  signatureCanvas.addEventListener('mouseup', onMouseUp);
  signatureCanvas.addEventListener('mouseleave', onMouseUp);

  // ── 綁定觸控事件（手機/平板用）──
  signatureCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
  signatureCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
  signatureCanvas.addEventListener('touchend', onTouchEnd);

  // ── 綁定清除按鈕 ──
  const clearBtn = document.getElementById('clear-signature');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearSignature);
  }

  // 視窗大小改變時重新調整 Canvas 尺寸
  window.addEventListener('resize', resizeCanvas);
}

/**
 * 調整 Canvas 的實際像素大小
 * 解決 Canvas 在高 DPI 螢幕（Retina）上模糊的問題
 */
function resizeCanvas() {
  if (!signatureCanvas) return;

  // 取得 Canvas 顯示的 CSS 寬高
  const rect = signatureCanvas.getBoundingClientRect();
  // 取得裝置的像素比（Retina 螢幕通常是 2）
  const dpr = window.devicePixelRatio || 1;

  // 設定 Canvas 的實際像素大小（顯示大小 × 像素比）
  signatureCanvas.width = rect.width * dpr;
  signatureCanvas.height = rect.height * dpr;

  // 縮放繪圖上下文，讓畫出來的線條不會變粗
  signatureCtx.scale(dpr, dpr);

  // 重新設定畫筆樣式（resize 後會重置）
  signatureCtx.strokeStyle = '#1a1a1a';
  signatureCtx.lineWidth = 2.5;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
}

/**
 * 取得滑鼠在 Canvas 上的座標
 * @param {MouseEvent} e
 * @returns {{ x: number, y: number }}
 */
function getMousePos(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

/**
 * 取得觸控點在 Canvas 上的座標
 * @param {TouchEvent} e
 * @returns {{ x: number, y: number }}
 */
function getTouchPos(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

// ── 滑鼠事件處理 ──

function onMouseDown(e) {
  isDrawing = true;
  const pos = getMousePos(e);
  lastX = pos.x;
  lastY = pos.y;
  // 在起始點畫一個點（防止只點一下沒有墨水）
  signatureCtx.beginPath();
  signatureCtx.arc(lastX, lastY, 1, 0, Math.PI * 2);
  signatureCtx.fillStyle = '#1a1a1a';
  signatureCtx.fill();
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

// ── 觸控事件處理 ──

function onTouchStart(e) {
  // 防止觸控時頁面跟著滾動
  e.preventDefault();
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

/**
 * 在 Canvas 上畫一條線段
 * @param {number} x1 - 起點 X
 * @param {number} y1 - 起點 Y
 * @param {number} x2 - 終點 X
 * @param {number} y2 - 終點 Y
 */
function drawLine(x1, y1, x2, y2) {
  signatureCtx.beginPath();
  signatureCtx.moveTo(x1, y1);
  signatureCtx.lineTo(x2, y2);
  signatureCtx.stroke();
}

/**
 * 清除整個簽名板
 * 清除按鈕點擊時呼叫
 */
function clearSignature() {
  if (!signatureCanvas || !signatureCtx) return;
  const rect = signatureCanvas.getBoundingClientRect();
  signatureCtx.clearRect(0, 0, rect.width, rect.height);
  // 清除驗證錯誤樣式
  const wrapper = document.getElementById('signature-wrapper');
  if (wrapper) wrapper.classList.remove('error');
}

/**
 * 檢查簽名板是否為空白
 * 透過讀取所有像素，判斷是否有非透明像素
 * @returns {boolean} true = 空白，false = 有簽名
 */
function isSignatureEmpty() {
  if (!signatureCanvas) return true;
  const pixels = signatureCtx.getImageData(
    0, 0,
    signatureCanvas.width,
    signatureCanvas.height
  ).data;
  // 每 4 個值代表一個像素（R, G, B, A）
  // 只要有任何一個像素的 alpha 值 > 0，就不是空白
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) return false;
  }
  return true;
}

/**
 * 取得簽名圖片的 base64 字串
 * 用於送出資料給 Workers，或嵌入 PDF
 * @returns {string} base64 PNG 圖片字串
 */
function getSignatureDataUrl() {
  if (!signatureCanvas) return '';
  return signatureCanvas.toDataURL('image/png');
}
