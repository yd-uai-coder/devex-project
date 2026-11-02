# Phase-119-3: 本番での確認と記録

## この章の目的

[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節の手順7(本番での確認)と手順8(要約の確かめ直し)を行い、結果と費用を記録する。指摘があれば「本番確認後の調整」で直す。最後に、ステージ11〜14 と Phase 118 が本番に出たことを docs と記録に反映する。

自動実装モード: on([introduction](./Phase-119-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/components/layout/Header.tsx`](../samples/frontend/src/components/layout/Header.tsx) | 更新 | 題の文字色を白に(ユーザーが本体を直した本番確認後の調整を samples に当てた。[introduction](./Phase-119-introduction.md#本番確認後の調整)) |

docs の更新は下の「記録の更新」。

## 分担

着手時の相談の決定3([introduction](./Phase-119-introduction.md#着手時の相談で決めたこと))のとおり。

- **AI**(ヘッドレスの Chromium・ログインなし・GET だけ): Phase 118 の表のうち「TOP」「目次と全ページ」「見せ方」「題と言語」。本番の `https://devex.uandi-tech.com/` を開き、スクリーンショットはジョブの作業用のディレクトリに置く。
- **ユーザー**: ステージ11〜14 の表すべて、Phase 118 の「入口」(ログインの後のダイアログ)、費用(Gemini だけ。Claude は使わない)、手順8 の SQL の件数。画面はライトとダークの両方、幅 375px でも見る。

## 本番での確認の結果

| 表 | 確かめた人 | 結果 | 指摘 |
|---|---|---|---|
| ステージ11〜14 | ユーザー | 問題なし | 0 |
| Phase 118(入口) | ユーザー | 問題なし | 0 |
| Phase 118(TOP・全ページ・見せ方・題と言語) | AI(2026-11-02) | 問題なし | 0 |
| 手順8・費用 | ユーザー | 問題なし(件数・金額の報告は無い) | 0 |

**AI の確かめ**(ヘッドレスの Chromium・ログインなし・GET だけ。スクリプトとスクリーンショットはジョブの作業用のディレクトリ):
- `/`・`/guide`・`/guide/` の12ページ(`getting-started`・`modes`・`projects`・`hearing`・`documents`・`detailed-design`・`implementation`・`review`・`agreement`・`materials`・`for-clients`・`glossary`)を、幅 1280px と 375px で開いた。
- 28回とも 200、`lang="ja"`、壊れた画像 0(スクロールして遅延読み込みの分も読ませた。画像はページごとに 0〜8枚)、横のはみ出し 0、ページの例外 0。
- タブの題は「ヒアリング | 使い方ガイド | Devex」の形。TOP は「Devex ── クライアントとの合意を、設計から実装・テストまでつなぐ」。
- PC 幅で流れの帯(10段)と右の「このページの目次」(今の節の強調)が出て、375px では帯が「段 4 / 全 10: ヒアリング」の1行にたたまれる(スクリーンショットで確かめた)。

## 記録の更新

反映と確認が済んだら、次を「デプロイ済み(日付)」にする。

- `CLAUDE.md`「Spec vs. implementation」・root の `README.md`・[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1・[位置付け](../../appendix/devex_project_positioning.md) 12章の「未デプロイ」の記述。
- [Phase 118](../Phase-118/Phase-118-introduction.md) の申し送りの「本番への反映と本番での確認」を、この Phase で解決したものとして閉じる。
- #39 の「本番での確認の指摘」(ステージ11〜14 の分。どれも 0)を、[`overall-retrospective.md`](../retrospectives/overall-retrospective.md) の 11.1 の表と 16〜19節の各 .5 に埋めた。振り返りの本文は、この後の別セッション(#18)で書く。

上の4つと Phase 118 の申し送りは、2026-11-02 に直した(反映は 2026-11-02 に済んだ、と書いた)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| Phase 118 の公開ページの確認 | 本番の devex-ui(Vercel)の TOP と `/guide` 以下 | Playwright(ヘッドレス・ログインなし・GET だけ) | スタブ不要 ── 本番そのものを見るのが目的で、ページは静的に生成され API を呼ばないため |
| ステージ11〜14 の確認 | 本番の devex-ui + devex-api + 本番の Gemini | ユーザーの手の操作 | スタブ不要 ── 本物の LLM・DB で動くことを見るため |
