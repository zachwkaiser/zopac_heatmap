import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { authConfig } from './auth.config';
import { z } from 'zod';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import type { User } from '@/app/lib/definitions';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'appdb',
  username: 'appuser',
  password: 'devpass',
});

async function getUser(email: string): Promise<User | undefined> {
  try {
    const users = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return users[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],

  callbacks: {
    async session({ session, token, user }) {
      if (token) {
        session.user = {
          id: token.sub ?? '',
          emailVerified: null, 
          name: token.name,
          email: token.email ?? '',
          image: token.picture ?? '',
        };
      }
      return session;
    },

    async jwt({ token, account, profile }) {
      
      if (account && profile) {
        token.name = profile.name;
        token.email = profile.email;
        token.picture = profile.picture;
      }
      return token;
    },
  },
});
