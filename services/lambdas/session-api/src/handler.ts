import { randomUUID } from 'node:crypto';

export async function createSession(input: { displayName: string }) {
  return {
    userToken: `usr_tok_${randomUUID()}`,
    displayName: input.displayName
  };
}