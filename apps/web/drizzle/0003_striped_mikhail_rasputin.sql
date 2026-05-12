CREATE UNIQUE INDEX "feed_items_unique_idx" ON "feed_items" USING btree ("owner_user_id","review_id");
