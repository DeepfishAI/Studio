# -----------------------------------------------------------
# rag_client.py
# -----------------------------------------------------------
"""
DeepFish RAG Client (NVIDIA NeMo Retriever)

Handles:
- Embedding (nv-embedqa-e5-v5)
- Retrieval (Vector DB)
- Reranking (nv-rerankqa-mistral-4b-v3)
"""

import os
import logging
from typing import List, Dict, Optional
import json

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

log = logging.getLogger("rag_client")

class RagClient:
    """Client for NVIDIA Enterprise RAG interactions."""
    
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        
        if not self.api_key:
            log.error("NVIDIA_API_KEY required for RAG")
            
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a query."""
        if not HAS_REQUESTS: return []
        
        response = requests.post(
            f"{self.base_url}/embeddings",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "input": text,
                "model": "nvidia/nv-embedqa-e5-v5",
                "encoding_format": "float"
            }
        )
        return response.json()["data"][0]["embedding"]

    def rerank(self, query: str, documents: List[str]) -> List[Dict]:
        """Rerank retrieved documents."""
        if not HAS_REQUESTS: return []
        
        payload = {
            "model": "nvidia/nv-rerankqa-mistral-4b-v3",
            "query": {"text": query},
            "passages": [{"text": doc} for doc in documents]
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/retrieval/nvidia/reranking",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=5
            )
            response.raise_for_status()
            return response.json().get("rankings", [])
        except Exception as e:
            log.warning(f"Rerank API failed ({e}), using fallback mock ranking")
            # Mock: just return original order
            return [{"index": i, "logit": 0.0} for i in range(len(documents))]

    def query_knowledge_base(self, query: str, collection: str) -> str:
        """
        Full RAG pipeline: Embed -> Search(Mock) -> Rerank
        Returns best matching text chunk.
        """
        # Mock retrieval from vector DB for now
        log.info(f"Querying collection: {collection}")
        
        # Simulating retrieved docs
        mock_docs = [
            "DeepFish uses 'The Deep Way' philosophy.",
            "Mei is the Project Manager agent.",
            "NVIDIA provides the infrastructure layer."
        ]
        
        rankings = self.rerank(query, mock_docs)
        if rankings:
            best_idx = rankings[0]["index"]
            return mock_docs[best_idx]
        
        return ""
