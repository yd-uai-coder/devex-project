# ステージ7の効果測定(Phase 49)

> 2026-10-19 の整理で、生成物・入力・実行スクリプトは削除した。結果と判定はこの文書に残る(文中のファイル名は当時の名前)。

ステージ7(Phase 42〜48)の後の Devex を、[ベースライン](stage7-baseline.md)(Phase 41-1)と同じシナリオと、実際の LLM で測ったもの。分析と判定は [Phase 49](../../textbook/Phase-49/Phase-49-introduction.md) にある。

- 日時: 2026-10-12。ローカルの devex-api(1回目は `main` = Phase 48 の版、2・3回目は Phase 49-3 の直しを当てた作業ツリー。head `e5f6a7b8c9d1`)、`.env` の `GEMINI_MODEL=gemini-3.5-flash-lite`(ステージ6と同じ)。
- 生成された文書・段階の model・手順書の**中身は書き換えていない**。

## 測ったもの

| 章 | 何を | どこ |
|---|---|---|
| [49-1](../../textbook/Phase-49/Phase-49-1.md) | ベースラインのシナリオ(S1〜S8・N1〜N4)を、実装した仕組みで | `impact/` |
| [49-2](../../textbook/Phase-49/Phase-49-2.md) | 1回目の実 LLM(両モード): ヒアリング・段階3・5 の件数・再生成の実際の印 | `hearing/detailed-1/`・`hearing/simple-1/`・`stage35.md` |
| [49-3](../../textbook/Phase-49/Phase-49-3.md) | 直した本体(差分の再生成・キーの引き継ぎ・たどり方)で、49-1 のシナリオを測り直す | `impact/results.md`(49-1 の時点は `results-49-1.md`) |
| [49-4](../../textbook/Phase-49/Phase-49-4.md) | 2・3回目の実 LLM(両モード): ヒアリングのゆらぎ・段階3・5・直した後の再生成の印 | `hearing/*-2/`・`hearing/*-3/`・`hearing/tally-run123.md`・`stage35.md` |

## 実行

```bash
# 49-1(外部の API・LLM は呼ばない。data/ を作るときだけローカル DB を読む)
python3 appendix/stage7-effect/impact/export_models.py
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage7-effect/impact/measure.py

# 49-2(ローカルの devex-api を叩く。ログイン情報は state.json、git に置かない)
cd appendix/stage7-effect
uv run --project ../../devex-api/backend python drive.py setup detailed-1
uv run --project ../../devex-api/backend python drive.py say detailed-1 <発言のファイル|-> [card_id:選択肢]
# … generate・docs・design・procedure・impact(drive.py の usage)
cd ../..
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage7-effect/stage35.py appendix/stage7-effect/hearing/detailed-1
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage7-effect/regen.py appendix/stage7-effect/hearing/detailed-1 --export
python3 appendix/stage7-hearing/tally.py appendix/stage7-effect/hearing/detailed-1 appendix/stage7-effect/hearing/simple-1 --out appendix/stage7-effect/hearing/tally-run1.md
```

## ファイル

| パス | 中身 |
|---|---|
| `impact/export_models.py` | stage6-effect の1回目のプロジェクトの段階・文書の model と ER を、ローカル DB から `impact/data/*.json` へ(一度だけ) |
| `impact/measure.py` | ベースラインの `measure.py`・`scenarios.py` を読み込み、方式「実装(たどり方)」「実装(印)」と直しの候補を足す |
| `impact/results.md`・`results.json` | 出力(手で書き換えない)。49-3 で直した後の本体の数字。49-1 の時点の出力は `impact/results-49-1.md` |
| `drive.py` | [`stage6-effect/drive.py`](stage6-effect.md) の複製。回(`detailed-1` など)ごとのプロジェクト・`impact`・`dump`(図の意味モデルも) |
| `input/` | 初期入力(stage6-effect と同じ) |
| `hearing/<回>/input/u<n>.txt` | 送った発言(カードだけの回答は「[カード] 観点 → 選んだ選択肢」) |
| `hearing/<回>/` | 観点の表・チャット履歴・文書・段階(`stages/`)・手順書の zip・`metrics.json` |
| `hearing/<回>/regen/` | 再生成の測定: `truth.md`(印を取る前に書いた正解)・変更の発言・版2 の文書・`impact.json`・文書の model(`documents_v1/v2.json`)・`result.md` |
| `stage35.py`・`stage35.md` | 段階3・5 の件数(本体の `dfd_accesses`・`to_sequence` で数える)。49-4 で逆向きの書き漏れ(CRUD に書き込みがあり DFD に線が無い)を足した |
| `regen.py` | 再生成の印を正解と比べ、意図した変更の分と揺れの分に分ける。49-4 で「今の本体で求め直した印」を足した |
| `hearing/tally-run1.md`・`hearing/tally-run123.md` | 1回目の2本・1〜3回目の6本の [`tally.py`](stage7-hearing.md) の出力 |

## 規則(ペルソナはそのまま)

- `persona.md` と [stage6-effect](stage6-effect.md) の「規則の差分」のまま。発言の上限だけ 20回 → **24回**(Phase 47 で決めた)。
- 段階の操作(`design`・`procedure`)は stage6-effect と同じ規則。
- 再生成の測定: 全段階(簡易は段階8)を承認した後、チャットで「参考資料の上限を3件から5件に変えたいです。」と送り、文書を再生成する(ベースラインの N2・N4 と同じ変更)。**正解は印を取得する前に書いた**。`truth.md` の「意図した変更」の行は、印を取得した後に `regen.py` のために足した(正解の表は変えていない)。

## 人の操作(ヒアリング、1回目)

| 回 | 発言 | 聞かれた観点の順(→ は1発言) |
|---|---|---|
| detailed-1 | 18 | 規模(カード)→ 目的 → 利用者 → 1日の流れ → MVP の範囲 → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ セキュリティ → **ログ(カード)** → **不正利用** → 環境 |
| simple-1 | 17 | 規模(カード)→ 利用者 → 1日の流れ → MVP の範囲 → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ セキュリティ → **ログ(カード)** → **不正利用** → 環境 |

太字は Phase 47 で足した側面。どちらも可用性の次にデータの保全、運用の次に保持・削除、セキュリティの次にログ・不正利用が聞かれた。

## 人の操作(ヒアリング、2・3回目。Phase 49-4)

1回目と同じペルソナ・同じ答え(1回目の発言を観点ごとに使い回し、コア機能を聞かれた回だけペルソナの「最初から話してよい事実」から答えを作った)。カードの選択肢が事実と一部しか合わないときは自由回答で答えた。4本を並行して流した。

| 回 | 発言 | 聞かれた観点の順(→ は1発言) |
|---|---|---|
| detailed-2 | 19 | 規模(カード)→ 目的 → 利用者 → 1日の流れ → コア機能 → MVP の範囲 → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ セキュリティ → **ログ(カード)** → **不正利用** → 環境 |
| detailed-3 | 18 | 規模(カード)→ 目的 → 利用者 → 1日の流れ → コア機能 → MVP の範囲 → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ **ログ(カード)** → **不正利用** → 環境 |
| simple-2 | 17 | 規模(カード)→ 利用者 → 1日の流れ → MVP の範囲 → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ セキュリティ → **ログ(カード)** → **不正利用** → 環境 |
| simple-3 | 16 | 規模(カード)→ 利用者 → 1日の流れ → 例外 → 将来 → 技術スタック → 可用性 → **データの保全** → 性能 → 運用 → **データの保持・削除** → 移行(カード)→ セキュリティ → **ログ(カード)** → **不正利用** → 環境 |

- detailed-3 はセキュリティの観点を直接は聞かれず、コア機能の答え(「ログインは MVP に入れます」。ペルソナの最初から話してよい事実)で「採用」になった。本人以外に見せないこと(L4)は聞かれず、要件定義書にも入っていない。`tally.py` は観点の状態だけで数えるので ○ と出るが、事実としては聞けていない(Phase 49-4 で数え直した)。
- simple-3 は、最初の入力の後に AI が MVP の範囲を対象外にし、聞かれなかった。

## 再生成の測定(2・3回目)

1回目と同じ変更の発言を、全段階(簡易は段階8)を承認した後に送った。正解(`regen/truth.md`)は印を取る前に書いた。要件の ID は回ごとに違う(detailed-2 は FR-006、detailed-3 は FR-003(件数を書いていなかった)、simple-2 は FR-003、simple-3 は FR-004)。

