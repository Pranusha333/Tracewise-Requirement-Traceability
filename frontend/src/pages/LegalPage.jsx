import { ArrowLeft, GitBranch } from 'lucide-react';
import './legal.css';

const pages = {
  privacy: {
    title: 'Privacy policy',
    intro: 'This page explains what Tracewise stores to provide account access and project traceability.',
    sections: [
      ['Information stored', 'Tracewise stores account name and email, a password hash, workspace membership and settings, and the requirements, test cases, relationships, and analyses you add. Profile image URLs are stored when provided. Passwords are not stored as plain text.'],
      ['Sign-in and email', 'The service uses an HTTP-only session cookie to keep you signed in. Email addresses and one-time codes are used for account verification, sign-in, and password recovery. Resend may process emails sent by the service.'],
      ['AI analysis', 'When an OpenAI provider is configured for your workspace, the requirement and proposed-change information needed for that analysis is sent to OpenAI. Otherwise, the app uses its local analysis. Do not submit sensitive information unless you are authorized to do so.'],
      ['Storage and access', 'Project records are associated with a workspace and the app scopes project API access to that workspace. Data remains in the configured application database while the records are retained by the service operator.'],
      ['Your choices', 'You can update profile information and project settings in the app. Ask the operator of this Tracewise deployment about access, correction, or removal of account and workspace data.'],
      ['Policy changes', 'The operator should update this page when data practices change and provide the effective date for the deployment.'],
    ],
  },
  terms: {
    title: 'Terms of service',
    intro: 'These terms describe basic use of this Tracewise requirements and change-analysis workspace.',
    sections: [
      ['Your account', 'Keep your sign-in credentials and verification codes private. You are responsible for activity performed through your account and for keeping your account information accurate.'],
      ['Project content', 'You retain responsibility for the requirements, test cases, links, and other content you enter. Only add information you have permission to use and share with your workspace.'],
      ['Analysis results', 'Impact and AI results are decision-support information based on project records and the selected change. Review them before relying on them. They may be incomplete, and they do not replace engineering, security, legal, or product review.'],
      ['Acceptable use', 'Do not attempt to access another workspace, disrupt the service, bypass security controls, or use the service unlawfully. Workspace owners manage membership and invite access.'],
      ['Service operation', 'The operator of this deployment manages availability, retention, and support. The service may change as the project evolves. Contact the operator for deployment-specific support or account requests.'],
      ['Updates', 'The operator should update this page when these terms change and provide the effective date for the deployment.'],
    ],
  },
};

export default function LegalPage({ page }) {
  const content = pages[page] || pages.privacy;
  return <main className="legal-page">
    <header className="legal-header"><a className="legal-brand" href="#login"><span><GitBranch size={19} /></span><strong>Tracewise</strong></a><a className="legal-back" href="#login"><ArrowLeft size={15} /> Back to sign in</a></header>
    <article className="legal-document"><p className="legal-eyebrow">TRACEWISE</p><h1>{content.title}</h1><p className="legal-intro">{content.intro}</p>{content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<nav aria-label="Legal pages"><a href="#privacy">Privacy policy</a><a href="#terms">Terms of service</a></nav></article>
  </main>;
}
