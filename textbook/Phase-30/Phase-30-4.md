# Phase-30-4: zip への追加(BE・FE)

## この章の目的

詳細設計書・実装計画の zip(`GET /design-stages/document`)に `implementation_procedure/` を加える。段階8が承認済み(古くない)のときだけ手順書を組み立て、それ以外は `index.md` と HTML に「未承認」とだけ書く(着手時の決定4)。画面のダウンロードの帯も、段階8を数えるように改める。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

> 完了後の調整([30-7](./Phase-30-7.md))で、実装手順書は別の zip(`implementation_procedure.zip`)に分け、zip は元になる段階が承認されるまで断るようにした。この章の「未承認なら index と HTML に『未承認』とだけ書く」zip と、1つのボタンの帯は、30-7 の形に置き換わっている(samples は 30-7 のタグで区別)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | `PROCEDURE_*` の定数、`CollectedDocument.procedure`、`collect` が同じ `overview` から `ProcedureOutputSource` を作る、`bundle` が `procedure_files` を書く |
| [`src/features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 更新 | 対象の段階に8を足す。ボタン「詳細設計書・実装計画・実装手順書をダウンロード(.zip)」、未承認の文言 |
| ── ここからテスト ── | | |
| [`tests/unit/test_detailed_design_export.py`](../samples/backend/tests/unit/test_detailed_design_export.py) | 更新 | 未承認なら index と HTML だけ、承認済みなら単位の md と `ai/` も入る |
| [`src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 更新 | 段階1〜8の件数、新しいボタン名 |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 新しいボタン名と件数(8件) |
| [`e2e/detailed-design-flow.spec.ts`](../samples/frontend/e2e/detailed-design-flow.spec.ts) | 更新 | ボタン名、段階8が未承認の1件、zip に `implementation_procedure/index.md`・HTML(この Phase では流さない。#36) |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```python
# app/services/detailed_design_export_service.py
PROCEDURE_DIR = "implementation_procedure"
PROCEDURE_INDEX_NAME = f"{PROCEDURE_DIR}/index.md"
PROCEDURE_HTML_NAME = f"{PROCEDURE_DIR}/implementation_procedure.html"
PROCEDURE_AI_DIR = f"{PROCEDURE_DIR}/ai"

# collect の最後(同じ overview の結果から。DB の読み取りは増やさない)
procedure = procedure_output_source(
    project.title, states[8], approved, approved.get(8),
    validate_stage(8, approved.get(8), sources) if 8 in approved else [],
    sources.documents.get("requirements", ""),
)

def procedure_files(source) -> dict[str, str]:
    # 常に index.md と HTML。承認済みなら、手順書のある単位の <ID>_<名前>.md と ai/<ID>.md
```

## 設計判断

### 承認済みだけを組み立てる(着手時の決定4)

詳細設計書の章と同じ規則にした。承認していない内容は人が確定していないので、zip の本文に出さない。段階1〜7のどれかを承認し直すと段階8は「古い」になり、zip の手順書は「未承認」になる。見本の完了条件「手順書が古いなら再生成している」と同じ流れで、古い手順書を実装に渡さない。

画面の「AI 向けにコピー」は作業中に使うので、保存済みの手順書から作る(30-5)。zip と画面で同じ組み立て関数を使い、入力(承認済み / 保存済み)だけが違う。

### `collect` の中で作る

`collect` は段階の状態と承認済みの内容を `overview` で1回読む。手順書の入力も同じ結果から作り、DB の読み取りを増やさない。段階8の検証は `validate_stage`(画面の段階の一覧と同じ関数)で、承認済みの手順書に対して行う。`collect` は段階7の下書きの生成も使うが、段階7を生成するとき段階8は承認済みでない(段階7の承認の後に開く)ので、手順書の展開は走らない。

### E2E の期待を直した(流すのは Phase 32)

E2E は段階1〜7を承認して zip を落とす。段階8は承認しないので、帯の文言が「段階1〜7はすべて承認済み」から「段階1〜8のうち 1 件が未承認」に変わる。期待とボタン名を直し、zip に手順書の `index.md` と HTML が入ることも足した。全 E2E は Phase 32 で流す(#36)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DetailedDesignExportService.bundle`・`procedure_files` | pytest(`test_detailed_design_export.py`) | スタブ不要 ── DB はインメモリ SQLite(fixture)で、組み立ては純粋関数のテスト(30-1〜30-3)で確かめたため、ここでは zip の構成だけを見る | 第一テスト: 段階8が未承認の zip に `index.md` と HTML が入る(既存の構成のテストに追記)。承認済みなら `M-01-T02_予約を登録する.md`・`ai/M-01-T02.md` も入り、AI 向けの版に「未承認」が無い。保存済みでも未承認なら単位の md を入れない |
| `DesignDocumentBar`・`DetailedDesignPageContent` | vitest + Testing Library | スタブ: fetch・`saveFile`(既存) | 段階1〜8の未承認の件数、新しいボタン名 |
