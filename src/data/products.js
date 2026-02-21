const PRODUCTS = [
  {
    id: 1,
    name: "Hạt Keres Formula+ 2Kg",
    category: "food",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/HatKeres.jpg",
    description: "Thức ăn cao cấp cho mèo trưởng thành & mèo con",
    variants: [
      { name: "Mèo Trưởng Thành", price: 170000 },
      { name: "Mèo Con", price: 170000 },
    ],
  },
  {
    id: 2,
    name: "Pate Wildgrey 170g",
    category: "pate",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/gen-n-PateDen.jpg",
    description: "Pate mềm nhiều hương vị, trọng lượng lên đến 170g cho 1 hộp",
    variants: [
      { name: "Cá ngừ + Thịt cua - 5 Hộp", price: 85000 },
      { name: "Cá ngừ + Thịt cua - 10 Hộp", price: 160000 },
      { name: "Cá ngừ + Thịt cua - 15 Hộp", price: 240000 },
      { name: "Cá ngừ + Thịt cua - 20 Hộp", price: 320000 },
      { name: "Cá ngừ + Gà - 5 Hộp", price: 85000 },
      { name: "Cá ngừ + Gà - 10 Hộp", price: 160000 },
      { name: "Cá ngừ + Gà - 15 Hộp", price: 240000 },
      { name: "Cá ngừ + Gà - 20 Hộp", price: 320000 },
    ],
  },
  {
    id: 3,
    name: "Pate Lodi Canned Cat",
    category: "pate",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/gen-n-PateTrang.jpg",
    description: "Pate mềm nhiều hương vị, trọng lượng 80g cho 1 hộp",
    variants: [
      { name: "Sữa dê + Thịt gà - 5 Hộp", price: 38000 },
      { name: "Sữa dê + Thịt gà - 10 Hộp", price: 72000 },
      { name: "Sữa dê + Thịt gà - 15 Hộp", price: 100000 },
      { name: "Sữa dê + Thịt gà - 20 Hộp", price: 140000 },
      { name: "Bào ngư + Thịt gà - 5 Hộp", price: 38000 },
      { name: "Bào ngư + Thịt gà - 10 Hộp", price: 72000 },
      { name: "Bào ngư + Thịt gà - 15 Hộp", price: 105000 },
      { name: "Bào ngư + Thịt gà - 20 Hộp", price: 140000 },
    ],
  },
  {
    id: 4,
    name: "Cát Đậu Nành 6L Nội Địa Trung ",
    category: "hygiene",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/CatDauNanh.jpg",
    description: "Hàng nhập khẩu nội địa Trung, chất lượng cao",
    variants: [
      { name: "6L – Đậu Nành", price: 85000 },
    ],
  },
  {
    id: 5,
    name: "Combo Hạt Keres + Pate Gói 50g",
    category: "combo",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/Combo2.jpg",
    description: "Combo tiết kiệm – mua lẻ sẽ cao hơn",
    variants: [
      { name: "Hạt 2kg + 12 Pate", price: 200000 },
      { name: "Hạt 2kg + 15 Pate", price: 210000 },
      { name: "Hạt 2kg + 20 Pate", price: 225000 }
    ],
  },
  {
    id: 6,
    name: "Combo Cát Đậu Nành + Pate Gói 50g",
    category: "combo",
    image: "https://pub-486676ca235544ca8fac9da4a624f9ef.r2.dev/Cat%26Pate.png",
    description: "Combo tiết kiệm – mua lẻ sẽ cao hơn",
    variants: [
      { name: "Cát Đậu Nành 6L + 12 Pate", price: 145000 },
      { name: "Cát Đậu Nành 6L + 15 Pate", price: 155000 },
      { name: "Cát Đậu Nành 6L + 20 Pate", price: 175000 }
    ],
  },
];

export default PRODUCTS;
