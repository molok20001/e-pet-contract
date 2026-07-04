/* ══════════════════════════════════════════
   settings-auth.js — 設定頁身份驗證副程式
   職責：進入設定頁時的密碼牆 + 提供密碼給儲存流程
   ──────────────────────────────────────────
   流程：
   1. initAuth(onSuccess) → 顯示密碼牆，藏住設定內容
   2. 店家輸入密碼 → POST /verify 給後端比對
   3. 通過 → 密碼暫存 sessionStorage（明文，分頁關閉即清）
             → 藏密碼牆、呼叫 onSuccess() 載入設定
      失敗 → 停在密碼牆，顯示錯誤
   ──────────────────────────────────────────
   兩道鎖的分工：
   - 進頁面密碼牆（本檔）：擋「打開設定網頁」的普通人，給安全感
   - 後端寫入鎖（auth.js）：擋「繞過網頁直接打 API」的人，真正防護
   兩道並存，缺一不可。前端這道是體驗層，不是取代後端。
   ──────────────────────────────────────────
   密碼處理：
   - 僅暫存 sessionStorage（分頁關閉即失效），不加密
     （前端加密無意義：解密鑰匙也在公開的前端，等於白做）
   - 傳輸靠 HTTPS 自動加密；真密碼本尊在後端 KV
   ──────────────────────────────────────────
   提供的函式：
   - initAuth(onSuccess)  顯示密碼牆，驗證通過後呼叫 onSuccess
   - getAuthToken()       取得已驗證的密碼（儲存時用）
   - clearAuthToken()     清除暫存密碼
══════════════════════════════════════════ */

const AUTH_STORAGE_KEY = 'pet_contract_admin_pass';

/**
 * 初始化身份驗證：顯示密碼牆
 * @param {Function} onSuccess - 驗證通過後要執行的動作（載入設定）
 */
function initAuth(onSuccess) {
  const authSection = document.getElementById('auth-section');
  const loadingSection = document.getElementById('loading-section');
  const settingsSection = document.getElementById('settings-section');

  // 一進頁面：藏載入中與設定內容，只顯示密碼牆
  if (loadingSection) loadingSection.hidden = true;
  if (settingsSection) settingsSection.hidden = true;

  // 若這次分頁已驗證過（sessionStorage 有密碼）→ 直接進入，不再擋
  const cached = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (cached) {
    if (authSection) authSection.hidden = true;
    enterSettings(onSuccess);
    return;
  }

  // 顯示密碼牆
  renderAuthForm(authSection, onSuccess);
  if (authSection) authSection.hidden = false;
}

/**
 * 在 auth-section 內建立密碼輸入介面並綁定送出
 */
function renderAuthForm(authSection, onSuccess) {
  if (!authSection) return;

  authSection.innerHTML = `
    <div class="auth-card">
      <h2>店家管理登入</h2>
      <p class="auth-hint">請輸入管理密碼以進入設定頁</p>
      <input type="password" id="auth-password" placeholder="管理密碼" autocomplete="current-password" />
      <button type="button" id="auth-submit-btn">登入</button>
      <p id="auth-error" class="auth-error" hidden></p>
    </div>
  `;

  const submitBtn = authSection.querySelector('#auth-submit-btn');
  const passInput = authSection.querySelector('#auth-password');

  const doVerify = () => verifyPassword(passInput.value, authSection, onSuccess, submitBtn);

  submitBtn.addEventListener('click', doVerify);
  // 按 Enter 也能送出
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doVerify();
  });
  passInput.focus();
}

/**
 * 送密碼給後端 /verify 驗證
 */
async function verifyPassword(password, authSection, onSuccess, submitBtn) {
  const errorEl = authSection.querySelector('#auth-error');

  if (!password) {
    showAuthError(errorEl, '請輸入密碼');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '驗證中...';

  try {
    const response = await fetch(`${SETTINGS_WORKER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: SHOP_ID, auth_token: password }),
    });
    const result = await response.json();

    if (result.success) {
      // 驗證通過：暫存密碼（供儲存時沿用），進入設定
      sessionStorage.setItem(AUTH_STORAGE_KEY, password);
      authSection.hidden = true;
      enterSettings(onSuccess);
    } else {
      showAuthError(errorEl, result.error || '密碼錯誤');
      submitBtn.disabled = false;
      submitBtn.textContent = '登入';
    }
  } catch (err) {
    console.error('[settings-auth] 驗證失敗：', err);
    showAuthError(errorEl, '網路錯誤，請稍後再試');
    submitBtn.disabled = false;
    submitBtn.textContent = '登入';
  }
}

/**
 * 進入設定內容：顯示設定區、執行載入
 */
function enterSettings(onSuccess) {
  const settingsSection = document.getElementById('settings-section');
  if (settingsSection) settingsSection.hidden = false;
  if (typeof onSuccess === 'function') onSuccess();
}

/**
 * 顯示密碼牆的錯誤訊息
 */
function showAuthError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/**
 * 取得已驗證的密碼（儲存設定時帶入 auth_token）
 * 進頁面已驗證並暫存，這裡直接回傳
 * @returns {string}
 */
function getAuthToken() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) || '';
}

/**
 * 清除暫存密碼（密碼失效時呼叫）
 */
function clearAuthToken() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
