// ============================================================
// テスト用ファイル（開発ストア接続テスト）
// GAS エディタで各関数を個別に選択して実行してください
// 本番環境にこのファイルは不要です
// ============================================================

// ------------------------------------------------------------
// テスト 1：Script Properties の設定確認
// ACCESS_TOKEN が登録されているかを確認する
// ------------------------------------------------------------
function testProperties() {
  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');

  if (!token) {
    Logger.log('[FAIL] ACCESS_TOKEN が Script Properties に設定されていません');
    return;
  }

  // トークンの先頭4文字だけ表示してログに残す（全体は表示しない）
  Logger.log('[OK] ACCESS_TOKEN が見つかりました: ' + token.substring(0, 4) + '****');
  Logger.log('     STORE_DOMAIN: ' + STORE_DOMAIN);
  Logger.log('     SLACK_WEBHOOK_URL 設定: ' + (SLACK_WEBHOOK_URL ? 'あり' : 'なし'));
}

// ------------------------------------------------------------
// テスト 2：Shopify API 接続確認
// ストア情報を取得して疎通を確認する（注文APIより軽量）
// ------------------------------------------------------------
function testShopifyConnection() {
  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  var url = 'https://' + STORE_DOMAIN + '/admin/api/' + API_VERSION + '/shop.json';

  var response = UrlFetchApp.fetch(url, {
    headers: { 'X-Shopify-Access-Token': token },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log('[FAIL] Shopify API 接続エラー: ' + code);
    Logger.log('       レスポンス: ' + response.getContentText());
    return;
  }

  var shop = JSON.parse(response.getContentText()).shop;
  Logger.log('[OK] Shopify API 接続成功');
  Logger.log('     ストア名: ' + shop.name);
  Logger.log('     ドメイン: ' + shop.domain);
  Logger.log('     通貨: ' + shop.currency);
  Logger.log('     タイムゾーン: ' + shop.iana_timezone);
}

// ------------------------------------------------------------
// テスト 3：当日の注文取得確認
// 開発ストアの今日の注文一覧を取得してログに出力する
// ------------------------------------------------------------
function testFetchOrders() {
  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  var orders = fetchTodayOrders(token);

  Logger.log('[OK] 注文取得完了');
  Logger.log('     取得件数: ' + orders.length + ' 件');

  if (orders.length === 0) {
    Logger.log('     本日の注文はありません（開発ストアにテスト注文を作成してください）');
    return;
  }

  // 最初の注文の内容を表示して確認する
  var first = orders[0];
  Logger.log('     --- 1件目のサンプル ---');
  Logger.log('     注文番号: #' + first.order_number);
  Logger.log('     合計金額: ' + first.total_price + ' ' + first.currency);
  Logger.log('     ステータス: ' + first.financial_status);
  Logger.log('     作成日時: ' + first.created_at);
}

// ------------------------------------------------------------
// テスト 4：集計ロジック確認
// 取得した注文データで calcSummary() の計算結果を確認する
// ------------------------------------------------------------
function testCalcSummary() {
  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  var orders = fetchTodayOrders(token);
  var summary = calcSummary(orders);

  Logger.log('[OK] 集計完了');
  Logger.log('     売上総額: ' + summary.totalAmount);
  Logger.log('     注文件数: ' + summary.count);
  Logger.log('     平均客単価: ' + summary.avgAmount);
}

// ------------------------------------------------------------
// テスト 5：Slack メッセージ組み立て確認
// buildMessage() の出力をログで確認する（Slack には送信しない）
// ------------------------------------------------------------
function testBuildMessage() {
  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  var orders = fetchTodayOrders(token);
  var summary = calcSummary(orders);
  var message = buildMessage(summary);

  Logger.log('[OK] メッセージ組み立て完了（以下が Slack に送られます）');
  Logger.log('---');
  Logger.log(message);
  Logger.log('---');
}

// ------------------------------------------------------------
// テスト 6：Google Sheet への書き込み確認
// 「売上記録」シートにテスト行が追記されるか確認する
// ------------------------------------------------------------
function testLogToSheet() {
  var dummySummary = { totalAmount: 99999, count: 1, avgAmount: 99999 };
  logToSheet(dummySummary);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  var written = sheet.getRange(lastRow, 1, 1, 5).getValues()[0];

  Logger.log('[OK] Sheet 書き込み完了');
  Logger.log('     書き込んだ行: ' + written.join(' | '));
  Logger.log('     ※ テスト用ダミーデータです。確認後に手動で削除してください。');
}

// ------------------------------------------------------------
// テスト 7：Slack 送信確認
// 実際に Slack へ送信する（SLACK_WEBHOOK_URL が必要）
// ------------------------------------------------------------
function testSlackPost() {
  if (!SLACK_WEBHOOK_URL) {
    Logger.log('[SKIP] SLACK_WEBHOOK_URL が設定されていないためスキップします');
    return;
  }

  var token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  var orders = fetchTodayOrders(token);
  var summary = calcSummary(orders);
  var message = buildMessage(summary);

  postToSlack(message);
  Logger.log('[OK] Slack 送信完了。チャンネルを確認してください: ' + SLACK_CHANNEL);
}

// ------------------------------------------------------------
// 全テストをまとめて実行する
// 上から順に実行して問題を早期発見する
// ------------------------------------------------------------
function runAllTests() {
  Logger.log('========== テスト開始 ==========');

  Logger.log('\n[1/7] Script Properties 確認');
  testProperties();

  Logger.log('\n[2/7] Shopify API 接続確認');
  testShopifyConnection();

  Logger.log('\n[3/7] 注文取得確認');
  testFetchOrders();

  Logger.log('\n[4/7] 集計ロジック確認');
  testCalcSummary();

  Logger.log('\n[5/7] メッセージ組み立て確認');
  testBuildMessage();

  Logger.log('\n[6/7] Sheet 書き込み確認');
  testLogToSheet();

  Logger.log('\n[7/7] Slack 送信確認');
  testSlackPost();

  Logger.log('\n========== テスト完了 ==========');
}
