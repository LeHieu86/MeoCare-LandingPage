-- Kho tri thức bot CSKH — admin tự thêm câu hỏi/đáp (giờ mở cửa, chính sách...).
CREATE TABLE "cskh_faq" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cskh_faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cskh_faq_store_id_enabled_idx" ON "cskh_faq"("store_id", "enabled");
