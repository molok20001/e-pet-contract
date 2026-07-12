/* ══════════════════════════════════════════
   settings-token.js — 產生一次性簽約網址
   職責：設定頁的「產生簽約網址」卡片
   ──────────────────────────────────────────
   新開檔案的原因：新功能開新檔（settings-form.js 已 256 行）。
   ──────────────────────────────────────────
   依賴（同頁 <script> 全域共用，不需 import）：
   - WORKER_URL（settings-form.js）
   - SHOP_ID（settings-app.js）
   - getAuthToken()（settings-auth.js，過密碼牆後的暫存密碼）
   ──────────────────────────────────────────
   流程：
   按「產生簽約網址」→ POST /token（帶身份）→ 取得一次性票券
   → 組出簽約網址顯示 + 提供「直接開啟」
   票券 1 小時有效、簽約送出即銷毀（一票一用）。
   注意：店家 require_token 未開啟時，產生的網址也能用，
   只是不帶 token 的網址同樣能用（開關見 worker.js 說明）。
══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const genBtn = document.getElementById('generate-token-btn');
  if (!genBtn) return;

  genBtn.addEventListener('click', async () => {
    const resultBox = document.getElementById('token-url-result');
    genBtn.disabled = true;
    genBtn.textContent = '產生中...';

    try {
      const response = await fetch(`${WORKER_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: SHOP_ID,
          auth_token: getAuthToken(),
        }),
      });
      const result = await response.json();

      if (result.success) {
        // 簽約頁在網站根目錄（index.html）
        const signUrl = `${location.origin}/?shop_id=${encodeURIComponent(SHOP_ID)}&token=${result.token}`;
        showTokenUrl(resultBox, signUrl);
      } else if (response.status === 401) {
        clearAuthToken();
        showSaveResult('密碼已失效，請重新整理頁面後重新登入', 'error');
      } else {
        showSaveResult(`產生失敗：${result.error}`, 'error');
      }
    } catch (err) {
      console.error('[settings-token] 產生票券失敗：', err);
      showSaveResult('網路錯誤，請稍後再試', 'error');
    }

    genBtn.disabled = false;
    genBtn.textContent = '產生簽約網址';
  });
});

/**
 * 顯示產生的簽約網址（網址框 + 直接開啟）
 * @param {HTMLElement} box - 顯示容器（#token-url-result）
 * @param {string} url - 完整簽約網址
 */
function showTokenUrl(box, url) {
  if (!box) return;
  box.innerHTML = '';
  box.hidden = false;

  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = url;
  input.className = 'token-url-input';
  input.addEventListener('click', () => input.select());  // 點一下全選方便複製

  const openLink = document.createElement('a');
  openLink.href = url;
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.className = 'token-open-link';
  openLink.textContent = '直接開啟簽約頁';

  const note = document.createElement('p');
  note.className = 'field-hint';
  note.textContent = '此網址 1 小時內有效，客戶完成簽署後即失效（一次一用）。';

  box.appendChild(input);
  box.appendChild(openLink);
  box.appendChild(note);
}
