/**
 * Test Suite for US #30: Email/Password Login
 * As a user, I want to log in with my email and password so that I can securely access my account.
 */

/* import { POST } from './route';
import { NextRequest } from 'next/server';
import postgres from 'postgres';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('postgres');
jest.mock('bcrypt');

describe('POST /api/auth/login - Email/Password Authentication', () => {
  let mockSql: any;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock postgres connection
    mockSql = jest.fn();
    (postgres as jest.Mock).mockReturnValue(mockSql);
  });

  describe('Successful Login', () => {
    it('should return 200 and user data when credentials are valid', async () => {
      // Arrange
      const validUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123'
      };
      
        mockSql.mockResolvedValue([validUser]); 
       */