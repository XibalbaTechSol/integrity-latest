// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {CCIPReputationBridge} from "../src/oracle/CCIPReputationBridge.sol";
import {ReputationRegistry} from "../src/oracle/ReputationRegistry.sol";
import {XibalbaAgentRegistry} from "../src/framework/XibalbaAgentRegistry.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @notice Real CCIP infrastructure (an actual Router, RMN, DONs) can't run in this
/// environment, so the router is mocked via `vm.mockCall` exactly as the task
/// instructed — but ReputationRegistry, XibalbaAgentRegistry resolution, role-gating,
/// trusted-bridge allowlisting, and the send/receive payload encoding are all real and
/// exercised end-to-end.
///
/// REWORKED 2026-07-11 alongside CCIPReputationBridge.sol's own per-agent-clone fix:
/// the bridge no longer holds one immutable ReputationRegistry, it resolves each
/// agent's clone via XibalbaAgentRegistry.resolveAgent -- so this fixture now registers
/// `agent` as a real (test-double) primitive set in a real XibalbaAgentRegistry, with
/// `sovereignAgent: agent` and `reputationRegistry: address(registry)`, and grants
/// BRIDGE_ROLE on that specific clone (not a global one) exactly like the real
/// per-agent opt-in flow this NatSpec describes.
contract CCIPReputationBridgeTest is Test {
    XibalbaAgentRegistry agentRegistry;
    ReputationRegistry registry;
    CCIPReputationBridge bridge;

    address admin = makeAddr("admin");
    address registrar = makeAddr("registrar");
    address controller = makeAddr("controller");
    address mockRouter = address(0xCAFE);
    address agent = makeAddr("agent");
    address remotePeerBridge = makeAddr("remotePeerBridge");
    uint64 constant REMOTE_SELECTOR = 16015286601757825753; // arbitrary CCIP-style selector

    function setUp() public {
        agentRegistry = new XibalbaAgentRegistry(admin);
        bytes32 registrarRole = agentRegistry.REGISTRAR_ROLE();
        vm.prank(admin);
        agentRegistry.grantRole(registrarRole, registrar);

        ReputationRegistry impl = new ReputationRegistry();
        registry = ReputationRegistry(Clones.clone(address(impl)));
        registry.initialize(agent, agent, address(0x1), address(0x2));

        // `agent` stands in for a real SovereignAgent contract's address here (this
        // fixture doesn't deploy a real one, same simplification
        // XibalbaAgentRegistryTest's own fixture uses) -- registered with only the one
        // primitive this test actually needs populated.
        XibalbaAgentRegistry.PrimitiveSet memory primitives = XibalbaAgentRegistry.PrimitiveSet({
            sovereignAgent: agent,
            stateAnchor: makeAddr("stateAnchor"),
            reputationRegistry: address(registry),
            slasher: makeAddr("slasher"),
            verifierRegistry: makeAddr("verifierRegistry"),
            complianceGate: makeAddr("complianceGate"),
            agentProfile: makeAddr("agentProfile")
        });
        bytes32 did = agentRegistry.didHash("did:integrity:ccip-test-agent");
        vm.prank(registrar);
        agentRegistry.registerPrimitives(did, primitives, controller, keccak256("general.integrity"));

        bridge = new CCIPReputationBridge(mockRouter, address(agentRegistry), admin);

        bytes32 bridgeRole = registry.BRIDGE_ROLE();
        vm.prank(agent); // agent's own SovereignAgent (here, `agent` itself) holds DEFAULT_ADMIN_ROLE on its clone
        registry.grantRole(bridgeRole, address(bridge));
    }

    function test_bridgeReputation_sendsViaRouter() public {
        vm.prank(agent); // oracleSigner on this clone is `agent` (see setUp's initialize call)
        registry.updateScore(agent, 800);

        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        vm.mockCall(
            mockRouter,
            abi.encodeWithSelector(IRouterClient.getFee.selector),
            abi.encode(uint256(0.01 ether))
        );
        vm.mockCall(
            mockRouter,
            abi.encodeWithSelector(IRouterClient.ccipSend.selector),
            abi.encode(bytes32("msg-1"))
        );

        vm.deal(address(this), 1 ether);
        bytes32 messageId = bridge.bridgeReputation{value: 0.01 ether}(REMOTE_SELECTOR, agent, address(0));
        assertEq(messageId, bytes32("msg-1"));
    }

    function test_bridgeReputation_revertsWithoutTrustedDestination() public {
        vm.expectRevert(CCIPReputationBridge.DestinationBridgeNotConfigured.selector);
        bridge.bridgeReputation(REMOTE_SELECTOR, agent, address(0));
    }

    function test_ccipReceive_updatesRegistryFromTrustedSender() public {
        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32("inbound-1"),
            sourceChainSelector: REMOTE_SELECTOR,
            sender: abi.encode(remotePeerBridge),
            data: abi.encode(agent, uint256(925)),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(mockRouter); // only the configured router may call ccipReceive
        bridge.ccipReceive(message);

        (uint256 base,,,) = registry.getAgent(agent);
        assertEq(base, 925);
    }

    function test_ccipReceive_rejectsUntrustedSender() public {
        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        address impersonator = makeAddr("impersonator");
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32("inbound-2"),
            sourceChainSelector: REMOTE_SELECTOR,
            sender: abi.encode(impersonator),
            data: abi.encode(agent, uint256(1)),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(mockRouter);
        vm.expectRevert(CCIPReputationBridge.UntrustedSender.selector);
        bridge.ccipReceive(message);
    }

    function test_ccipReceive_rejectsNonRouterCaller() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32("inbound-3"),
            sourceChainSelector: REMOTE_SELECTOR,
            sender: abi.encode(remotePeerBridge),
            data: abi.encode(agent, uint256(1)),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.expectRevert(); // CCIPReceiver.InvalidRouter
        bridge.ccipReceive(message);
    }

    function test_onlyAdminCanSetTrustedBridge() public {
        vm.expectRevert();
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);
    }

    // --- per-agent clone resolution (2026-07-11 rework) ---------------------------------------------

    function test_bridgeReputation_revertsForUnregisteredAgent() public {
        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        address strangerAgent = makeAddr("strangerAgent"); // never registered in agentRegistry
        vm.expectRevert(XibalbaAgentRegistry.UnknownAgent.selector);
        bridge.bridgeReputation(REMOTE_SELECTOR, strangerAgent, address(0));
    }

    function test_ccipReceive_revertsForUnregisteredAgent() public {
        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        address strangerAgent = makeAddr("strangerAgent");
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32("inbound-unregistered"),
            sourceChainSelector: REMOTE_SELECTOR,
            sender: abi.encode(remotePeerBridge),
            data: abi.encode(strangerAgent, uint256(1)),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(mockRouter);
        vm.expectRevert(XibalbaAgentRegistry.UnknownAgent.selector);
        bridge.ccipReceive(message);
    }

    function test_ccipReceive_revertsWithoutBridgeRoleOnAgentsOwnClone() public {
        // A second agent, registered in agentRegistry, but who never granted this
        // bridge BRIDGE_ROLE on their own ReputationRegistry clone -- proves bridging
        // is genuinely per-agent opt-in, not implied by registration alone.
        address secondAgent = makeAddr("secondAgent");
        ReputationRegistry secondImpl = new ReputationRegistry();
        ReputationRegistry secondRegistry = ReputationRegistry(Clones.clone(address(secondImpl)));
        secondRegistry.initialize(secondAgent, secondAgent, address(0x1), address(0x2));
        // Deliberately no grantRole(BRIDGE_ROLE, address(bridge)) call here.

        XibalbaAgentRegistry.PrimitiveSet memory primitives = XibalbaAgentRegistry.PrimitiveSet({
            sovereignAgent: secondAgent,
            stateAnchor: makeAddr("stateAnchor2"),
            reputationRegistry: address(secondRegistry),
            slasher: makeAddr("slasher2"),
            verifierRegistry: makeAddr("verifierRegistry2"),
            complianceGate: makeAddr("complianceGate2"),
            agentProfile: makeAddr("agentProfile2")
        });
        bytes32 did2 = agentRegistry.didHash("did:integrity:ccip-test-agent-2");
        vm.prank(registrar);
        agentRegistry.registerPrimitives(did2, primitives, controller, keccak256("general.integrity"));

        vm.prank(admin);
        bridge.setTrustedBridge(REMOTE_SELECTOR, remotePeerBridge);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32("inbound-no-role"),
            sourceChainSelector: REMOTE_SELECTOR,
            sender: abi.encode(remotePeerBridge),
            data: abi.encode(secondAgent, uint256(500)),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(mockRouter);
        vm.expectRevert(); // AccessControlUnauthorizedAccount on secondRegistry
        bridge.ccipReceive(message);
    }
}
