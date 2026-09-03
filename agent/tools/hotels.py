import asyncio
import random
from typing import Dict, Any


class HotelSearchTool:
    def __init__(self):
        self._cancelled = False
    
    async def search_hotels(
        self,
        city: str,
        checkin: str,
        checkout: str,
        stars: int = 3,
    ) -> Dict[str, Any]:
        """Search for hotels with cancellation support. Simulates 3-4s API latency."""
        self._cancelled = False
        
        for i in range(4):
            if asyncio.current_task().cancelled():
                raise asyncio.CancelledError("Hotel search interrupted by user")
            await asyncio.sleep(1)
        
        hotel_names = [
            "Grand Plaza", "City Center Inn", "Riverside Hotel", "Metropolitan Suites",
            "Parkview Lodge", "Harbor Lights", "Skyline Tower", "Garden Court"
        ]
        
        return {
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


hotel_search_tool = HotelSearchTool()


async def search_hotels(
    city: str,
    checkin: str,
    checkout: str,
    stars: int = 3,
) -> Dict[str, Any]:
    """Search for hotels. Can be interrupted by user."""
    return await hotel_search_tool.search_hotels(city, checkin, checkout, stars)