import asyncio
import os
import json
import logging
from web3 import Web3

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from integrity_sdk.registration import register_agent
from integrity_sdk.did import load_or_create_did
from integrity_sdk.wallet import generate_or_load_evm_wallet
from integrity_sdk.markets import enter_prediction, allocate_capital
from integrity_sdk.chain import load_deployments

from integrity_demo.agent_loop import IntegrityAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("integrity_demo.main")

# Configure OpenTelemetry
resource = Resource(attributes={"service.name": "integrity-demo-scenario-engine"})
trace_provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True))
trace_provider.add_span_processor(processor)
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(__name__)

def main():
    logger.info("Initializing Integrity Demo Scenario Engine")
    
    agents = [
        {"id": "healthcare_agent", "vertical": "healthcare"},
        {"id": "prediction_market_agent", "vertical": "prediction_market"},
        {"id": "trading_agent", "vertical": "trading"},
        {"id": "capital_allocation_agent", "vertical": "capital_allocation"},
    ]
    
    agent_data = {}
    
    with tracer.start_as_current_span("register_agents"):
        for a in agents:
            # Register or load existing
            logger.info(f"Registering {a['id']}...")
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

    if "capital_allocation_agent" in agent_data:
        allocator = agent_data["capital_allocation_agent"]
        target = agent_data.get("trading_agent")
        
        if target:
            def tool_allocate_capital(target_address: str, amount_wei: str):
                with tracer.start_as_current_span("agent_tool_allocate_capital") as span:
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
            
            with tracer.start_as_current_span("agent_conversation") as span:
                span.set_attribute("agent.id", "capital_allocation_agent")
                target_addr = target["registration"].sovereign_agent
                response = agent.run_conversation(f"Please allocate capital to the trading agent. Their address is: {target_addr}")
                logger.info(f"Agent Final Response: {response}")

if __name__ == "__main__":
    main()
