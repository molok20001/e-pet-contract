/* ══════════════════════════════════════════
   backend-registry.js — 店號 → 後端網址對照表（唯一正本）
   職責：依 shop_id 決定前端要呼叫哪個後端 Worker
   ──────────────────────────────────────────
   為什麼需要（2026/07/12 新增）：
   商業模式是「程式跑在店家自己的 Cloudflare 帳號」，
   每店後端網址必然不同（workers.dev 子網域是帳號層級）。
   前端只有系統方託管的一份，故用本對照表切換後端，
   取代原本寫死在 app.js / settings-app.js / settings-form.js
   三處的單一 WORKER_URL。

   交機新店（SOP Step 5）：
   在 BACKEND_REGISTRY 加一行
     '店號': 'https://pet-contract.{店家子網域}.workers.dev',
   → git push 到 e-pet-contract repo 自動部署。

   載入順序：<script src="backend-registry.js"> 必須排在
   shop-id.js 之後、其他讀取 WORKER_URL 的檔案之前
   （index.html 與 settings.html 皆已安排）。

   查無店號時 fallback 到 default 的後端：該後端 KV 查無此店
   → GET /config 失敗 → 前端 configLoaded=false 擋頁，
   不會產生打錯後端的廢資料。
══════════════════════════════════════════ */

const BACKEND_REGISTRY = {
  // 店號: 後端 Worker 網址（⚠️ 結尾不可加斜線，比照 ALLOWED_ORIGIN 規則）
  'default': 'https://pet-contract.pet-cont-mor.workers.dev',
};

/**
 * 依店號取得後端 Worker 網址
 * @param {string} shopId - 店家代號（見 shop-id.js getShopId()）
 * @returns {string} 後端 Worker 網址
 */
function getWorkerUrl(shopId) {
  return BACKEND_REGISTRY[shopId] || BACKEND_REGISTRY['default'];
}
