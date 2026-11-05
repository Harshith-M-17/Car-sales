export enum Role {
  Buyer = 'buyer',
  Seller = 'seller',
  Admin = 'admin',
}

/** Identity carried by a verified access token. */
export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      id?: string | number | object;
    }
  }
}
