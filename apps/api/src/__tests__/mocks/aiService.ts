import { vi } from 'vitest';
import { faker } from '@faker-js/faker';

export const mockAIService = {
  analyzeLabReport: vi.fn(),
  generateHealthInsights: vi.fn(),
  processImage: vi.fn(),
  extractTextFromPDF: vi.fn(),
  generateRecommendations: vi.fn(),
};

// Mock AI analysis response
export const createMockAIAnalysisResponse = () => ({
  summary: faker.lorem.paragraph(),
  keyFindings: Array.from({ length: 3 }, () => ({
    finding: faker.lorem.sentence(),
    significance: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    recommendation: faker.lorem.sentence(),
  })),
  recommendations: Array.from({ length: 5 }, () => ({
    type: faker.helpers.arrayElement(['DIET', 'EXERCISE', 'SUPPLEMENT', 'LIFESTYLE', 'MEDICAL']),
    description: faker.lorem.sentence(),
    priority: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
  })),
  riskFactors: Array.from({ length: 2 }, () => ({
    factor: faker.lorem.word(),
    level: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    description: faker.lorem.sentence(),
  })),
  confidence: faker.number.float({ min: 0.7, max: 0.95 }),
  processingTime: faker.number.int({ min: 1000, max: 5000 }),
});

// Mock health insights response
export const createMockHealthInsightsResponse = () => ({
  overallScore: faker.number.int({ min: 0, max: 100 }),
  trends: {
    improvement: Array.from({ length: 3 }, () => ({
      metric: faker.lorem.word(),
      change: faker.number.float({ min: -10, max: 10 }),
      period: faker.helpers.arrayElement(['1W', '1M', '3M', '6M']),
    })),
    decline: Array.from({ length: 2 }, () => ({
      metric: faker.lorem.word(),
      change: faker.number.float({ min: -10, max: 10 }),
      period: faker.helpers.arrayElement(['1W', '1M', '3M', '6M']),
    })),
  },
  recommendations: Array.from({ length: 5 }, () => ({
    category: faker.helpers.arrayElement(['DIET', 'EXERCISE', 'SLEEP', 'STRESS', 'SUPPLEMENTS']),
    action: faker.lorem.sentence(),
    urgency: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    expectedImpact: faker.lorem.sentence(),
  })),
  alerts: Array.from({ length: 2 }, () => ({
    type: faker.helpers.arrayElement(['CRITICAL', 'WARNING', 'INFO']),
    message: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
  })),
});

// Mock image processing response
export const createMockImageProcessingResponse = () => ({
  text: faker.lorem.paragraphs(2),
  confidence: faker.number.float({ min: 0.8, max: 0.99 }),
  format: faker.helpers.arrayElement(['PDF', 'JPEG', 'PNG', 'TIFF']),
  size: {
    width: faker.number.int({ min: 100, max: 2000 }),
    height: faker.number.int({ min: 100, max: 2000 }),
  },
  extractedData: {
    date: faker.date.past(),
    patientName: faker.person.fullName(),
    testType: faker.lorem.words(2),
    results: Array.from({ length: 5 }, () => ({
      name: faker.lorem.word(),
      value: faker.number.float({ min: 0, max: 100 }).toString(),
      unit: faker.helpers.arrayElement(['mg/dL', 'mmol/L', 'IU/L', 'g/dL']),
      referenceRange: `${faker.number.int({ min: 0, max: 50 })}-${faker.number.int({ min: 51, max: 100 })}`,
    })),
  },
});

// Mock PDF text extraction response
export const createMockPDFTextExtractionResponse = () => ({
  text: faker.lorem.paragraphs(5),
  pages: faker.number.int({ min: 1, max: 10 }),
  confidence: faker.number.float({ min: 0.85, max: 0.98 }),
  extractedData: {
    patientInfo: {
      name: faker.person.fullName(),
      dateOfBirth: faker.date.birthdate(),
      patientId: faker.string.alphanumeric(10),
    },
    testResults: Array.from({ length: faker.number.int({ min: 5, max: 15 }) }, () => ({
      testName: faker.lorem.words(3),
      result: faker.number.float({ min: 0, max: 100 }).toString(),
      unit: faker.helpers.arrayElement(['mg/dL', 'mmol/L', 'IU/L', 'g/dL']),
      referenceRange: `${faker.number.int({ min: 0, max: 50 })}-${faker.number.int({ min: 51, max: 100 })}`,
      flag: faker.helpers.arrayElement(['HIGH', 'LOW', 'NORMAL']),
    })),
    labInfo: {
      labName: faker.company.name(),
      labId: faker.string.alphanumeric(8),
      reportDate: faker.date.past(),
    },
  },
});

// Mock supplement recommendations response
export const createMockSupplementRecommendationsResponse = () => ({
  recommendations: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
    supplement: faker.lorem.words(2),
    dosage: `${faker.number.int({ min: 100, max: 1000 })}${faker.helpers.arrayElement(['mg', 'mcg', 'IU'])}`,
    frequency: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'Three times daily', 'As needed']),
    duration: faker.helpers.arrayElement(['2 weeks', '1 month', '3 months', 'Ongoing']),
    reason: faker.lorem.sentence(),
    potentialBenefits: faker.lorem.sentences(2),
    warnings: faker.lorem.sentence(),
    interactions: faker.lorem.sentence(),
    priority: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
  })),
  disclaimers: [
    'Consult with a healthcare provider before starting any supplement regimen.',
    'These recommendations are based on AI analysis and should not replace professional medical advice.',
    'Individual results may vary.',
  ],
  confidence: faker.number.float({ min: 0.75, max: 0.95 }),
  analysisBasis: faker.lorem.paragraph(),
});

// Setup AI mocks
export const setupAIMocks = () => {
  mockAIService.analyzeLabReport.mockImplementation(async (file: Buffer, metadata: any) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, faker.number.int({ min: 100, max: 500 })));
    return createMockAIAnalysisResponse();
  });

  mockAIService.generateHealthInsights.mockImplementation(async (userData: any) => {
    return createMockHealthInsightsResponse();
  });

  mockAIService.processImage.mockImplementation(async (image: Buffer) => {
    return createMockImageProcessingResponse();
  });

  mockAIService.extractTextFromPDF.mockImplementation(async (pdf: Buffer) => {
    return createMockPDFTextExtractionResponse();
  });

  mockAIService.generateRecommendations.mockImplementation(async (analysis: any, userProfile: any) => {
    return createMockSupplementRecommendationsResponse();
  });

  return mockAIService;
};

// Reset all AI mocks
export const resetAIMocks = () => {
  Object.values(mockAIService).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
};

// Mock AI service errors
export const createMockAIError = (type: string) => {
  switch (type) {
    case 'RATE_LIMIT':
      return new Error('AI service rate limit exceeded');
    case 'TIMEOUT':
      return new Error('AI service request timed out');
    case 'INVALID_INPUT':
      return new Error('Invalid input data for AI processing');
    case 'SERVICE_UNAVAILABLE':
      return new Error('AI service temporarily unavailable');
    case 'PROCESSING_ERROR':
      return new Error('Error processing data with AI service');
    default:
      return new Error('Unknown AI service error');
  }
};