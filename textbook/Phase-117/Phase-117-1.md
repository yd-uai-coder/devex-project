# Phase-117-1: 束 B-7 と効果測定

## この章の目的

ステージ14 の取り込み(資料 → 違いの取り出し → CR の下書き)が、[ベースライン](../../appendix/measurements/stage14-baseline.md)(Phase 111-2)の素朴なプロンプトに比べて、CR の下書きにそのまま使える形で違いを拾えるかを、同じ資料・正解表で測り、マイルストーン15 を判定する。測る前に、比べる相手の束 B-7 を作る。直す前の2回で拾い漏れが出たので、取り出しのプロンプトと引用の照合を直して測り直した。

自動実装モード: on([introduction](./Phase-117-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/materials/differences.py`](../samples/backend/app/materials/differences.py) | 更新 | 取り出しのプロンプトに2つの規則を足した。`normalize_quote` が文字どおりの `\n`・`\r`・`\t` も除く |
| [`backend/tests/unit/test_material_differences.py`](../samples/backend/tests/unit/test_material_differences.py) | 更新 | プロンプトの2つの規則・`\n` の2文字で書いた引用の照合 |
| [`appendix/measurements/stage14/measure.py`](../../appendix/measurements/stage14/measure.py) | 更新 | `baseline`(B-7 を作って鮮度を出す)・`effect <フォルダ> <回>`(資料ごとの取り出しと下書きの確かめ)・`scale`(下書きの規模)を足した |
| `appendix/measurements/stage14/data/`(`effect-a-run1〜4.json`・`effect-b-run1〜4.json`・`effect-scale.json`) | 新規 | 各回の違いの一覧・トークン・下書きの確かめ、下書きの規模 |
| [`appendix/measurements/stage14-effect.md`](../../appendix/measurements/stage14-effect.md) | 新規 | 条件・結果・直したこと・マイルストーン15 の判定・分かったこと・費用 |

測定のスクリプトと記録は samples に写さない(#21。Phase 110 と同じ)。#13/#15/#30 の対象は本体の2ファイルだけ。

## 測り方の要点

```python
# appendix/measurements/stage14/measure.py(抜粋)
with get_usage_metadata_callback() as usage:          # 実 LLM のトークンを記録する
    view = await service.extract(project, material_id, user_id=project.user_id)
...
session.commit = session.flush  # 作った CR を確定させない(最後に rollback)
cr = await service.create_change_request(project, material_id, ids, requirement_ids=None, ...)
await session.rollback()
```

- **B-7**: 段階2〜8 は CR-6 の後で古いまま作った(決定2)。鮮度は「後の束 0・束の後の CR 0・古かった段階 2〜8」。取り出しは文書だけを使うので測定に関わらない(マイルストーン15 の読み替えの CR。[`q_a.md`](../q_a.md) の「Phase 117 開始時」)。
- **資料**: セット A の3本は題材に貼り付けで足し、セット B は Phase 114 で足した2件を使い回した。題で見つけるので、何回流しても資料は増えない。
- **取り出し**: 本物のサービスを資料ごとに1回呼ぶ。やり直しは未確認と弾いたを置き換えるので、各回の一覧はその回の結果だけになる。
- **下書き**: 本物の `create_change_request` を呼び、commit の代わりに flush にして最後に rollback する。題材の CR の番号は乱さない(決定6)。題材の CR は6件のまま。

## 直したこと(本体)

```python
# backend/app/materials/differences.py(抜粋)
- 合意済みの要素に、合意済みの内容に無い数値・上限・条件などの詳細を決めるもの(例: 「制限する」
  だけの要素に回数を決める)は、言い換えでなく change にする。
- 結論が出ていない話は、add / change / delete と断定せず question にする。同じ資料に結論の
  出ていない話があっても、決まったこと(依頼・指示)は別の件として挙げる。

_IGNORED = re.compile(r"(?:\\[nrt]|[\s*_~`#>])+")   # 文字どおりの「\n」も改行とみなす
```

- **なぜ落ちたか**: 漏れた2件(H4「1キー1分60回」・G4「200字以内」)は、どちらも合意済みの要素に数値の詳細を決める違い。合意の要素は短い1行(「レート制限を適用した API」)で渡るので、LLM はその要素の確認と読み、「言い換え・確認は挙げない」の規則で落とした。H4 は、同じメールの未決の話(H5)と一緒に確かめる点の1件にまとまった。
- **なぜ照合も直したか**: 直した後の4回目で、LLM が引用の改行を `\n` の2文字で書き、H5 が「引用が資料に無い」で弾かれた。内容は合っていて、構造化出力で起きる書き方の揺れなので、照合で改行とみなす(Claude の判断)。照合し直して通ることを確かめた(LLM は呼び直していない)。

## 結果の要点

詳しくは [`stage14-effect.md`](../../appendix/measurements/stage14-effect.md)。

| 判断基準 | 直す前(1・2回目) | 直した後(3・4回目) |
|---|---|---|
| 1. 拾い漏れと誤り | 漏れ A 0・1、B 1・1(満たさない) | 漏れ 0・0、誤り 0・0(満たす) |
| 2. 対象がキーか新規 + 起点 | 満たす | 満たす |
| 3. 引用が資料にある | 弾いた 0 | 弾いた 1(`\n`。照合を直した) |
| 4. 撤回・済み・未決・言い換え | 出ない | 出ない |
| 5. 下書きの対象・背景・規模 | 作れた | 5件とも作れ、規模は数えられた(作業単位・ファイルは「古い」) |

**マイルストーン15 は、直した後の2回で達成。** 取り込みの価値は拾う数(ベースラインと同じ漏れ0)でなく、対象が CR の対象に結べる・引用が確かめられている・下書きがそのまま作れる、という形にある。種類(変更 / 追加 / 確かめる点)は回ごとに揺れる。

費用: 実 LLM 20回、入力 約3.6万・出力 約6千トークン、概算 $0.01 未満(Flash-Lite)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_messages_carry_listing_and_material`(更新) | `build_difference_messages` | テスト関数 | スタブ不要 ── メッセージを組み立てる純粋関数で、LLM を呼ばないため |
| `test_quote_ignores_width_whitespace_and_markdown`(更新) | `quote_found`・`normalize_quote` | テスト関数 | スタブ不要 ── 文字列だけを比べる純粋関数のため |
| 効果測定(`measure.py effect`) | 取り出しのサービス + 実 LLM + 開発 DB | スクリプト | なし(本物の LLM で測る。測定でありテストではない) |

プロンプトの規則が LLM に効くかは単体テストでは確かめられない(文が入っていることだけを固定する)。効くかどうかは効果測定で見た。
