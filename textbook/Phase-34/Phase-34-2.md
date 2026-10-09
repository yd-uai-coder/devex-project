# Phase-34-2: 判定の置き換えと API(BE)

## この章の目的

ヒアリングの完了判定を、5条件の LLM の判定から、観点の表に置き換える。LLM には「発言から観点ごとの状態・決めたこと・根拠」だけを返させ、[34-1](./Phase-34-1.md) の純粋関数で表に取り込み、完了はコードが決める。足りなければ未決の必須の観点を返信の LLM に渡し、十分なら表からまとめを組み立てて返す。画面のために観点の表を返す API(`GET /projects/{id}/hearing-points`)を足し、E2E 用の偽 LLM を新しい判定に合わせる。

自動実装モード: on([introduction](./Phase-34-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/hearing.py`](../samples/backend/app/schemas/hearing.py) | 更新 | 判定の LLM の出力(`HearingPointsJudgement`)と、観点の表の API(`HearingPointsRead`) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | `check_completion` を `judge_points` に置き換え、完了をコードで判定。`points_view` を足す |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `GET /projects/{id}/hearing-points` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽 LLM の観点の判定(発話3回で全観点が決まる) |
| ── ここからテスト ── | | |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 判定・返信の分岐・判定の失敗・観点の表の表示 |
| [`tests/unit/test_chat_stream_errors.py`](../samples/backend/tests/unit/test_chat_stream_errors.py) | 更新 | スタブの判定を新しいスキーマに |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽 LLM の判定の契約(何回目の発話で十分になるか) |
| [`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | 作成 → 3往復 → 観点の表 → 生成の配線 |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/schemas/hearing.py
class JudgedPointOut(BaseModel):
    key: PointKey
    status: PointStatus  # decided / adopted / not_applicable / open
    summary: str = ""
    evidence: list[int] = []  # LLM に見せた発言の番号([#n] の n)

class HearingPointsJudgement(BaseModel):
    scale: Scale | None = None  # 規模の観点が決まったときだけ
    points: list[JudgedPointOut] = []

class HearingPointsRead(BaseModel):
    scale: Scale | None
    legacy: bool  # 観点の表を持たず、以前の5条件の判定だけがある
    stale: bool  # 直近の発言の判定に失敗し、表がその発言を反映していない
    is_sufficient: bool
    points: list[HearingPointRead]  # key・kind・label・question・required・status・summary・evidence
```

```python
# app/services/chat_service.py(stream_reply の判定の部分)
try:
    states = await self.judge_points(project, llm=llm)
except GenerationFailedError:
    states = None
if states is None:  # 表は前のまま。完了判定を消す(生成ボタンを残さない)
    project.hearing_check = None
    questions = questions_for_reply(await self._load_states(project), _as_scale(project.hearing_scale))
else:
    check = _completion_from(states, project.hearing_scale)  # LLM を呼ばない
    project.hearing_check = check.model_dump()
    if check.is_sufficient:
        ...  # 表から組み立てたまとめを返して終わる
    questions = questions_for_reply(states, _as_scale(project.hearing_scale))
```

依存の向き: `chat_service.py` → `app.hearing`・`app.repositories.hearing_point`・`app.schemas.hearing`。`app/schemas/hearing.py` → `app.hearing`(型だけ)。`fake.py` → `app.hearing.POINT_DEFS`・`app.schemas.hearing`。

## 設計判断

### LLM には状態と根拠だけを返させる

判定のプロンプト(`_POINTS_JUDGE_PROMPT`)には、観点の表(キー・名前・問いの例・今の状態・決めたこと)を埋め、利用者側の発言の先頭に `[#n]` を付けて見せる。LLM は観点ごとの状態・決めたこと・根拠の番号と、規模を返す。「十分かどうか」は聞かない。コードが番号を `chat_histories.id` に直し、`merge_judgement` で取り込む([34-1](./Phase-34-1.md))。開発環境の希望(`project.intake.environment`)は初期入力の一部なので、初期入力の番号で見せる。

### 完了判定(`hearing_check`)の形は変えない

`projects.hearing_check` には、表から作った判定(`is_sufficient`・`summary`・`missing_points`)を今までと同じ形で保存する。`summary` は十分なときだけ `build_summary` のまとめ、`missing_points` は未決の必須の名前。`GET /hearing-completion` と画面の生成のバナーは変えずに済んだ。

### 発言の回数の下限を外した

`_MIN_USER_TURNS_FOR_COMPLETION`(3回)と `_TOO_FEW_TURNS_POINT` を消した(着手時の決定)。完了はコードが必須の観点で決めるので、下限で LLM の早すぎる「十分」を抑える必要が無い。初期入力に全部書いてあれば、1回目の発言で十分になりうる(テストで固定した)。

### 判定に失敗したら「古い表」

判定に失敗しても、観点の表は前の結果のまま残し、`hearing_check` だけを消す(今までどおり、古い判定で生成ボタンが残らない)。「表があって `hearing_check` が無い」状態を、`points_view` は `stale` と読む。列を足さずに済む(計画では判定の時刻で比べる案だったが、こちらの方が単純で、SQLite の時刻の分解能にも左右されない)。返信の LLM には、残した表の未決の必須を渡す。

### 既存のプロジェクト(移行しない)

観点の表の行が無く `hearing_check` だけがあるプロジェクトは、`legacy` として返す。`GET /hearing-completion` は保存してある5条件の判定をそのまま返す(以前の画面と同じ)。次の発言で行ができ、観点の表の判定に切り替わる([33-2](../Phase-33/Phase-33-2.md) 決定8)。

### 返信の LLM に渡す観点は3つまで

未決の必須を、定義の順(規模が先頭)で3つまで、「名前(例: 場面で聞く問い)」の形で渡す。今の「[まだ確認できていない観点]」の差し込み口を流用した。全部を渡すと、1回の返信で質問を並べすぎるため。まとめて聞く形(カード)は [Phase 35](../../docs/implementation_plan.md) で作る。

### 偽 LLM の判定

E2E の流れ(利用者の発話3回で生成のボタンが出る)を変えないため、偽 LLM は利用者側の発言(初期入力を含めて)が4件以上で全観点を「ユーザーが決定」として返し、それまでは目的だけを返す。根拠は番号の付いた発言のうち最後のもの。旧スキーマ `HearingCompletionCheck` の分岐は消した(呼ばれなくなったため)。E2E はこの Phase では流さない(#36、Phase 40 で全部流す)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ChatService.judge_points`・`stream_reply`・`points_view` と、ルート `get_hearing_points`・`get_hearing_completion` | pytest(`test_chat_service.py`) | `FakeLLM`(構造化出力に決めた判定を返す)と `_RecordingLLM`(判定と返信に渡された `messages` を記録する)── LLM は外部の API なので差し替える。DB はインメモリ SQLite | 第一テスト(統合スモーク): `judge_points` が番号を id に直して保存し、根拠の結べない決定を捨てる。番号付きの発言と表がプロンプトに入る、規模は規模の観点が決まったときだけ、十分なら LLM の返信なしでまとめ、足りなければ規模から順に返信へ渡す、失敗したら表を残して `stale`、新規・`legacy`・根拠の表示名 |
| `send_hearing_message` と `as_llm_error` | pytest(`test_chat_stream_errors.py`) | `_FailingStreamLLM` ── 判定には何も決まっていない結果を返し、返信のストリームを途中で切る | 既存のテスト。スタブの判定を新しいスキーマに替えただけ |
| `E2eFakeLLM` の観点の判定 | pytest(`test_fake_llm_e2e.py`) | なし ── 偽 LLM は検証される側。完了の判定は本物の `merge_judgement`・`is_sufficient` を使う | 初期入力 + 発話2回までは足りず、3回で十分。根拠は最後の番号 |
| ルーティングと DI の配線 | pytest `-m integration`(`test_projects_flow.py`、実 PostgreSQL) | `FakeLLM`(判定の列: 2回は目的だけ、3回目で全観点) | 3往復目の返信がまとめ(「規模: 社内」)、`/hearing-points` が十分で根拠が「発言3」 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_chat_service.py tests/unit/test_chat_stream_errors.py tests/unit/test_fake_llm_e2e.py
```
