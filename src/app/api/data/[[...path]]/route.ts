import { auth } from "@/lib/auth";
import {
  AppError,
  overview,
  groupDetail,
  createGroup,
  joinGroup,
  saveExpense,
  deleteExpense,
  settle,
  removeMember,
  deleteGroup,
  rotateInvite,
} from "@/lib/service";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const login = await auth.api.getSession({ headers: request.headers });
    if (!login) throw new AppError(401, "Please sign in to continue.");
    const actor = login.user.id;
    const path = (await context.params).path ?? [];
    const method = request.method;
    let body: unknown = {};
    if (method !== "GET") {
      if (
        request.headers.get("origin") !==
        new URL(process.env.BETTER_AUTH_URL ?? request.url).origin
      )
        throw new AppError(403, "Untrusted request origin.");
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new AppError(415, "Send JSON.");
      const raw = await request.text();
      if (raw.length > 32768) throw new AppError(413, "Request is too large.");
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AppError(400, "Invalid JSON.");
      }
    }
    let result: unknown;
    if (method === "GET" && path.length === 0) result = await overview(actor);
    else if (method === "POST" && path.join("/") === "groups")
      result = await createGroup(actor, body);
    else if (method === "POST" && path.join("/") === "join")
      result = await joinGroup(actor, body);
    else if (path[0] === "groups" && path[1]) {
      const id = path[1];
      if (path.length === 2 && method === "GET")
        result = await groupDetail(actor, id);
      else if (path.length === 2 && method === "DELETE")
        result = await deleteGroup(actor, id, body);
      else if (path.length === 3 && path[2] === "expenses" && method === "POST")
        result = await saveExpense(actor, id, body);
      else if (path.length === 4 && path[2] === "expenses" && method === "PUT")
        result = await saveExpense(actor, id, body, path[3]);
      else if (
        path.length === 4 &&
        path[2] === "expenses" &&
        method === "DELETE"
      )
        result = await deleteExpense(actor, id, path[3], body);
      else if (
        path.length === 3 &&
        path[2] === "settlements" &&
        method === "POST"
      )
        result = await settle(actor, id, body);
      else if (
        path.length === 4 &&
        path[2] === "members" &&
        method === "DELETE"
      )
        result = await removeMember(actor, id, path[3]);
      else if (path.length === 3 && path[2] === "invite" && method === "POST")
        result = await rotateInvite(actor, id);
      else throw new AppError(404, "Route not found.");
    } else throw new AppError(404, "Route not found.");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AppError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (
      error instanceof Error &&
      /^(Use a|Amount |Select 1|Exact amounts|Percentages|Shares |Invalid split)/.test(
        error.message,
      )
    )
      return Response.json({ error: error.message }, { status: 400 });
    console.error("FairShare request failed", error);
    return Response.json(
      { error: "Something went wrong. Please retry." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
