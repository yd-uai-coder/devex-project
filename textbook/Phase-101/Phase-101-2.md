# Phase-101-2: 説明書のクライアント向けの直し

## この章の目的

変更の説明書を、クライアントが読んで合意・却下を決められる形に直す(決定6)。節を「何を・どのくらい」が先に来る並びにし、各節の頭に読み手向けの1文を置く。5節だった「作業単位とテストの数」を 101-1 の規模の節(3節)に置き換え、推測の要件と未決の観点は「合意の前に確かめたい点」として問いの形で出す。要素は名前を先に書く。ベースラインでクライアント役が引っかかった点(推測・未決の意味・ID・数字の意味)を、LLM に頼らず決まった言い換えで直す。確認済みの要約が説明書の変化で古くなったことも知らせる(Phase 100 の申し送り)。

自動実装モード: on([introduction](./Phase-101-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/summary.py`](../samples/backend/app/change_requests/summary.py) | プロンプトを新しい節に合わせる。`needs_reconfirm` |
| [`backend/app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 節の並び替え・読み手向けの1文・規模の節・問いの形・名前を先に。`Explanation.scale` |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | `needs_reconfirm` を re-export。`AffectedUnits`・`affected_units` を外す |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 説明書の応答に `scale`(`ScaleCountRead`・`ScaleRemarkRead`)。今の項目は規模から出す |
| [`backend/tests/unit/test_change_request_explanation.py`](../samples/backend/tests/unit/test_change_request_explanation.py) | 節の順と1文・規模の節・問いの形・名前を先に |
| [`backend/tests/unit/test_change_request_summary.py`](../samples/backend/tests/unit/test_change_request_summary.py) | `needs_reconfirm`・プロンプト |
| [`backend/tests/unit/test_change_request_origins.py`](../samples/backend/tests/unit/test_change_request_origins.py) | 起点の表示が名前を先に |
| [`backend/tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | テスト仕様書の無い束の規模の行 |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 説明書の応答の `scale`・`units`。照合の数字 |

## 1. 節の並びと読み手向けの1文

```
# 変更の説明書 CR-4: トレンドランキングの件数変更

この文書は、合意済みの要件と設計を変える依頼について、何を変え、どこまで手が入るかを説明するものです。合意・却下の前にお読みください。

- 基準の合意済みの版: B-4(前回合意した要件と設計の一式)
- CR の状態: 反映済み

## 1. 変更の内容と背景      この節は、何を・なぜ変えるかです。
## 2. 対象の要件            この節は、合意済みの要件のうち変わるものです。…
## 3. 変更の規模            この節は、変更で手を入れる量の目安です。…工数や費用ではありません。
## 4. 影響の一覧            この節は、合意済みの版の設計のうち、見直しが要る部分です。
## 5. 合意の前に確かめたい点  この節は、合意の前にお答えいただきたい点です。
```

- 並びは相談の決定3。クライアントが「何を(1・2)・どのくらい(3)」を先に読み、設計の細目(4)と問い(5)を後に読む。Phase 102 で選択肢の節を2節の後に入れる。
- 1文は決まった文(`READER_INTRO`・`SECTION_LEAD`。相談の決定5)。表と同じ情報を繰り返さない。
- 2節の要件の文は、合意の対象なので変えない。

## 2. 3節 変更の規模

```
| 種類 | 数 | 内訳 |
|---|---|---|
| 作業単位 | 数えられない |  |
| ファイル | 数えられない |  |
| テスト | 数えられない |  |
| 画面 | 1件 | トップページ(SCR-001) |
| API | 0件 |  |

- 作業単位・ファイル・テスト: 設計の処理につながらない要件がある(FR-003)
```

- `build_explanation(..., stage_states)` が `predicted_scale`(101-1)を呼び、`Explanation.scale` に持つ。`stage_states` は束に入っている段階の状態(101-3 でサービスが渡す。省けば古い段階の注記は出ない)。
- 数えられない種類があれば、1文の後に「…は数えられませんでした(理由は表の下)。この部分の手間の見込みは、開発者に別に確かめてください。」を足す(規模の節だけ中身で変わる1文)。
- 理由・注記は表の下に、同じものは種類をまとめて1行にする(`ScaleRemark` を辞書のキーにして種類を集める)。
- テストの内訳は「結合テスト n件(IT-…)・総合テスト n件(ST-…)」。

## 3. 4節 影響の一覧・5節 合意の前に確かめたい点

- 4節の要素は `display_name`(101-1)で名前を先に書く。2節の新しい要件の起点も同じ。
- 5節は、今の 4節「関わる未決事項」の材料(束の要件定義書の写しの `point_statuses`・`rows[].source`)をそのまま使い、表を問いの箇条に変えた。

```python
# app/change_requests/explanation.py(抜粋)
for key, ids in open_points.items():
    point = point_def(key)
    lines.append(
        f"- 「{point.label}」がまだ決まっていません(関わる要件: {'・'.join(ids)})。"
        f"{_sentence(point.question)}"          # 観点の問いの例(ヒアリングと同じ文)
    )
for req_id, text in assumed:
    lines.append(
        f"- {req_id} の文は、AI が補った推測で、まだ確かめていません。この文のとおりで"
        f"よいですか。「{_line(text)}」"
    )
```

- 観点の問いの例(`PointDef.question`)は句点が無いので、`_sentence` が足す。
- ベースラインのクライアント役は「推測の要件」「ヒアリングで決まっていない観点」が何を意味し、自分が何を決めるのかが分からなかった。問いの形にすれば、答えることが分かる。

## 4. 要約

- プロンプト(`SUMMARY_SYSTEM_PROMPT`)を、「どのくらい手が入るか(変更の規模の節の数。『数えられない』ものはそう書く)、合意の前に確かめたい点」に直した。照合(`check_summary`)は説明書の全文(見出しの行を除く)のままで、範囲は変えていない。
- `needs_reconfirm(status, fingerprint, current)` は、保存の状態が確認済みで指紋が違うときだけ真。確認済みの要約は古くなると出力に載らないので、共有の前に確かめ直すよう知らせる値である(応答と画面は 101-3・Phase 107)。
- **説明書の md が変わったので、以前に作った要約はすべて「古い」になる**(指紋が変わるため)。開発 DB の CR-3 は元から古く、CR-4 は要約が無い。本番へ反映するときの注意は Phase 110 で `OPERATIONS.md` 10.8節に書く。

## 5. 応答

```python
# app/schemas/change_request.py(抜粋)
class ScaleCountRead(BaseModel):
    kind: ScaleKind
    label: str
    count: int | None          # 数えられなければ null
    names: list[str]
    uncountable: list[ScaleRemarkRead]   # code・label・detail
    notes: list[ScaleRemarkRead]


class ChangeRequestExplanationRead(BaseModel):
    ...
    scale: list[ScaleCountRead]
    units: list[str]           # 規模の作業単位の表示名(今の画面は件数だけを使う)
    integration_tests: list[str]
    system_tests: list[str]
    has_test_spec: bool
```

- 今の項目は残し、規模から出す。devex-ui は変えない(説明書のタブは `units` などの件数だけを使う)。`units` の中身は単位の ID から表示名(`名前(ID)`)になった。

## テスト観点

**SUT / ドライバ / スタブ**(#14):

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_explanation.py` | `build_explanation`・`with_summary`・`check_summary`・`explanation_filename`、`Explanation`(md・指紋・`scale`) | pytest のテスト関数 | スタブ不要 ── 純粋。入力は 101-1 と同じ fixture の束の写し |
| `test_change_request_summary.py` の純粋な部分 | `needs_reconfirm`・`build_summary_messages` | pytest のテスト関数 | スタブ不要 ── 純粋 |
| `test_change_request_origins.py`・`test_change_request_service.py` の説明書の部分 | `ChangeRequestService.explanation` | テスト関数 | インメモリ SQLite(`db_session`)と、段階1〜8 承認済みの fixture の束 |
| `test_change_requests_api.py` の説明書と要約 | ルート `get_change_request_explanation`・`generate_change_request_summary` と `ChangeRequestExplanationRead` | テスト関数 | インメモリ SQLite。要約の LLM は `FakeLLM` を `stub_llm_resolver` で差し替える |

- 節: 見出しの順が 1〜5 で、各見出しの2行後が「この節は、」で始まる。頭の1文と「B-1(前回合意した要件と設計の一式)」。
- 規模の節: 作業単位・テスト・画面の行。古い段階の注記が種類をまとめて1行。テスト仕様書が無いと「数えられない」と、数えられない1文と理由の行。新しい要件だけの CR は作業単位が数えられない。
- 5節: 未決の観点の問い(観点の問いの例つき)と推測の要件の問い(文はそのまま)。決まった観点は出さない。無ければ「確かめたい点はありません」。
- 名前を先に: 4節の処理・画面、2節の起点。
- 照合: 説明書に数字が増えた(規模の件数)ので、照合のテストの「説明書に無い数字」は `40` にした。
- 要約: `needs_reconfirm` の3通り。プロンプトに「変更の規模」「数えられない」があり、「5節」が無い。
- 応答: `scale` の種類・数・理由の code。`units` が表示名。

各ファイルは、この章のテストが少なくとも1度 import する(#15)。`summary.py` は `test_change_request_summary.py`、スキーマは `test_change_requests_api.py`、`__init__.py` は各テストが通る。
