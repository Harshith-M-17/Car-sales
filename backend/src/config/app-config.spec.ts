import { loadConfig } from './app-config';

const base = {
  MONGODB_URI: 'mongodb://localhost/test',
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123456789',
};
const production = { ...base, NODE_ENV: 'production', MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.test' };

describe('mail config', () => {
  it('defaults to logging emails in development', () => {
    expect(loadConfig(base).mail.driver).toBe('log');
  });

  it('refuses to log emails in production', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', WEB_APP_URL: 'https://cars.example' }),
    ).toThrow('MAIL_DRIVER=log is not allowed in production');
  });

  it('requires the SMTP details when SMTP is selected', () => {
    expect(() => loadConfig(production)).toThrow('MAIL_FROM');
    expect(() => loadConfig({ ...base, MAIL_DRIVER: 'smtp', MAIL_FROM: 'a@example.com' })).toThrow(
      'SMTP_HOST',
    );
  });

  it('refuses reset links pointing at localhost in production', () => {
    const smtp = { ...production, MAIL_FROM: 'Cars <no-reply@cars.example>' };
    expect(() => loadConfig(smtp)).toThrow('WEB_APP_URL must be the public site');
    expect(loadConfig({ ...smtp, WEB_APP_URL: 'https://cars.example/' }).webAppUrl).toBe(
      'https://cars.example',
    );
  });
});
