# Phase-110-1: 効果測定(クライアント役が共有リンクの画面で読む)

## この章の目的

ステージ13 の規模・選択肢・共有リンク・説明書の直しが、[ベースライン](../../appendix/measurements/stage13-baseline.md)(Phase 100-2)で見た「クライアントが説明書だけでは決められない」を減らしたかを、同じ題材「トレンド追跡アプリ」と同じクライアント役の規則で測る。題材は CR-3・CR-4 と、選択肢のある新しい CR(CR-6)。マイルストーン14 を判定する。

自動実装モード: on([introduction](./Phase-110-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`appendix/measurements/stage13/measure.py`](../../appendix/measurements/stage13/measure.py) | 更新 | CR の番号を引数で受ける(省略するとベースラインと同じ CR-3・CR-4)。案のある CR は案も書き出す |
| `appendix/measurements/stage13/data/`(`effect-explanations.json`・`cr6-share-page.txt`) | 新規 | CR-3・CR-4・CR-6 の説明書の md と案、CR-6 を読んだ時点の共有リンクの画面の文 |
| [`appendix/measurements/stage13-effect.md`](../../appendix/measurements/stage13-effect.md) | 新規 | 判断・規模の表示と実際・言葉・選択肢・完了の判断基準・分かったこと |

測定のスクリプトなので samples に写さない(#21。Phase 99 と同じ)。#13/#15/#30 の対象外。

## 測り方の要点

```python
# appendix/measurements/stage13/measure.py(抜粋)
numbers = tuple(int(arg) for arg in sys.argv[1:]) or DEFAULT_NUMBERS
...
view = await service.explanation(project, number)
entry = {"number": number, "status": ..., "title": ..., "output": view.output}
if view.change_request.options:
    entry["options"] = view.change_request.options
```

- **反映済みの CR は md で読む**(相談の決定2): 共有リンクを作れるのは下書き・説明済みの CR だけ。CR-3・CR-4 は反映済みなので、説明書の md を書き出して読んだ。共有リンクの画面も同じ md を出すので、読む中身は変わらない。
- **新しい CR は共有リンクの画面で読む**: CR-6 の共有リンクを、ログインしていないブラウザで開き、画面の文を書き出してから読んだ(読んだ後に合意した)。
- **束は段階が最新のものを基準にする**(Phase 100 からの申し送り「束の段階が古いと、予測が少なく出る」の決め): 初めの B-5 は段階7・8 が古く、CR-5 の規模が0件になった。段階を最新にして B-6 を作り、CR-6 をそれで作った([110-4](./Phase-110-4.md))。

## 結果の要点

詳細は [`stage13-effect.md`](../../appendix/measurements/stage13-effect.md)。

- **CR-6**: 合意(案1)。判断に要る問いは0。案ごとの規模の表と結果で、頼んだ本人の困りごと(11〜20位に解説が無い)を直せるのは案1 だけと分かる。反映の後の比較で、予測の 作業単位5・ファイル13・テスト5 が実際と一致した。
- **CR-3・CR-4**: 判断できない(費用・期間)。基準の束 B-3・B-4 の段階1 の処理が要件 ID を持たず、規模は「数えられない」と出る。説明書は確かめる先(開発者)を示す。ベースラインの CR-3 の合意は、数えられなかった「0件」を信じたものだった。
- **完了の判断基準**: 判断できた CR 1/3、判断に要る問い 2、残った疑問 5、0件の区別あり、選択肢のある CR 1。
- **マイルストーン14**: 達成。CR-6 は ○、CR-3・CR-4 は ×。ユーザーの決定で、題材を「ステージ13 の流れで作った CR」に読み替えた(#40 の CR。[`q_a.md`](../q_a.md) の「Phase 110 開始時」)。

## 測れなかったもの

- CR-6 の検証(反映済みのまま。段階1 を作り直して承認した後、下流の段階2〜8 に見直しの印が35件残る)。
- 実 LLM が利用者の `prev_id` を書いたか(版の model は付けた ID だけを持つ)。

## テスト観点

この章は本体のテストを足さない(測定)。

| 確かめ | SUT | ドライバ | スタブ |
|---|---|---|---|
| CR-3・CR-4・CR-6 の書き出しを2回流して同じ出力 | `ChangeRequestService.explanation`(開発 DB の題材) | `measure.py`(backend のコンテナの中) | スタブ不要 ── 開発 DB の実データを読むだけで、LLM を呼ばないため |
| クライアント役の判断 | 説明書の md と共有リンクの画面の文 | Claude([`client.md`](../../appendix/measurements/stage13/client.md) の規則) | スタブ不要 ── 書き出した文だけを読むため |
