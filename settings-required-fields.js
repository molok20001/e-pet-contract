/* ══════════════════════════════════════════
   settings-required-fields.js — 必填欄位設定視窗
   職責：設定頁的「簽約頁必填欄位」勾選視窗
   ──────────────────────────────────────────
   新開檔案的原因：settings-form.js 已 249 行接近
   拆分警戒線，且本功能職責獨立（視窗 UI + 狀態）。
   ──────────────────────────────────────────
   依賴（同頁 <script> 全域共用，不需 import）：
   - CONTRACT_FIELDS, FIELD_GROUP_LABELS（field-registry.js）
   - saveShopConfig()（settings-form.js）
   - SHOP_ID（settings-app.js）
   ──────────────────────────────────────────
   資料流：
   1. loadSettings 取得 shopConfig 後，fillShopForm 呼叫
      initRequiredFields(shopConfig.required_fields) 存入本檔狀態
   2. 每次 POST /config 時，collectShopForm 呼叫 getRequiredFields()
      把狀態帶上（POST /config 是整包覆蓋，漏帶會把設定洗掉）
   3. 視窗按「儲存」→ 更新狀態 → 走既有 saveShopConfig 存檔
══════════════════════════════════════════ */

// 模組層級狀態：目前的必填欄位 id 清單
// 未設定過（undefined）視為空陣列 = 全部選填（2026/07/08 使用者拍板）
let currentRequiredFields = [];

/**
 * 初始化必填欄位狀態（由 fillShopForm 呼叫）
 * @param {Array|undefined} fields - shopConfig.required_fields
 */
function initRequiredFields(fields) {
  currentRequiredFields = Array.isArray(fields) ? fields : [];
}

/**
 * 取得目前必填欄位清單（由 collectShopForm 呼叫，隨每次儲存帶上）
 * @returns {Array<string>} 欄位 id 陣列
 */
function getRequiredFields() {
  return currentRequiredFields;
}

/**
 * 綁定「設定必填欄位」按鈕與視窗內按鈕
 * 頁面載入時執行一次（視窗在驗證通過後才看得到，綁定本身無害）
 */
document.addEventListener('DOMContentLoaded', () => {
  const openBtn   = document.getElementById('required-fields-btn');
  const dialog    = document.getElementById('required-fields-dialog');
  const saveBtn   = document.getElementById('required-fields-save');
  const cancelBtn = document.getElementById('required-fields-cancel');
  if (!openBtn || !dialog) return;

  openBtn.addEventListener('click', () => {
    renderRequiredFieldsChecklist();
    dialog.showModal();
  });

  cancelBtn.addEventListener('click', () => dialog.close());

  saveBtn.addEventListener('click', async () => {
    // 收集勾選結果 → 更新狀態 → 走既有儲存路徑（會整包帶上店家資料）
    currentRequiredFields = Array.from(
      dialog.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    const ok = await saveShopConfig(SHOP_ID);  // settings-form.js
    saveBtn.disabled = false;
    saveBtn.textContent = '儲存必填設定';
    if (ok) dialog.close();
    // 失敗時視窗留著，錯誤訊息由 saveShopConfig 的 showSaveResult 顯示
  });
});

/**
 * 依 CONTRACT_FIELDS 渲染分組 checkbox 清單
 * 每次開視窗時重新渲染，勾選狀態以 currentRequiredFields 為準
 */
function renderRequiredFieldsChecklist() {
  const container = document.getElementById('required-fields-list');
  if (!container) return;
  container.innerHTML = '';

  // 依 group 分組渲染（順序照 FIELD_GROUP_LABELS 宣告）
  Object.entries(FIELD_GROUP_LABELS).forEach(([group, groupLabel]) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'required-fields-group';

    const legend = document.createElement('legend');
    legend.textContent = groupLabel;
    fieldset.appendChild(legend);

    CONTRACT_FIELDS.filter(f => f.group === group).forEach(field => {
      const label = document.createElement('label');
      label.className = 'required-field-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = field.id;
      checkbox.checked = currentRequiredFields.includes(field.id);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(field.label));
      fieldset.appendChild(label);
    });

    container.appendChild(fieldset);
  });
}
