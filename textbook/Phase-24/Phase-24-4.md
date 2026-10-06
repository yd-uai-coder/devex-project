# Phase-24-4: デプロイ ── マイグレーションを先に流す順序と、ステージ3・4の本番反映

## この章の目的

本番は、まだステージ2のまま。この章では、ステージ3(UML設計図)とステージ4(詳細設計モード)を本番に出すために、次の2つを行う。

- 自動デプロイ(GitHub Actions)の順序を改める。マイグレーションが失敗しても、古いコードが古いスキーマのまま動き続けるようにする。
- 本番に反映する手順を `OPERATIONS.md` にまとめる。PR・マージ・push と VPS での確認はユーザーが行い、結果をこの章の末尾に記録する。

自動実装モード: on([introduction](./Phase-24-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。コードは無く、YAML と手順書だけ。インフラのファイルは、Phase 5 の前例に従い、samples に写さず本体を直接編集した。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`devex-api/.github/workflows/deploy.yml`](../../devex-api/.github/workflows/deploy.yml) | 更新 | VPS での順序を「build → `run --rm` で `alembic upgrade head` → `up -d`」に |
| [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md) | 更新 | 3節(初回デプロイ)と9節(自動デプロイ)を同じ順序に。10節「ステージ3・4の本番反映」を追加 |

## 要点の抜粋

```yaml
# devex-api/.github/workflows/deploy.yml(script の部分)
set -e
cd "${{ secrets.VPS_DEVEX_API_PATH }}"
git pull origin main
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml run --rm -T backend uv run alembic upgrade head
docker compose -f docker-compose.prod.yml up -d
```

以前は、次の順だった。

```yaml
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend uv run alembic upgrade head
```

## 設計判断

### マイグレーションを、新しいコードの起動より前に流す

以前の順序では、`up -d --build` の時点で新しいコードのコンテナに入れ替わっていた。そのため、その後のマイグレーションが失敗すると、新しいコードが古いスキーマで動いた。新しい列を読むところで、エラーが続く。

今回の反映では、`e3f4a5b6c7d8` が止まる条件が実際にある。generated_documents に同じ版の番号の行があると、自動では消さずに止まる(Phase 15)。

新しい順序では、次のようになる。

1. 新しいイメージを作る(`build`)。
2. 使い捨てのコンテナ(`run --rm`)でマイグレーションを流す。
3. 成功したときだけ入れ替える(`up -d`)。

失敗すれば `set -e` で止まり、古いコードのコンテナが古いスキーマのまま動き続ける。`run` は `depends_on` に従って postgres・redis の healthy を待つので、初回のデプロイ(DB が動いていない状態)でも同じ順序で使える。

**この順序でも防げないもの**: マイグレーションの後、`up -d` で入れ替わるまでの短い間は、古いコードが新しいスキーマで動く。今回の6本は、列やテーブルを足すもの(既定値つき)と一意制約だけなので、古いコードに影響しない。

列を消す・名前を変えるといった変更をするときは、2回のデプロイに分ける必要がある。1回目で「新旧どちらのコードでも動くスキーマ」にし、2回目で古いものを片付ける(expand → contract)。

### API を先に、UI を後に出す

devex-ui の `main` を push すると、Vercel がすぐデプロイする。古い API(ステージ2)のまま新しい UI が出ると、壊れる画面が出る。

- モード選択(`mode` を送る作成)
- 詳細設計画面
- 設計図の画面

そこで、手順書では「devex-api の反映と確認が済んでから、devex-ui を push する」順序にした。

逆の場合(新しい API に古い UI)は、壊れない。追加した API と列には既定値があるため。

## 本番反映の手順(要約。全文は `OPERATIONS.md` 10節)

1. VPS でバックアップを取る(`pg_dump`)。
2. 重複を確かめる SQL が0行であることを確かめる。`alembic_version` が `a96a8c02c148`(ステージ2の head)であることも確かめる。
3. stage4 → main の PR を作ってマージする(手元の確認では衝突なし)。CI の test が通ると、自動デプロイが走る。
4. Actions のログで、マイグレーション6本の `Running upgrade` を確かめる。`/health` が ok を返すことを確かめる。
5. devex-ui の `main` を push する(Vercel)。
6. 実際の Gemini で、次の2つを通す。図の自動レイアウトと、段階7の生成の所要時間を控える。
   - 簡易ドキュメントモード(4文書)
   - 詳細設計モード(段階1〜7 → zip)

ロールバックは `alembic downgrade a96a8c02c148`(6本)。または、1 のバックアップから戻す。

## 動作確認(実施済み、ローカル)

- `deploy.yml` を `yaml.safe_load` で読めることを確かめた。
- 本番の compose を、別のプロジェクト名と一時的な `edge` ネットワークで立て、新しい順序を通した。

```bash
docker network create edge
P="docker compose -p devex-prodcheck -f docker-compose.prod.yml"
$P build backend
$P run --rm -T backend uv run alembic upgrade head   # 空の DB に10本
$P up -d                                             # /health → {"status":"ok","database":"ok","redis":"ok"}
$P exec -T backend uv run alembic downgrade a96a8c02c148   # 6本
$P exec -T backend uv run alembic upgrade head             # 6本 → f4a5b6c7d8e9 (head)
$P down -v && docker network rm edge
```

## 本番での確認の記録

(ユーザーの実施後に記入する。重複の SQL の結果、Actions のログ、`/health`、簡易・詳細の両モードの結果、図の自動レイアウトと段階7の所要時間、気づいたこと)
