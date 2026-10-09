import { prisma } from "../lib/prisma.js";

export const SAMPLE_CSV =
  "date,sales\n2024-01-01,10\n2024-01-02,20\n2024-01-03,15\n";

export function uniqueEmail(label: string): string {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `api-test-${label}-${token}@example.com`;
}

export const TEST_PASSWORD = "Password1";

export async function deleteCompanyAndData(companyId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { user: { companyId } },
  });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.dataset.deleteMany({ where: { companyId } });
  await prisma.document.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}
