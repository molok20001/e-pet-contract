/* ══════════════════════════════════════════
   field-registry.js — 簽約表單欄位清單（唯一正本）
   職責：定義「哪些欄位可被店家設為必填」
   ──────────────────────────────────────────
   被兩頁共用：
   - settings.html：必填欄位勾選視窗的清單來源
   - index.html：form-validator.js 依此對照欄位標籤
   新增/移除表單欄位時，只改這裡一份。
   ──────────────────────────────────────────
   不列入本清單的欄位（理由）：
   - sign-date：由 app.js 自動帶入，永遠有值
   - owner-email：版本 5 前無實際用途（設計筆記決策：排除）
   - agreement-checkbox：法律必要，永遠必勾，不開放設定
══════════════════════════════════════════ */

// group: 'owner' = 甲方資料區、'pet' = 寵物資料區（與簽約頁區塊一致）
const CONTRACT_FIELDS = [
  { id: 'owner-name',      label: '姓名',                   group: 'owner' },
  { id: 'owner-id',        label: '身分證號／居留證號碼',    group: 'owner' },
  { id: 'owner-address',   label: '通訊地址',               group: 'owner' },
  { id: 'owner-phone',     label: '聯絡電話',               group: 'owner' },
  { id: 'emergency-name',  label: '緊急聯絡人姓名',          group: 'owner' },
  { id: 'emergency-phone', label: '緊急聯絡人電話',          group: 'owner' },
  { id: 'vet-name',        label: '指定獸醫診療場所',        group: 'owner' },
  { id: 'pet-name',        label: '寵物姓名',               group: 'pet' },
  { id: 'pet-breed',       label: '寵物品種',               group: 'pet' },
  { id: 'pet-sex',         label: '寵物性別',               group: 'pet' },
  { id: 'pet-birth',       label: '寵物生日',               group: 'pet' },
  { id: 'pet-weight',      label: '體重（公斤）',            group: 'pet' },
  { id: 'pet-chip',        label: '寵物晶片號碼／辨識資訊',  group: 'pet' },
  { id: 'other-notes',     label: '其他事項',               group: 'pet' },
];

// 分組標題（勾選視窗顯示用）
const FIELD_GROUP_LABELS = {
  owner: '甲方（飼主）資料',
  pet:   '寵物資料',
};
