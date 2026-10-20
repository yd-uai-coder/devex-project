# Phase-93-2: 外部設計書のプロンプトの印と、前の版の外部連携

## この章の目的

外部設計書の生成のプロンプトで、前の版の画面・API・外部連携のうち合意済みの行に「合意済み」の印を付ける。LLM が合意済みの行を書き直さなくなれば、93-1 で戻す件数が減る。また、これまで前の版の外部連携はプロンプトに渡していなかったので、LLM は毎回外部連携を書き直していた。前の版の外部連携の節を足し、サービス名の言い換えで重なった行が増えるのを防ぐ(ユーザー決定)。

自動実装モード: on([introduction](./Phase-93-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/external_design/drafting.py`](../samples/backend/app/documents/external_design/drafting.py) | 更新 | 前の版の外部連携の節・合意済みの印・規則の2文・`build_external_design_messages` の `agreed_*` |
| [`tests/unit/test_document_revision.py`](../samples/backend/tests/unit/test_document_revision.py) | 更新 | 印は合意済みの行だけ・外部連携の節・印なしは今までどおり |

## 1. プロンプト

```python
# app/documents/external_design/drafting.py(抜粋)
REVISION = RevisionInputs(
    previous=("前の版の画面", "前の版の API", "前の版の外部連携"), ...)

def build_external_design_messages(requirements_md, previous, changed_requirements=(),
                                   instruction="", *,
                                   agreed_screen_ids: frozenset[str] = frozenset(),
                                   agreed_endpoints: frozenset[str] = frozenset(),
                                   agreed_services: frozenset[str] = frozenset()
                                   ) -> list[BaseMessage]
```

- **新しい節「前の版の外部連携」**: 前の版の外部連携の行(1行1つの JSON)。`REVISION` の前の版の節に足したので、節の分け方のテスト(`test_every_prompt_section_is_classified_as_previous_trigger_or_context`)が、新しい節の分け忘れを見張る。
- **印**: 合意済みの行の末尾に `|合意済み` を付ける。文字列は要件定義書の `AGREED_MARK`(92-2)を共有する。印が無いとき(簡易ドキュメントモード・合意が無いとき)は、今までと同じ出力になる。
- **規則の2文**: 「外部連携のサービス名は、前の版に同じサービスがあれば、その名前のまま書く」と、「印の付いた行は、上流の変わった行・修正指示がその行を指していなければ unchanged にして必ず残す(同じ画面を別の画面 ID で書かない)」。
- 外部連携の下書き(`GeneratedIntegration`)には `unchanged` が無い。外部連携は欄が少なく、合意済みの行は 93-1 でコードで戻すので、構造化出力のスキーマは変えなかった(偽の LLM と E2E の見本を変えずに済む)。
- 引数は合意のキーではなく行の値で受ける(`AgreedExternalIds` の3つ。93-1)。`app/documents` は `app/agreements` に依存しない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_document_revision.py`(追記) | `build_external_design_messages` の印と外部連携の節、`SYSTEM_PROMPT` の規則 | pytest のテスト関数 | スタブ不要 ── 純粋関数(メッセージを組み立てるだけ)のため |

- 印は合意済みの画面・API・外部連携の3行だけに付き、印を渡さなければどの行にも付かない。
- 前の版の外部連携の節が出る(前の版が無ければ「なし」)。
- 規則に印の1文がある。
- 既存の節の分け方のテストが、`REVISION` に足した節を確かめる。
