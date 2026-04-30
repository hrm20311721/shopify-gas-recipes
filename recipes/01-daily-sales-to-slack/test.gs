// ============================================================
// テスト用ファイル（開発ストア接続テスト）
// GAS エディタで各関数を個別に選択して実行してください
// 本番環境にこのファイルは不要です
// ============================================================

// ------------------------------------------------------------
// テスト 1：シートの存在確認
// 「注文データ」シートが存在するか確認する
// ------------------------------------------------------------
function testSheetExists() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET_NAME);

  if (!sheet) {
    Logger.log('[FAIL] "' + ORDERS_SHEET_NAME + '" シートが見つかりません');
    Logger.log('       Shopify Flow の設定またはシート名を確認してください');
    return;
  }

  const lastRow = sheet.getLastRow();
  Logger.log('[OK] シートが見つかりました');
  Logger.log('     シート名: ' + ORDERS_SHEET_NAME);
  Logger.log('     データ行数: ' + (lastRow - 1) + ' 行（ヘッダー除く）');
}

// ------------------------------------------------------------
// テスト 2：未通知の注文取得確認
// getUnnotifiedOrders() の結果をログで確認する
// ------------------------------------------------------------
function testGetUnnotifiedOrders() {
  const orders = getUnnotifiedOrders();

  Logger.log('[OK] 未通知の注文取得完了');
  Logger.log('     件数: ' + orders.length + ' 件');

  if (orders.length === 0) {
    Logger.log('     未通知の注文がありません');
    Logger.log('     Shopify Flow でテスト注文を作成するか、通知済み列を空にして再実行してください');
    return;
  }

  Logger.log('     --- 1件目のサンプル ---');
  Logger.log('     行番号: ' + orders[0].rowIndex);
  Logger.log('     注文ID: ' + orders[0].orderId);
  Logger.log('     注文番号: ' + orders[0].orderNumber);
  Logger.log('     合計金額: ' + orders[0].totalPrice);
  Logger.log('     作成日時: ' + orders[0].createdAt);
}

// ------------------------------------------------------------
// テスト 3：集計ロジック確認
// calcSummary() の計算結果をログで確認する
// ------------------------------------------------------------
function testCalcSummary() {
  const orders = getUnnotifiedOrders();

  if (orders.length === 0) {
    Logger.log('[SKIP] 未通知の注文がないためスキップします');
    return;
  }

  const summary = calcSummary(orders);

  Logger.log('[OK] 集計完了');
  Logger.log('     売上総額: ￥' + summary.totalAmount.toLocaleString());
  Logger.log('     注文件数: ' + summary.count + ' 件');
  Logger.log('     平均客単価: ￥' + summary.avgAmount.toLocaleString());
}

// ------------------------------------------------------------
// テスト 4：メッセージ組み立て確認
// buildMessage() の出力をログで確認する（Slack には送信しない）
// ------------------------------------------------------------
function testBuildMessage() {
  const orders = getUnnotifiedOrders();

  if (orders.length === 0) {
    Logger.log('[SKIP] 未通知の注文がないためスキップします');
    return;
  }

  const summary = calcSummary(orders);
  const message = buildMessage(summary);

  Logger.log('[OK] メッセージ組み立て完了（以下が Slack に送られます）');
  Logger.log('---');
  Logger.log(message);
  Logger.log('---');
}

// ------------------------------------------------------------
// テスト 5：Slack 送信確認
// 実際に Slack へ送信する（SLACK_WEBHOOK_URL が必要）
// ------------------------------------------------------------
function testSlackPost() {
  if (!SLACK_WEBHOOK_URL) {
    Logger.log('[SKIP] SLACK_WEBHOOK_URL が設定されていないためスキップします');
    return;
  }

  const orders = getUnnotifiedOrders();

  if (orders.length === 0) {
    Logger.log('[SKIP] 未通知の注文がないためスキップします');
    return;
  }

  const summary = calcSummary(orders);
  const message = buildMessage(summary);
  postToSlack(message);

  Logger.log('[OK] Slack 送信完了。チャンネルを確認してください: ' + SLACK_CHANNEL);
}

// ------------------------------------------------------------
// テスト 6：通知済みフラグの書き込み確認
// markAsNotified() を実行して E 列に日時が記録されるか確認する
// ※ 実行すると対象行が通知済みになります
// ------------------------------------------------------------
function testMarkAsNotified() {
  const orders = getUnnotifiedOrders();

  if (orders.length === 0) {
    Logger.log('[SKIP] 未通知の注文がないためスキップします');
    return;
  }

  markAsNotified(orders);

  Logger.log('[OK] 通知済みフラグを書き込みました');
  Logger.log('     対象行: ' + orders.map(o => o.rowIndex).join(', ') + ' 行目');
  Logger.log('     シートの「通知済み」列を確認してください');
}

// ------------------------------------------------------------
// 全テストをまとめて実行する
// ------------------------------------------------------------
function runAllTests() {
  Logger.log('========== テスト開始 ==========');

  Logger.log('\n[1/6] シート存在確認');
  testSheetExists();

  Logger.log('\n[2/6] 未通知注文取得確認');
  testGetUnnotifiedOrders();

  Logger.log('\n[3/6] 集計ロジック確認');
  testCalcSummary();

  Logger.log('\n[4/6] メッセージ組み立て確認');
  testBuildMessage();

  Logger.log('\n[5/6] Slack 送信確認');
  testSlackPost();

  Logger.log('\n[6/6] 通知済みフラグ書き込み確認');
  testMarkAsNotified();

  Logger.log('\n========== テスト完了 ==========');
}
