export interface ClerkUserRecord {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  clerkId: string | null;
}

export interface ClerkAuthRepositoryPort {
  findByClerkId(clerkId: string): Promise<ClerkUserRecord | null>;
  findByEmail(email: string): Promise<ClerkUserRecord | null>;
  linkClerkId(userId: string, clerkId: string): Promise<ClerkUserRecord>;
  createFromClerk(data: {
    email: string;
    clerkId: string;
    name: string;
    lastName: string;
  }): Promise<ClerkUserRecord>;
}

export const CLERK_AUTH_REPOSITORY = Symbol('CLERK_AUTH_REPOSITORY');
