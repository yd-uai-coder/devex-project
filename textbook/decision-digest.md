# 決定ダイジェスト

後の Phase に前向きに効く決定・知見だけを圧縮して記録する(#24)。詳細な経緯は [`q_a.md`](./q_a.md) を参照。**q_a.md と異なり、このファイルは進行中に能動的に参照する。**

追記は Phase 完了時にまとめて1回行う(#18・#24)。

## Phase 0

- [`CLAUDE.md`](../CLAUDE.md)「進行のルール」節に appendix原本の #1〜17 を転記し、本プロジェクト固有の #18〜27 を追加した。#1〜17 は今後も内容を変更しない(調整は #18 以降への追加で行う)。
- 納期モード(#21)を採用。ただしMVPコアループ(チャット↔4文書生成の中核)の章は常に学習モード固定。
- #26(md相互参照はリンクで明記)を追加。`textbook/`配下と`CLAUDE.md`からの`.md`参照は全てMarkdownリンクにする。
- #1の「Phase毎に教材フォルダ」は「Phase毎にフォルダを作成する」の意と解釈し直した(#6「各Phaseフォルダ直下」と整合)。教材ファイルは `textbook/Phase-<N>/` 配下に置く(`textbook/`直下にフラット配置しない)。Phase-0の教材を `textbook/Phase-0/` に移設済み。
- #27(Phase 0の役割定義、共通ルール候補)を追加。Phase 0の範囲を「ルール確定+ゴール策定」から「`README.md`/`docs/`配下を入力とした実装ロードマップの具体化」まで拡張した。Devex完成後は入力をDevex生成物に切り替える想定だが、詳細はDevex完成後の振り返りで具体化する(今は未確定)。
- 用語衝突を解消: [`docs/implementation_plan.md`](../docs/implementation_plan.md)の「フェーズ1/フェーズ2」を「ステージ1/ステージ2」にリネームした。以後「Phase」はCL開発の実装単位(`Phase-<N>`)専用の語。
- 実装ロードマップを確定([`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.2 WBSの5区分に1:1対応): Phase 1=環境構築、Phase 2=バックエンド開発(2-1 DB移行〜2-5 エクスポート/エラーハンドリング)、Phase 3=フロントエンド開発(3-1〜3-3)、Phase 4=統合テスト・QA、Phase 5=デプロイ・運用準備。詳細は[`Phase-0/Phase-0-2.md`](./Phase-0/Phase-0-2.md)参照。旧決定「Phase 1=チャットヒアリングフロー設計」はPhase 2-3に位置づけ直した。

## Phase 0 ── 初期ヒアリング入力の設計(#27: 要件・設計の確認)

この作業は#27が定めるPhase 0の範囲(要件・設計の確認)内であり、Phase 1以降ではない。まだ「Phase 1を開始する」等の明示トリガーは行っていない(#5)。将来Phase 2-3(チャットヒアリングフロー)・Phase 3-2(チャットヒアリングUI)が読む [`docs/external_design.md`](../docs/external_design.md)・[`docs/internal_design.md`](../docs/internal_design.md) 自体を、Phase 0のうちに先行して更新した。詳細は[`Phase-0/Phase-0-3.md`](./Phase-0/Phase-0-3.md)参照。着手時に参照すること:

- 初期ヒアリング入力は「概要(必須・自由記述)」「実現したいこと(必須・自由記述、箇条書き強制なし)」「補足(任意・自由記述、旧サブ機能+その他を統合)」の3項目+折りたたみ式「環境設定(任意)」に簡略化した。理由: 初期入力段階で明確な設計・構想を求めすぎないため(ユーザー方針)。箇条書き化・機能提案はチャット側でAIが行う。
- 「言語→フレームワーク」の動的コンボボックスは devex-ui に前例がなくa11yリスクが高いため**採用しない**。フレームワークは言語ごとに `<fieldset><legend>` で静的グルーピングする静的チェックボックス群(`CheckboxGroupWithLabel`流用)にする。
- `projects` テーブルに `intake`(JSONB, NULL可)カラムを追加([`docs/internal_design.md`](../docs/internal_design.md) 3.2)。初期ヒアリング入力をそのまま保持する。
- AIが「十分な要件が揃った」と判断した後も即生成せず、構造化サマリを提示してユーザーの明示的な承認を得てから生成に進む([`docs/external_design.md`](../docs/external_design.md) 2.3、[`docs/internal_design.md`](../docs/internal_design.md) 3.3に明記)。
- devex-ui調査での既知ギャップ: `TokenInput`は非制御・aria-labelなし、`InputSuggest`は静的配列フィルタのみで非同期/AI連携なし、`aria-invalid`/`aria-describedby`/`role="alert"`/`aria-live`はリポジトリ全体で未使用。新規/改修コンポーネントでは必ず配線すること。

## Phase 0 ── ドキュメント構成の分割(README.md → docs/)

`README.md`に混在していた要件定義書・外部設計書・内部設計書・実装計画書を、Devex自身が生成する4ファイル構成([`docs/external_design.md`](../docs/external_design.md) 2.3節SCR-005参照)と揃えて`docs/requirements.md`/`docs/external_design.md`/`docs/internal_design.md`/`docs/implementation_plan.md`に分割した。`README.md`は概要+リンク表のみに縮小した。内部の節番号(1.1, 2.1, 3.1, 4.1…)は維持。詳細は[`Phase-0/Phase-0-4.md`](./Phase-0/Phase-0-4.md)参照。

## Phase 0 ── Phase 1着手前の仕様診断への対応(12項目)

Phase 1着手前にユーザーへ仕様診断を提示し、全12項目の決定を得た。詳細は[`Phase-0/Phase-0-5.md`](./Phase-0/Phase-0-5.md)参照。

1. **リポジトリ構成**: `devex-api`/`devex-ui`の独立2リポジトリ構成を正とする(モノレポ案は破棄)。[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.3.2に反映。
2. **ストリーミング方式**: SSE(Server-Sent Events)を採用(WebSocketは将来の双方向リアルタイム機能が必要になった場合に再検討)。
3. **初期ヒアリング入力の文字数上限**: システム概要=全角200文字、実現したいこと=全角80文字、補足=全角400文字。
4. **ヒアリング完了判定基準**: (1)目的・課題の明確化 (2)コア機能1つ以上を「誰が・何を・なぜ」で具体化 (3)想定ユーザー像の把握 (4)MVPスコープの認識合わせ (5)環境設定未入力時は技術的制約の確認、を満たしたら「十分」と判定。
5. **`generated_documents`バージョニング**: 再生成時は新バージョンを追加(上書きしない)。直近3バージョンまで保管し、4件目生成時に最古を削除。
6. **`chat_histories.sender`を4値に拡張**: `'user'`/`'ai'`/`'intake'`(初期ヒアリング入力の記録)/`'others'`(将来拡張用)。intakeは`sender='intake'`の行として明示的に永続化する。
7. **SCR-003↔SCR-004連携**: `prompt_templates`に`default_environment`(JSONB)を追加し、テンプレート選択時にSCR-004のintake環境設定へプリフィルする。
8. **LLMコスト超過リスク**: 使用モデルはGemini Flash-Lite(無料プラン)。トークン上限超過は`LLM_QUOTA_EXCEEDED`エラーコードでハンドリング。
9. **アクセシビリティの全画面適用**: SCR-004限定だった`aria-invalid`/`aria-describedby`/`role="alert"`等の方針を[`docs/requirements.md`](../docs/requirements.md) 1.5の非機能要件として全画面に一般化。
10. **JWT仕様**: アクセストークン30分・リフレッシュトークン14日・リフレッシュトークンはhttpOnly Secure Cookie・devex-ui既存`auth-store.ts`のサイレントリフレッシュパターンを流用。
11. **マイルストーン起算日**: 個人開発のため厳密には定めない(Week 3/5/7は目安のまま維持)。
12. **`doc_type`表記統一**: `'requirement'` → `'requirements'`に変更。

## Phase 0 ── 実装着手前の仕様診断を共通ルール化(#28)

上記の仕様診断(12項目)を一度限りのレビューで終わらせず、**Phase 0内で毎回行う共通ルール**として#28を新設した(ユーザー指示、#27と同様に将来のhandoff v2引き継ぎ候補)。Phase 1のトリガー前に、`docs/`配下4文書を対象に最重要/中程度/軽微の3段階で診断し、ユーザーが決定またはAIへの提案依頼を選べる運用とする。今回はルール新設のみで、追加の診断作業は行っていない。詳細は[`Phase-0/Phase-0-6.md`](./Phase-0/Phase-0-6.md)参照。

## Phase 0 ── 「生成ドキュメントの自己診断」をプロダクト要件化

#28(CL進行ルールとしての仕様診断)を、Devexというプロダクト自体の機能要件としても明示した(ユーザー指示、#25再帰検証ルールの直接的な適用例)。[`docs/requirements.md`](../docs/requirements.md) 1.4節Must haveに「ドキュメント自己診断機能」を追加: 4文書生成後、AIが不足・不明瞭な点を最重要/中程度/軽微の3段階で自己診断しチャットに提示する。診断結果は`chat_histories`の`sender='others'`行として記録する(既存の4値化で確保していた枠を具体的な用途に確定)。詳細は[`Phase-0/Phase-0-7.md`](./Phase-0/Phase-0-7.md)参照。

## Phase 2着手前 ── 文書アップロード要件の追加

「Phase 2を開始する」の実行中(教材ファイル生成前)にユーザーから新要件が提示され、一旦中断して`docs/*.md`を先行改訂した。Phase 1〜5のロードマップ区分自体は変更なし(Phase 2-1「DB移行」・Phase 2-3「チャットヒアリングフロー設計」・Phase 3-2「チャットヒアリングUI」の中に組み込む)。教材(`textbook/Phase-2/…`)の生成はこのセッションでは行っていない(次回「Phase 2を開始する」で着手)。

- **要件本体(Must have化)**: 初期ヒアリング入力(SCR-004)時に参考資料を最大3ファイルまでアップロードできる機能を[`docs/requirements.md`](../docs/requirements.md) 1.3/1.4節に追加した。
- **データモデル**: `projects.intake`(JSONB)を拡張するのではなく、`chat_histories`/`generated_documents`と同じ粒度の新規テーブル`intake_files`を新設した([`docs/internal_design.md`](../docs/internal_design.md) 3.2節)。理由: ファイル単位の状態(成功/失敗、エラー理由)を個別に持たせやすいため。
- **ファイル実体は保持しない**: 抽出したテキストのみをDBに永続化し、元ファイルのバイナリは処理後に破棄する。理由: 現行インフラはPostgreSQLのみで、S3等のオブジェクトストレージを持たない。バイナリ保持を選ぶとPhase 1(環境構築)への手戻りが発生するため見送った。
- **対応形式をtxt・Markdown・PDFの3種類に絞った経緯**: 当初案(txt/Markdown/Word/Excel/PowerPoint/PDF)に対し、「文書内の図はどう解釈されるか」という指摘があった。GeminiはPDF/画像にはネイティブなマルチモーダル理解(図・レイアウトの解釈を含む)があるが、Word/Excel/PowerPointはLLMに直接渡せない。これらも同水準で図を解釈するにはPDF変換(LibreOffice等)という新規インフラが必要になり、Phase 1への手戻りが生じる。そのためWord/Excel/PowerPointは対象外とし、図を含む資料はユーザー側でPDF化してもらう設計にした。
- **テキスト化方式**: `txt`/`md`はそのままUTF-8テキストとして読み込む(LLM呼び出し不要)。`pdf`は既存の`app/ai/llm/gemini.py`のGeminiクライアントにファイルをそのまま渡し、LLMのネイティブなファイル理解でテキスト化する(新規のPDF解析ライブラリは追加しない)。この方式により新規ライブラリ・新規インフラを一切追加せずに済んでいる。
- **初期値(ユーザー未指定、こちらの提案で確定)**: 1ファイル最大5MB、抽出テキストは1ファイルあたり最大20,000文字(超過分は切り詰め)、処理は`POST /api/v1/projects`実行時に同期、テキスト化失敗(`FILE_EXTRACTION_FAILED`)してもヒアリングはブロックしない。PDFのテキスト化はGemini Flash-Liteのクォータを1回消費する(既存の`LLM_QUOTA_EXCEEDED`リスクと同じプール、[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.4リスク5に追記)。
- 新規エラーコード`TOO_MANY_FILES`/`UNSUPPORTED_FILE_TYPE`/`FILE_TOO_LARGE`/`FILE_EXTRACTION_FAILED`を[`docs/internal_design.md`](../docs/internal_design.md) 3.4節に追加した。

## Phase 3着手前 ── Phase 2-2「JWTリフレッシュトークンのCookie化」やり直し(#12の例外)

「Phase 3を開始する」の調査中、`devex-api`の実コード(`app/api/routes/auth.py`・`app/schemas/auth.py`)を確認したところ、[`docs/internal_design.md`](../docs/internal_design.md) 3.1節が当初(Phase 0-5時点)から定めていた「リフレッシュトークンはhttpOnly Secure Cookieに保持」という設計がコードに未反映(`register`/`login`/`refresh`/`logout`が全てJSONボディでリフレッシュトークンをやり取りし、`Set-Cookie`が存在しない)という実装ギャップが見つかった。

- **原因**: [`Phase-2/Phase-2-2.md`](./Phase-2/Phase-2-2.md)が「既存のJWT認証(汎用テンプレート由来)は無変更で再利用する」と判断し、Phase 0-5で決定済みだったCookie方式との差分点検を行わなかったこと。設計書自体は当初から正しく、ドキュメントの誤りではなく実装側の見落とし。
- **検討した2方式**: (A) httpOnly Secure Cookieに修正 ── XSS耐性・ページリロードでもログアウトされない・設計書と整合・CORSは`allow_credentials=True`済みで追加対応不要。デメリットはroutes/schemas/depsの3ファイル変更とCookie属性(`path`/`samesite`)の設計が必要なこと。(B) 現状のJSONボディ方式のまま進める ── バックエンド変更は不要だが、リフレッシュトークンをlocalStorageかJSメモリに保持することになりXSS耐性が無い、または長時間セッション(チャットヒアリング)中のページリロードで即ログアウトするUX劣化がある。設計書と決定済み事項にも反する。→ **(A)を採用**。
- **`docs/*.md`への影響**: **変更不要**。`internal_design.md`(26行目)・`external_design.md`(SCR-001)・`implementation_plan.md`(WBS該当行・§4.4リスク表)のいずれも、今回の実装修正と矛盾しない記述だった(実装が設計に追いついていなかっただけ)。
- **rule #12の例外扱い**: 本来この種の手戻りは「後続Phase(今回はPhase 3)の教材に新しい内容を書き、変更元Phaseは書き換えない」という#12の前方参照方式で扱うが、ユーザー判断により今回は例外として[`Phase-2/Phase-2-2.md`](./Phase-2/Phase-2-2.md)自体を直接書き換えた。理由: Phase 3の教材・サンプルがまだ何にも依存していないタイミングであり、過去章を書き直しても整合性コストが無いため。**#12自体の運用方針(後続Phaseでの変更は前方参照で記録する)は今後も維持する**。
- **修正内容**: `app/api/deps.py`に`REFRESH_TOKEN_COOKIE_NAME`定数・`get_refresh_token_from_cookie`・`RefreshTokenCookieDep`を追加、`app/schemas/auth.py`から`TokenPair`/`RefreshRequest`を廃止し`AccessToken`に統一、`app/api/routes/auth.py`の`login`が`Set-Cookie`で発行し`refresh`/`logout`がCookie経由で受け取るよう変更。`AuthService`本体は無変更(トークン文字列の受け渡しのみを行う設計だったため)。検証は`devex-api/backend`に一時反映して`pytest`(unit 91件green、統合テスト2件を個別実行してgreen)・`pyright`(0エラー)で確認済み、検証後は実ファイルを元に戻した(Phase 2の既存運用と同じ)。
- **Phase 3への影響**: Phase 3-1(認証基盤刷新)は当初「バックエンドCookie化+フロントエンド`auth-store.ts`書き換え」を予定していたが、バックエンド側がPhase 2-2で完了したため**フロントエンドの`auth-store.ts`刷新のみ**に縮小した。

## Phase 3-5着手前 ── Phase 2-3「ヒアリング完了判定APIルートの配線漏れ」修正(#12の例外)

Phase 3-5(チャットヒアリングUI、SSE+完了承認)の設計中、フロントエンドが`ChatService.check_completion`(ヒアリング完了の5条件判定、`HearingCompletionCheck`構造化出力)の結果を取得する手段が無いことに気づいた。`app/services/chat_service.py`にサービスメソッドと単体テスト(`test_chat_service.py`)は存在していたが、`app/api/routes/projects.py`に対応するAPIルートが配線されていなかった(Phase 2-3の教材本文には「本章では判定結果を返すところまでを実装した」とだけ記載されており、ルート化を明記し忘れていた)。

- **原因**: Phase 2-3のスコープ確認不足。サービス層の実装とテストが揃っていたため見落とされやすかった。
- **修正内容**: `GET /api/v1/projects/{project_id}/hearing-completion`を新設し、`ChatService(session).check_completion(current_project)`へ委譲するだけの薄いルートとして追加。ルート自体は`llm`を注入できないため、ルートのテストは`app.services.chat_service.get_gemini_llm`を`monkeypatch`で`FakeLLM`に差し替える方式(`test_ai_graph_nodes.py`の既存手法を踏襲)。
- **rule #12の例外扱い**: Phase 2-2のCookie化と同じ理由(Phase 3の教材・サンプルがまだこのエンドポイントに依存していないタイミングであり、過去章を直接修正しても整合性コストが無い)により、[`Phase-2/Phase-2-3.md`](./Phase-2/Phase-2-3.md)を直接書き換えた。**#12自体の運用方針(後続Phaseでの変更は前方参照で記録する)は今後も維持する**。
- **検証**: `devex-api/backend`に一時反映して`pytest tests/unit`(92件green、既存91件+新規1件)・`pyright`(0エラー)で確認済み、検証後は実ファイルを元に戻した(Phase 2の既存運用と同じ)。
- **教訓**: サービスメソッド+単体テストが揃っていても、それを呼び出すAPIルートの配線漏れは見過ごされやすい。今後のPhaseでも「サービス層の実装が完了した時点でルート層への配線漏れが無いか」を実装前チェックリスト(#11)やテスト観点の突き合わせ(#13/#15)の一環として確認する。

## Phase 3完了後 ── devex-uiテストファイルの配置を`__tests__/`サブフォルダに変更

`*.test.ts(x)`をソースの隣にcolocateする既存方針から、テスト対象と同じディレクトリ直下の`__tests__/`サブフォルダへ移行する方針に変更した(ユーザー相談、Jest由来でJS界隅での認知度が高い規約)。

- **適用範囲**: devex-ui全体(既存のデモギャラリを含む)を一括移行した。Phase 3の全サンプル(`textbook/samples/frontend/`)も同様に移行済み。
- **影響**: 相対 import が1階層深くなる(`./Foo`→`../Foo`、`../../tamagui.config`→`../../../tamagui.config`)。`devex-ui/CLAUDE.md`のTesting節を更新済み。
- **検証**: devex-ui実リポジトリで15ファイルを移動し`tsc --noEmit`・`vitest run`で確認した(既知の`Menu.test.tsx`不具合以外の新規回帰なし)。この検証中に`auth-store.ts`が旧Body方式と新Cookie方式のロジックが混在した中途状態(ユーザー自身の写経作業中)であることを発見し、ユーザーに報告済み(修正は未実施、ユーザーの作業範囲のため)。
- **Phase 3教材への反映**: `textbook/Phase-3/Phase-3-1.md`〜`Phase-3-6.md`内の全テストファイルパスを`__tests__/`含みに更新した。この移行は特定の章の内容変更ではなく機械的なパス変更のため、サンプル側のファイルにはPhaseタグを新規付与していない(rule #29はコンテンツ変更の追跡用であり、単なるファイル移動には適用しないと判断)。

## Phase 3完了後 ── 登録画面(RegisterForm)のパスワードに強度ルールを追加

ユーザー相談(`src/components/ui/form/validation/`のバリデーションルールデモギャラリを参考に)により、`registerSchema`(`src/features/auth/schemas.ts`)のパスワードへ強度ルールを追加した。

- **追加したルール**: `uppercaseRequired`/`lowercaseRequired`/`digitRequired`/`symbolRequired`(いずれも`validation-rules.ts`の既存関数、大文字・小文字・数字・記号を各1文字以上要求する)。既存の`requiredText`+`lengthRange(8,128)`はそのまま維持。
- **`loginSchema`は対象外**: ログインのパスワード欄には課さない。新ルールは新規登録時のみ適用され、既存アカウントのパスワードが遡って新ルールを満たすとは限らないため。
- **テストへの反映**: 成功系テストのパスワード値を新ルールを満たす`"S3cret-Pass"`に変更し、強度不足(英小文字のみ)を検出する新規テストケースを追加した。
- **副次的な発見**: 検証中、ユーザーの`FormGeneral.tsx`の写経に`demoDelayMs`プロパティの分割代入漏れ(型定義にはあるが関数引数のデフォルト値指定が抜けていた)があり、`ReferenceError`でテストが落ちることを発見・修正した(rule #15が想定する「写経ミスの検知」がまさに機能した例)。
- **対象外**: `textbook/samples/frontend/`は同内容に更新済みだが、[`Phase-3-2.md`](./Phase-3/Phase-3-2.md)自体は書き換えず、後続の改訂として1行の参照のみ追記した(rule #12の通常運用。Phase 3教材は既に公開済みの内容であり、Cookie化・hearing-completionのような例外は適用しない)。

## Phase 3完了後 ── Server ComponentからTamaguiを直接importできない問題

`npm run dev`実機検証で`/login`→`/register`→`/projects/new`と3画面続けて`TypeError: createReactContext is not a function`に遭遇した(ユーザーがブラウザで各画面を開くたびに発覚、その都度ユーザー自身が該当ファイルに`"use client"`を追加して解決していた)。

- **原因**: これらの`page.tsx`はいずれも`"use client"`の無いServer Componentのまま`tamagui`パッケージを直接importしていた。Reactは`package.json`の`exports`に`"react-server"`条件専用のビルド(`react.react-server.js`)を持ち、Server Component(=`"use client"`が無いモジュール)からimportされた`react`はこのビルドに解決される。実際に`node_modules/react/cjs/react.react-server.development.js`を確認したところ`createContext`という文字列は1件もヒットせず、このビルドにはContext APIが存在しない(クライアント専用の概念でRSCには無関係なため意図的に除外されている)。`@tamagui/web`の`createStyledContext`はモジュール評価時に`React.createContext`を呼んでTheme/Text等の共有Contextを作るため、この解決では`undefined(...)`呼び出しになりTypeErrorになる。
- **影響範囲**: `tamagui`から直接importしつつ`"use client"`を持たない`page.tsx`は必ずこのエラーになる。Next.js 16 + React 19 + Tamagui 2.6の組み合わせ特有の制約(`devex-ui/AGENTS.md`が警告する「訓練データに無い破壊的変更」の一種)。動的ルート`chat`/`documents`([`Phase-3-5.md`](./Phase-3/Phase-3-5.md)/[`Phase-3-6.md`](./Phase-3/Phase-3-6.md))は`params`の非同期解決のためServer Componentのまま維持しているが、tamaguiを直接importせず`ChatPageContent`/`DocumentsPageContent`という別のClient Componentに描画を委譲しているため対象外。
- **対処**: 該当ページの先頭に`"use client";`を追加する。実ファイル(`devex-ui`)側は影響範囲の4ファイル([`Phase-3-2.md`](./Phase-3/Phase-3-2.md)のlogin/register、[`Phase-3-3.md`](./Phase-3/Phase-3-3.md)のdashboard、[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)のprojects/new)すべてユーザー自身の対応により解決済みであることを確認した。`textbook/samples/frontend/`側の該当4ファイルにも同じ修正を反映済み。
- **教材の生成プロセスへの示唆**: このパターン(Server Componentからのライブラリ直接import禁止)はコード生成時のレビュー観点として一般化できる ── 以降のPhaseで新規ページを追加する際は、tamagui(または他のクライアント専用ライブラリ)を直接importするなら`"use client"`を付けるか、Client Componentに描画を委譲するかを都度確認する。

## Phase 3完了後 ── ファイルアップロードの汎用コンポーネント化

ユーザーから「ファイルアップロードは汎用コンポーネント化したい」との依頼。[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)で実装した`FileUploadField.tsx`(ヒアリング機能専用、最大件数・拡張子・サイズ・ラベル文言が全てハードコード)を、`InputSimpleText`→`InputEmail`/`InputPassword`と同じ「汎用ベース+薄い特化ラッパー」構成に分解した。

- **判断根拠(CLAUDE.md #17)**: 現時点で他に具体的なファイルアップロード機能の予定は無い(`docs/external_design.md`にチャット画面フッターの「ファイル添付(将来拡張用としてUIのみ、または無効化)」という未実装のプレースホルダが1件あるのみ)。一方`devex-ui`は`devex-ui/CLAUDE.md`が明記する通りDevexの実装であると同時に「今後のアプリ開発の土台として使うテンプレート」でもあり、`src/app/(pages)/(sample)/form-parts/`のデモギャラリ(`menu-tree.ts`に登録)がその実消費者になる ── 既存の`InputPassword`等と同じ立ち位置で「今この共通化を駆動する消費者は何か」に具体名で答えられるため実施した。
- **設計**: `src/components/ui/form/FileUpload.tsx`(新規、デフォルトエクスポート)が汎用ベース。`value`/`onChange`に加え`label`/`accept`(拡張子リスト、判定用)/`acceptLabel`(エラー文言用の人が読める表記。`accept`をそのまま結合すると元の文言と一致しなくなるため判定用と表示用を分離)/`acceptAttr`(任意、未指定時は`accept.join(",")`)/`maxFiles`/`maxFileSizeBytes`をpropsに持つ。`validateFiles(files, options)`も同じ形でパラメータ化して名前付きエクスポート。
- **`FileUploadField.tsx`は薄いラッパーに変更**: ヒアリング固有の定数(3件・txt/md/pdf・5MB・日本語ラベル)を固定して`FileUpload`に渡すだけになった。`FileUploadField`/`validateFiles(files)`という既存の公開contractは完全に維持されるため、`IntakeForm.tsx`・既存テスト(`FileUploadField.test.tsx`)は無変更のまま green(CLAUDE.md #12-4が定める「リファクタの写経ミスの番人」としての統合スモークテストの役割を果たした)。
- **デモページ**: `src/app/(pages)/(sample)/form-parts/file-upload/page.tsx`を新設し`menu-tree.ts`の`Form Parts`グループに登録。汎用コンポーネントとしての実消費者を確保した。
- **テスト**: 新規`src/components/ui/form/__tests__/FileUpload.test.tsx`(9件)。拡張子ミスマッチのテストでは、`@testing-library/user-event`の`upload()`がinputの`accept`属性で選択自体をブロックする挙動があるため、判定用の`accept` propとは別に`acceptAttr`をテスト用に緩めている(実際のゲートは常にJS側の`validateFiles`であり、`accept`属性はOSのファイル選択ダイアログ上のヒントに過ぎないという既存の設計方針と整合)。
- **samplesへの反映**: `textbook/samples/frontend/`に`FileUpload.tsx`・書き換え後の`FileUploadField.tsx`・デモページ・新規テストを反映。`menu-tree.ts`は今回samplesに初めて追加したため、ヘッダーに過去に触れたPhaseを遡って列挙した(`# 更新：Phase-3-1,3-2,3-3,3-4`)。個別の`Phase-3-N:追記/更新`インラインタグは、パスワード強度ルール追加のときと同じ前例に倣い、`menu-tree.ts`の新規行以外には付けていない(内容変更点はこの節と[`Phase-3-4.md`](./Phase-3/Phase-3-4.md)に記録する運用のため)。

## Phase 2完了後 ── チャット応答のrepr化バグ修正とヒアリングプロンプト調整

実機検証で、ヒアリングチャットのAI返信が`[{'type': 'text', 'text': '...\n...', 'extras': {'signature': '...'}}]`のようなPythonのrepr文字列(波括弧・引用符・エスケープされた`\n`)としてそのまま表示される不具合が見つかった。

- **原因**: [`Phase-2-5.md`](./Phase-2/Phase-2-5.md)の`ChatService.stream_reply`(`app/services/chat_service.py`)が、Geminiのストリーミングチャンクの`content`に無条件で`str()`を適用していた。Geminiが応答パートに`thought_signature`(内部推論の継続性を保つためのメタデータ。`gemini-2.5-flash`等でも付与されうる)を付与すると、`langchain-google-genai`は`AIMessageChunk.content`を`str`ではなく`[{"type": "text", "text": "...", "extras": {"signature": "<base64>"}}]`という辞書のリストに変える。これに`str()`を適用するとPythonのrepr(波括弧・引用符・`\n`のエスケープ表示)がそのまま出力され、SSEストリーミングとして即座にフロントへ流れると同時に、`chat_histories.message`(`Text`カラム)へもそのまま永続化されていた。
- **対処**: `content`から`text`フィールドだけを安全に取り出す`_extract_text()`ヘルパーを追加し、`str(chunk.content)`を置き換えた。テキストを持たない(signatureのみの)チャンクは`yield`しない。
- **フロント側は変更不要と判断した理由**: `ChatHistoryEntry{sender, message}`(`devex-ui/src/features/hearing/api/hearingApi.ts`)は既に`sender`で発言者を区別しており、`MessageBubble.tsx`も`sender==="user"`なら生テキスト、それ以外(`ai`/`intake`)は`react-markdown`でMarkdownとして描画する設計になっている ── つまり「発言者ごとに表示方法を分ける」という構造は既に実装済みで、真因はバックエンドが応答構造を検査せず`str()`していたことだった。修正後は`text`フィールドの実際の改行文字がそのまま渡るため、`\n`のエスケープ表示問題も同時に解消される。
- **既存データへの言及**: `_build_messages`は対話履歴を毎回LLMへ渡す設計のため、修正前に保存された壊れたAI応答は、表示上の見た目だけでなく今後の対話コンテキスト(応答品質)にも影響し続ける。データ移行・既存プロジェクトの手動修復は今回のスコープ外とした。
- **ヒアリングプロンプトの調整**: `_HEARING_SYSTEM_PROMPT`に「ユーザーが確認を求めていない限り、既に提示された内容を要約・反復しない」「要件確定に必要な不足点を吟味した上で、シンプルな質問・選択肢の提示など簡潔な問いかけに絞って返信する」という指示を追記した。
- **テスト**: `tests/fixtures/fake_llm.py`の`_FakeChunk`/`stream_chunks`がGeminiのlist-of-dict形状も渡せるよう型を緩め、`tests/unit/test_chat_service.py`に「thought signature付きcontentからtextのみ抽出される」「textを持たないチャンクはyieldされない」の2ケースを追加した(`uv run pytest tests/unit`94件green、`uvx pyright`0エラーを確認済み)。

## 初回ヒアリング表示の整形 + AIの最初の発話の自動生成

プロジェクト作成直後、チャット画面に`{"system_overview": "...", "goals_raw": "...", "notes_raw": null, "environment": null}`という生JSONがそのまま表示される不具合が見つかった。原因は[`Phase-2-3.md`](./Phase-2/Phase-2-3.md)の`ProjectService.create`(`app/services/project.py`)が`json.dumps(intake, ensure_ascii=False)`を`chat_histories`(`sender='intake'`)にそのまま保存していたこと。`docs/external_design.md` SCR-004 §2.3は「チャット開始直後、AIの最初の発話は初期ヒアリング入力の内容を踏まえた理解の要約と確認質問から始まる」と定めているが、実装ではプロジェクト作成後ユーザーが最初のメッセージを送るまでAIが一切発話しない状態だったため、この生JSONだけが画面に残っていた。

このタスクはユーザーから「claude側でプロジェクトに反映」と明示指示があったため、[[feedback_direct_impl_scope]]の既定(samples-only)の例外として実プロジェクトへ直接反映した。

- **intake要約の整形**: `app/services/project.py`に`_format_intake_summary(intake)`を追加し、`システム概要：{system_overview}\n実現したい事：{goals_raw}\n(その他備考：{notes_raw}、値がある場合のみ)`という表示テキストに置き換えた。`environment`は表示から除外。
- **environmentの扱い**: ユーザー確認の結果、「表示からは外すがLLMコンテキストには渡す」を採用(ヒアリング完了判定5条件目「技術的な制約・希望の確認」の材料であるため)。`chat_service._build_messages`に`project: Project`引数を追加し、`project.intake["environment"]`があれば`HumanMessage`として注入する(`chat_histories`には保存しない ── 表示に一切影響させないため)。
- **AIの最初の発話**: ユーザー確認の結果、「プロジェクト作成時に同期生成」を採用。`ChatService.generate_opening_reply()`を新設し、`app/api/routes/projects.py`の`create_project`から`ProjectService.create`直後に1回呼び出す。専用プロンプト`_OPENING_TURN_PROMPT`で「以上を元に詳細のヒアリングを進めていきます。→【確認したい事】(3点の箇条書き)→まず、{最初の質問}」という形式を指示する。失敗時(`LLMQuotaExceededError`/`GenerationFailedError`)はプロジェクト作成自体は成功させ、ユーザーは通常通りチャット欄から発話を始められるようにした。
- **改行描画の修正(`remark-breaks`)**: `MessageBubble.tsx`は`remark-gfm`のみでCommonMark標準の「単一改行は段落内の空白扱い」のままだったため、intake要約の3行やAIの箇条書きが1行に潰れて表示される問題があった。`remark-breaks`を追加し解決した。**副次的な発見**: `devex-ui/package.json`に`react-markdown`/`remark-gfm`自体が実は宣言されておらず(`node_modules`に手動または過去の`--no-save`相当の操作で存在していただけの「extraneous」パッケージだった)、`npm install remark-breaks`実行時に誤って両方削除される事故が発生した。両方を正式に`package.json`へ追加して復旧した(今後`npm ci`/フレッシュcloneでも正しくインストールされるようになる、副次的な改善)。
- **既存データの整理**: 対象2プロジェクトの生JSON intake行を、一回限りのスクリプトで整形済みテキストに書き換えた(両プロジェクトとも既に後続のAI発話が複数回あるため、遡って「最初のAI発話」を合成・挿入することはしていない)。
- **samplesへの反映**: `textbook/samples/backend/`(`project.py`/`chat_service.py`/`routes/projects.py`/関連テスト)・`textbook/samples/frontend/src/features/hearing/components/MessageBubble.tsx`に同じ変更を反映した。samples/frontendは`package.json`を持たないため、写経時に`npm install remark-breaks`を別途実行する必要がある旨を申し送る。

## 添付ファイル抽出結果の表示非表示化 + repr化バグの横展開修正(3箇所目)

新規プロジェクト作成後のヒアリング画面で、2つ目のMessageBubbleに添付PDFの抽出結果がそのまま表示される不具合が見つかった。しかもその抽出結果自体が、前回修正した`chat_service.py`と全く同じ`str(response.content)`によるrepr化バグを含んでいた(`app/services/intake_file_processor.py:70`の`_extract_pdf_text`)。調査の過程で`app/services/doc_generator_service.py`の`_generate_one`・`_self_diagnose`にも同じバグが見つかり、**これで3箇所目**。CLAUDE.md #17に基づき、`_extract_text`を`chat_service.py`から`app/ai/llm/gemini.py`へ移し`extract_text_content`として3箇所で共有した。

- **当初案からの方針転換**: 当初は`chat_histories`から添付ファイルecho行を削除し、`intake_files`テーブルから`_build_messages`へ注入し直す設計を検討したが、ユーザーの指摘で調査した結果、`doc_generator_service.py`の`DocGeneratorService.generate`は`chat_histories`の全履歴だけをドキュメント生成の入力にしており、`intake_files`テーブルは一切読んでいないことが判明した。`chat_histories`echoを削除すると、ヒアリング対話のLLMコンテキストは復元できてもドキュメント生成には反映されなくなり、新しい欠落を生むだけだったため、**`chat_histories`への書き込み自体はそのまま維持し、表示層のみを変更する**方針に転換した。
- **表示除外の判定方法の再検討**: 当初`m.message.startsWith("[添付ファイル: ")`という文字列prefix一致でフロント側を実装しようとしたが、ユーザーから「バックエンドの書式が変わったら判定がすり抜ける」との指摘があった。この文字列自体はPython側のf-stringが機械的に生成する固定書式でLLM生成ではないため表記ゆれの心配は無いものの、フロントとバックエンドで別々に書かれた文字列リテラルが暗黙に一致しているという結合自体が壊れやすいという指摘は妥当と判断し、`sender`に新しい値`"attachment"`を追加して構造化された判定に変更した(`app/schemas/hearing.py`・`hearingApi.ts`の`ChatSender`)。DB側は`chat_histories.sender`が`String(20)`でCHECK制約が無いためマイグレーション不要。
- **`ProjectService._ingest_file`**: `chat_histories.add(...)`の`sender`を`"intake"`から`"attachment"`に変更(メッセージ本文自体は可読性のため維持)。`_format_intake_summary`にファイル名リストを渡せるようにし、1つ目のバブル(intake要約)に「添付ファイル：{ファイル名}」を追記するようにした。
- **`_build_messages`・`_render_transcript`**: `sender="attachment"`もHumanMessage/transcript行として扱うよう受け皿を広げた(ヒアリング対話・ドキュメント生成への実質的な影響は無い、従来`sender="intake"`だったものが`"attachment"`に変わっただけ)。
- **フロントエンド**: `ChatPanel.tsx`で`messages.filter((m) => m.sender !== "attachment")`により表示から除外(文字列内容は一切見ない)。
- **既存データの整理**: `intake_files.extracted_text`のrepr化(2件)・対応する`chat_histories`echo行のsender変更+本文復元(2件)・該当2プロジェクトのintake要約へのファイル名追記(2件)を一回限りのスクリプトで実施した。
- **samplesへの反映**: `textbook/samples/backend/`(`app/ai/llm/gemini.py`(新規)・`app/schemas/hearing.py`・`intake_file_processor.py`・`doc_generator_service.py`・`chat_service.py`・`project.py`・関連テスト)、`textbook/samples/frontend/src/features/hearing/components/ChatPanel.tsx`・`src/features/hearing/api/hearingApi.ts`に同じ変更を反映した。

## ドキュメント生成: 4文書専用プロンプト + 連鎖生成への置き換え

ユーザーから、参考にした外部のAIエージェントワークフロー(4段階のLLM処理チェーン: ユーザー入力→要件定義→外部設計→内部設計→実装計画。当プロジェクトの`docs/*.md`自体を実際に生成した実績がある)を提示され、これを`doc_generator_service.py`の設計に反映するよう依頼があった。

- **現状とのギャップ**: `docs/internal_design.md` 3.3節は元々「それぞれに特化したプロンプトを実行」と明記していたが、実装は4種共通の汎用テンプレート(`{label}`を差し替えるだけ)を使い回しており、出力フォーマット(見出し構成)の指定も無く、この仕様を完全には満たしていなかった。textbook各章(Phase-2-4/2-5)を確認したが、連鎖構成が検討された形跡は無く、単に検討されなかっただけで意図的な見送りではないと判断した。
- **採用した設計**: `_DOC_TYPE_PROMPTS`(doc_typeごとの特化プロンプト、出力フォーマット指定込み)+`_DOC_TYPE_INPUTS`(前段で確定済みの文書への参照関係)を新設し、`_generate_one`を「requirementsのみチャット全履歴を直接読み、それ以外(external_design/internal_design/implementation_plan)は前段で確定済みの文書だけを入力にする」連鎖構成に変更した。参照関係は提示されたワークフローの実プロンプトに忠実(external_designはrequirementsのみ、internal_designはrequirements+external_design、implementation_planはrequirements+internal_designで、external_designは直接には渡さない)。
- **追加検討: 当初のテンプレート仕様を超えて反映されていた書式の洗い出し**: ユーザーからの追加依頼を受け、当プロジェクト自身の`docs/requirements.md`〜`implementation_plan.md`を実際に作成した際、提示されたプロンプトの出力フォーマット指定を超えて一貫して採用されていた書式を確認した。ドメインに依存しない汎用的な指針は`_COMMON_FORMAT_GUIDANCE`(全doc_type共通の末尾指示)およびdoc_typeごとの出力フォーマットに反映し、Devex自身に固有の内容は反映しなかった:
  - 反映したもの(汎用的な書式): 一覧性の高い情報はMarkdownテーブルで整理する/複数観点を含む見出しは番号付きサブセクションに展開する/構造図はコードブロックのテキスト図で示す/画面一覧は表形式(画面ID・画面名・役割・優先度)/画面ごとに`### 画面ID: 画面名`の小見出し/テーブル定義はテーブルごとに見出し+Markdownテーブル/APIエンドポイント一覧・ディレクトリ構成の表現方法/各フェーズ見出しへのMoSCoW優先度明記/タスクのチェックボックス形式/リスクの「**リスクN**+*対策*」形式。
  - 反映しなかったもの(Devex固有): 実装計画書が「フェーズ」ではなく「ステージ」という語を使っている点 ── これはCL(Curriculum Loop)開発の教材単位「Phase」との混同を避けるための、Devexというこのプロジェクト固有のリネーム(`CLAUDE.md`「進行のルール」#27参照)であり、Devexが生成するエンドユーザーのプロジェクト向け文書には無関係のため、生成プロンプトには反映しなかった(生成対象のテンプレートは今後も「フェーズ」のまま)。同様に、具体的なテーブルスキーマ・技術スタック名・画面ID等の実データも、Devex自身のドメイン内容であり汎用テンプレートには含めていない。
- **影響範囲**: 変更ファイルは`app/services/doc_generator_service.py`1つのみ。DBスキーマ・ルート・フロントエンド変更なし。`docs/internal_design.md` 3.3節の記述も、連鎖構成であることが分かるよう更新した。
- **テスト**: `test_doc_generator_service.py`に、`FakeLLM.invoke_messages`を使って各doc_typeへ渡される`HumanMessage`の中身を検証する新規テストを追加した(external_designはrequirementsのみ、internal_designはrequirements+external_design、implementation_planはexternal_designを含まないことを確認)。
- **samplesへの反映**: `textbook/samples/backend/app/services/doc_generator_service.py`・`tests/unit/test_doc_generator_service.py`に同じ変更を反映した(既存のPhase-2-4/2-5由来のコメント履歴タグはそのまま維持し、新規のPhaseタグは付けていない ── パスワード強度ルール追加時と同じ前例)。

## HearingCompletionBannerが画面更新・再遷移で消える不具合の修正

`HearingCompletionBanner`は`useHearingStore`の`completion`/`generationTriggered`(どちらも`persist`未使用の非永続状態)が揃ったときのみ表示される。`completion`は`sendMessage`の返信完了時にのみ`getHearingCompletion`で更新されており、画面マウント時に呼ばれる`loadHistory`は`getChatHistory`しか呼んでいなかった。そのため、バナー表示後に画面を更新/再遷移するとストアが初期状態(`completion: null`)にリセットされ、ヒアリングが完了条件を満たしたままでもバナーが消えてしまっていた。

- **対応**: `loadHistory`で`getChatHistory`と`getProject`(`ProjectRead.status`)を並行取得し、`status !== "interviewing"`なら`generationTriggered`をtrueに復元、`status === "interviewing"`の場合のみ`getHearingCompletion`を再問い合わせして`completion`を復元するようにした。生成トリガー済み/完了済みの場合は無駄な`check_completion`(LLM呼び出し)を避ける。
- **副次的な効果**: `generationTriggered`も同様に非永続だったため、「生成トリガー済み/完了済みの状態で画面を更新するとバナーが誤って再表示される」という鏡合わせの潜在バグも同時に解消された。
- **反映範囲**: この依頼は直接指示が無かったため[[feedback_direct_impl_scope]]の既定どおり`textbook/samples/frontend/src/features/hearing/hearing-store.ts`・`__tests__/hearing-store.test.ts`のみに反映した(実devex-uiへの反映はユーザーの手写経に委ねる)。検証は実devex-uiへ一時的に反映して`tsc`/`vitest`を実行し、検証後に元の内容へ復元する形で行った(内容はsamplesと同一のため再掲しない)。

## プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正

上記の修正には欠陥があった。`generationTriggered`の判定を単に`status !== "interviewing"`とすると、`generating`(生成進行中でポーリングすべき)と`completed`(過去に生成済み)を区別できず、`completed`のプロジェクトでチャット画面を開くと即座に`/documents`へ強制リダイレクトされ、チャットをやり直せなくなる不具合が新たに生じた。ユーザーからの指摘: (1) 判定を`status === "generating"`に直すだけでは、「チャットに戻って新規メッセージを送る」という行為がプロジェクトの状態に何も反映されず、ダッシュボードは相変わらず「完了」のままになる、(2) そもそも「チャットに戻る」は必ずしも「今の内容を修正したい」を意味しない(見るだけの場合もある)。この指摘を受け、単純な条件式の修正ではなく、`revising`という新しいステータスを導入する設計に改めた。

- **状態遷移**: `interviewing → generating → completed`(既存)に加え、`completed`の状態で**ユーザーが新規チャットメッセージを実際に送信した時点**(画面を開いただけでは発生させない)で`revising`(修正中)へ遷移する。`revising`からもヒアリングが十分になれば通常通り承認・再生成を経て`completed`へ戻る。`generate()`の失敗時の差し戻し先は、従来固定だった`interviewing`ではなく`generate()`開始時点のステータス(`interviewing`または`revising`)にした ── `revising`から再生成に失敗して`interviewing`に戻ってしまうと「生成済みだった」という文脈を失うため。
- **`generationTriggered`(ポーリング対象)は`generating`のときのみtrue**にした。`completed`/`revising`は共に`generationTriggered=false`とし、自動リダイレクトは発生させない。代わりに`ChatPageContent.tsx`に「生成済みのドキュメントを見る →」という常設リンク(`completed`/`revising`のとき表示)を配置し、遷移するかどうかはユーザーの操作に委ねる設計にした。
- **`hearing-store.ts`**: `loadHistory`が取得済みの`getProject`の結果を`projectStatus`としてストアに保持し(新規フェッチを増やさない)、`ChatPageContent.tsx`の常設リンク表示判定に使う。`getHearingCompletion`の再問い合わせ(HearingCompletionBanner復元)は`interviewing`/`revising`の両方で行う(`revising`中の再ヒアリングでもバナーが機能するようにするため)。
- **(B) ドキュメントプレビュー画面の2件の修正(ユーザー報告)**: ①ダウンロードファイル名が本プロジェクトリポジトリ`docs/`配下の実ファイル名(`requirements.md`等)と一致していなかったため、`{project_name}_{document_type}_{YYYYMMDD}.md`から`{document_type}.md`に変更した。②Markdownプレビューの見出し同士の行間が詰まって見える・テーブルに罫線が無く関連が把握しづらいという指摘を受け、`ReactMarkdown`に`components`propを追加し、見出し(`H1`〜`H4`)・段落は明示的なmarginを持つTamaguiコンポーネントへ、リスト・テーブルはTamaguiが`tag`上書きに対応していないため素のHTML要素+インラインstyle(`var(--borderColor)`でテーマ追従、既存の`filter`prop対応と同じパターン)へマッピングした。
- **反映範囲**: ユーザーから「提案内容でOK。claudeでプロジェクトに反映する。」と明示指示があったため、[[feedback_direct_impl_scope]]の既定(samples-only)の例外として実devex-api/実devex-uiへ直接反映した(バックエンド: `app/schemas/project.py`・`app/models/project.py`・`app/services/chat_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・関連テスト。フロントエンド: `features/dashboard/api/projects.ts`・`ProjectListItem.tsx`・`hearing-store.ts`・`ChatPageContent.tsx`・`DocumentMarkdownView.tsx`・関連テスト)。`uv run pytest tests/unit`(113件)・`uvx pyright`(0エラー)・`npx tsc --noEmit`・`npx vitest run`(既知の無関係な事前失敗を除き green)で検証済み。`textbook/samples/{backend,frontend}/`の対応ファイルにも同じ変更を反映した(既存のPhaseタグ・ヘッダーコメントは変更せず、内容のみ上書き ── パスワード強度ルール追加時と同じ前例)。
- **副次的な発見**: samplesへの反映作業中、`textbook/samples/frontend/`の`hearing-store.ts`/`ProjectListItem.tsx`等は正しく最新化されていた一方、`hearingApi.ts`の`ChatSender`型と`ChatPanel.tsx`のフィルタリングには、以前の「添付ファイル抽出結果の表示非表示化」節(`sender='attachment'`追加)の反映漏れが見つかった(decision-digestには反映済みと記録されていたが実ファイルには適用されていなかった)。今回あわせて是正した。

## チャットに戻った際、自己診断結果(レビュー結果)が再表示される不具合の修正

ユーザー報告: 「チャットに戻る」でチャット画面に遷移すると、生成完了後の自己診断結果(`sender='others'`の`chat_histories`行)がチャットバブルとしてそのまま表示されてしまう。上記の`revising`導入とあわせて常設ドキュメントリンクを配置したことで、チャット履歴内に生の自己診断結果が並ぶ意味が薄れ、単に煩雑という指摘。

- **対応**: `ChatPanel.tsx`の表示フィルタを、既存の`sender !== "attachment"`に`sender !== "others"`を追加する形で拡張した(`sender='attachment'`除外時と全く同じ「センダーで判定し、文字列内容は見ない」パターン)。`chat_histories`への保存自体・ドキュメント生成/対話のLLMコンテキストとしての利用は変更していない(あくまで表示層のみの変更)。
- **`MessageBubble.tsx`の追従**: `ChatPanel`がsender='others'を渡さなくなったため、`isDiagnosis`(黄色背景)分岐が到達不能なデッドコードになった。分岐ごと削除し、コメントを「sender='others'/'attachment'はChatPanel側で除外済み」に更新した。
- **`docs/external_design.md`への反映は見送り**: SCR-004 §2.3「自己診断結果をチャットに提示する」という記述、SCR-005の「AIによる精査結果を見るボタン(チャット内の自己診断メッセージへスクロール)」は共に現状未実装(後者はボタン自体が存在しない)であり、以前の添付ファイル表示非表示化時と同じ前例(データ保存とLLMコンテキストは変えず表示層のみを変える変更はdocsへ反映しない)に倣い、今回もdocsは変更しなかった。
- **反映範囲**: ユーザーから「claudeでプロジェクトに反映」と明示指示があったため実devex-uiへ直接反映した(`ChatPanel.tsx`・`MessageBubble.tsx`・`ChatPanel.test.tsx`に`sender==='others'`のケースを追加)。`npx tsc --noEmit`(既知の無関係な`FileUpload.tsx`エラーのみ)・`npx vitest run src/features/hearing`(42件green)で検証済み。`textbook/samples/frontend/`の同ファイルにも反映した(このタイミングで上記の副次的発見(`attachment`の反映漏れ)も合わせて是正済みの状態に揃えた)。

## ドキュメントダウンロードのファイル名がUUIDになる不具合の修正(CORS `expose_headers`未設定)

ユーザー報告: 外部設計書をダウンロードすると、ファイル名が`fd6b2d9d-b6cc-4fa7-a168-9f3b1be1418c.md`(ドキュメントのUUID)になる。文字化けではなかった。

- **根本原因**: バックエンド(`download_generated_document`)は`Content-Disposition: attachment; filename="external_design.md"; filename*=UTF-8''external_design.md`を正しく返しており(本セッション内で先に修正・検証済み)、フロントエンド(`documentsApi.ts`の`downloadDocument`)もヘッダーを正しくパースするロジックを持っていた ── **両方とも実装は正しかった**。抜けていたのは`app/main.py`のCORSミドルウェア設定。`Content-Disposition`はブラウザのCORSセーフリスト対象ヘッダーではないため、サーバーが`Access-Control-Expose-Headers`で明示的に許可しない限り、クロスオリジンの`fetch()`(devex-ui `localhost:3000` → devex-api `localhost:8000`)からJSで`res.headers.get("Content-Disposition")`を読むことができず`null`になる。`downloadDocument`はこのケースに備えて`parseFilename(...) ?? \`${docId}.md\``という(意図的な)フォールバックを持っており、これが発火してユーザー報告の症状になっていた。
- **対処**: `app/main.py`の`CORSMiddleware`に`expose_headers=["Content-Disposition"]`を追加。
- **テスト**: `tests/unit/test_cors.py`(新規)。DB/Redis接続が必要な実エンドポイント経由のテストは重いため、`test_body_size_limit.py`と同様の軽量パターンで、`app.main.app`の実際のミドルウェア登録内容(`app.user_middleware`、Starletteの`Middleware.cls`/`Middleware.kwargs`)を直接検査する形にした(DB非依存・高速、かつ実際の設定を直接見るため設定ドリフトの心配もない)。
- **samplesへの反映は無し**: `app/main.py`はCL教材(curriculum)の対象外のスターターテンプレートファイルであり、`textbook/samples/backend/`に対応ファイル自体が存在しない([`Phase-1-1.md`](./Phase-1/Phase-1-1.md)が「CORSは変更不要だった」と記録している既存インフラのため)。今回も実`devex-api`のみを直接修正した。
- **反映範囲**: ユーザー報告への直接対応(実環境で再現するバグ修正)のため、[[feedback_direct_impl_scope]]の既定の例外として実devex-apiへ直接反映した。`uv run pytest tests/unit`(114件green)・`uvx pyright`(0エラー)で検証済み。
