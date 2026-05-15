import { Module } from '@nestjs/common';
import { MeProfileController } from '../infrastructure/http/me.profile.controller';

import { GetMyProfileUseCase } from '../core/application/profile/use-cases/get-my-profile.usecase';
import { UpdateMyProfileUseCase } from '../core/application/profile/use-cases/update-my-profile.usecase';
import { UpdateMyPreferencesUseCase } from '../core/application/profile/use-cases/update-my-preferences.usecase';
import { UploadAvatarUseCase } from '../core/application/profile/use-cases/upload-avatar.usecase';
import { ListTaxonomiesUseCase } from '../core/application/profile/use-cases/list-taxonomies.usecase'; // 👈

import { PROFILE_REPO } from '../core/application/profile/ports/out.profile-repo.port';
import { TAXONOMY_REPO } from '../core/application/profile/ports/out.taxonomy-repo.port';
import { ProfilePrismaRepository } from '../infrastructure/persistence/prisma/profile.prisma.repository';
import { PrismaModule } from 'src/infrastructure/database/prisma.module';
import { TaxonomiesModule } from './taxonomies.module';
import { StorageModule } from '../infrastructure/storage/storage.module';



@Module({
  imports: [PrismaModule, TaxonomiesModule, StorageModule],
  controllers: [MeProfileController],
  providers: [
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    UpdateMyPreferencesUseCase,
    UploadAvatarUseCase,
    ListTaxonomiesUseCase,
    { provide: PROFILE_REPO, useClass: ProfilePrismaRepository },
  ],
  exports: [
    { provide: PROFILE_REPO, useClass: ProfilePrismaRepository },
  ],
})
export class ProfileModule {}
