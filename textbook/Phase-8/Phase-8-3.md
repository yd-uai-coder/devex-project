# Phase-8-3: バリデーション・サービス層

## この章の目的

M4(構造検証・DFD規則)を純粋関数として実装し、それを呼び出す形でCRUD・楽観ロック・生成トリガーのプレースホルダーを持つサービス層を実装する。`app/uml/validation/`はドメイン層と同じくDB・外部依存を持たない純粋パッケージとし、`app/services/`がDBアクセスとビジネスロジック(楽観ロック・名前一意性チェック)を担う。

自動実装モード: on([introduction](./Phase-8-introduction.md) 参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/validation/base.py`](../samples/backend/app/uml/validation/base.py) | 新規 | **コア** | `ValidationIssue`/`ValidationResult`(`POST .../validate`のレスポンス本体、例外ではなく値として結果を返す) |
| [`app/uml/validation/structural.py`](../samples/backend/app/uml/validation/structural.py) | 新規 | **コア** | 3notation共通の構造検証: ID重複・参照切れ・ノード数上限(目安30、診断3) |
| [`app/uml/validation/dfd_rules.py`](../samples/backend/app/uml/validation/dfd_rules.py) | 新規 | **コア** | 診断8のDFD規則5点のうち境界フロー一致を除く4点(未知のデータ項目参照・処理の入出力欠落・ストア/外部実体の直結禁止・未参照データ項目の警告) |
| [`app/uml/validation/__init__.py`](../samples/backend/app/uml/validation/__init__.py) | 新規 | **コア** | `validate_diagram`(notationに応じて構造検証+DFD規則を組み合わせるオーケストレータ) |
| [`app/services/data_item_service.py`](../samples/backend/app/services/data_item_service.py) | 新規 | **コア** | データ辞書のCRUDユースケース(名前一意性の事前チェック) |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 新規 | **コア** | UML図の生成(プレースホルダー)・取得・更新(楽観ロック+notation不変チェック)・検証実行 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_validation.py`](../samples/backend/tests/unit/test_uml_validation.py) | 新規 | **コア** | 構造検証・DFD規則それぞれの正常系/異常系、`validate_diagram`のnotation分岐 |
| [`tests/unit/test_data_item_service.py`](../samples/backend/tests/unit/test_data_item_service.py) | 新規 | **コア** | CRUD・名前重複時の`DataItemNameConflictError` |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 新規 | **コア** | 生成プレースホルダーのview導出・楽観ロックの成功/競合・検証実行時のデータ辞書連携 |

## 設計判断

### なぜ`ValidationResult`を例外ではなく戻り値にするか

`POST .../uml/diagrams/{id}/validate`は「検証を実行してその結果を返す」操作であり、検証エラーがあること自体はHTTPレベルの異常系ではない(承認可否の判定はPhase 12が`errors`の有無を見て行う)。既存の`AppError`体系(404/409等)は「リソースが見つからない」「状態が競合している」といったAPI呼び出し自体の失敗を表すためのものであり、意味モデルの中身の妥当性を表すのには意味が異なる。このため`app/core/errors.py`に422用の新規例外クラスを追加せず、常に200で`ValidationResult(errors=[...], warnings=[...])`を返す設計にした。

### なぜDFD規則の「境界フローが一致する」をこの章で実装しないか

[`Phase-8-introduction.md`](./Phase-8-introduction.md)「実装前の設計判断」で確定したとおり、`uml_diagrams`に上位図/下位図を結びつける列(`parent_diagram_id`/`level`)が無いため、この規則を機械的に判定する材料が無い。`validate_dfd_rules`のdocstringに、Phase 10への申し送りとその理由(列を先に追加しても実際の検証にはノード単位の対応情報が別途必要になり、手戻りリスクの方が大きいと判断したこと)を明記した。

### なぜ`UmlDiagramService.update`がnotationの変更を拒否するか

`UmlDiagramUpdate`スキーマは`semantic_model: SemanticModel`(discriminated union)を受け取るため、リクエストの`notation`フィールドの値次第でcomponent/er/dfdのどのモデルとしても解釈されてしまう。既存の図のnotationと異なるnotationのモデルで上書きされると、`view`(D5対応表で決まる)や、Phase 9以降のレイアウトエンジン・エクスポータがnotation別に持つ前提が崩れる。そのため`semantic_model.notation != diagram.notation`を`BadRequestError`(400)として明示的に拒否した。

### なぜ`DataItemService.create`/`update`が一意制約違反を`IntegrityError`任せにせず事前チェックするか

Phase 6-3の`ProjectService.create`(`template_id`検証)と同じ考え方。`data_items`テーブルの`UniqueConstraint(project_id, name)`だけに頼ると、違反時のDB例外(`IntegrityError`)がそのまま未捕捉の500として露出し、既存の`AppError`体系(`register_error_handlers`)を経由しない。`DataItemRepository.find_by_name`で事前に存在確認し、`DataItemNameConflictError`(409)として扱うことで、他のドメイン例外と同じ経路に統一した。

### 動作確認で見つかった落とし穴: `updated_at`の`MissingGreenlet`

`UmlDiagramService.update`/`DataItemService.update`は、ORMオブジェクトを直接ミューテートして`flush`/`commit`した直後に、そのオブジェクトを(ルーター層で)`XRead.model_validate(obj)`へ渡して`updated_at`を読み出す。`updated_at`は`onupdate=func.now()`というサーバー側計算値のため、UPDATE文を発行した後もPython側のオブジェクトはその新しい値を知らない。`expire_on_commit=False`でも、この「サーバー側計算のonupdate列」だけは`commit`後にSQLAlchemyが暗黙に未ロード状態として扱い、後続の同期アクセス(Pydanticの属性読み出し)で`MissingGreenlet`(非同期コンテキスト外でのIO試行)になる。対処: `commit`直後に`await self._session.refresh(diagram)`(`data_item`も同様)を呼び、DBが計算した`updated_at`を明示的に取り直してから返す。`create`(INSERT)側はRETURNING句で`created_at`/`updated_at`が即座に埋まるため、この対処は`update`(既存行のonupdate)のみに必要。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](./Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `validate_structure` | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(意味モデルのインスタンスを直接渡すのみ、DB・外部依存を一切呼ばない)なため | `test_uml_validation.py` |
| `validate_dfd_rules` | pytest(直接呼び出し) | スタブ不要 ── 同上 | `test_uml_validation.py` |
| `validate_diagram` | pytest(直接呼び出し) | スタブ不要 ── 同上(内部で呼ぶ`validate_structure`/`validate_dfd_rules`もいずれも純粋関数) | `test_uml_validation.py`。component/dfdでのnotation分岐を確認 |
| `DataItemService.create`/`update`/`delete` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため | `test_data_item_service.py` |
| `UmlDiagramService.create`/`get`/`update`/`validate` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── 同上。`validate`は内部で`app.uml.validation.validate_diagram`(純粋関数)を呼ぶがDBアクセスは自分自身が担う | `test_uml_diagram_service.py`。楽観ロックは正常更新(version+1)と競合(`UmlDiagramVersionConflictError`)の両方を確認 |
