-- Suất ăn thêm (Pate tươi tự nấu) cho dịch vụ giữ mèo (boarding/per_day).
-- Tính theo TỔNG GRAM/ngày × đơn giá cố định /100g — KHÔNG tạo gói cứng theo cữ×size.
-- DEFAULT để dòng boarding hiện có tự bật với đơn giá 18.000đ/100g (admin chỉnh trong app Flutter).
ALTER TABLE "service_type_defs"
  ADD COLUMN "food_options" JSONB NOT NULL
  DEFAULT '{"enabled":true,"label":"Pate tươi tự nấu","pricePer100g":18000,"mealPresets":[1,2,3],"defaultMeals":2,"gramStep":50,"minGramsPerDay":50,"maxGramsPerDay":600,"sizeHints":[{"label":"Mèo nhỏ / dưới 6 tháng","gramsPerMeal":50},{"label":"Mèo trưởng thành","gramsPerMeal":100}]}';

-- Snapshot suất ăn khách chọn lúc đặt (nullable → không ảnh hưởng booking cũ).
-- Giá do server tự tính từ food_options.pricePer100g; nhân viên chỉnh gram thực tế lúc nhận mèo.
ALTER TABLE "bookings" ADD COLUMN "food_meals" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "food_grams_per_meal" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "food_grams_per_day" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "food_price_per_day" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "food_label" TEXT;
