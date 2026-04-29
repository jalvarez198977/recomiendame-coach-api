import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { POST_REPOSITORY, PostRepositoryPort, CreatePostResult, PostItem } from '../../../core/application/posts/ports/out.post-repository.port';

@Injectable()
export class PostPrismaRepository implements PostRepositoryPort {
  constructor(private prisma: PrismaService) {}

  async create(input: { authorId: string; caption?: string; challengeId?: string | null; mediaUrl?: string | null }): Promise<CreatePostResult> {
    const created = await this.prisma.$transaction(async (tx) => {
      let mediaId: string | undefined;
      if (input.mediaUrl) {
        const m = await tx.mediaAsset.create({
          data: { url: input.mediaUrl },
          select: { id: true },
        });
        mediaId = m.id;
      }
      const p = await tx.post.create({
        data: {
          authorId: input.authorId,
          caption: input.caption ?? null,
          challengeId: input.challengeId ?? null,
          mediaId: mediaId ?? null,
          visibility: 'PUBLIC', // default pública para que todos puedan ver
        },
        select: { id: true, createdAt: true },
      });
      return p;
    });

    return { id: created.id, createdAt: created.createdAt };
  }

  async like(input: { userId: string; postId: string }): Promise<void> {
    await this.prisma.postLike.create({ data: { userId: input.userId, postId: input.postId } });
  }

  async unlike(input: { userId: string; postId: string }): Promise<void> {
    await this.prisma.postLike.delete({ where: { userId_postId: { userId: input.userId, postId: input.postId } } });
  }

  async hasLike(input: { userId: string; postId: string }): Promise<boolean> {
    const r = await this.prisma.postLike.findUnique({ where: { userId_postId: { userId: input.userId, postId: input.postId } } });
    return !!r;
  }

  async delete(input: { postId: string; authorId: string }): Promise<void> {
    // Verificar que el post existe y pertenece al usuario
    const post = await this.prisma.post.findUnique({
      where: { id: input.postId },
      select: { authorId: true },
    });

    if (!post) {
      throw new Error('Post no encontrado');
    }

    if (post.authorId !== input.authorId) {
      throw new Error('No tienes permiso para eliminar este post');
    }

    // Eliminar el post (cascade eliminará likes y comments automáticamente)
    await this.prisma.post.delete({ where: { id: input.postId } });
  }

  async getPostsByUser(userId: string, params: { skip: number; take: number; date?: string }) {
    const where: any = { authorId: userId };
    
    // Filtro por fecha si se proporciona
    if (params.date) {
      const startDate = new Date(params.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      where.createdAt = {
        gte: startDate,
        lt: endDate,
      };
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { 
            select: { 
              id: true, 
              profile: { select: { userId: true } },
              // Verificar si sigo al autor del post
              followers: {
                where: { followerId: userId },
                select: { followerId: true },
              },
            } 
          },
          media: { select: { url: true } },
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId }, select: { userId: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    const items = posts.map(p => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt,
      authorId: p.authorId,
      authorName: p.author.profile?.userId || p.authorId, // Fallback al ID si no hay perfil
      mediaUrl: p.media?.url || null,
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      isLikedByMe: p.likes.length > 0,
      challengeId: p.challengeId,
      isAuthorFollowedByMe: p.authorId === userId ? undefined : p.author.followers.length > 0, // No mostrar para mis propios posts
    }));

    return { items, total };
  }

  async getPublicPosts(userId: string, params: { skip: number; take: number }) {
    // Consulta simplificada: todos los posts públicos + mis posts con cualquier visibilidad
    const where = {
      OR: [
        { visibility: 'PUBLIC' as const }, // Posts públicos de cualquier usuario
        { authorId: userId }, // Mis propios posts (cualquier visibilidad)
        { 
          AND: [
            { visibility: 'FOLLOWERS' as const },
            { 
              author: {
                followers: { some: { followerId: userId } }
              }
            }
          ]
        } // Posts de usuarios que sigo con visibilidad FOLLOWERS
      ]
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { 
            select: { 
              id: true, 
              email: true,
              profile: { select: { userId: true } },
              // Verificar si sigo al autor del post
              followers: {
                where: { followerId: userId },
                select: { followerId: true },
              },
            } 
          },
          media: { select: { url: true } },
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId }, select: { userId: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    const items = posts.map(p => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt,
      authorId: p.authorId,
      authorName: p.author.email, // Usamos email como nombre por ahora
      mediaUrl: p.media?.url || null,
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      isLikedByMe: p.likes.length > 0,
      challengeId: p.challengeId,
      isAuthorFollowedByMe: p.authorId === userId ? undefined : p.author.followers.length > 0, // No mostrar para mis propios posts
    }));

    return { items, total };
  }
}
