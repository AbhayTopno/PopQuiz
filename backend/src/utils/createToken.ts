import jwt from 'jsonwebtoken';

const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || '';
  const token: string = jwt.sign({ userId }, secret, {
    expiresIn: '7d',
  });

  return token;
};

export default generateToken;
