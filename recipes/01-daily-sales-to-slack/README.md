# レシピ01：新しい注文を定期的に Slack に通知する

## 1. 課題（困りごと）

「今日の売上、どうだったっけ？」と気になるたびに Shopify 管理画面を開いていませんか？

毎晩 Slack に売上レポートが届けば、ダッシュボードを開かなくても売上の流れをひと目で把握できます。さらに Google Sheet に蓄積されたデータは、週次・月次の分析にも活用できます。

このレシピでは **Shopify Flow で注文データを Google Sheet に自動記録し、GAS が毎日定刻に集計して Slack へ通知する** 仕組みを作ります。

---

## 2. 仕組みの全体像

```
Shopify に注文が入る
    ↓
Shopify Flow が Google Sheet に1行追加する（自動）
    ↓
GAS トリガー（毎晩 23:00）が起動する
    ↓
未通知の注文を集計 → Slack に通知 → 通知済みフラグを記録する
```

Shopify の API キーや認証設定は不要です。Flow が自動でデータを運んでくれます。

---

## 3. 完成イメージ

定刻に Slack へ以下のメッセージが届きます。前回通知以降に入った注文がまとめて集計されるため、24時間営業のストアでも取りこぼしが起きません。

```
🛍️ 新しい注文レポート（2026/04/30 時点）
────────────────────
売上総額：￥128,500
注文件数：23 件
平均客単価：￥5,587
────────────────────
集計対象：前回通知以降の新規注文 23 件
```

同時に、Google Sheet の「通知済み」列に通知日時が自動記録されます。

| 注文ID | 注文番号 | 合計金額 | 作成日時 | 通知済み |
|---|---|---|---|---|
| 6789... | #1023 | 5500 | 2026/04/30... | 2026/04/30 23:00:12 |
| 6790... | #1024 | 8800 | 2026/04/30... | 2026/04/30 23:00:12 |

---

## 4. 必要なもの

| 項目 | 説明 |
|---|---|
| Shopify ストア | Shopify Flow が使えるプラン（Basic 以上） |
| Slack ワークスペース | Incoming Webhooks が使える権限が必要 |
| Google アカウント | GAS と Google Sheet を動かすために使用 |

---

## 5. コード

### ファイル構成

```
01-daily-sales-to-slack/
  config.gs        ← Slack URL・シート設定などを書き換えるファイル
  Code.gs          ← メインロジック（基本的に触らなくて OK）
  appsscript.json  ← GAS の設定ファイル
```

### config.gs — ここだけ書き換えれば動きます

```javascript
// Slack Incoming Webhook URL
var SLACK_WEBHOOK_URL = "（Slack アプリ管理画面から取得した URL）";

// 通知先チャンネル
var SLACK_CHANNEL = "#sales-report";

// Shopify Flow が書き込むシート名（Flow 側と合わせる）
var ORDERS_SHEET_NAME = "注文データ";

// 列番号（Flow で設定する列の順番と一致させること）
var COL_ORDER_ID     = 1; // A列：注文ID
var COL_ORDER_NUMBER = 2; // B列：注文番号
var COL_TOTAL_PRICE  = 3; // C列：合計金額
var COL_CREATED_AT   = 4; // D列：作成日時
var COL_NOTIFIED     = 5; // E列：通知済み（GAS が自動入力）
```

### Code.gs の処理の流れ

```
sendDailySalesReport()
  ├── getUnnotifiedOrders()  → シートから「通知済み」列が空の行を取得
  ├── calcSummary()          → 売上総額・件数・客単価を計算
  ├── buildMessage()         → Slack 投稿用テキストを組み立て
  ├── postToSlack()          → Webhook に POST して通知
  └── markAsNotified()       → 通知した行の「通知済み」列に日時を記録
```

**未通知フラグの仕組み：**
- Shopify Flow が行を追加するとき「通知済み」列（E列）は空のまま
- GAS が通知した後に日時を書き込む
- 次回実行時は「通知済み」列が空の行だけを対象にするため、二重通知にならない

---

## 6. 設定手順

### Step 1：Google Sheet を作成して GAS を紐づける

このレシピは **コンテナバインド型** の GAS を使います。Google Sheet にスクリプトを紐づけることで、同じファイルのシートに直接書き込めます。

1. [Google スプレッドシート](https://sheets.google.com/) で新規ファイルを作成し、名前を `Shopify売上レポート` などに変更する
2. シート下部のタブ名を「注文データ」に変更する（`config.gs` の `ORDERS_SHEET_NAME` と合わせる）
3. 1行目にヘッダーを手動で入力する

| A | B | C | D | E |
|---|---|---|---|---|
| 注文ID | 注文番号 | 合計金額 | 作成日時 | 通知済み |

4. メニュー **拡張機能** > **Apps Script** を開く
5. プロジェクト名を `01-daily-sales-to-slack` などに変更する
6. 左のファイル一覧の **＋** から **スクリプト** を追加し、ファイル名を `config` にする
7. `config.gs`・`Code.gs`・`appsscript.json` の内容をそれぞれのファイルに貼り付ける

> `appsscript.json` を編集するには、**プロジェクトの設定** > **「appsscript.json」マニフェスト ファイルをエディタで表示する** をオンにしてください。

---

### Step 2：Slack Incoming Webhook を作成する

1. [Slack API サイト](https://api.slack.com/apps) を開く
2. **Create New App** > **From scratch** を選択
3. アプリ名（例: `Sales Report Bot`）とワークスペースを設定して作成
4. 左メニュー **Incoming Webhooks** を開き、**Activate Incoming Webhooks** をオンにする
5. **Add New Webhook to Workspace** をクリックし、投稿先チャンネルを選択
6. 生成された Webhook URL を `config.gs` の `SLACK_WEBHOOK_URL` に貼り付ける

---

### Step 3：Shopify Flow でワークフローを作成する

1. Shopify 管理画面 > **Flow** を開く
2. **ワークフローを作成** をクリック
3. トリガーを **「注文が作成された」** に設定する
4. アクションを追加 > **Google スプレッドシート：行を追加** を選択する
   - 初回は Google アカウントの連携が必要
5. Step 1 で作成したスプレッドシートとシート（「注文データ」）を選択する
6. 以下の通り列と変数を対応させる

| 列 | 設定する変数 |
|---|---|
| A列（注文ID） | `{{order.id}}` |
| B列（注文番号） | `{{order.name}}` |
| C列（合計金額） | `{{order.totalPrice}}` |
| D列（作成日時） | `{{order.createdAt}}` |

> **E列（通知済み）は Flow では設定しません。** GAS が自動で書き込みます。

> **変数名の確認方法：** Flow の変数入力欄で `{{order.` と入力すると候補が表示されます。上の表の変数名と一致しない場合は、候補の中から「合計金額」「注文番号」に相当する項目を選んでください。選んだ変数名と `config.gs` の列番号が対応していれば動作します。

7. ワークフローを **オンにする**
8. テスト注文を作成して Sheet に行が追加されることを確認する（次の Step 4 で詳しく説明します）

---

### Step 4：動作確認

1. Shopify でテスト注文を作成する（管理画面 > 注文 > **テスト注文を作成**）
2. Google Sheet の「注文データ」シートに行が追加されたことを確認する
3. GAS エディタで `sendDailySalesReport` 関数を選択して **実行** する
4. 初回は権限の確認ダイアログが表示されるので **許可** する
5. Slack に通知が届き、Sheet の E 列に通知日時が記録されたことを確認する

---

### Step 5：毎日定刻に自動実行するトリガーを設定する

1. GAS エディタ左のメニュー > **トリガー** を開く
2. **トリガーを追加** をクリック
3. 以下の通り設定する

| 項目 | 設定値 |
|---|---|
| 実行する関数 | `sendDailySalesReport` |
| イベントのソース | 時間主導型 |
| 時間ベースのトリガーのタイプ | 日付ベースのタイマー |
| 時刻 | 午後 11 時〜午前 0 時（任意） |

4. **保存** すれば設定完了です。

---

## 7. 応用ヒント

### 入金済みの注文だけを対象にしたい

Shopify Flow のワークフローにコンディションを追加します。

- コンディション：`注文の支払いステータス` が `支払い済み` と等しい

これにより、未払いやキャンセルの注文は Sheet に追加されなくなります。

### 注文が 0 件のときは通知しない

現在の実装では `getUnnotifiedOrders()` が空を返した場合、自動的にスキップします。何もしなくても大丈夫です。

### エラー時にも Slack に通知したい

`sendDailySalesReport()` を try-catch で囲みます。

```javascript
function sendDailySalesReport() {
  try {
    const orders = getUnnotifiedOrders();
    if (orders.length === 0) return;
    const summary = calcSummary(orders);
    postToSlack(buildMessage(summary));
    markAsNotified(orders);
  } catch (e) {
    postToSlack('⚠️ 売上レポートでエラーが発生しました: ' + e.message);
    throw e;
  }
}
```

### 週次・月次の集計もしたい

Sheet にデータが蓄積されているので、スプレッドシートのピボットテーブル機能や `SUMIFS` 関数で期間集計が可能です。

---

## トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| Sheet に行が追加されない | Shopify Flow のワークフローがオンになっているか確認。Flow のログでエラーを確認 |
| `シートが見つかりません` エラー | `config.gs` の `ORDERS_SHEET_NAME` とシートのタブ名が一致しているか確認 |
| 件数が 0 になる | Sheet に未通知の行があるか確認。E列（通知済み列）が正しい列番号か確認 |
| Slack に届かない | `SLACK_WEBHOOK_URL` が正しいか確認。Webhook が有効か Slack 管理画面で確認 |
| 二重通知される | `markAsNotified()` が正常に実行されているか確認。E列に日時が書き込まれているか確認 |
