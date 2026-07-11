/* ══════════════════════════════════════════
   form-validator.js — 表單驗證副程式
   職責：依店家設定的必填欄位清單驗證表單
   ──────────────────────────────────────────
   2026/07/08 重寫：
   - 舊版必填清單寫死＋兩層 return true 全放行（測試階段設定），
     整段廢除。必填改由店家設定（KV shop: 的 required_fields）決定
   - required_fields 未設定（undefined/空陣列）= 全部選填
     （2026/07/08 使用者拍板）
   - 同意勾選（agreement-checkbox）為法律必要，永遠必勾，不受設定影響
   - 格式驗證（身分證、電話）與必填脫鉤：欄位有填才檢查格式，
     沒填且非必填就放行
   - showError 更名 showFieldError（原與 submit-flow.js 的
     showError 全域同名衝突，後載入者會蓋掉前者）
   ──────────────────────────────────────────
   依賴（同頁 <script> 全域共用）：
   - CONTRACT_FIELDS（field-registry.js）：欄位 id → 標籤對照
   ──────────────────────────────────────────
   驗證失敗時：
   1. 在欄位下方顯示錯誤提示文字（欄位旁提示，2026/07/08 拍板）
   2. 在欄位加上 .error class（CSS 顯示紅框）
   3. 捲動到第一個錯誤欄位
══════════════════════════════════════════ */

// 格式驗證規則：欄位 id → 檢查函式與錯誤訊息
// 只在「欄位有填值」時套用（必填與否交給 required_fields）
const FORMAT_RULES = {
  'owner-id':        { check: isValidId,    message: '身分證號格式不正確（例：A123456789）' },
  'owner-phone':     { check: isValidPhone, message: '電話格式不正確（例：0912345678 或 04-12345678）' },
  'emergency-phone': { check: isValidPhone, message: '電話格式不正確（例：0987654321）' },
};

/**
 * 執行表單驗證
 * @param {Array<string>|undefined} requiredFields - 店家設定的必填欄位 id 清單
 *        （來自 shopConfig.required_fields；未設定視為全部選填）
 * @returns {boolean} true = 全部通過，false = 有錯誤
 *
 * 注意：簽名檢查不在這個函式，在 submit-flow.js 用簽名板實例的 isEmpty()
 */
function validateForm(requiredFields) {
  clearAllErrors();

  const required = Array.isArray(requiredFields) ? requiredFields : [];
  let firstErrorEl = null;

  // ── 1. 同意勾選：永遠必勾（法律必要，不開放店家設定）──
  const agreement = document.getElementById('agreement-checkbox');
  if (agreement && !agreement.checked) {
    const section = document.getElementById('agreement-section');
    showErrorAfter(section, '請勾選同意契約條款後再繼續');
    firstErrorEl = firstErrorEl || section;
  }

  // ── 2. 依店家設定檢查必填 ──
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;  // 設定裡有但頁面沒有的欄位（版本差異）直接略過

    if (!el.value.trim()) {
      const field = CONTRACT_FIELDS.find(f => f.id === id);
      const label = field ? field.label : '此欄位';
      showFieldError(el, `請填寫${label}`);
      firstErrorEl = firstErrorEl || el;
    }
  });

  // ── 3. 格式驗證：有填才檢查（與必填脫鉤）──
  Object.entries(FORMAT_RULES).forEach(([id, rule]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = el.value.trim();
    // 已被必填擋下的欄位不重複標錯
    if (!value || el.classList.contains('error')) return;

    if (!rule.check(value)) {
      showFieldError(el, rule.message);
      firstErrorEl = firstErrorEl || el;
    }
  });

  // 捲動到第一個錯誤欄位
  if (firstErrorEl) {
    firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

/**
 * 依店家設定在欄位標籤加上紅色必填星號
 * 由 app.js 在 loadConfig 成功後呼叫一次
 * （2026/07/08 起 index.html 不再寫死星號，全部動態標示）
 * @param {Array<string>|undefined} requiredFields - shopConfig.required_fields
 */
function markRequiredFields(requiredFields) {
  const required = Array.isArray(requiredFields) ? requiredFields : [];
  required.forEach(id => {
    const label = document.querySelector(`label[for="${id}"]`);
    if (!label || label.querySelector('.required')) return;  // 找不到或已標過就略過

    const star = document.createElement('span');
    star.className = 'required';
    star.textContent = '*';
    label.appendChild(document.createTextNode(' '));
    label.appendChild(star);
  });
}

/**
 * 在欄位下方顯示錯誤提示
 * （原名 showError，2026/07/08 更名避免與 submit-flow.js 全域衝突）
 * @param {HTMLElement} inputEl - 有問題的 input 元素
 * @param {string} message - 錯誤訊息
 */
function showFieldError(inputEl, message) {
  inputEl.classList.add('error');

  const errorSpan = document.createElement('span');
  errorSpan.className = 'field-error';
  errorSpan.textContent = message;

  // 插入到 input 元素後方（同一個 .form-group 內，顯示在欄位正下方）
  inputEl.parentNode.insertBefore(errorSpan, inputEl.nextSibling);
}

/**
 * 在某個元素後方顯示錯誤提示（用於非 input 元素，如同意勾選區塊）
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
  document.querySelectorAll('.error').forEach(el => {
    el.classList.remove('error');
  });
  document.querySelectorAll('.field-error').forEach(el => {
    el.remove();
  });
}

/**
 * 驗證身分證號格式
 * 規則：身分證＝英文字母 + 9 碼數字；居留證＝兩碼英文 + 8 碼數字
 * @param {string} id
 * @returns {boolean}
 */
function isValidId(id) {
  const twId = /^[A-Z][0-9]{9}$/i;
  const residenceId = /^[A-Z]{2}[0-9]{8}$/i;
  return twId.test(id) || residenceId.test(id);
}

/**
 * 驗證電話格式
 * 涵蓋：手機（09 開頭 10 碼）、市話（含區碼）
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const mobile = /^09\d{8}$/;
  const landline = /^0\d{8,11}$/;
  return mobile.test(cleaned) || landline.test(cleaned);
}
