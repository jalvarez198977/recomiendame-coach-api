import { Plan } from 'src/core/domain/plans/entities';

export const PlanMapper = {
  toPrismaData(plan: Plan) {
    return {
      userId: plan.userId,
      weekStart: plan.weekStart,
      kcalTarget: plan.macros.kcalTarget,
      protein_g: plan.macros.protein_g,
      carbs_g: plan.macros.carbs_g,
      fat_g: plan.macros.fat_g,
      notes: plan.notes,
      days: {
        create: plan.days.map((d) => ({
          dayIndex: d.dayIndex,
          meals: {
            create: d.meals.map((m) => ({
              slot: m.slot,
              title: m.title,
              prepMinutes: m.prepMinutes ?? null,
              kcal: m.kcal,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              tags: m.tags ?? [],
              instructions: m.instructions ?? null,
              imageUrl: m.imageUrl ?? null,
              ingredients: {
                create: (m.ingredients ?? []).map((i) => ({
                  name: i.name,
                  qty: i.qty ?? null,
                  unit: i.unit ?? null,
                  category: i.category ?? null,
                })),
              },
            })),
          },
        })),
      },
    };
  },

  fromPrisma(p: any): Plan {
    return {
      id: p.id,
      userId: p.userId,
      weekStart: p.weekStart,
      macros: {
        kcalTarget: p.kcalTarget,
        protein_g: p.protein_g,
        carbs_g: p.carbs_g,
        fat_g: p.fat_g,
      },
      notes: p.notes ?? undefined,
      days: (p.days ?? []).map((d: any) => ({
        dayIndex: d.dayIndex,
        meals: (d.meals ?? []).map((m: any) => ({
          id: m.id,
          slot: m.slot,
          title: m.title,
          prepMinutes: m.prepMinutes ?? undefined,
          kcal: m.kcal,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          tags: m.tags ?? [],
          instructions: m.instructions ?? undefined,
          imageUrl: m.imageUrl ?? undefined,
          ingredients: (m.ingredients ?? []).map((i: any) => ({
            name: i.name,
            qty: i.qty ?? undefined,
            unit: i.unit ?? undefined,
            category: i.category ?? undefined,
          })),
        })),
      })),
    };
  },
};
