# Phase-29-2: シーケンスの導出と段階5の検証(BE)

## この章の目的

段階5の手順から、シーケンス図のモデル(参加者・矢印・分岐の注記)と、図にするときに分かる手順の不備(指摘)を導く純粋関数を作る。デモの `sequenceModel.ts`([25-5](../Phase-25/Phase-25-5.md))をバックエンドへ移し、本実装として段階5の検証の警告にする。図の SVG と 05章への掲載は 29-3、画面は 29-4、手順書は 29-5 で、すべてこの章の関数を使う。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/sequence.py`](../samples/backend/app/detailed_design/sequence.py) | 新規 | `Participant`・`SequenceMessage`・`SequenceNote`・`SequenceIssue`・`SequenceDiagram`、`module_dependencies`・`to_sequence`・`to_mermaid`・`reachable_callees`・`sut_participant`・`stubs_outside_sequence`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `validate_procedures` に `to_sequence` の指摘を警告として足す |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `sequence` の re-export |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E 用の偽の段階5の手順の最後の行(利用者へ返す)を `kind="return"` に |
| ── ここからテスト ── | | |
| [`tests/unit/test_sequence.py`](../samples/backend/tests/unit/test_sequence.py) | 新規 | 入れ子と推測した戻り・指摘・非同期・自己呼び出し・Mermaid・スタブの候補・段階5の検証の警告 |

`sequence_svg.py`(29-3)・`stubs_outside_sequence` を使う段階8の検証(29-5)は、この章の `sequence.py` を読む。

## 要点の抜粋

```python
# app/detailed_design/sequence.py
@dataclass(frozen=True)
class SequenceMessage:            # 矢印1本
    step_id: str                  # 手順ID(F-07#2)。推測した戻りは、どの呼び出しの戻りか
    source: str; target: str      # 参加者の id(P1…。Mermaid の別名)
    kind: StepKind                # call / async / return
    label: str
    derived: bool = False         # 表に無く推測した戻り

@dataclass(frozen=True)
class SequenceDiagram:
    function_id: str
    participants: tuple[Participant, ...]
    events: tuple[SequenceMessage | SequenceNote, ...]
    issues: tuple[SequenceIssue, ...]    # code: RETURN_AS_CALL / NESTING_UNKNOWN /
                                         #       MISSING_BRANCH_TARGET / CALLEE_NOT_DEPENDENCY / EMPTY_CALLER

def to_sequence(procedure, dependencies=None) -> SequenceDiagram   # dependencies: 段階4のパス → 依存先
def to_mermaid(diagram) -> str                                      # sequenceDiagram のテキスト
def reachable_callees(diagram, start: str) -> list[str]             # start から呼び出しで届く参加者(名前)
def sut_participant(diagram, sut: str, trigger: str) -> str | None  # テスト観点の SUT → 参加者の名前
def stubs_outside_sequence(stub_text, candidates, module_paths) -> list[str]
```

```python
# app/detailed_design/validation.py(validate_procedures の末尾)
for found in to_sequence(procedure, dependencies).issues:
    issues.append(_warning(found.code, found.message, found.step_id))
```

## 導出の規則

呼び出し中の参加者を積み上げ(スタック)て、表に無い入れ子と戻りを推測する。

1. 呼び出し元がスタックの途中にいれば、その上の参加者は戻ったとみなし、戻り(推測。破線・斜体)を足す。
2. 種別が戻りの行は、呼び出し先(値を受け取る側)まで戻る。種別が**同期の呼び出し**なのに、呼び出し先がスタックの下にいれば、戻りを呼び出しとして書いているとみなし、戻りとして描いて `RETURN_AS_CALL` を出す。
3. 呼び出し元が呼び出し中でなければ `NESTING_UNKNOWN` を出し、新しい流れとして描く。
4. 非同期の呼び出しは戻りを待たない(積まない)。非同期の先が呼び出し中の参加者(通知・コールバック)でも、戻りとはみなさない。
5. 同じ参加者の中の呼び出し(`caller == callee`)は積まない。図では輪で描き、戻りを描かない。
6. 呼び出し先が呼び出し元の依存先(段階4。`module_ref_matches` の区切り単位の一致)に無ければ `CALLEE_NOT_DEPENDENCY`。外部の役者・同じモジュール・段階4に無い呼び出し元は判断しない。
7. 分岐の欄の「1a へ」の行が無ければ `MISSING_BRANCH_TARGET`。分岐の行は、直前の矢印の両端に付けた注記にする。
8. 呼び出し先が空の行は描かない(段階5のエラー `EMPTY_CALLEE` で直させる)。呼び出し元だけが空なら `EMPTY_CALLER`。

## 設計判断

### 導出はバックエンドだけ(着手時の決定)

図を使うのは、段階5の検証(この章)・05章の md と HTML(29-3)・段階5の画面(29-4)・手順書の参照の展開と段階8の検証(29-5)の5か所である。28-1 の参照の展開と同じく、規則を2つの言語で持つと食い違うので、純粋関数をバックエンドの1か所に置いた(#17)。代わりに、画面の図は保存した手順から描く(編集中の表とは保存までずれる。29-4)。デモの `sequenceModel.ts` はデモの中に残し、本体の画面へは移さない。

### デモから変えたこと

- 戻りの判定(規則2)を同期の呼び出しに限った。デモは非同期の通知も戻りとみなしていた。
- 自己呼び出しを積まない(規則5)。積むと、その後の呼び出しで戻りがずれて描かれた(実際の図で確かめて直した)。
- 依存先の照合を段階4の検証と同じ `module_ref_matches` にした(依存先に短い書き方を許しているため)。
- 参加者は `id`(Mermaid の別名)と名前を持ち、テスト観点との突き合わせは名前(パス)で返す。

### 指摘は警告(承認を止めない)

[25-5](../Phase-25/Phase-25-5.md) の決定どおり、図にするときの指摘は段階5の検証の警告にする。どれも「図が推測で描かれた」ことを知らせるもので、手順の表としては成り立っている。既存の承認済みの段階5にも指摘が出るが、状態は変わらない(検証は読み出しのたびに行う)。

### 偽 LLM の手順を直した

E2E 用の偽 LLM の段階5の手順は、最後の「利用者へ返す」行を同期の呼び出しで書いていた。この Phase の検証で `RETURN_AS_CALL` が出るので、`kind="return"` にした(偽の出力が検証を通ることを、既存のテスト `test_e2e_fake_output_passes_stage5_validation_with_fake_module_list` が確かめている)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_sequence`・`to_mermaid`・`reachable_callees`・`sut_participant`・`stubs_outside_sequence` | pytest(`test_sequence.py`) | スタブ不要 ── 純粋関数で、手作りの `Procedure` と依存先の dict だけから決まるため | 第一テストの統合スモーク: 3段の呼び出しの後に、内側から順に推測した戻りが足される |
| `validate_procedures`(シーケンスの指摘) | pytest(`test_sequence.py`) | スタブ不要(同上。段階1・4は `StageSources` に dict で渡す) | 存在しない分岐先・戻りを呼び出しとして書いた行が、手順ID を target にした警告になる |

- 戻りを呼び出しとして書いた行は戻りとして描き、`RETURN_AS_CALL`。種別が戻りなら指摘しない。
- 非同期は戻りを待たない。自己呼び出しは輪で、戻りを描かない。
- 存在しない分岐先・依存先に無い呼び出し・入れ子を推測できない並びを指摘する。段階4が無い・外部の役者・自己呼び出しは依存先を判断しない。
- Mermaid は別名の参加者・手順番号・「#」「;」の除去・分岐の注記。
- スタブの候補は SUT から呼ぶ先。スタブの欄が候補の外のモジュールを挙げていれば返す。
