# Phase-5-3: 運用マニュアル・README整備

## この章の目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) WBS区分5「運用マニュアル・READMEの整備」に対応する。ConoHa VPS(devex-api)・Vercel(devex-ui)へのデプロイ手順、バックアップ・ロールバック・監視の最低限を1本の運用マニュアルにまとめ、README群にその導線を追加する。

実装ファイルを作らない章のため、[CLAUDE.md](../../CLAUDE.md)「進行のルール」#13(全ファイル解説)・#14(SUT/ドライバ/スタブ)・#15(全ファイルimport)・#12(リファクタ追従)は対象外(Phase-0の設計章と同様の扱い)。モード宣言(#21)も対象外([`Phase-5-introduction.md`](./Phase-5-introduction.md)参照)。

## この章で作成・更新したファイル

- [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(新規) ── 運用マニュアル本体
- [`devex-api/README.md`](../../devex-api/README.md) ── `GEMINI_MODEL`既定値の記載更新、`OPERATIONS.md`への導線追加、`HEALTHCHECK`・`certbot`サービスの説明追記
- [`devex-ui/README.md`](../../devex-ui/README.md) ── 既存の「Vercelへのデプロイ」節に「Devex固有のデプロイ手順(devex-api連携)」小節を追記

## 運用マニュアルの構成

[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)に、個人開発規模を想定した(エンタープライズ級の監視基盤等は求めない)以下の8節を書いた:

1. **全体構成** ── Vercel(devex-ui) → ConoHa VPS上のnginx(TLS終端) → backend → postgres/redisという構成図
2. **ConoHa VPS初期セットアップ** ── Docker Engine導入、ファイアウォールで80/443のみ公開(5432/6379/8000はcompose側で外部公開していないためVPS側でも開けない)
3. **環境変数の管理方針** ── `.env`はVPS上にのみ実体を置きgitにコミットしない。特に`CORS_ORIGINS`にVercelの本番URLを含めることを明記(未設定だと本番でCORSエラーになる)
4. **初回デプロイ手順** ── `docker compose -f docker-compose.prod.yml up -d --build` → `alembic upgrade head`。証明書が無い状態でも`nginx`を起動できるよう、一時的な自己署名証明書での起動手順も明記([`Phase-5-2.md`](./Phase-5-2.md)でローカル検証した手順と同じ)
5. **TLS証明書の取得・更新** ── [`Phase-5-2.md`](./Phase-5-2.md)で追加した`certbot`サービスを使った初回取得コマンド、certbotの出力(`/etc/letsencrypt/live/`)を`nginx`が参照する`./nginx/certs/`へコピーする手順、cronによる更新(renewal)
6. **バックアップ** ── `pg_dump`をcronで定期実行し、VPS外(手元PC等)へ保存する運用
7. **ロールバック手順** ── gitタグを戻して再ビルド、DBは`alembic downgrade`または5.のバックアップから復元
8. **監視の最低限** ── `docker compose ps`のHEALTH列([`Phase-5-1.md`](./Phase-5-1.md)で追加したHEALTHCHECK)、`curl .../health`、`docker compose logs`
9. **devex-ui(Vercel)デプロイ手順** ── Vercelへのリポジトリ接続(標準のNext.js検出、追加設定不要)、`NEXT_PUBLIC_API_URL`のEnvironment Variables設定、devex-api側`CORS_ORIGINS`への追加

## 証明書取得手順を「設計のみ」に留めた理由

[`Phase-5-2.md`](./Phase-5-2.md)「既知の残課題」に記載の通り、実ドメインが無いローカル環境ではcertbotによる実際のLet's Encrypt発行を検証できない。ユーザーとの相談で確定したスコープ([`Phase-5-introduction.md`](./Phase-5-introduction.md)「スコープ」節)通り、本Phaseは実際のVPS/Vercelへのライブデプロイを行わないため、この手順は「実行して結果を確認する」のではなく「実行可能な形で手順を書き切る」ことがゴールになる。`docker compose --profile certbot run --rm certbot ...`というコマンド自体は構文検証済みだが、実行(証明書の実発行)自体はユーザーが実VPS上で行う。

## READMEへの反映

`devex-api/README.md`は、既存の「本番環境」節の冒頭に`OPERATIONS.md`への導線を追加し、[`Phase-5-1.md`](./Phase-5-1.md)・[`Phase-5-2.md`](./Phase-5-2.md)で行った変更(HEALTHCHECK・certbotサービス)の説明を追記した。「未実装・今後対応が必要な事項」節の証明書に関する記述も、「本テンプレートには含まれていない」から「`certbot`サービス+cron/systemd timerによる手動運用」に更新した(完全自動化はしていない点は明記したまま)。

`devex-ui/README.md`は、既存の「Vercelへのデプロイ」節(一般的なテンプレートとしての説明。DB非依存・`vercel.json`不要等)をそのまま残し、その直後に「Devex固有のデプロイ手順(devex-api連携)」という小節を追記する形にした。既存の一般的な説明を書き換えるのではなく追記に留めたのは、[`Phase-5-introduction.md`](./Phase-5-introduction.md)のスコープ確定時点で「README全体の書き直しはスコープ外」としたため(`devex-ui/CLAUDE.md`が`src/features/`のDevex機能層を反映しておらず全体的に古い、という既知の課題も同様の理由で本Phaseの対象外とした)。

## テスト観点

実装ファイルを作らない章のためテスト対象外。検証は目視レビュー(手順の実行可能性の机上確認)と、#26(md相互参照はリンクで明記)に沿ったリンク切れの有無の確認で代替する。

## 既知の残課題

- `devex-ui/CLAUDE.md`が依然として一般的なテンプレート説明のままで、`src/features/{dashboard,hearing,documents}`等のDevex機能層を反映していない。運用マニュアルの整備とは別の文書債務であり、本Phaseのスコープ確定時点で対象外と合意済み([`Phase-5-introduction.md`](./Phase-5-introduction.md)参照)。
- 運用マニュアルの手順(証明書取得、バックアップ、ロールバック)は机上設計・部分検証(ローカルでの自己署名証明書によるnginx起動確認等)に留まり、実VPS上での通し確認は行っていない。実デプロイ時に手順の過不足が見つかる可能性がある。
