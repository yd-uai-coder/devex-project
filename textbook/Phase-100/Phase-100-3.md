# Phase-100-3: `docs/*.md`・README・位置付けへの反映

## この章の目的

[100-1](./Phase-100-1.md) の決定と [100-4](./Phase-100-4.md) の計画を、仕様の文書(`docs/*.md`)・README・[位置付け](../../appendix/devex_project_positioning.md)に写す(#28 の「決定が出揃ったら docs に反映」)。

自動実装モード: on([introduction](./Phase-100-introduction.md) 参照)。文書だけで、本体と samples は変えない(#13・#15・#30 の対象外)。

## この章で作成・更新したファイル

| ファイル | 反映したこと |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | Could に「説明とすり合わせ(ステージ13)」の項目(規模と数えられない理由・案・説明書の直し・共有リンク・あわせて扱うもの) |
| [`docs/external_design.md`](../../docs/external_design.md) | 画面の一覧に SCR-012(共有リンク)。2.14 の「ステージ13 で扱う」から 2.16節へのリンク。2.16節「説明とすり合わせ」を新設(モード・規模・選択肢・説明書の直し・共有リンク・あわせて扱うもの・ステージ13 の後に回すもの) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.3節に「13. 説明とすり合わせ」(Phase 100 で決まった構造だけ。形は各 Phase で決める) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1 にステージ13(目的・方針・Phase 100〜110・マイルストーン14) |
| [`appendix/devex_project_positioning.md`](../../appendix/devex_project_positioning.md) | 12章のステージ13 の行(中身に足したもの・クライアント役の規則・Phase の目安 約9 → 11) |
| [`README.md`](../../README.md) | ステージ12 の完了と、ステージ13 の着手の1文 |

## 判断

- **SCR-012 の URL の形は決めない**: 公開の入口のパスは、トークンの形と一緒に Phase 103・108 で決める。2.16節には「開発者が作ったリンクから開く」とだけ書いた。
- **マイルストーン14 の文**: 位置付けの判断基準(案)に、決定4の測り方(説明書の外への質問なし・題材のすべての CR)を足した。
- **2.14 の既存の文は書き換えない**: 「規模の集計と選択肢つきの説明は、ステージ13 で扱う」は、2.16節へのリンクを足すだけにした(ステージ11 の決定の記録のため)。
