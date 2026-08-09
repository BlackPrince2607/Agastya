/**
 * In-app policy copy (mirrors `legal/*.html` for sharvo.online / Play Console).
 * Privacy + Terms synced from Google Docs (see LEGAL_GOOGLE_DOCS in constants/legal.ts).
 */
import type { LegalDocId } from '@/constants/legal';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'bullets'; items: string[] };

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  meta: string;
  blocks: LegalBlock[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    meta: 'Effective Date: 3rd Aug 2026',
    blocks: [
      {
        type: 'p',
        text: 'Agastya app respects your privacy and is committed to protecting it. This Privacy Policy explains what information we collect, how we use it, and how we keep it safe when you use the Agastya app mobile application.',
      },
      {
        type: 'p',
        text: 'Agastya app is developed and operated by Aman Mishra and is offered as a subscription-based AI companion and learning app.',
      },
      { type: 'p', text: 'By using Agastya app, you agree to this Privacy Policy.' },
      { type: 'h2', text: '1. Information We Collect' },
      { type: 'h3', text: 'a. Information You Provide' },
      {
        type: 'bullets',
        items: [
          'Account Information: Name, gender, phone number, or Google/Apple login details used for sign-in and personalization.',
          'Chat Data: Messages and inputs shared while interacting with Agastya app. These are used to generate responses and improve AI quality. Chat data may be processed by third-party AI services.',
          'Palm Photos: Images you capture for palm reading. These are used to generate your reading and may be stored securely for a limited time.',
        ],
      },
      { type: 'h3', text: 'b. Automatically Collected Information' },
      {
        type: 'bullets',
        items: [
          'Device Information: Device model, operating system version, app version, and language settings.',
          'Usage Information: App interactions, features used, session duration, and navigation behavior.',
          'Diagnostics & Analytics: Crash logs and performance data to improve stability and user experience.',
        ],
      },
      { type: 'p', text: 'We may use the following third-party services:' },
      {
        type: 'bullets',
        items: ['Google Play Services', 'Firebase Analytics', 'Firebase Crashlytics'],
      },
      { type: 'h3', text: 'c. Payment Information' },
      {
        type: 'p',
        text: 'If you purchase an Agastya app Plus subscription, payments are processed securely through Google Play Billing or Apple App Store.',
      },
      {
        type: 'p',
        text: 'We do not collect, store, or access your full payment or card details.',
      },
      { type: 'h2', text: '2. How We Use Your Information' },
      { type: 'p', text: 'We use collected information to:' },
      {
        type: 'bullets',
        items: [
          'Provide personalized AI conversations and recommendations',
          'Improve app performance, features, and reliability',
          'Manage subscriptions and premium access',
          'Send important service-related updates or support messages',
          'Comply with legal and regulatory requirements',
        ],
      },
      { type: 'h2', text: '3. Data Sharing and Disclosure' },
      { type: 'p', text: 'We do not sell or rent your personal data.' },
      { type: 'p', text: 'We may share limited data only with:' },
      {
        type: 'bullets',
        items: [
          'Service Providers: Trusted partners for hosting, analytics, crash reporting, customer support, and subscription processing.',
          'Legal Authorities: When required by law or to protect user safety, rights, or legal obligations.',
        ],
      },
      {
        type: 'p',
        text: 'All partners are required to follow strict confidentiality and data protection standards.',
      },
      { type: 'h2', text: '4. Data Security' },
      {
        type: 'p',
        text: 'We use reasonable administrative, technical, and organizational safeguards to protect your data.',
      },
      {
        type: 'p',
        text: 'However, no method of transmission or storage is completely secure. Please avoid sharing sensitive personal or financial information during chats.',
      },
      { type: 'h2', text: '5. Data Retention' },
      {
        type: 'bullets',
        items: [
          'Personal data is retained only as long as necessary to operate Agastya app and comply with legal requirements.',
          'Anonymous and aggregated usage data may be retained for up to 24 months for analytics and improvement.',
          'You may request deletion of your personal data at any time.',
        ],
      },
      { type: 'h2', text: '6. User Rights and Controls' },
      { type: 'p', text: 'You can:' },
      {
        type: 'bullets',
        items: [
          'Update or delete your profile information within the app',
          'Request deletion of your chat or account data (where applicable)',
          'Opt out of non-essential communications',
        ],
      },
      {
        type: 'p',
        text: 'To exercise these rights, contact us at: ajaman293@gmail.com',
      },
      {
        type: 'p',
        text: 'You may also delete your account in the app (Profile → Delete account) or use https://sharvo.online/delete-account',
      },
      { type: 'h2', text: "7. Children's Privacy" },
      {
        type: 'p',
        text: 'Agastya app is not intended for children under 13 years of age.',
      },
      {
        type: 'p',
        text: 'We do not knowingly collect personal data from children. If such data is identified, it will be deleted promptly upon notification.',
      },
      { type: 'h2', text: '8. Third-Party Links' },
      {
        type: 'p',
        text: 'The app may contain links to third-party services. We are not responsible for their privacy practices. Please review their policies separately.',
      },
      { type: 'h2', text: '9. Changes to This Policy' },
      {
        type: 'p',
        text: 'We may update this Privacy Policy from time to time. Updates will be posted within the app with a revised effective date. Continued use of the app means you accept the updated policy.',
      },
      { type: 'h2', text: '10. Contact Information' },
      {
        type: 'p',
        text: 'If you have questions or concerns about this Privacy Policy, contact us at:',
      },
      {
        type: 'bullets',
        items: ['Email: ajaman293@gmail.com', 'App Name: Agastya app'],
      },
    ],
  },
  terms: {
    id: 'terms',
    title: 'Terms and Conditions',
    meta: 'Last Update: December 6th, 2024',
    blocks: [
      {
        type: 'p',
        text: 'This End User License Agreement (“Agreement”) is between you and Agastya App, (“us”, “we”, “our” or “Agastya App”) and governs the use of “Agastya” app (“the app”) made available through the Google Play Store. By installing the app, you agree to be bound by this Agreement and understand that there is no tolerance for objectionable content. If you do not agree with the terms and conditions of this Agreement, you are not entitled to use the app. In order to ensure that Agastya App provides the best experience possible for everyone, we strongly enforce a no tolerance policy for objectionable content.',
      },
      { type: 'h2', text: 'Parties' },
      {
        type: 'p',
        text: 'This Agreement is between you and Agastya App, (“Agastya App”) only, and not Google, Inc. ("Google") or Facebook, Inc. ("Facebook"). Notwithstanding the foregoing, you acknowledge that Google or Facebook and their subsidiaries are third party beneficiaries of this Agreement and Google or Facebook has the right to enforce this Agreement against you. Agastya App, not Google or Facebook, is solely responsible for the app and its content.',
      },
      { type: 'h2', text: 'Privacy' },
      {
        type: 'p',
        text: 'We may collect and use information about your usage of the app, including certain types of information from and about your device. We may use this information, as long as it is in a form that does not personally identify you, to measure the use and performance of the app. See also our Privacy Policy in the app and at https://sharvo.online/privacy.',
      },
      { type: 'h2', text: 'The Security of Your Personal Data' },
      {
        type: 'p',
        text: 'We take steps to ensure that your information is treated securely and in accordance with this policy. Unfortunately, the transmission of information via the internet is not completely secure. Although we will do our best to protect your information, for example, by encryption, we cannot guarantee the security of your information transmitted through the Platform; any transmission is at your own risk.',
      },
      {
        type: 'p',
        text: 'We have appropriate technical and organizational measures to ensure a level of security appropriate to the risk of varying likelihood and severity for the rights and freedoms of you and other users. We maintain these technical and organizational measures and will amend them from time to time to improve the overall security of our systems.',
      },
      {
        type: 'p',
        text: 'We will, from time to time, include links to and from the websites of our partner networks, advertisers and affiliates. If you follow a link to any of these websites, please note that these websites have their own privacy policies and that we do not accept any responsibility or liability for these policies. Please check these policies before you submit any information to these websites.',
      },
      { type: 'h2', text: 'Data Retention' },
      {
        type: 'p',
        text: 'We use the following criteria to determine the period for which we will keep your information:',
      },
      {
        type: 'bullets',
        items: [
          'our contractual obligations and rights in relation to the information involved;',
          'legal obligation(s) under applicable law(s) and regulations to retain data for a certain period of time;',
          'statute of limitations under applicable law(s);',
          'our legitimate business purposes; and',
          'disputes or potential disputes.',
        ],
      },
      {
        type: 'p',
        text: 'We will not retain sensitive personal data or information for longer than is required for the purposes for which such information may be lawfully used or is otherwise required under any law for the time being in force.',
      },
      {
        type: 'p',
        text: 'After you have terminated your use of our Services, we can store your information in an aggregated and anonymized format. Notwithstanding the foregoing, we can also retain any personal information as reasonably necessary to comply with our legal obligations, allow us to resolve and litigate disputes, and to enforce our agreements.',
      },
      { type: 'h2', text: 'Limited License' },
      {
        type: 'p',
        text: 'We grant you a limited, non-exclusive, non-transferable, revocable license to use the app for your personal, non-commercial purposes. You may only use the app on Android devices that you own or control and as permitted by the Play Store Terms of Service.',
      },
      { type: 'h2', text: 'Age Restrictions' },
      {
        type: 'p',
        text: 'By using the app, you represent and warrant that (a) you are 13 years of age or older and you agree to be bound by this Agreement; (b) if you are under 13 years of age, you have obtained verifiable consent from a parent or legal guardian; and (c) your use of the app does not violate any applicable law or regulation. Your access to the app may be terminated without warning if we believe, in our sole discretion, that you are under the age of 13 years and have not obtained verifiable consent from a parent or legal guardian. If you are a parent or legal guardian and you provide your consent to your child’s use of the app, you agree to be bound by this Agreement in respect to your child’s use of the app.',
      },
      { type: 'h2', text: 'Warranty' },
      {
        type: 'p',
        text: 'Agastya App disclaims all warranties about the app to the fullest extent permitted by law. To the extent any warranty exists under law that cannot be disclaimed, Agastya App, not Google or Facebook, shall be solely responsible for such warranty.',
      },
      { type: 'h2', text: 'Maintenance and Support' },
      {
        type: 'p',
        text: 'Agastya App does provide minimal maintenance or support for it but not to the extent that any maintenance or support is required by applicable law. Agastya App, not Google or Facebook, shall be obligated to furnish any such maintenance or support.',
      },
      { type: 'h2', text: 'Product Claims' },
      {
        type: 'p',
        text: 'Agastya App, not Google or Facebook, is responsible for addressing any claims by you relating to the app or use of it, including, but not limited to: (i) any product liability claim; (ii) any claim that the app fails to conform to any applicable legal or regulatory requirement; and (iii) any claim arising under consumer protection or similar legislation. Nothing in this Agreement shall be deemed an admission that you may have such claims.',
      },
      { type: 'h2', text: 'Third Party Intellectual Property Claims' },
      {
        type: 'p',
        text: 'Agastya App shall not be obligated to indemnify or defend you with respect to any third party claim arising out of or relating to the app. To the extent Agastya App is required to provide indemnification by applicable law, Agastya App, not Apple, shall be solely responsible for the investigation, defense, settlement and discharge of any claim that the app or your use of it infringes any third party intellectual property rights.',
      },
      { type: 'h2', text: 'Contact Us' },
      {
        type: 'p',
        text: 'If you have any questions regarding the EULA, please contact us at ajaman293@gmail.com',
      },
    ],
  },
  support: {
    id: 'support',
    title: 'Support',
    meta: 'Agastya · Palm reading & AI guide',
    blocks: [
      {
        type: 'p',
        text: 'Need help with the Agastya app, Premium unlock, or your account?',
      },
      { type: 'h2', text: 'Contact' },
      {
        type: 'bullets',
        items: [
          'Email: ajaman293@gmail.com',
          'Support (alt): support@sharvo.online',
        ],
      },
      { type: 'h2', text: 'Common topics' },
      {
        type: 'bullets',
        items: [
          'Premium not unlocking after payment: Profile → Check premium status. If you paid with Razorpay, reopen the return link or wait a few minutes.',
          'Palm scan issues: Use good lighting, show a flat open palm, and grant camera permission.',
          'Delete account: Profile → Delete account (signed in), or use the web form at sharvo.online/delete-account.',
        ],
      },
      { type: 'h2', text: 'Legal' },
      {
        type: 'bullets',
        items: [
          'Privacy Policy and Terms of Use are available in the app under Profile → About.',
          'Public copies for Google Play: https://sharvo.online/privacy and https://sharvo.online/terms',
        ],
      },
    ],
  },
};
