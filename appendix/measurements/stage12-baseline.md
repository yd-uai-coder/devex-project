# ステージ12 のベースライン(Phase 90-2)

ステージ12(合意の精度)の効果を後で比べるために、今の Devex(ステージ11 の版)で、CR を渡さない再生成のときに、合意した行がどれだけ動くかを記録する。決定と経緯は [Phase 90-2](../../textbook/Phase-90/Phase-90-2.md)。

## 条件

- 題材: 開発環境のプロジェクト「トレンド追跡アプリ」(詳細設計モード)。[Phase 89-4](../../textbook/Phase-89/Phase-89-4.md) の実 LLM の一巡で、CR-3(FR-001 の 8時間 → 12時間)を反映した版 **v5** を起点(合意した状態)にした。v5 は、利用者が全12行を「採用にする」で採用にしていた。
- 再生成: CR を渡さない文書の再生成(要件定義書 + 外部設計書)。v6 は Phase 89-4 の1回(2026-10-20 01:25)、v7〜v9 はこの Phase でユーザーが画面で3回(03:52〜03:53)。
- LLM: Gemini 3.5 Flash-Lite。費用は、トークンの記録が無いので、Phase 89 の見積もりの単価(再生成1回 約 $0.01)で 約 $0.03(この Phase の3回分)。
- 観点の状態: 全20件が open(このプロジェクトは観点を決めていない)。
- 測定: [`stage12/measure.py`](./stage12/measure.py)。版ごとに開発 DB から `data/` に書き出し(巡回で消える前に)、書き出したものだけを比べる(LLM・DB を使わない。2回流して同じ出力)。

## 結果(`measure.py report` の出力)

起点: 要件定義書 v5(CR を反映した版)。後の版: v6, v7, v8, v9

### 1. 要件の行(起点との比較 / 直前の版との比較)

| 版 | 比較 | 文の変化 | 出どころ: 上限のかけ直しで説明できる | 出どころ: それ以外(LLM) | 消えた行 | 増えた行 |
|---|---|---|---|---|---|---|
| v6 | 起点 | 0 | 12(FR-001(adopted→assumed), FR-002(adopted→assumed), FR-003(adopted→assumed), FR-004(adopted→assumed), FR-005(adopted→assumed), NFR-001(adopted→assumed), CON-001(adopted→assumed), CON-002(adopted→assumed), CON-003(adopted→assumed), CON-004(adopted→assumed), CON-005(adopted→assumed), CON-006(adopted→assumed)) | 0 | 0 | 0 |
| v6 | 直前 | 0 | 12(FR-001(adopted→assumed), FR-002(adopted→assumed), FR-003(adopted→assumed), FR-004(adopted→assumed), FR-005(adopted→assumed), NFR-001(adopted→assumed), CON-001(adopted→assumed), CON-002(adopted→assumed), CON-003(adopted→assumed), CON-004(adopted→assumed), CON-005(adopted→assumed), CON-006(adopted→assumed)) | 0 | 0 | 0 |
| v7 | 起点 | 0 | 12(FR-001(adopted→assumed), FR-002(adopted→assumed), FR-003(adopted→assumed), FR-004(adopted→assumed), FR-005(adopted→assumed), NFR-001(adopted→assumed), CON-001(adopted→assumed), CON-002(adopted→assumed), CON-003(adopted→assumed), CON-004(adopted→assumed), CON-005(adopted→assumed), CON-006(adopted→assumed)) | 0 | 0 | 0 |
| v7 | 直前 | 0 | 0 | 0 | 0 | 0 |
| v8 | 起点 | 0 | 12(FR-001(adopted→assumed), FR-002(adopted→assumed), FR-003(adopted→assumed), FR-004(adopted→assumed), FR-005(adopted→assumed), NFR-001(adopted→assumed), CON-001(adopted→assumed), CON-002(adopted→assumed), CON-003(adopted→assumed), CON-004(adopted→assumed), CON-005(adopted→assumed), CON-006(adopted→assumed)) | 0 | 0 | 0 |
| v8 | 直前 | 0 | 0 | 0 | 0 | 0 |
| v9 | 起点 | 0 | 12(FR-001(adopted→assumed), FR-002(adopted→assumed), FR-003(adopted→assumed), FR-004(adopted→assumed), FR-005(adopted→assumed), NFR-001(adopted→assumed), CON-001(adopted→assumed), CON-002(adopted→assumed), CON-003(adopted→assumed), CON-004(adopted→assumed), CON-005(adopted→assumed), CON-006(adopted→assumed)) | 0 | 0 | 0 |
| v9 | 直前 | 0 | 0 | 0 | 0 | 0 |

### 2. 利用者と使う場面(1.2)

- v5: 3件 ['一般ユーザー:assumed', '一般ユーザー:assumed', '外部クライアント:assumed']
- v6: 2件 ['一般ユーザー:assumed', '外部クライアント:assumed']
- v7: 2件 ['一般ユーザー:assumed', '外部クライアント:assumed']
- v8: 2件 ['一般ユーザー:assumed', '外部クライアント:assumed']
- v9: 2件 ['一般ユーザー:assumed', '外部クライアント:assumed']

### 3. 文書の要素の差分(直前の版との比較。要件・画面・API)

- v6: 12件 {'content': 12} req:CON-001, req:CON-002, req:CON-003, req:CON-004, req:CON-005, req:CON-006, req:FR-001, req:FR-002, req:FR-003, req:FR-004, req:FR-005, req:NFR-001
- v7: 0件 {} 
- v8: 0件 {} 
- v9: 0件 {} 

### 4. 段階の印のうち CR に結ばれないもの(各時点の全部)

- v6: 3(段階1 fn:F-01(doc:requirements), 段階5 proc:F-01(doc:requirements), 段階8 unit:U-005(doc:requirements))
- v7: 3(段階1 fn:F-01(doc:requirements), 段階5 proc:F-01(doc:requirements), 段階8 unit:U-005(doc:requirements))
- v8: 3(段階1 fn:F-01(doc:requirements), 段階5 proc:F-01(doc:requirements), 段階8 unit:U-005(doc:requirements))
- v9: 3(段階1 fn:F-01(doc:requirements), 段階5 proc:F-01(doc:requirements), 段階8 unit:U-005(doc:requirements))

### 5. 推測の要件

- v5: 0 / 12 行
- v6: 12 / 12 行
- v7: 12 / 12 行
- v8: 12 / 12 行
- v9: 12 / 12 行

## 判定

| 完了の判断基準(案) | 判定 | 根拠 |
|---|---|---|
| 合意済みの行が、CR の範囲の外の再生成で変わらない | × | 文は4回とも変わらなかったが、出どころは最初の再生成(v6)で12行すべてが「採用」→「推測」に戻り、関係の無い印が3件付いた(FR-005 から段階1・5・8)。利用者(1.2)も3件 → 2件に減った |
| 推測の要件がすべて確認事項に出る | △ | 推測の要件はプレビューの一覧に出る(12 / 12 行)。確認事項の一覧は無く、推測の利用者(2件)と、要件の根拠になっている open の観点(6件)は出ない。決める機会の欄も無い |

## 分かったこと

- **出どころの戻りは決定的な経路である**(LLM の揺れではない)。「採用にする」は行の出どころだけを書き換え、観点の状態を変えない。次の再生成で `assemble.build_model` が行を写すとき、`cap_source` が観点(open)で上限をかけ直し、「推測」に戻る。12件すべてが、このかけ直しで説明できた。Phase 89 の申し送り(「LLM の揺れの例」)の見立てを改める。
- **LLM の揺れは小さかった**。v6〜v9 の4回で、要件の文・ID・画面・API の変化は0件。揺れたのは、v6 の利用者(1.2)の重なった行が1件落ちたことだけだった。v7〜v9 は直前の版とまったく同じ。
- **関係の無い印は残り続ける**。v6 で付いた3件は、段階を承認するか確認するまで残る。
- 題材が小さく(要件12行・観点は全部 open)、再生成が CR を渡さないものだけなので、揺れが小さいのはこの条件のもとでの結果である。影響が広がる CR の後の揺れは、Phase 99 の効果測定で測る。
