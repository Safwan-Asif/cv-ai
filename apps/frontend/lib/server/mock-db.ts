/**
 * Server-side in-memory mock database and logic for Resume Matcher.
 * Provides complete support for all app functionality without requiring Python backend.
 */

export interface PersonalInfo {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string | null;
  linkedin?: string | null;
  github?: string | null;
}

export interface WorkExperienceItem {
  id: number;
  title?: string;
  company?: string;
  location?: string | null;
  years?: string;
  description?: string[];
  descriptionStyles?: ('bullet' | 'plain')[];
}

export interface EducationItem {
  id: number;
  institution?: string;
  degree?: string;
  years?: string;
  description?: string | null;
}

export interface ProjectItem {
  id: number;
  name?: string;
  role?: string;
  years?: string;
  github?: string | null;
  website?: string | null;
  description?: string[];
  descriptionStyles?: ('bullet' | 'plain')[];
}

export interface AdditionalInfo {
  technicalSkills?: string[];
  languages?: string[];
  certificationsTraining?: string[];
  awards?: string[];
}

export interface ProcessedResume {
  personalInfo?: PersonalInfo;
  summary?: string;
  workExperience?: WorkExperienceItem[];
  education?: EducationItem[];
  personalProjects?: ProjectItem[];
  additional?: AdditionalInfo;
  customSections?: Record<string, unknown>;
  sectionMeta?: unknown[];
}

export interface ResumeRecord {
  resume_id: string;
  filename: string | null;
  is_master: boolean;
  parent_id: string | null;
  title: string | null;
  raw_resume: {
    id: number | null;
    content: string;
    content_type: string;
    created_at: string;
    processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  };
  processed_resume: ProcessedResume | null;
  cover_letter?: string | null;
  outreach_message?: string | null;
  interview_prep?: Record<string, unknown> | null;
  job_description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRecord {
  job_id: string;
  title: string;
  company: string;
  content: string;
  created_at: string;
}

export type ApplicationStatus =
  'saved' | 'applied' | 'no_response' | 'response' | 'interview' | 'accepted' | 'rejected';

export interface ApplicationRecord {
  application_id: string;
  job_id: string;
  resume_id: string;
  master_resume_id: string | null;
  status: ApplicationStatus;
  company: string | null;
  role: string | null;
  applied_at: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_MASTER_RESUME: ProcessedResume = {
  personalInfo: {
    name: 'Jane Doe',
    title: 'Senior Full Stack & AI Engineer',
    email: 'jane.doe@example.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    website: 'https://janedoe.dev',
    linkedin: 'linkedin.com/in/janedoe',
    github: 'github.com/janedoe',
  },
  summary:
    'Innovative Senior Software Engineer with 7+ years of experience architecting full-stack applications, microservices, and AI-enabled workflows. Proven track record of improving system performance and scaling production platforms.',
  workExperience: [
    {
      id: 1,
      title: 'Senior Full Stack Engineer',
      company: 'TechCorp Solutions',
      location: 'San Francisco, CA',
      years: '2022 - Present',
      description: [
        'Architected high-throughput web applications handling over 100K daily active users with Next.js, Node.js, and TypeScript.',
        'Spearheaded LLM integration for intelligent workflow automation, reducing document processing latency by 45%.',
        'Led a cross-functional squad of 6 engineers, driving Agile sprints and elevating CI/CD deployment reliability to 99.9%.',
      ],
      descriptionStyles: ['bullet', 'bullet', 'bullet'],
    },
    {
      id: 2,
      title: 'Software Engineer',
      company: 'DataStream Innovations',
      location: 'New York, NY',
      years: '2019 - 2022',
      description: [
        'Engineered responsive web applications and data visualization dashboards using React, TypeScript, and Tailwind CSS.',
        'Designed RESTful APIs and real-time event pipelines serving 5M+ monthly events with 99.95% uptime.',
        'Reduced frontend bundle sizes by 38% through code splitting, caching strategies, and asset optimization.',
      ],
      descriptionStyles: ['bullet', 'bullet', 'bullet'],
    },
  ],
  education: [
    {
      id: 1,
      institution: 'University of California, Berkeley',
      degree: 'B.S. in Computer Science',
      years: '2015 - 2019',
      description: 'Magna Cum Laude, Honors in Engineering, Dean’s List all semesters',
    },
  ],
  personalProjects: [
    {
      id: 1,
      name: 'CV Matcher & Career Hub',
      role: 'Creator & Lead Developer',
      years: '2023 - Present',
      github: 'https://github.com/janedoe/cv-ai',
      website: 'https://cv-ai-demo.dev',
      description: [
        'Built an AI-driven resume tailoring and ATS scoring platform with instant diff comparisons and interview prep assistance.',
        'Achieved over 1,200 stars on GitHub and supported thousands of job seekers worldwide.',
      ],
      descriptionStyles: ['bullet', 'bullet'],
    },
  ],
  additional: {
    technicalSkills: [
      'TypeScript',
      'JavaScript',
      'React',
      'Next.js',
      'Node.js',
      'Python',
      'FastAPI',
      'Tailwind CSS',
      'Docker',
      'PostgreSQL',
      'Git',
      'REST APIs',
    ],
    languages: ['English (Native)', 'Spanish (Conversational)'],
    certificationsTraining: [
      'AWS Certified Solutions Architect',
      'Google Cloud Professional Cloud Architect',
    ],
    awards: [
      'Outstanding Innovation Award (TechCorp, 2023)',
      'Hackathon First Place (CalHacks 2018)',
    ],
  },
};

const MASTER_RESUME_ID = 'master-resume-default-001';

// Global in-memory storage singleton
class MockDatabase {
  resumes: Map<string, ResumeRecord> = new Map();
  jobs: Map<string, JobRecord> = new Map();
  applications: Map<string, ApplicationRecord> = new Map();
  improvementsCount = 3;

  llmConfig = {
    provider: 'openai' as const,
    model: 'gpt-4o',
    api_key: 'sk-mock-key-configured',
    api_base: null as string | null,
    reasoning_effort: null,
  };

  features = {
    enable_cover_letter: true,
    enable_outreach_message: true,
    enable_interview_prep: true,
  };

  prompts = {
    default_prompt_id: 'keywords',
    prompt_options: [
      {
        id: 'nudge',
        label: 'Subtle Polish',
        description: 'Lightly align wording with the job description without changing tone.',
      },
      {
        id: 'keywords',
        label: 'Keyword Optimization',
        description: 'Incorporate relevant keywords from the job description for ATS matching.',
      },
      {
        id: 'reframe',
        label: 'Strategic Reframe',
        description: 'Reframe bullet points to emphasize relevant achievements and leadership.',
      },
    ],
  };

  featurePrompts = {
    cover_letter_prompt: '',
    outreach_message_prompt: '',
    cover_letter_default:
      'Write a compelling, professional cover letter tailored to the job description and candidate background.',
    outreach_message_default:
      'Draft a polite, concise LinkedIn outreach message to the hiring manager expressing interest in the role.',
  };

  apiKeys: Record<string, string> = {
    openai: 'sk-mock-key-configured',
    google: 'mock-gemini-key',
  };

  languageConfig = {
    ui_language: 'en' as const,
    content_language: 'en' as const,
    supported_languages: ['en', 'es', 'zh', 'ja', 'pt', 'fr', 'ko'] as const,
  };

  constructor() {
    this.seed();
  }

  seed() {
    const now = new Date().toISOString();
    // Seed master resume
    const master: ResumeRecord = {
      resume_id: MASTER_RESUME_ID,
      filename: 'Jane_Doe_Master_Resume.pdf',
      is_master: true,
      parent_id: null,
      title: 'Jane Doe - Master Resume',
      raw_resume: {
        id: 1,
        content: JSON.stringify(DEFAULT_MASTER_RESUME),
        content_type: 'application/json',
        created_at: now,
        processing_status: 'ready',
      },
      processed_resume: JSON.parse(JSON.stringify(DEFAULT_MASTER_RESUME)),
      cover_letter:
        'Dear Hiring Team,\n\nI am writing to express my strong enthusiasm for this engineering opportunity. With a comprehensive background in full-stack architecture, high-performance web systems, and modern AI engineering, I am confident in my ability to deliver immediate value to your engineering team.\n\nThroughout my career at TechCorp Solutions, I have specialized in building robust, scalable software that addresses real business challenges. I look forward to discussing how my experience aligns with your team’s technical goals.\n\nSincerely,\nJane Doe',
      outreach_message:
        'Hi there! I noticed your open role and wanted to reach out directly. With 7+ years specializing in Next.js, Node.js, and modern AI engineering, I would love to connect and learn more about what your team is building.',
      interview_prep: {
        company_insights:
          'Fast-paced tech environment prioritizing code quality, end-to-end user experience, and scalable cloud solutions.',
        role_expectations:
          'Deliver robust frontend and backend code, collaborate with cross-functional partners, and mentor junior engineers.',
        likely_questions: [
          {
            question:
              'How do you approach architecting scalable full-stack applications with Next.js and Node.js?',
            guidance:
              'Highlight modular component design, server-side caching, and API optimization.',
          },
          {
            question: 'Tell me about a time you optimized a slow web application.',
            guidance:
              'Discuss bundle analysis, lazy loading, database indexing, and measured performance improvements.',
          },
        ],
      },
      created_at: now,
      updated_at: now,
    };
    this.resumes.set(MASTER_RESUME_ID, master);

    // Seed a sample job
    const sampleJobId = 'job-sample-101';
    this.jobs.set(sampleJobId, {
      job_id: sampleJobId,
      title: 'Senior Software Engineer',
      company: 'Stripe',
      content:
        'We are looking for a Senior Software Engineer to build world-class developer tools and web platforms using TypeScript, React, Next.js, and Node.js. Experience with high-reliability APIs, microservices, and automated testing is required.',
      created_at: now,
    });

    // Seed sample application in tracker
    const sampleAppId = 'app-sample-201';
    this.applications.set(sampleAppId, {
      application_id: sampleAppId,
      job_id: sampleJobId,
      resume_id: MASTER_RESUME_ID,
      master_resume_id: MASTER_RESUME_ID,
      status: 'applied',
      company: 'Stripe',
      role: 'Senior Software Engineer',
      applied_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      notes: 'Applied through company referral. Recruiter screen scheduled.',
      position: 0,
      created_at: now,
      updated_at: now,
    });
  }

  getSystemStatus() {
    const totalResumes = this.resumes.size;
    const totalJobs = this.jobs.size;
    const totalImprovements = this.improvementsCount;
    const hasMaster = Array.from(this.resumes.values()).some((r) => r.is_master);

    return {
      status: 'ready' as const,
      llm_configured: Boolean(this.llmConfig.api_key),
      llm_healthy: true,
      has_master_resume: hasMaster,
      database_stats: {
        total_resumes: totalResumes,
        total_jobs: totalJobs,
        total_improvements: totalImprovements,
        has_master_resume: hasMaster,
      },
    };
  }
}

// Global declaration to prevent re-instantiation across Next.js HMR
const globalForDb = globalThis as unknown as { mockDb?: MockDatabase };
export const db = globalForDb.mockDb || new MockDatabase();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.mockDb = db;
}
