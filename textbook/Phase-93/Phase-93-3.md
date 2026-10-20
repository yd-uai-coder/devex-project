# Phase-93-3: 外部設計書の生成の経路と、CR で書き換えてよい要素

## この章の目的

93-1・93-2 の部品を、外部設計書の再生成(`DocGeneratorService`)につなぐ。詳細設計モードでは今の合意を読み、CR で書き換えてよい要素を除いて守り、戻した要素を版の `protection` に残す(列は Phase 92 のもの)。CR で書き換えてよい要素は「対象の要件と、保存した予測の画面・API」([90-1](../Phase-90/Phase-90-1.md) の決定5-2)なので、その求め方を CR の側の純粋関数にまとめ、要件定義書の保護(92-3)と 93-4 の合意の更新でも使う。

自動実装モード: on([introduction](./Phase-93-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/prediction.py`](../samples/backend/app/change_requests/prediction.py) | 更新 | `rewritable_keys` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `rewritable_keys` の re-export |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | `protection` の列のコメント(外部設計書の版も書く) |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `GeneratedDocumentRead.protection` のコメント |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `_generate_external_design` の保護・`_rewritable`・`generate` から CR と記録を渡す |
| [`tests/unit/test_external_design_protection_flow.py`](../samples/backend/tests/unit/test_external_design_protection_flow.py) | 新規 | 束の後の戻し・CR の予測の要素だけ書き換えてよい・簡易モード |

## 1. CR で書き換えてよい要素

```python
# app/change_requests/prediction.py(抜粋)
def rewritable_keys(targets: Sequence[Target],
                    predicted_impact: Mapping[str, Any] | None) -> frozenset[str]:
    # 対象の要件の req:<ID> と、保存した予測の置き場0(文書の側)の要素のキー
```

- **置き場は CR の側**: 「CR が何を書き換えてよいか」は CR の規則で、予測の保存の形(`Prediction.from_dict`)も CR の側にある。`app/agreements` は CR に依存しない。
- 予測の文書の側の要素は画面と API だけ(変更影響分析の要素)。外部連携は予測に出ないので、CR を反映しても常に守る。
- 新しい要件を足す CR(予測なし)では、対象の要件の ID だけになる。新しい要件・画面・API は合意が無いので、元から自由に足せる。
- 予測が保存されていなければ(合意の前の CR は渡されない)、対象の要件だけ。

## 2. 生成の経路

```python
# app/services/doc_generator_service.py(抜粋)
async def _generate_external_design(self, project, requirements_md, requirements,
                                    changed_upstream, instruction="",
                                    change_request: ChangeRequest | None = None, *, llm
                                    ) -> tuple[str, ExternalDesignModel, list[dict] | None]:
    agreed = await self._agreed_elements(project)          # 簡易モードは None
    exempt = _rewritable(change_request)
    ids = agreed_external_ids(agreed or {}, exempt)
    messages = build_external_design_messages(..., agreed_screen_ids=ids.screen_ids, ...)
    model = build_external_design_model(...)
    if agreed is None:
        return render_external_design(model), model, None
    model, restored = protect_external_design(model, previous, agreed, exempt=exempt)
```

- 要件定義書と同じ形(92-3)にそろえた。`_rewritable` は `_generate_requirements` も使う(92-3 では対象の要件の ID だけを集めていた。`protect_requirements` は `req:` のキーしか読まないので、画面・API のキーが入っても挙動は同じ)。
- **予測に無い画面・API が CR で変わったとき**(ユーザー決定): 合意の形に戻す。仕様 2.15節の「書き換えてよいのは予測の要素だけ」のとおりで、戻した要素は版の `protection` に残る(画面は Phase 97)。範囲を広げたいときは、別の CR を出す。予測と実際の比較(Phase 85)の「実際だけ」は、その分だけ減る。
- 下流(内部設計書以降・変更影響分析の印)は、守った外部設計書を入力にする。合意と前の版が同じなら、戻した要素に印は付かない。
- マイグレーションは無い(列は Phase 92 の `protection`。コメントだけ直した)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_external_design_protection_flow.py`(新規) | `DocGeneratorService.generate` の外部設計書の生成(`_generate_external_design`・`_rewritable`)・`rewritable_keys`・`document_read` の `protection` | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)を本物のリポジトリで使う。設計は `create_impact_project`(画面 SCR-001・POST と GET)。LLM は `FakeLLM`(外部設計書の見本 = 画面 SCR-001 と POST だけを、束と違う中身で返し、プロンプトを記録する) |

- 統合スモーク: 束 B-1 の後の、CR を渡さない再生成。画面と POST は書き換え、GET は落ちた → 3つとも合意の形と並びに戻る。合意の無い外部連携は残る。`protection` と応答の `RestoredRead`。プロンプトの印は3行・前の版の外部連携の節。
- CR-1(FR-001)の反映: `rewritable_keys` は FR-001・SCR-001・POST。画面と POST は LLM が書いたまま、予測に無い GET は戻る(`protection` は GET だけ)。
- 簡易ドキュメントモード: 合意を読まず守らない(`protection` は NULL)。
- 既存の `test_requirements_protection_flow.py`(92-3)・`test_change_request_reflection.py`・`test_change_request_verification.py`・`test_doc_generator_service.py` が番人。
