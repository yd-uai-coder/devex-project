# Phase-84-2: 5節の組み立て(純粋)

## この章の目的

合意の前にクライアントへ見せる「変更の説明書」の5節を、CR の値・影響の予測([Phase 83](../Phase-83/Phase-83-introduction.md))・基準の合意済みの版(束)の写しから決定的に組み立てる純粋関数を作る。あわせて、5節の fingerprint(要約の「古い」の判定に使う)と、任意の要約に出る要件 ID・数字を5節と照合する関数を作る。LLM は使わない。

自動実装モード: on([introduction](./Phase-84-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 新規 | `ChangeRequestFacts`・`AffectedUnits`・`Explanation`・`SummaryCheck`・`build_explanation`・`with_summary`・`check_summary`・`affected_units` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `explanation` の re-export |
| [`tests/unit/test_change_request_explanation.py`](../samples/backend/tests/unit/test_change_request_explanation.py) | 新規 | 5節の順・2節の案と削除・3節の置き場と注記・4節の未決・5節の数・fingerprint・要約の置き場所・照合 |

依存の向き: `explanation.py` → `prediction.py`(`Prediction`)・`states.py`(表示名)・`targets.py`(`Target`・種類の表示名)・`app.hearing.points`(観点の名前)。DB にも LLM にも触らない。

```python
# app/change_requests/__init__.py(re-export の形。この章で足した分)
from app.change_requests.explanation import (
    AffectedUnits, ChangeRequestFacts, Explanation, SummaryCheck,
    affected_units, build_explanation, check_summary, with_summary,
)
```

## 1. 入力と出力

```python
# app/change_requests/explanation.py(抜粋)
@dataclass(frozen=True)
class ChangeRequestFacts:            # DB の行から写した CR の値(1節・2節に載る)
    number; title; status; content; background_source; background_date; background_memo
    targets: tuple[Target, ...]; adds_requirement: bool; baseline_number: int

@dataclass(frozen=True)
class Explanation:
    header: str                       # 題・基準の版・CR の状態
    body: str                         # 1〜5節
    units: AffectedUnits              # 5節の内訳(API がそのまま返す)
    markdown -> header + body         # (property)
    fingerprint -> sha256(markdown)   # (property)

def build_explanation(facts, prediction, snapshots, excluded) -> Explanation
def with_summary(explanation, summary: str | None) -> str   # 要約があれば題の後・1節の前に「## 要約」
```

- **入力を値にした**: ORM の行を直接受けず `ChangeRequestFacts` を受ける。純粋関数のテストで DB が要らず、行から値への写しは [84-3](./Phase-84-3.md) の `facts_of` が1か所で持つ。
- **予測は渡されたものを使う**: 判断の前は束から求めた予測、判断の後は保存した予測(どちらにするかはサービスが決める)。説明書の3節と影響の API が同じ一覧になる。

## 2. 5節

| 節 | 中身 | 材料 |
|---|---|---|
| 1. 変更の内容と背景 | 内容の本文と、出どころ・日付・メモの表 | CR |
| 2. 対象の要件 | 「要件 ID / 変更の種類 / 合意済みの文 / 変更後の案」。削除は「(削除)」、案が空なら「(1節の内容を参照)」。新しい要件を足す CR は1行 | CR の対象([84-1](./Phase-84-1.md))・束の要件定義書の文 |
| 3. 影響の一覧 | 置き場(文書・段階1〜8)ごとの表「要素 / 理由 / 届いた対象」。束に入っていない文書・段階と、新しい要件が予測に入らないことの注記 | 予測・束に入っていないもの |
| 4. 関わる未決事項 | 対象の要件の根拠の観点のうち未決のもの(観点の名前と関わる要件)と、対象のうち推測の要件 | 束の要件定義書の写しの `point_statuses`・`rows[].points`・`source` |
| 5. 作業単位とテストの数 | 作業単位の数と ID、テストの数(結合・総合の内訳)と ID | 予測・束のテスト仕様書の写し |

- **4節は束の写しから読む**(Claude の判断): 仕様の「観点の表(`hearing_points` の open)」を、今の表でなく、合意した版の要件定義書が持つ生成時の観点の状態で読む。説明書は「B-n からの変更」の説明なので、後でヒアリングが進んでも説明書が変わらないようにした(決定的・fingerprint が揺れない)。
- **5節の作業単位**: 予測の `task:`(段階7)と `unit:`(段階8)の要素を単位のキーで1つにし、ID は要素のラベルの先頭(`M-01-T02`)。
- **5節のテスト**: 束のテスト仕様書の写しのケースのうち、`functions` が予測の処理(`fn:`)に当たるか、`req_ids` が対象の要件に当たるもの。束にテスト仕様書が無ければ「数えていません」と書く(0件と区別する)。
- **表のセル**: 改行は `<br>`、縦棒は `\|` に逃がす(背景のメモや要件の文に入りうる)。

## 3. fingerprint と照合

```python
def check_summary(summary: str, explanation: Explanation) -> SummaryCheck
    # 要約の要件 ID(FR-/NFR-/CON-)と数字のうち、5節に無いもの(出た順・重なりなし)
```

- **fingerprint は5節の md そのもの**: CR の値・対象・予測・束のどれが変わっても md が変わるので、入力ごとに版を数えなくてよい(段階の `input_fingerprint` は入力の版の dict だが、ここは入力が md に全部出るので md の hash で足りる)。
- **照合の規則**: 全角の数字は半角に直す。要件 ID の中の数字、英字や数字に続く数字(`E2E`・`T03`・`S3`)は名前の一部として数えない。5節の見出しの行(「## 5.」「### 段階6」)は照合の元にしない(節の番号が要約の数字を通してしまうため)。画面 ID・API は照合しない(仕様どおり)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_explanation.py`(新規) | `build_explanation`・`with_summary`・`check_summary`・`affected_units` と `Explanation` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。入力は既存の fixture の model(`impact_documents`・`impact_stages`)を束の写しの形に並べ、観点の状態・推測の要件・テスト仕様書を足したもの |

- 題と5節の見出しが順に並ぶ / 1節の表でメモの縦棒を逃がす。
- 2節: 案・削除・案なし・新しい要件の1行。
- 3節: 置き場ごとの見出し / 束に入っていないものと新しい要件の注記 / 要素が無いときの1行。
- 4節: 未決の観点だけ(決まった観点は出ない)と推測の要件 / 無いときの1行。
- 5節: 作業単位の ID と数 / 処理と要件で当たるテスト / テスト仕様書が無いとき。
- fingerprint: 同じ入力は同じ値・CR の文が変われば変わる。
- 要約の置き場所: 題の後・1節の前 / 空の要約は載らない。
- 照合: 5節に無い ID と数字を返す / 全角の数字 / 英字に続く数字は数えない。
