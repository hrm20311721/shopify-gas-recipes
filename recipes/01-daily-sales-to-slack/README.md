# レシピ01：今日の売上を毎朝 Slack に通知する

## 1. 課題（困りごと）

「今日の売上、どうだったっけ？」と気になるたびに Shopify 管理画面を開いていませんか？

毎朝 Slack に売上レポートが届けば、ダッシュボードを開かなくても売上の流れをひと目で把握できます。さらに Google Sheet に自動記録することで、週次・月次の売上トレンドを後から分析することも可能です。このレシピでは Google Apps Script（GAS）を使って **Shopify の当日売上を自動集計し、毎日定刻に Slack へ通知 ＋ Sheet に記録するbot** を作ります。

---

## 2. 完成イメージ

毎朝 9:00 に Slack へ以下のメッセージが届きます。

```
📊 本日の売上レポート（2026/04/30）
────────────────────
売上総額：￥128,500
注文件数：23 件
平均客単価：￥5,587
────────────────────
集計対象：2026/04/30 00:00 ～ 23:59（Asia/Tokyo）
```

同時に、紐づけた Google Sheet の「売上記録」シートに1行追加されます。

| 日付 | 売上総額 | 注文件数 | 平均客単価 | 記録日時 |
|---|---|---|---|---|
| 2026/04/30 | 128500 | 23 | 5587 | 2026/04/30 09:00:12 |
| 2026/05/01 | 95000 | 18 | 5277 | 2026/05/01 09:00:08 |

Sheet にデータが蓄積されることで、グラフ作成や月次集計などの分析が可能になります。

---

## 3. 必要なもの

| 項目 | 説明 |
|---|---|
| Shopify ストア | Admin API が使えるプランであれば OK |
| Shopify Admin API アクセストークン | カスタムアプリから発行（後述） |
| Slack ワークスペース | Incoming Webhooks が使える権限が必要 |
| Google アカウント | GAS を動かすために使用 |
| Google スプレッドシート | 売上記録の保存先。GAS をここに紐づける（コンテナバインド） |

---

## 4. コード

### ファイル構成

```
01-daily-sales-to-slack/
  config.gs        ← ストアドメインや Slack URL などを設定するファイル
  Code.gs          ← メインロジック（基本的に触らなくて OK）
  appsscript.json  ← GAS の設定ファイル
```

### config.gs

環境依存の設定値をまとめたファイルです。**ここだけ書き換えれば動きます。**

```javascript
// Shopify ストアドメイン（https:// は不要）
var STORE_DOMAIN = "your-store.myshopify.com";

// Slack Incoming Webhook URL
var SLACK_WEBHOOK_URL = "（Slack アプリ管理画面から取得した URL）";

// 通知先チャンネル
var SLACK_CHANNEL = "#sales-report";

// 集計対象のステータス: "paid"（入金済みのみ）or "any"（全件）
var ORDER_FINANCIAL_STATUS = "paid";
```

> **ACCESS_TOKEN（APIキー）は config.gs には書きません。** セキュリティのため Script Properties で管理します（設定手順で説明します）。

### Code.gs の処理の流れ

```
sendDailySalesReport()
  ├── fetchTodayOrders()   → Shopify API から当日注文を全件取得
  ├── calcSummary()        → 売上総額・件数・客単価を計算
  ├── logToSheet()         → Google Sheet に1行追記
  ├── buildMessage()       → Slack 投稿用テキストを組み立て
  └── postToSlack()        → Webhook に POST して通知
```

ページネーション（1日250件超の注文にも対応）は `fetchTodayOrders()` の中で自動処理されます。

---

## 5. 設定手順

### Step 1：Shopify カスタムアプリを作成してアクセストークンを発行する

1. Shopify 管理画面 > **設定** > **アプリと販売チャネル** を開く
2. **アプリを開発する** をクリック
3. **アプリを作成** からアプリ名（例: `GAS売上レポート`）を入力して作成
4. **API 認証情報を設定** をクリックし、以下のスコープにチェックを入れる
   - `read_orders`（注文の読み取り）
5. **保存** → **アプリをインストール** の順に進む
6. **Admin API アクセストークン** が表示されるのでコピーして保管する

> アクセストークンは一度しか表示されません。必ずコピーしてください。

---

### Step 2：Slack Incoming Webhook を作成する

1. [Slack API サイト](https://api.slack.com/apps) を開く
2. **Create New App** > **From scratch** を選択
3. アプリ名（例: `Sales Report Bot`）とワークスペースを設定して作成
4. 左メニュー **Incoming Webhooks** を開き、**Activate Incoming Webhooks** をオンにする
5. **Add New Webhook to Workspace** をクリックし、投稿先チャンネルを選択
6. 生成された Webhook URL をコピーする

---

### Step 3：スプレッドシートを作成して GAS を紐づける

このレシピは **コンテナバインド型** の GAS を使います。Google スプレッドシートにスクリプトを紐づけることで、売上データを同じファイルのシートに直接書き込めます。`script.google.com` で単独作成するスタンドアロン型ではありません。

1. [Google スプレッドシート](https://sheets.google.com/) で新規ファイルを作成し、名前を `Shopify売上レポート` などに変更する
2. メニュー **拡張機能** > **Apps Script** を開く（GAS エディタが開く）
3. プロジェクト名を `01-daily-sales-to-slack` などに変更する
4. 左のファイル一覧の **＋** から **スクリプト** を追加し、ファイル名を `config` に変更する
5. `config.gs` と `Code.gs` と `appsscript.json` の内容をそれぞれのファイルに貼り付ける

> `appsscript.json` を編集するには、エディタ左上のメニュー > **プロジェクトの設定** > **「appsscript.json」マニフェスト ファイルをエディタで表示する** をオンにしてください。

---

### Step 4：アクセストークンを Script Properties に保存する

1. GAS エディタ左のメニュー > **プロジェクトの設定** を開く
2. **スクリプトプロパティ** セクションの **スクリプトプロパティを追加** をクリック
3. 以下を入力して **保存**

| プロパティ | 値 |
|---|---|
| `ACCESS_TOKEN` | Step 1 でコピーした Shopify アクセストークン |

---

### Step 5：動作確認

1. GAS エディタで `sendDailySalesReport` 関数を選択
2. **実行** ボタンをクリック
3. 初回は権限の確認ダイアログが表示されるので **許可** する
4. Slack に売上レポートが届いているか確認する
5. スプレッドシートに「売上記録」シートが作成され、1行追記されているか確認する

---

### Step 6：毎日定刻に自動実行するトリガーを設定する

1. GAS エディタ左のメニュー > **トリガー** を開く
2. **トリガーを追加** をクリック
3. 以下の通り設定する

| 項目 | 設定値 |
|---|---|
| 実行する関数 | `sendDailySalesReport` |
| イベントのソース | 時間主導型 |
| 時間ベースのトリガーのタイプ | 日付ベースのタイマー |
| 時刻 | 午前 9 時〜10 時（任意） |

4. **保存** すれば設定完了です。翌日の設定時刻に自動実行されます。

---

## 6. 応用ヒント

### 昨日の売上を通知したい

`fetchTodayOrders()` 内の日付計算を変更します。

```javascript
// 昨日の日付を算出する
var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
var targetDate = Utilities.formatDate(yesterday, TIMEZONE, 'yyyy-MM-dd');
```

### 通貨を円以外にしたい

`buildMessage()` の `￥` の部分を変更します。Shopify の `total_price` はストアの通貨設定に従って返ってきます。

### 売上が 0 件のときは通知しない

`sendDailySalesReport()` に以下を追加します。

```javascript
if (summary.count === 0) {
  console.log('本日の注文はありません。通知をスキップします。');
  return;
}
```

### エラー時にも Slack に通知したい

`sendDailySalesReport()` を try-catch で囲み、catch ブロックで `postToSlack()` を呼びます。

```javascript
function sendDailySalesReport() {
  try {
    // ...（既存の処理）
  } catch (e) {
    postToSlack('⚠️ 売上レポートの取得に失敗しました: ' + e.message);
    throw e;
  }
}
```

---

## トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| `ACCESS_TOKEN が設定されていません` | Script Properties に `ACCESS_TOKEN` が正しく登録されているか確認 |
| `Shopify API エラー: 401` | アクセストークンが正しいか、`read_orders` スコープが付与されているか確認 |
| `Shopify API エラー: 404` | `STORE_DOMAIN` が `your-store.myshopify.com` の形式になっているか確認（`https://` 不要） |
| Slack に届かない | `SLACK_WEBHOOK_URL` が正しいか確認。Webhook が有効になっているか Slack 管理画面で確認 |
| 売上が 0 になる | `ORDER_FINANCIAL_STATUS` が `"paid"` の場合、入金済み注文がないと 0 になる。`"any"` に変えて試す |
