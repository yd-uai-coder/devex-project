# Phase-32-4: `docs/*.md` への反映

## この章の目的

ステージ5の Phase 32 の完了と、E2E・契約テストの範囲、本番反映の手順への参照を、実装計画書([`docs/implementation_plan.md`](../../docs/implementation_plan.md))に反映する。

自動実装モード: on([introduction](./Phase-32-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 32 を完了に、「達成範囲(Phase 32で終了)」を追加、E2E の行に「Phase 32で両モードの段階8の生成まで延長」 |

文書の章なので、#13 のファイル解説・#15 の import・#30 の並び順の対象外。

## 設計判断

### 外部設計書・内部設計書は変えない

この Phase は新しい機能・画面・API を作らない。偽 LLM は E2E 用のテストの部品で、設計書の対象ではない。そのため、変えるのは実装計画書の進み具合と達成範囲だけにした([Phase 24](../Phase-24/Phase-24-introduction.md) と同じ扱い)。

## テスト観点

なし(文書の目視レビュー)。
