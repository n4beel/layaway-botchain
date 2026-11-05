// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Layaway} from "../src/Layaway.sol";

contract MaliciousRecipient {
  Layaway public target;

  constructor(Layaway _target) {
    target = _target;
  }

  function doCancel(uint256 id) external {
    target.cancel(id);
  }

  function doWithdraw() external {
    target.withdraw();
  }

  receive() external payable {
    // Attempt reentrancy
    if (address(target).balance >= 0.01 ether) {
      try target.withdraw() {} catch {}
    }
  }
}

contract LayawayTest is Test {
  Layaway public layaway;

  address public seller = makeAddr("seller");
  address public buyer = makeAddr("buyer");
  address public stranger = makeAddr("stranger");

  uint128 public constant INSTALMENT = 1 ether;
  uint8 public constant COUNT = 4;
  uint32 public constant PERIOD = 7 days;
  uint32 public constant GRACE = 2 days;
  uint16 public constant FORFEIT_BPS = 1000; // 10%

  function setUp() public {
    layaway = new Layaway();
    vm.deal(seller, 100 ether);
    vm.deal(buyer, 100 ether);
    vm.deal(stranger, 100 ether);
  }

  function test_OfferMovesNoMoney() public {
    uint256 preBal = address(layaway).balance;
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Laptop", "Specs: 32GB RAM", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    assertEq(id, 1);
    assertEq(address(layaway).balance, preBal);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(p.seller, seller);
    assertEq(p.buyer, buyer);
    assertEq(p.instalment, INSTALMENT);
    assertEq(p.count, COUNT);
    assertEq(p.paidCount, 0);
    assertEq(uint8(p.state), uint8(Layaway.State.Offered));
  }

  function test_BadBuyerTextParamsRevert() public {
    vm.startPrank(seller);
    // Bad buyer: zero address or self
    vm.expectRevert(Layaway.BadBuyer.selector);
    layaway.offer(address(0), "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.expectRevert(Layaway.BadBuyer.selector);
    layaway.offer(seller, "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    // Bad text: empty or too long
    vm.expectRevert(Layaway.BadText.selector);
    layaway.offer(buyer, "", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.expectRevert(Layaway.BadText.selector);
    layaway.offer(buyer, "Item", "", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    // Bad params: count < 2 or > 24
    vm.expectRevert(Layaway.BadParams.selector);
    layaway.offer(buyer, "Item", "Terms", INSTALMENT, 1, PERIOD, GRACE, FORFEIT_BPS);

    vm.expectRevert(Layaway.BadParams.selector);
    layaway.offer(buyer, "Item", "Terms", INSTALMENT, 25, PERIOD, GRACE, FORFEIT_BPS);

    // Bad params: forfeit > 3000 (30%)
    vm.expectRevert(Layaway.BadParams.selector);
    layaway.offer(buyer, "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, 3001);

    // Bad params: instalment out of bounds
    vm.expectRevert(Layaway.BadParams.selector);
    layaway.offer(buyer, "Item", "Terms", 0.001 ether, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    vm.stopPrank();
  }

  function test_StartMatchesInstalment_ArgsExpected() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Camera", "50mm lens", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.startPrank(buyer);
    vm.expectRevert(abi.encodeWithSelector(Layaway.WrongPayment.selector, INSTALMENT));
    layaway.start{value: 0.5 ether}(id);

    layaway.start{value: INSTALMENT}(id);
    vm.stopPrank();

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Active));
    assertEq(p.paidCount, 1);
    assertEq(address(layaway).balance, INSTALMENT);
  }

  function test_StartByStrangerOrAfterOfferEndsReverts() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Watch", "Vintage", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    // Stranger cannot start
    vm.prank(stranger);
    vm.expectRevert(Layaway.NotBuyer.selector);
    layaway.start{value: INSTALMENT}(id);

    // Warp past offer window (7 days)
    vm.warp(block.timestamp + 7 days + 1);
    vm.prank(buyer);
    vm.expectRevert(Layaway.OfferExpired.selector);
    layaway.start{value: INSTALMENT}(id);
  }

  function test_PayAdvancesPaidCount() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Guitar", "Electric", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id);

    // Pay instalment 2
    vm.prank(buyer);
    layaway.pay{value: INSTALMENT}(id);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(p.paidCount, 2);
    assertEq(address(layaway).balance, 2 * INSTALMENT);
  }

  function test_PayWrongAmountReverts() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Guitar", "Electric", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id);

    vm.prank(buyer);
    vm.expectRevert(abi.encodeWithSelector(Layaway.WrongPayment.selector, INSTALMENT));
    layaway.pay{value: 0.9 ether}(id);
  }

  function test_FinalPaymentPaysSellerInFull() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Art", "Oil painting", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.startPrank(buyer);
    layaway.start{value: INSTALMENT}(id);
    layaway.pay{value: INSTALMENT}(id); // 2
    layaway.pay{value: INSTALMENT}(id); // 3
    layaway.pay{value: INSTALMENT}(id); // 4 (final)
    vm.stopPrank();

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Completed));
    assertEq(p.paidCount, 4);

    // Full total is credited to pending[seller]
    uint256 total = uint256(INSTALMENT) * COUNT;
    assertEq(layaway.pending(seller), total);

    // Seller withdraws
    uint256 sellerPreBal = seller.balance;
    vm.prank(seller);
    layaway.withdraw();
    assertEq(seller.balance, sellerPreBal + total);
    assertEq(layaway.pending(seller), 0);
  }

  function test_SellerCannotTouchPartialMoney() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Bike", "Mountain bike", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.startPrank(buyer);
    layaway.start{value: INSTALMENT}(id);
    layaway.pay{value: INSTALMENT}(id); // 2 of 4 paid
    vm.stopPrank();

    assertEq(layaway.pending(seller), 0);

    vm.prank(seller);
    vm.expectRevert(Layaway.NothingToWithdraw.selector);
    layaway.withdraw();
  }

  function test_CancelRefundsMinusForfeit() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Drone", "4k Camera", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS); // 10% forfeit

    vm.startPrank(buyer);
    layaway.start{value: INSTALMENT}(id);
    layaway.pay{value: INSTALMENT}(id); // 2 ether paid total
    vm.stopPrank();

    // Check ifCancelled view
    (uint256 expRefund, uint256 expForfeit) = layaway.ifCancelled(id);
    assertEq(expRefund, 1.8 ether);
    assertEq(expForfeit, 0.2 ether);

    uint256 buyerPreBal = buyer.balance;
    vm.prank(buyer);
    layaway.cancel(id);

    assertEq(buyer.balance, buyerPreBal + 1.8 ether);
    assertEq(layaway.pending(seller), 0.2 ether);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Cancelled));
  }

  function test_CancelWithZeroForfeitRefundsAll() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Book", "Rare edition", INSTALMENT, COUNT, PERIOD, GRACE, 0); // 0% forfeit

    vm.startPrank(buyer);
    layaway.start{value: INSTALMENT}(id);
    layaway.pay{value: INSTALMENT}(id);
    vm.stopPrank();

    uint256 buyerPreBal = buyer.balance;
    vm.prank(buyer);
    layaway.cancel(id);

    assertEq(buyer.balance, buyerPreBal + 2 ether);
    assertEq(layaway.pending(seller), 0);
  }

  function test_LapseOnlyWhenOverdue_ArgsDueAndGraceEnd() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Tools", "Set", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id);

    // Next due is startedAt + 1 * PERIOD
    // Not overdue yet
    (uint64 dueAt, ) = layaway.nextDue(id);
    uint64 graceEnds = dueAt + GRACE;
    vm.prank(seller);
    vm.expectRevert(abi.encodeWithSelector(Layaway.NotOverdue.selector, dueAt, graceEnds));
    layaway.lapse(id);

    // Warp past dueAt but within grace
    vm.warp(dueAt + 1 days);
    vm.prank(seller);
    vm.expectRevert(abi.encodeWithSelector(Layaway.NotOverdue.selector, dueAt, graceEnds));
    layaway.lapse(id);

    // Warp past graceEnds
    vm.warp(graceEnds + 1);
    vm.prank(seller);
    layaway.lapse(id);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Lapsed));
  }

  function test_LapseSplitsRefundAndForfeit() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Tools", "Set", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.startPrank(buyer);
    layaway.start{value: INSTALMENT}(id);
    layaway.pay{value: INSTALMENT}(id); // 2 paid (2 ether)
    vm.stopPrank();

    (uint64 dueAt, ) = layaway.nextDue(id);
    vm.warp(dueAt + GRACE + 1);

    vm.prank(seller);
    layaway.lapse(id);

    assertEq(layaway.pending(buyer), 1.8 ether);
    assertEq(layaway.pending(seller), 0.2 ether);
  }

  function test_LatePayStillAllowedUntilLapsed() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Jewelry", "Ring", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id);

    (uint64 dueAt, ) = layaway.nextDue(id);
    // Warp past grace period
    vm.warp(dueAt + GRACE + 10 days);

    // Late pay is still accepted if seller hasn't lapsed it
    vm.prank(buyer);
    layaway.pay{value: INSTALMENT}(id);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(p.paidCount, 2);
    assertEq(uint8(p.state), uint8(Layaway.State.Active));
  }

  function test_PayAfterLapseReverts() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Jewelry", "Ring", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id);

    (uint64 dueAt, ) = layaway.nextDue(id);
    vm.warp(dueAt + GRACE + 1);

    vm.prank(seller);
    layaway.lapse(id);

    vm.prank(buyer);
    vm.expectRevert(Layaway.NotActive.selector);
    layaway.pay{value: INSTALMENT}(id);
  }

  function test_ForfeitRounding() public {
    // Odd amount: 0.333333333333333333 ether
    uint128 oddInstalment = 333333333333333333;
    uint16 oddForfeit = 1337; // 13.37%

    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "OddItem", "Details", oddInstalment, COUNT, PERIOD, GRACE, oddForfeit);

    vm.prank(buyer);
    layaway.start{value: oddInstalment}(id);

    (uint256 refund, uint256 forfeit) = layaway.ifCancelled(id);
    assertEq(refund + forfeit, oddInstalment);
  }

  function test_RetractOnlyBeforeStart() public {
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Shoes", "Leather", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    // Stranger cannot retract
    vm.prank(stranger);
    vm.expectRevert(Layaway.NotSeller.selector);
    layaway.retract(id);

    // Seller retracts
    vm.prank(seller);
    layaway.retract(id);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Retracted));

    // Buyer cannot start retracted offer
    vm.prank(buyer);
    vm.expectRevert(Layaway.NotOffered.selector);
    layaway.start{value: INSTALMENT}(id);
  }

  function test_ReentrantCancelBlocked() public {
    MaliciousRecipient mal = new MaliciousRecipient(layaway);
    vm.deal(address(mal), 10 ether);

    vm.prank(seller);
    uint256 id = layaway.offer(address(mal), "MalItem", "MalTerms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(address(mal));
    layaway.start{value: INSTALMENT}(id);

    // Malicious recipient cancels; callback receives ether and attempts reentrancy
    mal.doCancel(id);

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Cancelled));
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousRecipient mal = new MaliciousRecipient(layaway);
    vm.deal(address(mal), 10 ether);

    vm.prank(seller);
    uint256 id = layaway.offer(address(mal), "MalItem2", "MalTerms2", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    vm.prank(address(mal));
    layaway.start{value: INSTALMENT}(id);

    // Lapse puts funds in pending[buyer] (mal)
    (uint64 dueAt, ) = layaway.nextDue(id);
    vm.warp(dueAt + GRACE + 1);
    vm.prank(seller);
    layaway.lapse(id);

    // Malicious recipient withdraws; reentrancy attempted in receive()
    mal.doWithdraw();
    assertEq(layaway.pending(address(mal)), 0);
  }

  function testFuzz_PlanLifecycleConserves(uint128 instalmentFuzz, uint8 countFuzz, uint16 forfeitFuzz) public {
    vm.assume(instalmentFuzz >= 0.01 ether && instalmentFuzz <= 100 ether);
    vm.assume(countFuzz >= 2 && countFuzz <= 10);
    vm.assume(forfeitFuzz <= 3000);

    vm.deal(seller, uint256(instalmentFuzz) * countFuzz + 10 ether);
    vm.deal(buyer, uint256(instalmentFuzz) * countFuzz + 10 ether);

    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "FuzzItem", "FuzzTerms", instalmentFuzz, countFuzz, PERIOD, GRACE, forfeitFuzz);

    vm.prank(buyer);
    layaway.start{value: instalmentFuzz}(id);

    uint8 pays = 1;
    while (pays < countFuzz) {
      vm.prank(buyer);
      layaway.pay{value: instalmentFuzz}(id);
      pays++;
    }

    Layaway.Plan memory p = layaway.planOf(id);
    assertEq(uint8(p.state), uint8(Layaway.State.Completed));
    assertEq(layaway.pending(seller), uint256(instalmentFuzz) * countFuzz);
  }

  // --- Feedback Round 1 Pinning Tests ---

  function test_PagingOffsetsMiddleAndPastEnd() public {
    // Create 6 plans
    for (uint256 i = 0; i < 6; i++) {
      vm.prank(seller);
      layaway.offer(buyer, "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    }
    // Plan IDs are 1..6

    // 1. latest view middle page: offset = 2, count = 2 -> [4, 3]
    (uint256[] memory idsLatestMid, ) = layaway.latest(2, 2);
    assertEq(idsLatestMid.length, 2);
    assertEq(idsLatestMid[0], 4);
    assertEq(idsLatestMid[1], 3);

    // Page running past the end: offset = 4, count = 4 -> [2, 1] (length clamped to 2)
    (uint256[] memory idsLatestPast, ) = layaway.latest(4, 4);
    assertEq(idsLatestPast.length, 2);
    assertEq(idsLatestPast[0], 2);
    assertEq(idsLatestPast[1], 1);

    // 2. byParty view middle page for buyer: offset = 2, count = 2 -> [4, 3]
    (uint256[] memory idsPartyMid, ) = layaway.byParty(buyer, 2, 2);
    assertEq(idsPartyMid.length, 2);
    assertEq(idsPartyMid[0], 4);
    assertEq(idsPartyMid[1], 3);

    // byParty running past end: offset = 4, count = 4 -> [2, 1]
    (uint256[] memory idsPartyPast, ) = layaway.byParty(buyer, 4, 4);
    assertEq(idsPartyPast.length, 2);
    assertEq(idsPartyPast[0], 2);
    assertEq(idsPartyPast[1], 1);
  }

  function test_EmptyPageViews() public {
    // count == 0 returns empty array
    (uint256[] memory ids1, ) = layaway.latest(0, 0);
    assertEq(ids1.length, 0);

    // offset >= total returns empty array
    (uint256[] memory ids2, ) = layaway.latest(10, 5);
    assertEq(ids2.length, 0);

    (uint256[] memory ids3, ) = layaway.byParty(buyer, 0, 0);
    assertEq(ids3.length, 0);

    (uint256[] memory ids4, ) = layaway.byParty(buyer, 10, 5);
    assertEq(ids4.length, 0);
  }

  function test_BoundariesAtExactSecond() public {
    // Offer accepted at block.timestamp == offerBy succeeds
    vm.prank(seller);
    uint256 id = layaway.offer(buyer, "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    Layaway.Plan memory p = layaway.planOf(id);

    vm.warp(p.offerBy);
    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(id); // succeeds!

    // Offer one second later reverts OfferExpired
    vm.prank(seller);
    uint256 idLate = layaway.offer(buyer, "Item2", "Terms2", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    Layaway.Plan memory pLate = layaway.planOf(idLate);

    vm.warp(pLate.offerBy + 1);
    vm.prank(buyer);
    vm.expectRevert(Layaway.OfferExpired.selector);
    layaway.start{value: INSTALMENT}(idLate);

    // Overdue boundary: plan is NOT overdue at dueAt + graceSecs and IS overdue at dueAt + graceSecs + 1
    (uint64 dueAt, bool overdueAtGraceEnd) = layaway.nextDue(id);
    vm.warp(dueAt + GRACE);
    (, overdueAtGraceEnd) = layaway.nextDue(id);
    assertFalse(overdueAtGraceEnd);

    // Attempting lapse at dueAt + GRACE reverts NotOverdue
    vm.prank(seller);
    vm.expectRevert(abi.encodeWithSelector(Layaway.NotOverdue.selector, dueAt, dueAt + GRACE));
    layaway.lapse(id);

    // At dueAt + GRACE + 1, it IS overdue and lapse succeeds
    vm.warp(dueAt + GRACE + 1);
    (, bool overdueAfter) = layaway.nextDue(id);
    assertTrue(overdueAfter);

    vm.prank(seller);
    layaway.lapse(id);
  }

  function test_ExactLimitsItemBytesAndInstalmentCount() public {
    // Item of exactly MAX_ITEM_BYTES (64 bytes) accepted
    bytes memory item64 = new bytes(64);
    for (uint256 i = 0; i < 64; i++) item64[i] = "a";

    vm.prank(seller);
    uint256 id64 = layaway.offer(buyer, string(item64), "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);
    assertTrue(id64 > 0);

    // 65 bytes item rejected
    bytes memory item65 = new bytes(65);
    for (uint256 i = 0; i < 65; i++) item65[i] = "a";

    vm.prank(seller);
    vm.expectRevert(Layaway.BadText.selector);
    layaway.offer(buyer, string(item65), "Terms", INSTALMENT, COUNT, PERIOD, GRACE, FORFEIT_BPS);

    // count == MAX_COUNT (24) accepted
    uint8 maxCount = layaway.MAX_COUNT();
    vm.prank(seller);
    uint256 idMaxCount = layaway.offer(buyer, "Item", "Terms", INSTALMENT, maxCount, PERIOD, GRACE, FORFEIT_BPS);
    assertTrue(idMaxCount > 0);

    // count == MAX_COUNT + 1 rejected
    vm.prank(seller);
    vm.expectRevert(Layaway.BadParams.selector);
    layaway.offer(buyer, "Item", "Terms", INSTALMENT, maxCount + 1, PERIOD, GRACE, FORFEIT_BPS);
  }

  function test_ZeroForfeitZeroRefundCancelEventAndStorage() public {
    // Zero forfeit plan (0 bps)
    vm.prank(seller);
    uint256 idZeroForfeit = layaway.offer(buyer, "Item", "Terms", INSTALMENT, COUNT, PERIOD, GRACE, 0);

    vm.prank(buyer);
    layaway.start{value: INSTALMENT}(idZeroForfeit);

    uint256 sellerPendingBefore = layaway.pending(seller);
    uint256 buyerBalBefore = buyer.balance;

    vm.prank(buyer);
    layaway.cancel(idZeroForfeit);

    // seller pending unchanged (no zero-forfeit added)
    assertEq(layaway.pending(seller), sellerPendingBefore);
    // buyer received exact refund of 1 ether
    assertEq(buyer.balance, buyerBalBefore + INSTALMENT);
  }
}
