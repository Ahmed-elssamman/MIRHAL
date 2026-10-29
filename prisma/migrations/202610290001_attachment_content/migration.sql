-- Additive: existing metadata and externally stored files are untouched.
CREATE TABLE "AttachmentContent" (
    "storageKey" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    CONSTRAINT "AttachmentContent_pkey" PRIMARY KEY ("storageKey"),
    CONSTRAINT "AttachmentContent_size_check" CHECK ("size" > 0 AND "size" <= 2097152 AND octet_length("data") = "size")
);
