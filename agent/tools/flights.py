import asyncio
import random
from typing import Dict, Any


class FlightSearchTool:
    def __init__(self):
        self._cancelled = False
    
    async def search_flights(
        self,
        origin: str,
        destination: str,
        date: str,
        cabin: str = "economy",
    ) -> Dict[str, Any]:
        """Search for flights with cancellation support. Simulates 3-5s API latency."""
        self._cancelled = False
        
        for i in range(5):
            if asyncio.current_task().cancelled():
                raise asyncio.CancelledError("Flight search interrupted by user")
            await asyncio.sleep(1)
        
        airlines = ["United", "Delta", "American", "Southwest", "Alaska"]
        flight_num = random.randint(100, 9999)
        airline = random.choice(airlines)
        
        dep_hour = random.randint(6, 22)
        dep_min = random.choice([0, 15, 30, 45])
        arr_hour = (dep_hour + random.randint(2, 6)) % 24
        arr_min = (dep_min + random.randint(0, 45)) % 60
        
        return {
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


flight_search_tool = FlightSearchTool()


async def search_flights(
    origin: str,
    destination: str,
    date: str,
    cabin: str = "economy",
) -> Dict[str, Any]:
    """Search for flights. Can be interrupted by user."""
    return await flight_search_tool.search_flights(origin, destination, date, cabin)