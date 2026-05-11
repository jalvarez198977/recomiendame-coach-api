import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Limpiar alergias en inglés (las antiguas)
  const oldAllergiesInEnglish = [
    'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish',
    'Sesame', 'Gluten', 'Mustard', 'Lupin'
  ];
  
  await prisma.allergy.deleteMany({
    where: {
      name: {
        in: oldAllergiesInEnglish,
      },
    },
  });
  
  console.log('🗑️  Alergias en inglés eliminadas');

  // Allergies (Alergias más comunes en español)
  const allergies = [
    'Maní (cacahuate)',
    'Frutos secos (nueces, almendras, avellanas)',
    'Leche y lácteos',
    'Huevos',
    'Trigo',
    'Soja',
    'Pescado',
    'Mariscos y crustáceos',
    'Sésamo (ajonjolí)',
    'Gluten',
    'Mostaza',
    'Lupino',
    'Sulfitos',
    'Apio',
    'Altramuces',
    'Moluscos',
    'Kiwi',
    'Melocotón (durazno)',
    'Plátano',
    'Aguacate (palta)',
    'Chocolate',
    'Frutillas (fresas)',
    'Tomate',
    'Cítricos',
    'Ajo',
    'Cebolla',
  ];
  await prisma.allergy.createMany({
    data: allergies.map((name) => ({ name })),
    skipDuplicates: true,
  });

  // Conditions (Condiciones de salud comunes)
  const conditions = [
    { code: 'T2D', label: 'Diabetes tipo 2' },
    { code: 'T1D', label: 'Diabetes tipo 1' },
    { code: 'HTN', label: 'Hipertensión' },
    { code: 'CKD', label: 'Enfermedad renal crónica' },
    { code: 'CEL', label: 'Celiaquía' },
    { code: 'LIP', label: 'Dislipidemia' },
    { code: 'HIP', label: 'Hipotiroidismo' },
    { code: 'HI', label: 'Hipertiroidismo' },
    { code: 'GERD', label: 'Reflujo gastroesofágico' },
    { code: 'IBS', label: 'Síndrome de intestino irritable' },
    { code: 'PCOS', label: 'Síndrome de ovario poliquístico' },
    { code: 'OST', label: 'Osteoporosis' },
    { code: 'ANE', label: 'Anemia' },
    { code: 'GOT', label: 'Gota' },
    { code: 'CRO', label: 'Enfermedad de Crohn' },
    { code: 'UC', label: 'Colitis ulcerosa' },
    { code: 'AST', label: 'Asma' },
    { code: 'HEP', label: 'Hígado graso' },
    { code: 'CAN', label: 'Cáncer (en tratamiento)' },
    { code: 'CVD', label: 'Enfermedad cardiovascular' },
    { code: 'MIG', label: 'Migraña crónica' },
    { code: 'FIB', label: 'Fibromialgia' },
    { code: 'ART', label: 'Artritis' },
    { code: 'GAS', label: 'Gastritis crónica' },
    { code: 'PRE', label: 'Prediabetes' },
  ];
  await prisma.healthCondition.createMany({
    data: conditions,
    skipDuplicates: true,
  });

  // Cuisines
  const cuisines = [
    'Mediterránea','Italiana','Mexicana','India','China','Japonesa',
    'Tailandesa','Chilena','Peruana','Vegetariana','Vegana'
  ];
  await prisma.cuisine.createMany({
    data: cuisines.map((name) => ({ name })),
    skipDuplicates: true,
  });

  // SubscriptionPlans — planes de suscripción (actualiza si ya existen)
  const subscriptionPlans = [
    {
      id: 'monthly',
      label: 'Mensual',
      price: '$6.990',
      period: '/mes',
      badge: null,
      saving: null,
      mercadoPagoPreapprovalPlanId: process.env.MP_PLAN_MONTHLY_ID ?? '',
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'annual',
      label: 'Anual',
      price: '$4.999',
      period: '/mes',
      badge: 'Más popular',
      saving: '$59.988/año · Ahorra 29%',
      mercadoPagoPreapprovalPlanId: process.env.MP_PLAN_ANNUAL_ID ?? '',
      isActive: true,
      sortOrder: 2,
    },
  ];

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      create: plan,
      update: {
        label: plan.label,
        price: plan.price,
        period: plan.period,
        badge: plan.badge,
        saving: plan.saving,
        mercadoPagoPreapprovalPlanId: plan.mercadoPagoPreapprovalPlanId,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
    });
  }

  console.log('✅ Seed de catálogos listo');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
