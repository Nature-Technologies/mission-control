"""
Advanced examples for using the Test Agent Creator with test frameworks.

These examples show how to integrate agent creation into pytest, unittest, and Playwright tests.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# Example 1: Pytest Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/conftest.py

This example shows how to create pytest fixtures that automatically
set up test agents before tests run and clean them up afterward.
"""

# import pytest
# from create_test_agent import AgentCreator
#
# # Shared creator instance
# _creator = None
#
# def get_creator():
#     global _creator
#     if _creator is None:
#         _creator = AgentCreator()
#     return _creator
#
#
# @pytest.fixture(scope="session")
# def agent_creator():
#     """Provide AgentCreator instance for all tests"""
#     return get_creator()
#
#
# @pytest.fixture
# def test_agent(agent_creator):
#     """Create a fresh test agent for each test"""
#     agent = agent_creator.create_agent(
#         name=f"test-agent-{int(time.time() * 1000)}",
#         role="tester",
#     )
#     yield agent
#     # Cleanup after test
#     agent_creator.delete_agent(agent["id"])
#
#
# @pytest.fixture
# def multi_agent_setup(agent_creator):
#     """Create multiple agents with different roles"""
#     agents = []
#     roles = ["developer", "reviewer", "operator"]
#     for i, role in enumerate(roles):
#         agent = agent_creator.create_agent(
#             name=f"test-{role}-{i}",
#             role=role,
#             template=role if role in ["developer", "reviewer", "operator"] else None,
#         )
#         agents.append(agent)
#     yield agents
#     # Cleanup
#     for agent in agents:
#         agent_creator.delete_agent(agent["id"])
#
#
# @pytest.fixture(scope="session")
# def load_test_agents(agent_creator):
#     """Create many agents for load testing"""
#     agents = agent_creator.create_batch(
#         count=20,
#         prefix="load-test",
#         include_souls=True,
#     )
#     yield agents
#     # Cleanup all load test agents
#     agent_creator.delete_agent(*[a["id"] for a in agents])


# ═══════════════════════════════════════════════════════════════════════════════
# Example 2: Pytest Test Cases Using Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/test_agent_creation.py

Example of pytest tests that use the fixtures defined above.
"""

# import pytest
#
# def test_create_single_agent(test_agent):
#     """Test that a single agent is created successfully"""
#     assert test_agent["id"] is not None
#     assert test_agent["name"].startswith("test-agent-")
#     assert test_agent["role"] == "tester"
#
#
# def test_multi_agent_setup(multi_agent_setup):
#     """Test that multiple agents with different roles are created"""
#     assert len(multi_agent_setup) == 3
#     roles = [a["role"] for a in multi_agent_setup]
#     assert "developer" in roles
#     assert "reviewer" in roles
#     assert "operator" in roles
#
#
# def test_load_test_agents_count(load_test_agents):
#     """Test that load test agents are created"""
#     assert len(load_test_agents) >= 20
#
#
# def test_agent_with_soul(agent_creator):
#     """Test creating an agent with soul template"""
#     from create_test_agent import SOUL_TEMPLATES
#
#     agent = agent_creator.create_agent(
#         name=f"soul-test-{int(time.time() * 1000)}",
#         role="tester",
#         soul_content=SOUL_TEMPLATES["analyst"],
#     )
#     assert agent["soul_content"] is not None
#     agent_creator.delete_agent(agent["id"])


# ═══════════════════════════════════════════════════════════════════════════════
# Example 3: Unittest Integration
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/test_agents_unittest.py

Example using Python's built-in unittest framework.
"""

# import unittest
# import time
# from create_test_agent import AgentCreator
#
# class TestAgentCreation(unittest.TestCase):
#     """Test cases for agent creation"""
#
#     @classmethod
#     def setUpClass(cls):
#         """Set up test fixtures once for all tests"""
#         cls.creator = AgentCreator()
#         cls.created_agents = []
#
#     @classmethod
#     def tearDownClass(cls):
#         """Clean up all created agents"""
#         for agent in cls.created_agents:
#             try:
#                 cls.creator.delete_agent(agent["id"])
#             except Exception:
#                 pass
#
#     def setUp(self):
#         """Set up before each test"""
#         self.timestamp = int(time.time() * 1000)
#
#     def _create_agent(self, name, role="tester"):
#         """Helper to create an agent and track it for cleanup"""
#         agent = self.creator.create_agent(name=name, role=role)
#         self.created_agents.append(agent)
#         return agent
#
#     def test_agent_creation(self):
#         """Test basic agent creation"""
#         agent = self._create_agent(f"unittest-{self.timestamp}")
#         self.assertIsNotNone(agent["id"])
#         self.assertEqual(agent["role"], "tester")
#
#     def test_agent_with_template(self):
#         """Test agent creation with template"""
#         agent = self.creator.create_agent(
#             name=f"template-test-{self.timestamp}",
#             role="tester",
#             template="developer",
#         )
#         self.created_agents.append(agent)
#         self.assertIsNotNone(agent["id"])
#
#     def test_batch_creation(self):
#         """Test batch agent creation"""
#         agents = self.creator.create_batch(
#             count=3,
#             prefix=f"batch-{self.timestamp}",
#         )
#         self.created_agents.extend(agents)
#         self.assertEqual(len(agents), 3)


# ═══════════════════════════════════════════════════════════════════════════════
# Example 4: Playwright Integration
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/test_agents_e2e.py

Example integrating with Playwright for E2E testing.
"""

# from playwright.sync_api import sync_playwright
# from create_test_agent import AgentCreator
# import time
#
# def test_agent_dashboard():
#     \"\"\"Test agent dashboard with created test agents\"\"\"
#     creator = AgentCreator()
#
#     # Create test agents
#     agents = creator.create_batch(
#         count=5,
#         prefix=f"e2e-test-{int(time.time())}",
#     )
#
#     try:
#         with sync_playwright() as p:
#             browser = p.chromium.launch()
#             page = browser.new_page()
#
#             # Navigate to agents page
#             page.goto("http://localhost:3000/agents")
#
#             # Verify agents appear in dashboard
#             for agent in agents:
#                 page.wait_for_selector(f"text={agent['name']}", timeout=5000)
#
#             browser.close()
#     finally:
#         # Cleanup
#         for agent in agents:
#             creator.delete_agent(agent["id"])


# ═══════════════════════════════════════════════════════════════════════════════
# Example 5: Direct Module Usage in Scripts
# ═══════════════════════════════════════════════════════════════════════════════

"""
Example script for direct usage without test frameworks.
"""

# from create_test_agent import AgentCreator, SOUL_TEMPLATES, TEMPLATES
# import json
#
# def setup_multi_agent_scenario():
#     \"\"\"Set up a complex multi-agent testing scenario\"\"\"
#     creator = AgentCreator(
#         base_url="http://localhost:3000",
#         api_key="your-api-key",
#     )
#
#     agents = {}
#
#     # Create a developer agent
#     print("Creating developer agent...")
#     agents["developer"] = creator.create_agent(
#         name="dev-agent-1",
#         role="developer",
#         template="developer",
#         soul_content=SOUL_TEMPLATES["analyst"],
#     )
#
#     # Create a reviewer agent
#     print("Creating reviewer agent...")
#     agents["reviewer"] = creator.create_agent(
#         name="reviewer-1",
#         role="reviewer",
#         template="reviewer",
#         soul_content=SOUL_TEMPLATES["strict"],
#     )
#
#     # Create a coordinator agent
#     print("Creating coordinator agent...")
#     agents["coordinator"] = creator.create_agent(
#         name="coordinator-1",
#         role="coordinator",
#         template="coordinator",
#         soul_content=SOUL_TEMPLATES["helper"],
#     )
#
#     # Save configuration
#     with open("test_agents_config.json", "w") as f:
#         json.dump(agents, f, indent=2)
#
#     return agents
#
#
# if __name__ == "__main__":
#     agents = setup_multi_agent_scenario()
#     print(f"\nCreated {len(agents)} agents:")
#     for role, agent in agents.items():
#         print(f"  {role}: {agent['name']} (ID: {agent['id']})")


# ═══════════════════════════════════════════════════════════════════════════════
# Example 6: Test Data Builder Pattern
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/builders.py

Builder pattern for flexible test data creation.
"""

# from create_test_agent import AgentCreator, SOUL_TEMPLATES, TEMPLATES
# from typing import Optional
#
# class AgentBuilder:
#     \"\"\"Builder for creating test agents with fluent API\"\"\"
#
#     def __init__(self, creator: AgentCreator):
#         self.creator = creator
#         self.name: Optional[str] = None
#         self.role = "tester"
#         self.template: Optional[str] = None
#         self.soul: Optional[str] = None
#         self.config: Optional[dict] = None
#
#     def with_name(self, name: str) -> "AgentBuilder":
#         self.name = name
#         return self
#
#     def with_role(self, role: str) -> "AgentBuilder":
#         self.role = role
#         return self
#
#     def with_template(self, template: str) -> "AgentBuilder":
#         self.template = template
#         return self
#
#     def with_soul(self, soul_name: str) -> "AgentBuilder":
#         self.soul = SOUL_TEMPLATES.get(soul_name)
#         return self
#
#     def with_config(self, config: dict) -> "AgentBuilder":
#         self.config = config
#         return self
#
#     def build(self) -> dict:
#         \"\"\"Build and create the agent\"\"\"
#         if not self.name:
#             raise ValueError("Agent name is required")
#
#         return self.creator.create_agent(
#             name=self.name,
#             role=self.role,
#             template=self.template,
#             soul_content=self.soul,
#             config=self.config,
#         )
#
#
# # Usage example
# def test_with_builder():
#     creator = AgentCreator()
#
#     agent = (
#         AgentBuilder(creator)
#         .with_name("smart-reviewer")
#         .with_role("reviewer")
#         .with_template("reviewer")
#         .with_soul("strict")
#         .build()
#     )
#
#     assert agent["name"] == "smart-reviewer"


# ═══════════════════════════════════════════════════════════════════════════════
# Example 7: Scenario-Based Test Setup
# ═══════════════════════════════════════════════════════════════════════════════

"""
File: tests/scenarios.py

Pre-configured test scenarios for common testing needs.
"""

# from create_test_agent import AgentCreator, SOUL_TEMPLATES
#
# class TestScenarios:
#     \"\"\"Pre-configured test scenarios\"\"\"
#
#     @staticmethod
#     def code_review_workflow(creator: AgentCreator):
#         \"\"\"Set up agents for code review testing\"\"\"
#         return {
#             "developer": creator.create_agent(
#                 name="dev-1",
#                 role="developer",
#                 template="developer",
#                 soul_content=SOUL_TEMPLATES["creative"],
#             ),
#             "reviewer": creator.create_agent(
#                 name="reviewer-1",
#                 role="reviewer",
#                 template="reviewer",
#                 soul_content=SOUL_TEMPLATES["strict"],
#             ),
#             "coordinator": creator.create_agent(
#                 name="coordinator-1",
#                 role="coordinator",
#                 soul_content=SOUL_TEMPLATES["helper"],
#             ),
#         }
#
#     @staticmethod
#     def high_load_scenario(creator: AgentCreator, agent_count=100):
#         \"\"\"Set up many agents for load testing\"\"\"
#         return creator.create_batch(
#             count=agent_count,
#             prefix="load-test",
#             include_souls=False,  # Skip souls for faster creation
#         )
#
#     @staticmethod
#     def personality_test_scenario(creator: AgentCreator):
#         \"\"\"Create agents with all personality types\"\"\"
#         agents = {}
#         for soul_name in SOUL_TEMPLATES.keys():
#             agents[soul_name] = creator.create_agent(
#                 name=f"agent-{soul_name}",
#                 role="tester",
#                 soul_content=SOUL_TEMPLATES[soul_name],
#             )
#         return agents
#
#
# # Usage
# def test_code_review_workflow():
#     creator = AgentCreator()
#     agents = TestScenarios.code_review_workflow(creator)
#
#     # Now run your tests with these agents...
#
#     # Cleanup
#     for agent in agents.values():
#         creator.delete_agent(agent["id"])
