# UML製図・レビュー・draw.io出力システム
## 要件定義書・外部設計書

- 文書バージョン: 1.0
- 作成日: 2026-09-27
- 想定実装環境: Next.js + TypeScript / FastAPI + Python
- 想定実装者: Claude Code
- 本文書の目的: AIが生成したUMLのたたき台をWeb上で高速にレビュー・修正し、承認後に同一のUMLモデルからdraw.io形式の成果物を生成するシステムの実装仕様を定義する。

---

# 1. 要件定義

## 1.1 目的

AIにUML図を直接draw.io XMLとして生成させるのではなく、UMLの意味構造を中間モデルとして生成し、そのモデルをWeb上で高速に可視化・レビューできるようにする。

ユーザーがレビュー・修正したUMLモデルを正として、最終的にdraw.io形式へ変換する。

### 基本方針

```text
AI
 ↓
UML Semantic Model
 ↓
Layout / Style
 ↓
React Flow Preview
 ↓
ユーザーによるレビュー・修正
 ↓
承認
 ↓
draw.io Generator
 ↓
.drawio
```

## 1.2 解決したい課題

AIに最初からdraw.io XMLを書かせる方式では、XML生成・検証・レイアウト調整を含めて処理時間が増加する。また、生成された図をユーザーが確認するまでに時間がかかる。

そのため、

- AIはUMLの意味構造を生成する
- プレビューはReact Flowで高速表示する
- ユーザーはプレビューを確認・修正する
- 承認後のみdraw.io XMLを生成する

という分離を行う。

## 1.3 対象ユーザー

主な利用者は、システム開発者、設計者、AIによる設計支援を利用するエンジニアとする。

## 1.4 スコープ

### Must

1. AIまたはAPIからUML Semantic Modelを受け取れる
2. UML ModelをJSONとして保持できる
3. UML ModelからReact Flow形式へ変換できる
4. Web画面上でUML図をプレビューできる
5. ノードをドラッグして配置を変更できる
6. クラス名・属性・メソッドを編集できる
7. クラス間の関連を表示できる
8. レビュー済みのUML Modelを保存できる
9. 承認操作ができる
10. 承認済みUML Modelからdraw.io XMLを生成できる
11. .drawioファイルとしてダウンロードできる
12. React Flowとdraw.ioで意味構造が一致する
13. レビュー時のノード位置をdraw.ioに反映する

### Should

1. 自動レイアウト
2. UML Modelのバリデーション
3. undo / redo
4. モデルのバージョン管理
5. SVG / PNG / PDF出力
6. 設計ビューに応じた複数の図記法への対応
7. draw.io生成前の変換結果検証

### Could

1. AIによるレビュー修正提案
2. 差分表示
3. 複数人編集
4. Figma等への出力
5. PPTX出力

### Won't

初期バージョンでは以下を対象外とする。

- draw.ioエディタそのものの完全再現
- PowerPointを主要なUML編集形式とすること
- AIに直接draw.io XML全体を生成させること

## 1.5 機能要件

### FR-001 設計モデル生成

AIまたは外部処理から設計モデルを受け取る。

本システムは「クラス図を必ず生成する」ことを要件としない。
実装方式や設計内容に応じて、必要な設計ビューと図記法を選択できる構造とする。

設計ビューは少なくとも以下を扱えるようにする。

- 振る舞い・処理フロー
- 実行時の処理連携
- システム構造
- データ構造

図記法の例:

- アクティビティ図: 振る舞い・処理フロー
- シーケンス図: 実行時の処理連携
- クラス図: オブジェクト指向の構造
- コンポーネント図: システム/サービス/モジュールの構造
- ER図: リレーショナルデータの構造

入力には少なくとも以下を含む。

- 設計ビューの種類
- 図記法の種類
- ノード
- ノードID
- ノード間の関係
- 図記法に応じた属性

### FR-002 UML Model管理

UML Modelをシステムの正規データとして扱う。

React Flowの内部データやdraw.io XMLを正規データにはしない。

Single Source of TruthはUML Modelとする。

### FR-003 React Flow変換

UML ModelをReact Flowのnodes / edgesへ変換する。

### FR-004 UMLプレビュー

ユーザーはWeb画面上で生成されたUMLを確認できる。

### FR-005 ノード配置編集

ユーザーはノードをドラッグして位置を変更できる。

変更された座標はUML ModelのLayout Modelへ反映する。

### FR-006 図要素編集

ユーザーは選択した図記法に応じて図要素を編集できる。

クラス図の場合:

- クラス名
- 属性
- メソッド
- 可視性
- 関係

コンポーネント図の場合:

- コンポーネント名
- 提供インターフェース
- 依存関係
- 接続

アクティビティ図の場合:

- アクション
- 分岐
- 開始/終了
- フロー

シーケンス図の場合:

- アクター/ライフライン
- メッセージ
- 呼び出し関係

ER図の場合:

- エンティティ
- 属性
- 主キー
- 外部キー
- カーディナリティ

### FR-007 自動レイアウト

初期生成時に自動レイアウトを適用できる。

レイアウトエンジンはELK.jsまたはDagreを候補とする。

レイアウト結果はUML Modelへ保存する。

### FR-008 バリデーション

UML Modelに対して以下を検証する。

- ID重複
- 存在しないノードへの参照
- 不正な関係種別
- 必須項目欠落
- 不正な座標
- 不正なデータ型

### FR-009 レビュー状態

図に以下の状態を持たせる。

```text
draft
reviewing
approved
exported
```

### FR-010 承認

ユーザーが内容を確認した後、UML Modelをapprovedへ変更する。

### FR-011 draw.io生成

approved状態のUML Modelからdraw.io XMLを生成する。

### FR-012 draw.io出力

生成したXMLを`.drawio`ファイルとしてダウンロード可能にする。

### FR-013 レイアウト再現

React Flowレビュー時に確定した座標をdraw.io側のgeometryへ反映する。

### FR-014 意味構造再現

以下をReact Flowとdraw.ioで一致させる。

- ノードID
- クラス名
- 属性
- メソッド
- 関係
- 関係種別
- 多重度
- 配置座標

### FR-015 設計ビュー選択

AIは要件・アーキテクチャ・実装方式をもとに、実装者が設計を理解するために必要な設計ビューを選択する。

図の種類は固定せず、以下のような判断を行う。

| 設計ビュー | 主な図記法 | 主な目的 |
|---|---|---|
| 振る舞い・処理フロー | アクティビティ図 | 業務・処理の流れを理解する |
| 実行時の処理連携 | シーケンス図 | 実行時の呼び出し・連携を理解する |
| システム構造 | クラス図 / コンポーネント図 / モジュール図 | ソフトウェアの責務・依存関係を理解する |
| データ構造 | ER図 | 永続化データの構造・関連を理解する |

クラス図はオブジェクト指向システムの場合に選択する。
オブジェクト指向を前提としないシステムでは、クラス図を必須とせず、コンポーネント図やモジュール図など適切な構造図を選択する。

### FR-016 設計図の整合性

複数の設計図を生成する場合、各図を独立した情報源として扱わず、共通の設計モデルから生成できる構造とする。

例えば、

- アクティビティ図の処理
- シーケンス図の呼び出し
- 構造図の責務・依存関係
- ER図のデータ

が相互に矛盾しないことを検証可能とする。

## 1.6 非機能要件

### NFR-001 レスポンス性能

AIによるdraw.io XML生成をプレビュー処理に使用しない。

UML ModelからReact Flowへの変換はローカルまたはサーバー側で高速に実行できる構成とする。

### NFR-002 再現性

同一UML Modelと同一Layout Modelから生成したdraw.ioは、意味構造と配置が同一になること。

### NFR-003 保守性

以下の責務を分離する。

- UML Domain Model
- React Flow Adapter
- Layout Engine
- draw.io Generator
- Validation
- Persistence

### NFR-004 拡張性

将来的に以下を追加できる設計とする。

- SVG
- PNG
- PDF
- PPTX
- その他UML図
- AIレビュー

### NFR-005 AI依存性の分離

AIモデルをUML描画ロジックから分離する。

AIモデルを変更してもUML Rendererやdraw.io Generatorを変更せずに済む設計とする。

---

# 2. 外部設計

## 2.1 システム構成

```text
┌──────────────────────────────────────────┐
│                  Browser                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │          Next.js Application       │  │
│  │                                    │  │
│  │  UML Editor / Review UI            │  │
│  │          │                         │  │
│  │          ▼                         │  │
│  │      React Flow                    │  │
│  └──────────────┬─────────────────────┘  │
└─────────────────┼────────────────────────┘
                  │
                  │ API
                  ▼
┌──────────────────────────────────────────┐
│                 FastAPI                  │
│                                          │
│  UML Domain                              │
│  ├── Semantic Model                      │
│  ├── Layout Model                        │
│  ├── Style Model                         │
│  ├── Validator                           │
│  └── Exporter                            │
│       └── draw.io Generator              │
└──────────────────────────────────────────┘
```

## 2.2 設計モデルの責務分離

本システムは「UML図そのもの」を正規データとするのではなく、設計情報を表す共通のDesign Modelを正規データとする。

```text
Design Document
│
├── Design View
│   ├── Behavior / Flow
│   ├── Interaction
│   ├── Structure
│   └── Data
│
├── Semantic Model
│   ├── Element
│   ├── Relation
│   └── Diagram-specific properties
│
├── Layout Model
│   ├── x
│   ├── y
│   ├── width
│   └── height
│
└── Style Model
    ├── font
    ├── border
    ├── background
    └── text
```

Semantic Modelは「何を表すか」、Layout Modelは「どこに配置するか」、Style Modelは「どう見せるか」を表す。

図記法固有のモデルはSemantic Modelの拡張として扱う。

```text
Design Model
 ├── Activity Model
 ├── Sequence Model
 ├── Structure Model
 │    ├── Class Model
 │    ├── Component Model
 │    └── Module Model
 └── Data Model
      └── ER Model
```

これにより、オブジェクト指向ではないシステムでもクラス図を強制せず、適切な構造図を選択できる。

## 2.3 設計JSONモデル

初期実装では、図記法を固定せず、以下のような共通メタデータを持つ構造を基準とする。

```json
{
  "id": "diagram-001",
  "view": "structure",
  "notation": "component",
  "version": 1,
  "status": "draft",
  "elements": [
    {
      "id": "api",
      "name": "API Server",
      "kind": "component"
    },
    {
      "id": "db",
      "name": "PostgreSQL",
      "kind": "component"
    }
  ],
  "relations": [
    {
      "id": "relation-001",
      "source": "api",
      "target": "db",
      "type": "dependency"
    }
  ],
  "layout": {
    "api": {
      "x": 100,
      "y": 100,
      "width": 220,
      "height": 120
    },
    "db": {
      "x": 500,
      "y": 100,
      "width": 220,
      "height": 120
    }
  }
}
```

実装時はPydanticモデルとして型定義する。

## 2.4 画面構成

### 設計図レビュー画面

```text
┌─────────────────────────────────────────────────────┐
│ UML Review                              [承認] [出力] │
├───────────────┬─────────────────────────────────────┤
│ ツール        │                                     │
│               │                                     │
│ [Element]     │                                     │
│ [Relation]    │        React Flow Canvas            │
│               │                                     │
│               │        ┌────────────┐               │
│               │        │   User     │               │
│               │        └─────┬──────┘               │
│               │              │                      │
│               │        ┌─────▼──────┐               │
│               │        │   Order    │               │
│               │        └────────────┘               │
│               │                                     │
├───────────────┴─────────────────────────────────────┤
│ 選択要素: API Server                               │
│ 図記法に応じたプロパティ / Relation                │
└─────────────────────────────────────────────────────┘
```

### 画面上の主な操作

- ノード選択
- ノード移動
- ノード追加
- ノード削除
- クラス編集
- 属性編集
- メソッド編集
- 関係編集
- 自動レイアウト
- Undo
- Redo
- 保存
- 承認
- draw.io出力

## 2.5 データフロー

### AI生成

```text
要件・設計情報
      ↓
AI
      ↓
UML Semantic Model
      ↓
Validation
      ↓
Auto Layout
      ↓
UML Document
```

### プレビュー

```text
UML Document
      ↓
React Flow Adapter
      ↓
nodes / edges
      ↓
React Flow
```

### ユーザー編集

```text
React Flow
      ↓
User Action
      ↓
UML Model Update
      ↓
Validation
      ↓
保存
```

### draw.io出力

```text
Approved UML Document
      ↓
Validation
      ↓
draw.io Generator
      ↓
draw.io XML
      ↓
.drawio download
```

## 2.6 API設計

### POST /api/uml/diagrams

UML図を作成する。

Request:

```json
{
  "view": "structure",
  "notation": "component",
  "model": {}
}
```

Response:

```json
{
  "id": "diagram-001",
  "status": "draft",
  "model": {}
}
```

### GET /api/uml/diagrams/{id}

UML図を取得する。

### PUT /api/uml/diagrams/{id}

UML Model全体を更新する。

### POST /api/uml/diagrams/{id}/validate

UML Modelを検証する。

### POST /api/uml/diagrams/{id}/layout

自動レイアウトを実行する。

### POST /api/uml/diagrams/{id}/approve

UML図を承認する。

承認前にValidationを実行し、エラーが存在する場合は承認不可とする。

### POST /api/uml/diagrams/{id}/export/drawio

approved状態のUML Modelからdraw.io XMLを生成する。

Responseはファイルダウンロードとする。

## 2.7 React Flow Adapter

React Flowは図記法に依存しない描画・編集UIとして使用する。

```text
Design Model
    ↓
toReactFlow()
    ↓
ReactFlowNode[]
ReactFlowEdge[]
```

編集後は、

```text
ReactFlow state
    ↓
fromReactFlow()
    ↓
Design Model
```

としてDesign Modelへ反映する。

図記法固有の編集項目は、Elementのkind / propertiesに応じてUIを切り替える。

ただし、React Flow固有のプロパティをUML Domain Modelに混入させない。

## 2.8 Layout Engine

自動レイアウトはDomain ModelのSemantic情報を利用して座標を計算する。

候補:

- ELK.js
- Dagre

初期実装ではどちらか一方を採用する。

レイアウト結果:

```text
node id
x
y
width
height
```

をLayout Modelへ保存する。

## 2.9 draw.io Generator

draw.io GeneratorはUML Modelからdraw.io XMLを決定的に生成する。

```text
UML Model
  ├── Semantic
  ├── Layout
  └── Style
        ↓
DrawioGenerator
        ↓
mxGraph XML
```

GeneratorはAIを呼び出さない。

同一入力に対して可能な限り同一XMLを生成できるよう、ID生成・要素順序・座標計算を決定的にする。

## 2.10 エラー処理

### UML Validation Error

例:

```json
{
  "code": "INVALID_RELATION_TARGET",
  "message": "Relation target does not exist.",
  "path": "relations[0].target"
}
```

### Export Error

draw.io生成時にエラーが発生した場合、ダウンロードを実行せずエラーを画面表示する。

### 承認エラー

Validation Errorが存在する場合、

```text
draft / reviewing
        ↓
   validation NG
        ↓
     approve不可
```

とする。

## 2.11 状態遷移

```text
draft
  │
  ▼
reviewing
  │
  │ approve
  ▼
approved
  │
  │ export
  ▼
exported
```

ユーザーがapproved後に編集した場合は、再びreviewingへ戻す。

```text
approved
   │
   │ edit
   ▼
reviewing
```

## 2.12 再現性要件

再現性は以下の3段階で定義する。

### Level 1: Semantic Reproducibility

React Flowとdraw.ioで、選択された図記法に対応する意味構造が一致すること。

共通:

- ノード/要素
- ノード/要素ID
- 関係
- 関係種別

図記法固有:

- クラス図: クラス名、属性、メソッド、多重度
- コンポーネント図: コンポーネント、インターフェース、依存関係
- アクティビティ図: アクション、分岐、フロー
- シーケンス図: ライフライン、メッセージ、呼び出し
- ER図: エンティティ、属性、主キー、外部キー、カーディナリティ

### Level 2: Layout Reproducibility

以下が一致すること。

- x
- y
- width
- height

### Level 3: Visual Reproducibility

フォントや線幅などのレンダリング差異を除き、可能な限り同じ見た目になること。

完全なピクセル単位一致は必須要件としない。

## 2.13 セキュリティ

- AI APIキーはフロントエンドに公開しない
- draw.io生成処理はサーバー側で実行可能な設計とする
- 入力されたXMLやJSONを無検証でHTMLへ挿入しない
- APIでUML Modelの所有者を検証する
- ファイル名をユーザー入力から直接生成しない
- XML生成時に不正なXML文字列を適切にエスケープする

## 2.14 設計ビューと図記法の選択方針

本システムは「UML図を生成すること」自体を目的とせず、「人間が設計を理解し、実装・保守できる情報を適切な図で表現すること」を目的とする。

### 必須の設計ビュー

1. 振る舞い・処理フロー
   - 原則: アクティビティ図
2. 実行時の処理連携
   - 原則: シーケンス図
3. システム構造
   - OOP: クラス図
   - 非OOP / サービス指向 / レイヤード構成: コンポーネント図またはモジュール図
4. データ構造
   - リレーショナルDB: ER図

### 図の選択ルール

```text
実装方式・アーキテクチャ
          │
          ├── OOP
          │     └── Class Diagram
          │
          ├── Layered / Procedural
          │     └── Component / Module Diagram
          │
          ├── Microservices
          │     └── Component Diagram
          │
          ├── Event Driven
          │     └── Component Diagram + Event Flow
          │
          └── Relational Data
                └── ER Diagram
```

AIは要件定義・アーキテクチャ・実装方式を分析して必要な設計ビューを選択する。

ただし、設計者が図の種類を明示的に指定した場合は、その指定を優先する。

## 2.14 実装方針

Claude Codeによる実装では、以下の順序を推奨する。

### Phase 1

UML Domain Model + Pydantic Schema

### Phase 2

React Flow Preview

### Phase 3

React FlowからUML Modelへの編集反映

### Phase 4

Validation

### Phase 5

自動レイアウト

### Phase 6

draw.io Generator

### Phase 7

承認・出力フロー

### Phase 8

テスト・再現性検証

## 2.15 テスト方針

最低限、以下をテストする。

### Unit Test

- UML Model validation
- React Flow adapter
- Layout conversion
- draw.io XML generation
- XML escaping
- ID generation

### Integration Test

```text
UML Model
 ↓
React Flow
 ↓
編集
 ↓
UML Model
 ↓
draw.io
```

の一連の変換を検証する。

### Snapshot Test

同一UML Modelから生成されるdraw.io XMLについて、不要な差分が発生しないことを検証する。

### Acceptance Test

以下を満たすこと。

1. AI生成UMLがWeb上に表示される
2. ユーザーがノード位置を変更できる
3. ユーザーがクラス情報を変更できる
4. 変更結果がUML Modelへ反映される
5. Validationに成功する
6. 承認できる
7. draw.ioをダウンロードできる
8. draw.ioで開いた図の意味構造がレビュー画面と一致する
9. レビュー画面の配置がdraw.ioへ反映される

---

# 3. Claude Codeへの実装上の重要な制約

1. React Flowのnodes / edgesを永続化データの正規形式にしない。
2. draw.io XMLをAIに直接生成させない。
3. UML Domain ModelをSingle Source of Truthとする。
4. React Flow Adapterとdraw.io Generatorを独立したAdapterとして実装する。
5. draw.io GeneratorはAI APIを呼び出さない。
6. Semantic Model / Layout Model / Style Modelを分離する。
7. 自動レイアウトの結果はUML Modelへ保存する。
8. ユーザーが手動変更した座標は自動レイアウトで勝手に上書きしない。
9. approved状態のモデルだけをdraw.io出力対象とする。
10. 同じUML Modelから同じ意味構造・配置が再現できることをテストする。
11. UML Domain ModelにReact Flow固有型やdraw.io固有型を直接持ち込まない。
12. 将来的なSVG / PDF / PNG / PPTX出力を追加できるAdapter構造にする。
13. 初期実装では少なくともstructure viewのcomponent notationを実装対象とし、class / activity / sequence / ERなどを追加できる拡張可能な設計にする。クラス図を全システムの必須図としない。
14. 実装前に既存プロジェクトの構成・技術スタック・コーディング規約を確認し、既存設計を破壊しない。
15. 大規模な一括実装ではなく、Phase単位で実装・テストし、各Phase完了時点で動作確認可能な状態を維持する。

---

# 4. 配置方針・文書反映方式の決定(2026-09-27)

本章は、上記1〜3章のコンセプトを「devex本体(4文書自動生成AIチャットアプリ)完了後の後続機能」としてどう位置づけるかを、着手前に確定した内容の記録である。1〜3章の内容そのものは変更しない。

## 4.1 前提: 本コンセプトに無い追加要件

devex本体には既に「AIヒアリング→要件定義/外部設計/内部設計/実装計画の4文書生成」という機能があり(`docs/requirements.md`等、`generated_documents`テーブル)、本システムはこの4文書を入力として使う。コンセプト文書1〜3章には無い、devex側から見た追加要件として以下がある。

> 4つのドキュメント → drawio → ユーザー手直し → 本プロジェクトでドキュメントに反映する

すなわち、draw.io出力(2.9節・FR-011/012)で終わりにせず、レビュー・承認済みのUMLモデルの内容を**devexが持つ4文書自体にも書き戻す**、双方向の連携を持たせる。

## 4.2 決定事項

### (1) 配置方針: devex本体のリポジトリ内に新規モジュールとして追加する

`devex-api`/`devex-ui`とは別の独立リポジトリを新設する案、この2リポジトリと同じ`devex/`ディレクトリ直下に第3の独立リポジトリ(`devex-uml`等)を追加する案も検討したが、**既存の`devex-api`/`devex-ui`内に新規モジュールとして追加する方針**を採用する。

理由:

- 4.1節の双方向連携(4文書→drawio→反映)が要件の中核であり、devexの`generated_documents`(doc_type/content/version)・`projects`(所有権・ステータス)・既存のJWT認証をそのまま再利用できることが決定的に大きい。別リポジトリ・別サービスにした場合、この連携のためだけにエクスポート/インポート専用APIと認証の橋渡しを新設する必要があり、実益に対してコストが見合わない。
- `devex-api`/`devex-ui`は元々「devex固有機能」と「汎用スターターテンプレート機能」が同居する構成であり(`CLAUDE.md`「Repository structure」節)、UML/drawioモジュールを他から疎に保った新規パッケージとして追加しても、既存の混在方針と矛盾しない。
- レイヤー構成(`routes→services→repositories→models`、フロントは`src/features/<name>/`)がそのまま新モジュールにも適用でき、既存のdocker compose環境・検証フロー(pytest/vitest/pyright/tsc)を素通りで使える。

### (2) 文書への反映方式: 該当セクションを構造化データから再生成し、Markdownを置き換える

「反映する」の実現方式として、(a) 該当セクションを構造化データ(UML Semantic Model)から再生成してMarkdownを置き換える方式、(b) 文書内にdraw.io図への参照・埋め込みリンクを追記するだけに留める方式、を比較検討し、**(a) 再生成・置換方式**を採用する。

理由: (b)は実装が軽いが、文書本文とUML図の記述が二重管理になり、どちらが最新か分からなくなる恐れがある。(a)はUML Semantic ModelをSingle Source of Truthとする本コンセプトの原則(3章の制約3)と一貫しており、文書側の記述とUMLモデルの内容的な一致を機械的に保てる。

## 4.3 推奨モジュール構成

3章の実装制約(UML Domain ModelをSingle Source of Truthにする、React Flow AdapterとdrawIO Generatorを独立させる、等)は維持しつつ、devex固有の資産に接続する形へ落とし込む。

### バックエンド(`devex-api/backend/app/uml/`)

既存レイヤーの外側に独立した新規パッケージとして追加する(既存の`app/services/chat_service.py`等とは疎結合)。

- `app/uml/domain/` ── Semantic Model / Layout Model / Style ModelのPydantic定義(2.2〜2.3節)。図記法固有モデル(Class/Component/Activity/Sequence/ER)はここの拡張として定義。
- `app/uml/adapters/react_flow.py` ── `toReactFlow()`/`fromReactFlow()`相当。バックエンドでnodes/edges形状への変換まで担うか、フロント側に閉じるかは実装時に決定する(本コンセプトはフロント側変換(2.7節)を想定しているため、バックエンドはSemantic ModelのCRUDのみを担う設計が素直)。
- `app/uml/layout/` ── 自動レイアウト。ELK.js/DagreはいずれもJS実装のため、Python(FastAPI)側で完結させる場合はフロントエンド側で計算しAPIへ結果だけ送るか、Pythonの代替ライブラリを探すか、Node子プロセスを呼ぶかの判断が必要(4.4節「未決定事項」参照)。
- `app/uml/export/drawio.py` ── draw.io Generator(AIを呼ばない、決定的なXML生成。2.9節の制約どおり)。
- `app/uml/sync/document_writer.py` ── **新規**、4.1節「反映」機能の核。UML Model + 対象`doc_type` + 対象セクション識別子を受け取り、`GeneratedDocumentRepository.create_version`を呼んで新バージョンを作成する(devex既存のバージョニング方針: 直近3件保持、をそのまま踏襲)。
- `app/models/uml_diagram.py`・新規Alembic migration ── `uml_diagrams`テーブル(project_id FK、view/notation、semantic_model/layout_model/style_modelのJSONB、status(draft/reviewing/approved/exported)、対象doc_type + セクションアンカーの参照)。
- `app/api/routes/uml.py` ── `/api/v1/projects/{project_id}/uml/diagrams/...`(2.6節の`/api/uml/diagrams`をプロジェクトスコープ配下へ変更し、devex既存の`CurrentProjectDep`で所有権チェックを再利用する)。

### フロントエンド(`devex-ui/src/features/uml/`)

- `components/UmlCanvas.tsx` ── React Flowを用いたレビュー画面(2.4節)。
- `adapters/reactFlowAdapter.ts` ── Semantic Model ⇄ React Flow nodes/edgesの変換(`fromReactFlow`/`toReactFlow`)。
- `api/umlApi.ts` ── devex既存の`apiFetch`を使ったCRUD・validate・layout・approve・exportエンドポイント呼び出し。
- `app/projects/[id]/uml/page.tsx` ── 新規画面。devex既存の`RequireAuth`・ダッシュボードからの導線に合流。
- **要検証**: React Flow(`@xyflow/react`)がNext.js 16.2.12 + React 19.2.4 + Tamagui 2.6の組み合わせで問題なく動くか(Tamagui併用によるコンテキスト分離問題は`devex-ui/CLAUDE.md`に前例があるため、同種の"use client"分離が必要になる可能性が高い)。着手前の小さな検証タスクとして先に潰す。

### 文書への反映(セクション置換方式)の実装イメージ

「UML図がどの文書のどのセクションに対応するか」の対応表(叩き台、4.4節1で確定させる):

| 設計ビュー | 主な図記法 | 対応する文書・セクション(想定) |
|---|---|---|
| システム構造 | クラス図/コンポーネント図 | `internal_design`「3.2 データモデル定義」「3.3 バックエンド処理・モジュール設計」 |
| データ構造 | ER図 | `internal_design`「3.2 データモデル定義」 |
| 実行時の処理連携 | シーケンス図 | `internal_design`「3.3 バックエンド処理・モジュール設計」または新設セクション |
| 振る舞い・処理フロー | アクティビティ図 | `external_design`「2.2 画面一覧・画面遷移フロー」 |

置換対象セクションの境界をテキスト検索(見出し文字列一致)だけで特定するのは壊れやすいため、devexの`doc_generator_service.py`が生成するMarkdownに**アンカーコメント**(例: `<!-- uml:diagram:<diagram_id>:start -->` 〜 `<!-- uml:diagram:<diagram_id>:end -->`)を仕込む方式を推奨する(具体的な文言は実装時に決定)。これにより`document_writer.py`は文字列全体を正規表現で握り潰す必要がなく、アンカー間だけを安全に置換できる。既存の4文書生成プロンプト(`doc_generator_service.py`の`_DOC_TYPE_PROMPTS`)へこのアンカーを含める改修が、devex側のCL開発手法でいう既存Phaseへの改訂(devexの`CLAUDE.md` #12)として発生する。

## 4.4 未決定事項(次回キックオフセッションで解消する)

本機能の教材・実装に着手する前に、以下5点をユーザーと確定させる。

1. **図記法↔文書セクションの対応表の確定**: 4.3節の対応表は叩き台であり、実際にどの図をどの文書のどのセクションに対応させるかを確定する必要がある。
2. **UML Semantic Modelの初期生成トリガー**: 4文書生成後に自動で全設計ビューを生成するのか、ユーザーが「UML図を生成する」ボタンを押した時点で生成するのか。後者がdevex既存の「ヒアリング完了→ユーザー承認→生成」という操作パターン(`docs/external_design.md` SCR-004)と一貫性がある。
3. **自動レイアウト実行環境**: ELK.js/DagreはNode.js実装のため、バックエンド(Python/FastAPI)で完結させる場合はフロントエンド側で計算しAPIへ結果だけ送るか、Pythonの代替レイアウトライブラリを探すか、Node子プロセスを呼ぶかの判断が必要。
4. **CL手法内でのPhase番号の割り当てと用語衝突の回避**: 本文書2.14節は独自に「Phase 1〜8」を定義しているが、これはdevex本体のCL開発手法が言う「Phase」(教材単位)とは別軸の概念であり、かつてはdevex側README.mdの「フェーズ1/フェーズ2」を「ステージ」へ改称した前例がある(devexの`textbook/decision-digest.md`参照)。本機能を実際にCL Phaseとして教材化する際は、本文書2.14節の「Phase 1〜8」をそのまま章番号に流用せず、devex本体のPhase番号(Phase 5の次、Phase 6〜)の中の作業単位(章)として再構成するか、別の呼称(「ステップ」等)に置き換える。
5. **承認済みUMLの再編集とdocsの再同期**: 2.11節は「approved後に編集するとreviewingへ戻る」状態遷移を定義しているが、reviewingへ戻った時点で既に反映済みの文書側のセクションをどう扱うか(古い内容のまま残す/再承認まで「反映待ち」の印を付ける等)は未検討。devexの`revising`状態導入の経緯(チャット再開時の類似論点)を参考にできる。

## 4.5 次のアクション

上記5点をユーザーと解消したうえで、devexの`CLAUDE.md` #27/#28に倣い「Phase 0相当の設計診断」を1章として行い(対応表の確定、レイアウト実行方式の決定、Phase番号の割り当てを含む)、それを踏まえてdevex本体の`docs/requirements.md`等にこの機能のMust/Should区分を追記してから、通常の`Phase<N>を開始する`トリガーで教材・サンプル生成に着手する。
