# Phase-16-1: 外部設計書の API 一覧と、その表の読み取り(BE)

## この章の目的

外部設計書に「2.6 API一覧」(メソッド/パス/概要/関連画面)の節を書かせ、その表を決定的に読み取る純粋関数を作る。段階1(機能一覧)は、この表から機能グループの初期値を作り、AI の下書きに漏れた API を見つける。

学習モード([introduction](./Phase-16-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | 外部設計書のプロンプトに 2.6 API一覧、内部設計書のプロンプトに「2.6 と同じメソッド・パス」 |
| [`app/detailed_design/api_list.py`](../samples/backend/app/detailed_design/api_list.py) | 新規 | **コア** | `ApiEndpoint`、`extract_api_endpoints`、`parse_trigger`、`trigger_key`、`endpoint_key`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | `api_list.py` の公開名の re-export |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | **コア** | E2E 用の偽 LLM の外部設計書に 2.6 の表を含める |
| ── ここからテスト ── | | | |
| [`tests/unit/test_external_api_list.py`](../samples/backend/tests/unit/test_external_api_list.py) | 新規 | 定型 | 表の読み取り、プロンプトの文面、偽 LLM の外部設計書 |

## 要点の抜粋

```python
# app/services/doc_generator_service.py(外部設計書のプロンプトの末尾。両方のモードで同じ)
"## 2.6 API一覧\n"
"- 本システム自身が提供するAPIを、Markdownテーブル(メソッド/パス/概要/関連画面)で"
"すべて列挙する\n"
"- パスは`/api/v1/<リソース>`の形で書き、個別の対象は`{id}`のように波括弧で示す。"
"親リソースに属するものは`/api/v1/<親リソース>/{id}/<リソース>`とする\n"
"- 関連画面は2.2の画面IDで書く(複数は`/`区切り、画面が無いものは`—`)"
```

```python
# app/detailed_design/api_list.py
def endpoint_key(method: str, path: str) -> str:
    return f"{method.strip().upper()} {normalize_path(path)}"   # {id}・{project_id} は {} にそろえる

def extract_api_endpoints(markdown: str) -> list[ApiEndpoint]:
    section = extract_section(markdown, "2.6")                   # UML の節の切り出しを再利用
    ...  # 見出し行で「メソッド」「パス」の列を探し、行を ApiEndpoint にする(同じキーは1行目だけ)
```

`__init__.py` は `ApiEndpoint`・`endpoint_key`・`extract_api_endpoints`・`parse_trigger`・`trigger_key` を re-export する。依存の向きは「`app.detailed_design.api_list` → `app.uml.generation.sections`(節の切り出し)」だけで、DB も LLM も知らない。

## 設計判断

### 外部設計書に API 一覧を置く(両方のモード)

段階1の入力は外部設計書である(`STAGE_INPUTS[1]`)。しかし、それまでの外部設計書の 2.4 節は外部連携(Gemini など)だけで、自システムの API のパスはどこにも無かった。API 一覧は内部設計書 3.3 にあり、詳細設計モードは内部設計書を作らない。

実務でも、API 仕様は基本設計(外部設計)の成果物に置くことが多い。そこで外部設計書に 2.6 節を足した。ユーザーは両方のモードで出すことを選んだ。プロンプトをモードで分けずに済み、簡易ドキュメントモードの外部設計書も実務の形に近づく。

重なる内部設計書 3.3 の API 表は残し、「2.6 と同じメソッド・パスを使い、内部の担当(ルート・サービス)の観点で概要を書く」と一言足した。2つの表で同じ API が別の書き方になるのを防ぐためである。

### 表は見出しの名前で読み、照合のキーで比べる

- 列の位置は、見出しの「メソッド」「パス」を探して決める。AI が列の順を入れ替えても、余計な列を足しても読める。
- 照合のキーは、メソッドを大文字にし、パスの波括弧の中身を空にしたもの(`GET /api/v1/projects/{}`)。外部設計書が `{id}`、AI の下書きが `{project_id}` と書いても、同じ API として突き合わせられる。
- 2.6 節の外にある表(2.7 の表など)は読まない。`extract_section` で節を切り出してから探す。

### E2E 用の偽 LLM にも API 一覧を持たせる

偽 LLM は、プロンプトの見出し(`# 2. 外部設計書`)で文書を見分けて固定の応答を返す。外部設計書の応答に 2.6 の表を含めておくと、ブラウザの E2E でも段階1の照合が働く(16-4 の偽の下書きと API がそろう)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `extract_api_endpoints`・`parse_trigger`・`trigger_key`・`endpoint_key` | pytest | スタブ不要。文字列を受け取って値を返す純粋関数のため | 2.6 節だけを読む、重複は1行目、引数名と末尾の `/` の違いを吸収、API でないトリガー |
| 外部設計書・内部設計書のプロンプト | pytest | スタブ不要。定数のため | 2.6 の見出しと列、内部設計書の一言 |
| `E2eFakeLLM`(外部設計書の応答) | pytest | 偽 LLM そのものが対象(スタブではない) | 第一テストの統合スモーク(偽 LLM の外部設計書が表の読み取りを通る) |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_external_api_list.py tests/unit/test_doc_generator_service.py
# 28 passed
```
