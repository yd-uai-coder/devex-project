# Phase-57-4: dev の DB での確認・docs

## この章の目的

[57-1](./Phase-57-1.md) の zip への同梱と `GET /test-spec` の `design_gaps` を、dev の DB にある Phase 56 の確認用のプロジェクトで確かめる。続けて docs に画面と zip を書く。画面の操作の確認はユーザーが Phase 58・59 でまとめて行う(#37 の運用注記)。

自動実装モード: on([introduction](./Phase-57-introduction.md) 参照)。

## この章で作成・更新したファイル

実装のファイルは無い(確認と docs だけ)。#13・#15 の全ファイル解説・全ファイル import の対象外。

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`docs/external_design.md`](../../docs/external_design.md) | 更新 | 画面一覧の SCR-005・SCR-008、2.11節のテスト仕様書に「画面」「zip」 |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 更新 | 詳細設計書の zip の API に `test_spec.md`、3.3節「8.」に `test_spec_state` |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 更新 | Phase 57 を完了に |

## 1. dev の DB(LLM なし)

使い捨てのスクリプトを backend のコンテナで流した。zip の組み立ては図を `exported` にして commit するので、確かめるときは commit を止め、最後に rollback した(dev の DB は変えていない)。

| プロジェクト | モード | テスト仕様書 | 件数(結合・総合) | 設計に無い | 検証の指摘 | 詳細設計書の zip |
|---|---|---|---|---|---|---|
| `33fdda56` | 簡易 | v1・古くない | 15・4 | 2 | 0 | (簡易なので無い) |
| `86a37228` | 詳細 | v1・古くない | 28・10 | 9 | 0 | `test_spec.md` が入る |
| `06f93618` | 詳細 | 無い | ― | ― | ― | 入らない(4ファイルだけ) |

「古い」ときに入らないことは、単体テスト([57-1](./Phase-57-1.md))で確かめた。実 Gemini は呼んでいない(作り直しの確認は画面の確認と一緒に行う)。Anthropic も呼んでいない(費用 $0)。

## 2. docs

- 外部設計書 2.11節「テスト仕様書」に、画面(置き場はモードで分ける・パネルの中身・段階7 のダイアログ・進み具合)と zip(古くない版だけ・HTML は入れない・バーの注記)を足した。画面一覧の SCR-005・SCR-008 にも1文ずつ足した。
- 内部設計書の `GET /design-stages/document` の行と、3.3節「8.」に `test_spec_state`(循環を避けた理由)を足した。

## テスト観点

実装のファイルが無いので、この章のテストは無い(使い捨てのスクリプトで確かめた)。
