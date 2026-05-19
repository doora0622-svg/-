# Security Specification - Interactive Presentation System

## 1. Data Invariants
- `current_page` 必須是正整數且不能超過 `total_pages`。
- 只有傳遞了 `role=presenter` 的講師或具備管理權限的後端可以更新 `current_page`。
- 聽眾只能讀取簡報狀態。

## 2. The "Dirty Dozen" Payloads (Potential Attacks)
1. 把 `current_page` 設定為負數。
2. 把 `current_page` 設定為超過 `total_pages` 的大數。
3. 把 `current_page` 設為字串而非數字。
4. 嘗試刪除 `total_pages` 欄位。
5. 匿名用戶嘗試寫入數據。
6. 嘗試注入超大的 `last_updated` 時間戳。
7. 投影片總覽查詢時嘗試抓取非公開目錄。
8. 講師端筆跡嘗試覆蓋他人的筆跡 (若有實作筆跡庫)。
9. 利用 path 變數注入嘗試訪問其他 root 節點。
10. 自訂 `role` 欄位嘗試偽裝成講師 (前端繞過)。
11. 快速連續發送更新請求 (DoS)。
12. 嘗試讀取包含敏感系統資訊的 `/configs` 節點。

## 3. Realtime Database Rules (Proposed)
由於用戶使用的是 Realtime Database，安全規則應如下：

```json
{
  "rules": {
    "presentation": {
      ".read": "true",
      "current_page": {
        ".write": "auth != null",
        ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= data.parent().child('total_pages').val()"
      },
      "total_pages": {
        ".write": "auth != null",
        ".validate": "newData.isNumber()"
      },
      "last_updated": {
        ".write": "auth != null",
        ".validate": "newData.isNumber()"
      }
    }
  }
}
```
註：實際生產環境應更嚴格，例如透過 Firebase Admin 設定特定 UID 為講師。
