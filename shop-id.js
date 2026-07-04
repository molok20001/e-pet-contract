/* ══════════════════════════════════════════
   shop-id.js — 取得目前店家 ID（共用工具）
   職責：統一從網址參數 ?shop_id= 取得店家代號
   ──────────────────────────────────────────
   為什麼獨立成檔：
   app.js（簽約頁）和 settings-app.js（設定頁）都需要
   相同的「從網址取得 shop_id」邏輯。抽成共用函式，
   避免兩處各寫一份、日後規則改動要改兩個地方。
   ──────────────────────────────────────────
   使用方式：
   <script src="shop-id.js"></script> 要排在 app.js / settings-app.js 之前
   const shopId = getShopId();
══════════════════════════════════════════ */

/**
 * 從網址參數取得店家 ID
 * 網址格式：頁面網址?shop_id=店號
 * 讀不到時 fallback 到 'default'（開發/測試用）
 * @returns {string} 店家代號
 */
function getShopId() {
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop_id');

  // 讀不到或為空 → 回 default（測試階段方便，正式營運網址一定帶 shop_id）
  if (!shopId || !shopId.trim()) {
    return 'default';
  }

  return shopId.trim();
}
