# AuchP.ltd Website Starter

Responsive custom-coded website starter with:
- Landing page for website development, graphic design, cyber services and revision papers
- Admin login, upload/publish/hide/delete paper management
- Orders dashboard and SQLite database
- Automatic pricing: Play Group–PP2 KSh 30; Grade 1–3 KSh 45; Grade 4–6 KSh 55; Grade 7–9 KSh 90
- Mobile/tablet/desktop responsive layout

## Run locally
1. Extract this ZIP and install Node.js 20+.
2. In the project folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `JWT_SECRET` to a long random value (at least 32 characters).
5. Change `ADMIN_PASSWORD` to a strong private password.
6. Run `npm start`.
7. Open `http://localhost:3000` and `http://localhost:3000/admin.html`.

## Payment status — important
Checkout creates a **pending** order only. It does not take money or mark an order paid. Before launch, connect Safaricom M-Pesa Daraja STK Push and/or a payment gateway that supports your desired card/mobile methods. Verify payments using provider-to-server callbacks and only then mark orders as paid and allow paid downloads. Never trust screenshots or browser-submitted payment status.

## Production launch checklist
- Enable HTTPS/TLS and force HTTPS at your host/reverse proxy.
- Keep `.env` private and set strong credentials.
- Use persistent storage or managed database/object storage for production.
- Add callback signature validation, idempotency and payment reconciliation.
- Add protected download routes so paid files are only released after confirmed payment.
- Add privacy policy, terms, refund policy, contact details, backups and monitoring.
- Test all flows before going live.

## Curriculum note
Grade 1–3 was supplied with five subjects; the sixth subject was left blank. Add it to `server.js`, `public/app.js` and `public/admin.js` once confirmed.
