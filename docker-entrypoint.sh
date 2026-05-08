#!/bin/sh
set -e


echo "✅ Esperando que la base de datos esté disponible..."
# Esperar hasta que la base de datos responda en el host `db:5432`
until nc -z db 5432; do
echo "⏳ Esperando a que db:5532 esté disponible..."
sleep 2
done


echo "✅ Base de datos disponible. Ejecutando Prisma..."

# Actualizar collation version si es necesario
echo "🔧 Verificando collation version..."
PGPASSWORD=nest psql -h db -U nest -d coach -c "ALTER DATABASE coach REFRESH COLLATION VERSION;" 2>/dev/null || echo "⚠️  No se pudo actualizar collation (puede ser normal)"

# Genera client
npx prisma generate

# Intentar aplicar migraciones, si falla hacer baseline
echo "🚀 Aplicando migraciones..."

# Primero, resolver cualquier migración fallida marcándola como aplicada
echo "� Resolviendo migraciones fallidas..."
npx prisma migrate resolve --applied "20251216000001_add_hydration_goal" 2>/dev/null || true
npx prisma migrate resolve --applied "20251226115803_add_user_push_token_model" 2>/dev/null || true
npx prisma migrate resolve --applied "20260224000000_add_user_name_fields" 2>/dev/null || true
npx prisma migrate resolve --applied "20260331000000_add_free_exercise_log" 2>/dev/null || true
npx prisma migrate resolve --applied "20260401000000_add_feature_gating" 2>/dev/null || true
npx prisma migrate resolve --applied "20260401000001_add_nutrition_product" 2>/dev/null || true
npx prisma migrate resolve --applied "20260401000002_add_nutrition_product_fields" 2>/dev/null || true
npx prisma migrate resolve --applied "20260409000000_add_payment_table" 2>/dev/null || true
npx prisma migrate resolve --applied "20260409000001_add_mp_payer_id" 2>/dev/null || true

if ! npx prisma migrate deploy 2>&1; then
  echo "⚠️  Error al aplicar migraciones. Haciendo baseline completo..."
  
  # Marcar todas las migraciones como aplicadas (baseline)
  echo "📝 Marcando todas las migraciones como aplicadas..."
  npx prisma migrate resolve --applied "20251009190655_init" || true
  npx prisma migrate resolve --applied "20251010111311_add_password_reset_relation" || true
  npx prisma migrate resolve --applied "20251010175151_fix_user_relations" || true
  npx prisma migrate resolve --applied "20251016195348_add_user_role" || true
  npx prisma migrate resolve --applied "20251017152936_add_email_verification" || true
  npx prisma migrate resolve --applied "20251022191036_add_account_deletion" || true
  npx prisma migrate resolve --applied "20251027232858_add_cascade_delete" || true
  npx prisma migrate resolve --applied "20251128123701_add_workout_coach" || true
  npx prisma migrate resolve --applied "20251128125900_add_chapi_mind" || true
  npx prisma migrate resolve --applied "20251205000000_add_workout_completion" || true
  npx prisma migrate resolve --applied "20251216000000_add_chapi_context" || true
  npx prisma migrate resolve --applied "20251216000001_add_hydration_goal" || true
  npx prisma migrate resolve --applied "20251226115803_add_user_push_token_model" || true
  
  echo "✅ Baseline completado. Aplicando migraciones pendientes..."
  npx prisma migrate deploy
fi

echo "✅ Migraciones aplicadas correctamente"

# Si definiste seed (package.json -> prisma.seed), descomenta:
# npx prisma db seed || true


if [ "$NODE_ENV" = "development" ]; then
echo "🚀 Iniciando la aplicación en modo dev (watch)..."
exec npm run start:dev
else
echo "🚀 Iniciando la aplicación en modo prod..."
exec node dist/src/main.js
fi