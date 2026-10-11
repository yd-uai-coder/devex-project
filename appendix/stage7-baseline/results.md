# ステージ7のベースラインの結果

`measure.py` の出力(手で書き換えない)。読み方は [README](./README.md)。

## 要素の数

| 置き場 | 要素の数 |
|---|---|
| 簡易 doc:implementation_plan | 8 |
| 簡易 doc:requirements | 24 |
| 簡易 stage:8 | 8 |
| 詳細 doc:external_design | 7 |
| 詳細 doc:requirements | 25 |
| 詳細 stage:1 | 4 |
| 詳細 stage:2 | 4 |
| 詳細 stage:3 | 10 |
| 詳細 stage:4 | 12 |
| 詳細 stage:5 | 4 |
| 詳細 stage:6 | 4 |
| 詳細 stage:7 | 13 |
| 詳細 stage:8 | 5 |

位置で決まる ID(並べ替え・挿入でずれる):

- 手順の行(F-xx#n): 30
- 処理ロジックの表示 ID(L-NN): 4
- 作業単位(M-xx-Tyy): 5

## シナリオごとの比較

「示した / 当たり / 過剰 / 見落とし」。正解は人の判断(scenarios.py)。

| シナリオ | 正解 | 古い段階 | 今の仕組み | グラフ(直接) | グラフ(全部) | 処理を軸(試案) |
|---|---|---|---|---|---|---|
| S1 機能要件の変更(FR-011) | 6 | 1・2・3・4・5・6・7・8 | 56 / 5 / 51 / 1 | 3 / 2 / 1 / 4 | 27 / 6 / 21 / 0 | 9 / 5 / 4 / 1 |
| S2 非機能要件の変更(NFR-007) | 6 | 1・2・3・4・5・6・7・8 | 56 / 6 / 50 / 0 | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 6 |
| S3 推測の要件を「採用にする」(CON-002) | 0 | なし | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| S4 API の本文の変更(POST /api/v1/chats) | 6 | 1・2・3・4・5・6・7・8 | 56 / 6 / 50 / 0 | 1 / 0 / 1 / 6 | 25 / 6 / 19 / 0 | 7 / 4 / 3 / 2 |
| S5 処理の変更(段階1の F-03) | 10 | 2・3・4・5・6・7・8 | 52 / 10 / 42 / 0 | 10 / 8 / 2 / 2 | 32 / 10 / 22 / 0 | 12 / 10 / 2 / 0 |
| S6 テーブルの変更(段階3の documents) | 4 | 4・5・6・7・8 | 38 / 4 / 34 / 0 | 4 / 1 / 3 / 3 | 8 / 3 / 5 / 1 | 13 / 3 / 10 / 1 |
| S7 モジュールの改名(段階4の services/chat.py) | 6 | 5・6・7・8 | 26 / 5 / 21 / 1 | 6 / 6 / 0 / 0 | 12 / 6 / 6 / 0 | 8 / 6 / 2 / 0 |
| S8 簡易モード: WBS のタスクの変更(M-04-T01) | 1 | 8 | 8 / 1 / 7 / 0 | 2 / 1 / 1 / 0 | 7 / 1 / 6 / 0 | 2 / 1 / 1 / 0 |
| N1 テーブルの変更(段階3の references) | 4 | 4・5・6・7・8 | 38 / 4 / 34 / 0 | 2 / 1 / 1 / 3 | 4 / 3 / 1 / 1 | 7 / 3 / 4 / 1 |
| N2 機能要件の変更(FR-005) | 6 | 1・2・3・4・5・6・7・8 | 56 / 4 / 52 / 2 | 3 / 3 / 0 / 3 | 29 / 6 / 23 / 0 | 10 / 6 / 4 / 0 |
| N3 API の応答の変更(GET /api/v1/documents/{id}。キーはパスの変数を {} にそろえる) | 5 | 1・2・3・4・5・6・7・8 | 56 / 5 / 51 / 0 | 1 / 0 / 1 / 5 | 17 / 5 / 12 / 0 | 7 / 4 / 3 / 1 |
| N4 簡易モード: 機能要件の変更(FR-005) | 2 | 8 | 8 / 1 / 7 / 1 | 1 / 1 / 0 / 1 | 12 / 2 / 10 / 0 | 1 / 1 / 0 / 1 |

## 合計(S1〜S8)

正解の合計: 39

| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |
|---|---|---|---|---|
| 今の仕組み | 292 | 37 | 87% | 2 |
| グラフ(直接) | 26 | 18 | 31% | 21 |
| グラフ(全部) | 111 | 32 | 71% | 7 |
| 処理を軸(試案) | 51 | 29 | 43% | 10 |

## 合計(N1〜N4。試案の後に決めたシナリオ)

正解の合計: 17

| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |
|---|---|---|---|---|
| 今の仕組み | 158 | 14 | 91% | 3 |
| グラフ(直接) | 7 | 5 | 29% | 12 |
| グラフ(全部) | 62 | 16 | 74% | 1 |
| 処理を軸(試案) | 25 | 14 | 44% | 3 |

## 見落とし・過剰の中身

### S1 機能要件の変更(FR-011)

- 今の仕組みの見落とし: SCR-002
- グラフ(直接)の見落とし: LOGIC services/chat.py:ChatService.send_message, MOD clients/ai.py, PROC F-02, UNIT M-02-T01
- 処理を軸(試案)の見落とし: MOD clients/ai.py
- グラフ(全部)の過剰: API POST /api/v1/chats, CC HTTP, CC トランザクション, CC ログ, CC 例外, CRUD F-02×chats, DFD F-02, LOGIC services/document.py:DocumentService.generate_documents, LOGIC services/document.py:DocumentService.get_document, MOD api/routes/chats.py, MOD api/routes/documents.py, MOD repositories/chat.py, MOD services/chat.py, MOD services/document.py, PROC F-03, PROC F-04, TASK M-02-T01, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T01, UNIT M-03-T02

### S2 非機能要件の変更(NFR-007)

- グラフ(直接)の見落とし: CC 認証, MOD app.py, PROC F-02, PROC F-03, PROC F-04, UNIT M-01-T01
- グラフ(全部)の見落とし: CC 認証, MOD app.py, PROC F-02, PROC F-03, PROC F-04, UNIT M-01-T01
- 処理を軸(試案)の見落とし: CC 認証, MOD app.py, PROC F-02, PROC F-03, PROC F-04, UNIT M-01-T01

### S3 推測の要件を「採用にする」(CON-002)


### S4 API の本文の変更(POST /api/v1/chats)

- グラフ(直接)の見落とし: DFD F-02, LOGIC services/chat.py:ChatService.send_message, MOD api/routes/chats.py, MOD clients/ai.py, PROC F-02, UNIT M-02-T01
- 処理を軸(試案)の見落とし: MOD api/routes/chats.py, MOD clients/ai.py
- グラフ(全部)の過剰: CC HTTP, CC トランザクション, CC ログ, CC 例外, CRUD F-02×chats, F-02, LOGIC services/document.py:DocumentService.generate_documents, LOGIC services/document.py:DocumentService.get_document, MOD api/routes/documents.py, MOD repositories/chat.py, MOD services/chat.py, MOD services/document.py, PROC F-03, PROC F-04, TASK M-02-T01, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T01, UNIT M-03-T02

### S5 処理の変更(段階1の F-03)

- グラフ(直接)の見落とし: LOGIC services/document.py:DocumentService.generate_documents, UNIT M-03-T01
- グラフ(全部)の過剰: CC HTTP, CC トランザクション, CC ログ, CC 例外, LOGIC services/chat.py:ChatService.send_message, LOGIC services/document.py:DocumentService.get_document, LOGIC services/project.py:ProjectService.create_project, MOD api/routes/chats.py, MOD api/routes/projects.py, MOD repositories/document.py, MOD repositories/project.py, MOD services/chat.py, MOD services/project.py, PROC F-01, PROC F-02, PROC F-04, TASK M-01-T02, TASK M-02-T01, TASK M-03-T02, UNIT M-01-T02, UNIT M-02-T01, UNIT M-03-T02

### S6 テーブルの変更(段階3の documents)

- グラフ(直接)の見落とし: LOGIC services/document.py:DocumentService.generate_documents, MOD repositories/document.py, UNIT M-03-T01
- グラフ(全部)の見落とし: MOD repositories/document.py
- 処理を軸(試案)の見落とし: MOD repositories/document.py
- グラフ(全部)の過剰: CRUD F-03×documents, CRUD F-04×documents, LOGIC services/document.py:DocumentService.get_document, PROC F-04, UNIT M-03-T02

### S7 モジュールの改名(段階4の services/chat.py)

- 今の仕組みの見落とし: MOD api/routes/chats.py
- グラフ(全部)の過剰: CC HTTP, CC 例外, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T01, UNIT M-03-T02

### S8 簡易モード: WBS のタスクの変更(M-04-T01)

- グラフ(全部)の過剰: TASK M-05-T01, TASK M-06-T01, TASK M-06-T02, UNIT M-05-T01, UNIT M-06-T01, UNIT M-06-T02

### N1 テーブルの変更(段階3の references)

- グラフ(直接)の見落とし: LOGIC services/project.py:ProjectService.create_project, MOD repositories/reference.py, UNIT M-01-T02
- グラフ(全部)の見落とし: MOD repositories/reference.py
- 処理を軸(試案)の見落とし: MOD repositories/reference.py
- グラフ(全部)の過剰: CRUD F-01×references

### N2 機能要件の変更(FR-005)

- 今の仕組みの見落とし: API POST /api/v1/projects, SCR-001
- グラフ(直接)の見落とし: LOGIC services/project.py:ProjectService.create_project, PROC F-01, UNIT M-01-T02
- グラフ(全部)の過剰: CC HTTP, CC トランザクション, CC 例外, CRUD F-01×projects, CRUD F-01×references, DFD F-01, LOGIC services/document.py:DocumentService.generate_documents, LOGIC services/document.py:DocumentService.get_document, MOD api/routes/documents.py, MOD api/routes/projects.py, MOD repositories/project.py, MOD repositories/reference.py, MOD services/document.py, MOD services/project.py, PROC F-03, PROC F-04, TASK M-01-T02, TASK M-02-T01, TASK M-03-T01, TASK M-03-T02, UNIT M-02-T01, UNIT M-03-T01, UNIT M-03-T02

### N3 API の応答の変更(GET /api/v1/documents/{id}。キーはパスの変数を {} にそろえる)

- グラフ(直接)の見落とし: DFD F-04, LOGIC services/document.py:DocumentService.get_document, MOD api/routes/documents.py, PROC F-04, UNIT M-03-T02
- 処理を軸(試案)の見落とし: MOD api/routes/documents.py
- グラフ(全部)の過剰: CC HTTP, CC トランザクション, CC 例外, CRUD F-04×documents, F-04, LOGIC services/document.py:DocumentService.generate_documents, MOD repositories/document.py, MOD services/document.py, PROC F-03, TASK M-03-T01, TASK M-03-T02, UNIT M-03-T01

### N4 簡易モード: 機能要件の変更(FR-005)

- 今の仕組みの見落とし: TASK M-02-T01
- グラフ(直接)の見落とし: UNIT M-02-T01
- 処理を軸(試案)の見落とし: UNIT M-02-T01
- グラフ(全部)の過剰: TASK M-03-T01, TASK M-04-T01, TASK M-05-T01, TASK M-06-T01, TASK M-06-T02, UNIT M-03-T01, UNIT M-04-T01, UNIT M-05-T01, UNIT M-06-T01, UNIT M-06-T02

