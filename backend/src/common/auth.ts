import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: number;
  role: Role;
  name: string;
  email: string;
  shopId?: number;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Không bắt buộc đăng nhập (nhưng vẫn đọc token nếu có). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          include: { shop: { select: { id: true } } },
        });
        if (user && user.status === 'ACTIVE') {
          req.user = { id: user.id, role: user.role, name: user.name, email: user.email, shopId: user.shop?.id } as AuthUser;
        } else if (user && !isPublic) {
          throw new ForbiddenException('Tài khoản đã bị khóa');
        }
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        if (!isPublic) throw new UnauthorizedException('Phiên đăng nhập hết hạn');
      }
    }

    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Vui lòng đăng nhập');

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }
    return true;
  }
}
