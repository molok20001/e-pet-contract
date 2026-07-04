/* ══════════════════════════════════════════
   submit-flow.js — 送出流程狀態機
   職責：兩階段送出（甲方確認 → 乙方簽名 → 產生PDF）
   ──────────────────────────────────────────
   從 app.js 拆出的原因：
   app.js 原本身兼「初始化」與「送出流程」兩種職責，
   加上兩階段簽名流程後篇幅會超過拆分警戒線，
   故拆成獨立檔案，app.js 只負責初始化。
   ──────────────────────────────────────────
   依賴 app.js 宣告的模組層級變數（同頁多個 <script>，
   共用全域作用域，不需 import）：
   WORKER_URL, SHOP_ID, shopData, clausesData, configLoaded,
   signaturePadA, signaturePadB
   ──────────────────────────────────────────
   流程：
   1. bindSubmitButtons() 由 app.js 初始化時呼叫一次
   2. 第一階段（#submit-btn）：
      驗證表單＋甲方簽名 → 通過則藏起第一階段、顯示乙方簽名區
   3. 第二階段（#submit-btn-b）：
      驗證乙方簽名 → 產生 PDF → POST Worker → 顯示完成畫面
══════════════════════════════════════════ */

/**
 * 綁定兩階段送出按鈕的點擊事件
 * 由 app.js 在初始化時呼叫
 */
function bindSubmitButtons() {
  const submitBtn = document.getElementById('submit-btn');
  const submitBtnB = document.getElementById('submit-btn-b');
  if (submitBtn) submitBtn.addEventListener('click', handleSubmitStepA);
  if (submitBtnB) submitBtnB.addEventListener('click', handleSubmitStepB);
}

/**
 * 第一階段：驗證表單＋甲方簽名
 * 通過後藏起第一階段區塊，顯示乙方簽名區（不產生PDF）
 */
function handleSubmitStepA() {
  const errorMessage = document.getElementById('error-message');

  // 防護：設定未成功載入（店號不存在/載入失敗）一律不可送出
  // 這是真正的擋；按鈕 disabled 只是 UI，函式檢查才防得住繞過
  if (!configLoaded) {
    errorMessage.textContent = '無法簽約：店家設定未正確載入。';
    errorMessage.hidden = false;
    return;
  }
  errorMessage.hidden = true;

  // 表單驗證（form-validator.js）
  const isValid = validateForm();
  if (!isValid) return;

  // 確認甲方簽名不為空（signature.js）
  if (signaturePadA.isEmpty()) {
    const wrapperA = document.getElementById('signature-wrapper');
    if (wrapperA) wrapperA.classList.add('error');
    document.getElementById('signature-section')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    showError(errorMessage, '請完成甲方簽名後再送出');
    return;
  }

  // 通過：第一階段結束，換手給店員簽乙方
  document.getElementById('submit-section').hidden = true;
  const sectionB = document.getElementById('signature-section-b');
  sectionB.hidden = false;
  sectionB.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 第二階段：驗證乙方簽名，通過後才真正產生 PDF、送出 Worker、顯示完成畫面
 */
async function handleSubmitStepB() {
  const submitBtnB = document.getElementById('submit-btn-b');
  const errorMessageB = document.getElementById('error-message-b');
  errorMessageB.hidden = true;

  // 確認乙方簽名不為空（signature.js）
  if (signaturePadB.isEmpty()) {
    const wrapperB = document.getElementById('signature-wrapper-b');
    if (wrapperB) wrapperB.classList.add('error');
    showError(errorMessageB, '請完成乙方（店家）簽名後再送出');
    return;
  }

  submitBtnB.disabled = true;
  submitBtnB.textContent = '生成 PDF 中...';
  submitBtnB.classList.add('loading');

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

    // POST 資料給 Worker 存入 KV（失敗不擋流程，PDF 已經在使用者手上）
    submitBtnB.textContent = '儲存中...';
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
        console.warn('[submit-flow] Worker 儲存失敗：', result);
      }
    } catch (err) {
      console.warn('[submit-flow] Worker 呼叫失敗（不中斷流程）：', err);
    }

    showSuccessScreen();

  } catch (err) {
    console.error('[submit-flow] PDF 生成失敗：', err);
    showError(errorMessageB, 'PDF 生成失敗，請重試。如問題持續請聯絡店家。');
    submitBtnB.textContent = '確認簽署，產生契約 PDF';
    submitBtnB.classList.remove('loading');
  }

  submitBtnB.disabled = false;
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
 * 顯示指定錯誤元素的訊息，並捲動至可視範圍
 * @param {HTMLElement} errorEl
 * @param {string} message
 */
function showError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
