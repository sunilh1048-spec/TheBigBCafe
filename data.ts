
import { MenuCategory } from './types';

export const MENU_DATA: MenuCategory[] = [
  {
    id: 'appetizers',
    title: 'Appetizers',
    imageUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?q=80&w=800',
    items: [
      { name: 'Cheese Sticks (6 Pcs.)', description: 'Mashed Potato, Mozzarella Cheese, Golden Corn', price: '100/-' },
      { name: 'Cheese Balls (6 Pcs.)', description: 'Filled With Mashed Potato, Mint Mayonnaise, Cheese', price: '100/-' },
      { name: 'Cheese Corn Nuggets (6 Pcs.)', description: 'Golden Coin Shaped With Potato, Cheese & Golden Corn', price: '100/-' },
      { name: 'French Fries', description: 'Potato Sticks Fried Until Golden Brown', price: '100/-' },
      { name: 'Cheesy Fries', description: 'Fries Topped With Yummy!!! Cream Cheese', price: '130/-' },
      { name: 'Loaded Fries', description: 'Fries, Wedges, Pops, Topped With Melted Cheese, Golden Corn & Veggies', price: '170/-' },
      { name: 'Italian Cheesy Fries', description: 'French Fries, Topped With Salsa & Cream Cheese', price: '140/-' },
      { name: 'Peri Peri Fries', description: 'Fried Potato Sticks With Peri Peri Seasoning', price: '120/-' },
      { name: 'Onion Rings (8 Pieces)', description: 'Fried Mashed Potato & Onion With Cheese Dip', price: '100/-' },
      { name: 'Fiery Potato / Pops', description: 'Fries, Pan Tossed With Schezwan Sauce, Onions & More...', price: '120/-' },
      { name: 'Potato Pops (15 Pcs.)', description: 'Small Balls Of Diced Potato, Flakes Fried Till Golden Brown', price: '100/-' },
      { name: 'Potato Wedges (12 to 15 Pcs.)', description: 'Half Moon Shaped Potatoes Fried', price: '100/-' },
      { name: 'Peri Peri Wedges', description: 'Half Moon Shaped Potatoes Fried & Seasoned With Peri Peri', price: '120/-' },
      { name: 'Twistato', description: 'A Yummy!!! Spiral Potato Fried And Seasoned', price: '60/-' },
      { name: 'Peri Peri Twistato', description: 'A Yummy!!! Spiral Potato Fried And Seasoned With Peri Peri', price: '70/-' },
      { name: 'Cheese Twistato', description: 'A Yummy!!! Spiral Potato Fried And Seasoned With Cheese Sauce', price: '70/-' },
    ]
  },
  {
    id: 'burgers',
    title: 'Burgers',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800',
    items: [
      { name: 'Veg Burger', description: 'Veg Patty, Mayonnaise, Onions, Tomatoes, Cucumber', price: '80/-' },
      { name: 'Aloo Burger', description: 'Mashed Aloo Patty, Mayonnaise, Onions, Tomatoes, Cucumber', price: '80/-' },
      { name: 'Mexican Burger', description: 'Veg Patty, Jalapeno Sauce, Jalapenos, Onions, Tomatoes, Cucumber', price: '100/-' },
      { name: 'Cheese Pour Burger (With Fries)', description: 'Large Veg Patty, Cheese Sauce, Onions, Tomatoes, Cucumber, Cabbage, Cheese Pour', price: '160/-' },
      { name: 'Big Belly Burger', description: 'Double Veg Patty, Mayonnaise, Two Layers of Cheese, Onions, Tomatoes, Cucumber', price: '140/-' },
      { name: 'Pizza Burger', description: 'Onions, Tomatoes, Capsicum, Golden Corn, Mozzarella Cheese Baked On a Bun', price: '110/-' },
      { name: 'Momo Burger', description: 'Mouth Watering...! Veg Momos, Mayonnaise, Onions & More...', price: '80/-' },
      { name: 'Crunchy Nachos Burger', description: 'Yummy! Veg Patty, Crunchy Nachos, Jalapenos Sauce, Onions, Tomatoes, Cucumber', price: '100/-' },
      { name: 'Paneer Blast Burger', description: 'Yummy! Crunchy Paneer Patty, Onions, Tomatoes, Cucumber', price: '140/-' },
      { name: 'The BuildUp Burger (With Cheese Fries)', description: 'Yummy! Crunchy Paneer Patty, Veg Patty & Aloo Patty & 3 Slice Cheese', price: '200/-' },
    ]
  },
  {
    id: 'maggi',
    title: 'Maggi',
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=800',
    items: [
      { name: 'Plain Maggi', description: 'Maggi, Masala, Chilli Flakes & Nothing Else', price: '65/-' },
      { name: 'Veg Maggi', description: 'Maggi, Carrots, Peas, Spring Onions & Masala', price: '75/-' },
      { name: 'Double The Trouble Maggi', description: 'Maggi, Carrots, Peas, Spring Onions & Double Masala', price: '85/-' },
      { name: 'Butter Garlic Maggi', description: 'Maggi, Chopped Burnt Garlic, Spring Onions & Masala', price: '85/-' },
      { name: 'Pan Fried Maggi', description: 'Maggi Pan Fried, Chopped Garlic, Onions, Tomatoes, Spring Onions & Masala', price: '110/-' },
      { name: 'Schezwan Maggi', description: 'Maggi, Schezwan Sauce, Carrots, Peas, Spring Onions & Masala', price: '80/-' },
      { name: 'Peri Peri Maggi', description: 'Maggi, Carrots, Peas, Peri Peri Sprinkle, Spring Onions & Masala', price: '80/-' },
      { name: 'Cheese Veg Maggi', description: 'Maggi, Carrots, Peas, Cheese, Spring Onions & Masala', price: '90/-' },
      { name: 'Paneer Maggi', description: 'Maggi, Paneer, Carrots, Peas, Spring Onions & Masala', price: '90/-' },
      { name: 'Corn & Cheese Maggi', description: 'Maggi, Sweet Corn, Cheese & Masala', price: '90/-' },
      { name: 'Chilli & Cheese Maggi', description: 'Maggi, Green Chilli, Cheese & Masala', price: '85/-' },
      { name: 'Chilli Oil Maggi', description: 'Maggi, Fried Onions, Very Spicy Chilli Oil & Masala', price: '110/-' },
    ]
  },
  {
    id: 'pasta',
    title: 'Pasta',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800',
    items: [
      { name: 'Mac N Cheese', description: 'Macaroni, Milk, Cheese, Mozzarella Cheese', price: '160/-' },
      { name: 'Red Sauce Pasta', description: 'Penne, Red Sauce, Onions, Capsicum, Baby Corn', price: '160/-' },
      { name: 'White Cheese Sauce Pasta', description: 'Penne, White Cheese Sauce, Carrots, Sweet Corn, Capsicum', price: '160/-' },
      { name: 'Pink Sauce Pasta', description: 'Penne, White Cheese Sauce, Red Sauce, Capsicum, Baby Corn, Onions', price: '160/-' },
      { name: 'Green Sauce Pasta', description: 'Penne, White Cheese Sauce, Spinach, Capsicum, Baby Corn, Onions', price: '160/-' },
      { name: 'Red Twist Pasta', description: 'Penne, Indian Style Sauce, Capsicum, Baby Corn, Onions', price: '160/-' },
      { name: 'Nude Pasta', description: 'Penne, Olive Oil, Veggies & Vegan', price: '160/-' },
    ]
  },
  {
    id: 'pizza',
    title: 'Pizza',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800',
    items: [
      { name: 'Margherita', description: 'Mozzarella Cheese', priceVariant: [{label: 'Small', price: '120/-'}, {label: 'Med', price: '170/-'}, {label: 'Large', price: '300/-'}], price: '' },
      { name: 'Simple Veg Pizza', description: 'Mozzarella Cheese, Onion, Capsicum, Tomato', priceVariant: [{label: 'Small', price: '130/-'}, {label: 'Med', price: '180/-'}, {label: 'Large', price: '320/-'}], price: '' },
      { name: 'Corn & Cheese Pizza', description: 'Mozzarella Cheese, Sweet Corn', priceVariant: [{label: 'Small', price: '160/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Veggie Paradise Pizza', description: 'Mozzarella Cheese, Onion, Capsicum, Tomato, Sweet Corn', priceVariant: [{label: 'Small', price: '170/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Veggie Delight Pizza', description: 'Mozzarella Cheese, Onion, Capsicum, Tomato, Jalapenos, Black Olives, Sweet Corn', priceVariant: [{label: 'Small', price: '180/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Cottage Cheese Pizza', description: 'Mozzarella Cheese, Onion, Capsicum, Tomato, Paneer', priceVariant: [{label: 'Small', price: '180/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Slices of Hell', description: 'Mozzarella Cheese, Onion, Capsicum, Olives, Jalapeno', priceVariant: [{label: 'Small', price: '180/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Tandoori Paneer Pizza', description: 'Mozzarella Cheese, Onion, Capsicum, Tomato, Tandoori Paneer', priceVariant: [{label: 'Small', price: '180/-'}, {label: 'Med', price: '220/-'}, {label: 'Large', price: '350/-'}], price: '' },
      { name: 'Cheese Blast', description: 'Mozzarella Cheese, Cheese Sauce, Onion, Capsicum, Tomato, Sweet Corn, Jalapenos', priceVariant: [{label: 'Small', price: '220/-'}, {label: 'Med', price: '270/-'}, {label: 'Large', price: '370/-'}], price: '' },
      { name: 'Pizza Sandwich', description: 'Mozzarella Cheese, Chilli Cheese Sauce, Onion, Capsicum, Tomato, Sweet Corn', priceVariant: [{label: 'Small', price: '100/-'}, {label: 'Med', price: '140/-'}], price: '' },
    ]
  },
  {
    id: 'sandwiches',
    title: 'Grilled Sandwiches',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=800',
    items: [
      { name: 'Veg Grilled Sandwich', description: 'Mint Chutney, Mayonnaise, Onion, Tomato, Cucumber, Masalas', priceVariant: [{label: 'White', price: '80/-'}, {label: 'Brown', price: '90/-'}], price: '' },
      { name: 'Aloo Grilled Sandwich', description: 'Mint Chutney, Mayonnaise, Onion, Boiled Aloo, Masalas', priceVariant: [{label: 'White', price: '80/-'}, {label: 'Brown', price: '90/-'}], price: '' },
      { name: 'Tex Mex Grilled Sandwich', description: 'Chilli Cheese, Mayonnaise, Onion, Sweet Corn, Tomato, Cucumber, Masalas', priceVariant: [{label: 'White', price: '110/-'}, {label: 'Brown', price: '120/-'}], price: '' },
      { name: 'Paneer Tikka Grilled', description: 'Onion, Tikka Paneer, Masalas', priceVariant: [{label: 'White', price: '130/-'}, {label: 'Brown', price: '140/-'}], price: '' },
      { name: 'Corn & Cheese Sandwich', description: 'Cheese Sauce, Onion, Golden Corn, Masalas', priceVariant: [{label: 'White', price: '120/-'}, {label: 'Brown', price: '130/-'}], price: '' },
      { name: 'Chilli & Cheese Toast', description: 'Cheese, Onions, Green Chilli, Toast', priceVariant: [{label: 'White', price: '100/-'}, {label: 'Brown', price: '110/-'}], price: '' },
      { name: 'Cheese Temptation Sandwich', description: 'Cheese, Onion, Golden Corn, Paneer Tikka, Masalas', price: '200/-' },
    ]
  },
  {
    id: 'momos',
    title: 'Momos',
    imageUrl: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b4?q=80&w=800',
    items: [
      { name: 'Veg Momo', description: 'Cabbage, Carrot, Onions, Corn, Ginger, Garlic', priceVariant: [{label: '6 Pcs', price: '100/-'}, {label: '10 Pcs', price: '160/-'}], price: '' },
      { name: 'Cheese Corn Momos', description: 'Corn, Cheese, Carrot, Onions, Spring Onion, Garlic', priceVariant: [{label: '6 Pcs', price: '120/-'}, {label: '10 Pcs', price: '200/-'}], price: '' },
      { name: 'Paneer Tikka Momos', description: 'Tikka Paneer, Carrot, Onions, Cabbage, Garlic', priceVariant: [{label: '6 Pcs', price: '120/-'}, {label: '10 Pcs', price: '200/-'}], price: '' },
      { name: 'Peri Peri Pan Fried Momos', description: 'Tikka Paneer, Carrot, Onions, Cabbage, Garlic', priceVariant: [{label: '6 Pcs', price: '130/-'}, {label: '10 Pcs', price: '220/-'}], price: '' },
      { name: 'Alfredo Momos', description: 'Veg Momos & Corn Cheese in Alfredo White Sauce', price: '150/-' },
      { name: 'Schezwan Smoked', description: 'Veg Momos, Smock Tossed Schezwan Sauce', priceVariant: [{label: '6 Pcs', price: '150/-'}, {label: '10 Pcs', price: '220/-'}], price: '' },
    ]
  },
  {
    id: 'rolls',
    title: 'Frankie & Kaati Rolls',
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?q=80&w=800',
    items: [
      { name: 'Veg Frankie', description: 'Capsicum, Onions, Carrots & More...', price: '90/-' },
      { name: 'Baby Corn Frankie', description: 'Capsicum, Onions, Baby Corn, Carrots & More...', price: '100/-' },
      { name: 'Paneer Frankie', description: 'Capsicum, Onions, Paneer, Carrots & More...', price: '100/-' },
      { name: 'Paneer Butter Masala Frankie', description: 'Capsicum, Onions, Paneer, Carrots, Butter & More...', price: '100/-' },
      { name: 'Mushroom Frankie', description: 'Capsicum, Onions, Carrots, Mushroom & More...', price: '100/-' },
      { name: 'Spinach Corn Frankie', description: 'Onions, Spinach, Sweet Corn, Potato & More', price: '100/-' },
      { name: 'Crispy Veg Roll (4 Pcs. Deep Fried)', price: '100/-' },
      { name: 'Veg Katti Roll', description: 'Wheat Paratha, Mashed Potato, Cabbage, Onion, Carrots & Masala', price: '100/-' },
      { name: 'Paneer Katti Roll', description: 'Wheat Paratha, Mashed Potato, Panner Blocks, Cabbage, Onion, Carrots & Masala', price: '120/-' },
    ]
  },
  {
    id: 'mexican',
    title: 'Mexican Delight',
    imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=800',
    items: [
      { name: 'Nachos (With Cheese & Salsa Dip)', description: 'Nacho Chips With Cheese & salsa Dip', price: '100/-' },
      { name: 'Topped Nachos', description: 'With Cheese Sauce, Salsa Sauce, Capsicum, Onions, Tomatoes...', price: '120/-' },
      { name: 'Bean Topped Nachos', description: 'With Cheese Sauce, Baked Beans, Capsicum, Onions, Tomatoes & More...', price: '120/-' },
      { name: 'Loaded Nachos', description: 'Nacho Filled with Cream Cheese, Corn & Olives', price: '170/-' },
      { name: 'Fiesta Potato (15 Pieces)', description: 'Potato Shotz Topped With Veggies & Cheese', price: '150/-' },
      { name: 'Lasagna', description: 'Veggies & Penne Baked in Sauce & Mozzarella', price: '170/-' },
      { name: 'Taco', description: 'Taco Shell Filled With Sauce, Mashed Potatoes, Onions, Tomatoes', price: '70/-' },
      { name: 'Bean Taco', description: 'Taco Shell Filled With Sauce, Mashed Potatoes, Baked Beans, Onions, Tomatoes & Cabbage', price: '80/-' },
      { name: 'Cheese Taco', description: 'Taco Shell Filled With Sauce, Cheese Sauce, Mashed Potatoes, Onions, Tomatoes & Cabbage', price: '80/-' },
      { name: 'Quesadilla', description: 'Tortilla Filled With Yummy!!! Sauce, Onion, Capsicum, Tomato, Sweet Corn, Mozzarella Cheese & Grilled', price: '110/-' },
      { name: 'Bean Quesadilla', description: 'Tortilla Filled With Yummy!!! Sauce, Baked Beans, Onion, Capsicum, Tomato, Sweet Corn, Mozzarella Cheese & Grilled', price: '110/-' },
    ]
  },
  {
    id: 'desserts',
    title: 'Desserts & Waffles',
    imageUrl: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=800',
    items: [
      { name: 'Eggless Chocolate Brownie', price: '100/-' },
      { name: 'Brownie With Ice-Cream', price: '130/-' },
      { name: 'Sizzling Brownie With Ice-Cream', price: '160/-' },
      { name: 'Classic Waffle', description: 'Chocolate, Vanilla, Blueberry, Caramel, Strawberry...', price: '100/-' },
      { name: 'Waffle Toppings @ 40/-', description: 'Nutella, Peanut Butter, Kit Kat', price: '40/-' },
      { name: 'Vanilla Ice Cream Add-on', price: '30/-' },
    ]
  },
  {
    id: 'scoopies',
    title: 'Scoopies (Special Ice Creams)',
    imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?q=80&w=800',
    items: [
      { name: 'Jackfruit Special', price: '80/-' },
      { name: 'Tender Coconut', price: '80/-' },
      { name: 'Salted Caramel', price: '80/-' },
      { name: 'Chilli Guava', price: '80/-' },
      { name: 'Ratnagiri Mango', price: '80/-' },
      { name: 'Chikoo', price: '80/-' },
      { name: 'Belgian Speculoos', price: '80/-' },
      { name: 'Kaaphi Special', price: '80/-' },
      { name: 'Any 2 Scoopies', price: '150/-' },
    ]
  },
  {
    id: 'shakes',
    title: 'Flavoured Shakes',
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=800',
    items: [
      { name: 'Chocolate Milk Shake', price: '90/-' },
      { name: 'Cold Coffee', price: '90/-' },
      { name: 'Mud Coffee', price: '130/-' },
      { name: 'Café Frappe', price: '90/-' },
      { name: 'Nutella Milk Shake', price: '120/-' },
      { name: 'Oreo Milk Shake', price: '100/-' },
      { name: 'Kit-Kat Milk Shake', price: '110/-' },
      { name: 'Brownie Bomb Milk Shake', price: '130/-' },
    ]
  },
  {
    id: 'beverages',
    title: 'Hot Beverages & Fizzes',
    imageUrl: 'https://images.unsplash.com/photo-1544787210-2213d24295c2?q=80&w=800',
    items: [
      { name: 'Filter Coffee', price: '35/-' },
      { name: 'Tea', price: '35/-' },
      { name: 'Lemon Tea', price: '35/-' },
      { name: 'Hot Badam Milk', price: '35/-' },
      { name: 'Hot Chocolate', price: '40/-' },
      { name: 'Coke Masala', price: '50/-' },
    ]
  }
];
