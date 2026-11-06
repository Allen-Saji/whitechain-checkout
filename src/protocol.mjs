import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
} from 'viem';
export const REQUIRED_TOKEN = '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7';
export const authorizationTypes = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};
export const onchainId = (id) => keccak256(toHex(id));
export function paymentNonce(router, id, buyer, merchant, amount, deadline) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'string,address,bytes32,address,address,uint256,uint256',
      ),
      [
        'payment',
        router,
        onchainId(id),
        buyer,
        merchant,
        BigInt(amount),
        BigInt(deadline),
      ],
    ),
  );
}
export function refundNonce(
  router,
  id,
  refundId,
  merchant,
  buyer,
  amount,
  deadline,
) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'string,address,bytes32,bytes32,address,address,uint256,uint256',
      ),
      [
        'refund',
        router,
        onchainId(id),
        onchainId(refundId),
        merchant,
        buyer,
        BigInt(amount),
        BigInt(deadline),
      ],
    ),
  );
}
export function authorization(config, from, amount, deadline, nonce) {
  return {
    domain: {
      name: config.tokenName,
      version: '1',
      chainId: 1874,
      verifyingContract: REQUIRED_TOKEN,
    },
    types: authorizationTypes,
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from,
      to: config.router,
      value: BigInt(amount),
      validAfter: 0n,
      validBefore: BigInt(deadline),
      nonce,
    },
  };
}
export const jsonSafe = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
