"""Tests for integrity_cli.client: IntegrityClient/BccClient HTTP behavior.

Uses pytest-httpx to mock the actual HTTP layer -- this is testing our own
client/error-handling logic, not standing in for a real server, which is
exactly the legitimate use of mocks called out in the task brief (we're not
implementing integrity-oracle or bcc_middleware here).
"""
from __future__ import annotations

import httpx
import pytest

from integrity_cli import config
from integrity_cli.client import ApiError, BccClient, IntegrityClient


def test_get_success_returns_parsed_json(httpx_mock):
    httpx_mock.add_response(
        url="http://oracle.test/v1/agent/did:integrity:abc",
        method="GET",
        json={"agent_id": "did:integrity:abc", "alias": "bot"},
    )
    client = IntegrityClient(base_url="http://oracle.test")
    result = client.get("/v1/agent/did:integrity:abc")
    assert result == {"agent_id": "did:integrity:abc", "alias": "bot"}


def test_post_sends_json_body_and_auth_header(httpx_mock):
    config.set_config_value("AUTH_TOKEN", "tok123")
    config.set_config_value("ENVIRONMENT", "local")

    httpx_mock.add_response(
        url="http://oracle.test/v1/agent/register", method="POST", json={"agent_id": "x"}
    )
    client = IntegrityClient(base_url="http://oracle.test")
    result = client.post("/v1/agent/register", json_data={"alias": "bot"})
    assert result == {"agent_id": "x"}

    request = httpx_mock.get_requests()[0]
    assert request.headers["authorization"] == "Bearer tok123"
    assert request.headers["content-type"] == "application/json"


def test_no_auth_header_sent_when_no_token_configured(httpx_mock):
    httpx_mock.add_response(url="http://oracle.test/v1/agent/x", method="GET", json={})
    client = IntegrityClient(base_url="http://oracle.test")
    client.get("/v1/agent/x")
    request = httpx_mock.get_requests()[0]
    assert "authorization" not in request.headers


def test_http_error_response_raises_api_error_with_detail(httpx_mock):
    httpx_mock.add_response(
        url="http://oracle.test/v1/agent/missing",
        method="GET",
        status_code=404,
        json={"detail": "agent not found"},
    )
    client = IntegrityClient(base_url="http://oracle.test")
    with pytest.raises(ApiError, match="agent not found"):
        client.get("/v1/agent/missing")


def test_http_error_without_json_body_falls_back_to_text(httpx_mock):
    httpx_mock.add_response(
        url="http://oracle.test/v1/agent/missing",
        method="GET",
        status_code=500,
        content=b"internal error",
    )
    client = IntegrityClient(base_url="http://oracle.test")
    with pytest.raises(ApiError, match="internal error"):
        client.get("/v1/agent/missing")


def test_connection_error_raises_api_error(httpx_mock):
    httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
    client = IntegrityClient(base_url="http://oracle.test")
    with pytest.raises(ApiError, match="Connection error"):
        client.get("/v1/agent/x")


def test_bcc_client_uses_bcc_middleware_url_not_oracle_url():
    config.set_config_value("ORACLE_URL", "http://oracle.test")
    config.set_config_value("BCC_MIDDLEWARE_URL", "http://bcc.test")
    client = BccClient()
    assert client.base_url == "http://bcc.test"


def test_bcc_client_post_hits_intercept_endpoint(httpx_mock):
    config.set_config_value("BCC_MIDDLEWARE_URL", "http://bcc.test")
    httpx_mock.add_response(
        url="http://bcc.test/v1/bcc/intercept",
        method="POST",
        json={"authorized": True, "reason": "ok"},
    )
    client = BccClient()
    result = client.post("/v1/bcc/intercept", json_data={"agent_id": "did:integrity:abc"})
    assert result["authorized"] is True
