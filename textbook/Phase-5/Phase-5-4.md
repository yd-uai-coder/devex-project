# Phase-5-4: README整備の続き + GitHub Actionsによる自動デプロイ

## この章の目的

Phase 5(5-1〜5-3)完了後にユーザーから追加された2件の依頼に対応する: (1) `devex-api`/`devex-ui`のREADME.mdが依然として汎用テンプレートの説明のままである点の是正、rootのREADME.mdへのリンク追加、(2) GitHub Actionsによる自動デプロイ設定の追加。あわせて、CI導入にあたって発覚した`devex-api`の既存lintエラー(49件)を是正する。

納期モード([`Phase-5-introduction.md`](./Phase-5-introduction.md)参照)。

## この章で作成・更新したファイル

- [`README.md`](../../README.md)(root) ── devex-api/devex-uiへのリンク表を追加
- [`devex-api/README.md`](../../devex-api/README.md) ── 冒頭をDevex機能の説明に書き換え、既存のテンプレート説明を「本リポジトリの位置づけ」節として保持。「未実装・今後対応が必要な事項」に3件の既知課題(`prompt_templates`放置等)を追記。CI/CD節を新設
- [`devex-ui/README.md`](../../devex-ui/README.md) ── 同様に冒頭へ「Devexとしての主な機能」節を追加、既存のコンポーネントカタログはそのまま保持。CI節を追加
- [`devex-api/.github/workflows/deploy.yml`](../../devex-api/.github/workflows/deploy.yml)(新規)
- [`devex-ui/.github/workflows/ci.yml`](../../devex-ui/.github/workflows/ci.yml)(新規)
- [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md) ── 「9. GitHub Actionsによる自動デプロイ」節を新設、「6. ロールバック手順」にrevert運用を追記
- `devex-api/backend/`配下の既存lintエラー是正(コメント・docstringの折り返しのみ、詳細は下記)
- `devex-ui/vitest.config.mts`・`src/features/hearing/components/HearingCompletionBanner.tsx`・`src/hooks/useGenerationPolling.ts`・その他3ファイルの既存debt是正(詳細は下記)

## README整備

`devex-api/README.md`・`devex-ui/README.md`はいずれも「元々汎用テンプレートとして書かれた説明」が冒頭に来ており、Devexの実際の機能(認証・プロジェクト管理・チャットヒアリング・ドキュメント生成/`devex-api`側、ダッシュボード・チャットヒアリング画面・ドキュメントプレビュー/`devex-ui`側)への言及が無かった。両ファイルとも次の方針で書き換えた:

- 冒頭に「Devexとしての主な機能」節を新設し、実際のドメイン機能・実装ファイルへのポインタを示す。
- 既存のテンプレート説明(技術スタック表・ディレクトリ構造・コンポーネントカタログ等)は削除せず、「本リポジトリの位置づけ(テンプレートとしての出自)」という節に位置づけ直して保持した。**削除しなかった理由**: root [`CLAUDE.md`](../../CLAUDE.md)がリポジトリ構造節で明記する通り、`devex-api`は「reusable backend starter template」、`devex-ui`は「UI component/demo gallery」という二重の性格を最初から持っており、この性格は本Phaseでも変えない。

root `README.md`には、2つの独立リポジトリへのリンク表(GitHubのURL、README/CLAUDE.md/OPERATIONS.mdへの相対リンク)を追加した。

### `devex-api/CLAUDE.md`・`devex-ui/CLAUDE.md`はいずれも削除しなかった

ユーザーから当初「両ファイルともテンプレート作成時のままなので削除し、gitignore化する」という依頼があった。調査の結果:

- **`devex-api/CLAUDE.md`**: レイヤー構成・エラーハンドリングの設計判断・LangGraph連携・レート制限・テストの分離という、現在の実装を正確に反映した内容であり、「テンプレート作成時のまま」という前提が誤りだった。root `CLAUDE.md`・各Phase教材が「読むべき前提」として繰り返し参照している。
- **`devex-ui/CLAUDE.md`**: 一見テンプレート(next-tamagui-templates)の説明のみに見えるが、Testing節(`__tests__/`配置規約、[`Phase-3-introduction.md`](../Phase-3/Phase-3-introduction.md)参照)・バックエンド連携節(`apiFetch`/`serverFetch`/TTLキャッシュパターン)は、Phase 3完了後の相談を通じて実際に更新され続けていた(`decision-digest.md`「Phase 3完了後」の複数エントリが「`devex-ui/CLAUDE.md`のTesting節を更新済み」と明記している)。こちらも「テンプレート作成時のまま」ではなかった。

この事実をユーザーに提示した上で、最終的に**両方とも削除しない**方針で確定した。一度は誤って`devex-ui/CLAUDE.md`を削除してしまったが、ユーザーからの指摘の前にgit(`git checkout HEAD --`)で復元済みである。

## GitHub Actionsによる自動デプロイ

`devex-api`(ConoHa VPS)と`devex-ui`(Vercel)でデプロイ先の性質が異なるため、ワークフローの構成も異なる。

```yaml
# devex-api/.github/workflows/deploy.yml(抜粋)
jobs:
  test:
    steps:
      - run: uv sync --locked
      - run: uv run ruff check .
      - run: uv run pytest -m "not integration"
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd "${{ secrets.VPS_DEVEX_API_PATH }}"
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build
            docker compose -f docker-compose.prod.yml exec -T backend uv run alembic upgrade head
```

- **レジストリ経由(GHCRへpush→VPSでpull)ではなく、VPS上での`git pull`+再ビルド方式を採用した**。個人開発規模のVPS1台構成では、コンテナレジストリの認証・追加シークレット管理のコストに見合わないと判断した(CLAUDE.md #17)。[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)3節の手動初回デプロイ手順(`git pull`前提)とも地続きになる。
- 必要なGitHub Secrets(`VPS_HOST`・`VPS_USER`・`VPS_SSH_KEY`・`VPS_DEVEX_API_PATH`)は実際の値を私(AI)が知り得ないため、ワークフローはシークレット参照のみとし、設定手順は[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)「9. GitHub Actionsによる自動デプロイ」に記載した。
- このワークフローは**2回目以降の更新反映を自動化するもの**であり、初回セットアップ(VPSへのgit clone・`.env`配置・初回手動デプロイ)自体は自動化しない。

```yaml
# devex-ui/.github/workflows/ci.yml(抜粋、deployジョブ無し)
jobs:
  test:
    steps:
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

`devex-ui`はVercelのネイティブGitHub連携が既に自動デプロイを担う(リポジトリ接続のみで`main`へのpushごとに自動デプロイされる、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)8節)。Actions側に重ねてデプロイジョブを追加する(Vercel連携を無効化し`vercel` CLI+トークンでActions駆動に切り替える)ことも可能だが、個人開発規模でその複雑さに見合うメリットが無いため見送った。CIは push/PR時のlint・test・buildのゲートのみを担う。

## `devex-ui`側の既存debt是正(CI導入で発覚)

`devex-api`と同様、`devex-ui`側もCI導入(`npm run lint`・`npm run test`・`npm run build`)を実際にローカルで流したところ、以下の既存debtが見つかった。いずれも本章の一部として是正した(理由は`devex-api`のlint是正と同じ、CLAUDE.md #17: 新設したCIワークフロー自身が実在の消費者)。

- **`vitest.config.mts`が`e2e/devex-flow.spec.ts`(Playwright仕様)を誤って収集していた**: `exclude`に`**/e2e/**`が含まれておらず、Vitestのデフォルト`include`パターン(`**/*.spec.ts`等)にマッチしてしまい、`npm run test`のたびに「Playwright Test did not expect test() to be called here」という無関係なエラーで1ファイル分必ず失敗していた。`exclude`に`"**/e2e/**"`を追加して解消した。この設定漏れが、テストスイート全体を並列実行した際にごく稀に別のテストファイル(`RegisterForm.test.tsx`)を巻き添えにして見えることがあった(修正後、フルスイートを3回連続実行してgreenを確認、単独実行でも3回連続green)。
- **`HearingCompletionBanner.tsx`のReact Hooksルール違反(`react-hooks/rules-of-hooks`)**: `if (!completion.is_sufficient) return null;`という早期returnの**後**に`useHearingStore(...)`を呼んでおり、hookが条件付きで呼ばれる状態になっていた(レンダーごとにhook呼び出しの有無が変わりうる、Reactの規約違反)。`useHearingStore`の呼び出しを早期returnより前に移動して解消した(見た目の挙動は変わらない、単なる呼び出し順序の是正)。
- **`useGenerationPolling.ts`の`react-hooks/set-state-in-effect`(2件)**: `timedOut`という状態を「`elapsedMs`が閾値を超えたら`useEffect`内で`setTimedOut(true)`」という同期的effectで管理していたが、`elapsedMs >= POLL_TIMEOUT_MS`という単純な導出値に置き換え、専用のstate+effectを丸ごと削除した(Reactの「エフェクトを使わない派生state」の推奨パターンそのもの)。もう1件(`active`がfalseに戻った際の`elapsedMs`リセット)は外部シグナルへの同期という正当なeffectの使用例であり、対応する複雑な代替パターン(レンダー中の状態調整)を導入するコストに見合わないと判断し、該当行のみ`eslint-disable-next-line`で抑制し理由をコメントで残した。
- **3件の未使用import警告**(`XStack`(`register/page.tsx`)・`useEffect`(`FormGeneral.tsx`)・`H1`(`Counter.tsx`))を削除。

修正後、`npm run lint`は0件、`npm run test`は190件green(3回連続)、`npm run build`成功、`npx tsc --noEmit`もエラー無しを確認した。

## 既存lintエラーの是正(devex-api、49件のE501 + 1件のSIM105)

CI導入にあたり`uv run ruff check .`をゲートに含めたところ、`devex-api/backend/`に既存の65件のリントエラー(Phase 2〜4を通じて一度もruffが実行されてこなかったことに起因)が見つかった。このままではCIが恒久的に赤くなるため、本章の一部として是正した。

- 機械的に修正可能な15件(`--fix`/`--fix --unsafe-fixes`で対応: import順序・末尾改行・行末空白)はツールに任せた。
- 残り50件(49件のE501、1件のSIM105)は手作業で修正した。大半はDevex固有ドメイン(`doc_generator_service.py`・`intake_file.py`・`prompt_template.py`等)の日本語コメント・docstringが100文字制限を超えていたもので、内容(ロジック)を変えずに折り返した。
- `app/api/routes/projects.py`のSIM105(`try`/`except`/`pass`)は`contextlib.suppress(...)`へ置換した。

修正後、`uv run ruff check .`は0件、`uv run pytest -m "not integration"`は既存121件green、`uvx pyright`に新規エラー無し(既知の`app/ai/llm/gemini.py`の型債務のみ残存)を確認した。

**`textbook/samples/backend/`側のミラーへは反映していない**。これらの修正はコメント・docstringの行の折り返しのみでクラス名・シグネチャ・型に変更が無く、CLAUDE.md rule #9が対象とする「検討・相談の中で提示するコード(クラス名・シグネチャ・型など)の変更」には当たらないと判断した。

## テスト観点

README・OPERATIONS.md・ワークフローYAMLは実装ファイルを作らない/importの無い変更のため#15の対象外。検証はコマンド実行結果で代替する:

| 確認項目 | 手段 | 結果 |
|---|---|---|
| ワークフローYAML構文 | `python3 -c "import yaml; yaml.safe_load(open(f))"`を両ファイルに対して実行 | いずれもエラー無し |
| `devex-api`のCIジョブと同じコマンドがローカルで通る | `uv run ruff check .` / `uv run pytest -m "not integration"` | 0件 / 121件green |
| 型チェックに回帰が無い | `uvx pyright` | 新規エラー無し(既知1件のみ残存) |
| `devex-ui`のCIジョブと同じコマンドがローカルで通る | `npm run lint` / `npm run test` / `npm run build` | いずれも成功 |
| md相互参照リンク(#26) | 目視 + 削除したファイルへのリンクが無いことを確認 | root/textbook配下のリンクは修正済み(下記「後続Phaseでの改訂」参照) |

## 後続Phaseでの改訂(#12)

[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)・[`Phase-3/Phase-3-introduction.md`](../Phase-3/Phase-3-introduction.md)等が参照する`devex-ui/CLAUDE.md`・`devex-api/CLAUDE.md`は、本章での検討の結果、いずれも削除されずそのまま存置された(上記「README整備」節参照)。誤って一時削除した際に該当箇所のリンクを一部変更しかけたが、復元と同時に全て元の状態(リンク維持)に戻している。実質的な改訂は発生していない。

## 既知の残課題

- `devex-ui/CLAUDE.md`は「Devexの機能画面(ダッシュボード・チャットヒアリング等)を反映していない」という指摘自体は依然として正しい(Testing節・バックエンド連携節は最新だが、画面一覧的な記述は無い)。この文書債務への対応は本Phaseでも見送った(README側に機能説明を追加したことで一定は代替できているため)。
- GitHub Actionsのワークフローは構文・ローカルコマンド相当の検証に留まり、実際のGitHub上でのCI実行・実VPSへのSSHデプロイは行っていない(Secretsが未設定のため)。ユーザーが実際にGitHub Secretsを設定した後、初回のpushで動作確認することを推奨する。
