import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import request from 'supertest';
import { Role } from '../src/common/types/auth';
import { CacheService } from '../src/infra/cache/cache.service';
import { MAIL_DRIVER, MailDriver, MailMessage } from '../src/infra/mail/mail.driver';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordReset } from '../src/modules/auth/schemas/password-reset.schema';
import { ListingViewsService } from '../src/modules/listings/listing-views.service';
import { Listing, ListingStatus } from '../src/modules/listings/schemas/listing.schema';
import { UserStatus } from '../src/modules/users/schemas/user.schema';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp, TestApp } from './helpers/test-app';

const API = '/api/v1';

let t: TestApp;
let jpeg: Buffer;

interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  branchId?: string;
}

async function register(body: Record<string, unknown>): Promise<Session> {
  const res = await request(t.http).post(`${API}/auth/register`).send(body).expect(201);
  return {
    token: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    userId: res.body.user.id,
    branchId: res.body.user.sellerProfile?.branches[0]?.id,
  };
}

const auth = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

let phoneSeq = 9800000000;
const nextPhone = () => String(phoneSeq++);

const ADDRESS = {
  addressLine: '12, 100 Feet Road',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
};

function sellerBody(email: string) {
  return {
    name: 'Sharma Motors',
    email,
    phone: nextPhone(),
    password: 'Passw0rd!',
    accountType: 'seller',
    sellerProfile: { businessName: 'Sharma Motors', address: ADDRESS },
  };
}

async function uploadImages(s: Session, count = 1): Promise<string[]> {
  let req = request(t.http).post(`${API}/media/images`).set(auth(s));
  for (let i = 0; i < count; i++)
    req = req.attach('files', jpeg, { filename: `car${i}.jpg`, contentType: 'image/jpeg' });
  const res = await req.expect(201);
  return res.body.map((m: { id: string }) => m.id);
}

function listingBody(s: Session, imageIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    makeSlug: 'maruti-suzuki',
    modelSlug: 'swift',
    variant: 'VXi',
    year: 2019,
    kmDriven: 42000,
    fuelType: 'petrol',
    transmission: 'manual',
    bodyType: 'hatchback',
    ownerCount: 1,
    price: 550000,
    registrationState: 'KA',
    features: ['abs', 'airbags'],
    branchId: s.branchId,
    imageIds,
    ...overrides,
  };
}

beforeAll(async () => {
  t = await createTestApp();
  jpeg = await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#336699' } })
    .jpeg()
    .toBuffer();
});

afterAll(async () => {
  await t?.close();
});

describe('platform', () => {
  it('health endpoints', async () => {
    await request(t.http).get('/api/health/live').expect(200, { status: 'ok' });
    const ready = await request(t.http).get('/api/health/ready').expect(200);
    expect(ready.body.info.mongodb.status).toBe('up');
  });

  it('catalog is cacheable with ETag', async () => {
    const res = await request(t.http).get(`${API}/catalog`).expect(200);
    expect(res.body.makes.find((m: { slug: string }) => m.slug === 'maruti-suzuki')).toBeTruthy();
    expect(res.headers['cache-control']).toContain('max-age=3600');
    await request(t.http).get(`${API}/catalog`).set('If-None-Match', res.headers.etag).expect(304);
  });

  it('returns a consistent error shape and request id', async () => {
    const res = await request(t.http)
      .get(`${API}/listings/not-an-id`)
      .set('x-request-id', 'req-123')
      .expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'Invalid id',
      requestId: 'req-123',
    });
    await request(t.http)
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"bad json')
      .expect(400);
  });
});

describe('auth', () => {
  it('registers, rejects duplicates and bad input', async () => {
    const s = await register({
      name: 'Asha',
      email: 'asha@example.com',
      phone: '98450 12345',
      password: 'Passw0rd!',
    });
    expect(s.token).toBeTruthy();
    expect(s.refreshToken).toEqual(expect.any(String));

    const me = await request(t.http).get(`${API}/me`).set(auth(s)).expect(200);
    expect(me.body).toMatchObject({
      email: 'asha@example.com',
      phone: '+919845012345',
      role: 'buyer',
    });
    expect(me.body.passwordHash).toBeUndefined();

    await request(t.http)
      .post(`${API}/auth/register`)
      .send({ name: 'Dup', email: 'ASHA@example.com', phone: nextPhone(), password: 'Passw0rd!' })
      .expect(409);
    await request(t.http)
      .post(`${API}/auth/register`)
      .send({ name: 'Bad', email: 'bad@example.com', phone: '12', password: 'short' })
      .expect(400);
    await request(t.http)
      .post(`${API}/auth/register`)
      .send({
        name: 'X',
        email: 'x@example.com',
        phone: nextPhone(),
        password: 'Passw0rd!',
        role: 'admin',
      })
      .expect(400); // unknown fields are rejected (no mass assignment)
  });

  it('refresh needs a valid refresh token', async () => {
    await request(t.http).post(`${API}/auth/refresh`).send({}).expect(400);
    await request(t.http).post(`${API}/auth/refresh`).send({ refreshToken: 'bogus' }).expect(401);
  });

  it('login, refresh rotation, logout', async () => {
    await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: 'asha@example.com', password: 'nope1234' })
      .expect(401);
    const login = await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: 'asha@example.com', password: 'Passw0rd!' })
      .expect(200);
    expect(login.headers['set-cookie']).toBeUndefined();
    expect(login.headers['cache-control']).toBe('no-store');

    const first = login.body.refreshToken as string;
    expect(first).toEqual(expect.any(String));
    const refreshed = await request(t.http)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first })
      .expect(200);
    const second = refreshed.body.refreshToken as string;
    expect(second).not.toEqual(first);
    expect(refreshed.headers['set-cookie']).toBeUndefined();
    expect(refreshed.body.user.email).toBe('asha@example.com');

    await request(t.http).post(`${API}/auth/logout`).send({ refreshToken: second }).expect(204);
    await request(t.http).post(`${API}/auth/refresh`).send({ refreshToken: second }).expect(401);
  });

  it('checking a saved login does not use it up, and fails once it is ended', async () => {
    const { body } = await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: 'asha@example.com', password: 'Passw0rd!' })
      .expect(200);
    const check = (refreshToken: string) =>
      request(t.http).post(`${API}/auth/session`).send({ refreshToken });

    const live = await check(body.refreshToken).expect(200);
    expect(live.body).toMatchObject({ email: 'asha@example.com', role: 'buyer' });
    expect(live.body.passwordHash).toBeUndefined();
    await check(body.refreshToken).expect(200);
    await check('bogus').expect(401);
    await request(t.http).post(`${API}/auth/session`).send({}).expect(400);

    // A device stays signed in only until another one ends every session.
    await request(t.http)
      .post(`${API}/auth/logout-all`)
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(204);
    await check(body.refreshToken).expect(401);
  });

  it('protects routes and enforces roles', async () => {
    await request(t.http).get(`${API}/me`).expect(401);
    await request(t.http).get(`${API}/me`).set('Authorization', 'Bearer garbage').expect(401);
    // Public routes tolerate a bad token.
    await request(t.http).get(`${API}/listings`).set('Authorization', 'Bearer garbage').expect(200);

    const buyer = await register({
      name: 'Buyer',
      email: 'buyer2@example.com',
      phone: nextPhone(),
      password: 'Passw0rd!',
    });
    await request(t.http).get(`${API}/listings/mine`).set(auth(buyer)).expect(403);

    const upgraded = await request(t.http)
      .post(`${API}/me/seller-profile`)
      .set(auth(buyer))
      .send({ businessName: 'Pune Cars', address: { ...ADDRESS, city: 'Pune' } })
      .expect(201);
    expect(upgraded.body.user.role).toBe('seller');
    await request(t.http)
      .get(`${API}/listings/mine`)
      .set({ Authorization: `Bearer ${upgraded.body.accessToken}` })
      .expect(200);
  });
});

describe('password reset', () => {
  const OLD = 'Passw0rd!';
  const NEW = 'NewPassw0rd!';
  let sent: MailMessage[];
  let resets: Model<PasswordReset>;
  let n = 0;

  const forgot = (email: string) =>
    request(t.http).post(`${API}/auth/password/forgot`).send({ email }).expect(204);
  const reset = (token: string, newPassword = NEW) =>
    request(t.http).post(`${API}/auth/password/reset`).send({ token, newPassword });
  const login = (email: string, password: string) =>
    request(t.http).post(`${API}/auth/login`).send({ email, password });
  const newUser = async () => {
    const email = `reset${++n}@example.com`;
    return {
      email,
      session: await register({ name: 'Reset', email, phone: nextPhone(), password: OLD }),
    };
  };
  const tokenOf = (mail: MailMessage) => /#token=([\w-]+)/.exec(mail.text)![1];

  /** The request returns before the email goes out, so wait for it. */
  async function mailsTo(email: string, count = 1): Promise<MailMessage[]> {
    for (let i = 0; i < 200; i++) {
      const mails = sent.filter((m) => m.to === email);
      if (mails.length >= count) return mails;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(
      `Expected ${count} email(s) to ${email}, got ${sent.filter((m) => m.to === email).length}`,
    );
  }

  /** Sends to a known user after `request` and waits, so anything it queued has had its turn. */
  async function expectNoMail(email: string, trigger: () => Promise<unknown>) {
    await trigger();
    const { email: other } = await newUser();
    await forgot(other);
    await mailsTo(other);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.filter((m) => m.to === email)).toHaveLength(0);
  }

  beforeAll(() => {
    resets = t.app.get<Model<PasswordReset>>(getModelToken(PasswordReset.name));
  });

  beforeEach(() => {
    sent = [];
    jest.spyOn(t.app.get<MailDriver>(MAIL_DRIVER), 'send').mockImplementation((message) => {
      sent.push(message);
      return Promise.resolve();
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('resets the password, signs in and ends every other session', async () => {
    const { email, session } = await newUser();
    await forgot(`  ${email.toUpperCase()} `);
    const [mail] = await mailsTo(email);
    expect(mail.text).toContain('http://localhost:3100/reset-password#token=');
    expect(mail.html).toContain(tokenOf(mail));

    // Requesting a link alone changes nothing.
    await login(email, OLD).expect(200);

    const res = await reset(tokenOf(mail)).expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();

    await login(email, OLD).expect(401);
    await login(email, NEW).expect(200);
    await request(t.http)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('a link works once and stores only a hash of the token', async () => {
    const { email } = await newUser();
    await forgot(email);
    const token = tokenOf((await mailsTo(email))[0]);
    const stored = await resets.find({}).lean().exec();
    expect(JSON.stringify(stored)).not.toContain(token);

    await reset(token).expect(200);
    await reset(token, 'Another1Pass').expect(400);
    await login(email, NEW).expect(200);
  });

  it('rejects unknown and expired links, and a weak password does not use up the link', async () => {
    await reset('not-a-real-token').expect(400);

    const { email, session } = await newUser();
    await forgot(email);
    const token = tokenOf((await mailsTo(email))[0]);
    await reset(token, 'short').expect(400);
    await reset(token, 'nodigitshere').expect(400);

    await resets
      .updateOne(
        { user: new Types.ObjectId(session.userId) },
        { expiresAt: new Date(Date.now() - 1000) },
      )
      .exec();
    await reset(token).expect(400);
    await login(email, OLD).expect(200);
  });

  it('does not reveal whether an account exists', async () => {
    const email = 'nobody@example.com';
    await expectNoMail(email, () => forgot(email));
    await request(t.http)
      .post(`${API}/auth/password/forgot`)
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('sends nothing for suspended accounts or admins', async () => {
    const users = t.app.get(UsersService);
    const suspended = await newUser();
    await users.setStatus(new Types.ObjectId(suspended.session.userId), UserStatus.Suspended);
    await expectNoMail(suspended.email, () => forgot(suspended.email));

    const adminEmail = 'reset-admin@example.com';
    await users.create({
      name: 'Admin',
      email: adminEmail,
      phone: nextPhone(),
      passwordHash: await t.app.get(AuthService).hashPassword(OLD),
      role: Role.Admin,
    });
    await expectNoMail(adminEmail, () => forgot(adminEmail));
    await t.connection.collection('users').deleteOne({ email: adminEmail }); // other tests count admins
  });

  it('limits how often a mailbox can be emailed, and a new link replaces the old one', async () => {
    const { email, session } = await newUser();
    const user = new Types.ObjectId(session.userId);
    const firstRow = () => resets.findOne({ user }).lean().exec();

    await forgot(email);
    const first = tokenOf((await mailsTo(email))[0]);

    // Within the cooldown, including several at once: nothing more is sent.
    await Promise.all([forgot(email), forgot(email), forgot(email)]);
    await new Promise((r) => setTimeout(r, 100));
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);
    expect((await firstRow())?.sendCount).toBe(1);

    // After the cooldown a new link replaces the old one.
    await resets.updateOne({ user }, { sentAt: new Date(Date.now() - 61_000) }).exec();
    await forgot(email);
    const second = tokenOf((await mailsTo(email, 2))[1]);
    await reset(first).expect(400);

    // Once the send limit is reached, nothing more goes out and the last link keeps working.
    await resets
      .updateOne({ user }, { sentAt: new Date(Date.now() - 61_000), sendCount: 5 })
      .exec();
    await forgot(email);
    await new Promise((r) => setTimeout(r, 100));
    expect(sent.filter((m) => m.to === email)).toHaveLength(2);
    await reset(second).expect(200);
  });

  it('changing the password while signed in cancels an outstanding link', async () => {
    const { email, session } = await newUser();
    await forgot(email);
    const token = tokenOf((await mailsTo(email))[0]);

    await request(t.http)
      .patch(`${API}/me/password`)
      .set(auth(session))
      .send({ currentPassword: OLD, newPassword: NEW })
      .expect(200);
    await reset(token, 'Another1Pass').expect(400);
    await login(email, NEW).expect(200);
  });

  it('a failed email does not fail the request', async () => {
    const { email } = await newUser();
    jest
      .spyOn(t.app.get<MailDriver>(MAIL_DRIVER), 'send')
      .mockRejectedValue(new Error('SMTP down'));
    await forgot(email);
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('marketplace flow', () => {
  let seller: Session;
  let buyer: Session;
  let listingId: string;

  beforeAll(async () => {
    seller = await register(sellerBody('dealer@example.com'));
    buyer = await register({
      name: 'Ravi',
      email: 'ravi@example.com',
      phone: nextPhone(),
      password: 'Passw0rd!',
    });
  });

  it('uploads and processes images', async () => {
    const res = await request(t.http)
      .post(`${API}/media/images`)
      .set(auth(seller))
      .attach('files', jpeg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body[0]).toMatchObject({ width: 1024, height: 768 });
    const key = res.body[0].thumbUrl.replace('http://localhost:4000/uploads/', '');
    expect(existsSync(join(t.uploadDir, key))).toBe(true);

    await request(t.http)
      .post(`${API}/media/images`)
      .set(auth(seller))
      .attach('files', Buffer.from('not an image'), {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    await request(t.http)
      .post(`${API}/media/images`)
      .set(auth(buyer))
      .attach('files', jpeg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });

  it('creates and validates listings', async () => {
    const images = await uploadImages(seller, 2);
    const res = await request(t.http)
      .post(`${API}/listings`)
      .set(auth(seller))
      .send(listingBody(seller, images))
      .expect(201);
    listingId = res.body.id;
    expect(res.body).toMatchObject({
      title: '2019 Maruti Suzuki Swift VXi',
      status: 'active',
      thumbUrl: expect.stringContaining('-th.webp'),
      seller: { verified: false, businessName: 'Sharma Motors' },
    });

    // Someone else's media can't be attached.
    const other = await register(sellerBody('other-dealer@example.com'));
    await request(t.http)
      .post(`${API}/listings`)
      .set(auth(other))
      .send(listingBody(other, images))
      .expect(400);

    await request(t.http)
      .post(`${API}/listings`)
      .set(auth(seller))
      .send(listingBody(seller, [], { makeSlug: 'maruti-suzuki', modelSlug: 'not-a-model' }))
      .expect(400);
    await request(t.http)
      .post(`${API}/listings`)
      .set(auth(seller))
      .send(listingBody(seller, []))
      .expect(400); // needs a photo
    const draft = await request(t.http)
      .post(`${API}/listings`)
      .set(auth(seller))
      .send(listingBody(seller, [], { publish: false }))
      .expect(201);
    expect(draft.body.status).toBe('draft');
    const publish = await request(t.http)
      .post(`${API}/listings/${draft.body.id}/publish`)
      .set(auth(seller))
      .expect(400);
    expect(publish.body.message).toMatch(/photo/);
  });

  it('serves the public detail page and counts unique views', async () => {
    const res = await request(t.http).get(`${API}/listings/${listingId}`).expect(200);
    expect(res.body).toMatchObject({
      id: listingId,
      features: ['abs', 'airbags'],
      branchId: seller.branchId,
      location: { branchName: 'Main branch', ...ADDRESS, lat: null, lng: null },
    });
    expect(res.body.images).toHaveLength(2);
    expect(res.body.seller.phone).toBeUndefined(); // contact details require a lead
    expect(res.headers['cache-control']).toContain('public');

    // Reading (or prefetching) the page never counts; the explicit beacon does.
    await request(t.http).get(`${API}/listings/${listingId}`).set(auth(buyer)).expect(200);
    await request(t.http).post(`${API}/listings/${listingId}/views`).expect(204);
    await request(t.http).post(`${API}/listings/${listingId}/views`).set(auth(buyer)).expect(204);
    await request(t.http).post(`${API}/listings/${listingId}/views`).set(auth(buyer)).expect(204); // de-duplicated
    await request(t.http).post(`${API}/listings/${listingId}/views`).set(auth(seller)).expect(204); // owner not counted
    await request(t.http).post(`${API}/listings/${new Types.ObjectId()}/views`).expect(204); // unknown: ignored
    await t.app.get(ListingViewsService).flush();

    const owned = await request(t.http)
      .get(`${API}/listings/mine/${listingId}`)
      .set(auth(seller))
      .expect(200);
    expect(owned.body.stats.views).toBe(2); // anonymous + buyer
  });

  it('favourites are idempotent and shown on search results', async () => {
    await request(t.http).put(`${API}/favorites/${listingId}`).set(auth(buyer)).expect(204);
    await request(t.http).put(`${API}/favorites/${listingId}`).set(auth(buyer)).expect(204);
    const list = await request(t.http).get(`${API}/favorites`).set(auth(buyer)).expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([listingId]);

    const search = await request(t.http)
      .get(`${API}/listings?make=maruti-suzuki`)
      .set(auth(buyer))
      .expect(200);
    expect(search.body.items.find((i: { id: string }) => i.id === listingId).isFavorited).toBe(
      true,
    );
    expect(search.headers['cache-control']).toContain('private');

    const owned = await request(t.http)
      .get(`${API}/listings/mine/${listingId}`)
      .set(auth(seller))
      .expect(200);
    expect(owned.body.stats.favorites).toBe(1);

    await request(t.http).delete(`${API}/favorites/${listingId}`).set(auth(buyer)).expect(204);
    await request(t.http).delete(`${API}/favorites/${listingId}`).set(auth(buyer)).expect(204);
    const after = await request(t.http)
      .get(`${API}/listings/mine/${listingId}`)
      .set(auth(seller))
      .expect(200);
    expect(after.body.stats.favorites).toBe(0);
  });

  it('leads reveal seller contact and de-duplicate per buyer', async () => {
    const first = await request(t.http)
      .post(`${API}/leads`)
      .set(auth(buyer))
      .send({ listingId, message: 'Is it available?' })
      .expect(201);
    expect(first.body.seller).toMatchObject({
      name: 'Sharma Motors',
      phone: expect.stringMatching(/^\+91/),
    });

    const again = await request(t.http)
      .post(`${API}/leads`)
      .set(auth(buyer))
      .send({ listingId, message: 'Following up' })
      .expect(201);
    expect(again.body.id).toBe(first.body.id);

    await request(t.http).post(`${API}/leads`).set(auth(seller)).send({ listingId }).expect(400); // own listing

    const inbox = await request(t.http).get(`${API}/leads/received`).set(auth(seller)).expect(200);
    expect(inbox.body.items).toHaveLength(1);
    expect(inbox.body.items[0]).toMatchObject({
      message: 'Following up',
      buyer: { name: 'Ravi' },
      status: 'new',
    });

    const updated = await request(t.http)
      .patch(`${API}/leads/${first.body.id}`)
      .set(auth(seller))
      .send({ status: 'contacted', sellerNote: 'Called, visiting Sat' })
      .expect(200);
    expect(updated.body.status).toBe('contacted');
    await request(t.http)
      .patch(`${API}/leads/${first.body.id}`)
      .set(auth(buyer))
      .send({ status: 'closed' })
      .expect(403);

    const sent = await request(t.http).get(`${API}/leads/sent`).set(auth(buyer)).expect(200);
    expect(sent.body.items[0].listing.id).toBe(listingId);

    const stats = await request(t.http)
      .get(`${API}/listings/mine/stats`)
      .set(auth(seller))
      .expect(200);
    expect(stats.body.totalLeads).toBe(1);
  });

  it('lifecycle: pause, re-publish without bump, sell, delete', async () => {
    const before = await request(t.http)
      .get(`${API}/listings/mine/${listingId}`)
      .set(auth(seller))
      .expect(200);

    await request(t.http)
      .post(`${API}/listings/${listingId}/deactivate`)
      .set(auth(seller))
      .expect(200);
    await request(t.http).get(`${API}/listings/${listingId}`).expect(404); // hidden from public
    await request(t.http).get(`${API}/listings/${listingId}`).set(auth(seller)).expect(200); // owner still sees it
    await request(t.http).post(`${API}/leads`).set(auth(buyer)).send({ listingId }).expect(404);

    const republished = await request(t.http)
      .post(`${API}/listings/${listingId}/publish`)
      .set(auth(seller))
      .expect(200);
    expect(republished.body.publishedAt).toBe(before.body.publishedAt);

    const edited = await request(t.http)
      .patch(`${API}/listings/${listingId}`)
      .set(auth(seller))
      .send({ price: 525000, variant: 'ZXi' })
      .expect(200);
    expect(edited.body).toMatchObject({ price: 525000, title: '2019 Maruti Suzuki Swift ZXi' });

    await request(t.http)
      .patch(`${API}/listings/${listingId}`)
      .set(auth(seller))
      .send({ insuranceValidTill: '2027-03-31', color: 'Red' })
      .expect(200);
    await request(t.http)
      .patch(`${API}/listings/${listingId}`)
      .set(auth(seller))
      .send({
        insuranceValidTill: null,
        color: '',
        bodyType: null,
        registrationState: null,
        year: null,
      })
      .expect(200);
    const cleared = await request(t.http)
      .get(`${API}/listings/mine/${listingId}`)
      .set(auth(seller))
      .expect(200);
    expect(cleared.body).toMatchObject({
      insuranceValidTill: null,
      color: null,
      bodyType: null,
      registrationState: null,
      year: 2019,
    });
    const detail = await request(t.http).get(`${API}/listings/${listingId}`).expect(200);
    expect(detail.body.price).toBe(525000); // cache invalidated on write

    await request(t.http)
      .post(`${API}/listings/${listingId}/mark-sold`)
      .set(auth(seller))
      .expect(200);
    await request(t.http)
      .patch(`${API}/listings/${listingId}`)
      .set(auth(seller))
      .send({ price: 1 })
      .expect(400);
    await request(t.http)
      .patch(`${API}/listings/${listingId}`)
      .set(auth(seller))
      .send({ price: 500000 })
      .expect(409);
    await request(t.http)
      .post(`${API}/listings/${listingId}/deactivate`)
      .set(auth(seller))
      .expect(409);
    await request(t.http).delete(`${API}/listings/${listingId}`).set(auth(seller)).expect(204);
    await request(t.http).get(`${API}/listings/mine/${listingId}`).set(auth(seller)).expect(404);
  });
});

describe('dealers and branches', () => {
  const BRANCH = {
    name: 'Whitefield showroom',
    addressLine: '4, ITPL Main Road',
    locality: 'Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
  };
  let n = 0;
  const dealer = () => register(sellerBody(`branch-dealer${++n}@example.com`));
  const addBranch = (s: Session, body: object = BRANCH) =>
    request(t.http).post(`${API}/me/branches`).set(auth(s)).send(body);
  const list = async (s: Session, overrides: Record<string, unknown> = {}) => {
    const images = await uploadImages(s);
    const res = await request(t.http)
      .post(`${API}/listings`)
      .set(auth(s))
      .send(listingBody(s, images, overrides))
      .expect(201);
    return res.body.id as string;
  };
  const owned = async (s: Session, id: string) =>
    (await request(t.http).get(`${API}/listings/mine/${id}`).set(auth(s)).expect(200)).body;
  const buyer = () =>
    register({
      name: 'Meera',
      email: `branch-buyer${++n}@example.com`,
      phone: nextPhone(),
      password: 'Passw0rd!',
    });

  it('dealers must give a business name and a full address to sign up', async () => {
    const body = sellerBody('branch-signup@example.com');
    const profile = body.sellerProfile;
    const bad = [
      undefined,
      { businessName: 'X' },
      { address: ADDRESS },
      { businessName: '   ', address: ADDRESS },
      { businessName: 'X', address: { ...ADDRESS, addressLine: '  ' } },
      { businessName: 'X', address: { ...ADDRESS, city: undefined } },
      { businessName: 'X', address: { ...ADDRESS, state: undefined } },
      { businessName: 'X', address: { ...ADDRESS, pincode: '5600' } },
      { ...profile, type: 'individual' }, // there are no individual sellers any more
    ];
    for (const sellerProfile of bad) {
      await request(t.http)
        .post(`${API}/auth/register`)
        .send({ ...body, sellerProfile })
        .expect(400);
    }

    const res = await request(t.http).post(`${API}/auth/register`).send(body).expect(201);
    expect(res.body.user.role).toBe('seller');
    expect(res.body.user.sellerProfile).toMatchObject({
      businessName: 'Sharma Motors',
      verified: false,
      branches: [{ name: 'Main branch', ...ADDRESS, phone: null }],
    });
  });

  it('a buyer can only become a dealer by giving an address', async () => {
    const s = await buyer();
    for (const body of [
      { businessName: 'X' },
      { type: 'individual', city: 'Pune' },
      { businessName: 'X', address: { ...ADDRESS, pincode: '1' } },
    ]) {
      await request(t.http).post(`${API}/me/seller-profile`).set(auth(s)).send(body).expect(400);
    }
    await request(t.http)
      .post(`${API}/me/seller-profile`)
      .set(auth(s))
      .send({ businessName: 'X', address: ADDRESS })
      .expect(201);
  });

  it('the old owner/dealer filter and listing location are gone', async () => {
    await request(t.http).get(`${API}/listings`).query({ sellerType: 'dealer' }).expect(400);
    const s = await dealer();
    const images = await uploadImages(s);
    await request(t.http)
      .post(`${API}/listings`)
      .set(auth(s))
      .send(listingBody(s, images, { location: { city: 'Pune' } }))
      .expect(400);
  });

  it('dealers add, edit and remove branches; nobody else can', async () => {
    const s = await dealer();
    const added = await addBranch(s, { ...BRANCH, phone: '98450 54321' }).expect(201);
    const [main, second] = added.body.sellerProfile.branches;
    expect(main.id).toBe(s.branchId);
    expect(second).toMatchObject({ ...BRANCH, phone: '+919845054321' });

    await addBranch(s, { ...BRANCH, name: '' }).expect(400);
    await addBranch(s, { ...BRANCH, pincode: 'abc' }).expect(400);
    await addBranch(s, { ...BRANCH, lat: 12.9 }).expect(400); // lat needs lng
    await addBranch(s, { ...BRANCH, phone: '12' }).expect(400);

    const edited = await request(t.http)
      .put(`${API}/me/branches/${second.id}`)
      .set(auth(s))
      .send({ ...BRANCH, name: 'Whitefield', locality: '' })
      .expect(200);
    expect(edited.body.sellerProfile.branches[1]).toMatchObject({
      id: second.id,
      name: 'Whitefield',
      locality: null,
      phone: null, // left out of the full update, so it's cleared
    });
    expect(edited.body.sellerProfile.branches[0].id).toBe(main.id);

    const other = await dealer();
    await request(t.http)
      .put(`${API}/me/branches/${second.id}`)
      .set(auth(other))
      .send(BRANCH)
      .expect(404);
    await request(t.http).delete(`${API}/me/branches/${second.id}`).set(auth(other)).expect(404);
    const b = await buyer();
    await addBranch(b).expect(403);
    await request(t.http).post(`${API}/me/branches`).send(BRANCH).expect(401);

    const removed = await request(t.http)
      .delete(`${API}/me/branches/${second.id}`)
      .set(auth(s))
      .expect(200);
    expect(removed.body.sellerProfile.branches.map((x: { id: string }) => x.id)).toEqual([main.id]);

    const last = await request(t.http)
      .delete(`${API}/me/branches/${main.id}`)
      .set(auth(s))
      .expect(409);
    expect(last.body.message).toMatch(/at least one address/);
  });

  it('caps branches at 50, even when added at the same time', async () => {
    const s = await dealer();
    const users = t.app.get(UsersService);
    const id = new Types.ObjectId(s.userId);
    for (let i = 0; i < 47; i++) await users.addBranch(id, { ...BRANCH, name: `B${i}` });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => addBranch(s, { ...BRANCH, name: `Race ${i}` })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 409, 409, 409]);
    const me = await request(t.http).get(`${API}/me`).set(auth(s)).expect(200);
    expect(me.body.sellerProfile.branches).toHaveLength(50);
  });

  it('a car takes its location from the branch, and only your own branches work', async () => {
    const s = await dealer();
    const second = (await addBranch(s).expect(201)).body.sellerProfile.branches[1].id;
    const id = await list(s, { branchId: second });
    expect(await owned(s, id)).toMatchObject({
      branchId: second,
      location: { branchName: BRANCH.name, addressLine: BRANCH.addressLine, pincode: '560066' },
    });

    const images = await uploadImages(s);
    const other = await dealer();
    for (const branchId of [other.branchId, new Types.ObjectId().toString()]) {
      const res = await request(t.http)
        .post(`${API}/listings`)
        .set(auth(s))
        .send(listingBody(s, images, { branchId }))
        .expect(400);
      expect(res.body.message).toMatch(/your branches/);
    }
    for (const branchId of [undefined, 'not-an-id']) {
      await request(t.http)
        .post(`${API}/listings`)
        .set(auth(s))
        .send(listingBody(s, images, { branchId }))
        .expect(400);
    }

    // Moving a car to another branch.
    await request(t.http)
      .patch(`${API}/listings/${id}`)
      .set(auth(s))
      .send({ branchId: other.branchId })
      .expect(400);
    const moved = await request(t.http)
      .patch(`${API}/listings/${id}`)
      .set(auth(s))
      .send({ branchId: s.branchId })
      .expect(200);
    expect(moved.body.branchName).toBe('Main branch');
    expect(await owned(s, id)).toMatchObject({
      branchId: s.branchId,
      location: { ...ADDRESS, branchName: 'Main branch' },
    });
  });

  it('editing a branch updates the cars there and leaves other branches alone', async () => {
    const s = await dealer();
    const second = (await addBranch(s).expect(201)).body.sellerProfile.branches[1].id;
    const atSecond = await list(s, { branchId: second });
    const atMain = await list(s);

    await request(t.http)
      .put(`${API}/me/branches/${second}`)
      .set(auth(s))
      .send({
        ...BRANCH,
        name: 'Pune showroom',
        city: 'Pune City',
        state: 'Maharashtra',
        lat: 18.5,
        lng: 73.8,
      })
      .expect(200);
    expect(await owned(s, atSecond)).toMatchObject({
      location: { branchName: 'Pune showroom', city: 'Pune City', lat: 18.5, lng: 73.8 },
    });
    expect((await owned(s, atMain)).location).toMatchObject(ADDRESS);

    const search = await request(t.http)
      .get(`${API}/listings`)
      .query({ city: 'pune-city' })
      .expect(200);
    expect(search.body.items.map((i: { id: string }) => i.id)).toEqual([atSecond]);
    const near = await request(t.http)
      .get(`${API}/listings`)
      .query({ lat: 18.5, lng: 73.8, radiusKm: 5 })
      .expect(200);
    expect(near.body.items.map((i: { id: string }) => i.id)).toEqual([atSecond]);

    // Taking the location away removes it from the car too.
    await request(t.http).put(`${API}/me/branches/${second}`).set(auth(s)).send(BRANCH).expect(200);
    expect((await owned(s, atSecond)).location).toMatchObject({
      city: 'Bengaluru',
      lat: null,
      lng: null,
    });
  });

  it('a branch with cars that can still go live cannot be removed', async () => {
    const s = await dealer();
    const second = (await addBranch(s).expect(201)).body.sellerProfile.branches[1].id;
    const remove = () => request(t.http).delete(`${API}/me/branches/${second}`).set(auth(s));
    const live = await list(s, { branchId: second });
    const draft = await list(s, { branchId: second, publish: false });

    const blocked = await remove().expect(409);
    expect(blocked.body.message).toBe('Move or remove the 2 cars at this branch first');

    await request(t.http).post(`${API}/listings/${live}/mark-sold`).set(auth(s)).expect(200);
    const one = await remove().expect(409);
    expect(one.body.message).toBe('Move or remove the car at this branch first');

    await request(t.http)
      .patch(`${API}/listings/${draft}`)
      .set(auth(s))
      .send({ branchId: s.branchId })
      .expect(200);
    await remove().expect(200);

    // The sold car still shows where it was.
    expect((await owned(s, live)).location.branchName).toBe(BRANCH.name);
  });

  it('removing the main branch makes the next one main', async () => {
    const s = await dealer();
    const second = (await addBranch(s).expect(201)).body.sellerProfile.branches[1].id;
    const id = await list(s, { branchId: second });
    await request(t.http).delete(`${API}/me/branches/${s.branchId}`).set(auth(s)).expect(200);

    const profile = await request(t.http).get(`${API}/sellers/${s.userId}`).expect(200);
    expect(profile.body.branches.map((b: { id: string }) => b.id)).toEqual([second]);
    expect((await request(t.http).get(`${API}/listings/${id}`).expect(200)).body.branchId).toBe(
      second,
    );
  });

  it('buyers see every branch address publicly, but no phone numbers', async () => {
    const s = await dealer();
    await addBranch(s, { ...BRANCH, phone: '9845054322' }).expect(201);
    const id = await list(s);

    const profile = await request(t.http).get(`${API}/sellers/${s.userId}`).expect(200);
    expect(profile.body).toMatchObject({
      businessName: 'Sharma Motors',
      city: 'Bengaluru',
      branches: [
        { name: 'Main branch', ...ADDRESS },
        { name: BRANCH.name, addressLine: BRANCH.addressLine },
      ],
    });
    const detail = await request(t.http).get(`${API}/listings/${id}`).expect(200);
    expect(detail.body.location).toMatchObject(ADDRESS);
    for (const body of [profile.body, detail.body]) {
      expect(JSON.stringify(body)).not.toMatch(/phone|\+91/);
    }
    expect(profile.body.type).toBeUndefined();
    expect(detail.body.seller.type).toBeUndefined();
  });

  it("an inquiry gets the branch's number, or the dealer's when the branch has none", async () => {
    const s = await dealer();
    const me = await request(t.http).get(`${API}/me`).set(auth(s)).expect(200);
    const second = (await addBranch(s, { ...BRANCH, phone: '9845054323' }).expect(201)).body
      .sellerProfile.branches[1].id;
    const b = await buyer();
    const inquire = (listingId: string) =>
      request(t.http).post(`${API}/leads`).set(auth(b)).send({ listingId }).expect(201);

    const atBranch = await inquire(await list(s, { branchId: second }));
    expect(atBranch.body.seller).toMatchObject({
      businessName: 'Sharma Motors',
      phone: '+919845054323',
    });
    expect(atBranch.body.listing).toMatchObject({
      branchName: BRANCH.name,
      address: '4, ITPL Main Road, Whitefield, Bengaluru, Karnataka, 560066',
    });

    const atMain = await inquire(await list(s));
    expect(atMain.body.seller.phone).toBe(me.body.phone);
    expect(atMain.body.listing.branchName).toBe('Main branch');

    const inbox = await request(t.http).get(`${API}/leads/received`).set(auth(s)).expect(200);
    expect(
      inbox.body.items.map((l: { listing: { branchName: string } }) => l.listing.branchName),
    ).toEqual(['Main branch', BRANCH.name]);
  });

  it('a dealer from before addresses keeps working, and their cars join their first branch', async () => {
    const s = await dealer();
    const users = t.connection.collection('users');
    const listings = t.connection.collection('listings');
    const _id = new Types.ObjectId(s.userId);
    const id = await list(s);
    // Old shape: no branches on the dealer, no branch or address on the car.
    await users.updateOne({ _id }, { $unset: { 'sellerProfile.branches': 1 } });
    await listings.updateOne(
      { _id: new Types.ObjectId(id) },
      { $unset: { branch: 1, 'location.branchName': 1, 'location.addressLine': 1 } },
    );
    await t.app.get(CacheService).del(`seller:${s.userId}`, `listing:${id}`);

    const me = await request(t.http).get(`${API}/me`).set(auth(s)).expect(200);
    expect(me.body.sellerProfile.branches).toEqual([]);
    expect(
      (await request(t.http).get(`${API}/sellers/${s.userId}`).expect(200)).body,
    ).toMatchObject({ city: null, branches: [] });
    expect(await owned(s, id)).toMatchObject({
      branchId: null,
      location: { branchName: null, addressLine: null, city: 'Bengaluru' },
    });

    const b = await buyer();
    const lead = await request(t.http)
      .post(`${API}/leads`)
      .set(auth(b))
      .send({ listingId: id })
      .expect(201);
    expect(lead.body.seller.phone).toBe(me.body.phone);

    // They can't list another car until they have an address.
    const images = await uploadImages(s);
    await request(t.http)
      .post(`${API}/listings`)
      .set(auth(s))
      .send(listingBody(s, images))
      .expect(400);

    const added = await addBranch(s).expect(201);
    expect(await owned(s, id)).toMatchObject({
      branchId: added.body.sellerProfile.branches[0].id,
      location: { branchName: BRANCH.name, addressLine: BRANCH.addressLine },
    });
  });

  it('admins, who have no dealership, get a clear error', async () => {
    const adminEmail = 'branch-admin@example.com';
    await t.app.get(UsersService).create({
      name: 'Admin',
      email: adminEmail,
      phone: nextPhone(),
      passwordHash: await t.app.get(AuthService).hashPassword('Passw0rd!'),
      role: Role.Admin,
    });
    const login = await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: adminEmail, password: 'Passw0rd!' })
      .expect(200);
    const res = await request(t.http)
      .post(`${API}/me/branches`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send(BRANCH)
      .expect(400);
    expect(res.body.message).toMatch(/dealer profile/);
    await t.connection.collection('users').deleteOne({ email: adminEmail }); // other tests count admins
  });

  it('business names sync to listings, and buyers cannot set one', async () => {
    const s = await dealer();
    const id = await list(s);
    await request(t.http)
      .patch(`${API}/me`)
      .set(auth(s))
      .send({ sellerProfile: { businessName: 'New Name Motors' } })
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect((await owned(s, id)).seller.businessName).toBe('New Name Motors');

    for (const sellerProfile of [{ businessName: '' }, { city: 'Pune' }]) {
      await request(t.http).patch(`${API}/me`).set(auth(s)).send({ sellerProfile }).expect(400);
    }
    const b = await buyer();
    await request(t.http)
      .patch(`${API}/me`)
      .set(auth(b))
      .send({ sellerProfile: { businessName: 'X' } })
      .expect(400);
  });
});

describe('search performance', () => {
  let buyer: Session;
  let listings: Model<Listing>;

  beforeAll(async () => {
    listings = t.app.get(getModelToken(Listing.name));
    const seller = await register(sellerBody('bulk-dealer@example.com'));
    buyer = await register({
      name: 'Perf',
      email: 'perf@example.com',
      phone: nextPhone(),
      password: 'Passw0rd!',
    });

    const base = Date.now();
    const models = [
      ['hyundai', 'Hyundai', 'creta', 'Creta', 'suv'],
      ['hyundai', 'Hyundai', 'i20', 'i20', 'hatchback'],
      ['tata', 'Tata', 'nexon', 'Nexon', 'suv'],
    ] as const;
    await listings.insertMany(
      Array.from({ length: 75 }, (_, i) => {
        const [makeSlug, make, modelSlug, model, bodyType] = models[i % 3];
        return {
          seller: new Types.ObjectId(seller.userId),
          sellerSnapshot: {
            name: 'Bulk',
            businessName: 'Bulk Cars',
            city: 'Pune',
            verified: true,
          },
          title: `${2015 + (i % 8)} ${make} ${model}`,
          make,
          makeSlug,
          model,
          modelSlug,
          year: 2015 + (i % 8),
          kmDriven: 10_000 + i * 1000,
          fuelType: i % 2 ? 'diesel' : 'petrol',
          transmission: i % 4 ? 'manual' : 'automatic',
          bodyType,
          ownerCount: 1 + (i % 3),
          price: 400_000 + (i % 10) * 50_000, // many ties -> exercises the _id tie-breaker
          location: { city: i % 2 ? 'Pune' : 'Mumbai', citySlug: i % 2 ? 'pune' : 'mumbai' },
          coverThumbUrl: 'http://localhost/thumb.webp',
          images: [],
          status: ListingStatus.Active,
          publishedAt: new Date(base - i * 60_000),
          expiresAt: new Date(base + 30 * 86_400_000),
        };
      }),
    );
  });

  it('keyset pagination visits every result once, in order, including ties', async () => {
    const seen: { id: string; price: number }[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: request.Response = await request(t.http)
        .get(`${API}/listings`)
        .query({ make: 'hyundai', sort: 'price_asc', limit: 7, ...(cursor ? { cursor } : {}) })
        .expect(200);
      if (pages === 0) expect(res.body.total).toBe(50);
      else expect(res.body.total).toBeUndefined(); // counted once, not per page
      seen.push(...res.body.items);
      cursor = res.body.nextCursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(8);
    expect(new Set(seen.map((s) => s.id)).size).toBe(50);
    const prices = seen.map((s) => s.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    await request(t.http).get(`${API}/listings`).query({ cursor: 'garbage' }).expect(400);
  });

  it('filters combine correctly', async () => {
    const res = await request(t.http)
      .get(`${API}/listings`)
      .query({
        city: 'pune',
        fuel: 'diesel',
        body: 'suv',
        minPrice: 450000,
        maxPrice: 700000,
        limit: 50,
      })
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.city).toBe('Pune');
      expect(item.fuelType).toBe('diesel');
      expect(item.price).toBeGreaterThanOrEqual(450000);
      expect(item.price).toBeLessThanOrEqual(700000);
    }
    await request(t.http).get(`${API}/listings`).query({ minPrice: 5, maxPrice: 1 }).expect(400);

    const facets = await request(t.http)
      .get(`${API}/listings/facets`)
      .query({ city: 'pune' })
      .expect(200);
    expect(facets.body.makes.map((m: { slug: string }) => m.slug).sort()).toEqual([
      'hyundai',
      'tata',
    ]);
  });

  it('no N+1: query count is constant regardless of page size', async () => {
    const run = (limit: number, cursor?: string) =>
      t.countQueries(() =>
        request(t.http)
          .get(`${API}/listings`)
          .query({ limit, sort: 'newest', fuel: 'petrol', ...(cursor ? { cursor } : {}) })
          .set(auth(buyer))
          .expect(200),
      );

    // First page: listings find + capped count (aggregate) + ONE batched favourites lookup.
    const small = await run(2);
    expect(small.result.body.items).toHaveLength(2);
    expect([...small.commands].sort()).toEqual([
      'aggregate:listings',
      'find:favorites',
      'find:listings',
    ]);

    // 15x the rows, same number of queries (and the count is now served from cache).
    const large = await run(30);
    expect(large.result.body.items).toHaveLength(30);
    expect([...large.commands].sort()).toEqual(['find:favorites', 'find:listings']);

    // Later pages never re-count.
    const next = await run(30, large.result.body.nextCursor);
    expect([...next.commands].sort()).toEqual(['find:favorites', 'find:listings']);
  });

  it('search queries are served by indexes (no collection scans)', async () => {
    const service = t.app.get(
      (await import('../src/modules/listings/listings.service')).ListingsService,
    );
    const cases = [
      { sort: { publishedAt: -1, _id: -1 }, query: {} },
      { sort: { price: 1, _id: 1 }, query: { city: 'pune', minPrice: 400000 } },
      { sort: { price: -1, _id: -1 }, query: { make: ['hyundai'], model: ['creta'] } },
      { sort: { publishedAt: -1, _id: -1 }, query: { body: ['suv'] } },
    ];
    for (const c of cases) {
      const filter = service.buildSearchFilter({ limit: 20, sort: 'newest', ...c.query } as never);
      const explain = (await listings
        .find(filter)
        .sort(c.sort as never)
        .limit(21)
        .explain('queryPlanner')) as unknown as {
        queryPlanner: { winningPlan: unknown };
      };
      const plan = JSON.stringify(explain.queryPlanner.winningPlan);
      expect(plan).toContain('IXSCAN');
      expect(plan).not.toContain('COLLSCAN');
      expect(plan).not.toContain('"stage":"SORT"'); // sort satisfied by the index, not in memory
    }
  });
});

describe('admin', () => {
  let admin: Session;
  let seller: Session;
  let listingId: string;

  beforeAll(async () => {
    const users = t.app.get(UsersService);
    const authService = t.app.get(AuthService);
    await users.create({
      name: 'Admin',
      email: 'admin@example.com',
      phone: nextPhone(),
      passwordHash: await authService.hashPassword('Adm1nPassw0rd'),
      role: Role.Admin,
    });
    const res = await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: 'admin@example.com', password: 'Adm1nPassw0rd' })
      .expect(200);
    admin = { token: res.body.accessToken, refreshToken: '', userId: res.body.user.id };

    seller = await register(sellerBody('moderated@example.com'));
    const images = await uploadImages(seller);
    listingId = (
      await request(t.http)
        .post(`${API}/listings`)
        .set(auth(seller))
        .send(listingBody(seller, images))
        .expect(201)
    ).body.id;
  });

  it('is admin-only', async () => {
    await request(t.http).get(`${API}/admin/stats`).set(auth(seller)).expect(403);
    const stats = await request(t.http).get(`${API}/admin/stats`).set(auth(admin)).expect(200);
    expect(stats.body.users.admin).toBe(1);
  });

  it('verifies sellers and syncs the snapshot onto their listings', async () => {
    await request(t.http)
      .patch(`${API}/admin/users/${seller.userId}/verification`)
      .set(auth(admin))
      .send({ verified: true })
      .expect(200);
    const mine = await request(t.http).get(`${API}/listings/mine`).set(auth(seller)).expect(200);
    expect(mine.body.items[0].seller.verified).toBe(true);
  });

  it('approves and rejects listings', async () => {
    const listings = t.app.get<Model<Listing>>(getModelToken(Listing.name));
    await listings.updateOne({ _id: listingId }, { $set: { status: ListingStatus.Pending } });
    const queue = await request(t.http)
      .get(`${API}/admin/listings?status=pending`)
      .set(auth(admin))
      .expect(200);
    expect(queue.body.items.map((i: { id: string }) => i.id)).toContain(listingId);

    await request(t.http)
      .post(`${API}/admin/listings/${listingId}/approve`)
      .set(auth(admin))
      .expect(200);
    await request(t.http)
      .post(`${API}/admin/listings/${listingId}/approve`)
      .set(auth(admin))
      .expect(409);
    const rejected = await request(t.http)
      .post(`${API}/admin/listings/${listingId}/reject`)
      .set(auth(admin))
      .send({ reason: 'Photos are not of the actual car' })
      .expect(200);
    expect(rejected.body).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Photos are not of the actual car',
    });

    // Publishing again goes back to review, so a dealer can't undo a take-down with one click.
    const resubmitted = await request(t.http)
      .post(`${API}/listings/${listingId}/publish`)
      .set(auth(seller))
      .expect(200);
    expect(resubmitted.body.status).toBe('pending');
    await request(t.http).get(`${API}/listings/${listingId}`).expect(404);
    await request(t.http)
      .post(`${API}/admin/listings/${listingId}/approve`)
      .set(auth(admin))
      .expect(200);
    await request(t.http).get(`${API}/listings/${listingId}`).expect(200);
  });

  it('a suspended account cannot act while its login is still valid', async () => {
    const dealer = await register(sellerBody('suspended-dealer@example.com'));
    const images = await uploadImages(dealer);
    const id = (
      await request(t.http)
        .post(`${API}/listings`)
        .set(auth(dealer))
        .send(listingBody(dealer, images))
        .expect(201)
    ).body.id;
    const buyer = await register({
      name: 'Suspended',
      email: 'suspended-buyer@example.com',
      phone: nextPhone(),
      password: 'Passw0rd!',
    });
    for (const s of [dealer, buyer]) {
      await request(t.http)
        .patch(`${API}/admin/users/${s.userId}/status`)
        .set(auth(admin))
        .send({ status: 'suspended' })
        .expect(200);
      await request(t.http)
        .post(`${API}/auth/session`)
        .send({ refreshToken: s.refreshToken })
        .expect(401);
    }
    await request(t.http).post(`${API}/listings/${id}/publish`).set(auth(dealer)).expect(403);
    await request(t.http)
      .patch(`${API}/listings/${id}`)
      .set(auth(dealer))
      .send({ price: 900000 })
      .expect(403);
    await request(t.http)
      .post(`${API}/leads`)
      .set(auth(buyer))
      .send({ listingId: listingId })
      .expect(403);
  });

  it('suspending a seller hides listings and ends sessions', async () => {
    await request(t.http).get(`${API}/listings/${listingId}`).expect(200); // now in the API's cache
    await request(t.http)
      .patch(`${API}/admin/users/${seller.userId}/status`)
      .set(auth(admin))
      .send({ status: 'suspended' })
      .expect(200);
    await request(t.http).get(`${API}/listings/${listingId}`).expect(404);
    await request(t.http)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: seller.refreshToken })
      .expect(401);
    await request(t.http)
      .post(`${API}/auth/login`)
      .send({ email: 'moderated@example.com', password: 'Passw0rd!' })
      .expect(403);
  });
});
