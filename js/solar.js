import * as THREE from "https://unpkg.com/three@0.127.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js";

// 初始化渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
const container = document.getElementById('canvas-container');
// 使用容器实际大小
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// 纹理加载器
const textureLoader = new THREE.TextureLoader();

// 加载所有星球纹理
const starTexture = textureLoader.load("./image/stars.jpg");
const sunTexture = textureLoader.load("./image/sun.jpg");
const mercuryTexture = textureLoader.load("./image/mercury.jpg");
const venusTexture = textureLoader.load("./image/venus.jpg");
const earthTexture = textureLoader.load("./image/earth.jpg");
const marsTexture = textureLoader.load("./image/mars.jpg");
const jupiterTexture = textureLoader.load("./image/jupiter.jpg");
const saturnTexture = textureLoader.load("./image/saturn.jpg");
const uranusTexture = textureLoader.load("./image/uranus.jpg");
const neptuneTexture = textureLoader.load("./image/neptune.jpg");
const plutoTexture = textureLoader.load("./image/pluto.jpg");
const saturnRingTexture = textureLoader.load("./image/saturn_ring.png");
const uranusRingTexture = textureLoader.load("./image/uranus_ring.png");

// 工具提示元素和射线检测
const tooltip = document.getElementById('planet-tooltip');
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPlanet = null;
let mouseClicked = false; // 添加鼠标点击状态

// 星球信息数据
const planetInfo = {
  'sun': {
    name: '太阳',
    diameter: '1,392,700 km',
    mass: '1.989 × 10^30 kg',
    distance: '中心',
    facts: '太阳占太阳系总质量的99.86%'
  },
  'mercury': {
    name: '水星',
    diameter: '4,880 km',
    mass: '3.3011 × 10^23 kg',
    distance: '5,790万 km',
    facts: '水星上的一年只有88个地球日'
  },
  'venus': {
    name: '金星',
    diameter: '12,104 km',
    mass: '4.8675 × 10^24 kg',
    distance: '1.082亿 km',
    facts: '金星是太阳系中最热的行星'
  },
  'earth': {
    name: '地球',
    diameter: '12,742 km',
    mass: '5.972 × 10^24 kg',
    distance: '1.496亿 km',
    facts: '地球是已知唯一支持生命的行星'
  },
  'mars': {
    name: '火星',
    diameter: '6,779 km',
    mass: '6.417 × 10^23 kg',
    distance: '2.279亿 km',
    facts: '火星拥有太阳系中最大的沙尘暴'
  },
  'jupiter': {
    name: '木星',
    diameter: '139,820 km',
    mass: '1.898 × 10^27 kg',
    distance: '7.785亿 km',
    facts: '木星是太阳系中自转最快的行星'
  },
  'saturn': {
    name: '土星',
    diameter: '116,460 km',
    mass: '5.683 × 10^26 kg',
    distance: '14.34亿 km',
    facts: '土星拥有超过80颗卫星'
  },
  'uranus': {
    name: '天王星',
    diameter: '50,724 km',
    mass: '8.681 × 10^25 kg',
    distance: '28.71亿 km',
    facts: '天王星是侧向自转的行星'
  },
  'neptune': {
    name: '海王星',
    diameter: '49,244 km',
    mass: '1.024 × 10^26 kg',
    distance: '44.95亿 km',
    facts: '海王星拥有太阳系中最强的风暴'
  }
};

const scene = new THREE.Scene();

// 设置星空背景
const cubeTextureLoader = new THREE.CubeTextureLoader();
const cubeTexture = cubeTextureLoader.load([
  starTexture, starTexture, starTexture,
  starTexture, starTexture, starTexture
]);
scene.background = cubeTexture;

// 设置透视相机
const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(-50, 90, 150);

// 轨道控制器
const orbit = new OrbitControls(camera, renderer.domElement);

// 创建太阳
const sungeo = new THREE.SphereGeometry(15, 50, 50);
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sun = new THREE.Mesh(sungeo, sunMaterial);
sun.name = 'sun'; // 为太阳添加名称标识
scene.add(sun);

// 太阳光源
const sunLight = new THREE.PointLight(0xffffff, 4, 300);
scene.add(sunLight);

// 环境光
const ambientLight = new THREE.AmbientLight(0xffffff, 0);
scene.add(ambientLight);

// 创建行星轨道线
const path_of_planets = [];
function createLineLoopWithMesh(radius, color, width) {
  const material = new THREE.LineBasicMaterial({ color: color, linewidth: width });
  const geometry = new THREE.BufferGeometry();
  const lineLoopPoints = [];

  // 计算圆形轨道的点
  const numSegments = 100;
  for (let i = 0; i <= numSegments; i++) {
    const angle = (i / numSegments) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    lineLoopPoints.push(x, 0, z);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(lineLoopPoints, 3));
  const lineLoop = new THREE.LineLoop(geometry, material);
  scene.add(lineLoop);
  path_of_planets.push(lineLoop);
}

// 生成行星
const generatePlanet = (size, planetTexture, x, ring) => {
  const planetGeometry = new THREE.SphereGeometry(size, 50, 50);
  const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture });
  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  const planetObj = new THREE.Object3D();
  planet.position.set(x, 0, 0);

  if (ring) {
    const ringGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      map: ring.ringmat,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    planetObj.add(ringMesh);
    ringMesh.position.set(x, 0, 0);
    ringMesh.rotation.x = -0.5 * Math.PI;
  }

  scene.add(planetObj);
  planetObj.add(planet);
  createLineLoopWithMesh(x, 0xffffff, 3);

  return {
    planetObj: planetObj,
    planet: planet
  };
};

// 行星数据
const planets = [
  {
    ...generatePlanet(3.2, mercuryTexture, 28),
    name: 'mercury',
    rotaing_speed_around_sun: 0.004,
    self_rotation_speed: 0.004,
  },
  {
    ...generatePlanet(5.8, venusTexture, 44),
    name: 'venus',
    rotaing_speed_around_sun: 0.015,
    self_rotation_speed: 0.002,
  },
  {
    ...generatePlanet(6, earthTexture, 62),
    name: 'earth',
    rotaing_speed_around_sun: 0.01,
    self_rotation_speed: 0.02,
  },
  {
    ...generatePlanet(4, marsTexture, 78),
    name: 'mars',
    rotaing_speed_around_sun: 0.008,
    self_rotation_speed: 0.018,
  },
  {
    ...generatePlanet(12, jupiterTexture, 100),
    name: 'jupiter',
    rotaing_speed_around_sun: 0.002,
    self_rotation_speed: 0.04,
  },
  {
    ...generatePlanet(10, saturnTexture, 138, {
      innerRadius: 10,
      outerRadius: 20,
      ringmat: saturnRingTexture,
    }),
    name: 'saturn',
    rotaing_speed_around_sun: 0.0009,
    self_rotation_speed: 0.038,
  },
  {
    ...generatePlanet(7, uranusTexture, 176, {
      innerRadius: 7,
      outerRadius: 12,
      ringmat: uranusRingTexture,
    }),
    name: 'uranus',
    rotaing_speed_around_sun: 0.0004,
    self_rotation_speed: 0.03,
  },
  {
    ...generatePlanet(7, neptuneTexture, 200),
    name: 'neptune',
    rotaing_speed_around_sun: 0.0001,
    self_rotation_speed: 0.032,
  },
  {
    ...generatePlanet(2.8, plutoTexture, 216),
    name: 'pluto',
    rotaing_speed_around_sun: 0.0007,
    self_rotation_speed: 0.008,
  },
];

// 为每个行星设置名称
planets.forEach(planet => {
  planet.planet.name = planet.name;
});

// 添加新的控制变量
const controls = {
  realisticView: true,
  showOrbits: true,
  speed: 1
};

// 获取控制元素
const realisticViewToggle = document.getElementById('realistic-view');
const showOrbitsToggle = document.getElementById('show-orbits');
const speedControl = document.getElementById('speed-control');
const speedValue = document.getElementById('speed-value');

// 初始化控制状态
realisticViewToggle.checked = controls.realisticView;
showOrbitsToggle.checked = controls.showOrbits;
speedControl.value = controls.speed;
speedValue.textContent = `${controls.speed.toFixed(1)}x`;

// 添加事件监听
realisticViewToggle.addEventListener('change', (e) => {
  controls.realisticView = e.target.checked;
  ambientLight.intensity = controls.realisticView ? 0 : 0.5;
});

showOrbitsToggle.addEventListener('change', (e) => {
  controls.showOrbits = e.target.checked;
  path_of_planets.forEach((dpath) => {
    dpath.visible = controls.showOrbits;
  });
});

speedControl.addEventListener('input', (e) => {
  controls.speed = parseFloat(e.target.value);
  speedValue.textContent = `${controls.speed.toFixed(1)}x`;
});

// 设置初始状态
ambientLight.intensity = controls.realisticView ? 0 : 0.5;
path_of_planets.forEach((dpath) => {
  dpath.visible = controls.showOrbits;
});

// 鼠标移动事件处理
window.addEventListener('mousemove', (event) => {
  // 计算鼠标在归一化设备坐标中的位置
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
});

// 鼠标点击事件处理
window.addEventListener('click', () => {
  mouseClicked = true;
});

// 关闭世界视图按钮事件处理
document.getElementById('close-world').addEventListener('click', () => {
  const worldContainer = document.getElementById('world-container');
  worldContainer.style.display = 'none';

  // 恢复太阳系动画
  renderer.setAnimationLoop(animate);
});

// 动画循环
function animate(time) {
  // 更新射线检测
  raycaster.setFromCamera(mouse, camera);

  // 检测与行星的交点
  const intersects = raycaster.intersectObjects(
      [sun, ...planets.map(p => p.planet)],
      true
  );

  // 处理工具提示显示
  if (intersects.length > 0) {
    const planet = intersects[0].object;
    if (planet.name && planet.name !== hoveredPlanet) {
      hoveredPlanet = planet.name;

      // 获取行星在屏幕上的位置
      const planetPosition = planet.getWorldPosition(new THREE.Vector3());
      const screenPosition = planetPosition.clone().project(camera);

      // 获取 canvas 的位置和尺寸
      const canvasRect = container.getBoundingClientRect();

      // 转换为屏幕坐标
      const x = (screenPosition.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
      const y = (-(screenPosition.y * 0.5) + 0.5) * canvasRect.height + canvasRect.top;

      // 显示工具提示
      const info = planetInfo[planet.name];
      if (info) {
        tooltip.innerHTML = `
          <div class="tooltip-header">
            <h3 class="planet-name">${info.name}</h3>
            <div class="planet-type">行星</div>
          </div>
          <div class="tooltip-content">
            <div class="info-row">
              <span class="info-label">直径:</span>
              <span class="info-value">${info.diameter}</span>
            </div>
            <div class="info-row">
              <span class="info-label">质量:</span>
              <span class="info-value">${info.mass}</span>
            </div>
            <div class="info-row">
              <span class="info-label">与太阳距离:</span>
              <span class="info-value">${info.distance}</span>
            </div>
            <div class="fun-fact">
              <span class="fact-icon">✨</span>
              <span>${info.facts}</span>
            </div>
          </div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${x + 20}px`; // 添加偏移量，避免遮挡
        tooltip.style.top = `${y}px`;
        tooltip.classList.add('visible');
      }
    }

    // 检查地球点击
    if (mouseClicked && planet.name === 'earth') {
      console.log("[DEBUG] Earth clicked!");

      const worldContainer = document.getElementById('world-container');
      const worldIframe = document.getElementById('world-iframe');

      // 加载 world.html
      worldIframe.src = 'world.html';
      worldContainer.style.display = 'block';

      // 暂停太阳系动画
      renderer.setAnimationLoop(null);

      // 重置点击状态
      mouseClicked = false;
    }
  } else if (hoveredPlanet) {
    hoveredPlanet = null;
    tooltip.classList.remove('visible');
    setTimeout(() => {
      if (!hoveredPlanet) {
        tooltip.style.display = 'none';
      }
    }, 300);
  }

  // 重置点击状态（如果没有点击任何行星）
  if (mouseClicked) {
    mouseClicked = false;
  }

  // 更新行星运动
  sun.rotateY(controls.speed * 0.004);
  planets.forEach(({ planetObj, planet, rotaing_speed_around_sun, self_rotation_speed }) => {
    planetObj.rotateY(controls.speed * rotaing_speed_around_sun);
    planet.rotateY(controls.speed * self_rotation_speed);
  });

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// 窗口大小调整处理
window.addEventListener("resize", () => {
  // 更新容器和渲染器尺寸
  renderer.setSize(container.clientWidth, container.clientHeight);

  // 更新相机宽高比
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
});