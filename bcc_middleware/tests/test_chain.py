from __future__ import annotations

import pytest
import respx
from httpx import Response

from app.chain import AgentResolutionError, resolve_agent_primitives
from tests.helpers import new_agent

_ORACLE_URL = "http://oracle.test"


def test_resolve_agent_primitives_http_error():
    """Test that resolve_agent_primitives raises AgentResolutionError on HTTP errors."""
    with respx.mock:
        agent_id, _ = new_agent()
        respx.get(f"{_ORACLE_URL}/v1/agent/{agent_id}").mock(
            return_value=Response(500, json={"error": "Internal Server Error"})
        )

        with pytest.raises(AgentResolutionError) as exc_info:
            resolve_agent_primitives(_ORACLE_URL, agent_id)

        assert f"could not resolve agent {agent_id} from oracle {_ORACLE_URL}" in str(
            exc_info.value
        )
        assert "500" in str(exc_info.value)


def test_resolve_agent_primitives_malformed_json():
    """Test that resolve_agent_primitives raises AgentResolutionError on invalid JSON response."""
    with respx.mock:
        agent_id, _ = new_agent()
        respx.get(f"{_ORACLE_URL}/v1/agent/{agent_id}").mock(
            return_value=Response(200, text="Not a JSON object")
        )

        with pytest.raises(AgentResolutionError) as exc_info:
            resolve_agent_primitives(_ORACLE_URL, agent_id)

        assert f"could not resolve agent {agent_id} from oracle {_ORACLE_URL}" in str(
            exc_info.value
        )


def test_resolve_agent_primitives_missing_primitives():
    """Test that resolve_agent_primitives raises AgentResolutionError when primitives object is missing."""
    with respx.mock:
        agent_id, _ = new_agent()
        respx.get(f"{_ORACLE_URL}/v1/agent/{agent_id}").mock(
            return_value=Response(200, json={"id": agent_id})
        )

        with pytest.raises(AgentResolutionError) as exc_info:
            resolve_agent_primitives(_ORACLE_URL, agent_id)

        assert f"oracle returned no primitives for agent {agent_id}" in str(
            exc_info.value
        )


def test_resolve_agent_primitives_missing_sovereign_agent():
    """Test that resolve_agent_primitives raises AgentResolutionError when sovereign_agent is missing."""
    with respx.mock:
        agent_id, _ = new_agent()
        respx.get(f"{_ORACLE_URL}/v1/agent/{agent_id}").mock(
            return_value=Response(
                200, json={"id": agent_id, "primitives": {"state_anchor": "0x123"}}
            )
        )

        with pytest.raises(AgentResolutionError) as exc_info:
            resolve_agent_primitives(_ORACLE_URL, agent_id)

        assert f"oracle returned no primitives for agent {agent_id}" in str(
            exc_info.value
        )
