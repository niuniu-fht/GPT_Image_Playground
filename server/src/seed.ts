import bcrypt from 'bcryptjs'
import { prisma } from './prisma.js'
import { defaultPlatformSettings, seedMissingPlatformSettings } from './settings.js'
import { defaultSquareRuntimeConfig, seedMissingSquareRuntimeConfig } from './squareConfig.js'

export async function seedDatabase() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'
  const [existingUsers, existingModels, existingSquareSettings] = await Promise.all([
    prisma.user.count(),
    prisma.modelConfig.count(),
    prisma.platformSetting.count({ where: { key: { startsWith: 'square.' } } }),
  ])

  if (existingUsers === 0 && existingModels === 0 && existingSquareSettings === 0) {
    console.log('[seed] empty database detected; initializing default admin, models, and square settings.')
  } else {
    console.log(`[seed] existing data detected: users=${existingUsers}, models=${existingModels}, squareSettings=${existingSquareSettings}. Defaults will not delete custom models or overwrite square settings.`)
  }

  await seedMissingPlatformSettings(defaultPlatformSettings)
  await seedMissingSquareRuntimeConfig(defaultSquareRuntimeConfig)

  const upstream = await prisma.upstreamProvider.findUnique({
    where: { id: 'default-openai' },
  }) ?? await prisma.upstreamProvider.create({
    data: {
      id: 'default-openai',
      name: 'OpenAI 官方接口',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      apiKey: process.env.OPENAI_API_KEY || '',
      enabled: true,
      priority: 10,
      timeoutSeconds: 900,
      notes: '默认平台上游，可在运营后台替换为兼容中转站。',
    },
  })

  await prisma.modelConfig.upsert({
    where: { name: 'gpt-image-2' },
    update: {},
    create: {
      name: 'gpt-image-2',
      displayName: 'GPT Image 2',
      description: '近乎完美的文本、4K、生产级图像生成。',
      icon: 'openai',
      costCredits: 3,
      costCredits2K: 6,
      costCredits4K: 12,
      lowQualityCostCredits: 3,
      lowQualityCostCredits2K: 6,
      lowQualityCostCredits4K: 12,
      highQualityEnabled: true,
      highQualityCostCredits: 6,
      highQualityCostCredits2K: 12,
      highQualityCostCredits4K: 24,
      upstreamModel: 'gpt-image-2',
      upstreamProviderId: upstream.id,
      apiProtocol: 'images',
      enabled: true,
      isNew: true,
      sortOrder: 10,
    },
  })

  await prisma.modelConfig.upsert({
    where: { name: 'nano-banana' },
    update: {},
    create: {
      name: 'nano-banana',
      displayName: 'Nano Banana',
      description: '快速且精准的图像编辑。',
      icon: 'banana',
      costCredits: 4,
      costCredits2K: 8,
      costCredits4K: 16,
      upstreamModel: 'gpt-image-2',
      upstreamProviderId: upstream.id,
      apiProtocol: 'images',
      enabled: true,
      isNew: false,
      sortOrder: 20,
    },
  })

  await prisma.modelConfig.upsert({
    where: { name: 'nano-banana-pro' },
    update: {},
    create: {
      name: 'nano-banana-pro',
      displayName: 'Nano Banana Pro',
      description: '专业级文本图像生成。',
      icon: 'banana',
      costCredits: 15,
      costCredits2K: 30,
      costCredits4K: 60,
      upstreamModel: 'gpt-image-2',
      upstreamProviderId: upstream.id,
      apiProtocol: 'images',
      enabled: true,
      isNew: false,
      sortOrder: 30,
    },
  })

  const defaultPackages = [
    { id: 'starter-pack', name: '体验补给包', description: '适合轻量尝试和临时补充额度。', credits: 100, bonusCredits: 0, priceCents: 990, badge: '入门', sortOrder: 10 },
    { id: 'creator-pack', name: '创作者套餐', description: '适合稳定使用的个人创作者。', credits: 500, bonusCredits: 80, priceCents: 3990, badge: '热门', sortOrder: 20 },
    { id: 'pro-pack', name: '专业生产包', description: '适合高频生成、商用出图和团队试用。', credits: 1500, bonusCredits: 300, priceCents: 9990, badge: '高性价比', sortOrder: 30 },
  ]

  for (const item of defaultPackages) {
    await prisma.creditPackage.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        currency: 'CNY',
        enabled: true,
      },
    })
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'admin',
        creditBalance: 1000,
        ledgers: {
          create: {
            delta: 1000,
            reason: '管理员初始化积分',
            balanceAfter: 1000,
          },
        },
      },
    })
  }
}

seedDatabase()
  .finally(async () => {
    await prisma.$disconnect()
  })
