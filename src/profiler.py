# -----------------------------------------------------------
# profiler.py
# -----------------------------------------------------------
"""
NeMo Agent Profiler

Tracks:
- Latency (Chain execution time)
- Token Usage (Input/Output)
- Tool Calls (Frequency/Duration)
"""

import time
import logging
import json
from dataclasses import dataclass, asdict

log = logging.getLogger("profiler")

@dataclass
class ProfileTrace:
    trace_id: str
    agent: str
    start_time: float
    end_time: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    tools_used: list = None
    
    def duration_ms(self):
        return (self.end_time - self.start_time) * 1000

class AgentProfiler:
    def __init__(self):
        self.traces = []
        
    def start_trace(self, agent_name: str) -> ProfileTrace:
        trace = ProfileTrace(
            trace_id=f"trace_{int(time.time()*1000)}",
            agent=agent_name,
            start_time=time.time(),
            tools_used=[]
        )
        return trace
        
    def end_trace(self, trace: ProfileTrace):
        trace.end_time = time.time()
        self.traces.append(trace)
        log.info(f"Trace {trace.trace_id} finished. Duration: {trace.duration_ms():.2f}ms")
        
        # In real impl, would dump to Redis/NeMo Toolkit
        
    def record_tool(self, trace: ProfileTrace, tool_name: str):
        trace.tools_used.append(tool_name)

# Singleton instance
profiler = AgentProfiler()
