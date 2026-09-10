CREATE TABLE "document_chunks" (
	"document" text NOT NULL,
	"part" integer NOT NULL,
	"data" text NOT NULL,
	CONSTRAINT "document_chunks_document_part_pk" PRIMARY KEY("document","part")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"workspace" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"parts" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"data" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_documents_id_fk" FOREIGN KEY ("document") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documents_owner_workspace" ON "documents" USING btree ("owner","workspace");--> statement-breakpoint
CREATE INDEX "idx_workspaces_owner" ON "workspaces" USING btree ("owner");