# Phase-113-2: 束の鮮度(純粋関数と API)

## この章の目的

束(合意済みの版)は作った時点の文書と段階を凍結する。その後に CR を文書へ反映すると、合意の中身は束より先へ進み、束を相手にした比べ方(資料との違い・CR の案・規模の集計)は古い文を相手にする。段階を古いまま束に写すと、段階から数える規模は少なく出る(ステージ13 の振り返り 18.3「古い束を基準にした説明」)。この章で「束が古い」の判定を1つ作り(純粋関数)、束ごとの API と、束の一覧・中身の「新しいか」で返す。知らせる場所(取り込み・CR の作成・共有リンクの作成・規模の表)は Phase 114〜116 がこれを使う。

自動実装モード: on([introduction](./Phase-113-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/scale.py`](../samples/backend/app/change_requests/scale.py) | 更新 | 承認のままでない段階の規則を `outdated_stages` に出した |
| [`app/change_requests/freshness.py`](../samples/backend/app/change_requests/freshness.py) | 新規 | 鮮度の純粋関数(`AppliedAfter`・`Freshness`・`freshness`) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `AppliedAfter`・`Freshness`・`freshness`・`outdated_stages` の re-export |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `record_facts`(合意の記録 → `RecordFact`) |
| [`app/repositories/baseline.py`](../samples/backend/app/repositories/baseline.py) | 更新 | `numbers`(束の番号だけ) |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `freshness`・`freshness_of`・`baseline_stage_states` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `_conflicts` が `record_facts` を、規模の材料が `baseline_stage_states` を使う(リファクタ) |
| [`app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 更新 | `BaselineFreshnessRead`・`BaselineAppliedAfterRead`・束の応答の `fresh` |
| [`app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 更新 | `GET .../baselines/{number}/freshness`・作成・一覧・中身の `fresh` |
| [`tests/unit/test_baseline_freshness.py`](../samples/backend/tests/unit/test_baseline_freshness.py) | 新規 | 純粋関数・サービス・ルート |
| [`tests/integration/test_baselines_flow.py`](../samples/backend/tests/integration/test_baselines_flow.py) | 更新 | 古い束と最新の束の鮮度・404 |

## 1. 判定(純粋関数)

```python
# app/change_requests/freshness.py(抜粋)
@dataclass(frozen=True)
class AppliedAfter:
    number: int                 # CR の番号
    keys: tuple[str, ...]       # 書き換えた要素(req:FR-001・screen:SCR-001 …)

@dataclass(frozen=True)
class Freshness:
    baseline_number: int
    newer_numbers: tuple[int, ...]
    applied_after: tuple[AppliedAfter, ...]
    outdated_stages: tuple[int, ...]
    tracked: bool = True
    is_latest -> bool           # newer_numbers が空
    fresh -> bool               # 3つとも空

def freshness(records, *, baseline_id, baseline_number, baseline_numbers, stage_states) -> Freshness
```

```python
# app/change_requests/scale.py(抜粋。規模の集計の注記と同じ規則)
def outdated_stages(stage_states: Mapping[int, str]) -> frozenset[int]   # approved 以外
```

- **3つの「古い」**(着手時の決定3): 後の束がある / 束の後に反映した CR がある / 束を作った時点で承認のままでなかった段階がある。どれも無ければ `fresh`。
- **束の後の CR は、競合と同じ材料と規則**(#17): 合意の記録(⑳)で、束の記録の最後の `seq`(`base_seq`)より後に CR の反映が中身を書き換えた要素(`changed_after`)。Phase 112 の画面確認で直したとおり、文を変えなかった反映は数えない。CR ごとに要素のキーを記録の順にまとめる。
- **束に入れた CR は数えない**: 束に入れる CR は検証済み = 反映の後なので、その記録は束の記録より前にある。
- **古かった段階は、写しの状態から**: 束の写し(`baseline_items`)は段階の、束を作った時点の状態を持つ。規模の集計が「古いまま写した段階から数えたため少なく出る」と注記する規則(`approved` 以外)を `outdated_stages` に出して共有した。入っていない段階(承認したことが無い)は「古い」でなく、規模の集計の「数えられない」の側で扱う。
- **判定できない束**(Claude の判断): 合意の記録を始める前(ステージ12 より前)の束は記録が無く、束の後の CR を判定できない。`tracked` = False にし、古いとは言わない(題材の B-1・B-2)。

## 2. サービスと API

```python
# app/services/agreement_service.py(抜粋)
async def record_facts(self, project_id) -> list[RecordFact]     # 競合と鮮度の材料

# app/services/baseline_service.py(抜粋)
async def freshness(self, project, number) -> Freshness
async def freshness_of(self, project, baselines) -> dict[uuid.UUID, Freshness]
def baseline_stage_states(baseline) -> dict[int, str]           # 入っている段階の状態
```

- **記録から `RecordFact` を作る処理を1か所に**(#17): Phase 112 は `ChangeRequestService._conflicts` の中で作っていた。鮮度という2つ目の消費者ができたので、`AgreementService.record_facts` に出し、`_conflicts` もそれを使う(公開の挙動は変えないリファクタ。番人は既存の競合のテスト)。
- **段階の状態の取り出しも1か所に**: 規模の集計の材料(`ChangeRequestService` の影響の予測)が組んでいた辞書を `baseline_stage_states` に出した。
- **一覧は1回だけ読む**: `freshness_of` は合意の記録と束の番号(`BaselineRepository.numbers`)を1回読み、束ごとに純粋関数を呼ぶ。
- API: `GET /projects/{id}/baselines/{number}/freshness`(`BaselineFreshnessRead`。`label`・`fresh`・`is_latest`・`tracked`・`newer_numbers`・`applied_after`〈`[{number, keys}]`〉・`outdated_stages`)。束の作成・一覧・中身の応答に `fresh`(`with_fresh`)。画面は Phase 116。

開発 DB の題材(トレンド追跡アプリ)で読んだ結果(実 LLM なし):

| 束 | fresh | tracked | 後の束 | 束の後に反映した CR | 古かった段階 |
|---|---|---|---|---|---|
| B-1・B-2 | false | false | あり | (判定できない) | なし |
| B-3・B-4 | false | true | あり | CR-4(FR-003・SCR-001)・CR-6(FR-001〜003) | 1〜8 |
| B-5 | false | true | B-6 | CR-6 | 6〜8 |
| B-6 | false | true | なし | CR-6(FR-001〜003) | なし |

最新の B-6 も CR-6 の反映の後で古い。Phase 117 の効果測定の前に B-7 を作る、という Phase 111 の判断と合う。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_baseline_freshness.py`(新規)の純粋関数の6本 | `freshness`・`outdated_stages` | pytest のテスト関数 | スタブ不要 ── 純粋関数で、合意の記録は `RecordFact` で組むため |
| 同ファイルのサービスの2本 | `BaselineService.freshness`/`freshness_of`・`BaselineRepository.numbers`・`AgreementService.record_facts`・`baseline_stage_states`・ルート `get_baseline_freshness`/`get_baseline`/`list_baselines`・`BaselineFreshnessRead` | pytest のテスト関数(ルートは直接呼ぶ) | CR の反映の生成の LLM は FakeLLM(`tests/fixtures/change_requests.py`)。DB はテスト用の SQLite |
| `test_baselines_flow.py`(統合)に1本 | `GET .../freshness`・一覧の `fresh` | httpx の AsyncClient | スタブ不要 ── LLM を呼ばない。実 PostgreSQL |

- 統合スモーク(リファクタの番人): 既存の競合のテスト(`test_change_request_conflicts.py`・`test_change_request_conflict_guard.py`)と、規模の集計を通る CR のテストが変わらず通る。
- 純粋関数: 最新で変化なしは新しい・束の後の CR を反映の順に、要素は重ねずに・文を変えなかった反映は数えない・束に入れた CR は数えない(古い束には後の束と、その CR が出る)・古かった段階は番号の順・束の記録が無ければ判定できない。
- サービス: 反映済みの CR-1 は束 B-1 の後の CR として出る(対象の要件が最初、予測が届いた画面・API が続く)。新しい束 B-2 を作ると B-2 は新しく、B-1 は後の束 B-2 を持つ。反映の前の束は新しい。
