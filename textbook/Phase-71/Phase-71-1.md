# Phase-71-1: マイルストーンのゴールと単位(PR-7)

## この章の目的

マイルストーンのゴールは、実装計画書(簡易モード)と段階7(詳細設計モード)で AI が自由文で書く。どのプロンプトも検証も、ゴールとその下のタスクを突き合わせていなかった。そのため、ゴールに CI/CD・バックアップと書いたのに、タスクは Docker と nginx だけ、という食い違い(PR-7)が残っていた。この章では次の3つを行う。

- ゴールに出る少数の語を、タスクの名前・ファイルと照らす純粋関数を作る。
- 両方の計画の検証に警告を足す。
- 両方のプロンプトに「ゴールには、そのマイルストーンのタスクで作るものだけを書く」規則を足す。

自動実装モード: on([introduction](./Phase-71-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/plan_goal.py`](../samples/backend/app/detailed_design/plan_goal.py) | 新規 | `GOAL_TERMS`・`uncovered_goal_terms`・`GOAL_RULE` |
| [`app/detailed_design/plan_drafting.py`](../samples/backend/app/detailed_design/plan_drafting.py) | 更新 | 段階7のプロンプトに `GOAL_RULE` |
| [`app/documents/implementation_plan/drafting.py`](../samples/backend/app/documents/implementation_plan/drafting.py) | 更新 | 実装計画書のプロンプトに `GOAL_RULE` |
| [`app/documents/implementation_plan/validation.py`](../samples/backend/app/documents/implementation_plan/validation.py) | 更新 | `GOAL_WITHOUT_TASK`(中程度) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | 段階7の `GOAL_WITHOUT_TASK`(警告)。同じファイルの段階3の分は [71-2](./Phase-71-2.md) |
| [`tests/unit/test_plan_goal.py`](../samples/backend/tests/unit/test_plan_goal.py) | 新規 | 語の照合・規則の文 |
| [`tests/unit/test_implementation_plan_doc.py`](../samples/backend/tests/unit/test_implementation_plan_doc.py) | 更新 | 実装計画書の警告 |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 更新 | 段階7の警告 |

## 1. 調べて分かったこと

- PR-7 の定義は [`appendix/stage8-baseline/truth-e.md`](../../appendix/stage8-baseline/truth-e.md) の PR-7 にある。M-01 のゴールは「FastAPI と Next.js のプロジェクト構造」なのに、M-01-T01 に Next.js もフロントのコンテナも無い、という例である。Phase 58 でも、簡易の M-01 のゴールに CI/CD・バックアップがあり、単位は Docker と nginx だけだった([58-3](../Phase-58/Phase-58-3.md))。
- ゴールは手順書でなく計画で決まる。簡易モードは実装計画書の WBS のゴールを、詳細設計モードは段階7のゴールを、手順書の概観の表に写すだけである。手順書を書く AI にはゴールの文を渡していない。
- マイルストーンは自由文のゴールしか持たない。照らせるのは、タスクの `title`・`modules`・`config_files` である。
- 保存済みの記録では、詳細設計モードのゴールは機能の文(「〜ができる」)で、食い違いは見つからなかった。簡易モードでは M-01 に Next.js・フロントエンド・CI/CD・バックアップが出る版が多かった([71-4](./Phase-71-4.md))。

## 2. 語の表で照らす(`plan_goal.py`)

```python
# app/detailed_design/plan_goal.py
@dataclass(frozen=True)
class GoalTerm:
    label: str
    pattern: re.Pattern[str]      # ゴールに出る語
    evidence: tuple[str, ...]     # タスクの名前・ファイルの部分文字列(小文字で照らす)
    feature_covers: bool = False  # 機能のタスクがあれば作るとみなす

GOAL_TERMS = (
    GoalTerm("CI/CD", re.compile(r"CI/CD|(?<![A-Za-z])CI(?![A-Za-z])|継続的…"), (".github/workflows", …)),
    GoalTerm("バックアップ", re.compile(r"バックアップ"), ("backup", "バックアップ", "pg_dump")),
    GoalTerm("フロントエンド", re.compile(r"Next\.js|フロントエンド|React"), ("frontend", …), feature_covers=True),
    GoalTerm("監視", re.compile(r"監視|モニタリング"), ("monitor", "prometheus", …)),
)

GOAL_RULE = "- マイルストーンのゴールには、そのマイルストーンのタスクで作るものだけを書く。…\n"

def uncovered_goal_terms(milestone: Milestone) -> list[str]: ...
```

- 依存の向き: `plan_goal` → `plan`(`Milestone`)。消費者は2つの計画の `drafting`・`validation` で、`plan_goal` はそれらを知らない。
- 非自明な判断:
  - **語を少数に絞った**。ゴールは自由文なので、すべての食い違いは決定的には見られない。誤って指摘しにくい語(作るファイルがはっきりしているもの)だけを表にした。DB・Redis はゴールにもタスク(`docker-compose.yml`)にもよく出て、ファイルからは作るかどうかが決まらないので入れていない。
  - **フロントエンドは、機能のタスクがあれば作るとみなす**(`feature_covers`)。計画の規則で、機能のタスクはその処理のバックエンド・フロントエンド・テストを1つに含む。簡易モードの内部設計書のモジュール一覧はバックエンドだけのことがある。保存済みの記録に当てると、「フロントエンドでプレビューできる」と書いた機能のマイルストーンが出た。その誤検知を受けて足した([71-4](./Phase-71-4.md))。
  - `CI` は英字に挟まれていないときだけ語とみなす(`CIRCLE` などを拾わない)。
- 規則の文は1つの定数にし、両方のプロンプトが同じ文を持つ(テストで両方に入っていることを確かめる)。

## 3. 検証に足す(警告)

```python
# app/documents/implementation_plan/validation.py
def _goal_issues(model: ImplementationPlanModel) -> list[DocumentIssue]:
    targets = [f"{milestone_id(i)}({'・'.join(terms)})"
               for i, m in enumerate(model.milestones) if (terms := uncovered_goal_terms(m))]
    return _issue("major", "GOAL_WITHOUT_TASK", "ゴールに書いたものを作るタスクが、…", targets, "(…)")

# app/detailed_design/validation.py(validate_plan の中。タスクの無いマイルストーンは EMPTY_TASKS だけ)
elif terms := uncovered_goal_terms(milestone):
    issues.append(_warning("GOAL_WITHOUT_TASK", f"{label} のゴールにある「…」を作るタスクが、…", target))
```

- どちらも承認・保存は止めない。直し方は2通り(タスクを足す / ゴールから外す)で、どちらが正しいかは人が決める。
- 実装計画書の文書の検証は、同じ種類の指摘を1件にまとめて並べる(既存の `_issue` の形)。段階7は、マイルストーンごとに1件出す(既存の段階の検証の形)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_smoke_reports_goal_terms_without_tasks` | `uncovered_goal_terms` | pytest の関数 | スタブ不要 ── 純粋関数 | 実際に出た形(CI/CD・バックアップ、タスクは Docker と nginx) |
| `test_frontend_goal_needs_a_frontend_file_or_title` | 同上 | 同上 | 同上 | Next.js はファイル・名前・機能のタスクで作るとみなす |
| `test_evidence_comes_from_modules_config_files_and_titles` | 同上 | 同上 | 同上 | 3つの欄が証拠になる |
| `test_terms_without_goal_words_are_not_reported` | 同上・`GOAL_TERMS` | 同上 | 同上 | `CIRCLE` を拾わない・機能のゴールは照らさない・表の順 |
| `test_both_plan_prompts_carry_the_goal_rule` | `GOAL_RULE`・`PLAN_SYSTEM_PROMPT`・`SYSTEM_PROMPT` | 同上 | スタブ不要 ── 定数 | 両方のプロンプトに同じ規則 |
| `test_validation_reports_goal_without_task` | `validate_implementation_plan` | 同上 | スタブ不要 ── 純粋関数 | 中程度・対象の形 `M-01(CI/CD・バックアップ)` |
| `test_validate_warns_goal_without_task_with_milestone_target` | `validate_plan` | 同上 | スタブ不要 ── 段階の model と入力の写し(fixtures)を渡す純粋関数 | 警告・対象は M-ID・CI の設定ファイルで消える |

- この章で作成・更新した本体のファイルは、すべてテストが import している。`plan_drafting.py` と実装計画書の `drafting.py` は `test_plan_goal.py` が、`validation.py`(2つ)は `test_implementation_plan_doc.py`・`test_plan.py` が import する。テストが新しく import するのは、この章の `GOAL_RULE`・`GOAL_TERMS`・`uncovered_goal_terms` と、既存の `Milestone`・`PlanTask`・`PLAN_SYSTEM_PROMPT`・`SYSTEM_PROMPT` である。前方 import は無い。
