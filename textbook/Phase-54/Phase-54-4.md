# Phase-54-4: 聞き直し(再ヒアリング)

## この章の目的

採用したヒアリングの指摘(利用者に聞き直さないと決められないもの)で、その観点を未決に戻し、指摘をまとめた問いかけをチャットに出す。最初の問いかけはコードが組み立てる(LLM を呼ばない)。以後の往復は今のヒアリング(未決の観点を聞く)がそのまま続ける。あわせて、Phase 52 からの申し送り「公開サービスでセキュリティが浅いまま採用される」(D-NAT-1)に、判定のプロンプトで手当てする。

自動実装モード: on([introduction](./Phase-54-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/`・`devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 更新 | `PointState.reopened_after`・`merge_judgement(after_reopen=)` |
| [`app/models/hearing_point.py`](../samples/backend/app/models/hearing_point.py) | 更新 | `reopened_after` の列 |
| [`alembic/versions/6b2d8fa4e3c5_add_reopened_after_to_hearing_points.py`](../samples/backend/alembic/versions/6b2d8fa4e3c5_add_reopened_after_to_hearing_points.py) | 新規 | 上の列 |
| [`app/repositories/hearing_point.py`](../samples/backend/app/repositories/hearing_point.py) | 更新 | 印の保存・読み出し |
| [`app/review/sendback.py`](../samples/backend/app/review/sendback.py) | 更新 | `SendbackFinding.point_key` |
| [`app/review/rehearing.py`](../samples/backend/app/review/rehearing.py) | 新規 | `can_rehear`・`rehearing_points`・`rehearing_message` |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | 上の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `RehearingFindingInvalidError`(409) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | `reopen_points`・判定で聞き直しの後の発言を数える・判定のプロンプトに1規則 |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `rehearing` |
| [`app/schemas/review.py`](../samples/backend/app/schemas/review.py) | 更新 | `RehearingRequest` |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | `POST /reviews/rehearing` |
| [`src/features/design-review/api/reviewApi.ts`](../samples/frontend/src/features/design-review/api/reviewApi.ts) | 更新 | `requestRehearing` |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 更新 | `rehearableFindings` |
| [`src/features/design-review/review-store.ts`](../samples/frontend/src/features/design-review/review-store.ts) | 更新 | `rehear`・`rehearing` |
| [`src/features/design-review/components/RehearingButton.tsx`](../samples/frontend/src/features/design-review/components/RehearingButton.tsx) | 新規 | 「チャットで聞き直す(n件)」→ チャットへ移る |
| [`src/features/design-review/components/ReviewPanel.tsx`](../samples/frontend/src/features/design-review/components/ReviewPanel.tsx) | 更新 | 区切りごとに上のボタンを置く |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_rehearing.py`](../samples/backend/tests/unit/test_review_rehearing.py) | 新規 | 問いかけ・未決に戻す・判定の規則・ルート |
| `model.test.ts`・`review-store.test.ts`・`ReviewPanel.test.tsx` | 更新 | 分け方・送る本文・移る先 |

## 要点の抜粋

### 1. 最初の問いかけ(コードが組み立てる)

```
AI 設計レビューで、ヒアリングで決めきれていない点が見つかりました。次の観点について、もう一度確認させてください。
・「セキュリティ」
  - (指摘の問題)
    改善案: (指摘の改善案)
  例えば: 入れたデータを、誰に見られたら困りますか。ログインはどうしますか
答えていただいた内容で、観点の表を更新します。決まったら、設計書を再生成してください。
```

観点は観点の表の順。「例えば」は観点の定義の問いの例(`point_def(key).question`)。AI の発言としてチャットに残す。

### 2. 未決に戻した観点が、前の答えで決まり直さないように

判定の LLM は全観点を毎回判定し直すので、未決に戻しても、前の答え(例:「ログインして使う」)を根拠にすぐ決定に戻りうる。未決に戻すとき、聞き直しの発言の id を `reopened_after` に記録し、`merge_judgement` は**その発言より後の利用者の発言**が根拠にあるときだけ決定・採用・対象外にする(未決のままなら印を引き継ぎ、決まったら印は外れる)。発言の前後は履歴の順で数える(`_messages_after_reopen`)。

### 3. 判定のプロンプトの1規則(D-NAT-1)

「規模が public のとき、security は、誰がどのデータを見られる・変えられるか(アクセス制御)が分かるまで decided・adopted にしない(ログインの方法だけでは open のままにする)」を足した。効果は Phase 58 の測定で見る。

### 4. 流れ

`POST /projects/{id}/reviews/rehearing {finding_ids}` → 指摘を確かめる(無い指摘は404、聞き直しに使えない指摘・空は409 `REHEARING_FINDING_INVALID`)→ `ChatService.reopen_points`: 生成中は409、問いかけを保存、観点を open に、完成したプロジェクトは「修正中」、完了判定を表から作り直す(必須が未決になれば生成のボタンは出ない)→ 画面はチャットへ移る。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `can_rehear`・`rehearing_points`・`rehearing_message`・`merge_judgement` | pytest(`test_review_rehearing.py`) | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | 使える指摘・観点の順・文の形・聞き直しより前の根拠は取り込まない・印の引き継ぎと外れ |
| `ReviewService.rehearing`・`ChatService.reopen_points`・`judge_points`・`request_rehearing` | 同上 | `FakeLLM`(判定の構造化出力) | 未決・印・AI の発言・修正中・完了判定・409/404・前の発言だけでは決まらず、後の答えで決まる |
| ストア・パネル | vitest | 偽の fetch・ストアの `rehear`(`vi.fn`)・`next/navigation` の `useRouter` | 本文・失敗の文・ヒアリングの採用だけ・チャットへ移る |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_rehearing.py
cd devex-ui && npx vitest run src/features/design-review
```
