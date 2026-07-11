/* ══════════════════════════════════════════
   app.js — 主程式入口
   職責：初始化所有副程式（載入設定、建立簽名板、綁定按鈕）
   ──────────────────────────────────────────
   送出流程（表單驗證→兩階段簽名→PDF→Worker）拆到 submit-flow.js，
   本檔只負責頁面初始化，避免單檔身兼兩種職責。
   ──────────────────────────────────────────
   流程：
   1. 頁面載入 → 從 Worker GET /config 取得店家設定和條文
   2. 填入頁首店家名稱、填入今天日期
   3. 條文交給 clause-renderer.js 渲染
   4. 建立甲乙雙方簽名板、綁定兩階段送出按鈕（submit-flow.js）
══════════════════════════════════════════ */

// Worker API 網址（統一在這裡修改）
const WORKER_URL = 'https://pet-contract.pet-cont-mor.workers.dev';

// 目前店家 ID（從網址參數 ?shop_id= 取得，見 shop-id.js）
const SHOP_ID = getShopId();

// 儲存從 Worker 取得的資料（給 PDF 生成用，submit-flow.js 會讀取）
let shopData = null;
let clausesData = [];

// 目前店家的版本模式（從 KV 的 shop 設定讀取，見 loadConfig）
// "6" = 基底（當面簽、自行下載）；"5" = 加自動寄信；"7" = LINE
// 讀不到時預設 "6"（最基本、不依賴外部服務，最安全的 fallback）
let currentMode = '6';

// 設定是否載入成功（控制能否送出，submit-flow.js 會檢查）
// 只有成功取得店家設定與條文才為 true；店號不存在/載入失敗則維持 false
// 防止在「沒有條文」的狀態下產生無效 PDF
let configLoaded = false;

// 甲乙雙方簽名板實例（signature.js 工廠模式，submit-flow.js 會讀取）
let signaturePadA = null;
let signaturePadB = null;

/* ════════════════════════════════════════
   頁面載入後初始化
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // 建立甲乙雙方簽名板（signature.js 工廠模式）
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

  // 綁定兩階段送出按鈕（submit-flow.js）
  bindSubmitButtons();
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

      // 依店家設定標示必填星號（form-validator.js）
      markRequiredFields(shopData.required_fields);

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
