#!/usr/bin/env python3
"""
Custom Agent Creator for Mission Control Testing

This script provides utilities to create and manage test agents via the Mission Control API.
Useful for testing, development, and demonstration purposes.

Usage:
    python create_test_agent.py --name my-agent --role developer
    python create_test_agent.py --name qa-bot --role tester --template reviewer
    python create_test_agent.py --batch 5 --prefix load-test
"""

import argparse
import json
import os
import sys
import time
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime

# Configuration
DEFAULT_MC_URL = os.getenv("MC_URL", "http://localhost:3000")
DEFAULT_API_KEY ="8427a2d5fa692c7f097ec53a381ff3b263a452fb7f29bea4a3944eb0b57d0871"
# Standard headers
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": DEFAULT_API_KEY,
}

# Available templates
TEMPLATES = {
    "developer": {
        "description": "Code-focused developer agent",
        "config": {
            "identity": {"emoji": "🛠️", "theme": "builder engineer"},
            "model": {"primary": "claude-3-5-sonnet-20241022"},
        },
    },
    "reviewer": {
        "description": "Quality/code reviewer",
        "config": {
            "identity": {"emoji": "🔬", "theme": "quality reviewer"},
            "model": {"primary": "claude-3-5-haiku-20241022"},
        },
    },
    "operator": {
        "description": "Operations/infrastructure agent",
        "config": {
            "identity": {"emoji": "⚙️", "theme": "infrastructure"},
            "model": {"primary": "claude-3-5-sonnet-20241022"},
        },
    },
    "coordinator": {
        "description": "Task coordinator/orchestrator",
        "config": {
            "identity": {"emoji": "🎯", "theme": "coordinator"},
            "model": {"primary": "claude-3-5-sonnet-20241022"},
        },
    },
}

# Soul templates for different agent personalities
SOUL_TEMPLATES = {
    "analyst": """# Analyst Agent

You are a thorough analytical agent. Your purpose is to:
- Examine problems systematically
- Break down complex issues into component parts
- Provide detailed findings and recommendations
- Think critically before responding

**Style**: Professional, structured, evidence-based.
**Tone**: Analytical, precise, helpful.
""",
    "creative": """# Creative Agent

You are an imaginative and creative agent. Your purpose is to:
- Generate novel ideas and approaches
- Think outside conventional boundaries
- Explore multiple perspectives
- Suggest innovative solutions

**Style**: Open-minded, exploratory, collaborative.
**Tone**: Enthusiastic, encouraging, idea-focused.
""",
    "strict": """# Strict Quality Agent

You are a rigorous quality-focused agent. Your purpose is to:
- Enforce standards and best practices
- Catch defects before they propagate
- Provide constructive criticism
- Ensure consistency

**Style**: Detail-oriented, principled, standards-based.
**Tone**: Direct, professional, improvement-focused.
""",
    "helper": """# Helper Agent

You are a supportive and helpful agent. Your purpose is to:
- Assist other agents and users
- Answer questions thoroughly
- Provide guidance and support
- Make tasks easier for others

**Style**: Friendly, approachable, supportive.
**Tone**: Warm, patient, collaborative.
""",
}


class AgentCreator:
    """Helper class for creating test agents via Mission Control API"""

    def __init__(self, base_url: str = DEFAULT_MC_URL, api_key: str = DEFAULT_API_KEY):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
        }

    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request to Mission Control API"""
        url = f"{self.base_url}/api{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update(self.headers)

        try:
            if method.upper() == "GET":
                return requests.get(url, headers=headers, **kwargs)
            elif method.upper() == "POST":
                return requests.post(url, headers=headers, **kwargs)
            elif method.upper() == "PUT":
                return requests.put(url, headers=headers, **kwargs)
            elif method.upper() == "DELETE":
                return requests.delete(url, headers=headers, **kwargs)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
        except requests.exceptions.ConnectionError:
            raise RuntimeError(
                f"Failed to connect to Mission Control at {self.base_url}. "
                "Make sure MC is running (pnpm dev) and accessible."
            )

    def create_agent(
        self,
        name: str,
        role: str,
        template: Optional[str] = None,
        soul_content: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        status: str = "offline",
        session_key: Optional[str] = None,
        provision_openclaw: bool = True,
    ) -> Dict[str, Any]:
        """Create a new agent with specified configuration

        Args:
            name: Agent name (must be unique)
            role: Agent role (developer, tester, coordinator, etc.)
            template: Template name ('developer', 'reviewer', 'operator', 'coordinator')
            soul_content: Agent personality/soul (custom SOUL.md content)
            config: Custom configuration object
            status: Initial status (offline, online, sleeping)
            session_key: Optional session key for agent
            provision_openclaw: Whether to provision agent in OpenClaw (default: True)

        Returns:
            Response body with created agent details (id, name, role, etc.)

        Raises:
            RuntimeError: If creation fails
        """
        payload: Dict[str, Any] = {
            "name": name,
            "role": role,
            "status": status,
            "provision_openclaw_workspace": provision_openclaw,
        }

        if template:
            payload["template"] = template
            # Merge template config with custom config
            if config:
                config = {**TEMPLATES.get(template, {}).get("config", {}), **config}
            else:
                config = TEMPLATES.get(template, {}).get("config", {})

        if soul_content:
            payload["soul_content"] = soul_content
        if config:
            payload["config"] = config
        if session_key:
            payload["session_key"] = session_key

        response = self._request("POST", "/agents", json=payload)

        if response.status_code not in (200, 201):
            error_msg = response.json().get("error", "Unknown error")
            raise RuntimeError(f"Failed to create agent: {error_msg}")

        return response.json().get("agent", {})

    def create_batch(
        self,
        count: int,
        prefix: str = "test-agent",
        roles: Optional[List[str]] = None,
        include_souls: bool = True,
        provision_openclaw: bool = True,
    ) -> List[Dict[str, Any]]:
        """Create multiple test agents

        Args:
            count: Number of agents to create
            prefix: Name prefix for all agents
            roles: List of roles to cycle through (if None, uses 'tester')
            include_souls: Whether to assign random soul templates
            provision_openclaw: Whether to provision agents in OpenClaw

        Returns:
            List of created agent details
        """
        if roles is None:
            roles = ["tester"]

        created_agents = []
        for i in range(count):
            role = roles[i % len(roles)]
            agent_name = f"{prefix}-{i+1}"
            soul_name = (
                list(SOUL_TEMPLATES.keys())[i % len(SOUL_TEMPLATES)]
                if include_souls
                else None
            )
            soul_content = SOUL_TEMPLATES.get(soul_name) if soul_name else None

            try:
                print(f"Creating agent {i+1}/{count}: {agent_name} ({role})", end="... ")
                agent = self.create_agent(
                    name=agent_name,
                    role=role,
                    soul_content=soul_content,
                    provision_openclaw=provision_openclaw,
                )
                created_agents.append(agent)
                print(f"✓ (ID: {agent.get('id')})")
                time.sleep(0.1)  # Small delay to avoid rate limiting
            except RuntimeError as e:
                print(f"✗ {e}")

        return created_agents

    def list_agents(self) -> List[Dict[str, Any]]:
        """List all agents"""
        response = self._request("GET", "/agents")

        if response.status_code != 200:
            raise RuntimeError(f"Failed to list agents: {response.json()}")

        return response.json().get("agents", [])

    def get_agent(self, agent_id: int) -> Dict[str, Any]:
        """Get agent by ID"""
        response = self._request("GET", f"/agents/{agent_id}")

        if response.status_code != 200:
            raise RuntimeError(f"Failed to get agent: {response.json()}")

        return response.json().get("agent", {})

    def delete_agent(self, agent_id: int) -> bool:
        """Delete agent by ID"""
        response = self._request("DELETE", f"/agents/{agent_id}")
        return response.status_code in (200, 204)

    def update_agent(self, agent_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update agent configuration"""
        response = self._request("PUT", f"/agents/{agent_id}", json=updates)

        if response.status_code != 200:
            raise RuntimeError(f"Failed to update agent: {response.json()}")

        return response.json().get("agent", {})


def main():
    parser = argparse.ArgumentParser(
        description="Create custom test agents for Mission Control"
    )

    # Connection options
    parser.add_argument(
        "--url",
        default=DEFAULT_MC_URL,
        help=f"Mission Control API URL (default: {DEFAULT_MC_URL})",
    )
    parser.add_argument(
        "--api-key",
        default=DEFAULT_API_KEY,
        help="API key for authentication",
    )

    # Single agent creation
    parser.add_argument("--name", help="Agent name")
    parser.add_argument(
        "--role",
        default="tester",
        help="Agent role (developer, tester, coordinator, etc.)",
    )
    parser.add_argument(
        "--template",
        choices=list(TEMPLATES.keys()),
        help="Use predefined template",
    )
    parser.add_argument(
        "--soul",
        choices=list(SOUL_TEMPLATES.keys()),
        help="Assign soul/personality template",
    )

    # Batch creation
    parser.add_argument(
        "--batch",
        type=int,
        help="Create N test agents in batch",
    )
    parser.add_argument(
        "--prefix",
        default="test-agent",
        help="Name prefix for batch agents",
    )
    parser.add_argument(
        "--no-souls",
        action="store_true",
        help="Don't assign soul templates to batch agents",
    )

    # Listing
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all agents",
    )

    # Cleanup
    parser.add_argument(
        "--cleanup",
        help="Delete agents matching prefix",
    )

    # OpenClaw provisioning
    parser.add_argument(
        "--no-provision-openclaw",
        action="store_true",
        help="Don't provision agent in OpenClaw (useful when OpenClaw is in Docker)",
    )

    args = parser.parse_args()

    creator = AgentCreator(base_url=args.url, api_key=args.api_key)

    try:
        if args.list:
            # List all agents
            print("Fetching agents...\n")
            agents = creator.list_agents()
            if not agents:
                print("No agents found.")
                return

            print(f"Found {len(agents)} agent(s):\n")
            print(f"{'ID':<6} {'Name':<25} {'Role':<15} {'Status':<10} {'Created':<20}")
            print("-" * 76)
            for agent in agents:
                created_at = agent.get("created_at", "N/A")
                print(
                    f"{agent.get('id'):<6} {agent.get('name', 'N/A'):<25} "
                    f"{agent.get('role', 'N/A'):<15} {agent.get('status', 'N/A'):<10} {created_at:<20}"
                )

        elif args.cleanup:
            # Delete agents with matching prefix
            print(f"Looking for agents with prefix: {args.cleanup}\n")
            agents = creator.list_agents()
            matching = [a for a in agents if a.get("name", "").startswith(args.cleanup)]

            if not matching:
                print(f"No agents found with prefix '{args.cleanup}'")
                return

            print(f"Found {len(matching)} agent(s) to delete:")
            for agent in matching:
                print(f"  - {agent.get('name')} (ID: {agent.get('id')})")

            confirm = input("\nDelete these agents? (y/N): ").strip().lower()
            if confirm != "y":
                print("Cancelled.")
                return

            for agent in matching:
                if creator.delete_agent(agent.get("id")):
                    print(f"✓ Deleted {agent.get('name')}")
                else:
                    print(f"✗ Failed to delete {agent.get('name')}")

        elif args.batch:
            # Batch create
            print(f"Creating {args.batch} test agents...\n")
            agents = creator.create_batch(
                count=args.batch,
                prefix=args.prefix,
                include_souls=not args.no_souls,
                provision_openclaw=not args.no_provision_openclaw,
            )
            print(f"\n✓ Created {len(agents)}/{args.batch} agent(s)")
            print("\nSummary:")
            for agent in agents:
                print(
                    f"  - {agent.get('name')} (ID: {agent.get('id')}, "
                    f"Role: {agent.get('role')})"
                )

        else:
            # Single agent create
            if not args.name:
                print("Error: --name is required for single agent creation")
                print("Or use --batch for batch creation, --list to list agents")
                sys.exit(1)

            soul_content = None
            if args.soul:
                soul_content = SOUL_TEMPLATES[args.soul]

            print(f"Creating agent: {args.name}\n")
            print(f"  Role:     {args.role}")
            if args.template:
                print(f"  Template: {args.template}")
            if args.soul:
                print(f"  Soul:     {args.soul}")
            print()

            agent = creator.create_agent(
                name=args.name,
                role=args.role,
                template=args.template,
                soul_content=soul_content,
                provision_openclaw=not args.no_provision_openclaw,
            )

            print("✓ Agent created successfully!\n")
            print(json.dumps(agent, indent=2))

    except RuntimeError as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nCancelled.")
        sys.exit(0)


if __name__ == "__main__":
    main()
