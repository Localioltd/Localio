export type Product = {
  id: string;
  name: string;
  seller: string;
  price: number;
  mrp: number;
  category: string;
  description: string;
  stock: number;
  image: string | null;
  seller_id?: string;
  active?: boolean;
  tone?: string;
};

export type CartLine = { product: Product; quantity: number };
export type Order = {
  id: string | number;
  order_number?: string;
  created_at?: string;
  status?: string;
  total?: number;
  payment_method?: string;
  order_items?: Array<{ id?: string; product_name?: string; quantity?: number; unit_price?: number; line_total?: number }>;
};
