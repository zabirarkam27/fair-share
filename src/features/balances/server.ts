import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createBalanceService } from "./service";
export const balances = createBalanceService(prisma, getSession);
