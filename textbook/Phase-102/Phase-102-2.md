# Phase-102-2: 案の保存・合意で選ぶ案・反映(API)

## この章の目的

102-1 の案を CR に保存し、作成・更新・合意・写し・反映・たどる記録の API に通す。合意では案を選び、選んだ案の対象をその後の CR の対象にする。こうすると、予測の保存・反映の指示・予測と実際の比較・検証は、今までどおり CR の対象だけを見ればよい(決定2「反映は選んだ案を使う」)。マイグレーションは1本にまとめるため、102-4 で使う下書きの表もこの章で作る。

自動実装モード: on([introduction](./Phase-102-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/alembic/versions/a7c3e5d91f20_add_change_request_options.py`](../samples/backend/alembic/versions/a7c3e5d91f20_add_change_request_options.py) | 新規。`change_requests.options`・`decision_option` と表 `change_request_option_drafts` |
| [`backend/app/models/change_request_option_draft.py`](../samples/backend/app/models/change_request_option_draft.py) | 新規。下書きの ORM(102-4 で使う) |
| [`backend/app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 下書きのモデルを登録 |
| [`backend/app/models/change_request.py`](../samples/backend/app/models/change_request.py) | `options`・`decision_option` の列 |
| [`backend/app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | `create` に `options` |
| [`backend/app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | `ChangeRequestFacts` に `options`・`decision_option` |
| [`backend/app/change_requests/instruction.py`](../samples/backend/app/change_requests/instruction.py) | 反映の指示に「合意した案」の1行 |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 直した項目の名前に「選択肢」、合意の行のメモに選んだ案 |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | `ChangeRequestOptionInvalidError`(422 `CR_OPTION_INVALID`) |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 案の入力 `ChangeRequestOptionsIn`、合意の `option`、詳細の `options`・`decision.option` |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 作成・更新の確かめ、合意で選ぶ案、写し、`facts_of`・たどる記録 |
| [`backend/tests/unit/test_change_request_option_service.py`](../samples/backend/tests/unit/test_change_request_option_service.py) | 新規。案の保存・合意・反映・写し・たどる記録のテスト |
| [`backend/tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | `facts_of` が案を読む |
| [`backend/tests/unit/test_change_request_instruction.py`](../samples/backend/tests/unit/test_change_request_instruction.py) | 合意した案の1行 |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 案のルート(作成・更新・合意) |

## 1. 列と表

- `change_requests.options`(JSON。NULL は案なし)と `decision_option`(INT。合意で選んだ番号。案の無い CR・却下は NULL)。既存の CR は NULL のままで、今までどおり動く。
- 表 `change_request_option_drafts`(CR ごとに1行)は 102-4 の下書き。要約の表(Phase 84)と同じ形にした(作った・取り込んだ人と日時・モデル名・説明書の指紋)。違いは、文を直す欄が無いこと。下書きは直さず、取り込んだ後の案を直す(相談の決定3)。
- マイグレーション `a7c3e5d91f20`(親は `ee299cd210b8`)。始める前に heads が1つで、ID が重ならないことを確かめた。開発 DB で upgrade → downgrade → upgrade を往復した。

## 2. 入力のスキーマと、作成・更新の確かめ

```python
# app/schemas/change_request.py(抜粋)
class ChangeRequestOptionsIn(BaseModel):
    items: list[ChangeRequestOptionIn] (max 3) = []
    recommended: int | None = Field(default=None, ge=1)
    reason: str = ""

    def to_options(self) -> ChangeOptions:      # normalize_options(規則に合わなければ ValueError)
    @model_validator(mode="after")
    def _check(self): self.to_options(); return self   # 規則は 422 の検証の誤り
```

```python
# app/services/change_request_service.py(抜粋)
def checked_options(options, targets, adds_requirement) -> ChangeOptions:
    problems = option_target_problems(options, targets, adds_requirement)
    if problems:
        raise ChangeRequestOptionInvalidError(" / ".join(problems))
    return options
```

- 作成は `checked_targets` の後に `checked_options` を通す。
- 更新(PATCH)は、`options` を送ったときと、対象・新しい要件の印を変えたときに、今の案を確かめ直す。対象から外した要件を案が使っていれば 422(案が CR の対象の外を指したまま残らないように)。`options` の null は「変えない」、`{items: []}` は「消す」(`origins` と同じ扱い)。
- 案を直すと、ほかの項目と同じく時系列の直した行に `options` が残り、説明済みなら下書きに戻る(説明した中身が変わるため)。

## 3. 合意で選ぶ案

```python
# app/services/change_request_service.py(抜粋。decide)
chosen = chosen_option(change_request, payload)
if chosen is not None:
    refs = {"option": chosen, "targets": list(change_request.targets)}   # 前の対象を残す
    option = options_from_json(change_request.options).option(chosen)
    change_request.targets = targets_to_json(option.targets)
change_request.decision_option = chosen
change_request.predicted_impact = predict_for(change_request, baseline).to_dict()   # 選んだ案の対象で
```

- `chosen_option` は、案のある CR の合意で選ばない・番号の案が無い・案の無い CR や却下で選んだ、を 422 `CR_OPTION_INVALID` にする。
- **選んだ案の対象を CR の対象にする**(相談の決定2)。予測の保存(`predict_for`)・書き換えてよい要素(`rewritable_keys`)・反映の指示・比較・検証・重なりの判定は、どれも `change_request.targets` を読む。ここを差し替えれば、反映の側を1つも変えずに「選んだ案で反映する」になる。前の対象は合意の行の `refs` に残すので、時系列から戻れる。
- 却下では案を選ばない。却下した CR を写すと、案も写る(`copy_rejected`)。

## 4. 反映の指示とたどる記録

- `ChangeRequestFacts` に `options`・`decision_option` を足し(`facts_of` が CR の行から写す)、`build_cr_instruction` は選んだ案があればタイトル・内容の後ろに `合意した案: 案2 名前(結果: …)` の1行を置く。対象の行は CR の対象(= 選んだ案の対象)。
- たどる記録は、直した項目の名前に「選択肢」を足し、合意の行のメモの先頭に「選んだ案: 案2 名前」を出す(`DecisionFacts.option`)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_option_service.py`(102-2 の分) | `ChangeRequestService` の `create`・`update`・`decide`・`copy_rejected`・`reflection`・`trace` の案の扱い、`checked_options`・`chosen_option`・`chosen_option_name`、スキーマ `ChangeRequestOptionsIn`・`ChangeRequestDecision`・`ChangeRequestRead` | pytest のテスト関数 | 永続化と遷移が検証対象のため、テスト用の SQLite のセッションと、変更の影響の fixture から作った合意済みの版(LLM は呼ばない) |
| `test_change_request_service.py`(`facts_of`) | `facts_of` | pytest のテスト関数 | スタブ不要 ── `SimpleNamespace` の行を渡す純粋関数 |
| `test_change_request_instruction.py`(合意した案) | `build_cr_instruction` | pytest のテスト関数 | スタブ不要 ── 純粋 |
| `test_change_requests_api.py`(`test_option_routes` の 102-2 の分) | ルート `create_change_request`・`update_change_request`・`decide_change_request` | pytest のテスト関数(ルートを直接呼ぶ) | SQLite のセッションと fixture |

- 作成で案を保存し、詳細に番号・呼び名・対象・おすすめを出す。案を送らなければ列は NULL。
- スキーマの規則(1件・理由の無いおすすめ)は 422。CR の対象に無い要件の案は `CR_OPTION_INVALID`。
- 更新: 案を直すと時系列に `options`、説明済みは下書きに戻る。対象を減らして案が外れると断る。送らなければ変えず、空の `items` で消える。
- 合意: 案を選ばない・無い番号は断る。選ぶと対象が差し替わり、前の対象と番号が時系列の行に残り、保存した予測の対象も選んだ案のもの。詳細の `decision.option`。
- 却下・案の無い CR では選べない。写しは案も写す。
- 反映の指示とたどる記録の合意の行に、選んだ案が出る。

下書きのモデル・`models/__init__.py`・リポジトリ・`trace.py`・`explanation.py` は、このテストが `app.models`・`app.change_requests` とサービスを通して import する(下書きの表は、SQLite のセッションが `Base.metadata` から作る)(#15)。
