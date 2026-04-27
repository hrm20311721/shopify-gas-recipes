# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Shopify店舗・通販エンジニア向けの Google Apps Script 自動化レシピ集（全7レシピの教材）。

- **レシピ1〜2**：無料公開（このパブリックリポジトリ）
- **レシピ3〜7**：有料（別リポジトリ `shopify-gas-recipes-premium` で管理）

## 想定読者

- 副業でフルリモート収入を作りたい未経験〜初級エンジニア
- Shopify店舗運営者で業務を自動化したい人
- GAS未経験者でも読めるレベルを維持する

## 使用技術

- **Google Apps Script**（プレーンなJavaScript、ES5〜一部ES6）— TypeScriptは使わない（初心者の学習コストを下げるため）
- **Shopify Admin REST API**（最新の安定版）
- **Slack Incoming Webhook**
- **Google Sheets API**（必要に応じて）

## リポジトリ構成

```
recipes/
  01-daily-sales-to-slack/
    README.md        # 教材本文（課題・完成イメージ・設定手順・応用ヒント）
    config.gs        # ユーザーが書き換える環境依存の設定値
    Code.gs          # メインロジック（ユーザーは原則触らない）
    appsscript.json  # GASプロジェクトマニフェスト
  02-*/
  ...
shared/
  # 共通ヘルパー関数
```

各レシピは独立したGASプロジェクトとして動作する。ユーザーは `config.gs` だけ書き換えれば動作する設計にする。

## 各レシピのREADMEテンプレート

1. 課題（困りごと）
2. 完成イメージ（動作のスクショ・GIF）
3. コード（コメント付き）
4. 設定手順（スクショ付き）
5. 応用ヒント

## コードスタイル

- **コメントは日本語**、変数名・関数名は英語
- 初心者が読める粒度でコメントを書く
- エラーハンドリングは最小限（教材用のシンプルさを優先）
- GASのグローバルスコープ制約に注意：`require`/`import` は使えず、全ファイルがスコープを共有する

### config.gs の設計方針

- APIキー・トークンなどの機密情報は **config.gs にも書かない**（`PropertiesService` で管理）
- ストアドメイン、Webhook URL、通知文言、タイムゾーンなど「環境依存の値」を集約する
- 「必須設定」「任意設定」のセクションに分けてコメントで明示する
- 各設定項目に取得方法・例・想定値の説明をコメントで記載する

### Code.gs の設計方針

- ビジネスロジック（API呼び出し、データ加工、Slack送信など）を集約する
- `config.gs` で定義した定数を参照する形にする
- ユーザーは原則編集不要

## セキュリティと公開時の注意

このリポジトリは **Public** のため、GitHub Secret Scanning が全コミットに対して自動的に動作する。

### 検出されるパターン

ダミー文字列・コメント・サンプルであっても、以下のパターンが含まれていると push がブロックされる。

| サービス | 検出されるパターン例 |
|---|---|
| Slack Incoming Webhook | `hooks.slack.com/services/` を含む URL |
| Shopify アクセストークン | `shpat_` で始まる文字列 |
| その他 API キー | `sk-`、`Bearer ` + ランダム文字列 など |

### コメント・README の書き方ルール

- `config.gs` や `README.md` にサンプル URL・トークン形式を **そのまま書かない**
- 取得方法・形式は文章で説明し、実際の値はユーザーが各自取得することを促す

**NG 例（push ブロックされる）：**
```
// 例: "https://hooks.slack.com/services/XXXXXXX/XXXXXXX/XXXXXXX"
```

**OK 例：**
```
// 取得方法: Slack アプリ管理画面 > Incoming Webhooks > Webhook URL をコピー
```

### 誤って検出された場合の修正手順

push が通っていない（直前のコミットのみの問題）であれば amend で修正する。

```bash
# ファイルを修正後
git add <修正ファイル>
git commit --amend --no-edit
git push origin main
```

## GAS固有の注意点

- 実行環境はブラウザではなくGoogleのサーバー。`window`・`document` は存在しない
- `appsscript.json` の `oauthScopes` に使用するAPIのスコープを明示する
- Shopify APIの認証はBasic認証（`access_token`）をヘッダーに付与する形式
- `UrlFetchApp.fetch()` がHTTPリクエストの唯一の手段
