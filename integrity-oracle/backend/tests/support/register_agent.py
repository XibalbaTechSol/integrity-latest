#!/usr/bin/env python3
"""
Test support: registers ONE real agent on-chain via integrity-sdk's real
registration flow, and prints the resulting {did, primitives...} as JSON on
stdout for the Rust e2e test to consume.

This is deliberately the real SDK path (fund -> deploy SovereignAgent + StateAnchor
-> grant anchor role -> AgentPrimitivesFactory.registerPrimitives), not a
hand-rolled shortcut — the oracle's on-chain re-verification is only a
meaningful test if the on-chain state it verifies against was produced the
real way. Skips the oracle POST (skip_oracle_registration=True) since the
oracle is exactly what the Rust test is standing up separately.

Args (all via argv): rpc_url, deployments_file, compliance_vertical
"""

import json
import sys

# integrity-sdk is a sibling package; the Rust test invokes this with the SDK's
# own venv python (which has it installed), so a plain import works.
from integrity_sdk import registration


def main() -> None:
    rpc_url = sys.argv[1]
    deployments_file = sys.argv[2]
    vertical = sys.argv[3] if len(sys.argv) > 3 else "none"
    agent_id = sys.argv[4] if len(sys.argv) > 4 else "oracle-e2e-agent"

    result = registration.register_agent(
        agent_id,
        compliance_vertical=vertical,
        rpc_url=rpc_url,
        deployments_file=deployments_file,
        skip_oracle_registration=True,
    )
    print(json.dumps(result.to_dict()))


if __name__ == "__main__":
    main()
