import time
from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class ConversationState:
    session_id: str = ""
    user_id: str = ""
    
    tool_phase: str = "idle"
    pending_interrupt: str = ""
    tool_fence: Dict[str, Any] = field(default_factory=dict)
    
    current_step: Optional[Dict[str, Any]] = None
    step_index: int = 0
    resolved_slots: Dict[str, Any] = field(default_factory=dict)
    
    current_line: str = ""
    audio_base64: Optional[str] = None
    
    pilot_transcript: str = ""
    extracted: Dict[str, Any] = field(default_factory=dict)
    slot_report: Dict[str, bool] = field(default_factory=dict)
    
    grounding: list = field(default_factory=list)
    
    retries: int = 0
    finished: bool = False
    is_general_query: bool = False
    all_passed: bool = False
    
    transcript: list = field(default_factory=list)
    
    turn_start_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    step_results: list = field(default_factory=list)
    
    def reset_turn(self):
        self.turn_start_ms = int(time.time() * 1000)
        self.pilot_transcript = ""
        self.extracted = {}
        self.slot_report = {}
        self.is_general_query = False
        self.all_passed = False
    
    def add_transcript(self, role: str, text: str, step_id: str = "", template_id: str = "", cache_hit: bool = False):
        self.transcript.append({
            "role": role,
            "text": text,
            "stepId": step_id,
            "templateId": template_id,
            "cacheHit": cache_hit,
            "timestamp": time.time(),
        })
    
    def is_tool_interrupted(self) -> bool:
        return bool(self.pending_interrupt and self.tool_phase in ("search_flights", "search_hotels"))
    
    def clear_interrupt(self):
        self.pending_interrupt = ""
        self.tool_fence = {}
        self.tool_phase = "idle"