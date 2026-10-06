# Phase-12-1: 状態遷移(M7)を純粋関数に集め、承認 API を足す

## この章の目的

UML 図のレビュー状態(`uml_diagrams.status`)を、仕様どおり `draft → reviewing → approved → exported` と進める。Phase 8 で列は作ったが、値を変えるコードがどこにも無く、常に `draft` のままだった。

遷移の規則は `app/uml/domain/status.py` の純粋関数に集める。サービスは次の2点を担う。

- 保存と自動レイアウトの後に `reviewing` にする。
- 承認(`POST .../approve`)で、5つの条件を確かめてから `approved` にする。

`exported` への遷移は、出力 API と一緒に 12-4 で行う。

自動実装モード: on([introduction](./Phase-12-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/domain/status.py`](../samples/backend/app/uml/domain/status.py) | 新規 | **コア** | `DiagramStatus`、`parse_status`、`can_approve`/`can_export`、遷移先の定数 `STATUS_AFTER_EDIT`/`APPROVE`/`EXPORT` |
| [`app/uml/domain/__init__.py`](../samples/backend/app/uml/domain/__init__.py) | 更新 | 定型 | `status.py` の公開名を re-export する |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `UmlDiagramNotApprovableError`(409)、`UmlApprovalValidationFailedError`(400)、`UmlLayoutRequiredError`(400) |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlDiagramRead.status: DiagramStatus`、`UmlDiagramApprove {version}` |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `update`/`compute_layout` の後に `reviewing`。`approve` を新設。楽観ロックを `_ensure_version` に切り出し、配置の確認を `_ensure_layout_covers` に置く |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `POST /diagrams/{id}/approve` |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_diagram_status.py`](../samples/backend/tests/unit/test_uml_diagram_status.py) | 新規 | **コア** | 状態の並び、未知の値の拒否、状態ごとの承認・出力の可否 |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | **コア** | 保存・自動レイアウトで `reviewing`、`draft` からの承認、version を増やさないこと、5つの拒否条件 |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 更新 | 定型 | ルートが承認済みの図を返すこと、配置が無ければ 400 |

## 要点の抜粋

```python
# app/uml/domain/status.py
DiagramStatus = Literal["draft", "reviewing", "approved", "exported"]
DIAGRAM_STATUSES: tuple[DiagramStatus, ...] = get_args(DiagramStatus)

_APPROVABLE: frozenset[DiagramStatus] = frozenset({"draft", "reviewing"})
_EXPORTABLE: frozenset[DiagramStatus] = frozenset({"approved", "exported"})

def parse_status(value: str) -> DiagramStatus: ...     # DB の VARCHAR → Literal。未知の値は ValueError
STATUS_AFTER_EDIT: DiagramStatus = "reviewing"          # 保存・自動レイアウトの後
STATUS_AFTER_APPROVE: DiagramStatus = "approved"
STATUS_AFTER_EXPORT: DiagramStatus = "exported"         # 12-4 で使う
def can_approve(current: DiagramStatus) -> bool: return current in _APPROVABLE
def can_export(current: DiagramStatus) -> bool: return current in _EXPORTABLE
```

```python
# app/services/uml_diagram_service.py(approve)
diagram = await self._get_owned(project_id=project_id, diagram_id=diagram_id)
_ensure_not_generating(diagram)                        # 1. 生成中でない(409)
_ensure_version(diagram, expected_version)             # 2. 画面で見ていた版(409)
if not can_approve(parse_status(diagram.status)):      # 3. draft / reviewing(409)
    raise UmlDiagramNotApprovableError(...)
model = SemanticModelAdapter.validate_python(diagram.semantic_model)
_ensure_layout_covers(diagram, model)                  # 4. 全要素の配置がある(400)
validation_result = await self._validate_model(diagram, model)
if not validation_result.is_valid:                     # 5. 検証エラーが無い(400。警告は可)
    raise UmlApprovalValidationFailedError(f"検証エラーが{len(...)}件あるため承認できません")
diagram.status = STATUS_AFTER_APPROVE                  # version は増やさない
```

```python
# update / compute_layout の末尾(どちらも)
diagram.status = STATUS_AFTER_EDIT   # 承認済みの図を保存したら承認をやり直す(M7)
```

`app/uml/domain/__init__.py` は `status.py` の8つの名前を re-export する。依存の向きは次のとおりである。

- `status.py` は何にも依存しない。
- `schemas/uml_diagram.py` と `uml_diagram_service.py` は、`app.uml.domain` 経由で `status.py` を使う。

## 設計判断

### なぜ遷移の規則を純粋関数のモジュールに集めたか

遷移のきっかけは、保存・自動レイアウト・承認・出力・AI 再生成の5つの操作に散らばっている。各メソッドに `if diagram.status in (...)` を直接書くと、「どの状態で何ができるか」の一覧がコードのどこにも無くなる。`status.py` の冒頭の表が、その一覧の役を担う。

純粋関数にしたことで、規則そのものは DB 無しでテストできる(`test_uml_diagram_status.py` はスタブ不要)。サービスのテストは「規則を正しい順で呼んでいるか」だけを確かめればよい。

`status_after_edit(current)` のような関数にする案もあった。しかし、編集の後はどの状態からでも `reviewing` になるため、引数を受け取っても使わない関数になる。そのため定数にした。

### 承認を `draft` からも許した理由(ユーザー確定事項1)

仕様の矢印(`draft → reviewing → approved`)を文字どおり守ると、AI の出力が完璧でも、何かを保存しないと承認できない。「そのまま承認する」は正当な操作なので、`draft` からも許した。`reviewing` は「人が手を入れた」ことを表す状態、と読み替えている。

### 状態が変わっても version を増やさない理由

`version` は「意味モデルと配置という内容」の楽観ロックである。承認や出力は内容を変えないので、増やさない。

増やすと、承認した直後に同じ画面で保存したとき、画面が持つ version が古くなり、409 になってしまう。

逆に、承認では `version` を**確かめる**。他の人が保存した後の版を、古い画面のまま承認しないためである。

### 承認の条件に「全要素の配置がある」を入れた理由

承認した図は、次に出力(12-3・12-4)される。出力は座標が無いと描けないので、承認の時点で弾いておく。

配置の無い要素ができるのは、次のような場合である。

- 自動レイアウトの後に要素を追加し、座標を保存していない。
- AI で再生成した直後で、`layout_model` が null のまま。

FE は格子配置で座標を補ってから保存する(Phase 11-3)。そのため、画面から保存した図では、この条件は通常は満たされている。

### 検証エラーは件数だけを返す

`UmlApprovalValidationFailedError` のメッセージは件数だけを含む。エラーの一覧は、既存の `POST .../validate` が返す形(要素 id 付き)で FE の検証パネルに出したいので、FE が取り直す(12-5)。

エラーの共通形式(`{detail, code}`)に一覧を載せる新しい形は作らなかった。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `parse_status`・`can_approve`・`can_export` と遷移先の定数 | pytest(parametrize) | スタブ不要。入力の状態から真偽・値を返す純粋関数と定数のため | 4状態 × 承認/出力の表をそのまま検証する |
| `UmlDiagramService.approve`・`update`・`compute_layout` | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため(レイアウトは実エンジンで作る) | 承認できる図を作るヘルパー `_laid_out_diagram`(保存 → 自動レイアウト、version=2)を共有する |
| `approve_diagram`(ルート関数) | pytest(ルート関数を直接呼ぶ) | スタブ不要 | 正常系と、配置が無いときの 400 |

**規則(純粋)とその呼び出し(サービス)を分けたことが、スタブの要否に表れている**。規則の網羅は `test_uml_diagram_status.py` が DB 無しで行う。サービスのテストは「保存したら `reviewing`」「5つの条件の順序と例外の種類」という呼び出し側の責務だけを見る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_diagram_status.py tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py
# 51 passed(12-2・12-4 の追記分を含む最終状態での件数)
uv run ruff check app tests
# All checks passed!
uvx pyright
# 既知の1件(app/ai/llm/gemini.py の E2eFakeLLM)のみ
```
