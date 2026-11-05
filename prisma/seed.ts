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
  legacyNames?: string[];
  description: string;
  defaultSensitivity: SensitivityLevel;
  riskWeight: number;
}

const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  {
    categoryName: 'Government Identification',
    legacyNames: ['Government Identification Category'],
    description: 'Passports, national identity numbers, PAN, Aadhaar, voter identification cards, and statutory government registries. Real-world examples: Aadhaar, PAN, Passport, Voter ID.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Financial Information',
    legacyNames: ['Financial Information Category', 'Financial Data'],
    description: 'Bank account numbers, UPI IDs, credit/debit card details, credit score inquiries, and banking credentials. Real-world examples: Bank Account, UPI ID, Card Details.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Authentication Credentials',
    legacyNames: ['Credentials & Security Profile'],
    description: 'Master passwords, OAuth API keys, login credentials, authentication tokens, and session secrets. Real-world examples: Passwords, API Keys, Login Credentials.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Identity Information',
    legacyNames: ['Personal Photograph & Media'],
    description: 'Legal full name, date of birth, gender, nationality, and primary demographic profile indicators. Real-world examples: Full Name, Date of Birth, Gender.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 7,
  },
  {
    categoryName: 'Contact Information',
    legacyNames: ['Phone Number'],
    description: 'Cellular telephone numbers, primary and recovery email addresses, and personal communication channels. Real-world examples: Phone Number, Email Address.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 7,
  },
  {
    categoryName: 'Location Information',
    legacyNames: ['Location & Tracking History', 'Location Data'],
    description: 'Physical residential street address, real-time GPS telemetry, frequent geolocation check-ins, and travel routes. Real-world examples: Home Address, GPS, Live Location.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 9,
  },
  {
    categoryName: 'Biometric Information',
    legacyNames: ['Biometric Profile Category'],
    description: 'Facial recognition geometry, fingerprint templates, voiceprint signatures, and biological markers. Real-world examples: Face Data, Fingerprints, Voiceprints.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 10,
  },
  {
    categoryName: 'Health Information',
    legacyNames: ['Health & Medical Record Category'],
    description: 'Electronic health records, clinical prescriptions, diagnostic reports, and medical treatment histories. Real-world examples: Medical Records, Prescriptions.',
    defaultSensitivity: SensitivityLevel.CRITICAL,
    riskWeight: 9,
  },
  {
    categoryName: 'Employment Information',
    legacyNames: ['Resume & Employment Dossier'],
    description: 'Current employer, employee ID numbers, salary data, work history, and curriculum vitae. Real-world examples: Employee ID, Company, Salary.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 6,
  },
  {
    categoryName: 'Education Information',
    legacyNames: ['Email Address'],
    description: 'Student ID numbers, university degrees, academic transcripts, and institutional educational certifications. Real-world examples: Student ID, Certificates, Academic Records.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 5,
  },
  {
    categoryName: 'Social Media Information',
    legacyNames: ['Browsing & Behavioral Profiling'],
    description: 'Public social profiles, personal posts, subscriber connections, and social network relationship graphs. Real-world examples: Social Profiles, Posts, Connections.',
    defaultSensitivity: SensitivityLevel.MEDIUM,
    riskWeight: 6,
  },
  {
    categoryName: 'Family & Personal Relationships',
    legacyNames: ['Home Address'],
    description: 'Family member records, next-of-kin declarations, household associations, and emergency contact details. Real-world examples: Family Details, Emergency Contacts.',
    defaultSensitivity: SensitivityLevel.HIGH,
    riskWeight: 7,
  },
];

async function seed(): Promise<void> {
  console.log('----------------------------------------------------');
  console.log('OBLIVION Database Seeder: Initializing Reference Data');
  console.log('----------------------------------------------------');

  let createdCount = 0;
  let updatedCount = 0;

  for (const cat of REFERENCE_CATEGORIES) {
    const existing = await prisma.dataCategory.findFirst({
      where: {
        OR: [
          { categoryName: cat.categoryName },
          ...(cat.legacyNames ? cat.legacyNames.map((name) => ({ categoryName: name })) : []),
        ],
      },
    });

    if (existing) {
      await prisma.dataCategory.update({
        where: { id: existing.id },
        data: {
          categoryName: cat.categoryName,
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
