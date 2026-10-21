import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // VNPay IPN gọi lại từ máy chủ VNPay nên chỉ giới hạn CORS cho trình duyệt.
  const origins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Render/Proxy: lấy đúng IP người dùng cho vnp_IpAddr.
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Giá Tốt API đang chạy tại http://localhost:${port}/api`);
}
bootstrap();
