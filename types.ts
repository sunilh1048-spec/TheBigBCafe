
export interface MenuItem {
  name: string;
  description?: string;
  price: string;
  priceVariant?: { label: string; price: string }[];
  isVeg?: boolean;
  imageUrl?: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
  imageUrl: string;
}
