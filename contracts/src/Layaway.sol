// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Layaway
 * @notice Pay in instalments. The seller is paid when you finish.
 * @dev Spec: docs/specs/70-layaway.md
 */
contract Layaway {
  enum State {
    Offered,
    Active,
    Completed,
    Cancelled,
    Lapsed,
    Retracted
  }

  struct Plan {
    address seller;
    address buyer;
    uint128 instalment;
    uint8 count;
    uint8 paidCount;
    uint16 forfeitBps;
    uint32 periodSecs;
    uint32 graceSecs;
    State state;
    uint64 startedAt;
    uint64 offerBy;
    uint32 termsBlock;
    string item;
  }

  uint256 public constant MAX_ITEM_BYTES = 64;
  uint256 public constant MAX_TERMS_BYTES = 300;
  uint128 public constant MIN_INSTALMENT = 0.01 ether;
  uint128 public constant MAX_INSTALMENT = 10_000 ether;
  uint8 public constant MIN_COUNT = 2;
  uint8 public constant MAX_COUNT = 24;
  uint32 public constant MIN_PERIOD = 1 days;
  uint32 public constant MAX_PERIOD = 90 days;
  uint32 public constant MIN_GRACE = 1 days;
  uint32 public constant MAX_GRACE = 14 days;
  uint16 public constant MAX_FORFEIT_BPS = 3000; // 30% max
  uint64 public constant OFFER_WINDOW = 7 days;
  uint256 public constant MAX_PAGE = 50;

  mapping(uint256 => Plan) private _plans;
  mapping(address => uint256[]) private _byParty;
  mapping(address => uint256) public pending;
  uint256 public planCount; // ids start at 1

  uint256 private _lock;

  // Custom errors as per Spec §2.1, §2.2, §4
  error BadBuyer();
  error BadText();
  error BadParams();
  error NoSuchPlan();
  error NotBuyer();
  error NotSeller();
  error NotOffered();
  error NotActive();
  error OfferExpired();
  error WrongPayment(uint256 expected);
  error AlreadyPaid();
  error NotOverdue(uint64 dueAt, uint64 graceEnds);
  error NothingToWithdraw();
  error TransferFailed();
  error ReentrancyGuard();

  event Offered(
    uint256 indexed id,
    address indexed seller,
    address indexed buyer,
    string item,
    string terms,
    uint128 instalment,
    uint8 count,
    uint32 periodSecs,
    uint32 graceSecs,
    uint16 forfeitBps,
    uint64 offerBy
  );
  event Retracted(uint256 indexed id);
  event Started(uint256 indexed id, uint64 startedAt);
  event Paid(uint256 indexed id, uint8 number, uint8 remaining);
  event Completed(uint256 indexed id, uint256 total);
  event Cancelled(uint256 indexed id, uint256 refunded, uint256 forfeited);
  event Lapsed(uint256 indexed id, uint256 refunded, uint256 forfeited);
  event Withdrawn(address indexed to, uint256 amount);

  modifier nonReentrant() {
    if (_lock == 1) revert ReentrancyGuard();
    _lock = 1;
    _;
    _lock = 0;
  }

  /**
   * @notice Seller offers a layaway plan to a named buyer. No money moves at offer time.
   */
  function offer(
    address buyer,
    string calldata item,
    string calldata terms,
    uint128 instalment,
    uint8 count,
    uint32 periodSecs,
    uint32 graceSecs,
    uint16 forfeitBps
  ) external returns (uint256 id) {
    if (buyer == address(0) || buyer == msg.sender) revert BadBuyer();
    if (bytes(item).length == 0 || bytes(item).length > MAX_ITEM_BYTES) revert BadText();
    if (bytes(terms).length == 0 || bytes(terms).length > MAX_TERMS_BYTES) revert BadText();

    if (instalment < MIN_INSTALMENT || instalment > MAX_INSTALMENT) revert BadParams();
    if (count < MIN_COUNT || count > MAX_COUNT) revert BadParams();
    if (periodSecs < MIN_PERIOD || periodSecs > MAX_PERIOD) revert BadParams();
    if (graceSecs < MIN_GRACE || graceSecs > MAX_GRACE) revert BadParams();
    if (forfeitBps > MAX_FORFEIT_BPS) revert BadParams();

    id = ++planCount;
    Plan storage p = _plans[id];
    p.seller = msg.sender;
    p.buyer = buyer;
    p.instalment = instalment;
    p.count = count;
    p.paidCount = 0;
    p.forfeitBps = forfeitBps;
    p.periodSecs = periodSecs;
    p.graceSecs = graceSecs;
    p.state = State.Offered;
    p.startedAt = 0;
    p.offerBy = uint64(block.timestamp) + OFFER_WINDOW;
    p.termsBlock = uint32(block.number);
    p.item = item;

    _byParty[msg.sender].push(id);
    _byParty[buyer].push(id);

    emit Offered(
      id,
      msg.sender,
      buyer,
      item,
      terms,
      instalment,
      count,
      periodSecs,
      graceSecs,
      forfeitBps,
      p.offerBy
    );
  }

  /**
   * @notice Seller can retract their offer before it is started.
   */
  function retract(uint256 id) external {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    if (msg.sender != p.seller) revert NotSeller();
    if (p.state != State.Offered) revert NotOffered();

    p.state = State.Retracted;
    emit Retracted(id);
  }

  /**
   * @notice Buyer starts the plan by paying the first instalment.
   */
  function start(uint256 id) external payable nonReentrant {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    if (msg.sender != p.buyer) revert NotBuyer();
    if (p.state != State.Offered) revert NotOffered();
    if (block.timestamp > p.offerBy) revert OfferExpired();
    if (msg.value != p.instalment) revert WrongPayment(p.instalment);

    p.startedAt = uint64(block.timestamp);
    p.paidCount = 1;
    p.state = State.Active;

    emit Started(id, p.startedAt);
    emit Paid(id, 1, p.count - 1);
  }

  /**
   * @notice Buyer pays the next instalment.
   * If this was the last instalment, the plan completes and full amount is credited to seller.
   */
  function pay(uint256 id) external payable nonReentrant {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    if (msg.sender != p.buyer) revert NotBuyer();
    if (p.state != State.Active) revert NotActive();
    if (p.paidCount >= p.count) revert AlreadyPaid();
    if (msg.value != p.instalment) revert WrongPayment(p.instalment);

    p.paidCount += 1;
    uint8 remaining = p.count - p.paidCount;
    emit Paid(id, p.paidCount, remaining);

    if (p.paidCount == p.count) {
      p.state = State.Completed;
      uint256 total = uint256(p.instalment) * uint256(p.count);
      pending[p.seller] += total;
      emit Completed(id, total);
    }
  }

  /**
   * @notice Buyer cancels an active plan.
   * Buyer receives refund minus forfeit percentage; forfeit is credited to seller.
   */
  function cancel(uint256 id) external nonReentrant {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    if (msg.sender != p.buyer) revert NotBuyer();
    if (p.state != State.Active) revert NotActive();

    (uint256 refund, uint256 forfeit) = _calcCancel(p);

    p.state = State.Cancelled;
    if (forfeit > 0) {
      pending[p.seller] += forfeit;
    }

    emit Cancelled(id, refund, forfeit);

    if (refund > 0) {
      (bool ok, ) = msg.sender.call{value: refund}("");
      if (!ok) revert TransferFailed();
    }
  }

  /**
   * @notice Seller lapses an overdue plan past grace period.
   * Buyer is credited refund in pending; forfeit is credited to seller in pending.
   */
  function lapse(uint256 id) external nonReentrant {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    if (msg.sender != p.seller) revert NotSeller();
    if (p.state != State.Active) revert NotActive();

    (uint64 due, bool overdue) = _checkOverdue(p);
    uint64 graceEnds = due + p.graceSecs;
    if (!overdue) revert NotOverdue(due, graceEnds);

    (uint256 refund, uint256 forfeit) = _calcCancel(p);

    p.state = State.Lapsed;
    if (refund > 0) {
      pending[p.buyer] += refund;
    }
    if (forfeit > 0) {
      pending[p.seller] += forfeit;
    }

    emit Lapsed(id, refund, forfeit);
  }

  /**
   * @notice Pull payment pattern to withdraw accumulated pending balance.
   */
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;
    emit Withdrawn(msg.sender, amount);

    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();
  }

  // --- Views ---

  function planOf(uint256 id) external view returns (Plan memory) {
    Plan memory p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    return p;
  }

  function nextDue(uint256 id) external view returns (uint64 dueAt, bool overdue) {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    return _checkOverdue(p);
  }

  function ifCancelled(uint256 id) external view returns (uint256 refund, uint256 forfeit) {
    Plan storage p = _plans[id];
    if (p.seller == address(0)) revert NoSuchPlan();
    return _calcCancel(p);
  }

  function byParty(
    address addr,
    uint256 offset,
    uint256 count
  ) external view returns (uint256[] memory ids, Plan[] memory list) {
    uint256[] storage all = _byParty[addr];
    uint256 total = all.length;

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Plan[](0));
    }

    if (count > MAX_PAGE) count = MAX_PAGE;
    if (offset + count > total) count = total - offset;

    ids = new uint256[](count);
    list = new Plan[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 pId = all[total - 1 - (offset + i)];
      ids[i] = pId;
      list[i] = _plans[pId];
    }
  }

  function latest(
    uint256 offset,
    uint256 count
  ) external view returns (uint256[] memory ids, Plan[] memory list) {
    uint256 total = planCount;

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Plan[](0));
    }

    if (count > MAX_PAGE) count = MAX_PAGE;
    if (offset + count > total) count = total - offset;

    ids = new uint256[](count);
    list = new Plan[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 pId = total - offset - i;
      ids[i] = pId;
      list[i] = _plans[pId];
    }
  }

  // --- Internal Helpers ---

  function _calcCancel(Plan storage p) internal view returns (uint256 refund, uint256 forfeit) {
    uint256 paid = uint256(p.instalment) * uint256(p.paidCount);
    forfeit = (paid * uint256(p.forfeitBps)) / 10_000;
    refund = paid - forfeit;
  }

  function _checkOverdue(Plan storage p) internal view returns (uint64 dueAt, bool overdue) {
    if (p.state != State.Active) {
      return (0, false);
    }
    // Next instalment due is startedAt + paidCount * periodSecs
    dueAt = p.startedAt + (uint64(p.paidCount) * uint64(p.periodSecs));
    overdue = block.timestamp > (dueAt + uint64(p.graceSecs));
  }
}
