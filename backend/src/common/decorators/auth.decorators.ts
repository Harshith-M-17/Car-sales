import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, Role } from '../types/auth';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/**
 * Route is reachable without a token. If a valid token is sent anyway the
 * user is still resolved, so public endpoints can personalise (e.g. favourites).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts the route to the given roles. Admins are always allowed. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().user,
);
