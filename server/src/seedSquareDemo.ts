import { prisma } from './prisma.js'

const DEMO_PUBLISHER_ID = 'demo-square-ai-gallery-publisher'
const DEMO_PUBLISHER_TOKEN = 'demo-square-ai-gallery-token'
const DEMO_SHARE_PREFIX = 'demo-ai-square-v1'
const POLLINATIONS_IMAGE_BASE = 'https://image.pollinations.ai/prompt'

interface DemoImagePreset {
  title: string
  prompt: string
  tags: string[]
  width: number
  height: number
}

const DEMO_PRESETS: DemoImagePreset[] = [
  { title: '玻璃花房里的未来花束', prompt: 'futuristic glass greenhouse, luminous flowers, soft morning mist, cinematic editorial photography', tags: ['未来感', '花艺', '空间'], width: 896, height: 1152 },
  { title: '霓虹雨夜的城市骑手', prompt: 'cyberpunk courier riding through neon rain, reflective street, cinematic motion blur, ultra detailed', tags: ['赛博朋克', '城市', '人物'], width: 896, height: 1152 },
  { title: '极简白色香水大片', prompt: 'minimal luxury perfume bottle on white stone, caustic light, commercial product photography', tags: ['产品', '香水', '电商'], width: 1152, height: 896 },
  { title: '沙漠里的漂浮美术馆', prompt: 'floating contemporary art museum above desert dunes, golden hour, architectural visualization', tags: ['建筑', '沙漠', '超现实'], width: 1216, height: 832 },
  { title: '银色宇航员咖啡馆', prompt: 'astronaut in silver suit drinking coffee in tiny lunar cafe, warm interior lights, whimsical realism', tags: ['科幻', '咖啡馆', '人物'], width: 896, height: 1152 },
  { title: '水下婚纱时装大片', prompt: 'underwater couture wedding dress photoshoot, floating fabric, blue light rays, high fashion editorial', tags: ['时装', '水下', '人像'], width: 832, height: 1216 },
  { title: '森林里的透明小屋', prompt: 'transparent cabin in deep moss forest, evening glow, cozy interior, architectural photography', tags: ['建筑', '森林', '生活方式'], width: 1152, height: 896 },
  { title: '甜品星球广告图', prompt: 'tiny dessert planet with macarons and cream clouds, playful commercial food photography, pastel colors', tags: ['食品', '广告', '可爱'], width: 1024, height: 1024 },
  { title: '未来运动鞋陈列', prompt: 'futuristic sneaker display, chrome platform, blue laser lines, premium product render', tags: ['产品', '鞋履', '潮流'], width: 1152, height: 896 },
  { title: '樱花列车窗边人像', prompt: 'portrait near train window, cherry blossoms outside, soft film light, gentle Japanese spring mood', tags: ['人像', '樱花', '胶片'], width: 832, height: 1216 },
  { title: '云端图书馆', prompt: 'surreal library above clouds, endless shelves, warm sunlight, fantasy matte painting', tags: ['幻想', '空间', '阅读'], width: 1216, height: 832 },
  { title: '黑金腕表商业大片', prompt: 'black and gold luxury watch macro shot, dramatic shadows, premium advertising photography', tags: ['产品', '腕表', '商业'], width: 1152, height: 896 },
  { title: 'AI 设计师工作室', prompt: 'creative AI designer studio, holographic moodboards, elegant desk setup, cinematic interior', tags: ['工作室', 'AI', '设计'], width: 1152, height: 896 },
  { title: '海边落日旅行肖像', prompt: 'traveler portrait at seaside sunset, wind hair, cinematic warm lens, realistic fashion photo', tags: ['旅行', '人像', '海边'], width: 832, height: 1216 },
  { title: '蓝色冰川珠宝台', prompt: 'diamond jewelry on blue glacier crystal, luxury campaign, crisp macro, high detail', tags: ['珠宝', '产品', '冰川'], width: 1152, height: 896 },
  { title: '漂浮厨房料理瞬间', prompt: 'ingredients floating in modern kitchen, chef preparing pasta, dynamic commercial food scene', tags: ['食品', '厨房', '动态'], width: 1216, height: 832 },
  { title: '复古机器人花店', prompt: 'friendly vintage robot florist arranging flowers, warm shop window, storybook realism', tags: ['机器人', '花店', '复古'], width: 896, height: 1152 },
  { title: '雾中山脊户外装备', prompt: 'premium outdoor jacket product shot on foggy mountain ridge, moody natural light', tags: ['服装', '户外', '广告'], width: 896, height: 1152 },
  { title: '白瓷茶具静物', prompt: 'white porcelain tea set still life, linen table, soft shadows, modern Chinese aesthetics', tags: ['静物', '茶具', '东方'], width: 1152, height: 896 },
  { title: '未来电动车城市广告', prompt: 'sleek electric car in futuristic city plaza, rain reflections, cinematic commercial render', tags: ['汽车', '城市', '商业'], width: 1216, height: 832 },
  { title: '糖果色儿童房', prompt: 'pastel children bedroom, rounded furniture, soft daylight, interior design magazine photo', tags: ['室内', '儿童房', '家居'], width: 1152, height: 896 },
  { title: '火星基地日落', prompt: 'mars colony base at sunset, astronauts walking, cinematic sci-fi landscape, realistic detail', tags: ['科幻', '火星', '场景'], width: 1216, height: 832 },
  { title: '香氛蜡烛礼盒', prompt: 'luxury scented candle gift box, warm amber light, premium ecommerce product photography', tags: ['产品', '礼盒', '香氛'], width: 896, height: 1152 },
  { title: '雨林精灵概念图', prompt: 'forest spirit character, luminous leaves, delicate costume, fantasy concept art, cinematic', tags: ['角色', '幻想', '森林'], width: 832, height: 1216 },
  { title: '透明水母灯具', prompt: 'transparent jellyfish inspired pendant lamp, dark showroom, glowing glass, product design render', tags: ['灯具', '设计', '产品'], width: 896, height: 1152 },
  { title: '纽约天台时装大片', prompt: 'fashion editorial on New York rooftop, bold coat, skyline, clean magazine photography', tags: ['时装', '城市', '人像'], width: 832, height: 1216 },
  { title: '未来医疗仪器', prompt: 'futuristic medical device on clean lab table, soft blue interface light, product render', tags: ['医疗', '产品', '科技'], width: 1152, height: 896 },
  { title: '北欧木屋早餐', prompt: 'cozy nordic cabin breakfast table, snow outside window, warm morning light, lifestyle photo', tags: ['生活方式', '室内', '早餐'], width: 1152, height: 896 },
  { title: '月光下的黑猫法师', prompt: 'black cat wizard under moonlight, tiny cloak, magical alley, charming fantasy illustration', tags: ['插画', '幻想', '角色'], width: 896, height: 1152 },
  { title: '高级护肤品水波纹', prompt: 'luxury skincare serum bottle with water ripple, clean blue-white commercial photography', tags: ['护肤', '产品', '电商'], width: 896, height: 1152 },
  { title: '京都雨伞街拍', prompt: 'Kyoto street fashion portrait with transparent umbrella, rainy alley, cinematic film color', tags: ['街拍', '京都', '人像'], width: 832, height: 1216 },
  { title: '海底玻璃餐厅', prompt: 'undersea glass restaurant, coral outside, elegant dinner tables, architectural visualization', tags: ['建筑', '海底', '空间'], width: 1216, height: 832 },
  { title: '高端耳机广告', prompt: 'premium headphones floating above black velvet, subtle blue rim light, product advertising', tags: ['产品', '耳机', '数码'], width: 1152, height: 896 },
  { title: '奶油色宠物摄影', prompt: 'cream colored studio pet portrait, fluffy dog, soft backdrop, premium lifestyle photography', tags: ['宠物', '摄影', '生活方式'], width: 896, height: 1152 },
  { title: '龙形云朵海报', prompt: 'dragon shaped clouds over sunrise mountains, epic poster, painterly realism, high detail', tags: ['海报', '东方', '幻想'], width: 832, height: 1216 },
  { title: '红色跑车沙漠公路', prompt: 'red sports car on desert highway, heat haze, cinematic commercial photography', tags: ['汽车', '沙漠', '广告'], width: 1216, height: 832 },
  { title: '未来办公室隔断', prompt: 'futuristic office interior, translucent partitions, plants, warm productivity atmosphere', tags: ['办公', '室内', '科技'], width: 1152, height: 896 },
  { title: '牛油果早餐海报', prompt: 'avocado toast breakfast poster, bright daylight, editorial food photography, fresh styling', tags: ['食品', '早餐', '广告'], width: 896, height: 1152 },
  { title: '银白机甲少女', prompt: 'silver white mecha pilot girl, clean armor design, studio concept art, detailed character', tags: ['角色', '机甲', '概念'], width: 832, height: 1216 },
  { title: '山谷里的音乐节', prompt: 'music festival in green valley at dusk, glowing stage, crowd silhouettes, cinematic landscape', tags: ['音乐节', '场景', '夜景'], width: 1216, height: 832 },
  { title: '粉色手机壳大片', prompt: 'pink translucent phone case product shot, glossy reflections, Gen Z ecommerce style', tags: ['产品', '手机壳', '潮流'], width: 896, height: 1152 },
  { title: '雪山瑜伽人像', prompt: 'yoga portrait in snowy mountain lodge, calm morning, wellness brand photography', tags: ['健康', '人像', '雪山'], width: 832, height: 1216 },
  { title: '超现实水果泳池', prompt: 'surreal swimming pool filled with giant citrus fruits, summer commercial image, vibrant', tags: ['夏日', '水果', '广告'], width: 1152, height: 896 },
  { title: '墨绿色餐厅空间', prompt: 'emerald green restaurant interior, brass details, intimate lighting, design magazine photo', tags: ['室内', '餐厅', '空间'], width: 1152, height: 896 },
  { title: '未来快递无人机', prompt: 'delivery drone landing on balcony, futuristic city, clean product tech advertising', tags: ['无人机', '科技', '城市'], width: 1216, height: 832 },
  { title: '复古唱片封面', prompt: 'retro vinyl album cover, dreamy singer portrait, 1970s color palette, graphic poster', tags: ['海报', '复古', '音乐'], width: 896, height: 1152 },
  { title: '白色运动营养瓶', prompt: 'white sports nutrition bottle, ice and steel background, crisp commercial product photo', tags: ['产品', '运动', '电商'], width: 896, height: 1152 },
  { title: '金色麦田机器人', prompt: 'small agricultural robot in golden wheat field, sunrise, warm cinematic technology scene', tags: ['机器人', '农业', '场景'], width: 1216, height: 832 },
  { title: '水晶洞穴婚礼场景', prompt: 'wedding ceremony in crystal cave, glowing lights, elegant flowers, fantasy event design', tags: ['婚礼', '空间', '幻想'], width: 1152, height: 896 },
  { title: '蓝白包装饮料', prompt: 'blue white beverage can packaging, water splash, clean summer product advertisement', tags: ['饮料', '包装', '产品'], width: 896, height: 1152 },
  { title: '洛杉矶夕阳街头', prompt: 'Los Angeles sunset street portrait, sunglasses, cinematic fashion photography, warm flare', tags: ['街头', '人像', '时装'], width: 832, height: 1216 },
  { title: '空中花园酒店', prompt: 'floating garden hotel above tropical cliffs, infinity pool, architectural visualization', tags: ['酒店', '建筑', '旅行'], width: 1216, height: 832 },
  { title: '黑色科技背包', prompt: 'black tech backpack product render, magnetic buckles, soft studio light, premium gear', tags: ['产品', '背包', '科技'], width: 896, height: 1152 },
  { title: '蓝色丝绸礼服', prompt: 'blue silk evening gown fashion portrait, flowing fabric, dramatic studio light, editorial', tags: ['时装', '礼服', '人像'], width: 832, height: 1216 },
  { title: '童话蘑菇民宿', prompt: 'fairytale mushroom cottage boutique hotel, warm windows, moss path, cozy fantasy realism', tags: ['民宿', '幻想', '建筑'], width: 896, height: 1152 },
  { title: '电竞椅灯光场景', prompt: 'gaming chair in neon studio, black and cyan lighting, product photography, premium esports', tags: ['电竞', '产品', '数码'], width: 896, height: 1152 },
  { title: '绿色能量饮料海报', prompt: 'green energy drink poster, lightning splash, bold commercial studio photography', tags: ['饮料', '海报', '商业'], width: 896, height: 1152 },
  { title: '星际列车站台', prompt: 'interstellar train platform, passengers in elegant coats, cosmic window, cinematic sci-fi', tags: ['科幻', '列车', '场景'], width: 1216, height: 832 },
  { title: '红丝绒蛋糕静物', prompt: 'red velvet cake still life, dark romantic table, candle light, luxury dessert photography', tags: ['甜品', '食品', '静物'], width: 896, height: 1152 },
  { title: '白色智能音箱', prompt: 'white smart speaker product shot, soft home background, clean tech lifestyle advertisement', tags: ['数码', '产品', '家居'], width: 1152, height: 896 },
]

function buildImageUrl(preset: DemoImagePreset, index: number): string {
  const prompt = encodeURIComponent(`${preset.prompt}, AI generated, no text, no watermark`)
  const params = new URLSearchParams({
    width: String(preset.width),
    height: String(preset.height),
    seed: String(9000 + index * 37),
    model: 'flux',
    enhance: 'true',
  })
  return `${POLLINATIONS_IMAGE_BASE}/${prompt}?${params.toString()}`
}

async function seedSquareDemoImages() {
  await prisma.squarePublisher.upsert({
    where: { id: DEMO_PUBLISHER_ID },
    update: { token: DEMO_PUBLISHER_TOKEN, status: 'active' },
    create: {
      id: DEMO_PUBLISHER_ID,
      token: DEMO_PUBLISHER_TOKEN,
      status: 'active',
    },
  })

  for (const [index, preset] of DEMO_PRESETS.entries()) {
    const shareId = `${DEMO_SHARE_PREFIX}-share-${String(index + 1).padStart(2, '0')}`
    const assetId = `${DEMO_SHARE_PREFIX}-asset-${String(index + 1).padStart(2, '0')}`
    const clientRequestId = `${DEMO_SHARE_PREFIX}-${String(index + 1).padStart(2, '0')}`
    const clientAssetId = `${clientRequestId}-output`
    const imageUrl = buildImageUrl(preset, index)
    const createdAt = new Date(Date.now() - index * 60_000)
    const manifest = {
      kind: 'task',
      clientRequestId,
      title: preset.title,
      prompt: preset.prompt,
      tags: preset.tags,
      demoSource: 'pollinations.ai',
      assets: [
        {
          clientAssetId,
          role: 'output',
          mimeType: 'image/jpeg',
          width: preset.width,
          height: preset.height,
          byteSize: 1,
          standaloneShareAllowed: true,
        },
      ],
    }

    await prisma.squareShare.upsert({
      where: {
        publisherId_clientRequestId: {
          publisherId: DEMO_PUBLISHER_ID,
          clientRequestId,
        },
      },
      update: {
        id: shareId,
        kind: 'task',
        title: preset.title,
        prompt: preset.prompt,
        manifestJson: manifest,
        coverAssetId: assetId,
        tags: preset.tags,
        status: 'published',
        createdAt,
        updatedAt: createdAt,
      },
      create: {
        id: shareId,
        publisherId: DEMO_PUBLISHER_ID,
        kind: 'task',
        title: preset.title,
        prompt: preset.prompt,
        manifestJson: manifest,
        coverAssetId: assetId,
        tags: preset.tags,
        status: 'published',
        clientRequestId,
        createdAt,
        updatedAt: createdAt,
      },
    })

    await prisma.squareShareAsset.deleteMany({ where: { shareId } })
    await prisma.squareShareAsset.create({
      data: {
        id: assetId,
        shareId,
        clientAssetId,
        role: 'output',
        r2Key: imageUrl,
        thumbR2Key: imageUrl,
        mimeType: 'image/jpeg',
        byteSize: 1,
        thumbByteSize: 1,
        width: preset.width,
        height: preset.height,
      },
    })
  }

  console.log(`[seed:square-demo] upserted ${DEMO_PRESETS.length} AI demo images`)
}

seedSquareDemoImages()
  .finally(async () => {
    await prisma.$disconnect()
  })
