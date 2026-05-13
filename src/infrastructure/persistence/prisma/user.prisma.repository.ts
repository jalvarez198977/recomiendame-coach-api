import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  USER_REPOSITORY,
  UserRecord,
  UserRepositoryPort,
  UserProfile,
} from '../../../core/application/users/ports/out.user-repository.port';
import { UserEntity } from '../../../core/domain/users/entities';

@Injectable()
export class UserPrismaRepository implements UserRepositoryPort {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    id?: string;
    email: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    const u = await this.prisma.user.create({
      data: { id: data.id, email: data.email, password: data.passwordHash },
    });
    return new UserEntity({
      id: u.id,
      email: u.email,
      passwordHash: u.password,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const u = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        emailVerified: true,
      },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.password,
      role: u.role as any,
      emailVerified: u.emailVerified,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u
      ? new UserEntity({
          id: u.id,
          email: u.email,
          passwordHash: u.password,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })
      : null;
  }

  async list(params: { skip?: number; take?: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          password: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      total,
      items: items.map(
        (u) =>
          new UserEntity({
            id: u.id,
            email: u.email,
            passwordHash: u.password,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          }),
      ),
    };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // Métodos para sistema social
  async followUser(followerId: string, followingId: string): Promise<void> {
    await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    return !!follow;
  }

  async getUserProfile(
    userId: string,
    viewerId?: string,
  ): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) return null;

    let isFollowedByMe = false;
    if (viewerId && viewerId !== userId) {
      isFollowedByMe = await this.isFollowing(viewerId, userId);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      followersCount: user._count.following, // Intercambiado: following = usuarios que me siguen
      followingCount: user._count.followers, // Intercambiado: followers = usuarios que yo sigo
      postsCount: user._count.posts,
      isFollowedByMe,
    };
  }

  async searchUsers(
    query: string,
    params: { skip: number; take: number },
    viewerId?: string,
  ): Promise<{ items: UserProfile[]; total: number }> {
    const where = {
      email: {
        contains: query,
        mode: 'insensitive' as const,
      },
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          _count: {
            select: {
              followers: true,
              following: true,
              posts: true,
            },
          },
          // Incluir información de seguimiento si hay viewerId
          followers: viewerId
            ? {
                where: { followerId: viewerId },
                select: { followerId: true },
              }
            : false,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      followersCount: user._count.following, // Intercambiado
      followingCount: user._count.followers, // Intercambiado
      postsCount: user._count.posts,
      isFollowedByMe: viewerId ? user.followers?.length > 0 : undefined,
    }));

    return { items, total };
  }

  async getSuggestedUsers(
    userId: string,
    params: { skip: number; take: number },
  ): Promise<{ items: UserProfile[]; total: number }> {
    // Primero obtener los IDs de usuarios que YO sigo
    const followingIds = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingUserIds = followingIds.map(f => f.followingId);

    // Obtener usuarios que NO sigo y que no soy yo
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // No soy yo
          { id: { notIn: followingUserIds } }, // No los sigo
        ],
      },
      skip: params.skip,
      take: params.take,
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
      orderBy: [
        { posts: { _count: 'desc' } }, // Usuarios con más posts primero
        { followers: { _count: 'desc' } }, // Luego por más seguidores
      ],
    });

    const items = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      followersCount: user._count.following, // Intercambiado
      followingCount: user._count.followers, // Intercambiado
      postsCount: user._count.posts,
      isFollowedByMe: false, // Por definición, estos usuarios NO los sigo
    }));

    return { items, total: items.length };
  }

  async getUserFollowers(
    userId: string,
    params: { skip: number; take: number },
  ): Promise<{ items: UserProfile[]; total: number }> {
    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        skip: params.skip,
        take: params.take,
        include: {
          follower: {
            include: {
              _count: {
                select: {
                  followers: true,
                  following: true,
                  posts: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    const items = follows.map((follow) => ({
      id: follow.follower.id,
      email: follow.follower.email,
      role: follow.follower.role as 'USER' | 'ADMIN',
      emailVerified: follow.follower.emailVerified,
      followersCount: follow.follower._count.following, // Intercambiado
      followingCount: follow.follower._count.followers, // Intercambiado
      postsCount: follow.follower._count.posts,
      isFollowedByMe: true, // Si está en mis seguidores, significa que me sigue (pero no necesariamente que yo lo siga)
    }));

    return { items, total };
  }

  async getUserFollowing(
    userId: string,
    params: { skip: number; take: number },
  ): Promise<{ items: UserProfile[]; total: number }> {
    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        skip: params.skip,
        take: params.take,
        include: {
          following: {
            include: {
              _count: {
                select: {
                  followers: true,
                  following: true,
                  posts: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    const items = follows.map((follow) => ({
      id: follow.following.id,
      email: follow.following.email,
      role: follow.following.role as 'USER' | 'ADMIN',
      emailVerified: follow.following.emailVerified,
      followersCount: follow.following._count.following, // Intercambiado
      followingCount: follow.following._count.followers, // Intercambiado
      postsCount: follow.following._count.posts,
      isFollowedByMe: true, // Si está en mi lista de "following", significa que lo sigo
    }));

    return { items, total };
  }
}
