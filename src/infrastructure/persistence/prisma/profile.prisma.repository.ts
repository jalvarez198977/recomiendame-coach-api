import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PROFILE_REPO, ProfileRepoPort } from '../../../core/application/profile/ports/out.profile-repo.port';


type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
type NutritionGoal = 'LOSE_WEIGHT' | 'GAIN_WEIGHT' | 'MAINTAIN_WEIGHT' | 'GAIN_MUSCLE' | 'IMPROVE_HEALTH';
type TimeFrame = 'ONE_MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS' | 'ONE_YEAR' | 'LONG_TERM';
type Intensity = 'LOW' | 'MODERATE' | 'HIGH';

type UpdatePatch = {
  name?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  sex?: string;                 // "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED"
  birthDate?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: string;       // "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE"
  country?: string | null;
  budgetLevel?: number | null;
  cookTimePerMeal?: number | null;
  nutritionGoal?: string;
  targetWeightKg?: number | null;
  timeFrame?: string;
  intensity?: string;
  currentMotivation?: string | null;
};

function toSexEnum(value?: string): Sex | null | undefined {
  if (value === undefined) return undefined;      // no actualizar
  if (value === null || value === '') return null;
  const allowed: Record<string, Sex> = {
    MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER', UNSPECIFIED: 'UNSPECIFIED',
  };
  const v = allowed[value.toUpperCase()];
  if (!v) throw new BadRequestException(`sex inválido: ${value}`);
  return v;
}

function toActivityEnum(value?: string): ActivityLevel | null | undefined {
  if (value === undefined) return undefined;      // no actualizar
  if (value === null || value === '') return null;
  const allowed: Record<string, ActivityLevel> = {
    SEDENTARY: 'SEDENTARY',
    LIGHT: 'LIGHT',
    MODERATE: 'MODERATE',
    ACTIVE: 'ACTIVE',
    VERY_ACTIVE: 'VERY_ACTIVE',
  };
  const v = allowed[value.toUpperCase()];
  if (!v) throw new BadRequestException(`activityLevel inválido: ${value}`);
  return v;
}

function toNutritionGoalEnum(value?: string): NutritionGoal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const allowed: Record<string, NutritionGoal> = {
    LOSE_WEIGHT: 'LOSE_WEIGHT',
    GAIN_WEIGHT: 'GAIN_WEIGHT',
    MAINTAIN_WEIGHT: 'MAINTAIN_WEIGHT',
    GAIN_MUSCLE: 'GAIN_MUSCLE',
    IMPROVE_HEALTH: 'IMPROVE_HEALTH',
  };
  const v = allowed[value.toUpperCase()];
  if (!v) throw new BadRequestException(`nutritionGoal inválido: ${value}`);
  return v;
}

function toTimeFrameEnum(value?: string): TimeFrame | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  
  // Mapeo flexible para aceptar tanto los valores del DTO como los del Enum de Prisma
  const allowed: Record<string, TimeFrame> = {
    '1_MONTH': 'ONE_MONTH',
    '3_MONTHS': 'THREE_MONTHS',
    '6_MONTHS': 'SIX_MONTHS',
    '1_YEAR': 'ONE_YEAR',
    'LONG_TERM': 'LONG_TERM',
    // Fallback por si llega en formato Prisma
    'ONE_MONTH': 'ONE_MONTH',
    'THREE_MONTHS': 'THREE_MONTHS',
    'SIX_MONTHS': 'SIX_MONTHS',
    'ONE_YEAR': 'ONE_YEAR',
  };
  const v = allowed[value.toUpperCase()];
  if (!v) throw new BadRequestException(`timeFrame inválido: ${value}`);
  return v;
}

function toIntensityEnum(value?: string): Intensity | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const allowed: Record<string, Intensity> = {
    LOW: 'LOW',
    MODERATE: 'MODERATE',
    HIGH: 'HIGH',
  };
  const v = allowed[value.toUpperCase()];
  if (!v) throw new BadRequestException(`intensity inválido: ${value}`);
  return v;
}

@Injectable()
export class ProfilePrismaRepository implements ProfileRepoPort {
  constructor(private prisma: PrismaService) {}

  /**
   * Devuelve el perfil + preferencias (alergias, condiciones, cocinas),
   * leyendo el perfil de UserProfile y las listas desde tablas pivot por userId.
   */
  async get(userId: string) {
    const [user, p, ua, uc, up] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastName: true, avatarUrl: true } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.userAllergy.findMany({ where: { userId }, include: { allergy: true } }),
      this.prisma.userCondition.findMany({ where: { userId }, include: { condition: true } }),
      this.prisma.userCuisinePreference.findMany({ where: { userId }, include: { cuisine: true } }),
    ]);

    return {
      userId,
      name: user?.name ?? null,
      lastName: user?.lastName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      sex: p?.sex ?? null,
      birthDate: p?.birthDate ?? null,
      heightCm: p?.heightCm ?? null,
      weightKg: p?.weightKg != null ? Number(p.weightKg) : null,
      activityLevel: p?.activityLevel ?? null,
      country: p?.country ?? null,
      budgetLevel: p?.budgetLevel ?? null,
      cookTimePerMeal: p?.cookTimePerMeal ?? null,
      nutritionGoal: p?.nutritionGoal ?? null,
      targetWeightKg: p?.targetWeightKg != null ? Number(p.targetWeightKg) : null,
      timeFrame: p?.timeFrame ?? null,
      intensity: p?.intensity ?? null,
      currentMotivation: p?.currentMotivation ?? null,

      allergies: ua.map(a => ({ id: a.allergyId, name: a.allergy.name })),
      conditions: uc.map(c => ({ id: c.conditionId, code: c.condition.code, label: c.condition.label })),
      cuisinesLike: up.filter(x => x.kind === 'LIKE').map(x => ({ id: x.cuisineId, name: x.cuisine.name })),
      cuisinesDislike: up.filter(x => x.kind === 'DISLIKE').map(x => ({ id: x.cuisineId, name: x.cuisine.name })),
    };
  }

  /**
   * Crea/actualiza los campos base del perfil.
   */
  async update(userId: string, patch: UpdatePatch): Promise<void> {
    const sexEnum = toSexEnum(patch.sex);
    const actEnum = toActivityEnum(patch.activityLevel);
    const goalEnum = toNutritionGoalEnum(patch.nutritionGoal);
    const timeEnum = toTimeFrameEnum(patch.timeFrame);
    const intEnum = toIntensityEnum(patch.intensity);

    // Actualizar campos en la tabla User (name, lastName, avatarUrl)
    if (patch.name !== undefined || patch.lastName !== undefined || patch.avatarUrl !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.lastName !== undefined && { lastName: patch.lastName }),
          // avatarUrl puede ser string (guardar) o null (borrar)
          ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl }),
        },
      });
    }

    // Actualizar UserProfile
    await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        sex:           sexEnum,
        birthDate:     patch.birthDate ? new Date(patch.birthDate) : undefined,
        heightCm:      patch.heightCm ?? undefined,
        weightKg:      patch.weightKg ?? undefined,
        activityLevel: actEnum,
        country:       patch.country ?? undefined,
        budgetLevel:   patch.budgetLevel ?? undefined,
        cookTimePerMeal: patch.cookTimePerMeal ?? undefined,
        nutritionGoal: goalEnum,
        targetWeightKg: patch.targetWeightKg ?? undefined,
        timeFrame:     timeEnum,
        intensity:     intEnum,
        currentMotivation: patch.currentMotivation ?? undefined,
      },
      create: {
        userId,
        sex:           sexEnum ?? null,
        birthDate:     patch.birthDate ? new Date(patch.birthDate) : null,
        heightCm:      patch.heightCm ?? null,
        weightKg:      patch.weightKg ?? null,
        activityLevel: actEnum ?? null,
        country:       patch.country ?? null,
        budgetLevel:   patch.budgetLevel ?? null,
        cookTimePerMeal: patch.cookTimePerMeal ?? null,
        nutritionGoal: goalEnum ?? null,
        targetWeightKg: patch.targetWeightKg ?? null,
        timeFrame:     timeEnum ?? null,
        intensity:     intEnum ?? null,
        currentMotivation: patch.currentMotivation ?? null,
      },
    });
  }

  /**
   * Reemplaza por completo las alergias del usuario (IDs del catálogo Allergy).
   * Valida IDs y asegura existencia de UserProfile.
   */
  async replaceAllergies(userId: string, allergyIds: number[]): Promise<void> {
    // Validación de catálogo
    const valid = await this.prisma.allergy.findMany({
      where: { id: { in: allergyIds } },
      select: { id: true },
    });
    const validIds = new Set(valid.map(a => a.id));
    const unknown = allergyIds.filter(id => !validIds.has(id));
    if (unknown.length) {
      throw new BadRequestException(`Allergy IDs no válidos: ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Asegura que exista la fila del perfil
      await tx.userProfile.upsert({ where: { userId }, update: {}, create: { userId } });

      await tx.userAllergy.deleteMany({ where: { userId } });
      if (allergyIds.length) {
        await tx.userAllergy.createMany({
          data: allergyIds.map(id => ({ userId, allergyId: id })),
          skipDuplicates: true,
        });
      }
    });
  }

  /**
   * Reemplaza por completo las condiciones del usuario (IDs del catálogo HealthCondition).
   * Valida IDs y asegura existencia de UserProfile.
   */
  async replaceConditions(userId: string, conditionIds: number[]): Promise<void> {
    const valid = await this.prisma.healthCondition.findMany({
      where: { id: { in: conditionIds } },
      select: { id: true },
    });
    const validIds = new Set(valid.map(c => c.id));
    const unknown = conditionIds.filter(id => !validIds.has(id));
    if (unknown.length) {
      throw new BadRequestException(`Condition IDs no válidos: ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({ where: { userId }, update: {}, create: { userId } });

      await tx.userCondition.deleteMany({ where: { userId } });
      if (conditionIds.length) {
        await tx.userCondition.createMany({
          data: conditionIds.map(id => ({ userId, conditionId: id })),
          skipDuplicates: true,
        });
      }
    });
  }

  /**
   * Reemplaza por completo preferencias de cocina (like/dislike).
   * Sanea arrays, valida IDs y asegura existencia de UserProfile.
   */
  async replaceCuisinePrefs(userId: string, likeIds: number[], dislikeIds: number[]): Promise<void> {
    // Saneo: convertir a enteros, remover null/NaN/duplicados
    const toInt = (v: any) => (typeof v === 'string' ? parseInt(v, 10) : v);
    const clean = (arr?: any[]) =>
      Array.from(new Set((arr ?? []).map(toInt).filter((x) => Number.isInteger(x) && x > 0))) as number[];

    const likes = clean(likeIds);
    const dislikes = clean(dislikeIds);

    const ids = [...new Set([...likes, ...dislikes])];
    if (ids.length === 0) {
      // Si vacías todo, simplemente borra
      await this.prisma.$transaction(async (tx) => {
        await tx.userProfile.upsert({ where: { userId }, update: {}, create: { userId } });
        await tx.userCuisinePreference.deleteMany({ where: { userId } });
      });
      return;
    }

    // Validación de catálogo
    const valid = await this.prisma.cuisine.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const validIds = new Set(valid.map(c => c.id));
    const unknown = ids.filter(id => !validIds.has(id));
    if (unknown.length) {
      throw new BadRequestException(`Cuisine IDs no válidos: ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({ where: { userId }, update: {}, create: { userId } });

      await tx.userCuisinePreference.deleteMany({ where: { userId } });

      if (likes.length) {
        await tx.userCuisinePreference.createMany({
          data: likes.map(id => ({ userId, cuisineId: id, kind: 'LIKE' })),
          skipDuplicates: true,
        });
      }
      if (dislikes.length) {
        await tx.userCuisinePreference.createMany({
          data: dislikes.map(id => ({ userId, cuisineId: id, kind: 'DISLIKE' })),
          skipDuplicates: true,
        });
      }
    });
  }

  /**
   * Actualiza solo el avatar del usuario.
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<{ avatarUrl: string }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });
    return { avatarUrl: user.avatarUrl! };
  }
}
