import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { getSession, requireSession } from "@/lib/auth/session";
describe("server session boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session-cookie" }));
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirect");
    });
  });
  it("redirects an unauthenticated request", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
  it("returns identity from the verified session and forwards incoming headers", async () => {
    const session = {
      user: { id: "server-user", name: "Rafi", email: "rafi@example.com" },
    };
    mocks.getSession.mockResolvedValue(session);
    expect(await requireSession()).toBe(session);
    expect(mocks.getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("does not reuse a session between requests", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ user: { id: "first" } })
      .mockResolvedValueOnce(null);
    expect(await getSession()).toEqual({ user: { id: "first" } });
    expect(await getSession()).toBeNull();
    expect(mocks.getSession).toHaveBeenCalledTimes(2);
  });
});
