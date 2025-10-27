import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { handlers } from '@/auth';

const { GET, POST } = handlers;
export { GET, POST };