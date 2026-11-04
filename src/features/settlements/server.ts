import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createSettlementService } from "./service";
export const settlements = createSettlementService(prisma, getSession);
