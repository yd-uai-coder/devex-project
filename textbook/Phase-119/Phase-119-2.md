# Phase-119-2: 本番への反映

## この章の目的

[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節の手順1〜6 で、ステージ11〜14 と Phase 118 を本番へ出す。VPS・GitHub・Vercel の操作はユーザーが行い、AI は各手順の出力を読んで次へ進めるかを返し、結果を記録する。

自動実装モード: on([introduction](./Phase-119-introduction.md) 参照)。

## この章で作成・更新したファイル

無し(実装ファイルを作らない章。#13/#15 の対象外)。

## 手順(10.8節の要約)

**API を先に、UI を後に出す。** 秘密の値(`.env` の鍵・トークン)はチャットに貼らない(ステージ10 で鍵が出て作り直した前例。[Phase 79](../Phase-79/Phase-79-introduction.md#本番での確認の記録))。

| # | どこで | すること | 確かめること |
|---|---|---|---|
| 0 | 手元 | 119-1 の `ruff` の直しをコミットして、devex-api の `stage11-15` を push。タグ `phase-118` を付ける | `git status` が空 |
| 1 | VPS | `pg_dump` でダンプを取り、VPS の外へコピー(5節) | ダンプのサイズが 0 でない |
| 2 | VPS | `alembic_version` と、本番が動かしているコミットを控える | head が `d7e2a9c4f1b3`(`c4f8a2e6d1b9` なら10本流れる) |
| 3 | VPS | `.env` の `GEMINI_MODEL`・`REVIEW_MODEL`・`JUDGE_MODEL` | `gemini-3.1-flash-lite` が残っていない |
| 4 | 手元 / GitHub | `stage11-15` → `main` の PR を作ってマージ | 並ぶコミットがステージ11〜14 だけ・CI(ruff・pytest)が通る |
| 5 | GitHub / VPS | Actions のログ・`/health`・`alembic_version` | `Running upgrade` が24本・`{"status":"ok"}`・head `d5a1c7e3f926` |
| 6 | 手元 | devex-ui の `main` を push(Vercel) | 並ぶコミットがステージ11〜14 と Phase 118 だけ・Vercel のデプロイが成功 |

## 反映の記録

2026-11-02 までに、ユーザーが 10.8節の手順で反映した。ユーザーの報告は「デプロイ完了。問題なし」。各手順の細かい値(更新前の head・マイグレーションの本数など)はチャットに貼られていないので、ここには書かない。

| # | 結果 | メモ |
|---|---|---|
| 0 | 済み | devex-api に 119-1 の直し(`de1a5c8`「デプロイの準備」)をコミットして `stage11-15` を push |
| 1〜3 | 済み(ユーザーの報告) | バックアップ・更新前の版・モデルの設定 |
| 4 | 済み | PR #10(`stage11-15` → `main`、マージコミット `a045944`)。CI(ruff・pytest)が通り、自動デプロイが走った |
| 5 | 済み(ユーザーの報告) | 問題なし |
| 6 | 済み | devex-ui の `main` を push(origin/main は `b9fb09c` の後、ユーザーの調整 `0a2d805` まで)。Vercel のデプロイ |

- 前回(10.7節。ステージ9・10)の1回目の失敗(VPS の `.env` の余計な文字)のようなことは、報告されていない。
- devex-api の手元は、まだ `stage11-15` ブランチにいる(`main` へ戻すのは introduction のコミットの案)。

## テスト観点

この章は本番の操作だけで、テストを書かない。反映が正しく済んだかは、手順5(マイグレーションの本数・head・`/health`)と、[119-3](./Phase-119-3.md) の本番での確認で見る。
