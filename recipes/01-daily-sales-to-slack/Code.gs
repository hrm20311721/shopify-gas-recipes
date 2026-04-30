// ============================================================
// エントリポイント
// GAS のトリガーからこの関数を呼び出す
// ============================================================

function sendDailySalesReport() {
  // 未通知の注文をシートから取得する
  const orders = getUnnotifiedOrders();

  // 未通知の注文がなければ処理を終了する
  if (orders.length === 0) {
    console.log('未通知の注文がないため通知をスキップします');
    return;
  }

  const summary = calcSummary(orders);
  const message = buildMessage(summary);
  postToSlack(message);
  markAsNotified(orders);
}

// ============================================================
// シートから未通知の注文を取得する
// 「通知済み」列（COL_NOTIFIED）が空の行を対象とする
// ============================================================

function getUnnotifiedOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET_NAME);
  if (!sheet) {
    throw new Error(ORDERS_SHEET_NAME + ' シートが見つかりません。Shopify Flow の設定を確認してください。');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // ヘッダー行のみ、またはデータなし

  // 2行目からデータを全件取得する（1行目はヘッダー）
  const data = sheet.getRange(2, 1, lastRow - 1, COL_NOTIFIED).getValues();
  const orders = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // 通知済み列に値がある行はスキップする
    if (row[COL_NOTIFIED - 1]) continue;

    orders.push({
      rowIndex:    i + 2, // シート上の実際の行番号（ヘッダー分を加算）
      orderId:     row[COL_ORDER_ID - 1],
      orderNumber: row[COL_ORDER_NUMBER - 1],
      totalPrice:  parseFloat(row[COL_TOTAL_PRICE - 1]) || 0,
      createdAt:   row[COL_CREATED_AT - 1]
    });
  }

  return orders;
}

// ============================================================
// 注文一覧から売上総額・件数・平均客単価を計算する
// ============================================================

function calcSummary(orders) {
  let totalAmount = 0;

  for (let i = 0; i < orders.length; i++) {
    totalAmount += orders[i].totalPrice;
  }

  const count = orders.length;
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

  return {
    totalAmount: Math.round(totalAmount),
    count: count,
    avgAmount: avgAmount
  };
}

// ============================================================
// Slack に投稿するメッセージ文字列を組み立てる
// ============================================================

function buildMessage(summary) {
  const today = Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT);
  const separator = '────────────────────';

  return [
    '🛍️ 新しい注文レポート（' + today + ' 時点）',
    separator,
    '売上総額：￥' + summary.totalAmount.toLocaleString(),
    '注文件数：' + summary.count + ' 件',
    '平均客単価：￥' + summary.avgAmount.toLocaleString(),
    separator,
    '集計対象：前回通知以降の新規注文 ' + summary.count + ' 件'
  ].join('\n');
}

// ============================================================
// Slack Incoming Webhook にメッセージを POST する
// ============================================================

function postToSlack(message) {
  const payload = JSON.stringify({
    channel: SLACK_CHANNEL,
    text: message
  });

  const response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Slack 送信エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
}

// ============================================================
// 通知済みの注文行に通知日時を書き込む
// ============================================================

function markAsNotified(orders) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET_NAME);
  const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd HH:mm:ss');

  // 列番号をアルファベットに変換する（例: 5 → "E"）
  const col = String.fromCharCode(64 + COL_NOTIFIED);

  // 書き込み対象のセルアドレスをまとめて生成する（例: ["E3", "E5", "E8"]）
  const a1Notations = orders.map(o => col + o.rowIndex);

  // getRangeList でまとめて指定し setValue を1回だけ呼ぶ（API呼び出しを削減）
  sheet.getRangeList(a1Notations).setValue(now);
}
