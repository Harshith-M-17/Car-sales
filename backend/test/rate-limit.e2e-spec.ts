import request from 'supertest';
import { createTestApp, TestApp } from './helpers/test-app';

const KEY = 'k'.repeat(40);

describe('rate limits', () => {
  let t: TestApp;
  const login = () =>
    request(t.http)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassw0rd' });

  beforeAll(async () => {
    t = await createTestApp({ RATE_LIMIT_ENABLED: 'true', INTERNAL_API_KEY: KEY });
  });

  afterAll(async () => {
    await t?.close();
  });

  it('blocks repeated sign-in attempts, except from the website server', async () => {
    for (let i = 0; i < 10; i++) await login().expect(401);
    await login().expect(429);
    await login().set('x-internal-key', 'wrong').expect(429);
    await login().set('x-internal-key', 'x'.repeat(40)).expect(429);
    await login().set('x-internal-key', KEY).expect(401);
  });
});
