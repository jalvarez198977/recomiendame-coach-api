import { Inject, Injectable } from '@nestjs/common';
import { POST_REPOSITORY, PostRepositoryPort } from '../ports/out.post-repository.port';

@Injectable()
export class DeletePostUseCase {
  constructor(@Inject(POST_REPOSITORY) private readonly repo: PostRepositoryPort) {}

  async execute(userId: string, postId: string) {
    return this.repo.delete({ postId, authorId: userId });
  }
}
