import inspect
import os
import logging

from eth_account import Account

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from integrity_sdk import chain
from integrity_sdk.registration import register_agent, RegistrationError
from integrity_sdk.did import load_or_create_did
from integrity_sdk.wallet import generate_or_load_evm_wallet
from integrity_sdk.markets import allocate_capital
from integrity_sdk.chain import load_deployments

from integrity_demo.agent_loop import IntegrityAgent
from integrity_demo import userapi_bridge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("integrity_demo.main")

OTLP_ENDPOINT = "http://localhost:4317"

# Per-agent OTel tracers, deliberately NOT installed as the process-global
# provider. `opentelemetry.trace.set_tracer_provider` (and this SDK's own
# `telemetry/core.py::init_telemetry`, which wraps it) is a one-shot global
# -- the first call wins, every later call is a silent no-op. This engine
# registers 4 independent agent identities in one process, and the oracle's
# real OTLP receiver requires a genuine `integrity.agent.id` resource
# attribute on every span it accepts. The old code here built ONE shared
# module-level Resource with no such attribute at all, so every span this
# engine ever exported was rejected -- found by actually running this
# against a real oracle, not by inspection (see PRODUCTION_GAPS.md).
# Building one TracerProvider per agent and using it directly via
# `.get_tracer()`, never through the global setter, is the standard
# OTel pattern for several independent resources coexisting in one process.
_tracers: dict = {}


def _tracer_for(agent_id: str):
    if agent_id not in _tracers:
        resource = Resource.create(
            {
                "service.name": "integrity-demo-scenario-engine",
                "integrity.agent.id": agent_id,
            }
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=OTLP_ENDPOINT, insecure=True)))
        _tracers[agent_id] = provider.get_tracer(__name__)
    return _tracers[agent_id]


def _check_funder_balance(agent_ids: list) -> None:
    """Real preflight check against the actual chain, not a guess -- reads
    the same FUNDER_PRIVATE_KEY/RPC_URL `register_agent` itself reads, and
    fails loudly with the exact shortfall before any registration is
    attempted. Found the need for this the hard way: the funder wallet on
    live Base Sepolia sits well under one agent's worth of funding today
    (see FAUCET_INFO.md) -- without this check, a real run silently fails
    registration 1 of N with a deep RPC error instead of a clear upfront
    one. Required amount is read off `register_agent`'s own default
    parameter via reflection, not a second hardcoded constant that could
    drift from the real one."""
    funder_key = os.getenv("FUNDER_PRIVATE_KEY")
    if not funder_key:
        return  # register_agent() raises its own clear error for this
    rpc_url = os.getenv("RPC_URL", "http://localhost:8545")
    w3 = chain.get_w3(rpc_url)
    if not w3.is_connected():
        return  # register_agent() raises its own clear error for this

    fund_amount_wei = inspect.signature(register_agent).parameters["fund_amount_wei"].default
    funder = Account.from_key(funder_key)
    balance = w3.eth.get_balance(funder.address)
    required = fund_amount_wei * len(agent_ids)
    if balance < required:
        raise RegistrationError(
            f"Funder wallet {funder.address} has {w3.from_wei(balance, 'ether')} ETH, but "
            f"registering {len(agent_ids)} agents needs at least {w3.from_wei(required, 'ether')} ETH "
            f"({w3.from_wei(fund_amount_wei, 'ether')} ETH each, register_agent's own default). "
            f"Fund the wallet before running this scenario -- see FAUCET_INFO.md for faucet links."
        )


def main():
    logger.info("Initializing Integrity Demo Scenario Engine")
    # No-op unless USERAPI_URL/USERAPI_TOKEN/USERAPI_RUN_ID are all set (see
    # userapi_bridge.py's module docstring) -- lets an operator tie this run
    # back to a demo_runs row created via POST /demo/run beforehand.
    userapi_bridge.report_status("running")

    try:
        summary = _run_scenario()
    except Exception as exc:
        userapi_bridge.report_status("failed", {"error": str(exc)})
        raise
    else:
        userapi_bridge.report_status("completed", summary)


def _run_scenario() -> dict:
    agents = [
        {"id": "healthcare_agent", "vertical": "healthcare"},
        {"id": "prediction_market_agent", "vertical": "prediction_market"},
        {"id": "trading_agent", "vertical": "trading"},
        {"id": "capital_allocation_agent", "vertical": "capital_allocation"},
    ]

    _check_funder_balance([a["id"] for a in agents])

    agent_data = {}

    for a in agents:
        logger.info(f"Registering {a['id']}...")
        with _tracer_for(a["id"]).start_as_current_span("register_agent"):
            try:
                # skip_oracle_registration if no oracle running locally
                reg = register_agent(
                    agent_id=a["id"],
                    compliance_vertical=a["vertical"],
                    skip_oracle_registration=True
                )
                _, keypair, _ = load_or_create_did(a["id"])
                evm_wallet = generate_or_load_evm_wallet(a["id"])

                agent_data[a["id"]] = {
                    "registration": reg,
                    "keypair": keypair,
                    "evm_wallet": evm_wallet
                }
            except Exception as e:
                logger.error(f"Failed to register {a['id']}: {e}")

    tool_call_error = None
    if "capital_allocation_agent" in agent_data:
        allocator = agent_data["capital_allocation_agent"]
        target = agent_data.get("trading_agent")

        if target:
            allocator_tracer = _tracer_for("capital_allocation_agent")

            def tool_allocate_capital(target_address: str, amount_wei: str):
                with allocator_tracer.start_as_current_span("agent_tool_allocate_capital") as span:
                    span.set_attribute("agent.id", "capital_allocation_agent")
                    span.set_attribute("target.address", target_address)
                    try:
                        deployments = load_deployments(os.getenv("DEPLOYMENTS_FILE", "../../deployments.local.json"))
                        alloc_id, token = allocate_capital(
                            allocator_agent_id="capital_allocation_agent",
                            keypair=allocator["keypair"],
                            evm_account=allocator["evm_wallet"],
                            allocator_sovereign_agent_address=allocator["registration"].sovereign_agent,
                            capital_pool_address=deployments["singletons"]["A2ACapitalPool"],
                            itk_address=deployments["singletons"]["IntegrityToken"],
                            target_agent_address=target_address,
                            amount_wei=int(amount_wei),
                            min_ais_to_maintain=50,
                            nonce=1,
                            bcc_middleware_url="http://localhost:8000"
                        )
                        span.set_attribute("allocation.id", alloc_id)
                        return {"status": "success", "allocation_id": alloc_id, "token": token}
                    except Exception as e:
                        span.record_exception(e)
                        return {"status": "error", "message": str(e)}

            tools = [{
                "type": "function",
                "function": {
                    "name": "allocate_capital",
                    "description": "Allocate ITK capital to another trusted agent on-chain.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_address": {"type": "string", "description": "The target agent's SovereignAgent contract address"},
                            "amount_wei": {"type": "string", "description": "Amount in WEI to allocate"}
                        },
                        "required": ["target_address", "amount_wei"]
                    }
                }
            }]
            tool_map = {"allocate_capital": tool_allocate_capital}

            logger.info("Running Xibalba Agent Loop for Capital Allocator...")
            agent = IntegrityAgent(
                system_prompt="You are a capital allocator agent. Your task is to allocate 1000000000000000000 WEI (1 ITK) to the trading agent.",
                tools=tools,
                tool_map=tool_map
            )

            # Real, previously-unguarded LLM call -- found by actually
            # running this: any failure here (bad/missing API key, rate
            # limit, network outage) used to crash the entire process with
            # a raw traceback, unlike the registration loop above (which
            # already degrades one agent at a time). Now degrades the same
            # way: log it, record it in the summary main() reports via
            # userapi_bridge, and let the run finish with whatever DID
            # register successfully rather than losing that too.
            try:
                with allocator_tracer.start_as_current_span("agent_conversation") as span:
                    span.set_attribute("agent.id", "capital_allocation_agent")
                    target_addr = target["registration"].sovereign_agent
                    response = agent.run_conversation(f"Please allocate capital to the trading agent. Their address is: {target_addr}")
                    logger.info(f"Agent Final Response: {response}")
            except Exception as e:
                logger.error(f"Capital allocator's agent conversation failed: {e}")
                tool_call_error = str(e)

    summary = {
        "agents_attempted": len(agents),
        "agents_registered": sorted(agent_data.keys()),
        "sovereign_agent_addresses": {
            agent_id: data["registration"].sovereign_agent for agent_id, data in agent_data.items()
        },
    }
    if tool_call_error:
        summary["tool_call_error"] = tool_call_error
    return summary


if __name__ == "__main__":
    main()
