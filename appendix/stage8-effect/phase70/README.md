# Phase 70 の効果の確認(70-4)

[Phase 70](../../../textbook/Phase-70/Phase-70-introduction.md) の直し(聞き直しの答え・テスト仕様書・再生成のきっかけ)を、ローカルの devex-api と実際の LLM で確かめた記録。2026-10-17。生成・ヒアリングは `gemini-3.5-flash-lite`(seed の superuser の既定)。Sonnet のレビューは流していない(要件定義書の作り直しの間はレビューの設定を一時的にオフにし、終わった後にオンへ戻した)。

- Phase 58・59 の記録を書き換えないよう、**プロジェクトを複製して**確かめた([`../phase59/copy_project.py`](../phase59/copy_project.py))。正解例(`../test-spec/truth-*.md`)は付け直していない。
- 生成物は手で書き換えていない。

## 複製したプロジェクト

| drive.py の名前 | 複製 | 元 | 使った確認 |
|---|---|---|---|
| `p70-h1` | 45b591d1 | b2602f06(詳細 detailed-1) | 1・2 聞き直し(1回目) |
| `p70-h2` | 79758997 | b2602f06 | 1・2 聞き直し(2回目。あえて論点の欠けた選択肢を選んだ) |
| `p70-h3` | c0ba9175 | b2602f06 | 1・2 聞き直し(3回目。注記を直した後)・4 要件定義書の再生成 |
| `p70-spec-simple` | 07e60da1 | 02bbe558(p59-spec-simple) | 3 テスト仕様書(簡易)2回 |
| `p70-spec-detailed` | 0a97576d | 445aa091(p59-spec-detailed) | 3 テスト仕様書(詳細)2回 |

聞き直したのは、Phase 58 のレビューのヒアリングの指摘2件(security: パスワード条件・再設定・メール確認・CSRF・トークンの保管、abuse: ログイン失敗・登録・チャット・生成の回数と単位・ロック時間)。手順はどの回も「採用 → 聞き直し → 『おすすめでよいです』→ カードに答える」。

## 結果

### 1・2 聞き直し

| 回 | security(前の要約「自分のデータは自分だけ」・JWT 30分/14日) | abuse |
|---|---|---|
| h1 | カードの選択肢2つとも5つの論点すべてに値 → おすすめを選ぶ → **adopted・前の要約 + 値** | カードの選択肢2つとも4種 + ロック時間に値 → **adopted・前の要約 + 値** |
| h2 | 選択肢1(CSRF・アクセストークンの保持が無い)を選ぶ → 前の要約 + 値。ただし状態は **decided**(カードの選択なのに) | 選択肢0(登録の値が無い)を選ぶ → **adopted**(open に残らなかった) |
| h3(直した後) | 選択肢3つとも4つの論点に値 → **adopted・前の要約 + 値** | 4種すべてに値 → **adopted** |

- 前の要約は **6回とも残った**(Phase 59 では security の「自分のデータは自分だけ」が消えた)。
- 「など」で省いたカードは **0枚**(Phase 59 は abuse が「チャット50回/時間など」)。
- h2 の2つを受けて、本体を2つ直した(70-1 の「非自明な判断」): カードの答えだけを根拠にした `decided` はコードが `adopted` に直す。判定とカードの注記を「指摘が挙げた対象(例: ログイン失敗・登録・チャット・生成)を1つずつ見る」「どの選択肢にも対象ごとの値を書く」に具体化した。直した後の h3 は、どの選択肢にもすべての対象の値が入った。
- **open に残す経路は、実際の LLM では確かめられていない**(h2 の abuse は残らず、h3 は値が欠けなかった)。申し送りに残す。

### 4 要件定義書の再生成(h3)

| 要件 | 前(Phase 58 の版) | 後 |
|---|---|---|
| FR-011 | 「…推奨されるおすすめの回数制限を設定する」 | 「ログイン失敗5回/15分、登録3回/1時間、チャット50回/1時間、生成5回/1時間のレート制限を設定する」 |
| FR-012 | 「…推奨される標準仕様を適用する」 | 「パスワードは8文字以上(英数字含む)とし、パスワード再設定機能、メール確認、SameSite Cookie による CSRF 対策を適用する」 |
| FR-002 | JWT 30分/14日(HttpOnly Cookie) | アクセストークンのメモリ保持を足した |
| FR-003 | 自分のデータだけ | **そのまま**(出どころは「ユーザー」→「採用」に下がった) |

- 変わった要件の行は FR-001〜003・FR-011・FR-012 の5行だけで、ほかの行は前の版のまま写された。
- FR-001・FR-003 は本文が変わらず、出どころだけが「採用」に下がった(security が `decided` → 聞き直し → `adopted` になったため。写した行に `cap_source` をかけ直した効果)。

### 3 テスト仕様書

| | Phase 59 | Phase 70(1回目) | Phase 70(2回目) |
|---|---|---|---|
| 簡易のケース数(結合 / 総合) | 24(15 / 9) | 26(17 / 9) | 26(17 / 9) |
| 簡易の正解例の当たり | 13/17(+一部1) | 13/17(+一部1) | 13/17(+一部1) |
| 詳細のケース数(結合 / 総合) | 53(28 / 25) | 59(32 / 27) | 59(32 / 27) |
| 詳細の正解例の当たり | 33/38(+一部1) | **36/38**(+一部1) | **36/38**(+一部1) |
| 期待結果が要件の言い直し(総合) | 簡易 0・詳細 10 | 簡易 0・詳細 **0** | 簡易 0・詳細 3(`SHALLOW_REQUIREMENT_TEST` が ST-019・021・024 を指摘) |

- 詳細で新しく当たった: TD-12 `{id}` の API の未認証(IT-016・021・026・031 の 401)・TD-17 LLM の上限超過(ST-017「CON-004 … 上限超過エラー → エラー表示と再送の案内」)・TD-38 回数上限の画面の表示(ST-014「上限を超えた際に…画面に分かりやすいメッセージ」)。
- まだ落ちる: 詳細 TD-29 版の切り替え(設計に版の取得の API が無い)・一部 TD-30(サマリの修正依頼)。簡易 TS-5 他人の献立(GET の一覧で本人を決める方法が設計に無い。本文の `token` の観点は POST・DELETE に入った)・TS-7 AI で生成する・TS-13 献立1件の削除(設計に無い)。
- 要件ごとのテストは、「FR-007 の要件通り〜が提供されること」から「Markdown のプレビューが表示され、クリップボードへのコピーおよびファイルダウンロードが正常に行われる」のような振る舞いの文になった。

## 費用(実額)

| 内訳 | 見込み | 実際 |
|---|---:|---:|
| Gemini flash-lite(チャット・判定 約20回・文書の生成1回・テスト仕様書4回) | 無料枠 | 無料枠 |
| Sonnet のレビュー | 流さない | $0 |
| **合計** | **$0** | **$0** |

## 実行

```bash
cd devex-api
DBURL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/@postgres:/@localhost:/')
DATABASE_URL=$DBURL uv run --project backend python ../appendix/stage8-effect/phase59/copy_project.py <project_id> "(Phase 70 確認用 n)"
cd ../appendix/stage8-effect
P=../../devex-api/backend
uv run --project $P python drive.py decide p70-h1 adopted <security の指摘> <abuse の指摘>
uv run --project $P python drive.py rehearing p70-h1 <security の指摘> <abuse の指摘>
uv run --project $P python drive.py say p70-h1 phase70/hearing/input/delegate.txt
uv run --project $P python drive.py say p70-h1 - <card_id>:<option>
uv run --project $P python drive.py generate p70-h3                 # レビューの設定をオフにしてから
uv run --project $P python drive.py testspec p70-spec-simple phase70/test-spec/spec-simple-1.json --create
```

## ファイル

| パス | 中身 |
|---|---|
| `hearing/` | 1・2・4。発言(`input/`)・レビュー(`reviews_h*.json`)・観点の表(前・後)・チャットの履歴・h3 の文書(`docs_before/`・`docs_after/`) |
| `test-spec/` | 3。`spec-{simple,detailed}-{1,2}.json`・`.md` |
