import { describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('session and sales endpoints', () => {
  it('creates a session', async () => {
    const app = await buildServer();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { displayName: 'Jim' }
    });

    expect(sessionResponse.statusCode).toBe(200);
    const session = sessionResponse.json();
    expect(session.userToken).toMatch(/^usr_tok_/);
    expect(session.displayName).toBe('Jim');
  });
});