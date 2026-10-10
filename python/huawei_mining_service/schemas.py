from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TopicModelResult(BaseModel):
    topics: List[Dict[str, Any]]
    topic_distribution: List[Dict[str, Any]]
    doc_topics: List[Dict[str, Any]]

class NetworkAnalysisResult(BaseModel):
    stats: Dict[str, Any]
    top_users: List[Dict[str, Any]]
    communities: List[Dict[str, Any]]
    weights: Optional[Dict[str, float]] = None
    all_users: Optional[List[Dict[str, Any]]] = Field(default=None, exclude=True)

class UserProfileResult(BaseModel):
    clusters: List[Dict[str, Any]]
    user_assignments: List[Dict[str, Any]]

class AIAnalysisResult(BaseModel):
    topic_insights: str
    user_insights: str
    trend_summary: str
    recommendations: List[str]
