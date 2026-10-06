# Phase 4 導入: 統合テスト・品質保証(QA)

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2節 WBS区分4(統合テスト・品質保証タスク)を実装する: バックエンド単体テスト監査・フロントエンド単体テスト監査・E2Eテスト基盤構築・E2Eシナリオ実装・セキュリティ/パフォーマンス確認の5章構成で、Phase 2(バックエンド)・Phase 3(フロントエンド)で完成したMVP一式を対象にQAを行い、`docs/implementation_plan.md` 4.1節「マイルストーン2: MVPリリース・社内/個人検証開始」の受け入れ判定材料を揃える。

Phase 2・Phase 3の上に構築するが、これまでのPhaseと異なり**新機能の実装ではなく既存実装の検証・監査が主目的**である。監査の過程で実害のあるバグ(2件、[`Phase-4-1.md`](./Phase-4-1.md)・[`Phase-4-2.md`](./Phase-4-2.md)参照)・見落とし(1件、[`Phase-4-3.md`](./Phase-4-3.md)・[`Phase-4-5.md`](./Phase-4-5.md)参照)が見つかっており、それらの修正も本Phaseに含む。

## 前提

- [`Phase-1/`](../Phase-1/Phase-1-introduction.md)・[`Phase-2/`](../Phase-2/Phase-2-introduction.md)・[`Phase-3/`](../Phase-3/Phase-3-introduction.md)の写経・動作確認が完了していること。
- `docs/implementation_plan.md` 4.1節(マイルストーン)・4.2節区分4(本Phaseのスコープそのもの)・4.4節(リスクと対策)を一読していること。
- [`Phase-2-5.md`](../Phase-2/Phase-2-5.md)「Phase 2全体としての既知の残課題」・[`Phase-3-6.md`](../Phase-3/Phase-3-6.md)「Phase 3全体としての既知の残課題」に目を通していること(本Phaseの監査観点の一部はこれらの申し送り事項と対応する)。
- 本Phase開始時点で、`devex-api`・`devex-ui`ともにPhase 1〜3で構築した機能(認証・ダッシュボード・チャットヒアリング・ドキュメント生成・プレビュー)が一通り動作する状態であること。実`GOOGLE_API_KEY`が設定されているかどうかは本Phaseの前提条件ではない(本Phaseはすべて`FakeLLM`/`E2eFakeLLM`で検証する方針のため)。なお本Phaseの検証中に`devex-api/.env`へ実際の値が設定されていることが判明しており、この点は[`Phase-4-5.md`](./Phase-4-5.md)「Phase 4-5全体としての既知の残課題」で訂正済み。

## 本Phase共通の設計方針

- **監査(4-1・4-2)と基盤構築(4-3・4-4・4-5)で章の性格が異なる**。前半2章は既存資産の棚卸しが中心(旧・納期モード)、後半3章は新規の設計判断(ブラウザE2E基盤・攻撃面分析)を伴う(旧・学習モード)。
- **フェイクLLMの機構が2種類登場する**([`Phase-4-1.md`](./Phase-4-1.md)「`test_projects_flow.py`の設計判断」・[`Phase-4-3.md`](./Phase-4-3.md)「なぜ2つの『フェイクLLM』が併存するのか」で詳説): pytestプロセス内での`monkeypatch`(Phase 2から継続する既存手法)と、環境変数`E2E_FAKE_LLM`経由の`E2eFakeLLM`(本Phase新設、ブラウザ経由の別プロセスを検証するため)。「テストがSUTと同じプロセス内で動くか、外部からHTTP越しに操作するだけか」がこの使い分けの基準である。
- **CLAUDE.md #3の原則からの部分的な例外**: `devex-api`直下(`backend/`の外)のインフラ設定ファイル(`docker-compose.e2e.yml`)は、[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)が既に確立した前例に倣い、samplesを経由せず直接反映する。それ以外(`app/`配下のPythonコード、`devex-ui`の全ファイル)は通常どおりsamples経由。

## モード宣言(#21)

自動実装モード: **off**(AI は教材と `textbook/samples/` を作り、ユーザーが手で本体へ実装した。リポジトリ直下のインフラ・設定ファイルだけは AI が直接書いた)。

> 旧ルール(学習モード / 納期モード)では、4-1・4-2 を納期モード、4-3〜4-5 を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-4-1.md`](./Phase-4-1.md) | バックエンド単体テスト監査・不足補完 | 納期 | Phase 2 |
| [`Phase-4-2.md`](./Phase-4-2.md) | フロントエンド単体・コンポーネントテスト監査・不足補完 | 納期 | Phase 3 |
| [`Phase-4-3.md`](./Phase-4-3.md) | E2Eテスト基盤構築(Playwright導入 + Fake LLMモード) | 学習 | 4-1, 4-2 |
| [`Phase-4-4.md`](./Phase-4-4.md) | E2Eシナリオ実装(主要フロー+再生成) | 学習 | 4-3 |
| [`Phase-4-5.md`](./Phase-4-5.md) | セキュリティ・パフォーマンス確認 | 学習 | 4-1, 4-3 |

## サンプルコード一覧

[`textbook/samples/backend/`](../samples/backend/)・[`textbook/samples/frontend/`](../samples/frontend/)に、本Phaseで作成・更新した全ファイルを置いた。各章の「この章で作成・更新したファイル」表を参照。主な新規ファイル:

- `app/ai/llm/fake.py`(バックエンド、`E2eFakeLLM`)
- `app/core/config.py`(バックエンド、初のsamples反映。`E2E_FAKE_LLM`・`LLM_TIMEOUT_SECONDS`追加)
- `tests/integration/conftest.py`(バックエンド、初のsamples反映。イベントループをまたぐコネクションプール再利用バグの修正)
- `tests/integration/{test_projects_flow,test_security_and_performance}.py`・`tests/unit/test_fake_llm_e2e.py`(バックエンド)
- `playwright.config.ts`・`e2e/devex-flow.spec.ts`(フロントエンド)
- `package.json`(フロントエンド、初のsamples反映。`@playwright/test`追加)

devex-api直下(samples対象外、直接反映済み): [`docker-compose.e2e.yml`](../../devex-api/docker-compose.e2e.yml)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | ファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 4-1 | `services/llm_retry.py`(更新)、`tests/integration/test_projects_flow.py` | エラーメッセージ日本語化+プロジェクト全フローのHTTPレベル統合確認 | `pytest tests/unit/test_llm_retry.py tests/integration/test_projects_flow.py` |
| 4-2 | `features/hearing/components/ChatPanel.tsx`(更新) | 生成トリガー失敗時のエラー表示・ボタン復旧 | `vitest run src/features/hearing/components/__tests__/ChatPanel.test.tsx` |
| 4-3 | `core/config.py`・`ai/llm/{fake,gemini}.py`、`playwright.config.ts`、`package.json` | Fake LLMモード(環境変数切り替え)+Playwright起動基盤 | `pytest tests/unit/test_gemini.py tests/unit/test_fake_llm_e2e.py` |
| 4-4 | `e2e/devex-flow.spec.ts` | ハッピーパス+再生成のブラウザE2Eシナリオ | `npm run test:e2e` |
| 4-5 | `tests/unit/test_llm_retry.py`(追加分)、`tests/integration/test_security_and_performance.py` | タイムアウト挙動・不正アクセス・SQLインジェクション耐性の確認 | `pytest tests/unit/test_llm_retry.py tests/integration/test_security_and_performance.py` |

## Phase完了チェック(#22)

1. `test_projects_flow.py`(pytest統合テスト)と`devex-flow.spec.ts`(Playwright E2E)の両方が存在する理由と、それぞれが担っている検証範囲の違いを説明できるか。
2. `monkeypatch`による`get_gemini_llm`差し替えと、環境変数`E2E_FAKE_LLM`による`E2eFakeLLM`切り替えという2つの異なるフェイク注入手段が、なぜ両方とも必要なのか説明できるか。
3. 他ユーザーのプロジェクトへのアクセスがなぜ403ではなく404を返す設計になっているか、その利点を説明できるか。
4. `invoke_with_retry`が`TimeoutError`を検知した際の実際の挙動(何回リトライし、最終的にユーザーへ何が返るか)を説明できるか。
5. `E2E_FAKE_LLM=true`が本番環境で誤って有効化されることを防ぐ、2段階の防御をそれぞれ説明できるか。
6. `ApiError`が`code`フィールドを読まないままにしている理由を、CLAUDE.md #17の判定基準に沿って説明できるか。
7. `tests/integration/conftest.py`の`client`フィクスチャがなぜ`engine.dispose()`・`get_redis_pool().disconnect()`を必要とするか、pytest-asyncioのイベントループのスコープと結びつけて説明できるか。
8. `E2eFakeLLM`のdoc_type判別が、なぜ裸のラベル文字列(「要件定義書」等)ではなく「# N. ラベル」という見出しでマッチさせる設計になっているか、実機検証で見つかった不具合の内容とあわせて説明できるか。

## 写経順序(#23)

章番号順(4-1 → 4-2 → 4-3 → 4-4 → 4-5)。4-1・4-2は独立して並行に進めてもよい(互いへの依存が無いため)が、4-3は4-1・4-2の両方の完了を前提にする(監査で見つかった修正がその後のE2Eテストの前提状態になるため)。4-4は4-3の基盤(Playwright設定・Fake LLMモード)に、4-5は4-1(エラーメッセージの日本語化)と4-3(timeout設定・E2eFakeLLM)の両方に依存する。写経後は各章末尾の「動作確認」節のコマンドで都度確認しながら進めること。

## Phase 4全体としての既知の残課題

各章末尾の「既知の残課題」節を参照。とくに以下2点はPhase 5(デプロイ・運用準備)以降での対応を推奨する。

- 実Gemini APIキーでの動作確認(`E2E_FAKE_LLM`を使わない、本物のAI応答での確認)は本Phaseでも実施していない([`Phase-4-5.md`](./Phase-4-5.md)参照。なお`GOOGLE_API_KEY`自体は既に`.env`に設定されていることが判明しているため、「鍵が無いので検証できない」ではなく「本Phaseは意図的にFakeで検証する方針を取った」が正確な理由になる)。
- `LLM_TIMEOUT_SECONDS`(60秒)は実測に基づかない暫定値であり、実キー設定後に調整すべき([`Phase-4-5.md`](./Phase-4-5.md)参照)。

## 申し送り: CL開発プロセス自体の負債(rule #18に基づき本Phaseでは着手しない)

`textbook/appendix/*-retrospective.md`(振り返り、rule #10)が Phase 0〜3のいずれについても未作成であることが、本Phase準備中の調査で判明した。CLAUDE.md ゴール節2は「少なくとも1章を学習モード・1章を納期モードで実施した上で...振り返りに記録する」ことをプロジェクト完了条件としており、本Phase(納期モード2章・学習モード3章を含む)の完了によりこの条件を満たす題材は揃う。

rule #18(セッション境界ルール)は「振り返りファイルへの書き込み」を含むセッションでは新規Phase生成を開始しないことを求めており、裏を返せば**Phase生成セッションの中で振り返りを書くこともまた避けるべき**である。そのため本Phaseの教材・サンプル生成が完了した時点で本セッションを終え、**別セッションでPhase 0〜4の振り返り(rule #10)・decision digestの整理(rule #24、本Phase分の追記含む)をまとめて行う**ことを推奨する。`textbook/q_a.md`(rule #8)もPhase 0以降ログが途切れているため、同じ機会に追記することが望ましい。

## 後続 Phase での改訂(#12)

- [`Phase-10-1.md`](../Phase-10/Phase-10-1.md)・[`Phase-10-5.md`](../Phase-10/Phase-10-5.md): `app/ai/llm/fake.py`(E2eFakeLLM)の内部設計書の応答を、UML図の生成候補(テーブル見出し・DF見出し)を含む固定文面にした。UML生成の出力スキーマ3種への固定応答と、`with_structured_output(schema, include_raw=True)`への対応も追加した。
- [`Phase-24-2.md`](../Phase-24/Phase-24-2.md): `e2e/devex-flow.spec.ts` が Phase 15 のモード選択ダイアログと生成の確認ダイアログで壊れていたため直した。登録・作成・ヒアリングの操作は `e2e/helpers.ts` に切り出し、詳細設計モードの E2E と共有した。

## 次のフェーズ

**Phase 5**: デプロイ・運用準備。詳細は[`Phase-0-2.md`](../Phase-0/Phase-0-2.md)のロードマップを参照。ユーザーが「Phase 5を開始する」と発話するまでは着手しない(#5)。
