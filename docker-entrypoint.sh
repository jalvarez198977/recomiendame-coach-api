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


if ! npx prisma migrate deploy 2>&1; then
  echo "⚠️  Error al aplicar migraciones. Haciendo baseline completo..."
  

  echo "📝 Sincronizando esquema directamente con db push por si la BD está vacía o corrupta..."
  npx prisma db push --accept-data-loss
fi

echo "✅ Migraciones aplicadas correctamente"

# Si definiste seed (package.json -> prisma.seed), descomenta:
# npx prisma db seed || true

echo "🔍 DEBUG: Contenido de la carpeta de templates en producción:"
ls -la /app/dist/src/infrastructure/mailer/templates || echo "⚠️  La carpeta no existe!"

if [ "$NODE_ENV" = "development" ]; then
echo "🚀 Iniciando la aplicación en modo dev (watch)..."
exec npm run start:dev
else
echo "🚀 Iniciando la aplicación en modo prod..."
exec node dist/src/main.js
fi