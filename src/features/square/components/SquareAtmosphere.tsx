import { useEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

interface FloatingFrame {
  mesh: LineSegments<EdgesGeometry, LineBasicMaterial>
  base: Vector3
  phase: number
}

const FRAME_LAYOUTS = [
  { x: -4.4, y: 1.8, z: -5.2, width: 1.45, height: 2.1, phase: 0.2 },
  { x: -2.3, y: -0.8, z: -4.6, width: 1.05, height: 1.48, phase: 1.4 },
  { x: 0.6, y: 1.35, z: -5.6, width: 1.28, height: 1.78, phase: 2.2 },
  { x: 3.15, y: -0.2, z: -4.8, width: 1.62, height: 1.05, phase: 3.1 },
  { x: 5.0, y: 1.92, z: -6.1, width: 1.0, height: 1.42, phase: 4.0 },
  { x: -5.0, y: -2.2, z: -6.2, width: 1.82, height: 1.18, phase: 4.8 },
]

function createFrame(layout: (typeof FRAME_LAYOUTS)[number]): FloatingFrame {
  const geometry = new EdgesGeometry(new PlaneGeometry(layout.width, layout.height))
  const material = new LineBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.045,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const mesh = new LineSegments(geometry, material)
  mesh.position.set(layout.x, layout.y, layout.z)
  mesh.rotation.set(0.08, layout.x * 0.06, layout.phase * 0.08)
  return {
    mesh,
    base: new Vector3(layout.x, layout.y, layout.z),
    phase: layout.phase,
  }
}

function createRibbon(points: Vector3[], color: number, opacity: number): Mesh<TubeGeometry, MeshBasicMaterial> {
  const curve = new CatmullRomCurve3(points)
  const geometry = new TubeGeometry(curve, 120, 0.012, 8, false)
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  return new Mesh(geometry, material)
}

function createFlowPlane(): Mesh<PlaneGeometry, ShaderMaterial> {
  const geometry = new PlaneGeometry(16, 9, 1, 1)
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new Vector2(0, 0) },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float uTime;
      uniform vec2 uPointer;
      varying vec2 vUv;

      float wave(vec2 p, float speed, float scale, float offset) {
        return sin((p.x * scale + p.y * (scale * 0.62)) + uTime * speed + offset);
      }

      void main() {
        vec2 p = vUv - 0.5;
        p.x *= 1.72;
        p += uPointer * 0.035;

        float streamA = wave(p, 0.34, 7.6, 0.0);
        float streamB = wave(p + vec2(0.18, -0.12), -0.22, 10.4, 1.8);
        float streamC = wave(p + vec2(-0.24, 0.18), 0.18, 15.2, 4.2);
        float flow = streamA * 0.52 + streamB * 0.34 + streamC * 0.18;

        float band = smoothstep(0.52, 1.0, flow);
        float veil = smoothstep(0.06, 0.62, 0.54 - abs(p.y + sin(p.x * 2.0 + uTime * 0.16) * 0.16));
        float centerGlow = 1.0 - smoothstep(0.0, 1.05, length(p * vec2(0.82, 1.18)));
        float vignette = 1.0 - smoothstep(0.62, 1.2, length(p));

        vec3 ink = vec3(0.02, 0.024, 0.032);
        vec3 cold = vec3(0.24, 0.36, 0.72);
        vec3 pearl = vec3(0.88, 0.92, 1.0);
        vec3 violet = vec3(0.36, 0.22, 0.62);
        vec3 color = ink + cold * band * 0.18 + pearl * veil * 0.035 + violet * centerGlow * 0.08;
        float alpha = (band * 0.28 + veil * 0.10 + centerGlow * 0.12) * vignette;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.position.set(0, 0, -8.8)
  return mesh
}

function createParticleField() {
  const count = 760
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 3)
  const color = new Color()

  for (let index = 0; index < count; index += 1) {
    const band = index % 7
    const spread = 12 + band * 0.35
    const x = (Math.random() - 0.5) * spread
    const y = (Math.random() - 0.5) * 7.4
    const z = -2.8 - Math.random() * 7.5
    positions[index * 3] = x
    positions[index * 3 + 1] = y
    positions[index * 3 + 2] = z
    seeds[index * 3] = x
    seeds[index * 3 + 1] = y
    seeds[index * 3 + 2] = 0.08 + Math.random() * 0.18

    color.setHex(band % 3 === 0 ? 0xffffff : band % 3 === 1 ? 0x93c5fd : 0xc4b5fd)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  const material = new PointsMaterial({
    size: 0.022,
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  return {
    points: new Points(geometry, material),
    positions,
    seeds,
  }
}

export default function SquareAtmosphere() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const hostElement = host

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    renderer.setClearColor(0x000000, 0)
    hostElement.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(42, 1, 0.1, 40)
    camera.position.set(0, 0, 5.8)

    const pointer = new Vector2(0, 0)
    const pointerTarget = new Vector2(0, 0)
    const frameGroup = new Group()
    const ribbonGroup = new Group()
    scene.add(frameGroup, ribbonGroup)

    const flowPlane = createFlowPlane()
    scene.add(flowPlane)

    const frames = FRAME_LAYOUTS.map(createFrame)
    frames.forEach((frame) => frameGroup.add(frame.mesh))

    const ribbonA = createRibbon([
      new Vector3(-6.8, -2.2, -6.6),
      new Vector3(-2.8, 1.1, -5.4),
      new Vector3(0.8, -0.2, -5.8),
      new Vector3(5.9, 2.2, -6.8),
    ], 0x93c5fd, 0.24)
    const ribbonB = createRibbon([
      new Vector3(-5.8, 2.8, -7.2),
      new Vector3(-1.6, -1.1, -5.2),
      new Vector3(2.4, 0.8, -6.0),
      new Vector3(6.6, -2.4, -7.0),
    ], 0xf0abfc, 0.16)
    const ribbonC = createRibbon([
      new Vector3(-7.2, 0.2, -8.0),
      new Vector3(-3.8, -0.48, -6.2),
      new Vector3(0.4, 0.62, -6.7),
      new Vector3(6.8, -0.18, -8.2),
    ], 0xffffff, 0.08)
    const ribbonD = createRibbon([
      new Vector3(-6.2, 1.42, -7.5),
      new Vector3(-1.8, 2.08, -6.0),
      new Vector3(1.4, 1.22, -6.4),
      new Vector3(6.2, 1.8, -7.8),
    ], 0x60a5fa, 0.11)
    ribbonGroup.add(ribbonA, ribbonB, ribbonC, ribbonD)

    const particleField = createParticleField()
    scene.add(particleField.points)
    const positionAttribute = particleField.points.geometry.getAttribute('position') as BufferAttribute

    let frameId = 0

    function resize() {
      const width = Math.max(hostElement.clientWidth, 1)
      const height = Math.max(hostElement.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    function renderFrame(timeMs = 0) {
      const time = timeMs * 0.001
      pointer.lerp(pointerTarget, reducedMotion ? 1 : 0.04)
      flowPlane.material.uniforms.uTime.value = reducedMotion ? 0 : time
      flowPlane.material.uniforms.uPointer.value.copy(pointer)

      frames.forEach((frame, index) => {
        const drift = reducedMotion ? 0 : Math.sin(time * 0.32 + frame.phase) * 0.16
        frame.mesh.position.set(
          frame.base.x + pointer.x * (0.18 + index * 0.018),
          frame.base.y - pointer.y * 0.12 + drift,
          frame.base.z,
        )
        frame.mesh.rotation.y = frame.base.x * 0.06 + pointer.x * 0.05
        frame.mesh.rotation.z = frame.phase * 0.08 + Math.sin(time * 0.18 + frame.phase) * 0.02
        frame.mesh.material.opacity = 0.035 + Math.sin(time * 0.28 + frame.phase) * 0.012
      })

      ribbonGroup.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.1) * 0.014
      ribbonGroup.position.x = pointer.x * 0.08
      ribbonGroup.position.y = -pointer.y * 0.06
      if (!reducedMotion) {
        for (let index = 0; index < particleField.positions.length / 3; index += 1) {
          const baseX = particleField.seeds[index * 3]
          const baseY = particleField.seeds[index * 3 + 1]
          const speed = particleField.seeds[index * 3 + 2]
          particleField.positions[index * 3] = baseX + Math.sin(time * speed + index * 0.07) * 0.12
          particleField.positions[index * 3 + 1] = baseY + Math.cos(time * speed * 0.8 + index * 0.11) * 0.08
        }
      }
      particleField.points.rotation.y = pointer.x * 0.025 + (reducedMotion ? 0 : time * 0.008)
      particleField.points.rotation.x = -pointer.y * 0.018
      positionAttribute.needsUpdate = !reducedMotion

      renderer.render(scene, camera)
      if (!reducedMotion) {
        frameId = window.requestAnimationFrame(renderFrame)
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const width = Math.max(window.innerWidth, 1)
      const height = Math.max(window.innerHeight, 1)
      pointerTarget.x = (event.clientX / width - 0.5) * 2
      pointerTarget.y = (event.clientY / height - 0.5) * 2
    }

    resize()
    renderFrame()
    if (!reducedMotion) {
      frameId = window.requestAnimationFrame(renderFrame)
    }
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      frames.forEach((frame) => {
        frame.mesh.geometry.dispose()
        frame.mesh.material.dispose()
      })
      ribbonA.geometry.dispose()
      ribbonA.material.dispose()
      ribbonB.geometry.dispose()
      ribbonB.material.dispose()
      ribbonC.geometry.dispose()
      ribbonC.material.dispose()
      ribbonD.geometry.dispose()
      ribbonD.material.dispose()
      flowPlane.geometry.dispose()
      flowPlane.material.dispose()
      particleField.points.geometry.dispose()
      particleField.points.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === hostElement) {
        hostElement.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={hostRef} className="pointer-events-none fixed inset-0 z-0 opacity-100" aria-hidden />
}
