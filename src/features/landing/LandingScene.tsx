import { useEffect, useRef } from 'react'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import {
  BRAND_COLORS,
  PARTICLE_COUNT,
  createParticleSeeds,
  createPortalTexture,
  createPreviewTexture,
  createPromptTexture,
} from './landingSceneAssets'
interface FloatingPlane {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>
  base: Vector3
  phase: number
  drift: number
}

const PROMPT_TAGS = [
  { text: '电商主图', accent: '#38bdf8', base: new Vector3(-0.82, 1.46, 0.1), phase: 0.3 },
  { text: '人像换装', accent: '#f472b6', base: new Vector3(2.28, 1.12, 0.16), phase: 1.7 },
  { text: '证件照成片', accent: '#34d399', base: new Vector3(-0.58, -1.42, 0.24), phase: 2.8 },
]
function createGlowPlane(width: number, height: number, color: number, opacity: number) {
  return new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
}

function createTexturedPlane(width: number, height: number, textureIndex: number): FloatingPlane {
  const material = new MeshBasicMaterial({
    map: createPreviewTexture(textureIndex),
    transparent: true,
    opacity: 0.76,
    side: DoubleSide,
  })
  const mesh = new Mesh(new PlaneGeometry(width, height, 8, 8), material)
  return {
    mesh,
    base: new Vector3(0, 0, 0),
    phase: textureIndex * 1.15,
    drift: 0.08 + textureIndex * 0.018,
  }
}

function disposeFloatingPlane(layer: FloatingPlane) {
  layer.mesh.geometry.dispose()
  layer.mesh.material.map?.dispose()
  layer.mesh.material.dispose()
}

export default function LandingScene() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const hostElement = host

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    hostElement.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.28, 6.4)

    const studio = new Group()
    const cardGroup = new Group()
    const promptGroup = new Group()
    scene.add(studio, cardGroup, promptGroup)

    const portalTexture = createPortalTexture()
    const portal = new Mesh(
      new PlaneGeometry(2.82, 1.94, 12, 12),
      new MeshBasicMaterial({ map: portalTexture, transparent: true, opacity: 0.92, side: DoubleSide }),
    )
    portal.position.set(0.48, 0.02, 0)
    studio.add(portal)

    const portalBack = createGlowPlane(3.22, 2.28, 0x60a5fa, 0.2)
    portalBack.position.set(0.48, 0.02, -0.06)
    studio.add(portalBack)

    const glassFrame = new Mesh(
      new RingGeometry(1.58, 1.66, 128, 3),
      new MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.18,
        transmission: 0.34,
        thickness: 0.45,
        transparent: true,
        opacity: 0.46,
        side: DoubleSide,
      }),
    )
    glassFrame.scale.y = 0.68
    glassFrame.position.set(0.48, 0.02, 0.08)
    studio.add(glassFrame)

    const orbitA = new Mesh(new TorusGeometry(2.02, 0.01, 10, 180), new MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.54 }))
    const orbitB = new Mesh(new TorusGeometry(2.5, 0.008, 10, 180), new MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.32 }))
    orbitA.rotation.x = Math.PI / 2.35
    orbitB.rotation.x = Math.PI / 2.1
    orbitB.rotation.y = -Math.PI / 7
    studio.add(orbitA, orbitB)

    const previewPositions = [
      new Vector3(-1.76, 0.86, -0.2),
      new Vector3(2.24, 0.7, -0.1),
      new Vector3(-1.42, -1.08, 0.1),
      new Vector3(2.02, -1.02, 0.2),
    ]
    const previewLayers = previewPositions.map((base, index) => {
      const layer = createTexturedPlane(0.78, 1.04, index)
      layer.base.copy(base)
      layer.mesh.position.copy(base)
      layer.mesh.rotation.y = index % 2 === 0 ? 0.18 : -0.18
      cardGroup.add(layer.mesh)
      return layer
    })

    const promptLayers = PROMPT_TAGS.map((tag, index) => {
      const material = new MeshBasicMaterial({
        map: createPromptTexture(tag.text, tag.accent),
        transparent: true,
        opacity: 0.88,
        side: DoubleSide,
      })
      const mesh = new Mesh(new PlaneGeometry(1.16, 0.26), material)
      mesh.position.copy(tag.base)
      promptGroup.add(mesh)
      return { mesh, base: tag.base, phase: tag.phase, drift: 0.06 + index * 0.02 }
    })

    const seeds = createParticleSeeds()
    const particleGeometry = new BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const color = new Color()
    seeds.forEach((_, index) => {
      color.setHex(BRAND_COLORS[index % BRAND_COLORS.length])
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    })
    particleGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new BufferAttribute(colors, 3))
    const particleMaterial = new PointsMaterial({
      size: 0.032,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const particles = new Points(particleGeometry, particleMaterial)
    studio.add(particles)

    scene.add(new AmbientLight(0xffffff, 0.72))
    const cursorLight = new PointLight(0xffffff, 3.8, 7)
    const blueLight = new PointLight(0x60a5fa, 5.5, 10)
    const greenLight = new PointLight(0x34d399, 2.6, 8)
    blueLight.position.set(2.8, 2.8, 3.6)
    greenLight.position.set(-3, -1.2, 3)
    scene.add(cursorLight, blueLight, greenLight)

    let frameId = 0
    const pointer = new Vector2(0, 0)
    const pointerTarget = new Vector2(0, 0)

    function resize() {
      const width = Math.max(hostElement.clientWidth, 1)
      const height = Math.max(hostElement.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const isWide = width >= 1024
      const x = isWide ? 2.22 : 0
      studio.position.set(x, isWide ? -0.02 : 0.05, 0)
      cardGroup.position.copy(studio.position)
      promptGroup.position.copy(studio.position)
      const scale = isWide ? 0.74 : 0.64
      studio.scale.setScalar(scale)
      cardGroup.scale.setScalar(scale)
      promptGroup.scale.setScalar(scale)
    }

    function animateLayer(layer: FloatingPlane, time: number, index: number) {
      const drift = Math.sin(time * 0.82 + layer.phase) * layer.drift
      layer.mesh.position.set(
        layer.base.x + pointer.x * (0.18 + index * 0.03),
        layer.base.y - pointer.y * (0.12 + index * 0.02) + drift,
        layer.base.z + Math.cos(time * 0.56 + layer.phase) * 0.08,
      )
      layer.mesh.rotation.y = -pointer.x * 0.28 + Math.sin(time * 0.36 + layer.phase) * 0.07
      layer.mesh.rotation.x = pointer.y * 0.18 + Math.cos(time * 0.42 + layer.phase) * 0.045
      layer.mesh.rotation.z = Math.sin(time * 0.32 + layer.phase) * 0.026
    }

    function renderFrame(timeMs: number) {
      const time = timeMs * 0.001
      pointer.lerp(pointerTarget, 0.055)
      seeds.forEach((seed, index) => {
        const angle = seed.angle + time * seed.speed
        const wave = Math.sin(time * 0.8 + index * 0.17) * 0.24
        positions[index * 3] = Math.cos(angle) * (seed.radius + wave)
        positions[index * 3 + 1] = seed.height + Math.sin(angle * 1.7 + time) * 0.18
        positions[index * 3 + 2] = Math.sin(angle) * (seed.radius + wave)
      })
      const positionAttribute = particleGeometry.getAttribute('position') as BufferAttribute
      positionAttribute.needsUpdate = true
      particleMaterial.size = 0.026 + Math.sin(time * 0.7) * 0.004

      portal.rotation.y = pointer.x * 0.08 + Math.sin(time * 0.24) * 0.025
      portal.rotation.x = -pointer.y * 0.05
      portalBack.rotation.copy(portal.rotation)
      glassFrame.rotation.z = time * 0.08
      orbitA.rotation.z = time * 0.15
      orbitB.rotation.z = -time * 0.1
      studio.rotation.y = pointer.x * 0.1
      studio.rotation.x = -pointer.y * 0.06
      cardGroup.rotation.y = pointer.x * 0.16
      promptGroup.rotation.y = pointer.x * 0.12
      cursorLight.position.set(pointer.x * 2.2 + studio.position.x, -pointer.y * 1.3 + studio.position.y, 2.4)
      previewLayers.forEach((layer, index) => animateLayer(layer, time, index))
      promptLayers.forEach((layer, index) => animateLayer(layer, time + 0.4, index + 2))
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(renderFrame)
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = hostElement.getBoundingClientRect()
      pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      pointerTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }

    resize()
    frameId = window.requestAnimationFrame(renderFrame)
    window.addEventListener('resize', resize)
    hostElement.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      hostElement.removeEventListener('pointermove', handlePointerMove)
      renderer.dispose()
      portal.geometry.dispose()
      portalTexture.dispose()
      portal.material.dispose()
      portalBack.geometry.dispose()
      portalBack.material.dispose()
      glassFrame.geometry.dispose()
      glassFrame.material.dispose()
      orbitA.geometry.dispose()
      orbitA.material.dispose()
      orbitB.geometry.dispose()
      orbitB.material.dispose()
      previewLayers.forEach(disposeFloatingPlane)
      promptLayers.forEach(disposeFloatingPlane)
      particleGeometry.dispose()
      particleMaterial.dispose()
      if (renderer.domElement.parentElement === hostElement) {
        hostElement.removeChild(renderer.domElement)
      }
    }
  }, [])
  return <div ref={hostRef} className="absolute inset-0" aria-hidden />
}
