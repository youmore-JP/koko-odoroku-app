# AGENTS.md — タイムカードPWA 運用ガイド

このファイルは opencode が次回このアプリを更新するときに自動で読む手順書です。

## プロジェクト概要

- アプリ: 就労継続支援B型「ココロオドル」勤退管理(タイムカード) PWA
- 実体: 単一ファイル `index.html`(データ処理全部入り) + `manifest.json` + `sw.js` + アイコン2枚
- データ: **すべて `localStorage` に保存**(サーバー不要・端末内保存)
  - `RECORDS_KEY`=打刻, `DAILY_KEY`=業務日誌, `INCIDENT_KEY`=ヒヤリハット・事故報告, `STAFF_KEY`=名簿, `TEMPLATE_KEY`=活動テンプレート
  - GitHub に上がるのはプログラムのみ。実データは一切含まれない
- 運用: **GitHub Pages**(無料・常時HTTPS・常時稼働)で公開 → AndroidタブレットでPWAインストール → オフライン動作
- インストール済みタブレットは、最初の1回読み込み以降は完全オフラインで動く(Service Workerキャッシュ)

## 更新フロー(毎回必ずこの順で)

1. ファイル編集(`index.html` 等。通常はエディタ/Windowsエクスプローラーから編集される)
2. `git add -A && git commit -m "変更内容の説明"`
3. `git push`(DNS不調に注意、下記参照)
4. GitHub Pages のビルド完了を待つ: `gh api repos/youmore-JP/koko-odoroku-app/pages --jq '.status'` が `built` になるまで(10秒間隔で最大60秒)
5. **sw.js のキャッシュバージョンを上げる**: `var CACHE = "koko-cache-vN"` のNを+1して commit+push(ステップ4を再度)
   - 必須。これがないとタブレットが古いキャッシュを見続ける
6. 実ブラウザ(Playwright)で動作確認 + オフライン確認

## 重要な注意点

- **DNS不安定**: このWSL環境は `github.com` の名前解決が頻繁に失敗する。`git push` が `Could not resolve host` で失敗したら、以下で回避(実証済み):
  ```
  GIT_SSL_NO_VERIFY=true git -c http.extraHeader="Host: github.com" push https://youmore-JP:$(gh auth token)@20.27.177.113/youmore-JP/koko-odoroku-app.git main
  ```
  コミット前に必ずリモートと同期確認すること(`git ls-remote origin`)
- **タブレットのキャッシュ**: SWは stale-while-revalidate。キャッシュバージョンを上げないと更新が届かない。タブレット側でアイコン再インストール不要(データは消えない)
- **localStorage は URL(オリジン)ごと**: データは https://youmore-jp.github.io/koko-odoroku-app/ に紐付く。URLを変えるとデータが見えなくなるので URL は絶対に変えない
- データの保存キー名や形式を変えると古いデータが読めなくなるので、後方互換を保つこと
- 打刻・日誌・報告書のデータ操作はしない(修正はindex.htmlのUI/ロジックのみ)

## GitHub 情報

- リポジトリ: https://github.com/youmore-JP/koko-odoroku-app (公開)
- 公開URL: https://youmore-jp.github.io/koko-odoroku-app/
- gh CLI 認証済み(youmore-JP)。Playwright MCP 利用可能

## 画面構成

- `screen-main`: 打刻画面(全員が最初に見る)
- `screen-manage-entry`: 管理者パスワード入力 → `screen-manage-menu`(管理者メニュー)
- `screen-daily`: 業務日誌(特記事項に事故報告を自動反映)
- `screen-incident`: ヒヤリハット・事故報告一覧 / `screen-incident-form`: 報告フォーム
- `screen-records`/`screen-staff`/`screen-template`/`screen-export`/`screen-backup`: 管理系

## 実装済み機能メモ

- 事故報告フォームの戻るボタンは「どこから開いたか」で動的変化: `incidentFormFrom`(`main`=打刻画面へ / `list`=報告書一覧へ)。一覧→新規作成は `openIncidentForm('list')`
- 業務日誌の特記事項にその日の報告書を自動反映: `incidentSummaryFor(ymd)` が `ヒヤリハットあり（当事者〇〇・〇〇）、事故あり（当事者〇〇）` を動的生成(表示・印刷両方)。報告書の追加/編集/削除に自動追従。当事者は `users`(利用者)+`staffs`(職員)

## 動作確認方法(Playwright)

- ローカル確認: `cd /home/cocololo/koko-odoroku-app && python3 -m http.server 8123` → http://localhost:8123/index.html
- 本番確認: https://youmore-jp.github.io/koko-odoroku-app/
- キャッシュを消す時: `caches.keys()` を全削除 + `serviceWorker.getRegistrations()` を unregister してから再読み込み
- オフライン確認: `context.setOffline(true)` で再読み込み → 表示されること
- 検証後は必ずテストデータを localStorage から削除すること
