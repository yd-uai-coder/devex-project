# Phase-72-3: `docs/*.md` への反映

## この章の目的

ステージ9の完了と、Phase 72 で決めた本番の既定値・暗号の鍵の扱いを、仕様書に反映する。

自動実装モード: on([introduction](./Phase-72-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 更新 | 4.1節のステージ9: Phase 62〜72 を完了に、方針の「seed で既定値」を「`.env` が既定値(本番は行を入れない)」に直し、達成範囲を足す |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 更新 | 3.2節 ⑫ に「seed は dev 専用・本番は `.env` で補う」、3.3節「9.」のモデルと API キーに「Phase 72 で確定」(鍵の作り方・置き場・回し方・既定値の行) |
| [`docs/requirements.md`](../../docs/requirements.md) | 更新 | ステージ9の行の「seed で登録」を「システムの既定値とし」に直す |

文書なので #13/#15/#30 の対象外。README は、ステージ9を書き写した旨が Phase 61 で入っていて、変える所が無かった。

## 要点

- 決定の記録は [internal_design.md](../../docs/internal_design.md) の「Phase 72 で確定」の1行にまとめ、手順の本体は [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節を指す(手順を2か所に書かない)。
- 達成範囲は、ステージ8 と同じく「何ができるようになったか」と「E2E で何を通したか」「本番の手順の場所」を1段落にした。

## テスト観点

なし(文書の目視レビュー)。
