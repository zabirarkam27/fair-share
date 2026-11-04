import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createActivityService } from "./service";
export const activity = createActivityService(prisma, getSession);
