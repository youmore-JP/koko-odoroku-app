# AGENTS.md — タイムカードPWA 運用ガイド

このファイルは opencode が次回このアプリを更新するときに自動で読む手順書です。

## プロジェクト概要

- アプリ: 就労継続支援B型「ココロオドル」勤退管理(タイムカード) PWA
- 実体: 単一ファイル `index.html`(データ処理全部入り) + `manifest.json` + `sw.js` + アイコン2枚
- データ: **すべて `localStorage` に保存**(サーバー不要・端末内保存)
  - `RECORDS_KEY`=打刻, `DAILY_KEY`=業務日誌, `INCIDENT_KEY`=ヒヤリハット・事故報告, `STAFF_KEY`=名簿, `TEMPLATE_KEY`=活動テンプレート, `SUPPORT_KEY`=個別支援記録, `SUPPORT_TMPL_KEY`=個別支援記録テンプレート(作業グループ別), `SUPPORT_CARE_TMPL_KEY`=個別支援記録テンプレート(支援グループ別)
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
- `screen-support`: 個別支援記録(日付単位の確認・編集・追記)
- `screen-records`/`screen-staff`/`screen-template`/`screen-export`/`screen-backup`: 管理系

## 実装済み機能メモ

- 事故報告フォームの戻るボタンは「どこから開いたか」で動的変化: `incidentFormFrom`(`main`=打刻画面へ / `list`=報告書一覧へ)。一覧→新規作成は `openIncidentForm('list')`
- 業務日誌の特記事項にその日の報告書を自動反映: `incidentSummaryFor(ymd)` が `ヒヤリハットあり（当事者〇〇・〇〇）、事故あり（当事者〇〇）` を動的生成(表示・印刷両方)。報告書の追加/編集/削除に自動追従。当事者は `users`(利用者)+`staffs`(職員)
- **個別支援記録の自動生成**: 利用者の出勤打刻時(`saveStamp`)とまとめて入力(`applyBulk`)で、その日の記録が無ければ `ensureSupportRecord()` が自動生成(1人1日1件・`SUPPORT_KEY` に `YYYY-MM-DD|userid` キーで保存)。テキストは `supportTextFor()`: その日の報告書に当事者として載っていれば報告内容(【ヒヤリハット】/【事故】+何がおきた+対応)、無ければ定型文構成「送迎にて/各自にて通所した。→体調行(「体調不良なく、作業できていた。」「体調も良好で、元気に取り組めた。」「体調良好で、落ち着いて過ごせた。」の3種から毎日ランダム)→作業行(`randomVariant()`で作業グループのテンプレ複数行から毎日ランダム)→支援行(支援グループの定型文・**ランダムなし・複数行はすべて入る**・画面説明もその旨)→作業時間行→送迎にて/各自にて退所した。」。作業時間行は `workTimeLineFor()`: 打刻(in/out)と休憩から「作業時間はX時間Y分でした。」を生成、打刻が揃わない日は「作業に参加できていた。」。1時間未満は「30分」表記(`minToHM`)。記録者はデフォルト「齊藤輝之」(`SUPPORT_RECORDER_DEFAULT`)、編集画面で変更可
- **自動生成行の追従**: `refreshSupportAuto(ymd, person)` が、記録が自動生成の形の行(先頭の通所文・「作業時間は…でした。/作業に参加できていた。」行・末尾の退所文)だけを最新の打刻値に差し替える。呼び出し元: 退勤打刻(`saveStamp`)、実績表の時刻修正(`editTime`)/送迎修正(`editTransfer`)、まとめて入力(`applyBulk`)。職員が編集済みの行(形が変わった行)には触らない
- 報告書の保存時(`saveIncident`→`applyIncidentToSupport`)に当事者利用者の記録を更新: 無ければ新規作成 / 記録が**自動生成の形(先頭=通所文・末尾=退所文)のままなら報告内容に置き換え** / 手書き・追記済みなら末尾に追記。報告書の削除では記録を変更しない
- 個別支援記録の編集画面(`screen-support`)は「その日打刻のある利用者」を表示。各行に作業/支援グループのバッジ(画面のみ・印刷されない)。全文編集+追記ボタン(日時・記録者つきで末尾追記、個別メモが追記欄に初期表示)+記録者変更、一括保存。印刷は `screen-export` の「個別支援記録」タブから利用者ごとの月間シート(A4・日付/曜日/記録内容/記録者・署名欄・氏名行に作業/支援グループ併記)
- 作業グループは「組立」「検品」「袋詰め」(軽作業の枠組みを3分割)と「清掃・猫飼育」の4つ(`SUPPORT_GROUPS`)。テンプレは「（ネジの組立/検品/袋詰め）」表記方式。旧「建材組み立て」は廃止済みで、`loadStaff()`(名簿)と`loadSupportTmpl()`(テンプレ)が読み込み時に「組立」へ自動移行(カスタムテンプレは保持)。支援グループは「自立」「支援」の2つ(`SUPPORT_CARE_GROUPS`)。利用者は `group` と `careGroup` を持ち(未設定はそれぞれ先頭グループ扱い)、名簿管理で変更可。テンプレは活動テンプレート画面でグループ別に設定(`SUPPORT_TMPL_KEY`=作業/`SUPPORT_CARE_TMPL_KEY`=支援)。作業テンプレは1行=1バリエーションで毎日ランダム選択
- **過去記録の一括作成と削除**: 個別支援記録画面の「打刻済みで記録の無い日を一括作成」(`bulkCreateMissingSupport()`)が、**in/out両方の打刻があり記録未作成の過去日(今日以前)だけ**を対象に件数確認後に一括生成。本文はその日付で `supportTextFor()` を実行するため、**実行時点の名簿グループで全期間が統一される**(グループ変更前に実行しないこと。実行前のデータバックアップ推奨)。記録者・`group` は実行時の値で保存。2回実行しても記録済みはスキップ。削除ボタン(`deleteSupportRecord()`)は**保存済み記録の行にのみ**表示され、記録だけを削除(打刻データには触れない・未保存編集があるときは確認)。**削除した行はセッション中は非表示**(`deletedSupportKeys`)になり、日付移動・画面離脱で解除される(誤って「保存」して再作成される問題の対策)
- **まとめて入力の安全策**: 日付チップは**未来日を選択不可**(`.future` クラス・`toggleBulkDay` でもガード)。「全日」ボタンは平日かつ今日以前のみ選択(週末・未来日は対象外)。`applyBulk` でも未来日キーを除外し、件数に「未来日n件は対象外」と表示
- **実績表の削除**: `delRecord()` は打刻と**同日の個別支援記録も同時に削除**(記録がある日は確認文言に明記)。職員の休憩は実績表の職員行の休憩セル(タップで編集)から「必要時だけ」入力し、**入れた分だけ勤務時間から控除**される。職員の既定休憩は0分(旧既定60分は読み込み時に1回だけ0へ移行)。利用者の既定は60分のまま
- **バックアップ取り込み**: `importBackup()` は**真の復元**(バックアップに無いキーは端末から削除され、現在のデータは消える)。確認文もその旨
- **テンプレ移行の永続化**: `loadSupportTmpl()` / `loadSupportCareTmpl()` は移行(建材組み立て→組立・不足グループ追加)を検出した場合のみ**1回保存**する(毎ロードの再移行を防止)
- **個別メモ**: 利用者に `note` フィールド(名簿管理で設定)。個別支援記録画面の追記欄に初期表示され、職員が「追記」ボタンで `〔追記 …〕` 形式で本文に追加する(自動では本文に含めない)

## 動作確認方法(Playwright)

- ローカル確認: `cd /home/cocololo/koko-odoroku-app && python3 -m http.server 8123` → http://localhost:8123/index.html
- 本番確認: https://youmore-jp.github.io/koko-odoroku-app/
- キャッシュを消す時: `caches.keys()` を全削除 + `serviceWorker.getRegistrations()` を unregister してから再読み込み
- オフライン確認: `context.setOffline(true)` で再読み込み → 表示されること
- 検証後は必ずテストデータを localStorage から削除すること
