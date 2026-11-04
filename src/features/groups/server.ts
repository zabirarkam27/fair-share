import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createGroupService } from "./service";
export const groups = createGroupService(prisma, getSession);
