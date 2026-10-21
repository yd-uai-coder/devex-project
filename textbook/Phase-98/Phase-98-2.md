# Phase-98-2: CR の画面の手直し

## この章の目的

Phase 95・96 で devex-api に足した CR の項目を、CR の画面(SCR-010)に出す。新しい要件を足す CR の予測の起点を作成・編集で選べるようにし、内容・影響のタブに起点を出す。検証のタブには CR で作り直した後にまだ承認していない段階を、たどる記録のタブには下書きの直しの項目と段階の承認で結んだ印の数を出す(Phase 95・96 の申し送り)。devex-ui の CR の型はこれらの項目を持っておらず、フォームの「新しい要件を足す」には「影響の予測には入りません」と古い文が残っていた。

自動実装モード: on([introduction](./Phase-98-introduction.md) 参照)。

## この章で作成・更新したファイル

devex-api はたどる記録の1項目だけ、残りは devex-ui。すべて更新。

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | `TraceEntry.mark_count`(段階の承認の行の `refs.mark_count`) |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | `TraceEntryRead.mark_count` |
| [`frontend/src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | `origins`・`origin_keys`・`pending_stages`・`edited_fields`・`mark_count`・`approve_stage` |
| [`frontend/src/features/baselines/api/types.ts`](../samples/frontend/src/features/baselines/api/types.ts) | `OriginKind`・`BaselineOriginRead` |
| [`frontend/src/features/baselines/api/baselinesApi.ts`](../samples/frontend/src/features/baselines/api/baselinesApi.ts) | `listBaselineOrigins` |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | フォームの `origins`・`ORIGIN_KIND_LABEL`・`addOrigin`・`removeOrigin`・`originLabel` |
| [`frontend/src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 束ごとの起点の候補 `origins` と `fetchOrigins` |
| [`frontend/src/features/change-requests/components/ChangeRequestForm.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestForm.tsx) | 起点の欄 |
| [`frontend/src/features/change-requests/components/ChangeRequestCreateContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestCreateContent.tsx) | 起点の候補を読んで渡す |
| [`frontend/src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 起点を出す。直すときに候補を読む |
| [`frontend/src/features/change-requests/components/ImpactTab.tsx`](../samples/frontend/src/features/change-requests/components/ImpactTab.tsx) | 予測の起点と「届いた起点」の列 |
| [`frontend/src/features/change-requests/components/VerificationTab.tsx`](../samples/frontend/src/features/change-requests/components/VerificationTab.tsx) | 未承認の段階の節 |
| [`frontend/src/features/change-requests/components/TraceTab.tsx`](../samples/frontend/src/features/change-requests/components/TraceTab.tsx) | 直した項目・結んだ印の数 |
| [`backend/tests/unit/test_change_request_trace.py`](../samples/backend/tests/unit/test_change_request_trace.py) | 段階の承認の行の印の数 |
| [`frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 新しい項目の既定値 |
| [`frontend/src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | `origins`・`fetchOrigins` の初期化 |
| [`frontend/src/features/baselines/api/__tests__/baselinesApi.test.ts`](../samples/frontend/src/features/baselines/api/__tests__/baselinesApi.test.ts) | 起点の候補の URL |
| [`frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts`](../samples/frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts) | 作成・更新の本文に `origins` |
| [`frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 起点の足し外し・送る本文 |
| [`frontend/src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 起点の候補を束ごとに1回 |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx) | 起点の欄 |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestCreateContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestCreateContent.test.tsx) | 起点の候補を読む |
| [`frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 起点の表示と候補の読み込み |
| [`frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx) | 起点と届いた起点 |
| [`frontend/src/features/change-requests/components/__tests__/VerificationTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/VerificationTab.test.tsx) | 未承認の段階 |
| [`frontend/src/features/change-requests/components/__tests__/TraceTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/TraceTab.test.tsx) | 直した項目・結んだ印の数 |

## 1. 予測の起点を選ぶ(作成・編集)

```
☑ 新しい要件を足す(ID の無い要件。起点を選ぶと、起点から影響を予測します)
    新しい要件が関わりそうな既存の要件・画面・API を選んでください(任意)。…
    画面: SCR-004 チャットヒアリング画面   [外す]
    [起点を選ぶ ▼ 要件: FR-001 … / 画面: … / API: …]  [起点に足す]
```

- 起点の欄は「新しい要件を足す」に印を付けたときだけ出す(起点は新しい要件を足す CR だけが持てる。Phase 96)。候補は基準の束の要件・画面・API(`GET .../baselines/{n}/origins`)。対象の要件と同じく、選択で足して外す形にした。選んだ起点は候補から消える。
- 候補は CR のストアに束ごとに1回だけ読む(`fetchOrigins`。束の要件の `fetchRequirements` と同じ形。束は凍結されているので読み直さない)。作成のページは開いたときに、内容のタブは「内容を直す」を押したときに読む。
- 印を外したら、選んでいた起点は送らない(`toUpdateBody` が `origins: []` にする)。devex-api は、新しい要件を足さない CR の起点を 422 で断るためである。フォームの中では選んだ起点を覚えたままにする(印を付け直すと戻る)。

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export function toUpdateBody(form: ChangeRequestForm): ChangeRequestUpdate {
  return {
    // …
    adds_requirement: form.adds_requirement,
    origins: form.adds_requirement ? form.origins : [],
  };
}
```

## 2. 内容・影響のタブ

- 内容: 新しい要件を足す CR は「予測の起点: …」(表示名)を出す。起点が無ければ「予測の起点を選んでいないので、新しい要件の分は影響の予測に入りません」。
- 影響: 予測に使った起点(`impact.origins`)を出し、起点がある予測では段階ごとの表に「届いた起点」の列(`origin_keys` を表示名にしたもの)を足す。起点の無い新しい要件は「予測の起点を選んでいないので予測に入っていません(「内容」タブで起点を選べます)」。

## 3. 検証のタブの未承認の段階

- `pending_stages`(CR で作り直した後にまだ承認していない段階。Phase 96)があれば、「作り直した後に未承認の段階」の節を印の表の前に置き、段階ごとに詳細設計画面の段階へのリンク(`designStageHref`)を出す。承認すると承認で付く印が CR に結ばれ、すべて承認するまで検証済みにできない(`can_verify` は devex-api が決める)。

## 4. たどる記録のタブ

- 「直した」の行に「直した項目: タイトル・対象」(`edited_fields`。Phase 95)。
- 「段階の承認で印を結んだ」の行(`approve_stage`。Phase 96)に、段階の版(既存の `stage`)と「結んだ印 n件」。印の数はイベントの `refs.mark_count` にあったが応答に出ていなかったので、devex-api のたどる記録の行に `mark_count` を足した(段階の承認の行だけ。数でないものと、ほかの行は null)。Phase 99 の効果測定で数える値でもある。

```python
# app/change_requests/trace.py(抜粋)
        mark_count=_mark_count(refs) if event.action == "approve_stage" else None,
```

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_trace.py`(更新) | `trace_entries` の `mark_count`・`TraceEntryRead.from_entry` | pytest のテスト関数 | スタブ不要 ── 純粋関数とスキーマの写しで、外部依存を呼ばないため |
| `changeRequestOps.test.ts`(更新) | `addOrigin`・`removeOrigin`・`originLabel`・`formFromChangeRequest`・`toUpdateBody` | vitest のテスト関数 | スタブ不要 ── 純粋関数 |
| `baselinesApi.test.ts`・`changeRequestsApi.test.ts`(更新) | `listBaselineOrigins`、作成・更新の本文 | vitest のテスト関数 | fetch(`stubFetch`) |
| `change-requests-store.test.ts`(更新) | `fetchOrigins` | vitest のテスト関数 | fetch(`stubFetch`)── 束ごとに1回だけ読むことを確かめる |
| 部品のテスト(更新6本) | `ChangeRequestForm`・`ChangeRequestCreateContent`・`ContentTab`・`ImpactTab`・`VerificationTab`・`TraceTab`(応答は `changeRequestFixtures.ts`、ストアの初期化は `renderWithStore.tsx`) | render・userEvent | ストアの関数(`vi.fn`)── 部品の配線と出し分けだけを見るため |

- 統合スモーク: 作成のページを開くと、束の要件と起点の候補を読む。
- フォーム: 印を付けたときだけ起点の欄が出る。選んで足すと送る本文に `origins` が入り、選んだ起点は候補から消える。外すと候補に戻る。印を外すと起点は送らない。
- 内容のタブ: 起点の表示名。直すときだけ候補を読む。起点の無い新しい要件は予測に入らない旨。
- 影響のタブ: 予測の起点と「届いた起点」の列。
- 検証のタブ: 未承認の段階を段階へのリンクで出す。無ければ節を出さない。
- たどる記録: 直した項目と、段階の版・結んだ印の数。devex-api では、形の悪い数とほかの操作の行は null。
