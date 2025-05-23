// Professional 3D animated background using Three.js for connect.html
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create3DBackground(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Scene setup with better performance settings
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true,
    powerPreference: "high-performance",
    precision: "mediump" 
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Create a more sophisticated gradient background
  const gradientTexture = new THREE.CanvasTexture(createGradientCanvas());
  scene.background = gradientTexture;

  // Enhanced particle system
  const particles = createParticleSystem();
  scene.add(particles);

  // Create floating geometric shapes with modern design
  const geometricShapes = [];
  const shapeTypes = [
    () => new THREE.IcosahedronGeometry(0.5, 2),
    () => new THREE.OctahedronGeometry(0.6, 2),
    () => new THREE.TorusKnotGeometry(0.4, 0.15, 64, 8),
    () => new THREE.TorusGeometry(0.5, 0.15, 16, 32),
    () => new THREE.DodecahedronGeometry(0.4, 1),
    () => new THREE.SphereGeometry(0.4, 32, 32)
  ];

  for (let i = 0; i < 20; i++) {
    const geometry = shapeTypes[Math.floor(Math.random() * shapeTypes.length)]();
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      transmission: 0.2,
      thickness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide
    });
    
    const shape = new THREE.Mesh(geometry, material);
    shape.position.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 20
    );
    shape.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    shape.castShadow = true;
    shape.receiveShadow = true;
    
    scene.add(shape);
    geometricShapes.push({
      mesh: shape,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.01
      },
      floatSpeed: Math.random() * 0.005 + 0.002,
      originalY: shape.position.y
    });
  }

  // Enhanced lighting setup
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const pointLight1 = new THREE.PointLight(0x00ffff, 1, 15);
  pointLight1.position.set(-5, 5, 5);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff00ff, 1, 15);
  pointLight2.position.set(5, -5, -5);
  scene.add(pointLight2);

  camera.position.set(0, 0, 15);

  // Improved mouse interaction
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let targetCameraX = 0;
  let targetCameraY = 0;
  
  window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    targetCameraX = mouse.x * 2;
    targetCameraY = -mouse.y * 2;
  });

  // Optimized animation loop
  let lastTime = 0;
  function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const time = currentTime * 0.001;
    
    // Smooth camera movement
    camera.position.x += (targetCameraX - camera.position.x) * 0.05;
    camera.position.y += (targetCameraY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);
    
    // Animate geometric shapes with smooth motion
    geometricShapes.forEach((shape, i) => {
      shape.mesh.rotation.x += shape.rotationSpeed.x;
      shape.mesh.rotation.y += shape.rotationSpeed.y;
      shape.mesh.rotation.z += shape.rotationSpeed.z;
      
      // Floating motion with sine wave
      const floatOffset = Math.sin(time * shape.floatSpeed + i) * 0.5;
      shape.mesh.position.y = shape.originalY + floatOffset;
      
      // Subtle horizontal motion
      shape.mesh.position.x += Math.cos(time * shape.floatSpeed + i) * 0.002;
      
      // Scale pulse effect
      const scale = 1 + Math.sin(time * shape.floatSpeed * 2 + i) * 0.05;
      shape.mesh.scale.set(scale, scale, scale);
    });
    
    // Animate particles
    particles.rotation.y += 0.0005;
    particles.rotation.z += 0.0002;
    
    // Animate lights
    pointLight1.position.x = Math.sin(time * 0.3) * 8;
    pointLight1.position.z = Math.cos(time * 0.3) * 8;
    pointLight2.position.x = Math.cos(time * 0.4) * 6;
    pointLight2.position.z = Math.sin(time * 0.4) * 6;
    
    renderer.render(scene, camera);
  }
  animate(0);

  // Optimized resize handler
  let resizeTimeout;
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }, 100);
  });

  // Helper functions
  function createGradientCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 512);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add subtle noise texture
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 5;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  function createParticleSystem() {
    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 50;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 50;
      
      const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.8);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.1 + 0.05;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    return new THREE.Points(particles, particleMaterial);
  }

  // Memory cleanup
  return () => {
    geometricShapes.forEach(shape => {
      shape.mesh.geometry.dispose();
      shape.mesh.material.dispose();
    });
    particles.geometry.dispose();
    particles.material.dispose();
    renderer.dispose();
  };
}
