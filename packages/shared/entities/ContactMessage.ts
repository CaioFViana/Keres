export interface ContactMessage {
  id: string;
  subject: string;
  body: string;
  contactEmail: string;
  isRead: boolean;
  createdAt: Date;
}
