import { ContactModal } from 'integrity-mvp';

export const InvestorInquiry = () => (
  <ContactModal isOpen={true} onClose={() => {}} initialType="investor" />
);

export const DeveloperInquiry = () => (
  <ContactModal isOpen={true} onClose={() => {}} initialType="developer" />
);
