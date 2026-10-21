import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuthGuard, Public } from './common/auth';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule, PrismaService } from './prisma/prisma.service';
import { CacheModule } from './redis/cache.service';
import { SellerModule } from './seller/seller.module';
import { ShippingModule } from './shipping/ghn.module';

@Controller()
class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: 'giatot-api', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
    CacheModule,
    AuthModule,
    CatalogModule,
    AccountModule,
    ShippingModule,
    OrdersModule,
    SellerModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
