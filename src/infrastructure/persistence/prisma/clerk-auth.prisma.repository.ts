import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ClerkAuthRepositoryPort,
  ClerkUserRecord,
} from '../../../core/application/auth/ports/out.clerk-auth-repository.port';

const SELECT = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
  clerkId: true,
} as const;

@Injectable()
export class ClerkAuthPrismaRepository implements ClerkAuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkId: string): Promise<ClerkUserRecord | null> {
    const u = await this.prisma.user.findUnique({
      where: { clerkId },
      select: SELECT,
    });
    return u ? this.toRecord(u) : null;
  }

  async findByEmail(email: string): Promise<ClerkUserRecord | null> {
    const u = await this.prisma.user.findUnique({
      where: { email },
      select: SELECT,
    });
    return u ? this.toRecord(u) : null;
  }

  async linkClerkId(userId: string, clerkId: string): Promise<ClerkUserRecord> {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { clerkId },
      select: SELECT,
    });
    return this.toRecord(u);
  }

  async createFromClerk(data: {
    email: string;
    clerkId: string;
    name: string;
    lastName: string;
  }): Promise<ClerkUserRecord> {
    const u = await this.prisma.user.create({
      data: {
        email: data.email,
        clerkId: data.clerkId,
        name: data.name,
        lastName: data.lastName,
        // Sin contraseña — autenticación delegada a Clerk
        password: '',
        emailVerified: true, // Clerk ya verificó el email
        role: 'USER',
        plan: 'FREE',
      },
      select: SELECT,
    });
    return this.toRecord(u);
  }

  private toRecord(u: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    clerkId: string | null;
  }): ClerkUserRecord {
    return {
      id: u.id,
      email: u.email,
      role: u.role as 'USER' | 'ADMIN',
      emailVerified: u.emailVerified,
      clerkId: u.clerkId,
    };
  }
}
