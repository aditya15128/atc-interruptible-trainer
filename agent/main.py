import os
import asyncio
import json
import logging
from typing import Optional

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    Agent,
    AgentSession,
    function_tool,
    llm,
)
from livekit.plugins import deepgram, openai, rime, silero
from livekit import rtc

from .instructions import SYSTEM_PROMPT
from .state import ConversationState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RIME_MODEL = os.getenv("RIME_MODEL", "mist")
RIME_SPEAKER = os.getenv("RIME_SPEAKER", "grove")
RIME_LANGUAGE = os.getenv("RIME_LANGUAGE", "en-US")
RIME_SAMPLE_RATE = int(os.getenv("RIME_SAMPLE_RATE", "24000"))


class ATCInterruptibleAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=SYSTEM_PROMPT,
            stt=deepgram.STT(model="nova-2-general"),
            llm=openai.LLM(model="gpt-4o", parallel_tool_calls=False),
            tts=rime.TTS(
                model=RIME_MODEL,
                speaker=RIME_SPEAKER,
                language=RIME_LANGUAGE,
                sample_rate=RIME_SAMPLE_RATE,
                use_websocket=True,
                speed_alpha=1.0,
            ),
        )
        self.state = ConversationState()
        self._current_tool_task: Optional[asyncio.Task] = None
        self._tool_fence = {}

    async def on_user_interrupted(self, transcript: str):
        logger.info(f"User interrupted: {transcript}")
        
        if self._current_tool_task and not self._current_tool_task.done():
            self._current_tool_task.cancel()
            try:
                await self._current_tool_task
            except asyncio.CancelledError:
                logger.info("Tool task cancelled successfully")
        
        self._tool_fence = {
            "cancelled_at": asyncio.get_event_loop().time(),
            "reason": transcript,
            "phase": self.state.tool_phase
        }
        self.state.tool_phase = "interrupted"
        self.state.pending_interrupt = transcript

    @function_tool(
        name="search_flights",
        description="Search for flights with origin, destination, date, and cabin class"
    )
    async def search_flights(
        self,
        origin: str,
        destination: str,
        date: str,
        cabin: str = "economy",
    ) -> dict:
        """Search for flights with cancellation support. Simulates 3-5s API latency."""
        self.state.tool_phase = "search_flights"
        self._current_tool_task = asyncio.current_task()
        
        try:
            for i in range(5):
                if asyncio.current_task().cancelled():
                    raise asyncio.CancelledError("Flight search interrupted by user")
                await asyncio.sleep(1)
            
            import random
            airlines = ["United", "Delta", "American", "Southwest", "Alaska"]
            flight_num = random.randint(100, 9999)
            airline = random.choice(airlines)
            
            dep_hour = random.randint(6, 22)
            dep_min = random.choice([0, 15, 30, 45])
            arr_hour = (dep_hour + random.randint(2, 6)) % 24
            arr_min = (dep_min + random.randint(0, 45)) % 60
            
            result = {
                "flights": [
                    {
                        "airline": airline,
                        "flight_number": f"{airline[:2].upper()}{flight_num}",
                        "origin": origin.upper(),
                        "destination": destination.upper(),
                        "departure": f"{dep_hour:02d}:{dep_min:02d}",
                        "arrival": f"{arr_hour:02d}:{arr_min:02d}",
                        "cabin": cabin,
                        "duration_minutes": random.randint(120, 360),
                        "price": random.randint(200, 1200),
                    }
                    for _ in range(3)
                ],
                "search_params": {
                    "origin": origin,
                    "destination": destination,
                    "date": date,
                    "cabin": cabin,
                },
            }
            
            self.state.tool_phase = "idle"
            self._tool_fence = {}
            return result
            
        except asyncio.CancelledError:
            self.state.tool_phase = "idle"
            raise

    @function_tool(
        name="search_hotels",
        description="Search for hotels with city, check-in, check-out, and star rating"
    )
    async def search_hotels(
        self,
        city: str,
        checkin: str,
        checkout: str,
        stars: int = 3,
    ) -> dict:
        """Search for hotels with cancellation support. Simulates 3-4s API latency."""
        self.state.tool_phase = "search_hotels"
        self._current_tool_task = asyncio.current_task()
        
        try:
            for i in range(4):
                if asyncio.current_task().cancelled():
                    raise asyncio.CancelledError("Hotel search interrupted by user")
                await asyncio.sleep(1)
            
            import random
            hotel_names = [
                "Grand Plaza", "City Center Inn", "Riverside Hotel", "Metropolitan Suites",
                "Parkview Lodge", "Harbor Lights", "Skyline Tower", "Garden Court"
            ]
            
            result = {
                "hotels": [
                    {
                        "name": f"{random.choice(hotel_names)} {city}",
                        "city": city,
                        "stars": stars,
                        "price_per_night": random.randint(80, 400),
                        "rating": round(random.uniform(3.5, 4.9), 1),
                        "amenities": random.sample(
                            ["WiFi", "Pool", "Gym", "Breakfast", "Parking", "Spa", "Restaurant", "Bar"],
                            k=random.randint(3, 6)
                        ),
                        "address": f"{random.randint(100, 999)} Main St, {city}",
                    }
                    for _ in range(3)
                ],
                "search_params": {
                    "city": city,
                    "checkin": checkin,
                    "checkout": checkout,
                    "stars": stars,
                },
            }
            
            self.state.tool_phase = "idle"
            self._tool_fence = {}
            return result
            
        except asyncio.CancelledError:
            self.state.tool_phase = "idle"
            raise


async def entrypoint(ctx: JobContext):
    logger.info("Starting ATC Interruptible Trainer agent")
    
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    vad = silero.VAD.load()
    agent = ATCInterruptibleAgent()
    
    session = AgentSession(
        vad=vad,
        min_endpointing_delay=0.5,
        max_endpointing_delay=3.0,
    )
    
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    # Handle interrupt and tool_cancel data messages from frontend
    @ctx.room.on("data_received")
    def handle_data_received(data: rtc.DataPacket):
        try:
            payload = json.loads(data.data.decode("utf-8"))
            msg_type = payload.get("type")
            
            if msg_type == "interrupt":
                transcript = payload.get("transcript", "")
                logger.info(f"Received interrupt: {transcript}")
                asyncio.create_task(agent.on_user_interrupted(transcript))
                
            elif msg_type == "tool_cancel":
                tool_name = payload.get("tool", "")
                logger.info(f"Received tool_cancel: {tool_name}")
                if agent._current_tool_task and not agent._current_tool_task.done():
                    agent._current_tool_task.cancel()
                    
        except Exception as e:
            logger.warning(f"Failed to handle data message: {e}")
    
    await session.say(
        "ATC Simulator ready. I'm monitoring for interruptions during phraseology generation. "
        "Try saying 'What runway?' or 'Say again' while I'm composing a clearance."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))