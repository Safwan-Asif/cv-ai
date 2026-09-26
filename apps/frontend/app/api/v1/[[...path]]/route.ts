import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  type ResumeRecord,
  type ApplicationStatus,
  type ApplicationRecord,
} from '@/lib/server/mock-db';

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
);

function getPathSegments(params: { path?: string[] } | undefined): string[] {
  return params?.path ?? [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolvedParams = await params;
  const segments = getPathSegments(resolvedParams);
  const path = segments.join('/');
  const { searchParams } = new URL(request.url);

  // 1. /status
  if (path === 'status') {
    return NextResponse.json(db.getSystemStatus());
  }

  // 2. /config/llm-api-key
  if (path === 'config/llm-api-key') {
    return NextResponse.json(db.llmConfig);
  }

  // 3. /config/features
  if (path === 'config/features') {
    return NextResponse.json(db.features);
  }

  // 4. /config/language
  if (path === 'config/language') {
    return NextResponse.json(db.languageConfig);
  }

  // 5. /config/prompts
  if (path === 'config/prompts') {
    return NextResponse.json(db.prompts);
  }

  // 6. /config/feature-prompts
  if (path === 'config/feature-prompts') {
    return NextResponse.json(db.featurePrompts);
  }

  // 7. /config/api-keys
  if (path === 'config/api-keys') {
    const providers = Object.entries(db.apiKeys).map(([provider, key]) => ({
      provider,
      configured: Boolean(key),
      masked_key: key ? `${key.slice(0, 4)}...${key.slice(-3)}` : null,
    }));
    return NextResponse.json({ providers });
  }

  // 8. /resumes (list or single)
  if (path === 'resumes') {
    const resumeId = searchParams.get('resume_id');
    if (resumeId) {
      const resume = db.resumes.get(resumeId);
      if (!resume) {
        return NextResponse.json({ detail: 'Resume not found' }, { status: 404 });
      }
      return NextResponse.json({
        request_id: `req-${Date.now()}`,
        data: resume,
      });
    }

    const includeTailored = searchParams.get('include_tailored') === 'true';
    const list = Array.from(db.resumes.values())
      .filter((r) => includeTailored || r.is_master)
      .map((r) => ({
        resume_id: r.resume_id,
        filename: r.filename,
        is_master: r.is_master,
        parent_id: r.parent_id,
        processing_status: r.raw_resume.processing_status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        title: r.title,
      }));
    return NextResponse.json(list);
  }

  // 9. /resumes/:id/pdf
  if (segments[0] === 'resumes' && segments[2] === 'pdf') {
    return new Response(MINIMAL_PDF, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
      },
    });
  }

  // 10. /resumes/:id/cover-letter/pdf
  if (segments[0] === 'resumes' && segments[2] === 'cover-letter' && segments[3] === 'pdf') {
    return new Response(MINIMAL_PDF, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="cover_letter.pdf"',
      },
    });
  }

  // 11. /resumes/:id/job-description
  if (segments[0] === 'resumes' && segments[2] === 'job-description') {
    const resume = db.resumes.get(segments[1]);
    const jobContent = resume?.job_description || 'Target Job Description for Software Engineer';
    return NextResponse.json({
      job_id: `job-${segments[1]}`,
      content: jobContent,
    });
  }

  // 12. /jobs/:id
  if (segments[0] === 'jobs' && segments[1]) {
    const job = db.jobs.get(segments[1]);
    if (!job) {
      return NextResponse.json({
        id: segments[1],
        content:
          'Sample Job Description: Senior Full Stack Engineer with React, TypeScript, Next.js.',
      });
    }
    return NextResponse.json({ id: job.job_id, content: job.content });
  }

  // 13. /applications
  if (path === 'applications') {
    const columns: Record<ApplicationStatus, ApplicationRecord[]> = {
      saved: [],
      applied: [],
      no_response: [],
      response: [],
      interview: [],
      accepted: [],
      rejected: [],
    };

    for (const app of db.applications.values()) {
      if (columns[app.status]) {
        columns[app.status].push(app);
      }
    }

    for (const col of Object.keys(columns) as ApplicationStatus[]) {
      columns[col].sort((a, b) => a.position - b.position);
    }

    return NextResponse.json({ columns });
  }

  // 14. /applications/:id
  if (segments[0] === 'applications' && segments[1]) {
    const app = db.applications.get(segments[1]);
    if (!app) {
      return NextResponse.json({ detail: 'Application not found' }, { status: 404 });
    }
    const job = db.jobs.get(app.job_id);
    const resume = db.resumes.get(app.resume_id);
    return NextResponse.json({
      ...app,
      job_content: job?.content || null,
      resume: resume ? JSON.parse(JSON.stringify(resume)) : null,
    });
  }

  return NextResponse.json({ message: 'OK' });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolvedParams = await params;
  const segments = getPathSegments(resolvedParams);
  const path = segments.join('/');

  // 1. /config/llm-test
  if (path === 'config/llm-test') {
    return NextResponse.json({
      healthy: true,
      provider: db.llmConfig.provider,
      model: db.llmConfig.model,
      model_output: 'LLM connection tested successfully.',
    });
  }

  // 2. /config/reset
  if (path === 'config/reset') {
    db.seed();
    return NextResponse.json({ message: 'Database reset successfully' });
  }

  // 3. /config/api-keys
  if (path === 'config/api-keys') {
    const body = await request.json().catch(() => ({}));
    Object.assign(db.apiKeys, body);
    return NextResponse.json({ message: 'API keys updated successfully' });
  }

  // 4. /resumes (save/update)
  if (path === 'resumes') {
    const body = await request.json().catch(() => ({}));
    const { resume_id, data, title, cover_letter, outreach_message, interview_prep } = body;
    const now = new Date().toISOString();

    const existing = db.resumes.get(resume_id);
    if (existing) {
      if (data) {
        existing.processed_resume = data;
        existing.raw_resume.content = JSON.stringify(data);
      }
      if (title !== undefined) existing.title = title;
      if (cover_letter !== undefined) existing.cover_letter = cover_letter;
      if (outreach_message !== undefined) existing.outreach_message = outreach_message;
      if (interview_prep !== undefined) existing.interview_prep = interview_prep;
      existing.updated_at = now;
      return NextResponse.json({
        request_id: `req-${Date.now()}`,
        message: 'Resume updated successfully',
      });
    }

    const newResume: ResumeRecord = {
      resume_id: resume_id || `resume-${Date.now()}`,
      filename: 'resume.json',
      is_master: false,
      parent_id: null,
      title: title || 'New Resume',
      raw_resume: {
        id: Date.now(),
        content: JSON.stringify(data || {}),
        content_type: 'application/json',
        created_at: now,
        processing_status: 'ready',
      },
      processed_resume: data || null,
      cover_letter: cover_letter || null,
      outreach_message: outreach_message || null,
      interview_prep: interview_prep || null,
      created_at: now,
      updated_at: now,
    };
    db.resumes.set(newResume.resume_id, newResume);
    return NextResponse.json({
      request_id: `req-${Date.now()}`,
      message: 'Resume created successfully',
      resume_id: newResume.resume_id,
    });
  }

  // 5. /resumes/upload
  if (path === 'resumes/upload') {
    const now = new Date().toISOString();
    const newId = `resume-${Date.now()}`;
    // Clone master template as parsed resume
    const master = Array.from(db.resumes.values()).find((r) => r.is_master);
    const parsedData = master ? JSON.parse(JSON.stringify(master.processed_resume)) : {};

    const newResume: ResumeRecord = {
      resume_id: newId,
      filename: 'Uploaded_Resume.pdf',
      is_master: db.resumes.size === 0,
      parent_id: null,
      title: 'Uploaded Resume',
      raw_resume: {
        id: Date.now(),
        content: JSON.stringify(parsedData),
        content_type: 'application/pdf',
        created_at: now,
        processing_status: 'ready',
      },
      processed_resume: parsedData,
      created_at: now,
      updated_at: now,
    };
    db.resumes.set(newId, newResume);

    return NextResponse.json({
      message: 'Resume uploaded and parsed successfully',
      request_id: `req-${Date.now()}`,
      resume_id: newId,
      processing_status: 'ready',
      is_master: newResume.is_master,
    });
  }

  // 6. /resumes/:id/retry-processing
  if (segments[0] === 'resumes' && segments[2] === 'retry-processing') {
    const resumeId = segments[1];
    const resume = db.resumes.get(resumeId);
    if (resume) {
      resume.raw_resume.processing_status = 'ready';
    }
    return NextResponse.json({
      resume_id: resumeId,
      processing_status: 'ready',
    });
  }

  // 7. /resumes/improve/preview
  if (path === 'resumes/improve/preview') {
    const body = await request.json().catch(() => ({}));
    const { resume_id, job_description } = body;
    const baseResume = db.resumes.get(resume_id);
    const resumeData = baseResume ? JSON.parse(JSON.stringify(baseResume.processed_resume)) : {};

    const jobId = `job-${Date.now()}`;
    db.jobs.set(jobId, {
      job_id: jobId,
      title: 'Tailored Job Opportunity',
      company: 'Target Company',
      content: job_description || 'Software Engineer',
      created_at: new Date().toISOString(),
    });

    const previewId = `prev-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    // Enhance bullet points in resume_preview
    if (resumeData.workExperience && resumeData.workExperience.length > 0) {
      resumeData.workExperience[0].description = [
        `Spearheaded critical engineering initiatives directly aligning with ${job_description?.slice(0, 40) || 'system requirements'}.`,
        ...(resumeData.workExperience[0].description || []).slice(1),
      ];
    }

    const improvements = [
      {
        suggestion:
          'Highlighted architectural leadership and relevant core technologies from job requirements.',
        lineNumber: 1,
      },
      {
        suggestion: 'Optimized technical keywords and quantifiable impact for ATS indexing.',
        lineNumber: 2,
      },
    ];

    const analysis = {
      match_score: 92,
      matching_keywords: ['TypeScript', 'Next.js', 'React', 'APIs', 'Docker', 'Scalability'],
      missing_keywords: ['GraphQL'],
      recommendations: [
        'Emphasize distributed system scaling in work experience.',
        'Include measurable metrics for performance improvements.',
      ],
    };

    return NextResponse.json({
      request_id: `req-${Date.now()}`,
      data: {
        resume_id,
        job_id: jobId,
        preview_id: previewId,
        preview_expires_at: expiresAt,
        resume_preview: resumeData,
        improvements,
        analysis,
        diffs: [],
        missing_diffs: [],
      },
    });
  }

  // 8. /resumes/improve/confirm
  if (path === 'resumes/improve/confirm') {
    const body = await request.json().catch(() => ({}));
    const { resume_id, job_id, improved_data } = body;
    const now = new Date().toISOString();
    const newResumeId = `tailored-${Date.now()}`;

    const parentResume = db.resumes.get(resume_id);
    const job = db.jobs.get(job_id);

    const tailoredResume: ResumeRecord = {
      resume_id: newResumeId,
      filename: `Tailored_${job?.company || 'Job'}_Resume.pdf`,
      is_master: false,
      parent_id: resume_id,
      title: `Tailored - ${job?.company || 'Target Company'} (${job?.title || 'Engineer'})`,
      raw_resume: {
        id: Date.now(),
        content: JSON.stringify(improved_data),
        content_type: 'application/json',
        created_at: now,
        processing_status: 'ready',
      },
      processed_resume: improved_data,
      cover_letter: parentResume?.cover_letter || null,
      outreach_message: parentResume?.outreach_message || null,
      interview_prep: parentResume?.interview_prep || null,
      job_description: job?.content || null,
      created_at: now,
      updated_at: now,
    };
    db.resumes.set(newResumeId, tailoredResume);
    db.improvementsCount += 1;

    // Auto-create application in Tracker
    const newAppId = `app-${Date.now()}`;
    db.applications.set(newAppId, {
      application_id: newAppId,
      job_id: job_id || `job-${Date.now()}`,
      resume_id: newResumeId,
      master_resume_id: resume_id,
      status: 'saved',
      company: job?.company || 'Target Company',
      role: job?.title || 'Software Engineer',
      applied_at: null,
      notes: 'Tailored resume generated.',
      position: db.applications.size,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      request_id: `req-${Date.now()}`,
      data: tailoredResume,
    });
  }

  // 9. /resumes/:id/generate-cover-letter
  if (segments[0] === 'resumes' && segments[2] === 'generate-cover-letter') {
    const content =
      'Dear Hiring Team,\n\nI am excited to submit my tailored application for this opportunity. My track record in delivering robust, high-performance web systems and full-stack solutions makes me a strong fit for your team’s strategic goals.\n\nThank you for your consideration.\n\nSincerely,\nJane Doe';
    const resume = db.resumes.get(segments[1]);
    if (resume) resume.cover_letter = content;
    return NextResponse.json({ content });
  }

  // 10. /resumes/:id/generate-outreach
  if (segments[0] === 'resumes' && segments[2] === 'generate-outreach') {
    const content =
      'Hi! I recently applied to the engineering position and wanted to share how excited I am about your mission. With extensive experience in modern full-stack development, I would welcome the chance to connect briefly.';
    const resume = db.resumes.get(segments[1]);
    if (resume) resume.outreach_message = content;
    return NextResponse.json({ content });
  }

  // 11. /resumes/:id/generate-interview-prep
  if (segments[0] === 'resumes' && segments[2] === 'generate-interview-prep') {
    const prep = {
      company_insights:
        'Focuses on engineering excellence, scalable cloud platforms, and collaborative agile execution.',
      role_expectations:
        'Build features with high reliability, mentor peers, and drive architectural choices.',
      likely_questions: [
        {
          question: 'How do you design APIs that withstand unexpected traffic surges?',
          guidance:
            'Discuss rate limiting, horizontal scaling, caching layers, and database sharding.',
        },
        {
          question: 'What is your strategy for handling tech debt while shipping new features?',
          guidance:
            'Balance refactoring sprints with product roadmaps and establish test safety nets.',
        },
      ],
    };
    const resume = db.resumes.get(segments[1]);
    if (resume) resume.interview_prep = prep;
    return NextResponse.json({ interview_prep: prep });
  }

  // 12. /jobs
  if (path === 'jobs') {
    const now = new Date().toISOString();
    const jobId = `job-${Date.now()}`;
    const contentType = request.headers.get('content-type') || '';
    let jobContent = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        for (const [, value] of formData.entries()) {
          if (typeof value === 'string') {
            jobContent += value + '\n';
          } else if (value instanceof File) {
            jobContent += (await value.text().catch(() => '')) + '\n';
          }
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      jobContent = body.content || body.job_description || 'Software Engineer position';
    }

    db.jobs.set(jobId, {
      job_id: jobId,
      title: 'Software Engineer',
      company: 'Company',
      content: jobContent,
      created_at: now,
    });

    return NextResponse.json({
      message: 'Job descriptions uploaded successfully',
      request_id: `req-${Date.now()}`,
      job_ids: [jobId],
    });
  }

  // 13. /applications
  if (path === 'applications') {
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    const appId = `app-${Date.now()}`;
    const jobId = body.job_id || `job-${Date.now()}`;

    if (!db.jobs.has(jobId) && body.job_description) {
      db.jobs.set(jobId, {
        job_id: jobId,
        title: body.role || 'Role',
        company: body.company || 'Company',
        content: body.job_description,
        created_at: now,
      });
    }

    const application: ApplicationRecord = {
      application_id: appId,
      job_id: jobId,
      resume_id: body.resume_id,
      master_resume_id: body.master_resume_id || body.resume_id,
      status: body.status || 'saved',
      company: body.company || 'Target Company',
      role: body.role || 'Role',
      applied_at: body.status === 'applied' ? now : null,
      notes: body.notes || '',
      position: db.applications.size,
      created_at: now,
      updated_at: now,
    };
    db.applications.set(appId, application);
    return NextResponse.json(application);
  }

  // 14. /applications/reorder
  if (path === 'applications/reorder') {
    const body = await request.json().catch(() => ({}));
    const { status, application_ids } = body as {
      status: ApplicationStatus;
      application_ids: string[];
    };
    if (Array.isArray(application_ids)) {
      application_ids.forEach((id, idx) => {
        const app = db.applications.get(id);
        if (app) {
          app.status = status;
          app.position = idx;
          app.updated_at = new Date().toISOString();
        }
      });
    }
    return NextResponse.json({
      message: 'Applications reordered',
      affected: application_ids?.length || 0,
    });
  }

  // 15. /resume-wizard/turn
  if (path === 'resume-wizard/turn') {
    const body = await request.json().catch(() => ({}));
    const { state, action, answer } = body;
    const nextState = { ...state };

    const questions = [
      { text: 'What is your full name and current professional title?', section: 'contact' },
      {
        text: 'Provide a brief summary of your background, years of experience, and key strengths.',
        section: 'summary',
      },
      {
        text: 'What was your most recent work role, company, dates, and primary accomplishments?',
        section: 'workExperience',
      },
      {
        text: 'What education, degrees, and academic institutions did you attend?',
        section: 'education',
      },
      {
        text: 'Have you built any notable personal projects or open-source software?',
        section: 'personalProjects',
      },
      {
        text: 'What technical skills, programming languages, and tools are you proficient in?',
        section: 'skills',
      },
    ];

    if (action === 'answer' && answer?.text) {
      nextState.asked_count = (nextState.asked_count || 0) + 1;
      const qIdx = Math.min(nextState.asked_count, questions.length - 1);
      nextState.current_question = questions[qIdx];
      if (nextState.asked_count >= questions.length) {
        nextState.step = 'review';
      }
    } else if (action === 'review') {
      nextState.step = 'review';
    } else if (action === 'skip') {
      nextState.asked_count = (nextState.asked_count || 0) + 1;
      const qIdx = Math.min(nextState.asked_count, questions.length - 1);
      nextState.current_question = questions[qIdx];
    }

    return NextResponse.json({ state: nextState });
  }

  // 16. /resume-wizard/finalize
  if (path === 'resume-wizard/finalize') {
    const body = await request.json().catch(() => ({}));
    const state = body.state || body;
    const now = new Date().toISOString();
    const newId = `wizard-${Date.now()}`;

    const newResume: ResumeRecord = {
      resume_id: newId,
      filename: 'Master_Resume_Wizard.pdf',
      is_master: true,
      parent_id: null,
      title: 'Master Resume (Wizard)',
      raw_resume: {
        id: Date.now(),
        content: JSON.stringify(state.resume_data || {}),
        content_type: 'application/json',
        created_at: now,
        processing_status: 'ready',
      },
      processed_resume: state.resume_data || null,
      created_at: now,
      updated_at: now,
    };
    db.resumes.set(newId, newResume);

    return NextResponse.json({
      message: 'Resume finalized successfully',
      request_id: `req-${Date.now()}`,
      resume_id: newId,
    });
  }

  // 17. /enrichment/start
  if (path === 'enrichment/start') {
    return NextResponse.json({
      items_to_enrich: [
        {
          item_id: 'exp-1',
          item_type: 'experience',
          title: 'Senior Software Engineer',
          subtitle: 'TechCorp Solutions',
          current_description: ['Built web applications and improved deployment pipelines.'],
          weakness_reason: 'Lacks quantifiable outcomes and architectural details.',
        },
      ],
      questions: [
        {
          question_id: 'q-1',
          item_id: 'exp-1',
          question:
            'What specific metrics or throughput gains did your pipeline improvements achieve?',
          placeholder: 'e.g. Reduced build times by 40% and improved uptime to 99.9%',
        },
      ],
      analysis_summary: 'Identified 1 area for quantifiable enhancement.',
    });
  }

  // 18. /enrichment/answer
  if (path === 'enrichment/answer') {
    return NextResponse.json({
      enhancements: [
        {
          item_id: 'exp-1',
          item_type: 'experience',
          title: 'Senior Software Engineer',
          original_description: ['Built web applications and improved deployment pipelines.'],
          enhanced_description: [
            'Architected high-throughput web applications handling 100K+ DAU, reducing deployment cycle times by 40% and maintaining 99.9% uptime.',
          ],
        },
      ],
    });
  }

  // 19. /enrichment/finalize
  if (path === 'enrichment/finalize') {
    return NextResponse.json({
      message: 'Enrichment successfully applied',
      request_id: `req-${Date.now()}`,
    });
  }

  return NextResponse.json({ message: 'OK' });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolvedParams = await params;
  const segments = getPathSegments(resolvedParams);
  const path = segments.join('/');
  const body = await request.json().catch(() => ({}));

  if (path === 'config/llm-api-key') {
    if (body.provider) db.llmConfig.provider = body.provider;
    if (body.model) db.llmConfig.model = body.model;
    if (body.api_key !== undefined) db.llmConfig.api_key = body.api_key;
    if (body.api_base !== undefined) db.llmConfig.api_base = body.api_base;
    if (body.reasoning_effort !== undefined) db.llmConfig.reasoning_effort = body.reasoning_effort;
    return NextResponse.json(db.llmConfig);
  }

  if (path === 'config/features') {
    Object.assign(db.features, body);
    return NextResponse.json(db.features);
  }

  if (path === 'config/language') {
    if (body.ui_language) db.languageConfig.ui_language = body.ui_language;
    if (body.content_language) db.languageConfig.content_language = body.content_language;
    return NextResponse.json(db.languageConfig);
  }

  if (path === 'config/prompts') {
    if (body.default_prompt_id) db.prompts.default_prompt_id = body.default_prompt_id;
    return NextResponse.json(db.prompts);
  }

  if (path === 'config/feature-prompts') {
    Object.assign(db.featurePrompts, body);
    return NextResponse.json(db.featurePrompts);
  }

  return NextResponse.json({ message: 'OK' });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolvedParams = await params;
  const segments = getPathSegments(resolvedParams);
  const body = await request.json().catch(() => ({}));

  // /resumes/:id/title
  if (segments[0] === 'resumes' && segments[2] === 'title') {
    const resume = db.resumes.get(segments[1]);
    if (resume) {
      resume.title = body.title;
      resume.updated_at = new Date().toISOString();
    }
    return NextResponse.json({ message: 'Title updated successfully' });
  }

  // /resumes/:id/cover-letter
  if (segments[0] === 'resumes' && segments[2] === 'cover-letter') {
    const resume = db.resumes.get(segments[1]);
    if (resume) {
      resume.cover_letter = body.content;
      resume.updated_at = new Date().toISOString();
    }
    return NextResponse.json({ message: 'Cover letter updated successfully' });
  }

  // /resumes/:id/outreach-message
  if (segments[0] === 'resumes' && segments[2] === 'outreach-message') {
    const resume = db.resumes.get(segments[1]);
    if (resume) {
      resume.outreach_message = body.content;
      resume.updated_at = new Date().toISOString();
    }
    return NextResponse.json({ message: 'Outreach message updated successfully' });
  }

  // /applications/:id
  if (segments[0] === 'applications' && segments[1]) {
    const app = db.applications.get(segments[1]);
    if (!app) {
      return NextResponse.json({ detail: 'Application not found' }, { status: 404 });
    }
    Object.assign(app, body, { updated_at: new Date().toISOString() });
    return NextResponse.json(app);
  }

  return NextResponse.json({ message: 'OK' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolvedParams = await params;
  const segments = getPathSegments(resolvedParams);
  const { searchParams } = new URL(request.url);

  // /resumes/:id or /resumes?resume_id=...
  if (segments[0] === 'resumes') {
    const id = segments[1] || searchParams.get('resume_id');
    if (id) {
      db.resumes.delete(id);
    }
    return NextResponse.json({ message: 'Resume deleted successfully' });
  }

  // /config/api-keys or /config/api-keys/:provider
  if (segments[0] === 'config' && segments[1] === 'api-keys') {
    if (segments[2]) {
      delete db.apiKeys[segments[2]];
    } else {
      db.apiKeys = {};
    }
    return NextResponse.json({ message: 'API key(s) removed' });
  }

  // /applications/:id
  if (segments[0] === 'applications' && segments[1]) {
    db.applications.delete(segments[1]);
    return NextResponse.json({ message: 'Application deleted successfully' });
  }

  return NextResponse.json({ message: 'OK' });
}
