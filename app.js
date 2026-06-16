/* ══════════════════════════════════════════
   app.js — 主程式入口
   職責：初始化所有副程式，處理送出流程
   ──────────────────────────────────────────
   這個檔案是整個系統的指揮中心：
   1. 頁面載入後初始化各副程式
   2. 填入今天日期
   3. 載入條文資料，交給 clause-renderer.js 渲染
   4. 處理送出按鈕的點擊事件
   5. 呼叫 pdf-client.js 生成 PDF
   ──────────────────────────────────────────
   目前使用暫時測試用的假資料（clauses 陣列）
   正式版本會從 Cloudflare Workers 取得真實資料
══════════════════════════════════════════ */

/* ════════════════════════════════════════
   暫時測試用條文資料
   正式版本這段會改成從 Workers API 取得
   格式說明：
   - type: 'fixed'      → 固定條文，不可修改
   - type: 'selectable' → 店家已選擇一個選項
════════════════════════════════════════ */
const TEST_CLAUSES = [
  {
    id: 1,
    title: '第一條（契約目的與範圍）',
    type: 'fixed',
    content: '犬、貓美容服務，指提供犬、貓洗澡、毛髮整理、修剪、美容造型及相關服務。本契約適用於甲方（飼主）委託乙方（美容店）為其犬、貓提供美容服務之情形。',
    options: null,
    selected: null
  },
  {
    id: 2,
    title: '第二條（契約審閱期間）',
    type: 'fixed',
    content: '甲方有權審閱本契約至少一日。乙方不得以任何方式限制甲方之審閱期間。',
    options: null,
    selected: null
  },
  {
    id: 3,
    title: '第三條（當事人基本資料）',
    type: 'fixed',
    content: '甲方（飼主）及乙方（美容店）之基本資料如本契約首頁所載。',
    options: null,
    selected: null
  },
  {
    id: 8,
    title: '第八條（解約手續費）',
    type: 'selectable',
    content: null,
    options: [
      { key: 'none',    label: '不收取',    content: '甲方解約時，乙方不收取任何手續費。' },
      { key: 'fixed',   label: '定額100元', content: '甲方解約時，應支付乙方解約手續費新臺幣一百元整。' },
      { key: 'percent', label: '不定額',    content: '甲方解約時，應支付乙方解約手續費，金額為契約總費用之一定比例。' }
    ],
    selected: 'none'
  }
];

/* ════════════════════════════════════════
   店家基本資料（暫時測試用）
   正式版本會從 Workers API 取得
════════════════════════════════════════ */
const TEST_SHOP = {
  company_name: '測試寵物美容店',
  default_vet: '台中市動物醫院'
};

/* ════════════════════════════════════════
   頁面載入完成後執行初始化
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // ── 初始化各副程式 ──
  initSignature();         // 簽名板（signature.js）
  fillSignDate();          // 填入今天日期
  loadShopData();          // 載入店家資料
  loadClauses();           // 載入並渲染條文
  bindSubmitButton();      // 綁定送出按鈕
});

/**
 * 填入今天的簽約日期
 * 日期格式：YYYY年MM月DD日
 */
function fillSignDate() {
  const dateInput = document.getElementById('sign-date');
  if (!dateInput) return;

  const today = new Date();
  const year = today.getFullYear();
  // getMonth() 從 0 開始，所以要 +1
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  dateInput.value = `${year}年${month}月${day}日`;
}

/**
 * 載入店家資料，填入頁首
 * 目前使用測試資料，正式版本改為 API 呼叫
 */
function loadShopData() {
  const shopNameEl = document.getElementById('shop-name');
  if (shopNameEl) {
    shopNameEl.textContent = TEST_SHOP.company_name;
  }

  // 如果客戶沒有填指定獸醫，之後 PDF 生成時會帶入店家預設
  // 這裡只是儲存預設值，不影響頁面顯示
  window.defaultVet = TEST_SHOP.default_vet;
}

/**
 * 載入條文資料並渲染到頁面
 * 呼叫 clause-renderer.js 的 renderClauses()
 */
function loadClauses() {
  // 目前使用測試資料
  // 正式版本：從 Workers API 取得後傳入 renderClauses()
  renderClauses(TEST_CLAUSES);
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
 * 依序執行：驗證 → 確認簽名 → 生成 PDF → 顯示完成
 */
async function handleSubmit() {
  const submitBtn = document.getElementById('submit-btn');
  const errorMessage = document.getElementById('error-message');

  // 隱藏上次的錯誤訊息
  errorMessage.hidden = true;

  // ── 步驟一：表單驗證（form-validator.js）──
  const isValid = validateForm();
  if (!isValid) {
    // validateForm() 已經在欄位下方顯示錯誤，這裡不需要額外處理
    return;
  }

  // ── 步驟二：檢查簽名是否為空（signature.js）──
  if (isSignatureEmpty()) {
    const signatureWrapper = document.getElementById('signature-wrapper');
    if (signatureWrapper) signatureWrapper.classList.add('error');
    // 捲動到簽名板
    document.getElementById('signature-section')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    showGlobalError('請完成簽名後再送出');
    return;
  }

  // ── 步驟三：生成 PDF（pdf-client.js）──
  submitBtn.textContent = '生成 PDF 中...';
  submitBtn.classList.add('loading');

  try {
    // 收集表單資料
    const formData = collectFormData();
    // 取得簽名圖片
    const signatureDataUrl = getSignatureDataUrl();

    // 呼叫 pdf-client.js 生成 PDF
    const pdfBytes = await generatePDF(formData, signatureDataUrl, TEST_CLAUSES, TEST_SHOP);

    // 儲存 PDF 供下載按鈕使用
    window.generatedPdfBytes = pdfBytes;

    // ── 步驟四：顯示完成畫面 ──
    showSuccessScreen();

  } catch (err) {
    // PDF 生成失敗
    console.error('[app] PDF 生成失敗：', err);
    showGlobalError('PDF 生成失敗，請重試。如問題持續請聯絡店家。');
    submitBtn.textContent = '確認簽署並送出';
    submitBtn.classList.remove('loading');
  }
}

/**
 * 收集所有表單欄位的值
 * @returns {Object} 表單資料物件
 */
function collectFormData() {
  return {
    ownerName:      document.getElementById('owner-name').value.trim(),
    ownerId:        document.getElementById('owner-id').value.trim(),
    ownerAddress:   document.getElementById('owner-address').value.trim(),
    ownerPhone:     document.getElementById('owner-phone').value.trim(),
    emergencyName:  document.getElementById('emergency-name').value.trim(),
    emergencyPhone: document.getElementById('emergency-phone').value.trim(),
    // 指定獸醫：如果空白，使用店家預設
    vetName:        document.getElementById('vet-name').value.trim()
                    || window.defaultVet || '',
    petChip:        document.getElementById('pet-chip').value.trim(),
    signDate:       document.getElementById('sign-date').value
  };
}

/**
 * 顯示全域錯誤訊息（在送出按鈕上方）
 * @param {string} message - 錯誤訊息
 */
function showGlobalError(message) {
  const errorMessage = document.getElementById('error-message');
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 顯示完成畫面，隱藏表單
 * 綁定 PDF 下載按鈕
 */
function showSuccessScreen() {
  // 隱藏所有輸入區塊
  document.getElementById('clause-section').hidden = true;
  document.getElementById('agreement-section').hidden = true;
  document.getElementById('form-section').hidden = true;
  document.getElementById('signature-section').hidden = true;
  document.getElementById('submit-section').hidden = true;

  // 顯示完成畫面
  const successSection = document.getElementById('success-section');
  successSection.hidden = false;
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 綁定下載 PDF 按鈕
  const downloadBtn = document.getElementById('download-pdf-btn');
  if (downloadBtn && window.generatedPdfBytes) {
    downloadBtn.addEventListener('click', () => {
      // 建立下載連結
      const blob = new Blob([window.generatedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `寵物美容契約_${document.getElementById('sign-date').value}.pdf`;
      a.click();
      // 釋放記憶體
      URL.revokeObjectURL(url);
    });
  }
}
