# Phase-10-2: LLM 出力スキーマとプロンプトの組み立て

## この章の目的

Gemini の構造化出力に渡す、UML 図生成専用の出力スキーマ(記法ごとに1つ)を定義する。あわせて、10-1 で抽出した節だけを入力にしてメッセージ列を組み立てる純粋関数を作る。Phase 9 からの申し送り「AI 生成は `layer` を埋める責務を持つ」は、出力スキーマで `layer` を必須にすることで果たす。

自動実装モード: on([introduction](./Phase-10-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/generation/schemas.py`](../samples/backend/app/uml/generation/schemas.py) | 新規 | **コア** | `ComponentGenerationOutput`/`ErGenerationOutput`/`DfdGenerationOutput` と、その部品(`GeneratedModule` ほか)、`GENERATION_SCHEMAS` |
| [`app/uml/generation/prompts.py`](../samples/backend/app/uml/generation/prompts.py) | 新規 | **コア** | `build_source_text`(記法ごとに渡す節を決める)・`build_generation_messages`(SystemMessage+HumanMessage)・`ExistingDataItem` |
| [`app/uml/generation/__init__.py`](../samples/backend/app/uml/generation/__init__.py) | 更新 | 定型 | 本章の担当分として、`schemas`・`prompts` の公開シンボルを re-export する |
| ── ここからテスト ── | | | |
| `tests/unit/test_uml_generation_prompts.py` | 新規 | **コア** | スキーマで layer が必須であること、記法ごとの入力の節、DFD で対象の処理と既存のデータ辞書が含まれること |

## 要点の抜粋

```python
# app/uml/generation/schemas.py
class GeneratedProcess(BaseModel):
    id: str
    name: str
    description: str = Field(description="入力をどう加工して出力にするかを1行で")
    layer: str = Field(description="処理を担当するモジュールの層(例: api, service, repository)…")

class GeneratedFlow(BaseModel):
    id: str
    source_id: str
    target_id: str
    data_item_name: str   # UUIDではなく名前で参照させる

class DfdGenerationOutput(BaseModel):
    data_items: list[GeneratedDataItem]
    processes: list[GeneratedProcess]
    external_entities: list[GeneratedNode]
    data_stores: list[GeneratedNode]
    flows: list[GeneratedFlow]

GENERATION_SCHEMAS: dict[NotationType, type[BaseModel]] = {
    "component": ComponentGenerationOutput, "er": ErGenerationOutput, "dfd": DfdGenerationOutput,
}
```

```python
# app/uml/generation/prompts.py
def build_source_text(notation, internal_design, *, dfd_subject=None, er_tables=None) -> str:
    # component: 3.1 + 3.3(処理別データフローの小節は除く)
    # er:        3.2(部分図なら選んだテーブルの見出しと本文だけ)
    # dfd:       3.2 + 対象の DF 節

def build_generation_messages(notation, internal_design, *, dfd_subject=None,
                              er_tables=None, data_items=()) -> list[BaseMessage]: ...
```

依存の向きは次のとおり。

- `prompts` → `sections`(10-1)・`app.uml.validation.structural.MAX_ELEMENTS`(Phase 8)・`app.uml.domain.NotationType`
- `schemas` → `app.uml.domain.NotationType` のみ

## 設計判断

### なぜドメインモデルをそのまま構造化出力に使わないのか

- **UUID を知り得ない**: `DfdFlow.data_item_id` は `data_items` テーブルの UUID を指す。LLM がこの値を生成することはできない。出力ではデータ項目を名前で参照させ、名前から UUID への解決はサービス層が行う(10-3・10-5)。
- **JSON Schema として不安定**: ドメインモデルは discriminated union(`notation`・`element_type`)と、`= []`・Literal の既定値を持つ。これらはエディタや API から読み書きするには便利だが、LLM に渡すスキーマとしては冗長で揺れやすい。出力スキーマは記法ごとにフラットにし、全項目を必須にした。DFD の要素は `processes`/`external_entities`/`data_stores` の3つのリストに分けて、判別フィールドを不要にした。
- **`layer` の必須/任意の違い**: ドメインでは、手動編集の途中でも保存できるように `layer` を Optional にしている(Phase 8)。AI 生成では必ず埋めてほしいので、出力スキーマでは必須にする。同じ「要素」でも、境界ごとに制約の強さを変えたいという要求があり、それがスキーマを分ける理由になる。

### なぜ出力スキーマを `app/schemas` に置かないか(Phase 10 完了後の相談で確認)

`app/schemas/generation.py` には、LLM の構造化出力のスキーマ(`HearingCompletionCheck`・`FinalAnswer`)の前例がある。それでも `app/uml/generation/` に置いた理由は次の2点である。

- **依存の向き**: `app/uml/` は、I/O を持たない UML の純粋ロジックを集めたパッケージで、外への依存は末端モジュールの `app.services.errors` だけにしている。出力スキーマを使うのは `prompts.py`・`mapper.py`・`failures.py`(いずれも `app/uml/generation/` の中)である。`app/schemas` に置くと、`app/uml` が外側の層に依存することになり、依存が「外側 → `app/uml`」の一方向ではなくなる。
- **API に出ない型**: `HearingCompletionCheck` は `projects.py` で API のレスポンスとしても使われるので、`app/schemas` に置くのが自然である。UML の出力スキーマは LLM とのやり取りの中だけで使う型で、API に出るのは変換後の意味モデルである。

md 側と uml 側でフォルダの分け方が違って見える点については、再整理をするかどうかを後の検討課題として記録した([`decision-digest.md`](../decision-digest.md)「Phase 10完了後」節)。

### プロンプトに何を書いたか

- **要素数の上限**: `MAX_ELEMENTS`(30)以内に収めるよう指示する。これを超えるとレイアウト(Phase 9)が実行前に拒否するため。
- **layer の語彙**: `api, service, repository, model, external` 等を例に挙げ、「同じ層には同じ文字列」を指示する。レーンは layer の文字列の一致で分かれるため(Phase 9 の `ranking.py`)。DFD の処理の layer も同じ語彙にすると、component 図と DFD でレーンの意味がそろう。
- **DFD の規則**: ストアと外部実体を直結しないこと、全処理に入出力を持たせることを指示する。M4 の DFD 規則(Phase 8)と同じ内容を、生成の段階で先に伝えておく。
- **既存のデータ辞書**: 名前とフィールドの一覧を渡し、同じ名前の再利用を指示する。データ辞書をプロジェクト共通にした狙い(診断8「図の共有による整合性」)を、生成の段階から効かせるため。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `GENERATION_SCHEMAS`・出力スキーマ | pytest | スタブ不要。Pydantic モデルの JSON Schema を確認するだけで、外部依存が無いため | `layer` が `required` に入っていること |
| `build_source_text`・`build_generation_messages` | pytest(直接呼び出し) | スタブ不要。対象が純粋で、LLM を呼ばずにメッセージを組み立てるだけのため | 渡す節・除く節、要素数上限の文言、既存データ辞書の書式 |

LLM を呼ぶ処理(サービス層)と、メッセージを組み立てる処理(本章)を分けたので、プロンプトの中身をスタブ無しで検証できる。
