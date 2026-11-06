# Whitechain integration feedback

The required USDT token supports EIP-3009 receive authorizations. We used it to complete a sponsored payment and partial refund on Whitechain Sepolia without giving the buyer or merchant WBT. The public RPC and explorer transaction links were sufficient to verify settlement independently of our application database.

The faucet flow we used supplied WBT only. We obtained the required USDT by swapping test WBT on YetiTrade, checking the complete token address to distinguish it from USDT.e and other test tokens. A direct acquisition link beside the required token address in the hackathon instructions would shorten this setup step.

Explorer source verification returned HTTP 403 with "Contract verification is temporarily unavailable" on November 6, 2026. We preserved the original compiler input and independently checked it against the deployment transaction. The same standard-input request succeeded on November 7, and the explorer now reports an exact source match. A status notice or documented fallback would help during future verification outages.

References:

- [YetiTrade test-token instructions](https://docs.yetitrade.fi/get-test-tokens)
- [Whitechain network setup](https://docs.whitechain.io/learn/get-started/connect-wallet)
- [Deployment and live settlement evidence](README.md#settlement-evidence)
