import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/**
 * 可选的 BFF 本机登录口令校验。
 * 若 .env 未设置 BFF_AUTH_TOKEN,则放行(单机个人使用默认不启用)。
 * 启用后,浏览器需在请求头携带 X-Cockpit-Token。
 */
export function bffAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = config.bff.authToken;
  if (!expected) {
    next();
    return;
  }
  const got = req.header('X-Cockpit-Token');
  if (got !== expected) {
    res.status(401).json({ error: 'unauthorized', message: 'BFF token 校验失败' });
    return;
  }
  next();
}
