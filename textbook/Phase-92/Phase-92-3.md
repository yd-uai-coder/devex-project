# Phase-92-3: 生成の経路と、戻した要素の記録

## この章の目的

[92-1](./Phase-92-1.md)・[92-2](./Phase-92-2.md) の部品を、要件定義書の再生成(`DocGeneratorService`)につなぐ。詳細設計モードでは今の合意を読み、反映する CR の対象を除いて守り、戻した要素を版に残す(画面に出すのは Phase 97、履歴に出すのは Phase 95)。

自動実装モード: on([introduction](./Phase-92-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | 列 `protection`(JSON・NULL 可) |
| [`alembic/versions/956b403c67fe_add_generated_document_protection.py`](../samples/backend/alembic/versions/956b403c67fe_add_generated_document_protection.py) | 新規 | 列を足す(既存の版は NULL) |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `create_version(protection=)` |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `RestoredRead`・`GeneratedDocumentRead.protection` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `_generate_requirements` の保護・`_agreed_elements`・`generate` から CR と記録を渡す |
| [`tests/unit/test_requirements_protection_flow.py`](../samples/backend/tests/unit/test_requirements_protection_flow.py) | 新規 | 採用のまま・書き換えと脱落の戻し・CR の対象・簡易モード |

## 1. 版の列

```python
# app/models/generated_document.py(抜粋)
protection: Mapped[list[dict] | None] = mapped_column(PortableJSON, nullable=True)
# [{"key": "req:FR-002", "reason": "dropped"}, ...]
```

- **版の列にした**(ユーザー決定): 版の応答にそのまま載り、Phase 95(履歴)・97(画面)が版から読める。別の表は、表とリポジトリが増える割に、引き方(キーごと)は合意の記録と版から組み立てられる。
- 値の意味: 合意を守った版は一覧(戻すものが無ければ `[]`)。簡易ドキュメントモード・要件定義書でない版・列を足す前の版は NULL。「守ったが何も戻さなかった」と「守っていない」を分ける。
- マイグレーション `956b403c67fe`(`75d414ded7cb` の後)。列を足すだけで、既存の版は NULL。

## 2. 生成の経路

```python
# app/services/doc_generator_service.py(抜粋)
async def _generate_requirements(self, project, transcript, instruction="",
                                 change_request: ChangeRequest | None = None, *, llm
                                 ) -> tuple[str, RequirementsModel, list[dict] | None]:
    agreed = await self._agreed_elements(project)          # 簡易モードは None
    exempt = frozenset(requirement_key(t.requirement_id)
                       for t in targets_from_json(change_request.targets if change_request else None))
    agreed_ids = agreed_requirement_ids(agreed or {}, exempt)
    messages = build_requirements_messages(..., agreed_ids=agreed_ids, agreed_users=...)
    model = build_model(to_draft(output), previous, states, scale, agreed_ids=agreed_ids)
    if agreed is None:
        return render_requirements(model), model, None
    model, restored = protect_requirements(model, previous, agreed, exempt=exempt)
```

- **モードで分けてから合意を読む**: `AgreementService.current` は簡易モードで 409 の例外を出す(読む API も断るため)。生成は両モードで通るので、`_agreed_elements` が先にモードを見て、簡易モードは読まない。
- **免除は CR の対象の要件**: `targets` の要件 ID(内容の変更・削除の両方)。新しい要件を足す CR の新しい行は、合意が無いので元から自由。利用者(1.2)は CR の対象にならないので、常に守る。
- `generate` は `reflection.change_request` を渡し、戻した一覧を `create_version(protection=)` に渡す。外部設計書から下流は、守った要件定義書を入力に作る(`upstream_changes` も、戻した行は変わっていないと見る)。
- 変更影響分析の印(`record_document_change`)は、守った model と生成の前の版を比べる。合意と前の版が同じなら、戻した行に印は付かない。
- **CR の反映での合意の更新は Phase 93**(ユーザー決定)。それまでは、CR で変えた行(合意とは違う)が、次の CR を渡さない再生成で合意の形に戻る。開発環境だけで起きる(本番への反映はステージ15)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_requirements_protection_flow.py`(新規) | `DocGeneratorService.generate` の要件定義書の生成・`create_version(protection=)` と列・`document_read` の `protection`(`RestoredRead`) | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)を本物のリポジトリで使う。LLM は `FakeLLM`(合意済みの行を書き換え・落とした構造化出力を返し、プロンプトを記録する) |

- 統合スモーク(Phase 90-2 の再現): 観点が未決のまま「採用にする」→ CR を渡さない再生成で、写した行は「採用」のまま。`protection` は `[]`。プロンプトの印は合意済みの行だけ。
- 束 B-1 の後に、LLM が FR-001 を書き換え、FR-002・NFR-001 を落とす → 3行とも合意の形・並びに戻り、新しい NFR-002 は残る。`protection` と応答の `RestoredRead`・次の番号。
- CR-1(FR-001 が対象)の反映: FR-001 は変更後の文になり、落ちた行だけ戻す(既存の fixture `agreed_change_request_project`)。
- 簡易ドキュメントモード: 合意を読まず守らない(`protection` は NULL)。
- 既存の生成・CR の反映・採用・版の巡回のテスト(`test_doc_generator_service.py`・`test_change_request_reflection.py`・`test_agreement_recording.py`・`test_document_versions.py`)が番人。
