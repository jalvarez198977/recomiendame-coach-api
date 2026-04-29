export interface CreatePostResult {
  id: string;
  createdAt: Date;
}

export interface PostItem {
  id: string;
  caption?: string | null;
  createdAt: Date;
  authorId: string;
  authorName?: string;
  mediaUrl?: string | null;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  challengeId?: string | null;
  isAuthorFollowedByMe?: boolean;
}

export interface PostRepositoryPort {
  create(input: { authorId: string; caption?: string; challengeId?: string | null; mediaUrl?: string | null }): Promise<CreatePostResult>;
  like(input: { userId: string; postId: string }): Promise<void>;
  unlike(input: { userId: string; postId: string }): Promise<void>;
  hasLike(input: { userId: string; postId: string }): Promise<boolean>;
  getPostsByUser(userId: string, params: { skip: number; take: number; date?: string }): Promise<{ items: PostItem[]; total: number }>;
  getPublicPosts(userId: string, params: { skip: number; take: number }): Promise<{ items: PostItem[]; total: number }>;
  delete(input: { postId: string; authorId: string }): Promise<void>;
}
export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
