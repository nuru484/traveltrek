import { Request, Response } from 'express';

import { CookieManager } from '../../utils/CookieManager';

const logout = (req: Request, res: Response): void => {
  CookieManager.clearAllTokens(res);
  res.status(200).json({ message: 'Logged out successfully' });
};

export default logout;
