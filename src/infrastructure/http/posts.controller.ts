import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post as PostMethod,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePostUseCase } from '../../core/application/posts/use-cases/create-post.usecase';
import { LikePostUseCase } from '../../core/application/posts/use-cases/like-post.usecase';
import { UnlikePostUseCase } from '../../core/application/posts/use-cases/unlike-post.usecase';
import { DeletePostUseCase } from '../../core/application/posts/use-cases/delete-post.usecase';
import { CreatePostDto } from '../../core/application/posts/dto/create-post.dto';
import { CreateCommentUseCase } from '../../core/application/posts/use-cases/create-comment.usecase';
import { DeleteCommentUseCase } from '../../core/application/posts/use-cases/delete-comment.usecase';
import { ListCommentsUseCase } from '../../core/application/posts/use-cases/list-comments.usecase';
import { CreateCommentDto } from '../../core/application/posts/dto/create-comment.dto';
import { ListCommentsDto } from '../../core/application/posts/dto/list-comments.dto';
import { GetMyFeedUseCase } from '../../core/application/feed/use-cases/get-my-feed.usecase';
import { GetFeedDto } from '../../core/application/feed/dto/get-feed.dto';
import { GetMyPostsUseCase } from '../../core/application/posts/use-cases/get-my-posts.usecase';
import { GetPublicPostsUseCase } from '../../core/application/posts/use-cases/get-public-posts.usecase';
import { PrismaService } from '../database/prisma.service';
import { CloudinaryService } from '../storage/cloudinary.service';
import { multerConfig } from '../storage/multer.config';

@Controller('posts')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PostsController {
  constructor(
    private readonly createPost: CreatePostUseCase,
    private readonly likePost: LikePostUseCase,
    private readonly unlikePost: UnlikePostUseCase,
    private readonly deletePost: DeletePostUseCase,
    private readonly createComment: CreateCommentUseCase,
    private readonly deleteComment: DeleteCommentUseCase,
    private readonly listComments: ListCommentsUseCase,
    private readonly getFeed: GetMyFeedUseCase,
    private readonly getMyPosts: GetMyPostsUseCase,
    private readonly getPublicPosts: GetPublicPostsUseCase,
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Listar posts públicos y de usuarios que sigo
  @Get()
  async listPosts(@Query() q: GetFeedDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.getPublicPosts.execute(userId, { skip: q.skip, take: q.take });
  }

  // Endpoint temporal para debuggear - ver TODOS los posts
  @Get('debug/all')
  async debugAllPosts(@Query() q: GetFeedDto, @Req() req: any) {
    const userId = req.user.userId;

    // Consulta simple: todos los posts sin filtros
    const posts = await this.prisma.post.findMany({
      skip: q.skip,
      take: q.take,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, email: true } },
        media: { select: { url: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId }, select: { userId: true } },
      },
    });

    const items = posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt,
      authorId: p.authorId,
      authorName: p.author.email,
      mediaUrl: p.media?.url || null,
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      isLikedByMe: p.likes.length > 0,
      challengeId: p.challengeId,
      visibility: p.visibility, // Incluimos la visibilidad para debuggear
    }));

    return { items, total: items.length };
  }

  // Feed personalizado (solo usuarios que sigo)
  @Get('following')
  async getFollowingFeed(@Query() q: GetFeedDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.getFeed.execute(userId, q);
  }

  // Listar MIS posts
  @Get('me')
  async listMyPosts(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('date') date?: string,
    @Req() req?: any,
  ) {
    const userId = req.user.userId;
    return this.getMyPosts.execute(userId, {
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
      date,
    });
  }

  // Upload de imagen
  @PostMethod('upload')
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo');
    }

    const result = await this.cloudinaryService.uploadImage(file, 'posts');
    return {
      url: result.url,
      publicId: result.publicId,
    };
  }

  @PostMethod()
  create(@Body() dto: CreatePostDto, @Req() req: any) {
    return this.createPost.execute(req.user.userId, dto);
  }

  @PostMethod(':id/like')
  like(@Param('id') postId: string, @Req() req: any) {
    return this.likePost.execute(req.user.userId, postId);
  }

  @Delete(':id/like')
  unlike(@Param('id') postId: string, @Req() req: any) {
    return this.unlikePost.execute(req.user.userId, postId);
  }

  @PostMethod(':id/comments')
  addComment(
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.createComment.execute(req.user.userId, postId, dto);
  }

  @Get(':id/comments')
  listPostComments(@Param('id') postId: string, @Query() q: ListCommentsDto) {
    return this.listComments.execute(postId, q);
  }

  @Delete(':id/comments/:commentId')
  removeComment(@Param('commentId') commentId: string, @Req() req: any) {
    return this.deleteComment.execute(req.user.userId, commentId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePost(@Param('id') postId: string, @Req() req: any) {
    return this.deletePost.execute(req.user.userId, postId);
  }
}
