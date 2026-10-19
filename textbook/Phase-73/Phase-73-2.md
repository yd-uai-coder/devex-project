# Phase-73-2: `docs/*.md`・README・ロードマップへの反映

## この章の目的

[73-1](./Phase-73-1.md) の決定を仕様書(`docs/*.md`)に書き、README とロードマップのステージの状態を改める。#28 の「全項目の決定が出揃ったら該当する `docs/*.md` に反映する」にあたる。

自動実装モード: on([introduction](./Phase-73-introduction.md) 参照)。

## この章で作成・更新したファイル

文書だけである(#13/#15/#30 の対象外)。

| ファイル | 変えたところ |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4節の Could に「Google 認証(ステージ10)」を足した。決定の要点(ID トークン・パスワードで確かめてから紐付け・パスワードの設定・メールが確認されていなければ断る)と、ステージ9 の申し送り・本番への反映を書いた |
| [`docs/external_design.md`](../../docs/external_design.md) | 画面一覧の SCR-001・SCR-009 に Google の機能を足した。2.4節に「Google Identity Services」を足した(用途・認証方式・環境変数が無ければボタンを出さない)。**2.13節を新設**した(ログイン・登録のボタン・同じメールの連携の確かめのダイアログとその理由・断るとき・マイページの出し分け・Google 側のメールが変わったとき・変えないもの) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.2節の `users` の表で、`hashed_password` を NULL 可にし、`google_sub` を足した。ロールバックの注意も書いた。3.3節の API の一覧に `POST /auth/google`・`POST /auth/google/link`・`POST`/`DELETE /users/me/google` を足した。**3.3節 10項「Google 認証」を新設**した(フロー・検証・本人の見分け方・パスワード・`UserRead`・開発環境の上限)。3.4節のエラーのコードに `GOOGLE_LINK_REQUIRED` を足した |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ9 の達成範囲に、本番への反映をステージ10 とまとめたことを足した。**ステージ10 を新設**した(目的・方針・対象 Phase 73〜79・マイルストーン11) |
| [`README.md`](../../README.md) | ステージの表で、9 を「完了(本番への反映はステージ10と一緒)」、10 を「着手(Phase 73〜)」にした。実装計画書に書き写したことを足した |
| [`appendix/devex_roadmap.md`](../../appendix/concept-history.md#roadmap) | ステージ9 を【完了】、ステージ10 を【着手】にした(見出し・流れの図・優先順位の表)。ステージ10 の方針に、Phase 73 で決めたことを足した |
| [`appendix/stage9-10-plan.md`](../../appendix/concept-history.md#stage9-10) | 2.3節(未決事項)と 2.4節(ステージ9 の振り返りからの入力)に「Phase 73 で決定」の注記を足した |

## 書き方の判断

- **細部は書かない**: API の細かい応答(メールが確認されていないときのコード・パスワードが違うときのコードなど)は、[73-3](./Phase-73-3.md) の未確定事項に残した。docs には「Phase 74 で決める」と書いた。ステージ9 と同じく、実装の Phase で「Phase N で確定」の段を足していく。
- **パスワードの設定の API**: 形(`PUT /users/me/password` に寄せるか、別にするか)は Phase 75 の未確定事項である。そのため、API の一覧には連携・解除の行だけを足し、設定の形は「Phase 75 の着手時に決める」とした。
- **ロールバックの注意**: 3.2節に書いた(Google だけのユーザーがいると、downgrade で NOT NULL に戻せない)。手順は Phase 79 で `OPERATIONS.md` に書く。

## テスト観点

この章は実装ファイルを作らない(文書の反映)。#13・#14・#15 の対象外。[`link_check.py`](../tools/README.md) でリンク切れが無いことを確かめた(introduction の「検証結果」)。
