import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/*
 * VNPay Sandbox (phiên bản API 2.1.0)
 * Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 * Đăng ký tài khoản test: https://sandbox.vnpayment.vn/devreg/ để nhận vnp_TmnCode và vnp_HashSecret.
 */

type Params = Record<string, string>;

function vnDate(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600_000); // GMT+7
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

/** Sắp xếp và mã hóa tham số đúng như mã mẫu của VNPay (khoảng trắng -> "+"). */
function signData(params: Params): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
}

@Injectable()
export class VnpayService {
  private readonly logger = new Logger('VNPay');
  private readonly tmnCode = process.env.VNP_TMN_CODE || '';
  private readonly secret = process.env.VNP_HASH_SECRET || '';
  private readonly url = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  private readonly returnUrl = process.env.VNP_RETURN_URL || 'http://localhost:3000/payment/vnpay-return';

  get configured() {
    return !!this.tmnCode && !!this.secret;
  }

  private hmac(data: string) {
    return crypto.createHmac('sha512', this.secret).update(Buffer.from(data, 'utf-8')).digest('hex');
  }

  createPaymentUrl(opts: { txnRef: string; amount: number; orderInfo: string; ipAddr: string; bankCode?: string }): string {
    if (!this.configured) {
      this.logger.warn('Chưa cấu hình VNP_TMN_CODE / VNP_HASH_SECRET');
    }
    const now = new Date();
    const params: Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: opts.txnRef,
      vnp_OrderInfo: opts.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: String(Math.round(opts.amount) * 100),
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: opts.ipAddr.replace('::ffff:', '') || '127.0.0.1',
      vnp_CreateDate: vnDate(now),
      vnp_ExpireDate: vnDate(new Date(now.getTime() + 15 * 60_000)),
    };
    if (opts.bankCode) params.vnp_BankCode = opts.bankCode;
    const data = signData(params);
    return `${this.url}?${data}&vnp_SecureHash=${this.hmac(data)}`;
  }

  /** Kiểm tra chữ ký của dữ liệu VNPay trả về (Return URL và IPN). */
  verify(query: Params): boolean {
    const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
    void vnp_SecureHashType;
    if (!vnp_SecureHash) return false;
    const vnp: Params = {};
    for (const k of Object.keys(rest)) if (k.startsWith('vnp_')) vnp[k] = String(rest[k]);
    return this.hmac(signData(vnp)).toLowerCase() === String(vnp_SecureHash).toLowerCase();
  }
}
