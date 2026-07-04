/* ══════════════════════════════════════════
   app.js — 主程式入口
   職責：初始化所有副程式，處理送出流程
   ──────────────────────────────────────────
   流程：
   1. 頁面載入 → 從 Worker GET /config 取得店家設定和條文
   2. 填入頁首店家名稱、填入今天日期
   3. 條文交給 clause-renderer.js 渲染
   4. 使用者填表 + 簽名 → 送出
   5. 前端生成 PDF → POST 給 Worker → 顯示完成
══════════════════════════════════════════ */

// Worker API 網址（統一在這裡修改）
const WORKER_URL = 'https://pet-contract.pet-cont-mor.workers.dev';

// 目前店家 ID（從網址參數 ?shop_id= 取得，見 shop-id.js）
const SHOP_ID = getShopId();

// 儲存從 Worker 取得的資料（給 PDF 生成用）
let shopData = null;
let clausesData = [];

// 目前店家的版本模式（從 KV 的 shop 設定讀取，見 loadConfig）
// "6" = 基底（當面簽、自行下載）；"5" = 加自動寄信；"7" = LINE
// 讀不到時預設 "6"（最基本、不依賴外部服務，最安全的 fallback）
let currentMode = '6';

// 設定是否載入成功（控制能否送出）
// 只有成功取得店家設定與條文才為 true；店號不存在/載入失敗則維持 false
// 防止在「沒有條文」的狀態下產生無效 PDF
let configLoaded = false;

// 甲乙雙方簽名板實例（signature.js 工廠模式，DOMContentLoaded 時建立）
let signaturePadA = null;
let signaturePadB = null;

/* ════════════════════════════════════════
   頁面載入後初始化
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化甲乙雙方簽名板（signature.js 工廠模式）
  signaturePadA = createSignaturePad({
    canvasId: 'signature-canvas',
    clearBtnId: 'clear-signature',
    wrapperId: 'signature-wrapper',
  });
  signaturePadB = createSignaturePad({
    canvasId: 'signature-canvas-b',
    clearBtnId: 'clear-signature-b',
    wrapperId: 'signature-wrapper-b',
  });

  // 填入今天日期
  fillSignDate();

  // 從 Worker 載入店家設定和條文
  await loadConfig();

  // 綁定送出按鈕
  bindSubmitButton();
});

/**
 * 從 Worker 取得店家設定和條文資料
 * 成功後填入頁首、渲染條文
 */
async function loadConfig() {
  try {
    const response = await fetch(`${WORKER_URL}/config?shop_id=${SHOP_ID}`);
    const data = await response.json();

    if (data.success) {
      // 儲存資料供後續使用
      shopData = data.shopConfig;
      clausesData = data.clauses;

      // 讀取版本模式（mode 是 shopConfig 的一個欄位，由系統方建置時寫入）
      // 無 mode 欄位的舊資料 → 維持預設 "6"
      currentMode = shopData.mode || '6';

      // 填入頁首店家名稱
      const shopNameEl = document.getElementById('shop-name');
      if (shopNameEl) shopNameEl.textContent = shopData.company_name || '';

      // 儲存預設獸醫供表單使用
      window.defaultVet = shopData.default_vet || '';

      // 渲染條文（clause-renderer.js）
      renderClauses(clausesData);

      // 設定載入成功，允許送出
      configLoaded = true;

    } else {
      // 找不到店家設定（店號不存在 / 尚未完成設定）
      console.warn('[app] 找不到店家設定，停用送出');
      const shopNameEl = document.getElementById('shop-name');
      if (shopNameEl) shopNameEl.textContent = '（查無此店家，無法簽約）';
      disableSubmit('查無此店家設定，無法簽約。請確認連結是否正確或聯絡店家。');
    }

  } catch (err) {
    // 網路錯誤或 Worker 未部署
    console.error('[app] 載入設定失敗：', err);
    const shopNameEl = document.getElementById('shop-name');
    if (shopNameEl) shopNameEl.textContent = '（載入失敗，請重新整理）';
    disableSubmit('資料載入失敗，請重新整理頁面後再試。');
  }
}

/**
 * 停用送出按鈕並顯示原因
 * 用於：店號不存在、設定載入失敗等情況，防止產生無效 PDF
 * @param {string} reason - 顯示給使用者的原因
 */
function disableSubmit(reason) {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '無法簽約';
  }
  // 在送出區顯示原因（若有對應元素）
  const submitSection = document.getElementById('submit-section');
  if (submitSection) {
    const hint = document.createElement('p');
    hint.className = 'submit-disabled-hint';
    hint.textContent = reason;
    submitSection.appendChild(hint);
  }
}

/**
 * 填入今天的簽約日期
 * 格式：YYYY年MM月DD日
 */
function fillSignDate() {
  const dateInput = document.getElementById('sign-date');
  if (!dateInput) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  dateInput.value = `${year}年${month}月${day}日`;
}

/**
 * 綁定送出按鈕的點擊事件
 */
function bindSubmitButton() {
  const submitBtn = document.getElementById('submit-btn');
  if (!submitBtn) return;
  submitBtn.addEventListener('click', handleSubmit);
}

/**
 * 處理送出流程
 * 步驟：驗證 → 確認簽名 → 生成 PDF → POST 給 Worker → 顯示完成
 */
async function handleSubmit() {
  const submitBtn = document.getElementById('submit-btn');
  const errorMessage = document.getElementById('error-message');

  // 防護：設定未成功載入（店號不存在/載入失敗）一律不可送出
  // 這是真正的擋；按鈕 disabled 只是 UI，函式檢查才防得住繞過
  if (!configLoaded) {
    errorMessage.textContent = '無法簽約：店家設定未正確載入。';
    errorMessage.hidden = false;
    return;
  }

  errorMessage.hidden = true;

  // 步驟一：表單驗證（form-validator.js）
  const isValid = validateForm();
  if (!isValid) return;

  // 步驟二：確認甲乙雙方簽名皆不為空（signature.js）
  if (signaturePadA.isEmpty()) {
    const wrapperA = document.getElementById('signature-wrapper');
    if (wrapperA) wrapperA.classList.add('error');
    document.getElementById('signature-section')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    showGlobalError('請完成甲方簽名後再送出');
    return;
  }
  if (signaturePadB.isEmpty()) {
    const wrapperB = document.getElementById('signature-wrapper-b');
    if (wrapperB) wrapperB.classList.add('error');
    document.getElementById('signature-section-b')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    showGlobalError('請完成乙方（店家）簽名後再送出');
    return;
  }

  // 步驟三：生成 PDF（pdf-client.js）
  submitBtn.textContent = '生成 PDF 中...';
  submitBtn.classList.add('loading');

  try {
    const formData = collectFormData();
    const signatureDataUrl = signaturePadA.getDataUrl();   // 甲方
    const signatureDataUrlB = signaturePadB.getDataUrl();  // 乙方

    const pdfBytes = await generatePDF(
      formData,
      signatureDataUrl,
      signatureDataUrlB,
      clausesData,
      shopData || { company_name: '', default_vet: '' }
    );

    window.generatedPdfBytes = pdfBytes;

    // 步驟四：POST 資料給 Worker 存入 KV
    submitBtn.textContent = '儲存中...';
    try {
      const response = await fetch(`${WORKER_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: SHOP_ID,
          formData,
          signatureDataUrl,
          signatureDataUrlB,
          clauses: clausesData,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        console.warn('[app] Worker 儲存失敗：', result);
      }
    } catch (err) {
      console.warn('[app] Worker 呼叫失敗（不中斷流程）：', err);
    }

    // 步驟五：顯示完成畫面
    showSuccessScreen();

  } catch (err) {
    console.error('[app] PDF 生成失敗：', err);
    showGlobalError('PDF 生成失敗，請重試。如問題持續請聯絡店家。');
    submitBtn.textContent = '確認簽署並送出';
    submitBtn.classList.remove('loading');
  }
}

/**
 * 收集所有表單欄位的值
 * @returns {Object}
 */
function collectFormData() {
  return {
    ownerName:      document.getElementById('owner-name').value.trim(),
    ownerId:        document.getElementById('owner-id').value.trim(),
    ownerAddress:   document.getElementById('owner-address').value.trim(),
    ownerPhone:     document.getElementById('owner-phone').value.trim(),
    emergencyName:  document.getElementById('emergency-name').value.trim(),
    emergencyPhone: document.getElementById('emergency-phone').value.trim(),
    vetName:        document.getElementById('vet-name').value.trim() || window.defaultVet || '',
    petChip:        document.getElementById('pet-chip').value.trim(),
    signDate:       document.getElementById('sign-date').value,
  };
}

/**
 * 顯示全域錯誤訊息
 */
function showGlobalError(message) {
  const errorMessage = document.getElementById('error-message');
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 顯示完成畫面
 */
function showSuccessScreen() {
  document.getElementById('clause-section').hidden = true;
  document.getElementById('agreement-section').hidden = true;
  document.getElementById('form-section').hidden = true;
  document.getElementById('signature-section').hidden = true;
  document.getElementById('signature-section-b').hidden = true;
  document.getElementById('submit-section').hidden = true;

  const successSection = document.getElementById('success-section');
  successSection.hidden = false;
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const downloadBtn = document.getElementById('download-pdf-btn');
  if (downloadBtn && window.generatedPdfBytes) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([window.generatedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `寵物美容契約_${document.getElementById('sign-date').value}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
