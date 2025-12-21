# -----------------------------------------------------------
# voice_client.py
# -----------------------------------------------------------
"""
DeepFish Voice Client (Pipecat + NVIDIA Riva)

Manages real-time voice interactions for Vesper and other agents.
Orchestrates:
- Transport: Daily (WebRTC)
- ASR: NVIDIA Riva (Parakeet)
- LLM: Llama 3.1 70B
- TTS: NVIDIA Riva (Magpie)
"""

import asyncio
import logging
import os
import sys
from typing import Optional

# --- Optional Dependencies ---
try:
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineTask
    from pipecat.services.daily import DailyParams, DailyTransport
    from pipecat.services.nvidia import NvidiaRivaSTT, NvidiaRivaTTS
    HAS_PIPECAT = True
except ImportError:
    HAS_PIPECAT = False

# -----------------------------------------------------------
# Logging
# -----------------------------------------------------------
log = logging.getLogger("voice_client")
logging.basicConfig(level=logging.INFO)

# -----------------------------------------------------------
# Client
# -----------------------------------------------------------
class VoiceClient:
    """
    Manages the voice pipeline for an agent.
    """
    
    def __init__(self, agent_name: str, config: Optional[dict] = None):
        if not HAS_PIPECAT:
            log.warning("Pipecat not installed. Voice features disabled.")
            return

        self.agent_name = agent_name
        self.config = config or {}
        self.runner = None
        self.task = None
        
        # Riva Config
        self.riva_uri = os.getenv("RIVA_URI", "grpc.nvcf.nvidia.com:443")
        self.riva_api_key = os.getenv("NVIDIA_API_KEY")
        
    async def start(self, room_url: str, token: str):
        """Start the voice bot in a Daily room."""
        if not HAS_PIPECAT:
            raise ImportError("Pipecat dependency missing")

        log.info(f"Connecting {self.agent_name} to {room_url}...")

        # 1. Transport (Daily WebRTC)
        transport = DailyTransport(
            room_url,
            token,
            "DeepFish Voice Bot",
            DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True
            )
        )

        # 2. Services (NVIDIA Riva)
        stt = NvidiaRivaSTT(
            uri=self.riva_uri,
            api_key=self.riva_api_key,
            model="nvidia/parakeet-ctc-1.1b-asr",
            language_code="en-US"
        )
        
        tts = NvidiaRivaTTS(
            uri=self.riva_uri,
            api_key=self.riva_api_key,
            model="nvidia/magpie-tts-multilingual",
            voice="English-US-Female-1"
        )

        # 3. Pipeline
        # Note: LLM logic would be injected here. Simplified for now.
        pipeline = Pipeline([
            transport.input(),
            stt,
            # LLM would go here
            tts,
            transport.output()
        ])

        # 4. Run
        self.task = PipelineTask(pipeline)
        self.runner = PipelineRunner()
        
        await self.runner.run(self.task)
        log.info("Voice pipeline finished.")

    async def stop(self):
        """Stop the voice bot."""
        if self.task:
            await self.task.cancel()

# -----------------------------------------------------------
# CLI Test
# -----------------------------------------------------------
if __name__ == "__main__":
    if not HAS_PIPECAT:
        print("❌ Pipecat not installed. Cannot run voice test.")
        sys.exit(1)
        
    print("🚀 Voice Client Ready (Mock)")
