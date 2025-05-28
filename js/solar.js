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
let mouseClicked = false;

// 星球信息数据
const planetInfo = {
  'sun': {
    name: '太阳',
    type: '恒星',
    diameter: '1,392,700 km',
    mass: '1.989 × 10³⁰ kg',
    distance: '太阳系中心',
    temperature: '5,500°C (表面) / 15,000,000°C (核心)',
    gravity: '28.02 g',
    rotation: '25.05天 (赤道) / 34.4天 (极地)',
    facts: '太阳占太阳系总质量的99.86%',
    features: [
      '太阳核心每秒钟将约6亿吨氢聚变为氦',
      '太阳风影响范围可达冥王星轨道之外',
      '太阳年龄约46亿年，还有约50亿年寿命'
    ],
    composition: '氢(73%)、氦(25%)、其他元素(2%)'
  },
  'mercury': {
    name: '水星',
    type: '类地行星',
    diameter: '4,880 km',
    mass: '3.3011 × 10²³ kg',
    distance: '5,790万 km',
    temperature: '-173°C 到 427°C',
    gravity: '0.38 g',
    rotation: '58.6地球日',
    orbit: '88地球日',
    facts: '水星上的一年只有88个地球日',
    features: [
      '太阳系中最小的行星',
      '昼夜温差最大的行星',
      '表面布满陨石坑，类似月球'
    ],
    moons: 0,
    rings: false
  },
  'venus': {
    name: '金星',
    type: '类地行星',
    diameter: '12,104 km',
    mass: '4.8675 × 10²⁴ kg',
    distance: '1.082亿 km',
    temperature: '462°C (平均)',
    gravity: '0.91 g',
    rotation: '243地球日 (逆行)',
    orbit: '225地球日',
    facts: '金星是太阳系中最热的行星',
    features: [
      '自转方向与其他行星相反',
      '大气压力是地球的92倍',
      '拥有最长的自转周期'
    ],
    atmosphere: '二氧化碳(96.5%)、氮气(3.5%)',
    moons: 0,
    rings: false
  },
  'earth': {
    name: '地球',
    type: '类地行星',
    diameter: '12,742 km',
    mass: '5.972 × 10²⁴ kg',
    distance: '1.496亿 km (1 AU)',
    temperature: '-89°C 到 58°C',
    gravity: '1 g',
    rotation: '23小时56分4秒',
    orbit: '365.25天',
    facts: '地球是已知唯一支持生命的行星',
    features: [
      '表面71%被水覆盖',
      '拥有强大的磁场保护生命免受太阳辐射',
      '唯一有板块构造的行星'
    ],
    atmosphere: '氮气(78%)、氧气(21%)、其他(1%)',
    moons: 1,
    rings: false,
    life: '已知唯一有生命的行星'
  },
  'mars': {
    name: '火星',
    type: '类地行星',
    diameter: '6,779 km',
    mass: '6.417 × 10²³ kg',
    distance: '2.279亿 km',
    temperature: '-140°C 到 20°C',
    gravity: '0.38 g',
    rotation: '24小时37分',
    orbit: '687地球日',
    facts: '火星拥有太阳系中最大的沙尘暴',
    features: [
      '拥有太阳系最高的火山 - 奥林匹斯山',
      '有四季变化，类似地球',
      '曾经可能有液态水'
    ],
    atmosphere: '二氧化碳(95%)、氮气(3%)、氩气(2%)',
    moons: 2,
    rings: false,
    exploration: '目前有多个探测器在火星工作'
  },
  'jupiter': {
    name: '木星',
    type: '气态巨行星',
    diameter: '139,820 km',
    mass: '1.898 × 10²⁷ kg',
    distance: '7.785亿 km',
    temperature: '-108°C (云顶)',
    gravity: '2.53 g',
    rotation: '9小时55分',
    orbit: '11.86地球年',
    facts: '木星是太阳系中自转最快的行星',
    features: [
      '太阳系最大的行星',
      '拥有强大的磁场和辐射带',
      '大红斑是一个持续数百年的风暴'
    ],
    atmosphere: '氢(90%)、氦(10%)',
    moons: 79,
    rings: true,
    special: '可以看作一个"失败的恒星"'
  },
  'saturn': {
    name: '土星',
    type: '气态巨行星',
    diameter: '116,460 km',
    mass: '5.683 × 10²⁶ kg',
    distance: '14.34亿 km',
    temperature: '-139°C (云顶)',
    gravity: '1.07 g',
    rotation: '10小时33分',
    orbit: '29.46地球年',
    facts: '土星拥有超过80颗卫星',
    features: [
      '拥有壮观的行星环系统',
      '密度比水还低，可以浮在水上',
      '拥有六边形的极地风暴'
    ],
    atmosphere: '氢(96%)、氦(3%)',
    moons: 83,
    rings: true,
    ringDetails: '主要由冰和岩石颗粒组成'
  },
  'uranus': {
    name: '天王星',
    type: '冰巨星',
    diameter: '50,724 km',
    mass: '8.681 × 10²⁵ kg',
    distance: '28.71亿 km',
    temperature: '-197°C (云顶)',
    gravity: '0.89 g',
    rotation: '17小时14分 (逆行)',
    orbit: '84.01地球年',
    facts: '天王星是侧向自转的行星',
    features: [
      '自转轴倾斜98°，几乎是躺着转',
      '大气层含有大量甲烷，呈现蓝色',
      '拥有暗淡的行星环'
    ],
    atmosphere: '氢(83%)、氦(15%)、甲烷(2%)',
    moons: 27,
    rings: true,
    discovery: '1781年由威廉·赫歇尔发现'
  },
  'neptune': {
    name: '海王星',
    type: '冰巨星',
    diameter: '49,244 km',
    mass: '1.024 × 10²⁶ kg',
    distance: '44.95亿 km',
    temperature: '-201°C (云顶)',
    gravity: '1.14 g',
    rotation: '16小时6分',
    orbit: '164.8地球年',
    facts: '海王星拥有太阳系中最强的风暴',
    features: [
      '通过数学预测而非观测发现的行星',
      '风速可达2100 km/h',
      '拥有活跃的天气系统'
    ],
    atmosphere: '氢(80%)、氦(19%)、甲烷(1%)',
    moons: 14,
    rings: true,
    exploration: '仅有旅行者2号在1989年近距离探测过'
  }
};

const scene = new THREE.Scene();

// 设置星空背景 - 修改后的立方体贴图加载方式
const cubeTextureLoader = new THREE.CubeTextureLoader();
const cubeTexture = cubeTextureLoader.load([
  './image/stars.jpg', // 右
  './image/stars.jpg', // 左
  './image/stars.jpg', // 上
  './image/stars.jpg', // 下
  './image/stars.jpg', // 前
  './image/stars.jpg'  // 后
]);

// 增强星空效果
cubeTexture.encoding = THREE.sRGBEncoding; // 使用sRGB色彩空间
cubeTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // 启用各向异性过滤

scene.background = cubeTexture;

// 添加更多星星效果
const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1,
  transparent: true,
  opacity: 0.8
});

const starVertices = [];
for (let i = 0; i < 10000; i++) {
  const x = (Math.random() - 0.5) * 2000;
  const y = (Math.random() - 0.5) * 2000;
  const z = (Math.random() - 0.5) * 2000;
  starVertices.push(x, y, z);
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

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
orbit.autoRotate = true;
orbit.autoRotateSpeed = 2.0;
orbit.enableDamping = true;
orbit.dampingFactor = 0.05;

// 创建太阳
const sungeo = new THREE.SphereGeometry(15, 50, 50);
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sun = new THREE.Mesh(sungeo, sunMaterial);
sun.name = 'sun';
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

// 添加控制变量
const controls = {
  realisticView: true,
  showOrbits: true,
  speed: 1,
  currentView: 'top'
};

// 获取控制元素
const realisticViewToggle = document.getElementById('realistic-view');
const showOrbitsToggle = document.getElementById('show-orbits');
const speedControl = document.getElementById('speed-control');
const speedValue = document.getElementById('speed-value');
const viewPresets = document.getElementById('view-presets');

// 初始化控制状态
realisticViewToggle.checked = controls.realisticView;
showOrbitsToggle.checked = controls.showOrbits;
speedControl.value = controls.speed;
speedValue.textContent = `${controls.speed.toFixed(1)}x`;
viewPresets.value = controls.currentView;

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

// 预设视角切换
viewPresets.addEventListener('change', (e) => {
  controls.currentView = e.target.value;

  switch(controls.currentView) {
    case 'top': // 太阳系俯视图
      camera.position.set(0, 300, 0);
      camera.lookAt(0, 0, 0);
      break;

    case 'ecliptic': // 黄道平面
      camera.position.set(0, 0, 200);
      camera.lookAt(0, 0, 0);
      break;

    case 'side': // 侧面视角
      camera.position.set(200, 100, 0);
      camera.lookAt(0, 0, 0);
      break;
  }
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
function animate() {
  // 更新轨道控制器
  orbit.update();

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
      orbit.enabled = false;
      orbit.autoRotate = false;

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
      <h3 class="planet-name">
        ${info.name}
        <span class="planet-type">${info.type}</span>
      </h3>
    </div>
    <div class="tooltip-content">
      <div class="info-row">
        <div class="info-icon">🌐</div>
        <div class="info-label">直径</div>
        <div class="info-value">${info.diameter}</div>
      </div>
      <div class="info-row">
        <div class="info-icon">⚖️</div>
        <div class="info-label">质量</div>
        <div class="info-value">${info.mass}</div>
      </div>
      <div class="info-row">
        <div class="info-icon">📏</div>
        <div class="info-label">与太阳距离</div>
        <div class="info-value">${info.distance}</div>
      </div>
      <div class="info-row">
        <div class="info-icon">🌡️</div>
        <div class="info-label">温度</div>
        <div class="info-value">${info.temperature}</div>
      </div>
      
      <div class="feature-block">
        <div class="feature-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
          特色事实
        </div>
        <div class="feature-text">${info.facts}</div>
      </div>
      
      <div class="planet-status">
        <div class="status-item">
          <div class="status-value">${info.moons}</div>
          <div class="status-label">卫星</div>
        </div>
        <div class="status-item">
          <div class="status-value">${info.rings ? '有' : '无'}</div>
          <div class="status-label">行星环</div>
        </div>
        <div class="status-item">
          <div class="status-value">${info.gravity}</div>
          <div class="status-label">重力</div>
        </div>
      </div>
    </div>
  `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${x + 20}px`;
        tooltip.style.top = `${y}px`;
        tooltip.classList.add('visible');
      }
    }

    // 检查地球点击
    if (mouseClicked && planet.name === 'earth') {
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
    orbit.enabled = true;
    orbit.autoRotate = true;

    tooltip.classList.remove('visible');
    setTimeout(() => {
      if (!hoveredPlanet) {
        tooltip.style.display = 'none';
      }
    }, 300);
  }

  // 重置点击状态
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