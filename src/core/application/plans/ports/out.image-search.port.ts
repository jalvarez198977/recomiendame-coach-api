export const IMAGE_SEARCH_PORT = Symbol('IMAGE_SEARCH_PORT');

export interface ImageSearchPort {
  searchFoodImage(title: string): Promise<string | null>;
}
