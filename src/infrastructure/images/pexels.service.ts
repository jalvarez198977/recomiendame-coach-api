import { Injectable, Logger } from '@nestjs/common';
import { ImageSearchPort } from '../../core/application/plans/ports/out.image-search.port';

/**
 * Servicio para buscar imágenes de comidas en Pexels.
 * Devuelve la URL "large" (940px) de la primera foto relevante,
 * o null si no encuentra nada o la API falla.
 */
@Injectable()
export class PexelsService implements ImageSearchPort {
  private readonly logger = new Logger(PexelsService.name);
  private readonly apiKey = process.env.PEXELS_API_KEY ?? '';
  private readonly baseUrl = 'https://api.pexels.com/v1';

  // Cache en memoria para no repetir búsquedas del mismo término en la misma ejecución
  private readonly cache = new Map<string, string | null>();

  async searchFoodImage(mealTitle: string): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn('PEXELS_API_KEY no configurada, imageUrl será null');
      return null;
    }

    const query = this.buildQuery(mealTitle);
    this.logger.log(`[Pexels] Buscando imagen | título: "${mealTitle}" | query: "${query}"`);

    if (this.cache.has(query)) {
      this.logger.log(`[Pexels] Cache hit para query="${query}" → ${this.cache.get(query)}`);
      return this.cache.get(query)!;
    }

    try {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&locale=es-ES`;
      this.logger.log(`[Pexels] GET ${url}`);

      const response = await fetch(url, {
        headers: { Authorization: this.apiKey },
        signal: AbortSignal.timeout(5000),
      });

      this.logger.log(`[Pexels] HTTP ${response.status} para query="${query}"`);

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`[Pexels] Error ${response.status} | body: ${body}`);
        this.cache.set(query, null);
        return null;
      }

      const data = (await response.json()) as PexelsSearchResponse;
      this.logger.log(`[Pexels] total_results=${data.total_results} | fotos recibidas=${data.photos?.length ?? 0}`);

      const photo = data.photos?.[0];

      if (!photo) {
        this.logger.warn(`[Pexels] Sin resultados para query="${query}", usando fallback`);
        const fallback = await this.fallbackFoodImage();
        this.cache.set(query, fallback);
        return fallback;
      }

      const imageUrl = photo.src.large;
      this.logger.log(`[Pexels] ✅ Imagen encontrada: ${imageUrl}`);
      this.cache.set(query, imageUrl);
      return imageUrl;
    } catch (err: any) {
      this.logger.warn(`[Pexels] Excepción para "${mealTitle}": ${err?.message}`);
      this.cache.set(query, null);
      return null;
    }
  }

  private async fallbackFoodImage(): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/search?query=healthy+food+meal&per_page=5&orientation=landscape`;
      const response = await fetch(url, {
        headers: { Authorization: this.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as PexelsSearchResponse;
      return data.photos?.[0]?.src.large ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Construye un query de búsqueda limpio a partir del título del plato.
   * Ej: "Pollo al limón con verduras salteadas" → "pollo limón verduras"
   */
  private buildQuery(title: string): string {
    const stopWords = new Set([
      'con', 'al', 'a', 'la', 'el', 'los', 'las', 'de', 'del', 'en',
      'y', 'o', 'un', 'una', 'unos', 'unas', 'por', 'para', 'sin',
      'salteado', 'salteadas', 'asado', 'asada', 'cocido', 'cocida',
      'hervido', 'hervida', 'frito', 'frita', 'gratinado', 'gratinada',
    ]);

    const words = title
      .toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/gi, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .slice(0, 4); // máximo 4 palabras clave

    // Siempre añadir "food" al final para mejorar relevancia en Pexels
    return [...words, 'food'].join(' ');
  }
}

// ── Tipos mínimos de la respuesta de Pexels ──────────────────────────────────
interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
}
