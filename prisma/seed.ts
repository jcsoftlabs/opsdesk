// Seed initial : administrateur de bootstrap + grille tarifaire (§4.1).
// Idempotent : peut être exécuté plusieurs fois sans dupliquer les règles actives.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { PRICING_GRID } from "../src/lib/pricing-rules.seed";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Bootstrap SaaS multi-bureaux (§15) : une base fraîche n'a ni Organization
// ni Bureau — on en crée un par défaut pour que le seed reste utilisable en
// développement local.
async function seedOrganizationAndBureau() {
  const existing = await prisma.organization.findFirst();
  if (existing) {
    const bureau = await prisma.bureau.findFirstOrThrow({ where: { organizationId: existing.id } });
    console.log(`Organization "${existing.name}" déjà présente, ignorée.`);
    return { organization: existing, bureau };
  }

  const organization = await prisma.organization.create({
    data: { name: "Organisation de démonstration", billingRatePerBureau: "0" },
  });
  const bureau = await prisma.bureau.create({
    data: { organizationId: organization.id, name: "Bureau principal" },
  });
  console.log(`Organization "${organization.name}" et Bureau "${bureau.name}" créés.`);
  return { organization, bureau };
}

async function seedAdmin(organizationId: string, bureauId: string) {
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
      organizationId,
      bureauId,
    },
  });

  console.log(`Utilisateur admin créé : ${username} / ${password} (changement obligatoire à la 1ère connexion)`);
  return admin;
}

async function seedPricingGrid(organizationId: string, adminId: string) {
  for (const rule of PRICING_GRID) {
    const active = await prisma.pricingRule.findFirst({
      where: { organizationId, channel: rule.channel, payoutCurrency: rule.payoutCurrency, effectiveTo: null },
    });
    if (active) {
      console.log(`Règle déjà active pour ${rule.channel} → ${rule.payoutCurrency}, ignorée.`);
      continue;
    }

    await prisma.pricingRule.create({
      data: {
        organizationId,
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
  const { organization, bureau } = await seedOrganizationAndBureau();
  const admin = await seedAdmin(organization.id, bureau.id);
  await seedPricingGrid(organization.id, admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
