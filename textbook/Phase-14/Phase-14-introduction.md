# Phase 14 導入: ステージ4(詳細設計モード)着手 ── 要件定義フェーズ

## 目的

Phase 13 の完了後、コンポーネント図の粒度が粗い(`api-service-model` 程度)という指摘から、「詳細設計モード」の構想が出た([`appendix/detailed-design-mode-organization.md`](../../appendix/detailed-design-mode-organization.md))。Phase 14 は、その構想を**ステージ4**として切り出し、実装に入る前の要件定義フェーズとして次を行う。

- 構想メモ8章の未決事項1〜9の仕様診断(#28)と決定([14-1](./Phase-14-1.md))
- 05章(主要処理の手順)・06章(処理ロジックの詳細)の見せ方と、詳細設計書の出力形式の確定([14-2](./Phase-14-2.md)。devex-ui のデモページで確かめた)
- 決定事項の `docs/*.md` への反映と、ステージ3の終了(Phase 13b・旧 Phase 14 の撤回)の記録([14-3](./Phase-14-3.md))
- ステージ4の実装計画(Phase 一覧と、Phase ごとの成果物・依存関係)のまとめ([14-4](./Phase-14-4.md))
- 出力見本を見た後の決定: モードを作成時に選ぶこと(「概要モード」を「簡易ドキュメントモード」に改称)、段階の進め方、気づき10件の対応方針([14-5](./Phase-14-5.md))

本体機能(段階の土台・各段階の生成・詳細設計書の組み立て)の実装は Phase 15 以降で行う。

## パイプライン上の位置づけ・前提

- **ステージ3は Phase 13 で終了した**。Phase 13b(M9b: 図の手直しを散文へ戻す AI 修正案)と旧 Phase 14(アクティビティ図・統合/E2E/デプロイ確認)は未達のまま撤回した。「Phase 14」の番号は、ステージ4の要件定義フェーズに充てる(ユーザー指示)。撤回の記録は [`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節ほか([14-3](./Phase-14-3.md))。
- 前提として読むもの:
  - [`appendix/detailed-design-mode-organization.md`](../../appendix/detailed-design-mode-organization.md)(構想・実務の資料・段階表・未決事項)
  - [`textbook/q_a.md`](../q_a.md)「Phase 13完了後 ── コンポーネント図の粒度から、詳細設計モードの構想へ」
  - 見本ページ(仮データ「備品予約システム」): <https://claude.ai/artifact/WjWw4WtGwjQSzzj26pm9fH>
- ユーザーが示した前提(構想メモ3章): 実務にできるだけ準拠する。自動コーディングの水準は理想形であり、要件ではない。シーケンス図に当たるものは、まず番号付きの手順から始める。
- ステージ3の資産(意味モデル・検証・レイアウトエンジン・draw.io/SVG 出力・レビュー画面・承認の流れ・データ辞書・陳腐化の判定)は、ステージ4で再利用する。

## 本 Phase の進行上の扱い

- [14-2](./Phase-14-2.md) のデモページは、`/uml-demo` と同じ開発用のページとして devex-ui 本体へ直接作った(ユーザー指示)。`textbook/samples/` には置かない。
- Phase 15 以降のコードは、ステージ3と同じく Claude が本体へ直接反映し、samples も並行して作る([14-5](./Phase-14-5.md) 決定3)。

## モード宣言(#21)

全章**学習モード**とする。ステージ4の最初の設計判断であり、定型の作業が過半とは言えないため。

## 章一覧

| 章 | トピック | ファイル作成 | モード | 依存 |
|---|---|---|---|---|
| [`Phase-14-1.md`](./Phase-14-1.md) | 仕様診断(#28)と決定: ステージの切り方・13b と旧 Phase 14 の撤回・段階の状態・機能グループ・CRUD・手順の列・簡易ドキュメントモードへの波及 | なし(設計討議) | 学習 | なし |
| [`Phase-14-2.md`](./Phase-14-2.md) | 05・06章の見せ方(未決事項8・9)と出力形式(HTML+md の zip)。デモページ `/detailed-design-demo` | あり(devex-ui 本体。samples 対象外) | 学習 | 14-1 |
| [`Phase-14-3.md`](./Phase-14-3.md) | `docs/*.md` への反映・ステージ3の撤回の記録 | `docs/` 配下4ファイル(文書のため #13/#15/#30 の対象外) | 学習 | 14-1, 14-2 |
| [`Phase-14-4.md`](./Phase-14-4.md) | ステージ4の実装計画(Phase 14〜20 の一覧・成果物・再利用する資産・依存関係・未確定事項) | なし(計画の文書) | 学習 | 14-1〜14-3 |
| [`Phase-14-5.md`](./Phase-14-5.md) | モード選択(簡易ドキュメント/詳細設計)・段階の進め方・出力見本の気づき10件の対応方針 | `docs/` 配下4ファイル(文書のため #13/#15/#30 の対象外) | 学習 | 14-1〜14-4 |

## サンプルコード一覧

`textbook/samples/` への追加は無い。[14-2](./Phase-14-2.md) のデモページは devex-ui 本体にだけ置いた(写経の対象外)。

- `devex-ui/src/features/detailed-design/demo/procedureModel.ts`(05・06章の意味モデルの型と、索引・関与表・逆引き表・md・HTML を組み立てる純粋関数)
- `devex-ui/src/features/detailed-design/demo/demoData.ts`(仮データ)
- `devex-ui/src/features/detailed-design/demo/DetailedDesignDemoPageContent.tsx`(デモ画面)
- `devex-ui/src/app/(pages)/detailed-design-demo/page.tsx`(ルート)、`devex-ui/src/lib/menu-tree.ts`(メニューへの追加)
- 上記の `__tests__/` 配下のテスト

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [14-1](./Phase-14-1.md) | なし | 未決事項1〜7と Phase 番号の決定 | なし(設計討議) |
| [14-2](./Phase-14-2.md) | `procedureModel.ts`・`demoData.ts`・`DetailedDesignDemoPageContent.tsx`・`page.tsx`・`menu-tree.ts` | 05・06章の見せ方と出力形式の見本 | `npx vitest run src/features/detailed-design "src/app/(pages)/detailed-design-demo" src/components/layout`、`npx tsc --noEmit`、`npm run build` |
| [14-3](./Phase-14-3.md) | `docs/requirements.md`・`docs/external_design.md`・`docs/internal_design.md`・`docs/implementation_plan.md` | 決定事項の反映と撤回の記録 | なし(文書の目視レビュー) |
| [14-4](./Phase-14-4.md) | なし | ステージ4の Phase の区切りと概要 | なし(文書の目視レビュー) |
| [14-5](./Phase-14-5.md) | `docs/*.md`(更新) | モード選択・段階の進め方・気づきの対応方針の記録 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順([14-1](./Phase-14-1.md) → [14-2](./Phase-14-2.md) → [14-3](./Phase-14-3.md) → [14-4](./Phase-14-4.md) → [14-5](./Phase-14-5.md))。写経の対象になるファイルは無い([14-2](./Phase-14-2.md) は本体に直接作成済み)。

## 検証結果

- devex-ui: デモのテスト 24 件成功、`tsc --noEmit`・eslint・`npm run build` 成功。
- ダウンロードした HTML は、jsdom でスクリプトを動かし、アンカーへ移るとタブが切り替わって行が強調されること、エラーが出ないことを確かめた。
- ユーザーがブラウザでデモページを操作し、バッジの動きとダウンロードしたファイル(HTML・md)を確認した。

## 後続 Phase への申し送り

- **コードの反映先(確定)**: 本体へ直接+samples([14-5](./Phase-14-5.md))。
- **Phase 15 で行うこと**: モード選択ダイアログと `projects.mode`、モードごとの生成、`design_stages` のカラムの詳細、段階を進める画面(SCR-008)の骨格、簡易ドキュメントモードの内部設計書へのモジュール一覧表、出力見本の気づき#1〜#10の修正(#10 は自動レイアウトのアルゴリズムの検討)。対応方針は [14-5](./Phase-14-5.md) を参照。
- **ロードマップ(Phase 15〜20)は暫定**である([`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節ステージ4)。Phase ごとの成果物・依存関係・未確定事項は [14-4](./Phase-14-4.md) にまとめた。各 Phase の着手時に見直す。
- **05・06章の本実装**: 出力(HTML・md)の組み立てはバックエンドへ移す。デモの `procedureModel.ts` の関数(`buildReverseIndex`・`buildInvolvement`・`findDanglingLogicRefs`・`toMarkdown`・`toHtml`)が仕様の見本になる。レビュー画面はデモの見せ方を採用する。
- **出力見本(Devex 自身が題材)**: [`appendix/detailed-design-devex/`](../../appendix/detailed-design-devex/README.md) に、詳細設計書の見本(HTML・md・図)を作った。書式と Devex の処理ロジックを確かめる材料。付録の「気づき」10件(`template_id` が保存されない、文書生成の失敗時に rollback しない、自動レイアウトの所要時間など)は、Phase 15 以降の着手時にどう扱うかを決める。
- **シーケンス図**: 当面は作らない。ステージ4の運用の後に、05の番号付き手順で足りるかを判断する。
- **ステージ3から持ち越す未検証事項**: 統合/E2E とデプロイでの確認(旧 Phase 14 の一部)は、ステージ4の実装(Phase 20)と合わせて行う。[`Phase-13-introduction.md`](../Phase-13/Phase-13-introduction.md)「検証していないこと」も参照。
- **decision digest**: Phase 13・14 の要点の追記は、#24 に従い別セッションで行う。

## 後続 Phase での改訂

- [`Phase-15-2.md`](../Phase-15/Phase-15-2.md): `design_stages.stage`の範囲を、docs ⑩ の「1〜6」から1〜7に改めた(段階7 実装計画も同じ承認の流れに乗せるため)。保存する状態は`draft`/`reviewing`/`approved`の3つで、「未着手」「古い」は導く値にした。
- [`Phase-16-introduction.md`](../Phase-16/Phase-16-introduction.md): Phase 16 を段階1だけにし、段階2以降の Phase の番号を1つずつ送った(ステージ4は Phase 14〜21)。[`Phase-14-4.md`](./Phase-14-4.md) の Phase 表を更新した。あわせて、決定#6「簡易ドキュメントモードはモジュール一覧以外を変えない」を改め、外部設計書の「2.6 API一覧」を両方のモードで出すことにした([`Phase-16-1.md`](../Phase-16/Phase-16-1.md))。

## Phase 完了チェック(#22)

1. 詳細設計モードで文書を「承認済みの意味モデルから組み立てる」ことにすると、なぜ M9b(図の手直しを散文へ戻す AI 修正案)がほぼ不要になるのか説明できるか。
2. 05と06の紐づけの正本を「手順の行が持つ L-ID」の1か所にした理由と、そこから導く表(索引の詳細欄・関与表・逆引き表・06の「呼ばれる手順」)を挙げられるか。
3. md のリンクが md ビューワーで飛ばなかった原因を、生の HTML のアンカーと見出しの自動アンカーの2点から説明できるか。そのうえで、HTML と md の役割をどう分けたか説明できるか。
4. CRUD図のうち、DFD の線の向きから決定的に決まる部分と、人が確定する部分を分けて説明できるか。
5. 前の段階を承認し直したとき、後ろの段階を自動で作り直さず陳腐化の表示にとどめる理由を説明できるか。

## 次のフェーズ

**Phase 15**: モードと段階の土台(`projects.mode`・`design_stages`・段階の承認と陳腐化・SCR-008 の骨格)と、簡易ドキュメントモードの内部設計書へのモジュール一覧表の追加。
