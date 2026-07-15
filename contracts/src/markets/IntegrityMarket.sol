// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";
import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";

/// @title IntegrityMarket
/// @notice Generic AIS-gated, ITK-staked outcome market. Backs both prediction markets
/// (N outcomes, e.g. "who wins the election") and binary options (the 2-outcome case,
/// e.g. "will BTC > $100k by Friday") as the exact same on-chain primitive -- one real,
/// tested contract instead of two half-built ones for what is mechanically identical
/// pari-mutuel settlement.
/// @dev EIP-1167 clone template, deployed per-market by `MarketFactory` -- NOT a
/// directly-deployed singleton. This is deliberate: the protocol's core thesis is that
/// agents own and deploy their own smart contracts, not just for identity (the 7
/// primitives) but at the *application* layer too. Any registered agent can call
/// `MarketFactory.deployMarket(...)` to deploy and own its own customized market
/// instance -- its own question, outcome structure, AIS-entry bar, deadline, and choice
/// of resolver. One clone == one market, so "an agent creates a new market" is just
/// another cheap clone, exactly like ReputationRegistry/Slasher/etc are cloned per agent.
///
/// Every position is gated on the caller's LIVE effective AIS (read from its own
/// ReputationRegistry clone via XibalbaAgentRegistry, mirroring EHRGate's resolution
/// pattern) so only agents with an actual track record can enter high-stakes markets.
///
/// *** TRUST BOUNDARY, DOCUMENTED NOT HIDDEN ***
/// `resolve()` is gated to RESOLVER_ROLE, set at `initialize()` time by the market's
/// creator (who may name itself, the protocol's demo signer, or any other address as
/// resolver). For the investor/developer MVP this is a clearly-labeled demo resolver --
/// there is no live Chainlink/UMA price feed wired in. Staking, AIS-gating, BCC-
/// commitment binding, and payout are all real; only ground-truth outcome resolution is
/// a documented, swappable trust boundary. A production deployment would point
/// RESOLVER_ROLE at a real oracle network; the contract's interface does not change.
///
/// Fraud/misreporting (an agent's BCC-committed intent not matching its actual position)
/// is NOT handled inside this contract -- it is surfaced by integrity-oracle comparing
/// telemetry/BCC commitments against on-chain positions, which then raises a dispute on
/// the offending agent's own Slasher clone (the existing, already-tested mechanism).
/// Keeping that logic out of IntegrityMarket keeps this contract a small, auditable
/// escrow rather than a second slashing engine.
contract IntegrityMarket is Initializable, AccessControlUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    /// @dev Shared across every clone via the implementation contract's own immutable
    /// storage (same rationale as ComplianceGate's coveredEntityRegistry/baaFactory):
    /// every market clone delegatecalls into the same bytecode and so reads the same
    /// $ITK and agent-registry addresses for free, without a per-clone storage write.
    IERC20 public immutable itk;
    XibalbaAgentRegistry public immutable agentRegistry;

    address public creator;
    string public question;
    uint8 public outcomeCount;
    uint256 public minAisToEnter;
    uint256 public resolveDeadline;
    bool public resolved;
    uint8 public winningOutcome;
    uint256 public totalStaked;

    struct Position {
        uint256 amount;
        uint8 outcomeIndex;
        bytes32 bccCommitmentHash;
        bool claimed;
    }

    mapping(uint8 => uint256) public outcomeStaked;
    mapping(address => Position) public positions;

    event MarketInitialized(
        address indexed creator, string question, uint8 outcomeCount, uint256 minAisToEnter, uint256 resolveDeadline, address indexed resolver
    );
    event PositionEntered(address indexed agent, uint8 outcomeIndex, uint256 amount, bytes32 bccCommitmentHash);
    event MarketResolved(uint8 winningOutcome, address indexed resolver);
    event PayoutClaimed(address indexed agent, uint256 amount);

    error InvalidOutcomeCount();
    error MarketAlreadyResolved();
    error MarketNotYetResolvable();
    error InvalidOutcomeIndex();
    error ZeroAmount();
    error AgentNotRegistered();
    error AisTooLow(uint256 required, uint256 actual);
    error AlreadyHasPosition();
    error MarketNotResolved();
    error NoPosition();
    error AlreadyClaimed();
    error LosingPosition();

    /// @dev Implementation contract is never itself initializable -- only clones
    /// (Clones.clone(marketImpl), via MarketFactory) are. Same OZ upgradeable-safety
    /// pattern used by ReputationRegistry/Slasher/VerifierRegistry/ComplianceGate.
    constructor(address _itk, address _agentRegistry) {
        itk = IERC20(_itk);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _disableInitializers();
    }

    /// @param _creator The deploying agent's SovereignAgent address (MarketFactory
    /// passes msg.sender through) -- gets DEFAULT_ADMIN_ROLE, per the protocol's
    /// call-routing convention, so only that agent (acting through its own `execute`)
    /// can ever administer settings on a market it doesn't otherwise expose setters for.
    /// @param resolver Gets RESOLVER_ROLE. May be the creator itself (self-resolved
    /// demo market), the protocol's demo signer, or any other address the creator
    /// names -- see contract-level NatSpec on the resolver trust boundary.
    function initialize(
        address _creator,
        string calldata _question,
        uint8 _outcomeCount,
        uint256 _minAisToEnter,
        uint256 _resolveDeadline,
        address resolver
    ) external initializer {
        if (_outcomeCount < 2) revert InvalidOutcomeCount();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        if (resolver != address(0)) {
            _grantRole(RESOLVER_ROLE, resolver);
        }
        creator = _creator;
        question = _question;
        outcomeCount = _outcomeCount;
        minAisToEnter = _minAisToEnter;
        resolveDeadline = _resolveDeadline;
        emit MarketInitialized(_creator, _question, _outcomeCount, _minAisToEnter, _resolveDeadline, resolver);
    }

    /// @notice Enters a staked position on one outcome. `msg.sender` is expected to be
    /// the agent's own SovereignAgent contract (per the protocol's call-routing
    /// convention), which is what `agentRegistry.resolveAgent` resolves against -- same
    /// pattern as EHRGate.checkAccess. `bccCommitmentHash` binds this position to the
    /// off-chain BCC commitment (see docs/INTERFACE_CONTRACT.md §4.2) the agent signed
    /// BEFORE entering, so the position is provably the agent's own pre-committed call,
    /// not a reaction to information it obtained after the fact.
    function enterPosition(uint8 outcomeIndex, uint256 amount, bytes32 bccCommitmentHash) external nonReentrant {
        if (resolved) revert MarketAlreadyResolved();
        if (block.timestamp >= resolveDeadline) revert MarketNotYetResolvable();
        if (outcomeIndex >= outcomeCount) revert InvalidOutcomeIndex();
        if (amount == 0) revert ZeroAmount();
        if (positions[msg.sender].amount != 0) revert AlreadyHasPosition();

        if (!agentRegistry.isRegisteredAgent(msg.sender)) revert AgentNotRegistered();
        address reputationRegistry = agentRegistry.resolveAgent(msg.sender).primitives.reputationRegistry;
        uint256 liveAis = ReputationRegistry(reputationRegistry).effectiveScore(msg.sender);
        if (liveAis < minAisToEnter) revert AisTooLow(minAisToEnter, liveAis);

        itk.safeTransferFrom(msg.sender, address(this), amount);

        positions[msg.sender] =
            Position({amount: amount, outcomeIndex: outcomeIndex, bccCommitmentHash: bccCommitmentHash, claimed: false});
        outcomeStaked[outcomeIndex] += amount;
        totalStaked += amount;

        emit PositionEntered(msg.sender, outcomeIndex, amount, bccCommitmentHash);
    }

    /// @notice Resolves the market to a winning outcome. See contract-level NatSpec for
    /// the RESOLVER_ROLE trust boundary.
    function resolve(uint8 _winningOutcome) external onlyRole(RESOLVER_ROLE) {
        if (resolved) revert MarketAlreadyResolved();
        if (_winningOutcome >= outcomeCount) revert InvalidOutcomeIndex();

        resolved = true;
        winningOutcome = _winningOutcome;
        emit MarketResolved(_winningOutcome, msg.sender);
    }

    /// @notice Pari-mutuel payout: a winner receives its share of the ENTIRE staked
    /// pool (all outcomes combined) proportional to its share of the winning outcome's
    /// pool. Losers receive nothing (their stake funds the winners' payout).
    ///
    /// @dev Handles the "push" case -- `resolve()` reporting the true outcome, but zero
    /// positions were actually staked on it (entirely possible in any N-outcome market;
    /// an honest resolver must still be able to report the real answer even when nobody
    /// guessed it). Without this, every position holder would permanently hit
    /// `LosingPosition` (none of them hold the winning outcome by definition) and
    /// `totalStaked` would sit in this contract unclaimable by anyone, forever. When
    /// `winningPool == 0`, every position holder is refunded exactly their own original
    /// stake instead of a pari-mutuel share -- this drains the pool completely (the sum
    /// of every position's `amount` equals `totalStaked` by construction in
    /// `enterPosition`) with no shortfall or leftover.
    function claimPayout() external nonReentrant {
        if (!resolved) revert MarketNotResolved();
        Position storage p = positions[msg.sender];
        if (p.amount == 0) revert NoPosition();
        if (p.claimed) revert AlreadyClaimed();

        uint256 winningPool = outcomeStaked[winningOutcome];
        uint256 payout;
        if (winningPool == 0) {
            payout = p.amount;
        } else {
            if (p.outcomeIndex != winningOutcome) revert LosingPosition();
            payout = (p.amount * totalStaked) / winningPool;
        }

        p.claimed = true;
        itk.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(msg.sender, payout);
    }

    /// @notice Convenience read for integrity-oracle: was this agent's position on the
    /// winning side. Does not move funds or affect reputation itself -- the oracle
    /// reads this (and telemetry/BCC commitments) to decide what to report to
    /// ReputationRegistry.updateScore, and whether to raise a Slasher dispute.
    function wasCorrect(address agent) external view returns (bool) {
        if (!resolved) return false;
        Position storage p = positions[agent];
        return p.amount > 0 && p.outcomeIndex == winningOutcome;
    }

    function getPosition(address agent) external view returns (Position memory) {
        return positions[agent];
    }
}
