/* ══════════════════════════════════════════
   settings-auth.js — 設定頁身份驗證副程式（預留）
   職責：控制設定頁面的存取權限
   ──────────────────────────────────────────
   目前狀態：預留架構，直接通過驗證
   未來實作方向：
   - 顯示登入表單（帳號 + 密碼）
   - 送出後從 Worker 取得 token
   - token 存在 sessionStorage，頁面關閉後失效
   ──────────────────────────────────────────
   提供的函式：
   - initAuth()        初始化身份驗證流程
   - getAuthToken()    取得目前的 auth token
══════════════════════════════════════════ */

/**
 * 初始化身份驗證
 * 由 settings-app.js 在頁面載入後呼叫
 * 目前直接通過，未來在這裡加入登入邏輯
 */
function initAuth() {
  // ══════════════════════════════
  // 目前：預留，直接通過驗證
  // 未來實作時，這裡改為顯示登入表單，
  // 等使用者輸入帳號密碼並驗證成功後，
  // 才呼叫 onAuthSuccess()
  // ══════════════════════════════
  onAuthSuccess();
}

/**
 * 取得目前的 auth token
 * 送出設定資料給 Worker 時帶入
 * 目前回傳空字串（Worker 的 auth.js 也在預留模式）
 * @returns {string}
 */
function getAuthToken() {
  // 未來從 sessionStorage 取得登入後的 token
  // return sessionStorage.getItem('auth_token') || '';
  return '';
}

/**
 * 驗證成功後的處理
 * 通知 settings-app.js 可以載入設定內容
 * （私有函式，不對外使用）
 */
function onAuthSuccess() {
  // 隱藏登入區塊（目前本來就是 hidden）
  const authSection = document.getElementById('auth-section');
  if (authSection) authSection.hidden = true;

  // ── 未來實作真實驗證時 ──
  // 在這裡呼叫 loadSettings()，例如：
  // loadSettings();
  // 目前由 settings-app.js 的 DOMContentLoaded 直接呼叫，不需要在這裡觸發
}
