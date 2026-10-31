// 作成：Phase-118-5
"use client";

import { H2, H3, Paragraph, YStack } from "tamagui";
import { GuidePageLayout } from "../components/GuidePageLayout";
import styles from "../components/guide.module.css";

// 用語(画面の表記 → 意味)。画面に出る言葉の順でなく、利用の流れの順に並べる
export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: "簡易ドキュメントモード / 詳細設計モード", meaning: "プロジェクトを作るときに選ぶ進め方。簡易は4文書を一括で、詳細は段階ごとに承認しながら作ります。後から変えられません。" },
  { term: "観点の表", meaning: "ヒアリングで聞く観点(目的・利用者・機能・非機能など)ごとに、決まったか・何を決めたか・根拠を並べた表。" },
  { term: "選択肢カード", meaning: "ヒアリングで AI が出す、選んで答えられる質問。「おすすめ」と理由が付きます。" },
  { term: "推測(要件の出どころ)", meaning: "ユーザーが答えておらず、文書を作るときに AI が補った要件。確かめるまで仮のものです。" },
  { term: "段階", meaning: "詳細設計の8つの作業(機能一覧 … 実装手順書)。下書き → 確認・修正 → 承認 の順に進めます。" },
  { term: "古い・見直しの印", meaning: "前の段階や文書が変わり、確かめ直しが要る状態。見直しが要る要素に印が付きます。" },
  { term: "要件 ID・処理 ID", meaning: "要件は FR-001(機能)・NFR-001(非機能)・CON-001(制約)、処理は F-01 のような ID。文書・段階・テストをこの ID でつなぎます。" },
  { term: "トレーサビリティ", meaning: "要件から画面・処理・作業単位・テストまでのつながり。ID でたどれます。" },
  { term: "作業単位", meaning: "実装計画の1つの作業(M-01-T01 など)。実装手順書はこの単位で作ります。" },
  { term: "実装可能性チェック", meaning: "実装手順書を作るときの、設計の不足・食い違いの指摘(未定義・要決定)。" },
  { term: "設計レビュー", meaning: "生成とは別の AI が設計を読み、指摘だけを返すこと。採用・却下・保留は人が決めます。" },
  { term: "合意済みの版(B-1、B-2 …)", meaning: "クライアントと合意した要件と設計を固定したもの。画面や記録では「束」とも呼びます。" },
  { term: "変更要求(CR)", meaning: "合意済みの内容を変えたいという申し出。CR-1 のように番号が付き、影響・説明・合意・反映・検証までを記録します。" },
  { term: "説明書", meaning: "CR をクライアントに説明するための文書。内容・対象・選択肢・影響・規模をまとめます。" },
  { term: "共有リンク", meaning: "ログインせずに説明書を読み、コメント・合意・却下ができる、期限つきの URL。" },
  { term: "反映", meaning: "合意した CR の内容で、文書や段階を作り直すこと。" },
  { term: "検証", meaning: "反映で影響した所を確かめ直し、CR を締めること。検証済みの CR を次の合意済みの版に入れます。" },
  { term: "行の合意", meaning: "要件定義書・外部設計書の行ごとの合意の状態(合意済み・合意と違う・未合意)。" },
  { term: "確認事項", meaning: "推測の要件・利用者と、まだ決まっていない観点の一覧。決める機会と状態を管理します。" },
  { term: "資料・違い", meaning: "議事録・メールなどの資料と、そこから拾った合意済みの版との違い(追加・変更・削除・確かめる点)。" },
];

// よくある質問
export const FAQ: { question: string; answer: string }[] = [
  {
    question: "費用はかかりますか",
    answer: "既定の AI(Gemini)でのチャットと生成は、回数の上限の中で使えます。自分の API キーを登録した AI の利用料は、キーの持ち主の負担です。設計レビュー(Claude)を使うには、自分のキーが要ります。",
  },
  {
    question: "入力した内容やファイルはどう扱われますか",
    answer: "設計書を作るために、使う AI(Gemini・Claude)の API に送ります。プロジェクトを削除すると、チャット・文書・詳細設計・レビューなどは一緒に消えます。API キーは暗号化して保存し、画面には末尾の4文字だけを出します。",
  },
  {
    question: "どんなファイルを読み込めますか",
    answer: "ヒアリングの参考資料は txt・Markdown・PDF を3つまで(1ファイル5MBまで)。資料の取り込みは、貼り付けか txt・md・PDF です。Word・Excel・PowerPoint は PDF にしてから使います。",
  },
  {
    question: "生成にどのくらいかかりますか",
    answer: "設計書の生成は数分、段階の下書きは数十秒〜数分です。生成中に画面を閉じても、開き直すと続きを待ちます。",
  },
  {
    question: "作った設計書をほかのツールで使えますか",
    answer: "文書は Markdown でコピー・ダウンロードでき、詳細設計書・実装手順書は zip(HTML と Markdown)、図は draw.io・SVG で出力できます。ただし、ダウンロードしたファイルを直しても Devex には反映されません。",
  },
  {
    question: "スマートフォンでも使えますか",
    answer: "読む・答える・共有リンクで合意するなどはスマートフォンでもできます。表や図の編集は、パソコンの広い画面をおすすめします。",
  },
];

// 使い方: 用語集とよくある質問
export function GlossaryGuide() {
  return (
    <GuidePageLayout
      slug="glossary"
      intro="Devex の画面に出てくる言葉の意味と、よくある質問です。言葉は利用の流れの順に並べています。"
      scenes={[]}
      prerequisites={[]}
      procedures={[]}
      screens={[]}
      tips={[]}
    >
      <YStack gap="$3" render="section" aria-labelledby="guide-glossary">
        <H2 id="guide-glossary" fontSize="$7">
          用語集
        </H2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">言葉</th>
                <th scope="col">意味</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY.map((item) => (
                <tr key={item.term}>
                  <th scope="row">{item.term}</th>
                  <td>{item.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </YStack>
      <YStack gap="$3" render="section" aria-labelledby="guide-faq">
        <H2 id="guide-faq" fontSize="$7">
          よくある質問
        </H2>
        {FAQ.map((item) => (
          <YStack key={item.question} gap="$1">
            <H3 fontSize="$5">{item.question}</H3>
            <Paragraph color="$color12" lineHeight="$5">
              {item.answer}
            </Paragraph>
          </YStack>
        ))}
      </YStack>
    </GuidePageLayout>
  );
}
