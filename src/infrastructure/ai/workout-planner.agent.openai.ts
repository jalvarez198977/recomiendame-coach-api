import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { WorkoutPlannerAgentPort } from '../../core/application/workouts/ports/out.workout-planner-agent.port';
import { WorkoutDay } from '../../core/domain/workouts/entities';

// Zod Schemas
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().int().optional(),
  reps: z.string().optional(), // "10-12", "AMRAP", "5"
  weight: z.string().optional(), // "RPE 8", "70%"
  rpe: z.number().int().optional(),
  restSeconds: z.number().int().optional(),
  notes: z.string().optional(),
  muscleGroup: z.string().optional(),
  equipment: z.string().optional(),
  instructions: z.string().optional(), // Paso a paso
  videoQuery: z.string().optional(), // Término de búsqueda para video
});

const DayResponseSchema = z.object({
  dayIndex: z.number().int().min(1).max(7),
  exercises: z.array(ExerciseSchema).min(1), // Reducido de 3 a 1 para ser más flexible
});

const WeekResponseSchema = z.object({
  notes: z.string().optional(),
  days: z.array(DayResponseSchema).min(1).max(7),
});

@Injectable()
export class OpenAIWorkoutPlannerAgent implements WorkoutPlannerAgentPort {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: +(process.env.OPENAI_TIMEOUT_MS ?? 30000),
  });

  private model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  async draftWeekWorkoutPlan({
    userId,
    weekStart,
    userProfile,
    goal,
    daysAvailable,
    environment,
    equipmentImageUrls,
    startDayIndex = 1,
  }: {
    userId: string;
    weekStart: Date;
    userProfile: any;
    goal: string;
    daysAvailable: number;
    environment?: string;
    equipmentImageUrls?: string[];
    startDayIndex?: number;
  }): Promise<{ days: WorkoutDay[]; notes?: string }> {
    try {
      const system = `Eres un entrenador personal experto (Coach de Gym).
      Tu objetivo es crear una rutina semanal de gimnasio personalizada.
      Responde SIEMPRE en español neutro.
      Devuelve únicamente JSON válido (sin bloques de código ni explicaciones).
      El formato de respuesta debe cumplir estrictamente con el esquema solicitado.`;

      // Mapeo de índices a nombres de días
      const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const startDayName = dayNames[startDayIndex];
      const remainingDays = 8 - startDayIndex;

      // Construir el prompt base
      let equipmentContext = '';
      if (equipmentImageUrls && equipmentImageUrls.length > 0) {
        equipmentContext = `
      **EQUIPAMIENTO DISPONIBLE:**
      El usuario ha proporcionado ${equipmentImageUrls.length} imagen(es) de su equipamiento disponible.
      CONTEXTO DE ENTRENAMIENTO: ${environment || 'No especificado (Asumir entorno adecuado a las fotos)'}.
      ⚠️ IMPORTANTE: Analiza las imágenes y genera ejercicios EXCLUSIVAMENTE con el equipamiento visible en las fotos.
      NO incluyas ejercicios que requieran equipamiento que no aparezca en las imágenes.
      Si ves mancuernas, usa ejercicios con mancuernas. Si ves máquinas específicas, úsalas.
      Sé creativo con el equipamiento disponible para cumplir el objetivo del usuario.
      
      **CANTIDAD DE EJERCICIOS:**
      - Genera MÍNIMO 4-6 ejercicios por día de entrenamiento.
      - Incluye ejercicios compuestos y de aislamiento.
      - Varía los ejercicios entre días para trabajar diferentes grupos musculares.
      `;
      } else {
        const env = (environment || 'GYM').toUpperCase();
        if (env === 'HOME') {
           equipmentContext = `
      **ENTORNO: HOME (CASA)**
      El usuario entrena en CASA y NO ha subido fotos de equipamiento.
      Asume entrenamiento con **PESO CORPORAL** (Calistenia básica) y objetos comunes (ej: silla, pared, mochila).
      NO asumas que tiene mancuernas ni barras a menos que se especifique en otro lado.
      Prioriza ejercicios que se puedan hacer en un espacio reducido.
      `;
        } else if (env === 'OUTDOOR') {
           equipmentContext = `
      **ENTORNO: OUTDOOR (AL AIRE LIBRE)**
      El usuario entrena AL AIRE LIBRE (parque, playa, calle).
      Asume entrenamiento con **PESO CORPORAL** y elementos del entorno (bancos, escalones, barras de parque).
      Incluye ejercicios de calistenia, running, sprints, y uso creativo del mobiliario urbano.
      Prioriza ejercicios funcionales que aprovechen el espacio abierto.
      `;
        } else if (env === 'SPORT') {
           equipmentContext = `
      **ENTORNO: SPORT (DEPORTIVO ESPECÍFICO)**
      El usuario entrena para un DEPORTE ESPECÍFICO.
      Enfócate en ejercicios funcionales, pliométricos, y movimientos específicos del deporte.
      Incluye trabajo de agilidad, coordinación, potencia y resistencia deportiva.
      Usa equipamiento deportivo básico (conos, escalera de agilidad, balones medicinales).
      `;
        } else {
           equipmentContext = `
      **ENTORNO: GYM (GIMNASIO)**
      El usuario entrena en un GIMNASIO comercial estándar.
      Asume acceso a: Barras, Discos, Mancuernas, Rack de Sentadilla, Poleas, Máquinas de cables, etc.
      `;
        }
      }

      const userPrompt = `
      Genera una rutina de entrenamiento para la semana del ${weekStart.toISOString().split('T')[0]}.
      
      **Perfil del Usuario:**
      - Objetivo: ${goal}
      - Días disponibles para entrenar: ${daysAvailable}
      - Nivel de experiencia: ${userProfile?.experienceLevel ?? 'Intermedio'}
      - Lesiones/Limitaciones: ${userProfile?.injuries ?? 'Ninguna'}
      
      ${equipmentContext}
      
      **IMPORTANTE - RESTRICCIÓN DE DÍAS:**
      - La rutina debe empezar desde el día ${startDayIndex} (${startDayName}).
      - Solo puedes usar los días desde ${startDayIndex} hasta 7 (Domingo).
      - Quedan ${remainingDays} días disponibles en la semana.
      - Genera exactamente ${daysAvailable} días de entrenamiento usando SOLO dayIndex >= ${startDayIndex}.
      - Ejemplo: Si startDayIndex=2 (Martes), solo puedes usar dayIndex: 2, 3, 4, 5, 6, 7.
      
      **Requisitos:**
      - Genera exactamente ${daysAvailable} días de entrenamiento.
      - Distribuye los días lógicamente desde ${startDayName} en adelante.
      - **IMPORTANTE: Cada día debe tener MÍNIMO 4-6 ejercicios.**
      - Incluye ejercicios compuestos y de aislamiento según el objetivo.
      - Especifica series, repeticiones (rango), y descanso sugerido.
      - **VISUALIZACIÓN:** Para cada ejercicio, incluye:
        - "muscleGroup": Músculo principal (ej: "Pectoral", "Cuádriceps").
        - "equipment": Qué se necesita (ej: "Barra", "Mancuernas", "Máquina").
        - "instructions": Breve explicación paso a paso de la técnica correcta.
        - "videoQuery": Término de búsqueda preciso para encontrar un video tutorial en YouTube (ej: "sentadilla barra alta tecnica").
      
      **Formato JSON esperado:**
      {
        "notes": "Breve consejo o foco para la semana",
        "days": [
          {
            "dayIndex": ${startDayIndex}, // DEBE ser >= ${startDayIndex} y <= 7
            "exercises": [
              { 
                "name": "Sentadilla con barra", 
                "sets": 4, 
                "reps": "6-8", 
                "rpe": 8, 
                "restSeconds": 180, 
                "notes": "Bajar profundo",
                "muscleGroup": "Cuádriceps",
                "equipment": "Barra, Rack",
                "instructions": "1. Coloca la barra en los trapecios. 2. Pies ancho de hombros. 3. Baja controlando...",
                "videoQuery": "sentadilla barra tecnica"
              },
              ...
            ]
          },
          ...
        ]
      }
      `;

      // Construir el mensaje del usuario con o sin imágenes
      const userMessage: any = equipmentImageUrls && equipmentImageUrls.length > 0
        ? {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              ...equipmentImageUrls.map(url => ({
                type: 'image_url',
                image_url: { url, detail: 'high' }
              }))
            ]
          }
        : { role: 'user', content: userPrompt };

      // Usar modelo con vision si hay imágenes
      const modelToUse = equipmentImageUrls && equipmentImageUrls.length > 0
        ? 'gpt-4o'  // GPT-4 Vision
        : this.model;

      console.log('📤 Llamando a OpenAI:', {
        model: modelToUse,
        hasImages: !!(equipmentImageUrls && equipmentImageUrls.length > 0),
        imageCount: equipmentImageUrls?.length || 0,
        imageUrls: equipmentImageUrls,
      });

      const completionParams: any = {
        model: modelToUse,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          userMessage,
        ],
      };

      // Solo agregar response_format si NO hay imágenes
      // GPT-4o con imágenes puede tener problemas con json_object mode
      if (!equipmentImageUrls || equipmentImageUrls.length === 0) {
        completionParams.response_format = { type: 'json_object' };
      }

      const completion = await this.client.chat.completions.create(completionParams);

      console.log('📥 Respuesta de OpenAI recibida:', {
        model: completion.model,
        usage: completion.usage,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      console.log('📄 Respuesta raw de OpenAI (primeros 500 chars):', raw.substring(0, 500));
      
      const json = this.sanitizeToJson(raw);
      console.log('🧹 JSON sanitizado (primeros 500 chars):', json.substring(0, 500));
      
      const parsed = WeekResponseSchema.safeParse(JSON.parse(json));

      if (!parsed.success) {
        console.error('❌ Error de validación Zod:', parsed.error.errors);
        console.error('📄 JSON completo que falló:', json);
        throw new Error(`Error validación JSON Workout: ${JSON.stringify(parsed.error.errors, null, 2)}`);
      }

      // Validar que todos los días generados cumplan con startDayIndex
      const invalidDays = parsed.data.days.filter(d => d.dayIndex < startDayIndex);
      if (invalidDays.length > 0) {
        throw new Error(
          `El agente generó días inválidos. Se esperaban días >= ${startDayIndex}, pero se encontraron: ${invalidDays.map(d => d.dayIndex).join(', ')}`
        );
      }

      const days: WorkoutDay[] = parsed.data.days.map((d) => ({
        dayIndex: d.dayIndex,
        exercises: d.exercises.map((e, idx) => ({
          ...e,
          order: idx,
          videoQuery: e.videoQuery,
        })),
      }));

      return { days, notes: parsed.data.notes };
    } catch (e: any) {
      console.error('❌ WorkoutPlannerAgent error:', {
        message: e.message,
        stack: e.stack,
        response: e.response?.data,
        status: e.response?.status,
      });
      throw new InternalServerErrorException(`WorkoutPlannerAgent error: ${e.message}`);
    }
  }

  private sanitizeToJson(raw: string): string {
    const cleaned = raw.replace(/```json|```/g, '');
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return cleaned.trim();
    return cleaned.slice(first, last + 1).trim();
  }
}
