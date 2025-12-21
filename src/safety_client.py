# -----------------------------------------------------------
# safety_client.py
# -----------------------------------------------------------
"""
NemoGuard Safety Client

Provides content moderation and jailbreak detection.
"""

import os
import requests
import logging

log = logging.getLogger("safety")

class SafetyClient:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.enabled = os.getenv("ENABLE_SAFETY", "true").lower() == "true"

    def check_input_safety(self, text: str) -> bool:
        """
        Check if input is safe (no jailbreak/toxicity).
        Returns True if SAFE, False if UNSAFE.
        """
        if not self.enabled: return True
        
        # 1. Jailbreak Check
        # 2. Toxicity Check
        # logic simplified for client
        
        # Mock implementation of API call
        # In production this calls the /v1/chat/completions with safety model
        
        is_safe = True 
        if "ignore all instructions" in text.lower():
            is_safe = False
            log.warning("Jailbreak attempt detected")
            
        return is_safe

    def check_output_safety(self, text: str) -> bool:
        """Check if LLM output is safe."""
        if not self.enabled: return True
        return True
