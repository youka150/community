import httpx
import json
from typing import List, Dict, AsyncGenerator
from config import logger, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_NAME
from schemas import AIAnalysisResult

async def call_llm(prompt: str, system_prompt: str = "") -> str:
    """调用大模型API（非流式）"""
    if not LLM_API_KEY or not LLM_BASE_URL or not LLM_MODEL_NAME:
        logger.warning("大模型API未配置，跳过AI分析")
        return ""
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": LLM_MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt or "你是一个专业的数据分析师。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 5000
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"LLM调用失败: {e}")
            return ""


async def call_llm_stream(prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
    """流式调用大模型API，逐 token yield"""
    if not LLM_API_KEY or not LLM_BASE_URL or not LLM_MODEL_NAME:
        logger.warning("大模型API未配置，跳过AI分析")
        return

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            async with client.stream(
                "POST",
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": LLM_MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt or "你是一个专业的数据分析师。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 5000,
                    "enable_thinking": True,
                    "stream": True
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]  # 去掉 "data: " 前缀
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"LLM流式调用失败: {e}")


# ============ 流式洞察相关的 prompt 构建 ============

def _build_topic_prompt(topics: list) -> tuple:
    """构建热点话题解读的 prompt"""
    prompt = f"""
    以下是从华为开发者社区提取的热门话题列表：
    {json.dumps(topics[:5], ensure_ascii=False, indent=2)}
    
    请分析这些话题，解读：
    1. 开发者最关注的技术方向
    2. 社区讨论的主要痛点
    3. 可能的技术趋势
    
    请用简洁的中文回答。
    """
    return prompt, "你是华为开发者社区的技术趋势分析专家。"


def _build_user_prompt(top_users: list, clusters: list) -> tuple:
    """构建用户画像洞察的 prompt"""
    prompt = f"""
    以下是社区中最具影响力的用户数据：
    {json.dumps(top_users[:10], ensure_ascii=False, indent=2)}
    
    以及用户群体画像：
    {json.dumps(clusters, ensure_ascii=False, indent=2)}
    
    请分析：
    1. 社区用户的典型画像
    2. 活跃用户的行为特征
    3. 社区健康度评估
    
    请用简洁的中文回答。
    """
    return prompt, "你是社区运营和用户研究专家。"


def _build_trend_prompt(sample_comments: list) -> tuple:
    """构建趋势总结的 prompt"""
    prompt = f"""
    以下是华为开发者社区的部分评论样本：
    {json.dumps(sample_comments[:20], ensure_ascii=False)}
    
    请总结：
    1. 开发者的主要诉求
    2. 对华为产品/服务的态度
    3. 社区整体的讨论氛围
    
    请用简洁的中文回答。
    """
    return prompt, "你是舆情分析专家。"


async def stream_single_insight(
    insight_type: str,
    topics: list = None,
    top_users: list = None,
    clusters: list = None,
    sample_comments: list = None
) -> AsyncGenerator[str, None]:
    """
    流式生成单个 AI 洞察，yield SSE 格式的事件字符串
    事件格式: "event: {type}_chunk\ndata: {json}\n\n"
    """
    logger.info(f"开始流式生成洞察: {insight_type}")

    # 根据 insight_type 选择对应的 prompt
    if insight_type == 'topic' and topics:
        prompt, sys_prompt = _build_topic_prompt(topics)
        event_name = "topic_chunk"
    elif insight_type == 'user' and top_users and clusters:
        prompt, sys_prompt = _build_user_prompt(top_users, clusters)
        event_name = "user_chunk"
    elif insight_type == 'trend' and sample_comments:
        prompt, sys_prompt = _build_trend_prompt(sample_comments)
        event_name = "trend_chunk"
    else:
        logger.warning(f"无效的洞察类型或缺少数据: {insight_type}")
        yield f"event: error\ndata: {json.dumps({'error': f'无效的洞察类型: {insight_type}'})}\n\n"
        return

    # 发送开始事件
    yield f"event: {insight_type}_start\ndata: {json.dumps({'type': insight_type})}\n\n"

    # 流式调用 LLM
    full_text = ""
    async for token in call_llm_stream(prompt, sys_prompt):
        full_text += token
        yield f"event: {event_name}\ndata: {json.dumps({'content': token})}\n\n"

    # 发送完成事件（包含完整文本，方便前端最终 state 同步）
    yield f"event: {insight_type}_done\ndata: {json.dumps({'type': insight_type, 'content': full_text or 'AI分析暂不可用'})}\n\n"
    logger.info(f"洞察流式生成完成: {insight_type}, 长度: {len(full_text)}")


async def stream_all_insights(
    topics: list,
    top_users: list,
    clusters: list,
    sample_comments: list
) -> AsyncGenerator[str, None]:
    """
    按顺序流式生成全部 3 个洞察: topic → user → trend
    """
    for insight_type in ['topic', 'user', 'trend']:
        async for event in stream_single_insight(
            insight_type=insight_type,
            topics=topics,
            top_users=top_users,
            clusters=clusters,
            sample_comments=sample_comments
        ):
            yield event

    # 发送全部完成事件
    yield f"event: all_done\ndata: {json.dumps({'status': 'completed'})}\n\n"


async def perform_ai_analysis(
    topics: List[Dict],
    top_users: List[Dict],
    clusters: List[Dict],
    sample_comments: List[str]
) -> AIAnalysisResult:
    """执行大模型智能分析"""
    logger.info("开始AI智能分析...")
    
    # 热点话题解读
    topic_prompt = f"""
    以下是从华为开发者社区提取的热门话题列表：
    {json.dumps(topics[:5], ensure_ascii=False, indent=2)}
    
    请分析这些话题，解读：
    1. 开发者最关注的技术方向
    2. 社区讨论的主要痛点
    3. 可能的技术趋势
    
    请用简洁的中文回答。
    """
    topic_insights = await call_llm(topic_prompt, "你是华为开发者社区的技术趋势分析专家。")
    
    # 用户洞察
    user_prompt = f"""
    以下是社区中最具影响力的用户数据：
    {json.dumps(top_users[:10], ensure_ascii=False, indent=2)}
    
    以及用户群体画像：
    {json.dumps(clusters, ensure_ascii=False, indent=2)}
    
    请分析：
    1. 社区用户的典型画像
    2. 活跃用户的行为特征
    3. 社区健康度评估
    
    请用简洁的中文回答。
    """
    user_insights = await call_llm(user_prompt, "你是社区运营和用户研究专家。")
    
    # 趋势总结
    trend_prompt = f"""
    以下是华为开发者社区的部分评论样本：
    {json.dumps(sample_comments[:20], ensure_ascii=False)}
    
    请总结：
    1. 开发者的主要诉求
    2. 对华为产品/服务的态度
    3. 社区整体的讨论氛围
    
    请用简洁的中文回答。
    """
    trend_summary = await call_llm(trend_prompt, "你是舆情分析专家。")
    
    # 生成建议
    recommendations = []
    if topic_insights:
        recommendations.append("基于热点分析，建议关注开发者最关心的技术话题")
    if user_insights:
        recommendations.append("培养核心用户，提升社区活跃度")
    recommendations.append("定期分析社区趋势，及时响应开发者需求")
    
    logger.info("AI分析完成")
    return AIAnalysisResult(
        topic_insights=topic_insights or "AI分析暂不可用",
        user_insights=user_insights or "AI分析暂不可用",
        trend_summary=trend_summary or "AI分析暂不可用",
        recommendations=recommendations
    )


async def retry_single_insight(
    insight_type: str,
    topics: list = None,
    top_users: list = None,
    clusters: list = None,
    sample_comments: list = None
) -> dict:
    """
    重试单个 AI 洞察
    insight_type: 'topic', 'user', 'trend'
    """
    logger.info(f"重试单个洞察: {insight_type}")
    
    result = {}
    
    if insight_type == 'topic' and topics:
        topic_prompt = f"""
        以下是从华为开发者社区提取的热门话题列表：
        {json.dumps(topics[:5], ensure_ascii=False, indent=2)}
        
        请分析这些话题，解读：
        1. 开发者最关注的技术方向
        2. 社区讨论的主要痛点
        3. 可能的技术趋势
        
        请用简洁的中文回答。
        """
        insight = await call_llm(topic_prompt, "你是华为开发者社区的技术趋势分析专家。")
        result["topic_insights"] = insight or "AI分析暂不可用"
        
    elif insight_type == 'user' and top_users and clusters:
        user_prompt = f"""
        以下是社区中最具影响力的用户数据：
        {json.dumps(top_users[:10], ensure_ascii=False, indent=2)}
        
        以及用户群体画像：
        {json.dumps(clusters, ensure_ascii=False, indent=2)}
        
        请分析：
        1. 社区用户的典型画像
        2. 活跃用户的行为特征
        3. 社区健康度评估
        
        请用简洁的中文回答。
        """
        insight = await call_llm(user_prompt, "你是社区运营和用户研究专家。")
        result["user_insights"] = insight or "AI分析暂不可用"
        
    elif insight_type == 'trend' and sample_comments:
        trend_prompt = f"""
        以下是华为开发者社区的部分评论样本：
        {json.dumps(sample_comments[:20], ensure_ascii=False)}
        
        请总结：
        1. 开发者的主要诉求
        2. 对华为产品/服务的态度
        3. 社区整体的讨论氛围
        
        请用简洁的中文回答。
        """
        insight = await call_llm(trend_prompt, "你是舆情分析专家。")
        result["trend_summary"] = insight or "AI分析暂不可用"
    
    logger.info(f"洞察重试完成: {insight_type}")
    return result
