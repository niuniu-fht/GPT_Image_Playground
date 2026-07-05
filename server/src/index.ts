import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import { ZodError } from 'zod'
import { env } from './env.js'
import { HttpError, sendError } from './http.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import adminSquareRouter from './routes/adminSquare.js'
import creditsRouter from './routes/credits.js'
import generationsRouter from './routes/generations.js'
import modelsRouter from './routes/models.js'
import publicRouter from './routes/public.js'
import remoteImagesRouter from './routes/remoteImages.js'
import squareRouter from './routes/square.js'
import supportRouter from './routes/support.js'

const app = express()
const PgSessionStore = connectPgSimple(session)
const sessionPool = new pg.Pool({ connectionString: env.databaseUrl })

app.set('trust proxy', 1)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('当前来源不允许访问 API'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '300mb' }))
app.use(cookieParser())
app.use(
  session({
    name: 'gip.sid',
    secret: env.sessionSecret,
    store: new PgSessionStore({
      pool: sessionPool,
      tableName: 'session',
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 10,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gpt-image-playground-server', now: Date.now() })
})
app.use('/api/v1', squareRouter)
app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/admin', adminRouter)
app.use('/api/admin/square', adminSquareRouter)
app.use('/api', modelsRouter)
app.use('/api/credits', creditsRouter)
app.use('/api/support', supportRouter)
app.use('/api/generations', generationsRouter)
app.use('/api/remote-images', remoteImagesRouter)

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    sendError(res, new HttpError(400, 'validation_failed', error.errors[0]?.message || '请求参数不正确'))
    return
  }
  sendError(res, error)
})

app.listen(env.port, () => {
  console.log(`GPT Image Playground server listening on http://127.0.0.1:${env.port}`)
})
