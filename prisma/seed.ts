/**
 * OBLIVION - Reference Data Seeder
 *
 * Populates only essential system reference data:
 * - Predefined Data Categories with sensitivity classifications and risk weights.
 *
 * NOTE: In strict accordance with privacy architecture requirements,
 * NO fake users, NO fake websites, and NO fake exposure records are seeded.
 * All user data must originate from authentic platform activity.
 */

import { PrismaClient, SensitivityLevel } from '@prisma/client';

const prisma = new PrismaClient();

interface ReferenceCategory {
  categoryName: string;
  description: string;
  defaultSensitivity: SensitivityLevel;
  riskWeight: number;
}

const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  {
    categoryName: 'Email Address',
    description: 'Primary or secondary electronic mail addresses, recovery email addresses, and associated contact lists.',
    defaultSensitivity: SensitivityLevel.LOW,
    riskWeight: 3,
  },
  {
    categoryName: 'Phone Number',
    description: 'Personal cellular, landline, or VoIP telephone numbers used for multi-factor authentication or communications.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 5,
  },
  {
    categoryName: 'Home Address',
    description: 'Physical residential street addresses, postal codes, and geographical dwelling indicators.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 7,
  },
  {
    categoryName: 'Government Identification Category',
    description: 'Classifications covering passports, national identity numbers, driver licenses, or social security registries. Stores category metadata only; never stores raw identity documents or numbers.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Financial Information Category',
    description: 'Classifications covering payment card references, bank routing associations, credit score inquiries, and payroll connections. Stores category metadata only; never stores raw credentials or account numbers.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 9,
  },
  {
    categoryName: 'Resume & Employment Dossier',
    description: 'Curriculum vitae, detailed employment history, references, compensation benchmarks, and educational transcripts.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 4,
  },
  {
    categoryName: 'Personal Photograph & Media',
    description: 'Facial photographs, family media, personal camera roll uploads, and user likeness assets.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 6,
  },
  {
    categoryName: 'Biometric Profile Category',
    description: 'Classifications denoting facial geometry metadata, voiceprint signatures, or fingerprint enrollment status. Never stores raw biometric templates.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Health & Medical Record Category',
    description: 'Classifications indicating medical appointments, diagnostic histories, prescriptions, or fitness tracker logs.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 9,
  },
  {
    categoryName: 'Location & Tracking History',
    description: 'Continuous GPS telemetry, frequent location check-ins, Wi-Fi SSID logs, and travel itineraries.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 7,
  },
  {
    categoryName: 'Credentials & Security Profile',
    description: 'Cryptographic hash references, authentication tokens, security question topics, and MFA status flags.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Browsing & Behavioral Profiling',
    description: 'Cross-site ad identifiers, browsing interest categorizations, device fingerprinting, and behavioral tracking profiles.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 4,
  },
];

async function seed(): Promise<void> {
  console.log('----------------------------------------------------');
  console.log('OBLIVION Database Seeder: Initializing Reference Data');
  console.log('----------------------------------------------------');

  let createdCount = 0;
  let updatedCount = 0;

  for (const cat of REFERENCE_CATEGORIES) {
    const existing = await prisma.dataCategory.findUnique({
      where: { categoryName: cat.categoryName },
    });

    if (existing) {
      await prisma.dataCategory.update({
        where: { categoryName: cat.categoryName },
        data: {
          description: cat.description,
          defaultSensitivity: cat.defaultSensitivity,
          riskWeight: cat.riskWeight,
        },
      });
      updatedCount++;
    } else {
      await prisma.dataCategory.create({
        data: {
          categoryName: cat.categoryName,
          description: cat.description,
          defaultSensitivity: cat.defaultSensitivity,
          riskWeight: cat.riskWeight,
        },
      });
      createdCount++;
    }
  }

  console.log(`Reference data seed completed successfully:`);
  console.log(`- Created: ${createdCount} data categories`);
  console.log(`- Verified/Updated: ${updatedCount} data categories`);
  console.log(`- Total Reference Categories: ${REFERENCE_CATEGORIES.length}`);
  console.log('----------------------------------------------------');
}

seed()
  .catch((error) => {
    console.error('Database seeding failed with error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
