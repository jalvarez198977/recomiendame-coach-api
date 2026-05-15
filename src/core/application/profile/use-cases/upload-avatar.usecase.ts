import { Inject, Injectable } from '@nestjs/common';
import { PROFILE_REPO, ProfileRepoPort } from '../ports/out.profile-repo.port';

@Injectable()
export class UploadAvatarUseCase {
  constructor(@Inject(PROFILE_REPO) private readonly repo: ProfileRepoPort) {}

  async execute(userId: string, avatarUrl: string): Promise<{ avatarUrl: string }> {
    return this.repo.updateAvatar(userId, avatarUrl);
  }
}
