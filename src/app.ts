import 'dotenv/config';
import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import oidc from 'express-openid-connect';
import { auth as jwtAuth, requiredScopes } from 'express-oauth2-jwt-bearer';
import * as db from './db.ts';

const { auth, requiresAuth } = oidc;

const app = express();
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'pug');
app.use(express.json());

const baseUrl = process.env.BASE_URL;

app.use(auth({
  authRequired: false,
  idpLogout: true,
  secret: process.env.SESSION_SECRET,
  baseURL: baseUrl,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET,
  routes: {
    logout: false as const
  },
  authorizationParams: {
    response_type: 'code'
  }
}));

const checkJwt = jwtAuth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL
});

app.post('/logout', (req, res) => res.oidc.logout());

app.get('/', async function (req, res) {
  const total = await db.countPasses();
  const active = await db.countActivePasses();

  let passes = [];
  let username;
  if (req.oidc.isAuthenticated()) {
    passes = await db.getAllPasses();
    username = req.oidc.user?.name ?? req.oidc.user?.sub;
  }

  res.render('index', { total, active, passes, username });
});

app.get('/info/:id', async function (req, res) {
  const pass = await db.getPass(req.params.id);

  if (!pass) {
    return res.sendStatus(404);
  }

  res.render('info', { pass });
});

app.post('/passes/:id/cancel', requiresAuth(), async function (req, res) {
  await db.cancelPass(req.params.id as string);
  res.redirect('/');
});

app.post('/passes/:id/delete', requiresAuth(), async function (req, res) {
  await db.deletePass(req.params.id as string);
  res.redirect('/');
});

app.get('/passes/:id', checkJwt, requiredScopes('read:passes'), async function (req, res) {
  const pass = await db.getPass(req.params.id as string);

  if (!pass) {
    return res.sendStatus(404);
  }

  res.json({
    id: pass.id,
    name: pass.name,
    document: pass.document,
    issuedAt: pass.issuedAt.toISOString(),
    status: pass.status
  });
});

app.post('/passes', checkJwt, requiredScopes('create:passes'), async function (req, res) {
  const name = req.body?.name;
  const document = req.body?.document;

  if (!name || !document) {
    return res.sendStatus(400);
  }

  const id = randomUUID();
  await db.createPass(id, name, document);

  const png = await QRCode.toBuffer(`${baseUrl}/info/${id}`);

  res.status(201);
  res.set('Location', `${baseUrl}/passes/${id}`);
  res.type('image/png');
  res.send(png);
});

const port = Number(process.env.PORT) || 4000;

await db.initDb();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
