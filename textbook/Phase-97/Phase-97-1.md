# Phase-97-1: 表示中の版の合意の状態の API

## この章の目的

Phase 91〜95 で、合意の記録(今の合意の一覧)・保護で戻した要素(版の `protection`)・要素の履歴の API ができた。だが「表示中の版のどの行が合意済みで、どの行が合意と違うか・まだ合意していないか」を答える API は無い。今の合意の一覧(`GET /agreements`)は合意済みの要素しか返さず、表示中の版の要素と並べるには中身の比べ方(`body_of`)を画面に持ち込むことになる。この章で、表示中の版の要素と今の合意を突き合わせる純粋関数と、それを返す API を足す。97-2 の画面(プレビューの「合意の状態」の枠)がこれを読む。

自動実装モード: on([introduction](./Phase-97-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/status.py`](../samples/backend/app/agreements/status.py) | 新規 | `element_states`・`restored_elements`・`CurrentAgreement`・`ElementStatus`・`RestoredElement`・`DocumentAgreementStatus`・`ELEMENT_STATE_LABEL` |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | 上の名前の re-export |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `AgreementService.status`・`_current_agreement` |
| [`app/schemas/agreement.py`](../samples/backend/app/schemas/agreement.py) | 更新 | `AgreementDocType`・`ElementStatusRead`・`RestoredElementRead`・`AgreementStatusRead`・`agreement_status_read` |
| [`app/api/routes/agreements.py`](../samples/backend/app/api/routes/agreements.py) | 更新 | `GET /projects/{id}/agreements/status?doc_type=` |
| [`tests/unit/test_agreement_status.py`](../samples/backend/tests/unit/test_agreement_status.py) | 新規 | 純粋関数 |
| [`tests/unit/test_agreement_status_service.py`](../samples/backend/tests/unit/test_agreement_status_service.py) | 新規 | サービス・ルート |

## 1. 4つの状態

```python
# app/agreements/status.py(抜粋)
ElementState = Literal["agreed", "differs", "unagreed", "missing"]

def element_states(items: Sequence[AgreedItem], agreements: Sequence[CurrentAgreement],
                   kinds: Collection[AgreedKind]) -> list[ElementStatus]
```

- 表示中の版の要素は `agreement_items`(Phase 91)で作る。合意の記録と同じキー・同じ並び(要件 → 利用者と使う場面 → 画面 → API → 外部連携)になる。
- 要素ごとに、今の合意(キーごとの最新の記録。外れたものは除く)を引き、`body_of`(Phase 91。キーの欄を除き、行の model で読み直して既定値をそろえた JSON)で比べる。
  - `agreed`: 同じ中身。
  - `differs`: 違う中身。保護は再生成の後に戻すので、ふつうの再生成の版では出ない。出るのは、CR の反映で合意を更新する前の版や、復元した古い版を表示しているとき、そして保護を入れる前(Phase 92 より前)に作った版である(開発 DB の「トレンド追跡アプリ」の v9 では、要件 FR-001・利用者・外部連携2件が「合意と違う」になった。Phase 90 の計測の再生成の揺れ)。
  - `unagreed`: 合意の記録が無い。CR で足した要素や、束の後に増えた要素。次の束で合意になる(Phase 93 の決定)。
- 今の合意にあって表示中の版に無い要素は、末尾に `missing` として足す。`kinds`(文書の種類が持つ要素の種類)で絞るので、要件定義書の状態に画面の合意は出ない。種類の対応表 `_DOCUMENT_KINDS` はサービスに既にあるので、純粋関数は種類を引数で受ける。
- 出どころの欄(`origin_label`・束の番号・CR の番号)は、合意の記録がある要素(`unagreed` 以外)だけが持つ。

## 2. 戻した要素の表示名

```python
def restored_elements(protection, items, agreements) -> list[RestoredElement]
```

- 版の `protection`(`[{key, reason}]`。Phase 92・93)はキーしか持たないので、表示名を付ける。表示中の版の要素 → 今の合意の記録 → キーそのもの、の順に引く。
- 列は JSON なので、知らない理由やキーの無い行は飛ばす(履歴の `_restored` と同じ構え)。

## 3. サービスとルート

```python
# app/services/agreement_service.py(抜粋)
async def status(self, project: Project, doc_type: str) -> DocumentAgreementStatus
```

- 詳細設計モードだけ(`require_detailed`。簡易モードは 409)。表示中の版は `GeneratedDocumentRepository.get_current`。文書が無ければ空(`version` が None。画面は何も出さない)。model の無い以前の形式の版は要素が無く、合意済みの要素はすべて「今の版に無い」になる。
- 今の合意は既存の `current`(束・CR を読み込み済み)を、その文書の種類だけに絞る。行から `CurrentAgreement` への写しは `_current_agreement`(出どころの名前は `origin_label`)。
- 版の `change_request_id` から CR の番号を引く。97-2 の画面が「CR-n の予測に無い変更を戻した」と言い分ける材料になる(着手時の相談 (4))。版の応答(`GeneratedDocumentRead`)は、CR の番号を版の履歴の応答にしか載せないので、ここで返す。
- ルートは `doc_type` を `Literal["requirements", "external_design"]` で受ける(ほかは FastAPI の 422)。応答は `AgreementStatusRead`(`doc_type`・`version`・`change_request_number`・`elements`・`restored`)。
- マイグレーションは無い。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_status.py`(新規) | `element_states`・`restored_elements`・`ELEMENT_STATE_LABEL`(パッケージ `app.agreements` から)、`CurrentAgreement` | pytest のテスト関数 | スタブ不要 ── 渡した値だけから決まり、DB にも LLM にも触れないため |
| `test_agreement_status_service.py`(新規) | `AgreementService.status`・ルート `get_agreement_status`・`AgreementStatusRead`・`agreement_status_read` | 各テスト関数 | DB はインメモリ SQLite を本物のリポジトリで。束と CR の反映までは `tests/fixtures/change_requests.py`(文書の生成の LLM は FakeLLM) |

- 統合スモーク: 束 B-1 を作った直後は、要件の行がすべて「合意済み B-1」で、戻した要素は無い。
- CR-1 を反映した版: 対象の FR-001 は「合意済み CR-1」、偽の LLM が落とした FR-002・NFR-001 は戻されて「合意済み B-1」、戻した要素に2件(落ちた要素)、CR の番号は 1。
- 表示中の版を CR-1 の前の版に戻すと、FR-001 は「合意と違う」になり、CR の番号は無い。
- 外部設計書は、画面 → API の並びで状態を返す(ルートを素で1回呼ぶ)。
- 束の前は、どの要素も未合意で出どころを持たない。戻した要素の理由の名前(書き換えを戻した)も載る。
- 文書の無いプロジェクトは空、簡易モードは `DesignStagesNotAvailableError`。
- 純粋関数: 4つの状態と並び・表示名の出どころ・既定値の欠けで「違う」にならない・`missing` は文書の種類の範囲だけ・利用者(1.2 全体)と API のキー(パスの引数名を問わない)・戻した要素の表示名と、飛ばす行。
