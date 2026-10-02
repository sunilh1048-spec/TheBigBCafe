import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(
    cookieSession({
      name: "session",
      keys: [process.env.SESSION_SECRET || "bellyz-secret-key"],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: "none",
    })
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/callback` || "http://localhost:3000/auth/callback"
  );

  // API Routes
  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/spreadsheets"],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session!.tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ isAuthenticated: !!req.session?.tokens });
  });

  app.post("/api/sheets/sync", async (req, res) => {
    if (!req.session?.tokens) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: "Invalid orders data" });
    }

    try {
      oauth2Client.setCredentials(req.session.tokens);
      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      const spreadsheetId = process.env.SPREADSHEET_ID || "1w2r92iXoKgIuxp6DuQSfONWnbdtTvQ1IBYWEYEybUMk";

      // Prepare data for sheets
      // Header: ID, Date, Table, Customer, Items, Total, Status
      const values = orders.map((o: any) => [
        o.orderId,
        o.date,
        o.table,
        o.customerName,
        o.items,
        o.total,
        o.status
      ]);

      // First, check if sheet is empty to add headers
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A1:A1",
      });

      if (!response.data.values || response.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["Order ID", "Date", "Table", "Customer", "Items", "Total (₹)", "Status"]],
          },
        });
      }

      // Append data
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A2",
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error syncing to Google Sheets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
