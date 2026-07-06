# Personal Assistant: Family Vault 🔒

Family Vault is a secure digital document locker and AI-powered voice/text assistant designed specifically for non-technical or elderly family members.

## 📂 Project Structure

*   **`frontend/`**: Next.js App Router frontend built with Tailwind CSS, Lucide icons, TipTap rich-text notes editor, and voice assistant UI hooks.
*   **`backend/`**: Express.js REST API with TypeScript, Mongoose/MongoDB Atlas Vector Search integration, AWS Textract OCR, AWS Bedrock AI integrations, and stateless Auth0 JWT validation.

---

## 🛠️ Setup Instructions

### Backend (Express API)
1. Navigate to `backend/`
2. Run `npm install`
3. Create `.env` from `.env.example`
4. Start the development server using:
   ```bash
   npm run dev
   ```

### Frontend (Next.js App Router)
1. Navigate to `frontend/`
2. Run `npm install`
3. Create `.env` from `.env.example`
4. Start the development server using:
   ```bash
   npm run dev
   ```

---

## 🔒 Security & Multi-Tenancy

Every API endpoint requires a stateless JWT token issued by Auth0 validation via `express-oauth2-jwt-bearer`. 
Database level isolation checks the verified user identifier (`auth0UserId`) from the Auth0 `sub` claim on all operations.
