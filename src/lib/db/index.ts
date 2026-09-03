// Enums + types only — importing this barrel never constructs a client.
// The client lives at "@/lib/db/client" and is imported explicitly by code
// that actually touches the database.
export { Prisma, Role, JobStatus } from "@/generated/prisma/client";
export type {
  User,
  Organization,
  Membership,
  Invitation,
  JobFamily,
  Band,
  Employee,
  Job,
} from "@/generated/prisma/client";
