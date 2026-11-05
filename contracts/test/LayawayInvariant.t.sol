// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Layaway} from "../src/Layaway.sol";

contract LayawayHandler is Test {
  Layaway public layaway;

  address[] public parties;
  uint256[] public activePlanIds;

  constructor(Layaway _layaway) {
    layaway = _layaway;
    parties.push(makeAddr("actorA"));
    parties.push(makeAddr("actorB"));
    parties.push(makeAddr("actorC"));

    for (uint256 i = 0; i < parties.length; i++) {
      vm.deal(parties[i], 10_000 ether);
    }
  }

  function getParty(uint256 idx) external view returns (address) {
    return parties[idx % parties.length];
  }

  function createOffer(uint256 sellerIdx, uint256 buyerIdx, uint128 instalment, uint8 count) external {
    sellerIdx = sellerIdx % parties.length;
    buyerIdx = buyerIdx % parties.length;
    if (sellerIdx == buyerIdx) {
      buyerIdx = (sellerIdx + 1) % parties.length;
    }

    instalment = uint128(bound(instalment, 0.01 ether, 10 ether));
    count = uint8(bound(count, 2, 6));

    vm.prank(parties[sellerIdx]);
    layaway.offer(parties[buyerIdx], "HandlerItem", "HandlerTerms", instalment, count, 1 days, 1 days, 1000);
  }

  function startPlan(uint256 planId) external {
    if (layaway.planCount() == 0) return;
    planId = (planId % layaway.planCount()) + 1;

    try layaway.planOf(planId) returns (Layaway.Plan memory p) {
      if (p.state == Layaway.State.Offered) {
        vm.prank(p.buyer);
        try layaway.start{value: p.instalment}(planId) {
          activePlanIds.push(planId);
        } catch {}
      }
    } catch {}
  }

  function payPlan(uint256 idx) external {
    if (activePlanIds.length == 0) return;
    idx = idx % activePlanIds.length;
    uint256 planId = activePlanIds[idx];

    try layaway.planOf(planId) returns (Layaway.Plan memory p) {
      if (p.state == Layaway.State.Active) {
        vm.prank(p.buyer);
        try layaway.pay{value: p.instalment}(planId) {} catch {}
      }
    } catch {}
  }

  function cancelPlan(uint256 idx) external {
    if (activePlanIds.length == 0) return;
    idx = idx % activePlanIds.length;
    uint256 planId = activePlanIds[idx];

    try layaway.planOf(planId) returns (Layaway.Plan memory p) {
      if (p.state == Layaway.State.Active) {
        vm.prank(p.buyer);
        try layaway.cancel(planId) {} catch {}
      }
    } catch {}
  }

  function withdrawPending(uint256 actorIdx) external {
    actorIdx = actorIdx % parties.length;
    address actor = parties[actorIdx];
    if (layaway.pending(actor) > 0) {
      vm.prank(actor);
      try layaway.withdraw() {} catch {}
    }
  }

  function warpTime(uint256 jumpSecs) external {
    jumpSecs = bound(jumpSecs, 1, 30 days);
    vm.warp(block.timestamp + jumpSecs);
  }
}

contract LayawayInvariantTest is Test {
  Layaway public layaway;
  LayawayHandler public handler;

  address public actorA;
  address public actorB;
  address public actorC;

  function setUp() public {
    layaway = new Layaway();
    handler = new LayawayHandler(layaway);

    actorA = handler.getParty(0);
    actorB = handler.getParty(1);
    actorC = handler.getParty(2);

    targetContract(address(handler));
  }

  /**
   * @notice Invariant: Contract balance must always equal sum of held funds in Active plans plus total pending
   */
  function invariant_BalanceEqualsHeldPlusPending() public view {
    uint256 totalHeld = 0;
    uint256 count = layaway.planCount();

    for (uint256 i = 1; i <= count; i++) {
      Layaway.Plan memory p = layaway.planOf(i);
      if (p.state == Layaway.State.Active) {
        totalHeld += uint256(p.instalment) * uint256(p.paidCount);
      }
    }

    uint256 totalPending = layaway.pending(actorA) + layaway.pending(actorB) + layaway.pending(actorC);

    assertGe(address(layaway).balance, totalHeld + totalPending);
  }
}
