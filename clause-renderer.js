/* ══════════════════════════════════════════
   clause-renderer.js — 條文渲染副程式
   職責：把條文資料陣列轉換成頁面上的折疊 DOM
   輸入：clauses 陣列（由 app.js 傳入）
   輸出：把折疊 HTML 插入 #clause-container
   ──────────────────────────────────────────
   這個檔案不負責取得資料，只負責「畫出來」
   條文資料由 app.js 呼叫 renderClauses() 時傳入
══════════════════════════════════════════ */

/**
 * 渲染所有條文到頁面上
 * @param {Array} clauses - 條文資料陣列，格式見 KV 資料結構
 */
function renderClauses(clauses) {
  // 取得條文容器元素
  const container = document.getElementById('clause-container');

  // 如果容器不存在，停止執行並記錄錯誤
  if (!container) {
    console.error('[clause-renderer] 找不到 #clause-container');
    return;
  }

  // 清空容器（防止重複渲染）
  container.innerHTML = '';

  // 逐一處理每一條條文
  clauses.forEach(clause => {
    // 根據條文類型決定顯示內容
    const contentText = getClauseContent(clause);

    // 建立條文折疊區塊的 HTML 結構
    const item = document.createElement('div');
    item.className = `clause-item type-${clause.type}`;
    item.dataset.id = clause.id;

    item.innerHTML = `
      <div class="clause-header">
        <span class="clause-title">${clause.title}</span>
        <span class="clause-arrow">▼</span>
      </div>
      <div class="clause-body">
        <div class="clause-content">${contentText}</div>
      </div>
    `;

    // 點擊標題列時切換展開/收合
    const header = item.querySelector('.clause-header');
    header.addEventListener('click', () => {
      // 切換 .open class（CSS 透過這個 class 控制展開動畫）
      item.classList.toggle('open');
    });

    // 把這個條文區塊加入容器
    container.appendChild(item);
  });
}

/**
 * 根據條文類型取得要顯示的文字內容
 * @param {Object} clause - 單一條文資料
 * @returns {string} 要顯示的條文文字
 */
function getClauseContent(clause) {
  // fixed 類型：直接顯示 content 欄位
  if (clause.type === 'fixed') {
    return clause.content || '（無內容）';
  }

  // selectable 類型：找到店家已選的選項，顯示該選項的 content
  if (clause.type === 'selectable') {
    // 如果店家沒有設定選項，顯示提示
    if (!clause.options || !clause.selected) {
      return '（店家尚未設定此條款選項）';
    }
    // 從 options 陣列中找到 selected 對應的選項
    const selectedOption = clause.options.find(opt => opt.key === clause.selected);
    return selectedOption ? selectedOption.content : '（找不到對應選項）';
  }

  // editable 類型：預留，目前不實作
  if (clause.type === 'editable') {
    return clause.content || '（此條款由店家自訂）';
  }

  return '（未知條款類型）';
}
