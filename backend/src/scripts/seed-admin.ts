/**
 * Creates the first platform admin from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME / ADMIN_PHONE.
 * Admins can't self-register; run this once per environment.
 */
import { Role } from '../common/types/auth';
import { AuthService } from '../modules/auth/auth.service';
import { UsersService } from '../modules/users/users.service';
import { runScript } from './script-context';

void runScript('seed-admin', async (app) => {
  const {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_NAME: name = 'Platform Admin',
    ADMIN_PHONE: phone,
  } = process.env;
  if (!email || !password || !phone) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_PHONE are required');
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const users = app.get(UsersService);
  const existing = await users.findCredentialsByEmail(email);
  if (existing) {
    console.log(`User ${email} already exists (role: ${existing.role}); nothing to do.`);
    return;
  }
  const auth = app.get(AuthService);
  const admin = await users.create({
    name,
    email,
    phone,
    passwordHash: await auth.hashPassword(password),
    role: Role.Admin,
  });
  console.log(`Created admin ${admin.email} (${admin.id})`);
});
