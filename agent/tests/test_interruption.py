import asyncio
import sys
sys.path.insert(0, '.')

from agent.tools.flights import flight_search_tool
from agent.tools.hotels import hotel_search_tool


async def test_flight_search_cancellation():
    """Test that flight search can be cancelled mid-execution."""
    print("Testing flight search cancellation...")
    
    task = asyncio.create_task(flight_search_tool.search_flights('BOS', 'NRT', '2025-11-15'))
    
    # Let it run for 1.5 seconds
    await asyncio.sleep(1.5)
    
    # Cancel the task
    task.cancel()
    
    try:
        await task
        print("FAIL: Task should have been cancelled")
        return False
    except asyncio.CancelledError:
        print("PASS: Flight search cancelled correctly")
        return True


async def test_hotel_search_cancellation():
    """Test that hotel search can be cancelled mid-execution."""
    print("Testing hotel search cancellation...")
    
    task = asyncio.create_task(hotel_search_tool.search_hotels('Paris', '2025-12-01', '2025-12-05'))
    
    # Let it run for 1.5 seconds
    await asyncio.sleep(1.5)
    
    # Cancel the task
    task.cancel()
    
    try:
        await task
        print("FAIL: Task should have been cancelled")
        return False
    except asyncio.CancelledError:
        print("PASS: Hotel search cancelled correctly")
        return True


async def test_flight_search_completion():
    """Test that flight search completes normally when not cancelled."""
    print("Testing flight search completion...")
    
    try:
        result = await flight_search_tool.search_flights('BOS', 'NRT', '2025-11-15', 'business')
        
        if 'flights' in result and len(result['flights']) == 3:
            print("PASS: Flight search completed with 3 results")
            return True
        else:
            print(f"FAIL: Unexpected result structure: {result}")
            return False
    except Exception as e:
        print(f"FAIL: Flight search raised exception: {e}")
        return False


async def test_hotel_search_completion():
    """Test that hotel search completes normally when not cancelled."""
    print("Testing hotel search completion...")
    
    try:
        result = await hotel_search_tool.search_hotels('Tokyo', '2025-11-15', '2025-11-20', 4)
        
        if 'hotels' in result and len(result['hotels']) == 3:
            print("PASS: Hotel search completed with 3 results")
            return True
        else:
            print(f"FAIL: Unexpected result structure: {result}")
            return False
    except Exception as e:
        print(f"FAIL: Hotel search raised exception: {e}")
        return False


async def test_rapid_cancellations():
    """Test rapid successive cancellations (simulating rapid interrupts)."""
    print("Testing rapid successive cancellations...")
    
    tasks = []
    for i in range(3):
        task = asyncio.create_task(flight_search_tool.search_flights('JFK', 'LAX', '2025-11-15'))
        tasks.append(task)
        await asyncio.sleep(0.5)
    
    # Cancel all
    for task in tasks:
        task.cancel()
    
    cancelled_count = 0
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            cancelled_count += 1
    
    if cancelled_count == 3:
        print("PASS: All 3 rapid tasks cancelled correctly")
        return True
    else:
        print(f"FAIL: Only {cancelled_count}/3 tasks cancelled")
        return False


async def main():
    print("=" * 60)
    print("ATC Interruptible Trainer - Tool Cancellation Tests")
    print("=" * 60)
    
    results = []
    
    results.append(await test_flight_search_cancellation())
    results.append(await test_hotel_search_cancellation())
    results.append(await test_flight_search_completion())
    results.append(await test_hotel_search_completion())
    results.append(await test_rapid_cancellations())
    
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("ALL TESTS PASSED")
        return 0
    else:
        print("SOME TESTS FAILED")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)