/* ══════════════════════════════════════════
   form-validator.js — 表單驗證副程式
   職責：驗證所有表單欄位是否填寫正確
   輸入：無（直接讀取頁面上的 input 元素）
   輸出：true（驗證通過）或 false（有錯誤）
   ──────────────────────────────────────────
   驗證失敗時：
   1. 在欄位下方顯示錯誤提示文字
   2. 在欄位加上 .error class（CSS 顯示紅框）
   3. 捲動到第一個錯誤欄位
══════════════════════════════════════════ */

/**
 * 執行所有欄位驗證
 * @returns {boolean} true = 全部通過，false = 有錯誤
 *
 * ⚠️ 測試階段設定（2026/06/16）：
 * 目前暫時放寬所有欄位必填驗證，方便快速測試。
 * 下方原本的完整驗證邏輯保留在 validateFormStrict()，
 * 正式版本只要把這裡改成 return validateFormStrict() 即可恢復。
 * 注意：簽名檢查不在這個函式，在 app.js 用簽名板實例的 isEmpty()，不受影響。
 */
function validateForm() {
  // 測試階段：清除舊錯誤後直接通過
  clearAllErrors();
  return true;
}

/**
 * 完整驗證邏輯（正式版本使用）
 * 測試階段暫時不呼叫，保留供日後恢復
 * @returns {boolean} true = 全部通過，false = 有錯誤
 */
function validateFormStrict() {
  // ════════════════════════════════════════
  // ⚠️ 測試模式：暫時跳過所有必填驗證
  // 測試完畢後，刪除下面這一行 return true; 即可恢復正常驗證
  // ════════════════════════════════════════
  return true;

  // 先清除所有上次的錯誤提示
  clearAllErrors();

  // 記錄是否有錯誤
  let hasError = false;
  // 記錄第一個錯誤的元素（用於捲動定位）
  let firstErrorEl = null;

  // ── 逐一驗證每個欄位 ──

  // 姓名：必填，2-20 字
  const ownerName = document.getElementById('owner-name');
  if (!ownerName.value.trim()) {
    showError(ownerName, '請輸入姓名');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerName;
  } else if (ownerName.value.trim().length < 2) {
    showError(ownerName, '姓名至少需要 2 個字');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerName;
  }

  // 身分證號：必填，格式驗證
  const ownerId = document.getElementById('owner-id');
  if (!ownerId.value.trim()) {
    showError(ownerId, '請輸入身分證號或居留證號碼');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerId;
  } else if (!isValidId(ownerId.value.trim())) {
    showError(ownerId, '身分證號格式不正確（例：A123456789）');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerId;
  }

  // 通訊地址：必填
  const ownerAddress = document.getElementById('owner-address');
  if (!ownerAddress.value.trim()) {
    showError(ownerAddress, '請輸入通訊地址');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerAddress;
  }

  // 聯絡電話：必填，格式驗證
  const ownerPhone = document.getElementById('owner-phone');
  if (!ownerPhone.value.trim()) {
    showError(ownerPhone, '請輸入聯絡電話');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerPhone;
  } else if (!isValidPhone(ownerPhone.value.trim())) {
    showError(ownerPhone, '電話格式不正確（例：0912345678 或 04-12345678）');
    hasError = true;
    firstErrorEl = firstErrorEl || ownerPhone;
  }

  // 緊急聯絡人姓名：必填
  const emergencyName = document.getElementById('emergency-name');
  if (!emergencyName.value.trim()) {
    showError(emergencyName, '請輸入緊急聯絡人姓名');
    hasError = true;
    firstErrorEl = firstErrorEl || emergencyName;
  }

  // 緊急聯絡人電話：必填，格式驗證
  const emergencyPhone = document.getElementById('emergency-phone');
  if (!emergencyPhone.value.trim()) {
    showError(emergencyPhone, '請輸入緊急聯絡人電話');
    hasError = true;
    firstErrorEl = firstErrorEl || emergencyPhone;
  } else if (!isValidPhone(emergencyPhone.value.trim())) {
    showError(emergencyPhone, '電話格式不正確（例：0987654321）');
    hasError = true;
    firstErrorEl = firstErrorEl || emergencyPhone;
  }

  // 寵物晶片號碼：必填
  const petChip = document.getElementById('pet-chip');
  if (!petChip.value.trim()) {
    showError(petChip, '請輸入寵物晶片號碼或辨識資訊');
    hasError = true;
    firstErrorEl = firstErrorEl || petChip;
  }

  // 同意勾選：必勾
  const agreement = document.getElementById('agreement-checkbox');
  if (!agreement.checked) {
    // 同意勾選的錯誤顯示在 #agreement-section 下方
    const section = document.getElementById('agreement-section');
    showErrorAfter(section, '請勾選同意契約條款後再繼續');
    hasError = true;
    firstErrorEl = firstErrorEl || section;
  }

  // 如果有錯誤，捲動到第一個錯誤欄位
  if (hasError && firstErrorEl) {
    firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // 回傳驗證結果
  return !hasError;
}

/**
 * 在欄位下方顯示錯誤提示
 * @param {HTMLElement} inputEl - 有問題的 input 元素
 * @param {string} message - 錯誤訊息
 */
function showError(inputEl, message) {
  // 在 input 加上紅框 class
  inputEl.classList.add('error');

  // 建立錯誤提示文字元素
  const errorSpan = document.createElement('span');
  errorSpan.className = 'field-error';
  errorSpan.textContent = message;

  // 插入到 input 元素後方
  inputEl.parentNode.insertBefore(errorSpan, inputEl.nextSibling);
}

/**
 * 在某個元素後方顯示錯誤提示（用於非 input 元素）
 * @param {HTMLElement} el - 目標元素
 * @param {string} message - 錯誤訊息
 */
function showErrorAfter(el, message) {
  const errorSpan = document.createElement('span');
  errorSpan.className = 'field-error';
  errorSpan.style.display = 'block';
  errorSpan.style.marginTop = '8px';
  errorSpan.textContent = message;
  el.appendChild(errorSpan);
}

/**
 * 清除所有錯誤提示
 * 每次重新驗證前呼叫，避免重複顯示
 */
function clearAllErrors() {
  // 移除所有欄位的紅框
  document.querySelectorAll('.error').forEach(el => {
    el.classList.remove('error');
  });
  // 移除所有錯誤提示文字
  document.querySelectorAll('.field-error').forEach(el => {
    el.remove();
  });
}

/**
 * 驗證身分證號格式
 * 規則：第一碼英文字母 + 9 碼數字（共 10 碼）
 * 涵蓋：中華民國身分證、居留證
 * @param {string} id - 身分證號字串
 * @returns {boolean}
 */
function isValidId(id) {
  // 身分證：英文字母開頭 + 9 碼數字
  const twId = /^[A-Z][0-9]{9}$/i;
  // 居留證：兩碼英文 + 8 碼數字
  const residenceId = /^[A-Z]{2}[0-9]{8}$/i;
  return twId.test(id) || residenceId.test(id);
}

/**
 * 驗證電話格式
 * 涵蓋：手機（09 開頭 10 碼）、市話（含區碼）
 * @param {string} phone - 電話號碼字串
 * @returns {boolean}
 */
function isValidPhone(phone) {
  // 移除所有空白、連字號、括號後再驗證
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // 手機：09 開頭 10 碼
  const mobile = /^09\d{8}$/;
  // 市話：區碼 2-4 碼 + 號碼 6-8 碼，共 8-12 碼
  const landline = /^0\d{8,11}$/;
  return mobile.test(cleaned) || landline.test(cleaned);
}