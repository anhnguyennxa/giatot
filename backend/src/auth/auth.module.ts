import { BadRequestException, Body, Controller, Get, Injectable, Module, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

class RegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail({}, { message: 'Email không hợp lệ' }) email!: string;
  @IsString() @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' }) password!: string;
  @IsOptional() @IsString() phone?: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email!: string;
  @IsString() password!: string;
}

class ProfileDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() avatar?: string;
}

class PasswordDto {
  @IsString() oldPassword!: string;
  @IsString() @MinLength(6) newPassword!: string;
}

const PUBLIC_USER = {
  id: true, email: true, phone: true, name: true, role: true, avatar: true, xu: true, createdAt: true,
  shop: { select: { id: true, name: true, status: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private async issue(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_USER });
    return { token: await this.jwt.signAsync({ sub: userId }), user };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('Email đã được sử dụng');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), phone: dto.phone, passwordHash: await bcrypt.hash(dto.password, 10), xu: 100 },
    });
    await this.prisma.notification.create({
      data: { userId: user.id, type: 'PROMO', title: 'Chào mừng đến Giá Tốt', body: 'Bạn được tặng 100 xu. Lưu voucher để mua sắm tiết kiệm hơn!' },
    });
    return this.issue(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (user.status === 'LOCKED') throw new UnauthorizedException('Tài khoản đã bị khóa');
    return this.issue(user.id);
  }

  me(id: number) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: PUBLIC_USER });
  }

  updateProfile(id: number, dto: ProfileDto) {
    return this.prisma.user.update({ where: { id }, data: dto, select: PUBLIC_USER });
  }

  async changePassword(id: number, dto: PasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(dto.oldPassword, user.passwordHash))) throw new BadRequestException('Mật khẩu cũ không đúng');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    return { ok: true };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }
  @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) { return this.auth.updateProfile(u.id, dto); }
  @Post('password') password(@CurrentUser() u: AuthUser, @Body() dto: PasswordDto) { return this.auth.changePassword(u.id, dto); }
}

@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
