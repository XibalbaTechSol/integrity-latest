// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";
import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";

/// @title A2ACapitalPool
/// @notice Real, on-chain agent-to-agent capital allocation: an allocator (a human
/// investor, or another agent's SovereignAgent) escrows $ITK earmarked for a specific
/// agent, gated on that agent's LIVE effective AIS staying at or above a threshold. This
/// is the honest, on-chain replacement for the old dashboard's ActuarialHub A2A escrow,
/// which only ever wrote to localStorage and simulated its "hire" flow with a
/// `setTimeout` (see integrity-dashboard's old ActuarialHub.tsx). The "delegate your
/// money to a trustworthy agent" proof: capital only reaches an agent while it is
/// verifiably trustworthy, and can be reclaimed the moment it stops being so.
/// @dev A single global singleton, deliberately NOT a per-agent/per-creator clone like
/// `IntegrityMarket` -- a capital pool is inherently a shared many-allocator-to-many-
/// agent venue (any allocator routes to any registered agent), not an application one
/// party authors and owns. `agent` here means the agent's own SovereignAgent contract
/// address, resolved through XibalbaAgentRegistry exactly like EHRGate/IntegrityMarket.
///
/// *** DOCUMENTED LIMITATION, NOT A SILENT MOCK ***
/// `clawback()` can only reclaim funds that are still escrowed IN THIS CONTRACT (i.e.
/// before `release()`). Once capital is released to an agent's own SovereignAgent
/// address, this pool has no further custody of it -- a post-release breach is not
/// something an ITK escrow contract can reverse. The punitive lever for a post-release
/// breach is the agent's OWN Slasher clone (already-built, real staking/dispute
/// mechanism): integrity-oracle is expected to raise a dispute there when it detects
/// misconduct. `flagBreach` below exists purely so the dashboard/leaderboard can display
/// an honest allocation-history record of that breach; it moves no funds.
contract A2ACapitalPool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant BREACH_REPORTER_ROLE = keccak256("BREACH_REPORTER_ROLE");

    IERC20 public immutable itk;
    XibalbaAgentRegistry public immutable agentRegistry;

    enum Status {
        Escrowed,
        Released,
        ClawedBack,
        Breached
    }

    struct Allocation {
        address allocator;
        address agent;
        uint256 amount;
        uint256 minAisToMaintain;
        Status status;
        uint256 createdAt;
    }

    uint256 public nextAllocationId;
    mapping(uint256 => Allocation) public allocations;

    event Allocated(
        uint256 indexed allocationId, address indexed allocator, address indexed agent, uint256 amount, uint256 minAisToMaintain
    );
    event Released(uint256 indexed allocationId, address indexed agent, uint256 amount);
    event ClawedBack(uint256 indexed allocationId, address indexed allocator, uint256 amount);
    event BreachFlagged(uint256 indexed allocationId, string reason);

    error ZeroAmount();
    error AgentNotRegistered();
    error AisTooLow(uint256 required, uint256 actual);
    error AllocationNotFound();
    error NotAllocator();
    error NotEscrowed();

    constructor(address _itk, address _agentRegistry, address admin) {
        itk = IERC20(_itk);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BREACH_REPORTER_ROLE, admin);
    }

    /// @notice Escrows `amount` ITK from `msg.sender` (the allocator), earmarked for
    /// `agent`, gated on `agent`'s live AIS being >= `minAisToMaintain` AT ALLOCATION
    /// TIME. The same threshold is re-checked at `release()` time so an agent that
    /// decayed between allocation and release cannot still receive the funds.
    function allocate(address agent, uint256 amount, uint256 minAisToMaintain)
        external
        nonReentrant
        returns (uint256 allocationId)
    {
        if (amount == 0) revert ZeroAmount();
        _requireLiveAis(agent, minAisToMaintain);

        itk.safeTransferFrom(msg.sender, address(this), amount);

        allocationId = nextAllocationId++;
        allocations[allocationId] = Allocation({
            allocator: msg.sender,
            agent: agent,
            amount: amount,
            minAisToMaintain: minAisToMaintain,
            status: Status.Escrowed,
            createdAt: block.timestamp
        });

        emit Allocated(allocationId, msg.sender, agent, amount, minAisToMaintain);
    }

    /// @notice Releases escrowed capital to the agent -- only while the agent's live AIS
    /// still clears the threshold set at allocation time. Callable by the allocator
    /// (self-service: "I'm satisfied, deploy my capital to this agent now").
    function release(uint256 allocationId) external nonReentrant {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        if (msg.sender != a.allocator) revert NotAllocator();
        if (a.status != Status.Escrowed) revert NotEscrowed();

        _requireLiveAis(a.agent, a.minAisToMaintain);

        a.status = Status.Released;
        itk.safeTransfer(a.agent, a.amount);
        emit Released(allocationId, a.agent, a.amount);
    }

    /// @notice Reclaims still-escrowed capital back to the allocator. Callable any time
    /// before release -- e.g. the allocator changes their mind, or the agent's AIS has
    /// dropped below the threshold since allocation.
    function clawback(uint256 allocationId) external nonReentrant {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        if (msg.sender != a.allocator) revert NotAllocator();
        if (a.status != Status.Escrowed) revert NotEscrowed();

        a.status = Status.ClawedBack;
        itk.safeTransfer(a.allocator, a.amount);
        emit ClawedBack(allocationId, a.allocator, a.amount);
    }

    /// @notice Records that a RELEASED allocation's agent breached trust after the fact
    /// (e.g. integrity-oracle detected misconduct and raised a Slasher dispute on the
    /// agent's own stake). Moves no funds -- see contract-level NatSpec. Restricted to
    /// BREACH_REPORTER_ROLE (the oracle signer) so this history can't be spammed/faked
    /// by an arbitrary caller.
    function flagBreach(uint256 allocationId, string calldata reason) external onlyRole(BREACH_REPORTER_ROLE) {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        a.status = Status.Breached;
        emit BreachFlagged(allocationId, reason);
    }

    function _requireLiveAis(address agent, uint256 minAis) internal view {
        if (!agentRegistry.isRegisteredAgent(agent)) revert AgentNotRegistered();
        address reputationRegistry = agentRegistry.resolveAgent(agent).primitives.reputationRegistry;
        uint256 liveAis = ReputationRegistry(reputationRegistry).effectiveScore(agent);
        if (liveAis < minAis) revert AisTooLow(minAis, liveAis);
    }

    function getAllocation(uint256 allocationId) external view returns (Allocation memory) {
        return allocations[allocationId];
    }
}
