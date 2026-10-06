# Phase 24 導入: 統合/E2E・デプロイでの確認(ステージ4)

## 目的

ステージ4(詳細設計モード)の最後の Phase。これまでの Phase で作った段階1〜7と詳細設計書の出力を、通しで確かめ、本番に出す準備をする。新しい機能は作らない。

- **偽 LLM の契約テスト**: E2E 用の偽 LLM(`E2eFakeLLM`)の段階1〜7の出力を、本物の生成・検証・承認・出力の経路に通す。ブラウザを使わない単体テストにする(24-1)。
- **E2E**: Playwright で、詳細設計モードを通しで動かす。流れは「作成 → ヒアリング → 段階1〜7の生成・承認 → zip」(24-3)。あわせて、Phase 15 以降に壊れていた簡易ドキュメントモードの E2E を直す(24-2)。
- **デプロイ**: 自動デプロイの順序を「マイグレーション → 新しいコードの起動」に改める。ステージ3・4を本番に出す手順書を作る(24-4)。

実務との対応: E2E と偽の外部サービスの組み合わせは、契約テスト(consumer-driven contract)の考え方に近い。偽物が本物の規則に従っていることを、別のテストで固定する。マイグレーションを先に流す順序は、「expand → migrate → switch」というデプロイの定石の最小形に当たる。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 24 開始時」を参照。3つとも推奨どおりに決まった。

1. **本番デプロイ**: 手順は Claude が用意する。PR・マージ・push と、VPS での確認はユーザーが行い、結果を教材に記録する。
2. **E2E の範囲**: 段階1〜7の承認と zip まで通す。壊れていた簡易モードの E2E も直す。
3. **CI のデプロイ順**: 「build → 使い捨てのコンテナでマイグレーション → 入れ替え」に変える。

Claude の判断で決めたこと(計画の承認で確定):

- 偽 LLM の出力が検証を通ることを、E2E とは別に BE の単体テストで固定する。これまで確かめていたのは段階1だけだった。E2E が落ちたときに、原因が画面と偽 LLM のどちらにあるかを切り分けられるようにするため(24-1)。
- E2E の共通の操作(登録とログイン、モードを選んだ作成、ヒアリングから生成まで)は `e2e/helpers.ts` に切り出す(#17)。今この共通化を必要としているのは、簡易モードの spec と詳細設計モードの spec の2つ(24-2)。
- 段階ごとの操作の関数(生成・図の承認・段階の承認)は、詳細設計の spec の中に置く。他の spec は使わない(24-3)。
- 段階6は「飛ばす」ではなく、関数を1つ選んで生成する。05↔06 の紐づけと 06 の章まで通すため。「飛ばす」は Phase 21 の単体テストで確かめてある(24-3)。
- インフラのファイル(`deploy.yml`・`OPERATIONS.md`)は、samples に写さず本体を直接編集する。Phase 5 の前例に従う(24-4)。

## パイプライン上の位置づけ・前提

```
[24-1 契約テスト(BE、ブラウザ無し)]
  E2eFakeLLM ──▶ DesignStageGenerationService.request_generation / execute(段階1〜7)
              ──▶ UmlDiagramService.compute_layout / approve(DFD・ER・構成図)
              ──▶ validate_stage → DesignStageService.approve
              ──▶ DetailedDesignExportService.bundle(zip)
[24-2・24-3 E2E(ブラウザ)]
  Playwright ─▶ devex-ui(next dev)─▶ devex-api(docker compose + docker-compose.e2e.yml、E2E_FAKE_LLM=true)
    helpers.ts: registerAndLogin → createProject(mode) → completeHearing
    devex-flow.spec.ts(簡易)/ detailed-design-flow.spec.ts(詳細: 段階1〜7 → zip)
[24-4 デプロイ]
  main への push ─▶ GitHub Actions(test)─▶ VPS: git pull → build → run --rm alembic upgrade → up -d
  devex-ui の main への push ─▶ Vercel(API の反映の後に出す)
```

- **前提として読むもの**:
  - [`Phase-23-introduction.md`](../Phase-23/Phase-23-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する申し送り(E2E、マイグレーション、段階7の入力の大きさ)。
  - [`Phase-4-4.md`](../Phase-4/Phase-4-4.md): E2E の仕組み。偽 LLM を環境変数で有効にし、Playwright の webServer が docker compose を起動する。
  - [`Phase-5-4.md`](../Phase-5/Phase-5-4.md): GitHub Actions による自動デプロイ。
  - [`Phase-15-introduction.md`](../Phase-15/Phase-15-introduction.md): モード選択ダイアログと、生成の確認ダイアログ(気づき#4)。E2E が壊れた原因。
- **本 Phase 開始時点の状態**:
  - **簡易モードの E2E が壊れていた**(2か所)。「新規プロジェクトを作成」がリンクからボタンに変わり、モード選択ダイアログが出るようになった。「この内容で設計書を生成する」の後には、確認ダイアログが出るようになった。どちらも Phase 15 の変更による。
  - **偽 LLM の出力**: 検証を通ることをテストで確かめていたのは段階1だけだった。
  - **開発用 DB**: 既に head(`f4a5b6c7d8e9`)だった。Phase 15〜23 の申し送りにある「未適用」は、その後に適用されていた。
  - **本番**: ステージ2のまま(devex-api `main` = `a7176af`)。stage3・stage4 ブランチは push していない。devex-ui の `main` は origin より15コミット進んでいて、push すると Vercel がすぐデプロイする。
  - **自動デプロイの順序**: `up -d --build` の後にマイグレーションを流していた。マイグレーションが失敗すると、新しいコードが古いスキーマで動く。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、24-2・24-4 を納期モード、24-1・24-3 を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-24-1.md`](./Phase-24-1.md) | BE: 偽 LLM の契約テスト(段階1〜7 → zip を、サービスの経路に通す) | 学習 | なし |
| [`Phase-24-2.md`](./Phase-24-2.md) | FE: E2E の共通の操作(`helpers.ts`)と、簡易モードの E2E の修復 | 納期 | なし |
| [`Phase-24-3.md`](./Phase-24-3.md) | FE: 詳細設計モードの通しの E2E(段階1〜7 → zip) | 学習 | 24-2(`helpers.ts`)。24-1 が通ることが前提 |
| [`Phase-24-4.md`](./Phase-24-4.md) | デプロイ: 自動デプロイの順序、本番反映の手順書、本番での確認の記録 | 納期 | 24-1〜24-3(テストが通ってから出す) |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`):
  - 新規(テスト): `tests/unit/test_fake_llm_detailed_design.py`
  - `app/ai/llm/fake.py` は変更しない(24-1 のテストが一度で通ったため)。
- **フロントエンド**(`textbook/samples/frontend/`):
  - 新規: `e2e/helpers.ts`、`e2e/detailed-design-flow.spec.ts`
  - 更新: `e2e/devex-flow.spec.ts`
- **samples に写さないもの**(本体を直接編集。Phase 5 の前例):
  - `devex-api/.github/workflows/deploy.yml`
  - `devex-api/OPERATIONS.md`(3節・9節、10節を新しく追加)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 24-1 | `tests/unit/test_fake_llm_detailed_design.py`(新規) | 偽 LLM で段階1〜7を生成・承認し、zip まで作る | `uv run pytest tests/unit/test_fake_llm_detailed_design.py` |
| 24-2 | `e2e/helpers.ts`(新規)、`e2e/devex-flow.spec.ts`(更新) | E2E の共通の操作と、簡易モードの2本の修復 | `npx playwright test e2e/devex-flow.spec.ts`(偽 LLM の backend で) |
| 24-3 | `e2e/detailed-design-flow.spec.ts`(新規) | 詳細設計モードを段階1〜7 → zip まで通す | `npx playwright test e2e/detailed-design-flow.spec.ts` |
| 24-4 | `deploy.yml`・`OPERATIONS.md`(更新) | マイグレーションを先に流す順序と、ステージ3・4の本番反映の手順 | `yaml.safe_load`、ローカルの本番相当の構成で順序とロールバックを確かめる |

## 写経順序(#23)

章番号の順(24-1 → 24-2 → 24-3 → 24-4)に進める。24-1(BE)と 24-2・24-3(FE)は import でつながらない。ただし、24-3 の E2E が落ちたときに切り分けられるよう、24-1 を先に通しておく。

E2E を流す前に、開発用の backend を偽 LLM に切り替える。`playwright.config.ts` の `reuseExistingServer` は、8000番で動いている backend をそのまま使う。本物の LLM の backend が動いたままだと、それが使われてしまう。

```bash
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend   # 偽 LLM へ
cd ../devex-ui && npx playwright test
cd ../devex-api && docker compose up -d backend                                                # 本物の LLM へ戻す
```

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは、本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 715件が成功した(Phase 23 完了時は 714件)。`ruff check .` は全通過。
- **FE(Phase 完了時の全体テスト)**: 単体テスト 630件(113ファイル)が成功した(`--maxWorkers=4`。単体テストは触っていない)。`tsc --noEmit` は成功した。`lint` は既存の警告1件(`streamChat.test.ts`)だけ。
- **E2E**: 偽 LLM の backend で、3本(簡易2本・詳細1本)を続けて流し、すべて成功した(合計 1.5分。詳細設計モードの1本は約 55〜60秒)。終わった後、開発用の backend を本物の LLM に戻した。
- **開発用 DB**: `alembic current` は `f4a5b6c7d8e9 (head)`。適用する作業は要らなかった。
- **本番相当の構成での確認(ローカル)**: 本番の compose(`docker-compose.prod.yml`)を、別のプロジェクト名(`-p devex-prodcheck`)と一時的な `edge` ネットワークで立てた。新しい順序(build → `run --rm` で `alembic upgrade head` → `up -d`)で、空の DB に10本のマイグレーションが適用され、`/health` が ok を返した。続けて、ステージ2の head(`a96a8c02c148`)への downgrade と、head への再 upgrade(各6本)も確かめた。確かめた後、ボリュームとネットワークは削除した。
- **本番へのマージ**: `git fetch` で origin/main を取り込んだ。手元に無かった `b2e34e5` は、`a7176af` と `ae19b15`(STAGE2 デプロイ)のマージで、中身は `ae19b15` と同じだった。`ae19b15` は stage4 に含まれる。`git merge-tree` で、stage4 を origin/main にマージしても衝突しないことを確かめた。
- **samples と本体の一致**: タグとコメントの行を除いた samples を、本体と比べた。差は無い。
- **実 import 監査(#15)**: 全ファイルの import 文を読んだ。前方 import は無い。
  - `test_fake_llm_detailed_design.py`(24-1)は、以前の Phase のモジュールだけを import する: `E2eFakeLLM`(Phase 4〜23)、`has_errors`・`validate_stage`(Phase 16)、`DesignStageGenerationService`(Phase 16)、`DesignStageService`(Phase 15)、`DetailedDesignExportService`(Phase 22)、`UmlDiagramService`(Phase 8〜12)、fixture の `create_detailed_project`(Phase 16)。
  - `helpers.ts`(24-2)は `@playwright/test` だけを import する。`devex-flow.spec.ts`(24-2)は `helpers`(24-2)を、`detailed-design-flow.spec.ts`(24-3)は `helpers`(24-2)と `node:fs/promises` を import する。
  - 各章のテストが、その章で作った全ファイルを import するかも突き合わせた。24-2 の `helpers.ts` は `devex-flow.spec.ts` が、24-3 の spec は自分自身が確かめる。
- **本番での確認**: ユーザーに依頼中([`Phase-24-4.md`](./Phase-24-4.md)「本番での確認の記録」に書く)。

## 後続 Phase への申し送り

- **ステージ4は本 Phase で終わる**。docs/implementation_plan.md にステージ5以降の計画は無い。次に何をするか(本番での気づきの修正、持ち越しの扱い、decision digest の整理など)は、本番での確認の後に相談して決める。
- **持ち越し(今回も扱わない)**: Phase 22 からの3つ。
  - 段階6が開いていないときの、05 の詳細バッジ
  - `call` と `function` の書き方の揺れ
  - ER の主キーの NULL の表示
- **段階7の入力の大きさ**: 本番の確認で、実際の Gemini の所要時間とトークン数を控える。大きなプロジェクトで上限に近づくようなら、05・06章を要約して渡す案を考える。
- **E2E を CI で流すか**: 今は手元でだけ流している。CI で流すには、docker compose と next dev を Actions で立てる必要がある。所要時間は約1.5分。テンプレートにも効くので、[`retrospective-memo.md`](../retrospective-memo.md) に候補として記録した。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 偽 LLM の出力が検証を通ることを、E2E ではなく BE の単体テストで固定したのはなぜか。E2E が落ちたとき、このテストがあると何が分かるか。
2. 24-1 のテストでは、偽 LLM は「スタブ」として差し込むのではなく、検証される側として扱った。普段の `FakeLLM`(台本を注入するスタブ)との違いを、SUT の位置で説明する。
3. 段階2〜4では、段階の「承認する」の前に図の「承認」が要る。図の承認には何が要るか(画面ではどこで用意されるか)。
4. E2E で生成を待つとき、固定の時間で待たずに「ボタンの文言が変わる」「承認が押せるようになる」を待ったのはなぜか。生成はどこで動き、画面はどうやって終わりを知るか。
5. 自動デプロイで、マイグレーションを `up -d` の前に、使い捨てのコンテナ(`run --rm`)で流すことにした。前の順序では、マイグレーションが失敗すると何が起きたか。また、新しい順序でも防げないのは、どんな変更か(古いコードが新しいスキーマで動く場合を考える)。
