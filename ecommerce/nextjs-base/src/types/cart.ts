export interface CartItem {
  /** Strapi numeric id */
  id: number;
  /** Strapi v5 documentId (used for API updates) */
  documentId: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | { type: "ADD_ITEM"; payload: Omit<CartItem, "quantity"> }
  | { type: "REMOVE_ITEM"; payload: { id: number } }
  | { type: "UPDATE_QUANTITY"; payload: { id: number; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "HYDRATE"; payload: CartItem[] };
