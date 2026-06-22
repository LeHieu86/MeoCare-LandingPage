-- Mã định danh mèo cho thú cưng mua tại MeoCare: tham chiếu CatListing gốc.
-- cat_code = CatListing.code (vd MEO-260622-001), duy nhất mỗi con; cat_id để truy xuất hệ thống.
ALTER TABLE "pets" ADD COLUMN "cat_id" INTEGER;
ALTER TABLE "pets" ADD COLUMN "cat_code" TEXT;
