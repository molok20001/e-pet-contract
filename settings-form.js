/* ══════════════════════════════════════════
   settings-form.js — 設定表單處理副程式
   職責：讀取/寫入設定表單欄位，呼叫 Worker API
   ──────────────────────────────────────────
   提供的函式：
   - fillShopForm(shopConfig)   把 KV 資料填入表單
   - collectShopForm()          從表單收集店家資料
   - renderClauseOptions(clauses) 渲染條文選項
   - collectClauseSelections()  收集條文選擇結果
   - saveShopConfig(shopId)     儲存店家設定到 Worker
   - saveClauseSelections(shopId, clauses) 儲存條文到 Worker
══════════════════════════════════════════ */

// Worker API 網址（全域設定，統一在這裡修改）
const WORKER_URL = 'https://pet-contract.pet-cont-mor.workers.dev';

/**
 * 把店家設定資料填入表單欄位
 * @param {Object} shopConfig - 從 KV 取得的店家設定
 */
function fillShopForm(shopConfig) {
  if (!shopConfig) return;

  // 逐一填入每個欄位（欄位 id 對應 shopConfig 的 key）
  const fieldMap = {
    'company-name':   shopConfig.company_name   || '',
    'owner-name':     shopConfig.owner_name     || '',
    'address':        shopConfig.address        || '',
    'business-hours': shopConfig.business_hours || '',
    'phone':          shopConfig.phone          || '',
    'default-vet':    shopConfig.default_vet    || '',
    'court':          shopConfig.court          || '',
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

/**
 * 從表單收集店家資料
 * @returns {Object} 店家設定物件
 */
function collectShopForm() {
  return {
    company_name:   document.getElementById('company-name')?.value.trim()   || '',
    owner_name:     document.getElementById('owner-name')?.value.trim()     || '',
    address:        document.getElementById('address')?.value.trim()        || '',
    business_hours: document.getElementById('business-hours')?.value.trim() || '',
    phone:          document.getElementById('phone')?.value.trim()          || '',
    default_vet:    document.getElementById('default-vet')?.value.trim()    || '',
    court:          document.getElementById('court')?.value.trim()          || '',
  };
}

/**
 * 渲染條文選項（selectable 類型的條文）
 * 在「條文選項設定」區塊動態生成下拉選單
 * @param {Array} clauses - 完整條文陣列
 */
function renderClauseOptions(clauses) {
  const container = document.getElementById('clause-options-container');
  if (!container) return;

  container.innerHTML = '';

  // 只渲染 selectable 類型的條文
  const selectableClauses = clauses.filter(c => c.type === 'selectable');

  if (selectableClauses.length === 0) {
    container.innerHTML = '<p class="no-options">目前沒有可選擇的條文選項。</p>';
    return;
  }

  selectableClauses.forEach(clause => {
    const group = document.createElement('div');
    group.className = 'clause-option-group';
    group.dataset.id = clause.id;

    // 條文標題
    const label = document.createElement('label');
    label.className = 'clause-option-label';
    label.textContent = clause.title;

    // 下拉選單
    const select = document.createElement('select');
    select.className = 'clause-option-select';
    select.id = `clause-select-${clause.id}`;

    // 填入選項
    clause.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.key;
      option.textContent = opt.label;
      // 標記目前已選的選項
      if (opt.key === clause.selected) option.selected = true;
      select.appendChild(option);
    });

    // 選項說明文字（顯示目前選擇的內容）
    const preview = document.createElement('p');
    preview.className = 'clause-option-preview';
    preview.id = `clause-preview-${clause.id}`;
    updatePreview(clause, select.value, preview);

    // 切換選項時更新說明
    select.addEventListener('change', () => {
      updatePreview(clause, select.value, preview);
    });

    group.appendChild(label);
    group.appendChild(select);
    group.appendChild(preview);
    container.appendChild(group);
  });
}

/**
 * 更新條文選項的說明文字
 * @param {Object} clause  - 條文資料
 * @param {string} key     - 目前選擇的 key
 * @param {HTMLElement} el - 說明文字的 DOM 元素
 */
function updatePreview(clause, key, el) {
  const opt = clause.options.find(o => o.key === key);
  el.textContent = opt ? opt.content : '';
}

/**
 * 收集條文選擇結果
 * 把使用者在下拉選單的選擇，更新回 clauses 陣列
 * @param {Array} clauses - 原始條文陣列
 * @returns {Array} 更新後的條文陣列
 */
function collectClauseSelections(clauses) {
  return clauses.map(clause => {
    if (clause.type !== 'selectable') return clause;

    const select = document.getElementById(`clause-select-${clause.id}`);
    if (!select) return clause;

    // 更新 selected 欄位
    return { ...clause, selected: select.value };
  });
}

/**
 * 儲存店家設定到 Worker
 * @param {string} shopId
 * @returns {Promise<boolean>} 成功回傳 true
 */
async function saveShopConfig(shopId) {
  const shopConfig = collectShopForm();

  // 基本驗證
  if (!shopConfig.company_name || !shopConfig.phone) {
    showSaveResult('請填寫店家名稱和聯絡電話', 'error');
    return false;
  }

  try {
    const response = await fetch(`${WORKER_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        shopConfig,
        auth_token: getAuthToken(),
      }),
    });

    const result = await response.json();
    if (result.success) {
      showSaveResult('店家資料已儲存', 'success');
      return true;
    } else {
      // 密碼錯誤（401）→ 清除暫存密碼，引導重新整理頁面登入
      if (response.status === 401) {
        clearAuthToken();
        showSaveResult('密碼已失效，請重新整理頁面後重新登入', 'error');
        return false;
      }
      showSaveResult(`儲存失敗：${result.error}`, 'error');
      return false;
    }
  } catch (err) {
    console.error('[settings-form] 儲存店家設定失敗：', err);
    showSaveResult('網路錯誤，請稍後再試', 'error');
    return false;
  }
}

/**
 * 儲存條文選擇到 Worker
 * @param {string} shopId
 * @param {Array}  clauses - 目前的條文陣列
 * @returns {Promise<boolean>}
 */
async function saveClauseSelections(shopId, clauses) {
  const updatedClauses = collectClauseSelections(clauses);

  try {
    const response = await fetch(`${WORKER_URL}/clauses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        clauses: updatedClauses,
        auth_token: getAuthToken(),
      }),
    });

    const result = await response.json();
    if (result.success) {
      showSaveResult('條文設定已儲存', 'success');
      return true;
    } else {
      // 密碼錯誤（401）→ 清除暫存密碼，引導重新整理頁面登入
      if (response.status === 401) {
        clearAuthToken();
        showSaveResult('密碼已失效，請重新整理頁面後重新登入', 'error');
        return false;
      }
      showSaveResult(`儲存失敗：${result.error}`, 'error');
      return false;
    }
  } catch (err) {
    console.error('[settings-form] 儲存條文失敗：', err);
    showSaveResult('網路錯誤，請稍後再試', 'error');
    return false;
  }
}

/**
 * 顯示儲存結果提示
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showSaveResult(message, type) {
  const el = document.getElementById('save-result');
  if (!el) return;
  el.textContent = message;
  el.className = `save-result ${type}`;
  el.hidden = false;

  // 3 秒後自動隱藏
  setTimeout(() => { el.hidden = true; }, 3000);
}
