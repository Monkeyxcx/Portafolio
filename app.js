/**
 * Portafolio de Brahian David — shell rápido + escena 3D diferida.
 *
 * Arquitectura de rendimiento:
 *  - El módulo principal NO importa three/gsap: se cargan con import() dinámico
 *    después de `load` + requestIdleCallback, fuera de la ruta crítica.
 *  - CERO escrituras de estilo por frame: la tipografía reactiva se resuelve en
 *    CSS (animaciones por activación de sección + scroll-driven animations con
 *    animation-timeline: view(), que corren en el compositor sin JS).
 *  - La sección activa se decide con IntersectionObserver (sin scroll handlers).
 *  - Gobernador de render: 60 fps interactivo → 30 fps en reposo, con pixel
 *    ratio adaptativo si un frame cuesta demasiado.
 *  - Respeta prefers-reduced-motion y pausa el render con la pestaña oculta.
 */

// --- Preferencias (sólo matchMedia; sin listeners por frame) ----------------
const isNarrow = window.matchMedia("(max-width: 767px)");
const isCoarse = window.matchMedia("(pointer: coarse)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// --- Posiciones del modelo por sección --------------------------------------
const POSITION_SETS = {
  mobile: [
    { id: "banner", position: { x: 0.5, y: -1, z: 3 }, scale: 0.88, rotation: { x: 0, y: 1.5, z: 0 } },
    { id: "intro", position: { x: 0, y: -2, z: -1 }, scale: 0.68, rotation: { x: 0.5, y: -0.6, z: 0 } },
    { id: "description", position: { x: 0.5, y: -3, z: -5 }, scale: 0.55, rotation: { x: 0.8, y: 1, z: 0 } },
    { id: "projects", position: { x: 0.5, y: -2.5, z: -3 }, scale: 0.62, rotation: { x: 0.35, y: 0.75, z: 0 } },
    { id: "contact", position: { x: 0.1, y: -2.8, z: 15 }, scale: 0.85, rotation: { x: 0, y: 0, z: 0 } },
  ],
  desktop: [
    { id: "banner", position: { x: 0, y: -1, z: 5 }, scale: 1.08, rotation: { x: 0, y: 1.5, z: 0 } },
    { id: "intro", position: { x: 1, y: -1, z: -1 }, scale: 0.94, rotation: { x: 0.9, y: -0.5, z: 0 } },
    { id: "description", position: { x: -1, y: -1, z: -6 }, scale: 0.72, rotation: { x: 0, y: 0.5, z: 0 } },
    { id: "projects", position: { x: -0.5, y: -1, z: -2 }, scale: 0.86, rotation: { x: 0.35, y: 0.75, z: 0 } },
    { id: "contact", position: { x: 1, y: -1, z: 23 }, scale: 0.85, rotation: { x: 0, y: 0, z: 0 } },
  ],
};

// --- Títulos: cascada de entrada (una sola vez por activación) --------------
const prepareReactiveTitles = () => {
  document.querySelectorAll(".section .title").forEach((title) => {
    if (title.dataset.reactiveReady) return;
    const text = title.textContent.trim();
    title.textContent = "";
    [...text].forEach((character, index) => {
      const letter = document.createElement("span");
      letter.className = "title-letter";
      letter.textContent = character === " " ? "\u00a0" : character;
      letter.style.setProperty("--letter-index", index);
      title.appendChild(letter);
    });
    title.dataset.reactiveReady = "true";
  });
};

// --- Proyectos (imágenes locales: cero peticiones externas) ------------------
const PROJECTS = [
  {
    name: "AtrapaEmpleos",
    repo: "AtrapaEmpleos",
    description: "Buscador asistido de ofertas laborales para Colombia con filtros configurables, puntuación de prioridad, reportes Excel y dashboard HTML.",
    language: "Python",
    type: "Automatización / datos",
    image: "img/projects/AtrapaEmpleos.svg",
  },
  {
    name: "Rifas",
    repo: "Rifas",
    description: "Aplicación web para gestionar sorteos pequeños de forma clara y sencilla.",
    language: "TypeScript",
    type: "Producto web",
    homepage: "https://trae9d5pbutf.vercel.app",
  },
  {
    name: "Betel Tickets",
    repo: "Betel_Tickets",
    description: "Experiencia de compra de tickets para eventos, pensada para reducir fricción en el proceso.",
    language: "TypeScript",
    type: "E-commerce / eventos",
    homepage: "https://betel-tickets.vercel.app",
  },
  {
    name: "Voge Riders",
    repo: "Voge-Riders",
    description: "Comunidad digital para apasionados por las motos Voge, sus rutas, modelos y experiencias.",
    language: "TypeScript",
    type: "Comunidad",
  },
  {
    name: "Lidbiz",
    repo: "Lidbiz",
    description: "Landing page creada con React y Vite, enfocada en comunicación visual y conversión.",
    language: "JavaScript",
    type: "Landing page",
  },
  {
    name: "Empleados API",
    repo: "EmpleadosApi",
    description: "API RESTful desarrollada con Laravel para administrar información de empleados.",
    language: "PHP",
    type: "Backend / API",
  },
  {
    name: "Employees API",
    repo: "employeesAPI",
    description: "Implementación de servicios REST para operaciones relacionadas con empleados.",
    language: "PHP",
    type: "Backend / API",
  },
  {
    name: "Laravel API",
    repo: "laravelApi",
    description: "Proyecto de exploración backend con Laravel y arquitectura de API REST.",
    language: "PHP",
    type: "Backend / API",
  },
  {
    name: "Portafolio 3D",
    repo: "Portafolio",
    description: "Este portafolio: una experiencia front-end con Three.js, animación 3D y diseño UI/UX.",
    language: "JavaScript",
    type: "Experiencia interactiva",
  },
  {
    name: "Brahian David",
    repo: "Brahian-David",
    description: "Repositorio inicial que documenta el comienzo de mi recorrido como desarrollador.",
    language: "HTML / CSS",
    type: "Primeros trabajos",
  },
];

const renderProjects = () => {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  grid.innerHTML = PROJECTS.map((project) => {
    const repoUrl = `https://github.com/Monkeyxcx/${project.repo}`;
    const previewUrl = project.image || `img/projects/${project.repo}.webp`;
    const liveLink = project.homepage
      ? `<a class="project-card__link" href="${project.homepage}" target="_blank" rel="noopener noreferrer">Ver demo <span aria-hidden="true">↗</span></a>`
      : "";

    return `
      <article class="project-card" data-project="${project.repo}">
        <a class="project-card__image" href="${repoUrl}" target="_blank" rel="noopener noreferrer" aria-label="Abrir repositorio ${project.name}">
          <img src="${previewUrl}" alt="Vista previa del proyecto ${project.name}" width="960" height="480" loading="lazy" decoding="async" />
          <span class="project-card__open" aria-hidden="true">↗</span>
        </a>
        <div class="project-card__body">
          <div class="project-card__meta"><span>${project.type}</span><span>${project.language}</span></div>
          <h3>${project.name}</h3>
          <p>${project.description}</p>
          <div class="project-card__actions">
            <a class="project-card__link" href="${repoUrl}" target="_blank" rel="noopener noreferrer">Código <span aria-hidden="true">↗</span></a>
            ${liveLink}
          </div>
        </div>
      </article>`;
  }).join("");
};

// --- Sección activa (IntersectionObserver: sin scroll handlers) -------------
let activeSectionId = "banner";
const sectionListeners = new Set();

const setActiveSection = (id) => {
  if (id === activeSectionId) return;
  activeSectionId = id;
  document.querySelectorAll(".section.is-active").forEach((s) => s.classList.remove("is-active"));
  document.getElementById(id)?.classList.add("is-active");
  sectionListeners.forEach((listener) => listener(id));
};

const startSectionObserver = () => {
  document.getElementById("banner")?.classList.add("is-active");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      }
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
  );
  document.querySelectorAll(".section").forEach((section) => observer.observe(section));
};

// Las animaciones infinitas de las cards sólo corren cuando son visibles.
const startDecorObserver = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle("in-view", entry.isIntersecting);
    },
    { rootMargin: "15% 0px", threshold: 0 }
  );
  document.querySelectorAll(".featured-project").forEach((el) => observer.observe(el));
};

// --- Escena 3D (carga diferida, fuera de la ruta crítica) --------------------
const init3D = ({ THREE, GLTFLoader, DRACOLoader, gsap }) => {
  const container = document.getElementById("container3D");
  if (!container) return null;

  const camera = new THREE.PerspectiveCamera(
    isNarrow.matches ? 15 : 5,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = isNarrow.matches ? 40 : 70;

  const scene = new THREE.Scene();

  // Pixel ratio: tope 1.5 en escritorio y 1.25 en táctil (antes 2 = 4x píxeles).
  const pixelRatioCap = isCoarse ? 1.25 : 1.5;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isCoarse && (window.devicePixelRatio || 1) <= 1.5,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.warn("WebGL no disponible; se omite la escena 3D.", error);
    return null;
  }

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  let mixer = null;
  let world = null;
  const modelPivot = new THREE.Group();
  scene.add(modelPivot);
  let engineLight = null;
  let elapsed = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  // Traslación fija; la interacción solo modifica yaw, pitch y roll.
  const dragRotation = { x: 0, y: 0, z: 0 };
  let hasManualRotation = false;
  let dragging = false;
  let activePointerId = null;
  let lastDragPoint = null;
  const gestureZone = document.getElementById("car-gesture-zone");

  // Interacción reciente: decide 60 vs 30 fps en el gobernador de render.
  let idleAt = performance.now();
  const markActivity = () => {
    idleAt = performance.now();
  };
  ["pointermove", "wheel", "touchstart", "keydown", "scroll"].forEach((type) =>
    window.addEventListener(type, markActivity, { passive: true })
  );

  // --- Luces ---
  scene.add(new THREE.AmbientLight(0xffffff, isCoarse ? 0.5 : 1.3));
  const topLight = new THREE.DirectionalLight(0xffffff, isCoarse ? 0.8 : 1);
  topLight.position.set(500, 500, 500);
  scene.add(topLight);

  engineLight = new THREE.PointLight(0xff7a18, 0, 9, 2);
  scene.add(engineLight);

  // --- Movimiento por sección ---
  const moveModelTo = (id, instant = false) => {
    if (!world) return;
    const set = isNarrow.matches ? POSITION_SETS.mobile : POSITION_SETS.desktop;
    const target = set.find((entry) => entry.id === id);
    if (!target) return;
    markActivity();

    const duration = instant || reducedMotion.matches ? 0 : isNarrow.matches ? 2 : 3;

    // El modelo conserva su posición local (0, 0, 0); solo se mueve el pivote
    // de composición para las transiciones visuales entre secciones.
    gsap.to(modelPivot.position, { x: target.position.x, y: target.position.y, z: target.position.z, duration, ease: "power2.out", overwrite: "auto" });
    gsap.to(world.rotation, { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z, duration, ease: "power2.out", overwrite: "auto" });
    gsap.to(modelPivot.scale, { x: target.scale, y: target.scale, z: target.scale, duration, ease: "power3.inOut", overwrite: "auto" });
  };
  sectionListeners.add((id) => moveModelTo(id));

  // --- Carga del modelo (Draco) ---
  const dracoLoader = new DRACOLoader();
  // Decodificador local: worker same-origin (nunca cross-origin) y sin red.
  dracoLoader.setDecoderPath(new URL("./draco/", import.meta.url).href);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    new URL("./car.glb", import.meta.url).href,
    (gltf) => {
      world = gltf.scene;
      world.position.set(0, 0, 0);
      world.scale.setScalar(1);
      modelPivot.add(world);
      world.traverse((object) => {
        if (object.isMesh) object.frustumCulled = true;
      });

      world.add(engineLight);
      engineLight.position.set(0.15, 0.15, 0.8);

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(world);
        const action = mixer.clipAction(gltf.animations[0]);
        action.setDuration(isNarrow.matches ? 150 : 100).play();
      }

      moveModelTo(activeSectionId, true);
      container.classList.add("ready");
      window.__PORTFOLIO_3D_READY = true;
    },
    undefined,
    (error) => console.error("No se pudo cargar el modelo 3D:", error)
  );

  // --- Gobernador de render -------------------------------------------------
  // 60 fps mientras el usuario interactúa, 30 fps en reposo y pixel ratio
  // adaptativo si el frame medio se pasa de ~24 ms.
  let lastRenderAt = 0;
  let gapEMA = 16;
  let lastAdjustAt = 0;

  const animate = (time) => {
    const interacting = performance.now() - idleAt < 1500;
    const targetFps = isCoarse ? 30 : interacting ? 60 : 30;
    const budget = 1000 / targetFps - 1.5;
    if (time - lastRenderAt < budget) return;

    const gap = lastRenderAt ? time - lastRenderAt : budget;
    lastRenderAt = time;
    gapEMA = gapEMA * 0.85 + gap * 0.15;

    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    if (mixer && !reducedMotion.matches) mixer.update(delta);

    pointer.x += (pointer.targetX - pointer.x) * 0.06;
    pointer.y += (pointer.targetY - pointer.y) * 0.06;
    if (world && (!reducedMotion.matches || hasManualRotation)) {
      // La posición del pivote permanece fija. Solo se interpolan los tres
      // ángulos locales: pitch (X), yaw (Y) y roll (Z).
      const targetRotationX = hasManualRotation ? dragRotation.x : 0;
      const targetRotationY = hasManualRotation ? dragRotation.y : 0;
      const targetRotationZ = hasManualRotation ? dragRotation.z : 0;
      modelPivot.rotation.x += (targetRotationX - modelPivot.rotation.x) * 0.12;
      modelPivot.rotation.y += (targetRotationY - modelPivot.rotation.y) * 0.12;
      modelPivot.rotation.z += (targetRotationZ - modelPivot.rotation.z) * 0.12;
    } else {
      modelPivot.rotation.set(0, 0, 0);
    }

    const pulse = reducedMotion.matches ? 0 : (Math.sin(elapsed * 3.2) + 1) / 2;
    if (engineLight) engineLight.intensity = 0.35 + pulse * 0.8;
    renderer.render(scene, camera);

    // Ajuste de resolución: se penaliza si el frame supera el presupuesto y se
    // recupera sólo tras 3 s estables (evita oscilar arriba/abajo).
    if (time - lastAdjustAt > 1000) {
      if (gapEMA > 24 && pixelRatio > 0.85) {
        pixelRatio = Math.max(0.85, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        lastAdjustAt = time;
      } else if (gapEMA < 15 && pixelRatio < pixelRatioCap && time - lastAdjustAt > 3000) {
        pixelRatio = Math.min(pixelRatioCap, pixelRatio + 0.25);
        renderer.setPixelRatio(pixelRatio);
        lastAdjustAt = time;
      }
    }
  };
  renderer.setAnimationLoop(animate);

  // --- Pestaña oculta: sin GPU (el delta está topeado al volver) ------------
  const onVisibilityChange = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      clock.getDelta();
      lastRenderAt = 0;
      renderer.setAnimationLoop(animate);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const onPointerMove = (event) => {
    pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  };
  const onPointerLeave = () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  };
  if (!isCoarse) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  }

  // Rotación manual de bajo coste: el modelo permanece en el mismo punto y
  // solo gira el pivote local cuando el usuario arrastra la zona de control.
  const onGestureStart = (event) => {
    if (!gestureZone) return;
    dragging = true;
    activePointerId = event.pointerId;
    lastDragPoint = { x: event.clientX, y: event.clientY };
    hasManualRotation = true;
    markActivity();
    gestureZone.classList.add("is-dragging");
    gestureZone.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onGestureMove = (event) => {
    if (!dragging || event.pointerId !== activePointerId || !lastDragPoint) return;
    const deltaX = event.clientX - lastDragPoint.x;
    const deltaY = event.clientY - lastDragPoint.y;
    lastDragPoint = { x: event.clientX, y: event.clientY };
    // Arrastre horizontal = yaw, vertical = pitch. La combinación de ambos
    // movimientos produce roll, permitiendo controlar los tres ejes desde
    // mouse o touch sin cambiar la posición del objeto.
    dragRotation.y += deltaX * 0.012;
    dragRotation.x += deltaY * 0.009;
    dragRotation.z += (deltaX - deltaY) * 0.004;
    markActivity();
    event.preventDefault();
  };
  const onGestureEnd = (event) => {
    if (event.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    lastDragPoint = null;
    gestureZone?.classList.remove("is-dragging");
  };
  gestureZone?.addEventListener("pointerdown", onGestureStart);
  gestureZone?.addEventListener("pointermove", onGestureMove);
  gestureZone?.addEventListener("pointerup", onGestureEnd);
  gestureZone?.addEventListener("pointercancel", onGestureEnd);

  // --- Resize ---
  let resizeFrame = null;
  const applySize = () => {
    resizeFrame = null;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isNarrow.matches ? 15 : 5;
    camera.position.z = isNarrow.matches ? 40 : 70;
    camera.updateProjectionMatrix();
    pixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (world) moveModelTo(activeSectionId, true);
  };
  const onResize = () => {
    if (resizeFrame === null) resizeFrame = requestAnimationFrame(applySize);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  isNarrow.addEventListener("change", onResize);

  return () => {
    sectionListeners.clear();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    isNarrow.removeEventListener("change", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    gestureZone?.removeEventListener("pointerdown", onGestureStart);
    gestureZone?.removeEventListener("pointermove", onGestureMove);
    gestureZone?.removeEventListener("pointerup", onGestureEnd);
    gestureZone?.removeEventListener("pointercancel", onGestureEnd);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    renderer.setAnimationLoop(null);
    renderer.dispose();
    dracoLoader.dispose();
    if (world) {
      modelPivot.remove(world);
      scene.remove(modelPivot);
      world.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose?.());
      });
    }
  };
};

// Import dinámico: three + gsap entran al presupuesto sólo cuando el navegador
// está ocioso (nunca en el camino crítico de la primera pintura).
const startScene = async () => {
  if (window.__PORTFOLIO_3D_STARTED) return;
  window.__PORTFOLIO_3D_STARTED = true;
  try {
    const [threeModule, loaderModule, dracoModule, gsapModule] = await Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/loaders/DRACOLoader.js"),
      import("https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm"),
    ]);
    init3D({
      THREE: threeModule,
      GLTFLoader: loaderModule.GLTFLoader,
      DRACOLoader: dracoModule.DRACOLoader,
      gsap: gsapModule.gsap,
    });
  } catch (error) {
    console.warn("Escena 3D omitida:", error);
  }
};

const scheduleScene = () => {
  const run = () => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(startScene, { timeout: 3000 });
    } else {
      setTimeout(startScene, 250);
    }
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
};

// --- Arranque ---------------------------------------------------------------
prepareReactiveTitles();
renderProjects();
startSectionObserver();
startDecorObserver();
scheduleScene();
