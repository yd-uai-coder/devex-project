# ステージ12 の効果測定(Phase 99)

ステージ12(合意の精度。Phase 91〜98)で作った合意の記録・保護・確認事項・要素の履歴・段階の承認の印を、[ベースライン](stage12-baseline.md)(Phase 90-2)と同じ題材「トレンド追跡アプリ」で測り直したもの。分析は [Phase 99-1](../../textbook/Phase-99/Phase-99-1.md)、実 LLM の流れの操作と画面確認は [Phase 99-4](../../textbook/Phase-99/Phase-99-4.md) にある。

- 日時: 2026-10-20。本体は devex-api `stage11-15`(Phase 98 の版。未コミット)・devex-ui `main`。
- 測定: [`stage12/effect.py`](./stage12/effect.py)。ベースラインの `measure.py` の読み出しを import して使う。
- (A) 決定的な再現: ベースラインで書き出した版 v5〜v9 に、ステージ12 の保護を当て直す。LLM・DB は使わない(費用 0)。2回流して同じ出力になった。
- (B) 実 LLM の流れ: ユーザーが画面で操作し(Gemini 3.5 Flash-Lite)、版と合意の記録を DB から書き出した。
  - 段の途中で書き出しを取れなかった。残っている版(v10〜v12)を `snapshot-version` で書き出し、合意はその版が今の版だった間の記録(日時つき・追記だけ)から組み直した。確認事項・段階・CR の状態は、最後の書き出し(`99-end`)だけにある。
  - 費用はトークンの記録が無いので、Phase 89 の単価で記す。再生成2回・CR の反映1回・段階1 の作り直し2回(+ CR なし1回)で、約 $0.05。

## 実行

```bash
PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
    python appendix/measurements/stage12/effect.py report
```

## 実 LLM の流れ(DB から読んだ事実)

1. B-4 を作った(CR-3 を反映した版 v9 で合意し直した。合意の記録 18件)。ステージ12 より前に反映した CR-3 は合意に入っていなかった。そのため、B-4 を作らずに再生成すると、FR-001 が「8時間」に戻るところだった(下の A の「記録どおり」の行)。
2. 確認事項で、推測の要件を11件・推測の利用者(一般ユーザー)を確認済みにした(採用と合意の記録 12件)。CON-006 を却下にし、観点2件に決める機会を付けた。
3. CR を渡さない再生成(v10)。
4. CR-4(FR-003 を TOP10 → TOP20・順位の変動を矢印で)を作り、説明・合意・文書への反映(v11)を行った。段階1 を CR-4 で2回作り直して承認した(結んだ印 40件)。
5. CR を渡さない再生成(v12)。
6. 行っていないこと: CR-4 の検証(反映済みのまま)、2回目の CR なしの再生成。段階1 はその後 CR なしで作り直して承認された。

## A. 決定的な再現(ベースラインの v5〜v9 に保護を当て直す)

### 合意: 記録どおり(B-3)(18要素)

| 版 | 保護の前の「合意と違う・無い」 | 戻した要素(要件 / 外部設計) | 保護の後の「合意と違う・無い」 | 保護の後の「未合意」 |
|---|---|---|---|---|
| v6 | 4(req:FR-001, users, integration:LLM API, integration:X API) | 4(req:FR-001(changed), users(changed), integration:X API(dropped), integration:LLM API(changed)) | 0 | 1(integration:X API (Freeプラン / 日本リージョン)) |
| v7 | 4(req:FR-001, users, integration:X API, integration:LLM API) | 4(req:FR-001(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |
| v8 | 4(req:FR-001, users, integration:X API, integration:LLM API) | 4(req:FR-001(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |
| v9 | 4(req:FR-001, users, integration:X API, integration:LLM API) | 4(req:FR-001(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |

### 合意: ステージ12 の流れなら(B-3 → CR-3 → 全行の採用)(18要素)

| 版 | 保護の前の「合意と違う・無い」 | 戻した要素(要件 / 外部設計) | 保護の後の「合意と違う・無い」 | 保護の後の「未合意」 |
|---|---|---|---|---|
| v6 | 15(req:FR-001, req:FR-002, req:FR-003, req:FR-004, req:FR-005, req:NFR-001, req:CON-001, req:CON-002, req:CON-003, req:CON-004, req:CON-005, req:CON-006, users, integration:LLM API, integration:X API) | 15(req:FR-001(changed), req:FR-002(changed), req:FR-003(changed), req:FR-004(changed), req:FR-005(changed), req:NFR-001(changed), req:CON-001(changed), req:CON-002(changed), req:CON-003(changed), req:CON-004(changed), req:CON-005(changed), req:CON-006(changed), users(changed), integration:X API(dropped), integration:LLM API(changed)) | 0 | 1(integration:X API (Freeプラン / 日本リージョン)) |
| v7 | 15(req:FR-001, req:FR-002, req:FR-003, req:FR-004, req:FR-005, req:NFR-001, req:CON-001, req:CON-002, req:CON-003, req:CON-004, req:CON-005, req:CON-006, users, integration:X API, integration:LLM API) | 15(req:FR-001(changed), req:FR-002(changed), req:FR-003(changed), req:FR-004(changed), req:FR-005(changed), req:NFR-001(changed), req:CON-001(changed), req:CON-002(changed), req:CON-003(changed), req:CON-004(changed), req:CON-005(changed), req:CON-006(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |
| v8 | 15(req:FR-001, req:FR-002, req:FR-003, req:FR-004, req:FR-005, req:NFR-001, req:CON-001, req:CON-002, req:CON-003, req:CON-004, req:CON-005, req:CON-006, users, integration:X API, integration:LLM API) | 15(req:FR-001(changed), req:FR-002(changed), req:FR-003(changed), req:FR-004(changed), req:FR-005(changed), req:NFR-001(changed), req:CON-001(changed), req:CON-002(changed), req:CON-003(changed), req:CON-004(changed), req:CON-005(changed), req:CON-006(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |
| v9 | 15(req:FR-001, req:FR-002, req:FR-003, req:FR-004, req:FR-005, req:NFR-001, req:CON-001, req:CON-002, req:CON-003, req:CON-004, req:CON-005, req:CON-006, users, integration:X API, integration:LLM API) | 15(req:FR-001(changed), req:FR-002(changed), req:FR-003(changed), req:FR-004(changed), req:FR-005(changed), req:NFR-001(changed), req:CON-001(changed), req:CON-002(changed), req:CON-003(changed), req:CON-004(changed), req:CON-005(changed), req:CON-006(changed), users(changed), integration:X API(changed), integration:LLM API(changed)) | 0 | 0 |

## B. 実 LLM の流れ

| 書き出し | 版(CR) | 合意の要素 | 保護で戻した要素 | 合意の状態 | 合意と違う・無い | 未合意 | 推測の要件 | 確認事項(要件/利用者/観点) | 採用率 |
|---|---|---|---|---|---|---|---|---|---|
| 00-start | v9 | 18 | 0 | {'differs': 4, 'agreed': 14} | 4(req:FR-001, users, integration:X API, integration:LLM API) | 0 | 12 / 12 | 12/2/6 | ─ |
| v10 | v10 | 18 | 1(users(changed)) | {'agreed': 18} | 0 | 0 | 1 / 12 | 1/1/6 | ─ |
| v11 | v11(CR-4) | 18 | 1(users(changed)) | {'agreed': 18} | 0 | 0 | 2 / 12 | 2/1/6 | ─ |
| v12 | v12 | 18 | 2(req:FR-003(changed), users(changed)) | {'agreed': 18} | 0 | 0 | 2 / 12 | 2/1/6 | ─ |
| 99-end | v12 | 18 | 2(req:FR-003(changed), users(changed)) | {'agreed': 18} | 0 | 0 | 2 / 12 | 2/1/6 | 92%(12/13) |

### CR と段階の印(最後の書き出し)

- CR-1(rejected): 段階の承認で結んだ印 []
- CR-2(applied): 段階の承認で結んだ印 []
- CR-3(applied): 段階の承認で結んだ印 []
- CR-4(applied): 段階の承認で結んだ印 [40]
- 段階の印の出どころ: {'CR なし': 11, 'cr:4': 18}
  - 段階1: approved 版15(承認 15)
  - 段階2: approved 版4(承認 4)
  - 段階3: approved 版10(承認 10)
  - 段階4: approved 版9(承認 9)
  - 段階5: approved 版4(承認 4)
  - 段階6: approved 版17(承認 17)
  - 段階7: approved 版8(承認 8)
  - 段階8: approved 版4(承認 4)

### 要件の行の変化(直前の版との比較。版が変わった段だけ)

- v10: 文 0 / 出どころ 11(FR-001(assumed→adopted), FR-002(assumed→adopted), FR-003(assumed→adopted), FR-004(assumed→adopted), FR-005(assumed→adopted), NFR-001(assumed→adopted), CON-001(assumed→adopted), CON-002(assumed→adopted), CON-003(assumed→adopted), CON-004(assumed→adopted), CON-005(assumed→adopted)) / 消えた 0 / 増えた 0
- v11: 文 1(FR-003) / 出どころ 1(FR-003(adopted→assumed)) / 消えた 0 / 増えた 0
- v12: 文 0 / 出どころ 0 / 消えた 0 / 増えた 0


## 判定(マイルストーン13)

| 完了の判断基準 | 判定 | 根拠 |
|---|---|---|
| 合意済みの行(要件・利用者・画面・API・外部連携)が、CR の範囲の外の再生成で変わらない | ○ | (B) CR を渡さない再生成 v10・v12 の後、合意の状態は「合意済み 18 / 合意と違う 0」だった。LLM が書き換えた利用者(毎回)と、v12 で書き換えた FR-003 を、合意の形に戻した。FR-003 は CR-4 の反映で合意を更新していたので、v12 で戻したのは CR-4 の中身(CR の変更が CR なしの再生成で残った)。(A) ベースラインの v6〜v9 に当て直すと、どの版も「合意と違う・無い」が0になった |
| 推測の要件・推測の利用者・根拠が未決の観点が、すべて確認事項に出る | ○ | 確認事項は、今の要件定義書と観点の表から毎回組み立てる(決定的)。起点の v9 で 12/2/6 件。ベースラインの「推測の要件 12 / 12 行・推測の利用者 2件・要件の根拠になっている open の観点 6件」と一致した。推測の採用率は 92%(確認済み 12 / 却下 1) |

## 分かったこと

- **利用者(1.2)の言い換えは毎回起きる**: v6〜v12 のすべての再生成で、利用者の使う場面の文が言い換えられた。保護が毎回戻した。ベースラインは要件の行の文しか比べていなかったので、見えていなかった。
- **外部連携の言い換えは、ステージ12 のプロンプトで止まった**: ベースラインの v6〜v9 では、外部連携(X API・LLM API)の文が毎回言い換えられた。v6 ではサービス名も「X API (Freeプラン / 日本リージョン)」に変わった。ステージ12 の v10〜v12 では、外部連携は一度も戻していない。前の版の外部連携の節と「合意済み」の印を足した効果とみられる(Phase 93)。
- **サービス名の言い換えは、保護の後も重複を残す**(A の v6): 合意済みの「X API」は戻るが、名前の変わった行は未合意の新しい行として残る。画面は「未合意」と出すので見える。ただし、重複を除く規則は画面(同じ名前)にしか無い。ステージ13 以降へ送る。
- **CR で書き換えた行は「推測」に戻り、確認事項の状態は「確認済み」のまま残る**: CR-4 の反映で、FR-003 の出どころは「採用」→「推測」になった(CR の文は LLM が書くため)。確認事項の一覧には FR-003 が再び出るが、状態は前の「確認済み」のままである。もう一度採用にするには、「未確認に戻す」を挟む必要がある。ステージ13 以降へ送る。
- **段階の承認で結んだ印は 40件**(段階1 の CR-4 での作り直しの承認)。段階4 の作り直しの承認では、前の段階(1〜3)にも見直しの印が届いた。画面確認の後の調整で、生成で作り直したままの承認では前の段階へ送らないことにした([Phase 99 の introduction](../../textbook/Phase-99/Phase-99-introduction.md)「Phase 完了後の調整」)。
