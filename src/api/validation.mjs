import { z } from 'zod';
import { getAddress, verifyTypedData } from 'viem';
export const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => getAddress(value));
export const amount = z.string().regex(/^[1-9][0-9]{0,30}$/);
export function requireThat(test, status, code) {
  if (!test) throw Object.assign(Error(code), { statusCode: status, code });
}

export async function verifyAuthorization(authorization) {
  try {
    return await verifyTypedData(authorization);
  } catch {
    return false;
  }
}
