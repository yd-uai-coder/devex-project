# Phase-0-4: ドキュメント構成の分割(README.md → docs/)

設計フェーズの章のため、[CLAUDE.md](../../CLAUDE.md)「進行のルール」#13(全ファイル解説)・#14(SUT/ドライバ/スタブ)・#15(全ファイルimport)・#12(リファクタ追従)は対象外(#2 冒頭の規定どおり)。ドキュメント構成の整理であり、要件・設計の内容そのものは変更していない。

## この章で作成・更新したファイル

- [`docs/requirements.md`](../../docs/requirements.md) — 新規。旧`README.md`1章(要件定義書、1.1〜1.6)を移設。
- [`docs/external_design.md`](../../docs/external_design.md) — 新規。旧`README.md`2章(外部設計書、2.1〜2.5)を移設。
- [`docs/internal_design.md`](../../docs/internal_design.md) — 新規。旧`README.md`3章(内部設計書、3.1〜3.4)を移設。
- [`docs/implementation_plan.md`](../../docs/implementation_plan.md) — 新規。旧`README.md`4章(実装計画書、4.1〜4.4)を移設。
- [`README.md`](../../README.md) — 概要(2〜3文)+4ドキュメントへのリンク表のみに縮小。
- [`CLAUDE.md`](../../CLAUDE.md)、[`decision-digest.md`](../decision-digest.md)、`Phase-0/Phase-0-introduction.md`・`Phase-0-1.md`・`Phase-0-2.md`・`Phase-0-3.md` — README.mdへの節番号参照を新しい`docs/*.md`パスに更新(#12の「参照リンクの張り替え等はこのルールの対象外」規定により、マーカーなしで上書き)。`q_a.md`は#8(保存専用・非参照)により当時の引用を含め変更していない。

## 決定内容の要点

### 背景

`README.md`に要件定義書・外部設計書・内部設計書・実装計画書が1ファイル(609行)に混在しており、画面表示で縦長になり読みたい箇所を探しづらいとユーザーから指摘された。Devex自体が4種のドキュメントを別ファイルで出力する設計([`docs/external_design.md`](../../docs/external_design.md) 2.3節SCR-005で`requirements.md`/`external_design.md`/`internal_design.md`/`implementation_plan.md`という構成が既に定義済み)であることから、このプロジェクト自身の仕様書もDevexの生成物と同じ構成に揃えて分割することにした。

### なぜファイル名をDevexの生成物と揃えたか

#25(再帰検証ルール)の精神と直接合致するため。プロジェクト自身の仕様書配置が、Devexが将来生成するドキュメント配置の雛形にもなる ── ファイル名が一致していることで、将来Devexの生成文書とこのリポジトリの仕様書を突き合わせる際の対応が一目瞭然になる。

### なぜ内部の節番号(1.1, 2.1…)を維持したか

分割前から他ファイル(`CLAUDE.md`、`textbook/`配下)が「README.md 2.3」のような節番号付き参照を多数持っていた。番号を維持し参照先のファイルパスだけを付け替えることで、変更差分を「リンク先の訂正」のみに限定し、内容の実質的な変更(番号の振り直しによる混乱)を避けた。

### q_a.mdを更新しなかった理由

#8により`q_a.md`は保存専用・非参照の履歴ログである。当時のユーザー発言の引用(「README.mdを元に実装手順を作成する」等)を後から書き換えると、発言当時の実際のやり取りの記録として不正確になる。decision-digest.md(#24、能動的に参照するファイル)側は正確性を優先して更新したが、q_a.mdは意図的に据え置いた。

## テスト観点

該当なし(設計フェーズのため #14 対象外。ドキュメント移動のみでコードは生成していない)。
