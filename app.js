// Detector de dispositivos móviles
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);

// Importamos las bibliotecas necesarias
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "https://cdn.skypack.dev/gsap";

// Configuración inicial
const init3D = () => {
  // Ajustamos los parámetros de la cámara según el dispositivo
  const camera = new THREE.PerspectiveCamera(
    isMobile ? 15 : 5, // Campo de visión más amplio en móviles
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = isMobile ? 40 : 70; // Ajustamos la posición de la cámara

  const scene = new THREE.Scene();
  let world;
  let mixer;

  // Configuración del renderizador
  const container = document.getElementById("container3D");
  const renderer = new THREE.WebGLRenderer({ 
    alpha: true,
    antialias: !isMobile, // Desactivamos antialiasing en móviles para mejor rendimiento
    powerPreference: "high-performance"
  });
  
  // Ajustamos el tamaño y la resolución según el dispositivo
  const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Cargamos el modelo 3D
  const loader = new GLTFLoader();
  loader.load(
    "/car.glb",
    function (gltf) {
      world = gltf.scene;
      
      // Ajustamos la escala según el dispositivo
      const scale = isMobile ? 0.7 : 1;
      world.scale.set(scale, scale, scale);
      
      scene.add(world);

      mixer = new THREE.AnimationMixer(world);
      const action = mixer.clipAction(gltf.animations[0]);
      action.setDuration(isMobile ? 150 : 100); // Ralentizamos la animación en móviles
      action.play();
      modelMove();
    },
    undefined,
    function (error) {
      console.error("Error loading model:", error);
    }
  );

  // Iluminación optimizada
  const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 0.5 : 1.3);
  scene.add(ambientLight);

  const topLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.8 : 1);
  topLight.position.set(500, 500, 500);
  scene.add(topLight);

  // Posiciones ajustadas para móviles
  const mobilePositions = [
    {
      id: "banner",
      position: { x: 0.5, y: -1, z: 0 },
      rotation: { x: 0, y: 1.5, z: 0 },
    },
    {
      id: "intro",
      position: { x: 0, y: -2, z: -4 },
      rotation: { x: 0.5, y: -0.6, z: 0 },
    },
    {
      id: "description",
      position: { x: 0.5, y: -3, z: -2 },
      rotation: { x: 0.8, y: 1, z: 0 },
    },
    {
      id: "contact",
      position: { x: 0.1, y: -2.8, z: 0 },
      rotation: { x: 3, y: -0.8, z: 2 },
    },
  ];

  const desktopPositions = [
    {
      id: "banner",
      position: { x: 0, y: -1, z: 0 },
      rotation: { x: 0, y: 1.5, z: 0 },
    },
    {
      id: "intro",
      position: { x: 1, y: -1, z: -5 },
      rotation: { x: 0.9, y: -0.5, z: 0 },
    },
    {
      id: "description",
      position: { x: -1, y: -1, z: -5 },
      rotation: { x: 0, y: 0.5, z: 0 },
    },
    {
      id: "contact",
      position: { x: 1, y: -1, z: 0 },
      rotation: { x: 0.3, y: -0.5, z: 5 },
    },
  ];

  const arrPositionModel = isMobile ? mobilePositions : desktopPositions;

  // Función de movimiento optimizada
  const modelMove = () => {
    const sections = document.querySelectorAll(".section");
    let currentSection;
    
    // Optimizamos la detección de sección visible
    const viewportHeight = window.innerHeight;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= viewportHeight / 2 && rect.bottom >= viewportHeight / 2) {
        currentSection = section.id;
      }
    });

    const position_active = arrPositionModel.findIndex(
      (val) => val.id === currentSection
    );

    if (position_active >= 0 && world) {
      const new_coordinates = arrPositionModel[position_active];
      
      // Animación más suave en móviles
      gsap.to(world.position, {
        x: new_coordinates.position.x,
        y: new_coordinates.position.y,
        z: new_coordinates.position.z,
        duration: isMobile ? 2 : 3,
        ease: "power2.out",
      });

      gsap.to(world.rotation, {
        x: new_coordinates.rotation.x,
        y: new_coordinates.rotation.y,
        z: new_coordinates.rotation.z,
        duration: isMobile ? 2 : 3,
        ease: "power2.out",
      });
    }
  };

  // Optimización del render loop
  let frameId;
  const reRender3D = () => {
    frameId = requestAnimationFrame(reRender3D);
    if (mixer) mixer.update(isMobile ? 0.01 : 0.02);
    renderer.render(scene, camera);
  };

  // Manejadores de eventos optimizados
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    if (world) {
      // Debounce para mejor rendimiento
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(modelMove, 16);
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Iniciamos el render loop
  reRender3D();

  // Función de limpieza
  return () => {
    cancelAnimationFrame(frameId);
    renderer.dispose();
    if (world) {
      scene.remove(world);
      world.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
    }
  };
};

// Iniciamos la aplicación solo si el navegador es compatible
try {
  init3D();
} catch (error) {
  console.error("Error initializing 3D:", error);
  // Podríamos mostrar una versión alternativa o un mensaje de error aquí
}