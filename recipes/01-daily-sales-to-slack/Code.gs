// ============================================================
// エントリポイント
// GASのトリガーからこの関数を呼び出す
// ============================================================

function sendDailySalesReport() {
  var accessToken = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  if (!accessToken) {
    throw new Error('ACCESS_TOKEN が Script Properties に設定されていません。README の設定手順を確認してください。');
  }

  var orders = fetchTodayOrders(accessToken);
  var summary = calcSummary(orders);
  logToSheet(summary);
  var message = buildMessage(summary);
  postToSlack(message);
}

// ============================================================
// Shopify API から当日の注文一覧を取得する
// 250件超の場合はページネーションで全件取得する
// ============================================================

function fetchTodayOrders(accessToken) {
  // 当日の開始・終了を JST で算出し、Shopify が受け取れる ISO 8601 形式に変換する
  var now = new Date();
  var todayStart = new Date(
    Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd') + 'T00:00:00+09:00'
  );
  var todayEnd = new Date(
    Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd') + 'T23:59:59+09:00'
  );

  var baseUrl = 'https://' + STORE_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json';
  var params = {
    'created_at_min': todayStart.toISOString(),
    'created_at_max': todayEnd.toISOString(),
    'financial_status': ORDER_FINANCIAL_STATUS,
    'status': 'any',
    'limit': 250
  };

  var headers = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json'
  };

  var allOrders = [];
  var url = buildUrl(baseUrl, params);

  // ページネーション：Link ヘッダーに next が含まれる限り取得を続ける
  while (url) {
    var response = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      throw new Error('Shopify API エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
    }

    var data = JSON.parse(response.getContentText());
    allOrders = allOrders.concat(data.orders);

    url = getNextPageUrl(response.getHeaders()['Link']);
  }

  return allOrders;
}

// ============================================================
// 注文一覧から売上総額・件数・平均客単価を計算する
// ============================================================

function calcSummary(orders) {
  var totalAmount = 0;
  var count = orders.length;

  for (var i = 0; i < orders.length; i++) {
    // total_price は文字列で返ってくるので数値に変換する
    totalAmount += parseFloat(orders[i].total_price);
  }

  var avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

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
  var today = Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT);
  var separator = '────────────────────';

  return [
    '📊 本日の売上レポート（' + today + '）',
    separator,
    '売上総額：￥' + summary.totalAmount.toLocaleString(),
    '注文件数：' + summary.count + ' 件',
    '平均客単価：￥' + summary.avgAmount.toLocaleString(),
    separator,
    '集計対象：' + today + ' 00:00 ～ 23:59（' + TIMEZONE + '）'
  ].join('\n');
}

// ============================================================
// Slack Incoming Webhook にメッセージを POST する
// ============================================================

function postToSlack(message) {
  var payload = JSON.stringify({
    channel: SLACK_CHANNEL,
    text: message
  });

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);

  if (response.getResponseCode() !== 200) {
    throw new Error('Slack 送信エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
}

// ============================================================
// 売上データを Google Sheet に記録する
// シートがなければヘッダー行を自動作成する
// ============================================================

function logToSheet(summary) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  // シートが存在しない場合は新規作成してヘッダーを追加する
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['日付', '売上総額', '注文件数', '平均客単価', '記録日時']);
    sheet.setFrozenRows(1);
  }

  var today = Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT);
  var now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([today, summary.totalAmount, summary.count, summary.avgAmount, now]);
}

// ============================================================
// ユーティリティ関数
// ============================================================

// オブジェクトをクエリパラメータ付きの URL に変換する
function buildUrl(baseUrl, params) {
  var parts = [];
  for (var key in params) {
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
  }
  return baseUrl + '?' + parts.join('&');
}

// Shopify の Link ヘッダーから次ページの URL を取り出す
// 例: <https://...?page_info=xxx>; rel="next"
function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  var match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
