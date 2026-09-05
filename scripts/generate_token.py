#!/usr/bin/env python3
"""
Generate LiveKit access token for the ATC Simulator.

Usage:
    python scripts/generate_token.py --identity pilot-1 --room atc-training --ttl 1h
    python scripts/generate_token.py --identity pilot-1 --room atc-training --ttl 24h --metadata '{"role": "student"}'

Environment variables required (from .env):
    LIVEKIT_API_KEY
    LIVEKIT_API_SECRET
"""

import argparse
import os
import sys
from pathlib import Path

# Add parent directory to path to import agent modules
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from livekit.api import AccessToken, VideoGrants
except ImportError:
    print("Error: livekit-api not installed. Run: pip install livekit-api")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)


def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
    else:
        print(f"Warning: .env file not found at {env_path}")


def generate_token(identity: str, room: str, ttl: str, metadata: str = "") -> str:
    """Generate a LiveKit access token."""
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not api_key or not api_secret:
        print("Error: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in .env")
        sys.exit(1)

    # Parse TTL (e.g., "1h", "24h", "30m")
    ttl_seconds = parse_ttl(ttl)

    token = AccessToken(api_key, api_secret) \
        .with_identity(identity) \
        .with_name(f"Pilot {identity}") \
        .with_ttl(ttl_seconds) \
        .with_grants(VideoGrants(
            room_join=True,
            room=room,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        ))

    if metadata:
        token = token.with_metadata(metadata)

    return token.to_jwt()


def parse_ttl(ttl: str) -> int:
    """Parse TTL string like '1h', '30m', '24h' into seconds."""
    ttl = ttl.lower().strip()
    if ttl.endswith('h'):
        return int(ttl[:-1]) * 3600
    elif ttl.endswith('m'):
        return int(ttl[:-1]) * 60
    elif ttl.endswith('s'):
        return int(ttl[:-1])
    else:
        # Assume hours if no unit
        return int(ttl) * 3600


def main():
    parser = argparse.ArgumentParser(
        description="Generate LiveKit access token for ATC Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "--identity", "-i",
        default="pilot-1",
        help="Participant identity (default: pilot-1)"
    )
    parser.add_argument(
        "--room", "-r",
        default="atc-training",
        help="Room name (default: atc-training)"
    )
    parser.add_argument(
        "--ttl", "-t",
        default="1h",
        help="Token TTL (e.g., 1h, 30m, 24h) (default: 1h)"
    )
    parser.add_argument(
        "--metadata", "-m",
        default="",
        help="Optional metadata as JSON string"
    )
    parser.add_argument(
        "--env-file", "-e",
        default=".env",
        help="Path to .env file (default: .env)"
    )

    args = parser.parse_args()

    # Load environment
    env_path = Path(args.env_file)
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)
    else:
        print(f"Error: .env file not found at {env_path}")
        print("Copy .env.example to .env and fill in your credentials")
        sys.exit(1)

    token = generate_token(args.identity, args.room, args.ttl, args.metadata)
    print(token)


if __name__ == "__main__":
    main()