import { Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { UserPayload } from '../types';
import { getUserPayload } from '../middleware';

export function initPassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (err: Error | null, user?: any) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value || '';
          const avatar = profile.photos?.[0]?.value || '';

          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name: profile.displayName || 'User',
                avatar,
              },
            });
            console.log(`New user created: ${email}`);
          } else {

            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name: profile.displayName || user.name,
                avatar: avatar || user.avatar,
              },
            });
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

function generateToken(user: UserPayload): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function googleLogin(req: Request, res: Response): void {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res);
}

export function googleCallback(req: Request, res: Response): void {
  passport.authenticate('google', { session: false }, (err: Error, user: any) => {
    if (err || !user) {
      console.error('OAuth error:', err?.message);
      return res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
  })(req, res);
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const userPayload = getUserPayload(req);
  if (!userPayload) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userPayload.id },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
}
