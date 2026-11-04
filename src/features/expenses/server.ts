import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createExpenseService } from "./service";
export const expenses = createExpenseService(prisma, getSession);
