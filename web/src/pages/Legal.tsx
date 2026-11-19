import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { BRAND, contactLine } from '../lib/brand';
import { PLANS } from '../../../src/shared/plans';
import '../landing.css';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lp">
      <header className="lp-nav"><div className="lp-wrap lp-nav-inner"><Link to="/" className="logo-link"><Logo /></Link><span style={{ flex: 1 }} /><Link className="btn btn-sm" to="/">Back to home</Link></div></header>
      <article className="legal">
        <h1>{title}</h1>
        <p className="subtle">Last updated {BRAND.lastUpdated}</p>
        {children}
      </article>
      <footer className="lp-footer"><div className="lp-wrap row between wrap"><span className="subtle">© {new Date().getFullYear()} {BRAND.legalName}</span><div className="row" style={{ gap: 18 }}><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></div></footer>
    </div>
  );
}

export function PrivacyPage() {
  const n = BRAND.legalName;
  return (
    <Shell title="Privacy Policy">
      <p>This policy explains what {n} (“we”, “us”) collects when you use the FormPilot website, dashboard and Chrome extension (together, “FormPilot”), why, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and an encrypted password, managed by Google Firebase Authentication.</li>
        <li><strong>Your profile:</strong> the information you choose to add, such as your name, contact details, work history, education, skills and saved answers.</li>
        <li><strong>Documents you upload:</strong> CVs and similar files, stored privately in your account, and the information extracted from them.</li>
        <li><strong>Usage counts:</strong> how many AI answers and document imports you used each month, so we can apply plan limits.</li>
        <li><strong>Billing details:</strong> if you subscribe, Stripe processes your payment. We receive a customer reference and your subscription status. We never see or store your full card number.</li>
      </ul>

      <h2>What the extension reads</h2>
      <p>The extension reads a web page only when you click <em>Scan</em>. It collects the form’s questions, labels and options to draft answers. It does not read password fields, payment card fields, ID-number fields, file uploads or hidden fields, and it never submits forms. Page content is used to draft your answers and is not stored by us afterwards.</p>

      <h2>How AI is used</h2>
      <p>To draft answers and to extract information from your documents, we send the relevant content to our AI provider, Anthropic, through its API. We send only the parts of your profile needed for the questions on the page. Contact details such as your email address, phone number and street address are filled directly from your profile and are not sent to the AI. Under Anthropic’s commercial API terms, this data is not used to train its models.</p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide FormPilot: storing your profile, drafting answers and filling forms when you approve them.</li>
        <li>To run your account, apply plan limits and process subscriptions.</li>
        <li>To keep the service secure and fix problems.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for advertising.</p>

      <h2>Who we share it with</h2>
      <p>Only the service providers that run FormPilot for us: Google Firebase (authentication, database and file storage), Netlify (website and servers), Anthropic (AI answer generation) and Stripe (payments). Each processes data only to provide its service to us. We may also disclose information if the law requires it.</p>

      <h2>Security</h2>
      <p>Your data is stored under your account and protected by access rules, so it can only be read by you while you are signed in. Data is encrypted in transit. No system is perfectly secure, but we design FormPilot to share as little as possible.</p>

      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is open. You can delete your profile and uploaded documents at any time from the Account page. To close your account entirely, contact us at {contactLine()} and we will delete your account data, except records we must keep for legal or tax reasons.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct, export or delete your personal information, or to object to how it is processed. Most of this you can do yourself in the dashboard; for anything else, contact us at {contactLine()}.</p>

      <h2>Children</h2>
      <p>FormPilot is not intended for anyone under 16, and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we make material changes to this policy, we will update the date above and, where appropriate, notify you by email.</p>
    </Shell>
  );
}

export function TermsPage() {
  const n = BRAND.legalName;
  return (
    <Shell title="Terms of Service">
      <p>These terms govern your use of FormPilot, provided by {n}. By creating an account or using FormPilot you agree to them.</p>

      <h2>The service</h2>
      <p>FormPilot helps you complete online forms by drafting answers from information you provide and filling them in once you approve them. FormPilot never submits forms for you.</p>

      <h2>Your responsibilities</h2>
      <ul>
        <li><strong>You review and submit.</strong> AI-drafted answers can be incomplete or wrong. You are responsible for checking every answer and for everything you submit.</li>
        <li><strong>Accurate information.</strong> Keep your profile truthful. Don’t use FormPilot to submit false or misleading information.</li>
        <li><strong>Acceptable use.</strong> Don’t use FormPilot to break the law or another website’s terms, to send spam or automated bulk submissions, or to fill forms on behalf of someone without their permission. Don’t try to disrupt, reverse-engineer or overload the service.</li>
        <li><strong>Your account.</strong> Keep your password secure. You are responsible for activity under your account.</li>
      </ul>

      <h2>Your content</h2>
      <p>You own your profile, your documents and the answers FormPilot drafts for you. You give us permission to store and process them only to provide FormPilot to you, as described in our <Link to="/privacy">Privacy Policy</Link>.</p>

      <h2>Plans and billing</h2>
      <ul>
        <li>The Free plan includes {PLANS.free.aiAnswers} AI-written answers and {PLANS.free.imports} document imports a month. Pro costs ${PLANS.pro.monthlyUsd} a month or ${PLANS.pro.yearlyUsd} a year, plus any applicable taxes, and includes {PLANS.pro.aiAnswers.toLocaleString()} AI-written answers and {PLANS.pro.imports} imports a month.</li>
        <li>Subscriptions renew automatically until you cancel. You can cancel anytime from the Account page, and you keep Pro until the end of the period you’ve paid for.</li>
        <li>Payments are processed by Stripe. Fees already paid are not refundable, except where the law requires it or we decide otherwise.</li>
        <li>We may change prices or plan limits with at least 30 days’ notice. Changes apply from your next billing period.</li>
      </ul>

      <h2>Availability and changes</h2>
      <p>We work to keep FormPilot available and accurate, but it is provided “as is” and “as available”. It may not work on every website, and we may change or discontinue features.</p>

      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, {n} is not liable for indirect or consequential losses, or for the outcome of any application or form you submit. Our total liability for any claim relating to FormPilot is limited to the amount you paid us in the 12 months before the claim.</p>

      <h2>Ending your use</h2>
      <p>You can stop using FormPilot and delete your data at any time. We may suspend or close accounts that break these terms.</p>

      <h2>Changes to these terms</h2>
      <p>If we change these terms in a material way, we will update the date above and notify you where appropriate. Continuing to use FormPilot after a change means you accept the new terms.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: {contactLine()}.</p>
    </Shell>
  );
}
