import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators/auth.decorators';
import { Role } from '../../common/types/auth';
import { TokenService } from './token.service';

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * Verification is a local HMAC check — no database round-trip per request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(req);

    if (token) {
      try {
        req.user = await this.tokens.verifyAccess(token);
      } catch {
        // Public routes degrade to anonymous so an expired token never breaks browsing.
        if (!isPublic) throw new UnauthorizedException('Invalid or expired access token');
      }
    }
    if (!isPublic && !req.user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (user.role === Role.Admin || roles.includes(user.role)) return true;
    throw new ForbiddenException('You do not have access to this resource');
  }
}
