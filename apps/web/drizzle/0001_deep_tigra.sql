ALTER TABLE "reviews" ADD COLUMN "meal_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurants_place_id_idx" ON "restaurants" USING btree ("place_id") WHERE place_id IS NOT NULL;