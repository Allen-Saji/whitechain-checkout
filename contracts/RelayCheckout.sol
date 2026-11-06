// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
interface IAuthorizedToken {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}
/// @notice Sponsored USDT settlement with order-bound authorizations and merchant-funded refunds.
contract RelayCheckout {
    IAuthorizedToken public immutable token;
    address public relay;
    address public immutable admin;
    bool public paused;
    event RelayChanged(address indexed relay);
    event Paused(bool value);
    struct Receipt {
        address buyer;
        address merchant;
        uint256 paid;
        uint256 refunded;
    }
    mapping(bytes32 => Receipt) public receipts;
    mapping(bytes32 => bool) public refunds;
    bool private entered;
    event Paid(
        bytes32 indexed orderId,
        address buyer,
        address merchant,
        uint256 amount
    );
    event Refunded(
        bytes32 indexed orderId,
        bytes32 indexed refundId,
        uint256 amount
    );
    modifier guarded() {
        require(msg.sender == relay, 'relay only');
        require(!entered, 'reentrant');
        entered = true;
        _;
        entered = false;
    }
    constructor(address token_, address relay_) {
        require(token_ != address(0) && relay_ != address(0), 'zero address');
        token = IAuthorizedToken(token_);
        relay = relay_;
        admin = msg.sender;
    }
    function setRelay(address next) external {
        require(msg.sender == admin && next != address(0), 'admin');
        relay = next;
        emit RelayChanged(next);
    }
    function setPaused(bool value) external {
        require(msg.sender == admin, 'admin');
        paused = value;
        emit Paused(value);
    }
    function paymentNonce(
        bytes32 id,
        address buyer,
        address merchant,
        uint256 amount,
        uint256 deadline
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    'payment',
                    address(this),
                    id,
                    buyer,
                    merchant,
                    amount,
                    deadline
                )
            );
    }
    function refundNonce(
        bytes32 id,
        bytes32 refundId,
        uint256 amount,
        uint256 deadline
    ) public view returns (bytes32) {
        Receipt memory r = receipts[id];
        return
            keccak256(
                abi.encode(
                    'refund',
                    address(this),
                    id,
                    refundId,
                    r.merchant,
                    r.buyer,
                    amount,
                    deadline
                )
            );
    }
    function pay(
        bytes32 id,
        address buyer,
        address merchant,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external guarded {
        require(!paused, 'paused');
        require(
            id != bytes32(0) &&
                buyer != address(0) &&
                merchant != address(0) &&
                buyer != merchant &&
                merchant != address(this) &&
                amount > 0,
            'terms'
        );
        require(receipts[id].paid == 0, 'already paid');
        receipts[id] = Receipt(buyer, merchant, amount, 0);
        receiveAndForward(
            buyer,
            merchant,
            amount,
            deadline,
            paymentNonce(id, buyer, merchant, amount, deadline),
            signature
        );
        emit Paid(id, buyer, merchant, amount);
    }
    function refund(
        bytes32 id,
        bytes32 refundId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external guarded {
        Receipt storage r = receipts[id];
        require(
            refundId != bytes32(0) &&
                !refunds[refundId] &&
                amount > 0 &&
                r.refunded + amount <= r.paid,
            'refund terms'
        );
        refunds[refundId] = true;
        r.refunded += amount;
        receiveAndForward(
            r.merchant,
            r.buyer,
            amount,
            deadline,
            refundNonce(id, refundId, amount, deadline),
            signature
        );
        emit Refunded(id, refundId, amount);
    }
    function receiveAndForward(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) private {
        uint256 start = token.balanceOf(address(this));
        uint256 recipientStart = token.balanceOf(to);
        token.receiveWithAuthorization(
            from,
            address(this),
            amount,
            0,
            deadline,
            nonce,
            signature
        );
        require(
            token.balanceOf(address(this)) == start + amount,
            'received amount'
        );
        require(token.transfer(to, amount), 'transfer');
        require(
            token.balanceOf(address(this)) == start &&
                token.balanceOf(to) == recipientStart + amount,
            'settlement'
        );
    }
}
