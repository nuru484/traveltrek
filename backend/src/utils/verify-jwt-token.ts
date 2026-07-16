import jwt from 'jsonwebtoken';
import { IUser } from 'types/user-profile.types';

export const verifyJwtToken = <T = IUser>(
  token: string,
  secret: string,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as T);
      }
    });
  });
};
