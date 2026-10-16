# 更新：Phase-68-3
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 68 で初めて samples に載せた
# (全文。タグの無い部分はテンプレートのまま)。
# Phase-68-3：削除 ── app.ai.llm.gemini.get_gemini_llm
# Phase-68-3:追記 ── typing.Any, langchain_core.runnables.RunnableConfig, app.ai.llm.content.extract_text_content, app.ai.llm.factory.STRUCTURED_METHOD
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from app.ai.graph.state import GraphState
from app.ai.llm.content import extract_text_content
from app.ai.llm.factory import STRUCTURED_METHOD
from app.ai.tools.tavily import get_tavily_search_tool
from app.schemas.generation import FinalAnswer


# Phase-68-3：更新
# def draft_response(state: GraphState) -> dict:
# ↓↓
def llm_from(config: RunnableConfig, name: str = "llm") -> Any:
    """呼び出し側(app/services/chat.py)がユーザーごとに解決して`configurable`に入れた LLM。
    グラフはプロセスで1つにコンパイルして使い回すので、LLM はグラフに持たせず実行ごとに渡す。
    `evaluator_llm`は検索結果の評価に使う温度0の LLM。"""
    return config["configurable"][name]


def draft_response(state: GraphState, config: RunnableConfig) -> dict:
    """ユーザーの質問に対してLLMで下書き回答を生成し、Web検索が必要かどうかを判定する。"""
    # Phase-68-3：更新
    # llm = get_gemini_llm()
    # ↓↓
    llm = llm_from(config)
    response = llm.invoke([HumanMessage(content=state["question"])])
    return {
        "messages": [response],
        "needs_search": True,
        "search_query": state["question"],
    }


def web_search(state: GraphState) -> dict:
    """Tavily検索ツールを呼び出し、検索結果のリストを取得する。"""
    tool = get_tavily_search_tool()
    raw_results = tool.invoke({"query": state["search_query"]})
    # raw_resultsが辞書形式ならその"results"キーの中身を、それ以外はそのまま結果とする
    results = raw_results.get("results", []) if isinstance(raw_results, dict) else raw_results
    return {"search_results": results}


# Phase-68-3：更新
# def evaluate_search_results(state: GraphState) -> dict:
# ↓↓
def evaluate_search_results(state: GraphState, config: RunnableConfig) -> dict:
    """検索結果が質問への回答に十分かどうかをLLMに簡潔に評価させる。"""
    # Phase-68-3：更新
    # llm = get_gemini_llm(temperature=0)
    # ↓↓
    llm = llm_from(config, "evaluator_llm")
    prompt = (
        f"Question: {state['question']}\n"
        f"Search results: {state['search_results']}\n\n"
        "Briefly evaluate whether these results are relevant and sufficient "
        "to answer the question."
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    # Phase-68-3：更新
    # return {"evaluation": response.content}
    # ↓↓
    return {"evaluation": extract_text_content(response.content)}


# Phase-68-3：更新
# def generate_final_answer(state: GraphState) -> dict:
# ↓↓
def generate_final_answer(state: GraphState, config: RunnableConfig) -> dict:
    """検索結果と評価結果をもとに、構造化出力（FinalAnswer）で最終回答を生成する。"""
    # Phase-68-3：更新
    # llm = get_gemini_llm().with_structured_output(FinalAnswer)
    # ↓↓
    llm = llm_from(config).with_structured_output(FinalAnswer, method=STRUCTURED_METHOD)
    prompt = (
        f"Question: {state['question']}\n"
        f"Search results: {state['search_results']}\n"
        f"Evaluation: {state['evaluation']}\n\n"
        "Using the above, write the final answer for the user."
    )
    # structured: FinalAnswerスキーマに沿って構造化されたLLM出力
    structured: FinalAnswer = llm.invoke([HumanMessage(content=prompt)])
    return {"answer": structured.answer, "messages": [AIMessage(content=structured.answer)]}


def finalize_without_search(state: GraphState) -> dict:
    """検索不要と判定された場合、直前のメッセージ内容をそのまま最終回答として扱う。"""
    last_message = state["messages"][-1]
    # Phase-68-3：更新
    # return {"answer": last_message.content}
    # ↓↓
    return {"answer": extract_text_content(last_message.content)}


def decide_to_search(state: GraphState) -> str:
    """needs_searchフラグを見て、検索ノードへ進むか直接終了するかの分岐先を返す。"""
    return "search" if state.get("needs_search") else "finalize"
