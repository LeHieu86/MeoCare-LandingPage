const PRODUCTS = [
  {
    id: 1,
    name: "Thức Ăn Hạt Keres",
    category: "food",
    image: "🍖",
    description: "Thức ăn cao cấp cho mèo trưởng thành & mèo con",
    variants: [
      { name: "Mèo Trưởng Thành – 2kg", price: 450000 },
      { name: "Mèo Con – 2kg", price: 420000 },
    ],
  },
  {
    id: 2,
    name: "Pate Whiskas",
    category: "pate",
    image: "🥫",
    description: "Pate mềm nhiều hương vị",
    variants: [
      { name: "Cá ngừ", price: 15000 },
      { name: "Cá hồi", price: 18000 },
      { name: "Gà", price: 15000 },
    ],
  },
  {
    id: 3,
    name: "Cát Bentonite",
    category: "hygiene",
    image: "🪨",
    description: "Cát siêu vón – khử mùi tốt",
    variants: [
      { name: "5kg – Không mùi", price: 85000 },
      { name: "10kg – Lavender", price: 175000 },
    ],
  },
  {
    id: 4,
    name: "Combo Chăm Mèo",
    category: "combo",
    image: "🎁",
    description: "Combo tiết kiệm – mua lẻ sẽ cao hơn",
    variants: [
      { name: "Hạt 2kg + 12 Pate", price: 320000 },
      { name: "Hạt 2kg + 20 Pate", price: 480000 },
    ],
  },
];

export default PRODUCTS;
