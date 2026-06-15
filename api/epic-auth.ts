import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'Missing code or redirectUri' });
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  const clientSecret = process.env.EPIC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing Epic API credentials in env");
    return res.status(500).json({ error: 'Server configuration error: missing Epic credentials' });
  }

  let serviceAccount: any = null;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (!serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error("Missing keys in FIREBASE_SERVICE_ACCOUNT");
    }
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
    return res.status(500).json({ error: 'Server configuration error: FIREBASE_SERVICE_ACCOUNT is malformed.' });
  }

  try {
    // 1. Exchange the authorization code for an access token
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('code', code);
    tokenParams.append('redirect_uri', redirectUri);

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch('https://api.epicgames.dev/epic/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: tokenParams.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Epic Token Error:", errText);
      return res.status(400).json({ error: 'Failed to exchange authorization code', details: errText });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const accountId = tokenData.account_id;

    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Invalid token response from Epic Games' });
    }

    // 2. Fetch the user's Epic Display Name
    const accountRes = await fetch(`https://api.epicgames.dev/epic/id/v2/accounts?accountId=${accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!accountRes.ok) {
      const errText = await accountRes.text();
      console.error("Epic Account Fetch Error:", errText);
      return res.status(400).json({ error: 'Failed to fetch Epic profile', details: errText });
    }

    const accountData = await accountRes.json();
    const displayName = accountData[0]?.displayName || 'Unknown Player';

    // 3. Mint a Firebase Custom Token manually
    // This entirely bypasses the firebase-admin library which crashes on Vercel Node 20
    const nowSeconds = Math.floor(Date.now() / 1000);
    const customToken = jwt.sign(
      {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: nowSeconds,
        exp: nowSeconds + (60 * 60), // 1 hour expiration
        uid: accountId,
        // Firebase Auth automatically sets this claim on the created user
        claims: {
          epic_display_name: displayName
        }
      },
      serviceAccount.private_key,
      {
        algorithm: 'RS256'
      }
    );

    // 4. Return the token and profile to the client
    // Note: the frontend will call signInWithCustomToken and then updateProfile to apply the displayName!
    return res.status(200).json({ 
      token: customToken,
      accountId,
      displayName
    });

  } catch (err: any) {
    console.error("OAuth flow error:", err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
