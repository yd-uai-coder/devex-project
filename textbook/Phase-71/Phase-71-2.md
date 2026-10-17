# Phase-71-2: DFD のデータストアの書き漏れ(逆向きの照合)

## この章の目的

段階3の検証は、DFD → CRUD 図の向き(DFD に書き込みの線があるのに CRUD 図に C/U/D が無い)だけを見ていた。逆向きは見ていなかった。つまり、CRUD 図に C/U/D があるのに、DFD にデータストアも線も無い場合は指摘されない。Phase 49 で、アップロードしたファイル・会話の記録・生成した文書の保存先が DFD から抜けた例が見つかった([49-2](../Phase-49/Phase-49-2.md))。この章では次の2つを行う。

- 逆向きの照合を警告として足す。
- DFD のプロンプトに、保存するデータはすべてデータストアにする規則を足す。

自動実装モード: on([introduction](./Phase-71-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/data_flow_drafting.py`](../samples/backend/app/detailed_design/data_flow_drafting.py) | 更新 | `DFD_SYSTEM_PROMPT` に保存先の規則 |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `selected_dfd_processes`・`_dfd_store_missing`(`DFD_STORE_MISSING`) |
| [`tests/unit/test_data_model.py`](../samples/backend/tests/unit/test_data_model.py) | 更新 | 逆向きの照合。既定の DFD に F-01 の書き込みの線(`_WRITE`) |
| [`tests/unit/test_data_flow_drafting.py`](../samples/backend/tests/unit/test_data_flow_drafting.py) | 更新 | 規則の文 |

## 1. 調べて分かったこと

- 原因は、ER が DFD に無いテーブルも足せることである(ER のプロンプトは DFD のデータストアの名前を入力にしつつ、必要なテーブルを足してよい)。さらに CRUD 図のプロンプトは「DFD に無い処理も処理概要表から判断して書く」ので、CRUD 図にだけ書き込みが残る。
- 逆向きの件数は、Phase 49 の測定のスクリプト(`appendix/stage7-effect/stage35.py`)が数えていた。ただし、検証には入っていなかった(1/3 で見送った)。
- DFD を描くかどうかは、段階2で機能グループごとに選ぶ。選んでいないグループの処理は DFD に無いので、照合の対象から外す必要がある(外さないと、描いていない処理がすべて指摘される)。

## 2. 逆向きの照合(`validation.py`)

```python
# app/detailed_design/validation.py
def selected_dfd_processes(sources: StageSources) -> set[str]:
    """段階2で選んだグループの DFD にある処理の ID(selected_dfd_accesses と同じ絞り方)。"""

def _dfd_store_missing(parsed: CrudModel, writes: set[tuple[str, str]], processes: set[str]) -> list[StageIssue]:
    for cell in parsed.cells:
        key = (cell.function_id, table_key(cell.table))
        if cell.function_id not in processes or key in writes:
            continue
        if not set(cell.ops) & {"C", "U", "D"}:
            continue
        issues.append(_warning("DFD_STORE_MISSING",
            f"CRUD 図では {target} が「{cell.ops}」ですが、段階2の DFD に … への線がありません(…)", target))
```

- `validate_data_model` は、既存の `writes`(DFD の書き込みの線の組)を渡して呼ぶ。
- 非自明な判断:
  - **警告にした**(承認は止めない)。直す先は上流の段階2で、エラーにすると段階2へ戻ることを強いる。CRUD 図の操作のほうが正しいこともある(読むだけの処理に C を付けた)ので、文言でも両方の直し方を案内する。
  - **文言を `DFD_WRITE_MISSING` と違う形にした**。測定の `drive.py` の `fix_crud` は、`(F-\d+) × (\S+) の書き込み` の正規表現で `DFD_WRITE_MISSING` を読み取る。新しい指摘をこれに当てないため、「{target} が「C」ですが」の形にした。
  - 読みの線しか無い場合も指摘する(CRUD 図が書き込むなら、DFD に書き込みの線が要る)。

## 3. DFD のプロンプト(`data_flow_drafting.py`)

```python
# app/detailed_design/data_flow_drafting.py(DFD_SYSTEM_PROMPT に足した1行)
"- 処理が保存するデータ(アップロードしたファイル・会話の記録・生成した文書・履歴を含む)は、"
"すべてデータストアにし、処理 → データストアの線を描く(DFD に無い保存先は CRUD 図との"
"照合で抜けになる)\n"
```

- 例は、49-2 で抜けた3つ(参考資料・チャットの記録・生成した文書)をそのまま挙げた。Phase 70 の「名指しすると効く」と同じ考え方である。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_validate_warns_crud_write_without_dfd_store` | `validate_data_model`・`selected_dfd_processes` | pytest の関数 | スタブ不要 ── DFD・ER を要約(`DfdDiagramSummary`・`ErDiagramSummary`)で渡す純粋関数 | 読みの線だけで C → 警告・文言 / R だけ → なし / 書き込みの線あり → なし / 選んでいないグループ → なし |
| `test_validate_requires_approved_er` ほか(既存) | `validate_data_model` | 同上 | 同上 | 既定の DFD に F-01 × reservations の書き込みの線を持たせ(`_WRITE`)、CRUD の fixture と食い違わないようにした |
| `test_validate_warnings`(更新) | 同上・`selected_dfd_accesses` | 同上 | 同上 | 既存の警告の並びが変わらない |
| `test_group_dfd_messages_contain_only_group_summaries_and_dictionary`(更新) | `DFD_SYSTEM_PROMPT`・`build_group_dfd_messages` | 同上 | スタブ不要 ── 定数 | 保存先の規則の文 |

- 既存のテストは、DFD の書き込みの線が無いまま CRUD の fixture(`crud_model()` は F-01 × reservations の C)を検証していた。新しい警告が出るので、テストの既定の DFD の線のほうを fixture に合わせた(期待のほうは変えていない)。
- この章で更新した本体のファイルは、`validation.py` を `test_data_model.py` が、`data_flow_drafting.py` を `test_data_flow_drafting.py` が import する。テストが新しく import するのは、この章の `selected_dfd_processes` だけである。前方 import は無い。
