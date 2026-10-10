CREATE TABLE "bilibili_up_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64),
	"nickname" varchar(64),
	"sex" varchar(64),
	"sign" text,
	"avatar" varchar(255),
	"add_ts" bigint NOT NULL,
	"last_modify_ts" bigint NOT NULL,
	"total_fans" bigint,
	"total_liked" bigint,
	"user_rank" integer,
	"is_official" integer
);
--> statement-breakpoint
CREATE TABLE "bilibili_video" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64),
	"nickname" varchar(64),
	"avatar" varchar(255),
	"add_ts" bigint NOT NULL,
	"last_modify_ts" bigint NOT NULL,
	"video_id" varchar(64) NOT NULL,
	"video_type" varchar(16) NOT NULL,
	"title" varchar(500),
	"desc" text,
	"create_time" bigint NOT NULL,
	"liked_count" varchar(16),
	"disliked_count" varchar(16),
	"video_play_count" varchar(16),
	"video_favorite_count" varchar(16),
	"video_share_count" varchar(16),
	"video_coin_count" varchar(16),
	"video_danmaku" varchar(16),
	"video_comment" varchar(16),
	"video_url" varchar(512),
	"video_cover_url" varchar(512),
	"source_keyword" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "bilibili_video_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64),
	"nickname" varchar(64),
	"sex" varchar(64),
	"sign" text,
	"avatar" varchar(255),
	"add_ts" bigint NOT NULL,
	"last_modify_ts" bigint NOT NULL,
	"comment_id" varchar(64) NOT NULL,
	"video_id" varchar(64) NOT NULL,
	"content" text,
	"create_time" bigint NOT NULL,
	"sub_comment_count" varchar(16) NOT NULL,
	"parent_comment_id" varchar(64),
	"like_count" varchar(255) DEFAULT '0' NOT NULL
);
