// ============================================================
// 必須設定
// ここの値を自分の環境に合わせて書き換えてください
// ============================================================

// Shopify ストアドメイン
// 例: "your-store.myshopify.com"（https:// は不要）
var STORE_DOMAIN = "";

// Slack Incoming Webhook URL
// 取得方法: Slack アプリ管理画面 > [アプリを作成] > Incoming Webhooks を有効化 > Webhook URL をコピー
var SLACK_WEBHOOK_URL = "";

// ============================================================
// 任意設定
// 必要に応じて変更してください（変更しなくても動作します）
// ============================================================

// 通知先 Slack チャンネル名
// 例: "#sales-report"
var SLACK_CHANNEL = "#general";

// 集計対象の注文ステータス
// "paid"    → 入金済みのみ（実売上の把握に適している）
// "any"     → キャンセル・返金済みを含む全注文
var ORDER_FINANCIAL_STATUS = "paid";

// 通知メッセージの日付フォーマット
var DATE_FORMAT = "yyyy/MM/dd";

// タイムゾーン
var TIMEZONE = "Asia/Tokyo";

// Shopify Admin API バージョン
var API_VERSION = "2024-04";

// 売上を記録する Google Sheet のシート名
// スプレッドシート下部のタブ名と合わせてください
var SHEET_NAME = "売上記録";
