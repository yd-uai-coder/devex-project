# Phase-91-5: 既存の束からの移行

## この章の目的

ステージ11 で作った束(開発 DB にある)から、合意の記録を作るデータのマイグレーションを書く(ユーザー決定。推奨は「移行しない」だった)。これで、開発 DB の「トレンド追跡アプリ」(Phase 99 の効果測定の題材)が、新しい束を作り直さなくても、Phase 92 の保護の対象になる。本番にはまだ束が無い(ステージ11 は未反映)ので、本番では何も起きない。

自動実装モード: on([introduction](./Phase-91-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/75d414ded7cb_backfill_agreement_records.py`](../samples/backend/alembic/versions/75d414ded7cb_backfill_agreement_records.py) | 新規 | 束を番号の順に読み、束の作成と同じ規則で記録する(downgrade は何もしない) |
| [`tests/unit/test_agreement_migration.py`](../samples/backend/tests/unit/test_agreement_migration.py) | 新規 | 移行の純粋関数と app の規則の突き合わせ・束の順・外れた |

## 1. 移行の規則

```python
# alembic/versions/75d414ded7cb_backfill_agreement_records.py(抜粋)
def endpoint_key(method: str, path: str) -> str                      # app と同じ規則
def agreed_items(requirements: dict | None, external_design: dict | None) -> list[tuple[key, kind, label, content]]
def baseline_records(baselines: list[dict]) -> list[dict]           # 1プロジェクトの束(番号の順)→ 記録の行
```

- **束の作成と同じ規則**([91-3](./Phase-91-3.md)): 束ごとに、写しの要件定義書・外部設計書の要素をまとめて合意にし、その時点の合意にあって束に無い要素を「外れた」と記録する。記録した日時・人は束のもの。
- **app を import しない**: `d4e5f6a7b8c0_add_unit_keys.py` の前例どおり、変換をファイルの中の純粋関数で書く。後で app の規則が変わっても、この移行の結果は変わらない。代わりに、テストで app の `agreement_items`・`body_of` と突き合わせる。
- **中身は写しの行のまま**(既定値で埋めない): 比べるときは `body_of` が既定値をそろえる([91-1](./Phase-91-1.md))。
- **もう記録があるプロジェクトは変えない**: 何度流しても同じ結果になる。
- **「採用にする」の過去の操作は戻せない**: 誰が・いつを残していなかった。束に入った採用の行は、束の合意として記録される。
- **downgrade は何もしない**: 記録の表は前のマイグレーション(`05c8f8d7cf8b`)の downgrade で消える。移行の後に作った記録と見分けられないので、移行の分だけを消すことはしない。

## 2. 開発 DB で流した結果

| プロジェクト | 束 | 記録(合意) | 外れた |
|---|---|---|---|
| トレンド追跡アプリ | B-1〜B-3 | 18(B-3 の要件12・利用者1・画面2・API1・外部連携2) | 0 |
| 「予約の CR …」の6件(確認用のプロジェクト) | 1〜2 | 10〜20 | 0 |

- トレンド追跡アプリの B-1・B-2 は、写しの model が空(`null`。当時の版に model が無かった)なので、要素が無い。app の束の作成でも同じ(`parse_model` が `None`)。
- `GET /agreements` で、トレンド追跡アプリの今の合意が 18件・出どころがすべて `B-3` であることを確かめた。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_migration.py`(新規) | 移行の `endpoint_key`・`agreed_items`・`baseline_records` | 各テスト関数(移行ファイルを importlib で読み込み、純粋関数を直接呼ぶ) | スタブ不要 ── 変換は純粋関数で DB を呼ばない(行の読み書きは upgrade の責務で、開発 DB で流して確かめた) |

- API のキーが app と同じ / キー・種類・表示名・比べる値が app の `agreement_items`・`body_of` と同じ(利用者・外部連携・パスの引数・空のサービス名を含む)/ B-1 → B-2(要件を1つ外し、1つ変えた)→ B-3(戻した)の順の記録・外れた記録・記録した人と日時 / 写しの無い束はそれまでの合意をすべて外す。
- マイグレーションの往復(開発 DB で downgrade → upgrade)の後も、記録は 118件で同じだった。
