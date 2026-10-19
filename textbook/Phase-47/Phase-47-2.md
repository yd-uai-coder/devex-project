# Phase-47-2: 側面とゆらぎを数える道具

## この章の目的

47-1 で足した観点が実際のヒアリングで聞けるか、また判定のゆらぎ(自由回答なのに「採用」になる)がどれだけ出るかを、回ごとに同じ規則で数える道具を作る。測定は Phase 49 で各モード3回ずつ行い、1回の結果ではなく回の幅で判断する(着手時の相談)。この章では道具を作り、ステージ6の既存の4回を数えてゆらぎのベースラインにする。

自動実装モード: on([introduction](./Phase-47-introduction.md) 参照)。本体(devex-api・devex-ui)は変えない。

## この章で作成・更新したファイル

測定の道具なので `appendix/` に置き、samples には写さない(ステージ6・7のベースラインの `drive.py`・`measure.py` と同じ扱い)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| `appendix/stage7-hearing/tally.py` | 新規 | 実行フォルダを読み、回ごとに潜在の事実の観点・自由回答の採用・発言の数を数えて Markdown の表にする |
| [`appendix/measurements/stage7-hearing.md`](../../appendix/measurements/stage7-hearing.md) | 新規 | 数え方と、Phase 49 での流し方(各モード3回・発言の上限24回) |
| `appendix/stage7-hearing/stage6-runs.md` | 新規 | ステージ6の4回を数えた結果(出力。手で書き換えない) |

## 要点の抜粋

```python
# appendix/stage7-hearing/tally.py
LATENT_POINTS = (("L1", "availability"), ("L2", "backup"), ..., ("L14", "data_retention"))

def is_card_answer(message: str, label: str) -> bool:
    return any(line.startswith(f"【{label}】") for line in message.splitlines())
```

- **入力**は [`stage6-effect/drive.py`](../../appendix/measurements/stage6-effect.md) が書き出すもの(`metrics.json` の観点の表と根拠のラベル「発言N」、`chat_history.txt` の `--- user` の本文)。外部の API・LLM は呼ばない。
- **聞けた**: 潜在の事実を聞く観点が、利用者の発言を根拠に未決以外になった。観点の状態で数えるので、中身が事実と合うかは人が読んで確かめる(ステージ6の1回目の簡易で、環境の観点に技術スタックが入ったなど)。
- **自由回答の採用**: 状態が「採用」なのに、根拠の発言にその観点のカードの回答の行(`compose_answer_message` が作る `【ラベル】選んだ選択肢`)が無い。
- **発言**: 生成の前の利用者の発言の数(`--- others` 以降は数えない)。

## ステージ6の4回(ベースライン)

| モード | 回 | 発言 | 側面4つ | 自由回答の採用 |
| --- | --- | --- | --- | --- |
| 詳細 | 2(1回目・2回目) | 13〜16 | 観点なし | 0〜3 |
| 簡易 | 2 | 10〜14 | 観点なし | 2〜4 |

2回目の詳細の3件(1日の流れ・例外・運用)は、[Phase 39-3](../Phase-39/Phase-39-3.md) の「自由回答が採用になるのは減ったが、残った」と一致する。1回目と2回目は本体の版が違うので、この幅は同じ版のゆらぎではない。Phase 49 では同じ版で3回ずつ流し、同じ版の幅を数える。

## 設計判断

- **判定のコードは直さない**(着手時の相談)。直す前に、同じ版で何回流すとどれだけ揺れるかを数える。直すかどうかは Phase 49 の幅を見て決める。
- **発言の上限を24回に上げる**。観点が4つ増え、ステージ6の2回目で既に16回使っていたため。上限で切ると、聞けなかったのか上限で止まったのかが区別できない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `tally.py` | 手で実行(ステージ6の4回の実行フォルダ) | スタブ不要 ── ファイルを読むだけで、外部依存を呼ばないため | 4回とも表が出る。側面4つは「—」(観点なし)。2回目の詳細の自由回答の採用が 39-3 の記述と一致する |

測定の道具なので pytest のテストは置かない(appendix の前例どおり。#15 の import の対象は本体と samples のファイル)。

```sh
python3 appendix/stage7-hearing/tally.py appendix/stage6-effect/{detailed,detailed-2,simple,simple-2}
```
