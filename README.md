# MobileForMe

MobileForMe 是一個 SillyTavern 第三方插件雛形，用於模擬「角色的手機」。它在前端提供仿 iOS 的手機 UI，並可連接獨立 API 後端，讓模型透過可注入上下文的摘要查閱角色的通訊、金流、購物、社群與「查 TA 手機」紀錄。

## 功能

- 即時消息通訊：私人帳號、上班專用帳號、好友動態。
- 電子錢包：餘額、交易、購物資產與轉帳。
- 昭明銀行 App：帳戶資產與近期流水。
- 外賣 App：歷史訂單、店家、狀態與品項。
- 網購商城：購買紀錄與物流狀態。
- 社群網絡：Instagram 風格動態與匿名論壇。
- 查 TA 手機：另開面板查閱指定角色在上述 App 的活動摘要。
- 世界書、角色卡讀取辨識：自動提取當前角色與世界書資訊摘要。
- 線上線下互通：可選擇是否把手機摘要注入正文上下文。
- 仿 iOS 介面：可拖曳懸浮入口、Dynamic Island、圓角 App 圖示、玻璃擬態卡片與 Home Indicator。
- 移動端自適應：針對 Android/iOS 觸控裝置、安全區與窄螢幕調整手機浮層，且打開後可自行調整手機大小。
- API 密鑰與模型：可在設定中貼上獨立 API 密鑰、拉取模型列表並指定 LLM 模型。
- 即時通訊擴充：user 可發送私聊訊息或群聊訊息給角色。
- 電子錢包擴充：支援轉帳與收錢，API 不可用時會先記錄在當前聊天窗口的本機狀態。
- 窗口隔離：手機狀態、世界書摘要與角色卡辨識會依聊天/角色 scope 隔離，避免不同聊天窗口混淆。
- 個性化 CSS：內建設定欄位，可追加自訂 CSS。

## 安裝

將本資料夾放入 SillyTavern 的 `public/scripts/extensions/third-party/mobileforme`，重新整理 SillyTavern 後在 Extensions 面板啟用。

## 獨立 API

插件預設使用 `http://localhost:8787`。可在設定中修改 API Base URL。後端需實作：

- `GET /health`
- `GET /state?character=<name>`
- `POST /transfer`
- `POST /event`
- `GET /models`
- `POST /models/pull`

如果 API 不可用，插件會使用本機示例資料，以便角色扮演流程不中斷。
