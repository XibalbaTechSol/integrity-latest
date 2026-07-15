// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal stand-in for the real `contracts/` Slasher.sol. TEST
/// FIXTURE ONLY -- proves bcc_middleware's `app/reputation.py` real
/// eth_sendTransaction code path (raiseDispute, plus the stakeOf/
/// lockedStakeOf reads) end-to-end. Permissionless and pre-seedable via
/// `seedStake`, unlike the real Slasher (which requires a real $ITK
/// stake() deposit) -- staking mechanics are out of scope for what this
/// fixture needs to prove; `app/reputation.py` never calls `stake()`
/// itself.
contract MockSlasher {
    mapping(address => uint256) public stakeOf;
    mapping(address => uint256) public lockedStakeOf;
    uint256 public nextDisputeId;

    event DisputeRaised(uint256 indexed disputeId, address indexed agent, uint256 amount, string reason);

    function seedStake(address agent, uint256 amount) external {
        stakeOf[agent] += amount;
    }

    function raiseDispute(address agent, uint256 amount, string calldata reason) external returns (uint256 disputeId) {
        require(stakeOf[agent] - lockedStakeOf[agent] >= amount, "insufficient stake");
        lockedStakeOf[agent] += amount;
        disputeId = nextDisputeId++;
        emit DisputeRaised(disputeId, agent, amount, reason);
    }
}
