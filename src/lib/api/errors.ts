import { ForbiddenError } from "@/lib/rbac";
import {
  AlreadyMemberError,
  InvitationInvalidError,
  LastOwnerError,
  MemberNotFoundError,
  RoleAssignmentError,
} from "@/lib/tenancy";
import { BadRequestError } from "./pipeline";

/** Maps a domain error to an HTTP response. Unknown errors -> 500. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof BadRequestError) {
    return Response.json({ error: error.message, issues: error.issues }, { status: 400 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: `Missing permission: ${error.permission}` }, { status: 403 });
  }
  if (error instanceof RoleAssignmentError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof MemberNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof LastOwnerError || error instanceof AlreadyMemberError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InvitationInvalidError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ error: "Internal error." }, { status: 500 });
}
