# Phase-30-7: 完了後の調整 ── ダウンロードを2つの zip に分け、承認まで押せなくする

## この章の目的

Phase 30 では、詳細設計書・実装計画・実装手順書を1つの zip にまとめ、どの段階が未承認でもダウンロードできた(未承認の章・手順書は「未承認」と書く)。完了後の相談で、次のように改めた(#38。[`q_a.md`](../q_a.md)「Phase 30 完了後 ── ダウンロードの分割」)。

- zip を **「詳細設計書・実装計画」と「実装手順書」の2つ**に分ける。
- それぞれ、元になる段階が承認されるまでボタンを**押せなくし**、透過表示で非活性と分かるようにする。
- 承認前のダウンロードは**サーバーも断る**(409)。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `DesignDocumentNotReadyError`(409 `DESIGN_DOCUMENT_NOT_READY`) |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | `bundle` から手順書を外し段階1〜7で断る、`bundle_procedure`(手順書の zip。段階8で断る)、`missing_approvals`、定数(`DOCUMENT_STAGES`・`PROCEDURE_STAGES`・`PROCEDURE_FILENAME`)、`procedure_files` のパスを zip の直下に |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `GET /design-stages/procedure-document`、zip の応答を `_zip_response` にまとめる |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `downloadImplementationProcedure`(共通部分を `downloadZip` に) |
| [`src/features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 更新 | `DOWNLOADS`(2つのボタンと元になる段階)・`unapprovedStages`。押せないボタンは `disabled` + 透過(`opacity` 0.5)+ 未承認の段階の案内 |
| ── ここからテスト ── | | |
| [`tests/unit/test_detailed_design_export.py`](../samples/backend/tests/unit/test_detailed_design_export.py) | 更新 | `missing_approvals`、手順書の zip(中身・409)、段階1〜7が未承認なら 409 で図も `exported` にしない |
| [`tests/unit/test_detailed_design_plan_export.py`](../samples/backend/tests/unit/test_detailed_design_plan_export.py) | 更新 | 段階7が未承認なら 409 |
| [`src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | `downloadImplementationProcedure` の URL とファイル名 |
| [`src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 更新 | `unapprovedStages`、押せない(`aria-disabled`・透過)と案内、2つのダウンロード、失敗 |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 2つのボタン名と案内 |
| [`e2e/detailed-design-flow.spec.ts`](../samples/frontend/e2e/detailed-design-flow.spec.ts) | 更新 | 実装手順書のボタンが押せない、詳細設計書・実装計画のボタン名、zip の中身から手順書を外す(流すのは Phase 32) |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```python
# app/services/detailed_design_export_service.py
DOCUMENT_STAGES = (1, 2, 3, 4, 5, 6, 7)      # 詳細設計書(01〜07章)と実装計画
PROCEDURE_STAGES = (PROCEDURE_DOC_STAGE,)    # 実装手順書

def missing_approvals(states, stages) -> list[int]:   # 承認済み(古くない)でない段階

async def bundle(self, project):             # detailed_design.zip
    await self._ensure_approved(project, DOCUMENT_STAGES)   # 図を描く前に判定(exported も変えない)
    ...
async def bundle_procedure(self, project):   # implementation_procedure.zip(直下に index.md など)
    await self._ensure_approved(project, PROCEDURE_STAGES)
    collected = await self.collect(project, render=False)
```

```tsx
// src/features/detailed-design/components/DesignDocumentBar.tsx
export const DOWNLOADS = [
  { label: "詳細設計書・実装計画をダウンロード(.zip)", stages: [1, ..., 7], download: downloadDetailedDesign },
  { label: "実装手順書をダウンロード(.zip)", stages: [8], download: downloadImplementationProcedure },
];
<Button disabled={!ready || busy !== null} opacity={ready ? 1 : 0.5}>  // + 「段階N・Mが未承認です。…」
```

## 設計判断

### 条件は「元になる段階がすべて承認済み」

詳細設計書は 01〜07章(07章は段階7)、実装計画は段階7から作るので、1つ目の zip は段階1〜7がすべて承認済み(古くない)のとき。実装手順書は段階8。どれかを承認し直して後ろの段階が「古い」になれば、またボタンが押せなくなる。

### サーバーも断る(ユーザー回答)

画面のボタンだけで止めると、API を直接呼べば未承認の文書が出る。同じ条件をサーバーにも置き、409 `DESIGN_DOCUMENT_NOT_READY` で断る。詳細設計書の zip は、断るときに図を描かず、図を `exported` にもしない(判定を `collect` の前に置いた)。

### 組み立ての「未承認」の書き方は残す

`document/` の章の「未承認」と、`procedure_output/` の「未承認」だけの index・HTML は消さない。段階7の下書きの入力(`collect(render=False)` の詳細設計書の md)は、段階7がまだ承認されていない状態で作るので、07章が「未承認」の md を使う。手順書の組み立ての「未承認」の分岐は、zip の側で断るようになったため、組み立ての側の守りとして残した。

### 手順書の zip は図を描かない

手順書の図(シーケンス図)は手順から導いて md・HTML の中に入るので、詳細設計書の図のファイル(`diagrams/`)は要らない。`collect(render=False)` を使い、図の状態も変えない。ファイルは zip の直下に置く(zip の名前が `implementation_procedure.zip` なので、同じ名前のフォルダを重ねない)。

### 押せないことを見た目で示す

Tamagui の `Button` の `disabled` は押せなくするだけで、見た目はほとんど変わらない。段階のステッパーが開いていない段階を透過で示しているのと同じ考え方で、`opacity` 0.5 にし、横に未承認の段階を出す(「段階5・6・7が未承認です。承認するとダウンロードできます。」)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `missing_approvals` | pytest(`test_detailed_design_export.py`) | スタブ不要 ── 段階の状態の辞書だけから決まる純粋関数のため | 古い・レビュー中・無い段階を返す |
| `bundle`・`bundle_procedure`・ルート | pytest(`test_detailed_design_export.py`・`test_detailed_design_plan_export.py`) | スタブ不要 ── DB はインメモリ SQLite(fixture)で、組み立ては純粋関数のため | 第一テスト: 段階8が承認済みなら手順書の zip(直下に4ファイル)。段階8が未着手・保存済みでも未承認なら 409。段階1〜7のどれかが未承認なら 409 で、図を `exported` にしない |
| `downloadImplementationProcedure` | vitest | スタブ: fetch(サーバーの代わり) | URL が `/design-stages/procedure-document`、ファイル名 |
| `DesignDocumentBar`・`unapprovedStages` | vitest + Testing Library | スタブ: fetch・`saveFile`(ブラウザの保存の代わり) | 承認されるまで押せない(`aria-disabled`、透過 0.5)と未承認の段階の案内。段階1〜7が承認済みなら1つ目だけ押せる。それぞれの zip を保存させる。失敗の理由を出す |
