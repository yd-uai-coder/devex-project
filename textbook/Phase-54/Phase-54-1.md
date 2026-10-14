# Phase-54-1: 採用した指摘の追跡(L0 版・L1 行)と見せ方

## この章の目的

採用した指摘が、その後に直されたかを決定的に(LLM を呼ばずに)追う。指摘の関連文書・段階の版がレビューしたときから変わっていなければ「未対応」、版は変わったが対象の行が変わっていなければ「対象が変わっていない」、対象が変わった(または比べられない)なら「変更あり」。パネルの判断の列のチップ・見出しの「採用 n(未対応 m)」・各段階の表のバッジの強調・手順書の生成と段階6・7 の承認での知らせで見せる。再生成の後の自動のレビューで最新の回が替わっても、前の回で採用した指摘を見失わないようにする。

自動実装モード: on([introduction](./Phase-54-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/`・`devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/review/followup.py`](../samples/backend/app/review/followup.py) | 新規 | 追跡の純粋関数(`followup_state`・`version_keys`・`matches`・行の読み出し `document_model_rows`・`element_rows`) |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | 上の re-export |
| [`app/models/review.py`](../samples/backend/app/models/review.py) | 更新 | `review_runs.snapshots`(段階の区切りでレビューした段階の内容の写し) |
| [`alembic/versions/5a1c7e93d2b4_add_snapshots_to_review_runs.py`](../samples/backend/alembic/versions/5a1c7e93d2b4_add_snapshots_to_review_runs.py) | 新規 | 上の列 |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 更新 | `create_run(snapshots=)`・`list_with_adopted`(採用した指摘を持つ回) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `elements_since`(写しと今の段階の要素) |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | 写しの保存・`followups`・`followup_of`・`current_versions`・`row_diffs`・区切りの `adopted_before` |
| [`app/schemas/review.py`](../samples/backend/app/schemas/review.py) | 更新 | `ReviewFindingRead.followup`・`ReviewGateSummaryRead.adopted_before` |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | 指摘に追跡を付ける(一覧・採否の応答) |
| [`src/features/design-review/api/reviewApi.ts`](../samples/frontend/src/features/design-review/api/reviewApi.ts) | 更新 | `FollowupState`・`followup`・`adopted_before` |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 更新 | `FOLLOWUP_LABEL`・`adoptedFindings`・`followupCounts`・`unaddressedNotice`・`relatedDocuments`・`regenerationStartFor`・`joinNotices` |
| [`src/features/design-review/review-store.ts`](../samples/frontend/src/features/design-review/review-store.ts) | 更新 | 採否の応答で前の回の指摘も置き換える |
| [`src/features/design-review/components/FindingTable.tsx`](../samples/frontend/src/features/design-review/components/FindingTable.tsx) | 更新 | 判断の列のチップ(`FollowupChip`) |
| [`src/features/design-review/components/ReviewPanel.tsx`](../samples/frontend/src/features/design-review/components/ReviewPanel.tsx) | 更新 | 見出しの「採用 n(未対応 m)」・前の回で採用した指摘の表 |
| [`src/features/design-review/components/ReviewFindingBadge.tsx`](../samples/frontend/src/features/design-review/components/ReviewFindingBadge.tsx) | 更新 | 未対応の強調と数・ダイアログのチップ |
| [`src/features/detailed-design/reviewMarks.ts`](../samples/frontend/src/features/detailed-design/reviewMarks.ts) | 更新 | 前の回で採用した指摘もバッジにする |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 手順書の生成で未対応を知らせる |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 段階6・7 の承認のダイアログで未対応を知らせる |
| ── ここからテスト ── | | |
| [`src/features/design-review/test-utils/reviewFixtures.ts`](../samples/frontend/src/features/design-review/test-utils/reviewFixtures.ts) | 更新 | `followup`・`adopted_before` の既定値 |
| [`tests/unit/test_review_followup.py`](../samples/backend/tests/unit/test_review_followup.py) | 新規 | 純粋関数のテスト |
| [`tests/unit/test_review_service.py`](../samples/backend/tests/unit/test_review_service.py) | 更新 | 文書の版・段階の写しで追う |
| [`tests/unit/test_review_routes.py`](../samples/backend/tests/unit/test_review_routes.py) | 更新 | 採用すると追跡が付く |
| `model.test.ts`・`review-store.test.ts`・`ReviewPanel.test.tsx`・`ReviewFindingBadge.test.tsx`・`reviewMarks.test.ts`・`ProcedureDocPanel.test.tsx`・`DetailedDesignPageContent.test.tsx` | 更新 | 画面の見せ方 |

## 要点の抜粋

### 1. 状態の決め方(純粋関数)

```python
# app/review/followup.py
def followup_state(*, documents, targets, reviewed, current, diffs) -> FollowupState:
    changed_keys = [k for k in version_keys(documents, reviewed) if current.get(k) != reviewed[k]]
    if not changed_keys:
        return "unaddressed"          # L0: 関連文書・段階の版が変わっていない
    ...                                # L1: 版の変わったキーごとに、対象の行の前後を比べる
    return "target_unchanged" if found else "changed"
```

- **版のキー**: 指摘の関連文書(`documents`)を回の版のキーに読み替える。詳細設計書は段階1〜6(`stage:1`〜`stage:6` のうち回にあるもの)、実装計画書(詳細)は段階7。関連文書が無い古い指摘は、回の版のすべて。
- **今の版**: 文書は表示中の版、段階は**今の内容の版**(`design_stages.version`)。承認していない作り直しも「変わった」に数える。回の `targets` に入れた承認した版は、承認した時点の `version` なので、そのまま比べられる。
- **行**: 文書は `revision.py` の行(`要件 FR-001`・`API POST /x`・`テーブル users`…)、段階は `impact` の要素(`fn:F-01` など)。対象の文字と行は「行の ID が対象の文字の中に、前後を英数字・ハイフンで続けずに現れる」か「行の名前を含む / 行の名前に含まれる」で結ぶ(`FR-001` が `FR-0010` に当たらない)。対象を行に結べない・行を比べられない(実装計画書・レビューした版が直近3版の外)ときは「変更あり」(L2 に回す)。

### 2. 段階の写し(`review_runs.snapshots`)

段階は承認した写し(`approved_model`)を1つしか残さず、承認し直すと置き換わる。そこで、段階の区切りの回を作るときに、区切りの段階の写しを回に持たせる(`{"stage:N": approved_model}`。文書の区切りは null)。今の内容との差は、承認の変更の影響と同じ組み立て(ほかの段階・文書は今のもの)で要素にして比べる(`DesignStageService.elements_since`)。計画の段階では「DB の列は足さない」としていたが、L2(54-5)にも「レビューしたときの対象」が要るため列を足した(計画の承認で確定)。

### 3. 前の回で採用した指摘(`adopted_before`)

実装の途中で見つけた問題: 再生成の後は自動のレビューが流れて区切りの最新の回が替わり、前の回で採用した指摘がパネルから消える(追う意味が無くなる)。区切りの一覧に、最新の回より前の回で採用した指摘を新しい回から付けて返すようにした(`list_with_adopted`)。パネルは「前の回で採用した指摘 n件」の表で出し、外すときは保留・却下にする。各段階の表のバッジにも出す(今の版のレビューではないので、ダイアログでは「段階・文書が変わる前」と注記)。

### 4. 見せ方

| 置き場 | 見せ方 |
|---|---|
| パネルの判断の列 | 採否のボタンの下にチップ(未対応 赤・対象が変わっていない 橙・変更あり 灰) |
| パネルの区切りの見出し | 「採用 n(未対応 m)」(未対応があれば赤) |
| 各段階の表のバッジ | 未対応があれば太い赤枠と「・未対応 m」 |
| 手順書の生成 | 「採用したまま直していない指摘があります(段階7の承認の後 1件)。」を未レビューの知らせの前に(止めない) |
| 段階6・7 の承認のダイアログ | 同じ文を承認の文の後に(段落の中なので文だけ) |
| 再生成の起点の初期値 | 未対応の指摘の関連文書のうち最も上流(`regenerationStartFor`。54-2 で使う) |

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `followup_state`・`version_keys`・`matches`・`document_model_rows`・`element_rows` | pytest(`test_review_followup.py`) | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | 版が同じなら未対応・対象の行が同じなら対象が変わっていない・行の増減は変更あり・結べない / 比べられないは変更あり・詳細設計書は段階1〜6 |
| `ReviewService.followups`・`gate_summaries`・`elements_since` | pytest(`test_review_service.py`) | `FakeLLM`(生成・レビュー) | 採用した指摘だけ・作り直した後も前の回の指摘として残る・段階の区切りは写しを持ち、段階を直すと比べる |
| `decide_finding`・`list_review_gates` | pytest(`test_review_routes.py`) | `FakeLLM` | 採用すると `followup` が付き、未判断・保留は null |
| 意味モデル・パネル・バッジ・知らせ | vitest | ストアの操作(`vi.fn`)・偽の fetch(ストア) | 合わせ方・数・知らせの文・起点・チップと見出し・失敗した回でも前の回を出す・強調と数 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_followup.py tests/unit/test_review_service.py tests/unit/test_review_routes.py
cd devex-ui && npx vitest run src/features/design-review src/features/detailed-design
```
