/* ══════════════════════════════════════════
   settings-app.js — 設定頁主程式入口
   職責：初始化設定頁，協調各副程式
   ──────────────────────────────────────────
   流程：
   1. 頁面載入 → 呼叫 settings-auth.js 的 initAuth()
   2. 驗證通過（auth:success 事件）→ 從 Worker 載入資料
   3. 填入表單欄位，渲染條文選項
   4. 綁定儲存按鈕
══════════════════════════════════════════ */

// 目前操作的店家 ID（從網址參數 ?shop_id= 取得，見 shop-id.js）
const SHOP_ID = getShopId();

// Worker API 網址（依店號查對照表，見 backend-registry.js；與 settings-form.js 一致）
const SETTINGS_WORKER_URL = getWorkerUrl(SHOP_ID);

// 儲存目前的條文資料（collectClauseSelections 需要用到）
let currentClauses = [];

/* ════════════════════════════════════════
   頁面載入後初始化
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // 執行身份驗證（settings-auth.js）
  // 顯示密碼牆，驗證通過後才呼叫 loadSettings 載入設定內容
  initAuth(loadSettings);
});

/**
 * 載入設定資料
 * 從 Worker GET /config 取得店家設定和條文
 */
async function loadSettings() {
  const loadingSection = document.getElementById('loading-section');
  const settingsSection = document.getElementById('settings-section');

  try {
    const response = await fetch(
      `${SETTINGS_WORKER_URL}/config?shop_id=${SHOP_ID}`
    );

    if (response.status === 404) {
      // KV 裡還沒有這家店的資料（第一次設定）
      // 顯示空白表單，讓系統方填入
      loadingSection.hidden = true;
      settingsSection.hidden = false;
      bindButtons();
      return;
    }

    const data = await response.json();

    if (data.success) {
      // 填入表單（settings-form.js）
      fillShopForm(data.shopConfig);

      // 渲染條文選項（settings-form.js）
      currentClauses = data.clauses;
      renderClauseOptions(currentClauses);
    }

  } catch (err) {
    console.error('[settings-app] 載入設定失敗：', err);
    // 載入失敗也顯示空白表單，讓系統方可以填入資料
  }

  // 顯示設定區塊
  loadingSection.hidden = true;
  settingsSection.hidden = false;

  // 綁定儲存按鈕
  bindButtons();
}

/**
 * 綁定所有儲存按鈕的點擊事件
 */
function bindButtons() {
  // 儲存店家資料按鈕
  const saveShopBtn = document.getElementById('save-shop-btn');
  if (saveShopBtn) {
    saveShopBtn.addEventListener('click', async () => {
      saveShopBtn.textContent = '儲存中...';
      saveShopBtn.disabled = true;
      await saveShopConfig(SHOP_ID);  // settings-form.js
      saveShopBtn.textContent = '儲存店家資料';
      saveShopBtn.disabled = false;
    });
  }

  // 儲存條文設定按鈕
  const saveClausesBtn = document.getElementById('save-clauses-btn');
  if (saveClausesBtn) {
    saveClausesBtn.addEventListener('click', async () => {
      saveClausesBtn.textContent = '儲存中...';
      saveClausesBtn.disabled = true;
      await saveClauseSelections(SHOP_ID, currentClauses);  // settings-form.js
      saveClausesBtn.textContent = '儲存條文設定';
      saveClausesBtn.disabled = false;
    });
  }
}
