// Seed initial : administrateur de bootstrap + grille tarifaire (§4.1).
// Idempotent : peut être exécuté plusieurs fois sans dupliquer les règles actives.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { PRICING_GRID } from "../src/lib/pricing-rules.seed";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Utilisateur admin "${username}" déjà présent, ignoré.`);
    return existing;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomUUID().slice(0, 12);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admin = await prisma.user.create({
    data: {
      fullName: "Administrateur",
      username,
      passwordHash,
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  console.log(`Utilisateur admin créé : ${username} / ${password} (changement obligatoire à la 1ère connexion)`);
  return admin;
}

async function seedPricingGrid(adminId: string) {
  for (const rule of PRICING_GRID) {
    const active = await prisma.pricingRule.findFirst({
      where: { channel: rule.channel, payoutCurrency: rule.payoutCurrency, effectiveTo: null },
    });
    if (active) {
      console.log(`Règle déjà active pour ${rule.channel} → ${rule.payoutCurrency}, ignorée.`);
      continue;
    }

    await prisma.pricingRule.create({
      data: {
        channel: rule.channel,
        payoutCurrency: rule.payoutCurrency,
        allowed: rule.allowed,
        feePercent: rule.feePercent.toString(),
        exchangeRate: rule.exchangeRate == null ? null : rule.exchangeRate.toString(),
        feeBeforeConversion: rule.feeBeforeConversion,
        roundingUnit: (rule.roundingUnit ?? 1).toString(),
        createdById: adminId,
      },
    });
    console.log(`Règle créée : ${rule.channel} → ${rule.payoutCurrency}`);
  }
}

async function main() {
  const admin = await seedAdmin();
  await seedPricingGrid(admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
