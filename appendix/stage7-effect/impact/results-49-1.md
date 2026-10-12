# ステージ7の効果測定の結果(シナリオ)

`measure.py` の出力(手で書き換えない)。読み方は [README](./README.md)。

## 材料の確認

- 詳細: DB の段階1〜8 は stage6-effect の JSON と同じ(単位のキーを除く)
- 簡易: 内部設計書・実装計画書は model の無い版。md の解析から要素に要る欄だけの model を作った

## シナリオごとの比較

「示した / 当たり / 過剰 / 見落とし」。正解はベースラインのまま(付け直さない)。実装(印)の正解は、文書の要素を除いた数。

| シナリオ | 正解 | 今の仕組み | 処理を軸(試案) | 実装(たどり方) | 実装(印) | 候補A | 候補A〜D |
|---|---|---|---|---|---|---|---|
| S1 機能要件の変更(FR-011) | 6(印 5) | 56 / 5 / 51 / 1 | 9 / 5 / 4 / 1 | 9 / 5 / 4 / 1 | 7 / 4 / 3 / 1 | 9 / 5 / 4 / 1 | 6 / 5 / 1 / 1 |
| S2 非機能要件の変更(NFR-007) | 6(印 6) | 56 / 6 / 50 / 0 | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 6 | 2 / 2 / 0 / 4 | 2 / 2 / 0 / 4 |
| S3 推測の要件を「採用にする」(CON-002) | 0(印 0) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| S4 API の本文の変更(POST /api/v1/chats) | 6(印 6) | 56 / 6 / 50 / 0 | 7 / 4 / 3 / 2 | 7 / 4 / 3 / 2 | 7 / 4 / 3 / 2 | 7 / 4 / 3 / 2 | 6 / 5 / 1 / 1 |
| S5 処理の変更(段階1の F-03) | 10(印 10) | 52 / 10 / 42 / 0 | 12 / 10 / 2 / 0 | 12 / 10 / 2 / 0 | 12 / 10 / 2 / 0 | 12 / 10 / 2 / 0 | 12 / 10 / 2 / 0 |
| S6 テーブルの変更(段階3の documents) | 4(印 4) | 38 / 4 / 34 / 0 | 13 / 3 / 10 / 1 | 16 / 4 / 12 / 0 | 16 / 4 / 12 / 0 | 16 / 4 / 12 / 0 | 9 / 4 / 5 / 0 |
| S7 モジュールの改名(段階4の services/chat.py) | 6(印 6) | 26 / 5 / 21 / 1 | 8 / 6 / 2 / 0 | 6 / 6 / 0 / 0 | 6 / 6 / 0 / 0 | 6 / 6 / 0 / 0 | 6 / 6 / 0 / 0 |
| S8 簡易モード: WBS のタスクの変更(M-04-T01) | 1(印 1) | 8 / 1 / 7 / 0 | 2 / 1 / 1 / 0 | 1 / 1 / 0 / 0 | 1 / 1 / 0 / 0 | 1 / 1 / 0 / 0 | 1 / 1 / 0 / 0 |
| N1 テーブルの変更(段階3の references) | 4(印 4) | 38 / 4 / 34 / 0 | 7 / 3 / 4 / 1 | 9 / 4 / 5 / 0 | 9 / 4 / 5 / 0 | 9 / 4 / 5 / 0 | 5 / 4 / 1 / 0 |
| N2 機能要件の変更(FR-005) | 6(印 4) | 56 / 4 / 52 / 2 | 10 / 6 / 4 / 0 | 10 / 6 / 4 / 0 | 8 / 4 / 4 / 0 | 10 / 6 / 4 / 0 | 6 / 6 / 0 / 0 |
| N3 API の応答の変更(GET /api/v1/documents/{id}。キーはパスの変数を {} にそろえる) | 5(印 5) | 56 / 5 / 51 / 0 | 7 / 4 / 3 / 1 | 7 / 4 / 3 / 1 | 7 / 4 / 3 / 1 | 7 / 4 / 3 / 1 | 6 / 5 / 1 / 0 |
| N4 簡易モード: 機能要件の変更(FR-005) | 2(印 1) | 8 / 1 / 7 / 1 | 1 / 1 / 0 / 1 | 5 / 2 / 3 / 0 | 1 / 1 / 0 / 0 | 5 / 2 / 3 / 0 | 4 / 1 / 3 / 1 |

## 合計(S1〜S8)

正解の合計: 39(うち文書の要素 1)

| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |
|---|---|---|---|---|
| 今の仕組み | 292 | 37 | 87% | 2 |
| グラフ(直接) | 26 | 18 | 31% | 21 |
| グラフ(全部) | 111 | 32 | 71% | 7 |
| 処理を軸(試案) | 51 | 29 | 43% | 10 |
| 実装(たどり方) | 51 | 30 | 41% | 9 |
| 実装(印) | 49 | 29 | 41% | 9 |
| 候補A(横断事項に req_ids) | 53 | 32 | 40% | 7 |
| 候補A〜D | 42 | 33 | 21% | 6 |

## 合計(N1〜N4)

正解の合計: 17(うち文書の要素 3)

| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |
|---|---|---|---|---|
| 今の仕組み | 158 | 14 | 91% | 3 |
| グラフ(直接) | 7 | 5 | 29% | 12 |
| グラフ(全部) | 62 | 16 | 74% | 1 |
| 処理を軸(試案) | 25 | 14 | 44% | 3 |
| 実装(たどり方) | 31 | 16 | 48% | 1 |
| 実装(印) | 25 | 13 | 48% | 1 |
| 候補A(横断事項に req_ids) | 31 | 16 | 48% | 1 |
| 候補A〜D | 21 | 16 | 24% | 1 |

## 見落とし・過剰の中身(実装)

### S1 機能要件の変更(FR-011)

- 実装(たどり方)の見落とし: MOD clients/ai.py
- 実装(たどり方)の過剰: API POST /api/v1/chats, CRUD F-02×chats, DFD F-02, TASK M-02-T01
- 実装(印)の見落とし: MOD clients/ai.py
- 実装(印)の過剰: CRUD F-02×chats, DFD F-02, TASK M-02-T01
- 候補A〜Dの見落とし: MOD clients/ai.py
- 候補A〜Dの過剰: API POST /api/v1/chats
- 文書の要素の正解(印の対象外): SCR-002
- 差分で見つかった変わったもの: content req:FR-011

### S2 非機能要件の変更(NFR-007)

- 実装(たどり方)の見落とし: CC 認証, MOD app.py, PROC F-02, PROC F-03, PROC F-04, UNIT M-01-T01
- 実装(印)の見落とし: CC 認証, MOD app.py, PROC F-02, PROC F-03, PROC F-04, UNIT M-01-T01
- 候補A〜Dの見落とし: MOD app.py, PROC F-02, PROC F-03, PROC F-04
- 差分で見つかった変わったもの: content req:NFR-007

### S3 推測の要件を「採用にする」(CON-002)


### S4 API の本文の変更(POST /api/v1/chats)

- 実装(たどり方)の見落とし: MOD api/routes/chats.py, MOD clients/ai.py
- 実装(たどり方)の過剰: CRUD F-02×chats, F-02, TASK M-02-T01
- 実装(印)の見落とし: MOD api/routes/chats.py, MOD clients/ai.py
- 実装(印)の過剰: CRUD F-02×chats, F-02, TASK M-02-T01
- 候補A〜Dの見落とし: MOD clients/ai.py
- 候補A〜Dの過剰: F-02
- 差分で見つかった変わったもの: content api:POST /api/v1/chats

### S5 処理の変更(段階1の F-03)

- 実装(たどり方)の過剰: MOD repositories/document.py, MOD repositories/project.py
- 実装(印)の過剰: MOD repositories/document.py, MOD repositories/project.py
- 候補A〜Dの過剰: MOD repositories/document.py, MOD repositories/project.py
- 差分で見つかった変わったもの: content fn:F-03

### S6 テーブルの変更(段階3の documents)

- 実装(たどり方)の過剰: CRUD F-03×documents, CRUD F-03×projects, CRUD F-04×documents, DFD F-03, DFD F-04, F-03, F-04, LOGIC services/document.py:DocumentService.get_document, PROC F-04, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T02
- 実装(印)の過剰: CRUD F-03×documents, CRUD F-03×projects, CRUD F-04×documents, DFD F-03, DFD F-04, F-03, F-04, LOGIC services/document.py:DocumentService.get_document, PROC F-04, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T02
- 候補A〜Dの過剰: CRUD F-03×documents, CRUD F-04×documents, LOGIC services/document.py:DocumentService.get_document, PROC F-04, UNIT M-03-T02
- 差分で見つかった変わったもの: content table:documents

### S7 モジュールの改名(段階4の services/chat.py)

- 差分で見つかった変わったもの: rename module:services/chat.py

### S8 簡易モード: WBS のタスクの変更(M-04-T01)

- 差分で見つかった変わったもの: content task:M-04-T01

### N1 テーブルの変更(段階3の references)

- 実装(たどり方)の過剰: CRUD F-01×projects, CRUD F-01×references, DFD F-01, F-01, TASK M-01-T02
- 実装(印)の過剰: CRUD F-01×projects, CRUD F-01×references, DFD F-01, F-01, TASK M-01-T02
- 候補A〜Dの過剰: CRUD F-01×references
- 差分で見つかった変わったもの: content table:references

### N2 機能要件の変更(FR-005)

- 実装(たどり方)の過剰: CRUD F-01×projects, CRUD F-01×references, DFD F-01, TASK M-01-T02
- 実装(印)の過剰: CRUD F-01×projects, CRUD F-01×references, DFD F-01, TASK M-01-T02
- 文書の要素の正解(印の対象外): API POST /api/v1/projects, SCR-001
- 差分で見つかった変わったもの: content req:FR-005

### N3 API の応答の変更(GET /api/v1/documents/{id}。キーはパスの変数を {} にそろえる)

- 実装(たどり方)の見落とし: MOD api/routes/documents.py
- 実装(たどり方)の過剰: CRUD F-04×documents, F-04, TASK M-03-T02
- 実装(印)の見落とし: MOD api/routes/documents.py
- 実装(印)の過剰: CRUD F-04×documents, F-04, TASK M-03-T02
- 候補A〜Dの過剰: F-04
- 差分で見つかった変わったもの: content api:GET /api/v1/documents/{}

### N4 簡易モード: 機能要件の変更(FR-005)

- 実装(たどり方)の過剰: 実装:api:POST /api/v1/projects, 実装:df:DF-001, 実装:screen:SCR-001
- 候補A〜Dの見落とし: TASK M-02-T01
- 候補A〜Dの過剰: 実装:api:POST /api/v1/projects, 実装:df:DF-001, 実装:screen:SCR-001
- 文書の要素の正解(印の対象外): TASK M-02-T01
- 差分で見つかった変わったもの: content req:FR-005

## 追加の確認: 改名の後に下流の参照を直して承認する(S7 の続き)

段階4の改名を承認した後、段階5の手順の呼び出し先を新しいパスに直して段階5を承認したとき。

- content proc:F-02
- 印 logic:services/chat.py::ChatService.send_message
- 印 unit:U-003
