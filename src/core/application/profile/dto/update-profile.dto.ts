import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export enum SexDto { MALE='MALE', FEMALE='FEMALE', OTHER='OTHER', UNSPECIFIED='UNSPECIFIED' }
export enum ActivityLevelDto { SEDENTARY='SEDENTARY', LIGHT='LIGHT', MODERATE='MODERATE', ACTIVE='ACTIVE', VERY_ACTIVE='VERY_ACTIVE' }
export enum NutritionGoalDto { 
  LOSE_WEIGHT='LOSE_WEIGHT', 
  GAIN_WEIGHT='GAIN_WEIGHT', 
  MAINTAIN_WEIGHT='MAINTAIN_WEIGHT', 
  GAIN_MUSCLE='GAIN_MUSCLE', 
  IMPROVE_HEALTH='IMPROVE_HEALTH' 
}
export enum TimeFrameDto { 
  ONE_MONTH='1_MONTH', 
  THREE_MONTHS='3_MONTHS', 
  SIX_MONTHS='6_MONTHS', 
  ONE_YEAR='1_YEAR', 
  LONG_TERM='LONG_TERM' 
}
export enum IntensityDto { 
  LOW='LOW', 
  MODERATE='MODERATE', 
  HIGH='HIGH' 
}

export class UpdateProfileDto {
  // Información personal
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() lastName?: string;

  // Avatar: acepta string (URL) o null explícito para borrar
  // ValidateIf omite @IsString cuando el valor es null, permitiendo borrar el avatar
  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== null)
  @IsString()
  avatarUrl?: string | null;

  // Campos básicos existentes
  @IsOptional() @IsEnum(SexDto) sex?: SexDto;
  @IsOptional() @IsDateString() birthDate?: string;           // YYYY-MM-DD
  @IsOptional() @IsInt() @Min(80) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(400) weightKg?: number;
  @IsOptional() @IsEnum(ActivityLevelDto) activityLevel?: ActivityLevelDto;
  @IsOptional() country?: string;
  @IsOptional() @IsInt() @Min(0) @Max(3) budgetLevel?: number;
  @IsOptional() @IsInt() @Min(5) @Max(180) cookTimePerMeal?: number;

  // Nuevos campos para personalización de planes
  @IsOptional() @IsEnum(NutritionGoalDto) nutritionGoal?: NutritionGoalDto;
  @IsOptional() @IsNumber() @Min(20) @Max(400) targetWeightKg?: number;
  @IsOptional() @IsEnum(TimeFrameDto) timeFrame?: TimeFrameDto;
  @IsOptional() @IsEnum(IntensityDto) intensity?: IntensityDto;
  @IsOptional() @IsString() currentMotivation?: string;
}
